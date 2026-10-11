// Ranger legendary powers and sets (data only; power templates from shared/src/powers.ts).
// Append new entries at the end (registry order is observable through loot rolls). Recipe: docs/rework/depth/FOUNDATION.md §5.

import type { LegendaryDef, SetDef } from '../items';
import { conditional, flags, rolledCooldown, rolledDamage, skillMods } from '../../powers';
import { RANGER_SET_BASES, alternativeSet } from './common';

export const RANGER_LEGENDARIES: LegendaryDef[] = [
  { id: 'rainspindle', name: 'Rainspindle', base: 'bow', classes: ['ranger'], power: 'Rain of Vengeance cooldown is reduced by {v}% and its radius grows by 40%.', range: [30, 40], cubeSlot: 'weapon', flavor: 'The string remembers every arrow still in the sky.', colors: { primary: 0x384c59, secondary: 0xaacacb, glow: 0xb8e7f0 },
    effects: [rolledCooldown('rain_of_vengeance', { radius: 40 })] },
  { id: 'sappers_pack', name: "Sapper's Pack", base: 'quiver', classes: ['ranger'], power: 'You may have 2 additional Sentries, and Sentries deal {v}% increased damage.', range: [30, 40], cubeSlot: 'armor', flavor: 'Mostly gunpowder. Some arrows.', colors: { primary: 0x7a5230, secondary: 0xc9a227, glow: 0xffb347 },
    effects: [rolledDamage('sentry', { maxSummons: 2 })] },
  { id: 'gearwright_heart', name: "Gearwright's Heart", base: 'chest_leather', classes: ['ranger'], power: 'Sentry cooldown is reduced by {v}%, and Sentries fire 50% faster.', range: [30, 40], cubeSlot: 'armor', flavor: 'Tick. Tick. Tick. Then everything is quiet.', colors: { primary: 0x6b4a2b, secondary: 0xb87333, glow: 0xffc06b },
    effects: [rolledCooldown('sentry', { flags: ['fastSentry'] })] },
  { id: 'thunderhead', name: 'Thunderhead', base: 'bow', classes: ['ranger'], power: 'Multishot deals Lightning damage and {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Its string hums before the storm breaks.', colors: { primary: 0x2c3e50, secondary: 0x7fd3ff, glow: 0x9fe3ff },
    effects: [rolledDamage('multishot', { element: 'lightning' })] },
  { id: 'hunters_mark', name: "Hunter's Mark", base: 'handxbow', classes: ['ranger'], power: 'Hungering Arrow always pierces, and pierced enemies take {v}% increased damage for 3 seconds.', range: [15, 20], cubeSlot: 'weapon', flavor: 'Once marked, nothing hides.', colors: { primary: 0x3d2b1f, secondary: 0x8fd16a, glow: 0xb6ff8f },
    effects: [skillMods(['hungering_arrow'], { flags: ['huntersMark'] }, { field: 'var:markPct' })] },
];

export const RANGER_SETS: SetDef[] = [
  {
    id: 'siegebreaker', name: "Siegebreaker's Arsenal", classId: 'ranger',
    pieces: [
      { base: 'head_hood', name: "Siegebreaker's Cowl" }, { base: 'shoulders_pads', name: "Siegebreaker's Spaulders" },
      { base: 'chest_leather', name: "Siegebreaker's Brigandine" }, { base: 'hands_gloves', name: "Siegebreaker's Grips" },
      { base: 'legs_leather', name: "Siegebreaker's Breeches" }, { base: 'feet_boots', name: "Siegebreaker's Treads" },
    ],
    bonuses: [
      { count: 2, text: '+1 maximum Sentry, and Sentry cooldown is reduced by 30%.', effects: [skillMods(['sentry'], { maxSummons: 1, cooldown: -30 })] },
      { count: 4, text: 'Your Sentries also cast your Multishot and Cluster Arrow.', effects: [flags(['sentry'], 'sentryCasts')] },
      { count: 6, text: 'Sentries, Multishot and Cluster Arrow deal 250% increased damage for each active Sentry (max 4).',
        effects: [conditional({ perSummon: 'sentry', max: 4 }, 'own', 250, ['sentry', 'multishot', 'cluster_arrow'])] },
    ],
    colors: { primary: 0x3d4a2f, secondary: 0xc9a227, glow: 0x3cff6e },
  },
  alternativeSet('farwatch', 'Farwatch', 'ranger', RANGER_SET_BASES, 0x3a6170, ['hungering_arrow', 'multishot'],
    { pierce: 50 }, 'Hungering Arrow gains 50% pierce chance.', { cost: -40 }, 'Multishot costs 40% less Hatred.', 30),
  alternativeSet('rainkeeper', 'Rainkeeper', 'ranger', RANGER_SET_BASES, 0x64546c, ['rain_of_vengeance', 'cluster_arrow'],
    { radius: 40 }, 'Rain of Vengeance and Cluster Arrow have 40% increased radius.', { cooldown: -30 }, 'Rain of Vengeance cooldown is reduced by 30%.', 30),
];
