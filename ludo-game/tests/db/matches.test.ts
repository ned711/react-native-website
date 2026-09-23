import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {
  applyAction,
  buildGameConfig,
  createGame,
  type GameState,
} from '../../src/game/index.ts';
import {
  asService,
  asUser,
  createTestDb,
  createUser,
  expectError,
  hasDatabase,
  type TestDb,
} from './harness.ts';

async function startRoomMatch(
  db: TestDb,
  owner: string,
  guest: string
): Promise<{matchId: string; roomId: string; state: GameState}> {
  const room = await asUser(db, owner, q =>
    q<{room_id: string; code: string}>(`select * from public.create_room('2p')`)
  );
  const roomId = room.rows[0]?.room_id as string;
  await asUser(db, guest, q =>
    q(`select public.join_room($1)`, [room.rows[0]?.code])
  );
  const matchId = (
    await db.pool.query<{id: string}>(`select gen_random_uuid() as id`)
  ).rows[0]?.id as string;
  const config = buildGameConfig({
    matchId,
    mode: 'online',
    format: '2p',
    endGameMode: 'all_players',
    seats: [
      {playerId: owner, displayName: 'Owner', controller: {kind: 'human'}},
      {playerId: guest, displayName: 'Guest', controller: {kind: 'human'}},
    ],
  });
  const created = createGame(config, {now: Date.now()});
  if (!created.ok) throw new Error(created.error.message);
  const seats = [
    {color: 'green', user_id: owner, kind: 'human'},
    {color: 'blue', user_id: guest, kind: 'human'},
  ];
  await asService(db, q =>
    q(`select public.create_match($1, $2, $3, 'online', '2p', $4, $5)`, [
      matchId,
      roomId,
      owner,
      created.value.state,
      JSON.stringify(seats),
    ])
  );
  return {matchId, roomId, state: created.value.state};
}

describe.skipIf(!hasDatabase)(
  'matches (server-authoritative persistence)',
  () => {
    let db: TestDb;
    beforeAll(async () => {
      db = await createTestDb();
    }, 60_000);
    afterAll(async () => db?.close());

    it('rooms: join by code, capacity, lock, owner transfer', async () => {
      const a = await createUser(db, 'RoomA');
      const b = await createUser(db, 'RoomB');
      const c = await createUser(db, 'RoomC');
      const room = await asUser(db, a, q =>
        q<{room_id: string; code: string}>(
          `select * from public.create_room('2p')`
        )
      );
      const {room_id: roomId, code} = room.rows[0] ?? {room_id: '', code: ''};
      await asUser(db, b, q =>
        q(`select public.join_room($1)`, [code.toLowerCase()])
      );
      await expectError(
        asUser(db, c, q => q(`select public.join_room($1)`, [code])),
        'ROOM_FULL'
      );
      await expectError(
        asUser(db, b, q =>
          q(`select public.set_room_locked($1, true)`, [roomId])
        ),
        'NOT_ROOM_OWNER'
      );
      await asUser(db, a, q => q(`select public.leave_room($1)`, [roomId]));
      const owner = await db.pool.query(
        `select owner_id from public.rooms where id = $1`,
        [roomId]
      );
      expect(owner.rows[0]?.['owner_id']).toBe(b);
      await asUser(db, b, q =>
        q(`select public.set_room_locked($1, true)`, [roomId])
      );
      await expectError(
        asUser(db, c, q => q(`select public.join_room($1)`, [code])),
        'ROOM_NOT_OPEN'
      );
      await expectError(
        asUser(db, c, q => q(`select public.join_room('ZZZZZ')`)),
        'ROOM_NOT_FOUND'
      );
    });

    it('only the room owner can start a match, and only via the server', async () => {
      const a = await createUser(db, 'StartA');
      const b = await createUser(db, 'StartB');
      await expectError(
        asUser(db, a, q =>
          q(
            `select public.create_match(gen_random_uuid(), null, $1, 'online', '2p', '{}'::jsonb, '[]'::jsonb)`,
            [a]
          )
        ),
        'permission denied'
      );
      const {matchId, roomId} = await startRoomMatch(db, a, b);
      const room = await db.pool.query(
        `select status, match_id from public.rooms where id = $1`,
        [roomId]
      );
      expect(room.rows[0]).toMatchObject({
        status: 'in_game',
        match_id: matchId,
      });
      const visible = await asUser(db, b, q =>
        q(`select version from public.matches where id = $1`, [matchId])
      );
      expect(visible.rows[0]?.['version']).toBe(0);
    });

    it('commits actions with compare-and-swap and keeps an ordered action log', async () => {
      const a = await createUser(db, 'CasA');
      const b = await createUser(db, 'CasB');
      const {matchId, state} = await startRoomMatch(db, a, b);
      const applied = applyAction(
        state,
        {type: 'ROLL_DICE', color: 'green', value: 3},
        {now: Date.now()}
      );
      if (!applied.ok) throw new Error();
      const commit = (expected: number) =>
        asService(db, q =>
          q<{ok: boolean}>(
            `select public.commit_match_action($1, $2, $3, $4, $5, now(), '{}'::jsonb) as ok`,
            [
              matchId,
              expected,
              applied.value.state,
              {type: 'ROLL_DICE', color: 'green', value: 3},
              JSON.stringify(applied.value.events),
            ]
          )
        );
      expect((await commit(0)).rows[0]?.ok).toBe(true);
      // replaying the same commit (double action): the CAS finds version 1, not 0
      expect((await commit(0)).rows[0]?.ok).toBe(false);
      // a state whose version does not follow the expected one is rejected outright
      await expectError(commit(5), 'VERSION_MISMATCH');
      const log = await asUser(db, a, q =>
        q(`select seq from public.game_events where match_id = $1`, [matchId])
      );
      expect(log.rows.map(r => r['seq'])).toEqual([1]);
      // a client cannot rewrite the state
      await expectError(
        asUser(db, a, q =>
          q(`update public.matches set state = '{}'::jsonb where id = $1`, [
            matchId,
          ])
        ),
        'permission denied'
      );
    });

    it('spectators: friends of players can watch, strangers cannot', async () => {
      const a = await createUser(db, 'PlayerA');
      const b = await createUser(db, 'PlayerB');
      const friend = await createUser(db, 'FanOfA');
      const stranger = await createUser(db, 'Nobody');
      const tag = await db.pool.query<{
        username: string;
        discriminator: string;
      }>(`select username, discriminator from public.profiles where id = $1`, [
        a,
      ]);
      const u = tag.rows[0]?.username;
      const d = tag.rows[0]?.discriminator;
      const req = await asUser(db, friend, q =>
        q<{id: string}>(`select public.send_friend_request($1, $2) as id`, [
          u,
          d,
        ])
      );
      await asUser(db, a, q =>
        q(`select public.respond_friend_request($1, true)`, [req.rows[0]?.id])
      );
      const {matchId} = await startRoomMatch(db, a, b);
      expect(
        (
          await asUser(db, friend, q =>
            q(`select id from public.matches where id = $1`, [matchId])
          )
        ).rows
      ).toHaveLength(1);
      expect(
        (
          await asUser(db, stranger, q =>
            q(`select id from public.matches where id = $1`, [matchId])
          )
        ).rows
      ).toHaveLength(0);
      // spectators may chat and gift, not play (play goes through the authority)
      await asUser(db, friend, q =>
        q(`select public.send_chat_message(null, $1, 'Allez !')`, [matchId])
      );
      await asUser(db, friend, q =>
        q(`select public.send_gift($1, $2, 'rose')`, [matchId, a])
      );
      await expectError(
        asUser(db, stranger, q =>
          q(`select public.send_gift($1, $2, 'rose')`, [matchId, a])
        ),
        'NOT_IN_MATCH'
      );
      await expectError(
        asUser(db, friend, q =>
          q(`select public.send_gift($1, $2, 'tank')`, [matchId, a])
        ),
        'UNKNOWN_GIFT'
      );
      await expectError(
        asUser(db, a, q =>
          q(`select public.send_gift($1, $2, 'rose')`, [matchId, a])
        ),
        'SELF_GIFT'
      );
      const gifts = await asUser(db, a, q =>
        q(`select gift_id from public.gift_events where match_id = $1`, [
          matchId,
        ])
      );
      expect(gifts.rows.map(r => r['gift_id'])).toEqual(['rose']);
    });

    it('applies results once (idempotent), updates XP, stats and ranking', async () => {
      const a = await createUser(db, 'WinnerA');
      const b = await createUser(db, 'LoserB');
      const {matchId, roomId} = await startRoomMatch(db, a, b);
      const results = JSON.stringify([
        {
          user_id: a,
          color: 'green',
          rank: 1,
          outcome: 'finished',
          xp: 130,
          captures: 3,
          pawns_finished: 4,
        },
        {
          user_id: b,
          color: 'blue',
          rank: 2,
          outcome: 'unfinished',
          xp: 45,
          captures: 1,
          pawns_finished: 2,
        },
      ]);
      await expectError(
        asService(db, q =>
          q(`select public.apply_match_result($1, $2)`, [matchId, results])
        ),
        'MATCH_NOT_FINISHED'
      );
      await db.pool.query(
        `update public.matches set status = 'finished' where id = $1`,
        [matchId]
      );
      const first = await asService(db, q =>
        q<{n: number}>(`select public.apply_match_result($1, $2) as n`, [
          matchId,
          results,
        ])
      );
      expect(first.rows[0]?.n).toBe(2);
      const second = await asService(db, q =>
        q<{n: number}>(`select public.apply_match_result($1, $2) as n`, [
          matchId,
          results,
        ])
      );
      expect(second.rows[0]?.n).toBe(0);
      const stats = await asUser(db, a, q =>
        q(
          `select wins, matches_played, captures, score, best_streak from public.player_stats where user_id = $1`,
          [a]
        )
      );
      expect(stats.rows[0]).toMatchObject({
        wins: 1,
        matches_played: 1,
        captures: 3,
        score: 30,
        best_streak: 1,
      });
      const prof = await asUser(db, a, q =>
        q(`select xp::int as xp, level from public.profiles where id = $1`, [a])
      );
      expect(prof.rows[0]).toMatchObject({xp: 130, level: 2});
      const room = await db.pool.query(
        `select status from public.rooms where id = $1`,
        [roomId]
      );
      expect(room.rows[0]?.['status']).toBe('open');

      const intruder = JSON.stringify([
        {
          user_id: a,
          color: 'green',
          rank: 1,
          outcome: 'finished',
          xp: 1,
          captures: 0,
          pawns_finished: 0,
        },
      ]);
      const other = await startRoomMatch(db, b, await createUser(db, 'Third'));
      await db.pool.query(
        `update public.matches set status = 'finished' where id = $1`,
        [other.matchId]
      );
      await expectError(
        asService(db, q =>
          q(`select public.apply_match_result($1, $2)`, [
            other.matchId,
            intruder,
          ])
        ),
        'NOT_A_MATCH_PLAYER'
      );
    });

    it('rankings: world / country / continent and my own rank', async () => {
      const dz = await createUser(db, 'Algiers');
      const fr = await createUser(db, 'Paris');
      await asUser(db, dz, q => q(`select public.set_country('DZ')`));
      await asUser(db, fr, q => q(`select public.set_country('FR')`));
      await db.pool.query(
        `update public.player_stats set score = 500 where user_id = $1`,
        [dz]
      );
      await db.pool.query(
        `update public.player_stats set score = 400 where user_id = $1`,
        [fr]
      );
      const world = await asUser(db, dz, q =>
        q(`select * from public.get_ranking('world', 2)`)
      );
      expect(world.rows.map(r => r['user_id'])).toEqual([dz, fr]);
      const country = await asUser(db, fr, q =>
        q(`select user_id from public.get_ranking('country', 50)`)
      );
      expect(country.rows.map(r => r['user_id'])).toEqual([fr]);
      const continent = await asUser(db, dz, q =>
        q(`select user_id from public.get_ranking('continent', 50)`)
      );
      expect(continent.rows.map(r => r['user_id'])).toEqual([dz]);
      const mine = await asUser(db, fr, q =>
        q(`select rank from public.get_my_rank('world')`)
      );
      expect(Number(mine.rows[0]?.['rank'])).toBe(2);
      const noCountry = await createUser(db, 'Nowhere');
      await expectError(
        asUser(db, noCountry, q =>
          q(`select * from public.get_ranking('country', 10)`)
        ),
        'COUNTRY_NOT_SET'
      );
    });

    it('matchmaking queue: a friend cannot be queued without sharing a room (consent)', async () => {
      const a = await createUser(db, 'PartyA');
      const b = await createUser(db, 'PartyB');
      const tag = await db.pool.query<{
        username: string;
        discriminator: string;
      }>(`select username, discriminator from public.profiles where id = $1`, [
        b,
      ]);
      const req = await asUser(db, a, q =>
        q<{id: string}>(`select public.send_friend_request($1, $2) as id`, [
          tag.rows[0]?.username,
          tag.rows[0]?.discriminator,
        ])
      );
      await asUser(db, b, q =>
        q(`select public.respond_friend_request($1, true)`, [req.rows[0]?.id])
      );
      await expectError(
        asUser(db, a, q =>
          q(`select public.enqueue_matchmaking('4p', array[$1]::uuid[])`, [b])
        ),
        'PARTY_MEMBER_NOT_IN_ROOM'
      );
      const room = await asUser(db, a, q =>
        q<{code: string}>(`select * from public.create_room('4p')`)
      );
      await asUser(db, b, q =>
        q(`select public.join_room($1)`, [room.rows[0]?.code])
      );
      const t = await asUser(db, a, q =>
        q<{id: string}>(
          `select public.enqueue_matchmaking('4p', array[$1]::uuid[]) as id`,
          [b]
        )
      );
      expect(t.rows[0]?.id).toBeTruthy();
    });

    it('matchmaking queue: parties must be friends, no double queueing', async () => {
      const a = await createUser(db, 'QueueA');
      const b = await createUser(db, 'QueueB');
      await expectError(
        asUser(db, a, q =>
          q(`select public.enqueue_matchmaking('4p', array[$1]::uuid[])`, [b])
        ),
        'NOT_FRIENDS'
      );
      await asUser(db, a, q => q(`select public.enqueue_matchmaking('2p')`));
      await expectError(
        asUser(db, a, q => q(`select public.enqueue_matchmaking('4p')`)),
        'ALREADY_QUEUED'
      );
      await asUser(db, a, q => q(`select public.cancel_matchmaking()`));
      await asUser(db, a, q => q(`select public.enqueue_matchmaking('4p')`));
    });
  }
);
