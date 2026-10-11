// Which power templates are active for a character, in one canonical order: set bonuses (registry order, then
// threshold order) → legendary powers (registry order) → the one active Inscription → passives (slot order) →
// specialization nodes of the skills on the bar (primary, then slots). The order is part of the numeric contract (floating-point products are evaluated in
// it) and reproduces the pre-template code exactly for all 22 legendaries and 9 sets.

import { activeInscription } from './data/inscriptions';
import { LEGENDARIES, SETS } from './data/items';
import { SKILLS } from './data/skills';
import type { PowerEffect } from './powers';
import { savedNodeRanks } from './specialization';
import type { CharacterSave, DerivedStats } from './types';

export interface PowerSource {
  kind: 'set' | 'legendary' | 'inscription' | 'passive' | 'node' | 'rune' | 'affix';
  /** set:<id>:<count>, legendary id, inscription:<id>, passive id, <skill>:<node>, <skill>:rune:<rune>, or affixes. */
  id: string;
  /** Value for `{ roll }` amounts: the legendary's rolled value (Cube: maximum), a node's rank, otherwise 1. */
  roll: number;
  effects: readonly PowerEffect[];
}

/** The active set reduction (Journeyman's Ring: `setReduce` on an active legendary power); the largest applies, never stacks. */
export function setReduction(powers: Readonly<Record<string, number>>): { by: number; min: number } | null {
  let out: { by: number; min: number } | null = null;
  for (const id of Object.keys(powers)) {
    if (!powers[id] || !Object.hasOwn(LEGENDARIES, id)) continue;
    for (const e of LEGENDARIES[id].effects) if (e.kind === 'setReduce' && (!out || (e.by ?? 1) > out.by)) out = { by: e.by ?? 1, min: e.min ?? 2 };
  }
  return out;
}

/** Worn pieces a set bonus of `count` needs under a set reduction. */
export const setThreshold = (count: number, red: { by: number; min: number } | null): number =>
  red ? Math.max(Math.min(count, red.min), count - red.by) : count;

/** Set bonuses and legendary powers from equipped / Cube-equipped items (DerivedStats.powers / .sets). */
export function itemPowerSources(powers: Readonly<Record<string, number>>, sets: Readonly<Record<string, number>>): PowerSource[] {
  const out: PowerSource[] = [];
  const red = setReduction(powers);
  for (const set of Object.values(SETS)) {
    const n = sets[set.id] ?? 0;
    if (!n) continue;
    for (const b of set.bonuses) if (n >= setThreshold(b.count, red) && b.effects?.length) out.push({ kind: 'set', id: `set:${set.id}:${b.count}`, roll: 1, effects: b.effects });
  }
  for (const l of Object.values(LEGENDARIES)) {
    const v = powers[l.id];
    if (v && l.effects.length) out.push({ kind: 'legendary', id: l.id, roll: v, effects: l.effects });
  }
  return out;
}

/**
 * Specialization-node effects, then the equipped rune's effects, of the skills currently on the bar (unlocked primary and
 * slotted skills; a rune counts once it is unlocked).
 */
export function nodePowerSources(save: Pick<CharacterSave, 'classId' | 'level' | 'skills'>): PowerSource[] {
  const out: PowerSource[] = [];
  const bar = [save.skills.primary, ...save.skills.slots];
  const seen = new Set<string>();
  for (const id of bar) {
    if (!id || seen.has(id) || !Object.hasOwn(SKILLS, id)) continue;
    seen.add(id);
    const skill = SKILLS[id];
    if (skill.classId !== save.classId || skill.unlock > save.level) continue;
    const ranks = savedNodeRanks(save, id);
    for (const node of skill.nodes ?? []) {
      const r = Math.min(node.maxRank, Math.max(0, Math.floor(ranks[node.id] ?? 0)));
      if (r > 0 && node.effects?.length) out.push({ kind: 'node', id: `${id}:${node.id}`, roll: r, effects: node.effects });
    }
    const runeId = save.skills.runes?.[id];
    const rune = runeId ? skill.runes.find((x) => x.id === runeId) : undefined;
    if (rune?.effects?.length && rune.unlock <= save.level) out.push({ kind: 'rune', id: `${id}:rune:${rune.id}`, roll: 1, effects: rune.effects });
  }
  return out;
}

/**
 * Shared-items wave affixes that are tag-keyed bonuses, as power templates (one source, empty without such affixes):
 * the skill-group damage affixes join the additive skill bucket of the tagged skills (like "+x% skill damage"), the
 * others are SkillMods / dot strength / a vulnerability-position conditional / a kill proc. Appended after every other
 * source, so they cannot change any earlier product.
 */
export function affixPowerSources(d: Pick<DerivedStats, 'summonDmg' | 'primaryDmg' | 'spenderDmg' | 'cooldownDmg' | 'areaRadius' | 'channelCost'
  | 'summonDuration' | 'buffDuration' | 'pierceChance' | 'dotDmg' | 'vsControlled' | 'resourceOnKill'>): PowerSource[] {
  const effects: PowerEffect[] = [];
  const mods = (tag: Parameters<typeof tagQuery>[0], m: Record<string, number>) => effects.push({ kind: 'skillMods', tags: tagQuery(tag), mods: m });
  if (d.summonDmg > 0) mods('summon', { dmg: d.summonDmg });
  if (d.primaryDmg > 0) mods('primary', { dmg: d.primaryDmg });
  if (d.spenderDmg > 0) mods('spender', { dmg: d.spenderDmg });
  if (d.cooldownDmg > 0) mods('cooldown', { dmg: d.cooldownDmg });
  if (d.areaRadius > 0) mods('area', { radius: d.areaRadius });
  if (d.channelCost > 0) mods('channel', { cost: -d.channelCost });
  if (d.summonDuration > 0) mods('summon', { duration: d.summonDuration });
  if (d.buffDuration > 0) mods('buff', { duration: d.buffDuration });
  if (d.pierceChance > 0) mods('projectile', { pierce: d.pierceChance });
  if (d.dotDmg > 0) for (const dot of ['bleed', 'burn', 'poison'] as const) effects.push({ kind: 'dot', dot, strengthPct: 100 + d.dotDmg });
  if (d.vsControlled > 0) effects.push({ kind: 'conditional', when: { targetState: 'immobilised' }, bucket: 'hit', pct: d.vsControlled });
  if (d.resourceOnKill > 0) effects.push({ kind: 'proc', on: 'kill', resource: d.resourceOnKill });
  return effects.length ? [{ kind: 'affix', id: 'affixes', roll: 1, effects }] : [];
}
const tagQuery = (t: 'summon' | 'primary' | 'spender' | 'cooldown' | 'area' | 'channel' | 'buff' | 'projectile') => ({ anyOf: [t] });

/** The active Inscription as a source (none when no equipped item carries a known one). */
export function inscriptionPowerSources(equipment: CharacterSave['equipment'] | undefined): PowerSource[] {
  const a = equipment ? activeInscription(equipment) : null;
  return a && a.def.effects.length ? [{ kind: 'inscription', id: `inscription:${a.def.id}`, roll: 1, effects: a.def.effects }] : [];
}

/**
 * Every active source. `passives` comes from shared/src/passives.ts (kept separate to avoid an import cycle). The
 * Inscription is read from `save.equipment` when present (Inscriptions carry no stat templates, so the character sheet's
 * swapped-equipment comparisons do not need it).
 */
export function allPowerSources(save: Pick<CharacterSave, 'classId' | 'level' | 'skills'> & { equipment?: CharacterSave['equipment'] }, powers: Readonly<Record<string, number>>,
  sets: Readonly<Record<string, number>>, passives: readonly PowerSource[] = []): PowerSource[] {
  return [...itemPowerSources(powers, sets), ...inscriptionPowerSources(save.equipment), ...passives, ...nodePowerSources(save)];
}
