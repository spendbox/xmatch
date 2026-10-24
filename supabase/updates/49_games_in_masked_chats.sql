-- Dashpad update: games in every masked chat (Part 49)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 48 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 49: Games work in every open masked chat, not just hourly pairs and Meet
-- posts: chats you paid to start from Meet, Link-Up matches, reopened pairs and
-- 5-minute masquerades too (while the chat is still open).
-- ---------------------------------------------------------------------------
create or replace function public.game_chat_ok(uid uuid, p_session uuid, p_match uuid, out other uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  s masquerade_sessions;
  m matches;
begin
  other := null;
  if p_session is not null then
    select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
    if not found or s.status <> 'active' or now() >= s.ends_at then return; end if;
    other := case when s.user_a = uid then s.user_b else s.user_a end;
  elsif p_match is not null then
    select * into m from matches where id = p_match and (user_a = uid or user_b = uid);
    if not found then return; end if;
    other := case when m.user_a = uid then m.user_b else m.user_a end;
  end if;
  if other is not null and public.is_blocked(uid, other) then other := null; end if;
end $$;
revoke all on function public.game_chat_ok(uuid, uuid, uuid) from public, anon, authenticated;
