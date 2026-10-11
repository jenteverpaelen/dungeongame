// Ranger passives (data only). Stat passives use the level-scaled head-affix mean (L116/D054); build-defining
// passives use power templates (`effects`, shared/src/powers.ts). Append new passives at the end.
import type { PassiveDef } from '../../passives';

export const RANGER_PASSIVES: PassiveDef[] = [
  { id: 'ranger_multishot', classId: 'ranger', name: 'Wide Horizon', unlock: 10, stat: 'skillDmg', skill: 'multishot', note: 'Specialise in covering a broad firing line.' },
  { id: 'ranger_sentry', classId: 'ranger', name: 'Watchmaker', unlock: 10, stat: 'skillDmg', skill: 'sentry', note: 'Specialise in damage from placed sentries.' },
  { id: 'ranger_reserve', classId: 'ranger', name: 'Quiet Reserve', unlock: 20, stat: 'resourceRegen', note: 'Recover more resource between costly skills.' },
  { id: 'ranger_timing', classId: 'ranger', name: 'Patient Timing', unlock: 30, stat: 'cdr', note: 'Bring cooldown skills back sooner. Existing cooldowns are not reset.' },
  { id: 'ranger_heart', classId: 'ranger', name: 'Trail Heart', unlock: 40, stat: 'lifePct', note: 'Carry more life into dangerous encounters. Changing this preserves your life percentage.' },
  { id: 'ranger_guard', classId: 'ranger', name: 'Weathered Guard', unlock: 50, stat: 'armor', note: 'Strengthen your defenses when damage matters more than speed.' },
];
