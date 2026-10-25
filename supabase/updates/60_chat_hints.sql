-- Dashpad update: chat hints (Part 60)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 59 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 60: "Ask them about…" hints in chats. What you have in common now also says
-- where you picked differently in This or That, so a chat can suggest a playful
-- opener ("They picked Tea, you picked Coffee"). Same privacy rules as before.
-- ---------------------------------------------------------------------------
create or replace function public.in_common(p_other uuid default null, p_session uuid default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  other uuid := p_other;
  s masquerade_sessions;
  me profiles;
  them profiles;
  connected boolean;
  tot_same int := 0;
  tot_rounds int := 0;
  tot_items json;
  tot_differ json;
  links json;
  link_count int := 0;
begin
  if uid is null then return null; end if;
  if p_session is not null then
    select * into s from masquerade_sessions where id = p_session and uid in (user_a, user_b);
    if not found then return null; end if;
    other := case when s.user_a = uid then s.user_b else s.user_a end;
  end if;
  if other is null or other = uid then return null; end if;
  connected := public.explore_match_id(uid, other) is not null;
  if p_session is null and not connected and not public.explore_visible(uid, other) then return null; end if;
  if public.is_blocked(uid, other) then return null; end if;
  select * into me from profiles where id = uid;
  select * into them from profiles where id = other;

  -- This or That rounds you both answered, in games you played together
  select count(*) filter (where x.p->>0 = x.p->>1), count(*)
  into tot_same, tot_rounds
  from games g
  cross join lateral jsonb_array_elements(coalesce(g.state->'picks', '[]'::jsonb)) as x(p)
  where g.kind = 'tot'
    and ((g.player_a = uid and g.player_b = other) or (g.player_a = other and g.player_b = uid))
    and x.p->>0 is not null and x.p->>1 is not null;

  select coalesce(json_agg(json_build_object('q', t.q, 'a', t.a)), '[]'::json) into tot_items from (
    select g.state->'qs'->(x.i::int - 1)->>'q' as q,
      case x.p->>0 when 'a' then g.state->'qs'->(x.i::int - 1)->>'a' else g.state->'qs'->(x.i::int - 1)->>'b' end as a
    from games g
    cross join lateral jsonb_array_elements(coalesce(g.state->'picks', '[]'::jsonb)) with ordinality as x(p, i)
    where g.kind = 'tot'
      and ((g.player_a = uid and g.player_b = other) or (g.player_a = other and g.player_b = uid))
      and x.p->>0 is not null and x.p->>0 = x.p->>1
    order by g.created_at desc
    limit 3
  ) t where t.q is not null and t.a is not null;

  -- And where you picked differently (for chat hints: "They picked Tea, you picked Coffee")
  select coalesce(json_agg(json_build_object('q', t.q, 'mine', t.mine, 'theirs', t.theirs)), '[]'::json) into tot_differ from (
    select g.state->'qs'->(x.i::int - 1)->>'q' as q,
      g.state->'qs'->(x.i::int - 1)->>(case when g.player_a = uid then x.p->>0 else x.p->>1 end) as mine,
      g.state->'qs'->(x.i::int - 1)->>(case when g.player_a = uid then x.p->>1 else x.p->>0 end) as theirs
    from games g
    cross join lateral jsonb_array_elements(coalesce(g.state->'picks', '[]'::jsonb)) with ordinality as x(p, i)
    where g.kind = 'tot'
      and ((g.player_a = uid and g.player_b = other) or (g.player_a = other and g.player_b = uid))
      and x.p->>0 is not null and x.p->>1 is not null and x.p->>0 <> x.p->>1
    order by g.created_at desc
    limit 3
  ) t where t.q is not null and t.mine is not null and t.theirs is not null;

  -- Link-Up answers you share (only once you're connected: answers stay private until then)
  if connected then
    select count(*), coalesce(json_agg(json_build_object('pact', t.pact, 'q', t.title, 'a', t.answer)) filter (where t.rn <= 4), '[]'::json)
    into link_count, links
    from (
      select p.name as pact, q.title, row_number() over (order by p.reveal_at desc, q.position) as rn,
        case
          when q.kind = 'choose_many' then (
            select string_agg(o->>'label', ', ')
            from jsonb_array_elements(q.options) o
            where jsonb_typeof(ea.answers->(q.id::text)) = 'array' and jsonb_typeof(eb.answers->(q.id::text)) = 'array'
              and (ea.answers->(q.id::text)) ? (o->>'id') and (eb.answers->(q.id::text)) ? (o->>'id'))
          when q.kind = 'scale' then
            case when ea.answers->>(q.id::text) = eb.answers->>(q.id::text) then (ea.answers->>(q.id::text)) || ' of 5' end
          else
            case when ea.answers->>(q.id::text) = eb.answers->>(q.id::text)
              then (select o->>'label' from jsonb_array_elements(q.options) o where o->>'id' = ea.answers->>(q.id::text) limit 1) end
        end as answer
      from pact_entries ea
      join pact_entries eb on eb.pact_id = ea.pact_id and eb.user_id = other
      join pacts p on p.id = ea.pact_id
      join pact_questions q on q.pact_id = ea.pact_id
      where ea.user_id = uid
    ) t
    where t.answer is not null;
  end if;

  return json_build_object(
    'connected', connected,
    'interests', array(select unnest(them.interests) intersect select unnest(me.interests)),
    'place', case
      when me.place_country is not null and me.place_country = them.place_country and me.place_region is not null and me.place_region = them.place_region then them.place_region
      when me.place_country is not null and me.place_country = them.place_country then 'same country'
    end,
    'tot', json_build_object('same', tot_same, 'rounds', tot_rounds, 'items', tot_items, 'differ', tot_differ),
    'words', case when connected then (array(select unnest(them.thing_keys) intersect select unnest(me.thing_keys)))[1:6] end,
    'linkups', case when connected then json_build_object('count', link_count, 'items', links) end
  );
end $$;
revoke execute on function public.in_common(uuid, uuid) from public, anon;
grant execute on function public.in_common(uuid, uuid) to authenticated;
