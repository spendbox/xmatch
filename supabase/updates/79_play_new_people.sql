-- Dashpad update: Play meets new people (Part 79)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 78 first. Safe to run more than once.
-- Play no longer pairs you with someone you're already connected with, or with the same
-- person twice within a day. Your place in line is kept while you play a practice game.

alter table public.play_queue add column if not exists seen_at timestamptz not null default now();

create or replace function public.play_fits(me profiles, p profiles) returns boolean
language sql stable security definer set search_path = public as $$
  select p.pref_intent = me.pref_intent
    and public.gender_fits(me.pref_seeking, p.gender) and public.gender_fits(p.pref_seeking, me.gender)
    and public.age_years(p.birthdate) between me.pref_age_min and me.pref_age_max
    and public.age_years(me.birthdate) between p.pref_age_min and p.pref_age_max
    and not public.is_blocked(me.id, p.id)
    -- Play is for meeting new people: not someone you're already connected with,
    and not public.already_matched(me.id, p.id)
    -- and not the same person again within a day
    and not exists (select 1 from masquerade_sessions s
      where s.source = 'play' and s.started_at > now() - interval '24 hours'
        and ((s.user_a = me.id and s.user_b = p.id) or (s.user_a = p.id and s.user_b = me.id)))
$$;

create or replace function public.play_status() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  q play_queue;
  me profiles;
begin
  if uid is null then return null; end if;
  select * into me from profiles where id = uid;
  -- Checking in while you wait keeps your place in line (you might be playing practice for a while)
  update play_queue set seen_at = now() where user_id = uid and session_id is null;
  select * into q from play_queue where user_id = uid;
  return json_build_object(
    'waiting', q.user_id is not null and q.session_id is null,
    'joined_at', q.joined_at,
    'session_id', q.session_id,
    'game', q.game_kind,
    'intent', me.pref_intent,
    'seeking', me.pref_seeking,
    'age_min', me.pref_age_min,
    'age_max', me.pref_age_max,
    'cost', public.setting_int('play_cost', 1),
    'balance', coalesce((select balance from wallets where user_id = uid), 0),
    'games', public.play_games(me.pref_intent),
    -- Others waiting right now who fit your settings (and you theirs)
    'in_line', (select count(*) from play_queue x join profiles p on p.id = x.user_id
                where x.session_id is null and x.user_id <> uid and public.play_fits(me, p)
                  and p.last_seen_at > now() - interval '150 seconds'),
    'playing', (select count(*) from games g join masquerade_sessions s on s.id = g.session_id
                where s.source = 'play' and g.status = 'active'),
    'server_now', now()
  );
end $$;

create or replace function public.play_join() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  them profiles;
  cost int := greatest(0, public.setting_int('play_cost', 1));
  pool text[];
  pick text;
  a1 text;
  sid uuid;
  gid uuid;
  lvl smallint;
  tries int := 0;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if exists (select 1 from accounts_private where user_id = uid and banned_at is not null) then raise exception 'Not available'; end if;
  select * into me from profiles where id = uid;
  pool := public.play_games(me.pref_intent);
  if coalesce(array_length(pool, 1), 0) = 0 then raise exception 'Games are taking a break. Try again later.'; end if;
  if cost > 0 and coalesce((select balance from wallets where user_id = uid), 0) < cost then raise exception 'NOT_ENOUGH_KEYS'; end if;

  -- One pairing at a time, so two people can't grab the same partner
  perform pg_advisory_xact_lock(hashtext('play_queue'));

  loop
    tries := tries + 1;
    exit when tries > 5;
    select p.* into them from play_queue x join profiles p on p.id = x.user_id
    where x.session_id is null and x.user_id <> uid
      and x.seen_at > now() - interval '2 minutes'
      and p.last_seen_at > now() - interval '150 seconds'
      and public.play_fits(me, p)
    order by x.joined_at
    limit 1;
    exit when not found;
    -- They can't pay any more: take them out of the line and look again
    if cost > 0 and coalesce((select balance from wallets where user_id = them.id), 0) < cost then
      delete from play_queue where user_id = them.id;
      continue;
    end if;

    pick := pool[1 + floor(random() * array_length(pool, 1))::int];
    a1 := public.random_alias();
    lvl := round((coalesce(me.pref_spice, 1) + coalesce(them.pref_spice, 1)) / 2.0)::smallint;
    -- The one who waited is player a: they go first
    insert into masquerade_sessions (user_a, user_b, intent, spice_a, spice_b, spice_level, alias_a, alias_b, started_at, ends_at, source)
    values (them.id, uid, me.pref_intent, coalesce(them.pref_spice, 1), coalesce(me.pref_spice, 1), lvl, a1, public.random_alias(a1), now(), 'infinity', 'play')
    returning id into sid;
    if cost > 0 then
      perform public.spend_keys(them.id, cost, 'play', sid::text);
      perform public.spend_keys(uid, cost, 'play', sid::text);
    end if;
    insert into masquerade_messages (session_id, kind, body)
    values (sid, 'system', 'Dashpad paired you to play ' || public.game_title(pick) || '. You''re both masked until you both unmask.');
    insert into games (kind, session_id, player_a, player_b, deadline_at)
    values (pick, sid, them.id, uid, now() + interval '30 seconds')
    returning id into gid;
    perform public.game_begin(gid);
    -- A few extra seconds so you both see the game picked before the countdown
    update games set started_at = now() + interval '7 seconds', deadline_at = now() + interval '7 seconds' + public.game_idle() where id = gid;

    update play_queue set session_id = sid, game_kind = pick, matched_at = now() where user_id = them.id;
    insert into play_queue (user_id, intent, joined_at, session_id, game_kind, matched_at)
    values (uid, me.pref_intent, now(), sid, pick, now())
    on conflict (user_id) do update set intent = excluded.intent, session_id = sid, game_kind = pick, matched_at = now();
    return json_build_object('session_id', sid, 'game', pick);
  end loop;

  -- Nobody yet: wait in line (keeping your place if you were already in it)
  insert into play_queue (user_id, intent, joined_at, seen_at)
  values (uid, me.pref_intent, now(), now())
  on conflict (user_id) do update set intent = excluded.intent, seen_at = now(),
    joined_at = case when play_queue.session_id is null then play_queue.joined_at else now() end,
    session_id = null, game_kind = null, matched_at = null;
  return json_build_object('session_id', null, 'game', null);
end $$;
