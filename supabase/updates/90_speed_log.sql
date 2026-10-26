-- Dashpad update: the speed log (Part 90)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- How long pages take to open and how long each request to the database takes, from people's
-- phones and from the server, for Admin -> Speed. About 1 in 3 visits is recorded. Kept 7 days.

create table if not exists public.speed_samples (
  id bigserial primary key,
  at timestamptz not null default now(),
  -- page: a page opening; browser: a request from a phone; server: a request while building a page
  kind text not null check (kind in ('page', 'browser', 'server')),
  name text not null,
  ms integer not null,
  ok boolean not null default true,
  path text,
  user_id uuid references public.profiles on delete set null
);
create index if not exists speed_samples_time on public.speed_samples (at desc);
-- Only Dashpad's server writes and reads it
alter table public.speed_samples enable row level security;

-- Admin -> Speed: for each page and request, how many, the typical time, the slow ones (1 in 10
-- is slower than this), the slowest and how many failed, over the last few hours
create or replace function public.admin_speed_summary(p_hours int default 24) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.kind, t.p90 desc), '[]'::json) from (
    select kind, name,
      count(*)::int as count,
      round(percentile_cont(0.5) within group (order by ms))::int as p50,
      round(percentile_cont(0.9) within group (order by ms))::int as p90,
      max(ms)::int as max,
      count(*) filter (where not ok)::int as failed
    from speed_samples
    where at > now() - make_interval(hours => greatest(1, least(p_hours, 168)))
    group by kind, name
  ) t
$$;
revoke all on function public.admin_speed_summary(int) from public, anon, authenticated;
