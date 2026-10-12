// Warrior legendary powers and sets (data only; power templates from shared/src/powers.ts).
// Append new entries at the end (registry order is observable through loot rolls). Recipe: docs/rework/depth/FOUNDATION.md §5.
// Content: docs/rework/depth/WARRIOR.md §7–§8 (bible v2). Shipping text describes mechanics only (ITEMS-SHARED.md §0):
// every clause in a text is implemented; clauses that need engine wave 2 are listed in docs/rework/depth/WARRIOR-PILOT.md
// and are added (text and effect together) when the primitive exists. Behaviour flags / vars are read by
// server/src/sim/skills/warrior*.ts.

import type { LegendaryDef, SetDef } from '../items';
import { ROLL, conditional, flags, ownMult, proc, rolledCost, rolledDamage, skillMods, skillMore, tagged, type Condition } from '../../powers';
import { WARRIOR_SET_BASES } from './common';

/** "While a Buff skill is active": any of the warrior's Buff skills' buffs (compound condition, engine wave 2). */
export const WARRIOR_BUFF_ACTIVE: Condition = { any: [{ buff: 'battle_rage' }, { buff: 'muster_standard' }, { buff: 'kilnheart' }] };
const BUFF_UP = WARRIOR_BUFF_ACTIVE;
/** Every warrior skill (each carries an element tag). */
const ANY_SKILL = tagged('physical', 'fire', 'cold', 'lightning', 'arcane');

export const WARRIOR_LEGENDARIES: LegendaryDef[] = [
  { id: 'faultcleaver', name: 'Faultcleaver', base: 'axe2h', classes: ['warrior'], power: 'Quakeline deals {v}% increased damage and costs 40% less Fury.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Its edge follows the seams beneath the earth.', colors: { primary: 0x5b5045, secondary: 0xdb9860, glow: 0xffb369 },
    effects: [rolledDamage('seismic_slam', { cost: -40 })] },
  // Lead decision (c): the roll now covers Whirlwind as well as its Dust Devils (Dust Devils inherit Whirlwind's damage bonus).
  { id: 'ninefold_gale', name: 'The Ninefold Gale', base: 'axe2h', classes: ['warrior'], power: 'Whirlwind always spawns Dust Devils, and Whirlwind and Dust Devils deal {v}% increased damage.', range: [100, 150], cubeSlot: 'weapon', flavor: '"Nine storms bound in one edge. It hungers to spin."', colors: { primary: 0xb8c4cc, secondary: 0x6b8fa3, glow: 0x9fe3ff },
    effects: [rolledDamage('whirlwind', { flags: ['dustDevils', 'ninefold'] })] },
  { id: 'bloodwake', name: 'Bloodwake', base: 'sword', classes: ['warrior'], power: "Rend's bleed deals {v}% increased damage.", range: [150, 200], cubeSlot: 'weapon', flavor: 'The blade weeps for every wound it opens.', colors: { primary: 0x9e1b1b, secondary: 0x3a0d0d, glow: 0xff3b3b },
    effects: [rolledDamage('rend')] },
  { id: 'eternal_gyre', name: 'Girdle of the Eternal Gyre', base: 'waist_belt', classes: ['warrior'], power: 'Whirlwind costs {v}% less Fury, and you take 20% less damage while whirlwinding.', range: [40, 50], cubeSlot: 'armor', flavor: 'Buckled once, never unbuckled.', colors: { primary: 0x6d4c2f, secondary: 0xd4af37, glow: 0xffb347 },
    effects: [rolledCost('whirlwind', { flags: ['gyre'] })] },
  { id: 'anvil_vambraces', name: 'Vambraces of the Anvil', base: 'wrists_bracers', classes: ['warrior'], power: 'Stunned enemies take {v}% increased damage from you.', range: [25, 30], cubeSlot: 'armor', flavor: 'Struck a thousand times, they ring like bells.', colors: { primary: 0x5a5a66, secondary: 0xc9a227, glow: 0xffd27f },
    effects: [conditional({ targetState: 'stunned' }, 'hit', ROLL)] },
  { id: 'last_light', name: 'Bulwark of the Last Light', base: 'shield', classes: ['warrior'], power: 'Ground Stomp pulls in distant enemies and deals {v}% increased damage.', range: [200, 250], cubeSlot: 'armor', flavor: 'It held the gate when the gate itself fell.', colors: { primary: 0xd9c27a, secondary: 0xf5f0e0, glow: 0xfff3b0 },
    effects: [rolledDamage('ground_stomp', { flags: ['pull'] })] },
  // ─────────────────────────── M1 (bible v2 §8): named signatures, then tag-keyed powers ───────────────────────────
  { id: 'millwheel_edge', name: 'Millwheel Edge', base: 'sword', classes: ['warrior'], power: 'Cleave hits all around you (360°) and deals {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'It turns whether or not there is grain.', colors: { primary: 0x9aa1a6, secondary: 0x3d2f20, glow: 0xe8dcc0 },
    effects: [rolledDamage('cleave', { flags: ['cleaveFull'] })] },
  { id: 'bellwrights_maul', name: "Bellwright's Maul", base: 'mace', classes: ['warrior'], power: 'Tolling Blow tolls every second blow and deals {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Cast from a bell that rang too often.', colors: { primary: 0xc9a227, secondary: 0x5a4320, glow: 0xffe08a },
    effects: [rolledDamage('tolling_blow', { flags: ['tollEvery2'] })] },
  { id: 'grinning_saw', name: 'Grinning Saw', base: 'axe', classes: ['warrior'], power: 'Sawtooth Hatchet is thrown again when it returns, hitting each enemy up to three times, and deals {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'The teeth were filed into a smile.', colors: { primary: 0x7a1e1a, secondary: 0x2a0d0b, glow: 0xff4a3a },
    effects: [rolledDamage('sawtooth_hatchet', { flags: ['hatchetThrice'] })] },
  { id: 'quartermasters_cuirass', name: "Quartermaster's Cuirass", base: 'chest_plate', classes: ['warrior'], power: 'You may plant two Muster Standards, and while you stand in a Muster Standard your Primary skills deal {v}% more damage.', range: [20, 30], cubeSlot: 'armor', flavor: 'Two of everything. Mera insists.', colors: { primary: 0xe8dfc4, secondary: 0x8c2f24, glow: 0xfff3b0 },
    effects: [skillMods(['muster_standard'], { vars: { extraStandards: 1 } }), skillMore(tagged('primary'), ROLL, { buff: 'muster_standard' })] },
  { id: 'coulter_blade', name: 'Coulter Blade', base: 'sword2h', classes: ['warrior'], power: 'Ironplough reaches full ramp twice as fast and deals {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'It cuts the first line; the rest follows.', colors: { primary: 0x5e4a33, secondary: 0x9aa1a6, glow: 0xd8c9a8 },
    effects: [rolledDamage('ironplough', { flags: ['ploughFastRamp'] })] },
  { id: 'cairnwrights_hammer', name: "Cairnwright's Hammer", base: 'mace', classes: ['warrior'], power: 'Cairnfall drops 3 more cairns and deals {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Every stone it set still stands.', colors: { primary: 0x8f8578, secondary: 0x4a443c, glow: 0xffc06b },
    effects: [rolledDamage('cairnfall', { vars: { extraCairns: 3 } })] },
  { id: 'ashgrip_gauntlets', name: 'Ashgrip Gauntlets', base: 'hands_gauntlets', classes: ['warrior'], power: 'Your Primary skills deal {v}% more damage to Bleeding enemies and extend their Bleeds by 0.5 seconds.', range: [25, 40], cubeSlot: 'armor', flavor: 'Warm to the touch, always.', colors: { primary: 0x4a2a20, secondary: 0xff7a1a, glow: 0xff9a4a },
    effects: [skillMore(tagged('primary'), ROLL, { targetState: 'bleeding' }), flags(tagged('primary'), 'ashgripExtend')] },
  { id: 'threshers_knot', name: "Thresher's Knot", base: 'ring', classes: ['warrior'], power: 'Each enemy a Primary skill hits beyond the first reduces your Stun skills’ cooldowns by {v} seconds.', range: [0.05, 0.1], cubeSlot: 'jewelry', flavor: 'Tied by a farmhand who never missed a harvest.', colors: { primary: 0xc9a227, secondary: 0x6b5a2a, glow: 0xffe08a },
    effects: [skillMods(tagged('primary'), {}, { field: 'var:thresher' })] },
  { id: 'gale_stitched_legguards', name: 'Gale-Stitched Legguards', base: 'legs_plate', classes: ['warrior'], power: 'Each second you channel adds a stack (max 5); each stack makes your Channel skills deal {v}% more damage.', range: [6, 8], cubeSlot: 'armor', flavor: 'The stitches hum when the wind changes.', colors: { primary: 0x4a5a6a, secondary: 0xb8c4cc, glow: 0x9fe3ff },
    effects: [flags(tagged('channel'), 'galeStitch'), skillMore(tagged('channel'), ROLL, { buffStacks: 'gale_stitched', max: 5 })] },
  { id: 'tanners_pauldrons', name: "Tanner's Pauldrons", base: 'shoulders_spiked', classes: ['warrior'], power: 'Bleeding enemies take {v}% more damage from you.', range: [15, 25], cubeSlot: 'armor', flavor: 'Cured in a vat nobody will describe.', colors: { primary: 0x6b2a1e, secondary: 0x2a0d0b, glow: 0xff3b3b },
    effects: [conditional({ targetState: 'bleeding' }, 'hit', ROLL)] },
  { id: 'red_ledger', name: 'Red Ledger', base: 'neck_amulet', classes: ['warrior'], power: 'Your Bleed skills cost 15% less, and each Bleeding enemy that dies restores {v} Fury.', range: [3, 5], cubeSlot: 'jewelry', flavor: 'Every debt is written in the same ink.', colors: { primary: 0x8b1e1e, secondary: 0x2a0d0b, glow: 0xff5a5a },
    // Bible: 30% less. Measured (warrior parity harness, Sawtooth Hatchet + Cinder Oath 6): the cut alone was worth ×1.89,
    // because cost cuts add up on a Fury-limited Spender (with Cinder Oath 4: 1 / (1 − 0.45)); 15% as Cinder Oath 4.
    effects: [skillMods(tagged('bleed'), { cost: -15 }), skillMods(tagged('bleed'), {}, { field: 'var:redLedger' })] },
  { id: 'fissure_lined_breastplate', name: 'Fissure-Lined Breastplate', base: 'chest_plate', classes: ['warrior'], power: 'Your Spender skills deal {v}% more damage to Stunned enemies.', range: [30, 45], cubeSlot: 'armor', flavor: 'Cracked on purpose.', colors: { primary: 0x6e5a48, secondary: 0x3a2f25, glow: 0xffc06b },
    effects: [skillMore(tagged('spender'), ROLL, { targetState: 'stunned' })] },
  { id: 'tremor_signet', name: 'Tremor Signet', base: 'ring', classes: ['warrior'], power: 'Each enemy you Displace reduces your Cooldown skills’ cooldowns by {v} seconds (at most 1.5 seconds per cast).', range: [0.2, 0.3], cubeSlot: 'jewelry', flavor: 'Hold it to your ear and the hills answer.', colors: { primary: 0x726549, secondary: 0x3a2f25, glow: 0xffd27f },
    effects: [skillMods(tagged('displace'), {}, { field: 'var:tremorSignet' })] },
  { id: 'belfry_pauldrons', name: 'Belfry Pauldrons', base: 'shoulders_plate', classes: ['warrior'], power: 'Your Stun skills’ areas are {v}% larger, and they stun already-stunned enemies 1 second longer.', range: [30, 40], cubeSlot: 'armor', flavor: 'Pigeons still nest in the rivets.', colors: { primary: 0xb08d57, secondary: 0x4a3a20, glow: 0xffe08a },
    effects: [skillMods(tagged('stun'), { flags: ['belfry'] }, { field: 'radius' })] },
  { id: 'woodcutters_grips', name: "Woodcutter's Grips", base: 'hands_gauntlets', classes: ['warrior'], power: 'Your Bleed skills deal {v}% more damage to Bleeding enemies, and cost no Fury when they hit 4 or more enemies.', range: [25, 35], cubeSlot: 'armor', flavor: 'Callused into the leather.', colors: { primary: 0x5a3a24, secondary: 0x2a1a10, glow: 0xff6a4a },
    effects: [skillMore(tagged('bleed'), ROLL, { targetState: 'bleeding' }), flags(tagged('bleed'), 'woodcutter')] },
  { id: 'sawyers_ring', name: "Sawyer's Ring", base: 'ring', classes: ['warrior'], power: 'Enemies killed by your Bleed skills fling a shard at the nearest enemy for {v}% weapon damage that makes it Bleed.', range: [60, 80], cubeSlot: 'jewelry', flavor: 'It always comes back.', colors: { primary: 0x8b1e1e, secondary: 0x9aa1a6, glow: 0xff5a5a },
    effects: [skillMods(tagged('bleed'), {}, { field: 'var:sawyer' })] },
  { id: 'stonecount_gauntlets', name: 'Stonecount Gauntlets', base: 'hands_gauntlets', classes: ['warrior'], power: 'Each enemy you Stun increases your damage by 1% for 8 seconds (max {v}%).', range: [15, 25], cubeSlot: 'armor', flavor: 'One for each that fell.', colors: { primary: 0x8f8578, secondary: 0x3a352f, glow: 0xffc06b },
    effects: [skillMods(tagged('stun'), {}, { field: 'var:stonecount' })] },
  { id: 'seething_sigil', name: 'Seething Sigil', base: 'neck_amulet', classes: ['warrior'], power: 'While you are above 50 Fury, the damage bonus of your Buff skills is {v} points higher.', range: [10, 15], cubeSlot: 'jewelry', flavor: 'It hisses when you are calm.', colors: { primary: 0xc9a227, secondary: 0x8b1e1e, glow: 0xffb347 },
    effects: [skillMods(tagged('buff'), {}, { field: 'var:seething' })] },
  // ─────────────────────────── engine wave 2 (procs, defensive templates, compound conditions, statuses) ───────────────────────────
  // Bible: "you and allies inside them"; a party bonus inside your grounds is not an engine primitive, so allies are not included.
  { id: 'ward_pennant_shield', name: 'Ward Pennant Shield', base: 'shield', classes: ['warrior'], power: 'Your Ground effects are 30% larger, and you deal {v}% increased damage while standing in one of them.', range: [15, 20], cubeSlot: 'armor', flavor: 'The colours never fade while someone stands under them.', colors: { primary: 0xe8dfc4, secondary: 0x8c2f24, glow: 0xfff3b0 },
    effects: [skillMods(tagged('ground'), { radius: 30 }), conditional({ inOwnGround: true }, 'own', ROLL)] },
  { id: 'rally_knot', name: 'Rally Knot', base: 'ring', classes: ['warrior'], power: 'Casting a Buff skill grants {v} Fury and reduces your other cooldowns by 2 seconds.', range: [20, 30], cubeSlot: 'jewelry', flavor: 'Pull it and people come.', colors: { primary: 0xd8b45a, secondary: 0x8c2f24, glow: 0xfff3b0 },
    effects: [proc('cast', { tags: tagged('buff'), resource: ROLL, reduceCooldownsMs: 2000 })] },
  { id: 'yoke_greaves', name: 'Yoke Greaves', base: 'legs_plate', classes: ['warrior'], power: 'Enemies you Displace take {v}% more damage from you for 2 seconds.', range: [25, 35], cubeSlot: 'armor', flavor: 'Made for an ox. Worn by someone stubborner.', colors: { primary: 0x5e4a33, secondary: 0x9aa1a6, glow: 0xd8c9a8 },
    effects: [proc('applyStatus', { status: ['knockback', 'pull'], applyStatus: { kind: 'vulnerable', pct: ROLL, ms: 2000 } })] },
  { id: 'ox_harness_belt', name: 'Ox-Harness Belt', base: 'waist_belt', classes: ['warrior'], power: 'While channelling you take {v}% less damage.', range: [15, 20], cubeSlot: 'armor', flavor: 'Nothing pulls this one back.', colors: { primary: 0x5e4a33, secondary: 0x3d2f20, glow: 0xd8c9a8 },
    effects: [{ kind: 'damageTaken', pct: { roll: -1 }, when: { channeling: tagged('channel') } }] },
  { id: 'furycord_belt', name: 'Furycord Belt', base: 'waist_belt', classes: ['warrior'], power: 'While a Buff skill is active, your Spender skills deal {v}% increased damage.', range: [60, 90], cubeSlot: 'armor', flavor: 'Knotted tighter with every argument.', colors: { primary: 0x8b1e1e, secondary: 0xc9a227, glow: 0xffb347 },
    effects: [conditional(BUFF_UP, 'own', ROLL, tagged('spender'))] },
  { id: 'coalheart_locket', name: 'Coalheart Locket', base: 'neck_amulet', classes: ['warrior'], power: 'While a Buff skill is active, your Burn skills deal {v}% more damage.', range: [30, 40], cubeSlot: 'jewelry', flavor: 'A coal from the first fire on the frontier. Still lit.', colors: { primary: 0x4a2a20, secondary: 0xff6a1a, glow: 0xff9a4a },
    effects: [skillMore(tagged('burn'), ROLL, BUFF_UP)] },
  // Bible: "your Primary and Strike skills attack faster"; channels (the other Strike skills) tick at a fixed rate in
  // this engine, so attack speed only reaches the Primary skills — the text says so.
  { id: 'brass_warhorn_helm', name: 'Brass Warhorn Helm', base: 'head_horned', classes: ['warrior'], power: 'While a Buff skill is active, your Primary skills attack {v}% faster.', range: [8, 12], cubeSlot: 'armor', flavor: 'Blown once at every gate it has seen fall.', colors: { primary: 0xc9a227, secondary: 0x5a4320, glow: 0xffe08a },
    effects: [skillMods(tagged('primary'), {}, { field: 'var:warhorn' })] },
  // Bible: 'Kilnheart lasts 5 s longer' — durations are additive %, so 25% of its 20 s.
  { id: 'kilnmaw', name: 'Kilnmaw', base: 'maul2h', classes: ['warrior'], power: 'Kilnheart lasts 25% longer (5 more seconds), and your Burn skills deal {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Kessa apologises to it, too.', colors: { primary: 0x3a2a24, secondary: 0xff7a2a, glow: 0xffb066 },
    effects: [skillMods(['kilnheart'], { duration: 25 }), skillMods(tagged('burn'), {}, { field: 'dmg' })] },
  // ─────────────────────────── engine wave 3 (lifeBelow + castSkill, dashEnd) ───────────────────────────
  { id: 'slagforged_helm', name: 'Slagforged Helm', base: 'head_helm', classes: ['warrior'], power: 'Your Buff skills’ cooldowns are {v}% shorter, and when you fall below 35% Life your ready Buff skill with the longest cooldown activates for free.', range: [20, 30], cubeSlot: 'armor', flavor: 'Poured, not hammered.', colors: { primary: 0x3a2a24, secondary: 0xff7a2a, glow: 0xffb066 },
    effects: [skillMods(tagged('buff'), {}, { field: 'cooldown', sign: -1 }), proc('lifeBelow', { lifePct: 35, castSkill: { tags: tagged('buff'), pick: 'longestCooldown' } })] },
  // "Movement skill" = the dash (the engine's one Movement skill); the tremor is centred on the landing point.
  { id: 'quakestep_sabatons', name: 'Quakestep Sabatons', base: 'feet_greaves', classes: ['warrior'], power: 'When a Movement skill ends, a tremor stuns enemies within 120 units for 1 second and deals {v}% weapon damage to them (once every 3 seconds).', range: [60, 80], cubeSlot: 'armor', flavor: 'The ground remembers where they landed.', colors: { primary: 0x726549, secondary: 0x3a2f25, glow: 0xffd27f },
    effects: [proc('dashEnd', { icdMs: 3000, strike: { id: 'quakestep', coef: { roll: 0.01 }, radius: 120, at: 'self', visual: 'tremor_ring' }, applyStatus: { kind: 'stun', ms: 1000, radius: 120, at: 'self' } })] },
];

/** Bible v2 set colours: every set glows 0x3cff6e [M]; primaries / secondaries from WARRIOR.md §7 or the existing set. */
const glow = 0x3cff6e;

// parityLoadout: the bible's internal test fixture for the set (WARRIOR.md §2), never shown to players.
export const WARRIOR_SETS: SetDef[] = [
  {
    id: 'endless_storm', name: 'Raiment of the Endless Storm', classId: 'warrior',
    pieces: [
      { base: 'head_horned', name: 'Stormcrown' }, { base: 'shoulders_spiked', name: 'Storm-Torn Mantle' },
      { base: 'chest_plate', name: 'Heart of the Gale' }, { base: 'hands_gauntlets', name: 'Gyrefists' },
      { base: 'legs_plate', name: 'Legplates of the Spiral' }, { base: 'feet_greaves', name: 'Eyewall Sabatons' },
    ],
    bonuses: [
      // Movement while channelling: +15 on the channel's movement var (Ironplough's -40 slow becomes -25).
      { count: 2, text: 'Your Channel skills cost 25% less, and you move 15% faster while channelling.', effects: [skillMods(tagged('channel'), { cost: -25, vars: { channelMovePct: 15 } })] },
      { count: 4, text: 'While channelling you take 40% less damage, and your Channel skills’ hits make enemies Bleed for 30% of the hit over 3 seconds.',
        effects: [{ kind: 'damageTaken', pct: -40, when: { channeling: tagged('channel') } }, flags(tagged('channel'), 'stormBleed')] },
      { count: 6, text: 'While you channel, a wind wisp spawns every second and circles you, pulling enemies inward and dealing 25% of your channel’s damage per second. Your Channel skills and wisps deal 25% increased damage.',
        // Wisps strike as 'dust_devil', a sub-strike that inherits Whirlwind's tags (Channel), so one tag query covers both.
        effects: [flags(tagged('channel'), 'stormWisps'), ownMult(tagged('channel'), 1.25)] },
    ],
    colors: { primary: 0x4a5a6a, secondary: 0x9fe3ff, glow },
    parityLoadout: ['whirlwind', 'cairnfall', 'ground_stomp', 'battle_rage'],
  },
  {
    id: 'cinder_oath', name: 'Cinder Oath', classId: 'warrior',
    pieces: WARRIOR_SET_BASES.map((base, i) => ({ base, name: `Cinder Oath ${['Crown', 'Mantle', 'Vest', 'Grips', 'Legwraps', 'Treads'][i]}` })),
    bonuses: [
      // "Your Bleeds also Burn (they deal Fire damage and count as both)": Bleed skills gain the Burn tag, and their Bleeds
      // also count as Burns (target state burning) and deal Fire damage (engine wave 3 dot rule alsoKind / element).
      { count: 2, text: 'Your Bleeds also Burn (they deal Fire damage and count as both), and your Bleed and Burn skills’ areas are 20% larger.',
        effects: [{ kind: 'tagGrant', tags: tagged('bleed'), add: ['burn'] }, { kind: 'dot', dot: 'bleed', alsoKind: 'burn', element: 'fire' }, skillMods(tagged('bleed', 'burn'), { radius: 20 })] },
      // Bible: 30% less. Measured (warrior parity harness): a Fury-limited Spender turns a cost cut into casts 1:1/(1−x),
      // so 30% was worth ×2.2 on Sawtooth Hatchet against the model's ×1.25; 15% fits the model's value.
      { count: 4, text: 'Your Primary hits extend Bleeds and Burns on the target by 0.5 seconds (up to 10 seconds left), your Primary skills deal 20% more damage to Bleeding or Burning enemies, and your Bleed and Burn skills cost 15% less.',
        effects: [flags(tagged('primary'), 'cinderExtend'), skillMore(tagged('primary'), 20, { any: [{ targetState: 'bleeding' }, { targetState: 'burning' }] }), skillMods(tagged('bleed', 'burn'), { cost: -15 })] },
      { count: 6, text: 'Enemies that die while Bleeding or Burning burst into a cinder pool (80 units, 2 seconds) that gives each enemy in it your strongest damage-over-time from the fallen enemy at 50% strength. Your Bleed, Burn and Primary skills deal 25% increased damage.',
        effects: [proc('kill', { when: { any: [{ targetState: 'bleeding' }, { targetState: 'burning' }] }, ground: { def: 'cinder_pool', at: 'target', carryDot: true } }), ownMult(tagged('bleed', 'burn', 'primary'), 1.25)] },
    ],
    colors: { primary: 0x773e35, secondary: 0xc6b88c, glow },
    parityLoadout: ['rend', 'ironplough', 'ground_stomp', 'battle_rage'],
  },
  {
    id: 'fault_warden', name: 'Fault Warden', classId: 'warrior',
    pieces: WARRIOR_SET_BASES.map((base, i) => ({ base, name: `Fault Warden ${['Crown', 'Mantle', 'Vest', 'Grips', 'Legwraps', 'Treads'][i]}` })),
    bonuses: [
      { count: 2, text: 'Your Stun skills’ areas are 25% larger and their cooldowns 15% shorter.', effects: [skillMods(tagged('stun'), { radius: 25, cooldown: -15 })] },
      { count: 4, text: 'Your Spender hits on Stunned enemies trigger an aftershock for 50% of the hit 1 second later, your Stun skills deal 15% more damage, and you take 20% less damage from Stunned enemies.',
        effects: [flags(tagged('spender'), 'faultAftershock'), skillMore(tagged('stun'), 15), { kind: 'damageTaken', pct: -20, when: { targetState: 'stunned' } }] },
      { count: 6, text: 'Stunning an enemy raises a fault line under it for 3 seconds that re-stuns enemies crossing it (once per 3 seconds each). All your skills deal 35% more damage to Stunned enemies.',
        // Class code (warriorKit.wStun) raises the line for stuns your skills apply; the line's own stuns do not raise more.
        effects: [flags(ANY_SKILL, 'faultLines'), conditional({ targetState: 'stunned' }, 'hit', 35)] },
    ],
    colors: { primary: 0x726549, secondary: 0xc6b88c, glow },
    parityLoadout: ['cairnfall', 'ironplough', 'ground_stomp', 'battle_rage'],
  },
  // ─────────────────────────── M1 sets (bible v2 §7) ───────────────────────────
  {
    id: 'furrowmark', name: 'Furrowmark', classId: 'warrior',
    // Footprint: head, shoulders, chest, hands, belt and bracers (legs and feet stay free for legendaries).
    pieces: [
      { base: 'head_helm', name: 'Furrowmark Helm' }, { base: 'shoulders_plate', name: 'Share-Plate Spaulders' },
      { base: 'chest_mail', name: "Ploughman's Hauberk" }, { base: 'hands_gauntlets', name: 'Haft Gauntlets' },
      { base: 'waist_belt', name: 'Harness Belt' }, { base: 'wrists_bracers', name: 'Yoke-Ring Bracers' },
    ],
    bonuses: [
      { count: 2, text: 'Your Displace effects move enemies 50% farther, and your Channel and Displace skills cost 15% less.',
        effects: [flags(tagged('displace'), 'furrowPush'), skillMods(tagged('channel', 'displace'), { cost: -15 })] },
      // "In front of you" = your facing ± 90° [P] (the front half; an aiming channel such as Ironplough faces its cone).
      { count: 4, text: 'Enemies you Displace into a wall or another enemy are Stunned for 1 second, your Displace skills deal 35% more damage to enemies Displaced in the last 2 seconds, and while channelling you take 30% less damage from enemies in front of you.',
        effects: [flags(tagged('displace'), 'furrowStun', 'furrowVuln'), { kind: 'damageTaken', pct: -30, when: { all: [{ channeling: tagged('channel') }, { targetInFront: 90 }] } }] },
      { count: 6, text: 'Displaced enemies leave a 3 second furrow that strikes enemies crossing it for 50% weapon damage and pulls them toward you; ramp-up effects are kept for 2 seconds after a channel ends. Your Displace skills deal 25% increased damage.',
        // Class code (warriorKit.wPush / wPull) lays the furrow for your Displace effects; the furrow's own pull does not lay more.
        effects: [flags(tagged('displace'), 'furrowGround'), flags(tagged('channel'), 'furrowKeepRamp'), ownMult(tagged('displace'), 1.25)] },
    ],
    colors: { primary: 0x5e4a33, secondary: 0x9aa1a6, glow },
    parityLoadout: ['ironplough', 'sawtooth_hatchet', 'ground_stomp', 'battle_rage'],
  },
  {
    id: 'hearthbanner', name: 'Hearthbanner', classId: 'warrior',
    pieces: [
      { base: 'head_horned', name: 'Hearthbanner Crest' }, { base: 'shoulders_spiked', name: 'Pennant Spaulders' },
      { base: 'chest_plate', name: "Banner-Bearer's Plate" }, { base: 'hands_gauntlets', name: 'Haft Grips' },
      { base: 'legs_plate', name: 'Muster Legplates' }, { base: 'feet_greaves', name: 'March Sabatons' },
    ],
    bonuses: [
      { count: 2, text: 'Your Buff skills’ cooldowns are 25% shorter, and each active Buff skill grants you 5% attack speed.',
        effects: [skillMods(tagged('buff'), { cooldown: -25 }), flags(tagged('buff'), 'hearthIas')] },
      { count: 4, text: 'While a Buff skill is active you take 20% less damage, and your Primary skills generate 3 more Fury and deal 25% more damage.',
        effects: [{ kind: 'damageTaken', pct: -20, when: BUFF_UP }, flags(tagged('primary'), 'hearthGen'), skillMore(tagged('primary'), 25, BUFF_UP)] },
      // Bible: a 100% shockwave; measured on Cleave that transform alone was worth ×1.2, above BUDGET.md R1's ×1.10 for a
      // 6-piece transform, so it is 50%.
      { count: 6, text: 'Your Ground Buff skills follow you. While a Buff skill is active, every third Primary hit releases a shockwave (140 units, 50% weapon damage), and your Primary and Burn skills deal 25% more damage.',
        effects: [flags(tagged('buff'), 'hearthFollow'), flags(tagged('primary'), 'hearthShock'), skillMore(tagged('primary', 'burn'), 25, BUFF_UP)] },
    ],
    colors: { primary: 0x8c2f24, secondary: 0xd8b45a, glow },
    parityLoadout: ['muster_standard', 'battle_rage', 'sawtooth_hatchet', 'kilnheart'],
  },
];
