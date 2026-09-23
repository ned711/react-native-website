import type {AdventureEventKind} from '../types.ts';

export type AdventurePolarity = 'positive' | 'negative';

export interface AdventureEventDefinition {
  readonly kind: AdventureEventKind;
  readonly polarity: AdventurePolarity;
  /** Relative draw weight inside its polarity group. */
  readonly weight: number;
  /** Candidate magnitudes (turns skipped, steps, treasure units...). */
  readonly magnitudes: readonly number[];
  readonly labelKey: string;
}

/**
 * Data-driven catalogue. Adding an event kind only requires a new entry here
 * plus its effect in `effects.ts`.
 */
export const ADVENTURE_EVENT_DEFINITIONS: readonly AdventureEventDefinition[] =
  [
    {
      kind: 'prison',
      polarity: 'negative',
      weight: 2,
      magnitudes: [2],
      labelKey: 'adventure.prison',
    },
    {
      kind: 'freeze',
      polarity: 'negative',
      weight: 3,
      magnitudes: [1],
      labelKey: 'adventure.freeze',
    },
    {
      kind: 'backward',
      polarity: 'negative',
      weight: 4,
      magnitudes: [2, 3, 4],
      labelKey: 'adventure.backward',
    },
    {
      kind: 'boost',
      polarity: 'positive',
      weight: 3,
      magnitudes: [2, 3],
      labelKey: 'adventure.boost',
    },
    {
      kind: 'teleport',
      polarity: 'positive',
      weight: 1,
      magnitudes: [5, 6],
      labelKey: 'adventure.teleport',
    },
    {
      kind: 'treasure',
      polarity: 'positive',
      weight: 2,
      magnitudes: [1, 2, 3],
      labelKey: 'adventure.treasure',
    },
    {
      kind: 'shield',
      polarity: 'positive',
      weight: 2,
      magnitudes: [1],
      labelKey: 'adventure.shield',
    },
    {
      kind: 'bonus_turn',
      polarity: 'positive',
      weight: 2,
      magnitudes: [1],
      labelKey: 'adventure.bonus_turn',
    },
  ];

export function definitionFor(
  kind: AdventureEventKind
): AdventureEventDefinition {
  const def = ADVENTURE_EVENT_DEFINITIONS.find(d => d.kind === kind);
  if (!def) throw new RangeError(`Unknown adventure event ${kind}`);
  return def;
}
