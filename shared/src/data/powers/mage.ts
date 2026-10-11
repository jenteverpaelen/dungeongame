// Mage legendary powers and sets (data only; power templates from shared/src/powers.ts).
// Append new entries at the end (registry order is observable through loot rolls). Recipe: docs/rework/depth/FOUNDATION.md §5.

import type { LegendaryDef, SetDef } from '../items';
import { flags, ownMult, rolledCost, rolledDamage, skillMods } from '../../powers';
import { MAGE_SET_BASES, alternativeSet } from './common';

export const MAGE_LEGENDARIES: LegendaryDef[] = [
  { id: 'lanternroot', name: 'Lanternroot', base: 'staff', classes: ['mage'], power: 'Hydras deal {v}% increased damage. You may summon one additional Hydra.', range: [150, 200], cubeSlot: 'weapon', flavor: 'A branch that taught its flames to keep watch.', colors: { primary: 0x404a31, secondary: 0xe6b45f, glow: 0xf6cd7d },
    effects: [rolledDamage('hydra', { maxSummons: 1 })] },
  { id: 'cindervane', name: 'Cindervane', base: 'staff', classes: ['mage'], power: 'Meteor deals {v}% increased damage and its molten ground lasts twice as long.', range: [150, 200], cubeSlot: 'weapon', flavor: 'A splinter of a falling star, still burning.', colors: { primary: 0x4a2a1a, secondary: 0xff7a1a, glow: 0xff9a3c },
    effects: [rolledDamage('meteor', { flags: ['moltenDouble'] })] },
  { id: 'void_heart', name: 'Heart of the Void', base: 'orb', classes: ['mage'], power: 'Black Hole radius is increased by 30%, and enemies inside take {v}% increased damage.', range: [20, 25], cubeSlot: 'armor', flavor: 'Hold it close and hear nothing at all.', colors: { primary: 0x1b0f2e, secondary: 0x8e44ad, glow: 0xc39bff },
    effects: [skillMods(['black_hole'], { radius: 30, flags: ['voidHeart'] }, { field: 'var:voidPct' })] },
  { id: 'starfall_mantle', name: 'Starfall Mantle', base: 'shoulders_mantle', classes: ['mage'], power: 'Meteor costs {v}% less Arcane Power and falls 50% faster.', range: [30, 40], cubeSlot: 'armor', flavor: 'Embroidered with constellations that no longer exist.', colors: { primary: 0x1f2a5a, secondary: 0xf5d76e, glow: 0xffe08a },
    effects: [rolledCost('meteor', { flags: ['fastMeteor'] })] },
  { id: 'thousand_missiles', name: 'Spindle of a Thousand Missiles', base: 'wand', classes: ['mage'], power: 'Magic Missile fires 2 additional missiles and deals {v}% increased damage.', range: [100, 150], cubeSlot: 'weapon', flavor: 'Point. Wish. Repeat.', colors: { primary: 0xe8e0ff, secondary: 0xb388ff, glow: 0xd6c2ff },
    effects: [rolledDamage('magic_missile', { projectiles: 2 })] },
];

export const MAGE_SETS: SetDef[] = [
  {
    id: 'fallen_star', name: 'Regalia of the Fallen Star', classId: 'mage',
    pieces: [
      { base: 'head_wizard', name: 'Crown of the Fallen Star' }, { base: 'shoulders_mantle', name: 'Mantle of Burning Skies' },
      { base: 'chest_robe', name: 'Robes of the Comet' }, { base: 'hands_wraps', name: 'Starcaller Wraps' },
      { base: 'legs_cloth', name: 'Leggings of the Long Night' }, { base: 'feet_shoes', name: 'Ashwalker Slippers' },
    ],
    bonuses: [
      { count: 2, text: 'Meteor calls down a second meteor on a nearby enemy.', effects: [flags(['meteor'], 'secondMeteor')] },
      { count: 4, text: 'Dealing Arcane, Cold, Fire or Lightning damage increases your damage by 50% for 8 seconds per element (max 4).',
        effects: [{ kind: 'elementStacks', elements: ['arcane', 'cold', 'fire', 'lightning'], windowMs: 8000, perStack: 50, buff: 'fallen_star' }] },
      { count: 6, text: 'Meteor deals 700% increased damage.', effects: [ownMult(['meteor'], 8)] },
    ],
    colors: { primary: 0x23154a, secondary: 0xff9a3c, glow: 0x3cff6e },
  },
  alternativeSet('glass_concord', 'Glass Concord', 'mage', MAGE_SET_BASES, 0x667996, ['magic_missile', 'black_hole'],
    { dmg: 40 }, 'Magic Missile and Black Hole deal 40% increased damage.', { cooldown: -30 }, 'Black Hole cooldown is reduced by 30%.', 24),
  alternativeSet('lantern_garden', 'Lantern Garden', 'mage', MAGE_SET_BASES, 0x536745, ['hydra', 'frost_nova'],
    { duration: 40 }, 'Hydras last 40% longer and Frost Nova freezes last 40% longer.', { cooldown: -30 }, 'Frost Nova cooldown is reduced by 30%.', 24),
];
