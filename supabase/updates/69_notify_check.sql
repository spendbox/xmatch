-- Dashpad update: fewer false alarms on the admin Masquerade page (Part 69)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 68 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 69: With live pairing, many pairs end before the 5-minute notification job runs
-- (someone stepped away, let go, or you both unmasked straight away). The admin warning
-- "pairs weren't sent a notification" now only counts pairs that really should have been.
-- ---------------------------------------------------------------------------
create or replace function public.admin_masquerade_stats() returns json
language sql stable security definer set search_path = public as $$
  with hrs as (
    select g as hour_at from generate_series(date_trunc('hour', now()) - interval '47 hours', date_trunc('hour', now()), interval '1 hour') g
  ), per as (
    select hour_at,
      count(*) as pairs,
      count(*) filter (where status = 'matched') as clicked,
      count(*) filter (where status = 'lapsed') as undecided,
      count(*) filter (where reopened_at is not null) as reopened,
      count(*) filter (where status = 'ended' and ended_reason = 'quiet') as quiet,
      count(*) filter (where status = 'ended' and coalesce(ended_reason, '') <> 'quiet') as let_go,
      count(*) filter (where status = 'active') as live,
      -- Pairs that should have had a "new pair" notification and didn't: ones that lasted past
      -- 10 minutes without being told. Not pairs cancelled because someone left, let go, or
      -- that clicked quickly (both were in the app), which the 5-minute job never reaches.
      count(*) filter (where notified_at is null and started_at < now() - interval '10 minutes'
                         and (status in ('active', 'lapsed') or (status = 'ended' and ended_reason = 'quiet'))) as not_notified
    from masquerade_sessions where hour_at > now() - interval '48 hours' group by hour_at
  )
  select json_build_object(
    'now', now(),
    'hours', coalesce((select json_agg(json_build_object(
        'hour_at', h.hour_at, 'open', public.pairing_hour_open(h.hour_at),
        'ran_at', mh.ran_at, 'eligible', mh.eligible, 'note', mh.note,
        'pairs', coalesce(p.pairs, 0), 'clicked', coalesce(p.clicked, 0), 'undecided', coalesce(p.undecided, 0),
        'reopened', coalesce(p.reopened, 0), 'quiet', coalesce(p.quiet, 0), 'let_go', coalesce(p.let_go, 0),
        'live', coalesce(p.live, 0), 'not_notified', coalesce(p.not_notified, 0)
      ) order by h.hour_at desc)
      from hrs h left join masquerade_hours mh on mh.hour_at = h.hour_at left join per p on p.hour_at = h.hour_at), '[]'::json),
    'switched_on', (select count(*) from profiles where open_to_masquerade),
    'eligible_now', (select count(*) from profiles p left join accounts_private a on a.user_id = p.id
                     where p.open_to_masquerade and p.last_seen_at > now() - interval '24 hours' and a.banned_at is null),
    'no_place', (select count(*) from profiles where open_to_masquerade and place_country is null),
    'week', (select json_build_object(
        'pairs', count(*), 'clicked', count(*) filter (where status = 'matched'),
        'quiet', count(*) filter (where ended_reason = 'quiet'),
        'reopened', count(*) filter (where reopened_at is not null))
      from masquerade_sessions where hour_at > now() - interval '7 days'),
    'by_mood', coalesce((select json_object_agg(intent, n) from (
        select intent, count(*) n from masquerade_sessions where hour_at > now() - interval '7 days' group by intent) t), '{}'::json)
  )
$$;
revoke execute on function public.admin_masquerade_stats() from public, anon, authenticated;
