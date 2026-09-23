/**
 * Core Ludo domain types. This module has no dependency on React, React
 * Native, Expo or any backend: it is shared by the client, the tests and the
 * authoritative server (Supabase Edge Function running on Deno).
 */

export const PLAYER_COLORS = ['green', 'yellow', 'blue', 'red'] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;
export const DIE_VALUES: readonly DieValue[] = [1, 2, 3, 4, 5, 6];

export function isDieValue(value: unknown): value is DieValue {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 6
  );
}

export function isPlayerColor(value: unknown): value is PlayerColor {
  return (
    typeof value === 'string' &&
    (PLAYER_COLORS as readonly string[]).includes(value)
  );
}

/**
 * Pawn position, relative to its owner's path:
 *  -1      base
 *  0..51   common track (0 = owner's start cell)
 *  52..56  owner's final lane
 *  57      finished (centre)
 */
export type PawnPosition = number;

export type GameMode = 'classic' | 'local' | 'online' | 'team' | 'mixed';

export type EndGameMode = 'all_players' | 'top_two' | 'top_two_final_duel';

export type AiDifficulty = 'easy' | 'normal' | 'hard';

export type SeatController =
  | {readonly kind: 'human'}
  | {readonly kind: 'ai'; readonly difficulty: AiDifficulty};

export interface SeatConfig {
  readonly color: PlayerColor;
  /** Stable identifier: auth user id online, local id offline, `ai:<color>` for bots. */
  readonly playerId: string;
  readonly displayName: string;
  readonly controller: SeatController;
}

export interface RuleConfig {
  /** Die values that allow a pawn to leave its base. Classic: [6]. */
  readonly spawnValues: readonly DieValue[];
  readonly sixGrantsExtraTurn: boolean;
  readonly captureGrantsExtraTurn: boolean;
  readonly finishGrantsExtraTurn: boolean;
  /** Rolling this many sixes in a row forfeits the turn. null disables the rule. */
  readonly maxConsecutiveSixes: number | null;
  /** Global track indices (0..51) where captures are impossible. */
  readonly safeTrackPositions: readonly number[];
  /** In team games, whether teammates may capture each other. */
  readonly teammateCaptureAllowed: boolean;
}

export interface TeamConfig {
  /** Exactly two teams of two colours each. */
  readonly teams: readonly [
    readonly [PlayerColor, PlayerColor],
    readonly [PlayerColor, PlayerColor],
  ];
}

export interface GameConfig {
  readonly matchId: string;
  readonly mode: GameMode;
  readonly seats: readonly SeatConfig[];
  readonly teams: TeamConfig | null;
  readonly endGameMode: EndGameMode;
  readonly rules: RuleConfig;
  readonly adventure: AdventureBoard | null;
}

export type PlayerStatus = 'active' | 'finished' | 'left';

export interface PlayerState {
  readonly color: PlayerColor;
  readonly playerId: string;
  readonly displayName: string;
  readonly controller: SeatController;
  readonly status: PlayerStatus;
  /** Turns to skip (Adventure prison / freeze). */
  readonly skipTurns: number;
  /** Adventure treasure collected during this match (in-match score only). */
  readonly treasure: number;
  readonly finishedAtTurn: number | null;
  readonly captures: number;
}

export type MoveKind = 'spawn' | 'advance' | 'enter_final_lane' | 'finish';

export interface CaptureTarget {
  readonly color: PlayerColor;
  readonly pawnIndex: number;
  readonly trackPosition: number;
}

export interface LegalMove {
  readonly color: PlayerColor;
  readonly pawnIndex: number;
  readonly from: PawnPosition;
  readonly to: PawnPosition;
  readonly dice: DieValue;
  readonly kind: MoveKind;
  /** Every relative position visited, in order, ending with `to`. */
  readonly path: readonly PawnPosition[];
  /** Pawns that would be captured (sent home) by this move. */
  readonly captures: readonly CaptureTarget[];
  /** Pawns protected by an Adventure shield that would block the capture. */
  readonly shieldedTargets: readonly CaptureTarget[];
}

export type GamePhase =
  | {readonly kind: 'awaiting_roll'}
  | {
      readonly kind: 'awaiting_move';
      readonly dice: DieValue;
      readonly legalMoves: readonly LegalMove[];
    }
  | {readonly kind: 'finished'};

export interface PlayerRanking {
  readonly color: PlayerColor;
  readonly playerId: string;
  readonly rank: number;
  readonly outcome: 'finished' | 'unfinished' | 'left';
  /** Sum of steps travelled by all pawns (0..4*58); used for tie-breaks. */
  readonly progress: number;
  readonly teamIndex: number | null;
}

export interface DuelState {
  readonly colors: readonly [PlayerColor, PlayerColor];
  readonly startedAtTurn: number;
}

export interface GameState {
  readonly config: GameConfig;
  readonly version: number;
  readonly phase: GamePhase;
  readonly currentColor: PlayerColor;
  readonly turnNumber: number;
  readonly consecutiveSixes: number;
  readonly lastRoll: {
    readonly color: PlayerColor;
    readonly value: DieValue;
  } | null;
  readonly pawns: Readonly<Record<PlayerColor, readonly PawnPosition[]>>;
  /** Adventure shields per pawn (always false outside Adventure mode). */
  readonly shields: Readonly<Record<PlayerColor, readonly boolean[]>>;
  readonly players: readonly PlayerState[];
  /** Colours in the order they finished all their pawns. */
  readonly finishOrder: readonly PlayerColor[];
  /** Colours in the order they left the match. */
  readonly leaveOrder: readonly PlayerColor[];
  readonly duel: DuelState | null;
  /** Final rankings, filled when phase is `finished`. */
  readonly rankings: readonly PlayerRanking[];
  /** Monotonic event sequence number. */
  readonly eventSeq: number;
}

// ---------------------------------------------------------------------------
// Adventure (Jeu de l'Oie) configuration, generated from a seed.

export type AdventureEventKind =
  | 'prison'
  | 'freeze'
  | 'backward'
  | 'boost'
  | 'teleport'
  | 'treasure'
  | 'shield'
  | 'bonus_turn';

export interface AdventureCell {
  /** Global track index 0..51. */
  readonly trackPosition: number;
  readonly kind: AdventureEventKind;
  /** Meaning depends on kind: turns, steps, coins... */
  readonly magnitude: number;
}

export interface AdventureBoard {
  readonly seed: string;
  readonly generatorVersion: number;
  readonly cells: readonly AdventureCell[];
}
