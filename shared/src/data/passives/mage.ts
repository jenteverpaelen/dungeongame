// Mage passives (data only). Stat passives use the level-scaled head-affix mean (L116/D054); build-defining
// passives use power templates (`effects`, shared/src/powers.ts). Append new passives at the end.
import type { PassiveDef } from '../../passives';

export const MAGE_PASSIVES: PassiveDef[] = [
  { id: 'mage_meteor', classId: 'mage', name: 'Falling Measure', unlock: 10, stat: 'skillDmg', skill: 'meteor', note: 'Specialise in the impact of falling spells.' },
  { id: 'mage_hydra', classId: 'mage', name: 'Coiled Flame', unlock: 10, stat: 'skillDmg', skill: 'hydra', note: 'Specialise in damage from summoned hydras.' },
  { id: 'mage_reserve', classId: 'mage', name: 'Deep Current', unlock: 20, stat: 'resourceRegen', note: 'Recover more resource between costly skills.' },
  { id: 'mage_timing', classId: 'mage', name: 'Return Pattern', unlock: 30, stat: 'cdr', note: 'Bring cooldown skills back sooner. Existing cooldowns are not reset.' },
  { id: 'mage_heart', classId: 'mage', name: 'Steady Vessel', unlock: 40, stat: 'lifePct', note: 'Carry more life into dangerous encounters. Changing this preserves your life percentage.' },
  { id: 'mage_guard', classId: 'mage', name: 'Prism Mantle', unlock: 50, stat: 'allRes', note: 'Strengthen your defenses when damage matters more than speed.' },
];
