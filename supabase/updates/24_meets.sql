-- Dashpad update: Meets (Part 24)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 24: Meets
-- Post a game challenge or a line of text for a few hours (3 by default).
-- People whose Masquerade settings fit yours (and yours fit theirs) see it and
-- tap Meet: a masked chat opens with you, the same as an hourly pair.
-- Game meets: people wait their turn and play you one at a time.
-- Your first post is free, then it costs Keys (both set in admin). No refunds.
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value) values
  ('meet_cost', 10),
  ('meet_free_posts', 1),
  ('meet_hours', 3)
on conflict (key) do nothing;

create table if not exists public.meet_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('game', 'text')),
  game text check (game in ('truths', 'tot', 'c4', 'words')),
  body text not null default '' check (char_length(body) <= 140),
  alias text not null,
  paid int not null default 0,
  created_at timestamptz not null default now(),
  ends_at timestamptz not null,
  closed_at timestamptz,
  check ((kind = 'game') = (game is not null)),
  check (kind = 'game' or char_length(btrim(body)) > 0)
);
create index if not exists meet_posts_live on public.meet_posts (ends_at);
create index if not exists meet_posts_user on public.meet_posts (user_id, created_at desc);
alter table public.meet_posts enable row level security;
drop policy if exists "read own meets" on public.meet_posts;
create policy "read own meets" on public.meet_posts for select using (user_id = auth.uid());

-- A masked chat opened from a meet (user_a is the person who posted it)
alter table public.masquerade_sessions add column if not exists meet_id uuid references public.meet_posts on delete set null;
create index if not exists masquerade_sessions_meet on public.masquerade_sessions (meet_id);
create unique index if not exists masquerade_sessions_meet_once on public.masquerade_sessions (meet_id, user_b) where meet_id is not null;

-- The post itself sits at the top of the chat
alter table public.masquerade_messages drop constraint if exists masquerade_messages_kind_check;
alter table public.masquerade_messages add constraint masquerade_messages_kind_check check (kind in ('text', 'icebreaker', 'gift', 'system', 'game', 'meet'));

-- Your settings fit theirs and theirs fit yours
create or replace function public.meet_fits(v uuid, o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select v <> o and exists (
    select 1 from profiles a, profiles b
    where a.id = v and b.id = o
      and a.gender is not null and b.gender is not null and a.birthdate is not null and b.birthdate is not null
      and a.pref_intent = b.pref_intent
      and public.gender_fits(a.pref_seeking, b.gender) and public.gender_fits(b.pref_seeking, a.gender)
      and public.age_years(b.birthdate) between a.pref_age_min and a.pref_age_max
      and public.age_years(a.birthdate) between b.pref_age_min and b.pref_age_max)
    and not public.is_blocked(v, o)
    and not public.already_matched(v, o)
$$;

-- Event rounds are the only chats that keep you busy (hourly pairs and meets run alongside)
create or replace function public.my_active_session(uid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from masquerade_sessions
  where status = 'active' and (user_a = uid or user_b = uid) and hour_at is null and meet_id is null
  order by started_at desc limit 1
$$;

-- Meet chats end like hourly pairs: when the meet is over, a chat you both talked in is kept to decide later
create or replace function public.finalize_masquerade(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s masquerade_sessions;
  mid uuid;
  talked boolean;
begin
  select * into s from masquerade_sessions where id = p_session for update;
  if not found or s.status not in ('active', 'lapsed') then return; end if;

  if s.unmask_a is true and s.unmask_b is true then
    insert into matches (user_a, user_b, session_id, intent)
    values (least(s.user_a, s.user_b), greatest(s.user_a, s.user_b), s.id, s.intent)
    on conflict (user_a, user_b) do update set session_id = excluded.session_id
    returning id into mid;

    insert into messages (match_id, sender_id, kind, body, media_meta, created_at)
    select mid, sender_id,
      case when kind in ('gift', 'game') then kind else 'text' end,
      case when kind in ('icebreaker', 'meet') then '💬 ' || body else body end,
      case when kind = 'gift' then jsonb_build_object('gift', body) when kind = 'game' then media_meta else null end,
      created_at
    from masquerade_messages where session_id = s.id and kind <> 'system' order by id;

    update masquerade_sessions set status = 'matched', match_id = mid where id = s.id;
    delete from masquerade_messages where session_id = s.id;
    return;
  end if;

  if s.unmask_a is false or s.unmask_b is false then
    update masquerade_sessions set status = 'ended', ended_reason = coalesce(ended_reason, 'declined') where id = s.id;
    delete from masquerade_messages where session_id = s.id;
    return;
  end if;

  -- Hourly pairs and meet chats: when the time is over
  if s.hour_at is not null or s.meet_id is not null then
    if s.status = 'active' and now() >= s.ends_at then
      talked := (exists (select 1 from masquerade_messages m where m.session_id = s.id and m.kind in ('text', 'gift') and m.sender_id = s.user_a)
             and exists (select 1 from masquerade_messages m where m.session_id = s.id and m.kind in ('text', 'gift') and m.sender_id = s.user_b))
             or exists (select 1 from games g where g.session_id = s.id and g.status = 'done');
      if talked then
        update masquerade_sessions set status = 'lapsed' where id = s.id;
      else
        update masquerade_sessions set status = 'ended', ended_reason = 'quiet' where id = s.id;
        delete from masquerade_messages where session_id = s.id;
      end if;
    end if;
    return;
  end if;

  -- Event rounds: time ran out without both deciding
  if now() > s.ends_at + interval '90 seconds' then
    update masquerade_sessions set status = 'ended', ended_reason = coalesce(ended_reason, 'timeout') where id = s.id;
    delete from masquerade_messages where session_id = s.id;
  end if;
end $$;

-- Unmask or let go. Hourly pairs and meet chats can decide any time.
create or replace function public.vote_unmask(p_session uuid, p_unmask boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then raise exception 'Chat not found'; end if;
  if s.status not in ('active', 'lapsed') then return; end if;
  if p_unmask and s.hour_at is null and s.meet_id is null and now() < s.ends_at - interval '2 seconds' then
    raise exception 'You can unmask when the timer ends';
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

-- Games are allowed in meet chats too
create or replace function public.game_chat_ok(uid uuid, p_session uuid, p_match uuid, out other uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  s masquerade_sessions;
  m matches;
begin
  other := null;
  if p_session is not null then
    select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
    if not found or (s.hour_at is null and s.meet_id is null) or s.status <> 'active' or now() >= s.ends_at then return; end if;
    other := case when s.user_a = uid then s.user_b else s.user_a end;
  elsif p_match is not null then
    select * into m from matches where id = p_match and (user_a = uid or user_b = uid);
    if not found then return; end if;
    other := case when m.user_a = uid then m.user_b else m.user_a end;
  end if;
  if other is not null and public.is_blocked(uid, other) then other := null; end if;
end $$;
revoke all on function public.game_chat_ok(uuid, uuid, uuid) from public, anon, authenticated;

-- Is this a game meet chat whose turn in line hasn't been played yet?
create or replace function public.meet_turn_pending(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from masquerade_sessions s join meet_posts m on m.id = s.meet_id
    where s.id = p_session and m.kind = 'game'
      and not exists (select 1 from games g where g.session_id = s.id and g.started_at is not null))
$$;

-- Starting a game in a chat. In a game meet, the first game comes from the line.
create or replace function public.start_game(p_kind text, p_session uuid default null, p_match uuid default null, p_rematch uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  other uuid;
  live games;
  gid uuid;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if p_kind not in ('truths', 'tot', 'c4', 'words') then raise exception 'Unknown game'; end if;
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

-- Game meets: when the person who posted is free, the next person in line challenges them.
-- People who have waited longest go first; someone whose turn ran out goes to the back.
create or replace function public.meet_queue_next(p_meet uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m meet_posts;
  nxt masquerade_sessions;
begin
  perform pg_advisory_xact_lock(hashtext('meet:' || p_meet::text));
  select * into m from meet_posts where id = p_meet;
  if not found or m.kind <> 'game' then return; end if;

  update games g set status = 'expired', ended_at = now(), deadline_at = null
  from masquerade_sessions s
  where s.id = g.session_id and s.meet_id = p_meet and g.status = 'invited' and g.deadline_at < now();

  if exists (select 1 from games g join masquerade_sessions s on s.id = g.session_id
             where s.meet_id = p_meet and g.status in ('invited', 'active')) then
    return;
  end if;

  select s.* into nxt from masquerade_sessions s
  where s.meet_id = p_meet and s.status = 'active' and now() < s.ends_at
    and not public.is_blocked(s.user_a, s.user_b)
    and not exists (select 1 from games g where g.session_id = s.id
                    and (g.started_at is not null or g.status in ('declined', 'cancelled', 'invited', 'active')))
  order by (select max(g.created_at) from games g where g.session_id = s.id) nulls first, s.started_at
  limit 1;
  if not found then return; end if;

  insert into games (kind, session_id, player_a, player_b, deadline_at)
  values (m.game, nxt.id, nxt.user_b, m.user_id, now() + interval '60 seconds');
end $$;
revoke all on function public.meet_queue_next(uuid) from public, anon, authenticated;

-- Move the line along when a game ends or a meet chat closes
create or replace function public.meet_games_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.status = old.status or new.status in ('invited', 'active') or new.session_id is null then return new; end if;
  select meet_id into mid from masquerade_sessions where id = new.session_id;
  if mid is not null then perform public.meet_queue_next(mid); end if;
  return new;
end $$;
drop trigger if exists meet_games_changed on public.games;
create trigger meet_games_changed after update of status on public.games
  for each row execute function public.meet_games_changed();

create or replace function public.meet_session_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.meet_id is not null and new.status <> old.status and old.status = 'active' then
    perform public.meet_queue_next(new.meet_id);
  end if;
  return new;
end $$;
drop trigger if exists meet_session_changed on public.masquerade_sessions;
create trigger meet_session_changed after update of status on public.masquerade_sessions
  for each row execute function public.meet_session_changed();
revoke all on function public.meet_games_changed() from public, anon, authenticated;
revoke all on function public.meet_session_changed() from public, anon, authenticated;

-- Close meet chats whose time is up
create or replace function public.meet_close_expired(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from masquerade_sessions
           where meet_id is not null and status = 'active' and reopened_at is null and ends_at <= now()
             and (user_a = uid or user_b = uid) loop
    perform public.finalize_masquerade(r.id);
  end loop;
end $$;
revoke all on function public.meet_close_expired(uuid) from public, anon, authenticated;

-- What one meet looks like to you
create or replace function public.meet_json(m meet_posts, uid uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', m.id, 'kind', m.kind, 'game', m.game, 'body', m.body, 'alias', m.alias,
    'created_at', m.created_at, 'ends_at', m.ends_at, 'mine', m.user_id = uid,
    'age', public.age_years(p.birthdate), 'gender', p.gender,
    'session_id', (select s.id from masquerade_sessions s where s.meet_id = m.id and s.user_b = uid),
    'people', (select count(*) from masquerade_sessions s where s.meet_id = m.id),
    'waiting', case when m.kind = 'game' and m.user_id = uid then (
      select count(*) from masquerade_sessions s where s.meet_id = m.id and s.status = 'active' and now() < s.ends_at
        and not exists (select 1 from games g where g.session_id = s.id and g.started_at is not null)) end)
  from profiles p where p.id = m.user_id
$$;
revoke all on function public.meet_json(meet_posts, uuid) from public, anon, authenticated;

-- Meets for you: your own live one, and other people's that fit you (closest first)
create or replace function public.list_meets(p_limit int default 30) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  mine meet_posts;
begin
  if uid is null then raise exception 'Please log in'; end if;
  perform public.meet_close_expired(uid);
  select * into me from profiles where id = uid;
  select * into mine from meet_posts where user_id = uid and closed_at is null and ends_at > now()
  order by created_at desc limit 1;

  return json_build_object(
    'server_now', now(),
    'cost', case when (select count(*) from meet_posts where user_id = uid) < public.setting_int('meet_free_posts', 1)
                 then 0 else public.setting_int('meet_cost', 10) end,
    'hours', public.setting_int('meet_hours', 3),
    'mine', case when mine.id is null then null else public.meet_json(mine, uid) end,
    'posts', coalesce((
      select json_agg(public.meet_json(t.mp, uid) order by t.o1 desc nulls last, t.o2 desc nulls last, t.o3 desc nulls last, (t.mp).created_at desc)
      from (
        select m as mp,
          (p.place_country = me.place_country and p.place_region = me.place_region) as o1,
          (p.place_country = me.place_country) as o2,
          (p.place_continent = me.place_continent) as o3
        from meet_posts m
        join profiles p on p.id = m.user_id
        left join accounts_private a on a.user_id = m.user_id
        where m.closed_at is null and m.ends_at > now() and m.user_id <> uid
          and a.banned_at is null
          and public.meet_fits(uid, m.user_id)
        order by o1 desc nulls last, o2 desc nulls last, o3 desc nulls last, m.created_at desc
        limit greatest(1, least(p_limit, 50))
      ) t), '[]'::json)
  );
end $$;

-- Post a meet. Your first ones are free (set in admin), then it costs Keys.
create or replace function public.post_meet(p_kind text, p_game text default null, p_body text default '') returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  b text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  cost int := 0;
  bal int;
  mid uuid;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into me from profiles where id = uid;
  if me.display_name is null or me.birthdate is null or me.gender is null then
    raise exception 'Finish your profile first';
  end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  if p_kind not in ('game', 'text') then raise exception 'Pick a game or write a post'; end if;
  if p_kind = 'game' then
    if p_game is null or p_game not in ('truths', 'tot', 'c4', 'words') then raise exception 'Pick a game'; end if;
    if public.setting_int('game_' || p_game, 1) = 0 then raise exception 'This game is taking a break. Try another one.'; end if;
    if char_length(b) > 80 then raise exception 'Keep your line under 80 characters'; end if;
  else
    p_game := null;
    if char_length(b) = 0 then raise exception 'Write something first'; end if;
    if char_length(b) > 140 then raise exception 'Keep it under 140 characters'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('meet-post:' || uid::text));
  if exists (select 1 from meet_posts where user_id = uid and closed_at is null and ends_at > now()) then
    raise exception 'You already have a meet up';
  end if;

  if (select count(*) from meet_posts where user_id = uid) >= public.setting_int('meet_free_posts', 1) then
    cost := public.setting_int('meet_cost', 10);
  end if;

  insert into meet_posts (user_id, kind, game, body, alias, paid, ends_at)
  values (uid, p_kind, p_game, b, public.random_alias(), cost,
          now() + make_interval(hours => greatest(1, least(public.setting_int('meet_hours', 3), 48))))
  returning id into mid;

  if cost > 0 then
    bal := public.spend_keys(uid, cost, 'meet', mid::text);
  else
    select balance into bal from wallets where user_id = uid;
  end if;
  return json_build_object('id', mid, 'cost', cost, 'balance', coalesce(bal, 0));
end $$;

-- Take your meet down early (no refund)
create or replace function public.close_meet(p_meet uuid) returns void
language sql security definer set search_path = public as $$
  update meet_posts set closed_at = now() where id = p_meet and user_id = auth.uid() and closed_at is null
$$;

-- Tap Meet: open a masked chat with the person who posted it
create or replace function public.join_meet(p_meet uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m meet_posts;
  op profiles;
  me profiles;
  sid uuid;
  lvl smallint;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into m from meet_posts where id = p_meet for update;
  if not found then raise exception 'This meet is gone'; end if;
  select id into sid from masquerade_sessions where meet_id = m.id and user_b = uid;
  if sid is not null then return sid; end if;
  if m.closed_at is not null or m.ends_at <= now() then raise exception 'This meet has ended'; end if;
  if m.user_id = uid then raise exception 'This is your own meet'; end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  if not public.meet_fits(uid, m.user_id) then raise exception 'This meet isn’t open to you'; end if;
  if (select count(*) from masquerade_sessions where user_b = uid and meet_id is not null and started_at > now() - interval '1 minute') >= 6 then
    raise exception 'Slow down a little';
  end if;

  select * into op from profiles where id = m.user_id;
  select * into me from profiles where id = uid;
  lvl := round((op.pref_spice + me.pref_spice) / 2.0)::smallint;
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, meet_id)
  values (m.user_id, uid, op.pref_intent, op.pref_spice, me.pref_spice, lvl, m.alias, public.random_alias(m.alias), now(), m.ends_at, m.id)
  returning id into sid;
  insert into masquerade_messages (session_id, kind, body, media_meta)
  values (sid, 'meet', case when m.body = '' then public.game_title(m.game) else m.body end,
          jsonb_build_object('kind', m.kind, 'game', m.game, 'alias', m.alias));
  if m.kind = 'game' then perform public.meet_queue_next(m.id); end if;
  return sid;
end $$;

-- Your meet chats (as the one who posted or the one who joined), newest first
create or replace function public.my_meet_chats() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return '[]'::json; end if;
  perform public.meet_close_expired(uid);
  return coalesce((
    select json_agg(row_to_json(t) order by t.sort_at desc) from (
      select s.id, s.status, s.ends_at, (s.user_a = uid) as mine, m.kind, m.game, m.body as post,
        case when s.user_a = uid then s.alias_b else s.alias_a end as their_alias,
        case when s.user_a = uid then s.unmask_a else s.unmask_b end as my_vote,
        (select g.status from games g where g.session_id = s.id and g.status in ('invited', 'active') limit 1) as game_status,
        (m.kind = 'game' and not exists (select 1 from games g where g.session_id = s.id and g.started_at is not null)) as in_line,
        (select body from masquerade_messages x where x.session_id = s.id and x.kind = 'text' order by x.id desc limit 1) as last_message,
        coalesce((select max(x.created_at) from masquerade_messages x where x.session_id = s.id), s.started_at) as sort_at
      from masquerade_sessions s
      join meet_posts m on m.id = s.meet_id
      where (s.user_a = uid or s.user_b = uid)
        and (s.status = 'active' or (s.status = 'lapsed' and s.ends_at > now() - interval '24 hours'))
        and not public.is_blocked(s.user_a, s.user_b)
      order by sort_at desc
      limit 40
    ) t), '[]'::json);
end $$;

-- The masked chat, now with what you need to know about its meet
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
  pair := s.hour_at is not null or s.meet_id is not null;
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
    'reopened', s.reopened_at is not null,
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
      'age', public.age_years(op.birthdate),
      'gender', op.gender,
      'interests', op.interests,
      'shared_interests', array(select unnest(op.interests) intersect select unnest(mp.interests)),
      'distance_km', null,
      'place', op.place_label,
      'same_place', op.place_country = mp.place_country and op.place_region = mp.place_region,
      'connections', (select count(*) from matches x where op.id in (x.user_a, x.user_b)),
      'reply_seconds', public.reply_seconds(op.id),
      'has_voted', (case when i_am_a then s.unmask_b else s.unmask_a end) is not null,
      -- Only revealed after you both unmask
      'profile', case when s.status = 'matched' then json_build_object(
        'id', op.id, 'display_name', op.display_name, 'bio', op.bio, 'photos', op.photos
      ) else null end
    )
  );
end $$;
