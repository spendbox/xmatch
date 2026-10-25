-- Dashpad update: quiet pairs can meet again after a week (Part 59)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 58 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 59: An hourly pair where you didn't both send a message can be paired again,
-- but only after 7 days, so it isn't the same silent person every hour. Pairs that
-- talked, unmasked, or where someone tapped Let go still never repeat.
-- ---------------------------------------------------------------------------
create or replace function public.run_hourly_pairing_batch(p_budget int default 3000) returns json
language plpgsql security definer set search_path = public as $$
declare
  h timestamptz := date_trunc('hour', now());
  hr masquerade_hours;
  r record;
  partner record;
  ids uuid[];
  pid uuid;
  sid uuid;
  a1 text;
  q text;
  n int := 0;
  lvl smallint;
  t int;
  left_n int;
begin
  -- Close chats from hours that have ended
  for r in select id from masquerade_sessions
           where hour_at is not null and status = 'active' and reopened_at is null and ends_at <= now()
           limit 2000 loop
    perform public.finalize_masquerade(r.id);
  end loop;

  if not public.pairing_hour_open(h) then return json_build_object('made', 0, 'left', 0); end if;
  perform pg_advisory_xact_lock(515151);
  select * into hr from masquerade_hours where hour_at = h;
  if not found then
    insert into masquerade_hours (hour_at) values (h);
    -- Too late in the hour to start a fair chat: wait for the next one
    if now() > h + interval '45 minutes' then
      update masquerade_hours set note = 'late', finished_at = now() where hour_at = h;
      return json_build_object('made', 0, 'left', 0);
    end if;
    delete from hour_pool where hour_at < h;
    insert into hour_pool (hour_at, id, gender, pref_intent, pref_seeking, pref_age_min, pref_age_max, pref_spice,
                           interests, thing_keys, age, place_country, place_region, place_continent, rs, rnd)
    select h, p.id, p.gender, p.pref_intent, p.pref_seeking, p.pref_age_min, p.pref_age_max, p.pref_spice,
      p.interests, p.thing_keys, public.age_years(p.birthdate), p.place_country, p.place_region, p.place_continent,
      coalesce(public.reply_seconds(p.id), 1800), random()
    from profiles p
    left join accounts_private a on a.user_id = p.id
    where p.open_to_masquerade
      and p.last_seen_at > now() - interval '24 hours'
      and p.display_name is not null and p.birthdate is not null and p.gender is not null
      and cardinality(p.photos) > 0
      and a.banned_at is null;
    -- Fresh numbers about the list, so finding partners uses the indexes
    analyze public.hour_pool;
    update masquerade_hours set eligible = (select count(*) from hour_pool where hour_at = h) where hour_at = h;
  elsif hr.finished_at is not null then
    return json_build_object('made', 0, 'left', 0);
  elsif now() > h + interval '45 minutes' then
    -- Ran out of time this hour: whoever is left waits for the next one
    update masquerade_hours set finished_at = now(), note = coalesce(note, 'unfinished') where hour_at = h;
    delete from hour_pool where hour_at = h;
    return json_build_object('made', 0, 'left', 0);
  end if;

  -- Quick repliers choose first, so they get the best fits
  for r in select * from hour_pool where hour_at = h and not tried order by rs, rnd limit greatest(1, p_budget) loop
    -- Already taken as someone's partner in this batch
    continue when not exists (select 1 from hour_pool where hour_at = h and id = r.id);
    update hour_pool set tried = true where hour_at = h and id = r.id;
    pid := null;
    -- Closest first: same state, then same country, then same continent, then anywhere
    for t in 1..4 loop
      ids := null;
      if t = 1 then
        select array_agg(c.id) into ids from (
          select c.id from hour_pool c
          where c.hour_at = h and c.pref_intent = r.pref_intent and c.place_country = r.place_country and c.place_region = r.place_region
            and c.id <> r.id
            and public.gender_fits(r.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, r.gender)
            and c.age between r.pref_age_min and r.pref_age_max and r.age between c.pref_age_min and c.pref_age_max
          limit 100) c;
      elsif t = 2 then
        select array_agg(c.id) into ids from (
          select c.id from hour_pool c
          where c.hour_at = h and c.pref_intent = r.pref_intent and c.place_country = r.place_country
            and c.id <> r.id
            and public.gender_fits(r.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, r.gender)
            and c.age between r.pref_age_min and r.pref_age_max and r.age between c.pref_age_min and c.pref_age_max
          limit 100) c;
      elsif t = 3 then
        select array_agg(c.id) into ids from (
          select c.id from hour_pool c
          where c.hour_at = h and c.pref_intent = r.pref_intent and c.place_continent = r.place_continent
            and c.id <> r.id
            and public.gender_fits(r.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, r.gender)
            and c.age between r.pref_age_min and r.pref_age_max and r.age between c.pref_age_min and c.pref_age_max
          limit 100) c;
      else
        select array_agg(c.id) into ids from (
          select c.id from hour_pool c
          where c.hour_at = h and c.pref_intent = r.pref_intent
            and c.id <> r.id
            and public.gender_fits(r.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, r.gender)
            and c.age between r.pref_age_min and r.pref_age_max and r.age between c.pref_age_min and c.pref_age_max
          limit 100) c;
      end if;
      continue when ids is null;
      -- The 15 with the most in common (interests, and words from "things about me"), then the safety checks
      select c.* into partner from (
        select c.*, public.shared_count(r.interests, c.interests) + 2 * least(public.shared_count(r.thing_keys, c.thing_keys), 5) as fit
        from hour_pool c
        where c.hour_at = h and c.id = any(ids)
        order by fit desc, (c.rs < 600) desc, c.rs, c.rnd
        limit 15
      ) c
      where not public.is_blocked(r.id, c.id)
        and not public.already_matched(r.id, c.id)
        -- New people every time. A pair that never both talked can meet again, but not
        -- for 7 days, so the same quiet person doesn't come back hour after hour.
        and not exists (select 1 from masquerade_sessions s
                        where s.hour_at is not null
                          and ((s.user_a = r.id and s.user_b = c.id) or (s.user_a = c.id and s.user_b = r.id))
                          and not (s.status = 'ended' and s.ended_reason = 'quiet' and s.hour_at < now() - interval '7 days'))
      order by c.fit desc, (c.rs < 600) desc, c.rs, c.rnd
      limit 1;
      if found then
        pid := partner.id;
        exit;
      end if;
    end loop;
    continue when pid is null;

    a1 := public.random_alias();
    lvl := round((r.pref_spice + partner.pref_spice) / 2.0)::smallint;
    insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, hour_at)
    values (r.id, partner.id, r.pref_intent, r.pref_spice, partner.pref_spice, lvl, a1, public.random_alias(a1), now(), h + interval '1 hour', h)
    returning id into sid;
    q := public.pick_icebreaker(sid, lvl, null);
    if q is not null then
      insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q);
    end if;
    delete from hour_pool where hour_at = h and id in (r.id, partner.id);
    n := n + 1;
  end loop;

  select count(*) into left_n from hour_pool where hour_at = h and not tried;
  update masquerade_hours set pairs = pairs + n, finished_at = case when left_n = 0 then now() end where hour_at = h;
  if left_n = 0 then delete from hour_pool where hour_at = h; end if;
  return json_build_object('made', n, 'left', left_n);
end $$;
revoke execute on function public.run_hourly_pairing_batch(int) from public, anon, authenticated;
