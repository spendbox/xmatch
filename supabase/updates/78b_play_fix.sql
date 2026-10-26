-- Dashpad update: Play fix (Part 78b)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- If an earlier draft of update 78 was run, the waiting line was missing two columns,
-- so the Play screen couldn't load. This adds them.
alter table public.play_queue add column if not exists seen_at timestamptz not null default now();
alter table public.play_queue add column if not exists game_id uuid references public.games on delete set null;
alter table public.play_queue add column if not exists game_kind text;
alter table public.play_queue add column if not exists matched_at timestamptz;
alter table public.play_queue drop column if exists session_id;
