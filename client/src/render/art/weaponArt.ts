// DEFAULT (procedural) weapon and off-hand drawings, behind the interface in weaponDrawing.ts (DESIGN-V2 §11): the
// art-direction pass replaces families with `registerWeaponDrawing` and nothing else changes. Owner feedback
// (2026-10-11): these look generic ("very ai made"); treat them as placeholders for the hand-authored series.
//
// One drawing per silhouette family (gearVisuals.ts SHAPE_FAMILY) that evolves over the seven generations in a
// two-beat rhythm (REFERENCES-V2 V2): a new model at G0 / G2 / G4 / G6 (crude → forged → runic → zenith), a material
// and light step in between. Rarity decides the colour and the amount of light and adds embellishments (inlay, gilt
// trim, gems, extra prongs); legendaries add a signature (extra silhouette parts, a light language, motif floaters) or a
// fully bespoke drawing; the top tier adds edge light and more floaters; +N raises the light in the live layer.
//
// Layers: 'base' is the solid art (light channels painted lit, or dormant dark grooves on normal items); 'light' is only
// the emissive parts, baked separately and drawn additively + pulsing by the hero rig and composited with a glow in
// icons. Floating pieces are listed separately (the rig animates them; icons draw them at rest).
// Hand-local frame (same as gear.ts): grip at the origin, the business end towards -y; bows: limbs along y, belly +x.

import { GraphicsContext } from 'pixi.js';
import type { ItemLook } from '@shared/types';
import { OUT, ball, blob, crease, fill, gem, line, outline, poly, rbox, rivet, seg, spark, star, wash, inSilhouette, type Ctx } from './draw';
import { FABLED_LIGHT, TOP_COLORS, type ItemStyle } from './gearStyle';
import type { Motif, Signature, WeaponFamily } from './gearVisuals';
import type { WFloat, WLayer, WeaponDrawFn, WeaponDrawInput, WeaponDrawing, WeaponPresentation } from './weaponDrawing';
import { light, mix, shade } from './util';

export type { WFloat, WLayer } from './weaponDrawing';

interface P {
  s: ItemStyle; g: number; r: number; sp: boolean; top: number; v: number;
  /** Drawn for the hero rig (false: icons, where long thin shafts get a little thicker to read at 40 px). */
  rig: boolean;
  metal: number; edge: number; dark: number; trim: number; wood: number; wrap: number;
  /** Light colour (0 = dormant). */
  L: number;
  edgeL: number;
  layer: WLayer;
  sig: Signature | null;
  motif: Motif | null;
  look: ItemLook;
}

const GROOVE = (p: P) => shade(p.dark, 0.45);
const LIT = (p: P) => mix(p.L, 0xffffff, 0.22);

// ─────────────────────────── light helpers (both layers) ───────────────────────────

/** A light channel along a polyline: dormant groove / lit core in 'base', bloom in 'light'. */
function lightLine(c: Ctx, p: P, pts: number[], w: number, k = 1): void {
  if (p.layer === 'base') {
    crease(c, pts, w + 1, GROOVE(p), 0.95);
    if (p.L) crease(c, pts, w, LIT(p), 1);
  } else if (p.L) {
    crease(c, pts, w * 2.8, p.L, 0.16 * k);
    crease(c, pts, w * 1.5, p.L, 0.55 * k);
    crease(c, pts, w * 0.55, light(p.L, 0.6), 0.7 * k);
  }
}

/** A lit area (window, core, crack). */
function lightPoly(c: Ctx, p: P, pts: number[], k = 1): void {
  if (p.layer === 'base') {
    c.poly(pts, true); fill(c, p.L ? LIT(p) : GROOVE(p));
    if (!inSilhouette()) { c.poly(pts, true); c.stroke({ width: 0.9, color: shade(p.dark, 0.5), alpha: 0.9, join: 'round' }); }
  } else if (p.L) {
    c.poly(pts, true); c.stroke({ width: 2.6, color: p.L, alpha: 0.28 * k, join: 'round' });
    c.poly(pts, true); fill(c, p.L, 0.6 * k);
    c.poly(shrink(pts, 0.5), true); fill(c, light(p.L, 0.6), 0.7 * k);
  }
}

/** A gem / light node. */
function lightGem(c: Ctx, p: P, x: number, y: number, r: number, col = p.L): void {
  if (p.layer === 'base') { gem(c, x, y, r, col ? light(col, 0.12) : p.trim); return; }
  if (!col) return;
  c.circle(x, y, r * 2.2).fill({ color: col, alpha: 0.16 });
  c.circle(x, y, r * 1.2).fill({ color: col, alpha: 0.6 });
  c.circle(x, y, r * 0.55).fill({ color: light(col, 0.6), alpha: 0.75 });
}

/** Top-tier edge light along an outline edge. */
function edgeLight(c: Ctx, p: P, pts: number[]): void {
  if (!p.edgeL) return;
  if (p.layer === 'base') crease(c, pts, 1, light(p.edgeL, 0.3), 0.95);
  else { crease(c, pts, 3.6, p.edgeL, 0.26); crease(c, pts, 1.2, light(p.edgeL, 0.6), 0.75); }
}

function shrink(pts: number[], k: number): number[] {
  let cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; }
  cx /= pts.length / 2; cy /= pts.length / 2;
  return pts.map((v, i) => (i % 2 === 0 ? cx + (v - cx) * k : cy + (v - cy) * k));
}

/** Append a LOCAL transform (Pixi GraphicsContext translate / rotate act in the outer frame, transform() appends). */
export function localXf(c: Ctx, x: number, y: number, rot = 0, k = 1): void {
  const cs = Math.cos(rot) * k, sn = Math.sin(rot) * k;
  c.transform(cs, sn, -sn, cs, x, y);
}

const mirror = (pts: number[]) => { const o: number[] = []; for (let i = pts.length - 2; i >= 0; i -= 2) o.push(-pts[i], pts[i + 1]); return o; };
/** Right half profile (top to bottom or any order) → closed symmetric polygon. */
const sym = (right: number[]) => [...right, ...mirror(right)];

// ─────────────────────────── shared pieces ───────────────────────────

/** Grip from y0 (pommel side, +) to y1 (guard side, −): wrap rings by generation. */
function grip(c: Ctx, p: P, y0: number, y1: number, w: number): void {
  if (p.layer !== 'base') return;
  const g = p.g;
  seg(c, 0, y0, 0, y1, w, g === 0 ? p.wood : g >= 4 ? shade(p.wrap, 0.1) : p.wrap, 2);
  const n = Math.max(2, Math.round(Math.abs(y0 - y1) / 2.2));
  for (let i = 1; i < n; i++) {
    const y = y0 + (y1 - y0) * (i / n);
    crease(c, [-w * 0.5, y + 0.6, w * 0.5, y - 0.6], 0.9, g === 0 ? light(p.wrap, 0.1) : shade(p.wrap, 0.45), 0.9);
  }
}

/** Pommel by generation (y = centre). */
function pommel(c: Ctx, p: P, y: number, k = 1): void {
  const g = p.g;
  if (p.layer === 'base') {
    if (g === 0) { ball(c, 0, y - 0.4, 1.7 * k, 1.4 * k, p.wrap, { ow: 1.3 }); line(c, (q) => q.moveTo(0.6, y).quadraticCurveTo(2.4, y + 2.4, 1.2, y + 4), 0.9, p.wrap, 0.9, false); return; }
    if (g === 1) { ball(c, 0, y, 2.1 * k, 2.1 * k, p.metal, { ow: 1.5 }); return; }
    if (g === 2) { rbox(c, -2.6 * k, y - 1.4 * k, 5.2 * k, 2.8 * k, 1.2, p.trim, { ow: 1.5, hl: 0.4 }); return; }
    if (g === 3) { ball(c, 0, y, 2.6 * k, 2.4 * k, p.trim, { ow: 1.6, hl: 0.5 }); }
    else if (g === 4) poly(c, [0, y - 2.6 * k, 2.4 * k, y, 0, y + 4 * k, -2.4 * k, y], p.metal, { ow: 1.5, hl: 0.3 });
    else if (g === 5) blob(c, [-3.6 * k, y - 1.6 * k, 0, y - 0.6 * k, 3.6 * k, y - 1.6 * k, 2 * k, y + 2.6 * k, 0, y + 3.6 * k, -2 * k, y + 2.6 * k], p.trim, { ow: 1.5, hl: 0.35 });
    else { blob(c, [-3.4 * k, y - 2, 0, y - 1, 3.4 * k, y - 2, 2.4 * k, y + 2.4, 0, y + 5 * k, -2.4 * k, y + 2.4], p.trim, { ow: 1.5, hl: 0.4 }); }
  }
  if (g >= 3 && (p.r >= 1 || g >= 4)) lightGem(c, p, 0, y + (g === 4 ? 0.4 : 0.2), (g >= 5 ? 1.5 : 1.2) * k, p.L || 0);
}

// ─────────────────────────── blade family (sword, greatsword) ───────────────────────────

function bladeFamily(c: Ctx, p: P, big: boolean, out: WFloat[]): void {
  const g = p.g, base = p.layer === 'base';
  const tip = big ? -48 : -31, gy = big ? -7.4 : -5, pom = big ? 10.4 : 5.3;
  const kx = big ? 1.22 : 1;
  const W = [2.5, 2.8, 3.1, 3.2, 3.8, 4.1, 3.0][g] * kx;
  const bs = gy - 0.8, len = tip - bs; // len < 0
  const Y = (t: number) => bs + len * t;
  // grip + pommel
  grip(c, p, pom - 1.6, gy + 1, big ? 3.2 : 2.7);
  pommel(c, p, pom, big ? 1.15 : 1);
  // blade profile (right half from the guard to the tip)
  let right: number[];
  switch (g) {
    case 0: right = [W, bs, W * 0.95, Y(0.45), W * 0.62, Y(0.5), W * 0.92, Y(0.56), W * 0.8, Y(0.86), 0, tip]; break; // a nick in the edge
    case 1: right = [W, bs, W * 0.86, Y(0.84), 0, tip]; break;
    case 2: right = [W * 0.72, bs, W * 0.72, Y(0.08), W, Y(0.12), W * 0.9, Y(0.85), 0, tip]; break; // ricasso
    case 3: right = [W * 0.78, bs, W * 0.95, Y(0.4), W * 1.18, Y(0.72), W * 0.7, Y(0.9), 0, tip]; break; // leaf
    case 4: right = [W * 0.86, bs, W, Y(0.1), W, Y(0.74), W * 0.55, Y(0.82), W * 0.62, Y(0.88), 0, tip]; break; // stepped point
    case 5: right = [W * 0.8, bs, W * 1.12, Y(0.2), W * 0.84, Y(0.27), W * 1.16, Y(0.48), W * 0.88, Y(0.55), W * 1.06, Y(0.78), 0, tip]; break; // tiered edge
    default: right = [W * 0.86, bs, W, Y(0.08), W * 0.92, Y(0.86), 0, tip]; // zenith core blade (the side segments float)
  }
  const blade = sym(right);
  if (base) {
    poly(c, blade, p.metal, { hl: 0, inset: 0.82, px: -0.4 });
    wash(c, (k) => k.poly(right.map((v, i) => (i % 2 === 0 ? Math.max(0.3, v) : v)).concat([0.3, tip + 1]), true), p.edge, 0.5);
    if (g === 2 || g === 3) crease(c, [0, Y(0.08), 0, Y(0.8)], 1.1, shade(p.metal, 0.45), 0.8); // fuller
    if (g === 3) for (const t of [0.12, 0.2]) crease(c, [-W * 0.5, Y(t), W * 0.5, Y(t) - 0.6], 0.8, p.trim, 0.9); // engraving
    c.poly(blade, true); outline(c, big ? 2.4 : 2.2);
    if (g >= 4) { // runesteel notches near the guard
      for (const k of [1, -1]) poly(c, [k * W * 0.86, Y(0.2), k * W * 0.45, Y(0.25), k * W * 0.86, Y(0.3)], shade(p.dark, 0.3), { ow: 1 });
    }
  }
  // light: magic+ inlay (G0-G3), runic channel (G4), window + edges (G5), core spine (G6)
  if (g <= 3) { if (p.r >= 1) lightLine(c, p, [0, Y(0.1), 0, Y(g >= 2 ? 0.74 : 0.55)], g >= 2 ? 1 : 0.8, 0.8); }
  else if (g === 4) lightLine(c, p, [0, Y(0.06), 0, Y(0.8)], 1.5);
  else if (g === 5) { lightLine(c, p, [0, Y(0.06), 0, Y(0.62)], 1.3); lightPoly(c, p, [0, Y(0.68), W * 0.45, Y(0.76), 0, Y(0.86), -W * 0.45, Y(0.76)]); }
  else { lightPoly(c, p, sym([W * 0.32, bs - 0.2, W * 0.36, Y(0.84), 0, Y(0.97)])); }
  if (p.sp && g < 4) lightLine(c, p, [0, Y(0.1), 0, Y(0.86)], 1.2); // legendary core on early blades
  edgeLight(c, p, [W * 0.9, Y(0.1), right[right.length - 4], right[right.length - 3], 0, tip]);
  edgeLight(c, p, [-W * 0.9, Y(0.1), -right[right.length - 4], right[right.length - 3], 0, tip]);
  // guard by generation, rarity trims
  guard(c, p, gy, big ? 1.3 : 1, W);
  // zenith side segments: part of the G6 model, hovering beside the core blade
  if (g === 6) {
    for (const k of [1, -1]) {
      // a wing-blade either side of the core: broad at the guard, sweeping up to a point at mid-blade
      const segPts = [k * W * 1.2, Y(0.03), k * W * 3.2, Y(0.08), k * W * 2.7, Y(0.22), k * W * 1.3, Y(0.5), k * W * 1.1, Y(0.22)];
      const cx = k * W * 2, cy = Y(0.2);
      out.push(solidOf(p, cx, cy, (q) => {
        const loc = segPts.map((v, i) => (i % 2 === 0 ? v - cx : v - cy));
        poly(q, loc, p.metal, { hl: 0, inset: 0.82 });
        wash(q, (kk) => kk.poly(shrink(loc, 0.55), true), p.edge, 0.45);
        q.poly(loc, true); outline(q, 1.8);
        if (p.L) crease(q, [k * 0.6 * W, (Y(0.09) - cy), k * -0.6 * W, (Y(0.42) - cy)], 1.2, LIT(p), 1);
        if (p.edgeL) crease(q, loc.slice(0, 6), 1, light(p.edgeL, 0.3), 0.95);
      }, 0.9, 0, 0, k > 0 ? 0 : Math.PI, p.L, 10));
    }
  }
}

/** Crossguard by generation; rarity adds gilt tips, gems and a langet. */
function guard(c: Ctx, p: P, gy: number, k: number, W: number): void {
  const g = p.g, base = p.layer === 'base';
  const col = g <= 1 ? p.metal : p.trim;
  if (base) {
    switch (g) {
      case 0: rbox(c, -4.6 * k, gy - 1.2, 9.2 * k, 2.4, 1, p.dark, { ow: 1.6, hl: 0.2 }); break;
      case 1: rbox(c, -5.6 * k, gy - 1.3, 11.2 * k, 2.6, 1.2, col, { ow: 1.7, hl: 0.35 }); for (const s of [1, -1]) ball(c, s * 5.8 * k, gy, 1.6, 1.6, col, { ow: 1.3 }); break;
      case 2: blob(c, [-6.8 * k, gy + 2.2, -5.6 * k, gy - 1.6, 0, gy - 1.4, 5.6 * k, gy - 1.6, 6.8 * k, gy + 2.2, 4.4 * k, gy + 0.6, 0, gy + 1.2, -4.4 * k, gy + 0.6], col, { ow: 1.8, hl: 0.4 }); break;
      case 3: blob(c, [-7.6 * k, gy - 3.4, -4.8 * k, gy - 0.6, 0, gy - 1.8, 4.8 * k, gy - 0.6, 7.6 * k, gy - 3.4, 6 * k, gy + 1.4, 0, gy + 1.6, -6 * k, gy + 1.4], col, { ow: 1.8, hl: 0.4 }); poly(c, [-1.4, gy - 1.6, 0, gy - 5.6, 1.4, gy - 1.6], col, { ow: 1.3 }); break;
      case 4: for (const s of [1, -1]) poly(c, [s * 1.6, gy + 1.6, s * 8.4 * k, gy - 4.8, s * 9 * k, gy - 2, s * 3, gy + 2.4], col, { ow: 1.7, hl: 0.3 }); ball(c, 0, gy, 3.2 * k, 3, p.dark, { ow: 1.7 }); break;
      case 5: for (const s of [1, -1]) blob(c, [s * 1.2, gy + 2, s * 6 * k, gy + 1, s * 9.6 * k, gy - 4.6, s * 9 * k, gy - 7.6, s * 7.4 * k, gy - 3.2, s * 3 * k, gy - 1.6], col, { ow: 1.7, hl: 0.35 }); ball(c, 0, gy + 0.2, 3.4 * k, 3.2, p.dark, { ow: 1.7 }); break;
      default: for (const s of [1, -1]) { blob(c, [s * 1.2, gy + 2.2, s * 7 * k, gy + 1.4, s * 11.6 * k, gy - 5.6, s * 11 * k, gy - 9.6, s * 8.4 * k, gy - 3.4, s * 3 * k, gy - 1.6], col, { ow: 1.8, hl: 0.4 }); blob(c, [s * 2.4, gy + 2.4, s * 6.4 * k, gy + 4.2, s * 8.6 * k, gy + 7.2, s * 4.4 * k, gy + 5], shade(col, 0.1), { ow: 1.5, hl: 0.3 }); } ball(c, 0, gy, 3.8 * k, 3.6, p.dark, { ow: 1.8 });
    }
    // rarity: rare+ adds gilt edge lines and tip studs
    if (p.r >= 2 && g >= 1 && g <= 3) { crease(c, [-5 * k, gy - 0.4, 5 * k, gy - 0.4], 0.8, light(p.trim, 0.45), 0.9); }
    if (p.r >= 2 && g <= 2) poly(c, [-1.2, gy - 1.2, 0, gy - 4.4, 1.2, gy - 1.2], p.trim, { ow: 1.2 }); // langet
  }
  // gems: G4+ centre node always (lit when the item has light), rare+ tip gems
  if (g >= 4) lightGem(c, p, 0, gy, (g >= 6 ? 2.6 : 2.2) * k, p.L);
  else if (p.r >= 1) lightGem(c, p, 0, gy, 1.5 * k, p.L);
  if (p.r >= 2) {
    const tx = [0, 5.8, 6.8, 7.6, 8.6, 9.2, 11.2][g] * k, ty = [0, 0, 2.2, -3.4, -3.6, -7.2, -9.2][g];
    if (g >= 1) for (const s of [1, -1]) lightGem(c, p, s * tx, gy + ty, 1.1 * k, p.L);
  }
}

// ─────────────────────────── axes ───────────────────────────

function axeFamily(c: Ctx, p: P, big: boolean, out: WFloat[]): void {
  const g = p.g, base = p.layer === 'base';
  const k = big ? 1.42 : 1;
  const top = big ? -46 : -27, haft0 = big ? 11 : 6;
  const hy = big ? -36 : -20.6; // head centre height
  // haft
  if (base) {
    line(c, (q) => q.moveTo(0, haft0).lineTo(0, top + 2), big ? 3.2 : 2.8, g === 0 ? p.wood : g >= 4 ? p.dark : p.wood, 2);
    if (g === 0) for (const y of [hy + 6 * k, hy + 7.6 * k]) crease(c, [-1.4, y, 1.4, y - 0.8], 1.1, p.wrap, 1);
    else { for (let i = 0; i < 3; i++) crease(c, [-1.5, haft0 - 2 - i * 2.2, 1.5, haft0 - 3 - i * 2.2], 1, shade(p.wrap, 0.3), 1); }
    if (g >= 2) rbox(c, -2.4, haft0 - 1.2, 4.8, 2.6, 1, p.trim, { ow: 1.3 });
  }
  // head: edge to the right (+x), poll / back spike to the left
  const E = [9.5, 10.8, 12, 13, 13.8, 14.6, 15.4][g] * k; // edge reach
  const H = [5.4, 6.3, 7.2, 8.4, 9.2, 10, 10.8][g] * k;    // half height of the edge
  let head: number[];
  switch (g) {
    case 0: head = [0, hy - H * 0.7, E * 0.85, hy - H, E, hy + H * 0.4, E * 0.6, hy + H * 0.75, 0, hy + H * 0.45]; break;
    case 1: head = [0, hy - H * 0.6, E * 0.55, hy - H * 0.8, E, hy - H, E * 1.02, hy + H * 0.9, E * 0.7, hy + H * 0.6, 0, hy + H * 0.5]; break; // bearded
    case 2: head = [0, hy - H * 0.55, E * 0.5, hy - H * 0.7, E, hy - H * 1.05, E * 1.06, hy + H * 1.05, E * 0.6, hy + H * 0.6, 0, hy + H * 0.5]; break;
    case 3: head = [0, hy - H * 0.45, E * 0.45, hy - H * 0.55, E * 0.95, hy - H * 1.15, E * 1.12, hy, E * 0.95, hy + H * 1.15, E * 0.45, hy + H * 0.55, 0, hy + H * 0.45]; break; // crescent
    case 4: head = [0, hy - H * 0.45, E * 0.55, hy - H * 0.5, E * 0.9, hy - H * 1.2, E * 1.1, hy - H * 0.2, E * 0.82, hy, E * 1.1, hy + H * 0.25, E * 0.9, hy + H * 1.15, E * 0.5, hy + H * 0.5, 0, hy + H * 0.45]; break; // notched
    case 5: head = [0, hy - H * 0.42, E * 0.5, hy - H * 0.55, E * 0.62, hy - H * 1.25, E * 1.02, hy - H * 1.05, E * 1.16, hy, E * 0.98, hy + H * 1.1, E * 0.48, hy + H * 0.55, 0, hy + H * 0.42]; break; // horned top
    default: head = [0, hy - H * 0.38, E * 0.45, hy - H * 0.5, E * 0.72, hy - H * 0.95, E * 0.86, hy, E * 0.72, hy + H * 0.95, E * 0.45, hy + H * 0.5, 0, hy + H * 0.38]; // inner crescent, outer edge floats
  }
  const poll: number[] = g === 0 ? [] : big || g >= 3
    ? [0, hy - H * 0.4, -E * (big ? 0.82 : 0.42), hy - H * (big ? 0.95 : 0.5), -E * (big ? 0.95 : 0.55), hy, -E * (big ? 0.82 : 0.42), hy + H * (big ? 0.95 : 0.5), 0, hy + H * 0.4]
    : [0, hy - H * 0.35, -4 * k, hy - H * 0.2, -5.4 * k, hy, -4 * k, hy + H * 0.2, 0, hy + H * 0.35];
  if (base) {
    if (poll.length) { poly(c, poll, shade(p.metal, 0.08), { hl: 0, inset: 0.82 }); }
    poly(c, head, p.metal, { hl: 0, inset: 0.82, px: -0.3 });
    wash(c, (q) => q.poly(head.map((v, i) => (i % 2 === 0 ? Math.max(E * 0.7, v) : v)), true), p.edge, 0.55);
    c.poly(head, true); outline(c, big ? 2.4 : 2.2);
    if (g >= 3 && !inSilhouette()) crease(c, [E * 0.32, hy - H * 0.4, E * 0.32, hy + H * 0.4], 0.9, p.trim, 0.9);
    // collar on the haft
    rbox(c, -2.2 * (big ? 1.2 : 1), hy - H * 0.55, 4.4 * (big ? 1.2 : 1), H * 1.1, 1.2, g <= 1 ? p.dark : p.trim, { ow: 1.6, hl: 0.3 });
    if (g >= 2) poly(c, [-1.6, top + 1, 0, top - (g >= 4 ? 6 : 3.6) * (big ? 1.3 : 1), 1.6, top + 1], light(p.metal, 0.15), { ow: 1.5 }); // top spike
  }
  // light: magic+ edge inlay early, runic channel G4, double channel G5, core G6
  const ex = E * 0.82;
  if (g <= 3) { if (p.r >= 1) lightLine(c, p, [ex, hy - H * 0.6, ex + 0.6, hy + H * 0.6], 0.9, 0.8); }
  else if (g === 4) lightLine(c, p, [E * 0.7, hy - H * 0.85, E * 0.86, hy - H * 0.1, E * 0.86, hy + H * 0.1, E * 0.7, hy + H * 0.85], 1.4);
  else if (g === 5) { lightLine(c, p, [E * 0.66, hy - H * 0.9, E * 0.88, hy, E * 0.66, hy + H * 0.9], 1.3); lightGem(c, p, E * 0.4, hy, 1.8 * k * 0.8, p.L); }
  else lightPoly(c, p, [E * 0.3, hy - H * 0.32, E * 0.6, hy - H * 0.7, E * 0.68, hy, E * 0.6, hy + H * 0.7, E * 0.3, hy + H * 0.32]);
  if (p.sp && g < 4) lightLine(c, p, [E * 0.5, hy - H * 0.5, E * 0.5, hy + H * 0.5], 1.1);
  edgeLight(c, p, head.slice(4, 12));
  if (g >= 3 || p.r >= 1) lightGem(c, p, 0, hy, (g >= 4 ? 2.2 : 1.6) * (big ? 1.2 : 1), p.L);
  if (p.r >= 2 && base) for (const y of [hy - H * 0.3, hy + H * 0.3]) rivet(c, 0, y, 0.9, light(p.trim, 0.35));
  // zenith: the outer edge hovers off the crescent
  if (g === 6) {
    const edgeArc = [E * 0.82, hy - H * 1.05, E * 1.05, hy - H * 1.2, E * 1.32, hy, E * 1.05, hy + H * 1.2, E * 0.82, hy + H * 1.05, E * 1.02, hy];
    const cx = E * 1.05, cy = hy;
    out.push(solidOf(p, cx, cy, (q) => {
      const loc = edgeArc.map((v, i) => (i % 2 === 0 ? v - cx : v - cy));
      poly(q, loc, p.metal, { hl: 0, inset: 0.8 });
      wash(q, (kk) => kk.poly(loc.map((v, i) => (i % 2 === 0 ? Math.max(0, v) : v)), true), p.edge, 0.55);
      q.poly(loc, true); outline(q, 1.9);
      if (p.L) crease(q, [loc[0] + 1.6, loc[1] + 2.4, -0.4, 0, loc[8] + 1.6, loc[9] - 2.4], 1.2, LIT(p), 1);
      if (p.edgeL) crease(q, loc.slice(2, 8), 1.1, light(p.edgeL, 0.3), 0.95);
    }, 0.9, 0, 0, 0, p.L, 14 * k));
    if (big) { // and the poll mirrors it
      const cx2 = -E * 1.0;
      out.push(solidOf(p, cx2, cy, (q) => {
        const loc = edgeArc.map((v, i) => (i % 2 === 0 ? -(v - cx) * 0.85 : v - cy));
        poly(q, loc, shade(p.metal, 0.08), { hl: 0, inset: 0.8 });
        q.poly(loc, true); outline(q, 1.9);
        if (p.L) crease(q, [loc[0] - 1.4, loc[1] + 2.4, 0.4, 0, loc[8] - 1.4, loc[9] - 2.4], 1.2, LIT(p), 1);
      }, 0.9, 0, 0, Math.PI, p.L, 12 * k));
    }
  }
}

// ─────────────────────────── mace ───────────────────────────

function maceFamily(c: Ctx, p: P, out: WFloat[]): void {
  const g = p.g, base = p.layer === 'base';
  const hy = -20.6;
  if (base) {
    line(c, (q) => q.moveTo(0, 5.6).lineTo(0, hy + 4), 2.8, g <= 1 ? p.wood : p.dark, 2);
    for (let i = 0; i < 3; i++) crease(c, [-1.4, 3 - i * 2, 1.4, 2 - i * 2], 1, g === 0 ? p.wrap : shade(p.wrap, 0.2), 1);
  }
  const R = [5.4, 5.8, 5.8, 6.4, 7, 7.4, 6.8][g];
  if (g <= 1) { // club / studded club: a wooden lump
    if (base) {
      blob(c, [-3, hy + 5, -R, hy, -R * 0.8, hy - R * 0.9, 0, hy - R * 1.25, R * 0.85, hy - R * 0.85, R, hy + 0.5, 3, hy + 5], p.wood, { hl: 0.3, ow: 2 });
      crease(c, [-2, hy - 2, 1, hy - 5], 0.9, shade(p.wood, 0.4), 0.8);
      if (g === 1) for (const [x, y] of [[-R * 0.75, hy - 1], [R * 0.7, hy - 2], [0, hy - R * 1.1], [-2.4, hy - R * 0.7], [2.8, hy + 1.6]] as const) poly(c, [x - 1.2, y + 0.6, x + (x >= 0 ? 2.6 : -2.6) * 0.4, y - 2.4, x + 1.2, y + 0.4], p.metal, { ow: 1.1 });
    }
    if (p.r >= 1) lightGem(c, p, 0, hy - 1, 1.6, p.L);
    return;
  }
  // metal heads
  const n = g === 2 ? 4 : g === 3 ? 6 : g === 4 ? 6 : 8;
  const fl = [0, 0, 3.6, 4.6, 6.2, 6.2, 0][g];
  if (base) {
    if (g < 6) {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
        const r0 = R * 0.7, r1 = R + fl;
        const w = g === 4 ? 1.4 : g === 5 ? 1.1 : 2.2;
        const pts = g === 4
          ? [ca * r0 + px * w, hy + sa * r0 + py * w, ca * r1 + px * 0.2, hy + sa * r1 + py * 0.2, ca * (r1 - 2) - px * w * 1.4, hy + sa * (r1 - 2) - py * w * 1.4, ca * r0 - px * w, hy + sa * r0 - py * w]
          : [ca * r0 + px * w, hy + sa * r0 + py * w, ca * r1, hy + sa * r1, ca * r0 - px * w, hy + sa * r0 - py * w];
        poly(c, pts, i % 2 ? shade(p.metal, 0.06) : light(p.metal, 0.06), { ow: 1.5, hl: 0.2 });
      }
    }
    ball(c, 0, hy, R, R, g >= 4 ? p.dark : p.metal, { hl: 0.45 });
    rbox(c, -2.6, hy + R - 1.6, 5.2, 3, 1.2, p.trim, { ow: 1.4 });
    if (g >= 3) poly(c, [-1.6, hy - R + 0.6, 0, hy - R - 4.6, 1.6, hy - R + 0.6], light(p.metal, 0.1), { ow: 1.4 });
  }
  if (g >= 4) lightPoly(c, p, [0, hy - R * 0.62, R * 0.55, hy, 0, hy + R * 0.62, -R * 0.55, hy]);
  else if (p.r >= 1) lightGem(c, p, 0, hy, 2, p.L);
  if (p.sp && g < 4) lightLine(c, p, [-R * 0.5, hy, R * 0.5, hy], 1.1);
  if (g === 6) {
    // zenith: a core orb with six flanges hovering around it (a slow ring)
    if (base) for (let i = 0; i < 3; i++) crease(c, [-R * 0.9, hy + (i - 1) * 2.2, R * 0.9, hy + (i - 1) * 2.2], 0.6, p.edge, 0.4);
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * Math.PI * 2, r = R + 4.6;
      out.push(solidOf(p, Math.cos(a) * r, hy + Math.sin(a) * r, (q) => {
        q.save?.(); localXf(q, 0, 0, a + Math.PI / 2);
        poly(q, [-2.8, 3, 0, -6.2, 2.8, 3, 0, 1.4], p.metal, { ow: 1.5, hl: 0.3 });
        if (p.L) crease(q, [0, 1.4, 0, -3.6], 1.2, LIT(p), 1);
        if (p.edgeL) crease(q, [-2.8, 3, 0, -6.2, 2.8, 3], 0.9, light(p.edgeL, 0.3), 0.9);
        q.restore?.();
      }, 0.6, 0, 0, i, i % 2 ? p.L : 0, 7));
    }
  }
  edgeLight(c, p, [-R * 0.7, hy - R * 0.7, 0, hy - R, R * 0.7, hy - R * 0.7]);
}

// ─────────────────────────── staff ───────────────────────────

function staffFamily(c: Ctx, p: P, out: WFloat[]): void {
  const g = p.g, base = p.layer === 'base';
  const sTop = -36;
  if (base) {
    if (g === 0) { line(c, (q) => q.moveTo(0, 22).quadraticCurveTo(-1.6, 6, 0.6, -10).quadraticCurveTo(2, -24, -0.4, sTop - 4), p.rig ? 3 : 4.4, p.wood, 2); ball(c, -0.4, sTop - 5, 2.6, 2.2, shade(p.wood, 0.1), { ow: 1.6 }); for (const y of [-6, 9]) ball(c, 0.4, y, 1.4, 1.1, shade(p.wood, 0.25), { ow: 0 }); }
    else line(c, (q) => q.moveTo(0, 22).quadraticCurveTo(-0.8, 0, 0, sTop), p.rig ? 3 : 4.2, g >= 4 ? p.dark : p.wood, 2);
    if (g >= 1) for (const y of [20, sTop + 2]) rbox(c, -2.2, y - 1.2, 4.4, 2.4, 1, g <= 1 ? p.metal : p.trim, { ow: 1.3 });
    if (g >= 1) for (let i = 0; i < 3; i++) crease(c, [-1.4, 9 - i * 2.2, 1.4, 8 - i * 2.2], 1, p.wrap, 1);
  }
  // shaft runes (G4+): a channel down the staff
  if (g >= 4) lightLine(c, p, [0, 14, -0.3, -2, 0, sTop + 4], g >= 6 ? 1.3 : 1);
  const hy = -46;
  switch (g) {
    case 0: if (p.r >= 1) lightGem(c, p, -0.4, sTop - 5, 1.4, p.L); break;
    case 1: {
      if (base) line(c, (q) => q.moveTo(0, sTop).bezierCurveTo(-7, sTop - 4, -7, sTop - 14, 0, sTop - 14).bezierCurveTo(5, sTop - 14, 6, sTop - 9, 2.4, sTop - 7.6), 2.8, p.wood, 2);
      if (p.r >= 1) lightGem(c, p, 1, sTop - 9.6, 2, p.L);
      break;
    }
    case 2: {
      if (base) { for (const s of [1, -1]) line(c, (q) => q.moveTo(0, sTop).quadraticCurveTo(s * 6, sTop - 4, s * 3.2, sTop - 11.6), 2, p.trim, 1.6); ball(c, 0, sTop - 7, 3.4, 3.6, p.r >= 1 ? light(p.L || p.metal, 0.1) : 0x8a8a92, { hl: 0.5, ow: 1.7 }); }
      if (p.r >= 1) lightGem(c, p, 0, sTop - 7, 1.6, p.L);
      break;
    }
    case 3: {
      if (base) { line(c, (q) => q.moveTo(0, sTop).bezierCurveTo(-9, sTop - 4, -9, sTop - 17, 1, sTop - 17).bezierCurveTo(8, sTop - 17, 9, sTop - 9, 3, sTop - 7.6), 3, p.wood, 2); for (const y of [sTop - 3]) rbox(c, -2.6, y - 1.2, 5.2, 2.4, 1, p.trim, { ow: 1.3 }); line(c, (q) => q.moveTo(3, sTop - 7.6).lineTo(4, sTop - 2), 0.8, p.trim, 0.8, false); ball(c, 4, sTop - 1.4, 1.3, 1.6, p.trim, { ow: 1 }); }
      lightGem(c, p, 0.8, sTop - 10.4, 3, p.L || 0);
      break;
    }
    case 4: {
      if (base) for (const s of [1, -1]) poly(c, [s * 1, sTop + 1, s * 7.4, sTop - 7, s * 5.6, sTop - 16, s * 3.6, sTop - 8, s * 1, sTop - 4], p.metal, { ow: 1.6, hl: 0.3 });
      lightPoly(c, p, [0, sTop - 18, 3, sTop - 11, 0, sTop - 4, -3, sTop - 11]);
      break;
    }
    case 5: {
      if (base) { line(c, (q) => q.ellipse(0, hy + 1, 8.4, 9.4), 2.4, p.trim, 1.8); line(c, (q) => q.moveTo(0, sTop).lineTo(0, sTop - 1.6), 2, p.trim, 1.4); star(c, 0, hy - 9.8, 4, 3.4, 1.3, p.trim, 1.2); }
      out.push(solidOf(p, 0, hy + 1, (q) => { poly(q, [0, -5.6, 3.2, 0, 0, 5.6, -3.2, 0], p.L ? LIT(p) : p.edge, { ow: 1.5, hl: 0.6 }); }, 1.1, 0, 0.8, 0, p.L, 14));
      break;
    }
    default: {
      if (base) {
        // crescent halo head with an inner ring
        blob(c, [-2, sTop + 1, -9.6, sTop - 6, -11.4, hy - 4, -6.6, hy - 11, -4, hy - 6, -6.2, hy + 1, 0, sTop - 3, 6.2, hy + 1, 4, hy - 6, 6.6, hy - 11, 11.4, hy - 4, 9.6, sTop - 6, 2, sTop + 1], p.metal, { ow: 1.8, hl: 0.35 });
        line(c, (q) => q.ellipse(0, hy - 3, 4.6, 5.2), 1.4, p.trim, 1.2);
      }
      lightLine(c, p, [-8.8, sTop - 6, -9.4, hy - 4, -6.6, hy - 9], 1);
      lightLine(c, p, [8.8, sTop - 6, 9.4, hy - 4, 6.6, hy - 9], 1);
      out.push(solidOf(p, 0, hy - 3, (q) => { ball(q, 0, 0, 3.8, 3.8, p.L ? LIT(p) : p.edge, { hl: 0.7, ow: 1.4 }); }, 1, 0, 0, 0, p.L, 18));
      for (let i = 0; i < 2; i++) out.push(floatOf(p, 0, hy - 3, (q) => { poly(q, [0, -2.8, 1.4, 0, 0, 2.8, -1.4, 0], p.edge, { ow: 1.1, hl: 0.5 }); }, 0.6, 8.6, 1.4, i * Math.PI, p.L, 6));
    }
  }
  if (p.sp && g < 4) lightLine(c, p, [0, 6, 0, sTop + 2], 0.9, 0.7);
}

// ─────────────────────────── wand ───────────────────────────

function wandFamily(c: Ctx, p: P, out: WFloat[]): void {
  const g = p.g, base = p.layer === 'base';
  if (base) {
    const shaft = g === 0 ? p.wood : g === 1 ? 0xe8e0cc : g >= 4 ? p.dark : p.wood;
    line(c, (q) => (g === 0 ? q.moveTo(0, 4).quadraticCurveTo(1.2, -5, -0.4, -14) : q.moveTo(0, 4).lineTo(0, -14)), g >= 3 ? 2.4 : 2.1, shaft, 2);
    if (g === 0) for (const y of [-3, -9]) ball(c, 0.4, y, 0.9, 0.7, shade(p.wood, 0.3), { ow: 0 });
    if (g >= 1) { c.roundRect(-1.9, -0.6, 3.8, 4.4, 1.2); fill(c, g <= 1 ? shade(shaft, 0.2) : p.trim); c.roundRect(-1.9, -0.6, 3.8, 4.4, 1.2); outline(c, 1.3); }
  }
  const ty = -17.4;
  switch (g) {
    case 0: if (p.r >= 1) lightGem(c, p, -0.4, -14.6, 1.3, p.L); break;
    case 1: if (base) ball(c, 0, -15, 2, 2.2, 0xf2ead8, { ow: 1.3 }); if (p.r >= 1) lightGem(c, p, 0, -15, 1.1, p.L); break;
    case 2: if (base) rbox(c, -1.8, -15.4, 3.6, 2.6, 0.8, p.trim, { ow: 1.2 }); lightGem(c, p, 0, ty, 2.6, p.L || 0); break;
    case 3: if (base) for (const s of [1, -1]) line(c, (q) => q.moveTo(s * 1.2, -14).quadraticCurveTo(s * 4, -17, s * 1.4, -21), 1.1, p.trim, 1); lightGem(c, p, 0, ty - 0.6, 2.8, p.L || 0); break;
    case 4: if (base) for (const s of [1, -1]) poly(c, [s * 0.8, -13.6, s * 4.6, -18.6, s * 3, -22.4, s * 1.6, -17.6], p.metal, { ow: 1.3 }); lightPoly(c, p, [0, -23, 1.8, -18.6, 0, -14.6, -1.8, -18.6]); lightLine(c, p, [0, 2, 0, -12], 0.8); break;
    case 5: if (base) for (const s of [1, -1]) poly(c, [s * 0.8, -13.6, s * 4.2, -16, s * 2.4, -18], p.trim, { ow: 1.2 }); lightLine(c, p, [0, 2, 0, -12], 0.8);
      out.push(solidOf(p, 0, -21.6, (q) => star(q, 0, 0, 5, 4.4, 1.9, p.L ? LIT(p) : p.edge, 1.3), 1, 0, 1.2, 0, p.L, 12)); break;
    default:
      if (base) blob(c, [-1, -13.4, -5.6, -15.6, -6.8, -20.6, -3.6, -17.8, 0, -16.6, 3.6, -17.8, 6.8, -20.6, 5.6, -15.6, 1, -13.4], p.trim, { ow: 1.4, hl: 0.35 });
      lightLine(c, p, [0, 2, 0, -12], 1);
      out.push(solidOf(p, 0, -23.4, (q) => { poly(q, [0, -6.2, 2.2, 0, 0, 3.6, -2.2, 0], p.L ? LIT(p) : p.edge, { ow: 1.4, hl: 0.6 }); }, 1.2, 0, 0, 0, p.L, 14));
      out.push(floatOf(p, 0, -21.4, (q) => { ball(q, 0, 0, 1.2, 1.2, p.edge, { ow: 1 }); }, 0.4, 6.4, 1.8, 0, p.L, 5));
  }
  if (p.sp && g < 4) lightLine(c, p, [0, 2, 0, -12], 0.8, 0.7);
}

// ─────────────────────────── bows ───────────────────────────

function bowFamily(c: Ctx, p: P, rig: boolean, out: WFloat[]): void {
  const g = p.g, base = p.layer === 'base';
  const lw = (rig ? 3.6 : 2.8) + [0, 0.1, 0.3, 0.5, 0.6, 0.6, 0.4][g];
  const limb = (s: number, w: number, col: number) => line(c, (q) => {
    q.moveTo(-2.4, s * 21);
    if (g === 0) q.quadraticCurveTo(5.4, s * 11, 2.8, s * 1.6);
    else if (g <= 2) q.quadraticCurveTo(-1.4, s * 23, 0.6, s * 19.6).quadraticCurveTo(7, s * 10, 2.8, s * 1.6);
    else q.quadraticCurveTo(-3.4, s * 23.4, -0.2, s * 19).quadraticCurveTo(8.6, s * 10.6, 2.8, s * 1.6);
  }, w, col, 2);
  if (base) {
    const wood = g >= 4 ? p.dark : p.wood;
    for (const s of [1, -1]) limb(s, lw, rig ? light(wood, 0.1) : wood);
    if (g >= 3) for (const s of [1, -1]) line(c, (q) => { q.moveTo(-0.2, s * 19).quadraticCurveTo(8.6, s * 10.6, 2.8, s * 1.6); }, Math.max(1, lw * 0.35), p.trim, 0, false);
    rbox(c, 0.2, -4.6, 4.6, 9.2, 1.8, g === 0 ? p.wrap : p.trim, { ow: 1.7, hl: 0.3 });
    if (g >= 2) for (const s of [1, -1]) ball(c, -2.4, s * 21, 1.5, 1.5, g >= 3 ? p.trim : 0xece2cc, { ow: 1.1 });
    if (g >= 4) for (const s of [1, -1]) poly(c, [5.4, s * 7.4, 9.4, s * 9.6, 8.4, s * 13.4, 6.4, s * 10.6], p.metal, { ow: 1.4, hl: 0.3 }); // blade fins
    if (g >= 5) for (const s of [1, -1]) blob(c, [-1.6, s * 19.4, -6.6, s * 22, -8.6, s * 26.4, -4.4, s * 24.6, -1.2, s * 22.6], p.trim, { ow: 1.4, hl: 0.35 });
  }
  // light follows the limb's own curve (sampled from the same quadratic as the drawing)
  const limbPts = (s: number, t0: number, t1: number) => {
    const [x0, y0, cx, cy, x1, y1] = g <= 2 ? [0.6, s * 19.6, 7, s * 10, 2.8, s * 1.6] : [-0.2, s * 19, 8.6, s * 10.6, 2.8, s * 1.6];
    const o: number[] = [];
    for (let i = 0; i <= 6; i++) { const t = t0 + (t1 - t0) * (i / 6), u = 1 - t; o.push(u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1); }
    return o;
  };
  if (g >= 4) for (const s of [1, -1]) lightLine(c, p, limbPts(s, 0.12, 0.82), 1.1);
  else if (p.r >= 1 || p.sp) for (const s of [1, -1]) lightLine(c, p, limbPts(s, 0.45, 0.8), p.sp ? 1 : 0.8, 0.8);
  lightGem(c, p, 2.5, 0, g >= 4 ? 2 : 1.5, p.L || 0);
  if (p.edgeL) for (const s of [1, -1]) edgeLight(c, p, limbPts(s, 0, 0.9));
  if (g >= 5) out.push(floatOf(p, 8.4, 0, (q) => poly(q, [0, -3.6, 2.2, 0, 0, 3.6, -2.2, 0], p.L ? LIT(p) : p.edge, { ow: 1.3, hl: 0.6 }), 1, 0, 0, 0, p.L, 11));
  if (g === 6) for (const s of [1, -1]) out.push(solidOf(p, 10.6, s * 15.6, (q) => {
    blob(q, [-2, s * -3.4, 3.4, s * -1.2, 5.2, s * 3, 1.4, s * 2, -2.2, s * 1.2], p.metal, { ow: 1.4, hl: 0.4 });
    if (p.L) crease(q, [-0.8, s * -1.6, 3, s * 1.2], 1, LIT(p), 1);
  }, 0.8, 0, 0, s > 0 ? 0 : 2, p.L, 8));
}

function crossbowFamily(c: Ctx, p: P, hand: boolean, out: WFloat[]): void {
  const g = p.g, base = p.layer === 'base';
  const k = hand ? 0.7 : 1;
  const sy0 = (hand ? 5 : 8), sy1 = (hand ? -14 : -24), py = (hand ? -9 : -16), pw = (hand ? 8.4 : 12) * (1 + g * 0.05);
  if (base) {
    rbox(c, -2.8 * k, sy1, 5.6 * k, sy0 - sy1, 2, g >= 4 ? p.dark : p.wood, { hl: 0.3 });
    if (g >= 2) for (const y of [sy1 + 2, py + 3]) rbox(c, -3.1 * k, y - 1, 6.2 * k, 2, 0.8, p.trim, { ow: 1.1 });
    // prod
    const arc = (dy: number, w: number, col: number) => line(c, (q) => q.moveTo(-pw, py + 4 * k + dy).quadraticCurveTo(0, py - 8 * k + dy, pw, py + 4 * k + dy), w, col, 2);
    if (g === 0) { arc(0, 2.2, p.wood); for (const s of [1, -1]) crease(c, [s * 2.6 * k, py - 2, s * 3.4 * k, py - 0.4], 1.2, p.wrap, 1); }
    else arc(0, 2.6 + g * 0.15, g >= 3 ? p.trim : p.metal);
    if (g >= 5) arc(-3.2 * k, 2, p.metal); // stacked prod
    if (g >= 3) for (const s of [1, -1]) poly(c, [s * pw, py + 4 * k, s * (pw + 3.4 * k), py + 0.4 * k, s * (pw + 1.2 * k), py + 5.6 * k], p.trim, { ow: 1.2 });
    line(c, (q) => q.moveTo(-pw + 0.4, py + 3.4 * k).lineTo(0, py + 7 * k).lineTo(pw - 0.4, py + 3.4 * k), 0.8, 0xe8dcc0, 1, false);
    seg(c, 0, py + 6 * k, 0, sy1 - 3 * k, 1.3, g >= 4 ? p.dark : 0x8a6a4a, 1.1, false);
    poly(c, [-1.6, sy1 - 3 * k, 0, sy1 - 6.4 * k, 1.6, sy1 - 3 * k], g >= 4 ? (p.L ? LIT(p) : p.edge) : 0xc8ccd2, { ow: 1.2 });
    rbox(c, -3.4 * k, -3.4, 6.8 * k, 4, 1.2, p.trim, { ow: 1.5, hl: 0.3 });
    if (g >= 3 && !hand) { ball(c, 3.6, 2.4, 2.6, 2.6, p.trim, { ow: 1.3 }); c.circle(3.6, 2.4, 0.9); fill(c, OUT); }
  }
  if (g >= 4) lightLine(c, p, [0, sy0 - 3, 0, py + 6 * k], 1.1);
  else if (p.r >= 1) lightLine(c, p, [0, sy0 - 3, 0, sy0 - 9 * k], 0.8, 0.8);
  if (g >= 4) for (const s of [1, -1]) lightLine(c, p, [s * pw * 0.25, py - 3.4 * k, s * pw * 0.6, py - 1.4 * k, s * pw * 0.85, py + 1.8 * k], 1);
  lightGem(c, p, 0, py + 1, g >= 4 ? 1.9 * k : 1.4 * k, p.L || 0);
  if (p.sp && g < 4) lightLine(c, p, [0, sy0 - 3, 0, py + 6 * k], 1);
  edgeLight(c, p, [-pw, py + 4 * k, 0, py - 4 * k, pw, py + 4 * k]);
  if (g >= 5) out.push(floatOf(p, 0, sy1 - 9 * k, (q) => poly(q, [0, -3.4, 2, 0, 0, 3.4, -2, 0], p.L ? LIT(p) : p.edge, { ow: 1.2, hl: 0.6 }), 1, 0, 0, 0, p.L, 10));
  if (g === 6) for (const s of [1, -1]) out.push(solidOf(p, s * (pw + 5 * k), py - 2 * k, (q) => {
    blob(q, [0, -3, s * 4.6, -4.4, s * 6, 0.6, s * 2, 2.2], p.metal, { ow: 1.3, hl: 0.4 });
    if (p.L) crease(q, [s * 0.8, -1.4, s * 4.4, -0.6], 1, LIT(p), 1);
  }, 0.8, 0, 0, s > 0 ? 0 : 2, p.L, 8));
}

// ─────────────────────────── off-hands ───────────────────────────

/** Shield outline by generation ([] = the round G0 buckler): buckler → kite → tower → heater → faceted → winged → zenith
 *  centre plate (its side plates float). Shared with the shield's back view (heroParts.ts). */
export function shieldOutline(g: number): number[] {
  switch (g) {
    case 0: return [];
    case 1: return [-10.2, -11.4, 10.2, -11.4, 10.2, 0, 0, 13.6, -10.2, 0];
    case 2: return [-9.6, -13.8, 9.6, -13.8, 10, 11, 0, 14.6, -10, 11];
    case 3: return [-11, -12.4, 11, -12.4, 10.6, 1, 0, 15.4, -10.6, 1];
    case 4: return [-11.6, -12, -6, -14.6, 6, -14.6, 11.6, -12, 10.8, 3, 0, 16, -10.8, 3];
    case 5: return [-14.6, -15.4, -9, -12.6, 9, -12.6, 14.6, -15.4, 11.4, 2, 0, 16.6, -11.4, 2];
    default: return [-7.6, -13.6, 7.6, -13.6, 8, 4, 0, 17.4, -8, 4];
  }
}

function shieldFamily(c: Ctx, p: P, out: WFloat[]): void {
  const g = p.g, base = p.layer === 'base', v = p.v;
  const HERALD = [0x9a3b30, 0x2f5a8a, 0x8a6236, 0x3f6a3a];
  const face = p.sp ? p.look.primary : p.r === 1 ? 0x34509e : p.r === 2 ? 0x7a2420 : HERALD[v];
  const rim = g <= 1 ? p.metal : p.trim;
  const emb = p.L ? LIT(p) : g >= 3 ? light(p.trim, 0.3) : 0xe6d6ae;
  const outer = shieldOutline(g);
  if (base) {
    if (g === 0) {
      ball(c, 0, 0, 12, 12, p.wood, { hl: 0.3 });
      if (!inSilhouette()) { for (const x of [-4.4, 0, 4.4]) { c.moveTo(x, -11.2).lineTo(x, 11.2); } c.stroke({ width: 1, color: shade(p.wood, 0.4), alpha: 0.8 }); }
      line(c, (q) => q.ellipse(0, 0, 12, 12), 1.6, p.wrap, 1.4, false);
      ball(c, 0, 0, 3.6, 3.6, p.metal, { ow: 1.5, hl: 0.5 });
    } else {
      poly(c, outer, rim, { hl: 0 });
      const inner = shrink(outer, 0.78);
      poly(c, inner, face, { ow: 1.4, hl: 0.22 });
      if (v === 1 || g === 2) { c.rect(-1.5, -8.4, 3, 15); fill(c, emb); c.rect(-6.6, -3.6, 13.2, 3); fill(c, emb); }
      else if (v === 2) { c.poly([-6, -8, 0, -2.4, 6, -8, 6, -4, 0, 2, -6, -4], true); fill(c, emb); }
      else star(c, 0, -0.6, 5, 5.6, 2.4, emb, 1.2);
      c.poly(outer, true); outline(c, 2.4);
      if (g >= 2) for (let i = 0; i < outer.length; i += 2) rivet(c, outer[i] * 0.89, outer[i + 1] * 0.89, 0.8);
    }
  }
  if (g >= 4) lightLine(c, p, shrink(outer, 0.86).concat(shrink(outer, 0.86).slice(0, 2)), 1);
  lightGem(c, p, 0, g === 0 ? 0 : -6, g >= 4 ? 2.6 : 2, p.L || 0);
  if (g === 6) for (const s of [1, -1]) out.push(solidOf(p, s * 12.4, -1, (q) => {
    const pl = [s * -3, -12, s * 3.6, -14.4, s * 4.6, 6, s * -2.4, 12.4];
    poly(q, pl, p.trim, { ow: 1.8, hl: 0.35 });
    if (p.L) crease(q, [s * 0.2, -9, s * 1.2, 4], 1.2, LIT(p), 1);
  }, 0.7, 0, 0, s > 0 ? 0 : 2, p.L, 12));
}

function quiverFamily(c: Ctx, p: P, out: WFloat[]): void {
  const g = p.g, base = p.layer === 'base';
  const feather = [0xf2ead8, 0xd8463a, 0xf2ead8, 0x5aa0d8][p.v];
  const n = 2 + Math.min(3, Math.floor((g + 1) / 2));
  if (base) {
    for (let i = 0; i < n; i++) {
      const x = -3.6 + (7.2 * i) / Math.max(1, n - 1), y = -16 - (i % 2) * 2;
      seg(c, x * 0.6, -8, x, y + 2, 1, 0x8a6a4a, 0.9, false);
      poly(c, [x - 2, y + 4, x, y - 3, x + 2, y + 4, x, y + 2.4], g >= 4 && p.L ? LIT(p) : feather, { ow: 1.4 });
    }
    rbox(c, -4.8, -10, 9.6, 22, 3.4, g === 0 ? p.wood : g >= 4 ? p.dark : p.wrap, { hl: 0.25 });
    c.roundRect(-5.2, -10.6, 10.4, 3.2, 1.4); fill(c, g <= 1 ? p.metal : p.trim); c.roundRect(-5.2, -10.6, 10.4, 3.2, 1.4); outline(c, 1.6);
    if (g >= 2) { c.roundRect(-4.8, 5, 9.6, 2.2, 0.8); fill(c, p.trim); }
    if (g >= 3) for (const y of [-4, 1]) rivet(c, -2.6, y, 0.8, light(p.trim, 0.3));
  }
  if (g >= 4) lightLine(c, p, [1.8, -6, 1.8, 9], 1); else if (p.r >= 1) lightLine(c, p, [1.8, -5, 1.8, 2], 0.8, 0.8);
  lightGem(c, p, 0, 0, g >= 4 ? 2 : 1.6, p.L || 0);
  if (g >= 5) out.push(floatOf(p, 6.6, -14, (q) => { poly(q, [0, -4.4, 1.4, 1, 0, 3, -1.4, 1], p.L ? LIT(p) : p.edge, { ow: 1.2, hl: 0.5 }); }, 1, 0, 0, 0, p.L, 8));
}

function orbFamily(c: Ctx, p: P, out: WFloat[]): void {
  const g = p.g, base = p.layer === 'base';
  const core = p.L ? mix(p.look.primary, p.L, 0.3) : g === 0 ? 0x8a8478 : p.look.primary;
  if (base) {
    if (g === 3) { poly(c, [0, -7.6, 6.6, -2.6, 5, 6, -5, 6, -6.6, -2.6], core, { hl: 0.5, ow: 2 }); crease(c, [0, -7.6, 0, 6, -6.6, -2.6, 6.6, -2.6], 0.8, light(core, 0.5), 0.8); }
    else {
      ball(c, 0, 0, 7, 7, core, { hl: 0, inset: 0.84, sh: 0.4 });
      if (g >= 2) wash(c, (k) => k.moveTo(-4, 2).quadraticCurveTo(0, -5, 4.6, -1).quadraticCurveTo(0, -2, -4, 2), 0xffffff, 0.45);
      c.circle(0, 0, 7); outline(c, 2.2);
    }
    if (g >= 1 && g !== 3) { c.ellipse(-2.6, -3.4, 2.2, 1.4); fill(c, 0xffffff, g === 1 ? 0.4 : 0.8); }
    if (g >= 4) line(c, (q) => q.ellipse(0, 0, 10.4, 3.4), 1.4, p.trim, 1.2, false); // rune ring
    if (g >= 5) { // a crescent cage hugging the orb, with a finial
      for (const s of [1, -1]) line(c, (q) => q.moveTo(s * 3, 8.6).quadraticCurveTo(s * 11.6, 2, s * 3.4, -9.4), 1.6, p.trim, 1.3);
      poly(c, [-1.6, -8.6, 0, -13.4, 1.6, -8.6], p.trim, { ow: 1.2 });
    }
  }
  if (g >= 2 || p.r >= 1) lightGem(c, p, 0, 0, g >= 4 ? 3 : 2, p.L || 0);
  if (g === 6) for (let i = 0; i < 3; i++) out.push(floatOf(p, 0, 0, (q) => { poly(q, [0, -2.6, 1.4, 0, 0, 2.6, -1.4, 0], p.edge, { ow: 1.1, hl: 0.5 }); }, 0.6, 11, 1.6, (i / 3) * Math.PI * 2, p.L, 5));
}

// ─────────────────────────── signatures (legendary bundles) ───────────────────────────

/** Anchors a family exposes to signature decorators (weapon frame). */
interface Anchors { tip: [number, number]; head: [number, number, number]; spine: number[] }

function anchorsOf(fam: WeaponFamily): Anchors {
  switch (fam) {
    case 'blade': return { tip: [0, -31], head: [0, -20, 5], spine: [0, -8, 0, -27] };
    case 'greatblade': return { tip: [0, -48], head: [0, -30, 6], spine: [0, -11, 0, -42] };
    case 'axe': return { tip: [0, -27], head: [9, -20.6, 7], spine: [10, -26, 12, -15] };
    case 'greataxe': return { tip: [0, -50], head: [14, -36, 11], spine: [17, -46, 18, -27] };
    case 'mace': return { tip: [0, -27], head: [0, -20.6, 7], spine: [0, -14, 0, -27] };
    case 'staff': return { tip: [0, -55], head: [0, -46, 8], spine: [0, 16, 0, -34] };
    case 'wand': return { tip: [0, -21], head: [0, -17.6, 4], spine: [0, 2, 0, -13] };
    case 'bow': return { tip: [-2.4, -21], head: [3, 0, 6], spine: [2.6, -16, 6, -8, 2.8, 0, 6, 8, 2.6, 16] };
    case 'crossbow': return { tip: [0, -30], head: [0, -16, 9], spine: [0, 5, 0, -22] };
    case 'handxbow': return { tip: [0, -19], head: [0, -9, 6], spine: [0, 3, 0, -13] };
    case 'shield': return { tip: [0, -13], head: [0, 0, 11], spine: [0, -9, 0, 9] };
    case 'quiver': return { tip: [0, -18], head: [0, -14, 5], spine: [1.8, -6, 1.8, 9] };
    default: return { tip: [0, -8], head: [0, 0, 7], spine: [-4, 0, 4, 0] };
  }
}

/** Signature parts on top of the family drawing (both layers) + motif floaters. */
function signature(c: Ctx, p: P, fam: WeaponFamily, out: WFloat[]): void {
  if (!p.sig) return;
  const A = anchorsOf(fam), [hx, hy, hr] = A.head, [tx, ty] = A.tip, base = p.layer === 'base';
  const L = p.L || 0xffa040;
  const n = Math.max(1, Math.min(3, p.s.floats));
  const token = (draw: (q: Ctx) => void, glowR = 8) => {
    for (let i = 0; i < n; i++) out.push(floatOf(p, hx, hy, draw, 0.8, hr + 6 + (i % 2) * 2, 1.1 + i * 0.25, (i / n) * Math.PI * 2, L, glowR));
  };
  switch (p.sig) {
    case 'flame': {
      // flame tongues licking off the business end
      const tongues = [[-0.5, 1], [0.4, 1.25], [1.2, 0.9]];
      for (const [dx, hk] of tongues) {
        const x = tx + dx * hr * 0.6, y = ty + hr * 0.3;
        const f = [x - 2.2, y + 3, x - 1.6, y - 3 * hk, x + dx * 1.5, y - 8.6 * hk, x + 1.8, y - 3.4 * hk, x + 2.4, y + 3];
        if (base) blob(c, f, mix(L, 0xff4a1a, 0.35), { ow: 1.3, hl: 0.35 });
        lightPoly(c, { ...p, L }, shrink(f, 0.55));
      }
      token((q) => blob(q, [-1.6, 1.6, -1, -1.6, 0.2, -4, 1.4, -1.6, 1.6, 1.6], light(L, 0.3), { ow: 1, hl: 0.4 }), 7);
      break;
    }
    case 'storm': {
      const sp = A.spine;
      const zig: number[] = [];
      for (let i = 0; i <= 6; i++) { const t = i / 6; const x = sp[0] + (sp[sp.length - 2] - sp[0]) * t, y = sp[1] + (sp[sp.length - 1] - sp[1]) * t; zig.push(x + (i % 2 ? 2 : -2), y); }
      lightLine(c, { ...p, L }, zig, 1.2);
      if (base) for (const s of [1, -1]) poly(c, [tx, ty + 4, tx + s * 5.6, ty - 2.4, tx + s * 1.6, ty + 1], p.metal, { ow: 1.3 });
      token((q) => spark(q, 0, 0, 3.6, light(L, 0.4)), 8);
      break;
    }
    case 'gale': {
      if (base) for (let i = 0; i < 3; i++) { const y = hy + (i - 1) * hr * 0.6; blob(c, [hx - hr * 0.6, y + 2, hx - hr * 1.2, y - 3, hx - hr * 1.9 - i, y - 6.6, hx - hr * 0.9, y - 1.6], light(p.metal, 0.12), { ow: 1.3, hl: 0.3 }); }
      lightLine(c, { ...p, L }, [hx - hr * 0.8, hy - hr * 0.6, hx - hr * 1.6, hy - hr * 1.2], 0.9);
      out.push(floatOf(p, hx, hy, (q) => { line(q, (k) => k.ellipse(0, 0, 6, 2.2), 1.2, light(L, 0.4), 0, false); }, 0.4, 0, 2.4, 0, L, 12));
      break;
    }
    case 'fault': {
      const cr = [hx - hr * 0.4, hy - hr * 0.7, hx + hr * 0.1, hy - hr * 0.2, hx - hr * 0.2, hy + hr * 0.2, hx + hr * 0.3, hy + hr * 0.7];
      lightLine(c, { ...p, L }, cr, 1.1);
      token((q) => poly(q, [-2.6, 1.4, -1.6, -2, 1.2, -2.6, 2.6, 0.6, 0.4, 2.4], 0x7a6a58, { ow: 1.2, hl: 0.3 }), 7);
      break;
    }
    case 'blood': {
      if (base) { const sp = A.spine; for (let i = 0; i < 5; i++) { const t = 0.15 + i * 0.16; const x = sp[0] + (sp[2] - sp[0]) * t + hr * 0.75, y = sp[1] + (sp[3] - sp[1]) * t; poly(c, [x - 0.6, y + 1.6, x + 2.4, y, x - 0.6, y - 1.6], p.metal, { ow: 1 }); } }
      lightLine(c, { ...p, L }, A.spine.slice(0, 4), 1.1);
      token((q) => poly(q, [0, -3, 1.8, 0.6, 0, 2.6, -1.8, 0.6], 0xd8202a, { ow: 1, hl: 0.5 }), 6);
      break;
    }
    case 'rain': {
      if (base) for (const s of [1, -1]) { line(c, (q) => q.moveTo(hx + s * hr * 0.6, hy).lineTo(hx + s * hr * 0.8, hy + 6), 0.7, 0xcfd8e8, 0, false); }
      for (const s of [1, -1]) lightGem(c, { ...p, L }, hx + s * hr * 0.8, hy + 7.4, 1.4, L);
      token((q) => poly(q, [0, -3.4, 1.8, 0.8, 0, 2.6, -1.8, 0.8], light(L, 0.25), { ow: 1, hl: 0.6 }), 7);
      break;
    }
    case 'lantern': {
      if (base) { line(c, (q) => q.moveTo(hx + hr * 0.5, hy).quadraticCurveTo(hx + hr + 2, hy + 1, hx + hr + 2, hy + 4), 0.8, 0x3a2a1c, 0.8, false); blob(c, [hx - hr * 0.4, hy, hx - hr * 1.2, hy - 4, hx - hr * 1.8, hy - 2, hx - hr * 1.1, hy + 1.4], 0x5f9a45, { ow: 1.2 }); }
      lightGem(c, { ...p, L: 0xffd27a }, hx + hr + 2, hy + 6.4, 2.2, 0xffd27a);
      token((q) => ball(q, 0, 0, 1.8, 2.2, 0xffd27a, { ow: 1, hl: 0.5 }), 9);
      break;
    }
    case 'leaf': {
      if (base) { const sp = A.spine; line(c, (q) => { q.moveTo(sp[0], sp[1]); for (let i = 1; i <= 8; i++) { const t = i / 8; q.lineTo(sp[0] + (sp[2] - sp[0]) * t + Math.sin(i * 1.6) * 2.2, sp[1] + (sp[3] - sp[1]) * t); } }, 1, 0x4f8a3a, 0.9, false); for (let i = 0; i < 3; i++) { const t = 0.2 + i * 0.3, x = sp[0] + (sp[2] - sp[0]) * t, y = sp[1] + (sp[3] - sp[1]) * t; blob(c, [x, y, x + 3.6, y - 2, x + 5, y + 0.6, x + 2, y + 1.6], 0x6faf4a, { ow: 1 }); } }
      token((q) => blob(q, [-2.4, 0, 0, -2, 2.6, 0, 0, 1.6], 0x8fcf5a, { ow: 1, hl: 0.3 }), 6);
      break;
    }
    case 'void': {
      lightPoly(c, { ...p, L }, [hx, hy - hr * 0.6, hx + hr * 0.42, hy, hx, hy + hr * 0.6, hx - hr * 0.42, hy]);
      if (base && !inSilhouette()) { c.circle(hx, hy, hr * 0.26).fill({ color: 0x120818, alpha: 1 }); }
      token((q) => poly(q, [0, -3.4, 1.4, 0, 0, 3.4, -1.4, 0], 0x2a1838, { ow: 1.1, hl: 0.3 }), 8);
      break;
    }
    case 'arcane': {
      out.push(floatOf(p, hx, hy, (q) => { line(q, (k) => k.ellipse(0, 0, hr + 3, (hr + 3) * 0.34), 1.2, light(L, 0.3), 0, false); for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; q.circle(Math.cos(a) * (hr + 3), Math.sin(a) * (hr + 3) * 0.34, 0.9).fill({ color: 0xffffff }); } }, 0.6, 0, 0.5, 0, L, hr * 2));
      token((q) => star(q, 0, 0, 4, 2.6, 1, light(L, 0.35), 1), 6);
      break;
    }
    case 'holy': {
      out.push(floatOf(p, tx, ty + 2, (q) => { line(q, (k) => k.ellipse(0, 0, 6.4, 6.4), 1.4, 0xfff0b0, 1, false); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; q.moveTo(Math.cos(a) * 7.4, Math.sin(a) * 7.4).lineTo(Math.cos(a) * 9.6, Math.sin(a) * 9.6); } q.stroke({ width: 1, color: 0xfff6d0, alpha: 0.9 }); }, 0.6, 0, 0.3, 0, 0xfff3b0, 16));
      break;
    }
    case 'cog': {
      if (base) { const r = Math.max(2.6, hr * 0.45); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; c.rect(hx - hr * 0.6 + Math.cos(a) * r - 1, hy + Math.sin(a) * r - 1, 2, 2); } fill(c, 0xc9a24a); ball(c, hx - hr * 0.6, hy, r, r, 0xb08a3a, { ow: 1.2, hl: 0.4 }); }
      token((q) => { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; q.rect(Math.cos(a) * 2.6 - 0.8, Math.sin(a) * 2.6 - 0.8, 1.6, 1.6); } fill(q, 0xffc94a); ball(q, 0, 0, 2.4, 2.4, 0xc9a24a, { ow: 1, hl: 0.4 }); }, 7);
      break;
    }
    case 'frost': {
      if (base) for (let i = 0; i < 3; i++) { const x = hx + (i - 1) * hr * 0.5, y = hy - hr * 0.7; poly(c, [x - 1.4, y + 2, x, y - 5 - (i === 1 ? 2 : 0), x + 1.4, y + 2], 0xd8f4ff, { ow: 1.1, hl: 0.5 }); }
      token((q) => poly(q, [0, -3.6, 1.2, 0, 0, 3.6, -1.2, 0], 0xe8faff, { ow: 1, hl: 0.6 }), 7);
      break;
    }
    case 'star': {
      if (base) star(c, tx, ty - 2, 5, 4.6, 2, light(L, 0.3), 1.3);
      token((q) => star(q, 0, 0, 5, 3, 1.2, light(L, 0.4), 1), 7);
      break;
    }
    default: {
      token((q) => poly(q, [0, -3, 1.6, 0, 0, 3, -1.6, 0], light(L, 0.25), { ow: 1, hl: 0.5 }), 6);
    }
  }
}

// ─────────────────────────── item grades: Kindled ember, Fabled inscription ───────────────────────────

/** Where the ember sits on each family (on the grip just below the business end). */
function emberSpot(fam: WeaponFamily): [number, number] {
  switch (fam) {
    case 'blade': return [0, 1.6];
    case 'greatblade': return [0, 3.4];
    case 'axe': return [0, -9];
    case 'greataxe': return [0, -18];
    case 'mace': return [0, -10];
    case 'staff': return [0, -28];
    case 'wand': return [0, -9.6];
    case 'bow': return [2.5, 7.4];
    case 'crossbow': return [0, -6];
    case 'handxbow': return [0, -4.6];
    case 'shield': return [0, 8.4];
    case 'quiver': return [0, 6.4];
    default: return [0, 9];
  }
}

/** Kindled (grade 1, and Fabled, which keeps its kindled affix): an ember set in a small iron cage, glowing, with an
 *  ember mote. Fabled (grade 2): an Inscription ring of glyphs orbits the business end, with starlight glints. */
function gradeMarks(c: Ctx, p: P, fam: WeaponFamily, out: WFloat[], ember: number): void {
  if (!p.top) return;
  const [ex, ey] = emberSpot(fam), base = p.layer === 'base';
  if (base) {
    ball(c, ex, ey, 2.1, 2.1, 0x2a1a14, { ow: 1.2 });
    ball(c, ex, ey + 0.2, 1.5, 1.4, ember, { ow: 0, hl: 0.5 });
    if (!inSilhouette()) { c.moveTo(ex - 2.1, ey).lineTo(ex + 2.1, ey).moveTo(ex, ey - 2.1).lineTo(ex, ey + 2.1); c.stroke({ width: 0.7, color: 0x2a1a14, alpha: 0.9 }); }
  } else lightGem(c, { ...p, L: ember }, ex, ey, 1.6, ember);
  out.push(floatOf(p, ex, ey - 3, (q) => blob(q, [-1.2, 1.2, -0.8, -1.2, 0.2, -3, 1, -1.2, 1.2, 1.2], light(ember, 0.25), { ow: 0.9, hl: 0.4 }), 1.6, 0, 0, 0.7, ember, 6));
  if (p.top < 2) return;
  const [hx, hy, hr] = anchorsOf(fam).head;
  const R = hr + 6;
  out.push(solidOf(p, hx, hy, (q) => {
    line(q, (k) => k.ellipse(0, 0, R, R * 0.36), 1.1, 0xfff0c4, 0.8, false);
    if (!inSilhouette()) {
      // glyphs: short original strokes set around the ring
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2, x = Math.cos(a) * R, y = Math.sin(a) * R * 0.36;
        q.moveTo(x - 0.9, y - 1).lineTo(x + 0.6, y + 0.2).moveTo(x - 0.2, y - 1.4).lineTo(x + 0.9, y - 0.4);
      }
      q.stroke({ width: 0.8, color: 0x9cc4ff, alpha: 0.95, cap: 'round' });
    }
  }, 0.4, 0, 0.6, 0, 0xfff0c4, R * 2));
  for (let i = 0; i < 2; i++) out.push(floatOf(p, hx, hy, (q) => spark(q, 0, 0, 2.6, 0xffffff), 0.5, R + 1, 1.2, i * Math.PI, 0xbcd6ff, 6));
}

// ─────────────────────────── bespoke legendaries ───────────────────────────

/** Fully bespoke drawings (registry `bespoke`): they replace the family drawing but keep its reach and anchors. */
const BESPOKE: Record<string, (c: Ctx, p: P, out: WFloat[]) => void> = {
  /** The Ninefold Gale (great axe): nine swept wind blades fanned around a hub, a storm-eye core. */
  ninefold_gale: (c, p, out) => {
    const base = p.layer === 'base', hy = -36, L = p.L || 0x9fe3ff;
    if (base) { line(c, (q) => q.moveTo(0, 11).lineTo(0, -46), 3.2, p.dark, 2); for (let i = 0; i < 3; i++) crease(c, [-1.6, 6 - i * 2.4, 1.6, 5 - i * 2.4], 1.1, p.trim, 1); }
    // the axe grows into its name: 5 wind blades early, 7 from G2, all nine from runesteel (G4) on, longer each step
    const nb = p.g >= 4 ? 9 : p.g >= 2 ? 7 : 5;
    for (let i = 0; i < nb; i++) {
      const a = -Math.PI * 0.95 + (i / (nb - 1)) * Math.PI * 1.9, side = Math.cos(a) >= 0 ? 1 : -1;
      const r0 = 5, r1 = 10.4 + p.g * 0.8 + (i % 3) * 2.6;
      const ax = Math.cos(a), ay = Math.sin(a), px = -ay, py = ax;
      const f = [ax * r0 + px * 2, hy + ay * r0 + py * 2, ax * r1 + px * 4 * side, hy + ay * r1 + py * 4 * side, ax * (r1 + 3), hy + ay * (r1 + 3) - 1, ax * r0 - px * 1.4, hy + ay * r0 - py * 1.4];
      if (base) poly(c, f, i % 2 ? light(p.metal, 0.08) : p.metal, { ow: 1.5, hl: 0.3 });
      lightLine(c, { ...p, L }, [ax * (r0 + 1.6), hy + ay * (r0 + 1.6), ax * (r1 - 1), hy + ay * (r1 - 1) + 0.6], 0.8, 0.8);
    }
    if (base) ball(c, 0, hy, 5.4, 5.4, p.trim, { ow: 1.8, hl: 0.4 });
    lightPoly(c, { ...p, L }, [0, hy - 3.4, 3, hy, 0, hy + 3.4, -3, hy]);
    if (base) poly(c, [-1.8, -46, 0, -53, 1.8, -46], light(p.metal, 0.2), { ow: 1.4 });
    out.push(floatOf(p, 0, hy, (q) => { line(q, (k) => k.ellipse(0, 0, 21, 7.4), 1.3, light(L, 0.45), 0, false); }, 0.3, 0, 1.8, 0, L, 34));
    for (let i = 0; i < 2 + p.top; i++) out.push(floatOf(p, 0, hy, (q) => { line(q, (k) => k.moveTo(-3.6, 0).quadraticCurveTo(0, -1.6, 3.6, 0), 1.2, light(L, 0.4), 0, false); }, 0.4, 22, 2.6, (i / 2) * Math.PI, L, 8));
  },
  /** Bloodwake (sword): a crimson hooked blade with a wake of serrations and a blood channel. */
  bloodwake: (c, p, out) => {
    const base = p.layer === 'base', L = p.L || 0xff3b3b;
    grip(c, p, 3.6, -4, 2.8); pommel(c, p, 5.4, 1.05);
    const right = [3.4, -5.8, 3.8, -12, 5.4, -14, 3.8, -16.6, 5.6, -19.4, 3.6, -22, 5, -25.4, 1.6, -31];
    const left = [-1, -31, -3.4, -27, -3.6, -6];
    const blade = [...right, ...left];
    if (base) {
      poly(c, blade, p.metal, { hl: 0, inset: 0.82, px: -0.4 });
      wash(c, (k) => k.poly([0.4, -6, 3.4, -6, 5, -25, 1.4, -30.4], true), p.edge, 0.4);
      c.poly(blade, true); outline(c, 2.2);
      poly(c, [1.6, -31, 4.6, -33.6, 3.2, -29.6], p.metal, { ow: 1.3 }); // wake hook
    }
    lightLine(c, { ...p, L }, [0, -7, 0.4, -18, 0.6, -28], 1.4);
    // the wake of serrations lengthens with the generation (1 → 4 teeth)
    if (base) for (const y of [-11, -16, -21, -26].slice(0, 1 + Math.floor(p.g / 2))) poly(c, [3.4, y, 6.6, y - 1.8, 3.4, y - 3], shade(p.metal, 0.1), { ow: 1.1 });
    guard(c, { ...p, g: Math.max(4, p.g) }, -5, 1, 3.6);
    edgeLight(c, p, right);
    for (let i = 0; i < Math.max(1, p.s.floats); i++) out.push(floatOf(p, 4, -20 - i * 4, (q) => poly(q, [0, -2.6, 1.6, 0.6, 0, 2.4, -1.6, 0.6], 0xc8141e, { ow: 1, hl: 0.5 }), 1.4, 0, 0, i * 1.7, L, 6));
  },
  /** Cindervane (staff): a weather-vane head whose vane is a sheet of fire, an ember arrow pointing the wind. */
  cindervane: (c, p, out) => {
    const base = p.layer === 'base', L = p.L || 0xff8a3a, sTop = -36;
    if (base) { line(c, (q) => q.moveTo(0, 22).quadraticCurveTo(-0.8, 0, 0, -50), 3, p.dark, 2); for (const y of [20, sTop + 2]) rbox(c, -2.2, y - 1.2, 4.4, 2.4, 1, p.trim, { ow: 1.3 }); }
    lightLine(c, { ...p, L }, [0, 14, -0.3, -2, 0, sTop + 4], 1.1);
    // cross-arms of the vane
    if (base) { seg(c, -9, -42, 9, -42, 1.4, p.trim, 1.2); for (const s of [1, -1]) ball(c, s * 9.6, -42, 1.5, 1.5, p.trim, { ow: 1 }); }
    // the fire vane
    // the fire vane grows with the generation (×0.7 → ×1)
    const vk = 0.7 + p.g * 0.05;
    const vane = [0, -40, 3, -46, 12, -50, 9, -45, 15, -44, 8, -40.6, 12, -37.6, 3, -38].map((v, i) => (i % 2 === 0 ? v * vk : -40 + (v + 40) * vk));
    if (base) blob(c, vane, mix(L, 0xff3a1a, 0.4), { ow: 1.5, hl: 0.35 });
    lightPoly(c, { ...p, L }, shrink(vane, 0.6));
    // ember arrow
    if (base) { seg(c, 0, -40, -10, -40, 1.2, p.trim, 1); poly(c, [-10, -42.4, -14, -40, -10, -37.6], light(L, 0.2), { ow: 1.2 }); }
    lightGem(c, { ...p, L }, 0, -40, 2.4, L);
    if (base) star(c, 0, -53, 4, 3, 1.2, p.trim, 1);
    for (let i = 0; i < Math.max(2, p.s.floats); i++) out.push(floatOf(p, 6, -46, (q) => blob(q, [-1.6, 1.6, -1, -1.6, 0.2, -4.4, 1.4, -1.6, 1.6, 1.6], light(L, 0.25), { ow: 1, hl: 0.4 }), 1.2, 9, 1.3, (i / 2) * Math.PI * 2, L, 7));
  },
};

// ─────────────────────────── entry ───────────────────────────

function floatOf(p: P, x: number, y: number, draw: (c: Ctx) => void, bob: number, orbit: number, spin: number, phase: number, glow: number, glowR: number, deco = true): WFloat {
  void p;
  return { x, y, draw, bob, orbit, spin, phase, glow, glowR, deco };
}

/** A floating piece that is part of the silhouette (zenith segments, floating heads, the Fabled Inscription): always
 *  shown, also for crowds; decorative floats (motif tokens, glints, embers) may be dropped by the crowd budget. */
function solidOf(p: P, x: number, y: number, draw: (c: Ctx) => void, bob: number, orbit: number, spin: number, phase: number, glow: number, glowR: number): WFloat {
  return floatOf(p, x, y, draw, bob, orbit, spin, phase, glow, glowR, false);
}

/** Presentation of the default drawings: the item's light, a strength from generation / rarity / grade / +N, the
 *  family's reach as the light anchors, and the grade's particle hint (Kindled ember, Fabled star). */
function defaultPresentation(input: WeaponDrawInput): WeaponPresentation {
  const s = input.style, lit = !!s.light;
  const tip: [number, number] = input.family === 'bow' ? [6, 0] : [0, -input.reach.tip];
  const base: [number, number] = input.family === 'bow' ? [2.6, 0] : [0, -input.reach.base];
  return {
    light: s.light,
    core: lit ? light(s.top >= 2 ? FABLED_LIGHT : s.light, 0.45) : 0,
    edge: s.edgeLight,
    strength: !lit ? 0 : 0.25 + 0.1 * s.gen + (s.special ? 0.35 : 0) + 0.2 * s.top + 0.05 * s.temper,
    tip, base,
    impact: s.top >= 2 ? 'star' : s.top === 1 ? 'ember' : 'spark',
  };
}

/** The procedural drawing of one family as a WeaponDrawFn (the default registered in weaponDrawing.ts). */
function proceduralDrawing(fam: WeaponFamily): WeaponDrawFn {
  return (input: WeaponDrawInput): WeaponDrawing => {
    const { look, style: s, rig } = input;
    const emberColor = TOP_COLORS[1];
    const mk = (layer: WLayer): P => ({
      s, g: s.gen, r: s.rar, sp: s.special, top: s.top, v: look.variant,
      metal: s.metal, edge: s.edge, dark: s.dark, trim: s.trim, wood: s.wood, wrap: s.wrap,
      L: s.light, edgeL: s.edgeLight, layer, sig: s.sig, motif: s.motif, look, rig,
    });
    const run = (c: Ctx, layer: WLayer, out: WFloat[]) => {
      const p = mk(layer);
      const bespoke = s.bespoke ? BESPOKE[s.bespoke] : undefined;
      if (bespoke) { bespoke(c, p, out); gradeMarks(c, p, fam, out, emberColor); return; }
      switch (fam) {
        case 'blade': bladeFamily(c, p, false, out); break;
        case 'greatblade': bladeFamily(c, p, true, out); break;
        case 'axe': axeFamily(c, p, false, out); break;
        case 'greataxe': axeFamily(c, p, true, out); break;
        case 'mace': maceFamily(c, p, out); break;
        case 'staff': staffFamily(c, p, out); break;
        case 'wand': wandFamily(c, p, out); break;
        case 'bow': bowFamily(c, p, rig, out); break;
        case 'crossbow': crossbowFamily(c, p, false, out); break;
        case 'handxbow': crossbowFamily(c, p, true, out); break;
        case 'shield': shieldFamily(c, p, out); break;
        case 'quiver': quiverFamily(c, p, out); break;
        case 'orb': orbFamily(c, p, out); break;
      }
      signature(c, p, fam, out);
      gradeMarks(c, p, fam, out, emberColor);
    };
    let floats: WFloat[] | null = null;
    return {
      draw: (c, layer) => run(c, layer, []),
      get floats() {
        if (!floats) { const scratch = new GraphicsContext(); floats = []; run(scratch, 'base', floats); scratch.destroy(); }
        return floats;
      },
      lit: !!s.light || !!s.edgeLight,
      present: defaultPresentation(input),
    };
  };
}

const FAMILIES: WeaponFamily[] = ['blade', 'greatblade', 'axe', 'greataxe', 'mace', 'bow', 'crossbow', 'handxbow', 'staff', 'wand', 'shield', 'quiver', 'orb'];
/** The default drawings per family (registered by weaponDrawing.ts; the art pass overrides them one by one). */
export const DEFAULT_WEAPON_DRAWINGS = Object.fromEntries(FAMILIES.map((f) => [f, proceduralDrawing(f)])) as Record<WeaponFamily, WeaponDrawFn>;

void rbox; void OUT;
