/**
 * Typed wrappers over the SQL RPCs (supabase/migrations). Server responses are
 * validated at runtime. STATUS: PRÉPARÉ - type-checked, not exercised against
 * a live Supabase project yet (the SQL itself is tested on PostgreSQL).
 */
import type {
  RankingEntry,
  RankingScope,
  RankingService,
} from '../social/rankings/types.ts';
import {err, ok, type Result} from '../utils/result.ts';
import {getSupabase} from './backend.ts';

export type RpcError = {
  readonly code: 'NOT_CONFIGURED' | 'NOT_SIGNED_IN' | 'SERVER';
  readonly message: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

async function call(
  fn: string,
  args: Record<string, unknown> = {}
): Promise<Result<unknown, RpcError>> {
  const client = getSupabase();
  if (!client)
    return err({code: 'NOT_CONFIGURED', message: 'Supabase non configuré'});
  const {data: session} = await client.auth.getSession();
  if (!session.session)
    return err({code: 'NOT_SIGNED_IN', message: 'Connexion requise'});
  const {data, error} = await client.rpc(fn, args);
  if (error) return err({code: 'SERVER', message: error.message});
  return ok(data);
}

export interface FriendRow {
  readonly userId: string;
  readonly username: string;
  readonly discriminator: string;
  readonly level: number;
  readonly online: boolean;
}

export async function listFriends(): Promise<Result<FriendRow[], RpcError>> {
  const r = await call('list_friends');
  if (!r.ok) return r;
  if (!Array.isArray(r.value))
    return err({code: 'SERVER', message: 'réponse inattendue'});
  return ok(
    r.value.filter(isRecord).map(row => ({
      userId: String(row['user_id']),
      username: String(row['username']),
      discriminator: String(row['discriminator']),
      level: Number(row['level']),
      online: row['online'] === true,
    }))
  );
}

export async function sendFriendRequest(
  username: string,
  discriminator: string
): Promise<Result<unknown, RpcError>> {
  return call('send_friend_request', {
    p_username: username,
    p_discriminator: discriminator,
  });
}

export interface ChestStatus {
  readonly nextAvailableAt: number;
  readonly serverNow: number;
}

export async function chestStatus(): Promise<Result<ChestStatus, RpcError>> {
  const r = await call('chest_status');
  if (!r.ok) return r;
  if (!isRecord(r.value))
    return err({code: 'SERVER', message: 'réponse inattendue'});
  return ok({
    nextAvailableAt: Date.parse(String(r.value['next_available_at'])),
    serverNow: Date.parse(String(r.value['server_now'])),
  });
}

export interface ChestReward {
  readonly type: string;
  readonly amount: number;
  readonly itemId: string | null;
}

export async function claimChest(): Promise<Result<ChestReward[], RpcError>> {
  const r = await call('claim_chest');
  if (!r.ok) return r;
  const rewards =
    isRecord(r.value) && Array.isArray(r.value['rewards'])
      ? r.value['rewards']
      : null;
  if (!rewards) return err({code: 'SERVER', message: 'réponse inattendue'});
  return ok(
    rewards.filter(isRecord).map(x => ({
      type: String(x['type']),
      amount: Number(x['amount']),
      itemId: typeof x['item_id'] === 'string' ? x['item_id'] : null,
    }))
  );
}

function toEntry(row: Record<string, unknown>): RankingEntry {
  return {
    rank: Number(row['rank']),
    userId: String(row['user_id']),
    username: String(row['username']),
    discriminator: String(row['discriminator']),
    countryCode:
      typeof row['country_code'] === 'string' ? row['country_code'] : null,
    level: Number(row['level']),
    score: Number(row['score']),
  };
}

async function ranking(
  scope: RankingScope,
  limit: number
): Promise<RankingEntry[]> {
  const r = await call('get_ranking', {p_scope: scope, p_limit: limit});
  if (!r.ok) throw new Error(r.error.message);
  return Array.isArray(r.value) ? r.value.filter(isRecord).map(toEntry) : [];
}

export const supabaseRankingService: RankingService = {
  getWorldRanking: limit => ranking('world', limit),
  getContinentRanking: limit => ranking('continent', limit),
  getCountryRanking: limit => ranking('country', limit),
  async getMyRank(scope) {
    const r = await call('get_my_rank', {p_scope: scope});
    if (!r.ok) throw new Error(r.error.message);
    const first = Array.isArray(r.value) ? r.value.find(isRecord) : undefined;
    return first ? toEntry(first) : null;
  },
};
