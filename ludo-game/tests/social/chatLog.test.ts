import {describe, expect, it} from 'vitest';
import {mergeChat} from '../../src/social/chat/chatLog.ts';
import {toChatMessage} from '../../src/services/chat.ts';

const m = (id: string, at: number, sender = 'a') => ({
  id,
  senderId: sender,
  body: id,
  createdAt: at,
});

describe('chat log', () => {
  it('orders, de-duplicates, filters blocked senders and caps the log', () => {
    const merged = mergeChat(
      [m('2', 20), m('1', 10)],
      [m('2', 20), m('3', 30, 'troll'), m('4', 5)],
      new Set(['troll']),
      3
    );
    expect(merged.map(x => x.id)).toEqual(['4', '1', '2']);
    expect(
      mergeChat(
        [],
        Array.from({length: 150}, (_, i) => m(String(i), i))
      )
    ).toHaveLength(100);
  });

  it('validates server rows before displaying them', () => {
    expect(
      toChatMessage({
        id: 'x',
        sender_id: 'u',
        body: 'Salut',
        created_at: '2026-01-01T00:00:00Z',
      })
    ).toMatchObject({id: 'x', body: 'Salut'});
    expect(toChatMessage({id: 1, sender_id: 'u', body: 'x'})).toBeNull();
    expect(toChatMessage(null)).toBeNull();
  });
});

describe('server inventory mapping', async () => {
  const {inventoryFromRows} = await import('../../src/services/profile.ts');
  it('maps rows and never trusts unknown shapes', () => {
    expect(
      inventoryFromRows([
        {item_id: 'samurai', fragments: 6, unlocked: true, source: 'chest'},
        {item_id: 'ninja', fragments: '4', unlocked: false, source: 'weird'},
        null,
      ])
    ).toEqual([
      {itemId: 'samurai', fragments: 6, unlocked: true, source: 'chest'},
      {itemId: 'ninja', fragments: 4, unlocked: false, source: 'chest'},
    ]);
  });
});
