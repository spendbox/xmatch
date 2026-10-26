-- Dashpad update: faster chats as Dashpad grows (Part 85)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Two lookups the app does all the time get their own index: your chats when you're the
-- second person in them, and the latest messages in a chat.

create index if not exists matches_user_b on public.matches (user_b);
create index if not exists messages_match_time on public.messages (match_id, created_at desc, id desc);
