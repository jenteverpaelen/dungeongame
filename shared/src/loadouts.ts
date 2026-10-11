// Skill setups (build tools T4 loadouts, T5 build codes; docs/rework/depth/BUILD-TOOLS.md): the skill part of a build —
// primary, slots, runes, tiers, specialization ranks, passives and the auto-cast settings — captured from a save and
// applied back through the same shared rules as the single skill commands, so nothing a character may not have can be
// applied. Gear is never part of it. Respec stays free: applying refunds every tier and node first.

import { buySkillTier, resetSkillPoints, setPrimarySkill, setSkillRune, setSkillSlot } from './character';
import { SKILLS, SKILL_SLOTS, skillsForClass } from './data/skills';
import { normalizeAutoCast, type AutoCastMode } from './autoCast';
import { isAutoCastRule, type AutoCastRule } from './autoCastRules';
import { isTargetPriority, type TargetPriority } from './targetPriority';
import { PASSIVE_SLOT_LEVELS, setPassive } from './passives';
import { buySkillNode, savedNodeRanks } from './specialization';
import type { CharacterSave, ClassId } from './types';

/** [P] Five named loadouts per character (D4's Armory has five [SN], BUILD-TOOLS.md T4). */
export const LOADOUT_SLOTS = 5;
export const LOADOUT_NAME_MAX = 24;

export interface SkillSetup {
  primary: string;
  slots: (string | null)[];
  runes: Record<string, string | null>;
  tiers: Record<string, number>;
  nodes: Record<string, Record<string, number>>;
  passives: (string | null)[];
  autoCast?: AutoCastMode[];
  targetPriority?: TargetPriority;
  autoRules?: (AutoCastRule | null)[];
}
export interface SavedLoadout extends SkillSetup { name: string }
export interface LoadoutState { revision: 1; sets: (SavedLoadout | null)[] }

/** The current skill setup of a save (a deep copy). */
export function captureSetup(save: CharacterSave): SkillSetup {
  const nodes: Record<string, Record<string, number>> = {};
  for (const s of skillsForClass(save.classId)) { const r = savedNodeRanks(save, s.id); if (Object.keys(r).length) nodes[s.id] = { ...r }; }
  return {
    primary: save.skills.primary, slots: [...save.skills.slots],
    runes: Object.fromEntries(Object.entries(save.skills.runes).filter(([id, r]) => SKILLS[id]?.classId === save.classId && r)),
    tiers: Object.fromEntries(Object.entries(save.skills.tiers).filter(([id, t]) => SKILLS[id]?.classId === save.classId && t > 0)),
    nodes, passives: save.passives?.slots ? [...save.passives.slots] : PASSIVE_SLOT_LEVELS.map(() => null),
    autoCast: save.skills.autoCast ? normalizeAutoCast(save.skills.autoCast) : undefined, targetPriority: save.skills.targetPriority,
    autoRules: save.skills.autoRules?.map((r) => (r ? { ...r } : null)),
  };
}

/**
 * Apply a setup to `save` in place through the shared rules (free respec first). Parts the character may not use —
 * locked skills or runes, tiers beyond its skill points, nodes beyond its specialization points or requirements,
 * locked or duplicate passives — are skipped and reported; the rest applies. Returns the skipped parts.
 */
export function applySetup(save: CharacterSave, setup: SkillSetup): string[] {
  const skipped: string[] = [];
  const name = (id: string) => SKILLS[id]?.name ?? id;
  resetSkillPoints(save);
  if (setup.primary !== save.skills.primary) { const e = setPrimarySkill(save, setup.primary); if (e) skipped.push(`primary ${name(setup.primary)}: ${e}`); }
  for (let i = 0; i < SKILL_SLOTS; i++) setSkillSlot(save, i, null);
  for (let i = 0; i < SKILL_SLOTS; i++) {
    const id = setup.slots[i] ?? null;
    if (!id) continue;
    const e = setSkillSlot(save, i, id);
    if (e) skipped.push(`slot ${i + 1} ${name(id)}: ${e}`);
  }
  for (const s of skillsForClass(save.classId)) {
    const want = setup.runes[s.id] ?? null;
    if ((save.skills.runes[s.id] ?? null) === want) continue;
    const e = setSkillRune(save, s.id, want);
    if (e) { skipped.push(`${s.name} rune: ${e}`); setSkillRune(save, s.id, null); }
  }
  for (const [id, t] of Object.entries(setup.tiers)) for (let k = 0; k < t; k++) {
    const e = buySkillTier(save, id);
    if (e) { skipped.push(`${name(id)} tier ${k + 1}: ${e}`); break; }
  }
  // Node ranks in passes, so a node is bought after the ranks it requires (whatever order the setup lists them in).
  const want = Object.entries(setup.nodes).flatMap(([skill, ranks]) => Object.entries(ranks).map(([node, rank]) => ({ skill, node, rank: Math.max(0, Math.floor(rank)) })));
  for (let progress = true; progress;) {
    progress = false;
    for (const w of want) while ((save.skills.nodes?.[w.skill]?.[w.node] ?? 0) < w.rank && !buySkillNode(save, w.skill, w.node)) progress = true;
  }
  for (const w of want) {
    const have = save.skills.nodes?.[w.skill]?.[w.node] ?? 0;
    if (have < w.rank) skipped.push(`${name(w.skill)}: ${SKILLS[w.skill]?.nodes?.find((n) => n.id === w.node)?.name ?? w.node} ${have}/${w.rank} (${buySkillNode(structuredClone(save), w.skill, w.node) ?? 'not available'})`);
  }
  const passives = PASSIVE_SLOT_LEVELS.map((_, i) => setup.passives[i] ?? null);
  for (let i = 0; i < PASSIVE_SLOT_LEVELS.length; i++) setPassive(save, i, null);
  passives.forEach((id, i) => { if (!id) return; const e = setPassive(save, i, id); if (e) skipped.push(`passive slot ${i + 1}: ${e}`); });
  if (setup.autoCast) save.skills.autoCast = normalizeAutoCast(setup.autoCast);
  if (setup.targetPriority !== undefined && isTargetPriority(setup.targetPriority)) save.skills.targetPriority = setup.targetPriority;
  if (setup.autoRules) save.skills.autoRules = Array.from({ length: SKILL_SLOTS }, (_, i) => {
    const r = setup.autoRules![i] ?? null;
    return r && isAutoCastRule(r, save.classId) && r.requireBuff !== save.skills.slots[i] ? { ...r } : null;
  });
  return skipped;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const idList = (v: unknown, n: number) => Array.isArray(v) && v.length <= n && v.every((x) => x === null || typeof x === 'string');

/** A loadout as stored (shape and size; content is re-validated by applySetup when used). */
export function validLoadout(v: unknown, classId: ClassId): v is SavedLoadout {
  if (!isRecord(v)) return false;
  if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > LOADOUT_NAME_MAX) return false;
  if (typeof v.primary !== 'string' || SKILLS[v.primary]?.classId !== classId) return false;
  if (!idList(v.slots, SKILL_SLOTS) || !idList(v.passives, PASSIVE_SLOT_LEVELS.length)) return false;
  if (!isRecord(v.runes) || !Object.values(v.runes).every((r) => r === null || typeof r === 'string')) return false;
  if (!isRecord(v.tiers) || !Object.values(v.tiers).every((t) => Number.isInteger(t) && (t as number) >= 0 && (t as number) <= 3)) return false;
  if (!isRecord(v.nodes) || !Object.values(v.nodes).every((r) => isRecord(r) && Object.values(r).every((x) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 5))) return false;
  return JSON.stringify(v).length <= 4096;
}

export function validLoadoutState(v: unknown, classId: ClassId): v is LoadoutState {
  return isRecord(v) && v.revision === 1 && Array.isArray(v.sets) && v.sets.length === LOADOUT_SLOTS && v.sets.every((s) => s === null || validLoadout(s, classId));
}

/** Load-time repair: an absent state stays absent; a malformed one keeps only its valid loadouts. */
export function normalizeLoadouts(save: CharacterSave) {
  const v = save.loadouts as unknown;
  if (v === undefined) return;
  const sets = isRecord(v) && Array.isArray(v.sets) ? v.sets : [];
  save.loadouts = { revision: 1, sets: Array.from({ length: LOADOUT_SLOTS }, (_, i) => (validLoadout(sets[i], save.classId) ? sets[i] as SavedLoadout : null)) };
}

/** Save the current setup into loadout `index` under `name`. */
export function saveLoadout(save: CharacterSave, index: number, name: unknown): string | null {
  if (!Number.isInteger(index) || index < 0 || index >= LOADOUT_SLOTS) return 'Choose a loadout slot';
  const n = typeof name === 'string' && name.trim() ? name.trim().slice(0, LOADOUT_NAME_MAX) : `Loadout ${index + 1}`;
  const state = save.loadouts ?? { revision: 1 as const, sets: Array.from({ length: LOADOUT_SLOTS }, () => null) };
  state.sets[index] = { name: n, ...captureSetup(save) };
  save.loadouts = state;
  return null;
}
