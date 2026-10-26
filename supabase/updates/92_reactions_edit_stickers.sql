-- Dashpad update: reactions, editing and Masky stickers in chats (Part 92)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Hold a message to react (one reaction each, tap it again to take it back) or to edit it
-- (your own words, within 15 minutes; it shows "edited"). Masky stickers: a pose that moves,
-- with your own words under it. Works in normal chats and masked chats.

-- Who reacted with what ({"<person>": "😂"}), and when a message was last edited
alter table public.messages add column if not exists reactions jsonb not null default '{}'::jsonb;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.masquerade_messages add column if not exists reactions jsonb not null default '{}'::jsonb;
alter table public.masquerade_messages add column if not exists edited_at timestamptz;
alter table public.masquerade_messages add column if not exists media_meta jsonb;

-- Stickers are a new kind of message: the words go in body, the pose and colour in media_meta
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'image', 'video', 'audio', 'call', 'gift', 'game', 'masked', 'sticker'));
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check check (
  char_length(body) <= 2000 and (
    (kind = 'text' and (char_length(body) >= 1 or deleted_at is not null))
    or (kind in ('image', 'video', 'audio') and (media_path is not null or deleted_at is not null))
    or (kind = 'sticker' and (char_length(body) <= 24 or deleted_at is not null))
    or kind in ('call', 'gift', 'game', 'masked')
  )
);
alter table public.masquerade_messages drop constraint if exists masquerade_messages_kind_check;
alter table public.masquerade_messages add constraint masquerade_messages_kind_check
  check (kind in ('text', 'icebreaker', 'gift', 'system', 'game', 'meet', 'audio', 'sticker'));

-- A sticker names one of Masky's poses and colours, and has at most 24 characters of words
create or replace function public.sticker_ok(p_kind text, p_body text, p_meta jsonb) returns boolean
language sql immutable as $$
  select p_kind <> 'sticker' or (
    char_length(p_body) <= 24
    and p_meta ->> 'pose' in ('wave', 'kiss', 'lol', 'shock', 'sleep', 'dance', 'peek', 'stamp', 'jollof', 'dice')
    and p_meta ->> 'color' in ('#7a5cf0', '#ff7aa8', '#2fb3a0', '#ffb02e', '#e5484d', '#5b6cff')
  )
$$;

drop policy if exists "send match messages" on public.messages;
create policy "send match messages" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and kind in ('text', 'image', 'video', 'audio', 'sticker')
    and deleted_at is null
    and slow_paid_at is null
    and reactions = '{}'::jsonb
    and edited_at is null
    and public.sticker_ok(kind, body, media_meta)
    and (media_path is null or split_part(media_path, '/', 1) = match_id::text)
    and exists (select 1 from public.matches m where m.id = match_id and (m.user_a = auth.uid() or m.user_b = auth.uid()))
  );

drop policy if exists "participants send messages" on public.masquerade_messages;
create policy "participants send messages" on public.masquerade_messages for insert
  with check (
    sender_id = auth.uid()
    and (kind = 'text' or (kind = 'sticker' and public.sticker_ok(kind, body, media_meta)))
    and (kind = 'sticker' or media_meta is null)
    and reactions = '{}'::jsonb
    and edited_at is null
    and exists (
      select 1 from public.masquerade_sessions s where s.id = session_id
        and (s.user_a = auth.uid() or s.user_b = auth.uid())
        and s.status = 'active' and now() < s.ends_at)
  );

-- React to a message. Same emoji again (or an empty one) takes your reaction back.
create or replace function public.react_message(p_message bigint, p_emoji text, p_masked boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur jsonb;
  out jsonb;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  p_emoji := coalesce(btrim(p_emoji), '');
  if char_length(p_emoji) > 16 or p_emoji ~ '[A-Za-z0-9<>]' then raise exception 'Not a reaction'; end if;
  if p_masked then
    select x.reactions into cur from masquerade_messages x join masquerade_sessions s on s.id = x.session_id
    where x.id = p_message and (s.user_a = uid or s.user_b = uid) and x.kind not in ('system', 'icebreaker')
    for update of x;
  else
    select x.reactions into cur from messages x join matches m on m.id = x.match_id
    where x.id = p_message and (m.user_a = uid or m.user_b = uid) and x.deleted_at is null and x.kind not in ('call', 'masked')
    for update of x;
  end if;
  if cur is null then raise exception 'Message not found'; end if;
  out := case when p_emoji = '' or cur ->> uid::text = p_emoji then cur - uid::text
              else cur || jsonb_build_object(uid::text, p_emoji) end;
  if p_masked then
    update masquerade_messages set reactions = out where id = p_message;
  else
    update messages set reactions = out where id = p_message;
  end if;
  return out;
end $$;
revoke execute on function public.react_message(bigint, text, boolean) from public, anon;
grant execute on function public.react_message(bigint, text, boolean) to authenticated;

-- Fix the words of your own message, within 15 minutes of sending it
create or replace function public.edit_message(p_message bigint, p_body text, p_masked boolean default false) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  p_body := btrim(coalesce(p_body, ''));
  if char_length(p_body) < 1 then raise exception 'Write something'; end if;
  if p_masked then
    if char_length(p_body) > 1000 then raise exception 'Too long'; end if;
    update masquerade_messages set body = p_body, edited_at = now()
    where id = p_message and sender_id = uid and kind = 'text' and body <> p_body
      and created_at > now() - interval '15 minutes';
  else
    if char_length(p_body) > 2000 then raise exception 'Too long'; end if;
    update messages set body = p_body, edited_at = now()
    where id = p_message and sender_id = uid and kind = 'text' and deleted_at is null and body <> p_body
      and created_at > now() - interval '15 minutes';
  end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'You can only edit your own messages, within 15 minutes'; end if;
  return now();
end $$;
revoke execute on function public.edit_message(bigint, text, boolean) from public, anon;
grant execute on function public.edit_message(bigint, text, boolean) to authenticated;

-- Changes to masked messages (reactions, edits) arrive live
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'masquerade_messages') then
    alter publication supabase_realtime add table public.masquerade_messages;
  end if;
exception when undefined_object then null;
end $$;
