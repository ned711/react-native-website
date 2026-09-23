import type {
  AdventureBoard,
  EndGameMode,
  GameConfig,
  GameMode,
  PlayerColor,
  RuleConfig,
  SeatController,
} from '../types.ts';
import {CLASSIC_RULES} from './defaults.ts';
import {OPPOSITE_TEAMS} from './teams.ts';

export type MatchFormat = '2p' | '3p' | '4p' | '2v2';

/** Seats used for each format. 2 players sit opposite each other. */
export const FORMAT_COLORS: Readonly<
  Record<MatchFormat, readonly PlayerColor[]>
> = {
  '2p': ['green', 'blue'],
  '3p': ['green', 'yellow', 'blue'],
  '4p': ['green', 'yellow', 'blue', 'red'],
  '2v2': ['green', 'yellow', 'blue', 'red'],
};

export interface SeatRequest {
  readonly playerId: string;
  readonly displayName: string;
  readonly controller: SeatController;
}

export interface BuildConfigInput {
  readonly matchId: string;
  readonly mode: GameMode;
  readonly format: MatchFormat;
  readonly seats: readonly SeatRequest[];
  readonly endGameMode: EndGameMode;
  readonly rules?: RuleConfig;
  readonly adventure?: AdventureBoard | null;
}

export function buildGameConfig(input: BuildConfigInput): GameConfig {
  const colors = FORMAT_COLORS[input.format];
  if (input.seats.length !== colors.length) {
    throw new RangeError(
      `${input.format} needs ${colors.length} seats, got ${input.seats.length}`
    );
  }
  return {
    matchId: input.matchId,
    mode: input.format === '2v2' ? 'team' : input.mode,
    seats: input.seats.map((seat, i) => ({
      color: colors[i] as PlayerColor,
      playerId: seat.playerId,
      displayName: seat.displayName,
      controller: seat.controller,
    })),
    teams: input.format === '2v2' ? OPPOSITE_TEAMS : null,
    endGameMode: input.endGameMode,
    rules: input.rules ?? CLASSIC_RULES,
    adventure: input.adventure ?? null,
  };
}
