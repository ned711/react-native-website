import {
  applyAction,
  buildGameConfig,
  createGame,
  type AdventureBoard,
  type DieValue,
  type EndGameMode,
  type GameAction,
  type GameEvent,
  type GameState,
  type MatchFormat,
  type PlayerColor,
  type RuleConfig,
  type SeatController,
} from '../../src/game/index.ts';

export const NOW = 1_700_000_000_000;

export function newGame(
  format: MatchFormat = '4p',
  options: {
    endGameMode?: EndGameMode;
    rules?: RuleConfig;
    adventure?: AdventureBoard | null;
    controller?: SeatController;
  } = {}
): GameState {
  const count = format === '2p' ? 2 : format === '3p' ? 3 : 4;
  const config = buildGameConfig({
    matchId: 'm1',
    mode: 'local',
    format,
    endGameMode: options.endGameMode ?? 'all_players',
    rules: options.rules,
    adventure: options.adventure ?? null,
    seats: Array.from({length: count}, (_, i) => ({
      playerId: `p${i}`,
      displayName: `Player ${i}`,
      controller: options.controller ?? {kind: 'human'},
    })),
  });
  const result = createGame(config, {now: NOW});
  if (!result.ok) throw new Error(result.error.message);
  return result.value.state;
}

/** Test-only: places pawns directly (bypassing the engine) to set up scenarios. */
export function withPawns(
  state: GameState,
  pawns: Partial<Record<PlayerColor, number[]>>,
  patch: Partial<GameState> = {}
): GameState {
  return {...state, pawns: {...state.pawns, ...pawns}, ...patch};
}

export function act(
  state: GameState,
  action: GameAction
): {state: GameState; events: readonly GameEvent[]} {
  const result = applyAction(state, action, {now: NOW});
  if (!result.ok)
    throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

export function roll(state: GameState, value: DieValue) {
  return act(state, {type: 'ROLL_DICE', color: state.currentColor, value});
}

export function move(state: GameState, pawnIndex: number) {
  return act(state, {type: 'MOVE_PAWN', color: state.currentColor, pawnIndex});
}

export function types(events: readonly GameEvent[]): string[] {
  return events.map(e => e.type);
}
