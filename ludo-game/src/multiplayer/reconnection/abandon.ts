/**
 * Anti-abandon policy. A short network loss is NOT an abandon: the player gets
 * a grace period, then the server auto-plays their turns; only after several
 * missed turns is the seat declared abandoned.
 */
import type {AiDifficulty, GameMode} from '../../game/types.ts';

export interface AbandonPolicy {
  /** Time allowed for a turn before the server acts for the player. */
  readonly turnTimeoutMs: number;
  /** Consecutive auto-played turns after which the seat is abandoned. */
  readonly maxMissedTurns: number;
  /** What happens to an abandoned seat. */
  readonly onAbandon: 'replace_with_ai' | 'remove_player';
  readonly replacementDifficulty: AiDifficulty;
  /** Penalty recorded server-side (e.g. rating / reputation points). */
  readonly penaltyPoints: number;
}

export const DEFAULT_ABANDON_POLICIES: Readonly<
  Record<GameMode, AbandonPolicy>
> = {
  online: {
    turnTimeoutMs: 20_000,
    maxMissedTurns: 3,
    onAbandon: 'replace_with_ai',
    replacementDifficulty: 'normal',
    penaltyPoints: 10,
  },
  team: {
    turnTimeoutMs: 20_000,
    maxMissedTurns: 3,
    onAbandon: 'replace_with_ai',
    replacementDifficulty: 'normal',
    penaltyPoints: 10,
  },
  mixed: {
    turnTimeoutMs: 20_000,
    maxMissedTurns: 3,
    onAbandon: 'replace_with_ai',
    replacementDifficulty: 'normal',
    penaltyPoints: 5,
  },
  classic: {
    turnTimeoutMs: 30_000,
    maxMissedTurns: 5,
    onAbandon: 'remove_player',
    replacementDifficulty: 'normal',
    penaltyPoints: 0,
  },
  local: {
    turnTimeoutMs: Number.POSITIVE_INFINITY,
    maxMissedTurns: Number.POSITIVE_INFINITY,
    onAbandon: 'remove_player',
    replacementDifficulty: 'normal',
    penaltyPoints: 0,
  },
};

export type SeatVerdict = 'on_time' | 'auto_play' | 'abandoned';

export function evaluateTurn(
  policy: AbandonPolicy,
  turnStartedAt: number,
  now: number,
  missedTurns: number
): SeatVerdict {
  if (now - turnStartedAt < policy.turnTimeoutMs) return 'on_time';
  return missedTurns + 1 >= policy.maxMissedTurns ? 'abandoned' : 'auto_play';
}
