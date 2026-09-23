import {placeholder, type AssetRef, type Rarity} from './assets.ts';

/** Social gifts: purely cosmetic, they never affect gameplay. */
export interface GiftDefinition {
  readonly id: string;
  readonly name: string;
  readonly rarity: Rarity;
  readonly model3D: AssetRef;
  readonly animation: AssetRef;
  readonly sound: AssetRef;
  /** Description of the intended 3D animation beats, for the animation team. */
  readonly beats: readonly string[];
  readonly durationMs: number;
  /** 2D fallback symbol shown while the 3D model is a placeholder. */
  readonly fallbackGlyph: string;
}

function gift(
  id: string,
  name: string,
  rarity: Rarity,
  glyph: string,
  beats: string[],
  durationMs = 2500
): GiftDefinition {
  return {
    id,
    name,
    rarity,
    beats,
    durationMs,
    fallbackGlyph: glyph,
    model3D: placeholder('model3d', `gift.${id}`),
    animation: placeholder('animation', `gift.${id}`),
    sound: placeholder('sfx', `gift.${id}`),
  };
}

export const GIFTS: readonly GiftDefinition[] = [
  gift('rose', 'Rose', 'common', '🌹', ['appear', 'bloom', 'petals']),
  gift('bouquet', 'Bouquet', 'rare', '💐', ['appear', 'unwrap', 'petals']),
  gift('heart', 'Cœur', 'common', '❤️', ['pop', 'pulse']),
  gift('coffee', 'Café', 'common', '☕', ['cup_appears', 'steam']),
  gift('beer', 'Bière', 'common', '🍺', ['glass_appears', 'foam', 'toast']),
  gift('cocktail', 'Cocktail', 'rare', '🍹', [
    'glass_appears',
    'shake',
    'sparkle',
  ]),
  gift('cake', 'Gâteau', 'rare', '🎂', ['cake_appears', 'candles', 'light']),
  gift('chocolate', 'Chocolat', 'common', '🍫', ['box_appears', 'open']),
  gift('gift_box', 'Cadeau', 'rare', '🎁', [
    'box_appears',
    'open',
    'particles',
  ]),
  gift(
    'sakura',
    'Sakura',
    'epic',
    '🌸',
    ['branch_grows', 'blossom', 'petal_rain'],
    3500
  ),
  gift('toast', 'Toast', 'common', '🥂', ['glasses_clink', 'sparkle']),
  gift('star', 'Étoile', 'rare', '⭐', ['rise', 'shine']),
  gift('crown', 'Couronne', 'epic', '👑', ['descend', 'shine'], 3000),
  gift(
    'diamond',
    'Diamant',
    'legendary',
    '💎',
    ['spin', 'refract', 'sparkle'],
    4000
  ),
];

export function findGift(id: string): GiftDefinition | undefined {
  return GIFTS.find(g => g.id === id);
}
