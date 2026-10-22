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
  open_to_masquerade boolean not null default true,
  pref_intent public.intent not null default 'dating',
  pref_seeking text not null default 'anyone',
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
  seeking text not null,
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
alter table public.accounts_private add column if not exists terms_accepted_at timestamptz;
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
-- "I’d like to meet" can hold up to two choices, e.g. 'women,other', or 'anyone'.
-- (Older databases stored a single choice; convert them in place.)
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public'
             and table_name = 'profiles' and column_name = 'pref_seeking' and data_type = 'USER-DEFINED') then
    alter table public.profiles alter column pref_seeking drop default;
    alter table public.profiles alter column pref_seeking type text using pref_seeking::text;
    alter table public.profiles alter column pref_seeking set default 'anyone';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
             and table_name = 'masquerade_queue' and column_name = 'seeking' and data_type = 'USER-DEFINED') then
    alter table public.masquerade_queue alter column seeking type text using seeking::text;
  end if;
end $$;

create or replace function public.seeking_ok(s text) returns boolean
language sql immutable as $$
  select s = 'anyone' or (
    cardinality(string_to_array(s, ',')) between 1 and 2
    and string_to_array(s, ',') <@ array['women', 'men', 'other']
  )
$$;

alter table public.profiles drop constraint if exists profiles_pref_seeking_ok;
alter table public.profiles add constraint profiles_pref_seeking_ok check (public.seeking_ok(pref_seeking));

-- New members start with "Open to Masquerade" switched on
alter table public.profiles alter column open_to_masquerade set default true;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.age_years(d date) returns int
language sql stable as $$ select extract(year from age(current_date, d))::int $$;

drop function if exists public.gender_fits(public.seeking, public.gender);
create or replace function public.gender_fits(s text, g public.gender) returns boolean
language sql immutable as $$
  select s = 'anyone' or (case g when 'woman' then 'women' when 'man' then 'men' else 'other' end) = any(string_to_array(s, ','))
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

-- How many interests two people have in common
create or replace function public.shared_count(a text[], b text[]) returns int
language sql immutable as $$
  select coalesce(cardinality(array(select unnest(a) intersect select unnest(b))), 0)
$$;

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
  -- Closest people first (in 10 km steps), then most shared interests, then whoever waited longest
  order by floor(public.distance_km(me_q.lat, me_q.lng, q.lat, q.lng) / 10) nulls last,
    public.shared_count(p.interests, me_p.interests) desc,
    q.created_at
  limit 1;

  if not found then return null; end if;

  return public.create_masquerade_session(cand.user_id, uid, me_q.intent, cand.spice, me_q.spice);
end $$;

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

-- "Put on your mask": join the waiting list and try to match right away.
drop function if exists public.start_masquerade(public.intent, public.seeking, int, int, smallint);
drop function if exists public.start_masquerade(public.intent, public.seeking, int, int, smallint, int, double precision, double precision);
create or replace function public.start_masquerade(
  p_intent public.intent, p_seeking text, p_age_min int, p_age_max int, p_spice smallint,
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
  if p_seeking is null or not public.seeking_ok(p_seeking) then p_seeking := 'anyone'; end if;
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
  -- Invite the closest people first, then those with the most in common
  order by floor(public.distance_km(p_lat, p_lng, a.lat, a.lng) / 10) nulls last,
    public.shared_count(p.interests, me.interests) desc, random()
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
  mp profiles;
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
  select * into mp from profiles where id = uid;
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
      'shared_interests', array(select unnest(op.interests) intersect select unnest(mp.interests)),
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

-- Unmatch: removes the match and its messages for both people
create or replace function public.unmatch(p_match uuid) returns void
language sql security definer set search_path = public as $$
  delete from matches where id = p_match and (user_a = auth.uid() or user_b = auth.uid());
$$;

-- Unread chats: when each person last opened the chat
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
                 and table_name = 'matches' and column_name = 'a_read_at') then
    alter table public.matches add column a_read_at timestamptz, add column b_read_at timestamptz;
    -- Existing chats start as read, so nobody gets a wall of old dots
    update public.matches set a_read_at = now(), b_read_at = now();
  end if;
end $$;

create or replace function public.chat_unread(m public.matches, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from messages x
    where x.match_id = m.id and x.sender_id <> uid
      and x.created_at > coalesce(case when m.user_a = uid then m.a_read_at else m.b_read_at end, '-infinity'::timestamptz)
  )
$$;

-- Opening a chat marks it as read
create or replace function public.mark_chat_read(p_match uuid) returns void
language sql security definer set search_path = public as $$
  update matches set
    a_read_at = case when user_a = auth.uid() then now() else a_read_at end,
    b_read_at = case when user_b = auth.uid() then now() else b_read_at end
  where id = p_match and auth.uid() in (user_a, user_b)
$$;

-- How many chats have something new, for the dot on the menu
create or replace function public.unread_chats() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from matches m
  where auth.uid() in (m.user_a, m.user_b) and public.chat_unread(m, auth.uid())
$$;

-- Matches list with the other person's details and the last message.
create or replace function public.get_matches() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.last_message_at desc), '[]'::json) from (
    select m.id, m.created_at, m.last_message_at, m.intent,
      p.id as other_id, p.display_name, p.photos, public.age_years(p.birthdate) as age,
      public.shared_count(p.interests, (select interests from profiles where id = auth.uid())) as shared,
      (select body from messages x where x.match_id = m.id order by x.id desc limit 1) as last_message,
      (select sender_id from messages x where x.match_id = m.id order by x.id desc limit 1) as last_sender,
      public.chat_unread(m, auth.uid()) as unread
    from matches m
    join profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
    where m.user_a = auth.uid() or m.user_b = auth.uid()
  ) t
$$;

-- Phone log-in was removed (email only)
drop function if exists public.set_my_phone(text);
drop function if exists public.email_for_phone(text);

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
  insert into accounts_private (user_id, email, terms_accepted_at)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz)
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
  (0, 'What’s a small thing that made you smile this week?'),
  (0, 'Perfect weekend: lazy at home or out exploring?'),
  (0, 'What’s a food you could eat every single day?'),
  (0, 'Which song have you had on repeat lately?'),
  (0, 'If you could live anywhere for a year, where would it be?'),
  (0, 'What’s something you’re secretly really good at?'),
  (0, 'Morning person or night owl? Defend your answer.'),
  (0, 'What’s the best advice anyone has ever given you?'),
  (1, 'What’s the first thing you notice about someone?'),
  (1, 'What’s your idea of a perfect first date?'),
  (1, 'What’s your most harmless guilty pleasure?'),
  (1, 'Have you ever had a crush on a friend? What happened?'),
  (1, 'What’s a green flag that instantly wins you over?'),
  (1, 'What’s the boldest thing you’ve done to get someone’s attention?'),
  (1, 'Pick one: deep talks till 3am or dancing till 3am?'),
  (1, 'What compliment do you never get tired of hearing?'),
  (2, 'What’s your biggest turn-on that isn’t physical?'),
  (2, 'Describe your type in three words, no names.'),
  (2, 'What’s the most romantic thing you’ve ever done?'),
  (2, 'Kissing in the rain: overrated or a must?'),
  (2, 'What’s something you’ve always wanted to try on a date but haven’t?'),
  (2, 'What’s the most memorable flirty message you’ve ever received?'),
  (2, 'Where’s the most unexpected place you’ve had a crush on someone?'),
  (2, 'What does chemistry feel like to you?'),
  (3, 'What’s a fantasy you’d only admit behind a mask?'),
  (3, 'What’s the most daring place you’ve been kissed?'),
  (3, 'What’s your biggest turn-on, honestly?'),
  (3, 'Slow and teasing or straight to the point?'),
  (3, 'What’s the wildest thing on your bucket list?'),
  (3, 'What outfit makes you feel most irresistible?'),
  (3, 'What’s one thing that instantly gets your heart racing?'),
  (3, 'Tell me a secret you’ve never said out loud.')
) v(spice, body)
where not exists (select 1 from public.icebreakers);

revoke execute on function public.is_blocked(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.already_matched(uuid, uuid) from public, anon, authenticated;

-- ===========================================================================
-- Rich chat: replies, photos, videos, voice notes, and calls
-- ===========================================================================

-- Match chat messages can now be text, photo, video, voice note or a call record
alter table public.messages add column if not exists kind text not null default 'text';
alter table public.messages add column if not exists media_path text;
alter table public.messages add column if not exists media_meta jsonb;
alter table public.messages add column if not exists reply_to bigint references public.messages (id) on delete set null;
alter table public.messages add column if not exists deleted_at timestamptz;
alter table public.messages alter column body set default '';
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check check (
  char_length(body) <= 2000 and (
    (kind = 'text' and (char_length(body) >= 1 or deleted_at is not null))
    or (kind in ('image', 'video', 'audio') and (media_path is not null or deleted_at is not null))
    or kind in ('call', 'gift')
  )
);
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'image', 'video', 'audio', 'call', 'gift'));

-- Replies in the masked chat too
alter table public.masquerade_messages add column if not exists reply_to bigint references public.masquerade_messages (id) on delete set null;

-- Senders can only send media into their own match's folder (checked again by storage rules)
drop policy if exists "send match messages" on public.messages;
create policy "send match messages" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and kind in ('text', 'image', 'video', 'audio')
    and deleted_at is null
    and (media_path is null or split_part(media_path, '/', 1) = match_id::text)
    and exists (select 1 from public.matches m where m.id = match_id and (m.user_a = auth.uid() or m.user_b = auth.uid()))
  );

-- Delete your own message for everyone (it shows as "Message deleted")
create or replace function public.delete_message(p_message bigint) returns text
language plpgsql security definer set search_path = public as $$
declare
  path text;
begin
  update messages set deleted_at = now(), body = '', media_meta = null
  where id = p_message and sender_id = auth.uid() and deleted_at is null and kind <> 'call'
  returning media_path into path;
  update messages set media_path = null where id = p_message and sender_id = auth.uid();
  return path; -- the app removes the file
end $$;

-- Private storage for chat photos, videos and voice notes. Files are only
-- readable by the two people in the match, through short-lived links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime',
        'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac','audio/x-m4a','audio/wav'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.in_match(p_match text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from matches
    where id::text = p_match and (user_a = auth.uid() or user_b = auth.uid())
  )
$$;

drop policy if exists "match members read chat media" on storage.objects;
create policy "match members read chat media" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and public.in_match((storage.foldername(name))[1]));
drop policy if exists "match members upload chat media" on storage.objects;
create policy "match members upload chat media" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media' and public.in_match((storage.foldername(name))[1]));
drop policy if exists "uploader deletes chat media" on storage.objects;
create policy "uploader deletes chat media" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and owner = auth.uid());

-- ---------------------------------------------------------------------------
-- Voice and video calls (between matches only)
-- ---------------------------------------------------------------------------
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches on delete cascade,
  caller_id uuid not null references public.profiles on delete cascade,
  callee_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'accepted', 'declined', 'missed', 'ended', 'cancelled')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);
create index if not exists calls_callee on public.calls (callee_id, status);
alter table public.calls enable row level security;
drop policy if exists "call members read" on public.calls;
create policy "call members read" on public.calls for select
  using (caller_id = auth.uid() or callee_id = auth.uid());

-- Start ringing your match. Returns the call id.
create or replace function public.start_call(p_match uuid, p_kind text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m matches;
  cid uuid;
begin
  if p_kind not in ('audio', 'video') then raise exception 'Invalid call type'; end if;
  select * into m from matches where id = p_match and (user_a = uid or user_b = uid);
  if not found then raise exception 'You can only call your matches'; end if;
  -- Tidy up calls that were left ringing
  update calls set status = 'missed', ended_at = now()
  where match_id = p_match and status = 'ringing' and created_at < now() - interval '60 seconds';
  insert into calls (match_id, caller_id, callee_id, kind)
  values (p_match, uid, case when m.user_a = uid then m.user_b else m.user_a end, p_kind)
  returning id into cid;
  return cid;
end $$;

-- Move a call along: accept, decline, cancel (caller gives up), end, or missed.
create or replace function public.update_call(p_call uuid, p_status text) returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c calls;
  secs int;
begin
  select * into c from calls where id = p_call and (caller_id = uid or callee_id = uid) for update;
  if not found then raise exception 'Call not found'; end if;
  if c.status not in ('ringing', 'accepted') then return c.status; end if;

  if p_status = 'accepted' and c.status = 'ringing' and uid = c.callee_id then
    update calls set status = 'accepted', answered_at = now() where id = c.id;
    return 'accepted';
  end if;

  if p_status in ('declined', 'cancelled', 'missed') and c.status = 'ringing' then
    update calls set status = p_status, ended_at = now() where id = c.id;
  elsif p_status = 'ended' then
    update calls set status = case when c.status = 'ringing' then 'cancelled' else 'ended' end, ended_at = now()
    where id = c.id;
  else
    return c.status;
  end if;

  -- Leave a record in the chat
  select * into c from calls where id = p_call;
  secs := case when c.answered_at is not null then extract(epoch from (c.ended_at - c.answered_at))::int else 0 end;
  insert into messages (match_id, sender_id, kind, body, media_meta)
  values (c.match_id, c.caller_id, 'call', c.status, jsonb_build_object('call', c.kind, 'seconds', secs));
  return c.status;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.calls;
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- Keys (in-app currency), Paystack payments, gifts, +2 minutes,
-- and the daily free Masquerade allowance
-- ===========================================================================

create table if not exists public.wallets (
  user_id uuid primary key references public.profiles on delete cascade,
  balance int not null default 0 check (balance >= 0),
  passes int not null default 0 check (passes >= 0), -- prepaid extra masquerades
  updated_at timestamptz not null default now()
);

create table if not exists public.key_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  amount int not null,          -- + added, - spent
  reason text not null,         -- purchase, gift, extend, extra_masquerade, refund
  ref text,
  created_at timestamptz not null default now()
);
create index if not exists key_transactions_user on public.key_transactions (user_id, id desc);

create table if not exists public.payments (
  reference text primary key,
  user_id uuid references public.profiles on delete set null,
  pack_id text not null,
  keys int not null,
  amount_kobo int not null,
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.wallets enable row level security;
alter table public.key_transactions enable row level security;
alter table public.payments enable row level security;
drop policy if exists "read own wallet" on public.wallets;
create policy "read own wallet" on public.wallets for select using (user_id = auth.uid());
drop policy if exists "read own key history" on public.key_transactions;
create policy "read own key history" on public.key_transactions for select using (user_id = auth.uid());
drop policy if exists "read own payments" on public.payments;
create policy "read own payments" on public.payments for select using (user_id = auth.uid());

create or replace function public.add_keys(uid uuid, amount int, reason text, ref text default null) returns int
language plpgsql security definer set search_path = public as $$
declare bal int;
begin
  insert into wallets (user_id, balance) values (uid, amount)
  on conflict (user_id) do update set balance = wallets.balance + excluded.balance, updated_at = now()
  returning balance into bal;
  insert into key_transactions (user_id, amount, reason, ref) values (uid, amount, reason, ref);
  return bal;
end $$;

create or replace function public.spend_keys(uid uuid, amount int, reason text, ref text default null) returns int
language plpgsql security definer set search_path = public as $$
declare bal int;
begin
  update wallets set balance = balance - amount, updated_at = now()
  where user_id = uid and balance >= amount
  returning balance into bal;
  if not found then raise exception 'NOT_ENOUGH_KEYS'; end if;
  insert into key_transactions (user_id, amount, reason, ref) values (uid, -amount, reason, ref);
  return bal;
end $$;

-- Called by the server only, after Paystack confirms the payment. Safe to call twice.
create or replace function public.complete_payment(p_reference text, p_amount_kobo int) returns text
language plpgsql security definer set search_path = public as $$
declare p payments;
begin
  select * into p from payments where reference = p_reference for update;
  if not found then return 'unknown'; end if;
  if p.status = 'paid' then return 'already_paid'; end if;
  if p_amount_kobo < p.amount_kobo then
    update payments set status = 'failed' where reference = p_reference;
    return 'amount_mismatch';
  end if;
  update payments set status = 'paid', paid_at = now() where reference = p_reference;
  perform public.add_keys(p.user_id, p.keys, 'purchase', p_reference);
  return 'paid';
end $$;

revoke execute on function public.add_keys(uuid, int, text, text) from public, anon, authenticated;
revoke execute on function public.spend_keys(uuid, int, text, text) from public, anon, authenticated;
revoke execute on function public.complete_payment(text, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Daily allowance: 5 free masquerades every 24 hours, then 5 Keys each
-- ---------------------------------------------------------------------------
alter table public.masquerade_sessions add column if not exists paid_a boolean not null default false;
alter table public.masquerade_sessions add column if not exists paid_b boolean not null default false;
alter table public.masquerade_sessions add column if not exists extensions int not null default 0;
alter table public.masquerade_queue add column if not exists paid boolean not null default false;

create or replace function public.free_used(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from masquerade_sessions
  where started_at > now() - interval '24 hours'
    and ((user_a = uid and not paid_a) or (user_b = uid and not paid_b))
$$;

-- Uses a free slot if there is one, otherwise a prepaid pass. Returns true if a pass was used.
create or replace function public.take_masquerade_slot(uid uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.free_used(uid) < 5 then return false; end if;
  update wallets set passes = passes - 1, updated_at = now() where user_id = uid and passes > 0;
  if found then return true; end if;
  raise exception 'NEEDS_KEYS';
end $$;
revoke execute on function public.take_masquerade_slot(uuid) from public, anon, authenticated;

create or replace function public.queue_allowance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Re-joining the waiting list doesn't cost anything extra
  if exists (select 1 from masquerade_queue where user_id = new.user_id) then return new; end if;
  new.paid := public.take_masquerade_slot(new.user_id);
  return new;
end $$;
drop trigger if exists masquerade_queue_allowance on public.masquerade_queue;
create trigger masquerade_queue_allowance before insert on public.masquerade_queue
  for each row execute function public.queue_allowance();

-- Spend 5 Keys for one more masquerade today
create or replace function public.buy_masquerade_pass() returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int;
begin
  perform public.spend_keys(uid, 5, 'extra_masquerade');
  update wallets set passes = passes + 1 where user_id = uid returning passes into n;
  return n;
end $$;

-- Leaving the waiting list gives a paid pass back for next time
create or replace function public.cancel_masquerade() returns void
language plpgsql security definer set search_path = public as $$
declare was_paid boolean;
begin
  delete from masquerade_queue where user_id = auth.uid() returning paid into was_paid;
  if was_paid then update wallets set passes = passes + 1 where user_id = auth.uid(); end if;
  update masquerade_invites set status = 'expired' where from_user = auth.uid() and status = 'pending';
end $$;

create or replace function public.create_masquerade_session(
  a uuid, b uuid, p_intent public.intent, s_a smallint, s_b smallint
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
  lvl smallint := round((s_a + s_b) / 2.0)::smallint; -- questions follow the average of both picks
  alias_a text := public.random_alias();
  first_q text;
  pa boolean := coalesce((select paid from masquerade_queue where user_id = a), false);
  pb boolean := coalesce((select paid from masquerade_queue where user_id = b), false);
begin
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, ends_at, paid_a, paid_b)
  values (a, b, p_intent, s_a, s_b, lvl, alias_a, public.random_alias(alias_a), now() + interval '5 minutes', pa, pb)
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
revoke execute on function public.create_masquerade_session(uuid, uuid, public.intent, smallint, smallint) from public, anon, authenticated;

drop function if exists public.accept_masquerade_invite(uuid);
create or replace function public.accept_masquerade_invite(p_invite uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  inv masquerade_invites;
  sender masquerade_queue;
  me profiles;
  sid uuid;
  paid boolean;
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

  paid := public.take_masquerade_slot(uid); -- may ask for Keys
  select * into me from profiles where id = uid;
  sid := public.create_masquerade_session(inv.from_user, uid, sender.intent, sender.spice, me.pref_spice);
  update masquerade_sessions set paid_b = paid where id = sid;
  update masquerade_invites set status = 'accepted', session_id = sid where id = p_invite;
  return sid;
end $$;

-- ---------------------------------------------------------------------------
-- Gifts and +2 minutes
-- ---------------------------------------------------------------------------
create table if not exists public.gifts (
  id text primary key,
  name text not null,
  emoji text not null,
  price int not null check (price > 0),
  sort int not null default 0
);
alter table public.gifts enable row level security;
drop policy if exists "anyone reads gifts" on public.gifts;
create policy "anyone reads gifts" on public.gifts for select using (true);
insert into public.gifts (id, name, emoji, price, sort) values
  ('rose', 'Rose', '🌹', 5, 1),
  ('coffee', 'Coffee date', '☕', 10, 2),
  ('chocolate', 'Chocolate', '🍫', 15, 3),
  ('cocktail', 'Cocktail', '🍸', 20, 4),
  ('teddy', 'Teddy bear', '🧸', 30, 5),
  ('bouquet', 'Bouquet', '💐', 40, 6),
  ('crown', 'Crown', '👑', 60, 7),
  ('diamond', 'Diamond', '💎', 100, 8)
on conflict (id) do update set name = excluded.name, emoji = excluded.emoji, price = excluded.price, sort = excluded.sort;

alter table public.masquerade_messages drop constraint if exists masquerade_messages_kind_check;
alter table public.masquerade_messages add constraint masquerade_messages_kind_check check (kind in ('text', 'icebreaker', 'gift', 'system'));

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'image', 'video', 'audio', 'call', 'gift'));
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check check (
  char_length(body) <= 2000 and (
    (kind = 'text' and (char_length(body) >= 1 or deleted_at is not null))
    or (kind in ('image', 'video', 'audio') and (media_path is not null or deleted_at is not null))
    or kind in ('call', 'gift')
  )
);

-- Send a gift in a masked chat (p_session) or to a match (p_match)
create or replace function public.send_gift(p_gift text, p_match uuid default null, p_session uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g gifts;
  bal int;
begin
  select * into g from gifts where id = p_gift;
  if not found then raise exception 'Unknown gift'; end if;
  if p_match is not null then
    if not exists (select 1 from matches where id = p_match and (user_a = uid or user_b = uid)) then raise exception 'Not your match'; end if;
    bal := public.spend_keys(uid, g.price, 'gift', g.id);
    insert into messages (match_id, sender_id, kind, body, media_meta)
    values (p_match, uid, 'gift', g.id, jsonb_build_object('gift', g.id));
  elsif p_session is not null then
    if not exists (select 1 from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid)
                   and status = 'active' and now() < ends_at) then
      raise exception 'This chat has ended';
    end if;
    bal := public.spend_keys(uid, g.price, 'gift', g.id);
    insert into masquerade_messages (session_id, sender_id, kind, body) values (p_session, uid, 'gift', g.id);
  else
    raise exception 'Choose who to send it to';
  end if;
  return bal;
end $$;

-- Add 2 minutes to a masked chat for 10 Keys (up to 3 times)
create or replace function public.extend_masquerade(p_session uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid) for update;
  if not found or s.status <> 'active' or now() >= s.ends_at then raise exception 'This chat has ended'; end if;
  if s.extensions >= 3 then raise exception 'MAX_EXTENSIONS'; end if;
  perform public.spend_keys(uid, 10, 'extend', p_session::text);
  update masquerade_sessions set ends_at = ends_at + interval '2 minutes', extensions = extensions + 1
  where id = p_session returning * into s;
  insert into masquerade_messages (session_id, sender_id, kind, body)
  values (p_session, uid, 'system', (case when s.user_a = uid then s.alias_a else s.alias_b end) || ' added 2 more minutes');
  return s.ends_at;
end $$;

-- When a masked chat becomes a match, keep the conversation (and the gifts)
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

    insert into messages (match_id, sender_id, kind, body, media_meta, created_at)
    select mid, sender_id,
      case when kind = 'gift' then 'gift' else 'text' end,
      case when kind = 'icebreaker' then '💬 ' || body else body end,
      case when kind = 'gift' then jsonb_build_object('gift', body) else null end,
      created_at
    from masquerade_messages where session_id = s.id and kind <> 'system' order by id;

    update masquerade_sessions set status = 'matched', match_id = mid where id = s.id;
    delete from masquerade_messages where session_id = s.id;
  elsif s.unmask_a is false or s.unmask_b is false
        or now() > s.ends_at + interval '90 seconds' then
    update masquerade_sessions set status = 'ended',
      ended_reason = coalesce(ended_reason, case when now() > s.ends_at + interval '90 seconds'
        and (s.unmask_a is null or s.unmask_b is null) then 'timeout' else 'declined' end)
    where id = s.id;
    delete from masquerade_messages where session_id = s.id;
  end if;
end $$;
revoke execute on function public.finalize_masquerade(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Home screen numbers
-- ---------------------------------------------------------------------------
create or replace function public.my_wallet() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'balance', coalesce((select balance from wallets where user_id = auth.uid()), 0),
    'passes', coalesce((select passes from wallets where user_id = auth.uid()), 0),
    'free_left', greatest(0, 5 - public.free_used(auth.uid())),
    'next_free_at', (
      select min(started_at) + interval '24 hours' from masquerade_sessions
      where started_at > now() - interval '24 hours'
        and ((user_a = auth.uid() and not paid_a) or (user_b = auth.uid() and not paid_b))
    )
  )
$$;

create or replace function public.home_stats() returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  loc accounts_private;
begin
  select * into me from profiles where id = uid;
  select * into loc from accounts_private where user_id = uid;
  return json_build_object(
    'online', (
      select count(*) from profiles p
      left join accounts_private a on a.user_id = p.id
      where p.id <> uid
        and p.last_seen_at > now() - interval '10 minutes'
        and (p.open_to_masquerade or exists (select 1 from masquerade_queue q where q.user_id = p.id))
        and public.within_km(public.distance_km(loc.lat, loc.lng, a.lat, a.lng), case when loc.lat is null then null else me.pref_max_km end)
    ),
    'week_chats', (
      select count(*) from masquerade_sessions
      where (user_a = uid or user_b = uid) and started_at > now() - interval '7 days'
    ),
    'week_unmasks', (
      select count(*) from masquerade_sessions
      where status = 'matched' and (user_a = uid or user_b = uid) and started_at > now() - interval '7 days'
    ),
    'gifts_received', (
      select count(*) from messages m join matches x on x.id = m.match_id
      where m.kind = 'gift' and m.sender_id <> uid and (x.user_a = uid or x.user_b = uid)
    )
  );
end $$;

do $$ begin
  alter publication supabase_realtime add table public.wallets;
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- Masquerade Nights (events) and icebreaker management
-- ===========================================================================

-- Icebreakers can be switched off, and can belong to a specific night
alter table public.icebreakers add column if not exists active boolean not null default true;
alter table public.icebreakers add column if not exists event_id uuid;
alter table public.icebreakers add column if not exists created_at timestamptz not null default now();

create table if not exists public.masquerade_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  description text not null default '',
  theme text not null default 'violet' check (theme in ('violet', 'rose', 'gold', 'midnight', 'mint')),
  intent public.intent not null default 'dating',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  age_min int not null default 18 check (age_min >= 18),
  age_max int not null default 99,
  entry_keys int not null default 0 check (entry_keys >= 0),
  max_attendees int,
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists masquerade_events_time on public.masquerade_events (status, starts_at);

do $$ begin
  alter table public.icebreakers add constraint icebreakers_event_fk
    foreign key (event_id) references public.masquerade_events on delete cascade;
exception when duplicate_object then null; end $$;

create table if not exists public.event_attendees (
  event_id uuid not null references public.masquerade_events on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  keys_paid int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.masquerade_queue add column if not exists event_id uuid references public.masquerade_events on delete cascade;
alter table public.masquerade_sessions add column if not exists event_id uuid references public.masquerade_events on delete set null;

alter table public.masquerade_events enable row level security;
alter table public.event_attendees enable row level security;
drop policy if exists "read published events" on public.masquerade_events;
create policy "read published events" on public.masquerade_events for select
  using (status in ('published', 'cancelled') and auth.role() = 'authenticated');
drop policy if exists "read own attendance" on public.event_attendees;
create policy "read own attendance" on public.event_attendees for select using (user_id = auth.uid());

-- Event rounds don't use up the 5 free daily masquerades
create or replace function public.free_used(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from masquerade_sessions
  where started_at > now() - interval '24 hours' and event_id is null
    and ((user_a = uid and not paid_a) or (user_b = uid and not paid_b))
$$;

create or replace function public.queue_allowance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.event_id is not null then new.paid := false; return new; end if;
  if exists (select 1 from masquerade_queue where user_id = new.user_id) then return new; end if;
  new.paid := public.take_masquerade_slot(new.user_id);
  return new;
end $$;

-- Picks a question: the night's own questions first, otherwise by spice level
create or replace function public.pick_icebreaker(p_session uuid, p_spice smallint, p_event uuid) returns text
language sql volatile security definer set search_path = public as $$
  select body from (
    select body, 0 as pri from icebreakers i
    where p_event is not null and i.event_id = p_event and i.active
      and not exists (select 1 from masquerade_messages m where m.session_id = p_session and m.kind = 'icebreaker' and m.body = i.body)
    union all
    select body, 1 from icebreakers i
    where i.event_id is null and i.active and i.spice = p_spice
      and not exists (select 1 from masquerade_messages m where m.session_id = p_session and m.kind = 'icebreaker' and m.body = i.body)
    union all
    select body, 2 from icebreakers i where i.event_id is null and i.active and i.spice = p_spice
  ) x order by pri, random() limit 1
$$;
revoke execute on function public.pick_icebreaker(uuid, smallint, uuid) from public, anon, authenticated;

create or replace function public.create_masquerade_session(
  a uuid, b uuid, p_intent public.intent, s_a smallint, s_b smallint
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
  lvl smallint := round((s_a + s_b) / 2.0)::smallint;
  alias_a text := public.random_alias();
  first_q text;
  pa boolean := coalesce((select paid from masquerade_queue where user_id = a), false);
  pb boolean := coalesce((select paid from masquerade_queue where user_id = b), false);
  ev uuid := (select event_id from masquerade_queue where user_id = a);
begin
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, ends_at, paid_a, paid_b, event_id)
  values (a, b, p_intent, s_a, s_b, lvl, alias_a, public.random_alias(alias_a), now() + interval '5 minutes', pa, pb, ev)
  returning id into sid;

  first_q := public.pick_icebreaker(sid, lvl, ev);
  if first_q is not null then
    insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', first_q);
  end if;

  delete from masquerade_queue where user_id in (a, b);
  update masquerade_invites set status = 'expired'
    where status = 'pending' and (from_user in (a, b) or to_user in (a, b));
  return sid;
end $$;
revoke execute on function public.create_masquerade_session(uuid, uuid, public.intent, smallint, smallint) from public, anon, authenticated;

create or replace function public.next_icebreaker(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s masquerade_sessions;
  q text;
begin
  select * into s from masquerade_sessions
  where id = p_session and (user_a = auth.uid() or user_b = auth.uid()) and status = 'active' and ends_at > now();
  if not found then return; end if;
  q := public.pick_icebreaker(s.id, s.spice_level, s.event_id);
  if q is not null then
    insert into masquerade_messages (session_id, kind, body) values (s.id, 'icebreaker', q);
  end if;
end $$;

-- Matching now keeps event rounds inside their event, and never pairs the same two people twice in one night
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
  if me_q.event_id is not null and not exists (
    select 1 from masquerade_events e where e.id = me_q.event_id and now() < e.ends_at and e.status = 'published'
  ) then
    delete from masquerade_queue where user_id = uid;
    return null;
  end if;
  select * into me_p from profiles where id = uid;

  select q.* into cand
  from masquerade_queue q
  join profiles p on p.id = q.user_id
  where q.user_id <> uid
    and q.event_id is not distinct from me_q.event_id
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
    and (me_q.event_id is null or not exists (
      select 1 from masquerade_sessions s where s.event_id = me_q.event_id
        and ((s.user_a = uid and s.user_b = q.user_id) or (s.user_b = uid and s.user_a = q.user_id))
    ))
  order by floor(public.distance_km(me_q.lat, me_q.lng, q.lat, q.lng) / 10) nulls last,
    public.shared_count(p.interests, me_p.interests) desc,
    q.created_at
  limit 1;

  if not found then return null; end if;
  return public.create_masquerade_session(cand.user_id, uid, me_q.intent, cand.spice, me_q.spice);
end $$;
revoke execute on function public.try_masquerade_match(uuid) from public, anon, authenticated;

-- Everything an event card or lobby needs
create or replace function public.event_json(e masquerade_events, uid uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', e.id, 'title', e.title, 'description', e.description, 'theme', e.theme, 'intent', e.intent,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'age_min', e.age_min, 'age_max', e.age_max,
    'entry_keys', e.entry_keys, 'max_attendees', e.max_attendees, 'status', e.status,
    'going_count', (select count(*) from event_attendees a where a.event_id = e.id),
    'i_am_going', exists (select 1 from event_attendees a where a.event_id = e.id and a.user_id = uid),
    'my_rounds', (select count(*) from masquerade_sessions s where s.event_id = e.id and (s.user_a = uid or s.user_b = uid)),
    'my_unmasks', (select count(*) from masquerade_sessions s where s.event_id = e.id and s.status = 'matched' and (s.user_a = uid or s.user_b = uid)),
    'server_now', now()
  )
$$;
revoke execute on function public.event_json(masquerade_events, uuid) from public, anon, authenticated;

create or replace function public.list_events() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(public.event_json(e, auth.uid()) order by e.starts_at), '[]'::json)
  from masquerade_events e
  where e.status = 'published' and e.ends_at > now() - interval '2 days'
$$;

create or replace function public.get_event(p_event uuid) returns json
language sql stable security definer set search_path = public as $$
  select public.event_json(e, auth.uid()) from masquerade_events e
  where e.id = p_event and e.status in ('published', 'cancelled')
$$;

create or replace function public.rsvp_event(p_event uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e masquerade_events;
  me profiles;
  age int;
begin
  select * into e from masquerade_events where id = p_event for update;
  if not found or e.status <> 'published' then raise exception 'This night is not available'; end if;
  if now() >= e.ends_at then raise exception 'This night has ended'; end if;
  if exists (select 1 from event_attendees where event_id = p_event and user_id = uid) then
    return public.event_json(e, uid);
  end if;
  select * into me from profiles where id = uid;
  age := public.age_years(me.birthdate);
  if age is null or age < e.age_min or age > e.age_max then
    raise exception 'This night is for ages %–%', e.age_min, e.age_max;
  end if;
  if e.max_attendees is not null and (select count(*) from event_attendees where event_id = p_event) >= e.max_attendees then
    raise exception 'EVENT_FULL';
  end if;
  if e.entry_keys > 0 then perform public.spend_keys(uid, e.entry_keys, 'event', p_event::text); end if;
  insert into event_attendees (event_id, user_id, keys_paid) values (p_event, uid, e.entry_keys);
  return public.event_json(e, uid);
end $$;

-- Change your mind before it starts: Keys come back
create or replace function public.cancel_rsvp(p_event uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e masquerade_events;
  paid int;
begin
  select * into e from masquerade_events where id = p_event;
  if not found then raise exception 'Not found'; end if;
  if now() >= e.starts_at then raise exception 'This night has already started'; end if;
  delete from event_attendees where event_id = p_event and user_id = uid returning keys_paid into paid;
  if paid > 0 then perform public.add_keys(uid, paid, 'refund', p_event::text); end if;
  return public.event_json(e, uid);
end $$;

-- During the night: get paired for the next round
create or replace function public.join_event_round(p_event uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e masquerade_events;
  me profiles;
  sid uuid;
begin
  select * into e from masquerade_events where id = p_event;
  if not found or e.status <> 'published' then raise exception 'This night is not available'; end if;
  if e.kind is distinct from 'masquerade' then raise exception 'This event has no masked rounds'; end if;
  if now() < e.starts_at then raise exception 'This night has not started yet'; end if;
  if now() >= e.ends_at - interval '1 minute' then raise exception 'This night has ended'; end if;
  if not exists (select 1 from event_attendees where event_id = p_event and user_id = uid) then
    raise exception 'Tap I am going first';
  end if;
  sid := public.my_active_session(uid);
  if sid is not null then return sid; end if;

  select * into me from profiles where id = uid;
  update profiles set last_seen_at = now() where id = uid;
  delete from masquerade_queue where user_id = uid and event_id is distinct from p_event;
  insert into masquerade_queue (user_id, intent, seeking, age_min, age_max, spice, event_id)
  values (uid, e.intent, me.pref_seeking, e.age_min, e.age_max, me.pref_spice, p_event)
  on conflict (user_id) do update set last_ping_at = now();

  return public.try_masquerade_match(uid);
end $$;

-- Where a finished chat came from (to offer "next round")
create or replace function public.session_event(p_session uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select event_id from masquerade_sessions where id = p_session and (user_a = auth.uid() or user_b = auth.uid())
$$;

create or replace function public.next_event() returns json
language sql stable security definer set search_path = public as $$
  select public.event_json(e, auth.uid()) from masquerade_events e
  where e.status = 'published' and e.ends_at > now()
  order by e.starts_at limit 1
$$;

-- ---------------------------------------------------------------------------
-- Lots more icebreakers
-- ---------------------------------------------------------------------------
insert into public.icebreakers (spice, body)
select v.spice, v.body from (values
  (0, 'What’s a skill you’d love to learn this year?'),
  (0, 'What’s the best meal you’ve ever had?'),
  (0, 'Beach holiday or city break?'),
  (0, 'What’s a movie you could watch over and over?'),
  (0, 'What always cheers you up on a bad day?'),
  (0, 'What’s your go-to karaoke song?'),
  (0, 'Tea, coffee or something else to start the day?'),
  (0, 'What’s the most spontaneous thing you’ve ever done?'),
  (0, 'If you could have dinner with anyone, who would it be?'),
  (0, 'What’s a hobby you picked up recently?'),
  (0, 'Which app on your phone do you use the most?'),
  (0, 'What’s a place that feels like home to you?'),
  (0, 'What would your dream job be if money didn’t matter?'),
  (0, 'Sweet or savoury snacks?'),
  (0, 'What’s the last thing that made you laugh out loud?'),
  (0, 'Are you a planner or do you go with the flow?'),
  (0, 'What’s your favourite season and why?'),
  (0, 'What’s a small win you had recently?'),
  (0, 'What’s the best concert or show you’ve been to?'),
  (0, 'If you won the lottery tomorrow, what’s the first thing you’d do?'),
  (1, 'What’s your love language?'),
  (1, 'What’s the cheesiest pickup line that would actually work on you?'),
  (1, 'What makes someone instantly more attractive to you?'),
  (1, 'What’s your biggest dating ick?'),
  (1, 'Have you ever been on a truly terrible date? Tell me everything.'),
  (1, 'Texting all day or calling at night?'),
  (1, 'What’s a song that makes you feel a little flirty?'),
  (1, 'Would you rather be swept off your feet or do the sweeping?'),
  (1, 'What’s something people get wrong about you at first?'),
  (1, 'Dinner date or adventure date?'),
  (1, 'What’s the sweetest thing someone has done for you?'),
  (1, 'Who usually makes the first move — you or them?'),
  (1, 'How do you flirt without saying a word?'),
  (1, 'What’s a quality you just can’t resist in someone?'),
  (1, 'Have you ever sent the first DM to a crush? How did it go?'),
  (1, 'What would make you say yes to a second date straight away?'),
  (1, 'What’s a cute habit you secretly love in a partner?'),
  (1, 'What’s the most romantic city you’ve been to?'),
  (1, 'What’s your idea of a perfect lazy day with someone?'),
  (1, 'What’s your most attractive habit?'),
  (2, 'What’s the most flirtatious thing you’ve ever said to someone?'),
  (2, 'Where’s the best place for a first kiss?'),
  (2, 'What’s something small that drives you wild?'),
  (2, 'What’s your idea of a perfect date night in?'),
  (2, 'Do you like to take the lead or be led?'),
  (2, 'What’s the boldest compliment you’ve ever received?'),
  (2, 'Have you ever had chemistry with someone you really shouldn’t have?'),
  (2, 'Slow dance in the kitchen or a night out dancing?'),
  (2, 'What’s a romantic gesture that would win you over instantly?'),
  (2, 'What’s a look that says "come closer" to you?'),
  (2, 'What would make tonight unforgettable?'),
  (2, 'Morning kisses or goodnight kisses?'),
  (2, 'Describe your flirting style in three words.'),
  (2, 'What’s a secret crush you never acted on?'),
  (2, 'What’s the most daring thing you’ve done for love?'),
  (2, 'Candlelight or city lights?'),
  (2, 'What’s something you’ve always wanted someone to say to you?'),
  (2, 'What’s the longest you’ve flirted with someone before making a move?'),
  (2, 'Holding hands or an arm around the waist?'),
  (2, 'What’s the most attractive thing someone can do on a first date?'),
  (3, 'What’s your most adventurous date idea?'),
  (3, 'What’s the boldest thing you’d do on a first date?'),
  (3, 'What’s a guilty pleasure you’d never post online?'),
  (3, 'What’s a compliment that would make you blush?'),
  (3, 'Describe your perfect night in — no details spared.'),
  (3, 'What’s one rule you love to break?'),
  (3, 'What’s the cheekiest text you’ve ever sent?'),
  (3, 'What’s something you’d only try with the right person?'),
  (3, 'What’s the most mischievous thing you’ve ever done?'),
  (3, 'What’s your secret flirting weapon?'),
  (3, 'What’s the riskiest place you’ve flirted with someone?'),
  (3, 'What would you whisper to someone you really like?'),
  (3, 'What’s your favourite way to tease someone?'),
  (3, 'If tonight had no rules, what would you do?'),
  (3, 'What’s the wildest dare you’ve ever accepted?'),
  (3, 'What’s your weakness when someone flirts with you?'),
  (3, 'What’s a fantasy date you’ve never told anyone about?'),
  (3, 'What’s the most irresistible thing someone can wear?'),
  (3, 'What’s the most spontaneous thing you’d do for someone you fancy?'),
  (3, 'What instantly makes you want to kiss someone?')
) v(spice, body)
where not exists (select 1 from public.icebreakers i where replace(i.body, '''', '’') = v.body);

-- ---------------------------------------------------------------------------
-- Admin helpers (only the server can call these)
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'users', (select count(*) from profiles where display_name is not null),
    'new_users_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'online_now', (select count(*) from profiles where last_seen_at > now() - interval '5 minutes'),
    'masquerades_today', (select count(*) from masquerade_sessions where started_at > now() - interval '24 hours'),
    'unmasks_today', (select count(*) from masquerade_sessions where status = 'matched' and started_at > now() - interval '24 hours'),
    'matches_total', (select count(*) from matches),
    'revenue_30d_kobo', (select coalesce(sum(amount_kobo), 0) from payments where status = 'paid' and paid_at > now() - interval '30 days'),
    'keys_sold_30d', (select coalesce(sum(keys), 0) from payments where status = 'paid' and paid_at > now() - interval '30 days'),
    'gifts_7d', (select count(*) from key_transactions where reason = 'gift' and created_at > now() - interval '7 days'),
    'reports_7d', (select count(*) from reports where created_at > now() - interval '7 days'),
    'icebreakers', (select count(*) from icebreakers where event_id is null and active)
  )
$$;

create or replace function public.admin_events() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.starts_at desc), '[]'::json) from (
    select e.*,
      (select count(*) from event_attendees a where a.event_id = e.id) as going_count,
      (select count(*) from masquerade_sessions s where s.event_id = e.id) as rounds,
      (select count(*) from masquerade_sessions s where s.event_id = e.id and s.status = 'matched') as unmasks,
      (select coalesce(sum(keys_paid), 0) from event_attendees a where a.event_id = e.id) as keys_collected,
      (select count(*) from icebreakers i where i.event_id = e.id) as question_count
    from masquerade_events e
  ) t
$$;

-- Cancel a night and give everyone their Keys back
create or replace function public.admin_cancel_event(p_event uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  update masquerade_events set status = 'cancelled' where id = p_event;
  for r in select user_id, keys_paid from event_attendees where event_id = p_event and keys_paid > 0 loop
    perform public.add_keys(r.user_id, r.keys_paid, 'refund', p_event::text);
    update event_attendees set keys_paid = 0 where event_id = p_event and user_id = r.user_id;
    n := n + 1;
  end loop;
  delete from masquerade_queue where event_id = p_event;
  return n;
end $$;

revoke execute on function public.admin_overview() from public, anon, authenticated;
revoke execute on function public.admin_events() from public, anon, authenticated;
revoke execute on function public.admin_cancel_event(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Password reset links (sent by Dashpad through Resend)
-- ---------------------------------------------------------------------------
create table if not exists public.password_resets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_resets_user on public.password_resets (user_id, created_at desc);
-- Locked: no policies, so only the server (service role) can read or write it
alter table public.password_resets enable row level security;

-- ===========================================================================
-- Kinds of events: Masquerade Night (we pair you), Spotlight Night and
-- Listening Party (you pick who to talk to from a wall of featured photos).
-- Room chat, hype, music and video, photo reveals, chats until the end.
-- ===========================================================================
alter table public.masquerade_events add column if not exists kind text not null default 'masquerade';
do $$ begin
  alter table public.masquerade_events add constraint masquerade_events_kind_ok check (kind in ('masquerade', 'spotlight', 'party'));
exception when duplicate_object then null; end $$;
alter table public.masquerade_events add column if not exists cover_url text;
alter table public.masquerade_events add column if not exists stream_url text;
-- room_chat, slow_mode (seconds), hype, max_chats, free_reveals, reveal_cost, media_under_chats, reminders
alter table public.masquerade_events add column if not exists settings jsonb not null default '{}'::jsonb;

-- One setting with a fallback
create or replace function public.event_int(e public.masquerade_events, k text, d int) returns int
language sql immutable as $$ select coalesce((e.settings ->> k)::int, d) $$;
create or replace function public.event_bool(e public.masquerade_events, k text, d boolean) returns boolean
language sql immutable as $$ select coalesce((e.settings ->> k)::boolean, d) $$;

-- Featured photo for "you choose" events, plus a tiny blurred copy shown until revealed
alter table public.event_attendees add column if not exists featured_photo text;
alter table public.event_attendees add column if not exists featured_blur text;
-- Guests stay masked at events: a random alias instead of their name until they match
alter table public.event_attendees add column if not exists alias text;

-- Music and video for an event, played in order from the start time
create table if not exists public.event_media (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.masquerade_events on delete cascade,
  kind text not null check (kind in ('audio', 'video')),
  title text not null default '' check (char_length(title) <= 120),
  url text not null,
  duration_sec int not null default 0 check (duration_sec >= 0),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists event_media_event on public.event_media (event_id, position);
alter table public.event_media enable row level security;
drop policy if exists "see event media" on public.event_media;
create policy "see event media" on public.event_media for select using (
  exists (select 1 from public.masquerade_events e where e.id = event_id and e.status = 'published'));

-- The room: everyone at the event, plus hype and announcements from Dashpad
create table if not exists public.event_room_messages (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.masquerade_events on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'hype', 'announce', 'moment')),
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists event_room_messages_event on public.event_room_messages (event_id, id desc);
alter table public.event_room_messages enable row level security;
drop policy if exists "attendees read the room" on public.event_room_messages;
create policy "attendees read the room" on public.event_room_messages for select using (
  exists (select 1 from public.event_attendees a where a.event_id = event_room_messages.event_id and a.user_id = auth.uid()));

-- Who has revealed whose photo (free ones first, then Keys)
create table if not exists public.event_reveals (
  event_id uuid not null references public.masquerade_events on delete cascade,
  viewer uuid not null references public.profiles on delete cascade,
  target uuid not null references public.profiles on delete cascade,
  paid int not null default 0,
  created_at timestamptz not null default now(),
  primary key (event_id, viewer, target)
);
alter table public.event_reveals enable row level security;
drop policy if exists "see own reveals" on public.event_reveals;
create policy "see own reveals" on public.event_reveals for select using (viewer = auth.uid());

-- Private chats started from the wall. They last until the event ends;
-- then both choose to keep (it becomes a match) or let go (it’s deleted).
create table if not exists public.event_chats (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.masquerade_events on delete cascade,
  user_a uuid not null references public.profiles on delete cascade,
  user_b uuid not null references public.profiles on delete cascade,
  opened_by uuid not null references public.profiles on delete cascade,
  keep_a boolean,
  keep_b boolean,
  status text not null default 'open' check (status in ('open', 'matched', 'closed')),
  match_id uuid references public.matches on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (event_id, user_a, user_b)
);
create index if not exists event_chats_a on public.event_chats (user_a, event_id);
create index if not exists event_chats_b on public.event_chats (user_b, event_id);
alter table public.event_chats enable row level security;
drop policy if exists "see own event chats" on public.event_chats;
create policy "see own event chats" on public.event_chats for select using (auth.uid() in (user_a, user_b));

create table if not exists public.event_chat_messages (
  id bigint generated always as identity primary key,
  chat_id uuid not null references public.event_chats on delete cascade,
  sender_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists event_chat_messages_chat on public.event_chat_messages (chat_id, id);
alter table public.event_chat_messages enable row level security;
drop policy if exists "see own event chat messages" on public.event_chat_messages;
create policy "see own event chat messages" on public.event_chat_messages for select using (
  exists (select 1 from public.event_chats c where c.id = chat_id and auth.uid() in (c.user_a, c.user_b)));
drop policy if exists "send in open event chats" on public.event_chat_messages;
create policy "send in open event chats" on public.event_chat_messages for insert with check (
  sender_id = auth.uid() and exists (
    select 1 from public.event_chats c join public.masquerade_events e on e.id = c.event_id
    where c.id = chat_id and auth.uid() in (c.user_a, c.user_b) and c.status = 'open' and now() < e.ends_at));

create or replace function public.bump_event_chat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update event_chats set last_message_at = new.created_at where id = new.chat_id;
  return new;
end $$;
drop trigger if exists event_chat_bump on public.event_chat_messages;
create trigger event_chat_bump after insert on public.event_chat_messages
  for each row execute function public.bump_event_chat();

-- Reminder emails already sent (so each goes out once)
create table if not exists public.event_reminders (
  event_id uuid not null references public.masquerade_events on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (event_id, kind)
);
alter table public.event_reminders enable row level security;

do $$
declare t text;
begin
  foreach t in array array['event_room_messages','event_chats','event_chat_messages'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Event details, now with its kind, cover, music and your featured photo
create or replace function public.event_json(e masquerade_events, uid uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', e.id, 'title', e.title, 'description', e.description, 'theme', e.theme, 'intent', e.intent,
    'kind', e.kind, 'cover_url', e.cover_url, 'stream_url', e.stream_url, 'settings', e.settings,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'age_min', e.age_min, 'age_max', e.age_max,
    'entry_keys', e.entry_keys, 'max_attendees', e.max_attendees, 'status', e.status,
    'going_count', (select count(*) from event_attendees a where a.event_id = e.id),
    'i_am_going', exists (select 1 from event_attendees a where a.event_id = e.id and a.user_id = uid),
    'my_photo', (select a.featured_photo from event_attendees a where a.event_id = e.id and a.user_id = uid),
    'my_rounds', (select count(*) from masquerade_sessions s where s.event_id = e.id and (s.user_a = uid or s.user_b = uid)),
    'my_unmasks', (select count(*) from masquerade_sessions s where s.event_id = e.id and s.status = 'matched' and (s.user_a = uid or s.user_b = uid)),
    'my_chats', (select count(*) from event_chats c where c.event_id = e.id and uid in (c.user_a, c.user_b)),
    'reveals_used', (select count(*) from event_reveals r where r.event_id = e.id and r.viewer = uid),
    'media', coalesce((select json_agg(json_build_object('id', m.id, 'kind', m.kind, 'title', m.title, 'url', m.url,
                 'duration_sec', m.duration_sec) order by m.position, m.id) from event_media m where m.event_id = e.id), '[]'::json),
    'server_now', now()
  )
$$;
revoke execute on function public.event_json(masquerade_events, uuid) from public, anon, authenticated;

-- Pick which of your photos is featured on the wall
create or replace function public.set_featured_photo(p_event uuid, p_photo text, p_blur text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not exists (select 1 from profiles where id = uid and p_photo = any(photos)) then
    raise exception 'Choose one of your own photos';
  end if;
  if p_blur is not null and (p_blur not like 'data:image/%' or char_length(p_blur) > 8000) then p_blur := null; end if;
  update event_attendees set featured_photo = p_photo, featured_blur = p_blur
  where event_id = p_event and user_id = uid;
  if not found then raise exception 'Say you’re going first'; end if;
end $$;

-- Clear out chats nobody kept, an hour after an event ends
create or replace function public.tidy_event_chats(p_event uuid) returns void
language sql security definer set search_path = public as $$
  delete from event_chats c using masquerade_events e
  where c.event_id = p_event and e.id = c.event_id and c.status <> 'matched' and now() > e.ends_at + interval '1 hour'
$$;
revoke execute on function public.tidy_event_chats(uuid) from public, anon, authenticated;

-- The wall: everyone else at a live "you choose" event who fits what you’re looking for (both ways)
create or replace function public.event_wall(p_event uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e masquerade_events;
  me profiles;
begin
  select * into e from masquerade_events where id = p_event;
  if not found or e.kind = 'masquerade' then raise exception 'Not available'; end if;
  if not exists (select 1 from event_attendees where event_id = p_event and user_id = uid) then raise exception 'Say you’re going first'; end if;
  if now() < e.starts_at then return '[]'::json; end if;
  select * into me from profiles where id = uid;
  return coalesce((
    select json_agg(row_to_json(t) order by t.shared desc, t.sort_key) from (
      select p.id as user_id, coalesce(a.alias, 'Masked guest') as name,
        public.age_years(p.birthdate) as age, p.gender, a.featured_blur as blur,
        case when r.target is not null then a.featured_photo end as photo,
        (r.target is not null) as revealed,
        public.shared_count(p.interests, me.interests) as shared,
        p.interests,
        (select c.id from event_chats c where c.event_id = p_event and c.user_a = least(uid, p.id) and c.user_b = greatest(uid, p.id)) as chat_id,
        md5(p.id::text || p_event::text) as sort_key
      from event_attendees a
      join profiles p on p.id = a.user_id
      left join event_reveals r on r.event_id = p_event and r.viewer = uid and r.target = p.id
      where a.event_id = p_event and a.user_id <> uid
        and public.gender_fits(me.pref_seeking, p.gender) and public.gender_fits(p.pref_seeking, me.gender)
        and not public.is_blocked(uid, p.id)
    ) t
  ), '[]'::json);
end $$;

-- Tap to reveal a featured photo: free at first, then Keys
create or replace function public.reveal_photo(p_event uuid, p_target uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e masquerade_events;
  used int;
  cost int := 0;
  photo text;
begin
  select * into e from masquerade_events where id = p_event;
  if not found then raise exception 'Not found'; end if;
  if not exists (select 1 from event_attendees where event_id = p_event and user_id = uid) then raise exception 'Say you’re going first'; end if;
  select featured_photo into photo from event_attendees where event_id = p_event and user_id = p_target;
  if photo is null then raise exception 'No photo to show'; end if;
  if not exists (select 1 from event_reveals where event_id = p_event and viewer = uid and target = p_target) then
    select count(*) into used from event_reveals where event_id = p_event and viewer = uid;
    if used >= public.event_int(e, 'free_reveals', 10) then
      cost := public.event_int(e, 'reveal_cost', 1);
      if cost > 0 then perform public.spend_keys(uid, cost, 'reveal', p_event::text); end if;
    end if;
    insert into event_reveals (event_id, viewer, target, paid) values (p_event, uid, p_target, cost);
  end if;
  select count(*) into used from event_reveals where event_id = p_event and viewer = uid;
  return json_build_object('photo', photo, 'paid', cost,
    'free_left', greatest(0, public.event_int(e, 'free_reveals', 10) - used),
    'balance', (select balance from wallets where user_id = uid));
end $$;

-- Say hi from the wall: opens (or reopens) a private chat for the rest of the event
create or replace function public.start_event_chat(p_event uuid, p_target uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e masquerade_events;
  cid uuid;
  me profiles;
  them profiles;
begin
  select * into e from masquerade_events where id = p_event;
  if not found or e.kind = 'masquerade' or e.status <> 'published' then raise exception 'Not available'; end if;
  if now() < e.starts_at then raise exception 'The event hasn’t started yet'; end if;
  if now() >= e.ends_at then raise exception 'This event has ended'; end if;
  if uid = p_target then raise exception 'That’s you'; end if;
  if not exists (select 1 from event_attendees where event_id = p_event and user_id = uid)
     or not exists (select 1 from event_attendees where event_id = p_event and user_id = p_target) then
    raise exception 'They’re not at this event';
  end if;
  if public.is_blocked(uid, p_target) then raise exception 'Not available'; end if;
  select * into me from profiles where id = uid;
  select * into them from profiles where id = p_target;
  if not (public.gender_fits(me.pref_seeking, them.gender) and public.gender_fits(them.pref_seeking, me.gender)) then
    raise exception 'Not available';
  end if;
  select id into cid from event_chats where event_id = p_event and user_a = least(uid, p_target) and user_b = greatest(uid, p_target);
  if cid is not null then return cid; end if;
  if (select count(*) from event_chats where event_id = p_event and opened_by = uid and status = 'open')
     >= public.event_int(e, 'max_chats', 5) then
    raise exception 'MAX_CHATS';
  end if;
  insert into event_chats (event_id, user_a, user_b, opened_by)
  values (p_event, least(uid, p_target), greatest(uid, p_target), uid)
  returning id into cid;
  return cid;
end $$;

-- Your chats at an event
create or replace function public.my_event_chats(p_event uuid) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  perform public.tidy_event_chats(p_event);
  return coalesce((
    select json_agg(row_to_json(t) order by t.last_message_at desc) from (
      select c.id, c.status, c.created_at, c.last_message_at, c.opened_by,
        case when c.user_a = uid then c.keep_a else c.keep_b end as my_keep,
        p.id as other_id, coalesce(a.alias, 'Masked guest') as name, public.age_years(p.birthdate) as age, p.gender,
        a.featured_blur as blur,
        case when exists (select 1 from event_reveals r where r.event_id = c.event_id and r.viewer = uid and r.target = p.id)
             then a.featured_photo end as photo,
        (select body from event_chat_messages m where m.chat_id = c.id order by m.id desc limit 1) as last_message,
        (select sender_id from event_chat_messages m where m.chat_id = c.id order by m.id desc limit 1) as last_sender
      from event_chats c
      join profiles p on p.id = case when c.user_a = uid then c.user_b else c.user_a end
      left join event_attendees a on a.event_id = c.event_id and a.user_id = p.id
      where c.event_id = p_event and uid in (c.user_a, c.user_b)
    ) t
  ), '[]'::json);
end $$;

-- One chat with its messages
create or replace function public.get_event_chat(p_chat uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c event_chats;
  e masquerade_events;
  other uuid;
begin
  select * into c from event_chats where id = p_chat and uid in (user_a, user_b);
  if not found then return null; end if;
  select * into e from masquerade_events where id = c.event_id;
  other := case when c.user_a = uid then c.user_b else c.user_a end;
  return json_build_object(
    'id', c.id, 'event_id', c.event_id, 'status', c.status, 'match_id', c.match_id,
    'my_keep', case when c.user_a = uid then c.keep_a else c.keep_b end,
    'their_keep_set', case when c.user_a = uid then c.keep_b is not null else c.keep_a is not null end,
    'event', public.event_json(e, uid),
    'other', (select json_build_object('id', p.id, 'name', coalesce(a.alias, 'Masked guest'),
                'age', public.age_years(p.birthdate), 'gender', p.gender, 'interests', p.interests,
                'blur', a.featured_blur,
                'photo', case when exists (select 1 from event_reveals r where r.event_id = c.event_id and r.viewer = uid and r.target = p.id)
                              then a.featured_photo end)
              from profiles p left join event_attendees a on a.event_id = c.event_id and a.user_id = p.id where p.id = other),
    'messages', coalesce((select json_agg(json_build_object('id', m.id, 'sender_id', m.sender_id, 'body', m.body, 'created_at', m.created_at) order by m.id)
                 from (select * from event_chat_messages where chat_id = c.id order by id desc limit 300) m), '[]'::json)
  );
end $$;

-- Keep or let go. Both keep -> it’s a match and the chat moves to Chats.
create or replace function public.vote_event_chat(p_chat uuid, p_keep boolean) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c event_chats;
  e masquerade_events;
  mid uuid;
begin
  select * into c from event_chats where id = p_chat and uid in (user_a, user_b) for update;
  if not found then raise exception 'Not found'; end if;
  if c.status <> 'open' then return json_build_object('status', c.status, 'match_id', c.match_id); end if;
  select * into e from masquerade_events where id = c.event_id;
  if now() > e.ends_at + interval '1 hour' then raise exception 'Too late to decide'; end if;
  if c.user_a = uid then update event_chats set keep_a = p_keep where id = c.id returning * into c;
  else update event_chats set keep_b = p_keep where id = c.id returning * into c; end if;

  if c.keep_a is false or c.keep_b is false then
    -- Someone let go: the chat is deleted
    delete from event_chats where id = c.id;
    return json_build_object('status', 'closed');
  end if;
  if c.keep_a is true and c.keep_b is true then
    insert into matches (user_a, user_b, intent)
    values (c.user_a, c.user_b, e.intent)
    on conflict (user_a, user_b) do update set last_message_at = now()
    returning id into mid;
    insert into messages (match_id, sender_id, kind, body, created_at)
    select mid, sender_id, 'text', body, created_at from event_chat_messages where chat_id = c.id order by id;
    update event_chats set status = 'matched', match_id = mid where id = c.id;
    delete from event_chat_messages where chat_id = c.id;
    return json_build_object('status', 'matched', 'match_id', mid);
  end if;
  return json_build_object('status', 'open', 'waiting', true);
end $$;

-- Say something in the room (or send a hype reaction)
create or replace function public.post_room_message(p_event uuid, p_body text, p_kind text default 'text') returns bigint
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e masquerade_events;
  wait int;
  nid bigint;
begin
  select * into e from masquerade_events where id = p_event;
  if not found or e.status <> 'published' then raise exception 'Not available'; end if;
  if now() < e.starts_at or now() >= e.ends_at then raise exception 'The room is closed'; end if;
  if not exists (select 1 from event_attendees where event_id = p_event and user_id = uid) then raise exception 'Say you’re going first'; end if;
  p_body := btrim(coalesce(p_body, ''));
  if p_kind = 'hype' then
    if not public.event_bool(e, 'hype', true) then raise exception 'Hype is off for this event'; end if;
    if p_body not in ('🔥', '😍', '😂', '👏', '💃', '🎉', '💜', '🙌') then raise exception 'Not a hype reaction'; end if;
    if exists (select 1 from event_room_messages where event_id = p_event and user_id = uid and kind = 'hype'
               and created_at > now() - interval '2 seconds') then
      raise exception 'SLOW_DOWN';
    end if;
  elsif p_kind = 'text' then
    if not public.event_bool(e, 'room_chat', true) then raise exception 'The room chat is off for this event'; end if;
    if char_length(p_body) < 1 or char_length(p_body) > 300 then raise exception 'Messages are 1–300 characters'; end if;
    wait := public.event_int(e, 'slow_mode', 0);
    if wait > 0 and exists (select 1 from event_room_messages where event_id = p_event and user_id = uid and kind = 'text'
                            and created_at > now() - make_interval(secs => wait)) then
      raise exception 'SLOW_MODE';
    end if;
  else
    raise exception 'Not allowed';
  end if;
  insert into event_room_messages (event_id, user_id, kind, body) values (p_event, uid, p_kind, p_body) returning id into nid;
  return nid;
end $$;

-- The room’s recent messages with first names (no photos)
create or replace function public.room_messages(p_event uuid) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.id), '[]'::json) from (
    select m.id, m.user_id, m.kind, m.body, m.created_at, coalesce(a.alias, '') as name
    from event_room_messages m left join event_attendees a on a.event_id = m.event_id and a.user_id = m.user_id
    where m.event_id = p_event
      and exists (select 1 from event_attendees a where a.event_id = p_event and a.user_id = auth.uid())
    order by m.id desc limit 150
  ) t
$$;

-- Featured photo defaults to your main photo when you say you’re going
create or replace function public.default_featured_photo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.featured_photo is null then
    select photos[1] into new.featured_photo from profiles where id = new.user_id;
  end if;
  if new.alias is null then
    -- A fresh alias, different from others at the same event where possible
    for i in 1..8 loop
      new.alias := public.random_alias();
      exit when not exists (select 1 from event_attendees x where x.event_id = new.event_id and x.alias = new.alias);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists event_attendee_photo on public.event_attendees;
create trigger event_attendee_photo before insert on public.event_attendees
  for each row execute function public.default_featured_photo();
update public.event_attendees set alias = public.random_alias() where alias is null;

-- Covers, music and video uploaded by admin (public to play)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-media', 'event-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/ogg','audio/webm','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Event chats in the Chats tab: unread dots and a shortcut back to the event
-- ---------------------------------------------------------------------------
alter table public.event_chats add column if not exists a_read_at timestamptz;
alter table public.event_chats add column if not exists b_read_at timestamptz;

create or replace function public.event_chat_unread(c public.event_chats, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from event_chat_messages x
    where x.chat_id = c.id and x.sender_id <> uid
      and x.created_at > coalesce(case when c.user_a = uid then c.a_read_at else c.b_read_at end, '-infinity'::timestamptz)
  )
$$;

create or replace function public.mark_event_chat_read(p_chat uuid) returns void
language sql security definer set search_path = public as $$
  update event_chats set
    a_read_at = case when user_a = auth.uid() then now() else a_read_at end,
    b_read_at = case when user_b = auth.uid() then now() else b_read_at end
  where id = p_chat and auth.uid() in (user_a, user_b)
$$;

-- Your open chats at events that are on now (or just ended and waiting for keep / let go)
create or replace function public.my_live_event_chats() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.unread desc, t.last_message_at desc), '[]'::json) from (
    select c.id, c.event_id, e.title as event_title, e.ends_at, c.last_message_at,
      p.id as other_id, coalesce(a.alias, 'Masked guest') as name, public.age_years(p.birthdate) as age, p.gender,
      a.featured_blur as blur,
      case when exists (select 1 from event_reveals r where r.event_id = c.event_id and r.viewer = auth.uid() and r.target = p.id)
           then a.featured_photo end as photo,
      (select body from event_chat_messages m where m.chat_id = c.id order by m.id desc limit 1) as last_message,
      public.event_chat_unread(c, auth.uid()) as unread
    from event_chats c
    join masquerade_events e on e.id = c.event_id
    join profiles p on p.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
    left join event_attendees a on a.event_id = c.event_id and a.user_id = p.id
    where auth.uid() in (c.user_a, c.user_b) and c.status = 'open' and now() < e.ends_at + interval '1 hour'
  ) t
$$;

create or replace function public.unread_event_chats() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from event_chats c join masquerade_events e on e.id = c.event_id
  where auth.uid() in (c.user_a, c.user_b) and c.status = 'open' and now() < e.ends_at + interval '1 hour'
    and public.event_chat_unread(c, auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Admin: members list and member details (only the server can call these)
-- ---------------------------------------------------------------------------
alter table public.accounts_private add column if not exists banned_at timestamptz;
alter table public.accounts_private add column if not exists ban_reason text;

-- filter: all | online | new | reported | banned | incomplete
create or replace function public.admin_members(p_q text default '', p_filter text default 'all', p_limit int default 30, p_offset int default 0)
returns json language sql stable security definer set search_path = public as $$
  with base as (
    select p.id, p.display_name, p.photos, p.gender, public.age_years(p.birthdate) as age, p.created_at, p.last_seen_at,
      a.email, a.banned_at,
      coalesce(w.balance, 0) as balance,
      (select count(*) from reports r where r.reported_id = p.id) as reports,
      (select count(*) from matches m where p.id in (m.user_a, m.user_b)) as matches,
      (p.display_name is not null and p.birthdate is not null and p.gender is not null and cardinality(p.photos) > 0) as onboarded
    from profiles p
    left join accounts_private a on a.user_id = p.id
    left join wallets w on w.user_id = p.id
    where (coalesce(p_q, '') = '' or p.display_name ilike '%' || p_q || '%' or a.email ilike '%' || p_q || '%')
  ), filtered as (
    select * from base where case coalesce(p_filter, 'all')
      when 'online' then last_seen_at > now() - interval '5 minutes'
      when 'new' then created_at > now() - interval '7 days'
      when 'reported' then reports > 0
      when 'banned' then banned_at is not null
      when 'incomplete' then not onboarded
      else true end
  )
  select json_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((select json_agg(row_to_json(t)) from (
      select id, display_name, photos[1] as photo, gender, age, created_at, last_seen_at, email, banned_at, balance, reports, matches, onboarded
      from filtered
      order by case when p_filter = 'reported' then reports else 0 end desc, created_at desc
      limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
    ) t), '[]'::json)
  )
$$;

create or replace function public.admin_member(p_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'profile', (select row_to_json(p) from profiles p where p.id = p_id),
    'age', (select public.age_years(birthdate) from profiles where id = p_id),
    'email', (select email from accounts_private where user_id = p_id),
    'terms_accepted_at', (select terms_accepted_at from accounts_private where user_id = p_id),
    'banned_at', (select banned_at from accounts_private where user_id = p_id),
    'ban_reason', (select ban_reason from accounts_private where user_id = p_id),
    'wallet', (select row_to_json(w) from wallets w where w.user_id = p_id),
    'matches', (select count(*) from matches m where p_id in (m.user_a, m.user_b)),
    'masquerades', (select count(*) from masquerade_sessions s where p_id in (s.user_a, s.user_b)),
    'events', (select count(*) from event_attendees e where e.user_id = p_id),
    'reports_against', coalesce((select json_agg(json_build_object('id', r.id, 'reason', r.reason, 'created_at', r.created_at,
        'reporter_id', r.reporter_id, 'reporter_name', rp.display_name) order by r.id desc)
      from reports r left join profiles rp on rp.id = r.reporter_id where r.reported_id = p_id), '[]'::json),
    'reports_made', (select count(*) from reports r where r.reporter_id = p_id),
    'transactions', coalesce((select json_agg(t order by t.id desc) from (
        select id, amount, reason, ref, created_at from key_transactions where user_id = p_id order by id desc limit 30) t), '[]'::json),
    'paid_naira', (select coalesce(sum(amount_kobo), 0) / 100 from payments where user_id = p_id and status = 'paid')
  )
$$;

revoke execute on function public.admin_members(text, text, int, int) from public, anon, authenticated;
revoke execute on function public.admin_member(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Push notifications: each phone or browser that said yes to notifications
-- (only the server reads or writes this)
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

-- ---------------------------------------------------------------------------
-- The Feed: one Daily Prompt for everyone. People answer masked, react for free,
-- send gifts (the person learns who sent it), or pay Keys to start a masked chat
-- with whoever wrote an answer. Feed chats last 24 hours; then both choose to keep
-- (it becomes a match) or let go.
-- ---------------------------------------------------------------------------

-- Today in Nigeria (prompts change at midnight Lagos time)
create or replace function public.feed_today() returns date
language sql stable as $$ select (now() at time zone 'Africa/Lagos')::date $$;

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 3 and 300),
  day date not null unique,
  chat_cost int not null default 5 check (chat_cost between 0 and 1000),
  created_at timestamptz not null default now()
);
alter table public.prompts enable row level security;
-- When the morning notification for this prompt went out (so it only goes once)
alter table public.prompts add column if not exists pushed_at timestamptz;

create table if not exists public.prompt_answers (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  alias text not null,
  body text not null check (char_length(body) between 1 and 500),
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  unique (prompt_id, user_id)
);
create index if not exists prompt_answers_prompt on public.prompt_answers (prompt_id, created_at desc);
create index if not exists prompt_answers_user on public.prompt_answers (user_id);
alter table public.prompt_answers enable row level security;

create table if not exists public.prompt_reactions (
  answer_id uuid not null references public.prompt_answers on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  emoji text not null check (emoji in ('fire', 'laugh', 'hundred', 'eyes', 'wow')),
  created_at timestamptz not null default now(),
  primary key (answer_id, user_id)
);
alter table public.prompt_reactions enable row level security;

create table if not exists public.prompt_gifts (
  id bigint generated always as identity primary key,
  answer_id uuid references public.prompt_answers on delete set null,
  from_user uuid not null references public.profiles on delete cascade,
  to_user uuid not null references public.profiles on delete cascade,
  gift_id text not null references public.gifts,
  answer_body text,
  prompt_body text,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists prompt_gifts_to on public.prompt_gifts (to_user, created_at desc);
create index if not exists prompt_gifts_answer on public.prompt_gifts (answer_id);
alter table public.prompt_gifts enable row level security;

-- Reporting an answer also blocks its writer for you (reports power is_blocked)
alter table public.reports add column if not exists answer_id uuid references public.prompt_answers on delete set null;

-- Chats started from the feed. alias_a / alias_b: the name each person goes by in
-- this chat (empty = their real name and photo show, e.g. someone who sent a gift).
create table if not exists public.feed_chats (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid references public.prompt_answers on delete set null,
  user_a uuid not null references public.profiles on delete cascade,
  user_b uuid not null references public.profiles on delete cascade,
  opened_by uuid not null references public.profiles on delete cascade,
  alias_a text,
  alias_b text,
  prompt_body text,
  answer_body text,
  keep_a boolean,
  keep_b boolean,
  status text not null default 'open' check (status in ('open', 'matched')),
  match_id uuid references public.matches on delete set null,
  paid int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  last_message_at timestamptz not null default now(),
  a_read_at timestamptz,
  b_read_at timestamptz,
  check (user_a < user_b)
);
create unique index if not exists feed_chats_pair_open on public.feed_chats (user_a, user_b) where status = 'open';
create index if not exists feed_chats_a on public.feed_chats (user_a);
create index if not exists feed_chats_b on public.feed_chats (user_b);
create index if not exists feed_chats_opened on public.feed_chats (opened_by, created_at);
alter table public.feed_chats enable row level security;
drop policy if exists "see own feed chats" on public.feed_chats;
create policy "see own feed chats" on public.feed_chats for select using (auth.uid() in (user_a, user_b));

create table if not exists public.feed_chat_messages (
  id bigint generated always as identity primary key,
  chat_id uuid not null references public.feed_chats on delete cascade,
  sender_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists feed_chat_messages_chat on public.feed_chat_messages (chat_id, id);
alter table public.feed_chat_messages enable row level security;
drop policy if exists "see own feed chat messages" on public.feed_chat_messages;
create policy "see own feed chat messages" on public.feed_chat_messages for select using (
  exists (select 1 from public.feed_chats c where c.id = chat_id and auth.uid() in (c.user_a, c.user_b)));
drop policy if exists "send in open feed chats" on public.feed_chat_messages;
create policy "send in open feed chats" on public.feed_chat_messages for insert with check (
  sender_id = auth.uid() and exists (
    select 1 from public.feed_chats c
    where c.id = chat_id and auth.uid() in (c.user_a, c.user_b) and c.status = 'open' and now() < c.expires_at));

create or replace function public.bump_feed_chat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update feed_chats set last_message_at = new.created_at where id = new.chat_id;
  return new;
end $$;
drop trigger if exists feed_chat_bump on public.feed_chat_messages;
create trigger feed_chat_bump after insert on public.feed_chat_messages
  for each row execute function public.bump_feed_chat();

do $$
declare t text;
begin
  foreach t in array array['feed_chats','feed_chat_messages'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Can these two chat? (both fit what the other is looking for, no block, not matched yet)
create or replace function public.feed_can_chat(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a <> b
    and not public.is_blocked(a, b)
    and exists (select 1 from profiles pa, profiles pb
                where pa.id = a and pb.id = b
                  and pa.gender is not null and pb.gender is not null
                  and public.gender_fits(pa.pref_seeking, pb.gender)
                  and public.gender_fits(pb.pref_seeking, pa.gender))
$$;

-- Chats nobody decided on within a day of closing are removed
create or replace function public.tidy_feed_chats() returns void
language sql security definer set search_path = public as $$
  delete from feed_chats where status = 'open' and now() > expires_at + interval '24 hours'
$$;

-- Everything the Feed page needs: the prompt, your answer, everyone else (once you answered)
create or replace function public.get_feed(p_sort text default 'new', p_limit int default 30, p_offset int default 0) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pr prompts;
  mine prompt_answers;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into pr from prompts where day = public.feed_today();
  if not found then
    return json_build_object('prompt', null, 'gifts_unseen',
      (select count(*) from prompt_gifts where to_user = uid and seen_at is null));
  end if;
  select * into mine from prompt_answers where prompt_id = pr.id and user_id = uid;

  return json_build_object(
    'prompt', json_build_object('id', pr.id, 'body', pr.body, 'day', pr.day, 'chat_cost', pr.chat_cost,
      'answers', (select count(*) from prompt_answers where prompt_id = pr.id and hidden_at is null)),
    'gifts_unseen', (select count(*) from prompt_gifts where to_user = uid and seen_at is null),
    'my_answer', case when mine.id is null then null else json_build_object(
      'id', mine.id, 'alias', mine.alias, 'body', mine.body, 'created_at', mine.created_at, 'hidden', mine.hidden_at is not null,
      'reactions', (select count(*) from prompt_reactions r where r.answer_id = mine.id),
      'gifts', (select count(*) from prompt_gifts g where g.answer_id = mine.id),
      'chats', (select count(*) from feed_chats c where c.answer_id = mine.id)) end,
    'answers', case when mine.id is null then '[]'::json else coalesce((
      select json_agg(row_to_json(t)) from (
        select a.id, a.alias, a.body, a.created_at, public.age_years(p.birthdate) as age, p.gender,
          (a.user_id = uid) as mine,
          (select coalesce(json_object_agg(x.emoji, x.n), '{}'::json) from (
             select emoji, count(*) as n from prompt_reactions r where r.answer_id = a.id group by emoji) x) as reactions,
          (select emoji from prompt_reactions r where r.answer_id = a.id and r.user_id = uid) as my_reaction,
          (select count(*) from prompt_gifts g where g.answer_id = a.id) as gifts,
          (select c.id from feed_chats c where c.status = 'open'
             and c.user_a = least(uid, a.user_id) and c.user_b = greatest(uid, a.user_id)) as chat_id,
          (a.user_id <> uid and public.feed_can_chat(uid, a.user_id) and not public.already_matched(uid, a.user_id)) as can_chat,
          public.already_matched(uid, a.user_id) as matched
        from prompt_answers a
        join profiles p on p.id = a.user_id
        where a.prompt_id = pr.id and a.hidden_at is null
          and not public.is_blocked(uid, a.user_id)
        order by
          (a.user_id = uid) desc,
          case when p_sort = 'top' then
            (select count(*) from prompt_reactions r where r.answer_id = a.id)
            + 3 * (select count(*) from prompt_gifts g where g.answer_id = a.id) end desc nulls last,
          a.created_at desc
        limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset)
      ) t), '[]'::json) end
  );
end $$;

-- Answer today’s prompt (or change your answer)
create or replace function public.answer_prompt(p_prompt uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pr prompts;
  aid uuid;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into pr from prompts where id = p_prompt;
  if not found or pr.day <> public.feed_today() then raise exception 'This prompt has closed'; end if;
  p_body := btrim(p_body);
  if char_length(p_body) < 1 then raise exception 'Write something first'; end if;
  if char_length(p_body) > 500 then raise exception 'Keep it under 500 characters'; end if;
  insert into prompt_answers (prompt_id, user_id, alias, body)
  values (p_prompt, uid, public.random_alias(), p_body)
  on conflict (prompt_id, user_id) do update set body = excluded.body
  returning id into aid;
  update profiles set last_seen_at = now() where id = uid;
  return aid;
end $$;

create or replace function public.delete_my_answer(p_answer uuid) returns void
language sql security definer set search_path = public as $$
  delete from prompt_answers where id = p_answer and user_id = auth.uid()
$$;

-- React for free. Empty emoji takes your reaction back.
create or replace function public.react_answer(p_answer uuid, p_emoji text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please log in'; end if;
  if p_emoji is null or char_length(p_emoji) = 0 then
    delete from prompt_reactions where answer_id = p_answer and user_id = uid;
    return;
  end if;
  if not exists (select 1 from prompt_answers a join prompts p on p.id = a.prompt_id
                 where a.id = p_answer and a.hidden_at is null and a.user_id <> uid) then
    raise exception 'Not available';
  end if;
  insert into prompt_reactions (answer_id, user_id, emoji) values (p_answer, uid, p_emoji)
  on conflict (answer_id, user_id) do update set emoji = excluded.emoji, created_at = now();
end $$;

-- Send a gift to whoever wrote an answer. They see who sent it.
create or replace function public.gift_answer(p_answer uuid, p_gift text) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a prompt_answers;
  g gifts;
  bal int;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into a from prompt_answers where id = p_answer and hidden_at is null;
  if not found then raise exception 'Not available'; end if;
  if a.user_id = uid then raise exception 'That’s your own answer'; end if;
  if public.is_blocked(uid, a.user_id) then raise exception 'Not available'; end if;
  select * into g from gifts where id = p_gift;
  if not found then raise exception 'Unknown gift'; end if;
  bal := public.spend_keys(uid, g.price, 'feed_gift', g.id);
  insert into prompt_gifts (answer_id, from_user, to_user, gift_id, answer_body, prompt_body)
  values (a.id, uid, a.user_id, g.id, a.body, (select body from prompts where id = a.prompt_id));
  return bal;
end $$;

-- Gifts you received on your answers (newest first), with who sent them
create or replace function public.my_feed_gifts() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json) from (
    select g.id, g.gift_id, g.created_at, g.seen_at, g.answer_body, g.prompt_body,
      p.id as from_id, p.display_name as from_name, p.photos[1] as from_photo,
      public.age_years(p.birthdate) as from_age, p.gender as from_gender,
      (select c.id from feed_chats c where c.status = 'open'
         and c.user_a = least(auth.uid(), p.id) and c.user_b = greatest(auth.uid(), p.id)) as chat_id,
      (public.feed_can_chat(auth.uid(), p.id) and not public.already_matched(auth.uid(), p.id)) as can_chat,
      (select m.id from matches m where m.user_a = least(auth.uid(), p.id) and m.user_b = greatest(auth.uid(), p.id)) as match_id
    from prompt_gifts g
    join profiles p on p.id = g.from_user
    where g.to_user = auth.uid() and g.created_at > now() - interval '30 days'
      and not public.is_blocked(auth.uid(), p.id)
    order by g.created_at desc
    limit 50
  ) t
$$;

create or replace function public.mark_feed_gifts_seen() returns void
language sql security definer set search_path = public as $$
  update prompt_gifts set seen_at = now() where to_user = auth.uid() and seen_at is null
$$;

-- Pay Keys (the price is set per prompt) to start a masked chat with whoever wrote an answer
create or replace function public.start_feed_chat(p_answer uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a prompt_answers;
  pr prompts;
  cid uuid;
  my_alias text;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into a from prompt_answers where id = p_answer and hidden_at is null;
  if not found then raise exception 'Not available'; end if;
  if a.user_id = uid then raise exception 'That’s your own answer'; end if;
  select * into pr from prompts where id = a.prompt_id;
  if public.already_matched(uid, a.user_id) then raise exception 'ALREADY_MATCHED'; end if;
  if not public.feed_can_chat(uid, a.user_id) then raise exception 'Not available'; end if;
  select id into cid from feed_chats
  where status = 'open' and user_a = least(uid, a.user_id) and user_b = greatest(uid, a.user_id);
  if cid is not null then return cid; end if;
  if (select count(*) from feed_chats where opened_by = uid and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'TOO_MANY_CHATS';
  end if;
  if pr.chat_cost > 0 then
    perform public.spend_keys(uid, pr.chat_cost, 'feed_chat', a.id::text);
  end if;
  my_alias := public.random_alias(a.alias);
  insert into feed_chats (answer_id, user_a, user_b, opened_by, alias_a, alias_b, prompt_body, answer_body, paid)
  values (a.id, least(uid, a.user_id), greatest(uid, a.user_id), uid,
    case when uid < a.user_id then my_alias else a.alias end,
    case when uid < a.user_id then a.alias else my_alias end,
    pr.body, a.body, pr.chat_cost)
  returning id into cid;
  return cid;
end $$;

-- Got a gift? Chat back for free. You stay masked; they show as themselves (they chose to gift).
create or replace function public.chat_back_gift(p_gift bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g prompt_gifts;
  my_alias text;
  cid uuid;
begin
  select * into g from prompt_gifts where id = p_gift and to_user = uid;
  if not found then raise exception 'Not available'; end if;
  if public.already_matched(uid, g.from_user) then raise exception 'ALREADY_MATCHED'; end if;
  if not public.feed_can_chat(uid, g.from_user) then raise exception 'Not available'; end if;
  select id into cid from feed_chats
  where status = 'open' and user_a = least(uid, g.from_user) and user_b = greatest(uid, g.from_user);
  if cid is not null then return cid; end if;
  my_alias := coalesce((select alias from prompt_answers where id = g.answer_id), public.random_alias());
  insert into feed_chats (answer_id, user_a, user_b, opened_by, alias_a, alias_b, prompt_body, answer_body)
  values (g.answer_id, least(uid, g.from_user), greatest(uid, g.from_user), uid,
    case when uid < g.from_user then my_alias else null end,
    case when uid < g.from_user then null else my_alias end,
    g.prompt_body, g.answer_body)
  returning id into cid;
  update prompt_gifts set seen_at = coalesce(seen_at, now()) where id = g.id;
  return cid;
end $$;

-- How a person shows in a feed chat: their alias (masked) or, with no alias, their real name and photo
create or replace function public.feed_person(c feed_chats, who uuid, viewer uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', p.id,
    'name', coalesce(case when who = c.user_a then c.alias_a else c.alias_b end, p.display_name),
    'masked', (case when who = c.user_a then c.alias_a else c.alias_b end) is not null,
    'photo', case when (case when who = c.user_a then c.alias_a else c.alias_b end) is null then p.photos[1] end,
    'age', public.age_years(p.birthdate), 'gender', p.gender,
    'interests', case when who <> viewer then p.interests end)
  from profiles p where p.id = who
$$;

create or replace function public.get_feed_chat(p_chat uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c feed_chats;
  other uuid;
begin
  select * into c from feed_chats where id = p_chat and uid in (user_a, user_b);
  if not found then return null; end if;
  other := case when c.user_a = uid then c.user_b else c.user_a end;
  return json_build_object(
    'id', c.id, 'status', c.status, 'match_id', c.match_id, 'opened_by', c.opened_by,
    'created_at', c.created_at, 'expires_at', c.expires_at, 'decide_by', c.expires_at + interval '24 hours',
    'prompt_body', c.prompt_body, 'answer_body', c.answer_body,
    'answer_mine', exists (select 1 from prompt_answers a where a.id = c.answer_id and a.user_id = uid),
    'my_keep', case when c.user_a = uid then c.keep_a else c.keep_b end,
    'their_keep_set', case when c.user_a = uid then c.keep_b is not null else c.keep_a is not null end,
    'me', public.feed_person(c, uid, uid),
    'other', public.feed_person(c, other, uid),
    'messages', coalesce((select json_agg(json_build_object('id', m.id, 'sender_id', m.sender_id, 'body', m.body, 'created_at', m.created_at) order by m.id)
                 from (select * from feed_chat_messages where chat_id = c.id order by id desc limit 300) m), '[]'::json)
  );
end $$;

-- Keep or let go. Both keep: it is a match and the chat moves to Chats.
create or replace function public.vote_feed_chat(p_chat uuid, p_keep boolean) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c feed_chats;
  mid uuid;
begin
  select * into c from feed_chats where id = p_chat and uid in (user_a, user_b) for update;
  if not found then raise exception 'Not found'; end if;
  if c.status <> 'open' then return json_build_object('status', c.status, 'match_id', c.match_id); end if;
  if now() > c.expires_at + interval '24 hours' then raise exception 'Too late to decide'; end if;
  if c.user_a = uid then update feed_chats set keep_a = p_keep where id = c.id returning * into c;
  else update feed_chats set keep_b = p_keep where id = c.id returning * into c; end if;

  if c.keep_a is false or c.keep_b is false then
    delete from feed_chats where id = c.id;
    return json_build_object('status', 'closed');
  end if;
  if c.keep_a is true and c.keep_b is true then
    insert into matches (user_a, user_b)
    values (c.user_a, c.user_b)
    on conflict (user_a, user_b) do update set last_message_at = now()
    returning id into mid;
    insert into messages (match_id, sender_id, kind, body, created_at)
    select mid, sender_id, 'text', body, created_at from feed_chat_messages where chat_id = c.id order by id;
    update feed_chats set status = 'matched', match_id = mid where id = c.id;
    delete from feed_chat_messages where chat_id = c.id;
    return json_build_object('status', 'matched', 'match_id', mid);
  end if;
  return json_build_object('status', 'open', 'waiting', true);
end $$;

create or replace function public.feed_chat_unread(c public.feed_chats, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from feed_chat_messages x
    where x.chat_id = c.id and x.sender_id <> uid
      and x.created_at > coalesce(case when c.user_a = uid then c.a_read_at else c.b_read_at end, '-infinity'::timestamptz)
  )
$$;

create or replace function public.mark_feed_chat_read(p_chat uuid) returns void
language sql security definer set search_path = public as $$
  update feed_chats set
    a_read_at = case when user_a = auth.uid() then now() else a_read_at end,
    b_read_at = case when user_b = auth.uid() then now() else b_read_at end
  where id = p_chat and auth.uid() in (user_a, user_b)
$$;

-- Your open feed chats (and ones waiting on keep or let go)
create or replace function public.my_feed_chats() returns json
language plpgsql security definer set search_path = public as $$
begin
  perform public.tidy_feed_chats();
  return coalesce((
    select json_agg(row_to_json(t) order by t.unread desc, t.last_message_at desc) from (
      select c.id, c.expires_at, c.last_message_at, c.prompt_body,
        public.feed_person(c, case when c.user_a = auth.uid() then c.user_b else c.user_a end, auth.uid()) as other,
        (select body from feed_chat_messages m where m.chat_id = c.id order by m.id desc limit 1) as last_message,
        public.feed_chat_unread(c, auth.uid()) as unread
      from feed_chats c
      where auth.uid() in (c.user_a, c.user_b) and c.status = 'open'
    ) t
  ), '[]'::json);
end $$;

create or replace function public.unread_feed_chats() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from feed_chats c
  where auth.uid() in (c.user_a, c.user_b) and c.status = 'open'
    and now() < c.expires_at + interval '24 hours'
    and public.feed_chat_unread(c, auth.uid())
$$;

-- For the menu dot: is there a prompt you have not answered, and new gifts?
create or replace function public.feed_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'prompt', (select json_build_object('id', p.id, 'body', p.body,
                 'answered', exists (select 1 from prompt_answers a where a.prompt_id = p.id and a.user_id = auth.uid()),
                 'answers', (select count(*) from prompt_answers a where a.prompt_id = p.id and a.hidden_at is null))
               from prompts p where p.day = public.feed_today()),
    'gifts_unseen', (select count(*) from prompt_gifts where to_user = auth.uid() and seen_at is null)
  )
$$;

create or replace function public.report_answer(p_answer uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a prompt_answers;
begin
  select * into a from prompt_answers where id = p_answer;
  if not found or a.user_id = auth.uid() then return; end if;
  insert into reports (reporter_id, reported_id, reason, answer_id)
  values (auth.uid(), a.user_id, left(coalesce(p_reason, 'Feed answer'), 500), a.id);
end $$;

-- Admin (only the server can call these)
create or replace function public.admin_prompts() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.day desc), '[]'::json) from (
    select p.id, p.body, p.day, p.chat_cost, p.created_at,
      (select count(*) from prompt_answers a where a.prompt_id = p.id) as answers,
      (select count(*) from prompt_answers a where a.prompt_id = p.id and a.hidden_at is not null) as hidden,
      (select count(*) from prompt_reactions r join prompt_answers a on a.id = r.answer_id where a.prompt_id = p.id) as reactions,
      (select count(*) from prompt_gifts g join prompt_answers a on a.id = g.answer_id where a.prompt_id = p.id) as gifts,
      (select count(*) from feed_chats c join prompt_answers a on a.id = c.answer_id where a.prompt_id = p.id) as chats,
      (select count(*) from reports r join prompt_answers a on a.id = r.answer_id where a.prompt_id = p.id) as reports
    from prompts p
    where p.day >= public.feed_today() - 60
  ) t
$$;

create or replace function public.admin_prompt_answers(p_prompt uuid) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.reports desc, t.created_at desc), '[]'::json) from (
    select a.id, a.alias, a.body, a.created_at, a.hidden_at, a.user_id, p.display_name, p.photos[1] as photo,
      (select count(*) from prompt_reactions r where r.answer_id = a.id) as reactions,
      (select count(*) from prompt_gifts g where g.answer_id = a.id) as gifts,
      (select count(*) from reports r where r.answer_id = a.id) as reports
    from prompt_answers a join profiles p on p.id = a.user_id
    where a.prompt_id = p_prompt
  ) t
$$;

revoke execute on function public.admin_prompts() from public, anon, authenticated;
revoke execute on function public.admin_prompt_answers(uuid) from public, anon, authenticated;
revoke execute on function public.tidy_feed_chats() from public, anon;
revoke execute on function public.feed_person(public.feed_chats, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Offline Masquerade alerts: when someone masks up and nobody online fits,
-- notify people who are open to Masquerade but away from the app.
-- Each person gets at most one alert every 2 hours and 4 a day.
-- ---------------------------------------------------------------------------
create table if not exists public.masquerade_alerts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  from_user uuid references public.profiles on delete cascade,
  distance_km int,
  sent_at timestamptz not null default now()
);
create index if not exists masquerade_alerts_user on public.masquerade_alerts (user_id, sent_at desc);
create index if not exists masquerade_alerts_from on public.masquerade_alerts (from_user, sent_at desc);
alter table public.masquerade_alerts enable row level security;

-- Picks who to alert for someone now waiting, records it, and returns them (only the server calls this)
create or replace function public.masquerade_alert_targets(p_from uuid, p_limit int default 10) returns json
language plpgsql security definer set search_path = public as $$
declare
  q masquerade_queue;
  me profiles;
  my_age int;
  picked json;
begin
  select * into q from masquerade_queue where user_id = p_from and created_at > now() - interval '2 minutes';
  if not found then return null; end if;
  -- One round of alerts per person every 10 minutes, however often they start and cancel
  if exists (select 1 from masquerade_alerts where from_user = p_from and sent_at > now() - interval '10 minutes') then
    return null;
  end if;
  select * into me from profiles where id = p_from;
  my_age := public.age_years(me.birthdate);

  with cand as (
    select p.id, ceil(public.distance_km(q.lat, q.lng, a.lat, a.lng))::int as km, p.last_seen_at
    from profiles p
    left join accounts_private a on a.user_id = p.id
    where p.open_to_masquerade
      and p.id <> p_from
      and p.last_seen_at <= now() - interval '2 minutes'
      and p.last_seen_at > now() - interval '21 days'
      and a.banned_at is null
      and p.pref_intent = q.intent
      and p.birthdate is not null and p.gender is not null
      and public.gender_fits(q.seeking, p.gender)
      and public.gender_fits(p.pref_seeking, me.gender)
      and public.age_years(p.birthdate) between q.age_min and q.age_max
      and my_age between p.pref_age_min and p.pref_age_max
      and public.within_km(public.distance_km(q.lat, q.lng, a.lat, a.lng), q.max_km)
      and public.within_km(public.distance_km(q.lat, q.lng, a.lat, a.lng), p.pref_max_km)
      and exists (select 1 from push_subscriptions s where s.user_id = p.id)
      and not exists (select 1 from masquerade_alerts x where x.user_id = p.id and x.sent_at > now() - interval '2 hours')
      and (select count(*) from masquerade_alerts x where x.user_id = p.id and x.sent_at > now() - interval '24 hours') < 4
      and not exists (select 1 from masquerade_queue w where w.user_id = p.id)
      and public.my_active_session(p.id) is null
      and not public.is_blocked(p_from, p.id)
      and not public.already_matched(p_from, p.id)
    -- People who were around most recently are the likeliest to come back
    order by p.last_seen_at desc, floor(public.distance_km(q.lat, q.lng, a.lat, a.lng) / 10) nulls last
    limit greatest(1, least(p_limit, 25))
  ), ins as (
    insert into masquerade_alerts (user_id, from_user, distance_km)
    select id, p_from, km from cand
    returning user_id, distance_km
  )
  select coalesce(json_agg(json_build_object('user_id', user_id, 'distance_km', distance_km)), '[]'::json) into picked from ins;

  return json_build_object('from_age', my_age, 'from_gender', me.gender, 'intent', q.intent, 'targets', picked);
end $$;
revoke execute on function public.masquerade_alert_targets(uuid, int) from public, anon, authenticated;
