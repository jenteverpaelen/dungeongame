// Zone layers (docs/rework/worlds/DESIGN.md §1): painted ground chunks + y-sorted kit sprites (shared textures per
// kind/scale/variant) + painted walls and the authored structures. Built once per map load.
import { CanvasSource, Container, Sprite, Texture } from 'pixi.js';
import type { MapData } from '@shared/mapgen';
import type { Point } from '@shared/townTypes';
import type { MapLayers } from './index';
import { adventureStructures } from './adventure';
import { flameSprite, glowSprite } from './fx';
import { ellipse, hash, INK, line, poly, tone, type Paint } from './townKit';
import { zoneArt, ZONE_FLAT, ZONE_TALL } from './zoneArt';
import { rotorArt, structureArt } from './zoneStructures';
import { ZoneGround, ZONE_PAL } from './zoneGround';
import { prewarmMonsters } from './monsters';
import { summonRigs } from './summons';

const DENSITY = 1.6;
const cache = new Map<string, Texture>();
function texture(key: string, art: NonNullable<ReturnType<typeof zoneArt>>): Texture {
  const hit = cache.get(key); if (hit && !hit.destroyed) return hit;
  const b = art.box, w = Math.max(2, Math.ceil(b.x1 - b.x0)), h = Math.max(2, Math.ceil(b.y1 - b.y0));
  const canvas = document.createElement('canvas'); canvas.width = Math.ceil(w * DENSITY); canvas.height = Math.ceil(h * DENSITY);
  const c = canvas.getContext('2d')!; c.setTransform(DENSITY, 0, 0, DENSITY, -b.x0 * DENSITY, -b.y0 * DENSITY); art.draw(c);
  const tex = new Texture({ source: new CanvasSource({ resource: canvas, resolution: DENSITY, scaleMode: 'linear', autoGenerateMipmaps: true }) });
  cache.set(key, tex); return tex;
}
/**
 * Props are painted at their scale rounded up to a quarter step and the sprite is scaled down to the exact size (never up).
 * One canvas per exact random scale made ≈ 700 textures per field zone (120 MB of canvases in Rillwake, 369 MB over all
 * zones, kept by the cache and uploaded one by one while walking); quarter steps keep ≤ 100 per zone (LOG W4, D-W15).
 */
const SCALE_STEP = 0.25;
function place(kind: string, s: number, v: number, x: number, y: number, flip = false) {
  const sq = Math.max(SCALE_STEP, Math.ceil(s / SCALE_STEP - 1e-6) * SCALE_STEP), k = s / sq;
  const art = zoneArt(kind, sq, v); if (!art) return null;
  const root = new Container(), sp = new Sprite(texture(`z:${kind}:${sq.toFixed(2)}:${v}`, art));
  sp.position.set(art.box.x0, art.box.y0); root.addChild(sp); root.position.set(x, y); root.scale.set(flip ? -k : k, k);
  const bounds = { x0: x + (flip ? -art.box.x1 : art.box.x0) * k, x1: x + (flip ? -art.box.x0 : art.box.x1) * k, y0: y + art.box.y0 * k, y1: y + art.box.y1 * k };
  return { root, bounds };
}
/** Stone wall block over an authored footprint: dressed courses on the front face, a capped top. */
function wallArt(fp: Point[], biome: string): { root: Container; y: number } {
  const xs = fp.map((p) => p[0]), ys = fp.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const h = biome === 'pump' || biome === 'cistern' || biome === 'array' ? 120 : 74, w = x1 - x0, d = y1 - y0;
  const canvas = document.createElement('canvas'); canvas.width = Math.ceil((w + 8) * DENSITY); canvas.height = Math.ceil((d + h + 8) * DENSITY);
  const c: Paint = canvas.getContext('2d')!; c.setTransform(DENSITY, 0, 0, DENSITY, 4 * DENSITY, (h + 4) * DENSITY);
  const base = biome === 'kiln' ? '#5a4e48' : biome === 'cistern' ? '#5a6a6a' : biome === 'array' ? '#5e6270' : '#8a8274';
  c.translate(0, d);
  poly(c, [[0, 0], [w, 0], [w, -h], [0, -h]], tone(base, 0.8), INK, 1.4);
  for (let row = 0; row * 17 < h; row++) for (let x = -(row % 2) * 16; x < w; x += 33) {
    const xx = Math.max(0, x), ww = Math.min(w, x + 31) - xx; if (ww <= 2) continue;
    poly(c, [[xx + 1, -row * 17 - 1], [xx + ww - 1, -row * 17 - 1], [xx + ww - 1, -row * 17 - 15], [xx + 1, -row * 17 - 15]], tone(base, 0.72 + hash(x, row, 5) * 0.3), 'rgba(20,16,18,0.35)', 0.8);
  }
  poly(c, [[0, -h], [w, -h], [w, -h - d], [0, -h - d]], tone(base, 1.08), INK, 1.3);
  line(c, [[1, -h - d + 2], [w - 1, -h - d + 2]], 'rgba(255,240,215,0.25)', 1.4);
  for (let i = 0; i < Math.max(2, w / 60); i++) ellipse(c, hash(i, 1, w) * w, -h - d * hash(i, 2, d), 7, 3, 'rgba(84,110,60,0.7)');
  const tex = new Texture({ source: new CanvasSource({ resource: canvas, resolution: DENSITY, scaleMode: 'linear', autoGenerateMipmaps: true }) });
  const root = new Container(), sp = new Sprite(tex); sp.position.set(x0 - 4, y0 - h - 4); root.addChild(sp);
  sp.on('destroyed', () => tex.destroy(true));
  return { root, y: y1 };
}

export function buildZone(map: MapData): MapLayers {
  const a = map.adventure!, paint = a.paint!;
  const ground = new Container(); ground.addChild(new ZoneGround(a));
  const sorted: MapLayers['sorted'] = [];
  const add = (kind: string, x: number, y: number, s: number, v: number, flip: boolean, id: string) => {
    const made = place(kind, s, v, x, y, flip); if (!made) return;
    sorted.push({ view: made.root, y, bounds: made.bounds, ...(ZONE_TALL.has(kind) ? { building: `fade:${id}` } : {}) });
    if (kind === 'campfire') {
      const fire = new Container(); fire.position.set(0, -8); made.root.addChild(fire);
      const flames = [0, 1, 2].map((i) => { const f = flameSprite(i === 1 ? 0xffda83 : 0xef9b4c, 22); f.x = (i - 1) * 7; fire.addChild(f); return f; });
      const glow = glowSprite(0xffb060, 120, 0.4, true); glow.position.set(0, -12); made.root.addChild(glow);
      made.root.onRender = () => { const t = performance.now() / 1000; flames.forEach((f, i) => { f.scale.y = 0.24 + Math.sin(t * 8 + i * 1.7) * 0.04; }); glow.alpha = 0.36 + Math.sin(t * 6.3 + x) * 0.05; };
    }
    if (kind === 'lamp' || kind === 'lamppost') { const g = glowSprite(0xffc878, 70, 0.5, true); g.position.set(0, -70); made.root.addChild(g); }
    if (kind === 'brazier' || kind === 'walltorch') {
      const top = kind === 'brazier' ? -46 : -80, f = flameSprite(0xef9b4c, kind === 'brazier' ? 20 : 14), g = glowSprite(0xffb060, kind === 'brazier' ? 110 : 90, 0.42, true);
      f.position.set(0, top); g.position.set(0, top - 4); made.root.addChild(g, f);
      made.root.onRender = () => { const t = performance.now() / 1000; f.scale.y = 0.22 + Math.sin(t * 9 + x) * 0.04; g.alpha = 0.38 + Math.sin(t * 6.1 + y) * 0.05; };
    }
  };
  a.scenery.forEach((p, i) => add(p.k, p.x, p.y, p.s || 1, p.v, hash(Math.round(p.x), Math.round(p.y), 5) < 0.4 && p.k !== 'tent', `s${i}`));
  paint.decor.forEach((d, i) => { if (!ZONE_FLAT.has(d.kind)) add(d.kind, d.x, d.y, d.s ?? 1, d.v ?? 0, d.flip ?? false, `d${i}`); });
  const structure = new Set([...(a.kilns ?? []), ...(a.works ?? [])].map((k) => `${k.x},${k.y},${k.w},${k.d}`));
  // Big landmarks (second pass): their solid base is a kit footprint; the art replaces the generic wall block.
  for (const [i, st] of (paint.structures ?? []).entries()) {
    const fx = Math.round(st.x - st.w / 2), fy = Math.round(st.y - st.d);
    structure.add(`${fx},${fy},${st.w},${st.d}`);
    const art = structureArt(st.kind, st.w, st.d, st.v ?? 0); if (!art) continue;
    const root = new Container(), sp = new Sprite(texture(`st:${st.kind}:${st.w}:${st.d}:${st.v ?? 0}`, art));
    sp.position.set(art.box.x0, art.box.y0); root.addChild(sp); root.position.set(st.x, st.y); if (st.flip) root.scale.x = -1;
    if (art.rotor) {
      const r = art.rotor, rotor = new Sprite(texture(`rotor:${r.kind}:${r.r}`, rotorArt(r.kind, r.r))); rotor.anchor.set(0.5); rotor.position.set(r.x, r.y); root.addChild(rotor);
      const speed = r.kind === 'sails' ? 0.35 : -0.7; root.onRender = () => { rotor.rotation = (performance.now() / 1000) * speed; };
    }
    sorted.push({ view: root, y: st.y, bounds: { x0: st.x + art.box.x0, x1: st.x + art.box.x1, y0: st.y + art.box.y0, y1: st.y + art.box.y1 }, building: `fade:st${i}` });
  }
  for (const b of a.geometry.buildings) {
    const xs = b.footprint.map((p) => p[0]), ys = b.footprint.map((p) => p[1]), x = Math.min(...xs), y = Math.min(...ys);
    if (structure.has(`${x},${y},${Math.max(...xs) - x},${Math.max(...ys) - y}`)) continue;
    const wall = wallArt(b.footprint, paint.biome); sorted.push({ view: wall.root, y: wall.y });
  }
  // Authored structures keep their exact footprints (kilns, production trays, relays, the mill wheel).
  const keep = { ...a, geometry: { ...a.geometry, buildings: [] as typeof a.geometry.buildings }, kilns: a.kilns, works: a.works };
  for (const k of [...(a.kilns ?? []), ...(a.works ?? [])]) keep.geometry.buildings.push({ footprint: [[k.x, k.y], [k.x + k.w, k.y], [k.x + k.w, k.y + k.d], [k.x, k.y + k.d]] });
  sorted.push(...adventureStructures(keep));
  if (map.theme !== 'town') prewarmMonsters(map.theme, false, summonRigs());
  void ZONE_PAL;
  return { ground, sorted, decals: new Container() };
}
