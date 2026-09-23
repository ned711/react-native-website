import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {buildGameConfig, createGame} from '../../src/game/index.ts';
import {
  asService,
  asUser,
  createTestDb,
  createUser,
  expectError,
  hasDatabase,
  type TestDb,
} from './harness.ts';

/** Creates a finished 2-player match between a and b and applies its results (a wins). */
async function finishedMatch(
  db: TestDb,
  a: string,
  b: string,
  captures = 0
): Promise<string> {
  const matchId = (
    await db.pool.query<{id: string}>(`select gen_random_uuid() as id`)
  ).rows[0]?.id as string;
  const config = buildGameConfig({
    matchId,
    mode: 'online',
    format: '2p',
    endGameMode: 'all_players',
    seats: [
      {playerId: a, displayName: 'A', controller: {kind: 'human'}},
      {playerId: b, displayName: 'B', controller: {kind: 'human'}},
    ],
  });
  const created = createGame(config, {now: 0});
  if (!created.ok) throw new Error();
  const seats = JSON.stringify([
    {color: 'green', user_id: a, kind: 'human'},
    {color: 'blue', user_id: b, kind: 'human'},
  ]);
  await asService(db, q =>
    q(`select public.create_match($1, null, $2, 'online', '2p', $3, $4)`, [
      matchId,
      a,
      created.value.state,
      seats,
    ])
  );
  await db.pool.query(
    `update public.matches set status = 'finished' where id = $1`,
    [matchId]
  );
  const results = JSON.stringify([
    {
      user_id: a,
      color: 'green',
      rank: 1,
      outcome: 'finished',
      xp: 70,
      captures,
      pawns_finished: 4,
    },
    {
      user_id: b,
      color: 'blue',
      rank: 2,
      outcome: 'unfinished',
      xp: 20,
      captures: 0,
      pawns_finished: 1,
    },
  ]);
  await asService(db, q =>
    q(`select public.apply_match_result($1, $2)`, [matchId, results])
  );
  return matchId;
}

const winnerStats = (captures: number) => ({
  wins: 1,
  captures,
  matchesCompleted: 1,
  pawnsSpawned: 4,
  pawnsFinished: 4,
  matchesWithFriend: 0,
  finishedAllPawns: true,
  winWithoutCapture: captures === 0,
});

describe.skipIf(!hasDatabase)('missions and achievements (server-side)', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  }, 60_000);
  afterAll(async () => db?.close());

  it('seeds definitions generated from TypeScript', async () => {
    const m = await db.pool.query(
      `select count(*)::int as n from public.missions`
    );
    const a = await db.pool.query(
      `select count(*)::int as n from public.achievements`
    );
    expect(m.rows[0]?.['n']).toBeGreaterThan(0);
    expect(a.rows[0]?.['n']).toBeGreaterThan(0);
  });

  it('records progress once per match, unlocks achievements and their title', async () => {
    const a = await createUser(db, 'Hero');
    const b = await createUser(db, 'Rival');
    const matchId = await finishedMatch(db, a, b, 0);
    const r1 = await asService(db, q =>
      q<{
        r: {
          applied: boolean;
          missions_claimable: string[];
          achievements_unlocked: string[];
        };
      }>(`select public.record_match_progress($1, $2, $3) as r`, [
        matchId,
        a,
        winnerStats(0),
      ])
    );
    const res = r1.rows[0]?.r;
    expect(res?.applied).toBe(true);
    expect(res?.missions_claimable).toEqual(
      expect.arrayContaining(['daily_complete_1'])
    );
    expect(res?.achievements_unlocked).toEqual(
      expect.arrayContaining(['first_win', 'perfect_finish', 'pacifist'])
    );
    const again = await asService(db, q =>
      q<{r: {applied: boolean}}>(
        `select public.record_match_progress($1, $2, $3) as r`,
        [matchId, a, winnerStats(0)]
      )
    );
    expect(again.rows[0]?.r.applied).toBe(false);

    const titles = await asUser(db, a, q =>
      q(
        `select item_id from public.inventory where unlocked and item_id like 'title_%'`
      )
    );
    expect(titles.rows.map(r => r['item_id'])).toEqual(['title_pacifist']);
    await asUser(db, a, q =>
      q(`select public.equip_item('title', 'title_pacifist')`)
    );
    // XP: 70 (match) + 50 + 50 + 100 (achievements)
    const p = await asUser(db, a, q =>
      q(`select xp::int as xp from public.profiles where id = $1`, [a])
    );
    expect(p.rows[0]?.['xp']).toBe(270);
  });

  it('missions: progress accumulates over the period, claim once, rewards granted by the server', async () => {
    const a = await createUser(db, 'Grinder');
    const b = await createUser(db, 'Sparring');
    const m1 = await finishedMatch(db, a, b, 2);
    await asService(db, q =>
      q(`select public.record_match_progress($1, $2, $3)`, [
        m1,
        a,
        winnerStats(2),
      ])
    );
    let missions = await asUser(db, a, q =>
      q(`select mission_id, progress, completed from public.my_missions()`)
    );
    const win2 = () =>
      missions.rows.find(r => r['mission_id'] === 'daily_win_2');
    expect(win2()).toMatchObject({progress: 1, completed: false});
    await expectError(
      asUser(db, a, q => q(`select public.claim_mission('daily_win_2')`)),
      'MISSION_NOT_COMPLETED'
    );

    const m2 = await finishedMatch(db, a, b, 2);
    await asService(db, q =>
      q(`select public.record_match_progress($1, $2, $3)`, [
        m2,
        a,
        winnerStats(2),
      ])
    );
    missions = await asUser(db, a, q =>
      q(`select mission_id, progress, completed from public.my_missions()`)
    );
    expect(win2()).toMatchObject({progress: 2, completed: true});
    const capture = missions.rows.find(
      r => r['mission_id'] === 'daily_capture_3'
    );
    expect(capture).toMatchObject({progress: 3, completed: true}); // 2 + 2 capped at 3

    const before = await asUser(db, a, q =>
      q(`select xp::int as xp from public.profiles where id = $1`, [a])
    );
    await asUser(db, a, q => q(`select public.claim_mission('daily_win_2')`));
    const after = await asUser(db, a, q =>
      q(`select xp::int as xp from public.profiles where id = $1`, [a])
    );
    expect(Number(after.rows[0]?.['xp']) - Number(before.rows[0]?.['xp'])).toBe(
      60
    );
    await expectError(
      asUser(db, a, q => q(`select public.claim_mission('daily_win_2')`)),
      'ALREADY_CLAIMED'
    );
    await expectError(
      asUser(db, a, q => q(`select public.claim_mission('nope')`)),
      'UNKNOWN_MISSION'
    );
  });

  it('counts gifts sent during the match from the server records only', async () => {
    const a = await createUser(db, 'Giver');
    const b = await createUser(db, 'Taker');
    const matchId = await finishedMatch(db, a, b);
    await db.pool.query(
      `insert into public.gift_events (match_id, sender_id, receiver_id, gift_id) values ($1,$2,$3,'rose'),($1,$2,$3,'heart')`,
      [matchId, a, b]
    );
    await asService(db, q =>
      q(`select public.record_match_progress($1, $2, $3)`, [
        matchId,
        a,
        {...winnerStats(0), giftsSent: 99},
      ])
    );
    const missions = await asUser(db, a, q =>
      q(
        `select progress from public.my_missions() where mission_id = 'daily_gifts_2'`
      )
    );
    expect(missions.rows[0]?.['progress']).toBe(2);
  });

  it('is reserved to the server and validates its input', async () => {
    const a = await createUser(db, 'Forger');
    const b = await createUser(db, 'Other');
    const matchId = await finishedMatch(db, a, b);
    await expectError(
      asUser(db, a, q =>
        q(`select public.record_match_progress($1, $2, $3)`, [
          matchId,
          a,
          winnerStats(0),
        ])
      ),
      'permission denied'
    );
    await expectError(
      asService(db, q =>
        q(`select public.record_match_progress($1, $2, $3)`, [
          matchId,
          a,
          {...winnerStats(0), wins: 500},
        ])
      ),
      'INVALID_STATS'
    );
    const stranger = await createUser(db, 'NotPlaying');
    await expectError(
      asService(db, q =>
        q(`select public.record_match_progress($1, $2, $3)`, [
          matchId,
          stranger,
          winnerStats(0),
        ])
      ),
      'RESULT_NOT_APPLIED'
    );
  });
});
