// Series G1 · Kilnfolk (item levels 13–24): Cinderwash Kilns and Kilnwatch Crown.
// Made by firekeepers who fire stoneware and keep the kilns: fire-scaled black iron, terracotta, celadon and tenmoku
// glaze, soot (Kessa's soot and goggles, Venn's iron poker, CAST.md). Shape language: round, heavy, pot-like — collars,
// bellies, thumb-pressed rims, blunt tips; glaze drips break the lower edges (rule A1). Blades are clay-quenched, so a
// pale wavy temper line splits the hard edge from the dark back (ART-REFERENCES RW2). The one light is an ember kept in
// a crucible (R6). Maker's mark: a stamped kiln cone (RW1).
import type { SeriesInfo } from './index';
import { accentOf, bloom, detail, disc, float, fxCount, glowLine, glowSpot, haze, jit, lash, mote, pole, qpts, ribbon, ring, slab, withFx, type K } from './kit';
import { mix, shade, light } from '../util';
import { OUT } from '../draw';

const IRON = 0x403a3a, EDGE = 0xb8b4ae, TERRA = 0xb3603c, CLAY = 0xd9a070, CELADON = 0x86b29c, TENMOKU = 0x5c2a1c;
const EMBER = 0xff8a3a, ASH = 0x7a6450, SOOT = 0x2c2426, LEATHER = 0x4e3a30;

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
    const ws: number[] = []; for (let i = 0; i < n; i++) { const t = i / (n - 1); ws.push(2.4 + Math.sin(t * Math.PI) * 2.3 + t * 0.8); }
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


// ── effect language: embers — sparks drifting off hot iron, the clay-quench line glowing, heat over the crucible ──
const embers = (k: K, pts: [number, number][], per = 2, max = 4) => { const n = fxCount(k, per, max); for (let i = 0; i < n; i++) { const [x, y] = pts[i % pts.length]; mote(k, x + jit(k.seed, i, 1.2), y + jit(k.seed, i + 7, 1.2), 0.5 + 0.15 * (i % 2), EMBER, 'dot', { bob: 2.4, phase: i * 1.9 }); } };
function fxSword(k: K): void {
  glowLine(k, [3.1, -6.9, 1.5, -8.6, 2.3, -10.8, 1.6, -13.2, 2.7, -15.6, 2.0, -18.4, 3.1, -20.8, 2.6, -23.6, 2.7, -26.4, 1.0, -28.9], 0.45 + 0.35 * bloom(k), EMBER, true, IRON);
  embers(k, [[5.6, -14], [6.0, -22], [3.8, -29]]);
}
function fxAxe(k: K): void {
  glowLine(k, [9.8, -27.0, 11.2, -24.2, 10.2, -21.6, 11.0, -19.4, 10.4, -17.0, 9.8, -14.6], 0.45 + 0.3 * bloom(k), EMBER, true, IRON);
  embers(k, [[14.0, -22], [12.6, -14], [11.6, -29]]);
}
function fxBow(k: K): void {
  // crazing: the glaze's fine crack network glowing on the clay grip
  glowLine(k, [1.6, 0.4, 2.8, 1.4, 2.4, 2.6, 3.8, 3.4, 4.8, 2.8], 0.35 + 0.2 * bloom(k), EMBER, true, TERRA);
  glowLine(k, [2.8, 1.4, 4.4, 0.6, 5.6, 1.2], 0.3, EMBER, true, TERRA);
  embers(k, [[8.4, -2], [7.8, 4], [9.2, 0]], 1.5, 3);
}
function fxStaff(k: K): void {
  haze(k, 0.4, -58.0, 6.6, 4.6, EMBER, 0.12);
  embers(k, [[1.2, -60], [-2.4, -62], [3.0, -64], [-0.6, -66]], 2.4, 5);
}
function fxWand(k: K): void {
  if (k.q === 2) glowSpot(k, 3.4, -17.2, 1.1, EMBER, true);
  embers(k, [[3.6, -20], [-2.0, -19]], 1.2, 2);
}


// ═══════════════ the other held families (rollout 2026-10-11) ═══════════════

// ── greatsword: a stoker's slice — the long flat bar a firekeeper drives into the firebox to break clinker [K], ground
//    to an edge; its chisel end keeps the fire's heat (soot-dark → dull red → orange with craft); a clay-sleeved iron
//    grip that ends in a ring, as fire irons are hung ──
const GS_HOT = [-3.7, -41.4, 3.7, -41.4, 3.7, -44.2, -3.7, -48.8];
const GS_WARM = [-3.7, -35.0, 3.7, -35.0, 3.7, -41.4, -3.7, -41.4];
function greatsword(k: K): void {
  const q = k.q, glaze = q === 0 ? TENMOKU : CELADON;
  k.anchor = { x: 0.2, y: -7.6, r: 3.4 };
  const blade = [-3.7, -9.4, 3.7, -9.4, 3.7, -44.2, -3.7, -48.8];
  slab(k, blade, IRON, { hi: [[-3.0, -10.4, -3.0, -47.2]] });
  if (k.pass === 'paint') {
    k.c.poly([-3.7, -9.4, -2.3, -9.4, -2.3, -47.9, -3.7, -48.8], true).fill(EDGE);
    if (q >= 1) { k.c.poly(GS_WARM, true).fill(mix(IRON, 0x8a2a18, q === 2 ? 0.7 : 0.45)); k.c.poly(GS_HOT, true).fill(q === 2 ? 0xf07a30 : 0xb8401e); }
    else k.c.poly(GS_HOT, true).fill(shade(IRON, 0.25));
    detail(k, [3.0, -10.4, 3.0, -43.6], shade(IRON, 0.4), 0.6);
    for (const y of [-15.0, -23.0, -30.0]) detail(k, [-1.0, y, 1.8, y - 1.0], shade(IRON, 0.35), 0.5);
    if (q === 2) detail(k, [-3.3, -48.2, 3.4, -44.1], light(EMBER, 0.6), 0.8);
    k.c.poly(blade, true).stroke({ width: 0.95, color: OUT, join: 'round' });
  }
  if (q >= 1) coneMark(k, 0.8, -13.0, 1.6, IRON);
  collar(k, -6.4, 6.8, -7.6, 4.0, glaze, q === 0 ? 3 : 4);
  slab(k, [-1.6, -5.6, 1.6, -5.6, 1.6, 9.4, -1.6, 9.4], IRON, { line: 0.8 });
  slab(k, [-2.4, -5.0, 2.6, -5.0, 2.8, 4.6, -2.6, 4.6], TERRA, { smooth: true, hi: [[-1.8, -4.2, -1.9, 3.8]] });
  if (k.pass === 'paint') for (const y of [-2.4, 0.4, 3.0]) detail(k, [-2.4, y, 2.6, y + 0.4], shade(TERRA, 0.4), 0.6);
  ring(k, 0, 12.8, 3.4, 3.4, 1.6, IRON);
  glazeEye(k, 0.2, -7.6, 1.4);
}

// ── great axe: a stoker's spade — the coal spade of the firebox with its blade ground sharp, on a long ash haft through
//    a clay-collared socket (a spade-headed polearm, as the monk's spade is [K]); the edge keeps the fire's heat ──
function greataxe(k: K): void {
  const q = k.q, glaze = q === 0 ? TENMOKU : CELADON;
  pole(k, [0, 11.6, 0, -26], 3.4, ASH);
  for (const y of [8.0, 0.6, -8.0]) ring(k, 0, y, 2.1, 0.7, 0.9, SOOT, { inner: true });
  const blade = [-6.2, -28.4, 6.2, -28.4, 7.6, -45.4, 5.6, -48.0, -5.6, -48.0, -7.6, -45.4];
  slab(k, blade, IRON, { hi: [[-5.6, -29.4, -6.8, -44.8]] });
  if (k.pass === 'paint') {
    k.c.poly([-7.6, -45.4, -5.6, -48.0, 5.6, -48.0, 7.6, -45.4, 6.0, -44.6, -6.0, -44.6], true).fill(q >= 1 ? mix(EDGE, 0xf07a30, q === 2 ? 0.55 : 0.25) : EDGE);
    detail(k, [-5.6, -29.2, -6.8, -44.6], shade(IRON, 0.45), 0.8); detail(k, [5.6, -29.2, 6.8, -44.6], shade(IRON, 0.45), 0.8);
    for (const s of [-1, 1]) { k.c.rect(s * 2.0 - 0.8, -36.0, 1.6, 7.6).fill(shade(IRON, 0.2)); k.c.circle(s * 2.0, -34.6, 0.6).fill(EDGE); }
    k.c.poly([-6.2, -28.4, 6.2, -28.4, 6.5, -32.0, -6.5, -32.0], true).fill({ color: SOOT, alpha: 0.5 });
    k.c.poly(blade, true).stroke({ width: 0.95, color: OUT, join: 'round' });
  }
  if (q >= 1) coneMark(k, 3.6, -40.6, 1.6, IRON);
  collar(k, -3.8, 4.0, -26.2, 4.6, glaze, q === 0 ? 2 : 3);
  k.anchor = { x: 0.1, y: -26.2, r: 2.8 };
  glazeEye(k, 0.1, -26.2, 1.3);
}

// ── mace: a firebrick maul — a kiln brick bound in iron straps on an iron haft, glaze running off its top ──
function mace(k: K): void {
  const q = k.q, glaze = q === 0 ? TENMOKU : CELADON;
  pole(k, [0.2, 6.6, 0.1, -17], 2.4, IRON);
  pole(k, [0.2, 6.6, 0.2, 0], 3.2, ASH);
  const top = -29.0, bot = -16.6;
  slab(k, [-7.2, top, 7.6, top, 7.8, bot, -7.4, bot], TERRA, { hi: [[-6.4, top + 1, 6.6, top + 1]] });
  if (k.pass === 'paint') { k.c.poly([-7.0, top + 0.3, 7.4, top + 0.3, 7.6, top + 3.4, -7.2, top + 3.4], true).fill(glaze); for (const [x0, y0] of [[-4, -22], [2, -20], [4.6, -24.6]]) detail(k, [x0, y0, x0 + 1.4, y0 - 1.0, x0 + 2.6, y0 - 0.4], shade(TERRA, 0.5), 0.6); }
  drips(k, [-5.0, -1.6, 2.2, 5.6], top + 3.2, [2.4, 3.6, 1.8, 3.0], glaze, 0.75, true);
  for (const x of [-7.4, 7.6]) slab(k, [x - 1.0, top - 0.6, x + 1.0, top - 0.6, x + 1.0, bot + 0.6, x - 1.0, bot + 0.6], IRON, { line: 0.7 });
  slab(k, [-2.2, bot + 0.2, 2.4, bot + 0.2, 2.2, bot + 2.4, -2.0, bot + 2.4], SOOT, { line: 0.7 });
  if (q >= 1) coneMark(k, 0.2, -21.0, 1.5, TERRA);
  k.anchor = { x: 0.2, y: bot + 1.4, r: 2.4 };
  glazeEye(k, 4.0, -19.4, 1.2);
}

// ── crossbow: smoked ash, an iron prod, the fore-end sleeved in glazed clay ──
function xbow(k: K, hand: boolean): void {
  const q = k.q, glaze = q === 0 ? TENMOKU : CELADON, pw = hand ? 9.4 : 12.8, py = hand ? -9 : -16, sy1 = hand ? -12.4 : -24, sy0 = hand ? 3 : 8;
  if (hand) slab(k, [-1.9, 5.0, 2.8, 5.0, 3.8, 1.0, 2.2, -2.0, 2.0, sy1, -2.0, sy1, -1.9, -2.0], ASH, { hi: [[-1.2, sy1 + 1, -1.2, -2.6]] });
  else slab(k, [-2.6, sy0, 2.6, sy0, 2.8, sy0 - 4, 2.3, sy1, -2.3, sy1, -2.8, sy0 - 4], ASH, { hi: [[-2.0, sy1 + 1, -2.2, sy0 - 4]] });
  // the clay sleeve on the fore-end, glaze-dipped
  const s0 = py - 1.0, s1 = sy1 + 1.0;
  slab(k, [-3.0, s0, 3.0, s0, 3.4, (s0 + s1) / 2, 3.0, s1, -3.0, s1, -3.4, (s0 + s1) / 2], TERRA, { smooth: true, hi: [[-2.2, s0 - 0.8, -2.4, s1 + 0.8]] });
  if (k.pass === 'paint') k.c.poly([-3.1, s1 + 0.2, 3.1, s1 + 0.2, 3.3, s1 + (s0 - s1) * 0.45, -3.3, s1 + (s0 - s1) * 0.45], true).fill(glaze);
  drips(k, [-1.6, 1.4], s1 + (s0 - s1) * 0.43, [1.6, 2.4], glaze, 0.55, true);
  pole(k, [0, py + 7, 0, sy1 - 3.6], 1.1, SOOT, { flat: true });
  slab(k, [-1.3, sy1 - 3.6, 0, sy1 - 7.0, 1.3, sy1 - 3.6], EDGE, { line: 0.7 });
  const arc = qpts(-pw, py + 4, 0, py - 8, pw, py + 4, 14);
  pole(k, arc, hand ? 2.2 : 2.8, IRON);
  for (const s of [-1, 1]) disc(k, s * pw, py + 4, 1.4, 1.4, CLAY, { line: 0.7 });
  pole(k, [-pw + 0.6, py + 3.8, 0, py + 7.2, pw - 0.6, py + 3.8], 0.6, 0xd8cfc0, { flat: true });
  pole(k, hand ? [1.0, -1.4, 2.8, 2.8] : [0.6, -2.4, 0.8, 4.6], 0.9, IRON);
  if (q >= 1) coneMark(k, 0.2, (s0 + s1) / 2 + 1.6, 1.2, TERRA);
  k.anchor = { x: 0, y: py + 1, r: 2.4 };
  glazeEye(k, 0, py - 0.4, 1.1);
}
const crossbow = (k: K) => xbow(k, false), handxbow = (k: K) => xbow(k, true);

const SH_CRACK = [8.2, -1.0, 6.0, 1.6, 6.6, 4.2, 4.2, 6.8, 4.8, 9.6, 3.4, 12.0];
const ORB_CRACK = [5.6, -0.6, 4.0, 2.2, 4.4, 4.0, 2.4, 5.6, 2.8, 7.2];

// ── shield: a saggar lid — a fired-clay disc with a thumb-pressed rim, dipped half in glaze, bound in iron ──
function shield(k: K): void {
  const q = k.q, glaze = q === 0 ? TENMOKU : CELADON, R = 12.6;
  disc(k, 0, 0.8, R, R + 0.6, TERRA, { line: 0.9 });
  if (k.pass === 'paint') {
    k.c.moveTo(-R + 0.4, -1).quadraticCurveTo(0, -3.6, R - 0.4, -1).arc(0, 0.8, R - 0.3, -0.14, Math.PI + 0.14, true).closePath().fill(glaze);
    k.c.ellipse(-4.0, -6.4, 3.8, 2.2).fill({ color: light(glaze, 0.4), alpha: 0.6 });
    for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; k.c.circle(Math.cos(a) * (R - 1.2), 0.8 + Math.sin(a) * (R - 0.8), 0.7).fill(shade(TERRA, 0.35)); }
  }
  drips(k, [-8.4, -4.6, -0.8, 3.2, 7.2], -1.6, [2.4, 3.8, 2.0, 3.2, 2.6], glaze, 0.75, true);
  ring(k, 0, 0.8, R + 0.3, R + 0.9, 1.4, IRON);
  // the crack runs down one side of the lid from the rim (never a level line under the knob: that read as a face)
  detail(k, SH_CRACK, shade(TERRA, 0.5), 0.6);
  disc(k, 0, 1.4, 2.8, 2.8, IRON, { line: 0.8 });
  if (q >= 1) coneMark(k, -5.6, 7.0, 1.6, IRON);
  k.anchor = { x: 0, y: 1.4, r: 3.2 };
  glazeEye(k, 0, 1.4, 1.3);
}

// ── quiver: a tall glazed jar — a narrow neck, a belly, glaze running down from the rim ──
function quiver(k: K): void {
  const q = k.q, glaze = q === 0 ? TENMOKU : CELADON;
  for (let i = 0; i < 3; i++) {
    const x = -2.4 + i * 2.4, y = -17.0 - (i % 2) * 1.8;
    pole(k, [x * 0.5, -9, x, y + 2], 0.9, ASH, { flat: true });
    slab(k, [x - 1.8, y + 4, x, y - 2.6, x + 1.8, y + 4, x, y + 2.4], q === 2 ? EMBER : 0xd8cfc0, { line: 0.7 });
  }
  const jar = [-3.0, -10.4, 3.0, -10.4, 3.2, -7.6, 6.0, -1.0, 6.0, 7.4, 3.6, 12.6, -3.6, 12.6, -6.0, 7.4, -6.0, -1.0, -3.2, -7.6];
  slab(k, jar, TERRA, { smooth: true, hi: [[-4.6, -1, -4.4, 8]] });
  if (k.pass === 'paint') k.c.poly([-3.1, -10.2, 3.1, -10.2, 3.4, -7.4, 5.0, -3.6, -5.0, -3.6, -3.4, -7.4], true).fill(glaze);
  drips(k, [-4.0, -1.2, 1.8, 4.2], -3.8, [2.6, 4.2, 2.0, 3.0], glaze, 0.7, true);
  ring(k, 0, -10.4, 3.4, 0.9, 1.2, glaze);
  if (q >= 1) coneMark(k, 0.8, 6.4, 1.4, TERRA);
  k.anchor = { x: 0, y: -8.6, r: 2.6 };
  glazeEye(k, -2.6, 3.0, 1.1);
}

// ── orb: a stoneware sphere glaze-capped, its crackle glaze glowing like coals underneath ──
function orb(k: K): void {
  const q = k.q, glaze = q === 0 ? TENMOKU : CELADON, R = 8.2;
  disc(k, 0, 0, R, R, TERRA, { line: 0.9 });
  if (k.pass === 'paint') { k.c.moveTo(-R + 0.3, -1.4).quadraticCurveTo(0, -3.4, R - 0.3, -1.4).arc(0, 0, R - 0.3, -0.17, Math.PI + 0.17, true).closePath().fill(glaze); k.c.ellipse(-2.8, -4.4, 2.6, 1.4).fill({ color: light(glaze, 0.5), alpha: 0.6 }); }
  drips(k, [-4.6, -1.0, 2.6, 5.4], -2.0, [2.2, 3.4, 1.8, 2.6], glaze, 0.65, true);
  detail(k, ORB_CRACK, shade(TERRA, 0.5), 0.55);
  if (q >= 1) coneMark(k, -1.2, 6.0, 1.2, TERRA);
  k.anchor = { x: 0, y: -R + 1.2, r: 2.2 };
  glazeEye(k, -5.0, 2.4, 1.1);
}

// ── effects for the rollout families (the same ember language) ──
function fxGreatsword(k: K): void { if (k.pass === 'light') { k.lit = true; k.litCol = k.litCol || EMBER; const b = bloom(k); k.c.poly(GS_HOT, true).fill({ color: EMBER, alpha: 0.5 + 0.25 * b }); k.c.poly(GS_WARM, true).fill({ color: EMBER, alpha: 0.16 + 0.1 * b }); } haze(k, 0, -45.0, 5.0, 4.6, EMBER, 0.12); embers(k, [[3.0, -51], [-4.4, -47], [5.4, -40]], 2, 4); }
function fxGreataxe(k: K): void { glowLine(k, [-7.2, -45.8, -5.4, -47.6, 5.4, -47.6, 7.2, -45.8], 0.5 + 0.35 * bloom(k), EMBER, true, IRON); haze(k, 0, -48.0, 7.0, 3.6, EMBER, 0.1); embers(k, [[0, -52], [8.6, -48], [-8.0, -47]], 2, 4); }
function fxMace(k: K): void { glowLine(k, [-4, -22, -2.6, -23, -1.4, -22.4], 0.4, EMBER, true, TERRA); glowLine(k, [2, -20, 3.4, -21, 4.6, -20.4], 0.4, EMBER, true, TERRA); haze(k, 0.2, -23, 7, 5, EMBER, 0.1); embers(k, [[9.4, -26], [-9.0, -24], [0, -32]], 2, 4); }
function fxXbow(k: K): void { glowLine(k, [-1.8, -20.6, -0.4, -19.6, 0.6, -20.8, 1.8, -19.8], 0.35, EMBER, true, TERRA); embers(k, [[14.4, -12], [-14.0, -12], [0, -31]], 1.6, 3); }
function fxHand(k: K): void { glowLine(k, [-1.4, -13.2, -0.2, -12.4, 1.2, -13.2], 0.3, EMBER, true, TERRA); embers(k, [[11.2, -7], [-10.8, -7]], 1.2, 2); }
function fxShield(k: K): void { glowLine(k, SH_CRACK, 0.45 + 0.3 * bloom(k), EMBER, true, TERRA); glowLine(k, [6.6, 4.2, 9.4, 6.0], 0.35, EMBER, true, TERRA); embers(k, [[13.6, -6], [-13.4, 4], [9.6, 12]], 2, 4); }
function fxQuiver(k: K): void { haze(k, 0, -18, 5, 4, EMBER, 0.1); embers(k, [[2.6, -22], [-3.0, -24], [0.2, -26]], 2, 4); }
function fxOrb(k: K): void { glowLine(k, ORB_CRACK, 0.5 + 0.3 * bloom(k), EMBER, true, TERRA); glowLine(k, [4.0, 2.2, 1.6, 3.0], 0.4, EMBER, true, TERRA); haze(k, 0, 0, 9.6, 9.6, EMBER, 0.09); embers(k, [[7.6, -7], [-8.0, -5], [0, -11]], 2, 4); }

export const KILNFOLK: SeriesInfo = {
  id: 'kilnfolk', gen: 1, name: 'Kilnfolk', maker: 'the firekeepers of Cinderwash and the Kilnwatch', zones: 'Cinderwash Kilns, Kilnwatch Crown (Sablefen road)', levels: '13–24',
  shape: 'round and heavy: collars, bellies, thumb-pressed rims, blunt tips; glaze drips break the lower edges',
  palette: [{ name: 'fire-scaled iron', hex: IRON }, { name: 'terracotta', hex: TERRA }, { name: 'celadon glaze', hex: CELADON }, { name: 'tenmoku glaze', hex: TENMOKU }, { name: 'ember (light)', hex: EMBER }],
  motif: 'the glazed collar with drips at the junction; the stamped kiln cone',
  late: 'clay-quenched temper lines, a celadon window in the axe, a crucible that keeps an ember, a cone that slumps',
  effects: 'embers drifting off hot iron, the quench line and glaze crazing glowing, heat haze over the crucible; ember impacts',
  draw: {
    blade: withFx(sword, fxSword), axe: withFx(axe, fxAxe), bow: withFx(bow, fxBow), staff: withFx(staff, fxStaff), wand: withFx(wand, fxWand),
    greatblade: withFx(greatsword, fxGreatsword), greataxe: withFx(greataxe, fxGreataxe), mace: withFx(mace, fxMace), crossbow: withFx(crossbow, fxXbow),
    handxbow: withFx(handxbow, fxHand), shield: withFx(shield, fxShield), quiver: withFx(quiver, fxQuiver), orb: withFx(orb, fxOrb),
  },
};
