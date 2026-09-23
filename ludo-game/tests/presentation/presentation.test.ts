import {describe, expect, it} from 'vitest';
import {
  buildDiceRollSequence,
  PIP_LAYOUT,
  sequenceDurationMs,
} from '../../src/animations/dice.ts';
import {resolveCharacterAnimation} from '../../src/animations/characterResolver.ts';
import {
  AudioEngine,
  cuesForEvent,
  noAudioOutputBackend,
  type AudioBackend,
} from '../../src/audio/engine.ts';
import {getAudioPack} from '../../src/audio/packs.ts';
import {getCharacter} from '../../src/content/characters.ts';
import {
  ENVIRONMENTS,
  getEnvironment,
} from '../../src/environment/environments.ts';
import {
  PARTICLE_BUDGET,
  planParticles,
} from '../../src/environment/particles.ts';
import {GRAPHICS_QUALITIES} from '../../src/environment/types.ts';
import {DIE_VALUES, type GameEvent} from '../../src/game/index.ts';
import {createSeededRandom} from '../../src/utils/random.ts';
import {simulate} from '../game/simulate.ts';

describe('dice animation', () => {
  it('always ends on the real result, whatever the visual randomness', () => {
    for (const value of DIE_VALUES) {
      for (let s = 0; s < 20; s++) {
        const frames = buildDiceRollSequence(
          value,
          createSeededRandom(`v${s}`)
        );
        expect(frames.at(-1)).toMatchObject({phase: 'result', face: value});
        expect(frames[0]?.phase).toBe('lift');
        expect(frames.some(f => f.phase === 'slowdown')).toBe(true);
        expect(sequenceDurationMs(frames)).toBeLessThan(2000);
      }
    }
  });

  it('respects reduced motion', () => {
    expect(
      buildDiceRollSequence(4, createSeededRandom('r'), {
        spinFrames: 8,
        reducedMotion: true,
      })
    ).toEqual([{phase: 'result', face: 4, delayMs: 0, rotation: 0, lift: 0}]);
  });

  it('has correct pip counts', () => {
    for (const v of DIE_VALUES) expect(PIP_LAYOUT[v]).toHaveLength(v);
  });
});

describe('character animation resolver', () => {
  const capture: GameEvent = {
    id: 'm:1',
    seq: 1,
    type: 'PAWN_CAPTURED',
    timestamp: 0,
    matchId: 'm',
    playerColor: 'green',
    payload: {
      attacker: 'green',
      attackerPawn: 0,
      victim: 'blue',
      victimPawn: 1,
      trackPosition: 4,
    },
  };
  it('uses the character capture cinematic and flags missing clips', () => {
    const samurai = resolveCharacterAnimation(capture, getCharacter('samurai'));
    expect(samurai?.slot).toBe('capture');
    expect(samurai?.beats).toEqual([
      'combat_stance',
      'hand_on_katana',
      'draw_katana',
      'slash',
      'impact_effect',
      'victim_returns_home',
    ]);
    expect(samurai?.fallback).toBe(true);
    const osiris = resolveCharacterAnimation(capture, getCharacter('osiris'));
    expect(osiris?.beats[0]).toBe('raise_sceptre');
  });
});

describe('audio engine', () => {
  it('maps events to cues and respects mute / volumes / vibration', () => {
    const played: string[] = [];
    const haptics: string[] = [];
    const backend: AudioBackend = {
      play: r => (played.push(`${r.cue}@${r.volume}`), true),
    };
    const engine = new AudioEngine(getAudioPack('japan'), backend, {
      trigger: p => haptics.push(p),
    });
    const sim = simulate('audio', '2p', ['normal', 'normal']);
    engine.handleEvents(sim.events, 'green');
    expect(played.some(p => p.startsWith('DICE_LAND'))).toBe(true);
    expect(
      played.some(p => p.startsWith('VICTORY') || p.startsWith('DEFEAT'))
    ).toBe(true);
    const before = played.length;
    engine.setSettings({
      musicVolume: 0.5,
      effectsVolume: 0.5,
      voiceVolume: 0.5,
      uiVolume: 0.5,
      vibrationEnabled: false,
      muted: true,
    });
    const hapticsBefore = haptics.length;
    engine.handleEvents(sim.events, 'green');
    expect(played.length).toBe(before);
    expect(haptics.length).toBe(hapticsBefore);
  });

  it('never reports placeholder sounds as played', () => {
    const engine = new AudioEngine(
      getAudioPack('classic'),
      noAudioOutputBackend,
      null
    );
    engine.playCue('PAWN_CAPTURE');
    expect(engine.stats()).toEqual({requested: 1, played: 0, unavailable: 1});
  });

  it('spectators (no local colour) get no victory/defeat cue', () => {
    const sim = simulate('audio2', '2p', ['normal', 'normal']);
    const last = sim.events.at(-1);
    if (!last) throw new Error();
    expect(cuesForEvent(last, null)).toEqual([]);
  });
});

describe('environment particles', () => {
  it('respects LOW/NORMAL/HIGH budgets and reduced motion', () => {
    for (const env of ENVIRONMENTS) {
      for (const q of GRAPHICS_QUALITIES) {
        const planned = planParticles(env, q, {reduceMotion: false});
        expect(planned.length).toBeLessThanOrEqual(PARTICLE_BUDGET[q]);
        for (const p of planned) {
          expect(p.startX).toBeGreaterThanOrEqual(0);
          expect(p.startX).toBeLessThan(1);
        }
      }
      expect(planParticles(env, 'HIGH', {reduceMotion: true})).toEqual([]);
      expect(planParticles(env, 'LOW', {reduceMotion: false})).toEqual([]);
    }
    const japan = planParticles(getEnvironment('japan'), 'NORMAL', {
      reduceMotion: false,
    });
    expect(japan.length).toBeGreaterThan(0);
    expect(
      planParticles(getEnvironment('japan'), 'NORMAL', {reduceMotion: false})
    ).toEqual(japan);
  });
});
