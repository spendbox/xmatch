-- Dashpad database
-- Run this whole file once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.gender as enum ('woman', 'man', 'other');
exception when duplicate_object then null; end $$;

-- Older setups used 'nonbinary'; it is now called 'other'
do $$ begin
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
             where t.typname = 'gender' and e.enumlabel = 'nonbinary') then
    alter type public.gender rename value 'nonbinary' to 'other';
  end if;
end $$;

do $$ begin
  create type public.intent as enum ('friends', 'dating', 'spicy');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.seeking as enum ('women', 'men', 'anyone');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Profiles (what other people can see once you match)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text check (char_length(display_name) between 1 and 40),
  birthdate date,
  gender public.gender,
  bio text not null default '' check (char_length(bio) <= 500),
  interests text[] not null default '{}',
  photos text[] not null default '{}',
  -- Masquerade settings
  open_to_masquerade boolean not null default false,
  pref_intent public.intent not null default 'dating',
  pref_seeking public.seeking not null default 'anyone',
  pref_age_min int not null default 18 check (pref_age_min >= 18),
  pref_age_max int not null default 40 check (pref_age_max <= 99),
  pref_spice smallint not null default 1 check (pref_spice between 0 and 3),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Private contact details (only you and the server can read them)
create table if not exists public.accounts_private (
  user_id uuid primary key references auth.users on delete cascade,
  email text,
  phone text unique
);

-- ---------------------------------------------------------------------------
-- Masquerade
-- ---------------------------------------------------------------------------
create table if not exists public.masquerade_queue (
  user_id uuid primary key references public.profiles on delete cascade,
  intent public.intent not null,
  seeking public.seeking not null,
  age_min int not null,
  age_max int not null,
  spice smallint not null,
  created_at timestamptz not null default now(),
  last_ping_at timestamptz not null default now()
);

create table if not exists public.masquerade_sessions (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles on delete cascade,
  user_b uuid not null references public.profiles on delete cascade,
  intent public.intent not null,
  spice_a smallint not null,
  spice_b smallint not null,
  spice_level smallint not null,
  alias_a text not null,
  alias_b text not null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  unmask_a boolean,
  unmask_b boolean,
  status text not null default 'active' check (status in ('active', 'matched', 'ended')),
  ended_reason text,
  match_id uuid
);
create index if not exists masquerade_sessions_a on public.masquerade_sessions (user_a, status);
create index if not exists masquerade_sessions_b on public.masquerade_sessions (user_b, status);

create table if not exists public.masquerade_messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.masquerade_sessions on delete cascade,
  sender_id uuid references public.profiles on delete cascade, -- empty for icebreaker cards
  kind text not null default 'text' check (kind in ('text', 'icebreaker')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists masquerade_messages_session on public.masquerade_messages (session_id, id);

create table if not exists public.masquerade_invites (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles on delete cascade,
  to_user uuid not null references public.profiles on delete cascade,
  intent public.intent not null,
  spice smallint not null,
  from_age int not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  session_id uuid references public.masquerade_sessions on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '45 seconds'
);
create index if not exists masquerade_invites_to on public.masquerade_invites (to_user, status);

-- Location (rounded to about 1 km, never shown exactly)
alter table public.accounts_private add column if not exists lat double precision;
alter table public.accounts_private add column if not exists lng double precision;
alter table public.accounts_private add column if not exists location_at timestamptz;
alter table public.profiles add column if not exists pref_max_km int; -- empty = anywhere
alter table public.masquerade_queue add column if not exists lat double precision;
alter table public.masquerade_queue add column if not exists lng double precision;
alter table public.masquerade_queue add column if not exists max_km int;
alter table public.masquerade_invites add column if not exists distance_km int;

create table if not exists public.icebreakers (
  id serial primary key,
  spice smallint not null check (spice between 0 and 3),
  body text not null
);

-- ---------------------------------------------------------------------------
-- Matches and chat
-- ---------------------------------------------------------------------------
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles on delete cascade,
  user_b uuid not null references public.profiles on delete cascade,
  session_id uuid,
  intent public.intent not null default 'dating',
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches on delete cascade,
  sender_id uuid references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_match on public.messages (match_id, id);

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles on delete cascade,
  reported_id uuid not null references public.profiles on delete cascade,
  session_id uuid,
  reason text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.age_years(d date) returns int
language sql stable as $$ select extract(year from age(current_date, d))::int $$;

create or replace function public.gender_fits(s public.seeking, g public.gender) returns boolean
language sql immutable as $$
  select s = 'anyone' or (s = 'women' and g = 'woman') or (s = 'men' and g = 'man')
$$;

-- Distance in km between two points (null if either is unknown)
create or replace function public.distance_km(lat1 double precision, lng1 double precision,
                                              lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select case when lat1 is null or lat2 is null then null else
    6371 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    )) end
$$;

-- Is this distance OK for someone with this limit? (no limit = anywhere)
create or replace function public.within_km(d double precision, max_km int) returns boolean
language sql immutable as $$ select max_km is null or (d is not null and d <= max_km) $$;

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from reports
    where (reporter_id = a and reported_id = b) or (reporter_id = b and reported_id = a)
  )
$$;

create or replace function public.already_matched(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from matches where user_a = least(a, b) and user_b = greatest(a, b))
$$;

create or replace function public.is_matched_with(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.already_matched(auth.uid(), other)
$$;

create or replace function public.random_alias(avoid text default '') returns text
language plpgsql volatile as $$
declare
  adj text[] := array['Velvet','Midnight','Golden','Silver','Scarlet','Hidden','Wild','Quiet','Lucky','Cosmic','Gentle','Bold','Secret','Electric','Sunlit','Misty'];
  noun text[] := array['Fox','Owl','Swan','Panther','Moth','Raven','Lynx','Dove','Comet','Tiger','Heron','Wolf','Falcon','Otter','Phoenix','Hare'];
  result text;
begin
  loop
    result := adj[1 + floor(random() * array_length(adj, 1))::int] || ' ' ||
              noun[1 + floor(random() * array_length(noun, 1))::int];
    exit when result <> avoid;
  end loop;
  return result;
end $$;

create or replace function public.my_active_session(uid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from masquerade_sessions
  where status = 'active' and (user_a = uid or user_b = uid)
  order by started_at desc limit 1
$$;

-- Starts a 5 minute masked chat between two people.
create or replace function public.create_masquerade_session(
  a uuid, b uuid, p_intent public.intent, s_a smallint, s_b smallint
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
  lvl smallint := round((s_a + s_b) / 2.0)::smallint; -- questions follow the average of both picks
  alias_a text := public.random_alias();
  first_q text;
begin
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, ends_at)
  values (a, b, p_intent, s_a, s_b, lvl, alias_a, public.random_alias(alias_a), now() + interval '5 minutes')
  returning id into sid;

  select body into first_q from icebreakers where spice = lvl order by random() limit 1;
  if first_q is not null then
    insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', first_q);
  end if;

  delete from masquerade_queue where user_id in (a, b);
  update masquerade_invites set status = 'expired'
    where status = 'pending' and (from_user in (a, b) or to_user in (a, b));
  return sid;
end $$;

-- Looks through the waiting list for someone who fits, both ways.
create or replace function public.try_masquerade_match(uid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me_q masquerade_queue;
  me_p profiles;
  cand masquerade_queue;
begin
  perform pg_advisory_xact_lock(424242);

  select * into me_q from masquerade_queue where user_id = uid;
  if not found then return public.my_active_session(uid); end if;
  select * into me_p from profiles where id = uid;

  select q.* into cand
  from masquerade_queue q
  join profiles p on p.id = q.user_id
  where q.user_id <> uid
    and q.intent = me_q.intent
    and q.last_ping_at > now() - interval '30 seconds'
    and public.gender_fits(me_q.seeking, p.gender)
    and public.gender_fits(q.seeking, me_p.gender)
    and public.age_years(p.birthdate) between me_q.age_min and me_q.age_max
    and public.age_years(me_p.birthdate) between q.age_min and q.age_max
    and public.within_km(public.distance_km(me_q.lat, me_q.lng, q.lat, q.lng), me_q.max_km)
    and public.within_km(public.distance_km(me_q.lat, me_q.lng, q.lat, q.lng), q.max_km)
    and not public.is_blocked(uid, q.user_id)
    and not public.already_matched(uid, q.user_id)
  -- Closest people first, then whoever has waited longest
  order by public.distance_km(me_q.lat, me_q.lng, q.lat, q.lng) nulls last, q.created_at
  limit 1;

  if not found then return null; end if;

  return public.create_masquerade_session(cand.user_id, uid, me_q.intent, cand.spice, me_q.spice);
end $$;

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

-- "Put on your mask": join the waiting list and try to match right away.
drop function if exists public.start_masquerade(public.intent, public.seeking, int, int, smallint);
create or replace function public.start_masquerade(
  p_intent public.intent, p_seeking public.seeking, p_age_min int, p_age_max int, p_spice smallint,
  p_max_km int default null, p_lat double precision default null, p_lng double precision default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  sid uuid;
  my_age int;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into me from profiles where id = uid;
  if me.birthdate is null or me.gender is null or me.display_name is null then
    raise exception 'Please finish your profile first';
  end if;
  if p_spice < 0 or p_spice > 3 then raise exception 'Invalid spice level'; end if;
  p_age_min := greatest(18, least(p_age_min, 99));
  p_age_max := greatest(p_age_min, least(p_age_max, 99));
  my_age := public.age_years(me.birthdate);
  if p_max_km is not null and p_max_km < 1 then p_max_km := null; end if;
  -- Keep location approximate (about 1 km)
  p_lat := round(p_lat::numeric, 2)::double precision;
  p_lng := round(p_lng::numeric, 2)::double precision;
  if p_lat is null then
    select lat, lng into p_lat, p_lng from accounts_private where user_id = uid;
  end if;
  if p_max_km is not null and p_lat is null then
    raise exception 'Turn on location to match by distance, or choose Anywhere';
  end if;

  update profiles set pref_intent = p_intent, pref_seeking = p_seeking, pref_age_min = p_age_min,
    pref_age_max = p_age_max, pref_spice = p_spice, pref_max_km = p_max_km, last_seen_at = now()
  where id = uid;
  update accounts_private set lat = p_lat, lng = p_lng,
    location_at = case when p_lat is not null then now() else location_at end
  where user_id = uid;

  sid := public.my_active_session(uid);
  if sid is not null then return sid; end if;

  insert into masquerade_queue (user_id, intent, seeking, age_min, age_max, spice, lat, lng, max_km)
  values (uid, p_intent, p_seeking, p_age_min, p_age_max, p_spice, p_lat, p_lng, p_max_km)
  on conflict (user_id) do update set intent = excluded.intent, seeking = excluded.seeking,
    age_min = excluded.age_min, age_max = excluded.age_max, spice = excluded.spice,
    lat = excluded.lat, lng = excluded.lng, max_km = excluded.max_km,
    created_at = now(), last_ping_at = now();

  sid := public.try_masquerade_match(uid);
  if sid is not null then return sid; end if;

  -- Nobody waiting yet: send a pop-up to people who are online and open to Masquerade.
  insert into masquerade_invites (from_user, to_user, intent, spice, from_age, distance_km)
  select uid, p.id, p_intent, p_spice, my_age, ceil(public.distance_km(p_lat, p_lng, a.lat, a.lng))::int
  from profiles p
  left join accounts_private a on a.user_id = p.id
  where p.open_to_masquerade
    and p.id <> uid
    and p.last_seen_at > now() - interval '2 minutes'
    and p.pref_intent = p_intent
    and p.birthdate is not null and p.gender is not null
    and public.gender_fits(p_seeking, p.gender)
    and public.gender_fits(p.pref_seeking, me.gender)
    and public.age_years(p.birthdate) between p_age_min and p_age_max
    and my_age between p.pref_age_min and p.pref_age_max
    and not exists (select 1 from masquerade_queue q where q.user_id = p.id)
    and public.my_active_session(p.id) is null
    and not exists (select 1 from masquerade_invites i where i.to_user = p.id and i.status = 'pending' and i.expires_at > now())
    and public.within_km(public.distance_km(p_lat, p_lng, a.lat, a.lng), p_max_km)
    and public.within_km(public.distance_km(p_lat, p_lng, a.lat, a.lng), p.pref_max_km)
    and not public.is_blocked(uid, p.id)
    and not public.already_matched(uid, p.id)
  -- Invite the closest people first
  order by public.distance_km(p_lat, p_lng, a.lat, a.lng) nulls last, random()
  limit 3;

  return null;
end $$;

-- Called every few seconds while waiting. Returns the chat id once matched.
create or replace function public.poll_masquerade() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  update profiles set last_seen_at = now() where id = uid;
  sid := public.my_active_session(uid);
  if sid is not null then return sid; end if;
  update masquerade_queue set last_ping_at = now() where user_id = uid;
  if not found then return null; end if;
  return public.try_masquerade_match(uid);
end $$;

create or replace function public.cancel_masquerade() returns void
language sql security definer set search_path = public as $$
  delete from masquerade_queue where user_id = auth.uid();
  update masquerade_invites set status = 'expired' where from_user = auth.uid() and status = 'pending';
$$;

create or replace function public.heartbeat() returns void
language sql security definer set search_path = public as $$
  update profiles set last_seen_at = now() where id = auth.uid();
$$;

-- Accept a pop-up invite.
create or replace function public.accept_masquerade_invite(p_invite uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  inv masquerade_invites;
  sender masquerade_queue;
  me profiles;
  sid uuid;
begin
  perform pg_advisory_xact_lock(424242);
  select * into inv from masquerade_invites where id = p_invite and to_user = uid for update;
  if not found or inv.status <> 'pending' or inv.expires_at < now() then
    update masquerade_invites set status = 'expired' where id = p_invite and status = 'pending';
    return null;
  end if;

  select * into sender from masquerade_queue
  where user_id = inv.from_user and last_ping_at > now() - interval '30 seconds';
  if not found or public.my_active_session(uid) is not null then
    update masquerade_invites set status = 'expired' where id = p_invite;
    return null;
  end if;

  select * into me from profiles where id = uid;
  sid := public.create_masquerade_session(inv.from_user, uid, sender.intent, sender.spice, me.pref_spice);
  update masquerade_invites set status = 'accepted', session_id = sid where id = p_invite;
  return sid;
end $$;

create or replace function public.decline_masquerade_invite(p_invite uuid) returns void
language sql security definer set search_path = public as $$
  update masquerade_invites set status = 'declined'
  where id = p_invite and to_user = auth.uid() and status = 'pending';
$$;

-- Decides the outcome once both have chosen (or time has run out).
create or replace function public.finalize_masquerade(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s masquerade_sessions;
  mid uuid;
begin
  select * into s from masquerade_sessions where id = p_session for update;
  if not found or s.status <> 'active' then return; end if;

  if s.unmask_a is true and s.unmask_b is true then
    insert into matches (user_a, user_b, session_id, intent)
    values (least(s.user_a, s.user_b), greatest(s.user_a, s.user_b), s.id, s.intent)
    on conflict (user_a, user_b) do update set session_id = excluded.session_id
    returning id into mid;

    -- Keep the conversation for the new match
    insert into messages (match_id, sender_id, body, created_at)
    select mid, sender_id, case when kind = 'icebreaker' then '💬 ' || body else body end, created_at
    from masquerade_messages where session_id = s.id order by id;

    update masquerade_sessions set status = 'matched', match_id = mid where id = s.id;
    delete from masquerade_messages where session_id = s.id;
  elsif s.unmask_a is false or s.unmask_b is false
        or now() > s.ends_at + interval '90 seconds' then
    update masquerade_sessions set status = 'ended',
      ended_reason = coalesce(ended_reason, case when now() > s.ends_at + interval '90 seconds'
        and (s.unmask_a is null or s.unmask_b is null) then 'timeout' else 'declined' end)
    where id = s.id;
    -- No match: the chat disappears
    delete from masquerade_messages where session_id = s.id;
  end if;
end $$;

-- Choose to unmask (true) or stay masked / leave (false).
create or replace function public.vote_unmask(p_session uuid, p_unmask boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then raise exception 'Chat not found'; end if;
  if s.status <> 'active' then return; end if;
  if p_unmask and now() < s.ends_at - interval '2 seconds' then
    raise exception 'You can unmask when the timer ends';
  end if;
  if uid = s.user_a then
    update masquerade_sessions set unmask_a = p_unmask,
      ended_reason = case when not p_unmask and now() < s.ends_at then 'left' else ended_reason end
    where id = p_session;
  else
    update masquerade_sessions set unmask_b = p_unmask,
      ended_reason = case when not p_unmask and now() < s.ends_at then 'left' else ended_reason end
    where id = p_session;
  end if;
  perform public.finalize_masquerade(p_session);
end $$;

-- Everything the chat screen needs, without revealing who the other person is.
create or replace function public.get_masquerade(p_session uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
  other uuid;
  op profiles;
  my_loc accounts_private;
  their_loc accounts_private;
  i_am_a boolean;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then return null; end if;
  if s.status = 'active' and now() > s.ends_at + interval '90 seconds' then
    perform public.finalize_masquerade(p_session);
    select * into s from masquerade_sessions where id = p_session;
  end if;

  i_am_a := s.user_a = uid;
  other := case when i_am_a then s.user_b else s.user_a end;
  select * into op from profiles where id = other;
  select * into my_loc from accounts_private where user_id = uid;
  select * into their_loc from accounts_private where user_id = other;

  return json_build_object(
    'id', s.id,
    'status', s.status,
    'ended_reason', s.ended_reason,
    'intent', s.intent,
    'spice_level', s.spice_level,
    'started_at', s.started_at,
    'ends_at', s.ends_at,
    'server_now', now(),
    'match_id', s.match_id,
    'me', json_build_object(
      'id', uid,
      'alias', case when i_am_a then s.alias_a else s.alias_b end,
      'spice', case when i_am_a then s.spice_a else s.spice_b end,
      'vote', case when i_am_a then s.unmask_a else s.unmask_b end
    ),
    'them', json_build_object(
      'alias', case when i_am_a then s.alias_b else s.alias_a end,
      'spice', case when i_am_a then s.spice_b else s.spice_a end,
      'age', public.age_years(op.birthdate),
      'gender', op.gender,
      'interests', op.interests,
      'distance_km', ceil(public.distance_km(my_loc.lat, my_loc.lng, their_loc.lat, their_loc.lng))::int,
      'has_voted', (case when i_am_a then s.unmask_b else s.unmask_a end) is not null,
      -- Only revealed after you both unmask
      'profile', case when s.status = 'matched' then json_build_object(
        'id', op.id, 'display_name', op.display_name, 'bio', op.bio, 'photos', op.photos
      ) else null end
    )
  );
end $$;

create or replace function public.next_icebreaker(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s masquerade_sessions;
  q text;
begin
  select * into s from masquerade_sessions
  where id = p_session and (user_a = auth.uid() or user_b = auth.uid()) and status = 'active' and ends_at > now();
  if not found then return; end if;
  select body into q from icebreakers i
  where spice = s.spice_level
    and not exists (select 1 from masquerade_messages m where m.session_id = s.id and m.kind = 'icebreaker' and m.body = i.body)
  order by random() limit 1;
  if q is null then
    select body into q from icebreakers where spice = s.spice_level order by random() limit 1;
  end if;
  if q is not null then
    insert into masquerade_messages (session_id, kind, body) values (s.id, 'icebreaker', q);
  end if;
end $$;

create or replace function public.report_masquerade(p_session uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then return; end if;
  insert into reports (reporter_id, reported_id, session_id, reason)
  values (uid, case when s.user_a = uid then s.user_b else s.user_a end, s.id, coalesce(p_reason, ''));
  update masquerade_sessions set ended_reason = 'reported',
    unmask_a = case when user_a = uid then false else unmask_a end,
    unmask_b = case when user_b = uid then false else unmask_b end
  where id = s.id and status = 'active';
  perform public.finalize_masquerade(s.id);
end $$;

create or replace function public.report_match(p_match uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m matches;
begin
  select * into m from matches where id = p_match and (user_a = uid or user_b = uid);
  if not found then return; end if;
  insert into reports (reporter_id, reported_id, reason)
  values (uid, case when m.user_a = uid then m.user_b else m.user_a end, coalesce(p_reason, ''));
  delete from matches where id = m.id;
end $$;

-- Matches list with the other person's details and the last message.
create or replace function public.get_matches() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.last_message_at desc), '[]'::json) from (
    select m.id, m.created_at, m.last_message_at, m.intent,
      p.id as other_id, p.display_name, p.photos, public.age_years(p.birthdate) as age,
      (select body from messages x where x.match_id = m.id order by x.id desc limit 1) as last_message,
      (select sender_id from messages x where x.match_id = m.id order by x.id desc limit 1) as last_sender
    from matches m
    join profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
    where m.user_a = auth.uid() or m.user_b = auth.uid()
  ) t
$$;

-- Lets the server find which email belongs to a phone number (used for phone log-in).
create or replace function public.email_for_phone(p_phone text) returns text
language sql stable security definer set search_path = public as $$
  select email from accounts_private where phone = p_phone limit 1
$$;
revoke execute on function public.email_for_phone(text) from public, anon, authenticated;

create or replace function public.bump_match_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update matches set last_message_at = new.created_at where id = new.match_id;
  return new;
end $$;
drop trigger if exists messages_bump on public.messages;
create trigger messages_bump after insert on public.messages
  for each row execute function public.bump_match_activity();

-- New account -> empty profile + private contact row
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  insert into accounts_private (user_id, email, phone)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'phone', ''))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Internal helpers should not be callable directly from the app
revoke execute on function public.create_masquerade_session(uuid, uuid, public.intent, smallint, smallint) from public, anon, authenticated;
revoke execute on function public.try_masquerade_match(uuid) from public, anon, authenticated;
revoke execute on function public.finalize_masquerade(uuid) from public, anon, authenticated;
revoke execute on function public.my_active_session(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Security rules (who can read/write what)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.accounts_private enable row level security;
alter table public.masquerade_queue enable row level security;
alter table public.masquerade_sessions enable row level security;
alter table public.masquerade_messages enable row level security;
alter table public.masquerade_invites enable row level security;
alter table public.icebreakers enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;

drop policy if exists "read own or matched profile" on public.profiles;
create policy "read own or matched profile" on public.profiles for select
  using (id = auth.uid() or public.is_matched_with(id));
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "read own contact" on public.accounts_private;
create policy "read own contact" on public.accounts_private for select using (user_id = auth.uid());

drop policy if exists "read own queue" on public.masquerade_queue;
create policy "read own queue" on public.masquerade_queue for select using (user_id = auth.uid());

drop policy if exists "participants read session" on public.masquerade_sessions;
create policy "participants read session" on public.masquerade_sessions for select
  using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists "participants read messages" on public.masquerade_messages;
create policy "participants read messages" on public.masquerade_messages for select
  using (exists (select 1 from public.masquerade_sessions s where s.id = session_id
    and (s.user_a = auth.uid() or s.user_b = auth.uid())));
drop policy if exists "participants send messages" on public.masquerade_messages;
create policy "participants send messages" on public.masquerade_messages for insert
  with check (sender_id = auth.uid() and kind = 'text' and exists (
    select 1 from public.masquerade_sessions s where s.id = session_id
      and (s.user_a = auth.uid() or s.user_b = auth.uid())
      and s.status = 'active' and now() < s.ends_at));

drop policy if exists "read my invites" on public.masquerade_invites;
create policy "read my invites" on public.masquerade_invites for select
  using (to_user = auth.uid() or from_user = auth.uid());

drop policy if exists "read icebreakers" on public.icebreakers;
create policy "read icebreakers" on public.icebreakers for select using (auth.role() = 'authenticated');

drop policy if exists "read my matches" on public.matches;
create policy "read my matches" on public.matches for select
  using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists "read match messages" on public.messages;
create policy "read match messages" on public.messages for select
  using (exists (select 1 from public.matches m where m.id = match_id
    and (m.user_a = auth.uid() or m.user_b = auth.uid())));
drop policy if exists "send match messages" on public.messages;
create policy "send match messages" on public.messages for insert
  with check (sender_id = auth.uid() and exists (select 1 from public.matches m where m.id = match_id
    and (m.user_a = auth.uid() or m.user_b = auth.uid())));

-- ---------------------------------------------------------------------------
-- Live updates
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['masquerade_sessions','masquerade_messages','masquerade_invites','messages','matches'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Photo storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "upload own photos" on storage.objects;
create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "delete own photos" on storage.objects;
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Icebreaker questions (0 = Mild, 1 = A little spicy, 2 = Spicy, 3 = Naughty)
-- ---------------------------------------------------------------------------
insert into public.icebreakers (spice, body)
select * from (values
  (0, 'What''s a small thing that made you smile this week?'),
  (0, 'Perfect weekend: lazy at home or out exploring?'),
  (0, 'What''s a food you could eat every single day?'),
  (0, 'Which song have you had on repeat lately?'),
  (0, 'If you could live anywhere for a year, where would it be?'),
  (0, 'What''s something you''re secretly really good at?'),
  (0, 'Morning person or night owl? Defend your answer.'),
  (0, 'What''s the best advice anyone has ever given you?'),
  (1, 'What''s the first thing you notice about someone?'),
  (1, 'What''s your idea of a perfect first date?'),
  (1, 'What''s your most harmless guilty pleasure?'),
  (1, 'Have you ever had a crush on a friend? What happened?'),
  (1, 'What''s a green flag that instantly wins you over?'),
  (1, 'What''s the boldest thing you''ve done to get someone''s attention?'),
  (1, 'Pick one: deep talks till 3am or dancing till 3am?'),
  (1, 'What compliment do you never get tired of hearing?'),
  (2, 'What''s your biggest turn-on that isn''t physical?'),
  (2, 'Describe your type in three words, no names.'),
  (2, 'What''s the most romantic thing you''ve ever done?'),
  (2, 'Kissing in the rain: overrated or a must?'),
  (2, 'What''s something you''ve always wanted to try on a date but haven''t?'),
  (2, 'What''s the most memorable flirty message you''ve ever received?'),
  (2, 'Where''s the most unexpected place you''ve had a crush on someone?'),
  (2, 'What does chemistry feel like to you?'),
  (3, 'What''s a fantasy you''d only admit behind a mask?'),
  (3, 'What''s the most daring place you''ve been kissed?'),
  (3, 'What''s your biggest turn-on, honestly?'),
  (3, 'Slow and teasing or straight to the point?'),
  (3, 'What''s the wildest thing on your bucket list?'),
  (3, 'What outfit makes you feel most irresistible?'),
  (3, 'What''s one thing that instantly gets your heart racing?'),
  (3, 'Tell me a secret you''ve never said out loud.')
) v(spice, body)
where not exists (select 1 from public.icebreakers);

revoke execute on function public.is_blocked(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.already_matched(uuid, uuid) from public, anon, authenticated;
