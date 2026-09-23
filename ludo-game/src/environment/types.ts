import type {AssetRef} from '../content/assets.ts';

export type GraphicsQuality = 'LOW' | 'NORMAL' | 'HIGH';
export const GRAPHICS_QUALITIES: readonly GraphicsQuality[] = [
  'LOW',
  'NORMAL',
  'HIGH',
];

export type ParticleShape =
  'petal' | 'leaf' | 'dust' | 'ember' | 'mist' | 'snow' | 'glow';

export interface ParticleEmitterDefinition {
  readonly shape: ParticleShape;
  readonly colors: readonly string[];
  readonly sizeRange: readonly [number, number];
  /** Seconds to cross the screen. */
  readonly durationRange: readonly [number, number];
  /** Horizontal drift as a fraction of screen width. */
  readonly drift: number;
  readonly direction: 'down' | 'up' | 'across';
  readonly opacity: number;
  readonly countByQuality: Readonly<Record<GraphicsQuality, number>>;
}

export interface EnvironmentDefinition {
  readonly id: string;
  /** Vertical gradient behind the board (real, rendered). */
  readonly skyGradient: readonly [string, string];
  readonly background: AssetRef;
  readonly layers: readonly AssetRef[];
  readonly emitters: readonly ParticleEmitterDefinition[];
  readonly weather: 'clear' | 'wind' | 'mist' | 'heat' | 'snow';
  readonly lighting: 'day' | 'dusk' | 'night' | 'torchlight';
  readonly soundscape: AssetRef;
}
