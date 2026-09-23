/**
 * Friend requests, blocking and room invitations (SQL RPCs, tested on
 * PostgreSQL). STATUS: PRÉPARÉ - not run against a live project yet.
 */
import {err, ok, type Result} from '../utils/result.ts';
import {getSupabase} from './backend.ts';

export interface PendingRequest {
  readonly id: string;
  readonly fromId: string;
  readonly fromName: string;
}

export interface PendingInvitation {
  readonly id: string;
  readonly fromName: string;
  readonly roomId: string;
  readonly expiresAt: number;
}

function client() {
  const c = getSupabase();
  if (!c) throw new Error('Supabase non configuré');
  return c;
}

async function names(ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const {data} = await client()
    .from('profiles')
    .select('id, username, discriminator')
    .in('id', [...ids]);
  return new Map(
    (data ?? []).map(p => [
      String(p.id),
      `${String(p.username)}#${String(p.discriminator)}`,
    ])
  );
}

export async function incomingRequests(
  userId: string
): Promise<Result<PendingRequest[], string>> {
  const {data, error} = await client()
    .from('friend_requests')
    .select('id, sender_id')
    .eq('receiver_id', userId)
    .eq('status', 'pending');
  if (error) return err(error.message);
  const rows = data ?? [];
  const n = await names(rows.map(r => String(r.sender_id)));
  return ok(
    rows.map(r => ({
      id: String(r.id),
      fromId: String(r.sender_id),
      fromName: n.get(String(r.sender_id)) ?? '…',
    }))
  );
}

export async function incomingInvitations(
  userId: string
): Promise<Result<PendingInvitation[], string>> {
  const {data, error} = await client()
    .from('invitations')
    .select('id, sender_id, room_id, expires_at')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString());
  if (error) return err(error.message);
  const rows = data ?? [];
  const n = await names(rows.map(r => String(r.sender_id)));
  return ok(
    rows.map(r => ({
      id: String(r.id),
      fromName: n.get(String(r.sender_id)) ?? '…',
      roomId: String(r.room_id),
      expiresAt: Date.parse(String(r.expires_at)),
    }))
  );
}

async function rpc(
  fn: string,
  args: Record<string, unknown>
): Promise<Result<unknown, string>> {
  const {data, error} = await client().rpc(fn, args);
  return error ? err(error.message) : ok(data);
}

export const respondFriendRequest = (id: string, accept: boolean) =>
  rpc('respond_friend_request', {p_request: id, p_accept: accept});
export const removeFriend = (friendId: string) =>
  rpc('remove_friend', {p_friend: friendId});
export const blockUser = (userId: string) =>
  rpc('block_user', {p_target: userId});
export const sendInvitation = (friendId: string, roomId: string) =>
  rpc('send_invitation', {p_receiver: friendId, p_room: roomId});

/** Returns the room id when accepted, null when declined or expired. */
export async function respondInvitation(
  id: string,
  accept: boolean
): Promise<Result<string | null, string>> {
  const r = await rpc('respond_invitation', {
    p_invitation: id,
    p_accept: accept,
  });
  if (!r.ok) return r;
  return ok(typeof r.value === 'string' ? r.value : null);
}
