import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';

export const DATABASE_URL = process.env['LUDO_TEST_DATABASE_URL'] ?? '';
export const hasDatabase = DATABASE_URL.length > 0;

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '..', '..', 'supabase', 'migrations');

export interface TestDb {
  readonly name: string;
  readonly pool: pg.Pool;
  close(): Promise<void>;
}

/** Creates an isolated database, applies the shim and every migration in order. */
export async function createTestDb(): Promise<TestDb> {
  const admin = new pg.Client({connectionString: DATABASE_URL});
  await admin.connect();
  const name = `ludo_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(DATABASE_URL);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({connectionString: url.toString(), max: 8});
  await pool.query(readFileSync(join(HERE, 'auth_shim.sql'), 'utf8'));
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()) {
    try {
      await pool.query(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    } catch (error) {
      throw new Error(`migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return {
    name,
    pool,
    async close() {
      await pool.end();
      const cleanup = new pg.Client({connectionString: DATABASE_URL});
      await cleanup.connect();
      await cleanup.query(`drop database if exists ${name} with (force)`);
      await cleanup.end();
    },
  };
}

export type Query = <T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[]
) => Promise<pg.QueryResult<T>>;

async function inRole<T>(
  db: TestDb,
  role: string,
  userId: string | null,
  fn: (q: Query) => Promise<T>
): Promise<T> {
  const client = await db.pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [
      userId ?? '',
    ]);
    const q: Query = (sql, params) => client.query(sql, params as unknown[]);
    const result = await fn(q);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** Runs queries as a signed-in Supabase user (role authenticated + auth.uid()). */
export const asUser = <T>(
  db: TestDb,
  userId: string,
  fn: (q: Query) => Promise<T>
) => inRole(db, 'authenticated', userId, fn);
export const asAnon = <T>(db: TestDb, fn: (q: Query) => Promise<T>) =>
  inRole(db, 'anon', null, fn);
/** Runs queries as the trusted server (service_role). */
export const asService = <T>(db: TestDb, fn: (q: Query) => Promise<T>) =>
  inRole(db, 'service_role', null, fn);

export async function createUser(
  db: TestDb,
  username: string
): Promise<string> {
  const {rows} = await db.pool.query<{id: string}>(
    `insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), $1, $2) returning id`,
    [`${username.toLowerCase()}@example.test`, {username}]
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('user not created');
  return id;
}

/** Expects a query to fail with a message containing `code`. */
export async function expectError(
  promise: Promise<unknown>,
  code: string
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const message = (error as Error).message;
    if (!message.includes(code))
      throw new Error(`expected ${code}, got: ${message}`);
    return;
  }
  throw new Error(`expected error ${code}, but the query succeeded`);
}
