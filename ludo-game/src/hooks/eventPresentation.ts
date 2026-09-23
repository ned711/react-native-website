import {
  RETURN_MS,
  STEP_MS,
  type PawnAnimation,
} from '../components/board/Pawn.tsx';
import {pawnKey} from '../components/board/LudoBoard.tsx';
import {pointForPawn} from '../game/board/layout.ts';
import type {GameEvent} from '../game/events/types.ts';
import type {DieValue} from '../game/types.ts';

export interface EventPresentation {
  readonly animations: Map<string, PawnAnimation>;
  /** Time the board needs to play these animations (ms). */
  readonly busyMs: number;
  /** Last dice value rolled in the batch, if any. */
  readonly rolled: DieValue | null;
}

/** Turns engine events into pawn animations. Shared by local and online games. */
export function presentEvents(
  events: readonly GameEvent[],
  nextAnimationId: () => number
): EventPresentation {
  let busy = 0;
  let rolled: DieValue | null = null;
  const anims = new Map<string, PawnAnimation>();
  for (const event of events) {
    switch (event.type) {
      case 'DICE_ROLLED':
        rolled = event.payload.value;
        break;
      case 'PAWN_SPAWNED':
      case 'PAWN_MOVED': {
        if (!event.playerColor) break;
        const color = event.playerColor;
        const index = event.payload.pawnIndex;
        const path = event.type === 'PAWN_MOVED' ? event.payload.path : [0];
        anims.set(pawnKey(color, index), {
          id: nextAnimationId(),
          kind: 'step',
          points: path.map(pos => pointForPawn(color, pos, index)),
        });
        busy = Math.max(busy, path.length * STEP_MS);
        break;
      }
      case 'ADVENTURE_EVENT_TRIGGERED': {
        if (!event.playerColor || event.payload.from === event.payload.to)
          break;
        const color = event.playerColor;
        const index = event.payload.pawnIndex;
        const key = pawnKey(color, index);
        anims.set(key, {
          id: nextAnimationId(),
          kind: 'step',
          points: [
            ...(anims.get(key)?.points ?? []),
            pointForPawn(color, event.payload.to, index),
          ],
        });
        busy += STEP_MS * 2;
        break;
      }
      case 'PAWN_RETURNED':
        if (!event.playerColor) break;
        anims.set(pawnKey(event.playerColor, event.payload.pawnIndex), {
          id: nextAnimationId(),
          kind: 'return',
          points: [],
        });
        busy = Math.max(busy, RETURN_MS + STEP_MS * 6);
        break;
      default:
        break;
    }
  }
  return {animations: anims, busyMs: busy, rolled};
}
