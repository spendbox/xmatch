-- 1. Admin → Overview: what mood people are choosing (Friends, Dating, Spicy link-up): everyone,
--    people active this week, online now, and Masquerade switched on, with women and men.
-- 2. "Things about me" answers were being cut to 60 characters when saved (the app allows more),
--    so long answers ended mid-word. Now up to 200, which fits your own question and answer for
--    "Something else about me". Answers already cut can't be recovered: edit them to finish them.
-- Run once in Supabase (SQL Editor → New query → paste → Run).

create or replace function public.admin_moods() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.total desc), '[]'::json) from (
    select p.pref_intent as intent,
      count(*)::int as total,
      count(*) filter (where p.last_seen_at > now() - interval '7 days')::int as active_7d,
      count(*) filter (where p.last_seen_at > now() - interval '150 seconds')::int as online,
      count(*) filter (where p.open_to_masquerade)::int as masquerade_on,
      count(*) filter (where p.gender = 'woman')::int as women,
      count(*) filter (where p.gender = 'man')::int as men
    from profiles p
    left join accounts_private a on a.user_id = p.id
    -- Finished signing up, and not banned
    where p.display_name is not null and p.birthdate is not null and p.gender is not null and a.banned_at is null
    group by p.pref_intent
  ) t
$$;
-- Only Dashpad's server (Admin) can see this
revoke execute on function public.admin_moods() from public, anon, authenticated;

-- Save your things (each is a prompt id and an answer; up to 40). Answers up to 200 characters.
create or replace function public.set_things(p_things jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean jsonb;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if jsonb_typeof(p_things) <> 'array' then raise exception 'Something went wrong'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('p', p, 'a', a) order by n), '[]'::jsonb) into clean from (
    select left(btrim(x->>'p'), 24) as p, left(regexp_replace(btrim(x->>'a'), '\s+', ' ', 'g'), 200) as a, n
    from jsonb_array_elements(p_things) with ordinality as e(x, n)
    where coalesce(btrim(x->>'a'), '') <> '' and coalesce(btrim(x->>'p'), '') <> ''
    limit 40
  ) t;
  update profiles set things = clean where id = uid;
  return json_build_object('things', clean, 'count', jsonb_array_length(clean));
end $$;
