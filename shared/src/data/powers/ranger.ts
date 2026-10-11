// Ranger legendary powers and sets (data only; power templates from shared/src/powers.ts).
// Append new entries at the end (registry order is observable through loot rolls). Recipe: docs/rework/depth/FOUNDATION.md §5.
// Content: docs/rework/depth/RANGER.md §7–§8 (bible v2). Display names in texts follow NAMES.md (Tracking Arrow, Burst
// Arrow, Arrowfall); ids never change. Behaviour flags and `var:` rolls are read by server/src/sim/skills/ranger*.ts.

import type { LegendaryDef, SetDef } from '../items';
import { ROLL, conditional, flags, ownMult, rolledCooldown, rolledDamage, skillMods, skillMore, tagged } from '../../powers';
import { RANGER_SET_BASES } from './common';

/** Every ranger skill (each carries an element tag). */
const ANY_SKILL = tagged('physical', 'fire', 'cold', 'lightning', 'arcane');
const glow = 0x3cff6e;

export const RANGER_LEGENDARIES: LegendaryDef[] = [
  // BUDGET.md §4 lever: Arrowfall had no additive named signature. The roll moves to damage (named bow band 150–200 [M]);
  // the cooldown cut is fixed at 35%, the middle of its old 30–40 roll.
  { id: 'rainspindle', name: 'Rainspindle', base: 'bow', classes: ['ranger'], power: 'Arrowfall’s cooldown is reduced by 35%, its radius grows by 40%, and it deals {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'The string remembers every arrow still in the sky.', colors: { primary: 0x384c59, secondary: 0xaacacb, glow: 0xb8e7f0 },
    effects: [rolledDamage('rain_of_vengeance', { cooldown: -35, radius: 40 })] },
  { id: 'sappers_pack', name: "Sapper's Pack", base: 'quiver', classes: ['ranger'], power: 'You may have 2 additional Sentries, and Sentries deal {v}% increased damage.', range: [30, 40], cubeSlot: 'armor', flavor: 'Mostly gunpowder. Some arrows.', colors: { primary: 0x7a5230, secondary: 0xc9a227, glow: 0xffb347 },
    effects: [rolledDamage('sentry', { maxSummons: 2 })] },
  // Bible change [P] (BUDGET.md §4 lever): fires 30% faster instead of 50%.
  { id: 'gearwright_heart', name: "Gearwright's Heart", base: 'chest_leather', classes: ['ranger'], power: 'Sentry cooldown is reduced by {v}%, and Sentries fire 30% faster.', range: [30, 40], cubeSlot: 'armor', flavor: 'Tick. Tick. Tick. Then everything is quiet.', colors: { primary: 0x6b4a2b, secondary: 0xb87333, glow: 0xffc06b },
    effects: [rolledCooldown('sentry', { vars: { sentryFast: 30 } })] },
  { id: 'thunderhead', name: 'Thunderhead', base: 'bow', classes: ['ranger'], power: 'Multishot deals Lightning damage and {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Its string hums before the storm breaks.', colors: { primary: 0x2c3e50, secondary: 0x7fd3ff, glow: 0x9fe3ff },
    effects: [rolledDamage('multishot', { element: 'lightning' })] },
  { id: 'hunters_mark', name: "Hunter's Mark", base: 'handxbow', classes: ['ranger'], power: 'Tracking Arrow always pierces, and pierced enemies take {v}% increased damage for 3 seconds.', range: [15, 20], cubeSlot: 'weapon', flavor: 'Once marked, nothing hides.', colors: { primary: 0x3d2b1f, secondary: 0x8fd16a, glow: 0xb6ff8f },
    effects: [skillMods(['hungering_arrow'], { flags: ['huntersMark'] }, { field: 'var:markPct' })] },
  // ─────────────────────────── bible v2 §8: 30 new (7 named, 23 tag-keyed) ───────────────────────────
  { id: 'powderkeg_crossbow', name: 'Powderkeg Crossbow', base: 'crossbow', classes: ['ranger'], power: 'Burst Arrow releases 3 more grenades and deals {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Do not lean on it.', colors: { primary: 0x4a3a2a, secondary: 0xe67e22, glow: 0xffa34d },
    effects: [rolledDamage('cluster_arrow', { vars: { grenades: 3 } })] },
  { id: 'kennel_wood_bow', name: 'Kennel-Wood Bow', base: 'bow', classes: ['ranger'], power: '+1 maximum Companion, and Companions deal {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Cut from the post the dogs slept against.', colors: { primary: 0x5a4632, secondary: 0xa0a0a0, glow: 0xd8d0b0 },
    effects: [rolledDamage('companion', { maxSummons: 1 })] },
  { id: 'riverstone_repeater', name: 'Riverstone Repeater', base: 'handxbow', classes: ['ranger'], power: 'Skipstone Bolt skips 2 more times and deals {v}% increased damage.', range: [100, 150], cubeSlot: 'weapon', flavor: 'Sera says it skips better than she does.', colors: { primary: 0x3d4f57, secondary: 0x7fb8c9, glow: 0xbfe6f0 },
    effects: [rolledDamage('skipstone_bolt', { vars: { skips: 2 } })] },
  { id: 'tripline_crossbow', name: 'Tripline Crossbow', base: 'crossbow', classes: ['ranger'], power: '+2 maximum Spring Snares, and Spring Snares deal {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'It is always cocked.', colors: { primary: 0x4f3d2a, secondary: 0x9a7b4f, glow: 0xd9b77a },
    effects: [rolledDamage('spring_snare', { maxSummons: 2 })] },
  { id: 'highcloud_longbow', name: 'Highcloud Longbow', base: 'longbow', classes: ['ranger'], power: 'Overcast Volley drops 4 more arrows and deals {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Its arrows come down eventually.', colors: { primary: 0x3e4c5e, secondary: 0x6a8caf, glow: 0xc8dcf0 },
    effects: [rolledDamage('overcast_volley', { vars: { volleyArrows: 4 } })] },
  { id: 'mortarmans_pack', name: "Mortarman's Pack", base: 'quiver', classes: ['ranger'], power: '+1 maximum Pitch Mortar, and Pitch Mortars deal {v}% increased damage.', range: [30, 40], cubeSlot: 'armor', flavor: 'Pitch, wicks, and an apology.', colors: { primary: 0x3a2e24, secondary: 0x5b4a3a, glow: 0xff8a3a },
    effects: [rolledDamage('pitch_mortar', { maxSummons: 1 })] },
  // Bible: "lasts 4 s longer" — durations are additive %, so 40% of its 10 s.
  { id: 'starling_longbow', name: 'Starling Longbow', base: 'longbow', classes: ['ranger'], power: 'Murmuration lasts 40% longer (4 more seconds) and deals {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'When it sings, the hedges answer.', colors: { primary: 0x2c2c38, secondary: 0x3a3a4a, glow: 0x9fa8c8 },
    effects: [rolledDamage('murmuration', { duration: 40 })] },
  { id: 'featherguard_cuffs', name: 'Featherguard Cuffs', base: 'wrists_bracers', classes: ['ranger'], power: 'Each time one of your Piercing projectiles passes through or skips to an enemy, it deals {v}% more damage (compounding, at most 3 times).', range: [20, 30], cubeSlot: 'armor', flavor: 'Each feather from a bird that came home.', colors: { primary: 0x5a5040, secondary: 0xd8cfb0, glow: 0xfff2c8 },
    effects: [skillMods(tagged('piercing'), {}, { field: 'var:featherguard' })] },
  { id: 'hawkfeather_cap', name: 'Hawkfeather Cap', base: 'head_cap', classes: ['ranger'], power: 'Your Primary skills also strike a second target and deal {v}% increased damage.', range: [50, 75], cubeSlot: 'armor', flavor: 'It sees the second one first.', colors: { primary: 0x6b5236, secondary: 0xcaa36a, glow: 0xffe0a0 },
    effects: [skillMods(tagged('primary'), { flags: ['hawkfeather'] }, { field: 'dmg' })] },
  // Bible: 'pierce' (every enemy). Capped at 2 for snapshot bandwidth [M]: see ARBALEST_PIERCE in server/src/sim/skills/ranger.ts.
  { id: 'bolt_throwers_arbalest', name: 'Bolt-Thrower’s Arbalest', base: 'crossbow', classes: ['ranger'], power: 'Your Device projectiles pierce up to 2 enemies and burst on their final target (radius 60), and your Devices deal {v}% increased damage.', range: [100, 150], cubeSlot: 'weapon', flavor: 'Built for walls. Used on everything else.', colors: { primary: 0x3d3a34, secondary: 0xc9a227, glow: 0xffd36b },
    effects: [skillMods(tagged('device'), { flags: ['arbalest'] }, { field: 'dmg' })] },
  { id: 'bowyers_gloves', name: 'Bowyer’s Gloves', base: 'hands_gloves', classes: ['ranger'], power: 'Your Projectile skills deal {v}% more damage to enemies within 200 units.', range: [25, 35], cubeSlot: 'armor', flavor: 'Waxed thread in every seam.', colors: { primary: 0x5b4632, secondary: 0x8fd16a, glow: 0xc8f0a0 },
    effects: [skillMore(tagged('projectile'), ROLL, { targetWithin: 200 })] },
  // BUDGET.md §4 lever: Projectile / Aerial Spender tag additives +15 points (60–90 → 75–105).
  { id: 'bandolier_belt', name: 'Bandolier Belt', base: 'waist_belt', classes: ['ranger'], power: 'Your Projectile Spender skills deal {v}% increased damage and restore 0.5 Hatred for each enemy hit (at most 5 per cast).', range: [75, 105], cubeSlot: 'armor', flavor: 'Every loop full, every time.', colors: { primary: 0x4a3626, secondary: 0xb87333, glow: 0xffc06b },
    effects: [skillMods({ allOf: ['projectile', 'spender'] }, { flags: ['bandolier'] }, { field: 'dmg' })] },
  { id: 'fuse_burnt_boots', name: 'Fuse-Burnt Boots', base: 'feet_boots', classes: ['ranger'], power: 'Your exploding Projectiles bounce once before they explode and deal {v}% more damage.', range: [25, 35], cubeSlot: 'armor', flavor: 'The smell never leaves.', colors: { primary: 0x2e2622, secondary: 0xe67e22, glow: 0xff9a3a },
    effects: [skillMore({ allOf: ['projectile', 'area'] }, ROLL), flags({ allOf: ['projectile', 'area'] }, 'fuseBounce')] },
  { id: 'powder_horn', name: 'Powder Horn', base: 'neck_amulet', classes: ['ranger'], power: 'Your exploding Projectiles have a {v}% chance to leave a burning powder patch for 2 seconds that deals 100% weapon damage per second as Fire.', range: [20, 30], cubeSlot: 'jewelry', flavor: 'Shake it and the sky rumbles.', colors: { primary: 0x5a4a3a, secondary: 0xc9a227, glow: 0xffb347 },
    effects: [skillMods({ allOf: ['projectile', 'area'] }, {}, { field: 'var:powderHorn' })] },
  { id: 'squallcatcher_pauldrons', name: 'Squallcatcher Pauldrons', base: 'shoulders_pads', classes: ['ranger'], power: 'Your Aerial skills drift toward the densest group and deal {v}% more damage to enemies that have been under them for 2 seconds or longer.', range: [25, 40], cubeSlot: 'armor', flavor: 'Wet on the inside, somehow.', colors: { primary: 0x3e4a58, secondary: 0x5dade2, glow: 0xb8e7f0 },
    effects: [skillMods(tagged('aerial'), { flags: ['squallDrift'] }, { field: 'var:squallcatcher' })] },
  { id: 'raincount_ring', name: 'Raincount Ring', base: 'ring', classes: ['ranger'], power: 'Your Ground effects deal {v}% increased damage.', range: [60, 90], cubeSlot: 'jewelry', flavor: 'Neris counted every drop. Twice.', colors: { primary: 0x46505a, secondary: 0x5dade2, glow: 0xa8dcff },
    effects: [skillMods(tagged('ground'), {}, { field: 'dmg' })] },
  { id: 'trailhide_breeches', name: 'Trailhide Breeches', base: 'legs_leather', classes: ['ranger'], power: 'Your Beasts’ attacks hit all enemies within 60 units of their target, and your Beasts deal {v}% more damage to marked enemies.', range: [25, 40], cubeSlot: 'armor', flavor: 'They learn the way home.', colors: { primary: 0x4b5a32, secondary: 0xb59a6a, glow: 0xd8ffb0 },
    effects: [flags(tagged('beast'), 'trailhide'), skillMore(tagged('beast'), ROLL, { targetState: 'marked' })] },
  { id: 'whistle_charm', name: 'Whistle Charm', base: 'neck_amulet', classes: ['ranger'], power: 'Your Beasts attack {v}% faster.', range: [20, 30], cubeSlot: 'jewelry', flavor: 'Only animals hear it. All of them.', colors: { primary: 0x6a5a3a, secondary: 0xa0a0a0, glow: 0xe8e8d0 },
    effects: [skillMods(tagged('beast'), {}, { field: 'var:beastIas' })] },
  { id: 'skimmers_leggings', name: 'Skimmer’s Leggings', base: 'legs_leather', classes: ['ranger'], power: 'Your Piercing projectiles leave a chilling ripple for 1 second at each enemy they pass, and your Projectile skills deal {v}% more damage to enemies in a ripple.', range: [15, 25], cubeSlot: 'armor', flavor: 'Light on the water, light on the road.', colors: { primary: 0x3d4f57, secondary: 0x7fb8c9, glow: 0xd0f4ff },
    effects: [skillMods(tagged('piercing'), {}, { field: 'var:skimmer' })] },
  { id: 'skipping_stone_quiver', name: 'Skipping-Stone Quiver', base: 'quiver', classes: ['ranger'], power: 'The last enemy one of your Piercing projectiles hits throws 3 splinters that pierce once for {v}% weapon damage each.', range: [40, 60], cubeSlot: 'armor', flavor: 'Flat stones, carefully chosen.', colors: { primary: 0x4a4a46, secondary: 0x7fb8c9, glow: 0xc8eaf2 },
    effects: [skillMods(tagged('piercing'), {}, { field: 'var:splinters' })] },
  { id: 'snarehand_gloves', name: 'Snarehand Gloves', base: 'hands_gloves', classes: ['ranger'], power: 'Your Traps hold enemies 1 second longer, and your Trap and Device skills deal {v}% more damage to stunned enemies.', range: [25, 40], cubeSlot: 'armor', flavor: 'Rope burns in the shape of a promise.', colors: { primary: 0x6b5a3a, secondary: 0x8f9a9e, glow: 0xd8c8a0 },
    effects: [skillMods(tagged('trap'), { vars: { snareHold: 1 } }), skillMore(tagged('trap', 'device'), ROLL, { targetState: 'stunned' })] },
  { id: 'coiled_wire_bracers', name: 'Coiled Wire Bracers', base: 'wrists_bracers', classes: ['ranger'], power: 'Triggered Traps have a {v}% chance to re-arm after 2 seconds, and expiring Devices fire a final salvo.', range: [30, 50], cubeSlot: 'armor', flavor: 'Wound tight, waiting.', colors: { primary: 0x4a4440, secondary: 0x8f9a9e, glow: 0xd0d8dc },
    effects: [skillMods(tagged('trap'), {}, { field: 'var:wireRearm' }), flags(tagged('device'), 'deviceFinale')] },
  { id: 'overcast_hood', name: 'Overcast Hood', base: 'head_hood', classes: ['ranger'], power: 'Your Aerial skills chill enemies, and enemies hit 3 or more times by one Aerial cast take {v}% more damage from it.', range: [25, 35], cubeSlot: 'armor', flavor: 'It never quite dries.', colors: { primary: 0x4a5462, secondary: 0x6a8caf, glow: 0xc0d4ec },
    effects: [skillMods(tagged('aerial'), { flags: ['aerialChill'] }, { field: 'var:overcastHood' })] },
  // BUDGET.md §4 lever: +15 points (60–90 → 75–105).
  { id: 'weathervane_ring', name: 'Weathervane Ring', base: 'ring', classes: ['ranger'], power: 'Your Aerial skills deal {v}% increased damage.', range: [75, 105], cubeSlot: 'jewelry', flavor: 'It points where the trouble is blowing.', colors: { primary: 0x585048, secondary: 0x6a8caf, glow: 0xd0e0f0 },
    effects: [skillMods(tagged('aerial'), {}, { field: 'dmg' })] },
  { id: 'spotters_repeater', name: 'Spotter’s Repeater', base: 'handxbow', classes: ['ranger'], power: 'Your mark bonus is {v} points higher, and your marks spread to the nearest other enemy within 150 units.', range: [10, 15], cubeSlot: 'weapon', flavor: 'The first shot is a question.', colors: { primary: 0x3d2b1f, secondary: 0xe6c35c, glow: 0xffe8a0 },
    effects: [skillMods(tagged('mark'), {}, { field: 'var:markPctAdd' }), { kind: 'rule', rule: { id: 'markSpread', range: 150 } }] },
  { id: 'huntsmans_pauldrons', name: 'Huntsman’s Pauldrons', base: 'shoulders_pads', classes: ['ranger'], power: 'When one of your marks moves to a new enemy, your Summons deal {v}% more damage for 5 seconds.', range: [30, 40], cubeSlot: 'armor', flavor: 'Trophies of nobody you would know.', colors: { primary: 0x5a4632, secondary: 0xe6c35c, glow: 0xffe0a0 },
    effects: [flags(ANY_SKILL, 'huntsman'), skillMore(tagged('summon'), ROLL, { buff: 'huntsman' })] },
  { id: 'tar_stained_jerkin', name: 'Tar-Stained Jerkin', base: 'chest_leather', classes: ['ranger'], power: 'Your Ground effects spread by 30% of their radius per second (at most double), and enemies inside them take {v}% more damage from your Devices.', range: [25, 35], cubeSlot: 'armor', flavor: 'Black to the elbow.', colors: { primary: 0x241e1a, secondary: 0x5b4a3a, glow: 0xff8a3a },
    effects: [skillMods(tagged('ground'), { flags: ['tarSpread'] }, { field: 'var:tarJerkin' })] },
  { id: 'fuse_cord_belt', name: 'Fuse Cord Belt', base: 'waist_belt', classes: ['ranger'], power: 'Your Devices attack {v}% faster.', range: [25, 35], cubeSlot: 'armor', flavor: 'Light the end you are not wearing.', colors: { primary: 0x4a3a2a, secondary: 0xc9a227, glow: 0xffc06b },
    effects: [skillMods(tagged('device'), {}, { field: 'var:deviceIas' })] },
  // Bible part 2 ("after a Movement skill your Beasts dash to your side") needs the movement-end trigger (engine wave 3).
  { id: 'wingbeat_boots', name: 'Wingbeat Boots', base: 'feet_boots', classes: ['ranger'], power: 'Your Beasts deal {v}% more damage to elites, and after your Movement skill they dash to your side.', range: [25, 40], cubeSlot: 'armor', flavor: 'Every step a small flutter.', colors: { primary: 0x3a3a4a, secondary: 0xa0a0b0, glow: 0xd8dcf0 },
    // Part 2: the dash end (the moment of the engine's dashEnd trigger) is read in rangerTick; beasts run to your side.
    effects: [skillMore(tagged('beast'), ROLL, { targetElite: true }), flags(tagged('beast'), 'wingbeatDash')] },
  { id: 'roost_charm', name: 'Roost Charm', base: 'neck_amulet', classes: ['ranger'], power: 'Kills by your Summons reduce your Cooldown skills’ cooldowns by 0.5 seconds (at most {v} seconds per cooldown).', range: [3, 5], cubeSlot: 'jewelry', flavor: 'A feather for each that came back fed.', colors: { primary: 0x2c2c38, secondary: 0x3a3a4a, glow: 0xb0b8d8 },
    effects: [skillMods(tagged('summon'), {}, { field: 'var:roostCharm' })] },
];

const pieceNames = (name: string) => ['Crown', 'Mantle', 'Vest', 'Grips', 'Legwraps', 'Treads'].map((p) => `${name} ${p}`);

// Bible v2 §7: building blocks keyed on tags. parityLoadout: the warrior-pilot harness fixture bars (internal only).
export const RANGER_SETS: SetDef[] = [
  {
    id: 'siegebreaker', name: "Siegebreaker's Arsenal", classId: 'ranger',
    pieces: [
      { base: 'head_hood', name: "Siegebreaker's Cowl" }, { base: 'shoulders_pads', name: "Siegebreaker's Spaulders" },
      { base: 'chest_leather', name: "Siegebreaker's Brigandine" }, { base: 'hands_gloves', name: "Siegebreaker's Grips" },
      { base: 'legs_leather', name: "Siegebreaker's Breeches" }, { base: 'feet_boots', name: "Siegebreaker's Treads" },
    ],
    bonuses: [
      { count: 2, text: 'Your Device skills get +1 maximum each, and their cooldowns are 20% shorter.', effects: [skillMods(tagged('device'), { maxSummons: 1, cooldown: -20 })] },
      { count: 4, text: 'Your Sentries and Pitch Mortars also fire your Projectile Spender skills at 20% damage.', effects: [flags(tagged('device'), 'deviceCasts')] },
      { count: 6, text: 'With 4 Devices active they fire a rocket salvo every 3 seconds. Your Devices and Spender skills deal 10% more damage for each active Device (at most 4).',
        effects: [flags(tagged('device'), 'deviceSalvo'), conditional({ perSummon: 'device', max: 4 }, 'own', 10, tagged('device', 'spender'))] },
    ],
    colors: { primary: 0x3d4a2f, secondary: 0xc9a227, glow },
    parityLoadout: ['sentry', 'pitch_mortar', 'spring_snare', 'multishot'],
  },
  {
    id: 'farwatch', name: 'Farwatch', classId: 'ranger',
    pieces: RANGER_SET_BASES.map((base, i) => ({ base, name: pieceNames('Farwatch')[i] })),
    bonuses: [
      { count: 2, text: 'Your Piercing projectiles pierce or skip one more time.', effects: [skillMods(tagged('piercing'), { vars: { morePierce: 1 } })] },
      // Bible: 30% less. Measured (ranger parity harness): the cut alone was worth ×1.92 on Burst Arrow and ×1.42 on
      // Multishot (a Hatred-limited Spender turns a cost cut into casts 1 : 1/(1−x)); 15% as the warrior's Cinder Oath 4.
      { count: 4, text: 'Your Projectile Spender skills cost 15% less and your Piercing skills deal 15% more damage. Enemies your Piercing projectiles pass through are spotted (marked) for 3 seconds, and your projectiles bend toward spotted enemies within 300 units.',
        effects: [skillMods({ allOf: ['projectile', 'spender'] }, { cost: -15 }), skillMore(tagged('piercing'), 15), flags(tagged('piercing'), 'spotting'),
          { kind: 'projectile', tags: tagged('projectile'), seekMarked: { turn: 3, range: 300 } }] },
      { count: 6, text: 'Every 5th Projectile cast is a farwatch shot that flies 900 units, pierces everything and, where it ends, releases a free cast of your most recent Projectile Spender. Your Projectile skills deal 35% more damage to enemies farther than 200 units.',
        effects: [flags(tagged('projectile'), 'farwatchShot'), skillMore(tagged('projectile'), 35, { targetFartherThan: 200 })] },
    ],
    colors: { primary: 0x3a6170, secondary: 0xc6b88c, glow },
    parityLoadout: ['multishot', 'rain_of_vengeance', 'quarry_mark', 'sentry'],
  },
  {
    id: 'rainkeeper', name: 'Rainkeeper', classId: 'ranger',
    pieces: RANGER_SET_BASES.map((base, i) => ({ base, name: pieceNames('Rainkeeper')[i] })),
    bonuses: [
      { count: 2, text: 'Your Aerial skills’ areas are 30% larger, and your Aerial Cooldown skills’ cooldowns are 20% shorter.',
        effects: [skillMods(tagged('aerial'), { radius: 30 }), skillMods({ allOf: ['aerial', 'cooldown'] }, { cooldown: -20 })] },
      // Bible: "your Spender skills cost 30% less"; a buff's cost factor applies to every skill's cost (Buff.cost). Fitted
      // 30 → 15% [M]: the cut measured ×1.57 on Overcast Volley (same rule as Farwatch 4).
      { count: 4, text: 'While one of your Aerial or Ground effects is active, your skills cost 15% less and your Aerial skills deal 15% more damage; you take 20% less damage while standing in your ground effects.',
        effects: [flags(tagged('aerial', 'ground'), 'rainkeeperActive'), skillMore(tagged('aerial'), 15, { buff: 'rainkeeper' }), { kind: 'damageTaken', pct: -20, when: { inOwnGround: true } }] },
      { count: 6, text: 'Your longest-lasting Aerial effect becomes a storm that follows you and every 3 seconds drops a free strike of your most recent Aerial Spender (50% damage) on the densest group inside it. Your Aerial skills deal 35% more damage to enemies inside the storm.',
        effects: [flags(tagged('aerial'), 'rainStorm')] },
    ],
    colors: { primary: 0x64546c, secondary: 0xc6b88c, glow },
    parityLoadout: ['rain_of_vengeance', 'overcast_volley', 'pitch_mortar', 'sentry'],
  },
  {
    id: 'thicket_kin', name: 'Thicket Kin', classId: 'ranger',
    pieces: [
      { base: 'head_hood', name: 'Antler Hood' }, { base: 'shoulders_pads', name: 'Bramble Pauldrons' }, { base: 'chest_leather', name: 'Thicket Jerkin' },
      { base: 'hands_gloves', name: 'Kinhand Gloves' }, { base: 'legs_leather', name: 'Deer-Trail Breeches' }, { base: 'feet_boots', name: 'Soft-Pad Boots' },
    ],
    bonuses: [
      { count: 2, text: 'Your Beast attacks generate 1 Hatred, and your Beasts move 30% faster.', effects: [flags(tagged('beast'), 'beastGen', 'beastFast')] },
      { count: 4, text: 'Your Beast skills get +1 maximum each, and your Beasts mark the enemy they bite while you have no mark; you take 10% less damage for each living Beast (at most 2).',
        effects: [skillMods(tagged('beast'), { maxSummons: 1 }), flags(tagged('beast'), 'beastMark'), { kind: 'damageTaken', pct: -10, when: { perSummon: 'beast', max: 2 } }] },
      { count: 6, text: 'Each Beast attack leaps to 2 nearby enemies for 25% of its damage. Your Beasts deal 25% increased damage.',
        effects: [flags(tagged('beast'), 'beastLeap'), ownMult(tagged('beast'), 1.25)] },
    ],
    colors: { primary: 0x4b5a32, secondary: 0xb59a6a, glow },
    parityLoadout: ['companion', 'murmuration', 'pitch_mortar', 'quarry_mark'],
  },
  {
    id: 'snarewright', name: 'Snarewright', classId: 'ranger',
    pieces: [
      { base: 'head_cap', name: 'Snarewright Cap' }, { base: 'shoulders_pads', name: 'Hookline Pauldrons' }, { base: 'chest_leather', name: 'Rope-Wound Jerkin' },
      { base: 'hands_gloves', name: 'Knotter’s Gloves' }, { base: 'waist_belt', name: 'Coil Belt' }, { base: 'wrists_bracers', name: 'Springlock Bracers' },
    ],
    bonuses: [
      { count: 2, text: 'Your Trap skills get +1 maximum each, and your Traps arm 50% faster.', effects: [skillMods(tagged('trap'), { maxSummons: 1, vars: { armFast: 50 } })] },
      { count: 4, text: 'Triggering a Trap grants 20% damage reduction for 3 seconds and pulls the held enemies 30 units together; your Devices target stunned enemies first; your Traps deal 15% more damage.',
        effects: [flags(tagged('trap'), 'trapDr'), flags(tagged('device'), 'deviceStunFirst'), skillMore(tagged('trap'), 15)] },
      { count: 6, text: 'Your Traps re-arm once after triggering, and Device hits on stunned enemies re-arm a spent Trap nearby. All your skills deal 35% more damage to stunned enemies.',
        effects: [flags(tagged('trap', 'device'), 'trapRearm'), conditional({ targetState: 'stunned' }, 'hit', 35)] },
    ],
    colors: { primary: 0x6b5a3a, secondary: 0x8f9a9e, glow },
    parityLoadout: ['spring_snare', 'pitch_mortar', 'sentry', 'quarry_mark'],
  },
];
