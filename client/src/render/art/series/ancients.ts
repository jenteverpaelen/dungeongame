// Series G6 · Ancients (item level 70): the makers of the Cube. The material language is the town's Ancients' Cube
// (npcs.ts: bronze faces #B4783A / #E0AA5E / #7A4A22, teal rune channels #7FF2E0, gold corner caps; ART-REFERENCES WR4).
// Shape language: faceted geometry — three-tone faces lit from the upper left, rhombi and hexagons, a gold cap on every
// vertex that ends a part, maze-like channels; strict symmetry (precision as the final reward, R10) (rule A1).
// Light: the teal maze channels (R6). The series' idea at the junction: a small Cube.
import type { SeriesInfo } from './index';
import { cube, detail, disc, float, glowLine, pole, qpts, ribbon, slab, stone, type K } from './kit';
import { light, mix, shade } from '../util';
import { localXf } from '../weaponArt';
import { OUT } from '../draw';

const BRONZE = 0xb4783a, BRONZE_L = 0xe0aa5e, BRONZE_D = 0x7a4a22, TEAL = 0x7ff2e0, GRANITE = 0xa8a398, GOLD = 0xe8b64a;
const GROOVE = 0x3a2412;

/** A gold corner cap. */
function cap(k: K, x: number, y: number, r = 1.1): void { disc(k, x, y, r, r, GOLD, { line: 0.6 }); }

/** A faceted plate: the outline is split into lit / base / shade facets around a ridge line (three tones). */
function facets(k: K, out: number[], faces: { pts: number[]; t: 0 | 1 | 2 }[], col = BRONZE): void {
  slab(k, out, col, { line: 0.9, flat: true });
  if (k.pass === 'paint') {
    for (const f of faces) k.c.poly(f.pts, true).fill(f.t === 0 ? light(col, 0.32) : f.t === 1 ? col : mix(col, BRONZE_D, 0.7));
    for (const f of faces) k.c.poly(f.pts, true).stroke({ width: 0.4, color: shade(col, 0.55), alpha: 0.8, join: 'round' });
    k.c.poly(out, true).stroke({ width: 0.9, color: OUT, join: 'round' });
  }
}

/** A maze channel (the Cube's rune line): a right-angled path, lit teal on magic+, a dark groove otherwise. */
function maze(k: K, pts: number[], w = 0.6): void { glowLine(k, pts, w, TEAL, k.q >= 1, GROOVE); }

// ── sword: a faceted bronze blade with a maze channel; a Cube for a guard ──
function sword(k: K): void {
  const q = k.q;
  k.anchor = { x: 0, y: -6.2, r: 3.4 };
  const out = [-3.6, -9.0, 3.6, -9.0, 3.9, -24.6, 0, -34.2, -3.9, -24.6];
  facets(k, out, [
    { pts: [-3.6, -9.0, 0, -9.0, 0, -34.2, -3.9, -24.6], t: 0 },
    { pts: [0, -9.0, 3.6, -9.0, 3.9, -24.6, 0, -34.2], t: 2 },
    { pts: [-3.9, -24.6, 0, -34.2, 0, -28.0, -2.3, -24.0], t: 1 },
  ]);
  if (k.pass === 'paint') { detail(k, [-3.0, -9.6, -3.2, -24.4, -0.3, -32.6], light(BRONZE_L, 0.5), 0.6); }
  maze(k, [0, -9.6, 0, -12.6, -1.3, -12.6, -1.3, -15.4, 1.3, -15.4, 1.3, -18.4, 0, -18.4, 0, -22.4, -0.9, -22.4, -0.9, -25.0, 0, -25.0, 0, -28.2]);
  if (q === 2) maze(k, [-2.0, -10.6, -2.0, -13.0], 0.45);
  // side facets of the guard (rhombi) and the Cube
  for (const s of [-1, 1]) {
    const pts = [s * 3.4, -6.4, s * 8.6, -10.2, s * 11.4, -7.4, s * 8.2, -4.0];
    facets(k, pts, [{ pts: [s * 3.4, -6.4, s * 8.6, -10.2, s * 11.4, -7.4], t: s < 0 ? 0 : 1 }, { pts: [s * 3.4, -6.4, s * 11.4, -7.4, s * 8.2, -4.0], t: 2 }]);
    if (k.q >= 1) maze(k, [s * 4.6, -6.8, s * 7.0, -7.6, s * 8.2, -6.4], 0.4);
    cap(k, s * 11.4, -7.4, 1.0); cap(k, s * 8.6, -10.2, 0.7);
  }
  cube(k, 0, -6.2, 4.4, BRONZE, { line: 0.8 });
  maze(k, [-2.2, -7.2, -2.2, -4.8, -0.8, -4.2], 0.45);
  stone(k, 1.9, -5.2, 0.8, GOLD);
  for (const [x, y] of [[0, -10.6], [-3.8, -8.4], [3.8, -8.4]]) cap(k, x, y, 0.8);
  // grip: bronze with square rings; pommel: a small cube on a granite bead
  slab(k, [-1.5, -2.8, 1.5, -2.8, 1.5, 4.0, -1.5, 4.0], BRONZE_D, { line: 0.8 });
  if (k.pass === 'paint') for (const y of [-1.4, 0.6, 2.6]) { k.c.rect(-1.5, y - 0.4, 3.0, 0.8).fill(BRONZE_L); }
  disc(k, 0, 4.8, 1.5, 1.2, GRANITE, { line: 0.7 });
  cube(k, 0, 7.4, 2.2, BRONZE, { line: 0.7 });
  cap(k, 0, 9.6, 0.7);
}

// ── axe: a labrys of two faceted rhombi round a cube eye (symmetric, the series' precision) ──
function axe(k: K): void {
  const q = k.q;
  pole(k, [0, 8, 0, -26.4], 2.6, BRONZE_D);
  if (k.pass === 'paint') for (const y of [5.2, 1.6, -2.0]) k.c.rect(-1.3, y - 0.4, 2.6, 0.8).fill(BRONZE_L);
  const cy = -21.0;
  for (const s of [-1, 1]) {
    const tip = s * 11.2, top = cy - 7.4, bot = cy + 7.4;
    const out = [s * 2.4, cy - 3.0, s * 7.4, top, tip, cy - 1.4, tip, cy + 1.4, s * 7.4, bot, s * 2.4, cy + 3.0];
    facets(k, out, [
      { pts: [s * 2.4, cy - 3.0, s * 7.4, top, tip, cy - 1.4, s * 6.4, cy], t: s < 0 ? 0 : 1 },
      { pts: [s * 6.4, cy, tip, cy - 1.4, tip, cy + 1.4], t: 1 },
      { pts: [s * 2.4, cy + 3.0, s * 7.4, bot, tip, cy + 1.4, s * 6.4, cy], t: 2 },
    ]);
    detail(k, [s * 7.6, top + 0.6, s * 10.6, cy - 1.2, s * 10.6, cy + 1.2, s * 7.6, bot - 0.6], light(BRONZE_L, 0.5), 0.6);
    maze(k, [s * 3.4, cy, s * 4.6, cy, s * 4.6, cy - 2.2, s * 6.0, cy - 2.2]);
    for (const y of [top, bot]) cap(k, s * 7.4, y, 0.9);
  }
  cube(k, 0, cy, 3.4, BRONZE, { line: 0.8 });
  if (q >= 1) maze(k, [-1.2, cy - 1.0, -1.2, cy + 1.4], 0.4);
  cap(k, 0, cy - 3.6, 0.85);
  stone(k, 1.5, cy + 0.9, 0.75, GOLD);
  k.anchor = { x: 0, y: cy + 4.4, r: 2.4 };
}

// ── bow: limbs of linked faceted prisms with gold caps at each joint; a cube at the grip ──
function bow(k: K): void {
  const q = k.q;
  for (const s of [-1, 1]) {
    // a continuous faceted limb: a broad lit face and a narrow shade face split along a ridge, gold caps at the joints
    const cl = qpts(3.2, s * 4.6, 9.4, s * 13.4, -2.4, s * 21.4, 16);
    const n = cl.length / 2, ws: number[] = []; for (let i = 0; i < n; i++) ws.push(4.8 - (i / (n - 1)) * 3.2);
    slab(k, ribbon(cl, ws), BRONZE, { line: 0, flat: true });
    if (k.pass === 'paint') {
      const litA = s > 0 ? -1 : -0.05, litB = s > 0 ? 0.05 : 1;
      k.c.poly(ribbon(cl, ws, 0, litA, litB), true).fill(light(BRONZE, 0.32));
      k.c.poly(ribbon(cl, ws, 0, s > 0 ? 0.05 : -1, s > 0 ? 1 : -0.05), true).fill(mix(BRONZE, BRONZE_D, 0.7));
      detail(k, ribbon(cl, ws, 0, s > 0 ? -0.78 : 0.7, s > 0 ? -0.7 : 0.78).slice(0, 30), light(BRONZE_L, 0.5), 0.55);
      k.c.poly(ribbon(cl, ws), true).stroke({ width: 0.9, color: OUT, join: 'round' });
      // facet breaks across the limb
      for (const i of [5, 11]) { const x = cl[i * 2], y = cl[i * 2 + 1], x2 = cl[(i + 1) * 2], y2 = cl[(i + 1) * 2 + 1], dx = x2 - x, dy = y2 - y, d = Math.hypot(dx, dy) || 1, w = ws[i] / 2; k.c.moveTo(x - dy / d * w, y + dx / d * w).lineTo(x + dy / d * w, y - dx / d * w).stroke({ width: 0.6, color: OUT }); }
    }
    if (q >= 1) maze(k, [cl[4], cl[5], cl[10], cl[11], cl[12] + 0.6, cl[13], cl[20], cl[21]], 0.45);
    for (const i of [5, 11]) cap(k, cl[i * 2], cl[i * 2 + 1], 1.05);
    cap(k, -2.4, s * 21.4, 1.1);
  }
  cube(k, 3.2, 0, 5.2, BRONZE, { line: 0.8 });
  maze(k, [1.0, -1.4, 1.0, 1.8, 2.6, 2.4], 0.45);
  stone(k, 5.2, 1.0, 0.8, GOLD);
  for (const [x, y] of [[3.2, -5.2], [3.2, 5.2]]) cap(k, x, y, 0.8);
  if (!k.rig) pole(k, [-2.4, -20.6, -2.4, 20.6], 0.6, 0xe8dcc0, { flat: true });
  k.anchor = { x: 3.2, y: -5.2, r: 2.4 };
}

// ── staff: a small Cube hovering in a bronze cradle — the town's Cube on its pedestal, made to be carried ──
function staff(k: K): void {
  const q = k.q;
  pole(k, [0, 22.6, 0, -36.0], 2.6, BRONZE_D);
  if (k.pass === 'paint') for (const y of [19.6, 8.0, -4.0, -16.0, -28.0]) k.c.rect(-1.3, y - 0.45, 2.6, 0.9).fill(BRONZE_L);
  disc(k, 0, -36.4, 2.0, 1.6, GRANITE, { line: 0.7 });
  // the head is drawn 1.15× round the pole top (rule A7: the business end carries the identity)
  k.c.save(); localXf(k.c, 0, -37.0, 0, 1.15); localXf(k.c, 0, 37.0, 0, 1);
  // the cradle: two faceted prongs
  for (const s of [-1, 1]) {
    const out = [s * 0.8, -37.4, s * 8.2, -44.6, s * 8.8, -52.4, s * 6.8, -51.6, s * 6.0, -45.6, s * 0.4, -39.8];
    facets(k, out, [{ pts: [s * 0.8, -37.4, s * 8.2, -44.6, s * 8.8, -52.4, s * 7.2, -45.2], t: s < 0 ? 0 : 1 }, { pts: [s * 0.4, -39.8, s * 6.0, -45.6, s * 6.8, -51.6, s * 7.2, -45.2], t: 2 }]);
    cap(k, s * 8.8, -52.4, 1.0);
    if (q >= 1) maze(k, [s * 1.6, -39.0, s * 3.6, -41.0, s * 4.6, -41.0], 0.4);
  }
  k.c.restore();
  // the hovering Cube (a float with a cause: the Cube is what holds the Ancients' work together)
  float(k, 0, -37.0 + (-50.6 + 37.0) * 1.15, (kk) => {
    kk.c.save(); localXf(kk.c, 0, 0, 0, 1.3 * 1.15);
    cube(kk, 0, 0, 5.2, BRONZE, { line: 0.85 });
    if (kk.pass === 'paint') {
      const ch = (pts: number[]) => { kk.c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) kk.c.lineTo(pts[i], pts[i + 1]); kk.c.stroke({ width: 0.7, color: kk.q >= 1 ? light(TEAL, 0.2) : GROOVE, cap: 'round', join: 'round' }); };
      ch([-3.6, -1.2, -2.2, -0.6, -2.2, 2.0, -1.0, 2.6]);
      ch([1.2, -3.6, 0, -3.0, 1.4, -2.4]);
      ch([2.0, 0.4, 3.4, -0.4, 3.4, 2.2]);
    }
    for (const [x, y] of [[0, -5.2], [4.5, -2.6], [-4.5, -2.6], [0, 0], [0, 5.2], [4.5, 2.6], [-4.5, 2.6]]) if (!(x === 0 && y === 0)) cap(kk, x, y, 0.8);
    kk.c.restore();
  }, { bob: 0.9, phase: 0.2, glow: q >= 1 ? TEAL : 0, glowR: 8 });
  stone(k, 0, -38.8, 0.8, GOLD);
  k.anchor = { x: 0, y: -36.4, r: 2.4 };
}

// ── wand: three cubes stacked on a bronze rod, a channel running up through them ──
function wand(k: K): void {
  const q = k.q;
  pole(k, [0, 6.0, 0, -6.0], 2.0, BRONZE_D);
  if (k.pass === 'paint') for (const y of [4.0, 1.0]) k.c.rect(-1, y - 0.4, 2, 0.8).fill(BRONZE_L);
  disc(k, 0, 6.8, 1.4, 1.1, GRANITE, { line: 0.6 });
  cube(k, 0, -8.4, 3.4, BRONZE, { line: 0.75 });
  cube(k, 0, -14.4, 2.7, BRONZE, { line: 0.7 });
  cube(k, 0, -19.4, 2.1, BRONZE, { line: 0.65 });
  cap(k, 0, -21.9, 0.8);
  for (const s of [-1, 1]) cap(k, s * 2.95, -10.1, 0.65);
  maze(k, [-1.2, -7.2, -1.2, -9.6, -0.4, -10.2], 0.45);
  if (q >= 1) maze(k, [-1.0, -13.6, -1.0, -15.4], 0.4);
  if (q === 2) maze(k, [-0.7, -18.8, -0.7, -20.0], 0.35);
  stone(k, 1.4, -7.6, 0.7, GOLD);
  k.anchor = { x: 0, y: -4.8, r: 2.2 };
}

export const ANCIENTS: SeriesInfo = {
  id: 'ancients', gen: 6, name: 'Ancients', maker: 'the makers of the Cube', zones: 'endgame at level 70 (rifts, the Cube)', levels: '70',
  shape: 'faceted geometry: three-tone faces, rhombi and hexagons, gold caps on every vertex; strict symmetry',
  palette: [{ name: 'Cube bronze', hex: BRONZE }, { name: 'bronze light', hex: BRONZE_L }, { name: 'bronze shade', hex: BRONZE_D }, { name: 'gold caps', hex: GOLD }, { name: 'maze rune (light)', hex: TEAL }],
  motif: 'a small Cube at the junction; maze channels; gold corner caps',
  late: 'a Cube hovering in a cradle on the staff; a labrys; channels light up with craft',
  draw: { blade: sword, axe, bow, staff, wand },
};
