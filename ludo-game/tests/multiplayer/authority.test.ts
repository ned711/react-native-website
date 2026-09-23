import {describe, expect, it} from 'vitest';
import {
  buildGameConfig,
  createGame,
  type GameState,
} from '../../src/game/index.ts';
import {MatchAuthority} from '../../src/multiplayer/authority/authority.ts';
import {parseClientIntent} from '../../src/multiplayer/authority/intents.ts';
import {MemoryLogger} from '../../src/multiplayer/authority/logger.ts';
import {InMemoryMatchStore} from '../../src/multiplayer/authority/store.ts';
import {createSeededRandom} from '../../src/utils/random.ts';

function setup(mode: 'online' | 'mixed' = 'online') {
  const config = buildGameConfig({
    matchId: 'match_1',
    mode,
    format: '2p',
    endGameMode: 'all_players',
    seats: [
      {playerId: 'user-a', displayName: 'A', controller: {kind: 'human'}},
      {playerId: 'user-b', displayName: 'B', controller: {kind: 'human'}},
    ],
  });
  const created = createGame(config, {now: 0});
  if (!created.ok) throw new Error();
  const store = new InMemoryMatchStore();
  store.put({
    matchId: 'match_1',
    state: created.value.state,
    startedAt: 0,
    turnStartedAt: 0,
    missedTurns: {},
  });
  let now = 1000;
  const logger = new MemoryLogger();
  const authority = new MatchAuthority({
    store,
    dice: createSeededRandom('server-dice'),
    clock: () => now,
    logger,
  });
  return {
    store,
    authority,
    logger,
    advance: (ms: number) => (now += ms),
    state: async () => (await store.load('match_1'))?.state as GameState,
  };
}

describe('intent parsing (untrusted network input)', () => {
  it('accepts well-formed intents and rejects anything else', () => {
    expect(
      parseClientIntent({type: 'ROLL_DICE', matchId: 'm_1', expectedVersion: 0})
        .ok
    ).toBe(true);
    expect(
      parseClientIntent({
        type: 'MOVE_PAWN',
        matchId: 'm_1',
        expectedVersion: 3,
        pawnIndex: 2,
      }).ok
    ).toBe(true);
    for (const bad of [
      null,
      42,
      'x',
      [],
      {type: 'ROLL_DICE'},
      {type: 'ROLL_DICE', matchId: 'm 1', expectedVersion: 0},
      {type: 'ROLL_DICE', matchId: 'm', expectedVersion: -1},
      {type: 'MOVE_PAWN', matchId: 'm', expectedVersion: 0, pawnIndex: 1.5},
      {type: 'SET_STATE', matchId: 'm', state: {}},
      {type: 'ROLL_DICE', matchId: 'm'.repeat(80), expectedVersion: 0},
    ]) {
      expect(parseClientIntent(bad).ok).toBe(false);
    }
  });

  it('ignores a dice value sent by the client', async () => {
    const {authority} = setup();
    const r = await authority.handleIntent(
      {userId: 'user-a'},
      {type: 'ROLL_DICE', matchId: 'match_1', expectedVersion: 0, value: 6}
    );
    if (!r.ok) throw new Error(r.error.message);
    const rolled = r.value.events.find(e => e.type === 'DICE_ROLLED');
    // The value comes from the server source, not from the payload.
    const expected = createSeededRandom('server-dice');
    const first =
      1 +
      (() => {
        for (;;) {
          const v = expected.nextUint32();
          if (v < 0x100000000 - (0x100000000 % 6)) return v % 6;
        }
      })();
    expect(rolled?.type === 'DICE_ROLLED' && rolled.payload.value).toBe(first);
  });
});

describe('server authority validation', () => {
  it('rejects unauthenticated users, strangers and unknown matches', async () => {
    const {authority} = setup();
    const intent = {type: 'ROLL_DICE', matchId: 'match_1', expectedVersion: 0};
    const a = await authority.handleIntent({userId: null}, intent);
    const b = await authority.handleIntent({userId: 'intruder'}, intent);
    const c = await authority.handleIntent(
      {userId: 'user-a'},
      {...intent, matchId: 'nope'}
    );
    expect([a, b, c].map(r => (r.ok ? 'ok' : r.error.code))).toEqual([
      'UNAUTHENTICATED',
      'NOT_A_PARTICIPANT',
      'MATCH_NOT_FOUND',
    ]);
  });

  it('rejects the wrong player', async () => {
    const {authority} = setup();
    const r = await authority.handleIntent(
      {userId: 'user-b'},
      {type: 'ROLL_DICE', matchId: 'match_1', expectedVersion: 0}
    );
    expect(r.ok ? 'ok' : r.error.code).toBe('NOT_YOUR_TURN');
  });

  it('rejects double actions (same version twice) and stale clients', async () => {
    const {authority, state} = setup();
    const intent = {type: 'ROLL_DICE', matchId: 'match_1', expectedVersion: 0};
    const first = await authority.handleIntent({userId: 'user-a'}, intent);
    expect(first.ok).toBe(true);
    const s = await state();
    const second = await authority.handleIntent(
      {
        userId:
          s.players.find(p => p.color === s.currentColor)?.playerId ?? null,
      },
      intent
    );
    expect(second.ok ? 'ok' : second.error.code).toBe('STALE_VERSION');
  });

  it('rejects illegal moves through the engine and keeps the stored state unchanged', async () => {
    const {authority, state, logger} = setup();
    let s = await state();
    // Roll until A can act in awaiting_move, or verify illegal pawn when all in base.
    const roll = await authority.handleIntent(
      {userId: 'user-a'},
      {type: 'ROLL_DICE', matchId: 'match_1', expectedVersion: 0}
    );
    if (!roll.ok) throw new Error();
    s = await state();
    const mover =
      s.players.find(p => p.color === s.currentColor)?.playerId ?? null;
    const before = JSON.stringify(s);
    const illegal = await authority.handleIntent(
      {userId: mover},
      {
        type: 'MOVE_PAWN',
        matchId: 'match_1',
        expectedVersion: s.version,
        pawnIndex: 7,
      }
    );
    expect(illegal.ok).toBe(false);
    if (!illegal.ok) {
      expect(['ILLEGAL_ACTION']).toContain(illegal.error.code);
      expect(['INVALID_PAWN', 'MUST_ROLL_FIRST']).toContain(
        illegal.error.engineCode
      );
    }
    expect(JSON.stringify(await state())).toBe(before);
    expect(logger.entries.some(e => e.message === 'intent_rejected')).toBe(
      true
    );
    // No secret or token in logs.
    expect(JSON.stringify(logger.entries)).not.toMatch(
      /token|secret|password/i
    );
  });

  it('plays a complete online match through intents only', async () => {
    const {authority, state} = setup();
    for (let i = 0; i < 5000; i++) {
      const s = await state();
      if (s.phase.kind === 'finished') break;
      const userId =
        s.players.find(p => p.color === s.currentColor)?.playerId ?? null;
      const intent =
        s.phase.kind === 'awaiting_roll'
          ? {type: 'ROLL_DICE', matchId: 'match_1', expectedVersion: s.version}
          : {
              type: 'MOVE_PAWN',
              matchId: 'match_1',
              expectedVersion: s.version,
              pawnIndex: s.phase.legalMoves[0]?.pawnIndex,
            };
      const r = await authority.handleIntent({userId}, intent);
      if (!r.ok) throw new Error(r.error.code);
    }
    const final = await state();
    expect(final.phase.kind).toBe('finished');
    // Finished match: further intents rejected.
    const late = await authority.handleIntent(
      {userId: 'user-a'},
      {type: 'ROLL_DICE', matchId: 'match_1', expectedVersion: final.version}
    );
    expect(late.ok ? 'ok' : late.error.code).toBe('MATCH_FINISHED');
  });

  it('detects concurrent commits (compare-and-swap)', async () => {
    const {authority, store} = setup();
    const intent = {type: 'ROLL_DICE', matchId: 'match_1', expectedVersion: 0};
    const [a, b] = await Promise.all([
      authority.handleIntent({userId: 'user-a'}, intent),
      authority.handleIntent({userId: 'user-a'}, intent),
    ]);
    const codes = [a, b].map(r => (r.ok ? 'ok' : r.error.code)).sort();
    expect(codes).toEqual(['CONFLICT', 'ok']);
    expect(store.log).toHaveLength(1);
  });
});

describe('turn timeout and anti-abandon', () => {
  it('does nothing before the timeout, auto-plays after, then replaces the seat by an AI', async () => {
    const {authority, state, advance, logger} = setup('online');
    expect((await authority.handleTurnTimeout('match_1')).ok).toBe(true);
    expect((await state()).version).toBe(0);
    let autoPlays = 0;
    for (let i = 0; i < 40; i++) {
      advance(21_000);
      const r = await authority.handleTurnTimeout('match_1');
      if (!r.ok) throw new Error(r.error.message);
      const s = await state();
      if (s.players.some(p => p.controller.kind === 'ai')) break;
      if (r.value) autoPlays++;
    }
    const s = await state();
    expect(autoPlays).toBeGreaterThan(0);
    expect(s.players.some(p => p.controller.kind === 'ai')).toBe(true);
    expect(logger.entries.some(e => e.message === 'seat_abandoned')).toBe(true);
    expect(logger.entries.some(e => e.message === 'turn_auto_played')).toBe(
      true
    );
  });
});

describe('AI seats in online matches', () => {
  it('the server plays AI turns until a human must act', async () => {
    const config = buildGameConfig({
      matchId: 'mixed_1',
      mode: 'mixed',
      format: '4p',
      endGameMode: 'all_players',
      seats: [
        {playerId: 'human-1', displayName: 'H1', controller: {kind: 'human'}},
        {
          playerId: 'ai-1',
          displayName: 'Bot 1',
          controller: {kind: 'ai', difficulty: 'hard'},
        },
        {playerId: 'human-2', displayName: 'H2', controller: {kind: 'human'}},
        {
          playerId: 'ai-2',
          displayName: 'Bot 2',
          controller: {kind: 'ai', difficulty: 'easy'},
        },
      ],
    });
    const created = createGame(config, {now: 0});
    if (!created.ok) throw new Error();
    const store = new InMemoryMatchStore();
    store.put({
      matchId: 'mixed_1',
      state: created.value.state,
      startedAt: 0,
      turnStartedAt: 0,
      missedTurns: {},
    });
    const authority = new MatchAuthority({
      store,
      dice: createSeededRandom('d'),
      clock: () => 0,
      logger: new MemoryLogger(),
    });
    for (let i = 0; i < 3000; i++) {
      const s = (await store.load('mixed_1'))?.state;
      if (!s || s.phase.kind === 'finished') break;
      const current = s.players.find(p => p.color === s.currentColor);
      if (current?.controller.kind === 'ai') {
        const r = await authority.advanceAiSeats('mixed_1');
        if (!r.ok) throw new Error(r.error.message);
        const after = (await store.load('mixed_1'))?.state;
        const next = after?.players.find(p => p.color === after.currentColor);
        expect(
          after?.phase.kind === 'finished' || next?.controller.kind === 'human'
        ).toBe(true);
        continue;
      }
      const intent =
        s.phase.kind === 'awaiting_roll'
          ? {type: 'ROLL_DICE', matchId: 'mixed_1', expectedVersion: s.version}
          : {
              type: 'MOVE_PAWN',
              matchId: 'mixed_1',
              expectedVersion: s.version,
              pawnIndex: s.phase.legalMoves[0]?.pawnIndex,
            };
      const r = await authority.handleIntent(
        {userId: current?.playerId ?? null},
        intent
      );
      if (!r.ok) throw new Error(r.error.code);
    }
    expect((await store.load('mixed_1'))?.state.phase.kind).toBe('finished');
  });

  it('a player whose seat was handed to the AI cannot play it anymore', async () => {
    const {authority, state, advance} = setup('online');
    for (let i = 0; i < 40; i++) {
      advance(21_000);
      await authority.handleTurnTimeout('match_1');
      if ((await state()).players.some(p => p.controller.kind === 'ai')) break;
    }
    const replaced = (await state()).players.find(
      p => p.controller.kind === 'ai'
    );
    if (!replaced) throw new Error('no seat replaced');
    const current = await state();
    const attempt = await authority.handleIntent(
      {userId: replaced.playerId},
      {type: 'ROLL_DICE', matchId: 'match_1', expectedVersion: current.version}
    );
    expect(attempt.ok ? 'ok' : attempt.error.code).toBe(
      'SEAT_CONTROLLED_BY_AI'
    );
    // ...and the server plays it instead.
    const played = await authority.advanceAiSeats('match_1');
    expect(played.ok).toBe(true);
    const after = await state();
    expect(after.version).toBeGreaterThan(current.version);
  });
});
