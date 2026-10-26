-- Dashpad update: masked chats as a card (Part 80)
-- Run this once in Supabase, after update 79: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- When a masked chat joins a chat you already have with that person, it now shows as one card,
-- "Amaka was Purple Heron", that opens the masked chat in a pop-up, instead of its messages
-- being mixed into your chat.

-- A card in a chat that holds a whole masked chat
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'image', 'video', 'audio', 'call', 'gift', 'game', 'masked'));
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check check (
  char_length(body) <= 2000 and (
    (kind = 'text' and (char_length(body) >= 1 or deleted_at is not null))
    or (kind in ('image', 'video', 'audio') and (media_path is not null or deleted_at is not null))
    or kind in ('call', 'gift', 'game', 'masked')
  )
);

-- Move a masked chat into a normal chat: its messages one by one, or (p_card) as one card
drop function if exists public.move_masked_messages(uuid, uuid);
create or replace function public.move_masked_messages(p_session uuid, p_match uuid, p_card boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare
  s masquerade_sessions;
  msgs jsonb;
  n int;
begin
  select * into s from masquerade_sessions where id = p_session;
  if p_card then
    -- The last 300 messages, oldest first
    select coalesce(jsonb_agg(jsonb_build_object('s', x.sender_id, 'k', x.kind, 'b', x.body, 'm', x.media_meta, 't', x.created_at) order by x.id), '[]'::jsonb),
           count(*)
      into msgs, n
    from (select * from masquerade_messages where session_id = p_session and kind <> 'system' order by id desc limit 300) x;
    if n > 0 or s.status = 'active' then
      insert into messages (match_id, sender_id, kind, body, media_meta)
      values (p_match, null, 'masked', 'Your masked chat', jsonb_build_object(
        'aliases', jsonb_build_object(s.user_a::text, s.alias_a, s.user_b::text, s.alias_b),
        'from', case when s.hour_at is not null then 'masquerade' when s.meet_id is not null then 'meet'
                     when s.pact_id is not null then 'linkup' when s.waved then 'wave'
                     when s.source = 'explore' then 'message' else 'masked' end,
        'started_at', s.started_at,
        'count', n,
        'messages', msgs));
    end if;
  else
    insert into messages (match_id, sender_id, kind, body, media_meta, media_path, created_at)
    select p_match, sender_id,
      case when kind in ('gift', 'game', 'audio') then kind else 'text' end,
      case when kind in ('icebreaker', 'meet') then '💬 ' || body when kind = 'audio' then '' else body end,
      case when kind = 'gift' then jsonb_build_object('gift', body) when kind in ('game', 'audio') then media_meta else null end,
      case when kind = 'audio' then 'r2:' || coalesce(media_meta->>'key', 'expired') end,
      created_at
    from masquerade_messages where session_id = p_session and kind <> 'system' order by id;
  end if;
  delete from masquerade_messages where session_id = p_session;
  update matches set last_message_at = greatest(last_message_at, now()) where id = p_match;
end $$;

create or replace function public.merge_pair_chats(p_a uuid, p_b uuid, p_match uuid, p_except uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select s.id from masquerade_sessions s
    where ((s.user_a = p_a and s.user_b = p_b) or (s.user_a = p_b and s.user_b = p_a))
      and s.id is distinct from p_except
      and s.status in ('active', 'lapsed', 'ended')
      and s.match_id is null
      and (s.status <> 'ended' or exists (select 1 from masquerade_messages m where m.session_id = s.id))
    for update
  loop
    perform public.move_masked_messages(r.id, p_match, true);
    update masquerade_sessions set status = 'matched', match_id = p_match, ended_reason = 'merged' where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.finalize_masquerade(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s masquerade_sessions;
  mid uuid;
  talked boolean;
begin
  select * into s from masquerade_sessions where id = p_session for update;
  if not found or s.status not in ('active', 'lapsed') then return; end if;

  if s.unmask_a is true and s.unmask_b is true then
    insert into matches (user_a, user_b, session_id, intent)
    values (least(s.user_a, s.user_b), greatest(s.user_a, s.user_b), s.id, s.intent)
    on conflict (user_a, user_b) do update set session_id = excluded.session_id
    returning id into mid;

    -- A brand new chat carries on where the masked chat left off; a chat you already had
    -- gets a card instead ("Amaka was Purple Heron") that opens the masked chat
    perform public.move_masked_messages(s.id, mid, exists (select 1 from messages x where x.match_id = mid));
    update masquerade_sessions set status = 'matched', match_id = mid where id = s.id;
    -- Any other masked chat you two have going (Masquerade, Meet, a wave) joins this chat too
    perform public.merge_pair_chats(s.user_a, s.user_b, mid, s.id);
    return;
  end if;

  if s.unmask_a is false or s.unmask_b is false then
    update masquerade_sessions set status = 'ended', ended_reason = coalesce(ended_reason, 'declined') where id = s.id;
    delete from masquerade_messages where session_id = s.id;
    return;
  end if;

  -- Hourly pairs and meet chats: when the time is over
  if s.hour_at is not null or s.meet_id is not null then
    if s.status = 'active' and now() >= s.ends_at then
      talked := (exists (select 1 from masquerade_messages m where m.session_id = s.id and m.kind in ('text', 'gift') and m.sender_id = s.user_a)
             and exists (select 1 from masquerade_messages m where m.session_id = s.id and m.kind in ('text', 'gift') and m.sender_id = s.user_b))
             or exists (select 1 from games g where g.session_id = s.id and g.status = 'done');
      if talked then
        update masquerade_sessions set status = 'lapsed' where id = s.id;
      else
        update masquerade_sessions set status = 'ended', ended_reason = 'quiet' where id = s.id;
        delete from masquerade_messages where session_id = s.id;
      end if;
    end if;
    return;
  end if;

  -- Event rounds: time ran out without both deciding
  if now() > s.ends_at + interval '90 seconds' then
    update masquerade_sessions set status = 'ended', ended_reason = coalesce(ended_reason, 'timeout') where id = s.id;
    delete from masquerade_messages where session_id = s.id;
  end if;
end $$;

revoke all on function public.move_masked_messages(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.merge_pair_chats(uuid, uuid, uuid, uuid) from public, anon, authenticated;
