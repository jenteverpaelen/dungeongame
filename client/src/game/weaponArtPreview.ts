// Weapon art switch (docs/rework/gear/ART-DIRECTION.md §11): Settings → Display → Weapon art (Maker series by default,
// Previous art), or the page address `?weaponArt=series` / `?weaponArt=current` for one page load. Applied once at start, before anything is
// drawn or baked, so icons, the hero, ground loot and the item card all agree; changing the setting asks for a reload.
// Families without a series drawing (and legendaries the series do not draw) keep the current art. No save, protocol
// or server change: it is a local display choice.
import { preferences, WEAPON_ART_MODES, type WeaponArt } from './preferences';
import { registerSeriesDrawings } from '../render/art/series/register';

/** The page-address override, if any. */
export function weaponArtFromUrl(search = typeof location === 'undefined' ? '' : location.search): WeaponArt | null {
  const v = new URLSearchParams(search).get('weaponArt');
  return v && (WEAPON_ART_MODES as readonly string[]).includes(v) ? (v as WeaponArt) : null;
}

let applied: WeaponArt = 'current';
/** The mode this page load runs with. */
export function appliedWeaponArt(): WeaponArt { return applied; }

/** Call once at start, before the first view or icon is created. */
export function applyWeaponArtPreview(): WeaponArt {
  applied = weaponArtFromUrl() ?? preferences.get().values.weaponArt;
  if (applied === 'series') registerSeriesDrawings();
  return applied;
}
