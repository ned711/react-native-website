/**
 * Signed-in player's server data (profile, wallet, stats, inventory).
 * Everything is read through RLS and written through RPCs (equip_item,
 * set_country): the client never credits itself.
 * STATUS: PRÉPARÉ - not run against a live project yet.
 */
import type {InventoryEntry} from '../inventory/inventory.ts';
import {err, ok, type Result} from '../utils/result.ts';
import {getSupabase} from './backend.ts';

export interface ServerProfile {
  readonly id: string;
  readonly username: string;
  readonly discriminator: string;
  readonly xp: number;
  readonly level: number;
  readonly countryCode: string | null;
  readonly equipped: {
    readonly board: string;
    readonly character: string;
    readonly dice: string;
    readonly title: string | null;
  };
  readonly coins: number;
  readonly gems: number;
  readonly stats: {
    readonly matchesPlayed: number;
    readonly wins: number;
    readonly captures: number;
    readonly bestStreak: number;
  };
  readonly inventory: readonly InventoryEntry[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const num = (v: unknown) =>
  typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : 0;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

const SOURCES: readonly InventoryEntry['source'][] = [
  'default',
  'chest',
  'mission',
  'achievement',
  'level',
  'event',
  'purchase',
];

/** Maps inventory rows; unknown sources are kept as 'chest' for display only. */
export function inventoryFromRows(rows: readonly unknown[]): InventoryEntry[] {
  return rows.filter(isRecord).map(r => {
    const source = SOURCES.find(s => s === r['source']) ?? 'chest';
    return {
      itemId: str(r['item_id']),
      unlocked: r['unlocked'] === true,
      fragments: num(r['fragments']),
      source,
    };
  });
}

export async function loadMyProfile(
  userId: string
): Promise<Result<ServerProfile, string>> {
  const c = getSupabase();
  if (!c) return err('Supabase non configuré');
  const [p, w, s, inv] = await Promise.all([
    c.from('profiles').select('*').eq('id', userId).maybeSingle(),
    c.from('wallets').select('coins, gems').eq('user_id', userId).maybeSingle(),
    c
      .from('player_stats')
      .select('matches_played, wins, captures, best_streak')
      .eq('user_id', userId)
      .maybeSingle(),
    c.from('inventory').select('item_id, fragments, unlocked, source'),
  ]);
  const error = p.error ?? w.error ?? s.error ?? inv.error;
  if (error) return err(error.message);
  const row: unknown = p.data;
  if (!isRecord(row)) return err('profil introuvable');
  const wallet: unknown = w.data;
  const stats: unknown = s.data;
  return ok({
    id: str(row['id']),
    username: str(row['username']),
    discriminator: str(row['discriminator']),
    xp: num(row['xp']),
    level: num(row['level']) || 1,
    countryCode:
      typeof row['country_code'] === 'string' ? row['country_code'] : null,
    equipped: {
      board: str(row['equipped_board']),
      character: str(row['equipped_character']),
      dice: str(row['equipped_dice']),
      title: typeof row['title_id'] === 'string' ? row['title_id'] : null,
    },
    coins: isRecord(wallet) ? num(wallet['coins']) : 0,
    gems: isRecord(wallet) ? num(wallet['gems']) : 0,
    stats: {
      matchesPlayed: isRecord(stats) ? num(stats['matches_played']) : 0,
      wins: isRecord(stats) ? num(stats['wins']) : 0,
      captures: isRecord(stats) ? num(stats['captures']) : 0,
      bestStreak: isRecord(stats) ? num(stats['best_streak']) : 0,
    },
    inventory: inventoryFromRows(Array.isArray(inv.data) ? inv.data : []),
  });
}

export async function equipOnServer(
  slot: 'board' | 'character' | 'dice' | 'title',
  itemId: string
): Promise<Result<null, string>> {
  const c = getSupabase();
  if (!c) return err('Supabase non configuré');
  const {error} = await c.rpc('equip_item', {p_slot: slot, p_item: itemId});
  return error ? err(error.message) : ok(null);
}

export async function setCountryOnServer(
  code: string
): Promise<Result<null, string>> {
  const c = getSupabase();
  if (!c) return err('Supabase non configuré');
  const {error} = await c.rpc('set_country', {p_code: code});
  return error ? err(error.message) : ok(null);
}

export async function loadCountries(): Promise<{code: string; name: string}[]> {
  const c = getSupabase();
  if (!c) return [];
  const {data} = await c.from('countries').select('code, name').order('name');
  return (data ?? []).map(r => ({code: String(r.code), name: String(r.name)}));
}
