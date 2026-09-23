import {SEAT_ORDER} from '../board/constants.ts';
import {
  getPlayer,
  updatePlayer,
  type Draft,
  type EventCollector,
} from '../engine/draft.ts';
import type {PlayerColor} from '../types.ts';

/** Seated colours in clockwise order starting after `from`. */
export function colorsAfter(
  draft: Pick<Draft, 'players'>,
  from: PlayerColor
): PlayerColor[] {
  const seated = SEAT_ORDER.filter(c => draft.players.some(p => p.color === c));
  const start = seated.indexOf(from);
  const out: PlayerColor[] = [];
  for (let i = 1; i <= seated.length; i++) {
    const c = seated[(start + i) % seated.length];
    if (c) out.push(c);
  }
  return out;
}

/**
 * Passes the turn to the next active player, consuming skip counters
 * (Adventure prison/freeze). Always terminates: each skip decrements a counter.
 */
export function endTurn(draft: Draft, events: EventCollector): void {
  draft.consecutiveSixes = 0;
  let cursor = draft.currentColor;
  for (let guard = 0; guard < 1000; guard++) {
    const candidates = colorsAfter(draft, cursor);
    const next = candidates.find(c => getPlayer(draft, c)?.status === 'active');
    if (!next) {
      draft.phase = {kind: 'awaiting_roll'};
      return;
    }
    const player = getPlayer(draft, next);
    if (player && player.skipTurns > 0) {
      updatePlayer(draft, next, {skipTurns: player.skipTurns - 1});
      events.emit('TURN_SKIPPED', next, {remainingSkips: player.skipTurns - 1});
      cursor = next;
      continue;
    }
    draft.currentColor = next;
    draft.turnNumber += 1;
    draft.phase = {kind: 'awaiting_roll'};
    events.emit('TURN_STARTED', next, {turnNumber: draft.turnNumber});
    return;
  }
  throw new Error('endTurn: turn rotation did not converge');
}
