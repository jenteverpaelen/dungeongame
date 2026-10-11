// Registration of the series art with the gear rig (weaponDrawing.ts, DESIGN-V2 §11). Called once at client start by
// game/weaponArtPreview.ts when the Weapon art setting is the maker series (the default), and by the galleries.
// Families without a series drawing fall back to the default drawing.
import { DEFAULT_WEAPON_DRAWINGS } from '../weaponArt';
import { registerWeaponDrawing, type WeaponDrawing } from '../weaponDrawing';
import type { WeaponFamily } from '../gearVisuals';
import { seriesDrawing } from './drawing';

/** The families the checkpoint sample draws. */
export const SERIES_FAMILIES: WeaponFamily[] = ['blade', 'greatblade', 'axe', 'greataxe', 'mace', 'bow', 'crossbow', 'handxbow', 'staff', 'wand', 'shield', 'quiver', 'orb'];

export function registerSeriesDrawings(families: WeaponFamily[] = SERIES_FAMILIES): void {
  for (const f of families) {
    const fallback = DEFAULT_WEAPON_DRAWINGS[f];
    registerWeaponDrawing(f, (input) => (seriesDrawing(input) as WeaponDrawing | null) ?? fallback(input));
  }
}

/** Put the default drawings back (gallery A/B). */
export function unregisterSeriesDrawings(families: WeaponFamily[] = SERIES_FAMILIES): void {
  for (const f of families) registerWeaponDrawing(f, DEFAULT_WEAPON_DRAWINGS[f]);
}
