// Telegraphs (`tele` events): D3 / Lost Ark style ground markers that fill up over `d` ms, plus the
// things that come with them — the falling meteor, a hovering frost orb, a mortar shell dropping from the
// sky, a molten core about to burst. When a telegraph resolves we play its payoff immediately and mark
// it, so a matching `aoe` arriving a moment later is not drawn twice (and vice versa).

import { Container, Graphics } from 'pixi.js';
import type { GameEvent } from '@shared/protocol';
import type { Effect, VfxCore } from './core';
import type { Fx } from './particles';
import type { AoeFx } from './aoe';
import { EL_COLD, EL_FIRE, TAU, clamp, easeIn, pal, rand } from './util';

type Tele = Extract<GameEvent, { e: 'tele' }>;

interface Style { color: number; alpha: number; fill: number }

const STYLES: Record<string, Style> = {
  slam: { color: 0xff4a1a, alpha: 0.95, fill: 0.3 },
  boss_ring: { color: 0xff2a2a, alpha: 1, fill: 0.26 },
  meteor: { color: 0xffb050, alpha: 0.55, fill: 0.07 },
  frozen_orb: { color: 0x6fd0ff, alpha: 0.95, fill: 0.28 },
  mortar: { color: 0xff6a22, alpha: 0.95, fill: 0.3 },
  molten_death: { color: 0xff6a10, alpha: 1, fill: 0.32 },
};

/** Which aoe visuals a telegraph's own payoff replaces. */
export const TELE_COVERS: Record<string, string[]> = {
  slam: ['slam'],
  molten_death: ['explode'],
  mortar: ['explode', 'grenade'],
  frozen_orb: ['nova', 'explode'],
};

interface Falling { x: number; y: number; el: number; land: () => void; done: boolean }

export class Telegraphs {
  /** Meteors currently falling (so the impact aoe can land them early). */
  private falling: Falling[] = [];
  /** Element for the next meteor (set by my meteor cast: Comet rune is cold). */
  meteorEl = EL_FIRE;
  meteorElAt = -1;

  constructor(private V: VfxCore, private aoe: AoeFx) {}

  handle(ev: Tele): void {
    const V = this.V;
    const d = Math.max(0.12, ev.d / 1000);
    const el = ev.v === 'meteor' && V.real - this.meteorElAt < 2 ? this.meteorEl : ev.v === 'frozen_orb' ? EL_COLD : EL_FIRE;
    let st = STYLES[ev.v] ?? STYLES.slam;
    if (ev.v === 'meteor' && el === EL_COLD) st = { ...st, color: 0x8fdcff };
    const shape = this.shape(ev, st);
    const root = shape.root;
    V.teleLayer.addChild(root);
    let age = 0;
    let resolved = false;
    const extras: Effect[] = [];

    switch (ev.v) {
      case 'meteor': extras.push(this.meteorFall(ev.x, ev.y, ev.r, d, el)); break;
      case 'frozen_orb': extras.push(this.frostOrb(ev.x, ev.y, d)); V.sound('warn', ev.x, ev.y, 0.6); break;
      case 'mortar': extras.push(this.mortarShell(ev.x, ev.y, d)); break;
      case 'molten_death': extras.push(this.moltenCore(ev.x, ev.y, ev.r, d)); break;
      case 'boss_ring': V.sound('warn', ev.x, ev.y); break;
      default: break;
    }

    const resolve = () => {
      if (resolved) return;
      resolved = true;
      const s = V.sys, T = s.T;
      // Completion flash on the marker.
      if (shape.circle) {
        s.ring(s.gAdd, T.ringHard, ev.x, ev.y, ev.r * 0.98, ev.r * 1.08, st.color, 0.2, 0.9);
        const fl = s.gAdd.add(T.disc, ev.x, ev.y, 0.18);
        fl.w0 = fl.w1 = ev.r * 2.05; fl.a0 = st.fill * 1.4; fl.fo = 0; fl.tintTo(st.color);
      }
      const covers = TELE_COVERS[ev.v];
      if (covers && covers.some((k) => V.consume('aoe:' + k, ev.x, ev.y, 0.4, 70))) return;
      if (covers) V.mark('tele:' + ev.v, ev.x, ev.y);
      switch (ev.v) {
        case 'slam': {
          if (ev.a === undefined) { this.aoe.slam(ev.x, ev.y, ev.r, 0, 0.8); break; }
          const w = ev.w !== undefined && ev.w > 0 ? ev.w : Math.PI / 3;
          if (w <= Math.PI + 0.01) { this.aoe.fissure(ev.x, ev.y, ev.r, ev.a, 0, false); break; }
          // Line: a row of impacts along its length.
          const n = Math.max(2, Math.round(ev.r / (w * 0.9)));
          for (let i = 0; i < n; i++) {
            const d = ((i + 0.5) / n) * ev.r;
            V.after(i * 0.03, () => this.aoe.slam(ev.x + Math.cos(ev.a!) * d, ev.y + Math.sin(ev.a!) * d, w * 0.6, 0, 0.5));
          }
          break;
        }
        case 'frozen_orb': this.aoe.iceBurst(ev.x, ev.y, Math.max(50, ev.r)); break;
        case 'mortar': this.aoe.explosion(ev.x, ev.y, Math.max(40, ev.r), EL_FIRE, 0.8); break;
        case 'molten_death': this.aoe.explosion(ev.x, ev.y, Math.max(60, ev.r), EL_FIRE, 1.2); break;
        default: break;
      }
    };

    V.add({
      update: (dt) => {
        age += dt;
        const t = clamp(age / d, 0, 1);
        shape.progress(t, age);
        if (age >= d && !resolved) resolve();
        if (age >= d) {
          const f = clamp((age - d) / 0.14, 0, 1);
          root.alpha = 1 - f;
          return f < 1;
        }
        root.alpha = Math.min(1, age / 0.08);
        return true;
      },
      kill: () => {
        root.destroy({ children: true });
        for (const e of extras) e.kill();
      },
    });
    for (const e of extras) V.add(e);
  }

  /** Land any falling meteor near (x, y) right now (the impact aoe arrived). */
  landMeteor(x: number, y: number): void {
    for (const f of this.falling) {
      if (!f.done && Math.abs(f.x - x) < 80 && Math.abs(f.y - y) < 80) { f.land(); return; }
    }
  }

  // ─────────────────────────── marker shapes ───────────────────────────

  private shape(ev: Tele, st: Style): { root: Container; circle: boolean; progress: (t: number, age: number) => void } {
    const root = new Container();
    root.position.set(ev.x, ev.y);
    const base = new Graphics();
    const fill = new Graphics();
    root.addChild(base, fill);
    const col = st.color;
    const r = ev.r;
    if (ev.a !== undefined) {
      // Directional. `w` <= PI is a cone's full angle, a larger `w` is a line's width; no `w` = 60° cone.
      const a = ev.a;
      const w = ev.w !== undefined && ev.w > 0 ? ev.w : Math.PI / 3;
      if (w <= Math.PI + 0.01) {
        const half = w / 2;
        const cone = (g: Graphics) => g.moveTo(0, 0).arc(0, 0, r, a - half, a + half).lineTo(0, 0);
        cone(base).fill({ color: col, alpha: st.fill * 0.5 });
        cone(base).stroke({ width: 2.5, color: col, alpha: st.alpha, join: 'round' });
        cone(fill).fill({ color: col, alpha: st.fill });
        return { root, circle: false, progress: (t, age) => { fill.scale.set(Math.max(0.001, t)); base.alpha = pulse(t, age); } };
      }
      base.rotation = a; fill.rotation = a;
      base.rect(0, -w / 2, r, w).fill({ color: col, alpha: st.fill * 0.5 });
      base.rect(0, -w / 2, r, w).stroke({ width: 2.5, color: col, alpha: st.alpha, join: 'round' });
      fill.rect(0, -w / 2, r, w).fill({ color: col, alpha: st.fill });
      return { root, circle: false, progress: (t, age) => { fill.scale.set(Math.max(0.001, t), 1); base.alpha = pulse(t, age); } };
    }
    // Circle: faint disc, crisp outer ring with a soft inner line, and a disc that grows to the edge.
    base.circle(0, 0, r).fill({ color: col, alpha: st.fill * 0.45 });
    base.circle(0, 0, r).stroke({ width: 2.6, color: col, alpha: st.alpha });
    base.circle(0, 0, r - 5).stroke({ width: 1.2, color: col, alpha: st.alpha * 0.35 });
    fill.circle(0, 0, r).fill({ color: col, alpha: st.fill });
    if (ev.v === 'boss_ring') {
      // Sixteen chevrons around the boss: the projectile ring that is about to fly.
      const chev = new Graphics();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const cx = Math.cos(a) * (r + 14), cy = Math.sin(a) * (r + 14);
        const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
        chev.moveTo(cx + ux * 9, cy + uy * 9).lineTo(cx - ux * 4 + vx * 7, cy - uy * 4 + vy * 7).lineTo(cx - ux * 4 - vx * 7, cy - uy * 4 - vy * 7).closePath();
      }
      chev.fill({ color: col, alpha: 0.9 }).stroke({ width: 1.5, color: 0x2a0000, alpha: 0.6 });
      root.addChild(chev);
      return {
        root, circle: true,
        progress: (t, age) => {
          fill.scale.set(Math.max(0.001, easeIn(t)));
          base.alpha = pulse(t, age);
          chev.alpha = 0.5 + 0.5 * Math.abs(Math.sin(age * (6 + t * 14)));
          chev.scale.set(1 + t * 0.08);
        },
      };
    }
    return { root, circle: true, progress: (t, age) => { fill.scale.set(Math.max(0.001, t)); base.alpha = pulse(t, age); } };
  }

  // ─────────────────────────── extras ───────────────────────────

  /** A burning rock streaking in from the top-left, landing exactly when the telegraph completes. */
  private meteorFall(x: number, y: number, r: number, d: number, el: number): Effect {
    const V = this.V, s = V.sys, T = s.T;
    const P = pal(el);
    const cold = el === EL_COLD;
    const fallDur = Math.min(0.9, d * 0.92);
    const start = d - fallDur;
    const size = 30 + r * 0.32;
    const H = 560, DX = -250;
    let age = 0;
    let landed = false;
    let whistled = false;
    const shadow = s.gNormal.hold(T.shadow, x, y);
    shadow.tintTo(0x000000);
    const glow = s.aAdd.hold(T.glow, x, y);
    glow.tintTo(cold ? 0x7fd8ff : 0xff8a2a);
    const rock = s.aBody.hold(T.rock, x, y);
    rock.tintTo(cold ? 0xa8e8ff : 0xffb040);
    const parts: Fx[] = [shadow, glow, rock];
    const f: Falling = { x, y, el, done: false, land: () => { age = d; } };
    this.falling.push(f);
    let acc = 0;
    return {
      update: (dt) => {
        age += dt;
        if (!whistled && age >= start - 0.05) { whistled = true; V.sound('meteor_fall', x, y); }
        const t = clamp((age - start) / fallDur, 0, 1);
        // Shadow grows during the whole telegraph.
        const st = clamp(age / d, 0, 1);
        shadow.place(x, y, 0);
        shadow.setScale(size * (0.6 + st * 1.4), 0.5);
        shadow.setAlpha(0.12 + st * 0.3);
        if (age < start) { rock.setAlpha(0); glow.setAlpha(0); return true; }
        const e = easeIn(t) * 0.75 + t * 0.25;
        const rx = x + DX * (1 - e), rz = H * (1 - e);
        rock.place(rx, y, rz + size * 0.2);
        rock.setScale(size); rock.rotation += dt * 5; rock.setAlpha(1);
        glow.place(rx, y, rz + size * 0.2);
        glow.setScale(size * 3.2 * (0.9 + Math.random() * 0.2)); glow.setAlpha(0.85);
        // Trail: fire tongues, embers and smoke along the path.
        acc += dt;
        const every = 0.012 / Math.max(0.35, s.budget);
        while (acc > every && t < 1) {
          acc -= every;
          const back = rand(0, 1);
          const tx = rx - DX / H * 30 * back, tz = rz + 30 * back + size * 0.2;
          const fl = s.aAdd.add(T.flame, tx + rand(-6, 6), y, rand(0.18, 0.32));
          fl.z = tz + rand(-6, 6); fl.anchorY = 0.6; fl.w0 = size * rand(0.8, 1.2); fl.w1 = size * 0.2; fl.k = 1.6; fl.fo = 0.2;
          fl.rotation = Math.atan2(-H, -DX) + Math.PI / 2 + rand(-0.15, 0.15);
          fl.a0 = 0.72;
          fl.tintFade(cold ? P.hot : 0xffc868, P.main);
          if (Math.random() < 0.5) s.smoke(tx, y, tz, size * 0.5, size * 1.4, cold ? 0xbfe6f5 : 0x4a3e38, rand(0.5, 0.8), 0.4, 10);
          if (Math.random() < 0.4) s.ember(tx, y, tz, P.main, rand(0.4, 0.7), 5, 20);
        }
        if (t >= 1 && !landed) {
          landed = true;
          f.done = true;
          s.flash(x, y, 10, size * 3, P.hot, 0.1, 1);
          return false;
        }
        return true;
      },
      kill: () => {
        f.done = true;
        for (const p of parts) s.aAdd.kill(p);
        const i = this.falling.indexOf(f);
        if (i >= 0) this.falling.splice(i, 1);
      },
    };
  }

  /** Frozen elite affix: an icy orb that hovers and pulses faster until it bursts. */
  private frostOrb(x: number, y: number, d: number): Effect {
    const s = this.V.sys, T = s.T;
    const glow = s.aAdd.hold(T.glow, x, y);
    const core = s.aAdd.hold(T.core, x, y);
    const flake = s.aAdd.hold(T.flake, x, y);
    glow.tintTo(0x6fd0ff); core.tintTo(0xe8fbff); flake.tintTo(0xcff2ff);
    let age = 0;
    return {
      update: (dt) => {
        age += dt;
        const t = clamp(age / d, 0, 1);
        const z = 22 + Math.sin(age * 4) * 4;
        const appear = clamp(age / 0.2, 0, 1);
        const beat = 1 + 0.15 * Math.sin(age * (8 + t * 30));
        glow.place(x, y, z); glow.setScale(70 * appear * beat); glow.setAlpha(0.7);
        core.place(x, y, z); core.setScale(26 * appear); core.setAlpha(1);
        flake.place(x, y, z); flake.setScale(30 * appear); flake.rotation += dt * 3; flake.setAlpha(0.9);
        if (Math.random() < 0.3 * s.budget) s.glint(x + rand(-20, 20), y, z + rand(-14, 14), 10, 0xe8fbff, 0.3);
        return age < d;
      },
      kill: () => { s.aAdd.kill(glow); s.aAdd.kill(core); s.aAdd.kill(flake); },
    };
  }

  /** Mortar elite affix: a shell whistling down from above during the last moments. */
  private mortarShell(x: number, y: number, d: number): Effect {
    const V = this.V, s = V.sys, T = s.T;
    const fall = Math.min(0.6, d * 0.8);
    const start = d - fall;
    const shell = s.aBody.hold(T.bomb, x, y);
    const glow = s.aAdd.hold(T.glow, x, y);
    shell.tintTo(0xffffff); glow.tintTo(0xff8a3d);
    let age = 0;
    let whistled = false;
    return {
      update: (dt) => {
        age += dt;
        if (age < start) { shell.setAlpha(0); glow.setAlpha(0); return true; }
        if (!whistled) { whistled = true; V.sound('mortar', x, y); }
        const t = clamp((age - start) / fall, 0, 1);
        const z = 460 * (1 - easeIn(t));
        shell.place(x + 40 * (1 - t), y, z); shell.setScale(20); shell.rotation += dt * 8; shell.setAlpha(1);
        glow.place(shell.gx, y, z); glow.setScale(30); glow.setAlpha(0.6);
        if (Math.random() < 0.6) s.spark(shell.gx, y, z + 6, -Math.PI / 2 + rand(-0.4, 0.4), rand(40, 90), 8, 0xffb050, 0.2);
        return t < 1;
      },
      kill: () => { s.aBody.kill(shell); s.aAdd.kill(glow); },
    };
  }

  /** Molten elite death: glowing cracks swelling under the corpse before it bursts. */
  private moltenCore(x: number, y: number, r: number, d: number): Effect {
    const s = this.V.sys, T = s.T;
    const crack = s.gAdd.hold(T.crack[0], x, y);
    const glow = s.gAdd.hold(T.glow, x, y);
    crack.tintTo(0xff7a1a); glow.tintTo(0xff5a10);
    crack.rotation = rand(0, TAU);
    let age = 0;
    return {
      update: (dt) => {
        age += dt;
        const t = clamp(age / d, 0, 1);
        const beat = 0.6 + 0.4 * Math.abs(Math.sin(age * (5 + t * 20)));
        crack.place(x, y, 0); crack.setScale(r * 1.6 * (0.5 + t * 0.6)); crack.setAlpha(0.4 + 0.6 * beat * t);
        glow.place(x, y, 0); glow.setScale(r * 2.2 * (0.6 + t * 0.5)); glow.setAlpha(0.25 + 0.35 * beat);
        if (Math.random() < 0.5 * s.budget) s.ember(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.4, 2, 0xff8a3d, rand(0.4, 0.8), 5, 80);
        return age < d;
      },
      kill: () => { s.gAdd.kill(crack); s.gAdd.kill(glow); },
    };
  }

  clear(): void {
    this.falling.length = 0;
  }
}

function pulse(t: number, age: number): number {
  return t < 0.6 ? 1 : 0.7 + 0.3 * Math.abs(Math.cos(age * (8 + t * 20)));
}
