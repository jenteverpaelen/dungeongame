// Area effects (`aoe` events): impacts, lingering pools, the black hole, frost nova, stomps, slashes,
// fissures, arrow rain, explosions. Also exposes the building blocks (explosion, slam, iceBurst, cleave)
// that telegraphs and casts reuse.

import { CanvasSource, Container, MeshPlane, Sprite, Texture } from 'pixi.js';
import { GROUND_DEFS } from '@shared/data/grounds';
import { WARRIOR_FX } from '@shared/data/skills';
import { preferences } from '../../game/preferences';
import { ui } from '../../ui/store';
import type { GameEvent } from '@shared/protocol';
import type { Effect, VfxCore } from './core';
import type { Combat } from './combat';
import type { Fx } from './particles';
import type { Slashes } from './slash';
import type { WeaponSkin } from '../art/weaponSkin';
import { RANGER_AOE, RangerFx } from './ranger';
import { MAGE_AOE, type MageFx } from './mage';
import {
  EL_ARCANE, EL_COLD, EL_FIRE, EL_LIGHT, EL_PHYS, EL_POISON, TAU, angDiff, clamp, easeIn, easeOut, easeOut3, easeOutBack, lerpColor, pal, rand,
} from './util';

type Aoe = Extract<GameEvent, { e: 'aoe' }>;

/** aoe visuals a telegraph payoff may already have drawn (see telegraphs.ts TELE_COVERS). */
const COVERED_BY: Record<string, string[]> = {
  slam: ['slam'],
  explode: ['molten_death', 'mortar', 'frozen_orb'],
  grenade: ['mortar'],
  nova: ['frozen_orb'],
};

const WAIST = 20;

export class AoeFx {
  /** Called when a meteor impact arrives so a falling rock lands right now. */
  onMeteorImpact: (x: number, y: number) => void = () => undefined;
  /** Standing props (planted standards, landed cairns): ground layer, under entities so heroes stay readable. */
  private low = new Container({ label: 'vfx-props-low' });
  /** Airborne props (hatchets, falling cairns, the toll bell): above entities. */
  private high = new Container({ label: 'vfx-props-high' });
  private cleaves: { x: number; y: number; a: number; t: number }[] = [];
  private hatchets: Hatchet[] = [];
  private banners: Banner[] = [];
  private cairnsFalling: { x: number; y: number; land: () => void }[] = [];
  private cairnsStanding: { x: number; y: number; jolt: () => void }[] = [];
  private ploughs = new Map<number, { x: number; y: number; t: number; snd: number }>();
  /** Live Kilnheart auras by owner (a recast replaces the running one). */
  private kilns = new Map<number, () => void>();
  /** Live black holes (Black Hole · Wandering Void moves the owner's hole with `blackhole_at`). */
  private holes: Hole[] = [];
  /** Mage M1 area visuals (mage.ts), injected by Vfx. */
  mage: MageFx | null = null;

  /** Ranger M1 variants (vfx/ranger.ts). */
  private ranger: RangerFx;

  constructor(private V: VfxCore, private combat: Combat, private slashes: Slashes) {
    V.layers.groundFx.addChild(this.low);
    V.layers.aboveFx.addChild(this.high);
    this.ranger = new RangerFx(V, combat, this);
  }

  handle(ev: Aoe): void {
    const V = this.V;
    // ranger M1 variants schedule their own delay (falling arrows / the falcon start early so they land on time)
    if (RANGER_AOE.has(ev.v)) { this.ranger.handle(ev); return; }
    const delay = (ev.delay ?? 0) / 1000;
    if (ev.v === 'meteorSmall' || ev.v === 'meteor') {
      if (delay > 0.12) { this.smallFall(ev.x, ev.y, ev.r, delay, ev.el, ev.v === 'meteor'); return; }
    } else if (delay > 0) {
      V.after(delay, () => this.handle({ ...ev, delay: 0 }));
      return;
    }
    if (this.mage && MAGE_AOE.has(ev.v)) { this.mage.aoe(ev, V.isMine(ev.s)); return; }
    const covers = COVERED_BY[ev.v];
    if (covers) {
      if (covers.some((k) => V.consume('tele:' + k, ev.x, ev.y, 0.4, 70))) return;
      V.mark('aoe:' + ev.v, ev.x, ev.y);
    }
    const mine = V.isMine(ev.s);
    const d = ev.d / 1000;
    const r = Math.max(8, ev.r);
    switch (ev.v) {
      case 'meteor': this.onMeteorImpact(ev.x, ev.y); this.meteorImpact(ev.x, ev.y, r, ev.el, false, mine); break;
      case 'meteorSmall': this.meteorImpact(ev.x, ev.y, r, ev.el, true, mine); break;
      case 'molten': this.pool(ev.x, ev.y, r, Math.max(0.5, d), ev.el === EL_COLD ? 'frost' : 'lava', ev.f ? ev.s : undefined); break;
      case 'molten_trail': this.pool(ev.x, ev.y, r, Math.max(0.5, d), 'lava', ev.f ? ev.s : undefined); break;
      case 'poison_pool': this.pool(ev.x, ev.y, r, Math.max(0.5, d), 'goo', ev.f ? ev.s : undefined); break;
      case 'blackhole': this.blackhole(ev.x, ev.y, r, Math.max(0.4, d), ev.el, ev.s); break;
      case 'blackhole_at': this.blackholeAt(ev.s ?? -1, ev.x, ev.y, Math.max(0.1, d)); break;
      case 'nova': this.nova(ev.x, ev.y, r, ev.el, mine); break;
      case 'stomp': this.stomp(ev.x, ev.y, r, ev.el, mine); break;
      case 'rend':
        if (V.consume('cast:rend', ev.x, ev.y, 0.15, 40)) break;
        this.rend(ev.x, ev.y, r, ev.el);
        break;
      case 'fissure': this.fissure(ev.x, ev.y, r, ev.a ?? 0, ev.el, mine); break;
      case 'rain': this.rain(ev.x, ev.y, r, Math.max(0.6, d), ev.el); break;
      case 'cluster': this.explosion(ev.x, ev.y, r, ev.el === EL_PHYS ? EL_FIRE : ev.el, 1.2, mine); break;
      case 'grenade': this.explosion(ev.x, ev.y, r, ev.el === EL_PHYS ? EL_FIRE : ev.el, 0.7, mine); break;
      case 'explode': this.explosion(ev.x, ev.y, r, ev.el, 1, mine); break;
      case 'dustdevil_hit': this.dustdevil(ev.x, ev.y, r); break;
      case 'whirl': this.whirl(ev.x, ev.y, r, ev.el); break;
      case 'cleave':
        // The cast already drew the arc toward its target; a 360° Cleave's second (opposite) arc still draws.
        if (this.consumeCleave(ev.x, ev.y, ev.a ?? 0)) break;
        this.cleave(ev.x, ev.y, r, ev.a ?? 0, ev.el, false, V.skinOf(ev.s));
        break;
      case 'chain': this.chainZap(ev.x, ev.y, r); break;
      case 'slam': this.slam(ev.x, ev.y, r, ev.el, 1); break;
      // ── warrior M1 (docs/rework/depth/WARRIOR.md §3) ──
      case 'tollblow': this.tollBlow(ev.x, ev.y, r, ev.a ?? 0, ev.el, mine); break;
      case 'toll': this.toll(ev.x, ev.y, r, ev.el, mine); break;
      case 'hatchet': case 'hatchet3': this.hatchet(ev, ev.v === 'hatchet3', mine); break;
      case 'hatchet_seek': this.hatchetSeek(ev); break;
      case 'standard': case 'standard_carry': this.standard(ev, ev.v === 'standard_carry', mine); break;
      case 'standard_end': this.standardEnd(ev); break;
      case 'standard_pulse': this.standardPulse(ev.x, ev.y, r, ev.el, mine); break;
      case 'plough': this.plough(ev, mine); break;
      case 'sod': this.sod(ev.x, ev.y, r, ev.el, mine); break;
      case 'cairn': this.cairnImpact(ev.x, ev.y, r, Math.max(0.3, d), ev.el, mine); break;
      case 'cairn_pulse': this.cairnPulse(ev.x, ev.y, r, mine); break;
      case 'ember_trail': this.emberTrail(ev.x, ev.y, r, Math.max(0.4, d)); break;
      case 'tremor_ring': this.tremorRing(ev.x, ev.y, r, Math.max(0.2, d), ev.el, mine); break;
      case 'aftershock': this.aftershock(ev.x, ev.y, r, ev.el); break;
      // ── warrior wave 2: Kilnheart, Hearthbanner, data grounds (server/src/sim/groundFx.ts placeGround) ──
      case 'kiln_breath': this.kilnBreath(ev.x, ev.y, r, ev.a ?? 0, ev.el, mine); break;
      case 'hearth_shock': this.hearthShock(ev.x, ev.y, r, Math.max(0.2, d), mine); break;
      case 'quake_crack': this.quakeCrack(ev.x, ev.y, r, ev.a ?? 0, Math.max(0.5, d), ev.el); break;
      case 'tremor': this.tremorField(ev.x, ev.y, r, Math.max(0.5, d)); break;
      case 'fault_line': this.faultLine(ev.x, ev.y, r, ev.a ?? 0, Math.max(0.5, d), mine); break;
      case 'furrow': this.furrowGround(ev.x, ev.y, r, ev.a ?? 0, Math.max(0.5, d)); break;
      default: this.explosion(ev.x, ev.y, r, ev.el, 0.8, mine);
    }
  }

  // ─────────────────────────── explosions ───────────────────────────

  explosion(x: number, y: number, r: number, el: number, power: number, mine = false): void {
    const V = this.V, s = V.sys, T = s.T;
    const P = pal(el);
    const k = power;
    const z = 14;
    const sc = Math.max(0.6, r / 70);
    if (el === EL_LIGHT) {
      s.flash(x, y, z, r * 2.6, 0xffffff, 0.08, 1);
      s.glow(x, y, z, r * 0.8, r * 1.6, 0xb9a2ff, 0.22, 0.8, s.aAdd);
      s.ring(s.gAdd, T.ring, x, y, r * 0.2, r * 1.15, 0xc9b6ff, 0.24, 0.9);
      for (let i = 0; i < 6; i++) this.combat.zigzag(x, y - z, rand(0, TAU), r * rand(0.6, 1.2), 0xe6dcff, 0.2, 2.6);
      for (let i = 0, n = s.n(16 * k); i < n; i++) s.spark(x, y, z, rand(0, TAU), rand(220, 460), 15, i % 2 ? 0xffffff : 0xb9a2ff, 0.3, 400);
      for (let i = 0, n = s.n(3 * k); i < n; i++) s.smoke(x + rand(-r, r) * 0.3, y, z, r * 0.3, r * 0.9, 0x6a6080, rand(0.6, 0.9), 0.28, 40);
      this.combat.decal(T.scorch[0], x, y, r * 1.1, 0x000000, 0.22, 2.2);
      V.sound('zap', x, y);
      V.sound(power > 1 ? 'explode' : 'grenade', x, y, 0.6);
      return;
    }
    if (el === EL_COLD) { this.iceBurst(x, y, r); return; }
    const smokeCol = el === EL_POISON ? 0x6f9f4a : el === EL_ARCANE ? 0x5a4a70 : 0x5e524a;
    // White-hot core flash, then a billowing fireball of overlapping glows that rise and cool.
    s.flash(x, y, z, r * 2.4, P.hot, 0.09, 1);
    for (let i = 0, n = 4 + Math.round(2 * k); i < n; i++) {
      const a = rand(0, TAU), d = rand(0, r * 0.35);
      const g = s.aAdd.add(T.glow, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5, rand(0.3, 0.45) * (0.85 + 0.15 * k));
      g.z = z + rand(0, 14); g.vz = rand(30, 90); g.drag = 2;
      g.w0 = r * rand(0.6, 0.9); g.w1 = r * rand(1.3, 1.7); g.se = 3; g.fo = 0.25; g.a0 = 0.75;
      g.tintFade(lerpColor(P.hot, P.main, 0.35), el === EL_FIRE || el === EL_PHYS ? 0xb83a0c : P.main);
    }
    // Flame tongues thrown outward and up.
    for (let i = 0, n = s.n(10 * k); i < n; i++) {
      const a = (i / 10) * TAU + rand(-0.3, 0.3), sp = rand(120, 260) * sc;
      const f = s.aAdd.add(T.flame, x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.12, rand(0.3, 0.5));
      f.anchorY = 0.8; f.z = rand(4, 16); f.vx = Math.cos(a) * sp; f.vy = Math.sin(a) * sp * 0.55; f.vz = rand(60, 150); f.drag = 3.5;
      f.w0 = rand(20, 32) * sc; f.w1 = 5; f.k = 1.5; f.fo = 0.3; f.flick = 0.2; f.a0 = 0.85;
      f.tintFade(lerpColor(P.hot, P.main, 0.3), P.main);
    }
    s.ring(s.gAdd, T.ring, x, y, r * 0.3, r * 1.25, P.hot, 0.26, 0.85);
    s.ring(s.gNormal, T.ringThick, x, y, r * 0.3, r * 1.2, 0x3a2e24, 0.4, 0.3);
    for (let i = 0, n = s.n(14 * k); i < n; i++) s.spark(x, y, z, rand(0, TAU), rand(220, 460) * sc, rand(10, 18), lerpColor(P.hot, P.main, Math.random()), rand(0.25, 0.45), 700);
    // Smoke rolls in as the fire dies and lingers.
    V.after(0.07, () => {
      for (let i = 0, n = s.n(4 * k); i < n; i++) s.smoke(x + rand(-r, r) * 0.35, y + rand(-r, r) * 0.15, z + rand(6, 26), r * 0.45, r * 1.15, smokeCol, rand(0.9, 1.4), 0.34, rand(40, 70));
    });
    for (let i = 0, n = s.n(3 * k - 1); i < n; i++) {
      const a = rand(0, TAU);
      s.chunk(x, y, z, Math.cos(a) * rand(80, 220), Math.sin(a) * rand(50, 130), rand(200, 380), rand(5, 8), 0x4a3c34, rand(0.6, 0.9));
    }
    for (let i = 0, n = s.n(8 * k); i < n; i++) s.ember(x + rand(-r, r) * 0.5, y, rand(4, 30), P.main, rand(0.7, 1.2), 4, 80);
    if (el === EL_POISON) this.combat.decal(T.poolGoo, x, y, r * 1.4, 0x3f7a26, 0.5, 3);
    else this.combat.decal(T.scorch[(Math.random() * 2) | 0], x, y, r * 1.5, 0x000000, 0.3, 3.5);
    if (power >= 1) V.shakeNear(x, y, mine ? 4 : 3, 140);
    V.sound(power >= 1 ? 'explode' : 'grenade', x, y, mine ? 1 : 0.7);
  }

  /** Icy burst (frozen orb payoff, cold explosions). */
  iceBurst(x: number, y: number, r: number): void {
    const V = this.V, s = V.sys, T = s.T;
    s.flash(x, y, 16, r * 2.6, 0xe8fbff, 0.14, 1);
    s.ring(s.gAdd, T.ringThick, x, y, r * 0.2, r * 1.1, 0x7fd8ff, 0.32, 0.9);
    s.ring(s.aAdd, T.ringHard, x, y, r * 0.2, r * 1.15, 0xffffff, 0.25, 0.8, 4);
    for (let i = 0, n = s.n(18); i < n; i++) {
      const a = rand(0, TAU), sp = rand(120, 300) * Math.max(0.8, r / 70);
      const p = s.chunk(x, y, 18, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(140, 300), rand(7, 13), i % 3 ? 0xd8f4ff : 0x9fd8ff, rand(0.8, 1.2), T.shard[i % 3]);
      p.bounce = 0.25;
    }
    for (let i = 0, n = s.n(5); i < n; i++) s.smoke(x + rand(-r, r) * 0.4, y, 10, r * 0.5, r * 1.2, 0xcfefff, rand(0.7, 1.0), 0.32, 20);
    for (let i = 0, n = s.n(6); i < n; i++) s.glint(x + rand(-r, r) * 0.7, y + rand(-r, r) * 0.4, rand(4, 30), rand(14, 22), 0xe8fbff, rand(0.3, 0.5));
    this.combat.decal(T.frostPatch, x, y, r * 2, 0xbfe9ff, 0.4, 2.2, s.gAdd);
    V.sound('shatter', x, y);
  }

  // ─────────────────────────── meteor ───────────────────────────

  meteorImpact(x: number, y: number, r: number, el: number, small: boolean, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const cold = el === EL_COLD;
    const P = pal(cold ? EL_COLD : EL_FIRE);
    const k = small ? 0.55 : 1;
    s.flash(x, y, 14, r * 3.4 * k, cold ? 0xf0fbff : 0xfff0c0, 0.16, 1);
    const fb = s.aAdd.add(T.glow, x, y, 0.45 * k + 0.1);
    fb.z = 20; fb.w0 = r * 1.0; fb.w1 = r * 2.3; fb.se = 3; fb.fo = 0.05; fb.a0 = 1; fb.tintFade(P.hot, P.main);
    s.ring(s.gAdd, T.ringThick, x, y, r * 0.2, r * 1.4, P.main, 0.5 * k + 0.1, 1);
    s.ring(s.aAdd, T.ringHard, x, y, r * 0.4, r * 1.7, 0xffffff, 0.35 * k + 0.08, 0.7, 2);
    // Ground dust shock ring.
    for (let i = 0, n = s.n((small ? 8 : 16)); i < n; i++) {
      const a = (i / n) * TAU + rand(-0.2, 0.2);
      s.dust(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.3, r * 0.45, r * 0.95, cold ? 0xd8eef8 : 0x8a7360, rand(0.6, 0.9), 0.5, Math.cos(a) * 330 * k, Math.sin(a) * 220 * k);
    }
    // Rock debris, some still glowing.
    for (let i = 0, n = s.n(small ? 6 : 16); i < n; i++) {
      const a = rand(0, TAU), sp = rand(100, 330) * k;
      const glowing = i % 3 === 0;
      s.chunk(x, y, 10, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(260, 520) * k, rand(7, 14) * k, glowing ? (cold ? 0xbfefff : 0xff9a3c) : 0x3b302b, rand(1.0, 1.6));
    }
    if (cold) {
      for (let i = 0, n = s.n(small ? 8 : 18); i < n; i++) {
        const a = rand(0, TAU), sp = rand(120, 320) * k;
        const p = s.chunk(x, y, 20, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(160, 360), rand(8, 14) * k, 0xd8f4ff, rand(0.9, 1.3), T.shard[i % 3]);
        p.bounce = 0.25;
      }
      for (let i = 0, n = s.n(small ? 3 : 7); i < n; i++) s.smoke(x + rand(-r, r) * 0.5, y, 10, r * 0.6, r * 1.4, 0xcfefff, rand(1, 1.5), 0.35, 20);
      this.combat.decal(T.frostPatch, x, y, r * 2.4, 0xbfe9ff, 0.55, 3.5, s.gAdd);
    } else {
      for (let i = 0, n = s.n(small ? 6 : 14); i < n; i++) {
        const a = rand(0, TAU), d = rand(0, r * 0.8);
        const f = s.aAdd.add(T.flame, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, rand(0.4, 0.75));
        f.anchorY = 0.85; f.vz = rand(40, 90); f.w0 = rand(20, 34) * k; f.w1 = 5; f.k = 1.5; f.fo = 0.35; f.flick = 0.25;
        f.tintFade(0xffe08a, 0xff4a10);
      }
      for (let i = 0, n = s.n(small ? 8 : 22); i < n; i++) s.ember(x + rand(-r, r) * 0.7, y + rand(-r, r) * 0.3, rand(4, 30), 0xffa040, rand(0.9, 1.6), rand(3, 6), 110);
      for (let i = 0, n = s.n(small ? 2 : 6); i < n; i++) s.smoke(x + rand(-r, r) * 0.4, y, rand(10, 40), r * 0.5 * k + 20, r * 1.3 * k + 30, 0x4e423b, rand(1.1, 1.8), 0.38, rand(50, 90));
      this.combat.decal(T.scorch[(Math.random() * 2) | 0], x, y, r * 2.1 * k, 0x000000, small ? 0.28 : 0.45, small ? 3.5 : 6);
      if (!small) {
        const cr = s.gAdd.add(T.crack[(Math.random() * 2) | 0], x, y, 3.2);
        cr.w0 = cr.w1 = r * 1.7; cr.rotation = rand(0, TAU); cr.a0 = 1; cr.fo = 0.25; cr.tintFade(0xffb040, 0x601000);
      }
    }
    if (!small) V.shakeNear(x, y, mine ? 7 : 5, 240);
    else V.shakeNear(x, y, 2.5, 100);
    V.sound(small ? 'meteor_small' : 'meteor', x, y);
  }

  /** A small meteor that lands after `delay` seconds (Meteor Shower). */
  private smallFall(x: number, y: number, r: number, delay: number, el: number, big: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const cold = el === EL_COLD;
    const P = pal(cold ? EL_COLD : EL_FIRE);
    const fall = Math.min(0.45, delay);
    const start = delay - fall;
    const size = big ? 30 + r * 0.32 : 16 + r * 0.25;
    const rock = s.aBody.hold(T.rock, x, y);
    rock.tintTo(cold ? 0xa8e8ff : 0xffb040);
    const glow = s.aAdd.hold(T.glow, x, y);
    glow.tintTo(P.main);
    let age = 0;
    V.add({
      update: (dt) => {
        age += dt;
        if (age < start) { rock.setAlpha(0); glow.setAlpha(0); return true; }
        const t = clamp((age - start) / fall, 0, 1);
        const rx = x - 160 * (1 - t), rz = 380 * (1 - t);
        rock.place(rx, y, rz); rock.setScale(size); rock.rotation += dt * 7; rock.setAlpha(1);
        glow.place(rx, y, rz); glow.setScale(size * 3); glow.setAlpha(0.8);
        if (Math.random() < 0.8) {
          const f = s.aAdd.add(T.flame, rx + 8, y, 0.2);
          f.z = rz + 12; f.anchorY = 0.6; f.w0 = size; f.w1 = 3; f.k = 1.5; f.fo = 0.2; f.rotation = Math.atan2(-380, 160) + Math.PI / 2;
          f.tintFade(P.hot, P.main);
        }
        if (t >= 1) {
          this.meteorImpact(x, y, r, el, !big, V.isMine(undefined));
          return false;
        }
        return true;
      },
      kill: () => { s.aBody.kill(rock); s.aAdd.kill(glow); },
    });
  }

  // ─────────────────────────── pools ───────────────────────────

  /** A ground pool; with `follow` (entity id) it moves with that entity (following grounds). */
  pool(x: number, y: number, r: number, d: number, kind: 'lava' | 'goo' | 'frost', follow?: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const tex = kind === 'lava' ? T.poolLava : kind === 'goo' ? T.poolGoo : T.frostPatch;
    const layer = kind === 'frost' ? s.gAdd : s.gNormal;
    const base = layer.hold(tex, x, y);
    base.tintTo(kind === 'goo' ? 0x41862a : kind === 'frost' ? 0xbfe9ff : 0xffffff);
    base.rotation = rand(0, TAU);
    const glow = s.gAdd.hold(T.glow, x, y);
    glow.tintTo(kind === 'lava' ? 0xff6a10 : kind === 'goo' ? 0x7fdc4a : 0x7fd8ff);
    const w = r * 2.25;
    let age = 0, acc = 0;
    V.add({
      update: (dt) => {
        age += dt;
        if (follow !== undefined) { const at = V.ctx.entityPos(follow); if (at) { x = at.x; y = at.y; } }
        const fin = clamp(age / 0.25, 0, 1), fout = clamp((d - age) / 0.5, 0, 1);
        const a = Math.min(fin, fout);
        base.place(x, y, 0);
        base.setScale(w * (0.75 + 0.25 * easeOut(fin)));
        base.rotation += dt * 0.05;
        base.setAlpha((kind === 'goo' ? 0.66 : kind === 'frost' ? 0.6 : 0.95) * a);
        glow.place(x, y, 0);
        glow.setScale(w * 1.25);
        glow.setAlpha((kind === 'lava' ? 0.3 : 0.09) * a * (0.85 + 0.15 * Math.sin(age * 3 + x)));
        // Bubbles / embers / gas.
        acc += dt * (r / 9) * s.budget;
        while (acc > 1) {
          acc -= 1;
          const ang = rand(0, TAU), dd = Math.sqrt(Math.random()) * r * 0.8;
          const px = x + Math.cos(ang) * dd, py = y + Math.sin(ang) * dd;
          if (kind === 'lava') {
            const b = s.gAdd.add(T.bubble, px, py, rand(0.3, 0.6));
            b.w0 = 3; b.w1 = rand(8, 14); b.fo = 0.7; b.se = 1; b.tintTo(0xffc060);
            if (Math.random() < 0.5) s.ember(px, py, 2, 0xff8a3d, rand(0.6, 1.1), 4, 70);
          } else if (kind === 'goo') {
            const b = s.gAdd.add(T.bubble, px, py, rand(0.4, 0.7));
            b.w0 = 3; b.w1 = rand(9, 15); b.fo = 0.7; b.se = 1; b.tintTo(0xb6ef6a);
            if (Math.random() < 0.3) s.smoke(px, py, 4, 14, 40, 0x7fbf4a, rand(1, 1.5), 0.22, 18);
          } else if (Math.random() < 0.5) s.glint(px, py, rand(2, 10), 10, 0xe8fbff, 0.4);
        }
        return age < d;
      },
      kill: () => { layer.kill(base); s.gAdd.kill(glow); },
    });
    if (kind === 'lava' && r > 50) V.sound('fireball', x, y, 0.4);
  }

  // ─────────────────────────── black hole ───────────────────────────

  blackhole(x: number, y: number, r: number, d: number, el: number, owner = -1): void {
    const V = this.V, s = V.sys, T = s.T;
    const H: Hole = { owner, x, y, tx: x, ty: y, v: 0, alive: true };
    this.holes.push(H);
    if (this.holes.length > 32) this.holes.shift();
    const cold = el === EL_COLD;
    const main = cold ? 0x7fd8ff : 0xa45cff, hot = cold ? 0xe8fbff : 0xf0d8ff;
    const z = 4;
    const shade = s.gNormal.hold(T.glow, x, y);
    shade.tintTo(0x000000);
    const swirlA = s.gAdd.hold(T.swirl, x, y);
    swirlA.tintTo(main);
    const hole = s.gNormal.hold(T.holeDark, x, y);
    hole.tintTo(0xffffff);
    const rim = s.gAdd.hold(T.ring, x, y);
    rim.tintTo(main);
    const swirlB = s.aAdd.hold(T.swirl, x, y);
    swirlB.tintTo(hot);
    const core = s.aAdd.hold(T.core, x, y);
    core.tintTo(hot);
    const parts: Fx[] = [shade, swirlA, hole, rim, swirlB, core];
    // Motes spiralling inward.
    const N = Math.round(34 * Math.max(0.4, s.budget));
    const motes: { p: Fx; a: number; rr: number; sp: number }[] = [];
    for (let i = 0; i < N; i++) {
      const p = s.aAdd.hold(i % 4 ? T.dot : T.star4, x, y);
      p.tintTo(i % 3 ? main : hot);
      motes.push({ p, a: rand(0, TAU), rr: rand(0.2, 1.15) * r, sp: rand(0.7, 1.3) });
    }
    let age = 0;
    V.sound('blackhole', x, y);
    V.add({
      update: (dt) => {
        age += dt;
        // Wandering Void: glide toward the latest `blackhole_at` point (arrives in about one server step)
        if (H.v > 0) {
          const dx = H.tx - x, dy = H.ty - y, dist = Math.hypot(dx, dy), step = H.v * dt;
          if (dist <= step) { x = H.tx; y = H.ty; H.v = 0; } else { x += (dx / dist) * step; y += (dy / dist) * step; }
          H.x = x; H.y = y;
        }
        const open = easeOut(clamp(age / 0.25, 0, 1));
        const collapse = clamp((age - (d - 0.18)) / 0.18, 0, 1);
        const sc = open * (1 - easeIn(collapse) * 0.9);
        shade.place(x, y, 0); shade.setScale(r * 2.8 * sc); shade.setAlpha(0.55);
        swirlA.place(x, y, z); swirlA.setScale(r * 2.3 * sc); swirlA.rotation -= dt * 3.2; swirlA.setAlpha(0.75);
        hole.place(x, y, z); hole.setScale(r * 1.05 * sc * (1 + 0.04 * Math.sin(age * 9))); hole.setAlpha(1);
        rim.place(x, y, z); rim.setScale(r * 1.2 * sc); rim.setAlpha(0.85 + 0.15 * Math.sin(age * 12));
        swirlB.place(x, y, z + 2); swirlB.setScale(r * 1.3 * sc); swirlB.rotation -= dt * 6.5; swirlB.setAlpha(0.45);
        core.place(x, y, z + 2); core.setScale(14 * sc + 6 * Math.sin(age * 20)); core.setAlpha(0.9);
        for (const m of motes) {
          m.rr -= dt * (40 + (r - m.rr) * 1.3) * m.sp;
          m.a -= dt * (2.2 + 140 / Math.max(14, m.rr)) * m.sp;
          if (m.rr < 10) { m.rr = r * rand(0.95, 1.2); m.a = rand(0, TAU); }
          const fade = clamp((m.rr - 10) / 30, 0, 1) * clamp((r * 1.2 - m.rr) / 30, 0, 1);
          m.p.place(x + Math.cos(m.a) * m.rr * sc, y + Math.sin(m.a) * m.rr * sc, z + 3);
          m.p.setScale(4 + m.rr / r * 6);
          m.p.setAlpha(fade * (1 - collapse));
        }
        if (Math.random() < 0.6 * s.budget) {
          // Streaks being sucked in.
          const a = rand(0, TAU), rr = r * rand(0.9, 1.3);
          const sp = s.aAdd.add(T.spark, x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.3);
          sp.vx = -Math.cos(a) * rr * 2.6; sp.vy = -Math.sin(a) * rr * 2.6; sp.align = true; sp.z = z + 3;
          sp.w0 = 18; sp.w1 = 4; sp.k = 0.4; sp.fo = 0.5; sp.tintTo(hot);
        }
        if (age >= d) {
          s.flash(x, y, 10, r * 2.2, hot, 0.16, 1);
          s.ring(s.gAdd, T.ring, x, y, r * 0.1, r * 1.0, main, 0.3, 0.8);
          for (let i = 0, n = s.n(16); i < n; i++) s.spark(x, y, 10, rand(0, TAU), rand(160, 360), 12, i % 2 ? hot : main, 0.3);
          if (cold) this.iceBurst(x, y, r * 0.6);
          return false;
        }
        return true;
      },
      kill: () => {
        H.alive = false;
        const i = this.holes.indexOf(H);
        if (i >= 0) this.holes.splice(i, 1);
        for (const p of parts) s.aAdd.kill(p);
        for (const m of motes) s.aAdd.kill(m.p);
      },
    });
  }

  /** Black Hole · Wandering Void: the owner's nearest live hole glides to (x, y) over `secs`. */
  private blackholeAt(owner: number, x: number, y: number, secs: number): void {
    let best: Hole | null = null, bd = Infinity;
    for (const h of this.holes) {
      if (!h.alive || h.owner !== owner) continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bd) { bd = d; best = h; }
    }
    if (!best || bd > 600) return;
    best.tx = x; best.ty = y; best.v = Math.max(20, bd / secs);
  }

  // ─────────────────────────── frost nova ───────────────────────────

  nova(x: number, y: number, r: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    void el;
    const exp = 0.28;
    s.flash(x, y, 20, r * 1.4, 0xe8fbff, 0.16, 1);
    s.ring(s.gAdd, T.ringThick, x, y, r * 0.1, r, 0x7fd8ff, exp + 0.25, 1);
    s.ring(s.aAdd, T.ringHard, x, y, r * 0.1, r * 1.03, 0xffffff, exp + 0.12, 0.9, 2);
    this.combat.decal(T.frostPatch, x, y, r * 2.15, 0x9fdcff, 0.32, 2.2, s.gAdd);
    this.combat.decal(T.frostPatch, x, y, r * 2.1, 0xe6f6ff, 0.22, 2.6);
    // Shards racing outward with the ring.
    for (let i = 0, n = s.n(26); i < n; i++) {
      const a = (i / 26) * TAU + rand(-0.1, 0.1);
      const sp = r / exp * rand(0.8, 1.05);
      const p = s.aBody.add(T.shard[i % 3], x, y, rand(0.45, 0.7));
      p.z = rand(6, 24); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp * 0.8; p.drag = 4.5; p.gz = 220;
      p.w0 = rand(9, 15); p.w1 = 6; p.fo = 0.55; p.rotation = a + Math.PI / 2; p.vr = rand(-4, 4);
      p.tintTo(i % 3 ? 0xdff6ff : 0x9fd8ff);
    }
    // Crystal spikes erupting along the ring as it passes.
    const spikes = Math.round(clamp(r / 9, 10, 24) * s.budget);
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * TAU + rand(-0.12, 0.12);
      const rr = r * rand(0.82, 1.0);
      V.after(exp * (rr / r), () => {
        const sx = x + Math.cos(a) * rr, sy = y + Math.sin(a) * rr;
        const p = s.aBody.add(T.spike[i % 2], sx, sy, rand(0.9, 1.3));
        p.anchorY = 0.95; p.w0 = rand(10, 14); p.w1 = rand(20, 30); p.se = 3; p.k = 1; p.fi = 0.04; p.fo = 0.7;
        p.tintTo(0xcff2ff);
        s.glint(sx, sy, rand(8, 20), 12, 0xffffff, 0.3);
        if (Math.random() < 0.4) s.smoke(sx, sy, 4, 18, 40, 0xdff4ff, 0.8, 0.25, 10);
      });
    }
    for (let i = 0, n = s.n(10); i < n; i++) {
      const a = rand(0, TAU), d = rand(0.3, 1) * r;
      const f = s.aAdd.add(T.flake, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, rand(0.9, 1.5));
      f.z = rand(10, 50); f.vz = -10; f.vx = rand(-10, 10); f.w0 = rand(8, 13); f.w1 = 6; f.vr = rand(-2, 2); f.fi = 0.2; f.fo = 0.5;
      f.tintTo(0xe8fbff);
    }
    V.shakeNear(x, y, mine ? 3 : 2, 110);
    V.sound('nova', x, y);
  }

  // ─────────────────────────── warrior ───────────────────────────

  stomp(x: number, y: number, r: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const fire = el === EL_FIRE;
    s.flash(x, y, 8, r * 1.2, fire ? 0xffb050 : 0xfff2d8, 0.12, fire ? 0.9 : 0.5);
    s.ring(s.gNormal, T.ringThick, x, y, r * 0.15, r * 1.05, 0x3a2e24, 0.42, 0.45);
    s.ring(s.gAdd, T.ringHard, x, y, r * 0.15, r * 1.02, fire ? 0xff8a3d : 0xffe9c0, 0.3, 0.6);
    for (let i = 0, n = s.n(18); i < n; i++) {
      const a = (i / 18) * TAU + rand(-0.15, 0.15);
      s.dust(x + Math.cos(a) * 14, y + Math.sin(a) * 10, r * 0.25, r * 0.6, 0x9c8a70, rand(0.5, 0.8), 0.32, Math.cos(a) * r * 3.2 * rand(0.8, 1.1), Math.sin(a) * r * 2.4 * rand(0.8, 1.1));
    }
    for (let i = 0, n = s.n(10); i < n; i++) {
      const a = rand(0, TAU), sp = rand(60, 180);
      s.chunk(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.2, 2, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(220, 420), rand(6, 11), i % 2 ? 0x8a7a66 : 0x6a5a4a, rand(0.8, 1.2));
    }
    const cr = s.gNormal.add(T.crack[(Math.random() * 2) | 0], x, y, 2.6);
    cr.w0 = r * 1.0; cr.w1 = r * 1.2; cr.se = 3; cr.rotation = rand(0, TAU); cr.a0 = 0.42; cr.fo = 0.5; cr.tintTo(0x241a12);
    if (fire) {
      const g = s.gAdd.add(T.crack[0], x, y, 1.8);
      g.w0 = r * 1.2; g.w1 = r * 1.5; g.se = 3; g.rotation = cr.rotation; g.a0 = 1; g.fo = 0.3; g.tintFade(0xffb040, 0x801800);
      for (let i = 0, n = s.n(16); i < n; i++) s.ember(x + rand(-r, r) * 0.7, y + rand(-r, r) * 0.4, 2, 0xff8a3d, rand(0.7, 1.2), 5, 90);
    }
    V.shakeNear(x, y, mine ? 5 : 3, 160);
    V.sound('stomp', x, y);
  }

  rend(x: number, y: number, r: number, el: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const col = el === EL_PHYS ? 0xff3046 : pal(el).main;
    const base = rand(0, TAU);
    for (let i = 0; i < 3; i++) {
      V.after(i * 0.045, () => {
        this.slashes.spawn({ tex: T.swipeThin, x, y, z: WAIST - 6 + i * 6, r: r * (0.8 + i * 0.1), rot: base + i * 2.1, vr: 11, life: 0.24, color: i === 1 ? 0xff8090 : col, alpha: 1, grow: [0.8, 1.05], squash: 0.55 });
      });
    }
    for (let i = 0, n = s.n(16); i < n; i++) {
      const a = rand(0, TAU), d = rand(0.4, 0.9) * r;
      const p = s.aBody.add(T.drip, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, rand(0.5, 0.8));
      p.z = rand(10, 30); p.vx = Math.cos(a) * rand(40, 120); p.vy = Math.sin(a) * rand(20, 60); p.vz = rand(60, 160); p.gz = 600;
      p.w0 = rand(4, 7); p.w1 = 3; p.align = true; p.fo = 0.6; p.k = 1.2;
      p.tintTo(0xb81c30);
    }
    s.flash(x, y, WAIST, r * 1.1, 0xff5060, 0.14, 0.45);
    V.sound('rend', x, y);
  }

  fissure(x: number, y: number, r: number, a: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const fire = el === EL_FIRE, cold = el === EL_COLD;
    const half = Math.PI / 6;
    const rows = Math.max(3, Math.round(r / 38));
    const spikeCol = cold ? 0xcff2ff : fire ? 0x5a4436 : 0x9c7b52;
    for (let i = 0; i < rows; i++) {
      const d = 34 + (i / (rows - 1)) * (r - 34);
      const width = d * Math.tan(half);
      const lat = 1 + Math.floor(width / 52);
      V.after(i * 0.032, () => {
        for (let j = 0; j < lat; j++) {
          const off = lat === 1 ? 0 : (j / (lat - 1) - 0.5) * 2 * width * 0.8;
          const px = x + Math.cos(a) * d - Math.sin(a) * off + rand(-6, 6);
          const py = y + Math.sin(a) * d + Math.cos(a) * off + rand(-6, 6);
          const sp = s.aBody.add(T.spike[(i + j) % 2], px, py, rand(0.55, 0.8));
          sp.anchorY = 0.95; sp.w0 = 5; sp.w1 = rand(18, 26) * (0.85 + d / r * 0.4); sp.se = 3; sp.fo = 0.5; sp.fi = 0.02;
          sp.tintTo(spikeCol);
          s.dust(px, py, 22, 60, cold ? 0xdff4ff : 0x9c8a70, rand(0.6, 0.9), 0.4, rand(-30, 30), rand(-20, 20));
          s.smoke(px, py, 10, 16, 46, cold ? 0xdff4ff : 0xa89070, rand(0.5, 0.8), 0.3, 40);
          if (Math.random() < 0.6) s.chunk(px, py, 4, rand(-60, 60), rand(-30, 30), rand(180, 320), rand(5, 9), cold ? 0xd8f4ff : 0x6a5a4a, 0.8);
          if (fire) { s.ember(px, py, 6, 0xff8a3d, rand(0.5, 0.9), 5, 90); const g = s.gAdd.add(T.glow, px, py, 0.5); g.w0 = 30; g.w1 = 40; g.a0 = 0.5; g.fo = 0.3; g.k = 0.6; g.tintTo(0xff6a10); }
          if (cold) s.glint(px, py, 14, 12, 0xffffff, 0.3);
        }
        if (i % 2 === 0) {
          const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
          const cr = (fire ? s.gAdd : s.gNormal).add(T.crack[i % 2], cx, cy, 2.4);
          cr.w0 = cr.w1 = Math.max(60, width * 1.5); cr.rotation = rand(0, TAU); cr.a0 = fire ? 0.85 : 0.38; cr.fo = 0.5;
          if (fire) cr.tintFade(0xffb040, 0x801800); else cr.tintTo(cold ? 0x9fc8e0 : 0x241a12);
        }
      });
    }
    V.shakeNear(x, y, mine ? 4 : 3, 150);
    V.sound('slam', x, y);
  }

  /** Whirlwind tick: a spinning motion-blur ring around the caster plus kicked-up dust. */
  whirl(x: number, y: number, r: number, el: number): void {
    const s = this.V.sys, T = s.T;
    const col = el === EL_FIRE ? 0xff9a4a : el === EL_PHYS ? 0xfff2dc : pal(el).main;
    this.slashes.spawn({ tex: T.whirl, x, y, z: WAIST, r: r * 0.95, rot: rand(0, TAU), vr: 16, life: 0.3, color: col, alpha: 0.42, grow: [0.95, 1.05], fadeIn: 0.15 });
    for (let i = 0, n = s.n(2); i < n; i++) {
      const a = rand(0, TAU);
      s.dust(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.5, 16, 40, 0xc9b597, rand(0.4, 0.6), 0.32, -Math.sin(a) * 120, Math.cos(a) * 80);
    }
    if (el === EL_FIRE) for (let i = 0; i < 2; i++) s.ember(x + rand(-r, r) * 0.6, y, 10, 0xff8a3d, 0.6, 5, 60);
  }

  /** Cleave arc toward angle `a` (radius r). `skin`: the attacker's weapon presentation (gear V2 pass 2.1): a physical
   *  arc takes the weapon's light and strongly lit weapons add a thin bright inner arc; the radius never changes. */
  cleave(x: number, y: number, r: number, a: number, el: number, wide: boolean, skin: WeaponSkin | null = null): void {
    const V = this.V, s = V.sys, T = s.T;
    const light = el === EL_LIGHT;
    const col = light ? 0xb9a2ff : el === EL_FIRE ? 0xff9a4a : skin ? lerpColor(0xfff0d8, skin.light, Math.min(0.5, 0.18 + 0.16 * skin.strength)) : 0xfff0d8;
    const sweep = 0.9, life = 0.2;
    // Swing from the back of the arc through the target direction (the bright head ends just past `a`).
    const dir = Math.cos(a) >= 0 ? 1 : -1;
    this.slashes.spawn({ tex: wide ? T.swipeWide : T.swipe, x, y, z: WAIST, r, rot: a - dir * sweep * 0.65, vr: (dir * sweep) / life, life, color: col, alpha: 1, grow: [0.9, 1.04], fadeIn: 0.08 });
    if (skin && skin.strength >= 0.8) this.slashes.spawn({ tex: T.swipeThin, x, y, z: WAIST + 2, r: r * 0.93, rot: a - dir * sweep * 0.6, vr: (dir * sweep) / (life * 1.1), life: life * 1.1, color: skin.edge || skin.core, alpha: Math.min(0.8, 0.35 + 0.22 * skin.strength), grow: [0.88, 1.02], fadeIn: 0.1 });
    const tipA = a + dir * 0.25;
    for (let i = 0, n = s.n(5); i < n; i++) {
      const rr = r * rand(0.7, 1);
      s.spark(x + Math.cos(tipA) * rr, y + Math.sin(tipA) * rr * 0.62, WAIST, tipA + dir * Math.PI / 2 + rand(-0.4, 0.4), rand(160, 300), 12, light ? 0xe6dcff : 0xfff4d0, 0.18);
    }
    if (light) for (let i = 0; i < 3; i++) {
      const aa = a + rand(-0.8, 0.8), rr = r * rand(0.6, 1);
      this.combat.zigzag(x + Math.cos(aa) * rr * 0.5, y + Math.sin(aa) * rr * 0.5 * 0.62 - WAIST, aa, rr * 0.6, 0xe6dcff, 0.14);
    }
    V.sound('cleave', x, y, V.isMine(undefined) ? 1 : 0.5);
  }

  chainZap(x: number, y: number, r: number): void {
    const s = this.V.sys;
    s.flash(x, y, 24, Math.max(40, r * 1.4), 0xd6c2ff, 0.12, 0.9);
    for (let i = 0; i < 3; i++) this.combat.zigzag(x, y - 24, rand(0, TAU), rand(16, 30), 0xe6dcff, 0.12);
    for (let i = 0, n = s.n(5); i < n; i++) s.spark(x, y, 24, rand(0, TAU), rand(140, 260), 10, 0xb9a2ff, 0.2);
  }

  dustdevil(x: number, y: number, r: number): void {
    const s = this.V.sys, T = s.T;
    const sw = s.aSmoke.add(T.swirl, x, y, 0.45);
    sw.z = 16; sw.w0 = r * 0.8; sw.w1 = r * 1.8; sw.se = 1; sw.vr = -10; sw.a0 = 0.45; sw.fo = 0.3; sw.k = 0.7;
    sw.tintTo(0xb8a284);
    for (let i = 0, n = s.n(4); i < n; i++) {
      const a = rand(0, TAU);
      s.dust(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.3, 14, 36, 0xc9b597, rand(0.4, 0.7), 0.4, Math.cos(a) * 90, Math.sin(a) * 60);
    }
    for (let i = 0, n = s.n(3); i < n; i++) s.spark(x, y, 18, rand(0, TAU), rand(100, 200), 10, 0xfff0d0, 0.16);
  }

  /** Monster slam impact (also the payoff of the `slam` telegraph). */
  slam(x: number, y: number, r: number, el: number, scale: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const P = pal(el);
    s.flash(x, y, 6, r * 1.3, el === EL_PHYS ? 0xfff2d8 : P.hot, 0.12, 0.55);
    s.ring(s.gNormal, T.ringThick, x, y, r * 0.2, r * 1.05, 0x2e2418, 0.38, 0.45);
    s.ring(s.gAdd, T.ringHard, x, y, r * 0.2, r, el === EL_PHYS ? 0xffd8a0 : P.main, 0.26, 0.7);
    for (let i = 0, n = s.n(12 * scale); i < n; i++) {
      const a = (i / 12) * TAU + rand(-0.2, 0.2);
      s.dust(x + Math.cos(a) * 10, y + Math.sin(a) * 8, r * 0.25, r * 0.55, el === EL_POISON ? 0x6f9e40 : 0x8f7d64, rand(0.45, 0.7), 0.3, Math.cos(a) * r * 2.6, Math.sin(a) * r * 2);
    }
    for (let i = 0, n = s.n(6 * scale); i < n; i++) {
      const a = rand(0, TAU), sp = rand(60, 160);
      s.chunk(x, y, 4, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(200, 360), rand(5, 9), el === EL_POISON ? 0x7fce4a : 0x7a6a56, rand(0.7, 1.1), el === EL_POISON ? T.dot : undefined);
    }
    const cr = s.gNormal.add(T.crack[(Math.random() * 2) | 0], x, y, 2);
    cr.w0 = r * 0.95; cr.w1 = r * 1.15; cr.se = 3; cr.rotation = rand(0, TAU); cr.a0 = 0.38; cr.fo = 0.5; cr.tintTo(0x241a12);
    if (el === EL_FIRE) for (let i = 0, n = s.n(10); i < n; i++) s.ember(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.4, 2, 0xff8a3d, rand(0.6, 1), 5, 80);
    if (el === EL_POISON) this.combat.decal(T.poolGoo, x, y, r * 1.2, 0x3f7a26, 0.45, 2.5);
    V.shakeNear(x, y, r >= 110 ? 6 : 3, r >= 110 ? 200 : 120);
    V.sound('slam', x, y, r >= 110 ? 1 : 0.6);
  }

  /** The caster's Cleave flourish draws the arc toward its target; remember it so the matching aoe is not drawn twice. */
  noteCleave(x: number, y: number, a: number): void {
    this.cleaves.push({ x, y, a, t: this.V.real });
    if (this.cleaves.length > 8) this.cleaves.shift();
  }

  private consumeCleave(x: number, y: number, a: number): boolean {
    for (let i = this.cleaves.length - 1; i >= 0; i--) {
      const c = this.cleaves[i];
      if (this.V.real - c.t > 0.15) continue;
      if (Math.abs(c.x - x) < 40 && Math.abs(c.y - y) < 40 && Math.abs(angDiff(c.a, a)) < 0.6) { this.cleaves.splice(i, 1); return true; }
    }
    return false;
  }

  // ─────────────────────────── warrior M1: Tolling Blow ───────────────────────────

  /** A heavy downward blow landing on the target: a falling streak, a dull ring of dust and a short crack. */
  tollBlow(x: number, y: number, r: number, a: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const fire = el === EL_FIRE;
    const hot = fire ? 0xffc27a : 0xfff0cc, main = fire ? 0xff7a1a : 0xd9b45a;
    // The weapon's path: a bright streak coming straight down onto the target, leaning with the swing.
    const st = s.aAdd.add(T.streak, x - Math.cos(a) * 6, y, 0.12);
    st.z = 12; st.rotation = Math.PI / 2 - Math.cos(a) * 0.18; st.anchorX = 0.94; st.w0 = 78; st.w1 = 46; st.k = 0.55; st.a0 = 0.85; st.fo = 0.15;
    st.tintTo(hot);
    s.flash(x, y, 16, r * 1.5, hot, 0.09, 0.55);
    s.ring(s.gAdd, T.ringHard, x, y, r * 0.2, r * 1.15, main, 0.22, 0.75);
    s.ring(s.gNormal, T.ringThick, x, y, r * 0.2, r * 1.05, 0x2e2418, 0.32, 0.38);
    for (let i = 0, n = s.n(6); i < n; i++) s.spark(x, y, 10, rand(-Math.PI, 0) + (i % 2 ? 0.4 : -0.4), rand(150, 280), 11, i % 2 ? hot : main, 0.2, 700);
    for (let i = 0, n = s.n(6); i < n; i++) {
      const aa = (i / 6) * TAU + rand(-0.3, 0.3);
      s.dust(x + Math.cos(aa) * 8, y + Math.sin(aa) * 5, 14, 34, 0xa8946f, rand(0.4, 0.6), 0.36, Math.cos(aa) * 130, Math.sin(aa) * 90);
    }
    const cr = s.gNormal.add(T.crack[(Math.random() * 2) | 0], x, y, 1.3);
    cr.w0 = r * 1.2; cr.w1 = r * 1.45; cr.se = 3; cr.rotation = rand(0, TAU); cr.a0 = 0.32; cr.fo = 0.4; cr.tintTo(0x241a12);
    if (fire) for (let i = 0, n = s.n(5); i < n; i++) s.ember(x + rand(-r, r) * 0.5, y, 6, 0xff8a3d, rand(0.5, 0.8), 4, 70);
    V.shakeNear(x, y, mine ? 2 : 1, 70);
    V.sound('tollblow', x, y, mine ? 1 : 0.5);
  }

  /** The toll: bronze ripple rings rolling out to the stun radius and a small bell ringing above the spot. */
  toll(x: number, y: number, r: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const fire = el === EL_FIRE;
    const bronze = fire ? 0xff8a3d : 0xd9a63a, hot = fire ? 0xffd8a0 : 0xfff0b8;
    for (let i = 0; i < 3; i++) {
      V.after(i * 0.1, () => {
        s.ring(s.gAdd, T.ringHard, x, y, r * 0.15, r * (1 + i * 0.07), i === 0 ? hot : bronze, 0.44, 0.95 - i * 0.22);
        s.ring(s.gAdd, T.ring, x, y, r * 0.1, r * (0.92 + i * 0.07), bronze, 0.4, 0.4 - i * 0.1);
      });
    }
    s.ring(s.gNormal, T.ringThick, x, y, r * 0.15, r * 1.05, 0x2a2010, 0.5, 0.3);
    s.glow(x, y, 0, r * 0.9, r * 2.1, bronze, 0.32, 0.3, s.gAdd);
    s.flash(x, y, 22, r * 0.9, hot, 0.1, 0.45);
    for (let i = 0, n = s.n(10); i < n; i++) {
      const aa = (i / 10) * TAU + rand(-0.2, 0.2);
      s.dust(x + Math.cos(aa) * r * 0.25, y + Math.sin(aa) * r * 0.18, 14, 36, 0xb39d78, rand(0.45, 0.7), 0.3, Math.cos(aa) * r * 2.6, Math.sin(aa) * r * 1.9);
    }
    for (let i = 0, n = s.n(4); i < n; i++) s.glint(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.35, rand(6, 22), 14, hot, 0.35, 0.8);
    if (fire) for (let i = 0, n = s.n(10); i < n; i++) s.ember(x + rand(-r, r) * 0.7, y + rand(-r, r) * 0.4, 4, 0xff8a3d, rand(0.6, 1), 4, 90);
    this.bellGlyph(x, y, fire);
    V.sound('toll', x, y, mine ? 1 : 0.5);
  }

  /** A small bronze bell popping up above the toll, swinging and sending out sound-wave arcs. */
  private bellGlyph(x: number, y: number, fire: boolean): void {
    const V = this.V;
    const root = new Container();
    const waves = new Sprite(waveTex());
    waves.anchor.set(0.5); waves.blendMode = 'add'; waves.tint = fire ? 0xffa050 : 0xffd36a; waves.position.set(0, 12);
    const bell = new Sprite(bellTex());
    bell.anchor.set(0.5, 0.06);
    if (fire) bell.tint = 0xffc8a0;
    root.addChild(waves, bell);
    this.high.addChild(root);
    const life = 0.8, z0 = 84;
    let age = 0;
    const place = () => {
      const t = clamp(age / life, 0, 1);
      const pop = easeOutBack(clamp(age / 0.16, 0, 1));
      root.position.set(x, y - z0 - 8 * t);
      bell.scale.set(1.2 * pop);
      bell.rotation = 0.5 * Math.exp(-age * 3.4) * Math.sin(age * 16);
      const ring = preferences.get().values.reduceFlashes ? 0.85 : 0.65 + 0.35 * Math.abs(Math.cos(age * 16));
      waves.scale.set(0.95 + 0.8 * t, 0.95 + 0.6 * t);
      waves.alpha = (1 - t) * ring;
      root.alpha = 1 - clamp((t - 0.65) / 0.35, 0, 1);
    };
    place();
    V.add({
      update: (dt) => { age += dt; place(); return age < life; },
      kill: () => root.destroy({ children: true }),
    });
  }

  // ─────────────────────────── warrior M1: Sawtooth Hatchet ───────────────────────────

  /**
   * A spinning serrated hatchet: out `ev.r` units along `ev.a` at WARRIOR_FX.hatchetSpeed, grinding in place for
   * `ev.d` ms (hold, 0 = none), then home to the owner's CURRENT position. `hatchet3` (Grinning Saw) then flies out
   * again along the same angle from the owner and comes home a second time. Several can fly at once.
   */
  private hatchet(ev: Aoe, thrice: boolean, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const fire = ev.el === EL_FIRE;
    const speed = WARRIOR_FX.hatchetSpeed;
    const a = ev.a ?? 0, ux = Math.cos(a), uy = Math.sin(a);
    const out = Math.max(20, ev.r), hold = Math.max(0, ev.d) / 1000;
    const owner = ev.s;
    const H: Hatchet = { owner: owner ?? -1, x: ev.x, y: ev.y, leg: 0, seek: null, done: false };
    this.hatchets.push(H);
    const holder = new Container();
    holder.scale.set(1, 0.68); // spin in the ground plane: a level ellipse, like the whirlwind ring
    const blur = new Sprite(T.whirl);
    blur.anchor.set(0.5); blur.blendMode = 'add'; blur.tint = fire ? 0xff8a3d : 0xe0301e; blur.width = blur.height = 72;
    const axe = new Sprite(hatchetTex());
    axe.anchor.set(0.66, 0.6); axe.scale.set(1.6);
    holder.addChild(blur, axe);
    this.high.addChild(holder);
    const shadow = s.gNormal.hold(T.shadow, ev.x, ev.y);
    shadow.tintTo(0x000000);
    const vol = mine ? 1 : 0.5;
    V.sound('hatchet_out', ev.x, ev.y, vol);
    let sx = ev.x, sy = ev.y, legT = 0, age = 0, spin = rand(0, TAU), acc = 0, grind = 0, z = 24;
    let hd = a; // heading on the way home (turns smoothly through a seek point)
    const home = () => (owner !== undefined ? V.ctx.entityPos(owner) : null) ?? { x: ev.x, y: ev.y };
    const goBack = () => { H.leg = H.leg === 3 ? 4 : 2; legT = 0; hd = Math.atan2(home().y - H.y, home().x - H.x); V.sound('hatchet_back', H.x, H.y, vol * 0.9); };
    V.add({
      update: (dt) => {
        age += dt; legT += dt;
        if (age > 8) return false;
        const ox = H.x, oy = H.y, step = speed * dt;
        let prog = 0;
        if (H.leg === 0 || H.leg === 3) {
          const tx = sx + ux * out, ty = sy + uy * out;
          const d = Math.hypot(tx - H.x, ty - H.y);
          prog = 1 - d / out;
          if (d <= step) {
            H.x = tx; H.y = ty;
            if (H.leg === 0 && hold > 0) { H.leg = 1; legT = 0; } else goBack();
          } else { H.x += ((tx - H.x) / d) * step; H.y += ((ty - H.y) / d) * step; }
        } else if (H.leg === 1) {
          if (legT >= hold) goBack();
          grind -= dt;
          if (grind <= 0) {
            grind = 0.035;
            for (let i = 0, n = s.n(2); i < n; i++) s.spark(H.x, H.y, z, rand(0, TAU), rand(160, 320), 14, fire ? 0xffb050 : Math.random() < 0.5 ? 0xffe2b0 : 0xffffff, 0.22, 520);
            if (Math.random() < 0.45) this.bloodFleck(H.x, H.y, z, fire);
            if (Math.random() < 0.3) s.glow(H.x, H.y, z, 30, 56, fire ? 0xff8a3d : 0xff5a3a, 0.12, 0.35);
          }
        } else {
          const h = home();
          let tx = h.x, ty = h.y;
          if (H.seek) {
            if (Math.hypot(H.seek.x - H.x, H.seek.y - H.y) < 26) H.seek = null;
            else { tx = H.seek.x; ty = H.seek.y; }
          }
          const d = Math.hypot(tx - H.x, ty - H.y);
          if (!H.seek && d <= Math.max(step, 18)) {
            if (thrice && H.leg === 2) { H.leg = 3; legT = 0; sx = h.x; sy = h.y; H.x = h.x; H.y = h.y; V.sound('hatchet_out', h.x, h.y, vol); }
            else { this.hatchetCaught(h.x, h.y, fire); return false; }
          } else {
            const want = Math.atan2(ty - H.y, tx - H.x);
            const turn = d < 70 ? Math.PI : 11 * dt;
            hd += clamp(angDiff(hd, want), -turn, turn);
            H.x += Math.cos(hd) * step; H.y += Math.sin(hd) * step;
          }
        }
        // soft arc on the outward flights, a little bob while grinding
        z = H.leg === 0 || H.leg === 3 ? 24 + 10 * Math.sin(Math.PI * clamp(prog, 0, 1)) : H.leg === 1 ? 22 + Math.sin(age * 30) * 1.5 : 24;
        spin += dt * (H.leg === 1 ? 34 : 25);
        holder.position.set(H.x, H.y - z);
        holder.alpha = clamp(age / 0.04, 0, 1);
        axe.rotation = spin;
        blur.rotation = spin * 0.5;
        blur.alpha = H.leg === 1 ? 0.7 : 0.55;
        shadow.place(H.x, H.y, 0); shadow.setScale(36, 0.5); shadow.setAlpha(0.34);
        // red smear trail along the path
        const moved = Math.hypot(H.x - ox, H.y - oy);
        acc += moved;
        const every = 9 / Math.max(0.35, s.budget);
        while (acc >= every && moved > 0.01) {
          acc -= every;
          const f = 1 - acc / moved;
          const px = ox + (H.x - ox) * clamp(f, 0, 1), py = oy + (H.y - oy) * clamp(f, 0, 1);
          const ang = Math.atan2(H.y - oy, H.x - ox);
          // the smear: a soft dark-red ribbon (normal blend) with a hot additive core
          const sm = s.aSmoke.add(T.glow, px, py, 0.32);
          sm.z = z; sm.rotation = ang; sm.w0 = 34; sm.w1 = 12; sm.k = 0.5; sm.a0 = fire ? 0.4 : 0.6; sm.fo = 0.15; sm.se = 1;
          sm.tintTo(fire ? 0x8a3a12 : 0x8e1612);
          const gl = s.aAdd.add(T.streak, px, py, 0.2);
          gl.z = z; gl.rotation = ang; gl.anchorX = 0.85; gl.w0 = 40; gl.w1 = 22; gl.k = 1.6; gl.a0 = 0.5; gl.fo = 0.1;
          gl.tintTo(fire ? 0xff8a3d : 0xff3a2a);
          if (Math.random() < (fire ? 0.3 : 0.18)) {
            if (fire) s.ember(px, py, z, 0xff8a3d, rand(0.4, 0.7), 4, 30);
            else this.bloodFleck(px, py, z, false);
          }
        }
        return true;
      },
      kill: () => {
        H.done = true;
        const i = this.hatchets.indexOf(H);
        if (i >= 0) this.hatchets.splice(i, 1);
        holder.destroy({ children: true });
        s.gNormal.kill(shadow);
      },
    });
  }

  /** Seeking Return: the owner's returning hatchet bends through this point on its way home (best effort). */
  private hatchetSeek(ev: Aoe): void {
    let best: Hatchet | null = null, bd = Infinity;
    for (const h of this.hatchets) {
      if (h.done || h.owner !== (ev.s ?? -1) || h.seek) continue;
      // prefer one already flying home; one still out / grinding takes it for its return leg
      const d = Math.hypot(h.x - ev.x, h.y - ev.y) + (h.leg === 2 || h.leg === 4 ? 0 : 400);
      if (d < bd) { bd = d; best = h; }
    }
    if (best) best.seek = { x: ev.x, y: ev.y };
  }

  private hatchetCaught(x: number, y: number, fire: boolean): void {
    const s = this.V.sys;
    s.flash(x, y, 30, 34, fire ? 0xffb070 : 0xffd0c0, 0.09, 0.55);
    s.glint(x, y, 30, 18, fire ? 0xffc080 : 0xfff0e0, 0.22, 0.8);
  }

  private bloodFleck(x: number, y: number, z: number, fire: boolean): void {
    const s = this.V.sys;
    const p = s.aBody.add(s.T.drip, x, y, rand(0.4, 0.6));
    p.z = z; p.vx = rand(-60, 60); p.vy = rand(-30, 30); p.vz = rand(40, 110); p.gz = 600;
    p.w0 = rand(3.5, 5.5); p.w1 = 2.5; p.align = true; p.fo = 0.6; p.k = 1.2;
    p.tintTo(fire ? 0xd85a20 : 0xa8161e);
  }

  // ─────────────────────────── warrior M1: Muster Standard ───────────────────────────

  /**
   * A tall pole flying a madder-red banner with a hearth sigil (cloth ripples on a mesh), a faint ground ring of
   * radius r, for `ev.d` ms. `carry` (Marching Orders): it follows the owner, trailing beside / behind the hero.
   */
  private standard(ev: Aoe, carry: boolean, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const fire = ev.el === EL_FIRE;
    const r = Math.max(40, ev.r);
    let life = Math.max(0.6, ev.d / 1000);
    const owner = ev.s ?? -1;
    const root = new Container();
    const flag = new Container();
    const cloth = new MeshPlane({ texture: clothTex(), verticesX: CLOTH_VX, verticesY: CLOTH_VY });
    cloth.autoResize = false;
    const pole = new Sprite(poleTex());
    pole.anchor.set(0.5, 1);
    flag.addChild(cloth);
    flag.position.set(1.2, -POLE_H + 12);
    root.addChild(flag, pole);
    const k = carry ? 0.78 : 1;
    root.scale.set(k);
    this.low.addChild(root);
    const ringA = s.gAdd.hold(T.ringHard, ev.x, ev.y);
    ringA.tintTo(fire ? 0xff7a2a : 0xd8583a);
    const ringB = s.gAdd.hold(T.ring, ev.x, ev.y);
    ringB.tintTo(fire ? 0xffa040 : 0xe0a24a);
    const shadow = s.gNormal.hold(T.shadow, ev.x, ev.y);
    shadow.tintTo(0x000000);
    const parts: [typeof s.gAdd, Fx][] = [[s.gAdd, ringA], [s.gAdd, ringB], [s.gNormal, shadow]];
    const posBuf = cloth.geometry.positions;
    const base = Float32Array.from(posBuf);
    const B: Banner = { owner, x: ev.x, y: ev.y, carry, born: V.real, alive: true, end: () => undefined };
    this.banners.push(B);
    let age = 0, phase = rand(0, TAU), landed = carry, bx = ev.x, by = ev.y, lastX = ev.x, lastY = ev.y, vx = 0, vy = 0, ox = -16, oy = -6;
    B.end = () => { life = Math.min(life, age + 0.28); };
    const LAND = 0.2; // matches the hero's 'plant' stab (render/actions.ts strikeMs 210)
    if (carry) V.sound('standard', ev.x, ev.y, mine ? 0.8 : 0.4);
    V.add({
      update: (dt) => {
        age += dt;
        let cx = ev.x, cy = ev.y;
        if (carry) {
          const p = V.ctx.entityPos(owner);
          if (p) {
            if (dt > 0) { vx += ((p.x - lastX) / dt - vx) * clamp(dt * 10, 0, 1); vy += ((p.y - lastY) / dt - vy) * clamp(dt * 10, 0, 1); }
            lastX = p.x; lastY = p.y;
            const sp = Math.hypot(vx, vy);
            if (sp > 30) { ox += (-vx / sp * 18 - ox) * clamp(dt * 6, 0, 1); oy += (-vy / sp * 8 - 6 - oy) * clamp(dt * 6, 0, 1); }
            cx = p.x; cy = p.y;
            bx += (p.x + ox - bx) * clamp(dt * 12, 0, 1); by += (p.y + oy - by) * clamp(dt * 12, 0, 1);
          }
          B.x = cx; B.y = cy;
        } else { bx = ev.x; by = ev.y - 4; }
        const fin = carry ? easeOutBack(clamp(age / 0.25, 0, 1)) : 1;
        const fout = clamp((life - age) / 0.3, 0, 1);
        // planted: the pole drops in and slams down as the hero stabs it into the ground
        let drop = 0;
        if (!carry) {
          const t = clamp(age / LAND, 0, 1);
          drop = 70 * (1 - t * t);
          if (!landed && age >= LAND) { landed = true; this.standardPlanted(ev.x, ev.y, fire, mine); }
        }
        root.position.set(bx, by - drop + (1 - fout) * 6);
        root.alpha = (carry ? clamp(age / 0.12, 0, 1) : clamp(age / 0.08, 0, 1)) * fout;
        root.scale.set(k * (carry ? fin : 1));
        // cloth ripple (travelling sine, amplitude grows toward the free end, a little bunching and droop)
        const moving = carry ? clamp(Math.hypot(vx, vy) / 220, 0, 1) : 0;
        const amp = 1 + 0.6 * moving;
        phase += dt * (5.2 + 4 * moving);
        for (let j = 0; j < CLOTH_VY; j++) {
          for (let i = 0; i < CLOTH_VX; i++) {
            const u = i / (CLOTH_VX - 1), idx = (j * CLOTH_VX + i) * 2;
            const w = Math.sin(phase - u * 3.3 + j * 0.25) * (0.6 + 3.4 * u) * amp;
            posBuf[idx] = base[idx] - u * (1 + Math.sin(phase * 0.7 - u * 2) * 0.8) * amp * 1.4;
            posBuf[idx + 1] = base[idx + 1] + w + u * u * 2.6 * (1 - 0.6 * moving);
          }
        }
        cloth.geometry.getBuffer('aPosition').update();
        if (carry && Math.abs(vx) > 25) flag.scale.x += ((vx > 0 ? -1 : 1) - flag.scale.x) * clamp(dt * 8, 0, 1);
        // ground ring (around the owner when carried) and the pole's shadow
        const ra = clamp(age / 0.3, 0, 1) * fout * (0.85 + 0.15 * Math.sin(age * 2.4));
        ringA.place(cx, cy, 0); ringA.setScale(r * 2.1); ringA.setAlpha(0.26 * ra);
        ringB.place(cx, cy, 0); ringB.setScale(r * 2.2); ringB.setAlpha(0.12 * ra);
        shadow.place(bx, by + 4, 0); shadow.setScale(26 * k, 0.5); shadow.setAlpha((landed ? 0.35 : 0.15) * fout);
        if (fire && Math.random() < 3 * dt * s.budget) s.ember(bx + rand(4, 40) * k * flag.scale.x, by, (POLE_H - rand(14, 40)) * k, 0xff8a3d, rand(0.6, 1), 4, 40);
        return age < life;
      },
      kill: () => {
        B.alive = false;
        const i = this.banners.indexOf(B);
        if (i >= 0) this.banners.splice(i, 1);
        const geo = cloth.geometry; // per-banner geometry (the cloth texture is shared and cached)
        root.destroy({ children: true });
        geo.destroy();
        for (const [layer, p] of parts) layer.kill(p);
      },
    });
  }

  /** The moment the pole bites into the ground: dust ring, clods, a short flash and the snap + horn. */
  private standardPlanted(x: number, y: number, fire: boolean, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    s.flash(x, y, 6, 70, fire ? 0xffb060 : 0xfff0d0, 0.1, 0.5);
    s.ring(s.gNormal, T.ringThick, x, y, 6, 52, 0x2e2418, 0.4, 0.4);
    s.ring(s.gAdd, T.ringHard, x, y, 8, 60, fire ? 0xff8a3d : 0xe0a24a, 0.3, 0.6);
    for (let i = 0, n = s.n(12); i < n; i++) {
      const a = (i / 12) * TAU + rand(-0.2, 0.2);
      s.dust(x + Math.cos(a) * 6, y + Math.sin(a) * 4, 14, 38, 0xa8946f, rand(0.45, 0.7), 0.38, Math.cos(a) * 170, Math.sin(a) * 110);
    }
    for (let i = 0, n = s.n(6); i < n; i++) {
      const a = rand(0, TAU), sp = rand(50, 130);
      s.chunk(x, y, 2, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(160, 280), rand(4, 7), i % 2 ? 0x7d6040 : 0x5e4a34, rand(0.6, 0.9));
    }
    const cr = s.gNormal.add(T.crack[(Math.random() * 2) | 0], x, y, 2.2);
    cr.w0 = 40; cr.w1 = 56; cr.se = 3; cr.rotation = rand(0, TAU); cr.a0 = 0.3; cr.fo = 0.5; cr.tintTo(0x241a12);
    V.shakeNear(x, y, mine ? 3 : 2, 100);
    V.sound('standard', x, y, mine ? 1 : 0.5);
  }

  /** The owner's oldest standard at this spot (or their carried one) comes down now. */
  private standardEnd(ev: Aoe): void {
    let best: Banner | null = null;
    for (const b of this.banners) {
      if (!b.alive || b.owner !== (ev.s ?? -1)) continue;
      if (!b.carry && Math.hypot(b.x - ev.x, b.y - ev.y) > 60) continue;
      if (!best || b.born < best.born) best = b;
    }
    best?.end();
  }

  /** Ember Pennant: a fire pulse rolling out from the standard and filling its ring. */
  private standardPulse(x: number, y: number, r: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const fire = el === EL_FIRE;
    const main = fire ? 0xff6a1a : 0xe0a24a, hot = fire ? 0xffc070 : 0xfff0c0;
    s.ring(s.gAdd, T.ringThick, x, y, r * 0.08, r * 0.98, main, 0.5, 0.34);
    s.ring(s.gAdd, T.ringHard, x, y, r * 0.1, r, hot, 0.42, 0.42);
    s.glow(x, y, 0, r * 0.6, r * 2.0, main, 0.42, 0.11, s.gAdd);
    for (let i = 0, n = s.n(14); i < n; i++) {
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * r * 0.92;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      V.after((d / r) * 0.3, () => {
        if (fire) {
          const f = s.aAdd.add(T.flame, px, py, rand(0.3, 0.5));
          f.anchorY = 0.85; f.vz = rand(40, 90); f.w0 = rand(14, 22); f.w1 = 4; f.k = 1.5; f.fo = 0.3; f.flick = 0.2; f.a0 = 0.8;
          f.tintFade(hot, main);
        } else s.glint(px, py, rand(4, 16), 12, hot, 0.3, 0.7);
      });
    }
    if (fire) for (let i = 0, n = s.n(8); i < n; i++) s.ember(x + rand(-r, r) * 0.7, y + rand(-r, r) * 0.45, 4, 0xff8a3d, rand(0.6, 1.1), 4, 80);
    V.sound('fireball', x, y, mine ? 0.45 : 0.25);
  }

  // ─────────────────────────── warrior M1: Ironplough ───────────────────────────

  /**
   * One channel tick (every 0.25 s): soil thrown sideways off the share at the front of the 90° cone, two furrows
   * scored into the ground behind it (fade over ~1.5 s), sparks that brighten with the ramp level `ev.d` (0..5).
   */
  private plough(ev: Aoe, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const x = ev.x, y = ev.y, len = Math.max(60, ev.r), a = ev.a ?? 0;
    const lv = clamp(Math.round(ev.d), 0, 5), k = lv / 5;
    const fire = ev.el === EL_FIRE;
    const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const shx = x + ux * 34, shy = y + uy * 34;
    const soil = [0x6a5038, 0x7d6040, 0x4f3a28, 0x8a6f4d];
    // soil turned over both sides of the share, thrown out, a little back and up (like a mouldboard)
    for (let i = 0, n = s.n(6 + lv * 1.6); i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const sp = rand(100, 210) * (1 + 0.35 * k), back = rand(-0.15, 0.45);
      const dx = side * nx * 0.9 - ux * back, dy = side * ny * 0.9 - uy * back;
      s.chunk(shx + nx * side * 7, shy + ny * side * 7, 4, dx * sp, dy * sp * 0.7, rand(170, 290), rand(5, 10), soil[(Math.random() * 4) | 0], rand(0.6, 0.9));
    }
    for (const side of [-1, 1]) {
      s.dust(shx + nx * side * 12, shy + ny * side * 9, 20, 58, 0xa48a68, rand(0.55, 0.85), 0.42, side * nx * 190 - ux * 30, side * ny * 130 - uy * 20);
      s.dust(shx + nx * side * 4, shy + ny * side * 3, 14, 34, 0x8a6f4d, rand(0.4, 0.6), 0.34, side * nx * 90 + ux * 40, side * ny * 60 + uy * 30);
    }
    // faint dust along the cone's reach (90° front arc)
    for (let i = 0, n = s.n(5); i < n; i++) {
      const aa = a + ((i + rand(0.1, 0.9)) / 5 - 0.5) * 1.57, d = len * rand(0.5, 0.92);
      s.dust(x + Math.cos(aa) * d, y + Math.sin(aa) * d, 12, 36, 0xb09a78, rand(0.35, 0.55), 0.24, Math.cos(aa) * 80, Math.sin(aa) * 55);
    }
    // steel on stone: more and whiter sparks as the push ramps up
    const hot = lerpColor(0xffb860, 0xffffff, k);
    for (let i = 0, n = s.n(2 + lv * 1.8); i < n; i++) {
      const side = i % 2 ? 1 : -1;
      s.spark(shx, shy, 6, a + side * rand(0.9, 2.1), rand(200, 340 + lv * 40), 14 + lv * 2.8, i % 3 ? hot : 0xffd890, 0.26, 650);
    }
    s.glow(shx, shy, 6, 18 + lv * 6, 30 + lv * 9, fire ? 0xff8a3d : 0xffd890, 0.24, 0.14 + 0.08 * lv);
    if (fire) for (let i = 0, n = s.n(3); i < n; i++) s.ember(shx + rand(-10, 10), shy, 6, 0xff8a3d, rand(0.5, 0.8), 4, 60);
    // two furrows scored by the share since the last tick
    const owner = ev.s ?? -1;
    const last = this.ploughs.get(owner);
    const prev = last && V.real - last.t < 0.45 && Math.hypot(shx - last.x, shy - last.y) < 150 ? last : null;
    const x0 = prev ? prev.x : shx - ux * 16, y0 = prev ? prev.y : shy - uy * 16;
    const fl = Math.hypot(shx - x0, shy - y0);
    if (fl > 3) {
      const fx = -(shy - y0) / fl, fy = (shx - x0) / fl;
      for (const side of [-1, 1]) {
        const o = side * 11, o2 = side * 15.5;
        const g = s.seg(s.gNormal, x0 + fx * o, y0 + fy * o, shx + fx * o, shy + fy * o, 7, 0x24180f, 1.5, 0.62);
        g.fo = 0.4;
        const ridge = s.seg(s.gNormal, x0 + fx * o2, y0 + fy * o2, shx + fx * o2, shy + fy * o2, 3.4, 0xa88a62, 1.5, 0.5);
        ridge.fo = 0.4;
        if (Math.random() < 0.5) {
          const f = Math.random(), cx = x0 + (shx - x0) * f + fx * o2 * 1.2, cy = y0 + (shy - y0) * f + fy * o2 * 1.2;
          const clod = s.gNormal.add(T.chunk[(Math.random() * 3) | 0], cx, cy, 1.4);
          clod.w0 = clod.w1 = rand(4, 6.5); clod.rotation = rand(0, TAU); clod.a0 = 0.9; clod.fo = 0.5; clod.tintTo(0x6a5038);
        }
        if (fire) { const e = s.seg(s.gAdd, x0 + fx * o, y0 + fy * o, shx + fx * o, shy + fy * o, 3, 0xff8a3d, 1.0, 0.6); e.tintFade(0xffa040, 0x401000); }
      }
    }
    const snd = last?.snd ?? -1;
    const play = V.real - snd >= 0.2;
    this.ploughs.set(owner, { x: shx, y: shy, t: V.real, snd: play ? V.real : snd });
    if (this.ploughs.size > 64) this.ploughs.clear();
    if (play) V.sound(`plough${lv}`, x, y, mine ? 0.9 : 0.45);
  }

  /** Sod Burst: the cone tip erupts in a burst of earth. */
  private sod(x: number, y: number, r: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const fire = el === EL_FIRE;
    s.flash(x, y, 8, r * 1.4, fire ? 0xffb060 : 0xf2e2c0, 0.1, 0.45);
    s.ring(s.gNormal, T.ringThick, x, y, r * 0.2, r * 1.05, 0x2e2418, 0.4, 0.42);
    s.ring(s.gAdd, T.ringHard, x, y, r * 0.2, r, fire ? 0xff8a3d : 0xe0c08a, 0.26, 0.5);
    for (let i = 0, n = s.n(6); i < n; i++) {
      const a = (i / 6) * TAU + rand(-0.3, 0.3), d = rand(0.1, 0.55) * r;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.7;
      const sp = s.aBody.add(T.spike[i % 2], px, py, rand(0.45, 0.65));
      sp.anchorY = 0.95; sp.w0 = 5; sp.w1 = rand(13, 20); sp.se = 3; sp.fo = 0.5; sp.fi = 0.02;
      sp.tintTo(fire ? 0x5a4436 : 0x8a6f4d);
    }
    for (let i = 0, n = s.n(10); i < n; i++) {
      const a = rand(0, TAU), sp = rand(50, 150);
      s.chunk(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.15, 4, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(240, 420), rand(5, 9), i % 2 ? 0x7d6040 : 0x5e4a34, rand(0.7, 1.0));
    }
    for (let i = 0, n = s.n(9); i < n; i++) {
      const a = (i / 9) * TAU + rand(-0.2, 0.2);
      s.dust(x + Math.cos(a) * 8, y + Math.sin(a) * 6, r * 0.3, r * 0.75, 0xa48a68, rand(0.5, 0.8), 0.38, Math.cos(a) * r * 2.4, Math.sin(a) * r * 1.8);
    }
    const cr = s.gNormal.add(T.crack[(Math.random() * 2) | 0], x, y, 2);
    cr.w0 = r * 1.1; cr.w1 = r * 1.3; cr.se = 3; cr.rotation = rand(0, TAU); cr.a0 = 0.36; cr.fo = 0.5; cr.tintTo(0x241a12);
    if (fire) for (let i = 0, n = s.n(8); i < n; i++) s.ember(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.4, 4, 0xff8a3d, rand(0.6, 1), 4, 80);
    V.shakeNear(x, y, mine ? 2.5 : 1.5, 90);
    V.sound('slam', x, y, mine ? 0.5 : 0.3);
  }

  // ─────────────────────────── warrior M1: Cairnfall ───────────────────────────

  /** The stone stack dropping onto a `tele cairn` marker, landing exactly at `d` (Telegraphs adds it as an extra). */
  cairnFall(x: number, y: number, r: number, d: number): Effect {
    const V = this.V, s = V.sys, T = s.T;
    const sc = clamp(r / 70, 0.5, 1.6) * 1.12;
    const spr = new Sprite(cairnTex(cairnVariant(x, y)));
    spr.anchor.set(0.5, 0.95);
    spr.visible = false;
    this.high.addChild(spr);
    const shadow = s.gNormal.hold(T.shadow, x, y);
    shadow.tintTo(0x000000);
    const fall = Math.min(0.42, d * 0.9), start = d - fall, H = 380;
    let age = 0, landed = false, dead = false;
    const rec = { x, y, land: () => { landed = true; } };
    this.cairnsFalling.push(rec);
    return {
      update: (dt) => {
        age += dt;
        // rests on the marker until the impact aoe lands it (the telegraph itself ends at d + 0.14)
        if (dead || landed || age > d + 0.12) return false;
        const st = clamp(age / d, 0, 1);
        shadow.place(x, y, 0); shadow.setScale(r * 0.95 * (0.35 + 0.65 * st), 0.5); shadow.setAlpha(0.1 + 0.3 * st);
        if (age < start) return true;
        const t = clamp((age - start) / fall, 0, 1), e = t * t;
        spr.visible = true;
        spr.position.set(x + 24 * (1 - e), y - H * (1 - e));
        spr.rotation = 0.45 * (1 - e);
        spr.scale.set(sc);
        if (t < 1 && Math.random() < 0.7) {
          const sl = s.aAdd.add(T.streak, spr.x + rand(-10, 10) * sc, y, 0.12);
          sl.z = H * (1 - e) + 30 * sc; sl.rotation = -Math.PI / 2; sl.anchorX = 0.9; sl.w0 = 40; sl.w1 = 20; sl.k = 0.35; sl.a0 = 0.3; sl.fo = 0.2;
          sl.tintTo(0xe8e0d0);
        }
        return true;
      },
      kill: () => {
        if (dead) return; // the telegraph and the effect loop may both kill it
        dead = true;
        const i = this.cairnsFalling.indexOf(rec);
        if (i >= 0) this.cairnsFalling.splice(i, 1);
        spr.destroy();
        s.gNormal.kill(shadow);
      },
    };
  }

  /** Stacked flat stones slam down: dust ring, grit, a crack; the cairn stands `d` s and then sinks away. */
  private cairnImpact(x: number, y: number, r: number, d: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    for (const f of this.cairnsFalling) if (Math.abs(f.x - x) < 40 && Math.abs(f.y - y) < 40) { f.land(); break; }
    const fire = el === EL_FIRE;
    const sc = clamp(r / 70, 0.5, 1.6) * 1.12;
    s.flash(x, y, 10, r * 1.3, fire ? 0xffb060 : 0xf2e8d0, 0.1, 0.5);
    s.ring(s.gNormal, T.ringThick, x, y, r * 0.2, r * 1.1, 0x2e2418, 0.45, 0.45);
    s.ring(s.gAdd, T.ringHard, x, y, r * 0.2, r * 1.05, fire ? 0xff8a3d : 0xe8dcc0, 0.3, 0.55);
    for (let i = 0, n = s.n(14); i < n; i++) {
      const a = (i / 14) * TAU + rand(-0.2, 0.2);
      s.dust(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.18, r * 0.3, r * 0.7, 0xa89c88, rand(0.5, 0.85), 0.42, Math.cos(a) * r * 3, Math.sin(a) * r * 2.2);
    }
    for (let i = 0, n = s.n(9); i < n; i++) {
      const a = rand(0, TAU), sp = rand(60, 170);
      s.chunk(x, y, 6, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(200, 380), rand(4, 8) * sc, i % 2 ? 0x8f8578 : 0x6e665c, rand(0.7, 1.1));
    }
    for (let i = 0, n = s.n(10); i < n; i++) {
      const a = rand(0, TAU), sp = rand(100, 240);
      const g = s.aBody.add(T.dot, x, y, rand(0.4, 0.7));
      g.z = 6; g.vx = Math.cos(a) * sp; g.vy = Math.sin(a) * sp * 0.6; g.vz = rand(80, 200); g.gz = 700; g.drag = 1;
      g.w0 = g.w1 = rand(2, 3.4); g.fo = 0.6; g.tintTo(0x7d7468);
    }
    const cr = s.gNormal.add(T.crack[(Math.random() * 2) | 0], x, y, 2.6);
    cr.w0 = r * 1.0; cr.w1 = r * 1.2; cr.se = 3; cr.rotation = rand(0, TAU); cr.a0 = 0.42; cr.fo = 0.5; cr.tintTo(0x241a12);
    if (fire) {
      const g = s.gAdd.add(T.crack[0], x, y, 1.6);
      g.w0 = r; g.w1 = r * 1.2; g.se = 3; g.rotation = cr.rotation; g.a0 = 0.9; g.fo = 0.3; g.tintFade(0xffb040, 0x801800);
      for (let i = 0, n = s.n(10); i < n; i++) s.ember(x + rand(-r, r) * 0.5, y + rand(-r, r) * 0.3, 6, 0xff8a3d, rand(0.6, 1.1), 4, 90);
    }
    V.shakeNear(x, y, mine ? 3 : 2, 110);
    V.sound('cairn', x, y, mine ? 1 : 0.5);
    // the standing cairn
    const spr = new Sprite(cairnTex(cairnVariant(x, y)));
    spr.anchor.set(0.5, 0.95);
    spr.position.set(x, y);
    this.low.addChild(spr);
    let age = 0, jolt = 0;
    const rec = { x, y, jolt: () => { jolt = 1; } };
    this.cairnsStanding.push(rec);
    V.add({
      update: (dt) => {
        age += dt;
        jolt = Math.max(0, jolt - dt * 5);
        const land = Math.exp(-age * 14);
        const sink = clamp((age - (d - 0.5)) / 0.5, 0, 1);
        const wob = jolt * Math.sin(age * 60) * 0.05;
        spr.scale.set(sc * (1 + 0.16 * land + wob), sc * (1 - 0.22 * land - wob * 0.5));
        spr.position.set(x, y + sink * 10 * sc);
        spr.alpha = 1 - sink;
        if (fire) spr.tint = lerpColor(0xffa060, 0xffffff, clamp(age / 1.4, 0, 1));
        if (sink > 0 && Math.random() < 6 * dt * s.budget) s.dust(x + rand(-16, 16) * sc, y + rand(-3, 3), 10, 26, 0xa89c88, rand(0.4, 0.6), 0.3);
        return age < d;
      },
      kill: () => {
        const i = this.cairnsStanding.indexOf(rec);
        if (i >= 0) this.cairnsStanding.splice(i, 1);
        spr.destroy();
      },
    });
  }

  /** Waymarker: a standing cairn shudders and sends out a small stun ring. */
  private cairnPulse(x: number, y: number, r: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    for (const c of this.cairnsStanding) if (Math.abs(c.x - x) < 30 && Math.abs(c.y - y) < 30) { c.jolt(); break; }
    s.ring(s.gAdd, T.ringHard, x, y, r * 0.3, r * 1.05, 0xf0e2b0, 0.3, 0.8);
    s.ring(s.gNormal, T.ringThick, x, y, r * 0.3, r, 0x2e2418, 0.35, 0.3);
    for (let i = 0, n = s.n(8); i < n; i++) {
      const a = (i / 8) * TAU + rand(-0.2, 0.2);
      s.dust(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.3, 10, 28, 0xa89c88, rand(0.4, 0.6), 0.32, Math.cos(a) * r * 2.4, Math.sin(a) * r * 1.8);
    }
    for (let i = 0; i < 3; i++) s.glint(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.3, rand(10, 30), 12, 0xfff0c0, 0.3, 0.8);
    V.sound('tollblow', x, y, mine ? 0.6 : 0.3);
  }

  // ─────────────────────────── warrior M1: rune grounds & waves ───────────────────────────

  /** Gyre of Ash: a small patch of glowing embers that burns down over `d` s (cheap: fire-and-forget only). */
  private emberTrail(x: number, y: number, r: number, d: number): void {
    const s = this.V.sys, T = s.T;
    const g = s.gAdd.add(T.glow, x, y, d);
    g.w0 = r * 1.8; g.w1 = r * 1.25; g.k = 0.62; g.a0 = 0.42; g.fi = 0.06; g.fo = 0.2; g.flick = 0.12;
    g.tintFade(0xff8a2a, 0x701800);
    const c = s.gAdd.add(T.crack[(Math.random() * 2) | 0], x, y, d * 0.9);
    c.w0 = c.w1 = r * 1.2; c.k = 0.7; c.rotation = rand(0, TAU); c.a0 = 0.45; c.fo = 0.15;
    c.tintFade(0xffa040, 0x501000);
    // the coals themselves: a few glowing specks that flicker and burn down with the patch
    for (let i = 0, n = s.n(5); i < n; i++) {
      const a = rand(0, TAU), dd = Math.sqrt(Math.random()) * r * 0.6;
      const e = s.gAdd.add(T.dot, x + Math.cos(a) * dd, y + Math.sin(a) * dd * 0.62, d * rand(0.7, 1));
      e.w0 = rand(3.5, 5.5); e.w1 = 1.5; e.a0 = 0.95; e.fo = 0.3; e.flick = 0.45;
      e.tintFade(0xffc060, 0xb02a00);
    }
    const sc = s.gNormal.add(T.scorch[(Math.random() * 2) | 0], x, y, d * 1.15);
    sc.w0 = sc.w1 = r * 1.6; sc.k = 0.7; sc.rotation = rand(0, TAU); sc.a0 = 0.28; sc.fo = 0.5;
    sc.tintTo(0x000000);
    for (let i = 0, n = s.n(3); i < n; i++) s.ember(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.35, 2, 0xff8a3d, rand(0.6, 1.1), 4, 50);
    this.V.after(d * 0.35, () => { for (let i = 0, n = s.n(2); i < n; i++) s.ember(x + rand(-r, r) * 0.5, y + rand(-r, r) * 0.3, 2, 0xff7a2a, rand(0.5, 0.9), 3.5, 40); });
  }

  /** Outward Tremor: a ring wave rolling out from the stomp to radius r, kicking up dust as it passes. */
  private tremorRing(x: number, y: number, r: number, d: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const fire = el === EL_FIRE;
    const r0 = r * 0.45; // the server rolls it from the stomp's edge (170 of 320 by default) outward
    s.ring(s.gNormal, T.ringThick, x, y, r0, r, 0x3a2e24, d + 0.12, 0.42);
    s.ring(s.gAdd, T.ringHard, x, y, r0, r, fire ? 0xff8a3d : 0xffe2b0, d, 0.55);
    let age = 0, acc = 0;
    V.add({
      update: (dt) => {
        age += dt;
        const t = clamp(age / d, 0, 1), rad = r0 + (r - r0) * easeOut3(t);
        acc += dt * 80 * s.budget * (1 - t * 0.5);
        while (acc > 1) {
          acc -= 1;
          const a = rand(0, TAU);
          const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
          s.dust(px, py, 14, 38, 0xa8946f, rand(0.4, 0.6), 0.3, Math.cos(a) * 90, Math.sin(a) * 60);
          if (Math.random() < 0.15) s.chunk(px, py, 2, Math.cos(a) * 60, Math.sin(a) * 40, rand(120, 220), rand(3, 6), 0x6a5a4a, 0.6);
          if (fire && Math.random() < 0.3) s.ember(px, py, 2, 0xff8a3d, 0.6, 4, 60);
        }
        return age < d;
      },
      kill: () => undefined,
    });
    V.shakeNear(x, y, mine ? 3 : 2, 140);
    V.sound('slam', x, y, mine ? 0.55 : 0.3);
  }

  /** Rumble / aftershock on one enemy: a small crack and a puff of tremor dust. */
  private aftershock(x: number, y: number, r: number, el: number): void {
    const s = this.V.sys, T = s.T;
    const cr = s.gNormal.add(T.crack[(Math.random() * 2) | 0], x, y, 1.2);
    cr.w0 = r * 1.1; cr.w1 = r * 1.4; cr.se = 3; cr.rotation = rand(0, TAU); cr.a0 = 0.34; cr.fo = 0.4; cr.tintTo(0x241a12);
    for (let i = 0, n = s.n(4); i < n; i++) {
      const a = rand(0, TAU);
      s.dust(x + Math.cos(a) * 6, y + Math.sin(a) * 4, 10, 26, 0xa8946f, rand(0.35, 0.55), 0.32, Math.cos(a) * 80, Math.sin(a) * 50);
    }
    for (let i = 0, n = s.n(3); i < n; i++) {
      const a = rand(0, TAU), sp = rand(40, 100);
      s.chunk(x, y, 2, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(120, 220), rand(3, 5), 0x6a5a4a, 0.6);
    }
    if (el === EL_FIRE) s.ember(x, y, 4, 0xff8a3d, 0.7, 4, 60);
  }

  // ─────────────────────────── warrior wave 2: Kilnheart ───────────────────────────

  /**
   * The stoked hero while Kilnheart burns: a furnace-orange glow at the chest seam, a warm heat haze rising off the
   * shoulders, embers, and scorched footprints. The local player's buff list (MeState) decides when it ends; other
   * heroes only send the `cast`, so they get `life` seconds. Cold Forge: the same in frost colours.
   */
  kilnAura(owner: number, cold: boolean, life: number): void {
    const V = this.V, s = V.sys, T = s.T;
    this.kilns.get(owner)?.();
    const main = cold ? 0x7fd8ff : 0xff6a1a, hot = cold ? 0xe8fbff : 0xffd36a;
    const glow = s.aAdd.hold(T.glow, 0, 0); glow.tintTo(main);
    const seam = s.aAdd.hold(T.core, 0, 0); seam.tintTo(hot);
    const halo = s.gAdd.hold(T.glow, 0, 0); halo.tintTo(main);
    const me = owner === V.ctx.myId();
    let age = 0, end = -1, wisps = 0, embers = 0, lastX = NaN, lastY = NaN, step = 0;
    const stop = () => { if (end < 0) end = age; };
    this.kilns.set(owner, stop);
    V.add({
      update: (dt) => {
        age += dt;
        const b = V.body(owner);
        if (!b) return false;
        if (me) {
          const buffs = ui.get().me?.buffs;
          if (buffs ? age > 0.6 && !buffs.some((x) => x.id === 'kilnheart') : age > life) stop();
          if (age > 180) stop();
        } else if (age > life) stop();
        const fade = end < 0 ? clamp(age / 0.4, 0, 1) : 1 - clamp((age - end) / 0.6, 0, 1);
        if (end >= 0 && fade <= 0) return false;
        const chest = b.h * 0.5;
        const beat = preferences.get().values.reduceFlashes ? 1 : 0.88 + 0.09 * Math.sin(age * 8.5) + 0.03 * Math.sin(age * 23);
        glow.place(b.x, b.y + 1, chest); glow.setScale(50 * beat, 1.05); glow.setAlpha(0.62 * fade);
        seam.place(b.x, b.y + 1, chest + 1); seam.setScale(11 * beat, 1.7); seam.setAlpha(0.95 * fade);
        halo.place(b.x, b.y, 0); halo.setScale(84, 0.5); halo.setAlpha(0.3 * fade);
        // heat haze: faint warm wisps rising off the shoulders (frost mist for Cold Forge)
        wisps += dt * 9 * s.budget;
        while (wisps > 1) {
          wisps -= 1;
          const w = s.aAdd.add(T.wisp, b.x + rand(-12, 12), b.y + 1, rand(0.6, 0.9));
          w.z = rand(b.h * 0.45, b.h * 0.8); w.vz = rand(40, 70); w.vx = rand(-8, 8); w.drag = 0.5;
          w.w0 = rand(10, 14); w.w1 = rand(20, 28); w.k = 1.4; w.a0 = 0.28 * fade; w.fi = 0.2; w.fo = 0.4; w.vr = rand(-1, 1);
          w.tintTo(cold ? 0xcfefff : 0xffb070);
        }
        embers += dt * 5 * s.budget;
        while (embers > 1) { embers -= 1; s.ember(b.x + rand(-10, 10), b.y, rand(b.h * 0.3, b.h * 0.7), main, rand(0.5, 0.9), 3.5, 50); }
        // scorched (or frosted) footprints, alternating left / right of the path
        if (Number.isNaN(lastX)) { lastX = b.x; lastY = b.y; }
        const dx = b.x - lastX, dy = b.y - lastY, dist = Math.hypot(dx, dy);
        if (dist >= 20) {
          if (fade > 0.3) {
            step ^= 1;
            const nx = -dy / dist, ny = dx / dist, side = step ? 5 : -5, rot = Math.atan2(dy, dx);
            const fx = b.x + nx * side, fy = b.y + ny * side * 0.6;
            const mark = s.gNormal.add(T.dot, fx, fy, 2.6);
            mark.w0 = mark.w1 = 8; mark.k = 0.55; mark.rotation = rot; mark.a0 = 0.5; mark.fo = 0.35; mark.tintTo(cold ? 0xb8d8ea : 0x1e140c);
            const hp = s.gAdd.add(T.dot, fx, fy, 1.1);
            hp.w0 = 7; hp.w1 = 4; hp.k = 0.55; hp.rotation = rot; hp.a0 = 0.8; hp.fo = 0.2; hp.tintFade(hot, cold ? 0x3a6a90 : 0x801800);
          }
          lastX = b.x; lastY = b.y;
        }
        return true;
      },
      kill: () => {
        s.aAdd.kill(glow); s.aAdd.kill(seam); s.gAdd.kill(halo);
        if (this.kilns.get(owner) === stop) this.kilns.delete(owner);
      },
    });
  }

  /** Bellows Breath: a roaring exhale of fire (Cold Forge: freezing mist) that fills the 90° cone out to r. */
  private kilnBreath(x: number, y: number, r: number, a: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const cold = el === EL_COLD;
    const hot = cold ? 0xe8fbff : 0xfff0a0, main = cold ? 0x7fd8ff : 0xff7a1a, deep = cold ? 0x3a7aa8 : 0xb8300a;
    const ux = Math.cos(a), uy = Math.sin(a);
    const mx = x + ux * 16, my = y + uy * 10, mz = 34;
    s.flash(mx, my, mz, 64, hot, 0.12, 0.8);
    const dur = 0.36, reach = r / 0.336; // drag 1.7 over ~0.5 s carries a puff ~0.34 of its launch speed
    let age = 0, acc = 0;
    V.add({
      update: (dt) => {
        age += dt;
        acc += dt * 110 * s.budget;
        while (acc > 1 && age < dur) {
          acc -= 1;
          const ang = a + rand(-0.74, 0.74) * (0.55 + 0.45 * Math.random());
          const sp = reach * rand(0.55, 1);
          const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
          if (cold) {
            const m = s.aAdd.add(T.glow, mx, my, rand(0.45, 0.6));
            m.z = mz; m.vx = vx; m.vy = vy; m.vz = rand(-30, 0); m.drag = 1.7; m.w0 = 22; m.w1 = rand(60, 90); m.se = 1; m.a0 = 0.32; m.fo = 0.35;
            m.tintFade(hot, main);
            if (Math.random() < 0.35) {
              const sh = s.aBody.add(T.shard[(Math.random() * 3) | 0], mx, my, rand(0.4, 0.55));
              sh.z = mz; sh.vx = vx; sh.vy = vy; sh.drag = 1.7; sh.w0 = sh.w1 = rand(6, 10); sh.vr = rand(-6, 6); sh.fo = 0.6; sh.tintTo(0xdff6ff);
            }
          } else {
            const f = s.aAdd.add(T.flame, mx, my, rand(0.38, 0.55));
            f.z = mz + rand(-4, 4); f.vx = vx; f.vy = vy; f.vz = rand(-30, 10); f.drag = 1.7;
            f.anchorY = 0.6; f.w0 = rand(14, 20); f.w1 = rand(40, 60); f.k = 1.25; f.se = 1; f.fo = 0.45; f.flick = 0.15; f.a0 = 0.85;
            f.rotation = Math.atan2(vy, vx) + Math.PI / 2;
            f.tintFade(lerpColor(hot, main, 0.3), deep);
            if (Math.random() < 0.3) {
              const g = s.aAdd.add(T.glow, mx, my, 0.4);
              g.z = mz; g.vx = vx; g.vy = vy; g.drag = 1.7; g.w0 = 30; g.w1 = 80; g.se = 1; g.a0 = 0.28; g.fo = 0.2; g.tintTo(main);
            }
          }
          if (Math.random() < 0.2) s.ember(mx + ux * rand(20, 80), my + uy * rand(20, 80), mz, cold ? 0xcfefff : 0xff8a3d, rand(0.5, 0.9), 4, 40);
        }
        return age < dur;
      },
      kill: () => undefined,
    });
    for (const f of [0.35, 0.6, 0.85]) {
      const d = r * f;
      V.after(0.08 + f * 0.2, () => { // scorch / frost marks appear as the exhale reaches them
        if (cold) this.combat.decal(T.frostPatch, x + ux * d, y + uy * d, r * f * 0.9, 0xbfe9ff, 0.35, 3, s.gAdd);
        else this.combat.decal(T.scorch[(Math.random() * 2) | 0], x + ux * d, y + uy * d, r * f * 0.9, 0x000000, 0.28, 3.5);
      });
    }
    V.after(0.28, () => {
      for (let i = 0, n = s.n(5); i < n; i++) {
        const aa = a + rand(-0.7, 0.7), d = r * rand(0.5, 0.95);
        s.smoke(x + Math.cos(aa) * d, y + Math.sin(aa) * d, 20, 26, 60, cold ? 0xdff4ff : 0x4e423b, rand(0.8, 1.2), 0.3, 30);
      }
    });
    V.shakeNear(x, y, mine ? 3 : 2, 160);
    V.sound('kiln_breath', x, y, mine ? 1 : 0.5);
  }

  // ─────────────────────────── warrior wave 2: Hearthbanner ───────────────────────────

  /** Hearthbanner set: a banner-gold shockwave ring with a madder edge, motes of gold rising. */
  private hearthShock(x: number, y: number, r: number, d: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const gold = 0xf2c45a, madder = 0xd8583a;
    s.ring(s.gAdd, T.ringHard, x, y, r * 0.15, r, gold, d, 0.9);
    s.ring(s.gAdd, T.ring, x, y, r * 0.1, r * 0.95, madder, d + 0.1, 0.45);
    s.ring(s.gNormal, T.ringThick, x, y, r * 0.15, r * 1.02, 0x2a1a10, d + 0.1, 0.3);
    s.flash(x, y, 18, r * 0.8, 0xfff0c0, 0.1, 0.45);
    for (let i = 0, n = s.n(10); i < n; i++) {
      const a = (i / 10) * TAU + rand(-0.2, 0.2);
      V.after(rand(0.05, d * 0.8), () => {
        const rr = r * rand(0.5, 0.95);
        const p = s.aAdd.add(i % 3 ? T.dot : T.star4, x + Math.cos(a) * rr, y + Math.sin(a) * rr, rand(0.5, 0.8));
        p.z = rand(2, 10); p.vz = rand(60, 120); p.drag = 0.8; p.w0 = rand(5, 9); p.w1 = 2; p.fo = 0.4; p.vr = 2;
        p.tintFade(0xfff2c0, gold);
      });
    }
    for (let i = 0, n = s.n(10); i < n; i++) {
      const a = (i / 10) * TAU + rand(-0.2, 0.2);
      s.dust(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.15, 14, 36, 0xb39d78, rand(0.45, 0.7), 0.28, Math.cos(a) * r * 2.4, Math.sin(a) * r * 1.8);
    }
    V.shakeNear(x, y, mine ? 2 : 1, 90);
    V.sound('slam', x, y, mine ? 0.45 : 0.25);
  }

  // ─────────────────────────── warrior wave 2: data grounds ───────────────────────────

  /** Quakeline · Open Crack: a jagged crack glowing along the fissure line for `d` s. */
  private quakeCrack(x: number, y: number, r: number, a: number, d: number, el: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const fire = el === EL_FIRE, cold = el === EL_COLD;
    const col = cold ? 0x8fdcff : fire ? 0xff7a1a : 0xffa848, deep = cold ? 0x2a5a7a : 0x6a1800;
    const pts = linePoints(x, y, a, lineLength('quake_crack', 336), 28, Math.min(10, r * 0.4));
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const dk = s.seg(s.gNormal, x0, y0, x1, y1, 7, 0x1a120c, d, 0.62); dk.fo = 0.7;
      const soft = s.seg(s.gAdd, x0, y0, x1, y1, 18, col, d * 0.85, 0.28); soft.fo = 0.4;
      const core = s.seg(s.gAdd, x0, y0, x1, y1, 3.2, col, d, 0.95); core.fo = 0.55;
      core.tintFade(lerpColor(col, 0xffffff, 0.35), deep);
      if (i % 3 === 1) {
        const ang = a + (Math.random() < 0.5 ? 1 : -1) * rand(0.6, 1.1), bl = rand(12, 22);
        const bx = x0 + Math.cos(ang) * bl, by = y0 + Math.sin(ang) * bl;
        const b1 = s.seg(s.gNormal, x0, y0, bx, by, 3, 0x1a120c, d, 0.5); b1.fo = 0.7;
        const b2 = s.seg(s.gAdd, x0, y0, bx, by, 1.6, col, d, 0.8); b2.fo = 0.5;
      }
    }
    let age = 0, acc = 0;
    V.add({
      update: (dt) => {
        age += dt;
        acc += dt * 10 * s.budget;
        while (acc > 1 && age < d * 0.8) {
          acc -= 1;
          const [px, py] = pts[(Math.random() * pts.length) | 0];
          if (cold) s.glint(px, py, rand(2, 10), 10, 0xe8fbff, 0.3, 0.8);
          else if (fire) s.ember(px, py, 2, 0xff8a3d, rand(0.5, 0.9), 4, 60);
          else { const g = s.gAdd.add(T.dot, px + rand(-4, 4), py, 0.5); g.vz = 25; g.w0 = 4; g.w1 = 1; g.fo = 0.3; g.tintTo(col); }
        }
        return age < d;
      },
      kill: () => undefined,
    });
  }

  /** Deep Earth tremor ground: a low, shaking ring of dust and hopping pebbles that reads as a slowing field. */
  private tremorField(x: number, y: number, r: number, d: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const disc = s.gNormal.hold(T.disc, x, y); disc.tintTo(0x2a2218);
    const ring = s.gNormal.hold(T.ringThick, x, y); ring.tintTo(0x5a4a38);
    const rim = s.gAdd.hold(T.ring, x, y); rim.tintTo(0xcfc6b0);
    let age = 0, dust = 0, hop = 0, pulse = 0;
    V.add({
      update: (dt) => {
        age += dt;
        const a = Math.min(clamp(age / 0.25, 0, 1), clamp((d - age) / 0.4, 0, 1));
        const wob = 1 + 0.014 * Math.sin(age * 41);
        disc.place(x, y, 0); disc.setScale(r * 2, 1); disc.setAlpha(0.12 * a);
        ring.place(x, y, 0); ring.setScale(r * 2.18 * wob); ring.setAlpha(0.32 * a);
        rim.place(x, y, 0); rim.setScale(r * 2.2 / wob); rim.setAlpha(0.16 * a * (0.8 + 0.2 * Math.sin(age * 7)));
        dust += dt * 14 * s.budget;
        while (dust > 1) {
          dust -= 1;
          const ang = rand(0, TAU), dd = Math.sqrt(Math.random()) * r * 0.95;
          s.dust(x + Math.cos(ang) * dd, y + Math.sin(ang) * dd, 10, 26, 0xa8946f, rand(0.5, 0.8), 0.28 * a, rand(-12, 12), rand(-8, 8));
        }
        hop += dt * 7 * s.budget;
        while (hop > 1) {
          hop -= 1;
          const ang = rand(0, TAU), dd = Math.sqrt(Math.random()) * r * 0.9;
          s.chunk(x + Math.cos(ang) * dd, y + Math.sin(ang) * dd, 0, rand(-10, 10), rand(-6, 6), rand(60, 110), rand(2.5, 4), 0x6a5a4a, 0.4);
        }
        if ((pulse -= dt) <= 0 && age < d - 0.3) { pulse += 0.5; s.ring(s.gNormal, T.ringHard, x, y, r * 0.3, r, 0x8a7a60, 0.5, 0.22 * a); }
        return age < d;
      },
      kill: () => { s.gNormal.kill(disc); s.gNormal.kill(ring); s.gAdd.kill(rim); },
    });
  }

  /** Fault Warden: a stone fault line along `a` — a dark crack between raised shards of rock — for `d` s. */
  private faultLine(x: number, y: number, r: number, a: number, d: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const len = lineLength('fault_line', 160);
    const pts = linePoints(x, y, a, len, 20, Math.min(6, r * 0.3));
    const nx = -Math.sin(a), ny = Math.cos(a);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const dk = s.seg(s.gNormal, x0, y0, x1, y1, 6, 0x1a120c, d, 0.65); dk.fo = 0.8;
      const lip = s.seg(s.gNormal, x0 + nx * 3, y0 + ny * 3, x1 + nx * 3, y1 + ny * 3, 2, 0xb8a888, d, 0.4); lip.fo = 0.8;
    }
    for (let i = 0, n = Math.max(4, Math.round(len / 18)); i < n; i++) {
      const t = (i + 0.5) / n, side = i % 2 ? 1 : -1, off = side * rand(7, 11);
      const px = x + Math.cos(a) * len * t + nx * off, py = y + Math.sin(a) * len * t + ny * off;
      const sp = s.aBody.add(T.spike[i % 2], px, py, d);
      sp.anchorY = 0.95; sp.w0 = sp.w1 = rand(12, 18); sp.fi = 0.04; sp.fo = 0.85; sp.rotation = side * rand(0.05, 0.25);
      sp.tintTo(i % 3 ? 0x8f8578 : 0x7a7166);
      s.dust(px, py, 12, 30, 0xa89c88, rand(0.5, 0.8), 0.35, nx * side * 40, ny * side * 30);
      if (Math.random() < 0.5) s.chunk(px, py, 2, nx * side * rand(30, 70), ny * side * rand(20, 50), rand(120, 220), rand(3, 5), 0x6e665c, 0.6);
    }
    V.sound('slam', x, y, mine ? 0.35 : 0.2);
  }

  /** Furrowmark: a soil furrow scored along `a` — a dark groove between two turned ridges — for `d` s. */
  private furrowGround(x: number, y: number, r: number, a: number, d: number): void {
    const s = this.V.sys, T = s.T;
    const len = lineLength('furrow', 160);
    const pts = linePoints(x, y, a, len, 32, 2);
    const nx = -Math.sin(a), ny = Math.cos(a), w = Math.min(9, r * 0.35);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const g = s.seg(s.gNormal, x0, y0, x1, y1, 8, 0x24180f, d, 0.62); g.fo = 0.75;
      for (const side of [-1, 1]) {
        const o = side * w;
        const ridge = s.seg(s.gNormal, x0 + nx * o, y0 + ny * o, x1 + nx * o, y1 + ny * o, 4, 0xa88a62, d, 0.55); ridge.fo = 0.75;
        const sh = s.seg(s.gNormal, x0 + nx * o * 0.5, y0 + ny * o * 0.5, x1 + nx * o * 0.5, y1 + ny * o * 0.5, 2, 0x3a2a1a, d, 0.4); sh.fo = 0.75;
      }
    }
    const soil = [0x6a5038, 0x7d6040, 0x4f3a28];
    for (let i = 0, n = Math.round(len / 12); i < n; i++) {
      const t = Math.random(), side = Math.random() < 0.5 ? -1 : 1, o = side * (w + rand(1, 5));
      const px = x + Math.cos(a) * len * t + nx * o, py = y + Math.sin(a) * len * t + ny * o;
      const c = s.gNormal.add(T.chunk[(Math.random() * 3) | 0], px, py, d);
      c.w0 = c.w1 = rand(4, 7); c.rotation = rand(0, TAU); c.a0 = 0.95; c.fi = 0.05; c.fo = 0.8; c.tintTo(soil[i % 3]);
      if (i % 3 === 0) s.dust(px, py, 12, 30, 0xa48a68, rand(0.5, 0.8), 0.32, nx * side * 50, ny * side * 35);
    }
  }

  // ─────────────────────────── ranger ───────────────────────────

  rain(x: number, y: number, r: number, d: number, el: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const light = el === EL_LIGHT, fire = el === EL_FIRE;
    const tint = light ? 0x6a5a9a : 0x000000;
    const shade = s.gNormal.hold(T.disc, x, y);
    shade.tintTo(tint);
    const rim = s.gAdd.hold(T.ringHard, x, y);
    rim.tintTo(light ? 0xa98bff : fire ? 0xff8a3d : 0xffe2a0);
    let age = 0, acc = 0, sndAt = 0;
    const rate = (light ? 7 : 42) * Math.max(0.6, r / 110);
    V.sound('rain', x, y);
    V.add({
      update: (dt) => {
        age += dt;
        const a = Math.min(clamp(age / 0.2, 0, 1), clamp((d - age) / 0.3, 0, 1));
        shade.place(x, y, 0); shade.setScale(r * 2, 1); shade.setAlpha((light ? 0.26 : 0.16) * a);
        rim.place(x, y, 0); rim.setScale(r * 2.1, 1); rim.setAlpha(0.35 * a);
        if (age > sndAt && !light) { sndAt = age + 0.45; V.sound('rain', x, y, 0.45); }
        acc += dt * rate * s.budget;
        while (acc > 1 && age < d - 0.1) {
          acc -= 1;
          const ang = rand(0, TAU), dd = Math.sqrt(Math.random()) * r * 0.95;
          const tx = x + Math.cos(ang) * dd, ty = y + Math.sin(ang) * dd;
          if (light) this.strike(tx, ty);
          else this.fallingArrow(tx, ty, fire);
        }
        return age < d;
      },
      kill: () => { s.gNormal.kill(shade); s.gAdd.kill(rim); },
    });
  }

  private fallingArrow(tx: number, ty: number, fire: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const t = 0.2, H = 420, DX = -70;
    const p = s.aBody.add(T.arrow, tx + DX, ty, t);
    p.z = H; p.vx = -DX / t; p.vz = -H / t; p.align = true; p.w0 = p.w1 = 40; p.fo = 1; p.a0 = 1;
    p.tintTo(0xffffff);
    if (fire) { const f = s.aAdd.add(T.flame, tx + DX, ty, t); f.z = H; f.vx = -DX / t; f.vz = -H / t; f.w0 = 14; f.w1 = 10; f.k = 1.4; f.fo = 1; f.rotation = Math.atan2(H, -DX) - Math.PI / 2; f.tintTo(0xff8a3d); }
    const st = s.aAdd.add(T.streak, tx + DX, ty, t);
    st.z = H; st.vx = -DX / t; st.vz = -H / t; st.align = true; st.anchorX = 0.9; st.w0 = st.w1 = 90; st.k = 0.45; st.a0 = 0.55; st.fo = 1;
    st.tintTo(fire ? 0xffa040 : 0xfff4d6);
    V.after(t, () => {
      s.dust(tx, ty, 8, 22, 0xc9b597, 0.4, 0.4);
      if (fire) { s.flash(tx, ty, 4, 30, 0xffa040, 0.1, 0.8); s.ember(tx, ty, 4, 0xff8a3d, 0.6, 4, 60); }
      else s.spark(tx, ty, 4, rand(-Math.PI, 0), rand(60, 120), 8, 0xfff0d0, 0.12);
      const stuck = s.gNormal.add(T.arrow, tx, ty - 6, 0.5);
      stuck.w0 = stuck.w1 = 16; stuck.rotation = -Math.PI / 2 + 0.35; stuck.a0 = 0.9; stuck.fo = 0.6; stuck.anchorX = 0.15;
    });
  }

  /** A lightning strike from the sky (Dark Cloud rune). */
  strike(tx: number, ty: number): void {
    const V = this.V, s = V.sys;
    const top = ty - 230;
    let px = tx + rand(-30, 30), py = top;
    const segs = 7;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const nx = tx + (i < segs ? rand(-18, 18) : 0), ny = top + (ty - top) * t;
      s.seg(s.aAdd, px, py, nx, ny, 7, 0x8f7bff, 0.16, 0.5);
      s.seg(s.aAdd, px, py, nx, ny, 2.2, 0xffffff, 0.12, 1);
      px = nx; py = ny;
    }
    s.flash(tx, ty, 4, 70, 0xe6dcff, 0.14, 1);
    for (let i = 0; i < 6; i++) s.spark(tx, ty, 4, rand(-Math.PI, 0), rand(120, 260), 10, 0xd6c2ff, 0.2, 500);
    this.combat.decal(V.T.scorch[0], tx, ty, 26, 0x000000, 0.22, 1.2);
    V.sound('zap', tx, ty, 0.6);
  }
}

// ─────────────────────────── warrior M1 props ───────────────────────────
// Original procedural art, painted once on a canvas at PROP_RES px per world unit (crisp at the game's zoom) and
// shown as Sprites / a MeshPlane in AoeFx's own prop layers (the shared particle atlas stays untouched).

interface Hatchet { owner: number; x: number; y: number; leg: number; seek: { x: number; y: number } | null; done: boolean }
interface Hole { owner: number; x: number; y: number; tx: number; ty: number; v: number; alive: boolean }
interface Banner { owner: number; x: number; y: number; carry: boolean; born: number; alive: boolean; end: () => void }

const PROP_RES = 3;
const CLOTH_VX = 10, CLOTH_VY = 3;
const POLE_H = 126;
const INK = 'rgba(27,20,16,0.95)';
const propCache = new Map<string, Texture>();

function propTex(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): Texture {
  const have = propCache.get(key);
  if (have) return have;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * PROP_RES); c.height = Math.ceil(h * PROP_RES);
  const g = c.getContext('2d')!;
  g.scale(PROP_RES, PROP_RES);
  g.lineJoin = 'round'; g.lineCap = 'round';
  paint(g);
  const source = new CanvasSource({ resource: c, resolution: PROP_RES, scaleMode: 'linear', autoGenerateMipmaps: true, label: `warrior-${key}` });
  const t = new Texture({ source });
  propCache.set(key, t);
  return t;
}

function vGrad(g: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

/** Hand hatchet, haft along +x, head at the right end: poll up, a flared bit with saw teeth pointing down, a red smear. */
function hatchetTex(): Texture {
  return propTex('hatchet', 36, 26, (g) => {
    g.beginPath(); g.roundRect(1.5, 10.2, 26, 4.6, 2.2);
    g.fillStyle = vGrad(g, 10, 15, [[0, '#b0804f'], [0.5, '#875a32'], [1, '#55351c']]); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.1; g.stroke();
    g.strokeStyle = 'rgba(40,22,10,0.85)'; g.lineWidth = 0.8;
    for (const x of [3.8, 5.8, 7.8, 9.8]) { g.beginPath(); g.moveTo(x, 10.6); g.lineTo(x + 1.3, 14.4); g.stroke(); }
    const bit = (u: number): [number, number] => [33.6 - u * 15, 20.6 + 0.9 * u + Math.sin(u * Math.PI) * 2.6];
    g.beginPath();
    g.moveTo(21.2, 9.6); g.lineTo(21.6, 4.4); g.quadraticCurveTo(25.2, 2.4, 29, 4); g.lineTo(29.4, 9.6);
    g.lineTo(29.8, 14.6); g.quadraticCurveTo(32, 17.2, 33.6, 20.6);
    const N = 8;
    for (let i = 1; i <= N; i++) {
      const [mx, my] = bit((i - 0.5) / N), [bx, by] = bit(i / N);
      g.lineTo(mx + 0.4, my + 1.7); g.lineTo(bx, by);
    }
    g.quadraticCurveTo(20.2, 18, 21.2, 14.8); g.closePath();
    g.fillStyle = vGrad(g, 3, 24, [[0, '#e6e3dc'], [0.45, '#b9b5ad'], [1, '#77736c']]); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.1; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.8;
    g.beginPath();
    for (let i = 0; i <= 12; i++) { const [x, y] = bit(i / 12); if (i) g.lineTo(x, y - 1.3); else g.moveTo(x, y - 1.3); }
    g.stroke();
    g.fillStyle = 'rgba(40,30,24,0.9)'; g.beginPath(); g.ellipse(25.3, 12.4, 1.5, 2.1, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(150,18,16,0.85)';
    g.beginPath(); g.ellipse(22.8, 19.6, 3.2, 1.5, -0.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(27.4, 21.8, 2.2, 1.1, 0.2, 0, Math.PI * 2); g.fill();
  });
}

/** Small bronze bell (anchor near the crown so it can swing). */
function bellTex(): Texture {
  return propTex('bell', 24, 26, (g) => {
    g.beginPath(); g.roundRect(9.8, 0.8, 4.4, 3.8, 1.4);
    g.fillStyle = '#b8862a'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
    g.beginPath();
    g.moveTo(12, 3.8); g.bezierCurveTo(6.4, 3.8, 5, 8.6, 5, 13.2); g.lineTo(5, 16.2); g.bezierCurveTo(5, 18.4, 3.2, 19.4, 2, 20.6);
    g.lineTo(22, 20.6); g.bezierCurveTo(20.8, 19.4, 19, 18.4, 19, 16.2); g.lineTo(19, 13.2); g.bezierCurveTo(19, 8.6, 17.6, 3.8, 12, 3.8); g.closePath();
    const gr = g.createLinearGradient(3, 0, 21, 0);
    gr.addColorStop(0, '#7a5414'); gr.addColorStop(0.3, '#f0cc66'); gr.addColorStop(0.55, '#c9962a'); gr.addColorStop(1, '#5e3e0c');
    g.fillStyle = gr; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.1; g.stroke();
    g.strokeStyle = 'rgba(70,46,10,0.6)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(5.4, 14); g.lineTo(18.6, 14); g.stroke();
    g.beginPath(); g.roundRect(1.4, 19.8, 21.2, 2.6, 1.2);
    g.fillStyle = '#e0ac40'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.arc(12, 23.6, 1.7, 0, Math.PI * 2); g.fillStyle = '#6e4a10'; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
    g.strokeStyle = 'rgba(255,250,220,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(8, 8.4); g.quadraticCurveTo(8.6, 5.8, 10.8, 5.2); g.stroke();
  });
}

/** Two pairs of sound-wave arcs either side of the bell (white, tinted at runtime). */
function waveTex(): Texture {
  return propTex('bellwaves', 44, 22, (g) => {
    g.strokeStyle = '#fff';
    for (const [r, w] of [[14, 1.8], [19, 1.4]] as const) {
      g.lineWidth = w;
      g.beginPath(); g.arc(22, 11, r, Math.PI * 0.8, Math.PI * 1.2); g.stroke();
      g.beginPath(); g.arc(22, 11, r, -Math.PI * 0.2, Math.PI * 0.2); g.stroke();
    }
  });
}

/** The standard's pole: iron spearhead, brass collar, dark ash shaft, iron shoe (anchor bottom centre). */
function poleTex(): Texture {
  return propTex('pole', 9, POLE_H, (g) => {
    g.beginPath(); g.moveTo(4.5, 0.5); g.lineTo(7.2, 7.4); g.lineTo(4.5, 10.6); g.lineTo(1.8, 7.4); g.closePath();
    const sg = g.createLinearGradient(1.8, 0, 7.2, 0); sg.addColorStop(0, '#f0ede6'); sg.addColorStop(0.5, '#b8b4ac'); sg.addColorStop(1, '#6e6a64');
    g.fillStyle = sg; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
    g.beginPath(); g.roundRect(2, 10.2, 5, 2.8, 1.1); g.fillStyle = '#c9a24a'; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke();
    g.beginPath(); g.roundRect(2.9, 12.6, 3.2, POLE_H - 16.6, 1.4);
    const wg = g.createLinearGradient(2.9, 0, 6.1, 0); wg.addColorStop(0, '#3e2714'); wg.addColorStop(0.4, '#94653a'); wg.addColorStop(1, '#2e1c0e');
    g.fillStyle = wg; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
    g.strokeStyle = 'rgba(255,230,190,0.18)'; g.lineWidth = 0.5;
    for (const y of [30, 58, 86]) { g.beginPath(); g.moveTo(4.2, y); g.lineTo(4.4, y + 14); g.stroke(); }
    g.beginPath(); g.roundRect(2.4, 52, 4.2, 2.2, 1); g.fillStyle = '#c9a24a'; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.7; g.stroke();
    g.beginPath(); g.moveTo(2.9, POLE_H - 4.2); g.lineTo(6.1, POLE_H - 4.2); g.lineTo(4.5, POLE_H - 0.4); g.closePath();
    g.fillStyle = '#6a6660'; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.7; g.stroke();
  });
}

/** Madder-red swallowtail banner with gold trim and a hearth sigil (an arch over a flame); left edge = the pole. */
function clothTex(): Texture {
  return propTex('cloth', 52, 34, (g) => {
    const shape = () => { g.beginPath(); g.moveTo(0, 1); g.lineTo(51, 1); g.lineTo(43, 17); g.lineTo(51, 33); g.lineTo(0, 33); g.closePath(); };
    shape();
    g.fillStyle = vGrad(g, 1, 33, [[0, '#c8452f'], [0.55, '#a8302a'], [1, '#781c1a']]); g.fill();
    g.save(); shape(); g.clip();
    for (const [x, a] of [[13, 0.14], [30, 0.12], [41, 0.1]] as const) {
      const fg = g.createLinearGradient(x - 5, 0, x + 5, 0);
      fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(0.5, `rgba(0,0,0,${a})`); fg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fg; g.fillRect(x - 5, 0, 10, 34);
    }
    g.strokeStyle = '#d9b25a'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, 3.6); g.lineTo(49.6, 3.6); g.stroke();
    g.beginPath(); g.moveTo(0, 30.4); g.lineTo(49.6, 30.4); g.stroke();
    g.restore();
    shape(); g.strokeStyle = INK; g.lineWidth = 1.1; g.stroke();
    const arch = () => { g.beginPath(); g.moveTo(13.6, 24); g.lineTo(13.6, 17.2); g.bezierCurveTo(13.6, 12.8, 17, 10.6, 20, 10.6); g.bezierCurveTo(23, 10.6, 26.4, 12.8, 26.4, 17.2); g.lineTo(26.4, 24); };
    arch(); g.strokeStyle = 'rgba(40,12,8,0.85)'; g.lineWidth = 3.6; g.stroke();
    arch(); g.strokeStyle = '#f2deaa'; g.lineWidth = 1.8; g.stroke();
    g.beginPath(); g.moveTo(11.4, 24.8); g.lineTo(28.6, 24.8); g.strokeStyle = 'rgba(40,12,8,0.85)'; g.lineWidth = 3.2; g.stroke();
    g.beginPath(); g.moveTo(11.4, 24.8); g.lineTo(28.6, 24.8); g.strokeStyle = '#f2deaa'; g.lineWidth = 1.6; g.stroke();
    g.beginPath();
    g.moveTo(20, 23); g.bezierCurveTo(17.4, 21.6, 17.4, 18.8, 19.1, 16.9); g.bezierCurveTo(19.1, 18.4, 20, 18.6, 20.6, 17.8);
    g.bezierCurveTo(20.6, 16.2, 20, 15, 20.7, 13.4); g.bezierCurveTo(23.4, 15.3, 23.8, 18.9, 22.3, 21.1); g.bezierCurveTo(21.8, 22.3, 21, 23, 20, 23); g.closePath();
    g.fillStyle = '#ffc35a'; g.fill(); g.strokeStyle = 'rgba(40,12,8,0.85)'; g.lineWidth = 0.8; g.stroke();
  });
}

function cairnVariant(x: number, y: number): number {
  return (Math.abs(Math.round(x) * 7 + Math.round(y) * 13) >> 2) & 1;
}

/** A cairn: four flat stones stacked, slightly off-centre (two variants; anchor at the base). */
function cairnTex(v: number): Texture {
  return propTex(`cairn${v}`, 48, 46, (g) => {
    const slabs = v === 0
      ? [[24, 39, 22, 6.5], [22.6, 30.4, 17, 5.6], [25.2, 22.8, 12.4, 4.8], [23.4, 16.4, 8, 3.8]]
      : [[24, 39.4, 21, 6.2], [25.6, 31, 16, 5.4], [22.8, 23.6, 13, 5], [24.8, 17, 7.6, 3.6]];
    slabs.forEach(([cx, cy, rx, ry], i) => {
      g.beginPath(); g.roundRect(cx - rx, cy - ry, rx * 2, ry * 2, ry);
      g.fillStyle = vGrad(g, cy - ry, cy + ry, [[0, '#d2cabb'], [0.42, '#9d9386'], [1, '#5c554b']]); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.1; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath(); g.ellipse(cx - rx * 0.12, cy - ry * 0.42, rx * 0.74, ry * 0.36, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(150,160,104,0.55)';
      g.beginPath(); g.arc(cx + rx * (i % 2 ? -0.5 : 0.45), cy + ry * 0.2, 1.1, 0, Math.PI * 2); g.fill();
      if (i === 0) {
        g.strokeStyle = 'rgba(30,24,18,0.6)'; g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(cx + 6, cy - 2); g.lineTo(cx + 9, cy + 1.5); g.lineTo(cx + 8, cy + 4.5); g.stroke();
      }
    });
  });
}

/** Length of a line data ground by its visual id (the event carries the half-width radius and the angle only). */
function lineLength(visual: string, fallback: number): number {
  for (const d of Object.values(GROUND_DEFS)) if (d.visual === visual && d.shape === 'line' && d.lineLength) return d.lineLength;
  return fallback;
}

/** A slightly jagged polyline from (x, y) along angle a for len units, one vertex every ~`step` (ends exact). */
function linePoints(x: number, y: number, a: number, len: number, step: number, jitter: number): [number, number][] {
  const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  const n = Math.max(2, Math.round(len / step));
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, off = i === 0 || i === n ? 0 : rand(-1, 1) * jitter;
    pts.push([x + ux * len * t + nx * off, y + uy * len * t + ny * off]);
  }
  return pts;
}

