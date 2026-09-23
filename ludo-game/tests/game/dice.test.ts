import {webcrypto} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {createEventBus, rollDie, type GameEvent} from '../../src/game/index.ts';
import {
  createCryptoRandom,
  createSeededRandom,
  randomBelow,
  type RandomSource,
} from '../../src/utils/random.ts';

function chiSquare(source: RandomSource, rolls: number): number {
  const counts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < rolls; i++) {
    const v = rollDie(source);
    expect(Number.isInteger(v) && v >= 1 && v <= 6).toBe(true);
    counts[v - 1] = (counts[v - 1] ?? 0) + 1;
  }
  const expected = rolls / 6;
  return counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
}

describe('dice', () => {
  // 5 degrees of freedom: p=0.001 critical value is 20.52.
  it('seeded source is uniform (chi-square)', () => {
    expect(chiSquare(createSeededRandom('dice-test'), 60_000)).toBeLessThan(
      20.52
    );
  });

  it('crypto source is uniform (chi-square)', () => {
    const source = createCryptoRandom(a => webcrypto.getRandomValues(a));
    expect(chiSquare(source, 60_000)).toBeLessThan(20.52);
  });

  it('rejection sampling removes modulo bias', () => {
    // A source that returns the values that would be biased first.
    let calls = 0;
    const biased: RandomSource = {
      nextUint32: () => (calls++ === 0 ? 0xffffffff : 5),
    };
    expect(randomBelow(biased, 6)).toBe(5);
    expect(calls).toBe(2);
  });

  it('seeded sources are reproducible', () => {
    const a = createSeededRandom('same');
    const b = createSeededRandom('same');
    for (let i = 0; i < 100; i++) expect(rollDie(a)).toBe(rollDie(b));
  });
});

describe('event bus', () => {
  it('delivers typed events and isolates failing listeners', () => {
    const errors: unknown[] = [];
    const bus = createEventBus<GameEvent>(e => errors.push(e));
    const seen: string[] = [];
    bus.subscribe(() => {
      throw new Error('broken listener');
    });
    const off = bus.on('DICE_ROLLED', e =>
      seen.push(`dice:${e.payload.value}`)
    );
    const event: GameEvent = {
      id: 'm:1',
      seq: 1,
      type: 'DICE_ROLLED',
      timestamp: 0,
      matchId: 'm',
      playerColor: 'green',
      payload: {value: 4, consecutiveSixes: 0, legalMoveCount: 1},
    };
    bus.publish([event]);
    expect(seen).toEqual(['dice:4']);
    expect(errors).toHaveLength(1);
    off();
    bus.publish([event]);
    expect(seen).toHaveLength(1);
    expect(bus.listenerCount()).toBe(1);
  });
});
