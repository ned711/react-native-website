import type {GameEvent} from '../game/events/types.ts';
import type {GameState, PlayerColor} from '../game/types.ts';

const ADVENTURE_LABEL: Readonly<Record<string, string>> = {
  prison: 'prison',
  freeze: 'gel',
  backward: 'recul',
  boost: 'boost',
  teleport: 'téléportation',
  treasure: 'trésor',
  shield: 'bouclier',
  bonus_turn: 'tour bonus',
};

function nameOf(state: GameState, color: PlayerColor | null): string {
  if (!color) return '';
  return state.players.find(p => p.color === color)?.displayName ?? color;
}

/** Short French log line for the in-game feed (null = not shown). */
export function describeEvent(
  event: GameEvent,
  state: GameState
): string | null {
  const who = nameOf(state, event.playerColor);
  switch (event.type) {
    case 'DICE_ROLLED':
      return `${who} fait ${event.payload.value}`;
    case 'NO_LEGAL_MOVE':
      return `${who} ne peut pas jouer`;
    case 'TURN_FORFEITED':
      return `${who} perd son tour (trois 6)`;
    case 'TURN_SKIPPED':
      return `${who} passe son tour`;
    case 'PAWN_SPAWNED':
      return `${who} sort un pion`;
    case 'PAWN_CAPTURED':
      return `${nameOf(state, event.payload.attacker)} capture un pion de ${nameOf(state, event.payload.victim)} !`;
    case 'CAPTURE_BLOCKED_BY_SHIELD':
      return `Le bouclier de ${nameOf(state, event.payload.victim)} bloque la capture`;
    case 'PAWN_FINISHED':
      return `${who} amène un pion au centre (${event.payload.finishedPawns}/4)`;
    case 'ADVENTURE_EVENT_TRIGGERED':
      return `${who} déclenche : ${ADVENTURE_LABEL[event.payload.kind] ?? event.payload.kind}`;
    case 'PLAYER_FINISHED':
      return `${who} termine ${event.payload.place === 1 ? '1er' : `${event.payload.place}e`} !`;
    case 'DUEL_STARTED':
      return `DUEL FINAL : ${nameOf(state, event.payload.colors[0])} contre ${nameOf(state, event.payload.colors[1])}`;
    case 'PLAYER_LEFT':
      return `${who} quitte la partie`;
    case 'GAME_FINISHED':
      return 'Partie terminée';
    default:
      return null;
  }
}
