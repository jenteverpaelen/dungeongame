// Floating combat text. Every number is a handful of glyph quads in ONE ParticleContainer (one draw call
// for all numbers on screen): per number, all outline quads first, then all fill quads, so tight kerning
// never lets a neighbouring outline cut into a digit. Sizes are in screen pixels (constant regardless of
// zoom); motion is in world units. Spam on one target (>= 6 numbers within 150 ms) merges into one
// summed, growing number.

import { Container, Particle, ParticleContainer, type Texture } from 'pixi.js';
import { fmtCompact } from '@shared/format';
import { getGlyphAtlas, type GlyphAtlas } from './atlas';
import { clamp, easeOut, easeOut3, toBgr } from './util';

export const enum NumKind { Normal, Crit, Dot, Taken, Heal }

export interface NumOpts {
  kind: NumKind;
  /** Element tint for DoTs. */
  color?: number;
  /** Other players' damage: smaller and half transparent. */
  faint?: boolean;
  /** Extra size multiplier (huge crits). */
  big?: number;
  /** Merge key (target id + category); 0 = never merge. */
  key: number;
}

interface Num {
  x: number; y: number;
  dx: number; rise: number;
  age: number; life: number; delay: number;
  px: number; fill: number; outline: number; alpha: number;
  pop: number; popDur: number; bumpAt: number;
  thick: boolean;
  amount: number; count: number; crit: boolean;
  prefix: string;
  out: Particle[]; fil: Particle[]; adv: number[]; width: number;
  key: number; lastAdd: number; born: number;
  merged: boolean; dead: boolean;
  opts: NumOpts;
}

interface Rec { singles: Num[]; merged: Num | null; seen: number }

const MAX_NUMS = 260;
const SPACING = 0.93;
const FAMILY = '"Lilita One", "Arial Black", Impact, sans-serif';

const STYLE = {
  [NumKind.Normal]: { px: 19, fill: 0xffffff, outline: 0x140b06, life: 0.9, thick: false, pop: 1.25, popDur: 0.08, rise: [42, 62] },
  [NumKind.Crit]: { px: 27.5, fill: 0xffd23f, outline: 0x3a1402, life: 1.1, thick: true, pop: 1.6, popDur: 0.12, rise: [52, 72] },
  [NumKind.Dot]: { px: 15, fill: 0xffffff, outline: 0x140b06, life: 0.85, thick: false, pop: 1.0, popDur: 0.01, rise: [30, 44] },
  [NumKind.Taken]: { px: 21, fill: 0xff4a3a, outline: 0x2a0000, life: 1.0, thick: true, pop: 1.35, popDur: 0.1, rise: [40, 56] },
  [NumKind.Heal]: { px: 16, fill: 0x7dff8a, outline: 0x062008, life: 1.0, thick: false, pop: 1.2, popDur: 0.1, rise: [34, 46] },
} as const;

export class CombatText {
  readonly container: ParticleContainer;
  private atlas: GlyphAtlas;
  private nums: Num[] = [];
  private pool: Particle[] = [];
  private recs = new Map<number, Rec>();
  private lanes = new Map<number, number>();
  private burst = 0;
  private time = 0;
  private sweepAt = 0;

  constructor(parent: Container, private zoom: () => number) {
    this.atlas = getGlyphAtlas(FAMILY);
    this.container = new ParticleContainer({
      texture: this.atlas.fill['0'],
      dynamicProperties: { vertex: true, position: true, rotation: false, uvs: true, color: true },
      roundPixels: false,
      label: 'vfx-numbers',
    });
    parent.addChild(this.container);
    // Re-bake once the web font is ready (the atlas may have been baked with the fallback face).
    if (typeof document !== 'undefined' && document.fonts && !document.fonts.check(`${this.atlas.size}px "Lilita One"`)) {
      document.fonts.load(`${this.atlas.size}px "Lilita One"`).then(() => this.atlas.rebake(FAMILY)).catch(() => undefined);
    }
  }

  get count(): number {
    return this.nums.length;
  }

  /** Spawn a number at world (x, y) = head of the target. */
  spawn(amount: number, x: number, y: number, o: NumOpts): void {
    if (!(amount > 0)) return;
    const now = this.time;
    const crowded = this.nums.length > 190;
    if (o.key) {
      let rec = this.recs.get(o.key);
      if (!rec) { rec = { singles: [], merged: null, seen: now }; this.recs.set(o.key, rec); }
      rec.seen = now;
      const m = rec.merged;
      if (m && !m.dead && now - m.lastAdd < (crowded ? 0.3 : 0.18) && m.age < 1.2) {
        this.absorb(m, amount, o.kind === NumKind.Crit);
        return;
      }
      rec.merged = null;
      const win = crowded ? 0.3 : 0.15;
      rec.singles = rec.singles.filter((n) => !n.dead && now - n.born < win);
      const threshold = crowded ? 2 : 5;
      if (rec.singles.length >= threshold) {
        let sum = amount, crit = o.kind === NumKind.Crit;
        for (const n of rec.singles) { sum += n.amount; crit ||= n.crit; this.fadeFast(n); }
        const mo: NumOpts = { ...o, kind: crit ? NumKind.Crit : o.kind };
        const merged = this.make(sum, x, y, mo, true);
        merged.count = rec.singles.length + 1;
        merged.crit = crit;
        rec.singles = [];
        rec.merged = merged;
        return;
      }
      rec.singles.push(this.make(amount, x, y, o, false));
      return;
    }
    this.make(amount, x, y, o, false);
  }

  private make(amount: number, x: number, y: number, o: NumOpts, merged: boolean): Num {
    if (this.nums.length >= MAX_NUMS) this.evict();
    const st = STYLE[o.kind];
    const lane = o.key ? this.nextLane(o.key) : 0;
    const laneX = [0, -16, 16, -8, 8][lane];
    const laneY = [0, -8, -4, -14, -10][lane];
    const n: Num = {
      x: x + laneX + (Math.random() - 0.5) * 8,
      y: y + laneY,
      dx: (Math.random() - 0.5) * 22 + Math.sign(laneX) * 8,
      rise: st.rise[0] + Math.random() * (st.rise[1] - st.rise[0]),
      age: 0, life: st.life + (merged ? 0.35 : 0),
      delay: Math.min(0.045, this.burst * 0.006),
      px: st.px * (o.big ?? 1) * (o.faint ? 0.75 : 1) * (merged ? 1.12 : 1),
      fill: toBgr(o.kind === NumKind.Dot && o.color !== undefined ? o.color : st.fill),
      outline: toBgr(st.outline),
      alpha: o.faint ? 0.5 : 1,
      pop: merged ? 1.45 : st.pop, popDur: st.popDur, bumpAt: -1,
      thick: st.thick || merged,
      amount, count: 1, crit: o.kind === NumKind.Crit,
      prefix: o.kind === NumKind.Heal ? '+' : '',
      out: [], fil: [], adv: [], width: 0,
      key: o.key, lastAdd: this.time, born: this.time,
      merged, dead: false, opts: o,
    };
    this.burst++;
    this.setText(n);
    this.nums.push(n);
    return n;
  }

  private absorb(m: Num, amount: number, crit: boolean): void {
    m.amount += amount;
    m.count++;
    m.lastAdd = this.time;
    m.bumpAt = this.time;
    if (crit && !m.crit) {
      m.crit = true;
      m.fill = toBgr(STYLE[NumKind.Crit].fill);
      m.outline = toBgr(STYLE[NumKind.Crit].outline);
    }
    // Grow with the merge count, keep it alive and rising.
    m.px = Math.min(m.px * 1.025, STYLE[NumKind.Crit].px * 1.6);
    if (m.age > 0.35) m.age = 0.35;
    this.setText(m);
  }

  private fadeFast(n: Num): void {
    const t = n.age - n.delay;
    n.life = Math.max(0, t) + 0.08;
    n.dead = true;
  }

  private nextLane(key: number): number {
    const l = ((this.lanes.get(key) ?? -1) + 1) % 5;
    this.lanes.set(key, l);
    return l;
  }

  private evict(): void {
    let idx = this.nums.findIndex((n) => !n.thick);
    if (idx < 0) idx = 0;
    this.release(this.nums[idx]);
    this.nums.splice(idx, 1);
  }

  private glyph(tex: Texture): Particle {
    const p = this.pool.pop() ?? new Particle({ texture: tex, anchorX: 0.5, anchorY: this.atlas.base });
    p.texture = tex;
    p.anchorX = 0.5;
    p.anchorY = this.atlas.base;
    return p;
  }

  private release(n: Num): void {
    for (const p of n.out) this.pool.push(p);
    for (const p of n.fil) this.pool.push(p);
    n.out.length = 0;
    n.fil.length = 0;
    n.dead = true;
  }

  private setText(n: Num): void {
    const s = n.prefix + fmtCompact(n.amount);
    for (const p of n.out) this.pool.push(p);
    for (const p of n.fil) this.pool.push(p);
    n.out.length = 0; n.fil.length = 0; n.adv.length = 0;
    const A = this.atlas;
    const outSet = n.thick ? A.outC : A.outN;
    let w = 0;
    for (const ch of s) {
      const o = outSet[ch];
      if (!o) continue;
      n.out.push(this.glyph(o));
      n.fil.push(this.glyph(A.fill[ch]));
      const a = A.adv[ch] ?? A.size * 0.6;
      n.adv.push(a);
      w += a;
    }
    n.width = w * SPACING;
  }

  update(dt: number): void {
    this.time += dt;
    this.burst = 0;
    const zoom = this.zoom() || 1;
    const list = this.container.particleChildren;
    list.length = 0;
    const nums = this.nums;
    let w = 0;
    for (let i = 0; i < nums.length; i++) {
      const n = nums[i];
      n.age += dt;
      const ta = n.age - n.delay;
      if (ta >= n.life) { this.release(n); continue; }
      nums[w++] = n;
    }
    nums.length = w;
    // Two passes: regular numbers first, emphasised (crit / merged / taken) on top.
    for (let pass = 0; pass < 2; pass++) {
      for (const n of nums) {
        if ((pass === 1) !== n.thick) continue;
        const ta = n.age - n.delay;
        if (ta < 0) continue;
        this.layout(n, ta, zoom, list);
      }
    }
    this.container.update();
    if (this.time > this.sweepAt) {
      this.sweepAt = this.time + 0.5;
      for (const [k, r] of this.recs) if (this.time - r.seen > 1.2) { this.recs.delete(k); this.lanes.delete(k); }
    }
  }

  private layout(n: Num, ta: number, zoom: number, list: Particle[]): void {
    const t = ta / n.life;
    const rt = clamp(ta / (n.life * 0.62), 0, 1);
    const y = n.y - easeOut3(rt) * n.rise;
    const x = n.x + easeOut(rt) * n.dx;
    let s = 1;
    if (ta < n.popDur) s = n.pop + (1 - n.pop) * easeOut(ta / n.popDur);
    if (n.bumpAt >= 0) {
      const bt = (this.time - n.bumpAt) / 0.11;
      if (bt < 1) s *= 1 + 0.22 * (1 - bt);
    }
    let a = n.alpha;
    if (t > 0.6) { const u = (t - 0.6) / 0.4; a *= 1 - u * u; }
    if (ta < 0.04) a *= ta / 0.04;
    const gs = (n.px * s) / this.atlas.size / zoom;
    const a8 = ((a < 0 ? 0 : a > 1 ? 1 : a) * 255) << 24;
    const cOut = a8 | n.outline, cFill = a8 | n.fill;
    let cx = x - (n.width * gs) / 2;
    const k = n.out.length;
    for (let i = 0; i < k; i++) {
      const adv = n.adv[i] * gs;
      const gx = cx + adv / 2;
      const o = n.out[i];
      o.x = gx; o.y = y; o.scaleX = gs; o.scaleY = gs; o.color = cOut;
      list.push(o);
      const f = n.fil[i];
      f.x = gx; f.y = y; f.scaleX = gs; f.scaleY = gs; f.color = cFill;
      cx += adv * SPACING;
    }
    // Fills after all outlines of this number.
    for (let i = 0; i < k; i++) list.push(n.fil[i]);
  }

  clear(): void {
    for (const n of this.nums) this.release(n);
    this.nums.length = 0;
    this.recs.clear();
    this.lanes.clear();
    this.container.particleChildren.length = 0;
    this.container.update();
  }
}
