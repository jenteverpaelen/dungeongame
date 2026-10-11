// Ranger M1 area effects: the `aoe` variants of the ranger wave (docs/rework/depth/RANGER.md §3–§5 "VFX / icon / sound").
// Skipstone ripples, Spring Snare (arm, snap, shrapnel cone, pull), Overcast Volley (cloud, falling arrows, heavy shaft),
// the Quarry Mark sigil and Falcon Strike, Pitch Mortar (shell flight, tar-fire impact), the flock's stoop, Badger Sett,
// Flame Lance sentries, Barrel Bomb, Kestrel Column, the following Rainkeeper storm and the data grounds (pitch, wet,
// snare_fire, powder_patch). Particles come from the shared fx atlas; the few big props (sprung jaws, the sigil, the
// falcon) are original canvas paintings shown as Sprites in this module's own layers (like the warrior props).

import { CanvasSource, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { GameEvent } from '@shared/protocol';
import type { VfxCore } from './core';
import type { Combat } from './combat';
import type { AoeFx } from './aoe';
import type { Fx } from './particles';
import { EL_COLD, EL_FIRE, EL_LIGHT, EL_PHYS, TAU, clamp, easeIn, easeOut, easeOutBack, rand } from './util';

type Aoe = Extract<GameEvent, { e: 'aoe' }>;

/** aoe variants this module draws (AoeFx.handle routes them here, delay included). */
export const RANGER_AOE: ReadonlySet<string> = new Set([
  'skip_ripple', 'skim_ripple', 'snare_arm', 'snare_snap', 'snare_cone', 'trap_pull',
  'overcast_cloud', 'overcast_arrow', 'overcast_heavy', 'quarry_mark', 'falcon_dive',
  'mortar_shot', 'mortar_impact', 'flock_stoop', 'badger_burst', 'sentry_flame', 'barrel_blast',
  'kestrel_column', 'rain_storm', 'pitch', 'wet', 'snare_fire', 'powder_patch',
]);

/** Height of the Overcast Volley cloud (and the Rainkeeper storm) above the ground. */
const CLOUD_Z = 200;
/** Falling arrows / the falcon start early so that they land on the event's moment when the server sends a delay. */
const FALL = 0.15, DIVE = 0.24, MIN_FALL = 0.12;
const SOIL = [0x6a5038, 0x7d6040, 0x4f3a28, 0x8a6f4d];

interface Sigil { token: number; end: () => void }

export class RangerFx {
  /** Ground props (sprung jaws): under entities. */
  private low = new Container({ label: 'vfx-ranger-low' });
  /** Airborne props (quarry sigil, falcon): above entities. */
  private high = new Container({ label: 'vfx-ranger-high' });
  private sigils = new Map<number, Sigil>();
  private sigilToken = 0;

  constructor(private V: VfxCore, private combat: Combat, private aoe: AoeFx) {
    V.layers.groundFx.addChild(this.low);
    V.layers.aboveFx.addChild(this.high);
  }

  /** Prop sprites are pooled (never one new Sprite per event): take one showing `tex` in `parent`. */
  private pool: Sprite[] = [];
  private sprite(tex: Texture, parent: Container, ax = 0.5, ay = 0.5): Sprite {
    const sp = this.pool.pop() ?? new Sprite();
    sp.texture = tex; sp.anchor.set(ax, ay);
    sp.position.set(0, 0); sp.scale.set(1); sp.rotation = 0; sp.alpha = 1; sp.visible = true; sp.tint = 0xffffff;
    parent.addChild(sp);
    return sp;
  }
  private release(sp: Sprite): void {
    sp.parent?.removeChild(sp);
    if (this.pool.length < 48) this.pool.push(sp); else sp.destroy();
  }

  handle(ev: Aoe): void {
    const delay = Math.max(0, (ev.delay ?? 0) / 1000);
    const lead = ev.v === 'overcast_arrow' || ev.v === 'overcast_heavy' ? FALL : ev.v === 'falcon_dive' ? DIVE : 0;
    if (lead > 0) {
      const fall = delay >= lead ? lead : Math.max(MIN_FALL, delay);
      const start = Math.max(0, delay - fall);
      this.V.after(start, () => this.run(ev, fall));
      return;
    }
    if (delay > 0) { this.V.after(delay, () => this.run(ev, 0)); return; }
    this.run(ev, 0);
  }

  private run(ev: Aoe, fall: number): void {
    const V = this.V;
    const mine = V.isMine(ev.s);
    const d = ev.d / 1000;
    const r = Math.max(8, ev.r);
    switch (ev.v) {
      case 'skip_ripple': this.skipRipple(ev.x, ev.y, r, mine); break;
      case 'skim_ripple': this.skimRipple(ev.x, ev.y, r, d > 0.2 ? d : 1); break;
      case 'snare_arm': this.snareArm(ev, mine); break;
      case 'snare_snap': this.snareSnap(ev, r, mine); break;
      case 'snare_cone': this.snareCone(ev.x, ev.y, r, ev.a ?? 0, mine); break;
      case 'trap_pull': this.trapPull(ev.x, ev.y, r, mine); break;
      case 'overcast_cloud': this.overcastCloud(ev.x, ev.y, r, Math.max(0.5, d), ev.el); break;
      case 'overcast_arrow': this.overcastArrow(ev.x, ev.y, r, ev.el, false, fall, mine); break;
      case 'overcast_heavy': this.overcastArrow(ev.x, ev.y, r, ev.el, true, fall, mine); break;
      case 'quarry_mark': this.quarryMark(ev, d > 0.05 ? d : 12); break;
      case 'falcon_dive': this.falconDive(ev.x, ev.y, r, fall, mine); break;
      case 'mortar_shot': this.mortarShot(ev, d > 0.05 ? d : 0.45, mine); break;
      case 'mortar_impact': this.mortarImpact(ev.x, ev.y, r, ev.el, mine); break;
      case 'flock_stoop': this.flockStoop(ev.x, ev.y, r, ev.el, mine); break;
      case 'badger_burst': this.badgerBurst(ev.x, ev.y, r, mine); break;
      case 'sentry_flame': this.sentryFlame(ev, r, mine); break;
      case 'barrel_blast': this.barrelBlast(ev.x, ev.y, r, ev.el, mine); break;
      case 'kestrel_column': this.kestrelColumn(ev.x, ev.y, r, Math.max(0.5, d), mine); break;
      case 'rain_storm': this.rainStorm(ev, r, Math.max(0.6, d)); break;
      case 'pitch': this.pitchGround(ev.x, ev.y, r, Math.max(0.5, d)); break;
      case 'wet': this.wetGround(ev.x, ev.y, r, Math.max(0.5, d)); break;
      case 'snare_fire': this.fireGround(ev.x, ev.y, r, Math.max(0.5, d), false); break;
      case 'powder_patch': this.fireGround(ev.x, ev.y, r, Math.max(0.5, d), true); break;
    }
  }

  // ─────────────────────────── Skipstone Bolt ───────────────────────────

  /** Ripple rune: every skip point bursts in a cold ring of water (radius 50) and chills. */
  private skipRipple(x: number, y: number, r: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    s.flash(x, y, 6, r * 1.5, 0xe8fbff, 0.1, 0.65);
    s.ring(s.gAdd, T.ringThick, x, y, r * 0.15, r, 0x8fdcff, 0.42, 0.5);
    s.ring(s.gAdd, T.ringHard, x, y, r * 0.1, r * 1.05, 0xe8fbff, 0.34, 0.7);
    V.after(0.08, () => s.ring(s.gAdd, T.ringHard, x, y, r * 0.1, r * 0.78, 0xc8f0ff, 0.36, 0.45));
    s.ring(s.gNormal, T.ringThick, x, y, r * 0.1, r * 0.9, 0x24404e, 0.5, 0.2);
    for (let i = 0, n = s.n(12); i < n; i++) {
      const a = rand(0, TAU), d = rand(0, r * 0.3);
      const p = s.aAdd.add(T.drip, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, rand(0.35, 0.55));
      p.z = 4; p.vx = Math.cos(a) * rand(30, 90); p.vy = Math.sin(a) * rand(20, 50); p.vz = rand(150, 260); p.gz = 760;
      p.align = true; p.w0 = rand(3.5, 5.5); p.w1 = 2.2; p.k = 1.3; p.a0 = 0.85; p.fo = 0.5; p.tintTo(0xd8f4ff);
    }
    for (let i = 0, n = s.n(5); i < n; i++) s.glint(x + rand(-r, r) * 0.7, y + rand(-r, r) * 0.45, rand(2, 14), rand(10, 15), 0xe8fbff, rand(0.3, 0.5));
    this.combat.decal(T.frostPatch, x, y, r * 1.6, 0xbfe9ff, 0.32, 1.4, s.gAdd);
    V.sound('skip_plip', x, y, mine ? 0.8 : 0.4);
    V.sound('shatter', x, y, mine ? 0.25 : 0.12);
  }

  /** A chilling ripple ring that keeps spreading for ~1 s (three rings, one after another). */
  private skimRipple(x: number, y: number, r: number, d: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const step = d / 3;
    for (let k = 0; k < 3; k++) V.after(k * step, () => {
      s.ring(s.gAdd, T.ringHard, x, y, r * 0.15, r, 0xc8f0ff, step * 1.4, 0.42 - k * 0.08);
      s.ring(s.gNormal, T.ring, x, y, r * 0.12, r * 0.9, 0x2a4654, step * 1.3, 0.16);
      for (let i = 0, n = s.n(3); i < n; i++) { const a = rand(0, TAU); s.glint(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.5, 3, 9, 0xe8fbff, 0.3, 0.7); }
    });
    this.combat.decal(T.frostPatch, x, y, r * 1.8, 0xbfe9ff, 0.2, d + 0.3, s.gAdd);
  }

  // ─────────────────────────── Spring Snare ───────────────────────────

  /** The snare arms: a small metallic click and a glint on the jaws. */
  private snareArm(ev: Aoe, mine: boolean): void {
    const V = this.V, s = V.sys;
    const p = (ev.s !== undefined ? V.ctx.entityPos(ev.s) : null) ?? { x: ev.x, y: ev.y };
    s.glint(p.x + rand(-6, 6), p.y, 7, 18, 0xf2f6ff, 0.28, 0.95);
    for (let i = 0, n = s.n(3); i < n; i++) s.spark(p.x, p.y, 5, rand(-Math.PI, 0), rand(60, 120), 6, 0xe8ecf2, 0.12);
    s.dust(p.x, p.y, 8, 20, 0xb8a284, 0.4, 0.25);
    if (ev.s !== undefined) (V.ctx.entityView(ev.s) as { armed?(): void } | null)?.armed?.();
    V.sound('snare_arm', p.x, p.y, mine ? 0.8 : 0.4);
  }

  /**
   * The snap: iron jaws spring shut (a painted prop that holds for the 1.5 s immobilise, then fades), a dust burst,
   * soil thrown up and the coiled rope whipping out. Pitch-Soaked (fire): the burst catches.
   */
  private snareSnap(ev: Aoe, r: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const p = (ev.s !== undefined ? V.ctx.entityPos(ev.s) : null) ?? { x: ev.x, y: ev.y };
    const x = p.x, y = p.y;
    const fire = ev.el === EL_FIRE;
    if (ev.s !== undefined) (V.ctx.entityView(ev.s) as { snapped?(): void } | null)?.snapped?.();
    // jaws: three pooled sprites over the baked bed / jaw textures (only transform + alpha change per frame)
    const K = 1.15, HOLD = 1.5, OUT = 0.35, FLAT = 0.3;
    const base = this.sprite(jawBaseTex(), this.low, 0.5, 0.62);
    const back = this.sprite(jawTex(false), this.low, 0.5, 0.97);
    const front = this.sprite(jawTex(true), this.high, 0.5, 0.97); // in front of the caught victim
    let age = 0, shut = false;
    V.add({
      update: (dt) => {
        age += dt;
        const c = easeOutBack(clamp(age / 0.07, 0, 1));
        const jit = age < 0.5 ? Math.sin(age * 90) * (0.5 - age) * 3 : 0;
        const a = clamp((HOLD + OUT - age) / OUT, 0, 1);
        base.position.set(x + jit, y); base.scale.set(K); base.alpha = a;
        back.position.set(x + jit, y - 2 * K); back.scale.set(K, K * (FLAT + (1 - FLAT) * c)); back.alpha = a;
        front.position.set(x + jit, y - K); front.scale.set(K, K * (-FLAT + (1 + FLAT) * c)); front.alpha = a;
        if (!shut && age >= 0.05) { shut = true; s.flash(x, y, 10, 40, fire ? 0xffb060 : 0xf4f6ff, 0.06, 0.8); }
        return age < HOLD + OUT;
      },
      kill: () => { this.release(base); this.release(back); this.release(front); },
    });
    // dust burst + range ring
    for (let i = 0, n = s.n(14); i < n; i++) {
      const a = (i / 14) * TAU + rand(-0.2, 0.2);
      s.dust(x + Math.cos(a) * 8, y + Math.sin(a) * 5, 14, 40, 0xb39d78, rand(0.45, 0.7), 0.42, Math.cos(a) * r * 2.4, Math.sin(a) * r * 1.6);
    }
    s.ring(s.gNormal, T.ringThick, x, y, 6, r * 0.9, 0x2e2418, 0.4, 0.35);
    s.ring(s.gAdd, T.ringHard, x, y, r * 0.3, r, fire ? 0xff8a3d : 0xd8c8a8, 0.3, 0.32);
    for (let i = 0, n = s.n(8); i < n; i++) {
      const a = rand(0, TAU), sp = rand(60, 150);
      s.chunk(x, y, 4, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(160, 300), rand(3.5, 6), SOIL[i % 4], rand(0.5, 0.8));
    }
    for (let i = 0, n = s.n(4); i < n; i++) s.spark(x, y, 8, rand(-Math.PI, 0), rand(140, 260), 10, 0xf0f2f6, 0.14, 500);
    this.ropeWhip(x, y, rand(0, TAU));
    if (fire) {
      for (let i = 0, n = s.n(8); i < n; i++) {
        const a = rand(0, TAU), d = rand(0, r * 0.5);
        const f = s.aAdd.add(T.flame, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, rand(0.35, 0.55));
        f.anchorY = 0.85; f.vz = rand(40, 90); f.w0 = rand(14, 22); f.w1 = 4; f.k = 1.5; f.fo = 0.3; f.flick = 0.2; f.tintFade(0xffd070, 0xff4a10);
      }
      for (let i = 0, n = s.n(8); i < n; i++) s.ember(x + rand(-r, r) * 0.5, y, 4, 0xff8a3d, rand(0.6, 1), 4, 80);
    }
    V.shakeNear(x, y, mine ? 3 : 2, 90);
    V.sound('snare_snap', x, y, mine ? 1 : 0.5);
  }

  /** The snare's rope lashes out and around in one fast curling sweep. */
  private ropeWhip(x: number, y: number, a0: number): void {
    const V = this.V, s = V.sys;
    const dir = Math.random() < 0.5 ? 1 : -1, len = 62, dur = 0.26;
    let age = 0;
    V.add({
      update: (dt) => {
        age += dt;
        const t = clamp(age / dur, 0, 1);
        const a = a0 + dir * easeOut(t) * 3.6;
        const fade = 1 - t * t;
        const n = 9;
        let px = x, py = y - 3;
        for (let i = 1; i <= n; i++) {
          const f = i / n;
          const curl = a - dir * f * (1.4 - t) * 1.6;
          const qx = px + Math.cos(curl) * (len / n), qy = py + Math.sin(curl) * (len / n) * 0.55 - f * (1 - f) * 6 * (1 - t);
          s.seg(s.aBody, px, py, qx, qy, 3.4, 0x2a1c10, 0.04, 0.85 * fade);
          s.seg(s.aBody, px, py, qx, qy, 2, i % 2 ? 0xb08a58 : 0x9a7b4f, 0.04, fade);
          px = qx; py = qy;
        }
        return age < dur;
      },
      kill: () => undefined,
    });
  }

  /** Shrapnel Jaw: iron splinters sprayed in a 120° cone behind the victim (radius 150). */
  private snareCone(x: number, y: number, r: number, a: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const spread = Math.PI / 3;
    for (let i = 0, n = s.n(16); i < n; i++) {
      const aa = a + rand(-spread, spread), sp = (r / 0.32) * rand(0.6, 1.05);
      const c = s.chunk(x, y, 12, Math.cos(aa) * sp, Math.sin(aa) * sp, rand(60, 150), rand(4, 7), i % 3 ? 0x9a9ea6 : 0x6e7278, rand(0.45, 0.65), T.shard[i % 3]);
      c.gz = 420; c.drag = 2.2; c.bounce = 0.2;
    }
    for (let i = 0, n = s.n(8); i < n; i++) s.spark(x, y, 12, a + rand(-spread, spread), rand(300, 520), 14, i % 2 ? 0xfff0d0 : 0xd8dce4, rand(0.16, 0.24));
    for (let k = -1; k <= 1; k++) {
      const aa = a + k * spread * 0.7;
      const ln = s.seg(s.gNormal, x, y, x + Math.cos(aa) * r * 0.9, y + Math.sin(aa) * r * 0.9, 3, 0x2a2018, 0.5, 0.25);
      ln.fo = 0.2;
      s.dust(x + Math.cos(aa) * r * 0.5, y + Math.sin(aa) * r * 0.5, 12, 32, 0xb8a284, 0.5, 0.3, Math.cos(aa) * 120, Math.sin(aa) * 80);
    }
    V.sound('snare_shrapnel', x, y, mine ? 0.7 : 0.35);
  }

  /** Chain Snare: enemies yanked together toward the victim (radius r): streaks and dust rushing inward. */
  private trapPull(x: number, y: number, r: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const life = 0.22;
    for (let i = 0, n = s.n(12); i < n; i++) {
      const a = (i / 12) * TAU + rand(-0.2, 0.2), d = r * rand(0.8, 1.05);
      const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d * 0.7;
      const p = s.aAdd.add(T.streak, sx, sy, life);
      p.z = 10; p.vx = (x - sx) / life; p.vy = (y - sy) / life; p.align = true; p.anchorX = 0.9; p.w0 = 40; p.w1 = 20; p.k = 0.35; p.a0 = 0.5; p.fo = 0.4;
      p.tintTo(0xe8dcc0);
      s.dust(sx, sy, 12, 30, 0xb8a284, 0.4, 0.32, (x - sx) * 3, (y - sy) * 3);
    }
    s.ring(s.gNormal, T.ringThick, x, y, r, r * 0.15, 0x3a2e20, 0.26, 0.3);
    V.after(life, () => { s.dust(x, y, 18, 50, 0xb39d78, 0.5, 0.4); s.flash(x, y, 10, 40, 0xf4ead0, 0.07, 0.5); });
    V.sound('rope_whip', x, y, mine ? 0.7 : 0.35);
  }

  // ─────────────────────────── Overcast Volley ───────────────────────────

  /** Arrows streak up, then a brief grey cloud puffs over the area and lingers `d` s (lightning: a violet storm shelf). */
  private overcastCloud(x: number, y: number, r: number, d: number, el: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const cold = el === EL_COLD, lit = el === EL_LIGHT;
    const grey = cold ? 0xc8d6e2 : lit ? 0x6e6684 : 0x8c929a, under = cold ? 0x8ea6b8 : lit ? 0x403a56 : 0x5a6068;
    for (let i = 0, n = 2 + s.n(4); i < n; i++) {
      const p = s.aAdd.add(T.streak, x + rand(-r, r) * 0.25, y + rand(-8, 8), 0.16);
      p.z = 40; p.vz = 1250; p.rotation = -Math.PI / 2 + rand(-0.12, 0.12); p.anchorX = 0.9; p.w0 = 60; p.w1 = 90; p.k = 0.3; p.a0 = 0.7; p.fo = 0.5;
      p.tintTo(0xfff4d6);
    }
    V.after(0.12, () => {
      for (let i = 0, n = 6 + s.n(7); i < n; i++) {
        const a = rand(0, TAU), dd = Math.sqrt(Math.random()) * r * 0.8;
        const p = s.smoke(x + Math.cos(a) * dd, y + Math.sin(a) * dd * 0.45, CLOUD_Z + rand(-12, 16), r * 0.6, r * rand(1.0, 1.25), grey, d + rand(0.2, 0.5), 0.46, 4);
        p.fi = 0.08; p.fo = 0.6; p.drag = 3;
      }
      for (let i = 0, n = 2 + s.n(4); i < n; i++) {
        const p = s.smoke(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.2, CLOUD_Z - 14, r * 0.35, r * 0.7, under, d + 0.2, 0.42, 2);
        p.fi = 0.1; p.fo = 0.6; p.drag = 3;
      }
      s.flash(x, y, CLOUD_Z, r * 1.6, lit ? 0xb9a2ff : 0xe8eef4, 0.12, 0.35);
    });
    const shade = s.gNormal.hold(T.disc, x, y);
    shade.tintTo(lit ? 0x2a2440 : 0x000000);
    let age = 0, flick = rand(0.2, 0.4), snow = 0;
    V.add({
      update: (dt) => {
        age += dt;
        const a = Math.min(clamp((age - 0.1) / 0.2, 0, 1), clamp((d + 0.2 - age) / 0.3, 0, 1));
        shade.place(x, y, 0); shade.setScale(r * 2.1, 1); shade.setAlpha(0.13 * a);
        if (lit && (flick -= dt) <= 0 && age > 0.2 && age < d) {
          flick = rand(0.18, 0.4);
          s.glow(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.2, CLOUD_Z + rand(-6, 10), 40, r * 0.9, 0xb9a2ff, 0.12, 0.55);
        }
        if (cold && age > 0.2 && age < d) {
          snow += dt * 10 * s.budget;
          while (snow > 1) {
            snow -= 1;
            const f = s.aAdd.add(T.flake, x + rand(-r, r) * 0.8, y + rand(-r, r) * 0.5, rand(0.9, 1.3));
            f.z = CLOUD_Z - 20; f.vz = -150; f.vx = rand(-12, 12); f.w0 = f.w1 = rand(6, 9); f.vr = rand(-2, 2); f.a0 = 0.8; f.fo = 0.7; f.tintTo(0xe8fbff);
          }
        }
        return age < d + 0.5;
      },
      kill: () => s.gNormal.kill(shade),
    });
  }

  /** One arrow (or Thunder Peal's heavy shaft) falls out of the cloud: a thin streak, then a dust puff. */
  private overcastArrow(x: number, y: number, r: number, el: number, heavy: boolean, fall: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const t = fall > 0 ? fall : MIN_FALL;
    const H = CLOUD_Z - 10, DX = heavy ? -20 : -26;
    const cold = el === EL_COLD, lit = el === EL_LIGHT;
    const tint = cold ? 0xe0f4ff : 0xffffff;
    const body = s.aBody.add(T.arrow, x + DX, y, t);
    body.z = H; body.vx = -DX / t; body.vz = -H / t; body.align = true; body.w0 = body.w1 = heavy ? 70 : 34; body.k = heavy ? 1.5 : 1; body.fo = 1; body.tintTo(tint);
    const st = s.aAdd.add(T.streak, x + DX, y, t);
    st.z = H; st.vx = -DX / t; st.vz = -H / t; st.align = true; st.anchorX = 0.92; st.w0 = st.w1 = heavy ? 150 : 80; st.k = heavy ? 0.5 : 0.28; st.a0 = heavy ? 0.75 : 0.5; st.fo = 1;
    st.tintTo(cold ? 0xd8f4ff : lit ? 0xd6c2ff : 0xf4f0e6);
    V.after(t, () => {
      if (heavy) {
        s.flash(x, y, 8, r * 1.4, lit ? 0xe6dcff : 0xfff2d8, 0.12, 0.85);
        s.ring(s.gNormal, T.ringThick, x, y, 6, r, 0x2e2418, 0.42, 0.42);
        s.ring(s.gAdd, T.ringHard, x, y, 8, r * 1.1, cold ? 0xbfeaff : 0xf0dcb0, 0.3, 0.5);
        for (let i = 0, n = s.n(12); i < n; i++) {
          const a = (i / 12) * TAU + rand(-0.2, 0.2);
          s.dust(x + Math.cos(a) * 6, y + Math.sin(a) * 4, 14, 40, 0xb39d78, rand(0.5, 0.75), 0.42, Math.cos(a) * r * 2.6, Math.sin(a) * r * 1.8);
        }
        for (let i = 0, n = s.n(6); i < n; i++) { const a = rand(0, TAU), sp = rand(60, 150); s.chunk(x, y, 4, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(160, 280), rand(4, 6), SOIL[i % 4], 0.7); }
        const cr = s.gNormal.add(T.crack[(Math.random() * 2) | 0], x, y, 2.2);
        cr.w0 = r * 0.9; cr.w1 = r * 1.2; cr.se = 3; cr.rotation = rand(0, TAU); cr.a0 = 0.3; cr.fo = 0.5; cr.tintTo(0x241a12);
        if (lit) for (let i = 0; i < 4; i++) this.combat.zigzag(x, y - 6, rand(0, TAU), rand(20, 36), 0xd6c2ff, 0.14);
        V.shakeNear(x, y, mine ? 3 : 2, 110);
        V.sound('overcast_heavy', x, y, mine ? 0.9 : 0.45);
      } else {
        s.dust(x, y, 8, 24, 0xc9b597, 0.4, 0.38);
        s.spark(x, y, 4, rand(-Math.PI, 0), rand(60, 120), 8, cold ? 0xd8f4ff : 0xfff0d0, 0.12);
        if (cold) { s.glint(x, y, 6, 12, 0xe8fbff, 0.25); this.combat.decal(T.frostPatch, x, y, r * 1.3, 0xbfe9ff, 0.22, 1.2, s.gAdd); }
        if (lit) this.combat.zigzag(x, y - 4, rand(0, TAU), rand(10, 18), 0xd6c2ff, 0.1);
        V.sound('overcast_thunk', x, y, mine ? 0.55 : 0.25);
      }
      const stuck = s.gNormal.add(T.arrow, x, y - (heavy ? 10 : 6), heavy ? 1.2 : 0.6);
      stuck.w0 = stuck.w1 = heavy ? 30 : 16; stuck.rotation = -Math.PI / 2 + 0.3; stuck.a0 = 0.9; stuck.fo = 0.6; stuck.anchorX = 0.15; stuck.tintTo(tint);
    });
  }

  // ─────────────────────────── Quarry Mark ───────────────────────────

  /** A pale feather-and-eye sigil hovering over the marked monster (follows it) for `d` s, with a faint ground ring. */
  private quarryMark(ev: Aoe, d: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const id = ev.s;
    if (id === undefined) return;
    this.sigils.get(id)?.end();
    const token = ++this.sigilToken;
    const sp = this.sprite(sigilTex(), this.high, 0.5, 0.55);
    const ring = s.gAdd.hold(T.ringHard, ev.x, ev.y);
    ring.tintTo(0xf0dca0);
    const halo = s.aAdd.hold(T.glow, ev.x, ev.y);
    halo.tintTo(0xfff0c8);
    let age = 0, life = d, x = ev.x, y = ev.y, h = 40, motes = 0.2;
    const rad = Math.max(14, ev.r);
    // above the head; elites carry a nameplate (name, affixes, life bar) there, so the sigil floats above it
    const lift = V.isElite(id) ? 62 : 26;
    V.quarry.add(id);
    const sig: Sigil = { token, end: () => { life = Math.min(life, age + 0.25); } };
    this.sigils.set(id, sig);
    s.flash(x, y, h + 20, 60, 0xfff6dc, 0.12, 0.6);
    V.add({
      update: (dt) => {
        age += dt;
        const b = V.body(id);
        if (b) { x = b.x; y = b.y; h = b.h; } else if (life > age + 0.25) life = age + 0.25; // the quarry is gone
        const fin = easeOutBack(clamp(age / 0.3, 0, 1)), fout = clamp((life - age) / 0.25, 0, 1);
        const z = h + lift + Math.sin(age * 2.6) * 2.5;
        sp.position.set(x, y - z);
        sp.scale.set(0.85 * fin * (1 + 0.04 * Math.sin(age * 5)));
        sp.alpha = fout * clamp(age / 0.12, 0, 1);
        halo.place(x, y, z); halo.setScale(52); halo.setAlpha(0.32 * fout * (0.8 + 0.2 * Math.sin(age * 4)));
        ring.place(x, y, 0); ring.setScale((rad + 10) * 2.1, 1); ring.setAlpha(0.3 * fout * (0.75 + 0.25 * Math.sin(age * 3)));
        if ((motes -= dt) <= 0 && fout > 0.5) {
          motes = rand(0.25, 0.45);
          const f = s.aAdd.add(T.feather, x + rand(-10, 10), y, rand(0.8, 1.1));
          f.z = z - 6; f.vz = -26; f.vx = rand(-10, 10); f.w0 = 9; f.w1 = 7; f.vr = rand(-2, 2); f.rotation = rand(0, TAU); f.a0 = 0.55; f.fo = 0.4; f.tintTo(0xf6edd2);
        }
        return age < life;
      },
      kill: () => {
        this.release(sp);
        s.gAdd.kill(ring); s.aAdd.kill(halo);
        if (this.sigils.get(id)?.token === token) { this.sigils.delete(id); V.quarry.delete(id); }
      },
    });
  }

  /** Falcon Strike: a falcon stoops out of the sky onto the quarry, strikes in a burst of feathers and climbs away. */
  private falconDive(x: number, y: number, r: number, fall: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const dive = fall > 0 ? fall : MIN_FALL;
    const sx = x - 150, sz = 340;
    const bird = this.sprite(falconTex(false), this.high, 0.75, 0.5);
    const up = falconTex(true);
    let age = 0, struck = false, lx = sx, lz = sz;
    V.sound('quarry_cry', x, y, mine ? 0.8 : 0.4);
    V.add({
      update: (dt) => {
        age += dt;
        let bx: number, bz: number;
        if (age < dive) {
          const t = easeIn(clamp(age / dive, 0, 1));
          bx = sx + (x - sx) * t; bz = sz + (14 - sz) * t;
        } else {
          if (!struck) { struck = true; this.falconStrike(x, y, r, mine); bird.texture = up; bird.anchor.set(0.5, 0.6); }
          const t = clamp((age - dive) / 0.4, 0, 1);
          bx = x + 130 * easeOut(t); bz = 14 + 190 * easeIn(t);
          bird.alpha = 1 - t;
        }
        const ang = Math.atan2((y - bz) - (y - lz), bx - lx);
        bird.position.set(bx, y - bz);
        bird.rotation = age < dive ? ang : -0.35;
        bird.scale.set(0.95);
        if (age < dive) {
          const st = s.aAdd.add(T.streak, bx, y, 0.12);
          st.z = bz; st.rotation = ang; st.anchorX = 0.95; st.w0 = 70; st.w1 = 40; st.k = 0.3; st.a0 = 0.45; st.fo = 0.1; st.tintTo(0xf4f0e6);
        }
        lx = bx; lz = bz;
        return age < dive + 0.4;
      },
      kill: () => this.release(bird),
    });
  }

  private falconStrike(x: number, y: number, r: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    s.flash(x, y, 18, r * 1.6, 0xfff4dc, 0.1, 0.9);
    s.ring(s.aAdd, T.ringHard, x, y, 6, r, 0xf6e6b0, 0.22, 0.7, 10);
    s.ring(s.gNormal, T.ringThick, x, y, 6, r * 0.8, 0x2e2418, 0.35, 0.3);
    for (let i = 0, n = s.n(10); i < n; i++) {
      const a = rand(0, TAU), sp = rand(60, 160);
      const f = s.aBody.add(T.feather, x, y, rand(0.7, 1.1));
      f.z = rand(10, 30); f.vx = Math.cos(a) * sp; f.vy = Math.sin(a) * sp * 0.5; f.vz = rand(60, 160); f.gz = 180; f.drag = 2.4;
      f.w0 = rand(9, 13); f.w1 = 8; f.vr = rand(-6, 6); f.rotation = rand(0, TAU); f.fo = 0.6; f.tintTo(i % 3 ? 0xb08a5a : 0xeee2c8);
    }
    for (let i = 0, n = s.n(6); i < n; i++) s.spark(x, y, 14, rand(0, TAU), rand(160, 280), 12, 0xfff0d0, 0.18);
    for (let i = 0, n = s.n(8); i < n; i++) { const a = (i / 8) * TAU; s.dust(x + Math.cos(a) * 6, y + Math.sin(a) * 4, 12, 32, 0xb8a284, 0.5, 0.35, Math.cos(a) * 140, Math.sin(a) * 90); }
    V.shakeNear(x, y, mine ? 3.5 : 2, 110);
    V.sound('falcon_strike', x, y, mine ? 0.9 : 0.45);
  }

  // ─────────────────────────── Pitch Mortar ───────────────────────────

  /** The mortar thumps (black smoke at the muzzle) and lobs a pitch pot with a burning wick to (x, y) in `d` s. */
  private mortarShot(ev: Aoe, d: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const tx = ev.x, ty = ev.y;
    const from = (ev.s !== undefined ? V.ctx.entityPos(ev.s) : null) ?? { x: tx - 220, y: ty + 40 };
    const cold = ev.el === EL_COLD;
    const dir = tx >= from.x ? 1 : -1;
    const mx = from.x + dir * 9, my = from.y, mz = 24;
    if (ev.s !== undefined) (V.ctx.entityView(ev.s) as { playAction?(a: { skill: string; tx: number; ty: number; cycleMs: number }): void } | null)?.playAction?.({ skill: 'shot', tx, ty, cycleMs: 1000 });
    s.flash(mx, my, mz, 46, cold ? 0xe8fbff : 0xffc070, 0.08, 0.85);
    for (let i = 0, n = 1 + s.n(3); i < n; i++) s.smoke(mx + rand(-6, 6), my, mz + rand(0, 8), 14, 40, cold ? 0xc8d8e4 : 0x2a2624, rand(0.7, 1.1), 0.55, rand(40, 70));
    for (let i = 0, n = s.n(5); i < n; i++) s.spark(mx, my, mz, -Math.PI / 2 + dir * rand(0.2, 0.9), rand(120, 240), 10, cold ? 0xd8f4ff : 0xffb050, 0.2, 400);
    s.dust(from.x, from.y, 16, 40, 0xb8a284, 0.5, 0.35, -dir * 60, 0);
    V.sound('mortar_thoomp', mx, my, mine ? 1 : 0.5);
    const L = Math.hypot(tx - mx, ty - my);
    const H = clamp(L * 0.5, 90, 260);
    const pot = s.aBody.hold(T.pot, mx, my);
    pot.tintTo(cold ? 0xc8ecff : 0xffffff);
    const wick = s.aAdd.hold(T.flame, mx, my);
    wick.tintTo(cold ? 0xd8f4ff : 0xffb040);
    const glow = s.aAdd.hold(T.glow, mx, my);
    glow.tintTo(cold ? 0x8fdcff : 0xff8a3d);
    const shadow = s.gNormal.hold(T.shadow, mx, my);
    shadow.tintTo(0x000000);
    let age = 0, acc = 0, whistled = false, spin = rand(0, TAU), lx = mx, ly = my, lz = mz;
    V.add({
      update: (dt) => {
        age += dt;
        const t = clamp(age / d, 0, 1);
        const x = mx + (tx - mx) * t, y = my + (ty - my) * t, z = mz + (4 - mz) * t + 4 * H * t * (1 - t);
        spin += dt * 5 * dir;
        pot.place(x, y, z); pot.rotation = spin; pot.setScale(21); pot.setAlpha(1);
        const wx = x + Math.sin(spin) * 6, wz = z + Math.cos(spin) * 6;
        wick.place(wx, y, wz + 3); wick.anchorY = 0.85; wick.rotation = 0; wick.setScale(9 * (0.8 + Math.random() * 0.4), 1.5); wick.setAlpha(0.95);
        glow.place(wx, y, wz); glow.setScale(28 * (0.85 + Math.random() * 0.3)); glow.setAlpha(0.5);
        shadow.place(x, y, 0); shadow.setScale(18 * (0.5 + 0.5 * (1 - z / (H + 40))), 0.5); shadow.setAlpha(0.3);
        acc += Math.hypot(x - lx, y - z - (ly - lz));
        while (acc > 9 / Math.max(0.35, s.budget)) {
          acc -= 9 / Math.max(0.35, s.budget);
          if (cold) s.glint(wx + rand(-3, 3), y, wz, 7, 0xdff6ff, 0.3, 0.7);
          else { s.ember(wx, y, wz, 0xff8a3d, rand(0.3, 0.5), 3.5, 20); s.smoke(wx, y, wz, 6, 18, 0x4a423c, rand(0.5, 0.8), 0.32, 8); }
        }
        lx = x; ly = y; lz = z;
        if (!whistled && t > 0.35) { whistled = true; V.sound('mortar_whistle', x, y, mine ? 0.6 : 0.3); }
        return t < 1;
      },
      kill: () => { s.aBody.kill(pot); s.aAdd.kill(wick); s.aAdd.kill(glow); s.gNormal.kill(shadow); },
    });
  }

  /** The pot bursts: a splash of tar that catches fire (Frostpot: a frost burst instead). */
  private mortarImpact(x: number, y: number, r: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    if (el === EL_COLD) {
      this.aoe.iceBurst(x, y, r * 0.85);
      V.sound('pitch_splat', x, y, mine ? 0.5 : 0.25);
      return;
    }
    s.flash(x, y, 10, r * 1.8, 0xffd08a, 0.1, 0.9);
    for (let i = 0, n = s.n(12); i < n; i++) {
      const a = rand(0, TAU), sp = rand(70, 210) * Math.max(0.7, r / 100);
      const p = s.aBody.add(T.drip, x, y, rand(0.6, 0.9));
      p.z = 8; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp * 0.6; p.vz = rand(120, 280); p.gz = 900; p.settle = true;
      p.align = true; p.w0 = rand(5, 8); p.w1 = 3; p.k = 1.2; p.fo = 0.5; p.tintTo(0x241810);
    }
    for (let i = 0, n = 3 + s.n(2); i < n; i++) {
      const g = s.aAdd.add(T.glow, x + rand(-r, r) * 0.25, y + rand(-r, r) * 0.15, rand(0.3, 0.45));
      g.z = rand(6, 18); g.vz = rand(30, 70); g.w0 = r * 0.6; g.w1 = r * 1.3; g.se = 3; g.fo = 0.25; g.a0 = 0.7; g.tintFade(0xffc070, 0xc0400c);
    }
    for (let i = 0, n = s.n(10); i < n; i++) {
      const a = rand(0, TAU), d = rand(0, r * 0.6);
      const f = s.aAdd.add(T.flame, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, rand(0.4, 0.7));
      f.anchorY = 0.85; f.vz = rand(40, 100); f.w0 = rand(18, 30); f.w1 = 5; f.k = 1.5; f.fo = 0.35; f.flick = 0.25; f.tintFade(0xffe08a, 0xff4a10);
    }
    for (let i = 0, n = s.n(10); i < n; i++) s.ember(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.3, rand(4, 20), 0xff8a3d, rand(0.6, 1.1), 4, 90);
    for (let i = 0, n = s.n(3); i < n; i++) s.smoke(x + rand(-r, r) * 0.3, y, rand(14, 30), r * 0.4, r * 0.9, 0x241e1a, rand(1, 1.5), 0.42, rand(40, 70));
    s.ring(s.gNormal, T.ringThick, x, y, r * 0.2, r, 0x1a120c, 0.4, 0.4);
    this.combat.decal(T.poolGoo, x, y, r * 1.5, 0x140e0a, 0.5, 2.6);
    V.shakeNear(x, y, mine ? 3 : 2, 110);
    V.sound('pitch_splat', x, y, mine ? 0.85 : 0.4);
  }

  // ─────────────────────────── Murmuration / beasts ───────────────────────────

  /** The flock stoops on one enemy: a stream of starlings pours down onto it and sweeps back up. */
  private flockStoop(x: number, y: number, r: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const n = 14 + s.n(26);
    const birds: { p: Fx; x0: number; y0: number; z0: number; x2: number; y2: number; z2: number; tx: number; ty: number; d0: number; ph: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = rand(-0.9, 0.9) - Math.PI / 2, d0 = rand(0, 0.14);
      const p = s.aBody.hold(T.bird, x, y);
      p.tintTo(i % 4 ? 0x1c1c24 : 0x34343e);
      birds.push({
        p, d0, ph: rand(0, TAU),
        x0: x + Math.cos(a) * rand(30, 110), y0: y - rand(10, 40), z0: rand(110, 170),
        tx: x + rand(-r, r) * 0.5, ty: y + rand(-r, r) * 0.25,
        x2: x - Math.cos(a) * rand(60, 140), y2: y + rand(-30, 10), z2: rand(130, 190),
      });
    }
    const dur = 0.55;
    let age = 0, hit = false;
    V.sound('flock_dive', x, y, mine ? 0.8 : 0.4);
    V.add({
      update: (dt) => {
        age += dt;
        for (const b of birds) {
          const t = clamp((age - b.d0) / dur, 0, 1);
          const u = 1 - t;
          const bx = u * u * b.x0 + 2 * u * t * b.tx + t * t * b.x2;
          const by = u * u * b.y0 + 2 * u * t * b.ty + t * t * b.y2;
          const bz = u * u * b.z0 + 2 * u * t * -40 + t * t * b.z2;
          const z = Math.max(6, bz);
          const prevX = b.p.gx, prevY = b.p.y;
          b.p.texture = Math.sin(age * 34 + b.ph) > 0 ? T.bird : T.birdUp;
          b.p.place(bx, by, z);
          b.p.rotation = clamp(Math.atan2(b.p.y - prevY, bx - prevX) * 0.5, -0.9, 0.9);
          b.p.setScale(11, 0.6); b.p.setAlpha(t < 0.05 ? t / 0.05 : t > 0.85 ? (1 - t) / 0.15 : 1);
        }
        if (!hit && age > dur * 0.5) {
          hit = true;
          for (let i = 0, k = s.n(8); i < k; i++) {
            const a = rand(0, TAU);
            const f = s.aBody.add(T.feather, x, y, rand(0.6, 0.9));
            f.z = rand(8, 24); f.vx = Math.cos(a) * rand(30, 90); f.vy = Math.sin(a) * rand(15, 40); f.vz = rand(30, 90); f.gz = 120; f.drag = 2;
            f.w0 = 7; f.w1 = 6; f.vr = rand(-6, 6); f.rotation = rand(0, TAU); f.fo = 0.5; f.tintTo(0x2a2a34);
          }
          s.dust(x, y, 12, 34, 0xb8a284, 0.5, 0.3);
          if (el === EL_LIGHT) for (let i = 0; i < 3; i++) this.combat.zigzag(x, y - 16, rand(0, TAU), rand(16, 28), 0xd6c2ff, 0.12);
        }
        return age < dur + 0.16;
      },
      kill: () => { for (const b of birds) s.aBody.kill(b.p); },
    });
  }

  /** Badger Sett: the badger erupts from the ground: cracked earth, a column of thrown dirt, a dust ring (radius 70). */
  private badgerBurst(x: number, y: number, r: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const cr = s.gNormal.add(T.crack[(Math.random() * 2) | 0], x, y, 1.8);
    cr.w0 = r * 0.6; cr.w1 = r * 1.25; cr.se = 3; cr.rotation = rand(0, TAU); cr.a0 = 0.45; cr.fo = 0.5; cr.tintTo(0x241a12);
    s.ring(s.gNormal, T.ringThick, x, y, 6, r, 0x2e2418, 0.45, 0.4);
    s.ring(s.gAdd, T.ringHard, x, y, 8, r * 1.05, 0xd8c8a8, 0.3, 0.35);
    for (let i = 0, n = s.n(16); i < n; i++) {
      const a = rand(0, TAU), sp = rand(40, 140);
      s.chunk(x + Math.cos(a) * 6, y + Math.sin(a) * 4, 6, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(260, 440), rand(4, 8), SOIL[i % 4], rand(0.7, 1));
    }
    for (let i = 0, n = s.n(14); i < n; i++) {
      const a = (i / 14) * TAU + rand(-0.2, 0.2);
      s.dust(x + Math.cos(a) * 10, y + Math.sin(a) * 6, 16, 46, 0xa8946f, rand(0.5, 0.8), 0.45, Math.cos(a) * r * 2.4, Math.sin(a) * r * 1.7);
    }
    for (let i = 0, n = s.n(3); i < n; i++) s.smoke(x + rand(-12, 12), y, rand(6, 20), 20, 54, 0x8a7a62, rand(0.6, 0.9), 0.32, 60);
    V.shakeNear(x, y, mine ? 3 : 2, 100);
    V.sound('badger_burst', x, y, mine ? 0.9 : 0.45);
  }

  // ─────────────────────────── existing-skill runes ───────────────────────────

  /** Flame Lance: the sentry sprays a short 60° jet of fire along `a` (range r). */
  private sentryFlame(ev: Aoe, r: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const a = ev.a ?? 0, x = ev.x, y = ev.y;
    const ca = Math.cos(a), sa = Math.sin(a);
    if (ev.s !== undefined) (V.ctx.entityView(ev.s) as { playAction?(q: { skill: string; tx: number; ty: number; cycleMs: number }): void } | null)?.playAction?.({ skill: 'shot', tx: x + ca * r, ty: y + sa * r, cycleMs: 1000 });
    const mx = x + ca * 16, my = y + sa * 8, mz = 28;
    s.flash(mx, my, mz, 34, 0xffd08a, 0.08, 0.8);
    // the jet: tongues emitted over ~0.2 s, stretched along their flight and widening as they cool (a 60° cone)
    const life = 0.3;
    for (let i = 0, n = 8 + s.n(14); i < n; i++) V.after(i * 0.011, () => {
      const aa = a + rand(-0.52, 0.52), sp = (r / life) * rand(0.8, 1.15);
      const f = s.aAdd.add(T.flame, mx, my, life * rand(0.8, 1.05));
      f.z = mz - rand(0, 8); f.vx = Math.cos(aa) * sp; f.vy = Math.sin(aa) * sp * 0.75; f.vz = rand(-20, 25); f.drag = 1.6;
      f.rotation = Math.atan2(Math.sin(aa) * 0.75, Math.cos(aa)) + Math.PI / 2; f.anchorY = 0.7;
      f.w0 = rand(7, 10); f.w1 = rand(18, 28); f.k = 1.7; f.se = 1; f.fo = 0.3; f.flick = 0.2; f.a0 = 0.6;
      f.tintFade(0xffc860, 0xe8380a);
    });
    for (let i = 0, n = 1 + s.n(2); i < n; i++) {
      const g = s.aAdd.add(T.glow, mx + ca * r * 0.2 * i, my + sa * r * 0.15 * i, 0.22);
      g.z = mz - 4; g.vx = ca * r * 1.4; g.vy = sa * r * 1.0; g.drag = 3; g.w0 = 30; g.w1 = 60; g.fo = 0.2; g.a0 = 0.55; g.tintTo(0xff8a3d);
    }
    V.after(0.18, () => { for (let i = 0, n = s.n(2); i < n; i++) s.smoke(x + ca * r * rand(0.6, 0.95), y + sa * r * 0.7, rand(16, 30), 16, 46, 0x4e423b, rand(0.6, 0.9), 0.32, 30); });
    for (let i = 0, n = s.n(6); i < n; i++) s.ember(x + ca * r * rand(0.3, 0.9), y + sa * r * rand(0.3, 0.9) * 0.75, rand(6, 20), 0xff8a3d, rand(0.4, 0.7), 4, 50);
    this.combat.decal(T.scorch[(Math.random() * 2) | 0], x + ca * r * 0.65, y + sa * r * 0.5, r * 0.55, 0x000000, 0.18, 1.6);
    V.sound('sentry_flame', x, y, mine ? 0.7 : 0.35);
  }

  /** Barrel Bomb: a small blast where the rolling barrel bursts — staves, an iron hoop, fire. */
  private barrelBlast(x: number, y: number, r: number, el: number, mine: boolean): void {
    const s = this.V.sys, T = s.T;
    this.aoe.explosion(x, y, r, el === EL_PHYS ? EL_FIRE : el, 0.55, mine);
    for (let i = 0, n = s.n(7); i < n; i++) {
      const a = rand(0, TAU), sp = rand(80, 200);
      const c = s.chunk(x, y, 10, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(200, 340), rand(7, 11), i % 2 ? 0x8a5a32 : 0x6a4426, rand(0.7, 1), T.shard[i % 3]);
      c.k = 0.45;
    }
    s.ring(s.aBody, T.ringHard, x, y, r * 0.2, r * 0.55, 0x34343a, 0.3, 0.8, 10);
  }

  /** Kestrel Column: a narrow pale column over the area while kestrels dive into it, one after another, for `d` s. */
  private kestrelColumn(x: number, y: number, r: number, d: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const col = s.aAdd.hold(T.beam, x, y + 2);
    col.anchorY = 1; col.tintTo(0xf4e6c8);
    const shade = s.gNormal.hold(T.disc, x, y);
    shade.tintTo(0x000000);
    const rim = s.gAdd.hold(T.ringHard, x, y);
    rim.tintTo(0xe8c890);
    let age = 0, acc = 0, cry = 0.15;
    const rate = 11 * Math.max(0.7, r / 70);
    V.add({
      update: (dt) => {
        age += dt;
        const a = Math.min(clamp(age / 0.2, 0, 1), clamp((d - age) / 0.3, 0, 1));
        col.place(x, y + 2, 0); col.setScale(r * 1.7, (360 * 64) / (256 * r * 1.7)); col.setAlpha(0.12 * a);
        shade.place(x, y, 0); shade.setScale(r * 2, 1); shade.setAlpha(0.18 * a);
        rim.place(x, y, 0); rim.setScale(r * 2.1, 1); rim.setAlpha(0.32 * a);
        acc += dt * rate * s.budget;
        while (acc > 1 && age < d - 0.15) {
          acc -= 1;
          const ang = rand(0, TAU), dd = Math.sqrt(Math.random()) * r * 0.9;
          this.kestrel(x + Math.cos(ang) * dd, y + Math.sin(ang) * dd, mine);
        }
        if ((cry -= dt) <= 0 && age < d - 0.2) { cry = rand(0.5, 0.9); V.sound('kestrel_kee', x + rand(-r, r), y, mine ? 0.45 : 0.2); }
        return age < d;
      },
      kill: () => { s.aAdd.kill(col); s.gNormal.kill(shade); s.gAdd.kill(rim); },
    });
  }

  private kestrel(tx: number, ty: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const t = 0.24, H = 330, DX = rand(-50, -20);
    const b = s.aBody.add(T.birdUp, tx + DX, ty, t);
    b.z = H; b.vx = -DX / t; b.vz = -H / t; b.align = true; b.w0 = b.w1 = 30; b.k = 0.75; b.fo = 1; b.tintTo(0xa8642e);
    b.rotation = Math.atan2(H, -DX);
    const st = s.aAdd.add(T.streak, tx + DX, ty, t);
    st.z = H; st.vx = -DX / t; st.vz = -H / t; st.align = true; st.anchorX = 0.92; st.w0 = st.w1 = 70; st.k = 0.3; st.a0 = 0.4; st.fo = 1; st.tintTo(0xf4e6c8);
    V.after(t, () => {
      s.dust(tx, ty, 8, 24, 0xc9b597, 0.4, 0.38);
      s.flash(tx, ty, 8, 22, 0xfff0d0, 0.06, 0.5);
      for (let i = 0, n = s.n(2); i < n; i++) {
        const f = s.aBody.add(T.feather, tx, ty, rand(0.5, 0.8));
        f.z = 10; f.vx = rand(-60, 60); f.vy = rand(-25, 25); f.vz = rand(40, 90); f.gz = 140; f.drag = 2; f.w0 = 7; f.w1 = 6; f.vr = rand(-6, 6); f.fo = 0.5; f.tintTo(i ? 0xa8642e : 0xe8d8b8);
      }
      // the kestrel flicks back up out of the column
      const u = s.aBody.add(T.bird, tx, ty, 0.25);
      u.z = 10; u.vx = rand(-40, 40); u.vz = 420; u.w0 = 22; u.w1 = 16; u.k = 0.6; u.fo = 0.4; u.tintTo(0xa8642e);
      V.sound('overcast_thunk', tx, ty, mine ? 0.35 : 0.15);
    });
  }

  /** Rainkeeper: a storm cloud that follows its owner, raining inside radius r with the odd flicker, for `d` s. */
  private rainStorm(ev: Aoe, r: number, d: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const owner = ev.f ? ev.s : undefined;
    let x = ev.x, y = ev.y;
    const puffs: { p: Fx; ox: number; oy: number; oz: number; w: number; ph: number; dark: boolean }[] = [];
    for (let i = 0, n = 5 + s.n(4); i < n; i++) {
      const dark = i % 3 === 2;
      const p = s.aSmoke.hold(T.smoke[i % 3], x, y);
      p.tintTo(dark ? 0x4a5058 : 0x7c838c);
      const a = (i / n) * TAU + rand(-0.3, 0.3), dd = dark ? rand(0, r * 0.4) : rand(r * 0.25, r * 0.7);
      puffs.push({ p, ox: Math.cos(a) * dd, oy: Math.sin(a) * dd * 0.4, oz: dark ? -16 : rand(-6, 14), w: r * (dark ? rand(0.7, 0.9) : rand(0.75, 1.05)), ph: rand(0, TAU), dark });
      p.rotation = rand(0, TAU);
    }
    const shade = s.gNormal.hold(T.disc, x, y);
    shade.tintTo(0x0a1420);
    let age = 0, rain = 0, flick = rand(0.8, 1.6), snd = 0;
    V.add({
      update: (dt) => {
        age += dt;
        if (owner !== undefined) { const p = V.ctx.entityPos(owner); if (p) { x += (p.x - x) * clamp(dt * 6, 0, 1); y += (p.y - y) * clamp(dt * 6, 0, 1); } }
        const a = Math.min(clamp(age / 0.4, 0, 1), clamp((d - age) / 0.5, 0, 1));
        for (const q of puffs) {
          q.p.place(x + q.ox + Math.sin(age * 0.7 + q.ph) * 8, y + q.oy, CLOUD_Z + q.oz + Math.sin(age * 1.1 + q.ph) * 3);
          q.p.setScale(q.w * (1 + 0.04 * Math.sin(age * 0.9 + q.ph)), 0.62); q.p.rotation += dt * 0.05;
          q.p.setAlpha((q.dark ? 0.5 : 0.42) * a);
        }
        shade.place(x, y, 0); shade.setScale(r * 2, 1); shade.setAlpha(0.14 * a);
        rain += dt * 70 * Math.max(0.6, r / 120) * s.budget * a;
        while (rain > 1) {
          rain -= 1;
          const ang = rand(0, TAU), dd = Math.sqrt(Math.random()) * r * 0.95;
          const px = x + Math.cos(ang) * dd, py = y + Math.sin(ang) * dd;
          const life = 0.26;
          const st = s.aAdd.add(T.streak, px + 10, py, life);
          st.z = CLOUD_Z - 20; st.vx = -40; st.vz = -(CLOUD_Z - 20) / life; st.align = true; st.anchorX = 0.9; st.w0 = st.w1 = 34; st.k = 0.18; st.a0 = 0.45; st.fo = 1;
          st.tintTo(0xcfe2f0);
          if (Math.random() < 0.35) V.after(life, () => s.ring(s.gAdd, T.ringHard, px, py, 1, 7, 0xcfe2f0, 0.25, 0.4));
        }
        if ((flick -= dt) <= 0 && a > 0.5) {
          flick = rand(1.2, 2.6);
          s.glow(x + rand(-r, r) * 0.5, y, CLOUD_Z + rand(-4, 8), 50, r * 1.1, 0xdfe8ff, 0.1, 0.5);
        }
        if ((snd -= dt) <= 0 && a > 0.5) { snd = 1.1; V.sound('rain', x, y, 0.28); }
        return age < d;
      },
      kill: () => { for (const q of puffs) s.aSmoke.kill(q.p); s.gNormal.kill(shade); },
    });
  }

  // ─────────────────────────── data grounds ───────────────────────────

  /** Burning pitch: a black tar puddle with low flames licking across it. */
  private pitchGround(x: number, y: number, r: number, d: number): void {
    const V = this.V, s = V.sys, T = s.T;
    // an irregular splash (scorch splat) under a smaller glossy tar pool, both baked atlas frames
    const splat = s.gNormal.hold(T.scorch[(Math.random() * 2) | 0], x, y);
    splat.tintTo(0x120c08); splat.rotation = rand(0, TAU);
    const base = s.gNormal.hold(T.poolGoo, x, y);
    base.tintTo(0x2a1c12); base.rotation = rand(0, TAU);
    const glow = s.gAdd.hold(T.glow, x, y);
    glow.tintTo(0xff5a10);
    let age = 0, acc = 0;
    V.add({
      update: (dt) => {
        age += dt;
        const a = Math.min(clamp(age / 0.2, 0, 1), clamp((d - age) / 0.5, 0, 1));
        const g = 0.8 + 0.2 * clamp(age / 0.3, 0, 1);
        splat.place(x, y, 0); splat.setScale(r * 2.2 * g); splat.setAlpha(0.5 * a);
        base.place(x + 4, y + 2, 0); base.setScale(r * 1.55 * g); base.setAlpha(0.55 * a);
        glow.place(x, y, 0); glow.setScale(r * 2.1); glow.setAlpha(0.2 * a * (0.8 + 0.2 * Math.sin(age * 5 + x)));
        acc += dt * (r / 4) * s.budget;
        while (acc > 1 && age < d - 0.2) {
          acc -= 1;
          const ang = rand(0, TAU), dd = Math.sqrt(Math.random()) * r * 0.85;
          const px = x + Math.cos(ang) * dd, py = y + Math.sin(ang) * dd;
          const f = s.aAdd.add(T.flame, px, py, rand(0.35, 0.6));
          f.anchorY = 0.85; f.vz = rand(15, 40); f.w0 = rand(10, 18); f.w1 = 3; f.k = 1.4; f.fo = 0.3; f.flick = 0.3; f.a0 = 0.85 * a;
          f.tintFade(0xffd070, 0xff3a0a);
          if (Math.random() < 0.2) s.smoke(px, py, 10, 10, 30, 0x241e1a, rand(0.8, 1.2), 0.3, 30);
          if (Math.random() < 0.25) { const b = s.gNormal.add(T.bubble, px, py, rand(0.4, 0.6)); b.w0 = 3; b.w1 = rand(6, 10); b.fo = 0.7; b.se = 1; b.tintTo(0x3a2a1a); }
        }
        return age < d;
      },
      kill: () => { s.gNormal.kill(splat); s.gNormal.kill(base); s.gAdd.kill(glow); },
    });
    V.sound('fireball', x, y, 0.3);
  }

  /** Flood Plain: wet, glistening ground (it chills): a dark sheen, sparkles and the odd drip ring. */
  private wetGround(x: number, y: number, r: number, d: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const base = s.gNormal.hold(T.disc, x, y);
    base.tintTo(0x16222c);
    const sheen = s.gAdd.hold(T.glow, x, y);
    sheen.tintTo(0x8fc8ee);
    let age = 0, acc = 0;
    V.add({
      update: (dt) => {
        age += dt;
        const a = Math.min(clamp(age / 0.3, 0, 1), clamp((d - age) / 0.6, 0, 1));
        base.place(x, y, 0); base.setScale(r * 2, 1); base.setAlpha(0.34 * a);
        sheen.place(x, y, 0); sheen.setScale(r * 2.1, 0.75); sheen.setAlpha(0.07 * a * (0.8 + 0.2 * Math.sin(age * 2 + y)));
        acc += dt * (r / 10) * s.budget;
        while (acc > 1) {
          acc -= 1;
          const ang = rand(0, TAU), dd = Math.sqrt(Math.random()) * r * 0.9;
          const px = x + Math.cos(ang) * dd, py = y + Math.sin(ang) * dd;
          if (Math.random() < 0.6) s.glint(px, py, 1, rand(6, 10), 0xe8f6ff, rand(0.3, 0.5), 0.75 * a, s.gAdd);
          else s.ring(s.gAdd, T.ringHard, px, py, 1, rand(6, 12), 0xbfe2f8, 0.45, 0.3 * a);
        }
        return age < d;
      },
      kill: () => { s.gNormal.kill(base); s.gAdd.kill(sheen); },
    });
  }

  /** Burning ground (Pitch-Soaked snap) or a burning powder patch (Powder Horn: fizzing sparks and pops). */
  private fireGround(x: number, y: number, r: number, d: number, powder: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const base = s.gNormal.hold(T.scorch[powder ? 1 : 0], x, y);
    base.tintTo(powder ? 0x141414 : 0x000000); base.rotation = rand(0, TAU);
    const glow = s.gAdd.hold(T.glow, x, y);
    glow.tintTo(powder ? 0xffc04a : 0xff6a1a);
    let age = 0, acc = 0, pop = 0.2;
    V.add({
      update: (dt) => {
        age += dt;
        const a = Math.min(clamp(age / 0.2, 0, 1), clamp((d - age) / 0.4, 0, 1));
        base.place(x, y, 0); base.setScale(r * 2.2); base.setAlpha((powder ? 0.6 : 0.45) * a);
        glow.place(x, y, 0); glow.setScale(r * 2.2); glow.setAlpha(0.2 * a * (0.8 + 0.2 * Math.sin(age * 7 + x)));
        acc += dt * (r / (powder ? 3 : 3.5)) * s.budget;
        while (acc > 1 && age < d - 0.15) {
          acc -= 1;
          const ang = rand(0, TAU), dd = Math.sqrt(Math.random()) * r * 0.85;
          const px = x + Math.cos(ang) * dd, py = y + Math.sin(ang) * dd;
          if (powder && Math.random() < 0.6) s.spark(px, py, 2, rand(-Math.PI, 0), rand(80, 180), 7, Math.random() < 0.5 ? 0xfff0b0 : 0xffb040, rand(0.15, 0.3), 500);
          else {
            const f = s.aAdd.add(T.flame, px, py, rand(0.35, 0.55));
            f.anchorY = 0.85; f.vz = rand(20, 50); f.w0 = rand(14, 24); f.w1 = 3; f.k = 1.5; f.fo = 0.3; f.flick = 0.25; f.a0 = 0.85 * a;
            f.tintFade(powder ? 0xfff0a0 : 0xffd070, 0xff4a10);
          }
          if (Math.random() < 0.15) s.ember(px, py, 4, 0xff8a3d, rand(0.5, 0.9), 4, 60);
        }
        if (powder && (pop -= dt) <= 0 && age < d - 0.2) {
          pop = rand(0.25, 0.5);
          const px = x + rand(-r, r) * 0.6, py = y + rand(-r, r) * 0.6;
          s.flash(px, py, 4, 26, 0xfff0b0, 0.06, 0.7);
          s.smoke(px, py, 6, 10, 26, 0x8a8480, 0.6, 0.3, 30);
        }
        return age < d;
      },
      kill: () => { s.gNormal.kill(base); s.gAdd.kill(glow); },
    });
  }
}

// ─────────────────────────── painted props ───────────────────────────
// Original procedural art painted once on a canvas at PROP_RES px per world unit (like the warrior props in aoe.ts).

const PROP_RES = 3;
const INK = 'rgba(24,18,14,0.95)';
const cache = new Map<string, Texture>();
/** All props share ONE canvas source (shelf-packed as they are first needed), so their sprites batch together. */
const ATLAS_W = 512, ATLAS_H = 512, PAD = 3;
let atlas: { g: CanvasRenderingContext2D; src: CanvasSource; x: number; y: number; row: number } | null = null;

function ptex(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): Texture {
  const have = cache.get(key);
  if (have) return have;
  if (!atlas) {
    const c = document.createElement('canvas');
    c.width = ATLAS_W; c.height = ATLAS_H;
    atlas = { g: c.getContext('2d')!, src: new CanvasSource({ resource: c, resolution: PROP_RES, scaleMode: 'linear', autoGenerateMipmaps: true, label: 'ranger-props' }), x: PAD, y: PAD, row: 0 };
  }
  const pw = Math.ceil(w * PROP_RES), ph = Math.ceil(h * PROP_RES);
  if (atlas.x + pw + PAD > ATLAS_W) { atlas.x = PAD; atlas.y += atlas.row + PAD; atlas.row = 0; }
  const px = atlas.x, py = atlas.y;
  atlas.x += pw + PAD; atlas.row = Math.max(atlas.row, ph);
  const g = atlas.g;
  g.save();
  g.beginPath(); g.rect(px, py, pw, ph); g.clip();
  g.translate(px, py); g.scale(PROP_RES, PROP_RES);
  g.lineJoin = 'round'; g.lineCap = 'round';
  paint(g);
  g.restore();
  atlas.src.update();
  const t = new Texture({ source: atlas.src, frame: new Rectangle(px / PROP_RES, py / PROP_RES, pw / PROP_RES, ph / PROP_RES) });
  cache.set(key, t);
  return t;
}

function iron(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, '#c9ccd2'); gr.addColorStop(0.45, '#8a8e96'); gr.addColorStop(1, '#4a4e56');
  return gr;
}

/** One iron jaw of the spring snare: a toothed half-ring, hinge line at the bottom edge (front = a touch darker). */
function jawTex(front: boolean): Texture {
  return ptex(front ? 'jawF' : 'jawB', 36, 18, (g) => {
    const cx = 18, cy = 17.2, R = 16, r = 11.6;
    g.beginPath(); g.arc(cx, cy, R, Math.PI, 0); g.lineTo(cx + r, cy); g.arc(cx, cy, r, 0, Math.PI, true); g.closePath();
    g.fillStyle = iron(g, 0, 1, 0, 18); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
    // teeth along the inner edge, pointing to the centre
    g.beginPath();
    for (let i = 0; i < 7; i++) {
      const a0 = Math.PI + (i + 0.15) * (Math.PI / 7), a1 = Math.PI + (i + 0.5) * (Math.PI / 7), a2 = Math.PI + (i + 0.85) * (Math.PI / 7);
      g.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
      g.lineTo(cx + Math.cos(a1) * (r - 4.2), cy + Math.sin(a1) * (r - 4.2));
      g.lineTo(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r);
    }
    g.fillStyle = '#d8dbe0'; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.9;
    g.beginPath(); g.arc(cx, cy, R - 1.6, Math.PI * 1.12, Math.PI * 1.55); g.stroke();
    if (front) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(cx, cy, R, Math.PI, 0); g.lineTo(cx + r, cy); g.arc(cx, cy, r, 0, Math.PI, true); g.closePath(); g.fill(); }
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * (R - 2), cy - 0.8, 1.4, 0, Math.PI * 2); g.fillStyle = '#3a3e44'; g.fill(); }
  });
}

/** The snare's bed: a mound of turned soil, the iron plate and pan, a spring each side, a coil of rope and its stake. */
function jawBaseTex(): Texture {
  return ptex('jawBase', 48, 22, (g) => {
    g.beginPath(); g.ellipse(24, 13.5, 21, 7.6, 0, 0, Math.PI * 2);
    const sg = g.createRadialGradient(22, 11, 2, 24, 14, 22);
    sg.addColorStop(0, '#8a6f4d'); sg.addColorStop(0.7, '#5e4834'); sg.addColorStop(1, 'rgba(60,44,30,0)');
    g.fillStyle = sg; g.fill();
    for (const [x, y, rr] of [[7, 16, 1.4], [40, 11, 1.2], [33, 18, 1], [12, 9.6, 1]] as const) { g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fillStyle = '#9a8a74'; g.fill(); }
    // rope coil (left) and its tail to a wooden stake
    g.strokeStyle = '#2a1c10'; g.lineWidth = 2.6;
    for (const [rx, ry, oy] of [[6.4, 2.6, 0], [5.4, 2.2, -1.6]] as const) { g.beginPath(); g.ellipse(7, 15.4 + oy, rx, ry, -0.1, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = '#a8845a'; g.lineWidth = 1.5;
    for (const [rx, ry, oy] of [[6.4, 2.6, 0], [5.4, 2.2, -1.6]] as const) { g.beginPath(); g.ellipse(7, 15.4 + oy, rx, ry, -0.1, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = '#2a1c10'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(12, 13); g.quadraticCurveTo(16, 11, 17, 12.6); g.stroke();
    g.strokeStyle = '#a8845a'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(12, 13); g.quadraticCurveTo(16, 11, 17, 12.6); g.stroke();
    g.beginPath(); g.roundRect(1, 6, 2.8, 9, 1); g.fillStyle = '#7a5a36'; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
    // plate + pan
    g.beginPath(); g.ellipse(25, 12.6, 12.6, 4.6, 0, 0, Math.PI * 2); g.fillStyle = '#4a4e56'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.1; g.stroke();
    g.beginPath(); g.ellipse(25, 12.2, 5.2, 2.1, 0, 0, Math.PI * 2); g.fillStyle = '#868a92'; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke();
    // springs
    g.strokeStyle = '#3a3e44'; g.lineWidth = 1.4;
    for (const x0 of [11.4, 35.2]) { g.beginPath(); for (let i = 0; i <= 6; i++) { const x = x0 + i * 0.6, y = 12.6 + (i % 2 ? -1.8 : 1.8); if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
  });
}

/** Quarry Mark: an almond eye with a golden iris and slit pupil, two pale feathers sweeping down from its corners. */
function sigilTex(): Texture {
  return ptex('sigil', 44, 36, (g) => {
    const cream = '#f6edd2', gold = '#e6c35c';
    const feather = (sx: number) => {
      g.save(); g.translate(22, 0); g.scale(sx, 1);
      g.beginPath(); g.moveTo(10, 16); g.quadraticCurveTo(20, 18, 20.5, 31); g.quadraticCurveTo(13, 27, 7.4, 19.6); g.closePath();
      g.fillStyle = cream; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.1; g.stroke();
      g.strokeStyle = 'rgba(176,138,80,0.85)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(9, 17); g.quadraticCurveTo(16.6, 21, 20, 30.4); g.stroke();
      g.strokeStyle = 'rgba(120,96,60,0.5)'; g.lineWidth = 0.6;
      for (const t of [0.35, 0.55, 0.75]) { const x = 9 + 11 * t, y = 17 + 13 * t * t; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2.6, y + 1.8); g.stroke(); }
      g.restore();
    };
    feather(1); feather(-1);
    // the eye
    g.beginPath(); g.moveTo(5, 15); g.quadraticCurveTo(22, 2, 39, 15); g.quadraticCurveTo(22, 28, 5, 15); g.closePath();
    g.fillStyle = cream; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
    g.beginPath(); g.arc(22, 15, 6.2, 0, Math.PI * 2);
    const ig = g.createRadialGradient(21, 13.6, 1, 22, 15, 6.4); ig.addColorStop(0, '#fff2b0'); ig.addColorStop(0.55, gold); ig.addColorStop(1, '#a8801e');
    g.fillStyle = ig; g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.ellipse(22, 15, 1.7, 4.6, 0, 0, Math.PI * 2); g.fillStyle = '#20160c'; g.fill();
    g.beginPath(); g.arc(20.2, 12.8, 1.2, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    g.strokeStyle = 'rgba(230,195,92,0.9)'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(8.4, 12.2); g.quadraticCurveTo(22, 3.4, 35.6, 12.2); g.stroke();
    // a small golden lozenge above
    g.beginPath(); g.moveTo(22, 1); g.lineTo(24.4, 4.2); g.lineTo(22, 7.2); g.lineTo(19.6, 4.2); g.closePath(); g.fillStyle = gold; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
  });
}

/** Falcon (head toward +x): stooping with wings folded tight (dive), or wings spread climbing away. */
function falconTex(spread: boolean): Texture {
  if (!spread) {
    return ptex('falconDive', 44, 16, (g) => {
      g.beginPath(); g.moveTo(1, 8); g.lineTo(9, 5.6); g.quadraticCurveTo(24, 2, 36, 5.4); g.quadraticCurveTo(42, 7.4, 43, 8.6);
      g.quadraticCurveTo(38, 11.4, 30, 11.4); g.quadraticCurveTo(18, 12.6, 9, 10.4); g.closePath();
      const bg = g.createLinearGradient(0, 3, 0, 12); bg.addColorStop(0, '#6c7886'); bg.addColorStop(0.55, '#4c5664'); bg.addColorStop(1, '#e2d6bc');
      g.fillStyle = bg; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
      g.strokeStyle = 'rgba(30,34,40,0.6)'; g.lineWidth = 0.8;
      for (const x of [14, 19, 24, 29]) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x - 3.4, 9.4); g.stroke(); }
      g.beginPath(); g.ellipse(37.6, 7.4, 3.6, 2.6, 0, 0, Math.PI * 2); g.fillStyle = '#2e3440'; g.fill();
      g.beginPath(); g.arc(38.4, 6.8, 1, 0, Math.PI * 2); g.fillStyle = '#ffd860'; g.fill();
      g.beginPath(); g.moveTo(41.4, 7.8); g.lineTo(44, 8.8); g.lineTo(41.4, 9.8); g.closePath(); g.fillStyle = '#e8b840'; g.fill();
    });
  }
  return ptex('falconUp', 46, 28, (g) => {
    const wing = (sy: number) => {
      g.beginPath(); g.moveTo(18, 14); g.quadraticCurveTo(14, 14 - 10 * sy, 2, 14 - 12.5 * sy); g.quadraticCurveTo(12, 14 - 4.6 * sy, 15, 14 - 1 * sy);
      g.quadraticCurveTo(20, 14 - 7 * sy, 26, 14 - 1 * sy); g.closePath();
      g.fillStyle = sy > 0 ? '#5a6674' : '#46505c'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.1; g.stroke();
      g.strokeStyle = 'rgba(230,220,200,0.5)'; g.lineWidth = 0.7;
      for (const t of [0.3, 0.5, 0.7]) { g.beginPath(); g.moveTo(16 - 10 * t, 14 - (5 + 6 * t) * sy); g.lineTo(18 - 10 * t, 14 - (2 + 4 * t) * sy); g.stroke(); }
    };
    wing(1);
    g.beginPath(); g.moveTo(4, 15); g.lineTo(12, 13); g.quadraticCurveTo(26, 11, 36, 13); g.quadraticCurveTo(41, 14, 42, 15.4); g.quadraticCurveTo(36, 18, 26, 17.6); g.quadraticCurveTo(14, 18, 4, 15); g.closePath();
    const bg = g.createLinearGradient(0, 11, 0, 18); bg.addColorStop(0, '#5c6876'); bg.addColorStop(1, '#e2d6bc');
    g.fillStyle = bg; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
    wing(-0.5);
    g.beginPath(); g.ellipse(37, 13.8, 3.4, 2.5, 0, 0, Math.PI * 2); g.fillStyle = '#2e3440'; g.fill();
    g.beginPath(); g.arc(37.8, 13.2, 0.9, 0, Math.PI * 2); g.fillStyle = '#ffd860'; g.fill();
    g.beginPath(); g.moveTo(40.4, 14); g.lineTo(43.2, 15); g.lineTo(40.4, 16); g.closePath(); g.fillStyle = '#e8b840'; g.fill();
  });
}
