// The depth-wave armour bases' own parts (docs/rework/gear/ART-DIRECTION.md §7): each new base draws on the slot
// silhouette it extends (ARMOUR_FAMILY: a coif on the hood, waders on the leather leg …) and adds what makes it that
// object: mail rings, a face mask, a wide brim, a fur collar, a scalloped capelet, brigandine studs, a stole, a bib
// apron, mittens, open fingertips, a plated girdle, a charm cord, chaps, hanging tassets, glossy waders, foot wraps,
// sandal straps, wooden clogs; and the jewellery / bracer icons (torc, charm, locket, band, signet, coil; cuffs,
// vambraces, arm wraps). Style-agnostic: the colours come from the look (previous art or the maker series), so these
// shapes show with either armour art. Baked with the hero sheet / icons like the rest of the armour.
import type { ItemLook } from '@shared/types';
import { OUT, OW, ball, blob, crease, fill, gem, inSilhouette, line, outline, poly, rbox, rivet, stitch, wash, type Ctx } from './draw';
import { artKey } from './gearStyle';
import { trim, type Body } from './gear';
import { clamp, light, mix, shade } from './util';

const D2R = Math.PI / 180;
type Pt = { x: number; y: number; d: number };
type Sph = (lon: number, lat: number, yaw: number, r?: number) => Pt;
type Vec = (fwd: number, up: number, side: number, yaw: number) => Pt;

const key = (l: ItemLook | undefined) => (l ? artKey(l) : undefined);

// ─────────────────────────── head (turntable sphere) ───────────────────────────

/** After the helm / hood / cap of drawHeadView (front pass) or before the skull (back pass). */
export function headExtra(c: Ctx, head: ItemLook | undefined, yaw: number, back: boolean, sph: Sph, vec: Vec, R: number): void {
  const k = key(head);
  if (!head || !k) return;
  const p = head.primary, s = trim(head);
  if (k === 'coif' && !back) {
    // mail rings over the hood (not the face opening)
    if (inSilhouette()) return;
    for (let lat = 22; lat <= 82; lat += 13) for (let lon = -180; lon < 180; lon += 21) {
      if (lat < 40 && Math.abs(lon) < 46) continue;
      const q = sph(lon * D2R, lat * D2R, yaw, R + 3.5);
      if (q.d < 0.15) continue;
      const r = 1.25 * clamp(q.d * 1.2, 0.4, 1);
      c.moveTo(q.x - r, q.y).arc(q.x, q.y, r, Math.PI, 0, true);
    }
    c.stroke({ width: 0.65, color: shade(p, 0.45), alpha: 0.85 });
    // a leather band round the face opening
    const run: number[] = [];
    for (let i = 0; i <= 10; i++) { const lon = (-60 + i * 12) * D2R; const q = sph(lon, (8 + 22 * Math.abs(i - 5) / 5) * D2R, yaw, R + 3.6); if (q.d > 0.05) run.push(q.x, q.y); }
    if (run.length >= 4) crease(c, run, 1.8, s, 1);
  } else if (k === 'mask' && !back) {
    // a cloth mask over nose and mouth, knotted at the back
    const pts: number[] = [];
    for (let i = 0; i <= 10; i++) { const lon = (-75 + i * 15) * D2R; const q = sph(lon, -6 * D2R, yaw, R + 1.2); if (q.d > -0.05) pts.push(q.x, q.y); }
    for (let i = 10; i >= 0; i--) { const lon = (-70 + i * 14) * D2R; const q = sph(lon, -40 * D2R, yaw, R + 0.8); if (q.d > -0.05) pts.push(q.x, q.y); }
    if (pts.length >= 8) { blob(c, pts, shade(p, 0.05), { ow: 1.6, hl: 0.15 }); const m = sph(0, -22 * D2R, yaw, R + 1.4); if (m.d > 0.3 && !inSilhouette()) crease(c, [m.x - 4 * m.d, m.y, m.x + 4 * m.d, m.y + 0.4], 1, shade(p, 0.35), 0.8); }
  } else if (k === 'mask' && back) {
    const q = sph(Math.PI, -10 * D2R, yaw, R + 1.2);
    if (q.d < 0) { const dn = vec(-0.6, -1, 0, yaw); blob(c, [q.x, q.y, q.x + dn.x * 7 - 2, q.y + dn.y * 7, q.x + dn.x * 8 + 2, q.y + dn.y * 8], shade(p, 0.1), { ow: 1.4 }); }
  } else if (k === 'widebrim') {
    // a wide round brim (behind the head on the back pass, its front half after)
    const up = vec(0, 1, 0, yaw);
    const C = sph(0, Math.PI / 2, yaw, 0);
    const cy = C.y + up.y * 7.4, cx = C.x + up.x * 7.4;
    const rx = R * 1.75, ry = 5.6;
    if (back) { c.ellipse(cx, cy, rx, ry); fill(c, shade(p, 0.18)); c.ellipse(cx, cy, rx, ry); outline(c, 1.8); return; }
    const lip: number[] = [];
    for (let i = 0; i <= 16; i++) { const a = Math.PI * (i / 16); lip.push(cx - Math.cos(a) * rx, cy + Math.sin(a) * ry); }
    for (let i = 16; i >= 0; i--) { const a = Math.PI * (i / 16); lip.push(cx - Math.cos(a) * rx * 0.86, cy + Math.sin(a) * ry * 0.55 - 1.2); }
    c.poly(lip, true); fill(c, p); c.poly(lip, true); outline(c, 1.8);
    if (!inSilhouette()) crease(c, [cx - rx * 0.86, cy - 1, cx, cy + ry * 0.55, cx + rx * 0.86, cy - 1], 1.2, s, 0.9);
  }
}

/** Icon (gear.drawHead side view, head centre (0.5, -13.5), r 16). */
export function headIconExtra(c: Ctx, head: ItemLook): void {
  const k = key(head), p = head.primary, s = trim(head);
  const hx = 0.5, hy = -13.5;
  if (k === 'coif') {
    if (!inSilhouette()) { for (let y = hy - 12; y < hy + 10; y += 3.6) for (let x = hx - 16; x < hx + 2; x += 3.4) { if (Math.hypot(x - hx, y - hy) > 16) continue; c.moveTo(x - 1.3, y).arc(x, y, 1.3, Math.PI, 0, true); } c.stroke({ width: 0.7, color: shade(p, 0.45), alpha: 0.85 }); }
  } else if (k === 'mask') {
    blob(c, [hx + 2, hy + 1, hx + 17, hy + 0.4, hx + 16, hy + 11, hx + 4, hy + 12], shade(p, 0.05), { ow: 1.8, hl: 0.15 });
    blob(c, [hx - 14, hy + 2, hx - 22, hy + 10, hx - 18, hy + 12, hx - 12, hy + 6], shade(p, 0.15), { ow: 1.6 });
  } else if (k === 'widebrim') {
    ball(c, hx, hy - 7, 27, 6.4, p, { hl: 0.25, sh: 0.35 });
    crease(c, [hx - 24, hy - 6, hx, hy - 1.4, hx + 24, hy - 6], 1.4, s, 0.9);
  }
}

// ─────────────────────────── shoulders (pad frame) ───────────────────────────

/** Fur collar and capelet over the pad / mantle (gear.drawShoulder frame, also the hero's pad part). */
export function shoulderExtra(c: Ctx, l: ItemLook, isBack: boolean): void {
  const k = key(l);
  const p = isBack ? shade(l.primary, 0.2) : l.primary, s = isBack ? shade(trim(l), 0.2) : trim(l);
  if (k === 'furmantle') {
    const fur = mix(p, 0xd8c8a8, 0.35);
    const pts: number[] = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI * (1.05 - i / 12 * 1.1), r = 9.4 + (i % 2 ? 1.6 : 0); pts.push(0.6 + Math.cos(a) * r, -0.4 - Math.sin(a) * r * 0.75); }
    pts.push(9.6, 3.6, 0.6, 5.4, -8.4, 3.6);
    blob(c, pts, fur, { ow: 1.8, hl: 0.2 });
    if (!inSilhouette()) for (const x of [-6, -2.4, 1.2, 4.8, 8]) crease(c, [x, -3, x + 0.8, 1.6], 0.9, shade(fur, 0.3), 0.8);
  } else if (k === 'capelet') {
    const pts = [-8.6, -1.4, -3, -5.8, 5, -5.8, 10, -1, 9.8, 6.4, 6.4, 8.4, 3.2, 6.6, 0, 8.6, -3.2, 6.6, -6.4, 8.4, -9.2, 6];
    blob(c, pts, p, { ow: 2, hl: 0.2 });
    crease(c, [-8.4, 5.2, -6.4, 7.2, -3.2, 5.6, 0, 7.4, 3.2, 5.6, 6.4, 7.2, 9.4, 5.4], 1.4, s, 1);
    if (!isBack) ball(c, 4.6, -3.4, 1.8, 1.8, s, { ow: 1, hl: 0.4 });
  }
}

export function shoulderIconExtra(c: Ctx, l: ItemLook): void {
  if (key(l) !== 'furmantle' && key(l) !== 'capelet') return;
  c.save?.(); c.translate(-1.1, 1.1); c.scale(1.9, 1.9); shoulderExtra(c, l, false); c.restore?.();
}

// ─────────────────────────── torso ───────────────────────────

/** Torso base (heroParts.drawTorsoBase, symmetric, before its outline): brigandine studs, the apron skirt. */
export function torsoBaseExtra(c: Ctx, chest: ItemLook | undefined): void {
  const k = key(chest);
  if (!chest || !k) return;
  const p = chest.primary, s = trim(chest);
  if (k === 'brigandine') {
    if (inSilhouette()) return;
    for (let r = 0; r < 5; r++) for (let x = -8.4 + (r % 2) * 1.8; x <= 8.6; x += 3.6) rivet(c, x, -18.6 + r * 3.8, 0.75, light(s, 0.25));
    crease(c, [-10.6, -1.6, 10.6, -1.6], 1.6, shade(p, 0.3), 0.8);
  } else if (k === 'apron') {
    blob(c, [-8.6, 0, 8.6, 0, 9.4, 9.4, 0, 10.6, -9.4, 9.4], shade(p, 0.12), { ow: 1.8, hl: 0.15 });
  }
}

/** Torso front details (heroParts.drawTorsoFront frame, centred, collar at y -21.8). */
export function torsoFrontExtra(c: Ctx, b: Body, chest: ItemLook | undefined): void {
  const k = key(chest);
  if (!chest || !k) return;
  const p = chest.primary, s = trim(chest);
  if (k === 'vestment') {
    for (const x of [-4.4, 4.4]) poly(c, [x - 1.5, -21, x + 1.5, -21, x + 1.9, 10.4, x - 1.9, 10.4], light(s, 0.05), { ow: 1.2 });
    if (!inSilhouette()) for (const x of [-4.4, 4.4]) for (const y of [-12, 0, 8]) { c.moveTo(x - 1, y).lineTo(x + 1, y).moveTo(x, y - 1).lineTo(x, y + 1); }
    c.stroke({ width: 0.7, color: shade(s, 0.4) });
  } else if (k === 'apron') {
    poly(c, [-5.6, -16.4, 5.6, -16.4, 7.4, 9.6, -7.4, 9.6], shade(p, 0.08), { ow: 1.6, hl: 0.15 });
    crease(c, [-5.4, -16.2, -3.4, -21.4], 1.4, shade(p, 0.3), 1); crease(c, [5.4, -16.2, 3.4, -21.4], 1.4, shade(p, 0.3), 1);
    rbox(c, -3.6, -2.6, 7.2, 5.2, 1, shade(p, 0.2), { ow: 1.2, hl: 0 });
    if (!inSilhouette()) stitch(c, [-3.2, -2, 3.2, -2], light(p, 0.4), 1, 0.9, 0.6, 0.8);
  } else if (k === 'brigandine') {
    rbox(c, -3.4, -18.4, 6.8, 14, 1.4, light(p, 0.05), { ow: 1.2, hl: 0.2 });
    if (!inSilhouette()) for (const y of [-15.6, -11, -6.4]) for (const x of [-1.8, 1.8]) rivet(c, x, y, 0.7, light(s, 0.3));
  }
  void b;
}

/** Waist (heroParts.drawTorsoBase waist band): the girdle's plates, the charm cord. Returns true when drawn. */
export function waistBand(c: Ctx, waist: ItemLook, y: number, w: number): boolean {
  const k = key(waist);
  if (k === 'girdle') {
    rbox(c, -w, y - 2.6, w * 2, 6.2, 1.4, waist.primary, { ow: 1.8, hl: 0.35 });
    if (!inSilhouette()) for (let x = -w + 3; x < w; x += 4.4) { crease(c, [x, y - 2.2, x, y + 3.2], 0.9, shade(waist.primary, 0.4), 0.8); rivet(c, x + 2.2, y + 0.5, 0.7); }
    return true;
  }
  if (k === 'cord') {
    line(c, (kk) => kk.moveTo(-w, y).quadraticCurveTo(0, y + 1.6, w, y), 1.6, waist.primary, 1.2, false);
    return true;
  }
  return false;
}

/** Waist front (heroParts.drawBeltFront): girdle buckle plate, cord knot with charms. Returns true when drawn. */
export function beltFrontExtra(c: Ctx, w: ItemLook, y: number): boolean {
  const k = key(w), p = w.primary, s = trim(w);
  if (k === 'girdle') {
    rbox(c, -3.6, y - 3.2, 7.2, 7.4, 1.4, s, { ow: 1.5, hl: 0.4 });
    c.roundRect(-1.6, y - 1.2, 3.2, 3.4, 0.6); fill(c, shade(s, 0.5));
    return true;
  }
  if (k === 'cord') {
    ball(c, 0, y + 0.8, 1.9, 1.7, p, { ow: 1.2 });
    for (const [x, len] of [[-2.2, 6], [0.4, 8.4], [2.8, 5.2]] as const) {
      crease(c, [x * 0.4, y + 2, x, y + 2 + len], 0.8, shade(p, 0.25), 1);
      ball(c, x, y + 2.8 + len, 1.2, 1.4, len > 7 ? s : light(p, 0.2), { ow: 0.9, hl: 0.3 });
    }
    return true;
  }
  return false;
}

/** Torso icon extras (gear.drawTorso frame, neck at (1, -20)). */
export function torsoIconExtra(c: Ctx, chest: ItemLook): void {
  const k = key(chest), p = chest.primary, s = trim(chest);
  if (k === 'brigandine') { if (!inSilhouette()) for (let r = 0; r < 5; r++) for (let x = -7.4 + (r % 2) * 1.8; x <= 9.6; x += 3.6) rivet(c, x, -18 + r * 3.8, 0.8, light(s, 0.25)); }
  else if (k === 'vestment') { for (const x of [3.4, 8.2]) poly(c, [x - 1.5, -20, x + 1.5, -20, x + 2, 10.6, x - 2, 10.6], light(s, 0.05), { ow: 1.2 }); }
  else if (k === 'apron') {
    poly(c, [-2, -15.6, 8.4, -15.6, 10.4, 10.6, -4, 10.6], shade(p, 0.08), { ow: 1.8, hl: 0.15 });
    crease(c, [-1.6, -15.4, 0.6, -21], 1.4, shade(p, 0.3), 1); crease(c, [8, -15.4, 6, -21], 1.4, shade(p, 0.3), 1);
    rbox(c, 0.4, -2.6, 7.2, 5.2, 1, shade(p, 0.2), { ow: 1.2, hl: 0 });
  }
}

// ─────────────────────────── hands (gear.drawHand frame) ───────────────────────────

/** Mittens and fingerless gloves (drawn instead of / over the family's glove). Returns true when it replaced it. */
export function handExtra(c: Ctx, b: Body, hands: ItemLook, isBack: boolean): boolean {
  const k = key(hands);
  const p = isBack ? shade(hands.primary, 0.2) : hands.primary, s = isBack ? shade(trim(hands), 0.2) : trim(hands);
  if (k === 'mitts') {
    rbox(c, -3.6, -5, 7.2, 3.6, 1.6, s, { ow: 1.6, hl: 0.2 });
    ball(c, 0, 0.4, 3.9, 3.9, p, { hl: 0.3 });
    ball(c, -3.2, -0.8, 1.6, 1.8, shade(p, 0.08), { ow: 1.2, hl: 0 });
    return true;
  }
  if (k === 'fingerless' && !isBack) {
    wash(c, (kk) => kk.ellipse(2.2, 1.6, 1.8, 1.4), b.skin, 1);
    if (!inSilhouette()) crease(c, [0.6, 0.4, 3.6, 0.6], 0.9, shade(p, 0.35), 0.9);
  }
  return false;
}

export function gloveIconExtra(c: Ctx, l: ItemLook): void {
  const k = key(l);
  if (k === 'fingerless') {
    for (let i = 0; i < 4; i++) { const x = -6 + i * 4.6, top = -17 + Math.abs(i - 1.4) * 2.2; rbox(c, x - 2.4, top, 4.8, 5.6, 2.4, 0xd9a07a, { ow: 2, hl: 0.25 }); }
  } else if (k === 'mitts') {
    blob(c, [-9.6, -4, -9, -16, 0, -19, 9, -16, 9.6, -4], l.primary, { ow: 2.2, hl: 0.3 });
    crease(c, [-8, -6, 8, -6], 1.4, trim(l), 1);
  }
}

// ─────────────────────────── legs and feet ───────────────────────────

/** Leg view extras (heroParts.drawLegView; sn / cs of the leg yaw). `b` for the skin of sandals. */
export function legExtra(c: Ctx, b: Body, legs: ItemLook | undefined, feet: ItemLook | undefined, sn: number, cs: number, footPts: number[]): void {
  const lk = key(legs), fk = key(feet);
  if (legs && lk) {
    const p = legs.primary, s = trim(legs);
    if (lk === 'tassets') {
      poly(c, [-5.2, -3.2, 5.2, -3.2, 5.6, 1.6, -5.6, 1.6], light(p, 0.06), { ow: 1.6, hl: 0.35 });
      poly(c, [-4.8, 1.0, 4.8, 1.0, 5.0, 4.6, -5.0, 4.6], shade(p, 0.08), { ow: 1.5, hl: 0.3 });
      if (!inSilhouette()) { rivet(c, -3.4, -1.6, 0.7); rivet(c, 3.4, -1.6, 0.7); }
    } else if (lk === 'chaps') {
      const side = Math.sign(sn || 1);
      poly(c, [-4.0, -2.2, 4.0, -2.2, 4.0, 8.0, -4.0, 8.0], shade(p, 0.15), { ow: 1.5, hl: 0.15 });
      if (!inSilhouette()) for (let y = -1; y < 8; y += 1.6) crease(c, [side * 4.0, y, side * 5.6, y + 0.8], 0.8, shade(p, 0.25), 0.9);
      crease(c, [-4.0, -1.4, 4.0, -1.4], 1.2, s, 1);
    } else if (lk === 'waders') {
      if (!inSilhouette()) { c.roundRect(-2.6 + sn * 0.4, -1.4, 1.4, 8.6, 0.7).fill({ color: 0xffffff, alpha: 0.3 }); }
      crease(c, [-3.8, -1.6, 3.8, -1.6], 1.6, s, 1);
    }
  }
  if (feet && fk) {
    const p = feet.primary, s = trim(feet);
    if (fk === 'clogs') {
      const n = footPts.length / 2;
      let x0 = Infinity, x1 = -Infinity;
      for (let i = 0; i < n; i++) { x0 = Math.min(x0, footPts[i * 2]); x1 = Math.max(x1, footPts[i * 2]); }
      rbox(c, x0 - 0.4, 10.4, x1 - x0 + 0.8, 2.6, 1, mix(p, 0x8a6a42, 0.6), { ow: 1.4, hl: 0.2 });
      crease(c, [x0, 9.8, x1, 9.8], 1.4, s, 1);
    } else if (fk === 'sandals') {
      if (!inSilhouette()) {
        wash(c, (kk) => kk.poly(footPts, true), b.skin, 0.85);
        for (const y of [8.4, 10.4]) crease(c, [-4, y, 4 + Math.abs(sn) * 4, y - 0.4], 1.2, p, 1);
        crease(c, [0, 7.4, 0, 12], 1, s, 1);
      }
    } else if (fk === 'footwraps') {
      if (!inSilhouette()) for (let i = 0; i < 4; i++) { crease(c, [-4.2, 5 + i * 1.8, 4.2, 6.6 + i * 1.8], 0.9, shade(p, 0.3), 0.9); crease(c, [4.2, 5 + i * 1.8, -4.2, 6.6 + i * 1.8], 0.9, shade(p, 0.3), 0.9); }
    }
  }
  void cs;
}

/** Legs icon extras (icons.legsIcon frame: two legs, knees at (±6.4, 5)). */
export function legsIconExtra(c: Ctx, l: ItemLook): void {
  const k = key(l), p = l.primary, s = trim(l);
  if (k === 'tassets') { for (const x of [-6, 6]) { poly(c, [x - 6.4, -12, x + 6.4, -12, x + 6.8, -3, x - 6.8, -3], light(p, 0.06), { ow: 1.8, hl: 0.35 }); poly(c, [x - 6, -4, x + 6, -4, x + 6.2, 2, x - 6.2, 2], shade(p, 0.08), { ow: 1.6, hl: 0.3 }); } }
  else if (k === 'chaps') { for (const x of [-6.4, 6.4]) { poly(c, [x - 4.6, -11, x + 4.6, -11, x + 4.4, 16, x - 4.4, 16], shade(p, 0.15), { ow: 1.6, hl: 0.15 }); if (!inSilhouette()) for (let y = -9; y < 15; y += 2.4) crease(c, [x + Math.sign(x) * 4.6, y, x + Math.sign(x) * 6.6, y + 1], 0.9, shade(p, 0.3), 0.9); } }
  else if (k === 'waders') { if (!inSilhouette()) for (const x of [-7.6, 4.8]) c.roundRect(x, -12, 2, 26, 1).fill({ color: 0xffffff, alpha: 0.28 }); crease(c, [-11, -12.6, 11, -12.6], 2, s, 1); }
}

/** Feet in gear.drawLeg (icon feet): sole / straps / wraps over the family's foot. */
export function footIconExtra(c: Ctx, feet: ItemLook, skin: number): void {
  const k = key(feet), p = feet.primary, s = trim(feet);
  if (k === 'clogs') { rbox(c, -4.6, 10.4, 13.4, 2.8, 1, mix(p, 0x8a6a42, 0.6), { ow: 1.4, hl: 0.2 }); crease(c, [-4.2, 9.8, 8.4, 9.8], 1.4, s, 1); }
  else if (k === 'sandals') { if (!inSilhouette()) { wash(c, (kk) => kk.poly([-3.8, 8.2, 0, 7.2, 5, 8, 9.4, 8.6, 10.6, 9.8, 8.6, 12.2, -3.8, 12.2], true), skin, 0.8); for (const x of [0, 4, 8]) crease(c, [x - 1.6, 8, x + 1, 12], 1.2, p, 1); } }
  else if (k === 'footwraps') { if (!inSilhouette()) for (let i = 0; i < 4; i++) crease(c, [-3.6 + i * 3, 7.6, -1.4 + i * 3, 12], 1, shade(p, 0.3), 0.9); }
}

// ─────────────────────────── icon-only pieces (previous art) ───────────────────────────

/** Bracers, amulets and rings drawn by their own base (gear.drawBracers / drawAmulet / drawRing). Returns true if drawn. */
export function jewelExtra(c: Ctx, l: ItemLook, kind: 'wrists' | 'neck' | 'ring'): boolean {
  const k = key(l), p = l.primary, s = trim(l);
  const g = l.glow ? light(l.glow, 0.1) : s;
  if (kind === 'wrists') {
    if (k === 'vambraces') { for (const dx of [-7, 7]) { poly(c, [dx - 6.4, -12, dx + 6.4, -12, dx + 5.4, 12, dx - 5.4, 12], p, { hl: 0.4 }); for (const y of [-8, -1, 6]) crease(c, [dx - 6, y, dx + 6, y], 1, OUT, 0.45); c.rect(dx - 6.4, -12, 12.8, 2.6); fill(c, s); } return true; }
    if (k === 'cuffs') { for (const dx of [-7, 7]) { rbox(c, dx - 6, -6, 12, 10, 3, p, { hl: 0.3 }); crease(c, [dx - 5.4, -3.6, dx + 5.4, -3.6], 1.4, s, 1); crease(c, [dx - 5.4, 1.6, dx + 5.4, 1.6], 1.4, s, 1); } return true; }
    if (k === 'armwraps') { for (const dx of [-7, 7]) { poly(c, [dx - 5, -10, dx + 5, -10, dx + 4.6, 10, dx - 4.6, 10], p, { hl: 0.25 }); if (!inSilhouette()) for (let i = 0; i < 6; i++) crease(c, [dx - 5, -8 + i * 3.2, dx + 5, -6 + i * 3.2], 1, shade(p, 0.35), 0.9); line(c, (kk) => kk.moveTo(dx + 4, 8).quadraticCurveTo(dx + 8, 12, dx + 6, 16), 1.4, p, 1.2, false); } return true; }
    return false;
  }
  if (kind === 'neck') {
    if (k === 'torc') { line(c, (kk) => kk.moveTo(-10, -12).quadraticCurveTo(-12, 6, 0, 7).quadraticCurveTo(12, 6, 10, -12), 4.4, p, OW, false); for (const x of [-10, 10]) ball(c, x, -13, 3.2, 3.2, s, { ow: 1.6, hl: 0.4 }); if (l.glow) gem(c, 0, 7, 2.6, g); return true; }
    if (k === 'locket') { line(c, (kk) => kk.moveTo(-11, -14).quadraticCurveTo(-10, 2, 0, 4).quadraticCurveTo(10, 2, 11, -14), 1.4, light(p, 0.2), 1.2, false); ball(c, 0, 11, 6.4, 7.6, p, { hl: 0.45 }); crease(c, [-5, 11, 5, 11], 1, shade(p, 0.4), 0.8); gem(c, 0, 8.4, 2.2, g); return true; }
    if (k === 'charm') { line(c, (kk) => kk.moveTo(-11, -14).quadraticCurveTo(-10, 2, 0, 4).quadraticCurveTo(10, 2, 11, -14), 1.6, 0x6a4a2a, 1.2, false); poly(c, [0, 4, 6.6, 12, 0, 20, -6.6, 12], p, { hl: 0.3 }); crease(c, [0, 6, 0, 18], 1, s, 1); gem(c, 0, 12, 2.4, g); return true; }
    return false;
  }
  if (k === 'band') { line(c, (kk) => kk.ellipse(0, 1, 11, 9.4), 6, p, OW); crease(c, arcPts2(0, 1, 11, 9.4, Math.PI * 1.1, Math.PI * 1.5), 1.4, 0xffffff, 0.6); if (l.glow) gem(c, 0, -8.4, 2.6, g); return true; }
  if (k === 'signet') { line(c, (kk) => kk.ellipse(0, 4, 9.4, 9.4), 3.6, p, OW); rbox(c, -6.4, -11, 12.8, 9, 2.6, p, { ow: OW, hl: 0.45 }); c.circle(0, -6.5, 2.8); fill(c, shade(p, 0.45)); if (!inSilhouette()) crease(c, [-1.4, -7.6, 1.4, -5.4], 1, light(p, 0.4), 0.9); return true; }
  if (k === 'coil') { for (let i = 2; i >= 0; i--) line(c, (kk) => kk.ellipse(0, -2 + i * 4, 9.4, 5), 2.6, i ? shade(p, 0.12 * i) : p, 1.8); if (l.glow) gem(c, 0, -7.4, 2.4, g); return true; }
  return false;
}

function arcPts2(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 8): number[] {
  const o: number[] = []; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; o.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); } return o;
}

void outline;
