import {describe, expect, it} from 'vitest';
import {
  applyAction,
  type GameState,
  type PlayerColor,
} from '../../src/game/index.ts';
import {NOW, move, newGame, roll, types, withPawns} from './helpers.ts';

/** Lets `color` finish its last pawn (at 56) with a 1 on its turn. */
function finishPlayer(
  state: GameState,
  color: PlayerColor
): {state: GameState; events: string[]} {
  let s = state;
  const events: string[] = [];
  for (let guard = 0; guard < 10 && s.currentColor !== color; guard++) {
    // other players roll a value that cannot move pawns in base
    const r = roll(s, 1);
    s = r.state;
    events.push(...types(r.events));
  }
  const pawnIndex = s.pawns[color].findIndex(p => p === 56);
  const r = move(roll(s, 1).state, pawnIndex);
  events.push(...types(r.events));
  return {state: r.state, events};
}

const almostDone = [56, 57, 57, 57];

describe('victory and rankings', () => {
  it('2 players: the first to finish wins and the game ends', () => {
    const s = withPawns(newGame('2p'), {green: almostDone});
    const r = finishPlayer(s, 'green');
    expect(r.events).toContain('PLAYER_FINISHED');
    expect(r.events).toContain('GAME_FINISHED');
    expect(r.state.phase.kind).toBe('finished');
    expect(r.state.rankings.map(x => [x.color, x.rank, x.outcome])).toEqual([
      ['green', 1, 'finished'],
      ['blue', 2, 'unfinished'],
    ]);
    const after = applyAction(
      r.state,
      {type: 'ROLL_DICE', color: 'blue', value: 3},
      {now: NOW}
    );
    if (after.ok) throw new Error('expected failure');
    expect(after.error.code).toBe('GAME_FINISHED');
  });

  it('all_players: continues until one player remains', () => {
    let s = withPawns(newGame('4p'), {
      green: almostDone,
      yellow: almostDone,
      blue: almostDone,
    });
    s = finishPlayer(s, 'green').state;
    expect(s.phase.kind).not.toBe('finished');
    s = finishPlayer(s, 'yellow').state;
    expect(s.phase.kind).not.toBe('finished');
    expect(s.duel).toBeNull();
    const last = finishPlayer(s, 'blue');
    expect(last.state.phase.kind).toBe('finished');
    expect(last.state.rankings.map(x => [x.color, x.rank])).toEqual([
      ['green', 1],
      ['yellow', 2],
      ['blue', 3],
      ['red', 4],
    ]);
  });

  it('top_two: ends as soon as two players finished, ranks the rest by progress', () => {
    let s = withPawns(newGame('4p', {endGameMode: 'top_two'}), {
      green: almostDone,
      yellow: almostDone,
      blue: [10, -1, -1, -1],
      red: [20, 5, -1, -1],
    });
    s = finishPlayer(s, 'green').state;
    const r = finishPlayer(s, 'yellow');
    expect(r.state.phase.kind).toBe('finished');
    expect(r.state.rankings.map(x => [x.color, x.rank, x.outcome])).toEqual([
      ['green', 1, 'finished'],
      ['yellow', 2, 'finished'],
      ['red', 3, 'unfinished'],
      ['blue', 4, 'unfinished'],
    ]);
  });

  it('top_two_final_duel: starts a duel between players 3 and 4, spectators cannot act', () => {
    let s = withPawns(newGame('4p', {endGameMode: 'top_two_final_duel'}), {
      green: almostDone,
      yellow: almostDone,
      red: almostDone,
    });
    s = finishPlayer(s, 'green').state;
    const second = finishPlayer(s, 'yellow');
    expect(second.events).toContain('DUEL_STARTED');
    s = second.state;
    expect(s.duel?.colors).toEqual(['blue', 'red']);
    expect(s.phase.kind).not.toBe('finished');
    // finished players are spectators: no gameplay action accepted
    const spectatorRoll = applyAction(
      s,
      {type: 'ROLL_DICE', color: 'green', value: 6},
      {now: NOW}
    );
    if (spectatorRoll.ok) throw new Error('expected failure');
    expect(spectatorRoll.error.code).toBe('PLAYER_NOT_ACTIVE');

    const duelEnd = finishPlayer(s, 'red');
    expect(duelEnd.state.phase.kind).toBe('finished');
    expect(duelEnd.state.rankings.map(x => [x.color, x.rank])).toEqual([
      ['green', 1],
      ['yellow', 2],
      ['red', 3],
      ['blue', 4],
    ]);
  });

  it('2v2: the first team with both players finished wins', () => {
    // teams: green+blue vs yellow+red
    let s = withPawns(newGame('2v2'), {
      green: almostDone,
      blue: almostDone,
      yellow: almostDone,
    });
    s = finishPlayer(s, 'green').state;
    expect(s.phase.kind).not.toBe('finished');
    s = finishPlayer(s, 'yellow').state;
    expect(s.phase.kind).not.toBe('finished');
    const done = finishPlayer(s, 'blue');
    expect(done.state.phase.kind).toBe('finished');
    const byColor = Object.fromEntries(
      done.state.rankings.map(r => [r.color, r.rank])
    );
    expect(byColor).toEqual({green: 1, blue: 1, yellow: 2, red: 2});
    const finished = done.state.rankings.find(r => r.color === 'yellow');
    expect(finished?.outcome).toBe('finished');
  });

  it('2v2: a team loses when both its players left', () => {
    const s = newGame('2v2');
    const first = applyAction(
      s,
      {type: 'LEAVE', color: 'yellow', reason: 'quit'},
      {now: NOW}
    );
    if (!first.ok) throw new Error();
    expect(first.value.state.phase.kind).not.toBe('finished');
    const next = applyAction(
      first.value.state,
      {type: 'LEAVE', color: 'red', reason: 'quit'},
      {now: NOW}
    );
    if (!next.ok) throw new Error();
    expect(next.value.state.phase.kind).toBe('finished');
    const winners = next.value.state.rankings
      .filter(r => r.rank === 1)
      .map(r => r.color);
    expect(winners.sort()).toEqual(['blue', 'green']);
  });
});
