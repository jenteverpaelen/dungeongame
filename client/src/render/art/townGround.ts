// Hearthmere ground (docs/rework/DESIGN.md §4): every pixel the camera can reach is painted — escarpment and forest
// to the north, lake and canal to the south and west — so the town never floats in a void. Baked lazily in 512 u
// chunks around the camera (bounded cache), painted outside the render callback.
import { CanvasSource, Container, Matrix, Sprite, Texture, type Renderer } from 'pixi.js';
import type { Point, TownData } from '@shared/townTypes';
import { inGround } from '@shared/townGeometry';
import {
  bounds, cobbles, dirt, ellipse, fbm, fillNoise, flagstones, grass, hash, inPoly, line, pathOf, planks, poly, region, sand, shadeField, strokePolygon,
  tone, wobble, type Paint, type Win,
} from './townKit';
import { decorShadow, FLAT_DECOR, paintGroundDecor } from './townScenery';

const CHUNK = 512, DENSITY = 1.5, MAX_CHUNKS = 40;

const MAT: Record<string, string> = {
  cobble: '#8d8274', flag: '#8f8574', dirt: '#6e5a44', grass: '#4f6a3a', sand: '#a99472', planks: '#7a5c3e', garden: '#3f5a30', moss: '#47583a', stone: '#8a8478',
};

interface Prep {
  regions: { kind: string; poly: Point[]; path: Path2D; b: ReturnType<typeof bounds> }[];
  land: { kind: string; poly: Point[]; path: Path2D; b: ReturnType<typeof bounds> }[];
  cliffBase: [Point, Point][];
  shores: { a: Point; b: Point; nx: number; ny: number; id: string }[];
  walk: Uint8Array; gw: number; gh: number;
  water: Point[][];
  waterPath: Path2D;
}

/** Lake and canal water: fine value noise with long horizontal swells, glints on the crests. */
function waterFill(c: Paint, w: Win, deep: boolean) {
  shadeField(c, w, deep ? '#162f3e' : '#24545e', 6, (x, y) => 1 + (fbm(x / 260, y / 260, 19) - 0.5) * 0.16 + (fbm(x / 190, y / 30, 23) - 0.5) * 0.24);
  for (let i = 0; i < 520; i++) {
    const x = w.x0 + hash(i, 31, w.x0 + 7) * (w.x1 - w.x0), y = w.y0 + hash(i, 32, w.y0 + 3) * (w.y1 - w.y0), s = fbm(x / 190, y / 30, 23);
    if (s < 0.54) continue;
    line(c, [[x, y], [x + 6 + hash(i, 33, 1) * 20, y]], `rgba(${deep ? '150,190,215' : '190,228,226'},${Math.min(0.5, 0.06 + (s - 0.54) * 1.7)})`, 1.3);
  }
}

function prepare(t: TownData): Prep {
  const land = (t.landscape ?? []).map((l, i) => {
    const poly = l.kind === 'water' || l.kind === 'deep' ? l.polygon : wobble(l.polygon, 26, 10, 50 + i);
    return { kind: l.kind, poly, path: pathOf(poly), b: bounds(poly) };
  });
  const regions = (t.ground ?? []).map((g, i) => {
    const base = g.polygon ?? strokePolygon(g.path!, g.width!);
    const poly = g.kind === 'planks' || g.kind === 'stone' ? base : wobble(base, 18, g.kind === 'flag' ? 6 : 9, 90 + i);
    return { kind: g.kind, poly, path: pathOf(poly), b: bounds(poly) };
  });
  // cliff base: south-facing edges of the escarpment polygon
  const cliffBase: [Point, Point][] = [];
  for (const l of t.landscape ?? []) if (l.kind === 'cliff') {
    const p = l.polygon;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      if (Math.abs(b[0] - a[0]) < 2) continue;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (my > 900 && !inPoly(mx, my + 12, p) && inPoly(mx, my - 12, p)) cliffBase.push([a, b]);
    }
  }
  const water = (t.landscape ?? []).filter((l) => l.kind === 'water').map((l) => l.polygon);
  // shore: floor edges with water directly beyond
  const shores: Prep['shores'] = [];
  for (const f of t.floors) {
    const p = f.polygon;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 4) continue;
      let nx = (b[1] - a[1]) / len, ny = -(b[0] - a[0]) / len;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (inGround(t, mx + nx * 10, my + ny * 10)) { nx = -nx; ny = -ny; }
      if (inGround(t, mx + nx * 10, my + ny * 10)) continue;
      if (water.some((w) => inPoly(mx + nx * 16, my + ny * 16, w))) shores.push({ a, b, nx, ny, id: f.id });
    }
  }
  const gw = Math.ceil(t.size[0] * 64 / 32), gh = Math.ceil(t.size[1] * 64 / 32), walk = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) walk[y * gw + x] = inGround(t, x * 32 + 16, y * 32 + 16) ? 1 : 0;
  const waterPath = new Path2D();
  for (const w of water) waterPath.addPath(pathOf(w));
  return { regions, land, cliffBase, shores, walk, gw, gh, water, waterPath };
}

/** True when a tall canopy at (x, y) would overlap walkable ground on screen (then it must be a sorted sprite). */
function nearWalk(p: Prep, x: number, y: number, up: number): boolean {
  for (let yy = y - up; yy <= y + 70; yy += 32) for (let xx = x - 80; xx <= x + 80; xx += 32) {
    const gx = Math.floor(xx / 32), gy = Math.floor(yy / 32);
    if (gx >= 0 && gy >= 0 && gx < p.gw && gy < p.gh && p.walk[gy * p.gw + gx]) return true;
  }
  return false;
}

// ─────────────────────────── chunk painter ───────────────────────────

function treeCrown(c: Paint, x: number, y: number, s: number, seed: number, pine: boolean) {
  const dark = pine ? '#1d3424' : '#25381f', mid = pine ? '#2c4a30' : '#36502a', lit = pine ? '#46684a' : '#55703c';
  ellipse(c, x + 14 * s, y + 4 * s, 34 * s, 12 * s, 'rgba(8,12,14,0.35)');
  if (pine) {
    for (let k = 0; k < 4; k++) {
      const w = (34 - k * 7) * s, yy = y - k * 22 * s;
      poly(c, [[x - w, yy], [x, yy - 34 * s], [x + w, yy]], k % 2 ? mid : dark, '#13201a', 2);
      poly(c, [[x - w * 0.7, yy - 4 * s], [x - 2 * s, yy - 30 * s], [x - w * 0.2, yy - 8 * s]], lit);
    }
    return;
  }
  const blobs = 5 + Math.floor(hash(seed, 1, 3) * 3);
  for (let k = 0; k < blobs; k++) {
    const a = k * 2.4 + seed, rr = (20 + hash(seed, k, 5) * 12) * s;
    ellipse(c, x + Math.cos(a) * 18 * s, y - 30 * s + Math.sin(a) * 12 * s, rr, rr * 0.82, dark, '#141e14', 2);
  }
  for (let k = 0; k < blobs; k++) {
    const a = k * 2.4 + seed, rr = (14 + hash(seed, k, 6) * 8) * s;
    ellipse(c, x + Math.cos(a) * 16 * s - 4 * s, y - 34 * s + Math.sin(a) * 10 * s, rr, rr * 0.8, mid);
    ellipse(c, x + Math.cos(a) * 16 * s - 8 * s, y - 38 * s + Math.sin(a) * 10 * s, rr * 0.5, rr * 0.4, lit);
  }
}

/** Paints one chunk in steps (yield = a safe point to pause), so prefetching can be spread over several frames. */
function* paintChunk(c: Paint, t: TownData, p: Prep, x0: number, y0: number): Generator<void, void, void> {
  const w: Win = { x0, y0, x1: x0 + CHUNK, y1: y0 + CHUNK, seed: 7 };
  const hits = (b: ReturnType<typeof bounds>, pad = 0) => b.x1 >= x0 - pad && b.x0 <= x0 + CHUNK + pad && b.y1 >= y0 - pad && b.y0 <= y0 + CHUNK + pad;
  const clip = (b: ReturnType<typeof bounds>, pad: number) => ({ x0: Math.max(x0, b.x0 - pad), y0: Math.max(y0, b.y0 - pad), x1: Math.min(x0 + CHUNK, b.x1 + pad), y1: Math.min(y0 + CHUNK, b.y1 + pad) });
  const win = (r: { x0: number; y0: number; x1: number; y1: number }): Win => ({ ...r, seed: 7 });
  // 1. base: forest floor
  fillNoise(c, w, '#26321f', 0.34, 160, 3, 10);
  yield;
  // 2. landscape
  for (const l of p.land) {
    if (!hits(l.b, 40)) continue;
    if (l.kind === 'water' || l.kind === 'deep') {
      region(c, l.path, x0, y0, DENSITY, clip(l.b, 70), l.kind === 'deep' ? 64 : 6, (m, r) => waterFill(m, win(r), l.kind === 'deep'));
    } else if (l.kind === 'cliff' || l.kind === 'woods') {
      region(c, l.path, x0, y0, DENSITY, clip(l.b, 40), 8, (m, r) => {
        fillNoise(m, win(r), l.kind === 'cliff' ? '#2c3a28' : '#22301e', 0.36, 120, 13, 10);
        const step = 74, crowns: [number, number, number, boolean][] = [];
        for (let gy = Math.floor((y0 - 120) / step); gy < (y0 + CHUNK + 160) / step; gy++) for (let gx = Math.floor((x0 - 80) / step); gx < (x0 + CHUNK + 80) / step; gx++) {
          const jx = gx * step + (hash(gx, gy, 41) - 0.5) * 50, jy = gy * step + (hash(gx, gy, 42) - 0.5) * 40;
          if (!inPoly(jx, jy, l.poly) || nearWalk(p, jx, jy, 240)) continue;
          crowns.push([jx, jy, 0.8 + hash(gx, gy, 43) * 0.5, hash(gx, gy, 44) > 0.55]);
        }
        crowns.sort((a, b) => a[1] - b[1]);
        for (const [x, y, s, pine] of crowns) treeCrown(m, x, y, s, Math.round(x * 7 + y), pine);
      });
    }
    yield;
  }
  // 3. escarpment face along the cliff base (rock strata, darker at the foot, moss on ledges)
  for (const [a, b] of p.cliffBase) {
    if (Math.max(a[0], b[0]) < x0 - 40 || Math.min(a[0], b[0]) > x0 + CHUNK + 40) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 18));
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, xa = a[0] + (b[0] - a[0]) * t0, ya = a[1] + (b[1] - a[1]) * t0, xb = a[0] + (b[0] - a[0]) * t1, yb = a[1] + (b[1] - a[1]) * t1;
      const ha = 190 + fbm(xa / 120, 3, 77) * 120, hb = 190 + fbm(xb / 120, 3, 77) * 120;
      if (ya - ha > y0 + CHUNK || ya < y0 - 40) continue;
      const g = c.createLinearGradient(0, ya - ha, 0, ya);
      g.addColorStop(0, '#5f6a6c'); g.addColorStop(0.55, '#46514f'); g.addColorStop(1, '#2a302e');
      poly(c, [[xa, ya - ha], [xb + 0.6, yb - hb], [xb + 0.6, yb], [xa, ya]], undefined);
      c.fillStyle = g; c.fill();
    }
    // strata and cracks
    for (let s = 0; s < len; s += 14) {
      const x = a[0] + (b[0] - a[0]) * s / len, y = a[1] + (b[1] - a[1]) * s / len, h = 190 + fbm(x / 120, 3, 77) * 120;
      if (x < x0 - 20 || x > x0 + CHUNK + 20) continue;
      for (let k = 0; k < 6; k++) {
        const yy = y - h + (k + 0.4 + hash(Math.round(x), k, 5) * 0.4) * h / 6;
        line(c, [[x, yy], [x + 15, yy + (hash(Math.round(x), k, 6) - 0.5) * 4]], k % 2 ? 'rgba(20,24,24,0.45)' : 'rgba(150,160,150,0.18)', 1.6);
      }
      if (hash(Math.round(x), 2, 9) > 0.7) line(c, [[x + 4, y - h * 0.9], [x + 2, y - h * 0.55], [x + 7, y - h * 0.2]], 'rgba(14,16,18,0.55)', 1.4);
      if (hash(Math.round(x), 3, 9) > 0.5) ellipse(c, x + 6, y - h + 6, 10, 4, 'rgba(84,110,60,0.75)');
      if (hash(Math.round(x), 4, 9) > 0.75) ellipse(c, x + 8, y - h * 0.5, 7, 3, 'rgba(70,96,52,0.55)');
    }
    line(c, [a, b], 'rgba(14,16,14,0.7)', 3);
  }
  yield;
  // 4. ground materials (soft-edged, data order), each painted only inside its own bounds
  for (const r of p.regions) {
    if (!hits(r.b, 30)) continue;
    const base = MAT[r.kind] ?? '#6e5a44';
    region(c, r.path, x0, y0, DENSITY, clip(r.b, 24), r.kind === 'planks' || r.kind === 'stone' ? 3 : 7, (m, rr) => {
      const v = win(rr), area = (rr.x1 - rr.x0) * (rr.y1 - rr.y0);
      const scatter = (i: number, s: number): Point => [rr.x0 + hash(i, s, rr.x0 + 5) * (rr.x1 - rr.x0), rr.y0 + hash(i, s + 1, rr.y0 + 9) * (rr.y1 - rr.y0)];
      switch (r.kind) {
        case 'cobble': cobbles(m, v, base, 51); break;
        case 'flag': flagstones(m, v, base, 52); break;
        case 'planks': planks(m, v, base, 53); break;
        case 'stone': flagstones(m, v, base, 54); break;
        case 'grass': grass(m, v, base, 55, 1.2); break;
        case 'garden': grass(m, v, base, 56, 0.8); for (let i = 0; i < area / 1600; i++) { const [x, y] = scatter(i, 61); ellipse(m, x, y, 2.4, 2, ['#e8c35a', '#d86a7a', '#f2ecd8', '#9a7ad8'][i % 4]); } break;
        case 'moss': grass(m, v, base, 57, 0.6); break;
        case 'sand': sand(m, v, base, 58); break;
        default:
          dirt(m, v, base, 59);
          // clumps of grass and moss where feet rarely go (noise-clustered, so the clumps continue across chunks)
          for (let i = 0; i < area / 190; i++) {
            const [x, y] = scatter(i, 71), f = fbm(x / 170, y / 170, 73);
            if (f < 0.57) continue;
            if (i % 9 === 0) ellipse(m, x, y, 10 + f * 16, 5 + f * 7, 'rgba(70,96,52,0.28)');
            line(m, [[x, y], [x - 1 + hash(i, 75, 1) * 2, y - 3 - hash(i, 74, 1) * 6]], tone('#55703c', 0.8 + hash(i, 76, 1) * 0.5), 1.3);
          }
      }
    });
    yield;
  }
  // 5. square ornament: a ring of darker setts around the waypoint
  const wp = t.npcs.find((n) => n.role === 'waypoint');
  if (wp && Math.abs(wp.x - x0 - CHUNK / 2) < CHUNK && Math.abs(wp.y - y0 - CHUNK / 2) < CHUNK) {
    for (const [rx, a] of [[150, 0.5], [118, 0.35]] as const) { ellipse(c, wp.x, wp.y, rx, rx * 0.72, undefined, `rgba(40,32,30,${a})`, 6); ellipse(c, wp.x, wp.y - 1.5, rx, rx * 0.72, undefined, 'rgba(230,214,180,0.16)', 1.4); }
    for (let i = 0; i < 16; i++) { const an = i * Math.PI / 8; line(c, [[wp.x + Math.cos(an) * 118, wp.y + Math.sin(an) * 85], [wp.x + Math.cos(an) * 150, wp.y + Math.sin(an) * 108]], 'rgba(40,32,30,0.45)', 3); }
  }
  // 6. water edges. South-facing built edges show a stone face dropping to the waterline (the bridge gets an arch);
  // built edges get a dressed-stone curb; the grove bank stays natural; the breakwater is armoured with boulders.
  // Everything below the edge is clipped to the water so floors that overlap (bridge ends) stay clean.
  for (const s of p.shores) {
    if (Math.max(s.a[0], s.b[0]) < x0 - 60 || Math.min(s.a[0], s.b[0]) > x0 + CHUNK + 60 || Math.max(s.a[1], s.b[1]) < y0 - 80 || Math.min(s.a[1], s.b[1]) > y0 + CHUNK + 80) continue;
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), tx = (s.b[0] - s.a[0]) / len, ty = (s.b[1] - s.a[1]) / len;
    const south = s.ny > 0.5, rocky = s.id === 'breakwater', natural = s.id === 'grove', wooden = s.id === 'pier';
    const drop = south && !natural ? (s.id === 'bridge' ? 46 : 26) : 0;
    const at = (k: number): Point => [s.a[0] + tx * k, s.a[1] + ty * k];
    c.save(); c.clip(p.waterPath);
    if (drop && !wooden) {
      poly(c, [s.a, s.b, [s.b[0], s.b[1] + drop], [s.a[0], s.a[1] + drop]], '#47433d');
      for (let k = 0; k < len; k += 26) for (let row = 0; row < Math.ceil(drop / 13); row++) {
        const [x, y] = at(k), ox = (row % 2) * 13;
        poly(c, [[x + ox + 1, y + row * 13 + 1], [x + ox + 24, y + row * 13 + 1], [x + ox + 24, y + row * 13 + 12], [x + ox + 1, y + row * 13 + 12]], tone('#6c675c', 0.82 - row * 0.06 + hash(Math.round(x), row, 4) * 0.3), 'rgba(20,18,18,0.6)', 1.1);
      }
      const ymid = (s.a[1] + s.b[1]) / 2, wet = c.createLinearGradient(0, ymid + drop - 12, 0, ymid + drop);
      wet.addColorStop(0, 'rgba(16,24,26,0)'); wet.addColorStop(1, 'rgba(16,24,26,0.6)');
      c.fillStyle = wet; c.fillRect(Math.min(s.a[0], s.b[0]), ymid + drop - 12, len, 12);
      if (s.id === 'bridge') {
        const mx = (s.a[0] + s.b[0]) / 2, my = ymid + drop;
        c.beginPath(); c.ellipse(mx, my, 52, drop - 6, 0, Math.PI, 0); c.closePath();
        const g = c.createLinearGradient(0, my - drop, 0, my); g.addColorStop(0, '#0e1618'); g.addColorStop(1, '#1c3036');
        c.fillStyle = g; c.fill();
        for (let k = 0; k <= 8; k++) { const a = Math.PI + (k / 8) * Math.PI; line(c, [[mx + Math.cos(a) * 52, my + Math.sin(a) * (drop - 6)], [mx + Math.cos(a) * 62, my + Math.sin(a) * (drop + 2)]], 'rgba(20,18,18,0.7)', 1.2); }
        c.beginPath(); c.ellipse(mx, my, 62, drop + 2, 0, Math.PI, 0); c.strokeStyle = '#7a756a'; c.lineWidth = 2; c.stroke();
      }
    }
    // shallow band and broken foam along the waterline
    const fy0 = drop;
    c.save(); c.filter = 'blur(5px)';
    line(c, [[s.a[0] + s.nx * 9, s.a[1] + s.ny * 9 + fy0], [s.b[0] + s.nx * 9, s.b[1] + s.ny * 9 + fy0]], natural ? 'rgba(60,70,50,0.35)' : 'rgba(140,200,195,0.2)', 14);
    c.restore();
    for (let k = 0; k < len; k += 4) {
      const [x, y] = at(k), f = fbm(x / 46, y / 46, 61);
      if (f < 0.42) continue;
      const off = 2 + hash(Math.round(x), Math.round(y), 3) * 6, l2 = 3 + f * 10;
      line(c, [[x + s.nx * off, y + s.ny * off + fy0], [x + s.nx * off + tx * l2, y + s.ny * off + ty * l2 + fy0]], `rgba(232,244,238,${Math.min(0.6, (f - 0.42) * 1.6)})`, 1.5);
    }
    if (rocky) for (let k = 6; k < len; k += 15) {
      const [x, y] = at(k), r = 7 + hash(Math.round(x), Math.round(y), 8) * 9, o = 4 + hash(Math.round(y), Math.round(x), 8) * 8;
      const rx = x + s.nx * o, ry = y + s.ny * o + (s.ny > 0.5 ? 6 : 0);
      ellipse(c, rx + 2, ry + 3, r, r * 0.6, 'rgba(10,16,18,0.45)');
      ellipse(c, rx, ry, r, r * 0.7, tone('#706c62', 0.8 + hash(Math.round(x), 2, 8) * 0.4), '#1e1c1a', 1.2);
      ellipse(c, rx - r * 0.3, ry - r * 0.25, r * 0.45, r * 0.25, 'rgba(230,226,210,0.35)');
    }
    if (natural) for (let k = 8; k < len; k += 22) {
      const [x, y] = at(k);
      for (let i = 0; i < 5; i++) { const rx = x + s.nx * (2 + i * 2) + tx * (i * 3), ry = y + s.ny * (2 + i * 2) + ty * (i * 3); line(c, [[rx, ry], [rx + (hash(i, k, 5) - 0.5) * 4, ry - 14 - hash(i, k, 6) * 12]], i % 2 ? '#4a6a34' : '#8a8a4a', 1.5); }
    }
    c.restore();
    // dressed-stone curb on the land side of built edges
    if (!rocky && !natural && !wooden) for (let k = 0; k < len; k += 17) {
      const [x, y] = at(k), [x2, y2] = at(Math.min(len, k + 16));
      if (!p.water.some((wp) => inPoly(x + s.nx * 14 + tx * 8, y + s.ny * 14 + ty * 8, wp))) continue;
      poly(c, [[x, y], [x2, y2], [x2 - s.nx * 9, y2 - s.ny * 9], [x - s.nx * 9, y - s.ny * 9]], tone('#a39a88', 0.86 + hash(Math.round(x), Math.round(y), 12) * 0.24), 'rgba(30,24,22,0.55)', 1);
      line(c, [[x - s.nx * 8, y - s.ny * 8], [x2 - s.nx * 8, y2 - s.ny * 8]], 'rgba(255,240,215,0.18)', 1.2);
    }
  }
  // pier posts in the water
  const pier = t.floors.find((f) => f.id === 'pier');
  if (pier) {
    const b = bounds(pier.polygon);
    if (hits(b, 40)) for (let y = b.y0 + 60; y <= b.y1; y += 90) for (const x of [b.x0 + 6, b.x1 - 6]) { rrectPost(c, x, y); }
    if (hits(b, 40)) { c.fillStyle = 'rgba(10,18,24,0.35)'; c.fillRect(b.x0 + 8, b.y1, b.x1 - b.x0, 16); line(c, [[b.x0, b.y1 + 2], [b.x1, b.y1 + 2]], '#3a2c20', 5); }
  }
  yield;
  paintGroundDecor(c, t, x0, y0, CHUNK);
  yield;
  // 7. building contact shadow + soft cast shadow (light from the upper left)
  for (const bld of t.buildings) {
    const b = bounds(bld.footprint);
    if (!hits(b, 160)) continue;
    const h = bld.look?.eaveHeight ?? 120, sx = h * 0.22, sy = h * 0.16;
    c.save(); c.globalAlpha = 0.34; c.filter = 'blur(6px)';
    poly(c, bld.footprint.map(([x, y]) => [x + sx, y + sy] as Point), '#0c1218');
    c.restore();
    c.save(); c.globalAlpha = 0.5; poly(c, bld.footprint, undefined, '#0e1316', 10); c.restore();
  }
  // interior floor of the inn (seen when its shell fades) and dark wall tops
  for (const bld of t.buildings) if (bld.interior) {
    const b = bounds(bld.footprint); if (!hits(b, 10)) continue;
    c.save(); c.clip(pathOf(bld.footprint)); c.fillStyle = '#2b2522'; c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    c.restore();
    for (const f of bld.interior.floors) {
      c.save(); c.clip(pathOf(f)); planks(c, win(clip(bounds(f), 4)), '#8f6c48', 82);
      ellipse(c, (b.x0 + b.x1) / 2 - 10, (b.y0 + b.y1) / 2 + 20, 70, 34, 'rgba(120,40,34,0.55)', 'rgba(200,150,90,0.4)', 3); c.restore();
    }
  }
  // prop and decor shadows (soft, pushed to the lower right by the north-west light)
  const shadow = (x: number, y: number, rx: number, h: number) => {
    if (x < x0 - 160 || x > x0 + CHUNK + 160 || y < y0 - 80 || y > y0 + CHUNK + 80 || rx <= 0) return;
    c.save(); c.globalAlpha = 0.32; c.filter = 'blur(3px)'; ellipse(c, x + h * 0.14, y + 4, rx + h * 0.1, rx * 0.5 + 2, '#0c1216'); c.restore();
  };
  for (const pr of t.props) shadow(pr.x, pr.y, pr.radius, Math.min(pr.height ?? 30, 120));
  for (const d of t.decor ?? []) if (!FLAT_DECOR.has(d.kind) && d.kind !== 'stringlights' && d.kind !== 'laundry' && d.kind !== 'parapet') shadow(d.x, d.y, decorShadow(d.kind, d.scale ?? 1) * (d.scale ?? 1), 60);
  yield;
  // 8. warm light pools (additive)
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const l of t.lights) {
    const [x, y] = l.position, r = l.radius * 0.9;
    if (x + r < x0 || x - r > x0 + CHUNK || y + r < y0 || y - r > y0 + CHUNK) continue;
    const g = c.createRadialGradient(x, y + 10, 4, x, y + 10, r);
    const col = `${l.color >> 16 & 255},${l.color >> 8 & 255},${l.color & 255}`;
    g.addColorStop(0, `rgba(${col},0.24)`); g.addColorStop(0.35, `rgba(${col},0.1)`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(x - r, y + 10 - r, r * 2, r * 2);
    // long warm reflections on the water below lights near the shore
    if (p.water.some((wpoly) => inPoly(x, y + 90, wpoly))) {
      for (let k = 0; k < 7; k++) { const yy = y + 50 + k * 26, ww = 6 + (k % 3) * 5; c.fillStyle = `rgba(${col},${0.12 - k * 0.012})`; c.fillRect(x - ww / 2 + Math.sin(k * 1.7) * 6, yy, ww, 3); }
    }
  }
  c.restore();
  // 9. little stories on the ground: leaves by foundations, puddles on dirt
  for (let i = 0; i < 70; i++) {
    const x = x0 + hash(i, 91, x0 + y0) * CHUNK, y = y0 + hash(i, 92, x0 - y0) * CHUNK;
    const gx = Math.floor(x / 32), gy = Math.floor(y / 32);
    if (!p.walk[gy * p.gw + gx]) continue;
    const k = hash(i, 93, 1);
    if (k < 0.06) { ellipse(c, x, y, 14 + k * 90, 5 + k * 30, 'rgba(40,62,72,0.55)'); ellipse(c, x - 3, y - 1, 9 + k * 40, 2.4, 'rgba(160,190,200,0.25)'); }
    else poly(c, [[x - 2, y], [x, y - 2], [x + 4, y + 1], [x + 1, y + 3]], k > 0.55 ? '#8a6a3a' : '#6d6a40');
  }
}

function rrectPost(c: Paint, x: number, y: number) {
  ellipse(c, x, y + 12, 9, 3, 'rgba(10,18,24,0.45)');
  c.fillStyle = '#3a2c20'; c.fillRect(x - 5, y - 6, 10, 18);
  c.fillStyle = 'rgba(255,220,170,0.15)'; c.fillRect(x - 5, y - 6, 3, 18);
  ellipse(c, x, y + 12, 10, 3, undefined, 'rgba(200,230,220,0.35)', 1.2);
}

// ─────────────────────────── lazy chunk layer ───────────────────────────

interface Job { key: string; x: number; y: number; canvas: HTMLCanvasElement; steps: Generator<void, void, void>; ms: number }

export class TownGround extends Container {
  bakeMs = 0;
  baked = 0;
  /** Longest single slice of chunk work on a frame (ms) — the perf probe reads it. */
  worstSlice = 0;
  private tiles = new Map<string, { sprite: Sprite; x: number; y: number; used: number }>();
  private matrix = new Matrix();
  private wanted: [number, number][] = [];
  private serial = 0;
  private job: Job | null = null;
  private prep: Prep;
  constructor(private t: TownData) {
    super();
    this.prep = prepare(t);
    const cx = Math.floor(t.entry.x / CHUNK), cy = Math.floor(t.entry.y / CHUNK);
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 2; x <= cx + 2; x++) this.finish(this.start(x, y));
    const cols = Math.ceil(t.size[0] * 64 / CHUNK), rows = Math.ceil(t.size[1] * 64 / CHUNK);
    this.onRender = (r: Renderer) => {
      const m = this.getGlobalTransform(this.matrix, false), s = r.screen;
      const minX = Math.floor(-m.tx / m.a / CHUNK), minY = Math.floor(-m.ty / m.d / CHUNK);
      const maxX = Math.floor((s.width - m.tx) / m.a / CHUNK), maxY = Math.floor((s.height - m.ty) / m.d / CHUNK);
      this.serial++; this.wanted.length = 0;
      const cap = Math.max(MAX_CHUNKS, (maxX - minX + 3) * (maxY - minY + 3));
      const list: [number, number][] = [];
      // look two chunks ahead so prefetching normally finishes before a chunk scrolls into view
      for (let y = minY - 1; y <= maxY + 1; y++) for (let x = minX - 2; x <= maxX + 2; x++) if (x >= 0 && y >= 0 && x < cols && y < rows) list.push([x, y]);
      const mid = [(minX + maxX) / 2, (minY + maxY) / 2];
      const onScreen = (a: [number, number]) => a[0] >= minX && a[0] <= maxX && a[1] >= minY && a[1] <= maxY;
      list.sort((a, b) => (onScreen(a) ? 0 : 100) + Math.abs(a[0] - mid[0]) + Math.abs(a[1] - mid[1]) - ((onScreen(b) ? 0 : 100) + Math.abs(b[0] - mid[0]) + Math.abs(b[1] - mid[1])));
      for (const p of list) { const tile = this.tiles.get(`${p[0]},${p[1]}`); if (tile) tile.used = this.serial; else this.wanted.push(p); }
      // a chunk that is already on screen must not show a hole: finish it now (rare when prefetch keeps up)
      for (const p of this.wanted) if (onScreen(p)) this.finish(this.job?.key === `${p[0]},${p[1]}` ? this.job : this.start(p[0], p[1]));
      for (const tile of this.tiles.values()) {
        const x = tile.x * m.a + m.tx, y = tile.y * m.d + m.ty;
        tile.sprite.visible = x < s.width && x + CHUNK * m.a > 0 && y < s.height && y + CHUNK * m.d > 0;
      }
      while (this.tiles.size > cap) if (!this.evict()) break;
      this.work(4);
    };
    this.on('destroyed', () => { this.job = null; this.tiles.clear(); });
  }
  /** Spend about `budget` ms on the next wanted off-screen chunk, one paint step at a time. */
  private work(budget: number) {
    const began = performance.now();
    while (performance.now() - began < budget) {
      if (!this.job) {
        const next = this.wanted.find(([x, y]) => !this.tiles.has(`${x},${y}`));
        if (!next) break;
        this.job = this.start(next[0], next[1]);
      }
      const t0 = performance.now(), done = this.job.steps.next().done;
      this.job.ms += performance.now() - t0;
      if (done) this.finish(this.job);
    }
    this.worstSlice = Math.max(this.worstSlice, performance.now() - began);
  }
  private start(col: number, row: number): Job {
    const x = col * CHUNK, y = row * CHUNK, canvas = document.createElement('canvas');
    canvas.width = canvas.height = CHUNK * DENSITY;
    const c = canvas.getContext('2d')!;
    c.setTransform(DENSITY, 0, 0, DENSITY, -x * DENSITY, -y * DENSITY);
    return { key: `${col},${row}`, x, y, canvas, steps: paintChunk(c, this.t, this.prep, x, y), ms: 0 };
  }
  private finish(job: Job) {
    if (this.job === job) this.job = null;
    if (this.tiles.has(job.key)) return;
    const t0 = performance.now();
    while (!job.steps.next().done) { /* paint the remaining steps */ }
    job.ms += performance.now() - t0;
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
