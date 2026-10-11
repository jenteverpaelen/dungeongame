// Summons: sentry turret, hydra, companion wolf / bat / raven, dust devil; ranger M1 spring snare, pitch mortar,
// badger, heron and the murmuration flocks. Same baked-rig machinery as monsters, but friendly: warm brass and wood
// for the Ranger's engineering, ember tones for the Mage.

import { CanvasSource, Container, Particle, ParticleContainer, Rectangle, Sprite, Texture } from 'pixi.js';
import { sfx } from '../../audio/sfx';
import { effectsFactor } from '../../game/quality';
import type { ActionSpec } from '../actions';
import type { ActingView, EntityView, ViewState } from '../types';
import { OUT, arcPts, ball, blob, blobPath, crease, eye, fill, gloss, line, outline, poly, rbox, rivet, seg, wash, type Ctx } from './draw';
import { fx, glowSprite, sparkleSprite } from './fx';
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

// ─────────────────────────── cinderkin / frostkin / ember sprite (Mage M9) ───────────────────────────
// docs/rework/depth/MAGE.md §3 M9: small round ember sprites with coal-chunk bodies and flickering eyes, sparks
// behind them. Frostkin is the same creature cut from ice. They hop to enemies and claw (F_ATTACK).

const KIN_COL: C = { body: 0x3b2c26, accent: 0xff8a3d, eye: 0xffe27a };
const FROSTKIN_COL: C = { body: 0x5f8eae, accent: 0xcff2ff, eye: 0xf2fdff };
const SPRITE_COL: C = { body: 0xff8a3d, accent: 0xffe08a, eye: 0x3a1a0c };

function kinBody(c: Ctx, col: C, frost: boolean): void {
  // a faceted lump of coal (frost: a chunk of blue ice), facet edges, glowing seams, a lit belly
  const pts = [-10.6, -1, -9.8, -8.8, -3.8, -12.8, 4.4, -12.8, 10.2, -7.8, 11, 0.4, 7.6, 7.2, -1, 8.6, -8.4, 6];
  poly(c, pts, col.body, { hl: frost ? 0.5 : 0.22, inset: 0.8 });
  const edge = frost ? light(col.body, 0.45) : light(col.body, 0.18);
  crease(c, [-3.8, -12.8, -1.6, -5.6, 7.6, 7.2], 1, edge, 0.75);
  crease(c, [-1.6, -5.6, -10.6, -1], 1, edge, 0.6);
  crease(c, [-1.6, -5.6, 10.2, -7.8], 1, edge, 0.6);
  wash(c, (k) => k.ellipse(1.6, 3.4, 6, 3.4), col.accent, frost ? 0.45 : 0.4);
  // seams: dark-edged, bright-cored cracks
  const seams = [[-8.6, 2.6, -5, -0.8, -6, -5.4], [9.2, -3.4, 5.8, 0.8, 7.4, 5], [-2.4, 7.6, -0.6, 4.4]];
  for (const s of seams) { crease(c, s, 2.4, frost ? 0x2c5a7a : 0x1a0c08, 0.7); crease(c, s, 1.3, col.accent, 1); }
  // face: two lantern eyes and a small grin
  eye(c, 1.6, -5, 2.1, 2.9, col.eye);
  eye(c, 7.2, -5.2, 1.8, 2.6, col.eye);
  c.moveTo(2.6, -0.6).quadraticCurveTo(4.6, 1, 6.6, -0.8); outline(c, 1.2);
}
function kinTuft(c: Ctx, col: C, frost: boolean): void {
  // a flame (frost: a frost wisp) licking off the crown; base at (0, 0)
  const pts = [0, 1.4, -4.6, -1.4, -5, -6, -2.4, -9.6, -1.4, -6.4, 0.4, -12.6, 2.2, -6.8, 3.8, -9, 5, -4.4, 4.4, -0.6];
  blob(c, pts, frost ? light(col.accent, 0.2) : col.accent, { hl: 0.55, ow: 1.8 });
  wash(c, (k) => blobPath(k, [0, 0, -2.4, -2, -2, -5.6, 0.2, -8.4, 2.2, -5, 2, -1.4]), frost ? 0xffffff : 0xffe08a, 0.9);
}
function kinArm(c: Ctx, col: C, isBack: boolean): void {
  // a stubby coal arm ending in three little claws (origin at the shoulder, pointing down/forward)
  const b = isBack ? shade(col.body, 0.25) : col.body;
  rbox(c, -2, -1.4, 4, 7.4, 2, b, { ow: 1.8, hl: 0 });
  for (const dx of [-1.6, 0.4, 2.2]) poly(c, [dx - 0.9, 5.4, dx + 0.9, 5.4, dx + 0.6, 8.8], isBack ? shade(col.accent, 0.3) : col.accent, { ow: 1.2 });
}

function kinFamily(frost: boolean): Family {
  return {
    base: 1, height: 30, shadow: 24, atkDur: 0.42, eyes: ['body', 4.4, -5],
    parts: (col) => [P('armB', (c) => kinArm(c, col, true)), P('body', (c) => kinBody(c, col, frost)), P('tuft', (c) => kinTuft(c, col, frost)), P('armF', (c) => kinArm(c, col, false))],
    rig: (p) => {
      const root = p.add(null, null, 0, -9);
      const armB = p.add('armB', root, -6, -2);
      const body = p.add('body', root);
      const tuft = p.add('tuft', root, 1, -12);
      const armF = p.add('armF', root, 7, -1);
      return { root, armB, body, tuft, armF };
    },
    setup: (p, _n, v) => {
      // the ember glow on the ground and the sparks streaming off behind (frost: glittering flakes): all additive and
      // all in p.under, so a kin costs one extra blend run like the hydra's pool glow (the baked eyes glow on wind-ups
      // through the family's `eyes` hook)
      const glow = glowSprite(frost ? 0x9fdcff : 0xff7a1a, 46, 0.5, true);
      glow.scale.y *= 0.42;
      p.under.addChild(glow);
      v.extra.glow = glow;
      for (let i = 0; i < 3; i++) { const s = sparkleSprite(frost ? 0xe8fbff : 0xffb050, 7, 0); p.under.addChild(s); v.extra[`mote${i}`] = s; }
    },
    pose: (n, s, v) => {
      // hop when moving (squash on landing), bob when idle, both arms rake on an attack
      const hop = Math.abs(Math.sin(s.walk * 0.9)) * s.move;
      const land = s.move > 0.2 ? Math.max(0, 1 - Math.abs(Math.sin(s.walk * 0.9)) * 4) : 0;
      const { wind, strike } = atkCurve(s.atk, 0.35, 0.55);
      n.root.set(strike * 4 - wind * 1.5, -9 - hop * 7 + Math.sin(s.t * 3.4) * 0.8 * (1 - s.move), strike * 0.22 - wind * 0.15 + s.move * 0.08);
      n.root.scale(1 + 0.12 * land + 0.04 * wind, 1 - 0.14 * land + 0.03 * Math.sin(s.t * 5));
      n.armF.rot = -0.3 - wind * 1.6 + strike * 1.9 + Math.sin(s.walk) * 0.4 * s.move;
      n.armB.rot = 0.2 - wind * 1.2 + strike * 1.5 - Math.sin(s.walk) * 0.4 * s.move;
      const fl = Math.sin(s.t * 17) * 0.5 + Math.sin(s.t * 29) * 0.5;
      n.tuft.set(1 - s.move * 1.5, -12, -0.12 * s.move + fl * 0.06);
      n.tuft.scale(1 + fl * 0.06, 1 + fl * 0.12 + wind * 0.3);
      const g = v.extra.glow;
      if (g) g.alpha = 0.42 + 0.12 * Math.abs(fl) + 0.2 * strike;
      const dir = Math.sign(s.face) || 1, S = v.S;
      for (let i = 0; i < 3; i++) {
        const sp = v.extra[`mote${i}`];
        if (!sp) continue;
        const u = (s.t * (1.6 + i * 0.3) + i / 3) % 1;
        sp.position.set((-6 - u * (10 + 10 * s.move)) * dir * S, (-12 - u * 18 + Math.sin(u * 9 + i) * 2) * S);
        sp.alpha = Math.sin(u * Math.PI) * (0.55 + 0.35 * s.move);
        sp.scale.set((0.32 - u * 0.18) * Math.max(1, S * 0.8));
        sp.visible = sp.alpha > 0.02;
      }
    },
  };
}

function spriteBody(c: Ctx, col: C): void {
  // a tiny flying flame: a teardrop of fire with a hot core and a small face
  const pts = [0, 7, -6.4, 3.4, -7, -3, -4, -8, -2, -6, 0, -14, 2.4, -7.4, 4.8, -9.6, 7, -3, 6.4, 3.4];
  blob(c, pts, col.body, { hl: 0.45, ow: 2 });
  wash(c, (k) => blobPath(k, [0, 5, -4, 2.4, -4, -2.4, -1, -5.6, 1, -3, 3.4, -5, 4.4, -1.4, 4, 2.6]), col.accent, 0.95);
  eye(c, -1.6, -0.6, 1.1, 1.6, col.eye); eye(c, 2.4, -0.6, 1.1, 1.6, col.eye);
}
function spriteWing(c: Ctx, col: C): void {
  blob(c, [0, 0, -3, -4, -8, -6, -10, -3, -6, 0.6], light(col.accent, 0.4), { ow: 1.4, hl: 0.4 });
}
const EMBER_SPRITE: Family = {
  base: 1, height: 40, shadow: 14, fly: 26, atkDur: 0.38,
  parts: (col) => [P('wingB', (c) => spriteWing(c, col)), P('body', (c) => spriteBody(c, col)), P('wingF', (c) => spriteWing(c, col))],
  rig: (p) => {
    const root = p.add(null, null, 0, -26);
    const wingB = p.add('wingB', root, -2, -3); const body = p.add('body', root); const wingF = p.add('wingF', root, -1, -1);
    return { root, wingB, body, wingF };
  },
  setup: (p, _n, v) => {
    // additive glow and sparks in p.under (one blend run), the glow positioned on the flying body each frame
    const g = glowSprite(0xff8a3d, 36, 0.7);
    p.under.addChild(g);
    v.extra.glow = g;
    for (let i = 0; i < 2; i++) { const s = sparkleSprite(0xffc060, 6, 0); p.under.addChild(s); v.extra[`mote${i}`] = s; }
  },
  pose: (n, s, v) => {
    const flap = Math.sin(s.t * 22);
    const { wind, strike } = atkCurve(s.atk, 0.3, 0.5);
    n.root.set(strike * 8, -26 + Math.sin(s.t * 4.2) * 2.4 - wind * 3 + strike * 8, strike * 0.35 + s.move * 0.18);
    n.wingF.set(-1, -1, 0.4 - flap * 0.5); n.wingF.c.scale.y = 0.6 + 0.4 * (0.5 + 0.5 * flap);
    n.wingB.set(-2, -3, 0.9 - flap * 0.4); n.wingB.c.scale.set(-0.8, 0.55 + 0.4 * (0.5 + 0.5 * flap));
    const fl = Math.sin(s.t * 19) * 0.5 + Math.sin(s.t * 31) * 0.5;
    n.body.scale(1 + fl * 0.05, 1 + fl * 0.1);
    const g = v.extra.glow;
    if (g) { g.alpha = 0.55 + 0.25 * fl; g.position.set(n.root.x * (Math.sign(s.face) || 1) * v.S, (n.root.y - 2) * v.S); }
    const dir = Math.sign(s.face) || 1;
    for (let i = 0; i < 2; i++) {
      const sp = v.extra[`mote${i}`];
      if (!sp) continue;
      const u = (s.t * 2.2 + i * 0.5) % 1;
      sp.position.set((-4 - u * 14) * dir, -24 - u * 6 + Math.sin(u * 8) * 2);
      sp.alpha = Math.sin(u * Math.PI) * 0.8;
      sp.scale.set(0.3 - u * 0.15);
      sp.visible = sp.alpha > 0.02;
    }
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

// ─────────────────────────── ranger M1: Spring Snare ───────────────────────────
// docs/rework/depth/RANGER.md R8: iron jaws on a coil of rope, half buried. The jaws lie open (two toothed half-rings
// flattened onto the plate); they spring up when it snaps. The snap itself (and the 1.5 s hold) is drawn by the VFX
// layer (vfx/ranger.ts snareSnap) because a sprung snare is usually consumed at once.

const IRON = 0x8a8e96;
const ROPE = 0x9a7b4f;

function snareBed(c: Ctx): void {
  blob(c, [-21, 1, -12, -4, 0, -5, 12, -4, 21, 1, 12, 5, 0, 6, -12, 5], 0x6a5038, { ow: 0, hl: 0.1 });
  wash(c, (k) => k.ellipse(1, 2, 18, 3.6), 0x3a2a1c, 0.45);
  for (const [x, y] of [[-17, 3], [15, -1], [9, 4]] as const) ball(c, x, y, 1.6, 1.1, 0x9a8a74, { ow: 0.8, hl: 0.3 });
  // rope coil and its stake
  for (const [rx, ry, oy] of [[6, 2.4, 0], [5, 2, -1.6]] as const) line(c, (k) => k.ellipse(-15, 2 + oy, rx, ry), 1.6, ROPE, 1.1, false);
  line(c, (k) => k.moveTo(-10, 0.6).quadraticCurveTo(-7, -1.6, -5, -0.6), 1.5, ROPE, 1.1, false);
  rbox(c, -24, -8, 2.8, 9, 1.2, WOODC, { ow: 1.4, hl: 0.2 });
}
function snarePlate(c: Ctx): void {
  c.ellipse(0, 0, 12.5, 4.4); fill(c, 0x4a4e56); c.ellipse(0, 0, 12.5, 4.4); outline(c, 1.6);
  c.ellipse(0, -0.4, 5, 2); fill(c, 0x868a92); c.ellipse(0, -0.4, 5, 2); outline(c, 1);
  for (const x0 of [-11, 8.6]) crease(c, [x0, 0, x0 + 0.6, -1.6, x0 + 1.2, 1.6, x0 + 1.8, -1.6, x0 + 2.4, 0], 1.2, 0x2e3238, 0.9);
}
/** A toothed half-ring, hinge line at y = 0 (the arc rises to -R); flattened / flipped by the rig. */
function snareJaw(c: Ctx, front: boolean): void {
  const R = 13.5, r = 9.8;
  const outer = arcPts(0, 0, R, R, Math.PI, TAU, 14), inner = arcPts(0, 0, r, r, TAU, Math.PI, 14);
  poly(c, [...outer, ...inner], front ? shade(IRON, 0.12) : IRON, { ow: 1.6, hl: 0.25 });
  const teeth: number[] = [];
  for (let i = 0; i < 7; i++) {
    const a0 = Math.PI + (i + 0.15) * (Math.PI / 7), a1 = Math.PI + (i + 0.5) * (Math.PI / 7), a2 = Math.PI + (i + 0.85) * (Math.PI / 7);
    teeth.push(Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * (r - 3.8), Math.sin(a1) * (r - 3.8), Math.cos(a2) * r, Math.sin(a2) * r);
    poly(c, teeth.slice(-6), 0xd8dbe0, { ow: 1, flat: true });
  }
  crease(c, arcPts(0, 0, R - 1.6, R - 1.6, Math.PI * 1.15, Math.PI * 1.55, 5), 0.9, 0xffffff, 0.5);
  rivet(c, -R + 1.8, -0.6); rivet(c, R - 1.8, -0.6);
}

/** Arming / snap state the family reads (the rig itself is stateless). */
class TrapArt extends RigArt {
  age = 0;
  armedAt = -1;
  hideUntil = -1;
  override update(dt: number, s: ViewState): void {
    this.age += dt;
    if (this.armedAt < 0 && this.age > 0.6) this.armedAt = this.age; // arms after 0.6 s unless told earlier (Hair Trigger)
    super.update(dt, s);
    // half buried: drawn under anything standing on or around it
    this.root.zIndex = s.y - 40;
    const hidden = this.age < this.hideUntil;
    this.root.alpha = hidden ? 0 : this.hideUntil > 0 ? clamp((this.age - this.hideUntil) / 0.3) : 1;
  }
  armed(): void { if (this.armedAt < 0) this.armedAt = this.age; }
  /** The VFX layer draws the sprung jaws; hide until a Reset Spring re-arms it (or the entity is removed). */
  snapped(): void { this.hideUntil = this.age + 1.6; this.armedAt = this.age + 1.6; }
}

const SNARE: Family = {
  base: 1, height: 16, shadow: 34, atkDur: 0.35,
  parts: () => [P('bed', snareBed), P('plate', snarePlate), P('jawB', (c) => snareJaw(c, false)), P('jawF', (c) => snareJaw(c, true))],
  rig: (p) => {
    const bed = p.add('bed'); const plate = p.add('plate', null, 1, -1);
    const jawB = p.add('jawB', null, 1, -1.6); const jawF = p.add('jawF', null, 1, -0.8);
    return { bed, plate, jawB, jawF };
  },
  pose: (n, s, v) => {
    const t = v as TrapArt;
    const armed = t.armedAt >= 0 ? clamp((t.age - t.armedAt) / 0.12) : 0;
    // set but not armed: jaws half raised and trembling; armed: flat open, a slow glint pulse; snap: spring shut
    const snap = s.atk >= 0 ? Math.min(1, s.atk * 4) : 0;
    let open = 0.62 - 0.32 * armed + Math.sin(t.age * 40) * 0.03 * (1 - armed);
    if (armed > 0 && armed < 1) open -= Math.sin(armed * Math.PI) * 0.1; // the spring drops into place
    const k = open + (1 - open) * snap;
    n.jawB.c.scale.y = k;
    n.jawF.c.scale.y = -open + (1 + open) * snap;
    n.jawB.c.scale.x = n.jawF.c.scale.x = 1;
    n.plate.c.scale.y = 1 - 0.1 * snap;
  },
};

// ─────────────────────────── ranger M1: Pitch Mortar ───────────────────────────
// R11: a squat iron mortar on a wooden sled. Recoil on every shot (attackSeq / playAction); the smoke, pot and tar fire
// are VFX (vfx/ranger.ts mortarShot / mortarImpact).

function mortarSled(c: Ctx): void {
  line(c, (k) => k.moveTo(-20, 0).lineTo(12, 0).quadraticCurveTo(19, 0, 21, -6), 3, shade(WOODC, 0.2), 1.8);
  rbox(c, -18, -7.5, 32, 5.5, 2, WOODC, { ow: 1.8, hl: 0.3 });
  for (const x of [-13, -3, 7]) crease(c, [x, -7, x, -2.2], 1, shade(WOODC, 0.45), 0.8);
  for (const x of [-15, 11]) { rbox(c, x - 1.6, -9.5, 3.2, 3.6, 1, 0x5a3e24, { ow: 1.2, hl: 0 }); }
  line(c, (k) => k.moveTo(-17, -4).quadraticCurveTo(-21, -1, -24, -2), 1.3, ROPE, 1, false);
}
function mortarCheek(c: Ctx): void {
  poly(c, [-9, 0, 9, 0, 7, -9, -6, -11], shade(WOODC, 0.1), { ow: 1.8, hl: 0.2 });
  ball(c, 0, -6.5, 2.6, 2.6, 0x3a3e44, { ow: 1.2, hl: 0.4 });
  rivet(c, -5, -3); rivet(c, 5, -3);
}
/** The barrel, drawn with its bore along +x (the rig tilts it up). */
function mortarBarrel(c: Ctx): void {
  blob(c, [-9, -7, 2, -8.5, 9, -7.6, 10, 0, 9, 7.6, 2, 8.5, -9, 7, -11, 0], 0x50545c, { ow: 2, hl: 0.3 });
  for (const x of [-4, 3.4]) rbox(c, x - 1.3, -8.4, 2.6, 16.8, 1.2, 0x3a3e44, { ow: 1.2, hl: 0.25 });
  c.ellipse(10, 0, 3, 7.4); fill(c, 0x5e626a); c.ellipse(10, 0, 3, 7.4); outline(c, 1.8);
  c.ellipse(10.6, 0, 1.6, 5.2); fill(c, 0x14100c);
  gloss(c, -2, -5, 6, 1.2, 0.35);
  c.circle(-8, -5.6, 1.1); fill(c, 0x1a1410); // touch-hole
}
function mortarWedge(c: Ctx): void { poly(c, [-6, 0, 6, 0, 6, -4], 0x7a5230, { ow: 1.4, hl: 0 }); }

const MORTAR: Family = {
  base: 1, height: 30, shadow: 44, atkDur: 0.5,
  parts: () => [P('sled', mortarSled), P('wedge', mortarWedge), P('cheek', mortarCheek), P('barrel', mortarBarrel)],
  rig: (p) => {
    // the barrel sits in the cheeks: drawn first, so the wooden bed covers its lower half
    const root = p.add(null, null, 0, 0);
    const sled = p.add('sled', root); const wedge = p.add('wedge', root, 4, -7);
    const barrel = p.add('barrel', root, -1, -15); const cheek = p.add('cheek', root, -1, -7);
    return { root, sled, wedge, cheek, barrel };
  },
  pose: (n, s) => {
    const { strike } = atkCurve(s.atk, 0.08, 0.2);
    const kick = s.atk >= 0 ? Math.exp(-s.atk * 5) * Math.min(1, s.atk * 12) : 0;
    n.root.set(-2.5 * kick, 0, 0);
    n.barrel.set(-1 - 1.5 * kick, -15 + 1.2 * kick, -0.82 + 0.12 * kick - 0.02 * strike);
    n.barrel.c.scale.set(1 - 0.06 * kick, 1 + 0.05 * kick);
    n.sled.c.scale.y = 1 - 0.06 * kick;
  },
};

// ─────────────────────────── ranger M1: companions ───────────────────────────
// Badger Sett (burrows: a travelling mound while it moves, bursts up to attack) and Heron (a wading bird that spears).

const BADGER_COL: C = { body: 0x8e8c88, accent: 0xf0ece4, eye: 0x1a1410 };
function badgerBody(c: Ctx, col: C): void {
  const pts = [-15, -3, -11, -9, 0, -11, 11, -9, 15, -3, 11, 2, 0, 3, -12, 2];
  blob(c, pts, col.body, { hl: 0.15 });
  wash(c, (k) => blobPath(k, [-13, 0, -2, -1, 12, -1, 10, 2.4, 0, 3, -11, 2]), 0x2e2a26, 0.85);
  for (const x of [-8, -3, 2, 7]) crease(c, [x, -9.4, x + 1.6, -6.4], 0.9, light(col.body, 0.35), 0.7);
  blobPath(c, pts); outline(c);
}
function badgerHead(c: Ctx, col: C): void {
  ball(c, -2, -3.4, 2.2, 2, 0x2e2a26, { ow: 1.6, hl: 0 }); // ear
  blob(c, [-4, -5, 4, -6, 11, -2, 13, 0.6, 9, 2.6, -1, 3, -5, 1], col.accent, { hl: 0.2 });
  wash(c, (k) => blobPath(k, [-3, -4.6, 3, -4.6, 9, -1.8, 9, -0.6, 2.4, -2.4, -3, -2.2]), 0x1c1814, 0.95); // eye stripe
  wash(c, (k) => blobPath(k, [-4, -1, 2, 0, 8, 1.6, 6, 2.6, -1, 2.6, -4.6, 1]), 0x1c1814, 0.9);
  ball(c, 12.6, 0.2, 1.6, 1.3, 0x1a1410, { ow: 0.8, hl: 0.4 });
  eye(c, 5.2, -2.2, 1, 1.2, col.eye, true);
}
function badgerLeg(c: Ctx, back: boolean): void {
  rbox(c, -2.2, -1, 4.4, 7, 2, back ? 0x24201c : 0x34302a, { ow: 1.8, hl: 0 });
  for (const x of [-1.6, 0, 1.6]) seg(c, x, 6, x + 1.2, 7.6, 0.7, 0xd8d0c0, 0.5, false);
}
function badgerTail(c: Ctx, col: C): void { blob(c, [0, 0, -5, -2, -7, 0, -4, 2], shade(col.body, 0.1), { hl: 0.1 }); }
function earthMound(c: Ctx): void {
  blob(c, [-17, 2, -11, -6, -2, -9, 9, -7, 17, 2, 6, 4, -6, 4], 0x6a5038, { hl: 0.2 });
  wash(c, (k) => blobPath(k, [-10, -4, -2, -7, 6, -5, 2, -2, -6, -1]), 0x8a6f4d, 0.7);
  for (const [x, y] of [[-12, 1], [10, 0], [3, -6], [-4, 2]] as const) ball(c, x, y, 1.6, 1.2, 0x9a8a74, { ow: 0.9, hl: 0.3 });
}
const BADGER: Family = {
  base: 1, height: 22, shadow: 38, atkDur: 0.45,
  parts: (col) => [P('legFB', (c) => badgerLeg(c, true)), P('legBB', (c) => badgerLeg(c, true)), P('tail', (c) => badgerTail(c, col)), P('body', (c) => badgerBody(c, col)),
    P('legFF', (c) => badgerLeg(c, false)), P('legBF', (c) => badgerLeg(c, false)), P('head', (c) => badgerHead(c, col)), P('mound', earthMound)],
  rig: (p) => {
    const legFB = p.add('legFB', null, 9, -6); const legBB = p.add('legBB', null, -9, -6);
    const body = p.add(null, null, 0, -6);
    const tail = p.add('tail', body, -14, -4); const b = p.add('body', body);
    const legFF = p.add('legFF', null, 11, -6); const legBF = p.add('legBF', null, -7, -6);
    const head = p.add('head', body, 12, -5);
    const mound = p.add('mound', null, 2, -1);
    return { legFB, legBB, body, tail, b, legFF, legBF, head, mound };
  },
  setup: (p, n, view) => {
    // clods kicked back off the travelling mound (baked dot sprites; transforms only)
    const dirt = new Container();
    for (let i = 0; i < 5; i++) { const d = new Sprite(fx().dot); d.anchor.set(0.5); d.tint = SOIL_TINTS[i % 3]; d.scale.set(0.32); dirt.addChild(d); }
    p.attach(dirt, n.mound);
    view.extra.dirt = dirt;
  },
  pose: (n, s, v) => {
    const { wind, strike } = atkCurve(s.atk, 0.25, 0.45);
    // moving = burrowing: the badger sinks into a travelling mound of earth; bursting up to attack lifts it clear
    const burrow = clamp(s.move * 1.5 - 0.3) * (1 - clamp(strike * 2));
    const w = s.walk * 1.6;
    const m = s.move * (1 - burrow);
    n.legFF.rot = Math.sin(w) * 0.7 * m; n.legBB.rot = Math.sin(w) * 0.7 * m;
    n.legFB.rot = -Math.sin(w) * 0.7 * m; n.legBF.rot = -Math.sin(w) * 0.7 * m;
    const sink = burrow * 10;
    n.body.set(strike * 3 - wind * 2, -6 + sink - strike * 9 - Math.abs(Math.sin(w)) * 0.8 * m, -wind * 0.1 + strike * 0.22 + Math.sin(s.walk * 0.8) * 0.04 * burrow);
    n.head.set(12 + strike * 2, -5 - wind, Math.sin(s.t * 1.6) * 0.05 + strike * 0.25 - wind * 0.2);
    n.tail.rot = Math.sin(s.t * (m > 0.2 ? 12 : 4)) * 0.2;
    for (const k of ['legFF', 'legBB', 'legFB', 'legBF'] as const) n[k].c.alpha = 1 - burrow;
    n.mound.c.alpha = burrow;
    n.mound.c.scale.set(0.8 + 0.25 * burrow + Math.sin(s.walk * 2) * 0.05 * burrow, 0.8 + 0.3 * burrow);
    const dirt = v.extra.dirt;
    if (dirt) dirt.children.forEach((d, i) => {
      const ph = (s.t * 2.6 + i / 5) % 1;
      d.position.set(-10 - ph * 16 + i * 1.5, -5 - Math.sin(ph * Math.PI) * 11);
      d.alpha = burrow * (1 - ph);
    });
  },
};
const SOIL_TINTS = [0x6a5038, 0x8a6f4d, 0x4f3a28];

const HERON_COL: C = { body: 0x9aa6b2, accent: 0xeef1f3, eye: 0xf2c84a };
function heronLeg(c: Ctx, back: boolean): void {
  const col = back ? shade(0xc89a5a, 0.25) : 0xc89a5a;
  line(c, (k) => k.moveTo(0, 0).lineTo(1.6, 12).lineTo(-0.6, 25), 1.6, col, 1.2, false);
  line(c, (k) => k.moveTo(-0.6, 25).lineTo(4.4, 26).moveTo(-0.6, 25).lineTo(-4.6, 26.2), 1, col, 1, false);
}
function heronBody(c: Ctx, col: C): void {
  poly(c, [-10, -2, -19, 3, -17, 5, -9, 3], shade(col.body, 0.2), { ow: 1.8 }); // drooping tail
  blob(c, [-12, -1, -4, -7, 6, -7.6, 11, -4, 9, 1.6, -2, 3.2], col.body, { hl: 0.25 });
  wash(c, (k) => blobPath(k, [-11, 0.6, -2, -2.4, 7, -2, 8, 1.4, -2, 3]), light(col.body, 0.25), 0.6);
  crease(c, [-8, -3, 0, -5, 7, -4.2], 1.1, shade(col.body, 0.45), 0.8);
  crease(c, [-9, -1, -1, -2.6, 6, -2], 0.9, 0x2a2e34, 0.55);
}
/** The neck, an S-curve from the shoulders (0, 0) up to the head (8, -22). */
function heronNeck(c: Ctx, col: C): void {
  line(c, (k) => k.moveTo(0, 0).bezierCurveTo(7, -4, -3, -12, 3, -17).quadraticCurveTo(6, -21, 8, -22), 3.6, col.accent, 1.8);
  crease(c, [2, -6, 1, -11, 3.6, -16], 0.9, 0x34383e, 0.7);
}
function heronHead(c: Ctx, col: C): void {
  line(c, (k) => k.moveTo(-2, -1.4).quadraticCurveTo(-7, -2.4, -11, -0.6), 1.2, 0x1c1c22, 0.8, false); // crest plume
  ball(c, 0, 0, 3.6, 3, col.accent, { ow: 1.6, hl: 0.3 });
  wash(c, (k) => k.ellipse(-0.6, -1.6, 3.2, 1.1), 0x1c1c22, 0.85);
  poly(c, [2.6, -1.2, 15, 0.2, 2.6, 1.4], 0xe0a840, { ow: 1.2, flat: true });
  crease(c, [3, 0.1, 14, 0.2], 0.6, shade(0xe0a840, 0.4), 0.8);
  eye(c, 1, -0.5, 0.8, 0.9, col.eye, false);
}
const HERON: Family = {
  base: 1, height: 52, shadow: 26, atkDur: 0.38,
  parts: (col) => [P('legB', (c) => heronLeg(c, true)), P('body', (c) => heronBody(c, col)), P('legF', (c) => heronLeg(c, false)), P('neck', (c) => heronNeck(c, col)), P('head', (c) => heronHead(c, col))],
  rig: (p) => {
    const legB = p.add('legB', null, -1.5, -26); const body = p.add(null, null, 0, -29);
    const b = p.add('body', body); const legF = p.add('legF', null, 1.5, -26);
    const neck = p.add('neck', body, 8, -5); const head = p.add('head', neck, 8, -22);
    return { legB, body, b, legF, neck, head };
  },
  pose: (n, s) => {
    const { wind, strike } = atkCurve(s.atk, 0.35, 0.5);
    const w = s.walk * 0.9;
    // slow high-stepping wade; at rest a patient sway with the neck drawn back, then a dagger thrust
    n.legF.rot = Math.sin(w) * 0.45 * s.move; n.legB.rot = -Math.sin(w) * 0.45 * s.move;
    n.body.set(strike * 2 - wind, -29 - Math.abs(Math.sin(w)) * 1.2 * s.move, 0.05 + strike * 0.12 - wind * 0.06);
    n.neck.set(8, -5, -0.12 * wind + 0.62 * strike + Math.sin(s.t * 1.3) * 0.03);
    n.neck.c.scale.set(1 + 0.18 * strike, 1 - 0.2 * wind + 0.12 * strike);
    n.head.set(8, -22, 0.1 * wind + 0.25 * strike + Math.sin(s.t * 0.9) * 0.05);
  },
};

// ─────────────────────────── ranger M1: Murmuration ───────────────────────────
// R12: "thousands of tiny dark birds in a shimmering ribbon that folds and stretches". Built like a real starling
// murmuration: a dense band whose dark "waves" are birds banking together (seen edge-on they thin and lighten, broadside
// they darken). One ParticleContainer per flock (one draw call); only transforms / tints change per frame. Bird count
// follows the flock radius (desc.r, redrawn on setRadius) and the Graphics → effects density preset.

let birdFrames: [Texture, Texture] | null = null;
function birdTextures(): [Texture, Texture] {
  if (birdFrames) return birdFrames;
  const RES = 3, W = 16, H = 10;
  const cv = document.createElement('canvas');
  cv.width = W * 2 * RES; cv.height = H * RES;
  const g = cv.getContext('2d')!;
  g.scale(RES, RES); g.fillStyle = '#fff';
  // spread
  g.beginPath(); g.moveTo(8, 4); g.quadraticCurveTo(4.6, 2.4, 0.6, 3.6); g.quadraticCurveTo(4.4, 4.8, 6.4, 6); g.lineTo(7.2, 8.4); g.lineTo(8, 7.4);
  g.lineTo(8.8, 8.4); g.lineTo(9.6, 6); g.quadraticCurveTo(11.6, 4.8, 15.4, 3.6); g.quadraticCurveTo(11.4, 2.4, 8, 4); g.closePath(); g.fill();
  // raised
  g.translate(W, 0);
  g.beginPath(); g.moveTo(8, 5.6); g.quadraticCurveTo(5.4, 3, 2.4, 0.6); g.quadraticCurveTo(4.4, 4.4, 6.4, 6.6); g.lineTo(7.2, 9.4); g.lineTo(8, 8.4);
  g.lineTo(8.8, 9.4); g.lineTo(9.6, 6.6); g.quadraticCurveTo(11.6, 4.4, 13.6, 0.6); g.quadraticCurveTo(10.6, 3, 8, 5.6); g.closePath(); g.fill();
  const src = new CanvasSource({ resource: cv, resolution: RES, scaleMode: 'linear', autoGenerateMipmaps: true, label: 'summon-birds' });
  birdFrames = [new Texture({ source: src, frame: new Rectangle(0, 0, W, H) }), new Texture({ source: src, frame: new Rectangle(W, 0, W, H) })];
  return birdFrames;
}

interface Bird { p: Particle; u: number; du: number; v1: number; v2: number; ph: number; sz: number; back?: Particle }

const DARK = [0x16161c, 0x1d1d25], PALE = 0x50545f;

class FlockView implements EntityView {
  readonly root = new Container();
  height: number;
  private pc: ParticleContainer;
  private backPc: ParticleContainer | null = null;
  private birds: Bird[] = [];
  private mass: Sprite[] = [];
  private shadow: Sprite;
  private t = Math.random() * 10;
  private alpha = 0;
  private grow = 0;
  private dying = false;
  private dT = 0;
  private done: (() => void) | null = null;
  private destroyed = false;
  private flutter = 0.6;

  constructor(private r: number, private guard: boolean) {
    this.shadow = new Sprite(fx().shadow);
    this.shadow.anchor.set(0.5);
    this.shadow.alpha = 0;
    this.pc = new ParticleContainer({ dynamicProperties: { vertex: true, position: true, rotation: true, uvs: false, color: true } });
    this.root.addChild(this.shadow);
    // the dense core of the ribbon: a few soft dark puffs under the birds (baked texture; transforms only)
    if (!guard) for (let i = 0; i < 7; i++) { const m = new Sprite(fx().smoke); m.anchor.set(0.5); m.tint = 0x14141a; m.alpha = 0; this.mass.push(m); this.root.addChild(m); }
    this.root.addChild(this.pc);
    if (guard) this.backPc = new ParticleContainer({ dynamicProperties: { vertex: true, position: true, rotation: true, uvs: false, color: true } });
    this.height = guard ? 60 : 90 + r * 0.3;
    this.ensure();
  }

  setRadius(r: number): void {
    if (!(r > 0) || Math.abs(r - this.r) < 0.5) return;
    this.r = r;
    this.height = this.guard ? 60 : 90 + r * 0.3;
    this.ensure();
  }

  private want(): number {
    const k = effectsFactor();
    return Math.max(this.guard ? 30 : 90, Math.round((this.guard ? clamp(this.r * 1.6, 40, 120) : clamp(this.r * 5, 160, 900)) * k));
  }

  private ensure(): void {
    const [tex] = birdTextures();
    const n = this.want();
    while (this.birds.length < n) {
      const mk = () => { const p = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5 }); p.tint = DARK[0]; return p; };
      // cross-section offsets fill a disc (sqrt for even density); a few loose stragglers ride outside it
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * (Math.random() < 0.08 ? 1.6 : 1);
      const b: Bird = { p: mk(), u: Math.random(), du: (Math.random() - 0.5) * 0.06, v1: Math.cos(a) * d, v2: Math.sin(a) * d, ph: Math.random() * TAU, sz: 10.5 + Math.random() * 4.5 };
      this.pc.addParticle(b.p);
      if (this.backPc) { b.back = mk(); this.backPc.addParticle(b.back); }
      this.birds.push(b);
    }
    while (this.birds.length > n) {
      const b = this.birds.pop()!;
      this.pc.removeParticle(b.p);
      if (b.back && this.backPc) this.backPc.removeParticle(b.back);
    }
  }

  update(dt: number, s: ViewState): void {
    if (this.destroyed) return;
    this.t += dt;
    const t = this.t, r = this.r;
    this.alpha = Math.min(1, this.alpha + dt * 2.5);
    this.grow = Math.min(1, this.grow + dt * 1.6);
    let a = this.alpha;
    let finish: (() => void) | null = null;
    let scatter = 0;
    if (this.dying) { this.dT += dt; scatter = clamp(this.dT / 0.7); a *= 1 - scatter; if (this.dT > 0.72 && this.done) { finish = this.done; this.done = null; } }
    const [fa, fb] = birdTextures();
    const g = 0.25 + 0.75 * (1 - (1 - this.grow) * (1 - this.grow));
    if (this.guard) this.poseGuard(dt, s, a, g, scatter, fa, fb);
    else this.poseFlock(dt, a, g, scatter, fa, fb, r);
    // the flock flies above everything inside it; flutter now and then (positional)
    this.root.zIndex = s.y + (this.guard ? 1 : r * 0.8);
    if (!this.dying && (this.flutter -= dt) <= 0) { this.flutter = this.guard ? 2.4 : 1.6; sfx.play('flock_flutter', { x: s.x, y: s.y, vol: this.guard ? 0.25 : 0.45 }); }
    if (finish) finish();
  }

  private poseFlock(dt: number, a: number, g: number, scatter: number, fa: Texture, fb: Texture, r: number): void {
    const t = this.t;
    // the ribbon's long axis swings but stays mostly across the screen, so the fold reads from the 3/4 camera
    const th = 0.35 * Math.sin(t * 0.23) + 0.15 * Math.sin(t * 0.11 + 1);
    const cs = Math.cos(th), sn = Math.sin(th);
    const L = r * 0.85 * (0.8 + 0.2 * Math.sin(t * 0.41)) * g;
    const H0 = 64 + r * 0.22;
    // ribbon centre line and thickness at w ∈ [-1, 1]
    const C = { x: 0, y: 0, z: 0, th: 0 };
    const centre = (w: number) => {
      const along = w * L;
      const side = r * 0.34 * Math.sin(w * 2.2 + t * 0.7) * g;
      C.x = along * cs - side * sn; C.y = (along * sn + side * cs) * 0.6;
      C.z = H0 + r * 0.22 * Math.sin(w * 1.7 - t * 0.9 + 1) * g;
      C.th = r * (0.14 + 0.26 * (1 - w * w)) * (0.75 + 0.25 * Math.sin(t * 1.3 + w * 3)) * g;
    };
    let mx = 0, my = 0;
    for (const b of this.birds) {
      b.u += b.du * dt;
      if (b.u > 1) { b.u = 1; b.du = -Math.abs(b.du); } else if (b.u < 0) { b.u = 0; b.du = Math.abs(b.du); }
      const w = (b.u - 0.5) * 2;
      centre(w);
      let gx = C.x + b.v1 * C.th + Math.sin(t * 3 + b.ph) * 2;
      let gy = C.y + b.v1 * C.th * 0.35;
      let z = C.z + b.v2 * C.th * 0.8 + Math.cos(t * 2.6 + b.ph) * 1.5;
      if (scatter > 0) { const k = scatter * scatter * 160; gx += Math.cos(b.ph) * k; gy += Math.sin(b.ph) * k * 0.5; z += k * 0.6; }
      mx += gx; my += gy;
      // shimmer: a band of birds banking together runs along the ribbon
      const bank = 0.5 + 0.5 * Math.sin(w * 5.2 - t * 3.1 + b.v1 * 0.9);
      const p = b.p;
      // wingbeat as a fast squash of the silhouette (texture fixed: the uvs stay static, less to upload)
      p.x = gx; p.y = gy - z;
      const k = b.sz / 16;
      p.scaleX = k * (0.5 + 0.5 * bank); p.scaleY = k * (0.8 + 0.2 * bank) * (0.62 + 0.38 * Math.abs(Math.sin(t * 22 + b.ph)));
      p.rotation = Math.sin(t * 1.7 + b.ph) * 0.35 + th * 0.2;
      p.tint = lerpCol(DARK[b.sz > 12.8 ? 1 : 0], PALE, (1 - bank) * 0.45);
      p.alpha = a;
    }
    for (let i = 0; i < this.mass.length; i++) {
      const w = -0.85 + (1.7 * i) / Math.max(1, this.mass.length - 1);
      centre(w);
      const m = this.mass[i];
      m.position.set(C.x, C.y - C.z);
      m.width = C.th * 3.8; m.height = C.th * 2.7;
      m.alpha = 0.42 * a * (1 - scatter);
    }
    const n = this.birds.length || 1;
    this.shadow.position.set(mx / n, my / n);
    this.shadow.width = r * 2.1 * g; this.shadow.height = r * 0.8 * g; this.shadow.alpha = 0.22 * a;
  }

  /** Starling Shield: a smaller ring of birds circling the hero; the far half is drawn behind them. */
  private poseGuard(dt: number, s: ViewState, a: number, g: number, scatter: number, fa: Texture, fb: Texture): void {
    const t = this.t, r = this.r * g;
    const back = this.backPc!;
    if (back.parent !== this.root.parent && this.root.parent) this.root.parent.addChild(back);
    back.position.copyFrom(this.root.position);
    back.zIndex = s.y - 2;
    back.visible = this.root.visible;
    for (const b of this.birds) {
      const band = b.v1 > 0 ? 1 : -1;
      const phi = b.u * TAU + t * (1.7 + 0.25 * band) * band;
      const R = r * (0.8 + 0.18 * Math.sin(phi * 3 + t + b.ph) + Math.abs(b.v2) * 0.12) + scatter * scatter * 120;
      const gx = Math.cos(phi) * R, gy = Math.sin(phi) * R * 0.5;
      const z = 30 + 12 * Math.sin(phi * 2 + t * 2) + b.v2 * 9 + scatter * 40;
      const front = Math.sin(phi) >= 0;
      const p = front ? b.p : b.back!, q = front ? b.back! : b.p;
      q.alpha = 0;
      const bank = 0.5 + 0.5 * Math.sin(phi * 4 - t * 3);
      // wingbeat squash (static uvs)
      p.x = gx; p.y = gy - z;
      const k = b.sz / 16;
      p.scaleX = k * (0.4 + 0.6 * bank) * (Math.cos(phi) > 0 ? 1 : -1); p.scaleY = k * (0.62 + 0.38 * Math.abs(Math.sin(t * 24 + b.ph)));
      p.rotation = -Math.cos(phi) * 0.3;
      p.tint = lerpCol(DARK[0], PALE, (1 - bank) * 0.55 + (front ? 0 : 0.15));
      p.alpha = a * (front ? 1 : 0.8);
    }
    this.shadow.position.set(0, 0);
    this.shadow.width = r * 2.2; this.shadow.height = r * 0.9; this.shadow.alpha = 0.1 * a;
    void dt;
  }

  hit(): void { /* a flock does not flinch */ }
  die(_e: number, done: () => void): void { if (this.dying || this.destroyed) return; this.dying = true; this.done = done; }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true; this.done = null;
    this.backPc?.destroy();
    this.root.destroy({ children: true });
  }
}

function lerpCol(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  return (((ar + (((b >> 16) & 255) - ar) * t) | 0) << 16) | (((ag + (((b >> 8) & 255) - ag) * t) | 0) << 8) | ((ab + ((b & 255) - ab) * t) | 0);
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

const KIN = kinFamily(false), FROSTKIN = kinFamily(true);
const RIGS: Record<string, { fam: Family; col: C; scale?: number }> = {
  sentry: { fam: SENTRY, col: { body: WOODC, accent: BRASS, eye: 0 } },
  hydra: { fam: HYDRA, col: HYDRA_COL },
  wolf: { fam: WOLF, col: WOLF_COL },
  bat: { fam: BAT, col: BAT_COL },
  raven: { fam: RAVEN, col: RAVEN_COL },
  // ranger M1 (docs/rework/depth/RANGER.md §3–§4)
  snare: { fam: SNARE, col: { body: IRON, accent: ROPE, eye: 0 }, scale: 1.35 },
  mortar: { fam: MORTAR, col: { body: 0x50545c, accent: WOODC, eye: 0 }, scale: 1.3 },
  badger: { fam: BADGER, col: BADGER_COL, scale: 1.25 },
  heron: { fam: HERON, col: HERON_COL, scale: 1.12 },
  cinderkin: { fam: KIN, col: KIN_COL },
  frostkin: { fam: FROSTKIN, col: FROSTKIN_COL },
  ember_sprite: { fam: EMBER_SPRITE, col: SPRITE_COL },
};
/** Summons whose replicated radius selects a big variant (Cinderkin · Bonfire Kin: radius 36 instead of 14). */
const BIG: Record<string, { minRadius: number; scale: number }> = {
  cinderkin: { minRadius: 28, scale: 2.1 },
  frostkin: { minRadius: 28, scale: 2.1 },
};

/** Default flock radius (RANGER.md R12) when the description carries none. */
const FLOCK_R = 120, GUARD_R = 60;
/** The ranger's summons that play an action pose on their own shots (playAction); other classes' summons are unchanged. */
const ACTING_SUMMONS = new Set(['sentry', 'wolf', 'bat', 'raven', 'snare', 'mortar', 'flock', 'flock_guard', 'badger', 'heron']);

export class SummonArt implements ActingView {
  private inner: EntityView;
  /** Rigs that react to their own shots (the ranger's devices and beasts); other summons keep their look. */
  private acts: boolean;
  /** `radius`: the summon's replicated radius (EntDesc.r): sizes the flocks and picks the big variant where one exists. */
  constructor(type: string, radius = 0) {
    this.acts = ACTING_SUMMONS.has(type);
    const r = RIGS[type];
    const big = BIG[type] && radius >= BIG[type].minRadius ? BIG[type] : null;
    if (type === 'dust_devil') this.inner = new DustDevil();
    else if (type === 'flock' || type === 'flock_guard') this.inner = new FlockView(radius > 8 ? radius : type === 'flock' ? FLOCK_R : GUARD_R, type === 'flock_guard');
    else if (r) {
      const o = { key: big ? `summon:${type}:big` : `summon:${type}`, fam: r.fam, colors: r.col, scale: big ? big.scale : r.scale ?? 1, shadowAlpha: type === 'snare' ? 0.3 : 0.6 };
      this.inner = type === 'snare' ? new TrapArt(o) : new RigArt(o);
    } else this.inner = new OrbSummon(type.includes('molten') ? 0xff7a1a : 0x9fe3ff);
  }
  get root() { return this.inner.root; }
  get height() { return this.inner.height; }
  update(dt: number, s: ViewState): void { this.inner.update(dt, s); }
  hit(i: number, c: boolean): void { this.inner.hit(i, c); }
  die(e: number, done: () => void): void { this.inner.die(e, done); }
  destroy(): void { this.inner.destroy(); }
  /** Own shots (proj events, mortar_shot, sentry_flame): rigs aim at the target and recoil. */
  playAction(a: ActionSpec): void { if (this.acts) (this.inner as ActingView).playAction?.(a); }
  /** The entity was re-described (Murmuration's radius grows / shrinks). */
  setRadius(r: number): void { (this.inner as { setRadius?(r: number): void }).setRadius?.(r); }
  /** Spring Snare: the arming click (snare_arm) and the snap (snare_snap) reported by the VFX layer. */
  armed(): void { (this.inner as { armed?(): void }).armed?.(); }
  snapped(): void { (this.inner as { snapped?(): void }).snapped?.(); }
}

/** Summon rigs, for baking into the map's shared rig atlas. */
export function summonRigs(): { key: string; colors: C; fam: Family; scale: number }[] {
  const out = Object.entries(RIGS).map(([type, r]) => ({ key: `summon:${type}`, colors: r.col, fam: r.fam, scale: r.scale ?? 1 }));
  for (const [type, b] of Object.entries(BIG)) out.push({ key: `summon:${type}:big`, colors: RIGS[type].col, fam: RIGS[type].fam, scale: b.scale });
  return out;
}
