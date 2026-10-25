-- Dashpad update: the 5-minute job always gets to the notifications (Part 70)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Run update 69 first.
-- Safe to run more than once. It is also included at the end of migrations/0001_dashpad.sql.

-- ---------------------------------------------------------------------------
-- Part 70: A problem pairing one person no longer stops the whole 5-minute job, and
-- new pairs that weren't told yet are told as long as their chat is still going.
-- ---------------------------------------------------------------------------
create or replace function public.run_hourly_pairing_batch(p_budget int default 3000) returns json
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
  gap int := public.setting_int('pair_gap_minutes', 60);
begin
  for r in select id from masquerade_sessions
           where hour_at is not null and status = 'active' and reopened_at is null and ends_at <= now()
           limit 2000 loop
    perform public.finalize_masquerade(r.id);
  end loop;
  begin
    perform public.release_abandoned_pairs(null);
  exception when others then
    raise warning 'releasing pairs failed: %', sqlerrm;
  end;
  if not public.pairing_hour_open(now()) then return json_build_object('made', 0, 'left', 0); end if;
  for r in select p.id from profiles p
           where p.open_to_masquerade and p.last_seen_at > now() - interval '150 seconds'
           order by p.last_seen_at desc
           limit least(greatest(1, p_budget), 500) loop
    continue when not public.live_pair_free(r.id, gap);
    -- One person's problem mustn't stop everyone else (or the notifications after this)
    begin
      if public.try_live_pair(r.id) is not null then n := n + 1; end if;
    exception when others then
      raise warning 'pairing % failed: %', r.id, sqlerrm;
    end;
  end loop;
  return json_build_object('made', n, 'left', 0);
end $$;
revoke execute on function public.run_hourly_pairing_batch(int) from public, anon, authenticated;

create or replace function public.hourly_pairs_to_notify(p_limit int default 100000) returns json
language sql security definer set search_path = public as $$
  with t as (
    update masquerade_sessions set notified_at = now()
    where id in (
      select id from masquerade_sessions
      where hour_at is not null and status = 'active' and notified_at is null and ends_at > now()
      order by started_at
      limit greatest(1, p_limit)
    )
    returning id, user_a, user_b, alias_a, alias_b, ends_at, intent
  )
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from t
$$;
revoke execute on function public.hourly_pairs_to_notify(int) from public, anon, authenticated;
