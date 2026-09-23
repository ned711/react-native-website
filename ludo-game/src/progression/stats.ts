import type {GameEvent} from '../game/events/types.ts';
import type {PlayerColor, PlayerRanking} from '../game/types.ts';

/** Per-player statistics extracted from one match's event stream. */
export interface MatchStats {
  readonly matchesCompleted: number;
  readonly wins: number;
  readonly captures: number;
  readonly pawnsSpawned: number;
  readonly pawnsFinished: number;
  readonly finishedAllPawns: boolean;
  readonly winWithoutCapture: boolean;
  readonly playedWithFriend: boolean;
  readonly giftsSent: number;
}

export const EMPTY_STATS: MatchStats = {
  matchesCompleted: 0,
  wins: 0,
  captures: 0,
  pawnsSpawned: 0,
  pawnsFinished: 0,
  finishedAllPawns: false,
  winWithoutCapture: false,
  playedWithFriend: false,
  giftsSent: 0,
};

export function statsFromEvents(
  events: readonly GameEvent[],
  color: PlayerColor,
  extra: {readonly playedWithFriend?: boolean; readonly giftsSent?: number} = {}
): MatchStats {
  let captures = 0;
  let spawned = 0;
  let finished = 0;
  let rankings: readonly PlayerRanking[] | null = null;
  let playerFinished = false;
  for (const e of events) {
    if (e.type === 'PAWN_CAPTURED' && e.payload.attacker === color) captures++;
    else if (e.type === 'PAWN_SPAWNED' && e.playerColor === color) spawned++;
    else if (e.type === 'PAWN_FINISHED' && e.playerColor === color) finished++;
    else if (e.type === 'PLAYER_FINISHED' && e.playerColor === color)
      playerFinished = true;
    else if (e.type === 'GAME_FINISHED') rankings = e.payload.rankings;
  }
  const mine = rankings?.find(r => r.color === color);
  const won = mine?.rank === 1;
  return {
    matchesCompleted: rankings && mine && mine.outcome !== 'left' ? 1 : 0,
    wins: won ? 1 : 0,
    captures,
    pawnsSpawned: spawned,
    pawnsFinished: finished,
    finishedAllPawns: playerFinished,
    winWithoutCapture: won && captures === 0,
    playedWithFriend: extra.playedWithFriend ?? false,
    giftsSent: extra.giftsSent ?? 0,
  };
}
