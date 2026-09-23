/**
 * Rooms and matchmaking client calls. STATUS: PRÉPARÉ (SQL tested on
 * PostgreSQL; these wrappers are type-checked only).
 */
import type {MatchFormat} from '../game/rules/seats.ts';
import type {EndGameMode} from '../game/types.ts';
import {err, ok, type Result} from '../utils/result.ts';
import {getSupabase} from './backend.ts';

export interface LobbyError {
  readonly message: string;
}

export interface RoomView {
  readonly id: string;
  readonly code: string;
  readonly ownerId: string;
  readonly format: MatchFormat;
  readonly status: string;
  readonly matchId: string | null;
  readonly members: readonly {
    readonly userId: string;
    readonly username: string;
  }[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function client() {
  const c = getSupabase();
  if (!c) throw new Error('Supabase non configuré');
  return c;
}

export async function createRoom(
  format: MatchFormat,
  endGameMode: EndGameMode,
  adventure: boolean
): Promise<Result<string, LobbyError>> {
  const {data, error} = await client().rpc('create_room', {
    p_format: format,
    p_end_game_mode: endGameMode,
    p_adventure: adventure,
  });
  if (error) return err({message: error.message});
  const row: unknown = Array.isArray(data) ? data[0] : data;
  return isRecord(row) && typeof row['room_id'] === 'string'
    ? ok(row['room_id'])
    : err({message: 'réponse inattendue'});
}

export async function joinRoom(
  code: string
): Promise<Result<string, LobbyError>> {
  const {data, error} = await client().rpc('join_room', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) return err({message: error.message});
  return typeof data === 'string'
    ? ok(data)
    : err({message: 'réponse inattendue'});
}

export async function leaveRoom(roomId: string): Promise<void> {
  await client().rpc('leave_room', {p_room: roomId});
}

export async function loadRoom(
  roomId: string
): Promise<Result<RoomView, LobbyError>> {
  const c = client();
  const {data: room, error} = await c
    .from('rooms')
    .select('id, code, owner_id, format, status, match_id')
    .eq('id', roomId)
    .maybeSingle();
  if (error || !isRecord(room))
    return err({message: error?.message ?? 'salle introuvable'});
  const {data: members} = await c
    .from('room_players')
    .select('user_id, joined_at')
    .eq('room_id', roomId)
    .order('joined_at');
  const ids = (members ?? []).map(m => String(m.user_id));
  const {data: profiles} = ids.length
    ? await c.from('profiles').select('id, username').in('id', ids)
    : {data: []};
  const names = new Map(
    (profiles ?? []).map(p => [String(p.id), String(p.username)])
  );
  return ok({
    id: String(room['id']),
    code: String(room['code']),
    ownerId: String(room['owner_id']),
    format: room['format'] as MatchFormat,
    status: String(room['status']),
    matchId: typeof room['match_id'] === 'string' ? room['match_id'] : null,
    members: ids.map(id => ({userId: id, username: names.get(id) ?? '…'})),
  });
}

export async function startRoomMatch(
  roomId: string
): Promise<Result<string, LobbyError>> {
  const {data, error} = await client().functions.invoke('match-action', {
    body: {type: 'START_MATCH', roomId},
  });
  if (error) return err({message: error.message});
  return isRecord(data) && typeof data['matchId'] === 'string'
    ? ok(data['matchId'])
    : err({message: 'réponse inattendue'});
}

export async function enqueue(
  format: MatchFormat
): Promise<Result<string, LobbyError>> {
  const {data, error} = await client().rpc('enqueue_matchmaking', {
    p_format: format,
    p_party: [],
  });
  if (error) return err({message: error.message});
  return typeof data === 'string'
    ? ok(data)
    : err({message: 'réponse inattendue'});
}

export async function cancelQueue(): Promise<void> {
  await client().rpc('cancel_matchmaking');
}

/** Returns the match id once the server matched the ticket. */
export async function ticketMatch(ticketId: string): Promise<string | null> {
  const {data} = await client()
    .from('matchmaking_tickets')
    .select('status, match_id')
    .eq('id', ticketId)
    .maybeSingle();
  return isRecord(data) && typeof data['match_id'] === 'string'
    ? data['match_id']
    : null;
}
