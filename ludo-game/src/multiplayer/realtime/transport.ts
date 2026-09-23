import type {GameEvent} from '../../game/events/types.ts';
import type {GameState} from '../../game/types.ts';
import type {Result} from '../../utils/result.ts';
import type {ClientIntent} from '../authority/intents.ts';

export interface TransportError {
  /** Authority error code (NOT_YOUR_TURN, STALE_VERSION, CONFLICT...) or NETWORK. */
  readonly code: string;
  readonly message: string;
}

export interface IntentAccepted {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export type ChannelStatus = 'SUBSCRIBED' | 'CLOSED' | 'ERROR';

export interface MatchSubscription {
  readonly onState: (state: GameState) => void;
  readonly onEvents: (events: readonly GameEvent[]) => void;
  readonly onStatus: (status: ChannelStatus) => void;
}

/**
 * Network port of the online client. The Supabase implementation lives in
 * supabaseTransport.ts; tests plug it into an in-memory MatchAuthority.
 */
export interface MatchTransport {
  sendIntent(
    intent: ClientIntent
  ): Promise<Result<IntentAccepted, TransportError>>;
  /** Current authoritative snapshot (readable by players and spectators via RLS). */
  fetchSnapshot(matchId: string): Promise<Result<GameState, TransportError>>;
  subscribe(matchId: string, handlers: MatchSubscription): () => void;
}
