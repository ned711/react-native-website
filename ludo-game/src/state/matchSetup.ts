/**
 * Match setup chosen on the Play screen, handed to the game screen. Kept in a
 * tiny module store (not URL params) because it holds structured data.
 */
import type {MatchFormat} from '../game/rules/seats.ts';
import type {AiDifficulty, EndGameMode} from '../game/types.ts';

export type PlayMode = 'vs_computer' | 'local';

export interface MatchSetup {
  readonly playMode: PlayMode;
  readonly format: MatchFormat;
  /** For local games: how many seats are humans (others are AI). */
  readonly humanSeats: number;
  readonly aiDifficulty: AiDifficulty;
  readonly endGameMode: EndGameMode;
  readonly adventure: boolean;
  /** Optional Adventure seed typed by the player (LUDO-XXXXXX). */
  readonly adventureSeed: string | null;
}

export const DEFAULT_SETUP: MatchSetup = {
  playMode: 'vs_computer',
  format: '4p',
  humanSeats: 1,
  aiDifficulty: 'normal',
  endGameMode: 'all_players',
  adventure: false,
  adventureSeed: null,
};

let current: MatchSetup = DEFAULT_SETUP;

export function setMatchSetup(setup: MatchSetup): void {
  current = setup;
}

export function getMatchSetup(): MatchSetup {
  return current;
}
