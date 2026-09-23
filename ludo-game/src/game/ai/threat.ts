import {
  LAST_TRACK_POSITION,
  isOnTrack,
  toGlobalTrackPosition,
  TRACK_LENGTH,
} from '../board/constants.ts';
import {isSafeTrackPosition} from '../capture/capture.ts';
import {areTeammates} from '../rules/teams.ts';
import type {GameState, PlayerColor} from '../types.ts';

/**
 * Probability (0..1) that `color`'s pawn standing on relative `position` is
 * captured before `color` plays again, assuming each opponent rolls once.
 * Uses only public information: the board. Never the future dice.
 */
export function captureRisk(
  state: Pick<GameState, 'config' | 'players' | 'shields'>,
  pawns: Readonly<Record<PlayerColor, readonly number[]>>,
  color: PlayerColor,
  position: number,
  pawnIndex: number
): number {
  if (!isOnTrack(position)) return 0;
  const global = toGlobalTrackPosition(color, position);
  if (global === null || isSafeTrackPosition(state, global)) return 0;
  if (state.shields[color][pawnIndex]) return 0;

  let survive = 1;
  for (const player of state.players) {
    const other = player.color;
    if (other === color || player.status !== 'active') continue;
    if (
      !state.config.rules.teammateCaptureAllowed &&
      areTeammates(state.config, color, other)
    )
      continue;
    const hittingValues = new Set<number>();
    for (const theirPos of pawns[other]) {
      if (!isOnTrack(theirPos)) continue;
      const theirGlobal = toGlobalTrackPosition(other, theirPos);
      if (theirGlobal === null) continue;
      const distance = (global - theirGlobal + TRACK_LENGTH) % TRACK_LENGTH;
      // The attacker must still be on the common track after moving.
      if (
        distance >= 1 &&
        distance <= 6 &&
        theirPos + distance <= LAST_TRACK_POSITION
      ) {
        hittingValues.add(distance);
      }
    }
    survive *= 1 - hittingValues.size / 6;
  }
  return 1 - survive;
}
