// Series G2 · Brinekeeper (item levels 25–36): Sablefen ferriers, Saltwind brine keepers, the Lockglass cistern.
// Made by people of the pans and the causeway: bleached driftwood, tarred rope whipping, yellow oilskin (Sera, CAST.md),
// salt that grows cubic crystals on whatever is left in the brine, tinted pink by the pans (ART-REFERENCES RW3, RW7),
// and Lockglass's green glass. Shape language: long, lean and tapering, whip curves, wrapped in black whippings; the
// accents are hard little cubes (rule A1). No light yet (R6). Maker's mark: a stamped salt cube.
import type { SeriesInfo } from './index';
import { accentOf, arcAt, bloom, cube, detail, disc, fxCount, glowLine, glowSpot, haze, jit, lash, mote, pole, qpts, ribbon, ring, slab, bevel, withFx, type K } from './kit';
import { light, mix, shade } from '../util';
import { localXf } from '../weaponArt';
import { OUT } from '../draw';

const TAR = 0x2c2b31, DRIFT = 0xcdc3ac, OILSKIN = 0xe2b22e, BRINE = 0xec9fad, SALT = 0xf3efe8, GLASS = 0x7fc4bc;
const ROPE = 0xb99a68, STEEL = 0xa8b2b8, EDGE = 0xe2e8ea, BRASS = 0xc29a4e;
/** The series' light (owner decision 2026-10-11): sea-glass, the lit Lockglass float and the glint of salt. */
const SEA = 0x9ff0e0;

/** Tarred whipping: tight black cord bands (the series' binding everywhere). */
function whip(k: K, x: number, y0: number, y1: number, w: number): void { lash(k, x, y0, y1, w, TAR, { gap: 1.25, slant: 0.35, bulge: 0.3 }); }

/** A cluster of salt cubes grown at (x, y): pinker and bigger with craft (brine-grown on purpose, not crust). */
function salt(k: K, x: number, y: number, size: number, n: number, seedRot = 0, accent = false): void {
  const spots = [[0, 0, 1], [-0.9, 0.5, 0.7], [0.95, 0.35, 0.62], [-0.3, -0.95, 0.55], [0.6, -0.8, 0.45], [-1.2, -0.4, 0.4]];
  for (let i = Math.min(n, spots.length) - 1; i >= 0; i--) {
    const [dx, dy, s] = spots[i];
    // the rarity accent of the brinekeepers: one crystal of the cluster grown in the rarity colour (rule A5)
    const col = accent && k.q && i === 1 ? mix(accentOf(k), SALT, 0.15) : i % 2 ? SALT : mix(SALT, BRINE, k.q >= 2 ? 0.75 : 0.45);
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
  // the socket: a plain tarred sleeve, whipped only at its two ends (the old full-length whipping read as a coil)
  slab(k, [-1.7, -29.0, 1.9, -29.0, 1.9, -18.6, -1.7, -18.6], TAR, { hi: [[-1.1, -28.2, -1.1, -19.4]] });
  whip(k, 0.1, -29.4, -27.2, 3.6); whip(k, 0.1, -20.6, -18.4, 3.6);
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


// ── effect language: salt glitter, sea-spray mist, the lit Lockglass glass ──
const glitter = (k: K, pts: [number, number][], per = 2, max = 4) => { const n = fxCount(k, per, max); for (let i = 0; i < n; i++) { const [x, y] = pts[i % pts.length]; mote(k, x + jit(k.seed, i, 1.0), y + jit(k.seed, i + 5, 1.0), 0.55, i % 2 ? SALT : SEA, 'spark', { bob: 0.5, spin: 2.4 + i * 0.4, phase: i * 1.3 }); } };
function fxSword(k: K): void {
  glowLine(k, qpts(-0.4, -7, -0.6, -22, -3.6, -31.6, 8), 0.35 + 0.25 * bloom(k), SEA, true, STEEL);
  glitter(k, [[2.6, 9.0], [-2.4, 6.4], [-2.6, -16], [3.4, -24]]);
}
function fxAxe(k: K): void {
  haze(k, 9.0, -17.0, 4.0, 7.0, SEA, 0.1);
  glitter(k, [[9.6, -24], [8.0, -12], [-9.6, -21]]);
}
function fxBow(k: K): void {
  for (const s of [-1, 1]) glowSpot(k, -2.6, s * 21.8, 1.2, SEA, true);
  glitter(k, [[8.6, -10], [8.6, 10], [6.4, 0]]);
}
function fxStaff(k: K): void {
  // the float sits in the head, which is drawn 1.4× round (0, -39)
  glowSpot(k, -7.8, -31.4, 2.6 + bloom(k), SEA, true);
  haze(k, -7.8, -31.4, 9.0, 7.0, SEA, 0.12);
  glitter(k, [[2.6, -40], [-9.4, -31], [1.0, -55], [-8.0, -38]], 2.4, 5);
}
function fxWand(k: K): void {
  glowSpot(k, -0.6, -18.6, 1.4 + bloom(k), SEA, true);
  glitter(k, [[2.2, -22], [-3.4, -19], [0.4, -24.6]]);
}


// ═══════════════ the other held families (rollout 2026-10-11) ═══════════════

// ── greatsword: a tooth sword — a broad driftwood blade edged on both sides with salt-crystal teeth lashed on in
//    tarred whipping (after the Pacific swords of wood edged with lashed shark teeth [K]); no guard, a long whipped grip;
//    the teeth turn to sea-glass with craft ──
let gsTeeth: [number, number][] = [];
function greatsword(k: K): void {
  const q = k.q;
  k.anchor = { x: 0, y: -8.6, r: 2.8 };
  const blade = [-3.2, -8.0, 3.2, -8.0, 3.8, -20, 3.6, -36, 2.0, -46.4, 0, -49.6, -2.0, -46.4, -3.6, -36, -3.8, -20];
  slab(k, blade, DRIFT, { smooth: true, hi: [[-2.6, -9.4, -3.0, -34.0]] });
  detail(k, [0.4, -9.6, 0.6, -24, 0.2, -40, -0.2, -46.6], shade(DRIFT, 0.35), 0.6);
  detail(k, [-1.4, -14, -1.2, -28], shade(DRIFT, 0.3), 0.45);
  gsTeeth = [];
  for (let i = 0; i < 7; i++) {
    const y = -12.6 - i * 5.0, w = i < 5 ? 3.8 : 3.8 - (i - 4) * 1.0;
    for (const s of [-1, 1]) {
      const x = s * (w + 1.2);
      const col = q === 0 ? SALT : i % 3 === 1 ? mix(SALT, BRINE, 0.6) : GLASS;
      // set point-out (turned 45°) so each crystal reads as a tooth
      cube(k, x, y, 1.75, col, { rot: 0.785 + jit(k.seed, i * 2 + (s > 0 ? 1 : 0), 0.12), line: 0.6 });
      gsTeeth.push([x, y]);
    }
  }
  for (const y of [-15.1, -30.1]) whip(k, 0, y - 1.0, y + 1.0, 7.6);
  if (q >= 1) saltMark(k, 0, -11.0, 1.4, DRIFT);
  slab(k, [-1.8, -8.0, 1.8, -8.0, 1.7, 10.0, -1.7, 10.0], DRIFT, { hi: [[-1.1, -7.2, -1.0, 9.2]] });
  for (const [a, b] of [[-7.6, -5.4], [0.2, 2.4], [7.6, 9.8]] as const) whip(k, 0, a, b, 4.0);
  if (q >= 1) lash(k, 0, -4.4, -0.4, 3.8, OILSKIN, { gap: 1.5, slant: 0.2, bulge: 0.15 });
  salt(k, 0, 12.6, q === 0 ? 2.1 : 2.6, q === 0 ? 2 : q === 1 ? 3 : 5, 0, true);
}

// ── great axe: a salter's axe — a long-bearded blade, a toothed pan rake on its back, a tarred haft ──
function greataxe(k: K): void {
  const q = k.q;
  pole(k, [0.0, 11.6, 0.2, -48], 3.0, TAR);
  if (k.pass === 'paint') detail(k, [-0.6, 10, -0.4, -44], light(TAR, 0.35), 0.5);
  lash(k, 0.05, 2.0, 9.6, 3.4, OILSKIN, { gap: 1.8, slant: 0.4, bulge: 0.15 });
  const blade = [1.6, -46.4, 7.4, -47.6, 11.6, -45.4, 12.6, -38.0, 12.2, -28.4, 10.4, -20.0, 7.0, -18.6, 7.8, -23.4, 6.6, -29.4, 1.6, -33.4];
  bevel(k, blade, [1.6, -46.4, 7.4, -47.6, 9.8, -46.0, 9.4, -37.6, 7.4, -30.6, 1.6, -33.8], STEEL, { edge: [11.6, -44.4, 11.4, -28.6, 9.4, -20.8], edgeCol: EDGE });
  if (q === 0 && k.pass === 'paint') for (const [x, y, s] of [[4.8, -38, 1.0], [3.6, -42, 0.7], [8.0, -25, 0.8]]) k.c.rect(x - s / 2, y - s / 2, s, s).fill(SALT);
  // the rake: a bar with teeth, brass on magic+
  const metal = q >= 1 ? BRASS : STEEL;
  slab(k, [-1.4, -44.6, -9.6, -44.6, -9.6, -41.8, -1.4, -41.8], metal, { hi: [[-9.0, -44.0, -2.0, -44.0]] });
  for (let i = 0; i < 4; i++) { const x = -3.2 - i * 2.0; slab(k, [x - 0.5, -41.8, x + 0.5, -41.8, x + 0.3, -37.6, x - 0.3, -37.6], metal, { line: 0.6 }); }
  slab(k, [-1.8, -49.0, 2.0, -49.0, 2.0, -32.6, -1.8, -32.6], TAR, { hi: [[-1.2, -48.2, -1.2, -33.4]] });
  whip(k, 0.1, -49.6, -47.0, 3.8); whip(k, 0.1, -35.0, -32.4, 3.8);
  if (q >= 1) saltMark(k, 6.0, -36, 1.4, STEEL);
  if (q >= 1) salt(k, 0.2, -51.0, 1.3, q === 2 ? 4 : 2, 0, true);
  k.anchor = { x: 0.1, y: -32.4, r: 2.4 };
}

// ── mace: a fish priest — the fisher's short club, a driftwood head weighted with salt and bound in tar ──
function mace(k: K): void {
  const q = k.q;
  slab(k, [-1.4, 6.6, 1.8, 6.6, 2.4, -9.4, 4.2, -17.6, 4.6, -24.6, 2.6, -27.4, -2.2, -27.4, -4.2, -24.6, -3.8, -17.6, -2.0, -9.4], DRIFT, { smooth: true, hi: [[-2.6, -24, -1.2, -8]] });
  if (k.pass === 'paint') detail(k, [0.6, 4, 1.2, -12, 1.6, -24], shade(DRIFT, 0.35), 0.5);
  for (const [a, b] of [[-13.6, -11.4], [-22.6, -19.8]] as const) whip(k, 0.2, a, b, 8.2);
  whip(k, 0.2, 2.4, 5.6, 3.6);
  if (q >= 1) lash(k, 0.2, -2.6, 1.6, 3.4, OILSKIN, { gap: 1.4, slant: 0.4, bulge: 0.15 });
  if (q === 0 && k.pass === 'paint') for (const [x, y, s] of [[-2.6, -18, 1.0], [2.6, -20, 0.8]]) k.c.rect(x - s / 2, y - s / 2, s, s).fill(SALT);
  salt(k, 0.2, -28.8, q === 0 ? 1.6 : 2.0, q === 0 ? 2 : q === 1 ? 4 : 6, 0.3, true);
  if (q >= 1) saltMark(k, 0.2, -17.0, 1.3, DRIFT);
  k.anchor = { x: 0.2, y: -12.0, r: 2.4 };
}

// ── crossbow: driftwood whipped in tar, a prod of bound reeds, oilskin at the fore-end, glass beads at the tips ──
function xbow(k: K, hand: boolean): void {
  const q = k.q, pw = hand ? 9.6 : 13.0, py = hand ? -9 : -16, sy1 = hand ? -12.4 : -24, sy0 = hand ? 3 : 8;
  if (hand) slab(k, [-1.8, 4.8, 2.6, 4.8, 3.6, 0.8, 2.0, -2.0, 1.8, sy1, -1.8, sy1, -1.8, -2.0], DRIFT, { hi: [[-1.2, sy1 + 1, -1.2, -2.6]] });
  else slab(k, [-2.4, sy0, 2.4, sy0, 2.6, sy0 - 4, 2.0, sy1, -2.0, sy1, -2.6, sy0 - 4], DRIFT, { hi: [[-1.8, sy1 + 1, -2.0, sy0 - 4]] });
  whip(k, 0, sy0 - 3.6, sy0 - 1.6, 4.4); whip(k, 0, sy1 + 1, sy1 + 3, 3.8);
  lash(k, 0, py - 1, py + 4, 4.2, OILSKIN, { gap: 1.6, slant: 0.5, bulge: 0.2 });
  pole(k, [0, py + 7, 0, sy1 - 3.6], 1.0, DRIFT, { flat: true });
  slab(k, [-1.2, sy1 - 3.6, 0, sy1 - 6.8, 1.2, sy1 - 3.6], STEEL, { line: 0.7 });
  // reed prod: three bound reeds
  for (const [dy, col] of [[0.0, DRIFT], [-1.1, light(DRIFT, 0.3)], [1.1, shade(DRIFT, 0.3)]] as const) pole(k, qpts(-pw, py + 4 + dy, 0, py - 8 + dy, pw, py + 4 + dy, 14), hand ? 1.0 : 1.3, col, { inner: dy !== 0 });
  for (const t of [0.22, 0.78]) { const x = -pw + 2 * pw * t, y = py + 4 - 12 * 4 * t * (1 - t) * 0.5; whip(k, x, y - 1.4, y + 1.4, 2.6); }
  pole(k, [-pw + 0.6, py + 3.8, 0, py + 7.2, pw - 0.6, py + 3.8], 0.6, mix(ROPE, 0x000000, 0.15), { flat: true });
  if (q >= 1) for (const s of [-1, 1]) disc(k, s * pw, py + 4, 1.3, 1.3, GLASS, { line: 0.7 });
  pole(k, hand ? [1.0, -1.4, 2.6, 2.6] : [0.6, -2.4, 0.8, 4.6], 0.9, STEEL);
  if (q >= 1) saltMark(k, 0.2, hand ? -5.4 : -7.6, 1.2, DRIFT);
  if (q === 2) salt(k, 0, sy0 + 1.6, 1.2, 3, 0, true);
  k.anchor = { x: 0, y: py + 1, r: 2.4 };
}
const crossbow = (k: K) => xbow(k, false), handxbow = (k: K) => xbow(k, true);

// ── shield: an oar blade — a ferry oar cut down to its blade, edged in tarred rope, salt-crusted ──
function shield(k: K): void {
  const q = k.q;
  // the loom stub of the oar above the blade, so it reads as an oar and not a round shield
  pole(k, [0, -21.4, 0, -12.0], 3.0, DRIFT);
  const blade = [-2.2, -13.6, 2.2, -13.6, 8.4, -6.0, 10.4, 4.0, 8.4, 13.0, 0, 16.6, -8.4, 13.0, -10.4, 4.0, -8.4, -6.0];
  slab(k, blade, DRIFT, { hi: [[-7.6, -4.6, -9.0, 6.0]] });
  if (k.pass === 'paint') { detail(k, [0, -14.4, 0.4, 0, 0, 15.0], shade(DRIFT, 0.3), 0.6); for (const x of [-5.4, 4.8]) detail(k, [x, -6, x + 0.6, 8, x, 12], shade(DRIFT, 0.3), 0.45, 0.8); }
  ring(k, 0, 1.6, 10.4, 14.2, 1.1, TAR, { a0: -2.6, a1: -0.55 });
  slab(k, [-10.2, -1.4, 10.2, -1.4, 10.4, 1.6, -10.4, 1.6], OILSKIN, { line: 0.75, hi: [[-9.6, -0.8, 9.6, -0.8]] });
  whip(k, 0, -15.6, -12.6, 4.6);
  disc(k, 0, -22.2, 1.9, 1.3, TAR, { line: 0.7 });
  if (q === 0 && k.pass === 'paint') for (const [x, y, s] of [[-6, 9, 1.2], [5, 11, 0.9], [-3, 12.6, 0.8], [7, 6, 0.7]]) k.c.rect(x - s / 2, y - s / 2, s, s).fill(SALT);
  if (q >= 1) disc(k, 0, 6.4, 2.6, 2.6, GLASS, { line: 0.8 });
  if (q >= 1) saltMark(k, 0, -8, 1.8, DRIFT);
  if (q === 2) salt(k, 7.6, 10.0, 1.3, 4, 0.2, true);
  k.anchor = { x: 0, y: 0, r: 3 };
}

// ── quiver: an oilskin roll — yellow oilskin wrapped round the arrows, tied with tarred cord ──
function quiver(k: K): void {
  const q = k.q;
  for (let i = 0; i < 3; i++) {
    const x = -2.6 + i * 2.6, y = -16.6 - (i % 2) * 1.8;
    pole(k, [x * 0.6, -8, x, y + 2], 0.9, DRIFT, { flat: true });
    slab(k, [x - 1.8, y + 4, x, y - 2.6, x + 1.8, y + 4, x, y + 2.4], SALT, { line: 0.7 });
  }
  slab(k, [-4.6, -10.4, 4.8, -10.0, 5.4, 6.0, 4.6, 12.8, -4.0, 12.8, -5.0, 6.0], OILSKIN, { hi: [[-3.8, -9, -4.2, 11]] });
  if (k.pass === 'paint') { detail(k, [-4.6, -10.4, 3.0, -6.8, 5.2, -2.0], shade(OILSKIN, 0.35), 0.7); detail(k, [-4.8, 2.0, 4.8, 5.6], shade(OILSKIN, 0.35), 0.6); }
  for (const y of [-7.4, 3.4, 10.4]) whip(k, 0.2, y - 1.0, y + 1.0, 10.2);
  if (q >= 1) disc(k, 3.6, -2.4, 1.3, 1.3, GLASS, { line: 0.7 });
  if (q === 2) salt(k, -3.0, 12.4, 1.1, 3, 0.1, true);
  else if (q === 1) salt(k, -3.0, 12.4, 0.9, 2, 0.1, true);
  k.anchor = { x: 0, y: -9.4, r: 2.4 };
}

// ── orb: a Lockglass float — green glass blown round, netted in rope for the nets of the causeway ──
function orb(k: K): void {
  const q = k.q, R = 7.8;
  disc(k, 0, 0, R, R, GLASS, { line: 0.9 });
  if (k.pass === 'paint') {
    k.c.circle(0, 0, R * 0.72).fill({ color: light(GLASS, 0.35), alpha: 0.5 });
    k.c.ellipse(-2.6, -3.6, 2.4, 1.4).fill(0xffffff);
    for (const a of [-0.9, 0, 0.9]) { k.c.moveTo(Math.sin(a) * R, -Math.cos(a) * R).quadraticCurveTo(Math.sin(a) * R * 1.25, 0, Math.sin(a) * R, Math.cos(a) * R); }
    k.c.stroke({ width: 0.75, color: ROPE });
    k.c.ellipse(0, 0, R, R * 0.36).stroke({ width: 0.75, color: ROPE });
    k.c.ellipse(0, -R * 0.55, R * 0.8, R * 0.2).stroke({ width: 0.6, color: ROPE });
  }
  whip(k, 0, -R - 1.6, -R + 0.6, 2.8);
  pole(k, [0, -R - 1.6, 0.8, -R - 4.2], 0.8, ROPE, { flat: true });
  if (q === 2) salt(k, 4.2, 5.8, 1.1, 3, 0.2, true);
  else if (q === 1) salt(k, 4.2, 5.8, 0.9, 2, 0.2, true);
  k.anchor = { x: 0, y: -R, r: 2 };
}

// ── effects for the rollout families (salt glitter, sea-glass, spray) ──
function fxGreatsword(k: K): void { if (k.pass === 'light') { k.lit = true; k.litCol = k.litCol || SEA; const b = bloom(k); for (const [x, y] of gsTeeth) k.c.circle(x, y, 1.4 + 0.6 * b).fill({ color: SEA, alpha: k.q === 2 ? 0.34 : 0.18 }); } glitter(k, [[5.0, -30], [-5.0, -20], [0, -52], [3.0, 13]]); }
function fxGreataxe(k: K): void { haze(k, 11.0, -33, 4.6, 10, SEA, 0.1); glitter(k, [[12.6, -40], [10.6, -22], [-9.6, -38], [0.4, -53]]); }
function fxMace(k: K): void { glowSpot(k, 0.2, -28.8, 1.2 + 0.7 * bloom(k), SEA, true); haze(k, 0.2, -27.6, 6, 4.6, SEA, 0.12); glitter(k, [[4.6, -30.6], [-4.4, -27.6], [0.2, -34.0], [5.6, -22]]); }
function fxXbow(k: K): void { for (const s of [-1, 1]) glowSpot(k, s * 13.0, -12, 1.1, SEA, true); glitter(k, [[14.6, -14], [-14.6, -14], [0, -29]]); }
function fxHand(k: K): void { for (const s of [-1, 1]) glowSpot(k, s * 9.6, -6, 0.9, SEA, true); glitter(k, [[11.0, -8], [-11.0, -8]], 1.4, 2); }
function fxShield(k: K): void { glowSpot(k, 0, 6.4, 1.5 + 0.7 * bloom(k), SEA, true); haze(k, 0, 6.4, 7, 6, SEA, 0.12); glitter(k, [[8.6, 11], [-7.0, 10], [11.4, -2], [-10.4, 3]]); }
function fxQuiver(k: K): void { glowSpot(k, 3.6, -2.4, 1.0 + 0.5 * bloom(k), SEA, true); glitter(k, [[-3.0, 14.6], [4.4, -12], [-2.0, -20]], 1.6, 3); }
// the float keeps its netting readable: a small lit core and the lit rim of the glass, not a white-out
function fxOrb(k: K): void { glowSpot(k, 0.8, 1.6, 1.3 + 0.9 * bloom(k), SEA, true); glowLine(k, arcAt(0, 0, 7.0, 0.2, 2.4, 8), 0.45 + 0.3 * bloom(k), SEA, true, GLASS); haze(k, 0, 0, 10, 10, SEA, 0.1); glitter(k, [[7.4, -6], [-8.0, 2], [4.2, 9], [0, -12]]); }

export const BRINEKEEPER: SeriesInfo = {
  id: 'brinekeeper', gen: 2, name: 'Brinekeeper', maker: 'Saltwind brine keepers, Sablefen ferriers, the Lockglass cistern', zones: 'Sablefen, Saltwind Pans, Lockglass Cistern', levels: '25–36',
  shape: 'long, lean and tapering; whip curves; black whippings; hard little cubes as accents',
  palette: [{ name: 'driftwood', hex: DRIFT }, { name: 'tar', hex: TAR }, { name: 'oilskin', hex: OILSKIN }, { name: 'brine salt', hex: BRINE }, { name: 'Lockglass', hex: GLASS }, { name: 'sea-glass (light)', hex: SEA }],
  motif: 'cubic salt crystals grown at the ends; tarred whipping at every binding',
  late: 'pink brine-grown crystal clusters; a glass float netted under a ferry hook',
  effects: 'salt glitter turning in the light, a sea-spray mist, the Lockglass float and beads lit sea-glass; shard impacts',
  draw: {
    blade: withFx(sword, fxSword), axe: withFx(axe, fxAxe), bow: withFx(bow, fxBow), staff: withFx(staff, fxStaff), wand: withFx(wand, fxWand),
    greatblade: withFx(greatsword, fxGreatsword), greataxe: withFx(greataxe, fxGreataxe), mace: withFx(mace, fxMace), crossbow: withFx(crossbow, fxXbow),
    handxbow: withFx(handxbow, fxHand), shield: withFx(shield, fxShield), quiver: withFx(quiver, fxQuiver), orb: withFx(orb, fxOrb),
  },
};
