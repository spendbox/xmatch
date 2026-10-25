-- Dashpad update: masked voice notes (Part 71)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 70 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 71: Voice notes in masked chats, with a voice disguise done on the phone (only the
-- disguised sound is ever uploaded). Each one lasts 24 hours: then, or when the chat
-- ends, the file is deleted from storage (R2) by the 5-minute job.
-- ---------------------------------------------------------------------------
alter table public.masquerade_messages drop constraint if exists masquerade_messages_kind_check;
alter table public.masquerade_messages add constraint masquerade_messages_kind_check
  check (kind in ('text', 'icebreaker', 'gift', 'system', 'game', 'meet', 'audio'));

-- Every voice file, kept even if the chat is deleted, so the file can still be cleaned up
create table if not exists public.masked_voice (
  key text primary key,
  session_id uuid not null,
  sender_id uuid not null,
  message_id bigint,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists masked_voice_due on public.masked_voice (created_at) where deleted_at is null;
create index if not exists masked_voice_sender on public.masked_voice (sender_id, created_at desc);
alter table public.masked_voice enable row level security;

-- Can you post in this masked chat right now?
create or replace function public.can_post_masked(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from masquerade_sessions s
                 where s.id = p_session and auth.uid() in (s.user_a, s.user_b)
                   and s.status = 'active' and now() < s.ends_at)
$$;
revoke execute on function public.can_post_masked(uuid) from public, anon;
grant execute on function public.can_post_masked(uuid) to authenticated;

-- Send a voice note you've uploaded (the app uploads it straight to storage first)
drop function if exists public.send_masked_voice(uuid, text, int, text, text);
create or replace function public.send_masked_voice(p_session uuid, p_key text, p_seconds int, p_voice text) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mid bigint;
  m masquerade_messages;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if not public.can_post_masked(p_session) then raise exception 'This chat has ended'; end if;
  if p_key is null or p_key not like 'voice/' || p_session::text || '/%' or p_key like '%..%' then raise exception 'Not allowed'; end if;
  if (select count(*) from masked_voice where sender_id = uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'That''s a lot of voice notes. Try again in a bit';
  end if;
  insert into masquerade_messages (session_id, sender_id, kind, body, media_meta)
  values (p_session, uid, 'audio', '🎤 Voice note',
          -- The app plays it from our storage address + this key (never a link someone typed)
          json_build_object('key', p_key, 'duration', greatest(1, least(coalesce(p_seconds, 1), 60)),
                            'voice', left(coalesce(p_voice, ''), 20), 'expires_at', now() + interval '24 hours')::jsonb)
  returning * into m;
  insert into masked_voice (key, session_id, sender_id, message_id) values (p_key, p_session, uid, m.id)
  on conflict (key) do nothing;
  return json_build_object('id', m.id, 'sender_id', m.sender_id, 'kind', m.kind, 'body', m.body,
                           'created_at', m.created_at, 'media_meta', m.media_meta, 'reply_to', m.reply_to);
end $$;
revoke execute on function public.send_masked_voice(uuid, text, int, text) from public, anon;
grant execute on function public.send_masked_voice(uuid, text, int, text) to authenticated;

-- Voice files to delete: older than 24 hours, or their chat has ended or is gone (the server calls this)
create or replace function public.masked_voice_due(p_limit int default 500) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(v.key), '[]'::json) from (
    select mv.key from masked_voice mv
    left join masquerade_sessions s on s.id = mv.session_id
    where mv.deleted_at is null
      and (mv.created_at < now() - interval '24 hours' or s.id is null or s.status <> 'active' or s.ends_at <= now())
    order by mv.created_at
    limit greatest(1, p_limit)
  ) v
$$;
revoke execute on function public.masked_voice_due(int) from public, anon, authenticated;

-- Mark voice files as deleted, and their messages as expired (the server calls this)
create or replace function public.masked_voice_deleted(p_keys text[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update masquerade_messages m set media_meta = coalesce(m.media_meta, '{}'::jsonb) - 'key' || '{"expired": true}'::jsonb
  from masked_voice mv
  where mv.key = any(p_keys) and mv.message_id = m.id;
  update masked_voice set deleted_at = now() where key = any(p_keys) and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.masked_voice_deleted(text[]) from public, anon, authenticated;

-- Chats list: a voice note counts as the latest message
create or replace function public.my_masked_chats() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.last_at desc), '[]'::json) from (
    select s.id,
      case when s.user_a = auth.uid() then s.alias_b else s.alias_a end as alias,
      case when s.user_a = auth.uid() then s.alias_a else s.alias_b end as my_alias,
      (s.source = 'explore' and s.pact_id is null) as from_meet,
      pa.name as pact,
      pa.slug as pact_slug,
      exists (select 1 from pact_entries e where e.pact_id = s.pact_id and e.user_id = auth.uid() and e.match_seen_at is not null) as pact_seen,
      case when s.user_a = auth.uid() then s.unmask_a else s.unmask_b end as my_vote,
      (case when s.user_a = auth.uid() then s.unmask_b else s.unmask_a end) is true as they_unmasked,
      l.body as last_message, l.sender_id = auth.uid() as last_mine,
      coalesce(l.created_at, s.started_at) as last_at,
      exists (select 1 from masquerade_messages m where m.session_id = s.id and m.sender_id is not null and m.sender_id <> auth.uid()
        and m.created_at > coalesce((select r.read_at from masked_reads r where r.session_id = s.id and r.user_id = auth.uid()), '-infinity'::timestamptz)) as unread
    from masquerade_sessions s
    left join pacts pa on pa.id = s.pact_id
    left join lateral (
      select m.body, m.sender_id, m.created_at from masquerade_messages m
      where m.session_id = s.id and m.kind in ('text', 'gift', 'audio') order by m.id desc limit 1) l on true
    where auth.uid() in (s.user_a, s.user_b) and s.status = 'active'
      and (s.source = 'explore' or s.reopened_at is not null)
  ) t
$$;
