-- Dashpad update: who viewed you, waves, Keys back on unanswered chats, photo settings (Part 61)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 60 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 61:
--  * Profile views: opening someone's profile on Meet or Home is noted (not in ghost
--    mode), so they can see who viewed them in the last week.
--  * Waves: a free "hi" from someone's profile. If you both wave, a masked chat opens
--    for free, and you can both see each other's names.
--  * Paid messages are safe: if the other person never replies within 48 hours, the
--    Keys go back to you.
--  * Admin can switch off paying to see someone's other photos (explore_photos_paid = 0):
--    then they only show once you're connected. Main photos are no longer blurred.
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value) values ('explore_photos_paid', 1) on conflict (key) do nothing;

create table if not exists public.profile_views (
  viewer uuid not null references public.profiles on delete cascade,
  target uuid not null references public.profiles on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (viewer, target)
);
create index if not exists profile_views_target on public.profile_views (target, seen_at desc);
alter table public.profile_views enable row level security;

create table if not exists public.waves (
  from_id uuid not null references public.profiles on delete cascade,
  to_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  -- The chat that opened when you both waved
  session_id uuid references public.masquerade_sessions on delete set null,
  primary key (from_id, to_id)
);
create index if not exists waves_to on public.waves (to_id, created_at desc);
create index if not exists waves_from_recent on public.waves (from_id, created_at desc);
alter table public.waves enable row level security;

alter table public.masquerade_sessions add column if not exists waved boolean not null default false;
alter table public.masquerade_sessions add column if not exists paid_keys int not null default 0;
alter table public.masquerade_sessions add column if not exists refunded_at timestamptz;
create index if not exists masquerade_sessions_refund_due on public.masquerade_sessions (started_at)
  where paid_keys > 0 and refunded_at is null;

-- You opened someone's profile
create or replace function public.log_profile_view(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or p_id is null or p_id = uid then return; end if;
  -- Ghost mode: look around without being seen
  if exists (select 1 from profiles where id = uid and ghost_on and ghost_until > now()) then return; end if;
  if not public.explore_visible(uid, p_id) then return; end if;
  insert into profile_views (viewer, target, seen_at) values (uid, p_id, now())
  on conflict (viewer, target) do update set seen_at = now();
end $$;
revoke execute on function public.log_profile_view(uuid) from public, anon;
grant execute on function public.log_profile_view(uuid) to authenticated;

-- Who viewed you: how many in the last 24 hours, and everyone from the last 7 days
create or replace function public.my_viewers() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return null; end if;
  return json_build_object(
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
revoke execute on function public.my_viewers() from public, anon;
grant execute on function public.my_viewers() to authenticated;

-- Wave at someone (free). If they already waved at you, your masked chat opens.
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
revoke execute on function public.wave_person(uuid) from public, anon;
grant execute on function public.wave_person(uuid) to authenticated;

-- Message someone from Meet: now remembers what you paid, so it can come back if they never reply
create or replace function public.message_person(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mid uuid;
  sid uuid;
  cost int := public.setting_int('explore_message_cost', 15);
  me profiles;
  them profiles;
  a1 text;
  lvl smallint;
  q text;
begin
  if uid is null then raise exception 'Please log in'; end if;
  mid := public.explore_match_id(uid, p_id);
  if mid is not null then return json_build_object('kind', 'match', 'id', mid); end if;
  select id into sid from masquerade_sessions
  where source = 'explore' and status = 'active'
    and ((user_a = uid and user_b = p_id) or (user_a = p_id and user_b = uid))
  order by started_at desc limit 1;
  if sid is not null then return json_build_object('kind', 'masked', 'id', sid); end if;

  if not public.explore_visible(uid, p_id) then raise exception 'Not available'; end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  if (select count(*) from masquerade_sessions where source = 'explore' and user_a = uid and started_at > now() - interval '1 minute') >= 5 then
    raise exception 'Slow down a little';
  end if;
  select * into me from profiles where id = uid;
  select * into them from profiles where id = p_id;
  if cost > 0 then perform public.spend_keys(uid, cost, 'explore_message', p_id::text); end if;

  a1 := public.random_alias();
  lvl := round((coalesce(me.pref_spice, 1) + coalesce(them.pref_spice, 1)) / 2.0)::smallint;
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, source, paid_keys)
  values (uid, p_id, me.pref_intent, coalesce(me.pref_spice, 1), coalesce(them.pref_spice, 1), lvl, a1, public.random_alias(a1), now(), 'infinity', 'explore', greatest(cost, 0))
  returning id into sid;
  insert into masquerade_messages (session_id, kind, body)
  values (sid, 'system', a1 || ' found you on Meet and started this chat. You''re both masked until you both unmask.');
  q := public.pick_icebreaker(sid, lvl, null);
  if q is not null then insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q); end if;
  return json_build_object('kind', 'masked', 'id', sid);
end $$;

-- Keys back for paid chats where the other person never replied (or unmasked) within 48 hours.
-- Called by the server every few minutes; returns who to tell.
create or replace function public.refund_quiet_paid_chats(p_limit int default 200) returns json
language plpgsql security definer set search_path = public as $$
declare
  r record;
  out_rows json[] := '{}';
begin
  for r in
    select s.id, s.user_a, s.user_b, s.paid_keys from masquerade_sessions s
    where s.paid_keys > 0 and s.refunded_at is null
      and s.started_at < now() - interval '48 hours'
      and s.status <> 'matched'
      and s.unmask_b is not true
      and not exists (select 1 from masquerade_messages m where m.session_id = s.id and m.sender_id = s.user_b)
    order by s.started_at
    limit p_limit
    for update skip locked
  loop
    perform public.add_keys(r.user_a, r.paid_keys, 'explore_refund', r.id::text);
    update masquerade_sessions set refunded_at = now() where id = r.id;
    out_rows := out_rows || json_build_object('user_id', r.user_a, 'keys', r.paid_keys, 'session_id', r.id,
      'name', (select display_name from profiles where id = r.user_b));
  end loop;
  return to_json(out_rows);
end $$;
revoke execute on function public.refund_quiet_paid_chats(int) from public, anon, authenticated;

-- Chats started from Meet: who can see whose name. If you both waved, you both can.
create or replace function public.paid_chat_people() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(s.id,
    case
      when s.waved then json_build_object('name', o.display_name, 'photo', o.photos[1], 'started_by_me', true, 'waved', true)
      when s.user_a = auth.uid() then json_build_object('name', o.display_name, 'photo', o.photos[1], 'started_by_me', true,
        'refund_at', case when s.paid_keys > 0 and s.refunded_at is null then s.started_at + interval '48 hours' end,
        'refunded', s.refunded_at is not null, 'paid_keys', s.paid_keys)
      else json_build_object('name', null, 'photo', null, 'started_by_me', false)
    end), '{}'::json)
  from masquerade_sessions s
  join profiles o on o.id = case when s.user_a = auth.uid() then s.user_b else s.user_a end
  where auth.uid() in (s.user_a, s.user_b)
    and s.source = 'explore'
    and s.pact_id is null
    and s.meet_id is null
    and s.status = 'active'
$$;
revoke execute on function public.paid_chat_people() from public, anon;
grant execute on function public.paid_chat_people() to authenticated;

-- Seeing someone's other photos for Keys can be switched off (then: once you're connected)
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
  if public.setting_int('explore_photos_paid', 1) = 0 then
    raise exception 'Their other photos show once you''re connected';
  end if;
  if cost > 0 then
    bal := public.spend_keys(uid, cost, 'photos', p_id::text);
  else
    select balance into bal from wallets where user_id = uid;
  end if;
  insert into photo_unlocks (viewer, target, paid) values (uid, p_id, cost) on conflict do nothing;
  return coalesce(bal, 0);
end $$;

-- Someone's profile on Meet: also whether you've waved at each other, and the photo setting
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
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    'things', case when mid is not null then p.things else '[]'::jsonb end,
    'things_count', coalesce(jsonb_array_length(p.things), 0),
    'shared_words', case when mid is not null then (array(select unnest(p.thing_keys) intersect select unnest((select thing_keys from profiles where id = uid))))[1:5] end,
    'i_waved', exists (select 1 from waves w where w.from_id = uid and w.to_id = p_id),
    'waved_me', exists (select 1 from waves w where w.from_id = p_id and w.to_id = uid)
  );
end $$;
