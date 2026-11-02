-- Dashpad update: 20 Things about you, with bolder cards (Part 114)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- 1. New "Things about you" cards with bigger questions (kids, marriage, feminism, who pays, faith,
--    family, culture, phones, exes, bills, housework, politics, therapy, dealbreakers...). They sit
--    between the cards you already have. Cards you've edited in Admin are left as they are.
-- 2. The welcome Keys now need 20 things instead of 10. Anyone who already claimed keeps their Keys,
--    and everyone keeps the cards they've already filled in.

insert into public.thing_prompts (id, text, ideas, tone, sort, repeatable) values
  ('kids', 'Kids, for me…', array['Can''t wait to be a parent','Someday','Not sure yet','Not for me']::text[], 'rose', 15, false),
  ('marriage', 'Marriage, for me…', array['Can''t wait','Someday, with the right person','Not for me']::text[], 'violet', 25, false),
  ('feminism', 'On feminism…', array['Proud feminist','Equality, not the label','Not for me']::text[], 'ember', 35, false),
  ('firstdate', 'On a first date, the bill…', array['Whoever asked pays','We split it','The man pays','I''ll fight you for it']::text[], 'gold', 45, false),
  ('faith', 'Faith, for me…', array['A big part of my life','Personal and private','Not religious']::text[], 'violet', 55, false),
  ('family', 'My family’s say in who I date…', array['They have the final say','Their opinion matters','My life, my choice']::text[], 'mint', 65, false),
  ('culture', 'Marrying outside my tribe or culture…', array['Yes, love is love','I''d prefer not to','My family would decide']::text[], 'sky', 75, false),
  ('phone', 'My partner’s phone…', array['Open phones, no secrets','Privacy is respect']::text[], 'rose', 85, false),
  ('ex', 'Staying friends with an ex is…', array['Totally fine','A red flag','Depends on the ex']::text[], 'ember', 95, false),
  ('bills', 'In a relationship, bills should…', array['Be split 50/50','Be shared by income','Be on the man']::text[], 'gold', 105, false),
  ('housework', 'Housework should be…', array['Shared equally','Done by whoever has time','Traditional roles']::text[], 'mint', 115, false),
  ('politics', 'Politics, for me…', array['I vote and care a lot','I follow it quietly','Not my thing']::text[], 'sky', 125, false),
  ('therapy', 'Therapy is…', array['For everyone','Something I''d try','Not for me']::text[], 'violet', 135, false),
  ('dealbreaker', 'My biggest dealbreaker…', array['Smoking','Doesn''t want kids','Wants kids','Different values','Dishonesty']::text[], 'ember', 145, false),
  ('together', 'Living together before marriage…', array['Yes, test the waters','Not before the wedding']::text[], 'rose', 155, false),
  ('unpopular', 'An opinion that gets me in trouble…', '{}'::text[], 'gold', 165, false)
on conflict (id) do nothing;

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
  if jsonb_array_length(coalesce(p.things, '[]'::jsonb)) < 20 then raise exception 'Add 20 things about you first'; end if;
  -- Notifications are part of it on every phone (on iPhone, once Dashpad is on the home screen)
  if not exists (select 1 from push_subscriptions where user_id = uid) then
    raise exception 'Turn on notifications first';
  end if;
  update accounts_private set setup_reward_at = now() where user_id = uid;
  bal := case when reward > 0 then public.add_keys(uid, reward, 'setup') else (select balance from wallets where user_id = uid) end;
  return json_build_object('reward', reward, 'balance', coalesce(bal, 0));
end $$;
