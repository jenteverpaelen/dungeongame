// Particle engine: pooled `Fx` quads living in a handful of ParticleContainers (one draw call each).
// Particles are simulated on a ground plane (gx, gy) with a height z; the screen position is (gx, gy - z).
// Effects spawn particles with `layer.add(tex, x, y, life)` and then set the public fields they need.

import { Container, Particle, ParticleContainer, Texture } from 'pixi.js';
import type { FxTextures } from './atlas';
import { clamp, toBgr } from './util';

export class Fx extends Particle {
  /** Ground position. */
  gx = 0;
  gy = 0;
  /** Height above ground (screen y = gy - z). */
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  /** Gravity pulling z down (units/s^2). */
  gz = 0;
  /** Velocity damping (1/s). */
  drag = 0;
  /** Restitution when hitting the ground (needs gz > 0). 0 = die/stick on ground contact is NOT applied. */
  bounce = 0;
  /** When true the particle freezes in place after its last bounce settles. */
  settle = false;
  age = 0;
  life = 1;
  /** Width (world px) at start / end of life; height follows via `k`. */
  w0 = 10;
  w1 = 10;
  /** Aspect multiplier applied to scaleY. */
  k = 1;
  /** Scale easing: 0 linear, 1 ease-out, 2 ease-in, 3 ease-out cubic. */
  se = 0;
  /** Peak alpha, fade-in fraction, fade-out start fraction. */
  a0 = 1;
  fi = 0;
  fo = 0.5;
  /** Flicker amplitude (0..1). */
  flick = 0;
  vr = 0;
  /** Rotate to face the screen-space velocity. */
  align = false;
  /** Owner drives this particle (never auto-expires). */
  manual = false;
  /** Colour lerp (0..255 channels). */
  lerpCol = false;
  cr0 = 255; cg0 = 255; cb0 = 255;
  cr1 = 255; cg1 = 255; cb1 = 255;
  bgr = 0xffffff;
  tw = 1;
  /** Extra per-effect scratch value. */
  u = 0;

  constructor(tex: Texture) {
    super({ texture: tex, anchorX: 0.5, anchorY: 0.5 });
    this.tw = tex.orig.width;
  }

  /** Set a constant tint (0xRRGGBB). */
  tintTo(c: number): this {
    this.bgr = toBgr(c);
    this.lerpCol = false;
    return this;
  }

  /** Tint that lerps from c0 to c1 over the particle's life. */
  tintFade(c0: number, c1: number): this {
    this.cr0 = (c0 >> 16) & 255; this.cg0 = (c0 >> 8) & 255; this.cb0 = c0 & 255;
    this.cr1 = (c1 >> 16) & 255; this.cg1 = (c1 >> 8) & 255; this.cb1 = c1 & 255;
    this.lerpCol = true;
    this.bgr = toBgr(c0);
    return this;
  }

  size(w0: number, w1 = w0): this {
    this.w0 = w0;
    this.w1 = w1;
    return this;
  }

  /** Immediately apply scale/alpha for manual particles. */
  setScale(w: number, k = this.k): void {
    const s = w / this.tw;
    this.scaleX = s;
    this.scaleY = s * k;
  }

  setAlpha(a: number): void {
    this.color = (((a < 0 ? 0 : a > 1 ? 1 : a) * 255) << 24) | this.bgr;
  }
}

export class FxLayer {
  readonly container: ParticleContainer;
  readonly list: Fx[];
  private free: Fx[] = [];
  private scratch: Fx;
  max: number;

  constructor(texture: Texture, blend: 'normal' | 'add', max: number) {
    this.container = new ParticleContainer({
      texture,
      dynamicProperties: { vertex: true, position: true, rotation: true, uvs: true, color: true },
      blendMode: blend,
      roundPixels: false,
    });
    this.list = this.container.particleChildren as Fx[];
    this.max = max;
    this.scratch = new Fx(texture);
    this.scratch.manual = true;
  }

  get count(): number {
    return this.list.length;
  }

  add(tex: Texture, x: number, y: number, life: number): Fx {
    if (this.list.length >= this.max) return this.scratch;
    const p = this.free.pop() ?? new Fx(tex);
    p.texture = tex;
    p.tw = tex.orig.width;
    p.gx = x; p.gy = y; p.z = 0;
    p.vx = 0; p.vy = 0; p.vz = 0; p.gz = 0; p.drag = 0; p.bounce = 0; p.settle = false;
    p.age = 0; p.life = life;
    p.w0 = 10; p.w1 = 10; p.k = 1; p.se = 0;
    p.a0 = 1; p.fi = 0; p.fo = 0.5; p.flick = 0;
    p.vr = 0; p.rotation = 0; p.align = false; p.manual = false;
    p.lerpCol = false; p.bgr = 0xffffff; p.u = 0;
    p.anchorX = 0.5; p.anchorY = 0.5;
    p.x = x; p.y = y;
    p.scaleX = 0; p.scaleY = 0;
    p.color = 0;
    this.list.push(p);
    return p;
  }

  /** Mark a (manual) particle for removal on the next update. */
  kill(p: Fx): void {
    p.manual = false;
    p.age = p.life + 1;
  }

  clear(): void {
    for (const p of this.list) { p.manual = false; this.free.push(p); }
    this.list.length = 0;
  }

  update(dt: number): void {
    const list = this.list;
    const n = list.length;
    let w = 0;
    for (let i = 0; i < n; i++) {
      const p = list[i];
      if (p.manual) { list[w++] = p; continue; }
      p.age += dt;
      if (p.age >= p.life) { this.free.push(p); continue; }
      const t = p.age / p.life;

      // ---- motion ----
      if (p.drag > 0) {
        const d = 1 - p.drag * dt;
        const dd = d < 0 ? 0 : d;
        p.vx *= dd; p.vy *= dd; p.vz *= dd;
      }
      p.gx += p.vx * dt;
      p.gy += p.vy * dt;
      if (p.gz !== 0 || p.vz !== 0) {
        p.vz -= p.gz * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          if (p.bounce > 0 && p.vz < -30) {
            p.vz = -p.vz * p.bounce;
            p.vx *= 0.7; p.vy *= 0.7; p.vr *= 0.6;
          } else if (p.settle) {
            p.vz = 0; p.vx = 0; p.vy = 0; p.vr = 0; p.gz = 0;
          } else if (p.bounce > 0) {
            p.vz = 0; p.vx *= 0.8; p.vy *= 0.8; p.vr *= 0.5;
          }
        }
      }
      p.x = p.gx;
      p.y = p.gy - p.z;
      if (p.align) p.rotation = Math.atan2(p.vy - p.vz, p.vx);
      else p.rotation += p.vr * dt;

      // ---- scale ----
      let e = t;
      switch (p.se) {
        case 1: e = 1 - (1 - t) * (1 - t); break;
        case 2: e = t * t; break;
        case 3: { const u = 1 - t; e = 1 - u * u * u; break; }
        default: break;
      }
      const ww = (p.w0 + (p.w1 - p.w0) * e) / p.tw;
      p.scaleX = ww;
      p.scaleY = ww * p.k;

      // ---- alpha ----
      let a = p.a0;
      if (p.fi > 0 && t < p.fi) a *= t / p.fi;
      if (t > p.fo) { const u = (t - p.fo) / (1 - p.fo); a *= 1 - u * u; }
      if (p.flick > 0) a *= 1 - p.flick * (0.5 + 0.5 * Math.sin(p.age * 38 + p.gx));
      const a8 = (a < 0 ? 0 : a > 1 ? 1 : a) * 255;

      // ---- colour ----
      let bgr = p.bgr;
      if (p.lerpCol) {
        const r = p.cr0 + (p.cr1 - p.cr0) * t, g = p.cg0 + (p.cg1 - p.cg0) * t, b = p.cb0 + (p.cb1 - p.cb0) * t;
        bgr = ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
      }
      p.color = (a8 << 24) | bgr;
      list[w++] = p;
    }
    list.length = w;
    this.container.update();
  }
}

/** All particle layers + helpers shared by every effect module. */
export class FxSystem {
  readonly gNormal: FxLayer;
  readonly gAdd: FxLayer;
  readonly aSmoke: FxLayer;
  readonly aAdd: FxLayer;
  readonly aBody: FxLayer;
  readonly layers: FxLayer[];
  /** 0.2..1: scales optional particle counts when the screen is saturated. */
  budget = 1;

  constructor(readonly T: FxTextures, ground: Container, above: Container) {
    // Every layer shares the atlas source; any frame texture of it works as the container's texture handle.
    this.gNormal = new FxLayer(T.glow, 'normal', 1500);
    this.gAdd = new FxLayer(T.glow, 'add', 2500);
    this.aSmoke = new FxLayer(T.glow, 'normal', 1800);
    this.aAdd = new FxLayer(T.glow, 'add', 6000);
    this.aBody = new FxLayer(T.glow, 'normal', 2600);
    ground.addChild(this.gNormal.container, this.gAdd.container);
    above.addChild(this.aSmoke.container, this.aAdd.container, this.aBody.container);
    this.layers = [this.gNormal, this.gAdd, this.aSmoke, this.aAdd, this.aBody];
  }

  get live(): number {
    let n = 0;
    for (const l of this.layers) n += l.count;
    return n;
  }

  /** Randomly-rounded particle count scaled by the current budget. */
  n(count: number): number {
    const v = count * this.budget;
    const f = v | 0;
    return f + (Math.random() < v - f ? 1 : 0);
  }

  update(dt: number): void {
    const live = this.live;
    this.budget = clamp(1.2 - live / 5200, 0.18, 1);
    for (const l of this.layers) l.update(dt);
  }

  clear(): void {
    for (const l of this.layers) l.clear();
  }

  // ───────── common one-liners ─────────

  /** Soft additive glow that fades. */
  glow(x: number, y: number, z: number, w0: number, w1: number, color: number, life: number, a0 = 1): Fx {
    const p = this.aAdd.add(this.T.glow, x, y, life);
    p.z = z; p.w0 = w0; p.w1 = w1; p.a0 = a0; p.fo = 0; p.se = 1;
    return p.tintTo(color);
  }

  /** Expanding ring (additive). `radius` is the final visible ring radius. */
  ring(layer: FxLayer, tex: Texture, x: number, y: number, r0: number, r1: number, color: number, life: number, a0 = 1, z = 0): Fx {
    const p = layer.add(tex, x, y, life);
    p.z = z;
    p.w0 = r0 * 2.2; p.w1 = r1 * 2.2; p.a0 = a0; p.fo = 0.15; p.se = 1;
    return p.tintTo(color);
  }

  smoke(x: number, y: number, z: number, w0: number, w1: number, color: number, life: number, a0 = 0.5, rise = 30): Fx {
    const T = this.T;
    const p = this.aSmoke.add(T.smoke[(Math.random() * 3) | 0], x, y, life);
    p.z = z; p.vz = rise; p.drag = 1.4; p.w0 = w0; p.w1 = w1; p.a0 = a0; p.fi = 0.12; p.fo = 0.35; p.se = 1;
    p.vr = (Math.random() - 0.5) * 1.2;
    p.rotation = Math.random() * 6.28;
    return p.tintTo(color);
  }

  /** Short additive spark streak flying outward. */
  spark(x: number, y: number, z: number, ang: number, speed: number, len: number, color: number, life: number, gravity = 0): Fx {
    const p = this.aAdd.add(this.T.spark, x, y, life);
    p.z = z;
    p.vx = Math.cos(ang) * speed;
    p.vy = Math.sin(ang) * speed;
    p.gz = gravity;
    p.drag = 2.2;
    p.align = true;
    p.w0 = len; p.w1 = len * 0.25; p.k = 0.5; p.a0 = 1; p.fo = 0.2;
    return p.tintTo(color);
  }

  /** Debris chunk with bounce physics (normal blend, in front). */
  chunk(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, color: number, life: number): Fx {
    const T = this.T;
    const p = this.aBody.add(T.chunk[(Math.random() * 3) | 0], x, y, life);
    p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.gz = 900; p.bounce = 0.38; p.settle = true; p.drag = 0.4;
    p.w0 = size; p.w1 = size * 0.85; p.a0 = 1; p.fo = 0.7;
    p.vr = (Math.random() - 0.5) * 14;
    p.rotation = Math.random() * 6.28;
    return p.tintTo(color);
  }

  /** Little four-point glint. */
  glint(x: number, y: number, z: number, size: number, color: number, life: number, a0 = 1): Fx {
    const p = this.aAdd.add(this.T.star4, x, y, life);
    p.z = z; p.w0 = size * 0.3; p.w1 = size; p.se = 3; p.a0 = a0; p.fo = 0.35; p.vr = 1.4;
    p.rotation = Math.random() * 3;
    return p.tintTo(color);
  }
}
