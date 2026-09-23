-- =============================================================================
-- Security fixes found during review.
-- 1. enqueue_matchmaking: a party mate must share a room with the caller
--    (joining a room is consent). Previously any friend could be queued
--    without their agreement.
-- 2. Rate-limit log: purge entries older than one day to keep it bounded.
-- =============================================================================

create or replace function public.enqueue_matchmaking(p_format text, p_party uuid[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  members uuid[];
  mate uuid;
  ticket uuid;
begin
  if me is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_format not in ('2p', '3p', '4p', '2v2') then raise exception 'INVALID_FORMAT'; end if;
  members := array(select distinct unnest(array_append(coalesce(p_party, '{}'), me)));
  if cardinality(members) > private.seats_for(p_format) or (p_format = '2v2' and cardinality(members) > 2) then
    raise exception 'PARTY_TOO_LARGE';
  end if;
  foreach mate in array members loop
    continue when mate = me;
    if not private.are_friends(me, mate) then raise exception 'NOT_FRIENDS'; end if;
    if not exists (
      select 1 from public.room_players a
      join public.room_players b on b.room_id = a.room_id
      join public.rooms r on r.id = a.room_id and r.status in ('open', 'locked')
      where a.user_id = me and b.user_id = mate
    ) then
      raise exception 'PARTY_MEMBER_NOT_IN_ROOM';
    end if;
  end loop;
  if exists (select 1 from public.matchmaking_tickets where status = 'waiting' and member_ids && members) then
    raise exception 'ALREADY_QUEUED';
  end if;
  insert into public.matchmaking_tickets (owner_id, member_ids, format) values (me, members, p_format)
    returning id into ticket;
  return ticket;
end;
$$;

create or replace function private.enforce_rate_limit(p_user uuid, p_action text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  rule jsonb := private.config() -> 'rate_limits' -> p_action;
  recent integer;
begin
  if rule is null then
    raise exception 'UNKNOWN_RATE_LIMIT %', p_action;
  end if;
  delete from private.action_log
    where user_id = p_user and action = p_action and created_at < now() - interval '1 day 1 minute';
  select count(*) into recent from private.action_log
    where user_id = p_user and action = p_action
      and created_at > now() - make_interval(secs => (rule ->> 'window_seconds')::integer);
  if recent >= (rule ->> 'max')::integer then
    raise exception 'RATE_LIMITED' using detail = p_action;
  end if;
  insert into private.action_log (user_id, action) values (p_user, p_action);
end;
$$;

-- CREATE OR REPLACE keeps existing grants; re-state them explicitly.
revoke execute on function public.enqueue_matchmaking(text, uuid[]) from public, anon;
grant execute on function public.enqueue_matchmaking(text, uuid[]) to authenticated;
revoke execute on function private.enforce_rate_limit(uuid, text) from public, anon, authenticated;
