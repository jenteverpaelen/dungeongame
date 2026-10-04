// Area effects (`aoe` events): impacts, lingering pools, the black hole, frost nova, stomps, slashes,
// fissures, arrow rain, explosions. Also exposes the building blocks (explosion, slam, iceBurst, cleave)
// that telegraphs and casts reuse.

import type { GameEvent } from '@shared/protocol';
import type { Effect, VfxCore } from './core';
import type { Combat } from './combat';
import type { Fx } from './particles';
import type { Slashes } from './slash';
import { EL_ARCANE, EL_COLD, EL_FIRE, EL_LIGHT, EL_PHYS, EL_POISON, TAU, clamp, easeIn, easeOut, lerpColor, pal, rand } from './util';

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

  constructor(private V: VfxCore, private combat: Combat, private slashes: Slashes) {}

  handle(ev: Aoe): void {
    const V = this.V;
    const delay = (ev.delay ?? 0) / 1000;
    if (ev.v === 'meteorSmall' || ev.v === 'meteor') {
      if (delay > 0.12) { this.smallFall(ev.x, ev.y, ev.r, delay, ev.el, ev.v === 'meteor'); return; }
    } else if (delay > 0) {
      V.after(delay, () => this.handle({ ...ev, delay: 0 }));
      return;
    }
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
      case 'molten': this.pool(ev.x, ev.y, r, Math.max(0.5, d), ev.el === EL_COLD ? 'frost' : 'lava'); break;
      case 'molten_trail': this.pool(ev.x, ev.y, r, Math.max(0.5, d), 'lava'); break;
      case 'poison_pool': this.pool(ev.x, ev.y, r, Math.max(0.5, d), 'goo'); break;
      case 'blackhole': this.blackhole(ev.x, ev.y, r, Math.max(0.4, d), ev.el); break;
      case 'nova': this.nova(ev.x, ev.y, r, ev.el, mine); break;
      case 'stomp': this.stomp(ev.x, ev.y, r, ev.el, mine); break;
      case 'rend': this.rend(ev.x, ev.y, r, ev.el); break;
      case 'fissure': this.fissure(ev.x, ev.y, r, ev.a ?? 0, ev.el, mine); break;
      case 'rain': this.rain(ev.x, ev.y, r, Math.max(0.6, d), ev.el); break;
      case 'cluster': this.explosion(ev.x, ev.y, r, ev.el === EL_PHYS ? EL_FIRE : ev.el, 1.2, mine); break;
      case 'grenade': this.explosion(ev.x, ev.y, r, ev.el === EL_PHYS ? EL_FIRE : ev.el, 0.7, mine); break;
      case 'explode': this.explosion(ev.x, ev.y, r, ev.el, 1, mine); break;
      case 'dustdevil_hit': this.dustdevil(ev.x, ev.y, r); break;
      case 'whirl': this.whirl(ev.x, ev.y, r, ev.el); break;
      case 'cleave':
        if (V.consume('cleave', ev.x, ev.y, 0.15, 40)) break;
        this.cleave(ev.x, ev.y, r, ev.a ?? 0, ev.el, false);
        break;
      case 'chain': this.chainZap(ev.x, ev.y, r); break;
      case 'slam': this.slam(ev.x, ev.y, r, ev.el, 1); break;
      default: this.explosion(ev.x, ev.y, r, ev.el, 0.8, mine);
    }
  }

  // ─────────────────────────── explosions ───────────────────────────

  explosion(x: number, y: number, r: number, el: number, power: number, mine = false): void {
    const V = this.V, s = V.sys, T = s.T;
    const P = pal(el);
    const k = power;
    const z = 12;
    if (el === EL_LIGHT) {
      s.flash(x, y, z, r * 3, 0xffffff, 0.12, 1);
      s.flash(x, y, z, r * 2, 0xb9a2ff, 0.3, 0.8);
      s.ring(s.gAdd, T.ringThick, x, y, r * 0.2, r * 1.1, 0xa98bff, 0.3, 0.9);
      for (let i = 0; i < 5; i++) this.combat.zigzag(x, y - z, rand(0, TAU), r * rand(0.6, 1.1), 0xe6dcff, 0.18, 2.6);
      for (let i = 0, n = s.n(14 * k); i < n; i++) s.spark(x, y, z, rand(0, TAU), rand(200, 420), 14, i % 2 ? 0xffffff : 0xb9a2ff, 0.28, 400);
      this.combat.decal(T.scorch[0], x, y, r * 1.2, 0x000000, 0.35, 2.5);
      V.sound('zap', x, y);
      V.sound(power > 1 ? 'explode' : 'grenade', x, y, 0.6);
      return;
    }
    if (el === EL_COLD) { this.iceBurst(x, y, r); return; }
    const smokeCol = el === EL_POISON ? 0x5f8f3a : el === EL_ARCANE ? 0x3a2a50 : 0x3e3530;
    s.flash(x, y, z, r * 2.8, P.hot, 0.12, 1);
    const fb = s.aAdd.add(T.glow, x, y, 0.38 + 0.1 * k);
    fb.z = z + 8; fb.w0 = r * 0.9; fb.w1 = r * 2.6; fb.se = 3; fb.fo = 0.15; fb.a0 = 0.95; fb.tintFade(P.hot, P.main);
    s.ring(s.gAdd, T.ringThick, x, y, r * 0.25, r * 1.12, P.main, 0.32, 0.85);
    s.ring(s.gNormal, T.ringThick, x, y, r * 0.3, r * 1.3, 0x3a2e24, 0.45, 0.32);
    for (let i = 0, n = s.n(9 * k); i < n; i++) {
      const a = rand(0, TAU), d = rand(0, r * 0.6);
      const f = s.aAdd.add(T.flame, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, rand(0.28, 0.5));
      f.anchorY = 0.85; f.z = rand(0, 10); f.vz = rand(60, 140); f.vx = Math.cos(a) * 60; f.vy = Math.sin(a) * 30; f.drag = 2;
      f.w0 = rand(18, 30) * Math.max(0.7, r / 70); f.w1 = 4; f.k = 1.45; f.fo = 0.3; f.flick = 0.2;
      f.tintFade(P.hot, P.main);
    }
    for (let i = 0, n = s.n(14 * k); i < n; i++) s.spark(x, y, z, rand(0, TAU), rand(200, 440) * Math.max(0.8, r / 80), rand(10, 18), lerpColor(P.hot, P.main, Math.random()), rand(0.25, 0.45), 700);
    for (let i = 0, n = s.n(6 * k); i < n; i++) s.smoke(x + rand(-r, r) * 0.4, y + rand(-r, r) * 0.2, z + rand(0, 20), r * 0.5, r * 1.3, smokeCol, rand(0.8, 1.3), 0.5, rand(30, 60));
    for (let i = 0, n = s.n(5 * k); i < n; i++) {
      const a = rand(0, TAU);
      s.chunk(x, y, z, Math.cos(a) * rand(80, 220), Math.sin(a) * rand(50, 130), rand(200, 380), rand(5, 9), 0x2e2622, rand(0.7, 1.1));
    }
    for (let i = 0, n = s.n(8 * k); i < n; i++) s.ember(x + rand(-r, r) * 0.5, y, rand(4, 30), P.main, rand(0.7, 1.2), 4, 80);
    if (el === EL_POISON) this.combat.decal(T.poolGoo, x, y, r * 1.4, 0x5fae3a, 0.6, 3);
    else this.combat.decal(T.scorch[(Math.random() * 2) | 0], x, y, r * 1.6, 0x000000, 0.55, 4);
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
    const fb = s.aAdd.add(T.glow, x, y, 0.55 * k + 0.1);
    fb.z = 20; fb.w0 = r * 1.1; fb.w1 = r * 2.8; fb.se = 3; fb.fo = 0.1; fb.a0 = 1; fb.tintFade(P.hot, P.main);
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
      for (let i = 0, n = s.n(small ? 3 : 8); i < n; i++) s.smoke(x + rand(-r, r) * 0.4, y, rand(10, 40), r * 0.6 * k + 20, r * 1.6 * k + 30, 0x352c27, rand(1.2, 2.0), 0.5, rand(40, 80));
      this.combat.decal(T.scorch[(Math.random() * 2) | 0], x, y, r * 2.3 * k, 0x000000, 0.7, 6);
      const cr = s.gAdd.add(T.crack[(Math.random() * 2) | 0], x, y, 2.6 * k + 0.6);
      cr.w0 = cr.w1 = r * 1.7 * k; cr.rotation = rand(0, TAU); cr.a0 = 1; cr.fo = 0.25; cr.tintFade(0xffb040, 0x601000);
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

  pool(x: number, y: number, r: number, d: number, kind: 'lava' | 'goo' | 'frost'): void {
    const V = this.V, s = V.sys, T = s.T;
    const tex = kind === 'lava' ? T.poolLava : kind === 'goo' ? T.poolGoo : T.frostPatch;
    const layer = kind === 'frost' ? s.gAdd : s.gNormal;
    const base = layer.hold(tex, x, y);
    base.tintTo(kind === 'goo' ? 0x6fbf3a : kind === 'frost' ? 0xbfe9ff : 0xffffff);
    base.rotation = rand(0, TAU);
    const glow = s.gAdd.hold(T.glow, x, y);
    glow.tintTo(kind === 'lava' ? 0xff6a10 : kind === 'goo' ? 0x7fdc4a : 0x7fd8ff);
    const w = r * 2.25;
    let age = 0, acc = 0;
    V.add({
      update: (dt) => {
        age += dt;
        const fin = clamp(age / 0.25, 0, 1), fout = clamp((d - age) / 0.5, 0, 1);
        const a = Math.min(fin, fout);
        base.place(x, y, 0);
        base.setScale(w * (0.75 + 0.25 * easeOut(fin)));
        base.rotation += dt * 0.05;
        base.setAlpha((kind === 'goo' ? 0.82 : kind === 'frost' ? 0.6 : 0.95) * a);
        glow.place(x, y, 0);
        glow.setScale(w * 1.25);
        glow.setAlpha((kind === 'lava' ? 0.3 : 0.16) * a * (0.85 + 0.15 * Math.sin(age * 3 + x)));
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

  blackhole(x: number, y: number, r: number, d: number, el: number): void {
    const V = this.V, s = V.sys, T = s.T;
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
          s.ring(s.gAdd, T.ringThick, x, y, r * 0.1, r * 1.1, main, 0.35, 1);
          for (let i = 0, n = s.n(16); i < n; i++) s.spark(x, y, 10, rand(0, TAU), rand(160, 360), 12, i % 2 ? hot : main, 0.3);
          if (cold) this.iceBurst(x, y, r * 0.6);
          return false;
        }
        return true;
      },
      kill: () => {
        for (const p of parts) s.aAdd.kill(p);
        for (const m of motes) s.aAdd.kill(m.p);
      },
    });
  }

  // ─────────────────────────── frost nova ───────────────────────────

  nova(x: number, y: number, r: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    void el;
    const exp = 0.28;
    s.flash(x, y, 20, r * 1.4, 0xe8fbff, 0.16, 1);
    s.ring(s.gAdd, T.ringThick, x, y, r * 0.1, r, 0x7fd8ff, exp + 0.25, 1);
    s.ring(s.aAdd, T.ringHard, x, y, r * 0.1, r * 1.03, 0xffffff, exp + 0.12, 0.9, 2);
    this.combat.decal(T.frostPatch, x, y, r * 2.15, 0xbfe9ff, 0.55, 2.2, s.gAdd);
    this.combat.decal(T.frostPatch, x, y, r * 2.1, 0xe6f6ff, 0.3, 2.6);
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
        p.anchorY = 0.95; p.w0 = rand(8, 12); p.w1 = rand(16, 22); p.se = 3; p.k = 1; p.fi = 0.04; p.fo = 0.7;
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
      s.dust(x + Math.cos(a) * 14, y + Math.sin(a) * 10, r * 0.35, r * 0.75, 0xb8a284, rand(0.6, 0.9), 0.5, Math.cos(a) * r * 3.2, Math.sin(a) * r * 2.4);
    }
    for (let i = 0, n = s.n(10); i < n; i++) {
      const a = rand(0, TAU), sp = rand(60, 180);
      s.chunk(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.2, 2, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(220, 420), rand(6, 11), i % 2 ? 0x8a7a66 : 0x6a5a4a, rand(0.8, 1.2));
    }
    const cr = s.gNormal.add(T.crack[(Math.random() * 2) | 0], x, y, 2.6);
    cr.w0 = r * 1.2; cr.w1 = r * 1.5; cr.se = 3; cr.rotation = rand(0, TAU); cr.a0 = 0.6; cr.fo = 0.55; cr.tintTo(0x241a12);
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
        this.slashes.spawn({ tex: T.swipe, x, y, z: WAIST - 4 + i * 4, r: r * 0.95, rot: base + i * 2.1, vr: 9, life: 0.26, color: i === 1 ? 0xff7080 : col, alpha: 0.95, grow: [0.85, 1.05] });
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
      const lat = 1 + Math.floor(width / 34);
      V.after(i * 0.032, () => {
        for (let j = 0; j < lat; j++) {
          const off = lat === 1 ? 0 : (j / (lat - 1) - 0.5) * 2 * width * 0.8;
          const px = x + Math.cos(a) * d - Math.sin(a) * off + rand(-6, 6);
          const py = y + Math.sin(a) * d + Math.cos(a) * off + rand(-6, 6);
          const sp = s.aBody.add(T.spike[(i + j) % 2], px, py, rand(0.55, 0.8));
          sp.anchorY = 0.95; sp.w0 = 4; sp.w1 = rand(16, 24) * (0.8 + d / r * 0.4); sp.se = 3; sp.fo = 0.55; sp.fi = 0.02;
          sp.tintTo(spikeCol);
          s.dust(px, py, 16, 44, cold ? 0xdff4ff : 0xa89070, rand(0.5, 0.8), 0.5, rand(-30, 30), rand(-20, 20));
          if (Math.random() < 0.6) s.chunk(px, py, 4, rand(-60, 60), rand(-30, 30), rand(180, 320), rand(5, 9), cold ? 0xd8f4ff : 0x6a5a4a, 0.8);
          if (fire) { s.ember(px, py, 6, 0xff8a3d, rand(0.5, 0.9), 5, 90); const g = s.gAdd.add(T.glow, px, py, 0.5); g.w0 = 30; g.w1 = 40; g.a0 = 0.5; g.fo = 0.3; g.k = 0.6; g.tintTo(0xff6a10); }
          if (cold) s.glint(px, py, 14, 12, 0xffffff, 0.3);
        }
        if (i % 2 === 0) {
          const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
          const cr = (fire ? s.gAdd : s.gNormal).add(T.crack[i % 2], cx, cy, 2.4);
          cr.w0 = cr.w1 = Math.max(70, width * 2.2); cr.rotation = rand(0, TAU); cr.a0 = fire ? 0.9 : 0.55; cr.fo = 0.5;
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
    this.slashes.spawn({ tex: T.whirl, x, y, z: WAIST, r: r * 0.95, rot: rand(0, TAU), vr: 16, life: 0.3, color: col, alpha: 0.6, grow: [0.95, 1.05], fadeIn: 0.15 });
    for (let i = 0, n = s.n(2); i < n; i++) {
      const a = rand(0, TAU);
      s.dust(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.5, 16, 40, 0xc9b597, rand(0.4, 0.6), 0.32, -Math.sin(a) * 120, Math.cos(a) * 80);
    }
    if (el === EL_FIRE) for (let i = 0; i < 2; i++) s.ember(x + rand(-r, r) * 0.6, y, 10, 0xff8a3d, 0.6, 5, 60);
  }

  /** Cleave arc toward angle `a` (radius r). */
  cleave(x: number, y: number, r: number, a: number, el: number, wide: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const light = el === EL_LIGHT;
    const col = light ? 0xb9a2ff : el === EL_FIRE ? 0xff9a4a : 0xfff0d8;
    const sweep = 0.9, life = 0.2;
    // Swing from the back of the arc through the target direction (the bright head ends just past `a`).
    const dir = Math.cos(a) >= 0 ? 1 : -1;
    this.slashes.spawn({ tex: wide ? T.swipeWide : T.swipe, x, y, z: WAIST, r, rot: a - dir * sweep * 0.65, vr: (dir * sweep) / life, life, color: col, alpha: 1, grow: [0.9, 1.04], fadeIn: 0.08 });
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
      s.dust(x + Math.cos(a) * 10, y + Math.sin(a) * 8, r * 0.3, r * 0.7, el === EL_POISON ? 0x7fae4a : 0xb8a284, rand(0.5, 0.8), 0.45, Math.cos(a) * r * 2.6, Math.sin(a) * r * 2);
    }
    for (let i = 0, n = s.n(6 * scale); i < n; i++) {
      const a = rand(0, TAU), sp = rand(60, 160);
      s.chunk(x, y, 4, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(200, 360), rand(5, 9), el === EL_POISON ? 0x7fce4a : 0x7a6a56, rand(0.7, 1.1), el === EL_POISON ? T.dot : undefined);
    }
    const cr = s.gNormal.add(T.crack[(Math.random() * 2) | 0], x, y, 2);
    cr.w0 = r * 1.1; cr.w1 = r * 1.35; cr.se = 3; cr.rotation = rand(0, TAU); cr.a0 = 0.5; cr.fo = 0.5; cr.tintTo(0x241a12);
    if (el === EL_FIRE) for (let i = 0, n = s.n(10); i < n; i++) s.ember(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.4, 2, 0xff8a3d, rand(0.6, 1), 5, 80);
    if (el === EL_POISON) this.combat.decal(T.poolGoo, x, y, r * 1.3, 0x5fae3a, 0.6, 2.5);
    V.shakeNear(x, y, r >= 110 ? 6 : 3, r >= 110 ? 200 : 120);
    V.sound('slam', x, y, r >= 110 ? 1 : 0.6);
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
    const clouds: Fx[] = [];
    if (light) {
      for (let i = 0; i < 5; i++) {
        const c = s.aSmoke.hold(T.smoke[i % 3], x + rand(-r, r) * 0.6, y);
        c.tintTo(0x2a2438); c.rotation = rand(0, TAU); c.u = rand(-r, r) * 0.6;
        clouds.push(c);
      }
    }
    let age = 0, acc = 0, sndAt = 0;
    const rate = (light ? 7 : 22) * Math.max(0.6, r / 110);
    V.sound('rain', x, y);
    V.add({
      update: (dt) => {
        age += dt;
        const a = Math.min(clamp(age / 0.2, 0, 1), clamp((d - age) / 0.3, 0, 1));
        shade.place(x, y, 0); shade.setScale(r * 2, 1); shade.setAlpha(0.16 * a);
        rim.place(x, y, 0); rim.setScale(r * 2.1, 1); rim.setAlpha(0.35 * a);
        for (const c of clouds) {
          c.place(x + c.u + Math.sin(age * 0.8 + c.u) * 10, y - 6, 300);
          c.setScale(r * 0.9, 0.55); c.setAlpha(0.5 * a); c.rotation += dt * 0.2;
        }
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
      kill: () => { s.gNormal.kill(shade); s.gAdd.kill(rim); for (const c of clouds) s.aSmoke.kill(c); },
    });
  }

  private fallingArrow(tx: number, ty: number, fire: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const t = 0.2, H = 420, DX = -70;
    const p = s.aBody.add(T.arrow, tx + DX, ty, t);
    p.z = H; p.vx = -DX / t; p.vz = -H / t; p.align = true; p.w0 = p.w1 = 30; p.fo = 1; p.a0 = 1;
    p.tintTo(0xffffff);
    if (fire) { const f = s.aAdd.add(T.flame, tx + DX, ty, t); f.z = H; f.vx = -DX / t; f.vz = -H / t; f.w0 = 14; f.w1 = 10; f.k = 1.4; f.fo = 1; f.rotation = Math.atan2(H, -DX) - Math.PI / 2; f.tintTo(0xff8a3d); }
    const st = s.aAdd.add(T.streak, tx + DX, ty, t);
    st.z = H; st.vx = -DX / t; st.vz = -H / t; st.align = true; st.anchorX = 0.9; st.w0 = st.w1 = 60; st.k = 0.4; st.a0 = 0.35; st.fo = 1;
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
    const top = ty - 300;
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
    this.combat.decal(V.T.scorch[0], tx, ty, 34, 0x000000, 0.4, 1.5);
    V.sound('zap', tx, ty, 0.6);
  }
}

