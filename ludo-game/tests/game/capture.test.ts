import {describe, expect, it} from 'vitest';
import {
  DEFAULT_SAFE_TRACK_POSITIONS,
  resolveCaptures,
  toGlobalTrackPosition,
} from '../../src/game/index.ts';
import {move, newGame, roll, types, withPawns} from './helpers.ts';

describe('capture', () => {
  it('sends an opponent pawn home when landing on it on the common track', () => {
    // blue rel 30 == global 56 % 52 == 4 ; green rel 4 == global 4
    expect(toGlobalTrackPosition('blue', 30)).toBe(4);
    const state = withPawns(newGame('2p'), {
      green: [1, -1, -1, -1],
      blue: [30, -1, -1, -1],
    });
    const m = move(roll(state, 3).state, 0);
    expect(m.state.pawns.blue[0]).toBe(-1);
    expect(m.state.pawns.green[0]).toBe(4);
    const captured = m.events.find(e => e.type === 'PAWN_CAPTURED');
    expect(captured?.payload).toEqual({
      attacker: 'green',
      attackerPawn: 0,
      victim: 'blue',
      victimPawn: 0,
      trackPosition: 4,
    });
    expect(types(m.events)).toContain('PAWN_RETURNED');
    // capture grants an extra roll
    expect(types(m.events)).toContain('EXTRA_TURN_GRANTED');
    expect(m.state.currentColor).toBe('green');
    expect(m.state.players.find(p => p.color === 'green')?.captures).toBe(1);
  });

  it('never captures on safe cells', () => {
    expect(DEFAULT_SAFE_TRACK_POSITIONS).toEqual([
      0, 9, 13, 22, 26, 35, 39, 48,
    ]);
    // global 9 is a star. blue rel 35 -> global 9
    expect(toGlobalTrackPosition('blue', 35)).toBe(9);
    const state = withPawns(newGame('2p'), {
      green: [6, -1, -1, -1],
      blue: [35, -1, -1, -1],
    });
    const m = move(roll(state, 3).state, 0);
    expect(m.state.pawns.blue[0]).toBe(35);
    expect(types(m.events)).not.toContain('PAWN_CAPTURED');
  });

  it('never captures on a start cell when spawning', () => {
    // blue rel 26 -> global 0 (green start)
    const state = withPawns(newGame('2p'), {blue: [26, -1, -1, -1]});
    const m = move(roll(state, 6).state, 0);
    expect(m.state.pawns.blue[0]).toBe(26);
    expect(m.state.pawns.green[0]).toBe(0);
  });

  it('never captures in the final lane or the base', () => {
    const state = withPawns(newGame('2p'), {
      green: [50, -1, -1, -1],
      blue: [-1, -1, -1, -1],
    });
    expect(resolveCaptures(state, 'green', 53).captures).toEqual([]);
    expect(resolveCaptures(state, 'green', -1).captures).toEqual([]);
  });

  it('does not capture own pawns', () => {
    const state = withPawns(newGame('2p'), {green: [2, 5, -1, -1]});
    expect(resolveCaptures(state, 'green', 5).captures).toEqual([]);
  });

  it('captures every opponent pawn stacked on the landing cell', () => {
    const state = withPawns(newGame('2p'), {
      green: [1, -1, -1, -1],
      blue: [30, 30, -1, -1],
    });
    const m = move(roll(state, 3).state, 0);
    expect(m.state.pawns.blue.slice(0, 2)).toEqual([-1, -1]);
    expect(m.events.filter(e => e.type === 'PAWN_CAPTURED')).toHaveLength(2);
  });

  it('does not capture teammates in 2v2 unless allowed', () => {
    // green & blue are teammates. blue rel 30 -> global 4.
    const state = withPawns(newGame('2v2'), {
      green: [1, -1, -1, -1],
      blue: [30, -1, -1, -1],
    });
    const m = move(roll(state, 3).state, 0);
    expect(m.state.pawns.blue[0]).toBe(30);
    const allowed = withPawns(
      newGame('2v2', {
        rules: {...state.config.rules, teammateCaptureAllowed: true},
      }),
      {green: [1, -1, -1, -1], blue: [30, -1, -1, -1]}
    );
    const m2 = move(roll(allowed, 3).state, 0);
    expect(m2.state.pawns.blue[0]).toBe(-1);
  });
});
