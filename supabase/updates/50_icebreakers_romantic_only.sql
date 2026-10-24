-- Dashpad update: icebreakers only for dating and spicy (Part 50)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 49 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 50: The icebreaker questions are written for dating, so friendship chats
-- don't get them any more (masked or connected). Questions an admin wrote for a
-- specific Masquerade Night still show in that night's chats.
-- ---------------------------------------------------------------------------
create or replace function public.pick_icebreaker(p_session uuid, p_spice smallint, p_event uuid) returns text
language sql volatile security definer set search_path = public as $$
  select body from (
    select body, 0 as pri from icebreakers i
    where p_event is not null and i.event_id = p_event and i.active
      and not exists (select 1 from masquerade_messages m where m.session_id = p_session and m.kind = 'icebreaker' and m.body = i.body)
    union all
    select body, 1 from icebreakers i
    where i.event_id is null and i.active and i.spice = p_spice
      and not exists (select 1 from masquerade_messages m where m.session_id = p_session and m.kind = 'icebreaker' and m.body = i.body)
    union all
    select body, 2 from icebreakers i where i.event_id is null and i.active and i.spice = p_spice
  ) x
  -- Friendship chats only get a night's own questions
  where x.pri = 0 or coalesce((select s.intent::text from masquerade_sessions s where s.id = p_session), 'dating') <> 'friends'
  order by pri, random() limit 1
$$;
revoke execute on function public.pick_icebreaker(uuid, smallint, uuid) from public, anon, authenticated;

create or replace function public.match_icebreaker(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m matches;
  lvl smallint;
  q text;
begin
  select * into m from matches where id = p_match and (user_a = uid or user_b = uid);
  if not found then raise exception 'Not your chat'; end if;
  -- Icebreakers are for dating and spicy chats
  if m.intent = 'friends' then return; end if;
  if public.is_blocked(m.user_a, m.user_b) then raise exception 'Not available'; end if;
  if (select count(*) from messages
      where match_id = p_match and sender_id is null and kind = 'text' and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Slow down a little';
  end if;

  select round((coalesce(a.pref_spice, 1) + coalesce(b.pref_spice, 1)) / 2.0)::smallint into lvl
  from profiles a, profiles b where a.id = m.user_a and b.id = m.user_b;

  select body into q from (
    select i.body, 0 as pri from icebreakers i
    where i.event_id is null and i.active and i.spice = lvl
      and not exists (select 1 from messages x where x.match_id = p_match and x.sender_id is null and x.body = '💬 ' || i.body)
      and not exists (select 1 from masquerade_messages x where x.session_id = m.session_id and x.kind = 'icebreaker' and x.body = i.body)
    union all
    select i.body, 1 from icebreakers i where i.event_id is null and i.active and i.spice = lvl
  ) x order by pri, random() limit 1;
  if q is null then return; end if;

  insert into messages (match_id, sender_id, kind, body) values (p_match, null, 'text', '💬 ' || q);
  update matches set last_message_at = now() where id = p_match;
end $$;
revoke execute on function public.match_icebreaker(uuid) from public, anon;
grant execute on function public.match_icebreaker(uuid) to authenticated;
