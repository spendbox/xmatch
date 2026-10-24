-- Dashpad update: Pact button text (Part 46)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 45 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 46: Each pact can set its own text for the main button on its page
-- (empty means "Take the Pact").
-- ---------------------------------------------------------------------------
alter table public.pacts add column if not exists button_text text not null default '';
alter table public.pacts drop constraint if exists pacts_button_text_check;
alter table public.pacts add constraint pacts_button_text_check check (char_length(button_text) <= 30);
