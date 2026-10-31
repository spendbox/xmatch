-- Dashpad update: real faces once you've both unmasked (Part 111)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- Two people who have both unmasked see each other's real photos on Explore, on each other's
-- profile and in Chats. Everyone else only ever gets the masked photos.
--
-- Can't be faked:
-- * "Both unmasked" means a chat that was created when BOTH of you pressed unmask (matches.session_id
--   is only written by finalize_masquerade, and nobody can write to matches from the app).
-- * Real photos are only handed out by the database itself, after that check. The profiles table can
--   only be read directly for yourself and people you've both unmasked with (before, any chat was
--   enough, so someone who paid to chat after a Play game could read real photos).
-- * Real photo files have random names that can't be guessed.

-- Have these two both unmasked? (only the database uses this)
create or replace function public.unmasked_pair(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a is not null and b is not null and exists (
    select 1 from matches m
    where m.user_a = least(a, b) and m.user_b = greatest(a, b) and m.session_id is not null)
$$;
revoke all on function public.unmasked_pair(uuid, uuid) from public, anon, authenticated;

-- Have you and this person both unmasked? (used by the rule below; only ever about you)
create or replace function public.is_unmasked_with(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.unmasked_pair(auth.uid(), other)
$$;
revoke all on function public.is_unmasked_with(uuid) from public, anon;
grant execute on function public.is_unmasked_with(uuid) to authenticated;

-- Reading profiles straight from the table: your own, or someone you've both unmasked with
drop policy if exists "read own or matched profile" on public.profiles;
drop policy if exists "read own or unmasked profile" on public.profiles;
create policy "read own or unmasked profile" on public.profiles for select
  using (id = auth.uid() or public.is_unmasked_with(id));

-- Chats list: real photos only for people you've both unmasked with
CREATE OR REPLACE FUNCTION public.get_matches()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(json_agg(row_to_json(t) order by t.last_message_at desc), '[]'::json) from (
    select m.id, m.created_at, m.last_message_at, m.intent,
      p.id as other_id, p.display_name,
      case when m.session_id is not null then coalesce(nullif(p.real_photos, '{}'), p.photos) else p.photos end as photos,
      public.shown_age(p.birthdate, p.hide_age, p.id) as age,
      public.shared_count(p.interests, (select interests from profiles where id = auth.uid())) as shared,
      -- Their note for today (gone after 24 hours)
      case when p.note_at > now() - interval '24 hours' then p.note end as note,
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

-- The other person in one of your chats: name and the right photo (for an incoming call)
create or replace function public.chat_peer(p_match uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m matches;
  p profiles;
begin
  select * into m from matches where id = p_match and (user_a = uid or user_b = uid);
  if not found then return null; end if;
  select * into p from profiles where id = case when m.user_a = uid then m.user_b else m.user_a end;
  return json_build_object('id', p.id, 'name', p.display_name,
    'photo', case when m.session_id is not null then coalesce(p.real_photos[1], p.photos[1]) else p.photos[1] end);
end $$;
revoke all on function public.chat_peer(uuid) from public, anon;
grant execute on function public.chat_peer(uuid) to authenticated;

-- Who viewed you: real photos for people you've both unmasked with
create or replace function public.my_viewers() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return null; end if;
  return (
    with v as (
      select p.id, p.display_name as name,
        case when public.unmasked_pair(uid, p.id) then coalesce(p.real_photos[1], p.photos[1]) else p.photos[1] end as photo,
        coalesce(p.last_seen_at > now() - interval '150 seconds', false) as online,
        pv.seen_at,
        exists (select 1 from waves w where w.from_id = p.id and w.to_id = uid) as waved_me,
        exists (select 1 from waves w where w.from_id = uid and w.to_id = p.id) as i_waved,
        public.explore_match_id(uid, p.id) is not null as connected
      from profile_views pv join profiles p on p.id = pv.viewer
      where pv.target = uid and pv.seen_at > now() - interval '7 days'
        and public.explore_visible(uid, pv.viewer)
        -- Not someone you're in a masked chat with right now
        and not exists (select 1 from masquerade_sessions x
                        where x.status = 'active'
                          and ((x.user_a = uid and x.user_b = p.id) or (x.user_a = p.id and x.user_b = uid)))
      order by pv.seen_at desc
      limit 50
    )
    select json_build_object(
      'wave_cost', public.setting_int('wave_cost', 0),
      'today', (select count(*) from v where v.seen_at > now() - interval '24 hours'),
      'people', coalesce((select json_agg(row_to_json(v) order by v.seen_at desc) from v), '[]'::json)
    )
  );
end $$;
revoke execute on function public.my_viewers() from public, anon;
grant execute on function public.my_viewers() to authenticated;

-- Explore: real faces for people you've both unmasked with
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
    'photos_paid', public.setting_int('explore_photos_paid', 1) > 0,
    'people', coalesce((
      select json_agg(row_to_json(t) order by t.rank) from (
        -- What they're in the mood for only shows in your chat
        select s.id, s.name, case when s.hide_age then null else s.age end as age,
          s.gender,
          -- You've both unmasked: their real face. Everyone else: their masked photo
          case when s.unmasked and cardinality(s.real_all) > 0 then s.real_all[1] else s.photo end as photo,
          s.place, null::text as intent, s.online,
          s.connected, s.unmasked,
          -- How well you match, 0 to 100, how far away they are, and an interest to show (yours first)
          least(100, greatest(0, round(s.fit)))::int as match,
          case when s.km is not null then greatest(1, round(s.km))::int end as km,
          coalesce((select x from unnest(s.interests) x where x = any(me.interests) limit 1), s.interests[1]) as tag,
          -- What you're both into ("You both like…"), and whether either of you has waved
          array(select x from unnest(s.interests) x where x = any(me.interests) limit 3) as shared,
          exists (select 1 from waves w where w.from_id = uid and w.to_id = s.id) as i_waved,
          exists (select 1 from waves w where w.from_id = s.id and w.to_id = uid) as waved_me,
          -- Their photos to swipe: all of them once you've unlocked or connected, else just the main one
          case when s.unmasked and cardinality(s.real_all) > 0 then to_json(s.real_all)
               when s.connected or exists (select 1 from photo_unlocks u where u.viewer = uid and u.target = s.id)
               then to_json(s.photos_all) else to_json(array[s.photo]) end as photos,
          case when s.unmasked and cardinality(s.real_all) > 0 then cardinality(s.real_all)
               else coalesce(cardinality(s.photos_all), 0) end as photo_count,
          (s.unmasked or s.connected or exists (select 1 from photo_unlocks u where u.viewer = uid and u.target = s.id)) as photos_unlocked,
          -- Their note for today, and signs of life for the chips
          case when s.note_at > now() - interval '24 hours' then s.note end as note,
          -- Their voice intro (a few seconds, disguised unless they chose their real voice)
          s.voice_intro_key as voice_intro, s.voice_intro_seconds as voice_seconds,
          case when not s.online and s.last_seen_at is not null then floor(extract(epoch from now() - s.last_seen_at) / 60)::int end as seen_minutes,
          s.reply_s as reply_seconds,
          s.reply_rate,
          s.joined_at > now() - interval '7 days' as is_new,
          (select count(*) from profile_views v where v.target = s.id and v.seen_at > now() - interval '7 days')::int as views_7d,
          -- People you've already unmasked with don't take the top spots: new people come first
          row_number() over (order by s.score - case when s.connected then 60 else 0 end desc, s.km asc nulls last, s.last_seen_at desc) as rank
        from (
          select c.*, public.explore_match_id(uid, c.id) is not null as connected,
            public.unmasked_pair(uid, c.id) as unmasked,
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
              p.photos as photos_all, coalesce(p.real_photos, '{}') as real_all, p.created_at as joined_at, p.note, p.note_at, p.voice_intro_key, p.voice_intro_seconds,
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


-- Someone's profile from Explore: real faces once you've both unmasked
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
  bare boolean;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if not public.explore_visible(uid, p_id) then return null; end if;
  select * into p from profiles where id = p_id;
  mid := public.explore_match_id(uid, p_id);
  -- You've both unmasked: their real face
  bare := public.unmasked_pair(uid, p_id) and cardinality(coalesce(p.real_photos, '{}')) > 0;
  open := mid is not null or exists (select 1 from photo_unlocks where viewer = uid and target = p_id);
  return json_build_object(
    'id', p.id, 'name', p.display_name, 'age', public.shown_age(p.birthdate, p.hide_age, p.id), 'gender', p.gender,
    'bio', p.bio, 'interests', p.interests, 'place', p.place_label,
    'intent', null,
    'online', coalesce(p.last_seen_at > now() - interval '150 seconds', false),
    'photos', case when bare then to_json(p.real_photos) when open then to_json(p.photos) else to_json(array[p.photos[1]]) end,
    'photo_count', case when bare then cardinality(p.real_photos) else cardinality(p.photos) end,
    'unmasked', public.unmasked_pair(uid, p_id),
    'photos_unlocked', open,
    'photos_paid', public.setting_int('explore_photos_paid', 1) > 0,
    'match_id', mid,
    'masked_id', (select x.id from masquerade_sessions x where x.source = 'explore' and x.status = 'active'
      and ((x.user_a = uid and x.user_b = p_id) or (x.user_a = p_id and x.user_b = uid)) order by x.started_at desc limit 1),
    'shared_interests', array(select unnest(p.interests) intersect select unnest((select interests from profiles where id = uid))),
    'message_cost', public.setting_int('explore_message_cost', 15),
    'wave_cost', public.setting_int('wave_cost', 0),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    -- Their "things about me" show before you're connected too
    'things', coalesce(p.things, '[]'::jsonb),
    'things_count', coalesce(jsonb_array_length(p.things), 0),
    'shared_words', (array(select unnest(p.thing_keys) intersect select unnest((select thing_keys from profiles where id = uid))))[1:5],
    'i_waved', exists (select 1 from waves w where w.from_id = uid and w.to_id = p_id),
    'waved_me', exists (select 1 from waves w where w.from_id = p_id and w.to_id = uid)
  );
end $function$;


revoke execute on function public.explore_people(text, integer, integer) from public, anon;
grant execute on function public.explore_people(text, integer, integer) to authenticated;
revoke execute on function public.explore_profile(uuid) from public, anon;
grant execute on function public.explore_profile(uuid) to authenticated;
