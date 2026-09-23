import {placeholder} from '../content/assets.ts';
import type {
  EnvironmentDefinition,
  ParticleEmitterDefinition,
} from './types.ts';

const count = (low: number, normal: number, high: number) => ({
  LOW: low,
  NORMAL: normal,
  HIGH: high,
});

function env(
  id: string,
  skyGradient: [string, string],
  emitters: ParticleEmitterDefinition[],
  weather: EnvironmentDefinition['weather'],
  lighting: EnvironmentDefinition['lighting']
): EnvironmentDefinition {
  return {
    id,
    skyGradient,
    emitters,
    weather,
    lighting,
    background: placeholder('image', `env.${id}.background`),
    layers: [
      placeholder('image', `env.${id}.layer.far`),
      placeholder('image', `env.${id}.layer.near`),
    ],
    soundscape: placeholder('music', `env.${id}.ambience`),
  };
}

/**
 * Procedural particles are real (drawn as simple shapes). Background art and
 * soundscapes are placeholders. LOW quality always disables particles.
 */
export const ENVIRONMENTS: readonly EnvironmentDefinition[] = [
  env('classic', ['#14213D', '#0B1426'], [], 'clear', 'day'),
  env(
    'japan',
    ['#2B1810', '#120905'],
    [
      {
        shape: 'petal',
        colors: ['#F8BBD0', '#F48FB1', '#FCE4EC'],
        sizeRange: [6, 11],
        durationRange: [9, 15],
        drift: 0.25,
        direction: 'down',
        opacity: 0.8,
        countByQuality: count(0, 8, 16),
      },
      {
        shape: 'mist',
        colors: ['#FFFFFF'],
        sizeRange: [80, 140],
        durationRange: [25, 40],
        drift: 0.4,
        direction: 'across',
        opacity: 0.06,
        countByQuality: count(0, 1, 3),
      },
    ],
    'wind',
    'dusk'
  ),
  env(
    'egypt',
    ['#3B2A12', '#1A1206'],
    [
      {
        shape: 'dust',
        colors: ['#E8C98A', '#D9B26F'],
        sizeRange: [2, 4],
        durationRange: [7, 12],
        drift: 0.6,
        direction: 'across',
        opacity: 0.5,
        countByQuality: count(0, 10, 20),
      },
      {
        shape: 'ember',
        colors: ['#FFB74D', '#FF8A65'],
        sizeRange: [2, 4],
        durationRange: [4, 7],
        drift: 0.05,
        direction: 'up',
        opacity: 0.7,
        countByQuality: count(0, 4, 8),
      },
    ],
    'heat',
    'torchlight'
  ),
  env(
    'china',
    ['#2E0D0D', '#140404'],
    [
      {
        shape: 'glow',
        colors: ['#FF7043', '#FFCA28'],
        sizeRange: [8, 14],
        durationRange: [14, 22],
        drift: 0.08,
        direction: 'up',
        opacity: 0.35,
        countByQuality: count(0, 4, 8),
      },
      {
        shape: 'petal',
        colors: ['#EF9A9A', '#FFCDD2'],
        sizeRange: [5, 9],
        durationRange: [10, 16],
        drift: 0.2,
        direction: 'down',
        opacity: 0.7,
        countByQuality: count(0, 5, 10),
      },
    ],
    'mist',
    'night'
  ),
  env(
    'india',
    ['#321040', '#15061C'],
    [
      {
        shape: 'petal',
        colors: ['#FF9933', '#FFC107'],
        sizeRange: [5, 9],
        durationRange: [10, 16],
        drift: 0.2,
        direction: 'down',
        opacity: 0.7,
        countByQuality: count(0, 6, 12),
      },
    ],
    'clear',
    'dusk'
  ),
  env(
    'italy',
    ['#1C3A2B', '#0B1A12'],
    [
      {
        shape: 'leaf',
        colors: ['#8BC34A', '#CDDC39'],
        sizeRange: [6, 10],
        durationRange: [10, 16],
        drift: 0.3,
        direction: 'down',
        opacity: 0.6,
        countByQuality: count(0, 5, 10),
      },
    ],
    'wind',
    'day'
  ),
  env(
    'russia',
    ['#142B4A', '#07121F'],
    [
      {
        shape: 'snow',
        colors: ['#FFFFFF', '#E3F2FD'],
        sizeRange: [3, 6],
        durationRange: [8, 14],
        drift: 0.15,
        direction: 'down',
        opacity: 0.85,
        countByQuality: count(0, 12, 24),
      },
    ],
    'snow',
    'night'
  ),
  env(
    'france',
    ['#1A2B4F', '#0A1328'],
    [
      {
        shape: 'leaf',
        colors: ['#FFB74D', '#E57373', '#AED581'],
        sizeRange: [6, 10],
        durationRange: [10, 16],
        drift: 0.3,
        direction: 'down',
        opacity: 0.6,
        countByQuality: count(0, 5, 10),
      },
    ],
    'wind',
    'day'
  ),
  env(
    'algeria',
    ['#163524', '#08150E'],
    [
      {
        shape: 'dust',
        colors: ['#E0C08A', '#D2B48C'],
        sizeRange: [2, 4],
        durationRange: [7, 12],
        drift: 0.6,
        direction: 'across',
        opacity: 0.45,
        countByQuality: count(0, 8, 16),
      },
    ],
    'heat',
    'day'
  ),
];

export function getEnvironment(id: string): EnvironmentDefinition {
  const found = ENVIRONMENTS.find(e => e.id === id) ?? ENVIRONMENTS[0];
  if (!found) throw new Error('no environment defined');
  return found;
}
