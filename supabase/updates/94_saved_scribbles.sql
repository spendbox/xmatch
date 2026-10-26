-- Dashpad update: saved scribbles (Part 94)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Run update 93 first. Keep a scribble you sent, or one you were sent, and send it again for free.
-- Up to 60 each. Saved ones are copied from the chat by the server, so only real scribbles are kept.

create table if not exists public.saved_scribbles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  drawing jsonb not null,
  hash text not null,
  created_at timestamptz not null default now(),
  unique (user_id, hash)
);
create index if not exists saved_scribbles_user on public.saved_scribbles (user_id, created_at desc);
alter table public.saved_scribbles enable row level security;
drop policy if exists "see my saved scribbles" on public.saved_scribbles;
create policy "see my saved scribbles" on public.saved_scribbles for select using (user_id = auth.uid());

-- Keep a drawing (once; saving the same one again gives back the one you have)
create or replace function public.keep_scribble(uid uuid, d jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  h text := md5(d::text);
  out uuid;
begin
  select id into out from saved_scribbles where user_id = uid and hash = h;
  if out is not null then return out; end if;
  if (select count(*) from saved_scribbles where user_id = uid) >= 60 then
    raise exception 'You have 60 saved scribbles. Delete one to save another.';
  end if;
  insert into saved_scribbles (user_id, drawing, hash) values (uid, d, h) returning id into out;
  return out;
end $$;
revoke execute on function public.keep_scribble(uuid, jsonb) from public, anon, authenticated;

-- Save a scribble from a chat you're in (yours or theirs)
create or replace function public.save_scribble(p_message bigint, p_masked boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d jsonb;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_masked then
    select x.media_meta into d from masquerade_messages x join masquerade_sessions s on s.id = x.session_id
    where x.id = p_message and x.kind = 'scribble' and (s.user_a = uid or s.user_b = uid);
  else
    select x.media_meta into d from messages x join matches m on m.id = x.match_id
    where x.id = p_message and x.kind = 'scribble' and x.deleted_at is null and (m.user_a = uid or m.user_b = uid);
  end if;
  if d is null then raise exception 'Scribble not found'; end if;
  return public.keep_scribble(uid, d);
end $$;
revoke execute on function public.save_scribble(bigint, boolean) from public, anon;
grant execute on function public.save_scribble(bigint, boolean) to authenticated;

create or replace function public.delete_saved_scribble(p_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from saved_scribbles where id = p_id and user_id = auth.uid()
$$;
revoke execute on function public.delete_saved_scribble(uuid) from public, anon;
grant execute on function public.delete_saved_scribble(uuid) to authenticated;

-- Send a scribble: a new drawing (paid, and kept if p_keep), or one you saved (free)
drop function if exists public.send_scribble(jsonb, uuid, uuid, bigint);
create or replace function public.send_scribble(
  p_drawing jsonb default null, p_match uuid default null, p_session uuid default null, p_reply bigint default null,
  p_saved uuid default null, p_keep boolean default false
) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cost int := greatest(0, public.setting_int('scribble_cost', 1));
  out json;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_saved is not null then
    select drawing into p_drawing from saved_scribbles where id = p_saved and user_id = uid;
    if p_drawing is null then raise exception 'That saved scribble is gone'; end if;
    cost := 0;
  end if;
  if jsonb_typeof(p_drawing -> 'strokes') is distinct from 'array' or jsonb_array_length(p_drawing -> 'strokes') not between 1 and 300 then
    raise exception 'Draw something first';
  end if;
  if pg_column_size(p_drawing) > 60000 then raise exception 'That scribble is too big. Try fewer lines.'; end if;
  if p_match is not null then
    if not exists (select 1 from matches where id = p_match and (user_a = uid or user_b = uid)) then raise exception 'Not your match'; end if;
    if cost > 0 then perform public.spend_keys(uid, cost, 'scribble', p_match::text); end if;
    insert into messages (match_id, sender_id, kind, body, media_meta, reply_to)
    values (p_match, uid, 'scribble', 'Scribble', p_drawing,
      (select id from messages where id = p_reply and match_id = p_match))
    returning row_to_json(messages.*) into out;
  elsif p_session is not null then
    if not exists (select 1 from masquerade_sessions where id = p_session and (user_a = uid or user_b = uid)
      and status = 'active' and now() < ends_at) then raise exception 'This chat has ended'; end if;
    if cost > 0 then perform public.spend_keys(uid, cost, 'scribble', p_session::text); end if;
    insert into masquerade_messages (session_id, sender_id, kind, body, media_meta, reply_to)
    values (p_session, uid, 'scribble', 'Scribble', p_drawing,
      (select id from masquerade_messages where id = p_reply and session_id = p_session))
    returning row_to_json(masquerade_messages.*) into out;
  else
    raise exception 'Choose who to send it to';
  end if;
  -- Keeping it is a bonus: a full collection doesn't stop the send
  if p_keep and p_saved is null then
    begin
      perform public.keep_scribble(uid, p_drawing);
    exception when others then null;
    end;
  end if;
  return out;
end $$;
revoke execute on function public.send_scribble(jsonb, uuid, uuid, bigint, uuid, boolean) from public, anon;
grant execute on function public.send_scribble(jsonb, uuid, uuid, bigint, uuid, boolean) to authenticated;
