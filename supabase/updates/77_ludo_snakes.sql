-- Dashpad update: Ludo and Snakes & Ladders (Part 77)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Two new games in chats. Dice are rolled by the server, so nobody can choose their number.
-- Admin can switch each one off in Admin -> Games, like the others.

alter table public.games drop constraint if exists games_kind_check;
alter table public.games add constraint games_kind_check check (kind in ('truths', 'tot', 'c4', 'words', 'whot', 'checkers', 'chess', 'ayo', 'bomb', 'gems', 'ludo', 'snakes'));

create or replace function public.game_title(k text) returns text
language sql immutable as $$
  select case k when 'truths' then 'Two Truths & a Lie' when 'tot' then 'This or That'
    when 'c4' then 'Connect 4' when 'words' then 'Word Hunt' when 'whot' then 'Whot'
    when 'checkers' then 'Checkers' when 'chess' then 'Chess' when 'ayo' then 'Ayo'
    when 'bomb' then 'Bombshell' when 'gems' then 'Gem Clash'
    when 'ludo' then 'Ludo' when 'snakes' then 'Snakes & Ladders' else 'a game' end
$$;

create or replace function public.game_begin(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  lvl int := 1;
  qs jsonb;
  t timestamptz := now() + interval '4 seconds'; -- 3, 2, 1 countdown
begin
  select * into g from games where id = p_game;
  -- Friendship chats always get Mild questions
  if g.session_id is not null then
    select case when intent = 'friends' then 0 else spice_level end into lvl from masquerade_sessions where id = g.session_id;
  else
    select case when intent = 'spicy' then 3 when intent = 'dating' then 2 else 0 end into lvl from matches where id = g.match_id;
  end if;
  if g.kind = 'tot' then
    select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'q', q.prompt, 'a', q.a, 'b', q.b)), '[]'::jsonb) into qs
    from (select * from tot_questions where active and spice <= coalesce(lvl, 1) order by random() limit 10) q;
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('qs', qs, 'i', 0, 'picks', '[]'::jsonb, 'alike', 0)
    where id = g.id;
  elsif g.kind = 'truths' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('phase', 'write')
    where id = g.id;
  elsif g.kind = 'c4' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('board', repeat('.', 42), 'turn', 'a', 'round', 1, 'wins', jsonb_build_object('a', 0, 'b', 0),
        'starter', 'a', 'last', null, 'moves', 0, 'auto_a', 0, 'auto_b', 0)
    where id = g.id;
  elsif g.kind = 'checkers' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('board', public.game_checkers_board(), 'turn', 'a', 'chain', null, 'quiet', 0,
        'captured', jsonb_build_object('a', 0, 'b', 0), 'last', null, 'moves', 0)
    where id = g.id;
  elsif g.kind = 'chess' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('fen', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'turn', 'a', 'san', '[]'::jsonb,
        'last', null, 'check', false, 'taken', jsonb_build_object('a', '', 'b', ''), 'moves', 0)
    where id = g.id;
  elsif g.kind = 'ayo' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('pits', jsonb_build_array(4,4,4,4,4,4,4,4,4,4,4,4), 'store', jsonb_build_object('a', 0, 'b', 0),
        'turn', 'a', 'last', null, 'moves', 0)
    where id = g.id;
  elsif g.kind = 'whot' then
    perform public.game_whot_deal(g.id, t);
  elsif g.kind = 'bomb' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('phase', 'hide', 'round', 1, 'wins', jsonb_build_object('a', 0, 'b', 0), 'starter', 'a',
        'ready_a', false, 'ready_b', false, 'turn', null, 'open_a', '.........', 'open_b', '.........',
        'boom_a', 0, 'boom_b', 0, 'last', null, 'result', null, 'moves', 0)
    where id = g.id;
  elsif g.kind = 'gems' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('board', public.game_gems_board(), 'turn', 'a', 'left', 2,
        'done', jsonb_build_object('a', 0, 'b', 0), 'points', jsonb_build_object('a', 0, 'b', 0), 'last', null, 'moves', 0)
    where id = g.id;
  elsif g.kind = 'ludo' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('tokens', jsonb_build_object('a', jsonb_build_array(-1,-1,-1,-1), 'b', jsonb_build_array(-1,-1,-1,-1)),
        'turn', 'a', 'roll', null, 'sixes', 0, 'last', null, 'moves', 0)
    where id = g.id;
  elsif g.kind = 'snakes' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('pos', jsonb_build_object('a', 0, 'b', 0), 'turn', 'a', 'last', null, 'moves', 0)
    where id = g.id;
  else
    update games set status = 'active', started_at = t, deadline_at = t + interval '80 seconds',
      state = jsonb_build_object('board', public.game_words_board(), 'count_a', 0, 'count_b', 0)
    where id = g.id;
  end if;
  insert into game_secrets (game_id, user_id) values (g.id, g.player_a), (g.id, g.player_b) on conflict do nothing;
end $$;

create or replace function public.start_game(p_kind text, p_session uuid default null, p_match uuid default null, p_rematch uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  other uuid;
  live games;
  gid uuid;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if p_kind not in ('truths', 'tot', 'c4', 'words', 'whot', 'checkers', 'chess', 'ayo', 'bomb', 'gems', 'ludo', 'snakes') then raise exception 'Unknown game'; end if;
  if public.setting_int('game_' || p_kind, 1) = 0 then raise exception 'This game is taking a break. Try another one.'; end if;
  other := public.game_chat_ok(uid, p_session, p_match);
  if other is null then raise exception 'Games are not available in this chat right now'; end if;

  -- Clear out a challenge that ran out
  update games set status = 'expired', ended_at = now()
  where status = 'invited' and deadline_at < now()
    and ((p_session is not null and session_id = p_session) or (p_match is not null and match_id = p_match));

  select * into live from games where status in ('invited', 'active')
    and ((p_session is not null and session_id = p_session) or (p_match is not null and match_id = p_match))
  limit 1;
  if found then
    -- They already challenged you to the same game: just accept it
    if live.status = 'invited' and live.player_b = uid and live.kind = p_kind then
      perform public.respond_game(live.id, true);
      return live.id;
    end if;
    raise exception 'Finish the game you’re in first';
  end if;

  if p_session is not null and public.meet_turn_pending(p_session) then
    raise exception 'Your game starts when it’s your turn. Chat while you wait.';
  end if;

  if (select count(*) from games where player_a = uid and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Slow down a little';
  end if;

  insert into games (kind, session_id, match_id, player_a, player_b, deadline_at, rematch_of)
  values (p_kind, p_session, p_match, uid, other, now() + interval '30 seconds', p_rematch)
  returning id into gid;
  return gid;
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
  if public.game_chat_ok(uid, g.session_id, g.match_id) is null then
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

revoke all on function public.game_begin(uuid) from public, anon, authenticated;
revoke all on function public.game_finish(uuid, text, uuid) from public, anon, authenticated;
