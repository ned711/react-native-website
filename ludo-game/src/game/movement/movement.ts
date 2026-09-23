/**
 * Pure movement rules: target computation, path and legal move generation.
 */
import {
  BASE_POSITION,
  FINISH_POSITION,
  FIRST_FINAL_LANE_POSITION,
  isInBase,
  isInFinalLane,
  isOnTrack,
} from '../board/constants.ts';
import {resolveCaptures} from '../capture/capture.ts';
import type {
  DieValue,
  GameState,
  LegalMove,
  MoveKind,
  PlayerColor,
  RuleConfig,
} from '../types.ts';

/** Relative target position for a pawn, or null if the move is impossible. */
export function computeTarget(
  position: number,
  dice: DieValue,
  rules: RuleConfig
): number | null {
  if (isInBase(position)) {
    return rules.spawnValues.includes(dice) ? 0 : null;
  }
  if (position === FINISH_POSITION) return null;
  const target = position + dice;
  // Exact roll required: a pawn can never overshoot the centre.
  return target > FINISH_POSITION ? null : target;
}

/** Every relative position visited, in order (excluding the start, including the target). */
export function computePath(position: number, target: number): number[] {
  if (isInBase(position)) return [0];
  const path: number[] = [];
  for (let p = position + 1; p <= target; p++) path.push(p);
  return path;
}

export function classifyMove(from: number, to: number): MoveKind {
  if (from === BASE_POSITION) return 'spawn';
  if (to === FINISH_POSITION) return 'finish';
  if (isOnTrack(from) && isInFinalLane(to)) return 'enter_final_lane';
  return 'advance';
}

export function legalMovesFor(
  state: Pick<GameState, 'config' | 'pawns' | 'shields' | 'players'>,
  color: PlayerColor,
  dice: DieValue
): LegalMove[] {
  const moves: LegalMove[] = [];
  state.pawns[color].forEach((from, pawnIndex) => {
    const to = computeTarget(from, dice, state.config.rules);
    if (to === null) return;
    const {captures, shielded} = resolveCaptures(state, color, to);
    moves.push({
      color,
      pawnIndex,
      from,
      to,
      dice,
      kind: classifyMove(from, to),
      path: computePath(from, to),
      captures,
      shieldedTargets: shielded,
    });
  });
  return moves;
}

export {FIRST_FINAL_LANE_POSITION};
