/**
 * Classic algorithmic opponents (no machine learning, no external service).
 *
 *   AI -> MoveIntent -> engine validation -> new state -> events
 *
 * The AI never mutates the state, never sees the dice source and can only
 * pick among the legal moves computed by the engine.
 */
import {definitionFor} from '../adventure/definitions.ts';
import {adventureCellAt} from '../adventure/generator.ts';
import {isOnTrack, toGlobalTrackPosition} from '../board/constants.ts';
import {isSafeTrackPosition} from '../capture/capture.ts';
import type {MoveIntent} from '../engine/actions.ts';
import type {
  AiDifficulty,
  GameState,
  LegalMove,
  PlayerColor,
} from '../types.ts';
import {randomBelow, type RandomSource} from '../../utils/random.ts';
import {captureRisk} from './threat.ts';

export interface AiPlayer {
  readonly difficulty: AiDifficulty;
  chooseMove(state: GameState, legalMoves: readonly LegalMove[]): MoveIntent;
}

export interface HeuristicWeights {
  readonly capture: number;
  readonly finish: number;
  readonly spawn: number;
  readonly enterFinalLane: number;
  readonly safeLanding: number;
  readonly progress: number;
  readonly risk: number;
  readonly escape: number;
  readonly adventure: number;
}

export const NORMAL_WEIGHTS: HeuristicWeights = {
  capture: 100,
  finish: 80,
  spawn: 60,
  enterFinalLane: 50,
  safeLanding: 20,
  progress: 1,
  risk: 0,
  escape: 0,
  adventure: 0,
};

export const HARD_WEIGHTS: HeuristicWeights = {
  capture: 110,
  finish: 85,
  spawn: 55,
  enterFinalLane: 60,
  safeLanding: 25,
  progress: 1,
  risk: 1.2,
  escape: 1,
  adventure: 15,
};

function afterMove(
  state: GameState,
  move: LegalMove
): Record<PlayerColor, number[]> {
  const pawns = {
    green: [...state.pawns.green],
    yellow: [...state.pawns.yellow],
    blue: [...state.pawns.blue],
    red: [...state.pawns.red],
  };
  pawns[move.color][move.pawnIndex] = move.to;
  for (const c of move.captures) pawns[c.color][c.pawnIndex] = -1;
  return pawns;
}

/** Value at stake if a pawn at `position` is captured. */
const pawnValue = (position: number) => position + 10;

export function scoreMove(
  state: GameState,
  move: LegalMove,
  w: HeuristicWeights
): number {
  let score = 0;
  for (const c of move.captures) {
    score += w.capture + (state.pawns[c.color][c.pawnIndex] ?? 0);
  }
  if (move.kind === 'finish') score += w.finish;
  if (move.kind === 'spawn') score += w.spawn;
  if (move.kind === 'enter_final_lane') score += w.enterFinalLane;
  if (isOnTrack(move.to)) {
    const global = toGlobalTrackPosition(move.color, move.to);
    if (global !== null && isSafeTrackPosition(state, global))
      score += w.safeLanding;
    const cell =
      global === null ? null : adventureCellAt(state.config.adventure, global);
    if (cell)
      score +=
        definitionFor(cell.kind).polarity === 'positive'
          ? w.adventure
          : -w.adventure;
  }
  score += w.progress * (move.to - Math.max(move.from, 0));

  if (w.risk > 0 || w.escape > 0) {
    const pawns = afterMove(state, move);
    const riskBefore = captureRisk(
      state,
      state.pawns,
      move.color,
      move.from,
      move.pawnIndex
    );
    const riskAfter = captureRisk(
      state,
      pawns,
      move.color,
      move.to,
      move.pawnIndex
    );
    score -= w.risk * riskAfter * pawnValue(move.to) * 2;
    score += w.escape * riskBefore * pawnValue(move.from) * 2;
  }
  return score;
}

class HeuristicAi implements AiPlayer {
  constructor(
    readonly difficulty: AiDifficulty,
    private readonly weights: HeuristicWeights
  ) {}

  chooseMove(state: GameState, legalMoves: readonly LegalMove[]): MoveIntent {
    const first = legalMoves[0];
    if (!first) throw new RangeError('chooseMove called without legal moves');
    let best = first;
    let bestScore = scoreMove(state, first, this.weights);
    for (const move of legalMoves.slice(1)) {
      const score = scoreMove(state, move, this.weights);
      if (score > bestScore) {
        best = move;
        bestScore = score;
      }
    }
    return {pawnIndex: best.pawnIndex};
  }
}

class RandomAi implements AiPlayer {
  readonly difficulty = 'easy' as const;
  constructor(private readonly random: RandomSource) {}

  chooseMove(_state: GameState, legalMoves: readonly LegalMove[]): MoveIntent {
    const move = legalMoves[randomBelow(this.random, legalMoves.length)];
    if (!move) throw new RangeError('chooseMove called without legal moves');
    return {pawnIndex: move.pawnIndex};
  }
}

/**
 * @param random Randomness for the Easy AI only. It must be independent from
 *               the dice source so the AI cannot learn future rolls.
 */
export function createAi(
  difficulty: AiDifficulty,
  random: RandomSource
): AiPlayer {
  switch (difficulty) {
    case 'easy':
      return new RandomAi(random);
    case 'normal':
      return new HeuristicAi('normal', NORMAL_WEIGHTS);
    case 'hard':
      return new HeuristicAi('hard', HARD_WEIGHTS);
  }
}
