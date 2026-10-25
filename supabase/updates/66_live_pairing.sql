-- Dashpad update: live Masquerade pairing (Part 66)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 65 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 66: Masquerade pairs people while they're online, instead of at the top of
-- every hour. When you're switched on and in the app, you're paired with someone who
-- fits and is also online right now. Nobody is paired while they're away.
--  * One new pair per person per hour (pair_gap_minutes, 60 to start).
--  * Each chat lasts pair_minutes (60 to start) from the moment you're paired.
--  * Same rules as before: same mood, gender and ages fit both ways, closest first,
--    never someone blocked, already connected, or paired before (quiet pairs can
--    meet again after 7 days). Pairing hours stay 6am to 2am.
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value) values ('pair_gap_minutes', 60) on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('pair_minutes', 60) on conflict (key) do nothing;

-- Finding who's online and switched on, quickly
create index if not exists profiles_masq_online on public.profiles (last_seen_at desc) where open_to_masquerade;
create index if not exists masquerade_sessions_live_a on public.masquerade_sessions (user_a, started_at desc) where hour_at is not null;
create index if not exists masquerade_sessions_live_b on public.masquerade_sessions (user_b, started_at desc) where hour_at is not null;

-- Is this person free for a new pair right now? (switched on, online, set up, no live pair, past the gap)
create or replace function public.live_pair_free(p uuid, gap int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from profiles x left join accounts_private a on a.user_id = x.id
      where x.id = p and x.open_to_masquerade
        and x.last_seen_at > now() - interval '150 seconds'
        and x.display_name is not null and x.birthdate is not null and x.gender is not null
        and cardinality(x.photos) > 0 and a.banned_at is null)
    and not exists (
      select 1 from masquerade_sessions s
      where s.hour_at is not null and (s.user_a = p or s.user_b = p)
        and ((s.status = 'active' and s.reopened_at is null and s.ends_at > now())
             or s.started_at > now() - make_interval(mins => gap)))
$$;
revoke execute on function public.live_pair_free(uuid, int) from public, anon, authenticated;

-- Pair this person with someone online now, if anyone fits. Returns the new chat, or null.
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
  if uid is null or not public.pairing_hour_open(now()) then return null; end if;
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
  q := public.pick_icebreaker(sid, lvl, null);
  if q is not null then insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q); end if;
  insert into masquerade_hours (hour_at, pairs) values (h, 1)
  on conflict (hour_at) do update set pairs = masquerade_hours.pairs + 1;
  return sid;
end $$;
revoke execute on function public.try_live_pair(uuid) from public, anon, authenticated;

-- The app checks in every minute while it's open: that's also when you get paired
create or replace function public.heartbeat() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  update profiles set last_seen_at = now() where id = uid;
  begin
    if exists (select 1 from profiles where id = uid and open_to_masquerade) then
      perform public.try_live_pair(uid);
    end if;
  exception when others then
    raise warning 'live pairing failed: %', sqlerrm;
  end;
end $$;

-- The job every 5 minutes: close chats that have ended, and pair anyone online who's still
-- waiting (a backup to the check-ins). Nobody offline is paired.
create or replace function public.run_hourly_pairing_batch(p_budget int default 3000) returns json
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
  gap int := public.setting_int('pair_gap_minutes', 60);
begin
  for r in select id from masquerade_sessions
           where hour_at is not null and status = 'active' and reopened_at is null and ends_at <= now()
           limit 2000 loop
    perform public.finalize_masquerade(r.id);
  end loop;
  if not public.pairing_hour_open(now()) then return json_build_object('made', 0, 'left', 0); end if;
  for r in select p.id from profiles p
           where p.open_to_masquerade and p.last_seen_at > now() - interval '150 seconds'
           order by p.last_seen_at desc
           limit least(greatest(1, p_budget), 500) loop
    continue when not public.live_pair_free(r.id, gap);
    if public.try_live_pair(r.id) is not null then n := n + 1; end if;
  end loop;
  return json_build_object('made', n, 'left', 0);
end $$;
revoke execute on function public.run_hourly_pairing_batch(int) from public, anon, authenticated;

create or replace function public.run_hourly_pairing() returns int
language plpgsql security definer set search_path = public as $$
begin
  return coalesce((public.run_hourly_pairing_batch(500)->>'made')::int, 0);
end $$;
revoke execute on function public.run_hourly_pairing() from public, anon, authenticated;

-- New pairs to tell (pairs now start any time, not only on the hour)
create or replace function public.hourly_pairs_to_notify(p_limit int default 100000) returns json
language sql security definer set search_path = public as $$
  with t as (
    update masquerade_sessions set notified_at = now()
    where id in (
      select id from masquerade_sessions
      where hour_at is not null and status = 'active' and notified_at is null
        and started_at > now() - interval '30 minutes'
      order by started_at
      limit greatest(1, p_limit)
    )
    returning id, user_a, user_b, alias_a, alias_b, ends_at, intent
  )
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from t
$$;
revoke execute on function public.hourly_pairs_to_notify(int) from public, anon, authenticated;

-- Your Masquerade card on Home
create or replace function public.my_masquerade_hour() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  h timestamptz := date_trunc('hour', now());
  me profiles;
  cur masquerade_sessions;
  i_a boolean;
  op profiles;
  gap int := public.setting_int('pair_gap_minutes', 60);
  last_start timestamptz;
  free_at timestamptz;
begin
  if uid is null then return null; end if;
  select * into me from profiles where id = uid;
  -- Opening Home while you're online and switched on can pair you straight away
  begin
    perform public.try_live_pair(uid);
  exception when others then null;
  end;
  -- Your latest pair: still going, or from within the last gap (so "You clicked!" stays a while)
  select * into cur from masquerade_sessions
  where hour_at is not null and reopened_at is null and (user_a = uid or user_b = uid)
    and ((status = 'active' and ends_at > now()) or started_at > now() - make_interval(mins => gap))
  order by started_at desc limit 1;
  last_start := (select max(started_at) from masquerade_sessions
                 where hour_at is not null and (user_a = uid or user_b = uid));
  -- When you can next be paired: after the gap since your last pair, and only in pairing hours
  free_at := greatest(now(), coalesce(last_start + make_interval(mins => gap), now()));
  if not public.pairing_hour_open(free_at) then free_at := public.next_pairing_at(free_at); end if;
  i_a := cur.user_a = uid;
  if cur.id is not null then
    select * into op from profiles where id = case when i_a then cur.user_b else cur.user_a end;
  end if;

  return json_build_object(
    'enabled', me.open_to_masquerade,
    'has_place', me.place_country is not null,
    'server_now', now(),
    'hour_at', h,
    'hour_open', public.pairing_hour_open(h),
    'hour_ran', exists (select 1 from masquerade_hours where hour_at = h),
    'pairs_this_hour', coalesce((select pairs from masquerade_hours where hour_at = h), 0),
    -- Live pairing: no countdown. You're "looking" while you're free to be paired; otherwise next_at is when you can be.
    'next_at', free_at,
    'looking', me.open_to_masquerade and free_at <= now() and (cur.id is null or cur.status <> 'active'),
    'live', true,
    'pulse', (select json_build_object(
        'all', count(*),
        'country', count(*) filter (where me.place_country is not null and p.place_country = me.place_country),
        'region', count(*) filter (where me.place_region is not null and p.place_country = me.place_country and p.place_region = me.place_region),
        'region_name', me.place_region)
      from profiles p left join accounts_private a on a.user_id = p.id
      -- Switched on and online right now
      where p.open_to_masquerade and p.id <> uid and p.last_seen_at > now() - interval '150 seconds' and a.banned_at is null),
    'invite_reward', public.setting_int('invite_reward', 10),
    'current', case when cur.id is null then null else json_build_object(
      'id', cur.id, 'status', cur.status, 'intent', cur.intent, 'ends_at', cur.ends_at, 'match_id', cur.match_id,
      'my_alias', case when i_a then cur.alias_a else cur.alias_b end,
      'their_alias', case when i_a then cur.alias_b else cur.alias_a end,
      'their_age', public.age_years(op.birthdate), 'their_gender', op.gender, 'their_place', op.place_label,
      'their_connections', (select count(*) from matches x where op.id in (x.user_a, x.user_b)),
      'their_reply_seconds', public.reply_seconds(op.id),
      'their_tier', case
        when me.place_country is null or op.place_country is null then null
        when op.place_country = me.place_country and op.place_region = me.place_region then 'state'
        when op.place_country = me.place_country then 'country'
        when op.place_continent = me.place_continent then 'continent'
        else 'world' end,
      'their_name', case when cur.status = 'matched' then op.display_name end,
      'their_photo', case when cur.status = 'matched' then op.photos[1] end,
      'my_vote', case when i_a then cur.unmask_a else cur.unmask_b end,
      'they_voted', (case when i_a then cur.unmask_b else cur.unmask_a end) is not null,
      'messages', (select count(*) from masquerade_messages m where m.session_id = cur.id and m.kind in ('text', 'gift')),
      'last_message', (select body from masquerade_messages m where m.session_id = cur.id and m.kind = 'text' order by m.id desc limit 1),
      'last_from_them', (select m.sender_id <> uid from masquerade_messages m where m.session_id = cur.id and m.kind = 'text' order by m.id desc limit 1)
    ) end,
    'past', coalesce((
      select json_agg(row_to_json(t) order by t.sort_at desc) from (
        select s.id, s.status, s.intent, s.hour_at, s.reopened_at, coalesce(s.reopened_at, s.started_at) as sort_at,
          case when s.user_a = uid then s.alias_b else s.alias_a end as their_alias,
          public.age_years(p.birthdate) as their_age, p.gender as their_gender,
          case when s.user_a = uid then s.unmask_a else s.unmask_b end as my_vote,
          (select body from masquerade_messages m where m.session_id = s.id and m.kind = 'text' order by m.id desc limit 1) as last_message
        from masquerade_sessions s
        join profiles p on p.id = case when s.user_a = uid then s.user_b else s.user_a end
        where (s.user_a = uid or s.user_b = uid) and s.hour_at is not null
          and (s.status = 'lapsed' or (s.status = 'active' and s.reopened_at is not null))
          and not public.is_blocked(s.user_a, s.user_b)
        order by coalesce(s.reopened_at, s.started_at) desc
        limit 30
      ) t), '[]'::json)
  );
end $$;
