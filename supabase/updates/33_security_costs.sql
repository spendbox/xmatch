-- Dashpad update: security and cost fixes (Part 33)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 32 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 33: Security and cost fixes
-- 1. People could edit some parts of their own profile directly that only Dashpad
--    should change: ghost mode (free, forever), their matching words, when they
--    were last online, and photo links from other websites. Those are now
--    protected, and a birthday can only be set while signing up (18+ only).
-- 2. "Usually replies in…" was worked out from 60 days of messages every time a
--    masked chat refreshed and for everyone at every hourly pairing. It's now
--    kept for each person and refreshed every few hours, a little at a time.
-- 3. Extra details sent with a photo or voice note are capped in size.
-- ---------------------------------------------------------------------------

-- 1. Guard direct profile edits from the app (Dashpad's own functions aren't affected)
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
declare
  url text;
begin
  if current_user <> 'authenticated' then return new; end if;
  new.id := old.id;
  new.created_at := old.created_at;
  -- Ghost mode is paid for through set_ghost
  new.ghost_on := old.ghost_on;
  new.ghost_until := old.ghost_until;
  -- Online status comes from the app's check-in
  new.last_seen_at := old.last_seen_at;
  -- Matching words always come from the answers
  new.thing_keys := public.thing_keywords(new.things);
  if jsonb_typeof(new.things) <> 'array' or jsonb_array_length(new.things) > 40 or pg_column_size(new.things) > 8000 then
    raise exception 'Too many things';
  end if;
  -- A birthday is set while signing up, and you have to be 18
  if new.birthdate is distinct from old.birthdate then
    if old.birthdate is not null and cardinality(coalesce(old.photos, '{}')) > 0 then
      raise exception 'Your birthday can''t be changed. Contact support if it''s wrong.';
    end if;
    if new.birthdate is null or public.age_years(new.birthdate) < 18 then
      raise exception 'You need to be 18 or older to use Dashpad';
    end if;
  end if;
  -- Photos: up to 6, and only ones uploaded to your own folder on Dashpad
  if cardinality(coalesce(new.photos, '{}')) > 6 then raise exception 'Up to 6 photos'; end if;
  foreach url in array coalesce(new.photos, '{}') loop
    -- (only new ones are checked, so older photos never get in the way)
    if not (url = any(coalesce(old.photos, '{}'))) and position('/storage/v1/object/public/photos/' || new.id::text || '/' in url) = 0 then
      raise exception 'Photos must be uploaded to Dashpad';
    end if;
  end loop;
  if cardinality(coalesce(new.interests, '{}')) > 12 then raise exception 'Too many interests'; end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Anyone who already gave themselves ghost mode without paying loses it
update public.profiles p set ghost_on = false, ghost_until = null
where p.ghost_until is not null
  and not exists (select 1 from public.key_transactions k where k.user_id = p.id and k.reason = 'ghost' and k.created_at > p.ghost_until - interval '31 days');

-- Matching words: always rebuilt from the answers
update public.profiles set thing_keys = public.thing_keywords(things) where thing_keys is distinct from public.thing_keywords(things);

-- 2. Reply speed, kept per person instead of worked out every time
create table if not exists public.reply_stats (
  user_id uuid primary key references public.profiles on delete cascade,
  seconds int,
  updated_at timestamptz not null default now()
);
alter table public.reply_stats enable row level security;

-- The full calculation (only used to refresh the stored number)
create or replace function public.reply_seconds_compute(p uuid) returns int
language sql stable security definer set search_path = public as $$
  with mine as (
    select m.match_id as chat, m.sender_id, m.created_at, m.id
    from messages m join matches x on x.id = m.match_id
    where p in (x.user_a, x.user_b) and m.created_at > now() - interval '60 days' and m.kind <> 'call'
    union all
    select mm.session_id, mm.sender_id, mm.created_at, mm.id
    from masquerade_messages mm join masquerade_sessions s on s.id = mm.session_id
    where p in (s.user_a, s.user_b) and mm.created_at > now() - interval '60 days' and mm.sender_id is not null
  ), steps as (
    select sender_id, created_at,
      lag(sender_id) over (partition by chat order by created_at, id) as prev_sender,
      lag(created_at) over (partition by chat order by created_at, id) as prev_at
    from mine
  ), replies as (
    select extract(epoch from created_at - prev_at) as secs from steps
    where sender_id = p and prev_sender is not null and prev_sender <> p
      and created_at - prev_at < interval '12 hours'
  )
  select case when count(*) >= 3 then (percentile_cont(0.5) within group (order by secs))::int end from replies
$$;
revoke all on function public.reply_seconds_compute(uuid) from public, anon, authenticated;

-- Everything that showed or used reply speed now reads the stored number (instant)
create or replace function public.reply_seconds(p uuid) returns int
language sql stable security definer set search_path = public as $$
  select seconds from reply_stats where user_id = p
$$;

-- Refresh a few hundred people at a time: those around today whose number is old
create or replace function public.refresh_reply_stats(p_limit int default 300) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select p.id from profiles p left join reply_stats s on s.user_id = p.id
    where p.last_seen_at > now() - interval '1 day'
      and (s.user_id is null or s.updated_at < now() - interval '6 hours')
    order by s.updated_at nulls first
    limit greatest(1, least(p_limit, 2000))
  loop
    insert into reply_stats (user_id, seconds, updated_at) values (r.id, public.reply_seconds_compute(r.id), now())
    on conflict (user_id) do update set seconds = excluded.seconds, updated_at = excluded.updated_at;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.refresh_reply_stats(int) from public, anon, authenticated;

-- Fill it in now for everyone around this week
select public.refresh_reply_stats(2000);

-- 3. Photo, video and voice note details stay small
alter table public.messages drop constraint if exists messages_meta_small;
alter table public.messages add constraint messages_meta_small check (media_meta is null or pg_column_size(media_meta) <= 4000) not valid;
