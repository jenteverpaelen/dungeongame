// Mage legendary powers and sets (data only; power templates from shared/src/powers.ts).
// Append new entries at the end (registry order is observable through loot rolls). Recipe: docs/rework/depth/FOUNDATION.md §5.
// Content: docs/rework/depth/MAGE.md §7–§8 (bible v2). Shipping text describes mechanics only (ITEMS-SHARED.md §0):
// every clause in a text is implemented; clauses that need engine wave 3 are listed in docs/rework/depth/MAGE-PILOT.md and
// are added (text and effect together) when the primitive exists. Behaviour flags / vars are read by
// server/src/sim/skills/mage*.ts.

import type { LegendaryDef, SetDef } from '../items';
import { ROLL, conditional, flags, ownMult, proc, rolledCost, rolledDamage, skillMods, skillMore, tagged, type Condition } from '../../powers';

/** Every mage skill (each carries an element tag). */
const ANY_SKILL = tagged('physical', 'fire', 'cold', 'lightning', 'arcane');
/** Chilled or frozen enemies (Winterbound Robe, Hoarfrost Vigil 6). */
const CHILLED_OR_FROZEN: Condition = { any: [{ targetState: 'chilled' }, { targetState: 'frozen' }] };

// Colours per motif (ITEMS-SHARED.md §6): the existing items' triples [M] where the motif has one, the set palettes otherwise.
const VOID = { primary: 0x1b0f2e, secondary: 0x8e44ad, glow: 0xc39bff }; // Heart of the Void [M]
const STAR = { primary: 0x1f2a5a, secondary: 0xf5d76e, glow: 0xffe08a }; // Starfall Mantle [M]
const EMBER = { primary: 0x4a2a1a, secondary: 0xff7a1a, glow: 0xff9a3c }; // Cindervane [M]
const LANTERN = { primary: 0x404a31, secondary: 0xe6b45f, glow: 0xf6cd7d }; // Lanternroot [M]
const SHARD = { primary: 0x667996, secondary: 0xe8e0ff, glow: 0xd6c2ff }; // Glass Concord / Spindle [M]
const FROST = { primary: 0x5d7f99, secondary: 0xdff6ff, glow: 0x9fdcff }; // Hoarfrost Vigil (bible)
const CHIME = { primary: 0x3d3566, secondary: 0xc8b6ff, glow: 0xd6c2ff }; // Hollowstar Choir (bible)
const ARCANE = { primary: 0x2a1a4a, secondary: 0x9b59b6, glow: 0xc39bff }; // Magic Weapon's icon colour [M]
const STORM = { primary: 0x2a3a4a, secondary: 0x7fd3ff, glow: 0x9fe3ff };

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
  // ─────────────────────────── M1 (bible v2 §8): named signatures, then tag-keyed powers ───────────────────────────
  // "Pulls from 30% farther": the Black Hole's pull reaches as far as its radius.
  { id: 'undertow_staff', name: 'Undertow Staff', base: 'staff', classes: ['mage'], power: 'Black Hole deals {v}% increased damage and pulls from 30% farther.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Lean on it and the floor leans back.', colors: VOID,
    effects: [rolledDamage('black_hole', { radius: 30 })] },
  { id: 'frostlocked_wand', name: 'Frostlocked Wand', base: 'wand', classes: ['mage'], power: 'Frost Nova also goes off around your target and deals {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Aven found it in the cistern, unmelted.', colors: FROST,
    effects: [rolledDamage('frost_nova', { flags: ['novaAtTarget'] })] },
  { id: 'hoarneedle_wand', name: 'Hoarneedle Wand', base: 'wand', classes: ['mage'], power: 'Rime Needles fires 2 more needles and deals {v}% increased damage.', range: [100, 150], cubeSlot: 'weapon', flavor: 'Prick your finger and it frosts over.', colors: { primary: 0x5d7f99, secondary: 0xffffff, glow: 0xbfe9ff },
    effects: [rolledDamage('rime_needles', { projectiles: 2 })] },
  { id: 'resonant_staff', name: 'Resonant Staff', base: 'staff', classes: ['mage'], power: 'Thrumming Ray reaches full resonance 50% faster and deals {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Hum near it and it hums back.', colors: CHIME,
    effects: [rolledDamage('thrumming_ray', { vars: { rampRate: 50 } })] },
  { id: 'kindling_rod', name: 'Kindling Rod', base: 'rod', classes: ['mage'], power: 'You may have 2 more Cinderkin, and Cinderkin deal {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Kessa says sorry to it every morning.', colors: EMBER,
    effects: [rolledDamage('cinderkin', { maxSummons: 2 })] },
  { id: 'cistern_staff', name: 'Cistern Staff', base: 'staff', classes: ['mage'], power: 'Rimefield freezes enemies after 0.75 seconds instead of 1.5 and deals {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Drawn from water that never moved.', colors: { primary: 0x2c4458, secondary: 0xdff6ff, glow: 0x9fdcff },
    effects: [rolledDamage('rimefield', { flags: ['rimeQuick'] })] },
  { id: 'stormglass_prism', name: 'Stormglass Prism', base: 'orb', classes: ['mage'], power: 'Stormglass Orb zaps 2 more enemies and deals {v}% increased damage.', range: [150, 200], cubeSlot: 'armor', flavor: 'There is a storm in there. Do not let it out.', colors: STORM,
    effects: [rolledDamage('stormglass_orb', { vars: { orbZaps: 2 } })] },
  { id: 'armillary_staff', name: 'Armillary Staff', base: 'staff', classes: ['mage'], power: 'Orrery has 2 more spheres and deals {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'All the rings still turn.', colors: STAR,
    effects: [rolledDamage('orrery', { vars: { spheres: 2 } })] },
  { id: 'runeweaver_cuffs', name: 'Runeweaver Cuffs', base: 'wrists_bracers', classes: ['mage'], power: 'Magic Weapon costs 100% less Arcane Power, and while it is active you attack {v}% faster.', range: [10, 15], cubeSlot: 'armor', flavor: 'Stitched in a script older than the stitches.', colors: ARCANE,
    effects: [skillMods(['magic_weapon'], { cost: -100 }, { field: 'var:weaponIas' })] },
  { id: 'glasswrights_wraps', name: 'Glasswright’s Wraps', base: 'hands_wraps', classes: ['mage'], power: 'Your Projectiles pierce one enemy (50% damage after the pierce) and deal {v}% more damage to enemies after a pierce.', range: [25, 40], cubeSlot: 'armor', flavor: 'Fine cuts on every fingertip.', colors: SHARD,
    effects: [skillMods(tagged('projectile'), { flags: ['glassPierce'] }, { field: 'var:glassPierce' })] },
  { id: 'echoing_bead', name: 'Echoing Bead', base: 'ring', classes: ['mage'], power: 'Your Primary skills have a {v}% chance to be cast twice.', range: [20, 30], cubeSlot: 'jewelry', flavor: 'It answers before you ask.', colors: { primary: 0x667996, secondary: 0xc6b88c, glow: 0xd6c2ff },
    effects: [skillMods(tagged('primary'), {}, { field: 'var:echoBead' })] },
  { id: 'craterheart_amulet', name: 'Craterheart Amulet', base: 'neck_amulet', classes: ['mage'], power: 'Your Aerial skills deal {v}% increased damage, and their Ground effects pull enemies 20 units per second inward.', range: [60, 90], cubeSlot: 'jewelry', flavor: 'Still warm from where it landed.', colors: STAR,
    effects: [skillMods(tagged('aerial'), { flags: ['craterPull'] }, { field: 'dmg' })] },
  { id: 'horizon_cowl', name: 'Horizon Cowl', base: 'head_wizard', classes: ['mage'], power: 'Your Ground skills deal {v}% increased damage, and your Ground effects last 1 second longer.', range: [40, 60], cubeSlot: 'armor', flavor: 'The brim hides a second sky.', colors: VOID,
    effects: [skillMods(tagged('ground'), { vars: { groundPlusMs: 1000 } }, { field: 'dmg' })] },
  { id: 'winterbound_robe', name: 'Winterbound Robe', base: 'chest_robe', classes: ['mage'], power: 'Your Cold skills deal {v}% more damage to Chilled or frozen enemies.', range: [25, 40], cubeSlot: 'armor', flavor: 'Hems stiff with old frost.', colors: FROST,
    effects: [skillMore(tagged('cold'), ROLL, CHILLED_OR_FROZEN)] },
  { id: 'rimecourt_band', name: 'Rimecourt Band', base: 'ring', classes: ['mage'], power: 'Each enemy you freeze reduces your Chill skills’ cooldowns by 0.5 seconds (at most {v} seconds per cast).', range: [2, 3], cubeSlot: 'jewelry', flavor: 'A ring of ice that refuses to be water.', colors: FROST,
    effects: [skillMods(tagged('chill'), {}, { field: 'var:rimecourt' })] },
  { id: 'coiled_pauldrons', name: 'Coiled Pauldrons', base: 'shoulders_mantle', classes: ['mage'], power: 'Your Summons deal {v}% more damage, and summoned projectiles pierce in a short line.', range: [20, 30], cubeSlot: 'armor', flavor: 'They tighten when something hisses.', colors: LANTERN,
    effects: [skillMore(tagged('summon'), ROLL), flags(tagged('summon'), 'summonPierce')] },
  { id: 'lanternkeepers_sash', name: 'Lanternkeeper’s Sash', base: 'waist_sash', classes: ['mage'], power: 'Your Summons last {v}% longer, and summoning one adds 2 seconds to your others.', range: [30, 40], cubeSlot: 'armor', flavor: 'Every knot holds a little light.', colors: LANTERN,
    effects: [skillMods(tagged('summon'), { flags: ['summonExtend'] }, { field: 'duration' })] },
  { id: 'glyphstone_orb', name: 'Glyphstone Orb', base: 'orb', classes: ['mage'], power: 'Your Buff skills’ damage bonuses are {v} points higher, and their rune effects trigger 50% more often.', range: [10, 15], cubeSlot: 'armor', flavor: 'The letters rearrange when nobody looks.', colors: ARCANE,
    effects: [skillMods(tagged('buff'), { vars: { weaponProc: 50 } }, { field: 'var:buffPoints' })] },
  // "While a Buff skill is active": Magic Weapon is the mage's one Buff skill.
  // Fit [M] (MAGE-PILOT.md §4): the bible's per-crit 0.1–0.2 s without a limit measured ×1.6–3.2 on its own in mage
  // legendary-only kits (every crit of every multi-hit skill; Orrery ×3.17) and sat in nearly every top kit. Gated like
  // D3's Obsidian Ring of the Zodiac (once per cast) with a 0.5 s internal cooldown: ×1.03–1.28 measured.
  { id: 'spellwrights_circlet', name: 'Spellwright’s Circlet', base: 'head_circlet', classes: ['mage'], power: 'While a Buff skill is active, your critical hits reduce your cooldowns by {v} seconds (once every 0.5 seconds).', range: [0.1, 0.2], cubeSlot: 'armor', flavor: 'Ink stains on the inside.', colors: ARCANE,
    effects: [proc('crit', { reduceCooldownsMs: { roll: 1000 }, icdMs: 500, when: { buff: 'magic_weapon' } })] },
  { id: 'frostthread_gloves', name: 'Frostthread Gloves', base: 'hands_wraps', classes: ['mage'], power: 'Your Primary skills deal {v}% more damage to frozen enemies and re-freeze them for 0.25 seconds.', range: [25, 40], cubeSlot: 'armor', flavor: 'The thread was spun in February.', colors: FROST,
    effects: [skillMore(tagged('primary'), ROLL, { targetState: 'frozen' }), flags(tagged('primary'), 'refreeze')] },
  // [P] the bible gives no burst radius or chill duration: 100 units (Frost Nova's ring is 190) and 2 s (Frost Spit's chill [M]).
  { id: 'snowglobe_pendant', name: 'Snowglobe Pendant', base: 'neck_amulet', classes: ['mage'], power: 'Freezing an enemy releases a burst of frost around it for {v}% weapon damage that Chills enemies within 100 units for 2 seconds (once every 6 seconds).', range: [60, 80], cubeSlot: 'jewelry', flavor: 'Shake it gently.', colors: FROST,
    effects: [proc('applyStatus', { status: ['freeze'], icdMs: 6000, strike: { id: 'snowglobe_burst', coef: { roll: 0.01 }, radius: 100, element: 'cold', tags: ['area', 'chill'], visual: 'nova' }, applyStatus: { kind: 'chill', ms: 2000, radius: 100 } })] },
  { id: 'hornlistener_circlet', name: 'Hornlistener Circlet', base: 'head_circlet', classes: ['mage'], power: 'Your Piercing skills deal {v}% more damage to enemies farther than 200 units.', range: [25, 40], cubeSlot: 'armor', flavor: 'Eris and Daro still argue about what it hears.', colors: CHIME,
    effects: [skillMore(tagged('piercing'), ROLL, { targetFartherThan: 200 })] },
  { id: 'signal_coil', name: 'Signal Coil', base: 'ring', classes: ['mage'], power: 'Your Channel skills deal {v}% increased damage, and your resource regeneration is 30% higher while channelling.', range: [60, 90], cubeSlot: 'jewelry', flavor: 'Warm whenever the array is singing.', colors: CHIME,
    effects: [skillMods(tagged('channel'), { flags: ['coilRegen'] }, { field: 'dmg' })] },
  // Bible: "your Burn effects deal {v}% more". The mage's damage-over-time effects are all Burns; the engine's dot strength
  // (the dotDmg stat) covers every kind, so the text says damage-over-time. The Burn on hit uses Ignite's numbers [M].
  { id: 'firekeepers_gloves', name: 'Firekeeper’s Gloves', base: 'hands_wraps', classes: ['mage'], power: 'Your damage-over-time effects deal {v}% more damage, and your Summons’ hits make enemies Burn for 100% weapon damage over 3 seconds.', range: [25, 35], cubeSlot: 'armor', flavor: 'Too big for anyone. Worn anyway.', colors: EMBER,
    effects: [{ kind: 'stat', stat: 'dotDmg', value: ROLL }, proc('hit', { tags: tagged('summon'), applyStatus: { kind: 'burn', coef: 1, ms: 3000 } })] },
  // Movement skill = the dash (engine wave 3 trigger dashEnd). The proc grants the marker buff 'rimewalker' for its 8 s
  // internal cooldown (the HUD shows it recharging); the mage tick answers each new one with a half-size copy of your most recent Ground effect
  // (molten ground, Black Hole or Rimefield) at the landing point (server mageKit / mage.copyGround).
  { id: 'rimewalker_slippers', name: 'Rimewalker Slippers', base: 'feet_shoes', classes: ['mage'], power: 'Your Ground effects deal {v}% more damage, and when a Movement skill ends you drop a half-size copy of your most recent Ground effect (once every 8 seconds).', range: [25, 35], cubeSlot: 'armor', flavor: 'Every step leaves a little winter.', colors: FROST,
    effects: [skillMore(tagged('ground'), ROLL), proc('dashEnd', { icdMs: 8000, buff: { id: 'rimewalker', ms: 8000 } })] },
  { id: 'conductors_legwraps', name: 'Conductor’s Legwraps', base: 'legs_cloth', classes: ['mage'], power: 'Your Lightning skills chain to one more enemy and deal {v}% more damage.', range: [25, 35], cubeSlot: 'armor', flavor: 'Copper thread, carefully insulated.', colors: STORM,
    effects: [skillMore(tagged('lightning'), ROLL), skillMods(tagged('lightning'), { vars: { chains: 1 } })] },
  { id: 'static_loop', name: 'Static Loop', base: 'ring', classes: ['mage'], power: 'Your Spender skills deal {v}% increased damage, and each enemy they hit refunds 1 Arcane Power (at most 8 per cast).', range: [60, 90], cubeSlot: 'jewelry', flavor: 'Your hair will stand up.', colors: STORM,
    effects: [skillMods(tagged('spender'), { flags: ['staticLoop'] }, { field: 'dmg' })] },
  { id: 'starchart_robe', name: 'Star-Chart Robe', base: 'chest_robe', classes: ['mage'], power: 'While you stand still, your Arcane skills deal {v}% more damage and your Summons attack 30% faster.', range: [25, 40], cubeSlot: 'armor', flavor: 'The stars on it move with the season.', colors: STAR,
    effects: [skillMore(tagged('arcane'), ROLL, { standingStill: true }), flags(tagged('summon'), 'starChartHaste')] },
  { id: 'clockmakers_ring', name: 'Clockmaker’s Ring', base: 'ring', classes: ['mage'], power: 'Your Cooldown skills’ cooldowns are {v}% shorter.', range: [15, 20], cubeSlot: 'jewelry', flavor: 'Wind it before bed.', colors: STAR,
    effects: [skillMods(tagged('cooldown'), {}, { field: 'cooldown', sign: -1 })] },
];

/** Bible v2 set colours: every set glows 0x3cff6e [M]. */
const glow = 0x3cff6e;
const MAGE_FOOTPRINT = ['head_wizard', 'shoulders_mantle', 'chest_robe', 'hands_wraps', 'legs_cloth', 'feet_shoes'];
const PARTS = ['Crown', 'Mantle', 'Vest', 'Grips', 'Legwraps', 'Treads'];

// parityLoadout: the internal test fixture for the set (MAGE.md §2), never shown to players.
export const MAGE_SETS: SetDef[] = [
  {
    id: 'fallen_star', name: 'Regalia of the Fallen Star', classId: 'mage',
    pieces: [
      { base: 'head_wizard', name: 'Crown of the Fallen Star' }, { base: 'shoulders_mantle', name: 'Mantle of Burning Skies' },
      { base: 'chest_robe', name: 'Robes of the Comet' }, { base: 'hands_wraps', name: 'Starcaller Wraps' },
      { base: 'legs_cloth', name: 'Leggings of the Long Night' }, { base: 'feet_shoes', name: 'Ashwalker Slippers' },
    ],
    bonuses: [
      // Generalises the old second meteor [M] to every Aerial skill, at 60 % damage.
      { count: 2, text: 'Your Aerial skills strike a second time on a nearby enemy at 60% damage, and your Spender skills cost 10% less.',
        effects: [flags(tagged('aerial'), 'aerialEcho'), skillMods(tagged('spender'), { cost: -10 })] },
      // Moved from its own multiplier (×1.5 per element [M]) into the generic damage bucket (bible §9.3).
      { count: 4, text: 'Each element (Arcane, Cold, Fire, Lightning) you dealt damage with in the last 8 seconds grants 5% increased damage (at most 4).',
        effects: [{ kind: 'elementStacks', elements: ['arcane', 'cold', 'fire', 'lightning'], windowMs: 8000, perStack: 5, buff: 'fallen_star', bucket: 'generic' }] },
      { count: 6, text: 'Every fourth Spender cast also calls three craters in a line that pull enemies toward the first one. Your Aerial and Spender skills deal 25% more damage.',
        effects: [flags(tagged('spender'), 'fallingStar'), ownMult(tagged('aerial', 'spender'), 1.25)] },
    ],
    colors: { primary: 0x23154a, secondary: 0xff9a3c, glow },
    parityLoadout: ['meteor', 'black_hole', 'frost_nova', 'magic_weapon'],
  },
  {
    id: 'glass_concord', name: 'Glass Concord', classId: 'mage',
    pieces: MAGE_FOOTPRINT.map((base, i) => ({ base, name: `Glass Concord ${PARTS[i]}` })),
    bonuses: [
      // The item / set count cap (+2 projectiles per skill, BUDGET.md R7) applies.
      { count: 2, text: 'Your Projectile skills fire 1 more projectile.', effects: [skillMods(tagged('projectile'), { projectiles: 1 })] },
      { count: 4, text: 'Your Projectiles that hit an enemy inside one of your Ground effects split into 2 shards that deal 40% damage each, your Projectile skills deal 10% more damage, and you take 20% less damage while one of your Ground effects is active.',
        effects: [flags(tagged('projectile'), 'groundSplit'), skillMore(tagged('projectile'), 10), flags(ANY_SKILL, 'glassWard')] },
      { count: 6, text: 'Projectiles that kill shatter into 3 shards that seek new targets and deal 50% damage each. Your Projectile skills and their shards deal 25% more damage.',
        effects: [flags(tagged('projectile'), 'shatterOnKill'), ownMult(tagged('projectile'), 1.25)] },
    ],
    colors: { primary: 0x667996, secondary: 0xc6b88c, glow },
    parityLoadout: ['stormglass_orb', 'black_hole', 'frost_nova', 'magic_weapon'],
  },
  {
    // Lead decision (c): Lantern Garden becomes a Summon set (it named Hydra and Frost Nova [M]).
    id: 'lantern_garden', name: 'Lantern Garden', classId: 'mage',
    pieces: MAGE_FOOTPRINT.map((base, i) => ({ base, name: `Lantern Garden ${PARTS[i]}` })),
    bonuses: [
      { count: 2, text: 'Your Summon skills get 1 more maximum each, and your Summons last 30% longer.', effects: [skillMods(tagged('summon'), { maxSummons: 1, duration: 30 })] },
      { count: 4, text: 'Your Summons that expire leave a lantern for 4 seconds (radius 200) in which your Summons attack 30% faster, and you take 15% less damage while you have 3 or more Summons.',
        effects: [flags(tagged('summon'), 'summonLantern')] },
      { count: 6, text: 'Every third attack by one of your Summons calls an ember sprite for 6 seconds that claws for 100% weapon damage per second (at most 6). Your Summons deal 25% more damage.',
        effects: [flags(tagged('summon'), 'emberSprites'), ownMult(tagged('summon'), 1.25)] },
    ],
    colors: { primary: 0x536745, secondary: 0xc6b88c, glow },
    parityLoadout: ['hydra', 'cinderkin', 'frost_nova', 'magic_weapon'],
  },
  // ─────────────────────────── M1 sets (bible v2 §7) ───────────────────────────
  {
    // Lead decision (c): Frost Nova moves into this Chill set.
    id: 'hoarfrost_vigil', name: 'Hoarfrost Vigil', classId: 'mage',
    pieces: [
      { base: 'head_wizard', name: 'Hoarfrost Hat' }, { base: 'shoulders_mantle', name: 'Icicle Mantle' }, { base: 'chest_robe', name: 'Vigil Robe' },
      { base: 'hands_wraps', name: 'Rimehand Wraps' }, { base: 'legs_cloth', name: 'Snowdrift Leggings' }, { base: 'feet_shoes', name: 'Frostprint Slippers' },
    ],
    bonuses: [
      { count: 2, text: 'Your Chill and Ground skills’ cooldowns are 15% shorter and their areas 15% larger.', effects: [skillMods(tagged('chill', 'ground'), { cooldown: -15, radius: 15 })] },
      { count: 4, text: 'Frozen enemies take 20% more damage from you, you take 20% less damage from Chilled enemies, and your Chills linger 1 second after a freeze ends.',
        effects: [conditional({ targetState: 'frozen' }, 'hit', 20), { kind: 'damageTaken', pct: -20, when: { targetState: 'chilled' } }, flags(ANY_SKILL, 'chillLinger')] },
      { count: 6, text: 'Enemies Chilled for 3 seconds straight freeze for 1 second (at most once every 6 seconds each), and frozen enemies you kill burst into 3 frost needles. All your skills deal 35% more damage to Chilled or frozen enemies.',
        effects: [flags(ANY_SKILL, 'deepFrost', 'frozenKillNeedles'), conditional(CHILLED_OR_FROZEN, 'hit', 35)] },
    ],
    colors: { primary: 0x5d7f99, secondary: 0xdff6ff, glow },
    parityLoadout: ['rimefield', 'frost_nova', 'black_hole', 'magic_weapon'],
  },
  {
    // Footprint: circlet, mantle, robe, wraps, sash and bracers (legs and feet stay free for legendaries).
    id: 'hollowstar_choir', name: 'Hollowstar Choir', classId: 'mage',
    pieces: [
      { base: 'head_circlet', name: 'Listener’s Circlet' }, { base: 'shoulders_mantle', name: 'Chorus Mantle' }, { base: 'chest_robe', name: 'Array Robe' },
      { base: 'hands_wraps', name: 'Tuning Wraps' }, { base: 'waist_sash', name: 'Signal Sash' }, { base: 'wrists_bracers', name: 'Resonance Bracers' },
    ],
    bonuses: [
      { count: 2, text: 'Your Channel skills reach full power 50% faster and cost 15% less.', effects: [skillMods(tagged('channel'), { cost: -15, vars: { rampRate: 50 } })] },
      // Bible: Spender skills cost 30% less. Measured (mage parity harness, Meteor with tier 3 and Starfall Mantle in the
      // Cube): cost cuts add up (1 − 0.25 − 0.30 − 0.40 → 5% of the cost), the 4-piece made Hollowstar the best Meteor kit
      // at ×106 against ×24 for legendary-only. 10% (the Fallen Star 2-piece's cut) fits.
      { count: 4, text: 'While channelling you take 25% less damage, your Buff skills’ damage bonuses are doubled, your Spender skills cost 10% less, and your Channel skills deal 15% more damage.',
        effects: [{ kind: 'damageTaken', pct: -25, when: { channeling: true } }, flags(tagged('buff'), 'buffDouble'), skillMods(tagged('spender'), { cost: -10 }), skillMore(tagged('channel'), 15)] },
      // "At full channel power": the ray holds the buff 'full_resonance' while it is at full resonance (class code).
      // Bible: 3 beams at 40%. Measured (Thrumming Ray, 3 seeds, mage items): the refraction alone was worth ×1.2–1.3, above
      // BUDGET.md R1's ×1.10 for a 6-piece transform (one refracted beam always runs on through the struck enemy); 15%.
      { count: 6, text: 'When one of your Channel beams passes through one of your Projectiles or Ground effects, it refracts into 3 beams that deal 15% damage each. Your Channel and Arcane skills deal 35% more damage while a Channel skill is at full power.',
        effects: [skillMods(tagged('channel'), { flags: ['beamRefract'], vars: { refractPct: 15 } }), conditional({ buff: 'full_resonance' }, 'own', 35, tagged('channel', 'arcane'))] },
    ],
    colors: { primary: 0x3d3566, secondary: 0xc8b6ff, glow },
    parityLoadout: ['thrumming_ray', 'frost_nova', 'black_hole', 'magic_weapon'],
  },
];
