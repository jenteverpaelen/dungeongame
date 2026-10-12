// Ranger skills (data only). Behaviour lives in server/src/sim/skills/ranger*.ts; recipe in docs/rework/depth/FOUNDATION.md.
// Content: docs/rework/depth/RANGER.md (bible v2). Display names follow docs/rework/depth/NAMES.md (ids never change).
// Numbers marked in the bible as [M] are today's values; everything else is the bible's [P] proposal unless a comment says
// otherwise. Node texts use {var:…} placeholders so the tree shows the cumulative value of the bought rank.

import type { NodeDef, SkillDef } from './types';
import type { PowerEffect } from '../../powers';

/** A node's "more damage" template as plain data (no import of the power builders: they import this registry). */
const more = (skill: string, perRank: number, when: Extract<PowerEffect, { kind: 'skillMore' }>['when']): PowerEffect => ({ kind: 'skillMore', skills: [skill], pct: { roll: perRank }, when });
/** Node grid: N1–N3 open on the top row, N4–N6 below them need 2 ranks in the node above. */
const at = (col: number, row: number) => ({ col, row });
const needs = (node: string): NodeDef['requires'] => [{ node, rank: 2 }];
/** Three equal ranks of one named parameter. */
const v3 = (name: string, a: number, b = a, c = b): NodeDef['ranks'] => [{ vars: { [name]: a } }, { vars: { [name]: b } }, { vars: { [name]: c } }];

/**
 * Timing constants the server simulation and the client visuals must agree on (all [P]; the bible gives none):
 * Skipstone flight speed = Tracking Arrow's 900 units/s [M]; Overcast arrows fall 0.35 s after the cast; the Mortar's
 * shell flight = Burst Arrow's lob 0.45 s [M].
 */
export const RANGER_FX = { skipSpeed: 900, overcastFallMs: 350, mortarFlightMs: 450 } as const;

/** Order matters: it is the registry order (skill pickers, affix rolls), so append new skills at the end. */
export const RANGER_SKILLS: SkillDef[] = [
  {
    id: 'hungering_arrow', classId: 'ranger', name: 'Tracking Arrow', kind: 'primary', unlock: 1, element: 'physical', tags: ['projectile', 'piercing'], category: 'Shots',
    coef: 3.19, cost: 0, gen: 3, cooldown: 0, range: 380, radius: 0, duration: 0, maxSummons: 0,
    auto: { when: 'always' },
    desc: 'Fire an arrow that seeks out enemies for {coef} weapon damage, with a 35% chance to pierce. Generates {gen} Hatred.',
    icon: { glyph: 'arrow', color: 0x8fd16a },
    runes: [
      { id: 'puncturing', name: 'Through-Shot', unlock: 3, desc: 'Pierce chance increased by 50%.', mods: { pierce: 50 } },
      { id: 'shatter_shot', name: 'Splinter Frost', unlock: 6, desc: 'Piercing splits the arrow into 3 smaller arrows dealing Cold damage.', mods: { element: 'cold', flags: ['splitOnPierce'] } },
      { id: 'devouring', name: 'Gorging Shaft', unlock: 10, desc: 'Each consecutive pierce deals 70% more damage.', mods: { flags: ['devouring'] } },
      { id: 'fletchling_swarm', name: 'Fletchling Swarm', unlock: 15, desc: 'Hits have a 30% chance to release 2 tiny seeking darts that deal 40% weapon damage each.', mods: { flags: ['haDarts'] } },
      { id: 'barbed_shaft', name: 'Barbed Shaft', unlock: 21, addTags: ['bleed'], desc: 'Arrows make enemies bleed for 60% weapon damage over 3 seconds.', mods: { flags: ['haBleed'] } },
    ],
    tiers: [
      { name: 'Fletcher', desc: '+20% Tracking Arrow damage.', mods: { dmg: 20 } },
      { name: 'Twin Draw', desc: 'Fire an additional arrow.', mods: { projectiles: 1 } },
      { name: 'Bloodscent', desc: 'Generates 2 additional Hatred.', mods: { gen: 2 } },
    ],
    nodes: [
      { id: 'steady_draw', name: 'Steady Draw', text: 'Tracking Arrow deals {dmg}% increased damage.', maxRank: 3, ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: at(0, 0) },
      { id: 'hunger_pangs', name: 'Hunger Pangs', text: 'Each pierce restores 1 Hatred (at most {var:haPierceGen} per arrow).', maxRank: 3, ranks: v3('haPierceGen', 1), pos: at(1, 0) },
      { id: 'seeking_turn', name: 'Seeking Turn', text: 'Arrows turn {var:haTurn}% faster and pick a new target when theirs dies.', maxRank: 3, ranks: v3('haTurn', 30), pos: at(2, 0) },
      { id: 'long_flight', name: 'Long Flight', text: 'Arrows fly {var:haRange}% farther and deal {var:haDist}% more damage for every 100 units they have flown.', maxRank: 3,
        ranks: [{ vars: { haRange: 15, haDist: 5 } }, { vars: { haRange: 15, haDist: 5 } }, { vars: { haRange: 15, haDist: 5 } }], requires: needs('steady_draw'), pos: at(0, 1),
        // 5 % per 100 units = 30 % at 600 units, beyond the longest flight (380 × 1.45 + reach margin): linear like the text.
        effects: [{ kind: 'projectile', skills: ['hungering_arrow'], distBonus: { pct: { roll: 30 }, atUnits: 600 } }] },
      { id: 'split_feathers', name: 'Split Feathers', text: 'Every {var:haEvery}th arrow fires 2 extra arrows in a narrow fan.', maxRank: 3,
        ranks: [{ vars: { haEvery: 5 } }, { vars: { haEvery: -1 } }, { vars: { haEvery: -1 } }], requires: needs('hunger_pangs'), pos: at(1, 1) },
      { id: 'gut_hook', name: 'Gut Hook', text: 'Enemies your arrows pierce are slowed by {var:haSlow}% for 2 seconds.', maxRank: 3, ranks: v3('haSlow', 10), requires: needs('seeking_turn'), pos: at(2, 1) },
    ],
  },
  {
    id: 'sentry', classId: 'ranger', name: 'Sentry', kind: 'summon', unlock: 2, element: 'physical', tags: ['device', 'cooldown', 'projectile'], category: 'Devices',
    coef: 1.85, cost: 20, gen: 0, cooldown: 8, range: 380, radius: 380, duration: 30, maxSummons: 2,
    auto: { when: 'maintainSummon' },
    desc: 'Deploy a turret at your feet that fires bolts at enemies for {coef} weapon damage each second. Up to {max} Sentries; lasts {duration} seconds.',
    icon: { glyph: 'turret', color: 0xc9a227 },
    runes: [
      { id: 'spitfire', name: 'Rocket Rack', unlock: 4, tags: ['projectile'], desc: 'The turret also fires homing rockets dealing 120% weapon damage as Fire.', mods: { flags: ['rockets'] } },
      { id: 'chain_of_torment', name: 'Arc Line', unlock: 7, desc: 'Lightning chains form between your Sentries, dealing 300% weapon damage per second to enemies that cross them.', mods: { flags: ['chains'] } },
      { id: 'polar_station', name: 'Cold Bolts', unlock: 11, addTags: ['chill'], desc: 'Bolts deal Cold damage and chill enemies by 60%.', mods: { element: 'cold', flags: ['chill'] } },
      { id: 'watchtower', name: 'Watchtower', unlock: 16, desc: 'Sentries are built 120 units toward the densest pack, and their bolts pierce once.', mods: { flags: ['sentryForward', 'sentryPierce'] } },
      { id: 'flame_lance', name: 'Flame Lance', unlock: 22, addTags: ['area'], removeTags: ['projectile'], desc: 'Sentries spray a short flame jet (a 60° cone, 150 units) instead of bolts, dealing Fire damage and 20% more.', mods: { element: 'fire', dmg: 20, flags: ['sentryFlame'] } },
    ],
    tiers: [
      { name: 'Reinforced Frame', desc: '+25% Sentry damage.', mods: { dmg: 25 } },
      { name: 'Rapid Assembly', desc: 'Sentry cooldown reduced by 25%.', mods: { cooldown: -25 } },
      { name: 'Custom Engineering', desc: '+1 maximum Sentry and Sentries last 50% longer.', mods: { maxSummons: 1, duration: 50 } },
    ],
    nodes: [
      { id: 'sturdier_frames', name: 'Sturdier Frames', text: 'Sentries last {duration}% longer.', maxRank: 3, ranks: [{ duration: 15 }, { duration: 15 }, { duration: 15 }], pos: at(0, 0) },
      { id: 'hatred_feed', name: 'Hatred Feed', text: 'Each Sentry bolt that hits an elite restores {var:sentryGen} Hatred.', maxRank: 3, ranks: v3('sentryGen', 0.5), pos: at(1, 0) },
      { id: 'crossfire', name: 'Crossfire', text: 'Enemies hit by 2 or more Sentries within 1 second take {var:sentryCross}% more damage from Sentries.', maxRank: 3, ranks: v3('sentryCross', 10), pos: at(2, 0) },
      { id: 'last_barrage', name: 'Last Barrage', text: 'An expiring Sentry fires a final barrage of {var:sentryFinale} bolts.', maxRank: 3,
        ranks: [{ vars: { sentryFinale: 4 } }, { vars: { sentryFinale: 2 } }, { vars: { sentryFinale: 2 } }], requires: needs('sturdier_frames'), pos: at(0, 1) },
      { id: 'shared_optics', name: 'Shared Optics', text: 'Sentries fire at your Quarry Mark from anywhere in sight (up to 900 units) and deal {var:sentrySnipe}% more damage to it.', maxRank: 3,
        ranks: v3('sentrySnipe', 10), requires: needs('hatred_feed'), pos: at(1, 1) },
      { id: 'cog_linkage', name: 'Cog Linkage', text: 'Sentries fire {var:sentryLink}% faster for each other Sentry within 200 units.', maxRank: 3, ranks: v3('sentryLink', 5), requires: needs('crossfire'), pos: at(2, 1) },
    ],
  },
  {
    id: 'multishot', classId: 'ranger', name: 'Multishot', kind: 'spender', unlock: 4, element: 'physical', tags: ['projectile', 'piercing'], category: 'Volleys',
    coef: 6.78, cost: 25, gen: 0, cooldown: 0, range: 380, radius: 0, duration: 0, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 2, within: 380 },
    desc: 'Fire a massive volley of arrows in a wide arc, dealing {coef} weapon damage to every enemy hit.',
    icon: { glyph: 'fan', color: 0x9bd36f },
    runes: [
      { id: 'fire_at_will', name: 'Fire at Will', unlock: 6, desc: 'Deals Lightning damage and costs 40% less Hatred.', mods: { element: 'lightning', cost: -40 } },
      { id: 'arsenal', name: 'Rocket Kit', unlock: 9, tags: ['projectile'], desc: 'Also fires 3 rockets at nearby enemies for 300% weapon damage as Fire.', mods: { flags: ['rockets'] } },
      { id: 'full_broadside', name: 'Heavy Volley', unlock: 13, desc: 'Multishot deals 50% more damage.', mods: { dmg: 50 } },
      { id: 'fanning_hail', name: 'Fanning Hail', unlock: 18, desc: 'A full 180° fan of 15 arrows that deal 25% less damage.', mods: { projectiles: 6, dmg: -25, flags: ['multiWide'] } },
      { id: 'gale_shot', name: 'Gale Shot', unlock: 24, desc: 'Arrows push enemies 40 units back, and each enemy hit restores 1 Hatred (at most 10 per volley).', mods: { flags: ['multiPush', 'multiGen'] } },
    ],
    tiers: [
      { name: 'Volley Drill', desc: '+20% Multishot damage.', mods: { dmg: 20 } },
      { name: 'Extra Quivers', desc: '+4 arrows in the volley.', mods: { projectiles: 4 } },
      { name: 'Hatred Harvest', desc: 'Costs 25% less Hatred.', mods: { cost: -25 } },
    ],
    nodes: [
      { id: 'more_shafts', name: 'More Shafts', text: '+{projectiles} arrows in the volley.', maxRank: 3, ranks: [{ projectiles: 2 }, { projectiles: 2 }, { projectiles: 2 }], pos: at(0, 0) },
      { id: 'thrifty_nock', name: 'Thrifty Nock', text: 'A volley that hits 5 or more enemies refunds {var:multiRefund} Hatred.', maxRank: 3, ranks: v3('multiRefund', 2), pos: at(1, 0) },
      { id: 'point_blank', name: 'Point Blank', text: 'Multishot deals {var:multiClose}% more damage to enemies within 150 units.', maxRank: 3, ranks: v3('multiClose', 15), pos: at(2, 0),
        effects: [more('multishot', 15, { targetWithin: 150 })] },
      { id: 'rolling_volley', name: 'Rolling Volley', text: 'A second volley with 40% of the arrows follows 0.25 seconds later at {var:multiEcho}% damage.', maxRank: 3,
        ranks: [{ vars: { multiEcho: 30 } }, { vars: { multiEcho: 15 } }, { vars: { multiEcho: 15 } }], requires: needs('more_shafts'), pos: at(0, 1) },
      { id: 'rocket_tithe', name: 'Rocket Tithe', text: 'With Rocket Kit, rockets seek elites first and deal {var:multiRocketElite}% more damage to them.', maxRank: 3,
        ranks: v3('multiRocketElite', 20), requires: needs('thrifty_nock'), pos: at(1, 1) },
      { id: 'ricochet_fletch', name: 'Ricochet Fletch', text: 'Arrows that reach their maximum range or a wall ricochet once at {var:multiRicochet}% damage.', maxRank: 3,
        ranks: [{ vars: { multiRicochet: 30 } }, { vars: { multiRicochet: 20 } }, { vars: { multiRicochet: 20 } }], requires: needs('point_blank'), pos: at(2, 1) },
    ],
  },
  {
    id: 'cluster_arrow', classId: 'ranger', name: 'Burst Arrow', kind: 'spender', unlock: 6, element: 'fire', tags: ['projectile', 'area'], category: 'Volleys',
    coef: 4.09, cost: 40, gen: 0, cooldown: 0, range: 380, radius: 110, duration: 0, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 3, within: 380 },
    desc: 'Lob an explosive arrow into the densest pack. It detonates for {coef} weapon damage as Fire, then releases 4 grenades for 210% weapon damage each.',
    icon: { glyph: 'cluster', color: 0xe67e22 },
    runes: [
      { id: 'maelstrom', name: 'Homing Rockets', unlock: 8, tags: ['projectile'], desc: 'Releases 3 homing rockets instead of grenades.', mods: { flags: ['rockets'] } },
      { id: 'shooting_stars', name: 'Shooting Stars', unlock: 11, desc: 'Deals Lightning damage; grenades become falling stars.', mods: { element: 'lightning' } },
      { id: 'loaded_for_bear', name: 'Single Charge', unlock: 15, desc: 'Explosion radius +40% and +80% damage, but no grenades.', mods: { radius: 40, dmg: 80, flags: ['noGrenades'] } },
      { id: 'barrel_bomb', name: 'Barrel Bomb', unlock: 20, desc: 'The arrow rolls along the ground, leaving 3 small blasts for 50% of its damage each before it detonates.', mods: { flags: ['clusterRoll'] } },
      { id: 'freezing_charge', name: 'Freezing Charge', unlock: 26, addTags: ['chill'], desc: 'Deals Cold damage, and the grenades freeze enemies for 0.75 seconds.', mods: { element: 'cold', flags: ['clusterFreeze'] } },
    ],
    tiers: [
      { name: 'Black Powder', desc: '+25% Burst Arrow damage.', mods: { dmg: 25 } },
      { name: 'Wide Payload', desc: 'Explosion radius +25%.', mods: { radius: 25 } },
      { name: 'Frugal Fuse', desc: 'Costs 20% less Hatred.', mods: { cost: -20 } },
    ],
    nodes: [
      { id: 'heavier_charge', name: 'Heavier Charge', text: 'Burst Arrow deals {dmg}% increased damage.', maxRank: 3, ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: at(0, 0) },
      { id: 'quick_match', name: 'Quick Match', text: 'Grenades detonate {var:clusterFuse} seconds sooner and scatter tighter.', maxRank: 3, ranks: v3('clusterFuse', 0.1), pos: at(1, 0) },
      { id: 'sympathetic_blast', name: 'Sympathetic Blast', text: 'Grenades that land on a Spring Snare trigger it; grenades that land on burning pitch deal {var:clusterChain}% more damage.', maxRank: 3,
        ranks: [{ vars: { clusterChain: 50 } }, { vars: { clusterChain: 25 } }, { vars: { clusterChain: 25 } }], pos: at(2, 0) },
      { id: 'daisy_chain', name: 'Daisy Chain', text: 'A grenade that hits an elite drops one more grenade beside it (at most {var:clusterDaisy} extra per cast).', maxRank: 3,
        ranks: v3('clusterDaisy', 1), requires: needs('heavier_charge'), pos: at(0, 1) },
      { id: 'powder_thrift', name: 'Powder Thrift', text: 'A Burst Arrow that hits an elite refunds {var:clusterThrift} Hatred.', maxRank: 3, ranks: v3('clusterThrift', 4), requires: needs('quick_match'), pos: at(1, 1) },
      { id: 'concussive_core', name: 'Concussive Core', text: 'The main blast knocks enemies {var:clusterConcuss} units outward and stuns them for 0.3 seconds.', maxRank: 3,
        ranks: v3('clusterConcuss', 20), requires: needs('sympathetic_blast'), pos: at(2, 1) },
    ],
  },
  {
    id: 'rain_of_vengeance', classId: 'ranger', parityReady: true, name: 'Arrowfall', kind: 'cooldown', unlock: 9, element: 'physical', tags: ['aerial', 'area', 'ground'], category: 'Skyfall',
    coef: 26.9, cost: 0, gen: 0, cooldown: 30, range: 380, radius: 240, duration: 5, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 5, within: 380 },
    desc: 'Call down a storm of arrows on a large area, dealing {coef} weapon damage over {duration} seconds.',
    icon: { glyph: 'rain', color: 0x5dade2 },
    runes: [
      { id: 'dark_cloud', name: 'Dark Cloud', unlock: 11, desc: 'Deals Lightning damage; the storm follows the densest pack.', mods: { element: 'lightning', flags: ['follow'] } },
      { id: 'beastly_bombs', name: 'Firedrop', unlock: 14, desc: 'Deals Fire damage and 50% more damage in a shorter burst.', mods: { element: 'fire', dmg: 50, duration: -40 } },
      { id: 'stampede', name: 'Stampede', unlock: 18, desc: 'Cooldown reduced by 33%.', mods: { cooldown: -33 } },
      { id: 'flood_plain', name: 'Flood Plain', unlock: 23, addTags: ['chill'], desc: 'The storm leaves wet ground for 3 seconds after it ends; it slows enemies in it by 30%.', mods: { flags: ['rainWet'] } },
      { id: 'kestrel_column', name: 'Kestrel Column', unlock: 29, desc: 'A column of diving kestrels: half the radius and half the duration, the same total damage.', mods: { radius: -50, duration: -50, flags: ['rainFocus'] } },
    ],
    tiers: [
      { name: 'Hail of Shafts', desc: '+30% Arrowfall damage.', mods: { dmg: 30 } },
      { name: 'Squall Renewed', desc: 'Cooldown reduced by 20%.', mods: { cooldown: -20 } },
      { name: 'Wide Storm', desc: 'Radius increased by 30%.', mods: { radius: 30 } },
    ],
    nodes: [
      { id: 'thicker_rain', name: 'Thicker Rain', text: 'Arrowfall covers {radius}% more radius.', maxRank: 3, ranks: [{ radius: 8 }, { radius: 8 }, { radius: 8 }], pos: at(0, 0) },
      { id: 'second_squall', name: 'Second Squall', text: 'When it ends, {var:rainRecast}% chance to call a free storm of half the duration on the densest pack.', maxRank: 3, ranks: v3('rainRecast', 30), pos: at(1, 0) },
      { id: 'wind_shear', name: 'Crosswind', text: 'The storm drifts toward the densest pack at {var:rainDrift} units per second.', maxRank: 3, ranks: v3('rainDrift', 40), pos: at(2, 0) },
      { id: 'opening_burst', name: 'Opening Burst', text: 'The first 0.5 seconds deal {var:rainBurst}% more damage.', maxRank: 3, ranks: v3('rainBurst', 50), requires: needs('thicker_rain'), pos: at(0, 1) },
      { id: 'patient_cloud', name: 'Patient Cloud', text: 'Each Overcast Volley cast reduces Arrowfall’s cooldown by {var:rainRefund} seconds.', maxRank: 3, ranks: v3('rainRefund', 0.5), requires: needs('second_squall'), pos: at(1, 1) },
      { id: 'hailstones', name: 'Hailstones', text: 'Enemies hit 5 or more times by one storm are stunned for {var:rainStun} seconds (once per storm).', maxRank: 3,
        ranks: [{ vars: { rainStun: 0.5 } }, { vars: { rainStun: 0.25 } }, { vars: { rainStun: 0.25 } }], requires: needs('wind_shear'), pos: at(2, 1) },
    ],
  },
  {
    id: 'companion', classId: 'ranger', parityReady: true, name: 'Companion', kind: 'summon', unlock: 12, element: 'physical', tags: ['beast'], category: 'Beasts',
    coef: 1.14, cost: 0, gen: 0, cooldown: 0, range: 320, radius: 0, duration: 0, maxSummons: 1,
    auto: { when: 'maintainSummon' },
    desc: 'A loyal wolf fights at your side, biting enemies for {coef} weapon damage.',
    icon: { glyph: 'paw', color: 0xa0a0a0 },
    runes: [
      { id: 'wolf_howl', name: 'Pack Leader', unlock: 14, desc: 'Your wolf howls, increasing your damage by 15%.', mods: { flags: ['wolfAura'] } },
      { id: 'bat', name: 'Bat', unlock: 17, desc: 'A bat replaces the wolf and generates 1 Hatred per second.', mods: { flags: ['batCompanion'] } },
      { id: 'raven', name: 'Raven', unlock: 21, desc: 'A raven replaces the wolf, dealing Lightning damage and 50% more.', mods: { element: 'lightning', dmg: 50, flags: ['ravenCompanion'] } },
      { id: 'badger_sett', name: 'Badger Sett', unlock: 26, addTags: ['stun'], desc: 'A badger replaces the wolf; every 4 seconds it bursts up under enemies, stunning those within 70 units for 0.75 seconds.', mods: { flags: ['badgerCompanion'] } },
      { id: 'heron', name: 'Heron', unlock: 32, addTags: ['chill'], desc: 'A heron replaces the wolf; it spears from 200 units for 40% more damage, and its strikes chill.', mods: { dmg: 40, flags: ['heronCompanion'] } },
    ],
    tiers: [
      { name: 'Sharpened Fangs', desc: '+50% Companion damage.', mods: { dmg: 50 } },
      { name: 'Alpha', desc: '+80% Companion damage.', mods: { dmg: 80 } },
      { name: 'Twin Bond', desc: 'Summon a second companion.', mods: { maxSummons: 1 } },
    ],
    nodes: [
      { id: 'strong_jaws', name: 'Strong Jaws', text: 'Companions deal {dmg}% increased damage.', maxRank: 3, ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: at(0, 0) },
      { id: 'pack_tactics', name: 'Pack Tactics', text: 'Companions attack {var:compFocus}% faster while they attack the enemy you last shot.', maxRank: 3, ranks: v3('compFocus', 10), pos: at(1, 0) },
      { id: 'hunting_call', name: 'Hunting Call', text: 'When you cast Quarry Mark or Murmuration, your companions leap to the target for {var:compLeap}% weapon damage.', maxRank: 3,
        ranks: [{ vars: { compLeap: 200 } }, { vars: { compLeap: 100 } }, { vars: { compLeap: 100 } }], pos: at(2, 0) },
      { id: 'alpha_howl', name: 'Alpha Howl', text: 'Every 10 seconds your companions howl: you deal {var:compHowl}% increased damage for 4 seconds.', maxRank: 3, ranks: v3('compHowl', 4), requires: needs('strong_jaws'), pos: at(0, 1) },
      { id: 'rough_and_tumble', name: 'Rough and Tumble', text: 'Each bite has a {var:compStun}% chance to stun the enemy for 0.5 seconds.', maxRank: 3, ranks: v3('compStun', 10), requires: needs('pack_tactics'), pos: at(1, 1) },
      { id: 'loyal_guard', name: 'Loyal Guard', text: 'You take {var:compGuard}% less damage for each living companion (at most 2 counted).', maxRank: 3, ranks: v3('compGuard', 4), requires: needs('hunting_call'), pos: at(2, 1),
        effects: [{ kind: 'damageTaken', pct: { roll: -4 }, when: { perSummon: 'companion', max: 2 } }] },
    ],
  },
  // ─────────────────────────── New skills (RANGER.md §3) ───────────────────────────
  {
    id: 'skipstone_bolt', classId: 'ranger', name: 'Skipstone Bolt', kind: 'primary', unlock: 16, element: 'physical', tags: ['projectile', 'piercing'], category: 'Shots',
    coef: 2.95, cost: 0, gen: 3, cooldown: 0, range: 380, radius: 220, duration: 0, maxSummons: 0,
    auto: { when: 'always' },
    desc: 'Fire a flat bolt that hits for {coef} weapon damage and skips to 2 more enemies within {radius} units, losing 20% damage each skip. Generates {gen} Hatred.',
    icon: { glyph: 'skip', color: 0x7fb8c9 },
    runes: [
      { id: 'long_skip', name: 'Long Skip', unlock: 18, desc: 'The bolt skips 4 times, losing 30% damage each skip.', mods: { flags: ['skipMore'] } },
      { id: 'ripple', name: 'Ripple', unlock: 21, addTags: ['chill'], desc: 'Deals Cold damage; every skip point ripples (radius 50) for 40% weapon damage and slows enemies by 30% for 1 second.', mods: { element: 'cold', flags: ['skipRipple'] } },
      { id: 'fen_lightning', name: 'Fen Lightning', unlock: 25, desc: 'Deals Lightning damage; each skip generates 1 Hatred.', mods: { element: 'lightning', flags: ['skipGen'] } },
      { id: 'heavy_stone', name: 'Heavy Stone', unlock: 30, addTags: ['displace'], removeTags: ['piercing'], desc: 'No skips; the bolt knocks its target back 60 units and deals 80% more damage.', mods: { dmg: 80, flags: ['noSkip', 'skipKnock'] } },
      { id: 'marker_bolt', name: 'Marker Bolt', unlock: 36, addTags: ['mark'], desc: 'The last enemy the bolt skips to is marked for 3 seconds and takes 10% more damage from you.', mods: { flags: ['skipMark'] } },
    ],
    tiers: [
      { name: 'Whetted Slate', desc: '+20% Skipstone Bolt damage.', mods: { dmg: 20 } },
      { name: 'Wide Skim', desc: 'Skips reach 25% farther.', mods: { radius: 25 } },
      { name: 'Steady Wrist', desc: 'Generates 2 additional Hatred.', mods: { gen: 2 } },
    ],
    nodes: [
      { id: 'smooth_stone', name: 'Smooth Stone', text: 'Each skip loses {var:skipFalloff} points less damage.', maxRank: 3, ranks: v3('skipFalloff', 5), pos: at(0, 0) },
      { id: 'water_dance', name: 'Water Dance', text: '{var:skipRevisit}% chance that a skip may return to an enemy already hit.', maxRank: 3, ranks: v3('skipRevisit', 15), pos: at(1, 0) },
      { id: 'splash_hatred', name: 'Splash Hatred', text: 'Each skip restores {var:skipGenRank} Hatred.', maxRank: 3, ranks: v3('skipGenRank', 0.5), pos: at(2, 0) },
      { id: 'last_skip', name: 'Last Skip', text: 'The final skip deals {var:skipFinal}% more damage.', maxRank: 3, ranks: v3('skipFinal', 30), requires: needs('smooth_stone'), pos: at(0, 1) },
      { id: 'tripping_stone', name: 'Tripping Stone', text: 'Enemies a skip reaches are knocked down (stunned) for {var:skipTrip} seconds.', maxRank: 3,
        ranks: [{ vars: { skipTrip: 0.2 } }, { vars: { skipTrip: 0.15 } }, { vars: { skipTrip: 0.15 } }], requires: needs('water_dance'), pos: at(1, 1) },
      // Bible: "a 1 s puddle that chills 20 / 30 / 40%" (a slow of that strength, engine wave 3). Radius [P] 50 = Ripple's skip ripple.
      { id: 'wake', name: 'Wake', text: 'Each skip leaves a puddle for 1 second that slows enemies in it by {var:skipPuddle}%.', maxRank: 3, ranks: v3('skipPuddle', 20, 10, 10), requires: needs('splash_hatred'), pos: at(2, 1) },
    ],
  },
  {
    id: 'spring_snare', classId: 'ranger', name: 'Spring Snare', kind: 'summon', unlock: 20, element: 'physical', tags: ['device', 'trap', 'area', 'stun'], category: 'Devices',
    coef: 3.38, cost: 15, gen: 0, cooldown: 0, range: 380, radius: 90, duration: 20, maxSummons: 3,
    auto: { when: 'maintainSummon' },
    desc: 'Set a spring snare near enemies. When one steps on it, it snaps for {coef} weapon damage and holds enemies within {radius} units for 1.5 seconds. Up to {max} snares; each lasts {duration} seconds.',
    icon: { glyph: 'snare', color: 0x9a7b4f },
    runes: [
      { id: 'chain_snare', name: 'Chain Snare', unlock: 22, desc: 'A triggered snare tethers up to 2 nearby enemies and drags them 60 units toward its victim.', mods: { flags: ['snareTether'] } },
      { id: 'pitch_soaked', name: 'Pitch-Soaked', unlock: 25, addTags: ['ground', 'burn'], desc: 'Deals Fire damage; the snap leaves burning ground for 2 seconds.', mods: { element: 'fire', flags: ['snareBurn'] } },
      { id: 'hair_trigger', name: 'Hair Trigger', unlock: 29, desc: 'Snares arm instantly and you may have 5, but each deals 40% less damage.', mods: { maxSummons: 2, dmg: -40, flags: ['snareInstant'] } },
      { id: 'bramble_spring', name: 'Bramble Spring', unlock: 34, addTags: ['projectile'], desc: 'The snap also flings 4 thorns outward for 60% weapon damage each.', mods: { flags: ['snareThorns'] } },
      { id: 'hunters_patience', name: 'Hunter’s Patience', unlock: 40, desc: 'Snares that waited 5 seconds or more before triggering deal 100% more damage.', mods: { flags: ['snarePatience'] } },
    ],
    tiers: [
      { name: 'Oiled Coil', desc: '+25% Spring Snare damage.', mods: { dmg: 25 } },
      { name: 'Quick Set', desc: 'Costs 20% less Hatred.', mods: { cost: -20 } },
      { name: 'Spare Jaws', desc: '+1 maximum snare, and snares last 50% longer.', mods: { maxSummons: 1, duration: 50 } },
    ],
    nodes: [
      { id: 'stronger_spring', name: 'Stronger Spring', text: 'Spring Snare deals {dmg}% increased damage.', maxRank: 3, ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: at(0, 0) },
      { id: 'bait', name: 'Bait', text: 'Armed snares slowly draw enemies within {var:snareLure} units toward them.', maxRank: 3,
        ranks: [{ vars: { snareLure: 100 } }, { vars: { snareLure: 50 } }, { vars: { snareLure: 50 } }], pos: at(1, 0) },
      { id: 'reset_spring', name: 'Reset Spring', text: '{var:snareRearm}% chance that a triggered snare re-arms after 1 second.', maxRank: 3, ranks: v3('snareRearm', 15), pos: at(2, 0) },
      { id: 'shrapnel_jaw', name: 'Shrapnel Jaw', text: 'The snap also hits a 120° cone behind its victim (150 units) for {var:snareCone}% of its damage.', maxRank: 3,
        ranks: [{ vars: { snareCone: 50 } }, { vars: { snareCone: 25 } }, { vars: { snareCone: 25 } }], requires: needs('stronger_spring'), pos: at(0, 1) },
      { id: 'tripwire', name: 'Tripwire', text: 'Snares within 200 units of each other are joined by a wire; an enemy crossing it triggers both at {var:snareWire}% damage.', maxRank: 3,
        ranks: [{ vars: { snareWire: 40 } }, { vars: { snareWire: 20 } }, { vars: { snareWire: 20 } }], requires: needs('bait'), pos: at(1, 1) },
      { id: 'trappers_due', name: 'Trapper’s Due', text: 'Each trigger restores {var:snareGen} Hatred.', maxRank: 3, ranks: v3('snareGen', 3), requires: needs('reset_spring'), pos: at(2, 1) },
    ],
  },
  {
    id: 'overcast_volley', classId: 'ranger', name: 'Overcast Volley', kind: 'spender', unlock: 26, element: 'physical', tags: ['aerial', 'area'], category: 'Skyfall',
    coef: 0.89, cost: 30, gen: 0, cooldown: 0, range: 380, radius: 140, duration: 1.2, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 3, within: 380 },
    desc: 'Loose arrows into the sky; 8 of them fall over {duration} seconds across {radius} units, each dealing {coef} weapon damage where it lands.',
    icon: { glyph: 'overcast', color: 0x6a8caf },
    runes: [
      { id: 'freezing_drizzle', name: 'Freezing Drizzle', unlock: 28, addTags: ['chill'], desc: 'Deals Cold damage; arrows chill enemies by 40% for 2 seconds.', mods: { element: 'cold', flags: ['chill'] } },
      { id: 'downpour', name: 'Downpour', unlock: 31, desc: '14 arrows fall over 2 seconds in a 40% larger area, each dealing 35% less damage.', mods: { radius: 40, flags: ['volleyDownpour'] } },
      { id: 'storm_shelf', name: 'Storm Shelf', unlock: 35, desc: 'Deals Lightning damage; the cloud lingers 2 seconds and strikes 2 random enemies with bolts for 150% weapon damage each.', mods: { element: 'lightning', flags: ['volleyBolts'] } },
      { id: 'pinning_shower', name: 'Pinning Shower', unlock: 40, addTags: ['stun'], desc: 'Enemies hit by 3 arrows of one volley are pinned (stunned) for 1 second.', mods: { flags: ['volleyPin'] } },
      { id: 'sunbreak', name: 'Sunbreak', unlock: 46, desc: 'Costs 10 less Hatred and falls in a 40% tighter area for 30% more damage.', mods: { cost: -33, radius: -40, dmg: 30 } },
    ],
    tiers: [
      { name: 'Grey Fletching', desc: '+20% Overcast Volley damage.', mods: { dmg: 20 } },
      { name: 'Wider Sky', desc: 'The arrows fall across a 25% larger area.', mods: { radius: 25 } },
      { name: 'Light Quiver', desc: 'Costs 25% less Hatred.', mods: { cost: -25 } },
    ],
    nodes: [
      { id: 'denser_cloud', name: 'Denser Cloud', text: '{var:volleyArrows} more arrows fall.', maxRank: 3, ranks: v3('volleyArrows', 1), pos: at(0, 0) },
      { id: 'downdraft', name: 'Downdraft', text: 'Each arrow pulls enemies {var:volleyGather} units toward the centre.', maxRank: 3, ranks: v3('volleyGather', 10), pos: at(1, 0) },
      { id: 'hatred_rain', name: 'Hatred Rain', text: 'Each arrow that hits an elite refunds {var:volleyGen} Hatred (at most 6 per volley).', maxRank: 3, ranks: v3('volleyGen', 1), pos: at(2, 0) },
      { id: 'chasing_cloud', name: 'Chasing Cloud', text: 'The cloud drifts with the densest enemies at {var:volleyFollow} units per second.', maxRank: 3,
        ranks: [{ vars: { volleyFollow: 60 } }, { vars: { volleyFollow: 40 } }, { vars: { volleyFollow: 40 } }], requires: needs('denser_cloud'), pos: at(0, 1) },
      { id: 'thunder_peal', name: 'Thunder Peal', text: 'The last arrow is a heavy shaft (radius 70) that deals {var:volleyFinale}% of an arrow’s damage.', maxRank: 3,
        ranks: [{ vars: { volleyFinale: 200 } }, { vars: { volleyFinale: 100 } }, { vars: { volleyFinale: 100 } }], requires: needs('downdraft'), pos: at(1, 1) },
      { id: 'soaked', name: 'Soaked', text: 'Enemies hit by 3 or more arrows take {var:volleySoak}% more damage from Arrowfall for 3 seconds.', maxRank: 3, ranks: v3('volleySoak', 8), requires: needs('hatred_rain'), pos: at(2, 1) },
    ],
  },
  {
    id: 'quarry_mark', classId: 'ranger', name: 'Quarry Mark', kind: 'cooldown', unlock: 32, element: 'physical', tags: ['mark'], category: 'Beasts',
    coef: 0, cost: 10, gen: 0, cooldown: 6, range: 450, radius: 0, duration: 12, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 1, within: 450 },
    desc: 'Mark your quarry for {duration} seconds: the strongest elite in range, else the strongest enemy. It takes 20% more damage from you and your summons, which hunt it first. If it dies, the mark jumps to the strongest enemy nearby. Not cast while your mark lives.',
    icon: { glyph: 'eye', color: 0xe6c35c },
    runes: [
      { id: 'bloodhound', name: 'Bloodhound', unlock: 34, addTags: ['chill'], desc: 'The quarry is slowed by 30%, and your companions move 30% faster.', mods: { flags: ['markSlow'] } },
      { id: 'bounty', name: 'Bounty', unlock: 37, desc: 'Killing the quarry restores 30 Hatred and drops a healing pickup.', mods: { flags: ['markBounty'] } },
      { id: 'open_season', name: 'Open Season', unlock: 41, desc: 'Enemies within 120 units of the quarry are marked at half strength.', mods: { flags: ['markSplash'] } },
      { id: 'falcon_strike', name: 'Falcon Strike', unlock: 46, addTags: ['beast'], desc: 'On cast, a falcon stoops on the quarry for 500% weapon damage.', mods: { flags: ['markDive'] } },
      { id: 'long_hunt', name: 'Long Hunt', unlock: 52, desc: 'The mark lasts until the quarry dies and costs no Hatred, but the bonus is 15%.', mods: { cost: -100, flags: ['markLong'] } },
    ],
    tiers: [
      { name: 'Clear Sight', desc: 'The mark lasts 25% longer.', mods: { duration: 25 } },
      { name: 'Quick Eye', desc: 'Cooldown reduced by 20%.', mods: { cooldown: -20 } },
      { name: 'Sharp Eye', desc: 'The mark’s bonus is 5 points higher.', mods: { vars: { markPctAdd: 5 } } },
    ],
    nodes: [
      { id: 'keen_sight', name: 'Keen Sight', text: 'The mark’s bonus is {var:markPctAdd} points higher.', maxRank: 3, ranks: v3('markPctAdd', 3), pos: at(0, 0) },
      { id: 'tracker', name: 'Tracker', text: 'You move {var:markSpeed}% faster and attack {var:markHaste}% faster while your quarry is within 400 units.', maxRank: 3,
        ranks: [{ vars: { markHaste: 3, markSpeed: 5 } }, { vars: { markHaste: 3, markSpeed: 5 } }, { vars: { markHaste: 3, markSpeed: 5 } }], pos: at(1, 0) },
      { id: 'pack_signal', name: 'Pack Signal', text: 'Your quarry takes {var:markBeasts}% more damage from your companions and Murmuration.', maxRank: 3, ranks: v3('markBeasts', 15), pos: at(2, 0) },
      { id: 'second_quarry', name: 'Second Quarry', text: 'Also marks the next-strongest enemy at {var:markTwo}% strength.', maxRank: 3,
        ranks: [{ vars: { markTwo: 50 } }, { vars: { markTwo: 25 } }, { vars: { markTwo: 25 } }], requires: needs('keen_sight'), pos: at(0, 1) },
      { id: 'hunting_horn', name: 'Hunting Horn', text: 'When the mark jumps, your companions and Murmuration deal {var:markHorn}% more damage for 4 seconds.', maxRank: 3, ranks: v3('markHorn', 10), requires: needs('tracker'), pos: at(1, 1) },
      { id: 'exposed_joints', name: 'Exposed Joints', text: 'Your quarry deals {var:markWeaken}% less damage.', maxRank: 3, ranks: v3('markWeaken', 5), requires: needs('pack_signal'), pos: at(2, 1) },
    ],
  },
  {
    id: 'pitch_mortar', classId: 'ranger', parityReady: true, name: 'Pitch Mortar', kind: 'summon', unlock: 40, element: 'fire', tags: ['device', 'area', 'ground', 'burn'], category: 'Devices',
    coef: 8.39, cost: 30, gen: 0, cooldown: 0, range: 500, radius: 100, duration: 20, maxSummons: 1,
    auto: { when: 'maintainSummon' },
    // Bible: "+ 1.8 burn over 3 s" — the burning pitch (a data ground) deals the second number.
    vars: { pitchBurn: 1.8 },
    desc: 'Set down a mortar for {duration} seconds. Every 2 seconds it lobs a pitch pot at the densest group 120 to 500 units away, dealing {coef} weapon damage as Fire and leaving burning pitch for 3 seconds.',
    icon: { glyph: 'mortar', color: 0x5b4a3a },
    runes: [
      { id: 'twin_barrels', name: 'Twin Barrels', unlock: 42, desc: '+1 maximum Pitch Mortar.', mods: { maxSummons: 1 } },
      { id: 'grapeshot', name: 'Grapeshot', unlock: 45, addTags: ['projectile'], removeTags: ['ground'], desc: 'Shells burst into 5 pellets for 60% of their damage each instead of leaving pitch.', mods: { flags: ['mortarGrape'] } },
      { id: 'frostpot', name: 'Frostpot', unlock: 49, addTags: ['chill'], removeTags: ['burn'], desc: 'Deals Cold damage; impacts freeze enemies for 1 second and leave no pitch.', mods: { element: 'cold', flags: ['mortarFreeze'] } },
      { id: 'spotter', name: 'Spotter', unlock: 54, desc: 'The Mortar always fires at your Quarry Mark or held enemies when they are in range, and fires 30% faster.', mods: { flags: ['mortarSpotter'] } },
      { id: 'skipping_shell', name: 'Skipping Shell', unlock: 60, desc: 'Shells bounce once before exploding: two impacts at 70% damage.', mods: { flags: ['mortarBounce'] } },
    ],
    tiers: [
      { name: 'Thicker Pitch', desc: '+25% Pitch Mortar damage.', mods: { dmg: 25 } },
      { name: 'Packed Charge', desc: 'Impact radius +25%.', mods: { radius: 25 } },
      { name: 'Long Fuse', desc: 'The Mortar lasts 50% longer.', mods: { duration: 50 } },
    ],
    nodes: [
      { id: 'larger_shells', name: 'Larger Shells', text: 'Impacts cover {radius}% more radius.', maxRank: 3, ranks: [{ radius: 10 }, { radius: 10 }, { radius: 10 }], pos: at(0, 0) },
      { id: 'ammunition_belt', name: 'Ammunition Belt', text: 'Each shell that hits 3 or more enemies restores {var:mortarGen} Hatred.', maxRank: 3, ranks: v3('mortarGen', 1), pos: at(1, 0) },
      { id: 'walking_fire', name: 'Walking Fire', text: '{var:mortarDouble}% chance to fire a second shell at another group at once.', maxRank: 3, ranks: v3('mortarDouble', 20), pos: at(2, 0) },
      { id: 'tar_pit', name: 'Tar Pit', text: 'Pitch ground slows enemies in it by {var:mortarSlow}%.', maxRank: 3, ranks: v3('mortarSlow', 15), requires: needs('larger_shells'), pos: at(0, 1) },
      { id: 'overpressure', name: 'Overpressure', text: 'Every 4th shell has double radius and deals {var:mortarHeavy}% more damage.', maxRank: 3, ranks: v3('mortarHeavy', 50), requires: needs('ammunition_belt'), pos: at(1, 1) },
      { id: 'sled_mount', name: 'Sled Mount', text: 'The Mortar follows you (it stays within 200 units), but fires {var:mortarFollow}% slower while it moves.', maxRank: 3,
        ranks: [{ vars: { mortarFollow: 30 } }, { vars: { mortarFollow: -10 } }, { vars: { mortarFollow: -10 } }], requires: needs('walking_fire'), pos: at(2, 1) },
    ],
  },
  {
    id: 'murmuration', classId: 'ranger', parityReady: true, name: 'Murmuration', kind: 'cooldown', unlock: 50, element: 'physical', tags: ['summon', 'beast', 'area'], category: 'Beasts',
    coef: 3.26, cost: 0, gen: 0, cooldown: 50, range: 500, radius: 120, duration: 10, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 6, within: 450 },
    desc: 'Release a murmuration of birds that sweeps between the densest groups for {duration} seconds, dealing {coef} weapon damage per second to enemies inside it ({radius} units).',
    icon: { glyph: 'flock', color: 0x3a3a4a },
    runes: [
      { id: 'starling_shield', name: 'Starling Shield', unlock: 52, desc: 'Half the flock circles you: you take 25% less damage while it lasts, but it deals 40% less damage.', mods: { flags: ['flockGuard'] } },
      { id: 'crowfeast', name: 'Crowfeast', unlock: 55, desc: 'Enemies the flock kills restore 2 Hatred and extend it by 0.5 seconds (at most 5 seconds).', mods: { flags: ['flockFeast'] } },
      { id: 'stormbirds', name: 'Stormbirds', unlock: 59, desc: 'Deals Lightning damage; every 0.5 seconds the flock arcs to 2 enemies outside it for 50% weapon damage each.', mods: { element: 'lightning', flags: ['flockArc'] } },
      { id: 'split_flock', name: 'Split Flock', unlock: 64, desc: 'Two flocks with a 30% smaller radius, each dealing 60% of the damage.', mods: { flags: ['flockSplit'] } },
      { id: 'pecking_order', name: 'Pecking Order', unlock: 70, desc: 'The flock hunts your Quarry Mark or the nearest elite and deals 50% more damage to it.', mods: { flags: ['flockElite'] } },
    ],
    tiers: [
      { name: 'Dense Flock', desc: '+25% Murmuration damage.', mods: { dmg: 25 } },
      { name: 'Early Roost', desc: 'Cooldown reduced by 20%.', mods: { cooldown: -20 } },
      { name: 'Long Sky', desc: 'The flock stays 30% longer.', mods: { duration: 30 } },
    ],
    nodes: [
      { id: 'thick_flock', name: 'Thick Flock', text: 'Murmuration deals {dmg}% increased damage.', maxRank: 3, ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: at(0, 0) },
      { id: 'shadow_cover', name: 'Shadow Cover', text: 'While the flock is out you take {var:flockCover}% less damage.', maxRank: 3, ranks: v3('flockCover', 5), pos: at(1, 0),
        effects: [{ kind: 'damageTaken', pct: { roll: -5 }, when: { buff: 'murmuration' } }] },
      { id: 'gathering_flock', name: 'Gathering Flock', text: 'The flock’s radius grows by 10% every 2 seconds, up to {var:flockGrow}% larger.', maxRank: 3, ranks: v3('flockGrow', 20), pos: at(2, 0) },
      // Bible: "enemies inside are chilled 20 / 35 / 50%" (a slow of that strength, engine wave 3).
      { id: 'feather_storm', name: 'Feather Storm', text: 'Enemies inside the flock are slowed by {var:flockSlow}%.', maxRank: 3, ranks: v3('flockSlow', 20, 15, 15), requires: needs('thick_flock'), pos: at(0, 1) },
      { id: 'return_to_roost', name: 'Return to Roost', text: 'When it ends, {var:flockRefund}% of the cooldown is refunded for each elite it killed (at most 50%).', maxRank: 3, ranks: v3('flockRefund', 10), requires: needs('shadow_cover'), pos: at(1, 1) },
      { id: 'stoop', name: 'Stoop', text: 'Every 2 seconds the flock stoops on one enemy for {var:flockStoop}% weapon damage.', maxRank: 3,
        ranks: [{ vars: { flockStoop: 150 } }, { vars: { flockStoop: 100 } }, { vars: { flockStoop: 100 } }], requires: needs('gathering_flock'), pos: at(2, 1) },
    ],
  },
];
