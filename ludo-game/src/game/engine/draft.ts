/**
 * Internal mutable working copy used by the reducer. The public API only ever
 * exposes immutable `GameState` objects: `applyAction` clones the input first.
 */
import {
  PLAYER_COLORS,
  type DuelState,
  type GameConfig,
  type GamePhase,
  type GameState,
  type PlayerColor,
  type PlayerRanking,
  type PlayerState,
} from '../types.ts';
import type {
  GameEvent,
  GameEventOf,
  GameEventPayload,
  GameEventType,
} from '../events/types.ts';

export interface EngineContext {
  /** Injected clock (ms since epoch) - keeps the engine deterministic. */
  readonly now: number;
}

export interface Draft {
  readonly config: GameConfig;
  version: number;
  phase: GamePhase;
  currentColor: PlayerColor;
  turnNumber: number;
  consecutiveSixes: number;
  lastRoll: GameState['lastRoll'];
  pawns: Record<PlayerColor, number[]>;
  shields: Record<PlayerColor, boolean[]>;
  players: PlayerState[];
  finishOrder: PlayerColor[];
  leaveOrder: PlayerColor[];
  duel: DuelState | null;
  rankings: PlayerRanking[];
  eventSeq: number;
}

export function mapColors<T>(
  make: (color: PlayerColor) => T
): Record<PlayerColor, T> {
  const out = {} as Record<PlayerColor, T>;
  for (const color of PLAYER_COLORS) out[color] = make(color);
  return out;
}

export function toDraft(state: GameState): Draft {
  return {
    config: state.config,
    version: state.version,
    phase: state.phase,
    currentColor: state.currentColor,
    turnNumber: state.turnNumber,
    consecutiveSixes: state.consecutiveSixes,
    lastRoll: state.lastRoll,
    pawns: mapColors(c => [...state.pawns[c]]),
    shields: mapColors(c => [...state.shields[c]]),
    players: state.players.map(p => ({...p})),
    finishOrder: [...state.finishOrder],
    leaveOrder: [...state.leaveOrder],
    duel: state.duel,
    rankings: state.rankings.map(r => ({...r})),
    eventSeq: state.eventSeq,
  };
}

export class EventCollector {
  readonly events: GameEvent[] = [];
  constructor(
    private readonly draft: Draft,
    private readonly ctx: EngineContext
  ) {}

  emit<T extends GameEventType>(
    type: T,
    playerColor: PlayerColor | null,
    payload: GameEventPayload<T>
  ): void {
    this.draft.eventSeq += 1;
    const seq = this.draft.eventSeq;
    const event = {
      id: `${this.draft.config.matchId}:${seq}`,
      seq,
      type,
      timestamp: this.ctx.now,
      matchId: this.draft.config.matchId,
      playerColor,
      payload,
    } as GameEventOf<T>;
    this.events.push(event);
  }
}

export function getPlayer(
  draft: Pick<Draft, 'players'>,
  color: PlayerColor
): PlayerState | undefined {
  return draft.players.find(p => p.color === color);
}

export function updatePlayer(
  draft: Draft,
  color: PlayerColor,
  patch: Partial<PlayerState>
): void {
  draft.players = draft.players.map(p =>
    p.color === color ? {...p, ...patch} : p
  );
}
