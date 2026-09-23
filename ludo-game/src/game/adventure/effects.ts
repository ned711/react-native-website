/**
 * Applies the Adventure cell a pawn landed on. Effects never chain: a pawn
 * relocated by an effect does not trigger the destination cell.
 */
import {
  LAST_TRACK_POSITION,
  toGlobalTrackPosition,
} from '../board/constants.ts';
import {
  getPlayer,
  updatePlayer,
  type Draft,
  type EventCollector,
} from '../engine/draft.ts';
import type {PlayerColor} from '../types.ts';
import {adventureCellAt} from './generator.ts';

export interface AdventureOutcome {
  readonly bonusTurn: boolean;
  /** New relative position if the pawn was relocated. */
  readonly relocatedTo: number | null;
}

const NOTHING: AdventureOutcome = {bonusTurn: false, relocatedTo: null};

export function applyAdventureLanding(
  draft: Draft,
  events: EventCollector,
  color: PlayerColor,
  pawnIndex: number
): AdventureOutcome {
  const position = draft.pawns[color][pawnIndex];
  if (position === undefined) return NOTHING;
  const global = toGlobalTrackPosition(color, position);
  if (global === null) return NOTHING;
  const cell = adventureCellAt(draft.config.adventure, global);
  if (!cell) return NOTHING;

  let to = position;
  let bonusTurn = false;
  const player = getPlayer(draft, color);
  switch (cell.kind) {
    case 'prison':
    case 'freeze':
      updatePlayer(draft, color, {
        skipTurns: (player?.skipTurns ?? 0) + cell.magnitude,
      });
      break;
    case 'backward':
      to = Math.max(0, position - cell.magnitude);
      break;
    case 'boost':
    case 'teleport':
      to = Math.min(LAST_TRACK_POSITION, position + cell.magnitude);
      break;
    case 'treasure':
      updatePlayer(draft, color, {
        treasure: (player?.treasure ?? 0) + cell.magnitude,
      });
      break;
    case 'shield':
      draft.shields[color][pawnIndex] = true;
      break;
    case 'bonus_turn':
      bonusTurn = true;
      break;
  }
  draft.pawns[color][pawnIndex] = to;
  events.emit('ADVENTURE_EVENT_TRIGGERED', color, {
    pawnIndex,
    kind: cell.kind,
    magnitude: cell.magnitude,
    trackPosition: global,
    from: position,
    to,
  });
  return {bonusTurn, relocatedTo: to !== position ? to : null};
}
