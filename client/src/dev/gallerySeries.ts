// Weapon series gallery (dev only): http://localhost:5291/gallery-series.html?view=sheet|zoom|rarity|hero|metrics
// The checkpoint sample sheet of docs/rework/gear/ART-DIRECTION.md: the new series drawings (client/src/render/art/series)
// next to the CURRENT parametric art for the same items, at the bag cell (40 px), the item card (~64 px) and hero scale
// (default game camera). The series art is NOT wired into the game; heroes here get it as an overlay that copies the
// rig's weapon transform every frame (gallery only).

import '@fontsource/alegreya-sans/700.css';
import { Application, Container, Graphics, GraphicsContext, Rectangle, Text } from 'pixi.js';
import { createCharacter, playerLook } from '@shared/character';
import { BASES } from '@shared/data/items';
import { generateItem } from '@shared/items';
import { Rng } from '@shared/math';
import { gearLook } from '@shared/gearVisual';
import type { ClassId, Item, ItemKind, Rarity } from '@shared/types';
import { createPlayerView, initArt, itemIconUrl } from '../render/art';
import { getRenderer } from '../render/art/fx';
import { paint } from '../render/art/draw';
import { localXf, type WFloat } from '../render/art/weaponArt';
import type { WeaponFamily } from '../render/art/gearVisuals';
import { SERIES, seriesModel, type SeriesSpec } from '../render/art/series';
import { LEGENDARY_ART } from '../render/art/series/legendary';
import { hex } from '../render/art/util';
import type { PlayerView } from '../render/types';

const qs = new URLSearchParams(location.search);
const VIEW = qs.get('view') ?? 'sheet';

const app = new Application();
await app.init({ resizeTo: window, antialias: true, background: 0x2b2722, preference: 'webgl', resolution: 1 });
document.getElementById('stage')!.appendChild(app.canvas);
await document.fonts.load('700 14px "Alegreya Sans"').catch(() => undefined);
initArt(app.renderer);

// ─────────────────────────── items ───────────────────────────

const FAMS: { fam: WeaponFamily; base: string; cls: ClassId; label: string }[] = [
  { fam: 'blade', base: 'sword', cls: 'warrior', label: 'Sword' },
  { fam: 'axe', base: 'axe', cls: 'warrior', label: 'Axe' },
  { fam: 'bow', base: 'bow', cls: 'ranger', label: 'Bow' },
  { fam: 'staff', base: 'staff', cls: 'mage', label: 'Staff' },
  { fam: 'wand', base: 'wand', cls: 'mage', label: 'Wand' },
];
const GEN_ILVL = [1, 13, 25, 37, 49, 61, 70];
/** The rarity a levelling hero typically wears per band (the same sweep as the existing weapon board). */
const LEVEL_RARITY: Rarity[] = ['normal', 'magic', 'magic', 'rare', 'rare', 'rare', 'rare'];
const rarityFor = (gen: number): Rarity => { const r = qs.get('rar'); return r === 'normal' || r === 'magic' || r === 'rare' ? r : LEVEL_RARITY[gen]; };
const RC: Record<string, string> = { normal: '#6a6156', magic: '#5d7ad8', rare: '#d8bf3a', legendary: '#d8662a', set: '#2fb884' };

function currentItem(base: string, cls: ClassId, ilvl: number, rarity: Rarity, seed = 7): Item {
  const it = generateItem(new Rng(1000 + seed * 131 + base.length * 7 + ilvl), { ilvl, classId: cls, rarity: rarity === 'legendary' ? 'rare' : rarity, base, ancientAllowed: false });
  it.ancient = 0; it.upgrade = 0;
  return it;
}
const kindOf = (base: string) => BASES[base].kind as ItemKind;

// ─────────────────────────── new icons ───────────────────────────

const SS = 2;
/** Render a series drawing as an inventory icon (same pose and fill rule as icons.ts: 45° diagonal, fill 70 % → 94 %). */
function seriesIcon(spec: SeriesSpec, size: number, mode: 'color' | 'silhouette' = 'color'): string {
  const m = seriesModel(spec);
  const renderer = getRenderer();
  if (!m || !renderer) return '';
  const build = (layer: 'base' | 'light') => {
    const c = new GraphicsContext();
    c.rotate(Math.PI / 4);
    m.draw(c, layer);
    if (layer === 'base') for (const f of m.floats) { c.save(); localXf(c, f.x + Math.cos(f.phase) * f.orbit, f.y + Math.sin(f.phase) * f.orbit * 0.4); f.draw(c); c.restore(); }
    return c;
  };
  const prev = paint.mode;
  paint.mode = mode === 'silhouette' ? 1 : 0;
  const bctx = build('base');
  paint.mode = prev;
  const g = new Graphics(bctx);
  const b = g.getLocalBounds();
  const bw = Math.max(1, b.maxX - b.minX), bh = Math.max(1, b.maxY - b.minY);
  const fillK = 0.7 + 0.04 * Math.max(0, Math.min(6, spec.gen));
  const k = (size * fillK) / Math.max(bw, bh);
  const grab = (gr: Graphics) => {
    const holder = new Container();
    gr.scale.set(k);
    gr.position.set(size / 2 - (b.minX + bw / 2) * k, size / 2 - (b.minY + bh / 2) * k);
    holder.addChild(gr);
    const cv = renderer.extract.canvas({ target: holder, frame: new Rectangle(0, 0, size, size), resolution: SS, antialias: true, clearColor: [0, 0, 0, 0] }) as HTMLCanvasElement;
    holder.destroy({ children: true });
    return cv;
  };
  const raw = grab(g);
  bctx.destroy();
  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  const c2 = out.getContext('2d')!;
  if (mode === 'silhouette') {
    c2.drawImage(raw, 0, 0, size, size);
    c2.globalCompositeOperation = 'source-in'; c2.fillStyle = '#0c0a08'; c2.fillRect(0, 0, size, size);
    return out.toDataURL('image/png');
  }
  let glowCv: HTMLCanvasElement | null = null;
  if (m.lit) { const lctx = build('light'); glowCv = grab(new Graphics(lctx)); lctx.destroy(); }
  // backdrop halo only for legendaries and graded pieces (rule A4)
  const halo = spec.rarity === 'legendary' || spec.grade ? (spec.grade === 2 ? 0xfff1c8 : spec.grade === 1 ? 0xff7a2a : 0xffa040) : 0;
  if (halo) {
    const gr = c2.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
    gr.addColorStop(0, `rgba(${(halo >> 16) & 255},${(halo >> 8) & 255},${halo & 255},0.22)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c2.fillStyle = gr; c2.fillRect(0, 0, size, size);
  }
  c2.imageSmoothingEnabled = true; c2.imageSmoothingQuality = 'high';
  c2.shadowColor = 'rgba(0,0,0,0.55)'; c2.shadowBlur = size / 22; c2.shadowOffsetY = size / 40;
  c2.drawImage(raw, 0, 0, size, size);
  c2.shadowColor = 'transparent'; c2.shadowOffsetY = 0;
  if (glowCv) {
    c2.globalCompositeOperation = 'lighter';
    const lc = m.litColor || 0xffc88c;
    c2.shadowColor = `rgba(${(lc >> 16) & 255},${(lc >> 8) & 255},${lc & 255},0.95)`; c2.shadowBlur = size / 18;
    c2.globalAlpha = 0.75;
    c2.drawImage(glowCv, 0, 0, size, size);
    c2.globalAlpha = 1; c2.shadowBlur = 0; c2.globalCompositeOperation = 'source-over';
  }
  return out.toDataURL('image/png');
}

// ─────────────────────────── DOM sheet helpers ───────────────────────────

const sheet = document.getElementById('sheet')!;
function showSheet(): void { sheet.style.display = 'block'; app.canvas.style.display = 'none'; }
function el(tag: string, css = '', html = ''): HTMLElement { const e = document.createElement(tag); if (css) e.style.cssText = css; if (html) e.innerHTML = html; return e; }
function iconCell(url: string, px: number, border = '#3a2f24', pad = 6): HTMLElement {
  return el('div', `width:${px + pad}px;height:${px + pad}px;border:1px solid ${border};background:radial-gradient(#2a2119,#120d0a);display:flex;align-items:center;justify-content:center`, url ? `<img src="${url}" width=${px} height=${px}>` : '<span style="color:#4a3f33">—</span>');
}
const swatches = (s: (typeof SERIES)[number]) => s.palette.map((p) => `<span class=sw title="${p.name}" style="background:${hex(p.hex)}"></span>`).join('');

/** ?view=sheet: families × series; each cell CURRENT 64 | NEW 64 | NEW 40 | silhouette 40. */
function sheetView(): void {
  showSheet();
  const cellW = 64 + 8 + 64 + 8 + 40 + 6 + 8;
  const wrap = el('div', `display:grid;grid-template-columns:70px repeat(${SERIES.length}, ${cellW}px);gap:10px 8px;padding:10px 14px;align-items:center`);
  sheet.appendChild(wrap);
  wrap.appendChild(el('div', '', `<div class=lbl style="text-align:left">rarity: ${qs.get('rar') ?? 'levelling sweep'}</div>`));
  for (const s of SERIES) {
    wrap.appendChild(el('div', 'text-align:center', `<div style="font-weight:700;font-size:14px;color:#f0dfb4">${s.name}</div><div class=lbl>G${s.gen} · L${s.levels} · ${rarityFor(s.gen)}</div><div style="margin-top:2px">${swatches(s)}</div>`));
  }
  for (const f of FAMS) {
    wrap.appendChild(el('div', 'font-weight:700;font-size:13px;color:#c9b98f', f.label));
    for (const s of SERIES) {
      const rar = rarityFor(s.gen);
      const cur = currentItem(f.base, f.cls, GEN_ILVL[s.gen], rar);
      const spec: SeriesSpec = { family: f.fam, gen: s.gen, rarity: rar, seed: 3 };
      const cell = el('div', 'display:flex;gap:4px;align-items:flex-end;justify-content:center');
      const col = (node: HTMLElement, cap: string) => { const d = el('div', 'display:flex;flex-direction:column;align-items:center;gap:1px'); d.appendChild(node); d.appendChild(el('div', 'font-size:9px;color:#8a7d64', cap)); return d; };
      cell.appendChild(col(iconCell(itemIconUrl(gearLook(cur), kindOf(f.base), 64), 64, RC[rar]), 'now'));
      cell.appendChild(col(iconCell(seriesIcon(spec, 64), 64, RC[rar]), 'new'));
      const small = el('div', 'display:flex;flex-direction:column;gap:3px');
      small.appendChild(iconCell(seriesIcon(spec, 40), 40, RC[rar], 4));
      small.appendChild(iconCell(seriesIcon(spec, 40, 'silhouette'), 40, '#2a221a', 4));
      cell.appendChild(col(small, '40 · shape'));
      wrap.appendChild(cell);
    }
  }
  const notes = el('div', 'grid-column:1/-1;display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-top:6px');
  for (const s of SERIES) notes.appendChild(el('div', 'font-size:10.5px;color:#a8987a;line-height:1.25', `<b style="color:#d8c79c">${s.maker}</b><br>${s.zones}<br><i>${s.shape}</i><br>motif: ${s.motif}`));
  wrap.appendChild(notes);
}

/** ?view=zoom: the new drawings at 120 px (&rar= for one rarity). */
function zoomView(): void {
  showSheet();
  const px = Number(qs.get('px') ?? 120);
  // &only=<gen>: one series, columns = normal / magic / rare (close-up review)
  const only = qs.get('only');
  const cols = only !== null ? (['normal', 'magic', 'rare'] as Rarity[]).map((r) => ({ s: SERIES[Number(only)], r })) : SERIES.map((s) => ({ s, r: rarityFor(s.gen) }));
  const wrap = el('div', `display:grid;grid-template-columns:70px repeat(${cols.length}, ${px + 10}px);gap:8px;padding:10px 14px;align-items:center`);
  sheet.appendChild(wrap);
  wrap.appendChild(el('div'));
  for (const { s, r } of cols) wrap.appendChild(el('div', 'text-align:center', `<div style="font-weight:700;font-size:14px;color:#f0dfb4">${s.name}</div><div class=lbl>L${s.levels} · ${r}</div>`));
  const fams = qs.get('fams')?.split(',') ?? FAMS.map((f) => f.fam);
  for (const f of FAMS.filter((ff) => fams.includes(ff.fam))) {
    wrap.appendChild(el('div', 'font-weight:700;color:#c9b98f', f.label));
    for (const { s, r } of cols) wrap.appendChild(iconCell(seriesIcon({ family: f.fam, gen: s.gen, rarity: r, seed: 3 }, px), px, RC[r], 8));
  }
}

/** ?view=rarity&s=<gen>: one series at normal / magic / rare, the bespoke legendaries by stage, and grade accents. */
function rarityView(): void {
  showSheet();
  const g = Number(qs.get('s') ?? 1);
  const s = SERIES[g];
  const wrap = el('div', 'padding:10px 14px;display:flex;flex-direction:column;gap:12px');
  sheet.appendChild(wrap);
  wrap.appendChild(el('div', 'font-size:16px;font-weight:700;color:#f0dfb4', `${s.name} (L${s.levels}) — rarity adds craftsmanship &nbsp; <span style="font-size:12px;font-weight:400;color:#a8987a">${s.maker}</span>`));
  const grid = el('div', `display:grid;grid-template-columns:70px repeat(3, 230px);gap:8px;align-items:center`);
  wrap.appendChild(grid);
  grid.appendChild(el('div'));
  for (const r of ['normal', 'magic', 'rare']) grid.appendChild(el('div', `text-align:center;font-weight:700;color:${RC[r]}`, r));
  for (const f of FAMS) {
    grid.appendChild(el('div', 'font-weight:700;color:#c9b98f', f.label));
    for (const r of ['normal', 'magic', 'rare'] as Rarity[]) {
      const cell = el('div', 'display:flex;gap:6px;align-items:flex-end;justify-content:center');
      cell.appendChild(iconCell(seriesIcon({ family: f.fam, gen: g, rarity: r, seed: 3 }, 120), 120, RC[r], 8));
      cell.appendChild(iconCell(seriesIcon({ family: f.fam, gen: g, rarity: r, seed: 3 }, 40), 40, RC[r], 4));
      grid.appendChild(cell);
    }
  }
  // legendaries + grades
  const leg = el('div', 'display:flex;gap:26px;align-items:flex-start;margin-top:4px');
  wrap.appendChild(leg);
  for (const [id, L] of Object.entries(LEGENDARY_ART)) {
    const box = el('div', 'display:flex;flex-direction:column;gap:4px');
    box.appendChild(el('div', 'font-weight:700;color:#e8a060', `${id} <span style="font-weight:400;color:#a8987a">— ${L.idea}</span>`));
    const row = el('div', 'display:flex;gap:6px;align-items:flex-end');
    for (const [gen, cap] of [[1, 'early (G0–G2)'], [4, 'mid (G3–G4)'], [6, 'late (G5–G6)']] as const) {
      const d = el('div', 'display:flex;flex-direction:column;align-items:center;gap:2px');
      const lpx = Number(qs.get('lpx') ?? 110);
      d.appendChild(iconCell(seriesIcon({ family: L.family, gen, rarity: 'legendary', legendary: id, seed: 3 }, lpx), lpx, RC.legendary, 8));
      d.appendChild(el('div', 'font-size:10px;color:#8a7d64', cap));
      row.appendChild(d);
    }
    const d = el('div', 'display:flex;flex-direction:column;gap:3px');
    d.appendChild(iconCell(seriesIcon({ family: L.family, gen: 6, rarity: 'legendary', legendary: id, seed: 3 }, 40), 40, RC.legendary, 4));
    d.appendChild(iconCell(seriesIcon({ family: L.family, gen: 6, rarity: 'legendary', legendary: id, seed: 3 }, 40, 'silhouette'), 40, '#2a221a', 4));
    row.appendChild(d);
    box.appendChild(row);
    leg.appendChild(box);
  }
  const gr = el('div', 'display:flex;flex-direction:column;gap:4px');
  gr.appendChild(el('div', 'font-weight:700;color:#e8a060', 'grades (accents, not a takeover)'));
  const grow = el('div', 'display:flex;gap:6px;align-items:flex-end');
  const gf = (qs.get('gf') ?? 'blade') as WeaponFamily;
  for (const [grade, cap] of [[0, 'rare'], [1, 'Kindled'], [2, 'Fabled']] as const) {
    const d = el('div', 'display:flex;flex-direction:column;align-items:center;gap:2px');
    d.appendChild(iconCell(seriesIcon({ family: gf, gen: g, rarity: 'rare', grade: grade as 0 | 1 | 2, seed: 3 }, 110), 110, grade ? RC.legendary : RC.rare, 8));
    d.appendChild(el('div', 'font-size:10px;color:#8a7d64', cap));
    grow.appendChild(d);
  }
  gr.appendChild(grow);
  leg.appendChild(gr);
}

// ─────────────────────────── hero scale ───────────────────────────

const world = new Container();
app.stage.addChild(world);
interface Hero { view: PlayerView; x: number; y: number; over?: Overlay }
interface Overlay { spec: SeriesSpec; base: GraphicsContext; light: GraphicsContext | null; floats: { f: WFloat; ctx: GraphicsContext }[]; holder?: Container; fl: Graphics[] }
const heroes: Hero[] = [];

function label(text: string, x: number, y: number, size = 13, color = 0xe8d9b5, parent: Container = world) {
  const t = new Text({ text, style: { fontFamily: 'Alegreya Sans', fontWeight: '700', fontSize: size, fill: color, stroke: { color: 0x120d0a, width: 3 } } });
  t.anchor.set(0.5, 0); t.position.set(x, y); parent.addChild(t); return t;
}

function makeOverlay(spec: SeriesSpec): Overlay {
  const m = seriesModel(spec)!;
  const base = new GraphicsContext(); m.draw(base, 'base');
  let light: GraphicsContext | null = null;
  if (m.lit) { light = new GraphicsContext(); m.draw(light, 'light'); }
  const floats = m.floats.map((f) => { const ctx = new GraphicsContext(); f.draw(ctx); return { f, ctx }; });
  return { spec, base, light, floats, fl: [] };
}

type RigParts = { parts: Record<string, Container>; wLight: Container | null; wFloats: { s: Container; g: Container | null }[] };
function syncOverlay(h: Hero, t: number): void {
  const o = h.over; if (!o) return;
  const pa = h.view as unknown as RigParts;
  const w = pa.parts?.weapon;
  if (!w || w.destroyed || !w.parent) return;
  if (!o.holder || o.holder.destroyed || o.holder.parent !== w.parent) {
    const holder = new Container();
    holder.addChild(new Graphics(o.base));
    if (o.light) { const l = new Graphics(o.light); l.blendMode = 'add'; holder.addChild(l); }
    o.fl = o.floats.map(({ ctx }) => { const g = new Graphics(ctx); holder.addChild(g); return g; });
    w.parent.addChild(holder);
    o.holder = holder;
  }
  const hd = o.holder;
  hd.position.copyFrom(w.position); hd.rotation = w.rotation; hd.scale.copyFrom(w.scale); hd.skew.copyFrom(w.skew); hd.pivot.copyFrom(w.pivot);
  hd.zIndex = w.zIndex + 0.001;
  w.renderable = false;
  if (pa.wLight) pa.wLight.renderable = false;
  for (const f of pa.wFloats ?? []) { f.s.renderable = false; if (f.g) f.g.renderable = false; }
  o.floats.forEach(({ f }, i) => {
    const g = o.fl[i]; if (!g) return;
    const a = f.phase + t * f.spin;
    g.position.set(f.x + Math.cos(f.phase + t * 0.7) * f.orbit, f.y + Math.sin(f.phase + t * 0.7) * f.orbit * 0.4 + Math.sin(t * 2 + f.phase) * f.bob);
    g.rotation = f.spin ? a : 0;
  });
}

/** ?view=hero: heroes at the default game camera, CURRENT (left) and NEW (right) for every family × series. */
function heroView(): void {
  const z = Number(qs.get('zoom') ?? (1080 / 620) * 0.75);
  const holder = new Container();
  world.addChild(holder);
  const colW = Number(qs.get('colw') ?? 250), rowH = Number(qs.get('rowh') ?? 196), gx = 210, gy = 150;
  const bg = new Graphics();
  holder.addChild(bg);
  SERIES.forEach((s, ci) => {
    label(`${s.name}  ·  L${s.levels}`, gx + ci * colW + 30, 10, 15);
    label('now          new', gx + ci * colW + 30, 30, 11, 0xa8987a);
  });
  FAMS.forEach((f, ri) => {
    const y = gy + ri * rowH;
    label(f.label, 70, y - 40, 15, 0xc9b98f);
    SERIES.forEach((s, ci) => {
      const rar = rarityFor(s.gen);
      for (const side of [0, 1]) {
        const save = createCharacter('Board', f.cls, 7);
        const look = playerLook(save);
        const it = side === 0 ? currentItem(f.base, f.cls, GEN_ILVL[s.gen], rar) : currentItem(f.base, f.cls, GEN_ILVL[s.gen], 'normal');
        look.slots.mainhand = gearLook(it);
        delete look.slots.offhand;
        const v = createPlayerView(look);
        const x = gx + ci * colW + side * 68;
        v.root.position.set(x / z, y / z);
        holder.addChild(v.root);
        const h: Hero = { view: v, x: x / z, y: y / z };
        if (side === 1) h.over = makeOverlay({ family: f.fam, gen: s.gen, rarity: rar, seed: 3, rig: true });
        heroes.push(h);
      }
    });
  });
  bg.rect(0, 0, 4000 / z, 4000 / z).fill(Number(qs.get('bg') ?? 0x3a3a2e));
  holder.scale.set(z);
}

// ─────────────────────────── metrics ───────────────────────────

/** ?view=metrics: [M] colour convergence per band: mean colour and share of near-white / glow pixels, current vs new. */
async function metricsView(): Promise<void> {
  showSheet();
  const px = 64;
  const load = (url: string) => new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.src = url; });
  const cv = document.createElement('canvas'); cv.width = px; cv.height = px;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  const stats = async (url: string) => {
    if (!url) return null;
    const img = await load(url);
    c.clearRect(0, 0, px, px); c.drawImage(img, 0, 0);
    const d = c.getImageData(0, 0, px, px).data;
    let n = 0, r = 0, g = 0, b = 0, bright = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      n++; r += d[i]; g += d[i + 1]; b += d[i + 2];
      const L = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      if (L > 0.78) bright++;
    }
    return n ? { r: r / n, g: g / n, b: b / n, bright: bright / n, n } : null;
  };
  const rows: string[] = [];
  const out: Record<string, unknown> = {};
  for (const who of ['now', 'new'] as const) {
    let line = `<tr><td style="color:#c9b98f;padding-right:8px">${who}</td>`;
    for (const s of SERIES) {
      let R = 0, G = 0, B = 0, BR = 0, N = 0;
      for (const f of FAMS) {
        const rar = rarityFor(s.gen);
        const url = who === 'now' ? itemIconUrl(gearLook(currentItem(f.base, f.cls, GEN_ILVL[s.gen], rar)), kindOf(f.base), px) : seriesIcon({ family: f.fam, gen: s.gen, rarity: rar, seed: 3 }, px);
        const st = await stats(url);
        if (!st) continue;
        R += st.r; G += st.g; B += st.b; BR += st.bright; N++;
      }
      R /= N; G /= N; B /= N; BR /= N;
      out[`${who}-G${s.gen}`] = { rgb: [Math.round(R), Math.round(G), Math.round(B)], bright: +(BR * 100).toFixed(1) };
      line += `<td style="padding:4px 10px;text-align:center"><span class=sw style="width:34px;height:20px;background:rgb(${R | 0},${G | 0},${B | 0})"></span><br><span class=lbl>${(BR * 100).toFixed(0)} % bright</span></td>`;
    }
    rows.push(line + '</tr>');
  }
  sheet.innerHTML = `<div style="padding:14px"><div style="font-weight:700;font-size:15px;margin-bottom:6px">Mean icon colour per band (5 families, opaque pixels) and share of pixels with luminance > 0.78</div><table><tr><td></td>${SERIES.map((s) => `<td class=lbl>G${s.gen} ${s.name}</td>`).join('')}</tr>${rows.join('')}</table></div>`;
  (window as unknown as { __metrics: unknown }).__metrics = out;
}

/** ?view=extents: [M] drawn extent of every rare drawing in the hand-local frame (floats at rest) vs the family's
 *  canonical reach (gearVisuals.ts SHAPE_FAMILY: sword 31, axe 27, bow ±21 string, staff 50, wand 20). */
function extentsView(): void {
  showSheet();
  const CANON: Record<string, number> = { blade: 31, axe: 27, bow: 21, staff: 50, wand: 20 };
  const out: Record<string, number> = {};
  let html = '<div style="padding:14px"><div style="font-weight:700;font-size:15px;margin-bottom:6px">Drawn tip (−y, units) of each rare drawing, floats at rest, vs canonical reach</div><table style="font:12px monospace">';
  html += `<tr><td></td>${SERIES.map((s) => `<td style="padding:2px 10px">${s.name}</td>`).join('')}<td>canon</td></tr>`;
  for (const f of FAMS) {
    html += `<tr><td style="color:#c9b98f">${f.label}</td>`;
    for (const s of SERIES) {
      const m = seriesModel({ family: f.fam, gen: s.gen, rarity: 'rare', seed: 3 });
      if (!m) { html += '<td>—</td>'; continue; }
      const c = new GraphicsContext(); m.draw(c, 'base');
      for (const fl of m.floats) { c.save(); localXf(c, fl.x, fl.y); fl.draw(c); c.restore(); }
      const g = new Graphics(c); const b = g.getLocalBounds(); g.destroy(); c.destroy();
      const tip = f.fam === 'bow' ? Math.max(-b.minY, b.maxY) : -b.minY;
      out[`${f.fam}-G${s.gen}`] = +tip.toFixed(1);
      const over = tip / CANON[f.fam] - 1;
      html += `<td style="padding:2px 10px;color:${over > 0.2 ? '#ff8a6a' : '#d8c79c'}">${tip.toFixed(1)} (${over >= 0 ? '+' : ''}${(over * 100).toFixed(0)}%)</td>`;
    }
    html += `<td>${CANON[f.fam]}</td></tr>`;
  }
  sheet.innerHTML = html + '</table></div>';
  (window as unknown as { __extents: unknown }).__extents = out;
}

// ─────────────────────────── run ───────────────────────────

switch (VIEW) {
  case 'zoom': zoomView(); break;
  case 'rarity': rarityView(); break;
  case 'hero': heroView(); break;
  case 'metrics': await metricsView(); break;
  case 'extents': extentsView(); break;
  default: sheetView();
}

let time = 0;
app.ticker.add((tk) => {
  const dt = Math.min(0.05, tk.deltaMS / 1000);
  time += dt;
  for (const h of heroes) {
    h.view.update(dt, { x: h.x, y: h.y, vx: 0, vy: 0, moving: false, facingLeft: false, flags: 0, attackSeq: 0, hpFrac: 1, time, aps: 1.2 });
    syncOverlay(h, time);
  }
});
(window as unknown as { __ready: boolean }).__ready = true;
