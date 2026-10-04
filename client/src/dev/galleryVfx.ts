// VFX gallery: a standalone Pixi page that drives the real `Vfx` module with scripted server events
// against placeholder targets. Scenes: ?scene=combat | proj | aoe | aoe2 | tele | beam | cast | death |
// loot | mix | stress. Exposes window.__gallery / window.__perf for automated screenshots and profiling.

import '@fontsource/alegreya-sans/700.css';
import '@fontsource/lilita-one/400.css';
import '@fontsource/cinzel/700.css';

import { Application, Container, Graphics, Text } from 'pixi.js';
import { MONSTERS } from '@shared/data/monsters';
import type { EntDesc, GameEvent, LootView } from '@shared/protocol';
import type { ItemLook } from '@shared/types';
import { sfx } from '../audio/sfx';
import { initArt } from '../render/art';
import type { EntityView, Nameplate, ViewState } from '../render/types';
import { Vfx, type VfxContext } from '../render/vfx';

const qs = new URLSearchParams(location.search);
const SCENE = qs.get('scene') ?? 'combat';
/** ?manual=1: time only advances through __gallery.advance(sec) (deterministic captures). */
const MANUAL = qs.get('manual') === '1';
const SCENES = ['combat', 'proj', 'aoe', 'aoe2', 'tele', 'beam', 'cast', 'death', 'loot', 'mix', 'stress'];

await Promise.all([
  document.fonts.load('700 26px "Alegreya Sans"'),
  document.fonts.load('54px "Lilita One"'),
  document.fonts.load('700 20px Cinzel'),
]).catch(() => undefined);

const app = new Application();
await app.init({ resizeTo: window, antialias: true, background: 0x0d0b09, preference: 'webgl', resolution: 1 });
document.getElementById('stage')!.appendChild(app.canvas);
try { initArt(app.renderer); } catch { /* art module may be mid-rewrite */ }

// ─────────────────────────── world & camera ───────────────────────────

const VIEW_HEIGHT = 920;
const world = new Container();
const ground = new Container();
const groundFx = new Container();
const entities = new Container();
entities.sortableChildren = true;
const aboveFx = new Container();
const textLayer = new Container();
const labels = new Container();
world.addChild(ground, labels, groundFx, entities, aboveFx, textLayer);
app.stage.addChild(world);

function drawGround(): void {
  const g = new Graphics();
  g.rect(-1400, -900, 2800, 1800).fill(0x2b3324);
  let s = 12345;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 700; i++) {
    const x = -1400 + rnd() * 2800, y = -900 + rnd() * 1800, r = 20 + rnd() * 90;
    g.ellipse(x, y, r, r * 0.6).fill({ color: rnd() < 0.5 ? 0x323b29 : 0x262d20, alpha: 0.6 });
  }
  for (let i = 0; i < 400; i++) {
    const x = -1400 + rnd() * 2800, y = -900 + rnd() * 1800;
    g.moveTo(x, y).lineTo(x + 2, y - 7).stroke({ width: 2, color: 0x4a5a36, alpha: 0.7 });
  }
  ground.addChild(g);
}
drawGround();

let zoom = 1;
let camX = 0, camY = 0;
let shakeMag = 0, shakeEnd = 0, shakeDur = 1;
let hitStopUntil = 0;
let time = 0;
/** Gallery clock in ms (simulated time, so manual stepping stays consistent). */
const simNow = () => time * 1000;

// ─────────────────────────── placeholder entities ───────────────────────────

interface Ent {
  id: number; x: number; y: number; h: number; r: number; hp: number; flags: number;
  kind: 'player' | 'mob' | 'loot' | 'summon';
  view: EntityView; plate: Nameplate | null; desc: EntDesc; dying?: boolean;
}

const ents = new Map<number, Ent>();
const ME = 1, OTHER = 2;
let nextId = 100;

function placeholderView(kind: 'player' | 'mob' | 'summon', color: number, accent: number, h: number): EntityView {
  const root = new Container();
  const body = new Container();
  root.addChild(body);
  const draw = (g: Graphics, white: boolean) => {
    const f = (c: number) => (white ? 0xffffff : c);
    const ol = { width: 2.6, color: white ? 0xffffff : 0x1b1410 };
    if (kind === 'player') {
      g.roundRect(-8, -14, 7, 14, 3).fill(f(0x5a4a3a)).stroke(ol);
      g.roundRect(1, -14, 7, 14, 3).fill(f(0x5a4a3a)).stroke(ol);
      g.roundRect(-11, -30, 22, 19, 7).fill(f(color)).stroke(ol);
      g.circle(0, -44, 16).fill(f(0xf2c9a0)).stroke(ol);
      g.ellipse(-4, -50, 13, 7).fill(f(accent));
      if (!white) { g.ellipse(5, -42, 2.2, 3).fill(0x1b1410); g.ellipse(-2, -42, 2.2, 3).fill(0x1b1410); }
    } else if (kind === 'summon') {
      g.moveTo(-14, 0).lineTo(0, -18).lineTo(14, 0).stroke({ width: 3, color: white ? 0xffffff : 0x5a4028 });
      g.roundRect(-14, -30, 28, 12, 4).fill(f(0xb08a50)).stroke(ol);
      g.rect(6, -27, 16, 5).fill(f(0x6a5030)).stroke({ width: 1.5, color: ol.color });
    } else {
      g.ellipse(0, -h * 0.45, h * 0.55, h * 0.45).fill(f(color)).stroke(ol);
      g.ellipse(-h * 0.15, -h * 0.75, h * 0.18, h * 0.1).fill(f(accent));
      if (!white) { g.ellipse(h * 0.18, -h * 0.5, 2.4, 3.4).fill(0x1b1410); g.ellipse(-h * 0.02, -h * 0.5, 2.4, 3.4).fill(0x1b1410); }
    }
  };
  const g = new Graphics();
  draw(g, false);
  const w = new Graphics();
  draw(w, true);
  w.alpha = 0;
  body.addChild(g, w);
  let flashT = 0, squash = 0, dying = false, deathT = 0, onDone: (() => void) | null = null;
  return {
    root, height: h,
    update(dt: number, s: ViewState) {
      body.scale.x = s.facingLeft ? -1 : 1;
      flashT = Math.max(0, flashT - dt);
      w.alpha = Math.min(1, flashT / 0.07) * 0.85;
      squash = Math.max(0, squash - dt * 0.8);
      body.scale.y = 1 - squash;
      body.scale.x *= 1 + squash * 0.6;
      if (dying) {
        deathT += dt;
        const t = Math.min(1, deathT / 0.35);
        body.alpha = 1 - t;
        body.scale.y *= 1 - t * 0.5;
        if (t >= 1 && onDone) { const d = onDone; onDone = null; d(); }
      }
    },
    hit(intensity: number, crit: boolean) { flashT = crit ? 0.1 : 0.07; squash = Math.max(squash, 0.08 * intensity + (crit ? 0.04 : 0)); },
    die(el: number, done: () => void) { dying = true; deathT = el === 2 ? 0.3 : 0; onDone = done; },
    destroy() { root.destroy({ children: true }); },
  };
}

function addEnt(desc: EntDesc, x: number, y: number, h = 40): Ent {
  let view: EntityView;
  if (desc.k === 'loot') view = vfx.createLootView(desc);
  else {
    const def = MONSTERS[desc.t];
    const color = desc.k === 'player' ? (desc.t === 'mage' ? 0x2e86de : desc.t === 'ranger' ? 0x27ae60 : 0xc0392b) : def?.colors.body ?? 0x8fbf6a;
    const accent = desc.k === 'player' ? 0x6a4020 : def?.colors.accent ?? 0x3e7a2a;
    view = placeholderView(desc.k === 'player' ? 'player' : desc.k === 'summon' ? 'summon' : 'mob', color, accent, h);
  }
  entities.addChild(view.root);
  const e: Ent = { id: desc.id, x, y, h: view.height, r: desc.r, hp: 1, flags: 0, kind: desc.k as Ent['kind'], view, plate: null, desc };
  if (desc.k === 'player' || desc.k === 'mob') {
    e.plate = vfx.createNameplate(desc, desc.id === ME);
    if (e.plate) textLayer.addChild(e.plate.root);
  }
  ents.set(desc.id, e);
  return e;
}

function removeEnt(id: number): void {
  const e = ents.get(id);
  if (!e) return;
  e.plate?.destroy();
  e.view.root.parent?.removeChild(e.view.root);
  e.view.destroy();
  ents.delete(id);
}

function mob(t: string, x: number, y: number, el: 0 | 1 | 2 | 3 | 4 | 5 = 0, af: string[] = [], name?: string): Ent {
  const def = MONSTERS[t];
  const h = el === 4 ? 96 : (def?.scale ?? 1) * 38;
  return addEnt({ id: nextId++, k: 'mob', t, n: name ?? def?.name, lv: 30, el, af, r: def?.radius ?? 16, sc: def?.scale }, x, y, h);
}

function player(id: number, cls: string, name: string, x: number, y: number, lv = 42, pl = 0): Ent {
  return addEnt({ id, k: 'player', t: cls, n: name, lv, pl, r: 16 }, x, y, 64);
}

function killEnt(e: Ent, el: number, big = false): void {
  if (e.dying) return;
  e.dying = true;
  fire({ e: 'die', t: e.id, el, x: e.x, y: e.y, ...(big ? { big: 1 as const } : {}) });
  e.plate?.destroy();
  e.plate = null;
  e.view.die(el, () => removeEnt(e.id));
}

// ─────────────────────────── vfx context ───────────────────────────

const ctx: VfxContext = {
  myId: () => ME,
  entityPos: (id) => { const e = ents.get(id); return e ? { x: e.x, y: e.y } : null; },
  entityView: (id) => ents.get(id)?.view ?? null,
  entityRadius: (id) => ents.get(id)?.r ?? 16,
  shake: (m, ms) => {
    const now = simNow();
    if (m >= shakeMag * Math.max(0, (shakeEnd - now) / shakeDur)) { shakeMag = m; shakeDur = ms; shakeEnd = now + ms; }
  },
  hitStop: (ms) => { hitStopUntil = Math.max(hitStopUntil, simNow() + Math.min(ms, 90)); },
  zoom: () => zoom,
};
const bakeT0 = performance.now();
const vfx = new Vfx({ groundFx, aboveFx, text: textLayer }, ctx);
const bakeMs = performance.now() - bakeT0;
let handleAcc = 0;
const fire = (ev: GameEvent) => { const t0 = performance.now(); vfx.handle(ev); handleAcc += performance.now() - t0; };

// ─────────────────────────── scheduling helpers ───────────────────────────

interface Timer { at: number; fn: () => void }
let timers: Timer[] = [];
const later = (sec: number, fn: () => void) => timers.push({ at: time + sec, fn });
const loops: { period: number; next: number; fn: () => void }[] = [];
const every = (period: number, fn: () => void, offset = 0) => loops.push({ period, next: time + offset, fn });

function label(txt: string, x: number, y: number, size = 15): void {
  const t = new Text({ text: txt, style: { fontFamily: 'Cinzel, serif', fontWeight: '700', fontSize: size, fill: 0xe8d9b5, stroke: { color: 0x000000, width: 3 } } });
  t.anchor.set(0.5, 0);
  t.position.set(x, y);
  labels.addChild(t);
}

let pid = 1;
function proj(v: string, x: number, y: number, tx: number, ty: number, speed: number, el = 0, src = ME, h?: number, hit = true): void {
  const id = pid++;
  const d = Math.hypot(tx - x, ty - y);
  const life = (d / speed) * 1000;
  fire({ e: 'proj', id, s: src, v, x, y, vx: ((tx - x) / d) * speed, vy: ((ty - y) / d) * speed, life, el, ...(h ? { h } : {}) });
  later(life / 1000, () => fire({ e: 'pend', id, x: tx, y: ty, ...(hit ? { hit: 1 as const } : {}) }));
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pickOne = <T,>(a: T[]) => a[(Math.random() * a.length) | 0];

// ─────────────────────────── scenes ───────────────────────────

const scenes: Record<string, () => void> = {
  combat() {
    camX = 0; camY = 0;
    const me = player(ME, 'warrior', 'Brakka', -460, 140);
    const other = player(OTHER, 'mage', 'Ysolde', -460, -150, 70, 214);
    void me; void other;
    const row = ['bog_slime', 'gloomshroom', 'ember_imp', 'bonewalker', 'thornling', 'grave_bat'];
    const mobs = row.map((t, i) => mob(t, -200 + i * 110, 10 + (i % 2) * 40));
    const champ = mob('magma_brute', 120, 250, 1, ['fast', 'molten'], 'Grimfang');
    const rare = mob('mossback', 390, 250, 2, ['vortex', 'frozen', 'extra_health'], 'Rotheart the Vile');
    const boss = mob('gorgemaw', 420, -250, 4);
    const all = [...mobs, champ, rare];
    label('normal · crit · huge crit · dots · other player (faint) · merged spam · taken · heal', 0, 400, 14);
    every(0.22, () => {
      const t = pickOne(all);
      const crit = Math.random() < 0.25;
      fire({ e: 'dmg', t: t.id, a: Math.round(rnd(120, 1800) * (crit ? 2.6 : 1)), el: pickOne([0, 0, 0, 1, 2, 3]), s: ME, ...(crit ? { c: 1 as const } : {}) });
      t.hp = Math.max(0.15, t.hp - 0.02);
    });
    every(0.5, () => { for (const [i, t] of mobs.entries()) fire({ e: 'dmg', t: t.id, a: Math.round(rnd(40, 90)), el: [0, 1, 2, 3, 4, 5][i], s: ME, dot: 1 }); }, 0.1);
    every(0.4, () => fire({ e: 'dmg', t: pickOne(all).id, a: Math.round(rnd(200, 900)), el: 5, s: OTHER }), 0.2);
    every(1.6, () => { for (let i = 0; i < 9; i++) later(i * 0.014, () => fire({ e: 'dmg', t: boss.id, a: Math.round(rnd(3000, 5000)), el: 0, s: ME, ...(i === 4 ? { c: 1 as const } : {}) })); }, 0.3);
    every(2.1, () => fire({ e: 'dmg', t: rare.id, a: 1_840_000, c: 1, el: 0, s: ME }), 0.9);
    every(0.9, () => fire({ e: 'dmg', t: ME, a: Math.round(rnd(60, 400)), el: 1, s: champ.id }), 0.5);
    every(3.3, () => fire({ e: 'dmg', t: ME, a: 2200, el: 0, s: boss.id, p: 1 }), 2.2);
    every(1.1, () => fire({ e: 'heal', t: ME, a: Math.round(rnd(80, 300)) }), 0.7);
    every(0.1, () => { for (const t of all) t.hp = Math.min(1, t.hp + 0.003); });
  },

  proj() {
    camX = 0; camY = 60;
    player(ME, 'ranger', 'Sylwen', -560, 380);
    const target = mob('bonewalker', 420, 400);
    const types: [string, number, number][] = [
      ['arrow', 0, 900], ['bolt', 0, 1000], ['bolt', 2, 1000], ['rocket', 1, 520], ['missile', 5, 800], ['missile', 2, 800],
      ['fireball', 1, 600], ['fireball', 5, 600], ['seed', 4, 330], ['firebolt', 1, 360], ['shard', 2, 800], ['spark', 3, 260], ['orb', 5, 500],
    ];
    types.forEach(([v, el, sp], i) => {
      const y = -300 + i * 52;
      label(`${v}${el ? ' · ' + ['phys', 'fire', 'cold', 'light', 'poison', 'arcane'][el] : ''}`, -620, y - 36, 13);
      every(1.3, () => proj(v, -520, y, 520, y, sp, el, v === 'seed' || v === 'firebolt' || v === 'spark' ? 999 : ME), i * 0.07);
    });
    label('homing missiles / rockets', 200, 300, 13);
    every(1.5, () => { proj('missile', -300, 420, 420, 400, 700, 5, ME, target.id); proj('rocket', -300, 460, 420, 400, 520, 1, ME, target.id); }, 0.4);
    label('cluster lob → explosion + grenades', -200, 300, 13);
    every(2.4, () => {
      const id = pid++, x = -520, y = 520, tx = -60, ty = 470;
      fire({ e: 'proj', id, s: ME, v: 'cluster', x, y, vx: (tx - x) / 0.45, vy: (ty - y) / 0.45, life: 450, el: 1 });
      later(0.45, () => {
        fire({ e: 'pend', id, x: tx, y: ty });
        fire({ e: 'aoe', v: 'cluster', x: tx, y: ty, r: 70, d: 0, el: 1, s: ME });
        for (let k = 0; k < 4; k++) { const a = (k / 4) * 6.28 + 0.4; fire({ e: 'aoe', v: 'grenade', x: tx + Math.cos(a) * rnd(60, 110), y: ty + Math.sin(a) * rnd(40, 80), r: 50, d: 0, el: 1, s: ME, delay: 350 + k * 40 }); }
      });
    }, 0.2);
  },

  aoe() {
    camX = 0; camY = 0;
    player(ME, 'mage', 'Ysolde', -650, 0);
    const items: [string, (x: number, y: number) => void][] = [
      ['meteor (tele → impact → molten)', (x, y) => {
        fire({ e: 'cast', s: ME, sk: 'meteor', x: -650, y: 0, tx: x, ty: y });
        fire({ e: 'tele', v: 'meteor', x, y, r: 110, d: 1000 });
        later(1.0, () => { fire({ e: 'aoe', v: 'meteor', x, y, r: 110, d: 0, el: 1, s: ME }); fire({ e: 'aoe', v: 'molten', x, y, r: 90, d: 3000, el: 1, s: ME }); });
      }],
      ['meteor shower (delay)', (x, y) => { for (let k = 0; k < 7; k++) fire({ e: 'aoe', v: 'meteorSmall', x: x + rnd(-110, 110), y: y + rnd(-80, 80), r: 50, d: 0, el: 1, s: ME, delay: 300 + k * 170 }); }],
      ['comet (cold meteor)', (x, y) => {
        fire({ e: 'cast', s: ME, sk: 'meteor', r: 'comet', x: -650, y: 0, tx: x, ty: y });
        fire({ e: 'tele', v: 'meteor', x, y, r: 100, d: 1000 });
        later(1.0, () => fire({ e: 'aoe', v: 'meteor', x, y, r: 100, d: 0, el: 2, s: ME }));
      }],
      ['black hole', (x, y) => fire({ e: 'aoe', v: 'blackhole', x, y, r: 120, d: 2200, el: 5, s: ME })],
      ['frost nova', (x, y) => fire({ e: 'aoe', v: 'nova', x, y, r: 130, d: 0, el: 2, s: ME })],
      ['ground stomp', (x, y) => fire({ e: 'aoe', v: 'stomp', x, y, r: 120, d: 0, el: 0, s: ME })],
      ['rend', (x, y) => fire({ e: 'aoe', v: 'rend', x, y, r: 110, d: 0, el: 0, s: ME })],
      ['seismic fissure', (x, y) => fire({ e: 'aoe', v: 'fissure', x: x - 120, y, r: 300, d: 0, el: 0, s: ME, a: 0 })],
      ['rain of vengeance', (x, y) => fire({ e: 'aoe', v: 'rain', x, y, r: 120, d: 2000, el: 0, s: ME })],
      ['dark cloud (lightning rain)', (x, y) => fire({ e: 'aoe', v: 'rain', x, y, r: 120, d: 2000, el: 3, s: ME })],
    ];
    grid(items, 5, 290, 420, 2.9);
  },

  aoe2() {
    camX = 0; camY = 0;
    const w = player(ME, 'warrior', 'Brakka', 330, -160);
    void w;
    const items: [string, (x: number, y: number) => void][] = [
      ['cluster explosion', (x, y) => fire({ e: 'aoe', v: 'cluster', x, y, r: 80, d: 0, el: 1, s: ME })],
      ['grenade', (x, y) => fire({ e: 'aoe', v: 'grenade', x, y, r: 50, d: 0, el: 1, s: ME })],
      ['explode (wisp, fire)', (x, y) => fire({ e: 'aoe', v: 'explode', x, y, r: 70, d: 0, el: 1 })],
      ['molten trail', (x, y) => { for (let k = 0; k < 4; k++) later(k * 0.25, () => fire({ e: 'aoe', v: 'molten_trail', x: x - 60 + k * 40, y, r: 34, d: 1500, el: 1 })); }],
      ['poison pool', (x, y) => fire({ e: 'aoe', v: 'poison_pool', x, y, r: 90, d: 2600, el: 4 })],
      ['dust devil hits', (x, y) => { for (let k = 0; k < 5; k++) later(k * 0.2, () => fire({ e: 'aoe', v: 'dustdevil_hit', x: x + rnd(-40, 40), y: y + rnd(-30, 30), r: 45, d: 0, el: 0, s: ME })); }],
      ['whirlwind ticks', (x, y) => { for (let k = 0; k < 8; k++) later(k * 0.25, () => fire({ e: 'aoe', v: 'whirl', x, y, r: 95, d: 0, el: 0, s: ME })); }],
      ['cleave (+ wide, lightning)', (x, y) => {
        fire({ e: 'aoe', v: 'cleave', x, y, r: 120, d: 0, el: 0, s: ME, a: 0 });
        later(0.5, () => fire({ e: 'cast', s: ME, sk: 'cleave', r: 'broad_sweep', x, y, tx: x - 100, ty: y + 10 }));
        later(1.0, () => fire({ e: 'aoe', v: 'cleave', x, y, r: 120, d: 0, el: 3, s: ME, a: 0.6 }));
      }],
      ['chain zap + explode (electric)', (x, y) => { fire({ e: 'aoe', v: 'chain', x: x - 50, y, r: 30, d: 0, el: 3 }); fire({ e: 'aoe', v: 'explode', x: x + 50, y, r: 60, d: 0, el: 3 }); }],
      ['monster slam / boss slam', (x, y) => { fire({ e: 'aoe', v: 'slam', x: x - 60, y, r: 70, d: 0, el: 1 }); later(0.6, () => fire({ e: 'aoe', v: 'slam', x: x + 30, y, r: 140, d: 0, el: 4 })); }],
    ];
    grid(items, 5, 290, 420, 2.9);
  },

  tele() {
    camX = 0; camY = 0;
    player(ME, 'warrior', 'Brakka', -600, 300);
    const items: [string, (x: number, y: number) => void][] = [
      ['slam (circle)', (x, y) => fire({ e: 'tele', v: 'slam', x, y, r: 90, d: 1200 })],
      ['slam cone', (x, y) => fire({ e: 'tele', v: 'slam', x: x - 100, y, r: 220, d: 1200, a: 0, w: 1.1 })],
      ['slam line', (x, y) => fire({ e: 'tele', v: 'slam', x: x - 110, y, r: 230, d: 1200, a: 0.2, w: 60 })],
      ['meteor (mine)', (x, y) => { fire({ e: 'tele', v: 'meteor', x, y, r: 100, d: 1400 }); later(1.4, () => fire({ e: 'aoe', v: 'meteor', x, y, r: 100, d: 0, el: 1, s: ME })); }],
      ['frozen orb', (x, y) => { fire({ e: 'tele', v: 'frozen_orb', x: x - 50, y, r: 60, d: 1500 }); fire({ e: 'tele', v: 'frozen_orb', x: x + 50, y: y + 30, r: 60, d: 1500 }); }],
      ['mortar', (x, y) => { for (let k = 0; k < 3; k++) fire({ e: 'tele', v: 'mortar', x: x + (k - 1) * 70, y: y + (k % 2) * 30, r: 55, d: 900 + k * 120 }); }],
      ['boss ring', (x, y) => { const b = mob('vexis', x, y, 4); fire({ e: 'tele', v: 'boss_ring', x, y, r: 110, d: 1400 }); later(1.4, () => { for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.283; proj('firebolt', x, y, x + Math.cos(a) * 260, y + Math.sin(a) * 260, 420, 1, b.id, undefined, false); } }); later(2.6, () => removeEnt(b.id)); }],
      ['molten death (+ aoe explode dedupe)', (x, y) => { fire({ e: 'tele', v: 'molten_death', x, y, r: 90, d: 1200 }); later(1.22, () => fire({ e: 'aoe', v: 'explode', x, y, r: 90, d: 0, el: 1 })); }],
    ];
    grid(items, 4, 360, 420, 3.0);
  },

  beam() {
    camX = 0; camY = 0;
    player(ME, 'ranger', 'Sylwen', -560, 300);
    const s1 = addEnt({ id: nextId++, k: 'summon', t: 'sentry', r: 14 }, -420, -200, 34);
    const s2 = addEnt({ id: nextId++, k: 'summon', t: 'sentry', r: 14 }, -60, -120, 34);
    const s3 = addEnt({ id: nextId++, k: 'summon', t: 'sentry', r: 14 }, -260, 60, 34);
    label('sentry chains', -240, 120, 14);
    every(0.5, () => {
      fire({ e: 'beam', v: 'chain', x: s1.x, y: s1.y, tx: s2.x, ty: s2.y, el: 3, d: 500 });
      fire({ e: 'beam', v: 'chain', x: s2.x, y: s2.y, tx: s3.x, ty: s3.y, el: 3, d: 500 });
    });
    const mobs = [mob('ember_imp', 200, -220), mob('bonewalker', 360, -160), mob('grave_bat', 300, -20), mob('bog_slime', 460, -60)];
    label('electrify arcs', 330, 40, 14);
    every(0.9, () => { const a = pickOne(mobs), b = pickOne(mobs.filter((m) => m !== a)); fire({ e: 'beam', v: 'arc', x: a.x, y: a.y, tx: b.x, ty: b.y, el: 3, d: 200 }); });
    const v = mob('cinder_cultist', 260, 280, 2, ['vortex'], 'Gloomshade');
    const pulled = player(OTHER, 'mage', 'Ysolde', 560, 330);
    label('vortex tether', 400, 400, 14);
    every(2.4, () => { pulled.x = 600; fire({ e: 'beam', v: 'vortex', x: v.x, y: v.y, tx: pulled.x, ty: pulled.y, el: 5, d: 600 }); });
  },

  cast() {
    camX = 0; camY = 0;
    const skills: [string, string, string?][] = [
      ['warrior', 'cleave'], ['warrior', 'whirlwind'], ['warrior', 'rend'], ['warrior', 'ground_stomp'], ['warrior', 'seismic_slam'], ['warrior', 'battle_rage'],
      ['ranger', 'hungering_arrow'], ['ranger', 'sentry'], ['ranger', 'multishot'], ['ranger', 'cluster_arrow'], ['ranger', 'rain_of_vengeance'], ['ranger', 'companion'],
      ['mage', 'magic_missile'], ['mage', 'meteor'], ['mage', 'black_hole'], ['mage', 'frost_nova'], ['mage', 'hydra'], ['mage', 'magic_weapon'],
    ];
    const cols = 6, sx = 240, sy = 250;
    skills.forEach(([cls, sk, rune], i) => {
      const x = -((cols - 1) * sx) / 2 + (i % cols) * sx, y = -330 + Math.floor(i / cols) * sy;
      const id = 10 + i;
      player(id, cls, '', x, y);
      label(sk, x, y + 20, 13);
      every(1.6, () => fire({ e: 'cast', s: ME, sk, r: rune, x, y, tx: x + 90, ty: y, rad: 110 }), (i % cols) * 0.1);
    });
    const d = player(ME, 'warrior', 'Brakka', -500, 430);
    label('dash', -400, 460, 13);
    every(1.4, () => { const x0 = -620, x1 = -300; d.x = x0; fire({ e: 'dash', t: ME, x: x0, y: 430, tx: x1, ty: 430 }); later(0.18, () => { d.x = x1; }); });
    const lv = player(OTHER, 'mage', 'Ysolde', 60, 430);
    label('level up', 60, 460, 13);
    every(3, () => fire({ e: 'level', t: lv.id, lv: 43 }), 0.2);
    const pg = player(3, 'ranger', 'Sylwen', 440, 430, 70, 215);
    label('paragon', 440, 460, 13);
    every(3, () => fire({ e: 'paragon', t: pg.id, lv: 216 }), 1.4);
  },

  death() {
    camX = 0; camY = 0;
    player(ME, 'warrior', 'Brakka', -640, 0);
    const els = ['physical', 'fire', 'cold', 'lightning', 'poison', 'arcane', 'holy'];
    const kinds = ['bog_slime', 'ember_imp', 'gloomshroom', 'bonewalker', 'thornling', 'ash_wisp', 'grave_bat'];
    els.forEach((name, i) => {
      for (const big of [false, true]) {
        const x = -480 + i * 160, y = big ? 200 : -140;
        label(`${name}${big ? ' (elite)' : ''}`, x, y + 30, 13);
        const spawn = () => {
          const m = big ? mob('magma_brute', x, y, 1, ['fast'], 'Cinderhide') : mob(kinds[i], x, y);
          later(0.9, () => killEnt(m, i, big));
        };
        every(2.4, spawn, i * 0.12 + (big ? 0.6 : 0));
      }
    });
  },

  loot() {
    camX = 0; camY = 30;
    const me = player(ME, 'warrior', 'Brakka', -560, 260);
    player(OTHER, 'mage', 'Ysolde', -560, -60, 70, 214);
    mob('magma_brute', 520, -260, 1, ['fast', 'molten'], 'Grimfang');
    mob('mossback', 520, 120, 2, ['vortex', 'frozen', 'mortar'], 'Rotheart the Vile');
    label('nameplates: player · paragon · champion · rare', 300, 380, 13);
    const look = (shape: string, primary: number): ItemLook => ({ shape, primary, secondary: 0x553322, glow: 0, variant: 1 });
    const drops: LootView[] = [
      { lk: 'item', name: 'Rusty Shortsword', rarity: 'normal', look: look('sword', 0xa8a8a8), kind: 'weapon1h' },
      { lk: 'item', name: 'Blessed Hood', rarity: 'magic', look: look('hood', 0x6a5acd), kind: 'head' },
      { lk: 'item', name: 'Dread Grasp', rarity: 'rare', look: look('gauntlets', 0xb08a50), kind: 'hands' },
      { lk: 'item', name: 'Bloodwake', rarity: 'legendary', ancient: 0, look: look('mace', 0xd2691e), kind: 'weapon2h' },
      { lk: 'item', name: "Crown of the Fallen Star", rarity: 'set', look: look('amulet', 0x2ecc71), kind: 'neck' },
      { lk: 'item', name: 'Starfall Mantle', rarity: 'legendary', ancient: 1, look: look('mantle', 0x8e44ad), kind: 'shoulders' },
      { lk: 'item', name: 'Ouroboros Loop', rarity: 'legendary', ancient: 2, look: look('ring', 0xf1c40f), kind: 'ring' },
      { lk: 'item', name: "Siegebreaker's Treads", rarity: 'set', ancient: 1, look: look('greaves', 0x2ecc71), kind: 'legs' },
      { lk: 'item', name: 'Thunderhead', rarity: 'rare', look: look('bow', 0x8b5a2b), kind: 'weapon2h' },
      { lk: 'item', name: 'Studded Belt', rarity: 'magic', look: look('belt', 0x7a5230), kind: 'waist' },
      { lk: 'gold', name: 'Gold', amount: 37 },
      { lk: 'gold', name: 'Gold', amount: 1450 },
      { lk: 'gold', name: 'Gold', amount: 92000 },
      { lk: 'gem', name: 'Flawless Ruby', gem: 'ruby:3', amount: 3 },
      { lk: 'gem', name: 'Emerald', gem: 'emerald:1', amount: 1 },
      { lk: 'gem', name: 'Royal Topaz', gem: 'topaz:5', amount: 5 },
      { lk: 'gem', name: 'Amethyst', gem: 'amethyst:2', amount: 2 },
      { lk: 'gem', name: 'Diamond', gem: 'diamond:4', amount: 4 },
      { lk: 'globe', name: 'Health Globe' },
      { lk: 'mat', name: "Death's Breath", amount: 1 },
    ];
    const cx = 20, cy = 60;
    let lootIds: number[] = [];
    const burst = () => {
      for (const id of lootIds) removeEnt(id);
      lootIds = [];
      const g = mob('treasure_goblin', cx, cy, 5);
      later(0.5, () => {
        killEnt(g, 0, true);
        drops.forEach((l, i) => {
          const a = (i / drops.length) * 6.283 + rnd(-0.15, 0.15), d = rnd(90, 250);
          const e = addEnt({ id: nextId++, k: 'loot', t: l.lk, r: 12, loot: l }, cx + Math.cos(a) * d * 1.3, cy + Math.sin(a) * d * 0.85);
          lootIds.push(e.id);
        });
      });
      // Pick up a few to show the fly-to-player tween.
      later(6.5, () => {
        for (const id of lootIds.slice(10, 14)) {
          const e = ents.get(id);
          if (!e) continue;
          fire({ e: 'pickup', t: ME, l: id, lk: e.desc.loot!.lk, name: e.desc.loot!.name, amount: e.desc.loot!.amount });
          me.x = e.x - 40; me.y = e.y + 10;
          removeEnt(id);
        }
        lootIds = lootIds.filter((id) => ents.has(id));
      });
    };
    every(9, burst, 0.2);
  },

  mix() {
    camX = 0; camY = 0;
    const w = player(ME, 'warrior', 'Brakka', -60, 40);
    const pack: Ent[] = [];
    const types = ['ember_imp', 'bonewalker', 'grave_bat', 'ash_wisp', 'ember_imp', 'bonewalker'];
    for (let i = 0; i < 26; i++) {
      const a = rnd(0, 6.28), d = rnd(60, 330);
      pack.push(mob(pickOne(types), -60 + Math.cos(a) * d * 1.3, 40 + Math.sin(a) * d * 0.8));
    }
    const rare = mob('magma_brute', 260, -120, 2, ['molten', 'mortar'], 'Cinderhide the Unbroken');
    pack.push(rare);
    const ranger = player(OTHER, 'ranger', 'Sylwen', -560, 260, 70, 120);
    const sentries = [addEnt({ id: nextId++, k: 'summon', t: 'sentry', r: 14 }, -470, 180, 34), addEnt({ id: nextId++, k: 'summon', t: 'sentry', r: 14 }, -430, 330, 34)];
    every(0.25, () => {
      fire({ e: 'aoe', v: 'whirl', x: w.x, y: w.y, r: 110, d: 0, el: 0, s: ME });
      for (const m of pack) {
        if (m.dying || Math.hypot(m.x - w.x, m.y - w.y) > 150) continue;
        const crit = Math.random() < 0.3;
        fire({ e: 'dmg', t: m.id, a: Math.round(rnd(3000, 9000) * (crit ? 3 : 1)), el: 0, s: ME, ...(crit ? { c: 1 as const } : {}) });
        m.hp -= 0.12;
        if (m.hp <= 0 && m !== rare) killEnt(m, pickOne([0, 0, 1, 3]));
      }
    });
    every(0.6, () => { w.x += rnd(-30, 30); w.y += rnd(-20, 20); });
    every(1.0, () => {
      for (const s of sentries) {
        const t = pickOne(pack.filter((m) => !m.dying));
        if (t) { proj('bolt', s.x, s.y - 10, t.x, t.y, 1000, 0, s.id, t.id); later(Math.hypot(t.x - s.x, t.y - s.y) / 1000, () => fire({ e: 'dmg', t: t.id, a: Math.round(rnd(20000, 60000)), el: 0, s: s.id })); }
      }
    });
    every(1.6, () => fire({ e: 'beam', v: 'chain', x: sentries[0].x, y: sentries[0].y, tx: sentries[1].x, ty: sentries[1].y, el: 3, d: 500 }));
    every(2.2, () => {
      const t = pickOne(pack.filter((m) => !m.dying));
      if (!t) return;
      fire({ e: 'cast', s: OTHER, sk: 'multishot', x: ranger.x, y: ranger.y, tx: t.x, ty: t.y });
      for (let k = -4; k <= 4; k++) { const a = Math.atan2(t.y - ranger.y, t.x - ranger.x) + k * 0.13; proj('arrow', ranger.x, ranger.y - 10, ranger.x + Math.cos(a) * 700, ranger.y + Math.sin(a) * 700, 900, 0, OTHER, undefined, false); }
    }, 0.5);
    every(3.5, () => { fire({ e: 'tele', v: 'meteor', x: 140, y: -40, r: 120, d: 1000 }); later(1, () => { fire({ e: 'aoe', v: 'meteor', x: 140, y: -40, r: 120, d: 0, el: 1, s: OTHER }); fire({ e: 'aoe', v: 'molten', x: 140, y: -40, r: 100, d: 3000, el: 1, s: OTHER }); }); }, 0.8);
    every(3.0, () => fire({ e: 'tele', v: 'mortar', x: w.x + rnd(-60, 60), y: w.y + rnd(-40, 40), r: 55, d: 900 }), 1.5);
    every(5, () => {
      for (const m of pack) if (m.dying) { /* respawned below */ }
      const alive = pack.filter((m) => !m.dying).length;
      for (let i = alive; i < 26; i++) {
        const a = rnd(0, 6.28), d = rnd(120, 330);
        const n = mob(pickOne(types), -60 + Math.cos(a) * d * 1.3, 40 + Math.sin(a) * d * 0.8);
        pack.push(n);
      }
      for (let i = pack.length - 1; i >= 0; i--) if (pack[i].dying) pack.splice(i, 1);
    }, 4);
  },

  stress() {
    camX = 0; camY = 0;
    player(ME, 'warrior', 'Brakka', -600, 0);
    const mobs: Ent[] = [];
    for (let i = 0; i < 48; i++) mobs.push(mob(pickOne(['bog_slime', 'ember_imp', 'bonewalker', 'grave_bat']), -480 + (i % 12) * 90, -300 + Math.floor(i / 12) * 170));
    let acc = 0;
    stressTick = (dt) => {
      acc += dt * 300;
      while (acc >= 1) {
        acc -= 1;
        const t = pickOne(mobs);
        const r = Math.random();
        fire({ e: 'dmg', t: t.id, a: Math.round(rnd(500, 90000)), el: pickOne([0, 0, 1, 2, 3, 4, 5]), s: ME, ...(r < 0.2 ? { c: 1 as const } : r < 0.3 ? { dot: 1 as const } : {}) });
      }
    };
    every(0.05, () => { const a = pickOne(mobs), b = pickOne(mobs); proj(pickOne(['arrow', 'bolt', 'missile', 'fireball', 'rocket']), a.x, a.y, b.x, b.y, 800, pickOne([0, 1, 2, 5])); });
    every(0.25, () => { const m = pickOne(mobs); fire({ e: 'aoe', v: pickOne(['explode', 'grenade', 'whirl', 'nova', 'stomp']), x: m.x, y: m.y, r: 80, d: 0, el: pickOne([1, 2, 0]), s: ME }); });
    every(1.5, () => { const m = pickOne(mobs); fire({ e: 'tele', v: 'meteor', x: m.x, y: m.y, r: 100, d: 900 }); later(0.9, () => fire({ e: 'aoe', v: 'meteor', x: m.x, y: m.y, r: 100, d: 0, el: 1, s: ME })); });
    every(0.4, () => { const m = pickOne(mobs); killEnt(m, pickOne([0, 1, 2, 3, 4, 5])); const i = mobs.indexOf(m); later(0.4, () => { mobs[i] = mob(pickOne(['bog_slime', 'ember_imp']), m.x, m.y); }); });
  },
};

let stressTick: ((dt: number) => void) | null = null;

function grid(items: [string, (x: number, y: number) => void][], cols: number, sx: number, sy: number, period: number): void {
  const rows = Math.ceil(items.length / cols);
  items.forEach(([name, fn], i) => {
    const x = -((cols - 1) * sx) / 2 + (i % cols) * sx;
    const y = -((rows - 1) * sy) / 2 + Math.floor(i / cols) * sy;
    label(name, x, y + 150, 13);
    every(period, () => fn(x, y), 0.15 + i * 0.12);
  });
}

// ─────────────────────────── HUD / nav ───────────────────────────

const nav = document.getElementById('nav')!;
for (const s of SCENES) {
  const a = document.createElement('a');
  a.href = `?scene=${s}`;
  a.textContent = s;
  if (s === SCENE) a.className = 'on';
  nav.appendChild(a);
}
const hud = document.getElementById('hud')!;
const samples: number[] = [];
const totals: number[] = [];
const frames: number[] = [];
const perf = { bakeMs, avgVfx: 0, p95Vfx: 0, maxVfx: 0, avgTotal: 0, p95Total: 0, maxTotal: 0, avgFrame: 0, particles: 0, numbers: 0, projectiles: 0, effects: 0, budget: 1, samples: 0 };
Object.assign(window as object, { __gallery: { vfx, fire, scene: SCENE, sfx }, __perf: perf });

(scenes[SCENE] ?? scenes.combat)();
window.addEventListener('pointerdown', () => sfx.unlock());

// ─────────────────────────── frame ───────────────────────────

function step(rawMs: number): void {
  const dtMs = Math.min(rawMs, 100);
  const dt = dtMs / 1000;
  time += dt;
  const due = timers.filter((t) => t.at <= time);
  timers = timers.filter((t) => t.at > time);
  for (const t of due) t.fn();
  for (const l of loops) while (time >= l.next) { l.next += l.period; l.fn(); }
  stressTick?.(dt);

  const now = simNow();
  const scr = app.screen;
  zoom = scr.height / VIEW_HEIGHT;
  let sx = 0, sy = 0;
  if (now < shakeEnd) {
    const f = (shakeEnd - now) / shakeDur, m = shakeMag * f * f;
    sx = (Math.random() * 2 - 1) * m; sy = (Math.random() * 2 - 1) * m;
  }
  world.scale.set(zoom);
  world.position.set(Math.round(scr.width / 2 - (camX + sx) * zoom), Math.round(scr.height / 2 - (camY + sy) * zoom));

  const viewDt = now < hitStopUntil ? 0 : dt;
  for (const e of ents.values()) {
    e.view.root.position.set(e.x, e.y);
    e.view.root.zIndex = e.y;
    const st: ViewState = { x: e.x, y: e.y, vx: 0, vy: 0, moving: false, facingLeft: e.kind === 'mob', flags: e.flags, attackSeq: 0, hpFrac: e.hp, time, aps: 1.2 };
    e.view.update(viewDt, st);
    if (e.plate) { e.plate.root.position.set(e.x, e.y - e.view.height - 8); e.plate.update(e.hp, e.flags, false); }
  }
  sfx.setListener(camX, camY);

  const t0 = performance.now();
  vfx.update(dtMs);
  const ms = performance.now() - t0;
  const total = ms + handleAcc;
  handleAcc = 0;
  if (time > 1.5) {
    samples.push(ms);
    totals.push(total);
    if (totals.length > 600) totals.shift();
    const st2 = [...totals].sort((a, b) => a - b);
    perf.avgTotal = totals.reduce((a, b) => a + b, 0) / totals.length;
    perf.p95Total = st2[Math.floor(st2.length * 0.95)] ?? 0;
    perf.maxTotal = st2[st2.length - 1] ?? 0;
    frames.push(rawMs);
    if (samples.length > 600) { samples.shift(); frames.shift(); }
    const sorted = [...samples].sort((a, b) => a - b);
    perf.avgVfx = samples.reduce((a, b) => a + b, 0) / samples.length;
    perf.p95Vfx = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    perf.maxVfx = sorted[sorted.length - 1] ?? 0;
    perf.avgFrame = frames.reduce((a, b) => a + b, 0) / frames.length;
    perf.samples = samples.length;
  }
  const st = vfx.stats;
  perf.particles = st.particles; perf.numbers = st.numbers; perf.projectiles = st.projectiles; perf.effects = st.effects; perf.budget = st.budget;
  hud.textContent = `scene: ${SCENE}   (click anywhere to enable sound)\n` +
    `vfx update: ${ms.toFixed(2)} ms  avg ${perf.avgVfx.toFixed(2)}  p95 ${perf.p95Vfx.toFixed(2)}  max ${perf.maxVfx.toFixed(2)}   update+handle avg ${perf.avgTotal.toFixed(2)}  p95 ${perf.p95Total.toFixed(2)}\n` +
    `frame: ${perf.avgFrame.toFixed(1)} ms   particles ${st.particles}   numbers ${st.numbers}   projectiles ${st.projectiles}   effects ${st.effects}   budget ${st.budget.toFixed(2)}`;
}

if (MANUAL) {
  app.ticker.stop();
  const g = (window as unknown as { __gallery: Record<string, unknown> }).__gallery;
  g.advance = (sec: number) => {
    const n = Math.round(sec * 60);
    for (let i = 0; i < n; i++) step(1000 / 60);
    app.render();
    return time;
  };
  app.render();
} else {
  app.ticker.add((tk) => step(tk.deltaMS));
}

(window as unknown as { __ready: boolean }).__ready = true;
