// Warrior legendary powers and sets (data only; power templates from shared/src/powers.ts).
// Append new entries at the end (registry order is observable through loot rolls). Recipe: docs/rework/depth/FOUNDATION.md §5.

import type { LegendaryDef, SetDef } from '../items';
import { ROLL, conditional, flags, ownMult, rolledCost, rolledDamage, skillMods } from '../../powers';
import { WARRIOR_SET_BASES, alternativeSet } from './common';

export const WARRIOR_LEGENDARIES: LegendaryDef[] = [
  { id: 'faultcleaver', name: 'Faultcleaver', base: 'axe2h', classes: ['warrior'], power: 'Seismic Slam deals {v}% increased damage and costs 40% less Fury.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Its edge follows the seams beneath the earth.', colors: { primary: 0x5b5045, secondary: 0xdb9860, glow: 0xffb369 },
    effects: [rolledDamage('seismic_slam', { cost: -40 })] },
  { id: 'ninefold_gale', name: 'The Ninefold Gale', base: 'axe2h', classes: ['warrior'], power: 'Whirlwind always spawns Dust Devils, and Dust Devils deal {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: '"Nine storms bound in one edge. It hungers to spin."', colors: { primary: 0xb8c4cc, secondary: 0x6b8fa3, glow: 0x9fe3ff },
    effects: [skillMods(['whirlwind'], { flags: ['dustDevils', 'ninefold'] }, { field: 'var:dustDevilPct' })] },
  { id: 'bloodwake', name: 'Bloodwake', base: 'sword', classes: ['warrior'], power: "Rend's bleed deals {v}% increased damage.", range: [150, 200], cubeSlot: 'weapon', flavor: 'The blade weeps for every wound it opens.', colors: { primary: 0x9e1b1b, secondary: 0x3a0d0d, glow: 0xff3b3b },
    effects: [rolledDamage('rend')] },
  { id: 'eternal_gyre', name: 'Girdle of the Eternal Gyre', base: 'waist_belt', classes: ['warrior'], power: 'Whirlwind costs {v}% less Fury, and you take 20% less damage while whirlwinding.', range: [40, 50], cubeSlot: 'armor', flavor: 'Buckled once, never unbuckled.', colors: { primary: 0x6d4c2f, secondary: 0xd4af37, glow: 0xffb347 },
    effects: [rolledCost('whirlwind', { flags: ['gyre'] })] },
  { id: 'anvil_vambraces', name: 'Vambraces of the Anvil', base: 'wrists_bracers', classes: ['warrior'], power: 'Stunned enemies take {v}% increased damage from you.', range: [25, 30], cubeSlot: 'armor', flavor: 'Struck a thousand times, they ring like bells.', colors: { primary: 0x5a5a66, secondary: 0xc9a227, glow: 0xffd27f },
    effects: [conditional({ targetState: 'stunned' }, 'hit', ROLL)] },
  { id: 'last_light', name: 'Bulwark of the Last Light', base: 'shield', classes: ['warrior'], power: 'Ground Stomp pulls in distant enemies and deals {v}% increased damage.', range: [200, 250], cubeSlot: 'armor', flavor: 'It held the gate when the gate itself fell.', colors: { primary: 0xd9c27a, secondary: 0xf5f0e0, glow: 0xfff3b0 },
    effects: [rolledDamage('ground_stomp', { flags: ['pull'] })] },
];

// parityLoadout: the P11 build-audit profiles (scripts/audit-item-builds.ts), reused by the parity harness.
export const WARRIOR_SETS: SetDef[] = [
  {
    id: 'endless_storm', name: 'Raiment of the Endless Storm', classId: 'warrior',
    pieces: [
      { base: 'head_horned', name: 'Stormcrown' }, { base: 'shoulders_spiked', name: 'Storm-Torn Mantle' },
      { base: 'chest_plate', name: 'Heart of the Gale' }, { base: 'hands_gauntlets', name: 'Gyrefists' },
      { base: 'legs_plate', name: 'Legplates of the Spiral' }, { base: 'feet_greaves', name: 'Eyewall Sabatons' },
    ],
    bonuses: [
      { count: 2, text: 'Whirlwind gains the effect of the Dust Devils rune.', effects: [flags(['whirlwind'], 'dustDevils')] },
      { count: 4, text: "You take 50% less damage while whirlwinding, and Whirlwind applies Rend's bleed, which deals 200% increased damage.", effects: [flags(['whirlwind'], 'whirlRend', 'stormDR')] },
      { count: 6, text: "Whirlwind, Dust Devils and Whirlwind's bleeds deal 5,000% increased damage.", effects: [ownMult(['whirlwind', 'dust_devil'], 51)] },
    ],
    colors: { primary: 0x4a5a6a, secondary: 0x9fe3ff, glow: 0x3cff6e },
    parityLoadout: ['whirlwind', 'rend', 'ground_stomp', 'battle_rage'],
  },
  { ...alternativeSet('cinder_oath', 'Cinder Oath', 'warrior', WARRIOR_SET_BASES, 0x773e35, ['cleave', 'rend'],
    { radius: 40 }, 'Cleave and Rend reach 40% further.', { cost: -40 }, 'Rend costs 40% less Fury.', 127), parityLoadout: ['rend', 'ground_stomp', 'battle_rage'] },
  { ...alternativeSet('fault_warden', 'Fault Warden', 'warrior', WARRIOR_SET_BASES, 0x726549, ['seismic_slam', 'ground_stomp'],
    { radius: 40 }, 'Seismic Slam and Ground Stomp have 40% increased radius.', { cooldown: -30 }, 'Ground Stomp cooldown is reduced by 30%.', 22), parityLoadout: ['seismic_slam', 'ground_stomp', 'battle_rage'] },
];
