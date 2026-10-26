-- Dashpad update: edit the profile questions, and catch app errors (Part 82)
-- Run this once in Supabase, after update 81: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- 1. The "Things about you" cards people answer when they set up (My comfort food is...) now
--    live here, so Admin can change the wording and ideas, hide some, reorder, or add new ones.
-- 2. When the app hits an error on someone's phone, it's saved so it can be fixed.

create table if not exists public.thing_prompts (
  id text primary key check (char_length(id) between 1 and 24),
  text text not null check (char_length(text) between 2 and 80),
  ideas text[] not null default '{}',
  tone text not null default 'violet',
  sort int not null default 0,
  repeatable boolean not null default false, -- can be answered more than once ("A fun fact about me...")
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.thing_prompts enable row level security;
drop policy if exists "thing prompts readable" on public.thing_prompts;
create policy "thing prompts readable" on public.thing_prompts for select using (true);
grant select on public.thing_prompts to anon, authenticated;

-- The cards as they are today (only added once; your edits are kept if you run this again)
insert into public.thing_prompts (id, text, ideas, tone, sort, repeatable) values
  ('food', 'My comfort food is…', array['Jollof rice','Suya','Amala and ewedu','Pounded yam and egusi','Shawarma','Pizza']::text[], 'ember', 10, false),
  ('weekend', 'My perfect weekend…', array['Owambe till late','Beach day','Netflix and chill','Church, then brunch','Out with the squad','Sleeping in']::text[], 'violet', 20, false),
  ('music', 'On repeat right now…', array['Burna Boy','Wizkid','Asake','Tems','Rema','Amapiano']::text[], 'rose', 30, false),
  ('team', 'My football team…', array['Arsenal','Chelsea','Man United','Man City','Liverpool','Super Eagles']::text[], 'mint', 40, false),
  ('work', 'What I do…', array['Tech','Banking','Medicine','Law','Fashion','Still a student']::text[], 'sky', 50, false),
  ('spot', 'You''ll usually find me…', array['At the gym','In the kitchen','At church','Gaming','With a book','At a lounge']::text[], 'gold', 60, false),
  ('trip', 'My dream trip…', array['Zanzibar','Dubai','Paris','Cape Town','Bali','Obudu']::text[], 'sky', 70, false),
  ('drink', 'My go-to drink…', array['Chapman','Zobo','Palm wine','Coffee','Malt','Water, honestly']::text[], 'rose', 80, false),
  ('love', 'My love language…', array['Quality time','Words of affirmation','Gifts','Acts of service','Physical touch']::text[], 'rose', 90, false),
  ('green', 'A green flag for me…', array['Good listener','Makes me laugh','Ambitious','Kind to waiters','Texts back']::text[], 'mint', 100, false),
  ('red', 'An instant red flag…', array['Rude to waiters','Always late','No ambition','Bad hygiene','Never texts back']::text[], 'ember', 110, false),
  ('skill', 'I''m secretly good at…', array['Cooking','Dancing','Singing','Drawing','Fixing things','Making people laugh']::text[], 'gold', 120, false),
  ('show', 'Best show ever…', array['Game of Thrones','Money Heist','Squid Game','Big Brother Naija','Anime','The Office']::text[], 'violet', 130, false),
  ('game', 'My favourite game…', array['FIFA','Ludo','Whot','Chess','Call of Duty','Scrabble']::text[], 'mint', 140, false),
  ('lang', 'Languages I speak…', array['English','Yoruba','Igbo','Hausa','Pidgin','French']::text[], 'sky', 150, false),
  ('clock', 'I''m more of a…', array['Morning person','Night owl','Afternoon napper']::text[], 'gold', 160, false),
  ('pet', 'My pet peeve…', array['Loud chewing','Lateness','Dry replies','Traffic','Noise']::text[], 'ember', 170, false),
  ('dream', 'Someday I want to…', array['Start a business','Travel the world','Write a book','Buy a house','Retire early']::text[], 'violet', 180, false),
  ('kid', 'Growing up I wanted to be…', array['A doctor','A pilot','A footballer','A musician','A lawyer']::text[], 'sky', 190, false),
  ('need', 'I can''t live without…', array['Music','My phone','Pepper','My family','Coffee']::text[], 'gold', 200, false),
  ('take', 'My hot take…', array['Fried rice beats jollof','Pineapple belongs on pizza','Calls beat texts','Breakfast is overrated']::text[], 'ember', 210, false),
  ('place', 'My favourite spot in town…', array['Lekki Conservation Centre','Nike Art Gallery','The beach','A quiet cafe']::text[], 'mint', 220, false),
  ('fact', 'A fun fact about me…', '{}'::text[], 'violet', 230, true),
  ('else', 'Something else about me…', '{}'::text[], 'rose', 240, true)
on conflict (id) do nothing;

-- App errors from people's phones (only the server writes these; Admin reads them)
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles on delete set null,
  message text not null,
  stack text,
  url text,
  agent text,
  created_at timestamptz not null default now()
);
create index if not exists client_errors_time on public.client_errors (created_at desc);
alter table public.client_errors enable row level security;

-- How many people answered each card (Admin)
create or replace function public.admin_thing_counts() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(p, n), '{}'::json) from (
    select x->>'p' as p, count(distinct pr.id) as n
    from profiles pr, jsonb_array_elements(pr.things) x
    group by 1
  ) t
$$;
revoke execute on function public.admin_thing_counts() from public, anon, authenticated;

-- Answers can hold a few picks from the ideas ("Jollof rice, Suya, Shawarma"): up to 120 characters
create or replace function public.set_things(p_things jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean jsonb;
begin
  if uid is null then raise exception 'Please log in'; end if;
  if jsonb_typeof(p_things) <> 'array' then raise exception 'Something went wrong'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('p', p, 'a', a) order by n), '[]'::jsonb) into clean from (
    select left(btrim(x->>'p'), 24) as p, left(regexp_replace(btrim(x->>'a'), '\s+', ' ', 'g'), 120) as a, n
    from jsonb_array_elements(p_things) with ordinality as e(x, n)
    where coalesce(btrim(x->>'a'), '') <> '' and coalesce(btrim(x->>'p'), '') <> ''
    limit 40
  ) t;
  update profiles set things = clean where id = uid;
  return json_build_object('things', clean, 'count', jsonb_array_length(clean));
end $$;
