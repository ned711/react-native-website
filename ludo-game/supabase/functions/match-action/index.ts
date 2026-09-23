// Supabase Edge Function: the authoritative Ludo server.
//
// POST body (JSON):
//   {type: 'ROLL_DICE' | 'MOVE_PAWN' | 'LEAVE_MATCH' | 'SYNC', matchId, ...}
//   {type: 'START_MATCH', roomId}
//   {type: 'TIMEOUT_SWEEP'}            (scheduler only, service-role bearer)
//
// Clients send intents; dice are drawn here with a CSPRNG; every action goes
// through the pure engine and is committed with compare-and-swap.
import {createClient, type SupabaseClient} from 'npm:@supabase/supabase-js@2';
import {
  MatchAuthority,
  type AuthorityAccepted,
} from '../../../src/multiplayer/authority/authority.ts';
import {consoleJsonLogger} from '../../../src/multiplayer/authority/logger.ts';
import {computeMatchResults} from '../../../src/multiplayer/authority/results.ts';
import {
  buildGameConfig,
  type MatchFormat,
} from '../../../src/game/rules/seats.ts';
import {createGame} from '../../../src/game/engine/engine.ts';
import {
  createAdventureSeed,
  generateAdventureBoard,
} from '../../../src/game/adventure/generator.ts';
import type {EndGameMode, GameState} from '../../../src/game/types.ts';
import {createCryptoRandom} from '../../../src/utils/random.ts';
import {SupabaseMatchStore} from '../_shared/supabaseMatchStore.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}

const cryptoRandom = createCryptoRandom(array => crypto.getRandomValues(array));

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {persistSession: false},
  });
}

async function authenticatedUserId(req: Request): Promise<string | null> {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: {headers: {Authorization: header}},
    auth: {persistSession: false},
  });
  const {data, error} = await client.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

function authority(service: SupabaseClient): MatchAuthority {
  return new MatchAuthority({
    store: new SupabaseMatchStore(service),
    dice: cryptoRandom,
    clock: () => Date.now(),
    logger: consoleJsonLogger,
  });
}

async function finalizeIfFinished(
  service: SupabaseClient,
  state: GameState
): Promise<void> {
  if (state.phase.kind !== 'finished') return;
  const matchId = state.config.matchId;
  const {data: seats, error} = await service
    .from('match_players')
    .select('user_id')
    .eq('match_id', matchId);
  if (error) throw new Error(`load seats failed: ${error.code}`);
  const humans = (seats ?? [])
    .map(s => s.user_id as string | null)
    .filter((id): id is string => !!id);
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const {data: today} = await service
    .from('game_results')
    .select('user_id')
    .in('user_id', humans)
    .gte('created_at', since.toISOString());
  const playedToday = new Set((today ?? []).map(r => r.user_id as string));
  const {data: friendships} = await service
    .from('friendships')
    .select('user_a, user_b')
    .in('user_a', humans)
    .in('user_b', humans);
  const withFriend = new Set(
    (friendships ?? []).flatMap(f => [f.user_a as string, f.user_b as string])
  );
  const results = computeMatchResults(state, {
    humanIds: new Set(humans),
    firstMatchOfDay: new Set(humans.filter(h => !playedToday.has(h))),
    withFriend,
  });
  const {error: applyError} = await service.rpc('apply_match_result', {
    p_match: matchId,
    p_results: results,
  });
  if (applyError) throw new Error(`apply results failed: ${applyError.code}`);
}

async function startMatch(
  service: SupabaseClient,
  userId: string,
  roomId: unknown
): Promise<Response> {
  if (typeof roomId !== 'string') return json({error: 'INVALID_INTENT'}, 400);
  const {data: room} = await service
    .from('rooms')
    .select('id, owner_id, format, end_game_mode, adventure, status')
    .eq('id', roomId)
    .maybeSingle();
  if (!room || room.owner_id !== userId)
    return json({error: 'NOT_ROOM_OWNER'}, 403);
  if (room.status !== 'open' && room.status !== 'locked')
    return json({error: 'ROOM_NOT_STARTABLE'}, 409);
  const {data: members} = await service
    .from('room_players')
    .select('user_id, joined_at, profiles(username)')
    .eq('room_id', roomId)
    .order('joined_at');
  const format = room.format as MatchFormat;
  const seatCount = format === '2p' ? 2 : format === '3p' ? 3 : 4;
  const humans = (members ?? []).slice(0, seatCount);
  if (humans.length < 1) return json({error: 'NOT_ENOUGH_PLAYERS'}, 409);
  const matchId = crypto.randomUUID();
  const seats = [
    ...humans.map(m => ({
      playerId: m.user_id as string,
      displayName:
        (m.profiles as {username?: string} | null)?.username ?? 'Player',
      controller: {kind: 'human' as const},
    })),
    ...Array.from({length: seatCount - humans.length}, (_, i) => ({
      playerId: `ai:${i}`,
      displayName: `Bot ${i + 1}`,
      controller: {kind: 'ai' as const, difficulty: 'normal' as const},
    })),
  ];
  const config = buildGameConfig({
    matchId,
    mode: humans.length < seatCount ? 'mixed' : 'online',
    format,
    endGameMode: room.end_game_mode as EndGameMode,
    seats,
    adventure: room.adventure
      ? generateAdventureBoard(createAdventureSeed(cryptoRandom))
      : null,
  });
  const created = createGame(config, {now: Date.now()});
  if (!created.ok) return json({error: created.error.code}, 400);
  const {error} = await service.rpc('create_match', {
    p_match: matchId,
    p_room: roomId,
    p_owner: userId,
    p_mode: config.mode,
    p_format: format,
    p_state: created.value.state,
    p_seats: config.seats.map(s => ({
      color: s.color,
      user_id: s.controller.kind === 'human' ? s.playerId : null,
      kind: s.controller.kind,
    })),
  });
  if (error) return json({error: error.message}, 409);
  consoleJsonLogger.log('info', 'match_created', {
    matchId,
    roomId,
    humans: humans.length,
  });
  const advanced = await authority(service).advanceAiSeats(matchId);
  const state =
    advanced.ok && advanced.value ? advanced.value.state : created.value.state;
  return json({matchId, state});
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: CORS});
  if (req.method !== 'POST') return json({error: 'METHOD_NOT_ALLOWED'}, 405);
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY)
    return json({error: 'SERVER_NOT_CONFIGURED'}, 500);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({error: 'INVALID_JSON'}, 400);
  }
  const payload =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const service = serviceClient();

  try {
    if (payload['type'] === 'TIMEOUT_SWEEP') {
      if (req.headers.get('Authorization') !== `Bearer ${SERVICE_KEY}`)
        return json({error: 'FORBIDDEN'}, 403);
      const {data: stale} = await service
        .from('matches')
        .select('id')
        .eq('status', 'active')
        .lt('turn_started_at', new Date(Date.now() - 15_000).toISOString())
        .limit(50);
      const auth = authority(service);
      let handled = 0;
      for (const row of stale ?? []) {
        const result = await auth.handleTurnTimeout(row.id as string);
        if (result.ok && result.value) {
          handled++;
          const ai = await auth.advanceAiSeats(row.id as string);
          const state = ai.ok && ai.value ? ai.value.state : result.value.state;
          await finalizeIfFinished(service, state);
        }
      }
      return json({handled});
    }

    const userId = await authenticatedUserId(req);
    if (!userId) return json({error: 'UNAUTHENTICATED'}, 401);

    if (payload['type'] === 'START_MATCH')
      return await startMatch(service, userId, payload['roomId']);

    const auth = authority(service);
    const result = await auth.handleIntent({userId}, payload);
    if (!result.ok) {
      const status =
        result.error.code === 'NOT_A_PARTICIPANT'
          ? 403
          : result.error.code === 'MATCH_NOT_FOUND'
            ? 404
            : 409;
      return json(
        {error: result.error.code, message: result.error.message},
        status
      );
    }
    let accepted: AuthorityAccepted = result.value;
    const ai = await auth.advanceAiSeats(result.value.state.config.matchId);
    if (ai.ok && ai.value) {
      accepted = {
        state: ai.value.state,
        events: [...result.value.events, ...ai.value.events],
      };
    }
    await finalizeIfFinished(service, accepted.state);
    return json(accepted);
  } catch (error) {
    consoleJsonLogger.log('error', 'match_action_failed', {
      message: (error as Error).message,
    });
    return json({error: 'INTERNAL_ERROR'}, 500);
  }
});
