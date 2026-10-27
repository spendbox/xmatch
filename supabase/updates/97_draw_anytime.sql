-- Dashpad update: come back to a drawing any time (Part 97)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Run update 96 first. A drawing together stays open for 30 days since anyone last drew on it
-- (Keys back if it's never sent). Each person's lines are saved one by one, so two people
-- drawing at different times never overwrite each other.

-- Keys back for drawings nobody has touched for 30 days and never sent
create or replace function public.refund_stale_draws() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  r record;
begin
  for r in select id from draw_sessions where status = 'open' and updated_at < now() - interval '30 days' limit 500 loop
    perform public.refund_draw(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.refund_stale_draws() from public, anon, authenticated;

-- Once an hour is plenty now
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('dashpad-draw-refunds', '17 * * * *', 'select public.refund_stale_draws()');
  end if;
end $$;

-- Add and take back lines (by their id): never replaces the other person's lines
create or replace function public.draw_lines(p_id uuid, p_add jsonb default '[]'::jsonb, p_remove jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d draw_sessions;
  lines jsonb;
begin
  select * into d from draw_sessions where id = p_id and (starter = uid or partner = uid) for update;
  if d.id is null then raise exception 'Drawing not found'; end if;
  if d.status <> 'open' then return coalesce(d.drawing, '{}'::jsonb); end if;
  if jsonb_typeof(p_add) <> 'array' or jsonb_typeof(p_remove) <> 'array' then raise exception 'Bad lines'; end if;
  lines := coalesce(d.drawing -> 'strokes', '[]'::jsonb);
  -- Take back: only lines with those ids
  if jsonb_array_length(p_remove) > 0 then
    select coalesce(jsonb_agg(s), '[]'::jsonb) into lines
    from jsonb_array_elements(lines) s
    where not (s ->> 'id' in (select jsonb_array_elements_text(p_remove)));
  end if;
  -- Add: new ids only, in the order given
  select lines || coalesce(jsonb_agg(a order by ord), '[]'::jsonb) into lines
  from jsonb_array_elements(p_add) with ordinality as x(a, ord)
  where a ->> 'id' is not null
    and not exists (select 1 from jsonb_array_elements(lines) s where s ->> 'id' = a ->> 'id');
  if jsonb_array_length(lines) > 600 then raise exception 'That drawing is full. Send it or take back some lines.'; end if;
  d.drawing := jsonb_build_object('v', 1, 'w', 400, 'h', 300, 'strokes', lines);
  if pg_column_size(d.drawing) > 60000 then raise exception 'That drawing is full. Send it or take back some lines.'; end if;
  update draw_sessions set drawing = d.drawing, updated_at = now() where id = d.id;
  return d.drawing;
end $$;
revoke execute on function public.draw_lines(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.draw_lines(uuid, jsonb, jsonb) to authenticated;
