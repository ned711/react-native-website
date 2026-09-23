/**
 * Canonical 15x15 grid geometry of a classic Ludo board.
 *
 * Only the green quarter is written by hand; the three other quarters are
 * produced by rotating it 90° clockwise, which guarantees the four quarters
 * are identical. `validation.ts` proves the resulting geometry is coherent
 * with the logical track (see tests/game/board.test.ts).
 *
 * Coordinates: `row` grows downwards, `col` grows to the right.
 */
import {PLAYER_COLORS, type PlayerColor} from '../types.ts';
import {
  ARM_LENGTH,
  FINAL_LANE_LENGTH,
  FINISH_POSITION,
  FIRST_FINAL_LANE_POSITION,
  PAWNS_PER_PLAYER,
  SEAT_ORDER,
  isInBase,
  isInFinalLane,
  isOnTrack,
  toGlobalTrackPosition,
} from './constants.ts';

export const GRID_SIZE = 15;

export interface GridCell {
  readonly row: number;
  readonly col: number;
}

/** Continuous point in cell units (cell (r,c) spans [r, r+1] x [c, c+1]). */
export interface GridPoint {
  readonly y: number;
  readonly x: number;
}

export interface GridRegion {
  readonly row: number;
  readonly col: number;
  readonly size: number;
}

/** Green's 13 track cells, starting at green's start cell (global 0). */
const GREEN_ARM: readonly GridCell[] = [
  {row: 6, col: 0},
  {row: 6, col: 1},
  {row: 6, col: 2},
  {row: 6, col: 3},
  {row: 6, col: 4},
  {row: 6, col: 5},
  {row: 5, col: 6},
  {row: 4, col: 6},
  {row: 3, col: 6},
  {row: 2, col: 6},
  {row: 1, col: 6},
  {row: 0, col: 6},
  {row: 0, col: 7},
];

const GREEN_FINAL_LANE: readonly GridCell[] = [
  {row: 7, col: 1},
  {row: 7, col: 2},
  {row: 7, col: 3},
  {row: 7, col: 4},
  {row: 7, col: 5},
];

const GREEN_BASE: GridRegion = {row: 0, col: 0, size: 6};

const GREEN_BASE_SLOTS: readonly GridPoint[] = [
  {y: 2, x: 2},
  {y: 2, x: 4},
  {y: 4, x: 2},
  {y: 4, x: 4},
];

export const CENTER_REGION: GridRegion = {row: 6, col: 6, size: 3};
export const FINISH_CELL: GridCell = {row: 7, col: 7};

function rotateCell(cell: GridCell, quarterTurns: number): GridCell {
  let {row, col} = cell;
  for (let i = 0; i < quarterTurns; i++) {
    [row, col] = [col, GRID_SIZE - 1 - row];
  }
  return {row, col};
}

function rotatePoint(point: GridPoint, quarterTurns: number): GridPoint {
  let {y, x} = point;
  for (let i = 0; i < quarterTurns; i++) {
    [y, x] = [x, GRID_SIZE - y];
  }
  return {y, x};
}

function rotateRegion(region: GridRegion, quarterTurns: number): GridRegion {
  const a = rotateCell({row: region.row, col: region.col}, quarterTurns);
  const b = rotateCell(
    {row: region.row + region.size - 1, col: region.col + region.size - 1},
    quarterTurns
  );
  return {
    row: Math.min(a.row, b.row),
    col: Math.min(a.col, b.col),
    size: region.size,
  };
}

function quarterOf(color: PlayerColor): number {
  return SEAT_ORDER.indexOf(color);
}

/** All 52 common track cells, indexed by global track position. */
export const TRACK_CELLS: readonly GridCell[] = SEAT_ORDER.flatMap(color =>
  GREEN_ARM.map(cell => rotateCell(cell, quarterOf(color)))
);

function byColor<T>(make: (color: PlayerColor) => T): Record<PlayerColor, T> {
  return {
    green: make('green'),
    yellow: make('yellow'),
    blue: make('blue'),
    red: make('red'),
  };
}

export const FINAL_LANE_CELLS: Readonly<
  Record<PlayerColor, readonly GridCell[]>
> = byColor(color =>
  GREEN_FINAL_LANE.map(cell => rotateCell(cell, quarterOf(color)))
);

export const BASE_REGIONS: Readonly<Record<PlayerColor, GridRegion>> = byColor(
  color => rotateRegion(GREEN_BASE, quarterOf(color))
);

export const BASE_SLOTS: Readonly<Record<PlayerColor, readonly GridPoint[]>> =
  byColor(color =>
    GREEN_BASE_SLOTS.map(point => rotatePoint(point, quarterOf(color)))
  );

/** Where finished pawns are drawn: inside the colour's centre triangle. */
export const FINISH_POINTS: Readonly<Record<PlayerColor, GridPoint>> = byColor(
  color => rotatePoint({y: 7.5, x: 6.55}, quarterOf(color))
);

export function cellCenter(cell: GridCell): GridPoint {
  return {y: cell.row + 0.5, x: cell.col + 0.5};
}

/** Maps a pawn's logical position to a drawable grid point. */
export function pointForPawn(
  color: PlayerColor,
  position: number,
  pawnIndex: number
): GridPoint {
  if (isInBase(position)) {
    const slot = BASE_SLOTS[color][pawnIndex % PAWNS_PER_PLAYER];
    if (!slot) {
      throw new RangeError(`No base slot for pawn ${pawnIndex}`);
    }
    return slot;
  }
  if (isOnTrack(position)) {
    const global = toGlobalTrackPosition(color, position);
    const cell = global === null ? undefined : TRACK_CELLS[global];
    if (!cell) {
      throw new RangeError(`No track cell for position ${position}`);
    }
    return cellCenter(cell);
  }
  if (isInFinalLane(position)) {
    const cell = FINAL_LANE_CELLS[color][position - FIRST_FINAL_LANE_POSITION];
    if (!cell) {
      throw new RangeError(`No final lane cell for position ${position}`);
    }
    return cellCenter(cell);
  }
  if (position === FINISH_POSITION) {
    return FINISH_POINTS[color];
  }
  throw new RangeError(`Invalid pawn position ${position}`);
}

/** Grid cell occupied by a pawn, or null when in base / finished. */
export function cellForPawn(
  color: PlayerColor,
  position: number
): GridCell | null {
  if (isOnTrack(position)) {
    const global = toGlobalTrackPosition(color, position);
    return global === null ? null : (TRACK_CELLS[global] ?? null);
  }
  if (isInFinalLane(position)) {
    return (
      FINAL_LANE_CELLS[color][position - FIRST_FINAL_LANE_POSITION] ?? null
    );
  }
  return null;
}

export interface BoardGeometry {
  readonly gridSize: number;
  readonly trackCells: readonly GridCell[];
  readonly finalLanes: Readonly<Record<PlayerColor, readonly GridCell[]>>;
  readonly baseRegions: Readonly<Record<PlayerColor, GridRegion>>;
  readonly centerRegion: GridRegion;
  readonly startIndex: Readonly<Record<PlayerColor, number>>;
  readonly armLength: number;
  readonly finalLaneLength: number;
}

export function regionContains(region: GridRegion, cell: GridCell): boolean {
  return (
    cell.row >= region.row &&
    cell.row < region.row + region.size &&
    cell.col >= region.col &&
    cell.col < region.col + region.size
  );
}

export const COLORS_BY_QUARTER: readonly PlayerColor[] = PLAYER_COLORS;
export {ARM_LENGTH, FINAL_LANE_LENGTH};
