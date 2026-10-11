// Warrior passives (data only). Stat passives use the level-scaled head-affix mean (L116/D054); build-defining
// passives use power templates (`effects`, shared/src/powers.ts). Append new passives at the end.
import type { PassiveDef } from '../../passives';

export const WARRIOR_PASSIVES: PassiveDef[] = [
  { id: 'warrior_whirlwind', classId: 'warrior', name: 'Turning Edge', unlock: 10, stat: 'skillDmg', skill: 'whirlwind', note: 'Specialise in sustained close-range sweeps.' },
  { id: 'warrior_seismic_slam', classId: 'warrior', name: 'Fault Reader', unlock: 10, stat: 'skillDmg', skill: 'seismic_slam', note: 'Specialise in striking along a broken front.' },
  { id: 'warrior_reserve', classId: 'warrior', name: 'Banked Fury', unlock: 20, stat: 'resourceRegen', note: 'Recover more resource between costly skills.' },
  { id: 'warrior_timing', classId: 'warrior', name: 'Measured Recovery', unlock: 30, stat: 'cdr', note: 'Bring cooldown skills back sooner. Existing cooldowns are not reset.' },
  { id: 'warrior_heart', classId: 'warrior', name: 'Rooted Heart', unlock: 40, stat: 'lifePct', note: 'Carry more life into dangerous encounters. Changing this preserves your life percentage.' },
  { id: 'warrior_guard', classId: 'warrior', name: 'Iron Poise', unlock: 50, stat: 'armor', note: 'Strengthen your defenses when damage matters more than speed.' },
];
