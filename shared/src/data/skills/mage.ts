// Mage skills (data only). Behaviour lives in server/src/sim/skills/mage.ts; recipe in docs/rework/depth/FOUNDATION.md.

import type { SkillDef } from './types';

/** Order matters: it is the registry order (skill pickers, affix rolls), so append new skills at the end. */
export const MAGE_SKILLS: SkillDef[] = [
  {
    id: 'magic_missile', classId: 'mage', name: 'Magic Missile', kind: 'primary', unlock: 1, element: 'arcane', tags: ['projectile'],
    coef: 2.3, cost: 0, gen: 0, cooldown: 0, range: 380, radius: 0, duration: 0, maxSummons: 0,
    auto: { when: 'always' },
    desc: 'Launch a missile of arcane energy, dealing {coef} weapon damage as Arcane.',
    icon: { glyph: 'missile', color: 0xb388ff },
    runes: [
      { id: 'seeker', name: 'Seeker', unlock: 3, desc: 'Missiles home in on enemies and deal 30% more damage.', mods: { dmg: 30, flags: ['homing'] } },
      { id: 'split', name: 'Split', unlock: 6, desc: 'Fire 3 missiles that each deal 60% of the damage.', mods: { projectiles: 2, dmg: -40 } },
      { id: 'glacial_spike', name: 'Glacial Spike', unlock: 10, desc: 'Deals Cold damage and has a 15% chance to freeze for 1 second.', mods: { element: 'cold', flags: ['freezeChance'] } },
    ],
    tiers: [
      { name: 'Focused Will', desc: '+20% Magic Missile damage.', mods: { dmg: 20 } },
      { name: 'Arcane Battery', desc: 'Each missile restores 2 Arcane Power.', mods: { gen: 2 } },
      { name: 'Echoing Bolt', desc: 'Fire an additional missile.', mods: { projectiles: 1 } },
    ],
  },
  {
    id: 'meteor', classId: 'mage', name: 'Meteor', kind: 'spender', unlock: 2, element: 'fire', tags: ['area', 'ground'],
    coef: 7.4, cost: 40, gen: 0, cooldown: 0, range: 380, radius: 130, duration: 3, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 1, within: 380 },
    desc: 'Summon a meteor onto the densest pack. After a short delay it impacts for {coef} weapon damage as Fire and leaves molten ground that burns for 235% weapon damage over {duration} seconds.',
    icon: { glyph: 'meteor', color: 0xff7a1a },
    runes: [
      { id: 'star_pact', name: 'Star Pact', unlock: 4, desc: 'Meteor costs 20 more Arcane Power but deals 70% more damage.', mods: { cost: 50, dmg: 70 } },
      { id: 'comet', name: 'Comet', unlock: 7, desc: 'Deals Cold damage and freezes enemies hit for 1.5 seconds.', mods: { element: 'cold', flags: ['freeze'] } },
      { id: 'meteor_shower', name: 'Meteor Shower', unlock: 11, desc: 'Summon 7 smaller meteors across the area, each dealing 37% of the damage.', mods: { flags: ['shower'] } },
    ],
    tiers: [
      { name: 'Heavier Stars', desc: '+25% Meteor damage.', mods: { dmg: 25 } },
      { name: 'Crater', desc: 'Impact radius +25%.', mods: { radius: 25 } },
      { name: 'Celestial Discount', desc: 'Costs 25% less Arcane Power.', mods: { cost: -25 } },
    ],
  },
  {
    id: 'black_hole', classId: 'mage', name: 'Black Hole', kind: 'cooldown', unlock: 4, element: 'arcane', tags: ['area', 'ground'],
    coef: 5.4, cost: 20, gen: 0, cooldown: 12, range: 380, radius: 220, duration: 2, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 4, within: 380 },
    desc: 'Tear open a black hole that pulls enemies within {radius} units to its centre and deals {coef} weapon damage as Arcane over {duration} seconds. Pairs perfectly with Meteor.',
    icon: { glyph: 'vortex', color: 0x8e44ad },
    runes: [
      { id: 'event_horizon', name: 'Event Horizon', unlock: 6, desc: 'Pull radius increased by 40%.', mods: { radius: 40 } },
      { id: 'spellsteal', name: 'Spellsteal', unlock: 9, desc: 'Gain 3% damage for 10 seconds per enemy caught.', mods: { flags: ['spellsteal'] } },
      { id: 'absolute_zero', name: 'Absolute Zero', unlock: 13, desc: 'Deals Cold damage and freezes enemies when it collapses.', mods: { element: 'cold', flags: ['freeze'] } },
    ],
    tiers: [
      { name: 'Singularity', desc: '+30% Black Hole damage.', mods: { dmg: 30 } },
      { name: 'Short Orbit', desc: 'Cooldown reduced by 25%.', mods: { cooldown: -25 } },
      { name: 'Gravity Well', desc: 'Lasts 50% longer.', mods: { duration: 50 } },
    ],
  },
  {
    id: 'frost_nova', classId: 'mage', name: 'Frost Nova', kind: 'cooldown', unlock: 6, element: 'cold', tags: ['area'],
    coef: 1.75, cost: 0, gen: 0, cooldown: 11, range: 180, radius: 190, duration: 2, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 3, within: 170 },
    desc: 'Blast a ring of frost, dealing {coef} weapon damage as Cold and freezing nearby enemies for {duration} seconds.',
    icon: { glyph: 'snowflake', color: 0x7fd3ff },
    runes: [
      { id: 'shatter', name: 'Shatter', unlock: 8, desc: 'Frozen enemies that die explode into another Frost Nova.', mods: { flags: ['shatterNova'] } },
      { id: 'bone_chill', name: 'Bone Chill', unlock: 11, desc: 'Frozen enemies take 33% more damage.', mods: { flags: ['vulnerable'] } },
      { id: 'deep_freeze', name: 'Deep Freeze', unlock: 15, desc: 'Gain 10% Critical Hit Chance for 11 seconds when 5+ enemies are frozen.', mods: { flags: ['deepFreeze'] } },
    ],
    tiers: [
      { name: 'Rime', desc: '+50% Frost Nova damage.', mods: { dmg: 50 } },
      { name: 'Glacial Pulse', desc: 'Cooldown reduced by 25%.', mods: { cooldown: -25 } },
      { name: 'Permafrost Ring', desc: 'Radius increased by 30%.', mods: { radius: 30 } },
    ],
  },
  {
    id: 'hydra', classId: 'mage', name: 'Hydra', kind: 'summon', unlock: 9, element: 'fire', tags: ['summon', 'projectile'],
    coef: 2.8, cost: 15, gen: 0, cooldown: 0, range: 380, radius: 380, duration: 9, maxSummons: 1,
    auto: { when: 'maintainSummon' },
    desc: 'Summon a Hydra that attacks for {coef} weapon damage per second as {element}. Lasts {duration} seconds.',
    icon: { glyph: 'hydra', color: 0xff5e3a },
    runes: [
      { id: 'arcane_hydra', name: 'Arcane Hydra', unlock: 11, desc: 'Spits Arcane orbs that explode on impact.', mods: { element: 'arcane', flags: ['splash'] } },
      { id: 'frost_hydra', name: 'Frost Hydra', unlock: 14, desc: 'Fires shards of ice that chill enemies.', mods: { element: 'cold', flags: ['chill'] } },
      { id: 'mammoth_hydra', name: 'Mammoth Hydra', unlock: 18, desc: 'A single massive Hydra breathes a river of fire, dealing 70% more damage.', mods: { dmg: 70, flags: ['mammoth'] } },
    ],
    tiers: [
      { name: 'Many Heads', desc: '+30% Hydra damage.', mods: { dmg: 30 } },
      { name: 'Longevity', desc: 'Hydra lasts 60% longer.', mods: { duration: 60 } },
      { name: 'Brood', desc: '+1 maximum Hydra.', mods: { maxSummons: 1 } },
    ],
  },
  {
    id: 'magic_weapon', classId: 'mage', name: 'Magic Weapon', kind: 'buff', unlock: 12, element: 'arcane', tags: ['aura'],
    coef: 0, cost: 25, gen: 0, cooldown: 0, range: 0, radius: 0, duration: 60, maxSummons: 0,
    auto: { when: 'maintainBuff' },
    desc: 'Imbue your weapon with arcane power, increasing damage by {buffDamage} for {duration} seconds. Recast automatically.',
    icon: { glyph: 'rune', color: 0x9b59b6 },
    runes: [
      { id: 'ignite', name: 'Ignite', unlock: 14, desc: 'Your attacks burn enemies for 100% weapon damage over 3 seconds.', mods: { flags: ['igniteHits'] } },
      { id: 'electrify', name: 'Electrify', unlock: 17, desc: 'Your attacks have a 25% chance to arc lightning to 3 enemies for 100% weapon damage.', mods: { flags: ['electrify'] } },
      { id: 'force_weapon', name: 'Force Weapon', unlock: 21, desc: 'Increases the damage bonus to 20%.', mods: { flags: ['forceWeapon'] } },
    ],
    tiers: [
      { name: 'Lasting Glyph', desc: 'Lasts 50% longer.', mods: { duration: 50 } },
      { name: 'Free Glyph', desc: 'Costs no Arcane Power.', mods: { cost: -100 } },
      { name: 'Overcharge', desc: 'Grants an additional 5% damage.', mods: { flags: ['weaponExtra'] } },
    ],
  },
];
