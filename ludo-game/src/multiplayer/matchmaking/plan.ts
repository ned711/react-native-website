/**
 * Turns a formed matchmaking group into seats for the engine. Pure: the
 * server worker uses it, tests cover it.
 */
import {FORMAT_COLORS} from '../../game/rules/seats.ts';
import type {PlayerColor, SeatConfig} from '../../game/types.ts';
import type {FormedMatch} from './matchmaker.ts';

export interface PlannedSeat {
  readonly color: PlayerColor;
  readonly seat: Omit<SeatConfig, 'color'>;
  /** Auth user id for human seats, null for AI seats. */
  readonly userId: string | null;
}

export function planSeats(
  formed: FormedMatch,
  displayName: (userId: string) => string
): PlannedSeat[] {
  const colors = FORMAT_COLORS[formed.format];
  let aiIndex = 0;
  const ai = (): PlannedSeat['seat'] => ({
    playerId: `ai:${aiIndex++}`,
    displayName: `Bot ${aiIndex}`,
    controller: {kind: 'ai', difficulty: 'normal'},
  });
  const human = (id: string): PlannedSeat['seat'] => ({
    playerId: id,
    displayName: displayName(id),
    controller: {kind: 'human'},
  });

  let ordered: (string | null)[];
  if (formed.format === '2v2') {
    // Every human belongs to a team; incomplete teams are padded with AI.
    const teams: (string | null)[][] = (formed.teams ?? []).map(t => [...t]);
    for (const id of formed.humanIds) {
      if (!teams.some(t => t.includes(id))) teams.push([id]);
    }
    while (teams.length < 2) teams.push([]);
    if (teams.length > 2)
      throw new RangeError('more than two teams in a 2v2 match');
    const [t0, t1] = teams.map(t => [...t, null, null].slice(0, 2)) as [
      (string | null)[],
      (string | null)[],
    ];
    // OPPOSITE_TEAMS: green+blue vs yellow+red; colours are green, yellow, blue, red.
    ordered = [t0[0] ?? null, t1[0] ?? null, t0[1] ?? null, t1[1] ?? null];
  } else {
    ordered = [...formed.humanIds];
    while (ordered.length < colors.length) ordered.push(null);
  }
  if (ordered.length !== colors.length)
    throw new RangeError('seat count mismatch');
  return ordered.map((id, i) => ({
    color: colors[i] as PlayerColor,
    seat: id ? human(id) : ai(),
    userId: id,
  }));
}
