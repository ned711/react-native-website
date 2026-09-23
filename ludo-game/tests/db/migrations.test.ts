import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {
  asAnon,
  asUser,
  createTestDb,
  createUser,
  hasDatabase,
  type TestDb,
} from './harness.ts';

describe.skipIf(!hasDatabase)('migrations', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  }, 60_000);
  afterAll(async () => db?.close());

  it('apply cleanly and enable RLS on every public table', async () => {
    const {rows} = await db.pool.query<{
      tablename: string;
      rowsecurity: boolean;
    }>(
      `select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`
    );
    expect(rows.length).toBeGreaterThan(25);
    expect(rows.filter(r => !r.rowsecurity).map(r => r.tablename)).toEqual([]);
  });

  it('creates profile, wallet and stats on sign-up', async () => {
    const id = await createUser(db, 'Nasser');
    const profile = await asUser(db, id, q =>
      q(
        `select username, discriminator, level, xp from public.profiles where id = $1`,
        [id]
      )
    );
    expect(profile.rows[0]).toMatchObject({
      username: 'Nasser',
      level: 1,
      xp: '0',
    });
    expect(profile.rows[0]?.['discriminator']).toMatch(/^\d{4}$/);
    const wallet = await asUser(db, id, q =>
      q(`select coins from public.wallets`)
    );
    expect(wallet.rows).toHaveLength(1);
  });

  it('sanitises usernames', async () => {
    const id = await createUser(db, 'x y!');
    const {rows} = await db.pool.query(
      `select username from public.profiles where id = $1`,
      [id]
    );
    expect(rows[0]?.['username']).toBe('player');
  });

  it('never lets clients write tables directly', async () => {
    const id = await createUser(db, 'Writer');
    await expect(
      asUser(db, id, q =>
        q(`update public.profiles set xp = 999999 where id = $1`, [id])
      )
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, id, q => q(`update public.wallets set coins = 999999`))
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, id, q =>
        q(
          `insert into public.inventory (user_id, item_id, unlocked) values ($1, 'samurai', true)`,
          [id]
        )
      )
    ).rejects.toThrow(/permission denied/);
    await expect(
      asAnon(db, q => q(`select * from public.profiles`))
    ).rejects.toThrow(/permission denied/);
  });

  it("hides other users' private data", async () => {
    const a = await createUser(db, 'Alice');
    const b = await createUser(db, 'Bob');
    const {rows} = await asUser(db, a, q =>
      q(`select user_id from public.wallets`)
    );
    expect(rows.map(r => r['user_id'])).toEqual([a]);
    const inv = await asUser(db, b, q => q(`select * from public.chest_state`));
    expect(inv.rows).toEqual([]);
  });

  it('forbids clients from calling server-only functions', async () => {
    const id = await createUser(db, 'Cheater');
    await expect(
      asUser(db, id, q =>
        q(`select public.apply_match_result(gen_random_uuid(), '[]'::jsonb)`)
      )
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, id, q =>
        q(
          `select public.commit_match_action(gen_random_uuid(), 0, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, now(), '{}'::jsonb)`
        )
      )
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, id, q =>
        q(`select private.grant_fragments($1, 'samurai', 6, 'admin')`, [id])
      )
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, id, q => q(`select private.random_below(6)`))
    ).rejects.toThrow(/permission denied/);
  });
});
