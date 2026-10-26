-- Dashpad update: one request for the menu dots (Part 95)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- The unread counts and the live event used to be 5 separate requests on every page; on a slow
-- phone connection each one waits its turn. Now it's one.
create or replace function public.menu_badges() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'chats', public.unread_chats(),
    'event_chats', public.unread_event_chats(),
    'feed_chats', public.unread_feed_chats(),
    'masked', public.unread_masked_chats(),
    'event', public.next_event()
  )
$$;
revoke execute on function public.menu_badges() from public, anon;
grant execute on function public.menu_badges() to authenticated;
