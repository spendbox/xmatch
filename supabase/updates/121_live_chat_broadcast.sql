-- Dashpad update: chat messages arrive through the lighter live system (Part 121)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- Until now, every new chat message went through Supabase's "database changes" live system,
-- which checks each message against the permissions of every person listening. That gets
-- heavy with lots of people chatting at once. Now each message is sent straight to its own
-- chat's channel ("broadcast"), and who may listen to a chat is checked once, when they open
-- it: the same people who can read that chat's messages today, nobody else.
--
-- Covers: masked chats, chats with your connections (and their game panel), event chats,
-- Spill chats and the event room. The app switches over by itself once this has run, and
-- falls back to the old way if a chat's channel can't be joined, so nothing stops working.

-- ---------------------------------------------------------------------------
-- 1. Who may listen to a chat's channel: exactly who can read its messages
-- ---------------------------------------------------------------------------
create or replace function public.can_hear(p_topic text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  kind text := split_part(p_topic, ':', 1);
  cid uuid;
begin
  if uid is null then return false; end if;
  begin
    cid := substr(p_topic, length(kind) + 2)::uuid;
  exception when others then
    return false;
  end;
  return case kind
    when 'match' then exists (select 1 from matches m where m.id = cid and uid in (m.user_a, m.user_b))
    when 'room' then exists (select 1 from masquerade_sessions s where s.id = cid and uid in (s.user_a, s.user_b))
    when 'event-chat' then exists (select 1 from event_chats c where c.id = cid and uid in (c.user_a, c.user_b))
    when 'feed-chat' then exists (select 1 from feed_chats c where c.id = cid and uid in (c.user_a, c.user_b))
    when 'event-room' then exists (select 1 from event_attendees a where a.event_id = cid and a.user_id = uid)
    else false
  end;
end $$;
revoke execute on function public.can_hear(text) from public, anon;
grant execute on function public.can_hear(text) to authenticated;

drop policy if exists "dashpad chat channels" on realtime.messages;
create policy "dashpad chat channels" on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and public.can_hear((select realtime.topic())));

-- ---------------------------------------------------------------------------
-- 2. Send each new or changed message to its chat's channel
-- ---------------------------------------------------------------------------
create or replace function public.send_live_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
begin
  -- TG_ARGV[0]: the channel name's start (e.g. 'match'); TG_ARGV[1]: the column naming the chat
  perform realtime.broadcast_changes(
    TG_ARGV[0] || ':' || (rec ->> TG_ARGV[1]),
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, new, old
  );
  return null;
exception when others then
  -- Never stop a message being saved because the live system had a problem
  raise warning 'live broadcast failed: %', sqlerrm;
  return null;
end $$;

drop trigger if exists live_broadcast on public.messages;
create trigger live_broadcast after insert or update on public.messages
  for each row execute function public.send_live_row('match', 'match_id');

drop trigger if exists live_broadcast on public.masquerade_messages;
create trigger live_broadcast after insert or update on public.masquerade_messages
  for each row execute function public.send_live_row('room', 'session_id');

drop trigger if exists live_broadcast on public.event_chat_messages;
create trigger live_broadcast after insert or update on public.event_chat_messages
  for each row execute function public.send_live_row('event-chat', 'chat_id');

drop trigger if exists live_broadcast on public.feed_chat_messages;
create trigger live_broadcast after insert or update on public.feed_chat_messages
  for each row execute function public.send_live_row('feed-chat', 'chat_id');

drop trigger if exists live_broadcast on public.event_room_messages;
create trigger live_broadcast after insert on public.event_room_messages
  for each row execute function public.send_live_row('event-room', 'event_id');

-- ---------------------------------------------------------------------------
-- 3. Lets the app know it can switch over
-- ---------------------------------------------------------------------------
create or replace function public.live_broadcast_ready() returns boolean
language sql stable as $$ select true $$;
grant execute on function public.live_broadcast_ready() to authenticated;
