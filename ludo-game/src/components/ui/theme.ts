import {useSettings} from '../../state/settings.tsx';
import {getTheme} from '../../themes/themes.ts';
import type {ThemeDefinition} from '../../themes/types.ts';

/** Active UI theme (chrome colours follow the selected board theme). */
export function useActiveTheme(): ThemeDefinition {
  const {settings} = useSettings();
  return getTheme(settings.themeId);
}

export const GOLD = '#D4AF37';
export const RADIUS = 14;
export const SPACING = 12;
