import type {AssetRef} from '../content/assets.ts';
import type {PlayerColor} from '../game/types.ts';

export type ThemeId =
  | 'classic'
  | 'japan'
  | 'egypt'
  | 'china'
  | 'india'
  | 'italy'
  | 'russia'
  | 'france'
  | 'algeria';

export interface ColorSet {
  readonly main: string;
  readonly light: string;
  readonly dark: string;
}

export interface ThemePalette {
  readonly background: string;
  readonly surface: string;
  readonly surfaceAlt: string;
  readonly boardFrame: string;
  readonly boardCell: string;
  readonly boardLine: string;
  readonly safeMark: string;
  readonly text: string;
  readonly textMuted: string;
  readonly accent: string;
  readonly players: Readonly<Record<PlayerColor, ColorSet>>;
}

export interface ThemeDefinition {
  readonly id: ThemeId;
  readonly nameKey: string;
  readonly displayName: string;
  readonly palette: ThemePalette;
  readonly environmentId: string;
  readonly audioPackId: string;
  readonly boardArt: AssetRef;
  readonly music: AssetRef;
}
