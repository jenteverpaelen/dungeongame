// Skills: Diablo 3 structure (skills unlock by level, each has runes that change behaviour)
// combined with Task Bar Hero's per-skill upgrade tiers bought with skill points.
// Damage coefficients follow Diablo 3 values where a direct analogue exists (e.g. Meteor 740%, Sentry 280%).

import type { ClassId, Element } from '../types';

export type SkillKind = 'primary' | 'spender' | 'channel' | 'cooldown' | 'buff' | 'summon';

export type AutoRule =
  | { when: 'always' }
  | { when: 'enemiesNear'; count: number; within: number }
  | { when: 'maintainBuff' }
  | { when: 'maintainSummon' }
  | { when: 'channel'; startAt: number; within: number };

/** Behaviour modifiers granted by runes, tiers, legendary powers and set bonuses. */
export interface SkillMods {
  dmg?: number;         // additive % to this skill's damage
  radius?: number;      // additive % to radius
  cost?: number;        // additive % to resource cost (negative = cheaper)
  cooldown?: number;    // additive % to cooldown (negative = faster)
  duration?: number;    // additive % to duration
  projectiles?: number; // extra projectiles
  pierce?: number;      // extra pierce chance (percentage points)
  element?: Element;    // converts the skill's element
  gen?: number;         // extra resource generated per cast/hit
  maxSummons?: number;  // extra concurrent summons
  flags?: string[];     // behaviour flags interpreted by the server simulation
}

export interface RuneDef {
  id: string;
  name: string;
  desc: string;
  mods: SkillMods;
}

export interface TierDef {
  name: string;
  desc: string;
  mods: SkillMods;
}

export interface SkillDef {
  id: string;
  classId: ClassId;
  name: string;
  kind: SkillKind;
  unlock: number;
  element: Element;
  /** Weapon-damage multiplier per hit (1.5 = 150% weapon damage). DoTs: total over duration. */
  coef: number;
  cost: number;
  /** Resource generated per hit (primaries) or per cast. */
  gen: number;
  cooldown: number; // seconds
  range: number;    // targeting / acquisition range
  radius: number;
  duration: number; // seconds (buffs, summons, ground effects)
  maxSummons: number;
  auto: AutoRule;
  desc: string;
  icon: { glyph: string; color: number };
  runes: RuneDef[];
  tiers: TierDef[];
}

/** Rune i unlocks at skill.unlock + RUNE_UNLOCK_OFFSETS[i]. */
export const RUNE_UNLOCK_OFFSETS = [2, 5, 9];
/** Skill points needed for tier 1, 2, 3 (Task Bar Hero-style escalating tiers). */
export const TIER_COSTS = [2, 4, 6];
export const SKILL_SLOTS = 4;

const S = (d: SkillDef) => d;

export const SKILLS: Record<string, SkillDef> = {
  // ─────────────────────────── WARRIOR ───────────────────────────
  cleave: S({
    id: 'cleave', classId: 'warrior', name: 'Cleave', kind: 'primary', unlock: 1, element: 'physical',
    coef: 1.6, cost: 0, gen: 5, cooldown: 0, range: 86, radius: 110, duration: 0, maxSummons: 0,
    auto: { when: 'always' },
    desc: 'Swing in a wide arc, dealing {coef} weapon damage to all enemies caught in the swing. Generates {gen} Fury per swing.',
    icon: { glyph: 'arc', color: 0xd9d2c5 },
    runes: [
      { id: 'rupture', name: 'Rupture', desc: 'Enemies slain by Cleave explode, dealing 120% weapon damage to nearby enemies.', mods: { flags: ['explodeOnKill'] } },
      { id: 'broad_sweep', name: 'Broad Sweep', desc: 'The swing covers a much wider arc and deals 30% more damage.', mods: { radius: 25, dmg: 30, flags: ['wideArc'] } },
      { id: 'gathering_storm', name: 'Gathering Storm', desc: 'Cleave deals Lightning damage and generates 3 additional Fury.', mods: { element: 'lightning', gen: 3 } },
    ],
    tiers: [
      { name: 'Honed Edge', desc: '+20% Cleave damage.', mods: { dmg: 20 } },
      { name: 'Blood Tithe', desc: 'Generate 2 additional Fury per swing.', mods: { gen: 2 } },
      { name: 'Momentum', desc: 'Each swing grants 3% attack speed for 3 seconds, stacking 5 times.', mods: { flags: ['momentum'] } },
    ],
  }),
  whirlwind: S({
    id: 'whirlwind', classId: 'warrior', name: 'Whirlwind', kind: 'channel', unlock: 2, element: 'physical',
    coef: 3.4, cost: 10, gen: 0, cooldown: 0, range: 260, radius: 100, duration: 0, maxSummons: 0,
    auto: { when: 'channel', startAt: 25, within: 240 },
    desc: 'Become a whirling storm of steel, dealing {coef} weapon damage per second to all enemies around you while you move. Costs {cost} Fury per second. Starts automatically at 25 Fury when enemies are near.',
    icon: { glyph: 'spiral', color: 0xe6e0d0 },
    runes: [
      { id: 'dust_devils', name: 'Dust Devils', desc: 'Every second you whirl, unleash a Dust Devil that wanders through enemies for 3 seconds, dealing 120% weapon damage per second.', mods: { flags: ['dustDevils'] } },
      { id: 'blood_funnel', name: 'Blood Funnel', desc: 'Critical hits heal you for 1.5% of your maximum Life.', mods: { flags: ['critHeal'] } },
      { id: 'volcanic_eruption', name: 'Volcanic Eruption', desc: 'Whirlwind deals Fire damage and its radius is increased by 30%.', mods: { element: 'fire', radius: 30 } },
    ],
    tiers: [
      { name: 'Wider Gyre', desc: 'Whirlwind radius increased by 25%.', mods: { radius: 25 } },
      { name: 'Endless Spin', desc: 'Whirlwind costs 25% less Fury.', mods: { cost: -25 } },
      { name: 'Eye of the Storm', desc: '+40% Whirlwind damage.', mods: { dmg: 40 } },
    ],
  }),
  rend: S({
    id: 'rend', classId: 'warrior', name: 'Rend', kind: 'spender', unlock: 4, element: 'physical',
    coef: 6.0, cost: 20, gen: 0, cooldown: 0, range: 150, radius: 150, duration: 5, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 3, within: 150 },
    desc: 'Tear into all nearby enemies, causing them to bleed for {coef} weapon damage over {duration} seconds. Cast automatically when 3+ unbleeding enemies are near.',
    icon: { glyph: 'claw', color: 0xc0392b },
    runes: [
      { id: 'ravage', name: 'Ravage', desc: 'Rend reaches 40% further.', mods: { radius: 40 } },
      { id: 'bloodlust', name: 'Bloodlust', desc: 'Heal for 0.5% of maximum Life per enemy bleeding, every second.', mods: { flags: ['bleedHeal'] } },
      { id: 'lacerate', name: 'Lacerate', desc: 'Rend deals 60% more damage.', mods: { dmg: 60 } },
    ],
    tiers: [
      { name: 'Deep Wounds', desc: '+25% Rend damage.', mods: { dmg: 25 } },
      { name: 'Frugal Butcher', desc: 'Rend costs 30% less Fury.', mods: { cost: -30 } },
      { name: 'Contagion', desc: 'When a bleeding enemy dies, its bleed spreads to up to 3 nearby enemies.', mods: { flags: ['bleedSpread'] } },
    ],
  }),
  ground_stomp: S({
    id: 'ground_stomp', classId: 'warrior', name: 'Ground Stomp', kind: 'cooldown', unlock: 6, element: 'physical',
    coef: 2.4, cost: 0, gen: 15, cooldown: 12, range: 170, radius: 170, duration: 2, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 4, within: 170 },
    desc: 'Smash the ground, dealing {coef} weapon damage and stunning nearby enemies for {duration} seconds. Generates {gen} Fury.',
    icon: { glyph: 'stomp', color: 0xb08850 },
    runes: [
      { id: 'wrenching_smash', name: 'Wrenching Smash', desc: 'Pull enemies from up to 320 units away into the stomp.', mods: { flags: ['pull'] } },
      { id: 'jarring_slam', name: 'Jarring Slam', desc: 'Stunned enemies take 30% more damage from all sources.', mods: { flags: ['vulnerable'] } },
      { id: 'foot_of_the_mountain', name: 'Foot of the Mountain', desc: 'Deals 200% more damage as Fire and generates 10 more Fury.', mods: { dmg: 200, element: 'fire', gen: 10 } },
    ],
    tiers: [
      { name: 'Aftershock', desc: '+30% Ground Stomp damage.', mods: { dmg: 30 } },
      { name: 'Quick Feet', desc: 'Cooldown reduced by 20%.', mods: { cooldown: -20 } },
      { name: 'Seismic Reach', desc: 'Radius increased by 30%.', mods: { radius: 30 } },
    ],
  }),
  seismic_slam: S({
    id: 'seismic_slam', classId: 'warrior', name: 'Seismic Slam', kind: 'spender', unlock: 9, element: 'physical',
    coef: 7.55, cost: 30, gen: 0, cooldown: 0, range: 420, radius: 60, duration: 0, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 3, within: 380 },
    desc: 'Send a fissure through the earth, dealing {coef} weapon damage to all enemies in a 60° cone.',
    icon: { glyph: 'fissure', color: 0x9c7b52 },
    runes: [
      { id: 'shattered_ground', name: 'Shattered Ground', desc: 'Deals Fire damage and knocks enemies back further.', mods: { element: 'fire', flags: ['knockback'] } },
      { id: 'permafrost', name: 'Permafrost', desc: 'Deals Cold damage and chills enemies by 60% for 2 seconds.', mods: { element: 'cold', flags: ['chill'] } },
      { id: 'rumble', name: 'Rumble', desc: 'The ground continues to shake, dealing an additional 100% of the damage over 1 second.', mods: { dmg: 40, flags: ['aftershock'] } },
    ],
    tiers: [
      { name: 'Fault Line', desc: '+25% Seismic Slam damage.', mods: { dmg: 25 } },
      { name: 'Tremor Economy', desc: 'Costs 20% less Fury.', mods: { cost: -20 } },
      { name: 'Wide Rift', desc: 'Cone is 35% wider and reaches further.', mods: { radius: 35 } },
    ],
  }),
  battle_rage: S({
    id: 'battle_rage', classId: 'warrior', name: 'Battle Rage', kind: 'buff', unlock: 12, element: 'physical',
    coef: 0, cost: 20, gen: 0, cooldown: 0, range: 0, radius: 0, duration: 60, maxSummons: 0,
    auto: { when: 'maintainBuff' },
    desc: 'Enter a rage that increases damage by 10% and Critical Hit Chance by 3% for {duration} seconds. Recast automatically.',
    icon: { glyph: 'rage', color: 0xe74c3c },
    runes: [
      { id: 'into_the_fray', name: 'Into the Fray', desc: 'Critical hits generate 4 Fury.', mods: { flags: ['critFury'] } },
      { id: 'marauders_rage', name: "Marauder's Rage", desc: 'Increases the damage bonus to 25%.', mods: { flags: ['rageDmg'] } },
      { id: 'ferocity', name: 'Ferocity', desc: 'Also increases Critical Hit Damage by 25%.', mods: { flags: ['rageChd'] } },
    ],
    tiers: [
      { name: 'Seething', desc: 'Lasts 50% longer.', mods: { duration: 50 } },
      { name: 'Red Mist', desc: 'Costs no Fury.', mods: { cost: -100 } },
      { name: 'Unbridled', desc: 'Grants an additional 5% damage.', mods: { flags: ['rageExtra'] } },
    ],
  }),

  // ─────────────────────────── RANGER ───────────────────────────
  hungering_arrow: S({
    id: 'hungering_arrow', classId: 'ranger', name: 'Hungering Arrow', kind: 'primary', unlock: 1, element: 'physical',
    coef: 1.55, cost: 0, gen: 3, cooldown: 0, range: 520, radius: 0, duration: 0, maxSummons: 0,
    auto: { when: 'always' },
    desc: 'Fire a magically imbued arrow that seeks out enemies for {coef} weapon damage, with a 35% chance to pierce. Generates {gen} Hatred.',
    icon: { glyph: 'arrow', color: 0x8fd16a },
    runes: [
      { id: 'puncturing', name: 'Puncturing Arrow', desc: 'Pierce chance increased by 50%.', mods: { pierce: 50 } },
      { id: 'shatter_shot', name: 'Shatter Shot', desc: 'Piercing splits the arrow into 3 smaller arrows dealing Cold damage.', mods: { element: 'cold', flags: ['splitOnPierce'] } },
      { id: 'devouring', name: 'Devouring Arrow', desc: 'Each consecutive pierce deals 70% more damage.', mods: { flags: ['devouring'] } },
    ],
    tiers: [
      { name: 'Fletcher', desc: '+20% Hungering Arrow damage.', mods: { dmg: 20 } },
      { name: 'Twin Draw', desc: 'Fire an additional arrow.', mods: { projectiles: 1 } },
      { name: 'Bloodscent', desc: 'Generates 2 additional Hatred.', mods: { gen: 2 } },
    ],
  }),
  sentry: S({
    id: 'sentry', classId: 'ranger', name: 'Sentry', kind: 'summon', unlock: 2, element: 'physical',
    coef: 2.8, cost: 20, gen: 0, cooldown: 8, range: 600, radius: 560, duration: 30, maxSummons: 2,
    auto: { when: 'maintainSummon' },
    desc: 'Deploy a turret at your feet that fires bolts at enemies for {coef} weapon damage each second. Up to {max} Sentries; lasts {duration} seconds.',
    icon: { glyph: 'turret', color: 0xc9a227 },
    runes: [
      { id: 'spitfire', name: 'Spitfire Turret', desc: 'The turret also fires homing rockets dealing 120% weapon damage as Fire.', mods: { flags: ['rockets'] } },
      { id: 'chain_of_torment', name: 'Chain of Torment', desc: 'Lightning chains form between your Sentries, dealing 300% weapon damage per second to enemies that cross them.', mods: { flags: ['chains'] } },
      { id: 'polar_station', name: 'Polar Station', desc: 'Bolts deal Cold damage and chill enemies by 60%.', mods: { element: 'cold', flags: ['chill'] } },
    ],
    tiers: [
      { name: 'Reinforced Frame', desc: '+25% Sentry damage.', mods: { dmg: 25 } },
      { name: 'Rapid Assembly', desc: 'Sentry cooldown reduced by 25%.', mods: { cooldown: -25 } },
      { name: 'Custom Engineering', desc: '+1 maximum Sentry and Sentries last 50% longer.', mods: { maxSummons: 1, duration: 50 } },
    ],
  }),
  multishot: S({
    id: 'multishot', classId: 'ranger', name: 'Multishot', kind: 'spender', unlock: 4, element: 'physical',
    coef: 3.6, cost: 25, gen: 0, cooldown: 0, range: 500, radius: 0, duration: 0, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 2, within: 480 },
    desc: 'Fire a massive volley of arrows in a wide arc, dealing {coef} weapon damage to every enemy hit.',
    icon: { glyph: 'fan', color: 0x9bd36f },
    runes: [
      { id: 'fire_at_will', name: 'Fire at Will', desc: 'Deals Lightning damage and costs 40% less Hatred.', mods: { element: 'lightning', cost: -40 } },
      { id: 'arsenal', name: 'Arsenal', desc: 'Also fires 3 rockets at nearby enemies for 300% weapon damage as Fire.', mods: { flags: ['rockets'] } },
      { id: 'full_broadside', name: 'Full Broadside', desc: 'Multishot deals 50% more damage.', mods: { dmg: 50 } },
    ],
    tiers: [
      { name: 'Volley Drill', desc: '+20% Multishot damage.', mods: { dmg: 20 } },
      { name: 'Extra Quivers', desc: '+4 arrows in the volley.', mods: { projectiles: 4 } },
      { name: 'Hatred Harvest', desc: 'Costs 25% less Hatred.', mods: { cost: -25 } },
    ],
  }),
  cluster_arrow: S({
    id: 'cluster_arrow', classId: 'ranger', name: 'Cluster Arrow', kind: 'spender', unlock: 6, element: 'fire',
    coef: 6.5, cost: 40, gen: 0, cooldown: 0, range: 520, radius: 110, duration: 0, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 3, within: 500 },
    desc: 'Lob an explosive arrow into the densest pack. It detonates for {coef} weapon damage as Fire, then releases 4 grenades for 210% weapon damage each.',
    icon: { glyph: 'cluster', color: 0xe67e22 },
    runes: [
      { id: 'maelstrom', name: 'Maelstrom', desc: 'Releases 3 homing rockets instead of grenades.', mods: { flags: ['rockets'] } },
      { id: 'shooting_stars', name: 'Shooting Stars', desc: 'Deals Lightning damage; grenades become falling stars.', mods: { element: 'lightning' } },
      { id: 'loaded_for_bear', name: 'Loaded for Bear', desc: 'Explosion radius +40% and +80% damage, but no grenades.', mods: { radius: 40, dmg: 80, flags: ['noGrenades'] } },
    ],
    tiers: [
      { name: 'Black Powder', desc: '+25% Cluster Arrow damage.', mods: { dmg: 25 } },
      { name: 'Wide Payload', desc: 'Explosion radius +25%.', mods: { radius: 25 } },
      { name: 'Frugal Fuse', desc: 'Costs 20% less Hatred.', mods: { cost: -20 } },
    ],
  }),
  rain_of_vengeance: S({
    id: 'rain_of_vengeance', classId: 'ranger', name: 'Rain of Vengeance', kind: 'cooldown', unlock: 9, element: 'physical',
    coef: 15, cost: 0, gen: 0, cooldown: 30, range: 520, radius: 240, duration: 5, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 5, within: 500 },
    desc: 'Call down a storm of arrows on a large area, dealing {coef} weapon damage over {duration} seconds.',
    icon: { glyph: 'rain', color: 0x5dade2 },
    runes: [
      { id: 'dark_cloud', name: 'Dark Cloud', desc: 'Deals Lightning damage; the storm follows the densest pack.', mods: { element: 'lightning', flags: ['follow'] } },
      { id: 'beastly_bombs', name: 'Beastly Bombs', desc: 'Deals Fire damage and 50% more damage in a shorter burst.', mods: { element: 'fire', dmg: 50, duration: -40 } },
      { id: 'stampede', name: 'Stampede', desc: 'Cooldown reduced by 33%.', mods: { cooldown: -33 } },
    ],
    tiers: [
      { name: 'Hail of Shafts', desc: '+30% Rain of Vengeance damage.', mods: { dmg: 30 } },
      { name: 'Vengeance Renewed', desc: 'Cooldown reduced by 20%.', mods: { cooldown: -20 } },
      { name: 'Wide Storm', desc: 'Radius increased by 30%.', mods: { radius: 30 } },
    ],
  }),
  companion: S({
    id: 'companion', classId: 'ranger', name: 'Companion', kind: 'summon', unlock: 12, element: 'physical',
    coef: 1.5, cost: 0, gen: 0, cooldown: 0, range: 400, radius: 0, duration: 0, maxSummons: 1,
    auto: { when: 'maintainSummon' },
    desc: 'A loyal wolf fights at your side, biting enemies for {coef} weapon damage.',
    icon: { glyph: 'paw', color: 0xa0a0a0 },
    runes: [
      { id: 'wolf_howl', name: 'Pack Leader', desc: 'Your wolf howls, increasing your damage by 15%.', mods: { flags: ['wolfAura'] } },
      { id: 'bat', name: 'Bat Companion', desc: 'A bat replaces the wolf and generates 1 Hatred per second.', mods: { flags: ['batCompanion'] } },
      { id: 'raven', name: 'Raven Companion', desc: 'A raven replaces the wolf, dealing Lightning damage and 50% more.', mods: { element: 'lightning', dmg: 50, flags: ['ravenCompanion'] } },
    ],
    tiers: [
      { name: 'Sharpened Fangs', desc: '+50% Companion damage.', mods: { dmg: 50 } },
      { name: 'Alpha', desc: '+80% Companion damage.', mods: { dmg: 80 } },
      { name: 'Twin Bond', desc: 'Summon a second companion.', mods: { maxSummons: 1 } },
    ],
  }),

  // ─────────────────────────── MAGE ───────────────────────────
  magic_missile: S({
    id: 'magic_missile', classId: 'mage', name: 'Magic Missile', kind: 'primary', unlock: 1, element: 'arcane',
    coef: 2.3, cost: 0, gen: 0, cooldown: 0, range: 480, radius: 0, duration: 0, maxSummons: 0,
    auto: { when: 'always' },
    desc: 'Launch a missile of arcane energy, dealing {coef} weapon damage as Arcane.',
    icon: { glyph: 'missile', color: 0xb388ff },
    runes: [
      { id: 'seeker', name: 'Seeker', desc: 'Missiles home in on enemies and deal 30% more damage.', mods: { dmg: 30, flags: ['homing'] } },
      { id: 'split', name: 'Split', desc: 'Fire 3 missiles that each deal 60% of the damage.', mods: { projectiles: 2, dmg: -40 } },
      { id: 'glacial_spike', name: 'Glacial Spike', desc: 'Deals Cold damage and has a 15% chance to freeze for 1 second.', mods: { element: 'cold', flags: ['freezeChance'] } },
    ],
    tiers: [
      { name: 'Focused Will', desc: '+20% Magic Missile damage.', mods: { dmg: 20 } },
      { name: 'Arcane Battery', desc: 'Each missile restores 2 Arcane Power.', mods: { gen: 2 } },
      { name: 'Echoing Bolt', desc: 'Fire an additional missile.', mods: { projectiles: 1 } },
    ],
  }),
  meteor: S({
    id: 'meteor', classId: 'mage', name: 'Meteor', kind: 'spender', unlock: 2, element: 'fire',
    coef: 7.4, cost: 40, gen: 0, cooldown: 0, range: 560, radius: 130, duration: 3, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 1, within: 540 },
    desc: 'Summon a meteor onto the densest pack. After a short delay it impacts for {coef} weapon damage as Fire and leaves molten ground that burns for 235% weapon damage over {duration} seconds.',
    icon: { glyph: 'meteor', color: 0xff7a1a },
    runes: [
      { id: 'star_pact', name: 'Star Pact', desc: 'Meteor costs 20 more Arcane Power but deals 70% more damage.', mods: { cost: 50, dmg: 70 } },
      { id: 'comet', name: 'Comet', desc: 'Deals Cold damage and freezes enemies hit for 1.5 seconds.', mods: { element: 'cold', flags: ['freeze'] } },
      { id: 'meteor_shower', name: 'Meteor Shower', desc: 'Summon 7 smaller meteors across the area, each dealing 37% of the damage.', mods: { flags: ['shower'] } },
    ],
    tiers: [
      { name: 'Heavier Stars', desc: '+25% Meteor damage.', mods: { dmg: 25 } },
      { name: 'Crater', desc: 'Impact radius +25%.', mods: { radius: 25 } },
      { name: 'Celestial Discount', desc: 'Costs 25% less Arcane Power.', mods: { cost: -25 } },
    ],
  }),
  black_hole: S({
    id: 'black_hole', classId: 'mage', name: 'Black Hole', kind: 'cooldown', unlock: 4, element: 'arcane',
    coef: 5.4, cost: 20, gen: 0, cooldown: 12, range: 520, radius: 220, duration: 2, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 4, within: 520 },
    desc: 'Tear open a black hole that pulls enemies within {radius} units to its centre and deals {coef} weapon damage as Arcane over {duration} seconds. Pairs perfectly with Meteor.',
    icon: { glyph: 'vortex', color: 0x8e44ad },
    runes: [
      { id: 'event_horizon', name: 'Event Horizon', desc: 'Pull radius increased by 40%.', mods: { radius: 40 } },
      { id: 'spellsteal', name: 'Spellsteal', desc: 'Gain 3% damage for 10 seconds per enemy caught.', mods: { flags: ['spellsteal'] } },
      { id: 'absolute_zero', name: 'Absolute Zero', desc: 'Deals Cold damage and freezes enemies when it collapses.', mods: { element: 'cold', flags: ['freeze'] } },
    ],
    tiers: [
      { name: 'Singularity', desc: '+30% Black Hole damage.', mods: { dmg: 30 } },
      { name: 'Short Orbit', desc: 'Cooldown reduced by 25%.', mods: { cooldown: -25 } },
      { name: 'Gravity Well', desc: 'Lasts 50% longer.', mods: { duration: 50 } },
    ],
  }),
  frost_nova: S({
    id: 'frost_nova', classId: 'mage', name: 'Frost Nova', kind: 'cooldown', unlock: 6, element: 'cold',
    coef: 1.75, cost: 0, gen: 0, cooldown: 11, range: 180, radius: 190, duration: 2, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 3, within: 170 },
    desc: 'Blast a ring of frost, dealing {coef} weapon damage as Cold and freezing nearby enemies for {duration} seconds.',
    icon: { glyph: 'snowflake', color: 0x7fd3ff },
    runes: [
      { id: 'shatter', name: 'Shatter', desc: 'Frozen enemies that die explode into another Frost Nova.', mods: { flags: ['shatterNova'] } },
      { id: 'bone_chill', name: 'Bone Chill', desc: 'Frozen enemies take 33% more damage.', mods: { flags: ['vulnerable'] } },
      { id: 'deep_freeze', name: 'Deep Freeze', desc: 'Gain 10% Critical Hit Chance for 11 seconds when 5+ enemies are frozen.', mods: { flags: ['deepFreeze'] } },
    ],
    tiers: [
      { name: 'Rime', desc: '+50% Frost Nova damage.', mods: { dmg: 50 } },
      { name: 'Glacial Pulse', desc: 'Cooldown reduced by 25%.', mods: { cooldown: -25 } },
      { name: 'Permafrost Ring', desc: 'Radius increased by 30%.', mods: { radius: 30 } },
    ],
  }),
  hydra: S({
    id: 'hydra', classId: 'mage', name: 'Hydra', kind: 'summon', unlock: 9, element: 'fire',
    coef: 2.8, cost: 15, gen: 0, cooldown: 0, range: 520, radius: 500, duration: 9, maxSummons: 1,
    auto: { when: 'maintainSummon' },
    desc: 'Summon a three-headed Hydra that spits fireballs for {coef} weapon damage per second as Fire. Lasts {duration} seconds.',
    icon: { glyph: 'hydra', color: 0xff5e3a },
    runes: [
      { id: 'arcane_hydra', name: 'Arcane Hydra', desc: 'Spits Arcane orbs that explode on impact.', mods: { element: 'arcane', flags: ['splash'] } },
      { id: 'frost_hydra', name: 'Frost Hydra', desc: 'Breathes cones of frost that chill enemies.', mods: { element: 'cold', flags: ['chill'] } },
      { id: 'mammoth_hydra', name: 'Mammoth Hydra', desc: 'A single massive Hydra breathes a river of fire, dealing 70% more damage.', mods: { dmg: 70, flags: ['mammoth'] } },
    ],
    tiers: [
      { name: 'Many Heads', desc: '+30% Hydra damage.', mods: { dmg: 30 } },
      { name: 'Longevity', desc: 'Hydra lasts 60% longer.', mods: { duration: 60 } },
      { name: 'Brood', desc: '+1 maximum Hydra.', mods: { maxSummons: 1 } },
    ],
  }),
  magic_weapon: S({
    id: 'magic_weapon', classId: 'mage', name: 'Magic Weapon', kind: 'buff', unlock: 12, element: 'arcane',
    coef: 0, cost: 25, gen: 0, cooldown: 0, range: 0, radius: 0, duration: 60, maxSummons: 0,
    auto: { when: 'maintainBuff' },
    desc: 'Imbue your weapon with arcane power, increasing damage by 10% for {duration} seconds. Recast automatically.',
    icon: { glyph: 'rune', color: 0x9b59b6 },
    runes: [
      { id: 'ignite', name: 'Ignite', desc: 'Your attacks burn enemies for 100% weapon damage over 3 seconds.', mods: { flags: ['igniteHits'] } },
      { id: 'electrify', name: 'Electrify', desc: 'Your attacks have a 25% chance to arc lightning to 3 enemies for 100% weapon damage.', mods: { flags: ['electrify'] } },
      { id: 'force_weapon', name: 'Force Weapon', desc: 'Increases the damage bonus to 20%.', mods: { flags: ['forceWeapon'] } },
    ],
    tiers: [
      { name: 'Lasting Glyph', desc: 'Lasts 50% longer.', mods: { duration: 50 } },
      { name: 'Free Glyph', desc: 'Costs no Arcane Power.', mods: { cost: -100 } },
      { name: 'Overcharge', desc: 'Grants an additional 5% damage.', mods: { flags: ['weaponExtra'] } },
    ],
  }),
};

export function skillsForClass(classId: ClassId): SkillDef[] {
  return Object.values(SKILLS).filter((s) => s.classId === classId).sort((a, b) => a.unlock - b.unlock);
}

export function runeUnlockLevel(skill: SkillDef, runeIndex: number): number {
  return skill.unlock + RUNE_UNLOCK_OFFSETS[runeIndex];
}

/** Merge rune + purchased tiers into a single mods object (legendary/set mods are merged by the server). */
export function collectSkillMods(skill: SkillDef, runeId: string | null | undefined, tiers: number): SkillMods {
  const out: SkillMods = { flags: [] };
  const add = (m: SkillMods) => {
    for (const k of ['dmg', 'radius', 'cost', 'cooldown', 'duration', 'projectiles', 'pierce', 'gen', 'maxSummons'] as const) {
      if (m[k] !== undefined) out[k] = (out[k] ?? 0) + (m[k] as number);
    }
    if (m.element) out.element = m.element;
    if (m.flags) out.flags!.push(...m.flags);
  };
  const rune = skill.runes.find((r) => r.id === runeId);
  if (rune) add(rune.mods);
  for (let i = 0; i < Math.min(tiers, skill.tiers.length); i++) add(skill.tiers[i].mods);
  return out;
}

export function mergeMods(a: SkillMods, b: SkillMods): SkillMods {
  const out: SkillMods = { ...a, flags: [...(a.flags ?? [])] };
  for (const k of ['dmg', 'radius', 'cost', 'cooldown', 'duration', 'projectiles', 'pierce', 'gen', 'maxSummons'] as const) {
    if (b[k] !== undefined) out[k] = (out[k] ?? 0) + (b[k] as number);
  }
  if (b.element) out.element = b.element;
  if (b.flags) out.flags!.push(...b.flags);
  return out;
}

/** Render a skill description with numbers filled in. */
export function describeSkill(skill: SkillDef, mods?: SkillMods): string {
  const m = mods ?? {};
  const coef = skill.coef * (1 + (m.dmg ?? 0) / 100);
  return skill.desc
    .replace('{coef}', `${Math.round(coef * 100)}%`)
    .replace('{gen}', String(skill.gen + (m.gen ?? 0)))
    .replace('{cost}', String(Math.round(skill.cost * (1 + (m.cost ?? 0) / 100))))
    .replace('{duration}', String(+(skill.duration * (1 + (m.duration ?? 0) / 100)).toFixed(1)))
    .replace('{radius}', String(Math.round(skill.radius * (1 + (m.radius ?? 0) / 100))))
    .replace('{max}', String(skill.maxSummons + (m.maxSummons ?? 0)));
}
