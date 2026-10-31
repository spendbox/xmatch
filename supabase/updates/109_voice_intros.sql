-- Voice intros: a short hello (up to 10 seconds) people record on their Profile, disguised on
-- the phone or in their real voice. It plays from "Hear me" on their Explore card.
-- Run once in Supabase (SQL Editor → New query → paste → Run), after 108.

alter table public.profiles add column if not exists voice_intro_key text;
alter table public.profiles add column if not exists voice_intro_seconds int;
alter table public.profiles add column if not exists voice_intro_style text;

-- Save your intro (only a file in your own intro folder), or clear it with an empty key
create or replace function public.set_voice_intro(p_key text, p_seconds int default null, p_style text default null) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please log in'; end if;
  if coalesce(p_key, '') = '' then
    update profiles set voice_intro_key = null, voice_intro_seconds = null, voice_intro_style = null where id = uid;
    return json_build_object('key', null);
  end if;
  if p_key not like 'intro/' || uid::text || '/%' or p_key like '%..%' then raise exception 'Not allowed'; end if;
  if coalesce(p_seconds, 0) < 1 or p_seconds > 11 then raise exception 'Voice intros are up to 10 seconds'; end if;
  update profiles set voice_intro_key = p_key, voice_intro_seconds = p_seconds, voice_intro_style = left(coalesce(p_style, ''), 20) where id = uid;
  return json_build_object('key', p_key, 'seconds', p_seconds, 'style', p_style);
end $$;
revoke execute on function public.set_voice_intro(text, int, text) from public, anon;
grant execute on function public.set_voice_intro(text, int, text) to authenticated;

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
  -- Notes are set through set_note (it checks them and starts the 24 hours)
  new.note := old.note;
  new.note_at := old.note_at;
  -- Voice intros are set through set_voice_intro (it checks the file is yours)
  new.voice_intro_key := old.voice_intro_key;
  new.voice_intro_seconds := old.voice_intro_seconds;
  new.voice_intro_style := old.voice_intro_style;
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

-- Explore: each person's voice intro comes with their card
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
          s.gender, s.photo, s.place, null::text as intent, s.online,
          s.connected,
          -- How well you match, 0 to 100, how far away they are, and an interest to show (yours first)
          least(100, greatest(0, round(s.fit)))::int as match,
          case when s.km is not null then greatest(1, round(s.km))::int end as km,
          coalesce((select x from unnest(s.interests) x where x = any(me.interests) limit 1), s.interests[1]) as tag,
          -- What you're both into ("You both like…"), and whether either of you has waved
          array(select x from unnest(s.interests) x where x = any(me.interests) limit 3) as shared,
          exists (select 1 from waves w where w.from_id = uid and w.to_id = s.id) as i_waved,
          exists (select 1 from waves w where w.from_id = s.id and w.to_id = uid) as waved_me,
          -- Their photos to swipe: all of them once you've unlocked or connected, else just the main one
          case when s.connected or exists (select 1 from photo_unlocks u where u.viewer = uid and u.target = s.id)
               then to_json(s.photos_all) else to_json(array[s.photo]) end as photos,
          coalesce(cardinality(s.photos_all), 0) as photo_count,
          (s.connected or exists (select 1 from photo_unlocks u where u.viewer = uid and u.target = s.id)) as photos_unlocked,
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
              p.photos as photos_all, p.created_at as joined_at, p.note, p.note_at, p.voice_intro_key, p.voice_intro_seconds,
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
