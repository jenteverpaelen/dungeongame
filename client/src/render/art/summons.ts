// Summons: sentry turret, hydra, companion wolf / bat / raven, dust devil. Same baked-rig machinery as
// monsters, but friendly: warm brass and wood for the Ranger's engineering, ember tones for the Mage.

import { Container, Sprite } from 'pixi.js';
import type { EntityView, ViewState } from '../types';
import { OUT, ball, blob, blobPath, crease, eye, fill, gloss, line, outline, poly, rbox, rivet, seg, wash, type Ctx } from './draw';
import { fx, glowSprite } from './fx';
import { P, RigArt, atkCurve, rigSheet, type C, type Family, type Nodes } from './monsters';
import { PNode } from './puppet';
import { TAU, clamp, lerp, light, shade } from './util';

const BRASS = 0xd2a24a;
const WOODC = 0x9a6a3c;

// ─────────────────────────── sentry ───────────────────────────

function tripod(c: Ctx): void {
  for (const [x0, x1] of [[-1, -13], [1, 13], [0, -3]] as const) seg(c, x0, -18, x1, 0, 2.8, x1 === -3 ? shade(WOODC, 0.25) : WOODC, 2.2);
  for (const x of [-13, 13]) { c.ellipse(x, 0, 2.6, 1.4); fill(c, BRASS); c.ellipse(x, 0, 2.6, 1.4); outline(c, 1.4); }
  ball(c, 0, -19, 4.4, 3.4, BRASS, { hl: 0.45 });
}
function ballista(c: Ctx): void {
  // stock pointing +x, prod at the front
  rbox(c, -12, -3, 26, 6, 2.4, WOODC, { hl: 0.3 });
  c.roundRect(-12, -3, 4, 6, 1.6); fill(c, shade(WOODC, 0.3));
  line(c, (k) => k.moveTo(9, -13).quadraticCurveTo(15, 0, 9, 13), 2.6, shade(WOODC, 0.1), 2.2);
  line(c, (k) => k.moveTo(8.6, -12.4).lineTo(-2, 0).lineTo(8.6, 12.4), 0.8, 0xe8dcc0, 1, false);
  seg(c, -4, -0.2, 18, -0.2, 1.4, 0x8a6a4a, 1.2, false);
  poly(c, [17, -2.2, 22, -0.2, 17, 1.8], 0xc8ccd2, { ow: 1.3 });
  rbox(c, 2, -4.6, 6, 9.2, 1.6, BRASS, { ow: 1.8, hl: 0.45 });
  rivet(c, 5, -2.2); rivet(c, 5, 2.2);
  // little gear
  c.circle(-6, 0, 3.2); fill(c, BRASS); c.circle(-6, 0, 3.2); outline(c, 1.4);
  c.circle(-6, 0, 1.1); fill(c, shade(BRASS, 0.4));
}

const SENTRY: Family = {
  base: 1, height: 38, shadow: 34, atkDur: 0.35,
  parts: () => [P('tripod', tripod), P('head', ballista)],
  rig: (p) => { const tri = p.add('tripod'); const head = p.add('head', tri, 0, -24); return { tri, head }; },
  pose: (n, s, v) => {
    // kick back on every bolt, aimed at the target; idles with a slow scan
    const k = s.atk >= 0 ? Math.exp(-s.atk * 5) * Math.sin(Math.min(1, s.atk * 2.2) * Math.PI) : 0;
    const engaged = v.attackAge < 2 ? 1 : 0;
    const aim = clamp(v.aim, -0.7, 0.7) * engaged;
    n.head.set(-5 * k, -24 + 1.5 * k, aim - 0.1 * (1 - engaged) + Math.sin(s.t * 0.9) * 0.08 * (1 - engaged) - k * 0.3);
    n.tri.c.scale.y = 1 - 0.05 * k;
  },
};

// ─────────────────────────── hydra ───────────────────────────

function lavaPool(c: Ctx): void {
  c.ellipse(0, 0, 22, 8); fill(c, 0x3a1810);
  c.ellipse(0, 0, 22, 8); outline(c, 2.2);
  c.ellipse(0.6, 0.4, 17, 5.6); fill(c, 0xff6a1a);
  wash(c, (k) => k.ellipse(-2, -0.6, 10, 3), 0xffc04a, 0.9);
  wash(c, (k) => k.ellipse(-4, -1.2, 4, 1.2), 0xfff0b0, 0.9);
  for (const [x, y] of [[-16, -3], [14, 2], [8, -5]] as const) ball(c, x, y, 3, 1.8, 0x5a2a1a, { ow: 1.4, hl: 0.2 });
}
function hydraNeck(c: Ctx, col: C): void {
  line(c, (k) => k.moveTo(0, 2).bezierCurveTo(-6, -8, 6, -14, 0, -24), 6.4, col.body, 2.4);
  line(c, (k) => k.moveTo(1.6, 1).bezierCurveTo(-3.6, -8, 7.4, -14, 2, -22), 2, col.accent, 0, false);
}
function hydraHead(c: Ctx, col: C): void {
  // crest fins
  poly(c, [-5, -3, -11, -9, -3, -6], shade(col.body, 0.2), { ow: 1.8 });
  poly(c, [-3, -5, -6, -12, 1, -6], shade(col.body, 0.1), { ow: 1.8 });
  blob(c, [-6, -4, 0, -7, 8, -5, 14, -2, 14, 2, 6, 4, -4, 4], col.body, { hl: 0.3 });
  wash(c, (k) => k.poly([0, 2, 13, 0.6, 13.6, 2, 6, 4, -2, 3.6], true), col.accent, 0.9);
  crease(c, [3, 1.2, 13, 0.4], 1, OUT, 0.6);
  eye(c, 4, -2.4, 1.5, 1.8, 0xffe066);
  c.circle(12, -2, 0.7); fill(c, OUT);
}
function hydraMouth(c: Ctx, col: C): void {
  blob(c, [-1, 0, 7, -1.6, 13, 0.6, 7, 3.4, 0, 2.2], 0x5a0d0d, { ow: 1.6 });
  wash(c, (k) => k.ellipse(6, 1, 3, 1), col.accent, 0.9);
}

const HYDRA_COL: C = { body: 0xd8502a, accent: 0xffb04a, eye: 0xffe066 };
const HYDRA: Family = {
  base: 1, height: 42, shadow: 46, atkDur: 0.45,
  parts: (col) => [P('pool', lavaPool), P('neck', (c) => hydraNeck(c, col)), P('head', (c) => hydraHead(c, col)), P('mouth', (c) => hydraMouth(c, col))],
  rig: (p) => {
    const pool = p.add('pool');
    const n: Nodes = { pool };
    for (let i = 0; i < 3; i++) {
      const neck = p.add('neck', null, -9 + i * 9, -1 - (i === 1 ? 2 : 0));
      const mouth = p.add('mouth', neck, -2, -23);
      const head = p.add('head', neck, -2, -25);
      n[`neck${i}`] = neck; n[`head${i}`] = head; n[`mouth${i}`] = mouth;
    }
    // middle neck drawn last (in front)
    p.toFront(n.neck1);
    return n;
  },
  setup: (p) => {
    const g = glowSprite(0xff7a1a, 70, 0.45, true);
    g.scale.y *= 0.4;
    p.under.addChild(g);
  },
  pose: (n, s, v) => {
    const active = v.lastSeqSeen % 3;
    for (let i = 0; i < 3; i++) {
      const lunge = i === active && s.atk >= 0 ? Math.sin(clamp(s.atk) * Math.PI) : 0;
      const sway = Math.sin(s.t * 2.2 + i * 2.1);
      n[`neck${i}`].rot = sway * 0.12 + lunge * 0.4;
      n[`neck${i}`].c.scale.y = 1 + Math.sin(s.t * 3 + i) * 0.04 + lunge * 0.12;
      n[`head${i}`].set(-2 + lunge * 3, -25, -sway * 0.1 + lunge * 0.25);
      n[`mouth${i}`].set(-2 + lunge * 3, -23 + lunge * 2.6, lunge * 0.4);
    }
  },
};

// ─────────────────────────── wolf ───────────────────────────

const WOLF_COL: C = { body: 0x8494a6, accent: 0xeef2f4, eye: 0x2a1a10 };
function wolfBody(c: Ctx, col: C): void {
  const pts = [-14, -6, -10, -12, 2, -13, 12, -11, 15, -5, 10, 0, -2, 1, -12, 0];
  blob(c, pts, col.body, { hl: 0.2 });
  wash(c, (k) => blobPath(k, [4, -5, 14, -7, 13, -1, 6, 0.6]), col.accent, 0.95);
  crease(c, [-8, -10, -4, -8], 1, shade(col.body, 0.4), 0.7);
  blobPath(c, pts); outline(c);
}
function wolfHead(c: Ctx, col: C): void {
  poly(c, [-4, -6, -2, -15, 3, -7], shade(col.body, 0.15), { ow: 2 });
  poly(c, [1, -6, 5, -14.6, 7, -5], col.body, { ow: 2 });
  c.poly([3, -7, 5, -12, 6, -6.6], true); fill(c, 0xd89a9a);
  ball(c, 2, -1, 7.4, 6.6, col.body, { hl: 0.25 });
  blob(c, [5, -2, 14, -1, 15, 2.6, 6, 4.6], col.accent, { ow: 2, hl: 0.2 });
  ball(c, 14.4, -0.6, 1.8, 1.5, 0x2a2024, { ow: 1, hl: 0.4 });
  eye(c, 6, -3, 1.4, 1.9, col.eye);
  wash(c, (k) => k.ellipse(-2, 3, 4, 2.6), col.accent, 0.85);
}
function wolfLeg(c: Ctx, col: C, isBack: boolean): void {
  const b = isBack ? shade(col.body, 0.25) : shade(col.body, 0.05);
  rbox(c, -2, -1, 4, 10, 2, b, { ow: 2, hl: 0 });
  blob(c, [-2.4, 8, 2.6, 8, 4.4, 10.6, -2.4, 10.6], isBack ? shade(col.accent, 0.3) : col.accent, { ow: 1.8 });
}
function wolfTail(c: Ctx, col: C): void {
  blob(c, [0, 0, -6, -4, -14, -10, -17, -6, -12, 0, -5, 2], col.body, { hl: 0.2 });
  wash(c, (k) => k.ellipse(-15, -7.4, 2.6, 2), col.accent, 0.9);
}
const WOLF: Family = {
  base: 1, height: 30, shadow: 40, atkDur: 0.4,
  parts: (col) => [P('legFB', (c) => wolfLeg(c, col, true)), P('legBB', (c) => wolfLeg(c, col, true)), P('tail', (c) => wolfTail(c, col)), P('body', (c) => wolfBody(c, col)), P('legFF', (c) => wolfLeg(c, col, false)), P('legBF', (c) => wolfLeg(c, col, false)), P('head', (c) => wolfHead(c, col))],
  rig: (p) => {
    const legFB = p.add('legFB', null, 8, -10); const legBB = p.add('legBB', null, -9, -10);
    const body = p.add(null, null, 0, -10);
    const tail = p.add('tail', body, -12, -8); const b = p.add('body', body);
    const legFF = p.add('legFF', null, 10, -10); const legBF = p.add('legBF', null, -7, -10);
    const head = p.add('head', body, 13, -12);
    return { legFB, legBB, body, tail, b, legFF, legBF, head };
  },
  pose: (n, s) => {
    const w = s.walk * 1.2;
    const m = s.move;
    n.legFF.rot = Math.sin(w) * 0.6 * m; n.legBB.rot = Math.sin(w) * 0.6 * m;
    n.legFB.rot = -Math.sin(w) * 0.6 * m; n.legBF.rot = -Math.sin(w) * 0.6 * m;
    const { wind, strike } = atkCurve(s.atk, 0.3, 0.5);
    n.body.set(strike * 5 - wind * 2, -10 - Math.abs(Math.sin(w)) * 1.6 * m + Math.sin(s.t * 2) * 0.4, -wind * 0.08 + strike * 0.1);
    n.head.set(13 + strike * 3, -12 - wind * 1.6, Math.sin(s.t * 1.7) * 0.05 + strike * 0.2 - wind * 0.15);
    n.tail.rot = Math.sin(s.t * (m > 0.2 ? 14 : 5)) * 0.25;
  },
};

// ─────────────────────────── bat & raven ───────────────────────────

const BAT_COL: C = { body: 0x6a5488, accent: 0xff9a52, eye: 0xffe9a0 };
function friendlyBat(c: Ctx, col: C): void {
  poly(c, [-6, -8, -9, -18, -1.6, -11], col.body, { ow: 2.2, hl: 0 });
  poly(c, [1, -10, 4.6, -19, 7.6, -9], col.body, { ow: 2.2, hl: 0 });
  const pts: number[] = [];
  for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; const r = i % 2 ? 9.6 : 10.6; pts.push(Math.cos(a) * r, -3 + Math.sin(a) * r * 0.92); }
  blob(c, pts, col.body, { hl: 0.15 });
  wash(c, (k) => k.ellipse(3, 1, 6, 4.6), light(col.body, 0.3), 0.55);
  eye(c, 3, -4.6, 1.6, 2.4, OUT); eye(c, 8.4, -4.6, 1.6, 2.4, OUT);
  wash(c, (k) => k.ellipse(9.6, -0.6, 1.8, 1), 0xff8f7e, 0.6);
  c.moveTo(4.6, 0.6).quadraticCurveTo(6, 2, 7.6, 0.6); outline(c, 1);
}
function friendlyWing(c: Ctx, col: C, isBack: boolean): void {
  const m = isBack ? shade(col.accent, 0.4) : col.accent;
  const b = isBack ? shade(col.body, 0.3) : col.body;
  const pts = [0, 0, -4, -9, -11, -15, -19, -15, -22, -11, -18.6, -8.6, -17, -4.6, -13, -5, -11, -1.4, -7, -2.4, -3.6, 2];
  c.poly(pts, true); fill(c, m);
  wash(c, (k) => k.poly([0, 0, -4, -9, -11, -15, -19, -15, -22, -11, -16, -12.4, -9, -11.4, -3.6, -5], true), b, 0.9);
  c.poly(pts, true); outline(c, 2);
}
const BAT: Family = {
  base: 1, height: 46, shadow: 22, fly: 28, atkDur: 0.45,
  parts: (col) => [P('body', (c) => friendlyBat(c, col)), P('wingB', (c) => friendlyWing(c, col, true)), P('wingF', (c) => friendlyWing(c, col, false))],
  rig: (p) => {
    const root = p.add(null, null, 0, -28);
    const wingB = p.add('wingB', root, 2, -6); const body = p.add('body', root); const wingF = p.add('wingF', root, -1, -4);
    return { root, wingB, body, wingF };
  },
  pose: (n, s) => {
    const flap = Math.sin(s.t * 16);
    const { wind, strike } = atkCurve(s.atk, 0.3, 0.5);
    n.root.set(strike * 10, -28 + Math.sin(s.t * 4) * 3 - wind * 4 + strike * 10, strike * 0.4);
    n.wingF.set(-1, -4, 0.35 - flap * 0.55); n.wingF.c.scale.y = 0.55 + 0.5 * (0.5 + 0.5 * flap);
    n.wingB.set(2, -6, 0.9 - flap * 0.45); n.wingB.c.scale.set(-0.85, 0.5 + 0.45 * (0.5 + 0.5 * flap));
  },
};

const RAVEN_COL: C = { body: 0x2c2c3e, accent: 0x7f9bff, eye: 0xbfe0ff };
function ravenBody(c: Ctx, col: C): void {
  // tail feathers
  poly(c, [-8, -2, -20, 0, -19, 3, -8, 2], shade(col.body, 0.1), { ow: 2 });
  blob(c, [-9, -1, -4, -6, 4, -7, 9, -4, 8, 1, 0, 3, -7, 2], col.body, { hl: 0.25 });
  ball(c, 9, -8, 5.6, 5.2, col.body, { hl: 0.3 });
  poly(c, [13, -9.6, 20, -7.6, 13.6, -5.4], 0xd8b24a, { ow: 1.6 });
  eye(c, 10.6, -9, 1.3, 1.6, col.eye);
  crease(c, [-4, -3, 4, -4], 1, col.accent, 0.8);
  gloss(c, 6, -11, 2.4, 1, 0.35, col.accent);
}
function ravenWing(c: Ctx, col: C, isBack: boolean): void {
  const b = isBack ? shade(col.body, 0.3) : light(col.body, 0.06);
  const pts = [0, 0, -6, -8, -14, -14, -22, -15, -18, -10, -21, -8, -16, -5, -18, -3, -10, -1];
  c.poly(pts, true); fill(c, b);
  crease(c, [-6, -6, -18, -10], 1, col.accent, isBack ? 0.3 : 0.75);
  c.poly(pts, true); outline(c, 2);
}
const RAVEN: Family = {
  base: 1, height: 44, shadow: 22, fly: 30, atkDur: 0.45,
  parts: (col) => [P('wingB', (c) => ravenWing(c, col, true)), P('body', (c) => ravenBody(c, col)), P('wingF', (c) => ravenWing(c, col, false))],
  rig: (p) => {
    const root = p.add(null, null, 0, -30);
    const wingB = p.add('wingB', root, 1, -4); const body = p.add('body', root); const wingF = p.add('wingF', root, -1, -3);
    return { root, wingB, body, wingF };
  },
  pose: (n, s) => {
    const flap = Math.sin(s.t * 11);
    const { wind, strike } = atkCurve(s.atk, 0.3, 0.5);
    n.root.set(strike * 10, -30 + Math.sin(s.t * 3) * 3 - wind * 4 + strike * 12, 0.05 + strike * 0.45 - wind * 0.2);
    n.wingF.set(-1, -3, 0.3 - flap * 0.6); n.wingF.c.scale.y = 0.5 + 0.55 * (0.5 + 0.5 * flap);
    n.wingB.set(1, -4, 0.8 - flap * 0.5); n.wingB.c.scale.set(-0.85, 0.5 + 0.45 * (0.5 + 0.5 * flap));
  },
};

// ─────────────────────────── dust devil ───────────────────────────

class DustDevil implements EntityView {
  readonly root = new Container();
  readonly height = 64;
  private rings: { c: Container; s: Sprite; speed: number; y: number; w: number }[] = [];
  private debris: Sprite[] = [];
  private t = Math.random() * 10;
  private alpha = 0;
  private dying = false;
  private dT = 0;
  private done: (() => void) | null = null;

  constructor() {
    const sh = new Sprite(fx().shadow);
    sh.anchor.set(0.5); sh.width = 44; sh.height = 18; sh.alpha = 0.5;
    this.root.addChild(sh);
    const cols = [0xb89868, 0xc8a878, 0xd8bc8c, 0xe6d0a4, 0xf0e0bc];
    for (let i = 0; i < 6; i++) {
      const c = new Container();
      const s = new Sprite(fx().swirl);
      s.anchor.set(0.5);
      const w = 22 + i * 9;
      s.width = s.height = w;
      s.tint = cols[Math.min(cols.length - 1, i)];
      s.alpha = 0.75 - i * 0.06;
      c.addChild(s);
      c.scale.y = 0.32;
      const y = -4 - i * 10;
      c.y = y;
      this.root.addChild(c);
      this.rings.push({ c, s, speed: 9 - i * 0.6, y, w });
    }
    for (let i = 0; i < 7; i++) {
      const d = new Sprite(fx().dot);
      d.anchor.set(0.5); d.scale.set(0.25 + Math.random() * 0.2); d.tint = 0x8a6a42;
      this.root.addChild(d);
      this.debris.push(d);
    }
  }

  private destroyed = false;
  update(dt: number, s: ViewState): void {
    if (this.destroyed) return;
    this.t += dt;
    this.alpha = Math.min(1, this.alpha + dt * 4);
    let a = this.alpha;
    let finish: (() => void) | null = null;
    if (this.dying) { this.dT += dt; a *= 1 - clamp(this.dT / 0.35); if (this.dT > 0.36 && this.done) { finish = this.done; this.done = null; } }
    this.root.alpha = a;
    const lean = clamp(s.vx / 400, -0.3, 0.3);
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      r.s.rotation = -this.t * r.speed;
      r.c.x = Math.sin(this.t * 3 + i * 0.7) * (1 + i * 0.8) + lean * i * 6;
    }
    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      const ang = this.t * (6 - i * 0.4) + i * 1.7;
      const h = ((this.t * 0.6 + i / this.debris.length) % 1);
      const rad = 8 + h * 26;
      d.position.set(Math.cos(ang) * rad + lean * h * 40, -4 - h * 56 + Math.sin(ang) * rad * 0.3);
      d.alpha = Math.sin(h * Math.PI) * 0.9;
    }
    if (finish) finish();
  }
  hit(): void { /* dust does not flinch */ }
  die(_e: number, done: () => void): void { if (this.dying || this.destroyed) return; this.dying = true; this.done = done; }
  destroy(): void { if (this.destroyed) return; this.destroyed = true; this.done = null; this.root.destroy({ children: true }); }
}

// ─────────────────────────── fallback orb ───────────────────────────

class OrbSummon implements EntityView {
  readonly root = new Container();
  readonly height = 40;
  private glow: Sprite;
  private core: Sprite;
  private t = 0;
  constructor(color: number) {
    const sh = new Sprite(fx().shadow); sh.anchor.set(0.5); sh.width = 26; sh.height = 11; sh.alpha = 0.4;
    this.glow = glowSprite(color, 46, 0.6);
    this.core = glowSprite(light(color, 0.5), 18, 0.95);
    this.root.addChild(sh, this.glow, this.core);
  }
  private destroyed = false;
  private done: (() => void) | null = null;
  private fade = -1;
  update(dt: number): void {
    if (this.destroyed) return;
    this.t += dt;
    const y = -26 + Math.sin(this.t * 3) * 3;
    this.glow.y = y; this.core.y = y;
    this.glow.alpha = 0.5 + 0.15 * Math.sin(this.t * 5);
    let finish: (() => void) | null = null;
    if (this.fade >= 0) {
      this.fade += dt;
      this.root.alpha = 1 - clamp(this.fade / 0.25);
      if (this.fade > 0.26 && this.done) { finish = this.done; this.done = null; }
    }
    if (finish) finish();
  }
  hit(): void { /* immaterial */ }
  die(_e: number, done: () => void): void { if (this.fade >= 0 || this.destroyed) return; this.fade = 0; this.done = done; }
  destroy(): void { if (this.destroyed) return; this.destroyed = true; this.done = null; this.root.destroy({ children: true }); }
}

// ─────────────────────────── factory ───────────────────────────

const RIGS: Record<string, { fam: Family; col: C; scale?: number }> = {
  sentry: { fam: SENTRY, col: { body: WOODC, accent: BRASS, eye: 0 } },
  hydra: { fam: HYDRA, col: HYDRA_COL },
  wolf: { fam: WOLF, col: WOLF_COL },
  bat: { fam: BAT, col: BAT_COL },
  raven: { fam: RAVEN, col: RAVEN_COL },
};

export class SummonArt implements EntityView {
  private inner: EntityView;
  constructor(type: string) {
    const r = RIGS[type];
    if (type === 'dust_devil') this.inner = new DustDevil();
    else if (r) this.inner = new RigArt({ key: `summon:${type}`, fam: r.fam, colors: r.col, scale: r.scale ?? 1, shadowAlpha: 0.6 });
    else this.inner = new OrbSummon(type.includes('molten') ? 0xff7a1a : 0x9fe3ff);
  }
  get root() { return this.inner.root; }
  get height() { return this.inner.height; }
  update(dt: number, s: ViewState): void { this.inner.update(dt, s); }
  hit(i: number, c: boolean): void { this.inner.hit(i, c); }
  die(e: number, done: () => void): void { this.inner.die(e, done); }
  destroy(): void { this.inner.destroy(); }
}

/** Summon rigs, for baking into the map's shared rig atlas. */
export function summonRigs(): { key: string; colors: C; fam: Family; scale: number }[] {
  return Object.entries(RIGS).map(([type, r]) => ({ key: `summon:${type}`, colors: r.col, fam: r.fam, scale: r.scale ?? 1 }));
}
