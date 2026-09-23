/** Ordered, de-duplicated chat log (pure). Realtime may deliver duplicates or out of order. */
export interface ChatMessage {
  readonly id: string;
  readonly senderId: string;
  readonly body: string;
  readonly createdAt: number;
}

export const CHAT_LOG_LIMIT = 100;

export function mergeChat(
  current: readonly ChatMessage[],
  incoming: readonly ChatMessage[],
  blocked: ReadonlySet<string> = new Set(),
  limit: number = CHAT_LOG_LIMIT
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of [...current, ...incoming]) {
    if (!blocked.has(m.senderId)) byId.set(m.id, m);
  }
  return [...byId.values()]
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    .slice(-limit);
}
