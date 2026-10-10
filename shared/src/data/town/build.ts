// Authored source for Hearthmere (docs/rework/DESIGN.md §4): a harbour street between the escarpment and the lake.
// Run `npx tsx shared/src/data/town/build.ts` to regenerate hearthmere.json; the game only reads the JSON.
// Units: world units (TILE 64, hero 64 u tall). North = smaller y; every facade the player must read faces south.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Point, TownBuilding, TownBuildingKit, TownData, TownGround } from '../../townTypes';

const OUT = fileURLToPath(new URL('./hearthmere.json', import.meta.url));
const r1 = (n: number) => Math.round(n * 10) / 10;
const pt = (x: number, y: number): Point => [r1(x), r1(y)];

// ─────────────────────────── building helpers ───────────────────────────

/** Axis-aligned rectangle: edges 0 front(S) 1 east 2 back(N) 3 west. */
function rectFoot(x0: number, y0: number, x1: number, y1: number): Point[] { return [pt(x0, y1), pt(x1, y1), pt(x1, y0), pt(x0, y0)]; }
function ring(cx: number, cy: number, r: number, n: number, ry = r): Point[] {
  const out: Point[] = [];
  // Start at the west and go through the south first so edge 0.. are the visible front faces.
  for (let i = 0; i < n; i++) { const a = Math.PI - (i / n) * Math.PI * 2; out.push(pt(cx + Math.cos(a) * r, cy + Math.sin(a) * ry)); }
  return out;
}
function frontBaseline(f: Point[]): Point[] {
  const cy = f.reduce((s, p) => s + p[1], 0) / f.length;
  const xs = f.map((p) => p[0]), minX = Math.min(...xs), maxX = Math.max(...xs);
  const south = f.filter((p) => p[1] >= cy - 0.01).sort((a, b) => a[0] - b[0]);
  const left = f.find((p) => p[0] === minX)!, right = f.find((p) => p[0] === maxX)!;
  const pts = [left, ...south.filter((p) => p !== left && p !== right), right];
  return pts.sort((a, b) => a[0] - b[0]);
}

interface RectSpec { id: string; label: string; x0: number; y0: number; x1: number; y1: number; eave: number; ridge: number; height: string; kit: TownBuildingKit; interior?: TownBuilding['interior']; doors?: TownBuilding['doors'] }
function rectBuilding(s: RectSpec): TownBuilding {
  const o = s.kit.roof === 'awning' ? 10 : 14; // eave overhang
  const { x0, y0, x1, y1 } = s, ym = (y0 + y1) / 2, xm = (x0 + x1) / 2;
  let vertices: [number, number, number][], faces: number[][];
  const e = s.eave, r = Math.max(s.ridge, s.eave + 1);
  if (s.kit.roof === 'gableFront') {
    // ridge runs north-south: the triangular gable faces the street
    vertices = [[x0 - o, y1 + o, e], [x1 + o, y1 + o, e], [x1 + o, y0 - o, e], [x0 - o, y0 - o, e], [xm, y1 + o, r], [xm, y0 - o, r]];
    faces = [[0, 4, 5, 3], [4, 1, 2, 5]];
  } else if (s.kit.roof === 'hip') {
    const inset = Math.min((x1 - x0) / 2 - 4, (y1 - y0) / 2 + o);
    vertices = [[x0 - o, y1 + o, e], [x1 + o, y1 + o, e], [x1 + o, y0 - o, e], [x0 - o, y0 - o, e], [x0 - o + inset, ym, r], [x1 + o - inset, ym, r]];
    faces = [[0, 1, 5, 4], [1, 2, 5], [2, 3, 4, 5], [3, 0, 4]];
  } else if (s.kit.roof === 'flat' || s.kit.roof === 'awning') {
    vertices = [[x0 - o, y1 + o, e], [x1 + o, y1 + o, e], [x1 + o, y0 - o, r], [x0 - o, y0 - o, r]];
    faces = [[0, 1, 2, 3]];
  } else {
    vertices = [[x0 - o, y1 + o, e], [x1 + o, y1 + o, e], [x1 + o, y0 - o, e], [x0 - o, y0 - o, e], [x0 - o, ym, r], [x1 + o, ym, r]];
    faces = [[0, 1, 5, 4], [3, 2, 5, 4]];
  }
  const footprint = rectFoot(x0, y0, x1, y1);
  const chim = s.kit.chimneys?.[0];
  return {
    id: s.id, label: s.label, footprint, baseline: frontBaseline(footprint), heightClass: s.height, doors: s.doors ?? [],
    look: {
      style: s.id, eaveHeight: e, ridgeHeight: r, roofColor: s.kit.roofColor,
      roof: { vertices: vertices.map(([a, b, c]) => [r1(a), r1(b), c] as [number, number, number]), faces },
      chimney: { position: chim ? chim.at : pt(xm, ym), height: chim ? chim.height : 0 },
      kit: s.kit,
    },
    ...(s.interior ? { interior: s.interior } : {}),
  };
}

interface RoundSpec { id: string; label: string; cx: number; cy: number; r: number; n: number; eave: number; top: number; height: string; kit: TownBuildingKit }
function roundBuilding(s: RoundSpec): TownBuilding {
  const footprint = ring(s.cx, s.cy, s.r, s.n, s.r * 0.86);
  const o = 12;
  const rim = ring(s.cx, s.cy, s.r + o, s.n, (s.r + o) * 0.86).map(([x, y]) => [x, y, s.eave] as [number, number, number]);
  const vertices = [...rim, [s.cx + (s.kit.lean ?? 0), s.cy, s.top] as [number, number, number]];
  const faces = rim.map((_, i) => [i, (i + 1) % rim.length, rim.length]);
  return {
    id: s.id, label: s.label, footprint, baseline: frontBaseline(footprint), heightClass: s.height, doors: [],
    look: { style: s.id, eaveHeight: s.eave, ridgeHeight: s.top, roofColor: s.kit.roofColor, roof: { vertices, faces }, chimney: { position: pt(s.cx, s.cy), height: 0 }, kit: s.kit },
  };
}

// ─────────────────────────── layout ───────────────────────────

const STREET_Y = 2010;
const buildings: TownBuilding[] = [];
const K = (k: Partial<TownBuildingKit> & Pick<TownBuildingKit, 'wall' | 'roof' | 'roofMat' | 'roofColor'>): TownBuildingKit => ({ shape: 'rect', wallColor: '#d9c9a6', trimColor: '#4a3426', ...k });

// The Banked Ember — the inn (enterable; its hearth gives the town its name)
const INN = { x0: 1950, y0: 1630, x1: 2390, y1: 1860 }, WALL = 28, DOOR = { x0: 2096, x1: 2180 };
buildings.push(rectBuilding({
  id: 'inn', label: 'The Banked Ember', ...INN, eave: 176, ridge: 300, height: '3–5H',
  kit: K({ wall: 'timber', wallColor: '#e2cfa4', trimColor: '#4a3020', roof: 'gable', roofMat: 'tile', roofColor: '#9e4a32', cutaway: true, flowerBoxes: true,
    windows: [{ face: 0, at: [0.1, 0.62, 0.78, 0.92], rows: 2, lit: true }, { face: 3, at: [0.5], rows: 2, lit: true }],
    doors: [{ face: 0, at: ((DOOR.x0 + DOOR.x1) / 2 - INN.x0) / (INN.x1 - INN.x0), w: DOOR.x1 - DOOR.x0, kind: 'open' }],
    sign: { face: 0, at: 0.2, emblem: 'ember' }, chimneys: [{ at: pt(2310, 1700), height: 330 }, { at: pt(2020, 1690), height: 300 }], lanterns: [{ face: 0, at: 0.31 }, { face: 0, at: 0.555 }] }),
  interior: {
    label: 'The Banked Ember',
    floors: [[pt(INN.x0 + WALL, INN.y0 + WALL), pt(INN.x1 - WALL, INN.y0 + WALL), pt(INN.x1 - WALL, INN.y1 - WALL), pt(INN.x0 + WALL, INN.y1 - WALL)],
      [pt(DOOR.x0, INN.y1 - WALL - 6), pt(DOOR.x1, INN.y1 - WALL - 6), pt(DOOR.x1, INN.y1 + 18), pt(DOOR.x0, INN.y1 + 18)]],
    target: pt(2200, 1720),
  },
  doors: [{ id: 'inn-door', a: pt(DOOR.x0, INN.y1), b: pt(DOOR.x1, INN.y1), approach: pt(2138, 1930), inside: pt(2138, 1790) }],
}));
buildings.push(rectBuilding({ id: 'cottage-a', label: 'Lamplighter’s cottage', x0: 2460, y0: 1660, x1: 2610, y1: 1840, eave: 132, ridge: 236, height: '2–3H',
  kit: K({ wall: 'plaster', wallColor: '#d6c7a3', roof: 'gableFront', roofMat: 'slate', roofColor: '#3e5266', flowerBoxes: true,
    windows: [{ face: 0, at: [0.22, 0.78], rows: 1, lit: true }], doors: [{ face: 0, at: 0.52, kind: 'wood' }], chimneys: [{ at: pt(2575, 1700), height: 250 }] }) }));
buildings.push(roundBuilding({ id: 'rotunda', label: 'Arcane workshop', cx: 2790, cy: 1715, r: 108, n: 14, eave: 112, top: 236, height: '2–4H',
  kit: K({ shape: 'round', wall: 'stone', wallColor: '#a7a39a', roof: 'dome', roofMat: 'glass', roofColor: '#7fd6d0', columns: 7, windows: [{ face: 3, at: [0.5], lit: true }], doors: [{ face: 4, at: 0.5, kind: 'arch' }] }) }));
buildings.push(rectBuilding({ id: 'vault', label: 'Vault of Ledgers', x0: 2975, y0: 1620, x1: 3255, y1: 1830, eave: 176, ridge: 262, height: '3–4H',
  kit: K({ wall: 'stone', wallColor: '#b6ad99', trimColor: '#3a3430', roof: 'hip', roofMat: 'slate', roofColor: '#435567',
    windows: [{ face: 0, at: [0.15, 0.85], rows: 2, lit: false }], doors: [{ face: 0, at: 0.5, w: 92, kind: 'double' }], sign: { face: 0, at: 0.5, emblem: 'key' }, lanterns: [{ face: 0, at: 0.3 }, { face: 0, at: 0.7 }] }) }));
buildings.push(rectBuilding({ id: 'stall-e', label: 'Lamp-oil stall', x0: 3255, y0: 1765, x1: 3320, y1: 1830, eave: 92, ridge: 112, height: '1–2H',
  kit: K({ wall: 'planks', wallColor: '#8a6a44', roof: 'awning', roofMat: 'cloth', roofColor: '#3f7a6a', goods: 'oil' }) }));
buildings.push(roundBuilding({ id: 'tower', label: 'The Leaning Tower', cx: 3480, cy: 1715, r: 92, n: 12, eave: 292, top: 452, height: '5–7H',
  kit: K({ shape: 'round', wall: 'stone', wallColor: '#8f8a9e', trimColor: '#3a2f4a', roof: 'cone', roofMat: 'shingle', roofColor: '#5b3f7a', lean: 22, runes: true,
    windows: [{ face: 3, at: [0.5], rows: 3, lit: true, upper: true }, { face: 1, at: [0.5], rows: 2, lit: true, upper: true }], doors: [{ face: 3, at: 0.5, kind: 'arch' }] }) }));
buildings.push(rectBuilding({ id: 'forge', label: 'The Forge', x0: 3640, y0: 1650, x1: 3945, y1: 1860, eave: 142, ridge: 232, height: '2–4H',
  kit: K({ wall: 'stone', wallColor: '#8e8172', trimColor: '#2e2620', roof: 'hip', roofMat: 'slate', roofColor: '#3a4450', hearth: { face: 0, from: 0.16, to: 0.62 },
    windows: [{ face: 0, at: [0.84], rows: 1, lit: true }], sign: { face: 0, at: 0.78, emblem: 'hammer' }, chimneys: [{ at: pt(3900, 1700), height: 330 }] }) }));
buildings.push(rectBuilding({ id: 'jewelers-shop', label: 'The Faceted Lamp', x0: 4010, y0: 1670, x1: 4195, y1: 1845, eave: 152, ridge: 246, height: '2–4H',
  kit: K({ wall: 'plaster', wallColor: '#e3d8bd', trimColor: '#2f4a46', roof: 'gableFront', roofMat: 'tile', roofColor: '#7a3a3a', flowerBoxes: true,
    windows: [{ face: 0, at: [0.25], rows: 2, lit: true }, { face: 0, at: [0.74], rows: 2, lit: true, upper: true }], doors: [{ face: 0, at: 0.74, kind: 'wood' }],
    awning: { face: 0, from: 0.06, to: 0.5, colors: ['#2f6f6a', '#e8dcc0'] }, sign: { face: 0, at: 0.94, emblem: 'gem' }, chimneys: [{ at: pt(4155, 1710), height: 270 }] }) }));
buildings.push(rectBuilding({ id: 'cottage-b', label: 'Gate cottage', x0: 4195, y0: 1680, x1: 4335, y1: 1845, eave: 126, ridge: 220, height: '2–3H',
  kit: K({ wall: 'timber', wallColor: '#d8c8a0', roof: 'gable', roofMat: 'thatch', roofColor: '#8a7448', windows: [{ face: 0, at: [0.3], rows: 1, lit: true }], doors: [{ face: 0, at: 0.72, kind: 'wood' }], chimneys: [{ at: pt(4220, 1720), height: 240 }] }) }));
// harbour side (fronts face the water)
buildings.push(rectBuilding({ id: 'mill', label: 'Wheelhouse mill', x0: 1910, y0: 2250, x1: 2150, y1: 2440, eave: 150, ridge: 250, height: '3–4H',
  kit: K({ wall: 'stone', wallColor: '#a49884', roof: 'gable', roofMat: 'shingle', roofColor: '#5a4a3a', windows: [{ face: 0, at: [0.3, 0.75], rows: 2, lit: true }], doors: [{ face: 0, at: 0.52, kind: 'double' }], sign: { face: 0, at: 0.52, emblem: 'wheel' }, chimneys: [{ at: pt(2110, 2280), height: 260 }] }) }));
buildings.push(rectBuilding({ id: 'boathouse', label: 'Boathouse', x0: 2320, y0: 2390, x1: 2560, y1: 2560, eave: 112, ridge: 196, height: '2–3H',
  kit: K({ wall: 'planks', wallColor: '#7a5e40', roof: 'gableFront', roofMat: 'shingle', roofColor: '#4e5a52', doors: [{ face: 0, at: 0.5, w: 120, kind: 'double' }], sign: { face: 0, at: 0.5, emblem: 'anchor' } }) }));
buildings.push(rectBuilding({ id: 'fishstall', label: 'Fish stall', x0: 2700, y0: 2440, x1: 2820, y1: 2510, eave: 96, ridge: 118, height: '1–2H',
  kit: K({ wall: 'planks', wallColor: '#8a6a44', roof: 'awning', roofMat: 'cloth', roofColor: '#3a6a8a', goods: 'fish' }) }));
buildings.push(rectBuilding({ id: 'cottage-c', label: 'Net-mender’s house', x0: 3520, y0: 2300, x1: 3690, y1: 2450, eave: 128, ridge: 224, height: '2–3H',
  kit: K({ wall: 'plaster', wallColor: '#cfd2c6', roof: 'gable', roofMat: 'tile', roofColor: '#a65a3a', flowerBoxes: true, windows: [{ face: 0, at: [0.25, 0.75], rows: 1, lit: true }], doors: [{ face: 0, at: 0.5, kind: 'wood' }], chimneys: [{ at: pt(3650, 2330), height: 236 }] }) }));
// gate towers and the Hearthlight beacon
buildings.push(roundBuilding({ id: 'gate-n', label: 'North gate tower', cx: 4560, cy: 1880, r: 40, n: 10, eave: 170, top: 250, height: '3–4H',
  kit: K({ shape: 'round', wall: 'stone', wallColor: '#9a9282', trimColor: '#3a3430', roof: 'cone', roofMat: 'slate', roofColor: '#4a5664',
    windows: [{ face: 3, at: [0.5], rows: 2, lit: true, upper: true }] }) }));
buildings.push(roundBuilding({ id: 'gate-s', label: 'South gate tower', cx: 4560, cy: 2140, r: 40, n: 10, eave: 170, top: 250, height: '3–4H',
  kit: K({ shape: 'round', wall: 'stone', wallColor: '#9a9282', trimColor: '#3a3430', roof: 'cone', roofMat: 'slate', roofColor: '#4a5664',
    windows: [{ face: 2, at: [0.5], rows: 2, lit: true, upper: true }] }) }));
buildings.push(roundBuilding({ id: 'hearthlight', label: 'The Hearthlight', cx: 4440, cy: 3080, r: 66, n: 14, eave: 372, top: 470, height: '7–8H',
  kit: K({ shape: 'round', wall: 'stone', wallColor: '#c9c1ad', trimColor: '#3a3430', roof: 'cone', roofMat: 'copper', roofColor: '#5f8a7a', beacon: true, windows: [{ face: 3, at: [0.5], rows: 3, lit: true, upper: true }], doors: [{ face: 3, at: 0.5, kind: 'arch' }] }) }));

// ─────────────────────────── walkable ground (collision source) ───────────────────────────

// North edge hugs the building backs (≤20 u slivers stay unreachable for a 16 u hero); alleys between houses stay open.
const mainFloor: Point[] = [
  pt(1885, 1650), pt(1940, 1615), pt(2400, 1615), pt(2440, 1640), pt(2615, 1640), pt(2680, 1612), pt(2900, 1612), pt(2960, 1606),
  pt(3260, 1606), pt(3330, 1618), pt(3580, 1622), pt(3630, 1636), pt(3950, 1636), pt(4000, 1652), pt(4200, 1652), pt(4210, 1662),
  pt(4340, 1662), pt(4352, 1600), pt(4540, 1600), pt(4560, 1625), pt(4560, 2700),
  pt(4300, 2706), pt(4150, 2694), pt(3800, 2702), pt(3500, 2690), pt(3080, 2692), pt(2940, 2690), pt(2600, 2702), pt(2200, 2706), pt(1890, 2690),
];
const floors: TownData['floors'] = [
  { id: 'town', kind: 'court', polygon: mainFloor },
  { id: 'bridge', kind: 'road', polygon: [pt(1680, 1952), pt(1905, 1952), pt(1905, 2070), pt(1680, 2070)] },
  { id: 'grove', kind: 'court', polygon: [pt(1290, 1760), pt(1380, 1700), pt(1560, 1690), pt(1700, 1720), pt(1700, 1955), pt(1705, 2068), pt(1700, 2190), pt(1560, 2215), pt(1360, 2200), pt(1280, 2120), pt(1270, 1880)] },
  { id: 'gate-road', kind: 'road', polygon: [pt(4540, 1935), pt(4960, 1925), pt(5100, 1950), pt(5130, 2050), pt(4990, 2090), pt(4540, 2085)] },
  { id: 'pier', kind: 'road', polygon: [pt(2958, 2660), pt(3072, 2660), pt(3072, 3270), pt(2958, 3270)] },
  { id: 'breakwater', kind: 'road', polygon: [pt(4140, 2680), pt(4262, 2680), pt(4352, 2930), pt(4600, 2950), pt(4610, 3210), pt(4280, 3215), pt(4270, 2960)] },
];

// ─────────────────────────── services (stable ids; server checks position + radius + sight) ───────────────────────────

const npcs: TownData['npcs'] = [
  { id: 'waypoint', name: 'Waypoint', role: 'waypoint', x: 3020, y: 2050, r: 30, approach: pt(3020, 2140), interactionRadius: 120, idle: 'breathe', bark: 'The roads remember where you have been.' },
  { id: 'stash', name: 'Stash', role: 'stash', x: 3115, y: 1880, r: 22, approach: pt(3115, 1950), interactionRadius: 112, idle: 'breathe', bark: 'Locked, counted, and boring. Exactly as it should be.' },
  { id: 'blacksmith', name: 'Blacksmith', role: 'blacksmith', x: 3760, y: 1925, r: 16, approach: pt(3760, 1995), interactionRadius: 106, idle: 'hammer', look: 'smith-slice', bark: 'Bring me the bent and the broken.' },
  { id: 'jeweler', name: 'Jeweler', role: 'jeweler', x: 4100, y: 1915, r: 16, approach: pt(4100, 1990), interactionRadius: 106, idle: 'polish', look: 'jeweler', bark: 'Every stone has a flaw.' },
  { id: 'mystic', name: 'Mystic', role: 'mystic', x: 3480, y: 1885, r: 16, approach: pt(3480, 1960), interactionRadius: 106, idle: 'weave', look: 'mystic', bark: 'The past is a draft.' },
  { id: 'cube', name: "The Ancients' Cube", role: 'cube', x: 2790, y: 1890, r: 28, approach: pt(2790, 1975), interactionRadius: 118, idle: 'breathe', bark: 'It hums when it is hungry.' },
  { id: 'rift', name: 'Rift Obelisk', role: 'obelisk', x: 4445, y: 1760, r: 18, approach: pt(4445, 1850), interactionRadius: 118, idle: 'breathe', bark: 'The stone listens.' },
  { id: 'paragon', name: 'Paragon shrine', role: 'paragon', x: 1480, y: 1860, r: 22, approach: pt(1540, 1930), interactionRadius: 112, idle: 'breathe', bark: 'A quiet place, for loud deeds.' },
  { id: 'dummy-0', name: 'Training Dummy', role: 'dummy', x: 3990, y: 2430, r: 20, approach: pt(3990, 2520), interactionRadius: 0, idle: 'breathe' },
  { id: 'dummy-1', name: 'Training Dummy', role: 'dummy', x: 4110, y: 2400, r: 20, approach: pt(4110, 2500), interactionRadius: 0, idle: 'breathe' },
  { id: 'dummy3', name: 'Elite Training Dummy', role: 'dummy', x: 4225, y: 2455, r: 20, approach: pt(4225, 2545), interactionRadius: 0, idle: 'breathe' },
];

const portals: TownData['portals'] = [
  { x: 1345, y: 1985, to: 'whispering_glade', label: 'To The Whispering Glade' },
  { x: 5060, y: 2010, to: 'ashen_hollow', label: 'To Ashen Hollow' },
];

// ─────────────────────────── solid props (circles) ───────────────────────────

const props: TownData['props'] = [];
const prop = (id: string, kind: string, x: number, y: number, radius: number, extra: Partial<TownData['props'][number]> = {}) => props.push({ id, kind, x, y, radius, ...extra });
// inn interior furniture (solid)
prop('inn-bar', 'bar', 2330, 1700, 26, { height: 44 }); prop('inn-bar-2', 'bar', 2330, 1755, 26, { height: 44 });
prop('inn-table', 'table', 2060, 1740, 26, { height: 34 }); prop('inn-table-2', 'table', 2230, 1780, 24, { height: 34 });
prop('inn-cask', 'cask', 2025, 1680, 18, { height: 40 }); prop('inn-hearth', 'hearth', 2160, 1668, 30, { height: 60 });
// terrace + street furniture
prop('terrace-table', 'table', 2000, 1925, 22, { height: 32 }); prop('terrace-table-2', 'table', 2290, 1935, 22, { height: 32 });
prop('square-well', 'well', 3230, 2230, 30, { height: 64 });
prop('notice', 'noticeboard', 2860, 2130, 14, { height: 92 });
prop('hearth-oak', 'oak', 2700, 2260, 34, { height: 260, scale: 1.25 });
prop('anvil', 'anvil', 3702, 1932, 18, { height: 34 });
prop('quench', 'barrel', 3660, 1890, 15, { height: 38, variant: 1 });
prop('weapon-rack', 'rack', 3900, 1898, 18, { height: 62 });
prop('jewel-table', 'counter', 4050, 1895, 18, { height: 34 });
prop('mystic-table', 'crystal-table', 3540, 1890, 16, { height: 34 });
prop('stash-crates', 'crates', 2945, 1872, 20, { height: 40 });
prop('cart', 'cart', 3330, 2240, 30, { height: 52 });
prop('crane', 'crane', 3270, 2640, 28, { height: 260 });
prop('bollard-1', 'bollard', 2940, 2680, 9, { height: 26 }); prop('bollard-2', 'bollard', 3090, 2680, 9, { height: 26 });
prop('harbour-barrels', 'barrels', 3180, 2600, 24, { height: 40 }); prop('harbour-crates', 'crates', 2860, 2620, 24, { height: 44 });
prop('netrack-1', 'netrack', 2050, 2620, 20, { height: 70 }); prop('netrack-2', 'netrack', 2210, 2630, 20, { height: 70 });
prop('rack-yard', 'rack', 4280, 2330, 16, { height: 62 });
prop('column-1', 'column', 4375, 1690, 20, { height: 150 }); prop('column-2', 'column', 4520, 1700, 20, { height: 90, variant: 1 });
prop('ruin-block', 'ruin', 4500, 1800, 22, { height: 40 });
prop('brazier-gate-n', 'brazier', 4500, 1915, 14, { height: 46 }); prop('brazier-gate-s', 'brazier', 4500, 2105, 14, { height: 46 });
prop('shrine-lantern-1', 'stone-lantern', 1400, 1810, 12, { height: 56 }); prop('shrine-lantern-2', 'stone-lantern', 1580, 1800, 12, { height: 56 });
prop('grove-oak', 'oak', 1360, 1760, 30, { height: 230 }); prop('grove-birch', 'birch', 1640, 1760, 20, { height: 220 });
prop('grove-willow', 'willow', 1620, 2160, 30, { height: 220 });
prop('beacon-rock', 'rock', 4330, 3150, 26, { height: 34 });
// solid street furniture: anything that looks like you would bump into it is a collision circle
prop('bench-1', 'bench', 2880, 2240, 18, { height: 30 }); prop('bench-2', 'bench', 3160, 2280, 18, { height: 30, flip: true }); prop('bench-3', 'bench', 1450, 2010, 18, { height: 30 });
prop('hay-1', 'hay', 4300, 2560, 24, { height: 46 }); prop('hay-2', 'hay', 3930, 2570, 24, { height: 46 });
prop('scoreboard', 'scoreboard', 4180, 2320, 14, { height: 92 }); prop('tent', 'tent', 4280, 2545, 34, { height: 80 });
prop('banner-1', 'banner', 4512, 1955, 7, { height: 150 }); prop('banner-2', 'banner', 4512, 2065, 7, { height: 150 }); prop('banner-3', 'banner', 3622, 1872, 7, { height: 150 });
prop('signpost-w', 'signpost', 1688, 1940, 8, { height: 92 }); prop('signpost-e', 'signpost', 4490, 2152, 8, { height: 92 });
prop('logpile', 'logpile', 1960, 2470, 24, { height: 40 }); prop('barrels-mill', 'barrels', 2160, 2236, 22, { height: 40 }); prop('barrels-quay', 'barrels', 2530, 2615, 22, { height: 40 });
prop('crates-quay', 'crates', 3460, 2620, 22, { height: 44 }); prop('fishcrates', 'fishcrates', 2850, 2532, 22, { height: 30 });
prop('pier-lantern', 'lamp', 3065, 3240, 8, { height: 110 });
// street lamps along Lantern Row (south edge) and the quay
const lampXs = [2010, 2280, 2560, 2860, 3180, 3420, 3700, 3980, 4260];
lampXs.forEach((x, i) => prop(`lamp-${i}`, 'lamp', x, STREET_Y + 150 + (i % 2) * 6, 8, { height: 118 }));
[2400, 2700, 3400, 3700, 4000].forEach((x, i) => prop(`quay-lamp-${i}`, 'lamp', x, 2672, 8, { height: 104 }));

// ─────────────────────────── barriers (fences, palisade, hedges) ───────────────────────────

const barriers: TownData['barriers'] = [];
const fence = (id: string, kind: NonNullable<TownData['barriers'][number]['kind']>, pts: Point[], radius = 6) => { for (let i = 1; i < pts.length; i++) barriers.push({ id: `${id}-${i}`, a: pts[i - 1], b: pts[i], radius, kind }); };
// training yard: open on the north side towards the street
fence('yard', 'fence', [pt(3900, 2310), pt(3880, 2600), pt(4320, 2600), pt(4330, 2300), pt(4250, 2295)]);
// shrine garden hedges (opening towards the bridge)
fence('hedge', 'hedge', [pt(1610, 2112), pt(1430, 2116)], 10);
// quay rail along the pier root
fence('pier-rail-w', 'rail', [pt(2958, 2760), pt(2958, 3200)], 4);
fence('pier-rail-e', 'rail', [pt(3072, 2760), pt(3072, 3200)], 4);

// ─────────────────────────── painted ground + landscape ───────────────────────────

const ground: TownGround[] = [
  { id: 'town-dirt', kind: 'dirt', polygon: mainFloor },
  { id: 'north-moss', kind: 'moss', polygon: [pt(1885, 1640), pt(4560, 1600), pt(4560, 1700), pt(1885, 1720)] },
  { id: 'grove-grass', kind: 'grass', polygon: floors[2].polygon },
  // lawns between Lantern Row and the quay, crossed by worn tracks to every harbour-side door
  { id: 'lower-lawn', kind: 'grass', polygon: [pt(1890, 2150), pt(2900, 2160), pt(2860, 2330), pt(3180, 2330), pt(3140, 2160), pt(4560, 2150), pt(4560, 2596), pt(1890, 2596)] },
  { id: 'track-mill', kind: 'dirt', path: [pt(2120, 2100), pt(2070, 2220), pt(2035, 2450)], width: 72 },
  { id: 'track-boathouse', kind: 'dirt', path: [pt(2560, 2100), pt(2480, 2260), pt(2440, 2570)], width: 84 },
  { id: 'track-cottage', kind: 'dirt', path: [pt(3480, 2100), pt(3570, 2260), pt(3605, 2460)], width: 66 },
  { id: 'track-yard', kind: 'dirt', path: [pt(3780, 2100), pt(3940, 2210), pt(4060, 2300)], width: 96 },
  { id: 'track-beacon', kind: 'dirt', path: [pt(3760, 2120), pt(3820, 2260), pt(3840, 2600), pt(4200, 2620)], width: 70 },
  { id: 'quay-walk', kind: 'dirt', path: [pt(1890, 2604), pt(4560, 2604)], width: 46 },
  { id: 'quay-stone', kind: 'flag', polygon: [pt(1890, 2622), pt(4560, 2622), pt(4560, 2706), pt(1890, 2706)] },
  { id: 'lantern-row', kind: 'cobble', path: [pt(1600, 2010), pt(1900, 2005), pt(2300, 2022), pt(2700, 2002), pt(3000, 2012), pt(3400, 2002), pt(3800, 2020), pt(4200, 2006), pt(4600, 2004), pt(5000, 2006)], width: 210 },
  { id: 'square', kind: 'flag', polygon: ring(3020, 2060, 330, 28, 270) },
  { id: 'harbour-lane', kind: 'cobble', path: [pt(3020, 2200), pt(3015, 2440), pt(3015, 2660)], width: 150 },
  { id: 'smith-yard', kind: 'stone', polygon: [pt(3630, 1862), pt(3955, 1862), pt(3960, 1950), pt(3620, 1950)] },
  { id: 'yard-dirt', kind: 'dirt', polygon: [pt(3895, 2310), pt(4325, 2300), pt(4320, 2598), pt(3882, 2598)] },
  { id: 'terrace-flag', kind: 'flag', polygon: [pt(4355, 1660), pt(4555, 1650), pt(4555, 1860), pt(4350, 1866)] },
  { id: 'inn-terrace', kind: 'planks', polygon: [pt(1958, 1868), pt(2382, 1868), pt(2382, 1966), pt(1958, 1966)] },
  { id: 'pier-planks', kind: 'planks', polygon: floors[4].polygon },
  { id: 'breakwater-stone', kind: 'stone', polygon: floors[5].polygon },
  { id: 'bridge-stone', kind: 'stone', polygon: floors[1].polygon },
  { id: 'gate-road', kind: 'dirt', polygon: floors[3].polygon },
  { id: 'shrine-garden', kind: 'garden', polygon: ring(1480, 1890, 150, 18, 120) },
  { id: 'cottage-garden', kind: 'garden', polygon: [pt(3520, 2458), pt(3700, 2458), pt(3700, 2560), pt(3520, 2560)] },
];
const landscape: TownData['landscape'] = [
  { id: 'lake', kind: 'water', polygon: [pt(0, 2700), pt(6144, 2700), pt(6144, 4096), pt(0, 4096)] },
  { id: 'lake-deep', kind: 'deep', polygon: [pt(0, 3300), pt(6144, 3360), pt(6144, 4096), pt(0, 4096)] },
  { id: 'canal', kind: 'water', polygon: [pt(1705, 1500), pt(1882, 1500), pt(1886, 2700), pt(1700, 2700)] },
  { id: 'escarpment', kind: 'cliff', polygon: [pt(1880, 0), pt(6144, 0), pt(6144, 1560), pt(4560, 1600), ...[...mainFloor.slice(0, 19)].reverse().map(([x, y]) => pt(x, y - 4)), pt(1880, 1640)] },
  { id: 'west-woods', kind: 'woods', polygon: [pt(0, 0), pt(1880, 0), pt(1880, 1500), pt(1705, 1500), pt(1700, 1700), pt(1560, 1680), pt(1370, 1690), pt(1270, 1760), pt(1260, 1880), pt(1270, 2130), pt(1360, 2215), pt(1560, 2230), pt(1700, 2200), pt(1700, 2700), pt(0, 2700)] },
  { id: 'east-woods', kind: 'woods', polygon: [pt(4560, 1600), pt(6144, 1560), pt(6144, 2700), pt(4560, 2700), pt(4560, 2090), pt(4990, 2100), pt(5140, 2060), pt(5140, 1940), pt(4960, 1915), pt(4560, 1925)] },
];

// ─────────────────────────── decor (no collision) ───────────────────────────

const decor: NonNullable<TownData['decor']> = [];
const d = (kind: string, x: number, y: number, extra: Partial<NonNullable<TownData['decor']>[number]> = {}) => decor.push({ id: `${kind}-${decor.length}`, kind, x, y, ...extra });
// boats on the lake
d('rowboat', 2890, 2900, { variant: 0 }); d('rowboat', 3150, 3020, { variant: 1, flip: true }); d('fishingboat', 2780, 3150); d('rowboat', 3330, 2830, { variant: 2 }); d('buoy', 3420, 3080); d('buoy', 2620, 2980);
d('islet', 3900, 3600); d('reeds', 1760, 2650); d('reeds', 1840, 1560); d('reeds', 4630, 2740); d('lilypads', 1790, 2380); d('lilypads', 3700, 2860);
// waterwheel on the canal side of the mill
d('waterwheel', 1880, 2350);
// string lights across Lantern Row and the square
d('stringlights', 2700, 1895, { to: pt(2900, 2140) }); d('stringlights', 3150, 2140, { to: pt(3320, 1895) }); d('stringlights', 2010, 2160, { to: pt(2280, 2166) }); d('stringlights', 3420, 2160, { to: pt(3700, 2166) });
d('laundry', 2445, 1870, { to: pt(2610, 1872) });
// harbour clutter lying flat (no collision)
d('nets', 2130, 2670); d('nets', 3340, 2690); d('anchor', 3110, 2660);
// gardens, flowers, animals
d('flowers', 2480, 1878); d('flowers', 2590, 1880); d('flowers', 4045, 1866);
d('flowers', 1420, 1950); d('flowers', 1540, 1960); d('flowers', 3560, 2475); d('flowers', 3660, 2480); d('pond', 1420, 2060);
d('cat', 2350, 1950); d('dog', 3470, 2600); d('mushrooms', 1310, 2080); d('stump', 1660, 1720);
d('steps', 4445, 1872); d('rubble', 4400, 1830); d('rubble', 4530, 1760);
// low parapets along the canal bridge (visual; the bridge floor edge is the collision boundary)
d('parapet', 1702, 1954, { to: pt(1886, 1954) }); d('parapet', 1702, 2068, { to: pt(1886, 2068) });

// trees framing the edges (outside the walkable ground: scenery only)
const treeLine = (kind: string, pts: Point[], every: number, seed: number) => {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
    for (let s = 0; s < len; s += every) {
      const n = Math.sin((s + i * 977 + seed) * 12.9898) * 43758.5453, f = n - Math.floor(n);
      decor.push({ id: `${kind}-edge-${decor.length}`, kind: f > 0.62 ? 'pine' : kind, x: r1(ax + (bx - ax) * s / len + (f - 0.5) * 40), y: r1(ay + (by - ay) * s / len + (f - 0.5) * 30), scale: r1(0.85 + f * 0.4) });
    }
  }
};
treeLine('oak', [pt(1260, 1700), pt(1240, 2240), pt(1700, 2260)], 95, 1);
treeLine('pine', [pt(1300, 1660), pt(1690, 1670)], 85, 2);
treeLine('oak', [pt(4600, 2110), pt(4600, 2650)], 90, 3);
treeLine('pine', [pt(4610, 1640), pt(4600, 1900), pt(4990, 1900), pt(5160, 1930)], 90, 4);
treeLine('oak', [pt(4620, 2120), pt(5000, 2120), pt(5170, 2090)], 95, 5);

// ─────────────────────────── townsfolk (visual only) ───────────────────────────

const residents: NonNullable<TownData['residents']> = [
  { id: 'bard', look: 'bard', name: 'Liesel', x: 2240, y: 1915, facing: 20 },
  { id: 'innkeeper', look: 'innkeeper', name: 'Hob', x: 2075, y: 1890, facing: 25 },
  { id: 'clerk', look: 'clerk', name: 'Wendel', x: 3205, y: 1880, facing: -15 },
  { id: 'guard-n', look: 'guard', name: 'Gate Guard', x: 4486, y: 1972, facing: 30 },
  { id: 'guard-s', look: 'guard', name: 'Gate Guard', x: 4486, y: 2048, facing: 20 },
  { id: 'fisher', look: 'fisher', name: 'Ansel', x: 3015, y: 3225, facing: 170 },
  { id: 'merchant', look: 'merchant', name: 'Saffi', x: 3290, y: 1856, facing: 15 },
  { id: 'scholar', look: 'scholar', name: 'Orsolya', x: 2700, y: 1880, facing: 35 },
  { id: 'pilgrim', look: 'pilgrim', name: 'Pilgrim', x: 1548, y: 1872, facing: -125 },
  { id: 'keeper', look: 'keeper', name: 'Mother Ilse', x: 1395, y: 1890, facing: 30 },
  { id: 'carpenter', look: 'carpenter', name: 'Brannoc', x: 2440, y: 2600, facing: 25 },
  { id: 'fishmonger', look: 'merchant', name: 'Tamsin', x: 2772, y: 2536, facing: 10 },
];
const villagers: NonNullable<TownData['villagers']> = [
  { id: 'lamplighter', look: 'worker', path: [pt(2010, 2120), pt(2560, 2125), pt(3180, 2128), pt(3700, 2124), pt(4260, 2130), pt(3700, 2124), pt(3180, 2128), pt(2560, 2125)], speed: 52, pause: 4 },
  { id: 'porter', look: 'porter', path: [pt(3180, 2560), pt(2860, 2560), pt(2860, 2300), pt(3150, 2320)], speed: 46, pause: 3 },
  { id: 'child', look: 'child', path: [pt(2900, 2180), pt(3120, 2180), pt(3160, 1990), pt(2860, 1980)], speed: 80, pause: 2 },
  { id: 'pilgrim-walk', look: 'pilgrim', path: [pt(1520, 2000), pt(1820, 2010), pt(2200, 2030), pt(1820, 2010)], speed: 34, pause: 5 },
];

// ─────────────────────────── light, life, sound ───────────────────────────

const WARM = 0xffc070, LAMP = 0xffb85a;
const lights: TownData['lights'] = [
  ...lampXs.map((x, i) => ({ id: `lamp-${i}`, position: pt(x, STREET_Y + 150 + (i % 2) * 6), color: LAMP, radius: 210, flicker: 0.06, height: 118 })),
  ...[2400, 2700, 3400, 3700, 4000].map((x, i) => ({ id: `quay-lamp-${i}`, position: pt(x, 2672), color: LAMP, radius: 190, flicker: 0.06, height: 104 })),
  { id: 'pier-lamp', position: pt(3065, 3240), color: LAMP, radius: 180, flicker: 0.07, height: 110 },
  { id: 'inn-glow', position: pt(2170, 1900), color: WARM, radius: 300, flicker: 0.05, building: 'inn' },
  { id: 'inn-hearth', position: pt(2160, 1700), color: 0xff9a4a, radius: 220, flicker: 0.12, building: 'inn' },
  { id: 'forge-fire', position: pt(3760, 1880), color: 0xff8a3a, radius: 300, flicker: 0.14 },
  { id: 'mystic-lamp', position: pt(3480, 1890), color: 0xb98cff, radius: 220, flicker: 0.08 },
  { id: 'cube-glow', position: pt(2790, 1890), color: 0x6fe8dc, radius: 200, flicker: 0.04 },
  { id: 'waypoint-glow', position: pt(3020, 2050), color: 0x7fc4ff, radius: 260, flicker: 0.03 },
  { id: 'obelisk-glow', position: pt(4445, 1765), color: 0xd06aff, radius: 220, flicker: 0.05 },
  { id: 'jeweler-window', position: pt(4050, 1880), color: 0x9ff0e0, radius: 150, flicker: 0.03 },
  { id: 'vault-lamps', position: pt(3115, 1880), color: WARM, radius: 220, flicker: 0.05 },
  { id: 'gate-n', position: pt(4500, 1915), color: 0xff9a4a, radius: 200, flicker: 0.13 },
  { id: 'gate-s', position: pt(4500, 2105), color: 0xff9a4a, radius: 200, flicker: 0.13 },
  { id: 'shrine-candles', position: pt(1480, 1880), color: 0xfff0b8, radius: 200, flicker: 0.07 },
  { id: 'beacon', position: pt(4440, 3080), color: 0xffd38a, radius: 520, flicker: 0.04, height: 420 },
  { id: 'mill-window', position: pt(2030, 2460), color: WARM, radius: 160, flicker: 0.04 },
  { id: 'cottage-c-window', position: pt(3605, 2470), color: WARM, radius: 150, flicker: 0.04 },
];
const emitters: TownData['emitters'] = [
  { id: 'inn-smoke', position: pt(2310, 1370), kind: 'smoke', rate: 7 }, { id: 'inn-smoke-2', position: pt(2020, 1390), kind: 'smoke', rate: 5 },
  { id: 'forge-smoke', position: pt(3900, 1370), kind: 'smoke', rate: 10 }, { id: 'forge-embers', position: pt(3760, 1860), kind: 'embers', rate: 12 },
  { id: 'cottage-a-smoke', position: pt(2575, 1450), kind: 'smoke', rate: 4 }, { id: 'jeweler-smoke', position: pt(4155, 1440), kind: 'smoke', rate: 4 },
  { id: 'mill-smoke', position: pt(2110, 2020), kind: 'smoke', rate: 4 }, { id: 'cottage-c-smoke', position: pt(3650, 2094), kind: 'smoke', rate: 4 },
  { id: 'mystic-motes', position: pt(3480, 1850), kind: 'motes', rate: 9 }, { id: 'cube-motes', position: pt(2790, 1860), kind: 'motes', rate: 6 },
  { id: 'grove-fireflies', position: pt(1480, 1960), kind: 'fireflies', rate: 14 }, { id: 'canal-fireflies', position: pt(1800, 2300), kind: 'fireflies', rate: 10 },
  { id: 'lake-mist', position: pt(3000, 2800), kind: 'fog', rate: 5 }, { id: 'lake-mist-2', position: pt(4100, 2900), kind: 'fog', rate: 4 },
  { id: 'square-leaves', position: pt(2800, 2200), kind: 'leaves', rate: 8 }, { id: 'harbour-gulls', position: pt(3200, 2900), kind: 'birds', rate: 4 },
  { id: 'cliff-crows', position: pt(3600, 1350), kind: 'birds', rate: 2 },
];
const sounds: TownData['sounds'] = [
  { id: 'wind', kind: 'town_wind', position: pt(3020, 2050), radius: 10000 },
  { id: 'forge', kind: 'town_anvil', position: pt(3702, 1932), radius: 620 },
  { id: 'coals', kind: 'town_fire', position: pt(3760, 1880), radius: 430 },
  { id: 'gate-fire', kind: 'town_fire', position: pt(4500, 2010), radius: 360 },
  { id: 'inn', kind: 'town_murmur', position: pt(2170, 1800), radius: 460 },
  { id: 'jewels', kind: 'town_gem', position: pt(4100, 1915), radius: 300 },
  { id: 'mystic', kind: 'town_hum', position: pt(3480, 1885), radius: 300 },
  { id: 'bell', kind: 'town_bell', position: pt(1480, 1860), radius: 1000 },
  { id: 'pier', kind: 'town_water', position: pt(3015, 2900), radius: 760 },
  { id: 'wheel', kind: 'town_water', position: pt(1880, 2350), radius: 520 },
];

// ─────────────────────────── navigation routes (swept-circle checked by the validator) ───────────────────────────

const routes: TownData['routes'] = [
  { label: 'Lantern Row west', points: [pt(1700, 2010), pt(2140, 2010), pt(2780, 2010), pt(3020, 2140)] },
  { label: 'Lantern Row east', points: [pt(3020, 2140), pt(3400, 2030), pt(3760, 2030), pt(4100, 2030), pt(4445, 2000), pt(4600, 2010), pt(5000, 2010)] },
  { label: 'To the grove', points: [pt(1700, 2010), pt(1540, 1990), pt(1540, 1930)] },
  { label: 'To the pier', points: [pt(3020, 2140), pt(3015, 2600), pt(3015, 3200)] },
  { label: 'To the yard', points: [pt(3760, 2030), pt(3990, 2220), pt(4110, 2500)] },
  { label: 'To the terrace', points: [pt(4445, 2000), pt(4445, 1850)] },
  { label: 'To the beacon', points: [pt(3760, 2030), pt(3820, 2250), pt(3840, 2625), pt(4200, 2630), pt(4320, 2980)] },
  { label: 'Into the inn', points: [pt(2138, 1990), pt(2138, 1930), pt(2138, 1790), pt(2200, 1720)] },
];

const districts: TownData['districts'] = [
  { id: 'grove', label: 'Shrine Grove', polygon: floors[2].polygon },
  { id: 'lantern-row', label: 'Lantern Row', polygon: [pt(1885, 1860), pt(4560, 1860), pt(4560, 2160), pt(1885, 2160)] },
  { id: 'square', label: 'Hearth Square', polygon: ring(3020, 2060, 330, 16, 270) },
  { id: 'harbour', label: 'The Harbour', polygon: [pt(1890, 2160), pt(4560, 2160), pt(4560, 2706), pt(1890, 2706)] },
];

const town: TownData = {
  version: 1, id: 'hearthmere', stage: 'complete', size: [96, 64], entry: { x: 3020, y: 2170 },
  floors, buildings, barriers, props, npcs, portals, districts, routes, lights, emitters, sounds,
  landscape, villagers, decor, residents, ground,
  lighting: { ambient: 0xc4cde6, shadow: [0.32, 0.26], strength: 0.34 },
};

fs.writeFileSync(OUT, JSON.stringify(town, null, 1) + '\n');
console.log(`hearthmere.json: ${buildings.length} buildings, ${props.length} props, ${npcs.length} npcs, ${decor.length} decor, ${residents.length} residents`);
