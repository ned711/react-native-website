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

/**
 * Visual style of the board and of the code-drawn scenery. Purely cosmetic:
 * nothing here is read by the engine. Painted illustrations will replace the
 * code-drawn landmark when the assets listed in docs/ASSETS.md are delivered.
 */
export interface SceneryDefinition {
  /** Sky gradient, top to horizon. */
  readonly sky: readonly [string, string, string];
  readonly sun: string | null;
  /** Code-drawn landmark silhouette (placeholder for the painted bg_mid). */
  readonly landmark: 'fuji' | null;
  readonly hills: string;
  readonly water: string | null;
  readonly frame: {readonly wood: string; readonly trim: string};
  readonly stone: {
    readonly base: string;
    readonly light: string;
    readonly dark: string;
  };
  readonly safeCell: string;
  readonly marble: {
    readonly base: string;
    readonly light: string;
    readonly ring: string;
  };
}
