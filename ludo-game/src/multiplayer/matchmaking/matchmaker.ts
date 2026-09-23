/**
 * Pure matchmaking algorithm (the server runs it on its queue).
 *
 * - Parties (friends queuing together) are never split.
 * - 2v2: a party of two forms one team; two solos may be paired as a team.
 * - Oldest tickets are served first (FIFO fairness).
 * - Optionally, after `fillWithAiAfterMs`, incomplete lobbies are completed
 *   with algorithmic AI seats (never presented as humans).
 */
import type {MatchFormat} from '../../game/rules/seats.ts';

export interface QueueTicket {
  readonly ticketId: string;
  readonly memberIds: readonly string[];
  readonly format: MatchFormat;
  readonly enqueuedAt: number;
}

export interface FormedMatch {
  readonly format: MatchFormat;
  readonly tickets: readonly QueueTicket[];
  /** Seat order: each inner array is a party, teams listed in order for 2v2. */
  readonly humanIds: readonly string[];
  readonly aiSeats: number;
  readonly teams: readonly (readonly string[])[] | null;
}

export interface MatchmakingOptions {
  readonly fillWithAiAfterMs: number | null;
}

export const SEATS_BY_FORMAT: Readonly<Record<MatchFormat, number>> = {
  '2p': 2,
  '3p': 3,
  '4p': 4,
  '2v2': 4,
};

export function validateTicket(ticket: QueueTicket): string | null {
  const seats = SEATS_BY_FORMAT[ticket.format];
  if (ticket.memberIds.length === 0) return 'empty party';
  if (new Set(ticket.memberIds).size !== ticket.memberIds.length)
    return 'duplicate member';
  if (ticket.format === '2v2' && ticket.memberIds.length > 2)
    return 'a 2v2 party has at most 2 players';
  if (ticket.memberIds.length > seats) return 'party larger than the match';
  return null;
}

/** Finds a subset of tickets (oldest first) whose sizes sum to `seats`. */
function pack(
  tickets: readonly QueueTicket[],
  seats: number
): QueueTicket[] | null {
  const chosen: QueueTicket[] = [];
  const search = (start: number, remaining: number): boolean => {
    if (remaining === 0) return true;
    for (let i = start; i < tickets.length; i++) {
      const t = tickets[i];
      if (!t || t.memberIds.length > remaining) continue;
      chosen.push(t);
      if (search(i + 1, remaining - t.memberIds.length)) return true;
      chosen.pop();
    }
    return false;
  };
  return search(0, seats) ? chosen : null;
}

function teamsFor(tickets: readonly QueueTicket[]): string[][] {
  // Duos are a team; solos are paired in queue order.
  const teams: string[][] = tickets
    .filter(t => t.memberIds.length === 2)
    .map(t => [...t.memberIds]);
  const solos = tickets
    .filter(t => t.memberIds.length === 1)
    .flatMap(t => t.memberIds);
  for (let i = 0; i + 1 < solos.length; i += 2)
    teams.push([solos[i] as string, solos[i + 1] as string]);
  return teams;
}

export function runMatchmaking(
  queue: readonly QueueTicket[],
  now: number,
  options: MatchmakingOptions
): {readonly matches: FormedMatch[]; readonly remaining: QueueTicket[]} {
  const matches: FormedMatch[] = [];
  let remaining = [...queue]
    .filter(t => validateTicket(t) === null)
    .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  const formats: MatchFormat[] = ['2p', '3p', '4p', '2v2'];
  for (const format of formats) {
    const seats = SEATS_BY_FORMAT[format];
    for (;;) {
      const pool = remaining.filter(t => t.format === format);
      const oldest = pool[0];
      if (!oldest) break;
      // Always include the oldest ticket so nobody starves.
      const rest = pack(pool.slice(1), seats - oldest.memberIds.length);
      if (rest) {
        const tickets = [oldest, ...rest];
        matches.push({
          format,
          tickets,
          humanIds: tickets.flatMap(t => t.memberIds),
          aiSeats: 0,
          teams: format === '2v2' ? teamsFor(tickets) : null,
        });
        remaining = remaining.filter(t => !tickets.includes(t));
        continue;
      }
      if (
        options.fillWithAiAfterMs !== null &&
        now - oldest.enqueuedAt >= options.fillWithAiAfterMs
      ) {
        // Greedily add other waiting tickets, then complete with AI seats.
        const tickets = [oldest];
        let used = oldest.memberIds.length;
        for (const t of pool.slice(1)) {
          if (used + t.memberIds.length <= seats) {
            tickets.push(t);
            used += t.memberIds.length;
          }
        }
        matches.push({
          format,
          tickets,
          humanIds: tickets.flatMap(t => t.memberIds),
          aiSeats: seats - used,
          teams: format === '2v2' ? teamsFor(tickets) : null,
        });
        remaining = remaining.filter(t => !tickets.includes(t));
        continue;
      }
      break;
    }
  }
  return {matches, remaining};
}
