-- Dashpad update: the My Spills page (Part 118)
-- Run this once in Supabase, after update 117: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- My Spills gets its own page: search, filters ("With my voice", "I was in the minority") and your
-- stats (how many you've spilled, your streaks, how often you agree with most people).
-- Still private: only you can see any of it.

-- The list, newest first, with search and filters (replaces the one from update 117)
drop function if exists public.my_spills(date, int);
create or replace function public.my_spills(p_before date default null, p_limit int default 30, p_query text default null, p_filter text default null)
returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(r order by r.day desc), '[]'::json) from (
    select t.id, t.day, t.body, t.options, a.choice, a.voice_key as key, a.voice_seconds as seconds,
      a.voice_style as style, a.listens, a.hidden, c.total, c.same, c.top
    from truth_answers a
    join truths t on t.id = a.truth_id
    cross join lateral (
      select sum(n)::int as total,
        coalesce(sum(n) filter (where choice = a.choice), 0)::int as same,
        max(n)::int as top
      from (select choice, count(*) as n from truth_answers x where x.truth_id = t.id group by choice) g
    ) c
    where a.user_id = auth.uid() and t.day is not null
      and (p_before is null or t.day < p_before)
      and (coalesce(p_query, '') = '' or t.body ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%')
      and (p_filter is null or p_filter = ''
        or (p_filter = 'voice' and a.voice_key is not null)
        or (p_filter = 'minority' and c.same < c.top))
    order by t.day desc
    limit least(greatest(p_limit, 1), 60)
  ) r
$$;
revoke all on function public.my_spills(date, int, text, text) from public, anon;
grant execute on function public.my_spills(date, int, text, text) to authenticated;

-- Your Spill stats: how many, current and longest streak, how often you agree with most people,
-- and your latest one
create or replace function public.my_spill_stats() returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d date := public.truth_day();
  days date[];
  total int;
  voices int;
  longest int := 0;
  run int := 0;
  current int := 0;
  prev date;
  x date;
  majority int;
  latest json;
begin
  if uid is null then return null; end if;
  select array_agg(t.day order by t.day), count(*)::int, count(a.voice_key)::int into days, total, voices
  from truth_answers a join truths t on t.id = a.truth_id where a.user_id = uid and t.day is not null;
  if coalesce(total, 0) = 0 then return json_build_object('total', 0); end if;
  foreach x in array days loop
    run := case when prev is not null and x = prev + 1 then run + 1 else 1 end;
    longest := greatest(longest, run);
    prev := x;
  end loop;
  -- The streak is still alive if your last Spill was today or yesterday
  current := case when prev >= d - 1 then run else 0 end;
  select count(*)::int into majority from truth_answers a
  where a.user_id = uid and (select count(*) from truth_answers y where y.truth_id = a.truth_id and y.choice = a.choice)
    >= (select max(n) from (select count(*) as n from truth_answers z where z.truth_id = a.truth_id group by z.choice) g);
  select json_build_object('day', t.day, 'body', t.body,
      'answer', (select o->>'label' from jsonb_array_elements(t.options) o where o->>'id' = a.choice))
    into latest
  from truth_answers a join truths t on t.id = a.truth_id
  where a.user_id = uid and t.day is not null order by t.day desc limit 1;
  return json_build_object('total', total, 'voices', voices, 'streak', current, 'longest', longest,
    'majority', round(100.0 * majority / total)::int, 'latest', latest);
end $$;
revoke all on function public.my_spill_stats() from public, anon;
grant execute on function public.my_spill_stats() to authenticated;
