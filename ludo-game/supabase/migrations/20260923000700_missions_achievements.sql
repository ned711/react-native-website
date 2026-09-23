-- =============================================================================
-- Server-side progression of missions and achievements.
-- Definitions are generated from TypeScript (next migration). Progress is
-- recorded by the trusted server after each finished match; rewards are
-- granted by the database, never by the client.
-- =============================================================================

create table public.missions (
  id text primary key,
  period text not null check (period in ('daily', 'weekly', 'event')),
  label text not null,
  metric text not null check (metric in
    ('wins', 'captures', 'matchesCompleted', 'pawnsSpawned', 'pawnsFinished', 'giftsSent', 'matchesWithFriend')),
  target integer not null check (target > 0),
  reward jsonb not null
);

create table public.achievements (
  id text primary key,
  label text not null,
  metric text not null check (metric in
    ('matchesCompleted', 'wins', 'captures', 'currentWinStreak', 'bestWinStreak', 'perfectFinishes', 'winsWithoutCapture')),
  target integer not null check (target > 0),
  reward jsonb not null
);

alter table public.player_stats
  add column perfect_finishes integer not null default 0,
  add column wins_without_capture integer not null default 0;

-- Idempotency: a match's progress is applied once per user.
create table private.match_progress_applied (
  match_id uuid not null,
  user_id uuid not null,
  applied_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create or replace function private.period_start(p_period text)
returns date
language sql
stable
set search_path = ''
as $$
  select case p_period
    when 'daily' then (now() at time zone 'utc')::date
    when 'weekly' then date_trunc('week', now() at time zone 'utc')::date
    else date '2000-01-01'
  end
$$;

-- Grants a reward bundle: {xp, coins, fragments:[{itemId,count}], itemIds:[], titleId}.
create or replace function private.grant_reward(p_user uuid, p_reward jsonb, p_source text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  frag jsonb;
  item text;
begin
  if (p_reward ->> 'xp') is not null then
    perform private.add_xp(p_user, (p_reward ->> 'xp')::integer);
  end if;
  if (p_reward ->> 'coins') is not null then
    update public.wallets set coins = coins + (p_reward ->> 'coins')::integer, updated_at = now()
      where user_id = p_user;
  end if;
  for frag in select * from jsonb_array_elements(coalesce(p_reward -> 'fragments', '[]'::jsonb)) loop
    perform private.grant_fragments(p_user, frag ->> 'itemId', (frag ->> 'count')::integer, p_source);
  end loop;
  for item in
    select jsonb_array_elements_text(coalesce(p_reward -> 'itemIds', '[]'::jsonb))
    union all
    select 'title_' || (p_reward ->> 'titleId') where p_reward ? 'titleId'
  loop
    insert into public.inventory (user_id, item_id, fragments, unlocked, source)
      values (p_user, item, (private.config() ->> 'fragments_per_item')::integer, true, p_source)
      on conflict (user_id, item_id) do update
        set unlocked = true, fragments = excluded.fragments, updated_at = now();
  end loop;
  perform private.notify(p_user, 'reward', jsonb_build_object('source', p_source, 'reward', p_reward));
end;
$$;

-- Called by the trusted server after apply_match_result.
-- p_stats: {"wins","captures","matchesCompleted","pawnsSpawned","pawnsFinished",
--           "matchesWithFriend","finishedAllPawns","winWithoutCapture"}
-- Gifts sent during the match are counted here from gift_events.
create or replace function public.record_match_progress(p_match uuid, p_user uuid, p_stats jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.missions;
  a public.achievements;
  s public.player_stats;
  value integer;
  gifts integer;
  claimable_ids text[] := '{}';
  unlocked_ids text[] := '{}';
  key text;
begin
  if not exists (select 1 from public.game_results where match_id = p_match and user_id = p_user) then
    raise exception 'RESULT_NOT_APPLIED';
  end if;
  insert into private.match_progress_applied (match_id, user_id) values (p_match, p_user)
    on conflict do nothing;
  if not found then
    return jsonb_build_object('applied', false);
  end if;
  foreach key in array array['wins', 'captures', 'matchesCompleted', 'pawnsSpawned', 'pawnsFinished', 'matchesWithFriend'] loop
    value := coalesce((p_stats ->> key)::integer, 0);
    if value < 0 or value > 100 then raise exception 'INVALID_STATS %', key; end if;
  end loop;
  select count(*) into gifts from public.gift_events where match_id = p_match and sender_id = p_user;

  -- Missions of the current periods.
  for m in select * from public.missions loop
    value := case m.metric
      when 'giftsSent' then gifts
      else coalesce((p_stats ->> m.metric)::integer, 0)
    end;
    continue when value = 0;
    insert into public.mission_progress (user_id, mission_id, period_start, progress, completed)
      values (p_user, m.id, private.period_start(m.period), least(value, m.target), value >= m.target)
      on conflict (user_id, mission_id, period_start) do update
        set progress = least(public.mission_progress.progress + value, m.target),
            completed = public.mission_progress.completed
              or public.mission_progress.progress + value >= m.target
        where not public.mission_progress.completed;
    if exists (
      select 1 from public.mission_progress
      where user_id = p_user and mission_id = m.id and period_start = private.period_start(m.period)
        and completed and not claimed
    ) then
      claimable_ids := array_append(claimable_ids, m.id);
    end if;
  end loop;

  -- Lifetime statistics used by achievements.
  update public.player_stats set
    perfect_finishes = perfect_finishes + case when (p_stats ->> 'finishedAllPawns')::boolean then 1 else 0 end,
    wins_without_capture = wins_without_capture + case when (p_stats ->> 'winWithoutCapture')::boolean then 1 else 0 end
  where user_id = p_user
  returning * into s;

  for a in select * from public.achievements loop
    value := case a.metric
      when 'matchesCompleted' then s.matches_played - s.abandons
      when 'wins' then s.wins
      when 'captures' then s.captures
      when 'currentWinStreak' then s.current_streak
      when 'bestWinStreak' then s.best_streak
      when 'perfectFinishes' then s.perfect_finishes
      when 'winsWithoutCapture' then s.wins_without_capture
    end;
    if value >= a.target then
      insert into public.user_achievements (user_id, achievement_id) values (p_user, a.id)
        on conflict do nothing;
      if found then
        unlocked_ids := array_append(unlocked_ids, a.id);
        perform private.grant_reward(p_user, a.reward, 'achievement');
      end if;
    end if;
  end loop;

  return jsonb_build_object('applied', true, 'missions_claimable', to_jsonb(claimable_ids), 'achievements_unlocked', to_jsonb(unlocked_ids));
end;
$$;

-- Client RPC: claim the reward of a completed mission of the current period.
create or replace function public.claim_mission(p_mission text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  m public.missions;
  row_ public.mission_progress;
begin
  if me is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into m from public.missions where id = p_mission;
  if m.id is null then raise exception 'UNKNOWN_MISSION'; end if;
  select * into row_ from public.mission_progress
    where user_id = me and mission_id = m.id and period_start = private.period_start(m.period)
    for update;
  if row_.mission_id is null or not row_.completed then raise exception 'MISSION_NOT_COMPLETED'; end if;
  if row_.claimed then raise exception 'ALREADY_CLAIMED'; end if;
  update public.mission_progress set claimed = true
    where user_id = me and mission_id = m.id and period_start = row_.period_start;
  perform private.grant_reward(me, m.reward, 'mission');
  return m.reward;
end;
$$;

-- Current-period missions with the caller's progress.
create or replace function public.my_missions()
returns table (mission_id text, period text, label text, target integer, progress integer, completed boolean, claimed boolean, reward jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.period, m.label, m.target,
         coalesce(p.progress, 0), coalesce(p.completed, false), coalesce(p.claimed, false), m.reward
  from public.missions m
  left join public.mission_progress p
    on p.mission_id = m.id and p.user_id = auth.uid() and p.period_start = private.period_start(m.period)
  order by m.period, m.id
$$;

alter table public.missions enable row level security;
alter table public.achievements enable row level security;
create policy missions_read on public.missions for select to anon, authenticated using (true);
create policy achievements_read on public.achievements for select to anon, authenticated using (true);
grant select on public.missions, public.achievements to anon, authenticated;
grant select, insert, update, delete on public.missions, public.achievements to service_role;

revoke execute on function public.record_match_progress(uuid, uuid, jsonb), public.claim_mission(text),
  public.my_missions() from public, anon, authenticated;
revoke execute on function private.period_start(text), private.grant_reward(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.claim_mission(text), public.my_missions() to authenticated;
grant execute on function public.record_match_progress(uuid, uuid, jsonb) to service_role;
