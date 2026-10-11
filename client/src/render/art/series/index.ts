// Weapon series (docs/rework/gear/ART-DIRECTION.md): one maker per level band, each with its own silhouette language,
// palette and motif; rarity adds craftsmanship inside a series; legendaries are bespoke one-offs; Kindled / Fabled are
// small grade accents. NOT wired into the game yet — the gear rig calls `seriesModel()` in place of
// `weaponArt.weaponModel()` once it switches (the return type is the same WeaponModel).
//
// Plug-in contract (what the gear rig passes, what it gets back):
//   seriesModel({ family, gen, rarity, legendary?, grade?, seed?, rig? }) → WeaponModel | null
//     family  — gearVisuals.ts WeaponFamily (13 families; the sample implements blade, axe, bow, staff, wand)
//     gen     — generation 0..6 (gearVisual.ts name bands); selects the series
//     rarity  — craftsmanship (normal 0 / magic 1 / rare 2); legendary → bespoke drawing when one exists
//     grade   — 0 none / 1 Kindled / 2 Fabled (accents at the drawing's anchor)
//     seed    — per-item wear placement; rig — hero rig (bows: no string; the rig ties its own at (-2.4, ±21))
//   The model draws 'base' (ink contour + tones) and 'light' (emissive only) in the hand-local frame of weaponArt.ts,
//   lists floating parts (WFloat) for the rig to animate, and `lit` says whether a light layer exists.
//   null = no series drawing for this family yet → the caller keeps the old parametric art.

import type { Rarity } from '@shared/types';
import type { WeaponFamily } from '../gearVisuals';
import type { WFloat, WLayer, WeaponModel } from '../weaponArt';
import { newKit, scratch, type K } from './kit';
import { gradeAccent } from './grade';
import { LEGENDARY_ART } from './legendary';
import { MILLWRIGHT } from './millwright';
import { KILNFOLK } from './kilnfolk';
import { BRINEKEEPER } from './brinekeeper';
import { WARDEN } from './warden';
import { ARRAY } from './array';
import { RIFTSTONE } from './riftstone';
import { ANCIENTS } from './ancients';

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
  draw: Partial<Record<WeaponFamily, Draw>>;
}

/** Index = generation. */
export const SERIES: SeriesInfo[] = [MILLWRIGHT, KILNFOLK, BRINEKEEPER, WARDEN, ARRAY, RIFTSTONE, ANCIENTS];

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
  const s = SERIES[Math.max(0, Math.min(SERIES.length - 1, spec.gen))];
  return s?.draw[spec.family] ?? null;
}

/** The rig's WeaponModel plus the colour of the item's own light (icons tint their glow with it). */
export interface SeriesModel extends WeaponModel { litColor: number }

/** Build the held-item model for a spec (same contract as weaponArt.weaponModel). */
export function seriesModel(spec: SeriesSpec): SeriesModel | null {
  const d = seriesDraw(spec);
  if (!d) return null;
  const q = Q[spec.rarity], rig = !!spec.rig, seed = spec.seed ?? 1, grade = spec.grade ?? 0;
  const run = (c: import('../draw').Ctx, layer: WLayer, floats: WFloat[]): K => {
    let last: K | null = null;
    const passes = layer === 'base' ? (['under', 'paint'] as const) : (['light'] as const);
    for (const pass of passes) {
      const k = newKit(c, pass, q, rig, seed, pass === 'paint' ? floats : []);
      k.accent = spec.accent ?? 0;
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
  return { draw: (c, layer) => { run(c, layer, []); }, floats, lit: lk.lit, litColor: lk.litCol };
}

export { type K } from './kit';
