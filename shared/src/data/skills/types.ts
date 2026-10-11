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
}

export interface RuneDef {
  id: string;
  name: string;
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
}

/** Rune i unlocks at skill.unlock + RUNE_UNLOCK_OFFSETS[i]. */
export const RUNE_UNLOCK_OFFSETS = [2, 5, 9];
/** Skill points needed for tier 1, 2, 3 (Task Bar Hero-style escalating tiers). */
export const TIER_COSTS = [2, 4, 6];
export const SKILL_SLOTS = 4;
