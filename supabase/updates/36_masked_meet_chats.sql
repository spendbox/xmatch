-- Dashpad update: paid chats from Meet stay masked, masked chats in Chats (Part 36)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 35 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 36: Paying to message someone on Meet opens a masked chat
-- No more unmasking straight away: you're both masked, with no time limit, until
-- you both choose to unmask (then you're connected as usual). Reopened past pairs
-- work the same. Both now show in Chats, with unread dots.
-- ---------------------------------------------------------------------------
alter table public.masquerade_sessions add column if not exists source text;

-- When each person last opened a masked chat (for unread dots)
create table if not exists public.masked_reads (
  session_id uuid not null references public.masquerade_sessions on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  read_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
alter table public.masked_reads enable row level security;

-- Start (or carry on) a masked chat with someone from Meet. Returns where to go.
drop function if exists public.message_person(uuid);
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
  -- Already connected: just open your chat
  mid := public.explore_match_id(uid, p_id);
  if mid is not null then return json_build_object('kind', 'match', 'id', mid); end if;
  -- Already have a masked chat with them from Meet: open it (no charge)
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
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, source)
  values (uid, p_id, me.pref_intent, coalesce(me.pref_spice, 1), coalesce(them.pref_spice, 1), lvl, a1, public.random_alias(a1), now(), 'infinity', 'explore')
  returning id into sid;
  insert into masquerade_messages (session_id, kind, body)
  values (sid, 'system', a1 || ' found you on Meet and started this chat. You''re both masked until you both unmask.');
  q := public.pick_icebreaker(sid, lvl, null);
  if q is not null then insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q); end if;
  return json_build_object('kind', 'masked', 'id', sid);
end $$;

-- Your open masked chats with no time limit (from Meet, or reopened), for the Chats page
create or replace function public.my_masked_chats() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.last_at desc), '[]'::json) from (
    select s.id,
      case when s.user_a = auth.uid() then s.alias_b else s.alias_a end as alias,
      case when s.user_a = auth.uid() then s.alias_a else s.alias_b end as my_alias,
      (s.source = 'explore') as from_meet,
      case when s.user_a = auth.uid() then s.unmask_a else s.unmask_b end as my_vote,
      (case when s.user_a = auth.uid() then s.unmask_b else s.unmask_a end) is true as they_unmasked,
      l.body as last_message, l.sender_id = auth.uid() as last_mine,
      coalesce(l.created_at, s.started_at) as last_at,
      exists (select 1 from masquerade_messages m where m.session_id = s.id and m.sender_id is not null and m.sender_id <> auth.uid()
        and m.created_at > coalesce((select r.read_at from masked_reads r where r.session_id = s.id and r.user_id = auth.uid()), '-infinity'::timestamptz)) as unread
    from masquerade_sessions s
    left join lateral (
      select m.body, m.sender_id, m.created_at from masquerade_messages m
      where m.session_id = s.id and m.kind in ('text', 'gift') order by m.id desc limit 1) l on true
    where auth.uid() in (s.user_a, s.user_b) and s.status = 'active'
      and (s.source = 'explore' or s.reopened_at is not null)
  ) t
$$;

-- Unread masked chats, for the dot on Chats in the menu
create or replace function public.unread_masked_chats() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from masquerade_sessions s
  where auth.uid() in (s.user_a, s.user_b) and s.status = 'active'
    and (s.source = 'explore' or s.reopened_at is not null)
    and exists (select 1 from masquerade_messages m where m.session_id = s.id and m.sender_id is not null and m.sender_id <> auth.uid()
      and m.created_at > coalesce((select r.read_at from masked_reads r where r.session_id = s.id and r.user_id = auth.uid()), '-infinity'::timestamptz))
$$;

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
  pair := s.hour_at is not null or s.meet_id is not null or s.source = 'explore';
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
    'reopened', s.reopened_at is not null or s.source = 'explore',
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
      -- Words you both used in "things about me"
      'shared_words', (array(select unnest(op.thing_keys) intersect select unnest(mp.thing_keys)))[1:5],
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

create or replace function public.vote_unmask(p_session uuid, p_unmask boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then raise exception 'Chat not found'; end if;
  if s.status not in ('active', 'lapsed') then return; end if;
  if p_unmask and s.hour_at is null and s.meet_id is null and s.source is distinct from 'explore' and now() < s.ends_at - interval '2 seconds' then
    raise exception 'You can unmask when the timer ends';
  end if;
  -- Tell them in the chat the first time you unmask (they get a notification too)
  if p_unmask and (case when uid = s.user_a then s.unmask_a else s.unmask_b end) is distinct from true
     and (case when uid = s.user_a then s.unmask_b else s.unmask_a end) is distinct from true then
    insert into masquerade_messages (session_id, kind, body)
    values (s.id, 'system', (case when uid = s.user_a then s.alias_a else s.alias_b end) || ' unmasked. Unmask too to connect');
  end if;
  if uid = s.user_a then
    update masquerade_sessions set unmask_a = p_unmask,
      ended_reason = case when not p_unmask and now() < s.ends_at then 'left' else ended_reason end
    where id = p_session;
  else
    update masquerade_sessions set unmask_b = p_unmask,
      ended_reason = case when not p_unmask and now() < s.ends_at then 'left' else ended_reason end
    where id = p_session;
  end if;
  perform public.finalize_masquerade(p_session);
end $$;

create or replace function public.explore_profile(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  mid uuid;
  open boolean;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if not public.explore_visible(uid, p_id) then return null; end if;
  select * into p from profiles where id = p_id;
  mid := public.explore_match_id(uid, p_id);
  open := mid is not null or exists (select 1 from photo_unlocks where viewer = uid and target = p_id);
  return json_build_object(
    'id', p.id, 'name', p.display_name, 'age', case when mid is not null then public.age_years(p.birthdate) end, 'gender', p.gender,
    'bio', p.bio, 'interests', p.interests, 'place', p.place_label,
    -- What they're in the mood for only shows in your chat
    'intent', null,
    'online', p.last_seen_at > now() - interval '5 minutes',
    'photos', case when open then to_json(p.photos) else to_json(array[p.photos[1]]) end,
    'photo_count', cardinality(p.photos),
    'photos_unlocked', open,
    'match_id', mid,
    -- A masked chat you already have with them from Meet
    'masked_id', (select x.id from masquerade_sessions x where x.source = 'explore' and x.status = 'active'
      and ((x.user_a = uid and x.user_b = p_id) or (x.user_a = p_id and x.user_b = uid)) order by x.started_at desc limit 1),
    'shared_interests', array(select unnest(p.interests) intersect select unnest((select interests from profiles where id = uid))),
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    -- Their "things about me", and the words you both used
    'things', p.things,
    'shared_words', (array(select unnest(p.thing_keys) intersect select unnest((select thing_keys from profiles where id = uid))))[1:5]
  );
end $$;

-- Connect 4: the finished board stays up for 10 seconds before the next game
create or replace function public.game_c4_move(p_game uuid, p_col int, p_auto boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  st jsonb;
  who text;
  board text;
  r int;
  line int[];
  wins_a int; wins_b int;
  rnd int;
  starter text;
  over boolean := false;
  result text;
begin
  select * into g from games where id = p_game;
  st := g.state;
  who := st->>'turn';
  select new_board, d.r into board, r from public.game_c4_drop(st->>'board', p_col, who) d;
  if r < 0 then raise exception 'That column is full'; end if;
  st := st || jsonb_build_object('board', board, 'last', r * 7 + p_col, 'moves', (st->>'moves')::int + 1,
    'auto_' || who, case when p_auto then (st->>('auto_' || who))::int + 1 else 0 end);
  line := public.game_c4_line(board, r, p_col);
  wins_a := (st->'wins'->>'a')::int; wins_b := (st->'wins'->>'b')::int;
  rnd := (st->>'round')::int;

  if array_length(line, 1) >= 4 or position('.' in board) = 0 then
    result := case when array_length(line, 1) >= 4 then who else 'draw' end;
    if result = 'a' then wins_a := wins_a + 1; elsif result = 'b' then wins_b := wins_b + 1; end if;
    over := wins_a >= 2 or wins_b >= 2 or rnd >= 3;
    starter := case when st->>'starter' = 'a' then 'b' else 'a' end;
    -- Keep the finished board on show for a moment, then start the next round
    st := st || jsonb_build_object(
      'prev', jsonb_build_object('board', board, 'line', to_jsonb(line), 'winner', result, 'round', rnd),
      'wins', jsonb_build_object('a', wins_a, 'b', wins_b),
      'pause_until', now() + interval '10 seconds');
    if not over then
      st := st || jsonb_build_object('board', repeat('.', 42), 'round', rnd + 1, 'starter', starter, 'turn', starter, 'last', null, 'moves', 0);
    end if;
    update games set state = st, score_a = wins_a, score_b = wins_b,
      deadline_at = now() + public.game_idle()
    where id = g.id;
    if over then perform public.game_finish(g.id); end if;
    return;
  end if;

  st := st || jsonb_build_object('turn', case when who = 'a' then 'b' else 'a' end);
  update games set state = st, deadline_at = now() + public.game_idle() where id = g.id;
end $$;
revoke all on function public.game_c4_move(uuid, int, boolean) from public, anon, authenticated;

-- The setup reward needs all three: 10 things, where you are, and notifications on
create or replace function public.claim_setup_reward(p_no_push boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  reward int := public.setting_int('setup_reward', 5);
  bal int;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into p from profiles where id = uid;
  insert into accounts_private (user_id) values (uid) on conflict (user_id) do nothing;
  perform 1 from accounts_private where user_id = uid for update;
  if (select setup_reward_at from accounts_private where user_id = uid) is not null then raise exception 'Already claimed'; end if;
  if p.place_country is null then raise exception 'Add where you are first'; end if;
  if jsonb_array_length(p.things) < 10 then raise exception 'Add 10 things about you first'; end if;
  -- Notifications are part of it on every phone (on iPhone, once Dashpad is on the home screen)
  if not exists (select 1 from push_subscriptions where user_id = uid) then
    raise exception 'Turn on notifications first';
  end if;
  update accounts_private set setup_reward_at = now() where user_id = uid;
  bal := case when reward > 0 then public.add_keys(uid, reward, 'setup') else (select balance from wallets where user_id = uid) end;
  return json_build_object('reward', reward, 'balance', coalesce(bal, 0));
end $$;
