import type {DieValue} from '../types.ts';
import {randomInt, type RandomSource} from '../../utils/random.ts';

/**
 * Draws a fair die value. The source decides the trust level:
 * - online: the server passes a CSPRNG source (never the client);
 * - offline: the local device passes its own CSPRNG source.
 * Cosmetics (dice skins) never reach this function.
 */
export function rollDie(source: RandomSource): DieValue {
  return randomInt(source, 1, 6) as DieValue;
}
