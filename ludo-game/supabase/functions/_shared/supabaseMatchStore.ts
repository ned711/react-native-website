// Supabase adapter of the MatchStore port (Deno / Edge Functions only).
import type {SupabaseClient} from 'npm:@supabase/supabase-js@2';
import type {
  CommitOutcome,
  MatchCommit,
  MatchStore,
  StoredMatch,
} from '../../../src/multiplayer/authority/store.ts';
import type {GameState, PlayerColor} from '../../../src/game/types.ts';

interface MatchRow {
  id: string;
  state: GameState;
  version: number;
  started_at: string;
  turn_started_at: string;
  missed_turns: Partial<Record<PlayerColor, number>>;
}

export class SupabaseMatchStore implements MatchStore {
  constructor(private readonly service: SupabaseClient) {}

  async load(matchId: string): Promise<StoredMatch | null> {
    const {data, error} = await this.service
      .from('matches')
      .select('id, state, version, started_at, turn_started_at, missed_turns')
      .eq('id', matchId)
      .maybeSingle<MatchRow>();
    if (error) throw new Error(`load match failed: ${error.code}`);
    if (!data) return null;
    return {
      matchId: data.id,
      state: data.state,
      startedAt: Date.parse(data.started_at),
      turnStartedAt: Date.parse(data.turn_started_at),
      missedTurns: data.missed_turns ?? {},
    };
  }

  async commit(
    matchId: string,
    expectedVersion: number,
    commit: MatchCommit
  ): Promise<CommitOutcome> {
    const {data, error} = await this.service.rpc('commit_match_action', {
      p_match: matchId,
      p_expected_version: expectedVersion,
      p_state: commit.next.state,
      p_action: commit.action,
      p_events: commit.events,
      p_turn_started_at: new Date(commit.next.turnStartedAt).toISOString(),
      p_missed_turns: commit.next.missedTurns,
    });
    if (error) throw new Error(`commit failed: ${error.code}`);
    return data === true ? 'committed' : 'version_conflict';
  }
}
