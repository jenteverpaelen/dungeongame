// Map assembly: theme selection, prop + decal atlases (baked once per theme), y-sorted prop sprites with
// light / flame / smoke fx, decal stamps into the ground chunks, and a culled layer of glowing decals.

import { Container, Matrix, Sprite, type Renderer, type Texture } from 'pixi.js';
import { T_PATH, T_PLAZA, T_WATER, type MapData, type Prop } from '@shared/mapgen';
import type { MapLayers } from './index';
import { bakeSheet, type Sheet } from './bake';
import { flameSprite, fx, glowSprite } from './fx';
import { CHUNK, GroundLayer } from './ground';
import { GROUND, type ThemeKey } from './palette';
import { SORTED_KINDS, VARIANTS, decalGlow, drawDecal, drawProp, propFx } from './props';
import { hash2, light } from './util';
import { prewarmMonsters } from './monsters';
import { summonRigs } from './summons';

export function themeKey(map: MapData): ThemeKey {
  if (map.zone === 'rift') return map.theme === 'ashen' ? 'riftAshen' : 'riftGlade';
  return map.theme === 'ashen' ? 'ashen' : map.theme === 'glade' ? 'glade' : 'town';
}

// ─────────────────────────── atlases ───────────────────────────

const atlases = new Map<string, Sheet>();
const atlasOrder: string[] = [];

function atlas(kind: 'prop' | 'decal', theme: ThemeKey, kinds: Set<string>): Sheet {
  const names = [...kinds].sort();
  const key = `${kind}:${theme}:${names.join(',')}`;
  let sh = atlases.get(key);
  if (sh && !sh.destroyed) return sh;
  const specs = [];
  for (const k of names) {
    const n = VARIANTS[k] ?? 1;
    for (let v = 0; v < n; v++) {
      specs.push({ name: `${k}:${v}`, draw: kind === 'prop' ? (c: Parameters<typeof drawProp>[0]) => drawProp(c, k, v, theme) : (c: Parameters<typeof drawDecal>[0]) => drawDecal(c, k, v, theme) });
    }
    if (k === 'banner' && kind === 'prop') specs.push({ name: 'banner_cloth:0', draw: (c: Parameters<typeof drawProp>[0]) => drawProp(c, 'banner_cloth', 0, theme) });
  }
  sh = bakeSheet(specs, 2, 2048, `${kind}:${theme}`);
  atlases.set(key, sh);
  atlasOrder.push(key);
  // keep the atlases of the last few maps only
  while (atlasOrder.length > 6) {
    const old = atlasOrder.shift()!;
    if (old !== key) { atlases.get(old)?.destroy(); atlases.delete(old); }
  }
  return sh;
}

// ─────────────────────────── prop views ───────────────────────────

const SHADOW: Record<string, [number, number, number]> = {
  tree: [32, 11, 0.9], pine: [27, 10, 0.9], deadtree: [22, 8, 0.8], rockspire: [28, 9, 0.9], boulder: [32, 10, 1], stump: [19, 7, 0.9],
  pillar: [24, 9, 0.9], brazier: [16, 6, 0.7], stalagmite: [24, 8, 0.9], cavecrystal: [28, 9, 0.6], house: [120, 24, 0.8],
  tavern: [146, 26, 0.8], forge: [118, 24, 0.8], well: [36, 12, 0.9], lantern: [10, 4, 0.7], banner: [8, 3, 0.6], campfire: [24, 8, 0.6],
  crate: [19, 7, 0.9], fence: [36, 5, 0.6], bush: [21, 7, 0.9],
};
const FLIPPABLE = new Set(['tree', 'pine', 'deadtree', 'rockspire', 'boulder', 'stump', 'stalagmite', 'cavecrystal', 'bush', 'crate', 'pillar']);

interface Anim { s: Sprite; kind: 'flame' | 'flame2' | 'glow' | 'smoke' | 'window' | 'cloth'; base: number; ph: number; x: number; y: number; size: number }

function animate(view: Container, anims: Anim[]): void {
  if (!view.visible) return;
  const t = performance.now() / 1000;
  for (const a of anims) {
    switch (a.kind) {
      case 'glow': a.s.alpha = a.base * (0.82 + 0.1 * Math.sin(t * 7 + a.ph) + 0.08 * Math.sin(t * 13.3 + a.ph * 2)); break;
      case 'window': a.s.alpha = a.base * (0.9 + 0.1 * Math.sin(t * 2.2 + a.ph)); break;
      case 'flame': case 'flame2': {
        const k = a.kind === 'flame' ? 1 : 0.62;
        a.s.scale.y = (a.size * k / 96) * (1 + 0.14 * Math.sin(t * 17 + a.ph) + 0.08 * Math.sin(t * 29 + a.ph));
        a.s.scale.x = (a.size * k * 0.66 / 64) * (1 - 0.08 * Math.sin(t * 17 + a.ph));
        a.s.skew.x = Math.sin(t * 5 + a.ph) * 0.12;
        break;
      }
      case 'smoke': {
        const cyc = (t * 0.35 + a.ph) % 1;
        a.s.position.set(a.x + Math.sin(cyc * 6 + a.ph * 9) * 6 + cyc * 10, a.y - cyc * 60);
        a.s.alpha = Math.sin(cyc * Math.PI) * a.base;
        a.s.scale.set((a.size / 64) * (0.5 + cyc));
        break;
      }
      case 'cloth': a.s.rotation = Math.sin(t * 1.6 + a.ph) * 0.06; a.s.skew.y = Math.sin(t * 2.3 + a.ph) * 0.05; break;
    }
  }
}

function propView(p: Prop, sheet: Sheet, theme: ThemeKey): Container {
  const view = new Container();
  view.position.set(p.x, p.y);
  const n = VARIANTS[p.k] ?? 1;
  const v = Math.abs(p.v) % n;
  const tex = sheet.texture(`${p.k}:${v}`);
  const flip = FLIPPABLE.has(p.k) && hash2(Math.round(p.x), Math.round(p.y), 5) < 0.5;
  const s = p.s || 1;
  if (tex) {
    const sp = new Sprite(tex);
    sp.scale.set(flip ? -s : s, s);
    view.addChild(sp);
  }
  const anims: Anim[] = [];
  if (p.k === 'banner') {
    const cloth = sheet.texture('banner_cloth:0');
    if (cloth) {
      const cs = new Sprite(cloth);
      cs.position.set(1 * s, -85 * s);
      cs.scale.set(s);
      view.addChild(cs);
      anims.push({ s: cs, kind: 'cloth', base: 1, ph: p.x * 0.01, x: 0, y: 0, size: 0 });
    }
  }
  for (const f of propFx(p.k, theme, v)) {
    const fxs = flip ? -1 : 1;
    const x = f.x * s * fxs, y = f.y * s;
    if (f.kind === 'glow' || f.kind === 'window') {
      const g = glowSprite(f.color, f.size * s, f.kind === 'window' ? 0.32 : 0.5, true);
      g.position.set(x, y);
      if (f.kind === 'window') g.scale.y *= 0.8;
      view.addChild(g);
      anims.push({ s: g, kind: f.kind, base: g.alpha, ph: Math.random() * 6, x, y, size: f.size });
    } else if (f.kind === 'flame') {
      const outer = flameSprite(f.color, f.size * s, 0.9);
      const inner = flameSprite(0xffd23f, f.size * s * 0.62, 0.95);
      outer.position.set(x, y); inner.position.set(x, y + 1);
      view.addChild(outer, inner);
      const ph = Math.random() * 6;
      anims.push({ s: outer, kind: 'flame', base: 1, ph, x, y, size: f.size * s }, { s: inner, kind: 'flame2', base: 1, ph: ph + 1.3, x, y, size: f.size * s });
    } else if (f.kind === 'smoke') {
      for (let i = 0; i < 3; i++) {
        const sm = new Sprite(fx().smoke);
        sm.anchor.set(0.5); sm.tint = f.color; sm.alpha = 0;
        view.addChild(sm);
        anims.push({ s: sm, kind: 'smoke', base: 0.42, ph: i / 3, x, y, size: f.size * s });
      }
    }
  }
  if (anims.length) view.onRender = () => animate(view, anims);
  return view;
}

// ─────────────────────────── glowing decal layer ───────────────────────────

class GlowDecals extends Container {
  private groups = new Map<number, Container>();
  private cols: number;
  private tmp = new Matrix();
  constructor(mapW: number) {
    super();
    this.cols = Math.ceil(mapW / CHUNK);
    this.onRender = (r: Renderer) => this.cull(r);
  }
  add(x: number, y: number, color: number, size: number, flat = 0.42): void {
    const key = Math.floor(y / CHUNK) * this.cols + Math.floor(x / CHUNK);
    let g = this.groups.get(key);
    if (!g) { g = new Container(); this.groups.set(key, g); this.addChild(g); }
    const s = glowSprite(color, size, 0.5, true);
    s.position.set(x, y);
    s.scale.y *= flat;
    (s as Sprite & { ph?: number }).ph = hash2(Math.round(x), Math.round(y), 9) * 6.28;
    g.addChild(s);
  }
  private cull(renderer: Renderer): void {
    if (!this.groups.size) return;
    const m = this.getGlobalTransform(this.tmp, false);
    const det = m.a * m.d - m.b * m.c;
    if (!det) return;
    const scr = renderer.screen;
    const toL = (sx: number, sy: number) => { const x = sx - m.tx, y = sy - m.ty; return { x: (m.d * x - m.c * y) / det, y: (-m.b * x + m.a * y) / det }; };
    const p0 = toL(0, 0), p1 = toL(scr.width, scr.height);
    const c0 = Math.floor((Math.min(p0.x, p1.x) - 64) / CHUNK), c1 = Math.floor((Math.max(p0.x, p1.x) + 64) / CHUNK);
    const r0 = Math.floor((Math.min(p0.y, p1.y) - 64) / CHUNK), r1 = Math.floor((Math.max(p0.y, p1.y) + 64) / CHUNK);
    const t = performance.now() / 1000;
    for (const [k, g] of this.groups) {
      const c = k % this.cols, r = (k / this.cols) | 0;
      g.visible = c >= c0 && c <= c1 && r >= r0 && r <= r1;
      if (!g.visible) continue;
      for (const ch of g.children) {
        const ph = (ch as Sprite & { ph?: number }).ph ?? 0;
        ch.alpha = 0.32 + 0.22 * Math.sin(t * 1.7 + ph);
      }
    }
  }
}

// ─────────────────────────── build ───────────────────────────

export function buildLayers(map: MapData): MapLayers {
  const theme = themeKey(map);
  const ground = new GroundLayer(map, theme);
  const glows = new GlowDecals(map.w * 64);

  const propKinds = new Set<string>(), decalKinds = new Set<string>();
  for (const p of map.props) (SORTED_KINDS.has(p.k) ? propKinds : decalKinds).add(p.k);
  const tA = performance.now();
  const propSheet = atlas('prop', theme, propKinds);
  const tB = performance.now();
  const decalSheet = atlas('decal', theme, decalKinds);
  const tC = performance.now();

  const sorted: { view: Container; y: number }[] = [];
  const NATURAL = new Set(['grass', 'flowers', 'fern', 'mushrooms', 'bush']);
  const tileAt = (x: number, y: number) => map.tiles[Math.max(0, Math.min(map.h - 1, Math.floor(y / 64))) * map.w + Math.max(0, Math.min(map.w - 1, Math.floor(x / 64)))];
  for (const p of map.props) {
    const s = p.s || 1;
    // paved ground stays clear of wild plants
    if (NATURAL.has(p.k) && (tileAt(p.x, p.y) === T_PLAZA || tileAt(p.x, p.y) === T_PATH)) continue;
    if (SORTED_KINDS.has(p.k)) {
      sorted.push({ view: propView(p, propSheet, theme), y: p.y });
      const sh = SHADOW[p.k];
      if (sh) ground.addShadow({ x: p.x + sh[0] * 0.12 * s, y: p.y + 1, rx: sh[0] * s, ry: sh[1] * s, a: sh[2] });
    } else {
      const n = VARIANTS[p.k] ?? 1;
      const tex: Texture | null = decalSheet.texture(`${p.k}:${Math.abs(p.v) % n}`);
      if (tex) ground.addDecal({ tex, x: p.x, y: p.y, s, flip: hash2(Math.round(p.x), Math.round(p.y), 3) < 0.5 }, 30 * s);
      const g = decalGlow(p.k, theme);
      if (g) glows.add(p.x, p.y - 2, g.color, g.size * s);
    }
  }
  // glowing liquid (lava / glow-water)
  const pal = GROUND[theme];
  if (pal.liquidGlow) {
    for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
      if (map.tiles[ty * map.w + tx] !== T_WATER) continue;
      if (hash2(tx, ty, 77) > 0.4) continue;
      glows.add(tx * 64 + 32, ty * 64 + 32, light(pal.liquid, 0.2), 150, 0.5);
    }
  }
  if (map.theme !== 'town') prewarmMonsters(map.theme, map.zone === 'rift', summonRigs());
  const tD = performance.now();
  ground.prebake(map.entry.x - 1100, map.entry.y - 700, map.entry.x + 1100, map.entry.y + 700, 24);
  const tE = performance.now();
  (globalThis as { __mapTiming?: string }).__mapTiming = `props ${(tB - tA).toFixed(0)} decals ${(tC - tB).toFixed(0)} views ${(tD - tC).toFixed(0)} chunks ${(tE - tD).toFixed(0)}`;
  return { ground, sorted, decals: glows };
}
