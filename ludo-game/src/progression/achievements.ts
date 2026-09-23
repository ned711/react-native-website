import type {RewardBundle} from './missions.ts';
import type {MatchStats} from './stats.ts';

export interface LifetimeStats {
  readonly matchesCompleted: number;
  readonly wins: number;
  readonly captures: number;
  readonly currentWinStreak: number;
  readonly bestWinStreak: number;
  readonly perfectFinishes: number;
  readonly winsWithoutCapture: number;
}

export const EMPTY_LIFETIME: LifetimeStats = {
  matchesCompleted: 0,
  wins: 0,
  captures: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  perfectFinishes: 0,
  winsWithoutCapture: 0,
};

export function accumulate(
  lifetime: LifetimeStats,
  match: MatchStats
): LifetimeStats {
  const streak =
    match.wins > 0
      ? lifetime.currentWinStreak + 1
      : match.matchesCompleted > 0
        ? 0
        : lifetime.currentWinStreak;
  return {
    matchesCompleted: lifetime.matchesCompleted + match.matchesCompleted,
    wins: lifetime.wins + match.wins,
    captures: lifetime.captures + match.captures,
    currentWinStreak: streak,
    bestWinStreak: Math.max(lifetime.bestWinStreak, streak),
    perfectFinishes:
      lifetime.perfectFinishes + (match.finishedAllPawns ? 1 : 0),
    winsWithoutCapture:
      lifetime.winsWithoutCapture + (match.winWithoutCapture ? 1 : 0),
  };
}

export interface AchievementDefinition {
  readonly id: string;
  readonly label: string;
  readonly metric: keyof LifetimeStats;
  readonly target: number;
  readonly reward: RewardBundle;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: 'first_win',
    label: 'Première victoire',
    metric: 'wins',
    target: 1,
    reward: {xp: 50},
  },
  {
    id: 'matches_100',
    label: '100 parties',
    metric: 'matchesCompleted',
    target: 100,
    reward: {xp: 500, titleId: 'veteran'},
  },
  {
    id: 'captures_100',
    label: '100 captures',
    metric: 'captures',
    target: 100,
    reward: {xp: 300, titleId: 'hunter'},
  },
  {
    id: 'streak_5',
    label: 'Série de 5 victoires',
    metric: 'bestWinStreak',
    target: 5,
    reward: {xp: 250},
  },
  {
    id: 'perfect_finish',
    label: 'Amener ses 4 pions au centre',
    metric: 'perfectFinishes',
    target: 1,
    reward: {xp: 50},
  },
  {
    id: 'pacifist',
    label: 'Gagner sans capturer',
    metric: 'winsWithoutCapture',
    target: 1,
    reward: {xp: 100, titleId: 'pacifist'},
  },
];

export function unlockedAchievements(
  lifetime: LifetimeStats,
  alreadyUnlocked: readonly string[] = []
): AchievementDefinition[] {
  return ACHIEVEMENTS.filter(
    a => !alreadyUnlocked.includes(a.id) && lifetime[a.metric] >= a.target
  );
}
