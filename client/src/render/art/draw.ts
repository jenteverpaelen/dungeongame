// Vector drawing helpers on top of Pixi GraphicsContext. Every shape in the game goes through these so the
// whole cast shares one look: dark outline, flat base, one soft highlight, one cool shade.

import { Graphics, GraphicsContext } from 'pixi.js';
import { light, shade } from './util';

export type Ctx = GraphicsContext;

/** The one outline colour of the whole game. */
export const OUT = 0x1b1410;
/** Standard outline width for body parts at ~64px character height. */
export const OW = 2.5;
export const OW_THIN = 1.6;

// ───────────────────────── context cache ─────────────────────────

const cache = new Map<string, GraphicsContext>();
const CACHE_LIMIT = 4000;

/** Build (or reuse) a GraphicsContext for a drawing key. Contexts are shared between views (cheap geometry reuse). */
export function cachedCtx(key: string, build: (c: Ctx) => void): GraphicsContext {
  let c = cache.get(key);
  if (!c) {
    if (cache.size > CACHE_LIMIT) cache.clear();
    c = new GraphicsContext();
    build(c);
    cache.set(key, c);
  }
  return c;
}

export function gfx(ctx: GraphicsContext): Graphics {
  return new Graphics(ctx);
}

/** One-off Graphics drawn by a builder (not cached). */
export function make(build: (c: Ctx) => void): Graphics {
  const c = new GraphicsContext();
  build(c);
  return new Graphics(c);
}

// ───────────────────────── strokes ─────────────────────────

export function outline(c: Ctx, w = OW, color = OUT, alpha = 1): Ctx {
  return c.stroke({ width: w, color, alpha, join: 'round', cap: 'round' });
}

/** Stroke an arbitrary path twice: dark outline, then the coloured line on top (ropes, straps, bows, necks). */
export function line(c: Ctx, build: (c: Ctx) => void, w: number, col: number, ow = OW, hl = true): void {
  build(c); c.stroke({ width: w + ow * 2, color: OUT, join: 'round', cap: 'round' });
  build(c); c.stroke({ width: w, color: col, join: 'round', cap: 'round' });
  if (hl && w >= 4) { build(c); c.stroke({ width: Math.max(1, w * 0.28), color: light(col, 0.5), alpha: 0.4, join: 'round', cap: 'round' }); }
}

export function seg(c: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, col: number, ow = OW, hl = true): void {
  line(c, (k) => { k.moveTo(x0, y0).lineTo(x1, y1); }, w, col, ow, hl);
}

/** Thin dark detail line (stitching, cracks, fold lines). */
export function crease(c: Ctx, pts: number[], w = 1.2, col = OUT, alpha = 0.7): void {
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.stroke({ width: w, color: col, alpha, join: 'round', cap: 'round' });
}

// ───────────────────────── solid shapes ─────────────────────────

export interface ShapeOpts {
  ow?: number;      // outline width (0 = no outline)
  oc?: number;      // outline colour
  hl?: number;      // highlight alpha
  sh?: number;      // shade amount (0..1) of the lower rim
  flat?: boolean;   // no tone
}

/** Outlined ellipse with a shaded rim and a soft highlight. */
export function ball(c: Ctx, cx: number, cy: number, rx: number, ry: number, col: number, o: ShapeOpts = {}): void {
  const ow = o.ow ?? OW, oc = o.oc ?? OUT;
  if (o.flat || Math.min(rx, ry) < 3.6) {
    c.ellipse(cx, cy, rx, ry).fill(col);
    if (ow > 0) outline(c, ow, oc);
    return;
  }
  c.ellipse(cx, cy, rx, ry).fill(shade(col, o.sh ?? 0.2));
  if (ow > 0) outline(c, ow, oc);
  const ix = Math.max(rx - ow * 0.5 - 1.1, rx * 0.55), iy = Math.max(ry - ow * 0.5 - 1.1, ry * 0.55);
  c.ellipse(cx - (rx - ix) * 0.9, cy - (ry - iy) * 1.25, ix, iy).fill(col);
  const hl = o.hl ?? 0.34;
  if (hl > 0) c.ellipse(cx - rx * 0.3, cy - ry * 0.46, rx * 0.34, ry * 0.2).fill({ color: 0xffffff, alpha: hl });
}

/** Outlined rounded rectangle with a rim shade and a top highlight strip. */
export function rbox(c: Ctx, x: number, y: number, w: number, h: number, r: number, col: number, o: ShapeOpts = {}): void {
  const ow = o.ow ?? OW, oc = o.oc ?? OUT;
  if (o.flat || Math.min(w, h) < 7) {
    c.roundRect(x, y, w, h, r).fill(col);
    if (ow > 0) outline(c, ow, oc);
    return;
  }
  c.roundRect(x, y, w, h, r).fill(shade(col, o.sh ?? 0.2));
  if (ow > 0) outline(c, ow, oc);
  const i = ow * 0.5 + 1;
  c.roundRect(x + i, y + i * 0.8, w - i * 2 - 1.2, h - i * 2 - 0.4, Math.max(1, r - i)).fill(col);
  const hl = o.hl ?? 0.28;
  if (hl > 0) c.roundRect(x + i + 1, y + i * 0.8 + 0.8, Math.max(2, (w - i * 2) * 0.55), Math.max(1.2, h * 0.14), 1).fill({ color: 0xffffff, alpha: hl });
}

/** Outlined polygon with an inset lighter facet (simple bevel). Points are a flat [x,y,x,y...] array. */
export function poly(c: Ctx, pts: number[], col: number, o: ShapeOpts = {}): void {
  const ow = o.ow ?? OW, oc = o.oc ?? OUT;
  c.poly(pts, true).fill(col);
  if (ow > 0) outline(c, ow, oc);
  if (!o.flat && (o.hl ?? 0.25) > 0) {
    let cx = 0, cy = 0; const n = pts.length / 2;
    for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; }
    cx /= n; cy /= n;
    const s = 0.62, q: number[] = [];
    for (let i = 0; i < pts.length; i += 2) q.push(cx + (pts[i] - cx) * s - 0.5, cy + (pts[i + 1] - cy) * s - 0.7);
    c.poly(q, true).fill({ color: light(col, 0.55), alpha: o.hl ?? 0.25 });
  }
}

/** Plain polygon, fill + outline only. */
export function flatPoly(c: Ctx, pts: number[], col: number, ow = OW, oc = OUT): void {
  c.poly(pts, true).fill(col);
  if (ow > 0) outline(c, ow, oc);
}

/** Smooth closed blob through control points (quadratic mid-point smoothing). */
export function blobPath(c: Ctx, pts: number[]): void {
  const n = pts.length / 2;
  const mx = (i: number) => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2;
  const my = (i: number) => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
  c.moveTo(mx(n - 1), my(n - 1));
  for (let i = 0; i < n; i++) c.quadraticCurveTo(pts[i * 2], pts[i * 2 + 1], mx(i), my(i));
  c.closePath();
}

export function blob(c: Ctx, pts: number[], col: number, o: ShapeOpts = {}): void {
  const ow = o.ow ?? OW, oc = o.oc ?? OUT;
  blobPath(c, pts);
  c.fill(col);
  if (ow > 0) outline(c, ow, oc);
}

// ───────────────────────── small details ─────────────────────────

/** Tiny oval eye with a white glint. */
export function eye(c: Ctx, x: number, y: number, rx = 1.8, ry = 2.7, col = OUT, glint = true): void {
  c.ellipse(x, y, rx, ry).fill(col);
  if (glint) c.circle(x + rx * 0.3, y - ry * 0.35, Math.max(0.7, rx * 0.46)).fill(0xffffff);
}

export function spark(c: Ctx, x: number, y: number, r: number, col: number, alpha = 1): void {
  const k = r * 0.28;
  c.poly([x, y - r, x + k, y - k, x + r, y, x + k, y + k, x, y + r, x - k, y + k, x - r, y, x - k, y - k], true).fill({ color: col, alpha });
}

export function rivet(c: Ctx, x: number, y: number, r = 1.1, col = 0xe8e0c8): void {
  c.circle(x, y, r + 0.55).fill({ color: OUT, alpha: 0.55 });
  c.circle(x, y, r).fill(col);
}

/** Regular star (gems, emblems). */
export function star(c: Ctx, x: number, y: number, pts: number, ro: number, ri: number, col: number, ow = 0): void {
  c.star(x, y, pts, ro, ri).fill(col);
  if (ow > 0) outline(c, ow);
}

/** Faceted gem. */
export function gem(c: Ctx, x: number, y: number, r: number, col: number): void {
  c.poly([x, y - r, x + r * 0.85, y - r * 0.2, x + r * 0.55, y + r * 0.85, x - r * 0.55, y + r * 0.85, x - r * 0.85, y - r * 0.2], true).fill(col);
  outline(c, Math.max(1.1, r * 0.34));
  c.poly([x, y - r * 0.8, x + r * 0.5, y - r * 0.15, x, y + r * 0.1, x - r * 0.5, y - r * 0.15], true).fill({ color: 0xffffff, alpha: 0.38 });
}

/** Point on an ellipse arc, helper for building crescents. */
export function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 10): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  return out;
}

/** Crescent polygon between two ellipses sharing a bottom/side arc (used for cheap shading bands). */
export function crescent(c: Ctx, cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, inset: number, ox: number, oy: number, col: number, alpha: number): void {
  const outer = arcPts(cx, cy, rx, ry, a0, a1, 12);
  const inner = arcPts(cx + ox, cy + oy, rx - inset, ry - inset, a1, a0, 12);
  c.poly([...outer, ...inner], true).fill({ color: col, alpha });
}
