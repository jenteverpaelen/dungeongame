// Ranger passives (data only). Stat passives use the level-scaled head-affix mean (L116/D054); build-defining
// passives use power templates (`effects`, shared/src/powers.ts). Append new passives at the end.
import type { PassiveDef } from '../../passives';
import { conditional, flags, proc, skillMods, tagged } from '../../powers';

/** Every ranger skill (each carries an element tag): carrier of class-code passive flags. */
const ANY_SKILL = tagged('physical', 'fire', 'cold', 'lightning', 'arcane');

export const RANGER_PASSIVES: PassiveDef[] = [
  { id: 'ranger_multishot', classId: 'ranger', name: 'Wide Horizon', unlock: 10, stat: 'skillDmg', skill: 'multishot', note: 'Specialise in covering a broad firing line.' },
  { id: 'ranger_sentry', classId: 'ranger', name: 'Watchmaker', unlock: 10, stat: 'skillDmg', skill: 'sentry', note: 'Specialise in damage from placed sentries.' },
  { id: 'ranger_reserve', classId: 'ranger', name: 'Quiet Reserve', unlock: 20, stat: 'resourceRegen', note: 'Recover more resource between costly skills.' },
  { id: 'ranger_timing', classId: 'ranger', name: 'Patient Timing', unlock: 30, stat: 'cdr', note: 'Bring cooldown skills back sooner. Existing cooldowns are not reset.' },
  { id: 'ranger_heart', classId: 'ranger', name: 'Trail Heart', unlock: 40, stat: 'lifePct', note: 'Carry more life into dangerous encounters. Changing this preserves your life percentage.' },
  { id: 'ranger_guard', classId: 'ranger', name: 'Weathered Guard', unlock: 50, stat: 'armor', note: 'Strengthen your defenses when damage matters more than speed.' },
  // ─────────────────────────── bible v2 §6: rules, keyed to tags ───────────────────────────
  { id: 'ranger_engineers_margin', classId: 'ranger', name: 'Engineer’s Margin', unlock: 14, note: 'More devices, each a little lighter.',
    // Additive skill bucket (the more-multiplier only grows): "15% less" as −15 points.
    effects: [skillMods(tagged('device'), { maxSummons: 1, dmg: -15 })],
    text: 'Your Device skills get +1 maximum each, but each deals 15% less damage.' },
  { id: 'ranger_kinship', classId: 'ranger', name: 'Kinship', unlock: 18, note: 'Your anger runs in the pack.',
    effects: [flags(tagged('beast'), 'kinship')],
    text: 'Your Beasts deal 1% more damage for every 5 Hatred you hold (at most 25%), and their attacks heal you for 0.2% of your maximum Life.' },
  { id: 'ranger_long_shot', classId: 'ranger', name: 'Long Shot', unlock: 24, note: 'Let the arrow work for it.',
    effects: [{ kind: 'projectile', tags: tagged('projectile'), distBonus: { pct: 20, atUnits: 400 } }],
    text: 'Your Projectiles deal up to 20% more damage by distance flown (none at the bow, 20% after 400 units).' },
  // Bible: "Chill (30%)"; the engine's one chill is the 40% slow, so the text names the chill (as the warrior's Deep Earth).
  { id: 'ranger_weather_eye', classId: 'ranger', name: 'Weather Eye', unlock: 28, note: 'Read the sky, then use it.',
    effects: [{ kind: 'tagGrant', tags: tagged('aerial'), add: ['chill'] }, proc('hit', { tags: tagged('aerial'), applyStatus: { kind: 'chill', ms: 2000 } }), conditional({ targetState: 'chilled' }, 'hit', 15)],
    text: 'Your Aerial skills chill enemies for 2 seconds (and count as Chill skills); you deal 15% more damage to chilled enemies.' },
  // Bible: "Stun and Chill effects last 20% longer"; the engine's control-duration stat covers Stun and Freeze.
  { id: 'ranger_trappers_instinct', classId: 'ranger', name: 'Trapper’s Instinct', unlock: 36, note: 'A held animal is a hit animal.',
    effects: [conditional({ any: [{ targetState: 'stunned' }, { targetState: 'chilled' }] }, 'hit', 15), { kind: 'stat', stat: 'ccDuration', value: 20 }],
    text: 'Stunned and chilled enemies take 15% more damage from you, and your Stun and Freeze effects last 20% longer.' },
  { id: 'ranger_hatred_well', classId: 'ranger', name: 'Hatred Well', unlock: 45, note: 'Never quite empty.',
    effects: [flags(ANY_SKILL, 'hatredWell')],
    text: 'Your Hatred regenerates twice as fast below 40 Hatred, and every 100 Hatred you spend reduces your Cooldown skills’ cooldowns by 1 second.' },
  { id: 'ranger_second_skin', classId: 'ranger', name: 'Second Skin', unlock: 55, note: 'Some hits teach you to flinch.',
    effects: [proc('takeDamage', { minHitPct: 25, icdMs: 20000, buff: { id: 'second_skin', ms: 2000, dr: 50 }, applyStatus: { kind: 'stun', ms: 1000, radius: 120, at: 'self' } })],
    text: 'A hit above 25% of your maximum Life grants 50% damage reduction for 2 seconds and releases a burst that stuns enemies within 120 units for 1 second (once every 20 seconds).' },
  { id: 'ranger_hunters_accord', classId: 'ranger', name: 'Hunter’s Accord', unlock: 64, note: 'One mark, many hunters.',
    effects: [flags(ANY_SKILL, 'huntersAccord')],
    text: 'Your marks also apply at half strength to enemies within 150 units of the marked enemy, and move to a new enemy at once when it dies.' },
];
