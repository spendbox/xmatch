-- Dashpad update: ghost mode covers events too (Part 30)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 29 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 30: Ghost mode hides you on event walls too
-- People in ghost mode don't show on the wall at events they attend, and nobody
-- new can start a chat with them there. Chats they already have carry on, and
-- they can still be paired in Masquerade.
-- ---------------------------------------------------------------------------
create or replace function public.is_ghost(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select ghost_on and ghost_until > now() from profiles where id = p_user), false)
$$;
revoke all on function public.is_ghost(uuid) from public, anon, authenticated;

create or replace function public.event_wall(p_event uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e masquerade_events;
  me profiles;
begin
  select * into e from masquerade_events where id = p_event;
  if not found or e.kind = 'masquerade' then raise exception 'Not available'; end if;
  if not exists (select 1 from event_attendees where event_id = p_event and user_id = uid) then raise exception 'Say you’re going first'; end if;
  if now() < e.starts_at then return '[]'::json; end if;
  select * into me from profiles where id = uid;
  return coalesce((
    select json_agg(row_to_json(t) order by t.shared desc, t.sort_key) from (
      select p.id as user_id, coalesce(a.alias, 'Masked guest') as name,
        public.age_years(p.birthdate) as age, p.gender, a.featured_blur as blur,
        case when r.target is not null then a.featured_photo end as photo,
        (r.target is not null) as revealed,
        public.shared_count(p.interests, me.interests) as shared,
        p.interests,
        (select c.id from event_chats c where c.event_id = p_event and c.user_a = least(uid, p.id) and c.user_b = greatest(uid, p.id)) as chat_id,
        md5(p.id::text || p_event::text) as sort_key
      from event_attendees a
      join profiles p on p.id = a.user_id
      left join event_reveals r on r.event_id = p_event and r.viewer = uid and r.target = p.id
      where a.event_id = p_event and a.user_id <> uid
        and public.gender_fits(me.pref_seeking, p.gender) and public.gender_fits(p.pref_seeking, me.gender)
        and not public.is_blocked(uid, p.id)
        -- Ghost mode: hidden, unless you already have a chat with them here
        and (not public.is_ghost(p.id) or exists (select 1 from event_chats c
          where c.event_id = p_event and c.user_a = least(uid, p.id) and c.user_b = greatest(uid, p.id)))
    ) t
  ), '[]'::json);
end $$;

create or replace function public.start_event_chat(p_event uuid, p_target uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e masquerade_events;
  cid uuid;
  me profiles;
  them profiles;
begin
  select * into e from masquerade_events where id = p_event;
  if not found or e.kind = 'masquerade' or e.status <> 'published' then raise exception 'Not available'; end if;
  if now() < e.starts_at then raise exception 'The event hasn’t started yet'; end if;
  if now() >= e.ends_at then raise exception 'This event has ended'; end if;
  if uid = p_target then raise exception 'That’s you'; end if;
  if not exists (select 1 from event_attendees where event_id = p_event and user_id = uid)
     or not exists (select 1 from event_attendees where event_id = p_event and user_id = p_target) then
    raise exception 'They’re not at this event';
  end if;
  if public.is_blocked(uid, p_target) then raise exception 'Not available'; end if;
  select * into me from profiles where id = uid;
  select * into them from profiles where id = p_target;
  if not (public.gender_fits(me.pref_seeking, them.gender) and public.gender_fits(them.pref_seeking, me.gender)) then
    raise exception 'Not available';
  end if;
  select id into cid from event_chats where event_id = p_event and user_a = least(uid, p_target) and user_b = greatest(uid, p_target);
  if cid is not null then return cid; end if;
  if public.is_ghost(p_target) then raise exception 'Not available'; end if;
  if (select count(*) from event_chats where event_id = p_event and opened_by = uid and status = 'open')
     >= public.event_int(e, 'max_chats', 5) then
    raise exception 'MAX_CHATS';
  end if;
  insert into event_chats (event_id, user_a, user_b, opened_by)
  values (p_event, least(uid, p_target), greatest(uid, p_target), uid)
  returning id into cid;
  return cid;
end $$;
