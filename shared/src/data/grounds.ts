// Data-driven ground effects (engine wave 2): a placed area that ticks damage / statuses, hits enemies the moment
// they cross into it, applies a status after an enemy has stayed inside long enough, pulls, and can follow its owner.
// Powers place them by id (proc action `ground: { def }`); the server interprets them in server/src/sim/groundFx.ts.
// Shipped data is empty on purpose: content (bible v2) authors entries; tests install fixtures with registerGroundDefs.
// Recipes: docs/rework/depth/FOUNDATION.md §11.

import type { StatusSpec } from '../powers';
import type { Element } from '../types';
import type { SkillTag } from './skills';
import { WARRIOR_GROUNDS } from './groundsWarrior';
import { MAGE_GROUNDS } from './groundsMage';

export interface GroundDef {
  id: string;
  /** Player-facing name (tooltips). */
  name: string;
  /** Skill the ground belongs to: its tags are inherited (+ 'ground' + `tags`) and its damage is attributed to it. */
  owner?: string;
  tags?: SkillTag[];
  /** circle: radius; line: a segment of `lineLength` along the placer's facing, `radius` = half width. */
  shape?: 'circle' | 'line';
  radius: number;
  lineLength?: number;
  durationMs: number;
  /** Damage element (default physical). */
  element?: Element;
  /** Every `everyMs`: `coef` × weapon damage and / or a status to every enemy inside. */
  tick?: { everyMs: number; coef?: number; status?: StatusSpec };
  /**
   * When an enemy enters (or is inside when placed): `coef` × weapon damage and / or a status. Once per enemy, or again
   * after it left and `againAfterMs` passed since its last trigger (a fault line "once per 3 s each").
   */
  onEnter?: { coef?: number; status?: StatusSpec; againAfterMs?: number };
  /** After an enemy has been inside for `ms` (cumulative): a status, once per enemy. */
  insideFor?: { ms: number; status: StatusSpec };
  /** Drag enemies inside toward the centre, units per second. */
  pull?: { speed: number };
  /** Moves with the player who placed it. */
  follow?: 'owner';
  /** The oldest of this owner's grounds of this id is removed when another would exceed the count. */
  maxPerOwner?: number;
  /** Client visual id for the placement \`aoe\` event (e.g. 'molten'); absent = no event (content supplies art). */
  visual?: string;
}

/** Shipped grounds (class content files, appended per class). Tests install fixtures with registerGroundDefs. */
export const GROUND_DEFS: Record<string, GroundDef> = Object.fromEntries([...WARRIOR_GROUNDS, ...MAGE_GROUNDS].map((d) => [d.id, d]));

/** Install ground definitions (content modules and test fixtures). Returns a function that removes them again. */
export function registerGroundDefs(defs: readonly GroundDef[]): () => void {
  for (const d of defs) GROUND_DEFS[d.id] = d;
  return () => { for (const d of defs) if (GROUND_DEFS[d.id] === d) delete GROUND_DEFS[d.id]; };
}
