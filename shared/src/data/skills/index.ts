// Skill registry: the per-class data files composed into one SKILLS record (registry order = warrior, ranger,
// mage, each in file order), plus the helpers every consumer uses. Import from 'shared/src/data/skills'.

import type { ClassId } from '../../types';
import type { NodeDef, SkillDef, SkillMods, SkillTag, TagQuery } from './types';
import { NUMERIC_MOD_KEYS, TAG_ALIASES } from './types';
import { WARRIOR_SKILLS } from './warrior';
import { RANGER_SKILLS } from './ranger';
import { MAGE_SKILLS } from './mage';

export * from './types';
export { WARRIOR_FX } from './warrior';

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(
  [...WARRIOR_SKILLS, ...RANGER_SKILLS, ...MAGE_SKILLS].map((s) => [s.id, s]),
);

export function skillsForClass(classId: ClassId): SkillDef[] {
  return Object.values(SKILLS).filter((s) => s.classId === classId).sort((a, b) => a.unlock - b.unlock);
}

/** Character level at which rune `runeIndex` of `skill` unlocks (authored per rune; never below the skill itself). */
export function runeUnlockLevel(skill: SkillDef, runeIndex: number): number {
  return Math.max(skill.unlock, skill.runes[runeIndex]?.unlock ?? Infinity);
}

/**
 * Effective tags of a skill with an equipped rune: the kind, the element after the rune's conversion, Spender for
 * Channel skills (they drain resource), Cooldown for skills with a cooldown, the authored mechanic tags and the rune's
 * tags (ITEMS-SHARED.md §1.2). Item conversions do not re-tag: tags are resolved before item powers apply.
 */
export function skillTags(skill: SkillDef, runeId?: string | null): Set<SkillTag> {
  const rune = runeId ? skill.runes.find((r) => r.id === runeId) : undefined;
  const out = new Set<SkillTag>([skill.kind, rune?.mods.element ?? skill.element, ...(skill.tags ?? []), ...(rune?.tags ?? []), ...(rune?.addTags ?? [])]);
  for (const t of rune?.removeTags ?? []) out.delete(t);
  for (const t of [...out]) { const a = TAG_ALIASES[t]; if (a) out.add(a); }
  return out;
}

export function matchesTags(tags: ReadonlySet<SkillTag>, q: TagQuery): boolean {
  if (q.anyOf?.length && !q.anyOf.some((t) => tags.has(t))) return false;
  if (q.allOf && !q.allOf.every((t) => tags.has(t))) return false;
  if (q.noneOf && q.noneOf.some((t) => tags.has(t))) return false;
  return true;
}

/** Add `m` into `out` in place: numbers and vars are summed, the element is replaced, flags are appended. */
function addMods(out: SkillMods, m: SkillMods) {
  for (const k of NUMERIC_MOD_KEYS) {
    if (m[k] !== undefined) out[k] = (out[k] ?? 0) + (m[k] as number);
  }
  if (m.element) out.element = m.element;
  if (m.flags) out.flags!.push(...m.flags);
  if (m.vars) {
    const v = (out.vars = { ...(out.vars ?? {}) });
    for (const [k, n] of Object.entries(m.vars)) v[k] = (v[k] ?? 0) + n;
  }
}

/** Saved specialization ranks of one skill: nodeId -> rank (absent = 0). */
export type NodeRanks = Record<string, number>;

/**
 * Merge rune + purchased tiers + specialization ranks into one mods object (legendary/set/passive mods are merged
 * by the server). Unknown nodes are ignored and ranks are clamped to each node's maxRank.
 */
export function collectSkillMods(skill: SkillDef, runeId: string | null | undefined, tiers: number, nodes?: NodeRanks | null): SkillMods {
  const out: SkillMods = { flags: [] };
  const rune = skill.runes.find((r) => r.id === runeId);
  if (rune) addMods(out, rune.mods);
  for (let i = 0; i < Math.min(tiers, skill.tiers.length); i++) addMods(out, skill.tiers[i].mods);
  if (nodes) for (const node of skill.nodes ?? []) {
    const rank = Math.min(node.maxRank, node.ranks.length, Math.max(0, Math.floor(nodes[node.id] ?? 0)));
    for (let r = 0; r < rank; r++) addMods(out, node.ranks[r]);
  }
  return out;
}

export function mergeMods(a: SkillMods, b: SkillMods): SkillMods {
  const out: SkillMods = { ...a, flags: [...(a.flags ?? [])] };
  addMods(out, b);
  return out;
}

/** A named behaviour parameter (SkillMods.vars), 0 when absent. */
export function modVar(m: SkillMods, name: string): number {
  return m.vars?.[name] ?? 0;
}

/** Cumulative modifiers of `node` at `rank` (0 = nothing). */
export function nodeModsAt(node: NodeDef, rank: number): SkillMods {
  const out: SkillMods = { flags: [] };
  for (let r = 0; r < Math.min(rank, node.ranks.length); r++) addMods(out, node.ranks[r]);
  return out;
}

/** Placeholders a node text may use (validated by contentValidation). */
export const NODE_PLACEHOLDER = /\{(var:[A-Za-z0-9_]+|dmg|radius|cost|cooldown|duration|projectiles|pierce|gen|maxSummons)\}/g;

/** Node text at `rank` (rank 0 previews rank 1). Numbers are shown as absolute values ("40" for cost -40). */
export function describeNode(node: NodeDef, rank: number): string {
  const m = nodeModsAt(node, Math.max(1, Math.min(rank, node.maxRank)));
  const num = (v: number | undefined) => { const a = Math.abs(v ?? 0); return String(Math.round(a * 10) / 10); };
  return node.text.replace(NODE_PLACEHOLDER, (_, key: string) =>
    key.startsWith('var:') ? num(m.vars?.[key.slice(4)]) : num(m[key as (typeof NUMERIC_MOD_KEYS)[number]]));
}

/** The same bonuses are applied by the server and shown in skill summaries. */
export function skillBuffBonuses(id: 'battle_rage' | 'magic_weapon', flags: ReadonlySet<string>): { dmg: number; chc?: number; chd?: number } {
  if (id === 'battle_rage') return {
    dmg: (flags.has('rageDmg') ? 25 : 10) + (flags.has('rageExtra') ? 5 : 0),
    chc: 3, chd: flags.has('rageChd') ? 25 : 0,
  };
  return { dmg: (flags.has('forceWeapon') ? 20 : 10) + (flags.has('weaponExtra') ? 5 : 0) };
}

/** Render rune/tier numbers; equipment-specific modifiers require the caller to supply them. */
export function describeSkill(skill: SkillDef, mods?: SkillMods): string {
  const m = mods ?? {};
  const coef = skill.coef * (1 + (m.dmg ?? 0) / 100);
  const buff = skill.id === 'battle_rage' || skill.id === 'magic_weapon'
    ? skillBuffBonuses(skill.id, new Set(m.flags ?? [])) : undefined;
  const element = m.element ?? skill.element;
  return skill.desc
    .replace('{coef}', `${Math.round(coef * 100)}%`)
    .replace('{element}', element[0].toUpperCase() + element.slice(1))
    .replace('{buffDamage}', `${buff?.dmg ?? 0}%`)
    .replace('{buffCritChance}', `${buff?.chc ?? 0}%`)
    .replace('{buffCritDamage}', buff?.chd ? ` and Critical Hit Damage by ${buff.chd}%` : '')
    .replace('{gen}', String(skill.gen + (m.gen ?? 0)))
    .replace('{cost}', String(Math.round(skill.cost * (1 + (m.cost ?? 0) / 100))))
    .replace('{duration}', String(+(skill.duration * (1 + (m.duration ?? 0) / 100)).toFixed(1)))
    .replace('{radius}', String(Math.round(skill.radius * (1 + (m.radius ?? 0) / 100))))
    .replace('{max}', String(skill.maxSummons + (m.maxSummons ?? 0)));
}
