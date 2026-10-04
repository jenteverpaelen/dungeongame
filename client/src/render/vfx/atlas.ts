// Pre-baked texture atlases. Everything the particle system draws is a quad from ONE shared fx atlas
// (soft glows, rings, sparks, smoke, debris, decals, projectiles, fallback item icons...) or from the
// glyph atlas (floating combat numbers), so each ParticleContainer is a single draw call and nothing is
// ever re-tessellated at runtime. Atlases are painted with the 2D canvas API (no renderer needed),
// shelf-packed by height and uploaded once with mipmaps.

import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { TAU, mulberry } from './util';

type Ctx = CanvasRenderingContext2D;
type Stops = [number, string][];
type Draw = (ctx: Ctx, w: number, h: number) => void;

// ───────────────────────────── helpers ─────────────────────────────

function mkCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function radial(ctx: Ctx, cx: number, cy: number, r: number, stops: Stops, r0 = 0): CanvasGradient {
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

const W = (a: number) => `rgba(255,255,255,${a})`;
const OUTLINE = 'rgba(27,20,16,0.95)';

/** Gaussian-ish falloff used by every soft glow. */
const GLOW: Stops = [[0, W(1)], [0.1, W(0.86)], [0.2, W(0.64)], [0.35, W(0.36)], [0.5, W(0.17)], [0.7, W(0.05)], [1, W(0)]];

function softBlob(ctx: Ctx, cx: number, cy: number, r: number, a = 1): void {
  ctx.fillStyle = radial(ctx, cx, cy, r, [[0, W(0.55 * a)], [0.45, W(0.3 * a)], [0.8, W(0.08 * a)], [1, W(0)]]);
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

function poly(ctx: Ctx, pts: number[][]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function crackLines(ctx: Ctx, cx: number, cy: number, rng: () => number, branches: number, maxLen: number, width: number): void {
  const walk = (x: number, y: number, ang: number, len: number, w: number, depth: number) => {
    const seg = 11;
    const n = Math.max(2, Math.floor(len / seg));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const nx = x + Math.cos(ang) * seg;
      const ny = y + Math.sin(ang) * seg;
      ctx.lineWidth = Math.max(0.9, w * (1 - t * 0.8));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      x = nx;
      y = ny;
      ang += (rng() - 0.5) * 0.9;
      if (depth < 2 && i > 1 && i < n - 2 && rng() < 0.2) {
        walk(x, y, ang + (rng() < 0.5 ? 1 : -1) * (0.6 + rng() * 0.5), len * (0.35 + rng() * 0.2), w * 0.6, depth + 1);
      }
    }
  };
  for (let b = 0; b < branches; b++) {
    const ang = (b / branches) * TAU + (rng() - 0.5) * 0.6;
    walk(cx, cy, ang, maxLen * (0.55 + rng() * 0.45), width, 0);
  }
}

/** Light-grey vertical gradient used for tintable solid sprites (tint multiplies → keeps shading). */
function greyFill(ctx: Ctx, y0: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#e2e2e2');
  g.addColorStop(1, '#a9a9a9');
  return g;
}

/** Fill + dark outline + soft top highlight for a path already built on ctx. */
function inkShape(ctx: Ctx, y0: number, y1: number, lw = 2.2): void {
  ctx.fillStyle = greyFill(ctx, y0, y1);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// ───────────────────────────── packer ─────────────────────────────

interface Req { w: number; h: number; draw: Draw; tex: Texture }

class AtlasBuilder {
  private reqs: Req[] = [];
  constructor(private width: number, private pad = 4) {}

  add(w: number, h: number, draw: Draw): Req {
    const r: Req = { w, h, draw, tex: Texture.EMPTY };
    this.reqs.push(r);
    return r;
  }

  build(label: string): { canvas: HTMLCanvasElement; source: CanvasSource } {
    const pad = this.pad;
    const order = [...this.reqs].sort((a, b) => b.h - a.h || b.w - a.w);
    let x = pad, y = pad, rowH = 0;
    const pos = new Map<Req, [number, number]>();
    for (const r of order) {
      if (x + r.w + pad > this.width) { x = pad; y += rowH + pad; rowH = 0; }
      pos.set(r, [x, y]);
      x += r.w + pad;
      rowH = Math.max(rowH, r.h);
    }
    const used = y + rowH + pad;
    let H = 256;
    while (H < used) H *= 2;
    const canvas = mkCanvas(this.width, H);
    const ctx = canvas.getContext('2d')!;
    const source = new CanvasSource({ resource: canvas, resolution: 1, scaleMode: 'linear', autoGenerateMipmaps: true, label });
    for (const r of order) {
      const [px, py] = pos.get(r)!;
      ctx.save();
      ctx.translate(px, py);
      ctx.beginPath();
      ctx.rect(0, 0, r.w, r.h);
      ctx.clip();
      r.draw(ctx, r.w, r.h);
      ctx.restore();
      r.tex = new Texture({ source, frame: new Rectangle(px, py, r.w, r.h) });
    }
    source.update();
    return { canvas, source };
  }
}

// ───────────────────────────── fx atlas ─────────────────────────────

export interface FxTextures {
  glow: Texture; core: Texture; dot: Texture;
  ring: Texture; ringThick: Texture; ringHard: Texture; runeRing: Texture;
  spark: Texture; streak: Texture; star4: Texture; flare: Texture;
  smoke: Texture[]; shard: Texture[]; chunk: Texture[]; spike: Texture[];
  slash: Texture; swipe: Texture; swipeWide: Texture; swipeThin: Texture; whirl: Texture;
  disc: Texture; scorch: Texture[]; crack: Texture[];
  poolLava: Texture; poolGoo: Texture; frostPatch: Texture; swirl: Texture; holeDark: Texture;
  arrow: Texture; bolt: Texture; rocket: Texture; seed: Texture; rock: Texture; bomb: Texture;
  flame: Texture; wisp: Texture; bubble: Texture; ghost: Texture;
  coin: Texture; gem: Texture; globe: Texture;
  beam: Texture; beamCore: Texture; line: Texture; drip: Texture; flake: Texture; plus: Texture;
  shadow: Texture; pixel: Texture;
  /** Fallback ground-loot icons keyed by item shape or kind (greyscale, tint with the item colour). */
  icons: Record<string, Texture>;
}

let fxCache: FxTextures | null = null;

export function getFxAtlas(): FxTextures {
  if (!fxCache) fxCache = bakeFxAtlas();
  return fxCache;
}

function bakeFxAtlas(): FxTextures {
  const A = new AtlasBuilder(2048);
  const rng = mulberry(7331);

  // ---- big decals ----
  const scorch = [0, 1].map(() => A.add(256, 256, (c) => {
    for (let i = 0; i < 14; i++) {
      const a = rng() * TAU, d = rng() * 52, r = 38 + rng() * 52;
      const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
      c.fillStyle = radial(c, x, y, r, [[0, 'rgba(14,8,5,0.55)'], [0.55, 'rgba(14,8,5,0.34)'], [0.85, 'rgba(14,8,5,0.1)'], [1, 'rgba(14,8,5,0)']]);
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 40; i++) {
      const a = rng() * TAU, d = 70 + rng() * 48;
      c.fillStyle = `rgba(20,10,6,${0.2 + rng() * 0.3})`;
      c.beginPath(); c.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 1 + rng() * 3, 0, TAU); c.fill();
    }
  }));

  const crack = [0, 1].map((v) => A.add(256, 256, (c) => {
    c.strokeStyle = '#fff';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    crackLines(c, 128, 128, rng, 9 + v * 2, 118, 5.5);
    c.globalCompositeOperation = 'destination-over';
    c.fillStyle = radial(c, 128, 128, 40, [[0, W(0.5)], [1, W(0)]]);
    c.fillRect(88, 88, 80, 80);
  }));

  const poolLava = A.add(256, 256, (c) => {
    const blob = (x: number, y: number, r: number) => {
      c.fillStyle = radial(c, x, y, r, [[0, 'rgb(255,240,150)'], [0.35, 'rgb(255,170,50)'], [0.62, 'rgb(230,90,20)'], [0.82, 'rgb(120,40,14)'], [0.93, 'rgba(40,16,10,0.95)'], [1, 'rgba(30,12,8,0)']]);
      c.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU, d = rng() * 26;
      blob(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 84 + rng() * 40);
    }
    for (let i = 0; i < 16; i++) {
      const a = rng() * TAU, d = 20 + rng() * 80, r = 6 + rng() * 14;
      c.fillStyle = `rgba(36,14,8,${0.35 + rng() * 0.35})`;
      c.beginPath(); c.ellipse(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r * 1.4, r, rng() * TAU, 0, TAU); c.fill();
    }
    c.strokeStyle = 'rgba(255,220,120,0.7)';
    c.lineCap = 'round';
    crackLines(c, 128, 128, rng, 6, 70, 2.4);
  });

  const poolGoo = A.add(256, 256, (c) => {
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU, d = rng() * 32, r = 66 + rng() * 40;
      const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
      c.fillStyle = radial(c, x, y, r, [[0, W(0.9)], [0.55, W(0.78)], [0.82, 'rgba(120,120,120,0.85)'], [0.94, 'rgba(70,70,70,0.6)'], [1, 'rgba(60,60,60,0)']]);
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 12; i++) {
      const a = rng() * TAU, d = rng() * 80, r = 4 + rng() * 9;
      const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.6;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.65)';
      c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, TAU); c.fill();
    }
  });

  const frostPatch = A.add(256, 256, (c) => {
    c.fillStyle = radial(c, 128, 128, 126, [[0, W(0.55)], [0.5, W(0.4)], [0.85, W(0.18)], [1, W(0)]]);
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 46; i++) {
      const a = rng() * TAU, d = rng() * 105;
      const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, r = 7 + rng() * 17;
      const rot = rng() * TAU;
      c.fillStyle = W(0.12 + rng() * 0.22);
      poly(c, [[x + Math.cos(rot) * r, y + Math.sin(rot) * r], [x + Math.cos(rot + 2.2) * r * 0.7, y + Math.sin(rot + 2.2) * r * 0.7], [x + Math.cos(rot + 4.1) * r * 0.9, y + Math.sin(rot + 4.1) * r * 0.9]]);
      c.fill();
    }
    c.strokeStyle = W(0.55);
    c.lineCap = 'round';
    crackLines(c, 128, 128, rng, 8, 90, 2);
  });

  const swirl = A.add(256, 256, (c) => {
    c.globalCompositeOperation = 'lighter';
    for (let arm = 0; arm < 3; arm++) {
      const off = (arm / 3) * TAU;
      for (let i = 0; i < 90; i++) {
        const t = i / 89;
        const r = 10 + t * 112;
        const th = off + t * 5.2;
        const x = 128 + Math.cos(th) * r, y = 128 + Math.sin(th) * r;
        const rad = 3 + (1 - t) * 9 * (0.5 + t * 0.5);
        const a = 0.55 * Math.pow(1 - t, 0.5) * (0.35 + 0.65 * t) + 0.1 * (1 - t);
        c.fillStyle = radial(c, x, y, rad, [[0, W(a)], [1, W(0)]]);
        c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    }
    c.fillStyle = radial(c, 128, 128, 50, [[0, W(0.8)], [0.4, W(0.3)], [1, W(0)]]);
    c.fillRect(78, 78, 100, 100);
  });

  const holeDark = A.add(256, 256, (c) => {
    c.fillStyle = radial(c, 128, 128, 126, [[0, 'rgba(0,0,0,1)'], [0.62, 'rgba(4,0,10,0.98)'], [0.8, 'rgba(40,10,70,0.85)'], [0.92, 'rgba(120,60,200,0.35)'], [1, 'rgba(140,70,220,0)']]);
    c.fillRect(0, 0, 256, 256);
  });

  const ring = A.add(256, 256, (c) => {
    c.fillStyle = radial(c, 128, 128, 128, [[0, W(0)], [0.74, W(0)], [0.84, W(0.45)], [0.905, W(1)], [0.95, W(0.45)], [1, W(0)]]);
    c.fillRect(0, 0, 256, 256);
  });
  const ringThick = A.add(256, 256, (c) => {
    c.fillStyle = radial(c, 128, 128, 128, [[0, W(0)], [0.42, W(0)], [0.6, W(0.2)], [0.8, W(0.62)], [0.915, W(1)], [0.965, W(0.4)], [1, W(0)]]);
    c.fillRect(0, 0, 256, 256);
  });
  const ringHard = A.add(256, 256, (c) => {
    c.fillStyle = radial(c, 128, 128, 128, [[0, W(0)], [0.9, W(0)], [0.925, W(0.4)], [0.95, W(1)], [0.972, W(0.4)], [0.99, W(0)], [1, W(0)]]);
    c.fillRect(0, 0, 256, 256);
  });
  const runeRing = A.add(256, 256, (c) => {
    c.translate(128, 128);
    c.strokeStyle = W(1);
    c.lineWidth = 3.2;
    c.beginPath(); c.arc(0, 0, 118, 0, TAU); c.stroke();
    c.lineWidth = 1.6;
    c.beginPath(); c.arc(0, 0, 96, 0, TAU); c.stroke();
    c.fillStyle = W(1);
    for (let i = 0; i < 16; i++) {
      c.save();
      c.rotate((i / 16) * TAU);
      if (i % 2 === 0) poly(c, [[107, -6], [113, 0], [107, 6], [101, 0]]);
      else { c.beginPath(); c.rect(103, -1.4, 9, 2.8); }
      c.fill();
      c.restore();
    }
    c.globalCompositeOperation = 'destination-over';
    c.fillStyle = radial(c, 0, 0, 128, [[0, W(0)], [0.7, W(0)], [0.92, W(0.25)], [1, W(0)]]);
    c.fillRect(-128, -128, 256, 256);
  });

  // ---- swipes (motion-blurred slash sectors; the sweep head is at +angle) ----
  const sector = (span: number, rIn: number) => (c: Ctx) => {
    const cx = 128, cy = 128, R = 124;
    const a0 = -span / 2, a1 = span / 2;
    const g = c.createConicGradient(a0, cx, cy);
    const f = span / TAU;
    g.addColorStop(0, W(0));
    g.addColorStop(f * 0.55, W(0.28));
    g.addColorStop(f * 0.86, W(0.75));
    g.addColorStop(f * 0.985, W(1));
    g.addColorStop(Math.min(1, f + 0.002), W(0));
    g.addColorStop(1, W(0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, R, a0, a1);
    c.arc(cx, cy, rIn, a1, a0, true);
    c.closePath();
    c.fill();
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = radial(c, cx, cy, R, [[0, W(0)], [rIn / R, W(0.05)], [0.78, W(0.55)], [0.93, W(1)], [0.985, W(1)], [1, W(0)]]);
    c.fillRect(0, 0, 256, 256);
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      c.strokeStyle = W(0.06 + t * t * 0.5);
      c.lineWidth = 1.5 + t * 2;
      const s0 = a0 + span * (0.35 + t * 0.6), s1 = Math.min(a1, s0 + span * 0.06);
      c.beginPath(); c.arc(cx, cy, R - 6, s0, s1); c.stroke();
    }
  };
  const swipe = A.add(256, 256, sector(Math.PI * 0.85, 62));
  const swipeWide = A.add(256, 256, sector(Math.PI * 1.15, 58));
  const swipeThin = A.add(256, 256, sector(Math.PI * 0.7, 100));
  const whirl = A.add(256, 256, (c) => {
    const cx = 128, cy = 128, R = 124, rIn = 88;
    const g = c.createConicGradient(0, cx, cy);
    g.addColorStop(0, W(0)); g.addColorStop(0.2, W(0)); g.addColorStop(0.4, W(0.35)); g.addColorStop(0.495, W(1)); g.addColorStop(0.5, W(0));
    g.addColorStop(0.7, W(0)); g.addColorStop(0.9, W(0.35)); g.addColorStop(0.995, W(1)); g.addColorStop(1, W(0));
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.arc(cx, cy, rIn, TAU, 0, true); c.fill();
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = radial(c, cx, cy, R, [[0, W(0)], [rIn / R, W(0)], [0.75, W(0.5)], [0.92, W(1)], [0.97, W(0.9)], [1, W(0)]]);
    c.fillRect(0, 0, 256, 256);
  });

  const smoke = [0, 1, 2].map(() => A.add(96, 96, (c) => {
    for (let i = 0; i < 8; i++) {
      const a = rng() * TAU, d = rng() * 20;
      softBlob(c, 48 + Math.cos(a) * d, 48 + Math.sin(a) * d, 20 + rng() * 14, 0.95);
    }
  }));

  const glow = A.add(128, 128, (c) => { c.fillStyle = radial(c, 64, 64, 64, GLOW); c.fillRect(0, 0, 128, 128); });
  const flare = A.add(128, 128, (c) => {
    c.fillStyle = radial(c, 64, 64, 64, GLOW); c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(2, 64); c.quadraticCurveTo(64, 61, 126, 64); c.quadraticCurveTo(64, 67, 2, 64); c.fill();
    c.beginPath(); c.moveTo(64, 20); c.quadraticCurveTo(61.5, 64, 64, 108); c.quadraticCurveTo(66.5, 64, 64, 20); c.fill();
  });
  const disc = A.add(128, 128, (c) => {
    c.fillStyle = radial(c, 64, 64, 64, [[0, W(1)], [0.93, W(1)], [1, W(0)]]);
    c.fillRect(0, 0, 128, 128);
  });
  const slash = A.add(128, 64, (c) => {
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(64, 64, 60, 0, TAU); c.fill();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath(); c.arc(64, 72, 59, 0, TAU); c.fill();
  });
  const beam = A.add(64, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, W(0)); g.addColorStop(0.18, W(0.12)); g.addColorStop(0.36, W(0.55)); g.addColorStop(0.5, W(1));
    g.addColorStop(0.64, W(0.55)); g.addColorStop(0.82, W(0.12)); g.addColorStop(1, W(0));
    c.fillStyle = g; c.fillRect(0, 0, 64, 256);
    c.globalCompositeOperation = 'destination-in';
    const v = c.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, W(0)); v.addColorStop(0.2, W(0.22)); v.addColorStop(0.55, W(0.62)); v.addColorStop(0.9, W(0.95)); v.addColorStop(1, W(1));
    c.fillStyle = v; c.fillRect(0, 0, 64, 256);
  });
  const beamCore = A.add(32, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 32, 0);
    g.addColorStop(0, W(0)); g.addColorStop(0.3, W(0.5)); g.addColorStop(0.5, W(1)); g.addColorStop(0.7, W(0.5)); g.addColorStop(1, W(0));
    c.fillStyle = g; c.fillRect(0, 0, 32, 256);
    c.globalCompositeOperation = 'destination-in';
    const v = c.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, W(0)); v.addColorStop(0.3, W(0.3)); v.addColorStop(0.7, W(0.8)); v.addColorStop(1, W(1));
    c.fillStyle = v; c.fillRect(0, 0, 32, 256);
  });

  // ---- small sprites ----
  const core = A.add(64, 64, (c) => { c.fillStyle = radial(c, 32, 32, 32, [[0, W(1)], [0.5, W(0.9)], [0.75, W(0.3)], [1, W(0)]]); c.fillRect(0, 0, 64, 64); });
  const dot = A.add(32, 32, (c) => { c.fillStyle = radial(c, 16, 16, 16, [[0, W(1)], [0.72, W(1)], [1, W(0)]]); c.fillRect(0, 0, 32, 32); });
  const spark = A.add(64, 16, (c) => {
    c.translate(32, 8); c.scale(4, 1);
    c.fillStyle = radial(c, 0, 0, 8, [[0, W(1)], [0.3, W(0.85)], [0.65, W(0.25)], [1, W(0)]]);
    c.fillRect(-8, -8, 16, 16);
  });
  const streak = A.add(128, 16, (c) => {
    c.translate(128, 8); c.scale(7, 0.5);
    c.fillStyle = radial(c, 0, 0, 16, [[0, W(1)], [0.22, W(0.7)], [0.6, W(0.22)], [1, W(0)]]);
    c.fillRect(-16, -16, 32, 32);
  });
  const star4 = A.add(64, 64, (c) => {
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(32, 1); c.quadraticCurveTo(34.5, 29.5, 63, 32); c.quadraticCurveTo(34.5, 34.5, 32, 63); c.quadraticCurveTo(29.5, 34.5, 1, 32); c.quadraticCurveTo(29.5, 29.5, 32, 1); c.fill();
    c.fillStyle = radial(c, 32, 32, 10, [[0, W(1)], [1, W(0)]]); c.fillRect(22, 22, 20, 20);
  });
  const shardPts = [
    [[16, 1], [27, 29], [5, 29]],
    [[16, 1], [22, 12], [20, 30], [10, 30], [8, 12]],
    [[3, 16], [16, 4], [29, 16], [16, 29]],
  ];
  const shard = shardPts.map((pts) => A.add(32, 32, (c) => {
    const g = c.createLinearGradient(0, 0, 32, 32);
    g.addColorStop(0, W(1)); g.addColorStop(0.55, 'rgba(225,235,245,1)'); g.addColorStop(1, 'rgba(165,185,205,1)');
    c.fillStyle = g;
    poly(c, pts); c.fill();
    c.strokeStyle = 'rgba(40,60,90,0.55)'; c.lineWidth = 1; c.stroke();
    c.strokeStyle = W(0.95); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(pts[1][0], pts[1][1]); c.stroke();
  }));
  const chunk = [0, 1, 2].map(() => A.add(32, 32, (c) => {
    const n = 7;
    const pts: number[][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rng() * 0.4, r = 9 + rng() * 5;
      pts.push([16 + Math.cos(a) * r, 16 + Math.sin(a) * r]);
    }
    const g = c.createLinearGradient(6, 4, 26, 28);
    g.addColorStop(0, 'rgb(236,236,236)'); g.addColorStop(0.5, 'rgb(190,190,190)'); g.addColorStop(1, 'rgb(120,120,120)');
    c.fillStyle = g;
    poly(c, pts); c.fill();
    c.strokeStyle = 'rgba(30,24,20,0.7)'; c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke();
    c.fillStyle = W(0.5);
    c.beginPath(); c.ellipse(12.5, 11.5, 3.5, 2, -0.6, 0, TAU); c.fill();
  }));
  // Rock spikes erupting from the ground (anchored at their base).
  const spike = [0, 1].map((v) => A.add(40, 64, (c) => {
    const pts = v === 0
      ? [[5, 62], [14, 24], [20, 3], [27, 22], [36, 62]]
      : [[4, 62], [10, 34], [17, 12], [22, 18], [29, 6], [33, 30], [37, 62]];
    poly(c, pts);
    inkShape(c, 0, 64, 2);
    c.fillStyle = W(0.55);
    poly(c, v === 0 ? [[14, 26], [20, 5], [21, 40], [15, 56]] : [[11, 36], [17, 14], [19, 44]]);
    c.fill();
    c.fillStyle = 'rgba(0,0,0,0.18)';
    poly(c, v === 0 ? [[24, 30], [34, 62], [22, 62]] : [[30, 32], [36, 62], [26, 62]]);
    c.fill();
  }));
  const line = A.add(16, 16, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 16);
    g.addColorStop(0, W(0)); g.addColorStop(0.3, W(0.45)); g.addColorStop(0.5, W(1)); g.addColorStop(0.7, W(0.45)); g.addColorStop(1, W(0));
    c.fillStyle = g; c.fillRect(0, 0, 16, 16);
  });
  const drip = A.add(12, 16, (c) => {
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(6, 1); c.bezierCurveTo(10, 7, 11, 10, 6, 15); c.bezierCurveTo(1, 10, 2, 7, 6, 1); c.fill();
  });
  const flake = A.add(24, 24, (c) => {
    c.strokeStyle = '#fff'; c.lineWidth = 1.7; c.lineCap = 'round';
    c.translate(12, 12);
    for (let i = 0; i < 3; i++) {
      c.rotate(Math.PI / 3);
      c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.stroke();
      c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(5, 0); c.lineTo(8, -3); c.moveTo(5, 0); c.lineTo(8, 3); c.moveTo(-5, 0); c.lineTo(-8, -3); c.moveTo(-5, 0); c.lineTo(-8, 3); c.stroke();
      c.lineWidth = 1.7;
    }
  });
  const plus = A.add(24, 24, (c) => {
    c.fillStyle = '#fff';
    c.beginPath(); c.roundRect(9, 2, 6, 20, 3); c.fill();
    c.beginPath(); c.roundRect(2, 9, 20, 6, 3); c.fill();
  });
  const shadow = A.add(64, 32, (c) => {
    c.translate(32, 16); c.scale(2, 1);
    c.fillStyle = radial(c, 0, 0, 16, [[0, 'rgba(0,0,0,0.9)'], [0.6, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]);
    c.fillRect(-16, -16, 32, 32);
  });
  const pixel = A.add(4, 4, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 4, 4); });
  // Flame tongue (anchor ~0.5, 0.8): bright base, flickering tip.
  const flame = A.add(32, 48, (c) => {
    c.beginPath();
    c.moveTo(16, 2);
    c.bezierCurveTo(21, 14, 30, 22, 28, 34);
    c.bezierCurveTo(27, 43, 20, 46, 16, 46);
    c.bezierCurveTo(12, 46, 5, 43, 4, 34);
    c.bezierCurveTo(2, 22, 11, 14, 16, 2);
    c.closePath();
    c.fillStyle = radial(c, 16, 36, 30, [[0, W(1)], [0.35, W(0.85)], [0.7, W(0.35)], [1, W(0.05)]]);
    c.fill();
  });
  const wisp = A.add(24, 32, (c) => {
    c.fillStyle = radial(c, 12, 20, 14, [[0, W(0.9)], [0.5, W(0.35)], [1, W(0)]]);
    c.fillRect(0, 0, 24, 32);
    c.beginPath();
    c.moveTo(12, 3); c.bezierCurveTo(15, 10, 19, 14, 18, 21); c.bezierCurveTo(17, 27, 7, 27, 6, 21); c.bezierCurveTo(5, 14, 10, 11, 12, 3);
    c.fillStyle = W(1); c.fill();
  });
  const bubble = A.add(24, 24, (c) => {
    c.fillStyle = W(0.25); c.beginPath(); c.arc(12, 12, 9, 0, TAU); c.fill();
    c.strokeStyle = W(0.95); c.lineWidth = 1.8; c.stroke();
    c.fillStyle = W(0.95); c.beginPath(); c.ellipse(9, 8.5, 2.6, 1.6, -0.6, 0, TAU); c.fill();
  });
  // Afterimage silhouette of a chibi character (big head, small body), soft edged.
  const ghost = A.add(64, 88, (c) => {
    c.filter = 'blur(1.6px)';
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(32, 26, 19, 0, TAU); c.fill();
    c.beginPath(); c.roundRect(19, 42, 26, 26, 9); c.fill();
    c.beginPath(); c.roundRect(21, 64, 9, 18, 4); c.fill();
    c.beginPath(); c.roundRect(34, 64, 9, 18, 4); c.fill();
    c.beginPath(); c.roundRect(11, 44, 8, 20, 4); c.fill();
    c.beginPath(); c.roundRect(45, 44, 8, 20, 4); c.fill();
    c.filter = 'none';
  });

  // ---- coloured sprites ----
  const arrow = A.add(56, 12, (c) => {
    c.translate(0, 6);
    c.lineCap = 'round';
    c.strokeStyle = '#2a1a10'; c.lineWidth = 3.8; c.beginPath(); c.moveTo(7, 0); c.lineTo(47, 0); c.stroke();
    c.strokeStyle = '#c99357'; c.lineWidth = 2.1; c.beginPath(); c.moveTo(7, 0); c.lineTo(47, 0); c.stroke();
    c.strokeStyle = '#ecc88c'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(8, -0.7); c.lineTo(46, -0.7); c.stroke();
    c.fillStyle = '#dfe5ea'; c.strokeStyle = '#2a1a10'; c.lineWidth = 1.1; c.lineJoin = 'round';
    poly(c, [[45, -3.6], [55, 0], [45, 3.6]]); c.fill(); c.stroke();
    for (const s of [-1, 1]) {
      c.fillStyle = s < 0 ? '#e9e2d2' : '#c8452f';
      poly(c, [[1.5, s * 4.6], [8.5, s * 0.9], [14, s * 0.9], [10.5, s * 4.3]]); c.fill(); c.stroke();
    }
  });
  const bolt = A.add(48, 10, (c) => {
    c.translate(26, 5); c.scale(4.4, 1);
    c.fillStyle = radial(c, 0, 0, 5, [[0, W(1)], [0.4, W(0.95)], [0.72, W(0.35)], [1, W(0)]]);
    c.fillRect(-5.4, -5, 11, 10);
  });
  const rocket = A.add(44, 16, (c) => {
    c.translate(0, 8);
    c.lineJoin = 'round';
    c.strokeStyle = '#26130d'; c.lineWidth = 1.4;
    c.fillStyle = '#8a2e22';
    poly(c, [[6, 0], [1, -7], [13, -3.5]]); c.fill(); c.stroke();
    poly(c, [[6, 0], [1, 7], [13, 3.5]]); c.fill(); c.stroke();
    const g = c.createLinearGradient(0, -4.5, 0, 4.5);
    g.addColorStop(0, '#f2ece0'); g.addColorStop(1, '#b3a994');
    c.fillStyle = g;
    c.beginPath(); c.roundRect(7, -4.2, 22, 8.4, 3); c.fill(); c.stroke();
    c.fillStyle = '#d9402c'; c.fillRect(15, -4, 4, 8);
    c.fillStyle = '#e24b2f';
    c.beginPath(); c.moveTo(28, -4.2); c.quadraticCurveTo(39, -3, 42, 0); c.quadraticCurveTo(39, 3, 28, 4.2); c.closePath(); c.fill(); c.stroke();
  });
  const seed = A.add(20, 14, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 14);
    g.addColorStop(0, '#c4f08a'); g.addColorStop(1, '#4a9a2a');
    c.fillStyle = g; c.strokeStyle = '#1f3d14'; c.lineWidth = 1.3; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(1.5, 7); c.quadraticCurveTo(7, -0.5, 18.5, 7); c.quadraticCurveTo(7, 14.5, 1.5, 7); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = W(0.55); c.beginPath(); c.ellipse(9, 4.2, 3.6, 1.4, -0.15, 0, TAU); c.fill();
  });
  // Meteor rock: dark crust with white-hot cracks (tint colours the cracks: orange fire / blue comet).
  const rock = A.add(72, 72, (c) => {
    const pts: number[][] = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU, r = 27 + rng() * 7;
      pts.push([36 + Math.cos(a) * r, 36 + Math.sin(a) * r]);
    }
    c.fillStyle = radial(c, 36, 36, 36, [[0, W(0.9)], [0.6, W(0.35)], [1, W(0)]]);
    c.fillRect(0, 0, 72, 72);
    poly(c, pts);
    c.fillStyle = radial(c, 30, 28, 34, [[0, '#6a5a52'], [0.6, '#3b302b'], [1, '#1d1714']]);
    c.fill();
    c.strokeStyle = '#120c0a'; c.lineWidth = 2.2; c.stroke();
    c.save(); poly(c, pts); c.clip();
    c.strokeStyle = W(1); c.lineCap = 'round';
    crackLines(c, 38, 38, rng, 5, 30, 3.2);
    c.fillStyle = radial(c, 44, 44, 22, [[0, W(0.85)], [1, W(0)]]);
    c.fillRect(20, 20, 50, 50);
    c.restore();
  });
  const bomb = A.add(28, 28, (c) => {
    c.fillStyle = radial(c, 11, 11, 15, [[0, '#8d8a86'], [0.5, '#45403c'], [1, '#1c1916']]);
    c.beginPath(); c.arc(14, 15, 11, 0, TAU); c.fill();
    c.strokeStyle = '#0e0b09'; c.lineWidth = 1.8; c.stroke();
    c.fillStyle = '#c8452f'; c.fillRect(4, 13, 20, 4);
    c.fillStyle = W(0.7); c.beginPath(); c.ellipse(10, 10, 3.5, 2, -0.6, 0, TAU); c.fill();
    c.fillStyle = '#6b5a48'; c.fillRect(12, 1.5, 4, 4);
  });
  const coin = A.add(28, 28, (c) => {
    c.fillStyle = radial(c, 11, 10, 15, [[0, '#fff6b8'], [0.5, '#f4c534'], [1, '#b8860b']]);
    c.strokeStyle = '#6e4a08'; c.lineWidth = 1.8;
    c.beginPath(); c.arc(14, 14, 12, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = '#d99a14'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(14, 14, 8, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.6;
    c.beginPath(); c.arc(14, 14, 10, Math.PI * 1.1, Math.PI * 1.55); c.stroke();
  });
  const gem = A.add(36, 36, (c) => {
    const face = (pts: number[][], f: string) => { c.fillStyle = f; poly(c, pts); c.fill(); };
    face([[6, 13], [12, 5], [18, 13]], 'rgb(235,235,235)');
    face([[12, 5], [24, 5], [18, 13]], 'rgb(255,255,255)');
    face([[24, 5], [30, 13], [18, 13]], 'rgb(205,205,205)');
    face([[6, 13], [18, 13], [18, 32]], 'rgb(180,180,180)');
    face([[18, 13], [30, 13], [18, 32]], 'rgb(120,120,120)');
    c.strokeStyle = 'rgba(25,20,30,0.85)'; c.lineWidth = 1.4; c.lineJoin = 'round';
    poly(c, [[6, 13], [12, 5], [24, 5], [30, 13], [18, 32]]); c.stroke();
    c.strokeStyle = 'rgba(25,20,30,0.45)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(6, 13); c.lineTo(30, 13); c.moveTo(12, 5); c.lineTo(18, 13); c.lineTo(24, 5); c.moveTo(18, 13); c.lineTo(18, 32); c.stroke();
    c.fillStyle = W(0.9); c.beginPath(); c.ellipse(14, 8, 2.6, 1.4, -0.4, 0, TAU); c.fill();
  });
  const globe = A.add(48, 48, (c) => {
    c.fillStyle = radial(c, 24, 24, 22, [[0, 'rgba(255,90,70,0.9)'], [1, 'rgba(255,60,40,0)']]);
    c.fillRect(0, 0, 48, 48);
    const g = c.createRadialGradient(19, 17, 1, 24, 24, 16);
    g.addColorStop(0, '#ffb0a0'); g.addColorStop(0.35, '#e8362a'); g.addColorStop(0.85, '#8a1010'); g.addColorStop(1, '#4a0808');
    c.fillStyle = g; c.strokeStyle = 'rgba(40,6,6,0.9)'; c.lineWidth = 1.6;
    c.beginPath(); c.arc(24, 24, 14, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = W(0.75); c.beginPath(); c.ellipse(19, 17.5, 5, 3, -0.7, 0, TAU); c.fill();
  });

  // ---- fallback item icons (48x48, greyscale; tint with the item's primary colour) ----
  const ICON: Record<string, Draw> = {
    head: (c) => { c.beginPath(); c.moveTo(8, 34); c.bezierCurveTo(8, 10, 40, 10, 40, 34); c.lineTo(40, 38); c.lineTo(8, 38); c.closePath(); inkShape(c, 10, 38); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(14, 28, 20, 4); },
    shoulders: (c) => { c.beginPath(); c.moveTo(5, 32); c.bezierCurveTo(5, 14, 24, 10, 34, 16); c.bezierCurveTo(42, 20, 44, 28, 43, 34); c.lineTo(5, 34); c.closePath(); inkShape(c, 12, 34); c.strokeStyle = OUTLINE; c.lineWidth = 1.5; c.beginPath(); c.moveTo(12, 30); c.bezierCurveTo(14, 22, 26, 18, 36, 24); c.stroke(); },
    chest: (c) => { c.beginPath(); c.moveTo(10, 8); c.lineTo(18, 6); c.quadraticCurveTo(24, 12, 30, 6); c.lineTo(38, 8); c.lineTo(42, 20); c.lineTo(36, 22); c.lineTo(35, 42); c.lineTo(13, 42); c.lineTo(12, 22); c.lineTo(6, 20); c.closePath(); inkShape(c, 6, 42); },
    hands: (c) => { c.beginPath(); c.roundRect(12, 22, 22, 20, 5); c.moveTo(14, 24); c.roundRect(12, 8, 6, 18, 3); c.roundRect(19, 6, 6, 18, 3); c.roundRect(26, 8, 6, 18, 3); c.roundRect(33, 18, 7, 12, 3); inkShape(c, 6, 42, 2); },
    wrists: (c) => { c.beginPath(); c.roundRect(12, 10, 24, 28, 6); inkShape(c, 10, 38); c.strokeStyle = OUTLINE; c.lineWidth = 1.6; c.beginPath(); c.moveTo(12, 18); c.lineTo(36, 18); c.moveTo(12, 30); c.lineTo(36, 30); c.stroke(); },
    waist: (c) => { c.beginPath(); c.roundRect(4, 17, 40, 13, 4); inkShape(c, 17, 30); c.beginPath(); c.roundRect(18, 15, 12, 17, 3); c.fillStyle = 'rgba(255,255,255,0.9)'; c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 2; c.stroke(); },
    legs: (c) => { c.beginPath(); c.moveTo(11, 6); c.lineTo(37, 6); c.lineTo(40, 42); c.lineTo(28, 42); c.lineTo(24, 18); c.lineTo(20, 42); c.lineTo(8, 42); c.closePath(); inkShape(c, 6, 42); },
    feet: (c) => { c.beginPath(); c.moveTo(14, 6); c.lineTo(28, 6); c.lineTo(28, 28); c.quadraticCurveTo(42, 30, 42, 40); c.lineTo(12, 40); c.closePath(); inkShape(c, 6, 40); },
    sword: (c) => { c.save(); c.translate(24, 24); c.rotate(-Math.PI / 4); c.beginPath(); c.moveTo(-3.5, -4); c.lineTo(-3.5, -21); c.lineTo(0, -26); c.lineTo(3.5, -21); c.lineTo(3.5, -4); c.closePath(); inkShape(c, -26, -4, 1.8); c.beginPath(); c.roundRect(-10, -5, 20, 5, 2); inkShape(c, -5, 0, 1.8); c.beginPath(); c.roundRect(-2.5, 0, 5, 14, 2); inkShape(c, 0, 14, 1.8); c.restore(); },
    axe: (c) => { c.save(); c.translate(24, 24); c.rotate(-Math.PI / 5); c.beginPath(); c.roundRect(-2.5, -18, 5, 38, 2); inkShape(c, -18, 20, 1.8); c.beginPath(); c.moveTo(2, -16); c.quadraticCurveTo(18, -20, 16, -6); c.quadraticCurveTo(14, 4, 2, 0); c.closePath(); inkShape(c, -20, 4, 1.8); c.restore(); },
    mace: (c) => { c.save(); c.translate(24, 24); c.rotate(-Math.PI / 5); c.beginPath(); c.roundRect(-2.5, -6, 5, 26, 2); inkShape(c, -6, 20, 1.8); c.beginPath(); c.arc(0, -12, 9, 0, TAU); inkShape(c, -21, -3, 1.8); c.restore(); },
    bow: (c) => { c.beginPath(); c.moveTo(16, 4); c.quadraticCurveTo(44, 24, 16, 44); c.lineWidth = 6; c.strokeStyle = OUTLINE; c.stroke(); c.lineWidth = 3.2; c.strokeStyle = '#e8e8e8'; c.stroke(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(40,30,20,0.9)'; c.beginPath(); c.moveTo(16, 5); c.lineTo(16, 43); c.stroke(); },
    crossbow: (c) => { c.save(); c.translate(24, 24); c.beginPath(); c.roundRect(-3, -6, 6, 26, 2); inkShape(c, -6, 20, 1.8); c.beginPath(); c.moveTo(-19, -2); c.quadraticCurveTo(0, -14, 19, -2); c.lineWidth = 5.5; c.strokeStyle = OUTLINE; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#e4e4e4'; c.stroke(); c.restore(); },
    staff: (c) => { c.save(); c.translate(24, 24); c.rotate(-Math.PI / 4); c.beginPath(); c.roundRect(-2.5, -14, 5, 36, 2); inkShape(c, -14, 22, 1.8); c.beginPath(); c.arc(0, -17, 6.5, 0, TAU); c.fillStyle = W(1); c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 2; c.stroke(); c.restore(); },
    wand: (c) => { c.save(); c.translate(24, 24); c.rotate(-Math.PI / 4); c.beginPath(); c.roundRect(-2, -10, 4, 26, 2); inkShape(c, -10, 16, 1.8); poly(c, [[0, -20], [5, -13], [0, -8], [-5, -13]]); c.fillStyle = W(1); c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 1.8; c.stroke(); c.restore(); },
    shield: (c) => { c.beginPath(); c.moveTo(8, 8); c.lineTo(40, 8); c.lineTo(40, 22); c.quadraticCurveTo(38, 38, 24, 44); c.quadraticCurveTo(10, 38, 8, 22); c.closePath(); inkShape(c, 8, 44); c.beginPath(); c.moveTo(24, 12); c.lineTo(24, 38); c.moveTo(12, 20); c.lineTo(36, 20); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2.4; c.stroke(); },
    quiver: (c) => { c.save(); c.translate(24, 24); c.rotate(0.35); c.beginPath(); c.roundRect(-7, -10, 14, 30, 4); inkShape(c, -10, 20, 2); c.strokeStyle = OUTLINE; c.lineWidth = 1.6; for (const dx of [-4, 0, 4]) { c.beginPath(); c.moveTo(dx, -10); c.lineTo(dx, -20); c.stroke(); } c.restore(); },
    orb: (c) => { c.beginPath(); c.arc(24, 22, 14, 0, TAU); c.fillStyle = radial(c, 19, 17, 18, [[0, '#ffffff'], [0.6, '#d0d0d0'], [1, '#8a8a8a']]); c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 2.2; c.stroke(); c.beginPath(); c.roundRect(15, 36, 18, 6, 2); inkShape(c, 36, 42, 1.8); },
    neck: (c) => { c.beginPath(); c.moveTo(10, 6); c.quadraticCurveTo(24, 30, 38, 6); c.strokeStyle = OUTLINE; c.lineWidth = 4; c.stroke(); c.strokeStyle = '#dcdcdc'; c.lineWidth = 2; c.stroke(); poly(c, [[24, 22], [32, 32], [24, 44], [16, 32]]); inkShape(c, 22, 44, 2); },
    ring: (c) => { c.beginPath(); c.arc(24, 28, 12, 0, TAU); c.strokeStyle = OUTLINE; c.lineWidth = 8; c.stroke(); c.strokeStyle = '#e0e0e0'; c.lineWidth = 4.5; c.stroke(); poly(c, [[24, 6], [31, 13], [24, 20], [17, 13]]); inkShape(c, 6, 20, 1.8); },
  };
  const iconReqs: Record<string, Req> = {};
  for (const [k, d] of Object.entries(ICON)) iconReqs[k] = A.add(48, 48, d);

  A.build('vfx-atlas');
  const icons: Record<string, Texture> = {};
  for (const [k, r] of Object.entries(iconReqs)) icons[k] = r.tex;
  const t = (r: Req) => r.tex;
  return {
    glow: t(glow), core: t(core), dot: t(dot), ring: t(ring), ringThick: t(ringThick), ringHard: t(ringHard), runeRing: t(runeRing),
    spark: t(spark), streak: t(streak), star4: t(star4), flare: t(flare),
    smoke: smoke.map(t), shard: shard.map(t), chunk: chunk.map(t), spike: spike.map(t),
    slash: t(slash), swipe: t(swipe), swipeWide: t(swipeWide), swipeThin: t(swipeThin), whirl: t(whirl),
    disc: t(disc), scorch: scorch.map(t), crack: crack.map(t),
    poolLava: t(poolLava), poolGoo: t(poolGoo), frostPatch: t(frostPatch), swirl: t(swirl), holeDark: t(holeDark),
    arrow: t(arrow), bolt: t(bolt), rocket: t(rocket), seed: t(seed), rock: t(rock), bomb: t(bomb),
    flame: t(flame), wisp: t(wisp), bubble: t(bubble), ghost: t(ghost),
    coin: t(coin), gem: t(gem), globe: t(globe),
    beam: t(beam), beamCore: t(beamCore), line: t(line), drip: t(drip), flake: t(flake), plus: t(plus),
    shadow: t(shadow), pixel: t(pixel), icons,
  };
}

// ───────────────────────────── glyph atlas ─────────────────────────────
// Each glyph is baked three times in white: a thin-outline layer (normal numbers), a thick-outline layer
// (crits / merged numbers) and a fill layer. Numbers draw all outlines of a number first, then its fills,
// so tightly-kerned digits never cut into each other; tint recolours fill and outline independently.

export const GLYPH_CHARS = '0123456789.,-+!%KMBTQaiSxpOcNoDc∞';
const CW = 76, CH = 96, BASE = 72;
export const GLYPH_SIZE = 54;

export interface GlyphAtlas {
  outN: Record<string, Texture>;
  outC: Record<string, Texture>;
  fill: Record<string, Texture>;
  /** Advance width in atlas pixels. */
  adv: Record<string, number>;
  /** Baseline as a fraction of cell height (particle anchorY). */
  base: number;
  size: number;
  source: CanvasSource;
  /** Redraw every glyph with a (newly loaded) font family. */
  rebake(family: string): void;
}

let glyphCache: GlyphAtlas | null = null;

export function getGlyphAtlas(family: string): GlyphAtlas {
  if (!glyphCache) glyphCache = bakeGlyphAtlas(family);
  return glyphCache;
}

function bakeGlyphAtlas(family: string): GlyphAtlas {
  const chars = Array.from(new Set(Array.from(GLYPH_CHARS)));
  const cols = Math.floor(1024 / CW);
  const rows = Math.ceil((chars.length * 3) / cols);
  let H = 256;
  while (H < rows * CH + 4) H *= 2;
  const canvas = mkCanvas(1024, H);
  const ctx = canvas.getContext('2d')!;
  const source = new CanvasSource({ resource: canvas, resolution: 1, scaleMode: 'linear', autoGenerateMipmaps: true, label: 'vfx-glyphs' });
  const outN: Record<string, Texture> = {}, outC: Record<string, Texture> = {}, fill: Record<string, Texture> = {};
  const adv: Record<string, number> = {};
  const sets = [outN, outC, fill];
  const cell = (i: number, k: number) => {
    const idx = i + k * chars.length;
    return [(idx % cols) * CW, Math.floor(idx / cols) * CH];
  };
  chars.forEach((ch, i) => {
    sets.forEach((set, k) => {
      const [x, y] = cell(i, k);
      set[ch] = new Texture({ source, frame: new Rectangle(x, y, CW, CH) });
    });
  });

  const draw = (fam: string) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.font = `${GLYPH_SIZE}px ${fam}`;
    chars.forEach((ch, i) => {
      adv[ch] = ctx.measureText(ch).width;
      for (let k = 0; k < 3; k++) {
        const [x, y] = cell(i, k);
        const cx = x + CW / 2, cy = y + BASE;
        if (k < 2) {
          const out = k === 0 ? 10 : 13;
          ctx.strokeStyle = 'rgba(255,255,255,0.42)';
          ctx.lineWidth = out + 3;
          ctx.strokeText(ch, cx + 1, cy + 4);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = out;
          ctx.strokeText(ch, cx, cy);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(ch, cx, cy);
        } else {
          const g = ctx.createLinearGradient(0, cy - GLYPH_SIZE * 0.74, 0, cy + 2);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.5, '#f6f6f6');
          g.addColorStop(1, '#c4c4c4');
          ctx.fillStyle = g;
          ctx.fillText(ch, cx, cy);
          // crisp top highlight
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, CW, BASE - GLYPH_SIZE * 0.42);
          ctx.clip();
          ctx.fillStyle = 'rgba(255,255,255,1)';
          ctx.fillText(ch, cx, cy);
          ctx.restore();
        }
      }
    });
    source.update();
  };
  draw(family);

  return { outN, outC, fill, adv, base: BASE / CH, size: GLYPH_SIZE, source, rebake: draw };
}
