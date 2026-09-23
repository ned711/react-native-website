/**
 * Replay: a match is fully described by its config and its ordered action log
 * (dice values included). Re-running the pure reducer reproduces every state
 * and every event - used for replays, spectators joining late, audits and
 * server-side verification.
 */
import type {GameAction} from '../engine/actions.ts';
import {applyAction, createGame} from '../engine/engine.ts';
import type {EngineError} from '../engine/errors.ts';
import type {GameEvent} from '../events/types.ts';
import type {GameConfig, GameState} from '../types.ts';
import {err, ok, type Result} from '../../utils/result.ts';

export interface RecordedAction {
  readonly action: GameAction;
  /** Timestamp used when the action was applied (keeps events identical). */
  readonly at: number;
}

export interface MatchRecord {
  readonly config: GameConfig;
  readonly startedAt: number;
  readonly actions: readonly RecordedAction[];
}

export interface ReplayResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly appliedActions: number;
}

export interface ReplayError {
  readonly actionIndex: number;
  readonly error: EngineError;
}

/** Replays `record`, optionally stopping after `upTo` actions. */
export function replayMatch(
  record: MatchRecord,
  upTo?: number
): Result<ReplayResult, ReplayError> {
  const created = createGame(record.config, {now: record.startedAt});
  if (!created.ok) return err({actionIndex: -1, error: created.error});
  let state = created.value.state;
  const events: GameEvent[] = [...created.value.events];
  const limit = Math.min(upTo ?? record.actions.length, record.actions.length);
  for (let i = 0; i < limit; i++) {
    const entry = record.actions[i];
    if (!entry) break;
    const result = applyAction(state, entry.action, {now: entry.at});
    if (!result.ok) return err({actionIndex: i, error: result.error});
    state = result.value.state;
    events.push(...result.value.events);
  }
  return ok({state, events, appliedActions: limit});
}
