// The weapon-drawing interface (docs/rework/gear/DESIGN-V2.md §11). Everything that shows a held item — the hero rig,
// icons, ground loot, previews and the attack presentation — goes through `weaponDrawing(look)`, never through a
// particular drawing. A drawing is chosen per silhouette family and receives the item's derived identity
// (family × generation × rarity × signature × grade, plus its palette); it returns its art, its floating pieces and the
// presentation data the attacks read (light colours, light anchors, strength). New drawings (the art-direction pass)
// replace a family with `registerWeaponDrawing(family, fn)` without touching the rig, the icons or the VFX.

import { GraphicsContext } from 'pixi.js';
import type { ItemLook } from '@shared/types';
import type { Ctx } from './draw';
import { itemStyle, type ItemStyle } from './gearStyle';
import { SHAPE_FAMILY, type WeaponFamily } from './gearVisuals';
import { DEFAULT_WEAPON_DRAWINGS } from './weaponArt';

/** 'base' = the solid art (lit parts painted lit, or dormant); 'light' = only the emissive parts (drawn additively). */
export type WLayer = 'base' | 'light';

/** A floating piece: drawn around its own origin, placed at (x, y) in the weapon frame. */
export interface WFloat {
  x: number; y: number;
  draw: (c: Ctx) => void;
  /** Hover amplitude (units), orbit radius around (x, y) (0 = hover only), spin (rad/s), phase. */
  bob: number; orbit: number; spin: number; phase: number;
  /** Light colour of the piece's glow sprite (0 = none) and its size. */
  glow: number; glowR: number;
  /** Decorative: the crowd budget may hide it; structural pieces always show. */
  deco: boolean;
}

/** What a drawing receives. Coordinates: hand-local, grip at the origin, business end towards −y (bows: limbs along
 *  ±y, belly +x). Draw at the family's canonical reach; the rig scales by `style.scale`. */
export interface WeaponDrawInput {
  look: ItemLook;
  /** The derived identity: gen 0..6, rar 0..4 (normal … set), special, top (grade), temper, legendary / set ids,
   *  signature / bespoke keys, palette (metal, edge, dark, trim, wood, wrap) and light colours (light, edgeLight). */
  style: ItemStyle;
  family: WeaponFamily;
  shape: string;
  /** Canonical reach of the family (tip and the start of the striking part, units along −y). */
  reach: { tip: number; base: number };
  /** Drawn for the hero rig (true) or for icons (false: may thicken thin shafts). */
  rig: boolean;
}

/** What the attacks read from a drawing (trails, strike flash, cleave arc, projectile skin, hit flash). */
export interface WeaponPresentation {
  /** The weapon's light; 0 = plain (attacks keep their default look). */
  light: number;
  /** A brighter core of it, and the grade's edge colour (0 below the grades). */
  core: number;
  edge: number;
  /** 0..~2: how strongly the attacks show the weapon (0 plain … ~1.2 a level-70 signature legendary … ~2.1 Fabled +10;
   *  every size saturates at 1.6, above that only colours and the hint change). */
  strength: number;
  /** Light anchors in the hand-local frame: the striking part runs base → tip; the strike flash sits at the tip. */
  tip: [number, number];
  base: [number, number];
  /** Optional particle hint for impacts and projectile trails. */
  impact?: 'spark' | 'ember' | 'star' | 'shard';
}

export interface WeaponDrawing {
  draw(c: Ctx, layer: WLayer): void;
  /** Floating pieces (the rig animates them; icons draw them at rest). */
  readonly floats: WFloat[];
  /** Has a light layer worth baking. */
  readonly lit: boolean;
  readonly present: WeaponPresentation;
}

export type WeaponDrawFn = (input: WeaponDrawInput) => WeaponDrawing;

const REG: Record<WeaponFamily, WeaponDrawFn> = { ...DEFAULT_WEAPON_DRAWINGS };

/** Replace a family's drawing (the art-direction pass). Clears the cache so every view redraws on its next bake. */
export function registerWeaponDrawing(family: WeaponFamily, fn: WeaponDrawFn): void {
  REG[family] = fn;
  CACHE.clear();
}

const CACHE = new Map<string, WeaponDrawing>();

/** The drawing of a held item look (weapons and off-hands), or null for looks without identity (townsfolk tools). */
export function weaponDrawing(look: ItemLook | undefined, rig = false): WeaponDrawing | null {
  const style = itemStyle(look);
  const fam = look ? SHAPE_FAMILY[look.shape] : undefined;
  if (!look || !style || !fam) return null;
  const key = `${look.shape}|${rig ? 1 : 0}|${look.fx}|${look.primary}|${look.secondary}|${look.glow}|${look.variant}`;
  let d = CACHE.get(key);
  if (!d) {
    d = REG[fam.family]({ look, style, family: fam.family, shape: look.shape, reach: fam.reach, rig });
    if (CACHE.size > 600) CACHE.clear();
    CACHE.set(key, d);
  }
  return d;
}

/** Helper for drawings: collect floats with a vector-only pass into a scratch context (no render). */
export function scratchFloats(run: (c: Ctx, out: WFloat[]) => void): WFloat[] {
  const scratch = new GraphicsContext();
  const out: WFloat[] = [];
  run(scratch, out);
  scratch.destroy();
  return out;
}
