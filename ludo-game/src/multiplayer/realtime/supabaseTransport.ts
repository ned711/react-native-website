/**
 * Supabase implementation of MatchTransport. STATUS: PRÉPARÉ - type-checked;
 * the protocol is tested against the real authority with an in-memory
 * transport, but this adapter has not run against a live project yet.
 */
import type {SupabaseClient} from '@supabase/supabase-js';
import type {GameEvent} from '../../game/events/types.ts';
import type {GameState} from '../../game/types.ts';
import {err, ok, type Result} from '../../utils/result.ts';
import type {
  ChannelStatus,
  IntentAccepted,
  MatchTransport,
  TransportError,
} from './transport.ts';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Structural check of a server snapshot before the UI uses it. */
export function isGameStateLike(v: unknown): v is GameState {
  return (
    isRecord(v) &&
    typeof v['version'] === 'number' &&
    isRecord(v['phase']) &&
    typeof v['phase']['kind'] === 'string' &&
    Array.isArray(v['players']) &&
    isRecord(v['pawns']) &&
    isRecord(v['config'])
  );
}

async function errorFrom(error: {
  message: string;
  context?: unknown;
}): Promise<TransportError> {
  const ctx = error.context;
  if (typeof Response !== 'undefined' && ctx instanceof Response) {
    try {
      const body: unknown = await ctx.json();
      if (isRecord(body) && typeof body['error'] === 'string') {
        return {
          code: body['error'],
          message:
            typeof body['message'] === 'string'
              ? body['message']
              : body['error'],
        };
      }
    } catch {
      // fall through
    }
  }
  return {code: 'NETWORK', message: error.message};
}

export function createSupabaseTransport(
  client: SupabaseClient
): MatchTransport {
  return {
    async sendIntent(intent): Promise<Result<IntentAccepted, TransportError>> {
      const {data, error} = await client.functions.invoke('match-action', {
        body: intent,
      });
      if (error) return err(await errorFrom(error));
      if (
        !isRecord(data) ||
        !isGameStateLike(data['state']) ||
        !Array.isArray(data['events'])
      ) {
        return err({
          code: 'BAD_RESPONSE',
          message: 'réponse serveur inattendue',
        });
      }
      return ok({state: data['state'], events: data['events'] as GameEvent[]});
    },
    async fetchSnapshot(matchId) {
      const {data, error} = await client
        .from('matches')
        .select('state')
        .eq('id', matchId)
        .maybeSingle();
      if (error) return err({code: 'NETWORK', message: error.message});
      const state: unknown = data?.state;
      return isGameStateLike(state)
        ? ok(state)
        : err({code: 'MATCH_NOT_FOUND', message: 'partie introuvable'});
    },
    subscribe(matchId, handlers) {
      const channel = client
        .channel(`match:${matchId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'matches',
            filter: `id=eq.${matchId}`,
          },
          payload => {
            const state: unknown = isRecord(payload.new)
              ? payload.new['state']
              : null;
            if (isGameStateLike(state)) handlers.onState(state);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'game_events',
            filter: `match_id=eq.${matchId}`,
          },
          payload => {
            const events: unknown = isRecord(payload.new)
              ? payload.new['events']
              : null;
            if (Array.isArray(events)) handlers.onEvents(events as GameEvent[]);
          }
        )
        .subscribe(status => {
          const mapped: ChannelStatus =
            status === 'SUBSCRIBED'
              ? 'SUBSCRIBED'
              : status === 'CLOSED'
                ? 'CLOSED'
                : 'ERROR';
          handlers.onStatus(mapped);
        });
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
