import {placeholder, type AssetRef, type Rarity} from './assets.ts';
import type {ThemeId} from '../themes/types.ts';

/**
 * Dice skins are purely visual. There is deliberately NO field here that the
 * engine or the dice roller reads: probabilities cannot depend on a skin.
 */
export interface DiceDefinition {
  readonly id: string;
  readonly name: string;
  readonly themeId: ThemeId;
  readonly rarity: Rarity;
  readonly faceColor: string;
  readonly pipColor: string;
  readonly edgeColor: string;
  readonly model3D: AssetRef;
  readonly rollAnimation: AssetRef;
  /** Optional special effect per face value (e.g. petals on a 6). */
  readonly resultEffects: Readonly<
    Partial<Record<1 | 2 | 3 | 4 | 5 | 6, AssetRef>>
  >;
  readonly soundPackId: string;
}

function dice(
  id: string,
  name: string,
  themeId: ThemeId,
  rarity: Rarity,
  colors: {face: string; pip: string; edge: string},
  sixEffect = false
): DiceDefinition {
  return {
    id,
    name,
    themeId,
    rarity,
    faceColor: colors.face,
    pipColor: colors.pip,
    edgeColor: colors.edge,
    model3D: placeholder('model3d', `dice.${id}`),
    rollAnimation: placeholder('animation', `dice.${id}.roll`),
    resultEffects: sixEffect
      ? {6: placeholder('particles', `dice.${id}.six`)}
      : {},
    soundPackId: themeId,
  };
}

export const CLASSIC_DICE_ID = 'classic_dice';

export const DICE: readonly DiceDefinition[] = [
  dice(CLASSIC_DICE_ID, 'Dé classique', 'classic', 'common', {
    face: '#FFFFFF',
    pip: '#111111',
    edge: '#D0D0D0',
  }),
  dice(
    'sakura_dice',
    'Dé Sakura',
    'japan',
    'rare',
    {face: '#FCE4EC', pip: '#AD1457', edge: '#F48FB1'},
    true
  ),
  dice(
    'shogun_dice',
    'Dé Shogun',
    'japan',
    'epic',
    {face: '#1C1C1C', pip: '#D4AF37', edge: '#8B0000'},
    true
  ),
  dice('katana_dice', 'Dé Katana', 'japan', 'rare', {
    face: '#ECEFF1',
    pip: '#263238',
    edge: '#90A4AE',
  }),
  dice(
    'dragon_dice_japan',
    'Dé Dragon',
    'japan',
    'legendary',
    {face: '#1B5E20', pip: '#FFD54F', edge: '#004D40'},
    true
  ),
  dice('stone_dice', 'Dé de pierre', 'egypt', 'common', {
    face: '#D7CCC8',
    pip: '#4E342E',
    edge: '#A1887F',
  }),
  dice(
    'gold_dice',
    "Dé d'or",
    'egypt',
    'epic',
    {face: '#FFD54F', pip: '#3E2723', edge: '#FFA000'},
    true
  ),
  dice('hieroglyph_dice', 'Dé hiéroglyphes', 'egypt', 'rare', {
    face: '#F3E3C0',
    pip: '#1F7A8C',
    edge: '#B8860B',
  }),
  dice(
    'anubis_dice',
    'Dé Anubis',
    'egypt',
    'legendary',
    {face: '#212121', pip: '#FFC107', edge: '#FFB300'},
    true
  ),
  dice('jade_dice', 'Dé de jade', 'china', 'rare', {
    face: '#A5D6A7',
    pip: '#1B5E20',
    edge: '#66BB6A',
  }),
  dice('red_gold_dice', 'Dé rouge et or', 'china', 'epic', {
    face: '#C62828',
    pip: '#FFD54F',
    edge: '#8E0000',
  }),
  dice(
    'dragon_dice_china',
    'Dé Dragon impérial',
    'china',
    'legendary',
    {face: '#B71C1C', pip: '#FFEB3B', edge: '#FFD600'},
    true
  ),
];

export function getDice(id: string): DiceDefinition {
  const found = DICE.find(d => d.id === id) ?? DICE[0];
  if (!found) throw new Error('no dice defined');
  return found;
}
