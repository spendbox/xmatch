-- Dashpad update: icebreakers in chats after you've unmasked (Part 37)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 36 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 37: a fresh icebreaker in a matched chat, picked at the average of both people's spice settings
-- (one neither of you has seen in this chat or while you were masked, when there is one)
-- ---------------------------------------------------------------------------
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
