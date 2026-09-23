/**
 * Pure particle planning. The renderer animates the planned particles; it
 * never touches the game state. Budgets guarantee bounded CPU/GPU usage.
 */
import {
  createSeededRandom,
  randomFloat,
  type RandomSource,
} from '../utils/random.ts';
import type {
  EnvironmentDefinition,
  GraphicsQuality,
  ParticleShape,
} from './types.ts';

/** Hard cap across all emitters, whatever the definitions say. */
export const PARTICLE_BUDGET: Readonly<Record<GraphicsQuality, number>> = {
  LOW: 0,
  NORMAL: 16,
  HIGH: 32,
};

export interface PlannedParticle {
  readonly key: string;
  readonly shape: ParticleShape;
  readonly color: string;
  readonly size: number;
  /** Start position, fractions of the container (0..1). */
  readonly startX: number;
  readonly startY: number;
  readonly driftX: number;
  readonly direction: 'down' | 'up' | 'across';
  readonly durationMs: number;
  readonly delayMs: number;
  readonly opacity: number;
}

function between(
  rng: RandomSource,
  [min, max]: readonly [number, number]
): number {
  return min + (max - min) * randomFloat(rng);
}

export function planParticles(
  environment: EnvironmentDefinition,
  quality: GraphicsQuality,
  options: {readonly reduceMotion: boolean; readonly seed?: string}
): PlannedParticle[] {
  if (options.reduceMotion) return [];
  const budget = PARTICLE_BUDGET[quality];
  const rng = createSeededRandom(
    options.seed ?? `${environment.id}:${quality}`
  );
  const particles: PlannedParticle[] = [];
  environment.emitters.forEach((emitter, emitterIndex) => {
    const wanted = emitter.countByQuality[quality];
    for (let i = 0; i < wanted && particles.length < budget; i++) {
      const duration = between(rng, emitter.durationRange) * 1000;
      particles.push({
        key: `${environment.id}-${emitterIndex}-${i}`,
        shape: emitter.shape,
        color:
          emitter.colors[
            Math.floor(randomFloat(rng) * emitter.colors.length)
          ] ?? '#FFFFFF',
        size: between(rng, emitter.sizeRange),
        startX: randomFloat(rng),
        startY: randomFloat(rng),
        driftX: (randomFloat(rng) * 2 - 1) * emitter.drift,
        direction: emitter.direction,
        durationMs: duration,
        // Spread start times so particles do not all appear at once.
        delayMs: randomFloat(rng) * duration,
        opacity: emitter.opacity,
      });
    }
  });
  return particles;
}
