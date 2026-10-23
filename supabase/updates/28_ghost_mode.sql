-- Dashpad update: ghost mode, age and mood hidden on the Meet page (Part 28)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run updates 24 to 27 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 28: Ghost mode, and less shown on the Meet page
-- Ghost mode hides you from the Meet page. It costs Keys for 30 days (100 by
-- default, set in admin); switch it off and on as you like while it lasts.
-- Age shows only to people you're connected with; mood only in your chat.
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value) values ('ghost_cost', 100) on conflict (key) do nothing;
alter table public.profiles add column if not exists ghost_on boolean not null default false;
alter table public.profiles add column if not exists ghost_until timestamptz;

-- Switch ghost mode on (paying for 30 days if you haven't already) or off
create or replace function public.set_ghost(p_on boolean) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  cost int := public.setting_int('ghost_cost', 100);
  bal int;
  paid boolean := false;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into p from profiles where id = uid for update;
  if p_on and (p.ghost_until is null or p.ghost_until <= now()) then
    if cost > 0 then bal := public.spend_keys(uid, cost, 'ghost', null); end if;
    update profiles set ghost_on = true, ghost_until = now() + interval '30 days' where id = uid returning * into p;
    paid := true;
  else
    update profiles set ghost_on = p_on where id = uid returning * into p;
  end if;
  if bal is null then select balance into bal from wallets where user_id = uid; end if;
  return json_build_object('on', p.ghost_on and p.ghost_until > now(), 'until', p.ghost_until, 'paid', paid, 'balance', coalesce(bal, 0), 'cost', cost);
end $$;

create or replace function public.explore_visible(v uuid, o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select v <> o and exists (
    select 1 from profiles p left join accounts_private a on a.user_id = p.id
    where p.id = o and p.display_name is not null and p.birthdate is not null and p.gender is not null
      and cardinality(p.photos) > 0 and a.banned_at is null
      -- Ghost mode: hidden from Meet while it lasts
      and not (p.ghost_on and p.ghost_until > now()))
    and not public.is_blocked(v, o)
$$;


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
        -- Age only for people you're connected with; what they're in the mood for only shows in your chat
        select p.id, p.display_name as name,
          case when public.explore_match_id(uid, p.id) is not null then public.age_years(p.birthdate) end as age,
          p.gender, p.photos[1] as photo,
          p.place_label as place, null::text as intent,
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
    'photos_cost', public.setting_int('explore_photos_cost', 5)
  );
end $$;
revoke all on function public.explore_visible(uuid, uuid) from public, anon, authenticated;
