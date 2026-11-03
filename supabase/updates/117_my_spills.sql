-- Dashpad update: My Spills, a private list on your Profile (Part 117)
-- Run this once in Supabase, after updates 115 and 116: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- Everything you've answered in the daily Spill, newest first: the question, your answer, how many
-- people agreed, your voice note and its listens. Only you can see it: nobody else (not even
-- people you chat with) can see your answers, and they never show on your profile.

create or replace function public.my_spills(p_before date default null, p_limit int default 30) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(r order by r.day desc), '[]'::json) from (
    select t.id, t.day, t.body, t.options, a.choice, a.voice_key as key, a.voice_seconds as seconds,
      a.voice_style as style, a.listens, a.hidden,
      (select count(*)::int from truth_answers x where x.truth_id = t.id) as total,
      (select count(*)::int from truth_answers x where x.truth_id = t.id and x.choice = a.choice) as same
    from truth_answers a join truths t on t.id = a.truth_id
    where a.user_id = auth.uid() and t.day is not null and (p_before is null or t.day < p_before)
    order by t.day desc
    limit least(greatest(p_limit, 1), 60)
  ) r
$$;
revoke all on function public.my_spills(date, int) from public, anon;
grant execute on function public.my_spills(date, int) to authenticated;
