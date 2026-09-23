import type {SceneryDefinition, ThemeDefinition, ThemeId} from './types.ts';

const STONE = {base: '#ECE9E2', light: '#FFFFFF', dark: '#B5AFA4'};
const MARBLE = {base: '#D8D5CF', light: '#F2F0EC', ring: '#A8A39A'};

const SCENERY: Partial<Record<ThemeId, SceneryDefinition>> = {
  japan: {
    sky: ['#2A1B4D', '#B4527C', '#F4A45C'],
    sun: '#FFE0A8',
    landmark: 'fuji',
    hills: '#3A2547',
    water: '#6E4C7E',
    frame: {wood: '#5A3620', trim: '#C9A45C'},
    stone: STONE,
    safeCell: '#A7A39C',
    marble: MARBLE,
  },
};

/** Scenery of a theme; themes without a dedicated one get a neutral version of their palette. */
export function sceneryFor(theme: ThemeDefinition): SceneryDefinition {
  return (
    SCENERY[theme.id] ?? {
      sky: [
        theme.palette.background,
        theme.palette.surface,
        theme.palette.surfaceAlt,
      ],
      sun: null,
      landmark: null,
      hills: theme.palette.surface,
      water: null,
      frame: {wood: theme.palette.boardFrame, trim: theme.palette.accent},
      stone: STONE,
      safeCell: '#A7A39C',
      marble: MARBLE,
    }
  );
}
