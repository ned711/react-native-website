import {describe, expect, it} from 'vitest';
import {
  HARD_WEIGHTS,
  captureRisk,
  createAi,
  legalMovesFor,
  scoreMove,
  type AiDifficulty,
} from '../../src/game/index.ts';
import {deepFreeze} from '../../src/utils/deepReadonly.ts';
import {createSeededRandom} from '../../src/utils/random.ts';
import {newGame, roll, withPawns} from './helpers.ts';
import {simulate} from './simulate.ts';

describe('algorithmic AI', () => {
  it('only ever picks legal moves and never mutates the (frozen) state - 90 full games', () => {
    const difficulties: AiDifficulty[] = ['easy', 'normal', 'hard'];
    for (let g = 0; g < 90; g++) {
      const d = difficulties[g % 3] as AiDifficulty;
      const other = difficulties[(g + 1) % 3] as AiDifficulty;
      const sim = simulate(
        `ai-${g}`,
        g % 2 ? '4p' : '2p',
        g % 2 ? [d, other, d, other] : [d, other]
      );
      expect(sim.final.phase.kind).toBe('finished');
      expect(sim.aiChoices).toBeGreaterThan(0);
    }
  });

  it('receives no dice source: the heuristic AIs are pure functions of the board', () => {
    const s = withPawns(newGame('2p'), {
      green: [3, 20, -1, -1],
      blue: [30, -1, -1, -1],
    });
    const rolled = roll(s, 1).state;
    if (rolled.phase.kind !== 'awaiting_move') throw new Error();
    const frozen = deepFreeze(structuredClone(rolled));
    const hard = createAi('hard', createSeededRandom('x'));
    const first = hard.chooseMove(
      frozen,
      frozen.phase.kind === 'awaiting_move' ? frozen.phase.legalMoves : []
    );
    for (let i = 0; i < 5; i++) {
      const again = createAi('hard', createSeededRandom(`other-${i}`));
      expect(again.chooseMove(frozen, rolled.phase.legalMoves)).toEqual(first);
    }
  });

  it('prefers capturing', () => {
    // green pawn 0 can capture blue at global 4 with a 1 ; pawn 1 can just advance.
    const s = withPawns(newGame('2p'), {
      green: [3, 20, -1, -1],
      blue: [30, -1, -1, -1],
    });
    const rolled = roll(s, 1).state;
    if (rolled.phase.kind !== 'awaiting_move') throw new Error();
    for (const d of ['normal', 'hard'] as const) {
      expect(
        createAi(d, createSeededRandom('c')).chooseMove(
          rolled,
          rolled.phase.legalMoves
        )
      ).toEqual({pawnIndex: 0});
    }
  });

  it('hard AI avoids stepping in front of an opponent', () => {
    // blue pawn at global 10 (rel 36). Green pawn A at 2 could go to 12 -> 2 cells ahead of blue (risky).
    // Green pawn B at 20 could go to 30 -> no threat.
    const s = withPawns(newGame('2p'), {
      green: [5, 20, -1, -1],
      blue: [36, -1, -1, -1],
    });
    expect(captureRisk(s, s.pawns, 'green', 11, 0)).toBeCloseTo(1 / 6);
    const moves = legalMovesFor(s, 'green', 6).filter(
      m => m.pawnIndex !== 2 && m.pawnIndex !== 3
    );
    const risky = moves.find(m => m.pawnIndex === 0);
    const safe = moves.find(m => m.pawnIndex === 1);
    if (!risky || !safe) throw new Error();
    expect(scoreMove(s, safe, HARD_WEIGHTS)).toBeGreaterThan(
      scoreMove(s, risky, HARD_WEIGHTS)
    );
  });

  it('computes zero risk on safe cells and in the final lane', () => {
    const s = withPawns(newGame('2p'), {blue: [36, -1, -1, -1]});
    expect(captureRisk(s, s.pawns, 'green', 13, 0)).toBe(0); // global 13 is safe
    expect(captureRisk(s, s.pawns, 'green', 53, 0)).toBe(0);
  });

  it('easy AI throws when given no legal move (caller bug), never invents one', () => {
    const s = newGame('2p');
    expect(() =>
      createAi('easy', createSeededRandom('e')).chooseMove(s, [])
    ).toThrow();
    expect(() =>
      createAi('hard', createSeededRandom('e')).chooseMove(s, [])
    ).toThrow();
  });
});
