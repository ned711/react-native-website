/**
 * Chooses which animation to play for an engine event and a character. The
 * capture logic itself never depends on the character.
 */
import {isPlaceholder, type AssetRef} from '../content/assets.ts';
import type {
  CharacterAnimationSlot,
  CharacterDefinition,
} from '../content/characters.ts';
import type {GameEvent} from '../game/events/types.ts';

export interface ResolvedAnimation {
  readonly slot: CharacterAnimationSlot;
  readonly asset: AssetRef;
  /** Beats for a cinematic capture; empty for simple slots. */
  readonly beats: readonly string[];
  /** True when the 3D clip is missing and a 2D fallback effect must be used. */
  readonly fallback: boolean;
}

export function slotForEvent(event: GameEvent): CharacterAnimationSlot | null {
  switch (event.type) {
    case 'PAWN_SPAWNED':
      return 'spawn';
    case 'PAWN_MOVED':
      return 'move';
    case 'PAWN_CAPTURED':
      return 'capture';
    case 'PAWN_RETURNED':
      return 'returnHome';
    case 'FINAL_LANE_ENTERED':
      return 'enterFinalLane';
    case 'PAWN_FINISHED':
      return 'finish';
    case 'PLAYER_FINISHED':
      return 'victory';
    default:
      return null;
  }
}

export function resolveCharacterAnimation(
  event: GameEvent,
  character: CharacterDefinition
): ResolvedAnimation | null {
  const slot = slotForEvent(event);
  if (!slot) return null;
  const asset = character.animations[slot];
  return {
    slot,
    asset,
    beats: slot === 'capture' ? character.captureSequence : [],
    fallback: isPlaceholder(asset),
  };
}
