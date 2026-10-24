-- Dashpad update: Pacts (Part 39)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 38 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 39: Pacts. An admin creates a pact (its own name, link, logo and header),
-- people answer its questions (no account needed), and on reveal night everyone
-- gets their one best match: for business, friendship, love or something spicy.
-- Answers and matches are read and written by the server; people only see their own.
-- ---------------------------------------------------------------------------
create table if not exists public.pacts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  tagline text not null default '' check (char_length(tagline) <= 160),
  logo_url text,
  header_url text,
  accent text not null default '#f2c45a' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  intents text[] not null default array['business', 'friendship', 'love', 'spicy'],
  areas text[] not null default array['Island', 'Mainland'],
  email_domain text,
  closes_at timestamptz not null,
  reveal_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'live', 'revealed')),
  matched_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.pact_questions (
  id uuid primary key default gen_random_uuid(),
  pact_id uuid not null references public.pacts on delete cascade,
  position int not null default 0,
  kind text not null check (kind in ('this_or_that', 'choose_one', 'choose_many', 'scale')),
  title text not null check (char_length(title) between 2 and 90),
  subtitle text not null default '',
  -- [{ "id": "a", "label": "Owambe till 3am", "image": "https://…" }]
  options jsonb not null default '[]'::jsonb,
  min_pick int not null default 1,
  max_pick int not null default 1,
  weight text not null default 'normal' check (weight in ('normal', 'strong', 'dealbreaker')),
  created_at timestamptz not null default now()
);
create index if not exists pact_questions_pact on public.pact_questions (pact_id, position);

create table if not exists public.pact_entries (
  id uuid primary key default gen_random_uuid(),
  pact_id uuid not null references public.pacts on delete cascade,
  user_id uuid references public.profiles on delete set null,
  email text,
  -- the private link to your result, kept on your phone and in your email
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  about jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pact_id, email),
  unique (pact_id, user_id)
);
create index if not exists pact_entries_user on public.pact_entries (user_id) where user_id is not null;
create index if not exists pact_entries_email on public.pact_entries (lower(email));

create table if not exists public.pact_matches (
  id bigint generated always as identity primary key,
  pact_id uuid not null references public.pacts on delete cascade,
  a uuid not null references public.pact_entries on delete cascade,
  b uuid not null references public.pact_entries on delete cascade,
  score int not null,
  intent text not null check (intent in ('business', 'friendship', 'love', 'spicy')),
  alias_a text not null,
  alias_b text not null,
  -- what they have in common, for the reveal: [{ "q": "Friday night", "a": "Movie and suya at home" }]
  shared jsonb not null default '[]'::jsonb,
  differ jsonb,
  session_id uuid references public.masquerade_sessions on delete set null,
  created_at timestamptz not null default now(),
  unique (pact_id, a),
  unique (pact_id, b)
);

alter table public.masquerade_sessions add column if not exists pact_id uuid references public.pacts on delete set null;

alter table public.pacts enable row level security;
alter table public.pact_questions enable row level security;
alter table public.pact_entries enable row level security;
alter table public.pact_matches enable row level security;
drop policy if exists "anyone reads published pacts" on public.pacts;
create policy "anyone reads published pacts" on public.pacts for select using (status <> 'draft');
drop policy if exists "anyone reads published pact questions" on public.pact_questions;
create policy "anyone reads published pact questions" on public.pact_questions for select
  using (exists (select 1 from public.pacts p where p.id = pact_id and p.status <> 'draft'));
drop policy if exists "people read their own pact entries" on public.pact_entries;
create policy "people read their own pact entries" on public.pact_entries for select using (user_id = auth.uid());

-- Start the masked chat for a pact match (both people need a Dashpad account). Called by the server.
create or replace function public.create_pact_session(p_match bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  mt pact_matches;
  ea pact_entries;
  eb pact_entries;
  pa pacts;
  sid uuid;
  lvl smallint;
  q text;
begin
  select * into mt from pact_matches where id = p_match for update;
  if not found then return null; end if;
  if mt.session_id is not null then return mt.session_id; end if;
  select * into ea from pact_entries where id = mt.a;
  select * into eb from pact_entries where id = mt.b;
  if ea.user_id is null or eb.user_id is null or ea.user_id = eb.user_id then return null; end if;
  if public.is_blocked(ea.user_id, eb.user_id) then return null; end if;
  select * into pa from pacts where id = mt.pact_id;
  lvl := case mt.intent when 'spicy' then 2 else 1 end;
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, source, pact_id)
  values (ea.user_id, eb.user_id,
    (case mt.intent when 'love' then 'dating' when 'spicy' then 'spicy' else 'friends' end)::intent,
    lvl, lvl, lvl, mt.alias_a, mt.alias_b, now(), 'infinity', 'explore', pa.id)
  returning id into sid;
  insert into masquerade_messages (session_id, kind, body)
  values (sid, 'system', pa.name || ' matched you two (' || mt.score || '% alike). You''re both masked until you both unmask.');
  q := public.pick_icebreaker(sid, lvl, null);
  if q is not null then insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q); end if;
  update pact_matches set session_id = sid where id = mt.id;
  return sid;
end $$;
revoke execute on function public.create_pact_session(bigint) from public, anon, authenticated;

-- Your pacts and matches, for your profile
create or replace function public.my_pacts() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.reveal_at desc), '[]'::json) from (
    select p.slug, p.name, p.logo_url, p.accent, p.reveal_at, p.closes_at, p.status,
      m.score, m.intent, m.shared, m.session_id,
      case when m.a = e.id then m.alias_b else m.alias_a end as match_alias
    from pact_entries e
    join pacts p on p.id = e.pact_id
    left join pact_matches m on m.pact_id = e.pact_id and e.id in (m.a, m.b)
    where e.user_id = auth.uid()
  ) t
$$;

-- Masked chats list: say which pact a chat came from
create or replace function public.my_masked_chats() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.last_at desc), '[]'::json) from (
    select s.id,
      case when s.user_a = auth.uid() then s.alias_b else s.alias_a end as alias,
      case when s.user_a = auth.uid() then s.alias_a else s.alias_b end as my_alias,
      (s.source = 'explore' and s.pact_id is null) as from_meet,
      (select pa.name from pacts pa where pa.id = s.pact_id) as pact,
      case when s.user_a = auth.uid() then s.unmask_a else s.unmask_b end as my_vote,
      (case when s.user_a = auth.uid() then s.unmask_b else s.unmask_a end) is true as they_unmasked,
      l.body as last_message, l.sender_id = auth.uid() as last_mine,
      coalesce(l.created_at, s.started_at) as last_at,
      exists (select 1 from masquerade_messages m where m.session_id = s.id and m.sender_id is not null and m.sender_id <> auth.uid()
        and m.created_at > coalesce((select r.read_at from masked_reads r where r.session_id = s.id and r.user_id = auth.uid()), '-infinity'::timestamptz)) as unread
    from masquerade_sessions s
    left join lateral (
      select m.body, m.sender_id, m.created_at from masquerade_messages m
      where m.session_id = s.id and m.kind in ('text', 'gift') order by m.id desc limit 1) l on true
    where auth.uid() in (s.user_a, s.user_b) and s.status = 'active'
      and (s.source = 'explore' or s.reopened_at is not null)
  ) t
$$;

-- Pictures for pacts (logos, headers, answer pictures) live in the event-media bucket under pacts/
