// Weapon arcs drawn in perspective: a holder Container squashed on world Y (the 3/4 camera) with the
// arc Sprite rotating inside it, so a spinning ring stays a level ellipse around the waist instead of a
// wobbling rotated ellipse (which is what a squashed, rotated particle would give). Pooled.

import { Container, Sprite, type Texture } from 'pixi.js';
import type { VfxCore } from './core';
import { clamp, easeOut3 } from './util';

interface Slot { holder: Container; spr: Sprite }

export interface SlashOpts {
  tex: Texture;
  x: number; y: number; z: number;
  /** Outer radius of the arc in world units. */
  r: number;
  rot: number;
  /** Angular velocity (rad/s); its sign is the sweep direction. */
  vr: number;
  life: number;
  color: number;
  alpha: number;
  /** World-Y squash (perspective). */
  squash?: number;
  /** Radius multiplier at start → end. */
  grow?: [number, number];
  /** Fraction of life used to fade in. */
  fadeIn?: number;
}

export class Slashes {
  readonly layer = new Container({ label: 'vfx-slashes' });
  private free: Slot[] = [];
  private live = 0;

  constructor(private V: VfxCore, parent: Container) {
    parent.addChild(this.layer);
  }

  spawn(o: SlashOpts): void {
    if (this.live > 80) return;
    const slot = this.free.pop() ?? this.make();
    const { holder, spr } = slot;
    spr.texture = o.tex;
    spr.tint = o.color;
    holder.position.set(o.x, o.y - o.z);
    holder.scale.set(1, o.squash ?? 0.62);
    // Mirror the arc when sweeping counter-clockwise so the bright head leads the motion.
    const flip = o.vr < 0 ? -1 : 1;
    const base = (o.r * 2) / (o.tex.orig.width * (124 / 128));
    const [g0, g1] = o.grow ?? [0.92, 1.04];
    const fin = o.fadeIn ?? 0.12;
    let age = 0;
    this.layer.addChild(holder);
    this.live++;
    const apply = () => {
      const t = clamp(age / o.life, 0, 1);
      const k = base * (g0 + (g1 - g0) * easeOut3(t));
      spr.scale.set(k, k * flip);
      spr.rotation = o.rot + o.vr * age;
      let a = o.alpha;
      if (t < fin) a *= t / fin;
      else if (t > 0.35) { const u = (t - 0.35) / 0.65; a *= 1 - u * u; }
      spr.alpha = a;
    };
    apply();
    this.V.add({
      update: (dt) => { age += dt; apply(); return age < o.life; },
      kill: () => {
        holder.removeFromParent();
        this.live--;
        this.free.push(slot);
      },
    });
  }

  private make(): Slot {
    const holder = new Container();
    const spr = new Sprite();
    spr.anchor.set(0.5);
    spr.blendMode = 'add';
    holder.addChild(spr);
    return { holder, spr };
  }
}
