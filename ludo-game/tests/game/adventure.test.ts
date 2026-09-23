import {describe, expect, it} from 'vitest';
import {
  ADVENTURE_EVENT_DEFINITIONS,
  DEFAULT_SAFE_TRACK_POSITIONS,
  PLAYER_COLORS,
  START_INDEX,
  createAdventureSeed,
  definitionFor,
  generateAdventureBoard,
  isValidAdventureSeed,
  toGlobalTrackPosition,
  type AdventureBoard,
} from '../../src/game/index.ts';
import {createSeededRandom} from '../../src/utils/random.ts';
import {move, newGame, roll, types, withPawns} from './helpers.ts';
import {simulate} from './simulate.ts';

function seeds(n: number): string[] {
  const rng = createSeededRandom('adventure-seeds');
  return Array.from({length: n}, () => createAdventureSeed(rng));
}

describe('adventure board generation', () => {
  it('creates seeds in the LUDO-XXXXXX format', () => {
    for (const seed of seeds(50)) expect(isValidAdventureSeed(seed)).toBe(true);
    expect(isValidAdventureSeed('LUDO-12')).toBe(false);
    expect(() => generateAdventureBoard('nope')).toThrow();
  });

  it('is deterministic: same seed -> same board', () => {
    expect(generateAdventureBoard('LUDO-847291')).toEqual(
      generateAdventureBoard('LUDO-847291')
    );
    const distinct = new Set(
      seeds(30).map(s => JSON.stringify(generateAdventureBoard(s).cells))
    );
    expect(distinct.size).toBeGreaterThan(20);
  });

  it('respects fair-play constraints for many seeds', () => {
    for (const seed of seeds(300)) {
      const board = generateAdventureBoard(seed);
      const positions = board.cells.map(c => c.trackPosition);
      expect(new Set(positions).size).toBe(positions.length);
      for (const cell of board.cells) {
        expect(DEFAULT_SAFE_TRACK_POSITIONS).not.toContain(cell.trackPosition);
        const offset = cell.trackPosition % 13;
        expect(offset).toBeGreaterThan(2); // start buffer
        expect(offset).not.toBe(12); // lane entry cell of the previous colour
      }
      const positives = board.cells.filter(
        c => definitionFor(c.kind).polarity === 'positive'
      ).length;
      expect(positives * 2).toBe(board.cells.length);

      // Every colour meets exactly the same sequence relative to its start.
      const sequences = PLAYER_COLORS.map(color =>
        Array.from({length: 52}, (_, rel) => {
          const g = toGlobalTrackPosition(color, rel);
          const cell = board.cells.find(c => c.trackPosition === g);
          return cell ? `${rel}:${cell.kind}:${cell.magnitude}` : null;
        })
          .filter(Boolean)
          .join('|')
      );
      expect(new Set(sequences).size).toBe(1);
    }
  });

  it('only uses catalogued event kinds', () => {
    const kinds = new Set(ADVENTURE_EVENT_DEFINITIONS.map(d => d.kind));
    for (const seed of seeds(50)) {
      for (const cell of generateAdventureBoard(seed).cells)
        expect(kinds.has(cell.kind)).toBe(true);
    }
  });
});

function boardWith(
  kind: AdventureBoard['cells'][number]['kind'],
  magnitude: number,
  at: number
): AdventureBoard {
  return {
    seed: 'LUDO-000000',
    generatorVersion: 1,
    cells: [{trackPosition: at, kind, magnitude}],
  };
}

describe('adventure effects', () => {
  it('backward moves the pawn back along its own path', () => {
    const s = withPawns(
      newGame('2p', {adventure: boardWith('backward', 3, 7)}),
      {green: [5, -1, -1, -1]}
    );
    const m = move(roll(s, 2).state, 0);
    expect(m.state.pawns.green[0]).toBe(4);
    const ev = m.events.find(e => e.type === 'ADVENTURE_EVENT_TRIGGERED');
    expect(ev?.payload).toMatchObject({kind: 'backward', from: 7, to: 4});
  });

  it('boost never goes past the lane entry and can capture', () => {
    // blue rel 36 -> global 10
    const s = withPawns(newGame('2p', {adventure: boardWith('boost', 3, 7)}), {
      green: [5, -1, -1, -1],
      blue: [36, -1, -1, -1],
    });
    const m = move(roll(s, 2).state, 0);
    expect(m.state.pawns.green[0]).toBe(10);
    expect(m.state.pawns.blue[0]).toBe(-1);
    expect(types(m.events)).toContain('PAWN_CAPTURED');

    const edge = withPawns(
      newGame('2p', {adventure: boardWith('boost', 3, 50)}),
      {green: [48, -1, -1, -1]}
    );
    expect(move(roll(edge, 2).state, 0).state.pawns.green[0]).toBe(51);
  });

  it('prison makes the player skip turns', () => {
    const s = withPawns(newGame('2p', {adventure: boardWith('prison', 2, 7)}), {
      green: [5, -1, -1, -1],
    });
    let st = move(roll(s, 2).state, 0).state;
    expect(st.players.find(p => p.color === 'green')?.skipTurns).toBe(2);
    expect(st.currentColor).toBe('blue');
    const r1 = roll(st, 1); // blue cannot move; green skipped once, blue again
    expect(types(r1.events)).toEqual([
      'DICE_ROLLED',
      'NO_LEGAL_MOVE',
      'TURN_SKIPPED',
      'TURN_STARTED',
    ]);
    st = r1.state;
    expect(st.currentColor).toBe('blue');
    st = roll(st, 1).state;
    expect(st.currentColor).toBe('blue');
    st = roll(st, 1).state;
    expect(st.currentColor).toBe('green');
  });

  it('shield blocks one capture then disappears', () => {
    const s = withPawns(newGame('2p', {adventure: boardWith('shield', 1, 7)}), {
      green: [5, -1, -1, -1],
    });
    let st = move(roll(s, 2).state, 0).state;
    expect(st.shields.green[0]).toBe(true);
    // blue rel 33 -> global 7. blue at rel 31 rolls 2.
    st = withPawns(st, {blue: [31, -1, -1, -1]});
    const hit = move(roll(st, 2).state, 0);
    expect(types(hit.events)).toContain('CAPTURE_BLOCKED_BY_SHIELD');
    expect(hit.state.pawns.green[0]).toBe(7);
    expect(hit.state.shields.green[0]).toBe(false);
  });

  it('treasure and bonus turn', () => {
    const t = withPawns(
      newGame('2p', {adventure: boardWith('treasure', 2, 7)}),
      {green: [5, -1, -1, -1]}
    );
    expect(move(roll(t, 2).state, 0).state.players[0]?.treasure).toBe(2);
    const b = withPawns(
      newGame('2p', {adventure: boardWith('bonus_turn', 1, 7)}),
      {green: [5, -1, -1, -1]}
    );
    const m = move(roll(b, 2).state, 0);
    expect(m.state.currentColor).toBe('green');
    expect(
      m.events.find(e => e.type === 'EXTRA_TURN_GRANTED')?.payload
    ).toEqual({reasons: ['bonus']});
  });

  it('full adventure games terminate and never break invariants', () => {
    for (const seed of seeds(15)) {
      const sim = simulate(
        seed,
        '4p',
        ['normal', 'hard', 'easy', 'normal'],
        'all_players',
        generateAdventureBoard(seed)
      );
      expect(sim.final.phase.kind).toBe('finished');
      expect(START_INDEX.green).toBe(0);
    }
  });
});
