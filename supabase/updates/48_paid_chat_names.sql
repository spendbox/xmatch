-- Dashpad update: names in chats you paid to start (Part 48)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 47 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 48: When you pay to message someone from Meet, you already saw their name and
-- main photo there. So in that masked chat you see their name, with their photo
-- blurred. They still see only your mask name until you both unmask.
-- ---------------------------------------------------------------------------
create or replace function public.paid_chat_people() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(s.id, json_build_object('name', p.display_name, 'photo', p.photos[1])), '{}'::json)
  from masquerade_sessions s
  join profiles p on p.id = s.user_b
  where s.user_a = auth.uid()
    and s.source = 'explore'
    and s.pact_id is null
    and s.meet_id is null
    and s.status = 'active'
$$;
revoke execute on function public.paid_chat_people() from public, anon;
grant execute on function public.paid_chat_people() to authenticated;
