import {ECONOMY_CONFIG} from '../economy/config.ts';
import type {ThemeId} from '../themes/types.ts';
import {
  CATALOG,
  DEFAULT_ITEM_IDS,
  type CatalogItem,
  type ItemCategory,
} from './catalog.ts';

export interface InventoryEntry {
  readonly itemId: string;
  readonly unlocked: boolean;
  readonly fragments: number;
  readonly source:
    | 'default'
    | 'chest'
    | 'mission'
    | 'achievement'
    | 'level'
    | 'event'
    | 'purchase';
}

export type EquipmentSlot =
  'board' | 'character' | 'dice' | 'frame' | 'title' | 'victoryEffect';

export type Equipment = Readonly<Partial<Record<EquipmentSlot, string>>>;

export const SLOT_CATEGORY: Readonly<Record<EquipmentSlot, ItemCategory>> = {
  board: 'board',
  character: 'character',
  dice: 'dice',
  frame: 'frame',
  title: 'title',
  victoryEffect: 'effect',
};

export const DEFAULT_EQUIPMENT: Equipment = {
  board: 'board_classic',
  character: 'classic_pawn',
  dice: 'classic_dice',
};

export function defaultInventory(): InventoryEntry[] {
  return DEFAULT_ITEM_IDS.map(itemId => ({
    itemId,
    unlocked: true,
    fragments: ECONOMY_CONFIG.fragmentsPerItem,
    source: 'default' as const,
  }));
}

export function isOwned(
  inventory: readonly InventoryEntry[],
  itemId: string
): boolean {
  return inventory.some(e => e.itemId === itemId && e.unlocked);
}

/** Client-side guard mirroring the server's `equip_item` check. */
export function canEquip(
  inventory: readonly InventoryEntry[],
  slot: EquipmentSlot,
  item: CatalogItem
): boolean {
  return item.category === SLOT_CATEGORY[slot] && isOwned(inventory, item.id);
}

export interface CollectionProgress {
  readonly themeId: ThemeId;
  readonly owned: number;
  readonly total: number;
  readonly byCategory: Readonly<
    Partial<
      Record<ItemCategory, {readonly owned: number; readonly total: number}>
    >
  >;
}

export function collectionProgress(
  inventory: readonly InventoryEntry[],
  themeId: ThemeId,
  catalog: readonly CatalogItem[] = CATALOG
): CollectionProgress {
  const items = catalog.filter(i => i.themeId === themeId);
  const byCategory: Partial<
    Record<ItemCategory, {owned: number; total: number}>
  > = {};
  let owned = 0;
  for (const item of items) {
    const entry = byCategory[item.category] ?? {owned: 0, total: 0};
    entry.total++;
    if (isOwned(inventory, item.id)) {
      entry.owned++;
      owned++;
    }
    byCategory[item.category] = entry;
  }
  return {themeId, owned, total: items.length, byCategory};
}
