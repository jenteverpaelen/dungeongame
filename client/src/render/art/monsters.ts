// Monster families: quirky-cute but clearly hostile. Every family is a baked part sheet (normal + flash +
// rim silhouettes) on a small cut-out rig with its own animation personality. Elites get coloured rim
// glows, bosses are big and crowned. See docs/ART_DIRECTION.md §Monsters.

import { Container, Sprite } from 'pixi.js';
import { MONSTERS, ELITE_AFFIXES, RIFT_GUARDIANS, type MonsterDef } from '@shared/data/monsters';
import type { EliteTier } from '@shared/items';
import { F_ATTACK, F_BURN, F_CHILL, F_FROZEN, F_POISON, F_STUN, F_WINDUP } from '@shared/protocol';
import type { ActionSpec } from '../actions';
import type { ActingView, ViewState } from '../types';
import { SheetSlice, bakeSheet, type PartSpec, type Sheet, type SheetLike } from './bake';
import {
  OUT, ball, blob, blobPath, crease, eye, fill, flat, gem, gloss, line, outline, paint, poly, rbox, seg, spark, star, wash, type Ctx,
} from './draw';
import { fx, glowSprite, ringSprite, sparkleSprite } from './fx';
import { BONE, ELEMENT_COLORS, GOLD, RIM_BOSS, RIM_CHAMPION, RIM_RARE, WOOD_DARK } from './palette';
import { PNode, Puppet } from './puppet';
import { bakeRes } from './scale';
import { TAU, clamp, damp, easeIn, easeInOut, easeOut, easeOut3, lerp, light, mix, shade } from './util';

type Fam = MonsterDef['family'];
export type C = MonsterDef['colors'];

// ═══════════════════════════════ drawing per family ═══════════════════════════════

/** Grumpy-cute eyes: ovals with glints plus an optional angled brow. */
function meanEyes(c: Ctx, x0: number, x1: number, y: number, col: number, r = 1, brow = true, glow = false): void {
  const rx = 1.9 * r, ry = 2.8 * r;
  if (glow) {
    for (const x of [x0, x1]) { c.ellipse(x, y, rx * 1.15, ry * 1.05); fill(c, col); if (!paint.mode) c.circle(x + rx * 0.3, y - ry * 0.3, rx * 0.42).fill({ color: 0xffffff, alpha: 0.9 }); }
  } else { eye(c, x0, y, rx, ry, col); eye(c, x1, y, rx, ry, col); }
  if (brow) {
    line(c, (k) => k.moveTo(x0 - 2.6 * r, y - 4.4 * r).lineTo(x0 + 2 * r, y - 3.2 * r), 1.2 * r, OUT, 0, false);
    line(c, (k) => k.moveTo(x1 - 2 * r, y - 3.2 * r).lineTo(x1 + 2.8 * r, y - 4.6 * r), 1.2 * r, OUT, 0, false);
  }
}

function fang(c: Ctx, x: number, y: number, s = 1, col = 0xfffaf0): void {
  c.poly([x - 1.2 * s, y, x + 1.2 * s, y, x, y + 2.4 * s], true); fill(c, col);
  c.poly([x - 1.2 * s, y, x + 1.2 * s, y, x, y + 2.4 * s], true); outline(c, 0.9 * s);
}

// ── slime ──────────────────────────────
function slimeBody(c: Ctx, col: C, boss: boolean): void {
  const pts = [-21, 0, -22, -10, -16, -24, -4, -31, 9, -29, 19, -19, 22, -6, 20, 0];
  blob(c, pts, col.body, { hl: 0, inset: 0.86, sh: 0.32 });
  // belly light + inner bubbles
  wash(c, (k) => k.ellipse(3, -8, 14, 6.6), light(col.body, 0.35), 0.45);
  wash(c, (k) => k.circle(-9, -10, 3.2), col.accent, 0.55);
  wash(c, (k) => k.circle(-4, -5, 1.8), col.accent, 0.5);
  wash(c, (k) => k.circle(-12, -17, 1.5), light(col.body, 0.6), 0.6);
  gloss(c, -9, -22, 6.4, 3.2, 0.55);
  gloss(c, -2, -26.4, 2, 1.1, 0.7);
  blobPath(c, pts); outline(c);
  if (!boss) {
    // leaf sprout on top
    seg(c, 1, -30, 2.6, -35, 1.4, shade(col.accent, 0.1), 1.6, false);
    blob(c, [2.6, -35, 8, -40, 13, -38.6, 9, -34, 4, -33.4], light(col.accent, 0.15), { ow: 1.8 });
    crease(c, [3.6, -34.4, 10, -37.6], 0.8, shade(col.accent, 0.4), 0.8);
  }
}
function slimeFace(c: Ctx, col: C, boss: boolean): void {
  if (boss) {
    meanEyes(c, 4, 13, -18, col.eye, 1.15, true, true);
    // toothy maw
    const m = [-2, -9, 18.6, -10.4, 16, -3, 6, -1.6, -1, -4];
    c.poly(m, true); fill(c, 0x3a0d14);
    for (let i = 0; i < 5; i++) { const x = 0 + i * 3.8; fang(c, x, -9.6 - i * 0.2, 0.9); }
    wash(c, (k) => k.ellipse(9, -3.6, 5, 1.4), 0xd84a5a, 0.8);
    c.poly(m, true); outline(c, 1.8);
  } else {
    meanEyes(c, 6, 13.4, -16, col.eye, 0.95, false);
    c.moveTo(8, -10.4).quadraticCurveTo(10, -8.8, 12, -10.4); outline(c, 1.2);
    wash(c, (k) => k.ellipse(16.6, -11.6, 2.4, 1.2), 0xff8f7e, 0.45);
  }
}
function crown(c: Ctx): void {
  const pts = [-11, 0, -12.6, -11, -6.6, -5.4, 0, -14, 6.6, -5.4, 12.6, -11, 11, 0];
  poly(c, pts, GOLD, { hl: 0.35, px: -0.3 });
  c.rect(-11, -3, 22, 3); fill(c, shade(GOLD, 0.2));
  gem(c, 0, -2, 2, 0xd8364a, 1); gem(c, -7, -1.6, 1.4, 0x3d8bff, 0.9); gem(c, 7, -1.6, 1.4, 0x2ecc71, 0.9);
  for (const [x, y] of [[-12.6, -11], [0, -14], [12.6, -11]] as const) { c.circle(x, y, 1.6); fill(c, light(GOLD, 0.3)); c.circle(x, y, 1.6); outline(c, 1.1); }
}

// ── mushroom ──────────────────────────────
function shroomStem(c: Ctx, col: C): void {
  blob(c, [-9, -1, -10.6, -10, -8.4, -21, 0, -23, 8.6, -21, 10.8, -10, 9.4, -1, 0, 0.6], col.body, { hl: 0.2 });
  meanEyes(c, 2.6, 8.4, -12.4, col.eye, 0.85, true);
  c.moveTo(4, -7.6).quadraticCurveTo(5.6, -6.2, 7.4, -7.8); outline(c, 1.1);
  wash(c, (k) => k.ellipse(10.2, -8.8, 1.6, 1), 0xff8f7e, 0.5);
}
function shroomCap(c: Ctx, col: C): void {
  const pts = [-20, 0, -19, -9, -10, -18, 2, -20.6, 13, -16, 20.4, -6, 19, 0.6, 0, 2.4];
  blob(c, pts, col.accent, { hl: 0, sh: 0.34, inset: 0.86 });
  wash(c, (k) => k.ellipse(0, 1, 18, 2.6), shade(col.accent, 0.45), 0.9);
  for (const [x, y, r] of [[-11, -10, 3.4], [1, -14.4, 2.6], [10, -9, 3], [-2, -6, 2], [15, -3.4, 1.6], [-15, -3, 1.6]] as const) {
    c.ellipse(x, y, r, r * 0.8); fill(c, light(col.body, 0.2));
  }
  gloss(c, -6, -15, 5, 1.8, 0.4);
  blobPath(c, pts); outline(c);
}
function stubFoot(c: Ctx, col: number): void {
  blob(c, [-3.4, -4, 2, -4.6, 6, -2, 5.6, 0.6, -3.6, 0.6], col, { ow: 2, hl: 0.2 });
}

// ── bat ──────────────────────────────
function batBody(c: Ctx, col: C): void {
  // ears
  poly(c, [-6, -8, -9, -19, -1.6, -11], col.body, { ow: 2.2, hl: 0 });
  poly(c, [1, -10, 4.6, -20.6, 7.6, -9], col.body, { ow: 2.2, hl: 0 });
  c.poly([3.2, -11, 4.8, -17.4, 6, -10.6], true); fill(c, col.accent, 0.85);
  // fuzzy body
  const pts: number[] = [];
  for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; const r = i % 2 ? 10.6 : 11.6; pts.push(Math.cos(a) * r, -3 + Math.sin(a) * r * 0.92); }
  blob(c, pts, col.body, { hl: 0.1, inset: 0.85 });
  wash(c, (k) => k.ellipse(3, 1, 6.6, 5), light(col.body, 0.25), 0.55);
  meanEyes(c, 2.6, 8.6, -4.6, col.eye, 0.85, true, true);
  fang(c, 4.4, 1, 0.9); fang(c, 7.4, 0.6, 0.9);
  c.moveTo(3, 1).quadraticCurveTo(6, 2.4, 9, 0.6); outline(c, 1.1);
}
function batWing(c: Ctx, col: C, isBack: boolean): void {
  // pivot at the shoulder; the wing spreads up and back with a scalloped trailing edge
  const m = isBack ? shade(col.accent, 0.45) : shade(col.accent, 0.1);
  const b = isBack ? shade(col.body, 0.3) : col.body;
  const pts = [0, 0, -4, -9, -11, -16, -20, -17, -24, -12, -20.6, -9.6, -19, -5, -14.8, -5.6, -12.6, -1.4, -8, -2.6, -4, 2];
  c.poly(pts, true); fill(c, m);
  // arm bone along the leading edge + finger bones
  wash(c, (k) => k.poly([0, 0, -4, -9, -11, -16, -20, -17, -24, -12, -18, -13.6, -10, -12.4, -4, -5], true), b, 0.9);
  crease(c, [-11, -15, -20.6, -9.6], 1.1, shade(b, 0.2), 0.9);
  crease(c, [-11, -15, -14.8, -5.6], 1.1, shade(b, 0.2), 0.9);
  crease(c, [-11, -15, -8, -2.6], 1.1, shade(b, 0.2), 0.9);
  c.poly(pts, true); outline(c, 2);
  c.circle(-11, -15.6, 1.4); fill(c, b);
}

// ── sprout ──────────────────────────────
function sproutRoots(c: Ctx, col: C): void {
  const r = shade(col.body, 0.3);
  for (const [x, dx] of [[-5, -5], [0, 1], [5, 6]] as const) line(c, (k) => k.moveTo(x, -6).quadraticCurveTo(x + dx * 0.4, -1, x + dx, 0), 2.6, r, 1.8, false);
  ball(c, 0, -5, 7, 3.6, shade(col.body, 0.15), { ow: 2, hl: 0.15 });
}
function sproutStem(c: Ctx, col: C): void {
  line(c, (k) => k.moveTo(0, -4).quadraticCurveTo(-3, -12, 0, -20), 4.4, col.body, 2.2);
}
function sproutLeaf(c: Ctx, col: C, isBack: boolean): void {
  const g = isBack ? shade(col.body, 0.2) : light(col.body, 0.08);
  blob(c, [0, 0, 5, -4, 12, -4, 15, 0, 9, 2.6, 3, 2], g, { ow: 2, hl: 0.2 });
  crease(c, [1, 0, 13, -0.6], 0.9, shade(g, 0.4), 0.8);
}
function sproutHead(c: Ctx, col: C): void {
  // petals
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const x = Math.cos(a) * 9.4, y = Math.sin(a) * 9.4;
    ball(c, x, y, 5.4, 4.6, i % 2 ? col.accent : light(col.accent, 0.12), { ow: 2, hl: 0.18 });
  }
  ball(c, 0, 0, 9, 8.6, 0xf6d36a, { hl: 0.3 });
  meanEyes(c, 0.6, 6.4, -1.6, col.eye, 0.8, true);
}
function sproutMouth(c: Ctx): void {
  c.ellipse(0, 0, 2.2, 1.8); fill(c, 0x5a1a1a);
  c.ellipse(0, 0, 2.2, 1.8); outline(c, 1.1);
}

// ── golem ──────────────────────────────
function golemBody(c: Ctx, col: C): void {
  const pts = [-17, -4, -20, -18, -14, -32, 0, -37, 14, -33, 20, -20, 17, -5, 0, -1];
  blob(c, pts, col.body, { hl: 0.15, inset: 0.86, sh: 0.32 });
  crease(c, [-12, -12, -6, -20, -8, -27], 1.3, shade(col.body, 0.45), 0.8);
  crease(c, [8, -8, 12, -14], 1.2, shade(col.body, 0.45), 0.7);
  // face slit
  c.roundRect(3, -25, 15, 6.6, 3); fill(c, shade(col.body, 0.62));
  c.roundRect(3, -25, 15, 6.6, 3); outline(c, 1.6);
  for (const x of [8, 14]) { c.ellipse(x, -21.6, 1.8, 1.5); fill(c, col.eye); }
  // moss cap
  blob(c, [-16, -28, -9, -37, 3, -39.6, 14, -35, 17, -28, 9, -30, 1, -27.6, -7, -30], col.accent, { ow: 2.2, hl: 0.25 });
  for (const [x, y] of [[-10, -29], [-2, -28.4], [7, -30], [13, -29.6]] as const) { c.ellipse(x, y + 1.6, 2.2, 2.4); fill(c, col.accent); }
  // flower + tiny mushroom
  seg(c, -4, -38, -6, -44, 1, shade(col.accent, 0.2), 1.2, false);
  star(c, -6, -45, 5, 2.6, 1.2, 0xf6e27a, 1);
  rbox(c, 8, -42, 2, 4, 0.8, 0xf3e3c3, { ow: 1.2 });
  ball(c, 9, -42, 3.4, 2.2, 0xd8463a, { ow: 1.4, hl: 0.3 });
  blobPath(c, pts); outline(c, 2.6);
}
function golemArm(c: Ctx, col: C, isBack: boolean): void {
  const b = isBack ? shade(col.body, 0.2) : col.body;
  ball(c, 0, 3, 5.6, 7, b, { hl: 0.15 });
  blob(c, [-6.4, 9, 6, 8, 8.4, 15, 4, 20.6, -5.6, 20, -8, 14], b, { hl: 0.2, inset: 0.84 });
  crease(c, [-4, 15, 4, 15.6], 1.1, shade(b, 0.45), 0.8);
  if (!isBack) { c.ellipse(-1, 1, 3.6, 2); fill(c, col.accent); c.ellipse(-1, 1, 3.6, 2); outline(c, 1.2); }
}
function golemLeg(c: Ctx, col: C, isBack: boolean): void {
  const b = isBack ? shade(col.body, 0.22) : shade(col.body, 0.06);
  blob(c, [-6, -2, 5, -2.4, 7, 6, 8, 10.6, -6.6, 10.6, -7, 4], b, { hl: 0.15 });
}

// ── imp ──────────────────────────────
function impHead(c: Ctx, col: C, boss: boolean): void {
  const horn = boss ? 0x2a1a14 : shade(col.accent, -0.1);
  // horns (far, near)
  const hs = boss ? 1.35 : 1;
  const H = (pts: number[]) => pts.map((v) => v * hs);
  blob(c, H([-7, -7, -9, -13, -15, -17, -19, -16, -14, -13, -11, -6]), shade(horn, 0.25), { ow: 2 });
  blob(c, H([-1, -9, -1, -15, -5, -20, -9, -21, -6, -16, 4, -9]), light(horn, 0.12), { ow: 2, hl: 0.25 });
  crease(c, H([-2, -12, 2, -11]), 0.9, shade(horn, 0.5), 0.7);
  // ear
  poly(c, [-9, -2, -19, -7, -10, 2], col.body, { ow: 2, hl: 0 });
  ball(c, 1, -1, 11.6, 10.6, col.body, { hl: 0.22, inset: 0.88 });
  wash(c, (k) => k.ellipse(5, 3.4, 6, 3.6), light(col.body, 0.3), 0.4);
  meanEyes(c, 4, 10, -2, col.eye, 0.9, true, true);
  // grin
  c.moveTo(2, 4).quadraticCurveTo(7, 7.6, 11.6, 3.4); outline(c, 1.3);
  fang(c, 9.6, 4.6, 0.85);
  if (boss) wash(c, (k) => k.ellipse(1, -6, 9, 3), 0x000000, 0.12);
}
function impBody(c: Ctx, col: C): void {
  ball(c, 0, -7, 7.4, 8, col.body, { hl: 0.2 });
  wash(c, (k) => k.ellipse(2.4, -5, 4, 4.6), light(col.body, 0.3), 0.45);
  c.roundRect(-7, -4.4, 14.4, 3, 1.2); fill(c, col.accent);
  c.ellipse(0, -7, 7.4, 8); outline(c);
}
function impLimb(c: Ctx, col: C, isBack: boolean, arm: boolean): void {
  const b = isBack ? shade(col.body, 0.22) : col.body;
  if (arm) {
    rbox(c, -1.8, -1, 3.6, 8.6, 1.8, b, { ow: 2, hl: 0 });
    for (const dx of [-1.8, 0, 1.8]) poly(c, [dx - 1, 7, dx + 1, 7, dx + 0.4, 10.4], 0xf3ead8, { ow: 1.1 });
  } else {
    blob(c, [-2.4, -1, 2.6, -1, 3, 5, 5.6, 8.6, -2.6, 8.6, -2.8, 3], b, { ow: 2, hl: 0.1 });
    c.ellipse(2, 8, 3.6, 1.6); fill(c, shade(col.accent, 0.1));
  }
}
function impTail(c: Ctx, col: C): void {
  line(c, (k) => k.moveTo(0, 0).quadraticCurveTo(-10, 2, -13, -8).quadraticCurveTo(-14, -14, -10, -16), 2.2, col.body, 2, false);
  poly(c, [-10, -14, -13, -21, -6, -17.6], col.accent, { ow: 1.8 });
}
function impWing(c: Ctx, col: C): void {
  const m = shade(col.body, 0.35);
  const pts = [0, 0, -6, -10, -14, -12, -11, -7, -13, -3, -8, -2.4];
  c.poly(pts, true); fill(c, m);
  crease(c, [0, 0, -14, -12], 1, shade(m, 0.4), 0.9);
  c.poly(pts, true); outline(c, 2);
}
function impCape(c: Ctx, col: C): void {
  const cl = 0x2a0f12;
  const pts = [2, -14, -4, -15, -9, -6, -13, 4, -15, 12, -11, 10, -9, 14, -5, 10, -2, 13, 1, 8, 4, 2];
  c.poly(pts, true); fill(c, cl);
  wash(c, (k) => k.poly([-4, -15, -9, -6, -13, 4, -15, 12, -11, 10, -7, -2], true), shade(cl, 0.3), 0.8);
  crease(c, [-6, -8, -9, 8], 1, col.accent, 0.6);
  c.poly([-4, -15, 4, -15, 3, -12, -4, -12], true); fill(c, GOLD);
  c.poly(pts, true); outline(c);
}

function flameCrown(c: Ctx): void {
  const pts = [-10, 0, -11, -9, -6, -4, -3, -14, 1, -5, 5, -15, 7, -4, 11.6, -10, 10.4, 0];
  c.poly(pts, true); fill(c, 0xff7a1a);
  wash(c, (k) => k.poly([-7, 0, -6.6, -4, -3, -9, 1, -2, 5, -10, 7, -1, 8, 0], true), 0xffd23f, 0.95);
  c.poly(pts, true); outline(c, 2);
  c.rect(-10, -2, 20.4, 3.2); fill(c, 0x3a2418); c.rect(-10, -2, 20.4, 3.2); outline(c, 1.4);
}

// ── skeleton ──────────────────────────────
function skull(c: Ctx, col: C): void {
  ball(c, 0, -2, 11, 10.4, col.body, { hl: 0.28, inset: 0.9, sh: 0.22 });
  // jaw
  rbox(c, 1, 5, 11, 5.6, 2.4, shade(col.body, 0.08), { ow: 2.2, hl: 0 });
  for (let i = 0; i < 4; i++) { c.moveTo(3 + i * 2.4, 5.2).lineTo(3 + i * 2.4, 7.4); }
  outline(c, 0.9);
  // sockets
  c.ellipse(4, -1.6, 3, 3.4); fill(c, 0x241a1a);
  c.ellipse(10.4, -1.2, 2.6, 3.2); fill(c, 0x241a1a);
  if (!paint.mode) { c.circle(4.3, -1.4, 1.2).fill(col.eye); c.circle(10.6, -1, 1.1).fill(col.eye); }
  c.poly([7, 1.6, 8.2, 4, 6, 4], true); fill(c, 0x241a1a);
  crease(c, [-6, -8, -3, -4, -6, -1], 1, shade(col.body, 0.45), 0.7);
}
function ribs(c: Ctx, col: C): void {
  seg(c, 0, -1, 0, -15, 2.4, col.body, 1.8, false);
  for (let i = 0; i < 3; i++) {
    const y = -12.6 + i * 3.6;
    line(c, (k) => k.moveTo(-5.4 + i * 0.6, y + 1.2).quadraticCurveTo(0, y - 2, 6 - i * 0.6, y + 1.2), 1.6, col.body, 1.6, false);
  }
  ball(c, 0, -1, 5.4, 2.8, col.body, { ow: 2, hl: 0.1 });
  // rag
  poly(c, [-6, -3, 6, -3, 5, 3, 1, 1, -3, 4, -6, 2], col.accent, { ow: 1.8 });
}
function boneLimb(c: Ctx, col: C, isBack: boolean, arm: boolean): void {
  const b = isBack ? shade(col.body, 0.2) : col.body;
  seg(c, 0, 0, 0, arm ? 8.6 : 7.6, 1.8, b, 1.6, false);
  c.circle(0, 0, 1.8); fill(c, b); c.circle(0, 0, 1.8); outline(c, 1.4);
  if (arm) { ball(c, 0, 9.6, 2.2, 2.2, b, { ow: 1.6, hl: 0 }); }
  else { blob(c, [-2, 7, 2.6, 7, 5.6, 9, 5.4, 10.6, -2.4, 10.6], b, { ow: 1.8 }); }
}
function rustySword(c: Ctx, col: C): void {
  seg(c, 0, 3, 0, -2, 2.2, WOOD_DARK, 1.6);
  const blade = [-2.2, -3.4, 2.2, -3.4, 2.4, -18, 0, -22, -2, -17];
  poly(c, blade, mix(0x9aa0a6, col.accent, 0.5), { hl: 0 });
  wash(c, (k) => k.poly([-2, -12, -2.2, -6, 0, -8], true), 0x8a4a2a, 0.8);
  crease(c, [1, -6, 2, -9, 1.2, -12], 0.8, OUT, 0.6);
  c.poly(blade, true); outline(c, 2);
  rbox(c, -4.6, -4.6, 9.2, 2.4, 1, 0x6b5a48, { ow: 1.6, hl: 0 });
}

// ── cultist ──────────────────────────────
function cultRobe(c: Ctx, col: C): void {
  const pts = [-7, -24, 6, -24, 10, -10, 13, 0, 0, 1.6, -13, 0, -10, -10];
  blob(c, pts, col.body, { hl: 0.12, inset: 0.88 });
  wash(c, (k) => k.poly([-12.8, -2.6, 12.8, -2.6, 13, 0, 0, 1.6, -13, 0], true), col.accent, 0.95);
  crease(c, [1.6, -22, 3.6, -3], 1.6, col.accent, 0.95);
  crease(c, [-4, -16, -6, -4], 1, OUT, 0.3);
  // sigil
  if (!paint.mode) { c.circle(3.6, -14, 2.6).stroke({ width: 1, color: col.accent, alpha: 0.9 }); }
  blobPath(c, pts); outline(c);
}
function cultHood(c: Ctx, col: C): void {
  const pts = [-11, 6, -13, -6, -8, -15, 2, -17, 10, -12, 14, -2, 11, 7, 0, 9];
  blob(c, pts, shade(col.body, 0.08), { hl: 0.15 });
  // void face
  blob(c, [1, -8, 9, -9, 12.4, -1, 10, 6, 2, 6, -1, -1], 0x140a10, { ow: 1.6, hl: 0 });
  if (!paint.mode) {
    for (const x of [5, 9.4]) { c.ellipse(x, -1.6, 1.6, 1.1).fill(col.eye); }
  } else { c.ellipse(7, -1.6, 4, 1.4); fill(c, 0xffffff); }
  // tip flops back
  blob(c, [-8, -14, -17, -16, -21, -9, -15, -9, -11, -6], shade(col.body, 0.18), { ow: 2 });
  blobPath(c, pts); outline(c);
}
function cultArm(c: Ctx, col: C, isBack: boolean): void {
  const b = isBack ? shade(col.body, 0.25) : col.body;
  poly(c, [-2.6, -1.6, 2.6, -1.6, 4.4, 8, -3.4, 8], b, { ow: 2 });
  ball(c, 0.4, 9.2, 2.4, 2.4, 0x8a6a6a, { ow: 1.6, hl: 0 });
}
function cultStaff(c: Ctx, col: C): void {
  line(c, (k) => k.moveTo(0, 14).lineTo(0, -22), 2.2, 0x3a2620, 2);
  line(c, (k) => k.moveTo(0, -22).quadraticCurveTo(-6, -26, -4, -31).moveTo(0, -22).quadraticCurveTo(6, -26, 4, -31), 1.6, 0x3a2620, 1.8, false);
  ball(c, 0, -28, 3.2, 3.6, col.accent, { ow: 1.6, hl: 0.6 });
}

// ── brute ──────────────────────────────
function bruteBody(c: Ctx, col: C): void {
  const pts = [-18, -6, -21, -20, -13, -34, 4, -37, 17, -30, 21, -16, 16, -4, 0, -1];
  blob(c, pts, col.body, { hl: 0.12, inset: 0.86, sh: 0.35 });
  // head
  ball(c, 13, -22, 8.4, 7.6, shade(col.body, 0.06), { hl: 0.2 });
  meanEyes(c, 13, 18.4, -23.4, col.eye, 0.85, true, true);
  c.moveTo(13, -17).lineTo(19.6, -18); outline(c, 1.4);
  // crack lines (dark; the emissive copy glows on top)
  crease(c, [-14, -24, -8, -18, -10, -10, -4, -6], 1.6, 0x2a1410, 0.9);
  crease(c, [-4, -32, 0, -24, 6, -22], 1.6, 0x2a1410, 0.9);
  crease(c, [-16, -12, -11, -14], 1.4, 0x2a1410, 0.8);
  // shoulder rocks
  blob(c, [-14, -30, -8, -40, 2, -42, 6, -35, -2, -31], light(col.body, 0.08), { ow: 2.2, hl: 0.15 });
  blobPath(c, pts); outline(c, 2.6);
}
function bruteCracks(c: Ctx, col: C): void {
  const glow = col.accent;
  c.moveTo(-14, -24).lineTo(-8, -18).lineTo(-10, -10).lineTo(-4, -6);
  c.moveTo(-4, -32).lineTo(0, -24).lineTo(6, -22);
  c.moveTo(-16, -12).lineTo(-11, -14);
  c.stroke({ width: 2.2, color: glow, cap: 'round', join: 'round' });
  c.moveTo(-14, -24).lineTo(-8, -18).lineTo(-10, -10).lineTo(-4, -6);
  c.moveTo(-4, -32).lineTo(0, -24).lineTo(6, -22);
  c.stroke({ width: 0.9, color: 0xffe08a, cap: 'round', join: 'round' });
}
function bruteArm(c: Ctx, col: C, isBack: boolean): void {
  const b = isBack ? shade(col.body, 0.2) : col.body;
  blob(c, [-5, -2, 5, -3, 7, 9, 3, 13, -4, 12, -7, 6], b, { hl: 0.12 });
  blob(c, [-7, 11, 7, 10, 10, 18, 6, 24, -6, 24, -9, 18], light(b, 0.05), { hl: 0.18, inset: 0.84 });
  if (!isBack) { crease(c, [-4, 19, 5, 19.6], 1.6, col.accent, 0.95); }
}
function bruteLeg(c: Ctx, col: C, isBack: boolean): void {
  const b = isBack ? shade(col.body, 0.24) : shade(col.body, 0.08);
  blob(c, [-6.6, -2, 6, -2.4, 7.6, 6, 9, 10.6, -7, 10.6, -7.6, 4], b, { hl: 0.12 });
}

// ── wisp ──────────────────────────────
function wispBody(c: Ctx, col: C): void {
  const pts = [-11, -2, -10, -12, -5, -20, -9, -27, -2, -24, 0, -32, 4, -24, 9, -26, 7, -18, 11, -10, 10, -1, 0, 3];
  blob(c, pts, col.body, { hl: 0, inset: 0.84, sh: 0.2 });
  wash(c, (k) => blobPath(k, [-6, -2, -5, -10, 0, -16, 5, -10, 6, -2, 0, 1]), col.accent, 0.5);
  wash(c, (k) => k.ellipse(0, -6, 4, 4.6), 0xffffff, 0.55);
  c.ellipse(-0.6, -9, 2, 2.8); fill(c, col.eye); c.ellipse(5.4, -9, 2, 2.8); fill(c, col.eye);
  c.ellipse(2.4, -4.4, 1.6, 1.4); fill(c, col.eye);
  blobPath(c, pts); outline(c, 2.2);
}

// ── goblin ──────────────────────────────
function gobSack(c: Ctx, col: C): void {
  const pts = [-16, -4, -20, -18, -14, -32, -2, -35, 8, -28, 8, -14, 4, -3, -6, 0];
  blob(c, pts, 0x9a7448, { hl: 0.15, inset: 0.86, sh: 0.3 });
  crease(c, [-14, -24, -10, -12], 1.1, 0x5a3e22, 0.8);
  crease(c, [-4, -26, -6, -8], 1.1, 0x5a3e22, 0.7);
  // patches + coins spilling out the top
  rbox(c, -15, -16, 6, 5, 1, 0x7a5a38, { ow: 1.4, hl: 0 });
  for (const [x, y] of [[-10, -35], [-5, -37.6], [0, -35.4], [-7, -32], [3, -33], [-13, -32.6]] as const) {
    ball(c, x, y, 3, 2.4, col.accent, { ow: 1.4, hl: 0.4 });
  }
  line(c, (k) => k.moveTo(-15, -30).quadraticCurveTo(-4, -26, 6, -30), 1.6, 0xc9a46a, 1.4, false);
  blobPath(c, pts); outline(c, 2.4);
}
function gobBody(c: Ctx, col: C): void {
  ball(c, 0, -7, 7, 7.6, col.body, { hl: 0.15 });
  poly(c, [-7, -10, 7, -10, 8, -1, -8, -1], 0x6b4a2a, { ow: 2 });
  c.rect(-8, -4.6, 16, 2); fill(c, col.accent);
}
function gobHead(c: Ctx, col: C): void {
  // big ear
  poly(c, [-7, -4, -20, -10, -16, -3, -8, 2], col.body, { ow: 2, hl: 0 });
  c.poly([-9, -3, -17, -7.6, -14.6, -3.4, -9, 0], true); fill(c, shade(col.body, 0.3));
  ball(c, 1, -1, 10.4, 9.4, col.body, { hl: 0.2, inset: 0.88 });
  // nose
  ball(c, 12, 1, 4, 3.4, light(col.body, 0.08), { ow: 2, hl: 0.3 });
  meanEyes(c, 3.6, 8.6, -3, col.eye, 0.8, true, true);
  c.moveTo(3, 5).quadraticCurveTo(7, 8.4, 11, 5.4); outline(c, 1.3);
  fang(c, 5.2, 5.6, 0.8);
  // little cap
  blob(c, [-9, -6, -6, -12, 3, -12.6, 9, -8, 1, -6.6], 0x8a3a2a, { ow: 2, hl: 0.2 });
}
function gobLimb(c: Ctx, col: C, isBack: boolean, arm: boolean): void {
  const b = isBack ? shade(col.body, 0.22) : col.body;
  if (arm) { rbox(c, -1.6, -1, 3.2, 8, 1.6, b, { ow: 1.8, hl: 0 }); ball(c, 0, 8, 2.4, 2.4, b, { ow: 1.6, hl: 0 }); }
  else { rbox(c, -1.6, -1, 3.2, 7, 1.6, b, { ow: 1.8, hl: 0 }); blob(c, [-2.4, 6, 3, 5.6, 6, 8, 5.4, 9.6, -2.6, 9.6], 0x5a3e22, { ow: 1.8 }); }
}

// ═══════════════════════════════ family rigs ═══════════════════════════════

export interface MState {
  t: number; dt: number;
  move: number; walk: number;
  atk: number;      // -1 when no attack, else 0..1 progress
  wind: number;     // windup blend 0..1
  face: number;
}
export type Nodes = Record<string, PNode>;

export interface Family {
  /** Base drawing scale applied on top of the monster's scale (boss families are big). */
  base: number;
  height: number;
  shadow: number;
  fly?: number;
  atkDur: number;
  parts(col: C): PartSpec[];
  rig(p: Puppet): Nodes;
  pose(n: Nodes, s: MState, view: RigArt): void;
  /** Optional extra fx (sprites) created once after the rig. */
  setup?(p: Puppet, n: Nodes, view: RigArt): void;
  /** Hit reaction override (dummies wobble instead of squashing). */
  wobble?: boolean;
  /** Where the eyes are ([node, x, y]) — they glow during a wind-up. */
  eyes?: [string, number, number];
}

export const P = (name: string, draw: (c: Ctx) => void): PartSpec => ({ name, draw, flash: true, rim: true });

export function walkLegs(n: Nodes, s: MState, amp = 0.5): number {
  const sw = Math.sin(s.walk);
  if (n.legF) n.legF.rot = sw * amp * s.move;
  if (n.legB) n.legB.rot = -sw * amp * s.move;
  return sw;
}

/** Generic attack curve: anticipation (0..a), strike (a..b), recover. Returns [-1..1] style values. */
export function atkCurve(u: number, a = 0.4, b = 0.6): { wind: number; strike: number } {
  if (u < 0) return { wind: 0, strike: 0 };
  if (u < a) return { wind: easeOut(u / a), strike: 0 };
  if (u < b) { const e = easeIn((u - a) / (b - a)); return { wind: 1 - e, strike: e }; }
  return { wind: 0, strike: 1 - easeInOut((u - b) / (1 - b)) };
}

const FAMILIES: Record<Fam, Family> = {
  slime: {
    base: 1, height: 36, shadow: 44, atkDur: 0.6, eyes: ['face', 9.7, -16],
    parts: (col) => [P('body', (c) => slimeBody(c, col, false)), P('face', (c) => slimeFace(c, col, false))],
    rig: (p) => { const body = p.add('body'); const face = p.add('face', body); return { body, face }; },
    pose: (n, s) => {
      const hop = s.move > 0.05 ? Math.sin(s.walk) : 0;
      const air = Math.max(0, hop);
      let sx = 1 + Math.sin(s.t * 3.2) * 0.035, sy = 1 - Math.sin(s.t * 3.2) * 0.035;
      let y = -air * 9 * s.move, x = 0;
      if (s.move > 0.05) { const sq = Math.max(0, -hop); sy *= 1 - sq * 0.22 + air * 0.12; sx *= 1 + sq * 0.2 - air * 0.08; }
      const { wind, strike } = atkCurve(s.atk);
      const w = Math.max(wind, s.wind);
      sy *= 1 - w * 0.25; sx *= 1 + w * 0.2;
      sx *= 1 + strike * 0.28; sy *= 1 - strike * 0.1; x += strike * 7;
      n.body.set(x, y).scale(sx, sy);
    },
  },
  boss_slime: {
    base: 2.8, height: 46, shadow: 46, atkDur: 1.0, eyes: ['face', 8.5, -18],
    parts: (col) => [P('body', (c) => slimeBody(c, col, true)), P('face', (c) => slimeFace(c, col, true)), P('crown', crown)],
    rig: (p) => { const body = p.add('body'); const face = p.add('face', body); const cr = p.add('crown', body, 1, -29.6); cr.rot = 0.14; return { body, face, crown: cr }; },
    pose: (n, s) => {
      const hop = s.move > 0.05 ? Math.sin(s.walk * 0.7) : 0;
      const air = Math.max(0, hop);
      let sx = 1 + Math.sin(s.t * 2) * 0.03, sy = 1 - Math.sin(s.t * 2) * 0.03;
      const y = -air * 5 * s.move;
      if (s.move > 0.05) { const sq = Math.max(0, -hop); sy *= 1 - sq * 0.15; sx *= 1 + sq * 0.12; }
      const { wind, strike } = atkCurve(s.atk, 0.5, 0.62);
      const w = Math.max(wind, s.wind);
      sy *= 1 + w * 0.18 - strike * 0.3; sx *= 1 - w * 0.08 + strike * 0.25;
      n.body.set(0, y).scale(sx, sy);
      n.crown.set(1, -29.6 - w * 3 + strike * 2, 0.14 + Math.sin(s.t * 2) * 0.04 - strike * 0.2);
    },
  },
  mushroom: {
    base: 1, height: 40, shadow: 34, atkDur: 0.6, eyes: ['stem', 5.5, -12.4],
    parts: (col) => [P('stem', (c) => shroomStem(c, col)), P('cap', (c) => shroomCap(c, col)), P('footB', (c) => stubFoot(c, shade(col.body, 0.3))), P('footF', (c) => stubFoot(c, shade(col.body, 0.12)))],
    rig: (p) => {
      const footB = p.add('footB', null, -3, 0); const footF = p.add('footF', null, 3.4, 0);
      const body = p.add(null, null, 0, -2);
      const stem = p.add('stem', body); const cap = p.add('cap', body, 0, -18);
      return { footB, footF, body, stem, cap };
    },
    pose: (n, s) => {
      const sw = Math.sin(s.walk);
      n.footF.set(3.4 + sw * 3 * s.move, -Math.max(0, sw) * 2.4 * s.move);
      n.footB.set(-3 - sw * 3 * s.move, -Math.max(0, -sw) * 2.4 * s.move);
      const { wind, strike } = atkCurve(s.atk);
      const w = Math.max(wind, s.wind);
      const tilt = sw * 0.12 * s.move - w * 0.3 + strike * 0.45;
      n.body.set(strike * 4, -2 - Math.abs(sw) * 1.6 * s.move + Math.sin(s.t * 2.6) * 0.5, tilt);
      n.cap.set(0, -18 - Math.sin(s.t * 2.6 + 0.6) * 0.8, -tilt * 0.3 + strike * 0.2);
    },
  },
  bat: {
    base: 1, height: 52, shadow: 26, fly: 30, atkDur: 0.5, eyes: ['body', 5.6, -4.6],
    parts: (col) => [P('body', (c) => batBody(c, col)), P('wingB', (c) => batWing(c, col, true)), P('wingF', (c) => batWing(c, col, false))],
    rig: (p) => {
      const root = p.add(null, null, 0, -30);
      const wingB = p.add('wingB', root, 2, -6); const body = p.add('body', root); const wingF = p.add('wingF', root, -1, -4);
      return { root, wingB, body, wingF };
    },
    pose: (n, s) => {
      const flap = Math.sin(s.t * 18);
      const { wind, strike } = atkCurve(s.atk, 0.35, 0.55);
      const w = Math.max(wind, s.wind);
      n.root.set(strike * 12, -30 + Math.sin(s.t * 4) * 3 - w * 6 + strike * 14, -w * 0.25 + strike * 0.5);
      n.wingF.set(-1, -4, 0.35 - flap * 0.55);
      n.wingF.c.scale.y = 0.55 + 0.5 * (0.5 + 0.5 * flap);
      n.wingB.set(2, -6, 0.9 - flap * 0.45);
      n.wingB.c.scale.set(-0.85, 0.5 + 0.45 * (0.5 + 0.5 * flap));
    },
  },
  sprout: {
    base: 1, height: 40, shadow: 30, atkDur: 0.7, eyes: ['head', 3.5, -1.6],
    parts: (col) => [P('roots', (c) => sproutRoots(c, col)), P('stem', (c) => sproutStem(c, col)), P('leafB', (c) => sproutLeaf(c, col, true)), P('leafF', (c) => sproutLeaf(c, col, false)), P('head', (c) => sproutHead(c, col)), P('mouth', sproutMouth)],
    rig: (p) => {
      const roots = p.add('roots');
      const stem = p.add('stem', roots);
      const leafB = p.add('leafB', stem, -1, -11); const leafF = p.add('leafF', stem, 1, -9);
      const head = p.add('head', stem, 0, -27); const mouth = p.add('mouth', head, 4.8, 3.4);
      return { roots, stem, leafB, leafF, head, mouth };
    },
    pose: (n, s) => {
      const sw = Math.sin(s.walk);
      const { wind, strike } = atkCurve(s.atk, 0.45, 0.6);
      const w = Math.max(wind, s.wind);
      n.roots.set(0, -Math.abs(sw) * 2.4 * s.move, sw * 0.06 * s.move);
      n.stem.rot = Math.sin(s.t * 2.2) * 0.05 - w * 0.22 + strike * 0.28;
      n.head.set(-w * 3 + strike * 4, -27 + w * 1, Math.sin(s.t * 2.2 + 0.8) * 0.08 - w * 0.4 + strike * 0.35);
      n.head.scale(1 + strike * 0.12);
      n.mouth.scale(1 + strike * 0.9, 0.6 + strike * 1.1 + w * 0.2);
      n.leafF.rot = -0.3 + Math.sin(s.t * 3) * 0.12 + sw * 0.3 * s.move - w * 0.5;
      n.leafB.rot = 0.2 - Math.sin(s.t * 3) * 0.12 - sw * 0.3 * s.move;
      n.leafB.c.scale.x = -1;
    },
  },
  golem: {
    base: 1, height: 50, shadow: 44, atkDur: 0.9, eyes: ['b', 11, -21.6],
    parts: (col) => [P('legB', (c) => golemLeg(c, col, true)), P('legF', (c) => golemLeg(c, col, false)), P('armB', (c) => golemArm(c, col, true)), P('body', (c) => golemBody(c, col)), P('armF', (c) => golemArm(c, col, false))],
    rig: (p) => {
      const legB = p.add('legB', null, -6, -9); const legF = p.add('legF', null, 6, -9);
      const body = p.add(null, null, 0, -8);
      const armB = p.add('armB', body, -12, -24); const b = p.add('body', body, 0, 8); const armF = p.add('armF', body, 12, -24);
      return { legB, legF, body, b, armB, armF };
    },
    pose: (n, s) => {
      const sw = walkLegs(n, s, 0.32);
      const { wind, strike } = atkCurve(s.atk, 0.55, 0.68);
      const w = Math.max(wind, s.wind);
      n.body.set(0, -8 - Math.abs(sw) * 2 * s.move + Math.sin(s.t * 1.6) * 0.6 + strike * 3, sw * 0.05 * s.move - w * 0.12 + strike * 0.12);
      n.armF.rot = sw * 0.3 * s.move + Math.sin(s.t * 1.6) * 0.04 - w * 2.8 + strike * 1.5;
      n.armB.rot = -sw * 0.3 * s.move - w * 2.5 + strike * 1.2;
    },
  },
  imp: {
    base: 1, height: 42, shadow: 26, atkDur: 0.45, eyes: ['head', 7, -2],
    parts: (col) => [P('tail', (c) => impTail(c, col)), P('wing', (c) => impWing(c, col)), P('legB', (c) => impLimb(c, col, true, false)), P('legF', (c) => impLimb(c, col, false, false)), P('armB', (c) => impLimb(c, col, true, true)), P('body', (c) => impBody(c, col)), P('head', (c) => impHead(c, col, false)), P('armF', (c) => impLimb(c, col, false, true))],
    rig: (p) => {
      const legB = p.add('legB', null, -2.4, -8.6); const legF = p.add('legF', null, 2.4, -8.6);
      const body = p.add(null, null, 0, -8);
      const tail = p.add('tail', body, -5, -4); const wing = p.add('wing', body, -3, -12);
      const armB = p.add('armB', body, -2, -11); const b = p.add('body', body);
      const head = p.add('head', body, 1, -21); const armF = p.add('armF', body, 3, -11);
      return { legB, legF, body, tail, wing, armB, b, head, armF };
    },
    pose: (n, s) => {
      const sw = walkLegs(n, s, 0.6);
      const { wind, strike } = atkCurve(s.atk, 0.35, 0.55);
      const w = Math.max(wind, s.wind);
      const hop = Math.abs(sw) * 3.4 * s.move;
      n.body.set(strike * 4, -8 - hop + Math.sin(s.t * 3) * 0.6, 0.1 * s.move - w * 0.15 + strike * 0.25);
      n.head.rot = Math.sin(s.t * 2.4) * 0.05 + w * 0.08;
      n.tail.rot = Math.sin(s.t * 3.4) * 0.25;
      n.wing.rot = Math.sin(s.t * 9) * 0.3;
      n.armF.rot = -sw * 0.6 * s.move + w * 1.6 - strike * 2.4;
      n.armB.rot = sw * 0.6 * s.move + w * 0.8 - strike * 1.2;
    },
  },
  boss_imp: {
    base: 3.0, height: 42, shadow: 30, atkDur: 0.9, eyes: ['head', 7, -2],
    parts: (col) => [P('cape', (c) => impCape(c, col)), P('tail', (c) => impTail(c, col)), P('wing', (c) => impWing(c, col)), P('legB', (c) => impLimb(c, col, true, false)), P('legF', (c) => impLimb(c, col, false, false)), P('armB', (c) => impLimb(c, col, true, true)), P('body', (c) => impBody(c, col)), P('head', (c) => impHead(c, col, true)), P('crown', flameCrown), P('armF', (c) => impLimb(c, col, false, true))],
    rig: (p) => {
      const body0 = p.add(null, null, 0, -8);
      const cape = p.add('cape', body0, 0, 0);
      const legB = p.add('legB', null, -2.4, -8.6); const legF = p.add('legF', null, 2.4, -8.6);
      const body = p.add(null, null, 0, -8);
      const tail = p.add('tail', body, -5, -4); const wing = p.add('wing', body, -3, -12);
      const armB = p.add('armB', body, -2, -11); const b = p.add('body', body);
      const head = p.add('head', body, 1, -21); const cr = p.add('crown', head, 0, -9.6); const armF = p.add('armF', body, 3, -11);
      wing.scale(1.6);
      return { body0, cape, legB, legF, body, tail, wing, armB, b, head, crown: cr, armF };
    },
    pose: (n, s) => {
      const sw = walkLegs(n, s, 0.45);
      const { wind, strike } = atkCurve(s.atk, 0.5, 0.65);
      const w = Math.max(wind, s.wind);
      n.body.set(strike * 3, -8 - Math.abs(sw) * 2 * s.move + Math.sin(s.t * 2) * 0.6 - w * 1.5, -w * 0.2 + strike * 0.25);
      n.body0.set(strike * 3, n.body.y, 0);
      n.cape.rot = Math.sin(s.t * 1.6) * 0.06 + s.move * 0.18 + sw * 0.05 * s.move;
      n.head.rot = Math.sin(s.t * 1.8) * 0.04;
      n.crown.rot = Math.sin(s.t * 6) * 0.04;
      n.crown.c.scale.y = 1 + Math.sin(s.t * 11) * 0.06;
      n.tail.rot = Math.sin(s.t * 2.4) * 0.25;
      n.wing.rot = Math.sin(s.t * 5) * 0.25 - w * 0.3;
      n.armF.rot = -sw * 0.4 * s.move - w * 2.6 + strike * 1.6;
      n.armB.rot = sw * 0.4 * s.move - w * 2.3 + strike * 1.4;
    },
  },
  skeleton: {
    base: 1, height: 44, shadow: 28, atkDur: 0.6, eyes: ['skull', 7.3, -1.4],
    parts: (col) => [P('legB', (c) => boneLimb(c, col, true, false)), P('legF', (c) => boneLimb(c, col, false, false)), P('armB', (c) => boneLimb(c, col, true, true)), P('ribs', (c) => ribs(c, col)), P('skull', (c) => skull(c, col)), P('sword', (c) => rustySword(c, col)), P('armF', (c) => boneLimb(c, col, false, true))],
    rig: (p) => {
      const legB = p.add('legB', null, -2.4, -10.6); const legF = p.add('legF', null, 2.4, -10.6);
      const body = p.add(null, null, 0, -10);
      const armB = p.add('armB', body, -1, -13); const r = p.add('ribs', body);
      const skullN = p.add('skull', body, 1, -24); const armF = p.add('armF', body, 2, -13);
      const sword = p.add('sword', armF, 0, 9.6); p.toFront(sword);
      return { legB, legF, body, armB, ribs: r, skull: skullN, armF, sword };
    },
    pose: (n, s) => {
      const sw = walkLegs(n, s, 0.5);
      const { wind, strike } = atkCurve(s.atk, 0.4, 0.58);
      const w = Math.max(wind, s.wind);
      const jit = Math.sin(s.t * 23) * 0.6 * s.move;
      n.body.set(0, -10 - Math.abs(sw) * 1.6 * s.move + jit * 0.3, 0.06 * s.move - w * 0.1 + strike * 0.15);
      n.skull.set(1 + jit * 0.2, -24 + Math.sin(s.t * 2.4) * 0.4, Math.sin(s.t * 2.2) * 0.06 + Math.sin(s.walk * 2) * 0.05 * s.move);
      n.armF.rot = -0.3 - sw * 0.4 * s.move + lerp(0, -3.0, w) + strike * 2.6;
      n.sword.rot = 0.6 + w * -0.2 + strike * 0.7;
      n.armB.rot = 0.3 + sw * 0.4 * s.move + w * 0.4;
    },
  },
  cultist: {
    base: 1, height: 44, shadow: 30, atkDur: 0.8, eyes: ['hood', 7.2, -1.6],
    parts: (col) => [P('armB', (c) => cultArm(c, col, true)), P('robe', (c) => cultRobe(c, col)), P('hood', (c) => cultHood(c, col)), P('staff', (c) => cultStaff(c, col)), P('armF', (c) => cultArm(c, col, false))],
    rig: (p) => {
      const body = p.add(null);
      const armB = p.add('armB', body, -1, -20); const robe = p.add('robe', body);
      const hood = p.add('hood', body, 0, -30); const armF = p.add('armF', body, 3, -20);
      const staff = p.add('staff', armF, 0, 9.4); p.toFront(staff);
      return { body, armB, robe, hood, armF, staff };
    },
    pose: (n, s, v) => {
      const glide = Math.sin(s.walk) * s.move;
      const { wind, strike } = atkCurve(s.atk, 0.5, 0.65);
      const w = Math.max(wind, s.wind);
      n.body.set(0, Math.sin(s.t * 2) * 0.8 - Math.abs(glide) * 1.2, glide * 0.05 + strike * 0.12);
      n.robe.c.skew.x = -glide * 0.06 - s.move * 0.04;
      n.hood.rot = Math.sin(s.t * 1.8) * 0.04 - w * 0.1 + strike * 0.12;
      n.armF.rot = -0.5 - w * 2.2 + strike * 1.2;
      n.staff.rot = 0.5 + w * 1.6 - strike * 0.4;
      n.armB.rot = 0.2 - w * 0.6;
      v.glowAt(n.staff, 0, -28, (0.55 + 0.45 * Math.sin(s.t * 4)) * 0.6 + w * 0.8);
    },
  },
  brute: {
    base: 1, height: 52, shadow: 48, atkDur: 1.0, eyes: ['b', 15.7, -23.4],
    parts: (col) => [P('legB', (c) => bruteLeg(c, col, true)), P('legF', (c) => bruteLeg(c, col, false)), P('armB', (c) => bruteArm(c, col, true)), P('body', (c) => bruteBody(c, col)), P('armF', (c) => bruteArm(c, col, false)), { name: 'cracks', draw: (c) => bruteCracks(c, col) }],
    rig: (p) => {
      const legB = p.add('legB', null, -7, -9.6); const legF = p.add('legF', null, 7, -9.6);
      const body = p.add(null, null, 0, -8);
      const armB = p.add('armB', body, -12, -26); const b = p.add('body', body, 0, 8); const cr = p.add('cracks', b); const armF = p.add('armF', body, 12, -24);
      return { legB, legF, body, armB, b, cracks: cr, armF };
    },
    pose: (n, s) => {
      const sw = walkLegs(n, s, 0.3);
      const { wind, strike } = atkCurve(s.atk, 0.6, 0.72);
      const w = Math.max(wind, s.wind);
      n.body.set(0, -8 - Math.abs(sw) * 2.4 * s.move + Math.sin(s.t * 1.4) * 0.7 + strike * 4, sw * 0.06 * s.move - w * 0.18 + strike * 0.2);
      n.armF.rot = sw * 0.35 * s.move - w * 2.9 + strike * 1.7;
      n.armB.rot = -sw * 0.35 * s.move - w * 0.8 + strike * 0.5;
      const g = n.cracks.obj as Sprite | null;
      if (g) { g.blendMode = 'add'; g.alpha = 0.55 + 0.35 * Math.sin(s.t * 3) + w * 0.4; }
    },
  },
  wisp: {
    base: 1, height: 50, shadow: 22, fly: 24, atkDur: 0.6, eyes: ['body', 2.4, -9],
    parts: (col) => [P('body', (c) => wispBody(c, col))],
    rig: (p) => { const root = p.add(null, null, 0, -24); const body = p.add('body', root); return { root, body }; },
    pose: (n, s, v) => {
      const { wind } = atkCurve(s.atk, 0.9, 0.95);
      const w = Math.max(wind, s.wind);
      const shake = w > 0 ? Math.sin(s.t * 60) * 1.4 * w : 0;
      n.root.set(shake, -24 + Math.sin(s.t * 3) * 3.2, Math.sin(s.t * 2) * 0.08 + s.move * 0.15);
      n.body.scale((1 + Math.sin(s.t * 9) * 0.04) * (1 + w * 0.4), (1 - Math.sin(s.t * 9) * 0.04) * (1 + w * 0.45));
      v.glowAt(n.root, 0, -10, 0.55 + 0.15 * Math.sin(s.t * 7) + w * 0.6);
    },
  },
  goblin: {
    base: 1, height: 46, shadow: 34, atkDur: 0.4, eyes: ['head', 6.1, -3],
    parts: (col) => [P('legB', (c) => gobLimb(c, col, true, false)), P('legF', (c) => gobLimb(c, col, false, false)), P('armB', (c) => gobLimb(c, col, true, true)), P('sack', (c) => gobSack(c, col)), P('body', (c) => gobBody(c, col)), P('head', (c) => gobHead(c, col)), P('armF', (c) => gobLimb(c, col, false, true))],
    rig: (p) => {
      const legB = p.add('legB', null, -2.4, -8); const legF = p.add('legF', null, 2.4, -8);
      const body = p.add(null, null, 0, -7);
      const armB = p.add('armB', body, -2, -11); const sack = p.add('sack', body, -3, -4); const b = p.add('body', body);
      const head = p.add('head', body, 3, -18); const armF = p.add('armF', body, 3, -11);
      return { legB, legF, body, armB, sack, b, head, armF };
    },
    pose: (n, s, v) => {
      const sw = walkLegs(n, s, 0.7);
      const run = s.move;
      n.body.set(0, -7 - Math.abs(sw) * 3 * run + Math.sin(s.t * 3) * 0.5, 0.22 * run);
      n.sack.set(-3 - run * 2, -4 + Math.abs(Math.sin(s.walk + 0.6)) * 2.6 * run, -0.08 * run + Math.sin(s.walk) * 0.06 * run);
      n.head.rot = Math.sin(s.t * (run > 0.2 ? 6 : 1.7)) * 0.08;
      n.armF.rot = -sw * 0.9 * run - 0.3;
      n.armB.rot = -1.9;
      v.coinGlint(s.t);
    },
  },
};

// ═══════════════════════════════ sheets ═══════════════════════════════

const sheets = new Map<string, SheetLike>();

/** Texel density of a rig: ordinary rigs share one density (so they can share an atlas); big bosses get more. */
function rigRes(fam: Family, scale: number): number {
  const S = fam.base * scale;
  const r = bakeRes(3, 5); // follows the view scale (camera zoom × resolution) so monsters stay crisp
  return S > 2.2 ? Math.max(r, Math.min(9, Math.round(r * S))) : r;
}

function rigSpecs(colors: C, fam: Family, scale: number, prefix = ''): PartSpec[] {
  // outlines thicken sub-linearly with size so big monsters keep a crisp, not heavy, line
  const owk = 1 / Math.sqrt(Math.max(1, fam.base * scale));
  return fam.parts(colors).map((p) => ({
    ...p,
    name: prefix + p.name,
    draw: (c: Ctx) => { const prev = paint.ow; paint.ow = owk; try { p.draw(c); } finally { paint.ow = prev; } },
  }));
}

export function rigSheet(key: string, colors: C, fam: Family, scale: number): SheetLike {
  const res = rigRes(fam, scale);
  const k = `${key}@${res}`;
  let sh = sheets.get(k);
  if (!sh || sh.destroyed) {
    sh = bakeSheet(rigSpecs(colors, fam, scale), res, 2048, key);
    sheets.set(k, sh);
  }
  return sh;
}

/** Bake many rigs into one shared atlas (one texture → monsters batch together). */
export function bakeRigAtlas(rigs: { key: string; colors: C; fam: Family; scale: number }[], label: string): void {
  const res = bakeRes(3, 5);
  const todo = rigs.filter((r) => rigRes(r.fam, r.scale) === res && !sheets.get(`${r.key}@${res}`));
  if (!todo.length) return;
  const specs: PartSpec[] = [];
  for (const r of todo) specs.push(...rigSpecs(r.colors, r.fam, r.scale, `${r.key}/`));
  const atlas: Sheet = bakeSheet(specs, res, 2048, label);
  for (const r of todo) sheets.set(`${r.key}@${res}`, new SheetSlice(atlas, `${r.key}/`));
}

// ═══════════════════════════════ view ═══════════════════════════════

const ELITE_SCALE: Record<number, number> = { 0: 1, 1: 1.08, 2: 1.16, 3: 0.96, 4: 2.6, 5: 1 };

export interface RigOptions { key: string; fam: Family; colors: C; scale: number; elite?: EliteTier; affixes?: string[]; shadowAlpha?: number }

/** Generic baked-rig entity view (monsters, summons, NPC objects). */
export class RigArt implements ActingView {
  readonly root = new Container();
  readonly height: number;
  readonly p: Puppet;
  readonly n: Nodes;
  readonly fam: Family;
  readonly S: number;
  readonly elite: EliteTier;
  t = Math.random() * 10;
  lastSeqSeen = 0;
  private face = 1;
  private faceFrom = 1;
  private faceTo = 1;
  private turnT = 1;
  private walk = 0;
  private move = 0;
  private wind = 0;
  private lastSeq = -1;
  private atkT = 99;
  private hitK = 0;
  private wob = 0;
  private wobV = 0;
  private dying = false;
  private deathT = 0;
  private deathEl = 0;
  private done: (() => void) | null = null;
  private destroyed = false;
  private glow: Sprite | null = null;
  private glowNode: PNode | null = null;
  private ring: Sprite | null = null;
  private aura: Sprite | null = null;
  readonly sparkles: Sprite[] = [];
  private stars: Sprite[] = [];
  private rimBase = 0;
  private flying: number;
  glowColor = 0;
  glowSize = 0;
  /** Family-owned extra display objects (created in setup). */
  readonly extra: Record<string, Container> = {};
  /** Seconds since the last attack started (families may read it). */
  get attackAge(): number { return this.atkT; }
  /** Aim of the last shot relative to the facing (rad, + = down) — sentries / hydras point at it. */
  aim = 0;
  private recoil = 9;
  private knock = 0;
  private lastX = 0;
  private lastY = 0;
  private eyeGlow: Sprite[] = [];
  private firstFrame = true;

  constructor(o: RigOptions) {
    this.fam = o.fam;
    this.elite = o.elite ?? 0;
    const elite = this.elite;
    const affixes = o.affixes ?? [];
    const bossFam = this.fam.base > 2;
    const tierScale = bossFam ? 1 : ELITE_SCALE[elite] ?? 1;
    const sc = Math.max(0.4, o.scale || 1);
    this.S = this.fam.base * sc * tierScale;
    const sheet = rigSheet(o.key, o.colors, this.fam, sc * tierScale);
    this.p = new Puppet(sheet, this.fam.shadow * this.S, o.shadowAlpha ?? 0.75);
    this.root.addChild(this.p.root);
    this.n = this.fam.rig(this.p);
    this.height = this.fam.height * this.S;
    this.flying = (this.fam.fly ?? 0);

    // elite dressing
    const affixCol = affixes.map((a) => ELITE_AFFIXES[a]?.color).find((c) => c && c !== 0xffffff) ?? 0;
    if (elite === 1 || elite === 2 || elite === 3) {
      const rim = elite === 1 ? RIM_CHAMPION : RIM_RARE;
      this.rimBase = elite === 3 ? 0.4 : 0.85;
      this.p.setRim(rim, this.rimBase);
      if (elite !== 3) {
        this.ring = ringSprite(rim, this.fam.shadow * this.S * 1.25, 0.45, true);
        this.ring.blendMode = 'normal';
        this.p.under.addChild(this.ring);
        if (affixCol) {
          this.aura = glowSprite(affixCol, this.fam.shadow * this.S * 1.4, 0.25, true);
          this.aura.blendMode = 'normal';
          this.aura.scale.y *= 0.45;
          this.p.under.addChild(this.aura);
        }
      }
    } else if (elite === 4 || bossFam) {
      this.p.setRim(RIM_BOSS, 0.55);
      this.rimBase = 0.55;
      this.aura = glowSprite(0xff3018, this.fam.shadow * this.S * 1.6, 0.28, true);
      this.aura.blendMode = 'normal';
      this.aura.scale.y *= 0.42;
      this.p.under.addChild(this.aura);
    }
    this.fam.setup?.(this.p, this.n, this);
    const ey = this.fam.eyes;
    if (ey && this.n[ey[0]]) {
      for (let i = 0; i < 2; i++) {
        const g = glowSprite(i ? 0xffe2a0 : 0xff4a2a, i ? 7 : 16, 0, false);
        g.position.set(ey[1], ey[2]);
        this.n[ey[0]].c.addChild(g);
        this.eyeGlow.push(g);
      }
    }
  }

  /** Own attacks and shots (the scene calls this on `proj` events): face the target, lunge or recoil. */
  playAction(a: ActionSpec): void {
    if (this.destroyed || this.dying) return;
    const dx = a.tx - this.lastX, dy = a.ty - this.lastY;
    if (Math.abs(dx) > 2) this.turnTo(dx < 0 ? -1 : 1);
    this.aim = Math.atan2(dy, Math.abs(dx) || 1);
    this.recoil = 0;
    if (this.atkT > 0.12) { this.atkT = this.wind > 0.2 ? this.fam.atkDur * 0.4 : 0; this.lastSeqSeen++; }
  }

  private turnTo(f: number): void {
    if (f === this.faceTo) return;
    this.faceFrom = this.turnT < 1 ? Math.sign(this.face) || this.faceTo : this.faceTo;
    this.faceTo = f;
    this.turnT = 0;
  }

  /** Extra sparkle sprites (goblin coins, shrines). */
  addSparkles(n: number, color: number, size: number): void {
    for (let i = 0; i < n; i++) { const s = sparkleSprite(color, size * this.S, 0); this.p.over.addChild(s); this.sparkles.push(s); }
  }

  /** Family hook: additive glow attached to a node (staff gems, wisp core). */
  glowAt(node: PNode, x: number, y: number, a: number): void {
    if (!this.glow) {
      const col = this.glowColor || (this.fam === FAMILIES.wisp ? 0xb9a8ff : 0xff8a2a);
      this.glow = glowSprite(col, this.glowSize || (this.fam === FAMILIES.wisp ? 56 : 22), 0.6, true);
      node.c.addChildAt(this.glow, 0);
      this.glowNode = node;
    }
    if (this.glowNode === node) { this.glow.position.set(x, y); this.glow.alpha = clamp(a, 0, 1.4); }
  }

  /** Goblin: coins glint on the sack. */
  coinGlint(t: number): void {
    this.sparkles.forEach((s, i) => {
      const cyc = (t * 0.9 + i * 0.33) % 1;
      const k = Math.sin(clamp(cyc * 3) * Math.PI);
      s.alpha = k;
      s.scale.set((0.12 + 0.1 * k) * this.S);
      if (cyc < 0.02) s.position.set((-10 + Math.random() * 12) * this.S * this.face, (-38 + Math.random() * 6) * this.S);
    });
  }

  update(dt: number, s: ViewState): void {
    if (this.destroyed) return;
    const flags = s.flags;
    const frozen = (flags & F_FROZEN) !== 0;
    const chill = (flags & F_CHILL) !== 0;
    const stun = (flags & F_STUN) !== 0;
    const k = frozen ? 0 : chill ? 0.55 : stun ? 0.25 : 1;
    const adt = dt * k;
    this.t += adt;

    // squash-turn: the cut-out narrows to 35 %, flips at the middle and widens again, with a little hop
    this.lastX = s.x; this.lastY = s.y;
    if (this.firstFrame) { this.firstFrame = false; this.faceFrom = this.faceTo = s.facingLeft ? -1 : 1; this.turnT = 1; }
    if (this.recoil > 0.25 || this.recoil === 9) this.turnTo(s.facingLeft ? -1 : 1);
    this.turnT = Math.min(1, this.turnT + dt / 0.15);
    const tp = easeInOut(this.turnT);
    this.face = tp < 0.5 ? this.faceFrom * Math.max(0.35, Math.cos(tp * Math.PI)) : this.faceTo * Math.max(0.35, -Math.cos(tp * Math.PI));
    const turnBump = this.turnT < 1 ? Math.sin(tp * Math.PI) : 0;
    this.recoil = Math.min(9, this.recoil + dt);

    if (s.attackSeq !== this.lastSeq) {
      // the server already played the wind-up (F_WINDUP) when it resolves the hit: go straight into the strike
      if (this.lastSeq >= 0 || (flags & F_ATTACK)) { if (this.atkT > 0.12) { this.atkT = this.wind > 0.2 ? this.fam.atkDur * 0.4 : 0; this.lastSeqSeen++; } }
      this.lastSeq = s.attackSeq;
    }
    this.atkT += adt;
    const moving = s.moving && !frozen && !stun;
    this.move += ((moving ? 1 : 0) - this.move) * damp(10, dt);
    const speed = Math.hypot(s.vx, s.vy);
    if (moving) this.walk += adt * Math.PI * clamp(speed / 90, 0.7, 2.4) * 2.2;
    this.wind += (((flags & F_WINDUP) ? 1 : 0) - this.wind) * damp(14, dt);
    this.hitK = Math.max(0, this.hitK - dt * 6);
    this.knock = Math.max(0, this.knock - dt * 5);

    const atk = this.atkT < this.fam.atkDur ? this.atkT / this.fam.atkDur : -1;
    const st: MState = { t: this.t, dt: adt, move: this.move, walk: this.walk, atk, wind: this.wind, face: this.face };
    this.fam.pose(this.n, st, this);

    const p = this.p;
    const hk = this.fam.wobble ? 0 : this.hitK;
    let sx = (1 + 0.16 * hk), sy = (1 - 0.14 * hk) * (1 - 0.06 * turnBump);
    if (this.fam.wobble) {
      this.wobV += (-this.wob * 160 - this.wobV * 7) * dt;
      this.wob += this.wobV * dt;
    }
    let alpha = 1, y = 0, tint = 0xffffff;
    // done() may destroy this view synchronously, so it is only ever called as the very last statement
    let finish: (() => void) | null = null;
    if (this.dying) {
      this.deathT += dt;
      const r = this.deathAnim(this.deathT);
      sx *= r.sx; sy *= r.sy; alpha = r.a; y = r.y; tint = r.tint;
      if (r.done && this.done) { finish = this.done; this.done = null; }
    } else {
      if (frozen) tint = 0x8fd0ff;
      else if (chill) tint = 0xc4e4ff;
      else if (flags & F_POISON) tint = 0xc8eea8;
      else if (flags & F_BURN) tint = (Math.sin(this.t * 20) > 0 ? 0xffd2b0 : 0xffffff);
      if (this.wind > 0.05) tint = mix(tint, 0xffb4a0, this.wind * (0.5 + 0.5 * Math.sin(this.t * 22)) * 0.6);
    }
    const flip = this.face;
    const dir = Math.sign(this.face) || 1;
    // wind-up: rear back, tremble; strike: lunge forward; shot: recoil; hit: knocked back
    const w = this.dying ? 0 : this.wind;
    const atkU = this.atkT < this.fam.atkDur ? this.atkT / this.fam.atkDur : -1;
    const strike = atkU >= 0 ? atkCurve(atkU).strike : 0;
    const rec = this.recoil < 0.35 ? Math.exp(-this.recoil / 0.08) * Math.min(1, this.recoil / 0.03) : 0;
    const k2 = Math.min(1.6, Math.sqrt(this.S));
    const shakeX = w > 0.02 ? Math.sin(this.t * 70) * 0.9 * w * k2 : 0;
    const dx = (strike * 4.5 - rec * 4 - this.knock * 4) * dir * k2 + shakeX;
    p.body.scale.set(flip * this.S * sx * (1 - 0.04 * w), this.S * sy * (1 + 0.06 * w));
    p.body.position.set(dx, y - 1.5 * turnBump * k2);
    p.body.rotation = this.fam.wobble ? this.wob : (-0.13 * w + 0.08 * strike - 0.1 * this.knock) * dir;
    p.shadow.x = dx * 0.6;
    for (let i = 0; i < this.eyeGlow.length; i++) {
      const g = this.eyeGlow[i];
      g.alpha = w * (i ? 0.9 : 0.75) * (0.75 + 0.25 * Math.sin(this.t * 30 + i));
      g.visible = g.alpha > 0.01; // invisible additive sprites would still split the sprite batch
    }
    p.body.alpha = alpha;
    p.body.tint = tint;
    p.shadow.alpha = 0.75 * alpha * (this.flying ? 0.7 : 1);
    if (this.rimBase) p.rimAlpha = (this.rimBase * (0.75 + 0.25 * Math.sin(this.t * 3.2))) * alpha;
    if (this.ring) { this.ring.alpha = (0.32 + 0.12 * Math.sin(this.t * 3.2)) * alpha; this.ring.rotation = 0; }
    if (this.aura) this.aura.alpha = (0.22 + 0.08 * Math.sin(this.t * 2.4)) * alpha;
    if (this.glow) this.glow.alpha *= alpha;

    // stun stars
    if (stun && !this.stars.length) {
      for (let i = 0; i < 3; i++) { const sp = new Sprite(fx().star5); sp.anchor.set(0.5); sp.scale.set(0.4); sp.tint = 0xffe066; this.p.over.addChild(sp); this.stars.push(sp); }
    }
    for (let i = 0; i < this.stars.length; i++) {
      const sp = this.stars[i];
      sp.visible = stun && !this.dying;
      const a = this.t * 16 + (i * TAU) / 3;
      sp.position.set(Math.cos(a) * 10 * Math.max(1, this.S * 0.7), -this.height - 2 + Math.sin(a) * 3);
    }
    p.sync(performance.now());
    if (finish) finish();
  }

  private deathAnim(t: number): { sx: number; sy: number; a: number; y: number; tint: number; done: boolean } {
    const el = this.deathEl;
    switch (el) {
      case 1: { // fire: char black, then crumble
        const c = clamp(t / 0.22);
        const cr = clamp((t - 0.25) / 0.4);
        return { sx: 1 + cr * 0.2, sy: 1 - easeIn(cr) * 0.75, a: 1 - easeIn(cr), y: 0, tint: mix(0xffffff, 0x2a1c18, c), done: t > 0.68 };
      }
      case 2: { // cold: flash icy, then vanish (vfx shatters)
        return { sx: 1.04, sy: 1.04, a: t < 0.09 ? 1 : 0, y: 0, tint: 0xd6f2ff, done: t > 0.12 };
      }
      case 3: { // lightning: flicker
        const on = Math.floor(t / 0.04) % 2 === 0;
        return { sx: 1, sy: 1, a: t < 0.26 ? (on ? 1 : 0.15) : 0, y: 0, tint: on ? 0xf2ecff : 0xb59cff, done: t > 0.28 };
      }
      case 4: { // poison: melt
        const e = easeOut(clamp(t / 0.5));
        return { sx: 1 + e * 0.55, sy: 1 - e * 0.85, a: 1 - clamp((t - 0.36) / 0.18), y: 0, tint: mix(0xffffff, 0x9ad06a, e), done: t > 0.55 };
      }
      case 5: case 6: { // arcane / holy: fade upward
        const e = easeOut(clamp(t / 0.45));
        return { sx: 1 + e * 0.15, sy: 1 + e * 0.15, a: 1 - e, y: -12 * e, tint: el === 5 ? mix(0xffffff, 0xc39bff, e) : mix(0xffffff, 0xfff0a0, e), done: t > 0.46 };
      }
      default: { // physical: squash, then pop
        if (t < 0.11) { const e = easeOut(t / 0.11); return { sx: 1 + 0.35 * e, sy: 1 - 0.45 * e, a: 1, y: 0, tint: 0xffffff, done: false }; }
        const e = easeOut3(clamp((t - 0.11) / 0.16));
        return { sx: 1.35 - 0.1 * e, sy: 0.55 + 0.6 * e, a: 1 - e, y: 0, tint: 0xffffff, done: t > 0.28 };
      }
    }
  }

  hit(intensity: number, crit: boolean): void {
    if (this.destroyed || this.dying) return;
    this.p.flash(performance.now(), crit ? 90 : 70);
    this.hitK = Math.max(this.hitK, 0.55 + 0.45 * clamp(intensity));
    if (!this.fam.wobble) this.knock = Math.max(this.knock, (crit ? 1 : 0.75) * (0.6 + 0.4 * clamp(intensity)));
    if (this.fam.wobble) this.wobV += (crit ? 2.6 : 1.6) * (0.6 + 0.4 * clamp(intensity)) * (Math.random() < 0.5 ? -1 : 1);
  }

  die(element: number, done: () => void): void {
    if (this.dying || this.destroyed) return;
    this.dying = true;
    this.deathT = 0;
    this.deathEl = element;
    this.done = done;
    if (this.ring) this.ring.visible = false;
    void ELEMENT_COLORS;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.done = null;
    this.p.destroy();
    this.root.destroy({ children: true });
  }
}

/** A monster from the MONSTERS roster. */
export class MonsterArt extends RigArt {
  constructor(defId: string, elite: EliteTier, affixes: string[], scale: number) {
    const def = MONSTERS[defId] ?? MONSTERS.bog_slime;
    super({ key: `monster:${def.id}`, fam: FAMILIES[def.family], colors: def.colors, scale: scale || def.scale, elite, affixes });
    if (def.family === 'goblin') this.addSparkles(3, 0xffe08a, 9);
  }
}

/** Bake every monster that can appear on a map theme (+ extra rigs such as summons) into one atlas. */
export function prewarmMonsters(theme: string, rift: boolean, extra: { key: string; colors: C; fam: Family; scale: number }[] = []): void {
  const rigs: { key: string; colors: C; fam: Family; scale: number }[] = [...extra];
  for (const def of Object.values(MONSTERS)) {
    const wanted = def.themes.includes(theme) || def.family === 'goblin' || (rift && RIFT_GUARDIANS[theme] === def.id);
    if (!wanted) continue;
    const fam = FAMILIES[def.family];
    if (fam.base > 2) rigSheet(`monster:${def.id}`, def.colors, fam, def.scale);
    else rigs.push({ key: `monster:${def.id}`, colors: def.colors, fam, scale: def.scale });
  }
  bakeRigAtlas(rigs, `rigs:${theme}`);
}
