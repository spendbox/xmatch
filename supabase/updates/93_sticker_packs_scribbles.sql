-- Dashpad update: premium sticker packs and scribbles (Part 93)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Run update 92 first. Four Masky packs (Savage, Naija, Love, Owambe), bought once with Keys and
-- kept for good; everyone sees them, only owners can send them. Scribbles: draw something and
-- send it as a sticker that draws itself in the chat. Prices are set in Admin -> Prices.

insert into public.app_settings (key, value) values ('sticker_pack_cost', 40) on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('scribble_cost', 1) on conflict (key) do nothing;

create table if not exists public.sticker_packs_owned (
  user_id uuid not null references public.profiles on delete cascade,
  pack_id text not null check (pack_id in ('savage', 'naija', 'love', 'owambe')),
  keys_paid int not null default 0,
  bought_at timestamptz not null default now(),
  primary key (user_id, pack_id)
);
alter table public.sticker_packs_owned enable row level security;
drop policy if exists "see my sticker packs" on public.sticker_packs_owned;
create policy "see my sticker packs" on public.sticker_packs_owned for select using (user_id = auth.uid());

-- Which pack a pose is in (null = free)
create or replace function public.sticker_pack_of(p_pose text) returns text
language sql immutable as $$
  select case
    when p_pose in ('devil', 'sideeye', 'tea', 'micdrop', 'facepalm', 'seen') then 'savage'
    when p_pose in ('japa', 'sapa', 'odogwu', 'pray', 'wahala', 'abeg') then 'naija'
    when p_pose in ('hearthands', 'rose', 'shy', 'letter', 'call', 'hug') then 'love'
    when p_pose in ('gele', 'spray', 'cheers', 'confetti', 'cake', 'dj') then 'owambe'
  end
$$;

-- A sticker names one of Masky's poses (from a pack you own) and colours, with at most 24 characters
create or replace function public.sticker_ok(p_kind text, p_body text, p_meta jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select p_kind <> 'sticker' or (
    char_length(p_body) <= 24
    and p_meta ->> 'color' in ('#7a5cf0', '#ff7aa8', '#2fb3a0', '#ffb02e', '#e5484d', '#5b6cff')
    and (
      p_meta ->> 'pose' in ('wave', 'kiss', 'lol', 'shock', 'sleep', 'dance', 'peek', 'stamp', 'jollof', 'dice')
      or exists (select 1 from sticker_packs_owned o where o.user_id = auth.uid() and o.pack_id = public.sticker_pack_of(p_meta ->> 'pose'))
    )
  )
$$;

-- Packs you own
create or replace function public.my_sticker_packs() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(pack_id order by bought_at), '{}') from sticker_packs_owned where user_id = auth.uid()
$$;
revoke execute on function public.my_sticker_packs() from public, anon;
grant execute on function public.my_sticker_packs() to authenticated;

-- Buy a pack (once; buying one you have costs nothing). Returns your Keys left.
create or replace function public.buy_sticker_pack(p_pack text) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cost int := greatest(0, public.setting_int('sticker_pack_cost', 40));
  bal int;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_pack not in ('savage', 'naija', 'love', 'owambe') then raise exception 'Unknown pack'; end if;
  perform pg_advisory_xact_lock(hashtext('sticker_pack:' || uid::text));
  if exists (select 1 from sticker_packs_owned where user_id = uid and pack_id = p_pack) then
    select balance into bal from wallets where user_id = uid;
    return coalesce(bal, 0);
  end if;
  if cost > 0 then
    bal := public.spend_keys(uid, cost, 'sticker_pack', p_pack);
  else
    select balance into bal from wallets where user_id = uid;
  end if;
  insert into sticker_packs_owned (user_id, pack_id, keys_paid) values (uid, p_pack, cost);
  return coalesce(bal, 0);
end $$;
revoke execute on function public.buy_sticker_pack(text) from public, anon;
grant execute on function public.buy_sticker_pack(text) to authenticated;

-- Scribbles are a kind of message: the drawing (its strokes) goes in media_meta
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'image', 'video', 'audio', 'call', 'gift', 'game', 'masked', 'sticker', 'scribble'));
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check check (
  char_length(body) <= 2000 and (
    (kind = 'text' and (char_length(body) >= 1 or deleted_at is not null))
    or (kind in ('image', 'video', 'audio') and (media_path is not null or deleted_at is not null))
    or (kind = 'sticker' and (char_length(body) <= 24 or deleted_at is not null))
    or kind in ('call', 'gift', 'game', 'masked', 'scribble')
  )
);
alter table public.messages drop constraint if exists messages_meta_small;
alter table public.messages add constraint messages_meta_small check (
  media_meta is null or pg_column_size(media_meta) <= 4000
  or (kind = 'masked' and pg_column_size(media_meta) <= 400000)
  or (kind = 'scribble' and pg_column_size(media_meta) <= 60000)
) not valid;
alter table public.masquerade_messages drop constraint if exists masquerade_messages_kind_check;
alter table public.masquerade_messages add constraint masquerade_messages_kind_check
  check (kind in ('text', 'icebreaker', 'gift', 'system', 'game', 'meet', 'audio', 'sticker', 'scribble'));

-- Send a scribble (paid). In a chat (p_match) or a masked chat (p_session). Returns the message.
create or replace function public.send_scribble(p_drawing jsonb, p_match uuid default null, p_session uuid default null, p_reply bigint default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cost int := greatest(0, public.setting_int('scribble_cost', 1));
  out json;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if jsonb_typeof(p_drawing -> 'strokes') <> 'array' or jsonb_array_length(p_drawing -> 'strokes') not between 1 and 300 then
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
  return out;
end $$;
revoke execute on function public.send_scribble(jsonb, uuid, uuid, bigint) from public, anon;
grant execute on function public.send_scribble(jsonb, uuid, uuid, bigint) to authenticated;
