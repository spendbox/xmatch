-- Dashpad update: a notification when a new Truth goes up (Part 116)
-- Run this once in Supabase, after update 115: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- When the new Truth goes up (8pm Lagos time, or the hour set in Admin -> Truths), everyone with
-- notifications on gets one: "Today's Truth is up" with the question. The 5-minute job sends them.
-- Each person is told once per Truth, and not at all if they've already answered it. If the job
-- was down, it stops trying 3 hours after the start, so nobody is woken at 3am.
-- Switch it off or on in Admin -> Truths (setting truths_push: 1 = on, 0 = off).

insert into public.app_settings (key, value) values ('truths_push', 1) on conflict (key) do nothing;

-- Who has been told about which Truth (one row per person, the latest Truth)
create table if not exists public.truth_told (
  user_id uuid primary key references public.profiles on delete cascade,
  truth_id bigint not null,
  at timestamptz not null default now()
);
alter table public.truth_told enable row level security;

-- Today's Truth, picking the next undated one if nothing is set for today
create or replace function public.truth_pick(d date) returns public.truths
language plpgsql security definer set search_path = public as $$
declare t truths;
begin
  select * into t from truths where day = d and active;
  if found then return t; end if;
  begin
    update truths set day = null where day = d and not active;
    update truths set day = d
    where id = (select id from truths where day is null and active order by id limit 1) and day is null
    returning * into t;
  exception when unique_violation then
    null;
  end;
  if t.id is null then select * into t from truths where day = d and active; end if;
  return t;
end $$;
revoke all on function public.truth_pick(date) from public, anon, authenticated;

-- The next people to tell about today's Truth (each is marked as told as they're returned)
create or replace function public.truth_push_batch(p_limit int default 500) returns json
language plpgsql security definer set search_path = public as $$
declare
  d date := public.truth_day();
  h int := least(23, greatest(0, public.setting_int('truths_hour', 20)));
  starts timestamptz := (d::timestamp + make_interval(hours => h)) at time zone 'Africa/Lagos';
  t truths;
  who uuid[];
begin
  if public.setting_int('truths_push', 1) = 0 then return null; end if;
  if now() > starts + interval '3 hours' then return null; end if;
  t := public.truth_pick(d);
  if t.id is null then return null; end if;
  with todo as (
    select distinct s.user_id from push_subscriptions s
    where not exists (select 1 from truth_told x where x.user_id = s.user_id and x.truth_id = t.id)
      and not exists (select 1 from truth_answers a where a.user_id = s.user_id and a.truth_id = t.id)
    limit greatest(1, least(p_limit, 2000))
  ), told as (
    insert into truth_told (user_id, truth_id)
    select user_id, t.id from todo
    on conflict (user_id) do update set truth_id = excluded.truth_id, at = now()
      where truth_told.truth_id <> excluded.truth_id
    returning user_id
  )
  select coalesce(array_agg(user_id), '{}') into who from told;
  return json_build_object('id', t.id, 'body', t.body, 'users', who);
end $$;
revoke all on function public.truth_push_batch(int) from public, anon, authenticated;
