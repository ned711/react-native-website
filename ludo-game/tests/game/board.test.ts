import {describe, expect, it} from 'vitest';
import {
  FINISH_POSITION,
  LAST_TRACK_POSITION,
  START_INDEX,
  TRACK_LENGTH,
  toGlobalTrackPosition,
  toRelativeTrackPosition,
} from '../../src/game/board/constants.ts';
import {
  BASE_REGIONS,
  FINAL_LANE_CELLS,
  TRACK_CELLS,
  cellForPawn,
  pointForPawn,
  regionContains,
} from '../../src/game/board/layout.ts';
import {
  CLASSIC_BOARD_GEOMETRY,
  pathCells,
  stepKind,
  validateBoard,
} from '../../src/game/board/validation.ts';
import {PLAYER_COLORS} from '../../src/game/types.ts';

const key = (c: {row: number; col: number}) => `${c.row},${c.col}`;

describe('board geometry', () => {
  it('passes every automatic validation check', () => {
    const report = validateBoard(CLASSIC_BOARD_GEOMETRY);
    for (const check of report.checks) {
      expect(check.passed, `${check.name}: ${check.details}`).toBe(true);
    }
    expect(report.passed).toBe(true);
  });

  it('has exactly 52 distinct common cells', () => {
    expect(TRACK_CELLS).toHaveLength(52);
    expect(new Set(TRACK_CELLS.map(key)).size).toBe(52);
  });

  it('walks 0 -> 1 -> ... -> 51 -> 0 as a closed loop without repeating a cell', () => {
    const visited = new Set<string>();
    let index = 0;
    for (let step = 0; step < TRACK_LENGTH; step++) {
      const cell = TRACK_CELLS[index];
      expect(cell, `cell ${index} exists`).toBeDefined();
      if (!cell) return;
      expect(visited.has(key(cell)), `cell ${index} not repeated`).toBe(false);
      visited.add(key(cell));
      const nextIndex = (index + 1) % TRACK_LENGTH;
      const next = TRACK_CELLS[nextIndex];
      if (!next) return;
      expect(
        stepKind(cell, next),
        `transition ${index}->${nextIndex}`
      ).not.toBe('invalid');
      index = nextIndex;
    }
    expect(index).toBe(0); // loop closed
    expect(visited.size).toBe(52);
  });

  it('places the four starts 13 cells apart, each next to its own base', () => {
    expect(START_INDEX).toEqual({green: 0, yellow: 13, blue: 26, red: 39});
    for (const color of PLAYER_COLORS) {
      const start = TRACK_CELLS[START_INDEX[color]];
      expect(start).toBeDefined();
      if (!start) return;
      const base = BASE_REGIONS[color];
      const neighbours = [
        {row: start.row - 1, col: start.col},
        {row: start.row + 1, col: start.col},
        {row: start.row, col: start.col - 1},
        {row: start.row, col: start.col + 1},
      ];
      expect(neighbours.some(n => regionContains(base, n))).toBe(true);
    }
  });

  it('maps relative track positions to global ones with wraparound', () => {
    expect(toGlobalTrackPosition('green', 0)).toBe(0);
    expect(toGlobalTrackPosition('green', 51)).toBe(51);
    expect(toGlobalTrackPosition('yellow', 0)).toBe(13);
    expect(toGlobalTrackPosition('yellow', 38)).toBe(51);
    expect(toGlobalTrackPosition('yellow', 39)).toBe(0);
    expect(toGlobalTrackPosition('red', 13)).toBe(0);
    expect(toGlobalTrackPosition('red', 51)).toBe(38);
    expect(toGlobalTrackPosition('blue', 52)).toBeNull();
    expect(toGlobalTrackPosition('blue', -1)).toBeNull();
    for (const color of PLAYER_COLORS) {
      for (let rel = 0; rel <= LAST_TRACK_POSITION; rel++) {
        const g = toGlobalTrackPosition(color, rel);
        expect(g).not.toBeNull();
        expect(toRelativeTrackPosition(color, g ?? -1)).toBe(rel);
      }
    }
  });

  it('makes every colour do exactly one full loop, then its lane, with no shortcut or teleport', () => {
    const lengths = new Set<number>();
    for (const color of PLAYER_COLORS) {
      const path = pathCells(CLASSIC_BOARD_GEOMETRY, color);
      // 52 track cells + 5 lane cells; the 58th position (57) is the centre.
      expect(path).toHaveLength(57);
      lengths.add(path.length);
      expect(new Set(path.slice(0, 52).map(key)).size).toBe(52);
      for (let i = 0; i + 1 < path.length; i++) {
        const a = path[i];
        const b = path[i + 1];
        if (!a || !b) throw new Error('missing cell');
        expect(stepKind(a, b), `${color} step ${i}`).not.toBe('invalid');
      }
      // Entry into the lane happens from relative 51 (the cell before the start).
      const entry = cellForPawn(color, 51);
      const firstLane = FINAL_LANE_CELLS[color][0];
      if (!entry || !firstLane) throw new Error('missing entry');
      expect(stepKind(entry, firstLane)).toBe('orthogonal');
    }
    expect(lengths.size).toBe(1);
  });

  it('keeps rendering positions consistent with the logical geometry', () => {
    for (const color of PLAYER_COLORS) {
      for (let pos = 0; pos <= 56; pos++) {
        const cell = cellForPawn(color, pos);
        const point = pointForPawn(color, pos, 0);
        expect(cell).not.toBeNull();
        if (!cell) return;
        expect(point).toEqual({y: cell.row + 0.5, x: cell.col + 0.5});
      }
      const finish = pointForPawn(color, FINISH_POSITION, 0);
      expect(finish.x).toBeGreaterThan(6);
      expect(finish.x).toBeLessThan(9);
      expect(finish.y).toBeGreaterThan(6);
      expect(finish.y).toBeLessThan(9);
      for (let pawn = 0; pawn < 4; pawn++) {
        const slot = pointForPawn(color, -1, pawn);
        const base = BASE_REGIONS[color];
        expect(slot.y).toBeGreaterThan(base.row);
        expect(slot.y).toBeLessThan(base.row + base.size);
      }
    }
  });

  it('detects a broken geometry (duplicated cell / teleport)', () => {
    const broken = [...TRACK_CELLS];
    broken[10] = broken[20] ?? {row: 0, col: 0};
    const report = validateBoard({
      ...CLASSIC_BOARD_GEOMETRY,
      trackCells: broken,
    });
    expect(report.passed).toBe(false);
    const failed = report.checks.filter(c => !c.passed).map(c => c.name);
    expect(failed).toContain('track_unique');
    expect(failed).toContain('track_closed_loop_adjacency');
  });
});
