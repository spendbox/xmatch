-- Dashpad update: who's online, for masked chats in Chats (Part 89)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 88 first. Safe to run more than once.
-- Masked chats in the Chats list show whether the other person is online (the same 150 seconds as
-- everywhere else), like your other chats do. Their name and photo stay hidden until you both unmask.

create or replace function public.my_masked_chats()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- Whether they're in the app right now (150 seconds, like everywhere else)
      coalesce((select o.last_seen_at > now() - interval '150 seconds' from profiles o
        where o.id = case when s.user_a = auth.uid() then s.user_b else s.user_a end), false) as online,
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
$function$;
