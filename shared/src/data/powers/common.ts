// Shared helpers for the per-class legendary / set data files (warrior.ts, ranger.ts, mage.ts, shared.ts).

import type { ClassId } from '../../types';
import { ownMult, skillMods } from '../../powers';
import type { SkillMods } from '../skills';
import type { SetDef } from '../items';

export const WARRIOR_SET_BASES = ['head_horned', 'shoulders_spiked', 'chest_plate', 'hands_gauntlets', 'legs_plate', 'feet_greaves'];
export const RANGER_SET_BASES = ['head_hood', 'shoulders_pads', 'chest_leather', 'hands_gloves', 'legs_leather', 'feet_boots'];
export const MAGE_SET_BASES = ['head_wizard', 'shoulders_mantle', 'chest_robe', 'hands_wraps', 'legs_cloth', 'feet_shoes'];

/**
 * P11's alternative-identity set shape: 2pc and 4pc modify the named skills, 6pc is an own-bucket multiplier.
 * Inherited base geometry is original Hearthfall art; piece names are generated from the set name.
 */
export function alternativeSet(id: string, name: string, classId: ClassId, bases: string[], color: number, skills: string[],
  first: SkillMods, firstText: string, second: SkillMods, secondText: string, multiplier: number): SetDef {
  const parts = ['Crown', 'Mantle', 'Vest', 'Grips', 'Legwraps', 'Treads'];
  return {
    id, name, classId, pieces: bases.map((base, i) => ({ base, name: `${name} ${parts[i]}` })),
    colors: { primary: color, secondary: 0xc6b88c, glow: 0x3cff6e },
    bonuses: [
      { count: 2, text: firstText, effects: [skillMods(skills, first)] },
      { count: 4, text: secondText, effects: [skillMods(skills, second)] },
      { count: 6, text: `${skills.map((s) => s.replaceAll('_', ' ')).join(' and ')} deal ${(multiplier - 1) * 100}% increased damage.`, effects: [ownMult(skills, multiplier)] },
    ],
  };
}
