// Town NPC objects (Cube, Obelisk, Waypoint, Stash, Paragon Shrine, Training Dummy), townsfolk and portals.
// Objects use the baked-rig machinery with a few additive fx sprites; each shows a quiet name label.

import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { NpcRole } from '@shared/mapgen';
import type { PlayerLook } from '@shared/protocol';
import type { EntityView, ViewState } from '../types';
import { OUT, ball, blob, blobPath, cachedCtx, crease, fill, gem, gloss, line, outline, poly, rbox, rivet, seg, spark, star, stitch, wash, type Ctx } from './draw';
import { fx, glowSprite, ringSprite, sparkleSprite } from './fx';
import { P, RigArt, type C, type Family } from './monsters';
import { GOLD, INK } from './palette';
import { PlayerArt } from './player';
import { TAU, clamp, light, mix, shade } from './util';

// ─────────────────────────── labels ───────────────────────────

export function nameLabel(text: string, y: number, color = 0xf2e6c8): Text {
  const t = new Text({
    text,
    style: { fontFamily: 'Alegreya Sans, sans-serif', fontWeight: '700', fontSize: 12, fill: color, stroke: { color: 0x140e0a, width: 3.2, join: 'round' }, letterSpacing: 0.3 },
    resolution: 2,
  });
  t.anchor.set(0.5, 1);
  t.y = y;
  t.alpha = 0.92;
  return t;
}

// ─────────────────────────── drawings ───────────────────────────

const BRONZE = 0xb4783a, BRONZE_L = 0xe0aa5e, BRONZE_D = 0x7a4a22;
const STONE = 0x8e8a80, STONE_L = 0xaaa59a, STONE_D = 0x66625a;

function cubeArt(c: Ctx): void {
  const s = 15;
  const top = [0, -s * 1.9, s * 1.15, -s * 1.32, 0, -s * 0.74, -s * 1.15, -s * 1.32];
  const left = [-s * 1.15, -s * 1.32, 0, -s * 0.74, 0, s * 0.74, -s * 1.15, s * 0.16];
  const right = [s * 1.15, -s * 1.32, 0, -s * 0.74, 0, s * 0.74, s * 1.15, s * 0.16];
  poly(c, left, BRONZE, { hl: 0, ow: 0, inset: 0.86 });
  poly(c, right, BRONZE_D, { hl: 0, ow: 0, inset: 0.86 });
  poly(c, top, BRONZE_L, { hl: 0.2, ow: 0, inset: 0.82 });
  // rune channels
  const rune = 0x7ff2e0;
  crease(c, [-s * 0.9, -s * 0.9, -s * 0.5, -s * 0.66, -s * 0.5, -s * 0.1, -s * 0.2, s * 0.06], 1.4, rune, 0.95);
  crease(c, [-s * 0.95, -s * 0.2, -s * 0.7, -s * 0.06], 1.4, rune, 0.95);
  crease(c, [s * 0.3, -s * 0.4, s * 0.7, -s * 0.66, s * 0.9, -s * 0.2, s * 0.6, s * 0.04, s * 0.3, -s * 0.1], 1.4, rune, 0.85);
  crease(c, [-s * 0.4, -s * 1.32, 0, -s * 1.56, s * 0.4, -s * 1.32, 0, -s * 1.08, -s * 0.4, -s * 1.32], 1.3, rune, 0.9);
  // gold corner caps + edges
  for (const [x, y] of [[0, -s * 1.9], [s * 1.15, -s * 1.32], [-s * 1.15, -s * 1.32], [0, -s * 0.74], [0, s * 0.74], [s * 1.15, s * 0.16], [-s * 1.15, s * 0.16]] as const) {
    c.circle(x, y, 2.4); fill(c, GOLD); c.circle(x, y, 2.4); outline(c, 1.4);
  }
  c.moveTo(0, -s * 0.74).lineTo(0, s * 0.74); outline(c, 1.6);
  c.moveTo(-s * 1.15, -s * 1.32).lineTo(0, -s * 0.74).lineTo(s * 1.15, -s * 1.32); outline(c, 1.6);
  c.poly([0, -s * 1.9, s * 1.15, -s * 1.32, s * 1.15, s * 0.16, 0, s * 0.74, -s * 1.15, s * 0.16, -s * 1.15, -s * 1.32], true); outline(c, 2.6);
}
function pedestal(c: Ctx): void {
  ball(c, 0, -3, 26, 9, STONE_D, { hl: 0, sh: 0.2 });
  ball(c, 0, -7, 22, 7.4, STONE, { hl: 0.3 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    c.circle(Math.cos(a) * 16, -7 + Math.sin(a) * 5, 1.3); fill(c, 0x7ff2e0, 0.9);
  }
  crease(c, [-22, -6, -14, -2, 0, -1, 14, -2, 22, -6], 1, OUT, 0.35);
}

function obeliskArt(c: Ctx): void {
  // stepped base
  rbox(c, -22, -10, 44, 10, 2, STONE_D, { hl: 0.2 });
  rbox(c, -17, -18, 34, 9, 2, STONE, { hl: 0.25 });
  const shaft = [-12, -18, 12, -18, 8, -100, 0, -112, -8, -100];
  poly(c, shaft, 0x3a3440, { hl: 0, inset: 0.86, px: -0.3 });
  wash(c, (k) => k.poly([-12, -18, -1, -18, -1, -106, -8, -100], true), 0x4c4454, 0.9);
  crease(c, [0, -18, 0, -108], 1, 0x1c1820, 0.6);
  crease(c, [-6, -40, -9, -48], 1, 0x1c1820, 0.6);
  c.poly(shaft, true); outline(c, 2.6);
  // carved rune slots (lit by the emissive copy)
  for (const y of [-34, -52, -70, -88]) { c.roundRect(-3.4, y - 6, 6.8, 10, 1.6); fill(c, 0x1a1420); }
}
function obeliskRunes(c: Ctx): void {
  const col = 0xff4a9a;
  const glyphs = [
    [-2, -38, 2, -32, -2, -32, 2, -38],
    [0, -57, 0, -48, -2.4, -52, 2.4, -52],
    [-2, -74, 2, -74, 0, -66, -2, -74],
    [-2.4, -92, 2.4, -92, -2.4, -86, 2.4, -86],
  ];
  for (const g of glyphs) { c.moveTo(g[0], g[1]); for (let i = 2; i < g.length; i += 2) c.lineTo(g[i], g[i + 1]); }
  c.stroke({ width: 1.8, color: col, cap: 'round', join: 'round' });
}

function waypointArt(c: Ctx): void {
  ball(c, 0, 0, 44, 17, STONE_D, { hl: 0, sh: 0.2 });
  ball(c, 0, -3, 40, 15, STONE, { hl: 0.25 });
  c.ellipse(0, -3, 30, 10.6); fill(c, 0x2a3a52);
  c.ellipse(0, -3, 30, 10.6); outline(c, 2);
  // rune tiles around the rim
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const x = Math.cos(a) * 35, y = -3 + Math.sin(a) * 12.6;
    c.circle(x, y, 1.4); fill(c, 0x8fd0ff, 0.95);
  }
}
function waypointStones(c: Ctx, back: boolean): void {
  const angles = back ? [-2.4, -1.57, -0.7] : [2.5, 0.65];
  for (const a of angles) {
    const x = Math.cos(a) * 40, y = -3 + Math.sin(a) * 15;
    const h = back ? 22 : 18;
    poly(c, [x - 4.6, y, x - 3.8, y - h + 3, x, y - h, x + 3.8, y - h + 3, x + 4.6, y], back ? STONE_D : STONE, { hl: 0.2 });
    crease(c, [x - 1.6, y - h * 0.7, x + 1.6, y - h * 0.5, x - 1.6, y - h * 0.3], 1.4, 0x8fd0ff, 0.9);
  }
}

function stashArt(c: Ctx): void {
  const wood = 0x8a5a34, iron = 0x4c4a50;
  // body
  rbox(c, -22, -24, 44, 24, 3, wood, { hl: 0.2 });
  for (const y of [-17, -10]) crease(c, [-21, y, 21, y], 1, shade(wood, 0.5), 0.6);
  // lid
  blob(c, [-23, -23, -22, -33, -12, -39, 0, -40, 12, -39, 22, -33, 23, -23], light(wood, 0.08), { hl: 0.3 });
  crease(c, [-21, -31, 21, -31], 1, shade(wood, 0.5), 0.5);
  // iron bands
  for (const x of [-15, 15]) {
    c.poly([x - 3, -39.6, x + 3, -39.6, x + 3, 0, x - 3, 0], true); fill(c, iron);
    c.poly([x - 3, -39.6, x + 3, -39.6, x + 3, 0, x - 3, 0], true); outline(c, 1.6);
    for (const y of [-34, -18, -6]) rivet(c, x, y, 0.9, 0xb8b4bc);
  }
  c.rect(-23, -24.6, 46, 3); fill(c, iron); c.rect(-23, -24.6, 46, 3); outline(c, 1.4);
  // lock
  rbox(c, -4.4, -28, 8.8, 10, 1.8, GOLD, { ow: 1.8, hl: 0.5 });
  c.circle(0, -24, 1.4); fill(c, 0x3a2410); c.rect(-0.6, -24, 1.2, 3); fill(c, 0x3a2410);
}

function shrineArt(c: Ctx): void {
  rbox(c, -18, -10, 36, 10, 2, STONE_D, { hl: 0.2 });
  poly(c, [-10, -10, 10, -10, 8, -42, -8, -42], STONE, { hl: 0.2 });
  crease(c, [-4, -16, 4, -16], 1, OUT, 0.35);
  rbox(c, -14, -48, 28, 7, 2, STONE_L, { hl: 0.35 });
  // star sigil on the column
  star(c, 0, -27, 5, 6, 2.6, 0x8fd0ff, 1.2);
}
function shrineStar(c: Ctx): void {
  star(c, 0, 0, 4, 13, 4.2, 0xfff0b8, 2.2);
  star(c, 0, 0, 4, 8, 2.8, 0xffffff, 0, Math.PI / 4);
  c.circle(0, 0, 3); fill(c, 0xffffff);
}

function dummyArt(c: Ctx, elite: boolean): void {
  const wood = 0x8a5a34, sack = elite ? 0xc9a46a : 0xd8c08a, straw = 0xe8c860;
  // post + stake
  seg(c, 0, 0, 0, -44, 4, wood, 2.4);
  seg(c, -6, 0, -1, -10, 2, shade(wood, 0.2), 2);
  // arms crossbar
  seg(c, -16, -30, 16, -30, 3, wood, 2.2);
  for (const x of [-17, 17]) { for (const d of [-3, 0, 3]) seg(c, x, -30, x + Math.sign(x) * 4, -30 + d, 1, straw, 1, false); }
  // body sack
  blob(c, [-10, -14, -11, -30, -7, -38, 7, -38, 11, -30, 10, -14, 0, -11], sack, { hl: 0.2 });
  stitch(c, [0, -37, 0, -13], shade(sack, 0.5), 1.6, 1.2);
  crease(c, [-9, -22, 9, -22], 1.4, shade(sack, 0.4), 0.7);
  // straw tufts
  for (const [x, y] of [[-10, -14], [9, -15], [-2, -12]] as const) for (const d of [-2, 0, 2]) seg(c, x, y, x + d, y + 4, 0.9, straw, 0.9, false);
  // head
  ball(c, 0, -46, 9, 8.4, sack, { hl: 0.25 });
  // painted target face
  c.circle(3, -46, 4.6); fill(c, 0xc84030); c.circle(3, -46, 3); fill(c, 0xf2e6c8); c.circle(3, -46, 1.4); fill(c, 0xc84030);
  if (elite) {
    // horned helmet + sash
    blob(c, [-9.6, -48, -9, -55, 0, -58, 9, -55, 9.6, -48], 0x9aa3ad, { hl: 0.45 });
    blob(c, [-8, -54, -13, -60, -12, -66, -9, -60, -5, -56], 0xeee0c0, { ow: 1.8 });
    blob(c, [7, -55, 12, -61, 12, -67, 8.6, -60, 4, -57], 0xeee0c0, { ow: 1.8 });
    poly(c, [-11, -34, 11, -22, 11, -18, -11, -30], 0xc0392b, { hl: 0.2, ow: 1.8 });
  }
}

// ─────────────────────────── families ───────────────────────────

const NONE: C = { body: 0, accent: 0, eye: 0 };
const still = () => { /* static */ };

const CUBE: Family = {
  base: 1, height: 80, shadow: 56, atkDur: 1,
  parts: () => [P('ped', pedestal), P('cube', cubeArt)],
  rig: (p) => { const ped = p.add('ped'); const cube = p.add('cube', null, 0, -46); return { ped, cube }; },
  setup: (p, n, v) => {
    const g = glowSprite(0x6ff2e0, 90, 0.35, true); g.position.set(0, -46); n.cube.c.addChildAt(g, 0); g.position.set(0, -12);
    const r = ringSprite(0x7ff2e0, 60, 0.4, true); r.position.set(0, -7); p.under.addChild(r);
    v.addSparkles(4, 0xbffaf0, 9);
  },
  pose: (n, s, v) => {
    n.cube.set(0, -46 + Math.sin(s.t * 1.4) * 3, Math.sin(s.t * 0.7) * 0.04);
    (v as ObjectRig).orbit(0, -40 + Math.sin(s.t * 1.4) * 3, 34, 10, s.t * 0.8);
  },
};
const OBELISK: Family = {
  base: 1, height: 118, shadow: 54, atkDur: 1,
  parts: () => [P('ob', obeliskArt), { name: 'runes', draw: obeliskRunes }],
  rig: (p) => { const ob = p.add('ob'); const runes = p.add('runes', ob); return { ob, runes }; },
  setup: (p, n, v) => {
    const g = glowSprite(0xd04aff, 120, 0.25, true); g.position.set(0, -60); g.scale.x *= 0.6; n.ob.c.addChildAt(g, 0);
    const r = ringSprite(0xff4a9a, 70, 0.35, true); r.position.set(0, -4); p.under.addChild(r);
    v.addSparkles(3, 0xff8ad0, 9);
  },
  pose: (n, s, v) => {
    const r = n.runes.obj as Sprite | null;
    if (r) { r.blendMode = 'add'; r.alpha = 0.65 + 0.35 * Math.sin(s.t * 2.2); }
    (v as ObjectRig).orbit(0, -70, 22, 6, s.t * 0.6);
  },
};
const WAYPOINT: Family = {
  base: 1, height: 40, shadow: 0, atkDur: 1,
  parts: () => [P('back', (c) => waypointStones(c, true)), P('disc', waypointArt), P('front', (c) => waypointStones(c, false))],
  rig: (p) => { const back = p.add('back'); const disc = p.add('disc'); return { back, disc, front: p.add('front') }; },
  setup: (p, n, v) => {
    const sw = new Container(); sw.position.set(0, -3); sw.scale.y = 0.36;
    for (let i = 0; i < 3; i++) { const s = new Sprite(fx().swirl); s.anchor.set(0.5); s.width = s.height = 62 - i * 14; s.tint = [0x3d8bff, 0x7fc8ff, 0xd8f2ff][i]; s.alpha = 0.8; s.blendMode = 'add'; sw.addChild(s); }
    n.disc.c.addChild(sw);
    (v as ObjectRig).extra.swirl = sw;
    const g = glowSprite(0x5aa8ff, 70, 0.4, true); g.position.set(0, -10); g.scale.y *= 0.6; n.disc.c.addChild(g);
    v.addSparkles(4, 0xbfe4ff, 8);
  },
  pose: (n, s, v) => {
    const sw = (v as ObjectRig).extra.swirl;
    if (sw) sw.children.forEach((ch, i) => { ch.rotation = -s.t * (1.2 + i * 0.7); });
    (v as ObjectRig).rise(0, -3, 26, 9, s.t);
  },
};
const STASH: Family = {
  base: 1, height: 42, shadow: 52, atkDur: 1,
  parts: () => [P('chest', stashArt)],
  rig: (p) => ({ chest: p.add('chest') }),
  setup: (_p, _n, v) => v.addSparkles(1, 0xfff0b0, 10),
  pose: (_n, s, v) => (v as ObjectRig).glint(4, -26, s.t, 3.4),
};
const SHRINE: Family = {
  base: 1, height: 84, shadow: 40, atkDur: 1,
  parts: () => [P('col', shrineArt), P('star', shrineStar)],
  rig: (p) => { const col = p.add('col'); const st = p.add('star', null, 0, -66); return { col, star: st }; },
  setup: (p, n, v) => {
    const g = glowSprite(0xffe08a, 80, 0.45, true); n.star.c.addChildAt(g, 0);
    const rays = new Sprite(fx().rays); rays.anchor.set(0.5, 0.97); rays.tint = 0xffe8a8; rays.blendMode = 'add'; rays.alpha = 0.25; rays.scale.set(0.6); rays.position.set(0, -44);
    p.under.addChild(rays);
    v.addSparkles(3, 0xfff0c0, 8);
  },
  pose: (n, s, v) => {
    n.star.set(0, -66 + Math.sin(s.t * 1.8) * 3, s.t * 0.5);
    (v as ObjectRig).orbit(0, -64, 18, 8, -s.t * 0.9);
  },
};
const DUMMY: Family = { base: 1, height: 58, shadow: 30, atkDur: 1, wobble: true, parts: () => [P('d', (c) => dummyArt(c, false))], rig: (p) => ({ d: p.add('d') }), pose: still };
const DUMMY_ELITE: Family = { base: 1.18, height: 66, shadow: 32, atkDur: 1, wobble: true, parts: () => [P('d', (c) => dummyArt(c, true))], rig: (p) => ({ d: p.add('d') }), pose: still };

const FAMS: Partial<Record<NpcRole, Family>> = { cube: CUBE, obelisk: OBELISK, waypoint: WAYPOINT, stash: STASH, paragon: SHRINE, dummy: DUMMY };

/** Rig view with helpers for orbiting / rising sparkles (used by object families). */
class ObjectRig extends RigArt {
  orbit(cx: number, cy: number, rx: number, ry: number, a0: number): void {
    const sp = this.sparkleList();
    sp.forEach((s, i) => {
      const a = a0 + (i / sp.length) * TAU;
      s.position.set(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
      const k = 0.5 + 0.5 * Math.sin(this.t * 3 + i * 2);
      s.alpha = 0.35 + 0.6 * k; s.scale.set(0.1 + 0.06 * k);
      s.visible = true;
    });
  }
  rise(cx: number, cy: number, rx: number, ry: number, t: number): void {
    this.sparkleList().forEach((s, i) => {
      const h = (t * 0.35 + i / 4) % 1;
      const a = i * 2.4 + t * 0.2;
      s.position.set(cx + Math.cos(a) * rx * (1 - h * 0.5), cy + Math.sin(a) * ry - h * 46);
      s.alpha = Math.sin(h * Math.PI) * 0.9; s.scale.set(0.08 + 0.06 * (1 - h));
    });
  }
  glint(x: number, y: number, t: number, every: number): void {
    const s = this.sparkleList()[0];
    if (!s) return;
    const ph = (t % every) / every;
    const k = ph < 0.12 ? Math.sin((ph / 0.12) * Math.PI) : 0;
    s.position.set(x, y); s.alpha = k; s.scale.set(0.16 * k + 0.01); s.rotation = t;
  }
  private sparkleList(): Sprite[] { return this.sparkles; }
}

// ─────────────────────────── townsfolk ───────────────────────────

const HEALER: PlayerLook = {
  classId: 'mage',
  slots: {
    head: { shape: 'hood', primary: 0xeae4d4, secondary: 0xd4a84a, glow: 0, variant: 2 },
    chest: { shape: 'robe', primary: 0xf0ebdc, secondary: 0x3f9a7a, glow: 0, variant: 0 },
    hands: { shape: 'wraps', primary: 0xe8dcc0, secondary: 0x3f9a7a, glow: 0, variant: 0 },
    feet: { shape: 'shoes', primary: 0x8a6a4a, secondary: 0x3f9a7a, glow: 0, variant: 0 },
    mainhand: { shape: 'staff', primary: 0x9a6a3c, secondary: 0x6fe0b0, glow: 0, variant: 1 },
  },
};
const VENDOR: PlayerLook = {
  classId: 'warrior',
  slots: {
    head: { shape: 'cap', primary: 0x6a4a2a, secondary: 0xc0392b, glow: 0, variant: 1 },
    chest: { shape: 'leather', primary: 0x7a5230, secondary: 0xd4b13a, glow: 0, variant: 0 },
    legs: { shape: 'cloth', primary: 0x4a5a6a, secondary: 0x3a3a3a, glow: 0, variant: 0 },
    feet: { shape: 'boots', primary: 0x5c3d24, secondary: 0x8b6a45, glow: 0, variant: 0 },
    waist: { shape: 'belt', primary: 0x5c3d24, secondary: 0xd4af37, glow: 0, variant: 2 },
  },
};

// Original smith clothing using the unchanged hero rig. Full craft choreography follows in M4.
const SMITH: PlayerLook = {
  classId: 'warrior', slots: {
    chest: { shape: 'cloth', primary: 0x515956, secondary: 0x776751, glow: 0, variant: 0 },
    legs: { shape: 'cloth', primary: 0x393e41, secondary: 0x4b4940, glow: 0, variant: 0 },
    feet: { shape: 'boots', primary: 0x4b3729, secondary: 0x79705a, glow: 0, variant: 0 },
    hands: { shape: 'gloves', primary: 0x947353, secondary: 0x4f3c2b, glow: 0, variant: 0 },
  },
};
function smithApron(): Graphics {
  return new Graphics(cachedCtx('town:smith-apron', c => {
    poly(c, [-7,-33,7,-33,9,-18,12,-9,-12,-9,-9,-18], 0x795535, {hl:.12,ow:1.6});
    stitch(c, [-7,-31,-8,-13,8,-13,7,-31], 0xb49969, 1.3, 1);
    rbox(c,-7,-22,14,9,1,0x5b402b,{ow:1,hl:.08});
    seg(c,5,-24,7,-13,1.6,0x9d7950,1);
    rbox(c,1,-27,10,4,1,0x717979,{ow:1.2,hl:.2});
  }));
}

function backpack(): Graphics {
  return new Graphics(cachedCtx('npc:backpack', (c) => {
    rbox(c, -22, -44, 16, 26, 4, 0x8a5a34, { hl: 0.25 });
    rbox(c, -23, -48, 18, 8, 3, 0x9a6a3c, { hl: 0.3 });
    c.roundRect(-20, -32, 12, 7, 2); fill(c, 0x7a4a28); c.roundRect(-20, -32, 12, 7, 2); outline(c, 1.4);
    seg(c, -17, -50, -10, -60, 1.6, 0x9a7448, 1.4, false);
    ball(c, -9, -56, 4, 3, 0xc84030, { ow: 1.4, hl: 0.3 });
    line(c, (k) => k.moveTo(-8, -46).quadraticCurveTo(-2, -40, 2, -30), 1.4, 0x5a3a20, 1.2, false);
  }));
}

// ─────────────────────────── views ───────────────────────────

export class NpcArt implements EntityView {
  readonly root = new Container();
  readonly height: number;
  private inner: EntityView;
  private label: Text | null = null;
  private apron: Graphics | null = null;

  constructor(role: NpcRole | string, name: string, look?: 'smith-slice') {
    const elite = /elite/i.test(name);
    if (['healer', 'vendor', 'blacksmith', 'jeweler', 'mystic'].includes(role)) {
      // Existing human rigs are explicit blockout stand-ins; role-specific craft animations follow the look gate.
      const v = new PlayerArt(look === 'smith-slice' ? SMITH : role === 'healer' || role === 'mystic' ? HEALER : VENDOR);
      if (role === 'vendor') v.root.addChildAt(backpack(), 1);
      this.inner = v;
    } else {
      const fam = role === 'dummy' && elite ? DUMMY_ELITE : FAMS[role as NpcRole] ?? DUMMY;
      this.inner = new ObjectRig({ key: `npc:${role}${elite ? ':elite' : ''}`, fam, colors: NONE, scale: 1, shadowAlpha: role === 'waypoint' ? 0 : 0.7 });
    }
    this.height = this.inner.height;
    this.root.addChild(this.inner.root);
    if (look === 'smith-slice') { this.apron = smithApron(); this.root.addChild(this.apron); }
    if (name && role !== 'dummy') {
      this.label = nameLabel(name, -this.height - 10, role === 'obelisk' ? 0xf0b8ff : role === 'waypoint' ? 0xbfe0ff : 0xf2e6c8);
      this.root.addChild(this.label);
    }
  }

  private destroyed = false;
  update(dt: number, s: ViewState): void {
    if (this.destroyed) return;
    this.inner.update(dt, s);
    if (this.apron) this.apron.y = Math.sin(s.time * 2.2) * .35;
  }
  hit(i: number, c: boolean): void { if (!this.destroyed) this.inner.hit(i, c); }
  die(e: number, done: () => void): void { if (!this.destroyed) this.inner.die(e, done); }
  destroy(): void { if (this.destroyed) return; this.destroyed = true; this.inner.destroy(); this.root.destroy({ children: true }); }
}

export class PortalArt implements EntityView {
  readonly root = new Container();
  readonly height = 92;
  private swirl = new Container();
  private layers: Sprite[] = [];
  private motes: Sprite[] = [];
  private core: Sprite;
  private glow: Sprite;
  private ring: Sprite;
  private t = Math.random() * 5;
  private open = 0;
  private dying = false;
  private dT = 0;
  private done: (() => void) | null = null;

  constructor(label: string, kind: 'town' | 'rift') {
    const rift = kind === 'rift';
    const cols = rift ? [0x8a2aff, 0xff3a7a, 0xffb0d8] : [0x2a6aff, 0x5ab8ff, 0xd8f4ff];
    const rim = rift ? 0xd86aff : 0x8fd4ff;
    const cy = -46;
    this.ring = ringSprite(cols[1], 86, 0.5, true);
    this.ring.position.set(0, -2);
    this.glow = glowSprite(cols[0], 130, 0.5, true);
    this.glow.position.set(0, cy);
    this.glow.scale.x *= 0.62;
    // dark backing oval so the swirl reads against bright ground
    const back = new Graphics(cachedCtx(`portal:back:${kind}`, (c) => {
      c.ellipse(0, cy, 25, 41); fill(c, rift ? 0x1a0820 : 0x081428, 0.92);
    }));
    this.swirl.position.set(0, cy);
    this.swirl.scale.x = 0.6;
    for (let i = 0; i < 3; i++) {
      const s = new Sprite(fx().swirl); s.anchor.set(0.5);
      s.width = s.height = 84 - i * 18; s.tint = cols[i]; s.alpha = 0.9; s.blendMode = 'add';
      this.swirl.addChild(s); this.layers.push(s);
    }
    this.core = glowSprite(cols[2], 40, 0.8, true);
    this.core.position.set(0, cy);
    this.core.scale.x *= 0.6;
    const frame = new Graphics(cachedCtx(`portal:frame:${kind}`, (c) => {
      c.ellipse(0, cy, 26, 42); c.stroke({ width: 7.4, color: INK });
      c.ellipse(0, cy, 26, 42); c.stroke({ width: 3.6, color: rim });
      c.ellipse(-1, cy - 2, 25, 41); c.stroke({ width: 1.2, color: 0xffffff, alpha: 0.55 });
    }));
    this.root.addChild(this.ring, this.glow, back, this.swirl, this.core, frame);
    for (let i = 0; i < 8; i++) {
      const m = new Sprite(fx().dot); m.anchor.set(0.5); m.tint = cols[2]; m.blendMode = 'add';
      this.root.addChild(m); this.motes.push(m);
    }
    const t = nameLabel(label, -this.height - 8, rift ? 0xf0b8ff : 0xbfe0ff);
    this.root.addChild(t);
  }

  private destroyed = false;
  update(dt: number): void {
    if (this.destroyed) return;
    this.t += dt;
    this.open = Math.min(1, this.open + dt * 2.5);
    let k = this.open < 1 ? 1 - Math.pow(1 - this.open, 3) : 1;
    let finish: (() => void) | null = null;
    if (this.dying) { this.dT += dt; k *= 1 - clamp(this.dT / 0.4); if (this.dT > 0.42 && this.done) { finish = this.done; this.done = null; } }
    this.root.scale.set(1, 1);
    this.swirl.scale.set(0.6 * k, k);
    this.layers.forEach((s, i) => { s.rotation = this.t * (1.6 + i * 0.9) * (i % 2 ? -1 : 1); });
    this.core.alpha = (0.7 + 0.2 * Math.sin(this.t * 4)) * k;
    this.glow.alpha = (0.45 + 0.1 * Math.sin(this.t * 2)) * k;
    this.ring.alpha = (0.4 + 0.12 * Math.sin(this.t * 3)) * k;
    this.motes.forEach((m, i) => {
      const h = (this.t * 0.45 + i / this.motes.length) % 1;
      const a = i * 2.3;
      m.position.set(Math.cos(a + this.t) * (12 + 8 * h), -6 - h * 84);
      m.alpha = Math.sin(h * Math.PI) * 0.85 * k;
      m.scale.set(0.3 * (1 - h * 0.6));
    });
    if (finish) finish();
  }
  hit(): void { /* portals are not hittable */ }
  die(_e: number, done: () => void): void { if (this.dying || this.destroyed) return; this.dying = true; this.done = done; }
  destroy(): void { if (this.destroyed) return; this.destroyed = true; this.done = null; this.root.destroy({ children: true }); }
}

