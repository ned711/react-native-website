/**
 * Server-authoritative match processing. Runs on the server only (Supabase
 * Edge Function, see supabase/functions/match-action). The client sends
 * intents; this module validates them in a fixed order and, only then,
 * produces the new state through the same pure engine used offline.
 *
 *  1 authenticated user?          7 dice available (phase)?
 *  2 match exists / valid?         8 pawn belongs to the player (colour from seat)?
 *  3 user seated in the match?     9 legal move?            \
 *  4 allowed (not a spectator)?   10 legal capture?          } engine
 *  5 user's turn?                 11 legal progression?      |
 *  6 action valid / version ok?   12 coherent end of game?  /
 */
import {createAi} from '../../game/ai/ai.ts';
import type {GameAction} from '../../game/engine/actions.ts';
import {applyAction} from '../../game/engine/engine.ts';
import type {EngineErrorCode} from '../../game/engine/errors.ts';
import type {GameEvent} from '../../game/events/types.ts';
import {rollDie} from '../../game/dice/dice.ts';
import {matchRolesFor, rolesCan} from '../../game/spectator/permissions.ts';
import type {GameState, PlayerColor} from '../../game/types.ts';
import {createSeededRandom, type RandomSource} from '../../utils/random.ts';
import {err, ok, type Result} from '../../utils/result.ts';
import {
  DEFAULT_ABANDON_POLICIES,
  evaluateTurn,
  type AbandonPolicy,
} from '../reconnection/abandon.ts';
import {parseClientIntent} from './intents.ts';
import type {Logger} from './logger.ts';
import type {MatchStore, StoredMatch} from './store.ts';

export const AuthorityErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_INTENT: 'INVALID_INTENT',
  MATCH_NOT_FOUND: 'MATCH_NOT_FOUND',
  MATCH_FINISHED: 'MATCH_FINISHED',
  NOT_A_PARTICIPANT: 'NOT_A_PARTICIPANT',
  SPECTATOR_FORBIDDEN: 'SPECTATOR_FORBIDDEN',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  STALE_VERSION: 'STALE_VERSION',
  DICE_NOT_AVAILABLE: 'DICE_NOT_AVAILABLE',
  ILLEGAL_ACTION: 'ILLEGAL_ACTION',
  CONFLICT: 'CONFLICT',
} as const;
export type AuthorityErrorCode =
  (typeof AuthorityErrorCode)[keyof typeof AuthorityErrorCode];

export interface AuthorityError {
  readonly code: AuthorityErrorCode;
  readonly message: string;
  readonly engineCode?: EngineErrorCode;
}

export interface AuthContext {
  /** Verified user id from the JWT, or null when unauthenticated. */
  readonly userId: string | null;
}

export interface AuthorityAccepted {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export interface AuthorityDeps {
  readonly store: MatchStore;
  /** CSPRNG on the server. Never exposed to clients. */
  readonly dice: RandomSource;
  readonly clock: () => number;
  readonly logger: Logger;
  readonly policies?: Readonly<
    Record<GameState['config']['mode'], AbandonPolicy>
  >;
}

const fail = (
  code: AuthorityErrorCode,
  message: string,
  engineCode?: EngineErrorCode
) =>
  err<AuthorityError>(
    engineCode ? {code, message, engineCode} : {code, message}
  );

export class MatchAuthority {
  constructor(private readonly deps: AuthorityDeps) {}

  async handleIntent(
    auth: AuthContext,
    raw: unknown
  ): Promise<Result<AuthorityAccepted, AuthorityError>> {
    const {logger} = this.deps;
    // 1. authentication
    if (!auth.userId)
      return fail(
        AuthorityErrorCode.UNAUTHENTICATED,
        'authentication required'
      );
    const parsed = parseClientIntent(raw);
    if (!parsed.ok)
      return fail(AuthorityErrorCode.INVALID_INTENT, parsed.error);
    const intent = parsed.value;

    // 2. match exists
    const match = await this.deps.store.load(intent.matchId);
    if (!match)
      return fail(AuthorityErrorCode.MATCH_NOT_FOUND, 'unknown match');
    const {state} = match;

    // 3. user seated in the match (spectators read the match row through RLS,
    //    never through this service-role endpoint)
    const player = state.players.find(p => p.playerId === auth.userId);
    if (!player)
      return fail(
        AuthorityErrorCode.NOT_A_PARTICIPANT,
        'user is not seated in this match'
      );
    if (intent.type === 'SYNC') return ok({state, events: []});
    if (state.phase.kind === 'finished')
      return fail(AuthorityErrorCode.MATCH_FINISHED, 'match is over');

    // 4. permissions: finished / departed players are spectators
    const roles = matchRolesFor(state, auth.userId);
    let action: GameAction;
    switch (intent.type) {
      case 'LEAVE_MATCH':
        if (player.status !== 'active')
          return fail(
            AuthorityErrorCode.SPECTATOR_FORBIDDEN,
            'already out of the match'
          );
        action = {type: 'LEAVE', color: player.color, reason: 'quit'};
        break;
      case 'ROLL_DICE':
      case 'MOVE_PAWN': {
        const capability =
          intent.type === 'ROLL_DICE' ? 'ROLL_DICE' : 'MOVE_PAWN';
        if (!rolesCan(roles, capability)) {
          return fail(
            AuthorityErrorCode.SPECTATOR_FORBIDDEN,
            'spectators cannot play'
          );
        }
        // 5. turn
        if (state.currentColor !== player.color)
          return fail(AuthorityErrorCode.NOT_YOUR_TURN, 'not your turn');
        // 6. version (double submissions / stale clients)
        if (intent.expectedVersion !== state.version) {
          return fail(
            AuthorityErrorCode.STALE_VERSION,
            `expected ${state.version}, got ${intent.expectedVersion}`
          );
        }
        if (intent.type === 'ROLL_DICE') {
          // 7. dice available
          if (state.phase.kind !== 'awaiting_roll') {
            return fail(
              AuthorityErrorCode.DICE_NOT_AVAILABLE,
              'dice already rolled'
            );
          }
          action = {
            type: 'ROLL_DICE',
            color: player.color,
            value: rollDie(this.deps.dice),
          };
        } else {
          // 8. the pawn is addressed within the caller's own colour only
          action = {
            type: 'MOVE_PAWN',
            color: player.color,
            pawnIndex: intent.pawnIndex,
          };
        }
        break;
      }
    }

    // 9-12. the pure engine validates legality, captures, progression and end
    const result = await this.commit(match, action, {
      resetMissed: player.color,
    });
    if (!result.ok) {
      logger.log('warn', 'intent_rejected', {
        matchId: intent.matchId,
        userId: auth.userId,
        intent: intent.type,
        code: result.error.code,
        engineCode: result.error.engineCode ?? null,
      });
      return result;
    }
    logger.log('info', 'intent_applied', {
      matchId: intent.matchId,
      userId: auth.userId,
      intent: intent.type,
      version: result.value.state.version,
    });
    return result;
  }

  /**
   * Called by a scheduler (cron / timer) - never by clients. Plays for a player
   * who exceeded the turn timeout, and declares abandon after repeated misses.
   */
  async handleTurnTimeout(
    matchId: string
  ): Promise<Result<AuthorityAccepted | null, AuthorityError>> {
    const match = await this.deps.store.load(matchId);
    if (!match)
      return fail(AuthorityErrorCode.MATCH_NOT_FOUND, 'unknown match');
    if (match.state.phase.kind === 'finished') return ok(null);
    const policies = this.deps.policies ?? DEFAULT_ABANDON_POLICIES;
    const policy = policies[match.state.config.mode];
    const color = match.state.currentColor;
    const missed = match.missedTurns[color] ?? 0;
    const verdict = evaluateTurn(
      policy,
      match.turnStartedAt,
      this.deps.clock(),
      missed
    );
    if (verdict === 'on_time') return ok(null);

    const player = match.state.players.find(p => p.color === color);
    if (verdict === 'abandoned' && player?.controller.kind === 'human') {
      this.deps.logger.log('warn', 'seat_abandoned', {
        matchId,
        color,
        missed: missed + 1,
        policy: policy.onAbandon,
      });
      const action: GameAction =
        policy.onAbandon === 'replace_with_ai'
          ? {
              type: 'REPLACE_WITH_AI',
              color,
              difficulty: policy.replacementDifficulty,
            }
          : {type: 'LEAVE', color, reason: 'abandon'};
      return this.commit(match, action, {resetMissed: null});
    }

    // Auto-play one step for the absent player (roll, or move chosen by the
    // Normal AI from the legal moves only).
    let action: GameAction;
    if (match.state.phase.kind === 'awaiting_roll') {
      action = {type: 'ROLL_DICE', color, value: rollDie(this.deps.dice)};
    } else if (match.state.phase.kind === 'awaiting_move') {
      const ai = createAi(
        'normal',
        createSeededRandom(`${matchId}:${match.state.version}`)
      );
      action = {
        type: 'MOVE_PAWN',
        color,
        pawnIndex: ai.chooseMove(match.state, match.state.phase.legalMoves)
          .pawnIndex,
      };
    } else {
      return ok(null);
    }
    this.deps.logger.log('info', 'turn_auto_played', {
      matchId,
      color,
      missed: missed + 1,
    });
    return this.commit(match, action, {
      resetMissed: null,
      incrementMissed: color,
    });
  }

  private async commit(
    match: StoredMatch,
    action: GameAction,
    options: {resetMissed: PlayerColor | null; incrementMissed?: PlayerColor}
  ): Promise<Result<AuthorityAccepted, AuthorityError>> {
    const now = this.deps.clock();
    const applied = applyAction(match.state, action, {now});
    if (!applied.ok) {
      return fail(
        AuthorityErrorCode.ILLEGAL_ACTION,
        applied.error.message,
        applied.error.code
      );
    }
    const {state, events} = applied.value;
    const turnChanged = events.some(
      e => e.type === 'TURN_STARTED' || e.type === 'EXTRA_TURN_GRANTED'
    );
    const missedTurns: Partial<Record<PlayerColor, number>> = {
      ...match.missedTurns,
    };
    if (options.resetMissed) missedTurns[options.resetMissed] = 0;
    if (options.incrementMissed && turnChanged) {
      missedTurns[options.incrementMissed] =
        (missedTurns[options.incrementMissed] ?? 0) + 1;
    }
    const next: StoredMatch = {
      ...match,
      state,
      turnStartedAt: turnChanged ? now : match.turnStartedAt,
      missedTurns,
    };
    const outcome = await this.deps.store.commit(
      match.matchId,
      match.state.version,
      {next, action, events, at: now}
    );
    if (outcome === 'version_conflict') {
      return fail(
        AuthorityErrorCode.CONFLICT,
        'the match changed concurrently, resync required'
      );
    }
    return ok({state, events});
  }
}
