/**
 * Audio engine: listens to game events and resolves them into cues. Playback
 * and haptics are delegated to injected backends, so the engine is testable
 * and components never call `playSound()` themselves.
 */
import type {GameEvent} from '../game/events/types.ts';
import type {PlayerColor} from '../game/types.ts';
import type {AssetRef} from '../content/assets.ts';
import {
  CUE_CHANNEL,
  CUE_HAPTIC,
  DEFAULT_AUDIO_SETTINGS,
  type AudioChannel,
  type AudioCue,
  type AudioPack,
  type AudioSettings,
  type HapticPattern,
} from './types.ts';

export interface PlaybackRequest {
  readonly cue: AudioCue;
  readonly asset: AssetRef;
  readonly channel: AudioChannel;
  readonly volume: number;
}

export interface AudioBackend {
  /** Returns false when the asset cannot be played (e.g. placeholder). */
  play(request: PlaybackRequest): boolean;
}

export interface HapticsBackend {
  trigger(pattern: HapticPattern): void;
}

/** Maps engine events to cues, from the point of view of the local player. */
export function cuesForEvent(
  event: GameEvent,
  localColor: PlayerColor | null
): AudioCue[] {
  switch (event.type) {
    case 'DICE_ROLLED':
      return ['DICE_LAND'];
    case 'PAWN_SPAWNED':
      return ['PAWN_SPAWN'];
    case 'PAWN_MOVED':
      return ['PAWN_MOVE'];
    case 'PAWN_CAPTURED':
      return ['PAWN_CAPTURE'];
    case 'PAWN_RETURNED':
      return ['PAWN_RETURN_HOME'];
    case 'FINAL_LANE_ENTERED':
      return ['FINAL_LANE'];
    case 'PAWN_FINISHED':
      return ['PAWN_FINISH'];
    case 'GAME_FINISHED': {
      if (!localColor) return [];
      const me = event.payload.rankings.find(r => r.color === localColor);
      return me?.rank === 1 ? ['VICTORY'] : ['DEFEAT'];
    }
    default:
      return [];
  }
}

export interface AudioEngineStats {
  readonly requested: number;
  readonly played: number;
  readonly unavailable: number;
}

export class AudioEngine {
  private settings: AudioSettings = DEFAULT_AUDIO_SETTINGS;
  private requested = 0;
  private played = 0;
  private unavailable = 0;

  constructor(
    private pack: AudioPack,
    private readonly audio: AudioBackend,
    private readonly haptics: HapticsBackend | null
  ) {}

  setPack(pack: AudioPack): void {
    this.pack = pack;
  }

  setSettings(settings: AudioSettings): void {
    this.settings = settings;
  }

  volumeFor(channel: AudioChannel): number {
    if (this.settings.muted) return 0;
    switch (channel) {
      case 'music':
        return this.settings.musicVolume;
      case 'effects':
        return this.settings.effectsVolume;
      case 'ui':
        return this.settings.uiVolume;
      case 'voice':
        return this.settings.voiceVolume;
    }
  }

  playCue(cue: AudioCue): void {
    const channel = CUE_CHANNEL[cue];
    const volume = this.volumeFor(channel);
    if (volume > 0) {
      this.requested++;
      const ok = this.audio.play({
        cue,
        asset: this.pack.cues[cue],
        channel,
        volume,
      });
      if (ok) this.played++;
      else this.unavailable++;
    }
    const haptic = CUE_HAPTIC[cue];
    if (haptic && this.haptics && this.settings.vibrationEnabled) {
      this.haptics.trigger(haptic);
    }
  }

  handleEvents(
    events: readonly GameEvent[],
    localColor: PlayerColor | null
  ): void {
    for (const event of events) {
      for (const cue of cuesForEvent(event, localColor)) this.playCue(cue);
    }
  }

  stats(): AudioEngineStats {
    return {
      requested: this.requested,
      played: this.played,
      unavailable: this.unavailable,
    };
  }
}

/**
 * Backend used while the project has no audio file and no playback library:
 * it plays nothing and reports every request as unavailable, so the engine
 * statistics never claim that a sound was played.
 */
export const noAudioOutputBackend: AudioBackend = {
  play() {
    return false;
  },
};
