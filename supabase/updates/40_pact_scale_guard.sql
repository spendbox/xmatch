-- Dashpad update: Big pacts and one entry per person (Part 40)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 39 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 40: Pacts with 100,000 people. Reveal night now runs in steps (match everyone,
-- start the masked chats, tell everyone) and picks up where it stopped, so a big pact
-- never gets stuck. Also: one entry per email (gmail dots and +tags count as the same
-- email), and one entry per phone.
-- ---------------------------------------------------------------------------
alter table public.pacts add column if not exists reveal_step text;
alter table public.pacts drop constraint if exists pacts_reveal_step_check;
alter table public.pacts add constraint pacts_reveal_step_check check (reveal_step in ('match', 'chats', 'notify', 'done'));
alter table public.pacts add column if not exists reveal_lock timestamptz;
alter table public.pacts add column if not exists reveal_cursor text;
alter table public.pacts add column if not exists reveal_stats jsonb not null default '{}'::jsonb;
-- Pacts revealed before this update are finished
update public.pacts set reveal_step = 'done' where status = 'revealed' and reveal_step is null;

alter table public.pact_entries add column if not exists email_key text;
alter table public.pact_entries add column if not exists device text;

-- The same inbox written differently counts once: lower case, no +tags, and no dots for Gmail
create or replace function public.pact_email_key(e text) returns text
language sql immutable as $$
  select case when e is null or position('@' in e) = 0 then null else
    (case when split_part(lower(trim(e)), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(trim(e)), '@', 1), '+', 1), '.', '') || '@gmail.com'
      else split_part(split_part(lower(trim(e)), '@', 1), '+', 1) || '@' || split_part(lower(trim(e)), '@', 2) end)
  end
$$;
update public.pact_entries e set email_key = public.pact_email_key(e.email)
where e.email is not null and e.email_key is null
  and not exists (select 1 from public.pact_entries o where o.pact_id = e.pact_id and o.id <> e.id and o.email_key = public.pact_email_key(e.email));
create unique index if not exists pact_entries_email_key on public.pact_entries (pact_id, email_key) where email_key is not null;
create unique index if not exists pact_entries_device on public.pact_entries (pact_id, device) where device is not null;
create index if not exists pact_entries_order on public.pact_entries (pact_id, id);
create index if not exists pact_entries_email_key_any on public.pact_entries (email_key) where email_key is not null;
create index if not exists pact_matches_order on public.pact_matches (pact_id, id);

-- How many people have taken each pact, kept up to date as people join (counting 100,000
-- entries on every page view would be slow on reveal night)
alter table public.pacts add column if not exists entries_count int not null default 0;
create or replace function public.pact_entries_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update pacts set entries_count = entries_count + 1 where id = new.pact_id;
  elsif tg_op = 'DELETE' then update pacts set entries_count = greatest(entries_count - 1, 0) where id = old.pact_id;
  end if;
  return null;
end $$;
drop trigger if exists pact_entries_count on public.pact_entries;
create trigger pact_entries_count after insert or delete on public.pact_entries for each row execute function public.pact_entries_count();
update public.pacts p set entries_count = (select count(*) from public.pact_entries e where e.pact_id = p.id);

-- Reveal night: one run at a time works on a pact. Returns the pact if this run got it.
create or replace function public.claim_pact_reveal(p_pact uuid, p_seconds int default 75) returns setof public.pacts
language sql security definer set search_path = public as $$
  update pacts set reveal_lock = now() + make_interval(secs => p_seconds), reveal_step = coalesce(reveal_step, 'match')
  where id = p_pact and status <> 'draft' and reveal_at <= now()
    and coalesce(reveal_step, 'match') <> 'done' and (reveal_lock is null or reveal_lock < now())
  returning *;
$$;
revoke execute on function public.claim_pact_reveal(uuid, int) from public, anon, authenticated;

-- Starts the masked chats for the next matches where both people have accounts
create or replace function public.create_pact_sessions(p_pact uuid, p_after bigint default 0, p_limit int default 300) returns json
language plpgsql security definer set search_path = public as $$
declare
  m record;
  n int := 0;
  last bigint := p_after;
begin
  for m in
    select mt.id from pact_matches mt
    join pact_entries ea on ea.id = mt.a
    join pact_entries eb on eb.id = mt.b
    where mt.pact_id = p_pact and mt.id > p_after and mt.session_id is null
      and ea.user_id is not null and eb.user_id is not null
    order by mt.id limit p_limit
  loop
    perform public.create_pact_session(m.id);
    n := n + 1;
    last := m.id;
  end loop;
  return json_build_object('done', n, 'last', last);
end $$;
revoke execute on function public.create_pact_sessions(uuid, bigint, int) from public, anon, authenticated;

-- The next people to tell about reveal night, and whether they got a match
create or replace function public.pact_notify_page(p_pact uuid, p_after uuid default null, p_limit int default 1000)
returns table (id uuid, user_id uuid, email text, token text, matched boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.user_id, e.email, e.token,
    exists (select 1 from pact_matches m where m.pact_id = p_pact and (m.a = e.id or m.b = e.id))
  from pact_entries e
  where e.pact_id = p_pact and (p_after is null or e.id > p_after)
  order by e.id limit p_limit
$$;
revoke execute on function public.pact_notify_page(uuid, uuid, int) from public, anon, authenticated;

-- Reveal night runs every minute while a pact is being revealed, using the same address
-- and key as the 5-minute job (skipped quietly if that job isn't set up)
do $$
declare
  c text;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select command into c from cron.job where jobname = 'dashpad-hourly-notify';
    if c is not null and position('/api/cron/hourly' in c) > 0 then
      perform cron.schedule('dashpad-pacts', '* * * * *', replace(c, '/api/cron/hourly', '/api/cron/pacts'));
    end if;
  end if;
end $$;
