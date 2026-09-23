import {
  applyAction,
  createAi,
  createGame,
  buildGameConfig,
  type AiPlayer,
  type EndGameMode,
  type GameAction,
  type GameEvent,
  type GameState,
  type MatchFormat,
  type RecordedAction,
  type AdventureBoard,
  type AiDifficulty,
} from '../../src/game/index.ts';
import {deepFreeze} from '../../src/utils/deepReadonly.ts';
import {createSeededRandom, randomInt} from '../../src/utils/random.ts';

export interface SimulationResult {
  readonly final: GameState;
  readonly events: GameEvent[];
  readonly actions: RecordedAction[];
  readonly startedAt: number;
  readonly aiChoices: number;
}

/** Plays a full game with AIs only. Every state handed to an AI is deep-frozen. */
export function simulate(
  seed: string,
  format: MatchFormat,
  difficulties: AiDifficulty[],
  endGameMode: EndGameMode = 'all_players',
  adventure: AdventureBoard | null = null,
  maxActions = 20_000
): SimulationResult {
  const dice = createSeededRandom(`${seed}:dice`);
  const config = buildGameConfig({
    matchId: `sim-${seed}`,
    mode: 'classic',
    format,
    endGameMode,
    adventure,
    seats: difficulties.map((d, i) => ({
      playerId: `ai-${i}`,
      displayName: `AI ${i}`,
      controller: {kind: 'ai', difficulty: d},
    })),
  });
  const startedAt = 1_000;
  const created = createGame(config, {now: startedAt});
  if (!created.ok) throw new Error(created.error.message);
  let state = created.value.state;
  const events: GameEvent[] = [...created.value.events];
  const actions: RecordedAction[] = [];
  const ais = new Map<string, AiPlayer>();
  let aiChoices = 0;

  for (let i = 0; i < maxActions && state.phase.kind !== 'finished'; i++) {
    const color = state.currentColor;
    let action: GameAction;
    if (state.phase.kind === 'awaiting_roll') {
      action = {
        type: 'ROLL_DICE',
        color,
        value: randomInt(dice, 1, 6) as 1 | 2 | 3 | 4 | 5 | 6,
      };
    } else {
      const player = state.players.find(p => p.color === color);
      const difficulty =
        player?.controller.kind === 'ai'
          ? player.controller.difficulty
          : 'easy';
      const ai =
        ais.get(color) ??
        createAi(difficulty, createSeededRandom(`${seed}:ai:${color}`));
      ais.set(color, ai);
      const frozen = deepFreeze(structuredClone(state));
      const intent = ai.chooseMove(
        frozen,
        frozen.phase.kind === 'awaiting_move' ? frozen.phase.legalMoves : []
      );
      aiChoices++;
      if (!state.phase.legalMoves.some(m => m.pawnIndex === intent.pawnIndex)) {
        throw new Error(`AI chose an illegal pawn ${intent.pawnIndex}`);
      }
      action = {type: 'MOVE_PAWN', color, pawnIndex: intent.pawnIndex};
    }
    const at = startedAt + i + 1;
    const result = applyAction(state, action, {now: at});
    if (!result.ok)
      throw new Error(`${result.error.code}: ${result.error.message}`);
    actions.push({action, at});
    state = result.value.state;
    events.push(...result.value.events);
  }
  return {final: state, events, actions, startedAt, aiChoices};
}
