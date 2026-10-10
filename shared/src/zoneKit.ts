// Zone kit (docs/rework/worlds/DESIGN.md §1): a short authored plan → AdventureData + a visual-only paint block.
// Everything is deterministic (hashes of the zone id and coordinates), so server and client build identical collision.
import type { Point } from './townTypes';
import type { AdventureData, Biome, CritterKind, ZoneGroundKind, ZonePaint, ZonePoi } from './adventureTypes';
import type { NpcRole, NpcSpot, Portal, Prop } from './mapgen';
import { TownCollision } from './townCollision';
import { groundBoundary, groundTester, inPolygon, type GroundGeometry } from './townGeometry';
import { MONSTERS } from './data/monsters';

type Kind = AdventureData['interactions'][number]['kind'];
type Member = AdventureData['encounters'][number]['members'][number];
type Role = 'outpost' | 'wild' | 'yard' | 'arena' | 'ruin' | 'secret' | 'room' | 'road';

export function h01(a: number, b: number, s = 0): number {
  let n = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 144269);
  n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function strSeed(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const rect = (x: number, y: number, w: number, h: number): Point[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
/** Organic clearing: an ellipse with smooth low-frequency wobble (no spikes, so packs and the flow field fit). */
export function blob(cx: number, cy: number, rx: number, ry: number, seed: number, n = 18, amp = 0.14): Point[] {
  const p = [h01(seed, 1) * 6.283, h01(seed, 2) * 6.283, h01(seed, 3) * 6.283], out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 + amp * (0.55 * Math.sin(2 * a + p[0]) + 0.3 * Math.sin(3 * a + p[1]) + 0.15 * Math.sin(5 * a + p[2]));
    out.push([Math.round(cx + Math.cos(a) * rx * k), Math.round(cy + Math.sin(a) * ry * k)]);
  }
  return out;
}
/** Chamfered room (dungeons): a rectangle with cut corners. */
export function room(cx: number, cy: number, w: number, h: number, cut = 70): Point[] {
  const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
  return [[x0 + cut, y0], [x1 - cut, y0], [x1, y0 + cut], [x1, y1 - cut], [x1 - cut, y1], [x0 + cut, y1], [x0, y1 - cut], [x0, y0 + cut]];
}
export function lane(a: Point, b: Point, w: number): Point[] {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, x = (-(b[1] - a[1]) / d) * w / 2, y = ((b[0] - a[0]) / d) * w / 2;
  return [[a[0] + x, a[1] + y], [b[0] + x, b[1] + y], [b[0] - x, b[1] - y], [a[0] - x, a[1] - y]];
}
/** River / channel polygon around a polyline (width w), for painted water. */
export function riverPoly(points: Point[], w: number): Point[] {
  const left: Point[] = [], right: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const k = w / 2 * (0.9 + h01(Math.round(points[i][0]), Math.round(points[i][1]), 77) * 0.25);
    left.push([Math.round(points[i][0] - (dy / l) * k), Math.round(points[i][1] + (dx / l) * k)]); right.push([Math.round(points[i][0] + (dy / l) * k), Math.round(points[i][1] - (dx / l) * k)]);
  }
  return [...left, ...right.reverse()];
}
export function octo(p: Point, r: number): Point[] {
  return Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r] as Point; });
}
const segDist = (px: number, py: number, a: Point, b: Point) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t);
};
const area = (p: Point[]) => Math.abs(p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
const bbox = (p: Point[]) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; };

/** Per-biome dressing tables (visual kinds are painted by client/src/render/art/zoneScenery.ts). */
interface BiomeKit { walk: ZoneGroundKind; tall: string[]; low: string[]; solid: [string, number][]; flat: string[]; critters: CritterKind[]; canopy: boolean; dungeon?: boolean }
export const BIOMES: Record<Biome, BiomeKit> = {
  meadow: { walk: 'grass', tall: ['pine', 'oak', 'pine', 'birch'], low: ['bush', 'bush', 'rock', 'fernbed'], solid: [['oak', 22], ['pine', 20], ['boulder', 26], ['stump', 16], ['birch', 18]], flat: ['flowers', 'fern', 'mushrooms', 'tuft', 'tuft'], critters: ['birds', 'butterflies', 'hares'], canopy: true },
  sluice: { walk: 'grass', tall: ['willow', 'pine', 'oak'], low: ['reedclump', 'bush', 'rock'], solid: [['willow', 24], ['boulder', 26], ['stump', 16], ['oak', 22]], flat: ['reeds', 'fern', 'puddle', 'tuft', 'mushrooms'], critters: ['birds', 'frogs', 'butterflies'], canopy: true },
  quarry: { walk: 'gravel', tall: ['crag', 'pine', 'crag'], low: ['rock', 'bush', 'rubblepile'], solid: [['boulder', 28], ['crag', 30], ['pine', 20], ['stump', 16]], flat: ['rubble', 'cracks', 'tuft', 'fern'], critters: ['crows', 'hares'], canopy: false },
  kiln: { walk: 'ash', tall: ['deadtree', 'slagheap', 'crag'], low: ['rock', 'slagheap', 'rubblepile'], solid: [['boulder', 26], ['deadtree', 18], ['slagheap', 26]], flat: ['cracks', 'embers', 'bones', 'rubble'], critters: ['crows', 'moths'], canopy: false },
  fen: { walk: 'mud', tall: ['willow', 'deadtree', 'willow'], low: ['reedclump', 'bush', 'reedclump'], solid: [['willow', 24], ['deadtree', 18], ['stump', 16]], flat: ['reeds', 'puddle', 'tuft', 'mushrooms'], critters: ['frogs', 'crows', 'fish'], canopy: true },
  salt: { walk: 'salt', tall: ['saltpile', 'crag'], low: ['saltpile', 'rock'], solid: [['saltpile', 24], ['boulder', 26]], flat: ['saltcrust', 'cracks', 'rubble'], critters: ['gulls'], canopy: false },
  ridge: { walk: 'slate', tall: ['pine', 'crag', 'pine'], low: ['rock', 'bush'], solid: [['pine', 20], ['crag', 28], ['boulder', 26]], flat: ['rubble', 'snowpatch', 'tuft'], critters: ['crows', 'deer'], canopy: false },
  ward: { walk: 'cobble', tall: ['crag', 'pine'], low: ['rock', 'bush'], solid: [['barrels', 20], ['crates', 22], ['boulder', 26]], flat: ['rubble', 'leaves', 'puddle'], critters: ['crows', 'rats'], canopy: false },
  pump: { walk: 'flag', tall: [], low: [], solid: [['pillar', 22], ['crates', 22], ['barrels', 20]], flat: ['rubble', 'puddle', 'cracks'], critters: ['bats', 'rats'], canopy: false, dungeon: true },
  cistern: { walk: 'tile', tall: [], low: [], solid: [['pillar', 22], ['crates', 22]], flat: ['puddle', 'rubble', 'cracks'], critters: ['bats', 'rats'], canopy: false, dungeon: true },
  array: { walk: 'slate', tall: [], low: [], solid: [['pillar', 22], ['crates', 22]], flat: ['rubble', 'cracks'], critters: ['bats', 'moths'], canopy: false, dungeon: true },
};
const SOLID_R: Record<string, number> = { oak: 22, pine: 20, birch: 18, willow: 24, boulder: 26, crag: 30, stump: 16, deadtree: 18, slagheap: 26, saltpile: 24, pillar: 22, crates: 22, barrels: 20, tent: 46, cart: 34, brokencart: 34, well: 32, logpile: 30, hay: 28, noticeboard: 18, kilnpot: 26, column: 20, statue: 26, cairn: 22, relaymast: 26, anvil: 20, rack: 22, rowboat: 0, bench: 18 };
const FORMATION: Point[] = [[0, 0], [-95, 55], [100, -45], [55, 105], [-80, -95], [150, 40], [-150, -10], [10, -150]];

export class ZoneBuilder {
  readonly floors: Point[][] = [];
  readonly paint: ZonePaint;
  readonly scenery: Prop[] = [];
  readonly buildings: { footprint: Point[] }[] = [];
  readonly npcs: NpcSpot[] = [];
  readonly interactions: AdventureData['interactions'] = [];
  readonly encounters: AdventureData['encounters'] = [];
  readonly portals: Portal[] = [];
  readonly landmarks: AdventureData['landmarks'] = [];
  readonly locations: AdventureData['locations'] = [];
  readonly routes: Point[][] = [];
  readonly paths: AdventureData['paths'] = [];
  readonly events: NonNullable<AdventureData['events']> = [];
  readonly pois: ZonePoi[] = [];
  readonly motion: NonNullable<AdventureData['ambience']>['motion'] = [];
  readonly sounds: NonNullable<AdventureData['ambience']>['sounds'] = [];
  wheel?: AdventureData['wheel'];
  kilns?: AdventureData['kilns'];
  works?: AdventureData['works'];
  dungeon?: AdventureData['dungeon'];
  private regions: { id: string; poly: Point[]; role: Role; roster?: string[]; packs: number; dress: number; size: [number, number] }[] = [];
  private reserved: { x: number; y: number; r: number }[] = [];
  private lanes: { a: Point; b: Point; w: number }[] = [];
  private seed: number;
  constructor(readonly id: string, readonly size: [number, number], readonly biome: Biome, readonly entry: Point, readonly opts: { theme?: 'glade' | 'ashen'; surface?: AdventureData['surface'] } = {}) {
    this.paint = { biome, landscape: [], ground: [], decor: [], lights: [], emitters: [], residents: [], walkers: [], critters: [] };
    this.seed = strSeed(id);
    this.reserve(entry[0], entry[1], 140);
  }
  get kit() { return BIOMES[this.biome]; }
  reserve(x: number, y: number, r: number) { this.reserved.push({ x, y, r }); }

  // ─────────── ground ───────────
  region(id: string, at: Point, r: [number, number], o: { ground?: ZoneGroundKind; role?: Role; roster?: string[]; packs?: number; poly?: Point[]; amp?: number; dress?: number } = {}): Point[] {
    const poly = o.poly ?? blob(at[0], at[1], r[0], r[1], strSeed(this.id + '/' + id), 18, o.amp ?? 0.14);
    this.floors.push(poly);
    this.paint.ground.push({ kind: o.ground ?? this.kit.walk, polygon: poly });
    this.regions.push({ id, poly, role: o.role ?? 'wild', roster: o.roster, packs: o.packs ?? 0, dress: o.dress ?? 1, size: r });
    return poly;
  }
  /** A walkable road: floor lanes with round joints, a painted path and (by default) a validated route. */
  road(points: Point[], w: number, ground: ZoneGroundKind = 'dirt', o: { bridge?: boolean; route?: boolean; paint?: boolean } = {}) {
    for (let i = 1; i < points.length; i++) { this.floors.push(lane(points[i - 1], points[i], w)); this.lanes.push({ a: points[i - 1], b: points[i], w }); }
    for (const p of points) this.floors.push(octo(p, w / 2));
    if (o.paint !== false) this.paint.ground.push({ kind: o.bridge ? 'planks' : ground, path: points, width: o.bridge ? w : w * 0.82 });
    this.paths.push({ points, width: w, ...(o.bridge ? { bridge: true } : {}) });
    if (o.route !== false) this.routes.push(points);
  }
  /** Painted only. */
  land(kind: ZonePaint['landscape'][number]['kind'], polygon: Point[]) { this.paint.landscape.push({ kind, polygon }); }
  ground(kind: ZoneGroundKind, polygon: Point[]) { this.paint.ground.push({ kind, polygon }); }
  wall(footprint: Point[]) { this.buildings.push({ footprint }); }

  // ─────────── story and objects ───────────
  contact(id: string, name: string, x: number, y: number, kind: Kind, role?: NpcRole) {
    this.npcs.push({ id, name, role: role ?? (kind === 'person' ? 'quest' : 'clue'), x, y, r: 18 });
    this.interactions.push({ id, name, x, y, radius: 110, kind });
    this.reserve(x, y, 120);
  }
  /** Story or authored pack. Members may be plain monster ids (formation offsets) or explicit members. */
  pack(id: string, x: number, y: number, members: (string | Member)[]) {
    this.encounters.push({ id, x, y, members: members.map((m, i) => typeof m === 'string' ? { type: m, dx: FORMATION[i % FORMATION.length][0], dy: FORMATION[i % FORMATION.length][1] } : { ...m, dx: m.dx ?? FORMATION[i % FORMATION.length][0], dy: m.dy ?? FORMATION[i % FORMATION.length][1] }) });
    this.reserve(x, y, 170);
  }
  elite(id: string, x: number, y: number, boss: string, name: string, affixes: string[], escort: string[], o: { questTarget?: boolean; combat?: Member['combat'] } = {}) {
    this.pack(id, x, y, [{ type: boss, dx: 0, dy: 0, tier: 2, name, affixes, ...(o.questTarget ? { questTarget: true } : {}), ...(o.combat ? { combat: o.combat } : {}) }, ...escort]);
  }
  portal(x: number, y: number, to: string, label: string) { this.portals.push({ x, y, to, label }); this.reserve(x, y, 130); }
  location(id: string, x: number, y: number, radius = 110) { this.locations.push({ id, x, y, radius }); this.reserve(x, y, 60); }
  landmark(name: string, x: number, y: number) { this.landmarks.push({ name, x, y }); }
  event(id: string, name: string, trigger: string, encounter: string, blurb: string, action: string) { this.events.push({ id, name, trigger, encounter, blurb, action }); }
  shrine(id: string, x: number, y: number, kind: NonNullable<ZonePoi['shrine']>) {
    const names = { empowered: 'Empowered Shrine', frenzied: 'Frenzied Shrine', keen: 'Keen Shrine' } as const;
    this.pois.push({ id, kind: 'shrine', name: names[kind], x, y, radius: 110, shrine: kind }); this.reserve(x, y, 110);
    this.light(x, y - 30, kind === 'empowered' ? 0xff9a5a : kind === 'frenzied' ? 0x9ad8ff : 0xd8b0ff, 160);
  }
  cache(id: string, x: number, y: number, name = 'Hidden cache') { this.pois.push({ id, kind: 'cache', name, x, y, radius: 110 }); this.reserve(x, y, 100); }
  light(x: number, y: number, color: number, radius: number, flicker = 0.12) { this.paint.lights.push({ x, y, color, radius, flicker }); }
  emit(kind: ZonePaint['emitters'][number]['kind'], x: number, y: number, rate = 6) { this.paint.emitters.push({ kind, x, y, rate }); }
  critters(kind: CritterKind, x: number, y: number, r = 180, n = 5) { this.paint.critters.push({ kind, x, y, r, n }); }
  resident(id: string, look: string, name: string, x: number, y: number, facing?: number) { this.paint.residents.push({ id, look, name, x, y, ...(facing !== undefined ? { facing } : {}) }); this.reserve(x, y, 50); }
  walker(id: string, look: string, path: Point[], speed = 55, pause = 3) { this.paint.walkers.push({ id, look, path, speed, pause }); }
  decor(kind: string, x: number, y: number, s = 1, v?: number, flip?: boolean) { this.paint.decor.push({ kind, x, y, ...(s !== 1 ? { s } : {}), ...(v !== undefined ? { v } : {}), ...(flip ? { flip } : {}) }); }
  /** Solid prop (collision circle r × s). */
  solid(kind: string, x: number, y: number, s = 1, v = 0, r?: number) { this.scenery.push({ k: kind, x, y, r: r ?? SOLID_R[kind] ?? 20, s, v }); }
  sound(kind: 'water' | 'wind' | 'fire', x: number, y: number, radius = 720) { this.sounds.push({ id: `${kind}-${this.sounds.length}`, kind, position: [x, y], radius }); }
  mist(x: number, y: number, width = 360) { this.motion.push({ id: `mist-${this.motion.length}`, kind: 'mist', position: [x, y], width }); }

  // ─────────── vignettes: small stories told by objects ───────────
  camp(x: number, y: number, o: { fire?: boolean; tents?: number; flag?: boolean } = {}) {
    const v = (k: number) => Math.floor(h01(x + k, y, this.seed) * 3);
    if (o.fire !== false) { this.decor('campfire', x, y); this.light(x, y - 10, 0xffb060, 260, 0.3); this.emit('smoke', x, y - 30, 5); this.emit('embers', x, y - 20, 4); this.sound('fire', x, y, 420); }
    const tents = o.tents ?? 2;
    for (let i = 0; i < tents; i++) this.solid('tent', x - 210 + i * 300, y - 150 - (i % 2) * 40, 1, v(i));
    this.solid('logpile', x + 170, y + 40, 1, v(5)); this.solid('crates', x - 160, y + 70, 1, v(6));
    this.decor('bench', x - 40, y + 95); this.decor('barrel', x + 120, y + 120, 1, v(7));
    if (o.flag !== false) this.decor('banner', x + 260, y - 60);
  }
  wreck(x: number, y: number) {
    this.solid('brokencart', x, y, 1, 0); this.decor('barrel', x + 70, y + 40, 1, 2); this.decor('crate', x - 80, y + 30); this.decor('crate', x - 60, y + 60, 0.9, 1);
    this.decor('rubble', x + 20, y + 70); this.decor('sack', x + 100, y - 10);
  }
  lumber(x: number, y: number) { this.solid('logpile', x, y); this.solid('logpile', x + 120, y + 40, 0.9, 1); this.decor('stumpflat', x - 90, y + 60); this.decor('stumpflat', x + 40, y + 110); this.decor('sawhorse', x - 40, y - 20); }
  graves(x: number, y: number, n = 5) { for (let i = 0; i < n; i++) this.decor('grave', x + (i % 3) * 70 - 70 + h01(i, 1, this.seed) * 16, y + Math.floor(i / 3) * 60 + h01(i, 2, this.seed) * 12, 1, i % 3); this.decor('leaves', x, y + 40); }
  ruins(x: number, y: number, w = 360, h = 240) {
    this.wall([[x - w / 2, y - h / 2], [x - w / 2 + 120, y - h / 2], [x - w / 2 + 120, y - h / 2 + 34], [x - w / 2 + 34, y - h / 2 + 34], [x - w / 2 + 34, y - h / 2 + 150], [x - w / 2, y - h / 2 + 150]]);
    this.wall([[x + w / 2 - 34, y - h / 2 + 40], [x + w / 2, y - h / 2 + 40], [x + w / 2, y + h / 2 - 30], [x + w / 2 - 34, y + h / 2 - 30]]);
    this.solid('column', x + 30, y - h / 2 + 10, 1, 1); this.decor('rubble', x - 40, y + 30); this.decor('rubble', x + 90, y + 70, 1.2);
  }
  fishery(x: number, y: number) { this.decor('netrack', x, y - 20); this.decor('fishcrates', x + 90, y + 30); this.decor('barrel', x - 70, y + 30, 1, 1); this.decor('nets', x + 10, y + 70); }
  quarryCut(x: number, y: number) { this.solid('crag', x, y, 1.2, 1); this.solid('crag', x + 140, y - 30, 1, 2); this.decor('rubblepile', x + 70, y + 60); this.decor('cracks', x - 60, y + 80); this.decor('rubble', x + 160, y + 70, 1.2); this.decor('pickaxe', x + 40, y + 40); }
  kilnYard(x: number, y: number) { this.solid('kilnpot', x, y); this.solid('kilnpot', x + 110, y + 20, 0.85, 1); this.decor('coalpile', x - 90, y + 40); this.decor('embers', x + 50, y + 70); this.emit('smoke', x, y - 70, 5); this.light(x, y - 20, 0xff8a3a, 200, 0.25); }
  saltWorks(x: number, y: number) { this.solid('saltpile', x, y, 1.1); this.solid('saltpile', x + 100, y + 30, 0.8, 1); this.decor('rake', x - 70, y + 30); this.decor('saltcrust', x + 30, y + 80, 1.3); this.decor('barrel', x - 100, y - 20); }
  signalPost(x: number, y: number) { this.solid('relaymast', x, y); this.decor('signalflag', x + 60, y + 20); this.decor('signalflag', x - 60, y + 30, 1, 1); this.decor('crate', x + 30, y + 70); }
  wardPost(x: number, y: number) { this.decor('banner', x - 60, y - 20); this.decor('banner', x + 60, y - 20); this.solid('barrels', x, y + 30); this.decor('lamp', x + 110, y + 10); this.light(x + 110, y - 40, 0xffc070, 200); }

  // ─────────── build ───────────
  build(): AdventureData {
    const geometry: GroundGeometry = { entry: { x: this.entry[0], y: this.entry[1] }, floors: this.floors.map((polygon) => ({ polygon })), buildings: [...this.buildings, ...(this.kilns ?? []).map((k) => ({ footprint: rect(k.x, k.y, k.w, k.d) })), ...(this.works ?? []).map((k) => ({ footprint: rect(k.x, k.y, k.w, k.d) }))], barriers: [], props: [], npcs: [] };
    const ground = groundTester(geometry);
    const base = new TownCollision({ ...geometry, props: [...this.scenery.filter((p) => p.r > 0).map((p) => ({ x: p.x, y: p.y, radius: p.r * p.s })), ...(this.wheel ? [this.wheel] : [])], npcs: this.npcs });
    const free = (x: number, y: number, r: number) => base.isFree(x, y, r);
    // Story members first: nudge any member that landed on a wall, deterministic spiral.
    const settle = (e: AdventureData['encounters'][number]) => {
      for (const m of e.members) {
        const r = (MONSTERS[m.type]?.radius ?? 20) + 4;
        if (free(e.x + m.dx, e.y + m.dy, r)) continue;
        let done = false;
        for (let d = 20; d <= 220 && !done; d += 20) for (let k = 0; k < 12 && !done; k++) {
          const a = (k / 12) * Math.PI * 2, dx = Math.round(m.dx * (1 - d / 260) + Math.cos(a) * d * 0.6), dy = Math.round(m.dy * (1 - d / 260) + Math.sin(a) * d * 0.6);
          if (free(e.x + dx, e.y + dy, r)) { m.dx = dx; m.dy = dy; done = true; }
        }
        if (!done) { m.dx = 0; m.dy = 0; }
      }
    };
    for (const e of this.encounters) settle(e);
    // Authored solids (vignettes) never sit on a route or crowd a contact/portal: push them aside, else make them decor.
    const routeGap = (x: number, y: number) => Math.min(Infinity, ...this.routes.flatMap((rt) => rt.slice(1).map((p, i) => segDist(x, y, rt[i], p))));
    const crowds = (x: number, y: number, r: number) => routeGap(x, y) < r + 34 || [...this.interactions, ...this.portals, ...this.pois].some((q) => Math.hypot(q.x - x, q.y - y) < r + 95);
    for (let i = this.scenery.length - 1; i >= 0; i--) {
      const p = this.scenery[i], r = p.r * p.s;
      if (!crowds(p.x, p.y, r)) continue;
      let moved = false;
      for (let d = 20; d <= 240 && !moved; d += 20) for (let k = 0; k < 12 && !moved; k++) {
        const a = (k / 12) * Math.PI * 2, x = Math.round(p.x + Math.cos(a) * d), y = Math.round(p.y + Math.sin(a) * d);
        if (ground(x, y) && !crowds(x, y, r) && free(x, y, r + 4)) { p.x = x; p.y = y; moved = true; }
      }
      if (!moved) { this.scenery.splice(i, 1); this.decor(p.k, p.x, p.y, p.s, p.v); }
    }
    // Ambient packs per region, ≥ 520 u apart, away from the entry, contacts and outposts.
    const spots = (): Point[] => this.encounters.map((e) => [e.x, e.y]);
    for (const reg of this.regions) {
      if (!reg.packs || !reg.roster?.length) continue;
      const b = bbox(reg.poly), cands: Point[] = [];
      for (let i = 0; i < 160; i++) {
        const x = b.x0 + h01(i, 11, strSeed(reg.id) ^ this.seed) * (b.x1 - b.x0), y = b.y0 + h01(i, 12, strSeed(reg.id) ^ this.seed) * (b.y1 - b.y0);
        if (inPolygon(x, y, reg.poly) && ground(x, y) && free(x, y, 70)) cands.push([Math.round(x), Math.round(y)]);
      }
      let placed = 0;
      for (const [x, y] of cands) {
        if (placed >= reg.packs) break;
        if (Math.hypot(x - this.entry[0], y - this.entry[1]) < 780) continue;
        if (spots().some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 520)) continue;
        if (this.reserved.some((r) => Math.hypot(r.x - x, r.y - y) < r.r + 150)) continue;
        if (this.regions.some((o) => o.role === 'outpost' && inPolygon(x, y, o.poly))) continue;
        const roster = reg.roster, n = 4 + Math.floor(h01(x, y, this.seed) * 3);
        const e = { id: `amb_${reg.id}_${placed}`, x, y, members: Array.from({ length: n }, (_, i) => ({ type: roster[(i + Math.floor(h01(i, x, y) * roster.length)) % roster.length], dx: FORMATION[i][0] * 0.9, dy: FORMATION[i][1] * 0.9 })) };
        settle(e); this.encounters.push(e); this.reserve(x, y, 160); placed++;
      }
    }
    const nearLane = (x: number, y: number, pad: number) => this.lanes.some((l) => segDist(x, y, l.a, l.b) < l.w / 2 + pad);
    const blocked = (x: number, y: number, r: number) => this.reserved.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + r)
      || this.encounters.some((e) => e.members.some((m) => Math.hypot(e.x + m.dx - x, e.y + m.dy - y) < r + 60))
      || this.npcs.some((n) => Math.hypot(n.x - x, n.y - y) < r + 120)
      || this.routes.some((rt) => rt.some((p, i) => i > 0 && segDist(x, y, rt[i - 1], p) < r + 60));
    // Solid dressing inside wild / yard / ruin regions (trees, boulders, stumps): breaks open floors into lanes.
    const solids: Point[] = this.scenery.map((p) => [p.x, p.y]);
    for (const reg of this.regions) {
      if (reg.role !== 'wild' && reg.role !== 'ruin' && reg.role !== 'secret' && reg.role !== 'room') continue;
      const want = Math.round((area(reg.poly) / 140000) * reg.dress), b = bbox(reg.poly), table = this.kit.solid;
      let placed = 0;
      for (let i = 0; i < want * 8 && placed < want; i++) {
        const s = strSeed(reg.id + 'solid') ^ this.seed, x = Math.round(b.x0 + h01(i, 21, s) * (b.x1 - b.x0)), y = Math.round(b.y0 + h01(i, 22, s) * (b.y1 - b.y0));
        const [kind, r] = table[Math.floor(h01(i, 23, s) * table.length)], sc = 0.85 + h01(i, 24, s) * 0.35;
        if (!inPolygon(x, y, reg.poly) || !free(x, y, r * sc + 34) || nearLane(x, y, r * sc + 40) || blocked(x, y, r * sc + 30)) continue;
        if (solids.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 110)) continue;
        this.scenery.push({ k: kind, x, y, r, s: Math.round(sc * 100) / 100, v: Math.floor(h01(i, 25, s) * 3) }); solids.push([x, y]); placed++;
      }
    }
    // Edge band: north edges rise (tall trees, crags), south edges stay low so nothing hides the hero.
    const edges = groundBoundary(geometry), water = this.paint.landscape.filter((l) => l.kind !== 'cliff');
    const inWater = (x: number, y: number) => water.some((l) => inPolygon(x, y, l.polygon));
    const nearPortal = (x: number, y: number) => this.portals.some((p) => Math.hypot(p.x - x, p.y - y) < 170);
    if (!this.kit.dungeon) {
      const taken: Point[] = [];
      for (const e of edges) {
        const len = Math.hypot(e.bx - e.ax, e.by - e.ay), ox = -e.nx, oy = -e.ny;
        for (let t = 30; t < len; t += 78) {
          const k = h01(Math.round(e.ax + t), Math.round(e.ay), this.seed), px = e.ax + ((e.bx - e.ax) * t) / len, py = e.ay + ((e.by - e.ay) * t) / len;
          const north = oy < -0.35, south = oy > 0.35, depth = north ? 70 + k * 80 : 45 + k * 50;
          const x = Math.round(px + ox * depth), y = Math.round(py + oy * depth);
          if (ground(x, y) || inWater(x, y) || nearPortal(x, y)) continue;
          if (taken.some(([tx, ty]) => Math.abs(tx - x) < 56 && Math.abs(ty - y) < 40)) continue;
          const list = north ? this.kit.tall : south ? this.kit.low : (k > 0.5 ? this.kit.tall : this.kit.low);
          if (!list.length) continue;
          this.decor(list[Math.floor(k * 997) % list.length], x, y, Math.round((0.85 + h01(x, y, 7) * 0.4) * 100) / 100, Math.floor(h01(y, x, 9) * 3), h01(x, 3, y) > 0.5);
          taken.push([x, y]);
          if (north && h01(x, y, 13) > 0.35) {
            const x2 = Math.round(x + ox * 90 + (h01(x, y, 14) - 0.5) * 60), y2 = Math.round(y + oy * 90);
            if (!ground(x2, y2) && !inWater(x2, y2)) { this.decor(this.kit.tall[Math.floor(h01(x2, y2, 3) * this.kit.tall.length)], x2, y2, 1 + h01(x2, y2, 4) * 0.35, Math.floor(h01(x2, y2, 5) * 3)); taken.push([x2, y2]); }
          }
        }
      }
    }
    // Flat decor on the walkable ground (flowers, ferns, rubble…), clustered by region.
    for (const reg of this.regions) {
      const want = Math.round(area(reg.poly) / 26000), b = bbox(reg.poly), s = strSeed(reg.id + 'flat') ^ this.seed, list = this.kit.flat;
      for (let i = 0; i < want; i++) {
        const x = Math.round(b.x0 + h01(i, 31, s) * (b.x1 - b.x0)), y = Math.round(b.y0 + h01(i, 32, s) * (b.y1 - b.y0));
        if (!inPolygon(x, y, reg.poly) || nearLane(x, y, 10)) continue;
        this.decor(list[Math.floor(h01(i, 33, s) * list.length)], x, y, Math.round((0.8 + h01(i, 34, s) * 0.5) * 100) / 100, Math.floor(h01(i, 35, s) * 3));
      }
      // Life: one critter group in most wild regions.
      if ((reg.role === 'wild' || reg.role === 'secret') && h01(strSeed(reg.id), 41, this.seed) > 0.25) {
        const kinds = this.kit.critters, kind = kinds[Math.floor(h01(strSeed(reg.id), 42, this.seed) * kinds.length)];
        const c = reg.poly.reduce((acc, p) => [acc[0] + p[0] / reg.poly.length, acc[1] + p[1] / reg.poly.length] as Point, [0, 0] as Point);
        this.critters(kind, Math.round(c[0]), Math.round(c[1]), Math.min(reg.size[0], reg.size[1]) * 0.6, kind === 'deer' || kind === 'hares' ? 2 : 5);
      }
    }
    for (const l of this.paint.landscape) if (l.kind === 'water' || l.kind === 'deep') { const b = bbox(l.polygon); this.critters('fish', Math.round((b.x0 + b.x1) / 2), Math.round((b.y0 + b.y1) / 2), Math.min(b.x1 - b.x0, b.y1 - b.y0) * 0.35, 3); }
    return {
      id: this.id, size: this.size, ...(this.opts.theme ? { theme: this.opts.theme } : {}), ...(this.opts.surface ? { surface: this.opts.surface } : {}),
      paint: this.paint, pois: this.pois, ...(this.events.length ? { events: this.events } : {}), ...(this.dungeon ? { dungeon: this.dungeon } : {}),
      ...(this.kilns ? { kilns: this.kilns } : {}), ...(this.works ? { works: this.works } : {}),
      ambience: { motion: this.motion, sounds: this.sounds },
      geometry: { entry: { x: this.entry[0], y: this.entry[1] }, floors: this.floors.map((polygon) => ({ polygon })), buildings: this.buildings.map((b) => ({ footprint: b.footprint })), barriers: [], props: [], npcs: [] },
      paths: this.paths, scenery: this.scenery, npcs: this.npcs, portals: this.portals, interactions: this.interactions, encounters: this.encounters,
      landmarks: this.landmarks, locations: this.locations, ...(this.wheel ? { wheel: this.wheel } : {}), routes: this.routes,
    };
  }
}
