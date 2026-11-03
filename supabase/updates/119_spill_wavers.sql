-- Dashpad update: see who waved at you in the Spill (Part 119)
-- Run this once in Supabase, after update 115: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- After you spill, waves you get from people who answered too now come with who they are (their
-- mask name in the Spill, their answer and voice), so you can wave back. If you both wave, a free
-- masked chat opens, the same as waving on Meet.

create or replace function public.truth_today() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d date := public.truth_day();
  t truths;
  mine truth_answers;
  streak int := 0;
  k date;
  ends timestamptz;
  total int;
  res json := null;
begin
  if uid is null then return null; end if;
  select * into t from truths where day = d and active;
  if not found then
    -- Nothing on for today (none set, or the one set was switched off in Admin):
    -- use the next question that hasn't had a day yet
    begin
      update truths set day = null where day = d and not active;
      update truths set day = d
      where id = (select id from truths where day is null and active order by id limit 1) and day is null
      returning * into t;
    exception when unique_violation then
      -- Someone else just picked today's
      null;
    end;
    if t.id is null then
      select * into t from truths where day = d and active;
      if not found then return json_build_object('none', true); end if;
    end if;
  end if;
  select * into mine from truth_answers where truth_id = t.id and user_id = uid;
  -- Your streak: days in a row you've answered (today counts once you answer)
  k := case when mine.id is null then d - 1 else d end;
  while streak < 400 and exists (
    select 1 from truth_answers a join truths x on x.id = a.truth_id where a.user_id = uid and x.day = k
  ) loop
    streak := streak + 1;
    k := k - 1;
  end loop;
  ends := ((d + 1)::timestamp + make_interval(hours => least(23, greatest(0, public.setting_int('truths_hour', 20))))) at time zone 'Africa/Lagos';
  select count(*)::int into total from truth_answers where truth_id = t.id;

  if mine.id is not null then
    select json_build_object(
      'counts', coalesce((select json_object_agg(choice, n) from (select choice, count(*)::int n from truth_answers where truth_id = t.id group by choice) c), '{}'::json),
      'women', coalesce((select json_object_agg(choice, n) from (select a.choice, count(*)::int n from truth_answers a join profiles p on p.id = a.user_id where a.truth_id = t.id and p.gender = 'woman' group by a.choice) c), '{}'::json),
      'men', coalesce((select json_object_agg(choice, n) from (select a.choice, count(*)::int n from truth_answers a join profiles p on p.id = a.user_id where a.truth_id = t.id and p.gender = 'man' group by a.choice) c), '{}'::json),
      'voices', coalesce((select json_agg(v order by v.same desc, v.listens desc, v.at desc) from (
        select a.id, a.alias, a.choice, a.voice_key as key, a.voice_seconds as seconds, a.listens, a.created_at as at,
          a.user_id as person, a.choice = mine.choice as same,
          public.shown_age(p.birthdate, p.hide_age, p.id) as age, p.gender,
          exists (select 1 from waves w where w.from_id = uid and w.to_id = a.user_id) as waved,
          public.explore_visible(uid, a.user_id) as can_wave
        from truth_answers a join profiles p on p.id = a.user_id
        where a.truth_id = t.id and a.voice_key is not null and not a.hidden and a.user_id <> uid
          and not public.is_blocked(uid, a.user_id)
        order by a.choice = mine.choice desc, a.listens desc, a.created_at desc
        limit 80) v), '[]'::json),
      -- Waves you've had since you answered, from people who answered too
      'waves', (select count(*)::int from waves w join truth_answers a on a.user_id = w.from_id and a.truth_id = t.id
                where w.to_id = uid and w.created_at >= mine.created_at and not public.is_blocked(uid, a.user_id)),
      -- And who they are (by their mask name here), so you can wave back
      'wavers', coalesce((select json_agg(x order by x.at desc) from (
        select a.id, a.alias, a.choice, a.voice_key as key, a.voice_seconds as seconds, w.created_at as at,
          a.user_id as person, public.shown_age(p.birthdate, p.hide_age, p.id) as age, p.gender,
          exists (select 1 from waves b where b.from_id = uid and b.to_id = a.user_id) as waved
        from waves w
        join truth_answers a on a.user_id = w.from_id and a.truth_id = t.id
        join profiles p on p.id = a.user_id
        where w.to_id = uid and w.created_at >= mine.created_at and not public.is_blocked(uid, a.user_id)
        order by w.created_at desc
        limit 50) x), '[]'::json)
    ) into res;
  end if;

  return json_build_object(
    'id', t.id, 'body', t.body, 'options', t.options, 'day', d, 'ends_at', ends, 'total', total, 'streak', streak,
    'mine', case when mine.id is null then null else json_build_object(
      'choice', mine.choice, 'alias', mine.alias, 'key', mine.voice_key, 'seconds', mine.voice_seconds, 'listens', mine.listens) end,
    'results', res);
end $$;
