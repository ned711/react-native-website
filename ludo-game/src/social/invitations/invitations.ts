import {ECONOMY_CONFIG} from '../../economy/config.ts';

export type InvitationStatus =
  'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export interface Invitation {
  readonly id: string;
  readonly senderId: string;
  readonly receiverId: string;
  readonly roomId: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly status: InvitationStatus;
}

export function effectiveStatus(
  invitation: Invitation,
  now: number
): InvitationStatus {
  if (invitation.status === 'pending' && now >= invitation.expiresAt)
    return 'expired';
  return invitation.status;
}

export function expiryFor(
  createdAt: number,
  ttlMs: number = ECONOMY_CONFIG.invitationTtlMs
): number {
  return createdAt + ttlMs;
}

export function invitationText(senderName: string): string {
  return `${senderName} t'invite à une partie.`;
}
