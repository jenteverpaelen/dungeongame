// Wire types of the build tools' damage sheet (docs/rework/depth/BUILD-TOOLS.md T1 exact tooltips, T2 breakdown sheet).
// The server computes every number with the combat code itself (server/src/sim/breakdown.ts); the client only shows it.

import type { Element } from './types';
import type { SkillTag } from './data/skills';

/** One contributor to a bucket: where it comes from (`src` label or a fixed key) and its value. */
export interface SheetPart {
  /** `<kind>:<id>` power source (shared/src/powerSourceNames.ts), or rune:/tier:/node:/gear:/buff: for skill-own parts. */
  src: string;
  /** Display name when the client cannot derive it (buffs, sheet totals). */
  name?: string;
  /** Additive percent (skill / generic buckets) or a multiplier (own / hit / target factors). */
  value: number;
  /** The template text of the effect it comes from (describeEffect), when there is one. */
  text?: string;
}

/** A conditional term that can change this skill's damage, and whether it holds right now. */
export interface SheetCond {
  src: string;
  text: string;
  /** own = own bucket (cast-time condition), hit = per hit, target = vulnerability (depends on the enemy). */
  bucket: 'own' | 'hit' | 'target';
  pct: number;
  /** Holds now (own / hit), or for target terms: holds against the trash / elite reference target. */
  holds: boolean;
}

export interface SkillSheet {
  id: string;
  /** Final tags (runes, tag grants and aliases included): what tag-keyed items see. */
  tags: SkillTag[];
  element: Element;
  /** Final numbers as the server uses them. */
  coef: number; cost: number; costPerSecond: boolean; gen: number; cooldownMs: number; durationMs: number; radius: number;
  maxSummons: number; extraProjectiles: number; charges: number;
  /** Average weapon damage per hit (before any multiplier). */
  weaponAvg: number;
  /** The multipliers of one hit, in the order the combat code applies them. */
  factors: { coef: number; mainStat: number; skill: number; element: number; generic: number; own: number; hit: number; crit: number };
  parts: { skill: SheetPart[]; generic: SheetPart[]; own: SheetPart[]; hit: SheetPart[] };
  /** Crit chance / damage (%) used by the expected value. */
  crit: { chance: number; damage: number };
  /** Expected damage of one hit of the skill's coefficient, crit-weighted, now (no target factors). */
  perHit: number;
  /** Against an elite / boss: the elite bonus. Target conditions (stunned, frozen …) are listed in `conds`. */
  eliteFactor: number;
  /** Folded stunned / frozen multipliers (incl. rune vulnerability), each with its sources. */
  vs: { stunned: number; frozen: number; parts: SheetPart[] };
  conds: SheetCond[];
}

export interface BuildSheet {
  skills: SkillSheet[];
  /** Server time of the computation (the client shows when the numbers were taken). */
  at: number;
  /** Live state that conditional terms read (so players see why a term holds). */
  state: { inTown: boolean; channeling: string | null; buffs: string[]; lifePct: number; resourcePct: number };
}
