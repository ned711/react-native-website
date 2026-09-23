/** Centralised engine error codes (no ad-hoc strings elsewhere). */
export const EngineErrorCode = {
  GAME_FINISHED: 'GAME_FINISHED',
  UNKNOWN_PLAYER: 'UNKNOWN_PLAYER',
  PLAYER_NOT_ACTIVE: 'PLAYER_NOT_ACTIVE',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  ALREADY_ROLLED: 'ALREADY_ROLLED',
  MUST_ROLL_FIRST: 'MUST_ROLL_FIRST',
  INVALID_DICE_VALUE: 'INVALID_DICE_VALUE',
  INVALID_PAWN: 'INVALID_PAWN',
  ILLEGAL_MOVE: 'ILLEGAL_MOVE',
  INVALID_CONFIG: 'INVALID_CONFIG',
  INVALID_ACTION: 'INVALID_ACTION',
} as const;

export type EngineErrorCode =
  (typeof EngineErrorCode)[keyof typeof EngineErrorCode];

export interface EngineError {
  readonly code: EngineErrorCode;
  readonly message: string;
}

export function engineError(
  code: EngineErrorCode,
  message: string
): EngineError {
  return {code, message};
}
