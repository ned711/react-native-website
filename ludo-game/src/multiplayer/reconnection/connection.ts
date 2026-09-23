/**
 * Client-side reconnection state machine (pure). The UI subscribes to it; the
 * transport feeds it network events. The server keeps the match meanwhile.
 */
import {randomFloat, type RandomSource} from '../../utils/random.ts';

export type ConnectionStatus =
  | {readonly kind: 'connected'; readonly since: number}
  | {
      readonly kind: 'reconnecting';
      readonly since: number;
      readonly attempt: number;
      readonly nextAttemptAt: number;
    }
  | {readonly kind: 'offline'; readonly since: number};

export type ConnectionEvent =
  | {readonly type: 'CONNECTED'; readonly at: number}
  | {readonly type: 'DISCONNECTED'; readonly at: number}
  | {readonly type: 'ATTEMPT_FAILED'; readonly at: number}
  | {readonly type: 'APP_BACKGROUNDED'; readonly at: number}
  | {readonly type: 'APP_FOREGROUNDED'; readonly at: number};

export interface BackoffConfig {
  readonly baseMs: number;
  readonly maxMs: number;
  /** After this many failed attempts the client stops and shows "offline". */
  readonly maxAttempts: number;
  readonly jitter: number;
}

export const DEFAULT_BACKOFF: BackoffConfig = {
  baseMs: 500,
  maxMs: 15_000,
  maxAttempts: 12,
  jitter: 0.2,
};

export function backoffDelay(
  attempt: number,
  config: BackoffConfig,
  rng: RandomSource
): number {
  const raw = Math.min(
    config.maxMs,
    config.baseMs * 2 ** Math.max(0, attempt - 1)
  );
  const jitter = raw * config.jitter * (randomFloat(rng) * 2 - 1);
  return Math.max(0, Math.round(raw + jitter));
}

export function reduceConnection(
  status: ConnectionStatus,
  event: ConnectionEvent,
  config: BackoffConfig,
  rng: RandomSource
): ConnectionStatus {
  switch (event.type) {
    case 'CONNECTED':
      return {kind: 'connected', since: event.at};
    case 'DISCONNECTED':
    case 'APP_FOREGROUNDED':
      if (status.kind === 'connected' && event.type === 'APP_FOREGROUNDED')
        return status;
      return {
        kind: 'reconnecting',
        since: event.at,
        attempt: 1,
        nextAttemptAt: event.at + backoffDelay(1, config, rng),
      };
    case 'ATTEMPT_FAILED': {
      if (status.kind !== 'reconnecting') return status;
      const attempt = status.attempt + 1;
      if (attempt > config.maxAttempts)
        return {kind: 'offline', since: event.at};
      return {
        kind: 'reconnecting',
        since: status.since,
        attempt,
        nextAttemptAt: event.at + backoffDelay(attempt, config, rng),
      };
    }
    case 'APP_BACKGROUNDED':
      // The OS may kill sockets in background; the server keeps the seat.
      return status;
  }
}

/**
 * Snapshot synchronisation: the server's state is the source of truth. A
 * client whose version differs simply adopts the server snapshot; the events
 * after its version are replayed for animations only.
 */
export type SyncPlan =
  | {readonly kind: 'up_to_date'}
  | {readonly kind: 'adopt_snapshot'; readonly animateFromSeq: number | null}
  | {readonly kind: 'reject_stale_snapshot'};

export function planSync(
  localVersion: number | null,
  serverVersion: number,
  localEventSeq: number | null
): SyncPlan {
  if (localVersion === serverVersion) return {kind: 'up_to_date'};
  if (localVersion !== null && serverVersion < localVersion)
    return {kind: 'reject_stale_snapshot'};
  return {kind: 'adopt_snapshot', animateFromSeq: localEventSeq};
}
