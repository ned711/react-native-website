import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {
  asUser,
  createTestDb,
  createUser,
  expectError,
  hasDatabase,
  type TestDb,
} from './harness.ts';

async function tagOf(db: TestDb, id: string): Promise<[string, string]> {
  const {rows} = await db.pool.query(
    `select username, discriminator from public.profiles where id = $1`,
    [id]
  );
  return [
    rows[0]?.['username'] as string,
    rows[0]?.['discriminator'] as string,
  ];
}

async function befriend(db: TestDb, a: string, b: string): Promise<void> {
  const [u, d] = await tagOf(db, b);
  const req = await asUser(db, a, q =>
    q<{id: string}>(`select public.send_friend_request($1, $2) as id`, [u, d])
  );
  await asUser(db, b, q =>
    q(`select public.respond_friend_request($1, true)`, [req.rows[0]?.id])
  );
}

describe.skipIf(!hasDatabase)(
  'friends, blocks, invitations, chat, gifts',
  () => {
    let db: TestDb;
    beforeAll(async () => {
      db = await createTestDb();
    }, 60_000);
    afterAll(async () => db?.close());

    it('sends, accepts and lists friends by tag', async () => {
      const a = await createUser(db, 'Nasser');
      const b = await createUser(db, 'Lina');
      await befriend(db, a, b);
      const friends = await asUser(db, a, q =>
        q(`select * from public.list_friends()`)
      );
      expect(friends.rows.map(r => r['username'])).toEqual(['Lina']);
      const notif = await asUser(db, a, q =>
        q(`select kind from public.notifications`)
      );
      expect(notif.rows.map(r => r['kind'])).toContain('friend_accepted');
      const [u, d] = await tagOf(db, b);
      await expectError(
        asUser(db, a, q =>
          q(`select public.send_friend_request($1, $2)`, [u, d])
        ),
        'ALREADY_FRIENDS'
      );
      await expectError(
        asUser(db, a, q =>
          q(`select public.send_friend_request('nobody', '0000')`)
        ),
        'USER_NOT_FOUND'
      );
      const [ua, da] = await tagOf(db, a);
      await expectError(
        asUser(db, a, q =>
          q(`select public.send_friend_request($1, $2)`, [ua, da])
        ),
        'CANNOT_FRIEND_SELF'
      );
    });

    it('refuses duplicates, declines, and only the receiver can respond', async () => {
      const a = await createUser(db, 'Amine');
      const b = await createUser(db, 'Sara');
      const [u, d] = await tagOf(db, b);
      const req = await asUser(db, a, q =>
        q<{id: string}>(`select public.send_friend_request($1, $2) as id`, [
          u,
          d,
        ])
      );
      await expectError(
        asUser(db, a, q =>
          q(`select public.send_friend_request($1, $2)`, [u, d])
        ),
        'REQUEST_ALREADY_PENDING'
      );
      await expectError(
        asUser(db, a, q =>
          q(`select public.respond_friend_request($1, true)`, [req.rows[0]?.id])
        ),
        'REQUEST_NOT_FOUND'
      );
      await asUser(db, b, q =>
        q(`select public.respond_friend_request($1, false)`, [req.rows[0]?.id])
      );
      const friends = await asUser(db, a, q =>
        q(`select * from public.list_friends()`)
      );
      expect(friends.rows).toEqual([]);
    });

    it('blocking removes the friendship and prevents new requests', async () => {
      const a = await createUser(db, 'Yanis');
      const b = await createUser(db, 'Troll');
      await befriend(db, a, b);
      await asUser(db, a, q => q(`select public.block_user($1)`, [b]));
      expect(
        (await asUser(db, a, q => q(`select * from public.list_friends()`)))
          .rows
      ).toEqual([]);
      const [u, d] = await tagOf(db, a);
      await expectError(
        asUser(db, b, q =>
          q(`select public.send_friend_request($1, $2)`, [u, d])
        ),
        'BLOCKED'
      );
      const blocks = await asUser(db, b, q => q(`select * from public.blocks`));
      expect(blocks.rows).toEqual([]); // the blocked user cannot see who blocked them
    });

    it('rate-limits friend requests server-side', async () => {
      const spammer = await createUser(db, 'Spammer');
      const targets = await Promise.all(
        Array.from({length: 21}, (_, i) => createUser(db, `Target${i}`))
      );
      for (let i = 0; i < 20; i++) {
        const [u, d] = await tagOf(db, targets[i] as string);
        await asUser(db, spammer, q =>
          q(`select public.send_friend_request($1, $2)`, [u, d])
        );
      }
      const [u, d] = await tagOf(db, targets[20] as string);
      await expectError(
        asUser(db, spammer, q =>
          q(`select public.send_friend_request($1, $2)`, [u, d])
        ),
        'RATE_LIMITED'
      );
    });

    it('invitations: friends only, expire, accept joins the room', async () => {
      const host = await createUser(db, 'Host');
      const friend = await createUser(db, 'Guest');
      const stranger = await createUser(db, 'Stranger');
      await befriend(db, host, friend);
      const room = await asUser(db, host, q =>
        q<{room_id: string; code: string}>(
          `select * from public.create_room('4p')`
        )
      );
      const roomId = room.rows[0]?.room_id;
      expect(room.rows[0]?.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
      await expectError(
        asUser(db, host, q =>
          q(`select public.send_invitation($1, $2)`, [stranger, roomId])
        ),
        'NOT_FRIENDS'
      );
      const inv = await asUser(db, host, q =>
        q<{id: string}>(`select public.send_invitation($1, $2) as id`, [
          friend,
          roomId,
        ])
      );
      await expectError(
        asUser(db, host, q =>
          q(`select public.send_invitation($1, $2)`, [friend, roomId])
        ),
        'INVITATION_ALREADY_PENDING'
      );
      const notif = await asUser(db, friend, q =>
        q(
          `select kind, payload from public.notifications where kind = 'invitation'`
        )
      );
      expect(notif.rows).toHaveLength(1);
      const joined = await asUser(db, friend, q =>
        q<{r: string}>(`select public.respond_invitation($1, true) as r`, [
          inv.rows[0]?.id,
        ])
      );
      expect(joined.rows[0]?.r).toBe(roomId);
      const members = await asUser(db, friend, q =>
        q(`select user_id from public.room_players where room_id = $1`, [
          roomId,
        ])
      );
      expect(members.rows).toHaveLength(2);

      // expired invitation
      const other = await createUser(db, 'Late');
      await befriend(db, host, other);
      const inv2 = await asUser(db, host, q =>
        q<{id: string}>(`select public.send_invitation($1, $2) as id`, [
          other,
          roomId,
        ])
      );
      await db.pool.query(
        `update public.invitations set expires_at = now() - interval '1 second' where id = $1`,
        [inv2.rows[0]?.id]
      );
      const late = await asUser(db, other, q =>
        q<{r: string | null}>(
          `select public.respond_invitation($1, true) as r`,
          [inv2.rows[0]?.id]
        )
      );
      expect(late.rows[0]?.r).toBeNull();
      const status = await db.pool.query(
        `select status from public.invitations where id = $1`,
        [inv2.rows[0]?.id]
      );
      expect(status.rows[0]?.['status']).toBe('expired');
    });

    it('chat: members only, normalised, rate-limited, hidden from blockers', async () => {
      const a = await createUser(db, 'Chatter');
      const b = await createUser(db, 'Listener');
      const outsider = await createUser(db, 'Outsider');
      const room = await asUser(db, a, q =>
        q<{room_id: string; code: string}>(
          `select * from public.create_room('2p')`
        )
      );
      const roomId = room.rows[0]?.room_id;
      await asUser(db, b, q =>
        q(`select public.join_room($1)`, [room.rows[0]?.code])
      );
      await asUser(db, a, q =>
        q(`select public.send_chat_message($1, null, $2)`, [
          roomId,
          '  Bonne \n partie !  ',
        ])
      );
      const seen = await asUser(db, b, q =>
        q(`select body from public.chat_messages`)
      );
      expect(seen.rows.map(r => r['body'])).toEqual(['Bonne partie !']);
      await expectError(
        asUser(db, outsider, q =>
          q(`select public.send_chat_message($1, null, 'hi')`, [roomId])
        ),
        'NOT_A_MEMBER'
      );
      expect(
        (
          await asUser(db, outsider, q =>
            q(`select * from public.chat_messages`)
          )
        ).rows
      ).toEqual([]);
      await expectError(
        asUser(db, a, q =>
          q(`select public.send_chat_message($1, null, '   ')`, [roomId])
        ),
        'EMPTY_MESSAGE'
      );
      await expectError(
        asUser(db, a, q =>
          q(`select public.send_chat_message($1, null, $2)`, [
            roomId,
            'x'.repeat(201),
          ])
        ),
        'MESSAGE_TOO_LONG'
      );
      for (let i = 0; i < 4; i++)
        await asUser(db, a, q =>
          q(`select public.send_chat_message($1, null, $2)`, [roomId, `m${i}`])
        );
      await expectError(
        asUser(db, a, q =>
          q(`select public.send_chat_message($1, null, 'flood')`, [roomId])
        ),
        'RATE_LIMITED'
      );
      await asUser(db, b, q => q(`select public.block_user($1)`, [a]));
      expect(
        (await asUser(db, b, q => q(`select * from public.chat_messages`))).rows
      ).toEqual([]);
      const msgId = (
        await asUser(db, a, q =>
          q<{id: string}>(`select id from public.chat_messages limit 1`)
        )
      ).rows[0]?.id;
      await asUser(db, a, q =>
        q(`select public.report_message($1, 'spam')`, [msgId])
      );
    });
  }
);
