import {placeholder} from '../content/assets.ts';
import type {ThemeDefinition, ThemeId, ThemePalette} from './types.ts';

const CLASSIC_PLAYERS: ThemePalette['players'] = {
  green: {main: '#2E9E4F', light: '#8FD9A4', dark: '#1B6332'},
  yellow: {main: '#E8B923', light: '#F7E08A', dark: '#9C7A0C'},
  blue: {main: '#2F6FD6', light: '#9CBEF2', dark: '#1B4389'},
  red: {main: '#D8383A', light: '#F2A0A1', dark: '#8E1F21'},
};

function theme(
  id: ThemeId,
  displayName: string,
  palette: Omit<ThemePalette, 'players'> & {players?: ThemePalette['players']}
): ThemeDefinition {
  return {
    id,
    nameKey: `theme.${id}`,
    displayName,
    palette: {players: CLASSIC_PLAYERS, ...palette},
    environmentId: id,
    audioPackId: id,
    boardArt: placeholder('texture', `board.${id}`),
    music: placeholder('music', `music.${id}`),
  };
}

/** Palettes are real and rendered; art and music are placeholders. */
export const THEMES: readonly ThemeDefinition[] = [
  theme('classic', 'Classique', {
    background: '#14213D',
    surface: '#1F2E52',
    surfaceAlt: '#2A3D66',
    boardFrame: '#E5E5E5',
    boardCell: '#FFFFFF',
    boardLine: '#9AA5B1',
    safeMark: '#7B8794',
    text: '#FFFFFF',
    textMuted: '#B8C2CC',
    accent: '#FCA311',
  }),
  theme('japan', 'Japon féodal', {
    background: '#1B0F0A',
    surface: '#2B1810',
    surfaceAlt: '#3D2418',
    boardFrame: '#6B1E1E',
    boardCell: '#F4E9D8',
    boardLine: '#8C6D4F',
    safeMark: '#C2185B',
    text: '#F4E9D8',
    textMuted: '#C8B79E',
    accent: '#E0457B',
    players: {
      green: {main: '#3E7C4A', light: '#A8D5B0', dark: '#234A2B'},
      yellow: {main: '#D9A441', light: '#F2D79B', dark: '#8A6320'},
      blue: {main: '#2B4C7E', light: '#98B2D8', dark: '#172B49'},
      red: {main: '#B22E2E', light: '#E8A0A0', dark: '#6E1616'},
    },
  }),
  theme('egypt', 'Égypte antique', {
    background: '#2A1D0C',
    surface: '#3B2A12',
    surfaceAlt: '#4E3818',
    boardFrame: '#B8860B',
    boardCell: '#F3E3C0',
    boardLine: '#A67C3D',
    safeMark: '#1F7A8C',
    text: '#FDF1D6',
    textMuted: '#D9C49A',
    accent: '#E3B23C',
  }),
  theme('china', 'Chine impériale', {
    background: '#1A0707',
    surface: '#2E0D0D',
    surfaceAlt: '#451414',
    boardFrame: '#C9A227',
    boardCell: '#FFF4E0',
    boardLine: '#B0463C',
    safeMark: '#2E8B57',
    text: '#FFF4E0',
    textMuted: '#E0C4A8',
    accent: '#E53935',
  }),
  theme('india', 'Inde', {
    background: '#1F0B26',
    surface: '#321040',
    surfaceAlt: '#46185A',
    boardFrame: '#FF9933',
    boardCell: '#FFF8E7',
    boardLine: '#B5651D',
    safeMark: '#138808',
    text: '#FFF8E7',
    textMuted: '#E2C9E8',
    accent: '#FF9933',
  }),
  theme('italy', 'Italie', {
    background: '#10231A',
    surface: '#1C3A2B',
    surfaceAlt: '#27503B',
    boardFrame: '#C1440E',
    boardCell: '#FBF7EF',
    boardLine: '#8D6E63',
    safeMark: '#009246',
    text: '#FBF7EF',
    textMuted: '#C8D8CC',
    accent: '#CE2B37',
  }),
  theme('russia', 'Russie', {
    background: '#0B1A2E',
    surface: '#142B4A',
    surfaceAlt: '#1D3B63',
    boardFrame: '#D4AF37',
    boardCell: '#F7F9FC',
    boardLine: '#7F8FA6',
    safeMark: '#0039A6',
    text: '#F7F9FC',
    textMuted: '#B9C6DA',
    accent: '#D52B1E',
  }),
  theme('france', 'France', {
    background: '#0F1B33',
    surface: '#1A2B4F',
    surfaceAlt: '#253B69',
    boardFrame: '#C9B037',
    boardCell: '#FFFFFF',
    boardLine: '#8391A7',
    safeMark: '#0055A4',
    text: '#FFFFFF',
    textMuted: '#C0CAE0',
    accent: '#EF4135',
  }),
  theme('algeria', 'Algérie', {
    background: '#0D2016',
    surface: '#163524',
    surfaceAlt: '#1F4A32',
    boardFrame: '#D2B48C',
    boardCell: '#FFFDF6',
    boardLine: '#9C7B55',
    safeMark: '#D21034',
    text: '#FFFDF6',
    textMuted: '#C5D9CB',
    accent: '#006233',
  }),
];

export const DEFAULT_THEME_ID: ThemeId = 'japan';

export function getTheme(id: string): ThemeDefinition {
  const found = THEMES.find(t => t.id === id);
  const fallback = THEMES.find(t => t.id === 'classic');
  if (found) return found;
  if (!fallback) throw new Error('classic theme missing');
  return fallback;
}
