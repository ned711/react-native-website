import {describe, expect, it} from 'vitest';
import {
  generateAdventureBoard,
  matchRolesFor,
  replayMatch,
  roleCan,
  rolesCan,
} from '../../src/game/index.ts';
import {simulate} from './simulate.ts';
import {newGame} from './helpers.ts';

describe('replay', () => {
  it('rebuilds the exact final state and event stream from the action log', () => {
    for (const seed of ['r1', 'r2', 'r3']) {
      const sim = simulate(
        seed,
        '4p',
        ['hard', 'normal', 'easy', 'hard'],
        'top_two_final_duel'
      );
      const replay = replayMatch({
        config: sim.final.config,
        startedAt: sim.startedAt,
        actions: sim.actions,
      });
      if (!replay.ok) throw new Error(replay.error.error.message);
      expect(replay.value.state).toEqual(sim.final);
      expect(replay.value.events).toEqual(sim.events);
    }
  });

  it('can reconstruct intermediate states (spectator joining late)', () => {
    const sim = simulate(
      'r4',
      '2p',
      ['normal', 'normal'],
      'all_players',
      generateAdventureBoard('LUDO-123456')
    );
    const half = Math.floor(sim.actions.length / 2);
    const partial = replayMatch(
      {
        config: sim.final.config,
        startedAt: sim.startedAt,
        actions: sim.actions,
      },
      half
    );
    if (!partial.ok) throw new Error();
    expect(partial.value.appliedActions).toBe(half);
    expect(partial.value.state.version).toBe(half);
  });

  it('reports the first invalid action of a tampered log', () => {
    const sim = simulate('r5', '2p', ['normal', 'normal']);
    const tampered = [...sim.actions];
    const first = tampered[0];
    if (!first) throw new Error();
    tampered[0] = {
      ...first,
      action: {type: 'ROLL_DICE', color: 'blue', value: 6},
    };
    const replay = replayMatch({
      config: sim.final.config,
      startedAt: sim.startedAt,
      actions: tampered,
    });
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error.actionIndex).toBe(0);
      expect(replay.error.error.code).toBe('NOT_YOUR_TURN');
    }
  });

  it('keeps event sequence numbers strictly increasing and ids unique', () => {
    const sim = simulate('r6', '3p', ['easy', 'hard', 'normal']);
    sim.events.forEach((e, i) => expect(e.seq).toBe(i + 1));
    expect(new Set(sim.events.map(e => e.id)).size).toBe(sim.events.length);
    expect(sim.events.at(-1)?.type).toBe('GAME_FINISHED');
  });
});

describe('spectator permissions', () => {
  it('gives gameplay capabilities to active players only', () => {
    expect(roleCan('PLAYER', 'ROLL_DICE')).toBe(true);
    expect(roleCan('SPECTATOR', 'ROLL_DICE')).toBe(false);
    expect(roleCan('SPECTATOR', 'MOVE_PAWN')).toBe(false);
    expect(roleCan('SPECTATOR', 'SEND_CHAT')).toBe(true);
    expect(roleCan('SPECTATOR', 'SEND_GIFT')).toBe(true);
    expect(roleCan('ROOM_OWNER', 'MOVE_PAWN')).toBe(false);
    expect(rolesCan(['SPECTATOR', 'ROOM_OWNER'], 'START_MATCH')).toBe(true);
  });

  it('turns finished or unknown users into spectators', () => {
    const s = newGame('2p');
    expect(matchRolesFor(s, 'p0')).toEqual(['PLAYER']);
    expect(matchRolesFor(s, 'stranger')).toEqual(['SPECTATOR']);
    const finished = {
      ...s,
      players: s.players.map(p =>
        p.playerId === 'p0' ? {...p, status: 'finished' as const} : p
      ),
    };
    expect(matchRolesFor(finished, 'p0')).toEqual(['SPECTATOR']);
  });
});
