-- =============================================================================
-- Economy: item catalogue, inventory, fragments, equipment, chests,
-- missions / achievements / seasons storage. Server-authoritative.
-- =============================================================================

create table public.items (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  category text not null check (category in
    ('character', 'dice', 'board', 'frame', 'effect', 'title', 'gift', 'decoration')),
  theme_id text,
  name text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  acquisition text not null check (acquisition in ('default', 'free', 'premium', 'event')),
  -- Prices are not decided yet: NULL means "not purchasable".
  price_currency text check (price_currency in ('coins', 'gems')),
  price_amount integer check (price_amount > 0),
  check ((price_currency is null) = (price_amount is null))
);

create table public.inventory (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.items (id),
  fragments integer not null default 0 check (fragments >= 0),
  unlocked boolean not null default false,
  source text not null default 'chest'
    check (source in ('chest', 'mission', 'achievement', 'level', 'event', 'purchase', 'admin')),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create or replace function private.owns_item(p_user uuid, p_item text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.items where id = p_item and acquisition = 'default')
      or exists (select 1 from public.inventory where user_id = p_user and item_id = p_item and unlocked)
$$;

-- Fragments are bound to one item; N fragments (config) unlock it for good.
create or replace function private.grant_fragments(p_user uuid, p_item text, p_count integer, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  per_item integer := (private.config() ->> 'fragments_per_item')::integer;
  row_ public.inventory;
  newly boolean := false;
  overflow integer := 0;
begin
  if p_count is null or p_count <= 0 then raise exception 'INVALID_FRAGMENT_COUNT'; end if;
  if not exists (select 1 from public.items where id = p_item) then raise exception 'UNKNOWN_ITEM'; end if;
  insert into public.inventory (user_id, item_id, source) values (p_user, p_item, p_source)
    on conflict do nothing;
  select * into row_ from public.inventory where user_id = p_user and item_id = p_item for update;
  if row_.unlocked then
    overflow := p_count;
  elsif row_.fragments + p_count >= per_item then
    overflow := row_.fragments + p_count - per_item;
    update public.inventory set fragments = per_item, unlocked = true, updated_at = now()
      where user_id = p_user and item_id = p_item;
    newly := true;
    perform private.notify(p_user, 'item_unlocked', jsonb_build_object('item_id', p_item));
  else
    update public.inventory set fragments = fragments + p_count, updated_at = now()
      where user_id = p_user and item_id = p_item;
  end if;
  return jsonb_build_object(
    'item_id', p_item,
    'fragments', least(row_.fragments + p_count, per_item),
    'per_item', per_item,
    'newly_unlocked', newly,
    'overflow', overflow
  );
end;
$$;

create or replace function public.equip_item(p_slot text, p_item text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  cat text;
  expected text;
begin
  if me is null then raise exception 'UNAUTHENTICATED'; end if;
  expected := case p_slot
    when 'board' then 'board' when 'character' then 'character' when 'dice' then 'dice'
    when 'frame' then 'frame' when 'title' then 'title' when 'victory_effect' then 'effect'
  end;
  if expected is null then raise exception 'INVALID_SLOT'; end if;
  select category into cat from public.items where id = p_item;
  if cat is null then raise exception 'UNKNOWN_ITEM'; end if;
  if cat <> expected then raise exception 'WRONG_SLOT'; end if;
  if not private.owns_item(me, p_item) then raise exception 'ITEM_NOT_OWNED'; end if;
  update public.profiles set
    equipped_board = case when p_slot = 'board' then p_item else equipped_board end,
    equipped_character = case when p_slot = 'character' then p_item else equipped_character end,
    equipped_dice = case when p_slot = 'dice' then p_item else equipped_dice end,
    equipped_frame = case when p_slot = 'frame' then p_item else equipped_frame end,
    title_id = case when p_slot = 'title' then p_item else title_id end,
    equipped_victory_effect = case when p_slot = 'victory_effect' then p_item else equipped_victory_effect end
  where id = me;
end;
$$;

-- ---------------------------------------------------------------------------
-- Chests (cooldown + rewards drawn on the server only).
create table public.chest_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_claimed_at timestamptz
);

create table public.chest_reward_table (
  id serial primary key,
  reward_type text not null check (reward_type in ('coins', 'xp', 'fragments')),
  amount_min integer not null check (amount_min > 0),
  amount_max integer not null,
  weight integer not null check (weight > 0),
  -- For fragments: rarities of the eligible item pool.
  rarities text[],
  check (amount_max >= amount_min),
  check ((reward_type = 'fragments') = (rarities is not null))
);

-- Default table, to be calibrated by game design.
insert into public.chest_reward_table (reward_type, amount_min, amount_max, weight, rarities) values
  ('coins', 20, 60, 50, null),
  ('coins', 80, 150, 15, null),
  ('xp', 30, 80, 25, null),
  ('fragments', 1, 2, 25, array['common', 'rare']),
  ('fragments', 1, 1, 5, array['epic', 'legendary']);

create table public.chest_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  rewards jsonb not null
);

create or replace function private.add_xp(p_user uuid, p_xp integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
    set xp = xp + greatest(p_xp, 0), level = public.level_for_xp(xp + greatest(p_xp, 0))
  where id = p_user
$$;

create or replace function public.claim_chest()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  cfg jsonb := private.config();
  cooldown interval := make_interval(secs => (cfg ->> 'chest_cooldown_seconds')::integer);
  last_claim timestamptz;
  total_weight integer;
  roll integer;
  entry public.chest_reward_table;
  amount integer;
  rewards jsonb := '[]'::jsonb;
  item text;
  pool_size integer;
  grant_result jsonb;
begin
  if me is null then raise exception 'UNAUTHENTICATED'; end if;
  insert into public.chest_state (user_id) values (me) on conflict do nothing;
  -- Row lock: concurrent claims are serialised, only one can succeed.
  select last_claimed_at into last_claim from public.chest_state where user_id = me for update;
  if last_claim is not null and now() < last_claim + cooldown then
    raise exception 'CHEST_COOLDOWN' using detail = (last_claim + cooldown)::text;
  end if;

  select sum(weight) into total_weight from public.chest_reward_table;
  for i in 1..(cfg ->> 'chest_rolls')::integer loop
    roll := private.random_below(total_weight);
    for entry in select * from public.chest_reward_table order by id loop
      exit when roll < entry.weight;
      roll := roll - entry.weight;
    end loop;
    amount := entry.amount_min + private.random_below(entry.amount_max - entry.amount_min + 1);
    if entry.reward_type = 'coins' then
      update public.wallets set coins = coins + amount, updated_at = now() where user_id = me;
      rewards := rewards || jsonb_build_object('type', 'coins', 'amount', amount);
    elsif entry.reward_type = 'xp' then
      perform private.add_xp(me, amount);
      rewards := rewards || jsonb_build_object('type', 'xp', 'amount', amount);
    else
      select count(*) into pool_size from public.items i
        where i.acquisition = 'free' and i.category in ('character', 'dice', 'board')
          and i.rarity = any (entry.rarities)
          and not private.owns_item(me, i.id);
      if pool_size = 0 then
        amount := (cfg ->> 'fragment_fallback_coins')::integer;
        update public.wallets set coins = coins + amount, updated_at = now() where user_id = me;
        rewards := rewards || jsonb_build_object('type', 'coins', 'amount', amount, 'fallback', true);
      else
        select i.id into item from public.items i
          where i.acquisition = 'free' and i.category in ('character', 'dice', 'board')
            and i.rarity = any (entry.rarities)
            and not private.owns_item(me, i.id)
          order by i.id
          offset private.random_below(pool_size) limit 1;
        grant_result := private.grant_fragments(me, item, amount, 'chest');
        rewards := rewards || jsonb_build_object('type', 'fragments', 'amount', amount, 'item_id', item,
          'fragments', grant_result -> 'fragments', 'unlocked', grant_result -> 'newly_unlocked');
      end if;
    end if;
  end loop;

  update public.chest_state set last_claimed_at = now() where user_id = me;
  insert into public.chest_claims (user_id, rewards) values (me, rewards);
  return jsonb_build_object('rewards', rewards, 'next_available_at', now() + cooldown);
end;
$$;

create or replace function public.chest_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'last_claimed_at', cs.last_claimed_at,
    'next_available_at', coalesce(cs.last_claimed_at, now() - interval '1 second')
      + make_interval(secs => (private.config() ->> 'chest_cooldown_seconds')::integer),
    'server_now', now()
  )
  from (select auth.uid() as uid) me
  left join public.chest_state cs on cs.user_id = me.uid
$$;

-- ---------------------------------------------------------------------------
-- Missions, achievements, seasons, live events (storage; progression updates
-- from match results are TODO server-side).
create table public.mission_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  mission_id text not null,
  period_start date not null,
  progress integer not null default 0 check (progress >= 0),
  completed boolean not null default false,
  claimed boolean not null default false,
  primary key (user_id, mission_id, period_start)
);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.seasons (
  id text primary key,
  name text not null,
  theme_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  config jsonb not null default '{}'::jsonb,
  check (ends_at > starts_at)
);

create table public.live_events (
  id text primary key,
  name text not null,
  theme_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reward_multiplier numeric not null default 1 check (reward_multiplier between 1 and 5),
  config jsonb not null default '{}'::jsonb,
  check (ends_at > starts_at)
);

-- ---------------------------------------------------------------------------
alter table public.items enable row level security;
alter table public.inventory enable row level security;
alter table public.chest_state enable row level security;
alter table public.chest_reward_table enable row level security;
alter table public.chest_claims enable row level security;
alter table public.mission_progress enable row level security;
alter table public.user_achievements enable row level security;
alter table public.seasons enable row level security;
alter table public.live_events enable row level security;

create policy items_read on public.items for select to anon, authenticated using (true);
create policy inventory_read_own on public.inventory for select to authenticated using (user_id = auth.uid());
create policy chest_state_read_own on public.chest_state for select to authenticated using (user_id = auth.uid());
create policy chest_table_read on public.chest_reward_table for select to authenticated using (true);
create policy chest_claims_read_own on public.chest_claims for select to authenticated using (user_id = auth.uid());
create policy missions_read_own on public.mission_progress for select to authenticated using (user_id = auth.uid());
create policy achievements_read_own on public.user_achievements for select to authenticated using (user_id = auth.uid());
create policy seasons_read on public.seasons for select to anon, authenticated using (true);
create policy live_events_read on public.live_events for select to anon, authenticated using (true);

grant select on public.items, public.seasons, public.live_events to anon, authenticated;
grant select on public.inventory, public.chest_state, public.chest_reward_table, public.chest_claims,
  public.mission_progress, public.user_achievements to authenticated;
