// Series G2 · Brinekeeper (item levels 25–36): Sablefen ferriers, Saltwind brine keepers, the Lockglass cistern.
// Made by people of the pans and the causeway: bleached driftwood, tarred rope whipping, yellow oilskin (Sera, CAST.md),
// salt that grows cubic crystals on whatever is left in the brine, tinted pink by the pans (ART-REFERENCES RW3, RW7),
// and Lockglass's green glass. Shape language: long, lean and tapering, whip curves, wrapped in black whippings; the
// accents are hard little cubes (rule A1). No light yet (R6). Maker's mark: a stamped salt cube.
import type { SeriesInfo } from './index';
import { RARITY_ACCENT, cube, detail, disc, lash, pole, qpts, ribbon, ring, slab, bevel, type K } from './kit';
import { light, mix, shade } from '../util';
import { localXf } from '../weaponArt';
import { OUT } from '../draw';

const TAR = 0x2c2b31, DRIFT = 0xcdc3ac, OILSKIN = 0xe2b22e, BRINE = 0xec9fad, SALT = 0xf3efe8, GLASS = 0x7fc4bc;
const ROPE = 0xb99a68, STEEL = 0xa8b2b8, EDGE = 0xe2e8ea, BRASS = 0xc29a4e;

/** Tarred whipping: tight black cord bands (the series' binding everywhere). */
function whip(k: K, x: number, y0: number, y1: number, w: number): void { lash(k, x, y0, y1, w, TAR, { gap: 1.25, slant: 0.35, bulge: 0.3 }); }

/** A cluster of salt cubes grown at (x, y): pinker and bigger with craft (brine-grown on purpose, not crust). */
function salt(k: K, x: number, y: number, size: number, n: number, seedRot = 0, accent = false): void {
  const spots = [[0, 0, 1], [-0.9, 0.5, 0.7], [0.95, 0.35, 0.62], [-0.3, -0.95, 0.55], [0.6, -0.8, 0.45], [-1.2, -0.4, 0.4]];
  for (let i = Math.min(n, spots.length) - 1; i >= 0; i--) {
    const [dx, dy, s] = spots[i];
    // the rarity accent of the brinekeepers: one crystal of the cluster grown in the rarity colour (rule A5)
    const col = accent && k.q && i === 1 ? mix(RARITY_ACCENT[k.q], SALT, 0.15) : i % 2 ? SALT : mix(SALT, BRINE, k.q >= 2 ? 0.75 : 0.45);
    cube(k, x + dx * size * 1.5, y + dy * size * 1.5, size * s, col, { rot: (i * 0.37 + seedRot) % 0.8 - 0.4, line: 0.55 });
  }
}

function saltMark(k: K, x: number, y: number, s: number, on: number): void {
  if (k.pass !== 'paint') return;
  const col = k.q >= 2 ? BRINE : shade(on, 0.55);
  k.c.rect(x - s / 2, y - s / 2, s, s).stroke({ width: 0.55, color: col });
  k.c.moveTo(x - s / 2, y - s / 2).lineTo(x - s / 4, y - s * 0.75).lineTo(x + s * 0.75, y - s * 0.75).lineTo(x + s / 2, y - s / 2).stroke({ width: 0.5, color: col });
}

// ── sword: a brine knife — long, thin, curved like a flensing blade; a salt-cube pommel ──
function sword(k: K): void {
  const q = k.q;
  k.anchor = { x: 0.3, y: -4.8, r: 2.4 };
  // spine on -x, the cutting edge on +x; the blade curves back towards the spine at the tip
  const sp = qpts(-1.6, -5.6, -1.8, -22, -4.6, -34.6, 10), ed = qpts(2.6, -5.6, 4.4, -24, -4.6, -34.6, 10);
  const edRev: number[] = []; for (let i = ed.length - 4; i >= 0; i -= 2) edRev.push(ed[i], ed[i + 1]);
  const blade = [...sp, ...edRev];
  const mid = qpts(0.6, -5.6, 1.4, -23, -4.6, -34.6, 10);
  const lit = [...sp]; for (let i = mid.length - 4; i >= 0; i -= 2) lit.push(mid[i], mid[i + 1]);
  bevel(k, blade, lit, STEEL, { edge: qpts(1.7, -6.4, 3.0, -23.4, -3.8, -33.6, 8), edgeCol: EDGE });
  // salt crust on the spine (normal) / etched brine line (rare)
  if (q === 0 && k.pass === 'paint') for (const [x, y, s] of [[-1.5, -12, 0.9], [-1.7, -16.5, 0.7], [-2.1, -22, 1.0], [-1.0, -14.2, 0.5]]) { k.c.rect(x - s / 2, y - s / 2, s, s).fill(SALT); }
  if (q === 2) detail(k, qpts(-0.4, -7, -0.6, -22, -3.6, -31.6, 8), BRINE, 0.55, 0.9);
  if (q >= 1) saltMark(k, 0.3, -8.6, 1.2, STEEL);
  // guard: a tarred rope grommet (normal) or a brass ferrule (magic+)
  if (q === 0) ring(k, 0.4, -5.0, 3.4, 1.2, 1.6, TAR);
  else slab(k, [-2.8, -4.0, 3.6, -4.0, 3.3, -6.0, -2.5, -6.0], BRASS, { hi: [[-2.2, -5.4, 2.9, -5.4]] });
  // grip: driftwood, whipped in two places
  slab(k, [-1.6, -4.0, 2.2, -4.0, 2.0, 5.0, -1.4, 5.0], DRIFT, { hi: [[-1.0, -3.2, -0.9, 4.2]] });
  detail(k, [0.4, -2.6, 0.7, 1.0, 0.2, 4.0], shade(DRIFT, 0.35), 0.5);
  whip(k, 0.3, -3.8, -1.6, 3.8); whip(k, 0.3, 2.2, 4.6, 3.8);
  if (q >= 1) lash(k, 0.3, -1.2, 1.8, 3.6, OILSKIN, { gap: 1.5, slant: 0.2, bulge: 0.15 });
  // pommel: salt cubes grown on the butt
  salt(k, 0.3, 7.6, q === 0 ? 2.0 : 2.5, q === 0 ? 2 : q === 1 ? 3 : 5, 0, true);
}

// ── axe: a ferrier's hook-axe — a slim long-bearded blade and a boat-hook spike, on a tarred pole ──
function axe(k: K): void {
  const q = k.q;
  pole(k, [0.0, 8.0, 0.2, -28.6], 2.6, TAR);
  if (k.pass === 'paint') detail(k, [-0.5, 6.4, -0.4, -26], light(TAR, 0.35), 0.5);
  lash(k, 0.05, 1.0, 6.2, 3.0, OILSKIN, { gap: 1.7, slant: 0.4, bulge: 0.15 });
  // blade: narrow at the top, a long beard sweeping down to a hook-point
  const blade = [1.4, -27.0, 5.2, -27.6, 7.8, -26.4, 8.4, -22.0, 8.2, -16.0, 7.0, -10.4, 5.0, -9.6, 5.6, -12.6, 4.6, -16.6, 1.4, -19.2];
  const lit = [1.4, -27.0, 5.2, -27.6, 6.6, -26.6, 6.4, -21.6, 5.0, -17.6, 1.4, -19.6];
  bevel(k, blade, lit, STEEL, { edge: [7.8, -25.8, 7.6, -16.4, 6.3, -11.2], edgeCol: EDGE });
  if (q === 0 && k.pass === 'paint') for (const [x, y, s] of [[3.4, -21.2, 0.9], [2.6, -23.6, 0.6], [5.0, -14.0, 0.7]]) k.c.rect(x - s / 2, y - s / 2, s, s).fill(SALT);
  // the boat hook behind: a straight spike with a recurved barb
  slab(k, [-1.2, -24.4, -6.2, -25.2, -10.6, -23.2, -9.4, -22.4, -6.4, -23.0, -1.2, -21.6], q >= 1 ? BRASS : STEEL);
  slab(k, [-6.6, -23.4, -8.0, -20.2, -6.6, -18.8, -7.4, -21.2], q >= 1 ? BRASS : STEEL, { line: 0.75 });
  // socket whipping + a ring
  whip(k, 0.1, -29.2, -18.4, 3.4);
  if (q >= 1) ring(k, 0.1, -18.0, 2.0, 0.7, 0.9, BRASS);
  if (q >= 1) saltMark(k, 4.4, -21.6, 1.2, STEEL);
  if (q >= 1) salt(k, 0.2, -30.6, 1.2, q === 2 ? 4 : 2, 0, true);
  k.anchor = { x: 0.1, y: -18.0, r: 2.2 };
}

// ── bow: a bundle of three reeds bound by tarred whippings, tips recurved like a whip ──
function bow(k: K): void {
  const q = k.q;
  const limbs = [qpts(-2.4, -21.4, 9.4, -15.6, 2.8, -2.6, 14), qpts(-2.4, 21.4, 9.4, 15.6, 2.8, 2.6, 14)];
  for (const cl of limbs) {
    const n = cl.length / 2, ws: number[] = [];
    for (let i = 0; i < n; i++) { const t = i / (n - 1); ws.push(1.1 + t * 2.6); }
    slab(k, ribbon(cl, ws), DRIFT, { line: 0, flat: true });
    if (k.pass === 'paint') {
      // three reeds: light, base, shade bands with dark seams between
      slab(k, ribbon(cl, ws, 0, -1, -0.33), light(DRIFT, 0.3), { line: 0, flat: true, inner: true });
      slab(k, ribbon(cl, ws, 0, 0.33, 1), shade(DRIFT, 0.32), { line: 0, flat: true, inner: true });
      for (const s of [-0.33, 0.33]) { const seam = ribbon(cl, ws, 0, s - 0.04, s + 0.04); k.c.poly(seam, true).fill(shade(DRIFT, 0.55)); }
      k.c.poly(ribbon(cl, ws), true).stroke({ width: 0.9, color: OUT, join: 'round' });
      // tarred whippings at intervals (the series binding)
      for (const i of [3, 7, 11]) {
        const x = cl[i * 2], y = cl[i * 2 + 1], x2 = cl[(i + 1) * 2], y2 = cl[(i + 1) * 2 + 1];
        const dx = x2 - x, dy = y2 - y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, w = ws[i] / 2 + 0.4;
        k.c.poly([x + nx * w, y + ny * w, x2 + nx * w, y2 + ny * w, x2 - nx * w, y2 - ny * w, x - nx * w, y - ny * w], true).fill(TAR);
        k.c.moveTo(x + nx * w * 0.8, y + ny * w * 0.8).lineTo(x2 + nx * w * 0.8 - dx * 0.4, y2 + ny * w * 0.8 - dy * 0.4).stroke({ width: 0.4, color: light(TAR, 0.4) });
      }
      if (q === 0) for (const i of [5, 9]) { const x = cl[i * 2], y = cl[i * 2 + 1]; k.c.rect(x - 0.4, y - 0.4, 0.8, 0.8).fill(SALT); }
    }
  }
  // grip: yellow oilskin wrapped, tied with tar cord
  lash(k, 3.0, -3.6, 3.6, 3.8, OILSKIN, { gap: 2.2, slant: 1.0, bulge: 0.3 });
  whip(k, 3.0, -4.6, -3.4, 3.6); whip(k, 3.0, 3.4, 4.6, 3.6);
  if (q >= 1) saltMark(k, 3.0, 0, 1.1, OILSKIN);
  // tips: green glass beads bound on (magic+), bare reed ends otherwise
  for (const s of [-1, 1]) {
    if (q >= 1) disc(k, -2.6, s * 21.8, 1.5, 1.5, GLASS, { line: 0.7 });
    if (q === 2) salt(k, 4.2, s * 9.6, 0.9, 2, s);
    if (q >= 1 && s < 0) salt(k, 5.4, 0.2, 0.8, 2, 0.2, true);
  }
  if (!k.rig) pole(k, [-2.4, -21.0, -2.4, 21.0], 0.7, mix(ROPE, 0x000000, 0.2), { flat: true });
  k.anchor = { x: 3.0, y: -4.6, r: 2.2 };
}

// ── staff: a ferry pole with a brass hook and a Lockglass float netted in rope ──
function staff(k: K): void {
  const q = k.q;
  pole(k, [0.4, 22.6, 1.4, -6, -0.2, -40.0], 2.8, DRIFT, { curve: true });
  if (k.pass === 'paint') detail(k, [0.2, 18, 0.9, -4, 0.0, -34], shade(DRIFT, 0.35), 0.5);
  for (const [a, b] of [[18.6, 21.6], [-4.6, -2.0], [-26.6, -24.4]] as const) whip(k, 0.6, a, b, 3.2);
  lash(k, 0.7, 3.0, 11.0, 3.2, OILSKIN, { gap: 2.0, slant: 0.6, bulge: 0.2 });
  // the head is drawn at 1.4× round the pole top (the business end carries the identity, rule A7)
  k.c.save(); localXf(k.c, 0, -39.0, 0, 1.4); localXf(k.c, 0, 39.0, 0, 1);
  // the hook: a straight spike and a curved hook, brass on magic+
  const metal = q >= 1 ? BRASS : STEEL;
  slab(k, [-1.0, -39.0, 1.0, -39.0, 0.8, -49.8, 0, -52.4, -0.8, -49.8], metal, { hi: [[-0.5, -40, -0.4, -49]] });
  slab(k, [0.6, -42.4, 4.6, -44.0, 6.6, -47.8, 5.8, -51.6, 4.6, -50.2, 5.0, -47.6, 3.6, -45.6, 0.6, -44.6], metal, { smooth: true });
  whip(k, -0.1, -41.4, -37.6, 3.0);
  // the glass float in its rope net, tied below the hook (magic+); a coil of rope otherwise
  if (q === 0) { ring(k, -3.4, -35.2, 2.6, 3.2, 1.0, ROPE); ring(k, -3.6, -34.8, 1.8, 2.4, 0.9, ROPE, { inner: true }); }
  else {
    pole(k, [-0.6, -37.0, -3.6, -36.0], 0.7, ROPE, { flat: true });
    disc(k, -5.6, -33.6, 3.6, 3.6, GLASS, { line: 0.8 });
    if (k.pass === 'paint') {
      k.c.circle(-5.6, -33.6, 2.6).fill({ color: light(GLASS, 0.35), alpha: 0.55 });
      k.c.ellipse(-6.8, -35.2, 1.1, 0.7).fill(0xffffff);
      for (const a of [-0.6, 0.4, 1.4]) { k.c.moveTo(-5.6 + Math.cos(a) * 3.6, -33.6 - 3.6 * 0.2).quadraticCurveTo(-5.6, -33.6 + Math.sin(a) * 2, -5.6 - Math.cos(a) * 3.6, -33.6 + 3.6 * 0.3); }
      k.c.stroke({ width: 0.55, color: ROPE });
      k.c.ellipse(-5.6, -33.6, 3.6, 1.2).stroke({ width: 0.6, color: ROPE });
    }
  }
  if (q >= 1) salt(k, 1.4, -38.0, 1.2, q === 2 ? 4 : 2, 0.3, true);
  k.c.restore();
  if (q >= 1) saltMark(k, 0.5, -20, 1.0, DRIFT);
  k.anchor = { x: 0.2, y: -38.6, r: 2.2 };
}

// ── wand: a dipping stick left in the pans until salt grew on it ──
function wand(k: K): void {
  const q = k.q;
  pole(k, [0.2, 5.6, 1.2, -5, -0.6, -15.4], 2.3, DRIFT, { curve: true });
  if (k.pass === 'paint') detail(k, [0.3, 3.6, 0.6, -4, -0.2, -12], shade(DRIFT, 0.35), 0.45);
  whip(k, 0.3, 1.0, 4.6, 2.8);
  if (q >= 1) lash(k, 0.45, -3.4, 0.4, 2.7, OILSKIN, { gap: 1.4, slant: 0.4, bulge: 0.15 });
  // the grown crystal cluster: a crust on normal pieces, a pink cluster when brine-grown on purpose
  salt(k, -0.6, -18.4, q === 0 ? 1.8 : q === 1 ? 2.2 : 2.6, q === 0 ? 3 : q === 1 ? 4 : 6, 0.2, true);
  if (q === 2) disc(k, -0.2, -6.6, 1.1, 1.1, GLASS, { line: 0.6 });
  k.anchor = { x: 0.3, y: 0.8, r: 1.8 };
}

export const BRINEKEEPER: SeriesInfo = {
  id: 'brinekeeper', gen: 2, name: 'Brinekeeper', maker: 'Saltwind brine keepers, Sablefen ferriers, the Lockglass cistern', zones: 'Sablefen, Saltwind Pans, Lockglass Cistern', levels: '25–36',
  shape: 'long, lean and tapering; whip curves; black whippings; hard little cubes as accents',
  palette: [{ name: 'driftwood', hex: DRIFT }, { name: 'tar', hex: TAR }, { name: 'oilskin', hex: OILSKIN }, { name: 'brine salt', hex: BRINE }, { name: 'Lockglass', hex: GLASS }],
  motif: 'cubic salt crystals grown at the ends; tarred whipping at every binding',
  late: 'pink brine-grown crystal clusters; a glass float netted under a ferry hook',
  draw: { blade: sword, axe, bow, staff, wand },
};
