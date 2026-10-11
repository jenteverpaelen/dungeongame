// Any-class legendary powers (data only; power templates from shared/src/powers.ts). Append new entries at the end.

import type { LegendaryDef } from '../items';
import { ROLL, proc, stat } from '../../powers';

export const SHARED_LEGENDARIES: LegendaryDef[] = [
  { id: 'ouroboros_loop', name: 'Ouroboros Loop', base: 'ring', power: 'Gain a {v}% damage bonus to a single element that rotates every 4 seconds.', range: [150, 200], cubeSlot: 'jewelry', flavor: 'Fire becomes frost becomes storm becomes fire.', colors: { primary: 0xd4af37, secondary: 0x9fe3ff, glow: 0xffe08a },
    effects: [{ kind: 'elementCycle', elements: ['fire', 'cold', 'lightning', 'arcane', 'physical'], periodMs: 4000, pct: ROLL, buffPrefix: 'ouroboros' }] },
  { id: 'patient_thief', name: 'Seal of the Patient Thief', base: 'ring', power: 'Each resource-spending skill reduces your active cooldowns by {v} seconds.', range: [0.75, 1], cubeSlot: 'jewelry', flavor: 'Time is the only thing worth stealing.', colors: { primary: 0x1a1a1a, secondary: 0xc9a227, glow: 0xffd27f },
    effects: [proc('spend', { reduceCooldownsMs: { roll: 1000 } })] },
  { id: 'hellforge_talisman', name: 'Hellforge Talisman', base: 'neck_amulet', power: 'Killing an elite grants {v}% increased damage for 30 seconds.', range: [30, 40], cubeSlot: 'jewelry', flavor: 'Quenched in the blood of something that should not have died.', colors: { primary: 0x8b1e1e, secondary: 0xff7a1a, glow: 0xff5a36 },
    effects: [proc('eliteKill', { buff: { id: 'hellforge', ms: 30000, dmg: ROLL } })] },
  { id: 'witching_cord', name: 'Witching Cord', base: 'waist_sash', power: 'Increases Critical Hit Damage by {v}% and attack speed by 7%.', range: [45, 50], cubeSlot: 'armor', flavor: 'Tied at midnight, untied at dawn.', colors: { primary: 0x2e1a3d, secondary: 0xb388ff, glow: 0xd6c2ff },
    effects: [stat('chd', ROLL), stat('ias', 7)] },
  { id: 'stridewind', name: 'Stridewind Greaves', base: 'feet_boots', power: 'Dash cooldown is reduced by 50%, and dashing grants {v}% increased damage for 3 seconds.', range: [40, 50], cubeSlot: 'armor', flavor: 'They have never once stood still.', colors: { primary: 0x2f4f4f, secondary: 0x9fe3ff, glow: 0xbdf6ff },
    effects: [{ kind: 'dashCooldown', mult: 0.5 }, proc('dash', { buff: { id: 'stridewind', ms: 3000, dmg: ROLL } })] },
  { id: 'mountain_fists', name: 'Fists of the Mountain', base: 'hands_gauntlets', power: 'Area damage is increased by {v}% and attack speed by 15%.', range: [40, 50], cubeSlot: 'armor', flavor: 'Every blow is an avalanche.', colors: { primary: 0x6e5a48, secondary: 0xc9a227, glow: 0xffc06b },
    effects: [stat('area', ROLL), stat('ias', 15)] },
];
