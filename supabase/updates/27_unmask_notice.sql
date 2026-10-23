-- Dashpad update: unmask notices, private mood in Explore (Part 27)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run updates 24 to 26 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 27: Unmasking tells the other person; mood stays private until you've chatted
-- ---------------------------------------------------------------------------
-- You've both sent at least one message in your chat
create or replace function public.explore_chatted(v uuid, o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from matches m
    where m.user_a = least(v, o) and m.user_b = greatest(v, o)
      and exists (select 1 from messages x where x.match_id = m.id and x.sender_id = v)
      and exists (select 1 from messages x where x.match_id = m.id and x.sender_id = o))
$$;
revoke all on function public.explore_chatted(uuid, uuid) from public, anon, authenticated;

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
  -- Tell them in the chat the first time you unmask (they get a notification too)
  if p_unmask and (case when uid = s.user_a then s.unmask_a else s.unmask_b end) is distinct from true
     and (case when uid = s.user_a then s.unmask_b else s.unmask_a end) is distinct from true then
    insert into masquerade_messages (session_id, kind, body)
    values (s.id, 'system', (case when uid = s.user_a then s.alias_a else s.alias_b end) || ' unmasked. Unmask too to connect');
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
    'bio', p.bio, 'interests', p.interests, 'place', p.place_label,
    -- What they're in the mood for only shows once you've both chatted
    'intent', case when public.explore_chatted(uid, p_id) then p.pref_intent end,
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
          p.place_label as place, case when public.explore_chatted(uid, p.id) then p.pref_intent end as intent,
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
