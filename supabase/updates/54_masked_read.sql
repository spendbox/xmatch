-- Dashpad update: masked chats marked read while open (Part 54)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 53 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 54: A masked chat was only marked read when you opened it, so messages that
-- arrived while you were in it (and you replied to) kept the Chats badge on. The chat
-- now marks itself read as messages come in.
-- ---------------------------------------------------------------------------
create or replace function public.mark_masked_read(p_session uuid) returns void
language sql security definer set search_path = public as $$
  insert into masked_reads (session_id, user_id, read_at)
  select s.id, auth.uid(), now() from masquerade_sessions s
  where s.id = p_session and auth.uid() in (s.user_a, s.user_b)
  on conflict (session_id, user_id) do update set read_at = now();
$$;
revoke execute on function public.mark_masked_read(uuid) from public, anon;
grant execute on function public.mark_masked_read(uuid) to authenticated;
