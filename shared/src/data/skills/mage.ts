// Mage skills (data only). Behaviour lives in server/src/sim/skills/mage*.ts; recipe in docs/rework/depth/FOUNDATION.md.
// Content: docs/rework/depth/MAGE.md (bible v2). Display names follow docs/rework/depth/NAMES.md (ids never change).
// Numbers marked in the bible as [M] are today's values; everything else is the bible's [P] proposal unless a comment says
// otherwise (docs/rework/depth/MAGE-PILOT.md lists every deviation). Node texts use {var:…} placeholders so the tree shows
// the cumulative value of the bought rank. Chills use the engine's chill (40 % slower movement and attacks [M]); stronger
// chills of the bible (Rimefield 50 %, Deep Chill 60 %) add an engine wave 3 slow for the movement difference
// (server mageKit.mChillAt); slows of a stated strength are the wave 3 `slow` status.

import type { NodeDef, SkillDef, TagQuery } from './types';
import type { PowerEffect } from '../../powers';

/** A node's "more damage" template as plain data (no import of the power builders: they import this registry). */
const more = (target: string[] | TagQuery, perRank: number, when: Extract<PowerEffect, { kind: 'skillMore' }>['when']): PowerEffect =>
  Array.isArray(target) ? { kind: 'skillMore', skills: target, pct: { roll: perRank }, when } : { kind: 'skillMore', tags: target, pct: { roll: perRank }, when };
const at = (col: number, row: number) => ({ col, row });
const needs = (node: string): NodeDef['requires'] => [{ node, rank: 2 }];
/** Three identical ranks of one var (plus optional fixed mods on rank one). */
const v3 = (name: string, a: number, b = a, c = b) => [{ vars: { [name]: a } }, { vars: { [name]: b } }, { vars: { [name]: c } }];

/**
 * Timing and geometry the server simulation and the client visuals must agree on. [P] every value (the bible gives
 * none) unless marked: needle speed = Magic Missile's 800 units/s [M]; stormglass orb 220 units/s for 2 s [bible];
 * Orrery orbit radius 130 [bible], one turn per 2 s [P] (Wide Orbit: 60 % wider, 20 % slower [bible]).
 */
export const MAGE_FX = {
  needleSpeed: 800, orbSpeed: 220, orbLifeMs: 2000,
  orreryRadius: 130, orreryPeriodMs: 2000, orreryWideRadius: 1.6, orreryWideSlow: 0.8,
  /** Thrumming Ray tick (channel strike every 250 ms, as Whirlwind and Ironplough [M]). */
  rayTickMs: 250,
} as const;

/** Order matters: it is the registry order (skill pickers, affix rolls), so append new skills at the end. */
export const MAGE_SKILLS: SkillDef[] = [
  {
    id: 'magic_missile', classId: 'mage', name: 'Magic Missile', kind: 'primary', unlock: 1, element: 'arcane', tags: ['projectile'], category: 'Bolts',
    coef: 2.53, cost: 0, gen: 0, cooldown: 0, range: 380, radius: 0, duration: 0, maxSummons: 0,
    auto: { when: 'always' },
    desc: 'Launch a missile of arcane energy, dealing {coef} weapon damage as Arcane.',
    icon: { glyph: 'missile', color: 0xb388ff },
    runes: [
      { id: 'seeker', name: 'Seeker', unlock: 3, desc: 'Missiles home in on enemies and deal 30% more damage.', mods: { dmg: 30, flags: ['homing'] } },
      { id: 'split', name: 'Split', unlock: 6, desc: 'Fire 3 missiles that each deal 60% of the damage.', mods: { projectiles: 2, dmg: -40 } },
      { id: 'glacial_spike', name: 'Frost Spike', unlock: 10, addTags: ['chill'], desc: 'Deals Cold damage and has a 15% chance to freeze for 1 second.', mods: { element: 'cold', flags: ['freezeChance'] } },
      { id: 'volley_of_glass', name: 'Volley of Glass', unlock: 15, desc: 'Missiles shatter on impact into 3 shards that fly on behind the target, each dealing 40% of the damage.', mods: { flags: ['missileShatter'] } },
      { id: 'static_thread', name: 'Static Thread', unlock: 21, addTags: ['piercing'], desc: 'Missiles deal Lightning damage and chain to 1 more enemy within 150 units for 70% of the damage.', mods: { element: 'lightning', flags: ['missileChain'] } },
    ],
    tiers: [
      { name: 'Focused Will', desc: '+20% Magic Missile damage.', mods: { dmg: 20 } },
      { name: 'Arcane Battery', desc: 'Each missile restores 2 Arcane Power.', mods: { gen: 2 } },
      { name: 'Echoing Bolt', desc: 'Fire an additional missile.', mods: { projectiles: 1 } },
    ],
    nodes: [
      { id: 'sharper_will', name: 'Sharper Will', text: 'Magic Missile deals {dmg}% increased damage.', maxRank: 3, ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: at(0, 0) },
      { id: 'echo_cast', name: 'Echo Cast', text: 'Each cast has a {var:missileEcho}% chance to fire a free extra missile at another enemy.', maxRank: 3, ranks: v3('missileEcho', 10), pos: at(1, 0) },
      { id: 'tracking_glyph', name: 'Tracking Glyph', text: 'Missiles curve toward their target (turn rate {var:missileTurn}), even without Seeker.', maxRank: 3, ranks: v3('missileTurn', 2, 1, 1), pos: at(2, 0) },
      { id: 'piercing_will', name: 'Piercing Will', text: 'Missiles pierce one enemy after the first hit, dealing {var:pierceWill}% damage to the second.', maxRank: 3,
        ranks: v3('pierceWill', 30, 20, 20), requires: needs('sharper_will'), pos: at(0, 1) },
      { id: 'overflow', name: 'Overflow', text: 'While your Arcane Power is full, missiles deal {var:overflow}% more damage.', maxRank: 3, ranks: v3('overflow', 15), requires: needs('echo_cast'), pos: at(1, 1) },
      { id: 'void_bolt', name: 'Void Bolt', text: 'Missiles hitting an enemy inside a Black Hole burst for {var:voidBolt}% of their damage to enemies within 60 units.', maxRank: 3,
        ranks: v3('voidBolt', 30, 20, 20), requires: needs('tracking_glyph'), pos: at(2, 1) },
    ],
  },
  {
    id: 'meteor', classId: 'mage', name: 'Meteor', kind: 'spender', unlock: 2, element: 'fire', tags: ['aerial', 'area', 'ground', 'burn'], category: 'Celestial',
    coef: 5.55, cost: 40, gen: 0, cooldown: 0, range: 380, radius: 130, duration: 3, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 1, within: 380 },
    desc: 'Summon a meteor onto the densest pack. After a short delay it impacts for {coef} weapon damage as Fire and leaves molten ground that burns for 235% weapon damage over {duration} seconds.',
    icon: { glyph: 'meteor', color: 0xff7a1a },
    runes: [
      { id: 'star_pact', name: 'Heavy Sky', unlock: 4, desc: 'Meteor costs 20 more Arcane Power but deals 70% more damage.', mods: { cost: 50, dmg: 70 } },
      { id: 'comet', name: 'Comet', unlock: 7, addTags: ['chill'], removeTags: ['burn'], desc: 'Deals Cold damage and freezes enemies hit for 1.5 seconds.', mods: { element: 'cold', flags: ['freeze'] } },
      { id: 'meteor_shower', name: 'Meteor Shower', unlock: 11, desc: 'Summon 7 smaller meteors across the area, each dealing 37% of the damage.', mods: { flags: ['shower'] } },
      { id: 'ember_tail', name: 'Ember Tail', unlock: 16, desc: 'The meteor streaks in low and leaves a line of molten ground along its path.', mods: { flags: ['meteorTrail'] } },
      { id: 'lodestone', name: 'Lodestone', unlock: 22, addTags: ['displace'], desc: 'Before impact, enemies within 1.5 times the radius are pulled to the centre.', mods: { flags: ['meteorPull'] } },
    ],
    tiers: [
      { name: 'Heavier Stars', desc: '+25% Meteor damage.', mods: { dmg: 25 } },
      { name: 'Crater', desc: 'Impact radius +25%.', mods: { radius: 25 } },
      { name: 'Celestial Discount', desc: 'Costs 25% less Arcane Power.', mods: { cost: -25 } },
    ],
    nodes: [
      { id: 'wide_crater', name: 'Wide Crater', text: 'Meteor’s radius is {radius}% larger.', maxRank: 3, ranks: [{ radius: 8 }, { radius: 8 }, { radius: 8 }], pos: at(0, 0) },
      { id: 'afterburn', name: 'Afterburn', text: 'Enemies leaving molten ground keep burning for {var:afterburn} seconds.', maxRank: 3, ranks: v3('afterburn', 1), pos: at(1, 0) },
      { id: 'starseeker', name: 'Starseeker', text: 'Meteor targets the elite with the most Life in range (instead of the densest pack) and deals {var:starseeker}% more damage to it.', maxRank: 3,
        ranks: v3('starseeker', 10), pos: at(2, 0) },
      { id: 'shockwave', name: 'Shockwave', text: 'The impact pushes enemies {var:meteorKnock} units outward.', maxRank: 3, ranks: v3('meteorKnock', 20), requires: needs('wide_crater'), pos: at(0, 1) },
      { id: 'arcane_fuel', name: 'Arcane Fuel', text: 'Meteor refunds {var:meteorRefund} Arcane Power when it hits 4 or more enemies.', maxRank: 3, ranks: v3('meteorRefund', 5), requires: needs('afterburn'), pos: at(1, 1) },
      { id: 'fragmenting_star', name: 'Fragmenting Star', text: 'The impact throws {var:fragments} burning fragments at nearby enemies, each dealing 50% of the impact within 40 units.', maxRank: 3,
        ranks: v3('fragments', 2, 1, 1), requires: needs('starseeker'), pos: at(2, 1) },
    ],
  },
  {
    id: 'black_hole', classId: 'mage', name: 'Black Hole', kind: 'cooldown', unlock: 4, element: 'arcane', tags: ['area', 'ground', 'displace'], category: 'Void and Storm',
    coef: 5.83, cost: 20, gen: 0, cooldown: 12, range: 380, radius: 220, duration: 2, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 4, within: 380 },
    // ITEMS-SHARED.md §0 rule 1: the old "Pairs perfectly with Meteor." recommended a combination; texts describe mechanics only.
    desc: 'Tear open a black hole that pulls enemies within {radius} units to its centre and deals {coef} weapon damage as Arcane over {duration} seconds.',
    icon: { glyph: 'vortex', color: 0x8e44ad },
    runes: [
      { id: 'event_horizon', name: 'Event Horizon', unlock: 6, desc: 'Pull radius increased by 40%.', mods: { radius: 40 } },
      { id: 'spellsteal', name: 'Starve the Light', unlock: 9, desc: 'Gain 3% damage for 10 seconds per enemy caught.', mods: { flags: ['spellsteal'] } },
      { id: 'absolute_zero', name: 'Absolute Zero', unlock: 13, addTags: ['chill'], desc: 'Deals Cold damage and freezes enemies when it collapses.', mods: { element: 'cold', flags: ['freeze'] } },
      { id: 'wandering_void', name: 'Wandering Void', unlock: 18, desc: 'The Black Hole drifts toward the densest enemies at 80 units per second and lasts 50% longer.', mods: { duration: 50, flags: ['holeDrift'] } },
      { id: 'collapse_bloom', name: 'Collapse Bloom', unlock: 24, desc: 'When it collapses, it releases a ring of 8 arcane bolts that deal 80% weapon damage each.', mods: { flags: ['holeBolts'] } },
    ],
    tiers: [
      { name: 'Singularity', desc: '+30% Black Hole damage.', mods: { dmg: 30 } },
      { name: 'Short Orbit', desc: 'Cooldown reduced by 25%.', mods: { cooldown: -25 } },
      { name: 'Gravity Well', desc: 'Lasts 50% longer.', mods: { duration: 50 } },
    ],
    nodes: [
      { id: 'event_rim', name: 'Event Rim', text: 'Black Hole’s radius is {radius}% larger.', maxRank: 3, ranks: [{ radius: 8 }, { radius: 8 }, { radius: 8 }], pos: at(0, 0) },
      { id: 'siphoning_void', name: 'Siphoning Void', text: 'Each enemy the Black Hole catches restores {var:holeGen} Arcane Power (at most 15 per cast).', maxRank: 3, ranks: v3('holeGen', 1), pos: at(1, 0) },
      { id: 'crushing_core', name: 'Crushing Core', text: 'Enemies in the inner 40% of the Black Hole take {var:holeCore}% more damage from it.', maxRank: 3, ranks: v3('holeCore', 15), pos: at(2, 0) },
      { id: 'lingering_pull', name: 'Lingering Pull', text: 'After the Black Hole collapses, enemies within it stay slowed by {var:holeSlow}% for 2 seconds.', maxRank: 3,
        ranks: v3('holeSlow', 20, 15, 15), requires: needs('event_rim'), pos: at(0, 1) },
      // Cooldown −1 / 2 / 3 s of the 12 s base = −8.33 % per rank (cooldowns are additive %).
      { id: 'quick_collapse', name: 'Quick Collapse', text: 'The Black Hole lasts 30% shorter but deals the same total damage, and its cooldown is {var:holeQuickCd} seconds shorter.', maxRank: 3,
        ranks: [{ duration: -30, cooldown: -100 / 12, flags: ['holeQuick'], vars: { holeQuickCd: 1 } }, { cooldown: -100 / 12, vars: { holeQuickCd: 1 } }, { cooldown: -100 / 12, vars: { holeQuickCd: 1 } }],
        requires: needs('siphoning_void'), pos: at(1, 1) },
      { id: 'twin_singularity', name: 'Twin Singularity', text: 'Each cast has a {var:holeTwin}% chance to open a second, half-size Black Hole on another pack.', maxRank: 3,
        ranks: v3('holeTwin', 15), requires: needs('crushing_core'), pos: at(2, 1) },
    ],
  },
  {
    id: 'frost_nova', classId: 'mage', name: 'Frost Nova', kind: 'cooldown', unlock: 6, element: 'cold', tags: ['area', 'chill'], category: 'Frost',
    coef: 2.5, cost: 0, gen: 0, cooldown: 11, range: 180, radius: 190, duration: 2, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 3, within: 170 },
    desc: 'Blast a ring of frost, dealing {coef} weapon damage as Cold and freezing nearby enemies for {duration} seconds.',
    icon: { glyph: 'snowflake', color: 0x7fd3ff },
    runes: [
      { id: 'shatter', name: 'Shatter', unlock: 8, desc: 'Frozen enemies that die explode into another Frost Nova.', mods: { flags: ['shatterNova'] } },
      { id: 'bone_chill', name: 'Marrow Cold', unlock: 11, desc: 'Frozen enemies take 33% more damage.', mods: { flags: ['vulnerable'] } },
      { id: 'deep_freeze', name: 'Deep Freeze', unlock: 15, desc: 'Gain 10% Critical Hit Chance for 11 seconds when 5+ enemies are frozen.', mods: { flags: ['deepFreeze'] } },
      { id: 'mirror_frost', name: 'Mirror Frost', unlock: 20, desc: 'A second nova goes off at your position 1.5 seconds later, freezing for half as long.', mods: { flags: ['novaEcho'] } },
      { id: 'cold_front', name: 'Cold Front', unlock: 26, desc: 'Frost Nova becomes a 120° wave that reaches 300 units toward the densest pack.', mods: { flags: ['novaCone'] } },
    ],
    tiers: [
      { name: 'Rime', desc: '+50% Frost Nova damage.', mods: { dmg: 50 } },
      { name: 'Glacial Pulse', desc: 'Cooldown reduced by 25%.', mods: { cooldown: -25 } },
      { name: 'Permafrost Ring', desc: 'Radius increased by 30%.', mods: { radius: 30 } },
    ],
    nodes: [
      { id: 'wider_ring', name: 'Wider Ring', text: 'Frost Nova’s radius is {radius}% larger.', maxRank: 3, ranks: [{ radius: 8 }, { radius: 8 }, { radius: 8 }], pos: at(0, 0) },
      { id: 'brittle', name: 'Brittle', text: 'You gain {var:novaBrittle}% Critical Hit Chance against frozen enemies.', maxRank: 3, ranks: v3('novaBrittle', 5), pos: at(1, 0) },
      // Bible: "when an enemy hits you in melee"; hits carry no melee / ranged flag to class code, so a hit while an enemy
      // is within 140 units (melee reach of the biggest monsters + their radius [P]) counts.
      { id: 'retort_of_frost', name: 'Retort of Frost', text: 'When you are hit while an enemy is within 140 units, Frost Nova goes off for free (at most once every {var:novaReflex} seconds).', maxRank: 3,
        ranks: v3('novaReflex', 20, -5, -5), pos: at(2, 0) },
      { id: 'lingering_cold', name: 'Lingering Cold', text: 'After the freeze ends, enemies stay chilled for {var:novaChillAfter} seconds.', maxRank: 3, ranks: v3('novaChillAfter', 2, 1, 1), requires: needs('wider_ring'), pos: at(0, 1) },
      { id: 'cold_return', name: 'Cold Return', text: 'Each enemy Frost Nova freezes reduces its cooldown by {var:novaRefund} seconds (at most 3 seconds per cast).', maxRank: 3,
        ranks: v3('novaRefund', 0.2), requires: needs('brittle'), pos: at(1, 1) },
      { id: 'glacial_burst', name: 'Glacial Burst', text: 'Frost Nova deals {var:novaChilledBonus}% more damage to enemies that were already chilled.', maxRank: 3,
        ranks: v3('novaChilledBonus', 40), requires: needs('retort_of_frost'), pos: at(2, 1) },
    ],
  },
  {
    id: 'hydra', classId: 'mage', name: 'Hydra', kind: 'summon', unlock: 9, element: 'fire', tags: ['projectile'], category: 'Conjuring',
    coef: 2.17, cost: 15, gen: 0, cooldown: 0, range: 380, radius: 380, duration: 9, maxSummons: 1,
    auto: { when: 'maintainSummon' },
    desc: 'Summon a Hydra that attacks for {coef} weapon damage per second as {element}. Lasts {duration} seconds.',
    icon: { glyph: 'hydra', color: 0xff5e3a },
    runes: [
      { id: 'arcane_hydra', name: 'Arcane Spit', unlock: 11, desc: 'Spits Arcane orbs that explode on impact.', mods: { element: 'arcane', flags: ['splash'] } },
      { id: 'frost_hydra', name: 'Frost Spit', unlock: 14, addTags: ['chill'], desc: 'Fires shards of ice that chill enemies.', mods: { element: 'cold', flags: ['chill'] } },
      { id: 'mammoth_hydra', name: 'Elder Hydra', unlock: 18, desc: 'A single massive Hydra breathes a river of fire, dealing 70% more damage.', mods: { dmg: 70, flags: ['mammoth'] } },
      { id: 'serpent_coil', name: 'Serpent Coil', unlock: 23, desc: 'The Hydra follows you at 80 units, but attacks 15% slower.', mods: { flags: ['hydraFollow'] } },
      { id: 'forked_tongues', name: 'Forked Tongues', unlock: 29, addTags: ['piercing'], desc: 'Lightning damage; each head’s shot chains to 2 more enemies for 60% of the damage.', mods: { element: 'lightning', flags: ['hydraChain'] } },
    ],
    tiers: [
      { name: 'Many Heads', desc: '+30% Hydra damage.', mods: { dmg: 30 } },
      { name: 'Longevity', desc: 'Hydra lasts 60% longer.', mods: { duration: 60 } },
      { name: 'Brood', desc: '+1 maximum Hydra.', mods: { maxSummons: 1 } },
    ],
    nodes: [
      { id: 'more_heads', name: 'More Heads', text: 'Hydra deals {dmg}% increased damage.', maxRank: 3, ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: at(0, 0) },
      { id: 'brood_hunger', name: 'Brood Hunger', text: 'Each enemy a Hydra kills restores {var:hydraGen} Arcane Power.', maxRank: 3, ranks: v3('hydraGen', 1), pos: at(1, 0) },
      { id: 'split_heads', name: 'Split Heads', text: 'Each head picks a different target when it can, and Hydra deals {dmg}% increased damage.', maxRank: 3,
        ranks: [{ dmg: 5, flags: ['hydraSplit'] }, { dmg: 5 }, { dmg: 5 }], pos: at(2, 0) },
      { id: 'heat_shimmer', name: 'Heat Shimmer', text: 'Enemies hit by 3 Hydra shots within 1 second burn for {var:hydraIgnite}% weapon damage over 2 seconds.', maxRank: 3,
        ranks: v3('hydraIgnite', 30), requires: needs('more_heads'), pos: at(0, 1) },
      { id: 'last_breath', name: 'Last Breath', text: 'An expiring Hydra exhales a cone of fire that deals {var:hydraFinale}% weapon damage.', maxRank: 3,
        ranks: v3('hydraFinale', 200, 100, 100), requires: needs('brood_hunger'), pos: at(1, 1) },
      { id: 'guardian_coil', name: 'Guardian Coil', text: 'While one of your Hydras is within 100 units of you, you take {var:hydraGuard}% less damage.', maxRank: 3,
        ranks: v3('hydraGuard', 5), requires: needs('split_heads'), pos: at(2, 1) },
    ],
  },
  {
    id: 'magic_weapon', classId: 'mage', name: 'Magic Weapon', kind: 'buff', unlock: 12, element: 'arcane', category: 'Conjuring',
    coef: 0, cost: 25, gen: 0, cooldown: 0, range: 0, radius: 0, duration: 60, maxSummons: 0,
    auto: { when: 'maintainBuff' },
    desc: 'Imbue your weapon with arcane power, increasing damage by {buffDamage} for {duration} seconds. Recast automatically.',
    icon: { glyph: 'rune', color: 0x9b59b6 },
    runes: [
      { id: 'ignite', name: 'Ignite', unlock: 14, addTags: ['burn'], desc: 'Your attacks burn enemies for 100% weapon damage over 3 seconds.', mods: { flags: ['igniteHits'] } },
      { id: 'electrify', name: 'Electrify', unlock: 17, desc: 'Your attacks have a 25% chance to arc lightning to 3 enemies for 100% weapon damage.', mods: { flags: ['electrify'] } },
      { id: 'force_weapon', name: 'Deep Glyph', unlock: 21, desc: 'Increases the damage bonus to 20%.', mods: { flags: ['forceWeapon'] } },
      { id: 'chilling_edge', name: 'Chilling Edge', unlock: 26, addTags: ['chill'], desc: 'Your primary attacks have a 15% chance to freeze enemies for 0.5 seconds.', mods: { flags: ['weaponFrost'] } },
      { id: 'arcane_ward', name: 'Arcane Ward', unlock: 32, desc: 'While Magic Weapon is active you take 15% less damage, but its damage bonus is halved.', mods: { flags: ['weaponWard'] },
        effects: [{ kind: 'damageTaken', pct: -15, when: { buff: 'magic_weapon' } }] },
    ],
    tiers: [
      { name: 'Lasting Glyph', desc: 'Lasts 50% longer.', mods: { duration: 50 } },
      { name: 'Free Glyph', desc: 'Costs no Arcane Power.', mods: { cost: -100 } },
      { name: 'Overcharge', desc: 'Grants an additional 5% damage.', mods: { flags: ['weaponExtra'] } },
    ],
    nodes: [
      // +10 s per rank on the 60 s base = +16.67 % duration.
      { id: 'long_inscription', name: 'Long Inscription', text: 'Magic Weapon lasts {var:longInscription} seconds longer.', maxRank: 3,
        ranks: [{ duration: 100 / 6, vars: { longInscription: 10 } }, { duration: 100 / 6, vars: { longInscription: 10 } }, { duration: 100 / 6, vars: { longInscription: 10 } }], pos: at(0, 0) },
      { id: 'spellblade', name: 'Spellblade', text: 'While Magic Weapon is active, your Primary skills deal {var:weaponPrimary}% more damage.', maxRank: 3,
        ranks: v3('weaponPrimary', 10), pos: at(1, 0), effects: [more({ anyOf: ['primary'] }, 10, { buff: 'magic_weapon' })] },
      { id: 'arcane_recharge', name: 'Arcane Recharge', text: 'Casting Magic Weapon restores {var:weaponRefill} Arcane Power.', maxRank: 3, ranks: v3('weaponRefill', 10), pos: at(2, 0) },
      { id: 'splash_glyph', name: 'Splash Glyph', text: 'While Magic Weapon is active, your primary hits have a {var:weaponSplash}% chance to deal 50% of the hit to enemies within 60 units.', maxRank: 3,
        ranks: v3('weaponSplash', 10), requires: needs('long_inscription'), pos: at(0, 1) },
      { id: 'rune_echo', name: 'Rune Echo', text: 'Magic Weapon’s rune effect (Ignite, Electrify, Chilling Edge) triggers {var:weaponProc}% more often.', maxRank: 3,
        ranks: v3('weaponProc', 25), requires: needs('spellblade'), pos: at(1, 1) },
      { id: 'bound_glyph', name: 'Bound Glyph', text: 'Magic Weapon’s rune effect (Ignite, Electrify, Chilling Edge) also triggers from your Summons’ hits at {var:weaponSummonProc}% of the normal rate.', maxRank: 3,
        ranks: v3('weaponSummonProc', 30, 20, 20), requires: needs('arcane_recharge'), pos: at(2, 1) },
    ],
  },
  // ─────────────────────────── M1 skills (bible M7–M12) ───────────────────────────
  {
    // Bible M7. Freeze build-up: each needle adds 100/6 points to the target inside a 2 s window (status freezeBuild).
    id: 'rime_needles', classId: 'mage', parityReady: true, name: 'Rime Needles', kind: 'primary', unlock: 16, element: 'cold', tags: ['projectile', 'chill'], category: 'Bolts',
    coef: 3.13, cost: 0, gen: 0, cooldown: 0, range: 340, radius: 0, duration: 0.75, maxSummons: 0,
    auto: { when: 'always' },
    desc: 'Fire three needles of rime for {coef} weapon damage each as Cold, chilling enemies. Six needles in two seconds freeze an enemy for {duration} seconds.',
    icon: { glyph: 'needle', color: 0x9fdcff },
    runes: [
      { id: 'icicle_fan', name: 'Icicle Fan', unlock: 18, desc: 'Fire five needles in a 30° fan, each dealing 25% less damage.', mods: { projectiles: 2, dmg: -25 } },
      { id: 'shiver_splinter', name: 'Shiver Splinter', unlock: 21, desc: 'Needles hitting a frozen enemy shatter into 2 splinters that seek nearby enemies for 50% of the damage.', mods: { flags: ['needleSplinter'] } },
      { id: 'arcane_thorns', name: 'Arcane Thorns', unlock: 25, addTags: ['piercing'], removeTags: ['chill'], desc: 'Arcane damage; needles pierce one enemy, but no longer chill or freeze.', mods: { element: 'arcane', flags: ['needlePierce'] } },
      // Bible: "Chill 60%; four needles freeze" (the chill plus a movement slow: mageKit.mChillAt).
      { id: 'deep_chill', name: 'Deep Chill', unlock: 30, desc: 'Needles chill enemies by 60%, and four needles in two seconds freeze an enemy instead of six.', mods: { flags: ['needleDeepChill'] } },
      // Bible text: "twice the damage of a needle trio"; its mods (one needle, +100 %) give twice a needle's damage.
      { id: 'glacier_spine', name: 'Glacier Spine', unlock: 36, desc: 'Fire one large needle that deals twice a needle’s damage, pierces every enemy and pushes them back 20 units.', mods: { projectiles: -2, dmg: 100, flags: ['needleSpine'] } },
    ],
    // Tiers patterned on Magic Missile's [M] (the bible authors none): damage, resource per volley, one more needle.
    tiers: [
      { name: 'Keen Rime', desc: '+20% Rime Needles damage.', mods: { dmg: 20 } },
      { name: 'Cold Battery', desc: 'Each volley restores 2 Arcane Power.', mods: { gen: 2 } },
      { name: 'Wider Fan', desc: 'Fire an additional needle.', mods: { projectiles: 1 } },
    ],
    nodes: [
      { id: 'sharper_ice', name: 'Sharper Ice', text: 'Rime Needles deals {dmg}% increased damage.', maxRank: 3, ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: at(0, 0) },
      { id: 'converging_fan', name: 'Converging Fan', text: 'Against a target within {var:needleConverge} units the needles converge, so all of them strike it.', maxRank: 3,
        ranks: v3('needleConverge', 200, -40, -40), pos: at(1, 0) },
      { id: 'cold_capacitor', name: 'Cold Capacitor', text: 'Freezing an enemy with Rime Needles restores {var:needleGen} Arcane Power.', maxRank: 3, ranks: v3('needleGen', 3), pos: at(2, 0) },
      { id: 'splitting_ice', name: 'Splitting Ice', text: 'Needles that kill split into 2 needles that deal {var:needleSplitKill}% of the damage.', maxRank: 3,
        ranks: v3('needleSplitKill', 50, 25, 25), requires: needs('sharper_ice'), pos: at(0, 1) },
      // "Debuff field shared with Concussion": the engine's weaken status.
      { id: 'snowblind', name: 'Snowblind', text: 'Enemies you chill deal {var:needleWeaken}% less damage while chilled.', maxRank: 3, ranks: v3('needleWeaken', 5), requires: needs('converging_fan'), pos: at(1, 1) },
      { id: 'deep_winter', name: 'Deep Winter', text: 'The freeze needs {var:needleThreshold} fewer needles.', maxRank: 3, ranks: v3('needleThreshold', 1), requires: needs('cold_capacitor'), pos: at(2, 1) },
    ],
  },
  {
    // Bible M8. Resonance ramps linearly from 1× to 2.5× over 2 s of continuous channelling.
    id: 'thrumming_ray', classId: 'mage', name: 'Thrumming Ray', kind: 'channel', unlock: 20, element: 'arcane', tags: ['spender', 'piercing'], category: 'Void and Storm',
    coef: 8, cost: 12, gen: 0, cooldown: 0, range: 380, radius: 30, duration: 0, maxSummons: 0,
    auto: { when: 'channel', startAt: 30, within: 380 },
    desc: 'Channel a thrumming ray that pierces every enemy in a line, dealing {coef} weapon damage per second as Arcane, rising to two and a half times as the note steadies. You move at 40% speed while channelling. Costs {cost} Arcane Power per second.',
    icon: { glyph: 'ray', color: 0xa07cff },
    // Bible M8: the mage moves at 40 % speed while channelling (powerActions.channelMoveFactor reads vars.channelMovePct).
    vars: { channelMovePct: -60 },
    runes: [
      { id: 'frostline', name: 'Frostline', unlock: 22, addTags: ['chill'], desc: 'Cold damage; the beam chills, and enemies held in it for 2 seconds straight freeze for 1.5 seconds.', mods: { element: 'cold', flags: ['rayFreeze'] } },
      { id: 'forked_signal', name: 'Forked Signal', unlock: 25, desc: 'Fire two beams 20° apart, each dealing 60% of the damage.', mods: { flags: ['rayFork'] } },
      { id: 'searing_thread', name: 'Searing Thread', unlock: 29, addTags: ['burn'], desc: 'Fire damage; enemies burn for 30% of the beam’s damage over 2 seconds, but resonance builds 30% slower.', mods: { element: 'fire', flags: ['rayBurn'] } },
      { id: 'steady_note', name: 'Steady Note', unlock: 34, desc: 'You move at 70% speed while channelling, but resonance tops out at twice the damage instead of two and a half times.', mods: { flags: ['rayMobile'], vars: { channelMovePct: 30 } } },
      { id: 'feedback_loop', name: 'Feedback Loop', unlock: 40, desc: 'At full resonance the beam restores 4 Arcane Power per second.', mods: { flags: ['rayRefund'] } },
    ],
    // Tiers patterned on the channel tiers [M] (Whirlwind / Ironplough): damage, cost, reach.
    tiers: [
      { name: 'Clear Tone', desc: '+25% Thrumming Ray damage.', mods: { dmg: 25 } },
      { name: 'Thrifty Hum', desc: 'Costs 20% less Arcane Power.', mods: { cost: -20 } },
      { name: 'Far Reach', desc: 'The beam reaches 25% farther.', mods: { vars: { rayReach: 25 } } },
    ],
    nodes: [
      { id: 'brighter_beam', name: 'Brighter Beam', text: 'Thrumming Ray deals {dmg}% increased damage.', maxRank: 3, ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: at(0, 0) },
      { id: 'strike_the_note', name: 'Strike the Note', text: 'A beam that starts on an enemy you damaged in the last 2 seconds starts at {var:rayHeadStart}% resonance.', maxRank: 3,
        ranks: v3('rayHeadStart', 20, 15, 15), pos: at(1, 0) },
      { id: 'harmonic', name: 'Harmonic', text: 'Each second at full resonance a pulse runs along the beam, dealing {var:rayPulse}% weapon damage to enemies within 50 units of it.', maxRank: 3,
        ranks: v3('rayPulse', 60, 30, 30), pos: at(2, 0) },
      { id: 'sustained_note', name: 'Sustained Note', text: 'After you stop, the resonance is kept for {var:rayKeep} seconds.', maxRank: 3, ranks: v3('rayKeep', 1, 0.5, 0.5), requires: needs('brighter_beam'), pos: at(0, 1) },
      { id: 'low_hum', name: 'Low Hum', text: 'The ray costs {var:rayThrift} less Arcane Power per second for each enemy it pierces (at least 4 per second).', maxRank: 3,
        ranks: v3('rayThrift', 1), requires: needs('strike_the_note'), pos: at(1, 1) },
      { id: 'overtone', name: 'Overtone', text: 'Enemies held in the beam for 2 seconds take {var:rayExpose}% more damage from your other skills for 3 seconds.', maxRank: 3,
        ranks: v3('rayExpose', 10), requires: needs('harmonic'), pos: at(2, 1) },
    ],
  },
  {
    // Bible M9. Up to three small fire spirits that run into melee; each bursts for 200 % within 80 when its time ends.
    id: 'cinderkin', classId: 'mage', name: 'Cinderkin', kind: 'summon', unlock: 26, element: 'fire', tags: ['area', 'burn'], category: 'Conjuring',
    coef: 3.16, cost: 20, gen: 0, cooldown: 0, range: 380, radius: 80, duration: 15, maxSummons: 3,
    auto: { when: 'maintainSummon' },
    desc: 'Coax up to {max} cinderkin out of the coals. Each claws enemies for {coef} weapon damage per second as {element} for {duration} seconds, then bursts for 200% weapon damage.',
    icon: { glyph: 'ember_kin', color: 0xff8a3d },
    runes: [
      { id: 'bonfire_kin', name: 'Bonfire Kin', unlock: 28, desc: 'One large kin that lives 30 seconds, deals three times the damage and bursts over 160 units.', mods: { flags: ['kinBig'] } },
      { id: 'frostkin', name: 'Frostkin', unlock: 31, addTags: ['chill'], removeTags: ['burn'], desc: 'Cold damage; kin chill the enemies they hit, and their bursts freeze for 1 second.', mods: { element: 'cold', flags: ['kinFrost'] } },
      { id: 'lanternkin', name: 'Lanternkin', unlock: 35, addTags: ['projectile'], desc: 'Kin stay at your side, and each throws a firebolt every second for 80% weapon damage (range 300).', mods: { flags: ['kinRanged'] } },
      { id: 'eager_kin', name: 'Eager Kin', unlock: 40, desc: 'Kin burst on their first hit for 200% more damage, and are summoned again at once for 8 Arcane Power each.', mods: { flags: ['kinKamikaze'] } },
      { id: 'hearth_kin', name: 'Hearth Kin', unlock: 46, desc: 'Each living kin gives you 3% damage reduction and heals you for 0.5% of your maximum Life per second.', mods: { flags: ['kinHearth'] } },
    ],
    // Tiers patterned on Hydra's [M]: damage, duration, one more summon.
    tiers: [
      { name: 'Hotter Coals', desc: '+30% Cinderkin damage.', mods: { dmg: 30 } },
      { name: 'Slow Embers', desc: 'Cinderkin last 60% longer.', mods: { duration: 60 } },
      { name: 'Kin Brood', desc: '+1 maximum Cinderkin.', mods: { maxSummons: 1 } },
    ],
    nodes: [
      { id: 'brighter_embers', name: 'Brighter Embers', text: 'Cinderkin deal {dmg}% increased damage.', maxRank: 3, ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: at(0, 0) },
      { id: 'self_kindling', name: 'Self-Kindling', text: 'When a kin bursts, there is a {var:kinRekindle}% chance a replacement appears for free.', maxRank: 3, ranks: v3('kinRekindle', 20, 15, 15), pos: at(1, 0) },
      { id: 'sparkstep', name: 'Sparkstep', text: 'Kin leave burning sparks where they run that deal {var:kinTrail}% weapon damage per second.', maxRank: 3, ranks: v3('kinTrail', 20, 15, 15), pos: at(2, 0) },
      { id: 'kin_pile', name: 'Kin Pile', text: 'A kin bursting within 80 units of other kin sets them off too, and those bursts deal {var:kinChain}% more damage.', maxRank: 3,
        ranks: v3('kinChain', 20), requires: needs('brighter_embers'), pos: at(0, 1) },
      { id: 'kin_tithe', name: 'Kin Tithe', text: 'A burst that hits 3 or more enemies restores {var:kinGen} Arcane Power.', maxRank: 3, ranks: v3('kinGen', 3), requires: needs('self_kindling'), pos: at(1, 1) },
      { id: 'hearth_bond', name: 'Hearth Bond', text: 'When kin arrive, enemies within 120 units turn on them for {var:kinTaunt} seconds.', maxRank: 3, ranks: v3('kinTaunt', 1), requires: needs('sparkstep'), pos: at(2, 1) },
    ],
  },
  {
    // Bible M10. A field at the best point: ticks every 0.5 s for coef / 12, chills inside, and freezes an enemy that
    // stays 1.5 s straight (once per enemy per field). Class code with a footprint ground ('rime_ground').
    id: 'rimefield', classId: 'mage', name: 'Rimefield', kind: 'cooldown', unlock: 32, element: 'cold', tags: ['area', 'ground', 'chill'], category: 'Frost',
    coef: 6, cost: 25, gen: 0, cooldown: 15, range: 380, radius: 200, duration: 6, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 4, within: 380 },
    desc: 'Spread a field of rime for {duration} seconds that deals {coef} weapon damage as Cold over its duration, chills enemies inside, and freezes those that stay for 1.5 seconds.',
    icon: { glyph: 'rime', color: 0xbfe9ff },
    runes: [
      { id: 'brittle_ground', name: 'Brittle Ground', unlock: 34, desc: 'Enemies in the field take 15% more damage from all your sources.', mods: { flags: ['rimeVuln'] } },
      { id: 'frost_bloom', name: 'Frost Bloom', unlock: 37, desc: 'The field shrinks to a radius of 60 units over its duration, drags frozen enemies inward, and its damage rises to 50% more by the end.', mods: { flags: ['rimeContract'] } },
      { id: 'static_frost', name: 'Static Frost', unlock: 41, removeTags: ['chill'], desc: 'Lightning damage; instead of chilling and freezing, the field zaps 2 enemies every 0.5 seconds for 100% weapon damage each.', mods: { element: 'lightning', flags: ['rimeStatic'] } },
      { id: 'wandering_rime', name: 'Wandering Rime', unlock: 46, desc: 'The field follows you, but its radius is 30% smaller.', mods: { radius: -30, flags: ['rimeFollow'] } },
      { id: 'permafrost_seal', name: 'Permafrost Seal', unlock: 52, desc: 'Its freeze lasts 3 seconds, but an enemy can be frozen by it only once every 10 seconds.', mods: { flags: ['rimeLongFreeze'] } },
    ],
    // Tiers patterned on Black Hole / Frost Nova [M]: damage, cooldown, radius.
    tiers: [
      { name: 'Hard Rime', desc: '+30% Rimefield damage.', mods: { dmg: 30 } },
      { name: 'Quick Frost', desc: 'Cooldown reduced by 25%.', mods: { cooldown: -25 } },
      { name: 'Spreading Frost', desc: 'Radius increased by 30%.', mods: { radius: 30 } },
    ],
    nodes: [
      { id: 'wide_frost', name: 'Wide Frost', text: 'Rimefield’s radius is {radius}% larger.', maxRank: 3, ranks: [{ radius: 8 }, { radius: 8 }, { radius: 8 }], pos: at(0, 0) },
      { id: 'frozen_power', name: 'Frozen Power', text: 'Each enemy the field freezes restores {var:rimeGen} Arcane Power.', maxRank: 3, ranks: v3('rimeGen', 2), pos: at(1, 0) },
      // Cold Snap Edge: "the rim" = the outer quarter of the radius [P]; "a further" = on top of the field's 50 % chill.
      { id: 'cold_snap_edge', name: 'Cold Snap Edge', text: 'Enemies at the rim of the field (its outer quarter) are slowed a further {var:rimeEdge}%.', maxRank: 3,
        ranks: v3('rimeEdge', 20, 15, 15), pos: at(2, 0) },
      { id: 'shard_burst', name: 'Shard Burst', text: 'When the field ends, it bursts for {var:rimeFinale}% weapon damage to enemies inside.', maxRank: 3,
        ranks: v3('rimeFinale', 100, 50, 50), requires: needs('wide_frost'), pos: at(0, 1) },
      { id: 'ice_mirror', name: 'Ice Mirror', text: 'Casting Frost Nova inside your field adds {var:rimeRefresh} seconds to it.', maxRank: 3, ranks: v3('rimeRefresh', 2, 1, 1), requires: needs('frozen_power'), pos: at(1, 1) },
      { id: 'absolute_field', name: 'Absolute Field', text: 'Frozen enemies inside the field take {var:rimeFrozenBonus}% more damage from Rimefield and Rime Needles.', maxRank: 3,
        ranks: v3('rimeFrozenBonus', 10), requires: needs('cold_snap_edge'), pos: at(2, 1) },
    ],
  },
  {
    // Bible M11. A slow projectile with a periodic area tick (zaps), detonating at the end of its flight.
    id: 'stormglass_orb', classId: 'mage', name: 'Stormglass Orb', kind: 'spender', unlock: 40, element: 'lightning', tags: ['projectile', 'area'], category: 'Void and Storm',
    coef: 1.29, cost: 35, gen: 0, cooldown: 0, range: 440, radius: 160, duration: 2, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 2, within: 380 },
    // Measured (mage parity harness): one more orb (Glass Concord 2) doubled the skill (×2.1) and made the whole set ×3.1
    // on it (BUDGET.md R3: at most ×2.5); additional orbs deal half damage, as Split's extra missiles deal less [M].
    desc: 'Launch a slow orb of stormglass that zaps up to 3 nearby enemies every quarter second for {coef} weapon damage as {element}, then shatters for 300% weapon damage. Additional orbs deal half damage.',
    icon: { glyph: 'stormglass', color: 0x7fd3ff },
    runes: [
      { id: 'slow_thunder', name: 'Slow Thunder', unlock: 42, desc: 'The orb moves 50% slower and zaps 50% more often.', mods: { flags: ['orbSlow'] } },
      { id: 'pinball', name: 'Pinball', unlock: 45, desc: 'The orb bounces off walls up to twice and lasts 1 second longer.', mods: { flags: ['orbBounce'] } },
      { id: 'hailglass', name: 'Hailglass', unlock: 49, addTags: ['chill'], desc: 'Cold damage; zaps chill enemies, and the shatter freezes them for 1 second.', mods: { element: 'cold', flags: ['orbFreeze'] } },
      { id: 'conductor', name: 'Conductor', unlock: 54, desc: 'Lightning arcs between your orbs and your Thrumming Ray, dealing 200% weapon damage per second to enemies along each arc.', mods: { flags: ['orbConduct'] } },
      { id: 'prism_burst', name: 'Prism Burst', unlock: 60, desc: 'The shatter fires 6 of your Magic Missiles (with their rune) at 60% damage.', mods: { flags: ['orbMissiles'] } },
    ],
    // Tiers patterned on Meteor's [M]: damage, reach, cost.
    tiers: [
      { name: 'Charged Glass', desc: '+25% Stormglass Orb damage.', mods: { dmg: 25 } },
      { name: 'Wide Arcs', desc: 'Zap reach increased by 25%.', mods: { radius: 25 } },
      { name: 'Thin Glass', desc: 'Costs 25% less Arcane Power.', mods: { cost: -25 } },
    ],
    nodes: [
      { id: 'heavier_glass', name: 'Heavier Glass', text: 'Stormglass Orb deals {dmg}% increased damage.', maxRank: 3, ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: at(0, 0) },
      { id: 'forking_zap', name: 'Forking Zap', text: 'One zap in every {var:orbFork} forks to one more enemy up to 300 units away, beyond the orb’s reach.', maxRank: 3, ranks: v3('orbFork', 4, -1, -1), pos: at(1, 0) },
      { id: 'static_charge', name: 'Static Charge', text: 'Each zap on an elite restores {var:orbGen} Arcane Power.', maxRank: 3, ranks: v3('orbGen', 0.5), pos: at(2, 0) },
      { id: 'magnetised', name: 'Magnetised', text: 'The orb curves toward the nearest elite (turn rate {var:orbSeek}).', maxRank: 3, ranks: v3('orbSeek', 1), requires: needs('heavier_glass'), pos: at(0, 1) },
      { id: 'charge_release', name: 'Charge Release', text: 'The shatter’s radius grows by 10% for each enemy the orb zapped (at most {var:orbGrow}% larger).', maxRank: 3,
        ranks: v3('orbGrow', 30), requires: needs('forking_zap'), pos: at(1, 1) },
      { id: 'shattered_charge', name: 'Shattered Charge', text: 'The shatter leaves {var:orbShards} glass shards that zap enemies stepping on them for 100% weapon damage.', maxRank: 3,
        ranks: v3('orbShards', 3, 1, 1), requires: needs('static_charge'), pos: at(2, 1) },
    ],
  },
  {
    // Bible M12. Five spheres orbit the mage (radius 130) for 15 s; each strikes enemies it passes (each enemy at most every
    // 0.5 s per sphere) and every 1.5 s fires the mage's Magic Missile (rune and nodes) at 50 % damage.
    id: 'orrery', classId: 'mage', name: 'Orrery', kind: 'cooldown', unlock: 50, element: 'arcane', tags: ['summon', 'area'], category: 'Celestial',
    coef: 0.524, cost: 0, gen: 0, cooldown: 60, range: 380, radius: 130, duration: 15, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 6, within: 380 },
    desc: 'Set five spheres turning around you for {duration} seconds. Each strikes enemies it passes for {coef} weapon damage and fires your Magic Missile every 1.5 seconds at 50% damage.',
    icon: { glyph: 'orrery', color: 0xd8b46a },
    runes: [
      { id: 'comet_ring', name: 'Comet Ring', unlock: 52, addTags: ['aerial'], desc: 'When it ends, the spheres fall as 5 meteors on nearby enemies, each dealing 50% of your Meteor’s impact.', mods: { flags: ['orreryMeteors'] } },
      { id: 'wide_orbit', name: 'Wide Orbit', unlock: 55, desc: 'The orbit is 60% wider, but the spheres turn 20% slower.', mods: { flags: ['orreryWide'] } },
      { id: 'frozen_moons', name: 'Frozen Moons', unlock: 59, addTags: ['chill'], desc: 'Cold damage; the spheres chill enemies and fire your Rime Needles instead of Magic Missile.', mods: { element: 'cold', flags: ['orreryFrost'] } },
      { id: 'gravity_orrery', name: 'Gravity Orrery', unlock: 64, desc: 'Each sphere pass pulls enemies 10 units toward you.', mods: { flags: ['orreryPull'] } },
      { id: 'sun_at_centre', name: 'Sun at Centre', unlock: 70, desc: 'A sun at the centre burns enemies within 80 units of you for 150% weapon damage per second.', mods: { flags: ['orrerySun'] } },
    ],
    // Tiers patterned on the long-cooldown tiers [M] (Cairnfall / Kilnheart): damage, cooldown, duration.
    tiers: [
      { name: 'Polished Brass', desc: '+30% Orrery damage.', mods: { dmg: 30 } },
      { name: 'Quick Gears', desc: 'Cooldown reduced by 20%.', mods: { cooldown: -20 } },
      { name: 'Long Year', desc: 'Lasts 30% longer.', mods: { duration: 30 } },
    ],
    nodes: [
      { id: 'brass_spheres', name: 'Brass Spheres', text: 'Orrery deals {dmg}% increased damage.', maxRank: 3, ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: at(0, 0) },
      { id: 'tidal_lock', name: 'Tidal Lock', text: 'The spheres slow enemies they pass by {var:orrerySlow}% for 1 second.', maxRank: 3, ranks: v3('orrerySlow', 10), pos: at(1, 0) },
      { id: 'planetary_gift', name: 'Planetary Gift', text: 'Each sphere missile restores {var:orreryGen} Arcane Power.', maxRank: 3, ranks: v3('orreryGen', 0.5), pos: at(2, 0) },
      { id: 'eclipse', name: 'Eclipse', text: 'Every 5 seconds the spheres align and fire a beam outward that deals {var:orreryEclipse}% weapon damage.', maxRank: 3,
        ranks: v3('orreryEclipse', 200, 100, 100), requires: needs('brass_spheres'), pos: at(0, 1) },
      // "Each spell cast": every bar skill, primary attack and channel you start while it turns (the cast counter).
      { id: 'clockwinding', name: 'Clockwinding', text: 'Each spell you cast while the Orrery turns adds {var:orreryExtend} seconds to it (at most 10 seconds in total).', maxRank: 3,
        ranks: v3('orreryExtend', 0.2, 0.15, 0.15), requires: needs('tidal_lock'), pos: at(1, 1) },
      { id: 'gravity_assist', name: 'Gravity Assist', text: 'Spheres passing through your Black Hole or molten ground deal {var:orrerySynergy}% more damage for 3 seconds.', maxRank: 3,
        ranks: v3('orrerySynergy', 25), requires: needs('planetary_gift'), pos: at(2, 1) },
    ],
  },
];
