// Series G3 · Warden (item levels 37–48): the Shiverline signal ridge and the Beaconbreak ward.
// Made by signallers and ward keepers: crimson ward enamel and white enamel (Mera's crimson sash, the heraldic signal
// colours, ART-REFERENCES RW4, WR3), brass fittings (Venn's brass buttons), bright steel, dark oak, a frost-blue etch
// from the ridge. Shape language: tall and upright, rectilinear, crisp steps cut like the wards of a key, swallowtail
// pennants flying off the weapon (asymmetric) (rule A1). Light: only the beacon lamp of the staff (R6).
// Maker's mark: a stamped key ward.
import type { SeriesInfo } from './index';
import { detail, disc, glowPoly, glowSpot, lash, pole, ring, slab, bevel, stone, type K } from './kit';
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
  bevel(k, [-1.5, -27, 1.5, -27, 1.6, -30, 0, -35.6, -1.6, -30], [-1.5, -27, 0, -27, 0, -35.6, -1.6, -30], STEEL, { edge: [-1.1, -29.8, -0.1, -34.6], edgeCol: EDGE });
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

export const WARDEN: SeriesInfo = {
  id: 'warden', gen: 3, name: 'Warden', maker: 'the Shiverline signallers and the Beaconbreak ward', zones: 'Shiverline Escarpment, Beaconbreak Ward', levels: '37–48',
  shape: 'tall, upright and rectilinear; crisp key-ward steps; swallowtail pennants flying off one side',
  palette: [{ name: 'ward crimson', hex: CRIMSON }, { name: 'white enamel', hex: ENAMEL }, { name: 'brass', hex: BRASS }, { name: 'bright steel', hex: STEEL }, { name: 'ridge frost', hex: FROST }],
  motif: 'key-ward steps and a swallowtail pennant at the junction; the stamped ward',
  late: 'a beacon lamp whose shutters open with craft; frost-etched steel; signal flags',
  draw: { blade: sword, axe, bow, staff, wand },
};
