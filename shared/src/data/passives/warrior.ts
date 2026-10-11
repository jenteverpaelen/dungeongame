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
  // Bible: "slows enemies by 30%"; the engine's one slow is the 40% chill, so the text names the chill.
  { id: 'warrior_deep_earth', classId: 'warrior', name: 'Deep Earth', unlock: 45, note: 'The ground keeps shaking after a stun.',
    effects: [flags(tagged('stun'), 'deepEarth'), conditional({ targetState: 'chilled' }, 'hit', 10)],
    text: 'Your Stun skills leave tremor ground for 2 seconds that chills enemies inside, and you deal 10% more damage to chilled enemies.' },
  { id: 'warrior_second_wind', classId: 'warrior', name: 'Second Wind', unlock: 55, note: 'Not yet.',
    effects: [{ kind: 'cheatDeath', lifePct: 40, cooldownMs: 90000, resetCooldowns: ['ground_stomp', 'cairnfall'] }],
    text: 'Once every 90 seconds, fatal damage instead leaves you at 40% Life and resets the cooldowns of Ground Stomp and Cairnfall.' },
];
