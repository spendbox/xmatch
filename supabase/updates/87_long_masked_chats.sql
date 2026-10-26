-- Dashpad update: unmasking after a long masked chat (Part 87)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 80 first. Safe to run more than once.
-- When you both unmask, the masked chat moves into your new chat as one card. A long chat
-- (often a reopened one) made that card bigger than messages may be, so unmasking failed with
-- "violates check constraint messages_meta_small". The card now has its own, bigger limit
-- (only Dashpad itself can make one), and keeps the latest messages that fit in it.

alter table public.messages drop constraint if exists messages_meta_small;
alter table public.messages add constraint messages_meta_small check (
  media_meta is null
  or pg_column_size(media_meta) <= 4000
  or (kind = 'masked' and pg_column_size(media_meta) <= 400000)
) not valid;

create or replace function public.move_masked_messages(p_session uuid, p_match uuid, p_card boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare
  s masquerade_sessions;
  msgs jsonb;
  n int;
begin
  select * into s from masquerade_sessions where id = p_session;
  if p_card then
    -- The latest messages (up to 300, and about 150 KB of text), oldest first
    select coalesce(jsonb_agg(jsonb_build_object('s', x.sender_id, 'k', x.kind, 'b', x.body, 'm', x.media_meta, 't', x.created_at) order by x.id), '[]'::jsonb),
           count(*)
      into msgs, n
    from (
      select y.* from (
        select m.*, sum(octet_length(m.body) + coalesce(octet_length(m.media_meta::text), 0) + 120) over (order by m.id desc) as used
        from masquerade_messages m
        where m.session_id = p_session and m.kind <> 'system'
        order by m.id desc
        limit 300
      ) y
      where y.used <= 150000
    ) x;
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
revoke all on function public.move_masked_messages(uuid, uuid, boolean) from public, anon, authenticated;
