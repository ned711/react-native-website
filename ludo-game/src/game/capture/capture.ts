/**
 * Capture rules, independent from movement. Captures only exist on the
 * common track, never on safe cells, never against the mover's own pawns and
 * (by default) never against teammates.
 */
import {toGlobalTrackPosition, isOnTrack} from '../board/constants.ts';
import {areTeammates} from '../rules/teams.ts';
import type {CaptureTarget, GameState, PlayerColor} from '../types.ts';

export function isSafeTrackPosition(
  state: Pick<GameState, 'config'>,
  global: number
): boolean {
  return state.config.rules.safeTrackPositions.includes(global);
}

export interface CaptureResolution {
  readonly captures: readonly CaptureTarget[];
  readonly shielded: readonly CaptureTarget[];
}

const NO_CAPTURE: CaptureResolution = {captures: [], shielded: []};

/** Opponent pawns that would be sent home if `color` lands on relative `target`. */
export function resolveCaptures(
  state: Pick<GameState, 'config' | 'pawns' | 'shields' | 'players'>,
  color: PlayerColor,
  target: number
): CaptureResolution {
  if (!isOnTrack(target)) return NO_CAPTURE;
  const global = toGlobalTrackPosition(color, target);
  if (global === null || isSafeTrackPosition(state, global)) return NO_CAPTURE;

  const captures: CaptureTarget[] = [];
  const shielded: CaptureTarget[] = [];
  for (const player of state.players) {
    const other = player.color;
    if (other === color) continue;
    if (player.status === 'left') continue;
    if (
      !state.config.rules.teammateCaptureAllowed &&
      areTeammates(state.config, color, other)
    ) {
      continue;
    }
    state.pawns[other].forEach((position, pawnIndex) => {
      if (toGlobalTrackPosition(other, position) === global) {
        const victim = {color: other, pawnIndex, trackPosition: global};
        if (state.shields[other][pawnIndex]) shielded.push(victim);
        else captures.push(victim);
      }
    });
  }
  return {captures, shielded};
}
