-- Dashpad update: smarter People for you, and one name change (Part 34)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 33 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 34: Who's most likely to reply comes first
-- For each person Dashpad quietly keeps (and refreshes every few hours, a few
-- hundred at a time): how quickly they reply, how often they reply when someone
-- writes to them, and how many messages they sent this week. With how recently
-- they were online, these lift people on Meet and in People for you. Nobody sees
-- these numbers.
-- Names can be changed once after signing up.
-- ---------------------------------------------------------------------------
alter table public.reply_stats add column if not exists reply_rate real;
alter table public.reply_stats add column if not exists sent_7d int;
alter table public.profiles add column if not exists name_changes smallint not null default 0;

-- How often someone replies when written to (last 60 days; empty if too few chats), and messages sent this week
create or replace function public.chat_habits_compute(p uuid) returns table (rate real, sent int)
language sql stable security definer set search_path = public as $$
  with convos as (
    select m.match_id::text as chat,
      bool_or(m.sender_id is not null and m.sender_id <> p) as they_wrote,
      bool_or(m.sender_id = p) as i_wrote,
      count(*) filter (where m.sender_id = p and m.created_at > now() - interval '7 days') as sent
    from messages m join matches x on x.id = m.match_id
    where p in (x.user_a, x.user_b) and m.created_at > now() - interval '60 days'
    group by 1
    union all
    select mm.session_id::text,
      bool_or(mm.sender_id is not null and mm.sender_id <> p),
      bool_or(mm.sender_id = p),
      count(*) filter (where mm.sender_id = p and mm.created_at > now() - interval '7 days')
    from masquerade_messages mm join masquerade_sessions s on s.id = mm.session_id
    where p in (s.user_a, s.user_b) and mm.created_at > now() - interval '60 days'
    group by 1
  )
  select
    case when count(*) filter (where they_wrote) >= 2
      then (count(*) filter (where they_wrote and i_wrote))::real / count(*) filter (where they_wrote) end,
    coalesce(sum(sent), 0)::int
  from convos
$$;
revoke all on function public.chat_habits_compute(uuid) from public, anon, authenticated;

create or replace function public.refresh_reply_stats(p_limit int default 300) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  h record;
  n int := 0;
begin
  for r in
    select p.id from profiles p left join reply_stats s on s.user_id = p.id
    where p.last_seen_at > now() - interval '1 day'
      and (s.user_id is null or s.updated_at < now() - interval '6 hours')
    order by s.updated_at nulls first
    limit greatest(1, least(p_limit, 2000))
  loop
    select * into h from public.chat_habits_compute(r.id);
    insert into reply_stats (user_id, seconds, reply_rate, sent_7d, updated_at)
    values (r.id, public.reply_seconds_compute(r.id), h.rate, h.sent, now())
    on conflict (user_id) do update set seconds = excluded.seconds, reply_rate = excluded.reply_rate,
      sent_7d = excluded.sent_7d, updated_at = excluded.updated_at;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.refresh_reply_stats(int) from public, anon, authenticated;

-- Fill in the new numbers now (they refresh by themselves after this)
update public.reply_stats set updated_at = now() - interval '7 hours';
select public.refresh_reply_stats(2000);

create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
declare
  url text;
begin
  if current_user <> 'authenticated' then return new; end if;
  new.id := old.id;
  new.created_at := old.created_at;
  -- Your name can be changed once after signing up
  if new.display_name is distinct from old.display_name and old.display_name is not null and cardinality(coalesce(old.photos, '{}')) > 0 then
    if old.name_changes >= 1 then raise exception 'You''ve already changed your name once'; end if;
    new.name_changes := old.name_changes + 1;
  else
    new.name_changes := old.name_changes;
  end if;
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
  -- Photos: up to 6, and only ones uploaded to your own folder on Dashpad
  if cardinality(coalesce(new.photos, '{}')) > 6 then raise exception 'Up to 6 photos'; end if;
  foreach url in array coalesce(new.photos, '{}') loop
    -- (only new ones are checked, so older photos never get in the way)
    if not (url = any(coalesce(old.photos, '{}'))) and position('/storage/v1/object/public/photos/' || new.id::text || '/' in url) = 0 then
      raise exception 'Photos must be uploaded to Dashpad';
    end if;
  end loop;
  if cardinality(coalesce(new.interests, '{}')) > 12 then raise exception 'Too many interests'; end if;
  return new;
end $$;

create or replace function public.explore_people(p_q text default null, p_limit int default 50, p_offset int default 0) returns json
language plpgsql stable security definer set search_path = public as $$
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
        -- Age only for people you're connected with; what they're in the mood for only shows in your chat
        select s.id, s.name,
          case when public.explore_match_id(uid, s.id) is not null then s.age end as age,
          s.gender, s.photo, s.place, null::text as intent, s.online,
          public.explore_match_id(uid, s.id) is not null as connected,
          row_number() over (order by s.score desc, s.km asc nulls last, s.last_seen_at desc) as rank
        from (
          select c.*,
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
              (p.last_seen_at > now() - interval '5 minutes') as online,
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
end $$;
