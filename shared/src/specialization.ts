// Specialization nodes (Last Epoch-style tree per skill): point economy, purchase / refund validation and save
// normalisation. Shared by the server (authority, commands.ts) and the client (previews). The economy and its
// rationale are in docs/rework/depth/FOUNDATION.md §4.

import { MAX_LEVEL } from './constants';
import { SKILLS, type NodeDef, type NodeRanks, type SkillDef } from './data/skills';
import type { CharacterSave } from './types';

/**
 * [P] One specialization point per level after the first, mirroring skill points (`skillPointsForLevel`): 69 at
 * level 70. Derived from the level (never stored), so it needs no migration and cannot drift; free respec stays.
 */
export const SPEC_POINTS_PER_LEVEL = 1;
/** [P] Every node rank costs one specialization point. */
export const NODE_RANK_COST = 1;
/**
 * [P] Target size of a full tree in ranks (class average over skills with trees). With 69 points at level 70 a player
 * can complete 69/17 = 4.1 to 69/14 = 4.9 trees: about the five skills of one bar (primary + four slots), never all of
 * a class's trees (12 in M1, 20 in M2). Checked by shared/test/depthFoundation.test.ts once a class ships trees.
 */
export const TREE_RANKS_TARGET = { min: 14, max: 17 } as const;

export function specPointsForLevel(level: number): number {
  return Math.max(0, Math.floor(level) - 1) * SPEC_POINTS_PER_LEVEL;
}

/** Saved ranks of one skill (never undefined; a fresh object is not attached to the save). */
export function savedNodeRanks(save: Pick<CharacterSave, 'skills'>, skillId: string): NodeRanks {
  const all = save.skills.nodes;
  return all && Object.hasOwn(all, skillId) && all[skillId] && typeof all[skillId] === 'object' ? all[skillId] : {};
}

function rankOf(ranks: NodeRanks, node: NodeDef): number {
  const r = Object.hasOwn(ranks, node.id) ? ranks[node.id] : 0;
  return Number.isInteger(r) && r > 0 ? Math.min(r, node.maxRank) : 0;
}

/** Points spent on one skill's tree (known nodes only, ranks clamped). */
export function treeSpent(skill: SkillDef, ranks: NodeRanks): number {
  let n = 0;
  for (const node of skill.nodes ?? []) n += rankOf(ranks, node) * NODE_RANK_COST;
  return n;
}

export function specPointsSpent(save: Pick<CharacterSave, 'classId' | 'skills'>): number {
  let n = 0;
  for (const [skillId, ranks] of Object.entries(save.skills.nodes ?? {})) {
    const skill = Object.hasOwn(SKILLS, skillId) ? SKILLS[skillId] : undefined;
    if (skill && skill.classId === save.classId && ranks && typeof ranks === 'object') n += treeSpent(skill, ranks);
  }
  return n;
}

export function specPointsAvailable(save: Pick<CharacterSave, 'classId' | 'level' | 'skills'>): number {
  return specPointsForLevel(save.level) - specPointsSpent(save);
}

/** Total ranks of a full tree. */
export function treeTotalRanks(skill: SkillDef): number {
  return (skill.nodes ?? []).reduce((n, node) => n + node.maxRank, 0);
}

/** Level needed for a node's first rank. */
export function nodeUnlockLevel(skill: SkillDef, node: NodeDef): number {
  return Math.max(skill.unlock, node.unlock ?? skill.unlock);
}

function findSkill(save: Pick<CharacterSave, 'classId'>, skillId: unknown): SkillDef | null {
  if (typeof skillId !== 'string' || !Object.hasOwn(SKILLS, skillId)) return null;
  const s = SKILLS[skillId];
  return s.classId === save.classId ? s : null;
}

/** Why the next rank of `nodeId` cannot be bought, or null. Pure: never mutates the save. */
export function nodeBuyError(save: Pick<CharacterSave, 'classId' | 'level' | 'skills'>, skillId: unknown, nodeId: unknown): string | null {
  const skill = findSkill(save, skillId);
  if (!skill) return 'Unknown skill';
  const node = typeof nodeId === 'string' ? skill.nodes?.find((n) => n.id === nodeId) : undefined;
  if (!node) return 'Unknown specialization';
  if (skill.unlock > save.level) return `${skill.name} unlocks at level ${skill.unlock}`;
  const ranks = savedNodeRanks(save, skill.id);
  const cur = rankOf(ranks, node);
  if (cur >= node.maxRank) return 'Already at the highest rank';
  const need = nodeUnlockLevel(skill, node);
  if (save.level < need) return `${node.name} unlocks at level ${need}`;
  for (const req of node.requires ?? []) {
    const other = skill.nodes?.find((n) => n.id === req.node);
    if (!other || rankOf(ranks, other) < req.rank) return `Requires ${other?.name ?? req.node} rank ${req.rank}`;
  }
  if (specPointsAvailable(save) < NODE_RANK_COST) return 'No specialization points left';
  return null;
}

/** Why one rank of `nodeId` cannot be refunded (another bought node depends on it), or null. */
export function nodeRefundError(save: Pick<CharacterSave, 'classId' | 'skills'>, skillId: unknown, nodeId: unknown): string | null {
  const skill = findSkill(save, skillId);
  if (!skill) return 'Unknown skill';
  const node = typeof nodeId === 'string' ? skill.nodes?.find((n) => n.id === nodeId) : undefined;
  if (!node) return 'Unknown specialization';
  const ranks = savedNodeRanks(save, skill.id);
  const cur = rankOf(ranks, node);
  if (cur <= 0) return 'No rank to refund';
  for (const other of skill.nodes ?? []) {
    if (other === node || rankOf(ranks, other) <= 0) continue;
    const req = other.requires?.find((r) => r.node === node.id);
    if (req && cur - 1 < req.rank) return `${other.name} needs ${node.name} rank ${req.rank}`;
  }
  return null;
}

/** Buy one rank (server authority). Returns an error or null; mutates only `save.skills.nodes`. */
export function buySkillNode(save: CharacterSave, skillId: unknown, nodeId: unknown): string | null {
  const err = nodeBuyError(save, skillId, nodeId);
  if (err) return err;
  const all = (save.skills.nodes ??= {});
  const ranks = (all[skillId as string] = { ...savedNodeRanks(save, skillId as string) });
  ranks[nodeId as string] = (rankOf(ranks, SKILLS[skillId as string].nodes!.find((n) => n.id === nodeId)!)) + 1;
  return null;
}

/** Refund one rank. Returns an error or null. */
export function refundSkillNode(save: CharacterSave, skillId: unknown, nodeId: unknown): string | null {
  const err = nodeRefundError(save, skillId, nodeId);
  if (err) return err;
  const id = skillId as string;
  const ranks = { ...savedNodeRanks(save, id) };
  const node = SKILLS[id].nodes!.find((n) => n.id === nodeId)!;
  const next = rankOf(ranks, node) - 1;
  if (next > 0) ranks[node.id] = next; else delete ranks[node.id];
  const all = (save.skills.nodes ??= {});
  if (Object.keys(ranks).length) all[id] = ranks; else delete all[id];
  return null;
}

/** Remove the specialization of one skill (or every skill). Returns the number of points freed. */
export function resetSkillNodes(save: CharacterSave, skillId?: string): number {
  const all = save.skills.nodes ?? {};
  let freed = 0;
  for (const id of Object.keys(all)) {
    if (skillId !== undefined && id !== skillId) continue;
    const skill = Object.hasOwn(SKILLS, id) ? SKILLS[id] : undefined;
    if (skill && skill.classId === save.classId) freed += treeSpent(skill, all[id]);
    delete all[id];
  }
  save.skills.nodes = all;
  return freed;
}

/** Is this one skill's saved allocation legal under the current data at `level`? */
export function legalTree(skill: SkillDef, ranks: unknown, level: number): boolean {
  if (!ranks || typeof ranks !== 'object' || Array.isArray(ranks)) return false;
  const r = ranks as NodeRanks;
  for (const [id, rank] of Object.entries(r)) {
    const node = skill.nodes?.find((n) => n.id === id);
    if (!node || !Number.isInteger(rank) || rank < 1 || rank > node.maxRank) return false;
    if (level < nodeUnlockLevel(skill, node) || level < skill.unlock) return false;
    for (const req of node.requires ?? []) {
      const other = skill.nodes?.find((n) => n.id === req.node);
      if (!other || rankOf(r, other) < req.rank) return false;
    }
  }
  return true;
}

/**
 * Save migration / repair (persistence.normalizeSave): every skill's allocation must be legal under the current data
 * (known skill of this class, known nodes, ranks within 1..maxRank, levels and prerequisites met), otherwise that skill's
 * tree is cleared; if the total still exceeds the derived points, every tree is cleared. Points are derived from the
 * level, so clearing never loses currency: it is a free respec. Idempotent.
 */
export function normalizeSkillNodes(save: CharacterSave): void {
  const raw = save.skills.nodes as unknown;
  const out: Record<string, NodeRanks> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [id, ranks] of Object.entries(raw as Record<string, unknown>)) {
      const skill = Object.hasOwn(SKILLS, id) ? SKILLS[id] : undefined;
      if (!skill || skill.classId !== save.classId || !legalTree(skill, ranks, Math.min(save.level, MAX_LEVEL))) continue;
      if (Object.keys(ranks as NodeRanks).length) out[id] = { ...(ranks as NodeRanks) };
    }
  }
  save.skills.nodes = out;
  if (specPointsSpent(save) > specPointsForLevel(save.level)) save.skills.nodes = {};
}
