/**
 * Pure Ludo reducer. No I/O, no randomness, no clock access: everything is
 * injected. Identical inputs always produce identical outputs, which makes
 * replays, server authority and tests possible.
 */
import {
  FINISH_POSITION,
  PAWNS_PER_PLAYER,
  SEAT_ORDER,
  START_INDEX,
  isOnTrack,
} from '../board/constants.ts';
import {resolveCaptures} from '../capture/capture.ts';
import {applyAdventureLanding} from '../adventure/effects.ts';
import type {GameEvent} from '../events/types.ts';
import {legalMovesFor} from '../movement/movement.ts';
import {validateRules} from '../rules/defaults.ts';
import {endTurn} from '../turns/turns.ts';
import {computeRankings, evaluateEnd} from '../victory/victory.ts';
import {
  isDieValue,
  type GameConfig,
  type GameState,
  type LegalMove,
  type PlayerColor,
} from '../types.ts';
import {err, ok, type Result} from '../../utils/result.ts';
import type {GameAction} from './actions.ts';
import {
  EventCollector,
  getPlayer,
  mapColors,
  toDraft,
  updatePlayer,
  type Draft,
  type EngineContext,
} from './draft.ts';
import {EngineErrorCode, engineError, type EngineError} from './errors.ts';

export interface EngineSuccess {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export type EngineResult = Result<EngineSuccess, EngineError>;

export function validateConfig(config: GameConfig): string[] {
  const problems = validateRules(config.rules);
  const colors = config.seats.map(s => s.color);
  if (config.seats.length < 2 || config.seats.length > 4) {
    problems.push(`a game needs 2 to 4 seats, got ${config.seats.length}`);
  }
  if (new Set(colors).size !== colors.length)
    problems.push('duplicate seat colour');
  if (new Set(config.seats.map(s => s.playerId)).size !== config.seats.length) {
    problems.push('duplicate playerId');
  }
  if (!config.matchId) problems.push('matchId is required');
  if (config.teams) {
    const teamColors = config.teams.teams.flat();
    if (config.seats.length !== 4 || new Set(teamColors).size !== 4) {
      problems.push(
        'team games need exactly 4 seats split in two teams of two'
      );
    }
    if (!teamColors.every(c => colors.includes(c)))
      problems.push('team colour without a seat');
  }
  for (const cell of config.adventure?.cells ?? []) {
    if (
      !Number.isInteger(cell.trackPosition) ||
      cell.trackPosition < 0 ||
      cell.trackPosition > 51
    ) {
      problems.push(`adventure cell outside the track: ${cell.trackPosition}`);
    }
  }
  return problems;
}

export function createGame(
  config: GameConfig,
  ctx: EngineContext
): EngineResult {
  const problems = validateConfig(config);
  if (problems.length > 0) {
    return err(
      engineError(EngineErrorCode.INVALID_CONFIG, problems.join('; '))
    );
  }
  const seated = SEAT_ORDER.filter(c => config.seats.some(s => s.color === c));
  const first = seated[0];
  if (!first)
    return err(engineError(EngineErrorCode.INVALID_CONFIG, 'no seat'));

  const draft: Draft = {
    config,
    version: 0,
    phase: {kind: 'awaiting_roll'},
    currentColor: first,
    turnNumber: 1,
    consecutiveSixes: 0,
    lastRoll: null,
    pawns: mapColors(c =>
      seated.includes(c) ? Array.from({length: PAWNS_PER_PLAYER}, () => -1) : []
    ),
    shields: mapColors(c =>
      seated.includes(c)
        ? Array.from({length: PAWNS_PER_PLAYER}, () => false)
        : []
    ),
    players: seated.map(color => {
      const seat = config.seats.find(s => s.color === color);
      return {
        color,
        playerId: seat?.playerId ?? color,
        displayName: seat?.displayName ?? color,
        controller: seat?.controller ?? {kind: 'human'},
        status: 'active',
        skipTurns: 0,
        treasure: 0,
        finishedAtTurn: null,
        captures: 0,
      };
    }),
    finishOrder: [],
    leaveOrder: [],
    duel: null,
    rankings: [],
    eventSeq: 0,
  };
  const events = new EventCollector(draft, ctx);
  events.emit('GAME_STARTED', null, {
    colors: seated,
    endGameMode: config.endGameMode,
    adventureSeed: config.adventure?.seed ?? null,
  });
  events.emit('TURN_STARTED', first, {turnNumber: draft.turnNumber});
  return ok({state: draft, events: events.events});
}

function finishGame(
  draft: Draft,
  events: EventCollector,
  winningTeam: number | null
): void {
  draft.rankings = computeRankings(draft, winningTeam);
  draft.phase = {kind: 'finished'};
  events.emit('GAME_FINISHED', null, {rankings: draft.rankings, winningTeam});
}

/** Returns true when the game ended. */
function checkEnd(draft: Draft, events: EventCollector): boolean {
  const evaluation = evaluateEnd(draft);
  if (evaluation.finished) {
    finishGame(draft, events, evaluation.winningTeam);
    return true;
  }
  if (evaluation.duel) {
    draft.duel = {colors: evaluation.duel, startedAtTurn: draft.turnNumber};
    events.emit('DUEL_STARTED', null, {colors: evaluation.duel});
  }
  return false;
}

function applyCaptures(
  draft: Draft,
  events: EventCollector,
  color: PlayerColor,
  pawnIndex: number
): number {
  const position = draft.pawns[color][pawnIndex];
  if (position === undefined || !isOnTrack(position)) return 0;
  const {captures, shielded} = resolveCaptures(draft, color, position);
  for (const victim of shielded) {
    draft.shields[victim.color][victim.pawnIndex] = false;
    events.emit('CAPTURE_BLOCKED_BY_SHIELD', color, {
      attacker: color,
      victim: victim.color,
      victimPawn: victim.pawnIndex,
      trackPosition: victim.trackPosition,
    });
  }
  for (const victim of captures) {
    const from = draft.pawns[victim.color][victim.pawnIndex] ?? -1;
    draft.pawns[victim.color][victim.pawnIndex] = -1;
    draft.shields[victim.color][victim.pawnIndex] = false;
    events.emit('PAWN_CAPTURED', color, {
      attacker: color,
      attackerPawn: pawnIndex,
      victim: victim.color,
      victimPawn: victim.pawnIndex,
      trackPosition: victim.trackPosition,
    });
    events.emit('PAWN_RETURNED', victim.color, {
      pawnIndex: victim.pawnIndex,
      from,
    });
  }
  if (captures.length > 0) {
    const player = getPlayer(draft, color);
    updatePlayer(draft, color, {
      captures: (player?.captures ?? 0) + captures.length,
    });
  }
  return captures.length;
}

function executeMove(
  draft: Draft,
  events: EventCollector,
  move: LegalMove
): void {
  const {color, pawnIndex} = move;
  draft.pawns[color][pawnIndex] = move.to;
  if (move.kind === 'spawn') {
    events.emit('PAWN_SPAWNED', color, {
      pawnIndex,
      trackPosition: START_INDEX[color],
    });
  } else {
    events.emit('PAWN_MOVED', color, {
      pawnIndex,
      from: move.from,
      to: move.to,
      path: move.path,
      dice: move.dice,
    });
  }
  if (move.kind === 'enter_final_lane')
    events.emit('FINAL_LANE_ENTERED', color, {pawnIndex});

  let captured = applyCaptures(draft, events, color, pawnIndex);
  let bonusTurn = false;
  if (draft.config.adventure && isOnTrack(move.to)) {
    const outcome = applyAdventureLanding(draft, events, color, pawnIndex);
    bonusTurn = outcome.bonusTurn;
    if (outcome.relocatedTo !== null)
      captured += applyCaptures(draft, events, color, pawnIndex);
  }

  let pawnFinished = false;
  if (move.to === FINISH_POSITION) {
    pawnFinished = true;
    const finishedPawns = draft.pawns[color].filter(
      p => p === FINISH_POSITION
    ).length;
    events.emit('PAWN_FINISHED', color, {pawnIndex, finishedPawns});
    if (finishedPawns === PAWNS_PER_PLAYER) {
      draft.finishOrder.push(color);
      updatePlayer(draft, color, {
        status: 'finished',
        finishedAtTurn: draft.turnNumber,
      });
      events.emit('PLAYER_FINISHED', color, {
        place: draft.finishOrder.length,
        turnNumber: draft.turnNumber,
      });
    }
  }

  if (checkEnd(draft, events)) return;

  const rules = draft.config.rules;
  const reasons: ('six' | 'capture' | 'finish' | 'bonus')[] = [];
  if (move.dice === 6 && rules.sixGrantsExtraTurn) reasons.push('six');
  if (captured > 0 && rules.captureGrantsExtraTurn) reasons.push('capture');
  if (pawnFinished && rules.finishGrantsExtraTurn) reasons.push('finish');
  if (bonusTurn) reasons.push('bonus');

  const stillActive = getPlayer(draft, color)?.status === 'active';
  if (stillActive && reasons.length > 0) {
    draft.phase = {kind: 'awaiting_roll'};
    events.emit('EXTRA_TURN_GRANTED', color, {reasons});
  } else {
    endTurn(draft, events);
  }
}

export function applyAction(
  state: GameState,
  action: GameAction,
  ctx: EngineContext
): EngineResult {
  if (state.phase.kind === 'finished') {
    return err(engineError(EngineErrorCode.GAME_FINISHED, 'the game is over'));
  }
  const player = state.players.find(p => p.color === action.color);
  if (!player) {
    return err(
      engineError(EngineErrorCode.UNKNOWN_PLAYER, `no seat for ${action.color}`)
    );
  }
  if (player.status !== 'active') {
    return err(
      engineError(
        EngineErrorCode.PLAYER_NOT_ACTIVE,
        `${action.color} is ${player.status}`
      )
    );
  }

  const draft = toDraft(state);
  const events = new EventCollector(draft, ctx);

  switch (action.type) {
    case 'ROLL_DICE': {
      if (state.currentColor !== action.color) {
        return err(
          engineError(
            EngineErrorCode.NOT_YOUR_TURN,
            `it is ${state.currentColor}'s turn`
          )
        );
      }
      if (state.phase.kind !== 'awaiting_roll') {
        return err(
          engineError(
            EngineErrorCode.ALREADY_ROLLED,
            'the dice was already rolled'
          )
        );
      }
      if (!isDieValue(action.value)) {
        return err(
          engineError(
            EngineErrorCode.INVALID_DICE_VALUE,
            `invalid die ${String(action.value)}`
          )
        );
      }
      const value = action.value;
      draft.consecutiveSixes = value === 6 ? state.consecutiveSixes + 1 : 0;
      draft.lastRoll = {color: action.color, value};
      const max = state.config.rules.maxConsecutiveSixes;
      if (max !== null && draft.consecutiveSixes >= max) {
        events.emit('DICE_ROLLED', action.color, {
          value,
          consecutiveSixes: draft.consecutiveSixes,
          legalMoveCount: 0,
        });
        events.emit('TURN_FORFEITED', action.color, {reason: 'too_many_sixes'});
        endTurn(draft, events);
        break;
      }
      const legalMoves = legalMovesFor(draft, action.color, value);
      events.emit('DICE_ROLLED', action.color, {
        value,
        consecutiveSixes: draft.consecutiveSixes,
        legalMoveCount: legalMoves.length,
      });
      if (legalMoves.length === 0) {
        events.emit('NO_LEGAL_MOVE', action.color, {dice: value});
        endTurn(draft, events);
      } else {
        draft.phase = {kind: 'awaiting_move', dice: value, legalMoves};
      }
      break;
    }
    case 'MOVE_PAWN': {
      if (state.currentColor !== action.color) {
        return err(
          engineError(
            EngineErrorCode.NOT_YOUR_TURN,
            `it is ${state.currentColor}'s turn`
          )
        );
      }
      if (state.phase.kind !== 'awaiting_move') {
        return err(
          engineError(
            EngineErrorCode.MUST_ROLL_FIRST,
            'roll the dice before moving'
          )
        );
      }
      if (
        !Number.isInteger(action.pawnIndex) ||
        action.pawnIndex < 0 ||
        action.pawnIndex >= PAWNS_PER_PLAYER
      ) {
        return err(
          engineError(
            EngineErrorCode.INVALID_PAWN,
            `invalid pawn ${action.pawnIndex}`
          )
        );
      }
      const move = state.phase.legalMoves.find(
        m => m.pawnIndex === action.pawnIndex
      );
      if (!move) {
        return err(
          engineError(
            EngineErrorCode.ILLEGAL_MOVE,
            `pawn ${action.pawnIndex} cannot move`
          )
        );
      }
      executeMove(draft, events, move);
      break;
    }
    case 'LEAVE': {
      const wasCurrent = state.currentColor === action.color;
      draft.pawns[action.color] = draft.pawns[action.color].map(() => -1);
      draft.shields[action.color] = draft.shields[action.color].map(
        () => false
      );
      draft.leaveOrder.push(action.color);
      updatePlayer(draft, action.color, {status: 'left'});
      events.emit('PLAYER_LEFT', action.color, {reason: action.reason});
      if (checkEnd(draft, events)) break;
      if (wasCurrent) endTurn(draft, events);
      else if (draft.phase.kind === 'awaiting_move') {
        // The removed pawns may have been capture targets: recompute.
        const phase = draft.phase;
        draft.phase = {
          ...phase,
          legalMoves: legalMovesFor(draft, draft.currentColor, phase.dice),
        };
      }
      break;
    }
    case 'REPLACE_WITH_AI': {
      updatePlayer(draft, action.color, {
        controller: {kind: 'ai', difficulty: action.difficulty},
      });
      events.emit('PLAYER_REPLACED_BY_AI', action.color, {
        difficulty: action.difficulty,
      });
      break;
    }
    default: {
      const exhaustive: never = action;
      return err(
        engineError(
          EngineErrorCode.INVALID_ACTION,
          `unknown action ${JSON.stringify(exhaustive)}`
        )
      );
    }
  }

  draft.version = state.version + 1;
  return ok({state: draft, events: events.events});
}

/** Convenience accessor used by UIs, AIs and the server. */
export function currentLegalMoves(state: GameState): readonly LegalMove[] {
  return state.phase.kind === 'awaiting_move' ? state.phase.legalMoves : [];
}
