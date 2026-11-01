-- Dashpad update: Your Island (Part 112)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- Every chat grows a little island: each message adds a piece (a stall for "jollof", a palm tree
-- for "beach", a bird for a voice note...). Nothing new is stored: the island is drawn from the
-- chat's own messages, so both people always see the same island. This returns what the app
-- needs to draw it, and only to the two people in the chat.
--   total:    how many messages the chat has (masked part included)
--   since:    when the chat started
--   items:    the latest 300 messages, oldest first, as [kind, first 160 characters]
--   unmasked: you've both unmasked (a signpost with your names, and the fog is gone)
--   names:    your first names, only once you've both unmasked

create or replace function public.chat_island(p_session uuid default null, p_match uuid default null)
returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m matches;
  s masquerade_sessions;
  n int;
  first_at timestamptz;
  list jsonb;
begin
  if uid is null then return null; end if;

  if p_match is not null then
    select * into m from matches where id = p_match and (user_a = uid or user_b = uid);
    if not found then return null; end if;
    -- The masked chat you had first (kept as one card in this chat), then this chat's messages
    with all_msgs as (
      select (e->>'t')::timestamptz as t, coalesce(e->>'k', 'text') as k, left(coalesce(e->>'b', ''), 160) as b, 0 as src, a.ord as o
      from messages x
      cross join lateral jsonb_array_elements(coalesce(x.media_meta->'messages', '[]'::jsonb)) with ordinality as a(e, ord)
      where x.match_id = p_match and x.kind = 'masked' and coalesce(e->>'k', 'text') <> 'system'
      union all
      select x.created_at, coalesce(x.kind, 'text'), left(coalesce(x.body, ''), 160), 1, x.id
      from messages x
      where x.match_id = p_match and x.sender_id is not null and x.deleted_at is null
        and coalesce(x.kind, 'text') not in ('masked', 'system', 'call')
    )
    select count(*)::int, min(t) into n, first_at from all_msgs;
    with all_msgs as (
      select (e->>'t')::timestamptz as t, coalesce(e->>'k', 'text') as k, left(coalesce(e->>'b', ''), 160) as b, 0 as src, a.ord as o
      from messages x
      cross join lateral jsonb_array_elements(coalesce(x.media_meta->'messages', '[]'::jsonb)) with ordinality as a(e, ord)
      where x.match_id = p_match and x.kind = 'masked' and coalesce(e->>'k', 'text') <> 'system'
      union all
      select x.created_at, coalesce(x.kind, 'text'), left(coalesce(x.body, ''), 160), 1, x.id
      from messages x
      where x.match_id = p_match and x.sender_id is not null and x.deleted_at is null
        and coalesce(x.kind, 'text') not in ('masked', 'system', 'call')
    )
    select coalesce(jsonb_agg(jsonb_build_array(z.k, z.b) order by z.t, z.src, z.o), '[]'::jsonb) into list
    from (select * from all_msgs order by t desc, src desc, o desc limit 300) z;
    return json_build_object(
      'total', n, 'since', first_at, 'items', list,
      'unmasked', m.session_id is not null,
      'names', case when m.session_id is not null then json_build_array(
        split_part(coalesce((select display_name from profiles where id = uid), ''), ' ', 1),
        split_part(coalesce((select display_name from profiles where id = case when m.user_a = uid then m.user_b else m.user_a end), ''), ' ', 1)) end
    );
  end if;

  if p_session is not null then
    select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
    if not found then return null; end if;
    select count(*)::int, min(created_at) into n, first_at
    from masquerade_messages where session_id = p_session and kind <> 'system';
    select coalesce(jsonb_agg(jsonb_build_array(z.kind, z.b) order by z.id), '[]'::jsonb) into list
    from (
      select id, kind, left(body, 160) as b from masquerade_messages
      where session_id = p_session and kind <> 'system'
      order by id desc limit 300
    ) z;
    return json_build_object('total', n, 'since', first_at, 'items', list, 'unmasked', false, 'names', null);
  end if;

  return null;
end $$;
revoke all on function public.chat_island(uuid, uuid) from public, anon;
grant execute on function public.chat_island(uuid, uuid) to authenticated;
