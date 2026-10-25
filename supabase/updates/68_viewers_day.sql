-- Dashpad update: who viewed you leaves out your masked chats (Part 68)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 67 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 68: "Who viewed you" (the last 7 days) now leaves out anyone you're in a masked
-- chat with, so it never gives away who's behind a mask.
-- ---------------------------------------------------------------------------
create or replace function public.my_viewers() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return null; end if;
  return (
    with v as (
      select p.id, p.display_name as name, p.photos[1] as photo,
        coalesce(p.last_seen_at > now() - interval '150 seconds', false) as online,
        pv.seen_at,
        exists (select 1 from waves w where w.from_id = p.id and w.to_id = uid) as waved_me,
        exists (select 1 from waves w where w.from_id = uid and w.to_id = p.id) as i_waved,
        public.explore_match_id(uid, p.id) is not null as connected
      from profile_views pv join profiles p on p.id = pv.viewer
      where pv.target = uid and pv.seen_at > now() - interval '7 days'
        and public.explore_visible(uid, pv.viewer)
        -- Not someone you're in a masked chat with right now
        and not exists (select 1 from masquerade_sessions x
                        where x.status = 'active'
                          and ((x.user_a = uid and x.user_b = p.id) or (x.user_a = p.id and x.user_b = uid)))
      order by pv.seen_at desc
      limit 50
    )
    select json_build_object(
      'wave_cost', public.setting_int('wave_cost', 0),
      'today', (select count(*) from v where v.seen_at > now() - interval '24 hours'),
      'people', coalesce((select json_agg(row_to_json(v) order by v.seen_at desc) from v), '[]'::json)
    )
  );
end $$;
revoke execute on function public.my_viewers() from public, anon;
grant execute on function public.my_viewers() to authenticated;
