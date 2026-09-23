import {placeholder, type AssetRef} from '../content/assets.ts';
import {AUDIO_CUES, type AudioCue, type AudioPack} from './types.ts';

function pack(id: string, instrumentation: string[]): AudioPack {
  const cues = {} as Record<AudioCue, AssetRef>;
  for (const cue of AUDIO_CUES)
    cues[cue] = placeholder('sfx', `audio.${id}.${cue.toLowerCase()}`);
  return {
    id,
    instrumentation,
    cues,
    music: placeholder('music', `audio.${id}.music`),
    ambience: placeholder('music', `audio.${id}.ambience`),
  };
}

/**
 * No licensed audio file is present in the project yet: every pack only holds
 * placeholders. Real files must be free, licensed or produced for the project.
 */
export const AUDIO_PACKS: readonly AudioPack[] = [
  pack('classic', ['ambiance Ludo classique']),
  pack('japan', ['shamisen', 'taiko', 'shakuhachi', 'ambiance temple']),
  pack('egypt', ['percussions', 'oud', 'ambiance désert']),
  pack('china', ['guzheng', 'erhu', 'gongs']),
  pack('india', ['sitar', 'tabla']),
  pack('italy', ['mandoline', 'accordéon']),
  pack('russia', ['balalaïka', 'choeurs']),
  pack('france', ['accordéon', 'cordes']),
  pack('algeria', ['derbouka', 'gasba', 'oud']),
];

export function getAudioPack(id: string): AudioPack {
  const found = AUDIO_PACKS.find(p => p.id === id) ?? AUDIO_PACKS[0];
  if (!found) throw new Error('no audio pack defined');
  return found;
}
