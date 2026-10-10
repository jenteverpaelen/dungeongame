// Quest objects (docs/rework/CAST.md "Quest objects"): cart, ledger, marker and mechanism with a clear silhouette, a
// faint pulsing highlight while they are the tracked objective, a short interaction animation and a distinct used state
// (cleared cart, closed book, chalked stone, pulled lever). Painted with the town kit so fields and town match.
import { CanvasSource, Container, Sprite, Texture } from 'pixi.js';
import { ellipse, hash, INK, line, poly, rrect, tone, type Paint } from './townKit';
import { glowSprite, ringSprite, sparkleSprite } from './fx';
import type { EntityView, ViewState } from '../types';

export type ClueKind = 'cart' | 'ledger' | 'marker' | 'mechanism' | 'person' | undefined;
type Art = { x0: number; y0: number; x1: number; y1: number; draw: (c: Paint) => void };
const D = 2;
const cache = new Map<string, Texture>();

function bake(key: string, a: Art): Texture {
  const hit = cache.get(key);
  if (hit && !hit.destroyed) return hit;
  const w = a.x1 - a.x0, h = a.y1 - a.y0, cv = document.createElement('canvas');
  cv.width = Math.ceil(w * D); cv.height = Math.ceil(h * D);
  const c = cv.getContext('2d')!; c.setTransform(D, 0, 0, D, -a.x0 * D, -a.y0 * D); a.draw(c);
  const tex = new Texture({ source: new CanvasSource({ resource: cv, resolution: D, scaleMode: 'linear', autoGenerateMipmaps: true }) });
  cache.set(key, tex);
  return tex;
}
function crate(c: Paint, x: number, y: number, w: number, h: number, tilt = 0, color = '#8a6a42') {
  c.save(); c.translate(x, y); c.rotate(tilt);
  rrect(c, -w / 2, -h - 7, w, 7, 1.5, tone(color, 1.15), INK, 1.1); rrect(c, -w / 2, -h, w, h, 1.5, color, INK, 1.3);
  line(c, [[-w / 2 + 3, -3], [w / 2 - 3, -h + 3]], tone(color, 0.75), 2.4); line(c, [[-w / 2 + 2, -h / 2], [w / 2 - 2, -h / 2]], 'rgba(20,12,8,0.4)', 1);
  c.restore();
}
function spokedWheel(c: Paint, x: number, y: number, rx: number, ry: number, broken = false) {
  ellipse(c, x, y, rx, ry, '#3a2e22', INK, 1.5); ellipse(c, x, y, rx * 0.72, ry * 0.72, undefined, '#7a5a3a', 2.2);
  for (let k = 0; k < 8; k++) { if (broken && (k === 2 || k === 3)) continue; const a = (k / 8) * Math.PI * 2; line(c, [[x, y], [x + Math.cos(a) * rx * 0.72, y + Math.sin(a) * ry * 0.72]], '#7a5a3a', 1.8); }
  ellipse(c, x, y, rx * 0.16, ry * 0.16, '#2a2018');
}

const ART: Record<'cart' | 'ledger' | 'marker' | 'mechanism', (used: boolean) => Art> = {
  cart: (used) => ({ x0: -72, y0: -64, x1: 72, y1: 22, draw: (c) => {
    ellipse(c, 2, 6, 64, 15, 'rgba(56,42,28,0.9)'); ellipse(c, -10, 3, 36, 7, 'rgba(120,96,64,0.35)');
    for (let k = 0; k < 5; k++) line(c, [[-60 + k * 26, 12], [-48 + k * 26, 4 + (k % 2) * 6]], 'rgba(40,28,18,0.6)', 2.2);
    if (!used) spokedWheel(c, -46, 4, 17, 7, true);
    poly(c, [[-34, -16], [22, -34], [38, -14], [-18, 4]], '#7a5a3a', INK, 1.7);
    for (let k = 1; k < 5; k++) line(c, [[-34 + k * 11, -16 - k * 3.6], [-18 + k * 11, 4 - k * 3.6]], 'rgba(20,12,8,0.45)', 1.2);
    poly(c, [[-34, -16], [22, -34], [22, -42], [-34, -24]], '#8a6a46', INK, 1.4);
    spokedWheel(c, 26, -12, 14, 14);
    line(c, [[-34, -12], [-58, -4]], '#5a4030', 4); line(c, [[-30, -6], [-56, 2]], '#5a4030', 4);
    if (used) { crate(c, 50, 6, 20, 16); crate(c, 54, -10, 16, 13, 0, '#94744a'); }
    else { crate(c, -58, 14, 20, 16, 0.5); crate(c, 46, 12, 22, 17, -0.3, '#94744a'); crate(c, 8, 16, 16, 12, 0.9); ellipse(c, -20, 14, 6, 3, '#c8b48a', INK, 0.8); }
  } }),
  ledger: (used) => ({ x0: -34, y0: -62, x1: 34, y1: 12, draw: (c) => {
    ellipse(c, 2, 4, 28, 7, 'rgba(10,8,12,0.4)');
    crate(c, 0, 2, 40, 26, 0, '#7a5c3a');
    if (used) {
      rrect(c, -15, -40, 30, 9, 2, '#6a2a2a', INK, 1.3); line(c, [[-13, -36], [13, -36]], '#d8b54a', 1.2); rrect(c, -15, -32, 30, 3, 1, '#e8dcc0');
    } else {
      poly(c, [[-20, -38], [0, -34], [0, -22], [-20, -26]], '#efe4c8', INK, 1.2); poly(c, [[20, -38], [0, -34], [0, -22], [20, -26]], '#f4ead2', INK, 1.2);
      for (let k = 0; k < 4; k++) { line(c, [[-17, -34 + k * 3], [-3, -31 + k * 3]], 'rgba(60,50,40,0.55)', 0.8); line(c, [[3, -31 + k * 3], [17, -34 + k * 3]], 'rgba(60,50,40,0.55)', 0.8); }
      line(c, [[1, -30], [3, -14], [6, -6]], '#b83a2a', 2);
    }
  } }),
  marker: (used) => ({ x0: -36, y0: -96, x1: 36, y1: 12, draw: (c) => {
    ellipse(c, 2, 3, 24, 6, 'rgba(10,8,12,0.4)');
    line(c, [[18, 2], [18, -88]], '#5a4030', 3.4);
    if (used) poly(c, [[19, -86], [36, -80], [19, -72]], '#c9a65a', INK, 1);
    else poly(c, [[19, -86], [33, -82], [27, -79], [32, -74], [19, -72]], '#8a3a2a', INK, 1);
    poly(c, [[-16, 2], [-13, -44], [-2, -54], [12, -46], [14, 2]], '#8a857a', INK, 1.6);
    poly(c, [[-13, -44], [-2, -54], [2, -50], [-8, -40], [-10, 0], [-16, 2]], 'rgba(255,240,215,0.14)');
    line(c, [[-8, -30], [8, -30]], '#2e2a26', 1.6); line(c, [[0, -40], [0, -20]], '#2e2a26', 1.6); line(c, [[-6, -14], [6, -10]], '#2e2a26', 1.2);
    if (used) { line(c, [[-6, -24], [-2, -18], [7, -34]], '#efe9da', 2.4); }
    ellipse(c, -10, -2, 8, 3, '#4f7a3c');
  } }),
  mechanism: (used) => ({ x0: -40, y0: -70, x1: 40, y1: 12, draw: (c) => {
    ellipse(c, 2, 4, 32, 8, 'rgba(10,8,12,0.4)');
    rrect(c, -26, -24, 52, 24, 3, '#6a665c', INK, 1.5);
    for (let k = 0; k < 3; k++) line(c, [[-24, -18 + k * 7], [24, -18 + k * 7]], 'rgba(30,26,24,0.4)', 1);
    rrect(c, -9, -40, 18, 18, 2, '#5a564e', INK, 1.3);
    const a = used ? -0.9 : 0.35;
    line(c, [[16, -20], [16 + Math.cos(a) * 26, -20 - Math.sin(a) * 26 - 8]], '#3a3c40', 4.5);
    ellipse(c, 16 + Math.cos(a) * 26, -20 - Math.sin(a) * 26 - 8, 4.4, 4.4, '#8a3a2a', INK, 1);
  } }),
};
/** The iron wheel of a mechanism, separate so it can spin. */
const WHEEL: Art = { x0: -20, y0: -20, x1: 20, y1: 20, draw: (c) => {
  ellipse(c, 0, 0, 17, 17, undefined, '#3a3c40', 5); ellipse(c, 0, 0, 17, 17, undefined, 'rgba(200,210,220,0.25)', 1.4);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; line(c, [[0, 0], [Math.cos(a) * 15, Math.sin(a) * 15]], '#3a3c40', 3); }
  ellipse(c, 0, 0, 4, 4, '#8a7a5a', INK, 1);
} };

export class QuestObjectView implements EntityView {
  readonly root = new Container();
  readonly height: number;
  private body: Sprite;
  private ring: Sprite;
  private glow: Sprite | null = null;
  private wheel: Sprite | null = null;
  private spark = sparkleSprite(0xfff1c0, 30, 0);
  private tracked = false;
  private used = false;
  private pulseT = -1;
  private kind: 'cart' | 'ledger' | 'marker' | 'mechanism';
  private ringBase: [number, number];
  private sparkBase: number;
  constructor(kind: ClueKind, private seed = 0) {
    this.kind = kind === 'ledger' || kind === 'marker' || kind === 'mechanism' ? kind : 'cart';
    this.ring = ringSprite(0xffd77a, this.kind === 'cart' ? 168 : 100, 0, true);
    this.ringBase = [this.ring.scale.x, this.ring.scale.y]; this.sparkBase = this.spark.scale.x;
    const art = ART[this.kind](false);
    this.height = -art.y0 - 12;
    this.ring.position.set(0, 2);
    this.body = new Sprite(bake(`${this.kind}:0`, art)); this.body.position.set(art.x0, art.y0);
    this.root.addChild(this.ring, this.body);
    if (this.kind === 'ledger') { this.glow = glowSprite(0xfff0c0, 70, 0, true); this.glow.position.set(0, -32); this.root.addChild(this.glow); }
    if (this.kind === 'mechanism') {
      this.wheel = new Sprite(bake('wheel', WHEEL)); this.wheel.anchor.set(0.5); this.wheel.position.set(0, -31); this.root.addChild(this.wheel);
      this.glow = glowSprite(0x8fd0ff, 60, 0, true); this.glow.position.set(0, -31); this.root.addChild(this.glow);
    }
    this.spark.position.set(0, -this.height * 0.6); this.root.addChild(this.spark);
  }
  /** Driven by the scene from the save: tracked objective → pulsing ring; finished step → used look. */
  setState(tracked: boolean, used: boolean) {
    if (used !== this.used) {
      this.used = used;
      const art = ART[this.kind](used);
      this.body.texture = bake(`${this.kind}:${used ? 1 : 0}`, art); this.body.position.set(art.x0, art.y0);
      if (used) this.pulse();
    }
    this.tracked = tracked && !used;
  }
  /** Short interaction animation (bounce + flash; a mechanism spins). */
  pulse() { this.pulseT = 0; }
  update(dt: number, s: ViewState): void {
    const t = s.time + this.seed;
    this.ring.alpha = this.tracked ? 0.28 + 0.2 * Math.sin(t * 3.2) : 0;
    const breathe = 0.9 + 0.08 * Math.sin(t * 3.2);
    this.ring.scale.set(this.ringBase[0] * breathe, this.ringBase[1] * breathe);
    if (this.glow) this.glow.alpha = this.kind === 'ledger' ? (this.used ? 0 : 0.35 + 0.15 * Math.sin(t * 2)) : this.used ? 0.45 : this.tracked ? 0.3 + 0.2 * Math.sin(t * 4) : 0;
    let k = 0;
    if (this.pulseT >= 0) { this.pulseT += dt / 1000; k = Math.min(1, this.pulseT / 0.5); if (k >= 1) this.pulseT = -1; }
    const bounce = this.pulseT >= 0 ? Math.sin(k * Math.PI) : 0;
    this.body.scale.set(1 + bounce * 0.04, 1 - bounce * 0.06 + bounce * 0.1 * (1 - k));
    this.spark.alpha = bounce * 0.9; this.spark.scale.set(this.sparkBase * (0.6 + bounce));
    if (this.wheel) this.wheel.rotation += (dt / 1000) * (this.pulseT >= 0 ? 9 : this.used ? 0.7 : 0);
    void hash;
  }
  hit(): void { /* quest objects take no damage */ }
  die(_e: number, done: () => void): void { done(); }
  destroy(): void { this.root.destroy({ children: true }); }
}
