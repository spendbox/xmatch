-- Dashpad update: your live Masquerade pair shows in Chats (Part 74)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 73 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 74: The Chats page (and Recent chats on Home, and the unread dot on Chats) now
-- include your live Masquerade pair, with how long it has left.
-- ---------------------------------------------------------------------------
create or replace function public.my_masked_chats() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.last_at desc), '[]'::json) from (
    select s.id,
      case when s.user_a = auth.uid() then s.alias_b else s.alias_a end as alias,
      case when s.user_a = auth.uid() then s.alias_a else s.alias_b end as my_alias,
      (s.source = 'explore' and s.pact_id is null) as from_meet,
      -- A live Masquerade pair (it has a time limit)
      (s.hour_at is not null and s.reopened_at is null and s.source is distinct from 'explore') as live_pair,
      case when s.hour_at is not null and s.reopened_at is null then s.ends_at end as ends_at,
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
      -- Chats from Meet, reopened pairs, and now your live Masquerade pair too
      and (s.source = 'explore' or s.reopened_at is not null or (s.hour_at is not null and s.ends_at > now()))
  ) t
$$;

create or replace function public.unread_masked_chats() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from masquerade_sessions s
  where auth.uid() in (s.user_a, s.user_b) and s.status = 'active'
    and (s.source = 'explore' or s.reopened_at is not null or (s.hour_at is not null and s.ends_at > now()))
    and exists (select 1 from masquerade_messages m where m.session_id = s.id and m.sender_id is not null and m.sender_id <> auth.uid()
      and m.created_at > coalesce((select r.read_at from masked_reads r where r.session_id = s.id and r.user_id = auth.uid()), '-infinity'::timestamptz))
$$;
