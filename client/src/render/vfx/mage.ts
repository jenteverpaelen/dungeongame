// Mage M1 effects (docs/rework/depth/MAGE.md §3, bible M7–M12 "VFX / icon / sound", plus the wave's rune, node and
// set visuals). Everything here is drawn with pooled particles from the shared fx atlas (FxSystem add / hold / kill):
// no Graphics, no filters, no per-event display objects. Held particles are positioned by their effect every frame;
// optional counts go through s.n() / s.budget so a saturated screen thins them out.
//
//   projectiles  needle · needle_spine · stormglass · kinbolt          (simulated by projectiles.ts)
//   area         ray · ray_refract · ray_pulse · rimefield(_bloom/_extend) · rime_burst · glass_burst · glass_shard ·
//                kin_burst · kin_taunt · orrery(_wide) · orrery_sun · eclipse · nova_cone · lodestone · star_crater ·
//                lantern · hydra_breath
//   beams        zap (stormglass)          casts  rime_needles · thrumming_ray · cinderkin · rimefield · stormglass_orb · orrery

import { MAGE_FX } from '@shared/data/skills';
import type { GameEvent } from '@shared/protocol';
import type { Texture } from 'pixi.js';
import { preferences } from '../../game/preferences';
import { jagged } from './beams';
import type { Combat } from './combat';
import type { VfxCore } from './core';
import type { Fx, FxLayer } from './particles';
import type { Proj } from './projectiles';
import { EL_ARCANE, EL_COLD, EL_FIRE, EL_LIGHT, EL_PHYS, TAU, angDiff, clamp, easeOut, easeOut3, easeOutBack, lerp, lerpColor, pal, rand } from './util';

type Aoe = Extract<GameEvent, { e: 'aoe' }>;
type Beam = Extract<GameEvent, { e: 'beam' }>;
type Cast = Extract<GameEvent, { e: 'cast' }>;

/** Area visuals handled here (AoeFx routes them before its own switch). */
export const MAGE_AOE = new Set([
  'ray', 'ray_refract', 'ray_pulse', 'rimefield', 'rimefield_bloom', 'rimefield_extend', 'rime_burst', 'glass_burst', 'glass_shard',
  'kin_burst', 'kin_taunt', 'orrery', 'orrery_wide', 'orrery_sun', 'eclipse', 'nova_cone', 'lodestone', 'star_crater', 'lantern', 'hydra_breath',
]);
/** Projectile visuals handled here (projectiles.ts routes build / place / trail / impact). */
export const MAGE_PROJ = new Set(['needle', 'needle_spine', 'stormglass', 'kinbolt']);

/** Hand / chest height of beams and cast flourishes (casts.ts HAND), and the orrery spheres' height. */
const HAND = 34;
const BEAM_Z = 31;
const SPHERE_Z = 30;
/** Segments per standing-wave strand of the ray (two strands per beam). */
const STRAND_SEGS = 28;
const wave = new Float32Array(STRAND_SEGS + 1);

/** Eclipse beam layers: glow, mid, core widths and alphas. */
const BEAM_W = [38, 14, 5], BEAM_A = [0.42, 0.8, 1];

const BRASS = 0xd8b46a;
const GLASS = 0x7fd3ff;
const RIME = 0xbfe9ff;

interface RayPal { glow: number; mid: number; core: number }

/** A held T.line particle stretched into a beam of length L and width w, centred on (mx, my) at height z. */
function beamLine(p: Fx, mx: number, my: number, z: number, a: number, L: number, w: number, alpha: number): void {
  const l = L + w * 0.5;
  p.place(mx, my, z); p.rotation = a; p.setScale(l, w / l); p.setAlpha(alpha);
}
/** Thrumming Ray colours: violet arcane (bible 0xa07cff), the element's colours for Frostline / Searing Thread. */
function rayPal(el: number): RayPal {
  switch (el) {
    case EL_COLD: return { glow: 0x5fc4ff, mid: 0xbfeaff, core: 0xffffff };
    case EL_FIRE: return { glow: 0xff6a1a, mid: 0xffb860, core: 0xfff2c8 };
    case EL_LIGHT: return { glow: 0x8f7bff, mid: 0xd6c8ff, core: 0xffffff };
    default: return { glow: 0xa07cff, mid: 0xd2c0ff, core: 0xfbf8ff };
  }
}

/** Needle colours: pale rime blue (bible 0x9fdcff), violet for Arcane Thorns, else the element. */
function needleCol(el: number): [number, number] {
  switch (el) {
    case EL_COLD: case EL_PHYS: return [0x9fdcff, 0xe8fbff];
    case EL_ARCANE: return [0xb48cff, 0xf0e4ff];
    default: { const P = pal(el); return [P.main, P.hot]; }
  }
}

interface Ray {
  owner: number; el: number; P: RayPal;
  a: number; ta: number; len: number; tlen: number; res: number; tres: number;
  ox: number; oy: number; seen: number; phase: number; sparks: number; glints: number; segs: number;
  glow: Fx; mid: Fx; core: Fx; hand: Fx; handCore: Fx; tip: Fx; tipGlow: Fx; strands: Fx[];
}
interface RayOwner { beams: Ray[]; frame: number; idx: number; hum: number }

interface Field {
  owner: number; x: number; y: number; r: number; age: number; end: number; alive: boolean;
  flourish(): void;
}

interface Orrery { owner: number; n: number; pts: Float32Array; alive: boolean }

export class MageFx {
  private rayOwners = new Map<number, RayOwner>();
  private fields: Field[] = [];
  private orreries: Orrery[] = [];
  private lastNeedleSnd = -1;
  private lastZapSnd = -1;
  private zapLoad = 0;
  private zapT = 0;
  private readonly zapSrc = { x: 0, y: 0, t: -1 };
  private orbFrameT = -1;
  private orbNow = 0;
  private orbPrev = 0;
  private lastChime = -1;

  constructor(private V: VfxCore, private combat: Combat) {}

  // ═══════════════════════════════ routing ═══════════════════════════════

  aoe(ev: Aoe, mine: boolean): void {
    const d = ev.d / 1000;
    const r = Math.max(8, ev.r);
    switch (ev.v) {
      case 'ray': this.ray(ev, mine); break;
      case 'ray_refract': this.refract(ev.x, ev.y, ev.a ?? 0, r, Math.max(0.12, d), ev.el); break;
      case 'ray_pulse': this.rayPulse(ev.x, ev.y, ev.a ?? 0, r, Math.max(0.15, d), ev.el); break;
      case 'rimefield': case 'rimefield_bloom': this.rimefield(ev, ev.v === 'rimefield_bloom', mine); break;
      case 'rimefield_extend': this.rimeExtend(ev); break;
      case 'rime_burst': this.rimeBurst(ev.x, ev.y, r, mine); break;
      case 'glass_burst': this.glassBurst(ev.x, ev.y, r, ev.el, mine); break;
      case 'glass_shard': this.glassShard(ev.x, ev.y, Math.max(0.5, d), ev.el); break;
      case 'kin_burst': this.kinBurst(ev.x, ev.y, r, ev.el, mine); break;
      case 'kin_taunt': this.kinTaunt(ev.x, ev.y, r, Math.max(0.4, d), mine); break;
      case 'orrery': case 'orrery_wide': this.orrery(ev, ev.v === 'orrery_wide', mine); break;
      case 'orrery_sun': this.orrerySun(ev.s ?? -1, ev.x, ev.y, r, Math.max(0.5, d)); break;
      case 'eclipse': this.eclipse(ev.x, ev.y, ev.a ?? 0, r, ev.el, mine); break;
      case 'nova_cone': this.novaCone(ev.x, ev.y, r, ev.a ?? 0, ev.el, mine); break;
      case 'lodestone': this.lodestone(ev.x, ev.y, r, Math.max(0.3, d), ev.el, mine); break;
      case 'star_crater': this.starCrater(ev.x, ev.y, r, Math.max(0.4, d), mine); break;
      case 'lantern': this.lantern(ev.x, ev.y, r, Math.max(0.5, d), mine); break;
      case 'hydra_breath': this.hydraBreath(ev.x, ev.y, r, ev.a ?? 0, ev.el, mine); break;
    }
  }

  // ═══════════════════════════════ projectiles ═══════════════════════════════

  projBuild(p: Proj, add: (layer: FxLayer, tex: Texture, color: number) => Fx): void {
    const s = this.V.sys, T = s.T;
    switch (p.v) {
      case 'needle': case 'needle_spine': {
        p.z = 28; p.turn = 6;
        const [c, h] = needleCol(p.el);
        p.color = c; p.hot = h;
        add(s.aAdd, T.streak, c);
        add(s.aAdd, T.glow, c);
        add(s.aBody, T.needle, lerpColor(h, 0xffffff, 0.35));
        break;
      }
      case 'stormglass': {
        const cold = p.el === EL_COLD;
        p.z = 30; p.color = cold ? 0x9fdcff : GLASS; p.hot = 0xffffff;
        add(s.aAdd, T.glow, p.color);
        add(s.aAdd, T.core, cold ? 0xe8fbff : 0xd8f0ff);
        add(s.aBody, T.glassOrb, cold ? 0xeefcff : 0xd2efff);
        p.aux = 0; p.aux2 = 0.62;
        break;
      }
      default: { // kinbolt: a small firebolt (Frostkin: a frost bolt)
        const cold = p.el === EL_COLD;
        p.z = 20; p.turn = 4;
        p.color = cold ? 0x8fe0ff : 0xff8a3d; p.hot = cold ? 0xe8fbff : 0xffe08a;
        add(s.aAdd, T.glow, p.color);
        add(s.aAdd, T.core, p.hot);
      }
    }
  }

  projSound(p: Proj): void {
    const V = this.V;
    const vol = p.mine ? 1 : 0.45;
    if (p.v === 'needle' || p.v === 'needle_spine') {
      // one set of three glassy ticks per volley (the needles of a volley spawn together)
      if (V.real - this.lastNeedleSnd < 0.07) return;
      this.lastNeedleSnd = V.real;
      V.sound(p.v === 'needle_spine' ? 'needle_spine' : 'needles', p.x, p.y, vol * 0.9);
    } else if (p.v === 'stormglass') V.sound('glass_hum', p.x, p.y, vol * 0.8);
    else V.sound('firebolt', p.x, p.y, vol * 0.45);
  }

  projPlace(p: Proj, dt: number, ang: number): void {
    const V = this.V, s = V.sys;
    const sz = p.sz, t = p.age, parts = p.parts;
    switch (p.v) {
      case 'needle': case 'needle_spine': {
        const spine = p.v === 'needle_spine';
        const [tr, g, body] = parts;
        tr.place(p.x - Math.cos(ang) * 10 * sz, p.y + 1, p.z);
        tr.rotation = ang; tr.anchorX = 0.85; tr.setScale(Math.min(spine ? 54 : 62, 16 + t * 360) * sz, spine ? 0.8 : 0.5); tr.setAlpha(0.6);
        g.place(p.x, p.y, p.z); g.rotation = ang; g.setScale(30 * sz, 0.42); g.setAlpha(spine ? 0.7 : 0.5);
        body.place(p.x, p.y + 1, p.z); body.rotation = ang; body.setScale(25 * sz); body.setAlpha(1);
        break;
      }
      case 'stormglass': {
        const [g, core, shell] = parts;
        const pul = 1 + Math.sin(t * 16 + p.phase) * 0.07;
        const flick = preferences.get().values.reduceFlashes ? 0.5 : Math.random();
        // Crowd: orbs are slow (2 s in flight), so a Spender chain keeps 6-10 alive along one line and their additive
        // glows summed into a white band in a real rift (shots/mage). Above two orbs on screen each glow dims so the
        // total stays near two orbs' worth (counted per frame; the shell and the lightning inside stay full).
        if (V.real !== this.orbFrameT) { this.orbFrameT = V.real; this.orbPrev = this.orbNow; this.orbNow = 0; }
        this.orbNow++;
        const crowd = Math.min(1, 2 / Math.max(1, this.orbPrev));
        g.place(p.x, p.y, p.z); g.setScale(84 * sz * pul); g.setAlpha((0.4 + 0.16 * flick) * crowd);
        core.place(p.x, p.y, p.z); core.setScale((8 + 6 * flick) * sz); core.setAlpha(0.7);
        shell.place(p.x, p.y + 0.5, p.z); shell.setScale(42 * sz); shell.rotation = Math.sin(t * 3 + p.phase) * 0.12; shell.setAlpha(0.92);
        if (dt <= 0) break;
        // lightning trapped inside the glass: a few jagged chords, re-struck every ~55 ms
        p.aux -= dt;
        if (p.aux <= 0) {
          p.aux = 0.055;
          const ri = 13 * sz, cx = p.x, cy = p.y - p.z;
          const n = 1 + (Math.random() < 0.6 ? 1 : 0) + (s.budget > 0.6 && Math.random() < 0.4 ? 1 : 0);
          const hot = p.el === EL_COLD ? 0xf2fdff : 0xeaf6ff;
          for (let i = 0; i < n; i++) {
            const a0 = rand(0, TAU), a1 = a0 + rand(1.6, 3.2), r0 = ri * rand(0.2, 0.95), r1 = ri * rand(0.5, 0.95);
            let px = cx + Math.cos(a0) * r0, py = cy + Math.sin(a0) * r0;
            const qx = cx + Math.cos(a1) * r1, qy = cy + Math.sin(a1) * r1;
            for (let k = 1; k <= 3; k++) {
              const nx = px + (qx - px) / (4 - k) + (k < 3 ? rand(-3, 3) : 0), ny = py + (qy - py) / (4 - k) + (k < 3 ? rand(-3, 3) : 0);
              s.seg(s.aAdd, px, py, nx, ny, 5.5, p.color, 0.08, 0.6);
              s.seg(s.aAdd, px, py, nx, ny, 2, hot, 0.08, 1);
              px = nx; py = ny;
            }
          }
          // now and then an arc leaps out of the glass
          if (Math.random() < 0.18 * s.budget) this.combat.zigzag(cx, cy, rand(0, TAU), rand(20, 34) * sz, hot, 0.08, 1.5);
        }
        p.aux2 -= dt;
        if (p.aux2 <= 0) { p.aux2 = 0.6; V.sound('glass_hum', p.x, p.y, p.mine ? 0.55 : 0.22); }
        break;
      }
      default: {
        const [g, c] = parts;
        const fl = 0.85 + Math.random() * 0.3;
        g.place(p.x, p.y, p.z); g.setScale(40 * sz * fl); g.setAlpha(0.85);
        c.place(p.x, p.y, p.z); c.setScale(13 * sz); c.setAlpha(1);
      }
    }
  }

  projTrail(p: Proj, x: number, y: number, z: number): void {
    const s = this.V.sys, T = s.T;
    switch (p.v) {
      case 'needle': case 'needle_spine': {
        const spine = p.v === 'needle_spine';
        if (Math.random() < 0.5) s.glint(x, y, z, spine ? 13 : 8, p.hot, 0.25, 0.85);
        if (Math.random() < 0.35) {
          const f = s.aAdd.add(T.dot, x + rand(-3, 3), y, rand(0.3, 0.45));
          f.z = z + rand(-3, 3); f.vz = -18; f.w0 = 3.2; f.w1 = 0.6; f.fo = 0.3; f.tintTo(0xeafaff);
        }
        if (spine && Math.random() < 0.4) s.smoke(x, y, z, 10, 26, 0xdff4ff, rand(0.4, 0.6), 0.2, 6);
        break;
      }
      case 'stormglass': {
        if (Math.random() < 0.45) {
          const f = s.aAdd.add(T.dot, x + rand(-5, 5), y, rand(0.3, 0.45));
          f.z = z + rand(-6, 6); f.w0 = 6; f.w1 = 1; f.fo = 0.2; f.tintTo(p.color);
        }
        if (Math.random() < 0.25) s.glint(x + rand(-6, 6), y, z + rand(-6, 6), 10, 0xeaf8ff, 0.25, 0.8);
        break;
      }
      default: {
        if (p.el === EL_COLD) {
          if (Math.random() < 0.5) s.glint(x, y, z, 8, p.hot, 0.22, 0.8);
          const f = s.aAdd.add(T.dot, x, y, 0.25); f.z = z; f.w0 = 7; f.w1 = 1; f.fo = 0; f.tintTo(p.color);
        } else {
          const f = s.aAdd.add(T.flame, x, y, rand(0.16, 0.26));
          f.z = z; f.anchorY = 0.7; f.w0 = 16 * p.sz; f.w1 = 4; f.k = 1.3; f.fo = 0.2;
          f.rotation = Math.atan2(p.vy, p.vx) + Math.PI / 2;
          f.tintFade(p.hot, p.color);
          if (Math.random() < 0.3) s.ember(x, y, z, p.color, 0.45, 3.5, 30);
        }
      }
    }
  }

  projImpact(p: Proj, hit: boolean, x: number, y: number, z: number): void {
    const V = this.V, s = V.sys, T = s.T;
    switch (p.v) {
      case 'needle': case 'needle_spine': {
        const spine = p.v === 'needle_spine', k = spine ? 1.7 : 1;
        s.flash(x, y, z, (hit ? 24 : 14) * k, p.hot, 0.07, hit ? 0.8 : 0.5);
        for (let i = 0, n = spine ? 6 : hit ? 3 : 2; i < n; i++) s.chunk(x, y, z, rand(-90, 90), rand(-40, 40), rand(60, 150), rand(3, 5) * k, i % 2 ? 0xdff6ff : lerpColor(p.color, 0xffffff, 0.4), 0.45, T.shard[i % 3]);
        s.glint(x, y, z, 15 * k, 0xffffff, 0.2);
        if (hit && p.el !== EL_ARCANE) s.smoke(x, y, z, 10 * k, 24 * k, 0xdff4ff, 0.5, 0.24, 8);
        if (spine && hit) {
          s.ring(s.aAdd, T.ringHard, x, y, 4, 30, p.hot, 0.2, 0.8, z);
          V.sound('needle_ping', x, y, p.mine ? 0.6 : 0.3);
        }
        break;
      }
      case 'stormglass': {
        // a bounce off a wall or the end of the flight (the shatter itself is the `glass_burst` aoe)
        s.flash(x, y, z, 44, 0xdff6ff, 0.08, 0.7);
        s.glint(x, y, z, 22, 0xffffff, 0.2);
        for (let i = 0, n = s.n(4); i < n; i++) s.spark(x, y, z, rand(0, TAU), rand(120, 240), 9, p.color, 0.18);
        break;
      }
      default: {
        s.flash(x, y, z, 28, p.hot, 0.08, 0.85);
        if (p.el === EL_COLD) for (let i = 0; i < 3; i++) s.chunk(x, y, z, rand(-70, 70), rand(-30, 30), rand(60, 140), 4, 0xdff6ff, 0.4, T.shard[i % 3]);
        else for (let i = 0, n = s.n(4); i < n; i++) s.ember(x, y, z * 0.7, p.color, rand(0.4, 0.7), 4, 60);
      }
    }
  }

  /** An Orrery sphere fired this missile (it spawned on a live sphere): play the sphere's soft chime instead. */
  orreryChime(x: number, y: number, mine: boolean): boolean {
    for (const o of this.orreries) {
      if (!o.alive) continue;
      for (let i = 0; i < o.n; i++) {
        if (Math.abs(o.pts[i * 2] - x) < 34 && Math.abs(o.pts[i * 2 + 1] - y) < 34) {
          if (this.V.real - this.lastChime > 0.06) { this.lastChime = this.V.real; this.V.sound('orrery_chime', x, y, mine ? 0.6 : 0.25); }
          return true;
        }
      }
    }
    return false;
  }

  // ═══════════════════════════════ beams & casts ═══════════════════════════════

  /** Stormglass zap: a short, bright, jagged strike from the orb to a target (Hailglass: icy white-blue). */
  zap(ev: Beam): void {
    const V = this.V, s = V.sys;
    const cold = ev.el === EL_COLD;
    const glow = cold ? 0x9fdcff : GLASS, mid = cold ? 0xe2f8ff : 0xc4ecff;
    const d = Math.max(0.1, ev.d / 1000);
    const ax = ev.x, ay = ev.y - 30, bx = ev.tx, by = ev.ty - 24;
    // Zap load (zaps landing in the last ~quarter second, all orbs): two orbs with extra zap targets land 10+ zaps per
    // server step on one pack, and their additive flashes summed to a white-out in a real rift (shots/mage). Above 4 in
    // flight the re-strike is skipped and flash / outer glow / sparks scale down; one source glow per orb per step.
    const now = V.real;
    this.zapLoad = this.zapLoad * Math.exp(-(now - this.zapT) / 0.25) + 1; this.zapT = now;
    const k = Math.min(1, 4 / this.zapLoad);
    const strike = () => {
      const pts = jagged(ax, ay, bx, by, 0.2);
      const life = d * 0.62;
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i - 1], [qx, qy] = pts[i];
        s.seg(s.aAdd, px, py, qx, qy, 11, glow, life, 0.38 * Math.max(0.4, k));
        s.seg(s.aAdd, px, py, qx, qy, 4, mid, life, 0.7);
        s.seg(s.aAdd, px, py, qx, qy, 1.7, 0xffffff, life, 1);
      }
    };
    strike();
    if (k >= 1) V.after(d * 0.45, strike);
    s.flash(bx, ev.ty, 24, 34, mid, 0.08, 0.85 * k);
    const same = now - this.zapSrc.t < 0.1 && Math.abs(ax - this.zapSrc.x) < 24 && Math.abs(ev.y - this.zapSrc.y) < 24;
    if (!same) { s.glow(ax, ev.y, 30, 20, 34, glow, 0.1, 0.6); this.zapSrc.x = ax; this.zapSrc.y = ev.y; this.zapSrc.t = now; }
    for (let i = 0, n = s.n(3 * k); i < n; i++) s.spark(bx, ev.ty, 24, rand(0, TAU), rand(120, 240), 9, i % 2 ? 0xffffff : glow, 0.16);
    if (V.real - this.lastZapSnd > 0.07) { this.lastZapSnd = V.real; V.sound('glass_zap', bx, ev.ty, 0.55); }
  }

  /** Caster flourishes of the six new skills. Returns false for skills this module does not draw. */
  cast(ev: Cast, el: number, mine: boolean): boolean {
    const V = this.V, s = V.sys, T = s.T;
    const x = ev.x, y = ev.y;
    const a = Math.atan2(ev.ty - y, ev.tx - x);
    const dir = Math.cos(a) >= 0 ? 1 : -1;
    const hx = x + dir * 14, hz = HAND;
    const vol = mine ? 1 : 0.5;
    switch (ev.sk) {
      case 'rime_needles': {
        // quick flick: three glints spark off the hand along the throw
        const [c, h] = needleCol(el);
        s.flash(hx, y, hz, 26, c, 0.07, 0.6);
        for (let i = 0; i < 3; i++) V.after(i * 0.03, () => s.glint(hx + Math.cos(a) * (6 + i * 7), y + Math.sin(a) * (4 + i * 5), hz, 13, i === 1 ? 0xffffff : h, 0.16, 0.95));
        return true;
      }
      case 'thrumming_ray': {
        // channel start: violet light drawn in to the hands, then a soft flash
        const P = rayPal(el);
        const cx = x + Math.cos(a) * 16, cy = y + Math.sin(a) * 16;
        for (let i = 0; i < 9; i++) {
          const aa = (i / 9) * TAU, d = 52;
          const p = s.aAdd.add(T.streak, cx + Math.cos(aa) * d, cy + Math.sin(aa) * d * 0.6, 0.16);
          p.z = BEAM_Z + Math.sin(aa) * 10; p.vx = (-Math.cos(aa) * d) / 0.16; p.vy = (-Math.sin(aa) * d * 0.6) / 0.16; p.align = true; p.anchorX = 0.9;
          p.w0 = 26; p.w1 = 8; p.k = 0.4; p.a0 = 0.55; p.fo = 0.3; p.tintTo(i % 2 ? P.mid : P.glow);
        }
        V.after(0.14, () => {
          s.flash(cx, cy, BEAM_Z, 54, P.mid, 0.12, 0.75);
          s.ring(s.aAdd, T.ringHard, cx, cy, 6, 34, P.glow, 0.22, 0.7, BEAM_Z);
        });
        V.sound('ray_start', x, y, vol * 0.7);
        return true;
      }
      case 'cinderkin': {
        // embers coaxed out of the ground where the kin will stand (Frostkin: frost)
        const px = ev.tx || x, py = ev.ty || y, cold = el === EL_COLD;
        const main = cold ? 0x9fdcff : 0xff8a3d, hot = cold ? 0xe8fbff : 0xffd890;
        s.glow(px, py, 0, 30, 90, main, 0.45, 0.4, s.gAdd);
        s.ring(s.gAdd, T.ringHard, px, py, 6, 40, main, 0.35, 0.7);
        for (let i = 0, n = s.n(14); i < n; i++) {
          const aa = rand(0, TAU), d = rand(0, 26);
          if (cold) s.glint(px + Math.cos(aa) * d, py + Math.sin(aa) * d * 0.6, rand(2, 26), 11, hot, rand(0.3, 0.5), 0.85);
          else s.ember(px + Math.cos(aa) * d, py + Math.sin(aa) * d * 0.6, 2, i % 3 ? main : hot, rand(0.6, 1), 4.5, 110);
        }
        for (let i = 0, n = s.n(5); i < n; i++) {
          const aa = rand(0, TAU);
          s.chunk(px, py, 2, Math.cos(aa) * rand(30, 80), Math.sin(aa) * rand(20, 50), rand(150, 240), rand(4, 6), cold ? 0xcfeeff : i % 2 ? 0x3b2c26 : 0xff8a3d, rand(0.5, 0.8), cold ? T.shard[i % 3] : undefined);
        }
        if (cold) for (let i = 0, n = s.n(3); i < n; i++) s.smoke(px + rand(-14, 14), py, 6, 18, 44, 0xdff4ff, rand(0.6, 0.9), 0.28, 20);
        else for (let i = 0, n = s.n(5); i < n; i++) {
          const f = s.aAdd.add(T.flame, px + rand(-14, 14), py + rand(-5, 5), rand(0.3, 0.45));
          f.anchorY = 0.85; f.vz = rand(50, 100); f.w0 = rand(12, 18); f.w1 = 3; f.k = 1.5; f.fo = 0.3; f.flick = 0.2; f.tintFade(hot, main);
        }
        s.flash(hx, y, hz, 30, main, 0.1, 0.5);
        V.sound('kin_spawn', px, py, vol);
        return true;
      }
      case 'rimefield': {
        // frost gathers at the hands, then a cold streak is cast toward the field
        const hot = el === EL_LIGHT ? 0xf0ecff : 0xe8fbff, main = el === EL_LIGHT ? 0xc8d8ff : RIME;
        for (let i = 0; i < 6; i++) {
          const aa = (i / 6) * TAU, d = 36;
          const f = s.aAdd.add(T.flake, hx + Math.cos(aa) * d, y + Math.sin(aa) * d * 0.6, 0.15);
          f.z = hz + Math.sin(aa) * 8; f.vx = (-Math.cos(aa) * d) / 0.15; f.vy = (-Math.sin(aa) * d * 0.6) / 0.15; f.w0 = 11; f.w1 = 5; f.vr = 6; f.fo = 0.6; f.tintTo(hot);
        }
        V.after(0.15, () => {
          s.flash(hx, y, hz, 50, hot, 0.12, 0.75);
          const st = s.aAdd.add(T.streak, hx, y, 0.22);
          st.z = hz; st.rotation = a; st.anchorX = 0.1; st.w0 = 30; st.w1 = 120; st.k = 0.45; st.se = 3; st.fo = 0.2; st.a0 = 0.7; st.tintTo(main);
          for (let i = 0, n = s.n(5); i < n; i++) s.glint(hx + Math.cos(a) * rand(10, 60), y + Math.sin(a) * rand(6, 40), hz + rand(-6, 6), 11, hot, 0.25, 0.85);
        });
        return true;
      }
      case 'stormglass_orb': {
        // glassy crackle at the hand as the orb is released
        const cold = el === EL_COLD, hot = cold ? 0xf2fdff : 0xdff4ff;
        s.flash(hx, y, hz, 44, cold ? 0xdff6ff : 0xbfe9ff, 0.1, 0.8);
        s.glow(hx, y, hz, 30, 54, GLASS, 0.18, 0.6);
        for (let i = 0; i < 4; i++) this.combat.zigzag(hx, y - hz, rand(0, TAU), rand(12, 22), hot, 0.12, 1.7);
        s.glint(hx, y, hz + 4, 18, 0xffffff, 0.2);
        return true;
      }
      case 'orrery': {
        // brass rings unfold around the caster
        const cold = el === EL_COLD, brass = cold ? 0xbfe9ff : BRASS, hot = cold ? 0xf2fdff : 0xffe8b0;
        const rr = s.gAdd.add(T.runeRing, x, y, 0.75);
        rr.w0 = 60; rr.w1 = 300; rr.se = 3; rr.vr = 1.6; rr.fo = 0.45; rr.a0 = 0.75; rr.tintTo(brass);
        s.ring(s.gAdd, T.ringHard, x, y, 10, 140, hot, 0.5, 0.65);
        const up = s.aAdd.add(T.runeRing, x, y, 0.6);
        up.z = SPHERE_Z; up.w0 = 40; up.w1 = 180; up.k = 0.45; up.se = 3; up.vr = -2.2; up.fo = 0.4; up.a0 = 0.55; up.tintTo(brass);
        s.flash(x, y, hz, 70, hot, 0.16, 0.6);
        for (let i = 0, n = s.n(10); i < n; i++) {
          const g = s.aAdd.add(i % 3 ? T.dot : T.star4, x + rand(-30, 30), y + rand(-10, 10), rand(0.6, 1));
          g.z = rand(4, 40); g.vz = rand(30, 70); g.w0 = rand(5, 9); g.w1 = 1; g.fo = 0.35; g.vr = 2; g.tintFade(hot, brass);
        }
        V.sound('orrery_unfold', x, y, vol);
        return true;
      }
    }
    return false;
  }

  // ═══════════════════════════════ Thrumming Ray ═══════════════════════════════

  /**
   * One channel tick of a beam (sent every 250 ms per beam, two per tick with Forked Signal). Beams are kept per
   * owner in emission order, so the k-th `ray` of a tick always drives the owner's k-th beam; a beam that hears
   * nothing for 0.3 s fades out. Drawn from the caster's live position (smooth) at hand height.
   */
  private ray(ev: Aoe, mine: boolean): void {
    const V = this.V;
    const owner = ev.s ?? -1, a = ev.a ?? 0, len = Math.max(30, ev.r), res = clamp(ev.d, 0, 100);
    let O = this.rayOwners.get(owner);
    if (!O) { O = { beams: [], frame: -1, idx: 0, hum: -1 }; this.rayOwners.set(owner, O); }
    if (O.frame !== V.real) { O.frame = V.real; O.idx = 0; }
    const i = O.idx++;
    let b: Ray | undefined = O.beams[i];
    // two ticks bundled into one frame: the extra events belong to the same beams (same order)
    if (!b && O.beams.length && i >= O.beams.length) {
      const c = O.beams[i % O.beams.length];
      if (Math.abs(angDiff(c.ta, a)) < 0.2) b = c;
    }
    if (!b) { b = this.newRay(owner, ev.x, ev.y, a, len, ev.el); O.beams.push(b); }
    b.ta = a; b.tlen = len; b.tres = res; b.seen = V.real;
    // the hero holds its facing on the beam (render/art/player.ts aimAt); other views ignore it
    if (i === 0) {
      const view = V.ctx.entityView(owner) as unknown as { aimAt?(x: number, y: number, res: number): void } | null;
      view?.aimAt?.(ev.x + Math.cos(a) * len, ev.y + Math.sin(a) * len, res);
    }
    // a low hum climbing to a resonant chord: one ~0.33 s note per tick, overlapping into a drone
    if (V.real - O.hum >= 0.22) {
      O.hum = V.real;
      const lv = res >= 99.5 ? 4 : Math.min(3, Math.floor(res / 25));
      V.sound(`ray_hum${lv}`, ev.x, ev.y, mine ? 0.65 : 0.25);
    }
  }

  private newRay(owner: number, x: number, y: number, a: number, len: number, el: number): Ray {
    const V = this.V, s = V.sys, T = s.T;
    const P = rayPal(el);
    const hold = (tex: Texture, c: number) => { const p = s.aAdd.hold(tex, x, y); p.tintTo(c); p.setAlpha(0); return p; };
    // fewer wave segments on a thinned-out screen or a low effects preset (the budget folds both in)
    const segs = s.budget < 0.5 ? STRAND_SEGS / 2 : STRAND_SEGS;
    const strands: Fx[] = [];
    for (let i = 0; i < segs * 2; i++) strands.push(hold(T.line, i < segs ? P.mid : lerpColor(P.mid, P.glow, 0.35)));
    const b: Ray = {
      owner, el, P, a, ta: a, len: 0, tlen: len, res: 0, tres: 0, ox: x, oy: y, seen: V.real, phase: rand(0, TAU), sparks: 0, glints: 0, segs,
      glow: hold(T.line, P.glow), mid: hold(T.line, P.mid), core: hold(T.line, P.core),
      hand: hold(T.glow, P.glow), handCore: hold(T.core, P.core), tip: hold(T.flare, P.mid), tipGlow: hold(T.glow, P.glow), strands,
    };
    const all = [b.glow, b.mid, b.core, b.hand, b.handCore, b.tip, b.tipGlow, ...strands];
    V.add({
      update: (dt) => this.updateRay(b, dt),
      kill: () => {
        for (const p of all) s.aAdd.kill(p);
        const O = this.rayOwners.get(owner);
        if (O) {
          const i = O.beams.indexOf(b);
          if (i >= 0) O.beams.splice(i, 1);
          if (!O.beams.length) this.rayOwners.delete(owner);
        }
      },
    });
    return b;
  }

  private updateRay(b: Ray, dt: number): boolean {
    const V = this.V, s = V.sys;
    const since = V.real - b.seen;
    const fade = since < 0.3 ? 1 : 1 - clamp((since - 0.3) / 0.14, 0, 1);
    if (fade <= 0) return false;
    const at = V.ctx.entityPos(b.owner);
    if (at) { b.ox = at.x; b.oy = at.y; }
    b.a += angDiff(b.a, b.ta) * clamp(dt * 16, 0, 1);
    b.len += (b.tlen - b.len) * clamp(dt * (b.len < 1 ? 40 : 14), 0, 1);
    b.res += (b.tres - b.res) * clamp(dt * 6, 0, 1);
    const r = b.res / 100, full = b.tres >= 99.5;
    const calm = preferences.get().values.reduceFlashes;
    b.phase += dt * lerp(15, 34, r);
    const pul = full ? (calm ? 0.5 : 0.5 + 0.5 * Math.sin(V.real * 13)) : 0;
    const ux = Math.cos(b.a), uy = Math.sin(b.a), nx = -uy, ny = ux;
    const sx = b.ox + ux * 16, sy = b.oy + uy * 16, Z = BEAM_Z;
    const L = Math.max(4, b.len), ex = sx + ux * L, ey = sy + uy * L;
    const mx = sx + ux * L * 0.5, my = sy + uy * L * 0.5;
    beamLine(b.glow, mx, my, Z, b.a, L, 26 + 14 * r + 16 * pul, (0.32 + 0.18 * r + 0.14 * pul) * fade);
    beamLine(b.mid, mx, my, Z, b.a, L, 10 + 3 * r, (0.66 + 0.2 * r) * fade);
    beamLine(b.core, mx, my, Z, b.a, L, 3 + 1.8 * r, 0.95 * fade);
    b.hand.place(sx, sy, Z); b.hand.setScale(34 + 20 * r + 10 * pul); b.hand.setAlpha(0.75 * fade);
    b.handCore.place(sx, sy, Z); b.handCore.setScale(12 + 6 * r); b.handCore.setAlpha(0.95 * fade);
    b.tip.place(ex, ey, Z); b.tip.rotation += dt * 2.4; b.tip.setScale(40 + 26 * r + 18 * pul); b.tip.setAlpha(0.9 * fade);
    b.tipGlow.place(ex, ey, Z); b.tipGlow.setScale(56 + 30 * r + 14 * pul); b.tipGlow.setAlpha(0.6 * fade);
    // standing wave: two strands crossing at the nodes; more half-waves (tighter ripples) as the note steadies
    const nf = lerp(3, 11, r), kw = (Math.PI * nf) / L;
    const A = (5.5 + 3.5 * r) * Math.cos(b.phase);
    const N = b.segs;
    for (let i = 0; i <= N; i++) {
      const d = (L * i) / N;
      wave[i] = A * Math.sin(kw * d) * clamp(d / 22, 0, 1) * clamp((L - d) / 34, 0, 1);
    }
    const sw = 2 + 0.8 * r, sa = (0.5 + 0.35 * r) * fade;
    for (let k = 0; k < 2; k++) {
      const sign = k ? -1 : 1;
      for (let i = 0; i < N; i++) {
        const d0 = (L * i) / N, d1 = (L * (i + 1)) / N;
        const o0 = wave[i] * sign, o1 = wave[i + 1] * sign;
        const x0 = sx + ux * d0 + nx * o0, y0 = sy + uy * d0 + ny * o0, x1 = sx + ux * d1 + nx * o1, y1 = sy + uy * d1 + ny * o1;
        const p = b.strands[k * N + i];
        const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) + 1;
        p.place((x0 + x1) / 2, (y0 + y1) / 2, Z); p.rotation = Math.atan2(dy, dx); p.setScale(l, sw / l); p.setAlpha(sa);
      }
    }
    if (dt > 0 && fade >= 1) {
      // sparks spraying off the far end; glints on the antinodes at full resonance
      b.sparks += dt * (7 + 14 * r) * s.budget;
      while (b.sparks > 1) { b.sparks -= 1; s.spark(ex, ey, Z, b.a + Math.PI + rand(-1.2, 1.2), rand(110, 240), 10, Math.random() < 0.5 ? b.P.mid : b.P.core, 0.22); }
      if (full) {
        b.glints += dt * 7 * s.budget;
        while (b.glints > 1) {
          b.glints -= 1;
          const m = Math.floor(rand(0, Math.max(1, Math.floor(nf)))), d = ((m + 0.5) * L) / nf;
          const o = A * Math.sin(kw * d) * (Math.random() < 0.5 ? 1 : -1);
          s.glint(sx + ux * d + nx * o, sy + uy * d + ny * o, Z, 13, b.P.core, 0.2, 0.85);
        }
      }
    }
    return true;
  }

  /** Refracted beam (a thinner offshoot from where the ray struck), lasting `d`. */
  private refract(x: number, y: number, a: number, len: number, d: number, el: number): void {
    const s = this.V.sys;
    const P = rayPal(el), z = BEAM_Z;
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    s.seg(s.aAdd, x, y - z, ex, ey - z, 18, P.glow, d, 0.32).fo = 0.6;
    s.seg(s.aAdd, x, y - z, ex, ey - z, 6, P.mid, d, 0.75).fo = 0.6;
    s.seg(s.aAdd, x, y - z, ex, ey - z, 2.4, P.core, d, 1).fo = 0.6;
    s.glow(x, y, z, 14, 30, P.mid, Math.min(0.2, d), 0.7);
    s.glow(ex, ey, z, 22, 36, P.glow, d, 0.5);
    for (let i = 0, n = s.n(2); i < n; i++) { const f = rand(0.15, 0.95); s.glint(x + (ex - x) * f, y + (ey - y) * f, z, 10, P.core, 0.2, 0.7); }
  }

  /** Harmonic: a bright pulse running down the beam. */
  private rayPulse(x: number, y: number, a: number, len: number, d: number, el: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const P = rayPal(el), z = BEAM_Z;
    const ux = Math.cos(a), uy = Math.sin(a);
    const x0 = x + ux * 16, y0 = y + uy * 16;
    const g = s.aAdd.hold(T.glow, x0, y0); g.tintTo(P.glow);
    const c = s.aAdd.hold(T.core, x0, y0); c.tintTo(P.core);
    const rg = s.aAdd.hold(T.ringHard, x0, y0); rg.tintTo(P.mid);
    let age = 0, acc = 0;
    V.add({
      update: (dt) => {
        age += dt;
        const t = clamp(age / d, 0, 1), dd = len * easeOut(t);
        const px = x0 + ux * dd, py = y0 + uy * dd;
        g.place(px, py, z); g.setScale(54); g.setAlpha(0.8 * (1 - t * 0.3));
        c.place(px, py, z); c.setScale(18); c.setAlpha(1);
        rg.place(px, py, z); rg.setScale(30 + 16 * Math.sin(age * 30), 0.5); rg.rotation = a + Math.PI / 2; rg.setAlpha(0.7);
        acc += dt * 40 * s.budget;
        while (acc > 1) { acc -= 1; s.spark(px, py, z, a + Math.PI + rand(-0.9, 0.9), rand(80, 180), 9, P.mid, 0.2); }
        if (t >= 1) {
          s.flash(px, py, z, 56, P.mid, 0.1, 0.8);
          s.ring(s.aAdd, T.ringHard, px, py, 4, 40, P.glow, 0.2, 0.8, z);
          return false;
        }
        return true;
      },
      kill: () => { s.aAdd.kill(g); s.aAdd.kill(c); s.aAdd.kill(rg); },
    });
    V.sound('ray_pulse', x, y, 0.5);
  }

  // ═══════════════════════════════ Rimefield ═══════════════════════════════

  /**
   * A field of rime: frost crawls outward over the ground, crystals grow along the rim as the front reaches them,
   * glints and low mist inside. `bloom` (Frost Bloom): the radius shrinks linearly to 60 over the duration.
   * f=1 (Wandering Rime): it follows its owner. Lightning (Static Frost): electrified frost, blue-white crackle.
   */
  private rimefield(ev: Aoe, bloom: boolean, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const owner = ev.s ?? -1, follow = !!ev.f, stat = ev.el === EL_LIGHT;
    const r0 = Math.max(30, ev.r), total = Math.max(0.5, ev.d / 1000);
    const main = stat ? 0xc8d6ff : RIME, hot = stat ? 0xf4f0ff : 0xe8fbff, crystal = stat ? 0xdcdcff : 0xcff2ff;
    let x = ev.x, y = ev.y;
    const patch = s.gAdd.hold(T.frostPatch, x, y); patch.tintTo(main); patch.rotation = rand(0, TAU);
    const frost = s.gNormal.hold(T.frostPatch, x, y); frost.tintTo(stat ? 0xe8ecff : 0xeef9ff); frost.rotation = rand(0, TAU);
    const crack = s.gAdd.hold(T.crack[(Math.random() * 2) | 0], x, y); crack.tintTo(hot); crack.rotation = rand(0, TAU);
    const rimSoft = s.gAdd.hold(T.ringThick, x, y); rimSoft.tintTo(main);
    const rimHard = s.gAdd.hold(T.ringHard, x, y); rimHard.tintTo(hot);
    const held: [FxLayer, Fx][] = [[s.gAdd, patch], [s.gNormal, frost], [s.gAdd, crack], [s.gAdd, rimSoft], [s.gAdd, rimHard]];
    // crystals along the rim (and a few small ones inside): ground layer, under entities
    const k = Math.max(0.5, s.budget);
    const nRim = Math.round(clamp(r0 / 8, 16, 40) * k), nBand = Math.round(nRim * 0.5), nIn = Math.round(6 * k);
    const crystals: { p: Fx; a: number; f: number; w: number; h: number; born: number }[] = [];
    const sc = clamp(r0 / 200, 0.75, 1.2);
    for (let i = 0; i < nRim + nBand + nIn; i++) {
      const band = i < nRim ? 0 : i < nRim + nBand ? 1 : 2;
      const a = band === 0 ? (i / nRim) * TAU + rand(-0.08, 0.08) : band === 1 ? ((i - nRim + 0.5) / nBand) * TAU + rand(-0.15, 0.15) : rand(0, TAU);
      const p = s.gNormal.hold(T.spike[i % 2], x, y); p.tintTo(i % 3 ? crystal : hot); p.anchorY = 0.95; p.setAlpha(0);
      const f = band === 0 ? rand(0.93, 1.03) : band === 1 ? rand(0.8, 0.9) : rand(0.25, 0.65);
      const w = band === 0 ? rand(10, 15) : band === 1 ? rand(7, 10) : rand(5, 7), h = band === 0 ? rand(20, 34) : band === 1 ? rand(12, 20) : rand(8, 12);
      crystals.push({ p, a, f, w: w * sc, h: h * sc, born: -1 });
      held.push([s.gNormal, p]);
    }
    const F: Field = { owner, x, y, r: r0, age: 0, end: total, alive: true, flourish: () => undefined };
    this.fields.push(F);
    let glints = 0, mist = 0, zaps = 0;
    F.flourish = () => {
      s.ring(s.gAdd, T.ringHard, F.x, F.y, F.r * 0.3, F.r * 1.02, hot, 0.45, 0.85);
      s.ring(s.gAdd, T.ringThick, F.x, F.y, F.r * 0.2, F.r, main, 0.5, 0.35);
      for (let i = 0, n = s.n(10); i < n; i++) { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * F.r; s.glint(F.x + Math.cos(a) * d, F.y + Math.sin(a) * d, rand(2, 14), 13, hot, rand(0.3, 0.5), 0.9); }
      V.sound('rime_chime', F.x, F.y, 0.6);
    };
    V.sound('rime_spread', x, y, mine ? 0.85 : 0.4);
    V.add({
      update: (dt) => {
        F.age += dt;
        const t = F.age;
        if (follow) { const at = V.ctx.entityPos(owner); if (at) { x = at.x; y = at.y; } }
        F.x = x; F.y = y;
        const rr = bloom ? lerp(r0, 60, clamp(t / total, 0, 1)) : r0;
        F.r = rr;
        const spread = easeOut3(clamp(t / 0.6, 0, 1)), front = rr * (0.12 + 0.88 * spread);
        const fin = clamp(t / 0.12, 0, 1), fout = clamp((F.end - t) / 0.45, 0, 1), a = Math.min(fin, fout);
        patch.place(x, y, 0); patch.setScale(front * 2.25); patch.rotation += dt * 0.03; patch.setAlpha(0.24 * a);
        frost.place(x, y, 0); frost.setScale(front * 2.15); frost.setAlpha(0.2 * a);
        crack.place(x, y, 0); crack.setScale(front * 2.05); crack.setAlpha((0.42 - 0.26 * spread) * a);
        rimSoft.place(x, y, 0); rimSoft.setScale(front * 2.18); rimSoft.setAlpha(0.15 * a);
        rimHard.place(x, y, 0); rimHard.setScale(front * 2.1); rimHard.setAlpha((0.32 + 0.08 * Math.sin(t * 3)) * a);
        for (const c of crystals) {
          if (c.born < 0 && front >= c.f * rr * 0.97) c.born = t;
          if (c.born < 0) continue;
          const g = easeOutBack(clamp((t - c.born) / 0.22, 0, 1)) * (0.4 + 0.6 * fout);
          const px = x + Math.cos(c.a) * c.f * rr, py = y + Math.sin(c.a) * c.f * rr;
          c.p.place(px, py, 0); c.p.rotation = Math.cos(c.a) * 0.3;
          c.p.setScale(Math.max(0.01, c.w * g), c.h / (c.w * 1.6)); c.p.setAlpha(0.95 * a);
        }
        if (dt > 0) {
          if (spread < 1) {
            // the frost front crackles as it crawls
            for (let i = 0, n = s.n(2); i < n; i++) { const aa = rand(0, TAU); s.glint(x + Math.cos(aa) * front, y + Math.sin(aa) * front, rand(1, 6), 11, hot, 0.3, 0.9); }
          }
          glints += dt * (rr / 26) * s.budget;
          while (glints > 1) { glints -= 1; const aa = rand(0, TAU), d = Math.sqrt(Math.random()) * rr * 0.95; s.glint(x + Math.cos(aa) * d, y + Math.sin(aa) * d, rand(1, 9), rand(8, 13), hot, rand(0.3, 0.5), 0.75 * a); }
          mist += dt * (rr / 80) * s.budget;
          while (mist > 1) { mist -= 1; const aa = rand(0, TAU), d = Math.sqrt(Math.random()) * rr * 0.8; s.dust(x + Math.cos(aa) * d, y + Math.sin(aa) * d, 30, 70, stat ? 0xe6e8ff : 0xeaf8ff, rand(1.2, 1.8), 0.16 * a, rand(-8, 8), rand(-5, 5)); }
          if (stat) {
            zaps += dt * 3 * s.budget;
            while (zaps > 1) {
              zaps -= 1;
              const aa = rand(0, TAU), d = Math.sqrt(Math.random()) * rr * 0.9, px = x + Math.cos(aa) * d, py = y + Math.sin(aa) * d;
              this.combat.zigzag(px, py - 3, rand(0, TAU), rand(16, 34), 0xe6e2ff, 0.1, 1.8);
              s.glint(px, py, 3, 12, 0xa98bff, 0.2, 0.9);
            }
          }
        }
        return t < F.end;
      },
      kill: () => {
        F.alive = false;
        const i = this.fields.indexOf(F);
        if (i >= 0) this.fields.splice(i, 1);
        for (const [l, p] of held) l.kill(p);
      },
    });
  }

  /** Ice Mirror: the owner's live field near (x, y) now has d ms left, with a small refresh flourish. */
  private rimeExtend(ev: Aoe): void {
    let best: Field | null = null, bd = Infinity;
    for (const f of this.fields) {
      if (!f.alive || f.owner !== (ev.s ?? -1)) continue;
      const d = Math.hypot(f.x - ev.x, f.y - ev.y);
      if (d < bd) { bd = d; best = f; }
    }
    if (!best || bd > 260) return;
    best.end = best.age + Math.max(0.2, ev.d / 1000);
    best.flourish();
  }

  /** Shard Burst: the field ends in a ring of ice shards. */
  private rimeBurst(x: number, y: number, r: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const exp = 0.3;
    s.flash(x, y, 12, r * 1.3, 0xeefcff, 0.14, 0.9);
    s.ring(s.gAdd, T.ringThick, x, y, r * 0.15, r * 1.04, 0x9fdcff, exp + 0.25, 0.9);
    s.ring(s.aAdd, T.ringHard, x, y, r * 0.15, r * 1.06, 0xffffff, exp + 0.12, 0.8, 3);
    for (let i = 0, n = s.n(24); i < n; i++) {
      const a = (i / 24) * TAU + rand(-0.12, 0.12), sp = (r / exp) * rand(0.75, 1.05);
      const p = s.aBody.add(T.shard[i % 3], x, y, rand(0.45, 0.7));
      p.z = rand(6, 22); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp * 0.8; p.drag = 4.5; p.gz = 220;
      p.w0 = rand(9, 15); p.w1 = 6; p.fo = 0.55; p.rotation = a + Math.PI / 2; p.vr = rand(-4, 4); p.tintTo(i % 3 ? 0xdff6ff : 0x9fd8ff);
    }
    for (let i = 0, n = s.n(10); i < n; i++) {
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * r * 0.85;
      V.after((d / r) * exp, () => {
        const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
        const p = s.aBody.add(T.spike[i % 2], px, py, rand(0.6, 0.9));
        p.anchorY = 0.95; p.w0 = rand(8, 11); p.w1 = rand(14, 22); p.se = 3; p.fi = 0.04; p.fo = 0.6; p.tintTo(0xcff2ff);
        s.glint(px, py, rand(6, 16), 12, 0xffffff, 0.3);
      });
    }
    for (let i = 0, n = s.n(4); i < n; i++) s.smoke(x + rand(-r, r) * 0.4, y, 8, r * 0.4, r, 0xdff4ff, rand(0.7, 1), 0.3, 18);
    this.combat.decal(T.frostPatch, x, y, r * 2.1, 0xbfe9ff, 0.35, 2.4, s.gAdd);
    V.shakeNear(x, y, mine ? 3 : 2, 110);
    V.sound('shatter', x, y, mine ? 1 : 0.5);
    V.sound('nova', x, y, mine ? 0.5 : 0.25);
  }

  // ═══════════════════════════════ Stormglass ═══════════════════════════════

  /** The orb shatters: glass shards bounce out, lightning forks (Hailglass: frost) and a ring of light. */
  private glassBurst(x: number, y: number, r: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const cold = el === EL_COLD;
    const glass = cold ? 0xe8fbff : 0xcfeeff, light = cold ? 0x9fdcff : GLASS;
    const z = 30;
    s.flash(x, y, z, r * 1.5, 0xeaf8ff, 0.12, 1);
    s.glow(x, y, z, r * 0.5, r * 1.4, light, 0.3, 0.6);
    s.ring(s.gAdd, T.ringHard, x, y, r * 0.1, r * 1.04, light, 0.32, 0.85);
    s.ring(s.gAdd, T.ring, x, y, r * 0.1, r * 0.95, glass, 0.4, 0.4);
    s.ring(s.aAdd, T.ringHard, x, y, 6, r * 0.6, 0xffffff, 0.2, 0.7, z);
    for (let i = 0, n = s.n(22); i < n; i++) {
      const a = rand(0, TAU), sp = rand(120, 300) * Math.max(0.8, r / 140);
      const p = s.chunk(x, y, z, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(120, 280), rand(6, 12), i % 3 ? glass : light, rand(0.9, 1.4), T.shard[i % 3]);
      p.bounce = 0.32;
    }
    if (cold) {
      for (let i = 0, n = s.n(5); i < n; i++) s.smoke(x + rand(-r, r) * 0.35, y, z * 0.5, r * 0.3, r * 0.8, 0xdff4ff, rand(0.7, 1), 0.3, 18);
      for (let i = 0, n = s.n(8); i < n; i++) { const f = s.aAdd.add(T.flake, x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.4, rand(0.8, 1.2)); f.z = rand(10, 50); f.vz = -12; f.w0 = rand(8, 12); f.w1 = 5; f.vr = rand(-2, 2); f.fi = 0.15; f.fo = 0.5; f.tintTo(0xe8fbff); }
      this.combat.decal(T.frostPatch, x, y, r * 1.6, 0xbfe9ff, 0.35, 2.2, s.gAdd);
    } else {
      for (let i = 0; i < 7; i++) this.combat.zigzag(x, y - z, (i / 7) * TAU + rand(-0.3, 0.3), r * rand(0.45, 0.8), 0xe6f4ff, 0.2, 2.4);
      for (let i = 0, n = s.n(12); i < n; i++) s.spark(x, y, z, rand(0, TAU), rand(200, 400), 13, i % 2 ? 0xffffff : light, 0.3, 300);
      this.combat.decal(T.scorch[0], x, y, r * 0.9, 0x000000, 0.18, 2);
    }
    for (let i = 0, n = s.n(6); i < n; i++) s.glint(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.4, rand(4, 30), rand(14, 20), 0xffffff, rand(0.3, 0.5));
    V.shakeNear(x, y, mine ? 4 : 2.5, 130);
    V.sound('glass_shatter', x, y, mine ? 1 : 0.55);
  }

  /** Shattered Charge: a shard of stormglass lying on the ground, faintly crackling. */
  private glassShard(x: number, y: number, d: number, el: number): void {
    const V = this.V, s = V.sys, T = s.T;
    const cold = el === EL_COLD;
    const shard = s.gNormal.hold(T.shard[(Math.random() * 3) | 0], x, y); shard.tintTo(cold ? 0xeefcff : 0xd8f2ff); shard.rotation = rand(0, TAU);
    const glow = s.gAdd.hold(T.glow, x, y); glow.tintTo(cold ? 0x9fdcff : GLASS);
    const w = rand(17, 22);
    let age = 0, crack = rand(0.2, 0.6);
    s.glint(x, y, 6, 16, 0xffffff, 0.25);
    V.add({
      update: (dt) => {
        age += dt;
        const a = Math.min(clamp(age / 0.15, 0, 1), clamp((d - age) / 0.4, 0, 1));
        shard.place(x, y, 0); shard.setScale(w, 0.62); shard.setAlpha(0.95 * a);
        glow.place(x, y, 2); glow.setScale(38, 0.6); glow.setAlpha((0.16 + 0.1 * Math.abs(Math.sin(age * 5 + x))) * a);
        crack -= dt;
        if (crack <= 0 && dt > 0) {
          crack = rand(0.5, 1.3) / Math.max(0.4, s.budget);
          this.combat.zigzag(x + rand(-5, 5), y - 3, rand(-Math.PI, 0), rand(10, 20), cold ? 0xf2fdff : 0xd8f4ff, 0.08, 1.5);
          if (Math.random() < 0.5) s.glint(x, y, rand(2, 7), 10, 0xffffff, 0.22, 0.85);
        }
        return age < d;
      },
      kill: () => { s.gNormal.kill(shard); s.gAdd.kill(glow); },
    });
  }

  // ═══════════════════════════════ Cinderkin ═══════════════════════════════

  /** A kin bursts: a pop of embers, flame tongues and coal bits (Frostkin: a frost puff and ice chips). */
  private kinBurst(x: number, y: number, r: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const cold = el === EL_COLD;
    const k = clamp(r / 80, 0.7, 2.1);
    const main = cold ? 0x9fdcff : 0xff8a3d, hot = cold ? 0xf2fdff : 0xffd890;
    const z = 12;
    s.flash(x, y, z, r * 1.5, hot, 0.1, 0.9);
    s.ring(s.gAdd, T.ringHard, x, y, r * 0.15, r * 1.04, main, 0.3, 0.8);
    s.ring(s.gAdd, T.ringThick, x, y, r * 0.1, r * 0.95, cold ? 0x7fd8ff : 0xff6a1a, 0.36, 0.35);
    if (cold) {
      for (let i = 0, n = s.n(5 * k); i < n; i++) s.smoke(x + rand(-r, r) * 0.3, y, z, r * 0.3, r * 0.8, 0xe2f6ff, rand(0.6, 0.9), 0.34, 26);
      for (let i = 0, n = s.n(10 * k); i < n; i++) {
        const a = rand(0, TAU), sp = rand(100, 240) * Math.min(1.5, k);
        const p = s.chunk(x, y, z, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(140, 280), rand(5, 9), i % 3 ? 0xdff6ff : 0x9fd8ff, rand(0.7, 1), T.shard[i % 3]);
        p.bounce = 0.25;
      }
      for (let i = 0, n = s.n(6 * k); i < n; i++) s.glint(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.4, rand(4, 24), 12, hot, rand(0.3, 0.5));
      this.combat.decal(T.frostPatch, x, y, r * 1.8, 0xbfe9ff, 0.35, 2.2, s.gAdd);
    } else {
      for (let i = 0, n = s.n(8 * k); i < n; i++) {
        const a = (i / 8) * TAU + rand(-0.3, 0.3), sp = rand(80, 170) * Math.min(1.5, k);
        const f = s.aAdd.add(T.flame, x + Math.cos(a) * 6, y + Math.sin(a) * 4, rand(0.3, 0.45));
        f.anchorY = 0.8; f.z = rand(2, 10); f.vx = Math.cos(a) * sp; f.vy = Math.sin(a) * sp * 0.55; f.vz = rand(50, 120); f.drag = 3.5;
        f.w0 = rand(16, 24) * Math.min(1.4, k); f.w1 = 4; f.k = 1.5; f.fo = 0.3; f.flick = 0.2; f.a0 = 0.85; f.tintFade(hot, main);
      }
      for (let i = 0, n = s.n(14 * k); i < n; i++) s.ember(x + rand(-r, r) * 0.4, y + rand(-r, r) * 0.25, rand(4, 20), i % 3 ? main : hot, rand(0.6, 1.1), rand(3.5, 5.5), 120);
      for (let i = 0, n = s.n(8 * k); i < n; i++) s.spark(x, y, z, rand(0, TAU), rand(160, 320) * Math.min(1.4, k), 12, i % 2 ? hot : main, 0.3, 500);
      for (let i = 0, n = s.n(5 * k); i < n; i++) { const a = rand(0, TAU), sp = rand(60, 160); s.chunk(x, y, z, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(180, 320), rand(4, 7), i % 2 ? 0x2a1c16 : 0xff8a3d, rand(0.6, 0.9)); }
      s.smoke(x, y, z, r * 0.3, r * 0.8, 0x4e423b, 0.9, 0.3, 40);
      this.combat.decal(T.scorch[(Math.random() * 2) | 0], x, y, r * 1.3, 0x000000, 0.26, 3);
    }
    if (k > 1.4) V.shakeNear(x, y, mine ? 4 : 2.5, 140);
    V.sound('kin_pop', x, y, (mine ? 0.9 : 0.45) * (k > 1.4 ? 1.2 : 1));
  }

  /** Hearth Bond: a warm beckoning ring, ripples drawing inward to the kin, for `d`. */
  private kinTaunt(x: number, y: number, r: number, d: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const warm = 0xffb060;
    const ring = s.gAdd.hold(T.ring, x, y); ring.tintTo(warm);
    const pool = s.gAdd.hold(T.glow, x, y); pool.tintTo(0xff8a3d);
    let age = 0, next = 0, motes = 0;
    V.add({
      update: (dt) => {
        age += dt;
        const a = Math.min(clamp(age / 0.15, 0, 1), clamp((d - age) / 0.3, 0, 1));
        ring.place(x, y, 0); ring.setScale(r * 2.2); ring.setAlpha(0.3 * a);
        pool.place(x, y, 0); pool.setScale(r * 1.7); pool.setAlpha((0.12 + 0.04 * Math.sin(age * 6)) * a);
        if (age >= next && age < d - 0.2) { next = age + 0.32; s.ring(s.gAdd, T.ringHard, x, y, r, r * 0.25, warm, 0.5, 0.55); }
        motes += dt * 10 * s.budget;
        while (motes > 1 && dt > 0) {
          motes -= 1;
          const aa = rand(0, TAU), rr = r * rand(0.85, 1.05);
          const m = s.aAdd.add(T.dot, x + Math.cos(aa) * rr, y + Math.sin(aa) * rr, 0.5);
          m.z = rand(2, 14); m.vx = (-Math.cos(aa) * rr) / 0.5; m.vy = (-Math.sin(aa) * rr) / 0.5; m.w0 = 5; m.w1 = 2; m.fo = 0.5; m.tintFade(0xffe0a0, warm);
        }
        return age < d;
      },
      kill: () => { s.gAdd.kill(ring); s.gAdd.kill(pool); },
    });
    V.sound('kin_pip', x, y, mine ? 0.7 : 0.35);
  }

  // ═══════════════════════════════ Orrery ═══════════════════════════════

  /**
   * n brass-and-light planets on thin rings orbiting the owner at world radius r (a true world circle: the server hits
   * there), drawn at chest height above that ground point, with star-dust trails. Sphere i's angle at t seconds:
   * a + 2π·t / period + i·2π / n, period MAGE_FX.orreryPeriodMs (÷ orreryWideSlow for `orrery_wide`). Uses the real
   * clock so the spheres stay on the server's phase through our own hit-stops. Frozen Moons (cold): icy moons.
   */
  private orrery(ev: Aoe, wide: boolean, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const owner = ev.s ?? -1;
    const n = clamp(Math.round(ev.n ?? 5), 1, 12);
    const R = Math.max(30, ev.r), d = Math.max(0.5, ev.d / 1000);
    const period = (wide ? MAGE_FX.orreryPeriodMs / MAGE_FX.orreryWideSlow : MAGE_FX.orreryPeriodMs) / 1000;
    const a0 = ev.a ?? 0, start = V.real;
    const cold = ev.el === EL_COLD;
    const tint = cold ? 0xd8f4ff : BRASS, glowC = cold ? 0x9fdcff : 0xffd98a, dust = cold ? 0xeefcff : 0xfff0c8, ringC = cold ? 0xbfe9ff : 0xe8c878;
    let x = ev.x, y = ev.y;
    const orbit = s.gAdd.hold(T.ringHard, x, y); orbit.tintTo(ringC);
    const orbitSoft = s.gAdd.hold(T.ring, x, y); orbitSoft.tintTo(ringC);
    const path = s.aAdd.hold(T.ringHard, x, y); path.tintTo(ringC);
    const held: [FxLayer, Fx][] = [[s.gAdd, orbit], [s.gAdd, orbitSoft], [s.aAdd, path]];
    const sp: { shadow: Fx; glow: Fx; ring: Fx; body: Fx; lx: number; ly: number; acc: number }[] = [];
    for (let i = 0; i < n; i++) {
      const shadow = s.gNormal.hold(T.shadow, x, y); shadow.tintTo(0x000000);
      const glow = s.aAdd.hold(T.glow, x, y); glow.tintTo(glowC);
      const ring = s.aAdd.hold(T.ringHard, x, y); ring.tintTo(cold ? 0xe8fbff : 0xffe6a8); ring.rotation = -0.38;
      const body = s.aBody.hold(T.planet, x, y); body.tintTo(i % 2 ? tint : lerpColor(tint, 0xffffff, 0.18));
      held.push([s.gNormal, shadow], [s.aAdd, glow], [s.aAdd, ring], [s.aBody, body]);
      sp.push({ shadow, glow, ring, body, lx: NaN, ly: NaN, acc: 0 });
    }
    const O: Orrery = { owner, n, pts: new Float32Array(n * 2), alive: true };
    this.orreries.push(O);
    let tick = 0.25, pad = 0;
    V.add({
      update: (dt) => {
        const t = V.real - start;
        if (t >= d) return false;
        const at = V.ctx.entityPos(owner);
        if (at) { x = at.x; y = at.y; }
        const unfold = easeOut3(clamp(t / 0.45, 0, 1)), fout = clamp((d - t) / 0.3, 0, 1);
        const rr = R * (0.15 + 0.85 * unfold), vis = Math.min(unfold * 1.6, 1) * fout;
        orbit.place(x, y, 0); orbit.setScale(rr * 2.1); orbit.setAlpha(0.26 * vis);
        orbitSoft.place(x, y, 0); orbitSoft.setScale(rr * 2.2); orbitSoft.setAlpha(0.1 * vis);
        path.place(x, y, SPHERE_Z); path.setScale(rr * 2.1); path.setAlpha(0.13 * vis);
        const scale = easeOutBack(clamp(t / 0.4, 0, 1)) * (0.4 + 0.6 * fout);
        for (let i = 0; i < n; i++) {
          const S = sp[i];
          const ang = a0 + (TAU * t) / period + (i * TAU) / n;
          const gx = x + Math.cos(ang) * rr, gy = y + Math.sin(ang) * rr, z = SPHERE_Z + 2.5 * Math.sin(t * 2.2 + i * 1.3);
          O.pts[i * 2] = gx; O.pts[i * 2 + 1] = gy;
          S.shadow.place(gx, gy, 0); S.shadow.setScale(18 * scale, 0.5); S.shadow.setAlpha(0.3 * vis);
          S.glow.place(gx, gy, z); S.glow.setScale(50 * scale * (1 + 0.06 * Math.sin(t * 5 + i))); S.glow.setAlpha(0.45 * vis);
          S.ring.place(gx, gy, z); S.ring.setScale(37 * scale, 0.34); S.ring.setAlpha(0.65 * vis);
          S.body.place(gx, gy, z); S.body.setScale(23 * scale); S.body.setAlpha(vis);
          // star dust along the orbit
          if (!Number.isNaN(S.lx) && dt > 0) {
            S.acc += Math.hypot(gx - S.lx, gy - S.ly);
            const every = 13 / Math.max(0.3, s.budget);
            while (S.acc >= every) {
              S.acc -= every;
              const f = s.aAdd.add(Math.random() < 0.25 ? T.star4 : T.dot, gx + rand(-3, 3), gy + rand(-2, 2), rand(0.35, 0.6));
              f.z = z + rand(-3, 3); f.vx = rand(-8, 8); f.vy = rand(-5, 5); f.vz = rand(-6, 6); f.w0 = rand(4, 7); f.w1 = 1; f.fo = 0.2; f.vr = 2; f.a0 = 0.85 * vis;
              f.tintFade(dust, ringC);
            }
          }
          S.lx = gx; S.ly = gy;
        }
        // slow mechanical ticking under a choir pad
        tick -= dt; pad -= dt;
        if (tick <= 0) { tick = 0.5; V.sound('orrery_tick', x, y, mine ? 0.5 : 0.18); }
        if (pad <= 0 && t < d - 1) { pad = 2.2; V.sound('orrery_pad', x, y, mine ? 0.55 : 0.2); }
        return true;
      },
      kill: () => {
        O.alive = false;
        const i = this.orreries.indexOf(O);
        if (i >= 0) this.orreries.splice(i, 1);
        for (const [l, p] of held) l.kill(p);
      },
    });
  }

  /** Sun at Centre: a small sun hovering over the owner and a ring of heat on the ground (radius r). */
  private orrerySun(owner: number, x0: number, y0: number, r: number, d: number): void {
    const V = this.V, s = V.sys, T = s.T;
    let x = x0, y = y0, h = 60;
    const pool = s.gAdd.hold(T.glow, x, y); pool.tintTo(0xff7a1a);
    const rim = s.gAdd.hold(T.ringHard, x, y); rim.tintTo(0xffa040);
    const corona = s.aAdd.hold(T.glow, x, y); corona.tintTo(0xffa040);
    const flare = s.aAdd.hold(T.flare, x, y); flare.tintTo(0xffd890);
    const halo = s.aAdd.hold(T.ring, x, y); halo.tintTo(0xffc060);
    const sun = s.aAdd.hold(T.core, x, y); sun.tintTo(0xfff2c8);
    const held: [FxLayer, Fx][] = [[s.gAdd, pool], [s.gAdd, rim], [s.aAdd, corona], [s.aAdd, flare], [s.aAdd, halo], [s.aAdd, sun]];
    let age = 0, embers = 0, licks = 0;
    V.add({
      update: (dt) => {
        age += dt;
        const b = V.body(owner);
        if (b) { x = b.x; y = b.y; h = b.h; }
        const a = Math.min(easeOut(clamp(age / 0.3, 0, 1)), clamp((d - age) / 0.35, 0, 1));
        const z = h + 42, beat = preferences.get().values.reduceFlashes ? 1 : 1 + 0.06 * Math.sin(age * 7);
        pool.place(x, y, 0); pool.setScale(r * 2.4); pool.setAlpha(0.15 * a);
        rim.place(x, y, 0); rim.setScale(r * 2.1); rim.setAlpha((0.3 + 0.08 * Math.sin(age * 4)) * a);
        corona.place(x, y, z); corona.setScale(64 * beat); corona.setAlpha(0.72 * a);
        flare.place(x, y, z); flare.setScale(46 * beat); flare.rotation += dt * 0.8; flare.setAlpha(0.8 * a);
        halo.place(x, y, z); halo.setScale(34); halo.setAlpha(0.45 * a);
        sun.place(x, y, z); sun.setScale(20 * beat); sun.setAlpha(a);
        if (dt > 0) {
          embers += dt * 6 * s.budget;
          while (embers > 1) { embers -= 1; s.ember(x + rand(-8, 8), y, z + rand(-8, 4), Math.random() < 0.5 ? 0xffa040 : 0xffd890, rand(0.5, 0.8), 3.5, 30); }
          licks += dt * 5 * s.budget;
          while (licks > 1) {
            licks -= 1;
            const aa = rand(0, TAU), dd = r * rand(0.35, 0.95);
            const f = s.aAdd.add(T.flame, x + Math.cos(aa) * dd, y + Math.sin(aa) * dd, rand(0.3, 0.45));
            f.anchorY = 0.85; f.vz = rand(30, 60); f.w0 = rand(10, 15); f.w1 = 3; f.k = 1.5; f.fo = 0.3; f.a0 = 0.6 * a; f.tintFade(0xffd890, 0xff6a1a);
          }
        }
        return age < d;
      },
      kill: () => { for (const [l, p] of held) l.kill(p); },
    });
  }

  /** Eclipse: the spheres align, a dark disc with a gold corona, and a beam fires outward along a. */
  private eclipse(x: number, y: number, a: number, len: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const cold = el === EL_COLD;
    const glow = cold ? 0x7fd8ff : 0xffc860, mid = cold ? 0xd8f4ff : 0xffe6a8, core = 0xffffff;
    const ux = Math.cos(a), uy = Math.sin(a), z = SPHERE_Z;
    const sx = x + ux * 22, sy = y + uy * 22;
    const disc = s.aBody.hold(T.holeDark, sx, sy);
    const corona = s.aAdd.hold(T.ring, sx, sy); corona.tintTo(glow);
    const beams = [s.aAdd.hold(T.line, sx, sy), s.aAdd.hold(T.line, sx, sy), s.aAdd.hold(T.line, sx, sy)];
    beams[0].tintTo(glow); beams[1].tintTo(mid); beams[2].tintTo(core);
    const tip = s.aAdd.hold(T.flare, sx, sy); tip.tintTo(mid);
    const ex = sx + ux * len, ey = sy + uy * len, mx = (sx + ex) / 2, my = (sy + ey) / 2;
    const dur = 0.5;
    let age = 0;
    for (let i = 0, n = s.n(16); i < n; i++) {
      const f = rand(0.05, 1), px = sx + ux * len * f, py = sy + uy * len * f;
      V.after(f * 0.08, () => s.spark(px, py, z, a + (Math.random() < 0.5 ? 1 : -1) * rand(1.2, 1.9), rand(80, 200), 11, i % 2 ? mid : glow, 0.3));
    }
    s.flash(sx, sy, z, 70, mid, 0.14, 0.8);
    V.add({
      update: (dt) => {
        age += dt;
        const t = clamp(age / dur, 0, 1);
        const w = easeOut(clamp(age / 0.06, 0, 1)) * (1 - t * t) + 0.0001;
        for (let i = 0; i < 3; i++) beamLine(beams[i], mx, my, z, a, len, Math.max(0.5, BEAM_W[i] * w), BEAM_A[i] * (1 - t * 0.3));
        disc.place(sx, sy, z); disc.setScale(26 * (1 - t * 0.4)); disc.setAlpha(1 - t);
        corona.place(sx, sy, z); corona.setScale(40 + 10 * t); corona.setAlpha(0.9 * (1 - t));
        tip.place(ex, ey, z); tip.rotation += dt * 4; tip.setScale(56 * w + 10); tip.setAlpha(0.9 * (1 - t));
        return age < dur;
      },
      kill: () => { s.aBody.kill(disc); s.aAdd.kill(corona); s.aAdd.kill(tip); for (const p of beams) s.aAdd.kill(p); },
    });
    V.shakeNear(x, y, mine ? 2.5 : 1.5, 120);
    V.sound('eclipse', x, y, mine ? 0.9 : 0.45);
  }

  // ═══════════════════════════════ rune / node / set visuals ═══════════════════════════════

  /** Frost Nova · Cold Front: the nova as a 120° wave toward a. */
  private novaCone(x: number, y: number, r: number, a: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    void el;
    const exp = 0.28, half = Math.PI / 3;
    const ux = Math.cos(a), uy = Math.sin(a);
    s.flash(x + ux * 24, y + uy * 16, 20, r * 0.9, 0xe8fbff, 0.14, 0.9);
    for (let i = 0, n = s.n(30); i < n; i++) {
      const aa = a + ((i + rand(0.1, 0.9)) / 30 - 0.5) * 2 * half, sp = (r / exp) * rand(0.8, 1.05);
      const p = s.aBody.add(T.shard[i % 3], x, y, rand(0.45, 0.7));
      p.z = rand(6, 24); p.vx = Math.cos(aa) * sp; p.vy = Math.sin(aa) * sp * 0.8; p.drag = 4.5; p.gz = 220;
      p.w0 = rand(9, 15); p.w1 = 6; p.fo = 0.55; p.rotation = aa + Math.PI / 2; p.vr = rand(-4, 4); p.tintTo(i % 3 ? 0xdff6ff : 0x9fd8ff);
    }
    // the cold front itself: a fan of freezing mist rolling out to the reach
    for (let i = 0, n = s.n(22); i < n; i++) {
      const aa = a + rand(-half, half) * (0.6 + 0.4 * Math.random()), sp = (r / 0.336) * rand(0.6, 1);
      const m = s.aAdd.add(T.glow, x + ux * 14, y + uy * 10, rand(0.45, 0.6));
      m.z = 16; m.vx = Math.cos(aa) * sp; m.vy = Math.sin(aa) * sp; m.drag = 1.7; m.w0 = 24; m.w1 = rand(60, 90); m.se = 1; m.a0 = 0.3; m.fo = 0.35;
      m.tintFade(0xe8fbff, 0x7fd8ff);
    }
    const spikes = Math.round(clamp(r / 12, 8, 18) * s.budget);
    for (let i = 0; i < spikes; i++) {
      const aa = a + ((i + 0.5) / spikes - 0.5) * 2 * half + rand(-0.06, 0.06), rr = r * rand(0.8, 1);
      V.after(exp * (rr / r), () => {
        const sx = x + Math.cos(aa) * rr, sy = y + Math.sin(aa) * rr;
        const p = s.aBody.add(T.spike[i % 2], sx, sy, rand(0.9, 1.3));
        p.anchorY = 0.95; p.w0 = rand(10, 14); p.w1 = rand(20, 28); p.se = 3; p.fi = 0.04; p.fo = 0.7; p.tintTo(0xcff2ff);
        s.glint(sx, sy, rand(8, 20), 12, 0xffffff, 0.3);
      });
    }
    for (const f of [0.35, 0.62, 0.88]) {
      const d = r * f;
      V.after(0.06 + f * 0.2, () => this.combat.decal(T.frostPatch, x + ux * d, y + uy * d, r * f * 0.95, 0xbfe9ff, 0.32, 2.4, s.gAdd));
    }
    V.shakeNear(x, y, mine ? 3 : 2, 110);
    V.sound('nova', x, y, mine ? 1 : 0.5);
  }

  /** Meteor · Lodestone: an inward-pulling swirl at the impact point before the rock lands. */
  private lodestone(x: number, y: number, r: number, d: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const cold = el === EL_COLD;
    const main = cold ? 0x7fd8ff : 0xff8a3d, hot = cold ? 0xe8fbff : 0xffd890;
    const swirl = s.gAdd.hold(T.swirl, x, y); swirl.tintTo(main);
    const rim = s.gAdd.hold(T.ringHard, x, y); rim.tintTo(hot);
    const N = Math.round(18 * Math.max(0.4, s.budget));
    const motes: { p: Fx; a: number; rr: number; sp: number }[] = [];
    for (let i = 0; i < N; i++) { const p = s.aAdd.hold(i % 4 ? T.dot : T.star4, x, y); p.tintTo(i % 3 ? main : hot); motes.push({ p, a: rand(0, TAU), rr: rand(0.3, 1.1) * r, sp: rand(0.7, 1.3) }); }
    let age = 0, next = 0, dust = 0;
    V.add({
      update: (dt) => {
        age += dt;
        const open = easeOut(clamp(age / 0.2, 0, 1)), a = Math.min(open, clamp((d - age) / 0.15, 0, 1));
        swirl.place(x, y, 0); swirl.setScale(r * 2.2 * (0.6 + 0.4 * open)); swirl.rotation -= dt * 4.5; swirl.setAlpha(0.5 * a);
        rim.place(x, y, 0); rim.setScale(r * 2.1); rim.setAlpha(0.4 * a);
        for (const m of motes) {
          m.rr -= dt * (60 + (r - m.rr) * 1.4) * m.sp;
          m.a -= dt * (1.8 + 90 / Math.max(14, m.rr)) * m.sp;
          if (m.rr < 8) { m.rr = r * rand(0.9, 1.1); m.a = rand(0, TAU); }
          m.p.place(x + Math.cos(m.a) * m.rr, y + Math.sin(m.a) * m.rr, 3);
          m.p.setScale(3 + (m.rr / r) * 5); m.p.setAlpha(a * clamp((m.rr - 8) / 30, 0, 1));
        }
        if (age >= next && age < d - 0.1) { next = age + 0.22; s.ring(s.gAdd, T.ringHard, x, y, r, r * 0.15, hot, 0.3, 0.5); }
        dust += dt * 12 * s.budget;
        while (dust > 1 && dt > 0) { dust -= 1; const aa = rand(0, TAU); s.dust(x + Math.cos(aa) * r, y + Math.sin(aa) * r, 14, 30, cold ? 0xdff4ff : 0xa8946f, rand(0.4, 0.6), 0.32 * a, -Math.cos(aa) * r * 3, -Math.sin(aa) * r * 3); }
        return age < d;
      },
      kill: () => { s.gAdd.kill(swirl); s.gAdd.kill(rim); for (const m of motes) s.aAdd.kill(m.p); },
    });
    V.sound('lodestone', x, y, mine ? 0.8 : 0.4);
  }

  /** Regalia of the Fallen Star 6: a star-marked crater, arcane and gold, drawing light inward. */
  private starCrater(x: number, y: number, r: number, d: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const gold = 0xffe08a, arc = 0xc39bff;
    s.flash(x, y, 12, r * 1.8, 0xfff0c0, 0.14, 0.9);
    s.ring(s.gAdd, T.ringThick, x, y, r * 0.2, r * 1.1, gold, 0.4, 0.75);
    for (let i = 0, n = s.n(10); i < n; i++) { const a = (i / 10) * TAU + rand(-0.2, 0.2); s.dust(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.2, r * 0.3, r * 0.7, 0x9a8a74, rand(0.6, 0.9), 0.42, Math.cos(a) * r * 2.6, Math.sin(a) * r * 2); }
    for (let i = 0, n = s.n(8); i < n; i++) { const a = rand(0, TAU), sp = rand(80, 200); s.chunk(x, y, 8, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(200, 380), rand(5, 9), i % 3 ? 0x3b302b : gold, rand(0.8, 1.2)); }
    const crater = s.gNormal.hold(T.scorch[0], x, y); crater.tintTo(0x000000); crater.rotation = rand(0, TAU);
    const glowC = s.gAdd.hold(T.crack[1], x, y); glowC.tintTo(gold); glowC.rotation = rand(0, TAU);
    const star = s.gAdd.hold(T.star4, x, y); star.tintTo(0xffc860);
    const star2 = s.gAdd.hold(T.star4, x, y); star2.tintTo(arc); star2.rotation = Math.PI / 4;
    const rim = s.gAdd.hold(T.ringHard, x, y); rim.tintTo(arc);
    const core = s.aAdd.hold(T.glow, x, y); core.tintTo(0xffe8a0);
    const held: [FxLayer, Fx][] = [[s.gNormal, crater], [s.gAdd, glowC], [s.gAdd, star], [s.gAdd, star2], [s.gAdd, rim], [s.aAdd, core]];
    let age = 0, motes = 0;
    V.add({
      update: (dt) => {
        age += dt;
        const a = Math.min(clamp(age / 0.1, 0, 1), clamp((d - age) / 0.35, 0, 1));
        const beat = 0.85 + 0.15 * Math.sin(age * 6);
        crater.place(x, y, 0); crater.setScale(r * 2.1, 0.8); crater.setAlpha(0.55 * a);
        glowC.place(x, y, 0); glowC.setScale(r * 1.8); glowC.setAlpha(0.7 * a * (1 - 0.5 * clamp(age / d, 0, 1)));
        star.place(x, y, 0); star.setScale(r * 1.5 * beat); star.rotation += dt * 0.4; star.setAlpha(0.45 * a);
        star2.place(x, y, 0); star2.setScale(r * 1.0 * beat); star2.rotation -= dt * 0.6; star2.setAlpha(0.45 * a);
        rim.place(x, y, 0); rim.setScale(r * 2.1); rim.setAlpha(0.42 * a);
        core.place(x, y, 4); core.setScale(r * 0.8 * beat); core.setAlpha(0.3 * a);
        motes += dt * 14 * s.budget;
        while (motes > 1 && dt > 0) {
          motes -= 1;
          const aa = rand(0, TAU), rr = r * rand(0.9, 1.15);
          const m = s.aAdd.add(Math.random() < 0.3 ? T.star4 : T.dot, x + Math.cos(aa) * rr, y + Math.sin(aa) * rr, 0.45);
          m.z = rand(2, 10); m.vx = (-Math.cos(aa) * rr) / 0.45; m.vy = (-Math.sin(aa) * rr) / 0.45; m.w0 = 6; m.w1 = 2; m.fo = 0.4; m.vr = 3; m.tintFade(arc, gold);
        }
        return age < d;
      },
      kill: () => { for (const [l, p] of held) l.kill(p); },
    });
    V.shakeNear(x, y, mine ? 3 : 2, 120);
    V.sound('star_crater', x, y, mine ? 0.8 : 0.4);
  }

  /** Lantern Garden 4: a glowing paper-and-brass lantern on the ground with a soft pool of light (radius r). */
  private lantern(x: number, y: number, r: number, d: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const body = s.gNormal.hold(T.lantern, x, y); body.anchorY = 0.97; body.tintTo(0xffffff);
    const lit = s.gAdd.hold(T.glow, x, y); lit.tintTo(0xffb050);
    const pool = s.gAdd.hold(T.glow, x, y); pool.tintTo(0xffa040);
    const ring = s.gAdd.hold(T.ring, x, y); ring.tintTo(0xffc070);
    s.flash(x, y, 16, 60, 0xffe0a0, 0.12, 0.6);
    for (let i = 0, n = s.n(6); i < n; i++) { const a = (i / 6) * TAU; s.dust(x + Math.cos(a) * 6, y + Math.sin(a) * 4, 12, 28, 0xb8a990, 0.5, 0.3, Math.cos(a) * 80, Math.sin(a) * 50); }
    let age = 0, flies = 0;
    const ph = rand(0, TAU);
    V.add({
      update: (dt) => {
        age += dt;
        const a = Math.min(clamp(age / 0.2, 0, 1), clamp((d - age) / 0.4, 0, 1));
        const pop = easeOutBack(clamp(age / 0.28, 0, 1));
        const fl = preferences.get().values.reduceFlashes ? 0 : 0.12 * Math.sin(age * 9 + ph) + 0.06 * Math.sin(age * 23 + ph);
        body.place(x, y + 2, 0); body.setScale(24 * pop); body.setAlpha(a);
        lit.place(x, y + 2, 17 * pop); lit.setScale(48 * (1 + fl * 0.5)); lit.setAlpha((0.55 + fl) * a);
        pool.place(x, y, 0); pool.setScale(r * 1.6 * (0.96 + fl * 0.2)); pool.setAlpha((0.13 + fl * 0.2) * a);
        ring.place(x, y, 0); ring.setScale(r * 2.2); ring.setAlpha(0.07 * a);
        flies += dt * 2.2 * s.budget;
        while (flies > 1 && dt > 0) { flies -= 1; const aa = rand(0, TAU), dd = rand(10, r * 0.5); s.ember(x + Math.cos(aa) * dd, y + Math.sin(aa) * dd, rand(4, 30), 0xffd070, rand(1, 1.6), 3.5, 16); }
        return age < d;
      },
      kill: () => { s.gNormal.kill(body); s.gAdd.kill(lit); s.gAdd.kill(pool); s.gAdd.kill(ring); },
    });
    V.sound('lantern', x, y, mine ? 0.6 : 0.3);
  }

  /** Hydra · Last Breath: a cone of fire (or the hydra's element) from the head toward a, out to r. */
  private hydraBreath(x: number, y: number, r: number, a: number, el: number, mine: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const cold = el === EL_COLD;
    const P = pal(el === EL_PHYS ? EL_FIRE : el);
    const hot = P.hot, main = P.main, deep = el === EL_FIRE || el === EL_PHYS ? 0xb8300a : lerpColor(P.main, 0x000000, 0.4);
    const ux = Math.cos(a), uy = Math.sin(a);
    const mx = x + ux * 12, my = y + uy * 8, mz = 40;
    s.flash(mx, my, mz, 60, hot, 0.12, 0.8);
    const dur = 0.42, reach = r / 0.336;
    let age = 0, acc = 0;
    V.add({
      update: (dt) => {
        age += dt;
        acc += dt * 110 * s.budget;
        while (acc > 1 && age < dur) {
          acc -= 1;
          const ang = a + rand(-0.5, 0.5) * (0.55 + 0.45 * Math.random()), sp = reach * rand(0.55, 1);
          const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
          if (cold) {
            const m = s.aAdd.add(T.glow, mx, my, rand(0.45, 0.6));
            m.z = mz; m.vx = vx; m.vy = vy; m.vz = rand(-40, -10); m.drag = 1.7; m.w0 = 20; m.w1 = rand(55, 80); m.se = 1; m.a0 = 0.32; m.fo = 0.35; m.tintFade(hot, main);
          } else {
            const f = s.aAdd.add(T.flame, mx, my, rand(0.38, 0.55));
            f.z = mz + rand(-4, 4); f.vx = vx; f.vy = vy; f.vz = rand(-60, -10); f.drag = 1.7;
            f.anchorY = 0.6; f.w0 = rand(12, 16); f.w1 = rand(24, 36); f.k = 1.5; f.se = 1; f.fo = 0.4; f.flick = 0.15; f.a0 = 0.8;
            f.rotation = Math.atan2(vy, vx) + Math.PI / 2; f.tintFade(lerpColor(hot, main, 0.6), deep);
          }
          if (Math.random() < 0.2) s.ember(mx + ux * rand(20, 80), my + uy * rand(20, 80), mz * 0.6, cold ? 0xcfefff : main, rand(0.5, 0.9), 4, 40);
        }
        return age < dur;
      },
      kill: () => undefined,
    });
    for (const f of [0.4, 0.7, 0.95]) {
      const d = r * f;
      V.after(0.08 + f * 0.2, () => {
        if (cold) this.combat.decal(T.frostPatch, x + ux * d, y + uy * d, r * f * 0.6, 0xbfe9ff, 0.32, 2.6, s.gAdd);
        else this.combat.decal(T.scorch[(Math.random() * 2) | 0], x + ux * d, y + uy * d, r * f * 0.6, 0x000000, 0.26, 3.2);
      });
    }
    V.shakeNear(x, y, mine ? 3 : 2, 150);
    V.sound('kiln_breath', x, y, mine ? 0.85 : 0.45);
  }
}
