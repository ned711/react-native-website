import type {GameAction} from '../../game/engine/actions.ts';
import type {GameEvent} from '../../game/events/types.ts';
import type {GameState, PlayerColor} from '../../game/types.ts';

export interface StoredMatch {
  readonly matchId: string;
  readonly state: GameState;
  readonly startedAt: number;
  /** When the current turn started (server clock), for turn timeouts. */
  readonly turnStartedAt: number;
  /** Consecutive turns auto-played by the server per colour (anti-abandon). */
  readonly missedTurns: Readonly<Partial<Record<PlayerColor, number>>>;
}

export interface MatchCommit {
  readonly next: StoredMatch;
  readonly action: GameAction;
  readonly events: readonly GameEvent[];
  readonly at: number;
}

export type CommitOutcome = 'committed' | 'version_conflict';

/**
 * Persistence port of the authority. `commit` MUST be atomic and succeed only
 * if the stored version still equals `expectedVersion` (compare-and-swap): this
 * is what rejects double actions and races between devices.
 */
export interface MatchStore {
  load(matchId: string): Promise<StoredMatch | null>;
  commit(
    matchId: string,
    expectedVersion: number,
    commit: MatchCommit
  ): Promise<CommitOutcome>;
}

/** In-memory implementation: tests and local development only. */
export class InMemoryMatchStore implements MatchStore {
  private readonly matches = new Map<string, StoredMatch>();
  readonly log: {matchId: string; action: GameAction; at: number}[] = [];

  put(match: StoredMatch): void {
    this.matches.set(match.matchId, match);
  }

  async load(matchId: string): Promise<StoredMatch | null> {
    return this.matches.get(matchId) ?? null;
  }

  async commit(
    matchId: string,
    expectedVersion: number,
    commit: MatchCommit
  ): Promise<CommitOutcome> {
    const current = this.matches.get(matchId);
    if (!current || current.state.version !== expectedVersion)
      return 'version_conflict';
    this.matches.set(matchId, commit.next);
    this.log.push({matchId, action: commit.action, at: commit.at});
    return 'committed';
  }
}
