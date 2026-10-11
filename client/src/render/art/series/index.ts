// Weapon series (docs/rework/gear/ART-DIRECTION.md): one maker per level band, each with its own silhouette language,
// palette and motif; rarity adds craftsmanship inside a series; legendaries are bespoke one-offs; Kindled / Fabled are
// small grade accents. The gear rig's interface (weaponDrawing.ts, DESIGN-V2 §11) reaches this art through drawing.ts
// (adapter) and register.ts (registration, called at client start by game/weaponArtPreview.ts — the default art).
//
//   seriesModel({ family, gen, rarity, legendary?, grade?, seed?, rig?, accent? }) → SeriesModel | null
//     family  — gearVisuals.ts WeaponFamily (all 13 held families are drawn for every series)
//     gen     — generation 0..6 (gearVisual.ts name bands); selects the series
//     rarity  — craftsmanship (normal 0 / magic 1 / rare 2); legendary → bespoke drawing when one exists
//     grade   — 0 none / 1 Kindled / 2 Fabled (accents at the drawing's anchor)
//     seed    — per-item wear placement; rig — hero rig (bows: no string; the rig ties its own at (-2.4, ±21))
//     accent  — colour of the one accent (default the rarity token; legendary / Set colour on a series base)
//   The model draws 'base' (ink contour + tones) and 'light' (emissive only) in the hand-local frame, lists floating
//   parts (WFloat) for the rig, says whether a light layer exists and which colour it has.
//   null = no series drawing for this family yet → the caller keeps the default drawing.

import type { Rarity } from '@shared/types';
import type { WeaponFamily } from '../gearVisuals';
import type { WFloat, WLayer } from '../weaponDrawing';
import type { Ctx } from '../draw';
import { newKit, scratch, type K } from './kit';
import { gradeAccent } from './grade';
import { baseDraw } from './bases';
import { LEGENDARY_ART } from './legendary';
import { MILLWRIGHT } from './millwright';
import { KILNFOLK } from './kilnfolk';
import { BRINEKEEPER } from './brinekeeper';
import { WARDEN } from './warden';
import { ARRAY } from './array';
import { FAULTSTONE } from './faultstone';
import { RELIQUARY } from './reliquary';

export type Draw = (k: K) => void;

export interface Swatch { name: string; hex: number }

/** A series = a maker culture of one level band (data for the style bible, the gallery and the rig). */
export interface SeriesInfo {
  id: string;
  /** Generation it draws (gearVisual.ts name bands). */
  gen: number;
  name: string;
  maker: string;
  zones: string;
  levels: string;
  /** Shape language in a few words (anti-sameness rule A1). */
  shape: string;
  palette: Swatch[];
  motif: string;
  /** The late idea of the series: where its spectacle comes from instead of more glow. */
  late: string;
  /** The series' own effect language (ART-DIRECTION §1.4b). */
  effects?: string;
  draw: Partial<Record<WeaponFamily, Draw>>;
}

/** Index = generation. */
export const SERIES: SeriesInfo[] = [MILLWRIGHT, KILNFOLK, BRINEKEEPER, WARDEN, ARRAY, FAULTSTONE, RELIQUARY];

export interface SeriesSpec {
  family: WeaponFamily;
  gen: number;
  rarity: Rarity;
  legendary?: string;
  grade?: 0 | 1 | 2;
  seed?: number;
  rig?: boolean;
  /** Accent colour override (legendary / Set colour on a series base); default the rarity token. */
  accent?: number;
  /** Enhancement step 0..3 (+4 / +7 / +10). */
  temper?: number;
  /** The look's art shape: depth-wave bases (cleaver, maul2h, ...) have their own drawing (bases.ts). */
  shape?: string;
}

/** Effect strength of an item (ART-DIRECTION §1.4, owner decision 2026-10-11): plain normal items, then rising with the
 *  level band, rarity, legendary / Set, grade and +N. */
export function effectStrength(spec: SeriesSpec): number {
  const q = Q[spec.rarity];
  if (q === 0 && !spec.grade) return 0;
  const special = spec.rarity === 'legendary' || spec.rarity === 'set';
  return Math.max(0, 0.2 + 0.15 * spec.gen + 0.25 * (q - 1) + (special ? 0.35 : 0) + 0.25 * (spec.grade ?? 0) + 0.08 * (spec.temper ?? 0));
}

const Q: Record<Rarity, 0 | 1 | 2> = { normal: 0, magic: 1, rare: 2, legendary: 2, set: 2 };

/** Bespoke legendaries grow in three stages over the generations (early G0–G2, mid G3–G4, late G5–G6). */
export const legendaryStage = (gen: number): 0 | 1 | 2 => (gen <= 2 ? 0 : gen <= 4 ? 1 : 2);

/** The drawing function for a spec (series family drawing or a bespoke legendary), or null. */
export function seriesDraw(spec: SeriesSpec): Draw | null {
  if (spec.rarity === 'legendary' && spec.legendary && LEGENDARY_ART[spec.legendary]) {
    const L = LEGENDARY_ART[spec.legendary], st = legendaryStage(spec.gen);
    return (k) => L.draw(k, st);
  }
  const own = spec.shape ? baseDraw(spec.shape, spec.gen) : null;
  if (own) return own;
  const s = SERIES[Math.max(0, Math.min(SERIES.length - 1, spec.gen))];
  return s?.draw[spec.family] ?? null;
}

/** A series drawing: base + light layers, floating parts, whether it has light, and the colour of that light. */
export interface SeriesModel {
  draw: (c: Ctx, layer: WLayer) => void;
  floats: WFloat[];
  lit: boolean;
  litColor: number;
  /** Effect strength used for this model (see effectStrength). */
  fx: number;
}

/** Build the held-item model for a spec (same contract as weaponArt.weaponModel). */
export function seriesModel(spec: SeriesSpec): SeriesModel | null {
  const d = seriesDraw(spec);
  if (!d) return null;
  const q = Q[spec.rarity], rig = !!spec.rig, seed = spec.seed ?? 1, grade = spec.grade ?? 0, fx = effectStrength(spec);
  const run = (c: Ctx, layer: WLayer, floats: WFloat[]): K => {
    let last: K | null = null;
    const passes = layer === 'base' ? (['under', 'paint'] as const) : (['light'] as const);
    for (const pass of passes) {
      const k = newKit(c, pass, q, rig, seed, pass === 'paint' ? floats : []);
      k.accent = spec.accent ?? 0;
      k.fx = fx;
      d(k);
      if (grade) gradeAccent(k, grade);
      last = k;
    }
    return last!;
  };
  // bookkeeping passes (floats from 'paint', lit from 'light') run once into scratch contexts
  const floats: WFloat[] = [];
  scratch((c) => run(c, 'base', floats));
  const lk = scratch((c) => run(c, 'light', []));
  return { draw: (c, layer) => { run(c, layer, []); }, floats, lit: lk.lit, litColor: lk.litCol, fx };
}

export { type K } from './kit';
