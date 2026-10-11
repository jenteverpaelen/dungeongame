// Specialization nodes (Last Epoch-style tree per skill): point economy, purchase / refund validation and save
// normalisation. Shared by the server (authority, commands.ts) and the client (previews). The economy and its
// rationale are in docs/rework/depth/FOUNDATION.md §4.

import { MAX_LEVEL } from './constants';
import { SKILLS, type NodeDef, type NodeRanks, type SkillDef } from './data/skills';
import type { CharacterSave } from './types';

export type SpecPointSource = 'separate' | 'shared';
export interface SpecEconomy {
  /**
   * 'separate': a specialization pool derived from the level (never stored; no migration, cannot drift).
   * 'shared': node ranks are paid from the stored skill points that also buy tiers (refunds return them).
   */
  readonly source: SpecPointSource;
  /** Separate pool: points per level, counted from `fromLevel` (2 = one per level after the first). */
  readonly perLevel: number;
  readonly fromLevel: number;
  /** Most ranks one skill's tree may hold (Infinity = the whole tree). */
  readonly treeRankCap: number;
}

/**
 * THE switch for the point economy. Lead decision (d) after bible v2 (plan §3.6, ITEMS-SHARED.md §0): a separate pool,
 * 1 point per level from level 21 (50 at level 70) and at most 10 ranks per tree. The bar holds 5 skills (primary +
 * four slots) and 5 × 10 = 50, so every active tree fills exactly at level 70 while the choice stays inside each tree
 * (10 of its up to 18 ranks, prerequisites); while levelling (20 points at level 40) players pick which trees to deepen.
 * Re-tune after playtests. `source: 'shared'` would draw node ranks from the tier points instead. Changing the rule
 * later is safe for saves: normalizeSkillNodes clears trees that became illegal (points are derived, a free respec).
 */
export const SPEC_POINTS: SpecEconomy = { source: 'separate', perLevel: 1, fromLevel: 21, treeRankCap: 10 };
/** [P] Every node rank costs one point. */
export const NODE_RANK_COST = 1;
/**
 * Target size of a full tree in buyable ranks (class average over skills with trees, after `treeRankCap`). With 50
 * points at level 70 and 10-rank trees a player completes 50 / 10 = 5 trees: the five skills of one bar, never all of a
 * class's trees. Checked by shared/test/depthFoundation.test.ts for every class that ships trees.
 */
export const TREE_RANKS_TARGET = { min: 10, max: 10 } as const;

/** Separate-pool points at `level` (0 in shared mode: tiers and nodes then draw from `skillPoints`). */
export function specPointsForLevel(level: number, eco: SpecEconomy = SPEC_POINTS): number {
  if (eco.source === 'shared') return 0;
  return Math.max(0, Math.floor(level) - eco.fromLevel + 1) * eco.perLevel;
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

/** Ranks bought in one skill's tree (known nodes only, clamped). */
export function treeRanks(skill: SkillDef, ranks: NodeRanks): number {
  let n = 0;
  for (const node of skill.nodes ?? []) n += rankOf(ranks, node);
  return n;
}

/** Points spent on one skill's tree. */
export function treeSpent(skill: SkillDef, ranks: NodeRanks): number {
  return treeRanks(skill, ranks) * NODE_RANK_COST;
}

export function specPointsSpent(save: Pick<CharacterSave, 'classId' | 'skills'>): number {
  let n = 0;
  for (const [skillId, ranks] of Object.entries(save.skills.nodes ?? {})) {
    const skill = Object.hasOwn(SKILLS, skillId) ? SKILLS[skillId] : undefined;
    if (skill && skill.classId === save.classId && ranks && typeof ranks === 'object') n += treeSpent(skill, ranks);
  }
  return n;
}

/** Points available for node ranks now (shared mode: the unspent skill points). */
export function specPointsAvailable(save: Pick<CharacterSave, 'classId' | 'level' | 'skills' | 'skillPoints'>, eco: SpecEconomy = SPEC_POINTS): number {
  return eco.source === 'shared' ? save.skillPoints : specPointsForLevel(save.level, eco) - specPointsSpent(save);
}

/** Total ranks of a full tree, and what the cap lets one character buy of it. */
export function treeTotalRanks(skill: SkillDef): number {
  return (skill.nodes ?? []).reduce((n, node) => n + node.maxRank, 0);
}
export function treeBuyableRanks(skill: SkillDef, eco: SpecEconomy = SPEC_POINTS): number {
  return Math.min(treeTotalRanks(skill), eco.treeRankCap);
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

type NodeSave = Pick<CharacterSave, 'classId' | 'level' | 'skills' | 'skillPoints'>;

/** Why the next rank of `nodeId` cannot be bought, or null. Pure: never mutates the save. */
export function nodeBuyError(save: NodeSave, skillId: unknown, nodeId: unknown, eco: SpecEconomy = SPEC_POINTS): string | null {
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
  if (treeRanks(skill, ranks) >= eco.treeRankCap) return `This tree is full (at most ${eco.treeRankCap} ranks)`;
  if (specPointsAvailable(save, eco) < NODE_RANK_COST) return eco.source === 'shared' ? 'No skill points left' : 'No specialization points left';
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

/** Buy one rank (server authority). Returns an error or null; mutates only the node ranks (and skill points if shared). */
export function buySkillNode(save: CharacterSave, skillId: unknown, nodeId: unknown, eco: SpecEconomy = SPEC_POINTS): string | null {
  const err = nodeBuyError(save, skillId, nodeId, eco);
  if (err) return err;
  const all = (save.skills.nodes ??= {});
  const ranks = (all[skillId as string] = { ...savedNodeRanks(save, skillId as string) });
  ranks[nodeId as string] = rankOf(ranks, SKILLS[skillId as string].nodes!.find((n) => n.id === nodeId)!) + 1;
  if (eco.source === 'shared') save.skillPoints -= NODE_RANK_COST;
  return null;
}

/** Refund one rank. Returns an error or null. */
export function refundSkillNode(save: CharacterSave, skillId: unknown, nodeId: unknown, eco: SpecEconomy = SPEC_POINTS): string | null {
  const err = nodeRefundError(save, skillId, nodeId);
  if (err) return err;
  const id = skillId as string;
  const ranks = { ...savedNodeRanks(save, id) };
  const node = SKILLS[id].nodes!.find((n) => n.id === nodeId)!;
  const next = rankOf(ranks, node) - 1;
  if (next > 0) ranks[node.id] = next; else delete ranks[node.id];
  const all = (save.skills.nodes ??= {});
  if (Object.keys(ranks).length) all[id] = ranks; else delete all[id];
  if (eco.source === 'shared') save.skillPoints += NODE_RANK_COST;
  return null;
}

/** Points a stored allocation represents (every positive integer rank, known node or not) — for shared-mode refunds. */
function storedRanks(ranks: unknown): number {
  if (!ranks || typeof ranks !== 'object' || Array.isArray(ranks)) return 0;
  return Object.values(ranks as Record<string, unknown>).reduce<number>((n, r) => n + (Number.isInteger(r) && (r as number) > 0 ? (r as number) : 0), 0);
}

/** Remove the specialization of one skill (or every skill). Returns the points freed (refunded in shared mode). */
export function resetSkillNodes(save: CharacterSave, skillId?: string, eco: SpecEconomy = SPEC_POINTS): number {
  const all = save.skills.nodes ?? {};
  let freed = 0;
  for (const id of Object.keys(all)) {
    if (skillId !== undefined && id !== skillId) continue;
    const skill = Object.hasOwn(SKILLS, id) ? SKILLS[id] : undefined;
    freed += eco.source === 'shared' ? storedRanks(all[id]) * NODE_RANK_COST : skill && skill.classId === save.classId ? treeSpent(skill, all[id]) : 0;
    delete all[id];
  }
  save.skills.nodes = all;
  if (eco.source === 'shared') save.skillPoints += freed;
  return freed;
}

/** Is this one skill's saved allocation legal under the current data at `level`? */
export function legalTree(skill: SkillDef, ranks: unknown, level: number, eco: SpecEconomy = SPEC_POINTS): boolean {
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
  return treeRanks(skill, r) <= eco.treeRankCap;
}

/**
 * Save migration / repair (persistence.normalizeSave): every skill's allocation must be legal under the current data
 * (known skill of this class, known nodes, ranks within 1..maxRank, levels, prerequisites and the tree cap met),
 * otherwise that skill's tree is cleared. Separate pool: if the total still exceeds the points for the level, every
 * tree is cleared (points are derived, so this is a free respec). Shared pool: cleared ranks are refunded to skill
 * points. Idempotent.
 */
export function normalizeSkillNodes(save: CharacterSave, eco: SpecEconomy = SPEC_POINTS): void {
  const raw = save.skills.nodes as unknown;
  const out: Record<string, NodeRanks> = {};
  let refund = 0;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [id, ranks] of Object.entries(raw as Record<string, unknown>)) {
      const skill = Object.hasOwn(SKILLS, id) ? SKILLS[id] : undefined;
      if (!skill || skill.classId !== save.classId || !legalTree(skill, ranks, Math.min(save.level, MAX_LEVEL), eco)) { refund += storedRanks(ranks); continue; }
      if (Object.keys(ranks as NodeRanks).length) out[id] = { ...(ranks as NodeRanks) };
    }
  }
  save.skills.nodes = out;
  if (eco.source === 'shared') { save.skillPoints += refund * NODE_RANK_COST; return; }
  if (specPointsSpent(save) > specPointsForLevel(save.level, eco)) save.skills.nodes = {};
}
