import {describe, expect, it} from 'vitest';
import {
  runMatchmaking,
  validateTicket,
  type QueueTicket,
} from '../../src/multiplayer/matchmaking/matchmaker.ts';
import {
  backoffDelay,
  DEFAULT_BACKOFF,
  planSync,
  reduceConnection,
  type ConnectionStatus,
} from '../../src/multiplayer/reconnection/connection.ts';
import {
  DEFAULT_ABANDON_POLICIES,
  evaluateTurn,
} from '../../src/multiplayer/reconnection/abandon.ts';
import {createSeededRandom} from '../../src/utils/random.ts';

const t = (
  id: string,
  members: string[],
  format: QueueTicket['format'],
  at: number
): QueueTicket => ({
  ticketId: id,
  memberIds: members,
  format,
  enqueuedAt: at,
});

describe('matchmaking', () => {
  it('B: a party of two finds two opponents and is never split', () => {
    const queue = [
      t('p', ['A', 'B'], '4p', 0),
      t('x', ['X'], '4p', 1),
      t('y', ['Y'], '4p', 2),
    ];
    const {matches, remaining} = runMatchmaking(queue, 10, {
      fillWithAiAfterMs: null,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.humanIds).toEqual(['A', 'B', 'X', 'Y']);
    expect(remaining).toEqual([]);
  });

  it('keeps waiting instead of splitting a party when it does not fit', () => {
    const queue = [
      t('p', ['A', 'B', 'C'], '4p', 0),
      t('q', ['D', 'E'], '4p', 1),
    ];
    const {matches, remaining} = runMatchmaking(queue, 10, {
      fillWithAiAfterMs: null,
    });
    expect(matches).toEqual([]);
    expect(remaining).toHaveLength(2);
  });

  it('D: after the wait threshold, completes with AI seats', () => {
    const queue = [t('p', ['A', 'B'], '4p', 0)];
    expect(
      runMatchmaking(queue, 5_000, {fillWithAiAfterMs: 30_000}).matches
    ).toEqual([]);
    const {matches} = runMatchmaking(queue, 31_000, {
      fillWithAiAfterMs: 30_000,
    });
    expect(matches[0]).toMatchObject({humanIds: ['A', 'B'], aiSeats: 2});
  });

  it('2v2: duos stay a team, solos are paired', () => {
    const queue = [
      t('d', ['A', 'B'], '2v2', 0),
      t('s1', ['C'], '2v2', 1),
      t('s2', ['D'], '2v2', 2),
    ];
    const {matches} = runMatchmaking(queue, 10, {fillWithAiAfterMs: null});
    expect(matches[0]?.teams).toEqual([
      ['A', 'B'],
      ['C', 'D'],
    ]);
  });

  it('serves the oldest ticket first and validates tickets', () => {
    const queue = [
      t('new', ['N'], '2p', 5),
      t('old', ['O'], '2p', 1),
      t('mid', ['M'], '2p', 3),
    ];
    const {matches, remaining} = runMatchmaking(queue, 10, {
      fillWithAiAfterMs: null,
    });
    expect(matches[0]?.humanIds).toEqual(['O', 'M']);
    expect(remaining.map(r => r.ticketId)).toEqual(['new']);
    expect(validateTicket(t('bad', ['A', 'A'], '2p', 0))).toBe(
      'duplicate member'
    );
    expect(validateTicket(t('bad', ['A', 'B', 'C'], '2v2', 0))).not.toBeNull();
  });
});

describe('reconnection', () => {
  it('backs off exponentially with a cap, then goes offline', () => {
    const rng = createSeededRandom('b');
    const noJitter = {...DEFAULT_BACKOFF, jitter: 0};
    expect([1, 2, 3, 4, 10].map(a => backoffDelay(a, noJitter, rng))).toEqual([
      500, 1000, 2000, 4000, 15000,
    ]);
    let s: ConnectionStatus = {kind: 'connected', since: 0};
    s = reduceConnection(
      s,
      {type: 'DISCONNECTED', at: 100},
      DEFAULT_BACKOFF,
      rng
    );
    expect(s.kind).toBe('reconnecting');
    for (let i = 0; i < DEFAULT_BACKOFF.maxAttempts; i++)
      s = reduceConnection(
        s,
        {type: 'ATTEMPT_FAILED', at: 200 + i},
        DEFAULT_BACKOFF,
        rng
      );
    expect(s.kind).toBe('offline');
    s = reduceConnection(s, {type: 'CONNECTED', at: 999}, DEFAULT_BACKOFF, rng);
    expect(s).toEqual({kind: 'connected', since: 999});
    expect(
      reduceConnection(
        s,
        {type: 'APP_BACKGROUNDED', at: 1000},
        DEFAULT_BACKOFF,
        rng
      )
    ).toBe(s);
  });

  it('adopts the server snapshot, never a stale one', () => {
    expect(planSync(5, 5, 20)).toEqual({kind: 'up_to_date'});
    expect(planSync(5, 9, 20)).toEqual({
      kind: 'adopt_snapshot',
      animateFromSeq: 20,
    });
    expect(planSync(null, 9, null)).toEqual({
      kind: 'adopt_snapshot',
      animateFromSeq: null,
    });
    expect(planSync(9, 5, 20)).toEqual({kind: 'reject_stale_snapshot'});
  });

  it('does not treat a short network loss as an abandon', () => {
    const p = DEFAULT_ABANDON_POLICIES.online;
    expect(evaluateTurn(p, 0, 5_000, 0)).toBe('on_time');
    expect(evaluateTurn(p, 0, 25_000, 0)).toBe('auto_play');
    expect(evaluateTurn(p, 0, 25_000, 2)).toBe('abandoned');
    expect(evaluateTurn(DEFAULT_ABANDON_POLICIES.local, 0, 1e12, 99)).toBe(
      'on_time'
    );
  });
});
