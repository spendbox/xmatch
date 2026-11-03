-- Dashpad update: Truths, one bold question a day (Part 115)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- Every day at 8pm (Lagos time) a new Truth goes up for everyone: "Would you date someone who earns
-- less than you?" You pick an answer, and can say why in a short masked voice note (disguised on
-- your phone). Then you see how everyone answered, listen to other people's voice answers, and
-- wave at someone. If you both wave, a free masked chat opens (the same as waving on Meet).
--
-- 1. truths: the questions. 365 are added, one for each day from 2 November 2026. Edit, add,
--    reschedule or switch any of them off in Admin -> Truths. If a day has nothing scheduled, the
--    next unscheduled question is used.
-- 2. truth_answers: one answer per person per Truth, with the voice note if they recorded one.
-- 3. truth_today(): today's Truth, your answer and streak, and (once you've answered) the results.
-- 4. answer_truth(): answer today's Truth (and add a voice note).
-- 5. truth_listen(): counts a listen on someone's voice answer.
-- The time it changes is a setting (truths_hour, 0-23, Lagos time; 20 = 8pm).

create table if not exists public.truths (
  id bigint generated always as identity primary key,
  day date unique,
  body text not null check (char_length(body) between 5 and 160),
  -- [{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]
  options jsonb not null,
  kind text not null default 'light',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.truths enable row level security;

create table if not exists public.truth_answers (
  id bigint generated always as identity primary key,
  truth_id bigint not null references public.truths on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  choice text not null,
  -- The name you go by on this Truth (masked)
  alias text not null,
  voice_key text,
  voice_seconds int,
  voice_style text,
  listens int not null default 0,
  -- Hidden by Admin (a voice answer that breaks the rules)
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (truth_id, user_id)
);
create index if not exists truth_answers_user on public.truth_answers (user_id, truth_id);
create index if not exists truth_answers_truth on public.truth_answers (truth_id, created_at desc);
alter table public.truth_answers enable row level security;

insert into public.app_settings (key, value) values ('truths_hour', 20) on conflict (key) do nothing;

-- Which Truth day it is now (a new one starts every day at truths_hour, Lagos time)
create or replace function public.truth_day() returns date
language sql stable set search_path = public as $$
  select ((now() at time zone 'Africa/Lagos') - make_interval(hours => least(23, greatest(0, public.setting_int('truths_hour', 20)))))::date
$$;

-- Today's Truth for you: the question, your answer and streak, and the results once you've answered
create or replace function public.truth_today() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d date := public.truth_day();
  t truths;
  mine truth_answers;
  streak int := 0;
  k date;
  ends timestamptz;
  total int;
  res json := null;
begin
  if uid is null then return null; end if;
  select * into t from truths where day = d and active;
  if not found then
    -- Nothing on for today (none set, or the one set was switched off in Admin):
    -- use the next question that hasn't had a day yet
    begin
      update truths set day = null where day = d and not active;
      update truths set day = d
      where id = (select id from truths where day is null and active order by id limit 1) and day is null
      returning * into t;
    exception when unique_violation then
      -- Someone else just picked today's
      null;
    end;
    if t.id is null then
      select * into t from truths where day = d and active;
      if not found then return json_build_object('none', true); end if;
    end if;
  end if;
  select * into mine from truth_answers where truth_id = t.id and user_id = uid;
  -- Your streak: days in a row you've answered (today counts once you answer)
  k := case when mine.id is null then d - 1 else d end;
  while streak < 400 and exists (
    select 1 from truth_answers a join truths x on x.id = a.truth_id where a.user_id = uid and x.day = k
  ) loop
    streak := streak + 1;
    k := k - 1;
  end loop;
  ends := ((d + 1)::timestamp + make_interval(hours => least(23, greatest(0, public.setting_int('truths_hour', 20))))) at time zone 'Africa/Lagos';
  select count(*)::int into total from truth_answers where truth_id = t.id;

  if mine.id is not null then
    select json_build_object(
      'counts', coalesce((select json_object_agg(choice, n) from (select choice, count(*)::int n from truth_answers where truth_id = t.id group by choice) c), '{}'::json),
      'women', coalesce((select json_object_agg(choice, n) from (select a.choice, count(*)::int n from truth_answers a join profiles p on p.id = a.user_id where a.truth_id = t.id and p.gender = 'woman' group by a.choice) c), '{}'::json),
      'men', coalesce((select json_object_agg(choice, n) from (select a.choice, count(*)::int n from truth_answers a join profiles p on p.id = a.user_id where a.truth_id = t.id and p.gender = 'man' group by a.choice) c), '{}'::json),
      'voices', coalesce((select json_agg(v order by v.same desc, v.listens desc, v.at desc) from (
        select a.id, a.alias, a.choice, a.voice_key as key, a.voice_seconds as seconds, a.listens, a.created_at as at,
          a.user_id as person, a.choice = mine.choice as same,
          public.shown_age(p.birthdate, p.hide_age, p.id) as age, p.gender,
          exists (select 1 from waves w where w.from_id = uid and w.to_id = a.user_id) as waved,
          public.explore_visible(uid, a.user_id) as can_wave
        from truth_answers a join profiles p on p.id = a.user_id
        where a.truth_id = t.id and a.voice_key is not null and not a.hidden and a.user_id <> uid
          and not public.is_blocked(uid, a.user_id)
        order by a.choice = mine.choice desc, a.listens desc, a.created_at desc
        limit 80) v), '[]'::json),
      -- Waves you've had since you answered, from people who answered too
      'waves', (select count(*)::int from waves w join truth_answers a on a.user_id = w.from_id and a.truth_id = t.id
                where w.to_id = uid and w.created_at >= mine.created_at)
    ) into res;
  end if;

  return json_build_object(
    'id', t.id, 'body', t.body, 'options', t.options, 'day', d, 'ends_at', ends, 'total', total, 'streak', streak,
    'mine', case when mine.id is null then null else json_build_object(
      'choice', mine.choice, 'alias', mine.alias, 'key', mine.voice_key, 'seconds', mine.voice_seconds, 'listens', mine.listens) end,
    'results', res);
end $$;

-- Answer today's Truth (once), and add a voice note now or later
create or replace function public.answer_truth(p_truth bigint, p_choice text, p_key text default null, p_seconds int default null, p_style text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  t truths;
begin
  if uid is null then raise exception 'Please log in'; end if;
  select * into t from truths where id = p_truth and active;
  if not found or t.day is distinct from public.truth_day() then raise exception 'This Truth has ended. A new one is up'; end if;
  if not exists (select 1 from jsonb_array_elements(t.options) o where o->>'id' = p_choice) then raise exception 'Pick one of the answers'; end if;
  if coalesce(p_key, '') <> '' then
    if p_key not like 'truth/' || uid::text || '/%' or p_key like '%..%' then raise exception 'Not allowed'; end if;
    if coalesce(p_seconds, 0) < 1 or p_seconds > 31 then raise exception 'Voice answers are up to 30 seconds'; end if;
  end if;
  insert into truth_answers (truth_id, user_id, choice, alias, voice_key, voice_seconds, voice_style)
  values (t.id, uid, p_choice, public.random_alias(), nullif(p_key, ''), case when coalesce(p_key, '') <> '' then p_seconds end, case when coalesce(p_key, '') <> '' then left(coalesce(p_style, ''), 20) end)
  on conflict (truth_id, user_id) do update
    set voice_key = coalesce(excluded.voice_key, truth_answers.voice_key),
        voice_seconds = coalesce(excluded.voice_seconds, truth_answers.voice_seconds),
        voice_style = coalesce(excluded.voice_style, truth_answers.voice_style);
  return public.truth_today();
end $$;

-- Someone listened to a voice answer
create or replace function public.truth_listen(p_answer bigint) returns void
language sql security definer set search_path = public as $$
  update truth_answers set listens = listens + 1 where id = p_answer and user_id <> auth.uid()
$$;

revoke all on function public.truth_today() from public, anon;
revoke all on function public.answer_truth(bigint, text, text, int, text) from public, anon;
revoke all on function public.truth_listen(bigint) from public, anon;
grant execute on function public.truth_today() to authenticated;
grant execute on function public.answer_truth(bigint, text, text, int, text) to authenticated;
grant execute on function public.truth_listen(bigint) to authenticated;

-- Admin: answers per Truth ({"12": {"total": 340, "voices": 21, "counts": {"a": 200, "b": 140}}})
create or replace function public.admin_truth_stats() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(truth_id, json_build_object('total', total, 'voices', voices, 'counts', counts)), '{}'::json)
  from (
    select truth_id, sum(n)::int as total, sum(v)::int as voices, json_object_agg(choice, n) as counts
    from (
      select truth_id, choice, count(*) as n, count(voice_key) filter (where not hidden) as v
      from truth_answers group by truth_id, choice
    ) c
    group by truth_id
  ) t
$$;
revoke all on function public.admin_truth_stats() from public, anon, authenticated;

-- The first year of Truths (added once; your edits in Admin are kept)
insert into public.truths (day, body, options, kind) values
  ('2026-11-02', 'Would you rather text or call?', '[{"id": "a", "label": "Text"}, {"id": "b", "label": "Call"}]'::jsonb, 'light'),
  ('2026-11-03', 'Would you date someone who earns less than you?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-11-04', 'Is a kiss on the first date too soon?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2026-11-05', 'Do you say "I''m fine" when you''re not?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2026-11-06', 'Are you a feminist?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "Equality, not the label"}, {"id": "c", "label": "No"}]'::jsonb, 'society'),
  ('2026-11-07', 'Beach day or city day?', '[{"id": "a", "label": "Beach day"}, {"id": "b", "label": "City day"}]'::jsonb, 'light'),
  ('2026-11-08', 'Should couples share their phone passwords?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-11-09', 'Are you a morning person?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2026-11-10', 'Is it okay to check your partner''s phone?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-11-11', 'Would you send the first message?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2026-11-12', 'Have you forgiven someone who never said sorry?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2026-11-13', 'Do you vote?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2026-11-14', 'Pineapple on pizza?', '[{"id": "a", "label": "Love it"}, {"id": "b", "label": "Absolutely not"}]'::jsonb, 'light'),
  ('2026-11-15', 'Would you sign a prenup?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-11-16', 'Have you ever had a crush on a friend''s partner?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2026-11-17', 'Are you where you thought you''d be at this age?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2026-11-18', 'Do you reply to messages straight away?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2026-11-19', 'Who should pay the bills in a relationship?', '[{"id": "a", "label": "Split 50/50"}, {"id": "b", "label": "Whoever earns more"}, {"id": "c", "label": "The man"}]'::jsonb, 'real'),
  ('2026-11-20', 'Sweet or spicy?', '[{"id": "a", "label": "Sweet"}, {"id": "b", "label": "Spicy"}]'::jsonb, 'light'),
  ('2026-11-21', 'Can men and women be just friends?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-11-22', 'Should religion and politics stay out of dating?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2026-11-23', 'Do you flirt even when you''re not interested?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2026-11-24', 'Do you find it hard to ask for help?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2026-11-25', 'Would you rather have a cat or a dog?', '[{"id": "a", "label": "Cat"}, {"id": "b", "label": "Dog"}]'::jsonb, 'light'),
  ('2026-11-26', 'Would you date someone with kids?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-11-27', 'Do you sing in the shower?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2026-11-28', 'Is it okay to stay friends with your ex?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-11-29', 'Would you date someone you met at a party?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2026-11-30', 'Would you rather be loved or respected?', '[{"id": "a", "label": "Loved"}, {"id": "b", "label": "Respected"}]'::jsonb, 'deep'),
  ('2026-12-01', 'Would you marry outside your tribe or culture?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2026-12-02', 'Movies at home or at the cinema?', '[{"id": "a", "label": "At home"}, {"id": "b", "label": "At the cinema"}]'::jsonb, 'light'),
  ('2026-12-03', 'Would you move abroad for love?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-12-04', 'Is it okay to keep your ex''s pictures?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2026-12-05', 'Do you believe everything happens for a reason?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2026-12-06', 'Would you go on a blind date?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2026-12-07', 'Would you date someone your parents don''t like?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-12-08', 'Should women propose?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2026-12-09', 'Do you sleep with socks on?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2026-12-10', 'Should couples have a joint account?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-12-11', 'Have you ever checked an ex''s profile late at night?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2026-12-12', 'Have you ever cut off a family member?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2026-12-13', 'Is breakfast the most important meal?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2026-12-14', 'Would you forgive cheating?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-12-15', 'Is social media making us lonelier?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2026-12-16', 'Would you rather be early or fashionably late?', '[{"id": "a", "label": "Early"}, {"id": "b", "label": "Fashionably late"}]'::jsonb, 'light'),
  ('2026-12-17', 'Is long distance worth it?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-12-18', 'Would you rather date someone hot or funny?', '[{"id": "a", "label": "Hot"}, {"id": "b", "label": "Funny"}]'::jsonb, 'spicy'),
  ('2026-12-19', 'Do you feel lonely even with people around?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2026-12-20', 'Do you make your bed every morning?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2026-12-21', 'Should you tell your partner how much you earn?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-12-22', 'Do you believe in friends with benefits?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2026-12-23', 'Would you go back and change one decision?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2026-12-24', 'Should housework be split equally?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2026-12-25', 'Would you eat street food on a first date?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2026-12-26', 'Would you date someone shorter than you?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-12-27', 'Is it okay to recline your seat on a plane?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2026-12-28', 'Is it okay to go on holiday without your partner?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2026-12-29', 'Would you go on a date with someone from Dashpad tonight?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2026-12-30', 'Do people really change?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2026-12-31', 'Do you read the terms and conditions?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-01-01', 'Do you believe in soulmates?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-01-02', 'Do you trust the news?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-01-03', 'Would you rather lose your phone or your wallet?', '[{"id": "a", "label": "My phone"}, {"id": "b", "label": "My wallet"}]'::jsonb, 'light'),
  ('2027-01-04', 'Would you date someone of a different religion?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-01-05', 'Is a good kisser more important than a good cook?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-01-06', 'Are you closer to your mum or your dad?', '[{"id": "a", "label": "Mum"}, {"id": "b", "label": "Dad"}, {"id": "c", "label": "Neither"}]'::jsonb, 'deep'),
  ('2027-01-07', 'Do you give your plants names?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-01-08', 'Should the man always make the first move?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-01-09', 'Is it okay for men to cry in public?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-01-10', 'Have you ever fallen for someone online?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-01-11', 'Do you cry when you''re alone?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-01-12', 'Is a hot dog a sandwich?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-01-13', 'Would you date your best friend''s ex?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-01-14', 'Would you rather cook or wash the dishes?', '[{"id": "a", "label": "Cook"}, {"id": "b", "label": "Wash up"}]'::jsonb, 'light'),
  ('2027-01-15', 'Is jealousy a sign of love?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-01-16', 'Would you tell someone you like them first?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-01-17', 'Have you ever loved someone who didn''t love you back?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-01-18', 'Would you leave the country for a better life?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-01-19', 'Do you read the last page of a book first?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-01-20', 'Should you meet each other''s family early?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-01-21', 'Do you double text?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-01-22', 'Would you live together before marriage?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-01-23', 'Is it okay to date two people before it''s serious?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-01-24', 'Would you rather be happy or successful?', '[{"id": "a", "label": "Happy"}, {"id": "b", "label": "Successful"}]'::jsonb, 'deep'),
  ('2027-01-25', 'Should parents choose who their children marry?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-01-26', 'Would you rather live in the city or the countryside?', '[{"id": "a", "label": "City"}, {"id": "b", "label": "Countryside"}]'::jsonb, 'light'),
  ('2027-01-27', 'Do you want children someday?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}, {"id": "c", "label": "Not sure"}]'::jsonb, 'real'),
  ('2027-01-28', 'Do you prefer being chased or chasing?', '[{"id": "a", "label": "Being chased"}, {"id": "b", "label": "Chasing"}]'::jsonb, 'spicy'),
  ('2027-01-29', 'Do you trust people easily?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-01-30', 'Is it rude to keep your phone on the table at dinner?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-01-31', 'Would you date someone who smokes?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-02-01', 'Do you dance when no one is watching?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-02-02', 'Is it okay to have a best friend of the opposite sex while dating?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-02-03', 'Is a degree still worth it?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-02-04', 'Have you ever been ghosted?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-02-05', 'Is it okay to outgrow friends?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-02-06', 'Would you rather visit the past or the future?', '[{"id": "a", "label": "The past"}, {"id": "b", "label": "The future"}]'::jsonb, 'light'),
  ('2027-02-07', 'Should couples post each other online?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-02-08', 'Do you believe in love at first sight?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-02-09', 'Would you take back an ex?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-02-10', 'Have you ever ghosted someone?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-02-11', 'Do you think you''re hard to love?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-02-12', 'Who should pay for the wedding?', '[{"id": "a", "label": "The bride''s family"}, {"id": "b", "label": "The groom''s family"}, {"id": "c", "label": "Both families"}, {"id": "d", "label": "The couple"}]'::jsonb, 'society'),
  ('2027-02-13', 'Do you nap every weekend?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-02-14', 'Is money important in a relationship?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-02-15', 'Would you date someone your best friend used to like?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-02-16', 'Have you ever been your own worst enemy?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-02-17', 'Would you rather have more money or more time?', '[{"id": "a", "label": "More money"}, {"id": "b", "label": "More time"}]'::jsonb, 'light'),
  ('2027-02-18', 'Would you date someone 10 years older?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-02-19', 'Is therapy for everyone?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-02-20', 'Do you like surprise parties?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-02-21', 'Would you date someone 10 years younger?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-02-22', 'Is confidence more attractive than looks?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-02-23', 'Do friends deserve second chances?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-02-24', 'Would you rather be famous or rich?', '[{"id": "a", "label": "Famous"}, {"id": "b", "label": "Rich"}]'::jsonb, 'light'),
  ('2027-02-25', 'Should couples go to therapy?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-02-26', 'Should women keep their own surname?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-02-27', 'Do you read your horoscope?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-02-28', 'Should big purchases need your partner''s okay?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-03-01', 'Would you shoot your shot at a wedding?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-03-02', 'Are you afraid of being alone?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-03-03', 'Tea or coffee?', '[{"id": "a", "label": "Tea"}, {"id": "b", "label": "Coffee"}]'::jsonb, 'light'),
  ('2027-03-04', 'Would you relocate for your partner''s job?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-03-05', 'Are talking stages a waste of time?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-03-06', 'Do you talk to anyone about your feelings?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-03-07', 'Would you raise your kids the way you were raised?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-03-08', 'Would you go skydiving?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-03-09', 'Is it okay to keep secrets from your partner?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-03-10', 'Do you send voice notes longer than a minute?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-03-11', 'Would you date a coworker?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-03-12', 'Would you kiss on the first date?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-03-13', 'Have you ever regretted saying no?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-03-14', 'Would you rather give up social media or TV forever?', '[{"id": "a", "label": "Social media"}, {"id": "b", "label": "TV"}]'::jsonb, 'light'),
  ('2027-03-15', 'After marriage, should both partners work?', '[{"id": "a", "label": "Both work"}, {"id": "b", "label": "One can stay home"}, {"id": "c", "label": "We''d decide together"}]'::jsonb, 'real'),
  ('2027-03-16', 'Should children have phones before 13?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-03-17', 'Are you the friend who plans everything?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-03-18', 'Do you believe in second chances?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-03-19', 'Is it okay to slide into someone''s DMs?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-03-20', 'Would you rather have peace or passion?', '[{"id": "a", "label": "Peace"}, {"id": "b", "label": "Passion"}]'::jsonb, 'deep'),
  ('2027-03-21', 'Do you keep receipts?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-03-22', 'Would you date someone who doesn''t want kids?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-03-23', 'Is hustle culture healthy?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-03-24', 'Have you ever had a secret relationship?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-03-25', 'Do you feel you have to be strong all the time?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-03-26', 'Would you rather have a rewind button or a pause button for life?', '[{"id": "a", "label": "Rewind"}, {"id": "b", "label": "Pause"}]'::jsonb, 'light'),
  ('2027-03-27', 'Is it okay for your partner to have a celebrity crush?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-03-28', 'Do you eat the same breakfast every day?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-03-29', 'Should chores be split 50/50?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-03-30', 'Would you date someone with a lot of followers?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-03-31', 'Have you ever pretended to be happy for someone?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-04-01', 'Should couples live with their in-laws?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-04-02', 'Is it okay to wear socks with sandals?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-04-03', 'Would you marry for money?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-04-04', 'Would you rather be the funniest or the smartest in the room?', '[{"id": "a", "label": "Funniest"}, {"id": "b", "label": "Smartest"}]'::jsonb, 'light'),
  ('2027-04-05', 'Is it a red flag if they''re still close to their ex''s family?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-04-06', 'Romantic first date or fun first date?', '[{"id": "a", "label": "Romantic"}, {"id": "b", "label": "Fun"}]'::jsonb, 'spicy'),
  ('2027-04-07', 'Do you still believe in your childhood dream?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-04-08', 'Would you date someone with very different politics?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-04-09', 'Do you cry at movies?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-04-10', 'Would you tell your partner about every past relationship?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-04-11', 'Have you ever lied about your age online?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-04-12', 'Would you tell your younger self the truth?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-04-13', 'Do you fall asleep with the TV on?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-04-14', 'Is it okay to say "I love you" in the first month?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-04-15', 'Would you rather travel alone or with friends?', '[{"id": "a", "label": "Alone"}, {"id": "b", "label": "With friends"}]'::jsonb, 'light'),
  ('2027-04-16', 'Should couples have a date night every week?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-04-17', 'Is it okay to not want children?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-04-18', 'Would you date someone who cheated in their last relationship?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-04-19', 'Do you love yourself?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-04-20', 'Are you good with directions?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-04-21', 'Would you date someone who still lives with their parents?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-04-22', 'Do you laugh at your own jokes?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-04-23', 'Would you share your location with your partner?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-04-24', 'Is it okay to look at other people when you''re taken?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-04-25', 'Have you been proud of yourself this year?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-04-26', 'Should bride price stay?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}, {"id": "c", "label": "Keep it small"}]'::jsonb, 'society'),
  ('2027-04-27', 'Would you rather go to a party or stay in?', '[{"id": "a", "label": "Party"}, {"id": "b", "label": "Stay in"}]'::jsonb, 'light'),
  ('2027-04-28', 'Would you lend money to your partner?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-04-29', 'Do you fall in love fast?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-04-30', 'Do your parents understand you?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-05-01', 'Do you send more stickers than words?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-05-02', 'Should you take your partner''s surname?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}, {"id": "c", "label": "Join both names"}]'::jsonb, 'real'),
  ('2027-05-03', 'Is cancel culture fair?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-05-04', 'Would you rather have a big wedding or a small one?', '[{"id": "a", "label": "Big"}, {"id": "b", "label": "Small"}]'::jsonb, 'light'),
  ('2027-05-05', 'Would you date someone with a lot of debt?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-05-06', 'Have you ever said "I love you" first?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-05-07', 'Is it better to have loved and lost?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-05-08', 'Do you finish books you don''t like?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-05-09', 'Is it okay to ghost after one date?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-05-10', 'Where should your giving go?', '[{"id": "a", "label": "Tithe"}, {"id": "b", "label": "Charity"}, {"id": "c", "label": "Family"}, {"id": "d", "label": "Neither"}]'::jsonb, 'society'),
  ('2027-05-11', 'Would you rather fly or read minds?', '[{"id": "a", "label": "Fly"}, {"id": "b", "label": "Read minds"}]'::jsonb, 'light'),
  ('2027-05-12', 'Should your partner be your best friend?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-05-13', 'Would you date someone more experienced than you?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-05-14', 'Do you overthink most things?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-05-15', 'Do you save your best clothes for special days?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-05-16', 'Would you date someone your friends don''t like?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-05-17', 'Do looks matter more than people admit?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-05-18', 'Have you ever let someone go for their own good?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-05-19', 'Would you protest for something you believe in?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-05-20', 'Is it okay to eat in bed?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-05-21', 'Is snooping ever okay?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-05-22', 'Would you rather spend a weekend in a mansion or a treehouse?', '[{"id": "a", "label": "Mansion"}, {"id": "b", "label": "Treehouse"}]'::jsonb, 'light'),
  ('2027-05-23', 'Should couples share social media passwords?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-05-24', 'Would you rather get a love letter or a surprise visit?', '[{"id": "a", "label": "Love letter"}, {"id": "b", "label": "Surprise visit"}]'::jsonb, 'spicy'),
  ('2027-05-25', 'Do you feel seen by the people around you?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-05-26', 'Do you talk to yourself?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-05-27', 'Would you date someone who isn''t affectionate in public?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-05-28', 'Should stay-at-home parents be paid?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-05-29', 'Do you trust online reviews?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-05-30', 'Is love enough?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-05-31', 'Is it okay to unmatch in the middle of a chat?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-06-01', 'Would you rather know the truth even if it hurts?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-06-02', 'Hot weather or cold weather?', '[{"id": "a", "label": "Hot"}, {"id": "b", "label": "Cold"}]'::jsonb, 'light'),
  ('2027-06-03', 'Should the person who earns more pay more?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-06-04', 'Is it okay for a woman to earn more than her husband?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-06-05', 'Have you ever liked two people at the same time?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-06-06', 'Do you find it easy to apologise?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-06-07', 'Do you remember your dreams?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-06-08', 'Would you date a single parent?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-06-09', 'Would you rather always be 10 minutes late or 20 minutes early?', '[{"id": "a", "label": "Late"}, {"id": "b", "label": "Early"}]'::jsonb, 'light'),
  ('2027-06-10', 'Is it okay to argue in front of friends?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-06-11', 'Would you date someone who still talks to their ex every day?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-06-12', 'Have you made someone smile today?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-06-13', 'Should boys and girls be raised the same way?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-06-14', 'Do you have a secret talent?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-06-15', 'Would you move to your partner''s hometown?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-06-16', 'Would you rather have your own chef or your own driver?', '[{"id": "a", "label": "A chef"}, {"id": "b", "label": "A driver"}]'::jsonb, 'light'),
  ('2027-06-17', 'Is it cheating to text an ex late at night?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-06-18', 'Is a little jealousy attractive?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-06-19', 'Is kindness a weakness?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-06-20', 'Is marriage still necessary?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-06-21', 'Is pizza better the next day?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-06-22', 'Would you date someone from a different country?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-06-23', 'Would you go on a date just for the free food?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-06-24', 'Would you date yourself?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-06-25', 'Do you snooze your alarm?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-06-26', 'Should family opinions matter in who you marry?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-06-27', 'Would you rather live without music or without movies?', '[{"id": "a", "label": "No music"}, {"id": "b", "label": "No movies"}]'::jsonb, 'light'),
  ('2027-06-28', 'Should couples take separate holidays sometimes?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-06-29', 'Is it okay to live together before marriage?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-06-30', 'Have you ever pretended to like something to impress a crush?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-07-01', 'Do you miss someone right now?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-07-02', 'Do you rewatch the same shows?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-07-03', 'Would you date someone who parties every weekend?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-07-04', 'Would you rather go camping or stay in a hotel?', '[{"id": "a", "label": "Camping"}, {"id": "b", "label": "Hotel"}]'::jsonb, 'light'),
  ('2027-07-05', 'Is it okay to break up over text?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-07-06', 'Do you send good morning texts?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-07-07', 'Have you ever said goodbye without saying it?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-07-08', 'Should you date someone of a different faith?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-07-09', 'Do you still have your childhood teddy?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-07-10', 'Would you date someone with tattoos?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-07-11', 'Mysterious or an open book?', '[{"id": "a", "label": "Mysterious"}, {"id": "b", "label": "Open book"}]'::jsonb, 'spicy'),
  ('2027-07-12', 'Can money buy happiness?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-07-13', 'Would you rather be a kid again for a day or 10 years older?', '[{"id": "a", "label": "A kid again"}, {"id": "b", "label": "10 years older"}]'::jsonb, 'light'),
  ('2027-07-14', 'Should you be friends with your partner''s friends?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-07-15', 'Would you work a job you hate for good pay?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-07-16', 'Do you leave messages on read on purpose?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-07-17', 'Would you live with your in-laws?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-07-18', 'Can a voice be more attractive than a face?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-07-19', 'Would you choose a calm life or an exciting one?', '[{"id": "a", "label": "Calm"}, {"id": "b", "label": "Exciting"}]'::jsonb, 'deep'),
  ('2027-07-20', 'Would you rather win the lottery or find true love?', '[{"id": "a", "label": "The lottery"}, {"id": "b", "label": "True love"}]'::jsonb, 'light'),
  ('2027-07-21', 'Is age just a number?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-07-22', 'Is working from home better?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-07-23', 'Are you a good cook?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-07-24', 'Would you date someone who is very religious?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-07-25', 'Would you unmask first?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-07-26', 'Do you keep the promises you make to yourself?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-07-27', 'Would you rather have a house by the beach or in the mountains?', '[{"id": "a", "label": "Beach"}, {"id": "b", "label": "Mountains"}]'::jsonb, 'light'),
  ('2027-07-28', 'Should couples tell each other everything?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-07-29', 'Have you kept talking to someone just because you were bored?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-07-30', 'Have you ever changed for someone?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-07-31', 'Is sports betting a problem in your circle?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-08-01', 'Do you dress up just to stay home?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-08-02', 'Would you date someone who is always on their phone?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-08-03', 'Do you believe in ghosts?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-08-04', 'Do you believe in marriage?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-08-05', 'Do you still think about your ex?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-08-06', 'Do you believe in fate?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-08-07', 'Would you rather give up chocolate or ice cream?', '[{"id": "a", "label": "Chocolate"}, {"id": "b", "label": "Ice cream"}]'::jsonb, 'light'),
  ('2027-08-08', 'Would you date someone who has been married before?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-08-09', 'Does your generation have it harder?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-08-10', 'Do you like hearing your own voice on recordings?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-08-11', 'Is it okay to need alone time in a relationship?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-08-12', 'Would you date someone who takes hours to text back?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-08-13', 'Are you scared of failing?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-08-14', 'Would you rather have a small home close to everything or a big one far away?', '[{"id": "a", "label": "Small and close"}, {"id": "b", "label": "Big and far"}]'::jsonb, 'light'),
  ('2027-08-15', 'Should couples budget together?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-08-16', 'Should parents be friends with their kids?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-08-17', 'Have you ever found out you were the side piece?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-08-18', 'Do you think about the future a lot?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-08-19', 'Is it okay to unfollow a friend?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-08-20', 'Would you date someone who doesn''t drink?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-08-21', 'Is your phone always on silent?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-08-22', 'Do opposites attract?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-08-23', 'Would you date a celebrity if you could?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-08-24', 'Have you ever felt like you don''t belong?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-08-25', 'Should children be smacked?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}, {"id": "c", "label": "It depends"}]'::jsonb, 'society'),
  ('2027-08-26', 'Would you rather be an amazing singer or an amazing dancer?', '[{"id": "a", "label": "Singer"}, {"id": "b", "label": "Dancer"}]'::jsonb, 'light'),
  ('2027-08-27', 'Would you give your partner your bank PIN?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-08-28', 'Do you make New Year resolutions?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-08-29', 'Should you split the bill on a first date?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-08-30', 'Is chemistry more important than compatibility?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-08-31', 'Do you hold grudges?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-09-01', 'Would you send your kids to school abroad?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-09-02', 'Would you rather have 10 close friends or 100 casual ones?', '[{"id": "a", "label": "10 close"}, {"id": "b", "label": "100 casual"}]'::jsonb, 'light'),
  ('2027-09-03', 'Would you date someone still figuring out their career?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-09-04', 'Would you move fast if it felt right?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-09-05', 'Is it easier to give love or receive it?', '[{"id": "a", "label": "Give"}, {"id": "b", "label": "Receive"}]'::jsonb, 'deep'),
  ('2027-09-06', 'Do you clap when the plane lands?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-09-07', 'Is being "too nice" a turn off?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-09-08', 'Netflix or YouTube for a night in?', '[{"id": "a", "label": "Netflix"}, {"id": "b", "label": "YouTube"}]'::jsonb, 'light'),
  ('2027-09-09', 'Would you only date within your tribe or culture?', '[{"id": "a", "label": "Only my own"}, {"id": "b", "label": "Anyone"}, {"id": "c", "label": "I don''t mind"}]'::jsonb, 'real'),
  ('2027-09-10', 'Should celebrities speak up on politics?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-09-11', 'Have you ever fallen for someone''s voice note?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-09-12', 'Are people mostly good?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-09-13', 'Do you eat the crust?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-09-14', 'Should couples have a five-year plan?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-09-15', 'Would you rather have free food or free travel forever?', '[{"id": "a", "label": "Free food"}, {"id": "b", "label": "Free travel"}]'::jsonb, 'light'),
  ('2027-09-16', 'Would you forgive a lie meant to protect your feelings?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-09-17', 'Do you like public affection?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-09-18', 'Have you ever had your heart broken?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-09-19', 'Is it okay to be single at 35?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-09-20', 'Do you plan your outfit the night before?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-09-21', 'Is it okay to vent about your partner to friends?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-09-22', 'Would you date someone who''s still "talking" to other people?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-09-23', 'Would you rather leave a legacy or live quietly?', '[{"id": "a", "label": "Leave a legacy"}, {"id": "b", "label": "Live quietly"}]'::jsonb, 'deep'),
  ('2027-09-24', 'Is it okay to go to the cinema alone?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-09-25', 'Would you date someone who wants a big family?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-09-26', 'Should elders always be obeyed?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-09-27', 'Would you rather have a pet parrot or a pet tortoise?', '[{"id": "a", "label": "Parrot"}, {"id": "b", "label": "Tortoise"}]'::jsonb, 'light'),
  ('2027-09-28', 'Do you want a partner who cooks?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-09-29', 'Is it okay to flirt for a free drink?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-09-30', 'Do you feel your age?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-10-01', 'Do you get angry when you''re hungry?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-10-02', 'Would you date someone who spends a lot on clothes?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-10-03', 'Would you let your partner manage your money?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-10-04', 'Would you rather write a book or star in a film?', '[{"id": "a", "label": "Write a book"}, {"id": "b", "label": "Star in a film"}]'::jsonb, 'light'),
  ('2027-10-05', 'Is flirting okay when you''re in a relationship?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-10-06', 'Would you ask for their number first?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-10-07', 'Have you ever chosen yourself over someone else?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-10-08', 'Do you hum while you work?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-10-09', 'Should first dates always be in public?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-10-10', 'Have you ever typed a message to a crush and deleted it?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-10-11', 'Have you already met your soulmate?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-10-12', 'Is having more than one spouse ever okay?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}, {"id": "c", "label": "Not for me, but okay for others"}]'::jsonb, 'society'),
  ('2027-10-13', 'Window seat or aisle seat?', '[{"id": "a", "label": "Window"}, {"id": "b", "label": "Aisle"}]'::jsonb, 'light'),
  ('2027-10-14', 'Would you date someone you met online?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-10-15', 'Do you have a go-to karaoke song?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-10-16', 'Is it a red flag if someone has no close friends?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-10-17', 'Do you have a "type"?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-10-18', 'Do you hide your real self online?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-10-19', 'Would you live in another country for a year?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-10-20', 'Would you date someone who isn''t on social media?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-10-21', 'Should men and women share the bills equally?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-10-22', 'Do you still play video games?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'light'),
  ('2027-10-23', 'Should the woman ever pay on a first date?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-10-24', 'Would you date someone who sends long paragraphs?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-10-25', 'Have you forgiven yourself for the past?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-10-26', 'Would you rather eat out or order in?', '[{"id": "a", "label": "Eat out"}, {"id": "b", "label": "Order in"}]'::jsonb, 'light'),
  ('2027-10-27', 'Would you date someone with a very busy job?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real'),
  ('2027-10-28', 'Is it okay to choose your career over family?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'society'),
  ('2027-10-29', 'Is dating harder than it used to be?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'spicy'),
  ('2027-10-30', 'Are you happy right now?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'deep'),
  ('2027-10-31', 'Which side of the bed is yours?', '[{"id": "a", "label": "Left"}, {"id": "b", "label": "Right"}, {"id": "c", "label": "The middle"}]'::jsonb, 'light'),
  ('2027-11-01', 'Can you love two people at once?', '[{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]'::jsonb, 'real')
on conflict (day) do nothing;
