import {describe, expect, it} from 'vitest';
import {CHARACTERS, CLASSIC_PAWN_ID} from '../../src/content/characters.ts';
import {CLASSIC_DICE_ID, DICE} from '../../src/content/dice.ts';
import {GIFTS} from '../../src/content/gifts.ts';
import {CATALOG} from '../../src/inventory/catalog.ts';
import {
  canEquip,
  collectionProgress,
  defaultInventory,
  DEFAULT_EQUIPMENT,
} from '../../src/inventory/inventory.ts';
import {THEMES, getTheme} from '../../src/themes/themes.ts';
import {ENVIRONMENTS} from '../../src/environment/environments.ts';
import {AUDIO_PACKS} from '../../src/audio/packs.ts';
import {PLAYER_COLORS} from '../../src/game/types.ts';

const HEX = /^#[0-9A-F]{6}$/i;

describe('content catalogue', () => {
  it('defines the 9 required themes with complete palettes and linked environment/audio', () => {
    expect(THEMES.map(t => t.id)).toEqual([
      'classic',
      'japan',
      'egypt',
      'china',
      'india',
      'italy',
      'russia',
      'france',
      'algeria',
    ]);
    for (const t of THEMES) {
      for (const color of PLAYER_COLORS)
        expect(t.palette.players[color].main).toMatch(HEX);
      expect(t.palette.background).toMatch(HEX);
      expect(ENVIRONMENTS.some(e => e.id === t.environmentId)).toBe(true);
      expect(AUDIO_PACKS.some(p => p.id === t.audioPackId)).toBe(true);
    }
    expect(getTheme('unknown').id).toBe('classic');
  });

  it('keeps the classic pawn and classic dice, and all ids unique', () => {
    expect(CHARACTERS.some(c => c.id === CLASSIC_PAWN_ID)).toBe(true);
    expect(DICE.some(d => d.id === CLASSIC_DICE_ID)).toBe(true);
    for (const list of [CHARACTERS, DICE, GIFTS, CATALOG]) {
      const ids = list.map(x => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('does not pretend any 3D model, animation or sound exists', () => {
    for (const c of CHARACTERS) {
      expect(c.model3D.status).toBe('PLACEHOLDER_ASSET');
      for (const a of Object.values(c.animations))
        expect(a.status).toBe('PLACEHOLDER_ASSET');
    }
    for (const d of DICE) expect(d.model3D.status).toBe('PLACEHOLDER_ASSET');
    for (const g of GIFTS) expect(g.model3D.status).toBe('PLACEHOLDER_ASSET');
    for (const p of AUDIO_PACKS)
      for (const cue of Object.values(p.cues))
        expect(cue.status).toBe('PLACEHOLDER_ASSET');
  });

  it('never invents prices', () => {
    expect(CATALOG.every(i => i.price === null)).toBe(true);
  });

  it('has the required gifts', () => {
    const ids = GIFTS.map(g => g.id);
    for (const id of [
      'rose',
      'bouquet',
      'heart',
      'coffee',
      'beer',
      'cocktail',
      'cake',
      'chocolate',
      'gift_box',
      'sakura',
      'toast',
      'star',
      'crown',
      'diamond',
    ]) {
      expect(ids).toContain(id);
    }
  });
});

describe('inventory, equipment and collection', () => {
  it('owns the default items and can only equip owned items in the matching slot', () => {
    const inv = defaultInventory();
    const pawn = CATALOG.find(i => i.id === 'classic_pawn');
    const samurai = CATALOG.find(i => i.id === 'samurai');
    if (!pawn || !samurai) throw new Error();
    expect(canEquip(inv, 'character', pawn)).toBe(true);
    expect(canEquip(inv, 'dice', pawn)).toBe(false);
    expect(canEquip(inv, 'character', samurai)).toBe(false);
    expect(
      canEquip(
        [
          ...inv,
          {itemId: 'samurai', unlocked: true, fragments: 6, source: 'chest'},
        ],
        'character',
        samurai
      )
    ).toBe(true);
    expect(DEFAULT_EQUIPMENT.character).toBe('classic_pawn');
  });

  it('computes collection progress per theme', () => {
    const inv = [
      ...defaultInventory(),
      {
        itemId: 'samurai',
        unlocked: true,
        fragments: 6,
        source: 'chest' as const,
      },
      {
        itemId: 'ninja',
        unlocked: false,
        fragments: 4,
        source: 'chest' as const,
      },
    ];
    const japan = collectionProgress(inv, 'japan');
    expect(japan.total).toBe(CATALOG.filter(i => i.themeId === 'japan').length);
    expect(japan.owned).toBe(1);
    expect(japan.byCategory.character).toEqual({owned: 1, total: 5});
    const classic = collectionProgress(inv, 'classic');
    expect(classic.owned).toBe(3);
  });
});
