// Vector drawing primitives on top of Pixi GraphicsContext. Every shape in the game goes through these so
// the whole cast shares one look: warm-ink outline, flat base, one soft highlight (upper left) and a cool
// shade band (lower right).
//
// Silhouette modes: the same drawing code is re-run with `paint.mode` set to bake a white silhouette
// (hit flash) or a dilated white silhouette (elite rim glow) that matches the art exactly.

import { Graphics, GraphicsContext } from 'pixi.js';
import { INK } from './palette';
import { light, shade } from './util';

export type Ctx = GraphicsContext;

export const OUT = INK;
/** Standard outline width for body parts at ~64 unit character height. */
export const OW = 2.5;
export const OW_THIN = 1.6;

/** 0 = normal colours, 1 = white silhouette (flash), 2 = white silhouette dilated by `rim` (rim glow). */
export const paint = { mode: 0 as 0 | 1 | 2, rim: 2.4 };
export const pc = (c: number): number => (paint.mode ? 0xffffff : c);
export const inSilhouette = (): boolean => paint.mode !== 0;

// ───────────────────────── fills & strokes ─────────────────────────

export function fill(c: Ctx, col: number, alpha = 1): Ctx {
  return c.fill({ color: pc(col), alpha: paint.mode && alpha < 1 ? Math.min(1, alpha * 1.6) : alpha });
}

export function outline(c: Ctx, w = OW, col = OUT, alpha = 1): Ctx {
  return c.stroke({ width: paint.mode === 2 ? w + paint.rim * 2 : w, color: pc(col), alpha: paint.mode ? 1 : alpha, join: 'round', cap: 'round' });
}

/** Detail stroke that only exists in colour mode (fold lines, stitches, cracks). */
export function detail(c: Ctx, w: number, col: number, alpha = 1): Ctx {
  if (paint.mode) return c.stroke({ width: 0.01, color: 0xffffff, alpha: 0 });
  return c.stroke({ width: w, color: col, alpha, join: 'round', cap: 'round' });
}

/** Stroke a path twice: ink outline, then the coloured line on top (ropes, strings, shafts, tails). */
export function line(c: Ctx, build: (c: Ctx) => void, w: number, col: number, ow = OW, hl = true): void {
  build(c); c.stroke({ width: w + ow * 2 + (paint.mode === 2 ? paint.rim * 2 : 0), color: pc(OUT), join: 'round', cap: 'round' });
  build(c); c.stroke({ width: w, color: pc(col), join: 'round', cap: 'round' });
  if (hl && w >= 3.5 && !paint.mode) { build(c); c.stroke({ width: Math.max(1, w * 0.3), color: light(col, 0.55), alpha: 0.45, join: 'round', cap: 'round' }); }
}

export function seg(c: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, col: number, ow = OW, hl = true): void {
  line(c, (k) => { k.moveTo(x0, y0).lineTo(x1, y1); }, w, col, ow, hl);
}

/** Thin detail polyline (stitching, cracks, fold lines). Invisible in silhouette modes. */
export function crease(c: Ctx, pts: number[], w = 1.2, col = OUT, alpha = 0.7): void {
  if (paint.mode) return;
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.stroke({ width: w, color: col, alpha, join: 'round', cap: 'round' });
}

/** Dashed stitch line along a polyline. */
export function stitch(c: Ctx, pts: number[], col: number, dash = 2, gap = 1.6, w = 0.9, alpha = 0.8): void {
  if (paint.mode) return;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / (len || 1), uy = (y1 - y0) / (len || 1);
    for (let d = 0; d < len; d += dash + gap) {
      const e = Math.min(len, d + dash);
      c.moveTo(x0 + ux * d, y0 + uy * d).lineTo(x0 + ux * e, y0 + uy * e);
    }
  }
  c.stroke({ width: w, color: col, alpha, cap: 'round' });
}

// ───────────────────────── toned solids ─────────────────────────

export interface Tone {
  ow?: number;      // outline width (0 = none)
  oc?: number;      // outline colour
  hl?: number;      // highlight alpha (0 = none)
  sh?: number;      // shade mix amount
  inset?: number;   // inner scale (smaller = thicker shade band)
  flat?: boolean;   // single flat fill
  px?: number;      // light-anchor offset (fraction of size), default up-left
  py?: number;
}

/** Ellipse with a shade band (lower right), one soft highlight and an outline. */
export function ball(c: Ctx, cx: number, cy: number, rx: number, ry: number, col: number, o: Tone = {}): void {
  const ow = o.ow ?? OW;
  if (o.flat || paint.mode || Math.min(rx, ry) < 3) {
    c.ellipse(cx, cy, rx, ry); fill(c, col);
  } else {
    const s = o.inset ?? 0.86;
    const px = cx + rx * (o.px ?? -0.32), py = cy + ry * (o.py ?? -0.38);
    c.ellipse(cx, cy, rx, ry); fill(c, shade(col, o.sh ?? 0.28));
    c.ellipse(px + (cx - px) * s, py + (cy - py) * s, rx * s, ry * s); fill(c, col);
    const hl = o.hl ?? 0.32;
    if (hl > 0) { c.ellipse(cx - rx * 0.34, cy - ry * 0.5, rx * 0.36, ry * 0.2); fill(c, light(col, 0.85), hl * 1.6); }
  }
  if (ow > 0) { c.ellipse(cx, cy, rx, ry); outline(c, ow, o.oc ?? OUT); }
}

/** Rounded rectangle with shade band, highlight strip and outline. */
export function rbox(c: Ctx, x: number, y: number, w: number, h: number, r: number, col: number, o: Tone = {}): void {
  const ow = o.ow ?? OW;
  if (o.flat || paint.mode || Math.min(w, h) < 5) {
    c.roundRect(x, y, w, h, r); fill(c, col);
  } else {
    const s = o.inset ?? 0.84;
    const px = x + w * (0.5 + (o.px ?? -0.3)), py = y + h * (0.5 + (o.py ?? -0.36));
    c.roundRect(x, y, w, h, r); fill(c, shade(col, o.sh ?? 0.28));
    c.roundRect(px + (x - px) * s, py + (y - py) * s, w * s, h * s, r * s); fill(c, col);
    const hl = o.hl ?? 0.3;
    if (hl > 0) { c.roundRect(x + w * 0.16, y + h * 0.1, w * 0.42, Math.max(1.2, h * 0.13), Math.min(2, h * 0.06)); fill(c, light(col, 0.85), hl * 1.5); }
  }
  if (ow > 0) { c.roundRect(x, y, w, h, r); outline(c, ow, o.oc ?? OUT); }
}

function bbox(pts: number[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]);
    y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]);
  }
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

function scalePts(pts: number[], px: number, py: number, s: number): number[] {
  const out = new Array<number>(pts.length);
  for (let i = 0; i < pts.length; i += 2) { out[i] = px + (pts[i] - px) * s; out[i + 1] = py + (pts[i + 1] - py) * s; }
  return out;
}

/** Polygon with shade band + outline. Works for convex / star-shaped polygons (light anchor must see every edge). */
export function poly(c: Ctx, pts: number[], col: number, o: Tone = {}): void {
  const ow = o.ow ?? OW;
  if (o.flat || paint.mode) {
    c.poly(pts, true); fill(c, col);
  } else {
    const b = bbox(pts);
    const px = b.cx + b.w * (o.px ?? -0.2), py = b.cy + b.h * (o.py ?? -0.25);
    c.poly(pts, true); fill(c, shade(col, o.sh ?? 0.28));
    c.poly(scalePts(pts, px, py, o.inset ?? 0.84), true); fill(c, col);
    const hl = o.hl ?? 0;
    if (hl > 0) { c.poly(scalePts(pts, px, py, 0.4), true); fill(c, light(col, 0.85), hl); }
  }
  if (ow > 0) { c.poly(pts, true); outline(c, ow, o.oc ?? OUT); }
}

/** Smooth closed curve through control points (quadratic mid-point smoothing). */
export function blobPath(c: Ctx, pts: number[]): Ctx {
  const n = pts.length / 2;
  const mx = (i: number) => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2;
  const my = (i: number) => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
  c.moveTo(mx(n - 1), my(n - 1));
  for (let i = 0; i < n; i++) c.quadraticCurveTo(pts[i * 2], pts[i * 2 + 1], mx(i), my(i));
  return c.closePath();
}

/** Smooth blob with shade band + outline (star-shaped control polygons). */
export function blob(c: Ctx, pts: number[], col: number, o: Tone = {}): void {
  const ow = o.ow ?? OW;
  if (o.flat || paint.mode) {
    blobPath(c, pts); fill(c, col);
  } else {
    const b = bbox(pts);
    const px = b.cx + b.w * (o.px ?? -0.2), py = b.cy + b.h * (o.py ?? -0.25);
    blobPath(c, pts); fill(c, shade(col, o.sh ?? 0.28));
    blobPath(c, scalePts(pts, px, py, o.inset ?? 0.85)); fill(c, col);
    const hl = o.hl ?? 0;
    if (hl > 0) { blobPath(c, scalePts(pts, px - b.w * 0.05, py - b.h * 0.05, 0.38)); fill(c, light(col, 0.85), hl); }
  }
  if (ow > 0) { blobPath(c, pts); outline(c, ow, o.oc ?? OUT); }
}

/** Flat filled polygon (no tone) with optional outline. */
export function flat(c: Ctx, pts: number[], col: number, ow = OW, alpha = 1): void {
  c.poly(pts, true); fill(c, col, alpha);
  if (ow > 0) { c.poly(pts, true); outline(c, ow); }
}

/** Flat filled smooth blob. */
export function flatBlob(c: Ctx, pts: number[], col: number, ow = OW, alpha = 1): void {
  blobPath(c, pts); fill(c, col, alpha);
  if (ow > 0) { blobPath(c, pts); outline(c, ow); }
}

/** Soft highlight oval (colour mode only). */
export function gloss(c: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.45, col = 0xffffff): void {
  if (paint.mode) return;
  c.ellipse(x, y, rx, ry).fill({ color: col, alpha });
}

/** Translucent overlay shape that only exists in colour mode (inner shadows, tints). */
export function wash(c: Ctx, build: (c: Ctx) => void, col: number, alpha: number): void {
  if (paint.mode) return;
  build(c);
  c.fill({ color: col, alpha });
}

// ───────────────────────── small details ─────────────────────────

/** Tiny oval eye with a white glint. */
export function eye(c: Ctx, x: number, y: number, rx = 1.8, ry = 2.7, col = OUT, glint = true): void {
  c.ellipse(x, y, rx, ry); fill(c, col);
  if (glint && !paint.mode) c.circle(x + rx * 0.32, y - ry * 0.36, Math.max(0.6, rx * 0.45)).fill(0xffffff);
}

/** Four-point twinkle. */
export function spark(c: Ctx, x: number, y: number, r: number, col: number, alpha = 1): void {
  const k = r * 0.26;
  c.poly([x, y - r, x + k, y - k, x + r, y, x + k, y + k, x, y + r, x - k, y + k, x - r, y, x - k, y - k], true);
  fill(c, col, alpha);
}

export function rivet(c: Ctx, x: number, y: number, r = 1.05, col = 0xe8e0c8): void {
  if (paint.mode) return;
  c.circle(x + 0.25, y + 0.3, r + 0.45).fill({ color: OUT, alpha: 0.45 });
  c.circle(x, y, r).fill(col);
}

/** Faceted gem with a sparkle facet. */
export function gem(c: Ctx, x: number, y: number, r: number, col: number, ow = Math.max(1.1, r * 0.36)): void {
  const pts = [x, y - r, x + r * 0.86, y - r * 0.18, x + r * 0.52, y + r * 0.86, x - r * 0.52, y + r * 0.86, x - r * 0.86, y - r * 0.18];
  c.poly(pts, true); fill(c, col);
  if (!paint.mode) {
    c.poly([x - r * 0.52, y + r * 0.86, x + r * 0.52, y + r * 0.86, x + r * 0.86, y - r * 0.18, x + r * 0.2, y + r * 0.1], true).fill({ color: shade(col, 0.45), alpha: 0.75 });
    c.poly([x, y - r * 0.78, x + r * 0.42, y - r * 0.16, x - r * 0.1, y + r * 0.05, x - r * 0.5, y - r * 0.16], true).fill({ color: 0xffffff, alpha: 0.55 });
  }
  if (ow > 0) { c.poly(pts, true); outline(c, ow); }
}

export function star(c: Ctx, x: number, y: number, pts: number, ro: number, ri: number, col: number, ow = 0, rot = 0): void {
  c.star(x, y, pts, ro, ri, rot); fill(c, col);
  if (ow > 0) { c.star(x, y, pts, ro, ri, rot); outline(c, ow); }
}

/** Points along an ellipse arc. */
export function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 10): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  return out;
}

// ───────────────────────── graphics helpers ─────────────────────────

const ctxCache = new Map<string, GraphicsContext>();

/** Build (or reuse) a GraphicsContext for a key; shared between Graphics instances. */
export function cachedCtx(key: string, build: (c: Ctx) => void): GraphicsContext {
  let c = ctxCache.get(key);
  if (!c) {
    if (ctxCache.size > 3000) ctxCache.clear();
    c = new GraphicsContext();
    build(c);
    ctxCache.set(key, c);
  }
  return c;
}

/** One-off Graphics from a builder. */
export function make(build: (c: Ctx) => void, mode: 0 | 1 | 2 = 0): Graphics {
  const c = new GraphicsContext();
  const prev = paint.mode;
  paint.mode = mode;
  try { build(c); } finally { paint.mode = prev; }
  return new Graphics(c);
}
