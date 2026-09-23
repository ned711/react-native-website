import * as ExpoCrypto from 'expo-crypto';
import {createCryptoRandom, type RandomSource} from '../utils/random.ts';

/** CSPRNG of the device (offline games only; online dice come from the server). */
export const deviceRandom: RandomSource = createCryptoRandom(array =>
  ExpoCrypto.getRandomValues(array)
);
