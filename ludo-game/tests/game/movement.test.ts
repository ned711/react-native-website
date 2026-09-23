import {describe, expect, it} from 'vitest';
import {
  CLASSIC_RULES,
  applyAction,
  classifyMove,
  computePath,
  computeTarget,
  legalMovesFor,
} from '../../src/game/index.ts';
import {NOW, move, newGame, roll, types, withPawns} from './helpers.ts';

describe('movement', () => {
  it('only lets a pawn leave its base with a 6', () => {
    for (const d of [1, 2, 3, 4, 5] as const) {
      expect(computeTarget(-1, d, CLASSIC_RULES)).toBeNull();
    }
    expect(computeTarget(-1, 6, CLASSIC_RULES)).toBe(0);
    const state = newGame('2p');
    const r = roll(state, 6);
    expect(r.state.phase.kind).toBe('awaiting_move');
    const m = move(r.state, 0);
    expect(m.state.pawns.green[0]).toBe(0);
    expect(types(m.events)).toContain('PAWN_SPAWNED');
    const spawn = m.events.find(e => e.type === 'PAWN_SPAWNED');
    expect(spawn?.payload).toEqual({pawnIndex: 0, trackPosition: 0});
  });

  it('passes the turn when no pawn can move (all in base, no 6)', () => {
    const state = newGame('2p');
    const r = roll(state, 3);
    expect(types(r.events)).toEqual([
      'DICE_ROLLED',
      'NO_LEGAL_MOVE',
      'TURN_STARTED',
    ]);
    expect(r.state.currentColor).toBe('blue');
  });

  it('advances by the dice value along the path', () => {
    expect(computeTarget(10, 4, CLASSIC_RULES)).toBe(14);
    expect(computePath(10, 14)).toEqual([11, 12, 13, 14]);
    const state = withPawns(newGame('2p'), {green: [10, -1, -1, -1]});
    const m = move(roll(state, 4).state, 0);
    expect(m.state.pawns.green[0]).toBe(14);
    const moved = m.events.find(e => e.type === 'PAWN_MOVED');
    expect(moved?.payload).toMatchObject({
      from: 10,
      to: 14,
      path: [11, 12, 13, 14],
      dice: 4,
    });
  });

  it('enters the final lane only after the full loop (51 -> 52)', () => {
    expect(computeTarget(49, 3, CLASSIC_RULES)).toBe(52);
    expect(classifyMove(49, 52)).toBe('enter_final_lane');
    expect(computePath(49, 52)).toEqual([50, 51, 52]);
    const state = withPawns(newGame('2p'), {green: [49, -1, -1, -1]});
    const m = move(roll(state, 3).state, 0);
    expect(m.state.pawns.green[0]).toBe(52);
    expect(types(m.events)).toContain('FINAL_LANE_ENTERED');
  });

  it('never overshoots the centre (exact roll required)', () => {
    expect(computeTarget(55, 3, CLASSIC_RULES)).toBeNull();
    expect(computeTarget(55, 2, CLASSIC_RULES)).toBe(57);
    expect(computeTarget(57, 1, CLASSIC_RULES)).toBeNull();
    const state = withPawns(newGame('2p'), {green: [55, 57, 57, 57]});
    const r = roll(state, 4);
    expect(types(r.events)).toContain('NO_LEGAL_MOVE');
  });

  it('finishes a pawn on exactly 57', () => {
    const state = withPawns(newGame('4p'), {green: [54, -1, -1, -1]});
    const m = move(roll(state, 3).state, 0);
    expect(m.state.pawns.green[0]).toBe(57);
    expect(types(m.events)).toContain('PAWN_FINISHED');
    expect(types(m.events)).toContain('EXTRA_TURN_GRANTED');
  });

  it('rejects illegal and out-of-turn actions with structured errors', () => {
    const state = newGame('2p');
    const notTurn = applyAction(
      state,
      {type: 'ROLL_DICE', color: 'blue', value: 6},
      {now: NOW}
    );
    expect(notTurn.ok).toBe(false);
    if (!notTurn.ok) expect(notTurn.error.code).toBe('NOT_YOUR_TURN');

    const moveFirst = applyAction(
      state,
      {type: 'MOVE_PAWN', color: 'green', pawnIndex: 0},
      {now: NOW}
    );
    if (!moveFirst.ok) expect(moveFirst.error.code).toBe('MUST_ROLL_FIRST');
    else throw new Error('expected failure');

    const badDie = applyAction(
      state,
      {type: 'ROLL_DICE', color: 'green', value: 7 as 6},
      {now: NOW}
    );
    if (!badDie.ok) expect(badDie.error.code).toBe('INVALID_DICE_VALUE');
    else throw new Error('expected failure');

    const rolled = roll(state, 6).state;
    const twice = applyAction(
      rolled,
      {type: 'ROLL_DICE', color: 'green', value: 6},
      {now: NOW}
    );
    if (!twice.ok) expect(twice.error.code).toBe('ALREADY_ROLLED');
    else throw new Error('expected failure');

    const withOne = withPawns(newGame('2p'), {green: [5, -1, -1, -1]});
    const r = roll(withOne, 2).state;
    const illegal = applyAction(
      r,
      {type: 'MOVE_PAWN', color: 'green', pawnIndex: 1},
      {now: NOW}
    );
    if (!illegal.ok) expect(illegal.error.code).toBe('ILLEGAL_MOVE');
    else throw new Error('expected failure');

    const badPawn = applyAction(
      r,
      {type: 'MOVE_PAWN', color: 'green', pawnIndex: 9},
      {now: NOW}
    );
    if (!badPawn.ok) expect(badPawn.error.code).toBe('INVALID_PAWN');
    else throw new Error('expected failure');

    const unknown = applyAction(
      r,
      {type: 'MOVE_PAWN', color: 'red', pawnIndex: 0},
      {now: NOW}
    );
    if (!unknown.ok) expect(unknown.error.code).toBe('UNKNOWN_PLAYER');
    else throw new Error('expected failure');
  });

  it('never mutates the input state', () => {
    const state = withPawns(newGame('4p'), {green: [3, -1, -1, -1]});
    const snapshot = JSON.stringify(state);
    const r = roll(state, 6);
    move(r.state, 1);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('lists one legal move per movable pawn', () => {
    const state = withPawns(newGame('2p'), {green: [-1, 10, 55, 57]});
    const moves = legalMovesFor(state, 'green', 6);
    expect(moves.map(m => [m.pawnIndex, m.to, m.kind])).toEqual([
      [0, 0, 'spawn'],
      [1, 16, 'advance'],
    ]);
  });
});
