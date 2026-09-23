/**
 * Random sources.
 *
 * - `createSeededRandom` is deterministic (sfc32 seeded by cyrb128). It is used
 *   for reproducible content generation (Adventure boards), tests and replays.
 *   It is NOT suitable for authoritative online dice.
 * - `createCryptoRandom` wraps a CSPRNG `getRandomValues` implementation
 *   (Web Crypto on the server / Node / Deno, expo-crypto on device).
 */
export interface RandomSource {
  /** Returns a uniformly distributed unsigned 32-bit integer. */
  nextUint32(): number;
}

const UINT32_RANGE = 0x100000000;

function cyrb128(input: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export function createSeededRandom(seed: string): RandomSource {
  let [a, b, c, d] = cyrb128(seed);
  return {
    nextUint32() {
      a >>>= 0;
      b >>>= 0;
      c >>>= 0;
      d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return t >>> 0;
    },
  };
}

export type GetRandomValues = (array: Uint32Array) => Uint32Array;

export function createCryptoRandom(
  getRandomValues: GetRandomValues
): RandomSource {
  const buffer = new Uint32Array(1);
  return {
    nextUint32() {
      getRandomValues(buffer);
      return buffer[0] ?? 0;
    },
  };
}

/** Uniform integer in [0, n) without modulo bias (rejection sampling). */
export function randomBelow(source: RandomSource, n: number): number {
  if (!Number.isInteger(n) || n <= 0 || n > UINT32_RANGE) {
    throw new RangeError(`randomBelow: invalid bound ${n}`);
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % n);
  for (;;) {
    const value = source.nextUint32();
    if (value < limit) {
      return value % n;
    }
  }
}

/** Uniform integer in [min, max] inclusive. */
export function randomInt(
  source: RandomSource,
  min: number,
  max: number
): number {
  return min + randomBelow(source, max - min + 1);
}

/** Uniform float in [0, 1). */
export function randomFloat(source: RandomSource): number {
  return source.nextUint32() / UINT32_RANGE;
}

export function pickWeighted<T>(
  source: RandomSource,
  entries: readonly {readonly item: T; readonly weight: number}[]
): T {
  const total = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
  if (!(total > 0)) {
    throw new RangeError('pickWeighted: total weight must be > 0');
  }
  // Integer weights keep the draw exact; fractional weights are scaled.
  const scale = entries.every(e => Number.isInteger(e.weight)) ? 1 : 1_000_000;
  const scaledTotal = Math.round(total * scale);
  let roll = randomBelow(source, scaledTotal);
  for (const entry of entries) {
    const w = Math.round(Math.max(0, entry.weight) * scale);
    if (roll < w) {
      return entry.item;
    }
    roll -= w;
  }
  const last = entries[entries.length - 1];
  if (!last) {
    throw new RangeError('pickWeighted: no entries');
  }
  return last.item;
}
