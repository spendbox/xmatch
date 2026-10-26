-- Dashpad update: voice notes stay, and can be up to 5 minutes (Part 81)
-- Run this once in Supabase, after update 80: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Masked voice notes no longer disappear after 24 hours, or when you unmask. They're only
-- cleaned up when their masked chat is closed for good and the chat itself is gone.

-- Masked voice notes: up to 5 minutes, and they don't expire
create or replace function public.send_masked_voice(p_session uuid, p_key text, p_seconds int, p_voice text) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m masquerade_messages;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if not public.can_post_masked(p_session) then raise exception 'This chat has ended'; end if;
  if p_key is null or p_key not like 'voice/' || p_session::text || '/%' or p_key like '%..%' then raise exception 'Not allowed'; end if;
  if (select count(*) from masked_voice where sender_id = uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'That''s a lot of voice notes. Try again in a bit';
  end if;
  insert into masquerade_messages (session_id, sender_id, kind, body, media_meta)
  values (p_session, uid, 'audio', 'Voice note',
          -- The app plays it from our storage address + this key (never a link someone typed)
          json_build_object('key', p_key, 'duration', greatest(1, least(coalesce(p_seconds, 1), 420)),
                            'voice', left(coalesce(p_voice, ''), 20))::jsonb)
  returning * into m;
  insert into masked_voice (key, session_id, sender_id, message_id) values (p_key, p_session, uid, m.id)
  on conflict (key) do nothing;
  return json_build_object('id', m.id, 'sender_id', m.sender_id, 'kind', m.kind, 'body', m.body,
                           'created_at', m.created_at, 'media_meta', m.media_meta, 'reply_to', m.reply_to);
end $$;
revoke execute on function public.send_masked_voice(uuid, text, int, text) from public, anon;
grant execute on function public.send_masked_voice(uuid, text, int, text) to authenticated;

-- Voice files to delete: only when nobody can play them any more (their masked chat closed
-- without unmasking and its messages are gone). Unmasked chats keep them for good.
create or replace function public.masked_voice_due(p_limit int default 500) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(v.key), '[]'::json) from (
    select mv.key from masked_voice mv
    left join masquerade_sessions s on s.id = mv.session_id
    where mv.deleted_at is null
      and (s.id is null
           or (s.status = 'ended' and coalesce(s.ended_reason, '') <> 'merged'
               and not exists (select 1 from masquerade_messages m where m.id = mv.message_id)))
    order by mv.created_at
    limit greatest(1, p_limit)
  ) v
$$;
revoke execute on function public.masked_voice_due(int) from public, anon, authenticated;

-- Voice notes already sent no longer carry a 24 hour end date
update masquerade_messages set media_meta = media_meta - 'expires_at'
where kind = 'audio' and media_meta ? 'expires_at';
