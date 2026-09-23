import {placeholder, type AssetRef, type Rarity} from './assets.ts';
import type {ThemeId} from '../themes/types.ts';

export type CharacterAnimationSlot =
  | 'idle'
  | 'move'
  | 'spawn'
  | 'capture'
  | 'returnHome'
  | 'enterFinalLane'
  | 'finish'
  | 'victory';

export interface CharacterDefinition {
  readonly id: string;
  readonly themeId: ThemeId;
  readonly displayName: string;
  readonly rarity: Rarity;
  readonly model3D: AssetRef;
  readonly animations: Readonly<Record<CharacterAnimationSlot, AssetRef>>;
  /** Ordered beats of the capture cinematic (descriptive, played by the resolver). */
  readonly captureSequence: readonly string[];
  /** Short symbol drawn by the 2D fallback renderer while the 3D model is missing. */
  readonly glyph: string;
}

const SLOTS: readonly CharacterAnimationSlot[] = [
  'idle',
  'move',
  'spawn',
  'capture',
  'returnHome',
  'enterFinalLane',
  'finish',
  'victory',
];

function character(
  id: string,
  themeId: ThemeId,
  displayName: string,
  rarity: Rarity,
  glyph: string,
  captureSequence: readonly string[] = ['strike']
): CharacterDefinition {
  const animations = {} as Record<CharacterAnimationSlot, AssetRef>;
  for (const slot of SLOTS)
    animations[slot] = placeholder('animation', `character.${id}.${slot}`);
  return {
    id,
    themeId,
    displayName,
    rarity,
    glyph,
    captureSequence,
    model3D: placeholder('model3d', `character.${id}`),
    animations,
  };
}

export const CLASSIC_PAWN_ID = 'classic_pawn';

export const CHARACTERS: readonly CharacterDefinition[] = [
  character(CLASSIC_PAWN_ID, 'classic', 'Pion classique', 'common', '●'),
  character('samurai', 'japan', 'Samouraï', 'epic', '侍', [
    'combat_stance',
    'hand_on_katana',
    'draw_katana',
    'slash',
    'impact_effect',
    'victim_returns_home',
  ]),
  character('ninja', 'japan', 'Ninja', 'rare', '忍', [
    'vanish',
    'reappear_behind',
    'strike',
    'smoke',
  ]),
  character('daimyo', 'japan', 'Daimyo', 'legendary', '大', [
    'command',
    'banner_wave',
    'strike',
  ]),
  character('oni', 'japan', 'Oni', 'epic', '鬼', [
    'roar',
    'club_smash',
    'shockwave',
  ]),
  character('japan_dragon', 'japan', 'Dragon', 'legendary', '龍', [
    'coil',
    'breath',
    'impact_effect',
  ]),
  character('osiris', 'egypt', 'Osiris', 'legendary', '𓁹', [
    'raise_sceptre',
    'mystic_energy',
    'impact',
    'victim_returns_home',
  ]),
  character('anubis', 'egypt', 'Anubis', 'epic', '𓃣', ['staff_spin', 'strike']),
  character('horus', 'egypt', 'Horus', 'epic', '𓅃', [
    'wings_spread',
    'dive',
    'strike',
  ]),
  character('pharaoh', 'egypt', 'Pharaon', 'rare', '𓋹', ['command', 'strike']),
  character('egyptian_warrior', 'egypt', 'Guerrier égyptien', 'common', '𓌳'),
  character('jade_general', 'china', 'Général de jade', 'epic', '将'),
  character('lion_dancer', 'china', 'Danseur du lion', 'rare', '獅'),
  character('maharaja', 'india', 'Maharaja', 'epic', '♛'),
  character('bengal_tiger', 'india', 'Tigre du Bengale', 'rare', '🐅'),
  character('gladiator', 'italy', 'Gladiateur', 'epic', '⚔'),
  character('gondolier', 'italy', 'Gondolier', 'common', '⛵'),
  character('bogatyr', 'russia', 'Bogatyr', 'epic', '🛡'),
  character('firebird', 'russia', 'Oiseau de feu', 'legendary', '🔥'),
  character('musketeer', 'france', 'Mousquetaire', 'epic', '⚜'),
  character('knight', 'france', 'Chevalier', 'rare', '♞'),
  character('amazigh_warrior', 'algeria', 'Guerrier amazigh', 'epic', 'ⵣ'),
  character('desert_nomad', 'algeria', 'Nomade du désert', 'rare', '☀'),
];

export function getCharacter(id: string): CharacterDefinition {
  const found = CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];
  if (!found) throw new Error('no character defined');
  return found;
}
