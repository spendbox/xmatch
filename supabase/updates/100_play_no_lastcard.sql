-- Dashpad update: Last Card leaves Play a stranger (Part 100)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Play a stranger now picks from Whot, Ayo, Ludo, Snakes & Ladders and X & O.
-- Last Card can still be played in chats.

CREATE OR REPLACE FUNCTION public.play_games(p_intent intent)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(k), '{}') from unnest(array['whot', 'ayo', 'ludo', 'snakes', 'xo']) k
  where public.setting_int('game_' || k, 1) <> 0
$function$;
