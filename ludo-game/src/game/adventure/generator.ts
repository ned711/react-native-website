/**
 * Seeded Adventure board generation with fair-play constraints.
 *
 * Fairness by construction: a pattern is drawn for ONE quarter of the board
 * (offsets 0..12 relative to a start cell) and copied to the four quarters.
 * Every colour therefore meets exactly the same events at the same distance
 * from its own start. Additional constraints:
 *  - no event on safe cells (starts and stars);
 *  - no event in the first `startBuffer` cells after a start;
 *  - no event on the last cell of a quarter (a colour's lane entry cell);
 *  - at least `minSpacing` empty cells between two events;
 *  - equal number of positive and negative events.
 */
import {ARM_LENGTH, START_INDEX} from '../board/constants.ts';
import {STAR_OFFSET_IN_ARM} from '../rules/defaults.ts';
import {
  PLAYER_COLORS,
  type AdventureBoard,
  type AdventureCell,
} from '../types.ts';
import {
  createSeededRandom,
  pickWeighted,
  randomBelow,
  randomInt,
  type RandomSource,
} from '../../utils/random.ts';
import {
  ADVENTURE_EVENT_DEFINITIONS,
  type AdventurePolarity,
} from './definitions.ts';

export const ADVENTURE_GENERATOR_VERSION = 1;
export const ADVENTURE_SEED_PATTERN = /^LUDO-\d{6}$/;

export interface AdventureGenerationOptions {
  /** Must be even: half positive, half negative. */
  readonly eventsPerQuarter: number;
  readonly startBuffer: number;
  readonly minSpacing: number;
}

export const DEFAULT_ADVENTURE_OPTIONS: AdventureGenerationOptions = {
  eventsPerQuarter: 4,
  startBuffer: 2,
  minSpacing: 1,
};

export function createAdventureSeed(source: RandomSource): string {
  return `LUDO-${randomInt(source, 100000, 999999)}`;
}

export function isValidAdventureSeed(seed: string): boolean {
  return ADVENTURE_SEED_PATTERN.test(seed);
}

/** Offsets (0..12) inside a quarter where an event may be placed. */
export function candidateOffsets(
  options: AdventureGenerationOptions
): number[] {
  const offsets: number[] = [];
  for (let offset = 0; offset < ARM_LENGTH; offset++) {
    if (offset <= options.startBuffer) continue;
    if (offset === STAR_OFFSET_IN_ARM) continue;
    if (offset === ARM_LENGTH - 1) continue;
    offsets.push(offset);
  }
  return offsets;
}

function chooseOffsets(
  source: RandomSource,
  candidates: readonly number[],
  count: number,
  minSpacing: number
): number[] | null {
  // Random order, greedy selection respecting spacing; retried by the caller.
  const pool = [...candidates];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomBelow(source, i + 1);
    const tmp = pool[i] as number;
    pool[i] = pool[j] as number;
    pool[j] = tmp;
  }
  const chosen: number[] = [];
  for (const offset of pool) {
    if (chosen.every(c => Math.abs(c - offset) > minSpacing))
      chosen.push(offset);
    if (chosen.length === count) return chosen.sort((a, b) => a - b);
  }
  return null;
}

export function generateAdventureBoard(
  seed: string,
  options: AdventureGenerationOptions = DEFAULT_ADVENTURE_OPTIONS
): AdventureBoard {
  if (!isValidAdventureSeed(seed)) {
    throw new RangeError(`Invalid adventure seed "${seed}"`);
  }
  if (options.eventsPerQuarter % 2 !== 0 || options.eventsPerQuarter < 2) {
    throw new RangeError('eventsPerQuarter must be an even number >= 2');
  }
  const source = createSeededRandom(
    `${seed}:adventure:v${ADVENTURE_GENERATOR_VERSION}`
  );
  const candidates = candidateOffsets(options);

  let offsets: number[] | null = null;
  for (let attempt = 0; attempt < 64 && !offsets; attempt++) {
    offsets = chooseOffsets(
      source,
      candidates,
      options.eventsPerQuarter,
      options.minSpacing
    );
  }
  if (!offsets) {
    throw new RangeError('Adventure constraints cannot be satisfied');
  }

  const polarities: AdventurePolarity[] = [];
  for (let i = 0; i < options.eventsPerQuarter / 2; i++)
    polarities.push('positive', 'negative');
  for (let i = polarities.length - 1; i > 0; i--) {
    const j = randomBelow(source, i + 1);
    const tmp = polarities[i] as AdventurePolarity;
    polarities[i] = polarities[j] as AdventurePolarity;
    polarities[j] = tmp;
  }

  const pattern = offsets.map((offset, i) => {
    const polarity = polarities[i] as AdventurePolarity;
    const def = pickWeighted(
      source,
      ADVENTURE_EVENT_DEFINITIONS.filter(d => d.polarity === polarity).map(
        d => ({
          item: d,
          weight: d.weight,
        })
      )
    );
    const magnitude =
      def.magnitudes[randomBelow(source, def.magnitudes.length)] ?? 1;
    return {offset, kind: def.kind, magnitude};
  });

  const cells: AdventureCell[] = [];
  for (const color of PLAYER_COLORS) {
    for (const p of pattern) {
      cells.push({
        trackPosition: START_INDEX[color] + p.offset,
        kind: p.kind,
        magnitude: p.magnitude,
      });
    }
  }
  cells.sort((a, b) => a.trackPosition - b.trackPosition);
  return {seed, generatorVersion: ADVENTURE_GENERATOR_VERSION, cells};
}

export function adventureCellAt(
  board: AdventureBoard | null,
  trackPosition: number
): AdventureCell | null {
  return board?.cells.find(c => c.trackPosition === trackPosition) ?? null;
}
