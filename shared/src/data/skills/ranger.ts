// Ranger skills (data only). Behaviour lives in server/src/sim/skills/ranger.ts; recipe in docs/rework/depth/FOUNDATION.md.

import type { SkillDef } from './types';

/** Order matters: it is the registry order (skill pickers, affix rolls), so append new skills at the end. */
export const RANGER_SKILLS: SkillDef[] = [
  {
    id: 'hungering_arrow', classId: 'ranger', name: 'Hungering Arrow', kind: 'primary', unlock: 1, element: 'physical', tags: ['projectile'],
    coef: 1.55, cost: 0, gen: 3, cooldown: 0, range: 380, radius: 0, duration: 0, maxSummons: 0,
    auto: { when: 'always' },
    desc: 'Fire a magically imbued arrow that seeks out enemies for {coef} weapon damage, with a 35% chance to pierce. Generates {gen} Hatred.',
    icon: { glyph: 'arrow', color: 0x8fd16a },
    runes: [
      { id: 'puncturing', name: 'Puncturing Arrow', unlock: 3, desc: 'Pierce chance increased by 50%.', mods: { pierce: 50 } },
      { id: 'shatter_shot', name: 'Shatter Shot', unlock: 6, desc: 'Piercing splits the arrow into 3 smaller arrows dealing Cold damage.', mods: { element: 'cold', flags: ['splitOnPierce'] } },
      { id: 'devouring', name: 'Devouring Arrow', unlock: 10, desc: 'Each consecutive pierce deals 70% more damage.', mods: { flags: ['devouring'] } },
    ],
    tiers: [
      { name: 'Fletcher', desc: '+20% Hungering Arrow damage.', mods: { dmg: 20 } },
      { name: 'Twin Draw', desc: 'Fire an additional arrow.', mods: { projectiles: 1 } },
      { name: 'Bloodscent', desc: 'Generates 2 additional Hatred.', mods: { gen: 2 } },
    ],
  },
  {
    id: 'sentry', classId: 'ranger', name: 'Sentry', kind: 'summon', unlock: 2, element: 'physical', tags: ['summon', 'projectile'],
    coef: 2.8, cost: 20, gen: 0, cooldown: 8, range: 380, radius: 380, duration: 30, maxSummons: 2,
    auto: { when: 'maintainSummon' },
    desc: 'Deploy a turret at your feet that fires bolts at enemies for {coef} weapon damage each second. Up to {max} Sentries; lasts {duration} seconds.',
    icon: { glyph: 'turret', color: 0xc9a227 },
    runes: [
      { id: 'spitfire', name: 'Spitfire Turret', unlock: 4, tags: ['projectile'], desc: 'The turret also fires homing rockets dealing 120% weapon damage as Fire.', mods: { flags: ['rockets'] } },
      { id: 'chain_of_torment', name: 'Chain of Torment', unlock: 7, desc: 'Lightning chains form between your Sentries, dealing 300% weapon damage per second to enemies that cross them.', mods: { flags: ['chains'] } },
      { id: 'polar_station', name: 'Polar Station', unlock: 11, desc: 'Bolts deal Cold damage and chill enemies by 60%.', mods: { element: 'cold', flags: ['chill'] } },
    ],
    tiers: [
      { name: 'Reinforced Frame', desc: '+25% Sentry damage.', mods: { dmg: 25 } },
      { name: 'Rapid Assembly', desc: 'Sentry cooldown reduced by 25%.', mods: { cooldown: -25 } },
      { name: 'Custom Engineering', desc: '+1 maximum Sentry and Sentries last 50% longer.', mods: { maxSummons: 1, duration: 50 } },
    ],
  },
  {
    id: 'multishot', classId: 'ranger', name: 'Multishot', kind: 'spender', unlock: 4, element: 'physical', tags: ['projectile', 'area'],
    coef: 3.6, cost: 25, gen: 0, cooldown: 0, range: 380, radius: 0, duration: 0, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 2, within: 380 },
    desc: 'Fire a massive volley of arrows in a wide arc, dealing {coef} weapon damage to every enemy hit.',
    icon: { glyph: 'fan', color: 0x9bd36f },
    runes: [
      { id: 'fire_at_will', name: 'Fire at Will', unlock: 6, desc: 'Deals Lightning damage and costs 40% less Hatred.', mods: { element: 'lightning', cost: -40 } },
      { id: 'arsenal', name: 'Arsenal', unlock: 9, tags: ['projectile'], desc: 'Also fires 3 rockets at nearby enemies for 300% weapon damage as Fire.', mods: { flags: ['rockets'] } },
      { id: 'full_broadside', name: 'Full Broadside', unlock: 13, desc: 'Multishot deals 50% more damage.', mods: { dmg: 50 } },
    ],
    tiers: [
      { name: 'Volley Drill', desc: '+20% Multishot damage.', mods: { dmg: 20 } },
      { name: 'Extra Quivers', desc: '+4 arrows in the volley.', mods: { projectiles: 4 } },
      { name: 'Hatred Harvest', desc: 'Costs 25% less Hatred.', mods: { cost: -25 } },
    ],
  },
  {
    id: 'cluster_arrow', classId: 'ranger', name: 'Cluster Arrow', kind: 'spender', unlock: 6, element: 'fire', tags: ['projectile', 'area'],
    coef: 6.5, cost: 40, gen: 0, cooldown: 0, range: 380, radius: 110, duration: 0, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 3, within: 380 },
    desc: 'Lob an explosive arrow into the densest pack. It detonates for {coef} weapon damage as Fire, then releases 4 grenades for 210% weapon damage each.',
    icon: { glyph: 'cluster', color: 0xe67e22 },
    runes: [
      { id: 'maelstrom', name: 'Maelstrom', unlock: 8, tags: ['projectile'], desc: 'Releases 3 homing rockets instead of grenades.', mods: { flags: ['rockets'] } },
      { id: 'shooting_stars', name: 'Shooting Stars', unlock: 11, desc: 'Deals Lightning damage; grenades become falling stars.', mods: { element: 'lightning' } },
      { id: 'loaded_for_bear', name: 'Loaded for Bear', unlock: 15, desc: 'Explosion radius +40% and +80% damage, but no grenades.', mods: { radius: 40, dmg: 80, flags: ['noGrenades'] } },
    ],
    tiers: [
      { name: 'Black Powder', desc: '+25% Cluster Arrow damage.', mods: { dmg: 25 } },
      { name: 'Wide Payload', desc: 'Explosion radius +25%.', mods: { radius: 25 } },
      { name: 'Frugal Fuse', desc: 'Costs 20% less Hatred.', mods: { cost: -20 } },
    ],
  },
  {
    id: 'rain_of_vengeance', classId: 'ranger', name: 'Rain of Vengeance', kind: 'cooldown', unlock: 9, element: 'physical', tags: ['area', 'ground'],
    coef: 15, cost: 0, gen: 0, cooldown: 30, range: 380, radius: 240, duration: 5, maxSummons: 0,
    auto: { when: 'enemiesNear', count: 5, within: 380 },
    desc: 'Call down a storm of arrows on a large area, dealing {coef} weapon damage over {duration} seconds.',
    icon: { glyph: 'rain', color: 0x5dade2 },
    runes: [
      { id: 'dark_cloud', name: 'Dark Cloud', unlock: 11, desc: 'Deals Lightning damage; the storm follows the densest pack.', mods: { element: 'lightning', flags: ['follow'] } },
      { id: 'beastly_bombs', name: 'Beastly Bombs', unlock: 14, desc: 'Deals Fire damage and 50% more damage in a shorter burst.', mods: { element: 'fire', dmg: 50, duration: -40 } },
      { id: 'stampede', name: 'Stampede', unlock: 18, desc: 'Cooldown reduced by 33%.', mods: { cooldown: -33 } },
    ],
    tiers: [
      { name: 'Hail of Shafts', desc: '+30% Rain of Vengeance damage.', mods: { dmg: 30 } },
      { name: 'Vengeance Renewed', desc: 'Cooldown reduced by 20%.', mods: { cooldown: -20 } },
      { name: 'Wide Storm', desc: 'Radius increased by 30%.', mods: { radius: 30 } },
    ],
  },
  {
    id: 'companion', classId: 'ranger', name: 'Companion', kind: 'summon', unlock: 12, element: 'physical', tags: ['summon', 'melee'],
    coef: 1.5, cost: 0, gen: 0, cooldown: 0, range: 320, radius: 0, duration: 0, maxSummons: 1,
    auto: { when: 'maintainSummon' },
    desc: 'A loyal wolf fights at your side, biting enemies for {coef} weapon damage.',
    icon: { glyph: 'paw', color: 0xa0a0a0 },
    runes: [
      { id: 'wolf_howl', name: 'Pack Leader', unlock: 14, desc: 'Your wolf howls, increasing your damage by 15%.', mods: { flags: ['wolfAura'] } },
      { id: 'bat', name: 'Bat Companion', unlock: 17, desc: 'A bat replaces the wolf and generates 1 Hatred per second.', mods: { flags: ['batCompanion'] } },
      { id: 'raven', name: 'Raven Companion', unlock: 21, desc: 'A raven replaces the wolf, dealing Lightning damage and 50% more.', mods: { element: 'lightning', dmg: 50, flags: ['ravenCompanion'] } },
    ],
    tiers: [
      { name: 'Sharpened Fangs', desc: '+50% Companion damage.', mods: { dmg: 50 } },
      { name: 'Alpha', desc: '+80% Companion damage.', mods: { dmg: 80 } },
      { name: 'Twin Bond', desc: 'Summon a second companion.', mods: { maxSummons: 1 } },
    ],
  },
];
