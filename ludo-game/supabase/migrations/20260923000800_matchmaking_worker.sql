-- =============================================================================
-- Matchmaking worker support: atomically consumes waiting tickets and creates
-- the match. Called only by the trusted server (MATCHMAKING_SWEEP).
-- =============================================================================

create or replace function public.form_matchmaking_match(
  p_ticket_ids uuid[], p_match uuid, p_mode text, p_format text, p_state jsonb, p_seats jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  waiting integer;
  humans uuid[];
  seat_humans uuid[];
begin
  -- Lock the tickets; skip if another worker already took one of them.
  select count(*) into waiting from (
    select id from public.matchmaking_tickets
    where id = any (p_ticket_ids) and status = 'waiting' and format = p_format
    for update
  ) t;
  if waiting <> cardinality(p_ticket_ids) then
    return false;
  end if;
  select array_agg(m order by m) into humans
    from public.matchmaking_tickets t, unnest(t.member_ids) m where t.id = any (p_ticket_ids);
  select array_agg((s ->> 'user_id')::uuid order by (s ->> 'user_id')::uuid) into seat_humans
    from jsonb_array_elements(p_seats) s where s ->> 'user_id' is not null;
  if humans is distinct from seat_humans then
    raise exception 'SEATS_DO_NOT_MATCH_TICKETS';
  end if;
  perform public.create_match(p_match, null, null, p_mode, p_format, p_state, p_seats);
  update public.matchmaking_tickets set status = 'matched', match_id = p_match where id = any (p_ticket_ids);
  return true;
end;
$$;

revoke execute on function public.form_matchmaking_match(uuid[], uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.form_matchmaking_match(uuid[], uuid, text, text, jsonb, jsonb) to service_role;
