// Painted zone ground (docs/rework/worlds/DESIGN.md §1): the town's chunk painter generalised by biome. Every pixel the
// camera can reach is painted — the biome's "beyond" (forest canopy, rock shelves, ash, salt crust, marsh, dark rock),
// water and reed beds, rising faces on north edges, drops on south edges, then the walkable ground and its decor.
import { CanvasSource, Container, Matrix, Sprite, Texture, type Renderer } from 'pixi.js';
import type { AdventureData, Biome } from '@shared/adventureTypes';
import type { Point } from '@shared/townTypes';
import { groundBoundary, groundTester, type Edge } from '@shared/townGeometry';
import {
  bounds, cobbles, dirt, ellipse, fbm, fillNoise, flagstones, grass, hash, inPoly, line, pathOf, planks, poly, region, sand, shadeField, strokePolygon,
  tone, wobble, type Paint, type Win,
} from './townKit';
import { paintFlat, zoneShadow, ZONE_FLAT } from './zoneArt';

const CHUNK = 512, DENSITY = 1.5, MAX_CHUNKS = 40;
type Rule = 'canopy' | 'rock' | 'ash' | 'marsh' | 'salt' | 'void';
interface Pal { beyond: string; rule: Rule; face: [string, string, string]; faceH: [number, number]; rim: string; lip: string; walk: string }
export const ZONE_PAL: Record<Biome, Pal> = {
  meadow: { beyond: '#22301e', rule: 'canopy', face: ['#33452c', '#263522', '#18221a'], faceH: [40, 70], rim: '#2a3a22', lip: '#3a3426', walk: 'grass' },
  sluice: { beyond: '#1f2e24', rule: 'canopy', face: ['#38463a', '#2a3830', '#1a2420'], faceH: [40, 70], rim: '#28362a', lip: '#3c3a30', walk: 'grass' },
  quarry: { beyond: '#4e4a42', rule: 'rock', face: ['#8a8478', '#6a655c', '#3e3a36'], faceH: [120, 200], rim: '#3e3a34', lip: '#4a443c', walk: 'gravel' },
  kiln: { beyond: '#2c2422', rule: 'ash', face: ['#5a4e48', '#3e3532', '#221c1a'], faceH: [90, 150], rim: '#241e1c', lip: '#2e2624', walk: 'ash' },
  fen: { beyond: '#1c2622', rule: 'marsh', face: ['#3a4434', '#2c3628', '#1a221c'], faceH: [24, 40], rim: '#232c22', lip: '#2a2a22', walk: 'mud' },
  salt: { beyond: '#b9b3a2', rule: 'salt', face: ['#d8d2c0', '#aaa391', '#7a7466'], faceH: [50, 90], rim: '#8a8474', lip: '#9a9482', walk: 'salt' },
  ridge: { beyond: '#4a5052', rule: 'rock', face: ['#8e9496', '#6a7072', '#3a3e40'], faceH: [130, 210], rim: '#3a3e40', lip: '#4a4e50', walk: 'slate' },
  ward: { beyond: '#3e3e3a', rule: 'rock', face: ['#8a8478', '#6a655c', '#3e3a36'], faceH: [100, 160], rim: '#34322e', lip: '#44403a', walk: 'cobble' },
  pump: { beyond: '#121414', rule: 'void', face: ['#5a5650', '#3e3c38', '#22201e'], faceH: [150, 190], rim: '#1a1918', lip: '#262422', walk: 'flag' },
  cistern: { beyond: '#0f1416', rule: 'void', face: ['#4e5a5c', '#36403f', '#1c2224'], faceH: [150, 190], rim: '#161c1e', lip: '#222a2c', walk: 'tile' },
  array: { beyond: '#121216', rule: 'void', face: ['#565a66', '#3c3f48', '#1e2026'], faceH: [150, 190], rim: '#18181c', lip: '#24242a', walk: 'slate' },
};
const MAT: Record<string, string> = {
  grass: '#4f6a3a', meadow: '#5c7442', dirt: '#6e5a44', mud: '#4c4232', flag: '#6c665c', cobble: '#76706a', planks: '#7a5c3e', stone: '#6a665d',
  moss: '#47583a', sand: '#a99472', ash: '#4a403c', cinder: '#3c322e', salt: '#cdc6b2', slate: '#59615f', gravel: '#7c756a', garden: '#3f5a30', tile: '#4c5a58',
};

interface Prep {
  pal: Pal; floorPath: Path2D; floors: Point[][];
  regions: { kind: string; path: Path2D; b: ReturnType<typeof bounds> }[];
  land: { kind: string; poly: Point[]; path: Path2D; b: ReturnType<typeof bounds> }[];
  water: Point[][]; edges: (Edge & { b: ReturnType<typeof bounds> })[];
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
  const land = paint.landscape.map((l, i) => { const p = l.kind === 'water' || l.kind === 'deep' ? l.polygon : wobble(l.polygon, 26, 10, 50 + i); return { kind: l.kind, poly: p, path: pathOf(p), b: bounds(p) }; });
  const water = paint.landscape.filter((l) => l.kind === 'water' || l.kind === 'deep').map((l) => l.polygon);
  const geo = { ...a.geometry, buildings: [] }, test = groundTester(geo);
  const edges = groundBoundary(geo).map((e) => ({ ...e, b: { x0: Math.min(e.ax, e.bx), y0: Math.min(e.ay, e.by), x1: Math.max(e.ax, e.bx), y1: Math.max(e.ay, e.by) } }));
  const gw = Math.ceil(a.size[0] * 64 / 32), gh = Math.ceil(a.size[1] * 64 / 32), walk = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) walk[y * gw + x] = test(x * 32 + 16, y * 32 + 16) ? 1 : 0;
  return { pal, floorPath, floors, regions, land, water, edges, walk, gw, gh };
}
function nearWalk(p: Prep, x: number, y: number, up: number, side = 80): boolean {
  for (let yy = y - up; yy <= y + 70; yy += 32) for (let xx = x - side; xx <= x + side; xx += 32) {
    const gx = Math.floor(xx / 32), gy = Math.floor(yy / 32);
    if (gx >= 0 && gy >= 0 && gx < p.gw && gy < p.gh && p.walk[gy * p.gw + gx]) return true;
  }
  return false;
}
function waterFill(c: Paint, w: Win, deep: boolean, tint: string) {
  shadeField(c, w, deep ? '#162f3e' : tint, 6, (x, y) => 1 + (fbm(x / 260, y / 260, 19) - 0.5) * 0.16 + (fbm(x / 190, y / 30, 23) - 0.5) * 0.24);
  for (let i = 0; i < 420; i++) {
    const x = w.x0 + hash(i, 31, w.x0 + 7) * (w.x1 - w.x0), y = w.y0 + hash(i, 32, w.y0 + 3) * (w.y1 - w.y0), s = fbm(x / 190, y / 30, 23);
    if (s < 0.55) continue;
    line(c, [[x, y], [x + 6 + hash(i, 33, 1) * 20, y]], `rgba(190,228,226,${Math.min(0.45, 0.05 + (s - 0.55) * 1.6)})`, 1.3);
  }
}
function crown(c: Paint, x: number, y: number, s: number, seed: number, kind: number) {
  const pine = kind === 1, dark = pine ? '#1d3424' : kind === 2 ? '#2e3a1c' : '#25381f', mid = pine ? '#2c4a30' : kind === 2 ? '#46562a' : '#36502a', lit = pine ? '#46684a' : kind === 2 ? '#6a7a3a' : '#55703c';
  ellipse(c, x + 14 * s, y + 4 * s, 34 * s, 12 * s, 'rgba(8,12,14,0.35)');
  if (pine) { for (let k = 0; k < 4; k++) { const w = (34 - k * 7) * s, yy = y - k * 22 * s; poly(c, [[x - w, yy], [x, yy - 34 * s], [x + w, yy]], k % 2 ? mid : dark, '#13201a', 2); poly(c, [[x - w * 0.7, yy - 4 * s], [x - 2 * s, yy - 30 * s], [x - w * 0.2, yy - 8 * s]], lit); } return; }
  const blobs = 5 + Math.floor(hash(seed, 1, 3) * 3);
  for (let k = 0; k < blobs; k++) { const a = k * 2.4 + seed, rr = (20 + hash(seed, k, 5) * 12) * s; ellipse(c, x + Math.cos(a) * 18 * s, y - 30 * s + Math.sin(a) * 12 * s, rr, rr * 0.82, dark, '#141e14', 2); }
  for (let k = 0; k < blobs; k++) { const a = k * 2.4 + seed, rr = (14 + hash(seed, k, 6) * 8) * s; ellipse(c, x + Math.cos(a) * 16 * s - 4 * s, y - 34 * s + Math.sin(a) * 10 * s, rr, rr * 0.8, mid); ellipse(c, x + Math.cos(a) * 16 * s - 8 * s, y - 38 * s + Math.sin(a) * 10 * s, rr * 0.5, rr * 0.4, lit); }
}
function walkMaterial(m: Paint, v: Win, kind: string, area: number, scatter: (i: number, s: number) => Point) {
  const base = MAT[kind] ?? '#6e5a44';
  switch (kind) {
    case 'cobble': cobbles(m, v, base, 51); break;
    case 'flag': flagstones(m, v, base, 52); break;
    case 'planks': planks(m, v, base, 53); break;
    case 'stone': flagstones(m, v, base, 54); break;
    case 'tile': flagstones(m, v, base, 64); break;
    case 'grass': grass(m, v, base, 55, 1.15); break;
    case 'meadow': grass(m, v, base, 65, 1.4); for (let i = 0; i < area / 2400; i++) { const [x, y] = scatter(i, 61); ellipse(m, x, y, 1.8, 1.5, ['#e8c35a', '#f2ecd8', '#d86a7a'][i % 3]); } break;
    case 'garden': grass(m, v, base, 56, 0.8); break;
    case 'moss': grass(m, v, base, 57, 0.6); break;
    case 'sand': sand(m, v, base, 58); break;
    case 'salt': sand(m, v, base, 68); for (let i = 0; i < area / 900; i++) { const [x, y] = scatter(i, 81); line(m, [[x - 7, y], [x, y - 3], [x + 6, y + 2]], 'rgba(120,112,96,0.35)', 0.9); } break;
    case 'slate': fillNoise(m, v, base, 0.22, 120, 69, 8); for (let i = 0; i < area / 700; i++) { const [x, y] = scatter(i, 82); poly(m, [[x - 9, y], [x - 3, y - 4], [x + 9, y - 2], [x + 4, y + 3]], tone(base, 0.8 + hash(i, 83, 1) * 0.4), 'rgba(20,24,26,0.25)', 0.8); } break;
    case 'gravel': fillNoise(m, v, base, 0.26, 90, 70, 8); for (let i = 0; i < area / 160; i++) { const [x, y] = scatter(i, 84); ellipse(m, x, y, 1.4 + hash(i, 85, 1) * 1.6, 1.1, tone(base, 0.7 + hash(i, 86, 1) * 0.6)); } break;
    case 'ash': case 'cinder': fillNoise(m, v, base, 0.3, 100, 71, 8); for (let i = 0; i < area / 260; i++) { const [x, y] = scatter(i, 87); ellipse(m, x, y, 1.6, 1.1, hash(i, 88, 1) > 0.94 ? '#c8642a' : tone(base, 0.65 + hash(i, 89, 1) * 0.5)); } break;
    case 'mud': dirt(m, v, base, 72); for (let i = 0; i < area / 3000; i++) { const [x, y] = scatter(i, 90); ellipse(m, x, y, 10 + hash(i, 91, 1) * 16, 4 + hash(i, 92, 1) * 5, 'rgba(30,40,40,0.35)'); } break;
    default:
      dirt(m, v, base, 59);
      for (let i = 0; i < area / 190; i++) {
        const [x, y] = scatter(i, 71), f = fbm(x / 170, y / 170, 73);
        if (f < 0.57) continue;
        line(m, [[x, y], [x - 1 + hash(i, 75, 1) * 2, y - 3 - hash(i, 74, 1) * 6]], tone('#55703c', 0.8 + hash(i, 76, 1) * 0.5), 1.3);
      }
  }
}

function* paintChunk(c: Paint, a: AdventureData, p: Prep, x0: number, y0: number): Generator<void, void, void> {
  const paint = a.paint!, pal = p.pal, w: Win = { x0, y0, x1: x0 + CHUNK, y1: y0 + CHUNK, seed: 7 };
  const hits = (b: { x0: number; y0: number; x1: number; y1: number }, pad = 0) => b.x1 >= x0 - pad && b.x0 <= x0 + CHUNK + pad && b.y1 >= y0 - pad && b.y0 <= y0 + CHUNK + pad;
  const clip = (b: ReturnType<typeof bounds>, pad: number) => ({ x0: Math.max(x0, b.x0 - pad), y0: Math.max(y0, b.y0 - pad), x1: Math.min(x0 + CHUNK, b.x1 + pad), y1: Math.min(y0 + CHUNK, b.y1 + pad) });
  const win = (r: { x0: number; y0: number; x1: number; y1: number }): Win => ({ ...r, seed: 7 });
  // 1. the beyond
  fillNoise(c, w, pal.beyond, 0.34, 160, 3, 10);
  const step = 74;
  if (pal.rule === 'canopy') {
    const crowns: [number, number, number, number][] = [];
    for (let gy = Math.floor((y0 - 120) / step); gy < (y0 + CHUNK + 160) / step; gy++) for (let gx = Math.floor((x0 - 80) / step); gx < (x0 + CHUNK + 80) / step; gx++) {
      const jx = gx * step + (hash(gx, gy, 41) - 0.5) * 50, jy = gy * step + (hash(gx, gy, 42) - 0.5) * 40;
      if (nearWalk(p, jx, jy, 230) || p.water.some((wp) => inPoly(jx, jy, wp))) continue;
      crowns.push([jx, jy, 0.8 + hash(gx, gy, 43) * 0.5, hash(gx, gy, 44) > 0.55 ? 1 : paint.biome === 'fen' && hash(gx, gy, 45) > 0.5 ? 2 : 0]);
    }
    crowns.sort((q, r) => q[1] - r[1]);
    for (const [x, y, s, k] of crowns) crown(c, x, y, s, Math.round(x * 7 + y), k);
  } else if (pal.rule === 'rock' || pal.rule === 'void') {
    const g = pal.rule === 'void' ? 96 : 120;
    for (let gy = Math.floor(y0 / g) - 1; gy < (y0 + CHUNK) / g + 1; gy++) for (let gx = Math.floor(x0 / g) - 1; gx < (x0 + CHUNK) / g + 1; gx++) {
      const x = gx * g + (gy % 2) * g * 0.5 + (hash(gx, gy, 51) - 0.5) * 30, y = gy * g + (hash(gx, gy, 52) - 0.5) * 20, k = hash(gx, gy, 53);
      const ww = g * (0.42 + k * 0.2), hh = g * (0.3 + hash(gx, gy, 54) * 0.12);
      const col = tone(pal.beyond, pal.rule === 'void' ? 0.85 + k * 0.4 : 0.8 + k * 0.45);
      poly(c, [[x - ww, y], [x - ww * 0.7, y - hh], [x + ww * 0.6, y - hh * 1.05], [x + ww, y - hh * 0.2], [x + ww * 0.8, y + hh * 0.35], [x - ww * 0.6, y + hh * 0.3]], col, 'rgba(10,10,12,0.4)', 1.4);
      line(c, [[x - ww * 0.6, y - hh * 0.75], [x + ww * 0.4, y - hh * 0.85]], 'rgba(255,240,220,0.08)', 1.4);
    }
  } else if (pal.rule === 'ash') {
    for (let i = 0; i < 160; i++) { const x = x0 + hash(i, 61, x0 + y0) * CHUNK, y = y0 + hash(i, 62, x0 - y0) * CHUNK; ellipse(c, x, y, 6 + hash(i, 63, 1) * 18, 3 + hash(i, 64, 1) * 6, tone(pal.beyond, 0.7 + hash(i, 65, 1) * 0.6)); if (hash(i, 66, 1) > 0.9) line(c, [[x - 10, y], [x + 8, y + 2]], 'rgba(255,110,40,0.55)', 1.3); }
  } else if (pal.rule === 'marsh') {
    shadeField(c, w, '#1e3430', 8, (x, y) => 1 + (fbm(x / 200, y / 200, 29) - 0.5) * 0.4);
    for (let i = 0; i < 120; i++) { const x = x0 + hash(i, 71, x0 + y0) * CHUNK, y = y0 + hash(i, 72, x0 - y0) * CHUNK; if (fbm(x / 160, y / 160, 31) > 0.52) ellipse(c, x, y, 14 + hash(i, 73, 1) * 24, 6 + hash(i, 74, 1) * 8, '#2e3a2a'); else if (hash(i, 75, 1) > 0.6) for (let k = 0; k < 5; k++) line(c, [[x + k * 3, y], [x + k * 3 + (hash(k, i, 3) - 0.5) * 4, y - 12 - hash(k, i, 4) * 10]], k % 2 ? '#4a6a34' : '#6a7a40', 1.3); }
  } else if (pal.rule === 'salt') {
    for (let gy = Math.floor(y0 / 60) - 1; gy < (y0 + CHUNK) / 60 + 1; gy++) for (let gx = Math.floor(x0 / 80) - 1; gx < (x0 + CHUNK) / 80 + 1; gx++) {
      const x = gx * 80 + (gy % 2) * 40 + (hash(gx, gy, 81) - 0.5) * 20, y = gy * 60 + (hash(gx, gy, 82) - 0.5) * 14;
      poly(c, [[x - 36, y], [x - 20, y - 22], [x + 24, y - 24], [x + 38, y - 4], [x + 22, y + 18], [x - 26, y + 16]], tone(pal.beyond, 0.92 + hash(gx, gy, 83) * 0.16), 'rgba(120,110,96,0.45)', 1.2);
    }
  }
  yield;
  // 2. landscape
  for (const l of p.land) {
    if (!hits(l.b, 40)) continue;
    if (l.kind === 'water' || l.kind === 'deep') region(c, l.path, x0, y0, DENSITY, clip(l.b, 70), 6, (m, r) => waterFill(m, win(r), l.kind === 'deep', paint.biome === 'fen' ? '#2a4a40' : paint.biome === 'cistern' ? '#1e4a50' : '#24545e'));
    else if (l.kind === 'reeds' || l.kind === 'mud') region(c, l.path, x0, y0, DENSITY, clip(l.b, 40), 10, (m, r) => {
      fillNoise(m, win(r), '#3a3a2a', 0.3, 100, 33, 8);
      if (l.kind === 'reeds') for (let i = 0; i < ((r.x1 - r.x0) * (r.y1 - r.y0)) / 120; i++) { const x = r.x0 + hash(i, 1, r.x0) * (r.x1 - r.x0), y = r.y0 + hash(i, 2, r.y0) * (r.y1 - r.y0), h = 12 + hash(i, 3, 5) * 20; line(m, [[x, y], [x + (hash(i, 4, 5) - 0.5) * 5, y - h]], i % 3 ? '#4a6a34' : '#8a8a4a', 1.4); }
    });
    else if (l.kind === 'lava') region(c, l.path, x0, y0, DENSITY, clip(l.b, 40), 6, (m, r) => { shadeField(m, win(r), '#a8401a', 8, (x, y) => 0.8 + fbm(x / 90, y / 90, 41) * 0.6); });
    else if (l.kind === 'chasm') region(c, l.path, x0, y0, DENSITY, clip(l.b, 40), 4, (m, r) => { fillNoise(m, win(r), '#08090b', 0.2, 80, 43, 8); });
    else if (l.kind === 'cliff') region(c, l.path, x0, y0, DENSITY, clip(l.b, 40), 8, (m, r) => { fillNoise(m, win(r), tone(pal.beyond, 1.1), 0.3, 90, 44, 8); });
    yield;
  }
  // 3. edges: rising faces on north edges, drops on south edges (painted before the floor so floors overpaint overlaps)
  for (const e of p.edges) {
    const north = e.ny > 0.45, south = e.ny < -0.45, pad = north ? pal.faceH[1] + 20 : 50;
    if (!hits(e.b, pad)) continue;
    const len = Math.hypot(e.bx - e.ax, e.by - e.ay), n = Math.max(1, Math.round(len / 16));
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, xa = e.ax + (e.bx - e.ax) * t0, ya = e.ay + (e.by - e.ay) * t0, xb = e.ax + (e.bx - e.ax) * t1, yb = e.ay + (e.by - e.ay) * t1;
      const overWater = p.water.some((wp) => inPoly((xa + xb) / 2 - e.nx * 14, (ya + yb) / 2 - e.ny * 14, wp));
      if (north && !overWater) {
        const ha = pal.faceH[0] + fbm(xa / 120, 3, 77) * (pal.faceH[1] - pal.faceH[0]), hb = pal.faceH[0] + fbm(xb / 120, 3, 77) * (pal.faceH[1] - pal.faceH[0]);
        const g = c.createLinearGradient(0, ya - ha, 0, ya); g.addColorStop(0, pal.face[0]); g.addColorStop(0.55, pal.face[1]); g.addColorStop(1, pal.face[2]);
        poly(c, [[xa, ya - ha], [xb + 0.6, yb - hb], [xb + 0.6, yb + 2], [xa, ya + 2]]); c.fillStyle = g; c.fill();
        if (pal.rule === 'void') { for (let row = 0; row * 22 < ha; row++) line(c, [[xa, ya - row * 22], [xb + 0.6, yb - row * 22]], 'rgba(10,10,12,0.45)', 1.2); if (i % 2 === 0) line(c, [[xa, ya - ha], [xa, ya]], 'rgba(10,10,12,0.35)', 1); }
        else if (pal.rule === 'rock' || pal.rule === 'ash' || pal.rule === 'salt') { for (let k = 0; k < 5; k++) { const yy = ya - ha + (k + 0.4 + hash(Math.round(xa), k, 5) * 0.4) * ha / 5; line(c, [[xa, yy], [xb, yy + (hash(Math.round(xa), k, 6) - 0.5) * 4]], k % 2 ? 'rgba(20,24,24,0.4)' : 'rgba(255,245,230,0.12)', 1.5); } }
        else { for (let k = 0; k < 3; k++) if (hash(Math.round(xa), k, 9) > 0.5) line(c, [[xa + 4, ya - ha * (0.2 + k * 0.25)], [xa + 9, ya - ha * (0.1 + k * 0.25)]], 'rgba(60,44,30,0.6)', 1.6); }
        if (hash(Math.round(xa), 3, 9) > (pal.rule === 'void' ? 0.8 : 0.45)) ellipse(c, (xa + xb) / 2, ya - ha + 4, 9, 3.5, pal.rule === 'void' ? 'rgba(80,90,80,0.45)' : 'rgba(84,110,60,0.75)');
      } else if (south && !overWater) {
        const d = pal.rule === 'void' ? 34 : pal.rule === 'canopy' || pal.rule === 'marsh' ? 18 : 28;
        poly(c, [[xa, ya - 2], [xb + 0.6, yb - 2], [xb + 0.6, yb + d], [xa, ya + d]], pal.lip);
        line(c, [[xa, ya + d], [xb + 0.6, yb + d]], 'rgba(8,8,10,0.55)', 3);
      }
    }
  }
  yield;
  // 4. walkable ground: biome base over the whole floor union, then regions and roads (soft edges, data order)
  c.save(); c.clip(p.floorPath); walkMaterial(c, w, pal.walk, CHUNK * CHUNK, (i, s) => [x0 + hash(i, s, x0 + 5) * CHUNK, y0 + hash(i, s + 1, y0 + 9) * CHUNK]); c.restore();
  yield;
  for (const r of p.regions) {
    if (!hits(r.b, 30)) continue;
    region(c, r.path, x0, y0, DENSITY, clip(r.b, 24), r.kind === 'planks' || r.kind === 'tile' ? 3 : 9, (m, rr) => {
      const area = (rr.x1 - rr.x0) * (rr.y1 - rr.y0);
      walkMaterial(m, win(rr), r.kind, area, (i, s) => [rr.x0 + hash(i, s, rr.x0 + 5) * (rr.x1 - rr.x0), rr.y0 + hash(i, s + 1, rr.y0 + 9) * (rr.y1 - rr.y0)]);
    });
    yield;
  }
  // 5. rims: thin dark outline on every edge, foam where the bank meets water; bridge rails
  for (const e of p.edges) {
    if (!hits(e.b, 30)) continue;
    const overWater = p.water.some((wp) => inPoly((e.ax + e.bx) / 2 - e.nx * 14, (e.ay + e.by) / 2 - e.ny * 14, wp));
    line(c, [[e.ax, e.ay], [e.bx, e.by]], overWater ? 'rgba(20,30,30,0.55)' : pal.rim, overWater ? 4 : 5);
    line(c, [[e.ax + e.nx * 3, e.ay + e.ny * 3], [e.bx + e.nx * 3, e.by + e.ny * 3]], 'rgba(255,240,215,0.12)', 1.6);
    if (overWater) {
      const len = Math.hypot(e.bx - e.ax, e.by - e.ay), tx = (e.bx - e.ax) / (len || 1), ty = (e.by - e.ay) / (len || 1);
      for (let k = 0; k < len; k += 5) { const x = e.ax + tx * k, y = e.ay + ty * k, f = fbm(x / 46, y / 46, 61); if (f < 0.45) continue; const off = 3 + hash(Math.round(x), Math.round(y), 3) * 6; line(c, [[x - e.nx * off, y - e.ny * off], [x - e.nx * off + tx * (3 + f * 9), y - e.ny * off + ty * (3 + f * 9)]], `rgba(232,244,238,${Math.min(0.55, (f - 0.45) * 1.6)})`, 1.4); }
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
  // 6. flat decor, shadows, light pools, small stories
  for (const d of paint.decor) if (ZONE_FLAT.has(d.kind) && d.x > x0 - 120 && d.x < x0 + CHUNK + 120 && d.y > y0 - 80 && d.y < y0 + CHUNK + 80) paintFlat(c, d.kind, d.x, d.y, d.s ?? 1, d.v ?? 0);
  const shadow = (x: number, y: number, rx: number, h: number) => {
    if (x < x0 - 160 || x > x0 + CHUNK + 160 || y < y0 - 80 || y > y0 + CHUNK + 80 || rx <= 0) return;
    c.save(); c.globalAlpha = 0.3; c.filter = 'blur(3px)'; ellipse(c, x + h * 0.14, y + 4, rx + h * 0.1, rx * 0.45 + 2, '#0c1216'); c.restore();
  };
  for (const s of a.scenery) shadow(s.x, s.y, zoneShadow(s.k, s.s) * s.s, 60);
  for (const d of paint.decor) if (!ZONE_FLAT.has(d.kind)) shadow(d.x, d.y, zoneShadow(d.kind, d.s ?? 1) * (d.s ?? 1) * 0.8, 50);
  for (const b of a.geometry.buildings) { const bb = bounds(b.footprint); if (!hits(bb, 120)) continue; c.save(); c.globalAlpha = 0.32; c.filter = 'blur(6px)'; poly(c, b.footprint.map(([x, y]) => [x + 14, y + 10] as Point), '#0c1218'); c.restore(); }
  yield;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const l of paint.lights) {
    const r = l.radius * 0.9; if (l.x + r < x0 || l.x - r > x0 + CHUNK || l.y + r < y0 || l.y - r > y0 + CHUNK) continue;
    const g = c.createRadialGradient(l.x, l.y + 10, 4, l.x, l.y + 10, r), col = `${l.color >> 16 & 255},${l.color >> 8 & 255},${l.color & 255}`;
    g.addColorStop(0, `rgba(${col},0.22)`); g.addColorStop(0.35, `rgba(${col},0.09)`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(l.x - r, l.y + 10 - r, r * 2, r * 2);
  }
  c.restore();
  for (let i = 0; i < 50; i++) {
    const x = x0 + hash(i, 91, x0 + y0) * CHUNK, y = y0 + hash(i, 92, x0 - y0) * CHUNK, gx = Math.floor(x / 32), gy = Math.floor(y / 32);
    if (!p.walk[gy * p.gw + gx]) continue;
    const k = hash(i, 93, 1);
    if (k < 0.05) { ellipse(c, x, y, 12 + k * 90, 4 + k * 30, 'rgba(40,62,72,0.45)'); ellipse(c, x - 3, y - 1, 8 + k * 40, 2.2, 'rgba(160,190,200,0.22)'); }
    else if (pal.rule !== 'void') poly(c, [[x - 2, y], [x, y - 2], [x + 4, y + 1], [x + 1, y + 3]], k > 0.55 ? '#8a6a3a' : '#6d6a40');
  }
}

interface Job { key: string; x: number; y: number; canvas: HTMLCanvasElement; steps: Generator<void, void, void>; ms: number }

/** Lazy, bounded chunk layer (same scheduling as the town's: prefetch two chunks ahead, a few ms per frame). */
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
      const cap = Math.max(MAX_CHUNKS, (maxX - minX + 3) * (maxY - minY + 3));
      const list: [number, number][] = [];
      for (let y = minY - 1; y <= maxY + 1; y++) for (let x = minX - 2; x <= maxX + 2; x++) if (x >= 0 && y >= 0 && x < cols && y < rows) list.push([x, y]);
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
