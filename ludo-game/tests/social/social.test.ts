import {describe, expect, it} from 'vitest';
import {
  formatTag,
  isValidUsername,
  parseTag,
} from '../../src/social/friends/tag.ts';
import {checkRateLimit, RATE_LIMITS} from '../../src/social/rateLimit.ts';
import {
  normalizeChatMessage,
  QUICK_MESSAGES,
} from '../../src/social/chat/messages.ts';
import {validateGift} from '../../src/social/gifts/giftRules.ts';
import {
  effectiveStatus,
  expiryFor,
  invitationText,
} from '../../src/social/invitations/invitations.ts';

describe('player tags', () => {
  it('formats and parses NASSER#4827', () => {
    expect(formatTag({username: 'Nasser', discriminator: '4827'})).toBe(
      'NASSER#4827'
    );
    expect(parseTag(' Nasser#4827 ')).toEqual({
      username: 'Nasser',
      discriminator: '4827',
    });
    expect(parseTag('Nasser#48')).toBeNull();
    expect(parseTag('a#1234')).toBeNull();
    expect(isValidUsername('Éloïse_99')).toBe(true);
    expect(isValidUsername('bad name')).toBe(false);
  });
});

describe('rate limiting', () => {
  it('limits chat to 5 messages per 10 seconds', () => {
    let history: readonly number[] = [];
    for (let i = 0; i < 5; i++) {
      const d = checkRateLimit(history, 1000 + i, RATE_LIMITS.chat);
      expect(d.allowed).toBe(true);
      history = d.history;
    }
    const blocked = checkRateLimit(history, 1010, RATE_LIMITS.chat);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(9990);
    expect(checkRateLimit(history, 11_001, RATE_LIMITS.chat).allowed).toBe(
      true
    );
  });
});

describe('chat', () => {
  it('normalises messages and rejects empty / oversized ones', () => {
    expect(normalizeChatMessage('  hello \n\t world ')).toEqual({
      ok: true,
      body: 'hello world',
    });
    expect(normalizeChatMessage('   ')).toEqual({ok: false, reason: 'empty'});
    expect(normalizeChatMessage('x'.repeat(201))).toEqual({
      ok: false,
      reason: 'too_long',
    });
    expect(QUICK_MESSAGES.map(q => q.text)).toContain('Bien joué !');
  });
});

describe('gifts', () => {
  const base = {
    senderId: 'a',
    receiverId: 'b',
    giftId: 'rose',
    senderInMatch: true,
    receiverInMatch: true,
    blockedEitherWay: false,
  };
  it('accepts valid gifts and rejects blocked, self, unknown and outsider gifts', () => {
    expect(validateGift(base)).toBeNull();
    expect(validateGift({...base, giftId: 'tank'})).toBe('unknown_gift');
    expect(validateGift({...base, receiverId: 'a'})).toBe('self_gift');
    expect(validateGift({...base, blockedEitherWay: true})).toBe('blocked');
    expect(validateGift({...base, receiverInMatch: false})).toBe(
      'not_in_match'
    );
  });
});

describe('invitations', () => {
  it('expire after the configured TTL', () => {
    const inv = {
      id: 'i',
      senderId: 'a',
      receiverId: 'b',
      roomId: 'r',
      createdAt: 0,
      expiresAt: expiryFor(0),
      status: 'pending' as const,
    };
    expect(inv.expiresAt).toBe(120_000);
    expect(effectiveStatus(inv, 60_000)).toBe('pending');
    expect(effectiveStatus(inv, 120_000)).toBe('expired');
    expect(effectiveStatus({...inv, status: 'accepted'}, 999_999)).toBe(
      'accepted'
    );
    expect(invitationText('Nasser')).toBe("Nasser t'invite à une partie.");
  });
});
