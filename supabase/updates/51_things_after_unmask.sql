-- Dashpad update: "things about me" hidden until you're connected (Part 51)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 50 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 51: On Meet and Home, someone's "things about me" stay hidden until you've
-- both unmasked and are connected. Before that you see how many they have.
-- ---------------------------------------------------------------------------
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
    -- What they're in the mood for only shows in your chat
    'intent', null,
    'online', p.last_seen_at > now() - interval '5 minutes',
    'photos', case when open then to_json(p.photos) else to_json(array[p.photos[1]]) end,
    'photo_count', cardinality(p.photos),
    'photos_unlocked', open,
    'match_id', mid,
    -- A masked chat you already have with them from Meet
    'masked_id', (select x.id from masquerade_sessions x where x.source = 'explore' and x.status = 'active'
      and ((x.user_a = uid and x.user_b = p_id) or (x.user_a = p_id and x.user_b = uid)) order by x.started_at desc limit 1),
    'shared_interests', array(select unnest(p.interests) intersect select unnest((select interests from profiles where id = uid))),
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    -- Their "things about me" only show once you're connected (you've both unmasked);
    -- before that, just how many there are. The words you both used still show.
    'things', case when mid is not null then p.things else '[]'::jsonb end,
    'things_count', coalesce(jsonb_array_length(p.things), 0),
    'shared_words', (array(select unnest(p.thing_keys) intersect select unnest((select thing_keys from profiles where id = uid))))[1:5]
  );
end $$;
