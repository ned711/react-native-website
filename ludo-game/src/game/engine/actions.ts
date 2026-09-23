import type {AiDifficulty, DieValue, PlayerColor} from '../types.ts';

/**
 * Actions accepted by the pure reducer. `ROLL_DICE.value` is supplied by the
 * authority that owns the dice (local engine offline, server online) - never
 * by a remote client.
 */
export type GameAction =
  | {
      readonly type: 'ROLL_DICE';
      readonly color: PlayerColor;
      readonly value: DieValue;
    }
  | {
      readonly type: 'MOVE_PAWN';
      readonly color: PlayerColor;
      readonly pawnIndex: number;
    }
  | {
      readonly type: 'LEAVE';
      readonly color: PlayerColor;
      readonly reason: 'quit' | 'abandon';
    }
  | {
      readonly type: 'REPLACE_WITH_AI';
      readonly color: PlayerColor;
      readonly difficulty: AiDifficulty;
    };

/** What an AI (or a human UI) produces: an intention, validated by the engine. */
export interface MoveIntent {
  readonly pawnIndex: number;
}
