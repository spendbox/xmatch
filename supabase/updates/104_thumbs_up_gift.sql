-- A Thumbs up gift for 1 Key, first in the list.
-- (At the usual 50% share, the person who gets it receives nothing back: a 1 Key gift rounds down to 0.)
-- Run once in Supabase (SQL Editor → New query → paste → Run).

insert into public.gifts (id, name, emoji, price, sort, retired) values
  ('thumbsup', 'Thumbs up', '👍', 1, 0, false)
on conflict (id) do update set name = excluded.name, emoji = excluded.emoji, price = excluded.price,
  sort = excluded.sort, retired = excluded.retired;
