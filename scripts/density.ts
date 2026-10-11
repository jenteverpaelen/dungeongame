// Screen density probe (docs/rework/worlds/LOG.md W4): counts what one 1920×1080 screen shows at the default camera
// (1470 × 827 world units) — structures, props, decals, critters, residents/walkers, packs — from the authored data.
// Reference: the Hearthmere square. Zones: outposts, wild regions and samples every 700 u along every road.
//   npx tsx scripts/density.ts [zone ...]
import town from '../shared/src/data/town/hearthmere.json';
import { ADVENTURES } from '../shared/src/adventure';
import { ZONE_FLAT_KINDS } from '../shared/src/zoneKit';
import type { AdventureData } from '../shared/src/adventureTypes';
import { groundTester, type GroundGeometry } from '../shared/src/townGeometry';

const VW = 1470, VH = 827;
type Counts = { structures: number; props: number; decals: number; critters: number; people: number; packs: number; total: number; interior: number; coverage: number };
/** Approximate on-screen footprint (u²) of one sprite by kind: what fills a screen, not how many things are listed. */
const AREA: Record<string, number> = { ashboulder: 3500, saltboulder: 3500, ashcrag: 11000, saltcrag: 11000, ashrock: 2200, saltrock: 2200, log: 2500, fence: 2000, stake: 1200, menhir: 4000, walltorch: 1200, pipe: 3500, crystal: 2000, cairn: 2500, signalflag: 2000, brazier: 1800, sack: 900, crate: 1200, barrel: 1200, table: 2500, bench: 2000, sawhorse: 2000, oak: 17000, pine: 13000, birch: 9000, willow: 17000, deadtree: 9000, crag: 11000, tent: 9000, well: 7000, cart: 6000, brokencart: 7000, logpile: 3500, hay: 3500, crane: 14000, fishingboat: 20000, rowboat: 4000, waterwheel: 18000, kilnpot: 7000, slagheap: 4000, saltpile: 4000, pillar: 4000, column: 3500, relaymast: 7000, noticeboard: 3000, banner: 2500, signpost: 2500, lamp: 1800, lamppost: 1800, crates: 2500, barrels: 2500, boulder: 3500, rock: 2200, bush: 3000, reedclump: 2500 };
const sizeOf = (kind?: string) => AREA[kind ?? ''] ?? 1500;
const inView = (cx: number, cy: number, x: number, y: number, pad = 0) => Math.abs(x - cx) <= VW / 2 + pad && Math.abs(y - cy) <= VH / 2 + pad;
const centroid = (p: number[][]) => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
const sum = (c: Omit<Counts, 'total'>): Counts => ({ ...c, coverage: Math.round(Math.min(1, c.coverage / (VW * VH)) * 100), total: c.structures + c.props + c.decals + c.critters + c.people + c.packs });

export function townCounts(cx: number, cy: number): Counts {
  const T = town as unknown as { buildings: { footprint: number[][] }[]; props: { x: number; y: number; kind?: string }[]; decor: { x: number; y: number; kind: string }[]; residents: { x: number; y: number }[]; villagers: { path: number[][] }[]; npcs: { x: number; y: number; role: string }[]; emitters: { position: number[]; kind: string; rate: number }[] };
  const flat = new Set(['islet', 'reeds', 'lilypads', 'pond', 'flowers', 'mushrooms', 'rubble', 'steps', 'nets', 'anchor', 'stump']);
  const life = new Set(['birds', 'fireflies', 'leaves']);
  const g = groundTester(town as unknown as GroundGeometry), inside = (x: number, y: number) => g(x, y);
  const vis = <T extends { x: number; y: number }>(l: T[]) => l.filter((p) => inView(cx, cy, p.x, p.y));
  const blds = T.buildings.filter((b) => b.footprint.some(([x, y]) => inView(cx, cy, x, y, 60)));
  const bArea = blds.reduce((s, b) => { const xs = b.footprint.map((p) => p[0]), ys = b.footprint.map((p) => p[1]); return s + (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys) + 180); }, 0);
  const tall = vis(T.decor).filter((d) => !flat.has(d.kind));
  return sum({
    interior: vis(T.props).filter((p) => inside(p.x, p.y)).length + tall.filter((d) => inside(d.x, d.y)).length + vis(T.residents).length + blds.length,
    coverage: bArea + vis(T.props).reduce((s, p) => s + sizeOf(p.kind), 0) + tall.reduce((s, d) => s + sizeOf(d.kind), 0) + vis(T.residents).length * 2100,
    structures: T.buildings.filter((b) => b.footprint.some(([x, y]) => inView(cx, cy, x, y, 60))).length,
    props: T.props.filter((p) => inView(cx, cy, p.x, p.y)).length + T.decor.filter((d) => !flat.has(d.kind) && inView(cx, cy, d.x, d.y)).length + T.npcs.filter((n) => n.role !== 'dummy' && inView(cx, cy, n.x, n.y)).length,
    decals: T.decor.filter((d) => flat.has(d.kind) && inView(cx, cy, d.x, d.y)).length,
    critters: T.emitters.filter((e) => life.has(e.kind) && inView(cx, cy, e.position[0], e.position[1], 200)).reduce((s, e) => s + e.rate, 0),
    people: T.residents.filter((r) => inView(cx, cy, r.x, r.y)).length + T.villagers.filter((v) => v.path.some(([x, y]) => inView(cx, cy, x, y))).length,
    packs: 0,
  });
}

export function zoneCounts(a: AdventureData, cx: number, cy: number): Counts {
  const p = a.paint!, flat = ZONE_FLAT_KINDS;
  const walls = a.geometry.buildings.filter((b) => b.footprint.some(([x, y]) => inView(cx, cy, x, y, 60))).length;
  const big = (p.structures ?? []).filter((s) => inView(cx, cy, s.x, s.y, 120)).length;
  const works = [...(a.kilns ?? []), ...(a.works ?? [])].filter((k) => inView(cx, cy, k.x, k.y, 60)).length + (a.wheel && inView(cx, cy, a.wheel.x, a.wheel.y) ? 1 : 0);
  const g = groundTester(a.geometry), inside = (x: number, y: number) => g(x, y);
  const vis = <T extends { x: number; y: number }>(l: T[]) => l.filter((q) => inView(cx, cy, q.x, q.y));
  const tall = vis(p.decor).filter((d) => !flat.has(d.kind)), solid = vis(a.scenery);
  const structArea = (p.structures ?? []).filter((s) => inView(cx, cy, s.x, s.y, 120)).reduce((s, q) => s + q.w * (q.d + 260), 0) + a.geometry.buildings.filter((b) => b.footprint.some(([x, y]) => inView(cx, cy, x, y, 60))).reduce((s, b) => { const xs = b.footprint.map((q) => q[0]), ys = b.footprint.map((q) => q[1]); return s + (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys) + 90); }, 0) + [...(a.kilns ?? []), ...(a.works ?? [])].filter((k) => inView(cx, cy, k.x, k.y, 60)).reduce((s, k) => s + k.w * (k.d + k.h), 0);
  const packsIn = a.encounters.filter((e) => inView(cx, cy, e.x, e.y));
  return sum({
    interior: solid.filter((q) => inside(q.x, q.y)).length + tall.filter((d) => inside(d.x, d.y)).length + vis(p.residents).length + walls + big + works + vis(a.interactions).length + vis(a.pois ?? []).length + packsIn.reduce((s, e) => s + e.members.length, 0),
    coverage: structArea + solid.reduce((s, q) => s + sizeOf(q.k) * q.s, 0) + tall.reduce((s, d) => s + sizeOf(d.kind) * (d.s ?? 1), 0) + vis(p.residents).length * 2100 + packsIn.reduce((s, e) => s + e.members.length * 1600, 0),
    structures: walls + big + works,
    props: a.scenery.filter((s) => inView(cx, cy, s.x, s.y)).length + p.decor.filter((d) => !flat.has(d.kind) && inView(cx, cy, d.x, d.y)).length
      + a.interactions.filter((i) => inView(cx, cy, i.x, i.y)).length + (a.pois ?? []).filter((q) => inView(cx, cy, q.x, q.y)).length,
    decals: p.decor.filter((d) => flat.has(d.kind) && inView(cx, cy, d.x, d.y)).length,
    critters: p.critters.filter((c) => inView(cx, cy, c.x, c.y, c.r)).reduce((s, c) => s + c.n, 0) + p.emitters.filter((e) => (e.kind === 'birds' || e.kind === 'fireflies' || e.kind === 'leaves') && inView(cx, cy, e.x, e.y, 200)).reduce((s, e) => s + e.rate, 0),
    people: p.residents.filter((r) => inView(cx, cy, r.x, r.y)).length + p.walkers.filter((w) => w.path.some(([x, y]) => inView(cx, cy, x, y))).length,
    packs: a.encounters.filter((e) => inView(cx, cy, e.x, e.y)).length,
  });
}

/** Screens to judge: outposts, wild regions, and road samples (≥ 900 u from any outpost centre). */
export function zoneScreens(a: AdventureData): { kind: 'outpost' | 'wild' | 'route' | 'open'; id: string; c: Counts }[] {
  const out: { kind: 'outpost' | 'wild' | 'route' | 'open'; id: string; c: Counts }[] = [];
  const areas = a.paint?.areas ?? [];
  for (const r of areas) {
    const kind = r.role === 'outpost' ? 'outpost' : r.role === 'arena' ? 'open' : 'wild';
    out.push({ kind, id: r.id, c: zoneCounts(a, r.x, r.y) });
  }
  for (const route of a.routes) for (let i = 1; i < route.length; i++) {
    const [x0, y0] = route[i - 1], [x1, y1] = route[i], len = Math.hypot(x1 - x0, y1 - y0);
    for (let t = 350; t < len; t += 700) {
      const x = x0 + (x1 - x0) * t / len, y = y0 + (y1 - y0) * t / len;
      if (areas.some((r) => r.role === 'outpost' && Math.hypot(r.x - x, r.y - y) < 900)) continue;
      out.push({ kind: 'route', id: `road@${Math.round(x)},${Math.round(y)}`, c: zoneCounts(a, x, y) });
    }
  }
  return out;
}

if (process.argv[1]?.endsWith('density.ts')) {
  const wp = (town as unknown as { npcs: { role: string; x: number; y: number }[] }).npcs.find((n) => n.role === 'waypoint')!;
  const ref = townCounts(wp.x, wp.y);
  console.log(`town square reference ${JSON.stringify(ref)}`);
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ADVENTURES);
  const metric = (process.env.METRIC ?? 'interior') as 'total' | 'interior' | 'coverage';
  console.log(`metric: ${metric} (town square = ${ref[metric]})`);
  console.log('| zone | outposts min / avg (% of town) | wild min / avg (%) | route min / avg (%) | screens below 35% |');
  console.log('|---|---|---|---|---|');
  for (const id of ids) {
    const a = ADVENTURES[id]; if (!a?.paint) continue;
    const s = zoneScreens(a), pct = (n: number) => Math.round((n / ref[metric]) * 100);
    const stat = (k: string) => { const v = s.filter((x) => x.kind === k).map((x) => x.c[metric]); return v.length ? `${pct(Math.min(...v))} / ${pct(v.reduce((q, w) => q + w, 0) / v.length)}` : '–'; };
    const low = s.filter((x) => x.kind !== 'open' && x.c[metric] < ref[metric] * 0.35).map((x) => x.id);
    console.log(`| ${id} | ${stat('outpost')} | ${stat('wild')} | ${stat('route')} | ${low.length}/${s.filter((x) => x.kind !== 'open').length}${low.length ? ' (' + low.slice(0, 4).join(', ') + (low.length > 4 ? '…' : '') + ')' : ''} |`);
    if (process.env.DETAIL) for (const x of s) console.log('   ', x.kind, x.id, JSON.stringify(x.c));
  }
}
