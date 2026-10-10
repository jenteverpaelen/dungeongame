// Illustrated world map (docs/rework/DESIGN.md §6): an original painted chart of the frontier. Placement is a diagram
// composition of the real zone graph (no geographic distance claim); biomes come from each zone's own name/theme/brief.
// Patterns: atlas UI-POE2-01 (terrain + node markers + dotted links), UI-TBH-04 (named route map, padlock, selected
// flag), UI-D3-09 (act nodes + markers), UI-POE1-06 (map beside quest detail).
import { ellipse, fbm, hash, line, poly, rgba, tone, type Paint } from '../render/art/townKit';

export type Biome = 'town' | 'forest' | 'river' | 'marsh' | 'works' | 'terraces' | 'ash' | 'ashhill' | 'fen' | 'salt' | 'cistern' | 'cliffs' | 'ruins' | 'array';
export interface MapNode { x: number; y: number; biome: Biome; act: 0 | 1 | 2 | 3 }

/** Chart space is 1000 × 600. */
export const MAP_W = 1000, MAP_H = 600;
export const WORLD_LAYOUT: Record<string, MapNode> = {
  hearthmere: { x: 170, y: 468, biome: 'town', act: 0 },
  whispering_glade: { x: 78, y: 318, biome: 'forest', act: 0 },
  ashen_hollow: { x: 338, y: 532, biome: 'ash', act: 0 },
  rillwake_crossing: { x: 262, y: 345, biome: 'river', act: 1 },
  bracken_sluice: { x: 372, y: 238, biome: 'marsh', act: 1 },
  reedvault_pumpworks: { x: 222, y: 150, biome: 'works', act: 1 },
  cairnspill_terraces: { x: 500, y: 300, biome: 'terraces', act: 1 },
  cinderwash_kilns: { x: 566, y: 444, biome: 'ash', act: 1 },
  kilnwatch_crown: { x: 690, y: 356, biome: 'ashhill', act: 1 },
  sablefen_causeway: { x: 792, y: 470, biome: 'fen', act: 2 },
  saltwind_pans: { x: 896, y: 352, biome: 'salt', act: 2 },
  lockglass_cistern: { x: 920, y: 506, biome: 'cistern', act: 2 },
  shiverline_escarpment: { x: 846, y: 206, biome: 'cliffs', act: 2 },
  beaconbreak_ward: { x: 690, y: 132, biome: 'ruins', act: 3 },
  hollowstar_array: { x: 536, y: 92, biome: 'array', act: 3 },
};
/** Act banners painted over their region (names from the existing act tabs). */
export const ACT_LABELS: { act: number; text: string; x: number; y: number }[] = [
  { act: 0, text: 'The Hearth', x: 120, y: 568 },
  { act: 1, text: 'I · The Water Road', x: 430, y: 380 },
  { act: 2, text: 'II · The Salt Road', x: 860, y: 280 },
  { act: 3, text: 'III · The Broken Signal', x: 610, y: 36 },
];

const INK = '#2a2118';
const LAND = '#8f8a68';

function stroke(c: Paint, pts: [number, number][], color: string, w: number, smooth = true) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  if (smooth && pts.length > 2) {
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  } else for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
  c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
function blob(c: Paint, x: number, y: number, r: number, color: string, alpha: number, seed: number) {
  c.save(); c.globalAlpha = alpha; c.filter = 'blur(10px)'; c.beginPath();
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, rr = r * (0.78 + fbm(Math.cos(a) * 2 + seed, Math.sin(a) * 2, seed) * 0.44); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.72; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.closePath(); c.fillStyle = color; c.fill(); c.restore();
}
function tree(c: Paint, x: number, y: number, s: number, pine: boolean, k = 1) {
  ellipse(c, x + 2, y + 2, 5 * s, 2 * s, 'rgba(20,16,10,0.25)');
  if (pine) { poly(c, [[x - 5 * s, y], [x, y - 13 * s], [x + 5 * s, y]], tone('#3c5a3a', k), INK, 0.9); return; }
  ellipse(c, x, y - 6 * s, 6 * s, 5.4 * s, tone('#4f6a3c', k), INK, 0.9); ellipse(c, x - 1.6 * s, y - 7.6 * s, 2.6 * s, 2 * s, 'rgba(200,220,150,0.35)');
}
function hill(c: Paint, x: number, y: number, w: number, h: number, col: string) {
  poly(c, [[x - w, y], [x - w * 0.2, y - h], [x + w * 0.1, y - h * 0.86], [x + w, y]], col, INK, 1);
  poly(c, [[x - w * 0.2, y - h], [x + w * 0.1, y - h * 0.86], [x + w, y], [x + w * 0.2, y]], 'rgba(30,20,20,0.22)');
}

function paintBiome(c: Paint, id: string, n: MapNode) {
  const { x, y } = n, seed = Math.round(x * 3 + y);
  const scatter = (count: number, rx: number, ry: number, fn: (px: number, py: number, i: number) => void) => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < count; i++) { const a = hash(i, 1, seed) * Math.PI * 2, d = Math.sqrt(hash(i, 2, seed)); pts.push([x + Math.cos(a) * d * rx, y + Math.sin(a) * d * ry, i]); }
    pts.sort((p, q) => p[1] - q[1]).forEach(([px, py, i]) => fn(px, py, i));
  };
  switch (n.biome) {
    case 'town':
      blob(c, x - 30, y + 46, 120, '#3f6170', 0.95, seed);
      for (let i = 0; i < 9; i++) { const hx = x - 40 + (i % 5) * 18, hy = y - 18 + Math.floor(i / 5) * 14; poly(c, [[hx - 6, hy], [hx - 6, hy - 7], [hx, hy - 12], [hx + 6, hy - 7], [hx + 6, hy]], i % 3 ? '#c9b08a' : '#b8a07a', INK, 0.9); poly(c, [[hx - 7, hy - 7], [hx, hy - 13], [hx + 7, hy - 7]], ['#9e4a32', '#3e5266', '#7a3a3a'][i % 3], INK, 0.8); }
      line(c, [[x + 52, y + 30], [x + 52, y + 4]], INK, 4); ellipse(c, x + 52, y + 2, 4, 4, '#ffd38a', INK, 1);
      c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x + 52, y + 2, 1, x + 52, y + 2, 30); g.addColorStop(0, 'rgba(255,210,140,0.6)'); g.addColorStop(1, 'rgba(255,210,140,0)'); c.fillStyle = g; c.fillRect(x + 22, y - 28, 60, 60); c.restore();
      break;
    case 'forest':
      blob(c, x, y, 110, '#45603a', 0.8, seed);
      scatter(70, 95, 70, (px, py, i) => tree(c, px, py, 1.1 + hash(i, 4, seed) * 0.5, hash(i, 3, seed) > 0.6, 0.9 + hash(i, 5, seed) * 0.25));
      break;
    case 'river':
      blob(c, x, y, 80, '#6f7a54', 0.7, seed);
      scatter(18, 80, 50, (px, py, i) => tree(c, px, py, 1, false, 0.95 + hash(i, 6, seed) * 0.2));
      break;
    case 'marsh': case 'fen':
      blob(c, x, y, n.biome === 'fen' ? 100 : 85, n.biome === 'fen' ? '#4a5a48' : '#5d6c4c', 0.8, seed);
      scatter(14, 80, 52, (px, py, i) => { ellipse(c, px, py, 9 + hash(i, 7, seed) * 10, 4 + hash(i, 8, seed) * 3, '#4d6f78', 'rgba(30,40,40,0.6)', 0.8); });
      scatter(40, 90, 58, (px, py) => { for (let k = 0; k < 3; k++) line(c, [[px + k * 2, py], [px + k * 2 - 1, py - 6 - k]], '#5a6a3a', 1); });
      if (n.biome === 'fen') stroke(c, [[x - 80, y + 20], [x - 30, y + 6], [x + 20, y + 12], [x + 80, y - 4]], '#b8a27a', 4, true);
      break;
    case 'works': case 'cistern':
      blob(c, x, y, 70, n.biome === 'works' ? '#6a6c58' : '#5f7270', 0.75, seed);
      poly(c, [[x - 22, y + 10], [x - 22, y - 14], [x - 8, y - 22], [x + 8, y - 22], [x + 22, y - 14], [x + 22, y + 10]], '#8a8274', INK, 1.2);
      poly(c, [[x - 8, y + 10], [x - 8, y - 4], [x, y - 10], [x + 8, y - 4], [x + 8, y + 10]], '#1e1a18');
      if (n.biome === 'works') { line(c, [[x + 16, y - 20], [x + 16, y - 40]], INK, 5); line(c, [[x + 16, y - 20], [x + 16, y - 40]], '#8a8274', 3); }
      else for (let k = 0; k < 3; k++) ellipse(c, x - 30 + k * 30, y + 26, 10, 3, '#5f8a92', INK, 0.8);
      break;
    case 'terraces':
      blob(c, x, y, 95, '#7d8058', 0.8, seed);
      for (let k = 0; k < 6; k++) { c.beginPath(); c.ellipse(x, y + 8, 82 - k * 13, 46 - k * 7.5, 0, Math.PI * 1.05, Math.PI * 1.95); c.strokeStyle = 'rgba(60,50,30,0.7)'; c.lineWidth = 1.4; c.stroke(); }
      scatter(10, 70, 40, (px, py) => tree(c, px, py, 0.9, false));
      break;
    case 'ash': case 'ashhill':
      blob(c, x, y, 95, '#6e6258', 0.85, seed);
      blob(c, x + 10, y + 6, 55, '#8a5a3a', 0.35, seed + 3);
      for (let k = 0; k < 9; k++) { const px = x + (hash(k, 1, seed) - 0.5) * 140, py = y + (hash(k, 2, seed) - 0.5) * 80; line(c, [[px, py], [px + 8, py + 3], [px + 12, py - 2]], 'rgba(40,24,20,0.6)', 1); }
      if (n.biome === 'ashhill') { hill(c, x, y + 12, 56, 46, '#7a6a5a'); poly(c, [[x - 10, y - 30], [x - 6, y - 40], [x, y - 33], [x + 6, y - 41], [x + 10, y - 30]], '#c9a65a', INK, 1); }
      else for (let k = 0; k < 3; k++) { const px = x - 34 + k * 30; rrectKiln(c, px, y + 8); }
      for (let k = 0; k < 4; k++) { c.save(); c.globalAlpha = 0.35; c.filter = 'blur(3px)'; ellipse(c, x - 30 + k * 22, y - 30 - k * 6, 10, 6, '#c8c0b8'); c.restore(); }
      break;
    case 'salt':
      blob(c, x, y, 105, '#bfb8a2', 0.85, seed);
      for (let gy = -3; gy <= 3; gy++) for (let gx = -4; gx <= 4; gx++) {
        const px = x + gx * 20 + (gy % 2) * 10, py = y + gy * 13;
        if (Math.hypot((px - x) / 95, (py - y) / 60) > 1) continue;
        poly(c, [[px - 9, py], [px, py - 5], [px + 9, py], [px, py + 5]], tone('#e8e2d0', 0.9 + hash(gx, gy, seed) * 0.15), 'rgba(90,80,60,0.55)', 0.8);
      }
      break;
    case 'cliffs':
      blob(c, x, y, 100, '#7a7868', 0.8, seed);
      for (let k = 0; k < 7; k++) { const px = x - 80 + k * 26, py = y + 14 - Math.abs(k - 3) * 6; hill(c, px, py, 18, 30 + hash(k, 3, seed) * 14, '#8a8676'); }
      for (let k = 0; k < 18; k++) line(c, [[x - 86 + k * 9.5, y + 20], [x - 82 + k * 9.5, y + 30]], 'rgba(40,34,30,0.6)', 1);
      break;
    case 'ruins':
      blob(c, x, y, 90, '#6e7268', 0.8, seed);
      for (let k = 0; k < 5; k++) { const px = x - 50 + k * 24, h = 10 + hash(k, 2, seed) * 16; poly(c, [[px - 6, y + 10], [px - 6, y + 10 - h], [px - 2, y + 6 - h], [px + 2, y + 12 - h], [px + 6, y + 8 - h], [px + 6, y + 10]], '#9a958a', INK, 1); }
      line(c, [[x + 30, y + 10], [x + 26, y - 32]], INK, 6); line(c, [[x + 30, y + 10], [x + 26, y - 32]], '#a8a090', 4);
      poly(c, [[x + 18, y - 32], [x + 34, y - 36], [x + 30, y - 46], [x + 22, y - 44]], '#a8a090', INK, 1);
      break;
    case 'array':
      blob(c, x, y, 85, '#5e6070', 0.8, seed);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, px = x + Math.cos(a) * 30, py = y + Math.sin(a) * 18; const g = c.createRadialGradient(px, py, 0, px, py, 9); g.addColorStop(0, 'rgba(190,210,255,0.85)'); g.addColorStop(1, 'rgba(190,210,255,0)'); c.fillStyle = g; c.fillRect(px - 9, py - 9, 18, 18); }
      c.restore();
      ellipse(c, x, y, 30, 18, undefined, 'rgba(200,210,255,0.6)', 1.2); ellipse(c, x, y, 6, 6, '#c8d4ff', INK, 1);
      break;
  }
  void id;
}
function rrectKiln(c: Paint, x: number, y: number) {
  poly(c, [[x - 9, y], [x - 9, y - 10], [x - 4, y - 16], [x + 4, y - 16], [x + 9, y - 10], [x + 9, y]], '#7a4a32', INK, 1);
  ellipse(c, x, y - 4, 3.5, 3, '#ffb060');
}

let cache: string | null = null;
/** The painted chart as a data URL (painted once, ~20 ms). Roads, fog and markers are live overlays in the panel. */
export function worldMapImage(): string {
  if (cache) return cache;
  const S = 1.6, cv = document.createElement('canvas'); cv.width = MAP_W * S; cv.height = MAP_H * S;
  const c = cv.getContext('2d')!; c.scale(S, S);
  // land with soft painterly variation
  c.fillStyle = LAND; c.fillRect(0, 0, MAP_W, MAP_H);
  for (let y = 0; y < MAP_H; y += 6) for (let x = 0; x < MAP_W; x += 6) {
    const n = fbm(x / 140, y / 140, 5) - 0.5, k = 1 + n * 0.22;
    c.fillStyle = rgba(tone(LAND, k), 0.9); c.fillRect(x, y, 6.5, 6.5);
  }
  // water: the lake under Hearthmere, the river down the Water Road, the eastern sound behind the salt pans
  blob(c, 120, 600, 210, '#3f6170', 1, 11);
  blob(c, 1010, 430, 150, '#3f6170', 0.95, 12);
  stroke(c, [[300, -10], [250, 90], [300, 180], [330, 260], [270, 340], [210, 420], [150, 540]], '#3f6170', 16);
  stroke(c, [[300, -10], [250, 90], [300, 180], [330, 260], [270, 340], [210, 420], [150, 540]], 'rgba(170,210,215,0.35)', 3);
  stroke(c, [[640, 600], [700, 520], [760, 500], [850, 470], [1000, 430]], '#43656e', 9);
  // northern highlands and a few distant peaks
  for (let k = 0; k < 9; k++) hill(c, 380 + k * 70, 60 + (k % 2) * 10, 30, 26 + (k % 3) * 8, tone('#8a8676', 0.9 + (k % 3) * 0.06));
  // scattered woods between regions
  for (let i = 0; i < 160; i++) { const x = hash(i, 9, 3) * MAP_W, y = hash(i, 10, 3) * MAP_H; if (Math.abs(x - 500) < 80 && y < 120) continue; tree(c, x, y, 0.9 + hash(i, 11, 3) * 0.4, hash(i, 12, 3) > 0.55, 0.85); }
  for (const [id, n] of Object.entries(WORLD_LAYOUT)) paintBiome(c, id, n);
  // coast ink
  c.save(); c.globalAlpha = 0.45; c.filter = 'blur(1px)';
  stroke(c, [[0, 470], [60, 455], [130, 470], [220, 500], [270, 560], [300, 600]], INK, 1.6);
  c.restore();
  // paper: grain, stains and a dark vignette into the frame
  for (let i = 0; i < 2200; i++) { const x = hash(i, 13, 7) * MAP_W, y = hash(i, 14, 7) * MAP_H; c.fillStyle = hash(i, 15, 7) > 0.5 ? 'rgba(255,240,210,0.05)' : 'rgba(30,20,10,0.06)'; c.fillRect(x, y, 2, 1); }
  const v = c.createRadialGradient(MAP_W / 2, MAP_H / 2, MAP_H * 0.35, MAP_W / 2, MAP_H / 2, MAP_W * 0.62);
  v.addColorStop(0, 'rgba(10,8,6,0)'); v.addColorStop(1, 'rgba(10,8,6,0.62)');
  c.fillStyle = v; c.fillRect(0, 0, MAP_W, MAP_H);
  cache = cv.toDataURL('image/png');
  return cache;
}
