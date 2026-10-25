-- Dashpad update: who viewed you knows about your chats (Part 63)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 62 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 63: In "Who viewed you", someone you already have a chat with (you both waved,
-- or one of you messaged) shows a button to that chat instead of asking you to wave.
-- And in chats you started from Meet (or where you both waved), tapping their photo
-- opens their profile.
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

-- Chats started from Meet: who can see whose name (and open their profile). If you both waved, you both can.
create or replace function public.paid_chat_people() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(s.id,
    case
      when s.waved then json_build_object('id', o.id, 'name', o.display_name, 'photo', o.photos[1], 'started_by_me', true, 'waved', true)
      when s.user_a = auth.uid() then json_build_object('id', o.id, 'name', o.display_name, 'photo', o.photos[1], 'started_by_me', true,
        'refund_at', case when s.paid_keys > 0 and s.refunded_at is null then s.started_at + interval '48 hours' end,
        'refunded', s.refunded_at is not null, 'paid_keys', s.paid_keys)
      else json_build_object('name', null, 'photo', null, 'started_by_me', false)
    end), '{}'::json)
  from masquerade_sessions s
  join profiles o on o.id = case when s.user_a = auth.uid() then s.user_b else s.user_a end
  where auth.uid() in (s.user_a, s.user_b)
    and s.source = 'explore'
    and s.pact_id is null
    and s.meet_id is null
    and s.status = 'active'
$$;
revoke execute on function public.paid_chat_people() from public, anon;
grant execute on function public.paid_chat_people() to authenticated;
