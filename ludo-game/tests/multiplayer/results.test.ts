import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {computeMatchResults} from '../../src/multiplayer/authority/results.ts';
import {
  CATALOG_MIGRATION,
  PROGRESSION_MIGRATION,
  catalogSeedSql,
  progressionSeedSql,
} from '../../scripts/catalogSql.ts';
import {simulate} from '../game/simulate.ts';
import {newGame} from '../game/helpers.ts';

describe('match results (server side)', () => {
  it('computes one result per human with XP, captures and finished pawns', () => {
    const sim = simulate('results', '4p', ['hard', 'normal', 'easy', 'normal']);
    const humans = new Set(['ai-0', 'ai-2']); // pretend two seats are humans
    const results = computeMatchResults(sim.final, {
      humanIds: humans,
      firstMatchOfDay: new Set(['ai-0']),
      withFriend: new Set(),
    });
    expect(results.map(r => r.user_id).sort()).toEqual(['ai-0', 'ai-2']);
    for (const r of results) {
      const ranking = sim.final.rankings.find(x => x.playerId === r.user_id);
      expect(r.rank).toBe(ranking?.rank);
      expect(r.xp).toBeGreaterThan(0);
      expect(r.pawns_finished).toBeGreaterThanOrEqual(0);
      expect(r.pawns_finished).toBeLessThanOrEqual(4);
    }
  });

  it('refuses an unfinished match', () => {
    expect(() =>
      computeMatchResults(newGame('2p'), {
        humanIds: new Set(),
        firstMatchOfDay: new Set(),
        withFriend: new Set(),
      })
    ).toThrow();
  });
});

describe('generated SQL', () => {
  it('the committed catalogue migration matches the TypeScript catalogue (no drift)', () => {
    expect(readFileSync(CATALOG_MIGRATION, 'utf8')).toBe(catalogSeedSql());
    expect(readFileSync(PROGRESSION_MIGRATION, 'utf8')).toBe(
      progressionSeedSql()
    );
  });
});
