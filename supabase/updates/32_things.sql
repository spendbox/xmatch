-- Dashpad update: things about you, the setup checklist and its reward (Part 32)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 31 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 32: Things about you
-- Everyone can fill in cards like "My comfort food is… Jollof rice". When they
-- save, the key words are pulled out once (jollof, rice) and kept beside them.
-- Matching then just counts shared words: no AI, and cheap, because the words
-- are worked out on save, not while matching.
-- Finishing the setup checklist (where you are, notifications, 10 things) earns
-- Keys once (5 by default, set in admin).
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists things jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists thing_keys text[] not null default '{}';
alter table public.accounts_private add column if not exists setup_reward_at timestamptz;
insert into public.app_settings (key, value) values ('setup_reward', 5) on conflict (key) do nothing;

-- The key words in someone's answers: lower case, no little words, "jollof rice" -> {jollof, rice}
create or replace function public.thing_keywords(t jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct w order by w), '{}') from (
    select case when length(w) > 4 and w like '%s' and w not like '%ss' then left(w, -1) else w end as w
    from jsonb_array_elements(case when jsonb_typeof(t) = 'array' then t else '[]'::jsonb end) x,
      regexp_split_to_table(lower(coalesce(x->>'a', '')), '[^[:alnum:]]+') w
    where length(w) >= 3
      and w not in ('the','and','for','with','you','your','are','but','not','all','any','can','get','got','has','have',
        'her','him','his','its','just','like','love','loves','lot','lots','make','more','most','much','myself','nothing',
        'one','our','out','really','she','that','them','then','there','they','this','too','very','was','way','what',
        'when','who','why','will','yes','also','about','into','over','some','than','from','being','been','does','doing',
        'every','everything','good','great','thing','things','time','day','days','best','favourite','favorite')
  ) k
$$;

create or replace function public.profiles_thing_keys() returns trigger
language plpgsql as $$
begin
  new.thing_keys := public.thing_keywords(new.things);
  return new;
end $$;
drop trigger if exists profiles_thing_keys on public.profiles;
create trigger profiles_thing_keys before insert or update of things on public.profiles
  for each row execute function public.profiles_thing_keys();

-- Save your things (each is a prompt id and a short answer; up to 40)
create or replace function public.set_things(p_things jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean jsonb;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if jsonb_typeof(p_things) <> 'array' then raise exception 'Something went wrong'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('p', p, 'a', a) order by n), '[]'::jsonb) into clean from (
    select left(btrim(x->>'p'), 24) as p, left(regexp_replace(btrim(x->>'a'), '\s+', ' ', 'g'), 60) as a, n
    from jsonb_array_elements(p_things) with ordinality as e(x, n)
    where coalesce(btrim(x->>'a'), '') <> '' and coalesce(btrim(x->>'p'), '') <> ''
    limit 40
  ) t;
  update profiles set things = clean where id = uid;
  return json_build_object('things', clean, 'count', jsonb_array_length(clean));
end $$;

-- The Home checklist: what's done, and whether the Keys were claimed
create or replace function public.setup_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'place', p.place_country is not null,
    'push', exists (select 1 from push_subscriptions s where s.user_id = p.id),
    'things', jsonb_array_length(p.things),
    'claimed', a.setup_reward_at is not null,
    'reward', public.setting_int('setup_reward', 5))
  from profiles p left join accounts_private a on a.user_id = p.id
  where p.id = auth.uid()
$$;

-- Claim the Keys once everything is done. Notifications count unless this phone can't do them.
create or replace function public.claim_setup_reward(p_no_push boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  reward int := public.setting_int('setup_reward', 5);
  bal int;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into p from profiles where id = uid;
  insert into accounts_private (user_id) values (uid) on conflict (user_id) do nothing;
  perform 1 from accounts_private where user_id = uid for update;
  if (select setup_reward_at from accounts_private where user_id = uid) is not null then raise exception 'Already claimed'; end if;
  if p.place_country is null then raise exception 'Add where you are first'; end if;
  if jsonb_array_length(p.things) < 10 then raise exception 'Add 10 things about you first'; end if;
  if not p_no_push and not exists (select 1 from push_subscriptions where user_id = uid) then
    raise exception 'Turn on notifications first';
  end if;
  update accounts_private set setup_reward_at = now() where user_id = uid;
  bal := case when reward > 0 then public.add_keys(uid, reward, 'setup') else (select balance from wallets where user_id = uid) end;
  return json_build_object('reward', reward, 'balance', coalesce(bal, 0));
end $$;

-- Admin: the most common answers, as ideas for new This or That cards
create or replace function public.admin_thing_ideas(p_limit int default 60) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select x->>'p' as prompt, initcap(lower(btrim(x->>'a'))) as answer, count(*)::int as people
    from profiles, jsonb_array_elements(things) x
    group by 1, 2
    having count(*) >= 1
    order by count(*) desc, 2
    limit greatest(1, least(p_limit, 200))
  ) t
$$;
revoke all on function public.admin_thing_ideas(int) from public, anon, authenticated;

-- Hourly pairing: also prefers people who share words from their things
create or replace function public.run_hourly_pairing() returns int
language plpgsql security definer set search_path = public as $$
declare
  h timestamptz := date_trunc('hour', now());
  r record;
  partner record;
  sid uuid;
  a1 text;
  q text;
  n int := 0;
  lvl smallint;
begin
  -- Close chats from hours that have ended
  for r in select id from masquerade_sessions
           where hour_at is not null and status = 'active' and reopened_at is null and ends_at <= now() loop
    perform public.finalize_masquerade(r.id);
  end loop;

  if not public.pairing_hour_open(h) then return 0; end if;
  perform pg_advisory_xact_lock(515151);
  if exists (select 1 from masquerade_hours where hour_at = h) then return 0; end if;
  insert into masquerade_hours (hour_at) values (h);
  -- Too late in the hour to start a fair chat: wait for the next one
  if now() > h + interval '45 minutes' then
    update masquerade_hours set note = 'late' where hour_at = h;
    return 0;
  end if;

  drop table if exists pg_temp.hour_pool;
  create temp table hour_pool on commit drop as
    select p.id, p.gender, p.pref_intent, p.pref_seeking, p.pref_age_min, p.pref_age_max, p.pref_spice,
      p.interests, p.thing_keys, public.age_years(p.birthdate) as age, p.place_country, p.place_region, p.place_continent,
      coalesce(public.reply_seconds(p.id), 1800) as rs, random() as rnd
    from profiles p
    left join accounts_private a on a.user_id = p.id
    where p.open_to_masquerade
      and p.last_seen_at > now() - interval '24 hours'
      and p.display_name is not null and p.birthdate is not null and p.gender is not null
      and cardinality(p.photos) > 0
      and a.banned_at is null;

  update masquerade_hours set eligible = (select count(*) from hour_pool) where hour_at = h;

  -- Quick repliers choose first, so they get the best fits
  for r in select * from hour_pool order by rs, rnd loop
    continue when not exists (select 1 from hour_pool where id = r.id);
    select c.* into partner from hour_pool c
    where c.id <> r.id
      and c.pref_intent = r.pref_intent
      and public.gender_fits(r.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, r.gender)
      and c.age between r.pref_age_min and r.pref_age_max
      and r.age between c.pref_age_min and c.pref_age_max
      and not public.is_blocked(r.id, c.id)
      and not public.already_matched(r.id, c.id)
      -- New people every time (a pair that never talked can meet again)
      and not exists (select 1 from masquerade_sessions s
                      where s.hour_at is not null
                        and ((s.user_a = r.id and s.user_b = c.id) or (s.user_a = c.id and s.user_b = r.id))
                        and not (s.status = 'ended' and s.ended_reason = 'quiet'))
    -- Closest first: same state, then same country, then same continent, then anywhere
    order by (c.place_country = r.place_country and c.place_region = r.place_region) desc nulls last,
      (c.place_country = r.place_country) desc nulls last,
      (c.place_continent = r.place_continent) desc nulls last,
      -- What you have in common: interests, and words from your "things about me"
      public.shared_count(r.interests, c.interests) + 2 * least(public.shared_count(r.thing_keys, c.thing_keys), 5) desc,
      (c.rs < 600) desc, c.rs, c.rnd
    limit 1;
    continue when not found;

    a1 := public.random_alias();
    lvl := round((r.pref_spice + partner.pref_spice) / 2.0)::smallint;
    insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, hour_at)
    values (r.id, partner.id, r.pref_intent, r.pref_spice, partner.pref_spice, lvl, a1, public.random_alias(a1), now(), h + interval '1 hour', h)
    returning id into sid;
    q := public.pick_icebreaker(sid, lvl, null);
    if q is not null then
      insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q);
    end if;
    delete from hour_pool where id in (r.id, partner.id);
    n := n + 1;
  end loop;

  update masquerade_hours set pairs = n where hour_at = h;
  return n;
end $$;

-- Meet: shared words count towards the ranking
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
            + (case when c.online then 8 when c.last_seen_at > now() - interval '1 day' then 4 else 0 end)
            as score
          from (
            select p.id, p.display_name as name, public.age_years(p.birthdate) as age, p.gender, p.photos[1] as photo,
              p.place_label as place, p.place_country, p.place_region, p.pref_seeking, p.pref_intent,
              p.pref_age_min, p.pref_age_max, p.interests, p.thing_keys, p.last_seen_at,
              (p.last_seen_at > now() - interval '5 minutes') as online,
              public.distance_km(mlat, mlng, a.lat, a.lng) as km
            from (
              -- Search looks at everyone; otherwise the most recently active people
              select * from profiles p0
              where case when q is not null then p0.display_name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%'
                         else p0.last_seen_at > now() - interval '30 days' end
              order by p0.last_seen_at desc nulls last
              limit 600
            ) p
            left join accounts_private a on a.user_id = p.id
            where public.explore_visible(uid, p.id)
          ) c
        ) s
        order by rank
        limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
      ) t), '[]'::json)
  );
end $$;

-- Masked chats: words you both used
create or replace function public.get_masquerade(p_session uuid) returns json
language plpgsql security definer set search_path = public as $$
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
  pair := s.hour_at is not null or s.meet_id is not null;
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
    'reopened', s.reopened_at is not null,
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
      -- Ages aren't shown in chats
      'age', null,
      'gender', op.gender,
      'interests', op.interests,
      'shared_interests', array(select unnest(op.interests) intersect select unnest(mp.interests)),
      -- Words you both used in "things about me"
      'shared_words', (array(select unnest(op.thing_keys) intersect select unnest(mp.thing_keys)))[1:5],
      'distance_km', null,
      'place', op.place_label,
      'same_place', op.place_country = mp.place_country and op.place_region = mp.place_region,
      'connections', (select count(*) from matches x where op.id in (x.user_a, x.user_b)),
      'reply_seconds', public.reply_seconds(op.id),
      'has_voted', (case when i_am_a then s.unmask_b else s.unmask_a end) is not null,
      -- Whether they're in the app right now, and roughly how long since they were
      'online', coalesce(op.last_seen_at > now() - interval '2 minutes', false),
      'seen_minutes', case when op.last_seen_at is not null then floor(extract(epoch from now() - op.last_seen_at) / 60)::int end,
      -- Only revealed after you both unmask
      'profile', case when s.status = 'matched' then json_build_object(
        'id', op.id, 'display_name', op.display_name, 'bio', op.bio, 'photos', op.photos
      ) else null end
    )
  );
end $$;

-- Meet profiles: their things, and the words you both used
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
    'shared_interests', array(select unnest(p.interests) intersect select unnest((select interests from profiles where id = uid))),
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    -- Their "things about me", and the words you both used
    'things', p.things,
    'shared_words', (array(select unnest(p.thing_keys) intersect select unnest((select thing_keys from profiles where id = uid))))[1:5]
  );
end $$;
