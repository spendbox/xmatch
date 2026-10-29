-- Hide my age: people can switch off showing their age.
-- Matching by age still works as before (the age is only left out of what other people see).
-- Run once in Supabase (SQL Editor → New query → paste → Run).

alter table public.profiles add column if not exists hide_age boolean not null default false;

-- The age other people see: nothing when its owner has hidden it (you always see your own)
create or replace function public.shown_age(p_birthdate date, p_hide boolean, p_owner uuid) returns int
language sql stable as $$
  select case when coalesce(p_hide, false) and p_owner is distinct from auth.uid() then null
              else public.age_years(p_birthdate) end
$$;

-- Everywhere an age is shown, it now goes through shown_age

create or replace function public.event_wall(p_event uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e masquerade_events;
  me profiles;
begin
  select * into e from masquerade_events where id = p_event;
  if not found or e.kind = 'masquerade' then raise exception 'Not available'; end if;
  if not exists (select 1 from event_attendees where event_id = p_event and user_id = uid) then raise exception 'Say you’re going first'; end if;
  if now() < e.starts_at then return '[]'::json; end if;
  select * into me from profiles where id = uid;
  return coalesce((
    select json_agg(row_to_json(t) order by t.shared desc, t.sort_key) from (
      select p.id as user_id, coalesce(a.alias, 'Masked guest') as name,
        public.shown_age(p.birthdate, p.hide_age, p.id) as age, p.gender, a.featured_blur as blur,
        case when r.target is not null then a.featured_photo end as photo,
        (r.target is not null) as revealed,
        public.shared_count(p.interests, me.interests) as shared,
        p.interests,
        (select c.id from event_chats c where c.event_id = p_event and c.user_a = least(uid, p.id) and c.user_b = greatest(uid, p.id)) as chat_id,
        md5(p.id::text || p_event::text) as sort_key
      from event_attendees a
      join profiles p on p.id = a.user_id
      left join event_reveals r on r.event_id = p_event and r.viewer = uid and r.target = p.id
      where a.event_id = p_event and a.user_id <> uid
        and public.gender_fits(me.pref_seeking, p.gender) and public.gender_fits(p.pref_seeking, me.gender)
        and not public.is_blocked(uid, p.id)
        -- Ghost mode: hidden, unless you already have a chat with them here
        and (not public.is_ghost(p.id) or exists (select 1 from event_chats c
          where c.event_id = p_event and c.user_a = least(uid, p.id) and c.user_b = greatest(uid, p.id)))
    ) t
  ), '[]'::json);
end $$;

create or replace function public.explore_profile(p_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'id', p.id, 'name', p.display_name, 'age', public.shown_age(p.birthdate, p.hide_age, p.id), 'gender', p.gender,
    'bio', p.bio, 'interests', p.interests, 'place', p.place_label,
    'intent', null,
    'online', coalesce(p.last_seen_at > now() - interval '150 seconds', false),
    'photos', case when open then to_json(p.photos) else to_json(array[p.photos[1]]) end,
    'photo_count', cardinality(p.photos),
    'photos_unlocked', open,
    'photos_paid', public.setting_int('explore_photos_paid', 1) > 0,
    'match_id', mid,
    'masked_id', (select x.id from masquerade_sessions x where x.source = 'explore' and x.status = 'active'
      and ((x.user_a = uid and x.user_b = p_id) or (x.user_a = p_id and x.user_b = uid)) order by x.started_at desc limit 1),
    'shared_interests', array(select unnest(p.interests) intersect select unnest((select interests from profiles where id = uid))),
    'message_cost', public.setting_int('explore_message_cost', 15),
    'wave_cost', public.setting_int('wave_cost', 0),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    'things', case when mid is not null then p.things else '[]'::jsonb end,
    'things_count', coalesce(jsonb_array_length(p.things), 0),
    'shared_words', case when mid is not null then (array(select unnest(p.thing_keys) intersect select unnest((select thing_keys from profiles where id = uid))))[1:5] end,
    'i_waved', exists (select 1 from waves w where w.from_id = uid and w.to_id = p_id),
    'waved_me', exists (select 1 from waves w where w.from_id = p_id and w.to_id = uid)
  );
end $function$;

create or replace function public.feed_person(c feed_chats, who uuid, viewer uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', p.id,
    'name', coalesce(case when who = c.user_a then c.alias_a else c.alias_b end, p.display_name),
    'masked', (case when who = c.user_a then c.alias_a else c.alias_b end) is not null,
    'photo', case when (case when who = c.user_a then c.alias_a else c.alias_b end) is null then p.photos[1] end,
    'age', public.shown_age(p.birthdate, p.hide_age, p.id), 'gender', p.gender,
    'interests', case when who <> viewer then p.interests end)
  from profiles p where p.id = who
$$;

create or replace function public.get_event_chat(p_chat uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c event_chats;
  e masquerade_events;
  other uuid;
begin
  select * into c from event_chats where id = p_chat and uid in (user_a, user_b);
  if not found then return null; end if;
  select * into e from masquerade_events where id = c.event_id;
  other := case when c.user_a = uid then c.user_b else c.user_a end;
  return json_build_object(
    'id', c.id, 'event_id', c.event_id, 'status', c.status, 'match_id', c.match_id,
    'my_keep', case when c.user_a = uid then c.keep_a else c.keep_b end,
    'their_keep_set', case when c.user_a = uid then c.keep_b is not null else c.keep_a is not null end,
    'event', public.event_json(e, uid),
    'other', (select json_build_object('id', p.id, 'name', coalesce(a.alias, 'Masked guest'),
                'age', public.shown_age(p.birthdate, p.hide_age, p.id), 'gender', p.gender, 'interests', p.interests,
                'blur', a.featured_blur,
                'photo', case when exists (select 1 from event_reveals r where r.event_id = c.event_id and r.viewer = uid and r.target = p.id)
                              then a.featured_photo end)
              from profiles p left join event_attendees a on a.event_id = c.event_id and a.user_id = p.id where p.id = other),
    'messages', coalesce((select json_agg(json_build_object('id', m.id, 'sender_id', m.sender_id, 'body', m.body, 'created_at', m.created_at) order by m.id)
                 from (select * from event_chat_messages where chat_id = c.id order by id desc limit 300) m), '[]'::json)
  );
end $$;

create or replace function public.get_feed(p_sort text default 'new', p_limit int default 30, p_offset int default 0) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pr prompts;
  mine prompt_answers;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into pr from prompts where day = public.feed_today();
  if not found then
    return json_build_object('prompt', null, 'gifts_unseen',
      (select count(*) from prompt_gifts where to_user = uid and seen_at is null));
  end if;
  select * into mine from prompt_answers where prompt_id = pr.id and user_id = uid;

  return json_build_object(
    'prompt', json_build_object('id', pr.id, 'body', pr.body, 'day', pr.day, 'chat_cost', pr.chat_cost,
      'answers', (select count(*) from prompt_answers where prompt_id = pr.id and hidden_at is null)),
    'gifts_unseen', (select count(*) from prompt_gifts where to_user = uid and seen_at is null),
    'my_answer', case when mine.id is null then null else json_build_object(
      'id', mine.id, 'alias', mine.alias, 'body', mine.body, 'created_at', mine.created_at, 'hidden', mine.hidden_at is not null,
      'reactions', (select count(*) from prompt_reactions r where r.answer_id = mine.id),
      'gifts', (select count(*) from prompt_gifts g where g.answer_id = mine.id),
      'chats', (select count(*) from feed_chats c where c.answer_id = mine.id)) end,
    'answers', case when mine.id is null then '[]'::json else coalesce((
      select json_agg(row_to_json(t)) from (
        select a.id, a.alias, a.body, a.created_at, public.shown_age(p.birthdate, p.hide_age, p.id) as age, p.gender,
          (a.user_id = uid) as mine,
          (select coalesce(json_object_agg(x.emoji, x.n), '{}'::json) from (
             select emoji, count(*) as n from prompt_reactions r where r.answer_id = a.id group by emoji) x) as reactions,
          (select emoji from prompt_reactions r where r.answer_id = a.id and r.user_id = uid) as my_reaction,
          (select count(*) from prompt_gifts g where g.answer_id = a.id) as gifts,
          (select c.id from feed_chats c where c.status = 'open'
             and c.user_a = least(uid, a.user_id) and c.user_b = greatest(uid, a.user_id)) as chat_id,
          (a.user_id <> uid and public.feed_can_chat(uid, a.user_id) and not public.already_matched(uid, a.user_id)) as can_chat,
          public.already_matched(uid, a.user_id) as matched
        from prompt_answers a
        join profiles p on p.id = a.user_id
        where a.prompt_id = pr.id and a.hidden_at is null
          and not public.is_blocked(uid, a.user_id)
        order by
          (a.user_id = uid) desc,
          case when p_sort = 'top' then
            (select count(*) from prompt_reactions r where r.answer_id = a.id)
            + 3 * (select count(*) from prompt_gifts g where g.answer_id = a.id) end desc nulls last,
          a.created_at desc
        limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset)
      ) t), '[]'::json) end
  );
end $$;

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
      'age', public.shown_age(op.birthdate, op.hide_age, op.id),
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

CREATE OR REPLACE FUNCTION public.get_matches()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(json_agg(row_to_json(t) order by t.last_message_at desc), '[]'::json) from (
    select m.id, m.created_at, m.last_message_at, m.intent,
      p.id as other_id, p.display_name, coalesce(p.real_photos, p.photos) as photos, public.shown_age(p.birthdate, p.hide_age, p.id) as age,
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

create or replace function public.meet_json(m meet_posts, uid uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', m.id, 'kind', m.kind, 'game', m.game, 'body', m.body, 'alias', m.alias,
    'created_at', m.created_at, 'ends_at', m.ends_at, 'mine', m.user_id = uid,
    'age', public.shown_age(p.birthdate, p.hide_age, p.id), 'gender', p.gender,
    'session_id', (select s.id from masquerade_sessions s where s.meet_id = m.id and s.user_b = uid),
    'people', (select count(*) from masquerade_sessions s where s.meet_id = m.id),
    'waiting', case when m.kind = 'game' and m.user_id = uid then (
      select count(*) from masquerade_sessions s where s.meet_id = m.id and s.status = 'active' and now() < s.ends_at
        and not exists (select 1 from games g where g.session_id = s.id and g.started_at is not null)) end)
  from profiles p where p.id = m.user_id
$$;

create or replace function public.my_event_chats(p_event uuid) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  perform public.tidy_event_chats(p_event);
  return coalesce((
    select json_agg(row_to_json(t) order by t.last_message_at desc) from (
      select c.id, c.status, c.created_at, c.last_message_at, c.opened_by,
        case when c.user_a = uid then c.keep_a else c.keep_b end as my_keep,
        p.id as other_id, coalesce(a.alias, 'Masked guest') as name, public.shown_age(p.birthdate, p.hide_age, p.id) as age, p.gender,
        a.featured_blur as blur,
        case when exists (select 1 from event_reveals r where r.event_id = c.event_id and r.viewer = uid and r.target = p.id)
             then a.featured_photo end as photo,
        (select body from event_chat_messages m where m.chat_id = c.id order by m.id desc limit 1) as last_message,
        (select sender_id from event_chat_messages m where m.chat_id = c.id order by m.id desc limit 1) as last_sender
      from event_chats c
      join profiles p on p.id = case when c.user_a = uid then c.user_b else c.user_a end
      left join event_attendees a on a.event_id = c.event_id and a.user_id = p.id
      where c.event_id = p_event and uid in (c.user_a, c.user_b)
    ) t
  ), '[]'::json);
end $$;

create or replace function public.my_feed_gifts() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json) from (
    select g.id, g.gift_id, g.created_at, g.seen_at, g.answer_body, g.prompt_body,
      p.id as from_id, p.display_name as from_name, p.photos[1] as from_photo,
      public.shown_age(p.birthdate, p.hide_age, p.id) as from_age, p.gender as from_gender,
      (select c.id from feed_chats c where c.status = 'open'
         and c.user_a = least(auth.uid(), p.id) and c.user_b = greatest(auth.uid(), p.id)) as chat_id,
      (public.feed_can_chat(auth.uid(), p.id) and not public.already_matched(auth.uid(), p.id)) as can_chat,
      (select m.id from matches m where m.user_a = least(auth.uid(), p.id) and m.user_b = greatest(auth.uid(), p.id)) as match_id
    from prompt_gifts g
    join profiles p on p.id = g.from_user
    where g.to_user = auth.uid() and g.created_at > now() - interval '30 days'
      and not public.is_blocked(auth.uid(), p.id)
    order by g.created_at desc
    limit 50
  ) t
$$;

create or replace function public.my_live_event_chats() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.unread desc, t.last_message_at desc), '[]'::json) from (
    select c.id, c.event_id, e.title as event_title, e.ends_at, c.last_message_at,
      p.id as other_id, coalesce(a.alias, 'Masked guest') as name, public.shown_age(p.birthdate, p.hide_age, p.id) as age, p.gender,
      a.featured_blur as blur,
      case when exists (select 1 from event_reveals r where r.event_id = c.event_id and r.viewer = auth.uid() and r.target = p.id)
           then a.featured_photo end as photo,
      (select body from event_chat_messages m where m.chat_id = c.id order by m.id desc limit 1) as last_message,
      public.event_chat_unread(c, auth.uid()) as unread
    from event_chats c
    join masquerade_events e on e.id = c.event_id
    join profiles p on p.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
    left join event_attendees a on a.event_id = c.event_id and a.user_id = p.id
    where auth.uid() in (c.user_a, c.user_b) and c.status = 'open' and now() < e.ends_at + interval '1 hour'
  ) t
$$;

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
      'their_age', public.shown_age(op.birthdate, op.hide_age, op.id), 'their_gender', op.gender, 'their_place', op.place_label,
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
          public.shown_age(p.birthdate, p.hide_age, p.id) as their_age, p.gender as their_gender,
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

create or replace function public.play_info(p_game uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'id', p.id, 'name', p.display_name, 'age', public.shown_age(p.birthdate, p.hide_age, p.id), 'gender', p.gender,
    'photos', p.photos, 'bio', p.bio, 'interests', p.interests, 'place', p.place_label,
    'online', coalesce(p.last_seen_at > now() - interval '150 seconds', false),
    'me_photo', (select photos[1] from profiles where id = uid),
    'match_id', (select id from matches where user_a = least(uid, them) and user_b = greatest(uid, them)),
    'cost', public.setting_int('explore_message_cost', 15),
    'balance', coalesce((select balance from wallets where user_id = uid), 0)
  );
end $function$;

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
          -- People you've already unmasked with don't take the top spots: new people come first
          row_number() over (order by s.score - case when s.connected then 60 else 0 end desc, s.km asc nulls last, s.last_seen_at desc) as rank
        from (
          select c.*, public.explore_match_id(uid, c.id) is not null as connected,
            (case when q is not null and lower(c.name) = lower(q) then 1000 else 0 end)
            -- How well you fit each other
            + (case when public.gender_fits(me.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, me.gender) then 40
                    when public.gender_fits(me.pref_seeking, c.gender) then 20 else 0 end)
            + (case when c.pref_intent = me.pref_intent then 15 else 0 end)
            + (case when c.age between me.pref_age_min and me.pref_age_max then 15 else 0 end)
            + (case when my_age between c.pref_age_min and c.pref_age_max then 10 else 0 end)
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
