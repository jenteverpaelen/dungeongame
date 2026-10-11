// Projectiles: simulated locally from `proj` (position, velocity, life, optional homing target) until the
// matching `pend` arrives (or life runs out). Bodies are manual particles; trails are fire-and-forget
// particles emitted per distance travelled (scaled by the particle budget).

import type { GameEvent } from '@shared/protocol';
import type { VfxCore } from './core';
import type { Fx } from './particles';
import type { Combat } from './combat';
import { EL_ARCANE, EL_COLD, EL_FIRE, EL_LIGHT, EL_PHYS, EL_POISON, TAU, angDiff, clamp, lerpColor, pal, rand } from './util';
import type { WeaponSkin } from '../art/weaponSkin';

type ProjEv = Extract<GameEvent, { e: 'proj' }>;
type PEnd = Extract<GameEvent, { e: 'pend' }>;

interface Proj {
  id: number; v: string; el: number; mine: boolean; sz: number; src: number;
  x: number; y: number; z: number; vx: number; vy: number; speed: number;
  age: number; life: number; h: number; turn: number;
  lob: boolean; x0: number; y0: number; tx: number; ty: number; H: number;
  parts: Fx[]; acc: number; spin: number; phase: number;
  color: number; hot: number;
  /** The shooter's weapon presentation (gear V2 pass 2.1): physical shots take its light, every shot a soft aura and
   *  trail motes in it; null for monsters and plain weapons. */
  skin: WeaponSkin | null;
  aura: Fx | null;
}

const MAX = 600;

/** Colour of bolts / orbs by element (physical sentry bolts are warm brass-gold). */
function boltColor(el: number): [number, number] {
  switch (el) {
    case EL_COLD: return [0x8fe0ff, 0xe8fbff];
    case EL_FIRE: return [0xff8a3d, 0xffe08a];
    case EL_LIGHT: return [0xa98bff, 0xf4f0ff];
    case EL_POISON: return [0x8fd16a, 0xe6ffb0];
    case EL_ARCANE: return [0xb070ff, 0xf0d8ff];
    default: return [0xffc85a, 0xfff2c4];
  }
}

export class Projectiles {
  private list: Proj[] = [];
  private byId = new Map<number, Proj>();
  /** Skipstone Bolt: consecutive skips per shooter (the ricochet clicks rise in pitch). */
  private skips = new Map<number, { n: number; at: number }>();

  constructor(private V: VfxCore, private combat: Combat) {}

  get count(): number {
    return this.list.length;
  }

  spawn(ev: ProjEv): void {
    const V = this.V;
    if (this.byId.has(ev.id)) return;
    if (this.list.length >= MAX) this.remove(this.list[0]);
    const life = (ev.life > 20 ? ev.life / 1000 : ev.life) || 1;
    const speed = Math.hypot(ev.vx, ev.vy);
    const lob = ev.v === 'cluster';
    const mine = V.isMine(ev.s);
    const [color, hot] = boltColor(ev.el);
    const skin = V.skinOf(ev.s);
    const p: Proj = {
      id: ev.id, v: ev.v, el: ev.el, mine, src: ev.s, sz: (ev.sz ?? 1) * (skin ? 1 + Math.min(0.4, skin.strength * 0.22) : 1),
      x: ev.x, y: ev.y, z: 26, vx: ev.vx, vy: ev.vy, speed,
      age: 0, life, h: ev.h ?? 0, turn: 6,
      lob, x0: ev.x, y0: ev.y, tx: ev.x + ev.vx * life, ty: ev.y + ev.vy * life, H: 0,
      parts: [], acc: 0, spin: rand(0, TAU), phase: rand(0, TAU), color, hot, skin, aura: null,
    };
    if (lob) p.H = clamp(Math.hypot(p.tx - p.x, p.ty - p.y) * 0.42, 50, 190);
    this.build(p);
    this.list.push(p);
    this.byId.set(p.id, p);
    // Launch sound (my projectiles full, others' quieter).
    const vol = mine ? 1 : 0.45;
    const snd: Record<string, string> = {
      arrow: 'arrow', bolt: 'bolt', rocket: 'rocket', missile: 'missile', fireball: 'fireball', seed: 'seed',
      firebolt: 'firebolt', cluster: 'arrow', spark: 'zap', orb: 'missile',
      // ranger M1: a flat stone leaves the hand with a click; the long Farwatch shaft twangs like an arrow
      farwatch: 'arrow', skip_heavy: 'skip_heavy', dart: 'dart',
    };
    const s = snd[p.v];
    if (s) V.sound(s, p.x, p.y, vol * (p.v === 'spark' ? 0.4 : p.v === 'dart' ? 0.5 : 1));
    // a fresh Skipstone bolt (not a skip leg) restarts the rising ricochet clicks
    if (p.v === 'skip') {
      const k = this.skips.get(ev.s);
      if (!k || V.real - k.at > 0.6) { this.skips.set(ev.s, { n: 0, at: V.real }); V.sound('skip_tk0', p.x, p.y, vol * 0.7); }
      if (this.skips.size > 64) this.skips.clear();
    }
  }

  end(ev: PEnd): void {
    const p = this.byId.get(ev.id);
    if (!p) return;
    if (!p.lob) { p.x = ev.x; p.y = ev.y; }
    this.impact(p, ev.hit === 1, ev.x, ev.y);
    this.remove(p);
  }

  private remove(p: Proj): void {
    for (const f of p.parts) {
      // Hand body particles back to the auto path: a quick fade where they are.
      f.manual = false;
      f.k = f.scaleX ? f.scaleY / f.scaleX : 1;
      f.age = 0; f.life = 0.06; f.fi = 0; f.fo = 0; f.se = 0;
      f.w0 = f.w1 = f.scaleX * f.tw;
      f.vx = f.vy = f.vz = 0; f.gz = 0; f.vr = 0; f.drag = 0; f.align = false; f.flick = 0;
      f.lerpCol = false; f.a0 = ((f.color >>> 24) & 255) / 255;
    }
    p.parts.length = 0;
    this.byId.delete(p.id);
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
  }

  private build(p: Proj): void {
    const s = this.V.sys, T = s.T;
    const add = (layer: typeof s.aAdd, tex: import('pixi.js').Texture, color: number) => {
      const f = layer.hold(tex, p.x, p.y);
      f.tintTo(color);
      p.parts.push(f);
      return f;
    };
    switch (p.v) {
      case 'arrow': {
        p.z = 28; p.turn = 6;
        add(s.aAdd, T.streak, p.el === EL_PHYS ? 0xfff4d6 : pal(p.el).main);
        add(s.aBody, T.arrow, 0xffffff);
        break;
      }
      case 'shard': {
        p.z = 26;
        add(s.aAdd, T.streak, 0x9fe8ff);
        add(s.aBody, T.shard[1], 0xdff6ff);
        break;
      }
      case 'bolt': {
        p.z = 30;
        add(s.aAdd, T.glow, p.color);
        add(s.aAdd, T.bolt, p.hot);
        break;
      }
      case 'rocket': {
        p.z = 32; p.turn = 5;
        add(s.aAdd, T.glow, 0xff9a3c);
        add(s.aBody, T.rocket, 0xffffff);
        break;
      }
      case 'missile': {
        p.z = 32; p.turn = 7;
        const c = p.el === EL_PHYS ? [0xb070ff, 0xf0d8ff] : [pal(p.el).main, pal(p.el).hot];
        p.color = c[0]; p.hot = c[1];
        add(s.aAdd, T.glow, p.color);
        add(s.aAdd, T.core, p.hot);
        break;
      }
      case 'fireball': case 'firebolt': {
        p.z = p.v === 'fireball' ? 30 : 26;
        const el = p.el === EL_PHYS ? EL_FIRE : p.el;
        const enemy = p.v === 'firebolt';
        p.color = enemy ? 0xff5a2a : pal(el).main;
        p.hot = enemy ? 0xffd0a0 : pal(el).hot;
        add(s.aAdd, T.glow, p.color);
        add(s.aAdd, p.v === 'firebolt' ? T.spark : T.core, p.hot);
        break;
      }
      case 'seed': {
        p.z = 22;
        add(s.aAdd, T.glow, 0x9be86a);
        add(s.aBody, T.seed, 0xffffff);
        break;
      }
      case 'cluster': {
        p.z = 0;
        add(s.gNormal, T.shadow, 0x000000);
        add(s.aAdd, T.glow, 0xff9a3c);
        add(s.aBody, T.bomb, 0xffffff);
        break;
      }
      case 'spark': {
        p.z = 22;
        p.color = 0xb9a2ff; p.hot = 0xffffff;
        add(s.aAdd, T.glow, p.color);
        add(s.aAdd, T.core, p.hot);
        break;
      }
      case 'stone': {
        // Ironplough · Stone Spray: a small thrown stone, tumbling on a low arc (fire rune: still glowing)
        p.z = 16;
        p.color = p.el === EL_FIRE ? 0xff8a3d : 0x9a8a74;
        add(s.gNormal, T.shadow, 0x000000);
        add(s.aBody, T.chunk[p.id % 3], p.el === EL_FIRE ? 0xd8a070 : 0x9a8a74);
        break;
      }
      // ── ranger M1 (docs/rework/depth/RANGER.md §3–§4) ──
      case 'skip': case 'skip_heavy': {
        // Skipstone Bolt: a flat slate spinning in the ground plane, skimming low with a pale wake (cold: icy; lightning:
        // a violet sheen). Heavy Stone: a bigger, darker stone that flies a touch higher.
        const heavy = p.v === 'skip_heavy';
        p.z = heavy ? 20 : 15;
        p.color = p.el === EL_COLD ? 0xbfeaff : p.el === EL_LIGHT ? 0xc9b6ff : 0xd8eef2;
        add(s.gNormal, T.shadow, 0x000000);
        add(s.aAdd, T.streak, p.color);
        add(s.aBody, T.slate, heavy ? 0x9a948c : p.el === EL_COLD ? 0xe0f4ff : 0xffffff);
        if (heavy) p.sz *= 1.55;
        break;
      }
      case 'dart': {
        // Fletchling Swarm: a tiny seeking dart with a short bright streak.
        p.z = 30; p.turn = 11;
        add(s.aAdd, T.streak, 0xfff2d0);
        add(s.aBody, T.arrow, 0xffffff);
        break;
      }
      case 'thorn': {
        // Bramble Spring: a hooked thorn tumbling end over end.
        p.z = 12;
        add(s.gNormal, T.shadow, 0x000000);
        add(s.aBody, T.thorn, 0xffffff);
        break;
      }
      case 'farwatch': {
        // Farwatch: a long piercing shaft trailing a pale streak far behind it.
        p.z = 30;
        add(s.aAdd, T.streak, 0xe6f2ff);
        add(s.aAdd, T.glow, 0xdfeeff);
        add(s.aBody, T.arrow, 0xffffff);
        break;
      }
      case 'pellet': {
        // Grapeshot: a small iron ball still hot from the burst.
        p.z = 14;
        p.color = p.el === EL_COLD ? 0x9fe0ff : 0xff8a3d;
        add(s.aAdd, T.glow, p.color);
        add(s.aBody, T.dot, 0x2a2420);
        break;
      }
      case 'splinter': {
        // Stone splinters: a jagged sliver of rock spinning out.
        p.z = 18;
        add(s.aBody, T.shard[p.id % 3], 0xa49a8c);
        break;
      }
      default: {
        // 'orb' and anything unknown: glowing orb in the element colour.
        p.z = 28;
        const P = pal(p.el === EL_PHYS ? EL_ARCANE : p.el);
        p.color = P.main; p.hot = P.hot;
        add(s.aAdd, T.glow, p.color);
        add(s.aAdd, T.swirl, p.color);
        add(s.aAdd, T.core, p.hot);
      }
    }
    // weapon skin: physical shots take the weapon's light (elemental colours keep telling the damage type); every shot
    // carries a soft aura in it (an extra part after the body parts: place() positions it last)
    if (p.skin) {
      const k = p.skin;
      if (p.el === EL_PHYS && (p.v === 'arrow' || p.v === 'bolt' || p.v === 'missile' || p.v === 'spark')) {
        p.color = k.light; p.hot = k.core || lerpColor(k.light, 0xffffff, 0.5);
        if (p.v === 'arrow') p.parts[0].tintTo(lerpColor(k.light, 0xffffff, 0.35));
        else { p.parts[0].tintTo(p.color); p.parts[1]?.tintTo(p.hot); }
      }
      p.aura = add(s.aAdd, T.glow, k.edge || k.light);
    }
    this.place(p, 0);
  }

  update(dt: number): void {
    const V = this.V;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      if (p.age > p.life + 0.15) {
        this.impact(p, false, p.x, p.y);
        this.remove(p);
        continue;
      }
      let dist: number;
      const ox = p.x, oy = p.y, oz = p.z;
      if (p.lob) {
        const t = clamp(p.age / p.life, 0, 1);
        const nx = p.x0 + (p.tx - p.x0) * t, ny = p.y0 + (p.ty - p.y0) * t;
        dist = Math.hypot(nx - p.x, ny - p.y);
        p.x = nx; p.y = ny;
        p.z = 4 * p.H * t * (1 - t) + 10;
      } else {
        if (p.h) {
          const tp = V.ctx.entityPos(p.h);
          if (tp) {
            const cur = Math.atan2(p.vy, p.vx);
            const want = Math.atan2(tp.y - p.y, tp.x - p.x);
            const d = angDiff(cur, want);
            const step = clamp(d, -p.turn * dt, p.turn * dt);
            const a = cur + step;
            p.vx = Math.cos(a) * p.speed;
            p.vy = Math.sin(a) * p.speed;
          }
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        dist = p.speed * dt;
      }
      this.place(p, dt);
      p.acc += dist;
      this.trail(p, ox, oy, oz, dist);
    }
  }

  /** Position the manual body particles. */
  private place(p: Proj, dt: number): void {
    const sz = p.sz;
    const ang = p.lob ? Math.atan2(p.ty - p.y0, p.tx - p.x0) : Math.atan2(p.vy, p.vx);
    p.spin += dt;
    const parts = p.parts;
    const t = p.age;
    switch (p.v) {
      case 'arrow': case 'shard': {
        const [tr, body] = parts;
        tr.place(p.x - Math.cos(ang) * 14 * sz, p.y + 1, p.z);
        tr.rotation = ang; tr.anchorX = 0.85; tr.setScale(Math.min(90, 24 + t * 420) * sz, 0.75); tr.setAlpha(0.7);
        body.place(p.x, p.y + 1, p.z);
        body.rotation = ang;
        body.setScale((p.v === 'arrow' ? 44 : 24) * sz, p.v === 'arrow' ? 1 : 0.7);
        body.setAlpha(1);
        if (p.v === 'shard') body.rotation = ang + Math.PI / 2;
        break;
      }
      case 'bolt': {
        const [g, b] = parts;
        g.place(p.x, p.y, p.z); g.setScale(64 * sz, 0.55); g.rotation = ang; g.setAlpha(0.85);
        b.place(p.x, p.y, p.z); b.setScale(46 * sz, 1.15); b.rotation = ang; b.setAlpha(1);
        break;
      }
      case 'rocket': {
        const [g, b] = parts;
        const wob = Math.sin(t * 22 + p.phase) * 0.06;
        const fl = 0.8 + Math.random() * 0.4;
        g.place(p.x - Math.cos(ang) * 20 * sz, p.y, p.z); g.setScale(38 * sz * fl); g.setAlpha(0.95);
        b.place(p.x, p.y, p.z); b.rotation = ang + wob; b.setScale(36 * sz); b.setAlpha(1);
        break;
      }
      case 'missile': {
        const [g, c] = parts;
        const pul = 1 + Math.sin(t * 30 + p.phase) * 0.12;
        g.place(p.x, p.y, p.z); g.setScale(66 * sz * pul); g.setAlpha(0.9);
        c.place(p.x, p.y, p.z); c.setScale(20 * sz); c.setAlpha(1);
        break;
      }
      case 'fireball': {
        const [g, c] = parts;
        const pul = 1 + Math.sin(t * 26 + p.phase) * 0.1;
        g.place(p.x, p.y, p.z); g.setScale(78 * sz * pul); g.setAlpha(0.9);
        c.place(p.x, p.y, p.z); c.setScale(22 * sz); c.setAlpha(0.9);
        break;
      }
      case 'firebolt': {
        const [g, c] = parts;
        g.place(p.x, p.y, p.z); g.setScale(60 * sz, 0.6); g.rotation = ang; g.setAlpha(0.9);
        c.place(p.x, p.y, p.z); c.setScale(40 * sz, 0.75); c.rotation = ang; c.setAlpha(1);
        break;
      }
      case 'seed': {
        const [g, b] = parts;
        g.place(p.x, p.y, p.z); g.setScale(44 * sz); g.setAlpha(0.6);
        b.place(p.x, p.y, p.z); b.rotation = p.spin * 14; b.setScale(26 * sz); b.setAlpha(1);
        break;
      }
      case 'cluster': {
        const [sh, g, b] = parts;
        const k = 1 - p.z / (p.H + 40);
        sh.place(p.x, p.y, 0); sh.setScale(26 * sz * (0.5 + k * 0.5), 0.5); sh.setAlpha(0.35 * k + 0.1);
        g.place(p.x, p.y, p.z); g.setScale(30 * sz * (0.8 + Math.random() * 0.3)); g.setAlpha(0.6);
        b.place(p.x, p.y, p.z); b.rotation = p.spin * 9; b.setScale(24 * sz); b.setAlpha(1);
        break;
      }
      case 'stone': {
        const [sh, b] = parts;
        p.z = 12 + 16 * Math.sin(Math.PI * clamp(t / p.life, 0, 1));
        sh.place(p.x, p.y, 0); sh.setScale(12 * sz, 0.5); sh.setAlpha(0.28);
        b.place(p.x, p.y, p.z); b.rotation = p.phase + p.spin * 13; b.setScale(10 * sz); b.setAlpha(1);
        break;
      }
      case 'skip': case 'skip_heavy': {
        const [sh, tr, b] = parts;
        const heavy = p.v === 'skip_heavy';
        // the stone dips toward the ground and lifts again (skimming), spinning flat: its outline swells and narrows
        p.z = (heavy ? 18 : 13) + Math.abs(Math.sin(t * 9 + p.phase)) * (heavy ? 5 : 7);
        const spinK = 0.5 + 0.28 * Math.abs(Math.cos(p.spin * 26));
        sh.place(p.x, p.y, 0); sh.setScale(26 * sz, 0.45); sh.setAlpha(0.3);
        tr.place(p.x - Math.cos(ang) * 8 * sz, p.y + 1, p.z); tr.rotation = ang; tr.anchorX = 0.9;
        tr.setScale(Math.min(70, 20 + t * 300) * sz, heavy ? 0.6 : 0.42); tr.setAlpha(0.5);
        b.place(p.x, p.y, p.z); b.rotation = ang + Math.sin(p.spin * 13) * 0.5; b.setScale(27 * sz, spinK); b.setAlpha(1);
        break;
      }
      case 'dart': {
        const [tr, b] = parts;
        tr.place(p.x - Math.cos(ang) * 6, p.y + 1, p.z); tr.rotation = ang; tr.anchorX = 0.85; tr.setScale(Math.min(46, 14 + t * 300) * sz, 0.5); tr.setAlpha(0.65);
        b.place(p.x, p.y, p.z); b.rotation = ang; b.setScale(20 * sz); b.setAlpha(1);
        break;
      }
      case 'thorn': {
        const [sh, b] = parts;
        p.z = 10 + 14 * Math.sin(Math.PI * clamp(t / p.life, 0, 1));
        sh.place(p.x, p.y, 0); sh.setScale(12 * sz, 0.45); sh.setAlpha(0.25);
        b.place(p.x, p.y, p.z); b.rotation = p.phase + p.spin * 16; b.setScale(17 * sz); b.setAlpha(1);
        break;
      }
      case 'farwatch': {
        const [tr, g, b] = parts;
        tr.place(p.x - Math.cos(ang) * 10, p.y + 1, p.z); tr.rotation = ang; tr.anchorX = 0.95;
        tr.setScale(Math.min(220, 40 + t * 900) * sz, 0.5); tr.setAlpha(0.75);
        g.place(p.x, p.y, p.z); g.setScale(40 * sz, 0.45); g.rotation = ang; g.setAlpha(0.55);
        b.place(p.x, p.y + 1, p.z); b.rotation = ang; b.setScale(54 * sz, 1.05); b.setAlpha(1);
        break;
      }
      case 'pellet': {
        const [g, b] = parts;
        g.place(p.x, p.y, p.z); g.setScale(18 * sz * (0.85 + Math.random() * 0.3)); g.setAlpha(0.6);
        b.place(p.x, p.y, p.z); b.setScale(6.5 * sz); b.setAlpha(1);
        break;
      }
      case 'splinter': {
        const [b] = parts;
        b.place(p.x, p.y, p.z); b.rotation = p.phase + p.spin * 15; b.setScale(12 * sz, 0.75); b.setAlpha(1);
        break;
      }
      case 'spark': {
        const [g, c] = parts;
        const j = 4;
        g.place(p.x + rand(-j, j), p.y, p.z + rand(-j, j)); g.setScale(44 * sz * (0.8 + Math.random() * 0.5)); g.setAlpha(0.9);
        c.place(g.gx, p.y, g.z); c.setScale(13 * sz); c.setAlpha(1);
        break;
      }
      default: {
        const [g, sw, c] = parts;
        const pul = 1 + Math.sin(t * 18 + p.phase) * 0.1;
        g.place(p.x, p.y, p.z); g.setScale(68 * sz * pul); g.setAlpha(0.85);
        sw.place(p.x, p.y, p.z); sw.setScale(48 * sz); sw.rotation = -p.spin * 8; sw.setAlpha(0.8);
        c.place(p.x, p.y, p.z); c.setScale(18 * sz); c.setAlpha(1);
      }
    }
    if (p.aura && p.skin) {
      p.aura.place(p.x, p.y, p.z);
      p.aura.setScale((18 + 8 * Math.min(1.6, p.skin.strength)) * sz * (1 + Math.sin(t * 20 + p.phase) * 0.08));
      p.aura.setAlpha(0.32);
    }
  }

  /** Emit trail particles every few units travelled. */
  private trail(p: Proj, ox: number, oy: number, oz: number, dist: number): void {
    const s = this.V.sys, T = s.T;
    const step = (p.v === 'rocket' ? 8 : p.v === 'fireball' ? 7 : p.v === 'firebolt' ? 8 : 12) / Math.max(0.3, s.budget);
    if (this.list.length > 220 && p.v !== 'rocket' && p.v !== 'fireball' && p.v !== 'cluster') { p.acc = 0; return; }
    const inv = dist > 0.001 ? 1 / dist : 0;
    while (p.acc >= step) {
      p.acc -= step;
      // Spread emissions along this frame's path segment (no clumping at low frame rates).
      const f = clamp(1 - p.acc * inv, 0, 1);
      const x = ox + (p.x - ox) * f + rand(-2, 2), y = oy + (p.y - oy) * f, z = oz + (p.z - oz) * f + rand(-2, 2);
      switch (p.v) {
        case 'arrow':
          if (p.el !== EL_PHYS && Math.random() < 0.5) s.glint(x, y, z, 8, pal(p.el).main, 0.25, 0.8);
          break;
        case 'shard':
          if (Math.random() < 0.5) s.glint(x, y, z, 9, 0xcff2ff, 0.28);
          break;
        case 'bolt': {
          const f = s.aAdd.add(T.dot, x, y, 0.24);
          f.z = z; f.w0 = 9 * p.sz; f.w1 = 1; f.fo = 0; f.tintTo(p.color);
          break;
        }
        case 'rocket': {
          s.smoke(x - p.vx * 0.02, y, z, 8, 24, 0xa8a29c, rand(0.4, 0.6), 0.38, 10);
          const f = s.aAdd.add(T.glow, x, y, 0.12);
          f.z = z; f.w0 = 16; f.w1 = 6; f.fo = 0; f.tintTo(0xff8a3d);
          break;
        }
        case 'missile': {
          const f = s.aAdd.add(Math.random() < 0.4 ? T.star4 : T.dot, x + rand(-4, 4), y, rand(0.25, 0.4));
          f.z = z + rand(-4, 4); f.w0 = rand(8, 13) * p.sz; f.w1 = 1; f.fo = 0.2; f.vr = 3; f.tintFade(p.hot, p.color);
          break;
        }
        case 'fireball': case 'firebolt': {
          const f = s.aAdd.add(T.flame, x, y, rand(0.18, 0.3));
          f.z = z; f.anchorY = 0.7; f.w0 = (p.v === 'fireball' ? 30 : 20) * p.sz; f.w1 = 5; f.k = 1.3; f.fo = 0.2;
          f.rotation = Math.atan2(p.vy, p.vx) + Math.PI / 2;
          f.tintFade(p.hot, p.color);
          if (Math.random() < 0.35) s.ember(x, y, z, p.color, 0.5, 4, 30);
          break;
        }
        case 'seed': {
          const f = s.aAdd.add(T.dot, x, y, 0.3);
          f.z = z; f.w0 = 7; f.w1 = 1; f.a0 = 0.8; f.tintTo(0x9be86a);
          break;
        }
        case 'cluster': {
          s.spark(x, y, z, rand(0, TAU), rand(30, 80), 8, 0xffb050, 0.2);
          if (Math.random() < 0.5) s.smoke(x, y, z, 6, 18, 0x8a8480, 0.5, 0.35, 5);
          break;
        }
        case 'spark': {
          this.combat.zigzag(x, y - z, rand(0, TAU), rand(10, 18), 0xd6c2ff, 0.08, 1.8);
          break;
        }
        case 'stone': {
          if (p.el === EL_FIRE) { if (Math.random() < 0.5) s.ember(x, y, z, 0xff8a3d, 0.4, 3.5, 20); }
          else if (Math.random() < 0.4) { const g = s.aBody.add(T.dot, x, y, 0.3); g.z = z; g.vz = -20; g.gz = 300; g.w0 = g.w1 = 2.2; g.fo = 0.4; g.tintTo(0x7d7062); }
          break;
        }
        case 'skip': case 'skip_heavy': {
          // a faint wake on the ground and a few flung droplets, as if skimming water
          const wk = s.gAdd.add(T.glow, x, y, 0.35);
          wk.w0 = 10; wk.w1 = 22; wk.k = 0.4; wk.a0 = 0.16; wk.fo = 0.2; wk.rotation = Math.atan2(p.vy, p.vx); wk.tintTo(p.color);
          if (Math.random() < 0.35) {
            const d = s.aAdd.add(T.dot, x, y, 0.3);
            d.z = z; d.vx = -p.vx * 0.08 + rand(-30, 30); d.vy = rand(-15, 15); d.vz = rand(40, 90); d.gz = 500; d.w0 = 3.2; d.w1 = 1.6; d.fo = 0.5; d.tintTo(p.color);
          }
          if (p.el === EL_LIGHT && Math.random() < 0.3) this.combat.zigzag(x, y - z, rand(0, TAU), rand(8, 14), 0xd6c2ff, 0.08, 1.4);
          break;
        }
        case 'dart': {
          if (Math.random() < 0.4) s.glint(x, y, z, 6, 0xfff0c8, 0.2, 0.7);
          break;
        }
        case 'thorn': {
          if (Math.random() < 0.25) { const g = s.aBody.add(T.dot, x, y, 0.35); g.z = z; g.vz = -10; g.gz = 260; g.w0 = g.w1 = 2; g.fo = 0.4; g.tintTo(0x6a7a3a); }
          break;
        }
        case 'farwatch': {
          // a pale streak lingering along the whole flight (overlapping soft segments), the odd glint
          if (Math.random() < 0.12) s.glint(x, y, z, 7, 0xeef6ff, 0.25, 0.7);
          const f = s.aAdd.add(T.streak, x, y, 0.42);
          f.z = z; f.rotation = Math.atan2(p.vy, p.vx); f.w0 = 34; f.w1 = 26; f.k = 0.22; f.a0 = 0.4; f.fo = 0.1; f.tintTo(0xdfeeff);
          break;
        }
        case 'pellet': {
          if (p.el === EL_COLD) { if (Math.random() < 0.5) s.glint(x, y, z, 6, 0xdff6ff, 0.2, 0.7); }
          else { const f = s.aAdd.add(T.dot, x, y, 0.2); f.z = z; f.w0 = 5; f.w1 = 1; f.fo = 0; f.tintTo(0xffa050); if (Math.random() < 0.3) s.smoke(x, y, z, 5, 14, 0x6a625c, 0.5, 0.3, 6); }
          break;
        }
        case 'splinter': {
          if (Math.random() < 0.3) { const g = s.aBody.add(T.dot, x, y, 0.3); g.z = z; g.vz = -20; g.gz = 300; g.w0 = g.w1 = 1.8; g.fo = 0.4; g.tintTo(0x8a8274); }
          break;
        }
        default: {
          const f = s.aAdd.add(T.dot, x + rand(-3, 3), y, 0.3);
          f.z = z + rand(-3, 3); f.w0 = 11 * p.sz; f.w1 = 1; f.fo = 0.1; f.tintTo(p.color);
        }
      }
      // Quarry Mark: your summons' shots at the marked quarry leave a pale trail
      if (p.h && this.V.quarry.has(p.h) && !this.V.players.has(p.src) && Math.random() < 0.7 * s.budget) {
        const q = s.aAdd.add(T.dot, x, y, 0.45);
        q.z = z; q.w0 = 7; q.w1 = 2; q.a0 = 0.6; q.fo = 0.2; q.tintTo(0xf6edd2);
      }
      // weapon skin motes along the path, by the drawing's particle hint
      const k = p.skin;
      if (k && Math.random() < 0.3 * Math.min(1.5, k.strength) * s.budget) {
        if (k.impact === 'ember') s.ember(x, y, z, k.edge || k.light, 0.45, 4, 30);
        else s.glint(x + rand(-3, 3), y, z + rand(-3, 3), 7 + 3 * Math.min(1.6, k.strength), k.impact === 'star' ? 0xffffff : k.core || k.light, 0.28, 0.85);
      }
    }
  }

  private impact(p: Proj, hit: boolean, x: number, y: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const z = p.lob ? 6 : p.z;
    if (hit && p.skin) s.flash(x, y, z, 12 + 8 * Math.min(1.6, p.skin.strength), p.skin.light, 0.08, 0.55);
    switch (p.v) {
      case 'arrow': {
        if (hit) {
          for (let i = 0; i < 3; i++) s.chunk(x, y, z, rand(-80, 80), rand(-40, 40), rand(60, 160), 4, 0xb98a54, 0.45);
          s.flash(x, y, z, 22, 0xfff0d0, 0.08, 0.7);
        } else s.dust(x, y, 10, 26, 0xc9b597, 0.4, 0.35);
        break;
      }
      case 'shard': {
        for (let i = 0; i < 4; i++) s.chunk(x, y, z, rand(-110, 110), rand(-50, 50), rand(60, 160), rand(4, 7), 0xd8f4ff, 0.5, T.shard[i % 3]);
        s.glint(x, y, z, 22, 0xe8fbff, 0.22);
        break;
      }
      case 'bolt': {
        s.flash(x, y, z, 34, p.hot, 0.1, 0.9);
        for (let i = 0, n = s.n(5); i < n; i++) s.spark(x, y, z, rand(0, TAU), rand(120, 260), 10, p.color, 0.18);
        break;
      }
      case 'rocket': {
        s.flash(x, y, z, 70, 0xffc070, 0.14, 1);
        s.ring(s.aAdd, T.ring, x, y, 6, 36, 0xff9a3c, 0.22, 0.8, z * 0.5);
        for (let i = 0, n = s.n(8); i < n; i++) s.spark(x, y, z, rand(0, TAU), rand(150, 320), 12, 0xffb050, 0.25, 600);
        for (let i = 0, n = s.n(4); i < n; i++) s.smoke(x + rand(-8, 8), y, z, 16, 42, 0x6a625c, rand(0.6, 0.9), 0.5, 30);
        V.sound('grenade', x, y, p.mine ? 0.55 : 0.3);
        break;
      }
      case 'missile': {
        s.flash(x, y, z, 46, p.hot, 0.12, 0.9);
        s.ring(s.aAdd, T.ringHard, x, y, 4, 26, p.color, 0.2, 0.9, z);
        for (let i = 0, n = s.n(4); i < n; i++) s.glint(x + rand(-10, 10), y, z + rand(-10, 10), 12, p.hot, 0.25);
        break;
      }
      case 'fireball': case 'firebolt': {
        const big = p.v === 'fireball' ? 1 : 0.7;
        s.flash(x, y, z, 64 * big, p.hot, 0.14, 0.95);
        for (let i = 0, n = s.n(6 * big); i < n; i++) {
          const f = s.aAdd.add(T.flame, x + rand(-10, 10), y, rand(0.25, 0.45));
          f.z = z * 0.6; f.anchorY = 0.85; f.vz = rand(30, 80); f.w0 = rand(12, 20) * big; f.w1 = 3; f.k = 1.4; f.fo = 0.3;
          f.tintFade(p.hot, p.color);
        }
        for (let i = 0, n = s.n(6 * big); i < n; i++) s.ember(x, y, z * 0.7, p.color, rand(0.5, 0.9), 4, 70);
        s.smoke(x, y, z, 18, 44, 0x4a403a, 0.8, 0.35, 30);
        if (p.el === EL_ARCANE || p.el === EL_COLD) s.ring(s.gAdd, T.ring, x, y, 8, 60, p.color, 0.3, 0.8);
        break;
      }
      case 'seed': {
        for (let i = 0; i < 5; i++) { const c = s.chunk(x, y, z, rand(-90, 90), rand(-40, 40), rand(60, 150), 5, 0x8fd16a, 0.5, T.dot); c.vr = 0; }
        s.flash(x, y, z, 26, 0xc8ff9a, 0.1, 0.6);
        break;
      }
      case 'cluster': {
        // The explosion itself arrives as an `aoe cluster` event; just a spark when the shell lands.
        s.flash(x, y, 8, 40, 0xffd090, 0.08, 0.8);
        break;
      }
      case 'stone': {
        for (let i = 0; i < 3; i++) s.chunk(x, y, z, rand(-90, 90), rand(-40, 40), rand(60, 150), rand(3, 5), i % 2 ? 0x8f8578 : 0x6e665c, 0.5);
        s.dust(x, y, 10, 26, 0xa89c88, 0.4, 0.32);
        if (hit) s.flash(x, y, z, 20, p.el === EL_FIRE ? 0xffb070 : 0xfff0d8, 0.07, 0.6);
        break;
      }
      case 'spark': {
        s.flash(x, y, z, 40, 0xe6dcff, 0.1, 1);
        for (let i = 0; i < 3; i++) this.combat.zigzag(x, y - z, rand(0, TAU), rand(14, 24), 0xd6c2ff, 0.12);
        break;
      }
      case 'skip': case 'skip_heavy': {
        // Every skip point makes a small water-ripple ring, even on dry ground (RANGER.md R7), and a rising click.
        const heavy = p.v === 'skip_heavy';
        const cold = p.el === EL_COLD, lit = p.el === EL_LIGHT;
        const rc = cold ? 0xc8f0ff : lit ? 0xd8c8ff : 0xdff3f6;
        const k = heavy ? 1.5 : 1;
        s.ring(s.gAdd, T.ringHard, x, y, 4, 26 * k, rc, 0.42, 0.55);
        s.ring(s.gAdd, T.ringHard, x, y, 2, 15 * k, rc, 0.5, 0.4);
        V.after(0.09, () => s.ring(s.gAdd, T.ring, x, y, 4, 34 * k, rc, 0.5, 0.3));
        s.ring(s.gNormal, T.ringThick, x, y, 4, 22 * k, 0x2a3a42, 0.45, 0.16);
        for (let i = 0, n = s.n(heavy ? 9 : 6); i < n; i++) {
          const a = rand(0, TAU);
          const d = s.aAdd.add(T.drip, x + Math.cos(a) * 4, y + Math.sin(a) * 3, rand(0.32, 0.5));
          d.z = 4; d.vx = Math.cos(a) * rand(30, 80); d.vy = Math.sin(a) * rand(15, 40); d.vz = rand(110, 190) * k; d.gz = 700;
          d.align = true; d.w0 = rand(3, 4.5); d.w1 = 2; d.k = 1.3; d.a0 = 0.8; d.fo = 0.5; d.tintTo(rc);
        }
        if (hit) {
          s.flash(x, y, z, heavy ? 40 : 22, cold ? 0xe8fbff : 0xf4fbff, 0.07, 0.7);
          for (let i = 0, n = s.n(heavy ? 4 : 2); i < n; i++) s.chunk(x, y, z, rand(-90, 90), rand(-40, 40), rand(80, 160), rand(3, 5), 0x7e8c94, 0.45);
          if (cold) for (let i = 0, n = s.n(3); i < n; i++) s.glint(x + rand(-10, 10), y + rand(-6, 6), rand(2, 14), 12, 0xe8fbff, 0.3);
          if (lit) for (let i = 0, n = 1 + s.n(2); i < n; i++) this.combat.zigzag(x, y - z, rand(0, TAU), rand(12, 22), 0xd6c2ff, 0.12);
          if (heavy) { s.dust(x, y, 16, 44, 0xb8a284, 0.5, 0.42); V.shakeNear(x, y, p.mine ? 2 : 1, 80); }
        }
        const sk = this.skips.get(p.src);
        const n = sk && V.real - sk.at < 0.8 ? Math.min(3, sk.n + 1) : 1;
        this.skips.set(p.src, { n, at: V.real });
        const vol = p.mine ? 0.85 : 0.4;
        V.sound(heavy ? 'skip_thock' : `skip_tk${n}`, x, y, vol);
        V.sound('skip_plip', x, y, vol * 0.7);
        break;
      }
      case 'dart': {
        s.flash(x, y, z, 16, 0xfff0d0, 0.06, 0.6);
        if (hit) s.chunk(x, y, z, rand(-60, 60), rand(-30, 30), rand(60, 120), 3, 0xb98a54, 0.35);
        break;
      }
      case 'thorn': {
        for (let i = 0, n = s.n(3); i < n; i++) {
          const c = s.chunk(x, y, z, rand(-70, 70), rand(-35, 35), rand(60, 140), rand(3, 4.5), i % 2 ? 0x6a7a3a : 0x5a4a26, 0.45, T.thorn);
          c.vr = rand(-10, 10);
        }
        if (hit) s.flash(x, y, z, 16, 0xe8f0b0, 0.06, 0.5);
        break;
      }
      case 'farwatch': {
        s.flash(x, y, z, hit ? 34 : 20, 0xeef6ff, 0.09, 0.8);
        if (hit) { s.ring(s.aAdd, T.ringHard, x, y, 3, 20, 0xdfeeff, 0.18, 0.7, z); for (let i = 0, n = s.n(3); i < n; i++) s.chunk(x, y, z, rand(-80, 80), rand(-40, 40), rand(60, 160), 4, 0xb98a54, 0.45); }
        else s.dust(x, y, 10, 26, 0xc9b597, 0.4, 0.35);
        break;
      }
      case 'pellet': {
        const cold = p.el === EL_COLD;
        s.flash(x, y, z, 24, cold ? 0xe8fbff : 0xffc070, 0.07, 0.8);
        for (let i = 0, n = s.n(4); i < n; i++) s.spark(x, y, z, rand(0, TAU), rand(90, 200), 8, cold ? 0xbfefff : 0xffb050, 0.18, 500);
        s.smoke(x, y, z, 10, 26, cold ? 0xd8eef8 : 0x5a524c, 0.5, 0.35, 15);
        if (hit) V.sound('grenade', x, y, p.mine ? 0.2 : 0.1);
        break;
      }
      case 'splinter': {
        for (let i = 0, n = s.n(2); i < n; i++) s.chunk(x, y, z, rand(-70, 70), rand(-35, 35), rand(60, 130), rand(2.5, 4), 0x8f8578, 0.4);
        s.dust(x, y, 8, 20, 0xa89c88, 0.35, 0.3);
        break;
      }
      default: {
        s.flash(x, y, z, 52, p.hot, 0.14, 0.9);
        s.ring(s.aAdd, T.ring, x, y, 6, 40, p.color, 0.25, 0.85, z);
        for (let i = 0, n = s.n(6); i < n; i++) s.spark(x, y, z, rand(0, TAU), rand(120, 260), 10, p.color, 0.22);
      }
    }
  }

  clear(): void {
    for (const p of [...this.list]) this.remove(p);
    this.list.length = 0;
    this.byId.clear();
  }
}

