// Attack presentation from the equipped weapon (docs/rework/gear/DESIGN-V2.md §10, pass 2.1). Prestige in small sprites
// is carried by the attack (REFERENCES-V2 V7: Terraria's swing aura, GW2's replaced trails and projectiles), so a hero's
// swing trail, strike flash, cleave arc, projectiles and hit flashes read the weapon DRAWING's presentation data
// (weaponDrawing.ts: light colours, light anchors, strength, optional particle hint) — never a motif table, so new
// drawings change the attacks with them. Presentation only: hitboxes, reach and the simulation never read this.

import type { ItemLook } from '@shared/types';
import { SHAPE_FAMILY, type WeaponFamily } from './gearVisuals';
import { weaponDrawing, type WeaponPresentation } from './weaponDrawing';

export interface WeaponSkin extends WeaponPresentation {
  family: WeaponFamily;
}

/** The skin of a held weapon look (null for off-hands, townsfolk tools and looks without identity). */
export function weaponSkinOf(look: ItemLook | undefined): WeaponSkin | null {
  const fam = look ? SHAPE_FAMILY[look.shape] : undefined;
  if (!fam || fam.rig === 'off') return null;
  const d = weaponDrawing(look, true);
  return d ? { ...d.present, family: fam.family } : null;
}
