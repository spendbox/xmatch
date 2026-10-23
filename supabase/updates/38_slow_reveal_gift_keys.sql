-- Dashpad update: slow reveal photos and videos, gifts turn into Keys (Part 38)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 37 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

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
