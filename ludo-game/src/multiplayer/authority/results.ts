import {FINISH_POSITION} from '../../game/board/constants.ts';
import type {GameState, PlayerColor} from '../../game/types.ts';
import {computeMatchXp} from '../../progression/xp.ts';

export interface PlayerResult {
  readonly user_id: string;
  readonly color: PlayerColor;
  readonly rank: number;
  readonly outcome: 'finished' | 'unfinished' | 'left';
  readonly xp: number;
  readonly captures: number;
  readonly pawns_finished: number;
}

export interface ResultContext {
  /** Human player ids (AI seats are excluded from results). */
  readonly humanIds: ReadonlySet<string>;
  readonly firstMatchOfDay: ReadonlySet<string>;
  /** Users who had at least one friend in the match. */
  readonly withFriend: ReadonlySet<string>;
}

/** Server-side: results of a finished match, fed to SQL apply_match_result. */
export function computeMatchResults(
  state: GameState,
  ctx: ResultContext
): PlayerResult[] {
  if (state.phase.kind !== 'finished') throw new Error('match is not finished');
  return state.rankings
    .filter(r => ctx.humanIds.has(r.playerId))
    .map(r => {
      const player = state.players.find(p => p.color === r.color);
      const captures = player?.captures ?? 0;
      const xp = computeMatchXp({
        ranking: r,
        captures,
        firstMatchOfDay: ctx.firstMatchOfDay.has(r.playerId),
        playedWithFriend: ctx.withFriend.has(r.playerId),
      }).total;
      return {
        user_id: r.playerId,
        color: r.color,
        rank: r.rank,
        outcome: r.outcome,
        xp,
        captures,
        pawns_finished: state.pawns[r.color].filter(p => p === FINISH_POSITION)
          .length,
      };
    });
}
