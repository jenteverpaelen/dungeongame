// Beams (`beam` events): sentry chain lightning, Electrify arcs and the Vortex elite's tether; ranger M1 ropes, wires,
// heron spear thrusts, flock / cloud lightning and the Quarry Mark's jump.

import type { GameEvent } from '@shared/protocol';
import type { VfxCore } from './core';
import { EL_COLD, EL_FIRE, TAU, clamp, easeIn, easeInOut, lerpColor, pal, rand } from './util';

type Beam = Extract<GameEvent, { e: 'beam' }>;

export class Beams {
  private lastChainSnd = -1;

  constructor(private V: VfxCore) {}

  handle(ev: Beam): void {
    const d = Math.max(0.12, ev.d / 1000);
    switch (ev.v) {
      case 'vortex': this.tether(ev.x, ev.y, ev.tx, ev.ty, d); break;
      case 'arc': this.lightning(ev.x, ev.y, ev.tx, ev.ty, Math.max(0.16, d), 26, ev.el, true); break;
      case 'splinter': this.splinter(ev.x, ev.y, ev.tx, ev.ty, d, ev.el); break;
      // ── ranger M1 (docs/rework/depth/RANGER.md §3–§5) ──
      case 'snare_tether': this.rope(ev.x, ev.y, ev.tx, ev.ty, Math.max(0.25, d)); break;
      case 'snare_wire': this.wire(ev.x, ev.y, ev.tx, ev.ty, Math.max(0.3, d)); break;
      case 'heron_spear': this.spear(ev.x, ev.y, ev.tx, ev.ty, ev.el); break;
      case 'flock_arc': this.lightningZ(ev.x, ev.y, 84, ev.tx, ev.ty, 22, Math.max(0.16, d), true); break;
      case 'volley_bolt': this.lightningZ(ev.tx, ev.ty, 220, ev.tx, ev.ty, 4, Math.max(0.16, d), true, ev.x, ev.y); break;
      case 'quarry_jump': this.markJump(ev.x, ev.y, ev.tx, ev.ty, Math.max(0.25, d)); break;
      default: this.lightning(ev.x, ev.y, ev.tx, ev.ty, d, 30, ev.el, false);
    }
  }

  /** Chain Snare: a hemp rope from the sprung snare snaking out to an enemy, then hauling it 60 units in. */
  private rope(x0: number, y0: number, x1: number, y1: number, d: number): void {
    const V = this.V, s = V.sys;
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
    const pull = Math.min(60, len * 0.6);
    const out = Math.min(0.12, d * 0.35);
    let age = 0;
    V.sound('rope_whip', x1, y1, 0.7);
    V.add({
      update: (dt) => {
        age += dt;
        // out: the rope's head flies to the enemy; then the enemy end slides `pull` units back toward the snare
        const reach = clamp(age / out, 0, 1);
        const haul = easeIn(clamp((age - out) / Math.max(0.05, d - out), 0, 1));
        const ex = x1 - ux * pull * haul, ey = y1 - uy * pull * haul;
        const hx = x0 + (ex - x0) * reach, hy = y0 + (ey - y0) * reach;
        const L = Math.hypot(hx - x0, hy - y0);
        const slack = (1 - haul) * Math.min(14, L * 0.12) * (reach < 1 ? 1.6 : 1);
        const n = 10;
        let px = x0, py = y0 - 4;
        for (let i = 1; i <= n; i++) {
          const f = i / n;
          const sag = Math.sin(f * Math.PI) * slack + Math.sin(f * 9 - age * 30) * 2 * (1 - haul);
          const qx = x0 + (hx - x0) * f + nx * sag, qy = y0 + (hy - y0) * f + ny * sag - 4 - f * 10 * (1 - f) * 2;
          s.seg(s.aBody, px, py, qx, qy, 3.6, 0x2a1c10, 0.04, 0.9);
          s.seg(s.aBody, px, py, qx, qy, 2.2, i % 2 ? 0xb08a58 : 0x9a7b4f, 0.04, 1);
          px = qx; py = qy;
        }
        if (reach >= 1 && Math.random() < 0.5 * s.budget) s.dust(ex, ey, 8, 22, 0xb8a284, 0.35, 0.3, -ux * 60, -uy * 40);
        return age < d;
      },
      kill: () => undefined,
    });
  }

  /** Tripwire: a taut iron wire low across the ground between two snares; it twangs when it appears. */
  private wire(x0: number, y0: number, x1: number, y1: number, d: number): void {
    const V = this.V, s = V.sys;
    const L = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
    let age = 0, glintT = 0;
    V.sound('snare_arm', (x0 + x1) / 2, (y0 + y1) / 2, 0.5);
    V.add({
      update: (dt) => {
        age += dt;
        const a = Math.min(clamp(age / 0.08, 0, 1), clamp((d - age) / 0.2, 0, 1));
        const vib = Math.exp(-age * 7) * 4;
        const n = 6;
        let px = x0, py = y0 - 5;
        for (let i = 1; i <= n; i++) {
          const f = i / n;
          const w = Math.sin(f * Math.PI) * Math.sin(age * 70) * vib;
          const qx = x0 + (x1 - x0) * f + nx * w, qy = y0 + (y1 - y0) * f - 5 + ny * w;
          s.seg(s.aBody, px, py, qx, qy, 1.6, 0x3a3e44, 0.04, 0.85 * a);
          s.seg(s.aAdd, px, py, qx, qy, 1, 0xdfe6ee, 0.04, 0.45 * a);
          px = qx; py = qy;
        }
        if ((glintT -= dt) <= 0) { glintT = 0.35; const f = Math.random(); s.glint(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 5, 9, 0xf0f6ff, 0.25, 0.8 * a); }
        return age < d;
      },
      kill: () => undefined,
    });
  }

  /** Heron: a quick pale spear-thrust of the beak along the line, a sharp tip flash and a splash where it lands. */
  private spear(x0: number, y0: number, x1: number, y1: number, el: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const cold = el === EL_COLD;
    const z0 = 34, z1 = 22, travel = 0.09;
    const ang = Math.atan2(y1 - z1 - (y0 - z0), x1 - x0);
    const vx = (x1 - x0) / travel, vy = (y1 - y0) / travel;
    const tip = s.aAdd.add(T.streak, x0, y0, travel);
    tip.z = z0; tip.vx = vx; tip.vy = vy; tip.vz = (z1 - z0) / travel; tip.align = true; tip.anchorX = 0.95; tip.w0 = 46; tip.w1 = 70; tip.k = 0.32; tip.a0 = 0.9; tip.fo = 0.8;
    tip.tintTo(cold ? 0xd8f4ff : 0xf4f0e0);
    const line = s.seg(s.aAdd, x0, y0 - z0, x1, y1 - z1, 2.2, cold ? 0xbfeaff : 0xe8e2d0, 0.16, 0.5);
    line.fo = 0.05;
    V.after(travel, () => {
      s.flash(x1, y1, z1, 26, cold ? 0xe8fbff : 0xfff6e0, 0.07, 0.8);
      for (let i = 0; i < 3; i++) s.spark(x1, y1, z1, ang + rand(-0.5, 0.5), rand(120, 220), 10, cold ? 0xd8f4ff : 0xf0e8d0, 0.14);
      for (let i = 0, n = s.n(4); i < n; i++) {
        const p = s.aAdd.add(T.drip, x1, y1, rand(0.3, 0.45));
        p.z = z1; p.vx = Math.cos(ang) * rand(40, 90) + rand(-30, 30); p.vy = rand(-20, 20); p.vz = rand(60, 120); p.gz = 600;
        p.align = true; p.w0 = 3.5; p.w1 = 2; p.k = 1.3; p.fo = 0.5; p.tintTo(cold ? 0xc8f0ff : 0xd8eef2);
      }
      if (cold) for (let i = 0; i < 2; i++) s.glint(x1 + rand(-8, 8), y1, z1 + rand(-6, 6), 11, 0xe8fbff, 0.28);
    });
    V.sound('heron_spear', x1, y1, 0.7);
  }

  /** Lightning between two heights (Stormbirds: flock → enemy; Storm Shelf: cloud → enemy, from (sx, sy) above). */
  private lightningZ(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, d: number, fork: boolean, sx?: number, sy?: number): void {
    const V = this.V, s = V.sys;
    if (sx !== undefined && sy !== undefined) { x0 = sx + rand(-20, 20); y0 = sy; }
    const ax = x0, ay = y0 - z0, bx = x1, by = y1 - z1;
    let age = 0, next = 0;
    V.sound('zap', x1, y1, 0.7);
    s.flash(x1, y1, z1, 54, 0xe6dcff, 0.12, 0.9);
    for (let i = 0, n = s.n(5); i < n; i++) s.spark(x1, y1, z1, rand(-Math.PI, 0), rand(120, 240), 10, 0xd6c2ff, 0.2, 500);
    V.add({
      update: (dt) => {
        age += dt;
        if (age >= next && age < d) {
          next = age + 0.05;
          const pts = jagged(ax, ay, bx, by, 0.16);
          const life = 0.085;
          for (let i = 1; i < pts.length; i++) {
            const [px, py] = pts[i - 1], [qx, qy] = pts[i];
            s.seg(s.aAdd, px, py, qx, qy, 12, 0x8f7bff, life, 0.4);
            s.seg(s.aAdd, px, py, qx, qy, 2.4, 0xffffff, life, 1);
          }
          if (fork && Math.random() < 0.6) {
            const [fx, fy] = pts[(pts.length / 2) | 0];
            const a = Math.atan2(by - ay, bx - ax) + rand(-1, 1);
            const len = Math.hypot(bx - ax, by - ay) * rand(0.12, 0.25);
            const fp = jagged(fx, fy, fx + Math.cos(a) * len, fy + Math.sin(a) * len, 0.3);
            for (let i = 1; i < fp.length; i++) s.seg(s.aAdd, fp[i - 1][0], fp[i - 1][1], fp[i][0], fp[i][1], 1.5, 0xe6dcff, life, 0.8);
          }
        }
        return age < d;
      },
      kill: () => undefined,
    });
  }

  /** Quarry Mark jumps: a pale feathered streak arcing from the fallen quarry to the new one, a soft chime. */
  private markJump(x0: number, y0: number, x1: number, y1: number, d: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const travel = Math.min(0.32, d);
    const L = Math.hypot(x1 - x0, y1 - y0);
    const H = clamp(L * 0.35, 40, 140);
    const head = s.aAdd.hold(T.glow, x0, y0);
    head.tintTo(0xfff4d6);
    const quill = s.aBody.hold(T.feather, x0, y0);
    quill.tintTo(0xf6edd2);
    let age = 0, lx = x0, ly = y0 - 60, acc = 0;
    V.sound('quarry_chime', x1, y1, 0.8);
    V.add({
      update: (dt) => {
        age += dt;
        const t = clamp(age / travel, 0, 1);
        const e = easeInOut(t);
        const x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e;
        const z = 60 + 4 * H * e * (1 - e);
        head.place(x, y, z); head.setScale(26); head.setAlpha(0.8 * (1 - t * 0.3));
        quill.place(x, y, z); quill.rotation = Math.atan2(y - z - ly, x - lx); quill.setScale(18); quill.setAlpha(1);
        const moved = Math.hypot(x - lx, y - z - ly);
        acc += moved;
        while (acc > 6) {
          acc -= 6;
          const f = s.aAdd.add(T.dot, x + rand(-2, 2), y, 0.4);
          f.z = z + rand(-2, 2); f.w0 = 7; f.w1 = 1.5; f.a0 = 0.7; f.fo = 0.2; f.tintTo(0xf6edd2);
        }
        lx = x; ly = y - z;
        if (t >= 1) {
          s.flash(x1, y1, 60, 46, 0xfff6dc, 0.12, 0.8);
          s.ring(s.aAdd, T.ringHard, x1, y1, 6, 30, 0xf6e6b0, 0.3, 0.7, 60);
          return false;
        }
        return true;
      },
      kill: () => { s.aAdd.kill(head); s.aBody.kill(quill); },
    });
  }

  /** Sawtooth Hatchet · Splinters: a thin, fast red splinter streaking from the struck elite to a nearby enemy. */
  splinter(x0: number, y0: number, x1: number, y1: number, d: number, el: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const fire = el === EL_FIRE;
    const z = 22;
    const travel = Math.min(d, 0.12);
    const vx = (x1 - x0) / travel, vy = (y1 - y0) / travel;
    const glow = s.aAdd.add(T.streak, x0, y0, travel);
    glow.z = z; glow.vx = vx; glow.vy = vy; glow.align = true; glow.anchorX = 0.9; glow.w0 = glow.w1 = 40; glow.k = 0.3; glow.a0 = 0.9; glow.fo = 0.8;
    glow.tintTo(fire ? 0xff9a4a : 0xff4a3a);
    const body = s.aBody.add(T.spark, x0, y0, travel);
    body.z = z; body.vx = vx; body.vy = vy; body.align = true; body.w0 = body.w1 = 15; body.k = 0.4; body.a0 = 1; body.fo = 0.9;
    body.tintTo(fire ? 0xc0581e : 0x8a1c14);
    const line = s.seg(s.aAdd, x0, y0 - z, x1, y1 - z, 2, fire ? 0xff8a3d : 0xd0281e, Math.max(0.12, d), 0.45);
    line.fo = 0.1;
    V.after(travel, () => {
      s.flash(x1, y1, z, 22, fire ? 0xffb070 : 0xff7a6a, 0.07, 0.6);
      for (let i = 0, n = s.n(4); i < n; i++) {
        const p = s.aBody.add(T.drip, x1, y1, rand(0.35, 0.55));
        p.z = z; p.vx = vx * 0.08 + rand(-50, 50); p.vy = vy * 0.08 + rand(-25, 25); p.vz = rand(40, 110); p.gz = 600;
        p.w0 = rand(3, 5); p.w1 = 2.4; p.align = true; p.fo = 0.6; p.k = 1.2;
        p.tintTo(fire ? 0xd85a20 : 0xa8161e);
      }
    });
  }

  /** Crackling bolt between two points, re-jagged every 50 ms. */
  lightning(x0: number, y0: number, x1: number, y1: number, d: number, z: number, el: number, fork: boolean): void {
    const V = this.V, s = V.sys;
    const P = el === EL_FIRE || el === EL_COLD ? pal(el) : { main: 0x8f7bff, hot: 0xffffff };
    const glowCol = el === EL_FIRE || el === EL_COLD ? P.main : 0x8f7bff;
    const ax = x0, ay = y0 - z, bx = x1, by = y1 - z;
    let age = 0, next = 0;
    const interval = 0.05;
    if (fork) {
      V.sound('zap', x1, y1, 0.8);
      s.flash(x1, y1, z, 60, 0xe6dcff, 0.14, 1);
      for (let i = 0, n = s.n(6); i < n; i++) s.spark(x1, y1, z, rand(0, TAU), rand(140, 280), 10, 0xd6c2ff, 0.2);
    } else if (V.real - this.lastChainSnd > 0.45) {
      this.lastChainSnd = V.real;
      V.sound('chain', (x0 + x1) / 2, (y0 + y1) / 2);
    }
    V.add({
      update: (dt) => {
        age += dt;
        if (age >= next && age < d) {
          next = age + interval;
          const pts = jagged(ax, ay, bx, by, fork ? 0.22 : 0.17);
          const life = interval * 1.7;
          for (let i = 1; i < pts.length; i += 1) {
            const [px, py] = pts[i - 1], [qx, qy] = pts[i];
            s.seg(s.aAdd, px, py, qx, qy, 16, glowCol, life, 0.4);
            s.seg(s.aAdd, px, py, qx, qy, 6, lerpColor(glowCol, 0xffffff, 0.5), life, 0.55);
            s.seg(s.aAdd, px, py, qx, qy, 2.6, P.hot, life, 1);
          }
          if (fork && Math.random() < 0.8) {
            const [fx, fy] = pts[(pts.length / 2) | 0];
            const a = Math.atan2(by - ay, bx - ax) + rand(-1, 1);
            const len = Math.hypot(bx - ax, by - ay) * rand(0.15, 0.3);
            const fp = jagged(fx, fy, fx + Math.cos(a) * len, fy + Math.sin(a) * len, 0.3);
            for (let i = 1; i < fp.length; i++) s.seg(s.aAdd, fp[i - 1][0], fp[i - 1][1], fp[i][0], fp[i][1], 1.6, 0xe6dcff, life, 0.8);
          }
          for (const [ex, ey] of [[ax, ay], [bx, by]]) {
            const g = s.aAdd.add(s.T.glow, ex, ey, life);
            g.w0 = 50; g.w1 = 36; g.a0 = 0.8; g.fo = 0; g.tintTo(glowCol);
          }
        }
        return age < d;
      },
      kill: () => undefined,
    });
  }

  /** Vortex: a purple tether yanking the target toward the elite. */
  tether(x0: number, y0: number, x1: number, y1: number, d: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const z = 28;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / (len || 1), uy = (y1 - y0) / (len || 1);
    const endX = x0 + ux * 50, endY = y0 + uy * 50;
    const swirl = s.aAdd.hold(T.swirl, x0, y0);
    swirl.tintTo(0xb070ff);
    let age = 0;
    V.sound('vortex', x0, y0);
    V.add({
      update: (dt) => {
        age += dt;
        const t = clamp(age / d, 0, 1);
        const e = easeIn(t);
        const tx = x1 + (endX - x1) * e, ty = y1 + (endY - y1) * e;
        const ax = x0, ay = y0 - z, bx = tx, by = ty - z;
        const L = Math.hypot(bx - ax, by - ay);
        const nx = -(by - ay) / (L || 1), ny = (bx - ax) / (L || 1);
        const n = 14;
        let px = ax, py = ay;
        for (let i = 1; i <= n; i++) {
          const f = i / n;
          const amp = Math.sin(f * Math.PI) * 9;
          const w = Math.sin(f * 10 - age * 24) * amp;
          const qx = ax + (bx - ax) * f + nx * w, qy = ay + (by - ay) * f + ny * w;
          s.seg(s.aAdd, px, py, qx, qy, 11, 0x8a4dff, 0.04, 0.5);
          s.seg(s.aAdd, px, py, qx, qy, 3, 0xf0d8ff, 0.04, 0.95);
          px = qx; py = qy;
        }
        if (Math.random() < 0.7 * s.budget) {
          const f = rand(0.2, 1);
          const m = s.aAdd.add(T.dot, ax + (bx - ax) * f, ay + (by - ay) * f + z, 0.25);
          m.z = z; m.vx = (ax - bx) * 2.2; m.vy = (ay - by) * 2.2; m.w0 = 6; m.w1 = 2; m.fo = 0.4; m.tintTo(0xd8b0ff);
        }
        swirl.place(x0, y0, z); swirl.setScale(70 + 10 * Math.sin(age * 10)); swirl.rotation -= dt * 9; swirl.setAlpha(0.6 * (1 - t * 0.5));
        return age < d;
      },
      kill: () => s.aAdd.kill(swirl),
    });
  }
}

/** Midpoint-displaced jagged polyline between two points. */
function jagged(ax: number, ay: number, bx: number, by: number, rough: number): [number, number][] {
  let pts: [number, number][] = [[ax, ay], [bx, by]];
  let amp = Math.hypot(bx - ax, by - ay) * rough;
  const levels = Math.hypot(bx - ax, by - ay) > 160 ? 4 : 3;
  for (let l = 0; l < levels; l++) {
    const out: [number, number][] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i - 1], [qx, qy] = pts[i];
      const dx = qx - px, dy = qy - py, L = Math.hypot(dx, dy) || 1;
      const off = (Math.random() - 0.5) * 2 * amp;
      out.push([(px + qx) / 2 - (dy / L) * off, (py + qy) / 2 + (dx / L) * off], pts[i]);
    }
    pts = out;
    amp *= 0.5;
  }
  return pts;
}
