/**
 * Intents a remote client may send. They carry NO dice value and NO colour:
 * the server derives the colour from the authenticated user and draws dice
 * itself. Everything coming from the network is validated at runtime.
 */
import {err, ok, type Result} from '../../utils/result.ts';

export type ClientIntent =
  | {
      readonly type: 'ROLL_DICE';
      readonly matchId: string;
      readonly expectedVersion: number;
    }
  | {
      readonly type: 'MOVE_PAWN';
      readonly matchId: string;
      readonly expectedVersion: number;
      readonly pawnIndex: number;
    }
  | {readonly type: 'LEAVE_MATCH'; readonly matchId: string}
  | {readonly type: 'SYNC'; readonly matchId: string};

const MAX_ID_LENGTH = 64;
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readMatchId(input: Record<string, unknown>): string | null {
  const id = input['matchId'];
  return typeof id === 'string' &&
    id.length > 0 &&
    id.length <= MAX_ID_LENGTH &&
    ID_PATTERN.test(id)
    ? id
    : null;
}

function readVersion(input: Record<string, unknown>): number | null {
  const v = input['expectedVersion'];
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

export function parseClientIntent(
  input: unknown
): Result<ClientIntent, string> {
  if (!isRecord(input)) return err('intent must be an object');
  const matchId = readMatchId(input);
  if (!matchId) return err('invalid matchId');
  switch (input['type']) {
    case 'ROLL_DICE': {
      const expectedVersion = readVersion(input);
      if (expectedVersion === null) return err('invalid expectedVersion');
      return ok({type: 'ROLL_DICE', matchId, expectedVersion});
    }
    case 'MOVE_PAWN': {
      const expectedVersion = readVersion(input);
      const pawnIndex = input['pawnIndex'];
      if (expectedVersion === null) return err('invalid expectedVersion');
      if (typeof pawnIndex !== 'number' || !Number.isInteger(pawnIndex))
        return err('invalid pawnIndex');
      return ok({type: 'MOVE_PAWN', matchId, expectedVersion, pawnIndex});
    }
    case 'LEAVE_MATCH':
      return ok({type: 'LEAVE_MATCH', matchId});
    case 'SYNC':
      return ok({type: 'SYNC', matchId});
    default:
      return err('unknown intent type');
  }
}
