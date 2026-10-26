-- Dashpad update: unmasking in reopened chats (Part 86)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- A reopened chat has no timer, so "You can unmask when the timer ends" never applies to it.

create or replace function public.vote_unmask(p_session uuid, p_unmask boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then raise exception 'Chat not found'; end if;
  if s.status not in ('active', 'lapsed') then return; end if;
  if p_unmask and s.hour_at is null and s.meet_id is null and s.source is distinct from 'explore' and s.reopened_at is null
     and now() < s.ends_at - interval '2 seconds' then
    raise exception 'You can unmask when the timer ends';
  end if;
  -- Tell them in the chat the first time you unmask (they get a notification too)
  if p_unmask and (case when uid = s.user_a then s.unmask_a else s.unmask_b end) is distinct from true
     and (case when uid = s.user_a then s.unmask_b else s.unmask_a end) is distinct from true then
    insert into masquerade_messages (session_id, kind, body)
    values (s.id, 'system', (case when uid = s.user_a then s.alias_a else s.alias_b end) || ' unmasked. Unmask too to connect');
  end if;
  if uid = s.user_a then
    update masquerade_sessions set unmask_a = p_unmask,
      ended_reason = case when not p_unmask and now() < s.ends_at then 'left' else ended_reason end
    where id = p_session;
  else
    update masquerade_sessions set unmask_b = p_unmask,
      ended_reason = case when not p_unmask and now() < s.ends_at then 'left' else ended_reason end
    where id = p_session;
  end if;
  perform public.finalize_masquerade(p_session);
end $$;
