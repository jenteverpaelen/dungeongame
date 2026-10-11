// Which power templates are active for a character, in one canonical order: set bonuses (registry order, then
// threshold order) → legendary powers (registry order) → passives (slot order) → specialization nodes of the skills on
// the bar (primary, then slots). The order is part of the numeric contract (floating-point products are evaluated in
// it) and reproduces the pre-template code exactly for all 22 legendaries and 9 sets.

import { LEGENDARIES, SETS } from './data/items';
import { SKILLS } from './data/skills';
import type { PowerEffect } from './powers';
import { savedNodeRanks } from './specialization';
import type { CharacterSave } from './types';

export interface PowerSource {
  kind: 'set' | 'legendary' | 'passive' | 'node';
  /** set:<id>:<count>, legendary id, passive id, or <skill>:<node>. */
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

/** Specialization-node effects of the skills currently on the bar (unlocked primary and slotted skills). */
export function nodePowerSources(save: Pick<CharacterSave, 'classId' | 'level' | 'skills'>): PowerSource[] {
  const out: PowerSource[] = [];
  const bar = [save.skills.primary, ...save.skills.slots];
  const seen = new Set<string>();
  for (const id of bar) {
    if (!id || seen.has(id) || !Object.hasOwn(SKILLS, id)) continue;
    seen.add(id);
    const skill = SKILLS[id];
    if (skill.classId !== save.classId || skill.unlock > save.level || !skill.nodes) continue;
    const ranks = savedNodeRanks(save, id);
    for (const node of skill.nodes) {
      const r = Math.min(node.maxRank, Math.max(0, Math.floor(ranks[node.id] ?? 0)));
      if (r > 0 && node.effects?.length) out.push({ kind: 'node', id: `${id}:${node.id}`, roll: r, effects: node.effects });
    }
  }
  return out;
}

/** Every active source. `passives` comes from shared/src/passives.ts (kept separate to avoid an import cycle). */
export function allPowerSources(save: Pick<CharacterSave, 'classId' | 'level' | 'skills'>, powers: Readonly<Record<string, number>>,
  sets: Readonly<Record<string, number>>, passives: readonly PowerSource[] = []): PowerSource[] {
  return [...itemPowerSources(powers, sets), ...passives, ...nodePowerSources(save)];
}
