-- Dashpad update: who viewed you knows about your chats (Part 63)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 62 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 63: In "Who viewed you", someone you already have a chat with (you both waved,
-- or one of you messaged) shows a button to that chat instead of asking you to wave.
-- ---------------------------------------------------------------------------
create or replace function public.my_viewers() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return null; end if;
  return json_build_object(
    'wave_cost', public.setting_int('wave_cost', 0),
    'today', (select count(*) from profile_views v
      where v.target = uid and v.seen_at > now() - interval '24 hours' and public.explore_visible(uid, v.viewer)),
    'people', coalesce((select json_agg(row_to_json(t) order by t.seen_at desc) from (
      select p.id, p.display_name as name, p.photos[1] as photo,
        coalesce(p.last_seen_at > now() - interval '5 minutes', false) as online,
        v.seen_at,
        exists (select 1 from waves w where w.from_id = p.id and w.to_id = uid) as waved_me,
        exists (select 1 from waves w where w.from_id = uid and w.to_id = p.id) as i_waved,
        public.explore_match_id(uid, p.id) is not null as connected,
        -- A chat you already have with them (e.g. you both waved): open it instead of waving
        (select x.id from masquerade_sessions x where x.source = 'explore' and x.status = 'active'
          and ((x.user_a = uid and x.user_b = p.id) or (x.user_a = p.id and x.user_b = uid))
          order by x.started_at desc limit 1) as chat_id
      from profile_views v join profiles p on p.id = v.viewer
      where v.target = uid and v.seen_at > now() - interval '7 days' and public.explore_visible(uid, v.viewer)
      order by v.seen_at desc
      limit 50
    ) t), '[]'::json)
  );
end $$;
