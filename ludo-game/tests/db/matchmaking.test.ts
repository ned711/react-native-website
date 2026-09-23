import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {buildGameConfig, createGame} from '../../src/game/index.ts';
import {
  runMatchmaking,
  type QueueTicket,
} from '../../src/multiplayer/matchmaking/matchmaker.ts';
import {planSeats} from '../../src/multiplayer/matchmaking/plan.ts';
import {
  asService,
  asUser,
  createTestDb,
  createUser,
  expectError,
  hasDatabase,
  type TestDb,
} from './harness.ts';

describe.skipIf(!hasDatabase)('matchmaking worker (SQL side)', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  }, 60_000);
  afterAll(async () => db?.close());

  async function queue(): Promise<QueueTicket[]> {
    const {rows} = await db.pool.query<{
      id: string;
      member_ids: string[];
      format: QueueTicket['format'];
      created_at: Date;
    }>(
      `select id, member_ids, format, created_at from public.matchmaking_tickets where status = 'waiting'`
    );
    return rows.map(r => ({
      ticketId: r.id,
      memberIds: r.member_ids,
      format: r.format,
      enqueuedAt: r.created_at.getTime(),
    }));
  }

  it('forms a match from waiting tickets exactly once', async () => {
    const a = await createUser(db, 'MmA');
    const b = await createUser(db, 'MmB');
    await asUser(db, a, q => q(`select public.enqueue_matchmaking('2p')`));
    await asUser(db, b, q => q(`select public.enqueue_matchmaking('2p')`));
    const formed = runMatchmaking(await queue(), Date.now(), {
      fillWithAiAfterMs: null,
    }).matches[0];
    if (!formed) throw new Error('no match');
    const seats = planSeats(formed, id => id.slice(0, 6));
    const matchId = (
      await db.pool.query<{id: string}>(`select gen_random_uuid() as id`)
    ).rows[0]?.id as string;
    const config = buildGameConfig({
      matchId,
      mode: 'online',
      format: '2p',
      endGameMode: 'all_players',
      seats: seats.map(s => s.seat),
    });
    const created = createGame(config, {now: 0});
    if (!created.ok) throw new Error();
    const seatJson = JSON.stringify(
      seats.map(s => ({
        color: s.color,
        user_id: s.userId,
        kind: s.userId ? 'human' : 'ai',
      }))
    );
    const ids = formed.tickets.map(t => t.ticketId);
    const form = () =>
      asService(db, q =>
        q<{ok: boolean}>(
          `select public.form_matchmaking_match($1, $2, 'online', '2p', $3, $4) as ok`,
          [ids, matchId, created.value.state, seatJson]
        )
      );
    expect((await form()).rows[0]?.ok).toBe(true);
    // Second worker run: tickets already consumed.
    expect((await form()).rows[0]?.ok).toBe(false);
    const visible = await asUser(db, b, q =>
      q(`select id from public.matches where id = $1`, [matchId])
    );
    expect(visible.rows).toHaveLength(1);
    const tickets = await asUser(db, a, q =>
      q(`select status, match_id from public.matchmaking_tickets`)
    );
    expect(tickets.rows[0]).toMatchObject({
      status: 'matched',
      match_id: matchId,
    });
  });

  it('rejects seats that do not correspond to the tickets, and clients', async () => {
    const a = await createUser(db, 'MmC');
    const intruder = await createUser(db, 'MmX');
    await asUser(db, a, q => q(`select public.enqueue_matchmaking('2p')`));
    const ticket = (await queue()).find(t => t.memberIds.includes(a));
    if (!ticket) throw new Error();
    const seats = JSON.stringify([
      {color: 'green', user_id: a, kind: 'human'},
      {color: 'blue', user_id: intruder, kind: 'human'},
    ]);
    const matchId = (
      await db.pool.query<{id: string}>(`select gen_random_uuid() as id`)
    ).rows[0]?.id;
    await expectError(
      asService(db, q =>
        q(
          `select public.form_matchmaking_match($1, $2, 'online', '2p', '{"version":0}'::jsonb, $3)`,
          [[ticket.ticketId], matchId, seats]
        )
      ),
      'SEATS_DO_NOT_MATCH_TICKETS'
    );
    await expectError(
      asUser(db, a, q =>
        q(
          `select public.form_matchmaking_match($1, $2, 'online', '2p', '{"version":0}'::jsonb, $3)`,
          [[ticket.ticketId], matchId, seats]
        )
      ),
      'permission denied'
    );
  });
});
