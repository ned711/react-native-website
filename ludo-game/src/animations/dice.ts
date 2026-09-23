/**
 * Visual dice roll sequence. The logical result is decided BEFORE the
 * animation (by the local engine or the server); the animation only shows
 * random intermediate faces and always lands on the real value.
 */
import type {DieValue} from '../game/types.ts';
import {randomInt, type RandomSource} from '../utils/random.ts';

export type DiceAnimationPhase =
  'lift' | 'spin' | 'slowdown' | 'settle' | 'result';

export interface DiceFrame {
  readonly phase: DiceAnimationPhase;
  readonly face: DieValue;
  /** Delay before showing this frame (ms). */
  readonly delayMs: number;
  /** Rotation in degrees for this frame. */
  readonly rotation: number;
  readonly lift: number;
}

export interface DiceSequenceOptions {
  readonly spinFrames: number;
  readonly reducedMotion: boolean;
}

export const DEFAULT_DICE_SEQUENCE: DiceSequenceOptions = {
  spinFrames: 8,
  reducedMotion: false,
};

export function buildDiceRollSequence(
  result: DieValue,
  visualRandom: RandomSource,
  options: DiceSequenceOptions = DEFAULT_DICE_SEQUENCE
): DiceFrame[] {
  if (options.reducedMotion) {
    return [{phase: 'result', face: result, delayMs: 0, rotation: 0, lift: 0}];
  }
  const frames: DiceFrame[] = [
    {
      phase: 'lift',
      face: randomFace(visualRandom),
      delayMs: 0,
      rotation: 0,
      lift: 1,
    },
  ];
  let previous = frames[0]?.face ?? result;
  for (let i = 0; i < options.spinFrames; i++) {
    // Starts fast then slows down (ease-out).
    const t = i / Math.max(1, options.spinFrames - 1);
    let face = randomFace(visualRandom);
    if (face === previous) face = ((face % 6) + 1) as DieValue;
    previous = face;
    frames.push({
      phase: t < 0.6 ? 'spin' : 'slowdown',
      face,
      delayMs: Math.round(45 + 110 * t * t),
      rotation: (i + 1) * 90,
      lift: 1 - t * 0.5,
    });
  }
  frames.push({
    phase: 'settle',
    face: result,
    delayMs: 170,
    rotation: (options.spinFrames + 1) * 90 + 10,
    lift: 0.1,
  });
  frames.push({
    phase: 'result',
    face: result,
    delayMs: 120,
    rotation: (options.spinFrames + 1) * 90,
    lift: 0,
  });
  return frames;
}

function randomFace(rng: RandomSource): DieValue {
  return randomInt(rng, 1, 6) as DieValue;
}

export function sequenceDurationMs(frames: readonly DiceFrame[]): number {
  return frames.reduce((sum, f) => sum + f.delayMs, 0);
}

/** Pip layout on a 3x3 grid for each face (row, col). */
export const PIP_LAYOUT: Readonly<
  Record<DieValue, readonly (readonly [number, number])[]>
> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 2],
  ],
};
