-- Dashpad update: icons, bolder cards and a bonus round for "Things about you" (Part 114)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- 1. Every card gets an icon (change it in Admin -> Profile questions).
-- 2. New cards with the bigger questions: kids, marriage, faith, politics, feminism, family,
--    culture, who pays, phones, exes, bills, housework, therapy, dealbreakers and more. They come
--    right after the first 10, so they make up the bonus round. Cards you've edited are kept.
-- 3. The bonus round: answer 20 things about you (10 more than the profile needs) and get extra
--    Keys once. 10 Keys to start with; change it in Admin -> Prices. The welcome checklist still
--    needs 10. Everyone keeps the cards they've already filled in.

alter table public.thing_prompts add column if not exists icon text not null default '';

-- Icons for the cards you already have (only ones without an icon yet)
with icons(id, icon) as (values
  ('food', 'utensils'),
  ('weekend', 'calendar-heart'),
  ('music', 'music'),
  ('team', 'trophy'),
  ('work', 'briefcase'),
  ('spot', 'map-pin'),
  ('trip', 'plane'),
  ('drink', 'cup-soda'),
  ('love', 'heart'),
  ('green', 'thumbs-up'),
  ('red', 'flag'),
  ('skill', 'star'),
  ('show', 'tv'),
  ('game', 'gamepad'),
  ('lang', 'languages'),
  ('clock', 'clock'),
  ('pet', 'angry'),
  ('dream', 'rocket'),
  ('kid', 'backpack'),
  ('need', 'infinity'),
  ('take', 'flame'),
  ('place', 'landmark'),
  ('fact', 'lightbulb'),
  ('else', 'message-circle'))
update public.thing_prompts t set icon = i.icon from icons i where t.id = i.id and t.icon = '';

insert into public.thing_prompts (id, text, ideas, tone, sort, repeatable, icon) values
  ('kids', 'Kids, for me…', array['Can''t wait to be a parent','Someday','Not sure yet','Not for me']::text[], 'rose', 101, false, 'baby'),
  ('marriage', 'Marriage, for me…', array['Can''t wait','Someday, with the right person','Not for me']::text[], 'violet', 102, false, 'gem'),
  ('faith', 'Faith, for me…', array['A big part of my life','Personal and private','Not religious']::text[], 'violet', 103, false, 'hand-heart'),
  ('politics', 'Politics, for me…', array['I vote and care a lot','I follow it quietly','Not my thing']::text[], 'sky', 104, false, 'vote'),
  ('feminism', 'On feminism…', array['Proud feminist','Equality, not the label','Not for me']::text[], 'ember', 105, false, 'scale'),
  ('family', 'My family’s say in who I date…', array['They have the final say','Their opinion matters','My life, my choice']::text[], 'mint', 106, false, 'users'),
  ('culture', 'Marrying outside my tribe or culture…', array['Yes, love is love','I''d prefer not to','My family would decide']::text[], 'sky', 107, false, 'globe'),
  ('firstdate', 'On a first date, the bill…', array['Whoever asked pays','We split it','The man pays','I''ll fight you for it']::text[], 'gold', 108, false, 'receipt'),
  ('phone', 'My partner’s phone…', array['Open phones, no secrets','Privacy is respect']::text[], 'rose', 109, false, 'smartphone'),
  ('ex', 'Staying friends with an ex is…', array['Totally fine','A red flag','Depends on the ex']::text[], 'ember', 111, false, 'heart-crack'),
  ('bills', 'In a relationship, bills should…', array['Be split 50/50','Be shared by income','Be on the man']::text[], 'gold', 112, false, 'wallet'),
  ('housework', 'Housework should be…', array['Shared equally','Done by whoever has time','Traditional roles']::text[], 'mint', 113, false, 'house'),
  ('therapy', 'Therapy is…', array['For everyone','Something I''d try','Not for me']::text[], 'violet', 114, false, 'brain'),
  ('dealbreaker', 'My biggest dealbreaker…', array['Smoking','Doesn''t want kids','Wants kids','Different values','Dishonesty']::text[], 'ember', 115, false, 'ban'),
  ('together', 'Living together before marriage…', array['Yes, test the waters','Not before the wedding']::text[], 'rose', 116, false, 'key'),
  ('unpopular', 'An opinion that gets me in trouble…', '{}'::text[], 'gold', 117, false, 'megaphone')
on conflict (id) do nothing;

-- The bonus round's Keys
insert into public.app_settings (key, value) values ('things_bonus', 10) on conflict (key) do nothing;
alter table public.accounts_private add column if not exists things_bonus_at timestamptz;

-- How many Keys the bonus round gives, and whether you've had them
create or replace function public.things_bonus_status() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return null; end if;
  return json_build_object(
    'reward', public.setting_int('things_bonus', 10),
    'claimed', exists (select 1 from accounts_private where user_id = uid and things_bonus_at is not null));
end $$;

-- Claim the bonus round's Keys (once), after 20 things about you
create or replace function public.claim_things_bonus() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  reward int := public.setting_int('things_bonus', 10);
  bal int;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if reward <= 0 then raise exception 'There is no bonus right now'; end if;
  insert into accounts_private (user_id) values (uid) on conflict (user_id) do nothing;
  perform 1 from accounts_private where user_id = uid for update;
  if (select things_bonus_at from accounts_private where user_id = uid) is not null then raise exception 'Already claimed'; end if;
  if (select jsonb_array_length(coalesce(things, '[]'::jsonb)) from profiles where id = uid) < 20 then
    raise exception 'Add 20 things about you first';
  end if;
  update accounts_private set things_bonus_at = now() where user_id = uid;
  bal := public.add_keys(uid, reward, 'things_bonus');
  return json_build_object('reward', reward, 'balance', coalesce(bal, 0));
end $$;

revoke all on function public.things_bonus_status() from public, anon;
revoke all on function public.claim_things_bonus() from public, anon;
grant execute on function public.things_bonus_status() to authenticated;
grant execute on function public.claim_things_bonus() to authenticated;
