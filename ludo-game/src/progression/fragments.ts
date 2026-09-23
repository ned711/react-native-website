import {ECONOMY_CONFIG} from '../economy/config.ts';

export interface FragmentProgress {
  readonly itemId: string;
  readonly fragments: number;
  readonly unlocked: boolean;
}

export interface FragmentGrantResult {
  readonly progress: FragmentProgress;
  readonly newlyUnlocked: boolean;
  /** Fragments received after the item was already unlocked. */
  readonly overflow: number;
}

/**
 * Fragments are bound to one item. `perItem` fragments unlock it for good;
 * extra fragments are reported as overflow (conversion rules, if any, are
 * decided server-side - none is defined yet).
 */
export function grantFragments(
  current: FragmentProgress,
  count: number,
  perItem: number = ECONOMY_CONFIG.fragmentsPerItem
): FragmentGrantResult {
  if (!Number.isInteger(count) || count <= 0)
    throw new RangeError('fragment count must be a positive integer');
  if (current.unlocked) {
    return {progress: current, newlyUnlocked: false, overflow: count};
  }
  const total = current.fragments + count;
  if (total >= perItem) {
    return {
      progress: {itemId: current.itemId, fragments: perItem, unlocked: true},
      newlyUnlocked: true,
      overflow: total - perItem,
    };
  }
  return {
    progress: {...current, fragments: total},
    newlyUnlocked: false,
    overflow: 0,
  };
}

export function fragmentLabel(
  progress: FragmentProgress,
  perItem: number = ECONOMY_CONFIG.fragmentsPerItem
): string {
  return `${progress.unlocked ? perItem : progress.fragments}/${perItem}`;
}
