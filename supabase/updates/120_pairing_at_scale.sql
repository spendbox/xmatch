-- Dashpad update: pairing keeps up when lots of people are online (Part 120)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 73 first.
-- Safe to run more than once.
--
-- 1. Checking "has either of these two reported or blocked the other?" now uses an index.
--    Before, it read the whole reports table, once for every person considered for a pair,
--    so pairing got slower as the app grew.
-- 2. Pairing no longer waits behind one lock for the whole app. Before, only one pair could
--    be made at a time anywhere: with thousands online, most check-ins skipped pairing and
--    people waited. Now only the two people being paired are locked, so many pairs are made
--    at once. Who gets paired with whom is worked out exactly as before (closest first, then
--    most in common, then quick repliers); if the best person is being paired by someone
--    else at that moment, the next best is taken instead of giving up.

-- ---------------------------------------------------------------------------
-- 1. Blocks and reports, looked up both ways
-- ---------------------------------------------------------------------------
create index if not exists reports_pair on public.reports (reporter_id, reported_id);
create index if not exists reports_pair_back on public.reports (reported_id, reporter_id);

-- ---------------------------------------------------------------------------
-- 2. Pair someone: locks only the people involved
-- ---------------------------------------------------------------------------
create or replace function public.try_live_pair(uid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  gap int := public.setting_int('pair_gap_minutes', 60);
  len int := public.setting_int('pair_minutes', 60);
  me profiles;
  my_age int;
  pid uuid;
  cand uuid;
  sid uuid;
  a1 text;
  q text;
  lvl smallint;
  h timestamptz := date_trunc('hour', now());
begin
  if uid is null then return null; end if;
  -- Your pair left before either of you said anything: let them go, so you can be paired again
  perform public.release_abandoned_pairs(uid);
  if not public.pairing_hour_open(now()) then return null; end if;
  if not public.live_pair_free(uid, gap) then return null; end if;
  -- You're being paired right now (another check-in of yours, or someone pairing you): try again next check-in
  if not pg_try_advisory_xact_lock(515152, hashtext(uid::text)) then return null; end if;
  if not public.live_pair_free(uid, gap) then return null; end if;
  select * into me from profiles where id = uid;
  my_age := public.age_years(me.birthdate);

  for cand in
    select c.id
    from profiles c left join accounts_private a on a.user_id = c.id
    where c.open_to_masquerade and c.id <> uid
      and c.last_seen_at > now() - interval '150 seconds'
      and c.display_name is not null and c.birthdate is not null and c.gender is not null
      and cardinality(c.photos) > 0 and a.banned_at is null
      and c.pref_intent = me.pref_intent
      and public.gender_fits(me.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, me.gender)
      and public.age_years(c.birthdate) between me.pref_age_min and me.pref_age_max
      and my_age between c.pref_age_min and c.pref_age_max
      and not public.is_blocked(uid, c.id)
      and not public.already_matched(uid, c.id)
      and not exists (select 1 from masquerade_sessions s
                      where s.hour_at is not null
                        and ((s.user_a = uid and s.user_b = c.id) or (s.user_a = c.id and s.user_b = uid))
                        and coalesce(s.ended_reason, '') <> 'away'
                        and not (s.status = 'ended' and s.ended_reason = 'quiet' and s.hour_at < now() - interval '7 days'))
      and public.live_pair_free(c.id, gap)
    -- Closest first, then most in common, then quick repliers
    order by
      case when c.place_country = me.place_country and c.place_region = me.place_region then 1
           when c.place_country = me.place_country then 2
           when c.place_continent = me.place_continent then 3 else 4 end,
      public.shared_count(me.interests, c.interests) + 2 * least(public.shared_count(me.thing_keys, c.thing_keys), 5) desc,
      coalesce(public.reply_seconds(c.id), 1800),
      random()
    limit 20
  loop
    -- Someone else is pairing them this very moment: the next best
    continue when not pg_try_advisory_xact_lock(515152, hashtext(cand::text));
    -- They may have been paired a moment ago
    continue when not public.live_pair_free(cand, gap);
    pid := cand;
    exit;
  end loop;
  if pid is null then return null; end if;

  a1 := public.random_alias();
  lvl := round((coalesce(me.pref_spice, 1) + coalesce((select pref_spice from profiles where id = pid), 1)) / 2.0)::smallint;
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, hour_at)
  values (uid, pid, me.pref_intent, coalesce(me.pref_spice, 1), coalesce((select pref_spice from profiles where id = pid), 1), lvl,
          a1, public.random_alias(a1), now(), now() + make_interval(mins => len), h)
  returning id into sid;
  -- No automatic icebreaker: chats start empty (icebreakers are still in the + menu)
  insert into masquerade_hours (hour_at, pairs) values (h, 1)
  on conflict (hour_at) do update set pairs = masquerade_hours.pairs + 1;
  return sid;
end $$;
