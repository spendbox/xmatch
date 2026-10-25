-- Dashpad update: a price for waves (Part 62)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 61 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 62: Admin can set what a wave costs (wave_cost, 0 = free, the default).
-- Only the first wave costs: waving back, which opens your chat, is always free.
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value) values ('wave_cost', 0) on conflict (key) do nothing;

create or replace function public.wave_person(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mid uuid;
  sid uuid;
  me profiles;
  them profiles;
  a1 text;
  lvl smallint;
  q text;
  cost int := public.setting_int('wave_cost', 0);
begin
  if uid is null then raise exception 'Please log in'; end if;
  if p_id is null or p_id = uid then raise exception 'Not available'; end if;
  mid := public.explore_match_id(uid, p_id);
  if mid is not null then return json_build_object('kind', 'match', 'id', mid); end if;
  select id into sid from masquerade_sessions
  where source = 'explore' and status = 'active'
    and ((user_a = uid and user_b = p_id) or (user_a = p_id and user_b = uid))
  order by started_at desc limit 1;
  if sid is not null then return json_build_object('kind', 'masked', 'id', sid); end if;

  if not public.explore_visible(uid, p_id) then raise exception 'Not available'; end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  if exists (select 1 from waves where from_id = uid and to_id = p_id) then
    return json_build_object('kind', 'waved', 'again', true);
  end if;
  if (select count(*) from waves where from_id = uid and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'You''ve waved a lot today. Try again tomorrow';
  end if;

  -- Waving first can cost Keys (set in admin); waving back is always free
  if cost > 0 and not exists (select 1 from waves where from_id = p_id and to_id = uid) then
    perform public.spend_keys(uid, cost, 'wave', p_id::text);
  end if;
  insert into waves (from_id, to_id) values (uid, p_id) on conflict do nothing;
  -- Waving means you looked
  insert into profile_views (viewer, target, seen_at) values (uid, p_id, now())
  on conflict (viewer, target) do update set seen_at = now();

  if not exists (select 1 from waves where from_id = p_id and to_id = uid) then
    return json_build_object('kind', 'waved');
  end if;

  -- You both waved: open a masked chat, free
  select * into me from profiles where id = uid;
  select * into them from profiles where id = p_id;
  a1 := public.random_alias();
  lvl := round((coalesce(me.pref_spice, 1) + coalesce(them.pref_spice, 1)) / 2.0)::smallint;
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, source, waved)
  values (uid, p_id, me.pref_intent, coalesce(me.pref_spice, 1), coalesce(them.pref_spice, 1), lvl, a1, public.random_alias(a1), now(), 'infinity', 'explore', true)
  returning id into sid;
  insert into masquerade_messages (session_id, kind, body)
  values (sid, 'system', 'You both waved 👋 This chat is free. Photos stay hidden until you both unmask.');
  q := public.pick_icebreaker(sid, lvl, null);
  if q is not null then insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q); end if;
  update waves set session_id = sid where (from_id = uid and to_id = p_id) or (from_id = p_id and to_id = uid);
  return json_build_object('kind', 'masked', 'id', sid, 'mutual', true);
end $$;

create or replace function public.my_viewers() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return null; end if;
  return json_build_object(
    'wave_cost', public.setting_int('wave_cost', 0),
    'today', (select count(*) from profile_views v
      where v.target = uid and v.seen_at > now() - interval '24 hours' and public.explore_visible(uid, v.viewer)),
    'people', coalesce((select json_agg(row_to_json(t) order by t.seen_at desc) from (
      select p.id, p.display_name as name, p.photos[1] as photo,
        coalesce(p.last_seen_at > now() - interval '5 minutes', false) as online,
        v.seen_at,
        exists (select 1 from waves w where w.from_id = p.id and w.to_id = uid) as waved_me,
        exists (select 1 from waves w where w.from_id = uid and w.to_id = p.id) as i_waved,
        public.explore_match_id(uid, p.id) is not null as connected
      from profile_views v join profiles p on p.id = v.viewer
      where v.target = uid and v.seen_at > now() - interval '7 days' and public.explore_visible(uid, v.viewer)
      order by v.seen_at desc
      limit 50
    ) t), '[]'::json)
  );
end $$;

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
    'id', p.id, 'name', p.display_name, 'age', case when mid is not null then public.age_years(p.birthdate) end, 'gender', p.gender,
    'bio', p.bio, 'interests', p.interests, 'place', p.place_label,
    'intent', null,
    'online', p.last_seen_at > now() - interval '5 minutes',
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
end $$;
