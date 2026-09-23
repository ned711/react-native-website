import {findGift} from '../../content/gifts.ts';

export type GiftRejection =
  'unknown_gift' | 'self_gift' | 'blocked' | 'not_in_match';

export interface GiftSendInput {
  readonly senderId: string;
  readonly receiverId: string;
  readonly giftId: string;
  readonly senderInMatch: boolean;
  readonly receiverInMatch: boolean;
  readonly blockedEitherWay: boolean;
}

/** Mirrors the server checks of `send_gift`. Gifts never affect gameplay. */
export function validateGift(input: GiftSendInput): GiftRejection | null {
  if (!findGift(input.giftId)) return 'unknown_gift';
  if (input.senderId === input.receiverId) return 'self_gift';
  if (input.blockedEitherWay) return 'blocked';
  if (!input.senderInMatch || !input.receiverInMatch) return 'not_in_match';
  return null;
}
