import type {ThemeId} from '../themes/types.ts';

export interface SeasonDefinition {
  readonly id: string;
  readonly name: string;
  readonly themeId: ThemeId;
  readonly startsAt: string; // ISO date
  readonly endsAt: string;
  readonly missionIds: readonly string[];
  readonly exclusiveItemIds: readonly string[];
  readonly hasRanking: boolean;
}

export interface LiveEventDefinition {
  readonly id: string;
  readonly name: string;
  readonly themeId: ThemeId;
  readonly startsAt: string;
  readonly endsAt: string;
  /** Multipliers apply to rewards only, never to gameplay rules. */
  readonly rewardMultiplier: number;
  readonly featuredItemIds: readonly string[];
  readonly missionIds: readonly string[];
}

/** STATUS: PRÉPARÉ - no season/event is scheduled yet; the server will publish them. */
export const SEASONS: readonly SeasonDefinition[] = [];
export const LIVE_EVENTS: readonly LiveEventDefinition[] = [];

export function isActive(
  period: {readonly startsAt: string; readonly endsAt: string},
  now: number
): boolean {
  const start = Date.parse(period.startsAt);
  const end = Date.parse(period.endsAt);
  return (
    Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end
  );
}
