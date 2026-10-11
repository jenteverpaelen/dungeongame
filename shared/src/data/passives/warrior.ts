// Warrior passives (data only). Stat passives use the level-scaled head-affix mean (L116/D054); build-defining
// passives use power templates (`effects`, shared/src/powers.ts). Append new passives at the end.
import type { PassiveDef } from '../../passives';
import { conditional, flags, proc, skillMods, tagged } from '../../powers';

export const WARRIOR_PASSIVES: PassiveDef[] = [
  { id: 'warrior_whirlwind', classId: 'warrior', name: 'Turning Edge', unlock: 10, stat: 'skillDmg', skill: 'whirlwind', note: 'Specialise in sustained close-range sweeps.' },
  { id: 'warrior_seismic_slam', classId: 'warrior', name: 'Fault Reader', unlock: 10, stat: 'skillDmg', skill: 'seismic_slam', note: 'Specialise in striking along a broken front.' },
  { id: 'warrior_reserve', classId: 'warrior', name: 'Banked Fury', unlock: 20, stat: 'resourceRegen', note: 'Recover more resource between costly skills.' },
  { id: 'warrior_timing', classId: 'warrior', name: 'Measured Recovery', unlock: 30, stat: 'cdr', note: 'Bring cooldown skills back sooner. Existing cooldowns are not reset.' },
  { id: 'warrior_heart', classId: 'warrior', name: 'Rooted Heart', unlock: 40, stat: 'lifePct', note: 'Carry more life into dangerous encounters. Changing this preserves your life percentage.' },
  { id: 'warrior_guard', classId: 'warrior', name: 'Iron Poise', unlock: 50, stat: 'armor', note: 'Strengthen your defenses when damage matters more than speed.' },
  // ─────────────────────────── bible v2 §6: rules, keyed to tags ───────────────────────────
  // "max 10 per second" = 2 Fury at most once every 0.2 s.
  { id: 'warrior_bellwether', classId: 'warrior', name: 'Bellwether', unlock: 14, note: 'Every stun feeds the next blow.',
    effects: [proc('applyStatus', { status: ['stun'], icdMs: 200, resource: 2, buff: { id: 'bellwether', ms: 4000, stackIas: 4, maxStacks: 5 } })],
    text: 'Stunning an enemy grants 2 Fury (at most once every 0.2 seconds, so up to 10 per second) and 4% attack speed for 4 seconds (max 5 stacks).' },
  { id: 'warrior_open_veins', classId: 'warrior', name: 'Open Veins', unlock: 18, note: 'Wounds pile up instead of refreshing.',
    effects: [{ kind: 'dot', dot: 'bleed', stacks: 3, strengthPct: 70 }],
    text: 'Your Bleeds no longer refresh: each new application adds a separate instance (up to 3 per enemy per skill), each at 70% strength.' },
  { id: 'warrior_war_drummer', classId: 'warrior', name: 'War Drummer', unlock: 28, note: 'Keep the warcries going.',
    effects: [skillMods(tagged('buff'), { duration: 30 }),
      conditional({ any: [{ all: [{ buff: 'battle_rage' }, { buff: 'muster_standard' }] }, { all: [{ buff: 'battle_rage' }, { buff: 'kilnheart' }] }, { all: [{ buff: 'muster_standard' }, { buff: 'kilnheart' }] }] }, 'own', 25, tagged('primary'))],
    text: 'Your Buff skills last 30% longer; while two of them are active, your Primary skills deal 25% increased damage.' },
  // Slowed = slowed or chilled (a chill slows too).
  { id: 'warrior_deep_earth', classId: 'warrior', name: 'Deep Earth', unlock: 45, note: 'The ground keeps shaking after a stun.',
    effects: [flags(tagged('stun'), 'deepEarth'), conditional({ targetState: 'slowed' }, 'hit', 10)],
    text: 'Your Stun skills leave tremor ground for 2 seconds that slows enemies inside by 30%, and you deal 10% more damage to slowed enemies.' },
  { id: 'warrior_second_wind', classId: 'warrior', name: 'Second Wind', unlock: 55, note: 'Not yet.',
    effects: [{ kind: 'cheatDeath', lifePct: 40, cooldownMs: 90000, resetCooldowns: ['ground_stomp', 'cairnfall'] }],
    text: 'Once every 90 seconds, fatal damage instead leaves you at 40% Life and resets the cooldowns of Ground Stomp and Cairnfall.' },
  // ─────────────────────────── engine wave 3 (bible v2 §6) ───────────────────────────
  { id: 'warrior_spinning_top', classId: 'warrior', name: 'Spinning Top', unlock: 24, note: 'The longer you turn, the faster you go.',
    effects: [{ kind: 'stacking', buff: 'spinning_top', source: 'channel', per: 1000, max: 5, decayMs: 1000, stackDmg: 4, stackMoveSpeed: 3 }],
    text: 'While channelling, each second adds a stack (max 5) of 4% increased damage and 3% movement speed; the stacks last 1 second after the channel ends.' },
  // Two procs on the same hit and internal cooldown: the Mark (target state "marked") and your own vulnerability.
  { id: 'warrior_grudge_holder', classId: 'warrior', name: 'Grudge Holder', unlock: 36, note: 'Remember who hit you.',
    effects: [
      proc('takeDamage', { when: { targetElite: true }, icdMs: 10000, applyStatus: { kind: 'mark', ms: 6000 } }),
      proc('takeDamage', { when: { targetElite: true }, icdMs: 10000, applyStatus: { kind: 'vulnerable', pct: 15, ms: 6000 } }),
    ],
    text: 'The first elite that damages you every 10 seconds is Marked for 6 seconds and takes 15% more damage from you.' },
  { id: 'warrior_iron_discipline', classId: 'warrior', name: 'Iron Discipline', unlock: 64, note: 'Hold your anger; spend it when it counts.',
    effects: [{ kind: 'rule', rule: { id: 'noDecay' } }, { kind: 'stat', stat: 'maxResource', value: 20 }, skillMods(tagged('primary'), { vars: { genPct: -15 } })],
    text: 'Your Fury no longer decays and your maximum Fury is increased by 20, but your Primary skills generate 15% less Fury.' },
];
