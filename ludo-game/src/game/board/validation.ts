/**
 * Automatic, mathematical validation of a Ludo board geometry against the
 * logical position convention (-1 base, 0..51 track, 52..56 lane, 57 finish).
 */
import {PLAYER_COLORS, type PlayerColor} from '../types.ts';
import {
  ARM_LENGTH,
  FINAL_LANE_LENGTH,
  FINISH_POSITION,
  START_INDEX,
  TRACK_LENGTH,
  toGlobalTrackPosition,
} from './constants.ts';
import {
  BASE_REGIONS,
  CENTER_REGION,
  FINAL_LANE_CELLS,
  GRID_SIZE,
  TRACK_CELLS,
  regionContains,
  type BoardGeometry,
  type GridCell,
  type GridRegion,
} from './layout.ts';

export interface BoardCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly details: string;
}

export interface BoardValidationReport {
  readonly passed: boolean;
  readonly checks: readonly BoardCheck[];
}

export type StepKind = 'orthogonal' | 'diagonal' | 'invalid';

export function stepKind(a: GridCell, b: GridCell): StepKind {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  if (dr + dc === 1) return 'orthogonal';
  if (dr === 1 && dc === 1) return 'diagonal';
  return 'invalid';
}

const key = (cell: GridCell) => `${cell.row},${cell.col}`;

function touchesRegion(cell: GridCell, region: GridRegion): boolean {
  const neighbours: GridCell[] = [
    {row: cell.row - 1, col: cell.col},
    {row: cell.row + 1, col: cell.col},
    {row: cell.row, col: cell.col - 1},
    {row: cell.row, col: cell.col + 1},
  ];
  return neighbours.some(n => regionContains(region, n));
}

function isInnerCorner(a: GridCell, b: GridCell, center: GridRegion): boolean {
  // A diagonal step is legitimate only when it wraps around a corner of the
  // centre square: the shared corner point of the two cells is a centre corner.
  const cornerRow = Math.max(a.row, b.row);
  const cornerCol = Math.max(a.col, b.col);
  const corners = [
    [center.row, center.col],
    [center.row, center.col + center.size],
    [center.row + center.size, center.col],
    [center.row + center.size, center.col + center.size],
  ];
  return corners.some(([r, c]) => r === cornerRow && c === cornerCol);
}

/** Full sequence of cells visited by a colour from its start cell to its last lane cell. */
export function pathCells(
  geometry: BoardGeometry,
  color: PlayerColor
): GridCell[] {
  const cells: GridCell[] = [];
  for (let rel = 0; rel < TRACK_LENGTH; rel++) {
    const global =
      (geometry.startIndex[color] + rel) % geometry.trackCells.length;
    const cell = geometry.trackCells[global];
    if (cell) cells.push(cell);
  }
  cells.push(...geometry.finalLanes[color]);
  return cells;
}

export function validateBoard(geometry: BoardGeometry): BoardValidationReport {
  const checks: BoardCheck[] = [];
  const add = (name: string, passed: boolean, details: string) =>
    checks.push({name, passed, details});
  const track = geometry.trackCells;
  const n = track.length;

  add(
    'track_length',
    n === TRACK_LENGTH,
    `${n} cells (expected ${TRACK_LENGTH})`
  );

  const unique = new Set(track.map(key));
  add('track_unique', unique.size === n, `${unique.size} distinct of ${n}`);

  const inBounds = track.every(
    c =>
      c.row >= 0 &&
      c.col >= 0 &&
      c.row < geometry.gridSize &&
      c.col < geometry.gridSize
  );
  add(
    'track_in_bounds',
    inBounds,
    `grid ${geometry.gridSize}x${geometry.gridSize}`
  );

  const overlapsReserved = track.filter(
    c =>
      regionContains(geometry.centerRegion, c) ||
      PLAYER_COLORS.some(color =>
        regionContains(geometry.baseRegions[color], c)
      )
  );
  add(
    'track_outside_bases_and_center',
    overlapsReserved.length === 0,
    `${overlapsReserved.length} track cells overlap a base or the centre`
  );

  // Loop connectivity, including the 51 -> 0 wraparound.
  let orthogonal = 0;
  let diagonal = 0;
  const badSteps: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = track[i];
    const b = track[(i + 1) % n];
    if (!a || !b) continue;
    const kind = stepKind(a, b);
    if (kind === 'orthogonal') orthogonal++;
    else if (kind === 'diagonal' && isInnerCorner(a, b, geometry.centerRegion))
      diagonal++;
    else badSteps.push(`${i}->${(i + 1) % n}`);
  }
  add(
    'track_closed_loop_adjacency',
    badSteps.length === 0,
    badSteps.length === 0
      ? `${orthogonal} orthogonal steps, ${diagonal} inner-corner diagonal steps`
      : `invalid steps: ${badSteps.join(', ')}`
  );
  add(
    'track_diagonal_steps_only_at_inner_corners',
    diagonal === PLAYER_COLORS.length &&
      orthogonal === n - PLAYER_COLORS.length,
    `${diagonal} diagonal steps (expected ${PLAYER_COLORS.length})`
  );

  // Starts: evenly spaced and adjacent to the owner's base.
  const starts = PLAYER_COLORS.map(c => geometry.startIndex[c]);
  const spacingOk = PLAYER_COLORS.every(
    (c, i) => geometry.startIndex[c] === i * geometry.armLength
  );
  add(
    'start_indices_evenly_spaced',
    spacingOk && new Set(starts).size === PLAYER_COLORS.length,
    `starts ${starts.join(', ')} (arm ${geometry.armLength})`
  );
  const startsTouchBase = PLAYER_COLORS.every(color => {
    const cell = track[geometry.startIndex[color]];
    return !!cell && touchesRegion(cell, geometry.baseRegions[color]);
  });
  add(
    'start_cells_touch_own_base',
    startsTouchBase,
    'each start cell borders its base'
  );

  // Final lanes.
  const laneProblems: string[] = [];
  const allLaneCells = new Set<string>();
  for (const color of PLAYER_COLORS) {
    const lane = geometry.finalLanes[color];
    if (lane.length !== geometry.finalLaneLength) {
      laneProblems.push(`${color}: length ${lane.length}`);
      continue;
    }
    for (const cell of lane) {
      if (unique.has(key(cell)))
        laneProblems.push(`${color}: lane overlaps track`);
      if (allLaneCells.has(key(cell)))
        laneProblems.push(`${color}: lane overlaps lane`);
      allLaneCells.add(key(cell));
    }
    const entryGlobal =
      (geometry.startIndex[color] + TRACK_LENGTH - 1) % TRACK_LENGTH;
    const entry = track[entryGlobal];
    const first = lane[0];
    if (!entry || !first || stepKind(entry, first) !== 'orthogonal') {
      laneProblems.push(
        `${color}: lane not connected to entry cell ${entryGlobal}`
      );
    }
    for (let i = 0; i + 1 < lane.length; i++) {
      const a = lane[i];
      const b = lane[i + 1];
      if (!a || !b || stepKind(a, b) !== 'orthogonal') {
        laneProblems.push(`${color}: lane step ${i} not adjacent`);
      }
    }
    const last = lane[lane.length - 1];
    if (!last || !touchesRegion(last, geometry.centerRegion)) {
      laneProblems.push(`${color}: lane does not reach the centre`);
    }
  }
  add(
    'final_lanes_valid',
    laneProblems.length === 0,
    laneProblems.length === 0
      ? 'four lanes of 5 cells, connected'
      : laneProblems.join('; ')
  );

  // Per-colour journey: one complete loop then the lane, same length for all.
  const journeyProblems: string[] = [];
  const lengths = new Set<number>();
  for (const color of PLAYER_COLORS) {
    const path = pathCells(geometry, color);
    lengths.add(path.length);
    const trackPart = path.slice(0, TRACK_LENGTH);
    if (new Set(trackPart.map(key)).size !== TRACK_LENGTH) {
      journeyProblems.push(
        `${color}: does not visit all ${TRACK_LENGTH} track cells once`
      );
    }
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i];
      const b = path[i + 1];
      if (!a || !b || stepKind(a, b) === 'invalid') {
        journeyProblems.push(
          `${color}: teleport between step ${i} and ${i + 1}`
        );
      }
    }
  }
  add(
    'journeys_complete_and_equal',
    journeyProblems.length === 0 && lengths.size === 1,
    journeyProblems.length === 0
      ? `every colour visits ${[...lengths].join('/')} cells before the centre`
      : journeyProblems.join('; ')
  );

  return {passed: checks.every(c => c.passed), checks};
}

export const CLASSIC_BOARD_GEOMETRY: BoardGeometry = {
  gridSize: GRID_SIZE,
  trackCells: TRACK_CELLS,
  finalLanes: FINAL_LANE_CELLS,
  baseRegions: BASE_REGIONS,
  centerRegion: CENTER_REGION,
  startIndex: START_INDEX,
  armLength: ARM_LENGTH,
  finalLaneLength: FINAL_LANE_LENGTH,
};

/** Sanity helper: number of moves from base to finish (spawn + 57 steps). */
export const FULL_JOURNEY_STEPS = FINISH_POSITION + 1;
export {toGlobalTrackPosition};
