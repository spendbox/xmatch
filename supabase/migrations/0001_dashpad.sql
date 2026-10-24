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
    or kind in ('call', 'gift', 'game')
  )
);
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'image', 'video', 'audio', 'call', 'gift', 'game'));

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
alter table public.masquerade_messages add constraint masquerade_messages_kind_check check (kind in ('text', 'icebreaker', 'gift', 'system', 'game'));

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'image', 'video', 'audio', 'call', 'gift', 'game'));
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check check (
  char_length(body) <= 2000 and (
    (kind = 'text' and (char_length(body) >= 1 or deleted_at is not null))
    or (kind in ('image', 'video', 'audio') and (media_path is not null or deleted_at is not null))
    or kind in ('call', 'gift', 'game')
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

-- ---------------------------------------------------------------------------
-- Friendlier gifts and Friends as the default mood.
-- New gifts: Fire, Respect, Jollof, Mic drop, Trophy. Chocolate, Teddy bear
-- and Bouquet are retired: they still show in old chats but can no longer be sent.
-- ---------------------------------------------------------------------------
alter table public.gifts add column if not exists retired boolean not null default false;
insert into public.gifts (id, name, emoji, price, sort, retired) values
  ('fire', 'Fire', '🔥', 5, 1, false),
  ('rose', 'Rose', '🌹', 5, 2, false),
  ('clap', 'Respect', '👏', 10, 3, false),
  ('coffee', 'Coffee', '☕', 10, 4, false),
  ('jollof', 'Jollof', '🍛', 15, 5, false),
  ('cocktail', 'Drinks on me', '🍸', 20, 6, false),
  ('mic', 'Mic drop', '🎤', 30, 7, false),
  ('trophy', 'Trophy', '🏆', 40, 8, false),
  ('crown', 'Crown', '👑', 60, 9, false),
  ('diamond', 'Diamond', '💎', 100, 10, false),
  ('chocolate', 'Chocolate', '🍫', 15, 90, true),
  ('teddy', 'Teddy bear', '🧸', 30, 91, true),
  ('bouquet', 'Bouquet', '💐', 40, 92, true)
on conflict (id) do update set name = excluded.name, emoji = excluded.emoji, price = excluded.price,
  sort = excluded.sort, retired = excluded.retired;

create or replace function public.send_gift(p_gift text, p_match uuid default null, p_session uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g gifts;
  bal int;
begin
  select * into g from gifts where id = p_gift and not retired;
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
  select * into g from gifts where id = p_gift and not retired;
  if not found then raise exception 'Unknown gift'; end if;
  bal := public.spend_keys(uid, g.price, 'feed_gift', g.id);
  insert into prompt_gifts (answer_id, from_user, to_user, gift_id, answer_body, prompt_body)
  values (a.id, uid, a.user_id, g.id, a.body, (select body from prompts where id = a.prompt_id));
  return bal;
end $$;

-- New members start on Friends (people can still pick Dating or Spicy)
alter table public.profiles alter column pref_intent set default 'friends';

-- ---------------------------------------------------------------------------
-- Hourly Masquerade: everyone with Masquerade turned on (and active in the last
-- day) is paired with someone new at the top of every hour, 6am to 2am Lagos time.
-- A pair chats masked until the hour ends. Both unmask: connected. One lets go:
-- the chat closes. Nobody decided but they talked: the chat is kept as a past
-- pair (either can unmask later, or pay Keys to reopen it until both decide).
-- Nobody talked: it quietly closes and they can be paired again another time.
-- ---------------------------------------------------------------------------
alter table public.masquerade_sessions add column if not exists hour_at timestamptz;
alter table public.masquerade_sessions add column if not exists reopened_at timestamptz;
alter table public.masquerade_sessions add column if not exists reopened_by uuid references public.profiles on delete set null;
alter table public.masquerade_sessions add column if not exists notified_at timestamptz;
create index if not exists masquerade_sessions_hour on public.masquerade_sessions (hour_at);
alter table public.masquerade_sessions drop constraint if exists masquerade_sessions_status_check;
alter table public.masquerade_sessions add constraint masquerade_sessions_status_check
  check (status in ('active', 'matched', 'ended', 'lapsed'));

-- Each hour that has been paired (so it only happens once)
create table if not exists public.masquerade_hours (
  hour_at timestamptz primary key,
  ran_at timestamptz not null default now(),
  pairs int not null default 0
);
alter table public.masquerade_hours enable row level security;

-- Pairing runs at 6am to 1am (the 1am pair ends at 2am). Nigeria is always UTC+1.
create or replace function public.pairing_hour_open(h timestamptz) returns boolean
language sql stable as $$
  select extract(hour from h at time zone 'Africa/Lagos') not in (2, 3, 4, 5)
$$;

create or replace function public.next_pairing_at(ts timestamptz default now()) returns timestamptz
language plpgsql stable as $$
declare h timestamptz := date_trunc('hour', ts) + interval '1 hour';
begin
  while not public.pairing_hour_open(h) loop
    h := h + interval '1 hour';
  end loop;
  return h;
end $$;

-- Only event rounds count as a busy chat now (hourly pairs and reopened chats run alongside)
create or replace function public.my_active_session(uid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from masquerade_sessions
  where status = 'active' and (user_a = uid or user_b = uid) and hour_at is null
  order by started_at desc limit 1
$$;

-- Decides what happens to a chat once both chose, someone let go, or time ran out
create or replace function public.finalize_masquerade(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s masquerade_sessions;
  mid uuid;
  talked boolean;
begin
  select * into s from masquerade_sessions where id = p_session for update;
  if not found or s.status not in ('active', 'lapsed') then return; end if;

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
    return;
  end if;

  if s.unmask_a is false or s.unmask_b is false then
    update masquerade_sessions set status = 'ended', ended_reason = coalesce(ended_reason, 'declined') where id = s.id;
    delete from masquerade_messages where session_id = s.id;
    return;
  end if;

  -- Hourly pairs: when the hour is over
  if s.hour_at is not null then
    if s.status = 'active' and now() >= s.ends_at then
      talked := exists (select 1 from masquerade_messages m where m.session_id = s.id and m.kind in ('text', 'gift') and m.sender_id = s.user_a)
            and exists (select 1 from masquerade_messages m where m.session_id = s.id and m.kind in ('text', 'gift') and m.sender_id = s.user_b);
      if talked then
        update masquerade_sessions set status = 'lapsed' where id = s.id;
      else
        update masquerade_sessions set status = 'ended', ended_reason = 'quiet' where id = s.id;
        delete from masquerade_messages where session_id = s.id;
      end if;
    end if;
    return;
  end if;

  -- Event rounds: time ran out without both deciding
  if now() > s.ends_at + interval '90 seconds' then
    update masquerade_sessions set status = 'ended', ended_reason = coalesce(ended_reason, 'timeout') where id = s.id;
    delete from masquerade_messages where session_id = s.id;
  end if;
end $$;

-- Unmask or let go. Hourly pairs can decide any time (and later, for past pairs).
create or replace function public.vote_unmask(p_session uuid, p_unmask boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then raise exception 'Chat not found'; end if;
  if s.status not in ('active', 'lapsed') then return; end if;
  if p_unmask and s.hour_at is null and now() < s.ends_at - interval '2 seconds' then
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

-- Pairs everyone for this hour. Safe to call any number of times: it only pairs once per hour.
-- Returns how many pairs were made just now.
create or replace function public.run_hourly_pairing() returns int
language plpgsql security definer set search_path = public as $$
declare
  h timestamptz := date_trunc('hour', now());
  r record;
  partner record;
  sid uuid;
  a1 text;
  q text;
  n int := 0;
  lvl smallint;
begin
  -- Close chats from hours that have ended
  for r in select id from masquerade_sessions
           where hour_at is not null and status = 'active' and reopened_at is null and ends_at <= now() loop
    perform public.finalize_masquerade(r.id);
  end loop;

  if not public.pairing_hour_open(h) then return 0; end if;
  perform pg_advisory_xact_lock(515151);
  if exists (select 1 from masquerade_hours where hour_at = h) then return 0; end if;
  insert into masquerade_hours (hour_at) values (h);
  -- Too late in the hour to start a fair chat: wait for the next one
  if now() > h + interval '45 minutes' then return 0; end if;

  drop table if exists pg_temp.hour_pool;
  create temp table hour_pool on commit drop as
    select p.id, p.gender, p.pref_intent, p.pref_seeking, p.pref_age_min, p.pref_age_max, p.pref_spice,
      p.pref_max_km, p.interests, public.age_years(p.birthdate) as age, a.lat, a.lng, random() as rnd
    from profiles p
    left join accounts_private a on a.user_id = p.id
    where p.open_to_masquerade
      and p.last_seen_at > now() - interval '24 hours'
      and p.display_name is not null and p.birthdate is not null and p.gender is not null
      and cardinality(p.photos) > 0
      and a.banned_at is null;

  for r in select * from hour_pool order by rnd loop
    continue when not exists (select 1 from hour_pool where id = r.id);
    select c.* into partner from hour_pool c
    where c.id <> r.id
      and c.pref_intent = r.pref_intent
      and public.gender_fits(r.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, r.gender)
      and c.age between r.pref_age_min and r.pref_age_max
      and r.age between c.pref_age_min and c.pref_age_max
      and public.within_km(public.distance_km(r.lat, r.lng, c.lat, c.lng), r.pref_max_km)
      and public.within_km(public.distance_km(r.lat, r.lng, c.lat, c.lng), c.pref_max_km)
      and not public.is_blocked(r.id, c.id)
      and not public.already_matched(r.id, c.id)
      -- New people every time (a pair that never talked can meet again)
      and not exists (select 1 from masquerade_sessions s
                      where s.hour_at is not null
                        and ((s.user_a = r.id and s.user_b = c.id) or (s.user_a = c.id and s.user_b = r.id))
                        and not (s.status = 'ended' and s.ended_reason = 'quiet'))
    order by public.shared_count(r.interests, c.interests) desc,
      floor(public.distance_km(r.lat, r.lng, c.lat, c.lng) / 10) nulls last, c.rnd
    limit 1;
    continue when not found;

    a1 := public.random_alias();
    lvl := round((r.pref_spice + partner.pref_spice) / 2.0)::smallint;
    insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, hour_at)
    values (r.id, partner.id, r.pref_intent, r.pref_spice, partner.pref_spice, lvl, a1, public.random_alias(a1), now(), h + interval '1 hour', h)
    returning id into sid;
    q := public.pick_icebreaker(sid, lvl, null);
    if q is not null then
      insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q);
    end if;
    delete from hour_pool where id in (r.id, partner.id);
    n := n + 1;
  end loop;

  update masquerade_hours set pairs = n where hour_at = h;
  return n;
end $$;
revoke execute on function public.run_hourly_pairing() from public, anon, authenticated;

-- The app calls this when opened, so pairing happens on time even if the scheduled job is late
create or replace function public.ensure_hourly_pairing() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if public.pairing_hour_open(date_trunc('hour', now()))
     and exists (select 1 from masquerade_hours where hour_at = date_trunc('hour', now())) then
    return;
  end if;
  perform public.run_hourly_pairing();
end $$;

-- Pairs made this hour that have not been told yet (for notifications; only the server calls this)
create or replace function public.hourly_pairs_to_notify() returns json
language sql security definer set search_path = public as $$
  with t as (
    update masquerade_sessions set notified_at = now()
    where hour_at = date_trunc('hour', now()) and status = 'active' and notified_at is null
    returning id, user_a, user_b, alias_a, alias_b, ends_at, intent
  )
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from t
$$;
revoke execute on function public.hourly_pairs_to_notify() from public, anon, authenticated;

-- Pay Keys to reopen a past pair. It stays open until you both decide.
create or replace function public.reopen_masquerade(p_session uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
  bal int;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid) for update;
  if not found then raise exception 'Chat not found'; end if;
  if s.status <> 'lapsed' then raise exception 'This chat can’t be reopened'; end if;
  if public.is_blocked(s.user_a, s.user_b) then raise exception 'Not available'; end if;
  bal := public.spend_keys(uid, 10, 'reopen', s.id::text);
  update masquerade_sessions set status = 'active', reopened_at = now(), reopened_by = uid, ends_at = 'infinity'
  where id = s.id;
  insert into masquerade_messages (session_id, kind, body)
  values (s.id, 'system', (case when s.user_a = uid then s.alias_a else s.alias_b end) || ' reopened the chat');
  return bal;
end $$;

-- Everything the Masquerade card on Home needs
create or replace function public.my_masquerade_hour() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  h timestamptz := date_trunc('hour', now());
  me profiles;
  cur masquerade_sessions;
  i_a boolean;
  op profiles;
begin
  if uid is null then return null; end if;
  perform public.ensure_hourly_pairing();
  select * into me from profiles where id = uid;
  select * into cur from masquerade_sessions
  where hour_at = h and (user_a = uid or user_b = uid)
  order by started_at desc limit 1;
  i_a := cur.user_a = uid;
  if cur.id is not null then
    select * into op from profiles where id = case when i_a then cur.user_b else cur.user_a end;
  end if;

  return json_build_object(
    'enabled', me.open_to_masquerade,
    'server_now', now(),
    'hour_at', h,
    'hour_open', public.pairing_hour_open(h),
    'hour_ran', exists (select 1 from masquerade_hours where hour_at = h),
    'pairs_this_hour', coalesce((select pairs from masquerade_hours where hour_at = h), 0),
    'next_at', public.next_pairing_at(now()),
    'current', case when cur.id is null then null else json_build_object(
      'id', cur.id, 'status', cur.status, 'intent', cur.intent, 'ends_at', cur.ends_at, 'match_id', cur.match_id,
      'my_alias', case when i_a then cur.alias_a else cur.alias_b end,
      'their_alias', case when i_a then cur.alias_b else cur.alias_a end,
      'their_age', public.age_years(op.birthdate), 'their_gender', op.gender,
      'their_name', case when cur.status = 'matched' then op.display_name end,
      'their_photo', case when cur.status = 'matched' then op.photos[1] end,
      'my_vote', case when i_a then cur.unmask_a else cur.unmask_b end,
      'they_voted', (case when i_a then cur.unmask_b else cur.unmask_a end) is not null,
      'messages', (select count(*) from masquerade_messages m where m.session_id = cur.id and m.kind in ('text', 'gift')),
      'last_message', (select body from masquerade_messages m where m.session_id = cur.id and m.kind = 'text' order by m.id desc limit 1),
      'last_from_them', (select m.sender_id <> uid from masquerade_messages m where m.session_id = cur.id and m.kind = 'text' order by m.id desc limit 1)
    ) end,
    'past', coalesce((
      select json_agg(row_to_json(t) order by t.sort_at desc) from (
        select s.id, s.status, s.intent, s.hour_at, s.reopened_at, coalesce(s.reopened_at, s.started_at) as sort_at,
          case when s.user_a = uid then s.alias_b else s.alias_a end as their_alias,
          public.age_years(p.birthdate) as their_age, p.gender as their_gender,
          case when s.user_a = uid then s.unmask_a else s.unmask_b end as my_vote,
          (select body from masquerade_messages m where m.session_id = s.id and m.kind = 'text' order by m.id desc limit 1) as last_message
        from masquerade_sessions s
        join profiles p on p.id = case when s.user_a = uid then s.user_b else s.user_a end
        where (s.user_a = uid or s.user_b = uid) and s.hour_at is not null
          and (s.status = 'lapsed' or (s.status = 'active' and s.reopened_at is not null))
          and not public.is_blocked(s.user_a, s.user_b)
        order by coalesce(s.reopened_at, s.started_at) desc
        limit 30
      ) t), '[]'::json)
  );
end $$;

-- The chat itself: also says whether it is an hourly pair or a reopened one
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
  if s.status = 'active' and (
       (s.hour_at is not null and now() >= s.ends_at)
       or (s.hour_at is null and now() > s.ends_at + interval '90 seconds')) then
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
    'hourly', s.hour_at is not null,
    'reopened', s.reopened_at is not null,
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

-- Keep your rough location fresh for distance pairing (about 1 km, never shown exactly)
create or replace function public.save_location(p_lat double precision, p_lng double precision) returns void
language sql security definer set search_path = public as $$
  update accounts_private set lat = round(p_lat::numeric, 2)::double precision, lng = round(p_lng::numeric, 2)::double precision,
    location_at = now()
  where user_id = auth.uid() and p_lat between -90 and 90 and p_lng between -180 and 180
$$;

-- ---------------------------------------------------------------------------
-- Where you are, without GPS: people pick their country and state.
-- Pairing goes closest first: same state, same country, same continent, then anywhere.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists place_country text check (place_country is null or char_length(place_country) = 2);
alter table public.profiles add column if not exists place_region text check (place_region is null or char_length(place_region) <= 80);
alter table public.profiles add column if not exists place_continent text check (place_continent is null or char_length(place_continent) = 2);
alter table public.profiles add column if not exists place_label text check (place_label is null or char_length(place_label) <= 140);

create or replace function public.run_hourly_pairing() returns int
language plpgsql security definer set search_path = public as $$
declare
  h timestamptz := date_trunc('hour', now());
  r record;
  partner record;
  sid uuid;
  a1 text;
  q text;
  n int := 0;
  lvl smallint;
begin
  -- Close chats from hours that have ended
  for r in select id from masquerade_sessions
           where hour_at is not null and status = 'active' and reopened_at is null and ends_at <= now() loop
    perform public.finalize_masquerade(r.id);
  end loop;

  if not public.pairing_hour_open(h) then return 0; end if;
  perform pg_advisory_xact_lock(515151);
  if exists (select 1 from masquerade_hours where hour_at = h) then return 0; end if;
  insert into masquerade_hours (hour_at) values (h);
  -- Too late in the hour to start a fair chat: wait for the next one
  if now() > h + interval '45 minutes' then return 0; end if;

  drop table if exists pg_temp.hour_pool;
  create temp table hour_pool on commit drop as
    select p.id, p.gender, p.pref_intent, p.pref_seeking, p.pref_age_min, p.pref_age_max, p.pref_spice,
      p.interests, public.age_years(p.birthdate) as age, p.place_country, p.place_region, p.place_continent, random() as rnd
    from profiles p
    left join accounts_private a on a.user_id = p.id
    where p.open_to_masquerade
      and p.last_seen_at > now() - interval '24 hours'
      and p.display_name is not null and p.birthdate is not null and p.gender is not null
      and cardinality(p.photos) > 0
      and a.banned_at is null;

  for r in select * from hour_pool order by rnd loop
    continue when not exists (select 1 from hour_pool where id = r.id);
    select c.* into partner from hour_pool c
    where c.id <> r.id
      and c.pref_intent = r.pref_intent
      and public.gender_fits(r.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, r.gender)
      and c.age between r.pref_age_min and r.pref_age_max
      and r.age between c.pref_age_min and c.pref_age_max
      and not public.is_blocked(r.id, c.id)
      and not public.already_matched(r.id, c.id)
      -- New people every time (a pair that never talked can meet again)
      and not exists (select 1 from masquerade_sessions s
                      where s.hour_at is not null
                        and ((s.user_a = r.id and s.user_b = c.id) or (s.user_a = c.id and s.user_b = r.id))
                        and not (s.status = 'ended' and s.ended_reason = 'quiet'))
    -- Closest first: same state, then same country, then same continent, then anywhere
    order by (c.place_country = r.place_country and c.place_region = r.place_region) desc nulls last,
      (c.place_country = r.place_country) desc nulls last,
      (c.place_continent = r.place_continent) desc nulls last,
      public.shared_count(r.interests, c.interests) desc, c.rnd
    limit 1;
    continue when not found;

    a1 := public.random_alias();
    lvl := round((r.pref_spice + partner.pref_spice) / 2.0)::smallint;
    insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, hour_at)
    values (r.id, partner.id, r.pref_intent, r.pref_spice, partner.pref_spice, lvl, a1, public.random_alias(a1), now(), h + interval '1 hour', h)
    returning id into sid;
    q := public.pick_icebreaker(sid, lvl, null);
    if q is not null then
      insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q);
    end if;
    delete from hour_pool where id in (r.id, partner.id);
    n := n + 1;
  end loop;

  update masquerade_hours set pairs = n where hour_at = h;
  return n;
end $$;

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
  if s.status = 'active' and (
       (s.hour_at is not null and now() >= s.ends_at)
       or (s.hour_at is null and now() > s.ends_at + interval '90 seconds')) then
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
    'hourly', s.hour_at is not null,
    'reopened', s.reopened_at is not null,
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
      'distance_km', null,
      'place', op.place_label,
      'same_place', op.place_country = mp.place_country and op.place_region = mp.place_region,
      'has_voted', (case when i_am_a then s.unmask_b else s.unmask_a end) is not null,
      -- Only revealed after you both unmask
      'profile', case when s.status = 'matched' then json_build_object(
        'id', op.id, 'display_name', op.display_name, 'bio', op.bio, 'photos', op.photos
      ) else null end
    )
  );
end $$;

create or replace function public.my_masquerade_hour() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  h timestamptz := date_trunc('hour', now());
  me profiles;
  cur masquerade_sessions;
  i_a boolean;
  op profiles;
begin
  if uid is null then return null; end if;
  perform public.ensure_hourly_pairing();
  select * into me from profiles where id = uid;
  select * into cur from masquerade_sessions
  where hour_at = h and (user_a = uid or user_b = uid)
  order by started_at desc limit 1;
  i_a := cur.user_a = uid;
  if cur.id is not null then
    select * into op from profiles where id = case when i_a then cur.user_b else cur.user_a end;
  end if;

  return json_build_object(
    'enabled', me.open_to_masquerade,
    'has_place', me.place_country is not null,
    'server_now', now(),
    'hour_at', h,
    'hour_open', public.pairing_hour_open(h),
    'hour_ran', exists (select 1 from masquerade_hours where hour_at = h),
    'pairs_this_hour', coalesce((select pairs from masquerade_hours where hour_at = h), 0),
    'next_at', public.next_pairing_at(now()),
    'current', case when cur.id is null then null else json_build_object(
      'id', cur.id, 'status', cur.status, 'intent', cur.intent, 'ends_at', cur.ends_at, 'match_id', cur.match_id,
      'my_alias', case when i_a then cur.alias_a else cur.alias_b end,
      'their_alias', case when i_a then cur.alias_b else cur.alias_a end,
      'their_age', public.age_years(op.birthdate), 'their_gender', op.gender, 'their_place', op.place_label,
      'their_name', case when cur.status = 'matched' then op.display_name end,
      'their_photo', case when cur.status = 'matched' then op.photos[1] end,
      'my_vote', case when i_a then cur.unmask_a else cur.unmask_b end,
      'they_voted', (case when i_a then cur.unmask_b else cur.unmask_a end) is not null,
      'messages', (select count(*) from masquerade_messages m where m.session_id = cur.id and m.kind in ('text', 'gift')),
      'last_message', (select body from masquerade_messages m where m.session_id = cur.id and m.kind = 'text' order by m.id desc limit 1),
      'last_from_them', (select m.sender_id <> uid from masquerade_messages m where m.session_id = cur.id and m.kind = 'text' order by m.id desc limit 1)
    ) end,
    'past', coalesce((
      select json_agg(row_to_json(t) order by t.sort_at desc) from (
        select s.id, s.status, s.intent, s.hour_at, s.reopened_at, coalesce(s.reopened_at, s.started_at) as sort_at,
          case when s.user_a = uid then s.alias_b else s.alias_a end as their_alias,
          public.age_years(p.birthdate) as their_age, p.gender as their_gender,
          case when s.user_a = uid then s.unmask_a else s.unmask_b end as my_vote,
          (select body from masquerade_messages m where m.session_id = s.id and m.kind = 'text' order by m.id desc limit 1) as last_message
        from masquerade_sessions s
        join profiles p on p.id = case when s.user_a = uid then s.user_b else s.user_a end
        where (s.user_a = uid or s.user_b = uid) and s.hour_at is not null
          and (s.status = 'lapsed' or (s.status = 'active' and s.reopened_at is not null))
          and not public.is_blocked(s.user_a, s.user_b)
        order by coalesce(s.reopened_at, s.started_at) desc
        limit 30
      ) t), '[]'::json)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Prices the admin can change, Key packs, reply speed, and hourly health tracking
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value int not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "anyone reads settings" on public.app_settings;
create policy "anyone reads settings" on public.app_settings for select using (true);
insert into public.app_settings (key, value) values
  ('reopen_cost', 10),
  ('reveal_cost', 1),
  ('free_reveals', 10)
on conflict (key) do nothing;

create or replace function public.setting_int(k text, d int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select value from app_settings where key = k), d)
$$;

create table if not exists public.key_packs (
  id text primary key,
  keys int not null check (keys > 0),
  naira int not null check (naira > 0),
  tag text,
  sort int not null default 0,
  active boolean not null default true
);
alter table public.key_packs enable row level security;
drop policy if exists "anyone reads packs" on public.key_packs;
create policy "anyone reads packs" on public.key_packs for select using (true);
insert into public.key_packs (id, keys, naira, tag, sort) values
  ('p50', 50, 750, null, 1),
  ('p150', 150, 2000, 'Popular', 2),
  ('p500', 500, 4500, 'Best value', 3)
on conflict (id) do nothing;

-- How quickly someone usually replies (median seconds over their recent replies; empty if too few)
create or replace function public.reply_seconds(p uuid) returns int
language sql stable security definer set search_path = public as $$
  with mine as (
    select m.match_id as chat, m.sender_id, m.created_at, m.id
    from messages m join matches x on x.id = m.match_id
    where p in (x.user_a, x.user_b) and m.created_at > now() - interval '60 days' and m.kind <> 'call'
    union all
    select mm.session_id, mm.sender_id, mm.created_at, mm.id
    from masquerade_messages mm join masquerade_sessions s on s.id = mm.session_id
    where p in (s.user_a, s.user_b) and mm.created_at > now() - interval '60 days' and mm.sender_id is not null
  ), steps as (
    select sender_id, created_at,
      lag(sender_id) over (partition by chat order by created_at, id) as prev_sender,
      lag(created_at) over (partition by chat order by created_at, id) as prev_at
    from mine
  ), replies as (
    select extract(epoch from created_at - prev_at) as secs from steps
    where sender_id = p and prev_sender is not null and prev_sender <> p
      and created_at - prev_at < interval '12 hours'
  )
  select case when count(*) >= 3 then (percentile_cont(0.5) within group (order by secs))::int end from replies
$$;

alter table public.masquerade_hours add column if not exists eligible int not null default 0;
alter table public.masquerade_hours add column if not exists note text;

create or replace function public.run_hourly_pairing() returns int
language plpgsql security definer set search_path = public as $$
declare
  h timestamptz := date_trunc('hour', now());
  r record;
  partner record;
  sid uuid;
  a1 text;
  q text;
  n int := 0;
  lvl smallint;
begin
  -- Close chats from hours that have ended
  for r in select id from masquerade_sessions
           where hour_at is not null and status = 'active' and reopened_at is null and ends_at <= now() loop
    perform public.finalize_masquerade(r.id);
  end loop;

  if not public.pairing_hour_open(h) then return 0; end if;
  perform pg_advisory_xact_lock(515151);
  if exists (select 1 from masquerade_hours where hour_at = h) then return 0; end if;
  insert into masquerade_hours (hour_at) values (h);
  -- Too late in the hour to start a fair chat: wait for the next one
  if now() > h + interval '45 minutes' then
    update masquerade_hours set note = 'late' where hour_at = h;
    return 0;
  end if;

  drop table if exists pg_temp.hour_pool;
  create temp table hour_pool on commit drop as
    select p.id, p.gender, p.pref_intent, p.pref_seeking, p.pref_age_min, p.pref_age_max, p.pref_spice,
      p.interests, public.age_years(p.birthdate) as age, p.place_country, p.place_region, p.place_continent, random() as rnd
    from profiles p
    left join accounts_private a on a.user_id = p.id
    where p.open_to_masquerade
      and p.last_seen_at > now() - interval '24 hours'
      and p.display_name is not null and p.birthdate is not null and p.gender is not null
      and cardinality(p.photos) > 0
      and a.banned_at is null;

  update masquerade_hours set eligible = (select count(*) from hour_pool) where hour_at = h;

  for r in select * from hour_pool order by rnd loop
    continue when not exists (select 1 from hour_pool where id = r.id);
    select c.* into partner from hour_pool c
    where c.id <> r.id
      and c.pref_intent = r.pref_intent
      and public.gender_fits(r.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, r.gender)
      and c.age between r.pref_age_min and r.pref_age_max
      and r.age between c.pref_age_min and c.pref_age_max
      and not public.is_blocked(r.id, c.id)
      and not public.already_matched(r.id, c.id)
      -- New people every time (a pair that never talked can meet again)
      and not exists (select 1 from masquerade_sessions s
                      where s.hour_at is not null
                        and ((s.user_a = r.id and s.user_b = c.id) or (s.user_a = c.id and s.user_b = r.id))
                        and not (s.status = 'ended' and s.ended_reason = 'quiet'))
    -- Closest first: same state, then same country, then same continent, then anywhere
    order by (c.place_country = r.place_country and c.place_region = r.place_region) desc nulls last,
      (c.place_country = r.place_country) desc nulls last,
      (c.place_continent = r.place_continent) desc nulls last,
      public.shared_count(r.interests, c.interests) desc, c.rnd
    limit 1;
    continue when not found;

    a1 := public.random_alias();
    lvl := round((r.pref_spice + partner.pref_spice) / 2.0)::smallint;
    insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, hour_at)
    values (r.id, partner.id, r.pref_intent, r.pref_spice, partner.pref_spice, lvl, a1, public.random_alias(a1), now(), h + interval '1 hour', h)
    returning id into sid;
    q := public.pick_icebreaker(sid, lvl, null);
    if q is not null then
      insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q);
    end if;
    delete from hour_pool where id in (r.id, partner.id);
    n := n + 1;
  end loop;

  update masquerade_hours set pairs = n where hour_at = h;
  return n;
end $$;

create or replace function public.reopen_masquerade(p_session uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
  bal int;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid) for update;
  if not found then raise exception 'Chat not found'; end if;
  if s.status <> 'lapsed' then raise exception 'This chat can’t be reopened'; end if;
  if public.is_blocked(s.user_a, s.user_b) then raise exception 'Not available'; end if;
  bal := public.spend_keys(uid, public.setting_int('reopen_cost', 10), 'reopen', s.id::text);
  update masquerade_sessions set status = 'active', reopened_at = now(), reopened_by = uid, ends_at = 'infinity'
  where id = s.id;
  insert into masquerade_messages (session_id, kind, body)
  values (s.id, 'system', (case when s.user_a = uid then s.alias_a else s.alias_b end) || ' reopened the chat');
  return bal;
end $$;

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
  if s.status = 'active' and (
       (s.hour_at is not null and now() >= s.ends_at)
       or (s.hour_at is null and now() > s.ends_at + interval '90 seconds')) then
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
    'hourly', s.hour_at is not null,
    'reopened', s.reopened_at is not null,
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
      'distance_km', null,
      'place', op.place_label,
      'same_place', op.place_country = mp.place_country and op.place_region = mp.place_region,
      'connections', (select count(*) from matches x where op.id in (x.user_a, x.user_b)),
      'reply_seconds', public.reply_seconds(op.id),
      'has_voted', (case when i_am_a then s.unmask_b else s.unmask_a end) is not null,
      -- Only revealed after you both unmask
      'profile', case when s.status = 'matched' then json_build_object(
        'id', op.id, 'display_name', op.display_name, 'bio', op.bio, 'photos', op.photos
      ) else null end
    )
  );
end $$;

create or replace function public.my_masquerade_hour() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  h timestamptz := date_trunc('hour', now());
  me profiles;
  cur masquerade_sessions;
  i_a boolean;
  op profiles;
begin
  if uid is null then return null; end if;
  perform public.ensure_hourly_pairing();
  select * into me from profiles where id = uid;
  select * into cur from masquerade_sessions
  where hour_at = h and (user_a = uid or user_b = uid)
  order by started_at desc limit 1;
  i_a := cur.user_a = uid;
  if cur.id is not null then
    select * into op from profiles where id = case when i_a then cur.user_b else cur.user_a end;
  end if;

  return json_build_object(
    'enabled', me.open_to_masquerade,
    'has_place', me.place_country is not null,
    'server_now', now(),
    'hour_at', h,
    'hour_open', public.pairing_hour_open(h),
    'hour_ran', exists (select 1 from masquerade_hours where hour_at = h),
    'pairs_this_hour', coalesce((select pairs from masquerade_hours where hour_at = h), 0),
    'next_at', public.next_pairing_at(now()),
    'current', case when cur.id is null then null else json_build_object(
      'id', cur.id, 'status', cur.status, 'intent', cur.intent, 'ends_at', cur.ends_at, 'match_id', cur.match_id,
      'my_alias', case when i_a then cur.alias_a else cur.alias_b end,
      'their_alias', case when i_a then cur.alias_b else cur.alias_a end,
      'their_age', public.age_years(op.birthdate), 'their_gender', op.gender, 'their_place', op.place_label,
      'their_connections', (select count(*) from matches x where op.id in (x.user_a, x.user_b)),
      'their_reply_seconds', public.reply_seconds(op.id),
      'their_name', case when cur.status = 'matched' then op.display_name end,
      'their_photo', case when cur.status = 'matched' then op.photos[1] end,
      'my_vote', case when i_a then cur.unmask_a else cur.unmask_b end,
      'they_voted', (case when i_a then cur.unmask_b else cur.unmask_a end) is not null,
      'messages', (select count(*) from masquerade_messages m where m.session_id = cur.id and m.kind in ('text', 'gift')),
      'last_message', (select body from masquerade_messages m where m.session_id = cur.id and m.kind = 'text' order by m.id desc limit 1),
      'last_from_them', (select m.sender_id <> uid from masquerade_messages m where m.session_id = cur.id and m.kind = 'text' order by m.id desc limit 1)
    ) end,
    'past', coalesce((
      select json_agg(row_to_json(t) order by t.sort_at desc) from (
        select s.id, s.status, s.intent, s.hour_at, s.reopened_at, coalesce(s.reopened_at, s.started_at) as sort_at,
          case when s.user_a = uid then s.alias_b else s.alias_a end as their_alias,
          public.age_years(p.birthdate) as their_age, p.gender as their_gender,
          case when s.user_a = uid then s.unmask_a else s.unmask_b end as my_vote,
          (select body from masquerade_messages m where m.session_id = s.id and m.kind = 'text' order by m.id desc limit 1) as last_message
        from masquerade_sessions s
        join profiles p on p.id = case when s.user_a = uid then s.user_b else s.user_a end
        where (s.user_a = uid or s.user_b = uid) and s.hour_at is not null
          and (s.status = 'lapsed' or (s.status = 'active' and s.reopened_at is not null))
          and not public.is_blocked(s.user_a, s.user_b)
        order by coalesce(s.reopened_at, s.started_at) desc
        limit 30
      ) t), '[]'::json)
  );
end $$;

-- Admin: how hourly pairing is doing (only the server calls this)
create or replace function public.admin_masquerade_stats() returns json
language sql stable security definer set search_path = public as $$
  with hrs as (
    select g as hour_at from generate_series(date_trunc('hour', now()) - interval '47 hours', date_trunc('hour', now()), interval '1 hour') g
  ), per as (
    select hour_at,
      count(*) as pairs,
      count(*) filter (where status = 'matched') as clicked,
      count(*) filter (where status = 'lapsed') as undecided,
      count(*) filter (where reopened_at is not null) as reopened,
      count(*) filter (where status = 'ended' and ended_reason = 'quiet') as quiet,
      count(*) filter (where status = 'ended' and coalesce(ended_reason, '') <> 'quiet') as let_go,
      count(*) filter (where status = 'active') as live,
      count(*) filter (where notified_at is null) as not_notified
    from masquerade_sessions where hour_at > now() - interval '48 hours' group by hour_at
  )
  select json_build_object(
    'now', now(),
    'hours', coalesce((select json_agg(json_build_object(
        'hour_at', h.hour_at, 'open', public.pairing_hour_open(h.hour_at),
        'ran_at', mh.ran_at, 'eligible', mh.eligible, 'note', mh.note,
        'pairs', coalesce(p.pairs, 0), 'clicked', coalesce(p.clicked, 0), 'undecided', coalesce(p.undecided, 0),
        'reopened', coalesce(p.reopened, 0), 'quiet', coalesce(p.quiet, 0), 'let_go', coalesce(p.let_go, 0),
        'live', coalesce(p.live, 0), 'not_notified', coalesce(p.not_notified, 0)
      ) order by h.hour_at desc)
      from hrs h left join masquerade_hours mh on mh.hour_at = h.hour_at left join per p on p.hour_at = h.hour_at), '[]'::json),
    'switched_on', (select count(*) from profiles where open_to_masquerade),
    'eligible_now', (select count(*) from profiles p left join accounts_private a on a.user_id = p.id
                     where p.open_to_masquerade and p.last_seen_at > now() - interval '24 hours' and a.banned_at is null),
    'no_place', (select count(*) from profiles where open_to_masquerade and place_country is null),
    'week', (select json_build_object(
        'pairs', count(*), 'clicked', count(*) filter (where status = 'matched'),
        'quiet', count(*) filter (where ended_reason = 'quiet'),
        'reopened', count(*) filter (where reopened_at is not null))
      from masquerade_sessions where hour_at > now() - interval '7 days'),
    'by_mood', coalesce((select json_object_agg(intent, n) from (
        select intent, count(*) n from masquerade_sessions where hour_at > now() - interval '7 days' group by intent) t), '{}'::json)
  )
$$;
revoke execute on function public.admin_masquerade_stats() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Invites (inviter earns Keys on a friend’s first purchase), nudges for quiet chats, the live pulse, closest-first notes,
-- and quick repliers getting paired first
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value) values ('invite_reward', 10) on conflict (key) do nothing;

-- Invite codes and who invited whom are private: only these functions read them
create table if not exists public.invite_codes (
  user_id uuid primary key references public.profiles on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.invite_codes enable row level security;

create table if not exists public.referrals (
  invitee uuid primary key references public.profiles on delete cascade,
  inviter uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists referrals_inviter on public.referrals (inviter);
alter table public.referrals enable row level security;

create table if not exists public.referral_rewards (
  id bigint generated always as identity primary key,
  inviter uuid not null references public.profiles on delete cascade,
  invitee uuid references public.profiles on delete set null,
  payment_ref text not null unique,
  keys int not null,
  created_at timestamptz not null default now()
);
create index if not exists referral_rewards_inviter on public.referral_rewards (inviter);
alter table public.referral_rewards enable row level security;

-- Your invite link code (made the first time you ask) and how your invites are doing.
-- Anonymous: you see Friend 1, Friend 2, never names.
create or replace function public.my_invites() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c text;
begin
  if uid is null then return null; end if;
  select code into c from invite_codes where user_id = uid;
  while c is null loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text || uid::text), 1, 7));
    begin
      if char_length(c) = 7 then
        insert into invite_codes (user_id, code) values (uid, c);
      else
        c := null;
      end if;
    exception when unique_violation then c := null;
    end;
  end loop;
  return json_build_object(
    'code', c,
    'reward', public.setting_int('invite_reward', 10),
    'joined', (select count(*) from referrals where inviter = uid),
    'bought', (select count(distinct invitee) from referral_rewards where inviter = uid),
    'earned', coalesce((select sum(keys) from referral_rewards where inviter = uid), 0),
    'friends', coalesce((select json_agg(json_build_object(
        'n', t.n, 'joined_at', t.created_at, 'purchases', t.purchases, 'earned', t.earned) order by t.n desc)
      from (select row_number() over (order by r.created_at) as n, r.created_at,
              (select count(*) from referral_rewards w where w.invitee = r.invitee and w.inviter = uid) as purchases,
              coalesce((select sum(keys) from referral_rewards w where w.invitee = r.invitee and w.inviter = uid), 0) as earned
            from referrals r where r.inviter = uid) t), '[]'::json)
  );
end $$;

-- New members who arrived through an invite link claim it once, within their first two weeks
create or replace function public.claim_invite(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  inv uuid;
begin
  if uid is null or p_code is null then return false; end if;
  select user_id into inv from invite_codes where code = upper(btrim(p_code));
  if inv is null or inv = uid then return false; end if;
  if exists (select 1 from referrals where invitee = uid) then return false; end if;
  if (select created_at from profiles where id = uid) < now() - interval '14 days' then return false; end if;
  insert into referrals (invitee, inviter) values (uid, inv) on conflict do nothing;
  return true;
end $$;

create or replace function public.complete_payment(p_reference text, p_amount_kobo int) returns text
language plpgsql security definer set search_path = public as $$
declare
  p payments;
  inv uuid;
  reward int;
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
  -- Whoever invited them earns Keys on their first purchase only
  select inviter into inv from referrals where invitee = p.user_id;
  reward := public.setting_int('invite_reward', 10);
  if inv is not null and reward > 0 and not exists (select 1 from referral_rewards where invitee = p.user_id) then
    insert into referral_rewards (inviter, invitee, payment_ref, keys) values (inv, p.user_id, p_reference, reward)
    on conflict (payment_ref) do nothing;
    if found then perform public.add_keys(inv, reward, 'invite', p_reference); end if;
  end if;
  return 'paid';
end $$;

-- Admin: invite totals (only the server calls this)
create or replace function public.admin_invite_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'joined', (select count(*) from referrals),
    'joined_7d', (select count(*) from referrals where created_at > now() - interval '7 days'),
    'buyers', (select count(distinct invitee) from referral_rewards),
    'keys_paid', coalesce((select sum(keys) from referral_rewards), 0),
    'top', coalesce((select json_agg(t) from (
        select p.display_name as name, count(*) as joined,
          coalesce((select sum(keys) from referral_rewards w where w.inviter = r.inviter), 0) as earned
        from referrals r join profiles p on p.id = r.inviter
        group by r.inviter, p.display_name order by count(*) desc limit 5) t), '[]'::json)
  )
$$;
revoke execute on function public.admin_invite_stats() from public, anon, authenticated;

-- Nudge whoever has gone quiet in a live hourly chat (once each per chat; only the server calls this)
alter table public.masquerade_sessions add column if not exists nudged_a timestamptz;
alter table public.masquerade_sessions add column if not exists nudged_b timestamptz;

create or replace function public.sessions_to_nudge() returns json
language plpgsql security definer set search_path = public as $$
declare
  out json;
begin
  with live as (
    select s.*,
      (select max(created_at) from masquerade_messages m where m.session_id = s.id and m.sender_id = s.user_a and m.kind in ('text', 'gift')) as last_a,
      (select max(created_at) from masquerade_messages m where m.session_id = s.id and m.sender_id = s.user_b and m.kind in ('text', 'gift')) as last_b
    from masquerade_sessions s
    where s.hour_at is not null and s.status = 'active' and s.reopened_at is null
      and now() < s.ends_at - interval '5 minutes'
      and s.started_at < now() - interval '10 minutes'
  ), pick as (
    select id, user_a as who, alias_b as other_alias, ends_at, 'a' as side from live
    where nudged_a is null and (
      (last_a is null and (last_b is null or last_b < now() - interval '10 minutes'))
      or (last_b is not null and last_b > coalesce(last_a, '-infinity') and last_b < now() - interval '10 minutes'))
    union all
    select id, user_b, alias_a, ends_at, 'b' from live
    where nudged_b is null and (
      (last_b is null and (last_a is null or last_a < now() - interval '10 minutes'))
      or (last_a is not null and last_a > coalesce(last_b, '-infinity') and last_a < now() - interval '10 minutes'))
  ), mark_a as (
    update masquerade_sessions s set nudged_a = now() from pick where pick.id = s.id and pick.side = 'a' returning s.id
  ), mark_b as (
    update masquerade_sessions s set nudged_b = now() from pick where pick.id = s.id and pick.side = 'b' returning s.id
  )
  select coalesce(json_agg(json_build_object('session_id', id, 'user_id', who, 'other_alias', other_alias, 'ends_at', ends_at)), '[]'::json)
  into out from pick
  where (select count(*) from mark_a) + (select count(*) from mark_b) >= 0;
  return out;
end $$;
revoke execute on function public.sessions_to_nudge() from public, anon, authenticated;

create or replace function public.run_hourly_pairing() returns int
language plpgsql security definer set search_path = public as $$
declare
  h timestamptz := date_trunc('hour', now());
  r record;
  partner record;
  sid uuid;
  a1 text;
  q text;
  n int := 0;
  lvl smallint;
begin
  -- Close chats from hours that have ended
  for r in select id from masquerade_sessions
           where hour_at is not null and status = 'active' and reopened_at is null and ends_at <= now() loop
    perform public.finalize_masquerade(r.id);
  end loop;

  if not public.pairing_hour_open(h) then return 0; end if;
  perform pg_advisory_xact_lock(515151);
  if exists (select 1 from masquerade_hours where hour_at = h) then return 0; end if;
  insert into masquerade_hours (hour_at) values (h);
  -- Too late in the hour to start a fair chat: wait for the next one
  if now() > h + interval '45 minutes' then
    update masquerade_hours set note = 'late' where hour_at = h;
    return 0;
  end if;

  drop table if exists pg_temp.hour_pool;
  create temp table hour_pool on commit drop as
    select p.id, p.gender, p.pref_intent, p.pref_seeking, p.pref_age_min, p.pref_age_max, p.pref_spice,
      p.interests, public.age_years(p.birthdate) as age, p.place_country, p.place_region, p.place_continent,
      coalesce(public.reply_seconds(p.id), 1800) as rs, random() as rnd
    from profiles p
    left join accounts_private a on a.user_id = p.id
    where p.open_to_masquerade
      and p.last_seen_at > now() - interval '24 hours'
      and p.display_name is not null and p.birthdate is not null and p.gender is not null
      and cardinality(p.photos) > 0
      and a.banned_at is null;

  update masquerade_hours set eligible = (select count(*) from hour_pool) where hour_at = h;

  -- Quick repliers choose first, so they get the best fits
  for r in select * from hour_pool order by rs, rnd loop
    continue when not exists (select 1 from hour_pool where id = r.id);
    select c.* into partner from hour_pool c
    where c.id <> r.id
      and c.pref_intent = r.pref_intent
      and public.gender_fits(r.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, r.gender)
      and c.age between r.pref_age_min and r.pref_age_max
      and r.age between c.pref_age_min and c.pref_age_max
      and not public.is_blocked(r.id, c.id)
      and not public.already_matched(r.id, c.id)
      -- New people every time (a pair that never talked can meet again)
      and not exists (select 1 from masquerade_sessions s
                      where s.hour_at is not null
                        and ((s.user_a = r.id and s.user_b = c.id) or (s.user_a = c.id and s.user_b = r.id))
                        and not (s.status = 'ended' and s.ended_reason = 'quiet'))
    -- Closest first: same state, then same country, then same continent, then anywhere
    order by (c.place_country = r.place_country and c.place_region = r.place_region) desc nulls last,
      (c.place_country = r.place_country) desc nulls last,
      (c.place_continent = r.place_continent) desc nulls last,
      public.shared_count(r.interests, c.interests) desc,
      (c.rs < 600) desc, c.rs, c.rnd
    limit 1;
    continue when not found;

    a1 := public.random_alias();
    lvl := round((r.pref_spice + partner.pref_spice) / 2.0)::smallint;
    insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, hour_at)
    values (r.id, partner.id, r.pref_intent, r.pref_spice, partner.pref_spice, lvl, a1, public.random_alias(a1), now(), h + interval '1 hour', h)
    returning id into sid;
    q := public.pick_icebreaker(sid, lvl, null);
    if q is not null then
      insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q);
    end if;
    delete from hour_pool where id in (r.id, partner.id);
    n := n + 1;
  end loop;

  update masquerade_hours set pairs = n where hour_at = h;
  return n;
end $$;

create or replace function public.my_masquerade_hour() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  h timestamptz := date_trunc('hour', now());
  me profiles;
  cur masquerade_sessions;
  i_a boolean;
  op profiles;
begin
  if uid is null then return null; end if;
  perform public.ensure_hourly_pairing();
  select * into me from profiles where id = uid;
  select * into cur from masquerade_sessions
  where hour_at = h and (user_a = uid or user_b = uid)
  order by started_at desc limit 1;
  i_a := cur.user_a = uid;
  if cur.id is not null then
    select * into op from profiles where id = case when i_a then cur.user_b else cur.user_a end;
  end if;

  return json_build_object(
    'enabled', me.open_to_masquerade,
    'has_place', me.place_country is not null,
    'server_now', now(),
    'hour_at', h,
    'hour_open', public.pairing_hour_open(h),
    'hour_ran', exists (select 1 from masquerade_hours where hour_at = h),
    'pairs_this_hour', coalesce((select pairs from masquerade_hours where hour_at = h), 0),
    'next_at', public.next_pairing_at(now()),
    'pulse', (select json_build_object(
        'all', count(*),
        'country', count(*) filter (where me.place_country is not null and p.place_country = me.place_country),
        'region', count(*) filter (where me.place_region is not null and p.place_country = me.place_country and p.place_region = me.place_region),
        'region_name', me.place_region)
      from profiles p left join accounts_private a on a.user_id = p.id
      where p.open_to_masquerade and p.id <> uid and p.last_seen_at > now() - interval '24 hours' and a.banned_at is null),
    'invite_reward', public.setting_int('invite_reward', 10),
    'current', case when cur.id is null then null else json_build_object(
      'id', cur.id, 'status', cur.status, 'intent', cur.intent, 'ends_at', cur.ends_at, 'match_id', cur.match_id,
      'my_alias', case when i_a then cur.alias_a else cur.alias_b end,
      'their_alias', case when i_a then cur.alias_b else cur.alias_a end,
      'their_age', public.age_years(op.birthdate), 'their_gender', op.gender, 'their_place', op.place_label,
      'their_connections', (select count(*) from matches x where op.id in (x.user_a, x.user_b)),
      'their_reply_seconds', public.reply_seconds(op.id),
      'their_tier', case
        when me.place_country is null or op.place_country is null then null
        when op.place_country = me.place_country and op.place_region = me.place_region then 'state'
        when op.place_country = me.place_country then 'country'
        when op.place_continent = me.place_continent then 'continent'
        else 'world' end,
      'their_name', case when cur.status = 'matched' then op.display_name end,
      'their_photo', case when cur.status = 'matched' then op.photos[1] end,
      'my_vote', case when i_a then cur.unmask_a else cur.unmask_b end,
      'they_voted', (case when i_a then cur.unmask_b else cur.unmask_a end) is not null,
      'messages', (select count(*) from masquerade_messages m where m.session_id = cur.id and m.kind in ('text', 'gift')),
      'last_message', (select body from masquerade_messages m where m.session_id = cur.id and m.kind = 'text' order by m.id desc limit 1),
      'last_from_them', (select m.sender_id <> uid from masquerade_messages m where m.session_id = cur.id and m.kind = 'text' order by m.id desc limit 1)
    ) end,
    'past', coalesce((
      select json_agg(row_to_json(t) order by t.sort_at desc) from (
        select s.id, s.status, s.intent, s.hour_at, s.reopened_at, coalesce(s.reopened_at, s.started_at) as sort_at,
          case when s.user_a = uid then s.alias_b else s.alias_a end as their_alias,
          public.age_years(p.birthdate) as their_age, p.gender as their_gender,
          case when s.user_a = uid then s.unmask_a else s.unmask_b end as my_vote,
          (select body from masquerade_messages m where m.session_id = s.id and m.kind = 'text' order by m.id desc limit 1) as last_message
        from masquerade_sessions s
        join profiles p on p.id = case when s.user_a = uid then s.user_b else s.user_a end
        where (s.user_a = uid or s.user_b = uid) and s.hour_at is not null
          and (s.status = 'lapsed' or (s.status = 'active' and s.reopened_at is not null))
          and not public.is_blocked(s.user_a, s.user_b)
        order by coalesce(s.reopened_at, s.started_at) desc
        limit 30
      ) t), '[]'::json)
  );
end $$;

-- Run the notify job every 5 minutes (new pairs and nudges). Skipped quietly if part 18 was not run.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.alter_job(jobid, schedule := '*/5 * * * *') from cron.job where jobname = 'dashpad-hourly-notify';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Part 22: Games in chats (Two Truths and a Lie, This or That, Connect 4, Word Hunt)
-- Played in hourly masked chats, reopened pairs and chats with your people.
-- Every move goes through the functions below, so the server checks the rules.
-- ---------------------------------------------------------------------------
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('truths', 'tot', 'c4', 'words')),
  session_id uuid references public.masquerade_sessions on delete cascade,
  match_id uuid references public.matches on delete cascade,
  player_a uuid not null references public.profiles on delete cascade, -- the challenger
  player_b uuid not null references public.profiles on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'active', 'done', 'declined', 'expired', 'cancelled')),
  state jsonb not null default '{}'::jsonb, -- what both players may see
  score_a int not null default 0,
  score_b int not null default 0,
  winner uuid,
  ended_by uuid,
  ended_reason text,
  deadline_at timestamptz, -- when the current step runs out
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  rematch_of uuid references public.games on delete set null,
  check ((session_id is null) <> (match_id is null))
);
create index if not exists games_session on public.games (session_id, created_at desc);
create index if not exists games_match on public.games (match_id, created_at desc);
create index if not exists games_created on public.games (created_at desc);
create unique index if not exists games_one_live_session on public.games (session_id) where status in ('invited', 'active') and session_id is not null;
create unique index if not exists games_one_live_match on public.games (match_id) where status in ('invited', 'active') and match_id is not null;

-- Hidden parts of a game (your lie, your picks, your words) until it is time to show them
create table if not exists public.game_secrets (
  game_id uuid not null references public.games on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  data jsonb not null default '{}'::jsonb,
  primary key (game_id, user_id)
);

alter table public.games enable row level security;
alter table public.game_secrets enable row level security;
drop policy if exists "players read games" on public.games;
create policy "players read games" on public.games for select
  using (player_a = auth.uid() or player_b = auth.uid());

do $$
begin
  alter publication supabase_realtime add table public.games;
exception when duplicate_object then null;
end $$;

-- This or That questions and Two Truths idea chips (managed in Admin)
create table if not exists public.tot_questions (
  id serial primary key,
  prompt text not null,
  a text not null,
  b text not null,
  spice smallint not null default 0 check (spice between 0 and 3),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (a, b)
);
create table if not exists public.truth_ideas (
  id serial primary key,
  body text not null unique,
  active boolean not null default true
);
alter table public.tot_questions enable row level security;
alter table public.truth_ideas enable row level security;
drop policy if exists "read tot questions" on public.tot_questions;
create policy "read tot questions" on public.tot_questions for select using (auth.role() = 'authenticated');
drop policy if exists "read truth ideas" on public.truth_ideas;
create policy "read truth ideas" on public.truth_ideas for select using (auth.role() = 'authenticated' and active);

insert into public.tot_questions (prompt, a, b, spice) values
  ('Perfect Saturday night?', 'Owambe till 4am', 'Netflix and suya', 0),
  ('Pick one forever', 'Jollof rice', 'Fried rice', 0),
  ('Morning person or night owl?', 'Up with the sun', 'Up till 3am', 0),
  ('Dream holiday', 'Beach in Zanzibar', 'Snow in Switzerland', 0),
  ('Your phone is on', 'Loud', 'Silent', 0),
  ('Better first date', 'Dinner', 'Arcade and games', 0),
  ('Texting style', 'Long paragraphs', 'Voice notes', 0),
  ('Which would you rather be', 'Famous', 'Rich and unknown', 0),
  ('Afrobeats or Amapiano?', 'Afrobeats', 'Amapiano', 0),
  ('Pick a drink', 'Chapman', 'Zobo', 0),
  ('Weekend plan', 'Stay home', 'Go out', 0),
  ('Pets', 'Dogs', 'Cats', 0),
  ('Your money goes on', 'Food', 'Clothes', 0),
  ('In a group chat you are', 'The one who replies first', 'The silent reader', 0),
  ('Pick a superpower', 'Fly', 'Read minds', 0),
  ('Rather live in', 'Lagos', 'Abuja', 0),
  ('Breakfast', 'Akara and pap', 'Tea and bread', 0),
  ('Movies', 'Nollywood', 'Hollywood', 0),
  ('Rather have', 'More time', 'More money', 0),
  ('When you travel', 'Plan everything', 'Go with the flow', 0),
  ('Pick a season', 'Rainy season', 'Harmattan', 0),
  ('Football or basketball?', 'Football', 'Basketball', 0),
  ('Your vibe at a party', 'On the dance floor', 'By the food', 0),
  ('Rather give up', 'Social media', 'Music', 0),
  ('Pick a snack', 'Chin chin', 'Plantain chips', 0),
  ('Calls or texts?', 'Calls', 'Texts', 0),
  ('Rather be', 'Too early', 'Fashionably late', 0),
  ('Pick a gift', 'Something handmade', 'Something expensive', 0),
  ('Workout', 'Gym', 'Dance', 0),
  ('Rather visit', 'The past', 'The future', 0),
  ('Your playlist', 'Old school', 'Brand new hits', 0),
  ('Pick a pepper level', 'Mild please', 'Make me cry', 0),
  ('Who pays on a first date?', 'Whoever asked', 'Split it', 1),
  ('Love language', 'Words', 'Touch', 1),
  ('Rather date someone', 'Funny', 'Smart', 1),
  ('First move', 'I make it', 'I wait for it', 1),
  ('Ideal partner', 'Calm and quiet', 'Loud and fun', 1),
  ('Rather get', 'Flowers', 'Food', 1),
  ('Long distance?', 'I could do it', 'Never', 1),
  ('Dating app bio', 'Short and sweet', 'Tell me everything', 1),
  ('Red flag', 'Bad texter', 'Rude to waiters', 1),
  ('Rather', 'Cuddle and movie', 'Night out dancing', 1),
  ('Couple style', 'Matching outfits', 'Never matching', 1),
  ('Jealous?', 'A little', 'Not at all', 1),
  ('Rather have a partner who', 'Cooks for you', 'Plans surprises', 1),
  ('Ex texts you', 'Reply', 'Leave on read', 1),
  ('Rather kiss', 'In the rain', 'Under the stars', 2),
  ('First kiss', 'First date', 'Wait a while', 2),
  ('Lights', 'On', 'Off', 2),
  ('Rather receive', 'A long massage', 'A slow dance', 2),
  ('Flirting style', 'Bold', 'Shy', 2),
  ('Rather be', 'The big spoon', 'The little spoon', 2),
  ('Sexy outfit', 'Dressed up', 'Dressed down', 2),
  ('Rather', 'Morning cuddles', 'Late night talks', 2),
  ('Turn on', 'A great voice', 'A great smile', 2),
  ('Rather', 'Slow burn', 'Instant spark', 3),
  ('Rather', 'Text something spicy', 'Say it face to face', 3),
  ('Rather', 'Plan the night', 'Be surprised', 3),
  ('Rather', 'Bedroom', 'Anywhere but the bedroom', 3),
  ('Rather', 'Take control', 'Be taken care of', 3)
on conflict (a, b) do nothing;

insert into public.truth_ideas (body) values
  ('I have been to…'),
  ('I can cook…'),
  ('I once met…'),
  ('My first job was…'),
  ('I am scared of…'),
  ('I have never…'),
  ('I can speak…'),
  ('As a kid I wanted to be…'),
  ('I once won…'),
  ('My hidden talent is…'),
  ('I have broken…'),
  ('I got lost in…'),
  ('My weirdest food is…'),
  ('I once cried at…'),
  ('My most used app is…'),
  ('I have a tattoo of…')
on conflict (body) do nothing;

-- Admin switches for each game (1 = on)
insert into public.app_settings (key, value) values
  ('game_truths', 1),
  ('game_tot', 1),
  ('game_c4', 1),
  ('game_words', 1)
on conflict (key) do nothing;

-- Game results show in the chat as a small card
alter table public.masquerade_messages add column if not exists media_meta jsonb;
alter table public.masquerade_messages drop constraint if exists masquerade_messages_kind_check;
alter table public.masquerade_messages add constraint masquerade_messages_kind_check check (kind in ('text', 'icebreaker', 'gift', 'system', 'game'));
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'image', 'video', 'audio', 'call', 'gift', 'game'));
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check check (
  char_length(body) <= 2000 and (
    (kind = 'text' and (char_length(body) >= 1 or deleted_at is not null))
    or (kind in ('image', 'video', 'audio') and (media_path is not null or deleted_at is not null))
    or kind in ('call', 'gift', 'game')
  )
);

-- Helpers --------------------------------------------------------------------
create or replace function public.game_title(k text) returns text
language sql immutable as $$
  select case k when 'truths' then 'Two Truths & a Lie' when 'tot' then 'This or That'
    when 'c4' then 'Connect 4' when 'words' then 'Word Hunt' else 'a game' end
$$;

-- A fresh Word Hunt board: 16 letters from classic letter dice
create or replace function public.game_words_board() returns text
language plpgsql volatile as $$
declare
  dice text[] := array['AAEEGN','ABBJOO','ACHOPS','AFFKPS','AOOTTW','CIMOTU','DEILRX','DELRVY',
                       'DISTTY','EEGHNW','EEINSU','EHRTVW','EIOSST','ELRTTY','HIMNEU','HLNNRZ'];
  d text;
  out text := '';
  vowels int;
begin
  loop
    out := '';
    for d in select x from unnest(dice) x order by random() loop
      out := out || substr(d, 1 + floor(random() * 6)::int, 1);
    end loop;
    vowels := length(out) - length(translate(out, 'AEIOU', ''));
    exit when vowels between 4 and 8;
  end loop;
  return out;
end $$;

-- Drop a disc in Connect 4. Board is 42 chars, top row first, 7 wide. Returns the row, or -1 when full.
create or replace function public.game_c4_drop(board text, col int, who text, out new_board text, out r int)
language plpgsql immutable as $$
begin
  new_board := board;
  r := -1;
  for rr in reverse 5..0 loop
    if substr(board, rr * 7 + col + 1, 1) = '.' then
      new_board := overlay(board placing who from rr * 7 + col + 1 for 1);
      r := rr;
      return;
    end if;
  end loop;
end $$;

-- The four (or more) in a row through a cell, as cell numbers, or empty
create or replace function public.game_c4_line(board text, r int, c int) returns int[]
language plpgsql immutable as $$
declare
  who text := substr(board, r * 7 + c + 1, 1);
  dirs int[] := array[0,1, 1,0, 1,1, 1,-1];
  dr int; dc int; i int; rr int; cc int;
  line int[];
begin
  for i in 0..3 loop
    dr := dirs[i * 2 + 1]; dc := dirs[i * 2 + 2];
    line := array[r * 7 + c];
    rr := r + dr; cc := c + dc;
    while rr between 0 and 5 and cc between 0 and 6 and substr(board, rr * 7 + cc + 1, 1) = who loop
      line := line || (rr * 7 + cc); rr := rr + dr; cc := cc + dc;
    end loop;
    rr := r - dr; cc := c - dc;
    while rr between 0 and 5 and cc between 0 and 6 and substr(board, rr * 7 + cc + 1, 1) = who loop
      line := line || (rr * 7 + cc); rr := rr - dr; cc := cc - dc;
    end loop;
    if array_length(line, 1) >= 4 then return line; end if;
  end loop;
  return '{}'::int[];
end $$;

-- Are both people in this chat, and is it open for games?
create or replace function public.game_chat_ok(uid uuid, p_session uuid, p_match uuid, out other uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  s masquerade_sessions;
  m matches;
begin
  other := null;
  if p_session is not null then
    select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
    if not found or s.hour_at is null or s.status <> 'active' or now() >= s.ends_at then return; end if;
    other := case when s.user_a = uid then s.user_b else s.user_a end;
  elsif p_match is not null then
    select * into m from matches where id = p_match and (user_a = uid or user_b = uid);
    if not found then return; end if;
    other := case when m.user_a = uid then m.user_b else m.user_a end;
  end if;
  if other is not null and public.is_blocked(uid, other) then other := null; end if;
end $$;

-- Post the result card in the chat and close the game
create or replace function public.game_finish(p_game uuid, p_reason text default null, p_by uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  meta jsonb;
  st text;
begin
  select * into g from games where id = p_game;
  if not found or g.status <> 'active' then return; end if;
  st := case when p_reason in ('left', 'timeout', 'closed') then 'cancelled' else 'done' end;
  if st = 'done' and g.winner is null and g.kind <> 'tot' then
    g.winner := case when g.score_a > g.score_b then g.player_a when g.score_b > g.score_a then g.player_b end;
  end if;
  update games set status = st, ended_at = now(), ended_reason = p_reason, ended_by = p_by,
    winner = g.winner, deadline_at = null
  where id = g.id;
  if p_reason = 'closed' then return; end if;
  meta := jsonb_build_object('game', g.id, 'kind', g.kind, 'a', g.player_a, 'b', g.player_b,
    'sa', g.score_a, 'sb', g.score_b, 'winner', g.winner, 'status', st, 'reason', p_reason, 'by', p_by);
  if g.session_id is not null then
    insert into masquerade_messages (session_id, sender_id, kind, body, media_meta)
    values (g.session_id, null, 'game', public.game_title(g.kind), meta);
  else
    insert into messages (match_id, sender_id, kind, body, media_meta)
    values (g.match_id, null, 'game', public.game_title(g.kind), meta);
    update matches set last_message_at = now() where id = g.match_id;
  end if;
end $$;

-- Set up the first step of a game once both are in
create or replace function public.game_begin(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  lvl int := 1;
  qs jsonb;
  t timestamptz := now() + interval '4 seconds'; -- 3, 2, 1 countdown
begin
  select * into g from games where id = p_game;
  if g.session_id is not null then
    select spice_level into lvl from masquerade_sessions where id = g.session_id;
  else
    select case when intent = 'spicy' then 3 when intent = 'dating' then 2 else 1 end into lvl from matches where id = g.match_id;
  end if;
  if g.kind = 'tot' then
    select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'q', q.prompt, 'a', q.a, 'b', q.b)), '[]'::jsonb) into qs
    from (select * from tot_questions where active and spice <= coalesce(lvl, 1) order by random() limit 10) q;
    update games set status = 'active', started_at = t, deadline_at = t + interval '8 seconds',
      state = jsonb_build_object('qs', qs, 'i', 0, 'picks', '[]'::jsonb, 'alike', 0)
    where id = g.id;
  elsif g.kind = 'truths' then
    update games set status = 'active', started_at = t, deadline_at = t + interval '90 seconds',
      state = jsonb_build_object('phase', 'write')
    where id = g.id;
  elsif g.kind = 'c4' then
    update games set status = 'active', started_at = t, deadline_at = t + interval '20 seconds',
      state = jsonb_build_object('board', repeat('.', 42), 'turn', 'a', 'round', 1, 'wins', jsonb_build_object('a', 0, 'b', 0),
        'starter', 'a', 'last', null, 'moves', 0, 'auto_a', 0, 'auto_b', 0)
    where id = g.id;
  else
    update games set status = 'active', started_at = t, deadline_at = t + interval '80 seconds',
      state = jsonb_build_object('board', public.game_words_board(), 'count_a', 0, 'count_b', 0)
    where id = g.id;
  end if;
  insert into game_secrets (game_id, user_id) values (g.id, g.player_a), (g.id, g.player_b) on conflict do nothing;
end $$;

-- Starting and answering a challenge ---------------------------------------------
create or replace function public.start_game(p_kind text, p_session uuid default null, p_match uuid default null, p_rematch uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  other uuid;
  live games;
  gid uuid;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if p_kind not in ('truths', 'tot', 'c4', 'words') then raise exception 'Unknown game'; end if;
  if public.setting_int('game_' || p_kind, 1) = 0 then raise exception 'This game is taking a break. Try another one.'; end if;
  other := public.game_chat_ok(uid, p_session, p_match);
  if other is null then raise exception 'Games are not available in this chat right now'; end if;

  -- Clear out a challenge that ran out
  update games set status = 'expired', ended_at = now()
  where status = 'invited' and deadline_at < now()
    and ((p_session is not null and session_id = p_session) or (p_match is not null and match_id = p_match));

  select * into live from games where status in ('invited', 'active')
    and ((p_session is not null and session_id = p_session) or (p_match is not null and match_id = p_match))
  limit 1;
  if found then
    -- They already challenged you to the same game: just accept it
    if live.status = 'invited' and live.player_b = uid and live.kind = p_kind then
      perform public.respond_game(live.id, true);
      return live.id;
    end if;
    raise exception 'Finish the game you’re in first';
  end if;

  if (select count(*) from games where player_a = uid and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Slow down a little';
  end if;

  insert into games (kind, session_id, match_id, player_a, player_b, deadline_at, rematch_of)
  values (p_kind, p_session, p_match, uid, other, now() + interval '30 seconds', p_rematch)
  returning id into gid;
  return gid;
end $$;

create or replace function public.respond_game(p_game uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
begin
  select * into g from games where id = p_game and player_b = uid for update;
  if not found then raise exception 'Game not found'; end if;
  if g.status <> 'invited' then return; end if;
  if g.deadline_at < now() - interval '2 seconds' then
    update games set status = 'expired', ended_at = now() where id = g.id;
    raise exception 'That challenge ran out';
  end if;
  if not p_accept then
    update games set status = 'declined', ended_at = now(), deadline_at = null where id = g.id;
    return;
  end if;
  if public.game_chat_ok(uid, g.session_id, g.match_id) is null then raise exception 'This chat has ended'; end if;
  perform public.game_begin(g.id);
end $$;

-- Leave a game (or take back a challenge)
create or replace function public.cancel_game(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid) for update;
  if not found then return; end if;
  if g.status = 'invited' then
    update games set status = case when uid = g.player_a then 'cancelled' else 'declined' end, ended_at = now(), deadline_at = null where id = g.id;
  elsif g.status = 'active' then
    update games set winner = case when uid = g.player_a then g.player_b else g.player_a end where id = g.id;
    perform public.game_finish(g.id, 'left', uid);
  end if;
end $$;

-- This or That ---------------------------------------------------------------------
-- Show the picks for the current question and move on
create or replace function public.game_tot_reveal(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  i int;
  pa text; pb text;
  same boolean;
  n int;
begin
  select * into g from games where id = p_game;
  i := (g.state->>'i')::int;
  select data->'picks'->>(i::text) into pa from game_secrets where game_id = g.id and user_id = g.player_a;
  select data->'picks'->>(i::text) into pb from game_secrets where game_id = g.id and user_id = g.player_b;
  same := pa is not null and pa = pb;
  n := jsonb_array_length(g.state->'qs');
  g.state := jsonb_set(g.state, '{picks}', (g.state->'picks') || jsonb_build_array(jsonb_build_array(pa, pb)));
  g.state := jsonb_set(g.state, '{i}', to_jsonb(i + 1));
  g.state := jsonb_set(g.state, '{reveal_until}', to_jsonb(now() + interval '2500 milliseconds'));
  if same then g.state := jsonb_set(g.state, '{alike}', to_jsonb((g.state->>'alike')::int + 1)); end if;
  update games set state = g.state,
    score_a = (g.state->>'alike')::int, score_b = (g.state->>'alike')::int,
    deadline_at = now() + interval '10500 milliseconds'
  where id = g.id;
  if i + 1 >= n then
    update games set deadline_at = null where id = g.id;
    perform public.game_finish(g.id);
  end if;
end $$;

create or replace function public.play_tot(p_game uuid, p_index int, p_pick text) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  other_pick text;
begin
  if p_pick not in ('a', 'b') then raise exception 'Pick this or that'; end if;
  select * into g from games where id = p_game and (player_a = uid or player_b = uid) and kind = 'tot' for update;
  if not found or g.status <> 'active' then return; end if;
  if (g.state->>'i')::int <> p_index or now() < g.started_at then return; end if;
  if now() < coalesce((g.state->>'reveal_until')::timestamptz, '-infinity') then return; end if;
  update game_secrets set data = jsonb_set(case when data ? 'picks' then data else data || '{"picks":{}}'::jsonb end, array['picks', p_index::text], to_jsonb(p_pick))
  where game_id = g.id and user_id = uid and not coalesce(data->'picks' ? p_index::text, false);
  select data->'picks'->>(p_index::text) into other_pick from game_secrets
  where game_id = g.id and user_id = case when uid = g.player_a then g.player_b else g.player_a end;
  if other_pick is not null then perform public.game_tot_reveal(g.id); end if;
end $$;

-- Two Truths and a Lie -------------------------------------------------------------
create or replace function public.submit_truths(p_game uuid, p_lines text[], p_lie int) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  me text;
  la jsonb; lb jsonb;
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid) and kind = 'truths' for update;
  if not found or g.status <> 'active' or g.state->>'phase' <> 'write' then return; end if;
  if coalesce(array_length(p_lines, 1), 0) <> 3 or p_lie not between 0 and 2 then raise exception 'Write three lines and pick the lie'; end if;
  if exists (select 1 from unnest(p_lines) l where char_length(btrim(l)) not between 2 and 120) then
    raise exception 'Each line needs a few words (up to 120 letters)';
  end if;
  me := case when uid = g.player_a then 'a' else 'b' end;
  update game_secrets set data = data || jsonb_build_object('lines', to_jsonb(array(select btrim(l) from unnest(p_lines) l)), 'lie', p_lie)
  where game_id = g.id and user_id = uid;
  g.state := jsonb_set(g.state, array['ready_' || me], 'true'::jsonb);
  update games set state = g.state where id = g.id;
  if (g.state->>'ready_a')::boolean is true and (g.state->>'ready_b')::boolean is true then
    select data->'lines' into la from game_secrets where game_id = g.id and user_id = g.player_a;
    select data->'lines' into lb from game_secrets where game_id = g.id and user_id = g.player_b;
    update games set state = state || jsonb_build_object('phase', 'guess', 'lines_a', la, 'lines_b', lb),
      deadline_at = now() + interval '45 seconds'
    where id = g.id;
  end if;
end $$;

create or replace function public.game_truths_reveal(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  lie_a int; lie_b int; ga int; gb int;
begin
  select * into g from games where id = p_game;
  select (data->>'lie')::int, (data->>'guess')::int into lie_a, ga from game_secrets where game_id = g.id and user_id = g.player_a;
  select (data->>'lie')::int, (data->>'guess')::int into lie_b, gb from game_secrets where game_id = g.id and user_id = g.player_b;
  -- a guesses b’s lie, b guesses a’s lie
  update games set
    score_a = case when ga = lie_b then 1 else 0 end,
    score_b = case when gb = lie_a then 1 else 0 end,
    state = state || jsonb_build_object('phase', 'reveal', 'lie_a', lie_a, 'lie_b', lie_b, 'guess_a', ga, 'guess_b', gb)
  where id = g.id;
  perform public.game_finish(g.id);
end $$;

create or replace function public.guess_truth(p_game uuid, p_index int) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  me text;
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid) and kind = 'truths' for update;
  if not found or g.status <> 'active' or g.state->>'phase' <> 'guess' then return; end if;
  if p_index not between 0 and 2 then return; end if;
  me := case when uid = g.player_a then 'a' else 'b' end;
  update game_secrets set data = data || jsonb_build_object('guess', p_index)
  where game_id = g.id and user_id = uid and not (data ? 'guess');
  update games set state = jsonb_set(state, array['guessed_' || me], 'true'::jsonb) where id = g.id returning * into g;
  if (g.state->>'guessed_a')::boolean is true and (g.state->>'guessed_b')::boolean is true then
    perform public.game_truths_reveal(g.id);
  end if;
end $$;

-- Connect 4 ------------------------------------------------------------------------
create or replace function public.game_c4_move(p_game uuid, p_col int, p_auto boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  st jsonb;
  who text;
  board text;
  r int;
  line int[];
  wins_a int; wins_b int;
  rnd int;
  starter text;
  over boolean := false;
  result text;
begin
  select * into g from games where id = p_game;
  st := g.state;
  who := st->>'turn';
  select new_board, d.r into board, r from public.game_c4_drop(st->>'board', p_col, who) d;
  if r < 0 then raise exception 'That column is full'; end if;
  st := st || jsonb_build_object('board', board, 'last', r * 7 + p_col, 'moves', (st->>'moves')::int + 1,
    'auto_' || who, case when p_auto then (st->>('auto_' || who))::int + 1 else 0 end);
  line := public.game_c4_line(board, r, p_col);
  wins_a := (st->'wins'->>'a')::int; wins_b := (st->'wins'->>'b')::int;
  rnd := (st->>'round')::int;

  if array_length(line, 1) >= 4 or position('.' in board) = 0 then
    result := case when array_length(line, 1) >= 4 then who else 'draw' end;
    if result = 'a' then wins_a := wins_a + 1; elsif result = 'b' then wins_b := wins_b + 1; end if;
    over := wins_a >= 2 or wins_b >= 2 or rnd >= 3;
    starter := case when st->>'starter' = 'a' then 'b' else 'a' end;
    -- Keep the finished board on show for a moment, then start the next round
    st := st || jsonb_build_object(
      'prev', jsonb_build_object('board', board, 'line', to_jsonb(line), 'winner', result, 'round', rnd),
      'wins', jsonb_build_object('a', wins_a, 'b', wins_b),
      'pause_until', now() + interval '3 seconds');
    if not over then
      st := st || jsonb_build_object('board', repeat('.', 42), 'round', rnd + 1, 'starter', starter, 'turn', starter, 'last', null, 'moves', 0);
    end if;
    update games set state = st, score_a = wins_a, score_b = wins_b,
      deadline_at = now() + interval '23 seconds'
    where id = g.id;
    if over then perform public.game_finish(g.id); end if;
    return;
  end if;

  st := st || jsonb_build_object('turn', case when who = 'a' then 'b' else 'a' end);
  update games set state = st, deadline_at = now() + interval '20 seconds' where id = g.id;
end $$;

create or replace function public.play_c4(p_game uuid, p_col int) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  me text;
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid) and kind = 'c4' for update;
  if not found or g.status <> 'active' then return; end if;
  if p_col not between 0 and 6 then raise exception 'Pick a column'; end if;
  me := case when uid = g.player_a then 'a' else 'b' end;
  if g.state->>'turn' <> me then raise exception 'Wait for your turn'; end if;
  if now() < g.started_at or now() < coalesce((g.state->>'pause_until')::timestamptz, '-infinity') then return; end if;
  perform public.game_c4_move(g.id, p_col, false);
end $$;

-- Word Hunt ------------------------------------------------------------------------
create or replace function public.word_points(n int) returns int
language sql immutable as $$
  select case when n <= 2 then 0 when n = 3 then 100 when n = 4 then 400 when n = 5 then 800 else 1400 + (n - 6) * 400 end
$$;

create or replace function public.submit_word(p_game uuid, p_word text, p_path int[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  w text := upper(btrim(p_word));
  board text;
  i int;
  pts int;
  me text;
  got jsonb;
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid) and kind = 'words' for update;
  if not found or g.status <> 'active' then raise exception 'Time is up'; end if;
  if now() < g.started_at or now() > g.deadline_at + interval '2 seconds' then raise exception 'Time is up'; end if;
  if w !~ '^[A-Z]{3,16}$' or coalesce(array_length(p_path, 1), 0) <> length(w) then raise exception 'Not a word'; end if;
  board := g.state->>'board';
  if (select count(distinct x) from unnest(p_path) x) <> length(w) then raise exception 'Use each letter once'; end if;
  for i in 1..length(w) loop
    if p_path[i] not between 0 and 15 or substr(board, p_path[i] + 1, 1) <> substr(w, i, 1) then raise exception 'Not on the board'; end if;
    if i > 1 and (abs(p_path[i] / 4 - p_path[i - 1] / 4) > 1 or abs(p_path[i] % 4 - p_path[i - 1] % 4) > 1) then
      raise exception 'Letters must touch';
    end if;
  end loop;
  select coalesce(data->'words', '[]'::jsonb) into got from game_secrets where game_id = g.id and user_id = uid;
  if got ? w then raise exception 'Already found'; end if;
  pts := public.word_points(length(w));
  update game_secrets set data = data || jsonb_build_object('words', got || to_jsonb(w)) where game_id = g.id and user_id = uid;
  me := case when uid = g.player_a then 'a' else 'b' end;
  update games set
    score_a = score_a + case when me = 'a' then pts else 0 end,
    score_b = score_b + case when me = 'b' then pts else 0 end,
    state = jsonb_set(state, array['count_' || me], to_jsonb(jsonb_array_length(got) + 1))
  where id = g.id;
  return pts;
end $$;

-- Timers: called by either player when a step runs out ------------------------------
create or replace function public.game_tick(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  who text;
  col int;
  free int[];
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid) for update;
  if not found then return; end if;
  if g.status = 'invited' and g.deadline_at < now() then
    update games set status = 'expired', ended_at = now(), deadline_at = null where id = g.id;
    return;
  end if;
  if g.status <> 'active' then return; end if;
  -- The chat closed (hour over, or someone let go)
  if public.game_chat_ok(uid, g.session_id, g.match_id) is null then
    perform public.game_finish(g.id, 'closed');
    return;
  end if;
  if g.deadline_at is null or now() < g.deadline_at then return; end if;

  if g.kind = 'tot' then
    perform public.game_tot_reveal(g.id);
  elsif g.kind = 'truths' then
    if g.state->>'phase' = 'write' then
      if (g.state->>'ready_a')::boolean is true or (g.state->>'ready_b')::boolean is true then
        -- Only one wrote theirs in time: they win
        update games set winner = case when (g.state->>'ready_a')::boolean is true then g.player_a else g.player_b end where id = g.id;
      end if;
      perform public.game_finish(g.id, 'timeout');
    else
      perform public.game_truths_reveal(g.id);
    end if;
  elsif g.kind = 'c4' then
    who := g.state->>'turn';
    -- Three missed turns in a row: that player loses
    if (g.state->>('auto_' || who))::int >= 2 then
      update games set winner = case when who = 'a' then g.player_b else g.player_a end where id = g.id;
      perform public.game_finish(g.id, 'timeout', case when who = 'a' then g.player_a else g.player_b end);
      return;
    end if;
    select array_agg(c) into free from generate_series(0, 6) c where substr(g.state->>'board', c + 1, 1) = '.';
    col := free[1 + floor(random() * array_length(free, 1))::int];
    perform public.game_c4_move(g.id, col, true);
  elsif g.kind = 'words' then
    if now() < g.deadline_at + interval '2 seconds' then return; end if;
    update games set state = state || jsonb_build_object(
      'words_a', (select coalesce(data->'words', '[]'::jsonb) from game_secrets where game_id = g.id and user_id = g.player_a),
      'words_b', (select coalesce(data->'words', '[]'::jsonb) from game_secrets where game_id = g.id and user_id = g.player_b))
    where id = g.id;
    perform public.game_finish(g.id);
  end if;
end $$;

-- What a player sees: the game, their own hidden parts, and your record in this chat
create or replace function public.get_game(p_game uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  mine jsonb;
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid);
  if not found then return null; end if;
  select data into mine from game_secrets where game_id = g.id and user_id = uid;
  return json_build_object(
    'id', g.id, 'kind', g.kind, 'session_id', g.session_id, 'match_id', g.match_id,
    'player_a', g.player_a, 'player_b', g.player_b, 'me', case when uid = g.player_a then 'a' else 'b' end,
    'status', g.status, 'state', g.state, 'score_a', g.score_a, 'score_b', g.score_b, 'winner', g.winner,
    'ended_by', g.ended_by, 'ended_reason', g.ended_reason,
    'deadline_at', g.deadline_at, 'started_at', g.started_at, 'ended_at', g.ended_at, 'created_at', g.created_at,
    'server_now', now(), 'mine', coalesce(mine, '{}'::jsonb),
    'record', (
      select json_build_object(
        'played', count(*),
        'won', count(*) filter (where x.winner = uid),
        'lost', count(*) filter (where x.winner is not null and x.winner <> uid),
        'alike', (select round(100.0 * y.score_a / greatest(1, jsonb_array_length(y.state->'qs'))) from games y
                  where y.kind = 'tot' and y.status = 'done'
                    and ((g.session_id is not null and y.session_id = g.session_id) or (g.match_id is not null and y.match_id = g.match_id))
                  order by y.ended_at desc limit 1))
      from games x where x.status = 'done'
        and ((g.session_id is not null and x.session_id = g.session_id) or (g.match_id is not null and x.match_id = g.match_id)))
  );
end $$;

-- The live (or just finished) game in a chat, if any
create or replace function public.chat_game(p_session uuid default null, p_match uuid default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  gid uuid;
begin
  select id into gid from games
  where (player_a = uid or player_b = uid)
    and ((p_session is not null and session_id = p_session) or (p_match is not null and match_id = p_match))
    and (status in ('invited', 'active') or ended_at > now() - interval '20 seconds')
  order by created_at desc limit 1;
  if gid is null then return null; end if;
  return public.get_game(gid);
end $$;

-- Close any game left running when a masked chat ends or the hour runs out
create or replace function public.games_close_with_chat() returns trigger
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if new.status <> old.status and new.status in ('matched', 'ended', 'lapsed') then
    update games set status = 'expired', ended_at = now(), deadline_at = null where session_id = new.id and status = 'invited';
    for gid in select id from games where session_id = new.id and status = 'active' loop
      perform public.game_finish(gid, 'closed');
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists games_close_with_chat on public.masquerade_sessions;
create trigger games_close_with_chat after update of status on public.masquerade_sessions
  for each row execute function public.games_close_with_chat();

-- Finishing a game counts as talking, and game cards move across when you unmask
create or replace function public.finalize_masquerade(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s masquerade_sessions;
  mid uuid;
  talked boolean;
begin
  select * into s from masquerade_sessions where id = p_session for update;
  if not found or s.status not in ('active', 'lapsed') then return; end if;

  if s.unmask_a is true and s.unmask_b is true then
    insert into matches (user_a, user_b, session_id, intent)
    values (least(s.user_a, s.user_b), greatest(s.user_a, s.user_b), s.id, s.intent)
    on conflict (user_a, user_b) do update set session_id = excluded.session_id
    returning id into mid;

    insert into messages (match_id, sender_id, kind, body, media_meta, created_at)
    select mid, sender_id,
      case when kind in ('gift', 'game') then kind else 'text' end,
      case when kind = 'icebreaker' then '💬 ' || body else body end,
      case when kind = 'gift' then jsonb_build_object('gift', body) when kind = 'game' then media_meta else null end,
      created_at
    from masquerade_messages where session_id = s.id and kind <> 'system' order by id;

    update masquerade_sessions set status = 'matched', match_id = mid where id = s.id;
    delete from masquerade_messages where session_id = s.id;
    return;
  end if;

  if s.unmask_a is false or s.unmask_b is false then
    update masquerade_sessions set status = 'ended', ended_reason = coalesce(ended_reason, 'declined') where id = s.id;
    delete from masquerade_messages where session_id = s.id;
    return;
  end if;

  -- Hourly pairs: when the hour is over
  if s.hour_at is not null then
    if s.status = 'active' and now() >= s.ends_at then
      talked := (exists (select 1 from masquerade_messages m where m.session_id = s.id and m.kind in ('text', 'gift') and m.sender_id = s.user_a)
             and exists (select 1 from masquerade_messages m where m.session_id = s.id and m.kind in ('text', 'gift') and m.sender_id = s.user_b))
             or exists (select 1 from games g where g.session_id = s.id and g.status = 'done');
      if talked then
        update masquerade_sessions set status = 'lapsed' where id = s.id;
      else
        update masquerade_sessions set status = 'ended', ended_reason = 'quiet' where id = s.id;
        delete from masquerade_messages where session_id = s.id;
      end if;
    end if;
    return;
  end if;

  -- Event rounds: time ran out without both deciding
  if now() > s.ends_at + interval '90 seconds' then
    update masquerade_sessions set status = 'ended', ended_reason = coalesce(ended_reason, 'timeout') where id = s.id;
    delete from masquerade_messages where session_id = s.id;
  end if;
end $$;

-- Admin: game numbers for the last N days
create or replace function public.admin_game_stats(p_days int default 7) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'kinds', coalesce((select json_agg(row_to_json(t) order by t.kind) from (
      select kind,
        count(*) as challenges,
        count(*) filter (where status in ('active', 'done', 'cancelled') and started_at is not null) as started,
        count(*) filter (where status = 'done') as finished,
        count(*) filter (where status = 'declined') as declined,
        count(*) filter (where status = 'expired') as expired,
        count(*) filter (where rematch_of is not null) as rematches,
        count(*) filter (where match_id is not null) as in_people_chats
      from games where created_at > now() - make_interval(days => p_days)
      group by kind) t), '[]'::json),
    'pairs_with_games', (select count(distinct session_id) from games where status = 'done' and session_id is not null and created_at > now() - make_interval(days => p_days)),
    'pairs_with_games_unmasked', (select count(distinct g.session_id) from games g join masquerade_sessions s on s.id = g.session_id
        where g.status = 'done' and s.status = 'matched' and g.created_at > now() - make_interval(days => p_days)),
    'pairs_total', (select count(*) from masquerade_sessions where hour_at is not null and started_at > now() - make_interval(days => p_days)),
    'pairs_unmasked', (select count(*) from masquerade_sessions where hour_at is not null and status = 'matched' and started_at > now() - make_interval(days => p_days))
  )
$$;

revoke all on function public.admin_game_stats(int) from public, anon, authenticated;
revoke all on function public.game_finish(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.game_begin(uuid) from public, anon, authenticated;
revoke all on function public.game_tot_reveal(uuid) from public, anon, authenticated;
revoke all on function public.game_truths_reveal(uuid) from public, anon, authenticated;
revoke all on function public.game_c4_move(uuid, int, boolean) from public, anon, authenticated;
revoke all on function public.game_chat_ok(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.games_close_with_chat() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Part 23: Game result cards in chats show the answers
-- Two Truths: everyone’s three lines, the lies and the guesses.
-- This or That: every question with both picks.
-- ---------------------------------------------------------------------------
create or replace function public.game_detail(g games) returns jsonb
language sql stable as $$
  select case g.kind
    when 'truths' then jsonb_strip_nulls(jsonb_build_object(
      'lines_a', g.state->'lines_a', 'lines_b', g.state->'lines_b',
      'lie_a', g.state->'lie_a', 'lie_b', g.state->'lie_b',
      'guess_a', g.state->'guess_a', 'guess_b', g.state->'guess_b'))
    when 'tot' then jsonb_build_object(
      'qs', coalesce((select jsonb_agg(jsonb_build_object('q', q->>'q', 'a', q->>'a', 'b', q->>'b')) from jsonb_array_elements(g.state->'qs') q), '[]'::jsonb),
      'picks', coalesce(g.state->'picks', '[]'::jsonb))
    else null end
$$;

create or replace function public.game_finish(p_game uuid, p_reason text default null, p_by uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  meta jsonb;
  st text;
begin
  select * into g from games where id = p_game;
  if not found or g.status <> 'active' then return; end if;
  st := case when p_reason in ('left', 'timeout', 'closed') then 'cancelled' else 'done' end;
  if st = 'done' and g.winner is null and g.kind <> 'tot' then
    g.winner := case when g.score_a > g.score_b then g.player_a when g.score_b > g.score_a then g.player_b end;
  end if;
  update games set status = st, ended_at = now(), ended_reason = p_reason, ended_by = p_by,
    winner = g.winner, deadline_at = null
  where id = g.id;
  if p_reason = 'closed' then return; end if;
  meta := jsonb_build_object('game', g.id, 'kind', g.kind, 'a', g.player_a, 'b', g.player_b,
    'sa', g.score_a, 'sb', g.score_b, 'winner', g.winner, 'status', st, 'reason', p_reason, 'by', p_by);
  if st = 'done' and public.game_detail(g) is not null then
    meta := meta || jsonb_build_object('detail', public.game_detail(g));
  end if;
  if g.session_id is not null then
    insert into masquerade_messages (session_id, sender_id, kind, body, media_meta)
    values (g.session_id, null, 'game', public.game_title(g.kind), meta);
  else
    insert into messages (match_id, sender_id, kind, body, media_meta)
    values (g.match_id, null, 'game', public.game_title(g.kind), meta);
    update matches set last_message_at = now() where id = g.match_id;
  end if;
end $$;
revoke all on function public.game_finish(uuid, text, uuid) from public, anon, authenticated;

-- Add the answers to cards from games already played
update public.masquerade_messages m set media_meta = m.media_meta || jsonb_build_object('detail', public.game_detail(g))
from public.games g
where m.kind = 'game' and g.id = (m.media_meta->>'game')::uuid and g.status = 'done'
  and g.kind in ('truths', 'tot') and not (m.media_meta ? 'detail');
update public.messages m set media_meta = m.media_meta || jsonb_build_object('detail', public.game_detail(g))
from public.games g
where m.kind = 'game' and g.id = (m.media_meta->>'game')::uuid and g.status = 'done'
  and g.kind in ('truths', 'tot') and not (m.media_meta ? 'detail');

-- ---------------------------------------------------------------------------
-- Part 24: Meets
-- Post a game challenge or a line of text for a few hours (3 by default).
-- People whose Masquerade settings fit yours (and yours fit theirs) see it and
-- tap Meet: a masked chat opens with you, the same as an hourly pair.
-- Game meets: people wait their turn and play you one at a time.
-- Your first post is free, then it costs Keys (both set in admin). No refunds.
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value) values
  ('meet_cost', 10),
  ('meet_free_posts', 1),
  ('meet_hours', 3)
on conflict (key) do nothing;

create table if not exists public.meet_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('game', 'text')),
  game text check (game in ('truths', 'tot', 'c4', 'words')),
  body text not null default '' check (char_length(body) <= 140),
  alias text not null,
  paid int not null default 0,
  created_at timestamptz not null default now(),
  ends_at timestamptz not null,
  closed_at timestamptz,
  check ((kind = 'game') = (game is not null)),
  check (kind = 'game' or char_length(btrim(body)) > 0)
);
create index if not exists meet_posts_live on public.meet_posts (ends_at);
create index if not exists meet_posts_user on public.meet_posts (user_id, created_at desc);
alter table public.meet_posts enable row level security;
drop policy if exists "read own meets" on public.meet_posts;
create policy "read own meets" on public.meet_posts for select using (user_id = auth.uid());

-- A masked chat opened from a meet (user_a is the person who posted it)
alter table public.masquerade_sessions add column if not exists meet_id uuid references public.meet_posts on delete set null;
create index if not exists masquerade_sessions_meet on public.masquerade_sessions (meet_id);
create unique index if not exists masquerade_sessions_meet_once on public.masquerade_sessions (meet_id, user_b) where meet_id is not null;

-- The post itself sits at the top of the chat
alter table public.masquerade_messages drop constraint if exists masquerade_messages_kind_check;
alter table public.masquerade_messages add constraint masquerade_messages_kind_check check (kind in ('text', 'icebreaker', 'gift', 'system', 'game', 'meet'));

-- Your settings fit theirs and theirs fit yours
create or replace function public.meet_fits(v uuid, o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select v <> o and exists (
    select 1 from profiles a, profiles b
    where a.id = v and b.id = o
      and a.gender is not null and b.gender is not null and a.birthdate is not null and b.birthdate is not null
      and a.pref_intent = b.pref_intent
      and public.gender_fits(a.pref_seeking, b.gender) and public.gender_fits(b.pref_seeking, a.gender)
      and public.age_years(b.birthdate) between a.pref_age_min and a.pref_age_max
      and public.age_years(a.birthdate) between b.pref_age_min and b.pref_age_max)
    and not public.is_blocked(v, o)
    and not public.already_matched(v, o)
$$;

-- Event rounds are the only chats that keep you busy (hourly pairs and meets run alongside)
create or replace function public.my_active_session(uid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from masquerade_sessions
  where status = 'active' and (user_a = uid or user_b = uid) and hour_at is null and meet_id is null
  order by started_at desc limit 1
$$;

-- Meet chats end like hourly pairs: when the meet is over, a chat you both talked in is kept to decide later
create or replace function public.finalize_masquerade(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s masquerade_sessions;
  mid uuid;
  talked boolean;
begin
  select * into s from masquerade_sessions where id = p_session for update;
  if not found or s.status not in ('active', 'lapsed') then return; end if;

  if s.unmask_a is true and s.unmask_b is true then
    insert into matches (user_a, user_b, session_id, intent)
    values (least(s.user_a, s.user_b), greatest(s.user_a, s.user_b), s.id, s.intent)
    on conflict (user_a, user_b) do update set session_id = excluded.session_id
    returning id into mid;

    insert into messages (match_id, sender_id, kind, body, media_meta, created_at)
    select mid, sender_id,
      case when kind in ('gift', 'game') then kind else 'text' end,
      case when kind in ('icebreaker', 'meet') then '💬 ' || body else body end,
      case when kind = 'gift' then jsonb_build_object('gift', body) when kind = 'game' then media_meta else null end,
      created_at
    from masquerade_messages where session_id = s.id and kind <> 'system' order by id;

    update masquerade_sessions set status = 'matched', match_id = mid where id = s.id;
    delete from masquerade_messages where session_id = s.id;
    return;
  end if;

  if s.unmask_a is false or s.unmask_b is false then
    update masquerade_sessions set status = 'ended', ended_reason = coalesce(ended_reason, 'declined') where id = s.id;
    delete from masquerade_messages where session_id = s.id;
    return;
  end if;

  -- Hourly pairs and meet chats: when the time is over
  if s.hour_at is not null or s.meet_id is not null then
    if s.status = 'active' and now() >= s.ends_at then
      talked := (exists (select 1 from masquerade_messages m where m.session_id = s.id and m.kind in ('text', 'gift') and m.sender_id = s.user_a)
             and exists (select 1 from masquerade_messages m where m.session_id = s.id and m.kind in ('text', 'gift') and m.sender_id = s.user_b))
             or exists (select 1 from games g where g.session_id = s.id and g.status = 'done');
      if talked then
        update masquerade_sessions set status = 'lapsed' where id = s.id;
      else
        update masquerade_sessions set status = 'ended', ended_reason = 'quiet' where id = s.id;
        delete from masquerade_messages where session_id = s.id;
      end if;
    end if;
    return;
  end if;

  -- Event rounds: time ran out without both deciding
  if now() > s.ends_at + interval '90 seconds' then
    update masquerade_sessions set status = 'ended', ended_reason = coalesce(ended_reason, 'timeout') where id = s.id;
    delete from masquerade_messages where session_id = s.id;
  end if;
end $$;

-- Unmask or let go. Hourly pairs and meet chats can decide any time.
create or replace function public.vote_unmask(p_session uuid, p_unmask boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then raise exception 'Chat not found'; end if;
  if s.status not in ('active', 'lapsed') then return; end if;
  if p_unmask and s.hour_at is null and s.meet_id is null and now() < s.ends_at - interval '2 seconds' then
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

-- Games are allowed in meet chats too
create or replace function public.game_chat_ok(uid uuid, p_session uuid, p_match uuid, out other uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  s masquerade_sessions;
  m matches;
begin
  other := null;
  if p_session is not null then
    select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
    if not found or (s.hour_at is null and s.meet_id is null) or s.status <> 'active' or now() >= s.ends_at then return; end if;
    other := case when s.user_a = uid then s.user_b else s.user_a end;
  elsif p_match is not null then
    select * into m from matches where id = p_match and (user_a = uid or user_b = uid);
    if not found then return; end if;
    other := case when m.user_a = uid then m.user_b else m.user_a end;
  end if;
  if other is not null and public.is_blocked(uid, other) then other := null; end if;
end $$;
revoke all on function public.game_chat_ok(uuid, uuid, uuid) from public, anon, authenticated;

-- Is this a game meet chat whose turn in line hasn't been played yet?
create or replace function public.meet_turn_pending(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from masquerade_sessions s join meet_posts m on m.id = s.meet_id
    where s.id = p_session and m.kind = 'game'
      and not exists (select 1 from games g where g.session_id = s.id and g.started_at is not null))
$$;

-- Starting a game in a chat. In a game meet, the first game comes from the line.
create or replace function public.start_game(p_kind text, p_session uuid default null, p_match uuid default null, p_rematch uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  other uuid;
  live games;
  gid uuid;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if p_kind not in ('truths', 'tot', 'c4', 'words') then raise exception 'Unknown game'; end if;
  if public.setting_int('game_' || p_kind, 1) = 0 then raise exception 'This game is taking a break. Try another one.'; end if;
  other := public.game_chat_ok(uid, p_session, p_match);
  if other is null then raise exception 'Games are not available in this chat right now'; end if;

  -- Clear out a challenge that ran out
  update games set status = 'expired', ended_at = now()
  where status = 'invited' and deadline_at < now()
    and ((p_session is not null and session_id = p_session) or (p_match is not null and match_id = p_match));

  select * into live from games where status in ('invited', 'active')
    and ((p_session is not null and session_id = p_session) or (p_match is not null and match_id = p_match))
  limit 1;
  if found then
    -- They already challenged you to the same game: just accept it
    if live.status = 'invited' and live.player_b = uid and live.kind = p_kind then
      perform public.respond_game(live.id, true);
      return live.id;
    end if;
    raise exception 'Finish the game you’re in first';
  end if;

  if p_session is not null and public.meet_turn_pending(p_session) then
    raise exception 'Your game starts when it’s your turn. Chat while you wait.';
  end if;

  if (select count(*) from games where player_a = uid and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Slow down a little';
  end if;

  insert into games (kind, session_id, match_id, player_a, player_b, deadline_at, rematch_of)
  values (p_kind, p_session, p_match, uid, other, now() + interval '30 seconds', p_rematch)
  returning id into gid;
  return gid;
end $$;

-- Game meets: when the person who posted is free, the next person in line challenges them.
-- People who have waited longest go first; someone whose turn ran out goes to the back.
create or replace function public.meet_queue_next(p_meet uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m meet_posts;
  nxt masquerade_sessions;
begin
  perform pg_advisory_xact_lock(hashtext('meet:' || p_meet::text));
  select * into m from meet_posts where id = p_meet;
  if not found or m.kind <> 'game' then return; end if;

  update games g set status = 'expired', ended_at = now(), deadline_at = null
  from masquerade_sessions s
  where s.id = g.session_id and s.meet_id = p_meet and g.status = 'invited' and g.deadline_at < now();

  if exists (select 1 from games g join masquerade_sessions s on s.id = g.session_id
             where s.meet_id = p_meet and g.status in ('invited', 'active')) then
    return;
  end if;

  select s.* into nxt from masquerade_sessions s
  where s.meet_id = p_meet and s.status = 'active' and now() < s.ends_at
    and not public.is_blocked(s.user_a, s.user_b)
    and not exists (select 1 from games g where g.session_id = s.id
                    and (g.started_at is not null or g.status in ('declined', 'cancelled', 'invited', 'active')))
  order by (select max(g.created_at) from games g where g.session_id = s.id) nulls first, s.started_at
  limit 1;
  if not found then return; end if;

  insert into games (kind, session_id, player_a, player_b, deadline_at)
  values (m.game, nxt.id, nxt.user_b, m.user_id, now() + interval '60 seconds');
end $$;
revoke all on function public.meet_queue_next(uuid) from public, anon, authenticated;

-- Move the line along when a game ends or a meet chat closes
create or replace function public.meet_games_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.status = old.status or new.status in ('invited', 'active') or new.session_id is null then return new; end if;
  select meet_id into mid from masquerade_sessions where id = new.session_id;
  if mid is not null then perform public.meet_queue_next(mid); end if;
  return new;
end $$;
drop trigger if exists meet_games_changed on public.games;
create trigger meet_games_changed after update of status on public.games
  for each row execute function public.meet_games_changed();

create or replace function public.meet_session_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.meet_id is not null and new.status <> old.status and old.status = 'active' then
    perform public.meet_queue_next(new.meet_id);
  end if;
  return new;
end $$;
drop trigger if exists meet_session_changed on public.masquerade_sessions;
create trigger meet_session_changed after update of status on public.masquerade_sessions
  for each row execute function public.meet_session_changed();
revoke all on function public.meet_games_changed() from public, anon, authenticated;
revoke all on function public.meet_session_changed() from public, anon, authenticated;

-- Close meet chats whose time is up
create or replace function public.meet_close_expired(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from masquerade_sessions
           where meet_id is not null and status = 'active' and reopened_at is null and ends_at <= now()
             and (user_a = uid or user_b = uid) loop
    perform public.finalize_masquerade(r.id);
  end loop;
end $$;
revoke all on function public.meet_close_expired(uuid) from public, anon, authenticated;

-- What one meet looks like to you
create or replace function public.meet_json(m meet_posts, uid uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', m.id, 'kind', m.kind, 'game', m.game, 'body', m.body, 'alias', m.alias,
    'created_at', m.created_at, 'ends_at', m.ends_at, 'mine', m.user_id = uid,
    'age', public.age_years(p.birthdate), 'gender', p.gender,
    'session_id', (select s.id from masquerade_sessions s where s.meet_id = m.id and s.user_b = uid),
    'people', (select count(*) from masquerade_sessions s where s.meet_id = m.id),
    'waiting', case when m.kind = 'game' and m.user_id = uid then (
      select count(*) from masquerade_sessions s where s.meet_id = m.id and s.status = 'active' and now() < s.ends_at
        and not exists (select 1 from games g where g.session_id = s.id and g.started_at is not null)) end)
  from profiles p where p.id = m.user_id
$$;
revoke all on function public.meet_json(meet_posts, uuid) from public, anon, authenticated;

-- Meets for you: your own live one, and other people's that fit you (closest first)
create or replace function public.list_meets(p_limit int default 30) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  mine meet_posts;
begin
  if uid is null then raise exception 'Please log in'; end if;
  perform public.meet_close_expired(uid);
  select * into me from profiles where id = uid;
  select * into mine from meet_posts where user_id = uid and closed_at is null and ends_at > now()
  order by created_at desc limit 1;

  return json_build_object(
    'server_now', now(),
    'cost', case when (select count(*) from meet_posts where user_id = uid) < public.setting_int('meet_free_posts', 1)
                 then 0 else public.setting_int('meet_cost', 10) end,
    'hours', public.setting_int('meet_hours', 3),
    'mine', case when mine.id is null then null else public.meet_json(mine, uid) end,
    'posts', coalesce((
      select json_agg(public.meet_json(t.mp, uid) order by t.o1 desc nulls last, t.o2 desc nulls last, t.o3 desc nulls last, (t.mp).created_at desc)
      from (
        select m as mp,
          (p.place_country = me.place_country and p.place_region = me.place_region) as o1,
          (p.place_country = me.place_country) as o2,
          (p.place_continent = me.place_continent) as o3
        from meet_posts m
        join profiles p on p.id = m.user_id
        left join accounts_private a on a.user_id = m.user_id
        where m.closed_at is null and m.ends_at > now() and m.user_id <> uid
          and a.banned_at is null
          and public.meet_fits(uid, m.user_id)
        order by o1 desc nulls last, o2 desc nulls last, o3 desc nulls last, m.created_at desc
        limit greatest(1, least(p_limit, 50))
      ) t), '[]'::json)
  );
end $$;

-- Post a meet. Your first ones are free (set in admin), then it costs Keys.
create or replace function public.post_meet(p_kind text, p_game text default null, p_body text default '') returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  b text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  cost int := 0;
  bal int;
  mid uuid;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into me from profiles where id = uid;
  if me.display_name is null or me.birthdate is null or me.gender is null then
    raise exception 'Finish your profile first';
  end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  if p_kind not in ('game', 'text') then raise exception 'Pick a game or write a post'; end if;
  if p_kind = 'game' then
    if p_game is null or p_game not in ('truths', 'tot', 'c4', 'words') then raise exception 'Pick a game'; end if;
    if public.setting_int('game_' || p_game, 1) = 0 then raise exception 'This game is taking a break. Try another one.'; end if;
    if char_length(b) > 80 then raise exception 'Keep your line under 80 characters'; end if;
  else
    p_game := null;
    if char_length(b) = 0 then raise exception 'Write something first'; end if;
    if char_length(b) > 140 then raise exception 'Keep it under 140 characters'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('meet-post:' || uid::text));
  if exists (select 1 from meet_posts where user_id = uid and closed_at is null and ends_at > now()) then
    raise exception 'You already have a meet up';
  end if;

  if (select count(*) from meet_posts where user_id = uid) >= public.setting_int('meet_free_posts', 1) then
    cost := public.setting_int('meet_cost', 10);
  end if;

  insert into meet_posts (user_id, kind, game, body, alias, paid, ends_at)
  values (uid, p_kind, p_game, b, public.random_alias(), cost,
          now() + make_interval(hours => greatest(1, least(public.setting_int('meet_hours', 3), 48))))
  returning id into mid;

  if cost > 0 then
    bal := public.spend_keys(uid, cost, 'meet', mid::text);
  else
    select balance into bal from wallets where user_id = uid;
  end if;
  return json_build_object('id', mid, 'cost', cost, 'balance', coalesce(bal, 0));
end $$;

-- Take your meet down early (no refund)
create or replace function public.close_meet(p_meet uuid) returns void
language sql security definer set search_path = public as $$
  update meet_posts set closed_at = now() where id = p_meet and user_id = auth.uid() and closed_at is null
$$;

-- Tap Meet: open a masked chat with the person who posted it
create or replace function public.join_meet(p_meet uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m meet_posts;
  op profiles;
  me profiles;
  sid uuid;
  lvl smallint;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into m from meet_posts where id = p_meet for update;
  if not found then raise exception 'This meet is gone'; end if;
  select id into sid from masquerade_sessions where meet_id = m.id and user_b = uid;
  if sid is not null then return sid; end if;
  if m.closed_at is not null or m.ends_at <= now() then raise exception 'This meet has ended'; end if;
  if m.user_id = uid then raise exception 'This is your own meet'; end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  if not public.meet_fits(uid, m.user_id) then raise exception 'This meet isn’t open to you'; end if;
  if (select count(*) from masquerade_sessions where user_b = uid and meet_id is not null and started_at > now() - interval '1 minute') >= 6 then
    raise exception 'Slow down a little';
  end if;

  select * into op from profiles where id = m.user_id;
  select * into me from profiles where id = uid;
  lvl := round((op.pref_spice + me.pref_spice) / 2.0)::smallint;
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, meet_id)
  values (m.user_id, uid, op.pref_intent, op.pref_spice, me.pref_spice, lvl, m.alias, public.random_alias(m.alias), now(), m.ends_at, m.id)
  returning id into sid;
  insert into masquerade_messages (session_id, kind, body, media_meta)
  values (sid, 'meet', case when m.body = '' then public.game_title(m.game) else m.body end,
          jsonb_build_object('kind', m.kind, 'game', m.game, 'alias', m.alias));
  if m.kind = 'game' then perform public.meet_queue_next(m.id); end if;
  return sid;
end $$;

-- Your meet chats (as the one who posted or the one who joined), newest first
create or replace function public.my_meet_chats() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return '[]'::json; end if;
  perform public.meet_close_expired(uid);
  return coalesce((
    select json_agg(row_to_json(t) order by t.sort_at desc) from (
      select s.id, s.status, s.ends_at, (s.user_a = uid) as mine, m.kind, m.game, m.body as post,
        case when s.user_a = uid then s.alias_b else s.alias_a end as their_alias,
        case when s.user_a = uid then s.unmask_a else s.unmask_b end as my_vote,
        (select g.status from games g where g.session_id = s.id and g.status in ('invited', 'active') limit 1) as game_status,
        (m.kind = 'game' and not exists (select 1 from games g where g.session_id = s.id and g.started_at is not null)) as in_line,
        (select body from masquerade_messages x where x.session_id = s.id and x.kind = 'text' order by x.id desc limit 1) as last_message,
        coalesce((select max(x.created_at) from masquerade_messages x where x.session_id = s.id), s.started_at) as sort_at
      from masquerade_sessions s
      join meet_posts m on m.id = s.meet_id
      where (s.user_a = uid or s.user_b = uid)
        and (s.status = 'active' or (s.status = 'lapsed' and s.ends_at > now() - interval '24 hours'))
        and not public.is_blocked(s.user_a, s.user_b)
      order by sort_at desc
      limit 40
    ) t), '[]'::json);
end $$;

-- The masked chat, now with what you need to know about its meet
create or replace function public.get_masquerade(p_session uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
  other uuid;
  op profiles;
  mp profiles;
  i_am_a boolean;
  m meet_posts;
  pair boolean;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then return null; end if;
  pair := s.hour_at is not null or s.meet_id is not null;
  if s.status = 'active' and (
       (pair and now() >= s.ends_at)
       or (not pair and now() > s.ends_at + interval '90 seconds')) then
    perform public.finalize_masquerade(p_session);
    select * into s from masquerade_sessions where id = p_session;
  end if;
  if s.meet_id is not null then
    select * into m from meet_posts where id = s.meet_id;
    if m.kind = 'game' and s.status = 'active' then perform public.meet_queue_next(m.id); end if;
  end if;

  i_am_a := s.user_a = uid;
  other := case when i_am_a then s.user_b else s.user_a end;
  select * into op from profiles where id = other;
  select * into mp from profiles where id = uid;

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
    'hourly', pair,
    'reopened', s.reopened_at is not null,
    'meet', case when m.id is null then null else json_build_object(
      'id', m.id, 'kind', m.kind, 'game', m.game, 'mine', i_am_a,
      'turn_pending', public.meet_turn_pending(s.id),
      -- People ahead of you in line (people waiting, if it's yours)
      'ahead', case when m.kind = 'game' then (
        select count(*) from masquerade_sessions x
        where x.meet_id = m.id and x.status = 'active' and now() < x.ends_at
          and not exists (select 1 from games g where g.session_id = x.id and g.started_at is not null)
          and (i_am_a or x.started_at < s.started_at)) end,
      -- Where your game in this meet is happening right now (if it's in another chat)
      'live_chat', case when i_am_a and m.kind = 'game' then (
        select json_build_object('id', x.id, 'alias', x.alias_b, 'status', g.status)
        from games g join masquerade_sessions x on x.id = g.session_id
        where x.meet_id = m.id and x.id <> s.id and g.status in ('invited', 'active')
        limit 1) end) end,
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
      'distance_km', null,
      'place', op.place_label,
      'same_place', op.place_country = mp.place_country and op.place_region = mp.place_region,
      'connections', (select count(*) from matches x where op.id in (x.user_a, x.user_b)),
      'reply_seconds', public.reply_seconds(op.id),
      'has_voted', (case when i_am_a then s.unmask_b else s.unmask_a end) is not null,
      -- Only revealed after you both unmask
      'profile', case when s.status = 'matched' then json_build_object(
        'id', op.id, 'display_name', op.display_name, 'bio', op.bio, 'photos', op.photos
      ) else null end
    )
  );
end $$;

-- ---------------------------------------------------------------------------
-- Part 25: Explore, games without timers, saved truths, daily prompts off
-- ---------------------------------------------------------------------------
-- Explore (the Meet page): people like you in a grid, and a search to find anyone by name.
-- You see someone's main photo. Their other photos unlock with Keys (free once you're connected).
-- Messaging someone you're not connected to costs Keys and opens a chat with them.
insert into public.app_settings (key, value) values
  ('explore_message_cost', 15),
  ('explore_photos_cost', 5)
on conflict (key) do nothing;

create table if not exists public.photo_unlocks (
  viewer uuid not null references public.profiles on delete cascade,
  target uuid not null references public.profiles on delete cascade,
  paid int not null default 0,
  created_at timestamptz not null default now(),
  primary key (viewer, target)
);
alter table public.photo_unlocks enable row level security;
drop policy if exists "read own unlocks" on public.photo_unlocks;
create policy "read own unlocks" on public.photo_unlocks for select using (viewer = auth.uid());

-- Who started a chat from Explore (empty for chats that came from unmasking)
alter table public.matches add column if not exists opened_by uuid references public.profiles on delete set null;
alter table public.matches add column if not exists source text;

-- Someone you can see in Explore at all
create or replace function public.explore_visible(v uuid, o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select v <> o and exists (
    select 1 from profiles p left join accounts_private a on a.user_id = p.id
    where p.id = o and p.display_name is not null and p.birthdate is not null and p.gender is not null
      and cardinality(p.photos) > 0 and a.banned_at is null)
    and not public.is_blocked(v, o)
$$;

-- Your settings fit theirs and theirs fit yours (being connected doesn't hide them here)
create or replace function public.explore_fits(v uuid, o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles a, profiles b
    where a.id = v and b.id = o
      and a.gender is not null and b.gender is not null and a.birthdate is not null and b.birthdate is not null
      and a.pref_intent = b.pref_intent
      and public.gender_fits(a.pref_seeking, b.gender) and public.gender_fits(b.pref_seeking, a.gender)
      and public.age_years(b.birthdate) between a.pref_age_min and a.pref_age_max
      and public.age_years(a.birthdate) between b.pref_age_min and b.pref_age_max)
$$;

create or replace function public.explore_match_id(v uuid, o uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from matches where user_a = least(v, o) and user_b = greatest(v, o)
$$;

-- The grid: people like you (closest and most recently around first), or everyone whose name matches your search
create or replace function public.explore_people(p_q text default null, p_limit int default 60, p_offset int default 0) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into me from profiles where id = uid;
  return json_build_object(
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    'people', coalesce((
      select json_agg(row_to_json(t)) from (
        select p.id, p.display_name as name, public.age_years(p.birthdate) as age, p.gender, p.photos[1] as photo,
          p.place_label as place, p.pref_intent as intent,
          (p.last_seen_at > now() - interval '5 minutes') as online,
          public.explore_match_id(uid, p.id) is not null as connected
        from profiles p
        where public.explore_visible(uid, p.id)
          and (case when q is not null then p.display_name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%'
                    else p.last_seen_at > now() - interval '30 days' and public.explore_fits(uid, p.id) end)
        order by
          (q is not null and lower(p.display_name) = lower(q)) desc,
          (p.last_seen_at > now() - interval '5 minutes') desc,
          (p.place_country = me.place_country and p.place_region = me.place_region) desc nulls last,
          (p.place_country = me.place_country) desc nulls last,
          public.shared_count(me.interests, p.interests) desc,
          p.last_seen_at desc
        limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
      ) t), '[]'::json)
  );
end $$;

-- One person's profile as you may see it
create or replace function public.explore_profile(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  mid uuid;
  open boolean;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if not public.explore_visible(uid, p_id) then return null; end if;
  select * into p from profiles where id = p_id;
  mid := public.explore_match_id(uid, p_id);
  open := mid is not null or exists (select 1 from photo_unlocks where viewer = uid and target = p_id);
  return json_build_object(
    'id', p.id, 'name', p.display_name, 'age', public.age_years(p.birthdate), 'gender', p.gender,
    'bio', p.bio, 'interests', p.interests, 'place', p.place_label, 'intent', p.pref_intent,
    'online', p.last_seen_at > now() - interval '5 minutes',
    'photos', case when open then to_json(p.photos) else to_json(array[p.photos[1]]) end,
    'photo_count', cardinality(p.photos),
    'photos_unlocked', open,
    'match_id', mid,
    'shared_interests', array(select unnest(p.interests) intersect select unnest((select interests from profiles where id = uid))),
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5)
  );
end $$;

-- See all of someone's photos
create or replace function public.unlock_photos(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cost int := public.setting_int('explore_photos_cost', 5);
  bal int;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if not public.explore_visible(uid, p_id) then raise exception 'Not available'; end if;
  if public.explore_match_id(uid, p_id) is not null or exists (select 1 from photo_unlocks where viewer = uid and target = p_id) then
    select balance into bal from wallets where user_id = uid;
    return coalesce(bal, 0);
  end if;
  if cost > 0 then
    bal := public.spend_keys(uid, cost, 'photos', p_id::text);
  else
    select balance into bal from wallets where user_id = uid;
  end if;
  insert into photo_unlocks (viewer, target, paid) values (uid, p_id, cost) on conflict do nothing;
  return coalesce(bal, 0);
end $$;

-- Message someone from Explore. Free if you're already connected, otherwise it costs Keys.
-- (update 36 changed what this returns, so it is replaced from scratch when the file is run again)
drop function if exists public.message_person(uuid);
create or replace function public.message_person(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mid uuid;
  cost int := public.setting_int('explore_message_cost', 15);
  me profiles;
begin
  if uid is null then raise exception 'Please log in'; end if;
  mid := public.explore_match_id(uid, p_id);
  if mid is not null then return mid; end if;
  if not public.explore_visible(uid, p_id) then raise exception 'Not available'; end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  if (select count(*) from matches where opened_by = uid and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Slow down a little';
  end if;
  select * into me from profiles where id = uid;
  insert into matches (user_a, user_b, intent, opened_by, source)
  values (least(uid, p_id), greatest(uid, p_id), me.pref_intent, uid, 'explore')
  returning id into mid;
  if cost > 0 then perform public.spend_keys(uid, cost, 'explore_message', mid::text); end if;
  return mid;
end $$;

revoke all on function public.explore_visible(uuid, uuid) from public, anon, authenticated;
revoke all on function public.explore_fits(uuid, uuid) from public, anon, authenticated;
revoke all on function public.explore_match_id(uuid, uuid) from public, anon, authenticated;

-- The daily prompts (Feed) are switched off: nobody can answer, react, gift or start chats from them.
-- To bring them back: grant execute on these functions to authenticated again.
do $$
declare f text;
begin
  foreach f in array array[
    'get_feed(text, int, int)', 'answer_prompt(uuid, text)', 'delete_my_answer(uuid)', 'react_answer(uuid, text)',
    'gift_answer(uuid, text)', 'start_feed_chat(uuid)', 'chat_back_gift(bigint)', 'report_answer(uuid, text)',
    'my_feed_gifts()', 'mark_feed_gifts_seen()', 'feed_status()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- Games without move timers. A game only ends early if nobody moves for 5 minutes.
-- Word Hunt keeps its 80-second round: racing the clock is the game.
create or replace function public.game_idle() returns interval
language sql immutable as $$ select interval '5 minutes' $$;

-- Your own truths for Two Truths and a Lie, kept to use again
create table if not exists public.user_truths (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 2 and 120),
  uses int not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create unique index if not exists user_truths_once on public.user_truths (user_id, lower(body));
alter table public.user_truths enable row level security;
drop policy if exists "read own truths" on public.user_truths;
create policy "read own truths" on public.user_truths for select using (user_id = auth.uid());

create or replace function public.my_truths() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', id, 'body', body, 'uses', uses) order by last_used_at desc nulls last, created_at desc), '[]'::json)
  from user_truths where user_id = auth.uid()
$$;

create or replace function public.save_truth(p_body text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  tid bigint;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if char_length(b) not between 2 and 120 then raise exception 'Each line needs a few words (up to 120 letters)'; end if;
  if (select count(*) from user_truths where user_id = uid) >= 50 then raise exception 'You can keep up to 50 truths'; end if;
  insert into user_truths (user_id, body) values (uid, b)
  on conflict (user_id, lower(body)) do update set body = user_truths.body
  returning id into tid;
  return tid;
end $$;

create or replace function public.delete_truth(p_id bigint) returns void
language sql security definer set search_path = public as $$
  delete from user_truths where id = p_id and user_id = auth.uid()
$$;

create or replace function public.game_begin(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  lvl int := 1;
  qs jsonb;
  t timestamptz := now() + interval '4 seconds'; -- 3, 2, 1 countdown
begin
  select * into g from games where id = p_game;
  if g.session_id is not null then
    select spice_level into lvl from masquerade_sessions where id = g.session_id;
  else
    select case when intent = 'spicy' then 3 when intent = 'dating' then 2 else 1 end into lvl from matches where id = g.match_id;
  end if;
  if g.kind = 'tot' then
    select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'q', q.prompt, 'a', q.a, 'b', q.b)), '[]'::jsonb) into qs
    from (select * from tot_questions where active and spice <= coalesce(lvl, 1) order by random() limit 10) q;
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('qs', qs, 'i', 0, 'picks', '[]'::jsonb, 'alike', 0)
    where id = g.id;
  elsif g.kind = 'truths' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('phase', 'write')
    where id = g.id;
  elsif g.kind = 'c4' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('board', repeat('.', 42), 'turn', 'a', 'round', 1, 'wins', jsonb_build_object('a', 0, 'b', 0),
        'starter', 'a', 'last', null, 'moves', 0, 'auto_a', 0, 'auto_b', 0)
    where id = g.id;
  else
    update games set status = 'active', started_at = t, deadline_at = t + interval '80 seconds',
      state = jsonb_build_object('board', public.game_words_board(), 'count_a', 0, 'count_b', 0)
    where id = g.id;
  end if;
  insert into game_secrets (game_id, user_id) values (g.id, g.player_a), (g.id, g.player_b) on conflict do nothing;
end $$;

create or replace function public.game_tot_reveal(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  i int;
  pa text; pb text;
  same boolean;
  n int;
begin
  select * into g from games where id = p_game;
  i := (g.state->>'i')::int;
  select data->'picks'->>(i::text) into pa from game_secrets where game_id = g.id and user_id = g.player_a;
  select data->'picks'->>(i::text) into pb from game_secrets where game_id = g.id and user_id = g.player_b;
  same := pa is not null and pa = pb;
  n := jsonb_array_length(g.state->'qs');
  g.state := jsonb_set(g.state, '{picks}', (g.state->'picks') || jsonb_build_array(jsonb_build_array(pa, pb)));
  g.state := jsonb_set(g.state, '{i}', to_jsonb(i + 1));
  g.state := jsonb_set(g.state, '{reveal_until}', to_jsonb(now() + interval '2500 milliseconds'));
  if same then g.state := jsonb_set(g.state, '{alike}', to_jsonb((g.state->>'alike')::int + 1)); end if;
  update games set state = g.state,
    score_a = (g.state->>'alike')::int, score_b = (g.state->>'alike')::int,
    deadline_at = now() + public.game_idle()
  where id = g.id;
  if i + 1 >= n then
    update games set deadline_at = null where id = g.id;
    perform public.game_finish(g.id);
  end if;
end $$;

create or replace function public.submit_truths(p_game uuid, p_lines text[], p_lie int) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  me text;
  la jsonb; lb jsonb;
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid) and kind = 'truths' for update;
  if not found or g.status <> 'active' or g.state->>'phase' <> 'write' then return; end if;
  if coalesce(array_length(p_lines, 1), 0) <> 3 or p_lie not between 0 and 2 then raise exception 'Write three lines and pick the lie'; end if;
  if exists (select 1 from unnest(p_lines) l where char_length(btrim(l)) not between 2 and 120) then
    raise exception 'Each line needs a few words (up to 120 letters)';
  end if;
  me := case when uid = g.player_a then 'a' else 'b' end;
  update game_secrets set data = data || jsonb_build_object('lines', to_jsonb(array(select btrim(l) from unnest(p_lines) l)), 'lie', p_lie)
  where game_id = g.id and user_id = uid;
  -- Keep your truths so you can use them again in later games
  insert into user_truths (user_id, body, uses, last_used_at)
  select uid, btrim(l), 1, now() from unnest(p_lines) with ordinality as x(l, n)
  where x.n - 1 <> p_lie
  on conflict (user_id, lower(body)) do update set uses = user_truths.uses + 1, last_used_at = now();
  g.state := jsonb_set(g.state, array['ready_' || me], 'true'::jsonb);
  update games set state = g.state where id = g.id;
  if (g.state->>'ready_a')::boolean is true and (g.state->>'ready_b')::boolean is true then
    select data->'lines' into la from game_secrets where game_id = g.id and user_id = g.player_a;
    select data->'lines' into lb from game_secrets where game_id = g.id and user_id = g.player_b;
    update games set state = state || jsonb_build_object('phase', 'guess', 'lines_a', la, 'lines_b', lb),
      deadline_at = now() + public.game_idle()
    where id = g.id;
  end if;
end $$;

create or replace function public.game_c4_move(p_game uuid, p_col int, p_auto boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  st jsonb;
  who text;
  board text;
  r int;
  line int[];
  wins_a int; wins_b int;
  rnd int;
  starter text;
  over boolean := false;
  result text;
begin
  select * into g from games where id = p_game;
  st := g.state;
  who := st->>'turn';
  select new_board, d.r into board, r from public.game_c4_drop(st->>'board', p_col, who) d;
  if r < 0 then raise exception 'That column is full'; end if;
  st := st || jsonb_build_object('board', board, 'last', r * 7 + p_col, 'moves', (st->>'moves')::int + 1,
    'auto_' || who, case when p_auto then (st->>('auto_' || who))::int + 1 else 0 end);
  line := public.game_c4_line(board, r, p_col);
  wins_a := (st->'wins'->>'a')::int; wins_b := (st->'wins'->>'b')::int;
  rnd := (st->>'round')::int;

  if array_length(line, 1) >= 4 or position('.' in board) = 0 then
    result := case when array_length(line, 1) >= 4 then who else 'draw' end;
    if result = 'a' then wins_a := wins_a + 1; elsif result = 'b' then wins_b := wins_b + 1; end if;
    over := wins_a >= 2 or wins_b >= 2 or rnd >= 3;
    starter := case when st->>'starter' = 'a' then 'b' else 'a' end;
    -- Keep the finished board on show for a moment, then start the next round
    st := st || jsonb_build_object(
      'prev', jsonb_build_object('board', board, 'line', to_jsonb(line), 'winner', result, 'round', rnd),
      'wins', jsonb_build_object('a', wins_a, 'b', wins_b),
      'pause_until', now() + interval '3 seconds');
    if not over then
      st := st || jsonb_build_object('board', repeat('.', 42), 'round', rnd + 1, 'starter', starter, 'turn', starter, 'last', null, 'moves', 0);
    end if;
    update games set state = st, score_a = wins_a, score_b = wins_b,
      deadline_at = now() + public.game_idle()
    where id = g.id;
    if over then perform public.game_finish(g.id); end if;
    return;
  end if;

  st := st || jsonb_build_object('turn', case when who = 'a' then 'b' else 'a' end);
  update games set state = st, deadline_at = now() + public.game_idle() where id = g.id;
end $$;

create or replace function public.game_tick(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  who text;
  col int;
  free int[];
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid) for update;
  if not found then return; end if;
  if g.status = 'invited' and g.deadline_at < now() then
    update games set status = 'expired', ended_at = now(), deadline_at = null where id = g.id;
    return;
  end if;
  if g.status <> 'active' then return; end if;
  -- The chat closed (hour over, or someone let go)
  if public.game_chat_ok(uid, g.session_id, g.match_id) is null then
    perform public.game_finish(g.id, 'closed');
    return;
  end if;
  if g.deadline_at is null or now() < g.deadline_at then return; end if;

  -- Nobody moved for a long while: the game ends (there are no move timers any more)
  if g.kind = 'tot' then
    perform public.game_finish(g.id, 'timeout');
  elsif g.kind = 'truths' then
    if g.state->>'phase' = 'write' then
      if (g.state->>'ready_a')::boolean is true or (g.state->>'ready_b')::boolean is true then
        -- Only one wrote theirs in time: they win
        update games set winner = case when (g.state->>'ready_a')::boolean is true then g.player_a else g.player_b end where id = g.id;
      end if;
      perform public.game_finish(g.id, 'timeout');
    else
      perform public.game_truths_reveal(g.id);
    end if;
  elsif g.kind = 'c4' then
    -- Whoever kept everyone waiting loses
    who := g.state->>'turn';
    update games set winner = case when who = 'a' then g.player_b else g.player_a end where id = g.id;
    perform public.game_finish(g.id, 'timeout', case when who = 'a' then g.player_a else g.player_b end);
  elsif g.kind = 'words' then
    if now() < g.deadline_at + interval '2 seconds' then return; end if;
    update games set state = state || jsonb_build_object(
      'words_a', (select coalesce(data->'words', '[]'::jsonb) from game_secrets where game_id = g.id and user_id = g.player_a),
      'words_b', (select coalesce(data->'words', '[]'::jsonb) from game_secrets where game_id = g.id and user_id = g.player_b))
    where id = g.id;
    perform public.game_finish(g.id);
  end if;
end $$;
revoke all on function public.game_begin(uuid) from public, anon, authenticated;
revoke all on function public.game_tot_reveal(uuid) from public, anon, authenticated;
revoke all on function public.game_c4_move(uuid, int, boolean) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Part 26: Whot, Checkers, Chess and Ayo
-- Moves are checked by the app's server (the same rules the phone uses to show
-- legal moves) and saved with the service key, so players can't change a game
-- directly. Whot hands are each player's secret; the market is hidden from both.
-- A game ends if the player whose turn it is doesn't move for 5 minutes.
-- ---------------------------------------------------------------------------
alter table public.games drop constraint if exists games_kind_check;
alter table public.games add constraint games_kind_check check (kind in ('truths', 'tot', 'c4', 'words', 'whot', 'checkers', 'chess', 'ayo'));
-- Bumped on every move, so two moves can't land on top of each other
alter table public.games add column if not exists seq int not null default 0;

-- Parts of a game nobody may see (the Whot market)
create table if not exists public.game_private (
  game_id uuid primary key references public.games on delete cascade,
  data jsonb not null default '{}'::jsonb
);
alter table public.game_private enable row level security;

create or replace function public.game_title(k text) returns text
language sql immutable as $$
  select case k when 'truths' then 'Two Truths & a Lie' when 'tot' then 'This or That'
    when 'c4' then 'Connect 4' when 'words' then 'Word Hunt' when 'whot' then 'Whot'
    when 'checkers' then 'Checkers' when 'chess' then 'Chess' when 'ayo' then 'Ayo' else 'a game' end
$$;

-- Checkers start: b's men on the dark squares of the top three rows, a's on the bottom three
create or replace function public.game_checkers_board() returns text
language sql immutable as $$
  select string_agg(case when (r + c) % 2 = 1 then case when r < 3 then 'b' when r > 4 then 'a' else '.' end else '.' end, '' order by r, c)
  from generate_series(0, 7) r, generate_series(0, 7) c
$$;

-- Whot: shuffle the 54 cards, deal 5 each, turn up a plain card to start
create or replace function public.game_whot_deal(p_game uuid, t timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  deck text[];
  top text;
  k int;
begin
  select * into g from games where id = p_game;
  select array_agg(card order by random()) into deck from (
    select s || ':' || n as card from unnest(array['circle', 'triangle']) s, unnest(array[1,2,3,4,5,7,8,10,11,12,13,14]) n
    union all select s || ':' || n from unnest(array['cross', 'square']) s, unnest(array[1,2,3,5,7,10,11,13,14]) n
    union all select 'star:' || n from unnest(array[1,2,3,4,5,7,8]) n
    union all select 'whot:20' from generate_series(1, 5)
  ) d;
  -- The first card that isn't a Whot or a special card starts the pile
  select i into k from generate_subscripts(deck, 1) i
  where i > 10 and split_part(deck[i], ':', 1) <> 'whot' and split_part(deck[i], ':', 2)::int not in (1, 2, 5, 8, 14)
  order by i limit 1;
  top := deck[k];
  insert into game_secrets (game_id, user_id, data) values
    (g.id, g.player_a, jsonb_build_object('hand', to_jsonb(deck[1:5]))),
    (g.id, g.player_b, jsonb_build_object('hand', to_jsonb(deck[6:10])))
  on conflict (game_id, user_id) do update set data = excluded.data;
  insert into game_private (game_id, data)
  values (g.id, jsonb_build_object('deck', to_jsonb(deck[11:k - 1] || deck[k + 1:])))
  on conflict (game_id) do update set data = excluded.data;
  update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
    state = jsonb_build_object('top', top, 'called', null, 'turn', 'a', 'count_a', 5, 'count_b', 5,
      'market', 54 - 11, 'last', null, 'moves', 0)
  where id = g.id;
end $$;
revoke all on function public.game_whot_deal(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.game_begin(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  lvl int := 1;
  qs jsonb;
  t timestamptz := now() + interval '4 seconds'; -- 3, 2, 1 countdown
begin
  select * into g from games where id = p_game;
  if g.session_id is not null then
    select spice_level into lvl from masquerade_sessions where id = g.session_id;
  else
    select case when intent = 'spicy' then 3 when intent = 'dating' then 2 else 1 end into lvl from matches where id = g.match_id;
  end if;
  if g.kind = 'tot' then
    select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'q', q.prompt, 'a', q.a, 'b', q.b)), '[]'::jsonb) into qs
    from (select * from tot_questions where active and spice <= coalesce(lvl, 1) order by random() limit 10) q;
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('qs', qs, 'i', 0, 'picks', '[]'::jsonb, 'alike', 0)
    where id = g.id;
  elsif g.kind = 'truths' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('phase', 'write')
    where id = g.id;
  elsif g.kind = 'c4' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('board', repeat('.', 42), 'turn', 'a', 'round', 1, 'wins', jsonb_build_object('a', 0, 'b', 0),
        'starter', 'a', 'last', null, 'moves', 0, 'auto_a', 0, 'auto_b', 0)
    where id = g.id;
  elsif g.kind = 'checkers' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('board', public.game_checkers_board(), 'turn', 'a', 'chain', null, 'quiet', 0,
        'captured', jsonb_build_object('a', 0, 'b', 0), 'last', null, 'moves', 0)
    where id = g.id;
  elsif g.kind = 'chess' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('fen', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'turn', 'a', 'san', '[]'::jsonb,
        'last', null, 'check', false, 'taken', jsonb_build_object('a', '', 'b', ''), 'moves', 0)
    where id = g.id;
  elsif g.kind = 'ayo' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('pits', jsonb_build_array(4,4,4,4,4,4,4,4,4,4,4,4), 'store', jsonb_build_object('a', 0, 'b', 0),
        'turn', 'a', 'last', null, 'moves', 0)
    where id = g.id;
  elsif g.kind = 'whot' then
    perform public.game_whot_deal(g.id, t);
  else
    update games set status = 'active', started_at = t, deadline_at = t + interval '80 seconds',
      state = jsonb_build_object('board', public.game_words_board(), 'count_a', 0, 'count_b', 0)
    where id = g.id;
  end if;
  insert into game_secrets (game_id, user_id) values (g.id, g.player_a), (g.id, g.player_b) on conflict do nothing;
end $$;

create or replace function public.start_game(p_kind text, p_session uuid default null, p_match uuid default null, p_rematch uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  other uuid;
  live games;
  gid uuid;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if p_kind not in ('truths', 'tot', 'c4', 'words', 'whot', 'checkers', 'chess', 'ayo') then raise exception 'Unknown game'; end if;
  if public.setting_int('game_' || p_kind, 1) = 0 then raise exception 'This game is taking a break. Try another one.'; end if;
  other := public.game_chat_ok(uid, p_session, p_match);
  if other is null then raise exception 'Games are not available in this chat right now'; end if;

  -- Clear out a challenge that ran out
  update games set status = 'expired', ended_at = now()
  where status = 'invited' and deadline_at < now()
    and ((p_session is not null and session_id = p_session) or (p_match is not null and match_id = p_match));

  select * into live from games where status in ('invited', 'active')
    and ((p_session is not null and session_id = p_session) or (p_match is not null and match_id = p_match))
  limit 1;
  if found then
    -- They already challenged you to the same game: just accept it
    if live.status = 'invited' and live.player_b = uid and live.kind = p_kind then
      perform public.respond_game(live.id, true);
      return live.id;
    end if;
    raise exception 'Finish the game you’re in first';
  end if;

  if p_session is not null and public.meet_turn_pending(p_session) then
    raise exception 'Your game starts when it’s your turn. Chat while you wait.';
  end if;

  if (select count(*) from games where player_a = uid and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Slow down a little';
  end if;

  insert into games (kind, session_id, match_id, player_a, player_b, deadline_at, rematch_of)
  values (p_kind, p_session, p_match, uid, other, now() + interval '30 seconds', p_rematch)
  returning id into gid;
  return gid;
end $$;

create or replace function public.game_tick(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  who text;
  col int;
  free int[];
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid) for update;
  if not found then return; end if;
  if g.status = 'invited' and g.deadline_at < now() then
    update games set status = 'expired', ended_at = now(), deadline_at = null where id = g.id;
    return;
  end if;
  if g.status <> 'active' then return; end if;
  -- The chat closed (hour over, or someone let go)
  if public.game_chat_ok(uid, g.session_id, g.match_id) is null then
    perform public.game_finish(g.id, 'closed');
    return;
  end if;
  if g.deadline_at is null or now() < g.deadline_at then return; end if;

  -- Nobody moved for a long while: the game ends (there are no move timers any more)
  if g.kind = 'tot' then
    perform public.game_finish(g.id, 'timeout');
  elsif g.kind = 'truths' then
    if g.state->>'phase' = 'write' then
      if (g.state->>'ready_a')::boolean is true or (g.state->>'ready_b')::boolean is true then
        -- Only one wrote theirs in time: they win
        update games set winner = case when (g.state->>'ready_a')::boolean is true then g.player_a else g.player_b end where id = g.id;
      end if;
      perform public.game_finish(g.id, 'timeout');
    else
      perform public.game_truths_reveal(g.id);
    end if;
  elsif g.kind in ('c4', 'whot', 'checkers', 'chess', 'ayo') then
    -- Whoever kept everyone waiting loses
    who := g.state->>'turn';
    update games set winner = case when who = 'a' then g.player_b else g.player_a end where id = g.id;
    perform public.game_finish(g.id, 'timeout', case when who = 'a' then g.player_a else g.player_b end);
  elsif g.kind = 'words' then
    if now() < g.deadline_at + interval '2 seconds' then return; end if;
    update games set state = state || jsonb_build_object(
      'words_a', (select coalesce(data->'words', '[]'::jsonb) from game_secrets where game_id = g.id and user_id = g.player_a),
      'words_b', (select coalesce(data->'words', '[]'::jsonb) from game_secrets where game_id = g.id and user_id = g.player_b))
    where id = g.id;
    perform public.game_finish(g.id);
  end if;
end $$;

create or replace function public.game_finish(p_game uuid, p_reason text default null, p_by uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  meta jsonb;
  st text;
begin
  select * into g from games where id = p_game;
  if not found or g.status <> 'active' then return; end if;
  st := case when p_reason in ('left', 'timeout', 'closed') then 'cancelled' else 'done' end;
  -- These games set their own winner (and a draw has none)
  if st = 'done' and g.winner is null and g.kind not in ('tot', 'whot', 'checkers', 'chess', 'ayo') then
    g.winner := case when g.score_a > g.score_b then g.player_a when g.score_b > g.score_a then g.player_b end;
  end if;
  update games set status = st, ended_at = now(), ended_reason = p_reason, ended_by = p_by,
    winner = g.winner, deadline_at = null
  where id = g.id;
  if p_reason = 'closed' then return; end if;
  meta := jsonb_build_object('game', g.id, 'kind', g.kind, 'a', g.player_a, 'b', g.player_b,
    'sa', g.score_a, 'sb', g.score_b, 'winner', g.winner, 'status', st, 'reason', p_reason, 'by', p_by);
  if st = 'done' and public.game_detail(g) is not null then
    meta := meta || jsonb_build_object('detail', public.game_detail(g));
  end if;
  if g.session_id is not null then
    insert into masquerade_messages (session_id, sender_id, kind, body, media_meta)
    values (g.session_id, null, 'game', public.game_title(g.kind), meta);
  else
    insert into messages (match_id, sender_id, kind, body, media_meta)
    values (g.match_id, null, 'game', public.game_title(g.kind), meta);
    update matches set last_message_at = now() where id = g.match_id;
  end if;
end $$;
revoke all on function public.game_begin(uuid) from public, anon, authenticated;
revoke all on function public.game_finish(uuid, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Part 27: Unmasking tells the other person; mood stays private until you've chatted
-- ---------------------------------------------------------------------------
-- You've both sent at least one message in your chat
create or replace function public.explore_chatted(v uuid, o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from matches m
    where m.user_a = least(v, o) and m.user_b = greatest(v, o)
      and exists (select 1 from messages x where x.match_id = m.id and x.sender_id = v)
      and exists (select 1 from messages x where x.match_id = m.id and x.sender_id = o))
$$;
revoke all on function public.explore_chatted(uuid, uuid) from public, anon, authenticated;

create or replace function public.vote_unmask(p_session uuid, p_unmask boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then raise exception 'Chat not found'; end if;
  if s.status not in ('active', 'lapsed') then return; end if;
  if p_unmask and s.hour_at is null and s.meet_id is null and now() < s.ends_at - interval '2 seconds' then
    raise exception 'You can unmask when the timer ends';
  end if;
  -- Tell them in the chat the first time you unmask (they get a notification too)
  if p_unmask and (case when uid = s.user_a then s.unmask_a else s.unmask_b end) is distinct from true
     and (case when uid = s.user_a then s.unmask_b else s.unmask_a end) is distinct from true then
    insert into masquerade_messages (session_id, kind, body)
    values (s.id, 'system', (case when uid = s.user_a then s.alias_a else s.alias_b end) || ' unmasked. Unmask too to connect');
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

create or replace function public.explore_profile(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  mid uuid;
  open boolean;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if not public.explore_visible(uid, p_id) then return null; end if;
  select * into p from profiles where id = p_id;
  mid := public.explore_match_id(uid, p_id);
  open := mid is not null or exists (select 1 from photo_unlocks where viewer = uid and target = p_id);
  return json_build_object(
    'id', p.id, 'name', p.display_name, 'age', public.age_years(p.birthdate), 'gender', p.gender,
    'bio', p.bio, 'interests', p.interests, 'place', p.place_label,
    -- What they're in the mood for only shows once you've both chatted
    'intent', case when public.explore_chatted(uid, p_id) then p.pref_intent end,
    'online', p.last_seen_at > now() - interval '5 minutes',
    'photos', case when open then to_json(p.photos) else to_json(array[p.photos[1]]) end,
    'photo_count', cardinality(p.photos),
    'photos_unlocked', open,
    'match_id', mid,
    'shared_interests', array(select unnest(p.interests) intersect select unnest((select interests from profiles where id = uid))),
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5)
  );
end $$;

create or replace function public.explore_people(p_q text default null, p_limit int default 60, p_offset int default 0) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into me from profiles where id = uid;
  return json_build_object(
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    'people', coalesce((
      select json_agg(row_to_json(t)) from (
        select p.id, p.display_name as name, public.age_years(p.birthdate) as age, p.gender, p.photos[1] as photo,
          p.place_label as place, case when public.explore_chatted(uid, p.id) then p.pref_intent end as intent,
          (p.last_seen_at > now() - interval '5 minutes') as online,
          public.explore_match_id(uid, p.id) is not null as connected
        from profiles p
        where public.explore_visible(uid, p.id)
          and (case when q is not null then p.display_name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%'
                    else p.last_seen_at > now() - interval '30 days' and public.explore_fits(uid, p.id) end)
        order by
          (q is not null and lower(p.display_name) = lower(q)) desc,
          (p.last_seen_at > now() - interval '5 minutes') desc,
          (p.place_country = me.place_country and p.place_region = me.place_region) desc nulls last,
          (p.place_country = me.place_country) desc nulls last,
          public.shared_count(me.interests, p.interests) desc,
          p.last_seen_at desc
        limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
      ) t), '[]'::json)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Part 28: Ghost mode, and less shown on the Meet page
-- Ghost mode hides you from the Meet page. It costs Keys for 30 days (100 by
-- default, set in admin); switch it off and on as you like while it lasts.
-- Age shows only to people you're connected with; mood only in your chat.
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value) values ('ghost_cost', 100) on conflict (key) do nothing;
alter table public.profiles add column if not exists ghost_on boolean not null default false;
alter table public.profiles add column if not exists ghost_until timestamptz;

-- Switch ghost mode on (paying for 30 days if you haven't already) or off
create or replace function public.set_ghost(p_on boolean) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  cost int := public.setting_int('ghost_cost', 100);
  bal int;
  paid boolean := false;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into p from profiles where id = uid for update;
  if p_on and (p.ghost_until is null or p.ghost_until <= now()) then
    if cost > 0 then bal := public.spend_keys(uid, cost, 'ghost', null); end if;
    update profiles set ghost_on = true, ghost_until = now() + interval '30 days' where id = uid returning * into p;
    paid := true;
  else
    update profiles set ghost_on = p_on where id = uid returning * into p;
  end if;
  if bal is null then select balance into bal from wallets where user_id = uid; end if;
  return json_build_object('on', p.ghost_on and p.ghost_until > now(), 'until', p.ghost_until, 'paid', paid, 'balance', coalesce(bal, 0), 'cost', cost);
end $$;

create or replace function public.explore_visible(v uuid, o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select v <> o and exists (
    select 1 from profiles p left join accounts_private a on a.user_id = p.id
    where p.id = o and p.display_name is not null and p.birthdate is not null and p.gender is not null
      and cardinality(p.photos) > 0 and a.banned_at is null
      -- Ghost mode: hidden from Meet while it lasts
      and not (p.ghost_on and p.ghost_until > now()))
    and not public.is_blocked(v, o)
$$;


create or replace function public.explore_people(p_q text default null, p_limit int default 60, p_offset int default 0) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into me from profiles where id = uid;
  return json_build_object(
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    'people', coalesce((
      select json_agg(row_to_json(t)) from (
        -- Age only for people you're connected with; what they're in the mood for only shows in your chat
        select p.id, p.display_name as name,
          case when public.explore_match_id(uid, p.id) is not null then public.age_years(p.birthdate) end as age,
          p.gender, p.photos[1] as photo,
          p.place_label as place, null::text as intent,
          (p.last_seen_at > now() - interval '5 minutes') as online,
          public.explore_match_id(uid, p.id) is not null as connected
        from profiles p
        where public.explore_visible(uid, p.id)
          and (case when q is not null then p.display_name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%'
                    else p.last_seen_at > now() - interval '30 days' and public.explore_fits(uid, p.id) end)
        order by
          (q is not null and lower(p.display_name) = lower(q)) desc,
          (p.last_seen_at > now() - interval '5 minutes') desc,
          (p.place_country = me.place_country and p.place_region = me.place_region) desc nulls last,
          (p.place_country = me.place_country) desc nulls last,
          public.shared_count(me.interests, p.interests) desc,
          p.last_seen_at desc
        limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
      ) t), '[]'::json)
  );
end $$;

create or replace function public.explore_profile(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  mid uuid;
  open boolean;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if not public.explore_visible(uid, p_id) then return null; end if;
  select * into p from profiles where id = p_id;
  mid := public.explore_match_id(uid, p_id);
  open := mid is not null or exists (select 1 from photo_unlocks where viewer = uid and target = p_id);
  return json_build_object(
    'id', p.id, 'name', p.display_name, 'age', case when mid is not null then public.age_years(p.birthdate) end, 'gender', p.gender,
    'bio', p.bio, 'interests', p.interests, 'place', p.place_label,
    -- What they're in the mood for only shows in your chat
    'intent', null,
    'online', p.last_seen_at > now() - interval '5 minutes',
    'photos', case when open then to_json(p.photos) else to_json(array[p.photos[1]]) end,
    'photo_count', cardinality(p.photos),
    'photos_unlocked', open,
    'match_id', mid,
    'shared_interests', array(select unnest(p.interests) intersect select unnest((select interests from profiles where id = uid))),
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5)
  );
end $$;
revoke all on function public.explore_visible(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Part 29: Bombshell and Gem Clash
-- Bombshell: each round both players hide 3 bombs in a 3x3 field, then take
-- turns opening tiles in the other's field. Hidden bombs are each player's secret.
-- Gem Clash: a match-3 duel on one shared board, 5 turns of 2 swaps each.
-- Moves for both go through the app's server, like Whot, Checkers, Chess and Ayo.
-- ---------------------------------------------------------------------------
alter table public.games drop constraint if exists games_kind_check;
alter table public.games add constraint games_kind_check check (kind in ('truths', 'tot', 'c4', 'words', 'whot', 'checkers', 'chess', 'ayo', 'bomb', 'gems'));

-- Gem Clash start: a 7x7 board of 5 colours with nothing already lined up
create or replace function public.game_gems_board() returns jsonb
language plpgsql volatile as $$
declare
  b text[] := array_fill(''::text, array[49]);
  c text;
  i int;
begin
  for i in 0..48 loop
    loop
      c := (array['r', 'y', 'g', 'b', 'p'])[1 + floor(random() * 5)::int];
      exit when not ((i % 7 >= 2 and b[i] = c and b[i - 1] = c) or (i >= 14 and b[i - 6] = c and b[i - 13] = c));
    end loop;
    b[i + 1] := c;
  end loop;
  return to_jsonb(b);
end $$;

create or replace function public.game_title(k text) returns text
language sql immutable as $$
  select case k when 'truths' then 'Two Truths & a Lie' when 'tot' then 'This or That'
    when 'c4' then 'Connect 4' when 'words' then 'Word Hunt' when 'whot' then 'Whot'
    when 'checkers' then 'Checkers' when 'chess' then 'Chess' when 'ayo' then 'Ayo'
    when 'bomb' then 'Bombshell' when 'gems' then 'Gem Clash' else 'a game' end
$$;

create or replace function public.game_begin(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  lvl int := 1;
  qs jsonb;
  t timestamptz := now() + interval '4 seconds'; -- 3, 2, 1 countdown
begin
  select * into g from games where id = p_game;
  if g.session_id is not null then
    select spice_level into lvl from masquerade_sessions where id = g.session_id;
  else
    select case when intent = 'spicy' then 3 when intent = 'dating' then 2 else 1 end into lvl from matches where id = g.match_id;
  end if;
  if g.kind = 'tot' then
    select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'q', q.prompt, 'a', q.a, 'b', q.b)), '[]'::jsonb) into qs
    from (select * from tot_questions where active and spice <= coalesce(lvl, 1) order by random() limit 10) q;
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('qs', qs, 'i', 0, 'picks', '[]'::jsonb, 'alike', 0)
    where id = g.id;
  elsif g.kind = 'truths' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('phase', 'write')
    where id = g.id;
  elsif g.kind = 'c4' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('board', repeat('.', 42), 'turn', 'a', 'round', 1, 'wins', jsonb_build_object('a', 0, 'b', 0),
        'starter', 'a', 'last', null, 'moves', 0, 'auto_a', 0, 'auto_b', 0)
    where id = g.id;
  elsif g.kind = 'checkers' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('board', public.game_checkers_board(), 'turn', 'a', 'chain', null, 'quiet', 0,
        'captured', jsonb_build_object('a', 0, 'b', 0), 'last', null, 'moves', 0)
    where id = g.id;
  elsif g.kind = 'chess' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('fen', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'turn', 'a', 'san', '[]'::jsonb,
        'last', null, 'check', false, 'taken', jsonb_build_object('a', '', 'b', ''), 'moves', 0)
    where id = g.id;
  elsif g.kind = 'ayo' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('pits', jsonb_build_array(4,4,4,4,4,4,4,4,4,4,4,4), 'store', jsonb_build_object('a', 0, 'b', 0),
        'turn', 'a', 'last', null, 'moves', 0)
    where id = g.id;
  elsif g.kind = 'whot' then
    perform public.game_whot_deal(g.id, t);
  elsif g.kind = 'bomb' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('phase', 'hide', 'round', 1, 'wins', jsonb_build_object('a', 0, 'b', 0), 'starter', 'a',
        'ready_a', false, 'ready_b', false, 'turn', null, 'open_a', '.........', 'open_b', '.........',
        'boom_a', 0, 'boom_b', 0, 'last', null, 'result', null, 'moves', 0)
    where id = g.id;
  elsif g.kind = 'gems' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('board', public.game_gems_board(), 'turn', 'a', 'left', 2,
        'done', jsonb_build_object('a', 0, 'b', 0), 'points', jsonb_build_object('a', 0, 'b', 0), 'last', null, 'moves', 0)
    where id = g.id;
  else
    update games set status = 'active', started_at = t, deadline_at = t + interval '80 seconds',
      state = jsonb_build_object('board', public.game_words_board(), 'count_a', 0, 'count_b', 0)
    where id = g.id;
  end if;
  insert into game_secrets (game_id, user_id) values (g.id, g.player_a), (g.id, g.player_b) on conflict do nothing;
end $$;

create or replace function public.start_game(p_kind text, p_session uuid default null, p_match uuid default null, p_rematch uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  other uuid;
  live games;
  gid uuid;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if p_kind not in ('truths', 'tot', 'c4', 'words', 'whot', 'checkers', 'chess', 'ayo', 'bomb', 'gems') then raise exception 'Unknown game'; end if;
  if public.setting_int('game_' || p_kind, 1) = 0 then raise exception 'This game is taking a break. Try another one.'; end if;
  other := public.game_chat_ok(uid, p_session, p_match);
  if other is null then raise exception 'Games are not available in this chat right now'; end if;

  -- Clear out a challenge that ran out
  update games set status = 'expired', ended_at = now()
  where status = 'invited' and deadline_at < now()
    and ((p_session is not null and session_id = p_session) or (p_match is not null and match_id = p_match));

  select * into live from games where status in ('invited', 'active')
    and ((p_session is not null and session_id = p_session) or (p_match is not null and match_id = p_match))
  limit 1;
  if found then
    -- They already challenged you to the same game: just accept it
    if live.status = 'invited' and live.player_b = uid and live.kind = p_kind then
      perform public.respond_game(live.id, true);
      return live.id;
    end if;
    raise exception 'Finish the game you’re in first';
  end if;

  if p_session is not null and public.meet_turn_pending(p_session) then
    raise exception 'Your game starts when it’s your turn. Chat while you wait.';
  end if;

  if (select count(*) from games where player_a = uid and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Slow down a little';
  end if;

  insert into games (kind, session_id, match_id, player_a, player_b, deadline_at, rematch_of)
  values (p_kind, p_session, p_match, uid, other, now() + interval '30 seconds', p_rematch)
  returning id into gid;
  return gid;
end $$;

create or replace function public.game_tick(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g games;
  who text;
  col int;
  free int[];
begin
  select * into g from games where id = p_game and (player_a = uid or player_b = uid) for update;
  if not found then return; end if;
  if g.status = 'invited' and g.deadline_at < now() then
    update games set status = 'expired', ended_at = now(), deadline_at = null where id = g.id;
    return;
  end if;
  if g.status <> 'active' then return; end if;
  -- The chat closed (hour over, or someone let go)
  if public.game_chat_ok(uid, g.session_id, g.match_id) is null then
    perform public.game_finish(g.id, 'closed');
    return;
  end if;
  if g.deadline_at is null or now() < g.deadline_at then return; end if;

  -- Nobody moved for a long while: the game ends (there are no move timers any more)
  if g.kind = 'tot' then
    perform public.game_finish(g.id, 'timeout');
  elsif g.kind = 'truths' then
    if g.state->>'phase' = 'write' then
      if (g.state->>'ready_a')::boolean is true or (g.state->>'ready_b')::boolean is true then
        -- Only one wrote theirs in time: they win
        update games set winner = case when (g.state->>'ready_a')::boolean is true then g.player_a else g.player_b end where id = g.id;
      end if;
      perform public.game_finish(g.id, 'timeout');
    else
      perform public.game_truths_reveal(g.id);
    end if;
  elsif g.kind = 'bomb' and g.state->>'phase' = 'hide' then
    -- Still hiding bombs: whoever didn't hide theirs loses (nobody wins if neither did)
    if (g.state->>'ready_a')::boolean is distinct from (g.state->>'ready_b')::boolean then
      who := case when (g.state->>'ready_a')::boolean then 'b' else 'a' end;
      update games set winner = case when who = 'a' then g.player_b else g.player_a end where id = g.id;
      perform public.game_finish(g.id, 'timeout', case when who = 'a' then g.player_a else g.player_b end);
    else
      perform public.game_finish(g.id, 'timeout');
    end if;
  elsif g.kind in ('c4', 'whot', 'checkers', 'chess', 'ayo', 'bomb', 'gems') then
    -- Whoever kept everyone waiting loses
    who := g.state->>'turn';
    update games set winner = case when who = 'a' then g.player_b else g.player_a end where id = g.id;
    perform public.game_finish(g.id, 'timeout', case when who = 'a' then g.player_a else g.player_b end);
  elsif g.kind = 'words' then
    if now() < g.deadline_at + interval '2 seconds' then return; end if;
    update games set state = state || jsonb_build_object(
      'words_a', (select coalesce(data->'words', '[]'::jsonb) from game_secrets where game_id = g.id and user_id = g.player_a),
      'words_b', (select coalesce(data->'words', '[]'::jsonb) from game_secrets where game_id = g.id and user_id = g.player_b))
    where id = g.id;
    perform public.game_finish(g.id);
  end if;
end $$;

create or replace function public.game_finish(p_game uuid, p_reason text default null, p_by uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  meta jsonb;
  st text;
begin
  select * into g from games where id = p_game;
  if not found or g.status <> 'active' then return; end if;
  st := case when p_reason in ('left', 'timeout', 'closed') then 'cancelled' else 'done' end;
  -- These games set their own winner (and a draw has none)
  if st = 'done' and g.winner is null and g.kind not in ('tot', 'whot', 'checkers', 'chess', 'ayo', 'bomb', 'gems') then
    g.winner := case when g.score_a > g.score_b then g.player_a when g.score_b > g.score_a then g.player_b end;
  end if;
  update games set status = st, ended_at = now(), ended_reason = p_reason, ended_by = p_by,
    winner = g.winner, deadline_at = null
  where id = g.id;
  if p_reason = 'closed' then return; end if;
  meta := jsonb_build_object('game', g.id, 'kind', g.kind, 'a', g.player_a, 'b', g.player_b,
    'sa', g.score_a, 'sb', g.score_b, 'winner', g.winner, 'status', st, 'reason', p_reason, 'by', p_by);
  if st = 'done' and public.game_detail(g) is not null then
    meta := meta || jsonb_build_object('detail', public.game_detail(g));
  end if;
  if g.session_id is not null then
    insert into masquerade_messages (session_id, sender_id, kind, body, media_meta)
    values (g.session_id, null, 'game', public.game_title(g.kind), meta);
  else
    insert into messages (match_id, sender_id, kind, body, media_meta)
    values (g.match_id, null, 'game', public.game_title(g.kind), meta);
    update matches set last_message_at = now() where id = g.match_id;
  end if;
end $$;
revoke all on function public.game_begin(uuid) from public, anon, authenticated;
revoke all on function public.game_finish(uuid, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Part 30: Ghost mode hides you on event walls too
-- People in ghost mode don't show on the wall at events they attend, and nobody
-- new can start a chat with them there. Chats they already have carry on, and
-- they can still be paired in Masquerade.
-- ---------------------------------------------------------------------------
create or replace function public.is_ghost(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select ghost_on and ghost_until > now() from profiles where id = p_user), false)
$$;
revoke all on function public.is_ghost(uuid) from public, anon, authenticated;

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
        -- Ghost mode: hidden, unless you already have a chat with them here
        and (not public.is_ghost(p.id) or exists (select 1 from event_chats c
          where c.event_id = p_event and c.user_a = least(uid, p.id) and c.user_b = greatest(uid, p.id)))
    ) t
  ), '[]'::json);
end $$;

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
  if public.is_ghost(p_target) then raise exception 'Not available'; end if;
  if (select count(*) from event_chats where event_id = p_event and opened_by = uid and status = 'open')
     >= public.event_int(e, 'max_chats', 5) then
    raise exception 'MAX_CHATS';
  end if;
  insert into event_chats (event_id, user_a, user_b, opened_by)
  values (p_event, least(uid, p_target), greatest(uid, p_target), uid)
  returning id into cid;
  return cid;
end $$;

-- ---------------------------------------------------------------------------
-- Part 31: The Meet page ranks everyone instead of filtering
-- Nobody is left out for not fitting your settings: everyone is scored on how
-- well you fit each other (who you're into, mood, ages), how close they are,
-- shared interests and whether they're around, and you see the top 50.
-- Search still finds anyone by name.
-- To keep it cheap, only the 600 most recently active people are scored on
-- each load (the phone also keeps the list for a few minutes).
-- Masked chats also show whether the other person is online.
-- ---------------------------------------------------------------------------
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc);

create or replace function public.explore_people(p_q text default null, p_limit int default 50, p_offset int default 0) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  my_age int;
  mlat double precision;
  mlng double precision;
  q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into me from profiles where id = uid;
  my_age := public.age_years(me.birthdate);
  select lat, lng into mlat, mlng from accounts_private where user_id = uid;
  return json_build_object(
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    'people', coalesce((
      select json_agg(row_to_json(t) order by t.rank) from (
        -- Age only for people you're connected with; what they're in the mood for only shows in your chat
        select s.id, s.name,
          case when public.explore_match_id(uid, s.id) is not null then s.age end as age,
          s.gender, s.photo, s.place, null::text as intent, s.online,
          public.explore_match_id(uid, s.id) is not null as connected,
          row_number() over (order by s.score desc, s.km asc nulls last, s.last_seen_at desc) as rank
        from (
          select c.*,
            (case when q is not null and lower(c.name) = lower(q) then 1000 else 0 end)
            -- How well you fit each other
            + (case when public.gender_fits(me.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, me.gender) then 40
                    when public.gender_fits(me.pref_seeking, c.gender) then 20 else 0 end)
            + (case when c.pref_intent = me.pref_intent then 15 else 0 end)
            + (case when c.age between me.pref_age_min and me.pref_age_max then 15 else 0 end)
            + (case when my_age between c.pref_age_min and c.pref_age_max then 10 else 0 end)
            -- How close they are
            + (case when c.km is not null then greatest(0, 20 - c.km / 5)
                    when c.place_country = me.place_country and c.place_region = me.place_region then 14
                    when c.place_country = me.place_country then 6 else 0 end)
            -- What you share, and whether they're around
            + least(public.shared_count(me.interests, c.interests), 5) * 3
            + (case when c.online then 8 when c.last_seen_at > now() - interval '1 day' then 4 else 0 end)
            as score
          from (
            select p.id, p.display_name as name, public.age_years(p.birthdate) as age, p.gender, p.photos[1] as photo,
              p.place_label as place, p.place_country, p.place_region, p.pref_seeking, p.pref_intent,
              p.pref_age_min, p.pref_age_max, p.interests, p.last_seen_at,
              (p.last_seen_at > now() - interval '5 minutes') as online,
              public.distance_km(mlat, mlng, a.lat, a.lng) as km
            from (
              -- Search looks at everyone; otherwise the most recently active people
              select * from profiles p0
              where case when q is not null then p0.display_name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%'
                         else p0.last_seen_at > now() - interval '30 days' end
              order by p0.last_seen_at desc nulls last
              limit 600
            ) p
            left join accounts_private a on a.user_id = p.id
            where public.explore_visible(uid, p.id)
          ) c
        ) s
        order by rank
        limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
      ) t), '[]'::json)
  );
end $$;

-- Masked chats: is the other person online? (ages aren't shown in chats any more)
create or replace function public.get_masquerade(p_session uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
  other uuid;
  op profiles;
  mp profiles;
  i_am_a boolean;
  m meet_posts;
  pair boolean;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then return null; end if;
  pair := s.hour_at is not null or s.meet_id is not null;
  if s.status = 'active' and (
       (pair and now() >= s.ends_at)
       or (not pair and now() > s.ends_at + interval '90 seconds')) then
    perform public.finalize_masquerade(p_session);
    select * into s from masquerade_sessions where id = p_session;
  end if;
  if s.meet_id is not null then
    select * into m from meet_posts where id = s.meet_id;
    if m.kind = 'game' and s.status = 'active' then perform public.meet_queue_next(m.id); end if;
  end if;

  i_am_a := s.user_a = uid;
  other := case when i_am_a then s.user_b else s.user_a end;
  select * into op from profiles where id = other;
  select * into mp from profiles where id = uid;

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
    'hourly', pair,
    'reopened', s.reopened_at is not null,
    'meet', case when m.id is null then null else json_build_object(
      'id', m.id, 'kind', m.kind, 'game', m.game, 'mine', i_am_a,
      'turn_pending', public.meet_turn_pending(s.id),
      -- People ahead of you in line (people waiting, if it's yours)
      'ahead', case when m.kind = 'game' then (
        select count(*) from masquerade_sessions x
        where x.meet_id = m.id and x.status = 'active' and now() < x.ends_at
          and not exists (select 1 from games g where g.session_id = x.id and g.started_at is not null)
          and (i_am_a or x.started_at < s.started_at)) end,
      -- Where your game in this meet is happening right now (if it's in another chat)
      'live_chat', case when i_am_a and m.kind = 'game' then (
        select json_build_object('id', x.id, 'alias', x.alias_b, 'status', g.status)
        from games g join masquerade_sessions x on x.id = g.session_id
        where x.meet_id = m.id and x.id <> s.id and g.status in ('invited', 'active')
        limit 1) end) end,
    'me', json_build_object(
      'id', uid,
      'alias', case when i_am_a then s.alias_a else s.alias_b end,
      'spice', case when i_am_a then s.spice_a else s.spice_b end,
      'vote', case when i_am_a then s.unmask_a else s.unmask_b end
    ),
    'them', json_build_object(
      'alias', case when i_am_a then s.alias_b else s.alias_a end,
      'spice', case when i_am_a then s.spice_b else s.spice_a end,
      -- Ages aren't shown in chats
      'age', null,
      'gender', op.gender,
      'interests', op.interests,
      'shared_interests', array(select unnest(op.interests) intersect select unnest(mp.interests)),
      'distance_km', null,
      'place', op.place_label,
      'same_place', op.place_country = mp.place_country and op.place_region = mp.place_region,
      'connections', (select count(*) from matches x where op.id in (x.user_a, x.user_b)),
      'reply_seconds', public.reply_seconds(op.id),
      'has_voted', (case when i_am_a then s.unmask_b else s.unmask_a end) is not null,
      -- Whether they're in the app right now, and roughly how long since they were
      'online', coalesce(op.last_seen_at > now() - interval '2 minutes', false),
      'seen_minutes', case when op.last_seen_at is not null then floor(extract(epoch from now() - op.last_seen_at) / 60)::int end,
      -- Only revealed after you both unmask
      'profile', case when s.status = 'matched' then json_build_object(
        'id', op.id, 'display_name', op.display_name, 'bio', op.bio, 'photos', op.photos
      ) else null end
    )
  );
end $$;

-- ---------------------------------------------------------------------------
-- Part 32: Things about you
-- Everyone can fill in cards like "My comfort food is… Jollof rice". When they
-- save, the key words are pulled out once (jollof, rice) and kept beside them.
-- Matching then just counts shared words: no AI, and cheap, because the words
-- are worked out on save, not while matching.
-- Finishing the setup checklist (where you are, notifications, 10 things) earns
-- Keys once (5 by default, set in admin).
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists things jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists thing_keys text[] not null default '{}';
alter table public.accounts_private add column if not exists setup_reward_at timestamptz;
insert into public.app_settings (key, value) values ('setup_reward', 5) on conflict (key) do nothing;

-- The key words in someone's answers: lower case, no little words, "jollof rice" -> {jollof, rice}
create or replace function public.thing_keywords(t jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct w order by w), '{}') from (
    select case when length(w) > 4 and w like '%s' and w not like '%ss' then left(w, -1) else w end as w
    from jsonb_array_elements(case when jsonb_typeof(t) = 'array' then t else '[]'::jsonb end) x,
      regexp_split_to_table(lower(coalesce(x->>'a', '')), '[^[:alnum:]]+') w
    where length(w) >= 3
      and w not in ('the','and','for','with','you','your','are','but','not','all','any','can','get','got','has','have',
        'her','him','his','its','just','like','love','loves','lot','lots','make','more','most','much','myself','nothing',
        'one','our','out','really','she','that','them','then','there','they','this','too','very','was','way','what',
        'when','who','why','will','yes','also','about','into','over','some','than','from','being','been','does','doing',
        'every','everything','good','great','thing','things','time','day','days','best','favourite','favorite')
  ) k
$$;

create or replace function public.profiles_thing_keys() returns trigger
language plpgsql as $$
begin
  new.thing_keys := public.thing_keywords(new.things);
  return new;
end $$;
drop trigger if exists profiles_thing_keys on public.profiles;
create trigger profiles_thing_keys before insert or update of things on public.profiles
  for each row execute function public.profiles_thing_keys();

-- Save your things (each is a prompt id and a short answer; up to 40)
create or replace function public.set_things(p_things jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean jsonb;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if jsonb_typeof(p_things) <> 'array' then raise exception 'Something went wrong'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('p', p, 'a', a) order by n), '[]'::jsonb) into clean from (
    select left(btrim(x->>'p'), 24) as p, left(regexp_replace(btrim(x->>'a'), '\s+', ' ', 'g'), 60) as a, n
    from jsonb_array_elements(p_things) with ordinality as e(x, n)
    where coalesce(btrim(x->>'a'), '') <> '' and coalesce(btrim(x->>'p'), '') <> ''
    limit 40
  ) t;
  update profiles set things = clean where id = uid;
  return json_build_object('things', clean, 'count', jsonb_array_length(clean));
end $$;

-- The Home checklist: what's done, and whether the Keys were claimed
create or replace function public.setup_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'place', p.place_country is not null,
    'push', exists (select 1 from push_subscriptions s where s.user_id = p.id),
    'things', jsonb_array_length(p.things),
    'claimed', a.setup_reward_at is not null,
    'reward', public.setting_int('setup_reward', 5))
  from profiles p left join accounts_private a on a.user_id = p.id
  where p.id = auth.uid()
$$;

-- Claim the Keys once everything is done. Notifications count unless this phone can't do them.
create or replace function public.claim_setup_reward(p_no_push boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  reward int := public.setting_int('setup_reward', 5);
  bal int;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into p from profiles where id = uid;
  insert into accounts_private (user_id) values (uid) on conflict (user_id) do nothing;
  perform 1 from accounts_private where user_id = uid for update;
  if (select setup_reward_at from accounts_private where user_id = uid) is not null then raise exception 'Already claimed'; end if;
  if p.place_country is null then raise exception 'Add where you are first'; end if;
  if jsonb_array_length(p.things) < 10 then raise exception 'Add 10 things about you first'; end if;
  if not p_no_push and not exists (select 1 from push_subscriptions where user_id = uid) then
    raise exception 'Turn on notifications first';
  end if;
  update accounts_private set setup_reward_at = now() where user_id = uid;
  bal := case when reward > 0 then public.add_keys(uid, reward, 'setup') else (select balance from wallets where user_id = uid) end;
  return json_build_object('reward', reward, 'balance', coalesce(bal, 0));
end $$;

-- Admin: the most common answers, as ideas for new This or That cards
create or replace function public.admin_thing_ideas(p_limit int default 60) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select x->>'p' as prompt, initcap(lower(btrim(x->>'a'))) as answer, count(*)::int as people
    from profiles, jsonb_array_elements(things) x
    group by 1, 2
    having count(*) >= 1
    order by count(*) desc, 2
    limit greatest(1, least(p_limit, 200))
  ) t
$$;
revoke all on function public.admin_thing_ideas(int) from public, anon, authenticated;

-- Hourly pairing: also prefers people who share words from their things
create or replace function public.run_hourly_pairing() returns int
language plpgsql security definer set search_path = public as $$
declare
  h timestamptz := date_trunc('hour', now());
  r record;
  partner record;
  sid uuid;
  a1 text;
  q text;
  n int := 0;
  lvl smallint;
begin
  -- Close chats from hours that have ended
  for r in select id from masquerade_sessions
           where hour_at is not null and status = 'active' and reopened_at is null and ends_at <= now() loop
    perform public.finalize_masquerade(r.id);
  end loop;

  if not public.pairing_hour_open(h) then return 0; end if;
  perform pg_advisory_xact_lock(515151);
  if exists (select 1 from masquerade_hours where hour_at = h) then return 0; end if;
  insert into masquerade_hours (hour_at) values (h);
  -- Too late in the hour to start a fair chat: wait for the next one
  if now() > h + interval '45 minutes' then
    update masquerade_hours set note = 'late' where hour_at = h;
    return 0;
  end if;

  drop table if exists pg_temp.hour_pool;
  create temp table hour_pool on commit drop as
    select p.id, p.gender, p.pref_intent, p.pref_seeking, p.pref_age_min, p.pref_age_max, p.pref_spice,
      p.interests, p.thing_keys, public.age_years(p.birthdate) as age, p.place_country, p.place_region, p.place_continent,
      coalesce(public.reply_seconds(p.id), 1800) as rs, random() as rnd
    from profiles p
    left join accounts_private a on a.user_id = p.id
    where p.open_to_masquerade
      and p.last_seen_at > now() - interval '24 hours'
      and p.display_name is not null and p.birthdate is not null and p.gender is not null
      and cardinality(p.photos) > 0
      and a.banned_at is null;

  update masquerade_hours set eligible = (select count(*) from hour_pool) where hour_at = h;

  -- Quick repliers choose first, so they get the best fits
  for r in select * from hour_pool order by rs, rnd loop
    continue when not exists (select 1 from hour_pool where id = r.id);
    select c.* into partner from hour_pool c
    where c.id <> r.id
      and c.pref_intent = r.pref_intent
      and public.gender_fits(r.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, r.gender)
      and c.age between r.pref_age_min and r.pref_age_max
      and r.age between c.pref_age_min and c.pref_age_max
      and not public.is_blocked(r.id, c.id)
      and not public.already_matched(r.id, c.id)
      -- New people every time (a pair that never talked can meet again)
      and not exists (select 1 from masquerade_sessions s
                      where s.hour_at is not null
                        and ((s.user_a = r.id and s.user_b = c.id) or (s.user_a = c.id and s.user_b = r.id))
                        and not (s.status = 'ended' and s.ended_reason = 'quiet'))
    -- Closest first: same state, then same country, then same continent, then anywhere
    order by (c.place_country = r.place_country and c.place_region = r.place_region) desc nulls last,
      (c.place_country = r.place_country) desc nulls last,
      (c.place_continent = r.place_continent) desc nulls last,
      -- What you have in common: interests, and words from your "things about me"
      public.shared_count(r.interests, c.interests) + 2 * least(public.shared_count(r.thing_keys, c.thing_keys), 5) desc,
      (c.rs < 600) desc, c.rs, c.rnd
    limit 1;
    continue when not found;

    a1 := public.random_alias();
    lvl := round((r.pref_spice + partner.pref_spice) / 2.0)::smallint;
    insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, hour_at)
    values (r.id, partner.id, r.pref_intent, r.pref_spice, partner.pref_spice, lvl, a1, public.random_alias(a1), now(), h + interval '1 hour', h)
    returning id into sid;
    q := public.pick_icebreaker(sid, lvl, null);
    if q is not null then
      insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q);
    end if;
    delete from hour_pool where id in (r.id, partner.id);
    n := n + 1;
  end loop;

  update masquerade_hours set pairs = n where hour_at = h;
  return n;
end $$;

-- Meet: shared words count towards the ranking
create or replace function public.explore_people(p_q text default null, p_limit int default 50, p_offset int default 0) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  my_age int;
  mlat double precision;
  mlng double precision;
  q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into me from profiles where id = uid;
  my_age := public.age_years(me.birthdate);
  select lat, lng into mlat, mlng from accounts_private where user_id = uid;
  return json_build_object(
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    'people', coalesce((
      select json_agg(row_to_json(t) order by t.rank) from (
        -- Age only for people you're connected with; what they're in the mood for only shows in your chat
        select s.id, s.name,
          case when public.explore_match_id(uid, s.id) is not null then s.age end as age,
          s.gender, s.photo, s.place, null::text as intent, s.online,
          public.explore_match_id(uid, s.id) is not null as connected,
          row_number() over (order by s.score desc, s.km asc nulls last, s.last_seen_at desc) as rank
        from (
          select c.*,
            (case when q is not null and lower(c.name) = lower(q) then 1000 else 0 end)
            -- How well you fit each other
            + (case when public.gender_fits(me.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, me.gender) then 40
                    when public.gender_fits(me.pref_seeking, c.gender) then 20 else 0 end)
            + (case when c.pref_intent = me.pref_intent then 15 else 0 end)
            + (case when c.age between me.pref_age_min and me.pref_age_max then 15 else 0 end)
            + (case when my_age between c.pref_age_min and c.pref_age_max then 10 else 0 end)
            -- How close they are
            + (case when c.km is not null then greatest(0, 20 - c.km / 5)
                    when c.place_country = me.place_country and c.place_region = me.place_region then 14
                    when c.place_country = me.place_country then 6 else 0 end)
            -- What you share, and whether they're around
            + least(public.shared_count(me.interests, c.interests), 5) * 3
            -- Words you both used in your "things about me" (jollof, arsenal, afrobeats…)
            + least(public.shared_count(me.thing_keys, c.thing_keys), 5) * 4
            + (case when c.online then 8 when c.last_seen_at > now() - interval '1 day' then 4 else 0 end)
            as score
          from (
            select p.id, p.display_name as name, public.age_years(p.birthdate) as age, p.gender, p.photos[1] as photo,
              p.place_label as place, p.place_country, p.place_region, p.pref_seeking, p.pref_intent,
              p.pref_age_min, p.pref_age_max, p.interests, p.thing_keys, p.last_seen_at,
              (p.last_seen_at > now() - interval '5 minutes') as online,
              public.distance_km(mlat, mlng, a.lat, a.lng) as km
            from (
              -- Search looks at everyone; otherwise the most recently active people
              select * from profiles p0
              where case when q is not null then p0.display_name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%'
                         else p0.last_seen_at > now() - interval '30 days' end
              order by p0.last_seen_at desc nulls last
              limit 600
            ) p
            left join accounts_private a on a.user_id = p.id
            where public.explore_visible(uid, p.id)
          ) c
        ) s
        order by rank
        limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
      ) t), '[]'::json)
  );
end $$;

-- Masked chats: words you both used
create or replace function public.get_masquerade(p_session uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
  other uuid;
  op profiles;
  mp profiles;
  i_am_a boolean;
  m meet_posts;
  pair boolean;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then return null; end if;
  pair := s.hour_at is not null or s.meet_id is not null;
  if s.status = 'active' and (
       (pair and now() >= s.ends_at)
       or (not pair and now() > s.ends_at + interval '90 seconds')) then
    perform public.finalize_masquerade(p_session);
    select * into s from masquerade_sessions where id = p_session;
  end if;
  if s.meet_id is not null then
    select * into m from meet_posts where id = s.meet_id;
    if m.kind = 'game' and s.status = 'active' then perform public.meet_queue_next(m.id); end if;
  end if;

  i_am_a := s.user_a = uid;
  other := case when i_am_a then s.user_b else s.user_a end;
  select * into op from profiles where id = other;
  select * into mp from profiles where id = uid;

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
    'hourly', pair,
    'reopened', s.reopened_at is not null,
    'meet', case when m.id is null then null else json_build_object(
      'id', m.id, 'kind', m.kind, 'game', m.game, 'mine', i_am_a,
      'turn_pending', public.meet_turn_pending(s.id),
      -- People ahead of you in line (people waiting, if it's yours)
      'ahead', case when m.kind = 'game' then (
        select count(*) from masquerade_sessions x
        where x.meet_id = m.id and x.status = 'active' and now() < x.ends_at
          and not exists (select 1 from games g where g.session_id = x.id and g.started_at is not null)
          and (i_am_a or x.started_at < s.started_at)) end,
      -- Where your game in this meet is happening right now (if it's in another chat)
      'live_chat', case when i_am_a and m.kind = 'game' then (
        select json_build_object('id', x.id, 'alias', x.alias_b, 'status', g.status)
        from games g join masquerade_sessions x on x.id = g.session_id
        where x.meet_id = m.id and x.id <> s.id and g.status in ('invited', 'active')
        limit 1) end) end,
    'me', json_build_object(
      'id', uid,
      'alias', case when i_am_a then s.alias_a else s.alias_b end,
      'spice', case when i_am_a then s.spice_a else s.spice_b end,
      'vote', case when i_am_a then s.unmask_a else s.unmask_b end
    ),
    'them', json_build_object(
      'alias', case when i_am_a then s.alias_b else s.alias_a end,
      'spice', case when i_am_a then s.spice_b else s.spice_a end,
      -- Ages aren't shown in chats
      'age', null,
      'gender', op.gender,
      'interests', op.interests,
      'shared_interests', array(select unnest(op.interests) intersect select unnest(mp.interests)),
      -- Words you both used in "things about me"
      'shared_words', (array(select unnest(op.thing_keys) intersect select unnest(mp.thing_keys)))[1:5],
      'distance_km', null,
      'place', op.place_label,
      'same_place', op.place_country = mp.place_country and op.place_region = mp.place_region,
      'connections', (select count(*) from matches x where op.id in (x.user_a, x.user_b)),
      'reply_seconds', public.reply_seconds(op.id),
      'has_voted', (case when i_am_a then s.unmask_b else s.unmask_a end) is not null,
      -- Whether they're in the app right now, and roughly how long since they were
      'online', coalesce(op.last_seen_at > now() - interval '2 minutes', false),
      'seen_minutes', case when op.last_seen_at is not null then floor(extract(epoch from now() - op.last_seen_at) / 60)::int end,
      -- Only revealed after you both unmask
      'profile', case when s.status = 'matched' then json_build_object(
        'id', op.id, 'display_name', op.display_name, 'bio', op.bio, 'photos', op.photos
      ) else null end
    )
  );
end $$;

-- Meet profiles: their things, and the words you both used
create or replace function public.explore_profile(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  mid uuid;
  open boolean;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if not public.explore_visible(uid, p_id) then return null; end if;
  select * into p from profiles where id = p_id;
  mid := public.explore_match_id(uid, p_id);
  open := mid is not null or exists (select 1 from photo_unlocks where viewer = uid and target = p_id);
  return json_build_object(
    'id', p.id, 'name', p.display_name, 'age', case when mid is not null then public.age_years(p.birthdate) end, 'gender', p.gender,
    'bio', p.bio, 'interests', p.interests, 'place', p.place_label,
    -- What they're in the mood for only shows in your chat
    'intent', null,
    'online', p.last_seen_at > now() - interval '5 minutes',
    'photos', case when open then to_json(p.photos) else to_json(array[p.photos[1]]) end,
    'photo_count', cardinality(p.photos),
    'photos_unlocked', open,
    'match_id', mid,
    'shared_interests', array(select unnest(p.interests) intersect select unnest((select interests from profiles where id = uid))),
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    -- Their "things about me", and the words you both used
    'things', p.things,
    'shared_words', (array(select unnest(p.thing_keys) intersect select unnest((select thing_keys from profiles where id = uid))))[1:5]
  );
end $$;

-- ---------------------------------------------------------------------------
-- Part 33: Security and cost fixes
-- 1. People could edit some parts of their own profile directly that only Dashpad
--    should change: ghost mode (free, forever), their matching words, when they
--    were last online, and photo links from other websites. Those are now
--    protected, and a birthday can only be set while signing up (18+ only).
-- 2. "Usually replies in…" was worked out from 60 days of messages every time a
--    masked chat refreshed and for everyone at every hourly pairing. It's now
--    kept for each person and refreshed every few hours, a little at a time.
-- 3. Extra details sent with a photo or voice note are capped in size.
-- ---------------------------------------------------------------------------

-- 1. Guard direct profile edits from the app (Dashpad's own functions aren't affected)
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
declare
  url text;
begin
  if current_user <> 'authenticated' then return new; end if;
  new.id := old.id;
  new.created_at := old.created_at;
  -- Ghost mode is paid for through set_ghost
  new.ghost_on := old.ghost_on;
  new.ghost_until := old.ghost_until;
  -- Online status comes from the app's check-in
  new.last_seen_at := old.last_seen_at;
  -- Matching words always come from the answers
  new.thing_keys := public.thing_keywords(new.things);
  if jsonb_typeof(new.things) <> 'array' or jsonb_array_length(new.things) > 40 or pg_column_size(new.things) > 8000 then
    raise exception 'Too many things';
  end if;
  -- A birthday is set while signing up, and you have to be 18
  if new.birthdate is distinct from old.birthdate then
    if old.birthdate is not null and cardinality(coalesce(old.photos, '{}')) > 0 then
      raise exception 'Your birthday can''t be changed. Contact support if it''s wrong.';
    end if;
    if new.birthdate is null or public.age_years(new.birthdate) < 18 then
      raise exception 'You need to be 18 or older to use Dashpad';
    end if;
  end if;
  -- Photos: up to 6, and only ones uploaded to your own folder on Dashpad
  if cardinality(coalesce(new.photos, '{}')) > 6 then raise exception 'Up to 6 photos'; end if;
  foreach url in array coalesce(new.photos, '{}') loop
    -- (only new ones are checked, so older photos never get in the way)
    if not (url = any(coalesce(old.photos, '{}'))) and position('/storage/v1/object/public/photos/' || new.id::text || '/' in url) = 0 then
      raise exception 'Photos must be uploaded to Dashpad';
    end if;
  end loop;
  if cardinality(coalesce(new.interests, '{}')) > 12 then raise exception 'Too many interests'; end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Anyone who already gave themselves ghost mode without paying loses it
update public.profiles p set ghost_on = false, ghost_until = null
where p.ghost_until is not null
  and not exists (select 1 from public.key_transactions k where k.user_id = p.id and k.reason = 'ghost' and k.created_at > p.ghost_until - interval '31 days');

-- Matching words: always rebuilt from the answers
update public.profiles set thing_keys = public.thing_keywords(things) where thing_keys is distinct from public.thing_keywords(things);

-- 2. Reply speed, kept per person instead of worked out every time
create table if not exists public.reply_stats (
  user_id uuid primary key references public.profiles on delete cascade,
  seconds int,
  updated_at timestamptz not null default now()
);
alter table public.reply_stats enable row level security;

-- The full calculation (only used to refresh the stored number)
create or replace function public.reply_seconds_compute(p uuid) returns int
language sql stable security definer set search_path = public as $$
  with mine as (
    select m.match_id as chat, m.sender_id, m.created_at, m.id
    from messages m join matches x on x.id = m.match_id
    where p in (x.user_a, x.user_b) and m.created_at > now() - interval '60 days' and m.kind <> 'call'
    union all
    select mm.session_id, mm.sender_id, mm.created_at, mm.id
    from masquerade_messages mm join masquerade_sessions s on s.id = mm.session_id
    where p in (s.user_a, s.user_b) and mm.created_at > now() - interval '60 days' and mm.sender_id is not null
  ), steps as (
    select sender_id, created_at,
      lag(sender_id) over (partition by chat order by created_at, id) as prev_sender,
      lag(created_at) over (partition by chat order by created_at, id) as prev_at
    from mine
  ), replies as (
    select extract(epoch from created_at - prev_at) as secs from steps
    where sender_id = p and prev_sender is not null and prev_sender <> p
      and created_at - prev_at < interval '12 hours'
  )
  select case when count(*) >= 3 then (percentile_cont(0.5) within group (order by secs))::int end from replies
$$;
revoke all on function public.reply_seconds_compute(uuid) from public, anon, authenticated;

-- Everything that showed or used reply speed now reads the stored number (instant)
create or replace function public.reply_seconds(p uuid) returns int
language sql stable security definer set search_path = public as $$
  select seconds from reply_stats where user_id = p
$$;

-- Refresh a few hundred people at a time: those around today whose number is old
create or replace function public.refresh_reply_stats(p_limit int default 300) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select p.id from profiles p left join reply_stats s on s.user_id = p.id
    where p.last_seen_at > now() - interval '1 day'
      and (s.user_id is null or s.updated_at < now() - interval '6 hours')
    order by s.updated_at nulls first
    limit greatest(1, least(p_limit, 2000))
  loop
    insert into reply_stats (user_id, seconds, updated_at) values (r.id, public.reply_seconds_compute(r.id), now())
    on conflict (user_id) do update set seconds = excluded.seconds, updated_at = excluded.updated_at;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.refresh_reply_stats(int) from public, anon, authenticated;

-- Fill it in now for everyone around this week
select public.refresh_reply_stats(2000);

-- 3. Photo, video and voice note details stay small
alter table public.messages drop constraint if exists messages_meta_small;
alter table public.messages add constraint messages_meta_small check (media_meta is null or pg_column_size(media_meta) <= 4000) not valid;

-- ---------------------------------------------------------------------------
-- Part 34: Who's most likely to reply comes first
-- For each person Dashpad quietly keeps (and refreshes every few hours, a few
-- hundred at a time): how quickly they reply, how often they reply when someone
-- writes to them, and how many messages they sent this week. With how recently
-- they were online, these lift people on Meet and in People for you. Nobody sees
-- these numbers.
-- Names can be changed once after signing up.
-- ---------------------------------------------------------------------------
alter table public.reply_stats add column if not exists reply_rate real;
alter table public.reply_stats add column if not exists sent_7d int;
alter table public.profiles add column if not exists name_changes smallint not null default 0;

-- How often someone replies when written to (last 60 days; empty if too few chats), and messages sent this week
create or replace function public.chat_habits_compute(p uuid) returns table (rate real, sent int)
language sql stable security definer set search_path = public as $$
  with convos as (
    select m.match_id::text as chat,
      bool_or(m.sender_id is not null and m.sender_id <> p) as they_wrote,
      bool_or(m.sender_id = p) as i_wrote,
      count(*) filter (where m.sender_id = p and m.created_at > now() - interval '7 days') as sent
    from messages m join matches x on x.id = m.match_id
    where p in (x.user_a, x.user_b) and m.created_at > now() - interval '60 days'
    group by 1
    union all
    select mm.session_id::text,
      bool_or(mm.sender_id is not null and mm.sender_id <> p),
      bool_or(mm.sender_id = p),
      count(*) filter (where mm.sender_id = p and mm.created_at > now() - interval '7 days')
    from masquerade_messages mm join masquerade_sessions s on s.id = mm.session_id
    where p in (s.user_a, s.user_b) and mm.created_at > now() - interval '60 days'
    group by 1
  )
  select
    case when count(*) filter (where they_wrote) >= 2
      then (count(*) filter (where they_wrote and i_wrote))::real / count(*) filter (where they_wrote) end,
    coalesce(sum(sent), 0)::int
  from convos
$$;
revoke all on function public.chat_habits_compute(uuid) from public, anon, authenticated;

create or replace function public.refresh_reply_stats(p_limit int default 300) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  h record;
  n int := 0;
begin
  for r in
    select p.id from profiles p left join reply_stats s on s.user_id = p.id
    where p.last_seen_at > now() - interval '1 day'
      and (s.user_id is null or s.updated_at < now() - interval '6 hours')
    order by s.updated_at nulls first
    limit greatest(1, least(p_limit, 2000))
  loop
    select * into h from public.chat_habits_compute(r.id);
    insert into reply_stats (user_id, seconds, reply_rate, sent_7d, updated_at)
    values (r.id, public.reply_seconds_compute(r.id), h.rate, h.sent, now())
    on conflict (user_id) do update set seconds = excluded.seconds, reply_rate = excluded.reply_rate,
      sent_7d = excluded.sent_7d, updated_at = excluded.updated_at;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.refresh_reply_stats(int) from public, anon, authenticated;

-- Fill in the new numbers now (they refresh by themselves after this)
update public.reply_stats set updated_at = now() - interval '7 hours';
select public.refresh_reply_stats(2000);

create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
declare
  url text;
begin
  if current_user <> 'authenticated' then return new; end if;
  new.id := old.id;
  new.created_at := old.created_at;
  -- Your name can be changed once after signing up
  if new.display_name is distinct from old.display_name and old.display_name is not null and cardinality(coalesce(old.photos, '{}')) > 0 then
    if old.name_changes >= 1 then raise exception 'You''ve already changed your name once'; end if;
    new.name_changes := old.name_changes + 1;
  else
    new.name_changes := old.name_changes;
  end if;
  -- Ghost mode is paid for through set_ghost
  new.ghost_on := old.ghost_on;
  new.ghost_until := old.ghost_until;
  -- Online status comes from the app's check-in
  new.last_seen_at := old.last_seen_at;
  -- Matching words always come from the answers
  new.thing_keys := public.thing_keywords(new.things);
  if jsonb_typeof(new.things) <> 'array' or jsonb_array_length(new.things) > 40 or pg_column_size(new.things) > 8000 then
    raise exception 'Too many things';
  end if;
  -- A birthday is set while signing up, and you have to be 18
  if new.birthdate is distinct from old.birthdate then
    if old.birthdate is not null and cardinality(coalesce(old.photos, '{}')) > 0 then
      raise exception 'Your birthday can''t be changed. Contact support if it''s wrong.';
    end if;
    if new.birthdate is null or public.age_years(new.birthdate) < 18 then
      raise exception 'You need to be 18 or older to use Dashpad';
    end if;
  end if;
  -- Photos: up to 6, and only ones uploaded to your own folder on Dashpad
  if cardinality(coalesce(new.photos, '{}')) > 6 then raise exception 'Up to 6 photos'; end if;
  foreach url in array coalesce(new.photos, '{}') loop
    -- (only new ones are checked, so older photos never get in the way)
    if not (url = any(coalesce(old.photos, '{}'))) and position('/storage/v1/object/public/photos/' || new.id::text || '/' in url) = 0 then
      raise exception 'Photos must be uploaded to Dashpad';
    end if;
  end loop;
  if cardinality(coalesce(new.interests, '{}')) > 12 then raise exception 'Too many interests'; end if;
  return new;
end $$;

create or replace function public.explore_people(p_q text default null, p_limit int default 50, p_offset int default 0) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  my_age int;
  mlat double precision;
  mlng double precision;
  q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into me from profiles where id = uid;
  my_age := public.age_years(me.birthdate);
  select lat, lng into mlat, mlng from accounts_private where user_id = uid;
  return json_build_object(
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    'people', coalesce((
      select json_agg(row_to_json(t) order by t.rank) from (
        -- Age only for people you're connected with; what they're in the mood for only shows in your chat
        select s.id, s.name,
          case when public.explore_match_id(uid, s.id) is not null then s.age end as age,
          s.gender, s.photo, s.place, null::text as intent, s.online,
          public.explore_match_id(uid, s.id) is not null as connected,
          row_number() over (order by s.score desc, s.km asc nulls last, s.last_seen_at desc) as rank
        from (
          select c.*,
            (case when q is not null and lower(c.name) = lower(q) then 1000 else 0 end)
            -- How well you fit each other
            + (case when public.gender_fits(me.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, me.gender) then 40
                    when public.gender_fits(me.pref_seeking, c.gender) then 20 else 0 end)
            + (case when c.pref_intent = me.pref_intent then 15 else 0 end)
            + (case when c.age between me.pref_age_min and me.pref_age_max then 15 else 0 end)
            + (case when my_age between c.pref_age_min and c.pref_age_max then 10 else 0 end)
            -- How close they are
            + (case when c.km is not null then greatest(0, 20 - c.km / 5)
                    when c.place_country = me.place_country and c.place_region = me.place_region then 14
                    when c.place_country = me.place_country then 6 else 0 end)
            -- What you share, and whether they're around
            + least(public.shared_count(me.interests, c.interests), 5) * 3
            -- Words you both used in your "things about me" (jollof, arsenal, afrobeats…)
            + least(public.shared_count(me.thing_keys, c.thing_keys), 5) * 4
            -- Who's around: online now first, then how recently they were in the app
            + (case when c.online then 25 when c.last_seen_at > now() - interval '1 hour' then 12
                    when c.last_seen_at > now() - interval '1 day' then 6 when c.last_seen_at > now() - interval '7 days' then 2 else 0 end)
            -- Most likely to reply (stored per person, refreshed every few hours): how fast, how often, how active
            + (case when c.reply_s is null then 0 when c.reply_s < 120 then 10 when c.reply_s < 600 then 6 when c.reply_s < 3600 then 3 else 0 end)
            + coalesce(c.reply_rate, 0.5) * 10
            + least(coalesce(c.sent_7d, 0), 60) / 6.0
            as score
          from (
            select p.id, p.display_name as name, public.age_years(p.birthdate) as age, p.gender, p.photos[1] as photo,
              p.place_label as place, p.place_country, p.place_region, p.pref_seeking, p.pref_intent,
              p.pref_age_min, p.pref_age_max, p.interests, p.thing_keys, p.last_seen_at,
              (p.last_seen_at > now() - interval '5 minutes') as online,
              public.distance_km(mlat, mlng, a.lat, a.lng) as km,
              rs.seconds as reply_s, rs.reply_rate, rs.sent_7d
            from (
              -- Search looks at everyone; otherwise the most recently active people
              select * from profiles p0
              where case when q is not null then p0.display_name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%'
                         else p0.last_seen_at > now() - interval '30 days' end
              order by p0.last_seen_at desc nulls last
              limit 600
            ) p
            left join accounts_private a on a.user_id = p.id
            left join reply_stats rs on rs.user_id = p.id
            where public.explore_visible(uid, p.id)
          ) c
        ) s
        order by rank
        limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
      ) t), '[]'::json)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Part 35: No limit on name changes
-- Everything else the profile guard protects stays the same.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
declare
  url text;
begin
  if current_user <> 'authenticated' then return new; end if;
  new.id := old.id;
  new.created_at := old.created_at;
  -- Ghost mode is paid for through set_ghost
  new.ghost_on := old.ghost_on;
  new.ghost_until := old.ghost_until;
  -- Online status comes from the app's check-in
  new.last_seen_at := old.last_seen_at;
  -- Matching words always come from the answers
  new.thing_keys := public.thing_keywords(new.things);
  if jsonb_typeof(new.things) <> 'array' or jsonb_array_length(new.things) > 40 or pg_column_size(new.things) > 8000 then
    raise exception 'Too many things';
  end if;
  -- A birthday is set while signing up, and you have to be 18
  if new.birthdate is distinct from old.birthdate then
    if old.birthdate is not null and cardinality(coalesce(old.photos, '{}')) > 0 then
      raise exception 'Your birthday can''t be changed. Contact support if it''s wrong.';
    end if;
    if new.birthdate is null or public.age_years(new.birthdate) < 18 then
      raise exception 'You need to be 18 or older to use Dashpad';
    end if;
  end if;
  -- Photos: up to 6, and only ones uploaded to your own folder on Dashpad
  if cardinality(coalesce(new.photos, '{}')) > 6 then raise exception 'Up to 6 photos'; end if;
  foreach url in array coalesce(new.photos, '{}') loop
    -- (only new ones are checked, so older photos never get in the way)
    if not (url = any(coalesce(old.photos, '{}'))) and position('/storage/v1/object/public/photos/' || new.id::text || '/' in url) = 0 then
      raise exception 'Photos must be uploaded to Dashpad';
    end if;
  end loop;
  if cardinality(coalesce(new.interests, '{}')) > 12 then raise exception 'Too many interests'; end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Part 36: Paying to message someone on Meet opens a masked chat
-- No more unmasking straight away: you're both masked, with no time limit, until
-- you both choose to unmask (then you're connected as usual). Reopened past pairs
-- work the same. Both now show in Chats, with unread dots.
-- ---------------------------------------------------------------------------
alter table public.masquerade_sessions add column if not exists source text;

-- When each person last opened a masked chat (for unread dots)
create table if not exists public.masked_reads (
  session_id uuid not null references public.masquerade_sessions on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  read_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
alter table public.masked_reads enable row level security;

-- Start (or carry on) a masked chat with someone from Meet. Returns where to go.
drop function if exists public.message_person(uuid);
create or replace function public.message_person(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mid uuid;
  sid uuid;
  cost int := public.setting_int('explore_message_cost', 15);
  me profiles;
  them profiles;
  a1 text;
  lvl smallint;
  q text;
begin
  if uid is null then raise exception 'Please log in'; end if;
  -- Already connected: just open your chat
  mid := public.explore_match_id(uid, p_id);
  if mid is not null then return json_build_object('kind', 'match', 'id', mid); end if;
  -- Already have a masked chat with them from Meet: open it (no charge)
  select id into sid from masquerade_sessions
  where source = 'explore' and status = 'active'
    and ((user_a = uid and user_b = p_id) or (user_a = p_id and user_b = uid))
  order by started_at desc limit 1;
  if sid is not null then return json_build_object('kind', 'masked', 'id', sid); end if;

  if not public.explore_visible(uid, p_id) then raise exception 'Not available'; end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  if (select count(*) from masquerade_sessions where source = 'explore' and user_a = uid and started_at > now() - interval '1 minute') >= 5 then
    raise exception 'Slow down a little';
  end if;
  select * into me from profiles where id = uid;
  select * into them from profiles where id = p_id;
  if cost > 0 then perform public.spend_keys(uid, cost, 'explore_message', p_id::text); end if;

  a1 := public.random_alias();
  lvl := round((coalesce(me.pref_spice, 1) + coalesce(them.pref_spice, 1)) / 2.0)::smallint;
  insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, source)
  values (uid, p_id, me.pref_intent, coalesce(me.pref_spice, 1), coalesce(them.pref_spice, 1), lvl, a1, public.random_alias(a1), now(), 'infinity', 'explore')
  returning id into sid;
  insert into masquerade_messages (session_id, kind, body)
  values (sid, 'system', a1 || ' found you on Meet and started this chat. You''re both masked until you both unmask.');
  q := public.pick_icebreaker(sid, lvl, null);
  if q is not null then insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q); end if;
  return json_build_object('kind', 'masked', 'id', sid);
end $$;

-- Your open masked chats with no time limit (from Meet, or reopened), for the Chats page
create or replace function public.my_masked_chats() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.last_at desc), '[]'::json) from (
    select s.id,
      case when s.user_a = auth.uid() then s.alias_b else s.alias_a end as alias,
      case when s.user_a = auth.uid() then s.alias_a else s.alias_b end as my_alias,
      (s.source = 'explore') as from_meet,
      case when s.user_a = auth.uid() then s.unmask_a else s.unmask_b end as my_vote,
      (case when s.user_a = auth.uid() then s.unmask_b else s.unmask_a end) is true as they_unmasked,
      l.body as last_message, l.sender_id = auth.uid() as last_mine,
      coalesce(l.created_at, s.started_at) as last_at,
      exists (select 1 from masquerade_messages m where m.session_id = s.id and m.sender_id is not null and m.sender_id <> auth.uid()
        and m.created_at > coalesce((select r.read_at from masked_reads r where r.session_id = s.id and r.user_id = auth.uid()), '-infinity'::timestamptz)) as unread
    from masquerade_sessions s
    left join lateral (
      select m.body, m.sender_id, m.created_at from masquerade_messages m
      where m.session_id = s.id and m.kind in ('text', 'gift') order by m.id desc limit 1) l on true
    where auth.uid() in (s.user_a, s.user_b) and s.status = 'active'
      and (s.source = 'explore' or s.reopened_at is not null)
  ) t
$$;

-- Unread masked chats, for the dot on Chats in the menu
create or replace function public.unread_masked_chats() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from masquerade_sessions s
  where auth.uid() in (s.user_a, s.user_b) and s.status = 'active'
    and (s.source = 'explore' or s.reopened_at is not null)
    and exists (select 1 from masquerade_messages m where m.session_id = s.id and m.sender_id is not null and m.sender_id <> auth.uid()
      and m.created_at > coalesce((select r.read_at from masked_reads r where r.session_id = s.id and r.user_id = auth.uid()), '-infinity'::timestamptz))
$$;

create or replace function public.get_masquerade(p_session uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
  other uuid;
  op profiles;
  mp profiles;
  i_am_a boolean;
  m meet_posts;
  pair boolean;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then return null; end if;
  -- Hourly pairs, meet chats and chats started from Meet: unmask any time
  pair := s.hour_at is not null or s.meet_id is not null or s.source = 'explore';
  if s.status = 'active' and (
       (pair and now() >= s.ends_at)
       or (not pair and now() > s.ends_at + interval '90 seconds')) then
    perform public.finalize_masquerade(p_session);
    select * into s from masquerade_sessions where id = p_session;
  end if;
  if s.meet_id is not null then
    select * into m from meet_posts where id = s.meet_id;
    if m.kind = 'game' and s.status = 'active' then perform public.meet_queue_next(m.id); end if;
  end if;

  i_am_a := s.user_a = uid;
  -- Opening the chat reads it (kept apart from the session, so it doesn't wake anyone's screen)
  insert into masked_reads (session_id, user_id, read_at) values (s.id, uid, now())
  on conflict (session_id, user_id) do update set read_at = now();
  other := case when i_am_a then s.user_b else s.user_a end;
  select * into op from profiles where id = other;
  select * into mp from profiles where id = uid;

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
    'hourly', pair,
    -- Open until you both decide: reopened past pairs and chats started from Meet
    'reopened', s.reopened_at is not null or s.source = 'explore',
    'explore', s.source = 'explore',
    'meet', case when m.id is null then null else json_build_object(
      'id', m.id, 'kind', m.kind, 'game', m.game, 'mine', i_am_a,
      'turn_pending', public.meet_turn_pending(s.id),
      -- People ahead of you in line (people waiting, if it's yours)
      'ahead', case when m.kind = 'game' then (
        select count(*) from masquerade_sessions x
        where x.meet_id = m.id and x.status = 'active' and now() < x.ends_at
          and not exists (select 1 from games g where g.session_id = x.id and g.started_at is not null)
          and (i_am_a or x.started_at < s.started_at)) end,
      -- Where your game in this meet is happening right now (if it's in another chat)
      'live_chat', case when i_am_a and m.kind = 'game' then (
        select json_build_object('id', x.id, 'alias', x.alias_b, 'status', g.status)
        from games g join masquerade_sessions x on x.id = g.session_id
        where x.meet_id = m.id and x.id <> s.id and g.status in ('invited', 'active')
        limit 1) end) end,
    'me', json_build_object(
      'id', uid,
      'alias', case when i_am_a then s.alias_a else s.alias_b end,
      'spice', case when i_am_a then s.spice_a else s.spice_b end,
      'vote', case when i_am_a then s.unmask_a else s.unmask_b end
    ),
    'them', json_build_object(
      'alias', case when i_am_a then s.alias_b else s.alias_a end,
      'spice', case when i_am_a then s.spice_b else s.spice_a end,
      -- Ages aren't shown in chats
      'age', null,
      'gender', op.gender,
      'interests', op.interests,
      'shared_interests', array(select unnest(op.interests) intersect select unnest(mp.interests)),
      -- Words you both used in "things about me"
      'shared_words', (array(select unnest(op.thing_keys) intersect select unnest(mp.thing_keys)))[1:5],
      'distance_km', null,
      'place', op.place_label,
      'same_place', op.place_country = mp.place_country and op.place_region = mp.place_region,
      'connections', (select count(*) from matches x where op.id in (x.user_a, x.user_b)),
      'reply_seconds', public.reply_seconds(op.id),
      'has_voted', (case when i_am_a then s.unmask_b else s.unmask_a end) is not null,
      -- Whether they're in the app right now, and roughly how long since they were
      'online', coalesce(op.last_seen_at > now() - interval '2 minutes', false),
      'seen_minutes', case when op.last_seen_at is not null then floor(extract(epoch from now() - op.last_seen_at) / 60)::int end,
      -- Only revealed after you both unmask
      'profile', case when s.status = 'matched' then json_build_object(
        'id', op.id, 'display_name', op.display_name, 'bio', op.bio, 'photos', op.photos
      ) else null end
    )
  );
end $$;

create or replace function public.vote_unmask(p_session uuid, p_unmask boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then raise exception 'Chat not found'; end if;
  if s.status not in ('active', 'lapsed') then return; end if;
  if p_unmask and s.hour_at is null and s.meet_id is null and s.source is distinct from 'explore' and now() < s.ends_at - interval '2 seconds' then
    raise exception 'You can unmask when the timer ends';
  end if;
  -- Tell them in the chat the first time you unmask (they get a notification too)
  if p_unmask and (case when uid = s.user_a then s.unmask_a else s.unmask_b end) is distinct from true
     and (case when uid = s.user_a then s.unmask_b else s.unmask_a end) is distinct from true then
    insert into masquerade_messages (session_id, kind, body)
    values (s.id, 'system', (case when uid = s.user_a then s.alias_a else s.alias_b end) || ' unmasked. Unmask too to connect');
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

create or replace function public.explore_profile(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  mid uuid;
  open boolean;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if not public.explore_visible(uid, p_id) then return null; end if;
  select * into p from profiles where id = p_id;
  mid := public.explore_match_id(uid, p_id);
  open := mid is not null or exists (select 1 from photo_unlocks where viewer = uid and target = p_id);
  return json_build_object(
    'id', p.id, 'name', p.display_name, 'age', case when mid is not null then public.age_years(p.birthdate) end, 'gender', p.gender,
    'bio', p.bio, 'interests', p.interests, 'place', p.place_label,
    -- What they're in the mood for only shows in your chat
    'intent', null,
    'online', p.last_seen_at > now() - interval '5 minutes',
    'photos', case when open then to_json(p.photos) else to_json(array[p.photos[1]]) end,
    'photo_count', cardinality(p.photos),
    'photos_unlocked', open,
    'match_id', mid,
    -- A masked chat you already have with them from Meet
    'masked_id', (select x.id from masquerade_sessions x where x.source = 'explore' and x.status = 'active'
      and ((x.user_a = uid and x.user_b = p_id) or (x.user_a = p_id and x.user_b = uid)) order by x.started_at desc limit 1),
    'shared_interests', array(select unnest(p.interests) intersect select unnest((select interests from profiles where id = uid))),
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    -- Their "things about me", and the words you both used
    'things', p.things,
    'shared_words', (array(select unnest(p.thing_keys) intersect select unnest((select thing_keys from profiles where id = uid))))[1:5]
  );
end $$;

-- Connect 4: the finished board stays up for 10 seconds before the next game
create or replace function public.game_c4_move(p_game uuid, p_col int, p_auto boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  st jsonb;
  who text;
  board text;
  r int;
  line int[];
  wins_a int; wins_b int;
  rnd int;
  starter text;
  over boolean := false;
  result text;
begin
  select * into g from games where id = p_game;
  st := g.state;
  who := st->>'turn';
  select new_board, d.r into board, r from public.game_c4_drop(st->>'board', p_col, who) d;
  if r < 0 then raise exception 'That column is full'; end if;
  st := st || jsonb_build_object('board', board, 'last', r * 7 + p_col, 'moves', (st->>'moves')::int + 1,
    'auto_' || who, case when p_auto then (st->>('auto_' || who))::int + 1 else 0 end);
  line := public.game_c4_line(board, r, p_col);
  wins_a := (st->'wins'->>'a')::int; wins_b := (st->'wins'->>'b')::int;
  rnd := (st->>'round')::int;

  if array_length(line, 1) >= 4 or position('.' in board) = 0 then
    result := case when array_length(line, 1) >= 4 then who else 'draw' end;
    if result = 'a' then wins_a := wins_a + 1; elsif result = 'b' then wins_b := wins_b + 1; end if;
    over := wins_a >= 2 or wins_b >= 2 or rnd >= 3;
    starter := case when st->>'starter' = 'a' then 'b' else 'a' end;
    -- Keep the finished board on show for a moment, then start the next round
    st := st || jsonb_build_object(
      'prev', jsonb_build_object('board', board, 'line', to_jsonb(line), 'winner', result, 'round', rnd),
      'wins', jsonb_build_object('a', wins_a, 'b', wins_b),
      'pause_until', now() + interval '10 seconds');
    if not over then
      st := st || jsonb_build_object('board', repeat('.', 42), 'round', rnd + 1, 'starter', starter, 'turn', starter, 'last', null, 'moves', 0);
    end if;
    update games set state = st, score_a = wins_a, score_b = wins_b,
      deadline_at = now() + public.game_idle()
    where id = g.id;
    if over then perform public.game_finish(g.id); end if;
    return;
  end if;

  st := st || jsonb_build_object('turn', case when who = 'a' then 'b' else 'a' end);
  update games set state = st, deadline_at = now() + public.game_idle() where id = g.id;
end $$;
revoke all on function public.game_c4_move(uuid, int, boolean) from public, anon, authenticated;

-- The setup reward needs all three: 10 things, where you are, and notifications on
create or replace function public.claim_setup_reward(p_no_push boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  reward int := public.setting_int('setup_reward', 5);
  bal int;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into p from profiles where id = uid;
  insert into accounts_private (user_id) values (uid) on conflict (user_id) do nothing;
  perform 1 from accounts_private where user_id = uid for update;
  if (select setup_reward_at from accounts_private where user_id = uid) is not null then raise exception 'Already claimed'; end if;
  if p.place_country is null then raise exception 'Add where you are first'; end if;
  if jsonb_array_length(p.things) < 10 then raise exception 'Add 10 things about you first'; end if;
  -- Notifications are part of it on every phone (on iPhone, once Dashpad is on the home screen)
  if not exists (select 1 from push_subscriptions where user_id = uid) then
    raise exception 'Turn on notifications first';
  end if;
  update accounts_private set setup_reward_at = now() where user_id = uid;
  bal := case when reward > 0 then public.add_keys(uid, reward, 'setup') else (select balance from wallets where user_id = uid) end;
  return json_build_object('reward', reward, 'balance', coalesce(bal, 0));
end $$;

-- ---------------------------------------------------------------------------
-- Part 37: a fresh icebreaker in a matched chat, picked at the average of both people's spice settings
-- (one neither of you has seen in this chat or while you were masked, when there is one)
-- ---------------------------------------------------------------------------
create or replace function public.match_icebreaker(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m matches;
  lvl smallint;
  q text;
begin
  select * into m from matches where id = p_match and (user_a = uid or user_b = uid);
  if not found then raise exception 'Not your chat'; end if;
  if public.is_blocked(m.user_a, m.user_b) then raise exception 'Not available'; end if;
  if (select count(*) from messages
      where match_id = p_match and sender_id is null and kind = 'text' and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Slow down a little';
  end if;

  select round((coalesce(a.pref_spice, 1) + coalesce(b.pref_spice, 1)) / 2.0)::smallint into lvl
  from profiles a, profiles b where a.id = m.user_a and b.id = m.user_b;

  select body into q from (
    select i.body, 0 as pri from icebreakers i
    where i.event_id is null and i.active and i.spice = lvl
      and not exists (select 1 from messages x where x.match_id = p_match and x.sender_id is null and x.body = '💬 ' || i.body)
      and not exists (select 1 from masquerade_messages x where x.session_id = m.session_id and x.kind = 'icebreaker' and x.body = i.body)
    union all
    select i.body, 1 from icebreakers i where i.event_id is null and i.active and i.spice = lvl
  ) x order by pri, random() limit 1;
  if q is null then return; end if;

  insert into messages (match_id, sender_id, kind, body) values (p_match, null, 'text', '💬 ' || q);
  update matches set last_message_at = now() where id = p_match;
end $$;
revoke execute on function public.match_icebreaker(uuid) from public, anon;
grant execute on function public.match_icebreaker(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Part 38a: slow reveal. A photo or video sent blurred that clears as you both chat
-- (5 messages each clears it fully), or right away for Keys. The full file can't be
-- opened by the other person until then; only a tiny blurry preview can.
-- ---------------------------------------------------------------------------
alter table public.messages add column if not exists slow boolean not null default false;
alter table public.messages add column if not exists slow_paid_at timestamptz;
alter table public.messages drop constraint if exists messages_slow_check;
alter table public.messages add constraint messages_slow_check check (not slow or kind in ('image', 'video'));
create index if not exists messages_slow_media on public.messages (media_path) where slow;
insert into public.app_settings (key, value) values ('slow_reveal_cost', 10) on conflict (key) do nothing;

drop policy if exists "send match messages" on public.messages;
create policy "send match messages" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and kind in ('text', 'image', 'video', 'audio')
    and deleted_at is null
    and slow_paid_at is null
    and (media_path is null or split_part(media_path, '/', 1) = match_id::text)
    and exists (select 1 from public.matches m where m.id = match_id and (m.user_a = auth.uid() or m.user_b = auth.uid()))
  );

-- How far along a slow reveal is: 0 to 10 (messages after it from each person, up to 5 each)
create or replace function public.slow_progress(m public.messages) returns int
language sql stable security definer set search_path = public as $$
  select (select count(*) from (
            select 1 from messages x where x.match_id = m.match_id and x.id > m.id and x.sender_id = m.sender_id
              and x.deleted_at is null and x.kind <> 'call' limit 5) a)::int
       + (select count(*) from (
            select 1 from messages x where x.match_id = m.match_id and x.id > m.id and x.sender_id <> m.sender_id
              and x.deleted_at is null and x.kind <> 'call' limit 5) b)::int
$$;
revoke execute on function public.slow_progress(public.messages) from public, anon, authenticated;

-- May you open this chat file? (Not a slow reveal someone else sent that hasn't cleared yet)
create or replace function public.chat_media_open(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from messages m
    where m.slow and m.media_path = p_name and m.sender_id <> auth.uid()
      and m.slow_paid_at is null and public.slow_progress(m) < 10
  )
$$;

drop policy if exists "match members read chat media" on storage.objects;
create policy "match members read chat media" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and public.in_match((storage.foldername(name))[1]) and public.chat_media_open(name));

-- Too curious to wait: reveal it now for Keys (the price is set in the admin)
create or replace function public.reveal_slow(p_message bigint) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m messages;
  cost int := public.setting_int('slow_reveal_cost', 10);
  bal int;
begin
  select * into m from messages where id = p_message and slow and deleted_at is null for update;
  if not found or not public.in_match(m.match_id::text) then raise exception 'Not available'; end if;
  if m.sender_id = uid or m.slow_paid_at is not null or public.slow_progress(m) >= 10 then
    return (select balance from wallets where user_id = uid);
  end if;
  bal := public.spend_keys(uid, cost, 'slow_reveal', p_message::text);
  update messages set slow_paid_at = now() where id = p_message;
  return bal;
end $$;
revoke execute on function public.reveal_slow(bigint) from public, anon;
grant execute on function public.reveal_slow(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Part 38b: a gift you receive turns into Keys right away, at half its price (rounded down)
-- ---------------------------------------------------------------------------
create or replace function public.send_gift(p_gift text, p_match uuid default null, p_session uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g gifts;
  bal int;
  them uuid;
begin
  select * into g from gifts where id = p_gift and not retired;
  if not found then raise exception 'Unknown gift'; end if;
  if p_match is not null then
    select case when user_a = uid then user_b else user_a end into them
    from matches where id = p_match and (user_a = uid or user_b = uid);
    if them is null then raise exception 'Not your match'; end if;
    bal := public.spend_keys(uid, g.price, 'gift', g.id);
    insert into messages (match_id, sender_id, kind, body, media_meta)
    values (p_match, uid, 'gift', g.id, jsonb_build_object('gift', g.id));
  elsif p_session is not null then
    select case when user_a = uid then user_b else user_a end into them
    from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid)
      and status = 'active' and now() < ends_at;
    if them is null then raise exception 'This chat has ended'; end if;
    bal := public.spend_keys(uid, g.price, 'gift', g.id);
    insert into masquerade_messages (session_id, sender_id, kind, body) values (p_session, uid, 'gift', g.id);
  else
    raise exception 'Choose who to send it to';
  end if;
  if g.price / 2 > 0 then perform public.add_keys(them, g.price / 2, 'gift_received', g.id); end if;
  return bal;
end $$;

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
  select * into g from gifts where id = p_gift and not retired;
  if not found then raise exception 'Unknown gift'; end if;
  bal := public.spend_keys(uid, g.price, 'feed_gift', g.id);
  insert into prompt_gifts (answer_id, from_user, to_user, gift_id, answer_body, prompt_body)
  values (a.id, uid, a.user_id, g.id, a.body, (select body from prompts where id = a.prompt_id));
  if g.price / 2 > 0 then perform public.add_keys(a.user_id, g.price / 2, 'gift_received', g.id); end if;
  return bal;
end $$;

-- ---------------------------------------------------------------------------
-- Part 39: Pacts. An admin creates a pact (its own name, link, logo and header),
-- people answer its questions (no account needed), and on reveal night everyone
-- gets their one best match: for business, friendship, love or something spicy.
-- Answers and matches are read and written by the server; people only see their own.
-- ---------------------------------------------------------------------------
create table if not exists public.pacts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  tagline text not null default '' check (char_length(tagline) <= 160),
  logo_url text,
  header_url text,
  accent text not null default '#f2c45a' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  intents text[] not null default array['business', 'friendship', 'love', 'spicy'],
  areas text[] not null default array['Island', 'Mainland'],
  email_domain text,
  closes_at timestamptz not null,
  reveal_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'live', 'revealed')),
  matched_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.pact_questions (
  id uuid primary key default gen_random_uuid(),
  pact_id uuid not null references public.pacts on delete cascade,
  position int not null default 0,
  kind text not null check (kind in ('this_or_that', 'choose_one', 'choose_many', 'scale')),
  title text not null check (char_length(title) between 2 and 90),
  subtitle text not null default '',
  -- [{ "id": "a", "label": "Owambe till 3am", "image": "https://…" }]
  options jsonb not null default '[]'::jsonb,
  min_pick int not null default 1,
  max_pick int not null default 1,
  weight text not null default 'normal' check (weight in ('normal', 'strong', 'dealbreaker')),
  created_at timestamptz not null default now()
);
create index if not exists pact_questions_pact on public.pact_questions (pact_id, position);

create table if not exists public.pact_entries (
  id uuid primary key default gen_random_uuid(),
  pact_id uuid not null references public.pacts on delete cascade,
  user_id uuid references public.profiles on delete set null,
  email text,
  -- the private link to your result, kept on your phone and in your email
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  about jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pact_id, email),
  unique (pact_id, user_id)
);
create index if not exists pact_entries_user on public.pact_entries (user_id) where user_id is not null;
create index if not exists pact_entries_email on public.pact_entries (lower(email));

create table if not exists public.pact_matches (
  id bigint generated always as identity primary key,
  pact_id uuid not null references public.pacts on delete cascade,
  a uuid not null references public.pact_entries on delete cascade,
  b uuid not null references public.pact_entries on delete cascade,
  score int not null,
  intent text not null check (intent in ('business', 'friendship', 'love', 'spicy')),
  alias_a text not null,
  alias_b text not null,
  -- what they have in common, for the reveal: [{ "q": "Friday night", "a": "Movie and suya at home" }]
  shared jsonb not null default '[]'::jsonb,
  differ jsonb,
  session_id uuid references public.masquerade_sessions on delete set null,
  created_at timestamptz not null default now(),
  unique (pact_id, a),
  unique (pact_id, b)
);

alter table public.masquerade_sessions add column if not exists pact_id uuid references public.pacts on delete set null;

alter table public.pacts enable row level security;
alter table public.pact_questions enable row level security;
alter table public.pact_entries enable row level security;
alter table public.pact_matches enable row level security;
drop policy if exists "anyone reads published pacts" on public.pacts;
create policy "anyone reads published pacts" on public.pacts for select using (status <> 'draft');
drop policy if exists "anyone reads published pact questions" on public.pact_questions;
create policy "anyone reads published pact questions" on public.pact_questions for select
  using (exists (select 1 from public.pacts p where p.id = pact_id and p.status <> 'draft'));
drop policy if exists "people read their own pact entries" on public.pact_entries;
create policy "people read their own pact entries" on public.pact_entries for select using (user_id = auth.uid());

-- Start the masked chat for a pact match (both people need a Dashpad account). Called by the server.
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
  select * into ea from pact_entries where id = mt.a;
  select * into eb from pact_entries where id = mt.b;
  if ea.user_id is null or eb.user_id is null or ea.user_id = eb.user_id then return null; end if;
  if public.is_blocked(ea.user_id, eb.user_id) then return null; end if;
  select * into pa from pacts where id = mt.pact_id;
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

-- Your pacts and matches, for your profile
create or replace function public.my_pacts() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.reveal_at desc), '[]'::json) from (
    select p.slug, p.name, p.logo_url, p.accent, p.reveal_at, p.closes_at, p.status,
      m.score, m.intent, m.shared, m.session_id,
      case when m.a = e.id then m.alias_b else m.alias_a end as match_alias
    from pact_entries e
    join pacts p on p.id = e.pact_id
    left join pact_matches m on m.pact_id = e.pact_id and e.id in (m.a, m.b)
    where e.user_id = auth.uid()
  ) t
$$;

-- Masked chats list: say which pact a chat came from
create or replace function public.my_masked_chats() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.last_at desc), '[]'::json) from (
    select s.id,
      case when s.user_a = auth.uid() then s.alias_b else s.alias_a end as alias,
      case when s.user_a = auth.uid() then s.alias_a else s.alias_b end as my_alias,
      (s.source = 'explore' and s.pact_id is null) as from_meet,
      (select pa.name from pacts pa where pa.id = s.pact_id) as pact,
      case when s.user_a = auth.uid() then s.unmask_a else s.unmask_b end as my_vote,
      (case when s.user_a = auth.uid() then s.unmask_b else s.unmask_a end) is true as they_unmasked,
      l.body as last_message, l.sender_id = auth.uid() as last_mine,
      coalesce(l.created_at, s.started_at) as last_at,
      exists (select 1 from masquerade_messages m where m.session_id = s.id and m.sender_id is not null and m.sender_id <> auth.uid()
        and m.created_at > coalesce((select r.read_at from masked_reads r where r.session_id = s.id and r.user_id = auth.uid()), '-infinity'::timestamptz)) as unread
    from masquerade_sessions s
    left join lateral (
      select m.body, m.sender_id, m.created_at from masquerade_messages m
      where m.session_id = s.id and m.kind in ('text', 'gift') order by m.id desc limit 1) l on true
    where auth.uid() in (s.user_a, s.user_b) and s.status = 'active'
      and (s.source = 'explore' or s.reopened_at is not null)
  ) t
$$;

-- Pictures for pacts (logos, headers, answer pictures) live in the event-media bucket under pacts/

-- ---------------------------------------------------------------------------
-- Part 40: Pacts with 100,000 people. Reveal night now runs in steps (match everyone,
-- start the masked chats, tell everyone) and picks up where it stopped, so a big pact
-- never gets stuck. Also: one entry per email (gmail dots and +tags count as the same
-- email), and one entry per phone.
-- ---------------------------------------------------------------------------
alter table public.pacts add column if not exists reveal_step text;
alter table public.pacts drop constraint if exists pacts_reveal_step_check;
alter table public.pacts add constraint pacts_reveal_step_check check (reveal_step in ('match', 'chats', 'notify', 'done'));
alter table public.pacts add column if not exists reveal_lock timestamptz;
alter table public.pacts add column if not exists reveal_cursor text;
alter table public.pacts add column if not exists reveal_stats jsonb not null default '{}'::jsonb;
-- Pacts revealed before this update are finished
update public.pacts set reveal_step = 'done' where status = 'revealed' and reveal_step is null;

alter table public.pact_entries add column if not exists email_key text;
alter table public.pact_entries add column if not exists device text;

-- The same inbox written differently counts once: lower case, no +tags, and no dots for Gmail
create or replace function public.pact_email_key(e text) returns text
language sql immutable as $$
  select case when e is null or position('@' in e) = 0 then null else
    (case when split_part(lower(trim(e)), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(trim(e)), '@', 1), '+', 1), '.', '') || '@gmail.com'
      else split_part(split_part(lower(trim(e)), '@', 1), '+', 1) || '@' || split_part(lower(trim(e)), '@', 2) end)
  end
$$;
update public.pact_entries e set email_key = public.pact_email_key(e.email)
where e.email is not null and e.email_key is null
  and not exists (select 1 from public.pact_entries o where o.pact_id = e.pact_id and o.id <> e.id and o.email_key = public.pact_email_key(e.email));
create unique index if not exists pact_entries_email_key on public.pact_entries (pact_id, email_key) where email_key is not null;
create unique index if not exists pact_entries_device on public.pact_entries (pact_id, device) where device is not null;
create index if not exists pact_entries_order on public.pact_entries (pact_id, id);
create index if not exists pact_entries_email_key_any on public.pact_entries (email_key) where email_key is not null;
create index if not exists pact_matches_order on public.pact_matches (pact_id, id);

-- How many people have taken each pact, kept up to date as people join (counting 100,000
-- entries on every page view would be slow on reveal night)
alter table public.pacts add column if not exists entries_count int not null default 0;
create or replace function public.pact_entries_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update pacts set entries_count = entries_count + 1 where id = new.pact_id;
  elsif tg_op = 'DELETE' then update pacts set entries_count = greatest(entries_count - 1, 0) where id = old.pact_id;
  end if;
  return null;
end $$;
drop trigger if exists pact_entries_count on public.pact_entries;
create trigger pact_entries_count after insert or delete on public.pact_entries for each row execute function public.pact_entries_count();
update public.pacts p set entries_count = (select count(*) from public.pact_entries e where e.pact_id = p.id);

-- Reveal night: one run at a time works on a pact. Returns the pact if this run got it.
create or replace function public.claim_pact_reveal(p_pact uuid, p_seconds int default 75) returns setof public.pacts
language sql security definer set search_path = public as $$
  update pacts set reveal_lock = now() + make_interval(secs => p_seconds), reveal_step = coalesce(reveal_step, 'match')
  where id = p_pact and status <> 'draft' and reveal_at <= now()
    and coalesce(reveal_step, 'match') <> 'done' and (reveal_lock is null or reveal_lock < now())
  returning *;
$$;
revoke execute on function public.claim_pact_reveal(uuid, int) from public, anon, authenticated;

-- Starts the masked chats for the next matches where both people have accounts
create or replace function public.create_pact_sessions(p_pact uuid, p_after bigint default 0, p_limit int default 300) returns json
language plpgsql security definer set search_path = public as $$
declare
  m record;
  n int := 0;
  last bigint := p_after;
begin
  for m in
    select mt.id from pact_matches mt
    join pact_entries ea on ea.id = mt.a
    join pact_entries eb on eb.id = mt.b
    where mt.pact_id = p_pact and mt.id > p_after and mt.session_id is null
      and ea.user_id is not null and eb.user_id is not null
    order by mt.id limit p_limit
  loop
    perform public.create_pact_session(m.id);
    n := n + 1;
    last := m.id;
  end loop;
  return json_build_object('done', n, 'last', last);
end $$;
revoke execute on function public.create_pact_sessions(uuid, bigint, int) from public, anon, authenticated;

-- The next people to tell about reveal night, and whether they got a match
create or replace function public.pact_notify_page(p_pact uuid, p_after uuid default null, p_limit int default 1000)
returns table (id uuid, user_id uuid, email text, token text, matched boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.user_id, e.email, e.token,
    exists (select 1 from pact_matches m where m.pact_id = p_pact and (m.a = e.id or m.b = e.id))
  from pact_entries e
  where e.pact_id = p_pact and (p_after is null or e.id > p_after)
  order by e.id limit p_limit
$$;
revoke execute on function public.pact_notify_page(uuid, uuid, int) from public, anon, authenticated;

-- Reveal night runs every minute while a pact is being revealed, using the same address
-- and key as the 5-minute job (skipped quietly if that job isn't set up)
do $$
declare
  c text;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select command into c from cron.job where jobname = 'dashpad-hourly-notify';
    if c is not null and position('/api/cron/hourly' in c) > 0 then
      perform cron.schedule('dashpad-pacts', '* * * * *', replace(c, '/api/cron/hourly', '/api/cron/pacts'));
    end if;
  end if;
end $$;

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

-- ---------------------------------------------------------------------------
-- Part 42: On reveal night nobody's match shows by itself. Everyone sees a teaser
-- (how alike, what for) and taps to reveal their match, which needs a Dashpad account.
-- Pact chats get a gold star. If someone's match hasn't joined Dashpad 48 hours after
-- reveal night, they're rematched with another person in the same spot.
-- ---------------------------------------------------------------------------
alter table public.pact_entries add column if not exists match_seen_at timestamptz;
-- Their match was given to someone else because they hadn't joined within 48 hours
alter table public.pact_entries add column if not exists lost_match_at timestamptz;
alter table public.pact_matches add column if not exists rematch boolean not null default false;
alter table public.pacts add column if not exists rematched_at timestamptz;

-- Is this chat a pact match, and has the caller revealed it yet?
create or replace function public.pact_chat_info(p_session uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('name', p.name, 'slug', p.slug,
    'seen', exists (select 1 from pact_entries e where e.pact_id = p.id and e.user_id = auth.uid() and e.match_seen_at is not null))
  from masquerade_sessions s join pacts p on p.id = s.pact_id
  where s.id = p_session and auth.uid() in (s.user_a, s.user_b)
$$;
revoke execute on function public.pact_chat_info(uuid) from public, anon;
grant execute on function public.pact_chat_info(uuid) to authenticated;

-- Masked chats list: pact chats say which pact, and stay a teaser until revealed
create or replace function public.my_masked_chats() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.last_at desc), '[]'::json) from (
    select s.id,
      case when s.user_a = auth.uid() then s.alias_b else s.alias_a end as alias,
      case when s.user_a = auth.uid() then s.alias_a else s.alias_b end as my_alias,
      (s.source = 'explore' and s.pact_id is null) as from_meet,
      pa.name as pact,
      pa.slug as pact_slug,
      exists (select 1 from pact_entries e where e.pact_id = s.pact_id and e.user_id = auth.uid() and e.match_seen_at is not null) as pact_seen,
      case when s.user_a = auth.uid() then s.unmask_a else s.unmask_b end as my_vote,
      (case when s.user_a = auth.uid() then s.unmask_b else s.unmask_a end) is true as they_unmasked,
      l.body as last_message, l.sender_id = auth.uid() as last_mine,
      coalesce(l.created_at, s.started_at) as last_at,
      exists (select 1 from masquerade_messages m where m.session_id = s.id and m.sender_id is not null and m.sender_id <> auth.uid()
        and m.created_at > coalesce((select r.read_at from masked_reads r where r.session_id = s.id and r.user_id = auth.uid()), '-infinity'::timestamptz)) as unread
    from masquerade_sessions s
    left join pacts pa on pa.id = s.pact_id
    left join lateral (
      select m.body, m.sender_id, m.created_at from masquerade_messages m
      where m.session_id = s.id and m.kind in ('text', 'gift') order by m.id desc limit 1) l on true
    where auth.uid() in (s.user_a, s.user_b) and s.status = 'active'
      and (s.source = 'explore' or s.reopened_at is not null)
  ) t
$$;

-- Your pacts: who you matched with only shows once you've revealed them
create or replace function public.my_pacts() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.reveal_at desc), '[]'::json) from (
    select p.slug, p.name, p.logo_url, p.accent, p.reveal_at, p.closes_at, p.status,
      m.id is not null as has_match,
      e.match_seen_at is not null as seen,
      m.score, m.intent,
      case when e.match_seen_at is not null then m.session_id end as session_id,
      case when e.match_seen_at is not null then (case when m.a = e.id then m.alias_b else m.alias_a end) end as match_alias
    from pact_entries e
    join pacts p on p.id = e.pact_id
    left join pact_matches m on p.status = 'revealed' and m.pact_id = e.pact_id and e.id in (m.a, m.b)
    where e.user_id = auth.uid()
  ) t
$$;

-- People with an account whose match never joined (or who have no match), 48 hours after reveal night
create or replace function public.pact_stranded(p_pact uuid)
returns table (id uuid, about jsonb, answers jsonb, match_id bigint)
language sql stable security definer set search_path = public as $$
  select e.id, e.about, e.answers, m.id
  from pact_entries e
  left join pact_matches m on m.pact_id = e.pact_id and e.id in (m.a, m.b)
  left join pact_entries o on o.id = case when m.a = e.id then m.b else m.a end
  where e.pact_id = p_pact and e.user_id is not null
    and (m.id is null or (o.user_id is null and m.created_at < now() - interval '48 hours'))
$$;
revoke execute on function public.pact_stranded(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Part 43: One summary of a pact for the admin page: how people answered each
-- question, who took part, and how matching went (live while it's matching).
-- Only the server can call it. Also: the "people have taken the Pact" number is now
-- recounted every minute, instead of on every answer (that slowed answering down a lot
-- when many people answered at the same time).
-- ---------------------------------------------------------------------------
drop trigger if exists pact_entries_count on public.pact_entries;
drop function if exists public.pact_entries_count();
create or replace function public.refresh_pact_counts() returns void
language sql security definer set search_path = public as $$
  update pacts p set entries_count = c.n
  from (select p2.id, (select count(*) from pact_entries e where e.pact_id = p2.id) n
        from pacts p2 where p2.status <> 'revealed' or p2.reveal_at > now() - interval '3 days') c
  where p.id = c.id and p.entries_count is distinct from c.n;
$$;
revoke execute on function public.refresh_pact_counts() from public, anon, authenticated;
select public.refresh_pact_counts();

create or replace function public.pact_insights(p_pact uuid) returns json
language sql stable security definer set search_path = public as $$
  with e as (select * from pact_entries where pact_id = p_pact),
  picks as (
    -- every answer as (question, option): one row per pick for "pick a few", the number for sliders
    select j.key as q, coalesce(x.value, j.value #>> '{}') as a
    from e
    cross join lateral jsonb_each(e.answers) j
    left join lateral jsonb_array_elements_text(case when jsonb_typeof(j.value) = 'array' then j.value else '[]'::jsonb end) x on true
    where jsonb_typeof(j.value) <> 'array' or x.value is not null
  ),
  m as (select * from pact_matches where pact_id = p_pact)
  select json_build_object(
    'entries', (select count(*) from e),
    'with_account', (select count(*) from e where user_id is not null),
    'today', (select count(*) from e where created_at > now() - interval '24 hours'),
    'answers', (select coalesce(json_agg(json_build_object('q', q, 'a', a, 'n', n)), '[]'::json) from (select q, a, count(*) n from picks group by q, a) t),
    'answered', (select coalesce(json_object_agg(q, n), '{}'::json) from (select j.key q, count(*) n from e cross join lateral jsonb_each(e.answers) j group by j.key) t),
    'intents', (select coalesce(json_object_agg(k, n), '{}'::json) from (select x k, count(*) n from e cross join lateral jsonb_array_elements_text(coalesce(e.about -> 'intents', '[]'::jsonb)) x group by x) t),
    'gender', (select coalesce(json_object_agg(k, n), '{}'::json) from (select e.about ->> 'gender' k, count(*) n from e where e.about ? 'gender' group by 1) t),
    'areas', (select coalesce(json_object_agg(k, n), '{}'::json) from (select e.about ->> 'area' k, count(*) n from e where e.about ? 'area' group by 1) t),
    'work', (select coalesce(json_object_agg(k, n), '{}'::json) from (select e.about ->> 'work' k, count(*) n from e where e.about ? 'work' group by 1) t),
    'ages', (select coalesce(json_object_agg(k, n), '{}'::json) from (
      select case when a < 22 then '18-21' when a < 26 then '22-25' when a < 31 then '26-30' when a < 36 then '31-35' when a < 46 then '36-45' else '46+' end k, count(*) n
      from (select (e.about ->> 'age')::int a from e where e.about ? 'age') x group by 1) t),
    'matches', json_build_object(
      'total', (select count(*) from m),
      'rematches', (select count(*) from m where rematch),
      'avg_score', (select round(avg(score)) from m),
      'by_intent', (select coalesce(json_object_agg(intent, n), '{}'::json) from (select intent, count(*) n from m group by intent) t),
      'seen', (select count(*) from e where match_seen_at is not null),
      'chats', (select count(*) from m where session_id is not null),
      'both_joined', (select count(*) from m join pact_entries a on a.id = m.a join pact_entries b on b.id = m.b where a.user_id is not null and b.user_id is not null)
    )
  )
$$;
revoke execute on function public.pact_insights(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Part 44: School and company pacts confirm the email: we send a link to it, and only
-- people who tap it are matched. "Send my link" can go out once every 10 minutes at most.
-- Deleting a Dashpad account now deletes that person's pact answers too.
-- ---------------------------------------------------------------------------
alter table public.pact_entries add column if not exists verified_at timestamptz;
alter table public.pact_entries add column if not exists verify_token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
alter table public.pact_entries add column if not exists link_sent_at timestamptz;
create unique index if not exists pact_entries_verify_token on public.pact_entries (verify_token);

-- Answers go with the account when it's deleted
alter table public.pact_entries drop constraint if exists pact_entries_user_id_fkey;
alter table public.pact_entries add constraint pact_entries_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;

-- Rematches only include people who confirmed their email, for school and company pacts
create or replace function public.pact_stranded(p_pact uuid)
returns table (id uuid, about jsonb, answers jsonb, match_id bigint)
language sql stable security definer set search_path = public as $$
  select e.id, e.about, e.answers, m.id
  from pact_entries e
  join pacts p on p.id = e.pact_id
  left join pact_matches m on m.pact_id = e.pact_id and e.id in (m.a, m.b)
  left join pact_entries o on o.id = case when m.a = e.id then m.b else m.a end
  where e.pact_id = p_pact and e.user_id is not null
    and (p.email_domain is null or e.verified_at is not null)
    and (m.id is null or (o.user_id is null and m.created_at < now() - interval '48 hours'))
$$;
revoke execute on function public.pact_stranded(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Part 45: People send feedback, bug reports and help requests from the app (the
-- support button). Admins read them under admin -> Feedback. Only the server reads
-- and writes this table.
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles on delete set null,
  kind text not null default 'feedback' check (kind in ('feedback', 'bug', 'help', 'idea')),
  message text not null check (char_length(message) between 2 and 2000),
  page text,
  device text,
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_recent on public.feedback (created_at desc);
create index if not exists feedback_user on public.feedback (user_id, created_at desc);
alter table public.feedback enable row level security;

-- ---------------------------------------------------------------------------
-- Part 46: Each pact can set its own text for the main button on its page
-- (empty means "Take the Pact").
-- ---------------------------------------------------------------------------
alter table public.pacts add column if not exists button_text text not null default '';
alter table public.pacts drop constraint if exists pacts_button_text_check;
alter table public.pacts add constraint pacts_button_text_check check (char_length(button_text) <= 30);

-- ---------------------------------------------------------------------------
-- Part 47: 200 new This or That questions for the in-chat game, across the spice
-- levels (0 Mild: 70, 1 A little spicy: 50, 2 Spicy: 45, 3 Naughty: 35).
-- ---------------------------------------------------------------------------
insert into public.tot_questions (prompt, a, b, spice) values
  ('Pick a Lagos spot', 'Lekki beach', 'Ikeja City Mall', 0),
  ('Suya or shawarma?', 'Suya', 'Shawarma', 0),
  ('Swallow of choice', 'Pounded yam', 'Amala', 0),
  ('Pick a treat', 'Puff-puff', 'Doughnuts', 0),
  ('Sunday rice', 'Jollof', 'Ofada', 0),
  ('Pepper soup', 'Goat meat', 'Catfish', 0),
  ('Getting around', 'Danfo adventures', 'Uber all the way', 0),
  ('Your phone', 'iPhone', 'Android', 0),
  ('Screen setting', 'Dark mode', 'Light mode', 0),
  ('Footwear', 'Sneakers', 'Slides', 0),
  ('Waking up', 'An alarm', 'No alarm, ever', 0),
  ('Shower time', 'Morning', 'Night', 0),
  ('Drinks', 'Hot', 'Ice cold', 0),
  ('Cravings', 'Sweet', 'Savoury', 0),
  ('Pizza', 'Extra cheese', 'Extra meat', 0),
  ('Movie night', 'Horror', 'Comedy', 0),
  ('Series', 'Binge in one night', 'One episode a day', 0),
  ('Books or podcasts?', 'Books', 'Podcasts', 0),
  ('Games night', 'Ludo', 'Card games', 0),
  ('Console', 'PlayStation', 'Xbox', 0),
  ('Game on', 'EA FC', 'Call of Duty', 0),
  ('Anime or movies?', 'Anime marathon', 'Movie marathon', 0),
  ('Superheroes', 'Marvel', 'DC', 0),
  ('Working with', 'Music on loud', 'Total silence', 0),
  ('Live music', 'Concert', 'Festival', 0),
  ('In the shower', 'Sing every day', 'Never sing', 0),
  ('Karaoke', 'Grab the mic', 'Hide at the back', 0),
  ('December plans', 'Detty December in Lagos', 'Somewhere quiet abroad', 0),
  ('Travel by', 'Plane', 'Road trip', 0),
  ('Seat', 'Window', 'Aisle', 0),
  ('Where to stay', 'Hotel', 'Airbnb', 0),
  ('Mountains or beach?', 'Mountains', 'Beach', 0),
  ('Views', 'City lights', 'Nature', 0),
  ('Shopping', 'Online', 'At the market', 0),
  ('Style', 'Ankara', 'Jeans and a tee', 0),
  ('Wrist', 'Watch', 'Bracelet', 0),
  ('Scent', 'Light and fresh', 'Strong and bold', 0),
  ('Savings', 'Piggy bank', 'Investment app', 0),
  ('Payday', 'Treat yourself', 'Pay bills first', 0),
  ('Side hustle', 'Have one', 'Need one', 0),
  ('Work from', 'Home', 'Office', 0),
  ('Meetings', 'Video call', 'In person', 0),
  ('Career', 'Be the boss', 'Have a great boss', 0),
  ('Dream job', 'Doctor', 'Musician', 0),
  ('Favourite subject', 'Maths', 'Literature', 0),
  ('In class you sat', 'Front row', 'Back bench', 0),
  ('Exams', 'Read early', 'Read the night before', 0),
  ('Your birthday', 'Big party', 'Small dinner', 0),
  ('Gifts', 'Giving', 'Receiving', 0),
  ('Surprise party for you?', 'Love it', 'Please no', 0),
  ('Dinner', 'Cook at home', 'Order in', 0),
  ('In the kitchen', 'The chef', 'The taster', 0),
  ('Hot drink', 'Bournvita', 'Milo', 0),
  ('Fruit', 'Mango', 'Pineapple', 0),
  ('On the side', 'Fries', 'Dodo', 0),
  ('Eggs', 'Boiled', 'Fried', 0),
  ('Bread', 'Agege bread', 'Sliced bread', 0),
  ('El Clásico', 'Barcelona', 'Real Madrid', 0),
  ('Social app', 'Instagram', 'TikTok', 0),
  ('On social media', 'Post often', 'Just watch', 0),
  ('Photos', 'Front camera', 'Back camera only', 0),
  ('Replying', 'Instantly', 'Hours later', 0),
  ('Notifications', 'Always on', 'Always off', 0),
  ('Rather lose', 'Your phone', 'Your wallet', 0),
  ('Time travel', 'Meet your ancestors', 'Meet your grandkids', 0),
  ('Superpower', 'Invisible', 'Teleport', 0),
  ('Spirit animal', 'Lion', 'Eagle', 0),
  ('Weather', 'Sunny', 'Rainy', 0),
  ('Night in', 'Board games', 'Video games', 0),
  ('Road trip music', 'Gospel', 'Fuji', 0),
  ('First date spot', 'Rooftop lounge', 'Street food walk', 1),
  ('Rather date', 'A good cook', 'A good dancer', 1),
  ('A crush', 'Tell them', 'Keep it secret', 1),
  ('Who texts first?', 'Me', 'Them', 1),
  ('Pet names', 'Babe', 'Their real name', 1),
  ('Date night', 'Dress up', 'Stay casual', 1),
  ('Best compliment', 'You look good', 'You’re so smart', 1),
  ('Perfect partner', 'Same hobbies', 'Opposite hobbies', 1),
  ('Meeting the friends', 'Early', 'After a while', 1),
  ('Relationship', 'Keep it private', 'Post them proudly', 1),
  ('Holding hands in public', 'Always', 'Rarely', 1),
  ('Pick a vibe', 'Sweet and soft', 'Bold and confident', 1),
  ('Love at first sight?', 'Believe it', 'Nope', 1),
  ('Soulmates', 'Real', 'A myth', 1),
  ('Rather be', 'The one who loves more', 'The one loved more', 1),
  ('After an argument', 'Talk it out', 'Space first', 1),
  ('Dream date', 'Picnic in the park', 'Fancy dinner', 1),
  ('A gift on a first date', 'Cute', 'Too much', 1),
  ('Anniversaries', 'Celebrate big', 'Keep it simple', 1),
  ('Partner’s phone', 'Never touch it', 'Share passwords', 1),
  ('Rather date someone always', 'Early', 'Late', 1),
  ('Romantic movies', 'Cry every time', 'Roll your eyes', 1),
  ('Love songs', 'Swoon', 'Skip', 1),
  ('Their best feature', 'Eyes', 'Laugh', 1),
  ('Shoot your shot', 'In the DMs', 'In person', 1),
  ('Voice notes from a crush', 'Replay them', 'Listen once', 1),
  ('Double dates', 'Fun', 'Awkward', 1),
  ('Talking stage', 'Keep it short', 'Take your time', 1),
  ('Rather receive', 'A love letter', 'A playlist', 1),
  ('Flirty emoji', '😉', '😏', 1),
  ('Couple goals', 'Travel buddies', 'Gym buddies', 1),
  ('Late-night date snack', 'Ice cream', 'Suya', 1),
  ('On a date your phone is', 'Face down', 'On the table', 1),
  ('Being asked out', 'By text', 'Face to face', 1),
  ('Meeting their parents', 'Excited', 'Nervous', 1),
  ('Rather date someone', 'Older', 'Younger', 1),
  ('Cooking together', 'Romantic', 'Chaos', 1),
  ('Love note', 'Sticky note on the mirror', 'Sweet text', 1),
  ('Your type', 'Someone like you', 'Your opposite', 1),
  ('Rather hear', 'I miss you', 'I’m proud of you', 1),
  ('First impressions', 'Smile', 'Style', 1),
  ('Most attractive', 'Kindness', 'Confidence', 1),
  ('Rather go on', 'A blind date', 'A date with a friend’s friend', 1),
  ('Wedding', 'Big owambe', 'Small and private', 1),
  ('Kids someday?', 'Yes', 'Not sure', 1),
  ('Rather date', 'A homebody', 'A party lover', 1),
  ('Butterflies', 'Still get them', 'Long gone', 1),
  ('Rather share', 'Your fries', 'Your hoodie', 1),
  ('Late reply from a crush', 'Wait it out', 'Double text', 1),
  ('Dating apps', 'Love them', 'Tired of them', 1),
  ('Rather be kissed', 'On the neck', 'On the forehead', 2),
  ('Kiss style', 'Slow', 'Passionate', 2),
  ('Walking together', 'Hold hands', 'Arm around the waist', 2),
  ('Most attractive voice', 'Deep', 'Soft', 2),
  ('Rather get', 'A back rub', 'A foot rub', 2),
  ('Sleeping', 'Cuddled up', 'Own side of the bed', 2),
  ('Flirty texts', 'Send first', 'Wait for theirs', 2),
  ('Hot date outfit', 'Something fitted', 'Something flowy', 2),
  ('Their scent', 'Cologne or perfume', 'Natural is fine', 2),
  ('Rather', 'A steamy movie', 'A steamy love song', 2),
  ('Dancing with them', 'Slow and close', 'Fast and wild', 2),
  ('Eye contact', 'Hold it', 'Look away', 2),
  ('Rather', 'Kiss first', 'Be kissed', 2),
  ('Shower together?', 'Yes please', 'Too much', 2),
  ('Love bites', 'Cute', 'No thanks', 2),
  ('Rather date', 'A good kisser', 'A good cuddler', 2),
  ('Biggest tease', 'Whispering', 'A lingering touch', 2),
  ('Rather', 'Candlelit dinner', 'Midnight drive', 2),
  ('Bath time', 'Bubble bath for two', 'Hot shower alone', 2),
  ('Rather send', 'A flirty selfie', 'A flirty voice note', 2),
  ('In the car', 'Hand on the knee', 'Both hands on the wheel', 2),
  ('Kiss spot', 'Lips', 'Cheek', 2),
  ('Rather', 'Wake them with kisses', 'Breakfast in bed', 2),
  ('PDA', 'Love it', 'Behind closed doors', 2),
  ('Flirting with', 'Words', 'Body language', 2),
  ('Rather', 'A slow dance', 'A long hug', 2),
  ('Underwear', 'Matching set', 'Comfy', 2),
  ('Rather be', 'Chased', 'The chaser', 2),
  ('Most attractive', 'Hands', 'Lips', 2),
  ('Rather kiss', 'In public', 'In private', 2),
  ('Sexy is', 'Confidence', 'Mystery', 2),
  ('Morning kisses', 'Kiss right away', 'Brush first', 2),
  ('All night', 'Spooning', 'Starfish', 2),
  ('Romantic setting', 'Rooftop at night', 'Beach at sunset', 2),
  ('Being teased', 'Love it', 'Hate it', 2),
  ('Hugs', 'From the front', 'From behind', 2),
  ('Rather receive', 'A sweet text', 'A spicy text', 2),
  ('Make-up kisses', 'Best part', 'Overrated', 2),
  ('Flirting at work', 'Never', 'A little is fine', 2),
  ('Rather they notice', 'Your outfit', 'Your eyes', 2),
  ('Tonight', 'Netflix', 'Chill', 2),
  ('Holiday romance', 'Yes', 'Never', 2),
  ('Bedtime', 'Sleep in their shirt', 'Sleep in nothing', 2),
  ('Mood setter', 'Massage oil', 'Scented candles', 2),
  ('First kiss', 'On the first date', 'By the third date', 2),
  ('Rather', 'Quickie', 'All night', 3),
  ('Rather', 'Loud', 'Quiet', 3),
  ('Best time', 'Morning', 'Midnight', 3),
  ('Rather', 'Rough', 'Gentle', 3),
  ('Rather', 'Lead', 'Follow', 3),
  ('Rather', 'Talk dirty', 'Show, don’t tell', 3),
  ('Rather', 'Blindfold', 'Eyes wide open', 3),
  ('Rather', 'Role play', 'Just be yourselves', 3),
  ('Rather', 'Mirror', 'Lights off', 3),
  ('Rather', 'Spontaneous', 'Planned', 3),
  ('Pace', 'Fast', 'Slow', 3),
  ('Rather', 'Leave marks', 'No marks', 3),
  ('Rather', 'Kitchen counter', 'Shower', 3),
  ('Rather', 'Back seat', 'Hotel room', 3),
  ('Rather', 'Naughty text at work', 'Save it for later', 3),
  ('Rather', 'Be teased for an hour', 'Get it right now', 3),
  ('Rather', 'Handcuffs', 'Silk ties', 3),
  ('Rather', 'Ice cubes', 'Warm oil', 3),
  ('Rather', 'Whisper what you want', 'Let them guess', 3),
  ('Rather wear', 'Their shirt', 'Nothing at all', 3),
  ('Rather', 'Make the first move tonight', 'Be pulled close', 3),
  ('Rather', 'Wake up for round two', 'Sleep it off', 3),
  ('Rather', 'Music on', 'Just your breathing', 3),
  ('Rather', 'Dirty dancing', 'Dirty texting', 3),
  ('Rather', 'Biting', 'Scratching', 3),
  ('Rather be', 'In charge', 'At their mercy', 3),
  ('Socks', 'Keep them on', 'Off, obviously', 3),
  ('Rather', 'Hotel with a view', 'Your own bed', 3),
  ('Rather', 'Share a secret fantasy', 'Keep it secret', 3),
  ('Surprise them with', 'Lingerie', 'Nothing at all', 3),
  ('Rather', 'Hair pulled', 'Hands pinned', 3),
  ('Rather', 'Almost get caught', 'Never risk it', 3),
  ('Rather play', 'Strip cards', 'Truth or dare', 3),
  ('Rather', 'One wild night', 'A week of teasing', 3),
  ('Rather', 'Make-up sex', 'Birthday sex', 3)
on conflict (a, b) do nothing;

-- ---------------------------------------------------------------------------
-- Part 48: When you pay to message someone from Meet, you already saw their name and
-- main photo there. So in that masked chat you see their name, with their photo
-- blurred. They still see only your mask name until you both unmask.
-- ---------------------------------------------------------------------------
create or replace function public.paid_chat_people() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(s.id, json_build_object('name', p.display_name, 'photo', p.photos[1])), '{}'::json)
  from masquerade_sessions s
  join profiles p on p.id = s.user_b
  where s.user_a = auth.uid()
    and s.source = 'explore'
    and s.pact_id is null
    and s.meet_id is null
    and s.status = 'active'
$$;
revoke execute on function public.paid_chat_people() from public, anon;
grant execute on function public.paid_chat_people() to authenticated;

-- ---------------------------------------------------------------------------
-- Part 49: Games work in every open masked chat, not just hourly pairs and Meet
-- posts: chats you paid to start from Meet, Link-Up matches, reopened pairs and
-- 5-minute masquerades too (while the chat is still open).
-- ---------------------------------------------------------------------------
create or replace function public.game_chat_ok(uid uuid, p_session uuid, p_match uuid, out other uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  s masquerade_sessions;
  m matches;
begin
  other := null;
  if p_session is not null then
    select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
    if not found or s.status <> 'active' or now() >= s.ends_at then return; end if;
    other := case when s.user_a = uid then s.user_b else s.user_a end;
  elsif p_match is not null then
    select * into m from matches where id = p_match and (user_a = uid or user_b = uid);
    if not found then return; end if;
    other := case when m.user_a = uid then m.user_b else m.user_a end;
  end if;
  if other is not null and public.is_blocked(uid, other) then other := null; end if;
end $$;
revoke all on function public.game_chat_ok(uuid, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Part 50: The icebreaker questions are written for dating, so friendship chats
-- don't get them any more (masked or connected). Questions an admin wrote for a
-- specific Masquerade Night still show in that night's chats.
-- ---------------------------------------------------------------------------
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
  ) x
  -- Friendship chats only get a night's own questions
  where x.pri = 0 or coalesce((select s.intent::text from masquerade_sessions s where s.id = p_session), 'dating') <> 'friends'
  order by pri, random() limit 1
$$;
revoke execute on function public.pick_icebreaker(uuid, smallint, uuid) from public, anon, authenticated;

create or replace function public.match_icebreaker(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m matches;
  lvl smallint;
  q text;
begin
  select * into m from matches where id = p_match and (user_a = uid or user_b = uid);
  if not found then raise exception 'Not your chat'; end if;
  -- Icebreakers are for dating and spicy chats
  if m.intent = 'friends' then return; end if;
  if public.is_blocked(m.user_a, m.user_b) then raise exception 'Not available'; end if;
  if (select count(*) from messages
      where match_id = p_match and sender_id is null and kind = 'text' and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Slow down a little';
  end if;

  select round((coalesce(a.pref_spice, 1) + coalesce(b.pref_spice, 1)) / 2.0)::smallint into lvl
  from profiles a, profiles b where a.id = m.user_a and b.id = m.user_b;

  select body into q from (
    select i.body, 0 as pri from icebreakers i
    where i.event_id is null and i.active and i.spice = lvl
      and not exists (select 1 from messages x where x.match_id = p_match and x.sender_id is null and x.body = '💬 ' || i.body)
      and not exists (select 1 from masquerade_messages x where x.session_id = m.session_id and x.kind = 'icebreaker' and x.body = i.body)
    union all
    select i.body, 1 from icebreakers i where i.event_id is null and i.active and i.spice = lvl
  ) x order by pri, random() limit 1;
  if q is null then return; end if;

  insert into messages (match_id, sender_id, kind, body) values (p_match, null, 'text', '💬 ' || q);
  update matches set last_message_at = now() where id = p_match;
end $$;
revoke execute on function public.match_icebreaker(uuid) from public, anon;
grant execute on function public.match_icebreaker(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Part 51: On Meet and Home, someone's "things about me" stay hidden until you've
-- both unmasked and are connected. Before that you see how many they have.
-- ---------------------------------------------------------------------------
create or replace function public.explore_profile(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  mid uuid;
  open boolean;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if not public.explore_visible(uid, p_id) then return null; end if;
  select * into p from profiles where id = p_id;
  mid := public.explore_match_id(uid, p_id);
  open := mid is not null or exists (select 1 from photo_unlocks where viewer = uid and target = p_id);
  return json_build_object(
    'id', p.id, 'name', p.display_name, 'age', case when mid is not null then public.age_years(p.birthdate) end, 'gender', p.gender,
    'bio', p.bio, 'interests', p.interests, 'place', p.place_label,
    -- What they're in the mood for only shows in your chat
    'intent', null,
    'online', p.last_seen_at > now() - interval '5 minutes',
    'photos', case when open then to_json(p.photos) else to_json(array[p.photos[1]]) end,
    'photo_count', cardinality(p.photos),
    'photos_unlocked', open,
    'match_id', mid,
    -- A masked chat you already have with them from Meet
    'masked_id', (select x.id from masquerade_sessions x where x.source = 'explore' and x.status = 'active'
      and ((x.user_a = uid and x.user_b = p_id) or (x.user_a = p_id and x.user_b = uid)) order by x.started_at desc limit 1),
    'shared_interests', array(select unnest(p.interests) intersect select unnest((select interests from profiles where id = uid))),
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    -- Their "things about me" only show once you're connected (you've both unmasked);
    -- before that, just how many there are. The words you both used still show.
    'things', case when mid is not null then p.things else '[]'::jsonb end,
    'things_count', coalesce(jsonb_array_length(p.things), 0),
    'shared_words', (array(select unnest(p.thing_keys) intersect select unnest((select thing_keys from profiles where id = uid))))[1:5]
  );
end $$;

-- ---------------------------------------------------------------------------
-- Part 52: "You both mentioned …" (words from your things about me) now also waits
-- until you've both unmasked and are connected.
-- ---------------------------------------------------------------------------
create or replace function public.explore_profile(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  mid uuid;
  open boolean;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if not public.explore_visible(uid, p_id) then return null; end if;
  select * into p from profiles where id = p_id;
  mid := public.explore_match_id(uid, p_id);
  open := mid is not null or exists (select 1 from photo_unlocks where viewer = uid and target = p_id);
  return json_build_object(
    'id', p.id, 'name', p.display_name, 'age', case when mid is not null then public.age_years(p.birthdate) end, 'gender', p.gender,
    'bio', p.bio, 'interests', p.interests, 'place', p.place_label,
    -- What they're in the mood for only shows in your chat
    'intent', null,
    'online', p.last_seen_at > now() - interval '5 minutes',
    'photos', case when open then to_json(p.photos) else to_json(array[p.photos[1]]) end,
    'photo_count', cardinality(p.photos),
    'photos_unlocked', open,
    'match_id', mid,
    -- A masked chat you already have with them from Meet
    'masked_id', (select x.id from masquerade_sessions x where x.source = 'explore' and x.status = 'active'
      and ((x.user_a = uid and x.user_b = p_id) or (x.user_a = p_id and x.user_b = uid)) order by x.started_at desc limit 1),
    'shared_interests', array(select unnest(p.interests) intersect select unnest((select interests from profiles where id = uid))),
    'message_cost', public.setting_int('explore_message_cost', 15),
    'photos_cost', public.setting_int('explore_photos_cost', 5),
    -- Their "things about me", and the words you both used in them, only show once
    -- you're connected (you've both unmasked); before that, just how many there are.
    'things', case when mid is not null then p.things else '[]'::jsonb end,
    'things_count', coalesce(jsonb_array_length(p.things), 0),
    'shared_words', case when mid is not null then (array(select unnest(p.thing_keys) intersect select unnest((select thing_keys from profiles where id = uid))))[1:5] end
  );
end $$;

-- Masked chats: the same, while you are still masked
create or replace function public.get_masquerade(p_session uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s masquerade_sessions;
  other uuid;
  op profiles;
  mp profiles;
  i_am_a boolean;
  m meet_posts;
  pair boolean;
begin
  select * into s from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid);
  if not found then return null; end if;
  -- Hourly pairs, meet chats and chats started from Meet: unmask any time
  pair := s.hour_at is not null or s.meet_id is not null or s.source = 'explore';
  if s.status = 'active' and (
       (pair and now() >= s.ends_at)
       or (not pair and now() > s.ends_at + interval '90 seconds')) then
    perform public.finalize_masquerade(p_session);
    select * into s from masquerade_sessions where id = p_session;
  end if;
  if s.meet_id is not null then
    select * into m from meet_posts where id = s.meet_id;
    if m.kind = 'game' and s.status = 'active' then perform public.meet_queue_next(m.id); end if;
  end if;

  i_am_a := s.user_a = uid;
  -- Opening the chat reads it (kept apart from the session, so it doesn't wake anyone's screen)
  insert into masked_reads (session_id, user_id, read_at) values (s.id, uid, now())
  on conflict (session_id, user_id) do update set read_at = now();
  other := case when i_am_a then s.user_b else s.user_a end;
  select * into op from profiles where id = other;
  select * into mp from profiles where id = uid;

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
    'hourly', pair,
    -- Open until you both decide: reopened past pairs and chats started from Meet
    'reopened', s.reopened_at is not null or s.source = 'explore',
    'explore', s.source = 'explore',
    'meet', case when m.id is null then null else json_build_object(
      'id', m.id, 'kind', m.kind, 'game', m.game, 'mine', i_am_a,
      'turn_pending', public.meet_turn_pending(s.id),
      -- People ahead of you in line (people waiting, if it's yours)
      'ahead', case when m.kind = 'game' then (
        select count(*) from masquerade_sessions x
        where x.meet_id = m.id and x.status = 'active' and now() < x.ends_at
          and not exists (select 1 from games g where g.session_id = x.id and g.started_at is not null)
          and (i_am_a or x.started_at < s.started_at)) end,
      -- Where your game in this meet is happening right now (if it's in another chat)
      'live_chat', case when i_am_a and m.kind = 'game' then (
        select json_build_object('id', x.id, 'alias', x.alias_b, 'status', g.status)
        from games g join masquerade_sessions x on x.id = g.session_id
        where x.meet_id = m.id and x.id <> s.id and g.status in ('invited', 'active')
        limit 1) end) end,
    'me', json_build_object(
      'id', uid,
      'alias', case when i_am_a then s.alias_a else s.alias_b end,
      'spice', case when i_am_a then s.spice_a else s.spice_b end,
      'vote', case when i_am_a then s.unmask_a else s.unmask_b end
    ),
    'them', json_build_object(
      'alias', case when i_am_a then s.alias_b else s.alias_a end,
      'spice', case when i_am_a then s.spice_b else s.spice_a end,
      -- Ages aren't shown in chats
      'age', null,
      'gender', op.gender,
      'interests', op.interests,
      'shared_interests', array(select unnest(op.interests) intersect select unnest(mp.interests)),
      -- Words you both used in "things about me": only once you've both unmasked
      'shared_words', case when s.status = 'matched' then (array(select unnest(op.thing_keys) intersect select unnest(mp.thing_keys)))[1:5] end,
      'distance_km', null,
      'place', op.place_label,
      'same_place', op.place_country = mp.place_country and op.place_region = mp.place_region,
      'connections', (select count(*) from matches x where op.id in (x.user_a, x.user_b)),
      'reply_seconds', public.reply_seconds(op.id),
      'has_voted', (case when i_am_a then s.unmask_b else s.unmask_a end) is not null,
      -- Whether they're in the app right now, and roughly how long since they were
      'online', coalesce(op.last_seen_at > now() - interval '2 minutes', false),
      'seen_minutes', case when op.last_seen_at is not null then floor(extract(epoch from now() - op.last_seen_at) / 60)::int end,
      -- Only revealed after you both unmask
      'profile', case when s.status = 'matched' then json_build_object(
        'id', op.id, 'display_name', op.display_name, 'bio', op.bio, 'photos', op.photos
      ) else null end
    )
  );
end $$;

-- ---------------------------------------------------------------------------
-- Part 53: For chats someone paid to start from Meet, both people now get the chat
-- listed: the one who paid sees the other's name and photo (as before); the one who
-- was messaged is told they found them on Meet, so the chat says the right thing.
-- ---------------------------------------------------------------------------
create or replace function public.paid_chat_people() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(s.id,
    case when s.user_a = auth.uid()
      then json_build_object('name', p.display_name, 'photo', p.photos[1], 'started_by_me', true)
      else json_build_object('name', null, 'photo', null, 'started_by_me', false)
    end), '{}'::json)
  from masquerade_sessions s
  join profiles p on p.id = s.user_b
  where auth.uid() in (s.user_a, s.user_b)
    and s.source = 'explore'
    and s.pact_id is null
    and s.meet_id is null
    and s.status = 'active'
$$;
revoke execute on function public.paid_chat_people() from public, anon;
grant execute on function public.paid_chat_people() to authenticated;

-- ---------------------------------------------------------------------------
-- Part 54: A masked chat was only marked read when you opened it, so messages that
-- arrived while you were in it (and you replied to) kept the Chats badge on. The chat
-- now marks itself read as messages come in.
-- ---------------------------------------------------------------------------
create or replace function public.mark_masked_read(p_session uuid) returns void
language sql security definer set search_path = public as $$
  insert into masked_reads (session_id, user_id, read_at)
  select s.id, auth.uid(), now() from masquerade_sessions s
  where s.id = p_session and auth.uid() in (s.user_a, s.user_b)
  on conflict (session_id, user_id) do update set read_at = now();
$$;
revoke execute on function public.mark_masked_read(uuid) from public, anon;
grant execute on function public.mark_masked_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Part 55: Question spice is hidden for Friends, so This or That in friendship chats
-- (masked or connected) always uses Mild questions, whatever spice was set before.
-- ---------------------------------------------------------------------------
create or replace function public.game_begin(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
  lvl int := 1;
  qs jsonb;
  t timestamptz := now() + interval '4 seconds'; -- 3, 2, 1 countdown
begin
  select * into g from games where id = p_game;
  -- Friendship chats always get Mild questions
  if g.session_id is not null then
    select case when intent = 'friends' then 0 else spice_level end into lvl from masquerade_sessions where id = g.session_id;
  else
    select case when intent = 'spicy' then 3 when intent = 'dating' then 2 else 0 end into lvl from matches where id = g.match_id;
  end if;
  if g.kind = 'tot' then
    select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'q', q.prompt, 'a', q.a, 'b', q.b)), '[]'::jsonb) into qs
    from (select * from tot_questions where active and spice <= coalesce(lvl, 1) order by random() limit 10) q;
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('qs', qs, 'i', 0, 'picks', '[]'::jsonb, 'alike', 0)
    where id = g.id;
  elsif g.kind = 'truths' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('phase', 'write')
    where id = g.id;
  elsif g.kind = 'c4' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('board', repeat('.', 42), 'turn', 'a', 'round', 1, 'wins', jsonb_build_object('a', 0, 'b', 0),
        'starter', 'a', 'last', null, 'moves', 0, 'auto_a', 0, 'auto_b', 0)
    where id = g.id;
  elsif g.kind = 'checkers' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('board', public.game_checkers_board(), 'turn', 'a', 'chain', null, 'quiet', 0,
        'captured', jsonb_build_object('a', 0, 'b', 0), 'last', null, 'moves', 0)
    where id = g.id;
  elsif g.kind = 'chess' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('fen', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'turn', 'a', 'san', '[]'::jsonb,
        'last', null, 'check', false, 'taken', jsonb_build_object('a', '', 'b', ''), 'moves', 0)
    where id = g.id;
  elsif g.kind = 'ayo' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('pits', jsonb_build_array(4,4,4,4,4,4,4,4,4,4,4,4), 'store', jsonb_build_object('a', 0, 'b', 0),
        'turn', 'a', 'last', null, 'moves', 0)
    where id = g.id;
  elsif g.kind = 'whot' then
    perform public.game_whot_deal(g.id, t);
  elsif g.kind = 'bomb' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('phase', 'hide', 'round', 1, 'wins', jsonb_build_object('a', 0, 'b', 0), 'starter', 'a',
        'ready_a', false, 'ready_b', false, 'turn', null, 'open_a', '.........', 'open_b', '.........',
        'boom_a', 0, 'boom_b', 0, 'last', null, 'result', null, 'moves', 0)
    where id = g.id;
  elsif g.kind = 'gems' then
    update games set status = 'active', started_at = t, deadline_at = t + public.game_idle(),
      state = jsonb_build_object('board', public.game_gems_board(), 'turn', 'a', 'left', 2,
        'done', jsonb_build_object('a', 0, 'b', 0), 'points', jsonb_build_object('a', 0, 'b', 0), 'last', null, 'moves', 0)
    where id = g.id;
  else
    update games set status = 'active', started_at = t, deadline_at = t + interval '80 seconds',
      state = jsonb_build_object('board', public.game_words_board(), 'count_a', 0, 'count_b', 0)
    where id = g.id;
  end if;
  insert into game_secrets (game_id, user_id) values (g.id, g.player_a), (g.id, g.player_b) on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- Part 56: Hourly pairing used to compare everyone with everyone in one go, which
-- stops working past a few thousand people an hour. Now:
--  * the people waiting are kept in hour_pool, so pairing can run in batches that
--    carry on where the last one stopped (the hourly job keeps calling until done);
--  * each person looks for a partner closest first (same state, country, continent,
--    then anywhere), checking a sample of up to 100 people who fit, and the 15 with
--    the most in common, instead of everyone.
-- Same rules as before: same mood, gender and ages fit both ways, never someone
-- blocked, already connected or paired before, and quick repliers choose first.
-- ---------------------------------------------------------------------------
create unlogged table if not exists public.hour_pool (
  hour_at timestamptz not null,
  id uuid not null,
  gender public.gender,
  pref_intent public.intent,
  pref_seeking text,
  pref_age_min int,
  pref_age_max int,
  pref_spice smallint,
  interests text[],
  thing_keys text[],
  age int,
  place_country text,
  place_region text,
  place_continent text,
  rs int,
  rnd double precision,
  tried boolean not null default false,
  primary key (hour_at, id)
);
create index if not exists hour_pool_turns on public.hour_pool (hour_at, tried, rs, rnd);
create index if not exists hour_pool_state on public.hour_pool (hour_at, pref_intent, place_country, place_region);
create index if not exists hour_pool_continent on public.hour_pool (hour_at, pref_intent, place_continent);
alter table public.hour_pool enable row level security;
alter table public.masquerade_hours add column if not exists finished_at timestamptz;
create index if not exists masquerade_sessions_hour_pair on public.masquerade_sessions (user_a, user_b) where hour_at is not null;

-- One batch of hourly pairing. Returns how many pairs it made and how many people are still to go.
create or replace function public.run_hourly_pairing_batch(p_budget int default 3000) returns json
language plpgsql security definer set search_path = public as $$
declare
  h timestamptz := date_trunc('hour', now());
  hr masquerade_hours;
  r record;
  partner record;
  ids uuid[];
  pid uuid;
  sid uuid;
  a1 text;
  q text;
  n int := 0;
  lvl smallint;
  t int;
  left_n int;
begin
  -- Close chats from hours that have ended
  for r in select id from masquerade_sessions
           where hour_at is not null and status = 'active' and reopened_at is null and ends_at <= now()
           limit 2000 loop
    perform public.finalize_masquerade(r.id);
  end loop;

  if not public.pairing_hour_open(h) then return json_build_object('made', 0, 'left', 0); end if;
  perform pg_advisory_xact_lock(515151);
  select * into hr from masquerade_hours where hour_at = h;
  if not found then
    insert into masquerade_hours (hour_at) values (h);
    -- Too late in the hour to start a fair chat: wait for the next one
    if now() > h + interval '45 minutes' then
      update masquerade_hours set note = 'late', finished_at = now() where hour_at = h;
      return json_build_object('made', 0, 'left', 0);
    end if;
    delete from hour_pool where hour_at < h;
    insert into hour_pool (hour_at, id, gender, pref_intent, pref_seeking, pref_age_min, pref_age_max, pref_spice,
                           interests, thing_keys, age, place_country, place_region, place_continent, rs, rnd)
    select h, p.id, p.gender, p.pref_intent, p.pref_seeking, p.pref_age_min, p.pref_age_max, p.pref_spice,
      p.interests, p.thing_keys, public.age_years(p.birthdate), p.place_country, p.place_region, p.place_continent,
      coalesce(public.reply_seconds(p.id), 1800), random()
    from profiles p
    left join accounts_private a on a.user_id = p.id
    where p.open_to_masquerade
      and p.last_seen_at > now() - interval '24 hours'
      and p.display_name is not null and p.birthdate is not null and p.gender is not null
      and cardinality(p.photos) > 0
      and a.banned_at is null;
    -- Fresh numbers about the list, so finding partners uses the indexes
    analyze public.hour_pool;
    update masquerade_hours set eligible = (select count(*) from hour_pool where hour_at = h) where hour_at = h;
  elsif hr.finished_at is not null then
    return json_build_object('made', 0, 'left', 0);
  elsif now() > h + interval '45 minutes' then
    -- Ran out of time this hour: whoever is left waits for the next one
    update masquerade_hours set finished_at = now(), note = coalesce(note, 'unfinished') where hour_at = h;
    delete from hour_pool where hour_at = h;
    return json_build_object('made', 0, 'left', 0);
  end if;

  -- Quick repliers choose first, so they get the best fits
  for r in select * from hour_pool where hour_at = h and not tried order by rs, rnd limit greatest(1, p_budget) loop
    -- Already taken as someone's partner in this batch
    continue when not exists (select 1 from hour_pool where hour_at = h and id = r.id);
    update hour_pool set tried = true where hour_at = h and id = r.id;
    pid := null;
    -- Closest first: same state, then same country, then same continent, then anywhere
    for t in 1..4 loop
      ids := null;
      if t = 1 then
        select array_agg(c.id) into ids from (
          select c.id from hour_pool c
          where c.hour_at = h and c.pref_intent = r.pref_intent and c.place_country = r.place_country and c.place_region = r.place_region
            and c.id <> r.id
            and public.gender_fits(r.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, r.gender)
            and c.age between r.pref_age_min and r.pref_age_max and r.age between c.pref_age_min and c.pref_age_max
          limit 100) c;
      elsif t = 2 then
        select array_agg(c.id) into ids from (
          select c.id from hour_pool c
          where c.hour_at = h and c.pref_intent = r.pref_intent and c.place_country = r.place_country
            and c.id <> r.id
            and public.gender_fits(r.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, r.gender)
            and c.age between r.pref_age_min and r.pref_age_max and r.age between c.pref_age_min and c.pref_age_max
          limit 100) c;
      elsif t = 3 then
        select array_agg(c.id) into ids from (
          select c.id from hour_pool c
          where c.hour_at = h and c.pref_intent = r.pref_intent and c.place_continent = r.place_continent
            and c.id <> r.id
            and public.gender_fits(r.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, r.gender)
            and c.age between r.pref_age_min and r.pref_age_max and r.age between c.pref_age_min and c.pref_age_max
          limit 100) c;
      else
        select array_agg(c.id) into ids from (
          select c.id from hour_pool c
          where c.hour_at = h and c.pref_intent = r.pref_intent
            and c.id <> r.id
            and public.gender_fits(r.pref_seeking, c.gender) and public.gender_fits(c.pref_seeking, r.gender)
            and c.age between r.pref_age_min and r.pref_age_max and r.age between c.pref_age_min and c.pref_age_max
          limit 100) c;
      end if;
      continue when ids is null;
      -- The 15 with the most in common (interests, and words from "things about me"), then the safety checks
      select c.* into partner from (
        select c.*, public.shared_count(r.interests, c.interests) + 2 * least(public.shared_count(r.thing_keys, c.thing_keys), 5) as fit
        from hour_pool c
        where c.hour_at = h and c.id = any(ids)
        order by fit desc, (c.rs < 600) desc, c.rs, c.rnd
        limit 15
      ) c
      where not public.is_blocked(r.id, c.id)
        and not public.already_matched(r.id, c.id)
        -- New people every time (a pair that never talked can meet again)
        and not exists (select 1 from masquerade_sessions s
                        where s.hour_at is not null
                          and ((s.user_a = r.id and s.user_b = c.id) or (s.user_a = c.id and s.user_b = r.id))
                          and not (s.status = 'ended' and s.ended_reason = 'quiet'))
      order by c.fit desc, (c.rs < 600) desc, c.rs, c.rnd
      limit 1;
      if found then
        pid := partner.id;
        exit;
      end if;
    end loop;
    continue when pid is null;

    a1 := public.random_alias();
    lvl := round((r.pref_spice + partner.pref_spice) / 2.0)::smallint;
    insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, hour_at)
    values (r.id, partner.id, r.pref_intent, r.pref_spice, partner.pref_spice, lvl, a1, public.random_alias(a1), now(), h + interval '1 hour', h)
    returning id into sid;
    q := public.pick_icebreaker(sid, lvl, null);
    if q is not null then
      insert into masquerade_messages (session_id, kind, body) values (sid, 'icebreaker', q);
    end if;
    delete from hour_pool where hour_at = h and id in (r.id, partner.id);
    n := n + 1;
  end loop;

  select count(*) into left_n from hour_pool where hour_at = h and not tried;
  update masquerade_hours set pairs = pairs + n, finished_at = case when left_n = 0 then now() end where hour_at = h;
  if left_n = 0 then delete from hour_pool where hour_at = h; end if;
  return json_build_object('made', n, 'left', left_n);
end $$;
revoke execute on function public.run_hourly_pairing_batch(int) from public, anon, authenticated;

-- The old one-call version, kept for anything that still calls it: runs batches until done
create or replace function public.run_hourly_pairing() returns int
language plpgsql security definer set search_path = public as $$
declare
  res json;
  total int := 0;
begin
  loop
    res := public.run_hourly_pairing_batch(3000);
    total := total + (res->>'made')::int;
    exit when (res->>'left')::int = 0;
  end loop;
  return total;
end $$;
revoke execute on function public.run_hourly_pairing() from public, anon, authenticated;

-- New pairs to tell, a chunk at a time (so a big hour isn't cut off halfway; the rest go next run)
drop function if exists public.hourly_pairs_to_notify();
create or replace function public.hourly_pairs_to_notify(p_limit int default 100000) returns json
language sql security definer set search_path = public as $$
  with t as (
    update masquerade_sessions set notified_at = now()
    where id in (
      select id from masquerade_sessions
      where hour_at = date_trunc('hour', now()) and status = 'active' and notified_at is null
      order by started_at
      limit greatest(1, p_limit)
    )
    returning id, user_a, user_b, alias_a, alias_b, ends_at, intent
  )
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from t
$$;
revoke execute on function public.hourly_pairs_to_notify(int) from public, anon, authenticated;
create index if not exists masquerade_sessions_to_notify on public.masquerade_sessions (hour_at) where notified_at is null and status = 'active';

-- ---------------------------------------------------------------------------
-- Part 57: New profile photos can be stored on Cloudflare R2 (no download fees),
-- served from Dashpad's media address. Photos already on Supabase keep working.
-- If your media address isn't https://media.dashpad.site, change it on the line
-- below before running (no slash at the end).
-- ---------------------------------------------------------------------------
create table if not exists public.app_text_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_text_settings enable row level security;
insert into public.app_text_settings (key, value) values ('media_url', 'https://media.dashpad.site')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Where Dashpad's media is served from, e.g. https://media.dashpad.site
create or replace function public.media_base() returns text
language sql stable security definer set search_path = public as $$
  select rtrim(value, '/') from app_text_settings where key = 'media_url'
$$;

create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
declare
  url text;
begin
  if current_user <> 'authenticated' then return new; end if;
  new.id := old.id;
  new.created_at := old.created_at;
  -- Ghost mode is paid for through set_ghost
  new.ghost_on := old.ghost_on;
  new.ghost_until := old.ghost_until;
  -- Online status comes from the app's check-in
  new.last_seen_at := old.last_seen_at;
  -- Matching words always come from the answers
  new.thing_keys := public.thing_keywords(new.things);
  if jsonb_typeof(new.things) <> 'array' or jsonb_array_length(new.things) > 40 or pg_column_size(new.things) > 8000 then
    raise exception 'Too many things';
  end if;
  -- A birthday is set while signing up, and you have to be 18
  if new.birthdate is distinct from old.birthdate then
    if old.birthdate is not null and cardinality(coalesce(old.photos, '{}')) > 0 then
      raise exception 'Your birthday can''t be changed. Contact support if it''s wrong.';
    end if;
    if new.birthdate is null or public.age_years(new.birthdate) < 18 then
      raise exception 'You need to be 18 or older to use Dashpad';
    end if;
  end if;
  -- Photos: up to 6, and only ones uploaded to your own folder on Dashpad (Supabase or R2)
  if cardinality(coalesce(new.photos, '{}')) > 6 then raise exception 'Up to 6 photos'; end if;
  foreach url in array coalesce(new.photos, '{}') loop
    -- (only new ones are checked, so older photos never get in the way)
    if not (url = any(coalesce(old.photos, '{}')))
       and position('/storage/v1/object/public/photos/' || new.id::text || '/' in url) = 0
       -- or Dashpad's own media address (Cloudflare R2), in your folder
       and not (public.media_base() is not null and url like public.media_base() || '/photos/' || new.id::text || '/%') then
      raise exception 'Photos must be uploaded to Dashpad';
    end if;
  end loop;
  if cardinality(coalesce(new.interests, '{}')) > 12 then raise exception 'Too many interests'; end if;
  return new;
end $$;
