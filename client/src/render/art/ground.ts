// Ground: tiles are painted into 512-unit chunk textures with Canvas2D (per-pixel terrain field at half
// resolution for soft organic edges, then crisp vector detail and baked decals on top). Chunks are baked
// lazily around the camera with a small per-frame budget and evicted LRU-style, so even the largest maps
// cost a handful of textures and zero per-frame tessellation.

import { CanvasSource, Container, Matrix, Sprite, Texture, type Renderer } from 'pixi.js';
import { T_FLOOR, T_PATH, T_PLAZA, T_VOID, T_WALL, T_WATER, type MapData } from '@shared/mapgen';
import type { Sheet } from './bake';
import { GROUND, type GroundPalette, type ThemeKey } from './palette';
import { clamp, hash2, mix, rgb, rgba, vnoise } from './util';

export const CHUNK = 512;
const FS = 4;                    // world units per terrain-field texel
const HALF = CHUNK / FS;         // terrain field resolution
const MAX_CHUNKS = 44;

export interface GroundShadow { x: number; y: number; rx: number; ry: number; a: number }
export interface GroundDecal { tex: Texture; x: number; y: number; s: number; flip: boolean }

interface Field { path: Float32Array; plaza: Float32Array; wall: Float32Array; water: Float32Array; uni: Int8Array }

const K_FLOOR = 0, K_PATH = 1, K_PLAZA = 2, K_WALL = 3, K_WATER = 5;
function kindOf(t: number): number {
  return t === T_PATH ? K_PATH : t === T_PLAZA ? K_PLAZA : t === T_WATER ? K_WATER : t === T_WALL || t === T_VOID ? K_WALL : K_FLOOR;
}

function buildField(map: MapData): Field {
  const n = map.w * map.h;
  const f: Field = { path: new Float32Array(n), plaza: new Float32Array(n), wall: new Float32Array(n), water: new Float32Array(n), uni: new Int8Array(n) };
  for (let i = 0; i < n; i++) {
    const t = map.tiles[i];
    if (t === T_PATH) f.path[i] = 1;
    else if (t === T_PLAZA) f.plaza[i] = 1;
    else if (t === T_WALL || t === T_VOID) f.wall[i] = 1;
    else if (t === T_WATER) f.water[i] = 1;
  }
  // a bilinear cell (i, j)..(i+1, j+1) is uniform when its four tiles share a kind (fast path)
  const W = map.w, H = map.h;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const i1 = Math.min(W - 1, i + 1), j1 = Math.min(H - 1, j + 1);
    const a = kindOf(map.tiles[j * W + i]);
    f.uni[j * W + i] = a === kindOf(map.tiles[j * W + i1]) && a === kindOf(map.tiles[j1 * W + i]) && a === kindOf(map.tiles[j1 * W + i1]) ? a : -1;
  }
  return f;
}

export class GroundLayer extends Container {
  private chunks = new Map<number, { sprite: Sprite; used: number }>();
  private frame = 0;
  private readonly field: Field;
  private readonly pal: GroundPalette;
  private readonly cols: number;
  private readonly rows: number;
  private readonly seed: number;
  private readonly rift: boolean;
  private plazaC: { x: number; y: number } | null = null;
  private plazaR = 0;
  private shadows: GroundShadow[][] = [];
  private decals: GroundDecal[][] = [];
  private canvasCache: HTMLCanvasElement[] = [];
  private tmp = new Matrix();

  constructor(private readonly map: MapData, private readonly theme: ThemeKey) {
    super();
    this.field = buildField(map);
    this.pal = GROUND[theme];
    this.cols = Math.ceil((map.w * 64) / CHUNK);
    this.rows = Math.ceil((map.h * 64) / CHUNK);
    this.seed = (map.seed >>> 0) % 100000;
    this.rift = map.zone === 'rift';
    for (let i = 0; i < this.cols * this.rows; i++) { this.shadows.push([]); this.decals.push([]); }
    // plaza centroid (town: stones are laid in concentric rings)
    let sx = 0, sy = 0, sn = 0;
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.tiles[y * map.w + x] === T_PLAZA) { sx += x; sy += y; sn++; }
    if (sn > 20) { this.plazaC = { x: (sx / sn) * 64 + 32, y: (sy / sn) * 64 + 32 }; this.plazaR = Math.sqrt(sn / Math.PI) * 64 + 10; }
    this.onRender = (r: Renderer) => this.manage(r);
  }

  /** Register a soft ground shadow (prop bases). */
  addShadow(s: GroundShadow): void { this.bucket(this.shadows, s.x, s.y, s.rx + 8, s.ry + 8, s); }
  /** Register a decal stamp. */
  addDecal(d: GroundDecal, r: number): void { this.bucket(this.decals, d.x, d.y, r, r, d); }

  private bucket<T>(arr: T[][], x: number, y: number, rx: number, ry: number, item: T): void {
    const c0 = Math.max(0, Math.floor((x - rx) / CHUNK)), c1 = Math.min(this.cols - 1, Math.floor((x + rx) / CHUNK));
    const r0 = Math.max(0, Math.floor((y - ry) / CHUNK)), r1 = Math.min(this.rows - 1, Math.floor((y + ry) / CHUNK));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) arr[r * this.cols + c].push(item);
  }

  /** Bake every chunk intersecting a world rectangle now (used for the first frame). */
  prebake(x0: number, y0: number, x1: number, y1: number, limit = 20): void {
    let n = 0;
    for (let r = Math.max(0, Math.floor(y0 / CHUNK)); r <= Math.min(this.rows - 1, Math.floor(y1 / CHUNK)); r++) {
      for (let c = Math.max(0, Math.floor(x0 / CHUNK)); c <= Math.min(this.cols - 1, Math.floor(x1 / CHUNK)); c++) {
        if (n++ >= limit) return;
        this.ensure(c, r);
      }
    }
  }

  private manage(renderer: Renderer): void {
    this.frame++;
    const m = this.getGlobalTransform(this.tmp, false);
    const det = m.a * m.d - m.b * m.c;
    if (!det) return;
    const scr = renderer.screen;
    // invert the 4 screen corners into local space
    const inv = (sx: number, sy: number) => {
      const x = sx - m.tx, y = sy - m.ty;
      return { x: (m.d * x - m.c * y) / det, y: (-m.b * x + m.a * y) / det };
    };
    const p0 = inv(0, 0), p1 = inv(scr.width, scr.height);
    const x0 = Math.min(p0.x, p1.x), x1 = Math.max(p0.x, p1.x), y0 = Math.min(p0.y, p1.y), y1 = Math.max(p0.y, p1.y);
    const c0 = Math.max(0, Math.floor(x0 / CHUNK)), c1 = Math.min(this.cols - 1, Math.floor(x1 / CHUNK));
    const r0 = Math.max(0, Math.floor(y0 / CHUNK)), r1 = Math.min(this.rows - 1, Math.floor(y1 / CHUNK));
    // visible chunks first (bake up to 3 if any are missing so the screen never shows holes for long)
    let budget = 3;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const ch = this.chunks.get(r * this.cols + c);
      if (ch) { ch.used = this.frame; ch.sprite.visible = true; }
      else if (budget-- > 0) this.ensure(c, r);
    }
    // prefetch one ring around the view (1 per frame)
    if (budget === 3) {
      outer: for (let r = Math.max(0, r0 - 1); r <= Math.min(this.rows - 1, r1 + 1); r++) for (let c = Math.max(0, c0 - 1); c <= Math.min(this.cols - 1, c1 + 1); c++) {
        if (!this.chunks.has(r * this.cols + c)) { this.ensure(c, r); break outer; }
      }
    }
    // hide off-screen chunks, evict the least recently used beyond the cap
    for (const [k, ch] of this.chunks) {
      const c = k % this.cols, r = (k / this.cols) | 0;
      const vis = c >= c0 && c <= c1 && r >= r0 && r <= r1;
      ch.sprite.visible = vis;
      if (vis) ch.used = this.frame;
    }
    if (this.chunks.size > MAX_CHUNKS) {
      const sorted = [...this.chunks.entries()].sort((a, b) => a[1].used - b[1].used);
      for (let i = 0; i < sorted.length - MAX_CHUNKS; i++) {
        const [k, ch] = sorted[i];
        if (ch.used === this.frame) break;
        const res = ch.sprite.texture.source.resource as HTMLCanvasElement;
        ch.sprite.texture.destroy(true);
        ch.sprite.destroy();
        this.chunks.delete(k);
        if (this.canvasCache.length < 6 && res) this.canvasCache.push(res);
      }
    }
  }

  private ensure(c: number, r: number): void {
    const key = r * this.cols + c;
    if (this.chunks.has(key)) return;
    const canvas = this.paint(c, r);
    const source = new CanvasSource({ resource: canvas, resolution: 1, scaleMode: 'linear', autoGenerateMipmaps: true });
    const sprite = new Sprite(new Texture({ source }));
    sprite.position.set(c * CHUNK, r * CHUNK);
    this.addChild(sprite);
    this.chunks.set(key, { sprite, used: this.frame });
  }

  // ───────────────────────── painting ─────────────────────────

  private sample(arr: Float32Array, wx: number, wy: number): number {
    const w = this.map.w, h = this.map.h;
    const u = wx / 64 - 0.5, v = wy / 64 - 0.5;
    let i0 = Math.floor(u), j0 = Math.floor(v);
    let fu = u - i0, fv = v - j0;
    fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv);
    const i1 = Math.min(w - 1, Math.max(0, i0 + 1)), j1 = Math.min(h - 1, Math.max(0, j0 + 1));
    i0 = Math.min(w - 1, Math.max(0, i0)); j0 = Math.min(h - 1, Math.max(0, j0));
    const a = arr[j0 * w + i0], b = arr[j0 * w + i1], cc = arr[j1 * w + i0], d = arr[j1 * w + i1];
    return a + (b - a) * fu + (cc - a) * fv + (a - b - cc + d) * fu * fv;
  }

  private paint(c: number, r: number): HTMLCanvasElement {
    const canvas = this.canvasCache.pop() ?? document.createElement('canvas');
    canvas.width = CHUNK; canvas.height = CHUNK;
    const ctx = canvas.getContext('2d')!;
    const P = this.pal;
    const ox = c * CHUNK, oy = r * CHUNK;
    const seed = this.seed;

    const T0 = performance.now();
    // ── 1. terrain field (half resolution)
    const small = document.createElement('canvas');
    small.width = HALF; small.height = HALF;
    const sctx = small.getContext('2d')!;
    const img = sctx.createImageData(HALF, HALF);
    const d = img.data;
    const cls = new Uint8Array(HALF * HALF); // 0 floor 1 path 2 plaza 3 wall-top 4 face 5 water
    const F = this.field;
    const fl = rgb(P.floor), fd = rgb(P.floorDark), fli = rgb(P.floorLight), sp = rgb(P.speck);
    const pa = rgb(P.path), pd = rgb(P.pathDark), pl = rgb(P.pathLight), pe = rgb(P.pathEdge);
    const st = rgb(P.stone), wt = rgb(P.wallTop), wtl = rgb(P.wallTopLight), fa = rgb(P.face), fad = rgb(P.faceDark), fal = rgb(P.faceLight);
    const lq = rgb(P.liquid), lqd = rgb(P.liquidDeep), lqe = rgb(P.liquidEdge), ao = rgb(P.ao);
    const forest = this.theme === 'town' || this.theme === 'glade';
    const FH = forest ? 14 : 26; // visible wall face height
    const mixc = (a: number[], b: number[], t: number, out: number[]) => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; };
    const col = [0, 0, 0], tmp = [0, 0, 0];
    const ss = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

    // coarse noise grids (8 units) – bilinear per texel is far cheaper than value noise per texel
    const GS = 8, GN = CHUNK / GS + 2;
    const g1 = new Float32Array(GN * GN), g2 = new Float32Array(GN * GN);
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
      const wx = ox + i * GS, wy = oy + j * GS;
      g1[j * GN + i] = vnoise(seed, wx / 110, wy / 110);
      g2[j * GN + i] = vnoise(seed + 7, wx / 34, wy / 34);
    }
    const mw = this.map.w, mh = this.map.h;
    const uni = F.uni;
    // kind of the bilinear cell at a point, or -1 when mixed
    const cellKind = (wx: number, wy: number): number => {
      let i = Math.floor(wx / 64 - 0.5), j = Math.floor(wy / 64 - 0.5);
      if (i < 0) i = 0; else if (i >= mw) i = mw - 1;
      if (j < 0) j = 0; else if (j >= mh) j = mh - 1;
      return uni[j * mw + i];
    };
    const wallAt = (wx: number, wy: number, e: number): number => {
      const k = cellKind(wx, wy);
      if (k >= 0) return k === K_WALL ? 1 : 0;
      return this.sample(F.wall, wx, wy) + e;
    };

    for (let py = 0; py < HALF; py++) {
      const wy = oy + (py + 0.5) * FS;
      const gy = ((py + 0.5) * FS) / GS, gj = Math.floor(gy), fy = gy - gj;
      for (let px = 0; px < HALF; px++) {
        const wx = ox + (px + 0.5) * FS;
        const gx = ((px + 0.5) * FS) / GS, gi = Math.floor(gx), fx = gx - gi;
        const q = gj * GN + gi;
        const n1 = (g1[q] * (1 - fx) + g1[q + 1] * fx) * (1 - fy) + (g1[q + GN] * (1 - fx) + g1[q + GN + 1] * fx) * fy;
        const n2 = (g2[q] * (1 - fx) + g2[q + 1] * fx) * (1 - fy) + (g2[q + GN] * (1 - fx) + g2[q + GN + 1] * fx) * fy;
        const h = hash2(px + c * 977, py + r * 613, seed);
        let e = (n1 - 0.5) * 0.34 + (n2 - 0.5) * 0.2 + (h - 0.5) * 0.04;
        if (e > 0.45) e = 0.45; else if (e < -0.45) e = -0.45;
        // base floor tone: broad patches + fine mottling
        const tone = clamp(0.5 + (n1 - 0.5) * 0.8 + (n2 - 0.5) * 0.36 + (h - 0.5) * 0.06);
        if (tone < 0.5) mixc(fd, fl, tone * 2, col); else mixc(fl, fli, (tone - 0.5) * 2, col);
        if (h > 0.986) mixc(col, sp, 0.55, col);
        else if (h < 0.012) mixc(col, fd, 0.5, col);
        let k = 0;

        const ck = cellKind(wx, wy);
        let mWall: number, mWater: number, mPath: number, mPlaza: number;
        if (ck >= 0) {
          mWall = ck === K_WALL ? 1 : 0; mWater = ck === K_WATER ? 1 : 0; mPath = ck === K_PATH ? 1 : 0; mPlaza = ck === K_PLAZA ? 1 : 0;
        } else {
          mWall = this.sample(F.wall, wx, wy) + e;
          mWater = this.sample(F.water, wx, wy) + e * 0.7;
          mPath = this.sample(F.path, wx, wy) + e * 0.9;
          mPlaza = this.sample(F.plaza, wx, wy) + e * 0.35;
        }

        if (mWall < 0.5) {
          // ambient occlusion near walls + cast shadow below / right of wall masses (light from the upper left)
          const aoK = ss(0.18, 0.5, mWall) * 0.42;
          const mS = wallAt(wx - 10, wy - 22, e);
          const shd = ss(0.4, 0.6, mS) * 0.32;
          if (aoK + shd > 0) mixc(col, ao, Math.min(0.6, aoK + shd), col);
        }

        if (this.plazaC) {
          // the town square is a true circle (tiles are only an approximation of it)
          const dd = Math.hypot(wx - this.plazaC.x, wy - this.plazaC.y);
          mPlaza = 1 - ss(this.plazaR - 3, this.plazaR + 3, dd);
          if (mPlaza > 0.5) { mPath = 0; }
        }
        if (mPlaza > 0.5) {
          const t = ss(0.5, 0.56, mPlaza);
          mixc(col, st, t, col);
          k = 2;
        } else if (mPath > 0.5) {
          const pt = clamp(0.5 + (n1 - 0.5) * 0.5 + (n2 - 0.5) * 0.6 + (h - 0.5) * 0.12);
          if (pt < 0.5) mixc(pd, pa, pt * 2, tmp); else mixc(pa, pl, (pt - 0.5) * 2, tmp);
          const edge = 1 - ss(0.5, 0.6, mPath);
          mixc(tmp, pe, edge * 0.55, tmp);
          mixc(col, tmp, ss(0.5, 0.53, mPath), col);
          k = 1;
        } else if (mPath > 0.42) {
          mixc(col, pe, (mPath - 0.42) * 1.6, col);
        }

        if (mWater > 0.5) {
          const deep = ss(0.62, 1.05, mWater);
          mixc(lq, lqd, deep, tmp);
          const rip = n2 * 0.6 + h * 0.4;
          mixc(tmp, P.liquidGlow ? [255, 214, 120] : [255, 255, 255], Math.max(0, rip - 0.72) * (P.liquidGlow ? 1.6 : 0.9), tmp);
          mixc(tmp, lqe, (1 - ss(0.5, 0.58, mWater)) * 0.85, tmp);
          col[0] = tmp[0]; col[1] = tmp[1]; col[2] = tmp[2];
          k = 5;
        } else if (mWater > 0.38) {
          mixc(col, P.liquidGlow ? [40, 20, 16] : ao, (mWater - 0.38) * 2.6, col);
        }

        if (mWall > 0.5) {
          const below = wallAt(wx, wy + FH, e);
          if (below < 0.5) {
            if (forest) mixc(fa, fad, clamp((0.5 - below) * 3), tmp);
            else {
              // cliff face: strata, darker towards the foot
              const strata = Math.sin(wy * 0.5 + n2 * 6) * 0.5 + 0.5;
              mixc(fal, fa, ss(0, 1, (0.5 - below) * 2), tmp);
              mixc(tmp, fad, strata * 0.35, tmp);
            }
            k = 4;
          } else {
            const wtone = clamp(0.5 + (n2 - 0.5) * 1.4 + (h - 0.5) * 0.3);
            mixc(wt, wtl, wtone, tmp);
            if (forest) mixc(tmp, [12, 22, 10], Math.max(0, n2 - 0.55) * 1.3, tmp);
            if (wallAt(wx, wy - 6, e) < 0.5) mixc(tmp, fal, 0.6, tmp);
            k = 3;
          }
          col[0] = tmp[0]; col[1] = tmp[1]; col[2] = tmp[2];
        }
        cls[py * HALF + px] = k;
        const o = (py * HALF + px) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
    }
    const T1 = performance.now();
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, CHUNK, CHUNK);

    const at = (wx: number, wy: number) => {
      const px = Math.floor((wx - ox) / FS), py = Math.floor((wy - oy) / FS);
      if (px < 0 || py < 0 || px >= HALF || py >= HALF) {
        // outside this chunk: classify from the tile grid
        const tx = Math.floor(wx / 64), ty = Math.floor(wy / 64);
        const t = tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h ? T_WALL : this.map.tiles[ty * this.map.w + tx];
        return t === T_PLAZA ? 2 : t === T_PATH ? 1 : t === T_WATER ? 5 : t === T_WALL || t === T_VOID ? 3 : 0;
      }
      return cls[py * HALF + px];
    };

    const T2 = performance.now();
    ctx.save();
    ctx.translate(-ox, -oy);
    this.paintDetails(ctx, ox, oy, at);
    const T3 = performance.now();
    // prop shadows
    for (const s of this.shadows[r * this.cols + c]) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(1, s.ry / s.rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.rx);
      g.addColorStop(0, rgba(P.ao, 0.42 * s.a)); g.addColorStop(0.6, rgba(P.ao, 0.26 * s.a)); g.addColorStop(1, rgba(P.ao, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, s.rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // decals
    for (const dcl of this.decals[r * this.cols + c]) {
      const tex = dcl.tex;
      const src = tex.source.resource as CanvasImageSource;
      const res = tex.source.resolution;
      const fr = tex.frame;
      const a = tex.defaultAnchor ?? { x: 0, y: 0 };
      const w = fr.width * dcl.s, h = fr.height * dcl.s;
      ctx.save();
      ctx.translate(dcl.x, dcl.y);
      if (dcl.flip) ctx.scale(-1, 1);
      ctx.drawImage(src, fr.x * res, fr.y * res, fr.width * res, fr.height * res, -a.x * w, -a.y * h, w, h);
      ctx.restore();
    }
    ctx.restore();
    const T4 = performance.now();
    const g = globalThis as { __chunkT?: number[] };
    g.__chunkT = (g.__chunkT ?? [0, 0, 0, 0]).map((v, i) => v + [T1 - T0, T2 - T1, T3 - T2, T4 - T3][i]);
    return canvas;
  }

  /** Crisp vector detail: cobbles, flagstones, grass strokes, cliff strata, shore ripples. */
  private paintDetails(ctx: CanvasRenderingContext2D, ox: number, oy: number, at: (x: number, y: number) => number): void {
    const P = this.pal;
    const seed = this.seed;
    const th = this.theme;
    const x0 = ox - 24, y0 = oy - 24, x1 = ox + CHUNK + 24, y1 = oy + CHUNK + 24;
    const H = (x: number, y: number, s = 0) => hash2(Math.floor(x), Math.floor(y), seed + s);

    // ── plaza cobbles
    const stoneCol = (h: number) => mix(P.stone, h < 0.5 ? P.stoneLight : mix(P.stone, P.grout, 0.25), Math.abs(h - 0.5) * 0.9);
    ctx.lineJoin = 'round';
    if (this.plazaC) {
      const pc = this.plazaC, R = this.plazaR;
      const rMax = Math.min(R - 16, Math.hypot(Math.max(Math.abs(x0 - pc.x), Math.abs(x1 - pc.x)), Math.max(Math.abs(y0 - pc.y), Math.abs(y1 - pc.y))));
      const mosaic = 96;
      for (let ring = 0; ring * 13 < rMax; ring++) {
        const rr = 8 + ring * 13;
        if (rr > R - 18) break;
        const n = Math.max(6, Math.round((Math.PI * 2 * rr) / 15));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + (ring % 2) * (Math.PI / n);
          const x = pc.x + Math.cos(a) * rr, y = pc.y + Math.sin(a) * rr;
          if (x < x0 || x > x1 || y < y0 || y > y1) continue;
          const h = H(ring * 131 + i, 7);
          // central hearth mosaic: warm sun rays in the inner rings
          let fillc = stoneCol(h);
          if (rr < mosaic) {
            const ray = Math.cos(a * 8) > 0.55;
            fillc = rr < 22 ? mix(0xe0a24a, 0xf2c86a, h) : ray ? mix(0xc98a4a, 0xe0a860, h) : mix(P.stone, 0x8a7a66, 0.35 + h * 0.2);
          } else if (Math.abs(rr - mosaic - 6) < 7) fillc = mix(0x7a6a58, P.grout, 0.2 + h * 0.2);
          ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
          ctx.fillStyle = rgba(fillc);
          ctx.strokeStyle = rgba(P.grout, 0.5); ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.roundRect(-6.4, -5.2, 12.8, 10.4, 3.4); ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.roundRect(-5, -4, 7, 2.4, 1.2); ctx.fill();
          ctx.restore();
        }
      }
      // curb of long slabs around the square
      const cr = R - 9;
      const nC = Math.round((Math.PI * 2 * cr) / 30);
      for (let i = 0; i < nC; i++) {
        const a = (i / nC) * Math.PI * 2;
        const x = pc.x + Math.cos(a) * cr, y = pc.y + Math.sin(a) * cr;
        if (x < x0 - 20 || x > x1 + 20 || y < y0 - 20 || y > y1 + 20) continue;
        const h = H(i, 991, 3);
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = rgba(mix(P.stoneLight, P.grout, 0.15 + h * 0.15));
        ctx.strokeStyle = rgba(P.grout, 0.75); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.roundRect(-14, -7, 28, 14, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(-12, -5.6, 16, 3, 1.4); ctx.fill();
        ctx.restore();
      }
    }

    // ── per-tile detail
    const tx0 = Math.max(0, Math.floor(x0 / 64)), tx1 = Math.min(this.map.w - 1, Math.floor(x1 / 64));
    const ty0 = Math.max(0, Math.floor(y0 / 64)), ty1 = Math.min(this.map.h - 1, Math.floor(y1 / 64));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = this.map.tiles[ty * this.map.w + tx];
      const bx = tx * 64, by = ty * 64;
      if (t === T_PATH) {
        if (th === 'town') {
          // cobbled road: offset rows of rounded stones over packed dirt
          for (let row = 0; row < 5; row++) for (let i = 0; i < 5; i++) {
            const x = bx + 6 + i * 13 + (row % 2) * 6.5 + (H(tx * 7 + i, ty * 5 + row, 3) - 0.5) * 3;
            const y = by + 6 + row * 13 + (H(tx * 3 + i, ty * 11 + row, 5) - 0.5) * 3;
            if (at(x, y) !== 1) continue;
            const h = H(tx * 31 + i, ty * 17 + row, 9);
            if (h < 0.08) continue;
            ctx.fillStyle = rgba(mix(mix(P.stone, P.path, 0.35), h > 0.5 ? P.stoneLight : P.grout, 0.15 + (h - 0.5) * 0.3));
            ctx.strokeStyle = rgba(P.pathEdge, 0.45); ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.roundRect(x - 5.4, y - 4.6, 10.8, 9.2, 3.6); ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.roundRect(x - 4, y - 3.6, 5.6, 2, 1); ctx.fill();
          }
        } else if (th === 'ashen' || th === 'riftAshen') {
          // broken, soot-stained flagstones of the buried city: irregular slabs, many missing
          for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
            const hx = H(tx * 5 + i, ty * 3 + j, 2), hy = H(tx * 3 + i, ty * 5 + j, 4), h = H(tx * 13 + i, ty * 7 + j, 6);
            if (h < 0.3) continue;
            const x = bx + 16 + i * 32 + (hx - 0.5) * 8, y = by + 16 + j * 32 + (hy - 0.5) * 8;
            if (at(x, y) !== 1) continue;
            const w = 22 + h * 8, hh = 18 + hx * 8;
            ctx.save(); ctx.translate(x, y); ctx.rotate((hy - 0.5) * 0.25);
            ctx.fillStyle = rgba(mix(P.path, h > 0.65 ? P.pathLight : P.pathDark, 0.35), 0.9);
            ctx.strokeStyle = rgba(P.pathEdge, 0.55); ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-w / 2, -hh / 2 + 2); ctx.lineTo(-w / 2 + 3, -hh / 2); ctx.lineTo(w / 2 - 1, -hh / 2 + hx * 3); ctx.lineTo(w / 2, hh / 2 - 2);
            ctx.lineTo(w / 2 - 4, hh / 2); ctx.lineTo(-w / 2 + 1, hh / 2 - hy * 3); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'rgba(255,240,220,0.07)'; ctx.fillRect(-w / 2 + 3, -hh / 2 + 2, w * 0.5, 2.4);
            if (h > 0.82) { ctx.strokeStyle = 'rgba(255,110,30,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-w * 0.3, -2); ctx.lineTo(0, 2); ctx.lineTo(w * 0.25, -3); ctx.stroke(); }
            ctx.restore();
          }
        } else {
          // dirt road: pebbles + faint ruts
          for (let i = 0; i < 4; i++) {
            const x = bx + H(tx, ty, 20 + i) * 64, y = by + H(ty, tx, 30 + i) * 64;
            if (at(x, y) !== 1) continue;
            const s = 1.4 + H(tx + i, ty, 40) * 2;
            ctx.fillStyle = rgba(P.pathLight); ctx.strokeStyle = rgba(P.pathEdge, 0.7); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.ellipse(x, y, s * 1.3, s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          }
        }
      } else if (t === T_FLOOR) {
        const count = th === 'town' || th === 'glade' ? 9 : 5;
        for (let i = 0; i < count; i++) {
          const x = bx + H(tx * 3 + i, ty, 50) * 64, y = by + H(tx, ty * 3 + i, 60) * 64;
          if (at(x, y) !== 0) continue;
          const h = H(tx + i * 7, ty + i, 70);
          if (th === 'town' || th === 'glade') {
            // tiny grass flick
            ctx.strokeStyle = rgba(h > 0.5 ? P.floorLight : P.floorDark, 0.85);
            ctx.lineWidth = 1.3; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x - 3, y - 4.5); ctx.moveTo(x, y); ctx.lineTo(x + 0.5, y - 6); ctx.moveTo(x + 2, y); ctx.lineTo(x + 3.6, y - 4); ctx.stroke();
          } else if (th === 'ashen' || th === 'riftAshen') {
            if (h > 0.6) { ctx.strokeStyle = rgba(P.floorDark, 0.9); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x - 2, y + 2); ctx.lineTo(x + 3, y - 1); ctx.lineTo(x + 8, y + 1); ctx.stroke(); }
            else { ctx.fillStyle = rgba(P.speck, 0.6); ctx.beginPath(); ctx.arc(x, y, 1 + h * 1.4, 0, Math.PI * 2); ctx.fill(); }
          } else {
            // cave floor: slab seams
            if (h > 0.7) { ctx.strokeStyle = rgba(P.floorDark, 0.55); ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 10, y - 1); ctx.quadraticCurveTo(x - 2, y + 2, x + 9, y); ctx.stroke(); }
            else { ctx.fillStyle = rgba(P.speck, 0.35); ctx.beginPath(); ctx.ellipse(x, y, 3 + h * 3, 1.8 + h, 0, 0, Math.PI * 2); ctx.fill(); }
          }
        }
      } else if (t === T_WATER) {
        for (let i = 0; i < 3; i++) {
          const x = bx + H(tx, ty, 80 + i) * 64, y = by + H(ty, tx, 90 + i) * 64;
          if (at(x, y) !== 5) continue;
          if (P.liquidGlow) {
            ctx.strokeStyle = rgba(P.liquidEdge, 0.75); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(x, y, 7, 3, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(255,230,150,0.7)'; ctx.beginPath(); ctx.arc(x + 2, y - 1, 1.6, 0, Math.PI * 2); ctx.fill();
          } else {
            ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.quadraticCurveTo(x, y - 2.6, x + 6, y); ctx.stroke();
            if (i === 0 && (th === 'town' || th === 'glade') && H(tx, ty, 99) > 0.55) {
              // lily pad
              ctx.fillStyle = rgba(0x5a9a4a); ctx.strokeStyle = rgba(0x2f5a2a); ctx.lineWidth = 1.2;
              ctx.beginPath(); ctx.moveTo(x + 10, y + 8); ctx.arc(x + 10, y + 8, 6, 0.3, Math.PI * 2 - 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
              if (H(tx, ty, 98) > 0.5) { ctx.fillStyle = rgba(0xf6c8d8); ctx.beginPath(); ctx.arc(x + 9, y + 7, 2, 0, Math.PI * 2); ctx.fill(); }
            }
          }
        }
      } else if (t === T_WALL) {
        const forest = th === 'town' || th === 'glade';
        for (let i = 0; i < (forest ? 4 : 3); i++) {
          const x = bx + H(tx, ty, 110 + i) * 64, y = by + H(ty, tx, 120 + i) * 64;
          const k = at(x, y);
          if (forest && k === 3) {
            // undergrowth: soft leafy clusters (no hard outline, they sit under the trees)
            const r = 7 + H(tx + i, ty, 130) * 8;
            ctx.fillStyle = rgba(mix(P.wallTop, 0x000000, 0.25), 0.6);
            for (const [dx, dy, k2] of [[-r * 0.6, r * 0.25, 0.7], [r * 0.55, r * 0.3, 0.65], [0, 0, 1]] as const) { ctx.beginPath(); ctx.arc(x + dx + 2, y + dy + 3, r * k2, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = rgba(mix(P.wallTop, P.wallTopLight, 0.75), 0.9);
            for (const [dx, dy, k2] of [[-r * 0.6, r * 0.25, 0.7], [r * 0.55, r * 0.3, 0.65], [0, 0, 1]] as const) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r * k2, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = 'rgba(200,240,160,0.12)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.45, 0, Math.PI * 2); ctx.fill();
          } else if (!forest && k === 3) {
            ctx.strokeStyle = rgba(P.faceDark, 0.8); ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x - 2, y - 3); ctx.lineTo(x + 6, y + 1); ctx.stroke();
          } else if (!forest && k === 4 && (th === 'ashen' || th === 'riftAshen') && H(tx, ty, 140 + i) > 0.5) {
            ctx.strokeStyle = 'rgba(255,110,30,0.7)'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(x - 6, y - 3); ctx.lineTo(x, y + 2); ctx.lineTo(x + 6, y - 1); ctx.stroke();
          } else if (!forest && k === 4 && th === 'riftGlade' && H(tx, ty, 150 + i) > 0.6) {
            ctx.fillStyle = 'rgba(120,240,255,0.75)';
            ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 2.4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 2.4, y); ctx.closePath(); ctx.fill();
          }
        }
      }
    }
  }
}

