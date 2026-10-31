-- Break the ice, and how well you match.
--
-- 1. Icebreakers: instead of a plain wave, people break the ice with someone they've never met:
--    reply to one of their "Things about me" cards, ask a This or That, send a short voice hello,
--    or challenge them to a game. The other person answers (and a masked chat opens) or says
--    not now. Each kind has its own price in Admin → Prices, with a few free each day. Keys come
--    back if they don't answer in time (2 days, or 30 minutes for a game) or say not now.
-- 2. Explore: each person now comes with a match % (0 to 100), how far away they are, and an
--    interest to show (one you share first).
--
-- Run once in Supabase (SQL Editor → New query → paste → Run), after 105_meet_fit_first.sql.

create table if not exists public.ice_breaks (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles on delete cascade,
  to_user uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('card', 'this', 'voice', 'game')),
  -- The mask name the sender gets if it turns into a chat
  alias text not null,
  -- card: their card you replied to ({p, a}); this: the question ({q, a, b}) and your pick
  thing jsonb,
  question jsonb,
  pick text check (pick in ('a', 'b')),
  body text check (char_length(body) <= 300),
  voice_key text,
  voice_seconds int,
  voice_style text,
  game text check (game in ('whot', 'xo', 'ludo', 'tot')),
  paid int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'answered', 'declined', 'expired')),
  answer text check (char_length(answer) <= 300),
  answer_pick text check (answer_pick in ('a', 'b')),
  session_id uuid references public.masquerade_sessions on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  answered_at timestamptz
);
create index if not exists ice_breaks_to on public.ice_breaks (to_user, status, created_at desc);
create index if not exists ice_breaks_from on public.ice_breaks (from_user, created_at desc);
alter table public.ice_breaks enable row level security;
drop policy if exists "read my icebreakers" on public.ice_breaks;
create policy "read my icebreakers" on public.ice_breaks for select using (from_user = auth.uid() or to_user = auth.uid());
do $$ begin
  alter publication supabase_realtime add table public.ice_breaks;
exception when duplicate_object then null; end $$;

-- Prices (change them in Admin → Prices). Free ones each day cover cards, This or That and voice.
insert into public.app_settings (key, value) values
  ('ice_free_per_day', 3), ('ice_cost_card', 2), ('ice_cost_this', 2), ('ice_cost_voice', 3), ('ice_cost_game', 1)
on conflict (key) do nothing;

-- Icebreakers that ran out: Keys back to the sender
create or replace function public.ice_expire(p_user uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare r ice_breaks; n int := 0;
begin
  for r in
    update ice_breaks set status = 'expired'
    where status = 'pending' and expires_at <= now()
      and (p_user is null or from_user = p_user or to_user = p_user)
    returning *
  loop
    if r.paid > 0 then perform public.add_keys(r.from_user, r.paid, 'icebreaker_refund', r.id::text); end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.ice_expire(uuid) from public, anon, authenticated;

-- How many free ones you have left today (Lagos time), and what each kind costs
create or replace function public.ice_free_left(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, public.setting_int('ice_free_per_day', 3) - (
    select count(*)::int from ice_breaks
    where from_user = uid and kind <> 'game' and paid = 0
      and created_at >= (date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos')))
$$;
revoke execute on function public.ice_free_left(uuid) from public, anon, authenticated;

-- What the icebreaker sheet needs: prices, free ones left, and whether one is already waiting
create or replace function public.ice_status(p_to uuid) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please log in'; end if;
  perform public.ice_expire(uid);
  return json_build_object(
    'free_left', public.ice_free_left(uid),
    'free_per_day', public.setting_int('ice_free_per_day', 3),
    'prices', json_build_object(
      'card', public.setting_int('ice_cost_card', 2), 'this', public.setting_int('ice_cost_this', 2),
      'voice', public.setting_int('ice_cost_voice', 3), 'game', public.setting_int('ice_cost_game', 1)),
    'sent', (select json_build_object('id', id, 'kind', kind, 'expires_at', expires_at) from ice_breaks
             where from_user = uid and to_user = p_to and status = 'pending' order by created_at desc limit 1),
    'received', (select id from ice_breaks where from_user = p_to and to_user = uid and status = 'pending' limit 1)
  );
end $$;
revoke execute on function public.ice_status(uuid) from public, anon;
grant execute on function public.ice_status(uuid) to authenticated;

-- Break the ice with someone you've never met
create or replace function public.ice_send(
  p_to uuid, p_kind text, p_body text default null, p_thing jsonb default null, p_question jsonb default null,
  p_pick text default null, p_voice_key text default null, p_voice_seconds int default null, p_voice_style text default null,
  p_game text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  them profiles;
  sid uuid;
  mid uuid;
  cost int;
  body text := nullif(btrim(coalesce(p_body, '')), '');
  r ice_breaks;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if p_to is null or p_to = uid then raise exception 'Not available'; end if;
  perform public.ice_expire(uid);
  if not public.explore_visible(uid, p_to) then raise exception 'Not available'; end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  -- Already talking: go to that chat instead
  mid := public.explore_match_id(uid, p_to);
  if mid is not null then return json_build_object('kind', 'match', 'id', mid); end if;
  select id into sid from masquerade_sessions
  where source = 'explore' and status = 'active' and ((user_a = uid and user_b = p_to) or (user_a = p_to and user_b = uid))
  order by started_at desc limit 1;
  if sid is not null then return json_build_object('kind', 'masked', 'id', sid); end if;
  if exists (select 1 from ice_breaks where from_user = uid and to_user = p_to and status = 'pending') then
    raise exception 'You already broke the ice with them. Wait for their answer';
  end if;
  if exists (select 1 from ice_breaks where from_user = p_to and to_user = uid and status = 'pending') then
    raise exception 'They already broke the ice with you. Answer them in Chats → Icebreakers';
  end if;
  if (select count(*) from ice_breaks where from_user = uid and created_at > now() - interval '24 hours') >= 40 then
    raise exception 'That''s a lot of icebreakers today. Try again tomorrow';
  end if;
  select * into them from profiles where id = p_to;

  -- What you're sending must make sense for its kind
  if p_kind = 'card' then
    if body is null or char_length(body) > 160 then raise exception 'Write a reply (up to 160 characters)'; end if;
    if p_thing is null or not exists (select 1 from jsonb_array_elements(coalesce(them.things, '[]'::jsonb)) t
                                      where t->>'p' = p_thing->>'p' and t->>'a' = p_thing->>'a') then
      raise exception 'That card isn''t on their profile any more';
    end if;
  elsif p_kind = 'this' then
    if p_question is null or coalesce(btrim(p_question->>'q'), '') = '' or coalesce(btrim(p_question->>'a'), '') = '' or coalesce(btrim(p_question->>'b'), '') = ''
       or char_length(p_question->>'q') > 120 or char_length(p_question->>'a') > 60 or char_length(p_question->>'b') > 60 then
      raise exception 'Pick a question';
    end if;
    if p_pick not in ('a', 'b') then raise exception 'Pick your answer first'; end if;
    if body is not null and char_length(body) > 160 then raise exception 'Keep it short'; end if;
  elsif p_kind = 'voice' then
    if p_voice_key is null or p_voice_key not like 'ice/' || uid::text || '/%' or p_voice_key like '%..%' then raise exception 'Not allowed'; end if;
    if coalesce(p_voice_seconds, 0) < 1 or p_voice_seconds > 16 then raise exception 'Voice hellos are up to 15 seconds'; end if;
  elsif p_kind = 'game' then
    if p_game not in ('whot', 'xo', 'ludo', 'tot') then raise exception 'Pick a game'; end if;
    if public.setting_int('game_' || p_game, 1) = 0 then raise exception 'This game is taking a break. Try another one.'; end if;
    if body is not null and char_length(body) > 160 then raise exception 'Keep it short'; end if;
  else
    raise exception 'Not available';
  end if;

  -- The price: a few free each day (not games), then each kind's own price
  cost := case when p_kind = 'game' then public.setting_int('ice_cost_game', 1)
               when public.ice_free_left(uid) > 0 then 0
               else public.setting_int('ice_cost_' || p_kind, 2) end;
  if cost > 0 then perform public.spend_keys(uid, cost, 'icebreaker', p_to::text); end if;

  insert into ice_breaks (from_user, to_user, kind, alias, thing, question, pick, body, voice_key, voice_seconds, voice_style, game, paid, expires_at)
  values (uid, p_to, p_kind, public.random_alias(), case when p_kind = 'card' then p_thing end,
          case when p_kind = 'this' then jsonb_build_object('q', btrim(p_question->>'q'), 'a', btrim(p_question->>'a'), 'b', btrim(p_question->>'b')) end,
          case when p_kind = 'this' then p_pick end, body,
          case when p_kind = 'voice' then p_voice_key end, case when p_kind = 'voice' then p_voice_seconds end,
          case when p_kind = 'voice' then left(coalesce(p_voice_style, ''), 20) end,
          case when p_kind = 'game' then p_game end, cost,
          now() + case when p_kind = 'game' then interval '30 minutes' else interval '48 hours' end)
  returning * into r;
  -- Breaking the ice means you looked
  insert into profile_views (viewer, target, seen_at) values (uid, p_to, now())
  on conflict (viewer, target) do update set seen_at = now();
  return json_build_object('kind', 'sent', 'id', r.id, 'paid', cost, 'free_left', public.ice_free_left(uid), 'expires_at', r.expires_at);
end $$;
revoke execute on function public.ice_send(uuid, text, text, jsonb, jsonb, text, text, int, text, text) from public, anon;
grant execute on function public.ice_send(uuid, text, text, jsonb, jsonb, text, text, int, text, text) to authenticated;

-- Answer an icebreaker: your masked chat opens (and a game starts, for a game challenge)
create or replace function public.ice_answer(p_id uuid, p_text text default null, p_pick text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r ice_breaks;
  a profiles;
  b profiles;
  sid uuid;
  gid uuid;
  alias_b text;
  lvl smallint;
  txt text := nullif(btrim(coalesce(p_text, '')), '');
  q jsonb;
  mid bigint;
begin
  if uid is null then raise exception 'Please log in'; end if;
  perform public.ice_expire(uid);
  select * into r from ice_breaks where id = p_id and to_user = uid for update;
  if not found then raise exception 'Not found'; end if;
  if r.status = 'answered' and r.session_id is not null then return json_build_object('session_id', r.session_id); end if;
  if r.status <> 'pending' then raise exception 'This icebreaker ran out'; end if;
  if txt is not null and char_length(txt) > 300 then raise exception 'Keep it short'; end if;
  if r.kind in ('card', 'voice') and txt is null then raise exception 'Write a reply'; end if;
  if r.kind = 'this' and p_pick not in ('a', 'b') then raise exception 'Pick your answer'; end if;

  select * into a from profiles where id = r.from_user;
  select * into b from profiles where id = uid;
  alias_b := public.random_alias(r.alias);
  lvl := round((coalesce(a.pref_spice, 1) + coalesce(b.pref_spice, 1)) / 2.0)::smallint;
  -- The sender found you on Explore, so the chat works like one started from Meet
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, source)
  values (r.from_user, uid, a.pref_intent, coalesce(a.pref_spice, 1), coalesce(b.pref_spice, 1), lvl, r.alias, alias_b, now(), 'infinity', 'explore')
  returning id into sid;
  insert into masquerade_messages (session_id, kind, body)
  values (sid, 'system', r.alias || ' broke the ice and ' || alias_b || ' answered. You''re both masked until you both unmask.');

  if r.kind = 'card' then
    insert into masquerade_messages (session_id, kind, body)
    values (sid, 'system', 'Replying to "' || left(coalesce((select text from thing_prompts where id = r.thing->>'p'), 'Things about me'), 80) || ' ' || left(r.thing->>'a', 120) || '"');
    insert into masquerade_messages (session_id, sender_id, kind, body) values (sid, r.from_user, 'text', r.body);
  elsif r.kind = 'this' then
    q := r.question;
    insert into masquerade_messages (session_id, kind, body)
    values (sid, 'system', 'This or That: ' || (q->>'q') || ' ' || r.alias || ' picked ' || (q->>r.pick) || ', ' || alias_b || ' picked ' || (q->>p_pick) || '.'
            || case when r.pick = p_pick then ' Same pick! 🎉' else '' end);
    if r.body is not null then insert into masquerade_messages (session_id, sender_id, kind, body) values (sid, r.from_user, 'text', r.body); end if;
  elsif r.kind = 'voice' then
    insert into masquerade_messages (session_id, sender_id, kind, body, media_meta)
    values (sid, r.from_user, 'audio', 'Voice note', json_build_object('key', r.voice_key, 'duration', r.voice_seconds, 'voice', coalesce(nullif(r.voice_style, ''), 'deep'))::jsonb)
    returning id into mid;
    insert into masked_voice (key, session_id, sender_id, message_id) values (r.voice_key, sid, r.from_user, mid) on conflict (key) do nothing;
  elsif r.kind = 'game' then
    if r.body is not null then insert into masquerade_messages (session_id, sender_id, kind, body) values (sid, r.from_user, 'text', r.body); end if;
  end if;
  if txt is not null then insert into masquerade_messages (session_id, sender_id, kind, body) values (sid, uid, 'text', txt); end if;

  -- A game challenge: start it straight away
  if r.kind = 'game' then
    insert into games (kind, session_id, player_a, player_b, deadline_at)
    values (r.game, sid, r.from_user, uid, now() + interval '30 seconds')
    returning id into gid;
    perform public.game_begin(gid);
  end if;

  update ice_breaks set status = 'answered', answered_at = now(), session_id = sid, answer = txt, answer_pick = case when r.kind = 'this' then p_pick end
  where id = r.id;
  return json_build_object('session_id', sid, 'game_id', gid);
end $$;
revoke execute on function public.ice_answer(uuid, text, text) from public, anon;
grant execute on function public.ice_answer(uuid, text, text) to authenticated;

-- Not now: it goes away, and the sender gets their Keys back
create or replace function public.ice_decline(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r ice_breaks;
begin
  update ice_breaks set status = 'declined', answered_at = now()
  where id = p_id and to_user = uid and status = 'pending'
  returning * into r;
  if found and r.paid > 0 then perform public.add_keys(r.from_user, r.paid, 'icebreaker_refund', r.id::text); end if;
end $$;
revoke execute on function public.ice_decline(uuid) from public, anon;
grant execute on function public.ice_decline(uuid) to authenticated;

-- Chats → Icebreakers: ones waiting for you, and ones you sent
create or replace function public.my_ice_breaks() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return null; end if;
  perform public.ice_expire(uid);
  return json_build_object(
    'received', coalesce((
      select json_agg(json_build_object(
        'id', i.id, 'alias', i.alias, 'age', public.shown_age(p.birthdate, p.hide_age, p.id), 'gender', p.gender,
        'kind', i.kind, 'thing', i.thing, 'question', i.question, 'body', i.body,
        'voice_key', i.voice_key, 'voice_seconds', i.voice_seconds, 'game', i.game,
        'created_at', i.created_at, 'expires_at', i.expires_at) order by i.created_at desc)
      from ice_breaks i join profiles p on p.id = i.from_user
      where i.to_user = uid and i.status = 'pending' and not public.is_blocked(i.from_user, uid)), '[]'::json),
    'sent', coalesce((
      select json_agg(json_build_object(
        'id', i.id, 'to', p.id, 'name', p.display_name, 'photo', p.photos[1], 'kind', i.kind, 'status', i.status,
        'paid', i.paid, 'session_id', i.session_id, 'created_at', i.created_at, 'expires_at', i.expires_at) order by i.created_at desc)
      from (select * from ice_breaks where from_user = uid order by created_at desc limit 20) i join profiles p on p.id = i.to_user), '[]'::json)
  );
end $$;
revoke execute on function public.my_ice_breaks() from public, anon;
grant execute on function public.my_ice_breaks() to authenticated;

-- The Chats dot counts icebreakers waiting for you
create or replace function public.menu_badges() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'chats', public.unread_chats(),
    'event_chats', public.unread_event_chats(),
    'feed_chats', public.unread_feed_chats(),
    'masked', public.unread_masked_chats(),
    'event', public.next_event(),
    'ice', (select count(*) from ice_breaks where to_user = auth.uid() and status = 'pending' and expires_at > now())
  )
$$;

-- Explore: the same order as before, now with a match %, distance and an interest for each person
create or replace function public.explore_people(p_q text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  me profiles;
  my_age int;
  mlat double precision;
  mlng double precision;
  q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into me from profiles where id = uid;
  my_age := public.age_years(me.birthdate);
  select lat, lng into mlat, mlng from accounts_private where user_id = uid;
  return json_build_object(
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    'people', coalesce((
      select json_agg(row_to_json(t) order by t.rank) from (
        -- What they're in the mood for only shows in your chat
        select s.id, s.name, case when s.hide_age then null else s.age end as age,
          s.gender, s.photo, s.place, null::text as intent, s.online,
          s.connected,
          -- How well you match, 0 to 100, how far away they are, and an interest to show (yours first)
          least(100, greatest(0, round(s.fit)))::int as match,
          case when s.km is not null then greatest(1, round(s.km))::int end as km,
          coalesce((select x from unnest(s.interests) x where x = any(me.interests) limit 1), s.interests[1]) as tag,
          -- People you've already unmasked with don't take the top spots: new people come first
          row_number() over (order by s.score - case when s.connected then 60 else 0 end desc, s.km asc nulls last, s.last_seen_at desc) as rank
        from (
          select c.*, public.explore_match_id(uid, c.id) is not null as connected,
            -- The match %: gender both ways 25 (only yours 10), same mood 20, each other's age 10 + 10,
            -- shared interests up to 15, shared words in "Things about me" up to 10, closeness up to 10
            (case when public.gender_fits(me.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, me.gender) then 25
                  when public.gender_fits(me.pref_seeking, c.gender) then 10 else 0 end)
            + (case when c.pref_intent = me.pref_intent then 20 else 0 end)
            + (case when c.age between me.pref_age_min and me.pref_age_max then 10 else 0 end)
            + (case when my_age between c.pref_age_min and c.pref_age_max then 10 else 0 end)
            + least(public.shared_count(me.interests, c.interests), 5) * 3
            + least(public.shared_count(me.thing_keys, c.thing_keys), 5) * 2
            + (case when c.km is not null then greatest(0, 10 - c.km / 10)
                    when c.place_country = me.place_country and c.place_region = me.place_region then 7
                    when c.place_country = me.place_country then 3 else 0 end)
            as fit,
            (case when q is not null and lower(c.name) = lower(q) then 1000 else 0 end)
            -- How well you fit each other: these count far more than everything below (which adds
            -- up to about 110 at most), so people who fit your gender, mood and age always come
            -- first. Nobody is left out; people who fit less just come later.
            + (case when public.gender_fits(me.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, me.gender) then 200
                    when public.gender_fits(me.pref_seeking, c.gender) then 80 else 0 end)
            + (case when c.pref_intent = me.pref_intent then 150 else 0 end)
            + (case when c.age between me.pref_age_min and me.pref_age_max then 130 else 0 end)
            + (case when my_age between c.pref_age_min and c.pref_age_max then 120 else 0 end)
            -- How close they are
            + (case when c.km is not null then greatest(0, 20 - c.km / 5)
                    when c.place_country = me.place_country and c.place_region = me.place_region then 14
                    when c.place_country = me.place_country then 6 else 0 end)
            -- What you share, and whether they're around
            + least(public.shared_count(me.interests, c.interests), 5) * 3
            -- Words you both used in your "things about me" (jollof, arsenal, afrobeats…)
            + least(public.shared_count(me.thing_keys, c.thing_keys), 5) * 4
            -- Who's around: online now first, then how recently they were in the app
            + (case when c.online then 25 when c.last_seen_at > now() - interval '1 hour' then 12
                    when c.last_seen_at > now() - interval '1 day' then 6 when c.last_seen_at > now() - interval '7 days' then 2 else 0 end)
            -- Most likely to reply (stored per person, refreshed every few hours): how fast, how often, how active
            + (case when c.reply_s is null then 0 when c.reply_s < 120 then 10 when c.reply_s < 600 then 6 when c.reply_s < 3600 then 3 else 0 end)
            + coalesce(c.reply_rate, 0.5) * 10
            + least(coalesce(c.sent_7d, 0), 60) / 6.0
            as score
          from (
            select p.id, p.display_name as name, public.age_years(p.birthdate) as age, p.hide_age, p.gender, p.photos[1] as photo,
              p.place_label as place, p.place_country, p.place_region, p.pref_seeking, p.pref_intent,
              p.pref_age_min, p.pref_age_max, p.interests, p.thing_keys, p.last_seen_at,
              (p.last_seen_at > now() - interval '150 seconds') as online,
              public.distance_km(mlat, mlng, a.lat, a.lng) as km,
              rs.seconds as reply_s, rs.reply_rate, rs.sent_7d
            from (
              -- Search looks at everyone; otherwise the most recently active people
              select * from profiles p0
              where case when q is not null then p0.display_name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%'
                         else p0.last_seen_at > now() - interval '30 days' end
              order by p0.last_seen_at desc nulls last
              limit 600
            ) p
            left join accounts_private a on a.user_id = p.id
            left join reply_stats rs on rs.user_id = p.id
            where public.explore_visible(uid, p.id)
          ) c
        ) s
        order by rank
        limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
      ) t), '[]'::json)
  );
end $function$;
