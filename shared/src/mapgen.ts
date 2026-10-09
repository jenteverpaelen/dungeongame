// Deterministic map generation. Server and client both run this from (zone, seed), so maps are never
// sent over the network — only the seed is.

import { TILE } from './constants';
import { ZONES, type Theme } from './data/zones';
import { Rng, hashString } from './math';
import { loadAuthoredTown } from './town';
import type { TownData } from './townTypes';
import type { AdventureData } from './adventureTypes';
import { loadRillwake, RILLWAKE_ID } from './adventure';

export const T_VOID = 0;
export const T_FLOOR = 1;
export const T_PATH = 2;
export const T_WALL = 3;
export const T_WATER = 4;
export const T_PLAZA = 5;

export const isBlockedTile = (t: number) => t === T_VOID || t === T_WALL || t === T_WATER;

export interface Prop {
  k: string;   // prop kind, e.g. 'tree', 'rock', 'house', 'lantern'
  x: number;
  y: number;
  r: number;   // collision radius (0 = decoration only)
  s: number;   // scale
  v: number;   // variant
}

export type NpcRole = 'cube' | 'stash' | 'obelisk' | 'waypoint' | 'dummy' | 'paragon' | 'healer' | 'vendor' | 'blacksmith' | 'jeweler' | 'mystic' | 'quest' | 'clue';

export interface NpcSpot { id: string; name: string; role: NpcRole; x: number; y: number; r: number }

export interface Portal { x: number; y: number; to: string; label: string }

export interface MapData {
  zone: string;
  theme: Theme;
  seed: number;
  w: number;
  h: number;
  tiles: Uint8Array;
  props: Prop[];
  spawns: { x: number; y: number }[];
  entry: { x: number; y: number };
  portals: Portal[];
  npcs: NpcSpot[];
  town?: TownData;
  adventure?: AdventureData;
}

// ─────────────────────────── Noise ───────────────────────────

function lattice(seed: number, x: number, y: number): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise(seed: number, x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = lattice(seed, xi, yi), b = lattice(seed, xi + 1, yi);
  const c = lattice(seed, xi, yi + 1), d = lattice(seed, xi + 1, yi + 1);
  const u = s(xf), v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(seed: number, x: number, y: number, oct = 3): number {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += valueNoise(seed + i * 1013, x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// ─────────────────────────── Helpers ───────────────────────────

class Grid {
  tiles: Uint8Array;
  constructor(public w: number, public h: number, fill: number) { this.tiles = new Uint8Array(w * h).fill(fill); }
  get(x: number, y: number) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? T_VOID : this.tiles[y * this.w + x]; }
  set(x: number, y: number, v: number) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = v; }
  disc(cx: number, cy: number, r: number, v: number) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, v);
  }
}

const tc = (t: number) => t * TILE + TILE / 2; // tile centre -> world

function floodReachable(g: Grid, sx: number, sy: number): Uint8Array {
  const seen = new Uint8Array(g.w * g.h);
  const stack = [sx + sy * g.w];
  seen[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % g.w, y = (i / g.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
      const j = nx + ny * g.w;
      if (seen[j] || isBlockedTile(g.tiles[j])) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return seen;
}

function poisson(rng: Rng, g: Grid, minDist: number, avoid: { x: number; y: number; r: number }[], tries = 4000): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < tries; i++) {
    const tx = rng.int(2, g.w - 3), ty = rng.int(2, g.h - 3);
    if (isBlockedTile(g.get(tx, ty))) continue;
    // keep away from walls so packs have room
    let open = true;
    for (let dy = -2; dy <= 2 && open; dy++) for (let dx = -2; dx <= 2; dx++) if (isBlockedTile(g.get(tx + dx, ty + dy))) { open = false; break; }
    if (!open) continue;
    const x = tc(tx), y = tc(ty);
    if (avoid.some((a) => (a.x - x) ** 2 + (a.y - y) ** 2 < a.r * a.r)) continue;
    if (pts.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < minDist * minDist)) continue;
    pts.push({ x, y });
  }
  return pts;
}

function scatterDecor(rng: Rng, g: Grid, props: Prop[], kinds: [string, number][], count: number, onPath = false) {
  for (let i = 0; i < count; i++) {
    const tx = rng.int(1, g.w - 2), ty = rng.int(1, g.h - 2);
    const t = g.get(tx, ty);
    if (isBlockedTile(t) || (!onPath && t === T_PATH)) continue;
    props.push({ k: rng.weighted(kinds), x: tx * TILE + rng.range(4, TILE - 4), y: ty * TILE + rng.range(4, TILE - 4), r: 0, s: rng.range(0.8, 1.2), v: rng.int(0, 3) });
  }
}

/** Big blocking props along the edges of wall regions make walls read as forest / rock instead of tiles. */
function edgeProps(rng: Rng, g: Grid, props: Prop[], kind: string, density: number) {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.get(x, y) !== T_WALL) continue;
    const nearFloor = !isBlockedTile(g.get(x + 1, y)) || !isBlockedTile(g.get(x - 1, y)) || !isBlockedTile(g.get(x, y + 1)) || !isBlockedTile(g.get(x, y - 1));
    if (nearFloor ? rng.chance(density) : rng.chance(density * 0.35)) {
      props.push({ k: kind, x: tc(x) + rng.range(-14, 14), y: tc(y) + rng.range(-14, 14), r: 0, s: rng.range(0.85, 1.3), v: rng.int(0, 3) });
    }
  }
}

// ─────────────────────────── Town ───────────────────────────

function genTown(seed: number): MapData {
  const def = ZONES.hearthmere;
  const [w, h] = def.size;
  const rng = new Rng(seed);
  const g = new Grid(w, h, T_FLOOR);
  const props: Prop[] = [];
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);

  // Border: forest + palisade
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
    if (edge < 3 + (fbm(seed, x * 0.3, y * 0.3) > 0.55 ? 1 : 0)) g.set(x, y, T_WALL);
  }
  // Roads (cross) and plaza
  for (let x = 3; x < w - 3; x++) for (let dy = -1; dy <= 1; dy++) g.set(x, cy + dy, T_PATH);
  for (let y = 3; y < h - 3; y++) for (let dx = -1; dx <= 1; dx++) g.set(cx + dx, y, T_PATH);
  g.disc(cx, cy, 8.5, T_PLAZA);
  // Pond in the north-west
  g.disc(9, 9, 3.2, T_WATER);

  const P = (k: string, tx: number, ty: number, r: number, s = 1, v = 0) => props.push({ k, x: tx * TILE, y: ty * TILE, r, s, v });

  // Buildings (collide)
  P('house', cx - 13, cy - 9, 120, 1.15, 0);
  P('house', cx + 13, cy - 9, 120, 1.1, 1);
  P('forge', cx - 14, cy + 9, 110, 1, 0);
  P('house', cx + 15, cy + 10, 120, 1.05, 2);
  P('tavern', cx - 4, cy - 13, 140, 1.2, 0);
  // Plaza dressing
  P('well', cx, cy + 4.5, 38, 1, 0);
  for (const [dx, dy] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [-9, 0], [9, 0]]) P('lantern', cx + dx, cy + dy, 10, 1, 0);
  for (const [dx, dy] of [[-3, -8], [3, -8]]) P('banner', cx + dx, cy + dy, 8, 1, 0);
  P('campfire', cx - 4, cy + 12, 24, 1, 0);
  for (let i = 0; i < 4; i++) P('crate', cx + 10 + i * 0.6, cy - 3 + (i % 2) * 0.7, 18, 0.9 + (i % 2) * 0.2, i);
  for (let i = 0; i < 6; i++) P('fence', cx + 9 + i * 1.0, cy + 13.5, 0, 1, i);

  const npcs: NpcSpot[] = [
    { id: 'cube', name: 'The Ancients\' Cube', role: 'cube', x: cx * TILE, y: (cy - 4) * TILE, r: 40 },
    { id: 'obelisk', name: 'Rift Obelisk', role: 'obelisk', x: (cx + 9) * TILE, y: (cy + 4) * TILE, r: 36 },
    { id: 'waypoint', name: 'Waypoint', role: 'waypoint', x: (cx - 9) * TILE, y: (cy + 4) * TILE, r: 44 },
    { id: 'stash', name: 'Stash', role: 'stash', x: (cx - 5) * TILE, y: (cy + 7) * TILE, r: 26 },
    { id: 'paragon', name: 'Paragon Shrine', role: 'paragon', x: (cx + 5) * TILE, y: (cy - 6) * TILE, r: 26 },
    { id: 'dummy1', name: 'Training Dummy', role: 'dummy', x: (cx + 12) * TILE, y: (cy + 6) * TILE, r: 22 },
    { id: 'dummy2', name: 'Training Dummy', role: 'dummy', x: (cx + 14.5) * TILE, y: (cy + 5) * TILE, r: 22 },
    { id: 'dummy3', name: 'Elite Training Dummy', role: 'dummy', x: (cx + 13.5) * TILE, y: (cy + 7.8) * TILE, r: 28 },
  ];

  edgeProps(rng, g, props, 'pine', 0.65);
  scatterDecor(rng, g, props, [['grass', 6], ['flowers', 3], ['pebbles', 2], ['bush', 1]], 520);
  for (let i = 0; i < 26; i++) {
    const tx = rng.int(4, w - 5), ty = rng.int(4, h - 5);
    if (g.get(tx, ty) !== T_FLOOR) continue;
    if (Math.hypot(tx - cx, ty - cy) < 11) continue;
    if (props.some((p) => p.r > 60 && Math.hypot(p.x - tx * TILE, p.y - ty * TILE) < 200)) continue;
    P('tree', tx + 0.5, ty + 0.5, 22, rng.range(0.9, 1.25), rng.int(0, 3));
  }

  return {
    zone: 'hearthmere', theme: 'town', seed, w, h, tiles: g.tiles, props, spawns: [],
    entry: { x: cx * TILE, y: (cy + 1) * TILE }, portals: [], npcs,
  };
}

// ─────────────────────────── Fields ───────────────────────────

function genField(zoneId: string, seed: number): MapData {
  const def = ZONES[zoneId];
  const [w, h] = def.size;
  const rng = new Rng(seed);
  const g = new Grid(w, h, T_FLOOR);
  const props: Prop[] = [];
  const glade = def.theme === 'glade';

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
    const n = fbm(seed, x * 0.09, y * 0.09);
    if (edge < 3 + n * 4 || n > 0.66) g.set(x, y, T_WALL);
  }
  // Water / lava pools
  for (let i = 0; i < 7; i++) {
    const px = rng.int(15, w - 15), py = rng.int(10, h - 10);
    if (fbm(seed + 7, px * 0.2, py * 0.2) > 0.5) g.disc(px, py, rng.range(2, 4.5), T_WATER);
  }

  const entry = { tx: 6, ty: Math.floor(h / 2) };
  // Meandering main road west → east plus two branches
  const carve = (x0: number, y0: number, x1: number, y1: number) => {
    let x = x0, y = y0;
    let guard = 0;
    while ((x !== x1 || y !== y1) && guard++ < 2000) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) g.set(x + dx, y + dy, T_PATH);
      if (rng.chance(0.65)) x += Math.sign(x1 - x); else y += Math.sign(y1 - y) || (rng.chance(0.5) ? 1 : -1);
      y = Math.max(4, Math.min(h - 5, y));
    }
  };
  carve(entry.tx, entry.ty, w - 8, rng.int(15, h - 15));
  carve(rng.int(30, 50), entry.ty, rng.int(40, 70), 8);
  carve(rng.int(60, 80), entry.ty, rng.int(70, 100), h - 8);
  g.disc(entry.tx + 2, entry.ty, 4, T_FLOOR);

  const reach = floodReachable(g, entry.tx, entry.ty);
  for (let i = 0; i < g.tiles.length; i++) if (!reach[i] && !isBlockedTile(g.tiles[i])) g.tiles[i] = T_WALL;

  const entryW = { x: tc(entry.tx + 2), y: tc(entry.ty) };
  edgeProps(rng, g, props, glade ? 'tree' : 'deadtree', glade ? 0.7 : 0.5);
  if (!glade) edgeProps(rng, g, props, 'rockspire', 0.25);

  // Colliding rocks / ruins in open areas
  for (let i = 0; i < 90; i++) {
    const tx = rng.int(5, w - 6), ty = rng.int(5, h - 6);
    if (g.get(tx, ty) !== T_FLOOR) continue;
    if (Math.hypot(tc(tx) - entryW.x, tc(ty) - entryW.y) < 500) continue;
    const kind = glade ? rng.weighted([['boulder', 3], ['stump', 2], ['tree', 3]] as const) : rng.weighted([['boulder', 2], ['pillar', 3], ['brazier', 1]] as const);
    props.push({ k: kind, x: tc(tx), y: tc(ty), r: kind === 'tree' ? 22 : kind === 'pillar' ? 24 : kind === 'brazier' ? 14 : 26, s: rng.range(0.85, 1.25), v: rng.int(0, 3) });
  }
  scatterDecor(rng, g, props, glade
    ? [['grass', 8], ['flowers', 4], ['mushrooms', 2], ['pebbles', 2], ['bush', 2], ['fern', 3]]
    : [['ash', 6], ['bones', 3], ['cracks', 3], ['pebbles', 3], ['ember', 2], ['skull', 1]], 2600);

  const spawns = poisson(rng, g, 360, [{ ...entryW, r: 720 }]);
  return {
    zone: zoneId, theme: def.theme, seed, w, h, tiles: g.tiles, props, spawns,
    entry: entryW, portals: [{ x: entryW.x - 90, y: entryW.y, to: 'hearthmere', label: 'To Hearthmere' }], npcs: [],
  };
}

// ─────────────────────────── Rifts (cellular-automata caves) ───────────────────────────

function genRift(seed: number, theme: Theme): MapData {
  const [w, h] = ZONES.rift.size;
  for (let attempt = 0; attempt < 8; attempt++) {
    const rng = new Rng(seed + attempt * 7919);
    const g = new Grid(w, h, T_FLOOR);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      g.set(x, y, edge < 3 || rng.chance(0.45) ? T_WALL : T_FLOOR);
    }
    for (let it = 0; it < 5; it++) {
      const next = new Uint8Array(g.tiles);
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && g.get(x + dx, y + dy) === T_WALL) n++;
        next[y * w + x] = n >= 5 ? T_WALL : n <= 3 ? T_FLOOR : g.get(x, y);
      }
      g.tiles = next;
    }
    // Widen corridors: erode walls with few wall neighbours so packs and whirlwinds fit
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (g.get(x, y) !== T_WALL) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g.get(x + dx, y + dy) === T_WALL) n++;
      if (n <= 4 && Math.min(x, y, w - 1 - x, h - 1 - y) > 3) g.set(x, y, T_FLOOR);
    }
    // Largest region
    let best: Uint8Array | null = null, bestCount = 0, bestStart = 0;
    const visited = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (visited[i] || isBlockedTile(g.tiles[i])) continue;
      const reach = floodReachable(g, i % w, (i / w) | 0);
      let c = 0;
      for (let j = 0; j < reach.length; j++) if (reach[j]) { visited[j] = 1; c++; }
      if (c > bestCount) { bestCount = c; best = reach; bestStart = i; }
    }
    if (!best || bestCount < 3200) continue;
    for (let i = 0; i < g.tiles.length; i++) if (!best[i]) g.tiles[i] = T_WALL;
    // Entry: reachable floor tile with the smallest x+y that has open space around it
    let entryIdx = bestStart, bestScore = Infinity;
    for (let i = 0; i < g.tiles.length; i++) {
      if (!best[i]) continue;
      const x = i % w, y = (i / w) | 0;
      let open = true;
      for (let dy = -2; dy <= 2 && open; dy++) for (let dx = -2; dx <= 2; dx++) if (isBlockedTile(g.get(x + dx, y + dy))) { open = false; break; }
      if (!open) continue;
      const s = x + y;
      if (s < bestScore) { bestScore = s; entryIdx = i; }
    }
    const entry = { x: tc(entryIdx % w), y: tc((entryIdx / w) | 0) };
    const props: Prop[] = [];
    const glade = theme === 'glade';
    edgeProps(rng, g, props, glade ? 'cavecrystal' : 'rockspire', 0.35);
    scatterDecor(rng, g, props, glade
      ? [['pebbles', 5], ['mushrooms', 4], ['glowmoss', 3], ['bones', 1]]
      : [['ash', 5], ['bones', 4], ['cracks', 4], ['ember', 3], ['skull', 2]], 2200);
    for (let i = 0; i < 40; i++) {
      const tx = rng.int(4, w - 5), ty = rng.int(4, h - 5);
      if (g.get(tx, ty) !== T_FLOOR) continue;
      if (Math.hypot(tc(tx) - entry.x, tc(ty) - entry.y) < 400) continue;
      props.push({ k: glade ? 'stalagmite' : 'pillar', x: tc(tx), y: tc(ty), r: 20, s: rng.range(0.8, 1.2), v: rng.int(0, 3) });
    }
    const spawns = poisson(rng, g, 300, [{ ...entry, r: 520 }]);
    return {
      zone: 'rift', theme, seed, w, h, tiles: g.tiles, props, spawns, entry,
      portals: [{ x: entry.x - 70, y: entry.y - 40, to: 'hearthmere', label: 'To Hearthmere' }], npcs: [],
    };
  }
  throw new Error('rift generation failed');
}

export function generateMap(zoneId: string, seed: number, theme?: Theme): MapData {
  const def = ZONES[zoneId];
  if (!def) throw new Error(`unknown zone ${zoneId}`);
  if (zoneId === RILLWAKE_ID) return loadRillwake(seed);
  if (def.kind === 'town') return loadAuthoredTown(seed);
  if (def.kind === 'field') return genField(zoneId, seed);
  return genRift(seed, theme ?? 'glade');
}

export function zoneSeed(zoneId: string, channel: number): number {
  return hashString(`${zoneId}#${channel}`);
}
