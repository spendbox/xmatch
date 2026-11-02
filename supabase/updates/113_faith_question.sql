-- Dashpad update: the Faith question (Part 113)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- In pacts that already exist, the Faith question becomes a normal question (not a dealbreaker),
-- and gets a third answer for people who aren't religious. Answers people already gave are kept.

update public.pact_questions
set kind = 'choose_one',
    weight = 'normal',
    options = options || jsonb_build_array(jsonb_build_object('id', 'c', 'label', 'Not religious', 'image', '/pacts/art/no-faith.svg'))
where title = 'Faith'
  and options @> '[{"label": "A big part of my life"}]'::jsonb
  and not options @> '[{"label": "Not religious"}]'::jsonb
  and not options @> '[{"id": "c"}]'::jsonb;

-- Any other Faith question an admin made stops being a dealbreaker too
update public.pact_questions set weight = 'normal' where title = 'Faith' and weight = 'dealbreaker';
