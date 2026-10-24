-- Dashpad update: Feedback (Part 45)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 44 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 45: People send feedback, bug reports and help requests from the app (the
-- support button). Admins read them under admin -> Feedback. Only the server reads
-- and writes this table.
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles on delete set null,
  kind text not null default 'feedback' check (kind in ('feedback', 'bug', 'help', 'idea')),
  message text not null check (char_length(message) between 2 and 2000),
  page text,
  device text,
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_recent on public.feedback (created_at desc);
create index if not exists feedback_user on public.feedback (user_id, created_at desc);
alter table public.feedback enable row level security;
