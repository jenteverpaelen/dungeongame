// Series G1 · Kilnfolk (item levels 13–24): Cinderwash Kilns and Kilnwatch Crown.
// Made by firekeepers who fire stoneware and keep the kilns: fire-scaled black iron, terracotta, celadon and tenmoku
// glaze, soot (Kessa's soot and goggles, Venn's iron poker, CAST.md). Shape language: round, heavy, pot-like — collars,
// bellies, thumb-pressed rims, blunt tips; glaze drips break the lower edges (rule A1). Blades are clay-quenched, so a
// pale wavy temper line splits the hard edge from the dark back (ART-REFERENCES RW2). The one light is an ember kept in
// a crucible (R6). Maker's mark: a stamped kiln cone (RW1).
import type { SeriesInfo } from './index';
import { accentOf, detail, disc, float, glowSpot, jit, lash, pole, qpts, ribbon, ring, slab, type K } from './kit';
import { mix, shade, light } from '../util';
import { OUT } from '../draw';

const IRON = 0x403a3a, EDGE = 0xb8b4ae, TERRA = 0xb3603c, CLAY = 0xd9a070, CELADON = 0x86b29c, TENMOKU = 0x5c2a1c;
const EMBER = 0xff8a3a, ASH = 0x6a5646, SOOT = 0x2c2426, LEATHER = 0x4e3a30;

/** Glaze drips hanging from a lip at y (kiln-fired upright, so they run towards +y). */
function drips(k: K, xs: number[], y: number, lens: number[], col: number, w = 0.9, inner = false): void {
  xs.forEach((x, i) => {
    const L = lens[i % lens.length];
    slab(k, [x - w, y - 0.6, x + w, y - 0.6, x + w * 0.85, y + L * 0.62, x, y + L, x - w * 0.85, y + L * 0.62], col, { smooth: true, line: 0, inner, shK: 0.3 });
    if (k.pass === 'paint') k.c.circle(x - w * 0.3, y + L * 0.55, Math.max(0.3, w * 0.3)).fill(light(col, 0.6));
  });
}

/** The rarity accent of the kilnfolk: a glass-glaze bead pressed into the clay (rule A5). */
function glazeEye(k: K, x: number, y: number, r = 1.2): void {
  if (!k.q || k.pass === 'light') return;
  disc(k, x, y, r, r, accentOf(k), { line: 0.6, inner: true });
  if (k.pass === 'paint') k.c.circle(x - r * 0.35, y - r * 0.35, r * 0.35).fill(0xffffff);
}

/** A fired-clay collar with a glaze cap and a thumb-pressed lower rim (the series motif at the junction). */
function collar(k: K, x0: number, x1: number, y: number, h: number, glaze: number, nDrip: number): void {
  const n = 7, top = y - h / 2, bot = y + h / 2, pts: number[] = [];
  pts.push(x0 + 0.6, top, (x0 + x1) / 2, top - 0.5, x1 - 0.6, top, x1 + 0.4, y);
  for (let i = 0; i <= n; i++) { const x = x1 - ((x1 - x0) * i) / n; pts.push(x, bot + (i % 2 ? 0.7 : 0)); }
  pts.push(x0 - 0.4, y);
  slab(k, pts, TERRA, { smooth: true, hi: [[x0 + 0.8, top + 0.7, x1 - 1.2, top + 0.7]] });
  if (k.pass === 'paint') { k.c.poly([x0 + 0.2, top + 0.2, x1 - 0.2, top + 0.2, x1 + 0.1, y - 0.3, x0 - 0.1, y - 0.3], true).fill(glaze); detail(k, [x0 + 0.9, top + 0.8, x1 - 1.4, top + 0.8], light(glaze, 0.5), 0.6); }
  const xs: number[] = []; for (let i = 0; i < nDrip; i++) xs.push(x0 + 1.2 + ((x1 - x0 - 2.4) * (i + 0.35 + jit(k.seed, i, 0.2))) / nDrip);
  drips(k, xs, y - 0.2, [2.4, 3.4, 1.8], glaze, 0.75, true);
}

/** Stamped kiln cone mark (a small triangle leaning over); rare pieces fill it with celadon. */
function coneMark(k: K, x: number, y: number, s: number, on: number): void {
  if (k.pass !== 'paint') return;
  const col = k.q >= 2 ? CELADON : shade(on, 0.55);
  k.c.poly([x - s * 0.55, y + s * 0.5, x + s * 0.5, y + s * 0.5, x + s * 0.65, y - s * 0.55], true);
  if (k.q >= 2) k.c.fill(col); else k.c.stroke({ width: 0.55, color: col, join: 'round' });
}

// ── sword: a clay-tempered falchion — broad, heavy, a wavy temper line between the black back and the bright edge ──
function sword(k: K): void {
  const q = k.q;
  k.anchor = { x: 0.4, y: -5.6, r: 3 };
  const out = [-2.3, -6.4, -2.7, -17.5, -2.5, -26.8, -1.6, -31.4, 1.6, -30.6, 3.9, -28.2, 5.0, -23.8, 4.4, -15.8, 3.1, -6.4];
  slab(k, out, IRON, { line: 0.95, shK: 0.3, inset: 0.9 });
  const wav = [3.1, -6.9, 1.5, -8.6, 2.3, -10.8, 1.6, -13.2, 2.7, -15.6, 2.0, -18.4, 3.1, -20.8, 2.6, -23.6, 2.7, -26.4, 1.0, -28.9, -1.3, -30.6];
  if (k.pass === 'paint') {
    const zone = [...wav, -1.6, -31.4, 1.6, -30.6, 3.9, -28.2, 5.0, -23.8, 4.4, -15.8, 3.1, -6.4];
    k.c.poly(zone, true).fill(EDGE);
    k.c.poly(zone.map((v, i) => (i % 2 === 0 ? v + 0.55 : v)), true).fill(shade(EDGE, 0.18));
    detail(k, wav, light(EDGE, 0.5), 0.6);
    detail(k, [3.6, -8, 4.1, -15.8, 4.5, -23.6, 3.6, -27.7], light(EDGE, 0.7), 0.7);
    k.c.poly(out, true).stroke({ width: 0.95, color: OUT, join: 'round' });
  }
  if (q === 0) for (const [x, y] of [[-1.3, -11], [-0.6, -19.4], [-1.6, -24.4], [0.2, -15]]) detail(k, [x, y, x + 0.8, y - 0.6, x + 1.1, y + 0.3], mix(IRON, CLAY, 0.35), 0.8, 0.9);
  if (q === 2 && k.pass === 'paint') { k.c.roundRect(-1.85, -25.5, 1.5, 16.5, 0.75).fill(shade(CELADON, 0.35)); k.c.roundRect(-1.7, -25.2, 1.0, 15.9, 0.5).fill(CELADON); detail(k, [-1.45, -24.6, -1.45, -10.2], light(CELADON, 0.55), 0.45); }
  if (q >= 1) coneMark(k, 0.0, -8.6, 1.4, IRON);
  slab(k, [-1.9, -4.2, 2.3, -4.2, 2.4, 4.0, -2.0, 4.0], ASH, { line: 0.9 });
  lash(k, 0.2, -3.6, 3.6, 4.2, LEATHER, { gap: 1.6, slant: 0.9 });
  slab(k, [-2.2, 4.0, 2.6, 4.0, 3.2, 6.6, 2.2, 8.6, -1.8, 8.6, -2.8, 6.6], TERRA, { smooth: true, hi: [[-1.6, 5.2, 0.4, 4.8]] });
  if (k.pass === 'paint') { k.c.poly([-2.4, 4.4, 2.8, 4.4, 3.1, 6.0, -2.7, 6.0], true).fill(q === 0 ? TENMOKU : CELADON); }
  drips(k, [-1.2, 1.6], 5.8, [1.6, 2.2], q === 0 ? TENMOKU : CELADON, 0.6, true);
  collar(k, -4.6, 5.4, -5.4, 3.6, q === 0 ? TENMOKU : CELADON, q === 0 ? 2 : 3);
  glazeEye(k, 0.4, -5.6, 1.3);
}

// ── axe: a kiln rake-axe — crescent bit, a raking hook behind, the socket sleeved in fired clay ──
function axe(k: K): void {
  const q = k.q;
  pole(k, [0.2, 7.6, 0.2, -14], 3.0, ASH);
  for (const y of [2.4, -2.6]) ring(k, 0.2, y, 1.9, 0.6, 0.8, SOOT, { inner: true });
  const blade = [2.0, -26.4, 6.0, -29.6, 10.4, -29.6, 13.0, -24.0, 13.2, -18.4, 10.6, -13.0, 6.2, -12.0, 2.0, -16.0];
  slab(k, blade, IRON, { inset: 0.86 });
  if (k.pass === 'paint') {
    const zone = [9.0, -29.6, 10.4, -29.6, 13.0, -24.0, 13.2, -18.4, 10.6, -13.0, 8.4, -12.4, 9.8, -14.6, 10.4, -17.0, 11.0, -19.4, 10.2, -21.6, 11.2, -24.2, 9.8, -27.0];
    k.c.poly(zone, true).fill(EDGE);
    k.c.poly(zone.map((v, i) => (i % 2 === 0 ? v + 0.5 : v)), true).fill(shade(EDGE, 0.15));
    detail(k, [10.8, -28.6, 12.4, -24.0, 12.6, -18.4, 10.4, -13.8], light(EDGE, 0.7), 0.7);
    detail(k, [9.8, -27.0, 11.2, -24.2, 10.2, -21.6, 11.0, -19.4, 10.4, -17.0, 9.8, -14.6], light(EDGE, 0.45), 0.55);
    k.c.poly(blade, true).stroke({ width: 0.95, color: OUT, join: 'round' });
    k.c.circle(6.4, -20.8, 2.0).fill(q === 2 ? CELADON : 0x1b1410);
    if (q === 2) k.c.circle(6.0, -21.3, 0.8).fill(light(CELADON, 0.55));
    k.c.circle(6.4, -20.8, 2.0).stroke({ width: 0.8, color: OUT });
  }
  const hook = [-1.8, -22.6, -5.6, -22.2, -7.8, -20.0, -8.0, -14.6, -6.6, -14.0, -6.4, -18.4, -5.2, -19.6, -1.8, -19.4];
  slab(k, hook, IRON, { smooth: true });
  slab(k, [-2.5, -27.6, 2.7, -27.6, 3.1, -21.0, 2.6, -14.6, -2.4, -14.6, -2.9, -21.0], TERRA, { smooth: true, hi: [[-1.8, -26.4, -2.2, -16.4]] });
  if (k.pass === 'paint') { k.c.poly([-2.4, -27.4, 2.6, -27.4, 2.9, -23.6, -2.7, -23.6], true).fill(q === 0 ? TENMOKU : CELADON); for (const y of [-19.6, -16.8]) detail(k, [-2.4, y, -0.8, y + 0.5, 0.8, y + 0.5, 2.4, y], shade(TERRA, 0.45), 0.7); }
  drips(k, [-1.4, 0.6, 2.0], -23.8, [2.2, 3.2, 1.6], q === 0 ? TENMOKU : CELADON, 0.6, true);
  if (q >= 1) coneMark(k, 4.6, -16.8, 1.2, IRON);
  if (q === 0) for (const [x, y] of [[4.0, -25.0], [8.2, -17.6]]) detail(k, [x, y, x + 0.8, y + 0.4], mix(IRON, CLAY, 0.35), 0.8);
  k.anchor = { x: 0.2, y: -14.2, r: 2.6 };
  glazeEye(k, 0.2, -19.4, 1.2);
}

// ── bow: smoked ash limbs swelling to a pot-bellied clay grip; fired ceramic ball nocks ──
function bow(k: K): void {
  const q = k.q;
  const up = qpts(-2.4, -21.0, 7.8, -12.8, 3.4, -3.0, 12), lo = qpts(-2.4, 21.0, 7.8, 12.8, 3.4, 3.0, 12);
  for (const cl of [up, lo]) {
    const n = cl.length / 2;
    const ws: number[] = []; for (let i = 0; i < n; i++) { const t = i / (n - 1); ws.push(1.7 + Math.sin(t * Math.PI) * 2.0 + t * 0.6); }
    slab(k, ribbon(cl, ws), ASH, { line: 0, flat: true });
    if (k.pass === 'paint') {
      slab(k, ribbon(cl, ws, 0, -1, 0.05), mix(ASH, 0xfff4d6, 0.18), { line: 0, flat: true, inner: true });
      slab(k, ribbon(cl, ws, 0, 0.55, 1), shade(ASH, 0.3), { line: 0, flat: true, inner: true });
      for (let i = 3; i < n - 2; i += 3) { const x = cl[i * 2], y = cl[i * 2 + 1]; detail(k, [x - 0.3, y, x + 1.1, y + 0.2], SOOT, 0.7, 0.7); }
      k.c.poly(ribbon(cl, ws), true).stroke({ width: 0.9, color: OUT, join: 'round' });
    }
  }
  slab(k, [1.0, -4.6, 5.4, -4.6, 6.6, -1.6, 6.4, 2.4, 5.2, 4.6, 1.4, 4.6, 0.8, 0], TERRA, { smooth: true, hi: [[1.8, -3.6, 4.6, -3.8]] });
  if (k.pass === 'paint') { k.c.poly([1.0, -4.2, 5.6, -4.2, 6.4, -1.4, 0.9, -1.4], true).fill(q === 0 ? TENMOKU : CELADON); }
  drips(k, [2.0, 4.0, 5.6], -1.6, [1.8, 2.8, 1.4], q === 0 ? TENMOKU : CELADON, 0.6, true);
  if (q >= 1) coneMark(k, 3.6, 2.4, 1.2, TERRA);
  for (const s of [-1, 1]) {
    disc(k, -2.6, s * 21.4, 1.9, 1.9, q === 2 ? CELADON : CLAY, { line: 0.75 });
    if (q < 2) detail(k, [-3.6, s * 21.6, -1.6, s * 21.2], shade(CLAY, 0.45), 0.55);
  }
  if (!k.rig) pole(k, [-2.4, -20.4, -2.4, 20.4], 0.7, 0xd8cfc0, { flat: true });
  k.anchor = { x: 3.8, y: -4.8, r: 2.4 };
  glazeEye(k, 3.8, 0.8, 1.2);
}

// ── staff: a kiln poker with a crucible — the series' one light is the ember kept inside ──
function staff(k: K): void {
  const q = k.q;
  pole(k, [0.2, 22.4, 0.1, 8.0], 3.6, ASH);
  pole(k, [0.1, 8.5, -0.2, -38.5], 2.4, IRON);
  for (const y of [8.4, 20.8]) ring(k, 0.15, y, 2.2, 0.7, 0.9, SOOT);
  slab(k, [-4.6, -8.6, 4.6, -8.6, 4.2, -6.6, -4.2, -6.6], TERRA, { smooth: true, hi: [[-3.6, -8.0, 3.0, -8.0]] });
  if (k.pass === 'paint') for (let x = -3.4; x <= 3.6; x += 1.4) detail(k, [x, -6.9, x + 0.4, -6.6], shade(TERRA, 0.5), 0.6);
  for (const s of [-1, 0, 1]) pole(k, [0, -38, s * 4.4, -42.0, s * 5.6, -47.6], 1.3, IRON, { curve: true });
  // a tall crucible, bellied, a thick rim; glaze poured from the rim
  const glaze = q === 0 ? TENMOKU : CELADON;
  const cup = [-3.4, -39.4, 3.4, -39.4, 5.6, -44.6, 6.4, -50.4, 6.8, -53.4, -6.8, -53.4, -6.4, -50.4, -5.6, -44.6];
  slab(k, cup, TERRA, { smooth: false, hi: [[-4.8, -50.4, -3.6, -41.4]] });
  if (k.pass === 'paint') { k.c.poly([-6.3, -50.0, 6.3, -50.0, 6.8, -53.4, -6.8, -53.4], true).fill(glaze); }
  drips(k, [-4.6, -1.8, 1.4, 4.2], -50.2, [3.0, 4.8, 2.4, 3.6], glaze, 0.85, true);
  ring(k, 0, -53.6, 7.0, 1.8, 1.8, glaze);
  if (k.pass === 'paint') { k.c.ellipse(0, -53.6, 5.6, 1.25).fill(q === 0 ? SOOT : mix(EMBER, 0x5a1a0a, 0.35)); for (const x of [-3.2, -0.4, 2.6]) k.c.circle(x, -53.7, 0.9).fill(q === 0 ? shade(SOOT, 0.3) : mix(EMBER, 0x5a1a0a, 0.6)); }
  if (q >= 1) glowSpot(k, 0.6, -54.0, q === 2 ? 2.6 : 1.5, EMBER, true);
  if (q === 2) glowSpot(k, -2.6, -53.8, 1.2, EMBER, true);
  ring(k, 0, -45.8, 6.0, 1.5, 1.3, IRON, { inner: true });
  if (q >= 1) coneMark(k, 0.6, -42.6, 1.4, TERRA);
  glazeEye(k, -2.4, -47.4, 1.3);
  k.anchor = { x: 0, y: -38.2, r: 2.4 };
  if (q === 2) float(k, 1.4, -59, (kk) => { if (kk.pass === 'paint') kk.c.circle(0, 0, 0.9).fill(light(EMBER, 0.4)); }, { bob: 2.2, phase: 1, glow: EMBER, glowR: 3, deco: true });
}

// ── wand: a glazed stoneware rod topped with a pyrometric cone that slumps as the piece is better fired ──
function wand(k: K): void {
  const q = k.q;
  slab(k, [-1.7, 5.0, 1.7, 5.0, 2.4, 1.2, 1.8, -2.8, 1.25, -13.6, -1.25, -13.6, -1.8, -2.8, -2.4, 1.2], TERRA, { smooth: true, hi: [[-1.2, 3.0, -0.8, -12.0]] });
  if (k.pass === 'paint') { k.c.poly([-1.55, -6.0, 1.55, -6.0, 1.3, -13.4, -1.3, -13.4], true).fill(q === 0 ? TENMOKU : CELADON); detail(k, [-0.9, -7.4, -0.8, -12.8], light(q === 0 ? TENMOKU : CELADON, 0.45), 0.5); }
  drips(k, [-0.8, 0.9], -6.2, [2.4, 1.6], q === 0 ? TENMOKU : CELADON, 0.55, true);
  slab(k, [-2.6, -13.4, 2.6, -13.4, 2.2, -15.2, -2.2, -15.2], CLAY, { smooth: true });
  const cone = q === 0 ? [-1.5, -15.0, 1.5, -15.0, 0.2, -22.4] : q === 1 ? [-1.5, -15.0, 1.5, -15.0, 1.4, -18.8, 3.2, -21.4, 0.0, -18.6] : [-1.5, -15.0, 1.5, -15.0, 2.2, -17.0, 5.4, -17.8, 5.6, -16.6, 2.6, -15.8];
  slab(k, cone, q === 2 ? CELADON : 0xe8d8bc, { smooth: q > 0, hi: [[-1.0, -15.6, -0.2, -19.6]] });
  if (q >= 1) detail(k, [-0.6, -15.4, 0.2, -17.0], shade(0xe8d8bc, 0.4), 0.45);
  if (q === 2) coneMark(k, 0.0, 1.4, 1.2, TERRA);
  k.anchor = { x: 0, y: -13.8, r: 2.4 };
  glazeEye(k, 0.0, -14.3, 1.0);
}

export const KILNFOLK: SeriesInfo = {
  id: 'kilnfolk', gen: 1, name: 'Kilnfolk', maker: 'the firekeepers of Cinderwash and the Kilnwatch', zones: 'Cinderwash Kilns, Kilnwatch Crown (Sablefen road)', levels: '13–24',
  shape: 'round and heavy: collars, bellies, thumb-pressed rims, blunt tips; glaze drips break the lower edges',
  palette: [{ name: 'fire-scaled iron', hex: IRON }, { name: 'terracotta', hex: TERRA }, { name: 'celadon glaze', hex: CELADON }, { name: 'tenmoku glaze', hex: TENMOKU }, { name: 'ember (light)', hex: EMBER }],
  motif: 'the glazed collar with drips at the junction; the stamped kiln cone',
  late: 'clay-quenched temper lines, a celadon window in the axe, a crucible that keeps an ember, a cone that slumps',
  draw: { blade: sword, axe, bow, staff, wand },
};
