-- Dashpad update: admin sets the gift share (Part 75)
-- The person who gets a gift receives this percent of its price as Keys (was always 50%).
-- Change it in Admin → Prices → Gifts. Rounded down.

insert into app_settings (key, value) values ('gift_share_percent', 50) on conflict (key) do nothing;

create or replace function public.send_gift(p_gift text, p_match uuid default null, p_session uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g gifts;
  bal int;
  share int;
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
  share := g.price * least(100, greatest(0, public.setting_int('gift_share_percent', 50))) / 100;
  if share > 0 then perform public.add_keys(them, share, 'gift_received', g.id); end if;
  return bal;
end $$;

create or replace function public.gift_answer(p_answer uuid, p_gift text) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a prompt_answers;
  g gifts;
  bal int;
  share int;
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
  share := g.price * least(100, greatest(0, public.setting_int('gift_share_percent', 50))) / 100;
  if share > 0 then perform public.add_keys(a.user_id, share, 'gift_received', g.id); end if;
  return bal;
end $$;
