-- Dashpad update: Admin counts every gift (Part 76)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Gifts sent now include gifts on Feed answers (they were left out), show how many Keys went on gifts,
-- and how many were paid with free Keys (sent by someone who hadn't bought Keys yet).
-- Each member page shows gifts they sent and received.

create or replace function public.admin_overview() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'users', (select count(*) from profiles where display_name is not null),
    'new_users_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'online_now', (select count(*) from profiles where last_seen_at > now() - interval '5 minutes'),
    'masquerades_today', (select count(*) from masquerade_sessions where started_at > now() - interval '24 hours'),
    'unmasks_today', (select count(*) from masquerade_sessions where status = 'matched' and started_at > now() - interval '24 hours'),
    'matches_total', (select count(*) from matches),
    'revenue_30d_kobo', (select coalesce(sum(amount_kobo), 0) from payments where status = 'paid' and paid_at > now() - interval '30 days'),
    'keys_sold_30d', (select coalesce(sum(keys), 0) from payments where status = 'paid' and paid_at > now() - interval '30 days'),
    -- Every gift sent this week: in chats, masked chats and on the Feed, whatever Keys paid for it
    'gifts_7d', (select count(*) from key_transactions where reason in ('gift', 'feed_gift') and amount < 0 and created_at > now() - interval '7 days'),
    'gift_keys_7d', (select coalesce(-sum(amount), 0) from key_transactions where reason in ('gift', 'feed_gift') and amount < 0 and created_at > now() - interval '7 days'),
    -- Sent by someone who hadn't bought Keys yet (so free Keys paid for it)
    'gifts_free_7d', (select count(*) from key_transactions t where t.reason in ('gift', 'feed_gift') and t.amount < 0 and t.created_at > now() - interval '7 days'
      and not exists (select 1 from payments p where p.user_id = t.user_id and p.status = 'paid' and p.paid_at <= t.created_at)),
    'gifts_total', (select count(*) from key_transactions where reason in ('gift', 'feed_gift') and amount < 0),
    'reports_7d', (select count(*) from reports where created_at > now() - interval '7 days'),
    'icebreakers', (select count(*) from icebreakers where event_id is null and active)
  )
$$;

create or replace function public.admin_member(p_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'profile', (select row_to_json(p) from profiles p where p.id = p_id),
    'age', (select public.age_years(birthdate) from profiles where id = p_id),
    'email', (select email from accounts_private where user_id = p_id),
    'terms_accepted_at', (select terms_accepted_at from accounts_private where user_id = p_id),
    'banned_at', (select banned_at from accounts_private where user_id = p_id),
    'ban_reason', (select ban_reason from accounts_private where user_id = p_id),
    'wallet', (select row_to_json(w) from wallets w where w.user_id = p_id),
    'matches', (select count(*) from matches m where p_id in (m.user_a, m.user_b)),
    'masquerades', (select count(*) from masquerade_sessions s where p_id in (s.user_a, s.user_b)),
    'events', (select count(*) from event_attendees e where e.user_id = p_id),
    'reports_against', coalesce((select json_agg(json_build_object('id', r.id, 'reason', r.reason, 'created_at', r.created_at,
        'reporter_id', r.reporter_id, 'reporter_name', rp.display_name) order by r.id desc)
      from reports r left join profiles rp on rp.id = r.reporter_id where r.reported_id = p_id), '[]'::json),
    'reports_made', (select count(*) from reports r where r.reporter_id = p_id),
    'transactions', coalesce((select json_agg(t order by t.id desc) from (
        select id, amount, reason, ref, created_at from key_transactions where user_id = p_id order by id desc limit 30) t), '[]'::json),
    'gifts_sent', (select count(*) from key_transactions where user_id = p_id and reason in ('gift', 'feed_gift') and amount < 0),
    'gifts_received', (select count(*) from key_transactions where user_id = p_id and reason = 'gift_received'),
    'paid_naira', (select coalesce(sum(amount_kobo), 0) / 100 from payments where user_id = p_id and status = 'paid')
  )
$$;

revoke execute on function public.admin_overview() from public, anon, authenticated;
revoke execute on function public.admin_member(uuid) from public, anon, authenticated;
