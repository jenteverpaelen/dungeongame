// Beams (`beam` events): sentry chain lightning, Electrify arcs and the Vortex elite's tether.

import type { GameEvent } from '@shared/protocol';
import type { VfxCore } from './core';
import { EL_COLD, EL_FIRE, TAU, clamp, easeIn, pal, rand } from './util';

type Beam = Extract<GameEvent, { e: 'beam' }>;

export class Beams {
  private lastChainSnd = -1;

  constructor(private V: VfxCore) {}

  handle(ev: Beam): void {
    const d = Math.max(0.12, ev.d / 1000);
    switch (ev.v) {
      case 'vortex': this.tether(ev.x, ev.y, ev.tx, ev.ty, d); break;
      case 'arc': this.lightning(ev.x, ev.y, ev.tx, ev.ty, Math.max(0.16, d), 26, ev.el, true); break;
      default: this.lightning(ev.x, ev.y, ev.tx, ev.ty, d, 30, ev.el, false);
    }
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
            s.seg(s.aAdd, px, py, qx, qy, 9, glowCol, life, 0.35);
            s.seg(s.aAdd, px, py, qx, qy, 2.3, P.hot, life, 1);
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
            g.w0 = 34; g.w1 = 26; g.a0 = 0.7; g.fo = 0; g.tintTo(glowCol);
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
          s.seg(s.aAdd, px, py, qx, qy, 6, 0x8a4dff, 0.04, 0.5);
          s.seg(s.aAdd, px, py, qx, qy, 2, 0xf0d8ff, 0.04, 0.9);
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
