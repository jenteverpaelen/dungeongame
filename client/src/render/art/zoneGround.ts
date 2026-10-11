// Painted zone ground, second pass (docs/rework/worlds/LOG.md W4). Every pixel the camera can reach is painted, now from
// seamless material tiles and pre-painted stamps so a chunk costs a handful of pattern fills and image draws:
//   1. the biome's beyond (forest canopy, rock fields with outcrops and scree, ash dunes, salt crust, marsh, dark rock);
//   2. water, reed beds, lava, chasms;
//   3. rising faces on north edges and drops on south edges, softened by a shadow strip and broken by stones and tufts;
//   4. walkable ground: base material + region/road materials (soft edges) + macro variation (worn, wet, dry, snow,
//      ash and salt patches from world-space noise) + readable roads (worn halo, ruts, edge stones);
//   5. flat decor, soft prop shadows, light pools, small stories (puddles, leaves).
import { CanvasSource, Container, Matrix, Sprite, Texture, type Renderer } from 'pixi.js';
import type { AdventureData, Biome } from '@shared/adventureTypes';
import type { Point } from '@shared/townTypes';
import { groundBoundary, groundTester, type Edge } from '@shared/townGeometry';
import { bounds, ellipse, fbm, hash, inPoly, line, pathOf, poly, region, rgba, strokePolygon, tone, wobble, type Paint } from './townKit';
import { paintFlat, zoneShadow, ZONE_FLAT } from './zoneArt';

const CHUNK = 512, DENSITY = 1.5, MAX_CHUNKS = 40, T = 256;
type Rule = 'canopy' | 'rock' | 'ash' | 'marsh' | 'salt' | 'void' | 'roofs';
interface Overlay { tile: string; scale: number; lo: number; hi: number; seed: number; alpha?: number }
interface Pal { beyond: string; rule: Rule; face: [string, string, string]; faceH: [number, number]; lip: string; walk: string; overlays: Overlay[]; rockTone: string }
export const ZONE_PAL: Record<Biome, Pal> = {
  meadow: { beyond: 'forest', rule: 'canopy', face: ['#33452c', '#263522', '#18221a'], faceH: [34, 60], lip: '#3a3426', walk: 'grass', rockTone: '#7a766c',
    overlays: [{ tile: 'lush', scale: 420, lo: 0.56, hi: 0.7, seed: 11 }, { tile: 'drygrass', scale: 520, lo: 0.6, hi: 0.74, seed: 12 }, { tile: 'dirt', scale: 300, lo: 0.7, hi: 0.8, seed: 13, alpha: 0.8 }] },
  sluice: { beyond: 'forest', rule: 'canopy', face: ['#38463a', '#2a3830', '#1a2420'], faceH: [34, 60], lip: '#3c3a30', walk: 'grass', rockTone: '#7a766c',
    overlays: [{ tile: 'mud', scale: 360, lo: 0.6, hi: 0.72, seed: 21 }, { tile: 'lush', scale: 420, lo: 0.55, hi: 0.68, seed: 22 }, { tile: 'wet', scale: 260, lo: 0.7, hi: 0.8, seed: 23, alpha: 0.85 }] },
  quarry: { beyond: 'rockfield', rule: 'rock', face: ['#8a8478', '#6a655c', '#3e3a36'], faceH: [110, 190], lip: '#4a443c', walk: 'gravel', rockTone: '#8a8478',
    overlays: [{ tile: 'dust', scale: 420, lo: 0.56, hi: 0.7, seed: 31 }, { tile: 'rubble', scale: 300, lo: 0.66, hi: 0.78, seed: 32 }, { tile: 'grass', scale: 520, lo: 0.68, hi: 0.8, seed: 33, alpha: 0.75 }] },
  kiln: { beyond: 'ashfield', rule: 'ash', face: ['#5a4e48', '#3e3532', '#221c1a'], faceH: [80, 140], lip: '#2e2624', walk: 'ash', rockTone: '#564c46',
    overlays: [{ tile: 'ashdrift', scale: 420, lo: 0.56, hi: 0.7, seed: 41 }, { tile: 'cinder', scale: 320, lo: 0.62, hi: 0.76, seed: 42 }, { tile: 'scorch', scale: 260, lo: 0.7, hi: 0.8, seed: 43, alpha: 0.9 }] },
  fen: { beyond: 'marsh', rule: 'marsh', face: ['#3a4434', '#2c3628', '#1a221c'], faceH: [20, 36], lip: '#2a2a22', walk: 'mud', rockTone: '#6a665c',
    overlays: [{ tile: 'wet', scale: 300, lo: 0.58, hi: 0.7, seed: 51 }, { tile: 'moss', scale: 420, lo: 0.58, hi: 0.72, seed: 52 }, { tile: 'lush', scale: 520, lo: 0.66, hi: 0.78, seed: 53, alpha: 0.8 }] },
  salt: { beyond: 'saltflat', rule: 'salt', face: ['#d8d2c0', '#aaa391', '#7a7466'], faceH: [44, 80], lip: '#9a9482', walk: 'salt', rockTone: '#b0a898',
    overlays: [{ tile: 'crust', scale: 380, lo: 0.52, hi: 0.66, seed: 61 }, { tile: 'brinestain', scale: 300, lo: 0.64, hi: 0.76, seed: 62 }, { tile: 'gravel', scale: 460, lo: 0.68, hi: 0.8, seed: 63, alpha: 0.7 }] },
  ridge: { beyond: 'rockfield', rule: 'rock', face: ['#8e9496', '#6a7072', '#3a3e40'], faceH: [120, 200], lip: '#4a4e50', walk: 'slate', rockTone: '#8e9496',
    overlays: [{ tile: 'snow', scale: 360, lo: 0.56, hi: 0.7, seed: 71, alpha: 0.8 }, { tile: 'grass', scale: 460, lo: 0.62, hi: 0.74, seed: 72, alpha: 0.8 }, { tile: 'rubble', scale: 300, lo: 0.7, hi: 0.8, seed: 73 }] },
  ward: { beyond: 'cobble', rule: 'roofs', face: ['#8a8478', '#6a655c', '#3e3a36'], faceH: [90, 150], lip: '#44403a', walk: 'cobble', rockTone: '#8a8478',
    overlays: [{ tile: 'moss', scale: 380, lo: 0.6, hi: 0.72, seed: 81, alpha: 0.75 }, { tile: 'dirt', scale: 300, lo: 0.64, hi: 0.76, seed: 82, alpha: 0.85 }, { tile: 'wet', scale: 260, lo: 0.72, hi: 0.82, seed: 83, alpha: 0.7 }] },
  pump: { beyond: 'void', rule: 'void', face: ['#5a5650', '#3e3c38', '#22201e'], faceH: [140, 180], lip: '#262422', walk: 'flag', rockTone: '#3a3836',
    overlays: [{ tile: 'wet', scale: 260, lo: 0.6, hi: 0.72, seed: 91 }, { tile: 'moss', scale: 340, lo: 0.64, hi: 0.76, seed: 92, alpha: 0.7 }, { tile: 'rubble', scale: 300, lo: 0.72, hi: 0.82, seed: 93 }] },
  cistern: { beyond: 'void', rule: 'void', face: ['#4e5a5c', '#36403f', '#1c2224'], faceH: [140, 180], lip: '#222a2c', walk: 'tile', rockTone: '#34403f',
    overlays: [{ tile: 'wet', scale: 240, lo: 0.56, hi: 0.68, seed: 95 }, { tile: 'moss', scale: 320, lo: 0.62, hi: 0.74, seed: 96, alpha: 0.75 }, { tile: 'stain', scale: 280, lo: 0.7, hi: 0.8, seed: 97 }] },
  array: { beyond: 'void', rule: 'void', face: ['#565a66', '#3c3f48', '#1e2026'], faceH: [140, 180], lip: '#24242a', walk: 'slate', rockTone: '#3c3f48',
    overlays: [{ tile: 'stain', scale: 300, lo: 0.6, hi: 0.72, seed: 98 }, { tile: 'rubble', scale: 320, lo: 0.68, hi: 0.8, seed: 99 }] },
};

// ─────────────────────────── seamless material tiles (cached patterns) ───────────────────────────

const tiles = new Map<string, HTMLCanvasElement>();
function wrap(x: number, y: number, r: number, fn: (x: number, y: number) => void) {
  for (const dx of [-T, 0, T]) for (const dy of [-T, 0, T]) if (x + dx > -r && x + dx < T + r && y + dy > -r && y + dy < T + r) fn(x + dx, y + dy);
}
function blotches(c: Paint, n: number, seed: number, col: string, rMin: number, rMax: number, alpha: number) {
  for (let i = 0; i < n; i++) { const x = hash(i, 1, seed) * T, y = hash(i, 2, seed) * T, r = rMin + hash(i, 3, seed) * (rMax - rMin); wrap(x, y, r, (px, py) => ellipse(c, px, py, r, r * 0.62, rgba(col, alpha))); }
}
function specks(c: Paint, n: number, seed: number, cols: string[], rMin: number, rMax: number, ry = 0.75) {
  for (let i = 0; i < n; i++) { const x = hash(i, 4, seed) * T, y = hash(i, 5, seed) * T, r = rMin + hash(i, 6, seed) * (rMax - rMin); wrap(x, y, r, (px, py) => ellipse(c, px, py, r, r * ry, cols[i % cols.length])); }
}
function blades(c: Paint, n: number, seed: number, base: string, lift: number) {
  for (let i = 0; i < n; i++) { const x = hash(i, 7, seed) * T, y = hash(i, 8, seed) * T, h = 3 + hash(i, 9, seed) * 6, k = 0.75 + hash(i, 10, seed) * 0.6; wrap(x, y, 8, (px, py) => line(c, [[px, py], [px - 1.5 + hash(i, 11, seed) * 3, py - h]], tone(base, k * lift), 1.3)); }
}
function stonesTile(c: Paint, seed: number, base: string, gap: string, size: number, jitter: number) {
  c.fillStyle = gap; c.fillRect(0, 0, T, T);
  const n = Math.round(T / size);
  for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
    const cx = (gx + 0.5) * size + (hash(gx, gy, seed) - 0.5) * jitter, cy = (gy + 0.5) * size + (hash(gy, gx, seed) - 0.5) * jitter, r = size * (0.36 + hash(gx, gy, seed + 1) * 0.14);
    const k = 0.8 + hash(gx, gy, seed + 2) * 0.35, sides = 6, pts: Point[] = [];
    for (let s = 0; s < sides; s++) { const a = (s / sides) * Math.PI * 2 + hash(gx, s, seed) * 0.6, rr = r * (0.78 + hash(gy, s, seed) * 0.3); pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.72]); }
    wrap(cx, cy, r, (px, py) => { poly(c, pts.map(([x, y]) => [px + x, py + y] as Point), tone(base, k), 'rgba(20,16,18,0.35)', 1); line(c, [[px - r * 0.4, py - r * 0.36], [px + r * 0.2, py - r * 0.42]], 'rgba(255,240,215,0.14)', 1.2); });
  }
}
function slabsTile(c: Paint, seed: number, base: string, grout: string, rowH: number) {
  c.fillStyle = grout; c.fillRect(0, 0, T, T);
  for (let row = 0; row * rowH < T; row++) {
    let x = -hash(row, 1, seed) * 40;
    while (x < T) {
      const w = 34 + hash(Math.round(x), row, seed) * 46, k = 0.8 + hash(row, Math.round(x), seed + 3) * 0.3, y = row * rowH;
      const draw = (px: number, py: number) => { poly(c, [[px + 2, py + 2], [px + w - 2, py + 2.5], [px + w - 2.5, py + rowH - 2], [px + 2.5, py + rowH - 2.4]], tone(base, k), 'rgba(16,14,14,0.3)', 1); c.fillStyle = 'rgba(255,240,215,0.1)'; c.fillRect(px + 4, py + 3, w - 9, 1.4);
        if (hash(Math.round(px), Math.round(py), seed + 4) > 0.82) line(c, [[px + w * 0.3, py + 3], [px + w * 0.36, py + rowH * 0.5], [px + w * 0.28, py + rowH - 3]], 'rgba(20,16,18,0.45)', 1); };
      wrap(x, y, Math.max(w, rowH), draw); x += w;
    }
  }
}
/** Irregular flagstones (dungeon and yard floors): jittered corners, merged pairs, worn tones, cracks — never brick rows. */
function flagsTile(c: Paint, seed: number, base: string, grout: string, cell: number) {
  c.fillStyle = grout; c.fillRect(0, 0, T, T);
  const n = Math.round(T / cell), cellW = T / n;
  const corner = (gx: number, gy: number): Point => [gx * cellW + (hash(((gx % n) + n) % n, ((gy % n) + n) % n, seed) - 0.5) * cellW * 0.22, gy * cellW + (hash(((gy % n) + n) % n, ((gx % n) + n) % n, seed + 1) - 0.5) * cellW * 0.22];
  for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
    const merge = hash(gx, gy, seed + 2) > 0.7 && gx % 2 === 0, w = merge ? 2 : 1;
    if (gx % 2 === 1 && hash(gx - 1, gy, seed + 2) > 0.7) continue;
    const a = corner(gx, gy), b = corner(gx + w, gy), d = corner(gx + w, gy + 1), e = corner(gx, gy + 1), k = 0.74 + hash(gx, gy, seed + 3) * 0.36;
    const pts: Point[] = [[a[0] + 2.5, a[1] + 2.5], [b[0] - 2.5, b[1] + 2.5], [d[0] - 2.5, d[1] - 2.5], [e[0] + 2.5, e[1] - 2.5]];
    const cx = (a[0] + d[0]) / 2, cy = (a[1] + d[1]) / 2;
    wrap(cx, cy, cellW * 2, (px, py) => {
      const ox = px - cx, oy = py - cy, q = pts.map(([x, y]) => [x + ox, y + oy] as Point);
      poly(c, q, tone(base, k), 'rgba(14,12,12,0.35)', 1.1);
      line(c, [[q[0][0] + 3, q[0][1] + 2], [q[1][0] - 3, q[1][1] + 2]], 'rgba(255,240,215,0.1)', 1.4);
      if (hash(gx, gy, seed + 4) > 0.8) line(c, [[px - cellW * 0.2, py - cellW * 0.3], [px + cellW * 0.05, py], [px - cellW * 0.1, py + cellW * 0.3]], 'rgba(20,16,18,0.5)', 1);
      if (hash(gx, gy, seed + 5) > 0.86) ellipse(c, px + cellW * 0.15, py + cellW * 0.1, cellW * 0.22, cellW * 0.1, 'rgba(70,96,52,0.35)');
    });
  }
}
function tileOf(kind: string): HTMLCanvasElement {
  const hit = tiles.get(kind); if (hit) return hit;
  const cv = document.createElement('canvas'); cv.width = cv.height = Math.round(T * DENSITY);
  const c = cv.getContext('2d')!; c.setTransform(DENSITY, 0, 0, DENSITY, 0, 0);
  const flat = (col: string) => { c.fillStyle = col; c.fillRect(0, 0, T, T); };
  switch (kind) {
    case 'grass': flat('#4f6a3a'); blotches(c, 16, 101, '#3e5a2e', 30, 80, 0.35); blotches(c, 12, 102, '#6a8a48', 24, 60, 0.22); blades(c, 620, 103, '#4f6a3a', 1.12); break;
    case 'meadow': flat('#5c7442'); blotches(c, 16, 111, '#4a6034', 30, 80, 0.3); blades(c, 700, 112, '#5c7442', 1.12); specks(c, 26, 113, ['#e8c35a', '#f2ecd8', '#d86a7a', '#9a7ad8'], 1.6, 2.4); break;
    case 'lush': flat('#3f5a30'); blotches(c, 14, 121, '#2e4a24', 30, 70, 0.4); blades(c, 760, 122, '#46663a', 1.18); break;
    case 'drygrass': flat('#7a7a46'); blotches(c, 12, 131, '#8a8a52', 30, 70, 0.3); blades(c, 520, 132, '#8a8650', 1.08); break;
    case 'dirt': flat('#6e5a44'); blotches(c, 14, 141, '#5e4a36', 24, 70, 0.4); specks(c, 160, 142, ['#7e6a52', '#5a4836', '#8a7660'], 1.2, 3.2); blades(c, 60, 143, '#55703c', 1); break;
    case 'mud': flat('#4c4232'); blotches(c, 14, 151, '#3a3226', 24, 70, 0.45); blotches(c, 8, 152, '#5e6a6a', 10, 26, 0.22); specks(c, 80, 153, ['#5a4e3a', '#3a3024'], 1.4, 3); break;
    case 'wet': flat('#3c4a48'); blotches(c, 10, 161, '#2a3634', 20, 50, 0.45); blotches(c, 8, 162, '#9ab8b8', 8, 22, 0.2); break;
    case 'gravel': flat('#7c756a'); specks(c, 900, 171, ['#8a8478', '#6a655c', '#9a9488', '#5a554e'], 1, 3); break;
    case 'dust': flat('#9a9080'); blotches(c, 12, 181, '#aaa090', 30, 70, 0.3); specks(c, 300, 182, ['#8a8072', '#b0a898'], 0.8, 2); break;
    case 'rubble': flat('#6a655c'); stonesTile(c, 191, '#7a756a', 'rgba(90,85,78,1)', 26, 12); specks(c, 200, 192, ['#5a554e', '#8a857a'], 1, 2.4); break;
    case 'ash': flat('#4a403c'); blotches(c, 14, 201, '#5a504a', 30, 70, 0.3); specks(c, 260, 202, ['#3a322e', '#5e544e', '#c8642a'], 1, 2.2); break;
    case 'ashdrift': flat('#6a605a'); blotches(c, 12, 211, '#7a706a', 30, 80, 0.35); specks(c, 160, 212, ['#5a504a', '#8a807a'], 0.8, 1.8); break;
    case 'cinder': flat('#2e2624'); blotches(c, 12, 221, '#3a302c', 20, 60, 0.4); specks(c, 300, 222, ['#1e1816', '#4a3e38', '#e0642a'], 1, 2.4); break;
    case 'scorch': flat('#2a1e1a'); for (let i = 0; i < 18; i++) { const x = hash(i, 1, 231) * T, y = hash(i, 2, 231) * T, a = hash(i, 3, 231) * 6.28, l = 20 + hash(i, 4, 231) * 30; wrap(x, y, l, (px, py) => { line(c, [[px, py], [px + Math.cos(a) * l, py + Math.sin(a) * l * 0.45]], '#140c0a', 3); line(c, [[px, py], [px + Math.cos(a) * l * 0.8, py + Math.sin(a) * l * 0.36]], 'rgba(255,110,40,0.7)', 1.2); }); } break;
    case 'salt': flat('#cdc6b2'); blotches(c, 12, 241, '#dad4c4', 30, 70, 0.4); crackNet(c, 242, 'rgba(120,112,96,0.45)', 46); break;
    case 'crust': flat('#e8e4d8'); crackNet(c, 251, 'rgba(150,140,120,0.6)', 30); blotches(c, 10, 252, '#ffffff', 20, 50, 0.35); break;
    case 'brinestain': flat('#a8b0a6'); blotches(c, 10, 261, '#8a9a94', 20, 60, 0.45); blotches(c, 8, 262, '#f4f0e6', 6, 16, 0.5); break;
    case 'slate': flat('#59615f'); for (let i = 0; i < 90; i++) { const x = hash(i, 1, 271) * T, y = hash(i, 2, 271) * T, w = 8 + hash(i, 3, 271) * 14; wrap(x, y, w, (px, py) => poly(c, [[px - w, py], [px - w * 0.3, py - w * 0.36], [px + w, py - w * 0.2], [px + w * 0.4, py + w * 0.3]], tone('#59615f', 0.8 + hash(i, 4, 271) * 0.4), 'rgba(20,24,26,0.25)', 0.8)); } specks(c, 200, 272, ['#4a5250', '#6a7270'], 0.8, 2); break;
    case 'snow': flat('#d6dce2'); blotches(c, 12, 281, '#eef2f6', 24, 60, 0.5); blotches(c, 10, 282, '#9eacb8', 16, 40, 0.3); specks(c, 160, 283, ['#ffffff', '#c4d0da'], 0.6, 1.4); break;
    case 'moss': flat('#47583a'); blotches(c, 14, 291, '#3a4a2e', 20, 60, 0.4); blades(c, 300, 292, '#4f6a3a', 1.05); break;
    case 'stain': flat('#2a2e30'); blotches(c, 12, 301, '#1e2224', 20, 60, 0.5); blotches(c, 6, 302, '#4a5a5a', 10, 30, 0.25); break;
    case 'sand': flat('#a99472'); specks(c, 500, 311, ['#b8a482', '#958262', '#c4b294'], 0.8, 1.8); break;
    case 'stone': stonesTile(c, 321, '#8a8478', '#5e5a50', 42, 18); blades(c, 160, 322, '#55703c', 1); break;
    case 'flag': flagsTile(c, 331, '#6c665c', '#2a2624', 46); break;
    case 'tile': flagsTile(c, 341, '#4c5a58', '#1e2826', 38); blotches(c, 8, 342, '#2a3a38', 20, 50, 0.3); break;
    case 'cobble': stonesTile(c, 351, '#7a746c', '#4e4a44', 22, 8); break;
    case 'planks': { flat('#3a2a1e'); for (let row = 0; row < T / 15; row++) { let x = -hash(row, 1, 361) * 120; while (x < T) { const w = 100 + hash(row, Math.round(x), 361) * 60, k = 0.82 + hash(Math.round(x), row, 362) * 0.3; wrap(x, row * 15, w, (px, py) => { c.fillStyle = tone('#7a5c3e', k); c.fillRect(px, py, w - 2, 13.4); c.fillStyle = 'rgba(255,230,190,0.12)'; c.fillRect(px, py + 1, w - 2, 1.4); c.fillStyle = 'rgba(30,20,16,0.5)'; c.fillRect(px + 5, py + 6, 2, 2); c.fillRect(px + w - 9, py + 6, 2, 2); }); x += w; } } break; }
    case 'forest': flat('#22301e'); blotches(c, 16, 371, '#1a2618', 30, 80, 0.5); specks(c, 160, 372, ['#2e3e26', '#1a2216', '#4a3a26'], 1, 3); break;
    case 'rockfield': flat('#5a564e'); blotches(c, 14, 381, '#6a665e', 30, 80, 0.4); blotches(c, 12, 382, '#46423c', 30, 70, 0.4); crackNet(c, 383, 'rgba(30,28,26,0.35)', 60); specks(c, 260, 384, ['#4a4640', '#7a766c'], 1, 3); break;
    case 'ashfield': flat('#2c2422'); blotches(c, 14, 391, '#3a302c', 30, 80, 0.45); specks(c, 300, 392, ['#1e1816', '#4a3e38', '#b8542a'], 1, 2.6); break;
    case 'saltflat': flat('#bcb6a4'); crackNet(c, 401, 'rgba(110,104,92,0.5)', 36); blotches(c, 12, 402, '#d0cab8', 30, 70, 0.4); break;
    case 'marsh': flat('#1e3430'); blotches(c, 14, 411, '#2e3a2a', 24, 60, 0.6); blotches(c, 8, 412, '#3e5a54', 10, 30, 0.35); break;
    case 'void': flat('#141616'); blotches(c, 12, 421, '#1e2020', 30, 80, 0.5); specks(c, 120, 422, ['#0c0e0e', '#262828'], 1, 3); break;
    default: flat('#6e5a44');
  }
  tiles.set(kind, cv); return cv;
}
/** Polygonal crack network (salt crust, rock fields), seamless in the tile. */
function crackNet(c: Paint, seed: number, col: string, cell: number) {
  const n = Math.round(T / cell), pts: Point[][] = [];
  for (let gy = 0; gy < n; gy++) { pts.push([]); for (let gx = 0; gx < n; gx++) pts[gy].push([(gx + 0.5 + (hash(gx, gy, seed) - 0.5) * 0.7) * cell, (gy + 0.5 + (hash(gy, gx, seed) - 0.5) * 0.7) * cell]); }
  const at = (gx: number, gy: number): Point => { const p = pts[((gy % n) + n) % n][((gx % n) + n) % n]; return [p[0] + Math.floor(gx / n) * T, p[1] + Math.floor(gy / n) * T]; };
  for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
    const a = at(gx, gy);
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]] as const) {
      if (dx && dy && hash(gx, gy, seed + 5) > 0.5) continue;
      const b = at(gx + dx, gy + dy);
      wrap((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, cell * 1.5, (px, py) => { const ox = px - (a[0] + b[0]) / 2, oy = py - (a[1] + b[1]) / 2; line(c, [[a[0] + ox, a[1] + oy], [(a[0] + b[0]) / 2 + ox + (hash(gx, gy, seed + dx + 2 * dy) - 0.5) * 6, (a[1] + b[1]) / 2 + oy], [b[0] + ox, b[1] + oy]], col, 1.2); });
    }
  }
}
const patterns = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern>>();
function pattern(c: Paint, kind: string): CanvasPattern {
  let m = patterns.get(c); if (!m) patterns.set(c, m = new Map());
  let p = m.get(kind); if (p) return p;
  p = c.createPattern(tileOf(kind), 'repeat')!; p.setTransform(new DOMMatrix().scale(1 / DENSITY)); m.set(kind, p); return p;
}

// ─────────────────────────── stamps (pre-painted small images) ───────────────────────────

const stamps = new Map<string, { cv: HTMLCanvasElement; ox: number; oy: number; w: number; h: number }>();
function stamp(key: string, w: number, h: number, ox: number, oy: number, draw: (c: Paint) => void) {
  const hit = stamps.get(key); if (hit) return hit;
  const cv = document.createElement('canvas'); cv.width = Math.ceil(w * DENSITY); cv.height = Math.ceil(h * DENSITY);
  const c = cv.getContext('2d')!; c.setTransform(DENSITY, 0, 0, DENSITY, ox * DENSITY, oy * DENSITY); draw(c);
  const s = { cv, ox, oy, w, h }; stamps.set(key, s); return s;
}
function put(c: Paint, s: ReturnType<typeof stamp>, x: number, y: number, k = 1, flip = false) {
  if (flip) { c.save(); c.translate(x, y); c.scale(-1, 1); c.drawImage(s.cv, -s.ox * k, -s.oy * k, s.w * k, s.h * k); c.restore(); }
  else c.drawImage(s.cv, x - s.ox * k, y - s.oy * k, s.w * k, s.h * k);
}
function crownStamp(v: number) {
  return stamp(`crown${v}`, 110, 110, 55, 80, (c) => {
    const pine = v >= 4, fen = v === 3, s = 1;
    const dark = pine ? '#1d3424' : fen ? '#2e3a1c' : '#25381f', mid = pine ? '#2c4a30' : fen ? '#46562a' : '#36502a', lit = pine ? '#46684a' : fen ? '#6a7a3a' : '#55703c';
    ellipse(c, 14, 4, 34, 12, 'rgba(8,12,14,0.35)');
    if (pine) { for (let k = 0; k < 4; k++) { const w = (34 - k * 7) * s, yy = -k * 22 * s; poly(c, [[-w, yy], [0, yy - 34 * s], [w, yy]], k % 2 ? mid : dark, '#13201a', 2); poly(c, [[-w * 0.7, yy - 4 * s], [-2 * s, yy - 30 * s], [-w * 0.2, yy - 8 * s]], lit); } return; }
    const blobs = 6 + (v % 2);
    for (let k = 0; k < blobs; k++) { const a = k * 2.4 + v, rr = (20 + hash(v, k, 5) * 12) * s; ellipse(c, Math.cos(a) * 18 * s, -30 * s + Math.sin(a) * 12 * s, rr, rr * 0.82, dark, '#141e14', 2); }
    for (let k = 0; k < blobs; k++) { const a = k * 2.4 + v, rr = (14 + hash(v, k, 6) * 8) * s; ellipse(c, Math.cos(a) * 16 * s - 4 * s, -34 * s + Math.sin(a) * 10 * s, rr, rr * 0.8, mid); ellipse(c, Math.cos(a) * 16 * s - 8 * s, -38 * s + Math.sin(a) * 10 * s, rr * 0.5, rr * 0.4, lit); }
  });
}
function rockStamp(tone0: string, v: number) {
  return stamp(`rock${tone0}${v}`, 120, 80, 60, 60, (c) => {
    const w = [44, 34, 52, 28][v], h = [30, 26, 36, 20][v];
    ellipse(c, 6, 4, w * 1.05, h * 0.38, 'rgba(10,10,12,0.35)');
    const pts: Point[] = [[-w, 0], [-w * 1.02, -h * 0.4], [-w * 0.5, -h * 0.95], [w * 0.15, -h], [w * 0.8, -h * 0.62], [w, -h * 0.12], [w * 0.85, 2]];
    poly(c, pts, tone(tone0, 0.9 + v * 0.05), 'rgba(16,14,14,0.75)', 1.4);
    poly(c, [[-w * 0.92, -h * 0.4], [-w * 0.5, -h * 0.9], [w * 0.1, -h * 0.94], [-w * 0.1, -h * 0.42]], tone(tone0, 1.16));
    line(c, [[-w * 0.2, -h * 0.5], [w * 0.18, -h * 0.25]], 'rgba(20,16,18,0.45)', 1.1);
  });
}
/** A house seen from the camera (front wall, gable roof, chimney): the ward's packed districts beyond the streets. */
function roofStamp(v: number) {
  return stamp(`roof${v}`, 190, 190, 95, 150, (c) => {
    const wall = ['#c8bca0', '#b8ac90', '#d0c4a8', '#a89c84'][v % 4], roofCol = ['#5a6a7a', '#8a4a34', '#9a7a4a', '#6a5a4a'][v % 4], w = 120 + (v % 3) * 16, h = 54, rh = 70;
    ellipse(c, 10, 6, w * 0.6, 16, 'rgba(8,10,12,0.4)');
    poly(c, [[-w / 2, 0], [w / 2, 0], [w / 2, -h], [-w / 2, -h]], wall, 'rgba(20,16,14,0.8)', 1.4);
    for (const x of [-w / 3, 0, w / 3]) { c.fillStyle = (v + Math.round(x)) % 3 ? '#e8b060' : '#2a3034'; c.fillRect(x - 8, -h + 14, 16, 16); c.strokeStyle = 'rgba(20,16,14,0.8)'; c.lineWidth = 1.2; c.strokeRect(x - 8, -h + 14, 16, 16); }
    poly(c, [[-w / 2 - 12, -h], [w / 2 + 12, -h], [w / 2 - 6, -h - rh], [-w / 2 + 6, -h - rh]], roofCol, 'rgba(20,16,14,0.85)', 1.6);
    for (let k = 1; k < 5; k++) line(c, [[-w / 2 - 12 + k * 3, -h - (rh * k) / 5], [w / 2 + 12 - k * 3, -h - (rh * k) / 5]], 'rgba(20,12,10,0.25)', 1.2);
    line(c, [[-w / 2 + 6, -h - rh], [w / 2 - 6, -h - rh]], 'rgba(255,240,215,0.25)', 2);
    c.fillStyle = '#6a625a'; c.fillRect(w / 4, -h - rh - 22, 16, 30); c.strokeRect(w / 4, -h - rh - 22, 16, 30);
  });
}
const tuftStamp = (v: number, col: string) => stamp(`tuft${v}${col}`, 30, 20, 15, 16, (c) => { for (let i = 0; i < 7; i++) line(c, [[-6 + i * 2, 0], [-8 + i * 2.4 + hash(i, v, 3) * 3, -6 - hash(i, v, 4) * 8]], i % 2 ? tone(col, 1.2) : col, 1.4); });
const pebbleStamp = (v: number, col: string) => stamp(`peb${v}${col}`, 16, 12, 8, 8, (c) => { ellipse(c, 0, 0, 3 + v, 2 + v * 0.6, tone(col, 0.9 + v * 0.08), 'rgba(16,14,14,0.6)', 0.8); ellipse(c, -0.8, -0.8, 1.2 + v * 0.3, 0.7, 'rgba(255,245,230,0.3)'); });
const shadowStamp = () => stamp('shadow', 100, 50, 50, 25, (c) => { const g = c.createRadialGradient(0, 0, 2, 0, 0, 48); g.addColorStop(0, 'rgba(12,18,22,0.55)'); g.addColorStop(1, 'rgba(12,18,22,0)'); c.save(); c.scale(1, 0.5); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 48, 0, Math.PI * 2); c.fill(); c.restore(); });
const flatCache = new Map<string, ReturnType<typeof stamp>>();
function flatStamp(kind: string, v: number, s: number) {
  const k = `${kind}:${v}:${Math.round(s * 4) / 4}`; const hit = flatCache.get(k); if (hit) return hit;
  const st = stamp(`flat:${k}`, 140, 80, 70, 40, (c) => paintFlat(c, kind, 0, 0, Math.round(s * 4) / 4, v)); flatCache.set(k, st); return st;
}

// ─────────────────────────── preparation ───────────────────────────

interface Prep {
  pal: Pal; floorPath: Path2D;
  regions: { kind: string; path: Path2D; b: ReturnType<typeof bounds> }[];
  roads: { points: Point[]; width: number; kind: string; b: ReturnType<typeof bounds> }[];
  land: { kind: string; poly: Point[]; path: Path2D; b: ReturnType<typeof bounds> }[];
  water: Point[][]; waterPath: Path2D; edges: (Edge & { b: ReturnType<typeof bounds>; wet: boolean })[];
  walk: Uint8Array; gw: number; gh: number;
}
function prepare(a: AdventureData): Prep {
  const paint = a.paint!, pal = ZONE_PAL[paint.biome];
  const floors = a.geometry.floors.map((f) => { const ar = f.polygon.reduce((s, p, i) => { const q = f.polygon[(i + 1) % f.polygon.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0); return ar < 0 ? [...f.polygon].reverse() : f.polygon; });
  const floorPath = new Path2D(); for (const f of floors) floorPath.addPath(pathOf(f));
  const regions = paint.ground.map((g, i) => {
    const base = g.polygon ?? strokePolygon(g.path!, g.width!), soft = g.kind !== 'planks' && g.kind !== 'tile';
    const p = soft && g.path ? wobble(base, 22, 7, 300 + i) : base;
    return { kind: g.kind, path: pathOf(p), b: bounds(p) };
  });
  const roads = paint.ground.filter((g) => g.path && g.kind !== 'planks').map((g) => ({ points: g.path!, width: g.width!, kind: g.kind, b: bounds(strokePolygon(g.path!, g.width! * 1.6)) }));
  const land = paint.landscape.map((l, i) => { const p = l.kind === 'water' || l.kind === 'deep' ? l.polygon : wobble(l.polygon, 26, 10, 50 + i); return { kind: l.kind, poly: p, path: pathOf(p), b: bounds(p) }; });
  const water = paint.landscape.filter((l) => l.kind === 'water' || l.kind === 'deep').map((l) => l.polygon);
  const waterPath = new Path2D(); for (const w of water) waterPath.addPath(pathOf(w));
  const geo = { ...a.geometry, buildings: [] }, test = groundTester(geo);
  const edges = groundBoundary(geo).map((e) => {
    const mx = (e.ax + e.bx) / 2 - e.nx * 16, my = (e.ay + e.by) / 2 - e.ny * 16;
    return { ...e, b: { x0: Math.min(e.ax, e.bx), y0: Math.min(e.ay, e.by), x1: Math.max(e.ax, e.bx), y1: Math.max(e.ay, e.by) }, wet: water.some((w) => inPoly(mx, my, w)) };
  });
  const gw = Math.ceil(a.size[0] * 64 / 32), gh = Math.ceil(a.size[1] * 64 / 32), walk = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) walk[y * gw + x] = test(x * 32 + 16, y * 32 + 16) ? 1 : 0;
  return { pal, floorPath, regions, roads, land, water, waterPath, edges, walk, gw, gh };
}
function nearWalk(p: Prep, x: number, y: number, up: number, side = 70): boolean {
  for (let yy = y - up; yy <= y + 60; yy += 32) for (let xx = x - side; xx <= x + side; xx += 32) {
    const gx = Math.floor(xx / 32), gy = Math.floor(yy / 32);
    if (gx >= 0 && gy >= 0 && gx < p.gw && gy < p.gh && p.walk[gy * p.gw + gx]) return true;
  }
  return false;
}

// ─────────────────────────── chunk painter ───────────────────────────

const scratch: HTMLCanvasElement[] = [];
const take = (w: number, h: number) => { const c = scratch.pop() ?? document.createElement('canvas'); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; };
/** Paint `kind` over the chunk where world-space noise passes the overlay's threshold (soft), clipped to the floor. */
function overlay(c: Paint, p: Prep, o: Overlay, x0: number, y0: number) {
  const n = 48, step = CHUNK / n, mask = take(n + 1, n + 1), m = mask.getContext('2d')!, img = m.createImageData(n + 1, n + 1);
  let any = false;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = x0 + i * step, y = y0 + j * step, f = fbm(x / o.scale, y / o.scale, o.seed), t = Math.max(0, Math.min(1, (f - o.lo) / (o.hi - o.lo)));
    const k = (j * (n + 1) + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(t * t * (3 - 2 * t) * 255 * (o.alpha ?? 1)); if (t > 0) any = true;
  }
  if (!any) { scratch.push(mask); return; }
  m.putImageData(img, 0, 0);
  const W = Math.round(CHUNK * DENSITY), layer = take(W, W), g = layer.getContext('2d')!;
  g.setTransform(DENSITY, 0, 0, DENSITY, -x0 * DENSITY, -y0 * DENSITY); g.globalCompositeOperation = 'source-over'; g.clearRect(x0, y0, CHUNK, CHUNK);
  g.fillStyle = pattern(g, o.tile); g.fillRect(x0, y0, CHUNK, CHUNK);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(mask, -0.5 * (W / n), -0.5 * (W / n), W + W / n, W + W / n); g.globalCompositeOperation = 'source-over';
  c.save(); c.clip(p.floorPath); c.drawImage(layer, x0, y0, CHUNK, CHUNK); c.restore();
  scratch.push(mask, layer);
}

function* paintChunk(c: Paint, a: AdventureData, p: Prep, x0: number, y0: number): Generator<void, void, void> {
  const paint = a.paint!, pal = p.pal, x1 = x0 + CHUNK, y1 = y0 + CHUNK;
  const hits = (b: { x0: number; y0: number; x1: number; y1: number }, pad = 0) => b.x1 >= x0 - pad && b.x0 <= x1 + pad && b.y1 >= y0 - pad && b.y0 <= y1 + pad;
  const clip = (b: ReturnType<typeof bounds>, pad: number) => ({ x0: Math.max(x0, b.x0 - pad), y0: Math.max(y0, b.y0 - pad), x1: Math.min(x1, b.x1 + pad), y1: Math.min(y1, b.y1 + pad) });
  // 1. the beyond: a seamless base, then stamps placed by world-space noise (no grid ever shows)
  c.fillStyle = pattern(c, pal.beyond); c.fillRect(x0, y0, CHUNK, CHUNK);
  const macro = (sx: number, sy: number, sd: number) => fbm(sx / 260, sy / 260, sd);
  if (pal.rule === 'canopy') {
    const step = 64, crowns: [number, number, number, number, boolean][] = [];
    for (let gy = Math.floor((y0 - 120) / step); gy < (y1 + 160) / step; gy++) for (let gx = Math.floor((x0 - 80) / step); gx < (x1 + 80) / step; gx++) {
      const jx = gx * step + (hash(gx, gy, 41) - 0.5) * 56, jy = gy * step + (hash(gx, gy, 42) - 0.5) * 46;
      if (macro(jx, jy, 5) < 0.3 || nearWalk(p, jx, jy, 170) || p.water.some((wp) => inPoly(jx, jy, wp))) continue;
      const fen = paint.biome === 'fen' || paint.biome === 'sluice';
      crowns.push([jx, jy, 0.8 + hash(gx, gy, 43) * 0.55, hash(gx, gy, 44) > (fen ? 0.75 : 0.55) ? 4 + (gx & 1) : fen && hash(gx, gy, 45) > 0.5 ? 3 : (gx + gy) % 3, hash(gx, gy, 46) > 0.5]);
    }
    crowns.sort((q, r) => q[1] - r[1]);
    for (const [x, y, s, v, fl] of crowns) put(c, crownStamp(v), x, y, s, fl);
  } else if (pal.rule === 'roofs') {
    const step = 150, roofs: [number, number, number][] = [];
    for (let gy = Math.floor((y0 - 60) / step); gy < (y1 + 220) / step; gy++) for (let gx = Math.floor((x0 - 120) / step); gx < (x1 + 120) / step; gx++) {
      const x = gx * step + (gy % 2) * step * 0.5 + (hash(gx, gy, 61) - 0.5) * 30, y = gy * step + (hash(gx, gy, 62) - 0.5) * 20;
      if (hash(gx, gy, 63) < 0.12 || nearWalk(p, x, y, 210, 90)) continue;
      roofs.push([x, y, Math.floor(hash(gx, gy, 64) * 4)]);
    }
    roofs.sort((q, r) => q[1] - r[1]);
    for (const [x, y, v] of roofs) put(c, roofStamp(v), x, y, 1, v % 2 === 1);
  } else {
    const step = pal.rule === 'void' ? 96 : 84;
    for (let gy = Math.floor((y0 - 60) / step); gy < (y1 + 80) / step; gy++) for (let gx = Math.floor((x0 - 60) / step); gx < (x1 + 60) / step; gx++) {
      const x = gx * step + (hash(gx, gy, 51) - 0.5) * step * 0.9, y = gy * step + (hash(gx, gy, 52) - 0.5) * step * 0.9, f = macro(x, y, 7);
      if (f < (pal.rule === 'void' ? 0.58 : 0.5) || hash(gx, gy, 58) < 0.25 || nearWalk(p, x, y, 40, 40)) continue;
      if (pal.rule === 'marsh') { put(c, tuftStamp(gx % 3, '#5a7a3c'), x, y, 1.2 + f); continue; }
      const k = 0.5 + (f - 0.4) * 2.2 + hash(gx, gy, 53) * 0.4;
      put(c, rockStamp(pal.rockTone, Math.floor(hash(gx, gy, 54) * 4)), x, y, Math.min(2.2, k), hash(gx, gy, 55) > 0.5);
      if (pal.rule !== 'void' && hash(gx, gy, 56) > 0.5) put(c, pebbleStamp(gx % 3, pal.rockTone), x + 30, y + 12, 1.2);
      if (paint.biome === 'ridge' && f > 0.6) ellipse(c, x - 8, y - 18 * k, 22 * k, 6 * k, 'rgba(240,244,248,0.75)');
      if (pal.rule === 'ash' && hash(gx, gy, 57) > 0.8) line(c, [[x - 20, y + 6], [x + 14, y + 10]], 'rgba(255,110,40,0.6)', 1.4);
    }
  }
  yield;
  // 2. landscape
  for (const l of p.land) {
    if (!hits(l.b, 40)) continue;
    if (l.kind === 'water' || l.kind === 'deep') region(c, l.path, x0, y0, DENSITY, clip(l.b, 70), 6, (m, r) => waterFill(m, r, l.kind === 'deep', paint.biome === 'fen' ? '#2a4a40' : paint.biome === 'cistern' ? '#1e4a50' : '#24545e'));
    else region(c, l.path, x0, y0, DENSITY, clip(l.b, 40), l.kind === 'chasm' ? 4 : 10, (m, r) => {
      m.fillStyle = pattern(m, l.kind === 'lava' ? 'scorch' : l.kind === 'chasm' ? 'void' : l.kind === 'cliff' ? 'rockfield' : 'mud'); m.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      if (l.kind === 'lava') { m.save(); m.globalCompositeOperation = 'lighter'; for (let i = 0; i < 30; i++) { const x = r.x0 + hash(i, 1, r.x0) * (r.x1 - r.x0), y = r.y0 + hash(i, 2, r.y0) * (r.y1 - r.y0); ellipse(m, x, y, 26, 10, 'rgba(255,90,20,0.35)'); } m.restore(); }
      if (l.kind === 'reeds') for (let i = 0; i < ((r.x1 - r.x0) * (r.y1 - r.y0)) / 700; i++) put(m, tuftStamp(i % 3, '#6a7a40'), r.x0 + hash(i, 1, r.x0) * (r.x1 - r.x0), r.y0 + hash(i, 2, r.y0) * (r.y1 - r.y0), 1.4);
    });
    yield;
  }
  // 3. edges: rising faces (north) and drops (south), painted before the floor so floors overpaint overlaps
  for (const e of p.edges) {
    const north = e.ny > 0.45, south = e.ny < -0.45, pad = north ? pal.faceH[1] + 20 : 50;
    if (!hits(e.b, pad) || e.wet) continue;
    const len = Math.hypot(e.bx - e.ax, e.by - e.ay), n = Math.max(1, Math.round(len / 16));
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, xa = e.ax + (e.bx - e.ax) * t0, ya = e.ay + (e.by - e.ay) * t0, xb = e.ax + (e.bx - e.ax) * t1, yb = e.ay + (e.by - e.ay) * t1;
      if (north) {
        const ha = pal.faceH[0] + fbm(xa / 120, 3, 77) * (pal.faceH[1] - pal.faceH[0]), hb = pal.faceH[0] + fbm(xb / 120, 3, 77) * (pal.faceH[1] - pal.faceH[0]);
        const g = c.createLinearGradient(0, ya - ha, 0, ya); g.addColorStop(0, pal.face[0]); g.addColorStop(0.55, pal.face[1]); g.addColorStop(1, pal.face[2]);
        poly(c, [[xa, ya - ha], [xb + 0.6, yb - hb], [xb + 0.6, yb + 2], [xa, ya + 2]]); c.fillStyle = g; c.fill();
        if (pal.rule === 'void') { for (let row = 0; row * 22 < ha; row++) line(c, [[xa, ya - row * 22], [xb + 0.6, yb - row * 22]], 'rgba(10,10,12,0.45)', 1.2); if (i % 2 === 0) line(c, [[xa, ya - ha], [xa, ya]], 'rgba(10,10,12,0.35)', 1); }
        else if (pal.rule === 'canopy' || pal.rule === 'marsh') { if (hash(Math.round(xa), 9, 3) > 0.35) put(c, crownStamp(Math.round(xa) % 3), xa, ya - ha * 0.3, 0.55 + hash(Math.round(xa), 4, 5) * 0.25); }
        else { for (let k = 0; k < 4; k++) { const yy = ya - ha + (k + 0.4 + hash(Math.round(xa), k, 5) * 0.4) * ha / 4; line(c, [[xa, yy], [xb, yy + (hash(Math.round(xa), k, 6) - 0.5) * 4]], k % 2 ? 'rgba(20,24,24,0.4)' : 'rgba(255,245,230,0.12)', 1.5); } if (hash(Math.round(xa), 3, 9) > 0.55) ellipse(c, (xa + xb) / 2, ya - ha + 4, 9, 3.5, paint.biome === 'ridge' ? 'rgba(236,240,244,0.8)' : pal.rule === 'ash' ? 'rgba(90,80,74,0.8)' : 'rgba(84,110,60,0.75)'); }
      } else if (south) {
        const d = pal.rule === 'void' ? 34 : pal.rule === 'canopy' || pal.rule === 'marsh' ? 16 : 26;
        const g = c.createLinearGradient(0, ya - 2, 0, ya + d); g.addColorStop(0, pal.lip); g.addColorStop(1, rgba(pal.lip, 0.25));
        poly(c, [[xa, ya - 2], [xb + 0.6, yb - 2], [xb + 0.6, yb + d], [xa, ya + d]]); c.fillStyle = g; c.fill();
      }
    }
  }
  yield;
  // 4. walkable ground: base, regions and roads (soft edges), macro variation
  c.save(); c.clip(p.floorPath); c.fillStyle = pattern(c, pal.walk); c.fillRect(x0, y0, CHUNK, CHUNK); c.restore();
  yield;
  // Natural surfaces first, then macro variation, then paved surfaces (bridges, yards, floors stay clean of grass and snow).
  let painted = 0;
  const paved = (k: string) => k === 'planks' || (pal.rule !== 'void' && paint.biome !== 'ward' && (k === 'tile' || k === 'flag' || k === 'cobble' || k === 'stone'));
  for (const r of p.regions) {
    if (!hits(r.b, 30) || paved(r.kind)) continue;
    region(c, r.path, x0, y0, DENSITY, clip(r.b, 24), 10, (m, rr) => { m.fillStyle = pattern(m, r.kind); m.fillRect(rr.x0, rr.y0, rr.x1 - rr.x0, rr.y1 - rr.y0); });
    if (++painted % 4 === 0) yield;
  }
  yield;
  for (const o of pal.overlays) { overlay(c, p, o, x0, y0); yield; }
  for (const r of p.regions) {
    if (!hits(r.b, 30) || !paved(r.kind)) continue;
    region(c, r.path, x0, y0, DENSITY, clip(r.b, 24), r.kind === 'planks' || r.kind === 'tile' ? 3 : 8, (m, rr) => { m.fillStyle = pattern(m, r.kind); m.fillRect(rr.x0, rr.y0, rr.x1 - rr.x0, rr.y1 - rr.y0); });
    if (++painted % 4 === 0) yield;
  }
  // readable roads: worn halo, ruts with gaps, a grassy crown on dirt tracks, stones along the borders
  c.save(); c.clip(p.floorPath);
  for (const rd of p.roads) {
    if (!hits(rd.b, 20)) continue;
    const dirt = rd.kind === 'dirt' || rd.kind === 'mud' || rd.kind === 'gravel' || rd.kind === 'ash' || rd.kind === 'cinder' || rd.kind === 'salt' || rd.kind === 'slate' || rd.kind === 'moss';
    const trace = (off: number, col: string, w: number, dash?: number[]) => {
      c.beginPath(); rd.points.forEach(([x, y], i) => { const a2 = rd.points[Math.max(0, i - 1)], b2 = rd.points[Math.min(rd.points.length - 1, i + 1)], dx = b2[0] - a2[0], dy = b2[1] - a2[1], l = Math.hypot(dx, dy) || 1, px = x - (dy / l) * off, py = y + (dx / l) * off; if (i) c.lineTo(px, py); else c.moveTo(px, py); });
      c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.setLineDash(dash ?? []); c.stroke(); c.setLineDash([]);
    };
    trace(0, 'rgba(110,90,66,0.18)', rd.width * 1.5); trace(0, 'rgba(110,90,66,0.16)', rd.width * 1.22);
    if (dirt) { trace(-rd.width * 0.2, 'rgba(52,40,30,0.1)', 9); trace(rd.width * 0.2, 'rgba(52,40,30,0.1)', 9); trace(-rd.width * 0.2, 'rgba(52,40,30,0.2)', 4, [92, 26, 64, 34]); trace(rd.width * 0.2, 'rgba(52,40,30,0.2)', 4, [70, 30, 104, 22]); trace(0, 'rgba(90,120,60,0.2)', 8, [60, 50, 30, 70]); }
    else { trace(-rd.width * 0.46, 'rgba(30,24,22,0.5)', 3); trace(rd.width * 0.46, 'rgba(30,24,22,0.5)', 3); }
    for (let i = 1; i < rd.points.length; i++) {
      const [ax, ay] = rd.points[i - 1], [bx, by] = rd.points[i], l = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / (l || 1), ny = (bx - ax) / (l || 1);
      for (let t = 0; t < l; t += 22) {
        const x = ax + (bx - ax) * t / l, y = ay + (by - ay) * t / l; if (x < x0 - 60 || x > x1 + 60 || y < y0 - 60 || y > y1 + 60) continue;
        for (const s of [-1, 1]) { const h = hash(Math.round(x), Math.round(y), s + 9); if (h < 0.78) continue; const o = rd.width * (0.36 + hash(Math.round(y), Math.round(x), s + 3) * 0.3), j = (hash(Math.round(x), 7, s) - 0.5) * 16; put(c, h > 0.92 ? tuftStamp(Math.round(x) % 3, '#5a7a3c') : pebbleStamp(Math.round(y) % 3, pal.rockTone), x + nx * o * s + j, y + ny * o * s, 0.8 + h * 0.6); }
      }
    }
  }
  c.restore();
  yield;
  // 5. soft rims: a shadow strip beyond every dry edge, foam on wet edges, stones and tufts along the line; bridge rails
  for (const e of p.edges) {
    if (!hits(e.b, 40)) continue;
    const len = Math.hypot(e.bx - e.ax, e.by - e.ay), tx = (e.bx - e.ax) / (len || 1), ty = (e.by - e.ay) / (len || 1), ox = -e.nx, oy = -e.ny;
    if (e.wet) {
      for (let k = 0; k < len; k += 5) { const x = e.ax + tx * k, y = e.ay + ty * k, f = fbm(x / 46, y / 46, 61); if (f < 0.45) continue; const off = 3 + hash(Math.round(x), Math.round(y), 3) * 6; line(c, [[x + ox * off, y + oy * off], [x + ox * off + tx * (3 + f * 9), y + oy * off + ty * (3 + f * 9)]], `rgba(232,244,238,${Math.min(0.55, (f - 0.45) * 1.6)})`, 1.4); }
      continue;
    }
    const w = pal.rule === 'void' ? 26 : 20, g = c.createLinearGradient(e.ax, e.ay, e.ax + ox * w, e.ay + oy * w);
    g.addColorStop(0, 'rgba(10,12,12,0.42)'); g.addColorStop(1, 'rgba(10,12,12,0)');
    poly(c, [[e.ax, e.ay], [e.bx, e.by], [e.bx + ox * w, e.by + oy * w], [e.ax + ox * w, e.ay + oy * w]]); c.fillStyle = g; c.fill();
    for (let k = 6; k < len; k += 15) {
      const x = e.ax + tx * k, y = e.ay + ty * k, h = hash(Math.round(x * 3), Math.round(y * 3), 21); if (h < 0.7) continue;
      const inset = (hash(Math.round(y), Math.round(x), 22) - 0.4) * 30;
      if (pal.rule === 'canopy' || pal.rule === 'marsh') put(c, h > 0.8 ? tuftStamp(Math.round(x) % 3, '#46663a') : pebbleStamp(Math.round(y) % 3, '#6a665c'), x - ox * inset, y - oy * inset, 1 + h * 0.6);
      else put(c, pebbleStamp(Math.round(x) % 3, pal.rockTone), x - ox * inset, y - oy * inset, 1 + h * 0.8);
    }
  }
  for (const pth of a.paths) if (pth.bridge && pth.points.length > 1) {
    const [p0, p1] = [pth.points[0], pth.points[pth.points.length - 1]], len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), tx = (p1[0] - p0[0]) / len, ty = (p1[1] - p0[1]) / len, nx = -ty, ny = tx;
    if (!hits({ x0: Math.min(p0[0], p1[0]) - 150, y0: Math.min(p0[1], p1[1]) - 150, x1: Math.max(p0[0], p1[0]) + 150, y1: Math.max(p0[1], p1[1]) + 150 })) continue;
    for (const side of [-1, 1]) {
      const ox = nx * side * (pth.width / 2 - 8), oy = ny * side * (pth.width / 2 - 8);
      line(c, [[p0[0] + ox, p0[1] + oy + 4], [p1[0] + ox, p1[1] + oy + 4]], 'rgba(10,16,18,0.45)', 6);
      line(c, [[p0[0] + ox, p0[1] + oy - 14], [p1[0] + ox, p1[1] + oy - 14]], '#5a4030', 5); line(c, [[p0[0] + ox, p0[1] + oy - 16], [p1[0] + ox, p1[1] + oy - 16]], 'rgba(255,230,190,0.2)', 1.4);
      for (let k = 0; k <= len; k += 70) { const x = p0[0] + tx * k + ox, y = p0[1] + ty * k + oy; c.fillStyle = '#3a2c20'; c.fillRect(x - 4, y - 18, 8, 22); c.fillStyle = 'rgba(255,220,170,0.15)'; c.fillRect(x - 4, y - 18, 3, 22); }
    }
  }
  yield;
  // 6. flat decor (stamped), soft shadows (stamped), light pools, small stories
  let n6 = 0;
  for (const d of paint.decor) if (ZONE_FLAT.has(d.kind) && d.x > x0 - 90 && d.x < x1 + 90 && d.y > y0 - 50 && d.y < y1 + 50) { put(c, flatStamp(d.kind, d.v ?? 0, d.s ?? 1), d.x, d.y, 1, d.flip ?? false); if (++n6 % 60 === 0) yield; }
  const sh = shadowStamp(), shadow = (x: number, y: number, rx: number) => { if (x < x0 - 120 || x > x1 + 120 || y < y0 - 60 || y > y1 + 60 || rx <= 0) return; c.drawImage(sh.cv, x + rx * 0.12 - rx * 1.05, y + 4 - rx * 0.5, rx * 2.1, rx); };
  for (const s of a.scenery) shadow(s.x, s.y, zoneShadow(s.k, s.s) * s.s);
  for (const d of paint.decor) if (!ZONE_FLAT.has(d.kind)) shadow(d.x, d.y, zoneShadow(d.kind, d.s ?? 1) * (d.s ?? 1) * 0.8);
  for (const st of paint.structures ?? []) shadow(st.x + st.w * 0.12, st.y - st.d * 0.3, st.w * 0.7);
  yield;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const l of paint.lights) {
    const r = l.radius * 0.9; if (l.x + r < x0 || l.x - r > x1 || l.y + r < y0 || l.y - r > y1) continue;
    const g = c.createRadialGradient(l.x, l.y + 10, 4, l.x, l.y + 10, r), col = `${l.color >> 16 & 255},${l.color >> 8 & 255},${l.color & 255}`;
    g.addColorStop(0, `rgba(${col},0.22)`); g.addColorStop(0.35, `rgba(${col},0.09)`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(l.x - r, l.y + 10 - r, r * 2, r * 2);
  }
  c.restore();
}
function waterFill(c: Paint, r: { x0: number; y0: number; x1: number; y1: number }, deep: boolean, tint: string) {
  c.fillStyle = deep ? '#162f3e' : tint; c.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  for (let i = 0; i < 26; i++) { const x = r.x0 + hash(i, 1, r.x0 + 3) * (r.x1 - r.x0), y = r.y0 + hash(i, 2, r.y0 + 5) * (r.y1 - r.y0); ellipse(c, x, y, 40 + hash(i, 3, 7) * 60, 8 + hash(i, 4, 7) * 10, deep ? 'rgba(10,30,40,0.35)' : 'rgba(20,50,56,0.3)'); }
  for (let i = 0; i < 260; i++) {
    const x = r.x0 + hash(i, 31, r.x0 + 7) * (r.x1 - r.x0), y = r.y0 + hash(i, 32, r.y0 + 3) * (r.y1 - r.y0), s = fbm(x / 190, y / 30, 23);
    if (s < 0.55) continue;
    line(c, [[x, y], [x + 6 + hash(i, 33, 1) * 20, y]], `rgba(190,228,226,${Math.min(0.45, 0.05 + (s - 0.55) * 1.6)})`, 1.3);
  }
}

interface Job { key: string; x: number; y: number; canvas: HTMLCanvasElement; steps: Generator<void, void, void>; ms: number }

/** Lazy, bounded chunk layer: prefetch two chunks ahead, a few ms per frame, steps small enough to stay under budget. */
export class ZoneGround extends Container {
  bakeMs = 0; baked = 0; worstSlice = 0;
  private tiles = new Map<string, { sprite: Sprite; x: number; y: number; used: number }>();
  private matrix = new Matrix();
  private wanted: [number, number][] = [];
  private serial = 0;
  private job: Job | null = null;
  private prep: Prep;
  constructor(private a: AdventureData) {
    super();
    this.prep = prepare(a);
    const cx = Math.floor(a.geometry.entry.x / CHUNK), cy = Math.floor(a.geometry.entry.y / CHUNK);
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 2; x <= cx + 2; x++) if (x >= 0 && y >= 0) this.finish(this.start(x, y));
    const cols = Math.ceil(a.size[0] * 64 / CHUNK), rows = Math.ceil(a.size[1] * 64 / CHUNK);
    this.onRender = (r: Renderer) => {
      const m = this.getGlobalTransform(this.matrix, false), s = r.screen;
      const minX = Math.floor(-m.tx / m.a / CHUNK), minY = Math.floor(-m.ty / m.d / CHUNK);
      const maxX = Math.floor((s.width - m.tx) / m.a / CHUNK), maxY = Math.floor((s.height - m.ty) / m.d / CHUNK);
      this.serial++; this.wanted.length = 0;
      const cap = Math.max(MAX_CHUNKS, (maxX - minX + 5) * (maxY - minY + 5));
      const list: [number, number][] = [];
      for (let y = minY - 2; y <= maxY + 2; y++) for (let x = minX - 2; x <= maxX + 2; x++) if (x >= 0 && y >= 0 && x < cols && y < rows) list.push([x, y]);
      const mid = [(minX + maxX) / 2, (minY + maxY) / 2];
      const onScreen = (q: [number, number]) => q[0] >= minX && q[0] <= maxX && q[1] >= minY && q[1] <= maxY;
      list.sort((q, w) => (onScreen(q) ? 0 : 100) + Math.abs(q[0] - mid[0]) + Math.abs(q[1] - mid[1]) - ((onScreen(w) ? 0 : 100) + Math.abs(w[0] - mid[0]) + Math.abs(w[1] - mid[1])));
      for (const q of list) { const tile = this.tiles.get(`${q[0]},${q[1]}`); if (tile) tile.used = this.serial; else this.wanted.push(q); }
      for (const q of this.wanted) if (onScreen(q)) this.finish(this.job?.key === `${q[0]},${q[1]}` ? this.job : this.start(q[0], q[1]));
      for (const tile of this.tiles.values()) { const x = tile.x * m.a + m.tx, y = tile.y * m.d + m.ty; tile.sprite.visible = x < s.width && x + CHUNK * m.a > 0 && y < s.height && y + CHUNK * m.d > 0; }
      while (this.tiles.size > cap) if (!this.evict()) break;
      this.work(3);
    };
    this.on('destroyed', () => { this.job = null; this.tiles.clear(); });
  }
  private work(budget: number) {
    const began = performance.now();
    while (performance.now() - began < budget) {
      if (!this.job) { const next = this.wanted.find(([x, y]) => !this.tiles.has(`${x},${y}`)); if (!next) break; this.job = this.start(next[0], next[1]); }
      const t0 = performance.now(), done = this.job.steps.next().done;
      this.job.ms += performance.now() - t0;
      if (done) this.finish(this.job);
    }
    this.worstSlice = Math.max(this.worstSlice, performance.now() - began);
  }
  private start(col: number, row: number): Job {
    const x = col * CHUNK, y = row * CHUNK, canvas = document.createElement('canvas');
    canvas.width = canvas.height = CHUNK * DENSITY;
    const c = canvas.getContext('2d')!; c.setTransform(DENSITY, 0, 0, DENSITY, -x * DENSITY, -y * DENSITY);
    return { key: `${col},${row}`, x, y, canvas, steps: paintChunk(c, this.a, this.prep, x, y), ms: 0 };
  }
  private finish(job: Job) {
    if (this.job === job) this.job = null;
    if (this.tiles.has(job.key)) return;
    const t0 = performance.now(); while (!job.steps.next().done) { /* remaining steps */ } job.ms += performance.now() - t0;
    const texture = new Texture({ source: new CanvasSource({ resource: job.canvas, resolution: DENSITY, scaleMode: 'linear', autoGenerateMipmaps: true }) });
    const sprite = new Sprite(texture); sprite.position.set(job.x, job.y); this.addChild(sprite);
    this.tiles.set(job.key, { sprite, x: job.x, y: job.y, used: this.serial });
    sprite.on('destroyed', () => texture.destroy(true));
    this.bakeMs += job.ms; this.baked++;
  }
  private evict(): boolean {
    let oldest: string | undefined, age = Infinity;
    for (const [k, v] of this.tiles) if (!v.sprite.visible && v.used < age) { oldest = k; age = v.used; }
    if (!oldest) return false;
    this.tiles.get(oldest)!.sprite.destroy(); this.tiles.delete(oldest); return true;
  }
}
