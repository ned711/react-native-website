/**
 * Match chat over Supabase (send_chat_message RPC + Realtime inserts).
 * STATUS: PRÉPARÉ - the SQL (validation, rate limit, block filtering) is
 * tested on PostgreSQL; this client has not run against a live project.
 */
import {normalizeChatMessage} from '../social/chat/messages.ts';
import type {ChatMessage} from '../social/chat/chatLog.ts';
import {checkRateLimit, RATE_LIMITS} from '../social/rateLimit.ts';
import {err, ok, type Result} from '../utils/result.ts';
import {getSupabase} from './backend.ts';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function toChatMessage(row: unknown): ChatMessage | null {
  if (!isRecord(row)) return null;
  const {id, sender_id: senderId, body, created_at: createdAt} = row;
  if (
    typeof id !== 'string' ||
    typeof senderId !== 'string' ||
    typeof body !== 'string'
  )
    return null;
  const at = typeof createdAt === 'string' ? Date.parse(createdAt) : NaN;
  return {id, senderId, body, createdAt: Number.isFinite(at) ? at : 0};
}

export async function loadMatchChat(
  matchId: string
): Promise<Result<ChatMessage[], string>> {
  const client = getSupabase();
  if (!client) return err('Supabase non configuré');
  const {data, error} = await client
    .from('chat_messages')
    .select('id, sender_id, body, created_at')
    .eq('match_id', matchId)
    .order('created_at', {ascending: false})
    .limit(50);
  if (error) return err(error.message);
  return ok(
    (data ?? []).map(toChatMessage).filter((m): m is ChatMessage => m !== null)
  );
}

let history: readonly number[] = [];

/** Client-side checks give instant feedback; the server enforces the real rules. */
export async function sendMatchChat(
  matchId: string,
  input: string
): Promise<Result<null, string>> {
  const client = getSupabase();
  if (!client) return err('Supabase non configuré');
  const normalized = normalizeChatMessage(input);
  if (!normalized.ok)
    return err(
      normalized.reason === 'empty'
        ? 'Message vide'
        : 'Message trop long (200 max)'
    );
  const decision = checkRateLimit(history, Date.now(), RATE_LIMITS.chat);
  if (!decision.allowed)
    return err(
      `Trop de messages, réessayez dans ${Math.ceil(decision.retryAfterMs / 1000)} s`
    );
  history = decision.history;
  const {error} = await client.rpc('send_chat_message', {
    p_room: null,
    p_match: matchId,
    p_body: normalized.body,
  });
  return error ? err(error.message) : ok(null);
}

export function subscribeMatchChat(
  matchId: string,
  onMessage: (m: ChatMessage) => void
): () => void {
  const client = getSupabase();
  if (!client) return () => undefined;
  const channel = client
    .channel(`chat:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `match_id=eq.${matchId}`,
      },
      payload => {
        const m = toChatMessage(payload.new);
        if (m) onMessage(m);
      }
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
