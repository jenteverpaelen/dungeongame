// Mage passives (data only). Stat passives use the level-scaled head-affix mean (L116/D054); build-defining
// passives use power templates (`effects`, shared/src/powers.ts). Append new passives at the end.
// Content: docs/rework/depth/MAGE.md §6 (bible v2): the new passives key off tags. Flags are read by
// server/src/sim/skills/mage*.ts (behaviour no template expresses).
import type { PassiveDef } from '../../passives';
import { flags, skillMods, skillMore, tagged } from '../../powers';

/** Every mage skill (each carries an element tag). */
const ANY_SKILL = tagged('physical', 'fire', 'cold', 'lightning', 'arcane');

export const MAGE_PASSIVES: PassiveDef[] = [
  { id: 'mage_meteor', classId: 'mage', name: 'Falling Measure', unlock: 10, stat: 'skillDmg', skill: 'meteor', note: 'Specialise in the impact of falling spells.' },
  { id: 'mage_hydra', classId: 'mage', name: 'Coiled Flame', unlock: 10, stat: 'skillDmg', skill: 'hydra', note: 'Specialise in damage from summoned hydras.' },
  { id: 'mage_reserve', classId: 'mage', name: 'Deep Current', unlock: 20, stat: 'resourceRegen', note: 'Recover more resource between costly skills.' },
  { id: 'mage_timing', classId: 'mage', name: 'Return Pattern', unlock: 30, stat: 'cdr', note: 'Bring cooldown skills back sooner. Existing cooldowns are not reset.' },
  { id: 'mage_heart', classId: 'mage', name: 'Steady Vessel', unlock: 40, stat: 'lifePct', note: 'Carry more life into dangerous encounters. Changing this preserves your life percentage.' },
  { id: 'mage_guard', classId: 'mage', name: 'Prism Mantle', unlock: 50, stat: 'allRes', note: 'Strengthen your defenses when damage matters more than speed.' },
  // ─────────────────────────── bible v2 §6: rules, keyed to tags ───────────────────────────
  { id: 'mage_chill_margin', classId: 'mage', name: 'Chill Margin', unlock: 14, note: 'Cold that lingers, cold that bites.',
    effects: [skillMore(tagged('cold'), 15, { targetState: 'chilled' }), { kind: 'rule', rule: { id: 'statusLonger', status: 'chill', pct: 25 } }],
    text: 'Your Cold skills deal 15% more damage to Chilled enemies, and your Chills last 25% longer.' },
  { id: 'mage_astral_debt', classId: 'mage', name: 'Astral Debt', unlock: 18, note: 'Spend now, pay later.',
    effects: [{ kind: 'resourceDebt', max: 50, tags: tagged('spender'), regenPct: -50 }, { kind: 'damageTaken', pct: 10, when: { inDebt: true } }],
    text: 'Your Spender skills can be cast with too little Arcane Power, going up to 50 into debt; while in debt, Arcane Power regeneration is halved and you take 10% more damage.' },
  // Summons from passives are not counted by the item count cap (FOUNDATION.md §5).
  { id: 'mage_conjurers_hearth', classId: 'mage', name: 'Conjurer’s Hearth', unlock: 24, note: 'The hearth keeps company.',
    effects: [skillMods(tagged('summon'), { maxSummons: 1, duration: 20 }), skillMore({ ...ANY_SKILL, noneOf: ['summon'] }, -10)],
    text: 'Your Summon skills get 1 more maximum each and your Summons last 20% longer; your non-Summon skills deal 10% less damage.' },
  { id: 'mage_resonance', classId: 'mage', name: 'Resonance', unlock: 28, note: 'Hold the note.',
    effects: [skillMods(tagged('channel'), { flags: ['resonance'], vars: { rampRate: 40 } })],
    text: 'Your Channel skills ramp up 40% faster, and their ramp is kept for 1 second when they stop (so another cast in between keeps it).' },
  { id: 'mage_ley_anchor', classId: 'mage', name: 'Ley Anchor', unlock: 36, note: 'Stand where your magic stands.',
    effects: [flags(ANY_SKILL, 'leyAnchor')],
    text: 'While you stand in one of your Ground effects, your skills cost 25% less and your cooldowns recover 15% faster.' },
  { id: 'mage_missile_choir', classId: 'mage', name: 'Missile Choir', unlock: 45, note: 'A full well sings.',
    effects: [flags({ allOf: ['primary', 'projectile'] }, 'missileChoir')],
    text: 'Your Primary Projectile skills fire one more projectile for every 25 Arcane Power you hold (at most 3 more), each dealing 60% damage.' },
  { id: 'mage_unbroken_ward', classId: 'mage', name: 'Unbroken Ward', unlock: 55, note: 'The first blow glances off.',
    effects: [{ kind: 'firstHit', pct: -60, windowMs: 8000, resetOnStatus: ['freeze'] }],
    text: 'The first hit you take every 8 seconds is reduced by 60%; freezing an enemy resets the timer.' },
  { id: 'mage_starborn', classId: 'mage', name: 'Starborn', unlock: 64, note: 'Every spell pays the sky.',
    effects: [skillMore(tagged('aerial', 'cooldown'), 20), flags(ANY_SKILL, 'starborn')],
    text: 'Your Aerial and Cooldown skills deal 20% more damage, and every 30 Arcane Power you spend calls a small falling star on a nearby enemy for 150% weapon damage as Fire.' },
];
