-- Dashpad update: Pacts match people before reveal night (Part 41)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 40 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 41: Matching starts when answers close, in small steps, with up to 12 hours to
-- finish before reveal night. The matches stay hidden (no names, no chats) until reveal
-- time, then the pact is revealed and everyone is told.
-- ---------------------------------------------------------------------------
alter table public.pacts drop constraint if exists pacts_reveal_step_check;
alter table public.pacts add constraint pacts_reveal_step_check check (reveal_step in ('match', 'ready', 'chats', 'notify', 'done'));

-- A run gets a pact to work on: matching once answers close, the rest once reveal time comes
create or replace function public.claim_pact_reveal(p_pact uuid, p_seconds int default 75) returns setof public.pacts
language sql security definer set search_path = public as $$
  update pacts set reveal_lock = now() + make_interval(secs => p_seconds), reveal_step = coalesce(reveal_step, 'match')
  where id = p_pact and status <> 'draft' and closes_at <= now()
    and (reveal_lock is null or reveal_lock < now())
    and (coalesce(reveal_step, 'match') in ('match', 'chats', 'notify') or (reveal_step = 'ready' and reveal_at <= now()))
  returning *;
$$;
revoke execute on function public.claim_pact_reveal(uuid, int) from public, anon, authenticated;

create or replace function public.create_pact_session(p_match bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  mt pact_matches;
  ea pact_entries;
  eb pact_entries;
  pa pacts;
  sid uuid;
  lvl smallint;
  q text;
begin
  select * into mt from pact_matches where id = p_match for update;
  if not found then return null; end if;
  if mt.session_id is not null then return mt.session_id; end if;
  -- Matches are made before reveal night; their chats only start once the pact is revealed
  select * into pa from pacts where id = mt.pact_id;
  if pa.status <> 'revealed' then return null; end if;
  select * into ea from pact_entries where id = mt.a;
  select * into eb from pact_entries where id = mt.b;
  if ea.user_id is null or eb.user_id is null or ea.user_id = eb.user_id then return null; end if;
  if public.is_blocked(ea.user_id, eb.user_id) then return null; end if;
  lvl := case mt.intent when 'spicy' then 2 else 1 end;
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, source, pact_id)
  values (ea.user_id, eb.user_id,
    (case mt.intent when 'love' then 'dating' when 'spicy' then 'spicy' else 'friends' end)::intent,
    lvl, lvl, lvl, mt.alias_a, mt.alias_b, now(), 'infinity', 'explore', pa.id)
  returning id into sid;
  insert into masquerade_messages (session_id, kind, body)
  values (sid, 'system', pa.name || ' matched you two (' || mt.score || '% alike). You''re both masked until you both unmask.');
  q := public.pick_icebreaker(sid, lvl, null);
  if q is not null then insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q); end if;
  update pact_matches set session_id = sid where id = mt.id;
  return sid;
end $$;
revoke execute on function public.create_pact_session(bigint) from public, anon, authenticated;

-- Your pacts: who you matched with only shows once the pact is revealed
create or replace function public.my_pacts() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.reveal_at desc), '[]'::json) from (
    select p.slug, p.name, p.logo_url, p.accent, p.reveal_at, p.closes_at, p.status,
      m.score, m.intent, m.shared, m.session_id,
      case when m.a = e.id then m.alias_b else m.alias_a end as match_alias
    from pact_entries e
    join pacts p on p.id = e.pact_id
    left join pact_matches m on p.status = 'revealed' and m.pact_id = e.pact_id and e.id in (m.a, m.b)
    where e.user_id = auth.uid()
  ) t
$$;

-- Drawings for the ready-made answers in pacts that already exist (answers with no picture only)
with art(label, image) as (values
  ('Owambe till 3am', '/pacts/art/owambe.svg'),
  ('Movie and suya at home', '/pacts/art/movie-suya.svg'),
  ('Save it for the future', '/pacts/art/save.svg'),
  ('Spend it on memories', '/pacts/art/spend.svg'),
  ('Building my own thing', '/pacts/art/own-thing.svg'),
  ('Rising in a great company', '/pacts/art/company.svg'),
  ('Talk it out right now', '/pacts/art/talk-now.svg'),
  ('Cool off, talk tomorrow', '/pacts/art/cool-off.svg'),
  ('Still in Lagos', '/pacts/art/lagos.svg'),
  ('Living abroad', '/pacts/art/abroad.svg'),
  ('A big part of my life', '/pacts/art/faith-big.svg'),
  ('Personal and private', '/pacts/art/faith-private.svg'),
  ('Party jollof, smoky', '/pacts/art/party-jollof.svg'),
  ('Home jollof, mama''s way', '/pacts/art/home-jollof.svg'),
  ('At church or the mosque', '/pacts/art/worship.svg'),
  ('At brunch with friends', '/pacts/art/brunch.svg'),
  ('Asleep, recovering', '/pacts/art/asleep.svg'),
  ('Working on my side hustle', '/pacts/art/side-hustle.svg'),
  ('At the beach', '/pacts/art/beach.svg'))
update public.pact_questions q set options = (
  select jsonb_agg(case when coalesce(o->>'image', '') = '' and a.image is not null then o || jsonb_build_object('image', a.image) else o end order by i)
  from jsonb_array_elements(q.options) with ordinality as x(o, i)
  left join art a on a.label = o->>'label')
where exists (select 1 from jsonb_array_elements(q.options) o join art a on a.label = o->>'label' where coalesce(o->>'image', '') = '');
