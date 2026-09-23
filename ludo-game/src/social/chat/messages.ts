export const MAX_CHAT_LENGTH = 200;

export const QUICK_MESSAGES: readonly {
  readonly id: string;
  readonly text: string;
}[] = [
  {id: 'gg', text: 'Bien joué !'},
  {id: 'glhf', text: 'Bonne partie !'},
  {id: 'bravo', text: 'Bravo !'},
  {id: 'oops', text: 'Oups !'},
  {id: 'thanks', text: 'Merci !'},
];

export type ChatValidation =
  | {readonly ok: true; readonly body: string}
  | {readonly ok: false; readonly reason: 'empty' | 'too_long'};

/** Normalises a chat message. The server re-validates (see SQL send_chat_message). */
export function normalizeChatMessage(input: string): ChatValidation {
  // Remove control characters (keep emoji / letters), collapse whitespace.
  const body = input
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (body.length === 0) return {ok: false, reason: 'empty'};
  if ([...body].length > MAX_CHAT_LENGTH)
    return {ok: false, reason: 'too_long'};
  return {ok: true, body};
}
