/**
 * Offline match orchestration (vs computer, pass-and-play). Pure TypeScript:
 * the React hook only adds timers and animation gating on top of it.
 * Online matches do NOT use this class: the server is the authority there.
 */
import {createAi, type AiPlayer} from '../ai/ai.ts';
import {
  generateAdventureBoard,
  createAdventureSeed,
  isValidAdventureSeed,
} from '../adventure/generator.ts';
import {rollDie} from '../dice/dice.ts';
import type {GameAction} from '../engine/actions.ts';
import {applyAction, createGame} from '../engine/engine.ts';
import type {EngineError} from '../engine/errors.ts';
import type {GameEvent} from '../events/types.ts';
import type {RecordedAction} from '../replay/replay.ts';
import {buildGameConfig, type MatchFormat} from '../rules/seats.ts';
import type {
  AiDifficulty,
  EndGameMode,
  GameConfig,
  GameState,
  PlayerColor,
} from '../types.ts';
import type {RandomSource} from '../../utils/random.ts';
import {err, ok, type Result} from '../../utils/result.ts';

export interface LocalSetup {
  readonly matchId: string;
  readonly playMode: 'vs_computer' | 'local';
  readonly format: MatchFormat;
  readonly humanSeats: number;
  readonly humanNames: readonly string[];
  readonly aiDifficulty: AiDifficulty;
  readonly endGameMode: EndGameMode;
  readonly adventure: boolean;
  readonly adventureSeed: string | null;
}

export function buildLocalConfig(
  setup: LocalSetup,
  random: RandomSource
): GameConfig {
  const seatCount = setup.format === '2p' ? 2 : setup.format === '3p' ? 3 : 4;
  const humans =
    setup.playMode === 'vs_computer'
      ? 1
      : Math.max(1, Math.min(seatCount, setup.humanSeats));
  const seed =
    setup.adventure &&
    setup.adventureSeed &&
    isValidAdventureSeed(setup.adventureSeed)
      ? setup.adventureSeed
      : createAdventureSeed(random);
  return buildGameConfig({
    matchId: setup.matchId,
    mode:
      setup.playMode === 'vs_computer'
        ? 'classic'
        : humans === seatCount
          ? 'local'
          : 'mixed',
    format: setup.format,
    endGameMode: setup.endGameMode,
    adventure: setup.adventure ? generateAdventureBoard(seed) : null,
    seats: Array.from({length: seatCount}, (_, i) =>
      i < humans
        ? {
            playerId: `local-${i + 1}`,
            displayName: setup.humanNames[i] ?? `Joueur ${i + 1}`,
            controller: {kind: 'human' as const},
          }
        : {
            playerId: `ai-${i + 1}`,
            displayName: `Ordinateur ${i + 1 - humans}`,
            controller: {kind: 'ai' as const, difficulty: setup.aiDifficulty},
          }
    ),
  });
}

export type LocalMatchListener = (
  state: GameState,
  events: readonly GameEvent[]
) => void;

export class LocalMatch {
  private current: GameState;
  private readonly listeners = new Set<LocalMatchListener>();
  private readonly ais = new Map<PlayerColor, AiPlayer>();
  readonly actions: RecordedAction[] = [];
  readonly startedAt: number;

  constructor(
    readonly config: GameConfig,
    private readonly dice: RandomSource,
    private readonly aiRandom: RandomSource,
    private readonly now: () => number
  ) {
    this.startedAt = now();
    const created = createGame(config, {now: this.startedAt});
    if (!created.ok) throw new Error(created.error.message);
    this.current = created.value.state;
  }

  get state(): GameState {
    return this.current;
  }

  subscribe(listener: LocalMatchListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  currentPlayer() {
    return this.current.players.find(
      p => p.color === this.current.currentColor
    );
  }

  isHumanTurn(): boolean {
    return (
      this.current.phase.kind !== 'finished' &&
      this.currentPlayer()?.controller.kind === 'human'
    );
  }

  isAiTurn(): boolean {
    return (
      this.current.phase.kind !== 'finished' &&
      this.currentPlayer()?.controller.kind === 'ai'
    );
  }

  private apply(action: GameAction): Result<readonly GameEvent[], EngineError> {
    const at = this.now();
    const result = applyAction(this.current, action, {now: at});
    if (!result.ok) return err(result.error);
    this.current = result.value.state;
    this.actions.push({action, at});
    for (const listener of [...this.listeners])
      listener(this.current, result.value.events);
    return ok(result.value.events);
  }

  /** Human roll: the dice value comes from the device CSPRNG, never from the UI. */
  humanRoll(): Result<readonly GameEvent[], EngineError> | null {
    if (!this.isHumanTurn() || this.current.phase.kind !== 'awaiting_roll')
      return null;
    return this.apply({
      type: 'ROLL_DICE',
      color: this.current.currentColor,
      value: rollDie(this.dice),
    });
  }

  humanMove(
    pawnIndex: number
  ): Result<readonly GameEvent[], EngineError> | null {
    if (!this.isHumanTurn()) return null;
    return this.apply({
      type: 'MOVE_PAWN',
      color: this.current.currentColor,
      pawnIndex,
    });
  }

  /** One AI step (roll or move). The AI only produces a MoveIntent. */
  aiStep(): Result<readonly GameEvent[], EngineError> | null {
    if (!this.isAiTurn()) return null;
    const player = this.currentPlayer();
    if (!player || player.controller.kind !== 'ai') return null;
    if (this.current.phase.kind === 'awaiting_roll') {
      return this.apply({
        type: 'ROLL_DICE',
        color: player.color,
        value: rollDie(this.dice),
      });
    }
    if (this.current.phase.kind !== 'awaiting_move') return null;
    let ai = this.ais.get(player.color);
    if (!ai) {
      ai = createAi(player.controller.difficulty, this.aiRandom);
      this.ais.set(player.color, ai);
    }
    const intent = ai.chooseMove(this.current, this.current.phase.legalMoves);
    return this.apply({
      type: 'MOVE_PAWN',
      color: player.color,
      pawnIndex: intent.pawnIndex,
    });
  }

  leave(color: PlayerColor): Result<readonly GameEvent[], EngineError> {
    return this.apply({type: 'LEAVE', color, reason: 'quit'});
  }

  humanColors(): PlayerColor[] {
    return this.current.players
      .filter(p => p.controller.kind === 'human')
      .map(p => p.color);
  }
}
