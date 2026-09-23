import type {MatchStats} from './stats.ts';

export type MissionPeriod = 'daily' | 'weekly' | 'event';

export type MissionMetric =
  | 'wins'
  | 'captures'
  | 'matchesCompleted'
  | 'pawnsSpawned'
  | 'pawnsFinished'
  | 'giftsSent'
  | 'matchesWithFriend';

export interface RewardBundle {
  readonly xp?: number;
  readonly coins?: number;
  readonly fragments?: readonly {
    readonly itemId: string;
    readonly count: number;
  }[];
  readonly itemIds?: readonly string[];
  readonly titleId?: string;
}

export interface MissionDefinition {
  readonly id: string;
  readonly period: MissionPeriod;
  readonly label: string;
  readonly metric: MissionMetric;
  readonly target: number;
  readonly reward: RewardBundle;
  readonly eventId?: string;
}

export const MISSIONS: readonly MissionDefinition[] = [
  {
    id: 'daily_win_2',
    period: 'daily',
    label: 'Gagner 2 parties',
    metric: 'wins',
    target: 2,
    reward: {xp: 60},
  },
  {
    id: 'daily_capture_3',
    period: 'daily',
    label: 'Effectuer 3 captures',
    metric: 'captures',
    target: 3,
    reward: {xp: 40},
  },
  {
    id: 'daily_friend_1',
    period: 'daily',
    label: 'Jouer avec un ami',
    metric: 'matchesWithFriend',
    target: 1,
    reward: {xp: 40},
  },
  {
    id: 'daily_gifts_2',
    period: 'daily',
    label: 'Envoyer 2 cadeaux',
    metric: 'giftsSent',
    target: 2,
    reward: {xp: 20},
  },
  {
    id: 'daily_complete_1',
    period: 'daily',
    label: 'Terminer une partie',
    metric: 'matchesCompleted',
    target: 1,
    reward: {xp: 20},
  },
  {
    id: 'daily_spawn_5',
    period: 'daily',
    label: 'Sortir 5 pions',
    metric: 'pawnsSpawned',
    target: 5,
    reward: {xp: 30},
  },
  {
    id: 'weekly_win_10',
    period: 'weekly',
    label: 'Gagner 10 parties',
    metric: 'wins',
    target: 10,
    reward: {xp: 300, fragments: [{itemId: 'samurai', count: 1}]},
  },
  {
    id: 'weekly_finish_40',
    period: 'weekly',
    label: 'Amener 40 pions au centre',
    metric: 'pawnsFinished',
    target: 40,
    reward: {xp: 250},
  },
];

function metricValue(stats: MatchStats, metric: MissionMetric): number {
  switch (metric) {
    case 'wins':
      return stats.wins;
    case 'captures':
      return stats.captures;
    case 'matchesCompleted':
      return stats.matchesCompleted;
    case 'pawnsSpawned':
      return stats.pawnsSpawned;
    case 'pawnsFinished':
      return stats.pawnsFinished;
    case 'giftsSent':
      return stats.giftsSent;
    case 'matchesWithFriend':
      return stats.playedWithFriend && stats.matchesCompleted > 0 ? 1 : 0;
  }
}

export interface MissionProgress {
  readonly missionId: string;
  readonly progress: number;
  readonly completed: boolean;
  readonly claimed: boolean;
}

export function advanceMissions(
  definitions: readonly MissionDefinition[],
  current: readonly MissionProgress[],
  stats: MatchStats
): MissionProgress[] {
  return definitions.map(def => {
    const prev = current.find(p => p.missionId === def.id) ?? {
      missionId: def.id,
      progress: 0,
      completed: false,
      claimed: false,
    };
    if (prev.completed) return prev;
    const progress = Math.min(
      def.target,
      prev.progress + metricValue(stats, def.metric)
    );
    return {...prev, progress, completed: progress >= def.target};
  });
}
