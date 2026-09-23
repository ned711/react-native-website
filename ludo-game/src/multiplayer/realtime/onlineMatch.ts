/**
 * Online match client (pure orchestration, no React). The server is the
 * source of truth: the client only sends intents and adopts server snapshots.
 *
 * - one intent in flight at a time (no double submission);
 * - snapshots are adopted only if newer than the local version;
 * - STALE_VERSION / CONFLICT -> resynchronisation from the server;
 * - channel loss -> reconnection with exponential backoff, then resync.
 */
import type {GameEvent} from '../../game/events/types.ts';
import {matchRolesFor, rolesCan} from '../../game/spectator/permissions.ts';
import type {GameState, PlayerColor} from '../../game/types.ts';
import type {RandomSource} from '../../utils/random.ts';
import {
  DEFAULT_BACKOFF,
  planSync,
  reduceConnection,
  type BackoffConfig,
  type ConnectionStatus,
} from '../reconnection/connection.ts';
import type {ClientIntent} from '../authority/intents.ts';
import type {MatchTransport} from './transport.ts';

export interface OnlineSnapshot {
  readonly state: GameState | null;
  readonly connection: ConnectionStatus;
  readonly pending: boolean;
  readonly lastError: string | null;
}

export interface Scheduler {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export type OnlineListener = (
  snapshot: OnlineSnapshot,
  events: readonly GameEvent[]
) => void;

const RESYNC_CODES = new Set(['STALE_VERSION', 'CONFLICT', 'NETWORK']);

export class OnlineMatchController {
  private state: GameState | null = null;
  private connection: ConnectionStatus;
  private pending = false;
  private lastError: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private retryHandle: unknown = null;
  private readonly listeners = new Set<OnlineListener>();
  private stopped = false;

  constructor(
    readonly matchId: string,
    readonly userId: string,
    private readonly transport: MatchTransport,
    private readonly scheduler: Scheduler,
    private readonly jitter: RandomSource,
    private readonly backoff: BackoffConfig = DEFAULT_BACKOFF
  ) {
    this.connection = {
      kind: 'reconnecting',
      since: scheduler.now(),
      attempt: 1,
      nextAttemptAt: scheduler.now(),
    };
  }

  snapshot(): OnlineSnapshot {
    return {
      state: this.state,
      connection: this.connection,
      pending: this.pending,
      lastError: this.lastError,
    };
  }

  subscribe(listener: OnlineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(events: readonly GameEvent[] = []): void {
    const snap = this.snapshot();
    for (const l of [...this.listeners]) l(snap, events);
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.retryHandle !== null)
      this.scheduler.clearTimeout(this.retryHandle);
    this.retryHandle = null;
  }

  private connect(): void {
    this.unsubscribe?.();
    this.unsubscribe = this.transport.subscribe(this.matchId, {
      onState: state => this.adopt(state, []),
      onEvents: events => {
        if (events.length > 0) this.emit(events);
      },
      onStatus: status => {
        if (this.stopped) return;
        if (status === 'SUBSCRIBED') {
          this.connection = reduceConnection(
            this.connection,
            {type: 'CONNECTED', at: this.scheduler.now()},
            this.backoff,
            this.jitter
          );
          void this.resync();
        } else {
          this.handleDisconnect();
        }
      },
    });
  }

  private handleDisconnect(): void {
    const at = this.scheduler.now();
    this.connection =
      this.connection.kind === 'reconnecting'
        ? reduceConnection(
            this.connection,
            {type: 'ATTEMPT_FAILED', at},
            this.backoff,
            this.jitter
          )
        : reduceConnection(
            this.connection,
            {type: 'DISCONNECTED', at},
            this.backoff,
            this.jitter
          );
    this.emit();
    if (this.connection.kind !== 'reconnecting') return; // offline: user must retry
    const delay = Math.max(0, this.connection.nextAttemptAt - at);
    if (this.retryHandle !== null)
      this.scheduler.clearTimeout(this.retryHandle);
    this.retryHandle = this.scheduler.setTimeout(() => {
      this.retryHandle = null;
      if (!this.stopped) this.connect();
    }, delay);
  }

  /** Manual retry after the client gave up (status "offline"). */
  retry(): void {
    this.connection = reduceConnection(
      this.connection,
      {type: 'DISCONNECTED', at: this.scheduler.now()},
      this.backoff,
      this.jitter
    );
    this.connect();
  }

  async resync(): Promise<void> {
    const result = await this.transport.fetchSnapshot(this.matchId);
    if (result.ok) this.adopt(result.value, []);
    else {
      this.lastError = result.error.message;
      this.emit();
    }
  }

  private adopt(server: GameState, events: readonly GameEvent[]): void {
    const plan = planSync(
      this.state?.version ?? null,
      server.version,
      this.state?.eventSeq ?? null
    );
    if (plan.kind === 'adopt_snapshot') this.state = server;
    this.emit(plan.kind === 'adopt_snapshot' ? events : []);
  }

  myColor(): PlayerColor | null {
    return (
      this.state?.players.find(p => p.playerId === this.userId)?.color ?? null
    );
  }

  canAct(): boolean {
    const s = this.state;
    if (!s || this.pending || this.connection.kind !== 'connected')
      return false;
    const me = s.players.find(p => p.playerId === this.userId);
    return (
      !!me &&
      me.controller.kind === 'human' &&
      s.currentColor === me.color &&
      rolesCan(matchRolesFor(s, this.userId), 'ROLL_DICE')
    );
  }

  roll(): Promise<boolean> {
    const s = this.state;
    if (!s || s.phase.kind !== 'awaiting_roll' || !this.canAct())
      return Promise.resolve(false);
    return this.send({
      type: 'ROLL_DICE',
      matchId: this.matchId,
      expectedVersion: s.version,
    });
  }

  move(pawnIndex: number): Promise<boolean> {
    const s = this.state;
    if (!s || s.phase.kind !== 'awaiting_move' || !this.canAct())
      return Promise.resolve(false);
    if (!s.phase.legalMoves.some(m => m.pawnIndex === pawnIndex))
      return Promise.resolve(false);
    return this.send({
      type: 'MOVE_PAWN',
      matchId: this.matchId,
      expectedVersion: s.version,
      pawnIndex,
    });
  }

  leave(): Promise<boolean> {
    return this.send({type: 'LEAVE_MATCH', matchId: this.matchId});
  }

  private async send(intent: ClientIntent): Promise<boolean> {
    if (this.pending) return false;
    this.pending = true;
    this.lastError = null;
    this.emit();
    try {
      const result = await this.transport.sendIntent(intent);
      if (result.ok) {
        this.pending = false;
        this.adopt(result.value.state, result.value.events);
        return true;
      }
      this.pending = false;
      this.lastError = result.error.code;
      this.emit();
      if (RESYNC_CODES.has(result.error.code)) await this.resync();
      return false;
    } catch (error) {
      this.pending = false;
      this.lastError = error instanceof Error ? error.message : String(error);
      this.emit();
      return false;
    }
  }
}
