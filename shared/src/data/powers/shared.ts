// Any-class legendary powers (data only; power templates from shared/src/powers.ts). Append new entries at the end.
// Shared-items wave (docs/rework/depth/ITEMS-SHARED.md §2): 13 tag-keyed legendaries appended after the six v1 items;
// texts, ranges, bases and flavour are the bible's. Colours [P]: the motif glow of gearStyle.motifColor (ITEMS-SHARED §6
// motif list) with base-material tones; the gear-visual agent assigns the motifs.

import type { LegendaryDef } from '../items';
import { ROLL, conditional, proc, skillMods, skillMore, stat, tagged } from '../../powers';

export const SHARED_LEGENDARIES: LegendaryDef[] = [
  { id: 'ouroboros_loop', name: 'Ouroboros Loop', base: 'ring', power: 'Gain a {v}% damage bonus to a single element that rotates every 4 seconds.', range: [60, 80], cubeSlot: 'jewelry', flavor: 'Fire becomes frost becomes storm becomes fire.', colors: { primary: 0xd4af37, secondary: 0x9fe3ff, glow: 0xffe08a },
    effects: [{ kind: 'elementCycle', elements: ['fire', 'cold', 'lightning', 'arcane', 'physical'], periodMs: 4000, pct: ROLL, buffPrefix: 'ouroboros' }] },
  { id: 'patient_thief', name: 'Seal of the Patient Thief', base: 'ring', power: 'Each resource-spending skill reduces your active cooldowns by {v} seconds.', range: [0.75, 1], cubeSlot: 'jewelry', flavor: 'Time is the only thing worth stealing.', colors: { primary: 0x1a1a1a, secondary: 0xc9a227, glow: 0xffd27f },
    effects: [proc('spend', { reduceCooldownsMs: { roll: 1000 } })] },
  { id: 'hellforge_talisman', name: 'Hellforge Talisman', base: 'neck_amulet', power: 'Killing an elite grants {v}% increased damage for 30 seconds.', range: [30, 40], cubeSlot: 'jewelry', flavor: 'Quenched in the blood of something that should not have died.', colors: { primary: 0x8b1e1e, secondary: 0xff7a1a, glow: 0xff5a36 },
    effects: [proc('eliteKill', { buff: { id: 'hellforge', ms: 30000, dmg: ROLL } })] },
  { id: 'witching_cord', name: 'Witching Cord', base: 'waist_sash', power: 'Increases Critical Hit Damage by {v}% and attack speed by 7%.', range: [45, 50], cubeSlot: 'armor', flavor: 'Tied at midnight, untied at dawn.', colors: { primary: 0x2e1a3d, secondary: 0xb388ff, glow: 0xd6c2ff },
    effects: [stat('chd', ROLL), stat('ias', 7)] },
  { id: 'stridewind', name: 'Stridewind Greaves', base: 'feet_boots', power: 'Dash cooldown is reduced by 50%, and dashing grants {v}% increased damage for 3 seconds.', range: [40, 50], cubeSlot: 'armor', flavor: 'They have never once stood still.', colors: { primary: 0x2f4f4f, secondary: 0x9fe3ff, glow: 0xbdf6ff },
    effects: [{ kind: 'dashCooldown', mult: 0.5 }, proc('dash', { buff: { id: 'stridewind', ms: 3000, dmg: ROLL } })] },
  { id: 'mountain_fists', name: 'Fists of the Mountain', base: 'hands_gauntlets', power: 'Area damage is increased by {v}% and attack speed by 15%.', range: [40, 50], cubeSlot: 'armor', flavor: 'Every blow is an avalanche.', colors: { primary: 0x6e5a48, secondary: 0xc9a227, glow: 0xffc06b },
    effects: [stat('area', ROLL), stat('ias', 15)] },
  // ── Shared-items wave (ITEMS-SHARED.md §2) ──
  { id: 'patchwork_signet', name: 'Patchwork Signet', base: 'ring', power: 'While no set bonus is active, each equipped legendary item increases your damage by {v}% (max 10 items) and reduces damage taken by 1%.', range: [2, 3], cubeSlot: 'jewelry', extractable: false,
    flavor: 'Mended so often there is nothing original left.', colors: { primary: 0xb87333, secondary: 0xd4af37, glow: 0xffe08a },
    effects: [{ kind: 'stat', stat: 'dmgPct', value: ROLL, perLegendary: { max: 10 }, noSetBonus: true }, { kind: 'damageTaken', pct: -1, perLegendary: { max: 10 }, noSetBonus: true }] },
  { id: 'journeymans_ring', name: "Journeyman's Ring", base: 'ring', power: 'Set bonuses require one fewer item (minimum 2). Does not stack.', range: [1, 1], cubeSlot: 'jewelry', extractable: false,
    flavor: 'Fits any hand that has learned two trades.', colors: { primary: 0xc0c0c0, secondary: 0xd4af37, glow: 0xffe08a },
    effects: [{ kind: 'setReduce', by: 1, min: 2 }] },
  { id: 'watchkeepers_hood', name: "Watchkeeper's Hood", base: 'head_hood', power: 'While no enemy is within 200 units, your Projectile and Aerial skills deal {v}% more damage.', range: [20, 30], cubeSlot: 'armor',
    flavor: 'Venn never takes it off. Never.', colors: { primary: 0x34344a, secondary: 0x1a1a1a, glow: 0xffd27f },
    effects: [skillMore(tagged('projectile', 'aerial'), ROLL, { noEnemyWithin: 200 })] },
  { id: 'kilnwatch_spaulders', name: 'Kilnwatch Spaulders', base: 'shoulders_plate', power: 'Casting a Cooldown skill grants {v}% increased damage for 5 s.', range: [15, 20], cubeSlot: 'armor',
    flavor: 'Warm on the coldest watch.', colors: { primary: 0x7a6248, secondary: 0xff7a1a, glow: 0xff8a3a },
    effects: [proc('cast', { tags: tagged('cooldown'), buff: { id: 'kilnwatch', ms: 5000, dmg: ROLL } })] },
  { id: 'hearthguard_coat', name: 'Hearthguard Coat', base: 'chest_mail', power: 'While channelling or standing in one of your Ground effects, you deal {v}% increased damage and take 15% less damage.', range: [20, 30], cubeSlot: 'armor',
    flavor: 'It smells of bread and smoke.', colors: { primary: 0x8a9099, secondary: 0xd4af37, glow: 0xfff3b0 },
    effects: [conditional({ any: [{ channeling: true }, { inOwnGround: true }] }, 'hit', ROLL), { kind: 'damageTaken', pct: -15, when: { any: [{ channeling: true }, { inOwnGround: true }] } }] },
  { id: 'ink_stained_gloves', name: 'Ink-Stained Gloves', base: 'hands_gloves', power: 'Your Primary skills deal {v}% increased damage; every 5th Primary attack repeats once.', range: [50, 75], cubeSlot: 'armor',
    flavor: 'Orren counts people. These count blows.', colors: { primary: 0x4a3426, secondary: 0x1a1a1a, glow: 0xffd27f },
    effects: [skillMods(tagged('primary'), {}, { field: 'dmg' }), proc('attack', { every: 5, repeat: true })] },
  { id: 'causeway_waders', name: 'Causeway Waders', base: 'legs_waders', power: 'After you stand still for 1 s, your Summons and Ground effects deal {v}% more damage until you move.', range: [25, 35], cubeSlot: 'armor',
    flavor: 'Sera lent them out once.', colors: { primary: 0x4a3426, secondary: 0x2f5f5f, glow: 0xffd27f },
    effects: [skillMore(tagged('summon', 'ground'), ROLL, { standingStillMs: 1000 })] },
  { id: 'ridgewalker_boots', name: 'Ridgewalker Boots', base: 'feet_boots', power: 'Every 100 units you move adds a stack (max 5): your Spender skills deal {v}% more damage per stack; stacks fall off after 2 s standing still.', range: [4, 6], cubeSlot: 'armor',
    flavor: 'Tallis wore through three pairs.', colors: { primary: 0x6b5a3a, secondary: 0x9fe3ff, glow: 0xbff2ff },
    effects: [{ kind: 'stacking', buff: 'ridgewalker', source: 'distance', per: 100, max: 5, decayMs: 2000 }, skillMore(tagged('spender'), ROLL, { buffStacks: 'ridgewalker', max: 5 })] },
  { id: 'surveyors_plumb', name: "Surveyor's Plumb", base: 'neck_amulet', power: 'Your Marks also apply to the nearest other enemy, and Marked enemies take {v}% more damage from you.', range: [20, 30], cubeSlot: 'jewelry',
    flavor: 'Iven trusts it more than the ground.', colors: { primary: 0xb87333, secondary: 0x1a1a1a, glow: 0xffd27f },
    // [M] 360 = the projectile retarget radius (projectiles.ts) — "nearest other enemy" needs a reach; the bible gives none.
    effects: [{ kind: 'rule', rule: { id: 'markSpread', range: 360 } }, conditional({ targetState: 'marked' }, 'hit', ROLL)] },
  { id: 'brine_tally', name: 'Brine Tally', base: 'ring', power: 'Killing an enemy that suffers your Bleed or Burn adds a tally (max 20); at 20 your attack speed and cooldown recovery are {v}% faster for 10 s.', range: [15, 20], cubeSlot: 'jewelry',
    flavor: 'Neris notches it every evening.', colors: { primary: 0xc0c0c0, secondary: 0x2f5f5f, glow: 0xffe08a },
    effects: [{ kind: 'stacking', buff: 'brine_tally', source: 'kills', per: 1, max: 20, decayMs: Infinity, when: { any: [{ targetState: 'bleeding' }, { targetState: 'burning' }] },
      onMax: { buff: { id: 'brine_surge', ms: 10000, ias: ROLL, cdRecovery: ROLL }, reset: true } }] },
  { id: 'signal_horn_charm', name: 'Signal Horn Charm', base: 'neck_amulet', power: 'Your Summons deal {v}% more damage.', range: [15, 25], cubeSlot: 'jewelry',
    flavor: 'Small enough to forget, loud enough to remember.', colors: { primary: 0xd4af37, secondary: 0xc8b6ff, glow: 0xd6c2ff },
    effects: [skillMore(tagged('summon'), ROLL)] },
  { id: 'lockglass_cincture', name: 'Lockglass Cincture', base: 'waist_belt', power: 'Your Channel skills cost {v}% less, and you cannot be knocked back while channelling.', range: [20, 30], cubeSlot: 'armor',
    flavor: 'Aven says it holds still on purpose.', colors: { primary: 0x5c3d24, secondary: 0x8f9a9e, glow: 0xd8f2ff },
    effects: [skillMods(tagged('channel'), {}, { field: 'cost', sign: -1 }), { kind: 'controlImmunity', kinds: ['pull'], when: { channeling: true } }] },
  { id: 'wardkeepers_cuffs', name: "Wardkeeper's Cuffs", base: 'wrists_bracers', power: 'Enemies you Stun, Chill or Displace take {v}% more damage from you for 3 s.', range: [12, 18], cubeSlot: 'armor',
    flavor: "Mera's keys, melted down.", colors: { primary: 0x5c3d24, secondary: 0x1a1a1a, glow: 0xffd27f },
    effects: [proc('applyStatus', { status: ['stun', 'freeze', 'chill', 'knockback', 'pull'], applyStatus: { kind: 'vulnerable', pct: ROLL, ms: 3000 } })] },
];
