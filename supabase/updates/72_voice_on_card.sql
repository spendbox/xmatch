-- Dashpad update: voice notes show on the Masquerade card (Part 72)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 71 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 72: The Masquerade card on Home counts masked voice notes as messages and shows
-- "Sent you a voice note" when the latest one is from your pair.
-- ---------------------------------------------------------------------------
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
    and coalesce(ended_reason, '') <> 'away'
    and ((status = 'active' and ends_at > now()) or started_at > now() - make_interval(mins => gap))
  order by started_at desc limit 1;
  last_start := (select max(started_at) from masquerade_sessions
                 where hour_at is not null and (user_a = uid or user_b = uid) and coalesce(ended_reason, '') <> 'away');
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
      'messages', (select count(*) from masquerade_messages m where m.session_id = cur.id and m.kind in ('text', 'gift', 'audio')),
      -- The latest message, voice notes included
      'last_message', (select body from masquerade_messages m where m.session_id = cur.id and m.kind in ('text', 'audio') order by m.id desc limit 1),
      'last_kind', (select kind from masquerade_messages m where m.session_id = cur.id and m.kind in ('text', 'audio') order by m.id desc limit 1),
      'last_from_them', (select m.sender_id <> uid from masquerade_messages m where m.session_id = cur.id and m.kind in ('text', 'audio') order by m.id desc limit 1)
    ) end,
    'past', coalesce((
      select json_agg(row_to_json(t) order by t.sort_at desc) from (
        select s.id, s.status, s.intent, s.hour_at, s.reopened_at, coalesce(s.reopened_at, s.started_at) as sort_at,
          case when s.user_a = uid then s.alias_b else s.alias_a end as their_alias,
          public.age_years(p.birthdate) as their_age, p.gender as their_gender,
          case when s.user_a = uid then s.unmask_a else s.unmask_b end as my_vote,
          (select body from masquerade_messages m where m.session_id = s.id and m.kind in ('text', 'audio') order by m.id desc limit 1) as last_message
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
