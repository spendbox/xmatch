-- Dashpad update: Mild This or That in friendship chats (Part 55)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 54 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 55: Question spice is hidden for Friends, so This or That in friendship chats
-- (masked or connected) always uses Mild questions, whatever spice was set before.
-- ---------------------------------------------------------------------------
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
  else
    update games set status = 'active', started_at = t, deadline_at = t + interval '80 seconds',
      state = jsonb_build_object('board', public.game_words_board(), 'count_a', 0, 'count_b', 0)
    where id = g.id;
  end if;
  insert into game_secrets (game_id, user_id) values (g.id, g.player_a), (g.id, g.player_b) on conflict do nothing;
end $$;
