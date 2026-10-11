// The weapon's own strike flash (docs/rework/gear/DESIGN-V2.md §10, pass 2.1): when a melee swing reaches its strike
// moment the blade's end flashes in the weapon's light, a ring snaps out and sparks fly; later generations, rarer
// pieces, signatures and grades escalate it (REFERENCES-V2 V7: prestige in small sprites lives in the attack).
// Presentation only (no hit test). Pooled per hero, created on the first strike; ≤ 16 sprites per burst.

import { Container, Sprite, type Texture } from 'pixi.js';
import { fx } from './fx';
import type { WeaponSkin } from './weaponSkin';
import { TAU, clamp, light } from './util';

type Kind = 'flash' | 'ring' | 'spark' | 'motif';
interface P { s: Sprite; kind: Kind; t: number; life: number; x: number; y: number; vx: number; vy: number; size: number; grow: number; spin: number }

export class WeaponImpacts {
  private pool: P[] = [];

  constructor(private parent: Container) {}

  private take(tex: Texture): P {
    let p = this.pool.find((q) => q.t >= q.life);
    if (!p) {
      if (this.pool.length >= 28) p = this.pool.reduce((a, b) => (a.t / a.life > b.t / b.life ? a : b));
      else {
        const s = new Sprite(tex);
        s.anchor.set(0.5); s.blendMode = 'add'; s.visible = false;
        this.parent.addChild(s);
        p = { s, kind: 'flash', t: 1, life: 1, x: 0, y: 0, vx: 0, vy: 0, size: 1, grow: 0, spin: 0 };
        this.pool.push(p);
      }
    }
    p.s.texture = tex;
    p.s.anchor.set(0.5);
    p.t = 0;
    return p;
  }

  /** A strike at (x, y) in the hero's body frame along the swing direction (dx, dy). `full` = full effects. */
  burst(x: number, y: number, dx: number, dy: number, skin: WeaponSkin, full: boolean): void {
    if (skin.strength <= 0) return;
    // sizes saturate at strength 1.6 (a Kindled signature): above that the grade shows in colour and the particle
    // hint, not in a bigger flash (the target must stay readable; owner: no more glow ornament)
    const F = fx(), k = Math.min(1.6, skin.strength);
    const col = skin.light, core = skin.core;
    const flash = this.take(F.glowSoft);
    Object.assign(flash, { kind: 'flash', life: 0.18, x, y, vx: 0, vy: 0, size: 16 + 12 * k, grow: 0.2, spin: 0 });
    flash.s.tint = col;
    const coreP = this.take(F.glow);
    Object.assign(coreP, { kind: 'flash', life: 0.12, x, y, vx: 0, vy: 0, size: 7 + 6 * k, grow: 0.1, spin: 0 });
    coreP.s.tint = core;
    if (!full) return;
    const ring = this.take(F.ringSoft);
    Object.assign(ring, { kind: 'ring', life: 0.24, x, y, vx: 0, vy: 0, size: 10, grow: 16 + 12 * k, spin: 0 });
    ring.s.tint = skin.edge || col;
    const n = Math.min(7, 2 + Math.round(k * 3));
    const ang = Math.atan2(dy, dx);
    for (let i = 0; i < n; i++) {
      const a = ang + (Math.random() - 0.5) * 2.2, sp = 70 + Math.random() * 110 * (0.6 + k * 0.4);
      const p = this.take(F.streak);
      Object.assign(p, { kind: 'spark', life: 0.18 + Math.random() * 0.12, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 9 + 5 * k, grow: 0, spin: a });
      p.s.tint = i % 2 ? core : col;
    }
    // the drawing's particle hint (default drawings: Kindled ember, Fabled star; 'spark' adds nothing more)
    const hint = skin.impact;
    if (!hint || hint === 'spark') return;
    for (let i = 0; i < 2; i++) {
      const tex = hint === 'ember' ? F.flame : F.sparkle;
      const p = this.take(tex);
      const a = Math.random() * TAU;
      Object.assign(p, {
        kind: 'motif', life: 0.32 + Math.random() * 0.18, x: x + Math.cos(a) * 4, y: y + Math.sin(a) * 4,
        vx: Math.cos(a) * 30, vy: hint === 'ember' ? -50 - Math.random() * 30 : Math.sin(a) * 30 - 10,
        size: hint === 'star' ? 11 + 3 * k : 9 + 3 * k, grow: 0, spin: hint === 'ember' ? 0 : 3,
      });
      if (hint === 'ember') p.s.anchor.set(0.5, 0.85);
      p.s.tint = hint === 'star' ? (i % 2 ? 0xffffff : skin.edge || core) : hint === 'shard' ? light(col, 0.5) : skin.edge || col;
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (p.t >= p.life) { if (p.s.visible) p.s.visible = false; continue; }
      p.t += dt;
      const u = clamp(p.t / p.life);
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.s.visible = u < 1;
      p.s.position.set(p.x, p.y);
      switch (p.kind) {
        case 'flash': p.s.width = p.s.height = p.size * (1 + p.grow * u); p.s.alpha = (1 - u) * 0.8; break;
        case 'ring': { const w = p.size + p.grow * (1 - (1 - u) * (1 - u)); p.s.width = w; p.s.height = w * 0.55; p.s.alpha = (1 - u) * 0.8; break; }
        case 'spark': p.s.width = p.size * (1 - u * 0.5); p.s.height = p.size * 0.28; p.s.rotation = p.spin; p.s.alpha = 1 - u; break;
        default: p.s.width = p.s.height = p.size * (1 + p.grow * u * 0.05); p.s.rotation += p.spin * dt; p.s.alpha = Math.sin(u * Math.PI);
      }
    }
  }

  destroy(): void { for (const p of this.pool) p.s.destroy(); this.pool = []; }
}
