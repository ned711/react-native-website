-- =============================================================================
-- Social: blocks, friends, notifications, rooms membership helpers are in the
-- next migration. Everything is written through RPCs.
-- =============================================================================

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> receiver_id)
);
create unique index friend_requests_one_pending
  on public.friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
  where status = 'pending';

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'friend_request', 'friend_accepted', 'invitation', 'gift', 'reward', 'chest_ready',
    'mission', 'event', 'item_unlocked'
  )),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
create or replace function private.is_blocked_either(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

create or replace function private.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(a, b) and user_b = greatest(a, b)
  )
$$;

create or replace function private.notify(p_user uuid, p_kind text, p_payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$ insert into public.notifications (user_id, kind, payload) values (p_user, p_kind, p_payload) $$;

-- ---------------------------------------------------------------------------
-- Friends
create or replace function public.send_friend_request(p_username text, p_discriminator text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
  request_id uuid;
begin
  if me is null then raise exception 'UNAUTHENTICATED'; end if;
  select id into target from public.profiles
    where lower(username) = lower(p_username) and discriminator = p_discriminator;
  if target is null then raise exception 'USER_NOT_FOUND'; end if;
  if target = me then raise exception 'CANNOT_FRIEND_SELF'; end if;
  if private.is_blocked_either(me, target) then raise exception 'BLOCKED'; end if;
  if private.are_friends(me, target) then raise exception 'ALREADY_FRIENDS'; end if;
  if exists (
    select 1 from public.friend_requests
    where status = 'pending'
      and least(sender_id, receiver_id) = least(me, target)
      and greatest(sender_id, receiver_id) = greatest(me, target)
  ) then
    raise exception 'REQUEST_ALREADY_PENDING';
  end if;
  perform private.enforce_rate_limit(me, 'friend_request');
  insert into public.friend_requests (sender_id, receiver_id) values (me, target)
    returning id into request_id;
  perform private.notify(target, 'friend_request', jsonb_build_object('request_id', request_id, 'from', me));
  return request_id;
end;
$$;

create or replace function public.respond_friend_request(p_request uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  req public.friend_requests;
begin
  if me is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into req from public.friend_requests where id = p_request for update;
  if req.id is null or req.receiver_id <> me then raise exception 'REQUEST_NOT_FOUND'; end if;
  if req.status <> 'pending' then raise exception 'REQUEST_NOT_PENDING'; end if;
  update public.friend_requests
    set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
    where id = p_request;
  if p_accept then
    if private.is_blocked_either(req.sender_id, me) then raise exception 'BLOCKED'; end if;
    insert into public.friendships (user_a, user_b)
      values (least(req.sender_id, me), greatest(req.sender_id, me))
      on conflict do nothing;
    perform private.notify(req.sender_id, 'friend_accepted', jsonb_build_object('by', me));
  end if;
end;
$$;

create or replace function public.remove_friend(p_friend uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friendships
  where user_a = least(auth.uid(), p_friend) and user_b = greatest(auth.uid(), p_friend)
$$;

create or replace function public.block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_target = me then raise exception 'CANNOT_BLOCK_SELF'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (me, p_target) on conflict do nothing;
  delete from public.friendships where user_a = least(me, p_target) and user_b = greatest(me, p_target);
  update public.friend_requests set status = 'cancelled', responded_at = now()
    where status = 'pending'
      and least(sender_id, receiver_id) = least(me, p_target)
      and greatest(sender_id, receiver_id) = greatest(me, p_target);
end;
$$;

create or replace function public.unblock_user(p_target uuid)
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_target $$;

create or replace function public.mark_notification_read(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$ update public.notifications set read_at = now() where id = p_id and user_id = auth.uid() $$;

-- Friends list with presence (online = seen in the last 2 minutes).
create or replace function public.list_friends()
returns table (user_id uuid, username text, discriminator text, level integer, online boolean, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.discriminator::text, p.level,
         coalesce(p.last_seen_at > now() - interval '2 minutes', false), p.last_seen_at
  from public.friendships f
  join public.profiles p on p.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  where auth.uid() in (f.user_a, f.user_b)
  order by p.username
$$;

-- ---------------------------------------------------------------------------
alter table public.blocks enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.notifications enable row level security;

create policy blocks_read_own on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy friend_requests_read_own on public.friend_requests for select to authenticated
  using (auth.uid() in (sender_id, receiver_id));
create policy friendships_read_own on public.friendships for select to authenticated
  using (auth.uid() in (user_a, user_b));
create policy notifications_read_own on public.notifications for select to authenticated
  using (user_id = auth.uid());

grant select on public.blocks, public.friend_requests, public.friendships, public.notifications to authenticated;
