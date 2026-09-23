import {describe, expect, it} from 'vitest';
import {simulate} from '../game/simulate.ts';

describe('AI strength (statistical)', () => {
  it('hard AI beats easy AI clearly over 200 two-player games', () => {
    let hardWins = 0;
    const games = 200;
    for (let g = 0; g < games; g++) {
      // alternate seats to cancel first-move advantage
      const hardFirst = g % 2 === 0;
      const sim = simulate(
        `wr-${g}`,
        '2p',
        hardFirst ? ['hard', 'easy'] : ['easy', 'hard']
      );
      const winner = sim.final.rankings[0]?.color;
      const hardColor = hardFirst ? 'green' : 'blue';
      if (winner === hardColor) hardWins++;
    }
    console.log(`hard vs easy: ${hardWins}/${games}`);
    expect(hardWins / games).toBeGreaterThan(0.6);
  });
});
