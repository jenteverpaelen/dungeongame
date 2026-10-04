// Pre-baked texture atlases. Everything the particle system draws is a quad from ONE shared fx atlas
// (soft glows, rings, sparks, smoke, debris, decals...) or from the glyph atlas (floating combat numbers),
// so each ParticleContainer is a single draw call and nothing is ever re-tessellated at runtime.
// The atlases are painted with the 2D canvas API (no renderer needed) and uploaded once.

import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { TAU, mulberry } from './util';

type Ctx = CanvasRenderingContext2D;
type Stops = [number, string][];

// ───────────────────────────── helpers ─────────────────────────────

function mkCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function radial(ctx: Ctx, cx: number, cy: number, r: number, stops: Stops): CanvasGradient {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

const W = (a: number) => `rgba(255,255,255,${a})`;

/** Gaussian-ish falloff used by every soft glow. */
const GLOW: Stops = [[0, W(1)], [0.1, W(0.86)], [0.2, W(0.64)], [0.35, W(0.36)], [0.5, W(0.17)], [0.7, W(0.05)], [1, W(0)]];

function softBlob(ctx: Ctx, cx: number, cy: number, r: number, a = 1): void {
  ctx.fillStyle = radial(ctx, cx, cy, r, [[0, W(0.55 * a)], [0.45, W(0.3 * a)], [0.8, W(0.08 * a)], [1, W(0)]]);
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
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

// ───────────────────────────── fx atlas ─────────────────────────────

export interface FxTextures {
  glow: Texture; core: Texture; dot: Texture;
  ring: Texture; ringThick: Texture; ringHard: Texture;
  spark: Texture; streak: Texture; star4: Texture; flare: Texture;
  smoke: Texture[]; shard: Texture[]; chunk: Texture[];
  slash: Texture; disc: Texture; scorch: Texture[]; crack: Texture[];
  poolLava: Texture; poolGoo: Texture; frostPatch: Texture; swirl: Texture; holeDark: Texture;
  arrow: Texture; bolt: Texture; rocket: Texture; seed: Texture;
  coin: Texture; gem: Texture; globe: Texture; badge: Texture;
  beam: Texture; beamCore: Texture; line: Texture; drip: Texture; flake: Texture; plus: Texture;
  shadow: Texture; wedge: Texture; pixel: Texture;
}

interface Packer { ctx: Ctx; x: number; y: number; rowH: number; W: number; H: number; source: CanvasSource }

function place(p: Packer, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void): Texture {
  const pad = 3;
  if (p.x + w + pad > p.W) { p.x = 0; p.y += p.rowH + pad; p.rowH = 0; }
  if (p.y + h + pad > p.H) throw new Error('vfx atlas overflow');
  const { ctx } = p;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  draw(ctx, w, h);
  ctx.restore();
  const tex = new Texture({ source: p.source, frame: new Rectangle(p.x, p.y, w, h) });
  p.x += w + pad;
  p.rowH = Math.max(p.rowH, h);
  return tex;
}

export function bakeFxAtlas(): FxTextures {
  const AW = 2048, AH = 1024;
  const canvas = mkCanvas(AW, AH);
  const ctx = canvas.getContext('2d')!;
  const source = new CanvasSource({ resource: canvas, resolution: 1, scaleMode: 'linear' });
  const P: Packer = { ctx, x: 0, y: 0, rowH: 0, W: AW, H: AH, source };
  const rng = mulberry(7331);

  // ---- big decals first (shelf packing wants tall items together) ----
  const scorch: Texture[] = [];
  for (let v = 0; v < 2; v++) {
    scorch.push(place(P, 256, 256, (c) => {
      for (let i = 0; i < 14; i++) {
        const a = rng() * TAU, d = rng() * 52, r = 38 + rng() * 52;
        const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
        c.fillStyle = radial(c, x, y, r, [[0, 'rgba(14,8,5,0.55)'], [0.55, 'rgba(14,8,5,0.34)'], [0.85, 'rgba(14,8,5,0.1)'], [1, 'rgba(14,8,5,0)']]);
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // singe rim speckles
      for (let i = 0; i < 40; i++) {
        const a = rng() * TAU, d = 70 + rng() * 48;
        c.fillStyle = `rgba(20,10,6,${0.2 + rng() * 0.3})`;
        c.beginPath(); c.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 1 + rng() * 3, 0, TAU); c.fill();
      }
    }));
  }

  const crack: Texture[] = [];
  for (let v = 0; v < 2; v++) {
    crack.push(place(P, 256, 256, (c) => {
      c.strokeStyle = '#fff';
      c.lineCap = 'round';
      c.lineJoin = 'round';
      crackLines(c, 128, 128, rng, 9 + v * 2, 118, 5.5);
      // soft inner glow so the glow-layer copy reads as molten
      c.globalCompositeOperation = 'destination-over';
      c.fillStyle = radial(c, 128, 128, 40, [[0, W(0.5)], [1, W(0)]]);
      c.fillRect(88, 88, 80, 80);
    }));
  }

  const poolLava = place(P, 256, 256, (c) => {
    const blob = (x: number, y: number, r: number) => {
      c.fillStyle = radial(c, x, y, r, [[0, 'rgb(255,240,150)'], [0.35, 'rgb(255,170,50)'], [0.62, 'rgb(230,90,20)'], [0.82, 'rgb(120,40,14)'], [0.93, 'rgba(40,16,10,0.95)'], [1, 'rgba(30,12,8,0)']]);
      c.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU, d = rng() * 26;
      blob(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 84 + rng() * 40);
    }
    // crust plates
    for (let i = 0; i < 16; i++) {
      const a = rng() * TAU, d = 20 + rng() * 80, r = 6 + rng() * 14;
      c.fillStyle = `rgba(36,14,8,${0.35 + rng() * 0.35})`;
      c.beginPath(); c.ellipse(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r * 1.4, r, rng() * TAU, 0, TAU); c.fill();
    }
    // bright veins
    c.strokeStyle = 'rgba(255,220,120,0.7)';
    c.lineCap = 'round';
    crackLines(c, 128, 128, rng, 6, 70, 2.4);
  });

  const poolGoo = place(P, 256, 256, (c) => {
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU, d = rng() * 32, r = 66 + rng() * 40;
      const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
      c.fillStyle = radial(c, x, y, r, [[0, W(0.9)], [0.55, W(0.78)], [0.82, 'rgba(120,120,120,0.85)'], [0.94, 'rgba(70,70,70,0.6)'], [1, 'rgba(60,60,60,0)']]);
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // bubbles
    for (let i = 0; i < 12; i++) {
      const a = rng() * TAU, d = rng() * 80, r = 4 + rng() * 9;
      const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.6;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.65)';
      c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, TAU); c.fill();
    }
  });

  const frostPatch = place(P, 256, 256, (c) => {
    c.fillStyle = radial(c, 128, 128, 126, [[0, W(0.55)], [0.5, W(0.4)], [0.85, W(0.18)], [1, W(0)]]);
    c.fillRect(0, 0, 256, 256);
    // crystalline facets
    for (let i = 0; i < 46; i++) {
      const a = rng() * TAU, d = rng() * 105;
      const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, r = 7 + rng() * 17;
      const rot = rng() * TAU;
      c.fillStyle = W(0.12 + rng() * 0.22);
      c.beginPath();
      c.moveTo(x + Math.cos(rot) * r, y + Math.sin(rot) * r);
      c.lineTo(x + Math.cos(rot + 2.2) * r * 0.7, y + Math.sin(rot + 2.2) * r * 0.7);
      c.lineTo(x + Math.cos(rot + 4.1) * r * 0.9, y + Math.sin(rot + 4.1) * r * 0.9);
      c.closePath(); c.fill();
    }
    c.strokeStyle = W(0.55);
    c.lineCap = 'round';
    crackLines(c, 128, 128, rng, 8, 90, 2);
  });

  const swirl = place(P, 256, 256, (c) => {
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

  const holeDark = place(P, 256, 256, (c) => {
    c.fillStyle = radial(c, 128, 128, 126, [[0, 'rgba(0,0,0,1)'], [0.7, 'rgba(4,0,10,0.97)'], [0.84, 'rgba(60,18,100,0.85)'], [0.93, 'rgba(140,70,220,0.45)'], [1, 'rgba(140,70,220,0)']]);
    c.fillRect(0, 0, 256, 256);
  });

  const ring = place(P, 256, 256, (c) => {
    c.fillStyle = radial(c, 128, 128, 128, [[0, W(0)], [0.74, W(0)], [0.84, W(0.45)], [0.905, W(1)], [0.95, W(0.45)], [1, W(0)]]);
    c.fillRect(0, 0, 256, 256);
  });
  const ringThick = place(P, 256, 256, (c) => {
    c.fillStyle = radial(c, 128, 128, 128, [[0, W(0)], [0.42, W(0)], [0.6, W(0.2)], [0.8, W(0.62)], [0.915, W(1)], [0.965, W(0.4)], [1, W(0)]]);
    c.fillRect(0, 0, 256, 256);
  });
  const ringHard = place(P, 256, 256, (c) => {
    c.fillStyle = radial(c, 128, 128, 128, [[0, W(0)], [0.915, W(0)], [0.93, W(0.35)], [0.95, W(1)], [0.97, W(0.35)], [0.985, W(0)], [1, W(0)]]);
    c.fillRect(0, 0, 256, 256);
  });

  const smoke: Texture[] = [];
  for (let v = 0; v < 3; v++) {
    smoke.push(place(P, 96, 96, (c) => {
      for (let i = 0; i < 8; i++) {
        const a = rng() * TAU, d = rng() * 20;
        softBlob(c, 48 + Math.cos(a) * d, 48 + Math.sin(a) * d, 20 + rng() * 14, 0.95);
      }
    }));
  }

  const glow = place(P, 128, 128, (c) => { c.fillStyle = radial(c, 64, 64, 64, GLOW); c.fillRect(0, 0, 128, 128); });
  const flare = place(P, 128, 128, (c) => {
    c.fillStyle = radial(c, 64, 64, 64, GLOW); c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#fff';
    // long horizontal ray, short vertical ray
    c.beginPath(); c.moveTo(2, 64); c.quadraticCurveTo(64, 61, 126, 64); c.quadraticCurveTo(64, 67, 2, 64); c.fill();
    c.beginPath(); c.moveTo(64, 20); c.quadraticCurveTo(61.5, 64, 64, 108); c.quadraticCurveTo(66.5, 64, 64, 20); c.fill();
  });
  const disc = place(P, 128, 128, (c) => {
    c.fillStyle = radial(c, 64, 64, 64, [[0, W(1)], [0.9, W(1)], [1, W(0)]]);
    c.fillRect(0, 0, 128, 128);
  });
  const slash = place(P, 128, 64, (c) => {
    c.beginPath(); c.rect(0, 0, 128, 64); c.clip();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(64, 64, 60, 0, TAU); c.fill();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath(); c.arc(64, 72, 59, 0, TAU); c.fill();
  });
  const beam = place(P, 64, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, W(0)); g.addColorStop(0.18, W(0.12)); g.addColorStop(0.36, W(0.55)); g.addColorStop(0.5, W(1));
    g.addColorStop(0.64, W(0.55)); g.addColorStop(0.82, W(0.12)); g.addColorStop(1, W(0));
    c.fillStyle = g; c.fillRect(0, 0, 64, 256);
    c.globalCompositeOperation = 'destination-in';
    const v = c.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, W(0)); v.addColorStop(0.2, W(0.22)); v.addColorStop(0.55, W(0.62)); v.addColorStop(0.9, W(0.95)); v.addColorStop(1, W(1));
    c.fillStyle = v; c.fillRect(0, 0, 64, 256);
  });
  const beamCore = place(P, 32, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 32, 0);
    g.addColorStop(0, W(0)); g.addColorStop(0.3, W(0.5)); g.addColorStop(0.5, W(1)); g.addColorStop(0.7, W(0.5)); g.addColorStop(1, W(0));
    c.fillStyle = g; c.fillRect(0, 0, 32, 256);
    c.globalCompositeOperation = 'destination-in';
    const v = c.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, W(0)); v.addColorStop(0.3, W(0.3)); v.addColorStop(0.7, W(0.8)); v.addColorStop(1, W(1));
    c.fillStyle = v; c.fillRect(0, 0, 32, 256);
  });
  const wedge = place(P, 256, 256, (c) => {
    // 60-degree sector pointing right from the left-middle edge, soft edges (used for cone telegraph glow)
    c.translate(0, 128);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 256);
    g.addColorStop(0, W(0.2)); g.addColorStop(0.6, W(0.5)); g.addColorStop(0.95, W(0.9)); g.addColorStop(1, W(0));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 255, -Math.PI / 6, Math.PI / 6); c.closePath(); c.fill();
  });

  // ---- small sprites ----
  const core = place(P, 64, 64, (c) => { c.fillStyle = radial(c, 32, 32, 32, [[0, W(1)], [0.5, W(0.9)], [0.75, W(0.3)], [1, W(0)]]); c.fillRect(0, 0, 64, 64); });
  const dot = place(P, 32, 32, (c) => { c.fillStyle = radial(c, 16, 16, 16, [[0, W(1)], [0.78, W(1)], [1, W(0)]]); c.fillRect(0, 0, 32, 32); });
  const spark = place(P, 64, 16, (c) => {
    c.translate(32, 8); c.scale(4, 1);
    c.fillStyle = radial(c, 0, 0, 8, [[0, W(1)], [0.3, W(0.85)], [0.65, W(0.25)], [1, W(0)]]);
    c.fillRect(-8, -8, 16, 16);
  });
  const streak = place(P, 128, 16, (c) => {
    c.translate(128, 8); c.scale(7, 0.5);
    c.fillStyle = radial(c, 0, 0, 16, [[0, W(1)], [0.22, W(0.7)], [0.6, W(0.22)], [1, W(0)]]);
    c.fillRect(-16, -16, 32, 32);
  });
  const star4 = place(P, 64, 64, (c) => {
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(32, 1); c.quadraticCurveTo(34.5, 29.5, 63, 32); c.quadraticCurveTo(34.5, 34.5, 32, 63); c.quadraticCurveTo(29.5, 34.5, 1, 32); c.quadraticCurveTo(29.5, 29.5, 32, 1); c.fill();
    c.fillStyle = radial(c, 32, 32, 10, [[0, W(1)], [1, W(0)]]); c.fillRect(22, 22, 20, 20);
  });
  const shard: Texture[] = [];
  const shardPts = [
    [[16, 1], [27, 29], [5, 29]],
    [[16, 1], [22, 12], [20, 30], [10, 30], [8, 12]],
    [[3, 16], [16, 4], [29, 16], [16, 29]],
  ];
  for (let v = 0; v < 3; v++) {
    shard.push(place(P, 32, 32, (c) => {
      const pts = shardPts[v];
      const g = c.createLinearGradient(0, 0, 32, 32);
      g.addColorStop(0, W(1)); g.addColorStop(0.55, 'rgba(225,235,245,1)'); g.addColorStop(1, 'rgba(165,185,205,1)');
      c.fillStyle = g;
      c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(40,60,90,0.55)'; c.lineWidth = 1; c.stroke();
      c.strokeStyle = W(0.95); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(pts[1][0], pts[1][1]); c.stroke();
    }));
  }
  const chunk: Texture[] = [];
  for (let v = 0; v < 3; v++) {
    chunk.push(place(P, 32, 32, (c) => {
      const n = 7;
      const pts: number[][] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rng() * 0.4, r = 9 + rng() * 5;
        pts.push([16 + Math.cos(a) * r, 16 + Math.sin(a) * r]);
      }
      const g = c.createLinearGradient(6, 4, 26, 28);
      g.addColorStop(0, 'rgb(236,236,236)'); g.addColorStop(0.5, 'rgb(190,190,190)'); g.addColorStop(1, 'rgb(120,120,120)');
      c.fillStyle = g;
      c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(30,24,20,0.7)'; c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke();
      c.fillStyle = W(0.5);
      c.beginPath(); c.ellipse(12.5, 11.5, 3.5, 2, -0.6, 0, TAU); c.fill();
    }));
  }
  const line = place(P, 16, 16, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 16);
    g.addColorStop(0, W(0)); g.addColorStop(0.3, W(0.45)); g.addColorStop(0.5, W(1)); g.addColorStop(0.7, W(0.45)); g.addColorStop(1, W(0));
    c.fillStyle = g; c.fillRect(0, 0, 16, 16);
  });
  const drip = place(P, 12, 16, (c) => {
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(6, 1); c.bezierCurveTo(10, 7, 11, 10, 6, 15); c.bezierCurveTo(1, 10, 2, 7, 6, 1); c.fill();
  });
  const flake = place(P, 24, 24, (c) => {
    c.strokeStyle = '#fff'; c.lineWidth = 1.7; c.lineCap = 'round';
    c.translate(12, 12);
    for (let i = 0; i < 3; i++) {
      c.rotate(Math.PI / 3);
      c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.stroke();
      c.beginPath(); c.moveTo(5, 0); c.lineTo(8, -3); c.moveTo(5, 0); c.lineTo(8, 3); c.moveTo(-5, 0); c.lineTo(-8, -3); c.moveTo(-5, 0); c.lineTo(-8, 3); c.lineWidth = 1.2; c.stroke(); c.lineWidth = 1.7;
    }
  });
  const plus = place(P, 24, 24, (c) => {
    c.fillStyle = '#fff';
    c.beginPath(); c.roundRect(9, 2, 6, 20, 3); c.fill();
    c.beginPath(); c.roundRect(2, 9, 20, 6, 3); c.fill();
  });
  const shadow = place(P, 64, 32, (c) => {
    c.translate(32, 16); c.scale(2, 1);
    c.fillStyle = radial(c, 0, 0, 16, [[0, 'rgba(0,0,0,0.9)'], [0.6, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]);
    c.fillRect(-16, -16, 32, 32);
  });
  const pixel = place(P, 4, 4, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 4, 4); });

  // ---- coloured sprites ----
  const arrow = place(P, 56, 12, (c) => {
    c.translate(0, 6);
    c.lineCap = 'round';
    c.strokeStyle = '#2a1a10'; c.lineWidth = 3.8; c.beginPath(); c.moveTo(7, 0); c.lineTo(47, 0); c.stroke();
    c.strokeStyle = '#c99357'; c.lineWidth = 2.1; c.beginPath(); c.moveTo(7, 0); c.lineTo(47, 0); c.stroke();
    c.strokeStyle = '#ecc88c'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(8, -0.7); c.lineTo(46, -0.7); c.stroke();
    // head
    c.fillStyle = '#dfe5ea'; c.strokeStyle = '#2a1a10'; c.lineWidth = 1.1; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(45, -3.6); c.lineTo(55, 0); c.lineTo(45, 3.6); c.closePath(); c.fill(); c.stroke();
    // fletching
    for (const s of [-1, 1]) {
      c.fillStyle = s < 0 ? '#e9e2d2' : '#c8452f';
      c.beginPath(); c.moveTo(1.5, s * 4.6); c.lineTo(8.5, s * 0.9); c.lineTo(14, s * 0.9); c.lineTo(10.5, s * 4.3); c.closePath(); c.fill(); c.stroke();
    }
  });
  const bolt = place(P, 48, 10, (c) => {
    c.translate(26, 5); c.scale(4.4, 1);
    c.fillStyle = radial(c, 0, 0, 5, [[0, W(1)], [0.4, W(0.95)], [0.72, W(0.35)], [1, W(0)]]);
    c.fillRect(-5.4, -5, 11, 10);
  });
  const rocket = place(P, 44, 16, (c) => {
    c.translate(0, 8);
    c.lineJoin = 'round';
    c.strokeStyle = '#26130d'; c.lineWidth = 1.4;
    // fins
    c.fillStyle = '#8a2e22';
    c.beginPath(); c.moveTo(6, 0); c.lineTo(1, -7); c.lineTo(13, -3.5); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(6, 0); c.lineTo(1, 7); c.lineTo(13, 3.5); c.closePath(); c.fill(); c.stroke();
    // body
    const g = c.createLinearGradient(0, -4.5, 0, 4.5);
    g.addColorStop(0, '#f2ece0'); g.addColorStop(1, '#b3a994');
    c.fillStyle = g;
    c.beginPath(); c.roundRect(7, -4.2, 22, 8.4, 3); c.fill(); c.stroke();
    c.fillStyle = '#d9402c'; c.fillRect(15, -4, 4, 8);
    // nose
    c.fillStyle = '#e24b2f';
    c.beginPath(); c.moveTo(28, -4.2); c.quadraticCurveTo(39, -3, 42, 0); c.quadraticCurveTo(39, 3, 28, 4.2); c.closePath(); c.fill(); c.stroke();
  });
  const seed = place(P, 20, 14, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 14);
    g.addColorStop(0, '#c4f08a'); g.addColorStop(1, '#4a9a2a');
    c.fillStyle = g; c.strokeStyle = '#1f3d14'; c.lineWidth = 1.3; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(1.5, 7); c.quadraticCurveTo(7, -0.5, 18.5, 7); c.quadraticCurveTo(7, 14.5, 1.5, 7); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = W(0.55); c.beginPath(); c.ellipse(9, 4.2, 3.6, 1.4, -0.15, 0, TAU); c.fill();
  });
  const coin = place(P, 28, 28, (c) => {
    c.fillStyle = radial(c, 11, 10, 15, [[0, '#fff6b8'], [0.5, '#f4c534'], [1, '#b8860b']]);
    c.strokeStyle = '#6e4a08'; c.lineWidth = 1.8;
    c.beginPath(); c.arc(14, 14, 12, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = '#d99a14'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(14, 14, 8, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.6;
    c.beginPath(); c.arc(14, 14, 10, Math.PI * 1.1, Math.PI * 1.55); c.stroke();
  });
  const gem = place(P, 36, 36, (c) => {
    const poly = (pts: number[][], f: string) => {
      c.fillStyle = f; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();
    };
    poly([[6, 13], [12, 5], [18, 13]], 'rgb(235,235,235)');
    poly([[12, 5], [24, 5], [18, 13]], 'rgb(255,255,255)');
    poly([[24, 5], [30, 13], [18, 13]], 'rgb(205,205,205)');
    poly([[6, 13], [18, 13], [18, 32]], 'rgb(180,180,180)');
    poly([[18, 13], [30, 13], [18, 32]], 'rgb(120,120,120)');
    c.strokeStyle = 'rgba(25,20,30,0.85)'; c.lineWidth = 1.4; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(6, 13); c.lineTo(12, 5); c.lineTo(24, 5); c.lineTo(30, 13); c.lineTo(18, 32); c.closePath(); c.stroke();
    c.strokeStyle = 'rgba(25,20,30,0.45)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(6, 13); c.lineTo(30, 13); c.moveTo(12, 5); c.lineTo(18, 13); c.lineTo(24, 5); c.moveTo(18, 13); c.lineTo(18, 32); c.stroke();
    c.fillStyle = W(0.9); c.beginPath(); c.ellipse(14, 8, 2.6, 1.4, -0.4, 0, TAU); c.fill();
  });
  const globe = place(P, 48, 48, (c) => {
    c.fillStyle = radial(c, 24, 24, 22, [[0, 'rgba(255,90,70,0.9)'], [1, 'rgba(255,60,40,0)']]);
    c.fillRect(0, 0, 48, 48);
    const g = c.createRadialGradient(19, 17, 1, 24, 24, 16);
    g.addColorStop(0, '#ffb0a0'); g.addColorStop(0.35, '#e8362a'); g.addColorStop(0.85, '#8a1010'); g.addColorStop(1, '#4a0808');
    c.fillStyle = g; c.strokeStyle = 'rgba(40,6,6,0.9)'; c.lineWidth = 1.6;
    c.beginPath(); c.arc(24, 24, 14, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = W(0.75); c.beginPath(); c.ellipse(19, 17.5, 5, 3, -0.7, 0, TAU); c.fill();
  });
  const badge = place(P, 48, 48, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.roundRect(5, 7, 38, 38, 8); c.fill();
    const g = c.createLinearGradient(0, 4, 0, 42);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#a8a8a8');
    c.fillStyle = g; c.strokeStyle = 'rgba(20,14,10,0.9)'; c.lineWidth = 2.2;
    c.beginPath(); c.roundRect(5, 4, 38, 38, 8); c.fill(); c.stroke();
    c.strokeStyle = W(0.7); c.lineWidth = 1.6; c.beginPath(); c.roundRect(9, 8, 30, 30, 5); c.stroke();
    c.fillStyle = W(0.85); c.beginPath(); c.arc(24, 23, 6, 0, TAU); c.fill();
  });

  source.update();
  return {
    glow, core, dot, ring, ringThick, ringHard, spark, streak, star4, flare, smoke, shard, chunk, slash, disc, scorch, crack,
    poolLava, poolGoo, frostPatch, swirl, holeDark, arrow, bolt, rocket, seed, coin, gem, globe, badge,
    beam, beamCore, line, drip, flake, plus, shadow, wedge, pixel,
  };
}

// ───────────────────────────── glyph atlas ─────────────────────────────

export const GLYPH_CHARS = '0123456789.,-+!%KMBTQaiSxpOcNoDc∞';
const CW = 68, CH = 92, BASE = 70;
export const GLYPH_SIZE = 52;

export interface GlyphSet {
  tex: Record<string, Texture>;
  /** Advance width in atlas pixels. */
  adv: Record<string, number>;
  /** Cell width (atlas px). */
  cw: number;
  /** Baseline as a fraction of cell height (use as particle anchorY). */
  base: number;
  size: number;
}

export interface GlyphAtlas {
  normal: GlyphSet;
  crit: GlyphSet;
  /** Redraw every glyph with a (newly loaded) font family. */
  rebake(family: string): void;
}

export function bakeGlyphAtlas(family: string): GlyphAtlas {
  const chars = Array.from(new Set(GLYPH_CHARS.split('')));
  const cols = Math.floor(1024 / CW);
  const rows = Math.ceil((chars.length * 2) / cols);
  const canvas = mkCanvas(1024, Math.max(256, rows * CH + 4));
  const ctx = canvas.getContext('2d')!;
  const source = new CanvasSource({ resource: canvas, resolution: 1, scaleMode: 'linear', autoGenerateMipmaps: true });
  const mk = (): GlyphSet => ({ tex: {}, adv: {}, cw: CW, base: BASE / CH, size: GLYPH_SIZE });
  const normal = mk(), crit = mk();

  chars.forEach((ch, i) => {
    for (const [set, k] of [[normal, 0], [crit, 1]] as const) {
      const idx = i + k * chars.length;
      const x = (idx % cols) * CW, y = Math.floor(idx / cols) * CH;
      set.tex[ch] = new Texture({ source, frame: new Rectangle(x, y, CW, CH) });
    }
  });

  const draw = (fam: string) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.font = `${GLYPH_SIZE}px ${fam}`;
    chars.forEach((ch, i) => {
      for (const [set, k] of [[normal, 0], [crit, 1]] as const) {
        const idx = i + k * chars.length;
        const cx = (idx % cols) * CW + CW / 2, cy = Math.floor(idx / cols) * CH + BASE;
        set.adv[ch] = ctx.measureText(ch).width;
        const out = k ? 11 : 9;
        // soft drop shadow
        ctx.strokeStyle = 'rgba(0,0,0,0.38)';
        ctx.lineWidth = out + 3;
        ctx.strokeText(ch, cx, cy + 4);
        // hard dark outline
        ctx.strokeStyle = '#140a06';
        ctx.lineWidth = out;
        ctx.strokeText(ch, cx, cy);
        // fill with a subtle top-light gradient (greyscale so particle tint colours it)
        const g = ctx.createLinearGradient(0, cy - GLYPH_SIZE * 0.78, 0, cy + 2);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.55, '#f4f4f4');
        g.addColorStop(1, k ? '#cfcfcf' : '#d6d6d6');
        ctx.fillStyle = g;
        ctx.fillText(ch, cx, cy);
      }
    });
    source.update();
  };
  draw(family);

  return {
    normal, crit,
    rebake(fam: string) { draw(fam); },
  };
}
