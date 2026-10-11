// Skill data model shared by client, server and tools. Diablo 3 structure (skills unlock by level, runes change
// behaviour) + Task Bar Hero-style purchasable tiers. Content lives in the per-class files next to this one.

import type { ClassId, Element } from '../../types';

export type SkillKind = 'primary' | 'spender' | 'channel' | 'cooldown' | 'buff' | 'summon';

export type AutoRule =
  | { when: 'always' }
  | { when: 'enemiesNear'; count: number; within: number }
  | { when: 'maintainBuff' }
  | { when: 'maintainSummon' }
  | { when: 'channel'; startAt: number; within: number };

/** Behaviour modifiers granted by runes, tiers, legendary powers and set bonuses. */
export interface SkillMods {
  dmg?: number;         // additive % to this skill's damage
  radius?: number;      // additive % to radius
  cost?: number;        // additive % to resource cost (negative = cheaper)
  cooldown?: number;    // additive % to cooldown (negative = faster)
  duration?: number;    // additive % to duration
  projectiles?: number; // extra projectiles
  pierce?: number;      // extra pierce chance (percentage points)
  element?: Element;    // converts the skill's element
  gen?: number;         // extra resource generated per cast/hit
  maxSummons?: number;  // extra concurrent summons
  flags?: string[];     // behaviour flags interpreted by the server simulation
  /** Named numeric behaviour parameters, additive across sources (e.g. vars.markPct). Read by behaviour code. */
  vars?: Record<string, number>;
}

export interface RuneDef {
  id: string;
  name: string;
  /** Character level at which this rune can be equipped (absolute, data-driven; >= the skill's unlock). */
  unlock: number;
  desc: string;
  mods: SkillMods;
}

export interface TierDef {
  name: string;
  desc: string;
  mods: SkillMods;
}

export interface SkillDef {
  id: string;
  classId: ClassId;
  name: string;
  kind: SkillKind;
  unlock: number;
  element: Element;
  /** Weapon-damage multiplier per hit (1.5 = 150% weapon damage). DoTs: total over duration. */
  coef: number;
  cost: number;
  /** Resource generated per hit (primaries) or per cast. */
  gen: number;
  cooldown: number; // seconds
  range: number;    // targeting / acquisition range
  radius: number;
  duration: number; // seconds (buffs, summons, ground effects)
  maxSummons: number;
  auto: AutoRule;
  desc: string;
  icon: { glyph: string; color: number };
  runes: RuneDef[];
  tiers: TierDef[];
  /** Specialization tree (Last Epoch-style), bought with specialization points. Absent = no tree yet. */
  nodes?: NodeDef[];
}

/** One specialization node. Ranks are bought one at a time; ranks[i] is the increment granted by rank i + 1. */
export interface NodeDef {
  /** Unique within the skill; persisted in saves (skills.nodes[skillId][nodeId] = rank), so never rename a shipped id. */
  id: string;
  name: string;
  /**
   * Player text. Placeholders resolve to the cumulative value at the shown rank (absolute numbers):
   * {dmg} {radius} {cost} {cooldown} {duration} {projectiles} {pierce} {gen} {maxSummons} and {var:name}.
   */
  text: string;
  /** 1..MAX_NODE_RANK; ranks.length must equal maxRank. */
  maxRank: number;
  ranks: SkillMods[];
  /** Nodes of the same skill that need at least `rank` ranks before this node's first rank. */
  requires?: { node: string; rank: number }[];
  /** Character level for the first rank; defaults to the skill's unlock. */
  unlock?: number;
  /** Cell in the tree page: col 0..NODE_GRID.cols-1 (left → right), row 0..NODE_GRID.rows-1 (top → bottom). */
  pos: { col: number; row: number };
}

/** Most runes a skill may have (D3: five runes per skill; owner chose five for M1). */
export const MAX_RUNES = 5;
/** Skill points needed for tier 1, 2, 3 (Task Bar Hero-style escalating tiers). */
export const TIER_COSTS = [2, 4, 6];
export const SKILL_SLOTS = 4;
/** Specialization tree limits (owner M1: six nodes per skill, ranks 1-3; the page has room for a 3 × 3 grid). */
export const MAX_NODES = 9;
export const MAX_NODE_RANK = 3;
export const NODE_GRID = { cols: 3, rows: 3 } as const;
/** Numeric SkillMods fields: additive when sources are merged. */
export const NUMERIC_MOD_KEYS = ['dmg', 'radius', 'cost', 'cooldown', 'duration', 'projectiles', 'pierce', 'gen', 'maxSummons'] as const;
