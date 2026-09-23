/**
 * Asset references. The project currently ships NO 3D model, animation clip,
 * texture, music or sound effect. Every such reference is therefore an explicit
 * placeholder, rendered by clearly identified fallbacks. Replacing a placeholder
 * with a real bundled asset only requires changing the reference here.
 */
export type AssetKind =
  'model3d' | 'animation' | 'texture' | 'image' | 'music' | 'sfx' | 'particles';

export type AssetRef =
  | {
      readonly status: 'PLACEHOLDER_ASSET';
      readonly kind: AssetKind;
      readonly id: string;
    }
  | {
      readonly status: 'AVAILABLE';
      readonly kind: AssetKind;
      readonly id: string;
      /** Result of `require('./file')` for bundled assets, or a remote URI. */
      readonly source: number | {readonly uri: string};
    };

export function placeholder(kind: AssetKind, id: string): AssetRef {
  return {status: 'PLACEHOLDER_ASSET', kind, id};
}

export function isPlaceholder(asset: AssetRef): boolean {
  return asset.status === 'PLACEHOLDER_ASSET';
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITIES: readonly Rarity[] = [
  'common',
  'rare',
  'epic',
  'legendary',
];
