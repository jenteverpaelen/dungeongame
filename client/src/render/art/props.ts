// World props (y-sorted, baked once per theme into an atlas and shown as Sprites) and ground decals
// (baked once per theme, then stamped into the ground chunks). Origin = base centre, light from the upper
// left. Tall props use the full ink outline; decals use a theme-tinted outline so they sit in the ground.

import {
  OUT, ball, blob, blobPath, crease, fill, flat, gem, gloss, line, outline, paint, poly, rbox, rivet, seg, spark, star, stitch, wash, type Ctx,
} from './draw';
import { FOLIAGE, GROUND, type ThemeKey } from './palette';
import { TAU, hash2, light, mix, rng, shade } from './util';

/** Props that stand up (y-sorted with entities). Everything else is a ground decal. */
export const SORTED_KINDS = new Set([
  'tree', 'pine', 'deadtree', 'rockspire', 'boulder', 'stump', 'pillar', 'brazier', 'stalagmite', 'cavecrystal',
  'house', 'tavern', 'forge', 'well', 'lantern', 'banner', 'campfire', 'crate', 'fence', 'bush',
]);

/** Number of baked variants per kind. */
export const VARIANTS: Record<string, number> = {
  tree: 4, pine: 3, deadtree: 3, rockspire: 3, boulder: 3, stump: 2, pillar: 3, brazier: 1, stalagmite: 3, cavecrystal: 3,
  house: 3, tavern: 1, forge: 1, well: 1, lantern: 1, banner: 1, campfire: 1, crate: 4, fence: 2, bush: 3,
  grass: 4, flowers: 4, mushrooms: 3, pebbles: 3, fern: 2, ash: 3, bones: 3, cracks: 3, ember: 2, skull: 2, glowmoss: 3,
};

/** Light / fire anchors per prop kind (base-relative, unscaled) for runtime glows & flames. */
export interface PropFx { kind: 'flame' | 'glow' | 'smoke' | 'window'; x: number; y: number; size: number; color: number }
export function propFx(kind: string, theme: ThemeKey, v: number): PropFx[] {
  switch (kind) {
    case 'brazier': return [{ kind: 'glow', x: 0, y: -34, size: 120, color: 0xff8a2a }, { kind: 'flame', x: 0, y: -30, size: 26, color: 0xff7a1a }];
    case 'campfire': return [{ kind: 'glow', x: 0, y: -12, size: 170, color: 0xff9a3a }, { kind: 'flame', x: 0, y: -6, size: 34, color: 0xff7a1a }, { kind: 'smoke', x: 0, y: -40, size: 26, color: 0x8a8070 }];
    case 'lantern': return [{ kind: 'glow', x: 4, y: -62, size: 110, color: 0xffc46a }];
    case 'forge': return [{ kind: 'glow', x: -36, y: -40, size: 150, color: 0xff7a2a }, { kind: 'flame', x: -36, y: -34, size: 18, color: 0xff6a1a }, { kind: 'smoke', x: -56, y: -176, size: 34, color: 0x6a645c }];
    case 'house': return [{ kind: 'window', x: -60, y: -66, size: 46, color: 0xffc46a }, { kind: 'window', x: 52, y: -66, size: 46, color: 0xffc46a }, { kind: 'smoke', x: 50, y: -200, size: 30, color: 0x9a948a }];
    case 'tavern': return [{ kind: 'window', x: -82, y: -60, size: 50, color: 0xffc46a }, { kind: 'window', x: 82, y: -60, size: 50, color: 0xffc46a }, { kind: 'window', x: -50, y: -122, size: 44, color: 0xffb45a }, { kind: 'window', x: 50, y: -122, size: 44, color: 0xffb45a }, { kind: 'glow', x: 0, y: -40, size: 90, color: 0xffb45a }, { kind: 'smoke', x: -78, y: -250, size: 32, color: 0x9a948a }];
    case 'cavecrystal': return [{ kind: 'glow', x: 0, y: -26, size: 90 + v * 10, color: FOLIAGE[theme].glow }];
    case 'stalagmite': return theme === 'riftGlade' ? [{ kind: 'glow', x: 0, y: -40, size: 40, color: 0x6ff2ff }] : [];
    case 'rockspire': return theme === 'ashen' || theme === 'riftAshen' ? [{ kind: 'glow', x: 0, y: -30, size: 60, color: 0xff6a1a }] : [];
    default: return [];
  }
}

// ═══════════════════════════════ helpers ═══════════════════════════════

const W = 3; // prop outline width

function canopyBlob(c: Ctx, x: number, y: number, r: number, col: number, dark: number, lite: number): void {
  // bumpy clump: base, lower shade, top light, outline
  const pts: number[] = [];
  const n = 11;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const rr = r * (0.9 + 0.12 * ((i * 7919) % 3) / 2); pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.88); }
  blobPath(c, pts); fill(c, col);
  wash(c, (k) => k.ellipse(x + r * 0.15, y + r * 0.42, r * 0.85, r * 0.42), dark, 0.8);
  wash(c, (k) => k.ellipse(x - r * 0.25, y - r * 0.32, r * 0.55, r * 0.36), lite, 0.85);
  wash(c, (k) => k.ellipse(x - r * 0.32, y - r * 0.44, r * 0.22, r * 0.12), light(lite, 0.5), 0.6);
  blobPath(c, pts); outline(c, W);
}

function stoneBlocks(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: number, rows: number, seed: number): void {
  c.rect(x0, y0, x1 - x0, y1 - y0); fill(c, col);
  const r = rng(seed);
  const h = (y1 - y0) / rows;
  for (let i = 0; i < rows; i++) {
    let x = x0 + (i % 2 ? -8 : 0);
    const y = y0 + i * h;
    while (x < x1) {
      const w = 14 + r() * 12;
      const xa = Math.max(x0, x), xb = Math.min(x1, x + w);
      if (xb - xa > 3) {
        c.roundRect(xa + 0.8, y + 0.8, xb - xa - 1.6, h - 1.6, 2); fill(c, mix(col, r() < 0.5 ? 0xffffff : 0x000000, r() * 0.12));
      }
      x += w;
    }
  }
  if (!paint.mode) for (let i = 1; i < rows; i++) { c.moveTo(x0, y0 + i * h).lineTo(x1, y0 + i * h); }
  if (!paint.mode) c.stroke({ width: 1, color: OUT, alpha: 0.35 });
  c.rect(x0, y0, x1 - x0, y1 - y0); outline(c, 2.2);
}

function shingles(c: Ctx, pts: number[], col: number, rows: number, seed: number): void {
  // pts: trapezoid [xl0, y0 (bottom-left), xr0, y0, xr1, y1 (top-right), xl1, y1]
  c.poly(pts, true); fill(c, col);
  const r = rng(seed);
  const [xl0, yb, xr0, , xr1, yt, xl1] = pts;
  for (let i = 0; i < rows; i++) {
    const t0 = i / rows, t1 = (i + 1) / rows;
    const ya = yb + (yt - yb) * t0, yb2 = yb + (yt - yb) * t1;
    const xa = xl0 + (xl1 - xl0) * t0, xb = xr0 + (xr1 - xr0) * t0;
    const tone = mix(col, i % 2 ? 0x000000 : 0xffffff, 0.05 + r() * 0.05);
    c.poly([xa, ya, xb, ya, xr0 + (xr1 - xr0) * t1, yb2, xl0 + (xl1 - xl0) * t1, yb2], true); fill(c, tone);
    if (!paint.mode) {
      const step = 13;
      for (let x = xa + (i % 2 ? step / 2 : 0); x < xb - 4; x += step) {
        c.moveTo(x, ya).quadraticCurveTo(x + step / 2, ya + 5.6, x + step, ya);
      }
      c.stroke({ width: 1.3, color: shade(col, 0.55), alpha: 0.75 });
    }
  }
  wash(c, (k) => k.poly([xl0, yb, xr0, yb, xr0 - 4, yb - 7, xl0 + 4, yb - 7], true), shade(col, 0.4), 0.6);
  c.poly(pts, true); outline(c, W);
}

function planks(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: number, vertical: boolean): void {
  c.rect(x0, y0, x1 - x0, y1 - y0); fill(c, col);
  if (!paint.mode) {
    if (vertical) for (let x = x0 + 7; x < x1 - 2; x += 7) c.moveTo(x, y0).lineTo(x, y1);
    else for (let y = y0 + 6; y < y1 - 2; y += 6) c.moveTo(x0, y).lineTo(x1, y);
    c.stroke({ width: 1, color: shade(col, 0.5), alpha: 0.6 });
  }
  c.rect(x0, y0, x1 - x0, y1 - y0); outline(c, 2);
}

function windowPane(c: Ctx, x: number, y: number, w: number, h: number, shutter: number, frame: number): void {
  rbox(c, x - w / 2 - 6, y - h / 2, 6, h, 1, shutter, { ow: 1.8, hl: 0.2 });
  rbox(c, x + w / 2, y - h / 2, 6, h, 1, shutter, { ow: 1.8, hl: 0.2 });
  c.roundRect(x - w / 2, y - h / 2, w, h, 2); fill(c, 0xffd88a);
  wash(c, (k) => k.roundRect(x - w / 2, y - h / 2, w, h * 0.45, 2), 0xfff2c8, 0.7);
  c.rect(x - 1.2, y - h / 2, 2.4, h); fill(c, frame); c.rect(x - w / 2, y - 1.2, w, 2.4); fill(c, frame);
  c.roundRect(x - w / 2, y - h / 2, w, h, 2); outline(c, 2.2);
  rbox(c, x - w / 2 - 4, y + h / 2, w + 8, 4, 1, frame, { ow: 1.6, hl: 0.3 });
}

// ═══════════════════════════════ props ═══════════════════════════════

export function drawProp(c: Ctx, kind: string, v: number, theme: ThemeKey): void {
  const F = FOLIAGE[theme], G = GROUND[theme];
  switch (kind) {
    case 'tree': {
      const leaf = [F.leaf, mix(F.leaf, 0x7aa83a, 0.4), shade(F.leaf, 0.1), mix(F.leaf, 0xa8b040, 0.35)][v % 4];
      const dark = shade(leaf, 0.3), lite = light(leaf, 0.3);
      // trunk with roots
      blob(c, [-7, 0, -12, 2, -8, -6, -6, -30, -2, -42, 4, -42, 7, -30, 8, -6, 12, 2, 6, 1], F.trunk, { hl: 0.15, ow: W });
      crease(c, [-2, -8, -1, -30], 1.2, F.trunkDark, 0.6);
      line(c, (k) => k.moveTo(2, -36).quadraticCurveTo(10, -46, 16, -50), 3, F.trunk, 2.4, false);
      const big = v === 3 ? 1.08 : 1;
      canopyBlob(c, -20 * big, -58, 22 * big, leaf, dark, lite);
      canopyBlob(c, 20 * big, -60, 21 * big, shade(leaf, 0.05), dark, lite);
      canopyBlob(c, -2, -66, 26 * big, leaf, dark, lite);
      canopyBlob(c, -8, -90 * big, 22 * big, light(leaf, 0.04), dark, lite);
      canopyBlob(c, 13, -84 * big, 19 * big, leaf, dark, lite);
      if (v === 1) for (const [x, y] of [[-18, -60], [14, -70], [-4, -92], [22, -56], [-26, -78]] as const) { c.circle(x, y, 2.6); fill(c, 0xd8463a); c.circle(x, y, 2.6); outline(c, 1.2); }
      if (v === 2) for (const [x, y] of [[-14, -66], [16, -80], [0, -98], [-28, -56], [10, -56]] as const) star(c, x, y, 5, 3, 1.3, F.accent, 1);
      break;
    }
    case 'pine': {
      const leaf = mix(F.leaf, 0x2e6a52, 0.45 + v * 0.08), dark = shade(leaf, 0.32), lite = light(leaf, 0.22);
      rbox(c, -5, -22, 10, 22, 2, F.trunk, { ow: W, hl: 0.1 });
      const tiers = [[0, 46, 34], [-26, 38, 30], [-50, 30, 28], [-72, 20, 24]] as const;
      for (const [y, hw, h] of tiers) {
        const pts = [-hw, y - 12, -hw * 0.5, y - 10, 0, y - 12 - h, hw * 0.5, y - 10, hw, y - 12, hw * 0.5, y - 6, 0, y - 8, -hw * 0.5, y - 6];
        c.poly(pts, true); fill(c, leaf);
        wash(c, (k) => k.poly([0, y - 12 - h, hw, y - 12, hw * 0.5, y - 6, 0, y - 8, hw * 0.1, y - 12 - h * 0.6], true), dark, 0.7);
        wash(c, (k) => k.poly([0, y - 12 - h, -hw * 0.55, y - 13, -hw * 0.2, y - 12], true), lite, 0.7);
        c.poly(pts, true); outline(c, W);
      }
      if (theme === 'town' && v === 2) for (const [x, y] of [[-16, -30], [12, -52], [-6, -76]] as const) { c.circle(x, y, 2.2); fill(c, 0xffd27a); }
      break;
    }
    case 'deadtree': {
      const tr = F.trunk, dk = F.trunkDark;
      blob(c, [-8, 0, -13, 2, -7, -8, -5, -36, -10, -54, -4, -50, 0, -62, 4, -48, 9, -56, 7, -36, 8, -8, 13, 2], tr, { hl: 0.12, ow: W });
      line(c, (k) => k.moveTo(-4, -44).quadraticCurveTo(-18, -50, -24, -66).moveTo(-20, -58).lineTo(-30, -60), 3, tr, 2.6, false);
      line(c, (k) => k.moveTo(5, -40).quadraticCurveTo(18, -46, 22, -62).moveTo(19, -54).lineTo(27, -52), 3, tr, 2.6, false);
      if (v >= 1) line(c, (k) => k.moveTo(0, -60).quadraticCurveTo(-2, -72, 4, -80), 2.4, tr, 2.4, false);
      crease(c, [-2, -6, -1, -30, 1, -44], 1.2, dk, 0.7);
      if (theme === 'ashen' || theme === 'riftAshen') {
        for (const [x, y] of [[-3, -20], [2, -34], [-1, -12]] as const) { c.ellipse(x, y, 1.6, 2.6); fill(c, 0xff7a1a); }
      }
      break;
    }
    case 'rockspire': {
      const r = F.rock, rd = F.rockDark, rl = F.rockLight;
      const h = 70 + v * 10;
      const pts = [-22, 0, -18, -h * 0.4, -12, -h * 0.75, -4, -h, 6, -h * 0.82, 12, -h * 0.5, 20, -h * 0.2, 24, 0];
      poly(c, pts, r, { hl: 0, inset: 0.86, px: -0.25 });
      wash(c, (k) => k.poly([-4, -h, -12, -h * 0.75, -18, -h * 0.4, -22, 0, -10, 0, -8, -h * 0.5], true), rl, 0.45);
      crease(c, [-6, -h * 0.85, -2, -h * 0.5, -6, -h * 0.2], 1.4, rd, 0.8);
      crease(c, [10, -h * 0.5, 6, -h * 0.25, 12, -6], 1.4, rd, 0.8);
      if (theme === 'ashen' || theme === 'riftAshen') {
        line(c, (k) => k.moveTo(-2, -h * 0.62).lineTo(2, -h * 0.4).lineTo(-1, -h * 0.22), 1.6, 0xff7a1a, 0, false);
      }
      c.poly(pts, true); outline(c, W);
      // small rock at the base
      ball(c, 18, -2, 9, 6, rd, { ow: 2.4, hl: 0.15 });
      break;
    }
    case 'boulder': {
      const r = F.rock;
      ball(c, 10, -10, 16, 12, shade(r, 0.08), { ow: W, hl: 0.25 });
      ball(c, -6, -16, 22, 17, r, { ow: W, hl: 0.3 });
      crease(c, [-14, -20, -6, -14, -8, -6], 1.2, F.rockDark, 0.7);
      if (theme === 'town' || theme === 'glade') {
        blob(c, [-24, -22, -16, -32, -2, -33, 10, -26, 2, -24, -10, -26], F.moss, { ow: 2.2, hl: 0.25 });
      } else if (v === 2) {
        for (const [x, y] of [[-10, -26], [4, -22]] as const) { c.ellipse(x, y, 4, 2); fill(c, 0x8a8078, 0.8); }
      }
      if (v === 1) ball(c, -26, -4, 7, 5, shade(r, 0.12), { ow: 2.2, hl: 0.2 });
      break;
    }
    case 'stump': {
      const tr = F.trunk;
      blob(c, [-14, 0, -18, 2, -13, -4, -12, -16, 12, -16, 13, -4, 18, 2, 14, 0], tr, { ow: W, hl: 0.15 });
      ball(c, 0, -16, 12.4, 4.6, light(tr, 0.3), { ow: 2.4, hl: 0 });
      if (!paint.mode) { c.ellipse(0, -16, 8, 2.8).stroke({ width: 1, color: shade(tr, 0.3), alpha: 0.7 }); c.ellipse(0, -16, 4, 1.4).stroke({ width: 1, color: shade(tr, 0.3), alpha: 0.7 }); }
      crease(c, [-6, -12, -7, -2], 1.2, F.trunkDark, 0.7);
      if (v === 1 || theme === 'glade') { rbox(c, 9, -8, 2.4, 5, 1, 0xf3e3c3, { ow: 1.2 }); ball(c, 10.2, -8.6, 4, 2.6, 0xd8463a, { ow: 1.4, hl: 0.3 }); }
      break;
    }
    case 'pillar': {
      const st = theme === 'riftAshen' ? 0x7a4a44 : theme === 'riftGlade' ? 0x5a8a86 : theme === 'ashen' ? 0x8a8078 : 0xb0a896;
      const h = [62, 48, 74][v % 3];
      rbox(c, -20, -12, 40, 12, 2, shade(st, 0.12), { ow: W, hl: 0.2 });
      rbox(c, -15, -h, 30, h - 10, 2, st, { ow: W, hl: 0.25 });
      for (const x of [-8, 0, 8]) crease(c, [x, -h + 4, x, -14], 1.2, shade(st, 0.35), 0.6);
      // broken top
      poly(c, [-16, -h, -12, -h - 6, -4, -h - 2, 4, -h - 9, 10, -h - 3, 16, -h - 5, 16, -h + 2, -16, -h + 2], light(st, 0.1), { ow: W, hl: 0.2 });
      if (v === 1) ball(c, 24, -6, 10, 6, st, { ow: 2.4, hl: 0.25 });
      if (theme === 'ashen' || theme === 'riftAshen') wash(c, (k) => k.rect(-15, -h * 0.5, 30, h * 0.4), 0x1a1210, 0.25);
      if (theme === 'glade' || theme === 'town') blob(c, [-15, -22, -8, -30, -2, -24, -6, -16], F.moss, { ow: 1.8 });
      break;
    }
    case 'brazier': {
      const iron = 0x4a4448;
      for (const [x0, x1] of [[-6, -14], [6, 14], [0, 1]] as const) seg(c, x0, -22, x1, 0, 2.6, iron, 2.2);
      blob(c, [-16, -30, 16, -30, 12, -20, -12, -20], iron, { ow: W, hl: 0.3 });
      ball(c, 0, -30, 16, 4, 0x2a1810, { ow: 2.4, hl: 0 });
      for (const [x, y] of [[-6, -31], [3, -32], [8, -30]] as const) ball(c, x, y, 3.6, 2.4, 0xff8a2a, { ow: 1.4, hl: 0.5 });
      rivet(c, -8, -25); rivet(c, 8, -25);
      break;
    }
    case 'stalagmite': {
      const r = F.rock, tip = theme === 'riftGlade' ? 0x8ff0e0 : F.rockLight;
      const cones = [[-12, 30 + v * 4, 9], [10, 22, 8], [0, 48 + v * 6, 12]] as const;
      for (const [x, h, w] of cones) {
        const pts = [x - w, 0, x - w * 0.4, -h * 0.6, x, -h, x + w * 0.45, -h * 0.55, x + w, 0];
        poly(c, pts, r, { hl: 0, inset: 0.82 });
        wash(c, (k) => k.poly([x - w * 0.4, -h * 0.6, x, -h, x - 2, -h * 0.5, x - w * 0.6, -2], true), F.rockLight, 0.45);
        c.poly([x - w * 0.22, -h * 0.75, x, -h, x + w * 0.22, -h * 0.74], true); fill(c, tip);
        c.poly(pts, true); outline(c, W);
      }
      break;
    }
    case 'cavecrystal': {
      const g = F.glow;
      const shards = v === 0 ? [[0, 56, 9, 0], [-14, 36, 7, -0.35], [13, 40, 7, 0.32]] : v === 1 ? [[-4, 64, 10, -0.08], [12, 30, 6, 0.4], [-18, 28, 6, -0.45]] : [[0, 44, 8, 0.05], [-11, 52, 8, -0.22], [14, 34, 7, 0.4], [-22, 22, 5, -0.6]];
      ball(c, 0, -3, 24, 7, F.rockDark, { ow: 2.6, hl: 0.15 });
      for (const [x, h, w, a] of shards) {
        const cs = Math.cos(a), sn = Math.sin(a);
        const P = (px: number, py: number) => [x + px * cs - py * sn, -4 + px * sn + py * cs];
        const pts = [...P(-w, 0), ...P(-w, -h * 0.75), ...P(0, -h), ...P(w, -h * 0.75), ...P(w, 0)];
        c.poly(pts, true); fill(c, mix(g, 0x1f4a66, 0.55));
        wash(c, (k) => k.poly([...P(-w, 0), ...P(-w, -h * 0.75), ...P(0, -h), ...P(0, 0)], true), mix(g, 0x2a6a8a, 0.15), 0.85);
        wash(c, (k) => k.poly([...P(-w * 0.55, -h * 0.2), ...P(-w * 0.55, -h * 0.7), ...P(-w * 0.2, -h * 0.8), ...P(-w * 0.2, -h * 0.25)], true), 0xe8ffff, 0.45);
        c.poly(pts, true); outline(c, 2.6);
      }
      break;
    }
    case 'bush': {
      const leaf = mix(F.leaf, 0x4a8a3a, 0.3), dark = shade(leaf, 0.3), lite = light(leaf, 0.28);
      canopyBlob(c, -10, -12, 12, leaf, dark, lite);
      canopyBlob(c, 10, -12, 11, shade(leaf, 0.06), dark, lite);
      canopyBlob(c, 0, -19, 13, leaf, dark, lite);
      if (v === 1) for (const [x, y] of [[-8, -16], [6, -22], [12, -10], [-2, -10]] as const) { c.circle(x, y, 2); fill(c, 0xd84a6a); c.circle(x, y, 2); outline(c, 1); }
      if (v === 2) for (const [x, y] of [[-6, -22], [8, -16], [-12, -10]] as const) star(c, x, y, 5, 2.6, 1.1, 0xf6f0d8, 0.9);
      break;
    }
    case 'house': return house(c, v);
    case 'tavern': return tavern(c);
    case 'forge': return forge(c);
    case 'well': {
      const wood = 0x8a5a34, roof = 0x9a4a3a;
      seg(c, -26, -14, -26, -64, 4, wood, 2.4); seg(c, 26, -14, 26, -64, 4, wood, 2.4);
      // stone ring
      c.rect(-30, -26, 60, 22); fill(c, 0x9a958a);
      stoneBlocks(c, -30, -26, 30, -4, 0x9a958a, 2, 7);
      ball(c, 0, -26, 30, 8, 0xaaa59a, { ow: W, hl: 0.25 });
      c.ellipse(0, -26, 22, 5); fill(c, 0x1a2a3a);
      wash(c, (k) => k.ellipse(-4, -27, 8, 1.6), 0x5a8ab0, 0.7);
      // roof
      poly(c, [-38, -60, 0, -84, 38, -60, 32, -56, 0, -76, -32, -56], roof, { hl: 0.2 });
      seg(c, -26, -50, 26, -50, 2.2, wood, 1.8);
      line(c, (k) => k.moveTo(4, -50).lineTo(4, -36), 0.8, 0xd8c8a0, 1, false);
      rbox(c, -1, -38, 10, 8, 1.6, wood, { ow: 1.8, hl: 0.2 });
      break;
    }
    case 'lantern': {
      const iron = 0x3a3638;
      rbox(c, -6, -6, 12, 6, 1.6, 0x5a5650, { ow: 2.4, hl: 0.2 });
      seg(c, 0, -4, 0, -64, 3, iron, 2.2);
      line(c, (k) => k.moveTo(0, -64).quadraticCurveTo(6, -70, 10, -64), 2, iron, 1.8, false);
      seg(c, 10, -64, 10, -60, 1, iron, 1, false);
      rbox(c, 4, -60, 12, 15, 2, 0xffd27a, { ow: 2.4, hl: 0.5 });
      c.rect(9.2, -60, 1.6, 15); fill(c, iron);
      poly(c, [2.6, -60, 10, -66, 17.4, -60], iron, { ow: 2 });
      rbox(c, 3.4, -46, 13.2, 3, 1, iron, { ow: 1.6, hl: 0 });
      break;
    }
    case 'banner': {
      seg(c, 0, 0, 0, -92, 3.4, 0x6a4428, 2.4);
      c.circle(0, -94, 3.4); fill(c, 0xe8b64a); c.circle(0, -94, 3.4); outline(c, 1.8);
      seg(c, -2, -86, 26, -86, 2.4, 0x6a4428, 2);
      break;
    }
    case 'banner_cloth': {
      const red = 0xa8322a;
      const pts = [0, 0, 24, 0, 24, 44, 12, 36, 0, 44];
      c.poly(pts, true); fill(c, red);
      wash(c, (k) => k.poly([0, 0, 24, 0, 24, 6, 0, 6], true), 0xe8b64a, 1);
      wash(c, (k) => k.poly([16, 6, 24, 6, 24, 44, 16, 39], true), 0x000000, 0.18);
      // hearth crest: a flame over a hearth stone
      blob(c, [12, 12, 15.6, 18, 15, 24, 12, 26, 9, 24, 8.4, 18], 0xffc04a, { ow: 1.4, hl: 0 });
      blob(c, [12, 17, 13.6, 21, 12, 24, 10.4, 21], 0xfff0b0, { ow: 0, hl: 0 });
      rbox(c, 6.6, 26, 10.8, 3.4, 1, 0xe8b64a, { ow: 1.2, hl: 0 });
      c.poly(pts, true); outline(c, 2.2);
      break;
    }
    case 'campfire': {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        ball(c, Math.cos(a) * 16, -2 + Math.sin(a) * 6, 5, 3.6, i % 2 ? 0x8a857a : 0x9e998e, { ow: 2, hl: 0.25 });
      }
      seg(c, -12, -2, 10, -10, 4, 0x6a4428, 2.2);
      seg(c, 12, -2, -10, -10, 4, 0x7a5232, 2.2);
      ball(c, 0, -5, 8, 3, 0x2a1810, { ow: 0, hl: 0 });
      for (const [x, y] of [[-4, -6], [3, -5], [0, -3]] as const) ball(c, x, y, 2.6, 1.6, 0xff8a2a, { ow: 1, hl: 0.5 });
      break;
    }
    case 'crate': {
      const wood = 0x9a6a3c;
      if (v === 1) { // barrel
        rbox(c, -13, -32, 26, 32, 8, 0x8a5a34, { ow: W, hl: 0.25 });
        for (const y of [-26, -8]) { c.rect(-13, y, 26, 3); fill(c, 0x4a4448); }
        for (const x of [-6, 0, 6]) crease(c, [x, -30, x, -2], 1, 0x4a3018, 0.5);
        ball(c, 0, -32, 12, 3.4, 0x7a4a28, { ow: 2.2, hl: 0 });
      } else if (v === 2) { // sacks
        blob(c, [-18, 0, -20, -14, -12, -22, -4, -20, -2, -8, -4, 0], 0xc8b080, { ow: W, hl: 0.25 });
        blob(c, [-4, 0, -2, -16, 6, -26, 14, -22, 18, -10, 16, 0], 0xd4bc8c, { ow: W, hl: 0.25 });
        crease(c, [4, -24, 8, -20], 1.6, 0x8a6a42, 0.9);
      } else {
        const n = v === 3 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const ox = i === 1 ? 6 : 0, oy = i === 1 ? -28 : 0, s = i === 1 ? 0.8 : 1;
          const x0 = ox - 15 * s, x1 = ox + 15 * s, y0 = oy - 28 * s, y1 = oy;
          planks(c, x0, y0, x1, y1, wood, false);
          seg(c, x0 + 3, y0 + 3, x1 - 3, y1 - 3, 2.4, shade(wood, 0.15), 1.6, false);
          c.rect(x0, y0, x1 - x0, y1 - y0); outline(c, W);
          for (const [x, y] of [[x0 + 3, y0 + 3], [x1 - 3, y0 + 3], [x0 + 3, y1 - 3], [x1 - 3, y1 - 3]] as const) rivet(c, x, y, 0.9, 0xb0aca4);
        }
      }
      break;
    }
    case 'fence': {
      const wood = 0x9a6a3c;
      for (const x of [-30, 0, 30]) {
        rbox(c, x - 3, -28, 6, 28, 1.6, wood, { ow: 2.4, hl: 0.2 });
        poly(c, [x - 3, -28, x, -32, x + 3, -28], wood, { ow: 2.2 });
      }
      for (const y of [-22, -11]) { rbox(c, -33, y, 66, 5, 1.6, light(wood, 0.06), { ow: 2.2, hl: 0.25 }); }
      if (v === 1) { c.moveTo(-14, -20).lineTo(-6, -8); outline(c, 1.4); }
      break;
    }
    default: {
      ball(c, 0, -10, 12, 10, G.stone, { ow: W });
    }
  }
}

function house(c: Ctx, v: number): void {
  const roof = [0xb04a38, 0x4a6e9a, 0x5e7e44][v % 3];
  const shutter = [0x3f6a4a, 0x8a3a2a, 0x3a5a8a][v % 3];
  const plaster = 0xeadcbc, beam = 0x6a4428;
  // chimney (behind roof)
  stoneBlocks(c, 40, -204, 60, -150, 0x8a857a, 5, 11);
  rbox(c, 37, -210, 26, 8, 1.6, 0x6a665e, { ow: 2.4, hl: 0.2 });
  // walls
  c.rect(-92, -104, 184, 92); fill(c, plaster);
  wash(c, (k) => k.rect(-92, -104, 184, 92), 0xffffff, 0.08);
  for (const x of [-92, -34, 30, 86]) { c.rect(x, -104, 7, 92); fill(c, beam); }
  c.rect(-92, -62, 184, 6); fill(c, beam);
  c.moveTo(-85, -62).lineTo(-36, -100).moveTo(37, -100).lineTo(86, -62); detailLine(c, beam, 4);
  c.rect(-92, -104, 184, 92); outline(c, W);
  // foundation
  stoneBlocks(c, -98, -16, 98, 0, 0x9a958a, 2, 3 + v);
  // door
  blob(c, [-14, -14, -14, -46, -8, -56, 8, -56, 14, -46, 14, -14], 0x7a4a28, { ow: W, hl: 0.15 });
  for (const x of [-6, 0, 6]) crease(c, [x, -52, x, -16], 1, 0x4a2a14, 0.6);
  c.circle(8, -32, 1.8); fill(c, 0xe8b64a);
  rbox(c, -20, -16, 40, 5, 1.4, 0x8a857a, { ow: 2, hl: 0.2 });
  // windows
  windowPane(c, -60, -78, 24, 22, shutter, beam);
  windowPane(c, 52, -78, 24, 22, shutter, beam);
  // flower boxes
  for (const x of [-60, 52]) {
    rbox(c, x - 15, -64, 30, 6, 1.4, 0x7a4a28, { ow: 1.8, hl: 0.2 });
    for (let i = 0; i < 5; i++) { c.circle(x - 11 + i * 5.5, -65, 2.2); fill(c, [0xe84a6a, 0xf6e27a, 0xffffff][i % 3]); }
  }
  // roof (front slope, slight perspective)
  shingles(c, [-118, -96, 118, -96, 98, -176, -98, -176], roof, 6, 21 + v);
  rbox(c, -102, -184, 204, 10, 4, shade(roof, 0.25), { ow: W, hl: 0.3 });
  // eave shadow on the wall
  wash(c, (k) => k.rect(-92, -104, 184, 9), 0x000000, 0.22);
}

function detailLine(c: Ctx, col: number, w: number): void {
  c.stroke({ width: w, color: paint.mode ? 0xffffff : col, cap: 'round' });
}

function tavern(c: Ctx): void {
  const roof = 0x6a4a6a, plaster = 0xe6d4ae, beam = 0x5e3c22;
  stoneBlocks(c, -96, -268, -64, -200, 0x8a857a, 6, 13);
  rbox(c, -100, -274, 40, 8, 1.6, 0x6a665e, { ow: 2.4, hl: 0.2 });
  // ground floor (stone) + upper floor (timber)
  stoneBlocks(c, -120, -96, 120, -12, 0xa59e90, 6, 17);
  c.rect(-112, -170, 224, 74); fill(c, plaster);
  for (const x of [-112, -56, -4, 50, 105]) { c.rect(x, -170, 7, 74); fill(c, beam); }
  c.rect(-116, -100, 232, 8); fill(c, beam);
  c.rect(-112, -170, 224, 74); outline(c, W);
  stoneBlocks(c, -126, -14, 126, 0, 0x8a857a, 1, 5);
  // windows
  for (const x of [-82, 82]) windowPane(c, x, -58, 30, 26, 0x8a3a2a, beam);
  for (const x of [-50, 50]) windowPane(c, x, -132, 24, 22, 0x8a3a2a, beam);
  // big double door
  blob(c, [-20, -12, -20, -56, -12, -70, 12, -70, 20, -56, 20, -12], 0x6a3a1e, { ow: W, hl: 0.15 });
  crease(c, [0, -70, 0, -14], 1.4, 0x3a2010, 0.8);
  for (const x of [-12, 12]) crease(c, [x, -60, x, -14], 1, 0x3a2010, 0.5);
  c.circle(-4, -36, 1.8); fill(c, 0xe8b64a); c.circle(4, -36, 1.8); fill(c, 0xe8b64a);
  // sign on a bracket
  seg(c, 24, -92, 60, -92, 2.4, 0x3a3638, 1.8);
  for (const x of [32, 54]) seg(c, x, -92, x, -86, 0.8, 0x3a3638, 0.8, false);
  rbox(c, 26, -88, 34, 22, 3, 0x9a6a3c, { ow: 2.4, hl: 0.3 });
  // mug icon
  rbox(c, 36, -84, 11, 13, 2, 0xe8b64a, { ow: 1.6, hl: 0.3 });
  wash(c, (k) => k.ellipse(41.5, -84, 5.4, 2.4), 0xffffff, 0.9);
  line(c, (k) => k.moveTo(47, -81).quadraticCurveTo(52, -78, 47, -74), 1.4, 0xe8b64a, 1.2, false);
  // roof
  shingles(c, [-142, -164, 142, -164, 118, -252, -118, -252], roof, 7, 33);
  rbox(c, -122, -260, 244, 11, 4, shade(roof, 0.25), { ow: W, hl: 0.3 });
  wash(c, (k) => k.rect(-112, -170, 224, 9), 0x000000, 0.22);
  // barrels by the wall
  for (const x of [-108, 104]) {
    rbox(c, x - 11, -26, 22, 26, 7, 0x8a5a34, { ow: 2.4, hl: 0.25 });
    for (const y of [-21, -7]) { c.rect(x - 11, y, 22, 2.6); fill(c, 0x4a4448); }
  }
}

function forge(c: Ctx): void {
  const slate = 0x5a6070, stone = 0x8a857a, wood = 0x6a4428;
  // chimney + back wall
  stoneBlocks(c, -72, -186, -42, -40, stone, 9, 41);
  rbox(c, -76, -192, 38, 9, 2, 0x6a665e, { ow: 2.4, hl: 0.2 });
  stoneBlocks(c, -96, -118, 96, -14, shade(stone, 0.08), 6, 43);
  // posts
  for (const x of [-92, 88]) rbox(c, x - 4, -128, 9, 116, 1.6, wood, { ow: 2.4, hl: 0.15 });
  // furnace (stone dome with a glowing mouth)
  blob(c, [-66, -12, -68, -52, -52, -70, -22, -70, -6, -52, -6, -12], stone, { hl: 0.2, ow: W });
  blob(c, [-50, -14, -50, -36, -40, -46, -32, -46, -22, -36, -22, -14], 0x2a1410, { hl: 0, ow: 2.4 });
  blob(c, [-46, -14, -46, -32, -38, -40, -34, -40, -26, -32, -26, -14], 0xff7a1a, { hl: 0, ow: 0 });
  wash(c, (k) => k.ellipse(-36, -22, 7, 6), 0xffd23f, 0.95);
  // anvil on a stump
  rbox(c, 18, -26, 18, 16, 2, 0x7a5232, { ow: 2.4, hl: 0.2 });
  poly(c, [6, -38, 48, -38, 44, -32, 36, -30, 36, -26, 18, -26, 18, -30, 12, -32], 0x4a4a52, { hl: 0.4 });
  // tool rack
  seg(c, 54, -96, 84, -96, 2.4, wood, 2);
  seg(c, 62, -96, 62, -70, 1.6, 0x8a8a92, 1.6, false);
  rbox(c, 58, -74, 8, 6, 1, 0x8a8a92, { ow: 1.6 });
  seg(c, 76, -96, 76, -66, 1.6, wood, 1.6, false);
  poly(c, [72, -66, 80, -66, 80, -60, 72, -62], 0x8a8a92, { ow: 1.6 });
  // slate roof
  shingles(c, [-114, -116, 114, -116, 98, -160, -98, -160], slate, 3, 51);
  rbox(c, -102, -166, 204, 9, 4, shade(slate, 0.25), { ow: W, hl: 0.3 });
}

// ═══════════════════════════════ decals ═══════════════════════════════

export function drawDecal(c: Ctx, kind: string, v: number, theme: ThemeKey): void {
  const G = GROUND[theme], F = FOLIAGE[theme];
  const ink = G.decalInk;
  const o = (w = 1.4) => outline(c, w, ink, 0.9);
  const r = rng(kind.length * 131 + v * 17 + 3);
  switch (kind) {
    case 'grass': {
      const base = theme === 'town' ? G.floorLight : light(G.floor, 0.15);
      const n = 5 + v;
      for (let i = 0; i < n; i++) {
        const x = (i - n / 2) * 2.6 + r() * 1.6, h = 7 + r() * 6, lean = (r() - 0.5) * 6;
        c.poly([x - 1.8, 0, x + lean, -h, x + 1.8, 0], true); fill(c, i % 2 ? base : mix(base, G.floorDark, 0.4));
        c.poly([x - 1.8, 0, x + lean, -h, x + 1.8, 0], true); o(1.1);
      }
      break;
    }
    case 'flowers': {
      const pet = [0xf6f0d8, 0xf6d35e, 0xf28aa8, 0x8ab8f2][v % 4];
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 7 + r() * 3, y = -r() * 4;
        line(c, (k) => k.moveTo(x, 0).lineTo(x + 0.6, y - 6), 1, shade(G.floor, 0.25), 0, false);
        for (let p = 0; p < 5; p++) { const a = (p / 5) * TAU; c.circle(x + Math.cos(a) * 2.2, y - 7 + Math.sin(a) * 2.2, 1.8); fill(c, pet); }
        c.circle(x, y - 7, 1.4); fill(c, 0xf2b63a);
      }
      c.ellipse(0, 0.5, 9, 2.2); fill(c, G.floorDark, 0.5);
      break;
    }
    case 'mushrooms': {
      const cap = theme === 'riftGlade' ? 0x6ff2d0 : [0xd8463a, 0xb08050, 0x8e3fb0][v % 3];
      for (const [x, s] of [[-5, 1], [3, 0.75], [8, 0.55]] as const) {
        rbox(c, x - 1.4 * s, -6 * s, 2.8 * s, 6 * s, 1, 0xf3e3c3, { ow: 1, oc: ink });
        blob(c, [x - 5 * s, -5 * s, x - 3 * s, -9 * s, x + 3 * s, -9 * s, x + 5 * s, -5 * s], cap, { ow: 1.2, oc: ink, hl: 0.3 });
        if (cap === 0xd8463a) { c.circle(x - 1.4 * s, -7.4 * s, 0.9 * s); fill(c, 0xffffff); }
      }
      break;
    }
    case 'pebbles': {
      const st = theme === 'ashen' || theme === 'riftAshen' ? F.rockLight : mix(G.stone, G.floor, 0.3);
      for (let i = 0; i < 3 + v; i++) {
        const x = (r() - 0.5) * 18, y = (r() - 0.5) * 6, s = 1.6 + r() * 2.4;
        c.ellipse(x, y, s * 1.3, s); fill(c, mix(st, 0xffffff, r() * 0.15)); c.ellipse(x, y, s * 1.3, s); o(1);
        if (!paint.mode) c.ellipse(x - s * 0.3, y - s * 0.35, s * 0.5, s * 0.3).fill({ color: 0xffffff, alpha: 0.4 });
      }
      break;
    }
    case 'fern': {
      const leaf = mix(F.leaf, 0x5aa04a, 0.3);
      for (const a of [-2.3, -1.57, -0.85]) {
        const ex = Math.cos(a) * 14, ey = Math.sin(a) * 12;
        line(c, (k) => k.moveTo(0, 0).quadraticCurveTo(ex * 0.5, ey * 0.8, ex, ey), 1, shade(leaf, 0.3), 0, false);
        for (let i = 1; i < 5; i++) {
          const t = i / 5, px = ex * t, py = ey * t - t * (1 - t) * 4;
          c.ellipse(px, py, 3 * (1 - t * 0.5), 1.4); fill(c, i % 2 ? leaf : light(leaf, 0.15));
        }
      }
      break;
    }
    case 'ash': {
      c.ellipse(0, 0, 14 + v * 3, 5 + v); fill(c, mix(G.floorLight, 0x9a948c, 0.5), 0.55);
      for (let i = 0; i < 6; i++) { c.circle((r() - 0.5) * 22, (r() - 0.5) * 7, 0.8 + r()); fill(c, 0xb0aaa2, 0.8); }
      break;
    }
    case 'bones': {
      const b = 0xe6dcc4;
      const bone = (x0: number, y0: number, x1: number, y1: number) => {
        line(c, (k) => k.moveTo(x0, y0).lineTo(x1, y1), 2, b, 1.1);
        for (const [x, y] of [[x0, y0], [x1, y1]]) { c.circle(x, y, 1.8); fill(c, b); c.circle(x, y, 1.8); o(1); }
      };
      if (v === 0) { bone(-8, -2, 8, 2); bone(-6, 3, 7, -3); }
      else if (v === 1) { for (let i = 0; i < 3; i++) line(c, (k) => k.moveTo(-6 + i * 5, 2).quadraticCurveTo(-3 + i * 5, -8, 2 + i * 5, -2), 1.6, b, 1.1, false); bone(-10, 3, 8, 3); }
      else bone(-9, 0, 9, -1);
      break;
    }
    case 'cracks': {
      const glowy = theme === 'ashen' || theme === 'riftAshen';
      const pts: number[][] = [[-14, -2, -6, 0, -2, -4, 6, -2, 14, 2], [-6, 0, -8, 5], [6, -2, 9, -6]];
      for (const p of pts) { c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); }
      c.stroke({ width: 2.6, color: shade(G.floorDark, 0.5), cap: 'round', join: 'round' });
      if (glowy) { for (const p of pts) { c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); } c.stroke({ width: 1, color: 0xff7a1a, cap: 'round', join: 'round' }); }
      break;
    }
    case 'ember': {
      c.ellipse(0, 0, 8, 3.4); fill(c, 0x2a1810, 0.85);
      for (const [x, y, s] of [[-2, 0, 2.4], [3, -0.5, 1.8], [0, 1, 1.4]] as const) { c.ellipse(x, y, s * 1.3, s * 0.8); fill(c, 0xff7a1a); c.ellipse(x, y - 0.3, s * 0.6, s * 0.4); fill(c, 0xffd23f); }
      break;
    }
    case 'skull': {
      ball(c, 0, -4, 6, 5.4, 0xe6dcc4, { ow: 1.4, oc: ink, hl: 0.3 });
      rbox(c, -0.5, -1, 6.4, 3.2, 1.2, 0xd8cdb4, { ow: 1.2, oc: ink, hl: 0 });
      c.circle(1.6, -4.4, 1.4); fill(c, 0x2a2020); c.circle(5, -4.2, 1.2); fill(c, 0x2a2020);
      break;
    }
    case 'glowmoss': {
      const g = theme === 'riftGlade' ? 0x6ff2c8 : 0x9aff8a;
      for (let i = 0; i < 6 + v * 2; i++) {
        const x = (r() - 0.5) * 22, y = (r() - 0.5) * 8, s = 1.4 + r() * 2;
        c.ellipse(x, y, s * 1.4, s); fill(c, mix(g, 0x1a4a40, 0.35 + r() * 0.3));
        c.ellipse(x - 0.4, y - 0.4, s * 0.6, s * 0.45); fill(c, light(g, 0.4));
      }
      break;
    }
    default:
      c.circle(0, 0, 3); fill(c, ink);
  }
}

/** Decals that glow and gently pulse at runtime (additive sprite in the decal layer). */
export function decalGlow(kind: string, theme: ThemeKey): { color: number; size: number } | null {
  if (kind === 'ember') return { color: 0xff7a1a, size: 30 };
  if (kind === 'glowmoss') return { color: theme === 'riftGlade' ? 0x6ff2c8 : 0x9aff8a, size: 36 };
  if (kind === 'cracks' && (theme === 'ashen' || theme === 'riftAshen')) return { color: 0xff5a1a, size: 26 };
  if (kind === 'mushrooms' && theme === 'riftGlade') return { color: 0x6ff2d0, size: 24 };
  return null;
}


