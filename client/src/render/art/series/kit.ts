// Drawing kit for the weapon series (docs/rework/gear/ART-DIRECTION.md §2). Thin layer over draw.ts so the series art
// keeps the game's one ink, three tones and upper-left light, and adds what the old parametric art lacked:
//
// * Line hierarchy (ART-REFERENCES IL1, R8): every drawing runs in two base passes. 'under' paints each part's
//   silhouette in ink, dilated by the OUTER width, so the whole object gets one heavy outer contour; 'paint' fills the
//   tones and separates parts with a thin INNER ink line. Interior detail (grain, wraps, ticks) uses a darker tone of
//   the material, never ink.
// * Light as a material (R6): the 'light' pass draws only emissive parts (an ember, a lamp window, rune slots); the
//   hero rig adds it additively, icons composite it with a glow. Base passes paint the same parts lit or dormant.
// * Floating parts only with a cause (R11): `float()` records them for the rig (orrery rings, Faultline-split shards).
//
// Hand-local frame (same as gear.ts / weaponArt.ts): grip at the origin, the business end towards -y; bows have their
// limbs along y with the nock points at (-2.4, ±21) where the rig ties the string.

import { GraphicsContext } from 'pixi.js';
import { OUT, blobPath, fill, inSilhouette, outline, type Ctx } from '../draw';
import { light, mix, shade } from '../util';
import type { WFloat } from '../weaponDrawing';

export type Pass = 'under' | 'paint' | 'light';

/** Outer contour (ink beyond the shape, per side), part separation line, interior detail line (hand-local units). */
export const OUTER = 1.6;
export const INNER = 0.95;
export const DETAIL = 0.75;

/** Light comes from the upper left of the screen; in the weapon frame of a 45° icon that is local -x (slightly tip-ward). */
export const LX = -0.94, LY = -0.34;

export interface K {
  c: Ctx;
  pass: Pass;
  /** Craftsmanship from rarity: 0 normal, 1 magic, 2 rare (R5). */
  q: 0 | 1 | 2;
  /** Drawn for the hero rig (bows: no string, the rig draws it). */
  rig: boolean;
  /** Per-item seed (wear placement). */
  seed: number;
  floats: WFloat[];
  /** Whether this drawing has a light layer worth baking (set by the drawing). */
  lit: boolean;
  /** Colour of the strongest light drawn (icons tint their glow with it). */
  litCol: number;
  /** Override of the rarity accent colour (a legendary / Set drawn on a series base carries its own colour there). */
  accent: number;
  /** Effect strength 0..~2 (ART-DIRECTION §1.4, owner decision 2026-10-11): 0 on normal items, rising with the level
   *  band, rarity, legendary, grade and +N. Light blooms scale with it and effect parts (motes, rays, arcs, glints)
   *  appear above thresholds. */
  fx: number;
  /** Junction of grip and head: where the series motif and the grade accents sit (set by the drawing). */
  anchor: { x: number; y: number; r: number };
}

export function newKit(c: Ctx, pass: Pass, q: 0 | 1 | 2, rig: boolean, seed: number, floats: WFloat[]): K {
  return { c, pass, q, rig, seed, floats, lit: false, litCol: 0, accent: 0, fx: 0, anchor: { x: 0, y: -6, r: 3 } };
}

// ───────────────────────── tones ─────────────────────────

export interface Tones { base: number; sh: number; hi: number; line: number }
/** Three tones of a material: base, shade (towards the game's cool plum), highlight (towards warm cream), detail line. */
export function tones(col: number, shK = 0.34, hiK = 0.5): Tones {
  return { base: col, sh: shade(col, shK), hi: light(col, hiK), line: shade(col, 0.62) };
}

function bbox(pts: number[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
const scaleTo = (pts: number[], px: number, py: number, s: number) => pts.map((v, i) => (i % 2 === 0 ? px + (v - px) * s : py + (v - py) * s));
export const shift = (pts: number[], dx: number, dy: number) => pts.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));

// ───────────────────────── solids ─────────────────────────

export interface SlabOpts {
  /** Smooth closed curve through the points instead of a polygon. */
  smooth?: boolean;
  /** Inner scale of the lit base (smaller = wider shade band). */
  inset?: number;
  /** Part separation line width (0 = none, the outer contour still exists). */
  line?: number;
  /** Shade / highlight strength. */
  shK?: number;
  /** Highlight polylines (interior light lines, R8) in local coordinates. */
  hi?: number[][];
  /** Flat single fill (small parts). */
  flat?: boolean;
  /** Skip the 'under' contour (parts that sit fully inside another part). */
  inner?: boolean;
}

/** Shade-side nudge of the second ink copy (outer frame: screen lower right in icons). */
export const INK_DX = 0.5, INK_DY = 0.55;

/** Under-pass ink: the part's silhouette dilated by OUTER, plus a copy nudged towards the shade side so the contour is
 *  heavier where the form turns away from the light — the inker's weighted line (ART-DIRECTION §1.2). Silhouette modes
 *  (hit flash, rim glow) get the plain dilation only. */
function ink(c: Ctx, build: () => void, filled: boolean, w = 0): void {
  build(); if (filled) fill(c, OUT); build(); outline(c, w + OUTER * 2);
  if (inSilhouette()) return;
  c.save(); c.translate(INK_DX, INK_DY);
  build(); if (filled) fill(c, OUT); build(); outline(c, w + OUTER * 1.7);
  c.restore();
}

function path(c: Ctx, pts: number[], smooth?: boolean): void {
  if (smooth) blobPath(c, pts); else c.poly(pts, true);
}

/** A solid part: ink contour in 'under', shade band + lit base + optional light lines in 'paint'. */
export function slab(k: K, pts: number[], col: number, o: SlabOpts = {}): void {
  const c = k.c;
  if (k.pass === 'light') return;
  if (k.pass === 'under') {
    if (o.inner) return;
    ink(c, () => path(c, pts, o.smooth), true);
    return;
  }
  if (inSilhouette()) { path(c, pts, o.smooth); fill(c, col); return; }
  const t = tones(col, o.shK ?? 0.34);
  if (o.flat) { path(c, pts, o.smooth); fill(c, col); }
  else {
    const b = bbox(pts);
    const px = b.cx + b.w * -0.32, py = b.cy + b.h * -0.3;
    path(c, pts, o.smooth); fill(c, t.sh);
    path(c, scaleTo(pts, px, py, o.inset ?? 0.84), o.smooth); fill(c, t.base);
  }
  if (o.hi) for (const h of o.hi) stroke(c, h, 0.85, t.hi, 0.95);
  const lw = o.line ?? INNER;
  if (lw > 0) { path(c, pts, o.smooth); c.stroke({ width: lw, color: OUT, alpha: 0.95, join: 'round', cap: 'round' }); }
}

/** Two-tone blade split along a ridge (lit side towards -x), the cel model of metal (ART-REFERENCES HK2). `lit` and
 *  `dark` are the two halves as closed polygons; `edge` is the bright interior line along the lit cutting edge. */
export function bevel(k: K, outlinePts: number[], litHalf: number[], col: number, o: { edge?: number[]; edgeCol?: number; line?: number; ridge?: number[] } = {}): void {
  const c = k.c;
  if (k.pass === 'light') return;
  if (k.pass === 'under') { ink(c, () => c.poly(outlinePts, true), true); return; }
  if (inSilhouette()) { c.poly(outlinePts, true); fill(c, col); return; }
  const t = tones(col, 0.36, 0.55);
  c.poly(outlinePts, true); fill(c, t.sh);
  c.poly(litHalf, true); fill(c, t.base);
  if (o.ridge) stroke(c, o.ridge, 0.7, mix(t.sh, OUT, 0.35), 0.8);
  if (o.edge) stroke(c, o.edge, 1, o.edgeCol ?? t.hi, 1);
  const lw = o.line ?? INNER;
  if (lw > 0) { c.poly(outlinePts, true); c.stroke({ width: lw, color: OUT, join: 'round', cap: 'round' }); }
}

/** Round part (ring, ball, bead). */
export function disc(k: K, x: number, y: number, rx: number, ry: number, col: number, o: { line?: number; hi?: boolean; inner?: boolean } = {}): void {
  const c = k.c;
  if (k.pass === 'light') return;
  if (k.pass === 'under') { if (o.inner) return; ink(c, () => c.ellipse(x, y, rx, ry), true); return; }
  if (inSilhouette()) { c.ellipse(x, y, rx, ry); fill(c, col); return; }
  const t = tones(col);
  c.ellipse(x, y, rx, ry); fill(c, t.sh);
  c.ellipse(x - rx * 0.14, y - ry * 0.14, rx * 0.8, ry * 0.8); fill(c, t.base);
  if (o.hi !== false && Math.min(rx, ry) > 1.1) c.ellipse(x - rx * 0.36, y - ry * 0.38, rx * 0.32, ry * 0.22).fill({ color: t.hi, alpha: 0.95 });
  const lw = o.line ?? INNER;
  if (lw > 0) { c.ellipse(x, y, rx, ry); c.stroke({ width: lw, color: OUT }); }
}

/** An isometric cube (salt crystals): top face lightest, left face lit, right face in shade,
 *  matching the upper-left light. `s` = half height. `rot` rotates the whole cube (crystals grow at angles). */
export function cube(k: K, x: number, y: number, s: number, col: number, o: { rot?: number; line?: number; inner?: boolean; topK?: number } = {}): void {
  const c = k.c;
  if (k.pass === 'light') return;
  const hx = s * 0.87, r = o.rot ?? 0, cs = Math.cos(r), sn = Math.sin(r);
  const P = (px: number, py: number) => [x + px * cs - py * sn, y + px * sn + py * cs];
  const hex = [...P(0, -s), ...P(hx, -s / 2), ...P(hx, s / 2), ...P(0, s), ...P(-hx, s / 2), ...P(-hx, -s / 2)];
  if (k.pass === 'under') { if (o.inner) return; ink(c, () => c.poly(hex, true), true); return; }
  if (inSilhouette()) { c.poly(hex, true); fill(c, col); return; }
  const t = tones(col, 0.38, 0.6);
  c.poly([...P(0, -s), ...P(hx, -s / 2), ...P(0, 0), ...P(-hx, -s / 2)], true).fill(light(col, o.topK ?? 0.45));
  c.poly([...P(-hx, -s / 2), ...P(0, 0), ...P(0, s), ...P(-hx, s / 2)], true).fill(t.base);
  c.poly([...P(0, 0), ...P(hx, -s / 2), ...P(hx, s / 2), ...P(0, s)], true).fill(t.sh);
  c.moveTo(...(P(0, 0) as [number, number])).lineTo(...(P(0, s) as [number, number])); c.moveTo(...(P(0, 0) as [number, number])).lineTo(...(P(-hx, -s / 2) as [number, number])); c.moveTo(...(P(0, 0) as [number, number])).lineTo(...(P(hx, -s / 2) as [number, number]));
  c.stroke({ width: 0.4, color: t.line, alpha: 0.8 });
  const lw = o.line ?? 0.7;
  if (lw > 0) { c.poly(hex, true); c.stroke({ width: lw, color: OUT, join: 'round' }); }
}

/** A ring (stroked ellipse): rims, loops, hoops, graduated circles. `ticks` adds graduation marks (inside). */
export function ring(k: K, x: number, y: number, rx: number, ry: number, w: number, col: number, o: { ticks?: number; tickCol?: number; a0?: number; a1?: number; inner?: boolean } = {}): void {
  const c = k.c;
  if (k.pass === 'light') return;
  const arc = () => {
    if (o.a0 === undefined) { c.ellipse(x, y, rx, ry); return; }
    const n = 24; for (let i = 0; i <= n; i++) { const a = o.a0 + ((o.a1 ?? 0) - o.a0) * (i / n), px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry; if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); }
  };
  if (k.pass === 'under') { if (o.inner) return; ink(c, arc, false, w); return; }
  if (inSilhouette()) { arc(); c.stroke({ width: w, color: 0xffffff, cap: 'round' }); return; }
  const t = tones(col);
  arc(); c.stroke({ width: w, color: t.sh, cap: 'round' });
  if (w >= 1.4) { arc(); c.stroke({ width: w * 0.5, color: t.base, cap: 'round' }); }
  if (o.ticks) {
    const a0 = o.a0 ?? 0, a1 = o.a1 ?? Math.PI * 2, n = o.ticks;
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * ((i + 0.5) / n), ca = Math.cos(a), sa = Math.sin(a), L = i % 3 === 0 ? w * 0.9 : w * 0.5;
      c.moveTo(x + ca * (rx - w * 0.45), y + sa * (ry - w * 0.45)).lineTo(x + ca * (rx - w * 0.45 + L), y + sa * (ry - w * 0.45 + L));
    }
    c.stroke({ width: 0.45, color: o.tickCol ?? t.line, cap: 'round' });
  }
}

// ───────────────────────── strokes ─────────────────────────

function stroke(c: Ctx, pts: number[], w: number, col: number, alpha = 1): void {
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.stroke({ width: w, color: col, alpha, join: 'round', cap: 'round' });
}

/** Interior detail line in a material tone (grain, engraving, wrap seams). Invisible in silhouette / under passes. */
export function detail(k: K, pts: number[], col: number, w = DETAIL, alpha = 1): void {
  if (k.pass !== 'paint' || inSilhouette()) return;
  stroke(k.c, pts, w, col, alpha);
}

/** Smooth quadratic polyline stroke helper: points x0,y0, cx,cy, x1,y1 [, cx,cy, x2,y2 …]. */
function curve(c: Ctx, pts: number[]): void {
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i + 3 < pts.length; i += 4) c.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
}

/** A round-section part drawn as a stroke along a polyline or quadratic curve (shafts, hafts, limbs, cords). Lit
 *  stripe on the light side, a thin highlight line, optional grain marks. */
export function pole(k: K, pts: number[], w: number, col: number, o: { curve?: boolean; hiK?: number; flat?: boolean; inner?: boolean } = {}): void {
  const c = k.c;
  if (k.pass === 'light') return;
  const draw = (p: number[]) => (o.curve ? curve(c, p) : (() => { c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); })());
  if (k.pass === 'under') {
    if (o.inner) return;
    ink(c, () => draw(pts), false, w);
    return;
  }
  if (inSilhouette()) { draw(pts); c.stroke({ width: w, color: 0xffffff, join: 'round', cap: 'round' }); return; }
  const t = tones(col);
  draw(pts); c.stroke({ width: w, color: o.flat ? col : t.sh, join: 'round', cap: 'round' });
  if (!o.flat && w >= 1.6) {
    const d = w * 0.2;
    draw(shift(pts, LX * d, LY * d * 0.3)); c.stroke({ width: w * 0.62, color: t.base, join: 'round', cap: 'round' });
    if (w >= 2.2) { draw(shift(pts, LX * w * 0.32, LY * w * 0.1)); c.stroke({ width: Math.max(0.6, w * 0.16), color: t.hi, alpha: o.hiK ?? 0.9, join: 'round', cap: 'round' }); }
  }
}

/** Cord / lashing wound round a shaft between y0 and y1 (vertical shaft centred on x, width w). */
export function lash(k: K, x: number, y0: number, y1: number, w: number, col: number, o: { slant?: number; gap?: number; bulge?: number } = {}): void {
  const c = k.c;
  const bulge = o.bulge ?? 0.45, hw = w / 2 + bulge;
  const top = Math.min(y0, y1), bot = Math.max(y0, y1);
  if (k.pass === 'light') return;
  if (k.pass === 'under') { ink(c, () => c.roundRect(x - hw, top, hw * 2, bot - top, 0.8), true); return; }
  if (inSilhouette()) { c.roundRect(x - hw, top, hw * 2, bot - top, 0.8); fill(c, 0xffffff); return; }
  const t = tones(col);
  c.roundRect(x - hw, top, hw * 2, bot - top, 0.8); fill(c, t.sh);
  const gap = o.gap ?? 1.35, sl = o.slant ?? 0.7;
  for (let y = top + gap * 0.5; y < bot - 0.2; y += gap) {
    stroke(c, [x - hw + 0.2, y + sl * 0.5, x + hw - 0.2, y - sl * 0.5], gap * 0.72, t.base);
    stroke(c, [x - hw + 0.5, y + sl * 0.5 - 0.25, x - hw * 0.1, y + sl * 0.05 - 0.3], 0.5, t.hi, 0.9);
  }
  c.roundRect(x - hw, top, hw * 2, bot - top, 0.8); c.stroke({ width: INNER * 0.85, color: OUT });
}

/** A rivet / peg head (paint only: it sits on a part). */
export function rivet(k: K, x: number, y: number, r: number, col: number): void {
  if (k.pass !== 'paint' || inSilhouette()) return;
  const t = tones(col);
  k.c.circle(x + 0.2, y + 0.25, r + 0.35).fill({ color: OUT, alpha: 0.75 });
  k.c.circle(x, y, r).fill(t.base);
  k.c.circle(x - r * 0.35, y - r * 0.35, r * 0.38).fill({ color: t.hi, alpha: 0.95 });
}

/** A square peg end (wood joinery). */
export function peg(k: K, x: number, y: number, s: number, col: number): void {
  if (k.pass !== 'paint' || inSilhouette()) return;
  const t = tones(col);
  k.c.rect(x - s / 2, y - s / 2, s, s).fill(t.sh);
  k.c.rect(x - s / 2, y - s / 2, s * 0.62, s * 0.62).fill(t.base);
  k.c.rect(x - s / 2, y - s / 2, s, s).stroke({ width: 0.55, color: OUT, alpha: 0.9 });
}

// ───────────────────────── rarity accent (rule A5) ─────────────────────────

/** The one place rarity colour appears on the object: magic blue, rare gold (the UI rarity tokens, ART_DIRECTION §5). */
export const RARITY_ACCENT = [0, 0x5a7dff, 0xd4b13a] as const;
/** The accent colour of a kit: its override, else the rarity token. */
export const accentOf = (k: K): number => k.accent || RARITY_ACCENT[k.q];

/** A bead on a short cord hanging from (x, y) at angle `a` (0 = straight down). */
export function bead(k: K, x: number, y: number, len: number, a: number, cord: number, r = 1.5): void {
  if (!k.q) return;
  const bx = x + Math.sin(a) * len, by = y + Math.cos(a) * len;
  pole(k, [x, y, bx, by], 0.7, cord, { flat: true });
  disc(k, bx, by, r, r * 1.08, accentOf(k), { line: 0.7 });
}

/** A cabochon stone in a metal bezel (set into a part). */
export function stone(k: K, x: number, y: number, r: number, bezel: number): void {
  if (!k.q) return;
  disc(k, x, y, r + 0.7, r + 0.7, bezel, { line: 0.7, inner: true });
  disc(k, x, y, r, r, accentOf(k), { line: 0.6, inner: true });
}

// ───────────────────────── light (R6) ─────────────────────────

/** An emissive line: lit core (or a dormant dark groove) in 'paint', bloom in 'light'. */
export function glowLine(k: K, pts: number[], w: number, col: number, on: boolean, groove: number): void {
  const c = k.c;
  if (k.pass === 'under') return;
  if (k.pass === 'paint') {
    if (inSilhouette()) return;
    stroke(c, pts, w + 0.6, shade(groove, 0.4), 1);
    if (on) { stroke(c, pts, w, light(col, 0.25), 1); stroke(c, pts, Math.max(0.5, w * 0.4), light(col, 0.7), 1); }
    return;
  }
  if (!on) return;
  k.lit = true; k.litCol = k.litCol || col;
  const b = bloom(k);
  stroke(c, pts, w * (3 + 2.2 * b), col, 0.12 + 0.08 * b);
  stroke(c, pts, w * (1.6 + 0.6 * b), col, 0.45 + 0.15 * b);
  stroke(c, pts, w * 0.6, light(col, 0.6), 0.75 + 0.2 * b);
}

/** An emissive spot (ember, lamp flame, lens). */
export function glowSpot(k: K, x: number, y: number, r: number, col: number, on: boolean): void {
  const c = k.c;
  if (k.pass === 'under' || inSilhouette()) return;
  if (k.pass === 'paint') {
    if (!on) return;
    c.circle(x, y, r).fill(light(col, 0.15));
    c.circle(x - r * 0.15, y - r * 0.15, r * 0.55).fill(light(col, 0.75));
    return;
  }
  if (!on) return;
  k.lit = true; k.litCol = k.litCol || col;
  const b = bloom(k);
  c.circle(x, y, r * (2.3 + 1.6 * b)).fill({ color: col, alpha: 0.1 + 0.06 * b });
  c.circle(x, y, r * (1.35 + 0.3 * b)).fill({ color: col, alpha: 0.42 + 0.12 * b });
  c.circle(x, y, r * 0.6).fill({ color: light(col, 0.6), alpha: 0.7 + 0.2 * b });
}

/** An emissive area (window, slot). */
export function glowPoly(k: K, pts: number[], col: number, on: boolean, dormant: number): void {
  const c = k.c;
  if (k.pass === 'under') return;
  if (k.pass === 'paint') {
    if (inSilhouette()) return;
    c.poly(pts, true); fill(c, on ? light(col, 0.2) : dormant);
    if (on) { c.poly(scaleTo(pts, bbox(pts).cx, bbox(pts).cy, 0.5), true); fill(c, light(col, 0.7)); }
    c.poly(pts, true); c.stroke({ width: 0.6, color: OUT, alpha: 0.8 });
    return;
  }
  if (!on) return;
  k.lit = true; k.litCol = k.litCol || col;
  c.poly(pts, true); c.stroke({ width: 2.4, color: col, alpha: 0.26, join: 'round' });
  c.poly(pts, true); fill(c, col, 0.5);
}

/** Bloom factor 0..1 from the effect strength. */
export const bloom = (k: K): number => Math.max(0, Math.min(1, k.fx / 1.4));

// ───────────────────────── effect parts (ART-DIRECTION §1.4b: each series its own effect language) ─────────────────

/** Light-layer rays from (x, y) over the angle range (lamp light, relic glare): thin additive wedges. */
export function rays(k: K, x: number, y: number, n: number, len: number, a0: number, a1: number, col: number, w = 0.9): void {
  if (k.pass !== 'light' || n <= 0) return;
  k.lit = true; k.litCol = k.litCol || col;
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? (a0 + a1) / 2 : a0 + ((a1 - a0) * i) / (n - 1), L = len * (i % 2 ? 0.72 : 1);
    const ca = Math.cos(a), sa = Math.sin(a), px = -sa * w, py = ca * w;
    k.c.poly([x + px, y + py, x + ca * L, y + sa * L, x - px, y - py], true).fill({ color: col, alpha: 0.22 + 0.12 * bloom(k) });
  }
}

/** Light-layer energy arc between two points (a jagged bolt with a soft bloom), deterministic per seed. */
export function zap(k: K, x0: number, y0: number, x1: number, y1: number, col: number, seed: number, w = 0.6): void {
  if (k.pass !== 'light') return;
  k.lit = true; k.litCol = k.litCol || col;
  const n = 5, pts: number[] = [x0, y0], dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  for (let i = 1; i < n; i++) { const t = i / n, o = jit(seed, i, d * 0.32); pts.push(x0 + dx * t + nx * o, y0 + dy * t + ny * o); }
  pts.push(x1, y1);
  stroke(k.c, pts, w * 4, col, 0.14); stroke(k.c, pts, w * 1.6, col, 0.6); stroke(k.c, pts, w * 0.55, light(col, 0.7), 0.95);
}

/** A soft light-layer haze (heat shimmer, spray mist, relic glare): stacked ellipses. */
export function haze(k: K, x: number, y: number, rx: number, ry: number, col: number, a = 0.14): void {
  if (k.pass !== 'light') return;
  k.lit = true; k.litCol = k.litCol || col;
  for (const f of [1, 0.66, 0.38]) k.c.ellipse(x, y, rx * f, ry * f).fill({ color: col, alpha: a * (0.6 + 0.4 * bloom(k)) });
}

export type MoteShape = 'dot' | 'spark' | 'diamond' | 'drop' | 'chip';
/** A decorative effect mote (ember, glitter, star mote, chip, drop) as a float: the rig animates it (bob / orbit /
 *  spin), gives it a glow sprite and drops it outside the presence slots (deco). Icons draw it at rest. */
export function mote(k: K, x: number, y: number, r: number, col: number, shape: MoteShape, m: { bob?: number; orbit?: number; spin?: number; phase?: number; glow?: boolean } = {}): void {
  float(k, x, y, (kk) => {
    if (kk.pass !== 'paint' || inSilhouette()) return;
    const c = kk.c;
    if (shape === 'dot') { c.circle(0, 0, r * 1.5).fill({ color: col, alpha: 0.35 }); c.circle(0, 0, r).fill(light(col, 0.35)); c.circle(-r * 0.25, -r * 0.25, r * 0.45).fill(light(col, 0.85)); }
    else if (shape === 'spark') { const q = r * 0.28; c.poly([0, -r * 1.6, q, -q, r * 1.6, 0, q, q, 0, r * 1.6, -q, q, -r * 1.6, 0, -q, -q], true).fill(light(col, 0.55)); c.circle(0, 0, r * 0.35).fill(0xffffff); }
    else if (shape === 'diamond') { c.poly([0, -r * 1.3, r * 0.8, 0, 0, r * 1.3, -r * 0.8, 0], true).fill(light(col, 0.4)); c.poly([0, -r * 1.3, r * 0.8, 0, 0, 0], true).fill(light(col, 0.75)); c.poly([0, -r * 1.3, r * 0.8, 0, 0, r * 1.3, -r * 0.8, 0], true).stroke({ width: 0.4, color: OUT, alpha: 0.6 }); }
    else if (shape === 'drop') { c.moveTo(0, -r * 1.6).quadraticCurveTo(r, 0, 0, r).quadraticCurveTo(-r, 0, 0, -r * 1.6).fill(light(col, 0.25)); c.circle(-r * 0.3, 0, r * 0.3).fill(0xffffff); }
    else { c.poly([-r, -r * 0.5, r * 0.7, -r, r, r * 0.4, -r * 0.5, r], true).fill(col); c.poly([-r, -r * 0.5, r * 0.7, -r, r, r * 0.4, -r * 0.5, r], true).stroke({ width: 0.5, color: OUT, alpha: 0.85 }); }
  }, { bob: m.bob ?? 1.2, orbit: m.orbit ?? 0, spin: m.spin ?? 0, phase: m.phase ?? 0, glow: m.glow === false ? 0 : col, glowR: r * 2.6, deco: true });
}

/** A light-only stroke (a scanning arc, a lit edge seen as glow without a painted core). */
export function beam(k: K, pts: number[], w: number, col: number): void {
  if (k.pass !== 'light') return;
  k.lit = true; k.litCol = k.litCol || col;
  const b = bloom(k);
  stroke(k.c, pts, w * (3 + 2 * b), col, 0.1 + 0.08 * b); stroke(k.c, pts, w * 1.2, col, 0.4 + 0.2 * b); stroke(k.c, pts, w * 0.45, light(col, 0.7), 0.8);
}

/** Points along a circle arc (angles in radians, y down). */
export function arcAt(cx: number, cy: number, r: number, a0: number, a1: number, n = 12, ry = r): number[] {
  const o: number[] = []; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; o.push(cx + Math.cos(a) * r, cy + Math.sin(a) * ry); } return o;
}

/** Compose a drawing with its effect layer. */
export const withFx = (d: (k: K) => void, e: (k: K) => void) => (k: K): void => { d(k); if (k.fx > 0) e(k); };

/** How many effect parts an item gets at this effect strength (0 on plain items). */
export const fxCount = (k: K, perUnit: number, max: number): number => (k.fx <= 0 ? 0 : Math.max(0, Math.min(max, Math.round(k.fx * perUnit))));

// ───────────────────────── floats (R11) ─────────────────────────

/** Record a floating part (only in the 'paint' pass; nothing is drawn into the weapon itself). The part draws itself
 *  in both base passes around its own origin. */
export function float(k: K, x: number, y: number, draw: (kk: K) => void, m: { bob?: number; orbit?: number; spin?: number; phase?: number; glow?: number; glowR?: number; deco?: boolean } = {}): void {
  if (k.pass !== 'paint') return;
  const q = k.q, rig = k.rig, seed = k.seed, accent = k.accent, fx = k.fx;
  k.floats.push({
    x, y, bob: m.bob ?? 0.8, orbit: m.orbit ?? 0, spin: m.spin ?? 0, phase: m.phase ?? 0, glow: m.glow ?? 0, glowR: m.glowR ?? 6, deco: m.deco ?? false,
    draw: (c: Ctx) => { for (const pass of ['under', 'paint'] as const) draw({ ...newKit(c, pass, q, rig, seed, []), accent, fx }); },
  });
}

/** Run a drawing in both base passes (helper for previews / floats). */
export function runBase(c: Ctx, draw: (k: K) => void, q: 0 | 1 | 2, rig: boolean, seed: number, floats: WFloat[]): K {
  let last: K | null = null;
  for (const pass of ['under', 'paint'] as const) { last = newKit(c, pass, q, rig, seed, pass === 'paint' ? floats : []); draw(last); }
  return last!;
}

/** Scratch context for passes whose output is only bookkeeping (floats, lit flag). */
export function scratch<T>(fn: (c: Ctx) => T): T {
  const c = new GraphicsContext();
  try { return fn(c); } finally { c.destroy(); }
}

// ───────────────────────── geometry ─────────────────────────

/** Points along a quadratic curve (x0,y0) → (x1,y1) with control (cx,cy), n segments. */
export function qpts(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, n = 10): number[] {
  const o: number[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push(u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1); }
  return o;
}

/** Closed strip along a centre polyline: width interpolates w0 → w1 (or per-point widths), covering the side band from
 *  `a` to `b` (−1 = left edge, +1 = right edge, relative to the walking direction). */
export function ribbon(center: number[], w0: number | number[], w1 = typeof w0 === 'number' ? w0 : 0, a = -1, b = 1): number[] {
  const n = center.length / 2;
  const L: number[] = [], R: number[] = [];
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    let dx = center[i1 * 2] - center[i0 * 2], dy = center[i1 * 2 + 1] - center[i0 * 2 + 1];
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const nx = -dy, ny = dx; // right-hand normal (screen y down): walking up (-y), right is +x
    const w = typeof w0 === 'number' ? w0 + (w1 - w0) * (i / Math.max(1, n - 1)) : w0[i];
    const x = center[i * 2], y = center[i * 2 + 1];
    L.push(x + nx * a * w * 0.5, y + ny * a * w * 0.5);
    R.push(x + nx * b * w * 0.5, y + ny * b * w * 0.5);
  }
  const out = [...L];
  for (let i = n - 1; i >= 0; i--) out.push(R[i * 2], R[i * 2 + 1]);
  return out;
}

/** Mirror x of a point list (handedness swaps for asymmetric parts). */
export const flipX = (pts: number[]) => pts.map((v, i) => (i % 2 === 0 ? -v : v));

/** Deterministic tiny jitter for hand-made asymmetry (R10): returns a value in [-a, a]. */
export function jit(seed: number, i: number, a: number): number {
  const s = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return (s - Math.floor(s) - 0.5) * 2 * a;
}
