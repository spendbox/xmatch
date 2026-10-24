-- Dashpad update: photos on Cloudflare R2 (Part 57)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 56 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

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
