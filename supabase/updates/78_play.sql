-- Dashpad update: Play a stranger (Part 78)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Tap Play: you wait in line with people who fit your Masquerade settings (mood, who you want to
-- meet and age, both ways). When someone's there, Dashpad picks a game at random (Whot, Ayo,
-- Ludo or Snakes & Ladders) and it starts. Play games stand alone: you see each other's name and
-- photo, and no chat is made. Either player can pay to message the other (the Meet message price):
-- that saves a normal chat for you both, with the game result in it, and it's free from then on.
-- Gifts can be sent during the game. Keys back if they don't reply within 48 hours.
-- Each player pays the match price when paired (Admin -> Prices, 0 = free).

insert into app_settings (key, value) values ('play_cost', 1) on conflict (key) do nothing;

-- Games from Play aren't in a chat
alter table public.games add column if not exists play boolean not null default false;
-- A chat game is in a masked chat or a chat with your people; a Play game is in neither
alter table public.games drop constraint if exists games_check;
alter table public.games drop constraint if exists games_place_check;
alter table public.games add constraint games_place_check check (
  case when play then session_id is null and match_id is null else (session_id is null) <> (match_id is null) end);

-- People waiting to play (and, for a moment after, the game they were paired into)
create table if not exists public.play_queue (
  user_id uuid primary key references public.profiles on delete cascade,
  intent public.intent not null,
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  game_id uuid references public.games on delete set null,
  game_kind text,
  matched_at timestamptz
);
alter table public.play_queue enable row level security;
drop policy if exists play_queue_own on public.play_queue;
create policy play_queue_own on public.play_queue for select using (user_id = auth.uid());
do $$ begin
  alter publication supabase_realtime add table public.play_queue;
exception when duplicate_object then null; end $$;

-- Gifts sent during a Play game before you had a chat (they're added to the chat if one opens)
create table if not exists public.play_gifts (
  id bigint generated always as identity primary key,
  game_id uuid references public.games on delete set null,
  from_user uuid not null references public.profiles on delete cascade,
  to_user uuid not null references public.profiles on delete cascade,
  gift_id text not null,
  created_at timestamptz not null default now(),
  posted_at timestamptz
);
alter table public.play_gifts enable row level security;

-- Paid chats started after a game: what was paid, and when it was given back
alter table public.matches add column if not exists paid_keys int not null default 0;
alter table public.matches add column if not exists refunded_at timestamptz;

-- Game gifts
insert into public.gifts (id, name, emoji, price, sort) values
  ('gg', 'GG', '🎮', 3, 20),
  ('dice', 'Lucky dice', '🎲', 5, 21),
  ('clover', 'Lucky charm', '🍀', 8, 22),
  ('medal', 'Gold medal', '🥇', 20, 23),
  ('rocket', 'Rocket', '🚀', 25, 24),
  ('goat', 'GOAT', '🐐', 50, 25)
on conflict (id) do nothing;

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
  -- Checking in while you wait keeps your place in line (you might be playing practice)
  update play_queue set seen_at = now() where user_id = uid and game_id is null;
  select * into q from play_queue where user_id = uid;
  return json_build_object(
    'waiting', q.user_id is not null and q.game_id is null,
    'joined_at', q.joined_at,
    'game_id', q.game_id,
    'game', q.game_kind,
    'intent', me.pref_intent,
    'seeking', me.pref_seeking,
    'age_min', me.pref_age_min,
    'age_max', me.pref_age_max,
    'cost', public.setting_int('play_cost', 1),
    'balance', coalesce((select balance from wallets where user_id = uid), 0),
    'games', public.play_games(me.pref_intent),
    'in_line', (select count(*) from play_queue x join profiles p on p.id = x.user_id
                where x.game_id is null and x.user_id <> uid and x.seen_at > now() - interval '2 minutes'
                  and public.play_fits(me, p)),
    'playing', (select count(*) from games g where g.play and g.status = 'active'),
    'server_now', now()
  );
end $$;

-- Tap Play: pair with someone waiting who fits, or wait in line
create or replace function public.play_join() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  them profiles;
  cost int := greatest(0, public.setting_int('play_cost', 1));
  pool text[];
  pick text;
  gid uuid;
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
    -- Someone new first; someone you've played today if they're the only one there
    select p.* into them from play_queue x join profiles p on p.id = x.user_id
    where x.game_id is null and x.user_id <> uid
      and x.seen_at > now() - interval '2 minutes'
      and p.last_seen_at > now() - interval '150 seconds'
      and public.play_fits(me, p)
    order by exists (select 1 from games y where y.play and y.created_at > now() - interval '1 day'
                       and ((y.player_a = uid and y.player_b = p.id) or (y.player_a = p.id and y.player_b = uid))),
      x.joined_at
    limit 1;
    exit when not found;
    if cost > 0 and coalesce((select balance from wallets where user_id = them.id), 0) < cost then
      delete from play_queue where user_id = them.id;
      continue;
    end if;

    pick := pool[1 + floor(random() * array_length(pool, 1))::int];
    -- The one who waited is player a: they go first
    insert into games (kind, player_a, player_b, play, deadline_at)
    values (pick, them.id, uid, true, now() + interval '30 seconds')
    returning id into gid;
    if cost > 0 then
      perform public.spend_keys(them.id, cost, 'play', gid::text);
      perform public.spend_keys(uid, cost, 'play', gid::text);
    end if;
    perform public.game_begin(gid);
    -- A few extra seconds so you both see the game picked before the countdown
    update games set started_at = now() + interval '7 seconds', deadline_at = now() + interval '7 seconds' + public.game_idle() where id = gid;

    update play_queue set game_id = gid, game_kind = pick, matched_at = now() where user_id = them.id;
    insert into play_queue (user_id, intent, joined_at, seen_at, game_id, game_kind, matched_at)
    values (uid, me.pref_intent, now(), now(), gid, pick, now())
    on conflict (user_id) do update set intent = excluded.intent, game_id = gid, game_kind = pick, matched_at = now();
    return json_build_object('game_id', gid, 'game', pick);
  end loop;

  insert into play_queue (user_id, intent, joined_at, seen_at)
  values (uid, me.pref_intent, now(), now())
  on conflict (user_id) do update set intent = excluded.intent, seen_at = now(),
    joined_at = case when play_queue.game_id is null then play_queue.joined_at else now() end,
    game_id = null, game_kind = null, matched_at = null;
  return json_build_object('game_id', null, 'game', null);
end $$;

-- Stop waiting (or clear your last pairing once the game has opened)
create or replace function public.play_leave() returns void
language sql security definer set search_path = public as $$
  delete from play_queue where user_id = auth.uid();
$$;

-- Your Play game that's on right now (or a rematch waiting for your answer)
create or replace function public.play_live() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', g.id, 'status', g.status) from games g
  where g.play and auth.uid() in (g.player_a, g.player_b)
    and (g.status = 'active' or (g.status = 'invited' and g.deadline_at > now()))
  order by g.created_at desc limit 1
$$;

-- The other player in a Play game: who they are, whether you can message them, and what it costs
create or replace function public.play_info(p_game uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  them uuid;
  p profiles;
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid);
  if not found then return null; end if;
  them := case when g.player_a = uid then g.player_b else g.player_a end;
  select * into p from profiles where id = them;
  return json_build_object(
    'id', p.id, 'name', p.display_name, 'age', public.age_years(p.birthdate), 'gender', p.gender,
    'photos', p.photos, 'bio', p.bio, 'interests', p.interests, 'place', p.place_label,
    'online', coalesce(p.last_seen_at > now() - interval '2 minutes', false),
    'me_photo', (select photos[1] from profiles where id = uid),
    'match_id', (select id from matches where user_a = least(uid, them) and user_b = greatest(uid, them)),
    'cost', public.setting_int('explore_message_cost', 15),
    'balance', coalesce((select balance from wallets where user_id = uid), 0)
  );
end $$;

-- Message the other player: free if you already have a chat, otherwise the Meet message price.
-- Saves a chat for you both, with the game result (and any gifts) in it.
create or replace function public.play_chat_open(p_game uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  them uuid;
  me profiles;
  mid uuid;
  cost int := greatest(0, public.setting_int('explore_message_cost', 15));
  r record;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into g from games where id = p_game and play and (player_a = uid or player_b = uid);
  if not found then raise exception 'Game not found'; end if;
  them := case when g.player_a = uid then g.player_b else g.player_a end;
  select id into mid from matches where user_a = least(uid, them) and user_b = greatest(uid, them);
  if mid is not null then return mid; end if;
  if public.is_blocked(uid, them) then raise exception 'Not available'; end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  if (select count(*) from matches where opened_by = uid and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Slow down a little';
  end if;
  select * into me from profiles where id = uid;
  insert into matches (user_a, user_b, intent, opened_by, source, paid_keys)
  values (least(uid, them), greatest(uid, them), me.pref_intent, uid, 'play', cost)
  returning id into mid;
  if cost > 0 then perform public.spend_keys(uid, cost, 'play_message', mid::text); end if;
  -- The game you played (once it's over; a game still going is added when it ends)
  if g.status in ('done', 'cancelled') then
    insert into messages (match_id, sender_id, kind, body, media_meta)
    values (mid, null, 'game', public.game_title(g.kind), jsonb_build_object('game', g.id, 'kind', g.kind, 'a', g.player_a, 'b', g.player_b,
      'sa', g.score_a, 'sb', g.score_b, 'winner', g.winner, 'status', g.status, 'reason', g.ended_reason, 'by', g.ended_by));
  end if;
  -- Gifts sent during your games
  for r in select * from play_gifts where posted_at is null
    and ((from_user = uid and to_user = them) or (from_user = them and to_user = uid)) order by id loop
    insert into messages (match_id, sender_id, kind, body, media_meta, created_at)
    values (mid, r.from_user, 'gift', r.gift_id, jsonb_build_object('gift', r.gift_id), r.created_at);
    update play_gifts set posted_at = now() where id = r.id;
  end loop;
  update matches set last_message_at = now() where id = mid;
  return mid;
end $$;

-- A gift during a Play game: into your chat if you have one, otherwise kept for it
create or replace function public.play_gift(p_game uuid, p_gift text) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  gf gifts;
  them uuid;
  mid uuid;
  bal int;
  share int;
begin
  select * into g from games where id = p_game and play and (player_a = uid or player_b = uid);
  if not found then raise exception 'Game not found'; end if;
  them := case when g.player_a = uid then g.player_b else g.player_a end;
  if public.is_blocked(uid, them) then raise exception 'Not available'; end if;
  select id into mid from matches where user_a = least(uid, them) and user_b = greatest(uid, them);
  if mid is not null then return public.send_gift(p_gift, mid, null); end if;
  select * into gf from gifts where id = p_gift and not retired;
  if not found then raise exception 'Unknown gift'; end if;
  bal := public.spend_keys(uid, gf.price, 'gift', gf.id);
  share := gf.price * least(100, greatest(0, public.setting_int('gift_share_percent', 50))) / 100;
  if share > 0 then perform public.add_keys(them, share, 'gift_received', gf.id); end if;
  insert into play_gifts (game_id, from_user, to_user, gift_id) values (g.id, uid, them, gf.id);
  return bal;
end $$;

-- Play again with the same person: same game, they have 30 seconds to say yes
create or replace function public.play_rematch(p_game uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  live games;
  them uuid;
  gid uuid;
begin
  select * into g from games where id = p_game and play and (player_a = uid or player_b = uid);
  if not found then raise exception 'Game not found'; end if;
  them := case when g.player_a = uid then g.player_b else g.player_a end;
  if public.is_blocked(uid, them) then raise exception 'Not available'; end if;
  update games set status = 'expired', ended_at = now(), deadline_at = null
  where play and status = 'invited' and deadline_at < now() and ((player_a = uid and player_b = them) or (player_a = them and player_b = uid));
  select * into live from games where play and status in ('invited', 'active')
    and ((player_a = uid and player_b = them) or (player_a = them and player_b = uid))
  order by created_at desc limit 1;
  if found then
    -- They asked first: that's a yes
    if live.status = 'invited' and live.player_b = uid then perform public.respond_game(live.id, true); end if;
    return live.id;
  end if;
  if public.setting_int('game_' || g.kind, 1) = 0 then raise exception 'This game is taking a break. Try another one.'; end if;
  insert into games (kind, player_a, player_b, play, deadline_at, rematch_of)
  values (g.kind, uid, them, true, now() + interval '30 seconds', g.id)
  returning id into gid;
  return gid;
end $$;

-- Keys back for chats paid for after a game, if the other person never replied within 48 hours
create or replace function public.refund_quiet_play_chats(p_limit int default 200) returns json
language plpgsql security definer set search_path = public as $$
declare
  r record;
  out_rows json[] := '{}';
begin
  for r in
    select m.id, m.opened_by, m.paid_keys, case when m.user_a = m.opened_by then m.user_b else m.user_a end as other
    from matches m
    where m.source = 'play' and m.paid_keys > 0 and m.refunded_at is null and m.opened_by is not null
      and m.created_at < now() - interval '48 hours'
      -- A real reply (gifts from before the chat don't count)
      and not exists (select 1 from messages x where x.match_id = m.id and x.sender_id is not null and x.sender_id <> m.opened_by
                        and x.kind not in ('gift', 'game') and x.created_at > m.created_at)
    order by m.created_at
    limit p_limit
    for update skip locked
  loop
    perform public.add_keys(r.opened_by, r.paid_keys, 'explore_refund', r.id::text);
    update matches set refunded_at = now() where id = r.id;
    out_rows := out_rows || json_build_object('user_id', r.opened_by, 'keys', r.paid_keys, 'match_id', r.id,
      'name', (select display_name from profiles where id = r.other));
  end loop;
  return to_json(out_rows);
end $$;

create or replace function public.respond_game(p_game uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
begin
  select * into g from games where id = p_game and player_b = uid for update;
  if not found then raise exception 'Game not found'; end if;
  if g.status <> 'invited' then return; end if;
  if g.deadline_at < now() - interval '2 seconds' then
    update games set status = 'expired', ended_at = now() where id = g.id;
    raise exception 'That challenge ran out';
  end if;
  if not p_accept then
    update games set status = 'declined', ended_at = now(), deadline_at = null where id = g.id;
    return;
  end if;
  if not g.play and public.game_chat_ok(uid, g.session_id, g.match_id) is null then raise exception 'This chat has ended'; end if;
  perform public.game_begin(g.id);
end $$;

create or replace function public.game_tick(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  who text;
  col int;
  free int[];
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid) for update;
  if not found then return; end if;
  if g.status = 'invited' and g.deadline_at < now() then
    update games set status = 'expired', ended_at = now(), deadline_at = null where id = g.id;
    return;
  end if;
  if g.status <> 'active' then return; end if;
  -- The chat closed (hour over, or someone let go)
  if not g.play and public.game_chat_ok(uid, g.session_id, g.match_id) is null then
    perform public.game_finish(g.id, 'closed');
    return;
  end if;
  if g.deadline_at is null or now() < g.deadline_at then return; end if;

  -- Nobody moved for a long while: the game ends (there are no move timers any more)
  if g.kind = 'tot' then
    perform public.game_finish(g.id, 'timeout');
  elsif g.kind = 'truths' then
    if g.state->>'phase' = 'write' then
      if (g.state->>'ready_a')::boolean is true or (g.state->>'ready_b')::boolean is true then
        -- Only one wrote theirs in time: they win
        update games set winner = case when (g.state->>'ready_a')::boolean is true then g.player_a else g.player_b end where id = g.id;
      end if;
      perform public.game_finish(g.id, 'timeout');
    else
      perform public.game_truths_reveal(g.id);
    end if;
  elsif g.kind = 'bomb' and g.state->>'phase' = 'hide' then
    -- Still hiding bombs: whoever didn't hide theirs loses (nobody wins if neither did)
    if (g.state->>'ready_a')::boolean is distinct from (g.state->>'ready_b')::boolean then
      who := case when (g.state->>'ready_a')::boolean then 'b' else 'a' end;
      update games set winner = case when who = 'a' then g.player_b else g.player_a end where id = g.id;
      perform public.game_finish(g.id, 'timeout', case when who = 'a' then g.player_a else g.player_b end);
    else
      perform public.game_finish(g.id, 'timeout');
    end if;
  elsif g.kind in ('c4', 'whot', 'checkers', 'chess', 'ayo', 'bomb', 'gems', 'ludo', 'snakes') then
    -- Whoever kept everyone waiting loses
    who := g.state->>'turn';
    update games set winner = case when who = 'a' then g.player_b else g.player_a end where id = g.id;
    perform public.game_finish(g.id, 'timeout', case when who = 'a' then g.player_a else g.player_b end);
  elsif g.kind = 'words' then
    if now() < g.deadline_at + interval '2 seconds' then return; end if;
    update games set state = state || jsonb_build_object(
      'words_a', (select coalesce(data->'words', '[]'::jsonb) from game_secrets where game_id = g.id and user_id = g.player_a),
      'words_b', (select coalesce(data->'words', '[]'::jsonb) from game_secrets where game_id = g.id and user_id = g.player_b))
    where id = g.id;
    perform public.game_finish(g.id);
  end if;
end $$;

create or replace function public.game_finish(p_game uuid, p_reason text default null, p_by uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  meta jsonb;
  st text;
begin
  select * into g from games where id = p_game;
  if not found or g.status <> 'active' then return; end if;
  st := case when p_reason in ('left', 'timeout', 'closed') then 'cancelled' else 'done' end;
  -- These games set their own winner (and a draw has none)
  if st = 'done' and g.winner is null and g.kind not in ('tot', 'whot', 'checkers', 'chess', 'ayo', 'bomb', 'gems', 'ludo', 'snakes') then
    g.winner := case when g.score_a > g.score_b then g.player_a when g.score_b > g.score_a then g.player_b end;
  end if;
  update games set status = st, ended_at = now(), ended_reason = p_reason, ended_by = p_by,
    winner = g.winner, deadline_at = null
  where id = g.id;
  if p_reason = 'closed' then return; end if;
  -- Play games stand alone: the result goes in your chat only if you have one
  if g.play then
    select id into g.match_id from matches where user_a = least(g.player_a, g.player_b) and user_b = greatest(g.player_a, g.player_b);
    if g.match_id is null then return; end if;
  end if;
  meta := jsonb_build_object('game', g.id, 'kind', g.kind, 'a', g.player_a, 'b', g.player_b,
    'sa', g.score_a, 'sb', g.score_b, 'winner', g.winner, 'status', st, 'reason', p_reason, 'by', p_by);
  if st = 'done' and public.game_detail(g) is not null then
    meta := meta || jsonb_build_object('detail', public.game_detail(g));
  end if;
  if g.session_id is not null then
    insert into masquerade_messages (session_id, sender_id, kind, body, media_meta)
    values (g.session_id, null, 'game', public.game_title(g.kind), meta);
  else
    insert into messages (match_id, sender_id, kind, body, media_meta)
    values (g.match_id, null, 'game', public.game_title(g.kind), meta);
    update matches set last_message_at = now() where id = g.match_id;
  end if;
end $$;

-- Games say whether they're from Play, and Play games count your record together
create or replace function public.get_game(p_game uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  mine jsonb;
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid);
  if not found then return null; end if;
  select data into mine from game_secrets where game_id = g.id and user_id = uid;
  return json_build_object(
    'id', g.id, 'kind', g.kind, 'session_id', g.session_id, 'match_id', g.match_id, 'play', g.play,
    'player_a', g.player_a, 'player_b', g.player_b, 'me', case when uid = g.player_a then 'a' else 'b' end,
    'status', g.status, 'state', g.state, 'score_a', g.score_a, 'score_b', g.score_b, 'winner', g.winner,
    'ended_by', g.ended_by, 'ended_reason', g.ended_reason,
    'deadline_at', g.deadline_at, 'started_at', g.started_at, 'ended_at', g.ended_at, 'created_at', g.created_at,
    'server_now', now(), 'mine', coalesce(mine, '{}'::jsonb),
    'record', (
      select json_build_object(
        'played', count(*),
        'won', count(*) filter (where x.winner = uid),
        'lost', count(*) filter (where x.winner is not null and x.winner <> uid),
        'alike', (select round(100.0 * y.score_a / greatest(1, jsonb_array_length(y.state->'qs'))) from games y
                  where y.kind = 'tot' and y.status = 'done'
                    and ((g.session_id is not null and y.session_id = g.session_id) or (g.match_id is not null and y.match_id = g.match_id))
                  order by y.ended_at desc limit 1))
      from games x where x.status = 'done'
        and ((g.session_id is not null and x.session_id = g.session_id) or (g.match_id is not null and x.match_id = g.match_id)
          -- Play games: every Play game the two of you have played
          or (g.play and x.play and ((x.player_a = g.player_a and x.player_b = g.player_b) or (x.player_a = g.player_b and x.player_b = g.player_a)))))
  );
end $$;

revoke all on function public.play_games(public.intent) from public, anon;
revoke all on function public.play_fits(profiles, profiles) from public, anon, authenticated;
revoke all on function public.refund_quiet_play_chats(int) from public, anon, authenticated;
revoke all on function public.game_finish(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.play_status() from public, anon;
revoke all on function public.play_join() from public, anon;
revoke all on function public.play_leave() from public, anon;
revoke all on function public.play_live() from public, anon;
revoke all on function public.play_info(uuid) from public, anon;
revoke all on function public.play_chat_open(uuid) from public, anon;
revoke all on function public.play_gift(uuid, text) from public, anon;
revoke all on function public.play_rematch(uuid) from public, anon;
grant execute on function public.play_status() to authenticated;
grant execute on function public.play_join() to authenticated;
grant execute on function public.play_leave() to authenticated;
grant execute on function public.play_live() to authenticated;
grant execute on function public.play_info(uuid) to authenticated;
grant execute on function public.play_chat_open(uuid) to authenticated;
grant execute on function public.play_gift(uuid, text) to authenticated;
grant execute on function public.play_rematch(uuid) to authenticated;
