import {PLAYER_COLORS, type PlayerColor} from '../types.ts';

export const TRACK_LENGTH = 52;
export const FINAL_LANE_LENGTH = 5;
export const PAWNS_PER_PLAYER = 4;

export const BASE_POSITION = -1;
export const FIRST_TRACK_POSITION = 0;
export const LAST_TRACK_POSITION = TRACK_LENGTH - 1; // 51
export const FIRST_FINAL_LANE_POSITION = TRACK_LENGTH; // 52
export const LAST_FINAL_LANE_POSITION = TRACK_LENGTH + FINAL_LANE_LENGTH - 1; // 56
export const FINISH_POSITION = TRACK_LENGTH + FINAL_LANE_LENGTH; // 57

/** Number of track cells between two consecutive players' starts. */
export const ARM_LENGTH = TRACK_LENGTH / PLAYER_COLORS.length; // 13

/**
 * Seat order around the board, clockwise. Start indices are derived from it so
 * that the four starts are always exactly `ARM_LENGTH` apart.
 */
export const SEAT_ORDER: readonly PlayerColor[] = PLAYER_COLORS;

export const START_INDEX: Readonly<Record<PlayerColor, number>> = {
  green: SEAT_ORDER.indexOf('green') * ARM_LENGTH,
  yellow: SEAT_ORDER.indexOf('yellow') * ARM_LENGTH,
  blue: SEAT_ORDER.indexOf('blue') * ARM_LENGTH,
  red: SEAT_ORDER.indexOf('red') * ARM_LENGTH,
};

export function isInBase(position: number): boolean {
  return position === BASE_POSITION;
}

export function isOnTrack(position: number): boolean {
  return position >= FIRST_TRACK_POSITION && position <= LAST_TRACK_POSITION;
}

export function isInFinalLane(position: number): boolean {
  return (
    position >= FIRST_FINAL_LANE_POSITION &&
    position <= LAST_FINAL_LANE_POSITION
  );
}

export function isFinished(position: number): boolean {
  return position === FINISH_POSITION;
}

export function isValidPosition(position: number): boolean {
  return (
    Number.isInteger(position) &&
    position >= BASE_POSITION &&
    position <= FINISH_POSITION
  );
}

/** Converts a relative track position (0..51) to the global track index. */
export function toGlobalTrackPosition(
  color: PlayerColor,
  relative: number
): number | null {
  if (!isOnTrack(relative)) {
    return null;
  }
  return (START_INDEX[color] + relative) % TRACK_LENGTH;
}

/** Inverse of `toGlobalTrackPosition`. */
export function toRelativeTrackPosition(
  color: PlayerColor,
  global: number
): number {
  return (global - START_INDEX[color] + TRACK_LENGTH) % TRACK_LENGTH;
}

/**
 * Steps travelled by a pawn, from 0 (in base) to 58 (finished). Leaving base
 * counts as one step, so every colour's full journey has the same length.
 */
export function stepsTravelled(position: number): number {
  return position + 1;
}
