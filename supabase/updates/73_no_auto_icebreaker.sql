-- Dashpad update: masked chats start without an automatic icebreaker (Part 73)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 72 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 73: New masked chats (live pairs, waves and paid messages from Meet) no longer get
-- an icebreaker question posted automatically. The "Ask them about…" ideas and the
-- icebreaker button in the + menu are still there.
-- ---------------------------------------------------------------------------
create or replace function public.try_live_pair(uid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  gap int := public.setting_int('pair_gap_minutes', 60);
  len int := public.setting_int('pair_minutes', 60);
  me profiles;
  my_age int;
  pid uuid;
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
  -- One pairing at a time, so two people can't both grab the same partner (busy: try again next check-in)
  if not pg_try_advisory_xact_lock(515152) then return null; end if;
  if not public.live_pair_free(uid, gap) then return null; end if;
  select * into me from profiles where id = uid;
  my_age := public.age_years(me.birthdate);

  select c.id into pid
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
  limit 1;
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
revoke execute on function public.try_live_pair(uuid) from public, anon, authenticated;

create or replace function public.wave_person(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mid uuid;
  sid uuid;
  me profiles;
  them profiles;
  a1 text;
  lvl smallint;
  q text;
  cost int := public.setting_int('wave_cost', 0);
begin
  if uid is null then raise exception 'Please log in'; end if;
  if p_id is null or p_id = uid then raise exception 'Not available'; end if;
  mid := public.explore_match_id(uid, p_id);
  if mid is not null then return json_build_object('kind', 'match', 'id', mid); end if;
  select id into sid from masquerade_sessions
  where source = 'explore' and status = 'active'
    and ((user_a = uid and user_b = p_id) or (user_a = p_id and user_b = uid))
  order by started_at desc limit 1;
  if sid is not null then return json_build_object('kind', 'masked', 'id', sid); end if;

  if not public.explore_visible(uid, p_id) then raise exception 'Not available'; end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  if exists (select 1 from waves where from_id = uid and to_id = p_id) then
    return json_build_object('kind', 'waved', 'again', true);
  end if;
  if (select count(*) from waves where from_id = uid and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'You''ve waved a lot today. Try again tomorrow';
  end if;

  -- Waving first can cost Keys (set in admin); waving back is always free
  if cost > 0 and not exists (select 1 from waves where from_id = p_id and to_id = uid) then
    perform public.spend_keys(uid, cost, 'wave', p_id::text);
  end if;
  insert into waves (from_id, to_id) values (uid, p_id) on conflict do nothing;
  -- Waving means you looked
  insert into profile_views (viewer, target, seen_at) values (uid, p_id, now())
  on conflict (viewer, target) do update set seen_at = now();

  if not exists (select 1 from waves where from_id = p_id and to_id = uid) then
    return json_build_object('kind', 'waved');
  end if;

  -- You both waved: open a masked chat, free
  select * into me from profiles where id = uid;
  select * into them from profiles where id = p_id;
  a1 := public.random_alias();
  lvl := round((coalesce(me.pref_spice, 1) + coalesce(them.pref_spice, 1)) / 2.0)::smallint;
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, source, waved)
  values (uid, p_id, me.pref_intent, coalesce(me.pref_spice, 1), coalesce(them.pref_spice, 1), lvl, a1, public.random_alias(a1), now(), 'infinity', 'explore', true)
  returning id into sid;
  insert into masquerade_messages (session_id, kind, body)
  values (sid, 'system', 'You both waved 👋 This chat is free. Photos stay hidden until you both unmask.');
  -- No automatic icebreaker: chats start empty (icebreakers are still in the + menu)
  update waves set session_id = sid where (from_id = uid and to_id = p_id) or (from_id = p_id and to_id = uid);
  return json_build_object('kind', 'masked', 'id', sid, 'mutual', true);
end $$;
revoke execute on function public.wave_person(uuid) from public, anon;

create or replace function public.message_person(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mid uuid;
  sid uuid;
  cost int := public.setting_int('explore_message_cost', 15);
  me profiles;
  them profiles;
  a1 text;
  lvl smallint;
  q text;
begin
  if uid is null then raise exception 'Please log in'; end if;
  mid := public.explore_match_id(uid, p_id);
  if mid is not null then return json_build_object('kind', 'match', 'id', mid); end if;
  select id into sid from masquerade_sessions
  where source = 'explore' and status = 'active'
    and ((user_a = uid and user_b = p_id) or (user_a = p_id and user_b = uid))
  order by started_at desc limit 1;
  if sid is not null then return json_build_object('kind', 'masked', 'id', sid); end if;

  if not public.explore_visible(uid, p_id) then raise exception 'Not available'; end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  if (select count(*) from masquerade_sessions where source = 'explore' and user_a = uid and started_at > now() - interval '1 minute') >= 5 then
    raise exception 'Slow down a little';
  end if;
  select * into me from profiles where id = uid;
  select * into them from profiles where id = p_id;
  if cost > 0 then perform public.spend_keys(uid, cost, 'explore_message', p_id::text); end if;

  a1 := public.random_alias();
  lvl := round((coalesce(me.pref_spice, 1) + coalesce(them.pref_spice, 1)) / 2.0)::smallint;
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, source, paid_keys)
  values (uid, p_id, me.pref_intent, coalesce(me.pref_spice, 1), coalesce(them.pref_spice, 1), lvl, a1, public.random_alias(a1), now(), 'infinity', 'explore', greatest(cost, 0))
  returning id into sid;
  insert into masquerade_messages (session_id, kind, body)
  values (sid, 'system', a1 || ' found you on Meet and started this chat. You''re both masked until you both unmask.');
  -- No automatic icebreaker: chats start empty (icebreakers are still in the + menu)
  return json_build_object('kind', 'masked', 'id', sid);
end $$;
revoke execute on function public.message_person(uuid) from public, anon;
grant execute on function public.wave_person(uuid) to authenticated;
grant execute on function public.message_person(uuid) to authenticated;
