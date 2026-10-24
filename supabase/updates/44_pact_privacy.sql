-- Dashpad update: Safer pacts (Part 44)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 43 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 44: School and company pacts confirm the email: we send a link to it, and only
-- people who tap it are matched. "Send my link" can go out once every 10 minutes at most.
-- Deleting a Dashpad account now deletes that person's pact answers too.
-- ---------------------------------------------------------------------------
alter table public.pact_entries add column if not exists verified_at timestamptz;
alter table public.pact_entries add column if not exists verify_token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
alter table public.pact_entries add column if not exists link_sent_at timestamptz;
create unique index if not exists pact_entries_verify_token on public.pact_entries (verify_token);

-- Answers go with the account when it's deleted
alter table public.pact_entries drop constraint if exists pact_entries_user_id_fkey;
alter table public.pact_entries add constraint pact_entries_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;

-- Rematches only include people who confirmed their email, for school and company pacts
create or replace function public.pact_stranded(p_pact uuid)
returns table (id uuid, about jsonb, answers jsonb, match_id bigint)
language sql stable security definer set search_path = public as $$
  select e.id, e.about, e.answers, m.id
  from pact_entries e
  join pacts p on p.id = e.pact_id
  left join pact_matches m on m.pact_id = e.pact_id and e.id in (m.a, m.b)
  left join pact_entries o on o.id = case when m.a = e.id then m.b else m.a end
  where e.pact_id = p_pact and e.user_id is not null
    and (p.email_domain is null or e.verified_at is not null)
    and (m.id is null or (o.user_id is null and m.created_at < now() - interval '48 hours'))
$$;
revoke execute on function public.pact_stranded(uuid) from public, anon, authenticated;
