import {describe, expect, it} from 'vitest';
import {CLASSIC_RULES, applyAction} from '../../src/game/index.ts';
import {NOW, act, move, newGame, roll, types, withPawns} from './helpers.ts';

describe('turns', () => {
  it('follows clockwise seat order and skips empty seats', () => {
    let s = newGame('4p');
    const order: string[] = [];
    for (let i = 0; i < 5; i++) {
      order.push(s.currentColor);
      s = roll(s, 2).state;
    }
    expect(order).toEqual(['green', 'yellow', 'blue', 'red', 'green']);

    let two = newGame('2p');
    const order2: string[] = [];
    for (let i = 0; i < 3; i++) {
      order2.push(two.currentColor);
      two = roll(two, 1).state;
    }
    expect(order2).toEqual(['green', 'blue', 'green']);
  });

  it('grants another roll after a 6', () => {
    const s = withPawns(newGame('2p'), {green: [5, -1, -1, -1]});
    const m = move(roll(s, 6).state, 0);
    expect(m.state.currentColor).toBe('green');
    expect(m.state.phase.kind).toBe('awaiting_roll');
    const extra = m.events.find(e => e.type === 'EXTRA_TURN_GRANTED');
    expect(extra?.payload).toEqual({reasons: ['six']});
  });

  it('ends the turn after a normal move', () => {
    const s = withPawns(newGame('2p'), {green: [5, -1, -1, -1]});
    const m = move(roll(s, 2).state, 0);
    expect(m.state.currentColor).toBe('blue');
    expect(m.state.turnNumber).toBe(2);
  });

  it('forfeits the turn on the third consecutive six', () => {
    let s = withPawns(newGame('2p'), {green: [5, -1, -1, -1]});
    s = move(roll(s, 6).state, 0).state;
    s = move(roll(s, 6).state, 0).state;
    const third = roll(s, 6);
    expect(types(third.events)).toEqual([
      'DICE_ROLLED',
      'TURN_FORFEITED',
      'TURN_STARTED',
    ]);
    expect(third.state.currentColor).toBe('blue');
    expect(third.state.pawns.green[0]).toBe(17);
  });

  it('can disable the consecutive-six rule', () => {
    let s = withPawns(
      newGame('2p', {rules: {...CLASSIC_RULES, maxConsecutiveSixes: null}}),
      {
        green: [5, -1, -1, -1],
      }
    );
    for (let i = 0; i < 4; i++) s = move(roll(s, 6).state, 0).state;
    expect(s.currentColor).toBe('green');
  });

  it('skips finished players', () => {
    const s = withPawns(
      newGame('3p'),
      {yellow: [57, 57, 57, 57]},
      {
        players: newGame('3p').players.map(p =>
          p.color === 'yellow' ? {...p, status: 'finished'} : p
        ),
      }
    );
    const r = roll(s, 1);
    expect(r.state.currentColor).toBe('blue');
    const finished = applyAction(
      r.state,
      {type: 'ROLL_DICE', color: 'yellow', value: 3},
      {now: NOW}
    );
    if (finished.ok) throw new Error('expected failure');
    expect(finished.error.code).toBe('PLAYER_NOT_ACTIVE');
  });

  it("handles a player leaving during someone else's turn and during their own", () => {
    let s = newGame('3p');
    s = act(s, {type: 'LEAVE', color: 'yellow', reason: 'quit'}).state;
    expect(s.currentColor).toBe('green');
    s = roll(s, 1).state;
    expect(s.currentColor).toBe('blue');
    const own = act(s, {type: 'LEAVE', color: 'blue', reason: 'abandon'});
    // only green remains -> game over
    expect(own.state.phase.kind).toBe('finished');
    expect(own.state.rankings.map(r => [r.color, r.rank, r.outcome])).toEqual([
      ['green', 1, 'unfinished'],
      ['blue', 2, 'left'],
      ['yellow', 3, 'left'],
    ]);
  });

  it('lets an AI take over a seat without changing the turn', () => {
    const s = newGame('2p');
    const r = act(s, {
      type: 'REPLACE_WITH_AI',
      color: 'blue',
      difficulty: 'normal',
    });
    expect(r.state.players.find(p => p.color === 'blue')?.controller).toEqual({
      kind: 'ai',
      difficulty: 'normal',
    });
    expect(r.state.currentColor).toBe('green');
  });
});
