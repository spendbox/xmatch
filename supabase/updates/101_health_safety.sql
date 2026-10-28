-- Dashpad update: health page and safety tools (Part 101)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- 1. Contact details hidden in chats with strangers: phone and bank account numbers (10+ digits),
--    links and emails are replaced with "[… hidden for safety]" in masked chats, and in any chat
--    during its first 24 hours. Each one is counted (for the health page).
-- 2. Auto-suspend: someone reported by 3 different people within 30 days is suspended until an
--    admin checks (Admin -> Members -> Banned). Change the number with the app setting
--    auto_suspend_reports (0 turns it off). Reported people are already never paired again.
-- 3. Play wait times are kept, and admin_health() gives the numbers for Admin -> Health.

-- ---------- 1. Hide contact details ----------
create table if not exists public.safety_flags (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles on delete cascade,
  kind text not null,
  at timestamptz not null default now()
);
create index if not exists safety_flags_at on public.safety_flags (at);
alter table public.safety_flags enable row level security;

create or replace function public.scrub_contacts(t text) returns text
language sql immutable as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(t,
    '(https?://|www\.)\S+', '[link hidden for safety]', 'gi'),
    '\m(wa\.me|t\.me|bit\.ly|tinyurl\.com|linktr\.ee)/\S*', '[link hidden for safety]', 'gi'),
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email hidden for safety]', 'g'),
    '\+?\d(?:[\s.\-]?\d){9,}', '[number hidden for safety]', 'g')
$$;

create or replace function public.scrub_masked_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  clean text;
begin
  if new.sender_id is null or coalesce(new.kind, 'text') <> 'text' then return new; end if;
  clean := left(public.scrub_contacts(new.body), 1000);
  if clean is distinct from new.body then
    new.body := clean;
    insert into safety_flags (user_id, kind) values (new.sender_id, 'masked');
  end if;
  return new;
end $$;
drop trigger if exists scrub_masked_message on public.masquerade_messages;
create trigger scrub_masked_message before insert on public.masquerade_messages
for each row execute function public.scrub_masked_message();

create or replace function public.scrub_new_chat_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  clean text;
begin
  if new.sender_id is null or coalesce(new.kind, 'text') <> 'text' then return new; end if;
  -- Only while the chat is new: people who've talked for a day can share what they like
  if not exists (select 1 from matches where id = new.match_id and created_at > now() - interval '24 hours') then return new; end if;
  clean := left(public.scrub_contacts(new.body), 2000);
  if clean is distinct from new.body then
    new.body := clean;
    insert into safety_flags (user_id, kind) values (new.sender_id, 'new_chat');
  end if;
  return new;
end $$;
drop trigger if exists scrub_new_chat_message on public.messages;
create trigger scrub_new_chat_message before insert on public.messages
for each row execute function public.scrub_new_chat_message();

-- ---------- 2. Auto-suspend after reports from several people ----------
insert into public.app_settings (key, value) values ('auto_suspend_reports', 3) on conflict (key) do nothing;

create or replace function public.auto_suspend_on_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  limit_n int := public.setting_int('auto_suspend_reports', 3);
  n int;
begin
  if limit_n <= 0 then return new; end if;
  select count(distinct reporter_id) into n from reports
  where reported_id = new.reported_id and created_at > now() - interval '30 days';
  if n >= limit_n then
    update accounts_private
      set banned_at = now(),
          ban_reason = 'Auto-suspended: reported by ' || n || ' different people in 30 days. Check their reports and unban if it was unfair.'
    where user_id = new.reported_id and banned_at is null;
  end if;
  return new;
end $$;
drop trigger if exists auto_suspend_on_report on public.reports;
create trigger auto_suspend_on_report after insert on public.reports
for each row execute function public.auto_suspend_on_report();

-- ---------- 3. Play wait times ----------
create table if not exists public.pair_waits (
  id bigint generated always as identity primary key,
  kind text not null,
  seconds int not null,
  at timestamptz not null default now()
);
create index if not exists pair_waits_at on public.pair_waits (at);
alter table public.pair_waits enable row level security;

create or replace function public.log_play_wait() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.matched_at is not null and (tg_op = 'INSERT' or old.matched_at is null) then
    insert into pair_waits (kind, seconds) values ('play', greatest(0, extract(epoch from new.matched_at - new.joined_at))::int);
  end if;
  return new;
end $$;
drop trigger if exists log_play_wait on public.play_queue;
create trigger log_play_wait after insert or update of matched_at on public.play_queue
for each row execute function public.log_play_wait();

-- ---------- The numbers for Admin -> Health ----------
create or replace function public.admin_health() returns json
language sql stable security definer set search_path = public as $$
  with
  w as (select now() - interval '7 days' as since, now() - interval '14 days' as before),
  ppl as (
    select p.id, p.gender, p.pref_intent, p.created_at, p.last_seen_at,
      (p.display_name is not null and p.birthdate is not null and p.gender is not null and cardinality(p.photos) > 0) as onboarded
    from profiles p join accounts_private a on a.user_id = p.id
    where a.banned_at is null
  )
  select json_build_object(
    'people', (select json_build_object(
      'total', count(*) filter (where onboarded),
      'joined', count(*) filter (where onboarded and created_at > (select since from w)),
      'joined_prev', count(*) filter (where onboarded and created_at between (select before from w) and (select since from w)),
      'active_day', count(*) filter (where last_seen_at > now() - interval '1 day'),
      'active_week', count(*) filter (where last_seen_at > (select since from w))
    ) from ppl),
    -- Came back a week after joining: joined 8–14 days ago, used Dashpad again on day 7 or later
    'retention_week', (select json_build_object('cohort', count(*), 'back', count(*) filter (where last_seen_at >= created_at + interval '7 days'))
      from ppl where onboarded and created_at between now() - interval '14 days' and now() - interval '8 days'),
    'retention_month', (select json_build_object('cohort', count(*), 'back', count(*) filter (where last_seen_at >= created_at + interval '30 days'))
      from ppl where onboarded and created_at between now() - interval '60 days' and now() - interval '31 days'),
    'modes', (select coalesce(json_agg(json_build_object('mode', pref_intent, 'active', n, 'women', wn, 'men', mn, 'other', otn) order by pref_intent), '[]'::json) from (
      select pref_intent, count(*) n, count(*) filter (where gender = 'woman') wn, count(*) filter (where gender = 'man') mn, count(*) filter (where gender = 'other') otn
      from ppl where last_seen_at > (select since from w) group by pref_intent) m),
    'masquerade', (select json_build_object(
      'pairs', count(*) filter (where started_at > (select since from w)),
      'pairs_prev', count(*) filter (where started_at between (select before from w) and (select since from w)),
      'both_unmasked', count(*) filter (where started_at > (select since from w) and status = 'matched'),
      'both_unmasked_prev', count(*) filter (where started_at between (select before from w) and (select since from w) and status = 'matched'),
      'reported', count(*) filter (where started_at > (select since from w) and ended_reason = 'reported')
    ) from masquerade_sessions where started_at > (select before from w)),
    'play', (select json_build_object(
      'games', (select count(*) from games where play and created_at > (select since from w)),
      'games_prev', (select count(*) from games where play and created_at between (select before from w) and (select since from w)),
      'waits', (select count(*) from pair_waits where kind = 'play' and at > (select since from w)),
      'wait_median', (select percentile_cont(0.5) within group (order by seconds) from pair_waits where kind = 'play' and at > (select since from w)),
      'wait_p90', (select percentile_cont(0.9) within group (order by seconds) from pair_waits where kind = 'play' and at > (select since from w)),
      'waiting_now', (select count(*) from play_queue where game_id is null and matched_at is null and seen_at > now() - interval '1 minute')
    )),
    'safety', (select json_build_object(
      'reports', (select count(*) from reports where created_at > (select since from w)),
      'reports_prev', (select count(*) from reports where created_at between (select before from w) and (select since from w)),
      'reported_people', (select count(distinct reported_id) from reports where created_at > (select since from w)),
      'hidden', (select count(*) from safety_flags where at > (select since from w)),
      'hidden_prev', (select count(*) from safety_flags where at between (select before from w) and (select since from w)),
      'auto_limit', public.setting_int('auto_suspend_reports', 3),
      'to_review', (select coalesce(json_agg(json_build_object('id', a.user_id, 'name', p.display_name, 'photo', p.photos[1], 'at', a.banned_at,
          'reports', (select count(*) from reports r where r.reported_id = a.user_id),
          'reasons', (select coalesce(json_agg(r.reason order by r.created_at desc), '[]'::json) from (select reason, created_at from reports r where r.reported_id = a.user_id and r.reason <> '' order by created_at desc limit 3) r)
        ) order by a.banned_at desc), '[]'::json)
        from accounts_private a join profiles p on p.id = a.user_id
        where a.banned_at is not null and a.ban_reason like 'Auto-suspended%'),
      'most_reported', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (
        select r.reported_id as id, p.display_name as name, p.photos[1] as photo, count(*) as n
        from reports r join profiles p on p.id = r.reported_id join accounts_private a on a.user_id = r.reported_id
        where r.created_at > (select since from w) and a.banned_at is null
        group by r.reported_id, p.display_name, p.photos[1] order by count(*) desc limit 5) x)
    )),
    'money', (select json_build_object(
      'buyers', count(distinct user_id) filter (where paid_at > (select since from w)),
      'buyers_prev', count(distinct user_id) filter (where paid_at between (select before from w) and (select since from w)),
      'revenue_kobo', coalesce(sum(amount_kobo) filter (where paid_at > (select since from w)), 0),
      'revenue_prev_kobo', coalesce(sum(amount_kobo) filter (where paid_at between (select before from w) and (select since from w)), 0)
    ) from payments where status = 'paid' and paid_at > (select before from w)),
    'invites', (select json_build_object(
      'joined', count(*) filter (where created_at > (select since from w)),
      'joined_prev', count(*) filter (where created_at between (select before from w) and (select since from w)),
      'inviters', count(distinct inviter) filter (where created_at > (select since from w))
    ) from referrals where created_at > (select before from w))
  )
$$;
revoke execute on function public.admin_health() from public, anon, authenticated;
revoke execute on function public.scrub_masked_message() from public, anon, authenticated;
revoke execute on function public.scrub_new_chat_message() from public, anon, authenticated;
revoke execute on function public.auto_suspend_on_report() from public, anon, authenticated;
revoke execute on function public.log_play_wait() from public, anon, authenticated;
