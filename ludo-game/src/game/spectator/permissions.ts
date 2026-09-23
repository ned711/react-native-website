/**
 * Role based permissions for match participants. Gameplay capabilities are
 * reserved to seated, still-active players; spectators (including players who
 * already finished) may only watch and use social features.
 */
import type {GameState} from '../types.ts';

export type ParticipantRole = 'PLAYER' | 'SPECTATOR' | 'ROOM_OWNER' | 'ADMIN';

export type Capability =
  | 'VIEW_MATCH'
  | 'ROLL_DICE'
  | 'MOVE_PAWN'
  | 'SEND_CHAT'
  | 'SEND_GIFT'
  | 'START_MATCH'
  | 'LOCK_ROOM'
  | 'KICK_PLAYER'
  | 'MODERATE_CHAT';

const MATRIX: Readonly<Record<ParticipantRole, readonly Capability[]>> = {
  PLAYER: ['VIEW_MATCH', 'ROLL_DICE', 'MOVE_PAWN', 'SEND_CHAT', 'SEND_GIFT'],
  SPECTATOR: ['VIEW_MATCH', 'SEND_CHAT', 'SEND_GIFT'],
  ROOM_OWNER: [
    'VIEW_MATCH',
    'SEND_CHAT',
    'SEND_GIFT',
    'START_MATCH',
    'LOCK_ROOM',
    'KICK_PLAYER',
  ],
  ADMIN: ['VIEW_MATCH', 'MODERATE_CHAT', 'KICK_PLAYER'],
};

export function roleCan(
  role: ParticipantRole,
  capability: Capability
): boolean {
  return MATRIX[role].includes(capability);
}

export function rolesCan(
  roles: readonly ParticipantRole[],
  capability: Capability
): boolean {
  return roles.some(role => roleCan(role, capability));
}

/**
 * Match-level roles of a user. Room ownership is added by the rooms layer.
 * A seated player who finished or left becomes a SPECTATOR.
 */
export function matchRolesFor(
  state: GameState,
  userId: string
): ParticipantRole[] {
  const player = state.players.find(p => p.playerId === userId);
  if (player && player.status === 'active' && state.phase.kind !== 'finished') {
    return ['PLAYER'];
  }
  return ['SPECTATOR'];
}
