-- Dashpad update: one chat once you unmask (Part 79)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- When you unmask with someone, any other masked chat you have with them (your Masquerade pair,
-- a chat from Meet or a wave) ends and its messages move into your normal chat, so you see who
-- it was. A Masquerade chat no longer asks you to pay to reopen it after you've unmasked.
-- Voice notes keep playing after they move (until their 24 hours are up).
-- People's ages now show in masked chats too.

-- Copy a masked chat's messages into a normal chat (voice notes stay voice notes)
create or replace function public.move_masked_messages(p_session uuid, p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into messages (match_id, sender_id, kind, body, media_meta, media_path, created_at)
  select p_match, sender_id,
    case when kind in ('gift', 'game', 'audio') then kind else 'text' end,
    case when kind in ('icebreaker', 'meet') then '💬 ' || body when kind = 'audio' then '' else body end,
    case when kind = 'gift' then jsonb_build_object('gift', body) when kind in ('game', 'audio') then media_meta else null end,
    -- A disguised voice note plays from the media store (it's still deleted after 24 hours)
    case when kind = 'audio' then 'r2:' || coalesce(media_meta->>'key', 'expired') end,
    created_at
  from masquerade_messages where session_id = p_session and kind <> 'system' order by id;
  delete from masquerade_messages where session_id = p_session;
  update matches set last_message_at = greatest(last_message_at, now()) where id = p_match;
end $$;

-- Two people are now connected: every other masked chat between them (still going, or ended
-- but still there) is closed and moved into their normal chat
create or replace function public.merge_pair_chats(p_a uuid, p_b uuid, p_match uuid, p_except uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select s.id from masquerade_sessions s
    where ((s.user_a = p_a and s.user_b = p_b) or (s.user_a = p_b and s.user_b = p_a))
      and s.id is distinct from p_except
      and s.status in ('active', 'lapsed', 'ended')
      and s.match_id is null
      and (s.status <> 'ended' or exists (select 1 from masquerade_messages m where m.session_id = s.id))
    for update
  loop
    perform public.move_masked_messages(r.id, p_match);
    update masquerade_sessions set status = 'matched', match_id = p_match, ended_reason = 'merged' where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

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

    perform public.move_masked_messages(s.id, mid);
    update masquerade_sessions set status = 'matched', match_id = mid where id = s.id;
    -- Any other masked chat you two have going (Masquerade, Meet, a wave) joins this chat too
    perform public.merge_pair_chats(s.user_a, s.user_b, mid, s.id);
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

create or replace function public.masked_voice_deleted(p_keys text[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update masquerade_messages m set media_meta = coalesce(m.media_meta, '{}'::jsonb) - 'key' || '{"expired": true}'::jsonb
  from masked_voice mv
  where mv.key = any(p_keys) and mv.message_id = m.id;
  -- Voice notes moved into a normal chat when you unmasked
  update messages m set media_meta = coalesce(m.media_meta, '{}'::jsonb) - 'key' || '{"expired": true}'::jsonb
  where m.kind = 'audio' and m.media_meta->>'key' = any(p_keys);
  update masked_voice set deleted_at = now() where key = any(p_keys) and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.move_masked_messages(uuid, uuid) from public, anon, authenticated;
revoke all on function public.merge_pair_chats(uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- Fix chats already caught in this: people who unmasked while another masked chat was still open
do $$
declare r record;
begin
  for r in select distinct on (s.match_id) s.user_a, s.user_b, s.match_id, s.id from masquerade_sessions s
           where s.status = 'matched' and s.match_id is not null and coalesce(s.ended_reason, '') <> 'merged'
           order by s.match_id, s.started_at desc
  loop
    perform public.merge_pair_chats(r.user_a, r.user_b, r.match_id, r.id);
  end loop;
end $$;

-- Ages show in masked chats too (small, next to whether they're a man or a woman)
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
      -- Their age shows (small) in masked chats too
      'age', public.age_years(op.birthdate),
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
