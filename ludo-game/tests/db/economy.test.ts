import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {levelFromXp, totalXpForLevel} from '../../src/progression/levels.ts';
import {CATALOG} from '../../src/inventory/catalog.ts';
import {
  asService,
  asUser,
  createTestDb,
  createUser,
  expectError,
  hasDatabase,
  type TestDb,
} from './harness.ts';

describe.skipIf(!hasDatabase)('economy (server-authoritative)', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  }, 60_000);
  afterAll(async () => db?.close());

  it('SQL level_for_xp agrees with the TypeScript curve for every level', async () => {
    const samples: number[] = [];
    for (let l = 1; l <= 100; l++)
      samples.push(
        totalXpForLevel(l),
        totalXpForLevel(l) + 1,
        Math.max(0, totalXpForLevel(l) - 1)
      );
    const {rows} = await db.pool.query<{xp: string; level: number}>(
      `select x as xp, public.level_for_xp(x) as level from unnest($1::bigint[]) x`,
      [samples]
    );
    for (const row of rows)
      expect(row.level).toBe(levelFromXp(Number(row.xp)).level);
  });

  it('seeds the item catalogue from the TypeScript catalogue', async () => {
    const {rows} = await db.pool.query(
      `select count(*)::int as n from public.items`
    );
    expect(rows[0]?.['n']).toBe(CATALOG.length);
  });

  it('chest: rewards drawn on the server, 3h cooldown enforced, no double claim', async () => {
    const id = await createUser(db, 'Opener');
    const first = await asUser(db, id, q =>
      q<{r: {rewards: {type: string; amount: number}[]}}>(
        `select public.claim_chest() as r`
      )
    );
    const rewards = first.rows[0]?.r.rewards ?? [];
    expect(rewards).toHaveLength(3);
    for (const r of rewards) {
      expect(['coins', 'xp', 'fragments']).toContain(r.type);
      expect(r.amount).toBeGreaterThan(0);
    }
    await expectError(
      asUser(db, id, q => q(`select public.claim_chest()`)),
      'CHEST_COOLDOWN'
    );
    // after the cooldown
    await db.pool.query(
      `update public.chest_state set last_claimed_at = now() - interval '3 hours 1 second' where user_id = $1`,
      [id]
    );
    await asUser(db, id, q => q(`select public.claim_chest()`));
    const claims = await asUser(db, id, q =>
      q(`select count(*)::int as n from public.chest_claims`)
    );
    expect(claims.rows[0]?.['n']).toBe(2);
  });

  it('chest: concurrent claims yield exactly one success', async () => {
    const id = await createUser(db, 'Racer');
    const results = await Promise.allSettled(
      Array.from({length: 5}, () =>
        asUser(db, id, q => q(`select public.claim_chest()`))
      )
    );
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('chest rewards are applied to the wallet / XP / inventory consistently', async () => {
    const id = await createUser(db, 'Collector');
    let coins = 0;
    let xp = 0;
    for (let i = 0; i < 30; i++) {
      await db.pool.query(
        `update public.chest_state set last_claimed_at = null where user_id = $1`,
        [id]
      );
      const r = await asUser(db, id, q =>
        q<{r: {rewards: {type: string; amount: number}[]}}>(
          `select public.claim_chest() as r`
        )
      );
      for (const reward of r.rows[0]?.r.rewards ?? []) {
        if (reward.type === 'coins') coins += reward.amount;
        if (reward.type === 'xp') xp += reward.amount;
      }
    }
    const wallet = await asUser(db, id, q =>
      q(`select coins::int as c from public.wallets`)
    );
    expect(wallet.rows[0]?.['c']).toBe(coins);
    const profile = await asUser(db, id, q =>
      q(`select xp::int as xp, level from public.profiles where id = $1`, [id])
    );
    expect(profile.rows[0]?.['xp']).toBe(xp);
    expect(profile.rows[0]?.['level']).toBe(levelFromXp(xp).level);
    const inv = await asUser(db, id, q =>
      q(`select fragments, unlocked from public.inventory`)
    );
    for (const row of inv.rows)
      expect(Number(row['fragments'])).toBeLessThanOrEqual(6);
  });

  it('fragments: 6/6 unlocks the item, equipment requires ownership', async () => {
    const id = await createUser(db, 'Samurai');
    await expectError(
      asUser(db, id, q =>
        q(`select public.equip_item('character', 'samurai')`)
      ),
      'ITEM_NOT_OWNED'
    );
    const r1 = await db.pool.query(
      `select private.grant_fragments($1, 'samurai', 4, 'admin') as r`,
      [id]
    );
    expect(r1.rows[0]?.['r']).toMatchObject({
      fragments: 4,
      newly_unlocked: false,
    });
    const r2 = await db.pool.query(
      `select private.grant_fragments($1, 'samurai', 3, 'admin') as r`,
      [id]
    );
    expect(r2.rows[0]?.['r']).toMatchObject({
      fragments: 6,
      newly_unlocked: true,
      overflow: 1,
    });
    const r3 = await db.pool.query(
      `select private.grant_fragments($1, 'samurai', 2, 'admin') as r`,
      [id]
    );
    expect(r3.rows[0]?.['r']).toMatchObject({
      newly_unlocked: false,
      overflow: 2,
    });
    await asUser(db, id, q =>
      q(`select public.equip_item('character', 'samurai')`)
    );
    await expectError(
      asUser(db, id, q => q(`select public.equip_item('dice', 'samurai')`)),
      'WRONG_SLOT'
    );
    const p = await asUser(db, id, q =>
      q(`select equipped_character from public.profiles where id = $1`, [id])
    );
    expect(p.rows[0]?.['equipped_character']).toBe('samurai');
    // default items are always owned
    await asUser(db, id, q =>
      q(`select public.equip_item('dice', 'classic_dice')`)
    );
    const notif = await asUser(db, id, q =>
      q(`select kind from public.notifications where kind = 'item_unlocked'`)
    );
    expect(notif.rows).toHaveLength(1);
  });

  it('country is an explicit player choice validated against the list', async () => {
    const id = await createUser(db, 'Algerian');
    await asUser(db, id, q => q(`select public.set_country('dz')`));
    const p = await asUser(db, id, q =>
      q(`select country_code from public.profiles where id = $1`, [id])
    );
    expect(p.rows[0]?.['country_code']).toBe('DZ');
    await expectError(
      asUser(db, id, q => q(`select public.set_country('XX')`)),
      'UNKNOWN_COUNTRY'
    );
  });
});
