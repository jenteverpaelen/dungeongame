// Which power templates are active for a character, in one canonical order: set bonuses (registry order, then
// threshold order) → legendary powers (registry order) → the one active Inscription → passives (slot order) →
// specialization nodes of the skills on the bar (primary, then slots). The order is part of the numeric contract (floating-point products are evaluated in
// it) and reproduces the pre-template code exactly for all 22 legendaries and 9 sets.

import { activeInscription } from './data/inscriptions';
import { LEGENDARIES, SETS } from './data/items';
import { SKILLS } from './data/skills';
import type { PowerEffect } from './powers';
import { savedNodeRanks } from './specialization';
import type { CharacterSave } from './types';

export interface PowerSource {
  kind: 'set' | 'legendary' | 'inscription' | 'passive' | 'node' | 'rune';
  /** set:<id>:<count>, legendary id, inscription:<id>, passive id, <skill>:<node>, or <skill>:rune:<rune>. */
  id: string;
  /** Value for `{ roll }` amounts: the legendary's rolled value (Cube: maximum), a node's rank, otherwise 1. */
  roll: number;
  effects: readonly PowerEffect[];
}

/** Set bonuses and legendary powers from equipped / Cube-equipped items (DerivedStats.powers / .sets). */
export function itemPowerSources(powers: Readonly<Record<string, number>>, sets: Readonly<Record<string, number>>): PowerSource[] {
  const out: PowerSource[] = [];
  for (const set of Object.values(SETS)) {
    const n = sets[set.id] ?? 0;
    if (!n) continue;
    for (const b of set.bonuses) if (n >= b.count && b.effects?.length) out.push({ kind: 'set', id: `set:${set.id}:${b.count}`, roll: 1, effects: b.effects });
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
