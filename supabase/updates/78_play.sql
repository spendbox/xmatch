-- Dashpad update: Play a stranger (Part 78)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Tap Play: you wait in line with people who fit your Masquerade settings (mood, who you
-- want to meet and age, both ways). When someone's there, Dashpad
-- opens a masked chat for you both and starts a game it picks at random
-- (Whot, Ayo, Ludo or Snakes & Ladders; games switched off in Admin are skipped).
-- Each player pays the match price when paired (Admin -> Prices, default 1 Key, 0 = free).

insert into app_settings (key, value) values ('play_cost', 1) on conflict (key) do nothing;

-- People waiting to play (and, for a moment after, the chat they were paired into)
create table if not exists public.play_queue (
  user_id uuid primary key references public.profiles on delete cascade,
  intent public.intent not null,
  joined_at timestamptz not null default now(),
  session_id uuid references public.masquerade_sessions on delete set null,
  game_kind text,
  matched_at timestamptz
);
alter table public.play_queue enable row level security;
drop policy if exists play_queue_own on public.play_queue;
create policy play_queue_own on public.play_queue for select using (user_id = auth.uid());
do $$ begin
  alter publication supabase_realtime add table public.play_queue;
exception when duplicate_object then null; end $$;

-- The games Play can pick from (all moods for now)
create or replace function public.play_games(p_intent public.intent) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(k), '{}') from unnest(array['whot', 'ayo', 'ludo', 'snakes']) k
  where public.setting_int('game_' || k, 1) <> 0
$$;

-- Two people fit each other: same mood, who each wants to meet, and each other's age range
-- (the same settings Masquerade pairs with)
create or replace function public.play_fits(me profiles, p profiles) returns boolean
language sql stable security definer set search_path = public as $$
  select p.pref_intent = me.pref_intent
    and public.gender_fits(me.pref_seeking, p.gender) and public.gender_fits(p.pref_seeking, me.gender)
    and public.age_years(p.birthdate) between me.pref_age_min and me.pref_age_max
    and public.age_years(me.birthdate) between p.pref_age_min and p.pref_age_max
    and not public.is_blocked(me.id, p.id)
$$;

-- Where you are: waiting, just paired, or not playing; plus what it costs and how busy it is
create or replace function public.play_status() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  q play_queue;
  me profiles;
begin
  if uid is null then return null; end if;
  select * into me from profiles where id = uid;
  select * into q from play_queue where user_id = uid;
  return json_build_object(
    'waiting', q.user_id is not null and q.session_id is null,
    'joined_at', q.joined_at,
    'session_id', q.session_id,
    'game', q.game_kind,
    'intent', me.pref_intent,
    'seeking', me.pref_seeking,
    'age_min', me.pref_age_min,
    'age_max', me.pref_age_max,
    'cost', public.setting_int('play_cost', 1),
    'balance', coalesce((select balance from wallets where user_id = uid), 0),
    'games', public.play_games(me.pref_intent),
    -- Others waiting right now who fit your settings (and you theirs)
    'in_line', (select count(*) from play_queue x join profiles p on p.id = x.user_id
                where x.session_id is null and x.user_id <> uid and public.play_fits(me, p)
                  and p.last_seen_at > now() - interval '150 seconds'),
    'playing', (select count(*) from games g join masquerade_sessions s on s.id = g.session_id
                where s.source = 'play' and g.status = 'active'),
    'server_now', now()
  );
end $$;

-- Tap Play: pair with someone waiting in your mood, or wait in line
create or replace function public.play_join() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  them profiles;
  cost int := greatest(0, public.setting_int('play_cost', 1));
  pool text[];
  pick text;
  a1 text;
  sid uuid;
  gid uuid;
  lvl smallint;
  tries int := 0;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  select * into me from profiles where id = uid;
  pool := public.play_games(me.pref_intent);
  if coalesce(array_length(pool, 1), 0) = 0 then raise exception 'Games are taking a break. Try again later.'; end if;
  if cost > 0 and coalesce((select balance from wallets where user_id = uid), 0) < cost then raise exception 'NOT_ENOUGH_KEYS'; end if;

  -- One pairing at a time, so two people can't grab the same partner
  perform pg_advisory_xact_lock(hashtext('play_queue'));

  loop
    tries := tries + 1;
    exit when tries > 5;
    select p.* into them from play_queue x join profiles p on p.id = x.user_id
    where x.session_id is null and x.user_id <> uid
      and x.joined_at > now() - interval '15 minutes'
      and p.last_seen_at > now() - interval '150 seconds'
      and public.play_fits(me, p)
    order by x.joined_at
    limit 1;
    exit when not found;
    -- They can't pay any more: take them out of the line and look again
    if cost > 0 and coalesce((select balance from wallets where user_id = them.id), 0) < cost then
      delete from play_queue where user_id = them.id;
      continue;
    end if;

    pick := pool[1 + floor(random() * array_length(pool, 1))::int];
    a1 := public.random_alias();
    lvl := round((coalesce(me.pref_spice, 1) + coalesce(them.pref_spice, 1)) / 2.0)::smallint;
    -- The one who waited is player a: they go first
    insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, source)
    values (them.id, uid, me.pref_intent, coalesce(them.pref_spice, 1), coalesce(me.pref_spice, 1), lvl, a1, public.random_alias(a1), now(), 'infinity', 'play')
    returning id into sid;
    if cost > 0 then
      perform public.spend_keys(them.id, cost, 'play', sid::text);
      perform public.spend_keys(uid, cost, 'play', sid::text);
    end if;
    insert into masquerade_messages (session_id, kind, body)
    values (sid, 'system', 'Dashpad paired you to play ' || public.game_title(pick) || '. You''re both masked until you both unmask.');
    insert into games (kind, session_id, player_a, player_b, deadline_at)
    values (pick, sid, them.id, uid, now() + interval '30 seconds')
    returning id into gid;
    perform public.game_begin(gid);
    -- A few extra seconds so you both see the game picked before the countdown
    update games set started_at = now() + interval '7 seconds', deadline_at = now() + interval '7 seconds' + public.game_idle() where id = gid;

    update play_queue set session_id = sid, game_kind = pick, matched_at = now() where user_id = them.id;
    insert into play_queue (user_id, intent, joined_at, session_id, game_kind, matched_at)
    values (uid, me.pref_intent, now(), sid, pick, now())
    on conflict (user_id) do update set intent = excluded.intent, session_id = sid, game_kind = pick, matched_at = now();
    return json_build_object('session_id', sid, 'game', pick);
  end loop;

  -- Nobody yet: wait in line (keeping your place if you were already in it)
  insert into play_queue (user_id, intent, joined_at)
  values (uid, me.pref_intent, now())
  on conflict (user_id) do update set intent = excluded.intent,
    joined_at = case when play_queue.session_id is null then play_queue.joined_at else now() end,
    session_id = null, game_kind = null, matched_at = null;
  return json_build_object('session_id', null, 'game', null);
end $$;

-- Stop waiting (or clear your last pairing once you've opened the chat)
create or replace function public.play_leave() returns void
language sql security definer set search_path = public as $$
  delete from play_queue where user_id = auth.uid();
$$;

revoke all on function public.play_games(public.intent) from public, anon;
revoke all on function public.play_fits(profiles, profiles) from public, anon, authenticated;
revoke all on function public.play_status() from public, anon;
revoke all on function public.play_join() from public, anon;
revoke all on function public.play_leave() from public, anon;
grant execute on function public.play_status() to authenticated;
grant execute on function public.play_join() to authenticated;
grant execute on function public.play_leave() to authenticated;

-- Play chats work like chats from Meet: open until you both decide, and listed in Chats
create or replace function public.get_masquerade(p_session uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
  other uuid;
  op profiles;
  mp profiles;
  i_am_a boolean;
  m meet_posts;
  pair boolean;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then return null; end if;
  -- Hourly pairs, meet chats and chats started from Meet: unmask any time
  pair := s.hour_at is not null or s.meet_id is not null or s.source in ('explore', 'play');
  if s.status = 'active' and (
       (pair and now() >= s.ends_at)
       or (not pair and now() > s.ends_at + interval '90 seconds')) then
    perform public.finalize_masquerade(p_session);
    select * into s from masquerade_sessions where id = p_session;
  end if;
  if s.meet_id is not null then
    select * into m from meet_posts where id = s.meet_id;
    if m.kind = 'game' and s.status = 'active' then perform public.meet_queue_next(m.id); end if;
  end if;

  i_am_a := s.user_a = uid;
  -- Opening the chat reads it (kept apart from the session, so it doesn't wake anyone's screen)
  insert into masked_reads (session_id, user_id, read_at) values (s.id, uid, now())
  on conflict (session_id, user_id) do update set read_at = now();
  other := case when i_am_a then s.user_b else s.user_a end;
  select * into op from profiles where id = other;
  select * into mp from profiles where id = uid;

  return json_build_object(
    'id', s.id,
    'status', s.status,
    'ended_reason', s.ended_reason,
    'intent', s.intent,
    'spice_level', s.spice_level,
    'started_at', s.started_at,
    'ends_at', s.ends_at,
    'server_now', now(),
    'match_id', s.match_id,
    'hourly', pair,
    -- Open until you both decide: reopened past pairs and chats started from Meet
    'reopened', s.reopened_at is not null or s.source in ('explore', 'play'),
    'play', s.source = 'play',
    'explore', s.source = 'explore',
    'meet', case when m.id is null then null else json_build_object(
      'id', m.id, 'kind', m.kind, 'game', m.game, 'mine', i_am_a,
      'turn_pending', public.meet_turn_pending(s.id),
      -- People ahead of you in line (people waiting, if it's yours)
      'ahead', case when m.kind = 'game' then (
        select count(*) from masquerade_sessions x
        where x.meet_id = m.id and x.status = 'active' and now() < x.ends_at
          and not exists (select 1 from games g where g.session_id = x.id and g.started_at is not null)
          and (i_am_a or x.started_at < s.started_at)) end,
      -- Where your game in this meet is happening right now (if it's in another chat)
      'live_chat', case when i_am_a and m.kind = 'game' then (
        select json_build_object('id', x.id, 'alias', x.alias_b, 'status', g.status)
        from games g join masquerade_sessions x on x.id = g.session_id
        where x.meet_id = m.id and x.id <> s.id and g.status in ('invited', 'active')
        limit 1) end) end,
    'me', json_build_object(
      'id', uid,
      'alias', case when i_am_a then s.alias_a else s.alias_b end,
      'spice', case when i_am_a then s.spice_a else s.spice_b end,
      'vote', case when i_am_a then s.unmask_a else s.unmask_b end
    ),
    'them', json_build_object(
      'alias', case when i_am_a then s.alias_b else s.alias_a end,
      'spice', case when i_am_a then s.spice_b else s.spice_a end,
      -- Ages aren't shown in chats
      'age', null,
      'gender', op.gender,
      'interests', op.interests,
      'shared_interests', array(select unnest(op.interests) intersect select unnest(mp.interests)),
      -- Words you both used in "things about me": only once you've both unmasked
      'shared_words', case when s.status = 'matched' then (array(select unnest(op.thing_keys) intersect select unnest(mp.thing_keys)))[1:5] end,
      'distance_km', null,
      'place', op.place_label,
      'same_place', op.place_country = mp.place_country and op.place_region = mp.place_region,
      'connections', (select count(*) from matches x where op.id in (x.user_a, x.user_b)),
      'reply_seconds', public.reply_seconds(op.id),
      'has_voted', (case when i_am_a then s.unmask_b else s.unmask_a end) is not null,
      -- Whether they're in the app right now, and roughly how long since they were
      'online', coalesce(op.last_seen_at > now() - interval '2 minutes', false),
      'seen_minutes', case when op.last_seen_at is not null then floor(extract(epoch from now() - op.last_seen_at) / 60)::int end,
      -- Only revealed after you both unmask
      'profile', case when s.status = 'matched' then json_build_object(
        'id', op.id, 'display_name', op.display_name, 'bio', op.bio, 'photos', op.photos
      ) else null end
    )
  );
end $$;

create or replace function public.my_masked_chats() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.last_at desc), '[]'::json) from (
    select s.id,
      case when s.user_a = auth.uid() then s.alias_b else s.alias_a end as alias,
      case when s.user_a = auth.uid() then s.alias_a else s.alias_b end as my_alias,
      (s.source = 'explore' and s.pact_id is null) as from_meet,
      (s.source = 'play') as from_play,
      -- A live Masquerade pair (it has a time limit)
      (s.hour_at is not null and s.reopened_at is null and s.source is null) as live_pair,
      case when s.hour_at is not null and s.reopened_at is null then s.ends_at end as ends_at,
      pa.name as pact,
      pa.slug as pact_slug,
      exists (select 1 from pact_entries e where e.pact_id = s.pact_id and e.user_id = auth.uid() and e.match_seen_at is not null) as pact_seen,
      case when s.user_a = auth.uid() then s.unmask_a else s.unmask_b end as my_vote,
      (case when s.user_a = auth.uid() then s.unmask_b else s.unmask_a end) is true as they_unmasked,
      l.body as last_message, l.sender_id = auth.uid() as last_mine,
      coalesce(l.created_at, s.started_at) as last_at,
      exists (select 1 from masquerade_messages m where m.session_id = s.id and m.sender_id is not null and m.sender_id <> auth.uid()
        and m.created_at > coalesce((select r.read_at from masked_reads r where r.session_id = s.id and r.user_id = auth.uid()), '-infinity'::timestamptz)) as unread
    from masquerade_sessions s
    left join pacts pa on pa.id = s.pact_id
    left join lateral (
      select m.body, m.sender_id, m.created_at from masquerade_messages m
      where m.session_id = s.id and m.kind in ('text', 'gift', 'audio') order by m.id desc limit 1) l on true
    where auth.uid() in (s.user_a, s.user_b) and s.status = 'active'
      -- Chats from Meet, reopened pairs, and now your live Masquerade pair too
      and (s.source in ('explore', 'play') or s.reopened_at is not null or (s.hour_at is not null and s.ends_at > now()))
  ) t
$$;

create or replace function public.unread_masked_chats() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from masquerade_sessions s
  where auth.uid() in (s.user_a, s.user_b) and s.status = 'active'
    and (s.source in ('explore', 'play') or s.reopened_at is not null or (s.hour_at is not null and s.ends_at > now()))
    and exists (select 1 from masquerade_messages m where m.session_id = s.id and m.sender_id is not null and m.sender_id <> auth.uid()
      and m.created_at > coalesce((select r.read_at from masked_reads r where r.session_id = s.id and r.user_id = auth.uid()), '-infinity'::timestamptz))
$$;
