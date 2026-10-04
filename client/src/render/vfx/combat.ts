// Hit feedback (dmg / heal events) and element-styled deaths (die events).

import type { GameEvent } from '@shared/protocol';
import type { VfxCore } from './core';
import { NumKind, type CombatText } from './text';
import { EL_ARCANE, EL_COLD, EL_FIRE, EL_HOLY, EL_LIGHT, EL_POISON, TAU, lerpColor, pal, rand } from './util';

type Dmg = Extract<GameEvent, { e: 'dmg' }>;
type Heal = Extract<GameEvent, { e: 'heal' }>;
type Die = Extract<GameEvent, { e: 'die' }>;

const BLEED = 0xff8f80;
const CAT_MINE = 1, CAT_OTHER = 2, CAT_TAKEN = 3, CAT_HEAL = 4;

export class Combat {
  private lastSpark = new Map<number, number>();
  private lastFlash = new Map<number, number>();
  private sweepAt = 0;

  constructor(private V: VfxCore, private text: CombatText) {}

  dmg(ev: Dmg): void {
    const V = this.V;
    const me = V.ctx.myId();
    const b = V.body(ev.t);
    if (!b) return;
    const now = V.real;
    const crit = ev.c === 1;
    const dot = ev.dot === 1;
    const taken = ev.t === me;
    const targetIsPlayer = V.players.has(ev.t) || taken;
    const mine = !taken && V.isMine(ev.s);

    // ── hit reaction (flash + squash), throttled per target ──
    if (!dot) {
      const lf = this.lastFlash.get(ev.t) ?? -1;
      if (now - lf > 0.06 || crit) {
        this.lastFlash.set(ev.t, now);
        V.ctx.entityView(ev.t)?.hit(crit ? 1 : mine ? 0.6 : 0.35, crit);
      }
    }

    // ── numbers ──
    const headY = b.y - b.h - 6;
    if (taken) {
      this.text.spawn(ev.a, b.x, headY, { kind: dot ? NumKind.Dot : NumKind.Taken, color: 0xff6a5a, key: ev.t * 8 + CAT_TAKEN });
    } else if (!targetIsPlayer && V.ents.has(ev.t) || !targetIsPlayer && mine) {
      if (dot) {
        const color = ev.el === 0 ? BLEED : pal(ev.el).text;
        this.text.spawn(ev.a, b.x, headY, { kind: NumKind.Dot, color, faint: !mine, key: ev.t * 8 + 5 + (mine ? 0 : 1) });
      } else {
        let big = 1;
        if (mine) {
          if (!crit) V.hitEma = V.hitEma ? V.hitEma * 0.96 + ev.a * 0.04 : ev.a;
          else if (V.hitEma > 0 && ev.a > V.hitEma * 3.2) big = 1.22;
        }
        this.text.spawn(ev.a, b.x, headY, {
          kind: crit ? NumKind.Crit : NumKind.Normal, faint: !mine, big, key: ev.t * 8 + (mine ? CAT_MINE : CAT_OTHER),
        });
        // ── screen feedback for my hits ──
        if (mine && crit) {
          if (V.isElite(ev.t)) V.hitStop(45);
          if (big > 1) V.shake(3, 90, 0.15);
        }
      }
    }

    // ── damage to me ──
    if (taken && !dot) {
      if (V.tierOf(ev.s) === 4) V.shake(8, 220, 0.25);
      else if (ev.p) V.shake(4, 140, 0.2);
      V.sound('hurt', undefined, undefined, ev.p ? 1 : 0.7);
    }

    // ── impact particles ──
    if (dot) {
      if (Math.random() < 0.35 * V.sys.budget) this.dotFx(b.x, b.y, b.h, ev.el);
      return;
    }
    const ls = this.lastSpark.get(ev.t) ?? -1;
    if (now - ls > 0.035 || crit) {
      this.lastSpark.set(ev.t, now);
      const z = b.h * rand(0.38, 0.62);
      const jx = rand(-0.35, 0.35) * Math.max(10, b.r);
      this.sparks(b.x + jx, b.y + 2, z, ev.el, crit, mine || taken ? 1 : 0.6);
    }
    if (mine) V.sound(crit ? 'crit' : 'hit', b.x, b.y, crit ? 1 : 0.8);
    if (now > this.sweepAt) {
      this.sweepAt = now + 2;
      for (const [k, t] of this.lastSpark) if (now - t > 2) this.lastSpark.delete(k);
      for (const [k, t] of this.lastFlash) if (now - t > 2) this.lastFlash.delete(k);
    }
  }

  heal(ev: Heal): void {
    const V = this.V;
    if (ev.t !== V.ctx.myId() || ev.a < 1) return;
    const b = V.body(ev.t);
    if (!b) return;
    this.text.spawn(ev.a, b.x + 12, b.y - b.h - 2, { kind: NumKind.Heal, key: ev.t * 8 + CAT_HEAL });
    const s = V.sys;
    for (let i = 0, n = s.n(3); i < n; i++) {
      const p = s.aAdd.add(s.T.plus, b.x + rand(-14, 14), b.y + 1, rand(0.6, 0.9));
      p.z = b.h * rand(0.2, 0.7); p.vz = rand(30, 50); p.w0 = 7; p.w1 = 4; p.fo = 0.5; p.a0 = 0.8;
      p.tintTo(0x8dff9a);
    }
  }

  /** Impact sparks coloured by element. */
  sparks(x: number, y: number, z: number, el: number, crit: boolean, scale = 1): void {
    const s = this.V.sys, T = s.T, P = pal(el);
    const k = (crit ? 1.35 : 1) * scale;
    const n = s.n((crit ? 11 : 5) * scale);
    for (let i = 0; i < n; i++) {
      const ang = rand(0, TAU);
      s.spark(x, y, z, ang, rand(170, 380) * k, rand(10, 18) * k, lerpColor(P.hot, P.main, Math.random()), rand(0.12, 0.24));
    }
    s.flash(x, y, z, (crit ? 54 : 30) * scale, P.hot, crit ? 0.12 : 0.08, crit ? 0.95 : 0.75);
    if (crit) {
      const st = s.aFlash.add(T.star4, x, y, 0.18);
      st.z = z; st.w0 = 26 * scale; st.w1 = 62 * scale; st.se = 3; st.fo = 0.2; st.rotation = rand(0, 0.6);
      st.tintTo(el === 0 ? 0xffe9a8 : P.hot);
      s.ring(s.aAdd, T.ringHard, x, y, 6, 34 * scale, P.main, 0.2, 0.8, z);
    }
    switch (el) {
      case EL_FIRE: for (let i = 0; i < 2; i++) s.ember(x + rand(-6, 6), y, z, 0xffa040, rand(0.5, 0.8), 5); break;
      case EL_COLD:
        for (let i = 0; i < 2; i++) {
          const p = s.chunk(x, y, z, rand(-120, 120), rand(-60, 60), rand(80, 200), rand(5, 8), 0xd8f4ff, 0.6, T.shard[(Math.random() * 3) | 0]);
          p.bounce = 0.2;
        }
        break;
      case EL_LIGHT: this.zigzag(x, y - z, rand(0, TAU), rand(18, 30), 0xd6c2ff, 0.12); break;
      case EL_POISON:
        for (let i = 0; i < 2; i++) { const p = s.chunk(x, y, z, rand(-90, 90), rand(-40, 40), rand(60, 160), 5, 0x8fd16a, 0.6, T.dot); p.bounce = 0; }
        break;
      case EL_ARCANE: s.glint(x + rand(-10, 10), y, z + rand(-8, 8), 16, 0xd8b0ff, 0.3); break;
      default: break;
    }
  }

  private dotFx(x: number, y: number, h: number, el: number): void {
    const s = this.V.sys, T = s.T;
    const z = h * rand(0.3, 0.75), px = x + rand(-10, 10);
    switch (el) {
      case EL_FIRE: s.ember(px, y, z, 0xff9a3c, 0.6, 5, 70); break;
      case EL_POISON: { const p = s.aAdd.add(T.bubble, px, y, 0.5); p.z = z; p.vz = 30; p.w0 = 4; p.w1 = 9; p.fo = 0.6; p.tintTo(0x8fd16a); break; }
      case EL_COLD: s.glint(px, y, z, 10, 0xbfeaff, 0.3); break;
      case EL_LIGHT: this.zigzag(px, y - z, rand(0, TAU), 14, 0xd6c2ff, 0.1); break;
      case EL_ARCANE: s.glint(px, y, z, 10, 0xc39bff, 0.3); break;
      default: {
        // Bleed: a drop of blood falling from the wound.
        const p = s.aBody.add(T.drip, px, y + 1, 0.5);
        p.z = z; p.vz = -10; p.gz = 500; p.w0 = 5; p.w1 = 4; p.fo = 0.6; p.k = 1;
        p.tintTo(0xc8243a);
      }
    }
  }

  /** Short jagged lightning crack in screen-plane coordinates (x, sy = y - z). */
  zigzag(x: number, sy: number, ang: number, len: number, color: number, life: number, width = 2.4): void {
    const s = this.V.sys;
    const segs = 3;
    let px = x, py = sy;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const nx = x + Math.cos(ang) * len * t + (i < segs ? rand(-6, 6) : 0);
      const ny = sy + Math.sin(ang) * len * t + (i < segs ? rand(-6, 6) : 0);
      s.seg(s.aAdd, px, py, nx, ny, width, color, life);
      px = nx; py = ny;
    }
  }

  // ─────────────────────────── deaths ───────────────────────────

  die(ev: Die): void {
    const V = this.V;
    const p = V.ctx.entityPos(ev.t);
    const x = p?.x ?? ev.x, y = p?.y ?? ev.y;
    const h = V.ctx.entityView(ev.t)?.height ?? 40;
    const info = V.ents.get(ev.t);
    const big = ev.big === 1 || (info !== undefined && (info.tier === 4 || info.tier === 5));
    V.noteDeath(x, y);
    this.deathFx(x, y, h, ev.el, big, info?.body ?? 0xd8cfc0, info?.accent ?? 0x8a7a6a);
    if (big) V.shakeNear(x, y, info?.tier === 4 ? 7 : 4, info?.tier === 4 ? 260 : 140);
    const snd = ev.el === EL_COLD ? 'shatter' : ev.el === EL_LIGHT ? 'zap' : ev.el === EL_POISON ? 'poison' : '';
    V.sound(big ? 'die_big' : 'die', x, y);
    if (snd) V.sound(snd, x, y, 0.7);
    V.forget(ev.t);
  }

  deathFx(x: number, y: number, h: number, el: number, big: boolean, body: number, accent: number): void {
    const s = this.V.sys, T = s.T;
    const k = big ? 1.75 : 1;
    const cz = h * 0.45;
    const P = pal(el);
    switch (el) {
      case EL_FIRE: {
        s.flash(x, y, cz, 90 * k, 0xffb050, 0.18, 0.9);
        for (let i = 0, n = s.n(10 * k); i < n; i++) {
          const f = s.aAdd.add(T.flame, x + rand(-14, 14) * k, y + rand(-4, 4), rand(0.35, 0.6));
          f.anchorY = 0.85; f.z = rand(0, cz); f.vz = rand(40, 110); f.w0 = rand(14, 22) * k; f.w1 = 4; f.k = 1.5; f.fo = 0.3; f.flick = 0.3;
          f.tintFade(0xffd070, 0xff3010);
        }
        for (let i = 0, n = s.n(16 * k); i < n; i++) s.ember(x + rand(-16, 16) * k, y, rand(4, cz * 1.4), 0xffa040, rand(0.8, 1.4), rand(3, 6), 90);
        for (let i = 0, n = s.n(5 * k); i < n; i++) s.smoke(x + rand(-14, 14) * k, y, cz * rand(0.4, 1.2), 24 * k, 60 * k, 0x2e2622, rand(0.9, 1.4), 0.55, 50);
        for (let i = 0, n = s.n(5 * k); i < n; i++) {
          const a = rand(0, TAU);
          s.chunk(x, y, cz * 0.6, Math.cos(a) * rand(40, 140) * k, Math.sin(a) * rand(30, 90), rand(150, 300), rand(6, 10) * k, 0x2a2220, rand(0.8, 1.2));
        }
        this.decal(T.scorch[(Math.random() * 2) | 0], x, y, 60 * k, 0x000000, 0.55, 3.5);
        break;
      }
      case EL_COLD: {
        s.flash(x, y, cz, 80 * k, 0xdff6ff, 0.14, 0.9);
        s.ring(s.gAdd, T.ring, x, y, 6, 50 * k, 0x9fe4ff, 0.35, 0.8);
        for (let i = 0, n = s.n(16 * k); i < n; i++) {
          const a = rand(0, TAU), sp = rand(80, 260) * k;
          const p = s.chunk(x, y, cz * rand(0.3, 1.1), Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(120, 340), rand(7, 14) * k, i % 3 ? 0xd8f4ff : 0x9fd8ff, rand(0.9, 1.5), T.shard[i % 3]);
          p.bounce = 0.25;
        }
        for (let i = 0, n = s.n(4 * k); i < n; i++) s.smoke(x + rand(-12, 12), y, cz * rand(0.3, 0.9), 26 * k, 54 * k, 0xcfefff, rand(0.7, 1.0), 0.32, 20);
        for (let i = 0, n = s.n(5 * k); i < n; i++) s.glint(x + rand(-20, 20) * k, y, rand(4, h), rand(14, 22), 0xe8fbff, rand(0.3, 0.5));
        this.decal(T.frostPatch, x, y, 70 * k, 0xbfe9ff, 0.35, 2.2, s.gAdd);
        break;
      }
      case EL_LIGHT: {
        s.flash(x, y, cz, 120 * k, 0xffffff, 0.1, 1);
        s.flash(x, y, cz, 60 * k, 0xc9b6ff, 0.22, 0.8);
        for (let i = 0, n = s.n(16 * k); i < n; i++) s.spark(x, y, cz, rand(0, TAU), rand(220, 480) * k, rand(12, 22), i % 2 ? 0xffffff : 0xb9a2ff, rand(0.15, 0.3));
        for (let i = 0; i < 4; i++) this.zigzag(x, y - cz, rand(0, TAU), rand(26, 46) * k, 0xe0d4ff, 0.16, 2.8);
        for (let i = 0, n = s.n(3 * k); i < n; i++) s.smoke(x + rand(-10, 10), y, cz, 22 * k, 50 * k, 0x3a3440, rand(0.8, 1.2), 0.45, 40);
        for (let i = 0, n = s.n(4 * k); i < n; i++) {
          const a = rand(0, TAU);
          s.chunk(x, y, cz * 0.6, Math.cos(a) * rand(40, 140) * k, Math.sin(a) * rand(30, 90), rand(150, 300), rand(6, 10) * k, 0x2a2628, rand(0.8, 1.2));
        }
        this.decal(T.scorch[(Math.random() * 2) | 0], x, y, 44 * k, 0x000000, 0.4, 2.5);
        break;
      }
      case EL_POISON: {
        s.flash(x, y, cz, 60 * k, 0xb8ff7a, 0.14, 0.6);
        for (let i = 0, n = s.n(14 * k); i < n; i++) {
          const a = rand(0, TAU), sp = rand(60, 220) * k;
          const p = s.chunk(x, y, cz * rand(0.3, 0.9), Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(140, 320), rand(6, 12) * k, i % 3 ? 0x7fce4a : 0xb6ef6a, rand(0.7, 1.1), T.dot);
          p.bounce = 0; p.vr = 0;
        }
        for (let i = 0, n = s.n(4 * k); i < n; i++) s.smoke(x + rand(-14, 14), y, cz * rand(0.2, 0.8), 26 * k, 64 * k, 0x7fbf4a, rand(1, 1.5), 0.35, 26);
        for (let i = 0, n = s.n(6 * k); i < n; i++) {
          const b = s.aAdd.add(T.bubble, x + rand(-20, 20) * k, y + rand(-6, 6), rand(0.5, 0.9));
          b.z = rand(2, cz); b.vz = rand(15, 40); b.w0 = 4; b.w1 = rand(9, 14); b.fo = 0.65; b.tintTo(0xa8f070);
        }
        this.decal(T.poolGoo, x, y, 64 * k, 0x5fae3a, 0.75, 3);
        break;
      }
      case EL_ARCANE: {
        s.flash(x, y, cz, 80 * k, 0xd8b0ff, 0.2, 0.85);
        const sw = s.aAdd.add(T.swirl, x, y, 0.5);
        sw.z = cz; sw.w0 = 30 * k; sw.w1 = 90 * k; sw.se = 3; sw.vr = 7; sw.fo = 0.2; sw.a0 = 0.7; sw.tintTo(0xb070ff);
        for (let i = 0, n = s.n(22 * k); i < n; i++) {
          const p = s.aAdd.add(i % 3 ? T.dot : T.star4, x + rand(-16, 16) * k, y + rand(-3, 3), rand(0.7, 1.3));
          p.z = rand(0, h * 1.05); p.vz = rand(20, 70); p.vx = rand(-20, 20); p.drag = 0.6;
          p.w0 = rand(4, 9); p.w1 = 1; p.fo = 0.3; p.flick = 0.4; p.vr = 2;
          p.tintFade(0xf0d8ff, 0x8a4dff);
        }
        break;
      }
      case EL_HOLY: {
        s.flash(x, y, cz, 100 * k, 0xfff2b0, 0.25, 0.9);
        for (let i = 0; i < 7; i++) {
          const r = s.aAdd.add(T.streak, x, y, 0.45);
          const a = -Math.PI / 2 + rand(-1.1, 1.1);
          r.z = cz; r.rotation = a; r.anchorX = 0.05; r.w0 = 30 * k; r.w1 = 90 * k; r.k = 0.6; r.se = 3; r.fo = 0.3;
          r.tintTo(0xffe9a0);
        }
        for (let i = 0, n = s.n(8 * k); i < n; i++) s.glint(x + rand(-20, 20) * k, y, rand(4, h), rand(12, 20), 0xfff6c8, rand(0.4, 0.7));
        break;
      }
      default: {
        // Physical: squash pop + chunky bits in the monster's colours + a dust ring.
        s.flash(x, y, cz, 56 * k, 0xffffff, 0.1, 0.65);
        for (let i = 0, n = s.n((big ? 18 : 9) * (0.8 + Math.random() * 0.3)); i < n; i++) {
          const a = rand(0, TAU), sp = rand(60, 230) * k;
          s.chunk(x, y, cz * rand(0.4, 1.0), Math.cos(a) * sp, Math.sin(a) * sp * 0.55, rand(160, 380), rand(7, 13) * k, i % 3 ? body : accent, rand(0.9, 1.4));
        }
        for (let i = 0, n = s.n(8 * k); i < n; i++) {
          const a = (i / 8) * TAU + rand(-0.3, 0.3);
          s.dust(x + Math.cos(a) * 8, y + Math.sin(a) * 5, 18 * k, 46 * k, 0xc9b597, rand(0.5, 0.8), 0.42, Math.cos(a) * 140 * k, Math.sin(a) * 80 * k);
        }
        s.ring(s.gNormal, T.ringThick, x, y, 8, 46 * k, 0xd8c8a8, 0.3, 0.35);
        if (big) s.ring(s.aAdd, T.ring, x, y, 10, 90, P.hot, 0.3, 0.6, cz * 0.5);
      }
    }
  }

  /** Ground decal that fades out over `life` seconds. */
  decal(tex: import('pixi.js').Texture, x: number, y: number, w: number, color: number, a0: number, life: number, layer = this.V.sys.gNormal): void {
    const p = layer.add(tex, x, y, life);
    p.w0 = w * 0.85; p.w1 = w; p.se = 3; p.a0 = a0; p.fi = 0.04; p.fo = 0.55; p.k = 0.8; p.rotation = rand(0, TAU);
    p.tintTo(color);
  }
}

export { EL_ARCANE, EL_COLD, EL_FIRE, EL_HOLY, EL_LIGHT, EL_POISON };
