// VFX gallery: a standalone Pixi page that drives the real `Vfx` module with scripted server events
// against placeholder targets. Scenes: ?scene=combat | proj | aoe | aoe2 | tele | beam | cast | death |
// loot | mix | stress | warrior | warrior2 | warrior3 | ranger | ranger2 | ranger3 | ranger4. Exposes window.__gallery /
// window.__perf for automated screenshots and profiling. The warrior and ranger scenes use the real hero rig so the
// skill poses play with their effects; the ranger scenes also use the real summon views.

import '@fontsource/alegreya-sans/700.css';
import '@fontsource/lilita-one/400.css';
import '@fontsource/cinzel/700.css';

import { Application, Container, Graphics, Text } from 'pixi.js';
import { createCharacter, playerLook } from '@shared/character';
import { MONSTERS } from '@shared/data/monsters';
import { F_CHANNEL, F_MOVING, F_STUN, F_WINDUP, type EntDesc, type GameEvent, type LootView } from '@shared/protocol';
import type { ClassId, ItemLook } from '@shared/types';
import { sfx } from '../audio/sfx';
import { createMonsterView, createPlayerView, createSummonView, initArt } from '../render/art';
import type { ActingView, EntityView, Nameplate, ViewState } from '../render/types';
import { Vfx, type VfxContext } from '../render/vfx';

const qs = new URLSearchParams(location.search);
const SCENE = qs.get('scene') ?? 'combat';
/** ?manual=1: time only advances through __gallery.advance(sec) (deterministic captures). */
const MANUAL = qs.get('manual') === '1';
const SCENES = ['combat', 'proj', 'aoe', 'aoe2', 'tele', 'charge', 'beam', 'cast', 'death', 'loot', 'mix', 'stress', 'warrior', 'warrior2', 'warrior3', 'ranger', 'ranger2', 'ranger3', 'ranger4', 'rangerfight'];
/** Ranger M1 scenes also draw the real summon views (snare, mortar, flock, badger, heron, sentry). */
const RANGER_SCENE = SCENE.startsWith('ranger');
/** Scenes that draw players with the real hero rig (skill poses) instead of placeholders. */
const REAL_HEROES = SCENE === 'warrior' || SCENE === 'warrior2' || SCENE === 'warrior3' || RANGER_SCENE;

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

/** ?vh= world units shown vertically (close-ups), ?cx= / ?cy= camera centre override. */
const VIEW_HEIGHT = Number(qs.get('vh') ?? (SCENE === 'charge' ? 620 : 920));
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
  /** Scripted velocity (units/s) for views that face / animate by it; defaults to the F_MOVING stand-in. */
  vx?: number; vy?: number;
  /** Scripted attackSeq (summons snap / fire / burst on change). */
  aseq?: number;
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
  else if (SCENE === 'charge' && desc.k === 'mob') view = createMonsterView(desc.t, 0, [], desc.sc ?? 1);
  else if (REAL_HEROES && desc.k === 'player') view = createPlayerView(playerLook(createCharacter(desc.n || 'Brakka', desc.t as ClassId, 7 + (desc.id % 5))));
  else if (RANGER_SCENE && desc.k === 'summon') view = createSummonView(desc.t, desc.r);
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
  entityFlags: (id) => ents.get(id)?.flags ?? null,
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
const fire = (ev: GameEvent) => {
  // like game.ts: a `cast` also plays the caster's pose (real hero rigs only; placeholders ignore it)
  if (ev.e === 'cast') (ents.get(ev.s)?.view as ActingView | undefined)?.playAction?.({ skill: ev.sk, rune: ev.r, tx: ev.tx, ty: ev.ty, cycleMs: 1000 / 1.6 });
  const t0 = performance.now(); vfx.handle(ev); handleAcc += performance.now() - t0;
};

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

// ── ranger scene helpers ──
function summon(t: string, x: number, y: number, r = 14): Ent {
  return addEnt({ id: nextId++, k: 'summon', t, r }, x, y, 34);
}
/** Skipstone Bolt: one `proj` per leg (hero → first enemy → next …) at 900 units/s, a `pend` with hit at each. */
function skipChain(v: string, src: Ent, chain: Ent[], el: number, onSkip?: (m: Ent, k: number) => void): void {
  let px = src.x + 16, py = src.y - 2, at = 0;
  chain.forEach((m, k) => {
    const sx = px, sy = py, d = Math.hypot(m.x - sx, m.y - sy), t0 = at;
    later(t0, () => proj(v, sx, sy, m.x, m.y, 900, el, src.id));
    later(t0 + d / 900, () => { fire({ e: 'dmg', t: m.id, a: Math.round(rnd(900, 1500) * (1 - k * 0.2)), el, s: src.id }); onSkip?.(m, k); });
    at += d / 900 + 0.01; px = m.x; py = m.y;
  });
}
/** A one-shot shove of `dist` units along +x over 0.15 s (Heavy Stone knockback); then walks back. */
function knock(e: Ent, x0: number, dist: number): (dt: number) => void {
  let t = 0;
  return (dt) => { if (t > 1.2) return; t += dt; e.x = x0 + dist * (t < 0.15 ? 1 - (1 - t / 0.15) ** 2 : Math.max(0, 1 - (t - 0.5) / 0.7)); };
}
/** Slide an entity from (x0, y0) to (x1, y1) between t0 and t1 seconds from now (Chain Snare drag). */
function slide(e: Ent, x0: number, y0: number, x1: number, y1: number, t0: number, t1: number): (dt: number) => void {
  let t = 0;
  return (dt) => { if (t > t1) return; t += dt; const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0))); const k = f * f; e.x = x0 + (x1 - x0) * k; e.y = y0 + (y1 - y0) * k; };
}

// ─────────────────────────── scenes ───────────────────────────

const scenes: Record<string, () => void> = {
  charge() {
    const def = MONSTERS.siltusk, origin = -def.attack.range / 2, target = origin + def.attack.range;
    const m = mob(def.id, origin, 0);
    label('Siltusk · scripted rendering preview', 0, -160, 18);
    label('Actual rig and warning renderer · fixed 620-unit view', 0, -125, 12);
    label('Warning is held for inspection; these are not live combat timings.', 0, 125, 12);
    const controls = document.createElement('div');
    controls.style.cssText = 'position:fixed;bottom:24px;left:24px;display:flex;gap:12px;align-items:center;color:#e8d9b5;font:16px serif';
    const status = document.createElement('span');
    const warning = () => {
      vfx.clear(); m.x = origin; m.flags = F_WINDUP;
      fire({e:'tele',v:'charge',s:m.id,x:origin,y:0,r:def.attack.range,w:def.radius*2,a:0,d:def.attack.windupMs});
      status.textContent = 'Warning held';
    };
    for (const [text, action] of [
      ['Hold warning', warning],
      ['Interrupt', () => { m.flags=F_STUN; status.textContent='Interrupted · warning removed'; }],
      ['Charge', () => { m.flags=F_MOVING; status.textContent='Charge · fixed path'; }],
    ] as const) {
      const button=document.createElement('button');button.textContent=text;button.addEventListener('click',action);controls.appendChild(button);
    }
    controls.appendChild(status);document.body.appendChild(controls);
    stressTick = dt => {
      if (!(m.flags & F_MOVING)) return;
      m.x=Math.min(target,m.x+def.attack.range*dt*1000/def.attack.chargeMs!);
      if(m.x>=target){m.flags=0;status.textContent='Charge finished';}
    };
    warning();
  },
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
      ['warrior', 'tolling_blow'], ['warrior', 'sawtooth_hatchet'], ['warrior', 'muster_standard'], ['warrior', 'ironplough'], ['warrior', 'cairnfall'],
    ];
    const cols = 6, sx = 240, sy = 205;
    skills.forEach(([cls, sk, rune], i) => {
      const x = -((cols - 1) * sx) / 2 + (i % cols) * sx, y = -360 + Math.floor(i / cols) * sy;
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
      { lk: 'mat', name: 'Cinder Essence', amount: 1 },
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

  // Warrior M1 strikes & throws (server contract: server/src/sim/skills/warriorM1.ts), real hero rig.
  warrior() {
    camX = 0; camY = 0;
    const cell = (i: number) => ({ x: -540 + (i % 3) * 540, y: -170 + Math.floor(i / 3) * 400 });
    const HS = 760; // WARRIOR_FX.hatchetSpeed
    const blows = (h: Ent, m: Ent, el: number, echo: boolean) => {
      for (let k = 0; k < 3; k++) later(k * 0.55, () => {
        fire({ e: 'cast', s: h.id, sk: 'tolling_blow', r: el ? 'furnace_clapper' : undefined, x: h.x, y: h.y, tx: m.x, ty: m.y, rad: 40 });
        fire({ e: 'aoe', v: 'tollblow', x: m.x, y: m.y, r: 40, d: 260, el, s: h.id, a: 0 });
        if (k < 2) return;
        fire({ e: 'aoe', v: 'toll', x: m.x, y: m.y, r: 70, d: 520, el, s: h.id });
        if (echo) later(0.5, () => fire({ e: 'aoe', v: 'toll', x: m.x, y: m.y, r: 70, d: 520, el, s: h.id }));
        else fire({ e: 'aoe', v: 'toll', x: h.x, y: h.y, r: 50, d: 520, el, s: h.id });
      });
    };
    { // Tolling Blow: every third blow tolls; Twin Ring rings at the hero's feet
      const c = cell(0), h = player(10, 'warrior', 'Brakka', c.x - 70, c.y + 40), m = mob('bonewalker', c.x + 10, c.y + 40);
      label('Tolling Blow · 3rd blow tolls · Twin Ring', c.x, c.y + 130);
      every(2.8, () => blows(h, m, 0, false), 0.3);
    }
    { // Furnace Clapper (fire) + Bronze Echo
      const c = cell(1), h = player(11, 'warrior', 'Hroth', c.x - 70, c.y + 40), m = mob('magma_brute', c.x + 14, c.y + 40, 1, [], 'Cinderhide');
      label('Furnace Clapper (fire) · Bronze Echo', c.x, c.y + 130);
      every(3.2, () => blows(h, m, 1, true), 0.9);
    }
    { // Sawtooth Hatchet with Grinding Stop (hold) and Splinters off an elite
      const c = cell(2), h = player(12, 'warrior', 'Ulla', c.x - 230, c.y + 40);
      const elite = mob('magma_brute', c.x + 10, c.y + 40, 1, [], 'Grimfang');
      const s1 = mob('ember_imp', c.x + 70, c.y - 60), s2 = mob('grave_bat', c.x + 120, c.y + 120);
      mob('bog_slime', c.x - 90, c.y + 46);
      label('Sawtooth Hatchet · Grinding Stop · Splinters', c.x, c.y + 130);
      every(2.8, () => {
        fire({ e: 'cast', s: h.id, sk: 'sawtooth_hatchet', x: h.x, y: h.y, tx: h.x + 320, ty: h.y });
        fire({ e: 'aoe', v: 'hatchet', x: h.x, y: h.y, r: 320, d: 400, el: 0, s: h.id, a: 0 });
        later(240 / HS, () => {
          fire({ e: 'beam', v: 'splinter', x: elite.x, y: elite.y, tx: s1.x, ty: s1.y, el: 0, d: 200 });
          fire({ e: 'beam', v: 'splinter', x: elite.x, y: elite.y, tx: s2.x, ty: s2.y, el: 0, d: 200 });
        });
      }, 0.5);
    }
    { // Twin Hatchets (±10°) and Seeking Return
      const c = cell(3), h = player(13, 'warrior', 'Sigrun', c.x - 220, c.y + 30);
      const bleeding = mob('thornling', c.x - 40, c.y + 150);
      mob('bonewalker', c.x + 30, c.y - 20); mob('gloomshroom', c.x - 30, c.y + 70);
      label('Twin Hatchets · Seeking Return', c.x, c.y + 200);
      every(2.6, () => {
        fire({ e: 'cast', s: h.id, sk: 'sawtooth_hatchet', r: 'twin_hatchets', x: h.x, y: h.y, tx: h.x + 300, ty: h.y });
        for (const o of [-1, 1]) fire({ e: 'aoe', v: 'hatchet', x: h.x, y: h.y, r: 300, d: 0, el: 0, s: h.id, a: o * 10 * Math.PI / 180 });
        later(300 / HS + 0.02, () => fire({ e: 'aoe', v: 'hatchet_seek', x: bleeding.x, y: bleeding.y, r: 1, d: 0, el: 0, s: h.id }));
      }, 0.7);
    }
    { // Grinning Saw (hatchet3): out, home, out again along the same line, home — Kiln-Heated (fire)
      const c = cell(4), h = player(14, 'warrior', 'Dagny', c.x - 200, c.y + 40);
      mob('ember_imp', c.x - 20, c.y + 40); mob('grave_bat', c.x + 90, c.y + 30);
      label('Grinning Saw (out · home · out · home) · Kiln-Heated', c.x, c.y + 130);
      every(3.2, () => {
        fire({ e: 'cast', s: h.id, sk: 'sawtooth_hatchet', r: 'kiln_heated', x: h.x, y: h.y, tx: h.x + 300, ty: h.y });
        fire({ e: 'aoe', v: 'hatchet3', x: h.x, y: h.y, r: 300, d: 0, el: 1, s: h.id, a: -0.12 });
      }, 0.2);
    }
    { // 360° Cleave (two opposite arcs) and Quakeline Rumble aftershocks
      const c = cell(5), h = player(15, 'warrior', 'Ivar', c.x, c.y + 30);
      const ring = [0, 1, 2, 3].map((k) => mob(['bonewalker', 'ember_imp', 'thornling', 'grave_bat'][k], c.x + Math.cos(k * 1.57 + 0.4) * 110, c.y + 30 + Math.sin(k * 1.57 + 0.4) * 80));
      label('Cleave 360° (opposite arcs) · Rumble aftershocks', c.x, c.y + 150);
      every(2.2, () => {
        fire({ e: 'cast', s: h.id, sk: 'cleave', x: h.x, y: h.y, tx: h.x + 120, ty: h.y, rad: 120 });
        fire({ e: 'aoe', v: 'cleave', x: h.x, y: h.y, r: 120, d: 220, el: 0, s: h.id, a: Math.PI });
        fire({ e: 'aoe', v: 'cleave', x: h.x, y: h.y, r: 120, d: 220, el: 0, s: h.id, a: 0 });
        for (const [k, m] of ring.entries()) later(0.35 + k * 0.12, () => fire({ e: 'aoe', v: 'aftershock', x: m.x, y: m.y, r: 40, d: 300, el: 0, s: h.id }));
      }, 0.4);
    }
  },

  // Warrior M1 grounds & channels: Muster Standard, Ironplough, Cairnfall, Outward Tremor, Gyre of Ash.
  warrior2() {
    camX = 0; camY = 0;
    const cell = (i: number) => ({ x: -540 + (i % 3) * 540, y: -190 + Math.floor(i / 3) * 420 });
    { // Muster Standard planted, Ember Pennant pulses once per second, then the standard comes down
      const c = cell(0), h = player(10, 'warrior', 'Brakka', c.x + 26, c.y + 70);
      label('Muster Standard · Ember Pennant pulses', c.x, c.y + 150);
      every(6.5, () => {
        const x = c.x, y = c.y + 60;
        fire({ e: 'cast', s: h.id, sk: 'muster_standard', r: 'ember_pennant', x, y, tx: x, ty: y, rad: 150 });
        fire({ e: 'aoe', v: 'standard', x, y, r: 150, d: 5600, el: 1, s: h.id });
        for (let k = 1; k <= 4; k++) later(k, () => fire({ e: 'aoe', v: 'standard_pulse', x, y, r: 150, d: 400, el: 1, s: h.id }));
        later(5, () => fire({ e: 'aoe', v: 'standard_end', x, y, r: 150, d: 0, el: 0, s: h.id }));
      }, 0.3);
    }
    { // Marching Orders: the standard is carried
      const c = cell(1), h = player(11, 'warrior', 'Hroth', c.x - 120, c.y + 60);
      label('Muster Standard · Marching Orders (carried)', c.x, c.y + 150);
      let dir = 1;
      stressTicks.push((dt) => {
        h.x += dir * 120 * dt;
        if (h.x > c.x + 130) dir = -1; else if (h.x < c.x - 130) dir = 1;
        h.vx = dir * 120; h.flags = F_MOVING;
      });
      every(6.5, () => fire({ e: 'aoe', v: 'standard_carry', x: h.x, y: h.y, r: 105, d: 6000, el: 0, s: h.id }), 0.2);
    }
    { // Ironplough: the ramp builds 0..5, Stone Spray every 0.5 s, Sod Burst every second
      const c = cell(2), h = player(12, 'warrior', 'Ulla', c.x - 210, c.y + 60);
      const pack = [mob('bonewalker', c.x - 60, c.y + 40), mob('ember_imp', c.x - 30, c.y + 100), mob('bog_slime', c.x - 10, c.y + 20)];
      label('Ironplough · ramp 0→5 · Stone Spray · Sod Burst', c.x, c.y + 150);
      let t = -1;
      every(4.2, () => {
        t = 0; h.x = c.x - 210;
        pack.forEach((m, k) => { m.x = c.x - 60 + k * 25; });
        fire({ e: 'cast', s: h.id, sk: 'ironplough', x: h.x, y: h.y, tx: h.x, ty: h.y, rad: 150 });
      }, 0.2);
      let tick = 0, stone = 0, sod = 0;
      stressTicks.push((dt) => {
        if (t < 0) return;
        t += dt;
        if (t > 3.2) { t = -1; h.flags = 0; h.vx = 0; return; }
        h.flags = F_CHANNEL | F_MOVING; h.vx = 72; h.x += 72 * dt;
        if ((tick -= dt) <= 0) {
          tick += 0.25;
          const lv = Math.min(5, Math.floor(t / 0.5));
          fire({ e: 'aoe', v: 'plough', x: h.x, y: h.y, r: 150, d: lv, el: 0, s: h.id, a: 0 });
          for (const m of pack) if (m.x - h.x < 150 && m.x > h.x) m.x += 20;
        }
        if ((stone -= dt) <= 0) {
          stone += 0.5;
          for (const o of [-14, 0, 14]) { const a = (o * Math.PI) / 180; proj('stone', h.x + 20, h.y - 6, h.x + 20 + Math.cos(a) * 300, h.y - 6 + Math.sin(a) * 300, 700, 0, h.id, undefined, false); }
        }
        if ((sod -= dt) <= 0) { sod += 1; fire({ e: 'aoe', v: 'sod', x: h.x + 128, y: h.y, r: 60, d: 380, el: 0, s: h.id }); }
      });
    }
    { // Cairnfall: five telegraphed cairns land in a ring 0.25 s apart; Waymarker keeps them 6 s and pulses
      const c = cell(3), h = player(13, 'warrior', 'Sigrun', c.x, c.y + 40);
      const ring = [0, 1, 2, 3, 4].map((k) => ({ x: c.x + Math.cos(k * 1.2566 - 1.2) * 125, y: c.y + 40 + Math.sin(k * 1.2566 - 1.2) * 125 }));
      for (const p of ring.slice(0, 3)) mob(pickOne(['bonewalker', 'ember_imp', 'gloomshroom']), p.x + 14, p.y + 8);
      label('Cairnfall · Waymarker pulses', c.x, c.y + 200);
      every(7.5, () => {
        fire({ e: 'cast', s: h.id, sk: 'cairnfall', x: h.x, y: h.y, tx: h.x, ty: h.y, rad: 70 });
        ring.forEach((p, k) => {
          const delay = 250 * (k + 1);
          fire({ e: 'tele', v: 'cairn', x: p.x, y: p.y, r: 70, d: delay, s: h.id });
          later(delay / 1000, () => fire({ e: 'aoe', v: 'cairn', x: p.x, y: p.y, r: 70, d: 6000, el: 0, s: h.id }));
          for (let j = 1; j <= 2; j++) later(delay / 1000 + j * 2, () => fire({ e: 'aoe', v: 'cairn_pulse', x: p.x, y: p.y, r: 50, d: 400, el: 0, s: h.id }));
        });
      }, 0.3);
    }
    { // Ground Stomp + Outward Tremor ring wave
      const c = cell(4), h = player(14, 'warrior', 'Dagny', c.x, c.y + 40);
      label('Ground Stomp · Outward Tremor', c.x, c.y + 200);
      every(2.6, () => {
        fire({ e: 'cast', s: h.id, sk: 'ground_stomp', r: 'outward_tremor', x: h.x, y: h.y, tx: h.x, ty: h.y, rad: 120 });
        later(0.26, () => {
          fire({ e: 'aoe', v: 'tremor_ring', x: h.x, y: h.y, r: 220, d: 420, el: 0, s: h.id });
          fire({ e: 'aoe', v: 'stomp', x: h.x, y: h.y, r: 110, d: 500, el: 0, s: h.id });
        });
      }, 0.6);
    }
    { // Whirlwind · Gyre of Ash: a hero spinning along a loop leaves burning embers (one patch per 40 units)
      const c = cell(5), h = player(15, 'warrior', 'Ivar', c.x + 90, c.y + 40);
      label('Whirlwind · Gyre of Ash ember trail', c.x, c.y + 200);
      fire({ e: 'cast', s: h.id, sk: 'whirlwind', x: h.x, y: h.y, tx: h.x, ty: h.y, rad: 100 });
      let a = 0, tick = 0, lastX = h.x, lastY = h.y;
      stressTicks.push((dt) => {
        a += dt * 1.3;
        const nx = c.x + Math.cos(a) * 110, ny = c.y + 40 + Math.sin(a) * 70;
        h.vx = (nx - h.x) / Math.max(dt, 1e-3); h.vy = (ny - h.y) / Math.max(dt, 1e-3);
        h.x = nx; h.y = ny; h.flags = F_CHANNEL | F_MOVING;
        if ((tick -= dt) <= 0) {
          tick += 0.25;
          fire({ e: 'aoe', v: 'whirl', x: h.x, y: h.y, r: 100, d: 260, el: 0, s: h.id });
          if (Math.hypot(h.x - lastX, h.y - lastY) >= 40) { lastX = h.x; lastY = h.y; fire({ e: 'aoe', v: 'ember_trail', x: h.x, y: h.y, r: 45, d: 2000, el: 1, s: h.id }); }
        }
      });
    }
  },

  // Warrior wave 2: Kilnheart (stoked aura, Cold Forge, Bellows Breath), Hearthbanner shock, the data grounds
  // (server/src/sim/groundFx.ts placeGround: x, y = line start, a = angle, r = half-width, d = lifetime).
  warrior3() {
    camX = 0; camY = 0;
    const cell = (i: number) => ({ x: -660 + (i % 4) * 440, y: -190 + Math.floor(i / 4) * 420 });
    const walker = (h: Ent, c: { x: number }, speed: number) => {
      let dir = 1;
      stressTicks.push((dt) => {
        h.x += dir * speed * dt;
        if (h.x > c.x + 110) dir = -1; else if (h.x < c.x - 110) dir = 1;
        h.vx = dir * speed; h.flags = F_MOVING;
      });
    };
    [0, 1].forEach((i) => { // Kilnheart: chest glow, heat haze, scorched (frosted) footprints while it burns
      const c = cell(i), cold = i === 1, h = player(10 + i, 'warrior', cold ? 'Hroth' : 'Brakka', c.x - 100, c.y + 60);
      label(cold ? 'Kilnheart · Cold Forge' : 'Kilnheart · stoked (glow, haze, footprints)', c.x, c.y + 150);
      walker(h, c, 90);
      every(21, () => fire({ e: 'cast', s: h.id, sk: 'kilnheart', r: cold ? 'cold_forge' : undefined, x: h.x, y: h.y, tx: h.x, ty: h.y }), 0.3 + i * 0.2);
    });
    [2, 3].forEach((i) => { // Bellows Breath: a 90° exhale of fire (and the cold variant)
      const c = cell(i), cold = i === 3, h = player(10 + i, 'warrior', cold ? 'Sigrun' : 'Ulla', c.x - 150, c.y + 60);
      mob('bonewalker', c.x + 20, c.y + 30); mob('ember_imp', c.x + 70, c.y + 110); mob('grave_bat', c.x + 40, c.y - 20);
      label(cold ? 'Bellows Breath · Cold Forge' : 'Bellows Breath', c.x, c.y + 150);
      every(2.8, () => {
        fire({ e: 'cast', s: h.id, sk: 'kilnheart', r: cold ? 'cold_forge' : 'bellows_breath', x: h.x, y: h.y, tx: h.x + 200, ty: h.y });
        fire({ e: 'aoe', v: 'kiln_breath', x: h.x, y: h.y, r: 250, d: 520, el: cold ? 2 : 1, s: h.id, a: 0.05 });
      }, 0.4 + (i - 2) * 0.3);
    });
    { // Hearthbanner: banner-gold shockwave
      const c = cell(4), h = player(14, 'warrior', 'Dagny', c.x, c.y + 40);
      label('Hearthbanner · hearth shock', c.x, c.y + 190);
      every(1.8, () => fire({ e: 'aoe', v: 'hearth_shock', x: h.x, y: h.y, r: 140, d: 420, el: 0, s: h.id }), 0.3);
    }
    { // Quakeline · Open Crack: the fissure leaves a glowing crack along its line
      const c = cell(5), h = player(15, 'warrior', 'Ivar', c.x - 180, c.y + 40);
      label('Quakeline · Open Crack (quake_crack)', c.x, c.y + 190);
      every(3, () => {
        fire({ e: 'cast', s: h.id, sk: 'seismic_slam', x: h.x, y: h.y, tx: h.x + 300, ty: h.y, rad: 300 });
        fire({ e: 'aoe', v: 'fissure', x: h.x, y: h.y, r: 300, d: 650, el: 0, s: h.id, a: 0 });
        later(0.1, () => fire({ e: 'aoe', v: 'quake_crack', x: h.x + 20, y: h.y, r: 26, d: 2000, el: 0, s: h.id, a: 0 }));
      }, 0.3);
    }
    { // Deep Earth tremor ground (slowing field)
      const c = cell(6);
      player(16, 'warrior', 'Asta', c.x - 150, c.y + 40);
      mob('bog_slime', c.x - 20, c.y + 30); mob('thornling', c.x + 40, c.y + 80);
      label('Deep Earth · tremor ground', c.x, c.y + 190);
      every(2.6, () => fire({ e: 'aoe', v: 'tremor', x: c.x + 10, y: c.y + 50, r: 120, d: 2000, el: 0, s: 16 }), 0.3);
    }
    { // Fault Warden fault line and Furrowmark furrow (line grounds, 3 s)
      const c = cell(7);
      player(17, 'warrior', 'Orm', c.x - 150, c.y + 80);
      label('Fault line (top) · Furrow (bottom)', c.x, c.y + 190);
      every(3.4, () => {
        fire({ e: 'aoe', v: 'fault_line', x: c.x - 80, y: c.y - 10, r: 20, d: 3000, el: 0, s: 17, a: 0 });
        fire({ e: 'aoe', v: 'furrow', x: c.x - 80, y: c.y + 100, r: 22, d: 3000, el: 0, s: 17, a: 0 });
      }, 0.3);
    }
  },

  // Ranger M1 shots & marks (server contract: the ranger wave; docs/rework/depth/RANGER.md §3–§4), real hero rig.
  ranger() {
    camX = 0; camY = 0;
    const cell = (i: number) => ({ x: -540 + (i % 3) * 540, y: -190 + Math.floor(i / 3) * 420 });
    { // Skipstone Bolt: sidearm flick, the slate skips twice; every skip point ripples
      const c = cell(0), h = player(10, 'ranger', 'Sylwen', c.x - 210, c.y + 40);
      const ms = [mob('bonewalker', c.x - 40, c.y + 10), mob('ember_imp', c.x + 70, c.y + 110), mob('grave_bat', c.x + 170, c.y - 10)];
      label('Skipstone Bolt · skips + ripples', c.x, c.y + 150);
      every(1.6, () => { fire({ e: 'cast', s: h.id, sk: 'skipstone_bolt', x: h.x, y: h.y, tx: ms[0].x, ty: ms[0].y }); skipChain('skip', h, ms, 0); }, 0.3);
    }
    { // Ripple rune (cold): a cold burst at every skip point, the last one a chilling ripple ring
      const c = cell(1), h = player(11, 'ranger', 'Rowan', c.x - 210, c.y + 40);
      const ms = [mob('bog_slime', c.x - 40, c.y + 60), mob('thornling', c.x + 60, c.y - 20), mob('gloomshroom', c.x + 170, c.y + 90)];
      label('Skipstone · Ripple (cold)', c.x, c.y + 150);
      every(2, () => {
        fire({ e: 'cast', s: h.id, sk: 'skipstone_bolt', r: 'ripple', x: h.x, y: h.y, tx: ms[0].x, ty: ms[0].y });
        skipChain('skip', h, ms, 2, (m, k) => fire({ e: 'aoe', v: k === ms.length - 1 ? 'skim_ripple' : 'skip_ripple', x: m.x, y: m.y, r: k === ms.length - 1 ? 40 : 50, d: 1000, el: 2, s: h.id }));
      }, 0.5);
    }
    { // Heavy Stone (knockback, no skips) and Fen Lightning (lightning skips), alternating
      const c = cell(2), h = player(12, 'ranger', 'Ash', c.x - 210, c.y + 40);
      const heavy = mob('magma_brute', c.x + 10, c.y + 40, 1, [], 'Cinderhide');
      const ms = [mob('ember_imp', c.x + 90, c.y - 40), mob('bonewalker', c.x + 170, c.y + 70)];
      label('Heavy Stone · Fen Lightning', c.x, c.y + 150);
      let k = 0;
      every(1.8, () => {
        if (k++ % 2 === 0) {
          heavy.x = c.x + 10;
          fire({ e: 'cast', s: h.id, sk: 'skipstone_bolt', r: 'heavy_stone', x: h.x, y: h.y, tx: heavy.x, ty: heavy.y });
          const d = Math.hypot(heavy.x - h.x, heavy.y - h.y);
          proj('skip_heavy', h.x + 16, h.y - 2, heavy.x, heavy.y, 900, 0, h.id);
          later(d / 900, () => { fire({ e: 'dmg', t: heavy.id, a: 4200, el: 0, s: h.id }); const x0 = heavy.x; stressTicks.push(knock(heavy, x0, 60)); });
        } else {
          fire({ e: 'cast', s: h.id, sk: 'skipstone_bolt', r: 'fen_lightning', x: h.x, y: h.y, tx: heavy.x, ty: heavy.y });
          skipChain('skip', h, [heavy, ...ms], 3);
        }
      }, 0.4);
    }
    { // Quarry Mark: point and whistle, the sigil hovers over the elite; the sentry's bolts at it leave a pale trail
      const c = cell(3), h = player(13, 'ranger', 'Wren', c.x - 220, c.y + 50);
      const elite = mob('mossback', c.x + 120, c.y + 30, 2, ['frozen'], 'Rotheart the Vile');
      mob('bonewalker', c.x + 30, c.y + 110); mob('ember_imp', c.x + 200, c.y + 120);
      const sentry = summon('sentry', c.x - 120, c.y - 40);
      label('Quarry Mark · sigil · summons hunt it (pale trail)', c.x, c.y + 190);
      every(6, () => {
        fire({ e: 'cast', s: h.id, sk: 'quarry_mark', x: h.x, y: h.y, tx: elite.x, ty: elite.y });
        fire({ e: 'aoe', v: 'quarry_mark', x: elite.x, y: elite.y, r: 24, d: 5200, el: 0, s: elite.id, f: 1 });
      }, 0.3);
      every(0.55, () => { sentry.aseq = (sentry.aseq ?? 0) + 1; proj('bolt', sentry.x + 8, sentry.y - 24, elite.x, elite.y, 1000, 0, sentry.id, elite.id); }, 0.9);
    }
    { // Falcon Strike: a falcon stoops on the quarry; when it dies the mark jumps (pale streak + chime)
      const c = cell(4), h = player(14, 'ranger', 'Kestrel', c.x - 220, c.y + 50);
      const next = mob('magma_brute', c.x + 160, c.y + 90, 1, [], 'Grimfang');
      mob('grave_bat', c.x + 60, c.y - 30);
      label('Falcon Strike · mark jumps on death', c.x, c.y + 190);
      every(4.4, () => {
        const q = mob('bonewalker', c.x + 20, c.y + 40);
        fire({ e: 'cast', s: h.id, sk: 'quarry_mark', r: 'falcon_strike', x: h.x, y: h.y, tx: q.x, ty: q.y });
        fire({ e: 'aoe', v: 'quarry_mark', x: q.x, y: q.y, r: 18, d: 12000, el: 0, s: q.id, f: 1 });
        fire({ e: 'aoe', v: 'falcon_dive', x: q.x, y: q.y, r: 60, d: 0, el: 0, s: h.id, delay: 260 });
        later(0.27, () => fire({ e: 'dmg', t: q.id, a: 18400, c: 1, el: 0, s: h.id }));
        later(1.7, () => {
          killEnt(q, 0);
          fire({ e: 'beam', v: 'quarry_jump', x: q.x, y: q.y, tx: next.x, ty: next.y, el: 0, d: 400 });
          later(0.3, () => fire({ e: 'aoe', v: 'quarry_mark', x: next.x, y: next.y, r: 22, d: 2200, el: 0, s: next.id, f: 1 }));
        });
      }, 0.3);
    }
    { // Tracking Arrow · Fletchling Swarm darts; Farwatch's long shaft; stone splinters off an impact
      const c = cell(5), h = player(15, 'ranger', 'Lark', c.x - 230, c.y + 10);
      const t0 = mob('thornling', c.x - 20, c.y + 10), t1 = mob('ember_imp', c.x + 80, c.y - 70), t2 = mob('bog_slime', c.x + 100, c.y + 80);
      label('Fletchling darts · Farwatch shaft · splinters', c.x, c.y + 190);
      every(2.2, () => {
        fire({ e: 'cast', s: h.id, sk: 'hungering_arrow', r: 'fletchling_swarm', x: h.x, y: h.y, tx: t0.x, ty: t0.y });
        const d = Math.hypot(t0.x - h.x, t0.y - h.y);
        proj('arrow', h.x + 16, h.y - 2, t0.x, t0.y, 900, 0, h.id);
        later(d / 900, () => { for (const t of [t1, t2]) proj('dart', t0.x, t0.y - 6, t.x, t.y, 520, 0, h.id, t.id); });
        later(1.1, () => {
          fire({ e: 'cast', s: h.id, sk: 'hungering_arrow', x: h.x, y: h.y + 130, tx: h.x + 400, ty: h.y + 130 });
          proj('farwatch', h.x + 10, h.y + 128, h.x + 560, h.y + 128, 1400, 0, h.id, undefined, false);
          for (let k = 0; k < 4; k++) { const a = -0.6 + k * 0.4; proj('splinter', t2.x, t2.y - 8, t2.x + Math.cos(a) * 130, t2.y + Math.sin(a) * 90, 520, 0, h.id, undefined, false); }
        });
      }, 0.5);
    }
  },

  // Ranger M1 devices: Spring Snare (set, arm, snap, chain, tripwire, shrapnel, thorns, fire), Pitch Mortar, Flame Lance.
  ranger2() {
    camX = 0; camY = 0;
    const cell = (i: number) => ({ x: -540 + (i % 3) * 540, y: -190 + Math.floor(i / 3) * 420 });
    { // Spring Snare: kneel and set, the arming click, an enemy steps on it: snap, dust, rope whip, jaws hold 1.5 s
      const c = cell(0), h = player(10, 'ranger', 'Sylwen', c.x - 200, c.y + 40);
      const m = mob('bonewalker', c.x + 200, c.y + 40);
      label('Spring Snare · set · arm · snap', c.x, c.y + 150);
      let sn: Ent | null = null, walking = false;
      const sx = c.x + 10, sy = c.y + 40;
      every(4.8, () => {
        m.x = c.x + 200; m.flags = 0; walking = false;
        fire({ e: 'cast', s: h.id, sk: 'spring_snare', x: h.x, y: h.y, tx: sx, ty: sy });
        later(0.2, () => { sn = summon('snare', sx, sy, 12); });
        later(0.8, () => { if (sn) fire({ e: 'aoe', v: 'snare_arm', x: sx, y: sy, r: 12, d: 0, el: 0, s: sn.id }); });
        later(1.2, () => { walking = true; });
      }, 0.3);
      stressTicks.push((dt) => {
        if (!walking) return;
        m.x -= 90 * dt; m.vx = -90; m.flags = F_MOVING;
        if (m.x > sx + 28) return;
        walking = false; m.vx = 0; m.flags = F_STUN;
        if (sn) { sn.aseq = (sn.aseq ?? 0) + 1; fire({ e: 'aoe', v: 'snare_snap', x: sn.x, y: sn.y, r: 90, d: 0, el: 0, s: sn.id }); const id = sn.id; later(0.06, () => removeEnt(id)); sn = null; }
        fire({ e: 'dmg', t: m.id, a: 6400, el: 0, s: h.id });
        later(1.5, () => { m.flags = 0; });
      });
    }
    { // Chain Snare + Tripwire: a taut wire between two snares; the snap tethers two enemies and drags them in
      const c = cell(1), h = player(11, 'ranger', 'Rowan', c.x - 230, c.y + 80);
      const a = summon('snare', c.x - 70, c.y + 50, 12), b = summon('snare', c.x + 90, c.y + 50, 12);
      const v = mob('thornling', c.x - 64, c.y + 46), o1 = mob('ember_imp', c.x + 30, c.y - 50), o2 = mob('bog_slime', c.x - 150, c.y - 30);
      label('Chain Snare tether · Tripwire wire · pull', c.x, c.y + 150);
      void h;
      every(4.2, () => {
        o1.x = c.x + 30; o1.y = c.y - 50; o2.x = c.x - 150; o2.y = c.y - 30;
        fire({ e: 'beam', v: 'snare_wire', x: a.x, y: a.y, tx: b.x, ty: b.y, el: 0, d: 1500 });
        later(1.6, () => {
          a.aseq = (a.aseq ?? 0) + 1;
          fire({ e: 'aoe', v: 'snare_snap', x: a.x, y: a.y, r: 90, d: 0, el: 0, s: a.id });
          for (const o of [o1, o2]) {
            fire({ e: 'beam', v: 'snare_tether', x: v.x, y: v.y, tx: o.x, ty: o.y, el: 0, d: 420 });
            const x0 = o.x, y0 = o.y, L = Math.hypot(v.x - x0, v.y - y0);
            stressTicks.push(slide(o, x0, y0, x0 + ((v.x - x0) / L) * 60, y0 + ((v.y - y0) / L) * 60, 0.12, 0.42));
          }
          later(0.42, () => fire({ e: 'aoe', v: 'trap_pull', x: v.x, y: v.y, r: 110, d: 0, el: 0, s: h.id }));
        });
      }, 0.3);
    }
    { // Shrapnel Jaw (cone behind the victim), Bramble Spring thorns, Pitch-Soaked: a burning snap and burning ground
      const c = cell(2), h = player(12, 'ranger', 'Ash', c.x - 230, c.y + 40);
      const sa = summon('snare', c.x - 80, c.y + 40, 12), sb = summon('snare', c.x + 110, c.y + 40, 12);
      const v1 = mob('bonewalker', c.x - 76, c.y + 36), v2 = mob('gloomshroom', c.x + 114, c.y + 36);
      label('Shrapnel cone · Bramble thorns · Pitch-Soaked fire', c.x, c.y + 150);
      void h;
      every(3.4, () => {
        sa.aseq = (sa.aseq ?? 0) + 1;
        fire({ e: 'aoe', v: 'snare_snap', x: sa.x, y: sa.y, r: 90, d: 0, el: 0, s: sa.id });
        fire({ e: 'aoe', v: 'snare_cone', x: v1.x, y: v1.y, r: 150, d: 0, el: 0, s: h.id, a: -0.35 });
        for (let k = 0; k < 4; k++) { const ang = k * (Math.PI / 2) + 0.5; proj('thorn', sa.x, sa.y - 4, sa.x + Math.cos(ang) * 120, sa.y + Math.sin(ang) * 80, 520, 0, h.id, undefined, false); }
        later(1.2, () => {
          sb.aseq = (sb.aseq ?? 0) + 1;
          fire({ e: 'aoe', v: 'snare_snap', x: sb.x, y: sb.y, r: 90, d: 0, el: 1, s: sb.id });
          fire({ e: 'aoe', v: 'snare_fire', x: v2.x, y: v2.y + 4, r: 70, d: 2000, el: 1, s: h.id });
        });
      }, 0.3);
    }
    { // Pitch Mortar: thoomp and smoke, an arcing pitch pot with a burning wick, a tar splash that catches; burning pitch
      const c = cell(3), h = player(13, 'ranger', 'Wren', c.x - 240, c.y + 90);
      const mo = summon('mortar', c.x - 170, c.y + 40, 16);
      const pack = [mob('bonewalker', c.x + 100, c.y + 20), mob('ember_imp', c.x + 150, c.y + 70), mob('grave_bat', c.x + 70, c.y + 80)];
      label('Pitch Mortar · shot · tar fire · burning pitch', c.x, c.y + 190);
      fire({ e: 'cast', s: h.id, sk: 'pitch_mortar', x: h.x, y: h.y, tx: mo.x, ty: mo.y });
      every(2.2, () => {
        const tx = c.x + 110, ty = c.y + 55;
        mo.aseq = (mo.aseq ?? 0) + 1;
        fire({ e: 'aoe', v: 'mortar_shot', x: tx, y: ty, r: 100, d: 450, el: 1, s: mo.id });
        later(0.45, () => {
          fire({ e: 'aoe', v: 'mortar_impact', x: tx, y: ty, r: 100, d: 0, el: 1, s: mo.id });
          fire({ e: 'aoe', v: 'pitch', x: tx, y: ty, r: 85, d: 3000, el: 1, s: mo.id });
          for (const p of pack) fire({ e: 'dmg', t: p.id, a: Math.round(rnd(2400, 3600)), el: 1, s: mo.id });
        });
      }, 0.6);
    }
    { // Grapeshot (5 pellets instead of pitch) and Frostpot (cold: a frost burst), alternating
      const c = cell(4), mo = summon('mortar', c.x - 170, c.y + 40, 16);
      mob('thornling', c.x + 100, c.y + 30); mob('bog_slime', c.x + 160, c.y + 90);
      label('Mortar · Grapeshot pellets · Frostpot', c.x, c.y + 190);
      let k = 0;
      every(1.9, () => {
        const cold = k++ % 2 === 1, tx = c.x + 120, ty = c.y + 55;
        mo.aseq = (mo.aseq ?? 0) + 1;
        fire({ e: 'aoe', v: 'mortar_shot', x: tx, y: ty, r: 80, d: 450, el: cold ? 2 : 1, s: mo.id });
        later(0.45, () => {
          fire({ e: 'aoe', v: 'mortar_impact', x: tx, y: ty, r: cold ? 100 : 60, d: 0, el: cold ? 2 : 1, s: mo.id });
          if (!cold) for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3; proj('pellet', tx, ty - 6, tx + Math.cos(a) * 110, ty + Math.sin(a) * 70, 600, 1, mo.id, undefined, true); }
        });
      }, 0.5);
    }
    { // Sentry · Flame Lance jets; Burst Arrow · Barrel Bomb's rolling blasts; Powder Horn's burning powder patch
      const c = cell(5), se = summon('sentry', c.x - 170, c.y + 10);
      const ms = [mob('ember_imp', c.x - 40, c.y - 10), mob('bonewalker', c.x - 20, c.y + 50)];
      label('Flame Lance · Barrel Bomb · powder patch', c.x, c.y + 190);
      every(1.1, () => {
        const t = pickOne(ms), a = Math.atan2(t.y - se.y, t.x - se.x);
        se.aseq = (se.aseq ?? 0) + 1;
        fire({ e: 'aoe', v: 'sentry_flame', x: se.x, y: se.y, r: 150, d: 300, el: 1, s: se.id, a });
      }, 0.3);
      every(3.2, () => {
        for (let k = 0; k < 3; k++) later(0.18 * k, () => fire({ e: 'aoe', v: 'barrel_blast', x: c.x - 60 + k * 70, y: c.y + 120, r: 45, d: 0, el: 1, s: ME }));
        later(0.56, () => { fire({ e: 'aoe', v: 'cluster', x: c.x + 160, y: c.y + 120, r: 80, d: 0, el: 1, s: ME }); fire({ e: 'aoe', v: 'powder_patch', x: c.x + 160, y: c.y + 120, r: 60, d: 2200, el: 1, s: ME }); });
      }, 0.8);
    }
  },

  // Ranger M1 skyfall & beasts: Overcast Volley (cloud, arrows, Thunder Peal, Storm Shelf), Kestrel Column, the Rainkeeper
  // storm with Flood Plain's wet ground, Badger Sett and Heron companions.
  ranger3() {
    camX = 0; camY = 0;
    const cell = (i: number) => ({ x: -540 + (i % 3) * 540, y: -150 + Math.floor(i / 3) * 440 });
    const volley = (h: Ent, x: number, y: number, el: number, rune?: string, heavy = false) => {
      fire({ e: 'cast', s: h.id, sk: 'overcast_volley', r: rune, x: h.x, y: h.y, tx: x, ty: y });
      fire({ e: 'aoe', v: 'overcast_cloud', x, y, r: 140, d: el === 3 ? 2000 : 1300, el, s: h.id });
      for (let k = 0; k < 8; k++) {
        const a = rnd(0, 6.283), d = Math.sqrt(Math.random()) * 130;
        fire({ e: 'aoe', v: 'overcast_arrow', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, r: 35, d: 0, el, s: h.id, delay: 350 + k * 150 });
      }
      if (heavy) fire({ e: 'aoe', v: 'overcast_heavy', x, y, r: 70, d: 0, el, s: h.id, delay: 350 + 8 * 150 });
    };
    { // Overcast Volley: loosed upward, a grey cloud puffs over the area, arrows fall over 1.2 s; Thunder Peal finale
      const c = cell(0), h = player(10, 'ranger', 'Sylwen', c.x - 220, c.y + 80);
      mob('bonewalker', c.x + 40, c.y + 50); mob('ember_imp', c.x + 100, c.y + 100); mob('grave_bat', c.x + 70, c.y);
      label('Overcast Volley · Thunder Peal', c.x, c.y + 190);
      every(3.4, () => volley(h, c.x + 70, c.y + 60, 0, undefined, true), 0.3);
    }
    { // Storm Shelf: lightning; the cloud lingers and strikes enemies with bolts
      const c = cell(1), h = player(11, 'ranger', 'Rowan', c.x - 220, c.y + 80);
      const ms = [mob('thornling', c.x + 40, c.y + 40), mob('bog_slime', c.x + 120, c.y + 100), mob('gloomshroom', c.x + 90, c.y - 10)];
      label('Overcast · Storm Shelf (lightning)', c.x, c.y + 190);
      every(3.6, () => {
        volley(h, c.x + 70, c.y + 60, 3, 'storm_shelf');
        for (const [k, at] of [[0, 1.0], [2, 1.6]] as const) later(at, () => fire({ e: 'beam', v: 'volley_bolt', x: c.x + 70, y: c.y + 60, tx: ms[k].x, ty: ms[k].y, el: 3, d: 220 }));
      }, 0.6);
    }
    { // Arrowfall · Kestrel Column: a narrow column of diving kestrels
      const c = cell(2), h = player(12, 'ranger', 'Ash', c.x - 220, c.y + 80);
      mob('magma_brute', c.x + 60, c.y + 50, 1, [], 'Cinderhide');
      label('Arrowfall · Kestrel Column', c.x, c.y + 190);
      every(3.4, () => {
        fire({ e: 'cast', s: h.id, sk: 'rain_of_vengeance', r: 'kestrel_column', x: h.x, y: h.y, tx: c.x + 60, ty: c.y + 50 });
        fire({ e: 'aoe', v: 'kestrel_column', x: c.x + 60, y: c.y + 50, r: 110, d: 2500, el: 0, s: h.id });
      }, 0.3);
    }
    { // Rainkeeper: the storm follows its hero; Flood Plain leaves wet, chilling ground
      const c = cell(3), h = player(13, 'ranger', 'Wren', c.x - 100, c.y + 60);
      label('Rainkeeper storm (follows) · Flood Plain wet ground', c.x, c.y + 190);
      let dir = 1;
      stressTicks.push((dt) => { h.x += dir * 70 * dt; if (h.x > c.x + 110) dir = -1; else if (h.x < c.x - 110) dir = 1; h.vx = dir * 70; h.flags = F_MOVING; });
      every(6, () => fire({ e: 'aoe', v: 'rain_storm', x: h.x, y: h.y, r: 150, d: 5800, el: 0, s: h.id, f: 1 }), 0.2);
      every(3.2, () => fire({ e: 'aoe', v: 'wet', x: c.x + 20, y: c.y + 100, r: 130, d: 3000, el: 2, s: h.id }), 0.4);
    }
    { // Badger Sett: the badger burrows (a travelling mound), then bursts up under an enemy
      const c = cell(4), h = player(14, 'ranger', 'Kestrel', c.x - 230, c.y + 40);
      const bd = summon('badger', c.x - 150, c.y + 90, 14);
      const m = mob('bonewalker', c.x + 100, c.y + 60);
      label('Companion · Badger Sett (burrow · burst)', c.x, c.y + 190);
      void h;
      let t = 0;
      const x0 = c.x - 150;
      stressTicks.push((dt) => {
        t = (t + dt) % 3.4;
        if (t < 1.6) { bd.x = x0 + (t / 1.6) * 230; bd.vx = 230 / 1.6; bd.flags = F_MOVING; }
        else if (t < 2.4) { bd.x = x0 + 230; bd.vx = 0; bd.flags = 0; }
        else { bd.x = x0 + 230 - ((t - 2.4) / 1.0) * 230; bd.vx = -230; bd.flags = F_MOVING; }
      });
      every(3.4, () => {
        bd.aseq = (bd.aseq ?? 0) + 1;
        fire({ e: 'aoe', v: 'badger_burst', x: m.x - 10, y: m.y + 4, r: 70, d: 0, el: 0, s: bd.id });
        fire({ e: 'dmg', t: m.id, a: 2400, el: 0, s: bd.id });
        m.flags = F_STUN; later(0.75, () => { m.flags = 0; });
      }, 1.75);
    }
    { // Heron: a wading bird that spears from range; its strikes chill
      const c = cell(5), h = player(15, 'ranger', 'Lark', c.x - 230, c.y + 40);
      const hr = summon('heron', c.x - 120, c.y + 70, 14);
      const ms = [mob('ember_imp', c.x + 80, c.y + 30), mob('thornling', c.x + 60, c.y + 120)];
      label('Companion · Heron (spear, chill)', c.x, c.y + 190);
      void h;
      every(1.3, () => {
        const t = pickOne(ms);
        hr.aseq = (hr.aseq ?? 0) + 1;
        later(0.15, () => { fire({ e: 'beam', v: 'heron_spear', x: hr.x + 20, y: hr.y, tx: t.x, ty: t.y, el: 2, d: 160 }); fire({ e: 'dmg', t: t.id, a: 1800, el: 2, s: hr.id }); });
      }, 0.4);
    }
  },

  // Ranger M1 Murmuration (the flock sweeping between packs: stoops, Stormbirds arcs), Starling Shield, Split Flock and
  // the six new cast poses.
  ranger4() {
    camX = 0; camY = 0;
    const h = player(10, 'ranger', 'Sylwen', -700, -40);
    const packs = [{ x: -420, y: -160 }, { x: -120, y: -40 }, { x: -380, y: 90 }];
    const mobs: Ent[] = [];
    for (const p of packs) for (let k = 0; k < 4; k++) mobs.push(mob(pickOne(['bonewalker', 'ember_imp', 'grave_bat', 'bog_slime']), p.x + rnd(-70, 70), p.y + rnd(-40, 40)));
    const fl = summon('flock', packs[0].x, packs[0].y, 120);
    label('Murmuration · sweeps between packs · stoop · Stormbirds arcs', -300, 210, 15);
    fire({ e: 'cast', s: h.id, sk: 'murmuration', x: h.x, y: h.y, tx: packs[0].x, ty: packs[0].y });
    let t = 0;
    stressTicks.push((dt) => {
      t += dt;
      const seg = Math.floor(t / 2.4) % 3, f = (t % 2.4) / 2.4, e = f * f * (3 - 2 * f);
      const a = packs[seg], b = packs[(seg + 1) % 3];
      const nx = a.x + (b.x - a.x) * e, ny = a.y + (b.y - a.y) * e;
      fl.vx = (nx - fl.x) / Math.max(dt, 1e-3); fl.vy = (ny - fl.y) / Math.max(dt, 1e-3); fl.x = nx; fl.y = ny; fl.flags = F_MOVING;
    });
    every(2, () => { const m = mobs.filter((q) => Math.hypot(q.x - fl.x, q.y - fl.y) < 130); const tg = m.length ? pickOne(m) : null; if (tg) { fire({ e: 'aoe', v: 'flock_stoop', x: tg.x, y: tg.y, r: 40, d: 0, el: 3, s: h.id }); fire({ e: 'dmg', t: tg.id, a: 3100, el: 3, s: h.id }); } }, 1);
    every(1, () => { const out = mobs.filter((q) => Math.hypot(q.x - fl.x, q.y - fl.y) > 140); for (let k = 0; k < Math.min(2, out.length); k++) { const tg = pickOne(out); fire({ e: 'beam', v: 'flock_arc', x: fl.x, y: fl.y, tx: tg.x, ty: tg.y, el: 3, d: 200 }); } }, 1.5);
    { // Starling Shield: a ring of starlings circling a walking hero
      const g = player(11, 'ranger', 'Rowan', 330, -120);
      const ring = summon('flock_guard', g.x, g.y, 60);
      label('Starling Shield (flock_guard)', 330, 0, 15);
      let dir = 1;
      stressTicks.push((dt) => { g.x += dir * 60 * dt; if (g.x > 430) dir = -1; else if (g.x < 230) dir = 1; g.vx = dir * 60; g.flags = F_MOVING; ring.x = g.x; ring.y = g.y; });
    }
    { // Split Flock: two smaller flocks (radius 84)
      const f1 = summon('flock', 560, -300, 84), f2 = summon('flock', 760, -230, 84);
      label('Split Flock (2 × r 84)', 660, -150, 15);
      let u = 0;
      stressTicks.push((dt) => { u += dt; f1.x = 600 + Math.cos(u * 0.6) * 90; f1.y = -290 + Math.sin(u * 0.9) * 30; f2.x = 760 + Math.cos(u * 0.7 + 2) * 80; f2.y = -240 + Math.sin(u * 0.8 + 1) * 30; });
    }
    // the six new cast poses
    const casts = ['skipstone_bolt', 'spring_snare', 'overcast_volley', 'quarry_mark', 'pitch_mortar', 'murmuration'];
    casts.forEach((sk, i) => {
      const x = -650 + i * 260, y = 330;
      const p = player(20 + i, 'ranger', '', x, y);
      label(sk, x, y + 20, 13);
      every(2, () => fire({ e: 'cast', s: p.id, sk, x, y, tx: x + 120, ty: y - (sk === 'overcast_volley' ? 60 : 0) }), 0.3);
    });
  },

  // Performance comparison (owner rule 2026-10-11: smooth on low-end PCs): one ranger fighting a respawning pack of 24 at
  // the same cadence. ?new=1 (default) uses the M1 kit (skips, snares, Overcast, Quarry Mark, Pitch Mortar, Murmuration
  // with Stormbirds, Starling Shield, the Rainkeeper storm, badger + heron); ?new=0 the pre-M1 kit (Tracking Arrow,
  // Multishot, Burst Arrow, Arrowfall, 2 Sentries, wolf). Measured with .local/scn/ranger-perf.mjs.
  rangerfight() {
    camX = -60; camY = 0;
    const NEW = qs.get('new') !== '0';
    const h = player(ME, 'ranger', 'Sylwen', -420, 40);
    const pack: Ent[] = [];
    const spawn = () => { const a = rnd(0, 6.28), d = rnd(60, 250); const m = mob(pickOne(['bonewalker', 'ember_imp', 'grave_bat', 'bog_slime', 'thornling']), 80 + Math.cos(a) * d * 1.2, 40 + Math.sin(a) * d * 0.8); pack.push(m); return m; };
    for (let i = 0; i < 24; i++) spawn();
    const elite = mob('magma_brute', 140, -60, 2, ['molten'], 'Cinderhide');
    const live = () => pack.filter((m) => !m.dying);
    const hit = (m: Ent, a: number, el = 0) => { fire({ e: 'dmg', t: m.id, a, el, s: ME }); m.hp -= 0.08; if (m.hp <= 0) { killEnt(m, el); } };
    every(1.5, () => { for (let i = pack.length - 1; i >= 0; i--) if (pack[i].dying) pack.splice(i, 1); while (pack.length < 24) spawn(); });
    if (NEW) {
      every(0.5, () => { const ms = live(); if (ms.length < 3) return; const c = [pickOne(ms), pickOne(ms), pickOne(ms)]; fire({ e: 'cast', s: ME, sk: 'skipstone_bolt', x: h.x, y: h.y, tx: c[0].x, ty: c[0].y }); skipChain('skip', h, c, 0); });
      every(3, () => {
        const t = pickOne(live()); if (!t) return;
        const sn = summon('snare', t.x - 20, t.y, 12);
        later(0.6, () => fire({ e: 'aoe', v: 'snare_arm', x: sn.x, y: sn.y, r: 12, d: 0, el: 0, s: sn.id }));
        later(1.4, () => { sn.aseq = 1; fire({ e: 'aoe', v: 'snare_snap', x: sn.x, y: sn.y, r: 90, d: 0, el: 1, s: sn.id }); fire({ e: 'aoe', v: 'snare_fire', x: sn.x, y: sn.y, r: 60, d: 2000, el: 1, s: ME }); later(0.06, () => removeEnt(sn.id)); hit(t, 6000); });
      }, 0.2);
      const mo = summon('mortar', -330, 120, 16);
      every(2, () => { const t = pickOne(live()); if (!t) return; mo.aseq = (mo.aseq ?? 0) + 1; fire({ e: 'aoe', v: 'mortar_shot', x: t.x, y: t.y, r: 100, d: 450, el: 1, s: mo.id }); later(0.45, () => { fire({ e: 'aoe', v: 'mortar_impact', x: t.x, y: t.y, r: 100, d: 0, el: 1, s: mo.id }); fire({ e: 'aoe', v: 'pitch', x: t.x, y: t.y, r: 85, d: 3000, el: 1, s: mo.id }); hit(t, 3000, 1); }); }, 0.4);
      every(2.5, () => { const t = pickOne(live()); if (!t) return; fire({ e: 'cast', s: ME, sk: 'overcast_volley', x: h.x, y: h.y, tx: t.x, ty: t.y }); fire({ e: 'aoe', v: 'overcast_cloud', x: t.x, y: t.y, r: 140, d: 1300, el: 0, s: ME }); for (let k = 0; k < 8; k++) { const a = rnd(0, 6.28), d = Math.sqrt(Math.random()) * 130; fire({ e: 'aoe', v: 'overcast_arrow', x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d * 0.7, r: 35, d: 0, el: 0, s: ME, delay: 350 + k * 150 }); } }, 0.9);
      every(6, () => { fire({ e: 'cast', s: ME, sk: 'quarry_mark', x: h.x, y: h.y, tx: elite.x, ty: elite.y }); fire({ e: 'aoe', v: 'quarry_mark', x: elite.x, y: elite.y, r: 30, d: 6000, el: 0, s: elite.id, f: 1 }); fire({ e: 'aoe', v: 'falcon_dive', x: elite.x, y: elite.y, r: 60, d: 0, el: 0, s: ME, delay: 260 }); }, 0.1);
      const fl = summon('flock', 80, 40, 120);
      let ft = 0;
      stressTicks.push((dt) => { ft += dt; const nx = 80 + Math.cos(ft * 0.5) * 150, ny = 40 + Math.sin(ft * 0.8) * 80; fl.vx = (nx - fl.x) / Math.max(dt, 1e-3); fl.vy = (ny - fl.y) / Math.max(dt, 1e-3); fl.x = nx; fl.y = ny; fl.flags = F_MOVING; });
      every(0.25, () => { for (const m of live()) if (Math.hypot(m.x - fl.x, m.y - fl.y) < 120 && Math.random() < 0.25) hit(m, 900); });
      every(2, () => { const t = live().find((m) => Math.hypot(m.x - fl.x, m.y - fl.y) < 120); if (t) fire({ e: 'aoe', v: 'flock_stoop', x: t.x, y: t.y, r: 40, d: 0, el: 3, s: ME }); }, 0.7);
      every(0.5, () => { const out = live().filter((m) => Math.hypot(m.x - fl.x, m.y - fl.y) > 140); for (let k = 0; k < Math.min(2, out.length); k++) { const t = pickOne(out); fire({ e: 'beam', v: 'flock_arc', x: fl.x, y: fl.y, tx: t.x, ty: t.y, el: 3, d: 200 }); hit(t, 600, 3); } }, 0.3);
      const guard = summon('flock_guard', h.x, h.y, 60);
      void guard;
      every(10, () => fire({ e: 'aoe', v: 'rain_storm', x: h.x, y: h.y, r: 150, d: 9800, el: 0, s: ME, f: 1 }), 0.05);
      const bd = summon('badger', -100, 100, 14), hr = summon('heron', -200, -60, 14);
      every(4, () => { const t = pickOne(live()); if (!t) return; bd.x = t.x - 10; bd.y = t.y + 6; bd.aseq = (bd.aseq ?? 0) + 1; fire({ e: 'aoe', v: 'badger_burst', x: t.x, y: t.y, r: 70, d: 0, el: 0, s: bd.id }); hit(t, 2000); }, 1.1);
      every(1.2, () => { const t = pickOne(live()); if (!t) return; hr.aseq = (hr.aseq ?? 0) + 1; fire({ e: 'beam', v: 'heron_spear', x: hr.x + 20, y: hr.y, tx: t.x, ty: t.y, el: 2, d: 160 }); hit(t, 1500, 2); }, 0.6);
    } else {
      every(0.5, () => { const t = pickOne(live()); if (!t) return; fire({ e: 'cast', s: ME, sk: 'hungering_arrow', x: h.x, y: h.y, tx: t.x, ty: t.y }); proj('arrow', h.x + 16, h.y - 2, t.x, t.y, 900, 0, ME, t.id); later(Math.hypot(t.x - h.x, t.y - h.y) / 900, () => hit(t, 1400)); });
      every(2.2, () => { const t = pickOne(live()); if (!t) return; fire({ e: 'cast', s: ME, sk: 'multishot', x: h.x, y: h.y, tx: t.x, ty: t.y }); for (let k = -4; k <= 4; k++) { const a = Math.atan2(t.y - h.y, t.x - h.x) + k * 0.13; proj('arrow', h.x, h.y - 10, h.x + Math.cos(a) * 700, h.y + Math.sin(a) * 700, 900, 0, ME, undefined, false); } }, 0.5);
      every(2.5, () => {
        const t = pickOne(live()); if (!t) return; const id = pid++, x = h.x, y = h.y, tx = t.x, ty = t.y;
        fire({ e: 'cast', s: ME, sk: 'cluster_arrow', x, y, tx, ty });
        fire({ e: 'proj', id, s: ME, v: 'cluster', x, y, vx: (tx - x) / 0.45, vy: (ty - y) / 0.45, life: 450, el: 1 });
        later(0.45, () => { fire({ e: 'pend', id, x: tx, y: ty }); fire({ e: 'aoe', v: 'cluster', x: tx, y: ty, r: 110, d: 0, el: 1, s: ME }); for (let k = 0; k < 4; k++) { const a = (k / 4) * 6.28 + 0.4; fire({ e: 'aoe', v: 'grenade', x: tx + Math.cos(a) * rnd(60, 110), y: ty + Math.sin(a) * rnd(40, 80), r: 50, d: 0, el: 1, s: ME, delay: 350 + k * 40 }); } hit(t, 5000, 1); });
      }, 0.9);
      every(6, () => { fire({ e: 'cast', s: ME, sk: 'rain_of_vengeance', x: h.x, y: h.y, tx: 80, ty: 40 }); fire({ e: 'aoe', v: 'rain', x: 80, y: 40, r: 240, d: 5000, el: 0, s: ME }); }, 0.1);
      const sentries = [summon('sentry', -330, 120), summon('sentry', -330, -60)];
      every(1, () => { for (const se of sentries) { const t = pickOne(live()); if (!t) continue; se.aseq = (se.aseq ?? 0) + 1; proj('bolt', se.x + 8, se.y - 24, t.x, t.y, 1000, 0, se.id, t.id); } }, 0.3);
      summon('wolf', -300, 30, 14);
      every(0.25, () => { for (const m of live()) if (Math.random() < 0.05) hit(m, 900); });
    }
  },
};

/** Per-frame scripted motion used by the warrior scenes (in addition to `stressTick`). */
const stressTicks: ((dt: number) => void)[] = [];

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
Object.assign(window as object, { __gallery: { vfx, fire, scene: SCENE, sfx, app }, __perf: perf });

(scenes[SCENE] ?? scenes.combat)();
if (qs.has('cx')) camX = Number(qs.get('cx'));
if (qs.has('cy')) camY = Number(qs.get('cy'));
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
  for (const f of stressTicks) f(dt);

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
    const moving=!!(e.flags & F_MOVING);
    const vx = e.vx ?? (moving ? 230 / 0.17 : 0), vy = e.vy ?? 0;
    const st: ViewState = { x: e.x, y: e.y, vx, vy, moving, facingLeft: SCENE !== 'charge' && (e.kind === 'mob' || vx < 0), flags: e.flags, attackSeq: e.aseq ?? 0, hpFrac: e.hp, time, aps: REAL_HEROES ? 1.6 : 1.2 };
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
