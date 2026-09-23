/**
 * Economy configuration: the single place where tunable numbers live. UI and
 * logic read from here; nothing is hard-coded in components.
 *
 * STATUS: default values to be calibrated by game design. Shop prices are
 * intentionally NOT defined (null) until the business decides them.
 * The server remains authoritative: it applies these values, never the client.
 */
export interface LevelCurveConfig {
  /** XP needed to go from level 1 to 2. */
  readonly base: number;
  /** Additional XP needed per level. */
  readonly step: number;
  readonly maxLevel: number;
}

export interface MatchXpConfig {
  readonly completed: number;
  readonly victory: number;
  readonly placeBonus: Readonly<Record<number, number>>;
  readonly firstMatchOfDay: number;
  readonly playedWithFriend: number;
  readonly perCapture: number;
  readonly maxCaptureXp: number;
  /** Abandoning a match gives nothing. */
  readonly abandoned: number;
}

export interface EconomyConfig {
  readonly version: number;
  readonly levelCurve: LevelCurveConfig;
  readonly matchXp: MatchXpConfig;
  readonly fragmentsPerItem: number;
  readonly chestCooldownMs: number;
  readonly invitationTtlMs: number;
}

export const ECONOMY_CONFIG: EconomyConfig = {
  version: 1,
  levelCurve: {base: 100, step: 25, maxLevel: 100},
  matchXp: {
    completed: 20,
    victory: 50,
    placeBonus: {2: 25, 3: 10},
    firstMatchOfDay: 40,
    playedWithFriend: 15,
    perCapture: 2,
    maxCaptureXp: 10,
    abandoned: 0,
  },
  fragmentsPerItem: 6,
  chestCooldownMs: 3 * 60 * 60 * 1000,
  invitationTtlMs: 2 * 60 * 1000,
};

export type Currency = 'coins' | 'gems';

export interface Price {
  readonly currency: Currency;
  readonly amount: number;
}
