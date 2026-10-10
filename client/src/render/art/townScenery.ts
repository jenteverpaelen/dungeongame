// Hearthmere scenery kit (docs/rework/DESIGN.md §4): every prop and decor kind painted in the same hand as the houses.
// Tall things become y-sorted sprites (textures shared per kind/variant/scale); flat things are painted straight into
// the ground chunks by paintGroundDecor. Ambient motion (boats, waterwheel, lamp flicker) runs in onRender.
import { CanvasSource, Container, Sprite, Texture } from 'pixi.js';
import type { Point, TownData } from '@shared/townTypes';
import type { MapLayers } from './index';
import { glowSprite } from './fx';
import { ellipse, hash, INK, line, poly, rrect, tone, type Paint } from './townKit';

const DENSITY = 1.6;
type Box = { x0: number; y0: number; x1: number; y1: number };
interface Art { box: Box; draw: (c: Paint) => void }

// ─────────────────────────── trees ───────────────────────────

type Blob = [number, number, number];
function crown(c: Paint, blobs: Blob[], s: number, cy: number, dark: string, mid: string, lit: string, seed: number) {
  for (const [x, y, r] of blobs) ellipse(c, x * s, cy + y * s + 2, r * s + 2.2, r * 0.86 * s + 2.2, INK);
  for (const [x, y, r] of blobs) ellipse(c, x * s, cy + y * s, r * s, r * 0.86 * s, dark);
  for (const [i, [x, y, r]] of blobs.entries()) ellipse(c, x * s - r * s * 0.16, cy + y * s - r * s * 0.2, r * s * 0.76, r * s * 0.62, i % 3 === 2 ? dark : mid);
  for (const [x, y, r] of blobs) ellipse(c, x * s - r * s * 0.34, cy + y * s - r * s * 0.4, r * s * 0.36, r * s * 0.28, lit);
  for (let i = 0; i < blobs.length * 14; i++) {
    const [x, y, r] = blobs[i % blobs.length], a = hash(i, 1, seed) * Math.PI * 2, d = Math.sqrt(hash(i, 2, seed)) * r * 0.9;
    const px = x * s + Math.cos(a) * d * s, py = cy + y * s + Math.sin(a) * d * 0.86 * s;
    line(c, [[px, py], [px + 2.2, py - 1.6]], hash(i, 3, seed) > 0.5 ? lit : dark, 1.4);
  }
}
function trunk(c: Paint, s: number, h: number, color = '#4a3626') {
  poly(c, [[-9 * s, 0], [-5 * s, -h * 0.6], [-8 * s, -h], [8 * s, -h], [5 * s, -h * 0.6], [10 * s, 0], [3 * s, 3 * s], [-5 * s, 3 * s]], color, INK, 1.4);
  line(c, [[-4 * s, -4], [-3 * s, -h * 0.85]], 'rgba(255,224,180,0.2)', 2.2 * s);
  line(c, [[3 * s, -6], [3 * s, -h * 0.7]], 'rgba(10,6,4,0.3)', 1.6 * s);
}
/** Irregular canopy: one core mass plus golden-angle clusters, different per variant so no two oaks match. */
function canopy(v: number, n: number, spread: number, size: number): Blob[] {
  const out: Blob[] = [[0, 0, size]];
  for (let k = 0; k < n; k++) {
    const a = k * 2.39996 + v * 1.7, d = spread * (0.45 + hash(k, v, 3) * 0.6);
    out.push([Math.cos(a) * d * 1.2, Math.sin(a) * d * 0.72 - 8, size * (0.38 + hash(k, v, 4) * 0.42)]);
  }
  return out;
}
const oak = (s: number, v: number): Art => {
  const th = 60 * s, cy = -th - 44 * s;
  return { box: { x0: -86 * s, y0: cy - 74 * s, x1: 86 * s, y1: 8 }, draw: (c) => {
    trunk(c, s, th);
    line(c, [[0, -th * 0.8], [-26 * s, -th * 1.25]], '#4a3626', 5 * s); line(c, [[2 * s, -th * 0.76], [28 * s, -th * 1.3]], '#4a3626', 5 * s);
    line(c, [[0, -th * 0.9], [-4 * s, -th * 1.4]], '#4a3626', 4 * s);
    crown(c, canopy(v, 12, 46, 40), s, cy, '#24381f', '#3a5a2c', '#6a8a44', 11 + v);
  } };
};
const pine = (s: number, v: number): Art => {
  const tiers = 5;
  return { box: { x0: -54 * s, y0: -200 * s, x1: 54 * s, y1: 8 }, draw: (c) => {
    trunk(c, s * 0.8, 40 * s, '#3e2c20');
    const tier = (k: number, grow: number) => { const w = (46 - k * 8) * s + grow, y = -26 * s - k * 30 * s; return [[-w, y], [-w * 0.5, y - 6 * s], [0, y - 44 * s - grow], [w * 0.5, y - 6 * s], [w, y], [w * 0.3, y + 6 * s], [-w * 0.3, y + 6 * s]] as Point[]; };
    for (let k = 0; k < tiers; k++) poly(c, tier(k, 2.4), INK);
    for (let k = 0; k < tiers; k++) {
      poly(c, tier(k, 0), k % 2 ? '#22382c' : '#1e3226');
      const p = tier(k, 0); poly(c, [p[0], p[1], p[2], [p[2][0], p[0][1] + 2]], '#35543e');
      for (let i = 0; i < 10; i++) { const t = hash(i, k, v) * 0.9, x = p[0][0] * (1 - t) * 0.9, y = p[0][1] - 4 * s - hash(k, i, v) * 30 * s * (1 - t); line(c, [[x, y], [x + 3, y + 2]], '#4f7a5a', 1.2); }
    }
  } };
};
const birch = (s: number, v: number): Art => {
  const th = 90 * s, cy = -th - 30 * s;
  return { box: { x0: -60 * s, y0: cy - 60 * s, x1: 60 * s, y1: 8 }, draw: (c) => {
    poly(c, [[-5 * s, 0], [-4 * s, -th], [4 * s, -th], [6 * s, 0]], '#e8e2d4', INK, 1.3);
    for (let i = 0; i < 8; i++) { const y = -8 - hash(i, 1, v) * th * 0.9; line(c, [[-4 * s, y], [1 * s, y + 1]], '#2a2622', 1.6); }
    crown(c, [[0, 0, 34], [-26, 12, 24], [26, 10, 24], [-12, -24, 24], [14, -26, 22], [0, -40, 18]], s, cy, '#4a6a2c', '#7a9a3c', '#c2d26a', 31 + v);
  } };
};
const willow = (s: number, v: number): Art => {
  const th = 60 * s, cy = -th - 40 * s;
  return { box: { x0: -84 * s, y0: cy - 60 * s, x1: 84 * s, y1: 8 }, draw: (c) => {
    trunk(c, s, th, '#4e3a2a');
    crown(c, [[0, 0, 50], [-38, 10, 32], [38, 10, 32], [0, -30, 36]], s, cy, '#3a5a2c', '#5a7a34', '#9ab04a', 41 + v);
    for (let i = 0; i < 46; i++) {
      const x = (-70 + (140 * i) / 45) * s, y0 = cy + (Math.abs(x) / s < 40 ? 14 : 4) * s, len = (40 + hash(i, 2, v) * 50) * s;
      line(c, [[x, y0], [x + 4 * s, y0 + len * 0.5], [x + 2 * s, y0 + len]], i % 3 ? '#6a8a3a' : '#a8c05a', 1.6);
    }
  } };
};

// ─────────────────────────── props ───────────────────────────

const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0, y0, x1, y1 });
function woodBox(c: Paint, x: number, z: number, w: number, h: number, d: number, color: string, seed: number) {
  rrect(c, x, -z - h - d, w, d, 1.5, tone(color, 1.15), INK, 1.1);
  rrect(c, x, -z - h, w, h, 1.5, color, INK, 1.2);
  for (let k = 1; k < 3; k++) line(c, [[x + 2, -z - (h * k) / 3], [x + w - 2, -z - (h * k) / 3]], 'rgba(20,12,8,0.45)', 1);
  line(c, [[x + 3, -z - 3], [x + w - 3, -z - h + 3]], tone(color, 0.75), 2.4);
  if (hash(Math.round(x), Math.round(z), seed) > 0.5) rrect(c, x + w * 0.3, -z - h * 0.62, w * 0.4, h * 0.24, 1, '#d8c8a0');
}
function barrelAt(c: Paint, x: number, h: number, r: number, water: boolean, seed: number) {
  c.beginPath(); c.moveTo(x - r, 0); c.bezierCurveTo(x - r * 1.18, -h * 0.35, x - r * 1.18, -h * 0.65, x - r, -h); c.lineTo(x + r, -h);
  c.bezierCurveTo(x + r * 1.18, -h * 0.65, x + r * 1.18, -h * 0.35, x + r, 0); c.closePath();
  const g = c.createLinearGradient(x - r, 0, x + r, 0); g.addColorStop(0, '#9a6a3e'); g.addColorStop(0.4, '#7a5230'); g.addColorStop(1, '#4a3020');
  c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.3; c.stroke();
  for (let k = -2; k <= 2; k++) line(c, [[x + k * r * 0.36, -1], [x + k * r * 0.4, -h + 1]], 'rgba(20,12,8,0.35)', 0.9);
  for (const y of [-h * 0.22, -h * 0.78]) line(c, [[x - r * 1.1, y], [x + r * 1.1, y]], '#2e2a28', 2.6);
  ellipse(c, x, -h, r, r * 0.42, water ? '#2e5a68' : '#8a6040', INK, 1.2);
  if (water) ellipse(c, x - r * 0.3, -h - 1, r * 0.4, r * 0.12, 'rgba(200,230,240,0.5)');
  else ellipse(c, x, -h, r * 0.7, r * 0.28, undefined, 'rgba(30,20,12,0.4)', 1);
  void seed;
}
function postAt(c: Paint, x: number, h: number, w = 6, color = '#5a4030') { rrect(c, x - w / 2, -h, w, h, 1.5, color, INK, 1.1); line(c, [[x - w / 2 + 1.5, -h + 2], [x - w / 2 + 1.5, -2]], 'rgba(255,230,190,0.18)', 1.2); }

const PROPS: Record<string, (h: number, v: number) => Art> = {
  lamp: (h) => ({ box: box(-16, -h - 18, 16, 6), draw: (c) => {
    ellipse(c, 0, 1, 10, 3.6, 'rgba(10,8,12,0.35)');
    rrect(c, -6, -10, 12, 10, 2, '#2a2826', INK, 1.2); rrect(c, -2.4, -h + 14, 4.8, h - 22, 1.5, '#2e2c2a');
    line(c, [[-1, -h + 16], [-1, -12]], 'rgba(255,230,200,0.2)', 1);
    line(c, [[-8, -h + 22], [8, -h + 22]], '#2a2826', 2.2); line(c, [[-8, -h + 22], [-4, -h + 26]], '#2a2826', 1.4); line(c, [[8, -h + 22], [4, -h + 26]], '#2a2826', 1.4);
    poly(c, [[-9, -h + 2], [0, -h - 10], [9, -h + 2]], '#252322', INK, 1);
    rrect(c, -7, -h + 2, 14, 14, 2, '#ffe0a0', '#1e1c1c', 2); line(c, [[0, -h + 2], [0, -h + 16]], 'rgba(40,30,20,0.55)', 1.2);
    rrect(c, -8, -h + 15, 16, 3, 1, '#252322'); ellipse(c, 0, -h - 11, 2, 2, '#252322');
  } }),
  brazier: (h) => ({ box: box(-22, -h - 14, 22, 6), draw: (c) => {
    ellipse(c, 0, 1, 14, 4, 'rgba(10,8,12,0.35)');
    for (const s of [-1, 0, 1]) line(c, [[s * 14, 0], [s * 4, -h + 8]], '#2a2622', 3);
    c.beginPath(); c.moveTo(-18, -h + 2); c.quadraticCurveTo(0, -h + 18, 18, -h + 2); c.closePath(); c.fillStyle = '#3a3430'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.3; c.stroke();
    ellipse(c, 0, -h + 2, 18, 5, '#ff9a4a', INK, 1.2); ellipse(c, 0, -h + 2, 12, 3, '#ffe08a');
  } }),
  'stone-lantern': (h) => ({ box: box(-20, -h - 12, 20, 6), draw: (c) => {
    ellipse(c, 0, 1, 14, 4, 'rgba(10,8,12,0.35)');
    rrect(c, -14, -8, 28, 8, 2, '#8a857a', INK, 1.2); rrect(c, -6, -h + 22, 12, h - 30, 2, '#9a958a', INK, 1.2);
    rrect(c, -11, -h + 6, 22, 18, 2, '#9a958a', INK, 1.2); rrect(c, -6, -h + 10, 12, 10, 1, '#ffd890');
    poly(c, [[-17, -h + 6], [0, -h - 6], [17, -h + 6]], '#7a756a', INK, 1.2); ellipse(c, 0, -h - 7, 3, 3, '#7a756a', INK, 1);
  } }),
  well: () => ({ box: box(-40, -96, 40, 10), draw: (c) => {
    ellipse(c, 4, 4, 36, 12, 'rgba(10,8,12,0.35)');
    for (const s of [-1, 1]) postAt(c, s * 26, 80, 7);
    c.beginPath(); c.ellipse(0, -26, 30, 14, 0, 0, Math.PI); c.lineTo(30, 0); c.ellipse(0, 0, 30, 14, 0, 0, Math.PI, false); c.lineTo(-30, -26); c.closePath();
    c.fillStyle = '#7e786c'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.3; c.stroke();
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI; line(c, [[Math.cos(a) * 30, -26 + Math.sin(a) * 14], [Math.cos(a) * 30, Math.sin(a) * 14]], 'rgba(30,26,24,0.45)', 1); }
    line(c, [[-30, -13], [30, -13]], 'rgba(30,26,24,0.35)', 1);
    ellipse(c, 0, -26, 30, 14, '#8e887c', INK, 1.3); ellipse(c, 0, -26, 23, 9, '#1c2a30'); ellipse(c, -6, -28, 8, 2.4, 'rgba(160,200,210,0.35)');
    poly(c, [[-38, -78], [0, -100], [38, -78], [34, -72], [0, -92], [-34, -72]], '#6a4a30', INK, 1.3);
    line(c, [[-26, -66], [26, -66]], '#4a3424', 3); line(c, [[2, -66], [2, -40]], '#c8b890', 1); rrect(c, -3, -42, 10, 9, 1.5, '#6a4a2e', INK, 1);
  } }),
  noticeboard: (h) => ({ box: box(-40, -h - 18, 40, 6), draw: (c) => {
    ellipse(c, 2, 1, 30, 5, 'rgba(10,8,12,0.35)');
    for (const s of [-1, 1]) postAt(c, s * 28, h, 6);
    rrect(c, -32, -h + 16, 64, 46, 2, '#6a4a30', INK, 1.4); rrect(c, -29, -h + 19, 58, 40, 1, '#8a6a46');
    for (const [x, y, w, hh, r] of [[-25, -h + 22, 16, 20, -0.06], [-6, -h + 24, 14, 16, 0.05], [10, -h + 21, 16, 22, -0.03], [-18, -h + 44, 18, 12, 0.04]] as const) {
      c.save(); c.translate(x + w / 2, y + hh / 2); c.rotate(r); rrect(c, -w / 2, -hh / 2, w, hh, 1, '#efe4c8', 'rgba(40,30,20,0.6)', 0.8);
      for (let k = 0; k < 3; k++) line(c, [[-w / 2 + 3, -hh / 2 + 5 + k * 4], [w / 2 - 3, -hh / 2 + 5 + k * 4]], 'rgba(60,50,40,0.5)', 0.8); c.restore();
      ellipse(c, x + w / 2, y + 1, 1.4, 1.4, '#b83a2a');
    }
    poly(c, [[-38, -h + 16], [0, -h - 4], [38, -h + 16], [34, -h + 18], [0, -h + 2], [-34, -h + 18]], '#4a3a2c', INK, 1.2);
  } }),
  anvil: () => ({ box: box(-28, -50, 28, 8), draw: (c) => {
    ellipse(c, 2, 2, 22, 6, 'rgba(10,8,12,0.35)');
    rrect(c, -14, -22, 28, 22, 3, '#5a4030', INK, 1.3); ellipse(c, 0, -22, 14, 5, '#8a6a46', INK, 1.1);
    poly(c, [[-10, -24], [10, -24], [8, -30], [18, -32], [26, -38], [-14, -38], [-20, -34], [-10, -30]], '#3c4044', INK, 1.4);
    line(c, [[-14, -37], [24, -37]], 'rgba(220,230,240,0.5)', 1.4);
    line(c, [[6, -40], [18, -48]], '#6a4a2e', 2.4); rrect(c, 14, -52, 10, 6, 1, '#6a6e72', INK, 1);
  } }),
  barrel: (h, v) => ({ box: box(-18, -h - 10, 18, 6), draw: (c) => { ellipse(c, 2, 1, 15, 4, 'rgba(10,8,12,0.35)'); barrelAt(c, 0, h, 13, v === 1, v); } }),
  barrels: (h, v) => ({ box: box(-40, -h - 14, 40, 8), draw: (c) => {
    ellipse(c, 0, 2, 36, 7, 'rgba(10,8,12,0.35)'); barrelAt(c, -14, h, 12, false, v); barrelAt(c, 13, h - 2, 12, false, v + 1);
    c.save(); c.translate(0, 6); barrelAt(c, 0, h - 6, 11, false, v + 2); c.restore();
  } }),
  crates: (h, v) => ({ box: box(-34, -h - 30, 34, 8), draw: (c) => {
    ellipse(c, 0, 2, 30, 6, 'rgba(10,8,12,0.35)'); woodBox(c, -28, 0, 30, 24, 10, '#8a6a42', v); woodBox(c, 2, 0, 26, 22, 9, '#7a5c3a', v + 1); woodBox(c, -18, 24, 26, 20, 9, '#94744a', v + 2);
  } }),
  fishcrates: (_h, v) => ({ box: box(-34, -44, 34, 8), draw: (c) => {
    ellipse(c, 0, 2, 30, 6, 'rgba(10,8,12,0.35)'); woodBox(c, -30, 0, 28, 16, 8, '#7a5c3a', v); woodBox(c, 2, 0, 28, 16, 8, '#8a6a42', v + 1);
    for (let k = 0; k < 8; k++) ellipse(c, -26 + k * 7, -26 + (k % 2) * 2, 5, 2, ['#a8bcc4', '#c8a07a', '#9ab0b8'][k % 3], INK, 0.6);
  } }),
  rack: (h) => ({ box: box(-34, -h - 10, 34, 6), draw: (c) => {
    ellipse(c, 0, 1, 30, 5, 'rgba(10,8,12,0.35)');
    for (const s of [-1, 1]) postAt(c, s * 26, h, 6);
    line(c, [[-28, -h + 10], [28, -h + 10]], '#5a4030', 4); line(c, [[-28, -18], [28, -18]], '#5a4030', 4);
    for (let k = 0; k < 4; k++) { const x = -18 + k * 12; line(c, [[x, -10], [x + 2, -h + 4]], '#b8c0c8', 2.4); line(c, [[x - 4, -h + 18], [x + 6, -h + 18]], '#6a4a2e', 2.4); }
    line(c, [[30, -4], [24, -h + 2]], '#6a4a2e', 2.4); poly(c, [[22, -h + 2], [32, -h + 8], [28, -h + 18]], '#9aa4ac', INK, 1);
    ellipse(c, -30, -22, 12, 16, '#8a3a2a', INK, 1.3); ellipse(c, -30, -22, 4, 5, '#c9a65a');
  } }),
  counter: () => ({ box: box(-34, -60, 34, 6), draw: (c) => {
    ellipse(c, 0, 1, 30, 5, 'rgba(10,8,12,0.35)');
    rrect(c, -28, -34, 56, 10, 2, '#5a2a4a', INK, 1.2); rrect(c, -26, -26, 52, 26, 2, '#4a2a3a', INK, 1.2);
    poly(c, [[-26, -24], [26, -24], [22, -6], [-22, -6]], '#6a3a5a'); for (let k = 0; k < 5; k++) line(c, [[-20 + k * 10, -22], [-18 + k * 9, -8]], 'rgba(255,220,240,0.12)', 1);
    rrect(c, -22, -40, 18, 6, 1, '#d8b54a', INK, 0.8); rrect(c, 4, -40, 18, 6, 1, '#d8b54a', INK, 0.8);
    for (let k = 0; k < 6; k++) ellipse(c, -19 + k * 7.6, -42, 2.6, 2.2, ['#6fe0d0', '#e04a6a', '#7a9aff', '#f2c94c', '#9be07a', '#e8e8f0'][k], INK, 0.6);
    line(c, [[0, -52], [0, -40]], '#c9a65a', 1.4); line(c, [[-8, -50], [8, -50]], '#c9a65a', 1.4);
  } }),
  'crystal-table': () => ({ box: box(-30, -64, 30, 6), draw: (c) => {
    ellipse(c, 0, 1, 26, 5, 'rgba(10,8,12,0.35)');
    ellipse(c, 0, -30, 24, 8, '#2a1e3a', INK, 1.2); poly(c, [[-24, -30], [24, -30], [20, -4], [-20, -4]], '#2e2242', INK, 1.2);
    for (let k = 0; k < 4; k++) line(c, [[-18 + k * 12, -28], [-16 + k * 11, -6]], 'rgba(200,170,255,0.18)', 1.2);
    c.save(); c.globalCompositeOperation = 'lighter'; ellipse(c, 0, -44, 18, 14, 'rgba(180,130,255,0.35)'); c.restore();
    ellipse(c, 0, -42, 10, 10, '#b89cff', INK, 1.2); ellipse(c, -3, -45, 3.4, 2.6, 'rgba(255,255,255,0.7)');
    for (const x of [-16, 15]) { rrect(c, x - 2, -40, 4, 9, 1, '#efe6d2'); ellipse(c, x, -42, 1.8, 3, '#ffd070'); }
    rrect(c, 6, -33, 8, 5, 1, '#e8dcc0', INK, 0.6);
  } }),
  cart: () => ({ box: box(-50, -70, 50, 12), draw: (c) => {
    ellipse(c, 0, 4, 44, 8, 'rgba(10,8,12,0.35)');
    line(c, [[-44, -26], [-30, -20]], '#5a4030', 3.5); line(c, [[-44, -22], [-30, -16]], '#5a4030', 3.5);
    rrect(c, -30, -34, 64, 18, 2, '#7a5a3a', INK, 1.3); for (let x = -26; x < 32; x += 10) line(c, [[x, -33], [x, -17]], 'rgba(20,12,8,0.4)', 1);
    ellipse(c, -14, -44, 14, 10, '#c8b48a', INK, 1.1); ellipse(c, 6, -46, 12, 10, '#b8a47a', INK, 1.1); woodBox(c, 14, 34, 18, 14, 6, '#8a6a42', 3);
    ellipse(c, 10, -12, 13, 13, '#4a3424', INK, 1.4); ellipse(c, 10, -12, 9, 9, undefined, '#7a5a3a', 2);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; line(c, [[10, -12], [10 + Math.cos(a) * 10, -12 + Math.sin(a) * 10]], '#7a5a3a', 1.6); }
    ellipse(c, 10, -12, 2.4, 2.4, '#2a2420');
  } }),
  crane: (h) => ({ box: box(-40, -h - 20, 120, 10), draw: (c) => {
    ellipse(c, 10, 3, 40, 9, 'rgba(10,8,12,0.35)');
    rrect(c, -26, -14, 52, 14, 2, '#6a5a48', INK, 1.3);
    rrect(c, -8, -h, 16, h - 12, 2, '#6a4a30', INK, 1.4); line(c, [[-5, -h + 4], [-5, -16]], 'rgba(255,230,190,0.18)', 2);
    line(c, [[-22, -14], [-6, -h * 0.5]], '#5a3e28', 5); line(c, [[22, -14], [6, -h * 0.5]], '#5a3e28', 5);
    line(c, [[0, -h + 10], [110, -h + 36]], '#6a4a30', 9); line(c, [[0, -h + 10], [110, -h + 36]], 'rgba(255,230,190,0.15)', 2);
    line(c, [[8, -h * 0.62], [70, -h + 28]], '#5a3e28', 4); line(c, [[0, -h - 6], [110, -h + 36]], '#2a2420', 1.4);
    line(c, [[104, -h + 36], [104, -96]], '#c8b890', 1.4); line(c, [[100, -96], [92, -70]], '#c8b890', 1); line(c, [[108, -96], [116, -70]], '#c8b890', 1);
    c.beginPath(); c.moveTo(88, -70); c.quadraticCurveTo(104, -56, 120, -70); c.closePath(); c.fillStyle = 'rgba(200,184,140,0.4)'; c.fill();
    woodBox(c, 94, 60, 20, 14, 6, '#8a6a42', 5);
    ellipse(c, 0, -h * 0.4, 9, 9, '#4a3424', INK, 1.2);
  } }),
  bollard: () => ({ box: box(-14, -34, 14, 6), draw: (c) => {
    ellipse(c, 1, 1, 10, 3.4, 'rgba(10,8,12,0.35)'); rrect(c, -7, -24, 14, 24, 5, '#3a3c3e', INK, 1.3); ellipse(c, 0, -24, 8, 4, '#4a4c4e', INK, 1.2);
    line(c, [[-4, -22], [-4, -4]], 'rgba(220,230,240,0.25)', 1.6); ellipse(c, 0, -10, 9, 3.4, undefined, '#b8a47a', 2.4);
  } }),
  netrack: (h) => ({ box: box(-36, -h - 8, 36, 6), draw: (c) => {
    ellipse(c, 0, 1, 30, 5, 'rgba(10,8,12,0.35)'); for (const s of [-1, 1]) postAt(c, s * 28, h, 5);
    line(c, [[-30, -h + 6], [30, -h + 6]], '#5a4030', 3.4);
    c.beginPath(); c.moveTo(-28, -h + 8); c.quadraticCurveTo(-10, -12, 0, -h + 8); c.quadraticCurveTo(12, -18, 28, -h + 8); c.lineTo(28, -h + 30); c.quadraticCurveTo(0, -4, -28, -h + 34); c.closePath();
    c.fillStyle = 'rgba(120,110,80,0.45)'; c.fill();
    for (let k = 0; k < 9; k++) line(c, [[-26 + k * 6.5, -h + 8], [-24 + k * 6, -14]], 'rgba(60,50,30,0.55)', 0.8);
    for (let k = 0; k < 6; k++) line(c, [[-28, -h + 14 + k * 8], [28, -h + 12 + k * 8]], 'rgba(60,50,30,0.45)', 0.8);
    for (let k = 0; k < 5; k++) ellipse(c, -22 + k * 11, -h + 10, 2.6, 2.4, '#c8783a', INK, 0.6);
  } }),
  column: (h, v) => ({ box: box(-24, -h - 10, 24, 6), draw: (c) => {
    ellipse(c, 3, 1, 20, 5, 'rgba(10,8,12,0.35)'); rrect(c, -18, -12, 36, 12, 2, '#a8a294', INK, 1.3);
    const top = v === 1 ? -h + 10 : -h + 14;
    const g = c.createLinearGradient(-12, 0, 12, 0); g.addColorStop(0, '#d0c8b6'); g.addColorStop(0.45, '#b6ae9c'); g.addColorStop(1, '#7c7466');
    c.fillStyle = g;
    if (v === 1) { c.beginPath(); c.moveTo(-12, -12); c.lineTo(-12, top + 6); c.lineTo(-6, top); c.lineTo(0, top + 9); c.lineTo(6, top + 2); c.lineTo(12, top + 10); c.lineTo(12, -12); c.closePath(); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke(); }
    else { c.fillRect(-12, top, 24, -12 - top); c.strokeStyle = INK; c.lineWidth = 1.2; c.strokeRect(-12, top, 24, -12 - top); rrect(c, -18, -h + 2, 36, 12, 2, '#bab4a4', INK, 1.3); }
    for (const k of [-6, 0, 6]) line(c, [[k, top + 10], [k, -14]], 'rgba(40,34,30,0.3)', 1.2);
    for (let k = 0; k < 9; k++) ellipse(c, -10 + hash(k, 1, v) * 8, -20 - k * 9, 4, 3, k % 2 ? '#3f6a34' : '#4f7a3c');
  } }),
  ruin: (h, v) => ({ box: box(-36, -h - 12, 36, 6), draw: (c) => {
    ellipse(c, 2, 2, 32, 6, 'rgba(10,8,12,0.35)');
    poly(c, [[-30, 0], [-30, -h + 8], [-18, -h], [-6, -h + 10], [6, -h + 4], [14, -h + 18], [30, -h + 22], [30, 0]], '#8a8478', INK, 1.3);
    for (let r = 0; r < 3; r++) line(c, [[-30, -12 - r * 12], [30, -12 - r * 12]], 'rgba(30,26,24,0.45)', 1);
    for (let k = 0; k < 6; k++) line(c, [[-24 + k * 10 + (k % 2) * 4, -2], [-24 + k * 10 + (k % 2) * 4, -h + 14]], 'rgba(30,26,24,0.3)', 1);
    for (let k = 0; k < 6; k++) ellipse(c, -26 + hash(k, 2, v) * 50, -h + 8 + hash(k, 3, v) * 8, 6, 3, '#4f7a3c');
  } }),
  rock: (h, v) => ({ box: box(-34, -h - 10, 34, 6), draw: (c) => {
    ellipse(c, 3, 1, 30, 6, 'rgba(10,8,12,0.35)');
    poly(c, [[-28, 0], [-30, -h * 0.5], [-14, -h], [10, -h - 4], [26, -h * 0.6], [30, 0]], '#7a766c', INK, 1.4);
    poly(c, [[-26, -h * 0.5], [-14, -h + 2], [6, -h - 2], [-4, -h * 0.4]], '#9a968a'); ellipse(c, 2, -h, 12, 4, '#5a7a3c');
    void v;
  } }),
  bar: () => ({ box: box(-40, -64, 40, 6), draw: (c) => {
    rrect(c, -36, -44, 72, 10, 2, '#6a4628', INK, 1.3); rrect(c, -34, -36, 68, 36, 2, '#4e3420', INK, 1.3);
    for (let x = -30; x < 34; x += 12) rrect(c, x, -32, 9, 28, 1.5, '#5a3e28', 'rgba(20,12,8,0.5)', 1);
    for (let k = 0; k < 3; k++) { rrect(c, -22 + k * 18, -54, 7, 10, 2, '#e8dcc0', INK, 0.8); ellipse(c, -18.5 + k * 18, -54, 3.5, 1.4, '#f2e4a0'); }
    rrect(c, 16, -60, 6, 16, 1, '#b8a060', INK, 0.8);
  } }),
  table: () => ({ box: box(-40, -54, 40, 8), draw: (c) => {
    ellipse(c, 2, 2, 34, 7, 'rgba(10,8,12,0.35)');
    for (const s of [-1, 1]) { rrect(c, s * 30 - 7, -20, 14, 6, 2, '#6a4628', INK, 1); line(c, [[s * 30, -14], [s * 30, 0]], '#4e3420', 3); }
    ellipse(c, 0, -32, 26, 9, '#7a5232', INK, 1.3); line(c, [[0, -24], [0, 0]], '#4e3420', 5); ellipse(c, 0, 0, 10, 3, '#4e3420');
    rrect(c, -12, -40, 6, 8, 2, '#e8dcc0', INK, 0.7); rrect(c, 6, -40, 6, 8, 2, '#e8dcc0', INK, 0.7); rrect(c, -2, -44, 4, 9, 1, '#efe6d2'); ellipse(c, 0, -46, 1.8, 3, '#ffd070');
  } }),
  cask: () => ({ box: box(-30, -60, 30, 6), draw: (c) => {
    ellipse(c, 0, 1, 26, 5, 'rgba(10,8,12,0.35)'); poly(c, [[-26, 0], [-20, -16], [20, -16], [26, 0]], '#4e3420', INK, 1.2);
    ellipse(c, 0, -32, 22, 22, '#8a5e36', INK, 1.4); ellipse(c, 0, -32, 17, 17, '#9a6a3e');
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; line(c, [[0, -32], [Math.cos(a) * 17, -32 + Math.sin(a) * 17]], 'rgba(30,18,10,0.4)', 1); }
    ellipse(c, 0, -32, 22, 22, undefined, '#2e2a28', 2.4); rrect(c, -3, -22, 6, 8, 1, '#c9a65a', INK, 0.8);
  } }),
  hearth: () => ({ box: box(-44, -92, 44, 8), draw: (c) => {
    rrect(c, -40, -70, 80, 70, 3, '#7a7268', INK, 1.4);
    for (let r = 0; r < 4; r++) for (let x = -40 + (r % 2) * 10; x < 40; x += 20) rrect(c, x + 1, -70 + r * 17 + 1, 18, 15, 2, tone('#8a8278', 0.85 + hash(x, r, 4) * 0.3));
    c.beginPath(); c.moveTo(-24, 0); c.lineTo(-24, -32); c.quadraticCurveTo(0, -54, 24, -32); c.lineTo(24, 0); c.closePath();
    const g = c.createLinearGradient(0, -44, 0, 0); g.addColorStop(0, '#1a0e0a'); g.addColorStop(1, '#5a2a14'); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.3; c.stroke();
    for (let k = 0; k < 3; k++) line(c, [[-14 + k * 6, -4], [6 + k * 4, -10]], '#3a2418', 4);
    rrect(c, -46, -76, 92, 8, 2, '#5a3e28', INK, 1.3);
  } }),
  oak: (h, v) => oak((h / 230) * 1, v),
  birch: (h, v) => birch(h / 220, v),
  willow: (h, v) => willow(h / 220, v),
};

const DECOR: Record<string, (s: number, v: number) => Art> = {
  oak: (s, v) => oak(s, v), pine: (s, v) => pine(s, v),
  rowboat: (_s, v) => ({ box: box(-50, -34, 50, 20), draw: (c) => {
    const hull = ['#7a4a2e', '#3e5a6a', '#8a3a2a'][v % 3];
    ellipse(c, 0, 8, 46, 9, 'rgba(10,20,26,0.4)');
    c.beginPath(); c.moveTo(-44, -14); c.quadraticCurveTo(-30, 4, 0, 6); c.quadraticCurveTo(30, 4, 46, -16); c.lineTo(38, -18); c.quadraticCurveTo(0, -8, -36, -16); c.closePath();
    c.fillStyle = hull; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
    c.beginPath(); c.moveTo(-36, -16); c.quadraticCurveTo(0, -24, 38, -18); c.quadraticCurveTo(0, -8, -36, -16); c.fillStyle = '#5a3e28'; c.fill(); c.stroke();
    line(c, [[-40, -10], [40, -12]], tone(hull, 1.3), 1.6); line(c, [[-10, -20], [-10, -12]], '#3a2a1e', 3); line(c, [[12, -21], [12, -12]], '#3a2a1e', 3);
    line(c, [[-20, -14], [-44, 2]], '#b8a47a', 2); line(c, [[18, -15], [40, 4]], '#b8a47a', 2);
    line(c, [[-40, 6], [40, 5]], 'rgba(220,240,240,0.5)', 1.4);
  } }),
  fishingboat: () => ({ box: box(-80, -150, 80, 26), draw: (c) => {
    ellipse(c, 0, 12, 76, 13, 'rgba(10,20,26,0.4)');
    c.beginPath(); c.moveTo(-74, -22); c.quadraticCurveTo(-50, 8, 0, 10); c.quadraticCurveTo(50, 8, 78, -26); c.lineTo(66, -28); c.quadraticCurveTo(0, -16, -62, -24); c.closePath();
    c.fillStyle = '#6a4a30'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
    line(c, [[-66, -12], [70, -16]], '#e8dcc0', 3); line(c, [[-62, -4], [64, -8]], 'rgba(20,12,8,0.4)', 1);
    rrect(c, 14, -52, 34, 28, 2, '#8a6a46', INK, 1.3); rrect(c, 20, -46, 9, 8, 1, '#ffd890'); poly(c, [[10, -52], [31, -64], [52, -52]], '#3e5a6a', INK, 1.2);
    line(c, [[-14, -26], [-14, -146]], '#4a3424', 4); line(c, [[-14, -120], [-56, -36]], '#c8b890', 1); line(c, [[-14, -146], [60, -30]], '#c8b890', 1);
    poly(c, [[-12, -134], [-12, -46], [-48, -48]], '#e8dcc0', INK, 1.2); line(c, [[-12, -100], [-34, -48]], 'rgba(120,100,70,0.45)', 1.2);
    line(c, [[-70, 8], [72, 6]], 'rgba(220,240,240,0.5)', 1.6);
  } }),
  buoy: () => ({ box: box(-14, -40, 14, 12), draw: (c) => {
    ellipse(c, 0, 4, 12, 4, 'rgba(10,20,26,0.4)'); poly(c, [[-9, 2], [-6, -22], [6, -22], [9, 2]], '#c83a2a', INK, 1.2); poly(c, [[-7.6, -8], [-6.8, -15], [6.8, -15], [7.6, -8]], '#efe6d2');
    line(c, [[0, -22], [0, -34]], '#2a2622', 2); ellipse(c, 0, -35, 3, 3, '#d8b860', INK, 1); line(c, [[-10, 3], [10, 3]], 'rgba(220,240,240,0.55)', 1.2);
  } }),
  bench: () => ({ box: box(-36, -34, 36, 6), draw: (c) => {
    ellipse(c, 0, 1, 30, 4, 'rgba(10,8,12,0.35)'); for (const s of [-1, 1]) { line(c, [[s * 24, 0], [s * 24, -16]], '#3a2a1e', 4); line(c, [[s * 26, -16], [s * 26, -30]], '#3a2a1e', 3); }
    rrect(c, -30, -19, 60, 6, 2, '#8a6a46', INK, 1.2); rrect(c, -30, -31, 60, 5, 2, '#7a5a3a', INK, 1.1); rrect(c, -30, -25, 60, 4, 2, '#7a5a3a', INK, 1);
  } }),
  hay: (_s, v) => ({ box: box(-36, -50, 36, 6), draw: (c) => {
    ellipse(c, 0, 1, 32, 5, 'rgba(10,8,12,0.35)');
    for (const [x, z, w] of [[-30, 0, 32], [2, 0, 30], [-16, 20, 30]] as const) {
      rrect(c, x, -z - 20, w, 20, 4, '#c8a858', INK, 1.2); rrect(c, x, -z - 26, w, 7, 3, '#d8bc6a', INK, 1);
      for (let k = 0; k < 7; k++) line(c, [[x + 3 + k * 4, -z - 3], [x + 4 + k * 4, -z - 18]], 'rgba(120,90,30,0.45)', 1);
      line(c, [[x + w * 0.3, -z - 26], [x + w * 0.3, -z]], '#8a4a2a', 1.2); line(c, [[x + w * 0.7, -z - 26], [x + w * 0.7, -z]], '#8a4a2a', 1.2);
    }
    void v;
  } }),
  logpile: () => ({ box: box(-40, -44, 40, 6), draw: (c) => {
    ellipse(c, 0, 1, 36, 5, 'rgba(10,8,12,0.35)'); rrect(c, -34, -36, 68, 36, 3, '#5a4030', INK, 1.2);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 6 - r; k++) { const x = -28 + k * 11 + r * 5.5, y = -7 - r * 11; ellipse(c, x, y, 6, 6, '#b8946a', INK, 1); ellipse(c, x, y, 3, 3, undefined, '#8a6a46', 1); }
  } }),
  scoreboard: () => ({ box: box(-34, -96, 34, 6), draw: (c) => {
    for (const s of [-1, 1]) postAt(c, s * 24, 90, 5); rrect(c, -30, -88, 60, 40, 2, '#2e3430', '#5a4030', 3);
    for (let k = 0; k < 3; k++) { for (let i = 0; i < 4; i++) line(c, [[-22 + k * 18 + i * 3, -80], [-22 + k * 18 + i * 3, -66]], 'rgba(230,230,220,0.75)', 1.2); line(c, [[-24 + k * 18, -70], [-10 + k * 18, -76]], 'rgba(230,230,220,0.75)', 1.2); }
    line(c, [[-22, -58], [20, -58]], 'rgba(230,230,220,0.5)', 1);
  } }),
  tent: () => ({ box: box(-56, -80, 56, 8), draw: (c) => {
    ellipse(c, 2, 2, 52, 8, 'rgba(10,8,12,0.35)');
    poly(c, [[-52, 0], [0, -74], [52, 0]], '#c8b48a', INK, 1.4); poly(c, [[0, -74], [52, 0], [20, 0]], '#a8946a');
    poly(c, [[-12, 0], [0, -40], [12, 0]], '#3a2a20'); line(c, [[0, -74], [0, -84]], '#4a3424', 3);
    for (const k of [-34, 34]) line(c, [[k, -2], [k * 1.4, 6]], '#c8b890', 1);
    line(c, [[-52, 0], [52, 0]], '#6a5a40', 2);
  } }),
  banner: () => ({ box: box(-8, -150, 46, 6), draw: (c) => {
    postAt(c, 0, 144, 5, '#4a3424'); ellipse(c, 0, -146, 3.4, 3.4, '#c9a65a', INK, 1);
    line(c, [[0, -136], [38, -136]], '#3a2a1e', 3);
    poly(c, [[3, -134], [36, -134], [36, -76], [19.5, -66], [3, -76]], '#24456a', INK, 1.3); line(c, [[3, -126], [36, -126]], '#c9a65a', 2);
    c.beginPath(); c.moveTo(19.5, -88); c.bezierCurveTo(11, -94, 16, -104, 19.5, -114); c.bezierCurveTo(23, -104, 28, -94, 19.5, -88); c.fillStyle = '#f2b860'; c.fill();
  } }),
  signpost: () => ({ box: box(-40, -96, 40, 6), draw: (c) => {
    postAt(c, 0, 90, 6, '#5a4030');
    for (const [y, s, w] of [[-80, 1, 34], [-64, -1, 30], [-48, 1, 26]] as const) {
      poly(c, [[0, y], [s * w, y], [s * (w + 8), y + 6], [s * w, y + 12], [0, y + 12]], '#8a6a46', INK, 1.1);
      line(c, [[s * 5, y + 6], [s * (w - 4), y + 6]], 'rgba(40,24,14,0.6)', 1.2);
    }
  } }),
  cat: (_s, v) => ({ box: box(-14, -24, 18, 4), draw: (c) => {
    const fur = v % 2 ? '#c8783a' : '#5a5a60'; ellipse(c, 0, 1, 10, 2.6, 'rgba(10,8,12,0.35)');
    ellipse(c, 0, -7, 8, 7, fur, INK, 1.1); ellipse(c, 2, -17, 5.6, 5, fur, INK, 1.1);
    poly(c, [[-2, -20], [-1, -26], [2, -21]], fur, INK, 0.8); poly(c, [[4, -21], [7, -26], [7.6, -19]], fur, INK, 0.8);
    c.beginPath(); c.moveTo(-7, -3); c.quadraticCurveTo(-16, -4, -12, -14); c.strokeStyle = fur; c.lineWidth = 2.6; c.stroke();
    ellipse(c, 1, -17, 0.9, 1.2, '#1a1a1a'); ellipse(c, 4.4, -17, 0.9, 1.2, '#1a1a1a');
  } }),
  dog: () => ({ box: box(-24, -22, 24, 4), draw: (c) => {
    ellipse(c, 0, 1, 20, 3, 'rgba(10,8,12,0.35)'); ellipse(c, -2, -7, 16, 7, '#8a6a46', INK, 1.1);
    ellipse(c, 13, -12, 6.6, 6, '#8a6a46', INK, 1.1); ellipse(c, 18, -10, 3.4, 2.6, '#6a4a30'); ellipse(c, 11, -16, 2.4, 4, '#5a3e28');
    c.beginPath(); c.moveTo(-17, -8); c.quadraticCurveTo(-24, -14, -22, -4); c.strokeStyle = '#8a6a46'; c.lineWidth = 2.6; c.stroke();
    ellipse(c, 15, -13, 0.9, 0.9, '#1a1a1a');
  } }),
  pole: () => ({ box: box(-8, -164, 8, 6), draw: (c) => { ellipse(c, 0, 1, 6, 2.4, 'rgba(10,8,12,0.35)'); postAt(c, 0, 158, 5, '#5a4030'); ellipse(c, 0, -158, 3, 2, '#3a2a1e'); } }),
  waterwheel: () => ({ box: box(-70, -150, 70, 24), draw: (c) => {
    rrect(c, -64, -20, 10, 30, 2, '#5a4030', INK, 1.2); rrect(c, 54, -20, 10, 30, 2, '#5a4030', INK, 1.2);
    line(c, [[-58, -16], [0, -66]], '#4a3424', 6); line(c, [[58, -16], [0, -66]], '#4a3424', 6);
    rrect(c, -20, -146, 40, 10, 2, '#6a4a30', INK, 1.2); poly(c, [[-14, -136], [14, -136], [10, -118], [-10, -118]], '#6a4a30', INK, 1.1);
    c.save(); c.globalAlpha = 0.6; poly(c, [[-8, -118], [8, -118], [12, -100], [-12, -100]], '#9ad0d8'); c.restore();
  } }),
  islet: () => ({ box: box(0, 0, 0, 0), draw: () => {} }),
};
/** One ≤40 u piece of a fence, rail, hedge, palisade or low wall, from a to b (local origin at a). */
function barrierPiece(kind: string, dx: number, dy: number, last: boolean, seed: number): Art {
  const h = kind === 'hedge' ? 42 : kind === 'palisade' ? 74 : kind === 'wall' || kind === 'parapet' ? 28 : kind === 'rail' ? 30 : 36;
  const b = box(Math.min(0, dx) - 16, Math.min(0, dy) - h - 16, Math.max(0, dx) + 16, Math.max(0, dy) + 10);
  return { box: b, draw: (c) => {
    if (kind === 'hedge') {
      const n = Math.max(2, Math.round(Math.hypot(dx, dy) / 9));
      for (let pass = 0; pass < 3; pass++) for (let i = 0; i <= n; i++) {
        const t = i / n, x = dx * t, y = dy * t, r = 13 + hash(i, pass, seed) * 5, lift = h * (0.45 + hash(i, 7, seed) * 0.25);
        if (pass === 0) ellipse(c, x, y - lift + 2, r + 2, r * 0.9 + 2, INK);
        else if (pass === 1) ellipse(c, x, y - lift, r, r * 0.9, '#2c4a26');
        else { ellipse(c, x - 3, y - lift - 4, r * 0.62, r * 0.5, '#3f6a34'); ellipse(c, x - 5, y - lift - 7, r * 0.3, r * 0.22, '#6a8a44'); }
      }
      return;
    }
    if (kind === 'wall' || kind === 'parapet') {
      poly(c, [[0, 0], [dx, dy], [dx, dy - h], [0, -h]], '#8a8274', INK, 1.2);
      const len = Math.hypot(dx, dy), n = Math.max(1, Math.round(len / 18));
      for (let i = 1; i < n; i++) line(c, [[(dx * i) / n, (dy * i) / n - 2], [(dx * i) / n, (dy * i) / n - h * 0.5]], 'rgba(30,24,22,0.45)', 1);
      line(c, [[0, -h * 0.5], [dx, dy - h * 0.5]], 'rgba(30,24,22,0.4)', 1);
      poly(c, [[-2, -h], [dx + 2, dy - h], [dx + 2, dy - h - 7], [-2, -h - 7]], '#a8a090', INK, 1.1);
      line(c, [[-2, -h - 6], [dx + 2, dy - h - 6]], 'rgba(255,240,215,0.3)', 1.2);
      return;
    }
    const post = (x: number, y: number) => {
      if (kind === 'palisade') { poly(c, [[x - 5, y], [x - 5, y - h + 8], [x, y - h], [x + 5, y - h + 8], [x + 5, y]], '#6a5038', INK, 1.1); return; }
      rrect(c, x - 3, y - h, 6, h, 1.2, kind === 'rail' ? '#4a3a2c' : '#5a4030', INK, 1); rrect(c, x - 4, y - h - 2, 8, 4, 1, '#6a5038', INK, 0.8);
    };
    const zs = kind === 'rail' ? [h - 3] : kind === 'palisade' ? [] : [h * 0.35, h * 0.78];
    for (const z of zs) { line(c, [[0, -z], [dx, dy - z]], '#7a5a3a', 3.4); line(c, [[0, -z - 1.2], [dx, dy - z - 1.2]], 'rgba(255,230,190,0.2)', 1); }
    if (kind === 'palisade') { const n = Math.max(1, Math.round(Math.hypot(dx, dy) / 10)); for (let i = 0; i < n; i++) post((dx * i) / n, (dy * i) / n); }
    post(0, 0); if (last) post(dx, dy);
  } };
}
/** Waterwheel rotor, baked separately so it can turn. */
function wheelArt(): Art {
  return { box: box(-58, -58, 58, 58), draw: (c) => {
    ellipse(c, 0, 0, 54, 54, undefined, '#5a4030', 6); ellipse(c, 0, 0, 40, 40, undefined, '#4a3424', 3);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      line(c, [[ca * 8, sa * 8], [ca * 52, sa * 52]], '#5a4030', 3.4);
      c.save(); c.translate(ca * 52, sa * 52); c.rotate(a); rrect(c, -3, -9, 10, 18, 1.5, '#7a5a3a', INK, 1); c.restore();
    }
    ellipse(c, 0, 0, 9, 9, '#3a2a1e', INK, 1.2); ellipse(c, -2, -2, 3, 3, '#8a7a5a');
  } };
}

// ─────────────────────────── baking (shared textures) ───────────────────────────

const cache = new Map<string, Texture>();
function texture(key: string, art: Art): Texture {
  const hit = cache.get(key);
  if (hit && !hit.destroyed) return hit;
  const { box: b } = art, w = Math.max(2, Math.ceil(b.x1 - b.x0)), h = Math.max(2, Math.ceil(b.y1 - b.y0));
  const canvas = document.createElement('canvas'); canvas.width = Math.ceil(w * DENSITY); canvas.height = Math.ceil(h * DENSITY);
  const c = canvas.getContext('2d')!; c.setTransform(DENSITY, 0, 0, DENSITY, -b.x0 * DENSITY, -b.y0 * DENSITY); art.draw(c);
  const tex = new Texture({ source: new CanvasSource({ resource: canvas, resolution: DENSITY, scaleMode: 'linear', autoGenerateMipmaps: true }) });
  cache.set(key, tex);
  return tex;
}
function place(key: string, art: Art, x: number, y: number, flip = false): Container {
  const root = new Container(), s = new Sprite(texture(key, art));
  s.position.set(art.box.x0, art.box.y0); root.addChild(s); root.position.set(x, y);
  if (flip) root.scale.x = -1;
  return root;
}
const boundsOf = (art: Art, x: number, y: number, flip = false) => ({
  x0: x + (flip ? -art.box.x1 : art.box.x0), x1: x + (flip ? -art.box.x0 : art.box.x1), y0: y + art.box.y0, y1: y + art.box.y1,
});
/** Things hung high (string lights, laundry) are drawn by TownLife in the above layer. */
const OVERHEAD = new Set(['stringlights', 'laundry']);
/** Low decor painted straight into the ground chunks. */
export const FLAT_DECOR = new Set(['islet', 'reeds', 'lilypads', 'pond', 'flowers', 'mushrooms', 'rubble', 'steps', 'nets', 'anchor', 'stump']);

export function townScenery(t: TownData): MapLayers['sorted'] {
  const out: MapLayers['sorted'] = [];
  for (const p of t.props) {
    const decor = DECOR[p.kind ?? ''];
    const make = PROPS[p.kind ?? ''] ?? (decor ? (_h: number, v: number) => decor(p.scale ?? 1, v) : undefined);
    if (!make) continue;
    const h = p.height ?? 40, v = p.variant ?? 0, scale = p.scale ?? 1;
    const art = make(h * (p.kind === 'oak' || p.kind === 'birch' || p.kind === 'willow' ? scale : 1), v);
    const key = `p:${p.kind}:${Math.round(h * scale)}:${v}`;
    const view = place(key, art, p.x, p.y, p.flip);
    if (p.kind === 'lamp') {
      const glow = glowSprite(0xffc878, 70, 0.55, true), seed = hash(Math.round(p.x), Math.round(p.y), 3) * 10;
      glow.position.set(0, -h + 9); view.addChild(glow);
      view.onRender = () => { const tm = performance.now() / 1000; glow.alpha = 0.5 + Math.sin(tm * 6.3 + seed) * 0.04 + Math.sin(tm * 11.7 + seed) * 0.03; };
    }
    out.push({ view, y: p.y, bounds: boundsOf(art, p.x, p.y, p.flip), ...(TALL.has(p.kind ?? '') ? { building: `fade:${p.id}` } : {}) });
  }
  // fences, hedges, rails: cut into short pieces so long runs sort correctly against walkers on either side
  const runs: { kind: string; a: Point; b: Point; seed: number }[] = t.barriers.map((b, i) => ({ kind: b.kind ?? 'fence', a: b.a, b: b.b, seed: i }));
  for (const d of t.decor ?? []) if (d.kind === 'parapet' && d.to) runs.push({ kind: 'parapet', a: [d.x, d.y], b: d.to, seed: 99 });
  for (const r of runs) {
    const len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), n = Math.max(1, Math.ceil(len / 36));
    for (let i = 0; i < n; i++) {
      const ax = r.a[0] + ((r.b[0] - r.a[0]) * i) / n, ay = r.a[1] + ((r.b[1] - r.a[1]) * i) / n;
      const dx = (r.b[0] - r.a[0]) / n, dy = (r.b[1] - r.a[1]) / n;
      const art = barrierPiece(r.kind, dx, dy, i === n - 1, r.seed * 31 + i), view = place(`b:${r.kind}:${r.seed}:${i}`, art, ax, ay);
      out.push({ view, y: Math.max(ay, ay + dy), bounds: boundsOf(art, ax, ay) });
    }
  }
  for (const d of t.decor ?? []) {
    if (d.kind === 'parapet') continue;
    if (OVERHEAD.has(d.kind) || FLAT_DECOR.has(d.kind)) {
      if (OVERHEAD.has(d.kind)) for (const [x, y] of [[d.x, d.y], d.to ?? [d.x, d.y]] as Point[]) {
        const art = DECOR.pole(1, 0), view = place('d:pole', art, x, y);
        out.push({ view, y, bounds: boundsOf(art, x, y) });
      }
      continue;
    }
    const make = DECOR[d.kind];
    if (!make) continue;
    const s = d.scale ?? 1, v = d.variant ?? Math.floor(hash(Math.round(d.x), Math.round(d.y), 5) * 3);
    const art = make(s, v), key = `d:${d.kind}:${s.toFixed(2)}:${v}`;
    const view = place(key, art, d.x, d.y, d.flip);
    const seed = hash(Math.round(d.x), Math.round(d.y), 9) * 10;
    if (d.kind === 'rowboat' || d.kind === 'fishingboat' || d.kind === 'buoy') {
      const amp = d.kind === 'buoy' ? 2 : 1.4;
      view.onRender = () => { const tm = performance.now() / 1000; view.y = d.y + Math.sin(tm * 1.3 + seed) * amp; view.rotation = Math.sin(tm * 0.9 + seed) * 0.02; };
    }
    if (d.kind === 'waterwheel') {
      const rotor = new Sprite(texture('d:wheel', wheelArt())); rotor.anchor.set(0.5); rotor.position.set(0, -66); view.addChild(rotor);
      view.onRender = () => { rotor.rotation = -(performance.now() / 1000) * 0.6; };
    }
    out.push({ view, y: d.y, bounds: boundsOf(art, d.x, d.y, d.flip), ...(TALL.has(d.kind) ? { building: `fade:${d.id}` } : {}) });
  }
  return out;
}
/** Scenery tall enough to hide the hero: it ghosts while the hero stands behind it (scene.ts). */
const TALL = new Set(['oak', 'pine', 'birch', 'willow', 'crane', 'fishingboat']);

// ─────────────────────────── flat decor (world coords, painted into ground chunks) ───────────────────────────

export function paintGroundDecor(c: Paint, t: TownData, x0: number, y0: number, size: number) {
  for (const d of t.decor ?? []) {
    if (!FLAT_DECOR.has(d.kind) || d.x < x0 - 160 || d.x > x0 + size + 160 || d.y < y0 - 160 || d.y > y0 + size + 160) continue;
    const { x, y } = d, s = d.scale ?? 1, seed = Math.round(x * 3 + y);
    switch (d.kind) {
      case 'islet': {
        ellipse(c, x, y + 10, 120 * s, 46 * s, 'rgba(200,230,225,0.25)');
        poly(c, [[x - 110, y + 6], [x - 80, y - 30], [x - 20, y - 46], [x + 50, y - 40], [x + 104, y - 8], [x + 70, y + 24], [x - 60, y + 26]], '#6a665c', INK, 1.5);
        poly(c, [[x - 84, y - 24], [x - 20, y - 40], [x + 46, y - 34], [x + 80, y - 10], [x - 60, y + 4]], '#4f6a3a');
        for (let i = 0; i < 40; i++) line(c, [[x - 70 + hash(i, 1, seed) * 140, y - 30 + hash(i, 2, seed) * 30], [x - 70 + hash(i, 1, seed) * 140 + 1, y - 36 + hash(i, 2, seed) * 30]], '#6a8a44', 1.2);
        c.save(); c.translate(x + 10, y - 20); const tr = pine(0.7, 2); tr.draw(c); c.restore();
        break;
      }
      case 'reeds':
        for (let i = 0; i < 26; i++) {
          const rx = x + (hash(i, 1, seed) - 0.5) * 90 * s, ry = y + (hash(i, 2, seed) - 0.5) * 50 * s, h = 18 + hash(i, 3, seed) * 22;
          line(c, [[rx, ry], [rx + (hash(i, 4, seed) - 0.5) * 6, ry - h]], i % 3 ? '#4a6a34' : '#8a8a4a', 1.6);
          if (i % 5 === 0) rrect(c, rx - 1.6, ry - h - 2, 3.2, 8, 1.6, '#6a4a2e');
        }
        break;
      case 'lilypads':
        for (let i = 0; i < 9; i++) {
          const lx = x + (hash(i, 1, seed) - 0.5) * 120, ly = y + (hash(i, 2, seed) - 0.5) * 50, r = 7 + hash(i, 3, seed) * 6;
          c.beginPath(); c.ellipse(lx, ly, r, r * 0.55, 0, 0.3, Math.PI * 2 - 0.1); c.lineTo(lx, ly); c.closePath(); c.fillStyle = i % 2 ? '#4f7a3c' : '#3f6a34'; c.fill();
          if (i % 4 === 0) ellipse(c, lx + 2, ly - 2, 3, 2.2, '#f2b8c8');
        }
        break;
      case 'pond':
        ellipse(c, x, y, 70 * s, 34 * s, '#6a665c'); ellipse(c, x, y, 62 * s, 29 * s, '#24515c');
        ellipse(c, x - 14, y - 6, 28, 6, 'rgba(170,215,205,0.25)');
        for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; ellipse(c, x + Math.cos(a) * 66 * s, y + Math.sin(a) * 31 * s, 8, 5, tone('#8a857a', 0.8 + hash(i, 1, seed) * 0.4), INK, 0.8); }
        for (let i = 0; i < 4; i++) ellipse(c, x + (hash(i, 5, seed) - 0.5) * 70, y + (hash(i, 6, seed) - 0.5) * 30, 7, 4, '#4f7a3c');
        break;
      case 'flowers':
        for (let i = 0; i < 30; i++) {
          const fx = x + (hash(i, 1, seed) - 0.5) * 70 * s, fy = y + (hash(i, 2, seed) - 0.5) * 30 * s;
          line(c, [[fx, fy], [fx, fy - 6]], '#3f6a34', 1.2); ellipse(c, fx, fy - 7, 2.6, 2.2, ['#e0475a', '#f2c94c', '#f4efe2', '#e98ab4', '#9b7ad8'][i % 5]);
        }
        break;
      case 'mushrooms':
        for (let i = 0; i < 6; i++) { const mx = x + (hash(i, 1, seed) - 0.5) * 40, my = y + (hash(i, 2, seed) - 0.5) * 20; rrect(c, mx - 1.4, my - 6, 2.8, 6, 1, '#efe6d2'); ellipse(c, mx, my - 6, 5, 3, i % 2 ? '#b83a2a' : '#8a6a46', INK, 0.7); }
        break;
      case 'rubble':
        for (let i = 0; i < 9; i++) { const rx = x + (hash(i, 1, seed) - 0.5) * 70, ry = y + (hash(i, 2, seed) - 0.5) * 30, r = 4 + hash(i, 3, seed) * 7; poly(c, [[rx - r, ry], [rx - r * 0.4, ry - r * 0.8], [rx + r, ry - r * 0.5], [rx + r * 0.8, ry + r * 0.3]], tone('#8a8478', 0.8 + hash(i, 4, seed) * 0.4), INK, 0.9); }
        break;
      case 'steps':
        for (let k = 0; k < 3; k++) { rrect(c, x - 70 + k * 6, y - k * 14, 140 - k * 12, 16, 2, tone('#9a9282', 0.95 - k * 0.06), INK, 1.2); line(c, [[x - 66 + k * 6, y - k * 14 + 2], [x + 64 - k * 6, y - k * 14 + 2]], 'rgba(255,240,215,0.25)', 1.4); }
        break;
      case 'nets':
        c.save(); c.globalAlpha = 0.8;
        poly(c, [[x - 60, y - 10], [x - 10, y - 26], [x + 56, y - 14], [x + 40, y + 18], [x - 50, y + 14]], 'rgba(120,110,80,0.5)');
        for (let k = 0; k < 10; k++) line(c, [[x - 56 + k * 11, y - 20 + (k % 2) * 4], [x - 50 + k * 10, y + 14]], 'rgba(60,50,30,0.55)', 0.8);
        for (let k = 0; k < 5; k++) line(c, [[x - 58, y - 8 + k * 6], [x + 52, y - 12 + k * 6]], 'rgba(60,50,30,0.5)', 0.8);
        for (let k = 0; k < 5; k++) ellipse(c, x - 46 + k * 22, y - 14 + (k % 2) * 30, 3, 2.6, '#c8783a', INK, 0.6);
        c.restore();
        break;
      case 'anchor':
        line(c, [[x - 30, y - 6], [x + 26, y + 4]], '#2e3032', 5); ellipse(c, x - 34, y - 7, 6, 4, undefined, '#2e3032', 3);
        c.beginPath(); c.ellipse(x + 22, y + 3, 10, 18, 0.18, -Math.PI / 2, Math.PI / 2); c.strokeStyle = '#2e3032'; c.lineWidth = 5; c.stroke();
        line(c, [[x - 18, y - 14], [x - 14, y + 4]], '#2e3032', 4);
        break;
      case 'stump':
        poly(c, [[x - 16, y], [x - 14, y - 14], [x + 14, y - 14], [x + 17, y]], '#5a4030', INK, 1.2); ellipse(c, x, y - 14, 14, 5, '#b8946a', INK, 1.1);
        ellipse(c, x, y - 14, 8, 3, undefined, '#8a6a46', 1); ellipse(c, x, y - 14, 3, 1.2, undefined, '#8a6a46', 1);
        break;
    }
  }
}

/** Ground shadow footprint for sorted decor (the ground painter blurs these). */
export function decorShadow(kind: string, scale = 1): number {
  return ({ oak: 46, pine: 34, birch: 30, willow: 50, tent: 46, hay: 30, logpile: 32, fishingboat: 0, rowboat: 0, buoy: 0 } as Record<string, number>)[kind] ?? 18 * scale;
}

/** Shared with the zone renderer (docs/rework/worlds/DECISIONS.md D-W05): the same painters, no behaviour change here. */
export { PROPS as TOWN_PROP_ART, DECOR as TOWN_DECOR_ART, pine as townPineArt, oak as townOakArt, birch as townBirchArt, willow as townWillowArt };
export type { Art as TownArt };
