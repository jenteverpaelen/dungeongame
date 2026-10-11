// Registration of the series art with the gear rig (weaponDrawing.ts, DESIGN-V2 §11). NOT called by the game: only
// the series gallery calls it (gallery-series.html?view=rig…). Switching the game over is one call at client start,
// `registerSeriesDrawings()`, after the integration notes of ART-DIRECTION.md §7 (icon halo / glow colour) are done.
// Families without a series drawing, and legendaries / Sets the series cannot draw, fall back to the default drawing.
import { DEFAULT_WEAPON_DRAWINGS } from '../weaponArt';
import { registerWeaponDrawing, type WeaponDrawing } from '../weaponDrawing';
import type { WeaponFamily } from '../gearVisuals';
import { seriesDrawing } from './drawing';

/** The families the checkpoint sample draws. */
export const SERIES_FAMILIES: WeaponFamily[] = ['blade', 'axe', 'bow', 'staff', 'wand'];

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
