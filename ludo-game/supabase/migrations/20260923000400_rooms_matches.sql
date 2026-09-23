-- =============================================================================
-- Rooms, invitations, matches (server-authoritative), chat, gifts,
-- matchmaking queue and rankings.
-- =============================================================================

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  -- 5 characters, no ambiguous 0/O/1/I. Example: 7K4P9
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  format text not null check (format in ('2p', '3p', '4p', '2v2')),
  end_game_mode text not null default 'all_players'
    check (end_game_mode in ('all_players', 'top_two', 'top_two_final_duel')),
  adventure boolean not null default false,
  status text not null default 'open' check (status in ('open', 'locked', 'in_game', 'closed')),
  match_id uuid,
  created_at timestamptz not null default now()
);

create table public.room_players (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index room_players_user_idx on public.room_players (user_id);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms (id) on delete set null,
  mode text not null check (mode in ('classic', 'local', 'online', 'team', 'mixed')),
  format text not null check (format in ('2p', '3p', '4p', '2v2')),
  status text not null default 'active' check (status in ('active', 'finished', 'aborted')),
  -- Full GameState produced by the pure engine (no secret inside: Ludo has
  -- no hidden information and the dice RNG never leaves the server).
  state jsonb not null,
  version integer not null default 0 check (version >= 0),
  allow_spectators boolean not null default true,
  started_at timestamptz not null default now(),
  turn_started_at timestamptz not null default now(),
  missed_turns jsonb not null default '{}'::jsonb,
  finished_at timestamptz,
  check ((state ->> 'version')::integer = version)
);

alter table public.rooms
  add constraint rooms_match_fk foreign key (match_id) references public.matches (id) on delete set null;

create table public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  color text not null check (color in ('green', 'yellow', 'blue', 'red')),
  user_id uuid references public.profiles (id) on delete set null,
  seat_kind text not null check (seat_kind in ('human', 'ai')),
  primary key (match_id, color),
  check ((seat_kind = 'ai') = (user_id is null))
);
create unique index match_players_user_idx on public.match_players (match_id, user_id) where user_id is not null;

-- One row per applied action; seq = match version after the action.
create table public.game_events (
  match_id uuid not null references public.matches (id) on delete cascade,
  seq integer not null check (seq > 0),
  action jsonb not null,
  events jsonb not null,
  applied_at timestamptz not null default now(),
  primary key (match_id, seq)
);

create table public.game_results (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  color text not null,
  rank integer not null check (rank between 1 and 4),
  outcome text not null check (outcome in ('finished', 'unfinished', 'left')),
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  captures integer not null default 0,
  pawns_finished integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms (id) on delete cascade,
  match_id uuid references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now(),
  check ((room_id is null) <> (match_id is null))
);
create index chat_room_idx on public.chat_messages (room_id, created_at);
create index chat_match_idx on public.chat_messages (match_id, created_at);

create table public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

create table public.gift_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  gift_id text not null,
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (sender_id <> receiver_id)
);
create unique index invitations_one_pending on public.invitations (sender_id, receiver_id, room_id)
  where status = 'pending';

create table public.matchmaking_tickets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  member_ids uuid[] not null,
  format text not null check (format in ('2p', '3p', '4p', '2v2')),
  status text not null default 'waiting' check (status in ('waiting', 'matched', 'cancelled')),
  match_id uuid references public.matches (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Visibility helpers
create or replace function private.is_room_member(p_room uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.room_players where room_id = p_room and user_id = p_user) $$;

create or replace function private.is_match_player(p_match uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.match_players where match_id = p_match and user_id = p_user) $$;

-- Players, members of the match's room, or friends of a seated human (if spectators allowed).
create or replace function private.can_view_match(p_match uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match and (
      private.is_match_player(m.id, p_user)
      or (m.room_id is not null and private.is_room_member(m.room_id, p_user))
      or (m.allow_spectators and exists (
        select 1 from public.match_players mp
        where mp.match_id = m.id and mp.user_id is not null and private.are_friends(mp.user_id, p_user)
      ))
    )
  )
$$;

create or replace function private.seats_for(p_format text)
returns integer
language sql
immutable
set search_path = ''
as $$ select case p_format when '2p' then 2 when '3p' then 3 else 4 end $$;

create or replace function private.new_room_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  for attempt in 1..100 loop
    candidate := '';
    for i in 1..5 loop
      candidate := candidate || substr(alphabet, private.random_below(32) + 1, 1);
    end loop;
    if not exists (select 1 from public.rooms where code = candidate and status <> 'closed') then
      return candidate;
    end if;
  end loop;
  raise exception 'ROOM_CODE_EXHAUSTED';
end;
$$;

-- ---------------------------------------------------------------------------
-- Rooms
create or replace function public.create_room(p_format text, p_end_game_mode text default 'all_players', p_adventure boolean default false)
returns table (room_id uuid, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
  new_code text;
begin
  if me is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_format not in ('2p', '3p', '4p', '2v2') then raise exception 'INVALID_FORMAT'; end if;
  new_code := private.new_room_code();
  insert into public.rooms (code, owner_id, format, end_game_mode, adventure)
    values (new_code, me, p_format, p_end_game_mode, p_adventure)
    returning id into new_id;
  insert into public.room_players (room_id, user_id) values (new_id, me);
  return query select new_id, new_code;
end;
$$;

create or replace function private.join_room_internal(p_room uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  members integer;
begin
  select * into r from public.rooms where id = p_room for update;
  if r.id is null or r.status = 'closed' then raise exception 'ROOM_NOT_FOUND'; end if;
  if private.is_room_member(r.id, p_user) then return; end if;
  if r.status <> 'open' then raise exception 'ROOM_NOT_OPEN'; end if;
  if private.is_blocked_either(r.owner_id, p_user) then raise exception 'BLOCKED'; end if;
  select count(*) into members from public.room_players where room_id = r.id;
  if members >= private.seats_for(r.format) then raise exception 'ROOM_FULL'; end if;
  insert into public.room_players (room_id, user_id) values (r.id, p_user);
end;
$$;

create or replace function public.join_room(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
begin
  if me is null then raise exception 'UNAUTHENTICATED'; end if;
  select id into target from public.rooms where code = upper(p_code) and status <> 'closed';
  if target is null then raise exception 'ROOM_NOT_FOUND'; end if;
  perform private.join_room_internal(target, me);
  return target;
end;
$$;

create or replace function public.leave_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  r public.rooms;
  next_owner uuid;
begin
  if me is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into r from public.rooms where id = p_room for update;
  if r.id is null or not private.is_room_member(p_room, me) then raise exception 'NOT_A_MEMBER'; end if;
  delete from public.room_players where room_id = p_room and user_id = me;
  if r.owner_id = me then
    select user_id into next_owner from public.room_players where room_id = p_room order by joined_at limit 1;
    if next_owner is null then
      update public.rooms set status = 'closed' where id = p_room;
    else
      update public.rooms set owner_id = next_owner where id = p_room;
    end if;
  end if;
end;
$$;

create or replace function public.set_room_locked(p_room uuid, p_locked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room for update;
  if r.id is null or r.owner_id <> auth.uid() then raise exception 'NOT_ROOM_OWNER'; end if;
  if r.status not in ('open', 'locked') then raise exception 'ROOM_NOT_EDITABLE'; end if;
  update public.rooms set status = case when p_locked then 'locked' else 'open' end where id = p_room;
end;
$$;

create or replace function public.kick_from_room(p_room uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.rooms where id = p_room and owner_id = auth.uid()) then
    raise exception 'NOT_ROOM_OWNER';
  end if;
  if p_user = auth.uid() then raise exception 'CANNOT_KICK_SELF'; end if;
  delete from public.room_players where room_id = p_room and user_id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitations
create or replace function public.send_invitation(p_receiver uuid, p_room uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  inv uuid;
  ttl integer := (private.config() ->> 'invitation_ttl_seconds')::integer;
begin
  if me is null then raise exception 'UNAUTHENTICATED'; end if;
  if not private.is_room_member(p_room, me) then raise exception 'NOT_A_MEMBER'; end if;
  if not exists (select 1 from public.rooms where id = p_room and status = 'open') then
    raise exception 'ROOM_NOT_OPEN';
  end if;
  if not private.are_friends(me, p_receiver) then raise exception 'NOT_FRIENDS'; end if;
  if private.is_blocked_either(me, p_receiver) then raise exception 'BLOCKED'; end if;
  update public.invitations set status = 'expired'
    where sender_id = me and receiver_id = p_receiver and room_id = p_room
      and status = 'pending' and expires_at <= now();
  if exists (
    select 1 from public.invitations
    where sender_id = me and receiver_id = p_receiver and room_id = p_room and status = 'pending'
  ) then
    raise exception 'INVITATION_ALREADY_PENDING';
  end if;
  perform private.enforce_rate_limit(me, 'invitation');
  insert into public.invitations (sender_id, receiver_id, room_id, expires_at)
    values (me, p_receiver, p_room, now() + make_interval(secs => ttl))
    returning id into inv;
  perform private.notify(p_receiver, 'invitation', jsonb_build_object('invitation_id', inv, 'from', me, 'room_id', p_room));
  return inv;
end;
$$;

create or replace function public.respond_invitation(p_invitation uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  inv public.invitations;
begin
  if me is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into inv from public.invitations where id = p_invitation for update;
  if inv.id is null or inv.receiver_id <> me then raise exception 'INVITATION_NOT_FOUND'; end if;
  if inv.status <> 'pending' then raise exception 'INVITATION_NOT_PENDING'; end if;
  if inv.expires_at <= now() then
    update public.invitations set status = 'expired' where id = inv.id;
    return null;
  end if;
  if not p_accept then
    update public.invitations set status = 'declined' where id = inv.id;
    return null;
  end if;
  perform private.join_room_internal(inv.room_id, me);
  update public.invitations set status = 'accepted' where id = inv.id;
  return inv.room_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Matches: created and advanced ONLY by the trusted server (service_role).
create or replace function public.create_match(
  p_match uuid, p_room uuid, p_owner uuid, p_mode text, p_format text,
  p_state jsonb, p_seats jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  seat jsonb;
begin
  if p_room is not null then
    select * into r from public.rooms where id = p_room for update;
    if r.id is null or r.owner_id <> p_owner then raise exception 'NOT_ROOM_OWNER'; end if;
    if r.status not in ('open', 'locked') then raise exception 'ROOM_NOT_STARTABLE'; end if;
  end if;
  insert into public.matches (id, room_id, mode, format, state, version)
    values (p_match, p_room, p_mode, p_format, p_state, (p_state ->> 'version')::integer);
  for seat in select * from jsonb_array_elements(p_seats) loop
    if seat ->> 'user_id' is not null and p_room is not null
       and not private.is_room_member(p_room, (seat ->> 'user_id')::uuid) then
      raise exception 'SEAT_NOT_IN_ROOM';
    end if;
    insert into public.match_players (match_id, color, user_id, seat_kind)
      values (p_match, seat ->> 'color', (seat ->> 'user_id')::uuid, seat ->> 'kind');
  end loop;
  if p_room is not null then
    update public.rooms set status = 'in_game', match_id = p_match where id = p_room;
  end if;
end;
$$;

-- Compare-and-swap commit of one engine action.
create or replace function public.commit_match_action(
  p_match uuid, p_expected_version integer, p_state jsonb, p_action jsonb, p_events jsonb,
  p_turn_started_at timestamptz, p_missed_turns jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  finished boolean := (p_state -> 'phase' ->> 'kind') = 'finished';
begin
  if (p_state ->> 'version')::integer <> p_expected_version + 1 then
    raise exception 'VERSION_MISMATCH';
  end if;
  update public.matches set
    state = p_state,
    version = p_expected_version + 1,
    turn_started_at = p_turn_started_at,
    missed_turns = p_missed_turns,
    status = case when finished then 'finished' else status end,
    finished_at = case when finished then now() else finished_at end
  where id = p_match and version = p_expected_version and status = 'active';
  if not found then
    return false;
  end if;
  insert into public.game_events (match_id, seq, action, events)
    values (p_match, p_expected_version + 1, p_action, p_events);
  return true;
end;
$$;

-- Applies the results of a finished match. Idempotent per (match, user).
create or replace function public.apply_match_result(p_match uuid, p_results jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  res jsonb;
  uid uuid;
  applied integer := 0;
  pts jsonb := private.config() -> 'ranking_points';
  delta integer;
  won boolean;
begin
  if not exists (select 1 from public.matches where id = p_match and status = 'finished') then
    raise exception 'MATCH_NOT_FINISHED';
  end if;
  for res in select * from jsonb_array_elements(p_results) loop
    uid := (res ->> 'user_id')::uuid;
    if not private.is_match_player(p_match, uid) then raise exception 'NOT_A_MATCH_PLAYER'; end if;
    insert into public.game_results (match_id, user_id, color, rank, outcome, xp_awarded, captures, pawns_finished)
      values (p_match, uid, res ->> 'color', (res ->> 'rank')::integer, res ->> 'outcome',
              (res ->> 'xp')::integer, (res ->> 'captures')::integer, (res ->> 'pawns_finished')::integer)
      on conflict do nothing;
    if not found then continue; end if;
    applied := applied + 1;
    won := (res ->> 'rank')::integer = 1 and res ->> 'outcome' <> 'left';
    delta := case when res ->> 'outcome' = 'left' then (pts ->> 'left')::integer
                  else coalesce((pts ->> (res ->> 'rank'))::integer, 0) end;
    perform private.add_xp(uid, (res ->> 'xp')::integer);
    update public.player_stats set
      matches_played = matches_played + 1,
      wins = wins + case when won then 1 else 0 end,
      losses = losses + case when won then 0 else 1 end,
      abandons = abandons + case when res ->> 'outcome' = 'left' then 1 else 0 end,
      captures = captures + (res ->> 'captures')::integer,
      pawns_finished = pawns_finished + (res ->> 'pawns_finished')::integer,
      current_streak = case when won then current_streak + 1 else 0 end,
      best_streak = greatest(best_streak, case when won then current_streak + 1 else 0 end),
      score = greatest(0, score + delta),
      updated_at = now()
    where user_id = uid;
  end loop;
  update public.rooms set status = 'open', match_id = null where match_id = p_match;
  return applied;
end;
$$;

-- ---------------------------------------------------------------------------
-- Chat
create or replace function public.send_chat_message(p_room uuid, p_match uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  clean text;
  new_id uuid;
begin
  if me is null then raise exception 'UNAUTHENTICATED'; end if;
  if (p_room is null) = (p_match is null) then raise exception 'INVALID_TARGET'; end if;
  if p_room is not null and not private.is_room_member(p_room, me) then raise exception 'NOT_A_MEMBER'; end if;
  if p_match is not null and not private.can_view_match(p_match, me) then raise exception 'NOT_A_MEMBER'; end if;
  clean := btrim(regexp_replace(regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g'));
  if char_length(clean) = 0 then raise exception 'EMPTY_MESSAGE'; end if;
  if char_length(clean) > 200 then raise exception 'MESSAGE_TOO_LONG'; end if;
  perform private.enforce_rate_limit(me, 'chat');
  insert into public.chat_messages (room_id, match_id, sender_id, body)
    values (p_room, p_match, me, clean) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.report_message(p_message uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg public.chat_messages;
begin
  select * into msg from public.chat_messages where id = p_message;
  if msg.id is null
     or not ((msg.room_id is not null and private.is_room_member(msg.room_id, auth.uid()))
          or (msg.match_id is not null and private.can_view_match(msg.match_id, auth.uid()))) then
    raise exception 'MESSAGE_NOT_FOUND';
  end if;
  insert into public.chat_reports (message_id, reporter_id, reason)
    values (p_message, auth.uid(), left(btrim(p_reason), 200))
    on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gifts (cosmetic only, no gameplay effect)
create or replace function public.send_gift(p_match uuid, p_receiver uuid, p_gift text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from public.items where id = 'gift_' || p_gift and category = 'gift') then
    raise exception 'UNKNOWN_GIFT';
  end if;
  if p_receiver = me then raise exception 'SELF_GIFT'; end if;
  if not private.can_view_match(p_match, me) then raise exception 'NOT_IN_MATCH'; end if;
  if not private.is_match_player(p_match, p_receiver) then raise exception 'RECEIVER_NOT_IN_MATCH'; end if;
  if private.is_blocked_either(me, p_receiver) then raise exception 'BLOCKED'; end if;
  perform private.enforce_rate_limit(me, 'gift');
  insert into public.gift_events (match_id, sender_id, receiver_id, gift_id)
    values (p_match, me, p_receiver, p_gift) returning id into new_id;
  perform private.notify(p_receiver, 'gift', jsonb_build_object('gift_id', p_gift, 'from', me, 'match_id', p_match));
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Matchmaking queue (the matching worker is not implemented yet)
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
    if mate <> me and not private.are_friends(me, mate) then raise exception 'NOT_FRIENDS'; end if;
  end loop;
  if exists (select 1 from public.matchmaking_tickets where status = 'waiting' and member_ids && members) then
    raise exception 'ALREADY_QUEUED';
  end if;
  insert into public.matchmaking_tickets (owner_id, member_ids, format) values (me, members, p_format)
    returning id into ticket;
  return ticket;
end;
$$;

create or replace function public.cancel_matchmaking()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.matchmaking_tickets set status = 'cancelled'
  where status = 'waiting' and auth.uid() = any (member_ids)
$$;

-- ---------------------------------------------------------------------------
-- Rankings (server statistics only)
create or replace function public.get_ranking(p_scope text, p_limit integer default 50)
returns table (rank bigint, user_id uuid, username text, discriminator text, country_code text, level integer, score integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  my_country text;
  my_continent text;
begin
  if p_scope not in ('world', 'continent', 'country') then raise exception 'INVALID_SCOPE'; end if;
  select p.country_code, c.continent into my_country, my_continent
    from public.profiles p left join public.countries c on c.code = p.country_code
    where p.id = auth.uid();
  if p_scope <> 'world' and my_country is null then raise exception 'COUNTRY_NOT_SET'; end if;
  return query
    select row_number() over (order by s.score desc, s.user_id), p.id, p.username, p.discriminator::text,
           p.country_code::text, p.level, s.score
    from public.player_stats s
    join public.profiles p on p.id = s.user_id
    left join public.countries c on c.code = p.country_code
    where p_scope = 'world'
       or (p_scope = 'country' and p.country_code = my_country)
       or (p_scope = 'continent' and c.continent = my_continent)
    order by s.score desc, s.user_id
    limit least(greatest(p_limit, 1), 200);
end;
$$;

create or replace function public.get_my_rank(p_scope text)
returns table (rank bigint, user_id uuid, username text, discriminator text, country_code text, level integer, score integer)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.get_ranking(p_scope, 200000) r where r.user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.game_events enable row level security;
alter table public.game_results enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reports enable row level security;
alter table public.gift_events enable row level security;
alter table public.invitations enable row level security;
alter table public.matchmaking_tickets enable row level security;

create policy rooms_read_members on public.rooms for select to authenticated
  using (private.is_room_member(id, auth.uid()));
create policy room_players_read_members on public.room_players for select to authenticated
  using (private.is_room_member(room_id, auth.uid()));
create policy matches_read_viewers on public.matches for select to authenticated
  using (private.can_view_match(id, auth.uid()));
create policy match_players_read_viewers on public.match_players for select to authenticated
  using (private.can_view_match(match_id, auth.uid()));
create policy game_events_read_viewers on public.game_events for select to authenticated
  using (private.can_view_match(match_id, auth.uid()));
create policy game_results_read on public.game_results for select to authenticated
  using (user_id = auth.uid() or private.can_view_match(match_id, auth.uid()));
create policy chat_read_members on public.chat_messages for select to authenticated
  using (
    ((room_id is not null and private.is_room_member(room_id, auth.uid()))
      or (match_id is not null and private.can_view_match(match_id, auth.uid())))
    and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = sender_id)
  );
create policy gifts_read on public.gift_events for select to authenticated
  using (auth.uid() in (sender_id, receiver_id) or private.can_view_match(match_id, auth.uid()));
create policy invitations_read_own on public.invitations for select to authenticated
  using (auth.uid() in (sender_id, receiver_id));
create policy tickets_read_own on public.matchmaking_tickets for select to authenticated
  using (auth.uid() = any (member_ids));

grant select on public.rooms, public.room_players, public.matches, public.match_players, public.game_events,
  public.game_results, public.chat_messages, public.gift_events, public.invitations,
  public.matchmaking_tickets to authenticated;

-- Realtime (only on Supabase, where the publication exists).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.matches, public.game_events, public.chat_messages, public.gift_events,
      public.room_players, public.invitations, public.notifications;
  end if;
end;
$$;
