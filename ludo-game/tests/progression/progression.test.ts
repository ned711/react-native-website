import {describe, expect, it} from 'vitest';
import {ECONOMY_CONFIG} from '../../src/economy/config.ts';
import {badgeForLevel, BADGE_TIERS} from '../../src/progression/badges.ts';
import {
  chestAvailability,
  formatDuration,
} from '../../src/progression/chests.ts';
import {
  fragmentLabel,
  grantFragments,
} from '../../src/progression/fragments.ts';
import {
  levelFromXp,
  totalXpForLevel,
  xpToNextLevel,
} from '../../src/progression/levels.ts';
import {computeMatchXp} from '../../src/progression/xp.ts';
import {advanceMissions, MISSIONS} from '../../src/progression/missions.ts';
import {
  accumulate,
  EMPTY_LIFETIME,
  unlockedAchievements,
} from '../../src/progression/achievements.ts';
import {EMPTY_STATS, statsFromEvents} from '../../src/progression/stats.ts';
import {isActive} from '../../src/progression/seasons.ts';
import {simulate} from '../game/simulate.ts';

describe('levels and XP curve', () => {
  it('is monotonic and consistent', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(100);
    expect(totalXpForLevel(3)).toBe(225);
    for (let l = 1; l < 100; l++) {
      expect(totalXpForLevel(l + 1) - totalXpForLevel(l)).toBe(
        xpToNextLevel(l)
      );
      expect(levelFromXp(totalXpForLevel(l)).level).toBe(l);
      expect(levelFromXp(totalXpForLevel(l + 1) - 1).level).toBe(l);
    }
  });

  it('caps at level 100', () => {
    const max = levelFromXp(10_000_000);
    expect(max.level).toBe(100);
    expect(max.xpForNextLevel).toBeNull();
    expect(levelFromXp(-50).level).toBe(1);
  });
});

describe('badges', () => {
  it('covers every level 1..100 exactly once with the requested tiers', () => {
    for (let l = 1; l <= 100; l++) {
      expect(
        BADGE_TIERS.filter(t => l >= t.minLevel && l <= t.maxLevel)
      ).toHaveLength(1);
    }
    expect(badgeForLevel(1).label).toBe('Médaille Bronze');
    expect(badgeForLevel(4).label).toBe('Médaille Bronze');
    expect(badgeForLevel(5).label).toBe('Médaille Argent');
    expect(badgeForLevel(19).label).toBe('Médaille Platine');
    expect(badgeForLevel(20).label).toBe('Coupe Bronze');
    expect(badgeForLevel(39).label).toBe('Coupe Platine');
    expect(badgeForLevel(40).label).toBe('Trophée Bronze');
    expect(badgeForLevel(79).label).toBe('Trophée Platine');
    expect(badgeForLevel(80).label).toBe('Diamant');
    expect(badgeForLevel(90).label).toBe('Légende');
    expect(badgeForLevel(100).label).toBe('Maître Ludo');
    expect(BADGE_TIERS.every(t => t.art.status === 'PLACEHOLDER_ASSET')).toBe(
      true
    );
  });
});

describe('match XP', () => {
  it('rewards completion, victory, place, daily, friends and captures (capped)', () => {
    const win = computeMatchXp({
      ranking: {rank: 1, outcome: 'finished'},
      captures: 10,
      firstMatchOfDay: true,
      playedWithFriend: true,
    });
    expect(win.lines.map(l => l.source)).toEqual([
      'completed',
      'victory',
      'first_match_of_day',
      'friend',
      'captures',
    ]);
    expect(win.total).toBe(20 + 50 + 40 + 15 + 10);
    const second = computeMatchXp({
      ranking: {rank: 2, outcome: 'finished'},
      captures: 0,
      firstMatchOfDay: false,
      playedWithFriend: false,
    });
    expect(second.total).toBe(20 + 25);
  });

  it('gives nothing to a player who left', () => {
    expect(
      computeMatchXp({
        ranking: {rank: 4, outcome: 'left'},
        captures: 5,
        firstMatchOfDay: true,
        playedWithFriend: true,
      }).total
    ).toBe(0);
  });
});

describe('fragments', () => {
  it('unlocks the item at 6/6 and reports overflow afterwards', () => {
    let p = {itemId: 'samurai', fragments: 0, unlocked: false};
    const r1 = grantFragments(p, 4);
    expect(r1.progress.fragments).toBe(4);
    expect(fragmentLabel(r1.progress)).toBe('4/6');
    p = r1.progress;
    const r2 = grantFragments(p, 3);
    expect(r2.newlyUnlocked).toBe(true);
    expect(r2.progress).toEqual({
      itemId: 'samurai',
      fragments: 6,
      unlocked: true,
    });
    expect(r2.overflow).toBe(1);
    const r3 = grantFragments(r2.progress, 2);
    expect(r3.newlyUnlocked).toBe(false);
    expect(r3.overflow).toBe(2);
    expect(() => grantFragments(p, 0)).toThrow();
    expect(ECONOMY_CONFIG.fragmentsPerItem).toBe(6);
  });
});

describe('chest availability (display only)', () => {
  it('uses a 3h cooldown', () => {
    const t0 = 1_000_000;
    expect(chestAvailability(null, t0).available).toBe(true);
    const later = chestAvailability(t0, t0 + 60 * 60 * 1000);
    expect(later.available).toBe(false);
    expect(later.remainingMs).toBe(2 * 60 * 60 * 1000);
    expect(chestAvailability(t0, t0 + 3 * 60 * 60 * 1000).available).toBe(true);
    expect(formatDuration(2 * 3600 * 1000 + 61_000)).toBe('2:01:01');
    expect(formatDuration(59_000)).toBe('00:59');
  });
});

describe('stats, missions and achievements', () => {
  it('extracts per-player stats from a real simulated match', () => {
    const sim = simulate('stats-1', '2p', ['hard', 'easy']);
    const winner = sim.final.rankings[0]?.color;
    if (!winner) throw new Error();
    const stats = statsFromEvents(sim.events, winner, {playedWithFriend: true});
    expect(stats.wins).toBe(1);
    expect(stats.matchesCompleted).toBe(1);
    expect(stats.pawnsFinished).toBe(4);
    expect(stats.finishedAllPawns).toBe(true);
    const capturesInEvents = sim.events.filter(
      e => e.type === 'PAWN_CAPTURED' && e.payload.attacker === winner
    ).length;
    expect(stats.captures).toBe(capturesInEvents);
  });

  it('advances missions and never exceeds targets', () => {
    const stats = {
      ...EMPTY_STATS,
      wins: 1,
      captures: 5,
      matchesCompleted: 1,
      playedWithFriend: true,
    };
    let progress = advanceMissions(MISSIONS, [], stats);
    expect(progress.find(p => p.missionId === 'daily_capture_3')).toMatchObject(
      {progress: 3, completed: true}
    );
    expect(progress.find(p => p.missionId === 'daily_win_2')).toMatchObject({
      progress: 1,
      completed: false,
    });
    expect(
      progress.find(p => p.missionId === 'daily_friend_1')?.completed
    ).toBe(true);
    progress = advanceMissions(MISSIONS, progress, stats);
    expect(progress.find(p => p.missionId === 'daily_win_2')?.completed).toBe(
      true
    );
  });

  it('tracks streaks and unlocks achievements', () => {
    let life = EMPTY_LIFETIME;
    for (let i = 0; i < 5; i++) {
      life = accumulate(life, {
        ...EMPTY_STATS,
        matchesCompleted: 1,
        wins: 1,
        winWithoutCapture: true,
      });
    }
    expect(life.bestWinStreak).toBe(5);
    const ids = unlockedAchievements(life).map(a => a.id);
    expect(ids).toEqual(
      expect.arrayContaining(['first_win', 'streak_5', 'pacifist'])
    );
    expect(
      unlockedAchievements(life, ['first_win']).map(a => a.id)
    ).not.toContain('first_win');
    life = accumulate(life, {...EMPTY_STATS, matchesCompleted: 1});
    expect(life.currentWinStreak).toBe(0);
    expect(life.bestWinStreak).toBe(5);
  });

  it('computes season / event activity windows', () => {
    const p = {
      startsAt: '2026-01-01T00:00:00Z',
      endsAt: '2026-02-01T00:00:00Z',
    };
    expect(isActive(p, Date.parse('2026-01-15T00:00:00Z'))).toBe(true);
    expect(isActive(p, Date.parse('2026-02-01T00:00:00Z'))).toBe(false);
  });
});
