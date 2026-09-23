import {describe, expect, it} from 'vitest';
import {
  buildGameConfig,
  createGame,
  OPPOSITE_TEAMS,
  teamIndexOf,
} from '../../src/game/index.ts';
import {
  runMatchmaking,
  type QueueTicket,
} from '../../src/multiplayer/matchmaking/matchmaker.ts';
import {planSeats} from '../../src/multiplayer/matchmaking/plan.ts';

const t = (
  id: string,
  members: string[],
  format: QueueTicket['format'],
  at = 0
): QueueTicket => ({
  ticketId: id,
  memberIds: members,
  format,
  enqueuedAt: at,
});

function formedFor(queue: QueueTicket[], now = 100_000) {
  const formed = runMatchmaking(queue, now, {fillWithAiAfterMs: 30_000})
    .matches[0];
  if (!formed) throw new Error('no match formed');
  return formed;
}

describe('matchmaking seat plan', () => {
  it('2v2: duo partners are teammates in the engine', () => {
    const seats = planSeats(
      formedFor([
        t('d', ['A', 'B'], '2v2'),
        t('s1', ['C'], '2v2'),
        t('s2', ['D'], '2v2'),
      ]),
      id => id
    );
    const color = (id: string) => seats.find(s => s.userId === id)?.color;
    const teamA = teamIndexOf(OPPOSITE_TEAMS, color('A') ?? 'green');
    expect(teamIndexOf(OPPOSITE_TEAMS, color('B') ?? 'green')).toBe(teamA);
    expect(teamIndexOf(OPPOSITE_TEAMS, color('C') ?? 'green')).not.toBe(teamA);
    expect(teamIndexOf(OPPOSITE_TEAMS, color('D') ?? 'green')).not.toBe(teamA);
  });

  it('2v2 with AI fill: a lone player gets an AI partner (no player dropped)', () => {
    const seats = planSeats(
      formedFor([t('d', ['A', 'B'], '2v2'), t('s', ['C'], '2v2')]),
      id => id
    );
    expect(
      seats
        .filter(s => s.userId !== null)
        .map(s => s.userId)
        .sort()
    ).toEqual(['A', 'B', 'C']);
    expect(seats.filter(s => s.userId === null)).toHaveLength(1);
    const cColor = seats.find(s => s.userId === 'C')?.color ?? 'green';
    const partner = seats.find(
      s =>
        s.color !== cColor &&
        teamIndexOf(OPPOSITE_TEAMS, s.color) ===
          teamIndexOf(OPPOSITE_TEAMS, cColor)
    );
    expect(partner?.userId).toBeNull();
  });

  it('D: two friends + two AI in a 4-player match produce a valid game', () => {
    const formed = formedFor([t('p', ['A', 'B'], '4p')]);
    const seats = planSeats(formed, id => `Player ${id}`);
    expect(seats.map(s => s.userId)).toEqual(['A', 'B', null, null]);
    const config = buildGameConfig({
      matchId: 'mm',
      mode: 'mixed',
      format: '4p',
      endGameMode: 'all_players',
      seats: seats.map(s => s.seat),
    });
    expect(createGame(config, {now: 0}).ok).toBe(true);
    expect(new Set(seats.map(s => s.seat.playerId)).size).toBe(4);
  });
});
