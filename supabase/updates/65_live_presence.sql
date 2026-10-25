-- Dashpad update: online status and chats update live (Part 65)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 64 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 65:
--  * Leaving the app marks you offline straight away (instead of after a few minutes).
--  * A new message in a masked chat now updates Home and Chats live for both people,
--    through a small "activity" row per person (so nobody watches every message).
-- ---------------------------------------------------------------------------

-- You closed or left the app: you stop showing as online now.
-- (Online means the app checked in within the last 2.5 minutes, so this sets your
-- last check-in just past that.)
create or replace function public.went_away() returns void
language sql security definer set search_path = public as $$
  update profiles set last_seen_at = least(last_seen_at, now() - interval '151 seconds') where id = auth.uid();
$$;
revoke execute on function public.went_away() from public, anon;
grant execute on function public.went_away() to authenticated;

-- One row per person per masked chat, touched on every message, so your screens can
-- listen to just your own rows
create table if not exists public.masked_activity (
  session_id uuid not null references public.masquerade_sessions on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index if not exists masked_activity_user on public.masked_activity (user_id);
alter table public.masked_activity enable row level security;
drop policy if exists "read own masked activity" on public.masked_activity;
create policy "read own masked activity" on public.masked_activity for select using (user_id = auth.uid());

create or replace function public.touch_masked_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare s masquerade_sessions;
begin
  select * into s from masquerade_sessions where id = new.session_id;
  if not found then return new; end if;
  insert into masked_activity (session_id, user_id, at) values (s.id, s.user_a, now()), (s.id, s.user_b, now())
  on conflict (session_id, user_id) do update set at = excluded.at;
  return new;
end $$;
drop trigger if exists masked_activity_touch on public.masquerade_messages;
create trigger masked_activity_touch after insert on public.masquerade_messages
  for each row execute function public.touch_masked_activity();

do $$ begin
  alter publication supabase_realtime add table public.masked_activity;
exception when duplicate_object then null; end $$;
