import type {Rarity} from '../content/assets.ts';
import {CHARACTERS, CLASSIC_PAWN_ID} from '../content/characters.ts';
import {CLASSIC_DICE_ID, DICE} from '../content/dice.ts';
import {GIFTS} from '../content/gifts.ts';
import type {Price} from '../economy/config.ts';
import {THEMES} from '../themes/themes.ts';
import type {ThemeId} from '../themes/types.ts';

export type ItemCategory =
  | 'character'
  | 'dice'
  | 'board'
  | 'frame'
  | 'effect'
  | 'title'
  | 'gift'
  | 'decoration';

export type Acquisition = 'default' | 'free' | 'premium' | 'event';

export interface CatalogItem {
  readonly id: string;
  readonly category: ItemCategory;
  readonly themeId: ThemeId | null;
  readonly name: string;
  readonly rarity: Rarity;
  readonly acquisition: Acquisition;
  /** null = price not decided yet (never invented client-side). */
  readonly price: Price | null;
}

export const DEFAULT_ITEM_IDS = [
  CLASSIC_PAWN_ID,
  CLASSIC_DICE_ID,
  'board_classic',
] as const;

export const CATALOG: readonly CatalogItem[] = [
  ...CHARACTERS.map(c => ({
    id: c.id,
    category: 'character' as const,
    themeId: c.themeId,
    name: c.displayName,
    rarity: c.rarity,
    acquisition:
      c.id === CLASSIC_PAWN_ID ? ('default' as const) : ('free' as const),
    price: null,
  })),
  ...DICE.map(d => ({
    id: d.id,
    category: 'dice' as const,
    themeId: d.themeId,
    name: d.name,
    rarity: d.rarity,
    acquisition:
      d.id === CLASSIC_DICE_ID ? ('default' as const) : ('free' as const),
    price: null,
  })),
  ...THEMES.map(t => ({
    id: `board_${t.id}`,
    category: 'board' as const,
    themeId: t.id,
    name: `Plateau ${t.displayName}`,
    rarity: t.id === 'classic' ? ('common' as const) : ('rare' as const),
    acquisition: t.id === 'classic' ? ('default' as const) : ('free' as const),
    price: null,
  })),
  ...GIFTS.map(g => ({
    id: `gift_${g.id}`,
    category: 'gift' as const,
    themeId: null,
    name: g.name,
    rarity: g.rarity,
    acquisition: 'free' as const,
    price: null,
  })),
];

export function findItem(id: string): CatalogItem | undefined {
  return CATALOG.find(i => i.id === id);
}
