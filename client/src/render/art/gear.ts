// Paper-doll parts: body, hair and every equippable item shape, drawn side-on facing right.
// Coordinates are local to each part's pivot (see player.ts for the rig). Item looks supply primary
// (main material) and secondary (trim) colours; `variant` adds small details; glowing (legendary / set)
// pieces get emissive trims here and auras in the view.

import type { ClassId, ItemLook } from '@shared/types';
import { CLASSES } from '@shared/data/classes';
import {
  OUT, OW, OW_THIN, arcPts, ball, blob, blobPath, crease, detail, eye, fill, flat, flatBlob, gem, gloss, line, outline, poly, rbox, rivet,
  inSilhouette, seg, spark, star, stitch, wash, type Ctx,
} from './draw';
import { BLUSH, BONE, GOLD, OUTFIT, WOOD, WOOD_DARK } from './palette';
import { light, mix, shade } from './util';

export interface Body {
  cls: ClassId;
  skin: number;
  hair: number;
  hairStyle: string;
  eyes: number;
}

export function classBody(cls: ClassId): Body {
  const a = CLASSES[cls].appearance;
  return { cls, skin: a.skin, hair: a.hair, hairStyle: a.hairStyle, eyes: a.eyes };
}

/** Trim colour: emissive towards the glow on legendary / set pieces. */
export function trim(l: ItemLook): number {
  return l.glow ? mix(l.secondary, light(l.glow, 0.25), 0.45) : l.secondary;
}

/** Rarity as encoded by makeLook(): glow = legendary/set, blue trim = magic, gold trim = rare. */
export function rarityOf(l: ItemLook): 'normal' | 'magic' | 'rare' | 'legend' {
  if (l.glow) return 'legend';
  if (l.secondary === 0x5a7dff) return 'magic';
  if (l.secondary === 0xd4b13a) return 'rare';
  return 'normal';
}

const back = (c: number, isBack: boolean) => (isBack ? shade(c, 0.2) : c);

// ═══════════════════════════════ LEGS & FEET ═══════════════════════════════
// Leg pivot at the hip joint; the sole is at y = 12, toes point +x.

export function drawLeg(c: Ctx, b: Body, legs: ItemLook | undefined, feet: ItemLook | undefined, isBack: boolean, part: 'all' | 'leg' | 'foot' = 'all'): void {
  const o = OUTFIT[b.cls];
  const shape = legs?.shape ?? 'base';
  const pc = back(legs?.primary ?? o.pants, isBack);
  const sc = back(legs ? trim(legs) : shade(o.pants, 0.3), isBack);

  // thigh / shin
  if (part !== 'foot') {
  if (shape === 'plate') {
    rbox(c, -4, -2, 8.2, 10.5, 3.2, pc, { hl: 0.4 });
    ball(c, 0.6, 4.4, 3.3, 2.8, light(pc, 0.12), { ow: 1.8, hl: 0.5 });
    if (!isBack) { c.circle(0.6, 4.4, 1.2); fill(c, sc); }
    crease(c, [-3, 0.6, 3.6, 0.6], 1, OUT, 0.35);
  } else if (shape === 'leather') {
    rbox(c, -3.7, -2, 7.4, 10.5, 3, pc, { hl: 0.25 });
    ball(c, 0.8, 4, 2.6, 2.2, sc, { ow: 1.4, hl: 0.3 });
    stitch(c, [-2.2, -1, -2.2, 7], light(pc, 0.5), 1.4, 1.2, 0.7, 0.6);
  } else if (shape === 'cloth') {
    rbox(c, -3.5, -2, 7, 10.5, 3, pc, { hl: 0.25 });
    c.roundRect(-3.5, 5.4, 7, 2, 0.8); fill(c, sc);
    crease(c, [0.5, -0.5, 1.2, 3.5], 0.9, OUT, 0.3);
  } else {
    rbox(c, -3.5, -2, 7, 10.5, 3, pc, { hl: 0.2 });
    crease(c, [0.4, 0, 1, 4], 0.9, OUT, 0.28);
  }

  }
  if (part === 'leg') return;
  // foot
  const fshape = feet?.shape ?? 'base';
  const fp = back(feet?.primary ?? o.shoes, isBack);
  const fs = back(feet ? trim(feet) : shade(o.shoes, 0.35), isBack);
  if (fshape === 'boots') {
    rbox(c, -4.1, 2.6, 8.2, 7.5, 2.6, fp, { hl: 0.25 });
    blob(c, [-4.2, 8.4, -1, 7.4, 4, 8, 7.8, 9.6, 8.2, 12.2, -4.2, 12.2], fp, { hl: 0.2 });
    rbox(c, -4.6, 1.6, 9.2, 3.2, 1.6, fs, { ow: 1.8, hl: 0.35 });
    c.rect(-4, 11.2, 12, 1); fill(c, shade(fp, 0.45));
    c.moveTo(-4.2, 12.3).lineTo(8.1, 12.3); outline(c, 1.4);
  } else if (fshape === 'greaves') {
    rbox(c, -4.3, 2.2, 8.6, 7.6, 2.4, fp, { hl: 0.45 });
    poly(c, [-4.4, 8, 3.5, 7.6, 10.2, 10.6, 9.6, 12.4, -4.4, 12.4], fp, { hl: 0.35, px: -0.3 });
    crease(c, [1.5, 7.9, 3.2, 12.2], 1, OUT, 0.5);
    crease(c, [4.6, 8.6, 6.2, 12.2], 1, OUT, 0.5);
    c.roundRect(-4.5, 2.2, 9, 2.2, 1); fill(c, fs); c.roundRect(-4.5, 2.2, 9, 2.2, 1); outline(c, 1.4);
  } else if (fshape === 'shoes') {
    blob(c, [-3.8, 8.2, 0, 7.2, 5, 8, 9.4, 8.6, 10.6, 6.6, 11.6, 9.8, 8.6, 12.2, -3.8, 12.2], fp, { hl: 0.25 });
    c.circle(10.9, 6.9, 1.2); fill(c, fs);
    crease(c, [-3.2, 8.6, 3.4, 8.4], 1.3, fs, 0.95);
  } else {
    blob(c, [-3.8, 8, 0, 7.2, 4.6, 8, 7.4, 9.8, 7.4, 12.2, -3.8, 12.2], fp, { hl: 0.2 });
  }
}

// ═══════════════════════════════ TORSO ═══════════════════════════════
// Pivot at the hips; the neck is at (1, -20). Ground is at y = +12.

const TORSO = [-8.2, -21.5, 1, -23, 9.4, -21, 10.8, -10, 11.2, 0.6, 1, 2, -10.4, 0.6, -10.2, -10];

export function drawTorso(c: Ctx, b: Body, chest: ItemLook | undefined, waist: ItemLook | undefined): void {
  const o = OUTFIT[b.cls];
  const shape = chest?.shape ?? 'base';
  const p = chest?.primary ?? o.shirt;
  const s = chest ? trim(chest) : o.trim;

  switch (shape) {
    case 'robe': {
      const pts = [-8.4, -21.5, 1, -23, 9.6, -21, 11, -9, 13.6, 6, 14.2, 10.4, 1, 11.4, -12.6, 10.4, -12.2, 5, -10.4, -9];
      blob(c, pts, p, { hl: 0.18, inset: 0.88 });
      // centre panel + hem
      wash(c, (k) => k.poly([3.8, -20, 7.6, -20, 9.4, 11, 2.2, 11.2], true), s, 0.95);
      crease(c, [3.8, -20, 2.2, 11.2], 1.1, OUT, 0.55);
      crease(c, [7.6, -20, 9.4, 11], 1.1, OUT, 0.55);
      wash(c, (k) => k.poly([-12.5, 8.2, 14, 8.2, 14.2, 10.4, 1, 11.4, -12.6, 10.4], true), shade(s, 0.15), 0.9);
      crease(c, [-6, -6, -7.6, 8], 1, OUT, 0.25);
      crease(c, [0, -2, -1, 9], 1, OUT, 0.22);
      collar(c, s);
      if (chest!.variant >= 2) { star(c, 5.8, -9, 5, 2.4, 1, light(s, 0.3)); star(c, 6, 2, 4, 1.8, 0.7, light(s, 0.3)); }
      blobOutlineOnly(c, pts);
      break;
    }
    case 'plate': {
      const pts = [-8.6, -21.5, 1, -23.4, 10, -21, 12.2, -12, 11.4, -3, 1, -1.4, -10.4, -3, -10.4, -11];
      blob(c, pts, p, { hl: 0.42, inset: 0.86 });
      gloss(c, 4.6, -15, 3.2, 5.2, 0.35);
      crease(c, [6.6, -21, 8.8, -12, 7, -3], 1.1, OUT, 0.35);
      // fauld lames
      for (let i = 0; i < 2; i++) {
        const y = -3.6 + i * 3.4;
        rbox(c, -10.8, y, 22.6, 4, 1.6, i === 1 ? shade(p, 0.12) : p, { ow: 1.8, hl: 0.3 });
      }
      c.roundRect(-10.8, 2.6, 22.6, 1.6, 0.6); fill(c, s);
      // gorget
      rbox(c, -6, -24.2, 13.6, 4.2, 2, s, { ow: 1.8, hl: 0.4 });
      rivet(c, -7.4, -13); rivet(c, 9.6, -16);
      if (chest!.variant % 2 === 1) { c.poly([4.2, -17, 6.6, -12.6, 4.2, -8.2, 1.8, -12.6], true); fill(c, s); c.poly([4.2, -17, 6.6, -12.6, 4.2, -8.2, 1.8, -12.6], true); outline(c, 1.2); }
      break;
    }
    case 'mail': {
      const pts = [-8.4, -21.5, 1, -23, 9.6, -21, 11.2, -10, 12, 4, 1, 5.2, -11.2, 4, -10.4, -10];
      blob(c, pts, p, { hl: 0.25 });
      // ring rows
      for (let r = 0; r < 7; r++) {
        const y = -19 + r * 3.3;
        for (let x = -8 + (r % 2) * 1.6; x < 10.5; x += 3.2) c.moveTo(x - 1.45, y).arc(x, y, 1.45, Math.PI, 0, true);
      }
      detail(c, 0.8, shade(p, 0.45), 0.75);
      c.roundRect(-11.2, 2, 23.2, 2.4, 1); fill(c, s); c.roundRect(-11.2, 2, 23.2, 2.4, 1); outline(c, 1.3);
      collar(c, s);
      blobOutlineOnly(c, pts);
      break;
    }
    case 'leather': {
      const pts = [-8.4, -21.5, 1, -23, 9.6, -21, 11, -10, 11.4, 2, 1, 3.4, -10.6, 2, -10.4, -10];
      blob(c, pts, p, { hl: 0.22 });
      // front lacing
      crease(c, [7.4, -19, 8.4, 0], 1.2, shade(p, 0.45), 0.9);
      for (let i = 0; i < 5; i++) { const y = -17 + i * 3.4; crease(c, [6.2, y, 9.4, y + 1.6], 1, s, 1); crease(c, [9.4, y, 6.4, y + 1.6], 1, s, 1); }
      stitch(c, [-9.4, 0.4, 10.4, 0.4], light(p, 0.45), 1.4, 1.2);
      // shoulder strap
      c.poly([-6, -21.6, -2.6, -22.6, 5.6, -6, 2.6, -5.2], true); fill(c, shade(p, 0.25));
      crease(c, [-6, -21.6, 2.6, -5.2], 0.8, OUT, 0.5);
      c.roundRect(-1.6, -15.6, 3.4, 3.4, 0.8); fill(c, GOLD);
      collar(c, shade(p, 0.25));
      blobOutlineOnly(c, pts);
      break;
    }
    case 'tunic': {
      const pts = [-8.4, -21.5, 1, -23, 9.6, -21, 11, -10, 12.4, 3, 1, 4.4, -11.6, 3, -10.4, -10];
      blob(c, pts, p, { hl: 0.22 });
      c.poly([-11.4, 0.6, 12.2, 0.6, 12.4, 3, 1, 4.4, -11.6, 3], true); fill(c, s);
      crease(c, [-11.4, 0.6, 12.2, 0.6], 1, OUT, 0.5);
      // V neck
      c.poly([3.2, -21.6, 9.2, -21.2, 6.6, -15], true); fill(c, b.skin);
      crease(c, [3.2, -21.6, 6.6, -15, 9.2, -21.2], 1.6, s, 1);
      crease(c, [-4, -14, -5.4, -2], 1, OUT, 0.22);
      blobOutlineOnly(c, pts);
      break;
    }
    default: {
      blob(c, TORSO, p, { hl: 0.2 });
      c.poly([3.4, -21.4, 8.6, -21, 6.2, -16.6], true); fill(c, shade(p, 0.35));
      crease(c, [-5, -14, -6, -3], 1, OUT, 0.22);
      blobOutlineOnly(c, TORSO);
    }
  }

  // waist
  if (waist) drawWaist(c, waist, shape === 'robe' ? -5 : -4.4);
}

function blobOutlineOnly(c: Ctx, pts: number[]): void {
  blobPath(c, pts); outline(c, OW);
}

function collar(c: Ctx, col: number): void {
  c.ellipse(1.2, -21.6, 7.4, 2.2); fill(c, col);
  c.ellipse(1.2, -21.6, 7.4, 2.2); outline(c, 1.4);
}

export function drawWaist(c: Ctx, w: ItemLook, y: number): void {
  const p = w.primary, s = trim(w);
  if (w.shape === 'sash') {
    rbox(c, -11, y - 1.6, 23, 4.4, 1.8, p, { ow: 1.8, hl: 0.3 });
    // knot + tails at the front
    blob(c, [7.4, y + 1.6, 10, y + 2.6, 12.4, y + 11.6, 9.4, y + 12, 8.4, y + 6], p, { ow: 1.6 });
    blob(c, [9.4, y + 1.2, 11.6, y + 2, 14.6, y + 9, 12.4, y + 9.8], shade(p, 0.15), { ow: 1.6 });
    ball(c, 9.6, y + 0.8, 2.6, 2.4, s, { ow: 1.6 });
    crease(c, [-10, y + 0.6, 7, y + 0.6], 0.9, s, 0.9);
  } else {
    rbox(c, -11, y - 1.4, 23, 3.8, 1.2, p, { ow: 1.8, hl: 0.25 });
    stitch(c, [-10, y + 0.5, 6, y + 0.5], light(p, 0.45), 1.2, 1);
    // buckle
    c.roundRect(5.6, y - 2.4, 5.6, 5.8, 1.2); fill(c, s);
    c.roundRect(5.6, y - 2.4, 5.6, 5.8, 1.2); outline(c, 1.4);
    c.roundRect(7.2, y - 0.8, 2.4, 2.6, 0.5); fill(c, shade(s, 0.5));
    if (w.variant >= 2) { rbox(c, -10.6, y + 1, 5, 5, 1.4, shade(p, 0.12), { ow: 1.5 }); }
    if (w.glow) gem(c, 8.4, y + 0.5, 1.5, light(w.glow, 0.3), 0.9);
  }
}

// ═══════════════════════════════ ARMS & HANDS ═══════════════════════════════
// Arm pivot at the shoulder, hanging down to the hand at (0, 10.5).

export function drawArm(c: Ctx, b: Body, chest: ItemLook | undefined, isBack: boolean): void {
  const o = OUTFIT[b.cls];
  const shape = chest?.shape ?? 'base';
  const p = back(chest?.primary ?? o.shirt, isBack);
  const s = back(chest ? trim(chest) : o.trim, isBack);
  const skin = back(b.skin, isBack);
  switch (shape) {
    case 'robe':
      poly(c, [-2.8, -2.2, 2.8, -2.2, 5.4, 9.6, -3.8, 9.6], p, { hl: 0 });
      c.poly([-3.8, 7.6, 5, 7.6, 5.4, 9.6, -3.8, 9.6], true); fill(c, s);
      c.poly([-2.8, -2.2, 2.8, -2.2, 5.4, 9.6, -3.8, 9.6], true); outline(c, OW);
      break;
    case 'plate':
      rbox(c, -2.6, 2, 5.2, 8, 2.4, skin, { hl: 0 });
      rbox(c, -3.4, -2.4, 6.8, 6.6, 2.6, p, { hl: 0.45 });
      rbox(c, -3.2, 3.4, 6.4, 3.4, 1.6, shade(p, 0.1), { ow: 1.6, hl: 0.3 });
      break;
    case 'mail':
      rbox(c, -2.9, -2.2, 5.8, 11.4, 2.6, p, { hl: 0.2 });
      for (let y = 0; y < 8; y += 2.6) { c.moveTo(-1.6, y).arc(0, y, 1.4, Math.PI, 0, true).moveTo(1.6, y + 1.3).arc(2.2, y + 1.3, 0.8, Math.PI, 0, true); }
      detail(c, 0.7, shade(p, 0.45), 0.7);
      break;
    case 'leather':
      rbox(c, -2.6, -1, 5.2, 10.4, 2.4, skin, { hl: 0.15 });
      rbox(c, -3.2, -2.4, 6.4, 6, 2.4, p, { hl: 0.2 });
      break;
    case 'tunic':
      rbox(c, -2.9, -2.2, 5.8, 11.6, 2.6, p, { hl: 0.2 });
      c.roundRect(-2.9, 6.8, 5.8, 2.2, 0.8); fill(c, s);
      c.roundRect(-2.9, -2.2, 5.8, 11.6, 2.6); outline(c, OW);
      break;
    default:
      rbox(c, -2.6, -1, 5.2, 10.4, 2.4, skin, { hl: 0.15 });
      rbox(c, -3.1, -2.4, 6.2, 5.6, 2.4, p, { hl: 0.2 });
  }
}

/** Hand (centre at origin). Gloves change the silhouette: gauntlets are chunky, wraps trail a strip. */
export function drawHand(c: Ctx, b: Body, hands: ItemLook | undefined, isBack: boolean): void {
  const skin = back(b.skin, isBack);
  if (!hands) { ball(c, 0, 0, 3.3, 3.3, skin, { hl: 0.25 }); return; }
  const p = back(hands.primary, isBack), s = back(trim(hands), isBack);
  switch (hands.shape) {
    case 'gauntlets':
      poly(c, [-4.4, -6.4, 4.4, -6.4, 3.4, -1.6, -3.4, -1.6], s, { ow: 2, hl: 0.3 });
      ball(c, 0.2, 0.6, 4.3, 4.1, p, { hl: 0.45 });
      crease(c, [1.6, -2.4, 3.6, 1.6], 1, OUT, 0.45);
      if (hands.variant >= 2) { spark(c, -4.6, -5.2, 1.6, s); }
      break;
    case 'wraps':
      if (!isBack) line(c, (k) => k.moveTo(-2.2, -3).quadraticCurveTo(-5.6, 0, -4.4, 4.6), 1.4, s, 1.4, false);
      ball(c, 0, 0, 3.5, 3.4, p, { hl: 0.25 });
      crease(c, [-3, -1.4, 3, -0.6], 1.2, s, 1);
      crease(c, [-3, 1.2, 3, 2], 1.2, s, 1);
      break;
    default: // gloves
      poly(c, [-3.8, -5.6, 3.8, -5.6, 3, -1.4, -3, -1.4], s, { ow: 1.8, hl: 0.25 });
      ball(c, 0, 0.2, 3.6, 3.5, p, { hl: 0.3 });
  }
}

// ═══════════════════════════════ SHOULDERS ═══════════════════════════════
// Pivot at the shoulder joint.

export function drawShoulder(c: Ctx, l: ItemLook, isBack: boolean): void {
  const p = back(l.primary, isBack), s = back(trim(l), isBack);
  switch (l.shape) {
    case 'plate':
      ball(c, 0.6, -0.6, 8.4, 6.2, p, { hl: 0.5 });
      wash(c, (k) => k.ellipse(0.6, 2.6, 7.4, 2.4), s, 1);
      c.ellipse(0.6, -0.6, 8.4, 6.2); outline(c, OW);
      if (!isBack) { rivet(c, 0.6, -2.4); if (l.variant >= 2) rivet(c, -4.4, -0.4); }
      break;
    case 'spiked':
      for (const [x, h] of [[-4.6, 7.4], [0.6, 9.6], [5.4, 7.2]] as const) {
        poly(c, [x - 2.2, -3, x + 2.2, -3, x + 0.6, -3 - h], light(s, 0.15), { ow: 1.8, hl: 0 });
      }
      ball(c, 0.6, -0.4, 8.2, 6, p, { hl: 0.45 });
      wash(c, (k) => k.ellipse(0.6, 2.6, 7.2, 2.2), s, 1);
      c.ellipse(0.6, -0.4, 8.2, 6); outline(c, OW);
      break;
    case 'mantle':
      blob(c, [-8, -1, -3, -5.6, 5, -5.6, 9.6, -0.6, 9, 4.6, 0, 6.2, -8.4, 4], p, { hl: 0.22 });
      crease(c, [-7.6, 3.4, 0, 5.2, 8.6, 3.8], 1.6, s, 1);
      if (l.variant >= 1 && !isBack) star(c, 1.6, 0.2, 5, 2.2, 0.95, light(s, 0.35));
      break;
    default: { // pads: two leather lames with trimmed edges
      const lame = (y: number, w: number, h: number, col: number) => {
        blob(c, [-w, y, -w * 0.6, y - h, w * 0.6, y - h, w + 0.6, y, w * 0.7, y + h * 0.7, -w * 0.7, y + h * 0.7], col, { ow: 2, hl: 0.2 });
        crease(c, [-w * 0.75, y + h * 0.45, w * 0.8, y + h * 0.45], 1.3, s, 0.95);
      };
      lame(3.2, 6.4, 3, shade(p, 0.14));
      lame(-0.6, 7.2, 3.6, p);
      if (!isBack) rivet(c, 0.6, -1.6, 0.9, light(s, 0.3));
    }
  }
}

/** Mantle back cape (behind the body). Pivot at the hips like the torso. */
export function drawMantleCape(c: Ctx, l: ItemLook): void {
  const p = shade(l.primary, 0.18), s = trim(l);
  blob(c, [-6, -22, 4, -22, 0, -10, -6, 0, -12, 2.4, -15, -2, -12, -14], p, { hl: 0 });
  crease(c, [-12.6, 1.4, -6.4, -0.6], 1.6, s, 1);
}

// ═══════════════════════════════ HEAD ═══════════════════════════════
// Pivot at the neck. Head centre (0.5, -13.5), rx 16, ry 15. Face looks right (+x).

export const HEAD = { x: 0.5, y: -13.5, rx: 16, ry: 15 };

/** Hair shine: two short light arcs (reads as hair, unlike the single gloss oval used on metal). */
function shine(c: Ctx, col: number, x: number, y: number, w: number, a = 0.55): void {
  if (inSilhouette()) return;
  c.moveTo(x - w, y + 1.4).quadraticCurveTo(x - w * 0.45, y - 0.6, x, y + 0.2);
  c.moveTo(x + w * 0.25, y + 0.1).quadraticCurveTo(x + w * 0.6, y - 0.4, x + w, y + 0.9);
  c.stroke({ width: 1.6, color: light(col, 0.7), alpha: a, cap: 'round' });
}

function hairShape(c: Ctx, pts: number[], col: number, smooth: boolean): void {
  if (smooth) blobPath(c, pts); else c.poly(pts, true);
  fill(c, col);
}
function hairOutline(c: Ctx, pts: number[], smooth: boolean): void {
  if (smooth) blobPath(c, pts); else c.poly(pts, true);
  outline(c, OW);
}

function hairFront(c: Ctx, b: Body, coverTop: boolean): void {
  if (b.hairStyle === 'none') return;
  const h = b.hair;
  const dk = shade(h, 0.32);
  const { x: hx, y: hy } = HEAD;
  const P = (pts: number[]) => pts.map((v, i) => (i % 2 === 0 ? hx + v : hy + v));
  if (b.hairStyle === 'spiky') {
    if (!coverTop) { const f = P([6, -10, 16, -5.6, 9.6, -4.4, 10.6, -1, 4, -6]); hairShape(c, f, h, false); hairOutline(c, f, false); return; }
    const pts = P([16.6, -3.4, 11.4, -7.4, 10.4, -1.6, 5.2, -8.2, -2, -8.4, -8.6, -4.4, -12.4, 3.6, -15.6, 8.6,
      -18.6, 4.4, -26, 1, -18.8, -4.8, -25.6, -13.4, -15.6, -14.6, -19.4, -25.6, -8.4, -19.4, -4.6, -30.4, 1.6, -19.8,
      10.6, -27.4, 11.8, -16.4, 20.6, -11.6]);
    hairShape(c, pts, h, false);
    // shade band at the back / nape
    wash(c, (k) => k.poly(P([-12.4, 3.6, -15.6, 8.6, -18.6, 4.4, -26, 1, -18.8, -4.8, -14, -4, -10, -2]), true), dk, 0.75);
    crease(c, P([-9, -12, -4, -16]), 1.1, dk, 0.8);
    crease(c, P([2, -12, 6, -15.6]), 1.1, dk, 0.8);
    shine(c, h, hx - 3.6, hy - 15, 6);
    hairOutline(c, pts, false);
  } else if (b.hairStyle === 'ponytail') {
    if (!coverTop) { const f = P([5, -10, 15, -6.4, 14.4, -1.2, 8.6, -5]); hairShape(c, f, h, true); hairOutline(c, f, true); return; }
    const pts = P([16.6, -0.6, 15.6, -8.8, 9.6, -15.8, 0, -18.6, -9.4, -17, -16.2, -10, -17.6, -1, -16.4, 7.4, -12.6, 6.8,
      -11.6, -1.6, -8.4, -7.2, -4, -5.4, -1.6, -9.4, 2.6, -4.2, 5.6, -9.8, 9.6, -2.6, 12.2, -8.2]);
    hairShape(c, pts, h, false);
    wash(c, (k) => k.poly(P([-11.6, -1.6, -16.8, -4, -17.4, 2, -16.4, 7.4, -12.6, 6.8]), true), dk, 0.8);
    crease(c, P([-6, -15.4, -10.6, -6]), 1, dk, 0.85);
    crease(c, P([3, -16.6, 1.4, -11]), 1, dk, 0.7);
    crease(c, P([10, -13, 8, -7]), 1, dk, 0.6);
    shine(c, h, hx - 1.4, hy - 14.2, 6.4, 0.5);
    hairOutline(c, pts, false);
  } else { // long
    if (!coverTop) { const f = P([4, -10, 14.6, -6.4, 13.6, -1, 8, -5.4]); hairShape(c, f, h, true); hairOutline(c, f, true); return; }
    const pts = P([16.8, 0.6, 15.8, -9.4, 9.4, -16.6, -0.6, -19, -10.6, -16.6, -17, -9, -18.2, 2, -17.4, 14, -12.6, 17.4,
      -10.4, 9, -8.6, 2, -6.6, -6.2, -2.6, -3, -0.4, -9.4, 3.6, -3.8, 6, -10, 10, -2.2, 12.6, -8.8, 14.4, -2.6]);
    hairShape(c, pts, h, false);
    wash(c, (k) => k.poly(P([-8.6, 2, -14, -6, -17.6, 2, -17.2, 13, -12.6, 17.4, -10.4, 9]), true), dk, 0.5);
    crease(c, P([-7.6, -15, -12.6, -3, -13.6, 11]), 1, dk, 0.8);
    crease(c, P([1, -17, -1.6, -11]), 1, dk, 0.7);
    crease(c, P([9, -14.6, 7.6, -8]), 1, dk, 0.6);
    shine(c, h, hx - 2, hy - 14.6, 6.6, 0.75);
    hairOutline(c, pts, false);
  }
}

/** Hair or hood tail behind the body (pivot at the neck). */
export function drawHairBack(c: Ctx, b: Body, head: ItemLook | undefined): boolean {
  const shape = head?.shape;
  const covers = shape === 'hood' || shape === 'helm' || shape === 'helm_horned';
  const { x: hx, y: hy } = HEAD;
  if (shape === 'hood') {
    const p = shade(head!.primary, 0.12);
    blob(c, [hx - 10, hy - 14, hx - 17, hy - 6, hx - 26, hy + 6, hx - 24, hy + 13, hx - 14, hy + 10, hx - 4, hy + 2], p, { hl: 0 });
    crease(c, [hx - 23, hy + 9, hx - 15, hy + 7], 1.3, trim(head!), 1);
    return true;
  }
  if (covers) return false;
  if (b.hairStyle === 'ponytail') {
    const h = b.hair;
    blob(c, [hx - 13, hy - 9, hx - 22, hy - 6, hx - 28, hy + 4, hx - 26, hy + 18, hx - 22, hy + 22, hx - 20, hy + 12, hx - 17, hy + 4, hx - 11, hy - 1], h, { hl: 0.2 });
    rbox(c, hx - 18, hy - 8.6, 4.4, 6.4, 1.6, OUTFIT[b.cls].band, { ow: 1.6, hl: 0.3 });
    return true;
  }
  if (b.hairStyle === 'long') {
    const h = shade(b.hair, 0.08);
    blob(c, [hx - 14, hy - 10, hx - 18.6, hy + 2, hx - 19, hy + 18, hx - 14, hy + 26, hx - 6, hy + 24, hx - 3, hy + 14, hx - 2, hy + 2], h, { hl: 0.15 });
    crease(c, [hx - 13, hy + 4, hx - 12, hy + 22], 1, shade(h, 0.3), 0.6);
    return true;
  }
  return false;
}

export function drawHead(c: Ctx, b: Body, head: ItemLook | undefined, icon = false): void {
  const { x: hx, y: hy, rx, ry } = HEAD;
  const shape = head?.shape;
  const p = head?.primary ?? 0, s = head ? trim(head) : 0;

  // helmet back layer (behind the face)
  if (shape === 'helm_horned') {
    // far horn (behind)
    const hc = head!.variant === 3 ? light(s, 0.2) : BONE;
    blob(c, [hx - 8, hy - 12, hx - 15, hy - 22, hx - 20, hy - 34, hx - 15, hy - 33, hx - 9, hy - 25, hx - 2, hy - 17], shade(hc, 0.2), { ow: OW });
  }

  // face (icons: a dark hollow for helms / hoods, nothing for hats)
  if (!icon) {
    ball(c, hx, hy, rx, ry, b.skin, { hl: 0.22, inset: 0.9, sh: 0.22 });
    if (!shape || (shape !== 'helm' && shape !== 'helm_horned')) wash(c, (k) => k.ellipse(hx + 11.4, hy + 6.4, 2.8, 1.5), BLUSH, 0.5);
    else wash(c, (k) => k.ellipse(hx + 11.6, hy + 6.6, 2.6, 1.4), BLUSH, 0.45);
  } else if (shape === 'helm' || shape === 'helm_horned' || shape === 'hood') {
    c.ellipse(hx + 1, hy, rx - 1, ry - 1); fill(c, 0x231a18);
  }

  switch (shape) {
    case 'hood': {
      // cowl: covers the top and back of the head; the face is open at the front
      const P = (pts: number[]) => pts.map((v, i) => (i % 2 === 0 ? hx + v : hy + v));
      const cowl = P([18.4, -6.6, 14.6, -14.4, 4, -20.2, -8.6, -19, -17.4, -11.4, -20, 1, -18.6, 12, -12.6, 16.8, -4.2, 16,
        -1.6, 9, 0.6, 1.6, 3.4, -5.4, 8.4, -9, 13.4, -8.6]);
      blob(c, cowl, p, { hl: 0.18, inset: 0.9 });
      // inner shadow band along the opening + trim
      line(c, (k) => k.moveTo(hx + 14, hy - 7.6).quadraticCurveTo(hx + 4.6, hy - 9.6, hx + 2, hy - 2).quadraticCurveTo(hx, hy + 8, hx - 3.2, hy + 15.4), 2, s, 1.2, false);
      wash(c, (k) => k.ellipse(hx + 8, hy - 6.4, 7.6, 2.2), OUT, 0.16);
      crease(c, P([-6, -16, -12, -4, -11, 10]), 1.1, shade(p, 0.4), 0.7);
      if (head!.variant >= 2) crease(c, P([-15, -12, -3, -18.6]), 1.4, s, 0.9);
      blobOutlineOnly(c, cowl);
      break;
    }
    case 'helm':
    case 'helm_horned': {
      hairFront(c, b, false);
      const dome = [hx - 17.8, hy + 8, hx - 18.8, hy - 6, hx - 10, hy - 18.8, hx + 4, hy - 19.4, hx + 15.4, hy - 11.4, hx + 17.6, hy - 5, hx + 7, hy - 5.8, hx + 1.4, hy - 4, hx - 0.6, hy + 10.4, hx - 9, hy + 12.6];
      blob(c, dome, p, { hl: 0.45, inset: 0.86 });
      gloss(c, hx - 5, hy - 13, 5.4, 2, 0.45);
      crease(c, [hx + 15, hy - 10.6, hx + 2, hy - 18.4, hx - 12, hy - 15.6], 1.2, shade(p, 0.45), 0.55);
      crease(c, [hx - 0.6, hy - 3.4, hx - 2.2, hy + 10], 1.1, shade(p, 0.45), 0.6);
      // brow band
      line(c, (k) => k.moveTo(hx - 17.4, hy - 3.8).quadraticCurveTo(hx, hy - 9.6, hx + 16.6, hy - 5.6), 2.6, s, 1.6, false);
      if (head!.variant === 1 || shape === 'helm_horned') { rbox(c, hx + 11.4, hy - 7, 3, 9.4, 1.2, p, { ow: 1.6, hl: 0.4 }); }
      if (head!.variant === 3) for (let i = 0; i < 4; i++) rivet(c, hx - 13 + i * 6.4, hy - 5.4 - Math.sin((i / 3) * Math.PI) * 2.6, 0.9);
      if (shape === 'helm' && head!.variant === 2) {
        blob(c, [hx - 4, hy - 18, hx + 4, hy - 23, hx - 2, hy - 26, hx - 14, hy - 24, hx - 22, hy - 16, hx - 15, hy - 16], s, { ow: OW, hl: 0.3 });
      }
      if (shape === 'helm_horned') {
        const hc = head!.variant === 3 ? light(s, 0.2) : BONE;
        blob(c, [hx + 2, hy - 15, hx + 11, hy - 23, hx + 14, hy - 36, hx + 19, hy - 34, hx + 17, hy - 22, hx + 10, hy - 13], hc, { ow: OW, hl: 0.3 });
        crease(c, [hx + 10, hy - 22, hx + 15, hy - 21], 1, shade(hc, 0.45), 0.8);
        crease(c, [hx + 12, hy - 28, hx + 16.6, hy - 27], 1, shade(hc, 0.45), 0.8);
        line(c, (k) => k.moveTo(hx + 1, hy - 14.6).lineTo(hx + 10.6, hy - 13.4), 2.4, s, 1.4, false);
      }
      break;
    }
    case 'wizard_hat': {
      hairFront(c, b, false);
      // hair peeking out the back
      if (b.hairStyle !== 'none') blob(c, [hx - 16.6, hy + 6, hx - 17, hy - 8, hx - 8, hy - 11, hx - 6, hy - 2, hx - 10, hy + 6], b.hair, { ow: OW, hl: 0 });
      // cone with the tip flopping back
      const cone = [hx - 11, hy - 13.4, hx - 6, hy - 25, hx - 6, hy - 34, hx - 12, hy - 41, hx - 21, hy - 41.6, hx - 16, hy - 38, hx - 1, hy - 34,
        hx + 4, hy - 25, hx + 10.6, hy - 13.4];
      blob(c, cone, p, { hl: 0.22, inset: 0.88 });
      // band
      c.poly([hx - 10.4, hy - 17, hx + 9.4, hy - 17, hx + 10.6, hy - 13.4, hx - 11, hy - 13.4], true); fill(c, s);
      crease(c, [hx - 10.4, hy - 17, hx + 9.4, hy - 17], 1, OUT, 0.5);
      // brim
      ball(c, hx - 0.4, hy - 12.6, 22, 4.6, p, { hl: 0.25, sh: 0.35 });
      if (head!.variant >= 1) star(c, hx - 2.4, hy - 27, 5, 2.8, 1.2, light(s, 0.4), 1.1);
      if (head!.variant >= 3) { c.circle(hx - 20.6, hy - 41, 2); fill(c, light(s, 0.3)); }
      break;
    }
    case 'cap': {
      hairFront(c, b, true);
      const dome = [hx - 15.4, hy - 6, hx - 11, hy - 17, hx + 2, hy - 20.4, hx + 13, hy - 14, hx + 14, hy - 8.4, hx - 15.6, hy - 5];
      blob(c, dome, p, { hl: 0.3 });
      // brim forward
      blob(c, [hx + 6, hy - 10.6, hx + 24, hy - 9.8, hx + 24.6, hy - 7.2, hx + 6, hy - 6.8], shade(p, 0.15), { ow: OW, hl: 0 });
      c.poly([hx - 15.6, hy - 8.6, hx + 13.6, hy - 11.6, hx + 14.4, hy - 8.2, hx - 15.6, hy - 5], true); fill(c, s);
      crease(c, [hx - 15.6, hy - 8.6, hx + 13.6, hy - 11.6], 1, OUT, 0.5);
      if (head!.variant % 2 === 1) {
        blob(c, [hx - 12, hy - 10, hx - 22, hy - 22, hx - 28, hy - 26, hx - 22, hy - 16, hx - 16, hy - 9], light(s, 0.2), { ow: 1.8, hl: 0 });
        crease(c, [hx - 13, hy - 10, hx - 25, hy - 23], 0.8, shade(s, 0.4), 0.8);
      }
      blobOutlineOnly(c, dome);
      break;
    }
    case 'circlet': {
      hairFront(c, b, true);
      line(c, (k) => k.moveTo(hx - 15.8, hy - 6).quadraticCurveTo(hx - 2, hy - 12, hx + 14.8, hy - 9.4), 2, GOLD, 1.4, false);
      if (head!.variant >= 2) { spark(c, hx + 6, hy - 14.6, 2.6, light(s, 0.5)); }
      gem(c, hx + 13.4, hy - 10, 2.6, s, 1.2);
      break;
    }
    default:
      hairFront(c, b, true);
  }
}

/** Eyes (separate part so they can blink). Origin at the neck like the head. */
export function drawEyes(c: Ctx, b: Body, hooded: boolean): void {
  const { x: hx, y: hy } = HEAD;
  const ey = hy + 2.4;
  eye(c, hx + 4.6, ey, 1.75, 2.75, b.eyes);
  eye(c, hx + 11.6, ey, 1.75, 2.75, b.eyes);
  if (hooded) { /* hooded faces keep the same eyes (the opening is generous) */ }
}

// ═══════════════════════════════ WEAPONS ═══════════════════════════════
// Hand-local: grip at the origin, the business end points to -y.

export function drawWeapon(c: Ctx, l: ItemLook): void {
  const p = l.primary, s = trim(l), v = l.variant;
  const edge = light(p, 0.55);
  switch (l.shape) {
    case 'sword': {
      seg(c, 0, 3.6, 0, -3, 2.6, WOOD_DARK);
      ball(c, 0, 5, 2.2, 2.2, s, { ow: 1.6 });
      const blade = [-3, -5, 3, -5, 3, -25, 0, -31, -3, -25];
      poly(c, blade, p, { hl: 0, inset: 0.8, px: -0.4 });
      wash(c, (k) => k.poly([0.4, -5, 3, -5, 3, -25, 0.4, -30], true), edge, 0.55);
      if (v === 1 || v === 3) crease(c, [0, -6.5, 0, -22], 1.1, shade(p, 0.45), 0.8);
      c.poly(blade, true); outline(c, 2.2);
      rbox(c, -6.4, -6.2, 12.8, 3, 1.4, s, { ow: 1.8, hl: 0.4 });
      if (v === 2) { c.circle(-6.4, -4.7, 1.6); fill(c, s); c.circle(6.4, -4.7, 1.6); fill(c, s); }
      if (v === 3 || l.glow) gem(c, 0, -4.7, 1.6, l.glow ? light(l.glow, 0.2) : 0xd8364a, 1);
      break;
    }
    case 'axe': {
      seg(c, 0, 6, 0, -22, 2.8, WOOD);
      crease(c, [-1, 1, 1, 0], 1, s, 1); crease(c, [-1, 3, 1, 2], 1, s, 1);
      const head = [0, -24.6, 5, -26.6, 11, -27, 13.2, -21, 12.6, -14.6, 6.6, -14, 0, -15.6];
      poly(c, head, p, { hl: 0, inset: 0.8, px: -0.3 });
      wash(c, (k) => k.poly([10, -26.6, 13.2, -21, 12.6, -14.6, 10.4, -14.6, 11, -21], true), edge, 0.7);
      c.poly(head, true); outline(c, 2.2);
      if (v >= 2) poly(c, [-0.6, -24, -6.6, -21.6, -0.6, -17.4], shade(p, 0.1), { ow: 1.8 });
      rbox(c, -2, -26, 4, 11.6, 1.2, s, { ow: 1.6, hl: 0.3 });
      break;
    }
    case 'mace': {
      seg(c, 0, 5.6, 0, -15, 2.8, WOOD_DARK);
      crease(c, [-1, 2, 1, 1], 1, s, 1);
      if (v % 2 === 0) {
        for (let i = 0; i < 4; i++) {
          const a = -Math.PI / 2 + (i - 1.5) * 0.9;
          const x = Math.cos(a) * 5.4, y = -21 + Math.sin(a) * 5.4;
          poly(c, [x - 2, y + 1, x + Math.cos(a) * 4.8, y + Math.sin(a) * 4.8, x + 2, y - 1], light(p, 0.1), { ow: 1.6 });
        }
        poly(c, [-2, -24, 0, -30, 2, -24], light(p, 0.1), { ow: 1.6 });
      } else {
        for (const [x, y] of [[-6.6, -21], [6.6, -21], [0, -27.4]] as const) poly(c, [x - 2.4, y, x, y - 4, x + 2.4, y, x, y + 4], p, { ow: 1.8 });
      }
      ball(c, 0, -20.6, 6.2, 6.2, p, { hl: 0.5 });
      c.circle(0, -14.6, 2.4); fill(c, s); c.circle(0, -14.6, 2.4); outline(c, 1.4);
      if (l.glow) gem(c, 0, -20.6, 2, light(l.glow, 0.2), 1);
      break;
    }
    case 'sword2h': {
      seg(c, 0, 9, 0, -5, 3, WOOD_DARK);
      crease(c, [-1.4, 2, 1.4, 1], 1, s, 1); crease(c, [-1.4, 5, 1.4, 4], 1, s, 1);
      ball(c, 0, 10.4, 2.8, 2.6, s, { ow: 1.6 });
      const blade = [-3.8, -7.4, 3.8, -7.4, 4.2, -40, 0, -48, -4.2, -40];
      poly(c, blade, p, { hl: 0, inset: 0.82, px: -0.4 });
      wash(c, (k) => k.poly([0.4, -7.4, 3.8, -7.4, 4.2, -40, 0.4, -47], true), edge, 0.55);
      crease(c, [0, -9, 0, -37], 1.4, shade(p, 0.45), 0.7);
      if (v >= 2) { for (const y of [-14, -22, -30]) { c.poly([-4, y, -6, y + 2, -4.1, y + 4], true); fill(c, p); c.poly([-4, y, -6, y + 2, -4.1, y + 4], true); outline(c, 1.4); } }
      c.poly(blade, true); outline(c, 2.4);
      blob(c, [-10, -6.4, -6, -9.6, 0, -8.2, 6, -9.6, 10, -6.4, 6, -5.2, 0, -5.6, -6, -5.2], s, { ow: 2, hl: 0.4 });
      if (v === 3 || l.glow) gem(c, 0, -7.4, 2, l.glow ? light(l.glow, 0.2) : 0x3d8bff, 1.1);
      break;
    }
    case 'axe2h': {
      seg(c, 0, 11, 0, -38, 3.2, WOOD);
      for (const y of [4, 6.4, 8.8]) crease(c, [-1.6, y, 1.6, y - 1], 1.1, s, 1);
      const r = [0, -42, 7, -45.6, 14.6, -45, 17, -36, 15.6, -26.4, 8, -26.6, 0, -29];
      const lft = [0, -42, -6, -44.6, -12, -43, -13.6, -36, -12.4, -28.6, -6, -28.4, 0, -30];
      poly(c, lft, shade(p, 0.08), { hl: 0, inset: 0.8 });
      if (v % 2 === 1) wash(c, (k) => k.poly([-12, -43, -13.6, -36, -12.4, -28.6, -10.6, -29, -11.6, -36], true), edge, 0.6);
      poly(c, r, p, { hl: 0, inset: 0.8 });
      wash(c, (k) => k.poly([14, -45, 17, -36, 15.6, -26.4, 13.2, -26.8, 14.6, -36], true), edge, 0.7);
      c.poly(r, true); outline(c, 2.4);
      rbox(c, -2.6, -45, 5.2, 18, 1.6, s, { ow: 1.8, hl: 0.35 });
      if (l.glow) gem(c, 0, -36, 2, light(l.glow, 0.2), 1.1);
      poly(c, [-1.6, -45, 0, -50.6, 1.6, -45], light(p, 0.2), { ow: 1.6 });
      break;
    }
    case 'bow': {
      // limbs (the string is drawn live by the view so it can be drawn back)
      line(c, (k) => k.moveTo(-2.4, -21).quadraticCurveTo(-1.4, -23, 0.6, -19.6).quadraticCurveTo(7, -10, 2.8, -1.6), 2.8, p, OW);
      line(c, (k) => k.moveTo(-2.4, 21).quadraticCurveTo(-1.4, 23, 0.6, 19.6).quadraticCurveTo(7, 10, 2.8, 1.6), 2.8, p, OW);
      rbox(c, 0.2, -4.4, 4.4, 8.8, 1.8, s, { ow: 1.8, hl: 0.3 });
      if (v >= 2) { c.circle(-2.4, -21, 1.6); fill(c, s); c.circle(-2.4, 21, 1.6); fill(c, s); }
      if (l.glow) { gem(c, 2.4, 0, 1.6, light(l.glow, 0.2), 1); }
      break;
    }
    case 'crossbow': {
      // stock along -y (forward), prod across it near the front
      rbox(c, -2.8, -24, 5.6, 32, 2, p, { hl: 0.3 });
      c.roundRect(-2.8, 3, 5.6, 5, 1.6); fill(c, shade(p, 0.25));
      line(c, (k) => k.moveTo(-12, -16).quadraticCurveTo(0, -24, 12, -16), 2.6, s, OW);
      line(c, (k) => k.moveTo(-11.6, -16.6).lineTo(0, -12.6).lineTo(11.6, -16.6), 0.8, 0xe8dcc0, 1, false);
      seg(c, 0, -10, 0, -27, 1.4, 0x8a6a4a, 1.2, false);
      poly(c, [-1.6, -27, 0, -30.4, 1.6, -27], 0xc8ccd2, { ow: 1.2 });
      rbox(c, -3.4, -3.4, 6.8, 4, 1.2, s, { ow: 1.6, hl: 0.3 });
      if (l.glow) gem(c, 0, -20, 1.8, light(l.glow, 0.2), 1);
      break;
    }
    case 'handxbow': {
      rbox(c, -2.2, -14, 4.4, 16, 1.6, p, { hl: 0.3 });
      c.roundRect(-2.2, 0, 4.4, 5, 1.6); fill(c, shade(p, 0.25)); c.roundRect(-2.2, 0, 4.4, 5, 1.6); outline(c, 1.8);
      line(c, (k) => k.moveTo(-8.4, -9).quadraticCurveTo(0, -14.6, 8.4, -9), 2, s, OW);
      line(c, (k) => k.moveTo(-8, -9.4).lineTo(0, -6.6).lineTo(8, -9.4), 0.7, 0xe8dcc0, 0.9, false);
      seg(c, 0, -6, 0, -17, 1.1, 0x8a6a4a, 1, false);
      if (v >= 2) poly(c, [-2.2, -14, -5, -17, -2.2, -11], light(s, 0.1), { ow: 1.4 });
      if (l.glow) gem(c, 0, -3, 1.5, light(l.glow, 0.2), 0.9);
      break;
    }
    case 'staff': {
      line(c, (k) => k.moveTo(0, 22).quadraticCurveTo(-1, 0, 0, -36), 3, p, OW);
      crease(c, [-1.2, 8, 1.2, 7], 1.2, s, 1); crease(c, [-1.2, 10.6, 1.2, 9.6], 1.2, s, 1);
      const orb = l.glow ? light(l.glow, 0.15) : s;
      if (v === 1) {
        line(c, (k) => k.moveTo(0, -36).quadraticCurveTo(-9, -40, -6, -50).moveTo(0, -36).quadraticCurveTo(9, -40, 6, -50), 2.4, p, OW);
        ball(c, 0, -44, 3.6, 3.6, orb, { hl: 0.6 });
      } else if (v === 2) {
        line(c, (k) => k.ellipse(0, -44, 7.4, 8), 2.2, s, OW);
        gem(c, 0, -44, 3.6, orb);
      } else if (v === 3) {
        poly(c, [-3, -36, -6, -47, -1.2, -42], light(orb, 0.1), { ow: 1.6 });
        poly(c, [3, -36, 6.4, -46, 1.4, -42], light(orb, 0.1), { ow: 1.6 });
        poly(c, [-2.4, -36, 0, -53, 2.4, -36], orb, { ow: 1.8, hl: 0.5 });
      } else {
        line(c, (k) => k.moveTo(0, -36).bezierCurveTo(-8, -40, -8, -52, 1, -52).bezierCurveTo(8, -52, 9, -44, 3, -42.6), 3, p, OW);
        ball(c, 0.8, -45.4, 4, 4, orb, { hl: 0.6 });
      }
      break;
    }
    case 'wand': {
      line(c, (k) => k.moveTo(0, 4).lineTo(0, -14), 2.2, p, 2);
      c.roundRect(-1.8, -1, 3.6, 4.6, 1.2); fill(c, s); c.roundRect(-1.8, -1, 3.6, 4.6, 1.2); outline(c, 1.4);
      const tip = l.glow ? light(l.glow, 0.15) : light(s, 0.2);
      if (v % 2 === 0) star(c, 0, -17.6, 5, 4.6, 2, tip, 1.6);
      else gem(c, 0, -17, 3.4, tip);
      break;
    }
  }
}

// ═══════════════════════════════ OFF-HANDS ═══════════════════════════════

/** Shield face (centre at origin). */
export function drawShield(c: Ctx, l: ItemLook): void {
  const r = rarityOf(l), v = l.variant;
  const HERALD = [0x9a3b30, 0x2f5a8a, 0x8a6236, 0x3f6a3a];
  const rim = r === 'legend' ? trim(l) : r === 'rare' ? 0xd4b13a : l.primary;
  const face = r === 'legend' ? l.primary : r === 'magic' ? 0x34509e : r === 'rare' ? 0x7a2420 : HERALD[v];
  const emb = r === 'legend' ? light(trim(l), 0.25) : r === 'magic' ? 0x9ab4ff : r === 'rare' ? 0xf0cf5a : 0xe6d6ae;
  let pts: number[] = [];
  if (v === 1) pts = [-10.4, -11.6, 10.4, -11.6, 10.4, 0, 0, 13.6, -10.4, 0];
  else if (v === 2) pts = [-9.4, -13.6, 9.4, -13.6, 9.6, -2, 0, 16.4, -9.6, -2];
  else if (v === 3) pts = [-10, -13.4, 10, -13.4, 10.6, 11.4, 0, 14.6, -10.6, 11.4];
  if (v === 0) {
    ball(c, 0, 0, 12.4, 12.4, rim, { hl: 0.35 });
    ball(c, 0, 0, 9.4, 9.4, face, { hl: 0.25, ow: 1.6 });
    if (!inSilhouette()) for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; c.moveTo(Math.cos(a) * 3.6, Math.sin(a) * 3.6).lineTo(Math.cos(a) * 9, Math.sin(a) * 9); }
    detail(c, 1.6, emb, 0.9);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; rivet(c, Math.cos(a) * 10.9, Math.sin(a) * 10.9, 0.8); }
    ball(c, 0, 0, 3.6, 3.6, rim, { ow: 1.6, hl: 0.6 });
  } else {
    poly(c, pts, rim, { hl: 0 });
    const inner = pts.map((q, i) => (i % 2 === 0 ? q * 0.76 : q * 0.78 - 0.4));
    poly(c, inner, face, { ow: 1.4, hl: 0.22 });
    if (v === 1) { c.rect(-1.5, -8.4, 3, 15); fill(c, emb); c.rect(-6.6, -3.6, 13.2, 3); fill(c, emb); }
    else if (v === 2) { c.poly([-6, -8, 0, -2.4, 6, -8, 6, -4, 0, 2, -6, -4], true); fill(c, emb); }
    else star(c, 0, -0.6, 5, 5.6, 2.4, emb, 1.2);
    c.poly(pts, true); outline(c, OW);
  }
  if (l.glow) gem(c, 0, v === 0 ? 0 : -6, 2.2, light(l.glow, 0.2), 1.1);
}

/** Quiver on the back (pivot between the shoulder blades), tilted. */
export function drawQuiver(c: Ctx, l: ItemLook): void {
  const p = l.primary, s = trim(l);
  const feather = [0xf2ead8, 0xd8463a, 0xf2ead8, 0x5aa0d8][l.variant];
  for (const [x, y] of [[-3.4, -16], [0, -18], [3.4, -15.4]] as const) {
    seg(c, x * 0.6, -8, x, y + 2, 1, 0x8a6a4a, 0.9, false);
    poly(c, [x - 2, y + 4, x, y - 3, x + 2, y + 4, x, y + 2.4], feather, { ow: 1.4 });
  }
  rbox(c, -4.8, -10, 9.6, 22, 3.4, p, { hl: 0.25 });
  c.roundRect(-5.2, -10.6, 10.4, 3.2, 1.4); fill(c, s); c.roundRect(-5.2, -10.6, 10.4, 3.2, 1.4); outline(c, 1.6);
  c.roundRect(-4.8, 5, 9.6, 2.2, 0.8); fill(c, s);
  stitch(c, [2.4, -6, 2.4, 10], light(p, 0.45), 1.4, 1.2);
  if (l.glow) gem(c, 0, 0, 1.8, light(l.glow, 0.2), 1);
}

/** Mage orb (centre at origin); floats near the off hand. */
export function drawOrb(c: Ctx, l: ItemLook): void {
  const p = l.primary, s = trim(l);
  const core = l.glow ? mix(p, l.glow, 0.25) : p;
  ball(c, 0, 0, 7, 7, core, { hl: 0, inset: 0.84, sh: 0.4 });
  wash(c, (k) => k.ellipse(1, 1.4, 4.6, 4.2), light(core, 0.45), 0.55);
  wash(c, (k) => k.moveTo(-4, 2).quadraticCurveTo(0, -5, 4.6, -1).quadraticCurveTo(0, -2, -4, 2), 0xffffff, 0.45);
  gloss(c, -2.6, -3.4, 2.2, 1.4, 0.8);
  c.circle(0, 0, 7); outline(c, 2.2);
  if (l.variant >= 2) {
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 0.9; poly(c, [Math.cos(a) * 6, Math.sin(a) * 6 + 0.5, Math.cos(a) * 9.4, Math.sin(a) * 9.4, Math.cos(a + 0.25) * 6.4, Math.sin(a + 0.25) * 6.4], s, { ow: 1.3 }); }
  }
}

// ═══════════════════════════════ ICON-ONLY PIECES ═══════════════════════════════

export function drawBracers(c: Ctx, l: ItemLook): void {
  const p = l.primary, s = trim(l);
  for (const dx of [-7, 7]) {
    poly(c, [dx - 6, -9, dx + 6, -9, dx + 5, 9, dx - 5, 9], p, { hl: 0.3 });
    c.rect(dx - 6, -6, 12, 2.4); fill(c, s);
    c.rect(dx - 5.4, 4.6, 10.8, 2.4); fill(c, s);
    c.poly([dx - 6, -9, dx + 6, -9, dx + 5, 9, dx - 5, 9], true); outline(c, OW);
    if (l.glow) gem(c, dx, 0, 1.8, light(l.glow, 0.2), 1);
  }
}

export function drawAmulet(c: Ctx, l: ItemLook): void {
  const p = l.primary, s = trim(l);
  line(c, (k) => k.moveTo(-11, -14).quadraticCurveTo(-10, 2, 0, 4).quadraticCurveTo(10, 2, 11, -14), 1.6, p, 1.4, false);
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = -11 + 22 * t, y = -14 + Math.sin(t * Math.PI) * 17.6;
    c.circle(x, y, 1); fill(c, light(p, 0.3));
  }
  poly(c, [0, 2, 7.6, 9.6, 0, 19, -7.6, 9.6], p, { hl: 0.4 });
  gem(c, 0, 10, 4.2, l.glow ? light(l.glow, 0.1) : s);
}

export function drawRing(c: Ctx, l: ItemLook): void {
  const p = l.primary, s = trim(l);
  line(c, (k) => k.ellipse(0, 3, 9.4, 9.4), 3.6, p, OW);
  crease(c, arcPts(0, 3, 9.4, 9.4, Math.PI * 1.1, Math.PI * 1.5, 8), 1.4, 0xffffff, 0.6);
  rbox(c, -5.4, -9.6, 10.8, 6.4, 2.4, p, { ow: OW, hl: 0.4 });
  gem(c, 0, -10.4, 4.2, l.glow ? light(l.glow, 0.1) : s);
}

// ═══════════════════════════════ SHAPE LOOKUP ═══════════════════════════════

export function isTwoHandedMelee(shape: string | undefined): boolean { return shape === 'sword2h' || shape === 'axe2h'; }
export function isRangedShape(shape: string | undefined): boolean { return shape === 'bow' || shape === 'crossbow' || shape === 'handxbow'; }
export function isCasterShape(shape: string | undefined): boolean { return shape === 'staff' || shape === 'wand'; }

export { OW_THIN, flat, fill, outline, eye };
