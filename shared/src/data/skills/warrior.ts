// Warrior skills (data only). Behaviour lives in server/src/sim/skills/warrior.ts; recipe in docs/rework/depth/FOUNDATION.md.

import type { SkillDef } from './types';

/** Order matters: it is the registry order (skill pickers, affix rolls), so append new skills at the end. */
export const WARRIOR_SKILLS: SkillDef[] = [
  {
    id: 'cleave', classId: 'warrior', name: 'Cleave', kind: 'primary', unlock: 1, element: 'physical', tags: ['melee', 'area'],
    coef: 1.6, cost: 0, gen: 5, cooldown: 0, range: 86, radius: 110, duration: 0, maxSummons: 0,
    auto: { when: 'always' },
    desc: 'Swing in a wide arc, dealing {coef} weapon damage to all enemies caught in the swing. Generates {gen} Fury per swing.',
    icon: { glyph: 'arc', color: 0xd9d2c5 },
    runes: [
      { id: 'rupture', name: 'Rupture', unlock: 3, tags: ['area'], desc: 'Enemies slain by Cleave explode, dealing 120% weapon damage to nearby enemies.', mods: { flags: ['explodeOnKill'] } },
      { id: 'broad_sweep', name: 'Broad Sweep', unlock: 6, desc: 'The swing covers a much wider arc and deals 30% more damage.', mods: { radius: 25, dmg: 30, flags: ['wideArc'] } },
      { id: 'gathering_storm', name: 'Gathering Storm', unlock: 10, desc: 'Cleave deals Lightning damage and generates 3 additional Fury.', mods: { element: 'lightning', gen: 3 } },
    ],
    tiers: [
      { name: 'Honed Edge', desc: '+20% Cleave damage.', mods: { dmg: 20 } },
      { name: 'Blood Tithe', desc: 'Generate 2 additional Fury per swing.', mods: { gen: 2 } },
      { name: 'Momentum', desc: 'Each swing grants 3% attack speed for 3 seconds, stacking 5 times.', mods: { flags: ['momentum'] } },
    ],
  },
  {
    id: 'whirlwind', classId: 'warrior', name: 'Whirlwind', kind: 'channel', unlock: 2, element: 'physical', tags: ['melee', 'area'],
    coef: 3.4, cost: 10, gen: 0, cooldown: 0, range: 260, radius: 100, duration: 0, maxSummons: 0,
    auto: { when: 'channel', startAt: 25, within: 240 },
    desc: 'Become a whirling storm of steel, dealing {coef} weapon damage per second to all enemies around you while you move. Costs {cost} Fury per second. Starts automatically at 25 Fury when enemies are near.',
    icon: { glyph: 'spiral', color: 0xe6e0d0 },
    runes: [
      { id: 'dust_devils', name: 'Dust Devils', unlock: 4, tags: ['summon'], desc: 'Every second you whirl, unleash a Dust Devil that wanders through enemies for 3 seconds, dealing 120% weapon damage per second.', mods: { flags: ['dustDevils'] } },
      { id: 'blood_funnel', name: 'Blood Funnel', unlock: 7, desc: 'Critical hits heal you for 1.5% of your maximum Life.', mods: { flags: ['critHeal'] } },
      { id: 'volcanic_eruption', name: 'Volcanic Eruption', unlock: 11, desc: 'Whirlwind deals Fire damage and its radius is increased by 30%.', mods: { element: 'fire', radius: 30 } },
    ],
    tiers: [
      { name: 'Wider Gyre', desc: 'Whirlwind radius increased by 25%.', mods: { radius: 25 } },
      { name: 'Endless Spin', desc: 'Whirlwind costs 25% less Fury.', mods: { cost: -25 } },
      { name: 'Eye of the Storm', desc: '+40% Whirlwind damage.', mods: { dmg: 40 } },
    ],
  },
  {
    id: 'rend', classId: 'warrior', name: 'Rend', kind: 'spender', unlock: 4, element: 'physical', tags: ['melee', 'area'],
    coef: 6.0, cost: 20, gen: 0, cooldown: 0, range: 150, radius: 150, duration: 5, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 3, within: 150 },
    desc: 'Tear into all nearby enemies, causing them to bleed for {coef} weapon damage over {duration} seconds. Cast automatically when 3+ unbleeding enemies are near.',
    icon: { glyph: 'claw', color: 0xc0392b },
    runes: [
      { id: 'ravage', name: 'Ravage', unlock: 6, desc: 'Rend reaches 40% further.', mods: { radius: 40 } },
      { id: 'bloodlust', name: 'Bloodlust', unlock: 9, desc: 'Heal for 0.5% of maximum Life per enemy bleeding, every second.', mods: { flags: ['bleedHeal'] } },
      { id: 'lacerate', name: 'Lacerate', unlock: 13, desc: 'Rend deals 60% more damage.', mods: { dmg: 60 } },
    ],
    tiers: [
      { name: 'Deep Wounds', desc: '+25% Rend damage.', mods: { dmg: 25 } },
      { name: 'Frugal Butcher', desc: 'Rend costs 30% less Fury.', mods: { cost: -30 } },
      { name: 'Contagion', desc: 'When a bleeding enemy dies, its bleed spreads to up to 3 nearby enemies.', mods: { flags: ['bleedSpread'] } },
    ],
  },
  {
    id: 'ground_stomp', classId: 'warrior', name: 'Ground Stomp', kind: 'cooldown', unlock: 6, element: 'physical', tags: ['melee', 'area'],
    coef: 2.4, cost: 0, gen: 15, cooldown: 12, range: 170, radius: 170, duration: 2, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 4, within: 170 },
    desc: 'Smash the ground, dealing {coef} weapon damage and stunning nearby enemies for {duration} seconds. Generates {gen} Fury.',
    icon: { glyph: 'stomp', color: 0xb08850 },
    runes: [
      { id: 'wrenching_smash', name: 'Wrenching Smash', unlock: 8, desc: 'Pull enemies from up to 320 units away into the stomp.', mods: { flags: ['pull'] } },
      { id: 'jarring_slam', name: 'Jarring Slam', unlock: 11, desc: 'Stunned enemies take 30% more damage from all sources.', mods: { flags: ['vulnerable'] } },
      { id: 'foot_of_the_mountain', name: 'Foot of the Mountain', unlock: 15, desc: 'Deals 200% more damage as Fire and generates 10 more Fury.', mods: { dmg: 200, element: 'fire', gen: 10 } },
    ],
    tiers: [
      { name: 'Aftershock', desc: '+30% Ground Stomp damage.', mods: { dmg: 30 } },
      { name: 'Quick Feet', desc: 'Cooldown reduced by 20%.', mods: { cooldown: -20 } },
      { name: 'Seismic Reach', desc: 'Radius increased by 30%.', mods: { radius: 30 } },
    ],
  },
  {
    id: 'seismic_slam', classId: 'warrior', name: 'Seismic Slam', kind: 'spender', unlock: 9, element: 'physical', tags: ['area'],
    coef: 7.55, cost: 30, gen: 0, cooldown: 0, range: 336, radius: 60, duration: 0, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 3, within: 304 },
    desc: 'Send a fissure through the earth, dealing {coef} weapon damage to all enemies in a 60° cone.',
    icon: { glyph: 'fissure', color: 0x9c7b52 },
    runes: [
      { id: 'shattered_ground', name: 'Shattered Ground', unlock: 11, desc: 'Deals Fire damage and knocks enemies back further.', mods: { element: 'fire', flags: ['knockback'] } },
      { id: 'permafrost', name: 'Permafrost', unlock: 14, desc: 'Deals Cold damage and chills enemies by 60% for 2 seconds.', mods: { element: 'cold', flags: ['chill'] } },
      { id: 'rumble', name: 'Rumble', unlock: 18, desc: 'The ground continues to shake, dealing an additional 100% of the damage over 1 second.', mods: { dmg: 40, flags: ['aftershock'] } },
    ],
    tiers: [
      { name: 'Fault Line', desc: '+25% Seismic Slam damage.', mods: { dmg: 25 } },
      { name: 'Tremor Economy', desc: 'Costs 20% less Fury.', mods: { cost: -20 } },
      { name: 'Wide Rift', desc: 'Cone is 35% wider and reaches further.', mods: { radius: 35 } },
    ],
  },
  {
    id: 'battle_rage', classId: 'warrior', name: 'Battle Rage', kind: 'buff', unlock: 12, element: 'physical', tags: ['aura'],
    coef: 0, cost: 20, gen: 0, cooldown: 0, range: 0, radius: 0, duration: 60, maxSummons: 0,
    auto: { when: 'maintainBuff' },
    desc: 'Enter a rage that increases damage by {buffDamage} and Critical Hit Chance by {buffCritChance}{buffCritDamage} for {duration} seconds. Recast automatically.',
    icon: { glyph: 'rage', color: 0xe74c3c },
    runes: [
      { id: 'into_the_fray', name: 'Into the Fray', unlock: 14, desc: 'Critical hits generate 4 Fury.', mods: { flags: ['critFury'] } },
      { id: 'marauders_rage', name: "Marauder's Rage", unlock: 17, desc: 'Increases the damage bonus to 25%.', mods: { flags: ['rageDmg'] } },
      { id: 'ferocity', name: 'Ferocity', unlock: 21, desc: 'Also increases Critical Hit Damage by 25%.', mods: { flags: ['rageChd'] } },
    ],
    tiers: [
      { name: 'Seething', desc: 'Lasts 50% longer.', mods: { duration: 50 } },
      { name: 'Red Mist', desc: 'Costs no Fury.', mods: { cost: -100 } },
      { name: 'Unbridled', desc: 'Grants an additional 5% damage.', mods: { flags: ['rageExtra'] } },
    ],
  },
];
