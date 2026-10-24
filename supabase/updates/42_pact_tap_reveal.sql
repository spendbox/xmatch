-- Dashpad update: Pact matches are revealed with a tap, gold stars and rematches (Part 42)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 41 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 42: On reveal night nobody's match shows by itself. Everyone sees a teaser
-- (how alike, what for) and taps to reveal their match, which needs a Dashpad account.
-- Pact chats get a gold star. If someone's match hasn't joined Dashpad 48 hours after
-- reveal night, they're rematched with another person in the same spot.
-- ---------------------------------------------------------------------------
alter table public.pact_entries add column if not exists match_seen_at timestamptz;
-- Their match was given to someone else because they hadn't joined within 48 hours
alter table public.pact_entries add column if not exists lost_match_at timestamptz;
alter table public.pact_matches add column if not exists rematch boolean not null default false;
alter table public.pacts add column if not exists rematched_at timestamptz;

-- Is this chat a pact match, and has the caller revealed it yet?
create or replace function public.pact_chat_info(p_session uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('name', p.name, 'slug', p.slug,
    'seen', exists (select 1 from pact_entries e where e.pact_id = p.id and e.user_id = auth.uid() and e.match_seen_at is not null))
  from masquerade_sessions s join pacts p on p.id = s.pact_id
  where s.id = p_session and auth.uid() in (s.user_a, s.user_b)
$$;
revoke execute on function public.pact_chat_info(uuid) from public, anon;
grant execute on function public.pact_chat_info(uuid) to authenticated;

-- Masked chats list: pact chats say which pact, and stay a teaser until revealed
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
      where m.session_id = s.id and m.kind in ('text', 'gift') order by m.id desc limit 1) l on true
    where auth.uid() in (s.user_a, s.user_b) and s.status = 'active'
      and (s.source = 'explore' or s.reopened_at is not null)
  ) t
$$;

-- Your pacts: who you matched with only shows once you've revealed them
create or replace function public.my_pacts() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.reveal_at desc), '[]'::json) from (
    select p.slug, p.name, p.logo_url, p.accent, p.reveal_at, p.closes_at, p.status,
      m.id is not null as has_match,
      e.match_seen_at is not null as seen,
      m.score, m.intent,
      case when e.match_seen_at is not null then m.session_id end as session_id,
      case when e.match_seen_at is not null then (case when m.a = e.id then m.alias_b else m.alias_a end) end as match_alias
    from pact_entries e
    join pacts p on p.id = e.pact_id
    left join pact_matches m on p.status = 'revealed' and m.pact_id = e.pact_id and e.id in (m.a, m.b)
    where e.user_id = auth.uid()
  ) t
$$;

-- People with an account whose match never joined (or who have no match), 48 hours after reveal night
create or replace function public.pact_stranded(p_pact uuid)
returns table (id uuid, about jsonb, answers jsonb, match_id bigint)
language sql stable security definer set search_path = public as $$
  select e.id, e.about, e.answers, m.id
  from pact_entries e
  left join pact_matches m on m.pact_id = e.pact_id and e.id in (m.a, m.b)
  left join pact_entries o on o.id = case when m.a = e.id then m.b else m.a end
  where e.pact_id = p_pact and e.user_id is not null
    and (m.id is null or (o.user_id is null and m.created_at < now() - interval '48 hours'))
$$;
revoke execute on function public.pact_stranded(uuid) from public, anon, authenticated;
