-- =============================================================================
-- Ludo Royale - foundation: config, countries, profiles, wallets, statistics.
-- Target: Supabase (PostgreSQL 15+). Relies on Supabase's auth schema
-- (auth.users, auth.uid()) and roles (anon, authenticated, service_role).
-- Security model:
--   * RLS enabled on every table; clients never write tables directly.
--   * Writes go through SECURITY DEFINER functions with an empty search_path.
--   * Functions only the trusted server may call are granted to service_role.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;

-- Secure random integer in [0, n): 32 random bits from gen_random_uuid()
-- (CSPRNG in core PostgreSQL 13+), with rejection sampling (no modulo bias).
create or replace function private.random_below(n integer)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v bigint;
  lim bigint;
begin
  if n is null or n <= 0 then
    raise exception 'random_below: invalid bound %', n;
  end if;
  lim := 4294967296 - (4294967296 % n);
  loop
    v := ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint;
    if v < lim then
      return (v % n)::integer;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Economy configuration (single row). Values are defaults to be calibrated.
create table public.economy_config (
  id boolean primary key default true check (id),
  config jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.economy_config (config) values ('{
  "version": 1,
  "level_curve": {"base": 100, "step": 25, "max_level": 100},
  "fragments_per_item": 6,
  "chest_cooldown_seconds": 10800,
  "chest_rolls": 3,
  "fragment_fallback_coins": 20,
  "invitation_ttl_seconds": 120,
  "ranking_points": {"1": 30, "2": 15, "3": 5, "4": 0, "left": -10},
  "rate_limits": {
    "chat": {"max": 5, "window_seconds": 10},
    "invitation": {"max": 5, "window_seconds": 60},
    "friend_request": {"max": 20, "window_seconds": 86400},
    "gift": {"max": 10, "window_seconds": 60}
  }
}'::jsonb);

create or replace function private.config()
returns jsonb
language sql
stable
set search_path = ''
as $$ select config from public.economy_config where id $$;

-- Level from total XP. MUST match src/progression/levels.ts (cross-checked by tests).
create or replace function public.level_for_xp(p_xp bigint)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  c jsonb := private.config() -> 'level_curve';
  base integer := (c ->> 'base')::integer;
  step integer := (c ->> 'step')::integer;
  max_level integer := (c ->> 'max_level')::integer;
  lvl integer := 1;
begin
  -- total(l) = (l-1)*base + step*(l-1)*(l-2)/2
  while lvl < max_level
    and (lvl::bigint * base + step::bigint * lvl * (lvl - 1) / 2) <= greatest(p_xp, 0) loop
    lvl := lvl + 1;
  end loop;
  return lvl;
end;
$$;

-- ---------------------------------------------------------------------------
-- Countries (ISO 3166-1 alpha-2). Partial list; extend as needed.
create table public.countries (
  code char(2) primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  continent text not null check (continent in
    ('africa', 'asia', 'europe', 'north_america', 'south_america', 'oceania'))
);

insert into public.countries (code, name, continent) values
  ('DZ', 'Algeria', 'africa'), ('MA', 'Morocco', 'africa'), ('TN', 'Tunisia', 'africa'),
  ('EG', 'Egypt', 'africa'), ('SN', 'Senegal', 'africa'), ('CI', 'Côte d''Ivoire', 'africa'),
  ('CM', 'Cameroon', 'africa'), ('NG', 'Nigeria', 'africa'), ('GH', 'Ghana', 'africa'),
  ('KE', 'Kenya', 'africa'), ('ZA', 'South Africa', 'africa'), ('ET', 'Ethiopia', 'africa'),
  ('FR', 'France', 'europe'), ('IT', 'Italy', 'europe'), ('RU', 'Russia', 'europe'),
  ('DE', 'Germany', 'europe'), ('ES', 'Spain', 'europe'), ('PT', 'Portugal', 'europe'),
  ('GB', 'United Kingdom', 'europe'), ('BE', 'Belgium', 'europe'), ('CH', 'Switzerland', 'europe'),
  ('NL', 'Netherlands', 'europe'), ('PL', 'Poland', 'europe'), ('UA', 'Ukraine', 'europe'),
  ('TR', 'Türkiye', 'asia'), ('JP', 'Japan', 'asia'), ('CN', 'China', 'asia'),
  ('IN', 'India', 'asia'), ('PK', 'Pakistan', 'asia'), ('BD', 'Bangladesh', 'asia'),
  ('ID', 'Indonesia', 'asia'), ('MY', 'Malaysia', 'asia'), ('PH', 'Philippines', 'asia'),
  ('SA', 'Saudi Arabia', 'asia'), ('AE', 'United Arab Emirates', 'asia'), ('KR', 'South Korea', 'asia'),
  ('VN', 'Vietnam', 'asia'), ('TH', 'Thailand', 'asia'),
  ('US', 'United States', 'north_america'), ('CA', 'Canada', 'north_america'),
  ('MX', 'Mexico', 'north_america'), ('BR', 'Brazil', 'south_america'),
  ('AR', 'Argentina', 'south_america'), ('CO', 'Colombia', 'south_america'),
  ('CL', 'Chile', 'south_america'), ('PE', 'Peru', 'south_america'),
  ('AU', 'Australia', 'oceania'), ('NZ', 'New Zealand', 'oceania');

-- ---------------------------------------------------------------------------
-- Profiles (public information) and wallets (private balances).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null
    check (char_length(username) between 3 and 16 and username !~ '[^[:alnum:]_]'),
  discriminator char(4) not null check (discriminator ~ '^[0-9]{4}$'),
  avatar_id text not null default 'default',
  -- Explicit choice of the player; never derived from geolocation.
  country_code char(2) references public.countries (code),
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level between 1 and 100),
  title_id text,
  equipped_board text not null default 'board_classic',
  equipped_character text not null default 'classic_pawn',
  equipped_dice text not null default 'classic_dice',
  equipped_frame text,
  equipped_victory_effect text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index profiles_tag_key on public.profiles (lower(username), discriminator);

create table public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  coins bigint not null default 0 check (coins >= 0),
  gems bigint not null default 0 check (gems >= 0),
  updated_at timestamptz not null default now()
);

create table public.player_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  matches_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  captures integer not null default 0,
  pawns_finished integer not null default 0,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  abandons integer not null default 0,
  play_time_seconds bigint not null default 0,
  score integer not null default 0 check (score >= 0),
  updated_at timestamptz not null default now()
);
create index player_stats_score_idx on public.player_stats (score desc, user_id);

-- Unique discriminator for a username (retries on collision).
create or replace function private.new_discriminator(p_username text)
returns char(4)
language plpgsql
volatile
set search_path = ''
as $$
declare
  d char(4);
begin
  for i in 1..50 loop
    d := lpad(private.random_below(10000)::text, 4, '0');
    if not exists (
      select 1 from public.profiles where lower(username) = lower(p_username) and discriminator = d
    ) then
      return d;
    end if;
  end loop;
  raise exception 'USERNAME_EXHAUSTED';
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := coalesce(new.raw_user_meta_data ->> 'username', '');
  clean text := left(regexp_replace(wanted, '[^[:alnum:]_]', '', 'g'), 16);
begin
  if char_length(clean) < 3 then
    clean := 'player';
  end if;
  insert into public.profiles (id, username, discriminator)
    values (new.id, clean, private.new_discriminator(clean));
  insert into public.wallets (user_id) values (new.id);
  insert into public.player_stats (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Self-service profile updates (limited fields).
create or replace function public.set_country(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_code is not null and not exists (select 1 from public.countries where code = upper(p_code)) then
    raise exception 'UNKNOWN_COUNTRY';
  end if;
  update public.profiles set country_code = upper(p_code) where id = auth.uid();
end;
$$;

create or replace function public.touch_presence()
returns void
language sql
security definer
set search_path = ''
as $$ update public.profiles set last_seen_at = now() where id = auth.uid() $$;

-- Rate limiting against an action log (server-side, authoritative).
create table private.action_log (
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index action_log_idx on private.action_log (user_id, action, created_at desc);

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
  select count(*) into recent from private.action_log
    where user_id = p_user and action = p_action
      and created_at > now() - make_interval(secs => (rule ->> 'window_seconds')::integer);
  if recent >= (rule ->> 'max')::integer then
    raise exception 'RATE_LIMITED' using detail = p_action;
  end if;
  insert into private.action_log (user_id, action) values (p_user, p_action);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS and privileges.
alter table public.economy_config enable row level security;
alter table public.countries enable row level security;
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.player_stats enable row level security;

create policy economy_config_read on public.economy_config for select to anon, authenticated using (true);
create policy countries_read on public.countries for select to anon, authenticated using (true);
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy wallets_read_own on public.wallets for select to authenticated using (user_id = auth.uid());
create policy stats_read on public.player_stats for select to authenticated using (true);

revoke all on all tables in schema public from anon, authenticated;
grant select on public.economy_config, public.countries to anon, authenticated;
grant select on public.profiles, public.wallets, public.player_stats to authenticated;
