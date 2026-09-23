import type {AssetRef} from '../content/assets.ts';

export type AudioChannel = 'music' | 'effects' | 'ui' | 'voice';

export type AudioCue =
  | 'DICE_PRESS'
  | 'DICE_ROLL'
  | 'DICE_LAND'
  | 'PAWN_SPAWN'
  | 'PAWN_MOVE'
  | 'PAWN_CAPTURE'
  | 'PAWN_RETURN_HOME'
  | 'FINAL_LANE'
  | 'PAWN_FINISH'
  | 'VICTORY'
  | 'DEFEAT'
  | 'CHEST_OPEN'
  | 'REWARD'
  | 'UNLOCK'
  | 'GIFT_SENT'
  | 'GIFT_RECEIVED'
  | 'BUTTON'
  | 'INVITATION'
  | 'MESSAGE';

export const AUDIO_CUES: readonly AudioCue[] = [
  'DICE_PRESS',
  'DICE_ROLL',
  'DICE_LAND',
  'PAWN_SPAWN',
  'PAWN_MOVE',
  'PAWN_CAPTURE',
  'PAWN_RETURN_HOME',
  'FINAL_LANE',
  'PAWN_FINISH',
  'VICTORY',
  'DEFEAT',
  'CHEST_OPEN',
  'REWARD',
  'UNLOCK',
  'GIFT_SENT',
  'GIFT_RECEIVED',
  'BUTTON',
  'INVITATION',
  'MESSAGE',
];

export const CUE_CHANNEL: Readonly<Record<AudioCue, AudioChannel>> = {
  DICE_PRESS: 'effects',
  DICE_ROLL: 'effects',
  DICE_LAND: 'effects',
  PAWN_SPAWN: 'effects',
  PAWN_MOVE: 'effects',
  PAWN_CAPTURE: 'effects',
  PAWN_RETURN_HOME: 'effects',
  FINAL_LANE: 'effects',
  PAWN_FINISH: 'effects',
  VICTORY: 'music',
  DEFEAT: 'music',
  CHEST_OPEN: 'effects',
  REWARD: 'effects',
  UNLOCK: 'effects',
  GIFT_SENT: 'effects',
  GIFT_RECEIVED: 'effects',
  BUTTON: 'ui',
  INVITATION: 'ui',
  MESSAGE: 'ui',
};

export type HapticPattern =
  'light' | 'medium' | 'heavy' | 'success' | 'warning';

export const CUE_HAPTIC: Readonly<Partial<Record<AudioCue, HapticPattern>>> = {
  DICE_LAND: 'light',
  PAWN_CAPTURE: 'heavy',
  PAWN_RETURN_HOME: 'medium',
  PAWN_FINISH: 'success',
  VICTORY: 'success',
  DEFEAT: 'warning',
  REWARD: 'success',
  GIFT_RECEIVED: 'light',
};

export interface AudioPack {
  readonly id: string;
  readonly music: AssetRef;
  readonly ambience: AssetRef;
  readonly cues: Readonly<Record<AudioCue, AssetRef>>;
  /** Intended instrumentation, for the audio team (e.g. shamisen, taiko). */
  readonly instrumentation: readonly string[];
}

export interface AudioSettings {
  readonly musicVolume: number;
  readonly effectsVolume: number;
  readonly voiceVolume: number;
  readonly uiVolume: number;
  readonly vibrationEnabled: boolean;
  readonly muted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  musicVolume: 0.6,
  effectsVolume: 0.8,
  voiceVolume: 0.8,
  uiVolume: 0.6,
  vibrationEnabled: true,
  muted: false,
};
