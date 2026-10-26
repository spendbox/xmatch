-- Dashpad update: "Online" means the same thing everywhere (Part 88)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 87 first. Safe to run more than once.
-- Someone is online if the app checked in within the last 150 seconds (the app checks in every minute,
-- and leaving the app marks you 151 seconds ago). Meet and profiles used 5 minutes, masked chats and
-- Play 2 minutes, and the online count 10 minutes, so people showed online in one place and not another.
-- The app can now also check who's online for anyone it shows you (before, only people you'd matched with).

-- When each of these people was last in the app: you, people you've matched with, and people you can see on Meet
create or replace function public.presence(p_ids uuid[]) returns table (id uuid, last_seen_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.last_seen_at from profiles p
  where p.id = any(p_ids[1:100])
    and (p.id = auth.uid() or public.is_matched_with(p.id) or public.explore_visible(auth.uid(), p.id))
$$;
revoke all on function public.presence(uuid[]) from public, anon;
grant execute on function public.presence(uuid[]) to authenticated;

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
        select s.id, s.name, s.age,
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
            select p.id, p.display_name as name, public.age_years(p.birthdate) as age, p.gender, p.photos[1] as photo,
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
    'id', p.id, 'name', p.display_name, 'age', public.age_years(p.birthdate), 'gender', p.gender,
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

create or replace function public.get_masquerade(p_session uuid)
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
        'id', op.id, 'display_name', op.display_name, 'bio', op.bio, 'photos', op.photos
      ) else null end
    )
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
    'id', p.id, 'name', p.display_name, 'age', public.age_years(p.birthdate), 'gender', p.gender,
    'photos', p.photos, 'bio', p.bio, 'interests', p.interests, 'place', p.place_label,
    'online', coalesce(p.last_seen_at > now() - interval '150 seconds', false),
    'me_photo', (select photos[1] from profiles where id = uid),
    'match_id', (select id from matches where user_a = least(uid, them) and user_b = greatest(uid, them)),
    'cost', public.setting_int('explore_message_cost', 15),
    'balance', coalesce((select balance from wallets where user_id = uid), 0)
  );
end $function$;

create or replace function public.home_stats()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  me profiles;
  loc accounts_private;
begin
  select * into me from profiles where id = uid;
  select * into loc from accounts_private where user_id = uid;
  return json_build_object(
    'online', (
      select count(*) from profiles p
      left join accounts_private a on a.user_id = p.id
      where p.id <> uid
        and p.last_seen_at > now() - interval '150 seconds'
        and (p.open_to_masquerade or exists (select 1 from masquerade_queue q where q.user_id = p.id))
        and public.within_km(public.distance_km(loc.lat, loc.lng, a.lat, a.lng), case when loc.lat is null then null else me.pref_max_km end)
    ),
    'week_chats', (
      select count(*) from masquerade_sessions
      where (user_a = uid or user_b = uid) and started_at > now() - interval '7 days'
    ),
    'week_unmasks', (
      select count(*) from masquerade_sessions
      where status = 'matched' and (user_a = uid or user_b = uid) and started_at > now() - interval '7 days'
    ),
    'gifts_received', (
      select count(*) from messages m join matches x on x.id = m.match_id
      where m.kind = 'gift' and m.sender_id <> uid and (x.user_a = uid or x.user_b = uid)
    )
  );
end $function$;

-- Admin: "online now" uses the same 150 seconds
create or replace function public.admin_members(p_q text DEFAULT ''::text, p_filter text DEFAULT 'all'::text, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with base as (
    select p.id, p.display_name, p.photos, p.gender, public.age_years(p.birthdate) as age, p.created_at, p.last_seen_at,
      a.email, a.banned_at,
      coalesce(w.balance, 0) as balance,
      (select count(*) from reports r where r.reported_id = p.id) as reports,
      (select count(*) from matches m where p.id in (m.user_a, m.user_b)) as matches,
      (p.display_name is not null and p.birthdate is not null and p.gender is not null and cardinality(p.photos) > 0) as onboarded
    from profiles p
    left join accounts_private a on a.user_id = p.id
    left join wallets w on w.user_id = p.id
    where (coalesce(p_q, '') = '' or p.display_name ilike '%' || p_q || '%' or a.email ilike '%' || p_q || '%')
  ), filtered as (
    select * from base where case coalesce(p_filter, 'all')
      when 'online' then last_seen_at > now() - interval '150 seconds'
      when 'new' then created_at > now() - interval '7 days'
      when 'reported' then reports > 0
      when 'banned' then banned_at is not null
      when 'incomplete' then not onboarded
      else true end
  )
  select json_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((select json_agg(row_to_json(t)) from (
      select id, display_name, photos[1] as photo, gender, age, created_at, last_seen_at, email, banned_at, balance, reports, matches, onboarded
      from filtered
      order by case when p_filter = 'reported' then reports else 0 end desc, created_at desc
      limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
    ) t), '[]'::json)
  )
$function$;

create or replace function public.admin_overview()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    'users', (select count(*) from profiles where display_name is not null),
    'new_users_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'online_now', (select count(*) from profiles where last_seen_at > now() - interval '150 seconds'),
    'masquerades_today', (select count(*) from masquerade_sessions where started_at > now() - interval '24 hours'),
    'unmasks_today', (select count(*) from masquerade_sessions where status = 'matched' and started_at > now() - interval '24 hours'),
    'matches_total', (select count(*) from matches),
    'revenue_30d_kobo', (select coalesce(sum(amount_kobo), 0) from payments where status = 'paid' and paid_at > now() - interval '30 days'),
    'keys_sold_30d', (select coalesce(sum(keys), 0) from payments where status = 'paid' and paid_at > now() - interval '30 days'),
    -- Every gift sent this week: in chats, masked chats and on the Feed, whatever Keys paid for it
    'gifts_7d', (select count(*) from key_transactions where reason in ('gift', 'feed_gift') and amount < 0 and created_at > now() - interval '7 days'),
    'gift_keys_7d', (select coalesce(-sum(amount), 0) from key_transactions where reason in ('gift', 'feed_gift') and amount < 0 and created_at > now() - interval '7 days'),
    -- Sent by someone who hadn't bought Keys yet (so free Keys paid for it)
    'gifts_free_7d', (select count(*) from key_transactions t where t.reason in ('gift', 'feed_gift') and t.amount < 0 and t.created_at > now() - interval '7 days'
      and not exists (select 1 from payments p where p.user_id = t.user_id and p.status = 'paid' and p.paid_at <= t.created_at)),
    'gifts_total', (select count(*) from key_transactions where reason in ('gift', 'feed_gift') and amount < 0),
    'reports_7d', (select count(*) from reports where created_at > now() - interval '7 days'),
    'icebreakers', (select count(*) from icebreakers where event_id is null and active)
  )
$function$;
