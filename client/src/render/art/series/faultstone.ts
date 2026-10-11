// Series G5 · Faultstone (item levels 61–69): what the Faultline gives back. The material is the Faultstone obelisk's
// own (town art, npcs.ts: dark slate, rectangular rune slots, magenta runes #FF4A9A; ART-REFERENCES WR4), bound with
// bone. The slate is lifted a step lighter than the obelisk so it separates from dark backgrounds (IL2). The series'
// idea — and its only reason to float — is that the Faultline cracks matter and holds the pieces apart (R11): blades and heads come in segments
// with a gap between them, wider with craft. Shape language: monolithic tapered slabs, stepped bases, pyramidion tips,
// hard angles (rule A1). Light: the rune slots only (R6). Rarity accent: a shard set in the bone (A5).
import type { SeriesInfo } from './index';
import { detail, float, fxCount, glowPoly, haze, mote, pole, qpts, ring, slab, bevel, stone, withFx, zap, type K } from './kit';
import { light, mix, shade } from '../util';
import { localXf } from '../weaponArt';

const SLATE = 0x544a62, SLATE_L = 0x7c708a, BONE = 0xdcd3c2, RUNE = 0xff4a9a, VOID = 0x1c1622, BREAK = 0xb0a4ba;

/** Gap between split pieces by craft (they touch on a normal piece, the Faultline holds them apart on better ones). */
const gap = (k: K) => [0.5, 1.2, 1.8][k.q];

/** A slab segment of an obelisk: two-tone faces split down the middle, fracture edges pale where it broke. */
function segment(k: K, pts: number[], litPts: number[], fracture: number[][]): void {
  bevel(k, pts, litPts, SLATE, { line: 0.9 });
  if (k.pass === 'paint') k.c.poly(litPts, true).fill({ color: light(SLATE_L, 0.1), alpha: 0.55 });
  for (const f of fracture) detail(k, f, BREAK, 1.0, 1);
}

/** A carved rune slot (dormant dark on normal pieces, lit on better ones). */
function slot(k: K, x: number, y: number, w: number, h: number, on: boolean): void {
  glowPoly(k, [x - w / 2, y - h / 2, x + w / 2, y - h / 2, x + w / 2, y + h / 2, x - w / 2, y + h / 2], RUNE, on, VOID);
  if (k.pass === 'paint') detail(k, [x - w * 0.22, y - h * 0.3, x + w * 0.22, y - h * 0.05, x - w * 0.22, y + h * 0.2, x + w * 0.1, y + h * 0.32], on ? light(RUNE, 0.75) : shade(SLATE, 0.2), 0.45);
}

const chip = (kk: K) => slab(kk, [-1.0, -0.6, 0.8, -1.0, 1.1, 0.6, -0.6, 0.9], SLATE_L, { line: 0.6 });

// ── sword: an obelisk blade in three pieces, held apart by the Faultline ──
function sword(k: K): void {
  const q = k.q, G = gap(k);
  k.anchor = { x: 0, y: -6.4, r: 3.4 };
  const b0 = -8.0, b1 = -14.0, EDGE = light(SLATE_L, 0.35);
  // three blade pieces, each with two ground edges (bright interior lines) so the column reads as a blade
  segment(k, [-3.8, b0, 3.8, b0, 3.5, b1 + 0.5, 1.2, b1, -0.8, b1 + 0.7, -3.5, b1], [-3.8, b0, 0, b0, -0.2, b1 + 0.6, -3.5, b1], [[-3.3, b1 + 0.15, -0.8, b1 + 0.7, 1.2, b1, 3.3, b1 + 0.5]]);
  detail(k, [-3.1, b0 - 0.6, -2.9, b1 + 0.6], EDGE, 0.7); detail(k, [3.1, b0 - 0.6, 2.9, b1 + 0.9], shade(EDGE, 0.25), 0.6);
  slot(k, 0, -11.0, 1.8, 3.6, q >= 1);
  const mid = (kk: K) => {
    const h = 7.6;
    segment(kk, [-3.5, 0, -0.8, -0.7, 1.2, 0, 3.5, -0.5, 3.0, -h + 0.5, 0.5, -h, -3.0, -h + 0.6], [-3.5, 0, -0.8, -0.7, -0.2, -h + 0.3, -3.0, -h + 0.6], [[-3.2, -0.3, -0.8, -0.9, 1.2, -0.2, 3.2, -0.7], [-2.8, -h + 0.8, 0.5, -h + 0.2, 2.8, -h + 0.7]]);
    detail(kk, [-2.8, -0.8, -2.4, -h + 1.1], EDGE, 0.7); detail(kk, [2.8, -1.0, 2.4, -h + 1.1], shade(EDGE, 0.25), 0.6);
    slot(kk, 0, -h / 2, 1.6, 3.4, kk.q >= 1);
  };
  const tip = (kk: K) => {
    // the point: two long facets meeting at a sharp tip
    segment(kk, [-3.0, 0, 0.5, -0.6, 3.0, -0.1, 2.4, -4.8, 0, -10.8, -2.4, -4.8], [-3.0, 0, 0.5, -0.6, 0, -10.8, -2.4, -4.8], [[-2.8, -0.3, 0.5, -0.9, 2.8, -0.4]]);
    detail(kk, [-2.3, -0.8, -1.9, -5.0, -0.2, -9.8], EDGE, 0.7);
    if (kk.pass === 'paint') detail(kk, [0, -1.0, 0, -10.2], shade(SLATE, 0.35), 0.5);
    slot(kk, 0, -2.8, 1.3, 2.2, kk.q === 2);
  };
  float(k, 0, b1 - G, mid, { bob: q === 0 ? 0 : 0.35, phase: 0.4, glow: q >= 1 ? RUNE : 0, glowR: 4 });
  float(k, 0, b1 - G - 7.6 - G, tip, { bob: q === 0 ? 0 : 0.55, phase: 1.6, glow: q === 2 ? RUNE : 0, glowR: 3 });
  // stepped guard (the obelisk's base, two steps) and a bone grip
  slab(k, [-7.0, -5.0, 7.0, -5.0, 7.0, -6.8, 5.4, -6.8, 5.4, -8.4, -5.4, -8.4, -5.4, -6.8, -7.0, -6.8], SLATE_L, { hi: [[-6.6, -6.2, 6.6, -6.2], [-5.0, -7.9, 5.0, -7.9]] });
  slab(k, [-1.7, -5.0, 1.7, -5.0, 1.9, 4.0, -1.9, 4.0], BONE, { hi: [[-1.1, -4.2, -1.2, 3.2]] });
  if (k.pass === 'paint') for (const y of [-2.6, 0.2, 3.0]) detail(k, [-1.8, y, 1.8, y - 0.3], shade(BONE, 0.45), 0.6);
  slab(k, [-2.6, 3.8, 2.6, 3.8, 1.8, 8.0, 0, 9.8, -1.8, 8.0], SLATE, { hi: [[-2.0, 4.6, -0.6, 8.4]] });
  stone(k, 0, 5.8, 0.9, BONE);
  if (q === 2) { float(k, 5.2, -22.6, chip, { bob: 0.9, phase: 2.2, deco: true }); float(k, -4.8, -28.0, chip, { bob: 1.1, phase: 0.9, deco: true }); }
}

// ── axe: a wedge of obelisk split off its haft, hovering in its socket ──
function axe(k: K): void {
  const q = k.q, G = gap(k);
  pole(k, [0, 8, 0, -28.0], 3.0, SLATE_L);
  for (const y of [5.8, -1.0]) ring(k, 0, y, 2.0, 0.6, 0.9, BONE);
  slab(k, [-1.8, 2.2, 1.8, 2.2, 1.8, -0.2, -1.8, -0.2], BONE, { line: 0.6 });
  slab(k, [-2.6, -28.6, 2.6, -28.6, 2.6, -15.8, -2.6, -15.8], BONE, { hi: [[-2.0, -27.8, -2.0, -16.6]] });
  stone(k, 0, -18.0, 0.9, BONE);
  const head = (kk: K) => {
    // a wedge: narrow at the haft, a broad curved bit
    segment(kk, [0, -5.2, 6.4, -7.6, 11.2, -11.6, 12.8, -5.4, 13.4, 0, 12.8, 5.4, 11.2, 11.6, 6.4, 7.6, 0, 5.2, 0.8, 0], [0, -5.2, 6.4, -7.6, 11.2, -11.6, 12.8, -5.4, 13.4, 0, 0.8, 0], [[0.5, -4.8, 1.2, -2.2, 0.5, 0, 1.2, 2.4, 0.5, 4.8]]);
    if (kk.pass === 'paint') { detail(kk, [11.4, -10.4, 12.5, -5.2, 12.9, 0, 12.5, 5.2, 11.4, 10.4], mix(SLATE_L, BONE, 0.7), 1.0); detail(kk, [9.6, -9.4, 10.8, -4.6, 11.2, 0], light(SLATE_L, 0.3), 0.6); }
    slot(kk, 6.0, -2.6, 1.6, 3.4, kk.q >= 1);
    slot(kk, 6.0, 2.6, 1.6, 3.4, kk.q === 2);
  };
  float(k, 2.6 + G, -22.2, head, { bob: q === 0 ? 0 : 0.4, phase: 0.8, glow: q >= 1 ? RUNE : 0, glowR: 5 });
  const shard = (kk: K) => segment(kk, [0, -3.8, -5.4, -2.6, -7.6, 0, -5.4, 2.6, 0, 3.8], [0, -3.8, -5.4, -2.6, -7.6, 0, 0, 0], [[-0.3, -3.3, -0.3, 3.3]]);
  float(k, -2.6 - G, -22.2, shard, { bob: q === 0 ? 0 : 0.5, phase: 2.6 });
  k.anchor = { x: 0, y: -15.8, r: 2.6 };
}

// ── bow: limbs of stacked slate pieces with gaps between them, a bone grip ──
function bow(k: K): void {
  const q = k.q, G = [0.4, 1.0, 1.5][q];
  for (const s of [-1, 1]) {
    const cl = qpts(3.0, s * 4.2, 9.2, s * 13.0, -2.4, s * 21.2, 50);
    const n = 5, total = cl.length / 2 - 1;
    for (let i = 0; i < n; i++) {
      const i0 = Math.round((i / n) * total), i1 = Math.round(((i + 1) / n) * total);
      const a = cl.slice(i0 * 2, i0 * 2 + 2), b = cl.slice(i1 * 2, i1 * 2 + 2);
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
      const w0 = 4.6 - i * 0.55, w1 = 4.6 - (i + 1) * 0.55;
      const A = [a[0] + ux * G / 2, a[1] + uy * G / 2], B = [b[0] - ux * G / 2, b[1] - uy * G / 2];
      const pts = [A[0] + nx * w0 / 2, A[1] + ny * w0 / 2, B[0] + nx * w1 / 2, B[1] + ny * w1 / 2, B[0] - nx * w1 / 2, B[1] - ny * w1 / 2, A[0] - nx * w0 / 2, A[1] - ny * w0 / 2];
      const lit = s > 0 ? [A[0] + nx * w0 / 2, A[1] + ny * w0 / 2, B[0] + nx * w1 / 2, B[1] + ny * w1 / 2, B[0], B[1], A[0], A[1]] : [A[0], A[1], B[0], B[1], B[0] - nx * w1 / 2, B[1] - ny * w1 / 2, A[0] - nx * w0 / 2, A[1] - ny * w0 / 2];
      bevel(k, pts, lit, SLATE, { line: 0.8 });
      if (k.pass === 'paint') k.c.poly(lit, true).fill({ color: light(SLATE_L, 0.1), alpha: 0.5 });
      if (i === 1 || i === 3) { const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2; slot(k, mx, my, 1.1, 1.9, q >= 1 && (i === 1 || q === 2)); }
    }
    slab(k, [-3.8, s * 22.4, -1.0, s * 22.0, -1.3, s * 19.6, -3.4, s * 19.8], BONE, { line: 0.7 });
  }
  slab(k, [1.0, -4.6, 5.0, -4.6, 5.0, 4.6, 1.0, 4.6], BONE, { hi: [[1.6, -3.8, 1.6, 3.8]] });
  if (k.pass === 'paint') for (const y of [-2.2, 0, 2.2]) detail(k, [1.0, y, 5.0, y - 0.3], shade(BONE, 0.45), 0.55);
  stone(k, 3.0, 0, 0.9, BONE);
  if (!k.rig) pole(k, [-2.4, -21.0, -2.4, 21.0], 0.6, mix(RUNE, BONE, 0.6), { flat: true });
  k.anchor = { x: 3.0, y: -4.8, r: 2.2 };
}

// ── staff: a small obelisk on a slate staff; its pyramidion floats above, split off ──
function staff(k: K): void {
  const q = k.q, G = gap(k);
  pole(k, [0, 22.6, 0, -33.6], 3.0, SLATE_L);
  for (const y of [20.2, 2.0]) ring(k, 0, y, 2.1, 0.7, 0.9, BONE);
  slab(k, [-1.9, -4.0, 1.9, -4.0, 1.9, 0.4, -1.9, 0.4], BONE, { line: 0.6 });
  stone(k, 0, -1.8, 0.8, BONE);
  k.c.save(); localXf(k.c, 0, -33.0, 0, 0.82); localXf(k.c, 0, 33.0, 0, 1);
  slab(k, [-7.0, -32.8, 7.0, -32.8, 7.0, -35.2, 5.2, -35.2, 5.2, -37.4, -5.2, -37.4, -5.2, -35.2, -7.0, -35.2], SLATE_L, { hi: [[-6.6, -34.4, 6.6, -34.4], [-4.8, -36.9, 4.8, -36.9]] });
  segment(k, [-4.2, -37.2, 4.2, -37.2, 3.3, -51.6, 1.0, -52.4, -0.8, -51.4, -3.3, -51.8], [-4.2, -37.2, 0, -37.2, -0.2, -51.6, -3.3, -51.8], [[-3.1, -51.6, -0.8, -51.1, 1.0, -52.2, 3.1, -51.4]]);
  for (const [y, on] of [[-40.8, q >= 1], [-44.8, q >= 1], [-48.6, q === 2]] as const) slot(k, 0, y, 1.9, 2.8, on);
  k.c.restore();
  const HK = 0.82, hy = (y: number) => -33.0 + (y + 33.0) * HK;
  float(k, 0, hy(-52.4 - G * 1.2), (kk) => {
    kk.c.save(); localXf(kk.c, 0, 0, 0, HK);
    segment(kk, [-3.2, 0.3, -0.8, -0.5, 1.0, 0.2, 3.2, -0.3, 0, -5.6], [-3.2, 0.3, -0.8, -0.5, 0, -5.6], [[-3.0, 0, -0.8, -0.8, 1.0, -0.1, 3.0, -0.6]]);
    kk.c.restore();
  }, { bob: q === 0 ? 0 : 0.7, phase: 0.3 });
  if (q === 2) for (const [x, y, p] of [[-6.4, -48.0, 0.4], [6.2, -43.6, 2.4]] as const) float(k, x * HK, hy(y), chip, { bob: 1.0, phase: p, deco: true });
  k.anchor = { x: 0, y: -33.2, r: 2.8 };
}

// ── wand: a stepped obelisk shard on a bone handle, the tip split off ──
function wand(k: K): void {
  const q = k.q, G = gap(k);
  slab(k, [-1.7, 6.4, 1.7, 6.4, 1.7, -1.2, -1.7, -1.2], BONE, { hi: [[-1.1, 5.6, -1.1, -0.4]] });
  if (k.pass === 'paint') for (const y of [1.2, 3.8]) detail(k, [-1.7, y, 1.7, y - 0.3], shade(BONE, 0.45), 0.55);
  stone(k, 0, 2.5, 0.75, BONE);
  slab(k, [-3.4, -1.0, 3.4, -1.0, 3.4, -2.8, -3.4, -2.8], SLATE_L, { line: 0.8 });
  segment(k, [-2.7, -2.8, 2.7, -2.8, 2.0, -15.2, 0.5, -15.8, -0.9, -15.0, -2.0, -15.4], [-2.7, -2.8, 0, -2.8, -0.2, -15.4, -2.0, -15.4], [[-1.9, -15.2, -0.9, -14.8, 0.5, -15.6, 1.9, -15.1]]);
  slot(k, 0, -7.0, 1.4, 3.0, q >= 1);
  slot(k, 0, -11.8, 1.2, 2.6, q === 2);
  float(k, 0, -15.8 - G * 1.2, (kk) => segment(kk, [-2.0, 0.3, 0.5, -0.4, 2.0, 0.1, 0, -5.8], [-2.0, 0.3, 0.5, -0.4, 0, -5.8], [[-1.8, 0, 0.5, -0.6, 1.8, -0.3]]), { bob: q === 0 ? 0 : 0.6, phase: 1.1 });
  k.anchor = { x: 0, y: -1.9, r: 2.6 };
}

// ── effect language: magenta energy arcing across the split gaps, glowing chips, runes pulsing (the rig pulses the
//    light layer) ──
const sparksAcross = (k: K, gaps: [number, number, number, number][], per = 2) => {
  const n = fxCount(k, per, gaps.length * 2);
  for (let i = 0; i < n; i++) { const [x0, y0, x1, y1] = gaps[i % gaps.length], o = i >= gaps.length ? 1.6 : 0; zap(k, x0 - o, y0, x1 + o * 0.6, y1, RUNE, k.seed * 7 + i, 0.45 + 0.1 * (i % 2)); }
};
const chips = (k: K, pts: [number, number][], per = 1.4, max = 3) => { const n = fxCount(k, per, max); for (let i = 0; i < n; i++) mote(k, pts[i % pts.length][0], pts[i % pts.length][1], 0.55, RUNE, 'diamond', { bob: 1.3, spin: 0.8, phase: i * 2.3 }); };
function fxSword(k: K): void {
  const G = gap(k), b1 = -14.0, m1 = b1 - G - 7.6;
  sparksAcross(k, [[-1.6, b1, 1.2, b1 - G], [1.4, m1, -1.2, m1 - G], [2.4, b1 + 0.2, -2.2, b1 - G - 0.2]]);
  haze(k, 0, -22, 5.0, 14.0, RUNE, 0.07);
  chips(k, [[5.6, -18], [-5.2, -26], [4.4, -32]]);
}
function fxAxe(k: K): void {
  const G = gap(k);
  sparksAcross(k, [[2.6, -25.0, 2.6 + G + 0.6, -23.6], [2.6, -19.6, 2.6 + G + 0.6, -20.8], [-2.6, -22.2, -2.6 - G - 0.6, -21.4]]);
  chips(k, [[15.6, -24], [14.6, -16], [-9.6, -26]]);
}
function fxBow(k: K): void {
  const G = [0.4, 1.0, 1.5][k.q];
  const gaps: [number, number, number, number][] = [];
  for (const s of [-1, 1]) {
    const cl = qpts(3.0, s * 4.2, 9.2, s * 13.0, -2.4, s * 21.2, 50), total = cl.length / 2 - 1;
    for (const i of [1, 3]) { const j = Math.round((i / 5) * total), x = cl[j * 2], y = cl[j * 2 + 1], x2 = cl[(j + 2) * 2], y2 = cl[(j + 2) * 2 + 1], dx = x2 - x, dy = y2 - y, d = Math.hypot(dx, dy) || 1; gaps.push([x - (dx / d) * G, y - (dy / d) * G, x + (dx / d) * G, y + (dy / d) * G]); }
  }
  sparksAcross(k, gaps, 2.4);
  chips(k, [[11.0, -12], [11.0, 12]]);
}
function fxStaff(k: K): void {
  const G = gap(k), HK = 0.82, hy = (y: number) => -33.0 + (y + 33.0) * HK, top = hy(-52.0), py = hy(-52.4 - G * 1.2);
  sparksAcross(k, [[-1.6, top, 1.2, py], [1.8, top, -0.8, py], [0, top + 0.4, 0, py]]);
  haze(k, 0, hy(-46), 6.0, 9.0, RUNE, 0.08);
  chips(k, [[-6.2, hy(-50)], [6.0, hy(-44)], [0, hy(-62)]], 1.8, 3);
}
function fxWand(k: K): void {
  const G = gap(k);
  sparksAcross(k, [[-1.2, -15.4, 1.0, -15.8 - G * 1.2], [1.2, -15.4, -0.8, -15.8 - G * 1.2]]);
  chips(k, [[3.4, -19], [-3.0, -12]], 1.2, 2);
}
export const FAULTSTONE: SeriesInfo = {
  id: 'faultstone', gen: 5, name: 'Faultstone', maker: 'no maker: what the Faultline cracks and gives back', zones: 'the Faultline and the fields at its pitch', levels: '61–69',
  shape: 'monolithic tapered slabs, stepped bases, pyramidion tips; split into pieces held apart',
  palette: [{ name: 'obelisk slate', hex: SLATE }, { name: 'slate face', hex: SLATE_L }, { name: 'bone', hex: BONE }, { name: 'fracture', hex: BREAK }, { name: 'Faultstone rune (light)', hex: RUNE }],
  motif: 'rectangular rune slots; the split with a gap',
  late: 'blades and heads in pieces that hover apart, wider with craft; runes light slot by slot',
  effects: 'magenta energy arcing across the split gaps, glowing chips, the runes pulsing; shard impacts',
  draw: { blade: withFx(sword, fxSword), axe: withFx(axe, fxAxe), bow: withFx(bow, fxBow), staff: withFx(staff, fxStaff), wand: withFx(wand, fxWand) },
};
