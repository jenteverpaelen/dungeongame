// Series G3 · Warden (item levels 37–48): the Shiverline signal ridge and the Beaconbreak ward.
// Made by signallers and ward keepers: crimson ward enamel and white enamel (Mera's crimson sash, the heraldic signal
// colours, ART-REFERENCES RW4, WR3), brass fittings (Venn's brass buttons), bright steel, dark oak, a frost-blue etch
// from the ridge. Shape language: tall and upright, rectilinear, crisp steps cut like the wards of a key, swallowtail
// pennants flying off the weapon (asymmetric) (rule A1). Light: only the beacon lamp of the staff (R6).
// Maker's mark: a stamped key ward.
import type { SeriesInfo } from './index';
import { bloom, detail, disc, fxCount, glowLine, glowPoly, glowSpot, haze, jit, lash, mote, pole, rays, ring, slab, bevel, stone, withFx, type K } from './kit';
import { light, mix, shade } from '../util';
import { OUT } from '../draw';

const CRIMSON = 0xb3242c, ENAMEL = 0xeee6d6, NAVY = 0x2a3862, BRASS = 0xcaa14e, STEEL = 0xbac4cc, EDGE = 0xf0f4f6;
const FROST = 0xbfe4ff, OAK = 0x5a4434, LAMP = 0xffd27a, FADED = 0xb88a86;

/** A swallowtail pennant attached at (x, y), flying along angle `a` (radians, 0 = +x), with a wave and a stripe. */
function pennant(k: K, x: number, y: number, len: number, h: number, a: number, col: number, stripe: number, wave = 0.8): void {
  const cs = Math.cos(a), sn = Math.sin(a);
  const P = (u: number, v: number) => [x + u * cs - v * sn, y + u * sn + v * cs];
  const pts = [...P(0, -h / 2), ...P(len * 0.35, -h / 2 - wave), ...P(len * 0.7, -h / 2 + wave * 0.4), ...P(len, -h / 2 + wave), ...P(len * 0.72, wave * 0.6), ...P(len, h / 2 + wave), ...P(len * 0.7, h / 2 + wave * 0.4), ...P(len * 0.35, h / 2 - wave), ...P(0, h / 2)];
  slab(k, pts, col, { line: 0.75, shK: 0.25 });
  if (k.pass === 'paint') {
    const s = [...P(0, -h * 0.12), ...P(len * 0.35, -h * 0.12 - wave), ...P(len * 0.66, -h * 0.12 + wave * 0.4), ...P(len * 0.66, h * 0.12 + wave * 0.4), ...P(len * 0.35, h * 0.12 - wave), ...P(0, h * 0.12)];
    k.c.poly(s, true).fill(stripe);
  }
}

function wardMark(k: K, x: number, y: number, s: number, on: number): void {
  if (k.pass !== 'paint') return;
  const col = k.q >= 2 ? CRIMSON : shade(on, 0.55);
  k.c.poly([x - s / 2, y - s / 2, x + s / 2, y - s / 2, x + s / 2, y, x, y, x, y + s / 2, x - s / 2, y + s / 2], true).stroke({ width: 0.55, color: col, join: 'miter' });
}

/** Frost etching: a few fern-like branching lines (Shiverline), rare pieces only. */
function frost(k: K, x: number, y0: number, y1: number, side: number): void {
  if (k.q < 2) return;
  for (let y = y0; y > y1; y -= 3.2) {
    detail(k, [x, y, x + side * 0.6, y - 1.4, x + side * 0.4, y - 2.6], FROST, 0.45, 0.95);
    detail(k, [x + side * 0.6, y - 1.4, x + side * 1.4, y - 1.8], FROST, 0.4, 0.95);
  }
}

// ── sword: the ward-key sword — the edge by the guard cut in key wards, a key-bow ring pommel ──
function sword(k: K): void {
  const q = k.q;
  k.anchor = { x: 0, y: -5.6, r: 2.6 };
  const right = [2.5, -6.2, 2.5, -7.4, 1.3, -7.4, 1.3, -8.9, 2.5, -8.9, 2.5, -10.6, 1.8, -10.6, 1.8, -12.2, 2.5, -12.2, 2.5, -27.2, 0, -32.6];
  const blade = [-2.5, -6.2, ...right, -2.5, -27.2];
  bevel(k, blade, [-2.5, -6.2, 0, -6.2, 0, -32.6, -2.5, -27.2], STEEL, { ridge: [0, -12.6, 0, -31.6], edge: [-1.9, -7, -1.9, -27, -0.2, -31.4], edgeCol: EDGE });
  frost(k, -1.5, -13, -26, 1);
  if (q >= 1) wardMark(k, 0.9, -15.0, 1.4, STEEL);
  // crossguard: a straight bar, square ends (crimson enamel on magic+), brass end blocks
  slab(k, [-6.6, -4.5, 6.6, -4.5, 6.6, -6.7, -6.6, -6.7], q >= 1 ? CRIMSON : shade(STEEL, 0.15), { hi: [[-6.0, -6.1, 6.0, -6.1]] });
  for (const s of [-1, 1]) slab(k, [s * 6.2, -4.0, s * 8.0, -4.0, s * 8.0, -7.2, s * 6.2, -7.2], q >= 1 ? BRASS : STEEL, { line: 0.8 });
  // grip: navy cord over oak
  slab(k, [-1.7, -4.4, 1.7, -4.4, 1.7, 4.4, -1.7, 4.4], OAK, { line: 0.8 });
  lash(k, 0, -4.2, 4.2, 3.4, NAVY, { gap: 1.1, slant: 0.6, bulge: 0.2 });
  // pommel: a key bow
  ring(k, 0, 7.6, 2.8, 2.8, 1.5, q >= 1 ? BRASS : STEEL);
  slab(k, [-1.4, 4.2, 1.4, 4.2, 1.1, 5.2, -1.1, 5.2], q >= 1 ? BRASS : STEEL, { line: 0.7 });
  stone(k, 0, 7.6, 1.0, BRASS);
  // a pennant tied under the guard, flying back
  pennant(k, -6.6, -4.4, 8.4, 2.6, 2.3, q === 0 ? FADED : CRIMSON, q === 0 ? mix(ENAMEL, FADED, 0.4) : ENAMEL, 0.7);
}

// ── axe: the signal axe — a squared blade, a spear point, a quartered signal flag behind ──
function axe(k: K): void {
  const q = k.q;
  pole(k, [0, 8, 0, -27], 2.8, OAK);
  for (const y of [5.6, -10.2]) ring(k, 0, y, 1.9, 0.7, 0.9, q >= 1 ? BRASS : STEEL);
  if (q >= 1) slab(k, [-1.5, -0.4, 1.5, -0.4, 1.5, 2.6, -1.5, 2.6], CRIMSON, { line: 0.6, flat: true, inner: true });
  // spear point on top
  bevel(k, [-1.5, -27, 1.5, -27, 1.6, -29.4, 0, -33.4, -1.6, -29.4], [-1.5, -27, 0, -27, 0, -33.4, -1.6, -29.4], STEEL, { edge: [-1.1, -29.2, -0.1, -32.6], edgeCol: EDGE });
  // the squared blade: crisp straight edge
  const blade = [1.6, -26.4, 9.6, -28.4, 10.8, -27.6, 10.8, -16.6, 9.6, -15.8, 1.6, -18.6];
  bevel(k, blade, [1.6, -26.4, 9.6, -28.4, 10.0, -28.1, 8.6, -22.4, 1.6, -22.4], STEEL, { edge: [10.0, -27.0, 10.0, -17.2], edgeCol: EDGE, ridge: [3, -22.4, 8.6, -22.4] });
  // key-ward steps cut into the back of the blade
  if (k.pass === 'paint') for (const [x, y] of [[3.2, -25.2], [5.0, -25.8]]) { k.c.rect(x, y, 1.1, 1.2).fill(shade(STEEL, 0.5)); }
  frost(k, 6.5, -19, -26.4, -1);
  // the back: a squared hook like a key bit
  slab(k, [-1.4, -25.4, -5.8, -25.4, -5.8, -23.4, -4.2, -23.4, -4.2, -21.8, -5.8, -21.8, -5.8, -19.8, -1.4, -19.8], STEEL, { hi: [[-5.2, -24.8, -1.8, -24.8]] });
  // socket
  slab(k, [-1.9, -28.0, 1.9, -28.0, 1.9, -17.6, -1.9, -17.6], q >= 1 ? BRASS : shade(STEEL, 0.1), { hi: [[-1.3, -27.2, -1.3, -18.4]] });
  if (q >= 1) wardMark(k, 6.4, -20.4, 1.3, STEEL);
  // a signal pennant flying from the haft below the head (magic+)
  if (q >= 1) pennant(k, -1.4, -16.4, 9.6, 3.6, 2.75, CRIMSON, q === 2 ? NAVY : ENAMEL, 0.9);
  stone(k, 0, -22.6, 1.0, BRASS);
  k.anchor = { x: 0, y: -17.4, r: 2.4 };
}

// ── bow: a flat signal bow with crisp angled limbs, enamel bands, pennants flying from the tips ──
function bow(k: K): void {
  const q = k.q;
  const limb = (s: number) => [3.0, s * 3.2, 6.6, s * 9.2, 5.6, s * 16.6, -2.4, s * 21.2];
  for (const s of [-1, 1]) {
    const pts = limb(s);
    const outline: number[] = [];
    // build a straight-segment limb polygon with tapering width
    const ws = [3.6, 3.0, 2.2, 1.3];
    const L: number[] = [], R: number[] = [];
    for (let i = 0; i < 4; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(3, i + 1);
      const dx = pts[i1 * 2] - pts[i0 * 2], dy = pts[i1 * 2 + 1] - pts[i0 * 2 + 1], d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d, ny = dx / d;
      L.push(pts[i * 2] + nx * ws[i] / 2, pts[i * 2 + 1] + ny * ws[i] / 2); R.push(pts[i * 2] - nx * ws[i] / 2, pts[i * 2 + 1] - ny * ws[i] / 2);
    }
    outline.push(...L); for (let i = 3; i >= 0; i--) outline.push(R[i * 2], R[i * 2 + 1]);
    slab(k, outline, OAK, { line: 0.9 });
    if (k.pass === 'paint') {
      // enamel bands at the bends
      for (const t of [0.5, 1.5]) {
        const i = Math.floor(t), f = t - i, x = pts[i * 2] + (pts[(i + 1) * 2] - pts[i * 2]) * f, y = pts[i * 2 + 1] + (pts[(i + 1) * 2 + 1] - pts[i * 2 + 1]) * f;
        // an enamel band wrapped across the limb
        const j = Math.min(2, i + 1), dx = pts[j * 2] - pts[i * 2], dy = pts[j * 2 + 1] - pts[i * 2 + 1], d = Math.hypot(dx, dy) || 1;
        const ux = dx / d, uy = dy / d, nx = -uy, ny = ux, hw = ws[i] / 2 + 0.35, hl = 0.9;
        k.c.poly([x - ux * hl + nx * hw, y - uy * hl + ny * hw, x + ux * hl + nx * hw, y + uy * hl + ny * hw, x + ux * hl - nx * hw, y + uy * hl - ny * hw, x - ux * hl - nx * hw, y - uy * hl - ny * hw], true).fill(q === 0 ? shade(OAK, 0.3) : t < 1 ? CRIMSON : ENAMEL);
        k.c.moveTo(x - ux * hl + nx * hw, y - uy * hl + ny * hw).lineTo(x - ux * hl - nx * hw, y - uy * hl - ny * hw).moveTo(x + ux * hl + nx * hw, y + uy * hl + ny * hw).lineTo(x + ux * hl - nx * hw, y + uy * hl - ny * hw).stroke({ width: 0.5, color: OUT });
      }
      detail(k, [pts[0] - 0.6, pts[1], pts[2] - 0.6, pts[3], pts[4] - 0.5, pts[5]], light(OAK, 0.4), 0.55);
    }
    if (q >= 1) disc(k, pts[2], pts[3], 1.0, 1.0, BRASS, { line: 0.6, inner: true });
    if (q >= 1) pennant(k, -2.6, s * 21.0, 6.4, 2.2, s > 0 ? 0.9 : -0.9, CRIMSON, ENAMEL, 0.5);
  }
  // grip: navy wrap, brass ferrules
  lash(k, 3.0, -3.6, 3.6, 3.8, NAVY, { gap: 1.1, slant: 0.6 });
  for (const y of [-4.2, 4.2]) slab(k, [0.9, y - 0.8, 5.1, y - 0.8, 5.1, y + 0.8, 0.9, y + 0.8], q >= 1 ? BRASS : STEEL, { line: 0.6 });
  if (q === 2) wardMark(k, 3.0, 0, 1.2, NAVY);
  if (!k.rig) pole(k, [-2.4, -21.0, -2.4, 21.0], 0.7, 0xece6d8, { flat: true });
  stone(k, 3.0, 0, 1.1, BRASS);
  k.anchor = { x: 3.0, y: -5.0, r: 2.2 };
}

// ── staff: the beacon mast — a yard with pennants and a shuttered beacon lamp on top ──
function staff(k: K): void {
  const q = k.q;
  pole(k, [0, 22.6, 0, -39], 3.0, OAK);
  for (const y of [20.4, 6.0, -30.0]) ring(k, 0, y, 2.0, 0.7, 0.9, q >= 1 ? BRASS : STEEL);
  // the yard (crossbar) with pennants
  slab(k, [-7.6, -35.0, 7.6, -35.0, 7.6, -33.4, -7.6, -33.4], OAK, { line: 0.8, hi: [[-7.0, -34.6, 7.0, -34.6]] });
  for (const s of [-1, 1]) disc(k, s * 7.6, -34.2, 0.9, 0.9, q >= 1 ? BRASS : STEEL, { line: 0.6 });
  if (q >= 1) { pennant(k, -7.0, -33.4, 7.0, 2.2, 1.75, CRIMSON, ENAMEL, 0.5); pennant(k, 7.0, -33.4, 7.0, 2.2, 1.4, q === 2 ? NAVY : ENAMEL, q === 2 ? ENAMEL : CRIMSON, 0.5); }
  // the beacon: a brass-roofed lamp box with louvred shutters
  const bx0 = -4.6, bx1 = 4.6, by0 = -50.6, by1 = -38.8;
  slab(k, [bx0, by1, bx1, by1, bx1, by0, bx0, by0], q >= 1 ? CRIMSON : shade(STEEL, 0.25), { hi: [[bx0 + 0.7, by1 - 0.9, bx0 + 0.7, by0 + 0.9]] });
  slab(k, [bx0 - 1.3, by0, bx1 + 1.3, by0, 0, by0 - 5.4], q >= 1 ? BRASS : STEEL, { hi: [[bx0 + 0.2, by0 - 0.7, -0.5, by0 - 4.4]] });
  ring(k, 0, by0 - 6.8, 1.4, 1.4, 1.0, q >= 1 ? BRASS : STEEL);
  slab(k, [bx0 - 0.6, by1, bx1 + 0.6, by1, bx1 + 0.6, by1 + 1.4, bx0 - 0.6, by1 + 1.4], q >= 1 ? BRASS : STEEL, { line: 0.7 });
  const win = [-2.9, -48.6, 2.9, -48.6, 2.9, -41.0, -2.9, -41.0];
  glowPoly(k, win, LAMP, q >= 1, 0x241a18);
  if (q >= 1) glowSpot(k, 0, -44.8, q === 2 ? 2.3 : 1.4, LAMP, true);
  if (k.pass === 'paint') {
    const open = q === 0 ? 0 : q === 1 ? 0.5 : 1;
    for (let i = 0; i < 5; i++) {
      const y = -48.4 + i * 1.5;
      if (open < 1) k.c.rect(-2.9, y, 5.8, 1.3 * (1 - open)).fill(shade(STEEL, 0.4));
      k.c.moveTo(-2.9, y).lineTo(2.9, y).stroke({ width: 0.35, color: OUT, alpha: 0.7 });
    }
    k.c.poly(win, true).stroke({ width: 0.7, color: OUT });
  }
  if (q >= 1) wardMark(k, 0, -36.4, 1.1, OAK);
  stone(k, 0, -36.6, 1.0, BRASS);
  k.anchor = { x: 0, y: -30.0, r: 2.4 };
}

// ── wand: a ward key — bow ring at the hand, stepped bit at the tip ──
function wand(k: K): void {
  const q = k.q;
  const metal = q >= 1 ? BRASS : STEEL;
  ring(k, 0, 6.2, 2.8, 2.8, 1.6, metal);
  stone(k, 0, 6.2, 0.9, BRASS);
  slab(k, [-1.0, 3.4, 1.0, 3.4, 1.0, 1.6, -1.0, 1.6], metal, { line: 0.7 });
  pole(k, [0, 1.6, 0, -16.4], 2.0, metal);
  for (const y of [-1.0, -6.0]) ring(k, 0, y, 1.5, 0.5, 0.8, shade(metal, 0.2), { inner: true });
  // the bit: stepped wards on +x
  const bit = [0.8, -10.6, 4.4, -10.6, 4.4, -12.2, 3.0, -12.2, 3.0, -13.4, 4.4, -13.4, 4.4, -15.8, 2.2, -15.8, 2.2, -16.8, 0.8, -16.8];
  slab(k, bit, q >= 1 ? STEEL : shade(STEEL, 0.1), { hi: [[1.2, -11.2, 3.8, -11.2]] });
  if (q >= 1 && k.pass === 'paint') { k.c.rect(1.4, -14.6, 1.2, 2.4).fill(CRIMSON); }
  if (q === 2) { detail(k, [3.6, -11.2, 3.0, -12.0], FROST, 0.4); detail(k, [3.6, -14.0, 3.0, -15.0], FROST, 0.4); }
  disc(k, 0, -17.2, 1.2, 1.0, metal, { line: 0.6 });
  // a crimson tassel on the bow
  if (k.pass !== 'light') {
    pole(k, [-2.2, 7.8, -3.4, 10.4], 0.6, q === 0 ? FADED : CRIMSON, { flat: true });
    slab(k, [-4.2, 10.0, -2.6, 10.0, -2.2, 13.6, -3.4, 14.2, -4.8, 13.4], q === 0 ? FADED : CRIMSON, { line: 0.6, smooth: true });
  }
  k.anchor = { x: 0, y: 1.6, r: 1.8 };
}

// ── effect language: lantern light — lamp rays and a flicker (the rig pulses the light layer), lamp-lit edges, glints ──
const glints = (k: K, pts: [number, number][], per = 1.6, max = 3) => { const n = fxCount(k, per, max); for (let i = 0; i < n; i++) { const [x, y] = pts[i % pts.length]; mote(k, x, y, 0.6, i % 2 ? FROST : LAMP, 'spark', { bob: 0.3, spin: 1.8, phase: i * 2.1 }); } };
function fxSword(k: K): void {
  glowLine(k, [-1.9, -7, -1.9, -27, -0.2, -31.4], 0.4 + 0.3 * bloom(k), LAMP, true, STEEL);
  glints(k, [[0.4, -34.2], [-3.4, -18], [3.6, -24]]);
}
function fxAxe(k: K): void {
  glowLine(k, [10.0, -27.0, 10.0, -17.2], 0.45 + 0.3 * bloom(k), LAMP, true, STEEL);
  glints(k, [[11.6, -28.8], [0.2, -34.6], [11.6, -16.0]]);
}
function fxBow(k: K): void {
  for (const s of [-1, 1]) glowSpot(k, 4.8, s * 6.2, 0.7 + 0.4 * bloom(k), LAMP, true);
  glints(k, [[6.8, -13.0], [6.8, 13.0], [-3.6, -22.4]]);
}
function fxStaff(k: K): void {
  const n = 4 + fxCount(k, 3, 6);
  rays(k, 0, -44.8, n, 9 + 7 * bloom(k), -Math.PI, Math.PI * (1 - 2 / n), LAMP, 0.9);
  haze(k, 0, -44.8, 9, 8, LAMP, 0.12);
  glints(k, [[-8.6, -34.4], [8.6, -34.4], [0, -60.4]]);
}
function fxWand(k: K): void {
  glowLine(k, [4.4, -10.6, 4.4, -12.2, 3.0, -12.2, 3.0, -13.4, 4.4, -13.4, 4.4, -15.8], 0.35 + 0.2 * bloom(k), LAMP, true, STEEL);
  glints(k, [[5.6, -17.4], [-3.2, 6.2]]);
}
void jit;

// ═══════════════ the other held families (rollout 2026-10-11) ═══════════════

// ── greatsword: a beacon blade — a broad parallel blade with a clipped point; a shuttered signal lamp set in the
//    ricasso (shutters closed → half → open with craft, as on the beacon mast); a guard bar with ward-stepped ends flying
//    a pennant at each end (a signal pair); the pommel is the bit of a great key ──
function greatsword(k: K): void {
  const q = k.q, metal = q >= 1 ? BRASS : STEEL;
  k.anchor = { x: 0, y: -5.8, r: 3.0 };
  const blade = [-4.0, -17.6, 4.0, -17.6, 4.0, -44.6, 0.6, -50.4, -4.0, -46.8];
  bevel(k, blade, [-4.0, -17.6, 0, -17.6, 0, -49.8, -4.0, -46.8], STEEL, { ridge: [0, -18.4, 0, -49.0], edge: [-3.3, -18.4, -3.3, -46.4, 0.2, -49.6], edgeCol: EDGE });
  frost(k, -2.4, -24, -42, 1);
  if (q >= 1) wardMark(k, 1.8, -24.6, 1.8, STEEL);
  slab(k, [-4.8, -7.6, 4.8, -7.6, 4.8, -17.8, -4.8, -17.8], q >= 1 ? CRIMSON : shade(STEEL, 0.25), { line: 0.9, hi: [[-4.1, -8.4, -4.1, -17.0]] });
  for (const y of [-8.0, -17.4]) slab(k, [-5.4, y - 0.8, 5.4, y - 0.8, 5.4, y + 0.8, -5.4, y + 0.8], metal, { line: 0.7 });
  const win = [-2.8, -16.2, 2.8, -16.2, 2.8, -9.2, -2.8, -9.2];
  glowPoly(k, win, LAMP, q >= 1, 0x241a18);
  if (q >= 1) glowSpot(k, 0, -12.7, q === 2 ? 1.8 : 1.1, LAMP, true);
  if (k.pass === 'paint') {
    const open = q === 0 ? 0 : q === 1 ? 0.5 : 1;
    for (let i = 0; i < 5; i++) { const y = -16.0 + i * 1.4; if (open < 1) k.c.rect(-2.8, y, 5.6, 1.2 * (1 - open)).fill(shade(STEEL, 0.4)); k.c.moveTo(-2.8, y).lineTo(2.8, y).stroke({ width: 0.35, color: OUT, alpha: 0.7 }); }
    k.c.poly(win, true).stroke({ width: 0.7, color: OUT });
  }
  slab(k, [-10.6, -4.6, 10.6, -4.6, 10.6, -6.2, 9.2, -6.2, 9.2, -7.0, -9.2, -7.0, -9.2, -6.2, -10.6, -6.2], metal, { hi: [[-10.0, -5.8, 10.0, -5.8]] });
  pennant(k, -10.0, -4.8, 8.6, 2.6, 2.2, q === 0 ? FADED : CRIMSON, q === 0 ? mix(ENAMEL, FADED, 0.4) : ENAMEL, 0.7);
  if (q >= 1) pennant(k, 10.0, -4.8, 8.6, 2.6, 0.94, q === 2 ? NAVY : ENAMEL, q === 2 ? ENAMEL : CRIMSON, 0.7);
  slab(k, [-1.9, -4.6, 1.9, -4.6, 1.9, 10.0, -1.9, 10.0], OAK, { line: 0.8 });
  lash(k, 0, -4.4, 2.0, 3.8, NAVY, { gap: 1.1, slant: 0.6, bulge: 0.2 });
  slab(k, [-2.4, 2.4, 2.4, 2.4, 2.4, 4.0, -2.4, 4.0], metal, { line: 0.6 });
  lash(k, 0, 4.4, 9.6, 3.8, NAVY, { gap: 1.1, slant: 0.6, bulge: 0.2 });
  slab(k, [-1.4, 10.0, 1.4, 10.0, 1.4, 15.6, -1.4, 15.6], metal, { line: 0.7 });
  slab(k, [1.4, 11.2, 5.6, 11.2, 5.6, 12.6, 4.2, 12.6, 4.2, 13.8, 5.6, 13.8, 5.6, 15.6, 1.4, 15.6], metal, { line: 0.7, hi: [[1.8, 11.8, 5.0, 11.8]] });
  stone(k, 0, 3.2, 0.9, BRASS);
}

// ── great axe: the beacon halberd — a squared bit, a spear point, a key-bit hook behind, a signal pennant ──
function greataxe(k: K): void {
  const q = k.q;
  pole(k, [0, 11.6, 0, -46], 3.2, OAK);
  for (const y of [8.6, -14, -26]) ring(k, 0, y, 2.1, 0.7, 0.9, q >= 1 ? BRASS : STEEL);
  if (q >= 1) slab(k, [-1.7, -2.0, 1.7, -2.0, 1.7, 1.6, -1.7, 1.6], CRIMSON, { line: 0.6, flat: true, inner: true });
  bevel(k, [-1.8, -46, 1.8, -46, 1.9, -49.4, 0, -55.0, -1.9, -49.4], [-1.8, -46, 0, -46, 0, -55.0, -1.9, -49.4], STEEL, { edge: [-1.3, -49.2, -0.1, -54.0], edgeCol: EDGE });
  const blade = [1.8, -45.0, 13.4, -47.6, 15.2, -46.6, 15.2, -28.6, 13.4, -27.4, 1.8, -31.0];
  bevel(k, blade, [1.8, -45.0, 13.4, -47.6, 14.0, -47.2, 12.2, -38.2, 1.8, -38.2], STEEL, { edge: [14.4, -45.8, 14.4, -29.4], edgeCol: EDGE, ridge: [3.4, -38.2, 12.0, -38.2] });
  if (k.pass === 'paint') for (const [x, y] of [[4.2, -43.6], [6.6, -44.4], [9.0, -45.2]]) k.c.rect(x, y, 1.3, 1.5).fill(shade(STEEL, 0.5));
  frost(k, 9.4, -30.6, -44, -1);
  slab(k, [-1.6, -43.6, -8.2, -43.6, -8.2, -40.4, -5.8, -40.4, -5.8, -38.0, -8.2, -38.0, -8.2, -34.8, -1.6, -34.8], STEEL, { hi: [[-7.6, -43.0, -2.2, -43.0]] });
  slab(k, [-2.2, -47.0, 2.2, -47.0, 2.2, -29.8, -2.2, -29.8], q >= 1 ? BRASS : shade(STEEL, 0.1), { hi: [[-1.6, -46.2, -1.6, -30.6]] });
  if (q >= 1) wardMark(k, 8.6, -32.6, 1.6, STEEL);
  // the beacon: a small shuttered lantern hanging from the fluke on a short chain, lit with craft
  {
    const metal = q >= 1 ? BRASS : STEEL, lx = -7.0, ly = -34.8;
    pole(k, [lx, ly, lx, ly + 2.4], 0.5, metal, { flat: true });
    ring(k, lx, ly + 2.9, 0.8, 0.8, 0.6, metal);
    slab(k, [lx - 3.0, ly + 5.6, lx + 3.0, ly + 5.6, lx, ly + 3.4], q >= 1 ? CRIMSON : shade(STEEL, 0.25), { line: 0.7 });
    slab(k, [lx - 2.6, ly + 5.6, lx + 2.6, ly + 5.6, lx + 2.6, ly + 12.0, lx - 2.6, ly + 12.0], 0x3a2c22, { line: 0.8 });
    glowPoly(k, [lx - 1.8, ly + 6.4, lx + 1.8, ly + 6.4, lx + 1.8, ly + 11.2, lx - 1.8, ly + 11.2], LAMP, q >= 1, 0x241a18);
    for (const x of [lx - 2.6, lx + 2.6]) pole(k, [x, ly + 5.6, x, ly + 12.0], 0.8, metal);
    slab(k, [lx - 3.0, ly + 12.0, lx + 3.0, ly + 12.0, lx + 2.4, ly + 13.4, lx - 2.4, ly + 13.4], metal, { line: 0.7 });
    if (q >= 1) glowSpot(k, lx, ly + 8.8, q === 2 ? 1.5 : 1.0, LAMP, true);
  }
  stone(k, 0, -38.4, 1.1, BRASS);
  k.anchor = { x: 0, y: -29.6, r: 2.6 };
}

// ── mace: the ward lock — a brass padlock for a head, its shackle a loop, a keyhole in an enamel plate ──
function mace(k: K): void {
  const q = k.q, metal = q >= 1 ? BRASS : STEEL, d = 2.4;
  pole(k, [0, 6.6, 0, -16 + d], 2.8, OAK);
  for (const y of [4.4, -2.6]) ring(k, 0, y, 1.9, 0.6, 0.9, metal);
  ring(k, 0, -28.6 + d, 4.4, 5.6, 2.0, STEEL, { a0: Math.PI, a1: Math.PI * 2 });
  for (const s of [-1, 1]) pole(k, [s * 4.4, -28.6 + d, s * 4.4, -25.8 + d], 2.0, STEEL);
  slab(k, [-6.6, -26.4 + d, 6.6, -26.4 + d, 7.4, -24.4 + d, 7.4, -16.6 + d, 6.0, -15.0 + d, -6.0, -15.0 + d, -7.4, -16.6 + d, -7.4, -24.4 + d], metal, { hi: [[-6.0, -25.2 + d, 5.6, -25.2 + d]] });
  slab(k, [-4.4, -24.2 + d, 4.4, -24.2 + d, 4.4, -17.2 + d, -4.4, -17.2 + d], q >= 1 ? CRIMSON : shade(STEEL, 0.2), { line: 0.7 });
  if (k.pass === 'paint') { k.c.circle(0, -21.8 + d, 1.2).fill(0x1b1410); k.c.poly([-0.6, -21.4 + d, 0.6, -21.4 + d, 1.0, -18.8 + d, -1.0, -18.8 + d], true).fill(0x1b1410); }
  for (const [x, y] of [[-6.2, -25.2], [6.2, -25.2], [-6.2, -16.2], [6.2, -16.2]]) disc(k, x, y + d, 0.7, 0.7, metal, { line: 0.5, inner: true });
  frost(k, -5.8, -17.6 + d, -24 + d, 1);
  if (q >= 1) wardMark(k, 4.8, -16.0 + d, 1.0, metal);
  k.anchor = { x: 0, y: -15.0 + d, r: 2.4 };
  stone(k, 5.8, -20.8 + d, 0.8, BRASS);
}

// ── crossbow: the signal crossbow — an oak stock in brass, a flat angled prod banded in enamel, pennants at the tips ──
function xbow(k: K, hand: boolean): void {
  const q = k.q, metal = q >= 1 ? BRASS : STEEL, pw = hand ? 9.6 : 13.0, py = hand ? -9 : -16, sy1 = hand ? -12.4 : -24, sy0 = hand ? 3 : 8;
  if (hand) slab(k, [-1.9, 5.0, 2.6, 5.0, 3.6, 1.0, 2.0, -2.0, 1.9, sy1, -1.9, sy1, -1.9, -2.0], OAK, { hi: [[-1.2, sy1 + 1, -1.2, -2.6]] });
  else slab(k, [-2.6, sy0, -1.2, sy0, -1.2, sy0 - 1.4, 1.2, sy0 - 1.4, 1.2, sy0, 2.6, sy0, 2.6, sy0 - 4, 2.2, sy1, -2.2, sy1, -2.6, sy0 - 4], OAK, { hi: [[-2.0, sy1 + 1, -2.0, sy0 - 4]] });
  for (const y of [sy1 + 1.4, py + 6.6]) slab(k, [-2.6, y - 0.8, 2.6, y - 0.8, 2.6, y + 0.8, -2.6, y + 0.8], metal, { line: 0.6 });
  pole(k, [0, py + 7, 0, sy1 - 3.6], 1.0, shade(OAK, 0.2), { flat: true });
  slab(k, [-1.2, sy1 - 3.6, 0, sy1 - 7.0, 1.2, sy1 - 3.6], STEEL, { line: 0.7 });
  // a flat prod in two straight segments a side
  for (const s of [-1, 1]) {
    const pts = [s * 1.6, py - 1.6, s * pw * 0.55, py - 2.6, s * pw, py + 3.4];
    pole(k, pts, hand ? 2.0 : 2.6, STEEL);
    if (k.pass === 'paint') { k.c.circle((pts[0] + pts[2]) / 2, (pts[1] + pts[3]) / 2, hand ? 1.1 : 1.4).fill(q >= 1 ? CRIMSON : shade(OAK, 0.3)); k.c.circle((pts[2] + pts[4]) / 2, (pts[3] + pts[5]) / 2, hand ? 1.1 : 1.4).fill(q >= 1 ? ENAMEL : shade(OAK, 0.3)); }
    if (q >= 1) pennant(k, s * pw, py + 3.4, hand ? 5.0 : 6.4, 2.0, s > 0 ? 0.2 : Math.PI - 0.2, CRIMSON, ENAMEL, 0.5);
  }
  slab(k, [-2.2, py - 3.4, 2.2, py - 3.4, 2.2, py + 0.4, -2.2, py + 0.4], metal, { line: 0.7 });
  pole(k, [-pw + 0.6, py + 3.2, 0, py + 7.2, pw - 0.6, py + 3.2], 0.6, 0xece6d8, { flat: true });
  pole(k, hand ? [1.0, -1.4, 2.6, 2.6] : [0.6, -2.4, 0.8, 4.6], 0.9, metal);
  if (q === 2) wardMark(k, 0, hand ? -5.6 : -8.0, 1.2, OAK);
  k.anchor = { x: 0, y: py - 1.6, r: 2.4 };
  stone(k, 0, py - 1.6, 0.9, BRASS);
}
const crossbow = (k: K) => xbow(k, false), handxbow = (k: K) => xbow(k, true);

// ── shield: the ward door — a tall board quartered in crimson and white enamel, brass studs, a keyhole escutcheon ──
function shield(k: K): void {
  const q = k.q, metal = q >= 1 ? BRASS : STEEL;
  const out = [-10.4, -15.0, 10.4, -15.0, 10.0, 14.4, 0, 17.0, -10.0, 14.4];
  slab(k, out, q >= 1 ? ENAMEL : mix(ENAMEL, FADED, 0.35), { hi: [[-9.4, -13.8, -9.0, 13.0]] });
  if (k.pass === 'paint') {
    k.c.poly([-10.2, -14.6, 0, -14.6, 0, 0.8, -10.1, 0.8], true).fill(q >= 1 ? CRIMSON : FADED);
    k.c.poly([0, 0.8, 10.1, 0.8, 9.9, 14.2, 0, 16.6], true).fill(q >= 1 ? CRIMSON : FADED);
    k.c.poly(out, true).stroke({ width: 0.9, color: OUT, join: 'round' });
  }
  ring(k, 0, 1, 10.6, 16.0, 1.6, metal, { a0: -Math.PI, a1: 0, inner: true });
  for (const [x, y] of [[-8.4, -12.8], [8.4, -12.8], [-8.2, 12.4], [8.2, 12.4], [-8.6, 0], [8.6, 0]]) disc(k, x, y, 0.85, 0.85, metal, { line: 0.5 });
  slab(k, [-2.6, -3.0, 2.6, -3.0, 2.6, 4.6, 0, 6.2, -2.6, 4.6], metal, { hi: [[-2.0, -2.4, -2.0, 4.0]] });
  if (k.pass === 'paint') { k.c.circle(0, -0.4, 1.0).fill(0x1b1410); k.c.poly([-0.5, 0, 0.5, 0, 0.8, 2.6, -0.8, 2.6], true).fill(0x1b1410); }
  frost(k, 6.0, 12, 3, -1);
  if (q >= 1) wardMark(k, -5.4, 7.4, 2.0, ENAMEL);
  k.anchor = { x: 0, y: -3.0, r: 3 };
  stone(k, 0, 9.0, 1.0, BRASS);
}

// ── quiver: a signal-flag case — a banded cylinder, two flag poles standing among the arrows ──
function quiver(k: K): void {
  const q = k.q, metal = q >= 1 ? BRASS : STEEL;
  for (let i = 0; i < 2; i++) { const x = -2.6 + i * 2.6, y = -16.4 - i * 1.6; pole(k, [x * 0.6, -8, x, y + 2], 0.9, OAK, { flat: true }); slab(k, [x - 1.8, y + 4, x, y - 2.6, x + 1.8, y + 4, x, y + 2.4], ENAMEL, { line: 0.7 }); }
  pole(k, [2.8, -9, 3.6, -21], 0.8, OAK);
  pennant(k, 3.6, -20.6, 6.6, 2.4, -0.15, q >= 1 ? CRIMSON : FADED, ENAMEL, 0.5);
  slab(k, [-4.8, -10, 4.8, -10, 4.8, 12.4, -4.8, 12.4], q >= 1 ? CRIMSON : FADED, { hi: [[-4.0, -9, -4.0, 11.4]] });
  if (k.pass === 'paint') for (const y of [-3.6, 4.6]) k.c.rect(-4.8, y - 1.6, 9.6, 3.2).fill(ENAMEL);
  for (const y of [-10.4, 12.0]) slab(k, [-5.2, y - 1.0, 5.2, y - 1.0, 5.2, y + 1.0, -5.2, y + 1.0], metal, { line: 0.7 });
  if (q >= 1) wardMark(k, -2.0, 1.0, 1.4, CRIMSON);
  k.anchor = { x: 0, y: -9.4, r: 2.4 };
  stone(k, 2.2, 1.0, 0.8, BRASS);
}

// ── orb: a ward lantern — a brass hand lantern, glass on four sides, a crimson cap, the flame inside ──
function orb(k: K): void {
  const q = k.q, metal = q >= 1 ? BRASS : STEEL;
  ring(k, 0, -11.6, 2.2, 2.2, 1.1, metal);
  slab(k, [-6.0, -7.8, 6.0, -7.8, 0, -11.0], q >= 1 ? CRIMSON : shade(STEEL, 0.25), { hi: [[-4.4, -8.4, -0.6, -10.4]] });
  slab(k, [-5.2, -7.8, 5.2, -7.8, 5.2, 6.4, -5.2, 6.4], 0x3a2c22, { line: 0.9 });
  const win = [-4.0, -6.6, 4.0, -6.6, 4.0, 5.2, -4.0, 5.2];
  if (k.pass === 'paint') k.c.poly(win, true).fill(q >= 1 ? light(LAMP, 0.25) : 0x2a2018);
  for (const x of [-5.2, 0, 5.2]) pole(k, [x, -7.8, x, 6.4], 1.0, metal, { inner: x === 0 });
  slab(k, [-6.0, 6.2, 6.0, 6.2, 5.2, 8.4, -5.2, 8.4], metal, { hi: [[-5.4, 6.8, 5.0, 6.8]] });
  if (q >= 1) glowSpot(k, 0, -0.6, q === 2 ? 2.4 : 1.5, LAMP, true);
  frost(k, -3.4, 4.6, -4, 1);
  k.anchor = { x: 0, y: -7.8, r: 2.4 };
  stone(k, 3.6, 7.3, 0.7, BRASS);
}

// ── effects for the rollout families (lamp light, glints) ──
function fxGreatsword(k: K): void { const n = 3 + fxCount(k, 2, 5); rays(k, 0, -12.7, n, 8 + 6 * bloom(k), -Math.PI, Math.PI * (1 - 2 / n), LAMP, 0.8); glowLine(k, [-3.3, -18.4, -3.3, -46.4, 0.2, -49.6], 0.4 + 0.3 * bloom(k), LAMP, true, STEEL); glints(k, [[0.6, -52], [-5.6, -30], [5.6, -40]]); }
function fxGreataxe(k: K): void { const n = 3 + fxCount(k, 2, 5); rays(k, -7.0, -26.0, n, 6 + 4 * bloom(k), -Math.PI, Math.PI * (1 - 2 / n), LAMP, 0.7); glowLine(k, [14.4, -45.8, 14.4, -29.4], 0.5 + 0.3 * bloom(k), LAMP, true, STEEL); glints(k, [[0, -56.4], [16.6, -47.6], [-10.6, -20]]); }
function fxMace(k: K): void { glowSpot(k, 0, -18.6, 1.2 + bloom(k), LAMP, true); rays(k, 0, -18.6, 2 + fxCount(k, 2, 4), 7 + 5 * bloom(k), -Math.PI, 0, LAMP, 0.7); glints(k, [[0, -32.6], [-8.4, -23.6], [8.4, -13.6]]); }
function fxXbow(k: K): void { glowSpot(k, 0, -17.6, 1.0 + 0.5 * bloom(k), LAMP, true); glints(k, [[14.4, -12], [-14.4, -12], [0, -29]]); }
function fxHand(k: K): void { glowSpot(k, 0, -11.6, 0.9, LAMP, true); glints(k, [[10.8, -7], [-10.8, -7]], 1.2, 2); }
function fxShield(k: K): void { glowSpot(k, 0, 0.8, 1.4 + bloom(k), LAMP, true); rays(k, 0, 0.8, 3 + fxCount(k, 3, 5), 9 + 6 * bloom(k), -Math.PI * 0.9, -Math.PI * 0.1, LAMP, 0.8); glints(k, [[-8.4, -12.8], [8.2, 12.4], [11.4, -4]]); }
function fxQuiver(k: K): void { glints(k, [[4.6, -22.6], [-3.0, -20], [5.6, 4]], 1.6, 3); }
function fxOrb(k: K): void { const n = 4 + fxCount(k, 3, 6); rays(k, 0, -0.6, n, 10 + 7 * bloom(k), -Math.PI, Math.PI * (1 - 2 / n), LAMP, 0.9); haze(k, 0, -0.6, 9, 9, LAMP, 0.14); glints(k, [[-7.4, -9], [7.0, 5], [0, -15]]); }

export const WARDEN: SeriesInfo = {
  id: 'warden', gen: 3, name: 'Warden', maker: 'the Shiverline signallers and the Beaconbreak ward', zones: 'Shiverline Escarpment, Beaconbreak Ward', levels: '37–48',
  shape: 'tall, upright and rectilinear; crisp key-ward steps; swallowtail pennants flying off one side',
  palette: [{ name: 'ward crimson', hex: CRIMSON }, { name: 'white enamel', hex: ENAMEL }, { name: 'brass', hex: BRASS }, { name: 'bright steel', hex: STEEL }, { name: 'ridge frost', hex: FROST }],
  motif: 'key-ward steps and a swallowtail pennant at the junction; the stamped ward',
  late: 'a beacon lamp whose shutters open with craft; frost-etched steel; signal flags',
  effects: 'lamp rays and a beacon flicker, lamp-lit edges, frost and lamp glints; spark impacts',
  draw: {
    blade: withFx(sword, fxSword), axe: withFx(axe, fxAxe), bow: withFx(bow, fxBow), staff: withFx(staff, fxStaff), wand: withFx(wand, fxWand),
    greatblade: withFx(greatsword, fxGreatsword), greataxe: withFx(greataxe, fxGreataxe), mace: withFx(mace, fxMace), crossbow: withFx(crossbow, fxXbow),
    handxbow: withFx(handxbow, fxHand), shield: withFx(shield, fxShield), quiver: withFx(quiver, fxQuiver), orb: withFx(orb, fxOrb),
  },
};
