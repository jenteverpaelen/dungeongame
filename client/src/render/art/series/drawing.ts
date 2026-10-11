// Adapter from the gear rig's drawing interface (weaponDrawing.ts, DESIGN-V2 §11) to the series art.
// `seriesDrawing(input)` takes a WeaponDrawInput and returns a WeaponDrawing, or null when the series has no drawing for
// that family yet (the registration in register.ts then falls back to the default procedural drawing). The input type
// is structural (only the fields read here), so this file has no dependency on the rig module.
//
// Mapping: style.gen → the series (one maker per generation), style.rar → craftsmanship (normal / magic / rare;
// legendary / Set → rare craft carrying the item's own colour as the accent, or the bespoke drawing when one exists),
// style.top → grade accents, look.variant → wear placement, rig → bows without string.
// Presentation: the trails, strike flash and projectile tint take the series' own light (ember, beacon lamp, signal
// lilac, rift rune, Cube teal); series without light give plain attacks (light 0), as REFERENCES-V2 V3 asks.

import type { ItemLook, Rarity } from '@shared/types';
import type { WeaponFamily } from '../gearVisuals';
import { light } from '../util';
import { SERIES, seriesModel, type SeriesModel, type SeriesSpec } from './index';
import { LEGENDARY_ART } from './legendary';

export interface SeriesDrawInput {
  look: ItemLook;
  style: { gen: number; rar: number; special: boolean; top: number; temper: number; legendary?: string; edgeLight: number };
  family: WeaponFamily;
  reach: { tip: number; base: number };
  rig: boolean;
}

export interface SeriesPresentation {
  light: number; core: number; edge: number; strength: number;
  tip: [number, number]; base: [number, number];
  impact?: 'spark' | 'ember' | 'star' | 'shard';
}

export interface SeriesDrawing {
  draw: SeriesModel['draw'];
  readonly floats: SeriesModel['floats'];
  readonly lit: boolean;
  readonly present: SeriesPresentation;
}

const RAR: Rarity[] = ['normal', 'magic', 'rare', 'legendary', 'set'];
/** Impact hint per series (grades override: Kindled ember, Fabled star). */
const IMPACT: SeriesPresentation['impact'][] = ['spark', 'ember', 'shard', 'spark', 'spark', 'shard', 'spark'];

export function seriesSpecOf(input: SeriesDrawInput): SeriesSpec {
  const s = input.style, rarity = RAR[Math.max(0, Math.min(4, s.rar))];
  const special = rarity === 'legendary' || rarity === 'set';
  return {
    family: input.family, gen: Math.max(0, Math.min(SERIES.length - 1, s.gen)), rarity,
    legendary: s.legendary && LEGENDARY_ART[s.legendary] ? s.legendary : undefined,
    grade: (Math.max(0, Math.min(2, s.top)) as 0 | 1 | 2),
    seed: input.look.variant + 1, rig: input.rig,
    accent: special && input.look.glow ? input.look.glow : undefined,
  };
}

export function seriesDrawing(input: SeriesDrawInput): SeriesDrawing | null {
  const spec = seriesSpecOf(input);
  const m = seriesModel(spec);
  if (!m) return null;
  const s = input.style, L = m.litColor;
  const bow = input.family === 'bow';
  return {
    draw: m.draw, floats: m.floats, lit: m.lit,
    present: {
      light: L,
      core: L ? light(L, 0.45) : 0,
      edge: s.edgeLight,
      // the same scale as the default drawings, so the attack presentation keeps its calibration
      strength: !L ? 0 : 0.25 + 0.1 * s.gen + (s.special ? 0.35 : 0) + 0.2 * s.top + 0.05 * s.temper,
      tip: bow ? [6, 0] : [0, -input.reach.tip],
      base: bow ? [2.6, 0] : [0, -input.reach.base],
      impact: s.top >= 2 ? 'star' : s.top === 1 ? 'ember' : IMPACT[spec.gen],
    },
  };
}
