import {placeholder, type AssetRef} from '../content/assets.ts';

export type BadgeFamily =
  'medal' | 'cup' | 'trophy' | 'diamond' | 'legend' | 'master';
export type BadgeMetal = 'bronze' | 'silver' | 'gold' | 'platinum' | null;

export interface BadgeTier {
  readonly id: string;
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly family: BadgeFamily;
  readonly metal: BadgeMetal;
  readonly label: string;
  /** Colour used by the 2D fallback while the badge art is a placeholder. */
  readonly color: string;
  readonly art: AssetRef;
}

function tier(
  minLevel: number,
  maxLevel: number,
  family: BadgeFamily,
  metal: BadgeMetal,
  label: string,
  color: string
): BadgeTier {
  const id = `${family}${metal ? `_${metal}` : ''}`;
  return {
    id,
    minLevel,
    maxLevel,
    family,
    metal,
    label,
    color,
    art: placeholder('image', `badge.${id}`),
  };
}

/** Cosmetic only. The exact level is always displayed next to the badge. */
export const BADGE_TIERS: readonly BadgeTier[] = [
  tier(1, 4, 'medal', 'bronze', 'Médaille Bronze', '#CD7F32'),
  tier(5, 9, 'medal', 'silver', 'Médaille Argent', '#C0C0C0'),
  tier(10, 14, 'medal', 'gold', 'Médaille Or', '#FFD700'),
  tier(15, 19, 'medal', 'platinum', 'Médaille Platine', '#E5E4E2'),
  tier(20, 24, 'cup', 'bronze', 'Coupe Bronze', '#CD7F32'),
  tier(25, 29, 'cup', 'silver', 'Coupe Argent', '#C0C0C0'),
  tier(30, 34, 'cup', 'gold', 'Coupe Or', '#FFD700'),
  tier(35, 39, 'cup', 'platinum', 'Coupe Platine', '#E5E4E2'),
  tier(40, 49, 'trophy', 'bronze', 'Trophée Bronze', '#CD7F32'),
  tier(50, 59, 'trophy', 'silver', 'Trophée Argent', '#C0C0C0'),
  tier(60, 69, 'trophy', 'gold', 'Trophée Or', '#FFD700'),
  tier(70, 79, 'trophy', 'platinum', 'Trophée Platine', '#E5E4E2'),
  tier(80, 89, 'diamond', null, 'Diamant', '#B9F2FF'),
  tier(90, 99, 'legend', null, 'Légende', '#9C27B0'),
  tier(100, 100, 'master', null, 'Maître Ludo', '#FF5722'),
];

export function badgeForLevel(level: number): BadgeTier {
  const clamped = Math.max(1, Math.min(100, Math.floor(level)));
  const found = BADGE_TIERS.find(
    t => clamped >= t.minLevel && clamped <= t.maxLevel
  );
  if (!found) throw new RangeError(`no badge for level ${level}`);
  return found;
}
