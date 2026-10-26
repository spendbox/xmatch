-- Dashpad update: chat backgrounds you share (Part 83)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- When someone picks a background for a chat (⋮ -> Chat background), it changes for both of you.

alter table public.matches add column if not exists chat_bg text;
alter table public.masquerade_sessions add column if not exists chat_bg text;

-- Set the background of a chat you're in, for both of you
create or replace function public.set_chat_bg(p_bg text, p_match uuid default null, p_session uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  bg text := nullif(btrim(coalesce(p_bg, '')), '');
begin
  if uid is null then raise exception 'Please log in'; end if;
  if bg is not null and bg !~ '^[a-z]{2,20}$' then raise exception 'Not allowed'; end if;
  if p_match is not null then
    update matches set chat_bg = bg where id = p_match and uid in (user_a, user_b);
  elsif p_session is not null then
    update masquerade_sessions set chat_bg = bg where id = p_session and uid in (user_a, user_b);
  end if;
end $$;
revoke execute on function public.set_chat_bg(text, uuid, uuid) from public, anon;
grant execute on function public.set_chat_bg(text, uuid, uuid) to authenticated;
