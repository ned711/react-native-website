import {ECONOMY_CONFIG, type MatchXpConfig} from '../economy/config.ts';
import type {PlayerRanking} from '../game/types.ts';

export interface MatchXpInput {
  readonly ranking: Pick<PlayerRanking, 'rank' | 'outcome'>;
  readonly captures: number;
  readonly firstMatchOfDay: boolean;
  readonly playedWithFriend: boolean;
}

export interface XpLine {
  readonly source:
    | 'completed'
    | 'victory'
    | 'place'
    | 'first_match_of_day'
    | 'friend'
    | 'captures';
  readonly amount: number;
}

export interface XpBreakdown {
  readonly lines: readonly XpLine[];
  readonly total: number;
}

/**
 * XP earned for one finished match. Runs on the SERVER (match authority) for
 * online matches; the client may only display a preview.
 */
export function computeMatchXp(
  input: MatchXpInput,
  config: MatchXpConfig = ECONOMY_CONFIG.matchXp
): XpBreakdown {
  if (input.ranking.outcome === 'left') {
    return {lines: [], total: config.abandoned};
  }
  const lines: XpLine[] = [{source: 'completed', amount: config.completed}];
  if (input.ranking.rank === 1)
    lines.push({source: 'victory', amount: config.victory});
  const place = config.placeBonus[input.ranking.rank];
  if (place) lines.push({source: 'place', amount: place});
  if (input.firstMatchOfDay)
    lines.push({source: 'first_match_of_day', amount: config.firstMatchOfDay});
  if (input.playedWithFriend)
    lines.push({source: 'friend', amount: config.playedWithFriend});
  const captureXp = Math.min(
    config.maxCaptureXp,
    Math.max(0, input.captures) * config.perCapture
  );
  if (captureXp > 0) lines.push({source: 'captures', amount: captureXp});
  return {lines, total: lines.reduce((sum, l) => sum + l.amount, 0)};
}
