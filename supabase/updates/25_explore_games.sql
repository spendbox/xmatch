-- Dashpad update: Explore, games without timers, saved truths, daily prompts off (Part 25)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 24 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 25: Explore, games without timers, saved truths, daily prompts off
-- ---------------------------------------------------------------------------
-- Explore (the Meet page): people like you in a grid, and a search to find anyone by name.
-- You see someone's main photo. Their other photos unlock with Keys (free once you're connected).
-- Messaging someone you're not connected to costs Keys and opens a chat with them.
insert into public.app_settings (key, value) values
  ('explore_message_cost', 15),
  ('explore_photos_cost', 5)
on conflict (key) do nothing;

create table if not exists public.photo_unlocks (
  viewer uuid not null references public.profiles on delete cascade,
  target uuid not null references public.profiles on delete cascade,
  paid int not null default 0,
  created_at timestamptz not null default now(),
  primary key (viewer, target)
);
alter table public.photo_unlocks enable row level security;
drop policy if exists "read own unlocks" on public.photo_unlocks;
create policy "read own unlocks" on public.photo_unlocks for select using (viewer = auth.uid());

-- Who started a chat from Explore (empty for chats that came from unmasking)
alter table public.matches add column if not exists opened_by uuid references public.profiles on delete set null;
alter table public.matches add column if not exists source text;

-- Someone you can see in Explore at all
create or replace function public.explore_visible(v uuid, o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select v <> o and exists (
    select 1 from profiles p left join accounts_private a on a.user_id = p.id
    where p.id = o and p.display_name is not null and p.birthdate is not null and p.gender is not null
      and cardinality(p.photos) > 0 and a.banned_at is null)
    and not public.is_blocked(v, o)
$$;

-- Your settings fit theirs and theirs fit yours (being connected doesn't hide them here)
create or replace function public.explore_fits(v uuid, o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles a, profiles b
    where a.id = v and b.id = o
      and a.gender is not null and b.gender is not null and a.birthdate is not null and b.birthdate is not null
      and a.pref_intent = b.pref_intent
      and public.gender_fits(a.pref_seeking, b.gender) and public.gender_fits(b.pref_seeking, a.gender)
      and public.age_years(b.birthdate) between a.pref_age_min and a.pref_age_max
      and public.age_years(a.birthdate) between b.pref_age_min and b.pref_age_max)
$$;

create or replace function public.explore_match_id(v uuid, o uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from matches where user_a = least(v, o) and user_b = greatest(v, o)
$$;

-- The grid: people like you (closest and most recently around first), or everyone whose name matches your search
create or replace function public.explore_people(p_q text default null, p_limit int default 60, p_offset int default 0) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into me from profiles where id = uid;
  return json_build_object(
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    'people', coalesce((
      select json_agg(row_to_json(t)) from (
        select p.id, p.display_name as name, public.age_years(p.birthdate) as age, p.gender, p.photos[1] as photo,
          p.place_label as place, p.pref_intent as intent,
          (p.last_seen_at > now() - interval '5 minutes') as online,
          public.explore_match_id(uid, p.id) is not null as connected
        from profiles p
        where public.explore_visible(uid, p.id)
          and (case when q is not null then p.display_name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%'
                    else p.last_seen_at > now() - interval '30 days' and public.explore_fits(uid, p.id) end)
        order by
          (q is not null and lower(p.display_name) = lower(q)) desc,
          (p.last_seen_at > now() - interval '5 minutes') desc,
          (p.place_country = me.place_country and p.place_region = me.place_region) desc nulls last,
          (p.place_country = me.place_country) desc nulls last,
          public.shared_count(me.interests, p.interests) desc,
          p.last_seen_at desc
        limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
      ) t), '[]'::json)
  );
end $$;

-- One person's profile as you may see it
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
    'id', p.id, 'name', p.display_name, 'age', public.age_years(p.birthdate), 'gender', p.gender,
    'bio', p.bio, 'interests', p.interests, 'place', p.place_label, 'intent', p.pref_intent,
    'online', p.last_seen_at > now() - interval '5 minutes',
    'photos', case when open then to_json(p.photos) else to_json(array[p.photos[1]]) end,
    'photo_count', cardinality(p.photos),
    'photos_unlocked', open,
    'match_id', mid,
    'shared_interests', array(select unnest(p.interests) intersect select unnest((select interests from profiles where id = uid))),
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5)
  );
end $$;

-- See all of someone's photos
create or replace function public.unlock_photos(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cost int := public.setting_int('explore_photos_cost', 5);
  bal int;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if not public.explore_visible(uid, p_id) then raise exception 'Not available'; end if;
  if public.explore_match_id(uid, p_id) is not null or exists (select 1 from photo_unlocks where viewer = uid and target = p_id) then
    select balance into bal from wallets where user_id = uid;
    return coalesce(bal, 0);
  end if;
  if cost > 0 then
    bal := public.spend_keys(uid, cost, 'photos', p_id::text);
  else
    select balance into bal from wallets where user_id = uid;
  end if;
  insert into photo_unlocks (viewer, target, paid) values (uid, p_id, cost) on conflict do nothing;
  return coalesce(bal, 0);
end $$;

-- Message someone from Explore. Free if you're already connected, otherwise it costs Keys.
create or replace function public.message_person(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mid uuid;
  cost int := public.setting_int('explore_message_cost', 15);
  me profiles;
begin
  if uid is null then raise exception 'Please log in'; end if;
  mid := public.explore_match_id(uid, p_id);
  if mid is not null then return mid; end if;
  if not public.explore_visible(uid, p_id) then raise exception 'Not available'; end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  if (select count(*) from matches where opened_by = uid and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Slow down a little';
  end if;
  select * into me from profiles where id = uid;
  insert into matches (user_a, user_b, intent, opened_by, source)
  values (least(uid, p_id), greatest(uid, p_id), me.pref_intent, uid, 'explore')
  returning id into mid;
  if cost > 0 then perform public.spend_keys(uid, cost, 'explore_message', mid::text); end if;
  return mid;
end $$;

revoke all on function public.explore_visible(uuid, uuid) from public, anon, authenticated;
revoke all on function public.explore_fits(uuid, uuid) from public, anon, authenticated;
revoke all on function public.explore_match_id(uuid, uuid) from public, anon, authenticated;

-- The daily prompts (Feed) are switched off: nobody can answer, react, gift or start chats from them.
-- To bring them back: grant execute on these functions to authenticated again.
do $$
declare f text;
begin
  foreach f in array array[
    'get_feed(text, int, int)', 'answer_prompt(uuid, text)', 'delete_my_answer(uuid)', 'react_answer(uuid, text)',
    'gift_answer(uuid, text)', 'start_feed_chat(uuid)', 'chat_back_gift(bigint)', 'report_answer(uuid, text)',
    'my_feed_gifts()', 'mark_feed_gifts_seen()', 'feed_status()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- Games without move timers. A game only ends early if nobody moves for 5 minutes.
-- Word Hunt keeps its 80-second round: racing the clock is the game.
create or replace function public.game_idle() returns interval
language sql immutable as $$ select interval '5 minutes' $$;

-- Your own truths for Two Truths and a Lie, kept to use again
create table if not exists public.user_truths (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 2 and 120),
  uses int not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create unique index if not exists user_truths_once on public.user_truths (user_id, lower(body));
alter table public.user_truths enable row level security;
drop policy if exists "read own truths" on public.user_truths;
create policy "read own truths" on public.user_truths for select using (user_id = auth.uid());

create or replace function public.my_truths() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', id, 'body', body, 'uses', uses) order by last_used_at desc nulls last, created_at desc), '[]'::json)
  from user_truths where user_id = auth.uid()
$$;

create or replace function public.save_truth(p_body text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  tid bigint;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if char_length(b) not between 2 and 120 then raise exception 'Each line needs a few words (up to 120 letters)'; end if;
  if (select count(*) from user_truths where user_id = uid) >= 50 then raise exception 'You can keep up to 50 truths'; end if;
  insert into user_truths (user_id, body) values (uid, b)
  on conflict (user_id, lower(body)) do update set body = user_truths.body
  returning id into tid;
  return tid;
end $$;

create or replace function public.delete_truth(p_id bigint) returns void
language sql security definer set search_path = public as $$
  delete from user_truths where id = p_id and user_id = auth.uid()
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
  if g.session_id is not null then
    select spice_level into lvl from masquerade_sessions where id = g.session_id;
  else
    select case when intent = 'spicy' then 3 when intent = 'dating' then 2 else 1 end into lvl from matches where id = g.match_id;
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
  else
    update games set status = 'active', started_at = t, deadline_at = t + interval '80 seconds',
      state = jsonb_build_object('board', public.game_words_board(), 'count_a', 0, 'count_b', 0)
    where id = g.id;
  end if;
  insert into game_secrets (game_id, user_id) values (g.id, g.player_a), (g.id, g.player_b) on conflict do nothing;
end $$;

create or replace function public.game_tot_reveal(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  i int;
  pa text; pb text;
  same boolean;
  n int;
begin
  select * into g from games where id = p_game;
  i := (g.state->>'i')::int;
  select data->'picks'->>(i::text) into pa from game_secrets where game_id = g.id and user_id = g.player_a;
  select data->'picks'->>(i::text) into pb from game_secrets where game_id = g.id and user_id = g.player_b;
  same := pa is not null and pa = pb;
  n := jsonb_array_length(g.state->'qs');
  g.state := jsonb_set(g.state, '{picks}', (g.state->'picks') || jsonb_build_array(jsonb_build_array(pa, pb)));
  g.state := jsonb_set(g.state, '{i}', to_jsonb(i + 1));
  g.state := jsonb_set(g.state, '{reveal_until}', to_jsonb(now() + interval '2500 milliseconds'));
  if same then g.state := jsonb_set(g.state, '{alike}', to_jsonb((g.state->>'alike')::int + 1)); end if;
  update games set state = g.state,
    score_a = (g.state->>'alike')::int, score_b = (g.state->>'alike')::int,
    deadline_at = now() + public.game_idle()
  where id = g.id;
  if i + 1 >= n then
    update games set deadline_at = null where id = g.id;
    perform public.game_finish(g.id);
  end if;
end $$;

create or replace function public.submit_truths(p_game uuid, p_lines text[], p_lie int) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  me text;
  la jsonb; lb jsonb;
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid) and kind = 'truths' for update;
  if not found or g.status <> 'active' or g.state->>'phase' <> 'write' then return; end if;
  if coalesce(array_length(p_lines, 1), 0) <> 3 or p_lie not between 0 and 2 then raise exception 'Write three lines and pick the lie'; end if;
  if exists (select 1 from unnest(p_lines) l where char_length(btrim(l)) not between 2 and 120) then
    raise exception 'Each line needs a few words (up to 120 letters)';
  end if;
  me := case when uid = g.player_a then 'a' else 'b' end;
  update game_secrets set data = data || jsonb_build_object('lines', to_jsonb(array(select btrim(l) from unnest(p_lines) l)), 'lie', p_lie)
  where game_id = g.id and user_id = uid;
  -- Keep your truths so you can use them again in later games
  insert into user_truths (user_id, body, uses, last_used_at)
  select uid, btrim(l), 1, now() from unnest(p_lines) with ordinality as x(l, n)
  where x.n - 1 <> p_lie
  on conflict (user_id, lower(body)) do update set uses = user_truths.uses + 1, last_used_at = now();
  g.state := jsonb_set(g.state, array['ready_' || me], 'true'::jsonb);
  update games set state = g.state where id = g.id;
  if (g.state->>'ready_a')::boolean is true and (g.state->>'ready_b')::boolean is true then
    select data->'lines' into la from game_secrets where game_id = g.id and user_id = g.player_a;
    select data->'lines' into lb from game_secrets where game_id = g.id and user_id = g.player_b;
    update games set state = state || jsonb_build_object('phase', 'guess', 'lines_a', la, 'lines_b', lb),
      deadline_at = now() + public.game_idle()
    where id = g.id;
  end if;
end $$;

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
      'pause_until', now() + interval '3 seconds');
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
  elsif g.kind = 'c4' then
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
revoke all on function public.game_begin(uuid) from public, anon, authenticated;
revoke all on function public.game_tot_reveal(uuid) from public, anon, authenticated;
revoke all on function public.game_c4_move(uuid, int, boolean) from public, anon, authenticated;
