-- Dashpad update: paid chats know who started them (Part 53)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 52 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 53: For chats someone paid to start from Meet, both people now get the chat
-- listed: the one who paid sees the other's name and photo (as before); the one who
-- was messaged is told they found them on Meet, so the chat says the right thing.
-- ---------------------------------------------------------------------------
create or replace function public.paid_chat_people() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(s.id,
    case when s.user_a = auth.uid()
      then json_build_object('name', p.display_name, 'photo', p.photos[1], 'started_by_me', true)
      else json_build_object('name', null, 'photo', null, 'started_by_me', false)
    end), '{}'::json)
  from masquerade_sessions s
  join profiles p on p.id = s.user_b
  where auth.uid() in (s.user_a, s.user_b)
    and s.source = 'explore'
    and s.pact_id is null
    and s.meet_id is null
    and s.status = 'active'
$$;
revoke execute on function public.paid_chat_people() from public, anon;
grant execute on function public.paid_chat_people() to authenticated;
