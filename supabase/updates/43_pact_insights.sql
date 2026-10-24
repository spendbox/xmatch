-- Dashpad update: Pact answers and results for admins (Part 43)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 42 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 43: One summary of a pact for the admin page: how people answered each
-- question, who took part, and how matching went (live while it's matching).
-- Only the server can call it. Also: the "people have taken the Pact" number is now
-- recounted every minute, instead of on every answer (that slowed answering down a lot
-- when many people answered at the same time).
-- ---------------------------------------------------------------------------
drop trigger if exists pact_entries_count on public.pact_entries;
drop function if exists public.pact_entries_count();
create or replace function public.refresh_pact_counts() returns void
language sql security definer set search_path = public as $$
  update pacts p set entries_count = c.n
  from (select p2.id, (select count(*) from pact_entries e where e.pact_id = p2.id) n
        from pacts p2 where p2.status <> 'revealed' or p2.reveal_at > now() - interval '3 days') c
  where p.id = c.id and p.entries_count is distinct from c.n;
$$;
revoke execute on function public.refresh_pact_counts() from public, anon, authenticated;
select public.refresh_pact_counts();

create or replace function public.pact_insights(p_pact uuid) returns json
language sql stable security definer set search_path = public as $$
  with e as (select * from pact_entries where pact_id = p_pact),
  picks as (
    -- every answer as (question, option): one row per pick for "pick a few", the number for sliders
    select j.key as q, coalesce(x.value, j.value #>> '{}') as a
    from e
    cross join lateral jsonb_each(e.answers) j
    left join lateral jsonb_array_elements_text(case when jsonb_typeof(j.value) = 'array' then j.value else '[]'::jsonb end) x on true
    where jsonb_typeof(j.value) <> 'array' or x.value is not null
  ),
  m as (select * from pact_matches where pact_id = p_pact)
  select json_build_object(
    'entries', (select count(*) from e),
    'with_account', (select count(*) from e where user_id is not null),
    'today', (select count(*) from e where created_at > now() - interval '24 hours'),
    'answers', (select coalesce(json_agg(json_build_object('q', q, 'a', a, 'n', n)), '[]'::json) from (select q, a, count(*) n from picks group by q, a) t),
    'answered', (select coalesce(json_object_agg(q, n), '{}'::json) from (select j.key q, count(*) n from e cross join lateral jsonb_each(e.answers) j group by j.key) t),
    'intents', (select coalesce(json_object_agg(k, n), '{}'::json) from (select x k, count(*) n from e cross join lateral jsonb_array_elements_text(coalesce(e.about -> 'intents', '[]'::jsonb)) x group by x) t),
    'gender', (select coalesce(json_object_agg(k, n), '{}'::json) from (select e.about ->> 'gender' k, count(*) n from e where e.about ? 'gender' group by 1) t),
    'areas', (select coalesce(json_object_agg(k, n), '{}'::json) from (select e.about ->> 'area' k, count(*) n from e where e.about ? 'area' group by 1) t),
    'work', (select coalesce(json_object_agg(k, n), '{}'::json) from (select e.about ->> 'work' k, count(*) n from e where e.about ? 'work' group by 1) t),
    'ages', (select coalesce(json_object_agg(k, n), '{}'::json) from (
      select case when a < 22 then '18-21' when a < 26 then '22-25' when a < 31 then '26-30' when a < 36 then '31-35' when a < 46 then '36-45' else '46+' end k, count(*) n
      from (select (e.about ->> 'age')::int a from e where e.about ? 'age') x group by 1) t),
    'matches', json_build_object(
      'total', (select count(*) from m),
      'rematches', (select count(*) from m where rematch),
      'avg_score', (select round(avg(score)) from m),
      'by_intent', (select coalesce(json_object_agg(intent, n), '{}'::json) from (select intent, count(*) n from m group by intent) t),
      'seen', (select count(*) from e where match_seen_at is not null),
      'chats', (select count(*) from m where session_id is not null),
      'both_joined', (select count(*) from m join pact_entries a on a.id = m.a join pact_entries b on b.id = m.b where a.user_id is not null and b.user_id is not null)
    )
  )
$$;
revoke execute on function public.pact_insights(uuid) from public, anon, authenticated;
