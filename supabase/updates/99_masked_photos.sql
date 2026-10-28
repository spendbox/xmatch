-- Dashpad update: masked photos (Part 99)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Everyone's photos are masked now. `photos` holds the masked copies (what everyone sees), and
-- `real_photos` the originals, which only go to people you've both unmasked with (your matches).
-- Existing photos become the originals straight away, and people see a plain mask instead
-- until their owner opens Dashpad and masks them (a pop-up does it in a few taps).

alter table public.profiles add column if not exists real_photos text[];
-- Which mask each photo wears: design, colour, trim, and where the face is
alter table public.profiles add column if not exists photo_masks jsonb not null default '[]'::jsonb;

-- Existing photos: keep them as the originals, show a plain mask until they're masked
update public.profiles
set real_photos = photos,
    photos = array_fill('/masked-photo.svg'::text, array[cardinality(photos)])
where real_photos is null and cardinality(coalesce(photos, '{}')) > 0;

-- Photos you upload: masked ones and originals, all in your own folder
CREATE OR REPLACE FUNCTION public.profiles_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  url text;
begin
  if current_user <> 'authenticated' then return new; end if;
  new.id := old.id;
  new.created_at := old.created_at;
  -- Ghost mode is paid for through set_ghost
  new.ghost_on := old.ghost_on;
  new.ghost_until := old.ghost_until;
  -- Online status comes from the app's check-in
  new.last_seen_at := old.last_seen_at;
  -- Matching words always come from the answers
  new.thing_keys := public.thing_keywords(new.things);
  if jsonb_typeof(new.things) <> 'array' or jsonb_array_length(new.things) > 40 or pg_column_size(new.things) > 8000 then
    raise exception 'Too many things';
  end if;
  -- A birthday is set while signing up, and you have to be 18
  if new.birthdate is distinct from old.birthdate then
    if old.birthdate is not null and cardinality(coalesce(old.photos, '{}')) > 0 then
      raise exception 'Your birthday can''t be changed. Contact support if it''s wrong.';
    end if;
    if new.birthdate is null or public.age_years(new.birthdate) < 18 then
      raise exception 'You need to be 18 or older to use Dashpad';
    end if;
  end if;
  -- Photos: up to 6, and only ones uploaded to your own folder on Dashpad (Supabase or R2)
  if cardinality(coalesce(new.photos, '{}')) > 6 then raise exception 'Up to 6 photos'; end if;
  -- The masked photos (what everyone sees) and the originals (only after you both unmask)
  if cardinality(coalesce(new.real_photos, '{}')) > 6 then raise exception 'Up to 6 photos'; end if;
  foreach url in array coalesce(new.photos, '{}') || coalesce(new.real_photos, '{}') loop
    -- (only new ones are checked, so older photos never get in the way; the plain mask is always allowed)
    if url <> '/masked-photo.svg'
       and not (url = any(coalesce(old.photos, '{}') || coalesce(old.real_photos, '{}')))
       and position('/storage/v1/object/public/photos/' || new.id::text || '/' in url) = 0
       -- or Dashpad's own media address (Cloudflare R2), in your folder
       and not (public.media_base() is not null and url like public.media_base() || '/photos/' || new.id::text || '/%') then
      raise exception 'Photos must be uploaded to Dashpad';
    end if;
  end loop;
  if pg_column_size(new.photo_masks) > 20000 then raise exception 'Too much mask data'; end if;
  if cardinality(coalesce(new.interests, '{}')) > 12 then raise exception 'Too many interests'; end if;
  return new;
end $function$;

-- Your matches (you both unmasked) see each other's real photos
CREATE OR REPLACE FUNCTION public.get_matches()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(json_agg(row_to_json(t) order by t.last_message_at desc), '[]'::json) from (
    select m.id, m.created_at, m.last_message_at, m.intent,
      p.id as other_id, p.display_name, coalesce(p.real_photos, p.photos) as photos, public.age_years(p.birthdate) as age,
      public.shared_count(p.interests, (select interests from profiles where id = auth.uid())) as shared,
      l.body as last_message,
      l.sender_id as last_sender,
      l.kind as last_kind,
      (l.deleted_at is not null) as last_deleted,
      public.chat_unread(m, auth.uid()) as unread
    from matches m
    join profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
    left join lateral (
      select x.body, x.sender_id, x.kind, x.deleted_at from messages x where x.match_id = m.id order by x.id desc limit 1
    ) l on true
    where m.user_a = auth.uid() or m.user_b = auth.uid()
  ) t
$function$;

CREATE OR REPLACE FUNCTION public.get_masquerade(p_session uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'online', coalesce(op.last_seen_at > now() - interval '150 seconds', false),
      'seen_minutes', case when op.last_seen_at is not null then floor(extract(epoch from now() - op.last_seen_at) / 60)::int end,
      -- Only revealed after you both unmask
      'profile', case when s.status = 'matched' then json_build_object(
        'id', op.id, 'display_name', op.display_name, 'bio', op.bio, 'photos', coalesce(op.real_photos, op.photos)
      ) else null end
    )
  );
end $function$;

CREATE OR REPLACE FUNCTION public.my_masquerade_hour()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'their_photo', case when cur.status = 'matched' then (coalesce(op.real_photos, op.photos))[1] end,
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
end $function$;
