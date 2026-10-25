-- Dashpad update: free Keys when you sign up (Part 64)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 63 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 64: New accounts get signup_keys Keys (5 to start, set in Admin -> Prices).
-- Only once per email: deleting your account and signing up again doesn't pay twice
-- (we keep a scrambled copy of the email for that, not the email itself).
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value) values ('signup_keys', 5) on conflict (key) do nothing;

create table if not exists public.welcome_given (
  email_hash text primary key,
  created_at timestamptz not null default now()
);
alter table public.welcome_given enable row level security;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n int := public.setting_int('signup_keys', 5);
  h text := md5(lower(btrim(coalesce(new.email, new.phone, new.id::text))));
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  insert into accounts_private (user_id, email, terms_accepted_at)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz)
  on conflict do nothing;
  -- Welcome Keys, once per email. Never stops the sign-up if something goes wrong.
  if n > 0 then
    begin
      insert into welcome_given (email_hash) values (h);
      perform public.add_keys(new.id, n, 'signup', null);
    exception when unique_violation then null;
              when others then raise warning 'welcome keys failed: %', sqlerrm;
    end;
  end if;
  return new;
end $$;
