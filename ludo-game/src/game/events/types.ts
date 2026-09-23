import type {
  AdventureEventKind,
  DieValue,
  EndGameMode,
  PlayerColor,
  PlayerRanking,
} from '../types.ts';

interface EventBase<T extends string, P> {
  /** `${matchId}:${seq}` - unique and ordered within a match. */
  readonly id: string;
  readonly seq: number;
  readonly type: T;
  readonly timestamp: number;
  readonly matchId: string;
  readonly playerColor: PlayerColor | null;
  readonly payload: P;
}

export type GameStartedEvent = EventBase<
  'GAME_STARTED',
  {
    readonly colors: readonly PlayerColor[];
    readonly endGameMode: EndGameMode;
    readonly adventureSeed: string | null;
  }
>;
export type TurnStartedEvent = EventBase<
  'TURN_STARTED',
  {readonly turnNumber: number}
>;
export type TurnSkippedEvent = EventBase<
  'TURN_SKIPPED',
  {readonly remainingSkips: number}
>;
export type DiceRolledEvent = EventBase<
  'DICE_ROLLED',
  {
    readonly value: DieValue;
    readonly consecutiveSixes: number;
    readonly legalMoveCount: number;
  }
>;
export type TurnForfeitedEvent = EventBase<
  'TURN_FORFEITED',
  {readonly reason: 'too_many_sixes'}
>;
export type NoLegalMoveEvent = EventBase<
  'NO_LEGAL_MOVE',
  {readonly dice: DieValue}
>;
export type PawnSpawnedEvent = EventBase<
  'PAWN_SPAWNED',
  {readonly pawnIndex: number; readonly trackPosition: number}
>;
export type PawnMovedEvent = EventBase<
  'PAWN_MOVED',
  {
    readonly pawnIndex: number;
    readonly from: number;
    readonly to: number;
    readonly path: readonly number[];
    readonly dice: DieValue;
  }
>;
export type PawnCapturedEvent = EventBase<
  'PAWN_CAPTURED',
  {
    readonly attacker: PlayerColor;
    readonly attackerPawn: number;
    readonly victim: PlayerColor;
    readonly victimPawn: number;
    readonly trackPosition: number;
  }
>;
export type CaptureBlockedEvent = EventBase<
  'CAPTURE_BLOCKED_BY_SHIELD',
  {
    readonly attacker: PlayerColor;
    readonly victim: PlayerColor;
    readonly victimPawn: number;
    readonly trackPosition: number;
  }
>;
export type PawnReturnedEvent = EventBase<
  'PAWN_RETURNED',
  {readonly pawnIndex: number; readonly from: number}
>;
export type FinalLaneEnteredEvent = EventBase<
  'FINAL_LANE_ENTERED',
  {readonly pawnIndex: number}
>;
export type PawnFinishedEvent = EventBase<
  'PAWN_FINISHED',
  {readonly pawnIndex: number; readonly finishedPawns: number}
>;
export type AdventureEventTriggered = EventBase<
  'ADVENTURE_EVENT_TRIGGERED',
  {
    readonly pawnIndex: number;
    readonly kind: AdventureEventKind;
    readonly magnitude: number;
    readonly trackPosition: number;
    readonly from: number;
    readonly to: number;
  }
>;
export type PlayerFinishedEvent = EventBase<
  'PLAYER_FINISHED',
  {readonly place: number; readonly turnNumber: number}
>;
export type PlayerLeftEvent = EventBase<
  'PLAYER_LEFT',
  {readonly reason: 'quit' | 'abandon'}
>;
export type PlayerReplacedByAiEvent = EventBase<
  'PLAYER_REPLACED_BY_AI',
  {readonly difficulty: string}
>;
export type DuelStartedEvent = EventBase<
  'DUEL_STARTED',
  {readonly colors: readonly [PlayerColor, PlayerColor]}
>;
export type ExtraTurnEvent = EventBase<
  'EXTRA_TURN_GRANTED',
  {readonly reasons: readonly ('six' | 'capture' | 'finish' | 'bonus')[]}
>;
export type GameFinishedEvent = EventBase<
  'GAME_FINISHED',
  {
    readonly rankings: readonly PlayerRanking[];
    readonly winningTeam: number | null;
  }
>;

export type GameEvent =
  | GameStartedEvent
  | TurnStartedEvent
  | TurnSkippedEvent
  | DiceRolledEvent
  | TurnForfeitedEvent
  | NoLegalMoveEvent
  | PawnSpawnedEvent
  | PawnMovedEvent
  | PawnCapturedEvent
  | CaptureBlockedEvent
  | PawnReturnedEvent
  | FinalLaneEnteredEvent
  | PawnFinishedEvent
  | AdventureEventTriggered
  | PlayerFinishedEvent
  | PlayerLeftEvent
  | PlayerReplacedByAiEvent
  | DuelStartedEvent
  | ExtraTurnEvent
  | GameFinishedEvent;

export type GameEventType = GameEvent['type'];

export type GameEventOf<T extends GameEventType> = Extract<
  GameEvent,
  {type: T}
>;

export type GameEventPayload<T extends GameEventType> =
  GameEventOf<T>['payload'];
