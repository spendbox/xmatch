-- Dashpad update: drawing together (Part 96)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Run update 94 first. Start a drawing for you both (Keys, set in Admin -> Prices); you both draw on
-- one board, live. Either of you sends it to the chat as one wide painting. Not sent within
-- 2 hours (or closed empty): the Keys go back.

insert into public.app_settings (key, value) values ('draw_together_cost', 2) on conflict (key) do nothing;

create table if not exists public.draw_sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches on delete cascade,
  session_id uuid references public.masquerade_sessions on delete cascade,
  starter uuid not null references public.profiles on delete cascade,
  partner uuid not null references public.profiles on delete cascade,
  cost int not null default 0,
  status text not null default 'open' check (status in ('open', 'sent', 'refunded')),
  drawing jsonb,
  invite_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((match_id is null) <> (session_id is null))
);
create index if not exists draw_sessions_open on public.draw_sessions (created_at) where status = 'open';
create index if not exists draw_sessions_match on public.draw_sessions (match_id) where match_id is not null;
create index if not exists draw_sessions_masked on public.draw_sessions (session_id) where session_id is not null;
alter table public.draw_sessions enable row level security;
drop policy if exists "see our drawings" on public.draw_sessions;
create policy "see our drawings" on public.draw_sessions for select using (starter = auth.uid() or partner = auth.uid());

-- The "started a drawing for you both" card is a kind of message
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'image', 'video', 'audio', 'call', 'gift', 'game', 'masked', 'sticker', 'scribble', 'draw'));
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check check (
  char_length(body) <= 2000 and (
    (kind = 'text' and (char_length(body) >= 1 or deleted_at is not null))
    or (kind in ('image', 'video', 'audio') and (media_path is not null or deleted_at is not null))
    or (kind = 'sticker' and (char_length(body) <= 24 or deleted_at is not null))
    or kind in ('call', 'gift', 'game', 'masked', 'scribble', 'draw')
  )
);
alter table public.masquerade_messages drop constraint if exists masquerade_messages_kind_check;
alter table public.masquerade_messages add constraint masquerade_messages_kind_check
  check (kind in ('text', 'icebreaker', 'gift', 'system', 'game', 'meet', 'audio', 'sticker', 'scribble', 'draw'));

-- The card shows how the drawing went (open, sent, closed)
create or replace function public.draw_card_status(d draw_sessions) returns void
language plpgsql security definer set search_path = public as $$
begin
  if d.invite_id is null then return; end if;
  if d.match_id is not null then
    update messages set media_meta = coalesce(media_meta, '{}'::jsonb) || jsonb_build_object('status', d.status) where id = d.invite_id;
  else
    update masquerade_messages set media_meta = coalesce(media_meta, '{}'::jsonb) || jsonb_build_object('status', d.status) where id = d.invite_id;
  end if;
end $$;
revoke execute on function public.draw_card_status(draw_sessions) from public, anon, authenticated;

-- Keys back for drawings never sent
create or replace function public.refund_draw(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d draw_sessions;
begin
  update draw_sessions set status = 'refunded', updated_at = now() where id = p_id and status = 'open' returning * into d;
  if d.id is null then return; end if;
  if d.cost > 0 then perform public.add_keys(d.starter, d.cost, 'draw_refund', d.id::text); end if;
  perform public.draw_card_status(d);
end $$;
revoke execute on function public.refund_draw(uuid) from public, anon, authenticated;

create or replace function public.refund_stale_draws() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  r record;
begin
  for r in select id from draw_sessions where status = 'open' and updated_at < now() - interval '2 hours' limit 500 loop
    perform public.refund_draw(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.refund_stale_draws() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('dashpad-draw-refunds', '*/10 * * * *', 'select public.refund_stale_draws()');
  end if;
end $$;

-- Start drawing together (takes the Keys). An open one for the same chat is reused, not charged again.
create or replace function public.start_draw_together(p_match uuid default null, p_session uuid default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  them uuid;
  cost int := greatest(0, public.setting_int('draw_together_cost', 2));
  d draw_sessions;
  card bigint;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  perform public.refund_stale_draws();
  if p_match is not null then
    select case when user_a = uid then user_b else user_a end into them from matches where id = p_match and (user_a = uid or user_b = uid);
    if them is null then raise exception 'Not your match'; end if;
    select * into d from draw_sessions where match_id = p_match and status = 'open' order by created_at desc limit 1;
  elsif p_session is not null then
    select case when user_a = uid then user_b else user_a end into them from masquerade_sessions
    where id = p_session and (user_a = uid or user_b = uid) and status = 'active' and now() < ends_at;
    if them is null then raise exception 'This chat has ended'; end if;
    select * into d from draw_sessions where session_id = p_session and status = 'open' order by created_at desc limit 1;
  else
    raise exception 'Choose who to draw with';
  end if;
  if d.id is not null then return row_to_json(d); end if;

  if cost > 0 then perform public.spend_keys(uid, cost, 'draw_together', coalesce(p_match, p_session)::text); end if;
  insert into draw_sessions (match_id, session_id, starter, partner, cost) values (p_match, p_session, uid, them, cost) returning * into d;
  if p_match is not null then
    insert into messages (match_id, sender_id, kind, body, media_meta)
    values (p_match, uid, 'draw', 'Drawing together', jsonb_build_object('draw', d.id, 'status', 'open')) returning id into card;
  else
    insert into masquerade_messages (session_id, sender_id, kind, body, media_meta)
    values (p_session, uid, 'draw', 'Drawing together', jsonb_build_object('draw', d.id, 'status', 'open')) returning id into card;
  end if;
  update draw_sessions set invite_id = card where id = d.id returning * into d;
  return row_to_json(d);
end $$;
revoke execute on function public.start_draw_together(uuid, uuid) from public, anon;
grant execute on function public.start_draw_together(uuid, uuid) to authenticated;

-- Keep the board, so whoever opens it later sees what's there
create or replace function public.save_draw(p_id uuid, p_drawing jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if pg_column_size(p_drawing) > 60000 then raise exception 'That drawing is too big. Try fewer lines.'; end if;
  update draw_sessions set drawing = p_drawing, updated_at = now()
  where id = p_id and status = 'open' and (starter = auth.uid() or partner = auth.uid());
end $$;
revoke execute on function public.save_draw(uuid, jsonb) from public, anon;
grant execute on function public.save_draw(uuid, jsonb) to authenticated;

-- Close it without sending: an empty board gets the Keys back straight away
create or replace function public.close_draw(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d draw_sessions;
begin
  select * into d from draw_sessions where id = p_id and status = 'open' and (starter = auth.uid() or partner = auth.uid());
  if d.id is null then return; end if;
  if d.drawing is null or coalesce(jsonb_array_length(d.drawing -> 'strokes'), 0) = 0 then
    perform public.refund_draw(d.id);
  end if;
end $$;
revoke execute on function public.close_draw(uuid) from public, anon;
grant execute on function public.close_draw(uuid) to authenticated;

-- Send it: one wide painting in the chat, from you both (and saved for you both)
create or replace function public.send_draw(p_id uuid, p_drawing jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d draw_sessions;
  meta jsonb;
  out json;
begin
  select * into d from draw_sessions where id = p_id and status = 'open' and (starter = uid or partner = uid) for update;
  if d.id is null then raise exception 'This drawing was already sent or closed'; end if;
  if jsonb_typeof(p_drawing -> 'strokes') is distinct from 'array' or jsonb_array_length(p_drawing -> 'strokes') not between 1 and 600 then
    raise exception 'Draw something first';
  end if;
  if pg_column_size(p_drawing) > 60000 then raise exception 'That drawing is too big. Try fewer lines.'; end if;
  meta := p_drawing || jsonb_build_object('by', jsonb_build_array(d.starter, d.partner));
  if d.match_id is not null then
    insert into messages (match_id, sender_id, kind, body, media_meta)
    values (d.match_id, uid, 'scribble', 'Drawing', meta) returning row_to_json(messages.*) into out;
  else
    insert into masquerade_messages (session_id, sender_id, kind, body, media_meta)
    values (d.session_id, uid, 'scribble', 'Drawing', meta) returning row_to_json(masquerade_messages.*) into out;
  end if;
  update draw_sessions set status = 'sent', drawing = p_drawing, updated_at = now() where id = d.id returning * into d;
  perform public.draw_card_status(d);
  begin
    perform public.keep_scribble(d.starter, p_drawing);
    perform public.keep_scribble(d.partner, p_drawing);
  exception when others then null;
  end;
  return out;
end $$;
revoke execute on function public.send_draw(uuid, jsonb) from public, anon;
grant execute on function public.send_draw(uuid, jsonb) to authenticated;

-- Drawings together may be bigger (two people's lines)
alter table public.messages drop constraint if exists messages_meta_small;
alter table public.messages add constraint messages_meta_small check (
  media_meta is null or pg_column_size(media_meta) <= 4000
  or (kind = 'masked' and pg_column_size(media_meta) <= 400000)
  or (kind = 'scribble' and pg_column_size(media_meta) <= 61000)
) not valid;

-- Live updates to the drawing card
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'draw_sessions') then
    alter publication supabase_realtime add table public.draw_sessions;
  end if;
exception when undefined_object then null;
end $$;
