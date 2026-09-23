import {ECONOMY_CONFIG, type LevelCurveConfig} from '../economy/config.ts';

/** XP required to go from `level` to `level + 1`. */
export function xpToNextLevel(
  level: number,
  curve: LevelCurveConfig = ECONOMY_CONFIG.levelCurve
): number {
  return curve.base + curve.step * (level - 1);
}

/** Total XP required to reach `level` from level 1. */
export function totalXpForLevel(
  level: number,
  curve: LevelCurveConfig = ECONOMY_CONFIG.levelCurve
): number {
  const n = Math.max(0, Math.min(level, curve.maxLevel) - 1);
  // Sum of an arithmetic progression: n*base + step*n(n-1)/2
  return n * curve.base + (curve.step * n * (n - 1)) / 2;
}

export interface LevelProgress {
  readonly level: number;
  readonly xpIntoLevel: number;
  /** null at max level. */
  readonly xpForNextLevel: number | null;
  readonly totalXp: number;
}

export function levelFromXp(
  totalXp: number,
  curve: LevelCurveConfig = ECONOMY_CONFIG.levelCurve
): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (level < curve.maxLevel && totalXpForLevel(level + 1, curve) <= xp)
    level++;
  const floor = totalXpForLevel(level, curve);
  return {
    level,
    totalXp: xp,
    xpIntoLevel: xp - floor,
    xpForNextLevel:
      level >= curve.maxLevel ? null : xpToNextLevel(level, curve),
  };
}
