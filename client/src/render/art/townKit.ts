// Canvas2D paint kit for the new Hearthmere (docs/rework/DESIGN.md §4): colour helpers, deterministic noise, soft
// region masks and the material painters shared by ground, buildings and scenery. Light comes from the upper left.
import type { Point } from '@shared/townTypes';

export type Paint = CanvasRenderingContext2D;
export const INK = '#1e1612';

export function hash(x: number, y: number, seed = 0): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 144269);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise in [0,1]. */
export function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, seed: number, oct = 3): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(x * f, y * f, seed + i * 31) * a; n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

// ─────────────────────────── colour ───────────────────────────

export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
export function hexOf(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** Multiply brightness (k > 1 lighter, < 1 darker), shifting shadows a little towards cool plum (art direction §1). */
export function tone(hex: string, k: number): string {
  const [r, g, b] = rgb(hex);
  if (k >= 1) { const t = Math.min(1, k - 1); return hexOf(r + (255 - r) * t * 0.55 + 8 * t, g + (244 - g) * t * 0.5, b + (214 - b) * t * 0.42); }
  const t = 1 - k;
  return hexOf(r * k + 34 * t * 0.5, g * k + 22 * t * 0.45, b * k + 48 * t * 0.6);
}
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a), [br, bg, bb] = rgb(b);
  return hexOf(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}
export function rgba(hex: string, a: number): string { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }

// ─────────────────────────── shapes ───────────────────────────

export function poly(c: Paint, p: readonly Point[], fill?: string, stroke?: string, width = 1) {
  c.beginPath(); p.forEach((v, i) => (i ? c.lineTo(v[0], v[1]) : c.moveTo(v[0], v[1]))); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.stroke(); }
}
export function line(c: Paint, p: readonly Point[], color: string, width = 1, cap: CanvasLineCap = 'round') {
  c.beginPath(); p.forEach((v, i) => (i ? c.lineTo(v[0], v[1]) : c.moveTo(v[0], v[1])));
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = cap; c.lineJoin = 'round'; c.stroke();
}
export function ellipse(c: Paint, x: number, y: number, rx: number, ry: number, fill?: string, stroke?: string, width = 1) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
export function rrect(c: Paint, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, width = 1) {
  c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
export function pathOf(p: readonly Point[]): Path2D {
  const path = new Path2D(); p.forEach((v, i) => (i ? path.lineTo(v[0], v[1]) : path.moveTo(v[0], v[1]))); path.closePath(); return path;
}
export function bounds(p: readonly Point[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of p) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}
/** Organic outline: subdivide every edge and push points along the edge normal with value noise (deterministic). */
export function wobble(p: readonly Point[], step: number, amp: number, seed: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = (b[1] - a[1]) / (len || 1), ny = -(b[0] - a[0]) / (len || 1), n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      const w = (vnoise(x / 70, y / 70, seed) - 0.5) * 2 * amp;
      out.push([x + nx * w, y + ny * w]);
    }
  }
  return out;
}
/** Polyline road as a polygon of the given width (miter-free, rounded by wobble later). */
export function strokePolygon(path: readonly Point[], width: number): Point[] {
  const left: Point[] = [], right: Point[] = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * width / 2, ny = dx / l * width / 2;
    left.push([path[i][0] + nx, path[i][1] + ny]); right.push([path[i][0] - nx, path[i][1] - ny]);
  }
  return [...left, ...right.reverse()];
}
export function inPoly(x: number, y: number, p: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

// ─────────────────────────── soft masks ───────────────────────────

const pool: HTMLCanvasElement[] = [];
function canvas(w: number, h: number): HTMLCanvasElement {
  const c = pool.pop() ?? document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c;
}
export interface Rect { x0: number; y0: number; x1: number; y1: number }
/** Paint `draw` only inside `area` (world coords) with a soft feathered edge, touching only `rect` (the area's bounds
 *  clipped to the chunk, so small regions stay cheap). `c` is the chunk context in world space, (cx, cy) the chunk
 *  origin, `px` its pixel density. The mask grid is snapped to world multiples of `feather` so chunks agree. */
export function region(c: Paint, area: Path2D, cx: number, cy: number, px: number, rect: Rect, feather: number, draw: (m: Paint, r: Rect) => void) {
  const f = Math.max(2, feather);
  const r: Rect = { x0: Math.floor(rect.x0 / f) * f, y0: Math.floor(rect.y0 / f) * f, x1: Math.ceil(rect.x1 / f) * f, y1: Math.ceil(rect.y1 / f) * f };
  const rw = r.x1 - r.x0, rh = r.y1 - r.y0;
  if (rw <= 0 || rh <= 0) return;
  const W = Math.ceil(rw * px), H = Math.ceil(rh * px);
  const layer = canvas(W, H), g = layer.getContext('2d')!;
  g.setTransform(px, 0, 0, px, -r.x0 * px, -r.y0 * px);
  draw(g, r);
  const lw = Math.max(2, Math.round(rw / f)), lh = Math.max(2, Math.round(rh / f));
  const mask = canvas(lw, lh), s = mask.getContext('2d')!;
  s.setTransform(lw / rw, 0, 0, lh / rh, (-r.x0 * lw) / rw, (-r.y0 * lh) / rh);
  s.fillStyle = '#fff'; s.fill(area);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(mask, 0, 0, W, H);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(layer, Math.round((r.x0 - cx) * px), Math.round((r.y0 - cy) * px)); c.restore();
  pool.push(layer, mask);
}

// ─────────────────────────── material painters (world space, inside a chunk window) ───────────────────────────

export interface Win { x0: number; y0: number; x1: number; y1: number; seed: number }

/** Sample `shade(x, y)` (brightness factor) on a world grid of `cell` units and draw it smoothly upscaled over `w`.
 *  Samples sit on global grid points, so neighbouring chunks interpolate identically across their seam. */
export function shadeField(c: Paint, w: Win, base: string, cell: number, shade: (x: number, y: number) => number) {
  const [r, g, b] = rgb(base);
  const gx0 = Math.floor(w.x0 / cell) - 1, gy0 = Math.floor(w.y0 / cell) - 1, nx = Math.ceil(w.x1 / cell) + 2 - gx0, ny = Math.ceil(w.y1 / cell) + 2 - gy0;
  const cv = canvas(nx, ny), g2 = cv.getContext('2d')!, img = g2.createImageData(nx, ny), d = img.data;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = shade((gx0 + i) * cell, (gy0 + j) * cell), o = (j * nx + i) * 4;
    d[o] = r * k; d[o + 1] = g * k; d[o + 2] = b * k; d[o + 3] = 255;
  }
  g2.putImageData(img, 0, 0);
  const smooth = c.imageSmoothingEnabled, quality = c.imageSmoothingQuality;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(cv, gx0 * cell - cell / 2, gy0 * cell - cell / 2, nx * cell, ny * cell);
  c.imageSmoothingEnabled = smooth; c.imageSmoothingQuality = quality;
  pool.push(cv);
}
export function fillNoise(c: Paint, w: Win, base: string, varAmt: number, scale: number, seed: number, cell = 8) {
  shadeField(c, w, base, cell, (x, y) => 1 + (fbm(x / scale, y / scale, seed) - 0.5) * varAmt + (hash(x, y, seed) - 0.5) * varAmt * 0.25);
}

export function cobbles(c: Paint, w: Win, base: string, seed: number, sz = 22) {
  fillNoise(c, w, tone(base, 0.62), 0.25, 140, seed + 3, 10);
  const rows = sz * 0.62;
  for (let row = Math.floor(w.y0 / rows) - 1; row < w.y1 / rows + 1; row++) {
    const off = (row % 2) * sz * 0.5;
    for (let col = Math.floor(w.x0 / sz) - 1; col < w.x1 / sz + 1; col++) {
      const n = hash(col, row, seed), m = hash(row, col, seed + 7);
      const x = col * sz + off + (n - 0.5) * 4, y = row * rows + (m - 0.5) * 3;
      const ww = sz * (0.78 + n * 0.16), hh = rows * (0.78 + m * 0.14);
      const k = 0.86 + n * 0.22 + (fbm(x / 160, y / 160, seed) - 0.5) * 0.3;
      rrect(c, x - ww / 2, y - hh / 2, ww, hh, hh * 0.42, tone(base, k));
      c.fillStyle = 'rgba(255,240,210,0.13)'; c.fillRect(x - ww / 2 + 2, y - hh / 2 + 1.2, ww - 5, 1.6);
      c.fillStyle = 'rgba(20,14,22,0.22)'; c.fillRect(x - ww / 2 + 2, y + hh / 2 - 2.2, ww - 4, 1.6);
    }
  }
}

export function flagstones(c: Paint, w: Win, base: string, seed: number) {
  fillNoise(c, w, tone(base, 0.56), 0.2, 150, seed + 5, 10);
  const cell = 34, rowH = cell * 0.7;
  for (let gy = Math.floor(w.y0 / rowH) - 1; gy < w.y1 / rowH + 1; gy++) for (let gx = Math.floor(w.x0 / cell) - 1; gx < w.x1 / cell + 1; gx++) {
    const n = hash(gx, gy, seed), jx = (hash(gx, gy, seed + 1) - 0.5) * 6, jy = (hash(gx, gy, seed + 2) - 0.5) * 5;
    // some neighbouring pairs merge into one long slab (decided per pair so the odd half never leaves a gap)
    const wide = hash(gy, Math.floor(gx / 2), seed + 4) > 0.72 ? 2 : 1;
    if (wide > 1 && ((gx % 2) + 2) % 2 !== 0) continue;
    const x = gx * cell + jx + (gy % 2) * cell * 0.5, y = gy * rowH + jy, ww = cell * wide * (0.86 + n * 0.08), hh = rowH * (0.84 + hash(gy, gx, seed) * 0.1);
    const k = 0.82 + n * 0.22 + (fbm(x / 200, y / 200, seed + 9) - 0.5) * 0.26;
    const col = mixHex(tone(base, k), '#a4876a', hash(gx, gy, seed + 6) * 0.25);
    poly(c, [[x + 3, y], [x + ww - 3, y + 0.8], [x + ww, y + 3], [x + ww - 0.6, y + hh - 3], [x + ww - 4, y + hh], [x + 3, y + hh - 0.6], [x, y + hh - 4], [x + 0.6, y + 3]], col, 'rgba(20,16,18,0.22)', 1);
    c.fillStyle = 'rgba(255,240,215,0.11)'; c.fillRect(x + 4, y + 1.4, ww - 9, 1.4);
    c.fillStyle = 'rgba(20,14,20,0.12)'; c.fillRect(x + 3, y + hh - 2.6, ww - 7, 1.6);
    if (n > 0.9) { const cx0 = x + ww * (0.2 + hash(gx, gy, seed + 7) * 0.5); line(c, [[cx0, y + 1], [cx0 + 3, y + hh * 0.35], [cx0 + 1, y + hh * 0.6], [cx0 + 5, y + hh * 0.8]], 'rgba(25,18,22,0.4)', 0.9); }
  }
}

export function planks(c: Paint, w: Win, base: string, seed: number, vertical = false) {
  const bw = 15;
  if (!vertical) for (let row = Math.floor(w.y0 / bw) - 1; row < w.y1 / bw + 1; row++) {
    const y = row * bw;
    for (let x = Math.floor(w.x0 / 140) * 140 - (row % 3) * 47; x < w.x1; x += 140) {
      const n = hash(Math.round(x), row, seed), k = 0.82 + n * 0.3;
      c.fillStyle = tone(base, k); c.fillRect(x, y, 139, bw - 1.6);
      c.fillStyle = 'rgba(255,230,190,0.12)'; c.fillRect(x, y + 1, 139, 1.4);
      c.fillStyle = 'rgba(18,12,10,0.6)'; c.fillRect(x + 137, y, 2, bw);
      c.fillStyle = 'rgba(18,12,10,0.45)'; c.fillRect(x, y + bw - 1.6, 139, 1.6);
      c.fillStyle = 'rgba(30,20,16,0.5)'; c.fillRect(x + 6, y + 6, 2, 2); c.fillRect(x + 130, y + 6, 2, 2);
    }
  } else for (let col = Math.floor(w.x0 / bw) - 1; col < w.x1 / bw + 1; col++) {
    const x = col * bw, n = hash(col, 0, seed), k = 0.82 + n * 0.3;
    c.fillStyle = tone(base, k); c.fillRect(x, w.y0, bw - 1.6, w.y1 - w.y0);
    c.fillStyle = 'rgba(18,12,10,0.5)'; c.fillRect(x + bw - 1.6, w.y0, 1.6, w.y1 - w.y0);
  }
}

export function grass(c: Paint, w: Win, base: string, seed: number, density = 1) {
  fillNoise(c, w, base, 0.34, 120, seed, 8);
  const n = Math.round((w.x1 - w.x0) * (w.y1 - w.y0) / 260 * density);
  for (let i = 0; i < n; i++) {
    const x = w.x0 + hash(i, 1, seed) * (w.x1 - w.x0), y = w.y0 + hash(i, 2, seed) * (w.y1 - w.y0), h = 4 + hash(i, 3, seed) * 6;
    const k = 0.8 + hash(i, 4, seed) * 0.5;
    line(c, [[x, y], [x - 1.5 + hash(i, 5, seed) * 3, y - h]], tone(base, k * 1.12), 1.4);
  }
}

export function sand(c: Paint, w: Win, base: string, seed: number) {
  fillNoise(c, w, base, 0.18, 90, seed, 8);
  for (let i = 0; i < (w.x1 - w.x0) * (w.y1 - w.y0) / 90; i++) {
    const x = w.x0 + hash(i, 7, seed) * (w.x1 - w.x0), y = w.y0 + hash(i, 8, seed) * (w.y1 - w.y0);
    c.fillStyle = hash(i, 9, seed) > 0.5 ? 'rgba(255,240,210,0.16)' : 'rgba(40,30,30,0.14)';
    c.fillRect(x, y, 1.6, 1.2);
  }
}

export function dirt(c: Paint, w: Win, base: string, seed: number) {
  fillNoise(c, w, base, 0.3, 110, seed, 8);
  for (let i = 0; i < (w.x1 - w.x0) * (w.y1 - w.y0) / 520; i++) {
    const x = w.x0 + hash(i, 11, seed) * (w.x1 - w.x0), y = w.y0 + hash(i, 12, seed) * (w.y1 - w.y0), r = 1.4 + hash(i, 13, seed) * 2.6;
    ellipse(c, x, y, r, r * 0.7, tone(base, 0.74 + hash(i, 14, seed) * 0.5));
  }
}
