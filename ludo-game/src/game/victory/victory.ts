/**
 * Victory, end-of-game conditions and rankings.
 *
 * Non-team games:
 *  - all_players        : play until at most one active player remains.
 *  - top_two            : stop once two players finished (or one in a 2-player
 *                         game); remaining players are ranked by progress.
 *  - top_two_final_duel : like all_players, but when two players have finished
 *                         and exactly two remain, a DUEL is announced; the duel
 *                         winner is 3rd and the loser 4th.
 * Team games (2v2): the first team whose two members finished wins; endGameMode
 * is ignored.
 * Players who left are always ranked last (the last to leave ranks highest).
 */
import {SEAT_ORDER, stepsTravelled} from '../board/constants.ts';
import {teamIndexOf} from '../rules/teams.ts';
import type {GameState, PlayerColor, PlayerRanking} from '../types.ts';

type RankingInput = Pick<
  GameState,
  'config' | 'players' | 'pawns' | 'finishOrder' | 'leaveOrder'
>;

export function progressOf(
  state: Pick<GameState, 'pawns'>,
  color: PlayerColor
): number {
  return state.pawns[color].reduce((sum, pos) => sum + stepsTravelled(pos), 0);
}

export interface EndEvaluation {
  readonly finished: boolean;
  readonly winningTeam: number | null;
  readonly duel: readonly [PlayerColor, PlayerColor] | null;
}

export function evaluateEnd(
  state: RankingInput & Pick<GameState, 'duel'>
): EndEvaluation {
  const {config, players} = state;
  const active = players.filter(p => p.status === 'active');

  if (config.teams) {
    for (let t = 0; t < config.teams.teams.length; t++) {
      const members = config.teams.teams[t] ?? [];
      const statuses = members.map(
        c => players.find(p => p.color === c)?.status
      );
      if (statuses.every(s => s === 'finished')) {
        return {finished: true, winningTeam: t, duel: null};
      }
    }
    for (let t = 0; t < config.teams.teams.length; t++) {
      const members = config.teams.teams[t] ?? [];
      const allGone = members.every(
        c => players.find(p => p.color === c)?.status === 'left'
      );
      if (allGone) {
        return {finished: true, winningTeam: t === 0 ? 1 : 0, duel: null};
      }
    }
    return {finished: false, winningTeam: null, duel: null};
  }

  if (active.length <= 1)
    return {finished: true, winningTeam: null, duel: null};

  if (config.endGameMode === 'top_two') {
    const target = Math.min(2, players.length - 1);
    if (state.finishOrder.length >= target)
      return {finished: true, winningTeam: null, duel: null};
  }

  if (
    config.endGameMode === 'top_two_final_duel' &&
    !state.duel &&
    state.finishOrder.length === 2 &&
    active.length === 2
  ) {
    const [a, b] = active;
    if (a && b)
      return {finished: false, winningTeam: null, duel: [a.color, b.color]};
  }
  return {finished: false, winningTeam: null, duel: null};
}

export function computeRankings(
  state: RankingInput,
  winningTeam: number | null = null
): PlayerRanking[] {
  const {config, players} = state;
  const seatRank = (c: PlayerColor) => SEAT_ORDER.indexOf(c);
  const byColor = (c: PlayerColor) => players.find(p => p.color === c);

  const finished = state.finishOrder.filter(
    c => byColor(c)?.status === 'finished'
  );
  const unfinished = players
    .filter(p => p.status === 'active')
    .map(p => p.color)
    .sort(
      (a, b) =>
        progressOf(state, b) - progressOf(state, a) || seatRank(a) - seatRank(b)
    );
  const left = [...state.leaveOrder].reverse();

  const ordered: {color: PlayerColor; outcome: PlayerRanking['outcome']}[] = [
    ...finished.map(color => ({color, outcome: 'finished' as const})),
    ...unfinished.map(color => ({color, outcome: 'unfinished' as const})),
    ...left.map(color => ({color, outcome: 'left' as const})),
  ];

  if (config.teams && winningTeam !== null) {
    const teamOf = (c: PlayerColor) => teamIndexOf(config.teams, c);
    return ordered
      .map((entry, index) => ({entry, index}))
      .sort((a, b) => {
        const wa = teamOf(a.entry.color) === winningTeam ? 0 : 1;
        const wb = teamOf(b.entry.color) === winningTeam ? 0 : 1;
        return wa - wb || a.index - b.index;
      })
      .map(({entry}) => ({
        color: entry.color,
        playerId: byColor(entry.color)?.playerId ?? '',
        rank: teamOf(entry.color) === winningTeam ? 1 : 2,
        outcome: entry.outcome,
        progress: progressOf(state, entry.color),
        teamIndex: teamOf(entry.color),
      }));
  }

  return ordered.map((entry, index) => ({
    color: entry.color,
    playerId: byColor(entry.color)?.playerId ?? '',
    rank: index + 1,
    outcome: entry.outcome,
    progress: progressOf(state, entry.color),
    teamIndex: teamIndexOf(config.teams, entry.color),
  }));
}
