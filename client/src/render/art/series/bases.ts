// The depth-wave held bases in the maker series (docs/rework/gear/ART-DIRECTION.md §7): each base has its OWN
// silhouette (a cleaver is not an axe, a maul not a great axe, a censer not a staff …), drawn once and dressed per series
// in that band's materials, its motif at the junction (the armour badge) and its effect language (embers, salt glitter,
// lamp glints, signal motes, rune chips, prismatic glints). One drawing per base × seven palettes — a first pass, less
// bespoke than the family pieces where each series has its own object; labelled so in the bible.
// Hand-local frame as every held drawing: grip at the origin, business end towards −y (bows: limbs along ±y, the rig
// ties the string at (−2.4, ±21)); off-hand bases in their family's frame (warhorn / trap kit like a quiver, tome like
// an orb).
import { accentOf, bloom, disc, float, fxCount, glowLine, glowSpot, haze, jit, lash, mote, pole, qpts, ribbon, ring, slab, bevel, stone, type K, type MoteShape } from './kit';
import { ARMOUR_SERIES, badge, type Fit } from './armour';
import { light, mix, shade } from '../util';
import { OUT } from '../draw';

interface Pal { metal: number; edge: number; wood: number; wrap: number; fit: number; accent: number; light: number; horn: number }
/** Weapon palettes of the seven series (their weapon files' own constants). */
const PAL: readonly Pal[] = [
  { metal: 0x777d83, edge: 0xd6dad6, wood: 0xc08f58, wrap: 0xc4a46c, fit: 0x5e6268, accent: 0xb8432e, light: 0, horn: 0xd8c8a8 },
  { metal: 0x403a3a, edge: 0xb8b4ae, wood: 0x7a6450, wrap: 0x4e3a30, fit: 0xb3603c, accent: 0x86b29c, light: 0xff8a3a, horn: 0xb3603c },
  { metal: 0xa8b2b8, edge: 0xe2e8ea, wood: 0xcdc3ac, wrap: 0x2c2b31, fit: 0xc29a4e, accent: 0xec9fad, light: 0x9ff0e0, horn: 0xe8dcc4 },
  { metal: 0xbac4cc, edge: 0xf0f4f6, wood: 0x5a4434, wrap: 0x2a3862, fit: 0xcaa14e, accent: 0xb3242c, light: 0xffd27a, horn: 0xeee6d6 },
  { metal: 0x2e3a5c, edge: 0xc8d2e8, wood: 0x5a6c94, wrap: 0x2e3a5c, fit: 0xc47a4c, accent: 0xe8e0c8, light: 0xc2a8ff, horn: 0xc47a4c },
  { metal: 0x544a62, edge: 0xa79cb6, wood: 0x7c708a, wrap: 0xdcd3c2, fit: 0xdcd3c2, accent: 0xb0a4ba, light: 0xff4a9a, horn: 0xdcd3c2 },
  { metal: 0xb4783a, edge: 0xe0aa5e, wood: 0x7a4a22, wrap: 0x7a4a22, fit: 0xe2c070, accent: 0x5fa8a2, light: 0x96ffec, horn: 0xb4783a },
];
const PRISM = [0xff9ad8, 0xfff2a0, 0x9ff0ff, 0xc8b0ff];

let G = 0; // series of the drawing in progress (set by the dispatcher)
const P = () => PAL[G];
/** Plain Array copper is verdigris. */
const fitCol = (k: K) => (G === 4 && k.q === 0 ? 0x5f9f8a : P().fit);
const fitOfK = (k: K): Fit => { const S = ARMOUR_SERIES[G]; return { S, gen: G, q: k.q, lit: !!S.light && k.q >= 2, acc: accentOf(k), top: 0, special: false, motif: null, seed: k.seed }; };

/** The series badge at the junction (paint pass: it inks itself), plus its light. */
function motif(k: K, x: number, y: number, r: number): void {
  if (k.pass === 'paint') badge(k.c, fitOfK(k), x, y, r);
  if (P().light && k.q >= 2) glowSpot(k, x, y, r * 0.35, P().light, true);
}

/** The series' effect language around a drawing: its lit edge (rare / strong pieces) and motes at the given spots. */
function fx(k: K, edge: number[] | null, spots: [number, number][], centre: [number, number], hazeR = 0): void {
  const L = P().light;
  if (!L || k.fx <= 0) return;
  if (edge) glowLine(k, edge, 0.4 + 0.3 * bloom(k), L, k.q >= 2 || k.fx > 0.8, P().metal);
  if (hazeR && G >= 5) haze(k, centre[0], centre[1], hazeR, hazeR, L, 0.1);
  const n = fxCount(k, 2, 4);
  const shape: MoteShape = G === 1 ? 'dot' : G === 5 ? 'diamond' : 'spark';
  for (let i = 0; i < n; i++) {
    const [x, y] = spots[i % spots.length];
    const col = G === 6 ? PRISM[(i + k.seed) % 4] : G === 2 && i % 2 ? 0xf3efe8 : L;
    if (G === 4) mote(k, centre[0], centre[1], 0.6, col, 'spark', { orbit: Math.hypot(x - centre[0], y - centre[1]), spin: 1.1 + 0.3 * i, phase: (i / n) * Math.PI * 2, bob: 0 });
    else mote(k, x + jit(k.seed, i, 0.8), y + jit(k.seed, i + 3, 0.8), G === 1 ? 0.55 : 0.6, col, shape, { bob: G === 1 ? 2.4 : 0.6, spin: G === 1 ? 0 : 2 + 0.3 * i, phase: i * 1.7 });
  }
}

/** A grip: the series' wrap over the haft. */
function grip(k: K, y0: number, y1: number, w: number): void {
  lash(k, 0, y0, y1, w, P().wrap, { gap: 1.2, slant: 0.5, bulge: 0.2 });
}

// ── cleaver: a broad square chopping blade with a hanging hole, riveted to a short handle ──
function cleaver(k: K): void {
  const p = P();
  pole(k, [0, 7.4, 0, -9.0], 2.8, p.wood);
  grip(k, 6.6, 0.4, 3.2);
  const blade = [-2.2, -8.6, 9.8, -11.0, 11.2, -27.4, -1.2, -28.6];
  bevel(k, blade, [-2.2, -8.6, 4.0, -9.8, 4.6, -28.0, -1.2, -28.6], p.metal, { edge: [10.0, -11.8, 11.2, -26.6], edgeCol: p.edge });
  disc(k, 1.6, -25.2, 1.5, 1.5, 0x1b1410, { line: 0.5, inner: true });
  for (const y of [-11.4, -16.6, -21.8]) disc(k, 0.4, y, 0.8, 0.8, light(p.metal, 0.3), { line: 0.4, inner: true });
  if (k.q >= 1) slab(k, [-2.4, -9.6, -0.6, -9.6, -0.2, -27.8, -1.6, -27.9], fitCol(k), { line: 0.5, inner: true });
  motif(k, 0.2, -7.2, 2.4);
  stone(k, 0, 7.8, 0.9, fitCol(k));
  fx(k, [10.0, -11.8, 11.2, -26.6], [[13.4, -16], [12.6, -26], [4, -31]], [5, -19], 0);
  k.anchor = { x: 0.2, y: -7.2, r: 2.4 };
}

// ── maul: a two-handed sledge — a heavy block head across a long haft, banded and wedged ──
function maul2h(k: K): void {
  const p = P();
  pole(k, [0, 11.6, 0, -38.6], 3.2, p.wood);
  grip(k, 10.4, 1.4, 3.6);
  grip(k, -10.4, -15.6, 3.6);
  const head = [-9.6, -48.4, 9.6, -48.4, 10.4, -46.6, 10.4, -37.4, 9.6, -35.6, -9.6, -35.6, -10.4, -37.4, -10.4, -46.6];
  bevel(k, head, [-9.6, -48.4, 0, -48.4, 0, -35.6, -9.6, -35.6, -10.4, -37.4, -10.4, -46.6], p.metal, { edge: [10.0, -46.8, 10.0, -37.2], edgeCol: p.edge });
  for (const x of [-6.2, 6.2]) slab(k, [x - 1.1, -48.8, x + 1.1, -48.8, x + 1.1, -35.2, x - 1.1, -35.2], fitCol(k), { line: 0.6 });
  if (k.q >= 2) for (const x of [-10.8, 10.8]) slab(k, [x - 0.6 * Math.sign(x), -45.2, x + 1.4 * Math.sign(x), -44.4, x + 1.4 * Math.sign(x), -39.6, x - 0.6 * Math.sign(x), -38.8], light(p.metal, 0.15), { line: 0.6 });
  slab(k, [-2.4, -35.4, 2.4, -35.4, 2.0, -31.0, -2.0, -31.0], fitCol(k), { line: 0.6 });
  motif(k, 0, -42.0, 3.0);
  stone(k, 0, -29.6, 1.0, fitCol(k));
  fx(k, [10.0, -46.8, 10.0, -37.2], [[13.6, -45], [-13.4, -40], [0, -52]], [0, -42], 9);
  k.anchor = { x: 0, y: -33.0, r: 2.6 };
}

// ── polearm: a glaive — a long single-edged blade continuing the haft, a back hook, a tasselled collar ──
function polearm(k: K): void {
  const p = P();
  pole(k, [0, 11.6, 0, -36.0], 2.8, p.wood);
  grip(k, 10.4, 2.4, 3.2);
  for (const y of [-12, -24]) ring(k, 0, y, 1.9, 0.7, 0.9, fitCol(k));
  const blade = [-1.8, -35.6, 2.4, -36.0, 6.0, -43.0, 7.6, -51.0, 3.6, -58.6, 1.6, -52.0, -1.6, -44.0];
  bevel(k, blade, [-1.8, -35.6, 0.6, -35.8, 2.6, -46.0, 3.6, -58.6, 1.6, -52.0, -1.6, -44.0], p.metal, { edge: [3.0, -37.0, 6.6, -43.6, 7.0, -50.6, 4.2, -56.6], edgeCol: p.edge });
  slab(k, [-1.6, -41.6, -7.4, -44.0, -6.6, -40.6, -2.0, -39.6], p.metal, { line: 0.7 });
  slab(k, [-2.6, -36.4, 2.6, -36.4, 2.4, -32.0, -2.4, -32.0], fitCol(k), { line: 0.6 });
  if (k.q >= 1) for (let i = 0; i < 3; i++) pole(k, [-2.4 + i * 1.2, -32.2, -3.6 + i * 1.6, -26.4 - (i % 2) * 1.6], 0.8, G === 3 ? 0xb3242c : p.accent, { flat: true });
  motif(k, 0, -34.2, 2.2);
  stone(k, 0, -30.6, 0.9, fitCol(k));
  fx(k, [3.0, -37.0, 6.6, -43.6, 7.0, -50.6, 4.2, -56.6], [[10, -46], [8, -56], [-9, -43]], [3, -47], 8);
  k.anchor = { x: 0, y: -32.0, r: 2.4 };
}

// ── sling: a short staff-sling grip, two cords and a cupped pouch holding the shot (the shot carries the light) ──
function sling(k: K): void {
  const p = P();
  pole(k, [0, 4.6, 0, -6.4], 2.6, p.wood);
  grip(k, 3.8, -1.6, 3.0);
  disc(k, 0, -7.0, 1.8, 1.4, fitCol(k), { line: 0.6 });
  const cordA = qpts(0, -7.4, -5.6, -11.6, -2.6, -16.0, 8), cordB = qpts(0, -7.4, 5.6, -11.6, 2.6, -16.0, 8);
  pole(k, cordA, 0.7, G === 2 ? 0x2c2b31 : p.wrap, { flat: true, curve: true });
  pole(k, cordB, 0.7, G === 2 ? 0x2c2b31 : p.wrap, { flat: true, curve: true });
  slab(k, [-3.4, -15.0, 3.4, -15.0, 2.4, -18.6, -2.4, -18.6], shade(p.wrap === 0x2c2b31 ? 0x6a5040 : p.wrap, 0.05), { smooth: true, line: 0.8 });
  const shot = k.q >= 2 && p.light ? mix(p.metal, p.light, 0.4) : p.metal;
  disc(k, 0, -17.6, 1.9, 1.9, shot, { line: 0.7 });
  if (p.light && k.q >= 2) glowSpot(k, 0, -17.6, 0.8, p.light, true);
  motif(k, 0, -3.4, 1.6);
  fx(k, null, [[3.4, -21], [-3.6, -19], [0, -23]], [0, -17.6], 0);
  k.anchor = { x: 0, y: -7.0, r: 2 };
}

// ── longbow: tall near-straight limbs of one stave, a wrapped grip, horn nocks; the series' fitting at the grip ──
function longbow(k: K): void {
  const p = P();
  for (const s of [-1, 1]) {
    const cl = qpts(2.6, s * 4.2, 5.6, s * 13.0, -2.4, s * 21.4, 14);
    const n = cl.length / 2, ws: number[] = []; for (let i = 0; i < n; i++) ws.push(3.4 - (i / (n - 1)) * 2.0);
    slab(k, ribbon(cl, ws), p.wood, { line: 0.9 });
    if (k.pass === 'paint') k.c.poly(ribbon(cl, ws, 0, s > 0 ? -1 : 0.2, s > 0 ? -0.2 : 1), true).fill(light(p.wood, 0.25));
    disc(k, -2.4, s * 21.6, 1.2, 1.2, p.horn, { line: 0.6 });
    if (k.q >= 1) ring(k, cl[16], cl[17], 1.9, 0.8, 0.9, fitCol(k));
  }
  slab(k, [0.8, -4.6, 4.6, -4.6, 4.6, 4.6, 0.8, 4.6], p.wrap, { line: 0.8 });
  if (k.pass === 'paint') for (const y of [-3.2, -0.6, 2.0]) k.c.rect(0.8, y, 3.8, 0.8).fill(light(p.wrap, 0.2));
  motif(k, 6.4, 0, 2.2);
  if (!k.rig) pole(k, [-2.4, -21, -2.4, 21], 0.55, 0xe8dcc0, { flat: true });
  fx(k, null, [[7.2, -12], [7.2, 12], [5.6, -20]], [3, 0], 0);
  k.anchor = { x: 2.6, y: -5.0, r: 2.2 };
}

// ── rod: a straight metal rod banded along its length, a heavy lodestone knob at the tip ──
function rod(k: K): void {
  const p = P();
  pole(k, [0, 6.4, 0, -14.6], 2.2, p.metal);
  grip(k, 5.8, 0.6, 2.6);
  for (const y of [-3.6, -8.4, -13.2]) slab(k, [-1.6, y - 0.6, 1.6, y - 0.6, 1.6, y + 0.6, -1.6, y + 0.6], fitCol(k), { line: 0.5 });
  disc(k, 0, -18.4, 3.4, 3.4, k.q >= 2 && p.light ? mix(shade(p.metal, 0.2), p.light, 0.25) : shade(p.metal, 0.2), { line: 0.9 });
  if (k.pass === 'paint') k.c.ellipse(-1.1, -19.6, 1.2, 0.8).fill({ color: 0xffffff, alpha: 0.5 });
  if (p.light && k.q >= 1) glowSpot(k, 0, -18.4, k.q >= 2 ? 1.0 : 0.6, p.light, true);
  motif(k, 0, -14.8, 1.8);
  stone(k, 0, 6.8, 0.8, fitCol(k));
  fx(k, null, [[4.6, -21], [-4.4, -18], [0, -24]], [0, -18.4], 0);
  k.anchor = { x: 0, y: -14.8, r: 2 };
}

// ── sceptre: a short shaft under an open crown of arched bands holding a small orb ──
function sceptre(k: K): void {
  const p = P();
  pole(k, [0, 6.6, 0, -12.6], 2.4, p.wood === 0x7c708a ? p.wood : p.fit);
  grip(k, 6.0, 1.0, 2.8);
  disc(k, 0, 7.2, 1.6, 1.2, fitCol(k), { line: 0.6 });
  slab(k, [-3.2, -12.4, 3.2, -12.4, 2.6, -14.2, -2.6, -14.2], fitCol(k), { line: 0.7 });
  const orbCol = k.q >= 2 && p.light ? mix(p.accent, p.light, 0.4) : p.accent;
  disc(k, 0, -18.2, 2.8, 2.8, orbCol, { line: 0.8 });
  if (p.light && k.q >= 2) glowSpot(k, 0, -18.2, 0.9, p.light, true);
  for (const s of [-1, 1]) pole(k, qpts(s * 2.8, -14.0, s * 5.4, -19.0, 0, -23.4, 6), 1.1, fitCol(k), { curve: true });
  disc(k, 0, -24.0, 1.1, 1.1, fitCol(k), { line: 0.6 });
  motif(k, 0, -10.2, 1.6);
  fx(k, null, [[5.6, -21], [-5.4, -18], [0, -27]], [0, -18], 0);
  k.anchor = { x: 0, y: -10.2, r: 2 };
}

// ── censer: a tall staff with a hook; the censer pot hangs on its chain and swings (a structural float) ──
function censer(k: K): void {
  const p = P();
  pole(k, [0, 22.6, 0, -44.0], 2.6, p.wood);
  grip(k, 6.0, -2.0, 3.0);
  for (const y of [18.4, -30.0]) ring(k, 0, y, 1.9, 0.7, 0.9, fitCol(k));
  pole(k, qpts(0, -44.0, 7.6, -48.6, 9.0, -41.6, 8), 1.6, fitCol(k), { curve: true });
  motif(k, 0, -33.6, 2.0);
  // the pot hangs from the hook (in the float's own frame, the chain runs up to the hook); the float is drawn later
  // by the rig, so it captures its colours now
  const fc = fitCol(k), metal = p.metal, L = p.light;
  float(k, 9.0, -41.6, (kk) => {
    pole(kk, [0, 0, 0, 6.4], 0.6, fc, { flat: true });
    const pot = [-3.6, 7.0, 3.6, 7.0, 4.2, 10.4, 2.6, 13.6, -2.6, 13.6, -4.2, 10.4];
    slab(kk, pot, metal, { line: 0.8, hi: [[-3.4, 8.0, -3.6, 11.4]] });
    if (kk.pass === 'paint') for (const x of [-2, 0, 2]) kk.c.circle(x, 10.4, 0.55).fill(kk.q >= 1 && L ? light(L, 0.3) : 0x1b1410);
    slab(kk, [-2.6, 7.2, 2.6, 7.2, 0, 4.6], fc, { line: 0.6 });
    if (L && kk.q >= 1) glowSpot(kk, 0, 10.4, kk.q >= 2 ? 1.6 : 1.0, L, true);
  }, { bob: 0.6, phase: 0.4, glow: L && k.q >= 2 ? L : 0, glowR: 4 });
  // smoke / embers rise from the pot (decorative)
  fx(k, null, [[9.4, -37], [8.0, -31], [10.6, -27]], [9, -32], 0);
  if (p.light && k.fx > 0) haze(k, 9.0, -31.0, 4.4, 4.4, p.light, 0.1);
  k.anchor = { x: 0, y: -33.6, r: 2.2 };
}

// ── warhorn: a curved horn banded in the series' metal, slung on a baldric (worn where a quiver sits) ──
function warhorn(k: K): void {
  const p = P();
  pole(k, qpts(-4.6, -11.0, -7.6, 2.0, -2.6, 13.0, 8), 0.9, G === 2 ? 0x2c2b31 : p.wrap, { flat: true, curve: true });
  const outer = qpts(5.4, -12.4, -6.0, -2.0, -1.2, 12.6, 12), inner = qpts(-0.4, -12.8, -3.0, -1.6, 0.6, 12.2, 12);
  const rev: number[] = []; for (let i = inner.length - 2; i >= 0; i -= 2) rev.push(inner[i], inner[i + 1]);
  const body: number[] = [];
  const n = outer.length / 2;
  for (let i = 0; i < n; i++) { const t = i / (n - 1), w = 0.5 + (1 - t) * 0.5; body.push(inner[i * 2] + (outer[i * 2] - inner[i * 2]) * w, inner[i * 2 + 1] + (outer[i * 2 + 1] - inner[i * 2 + 1]) * w); }
  slab(k, [...body, ...rev], p.horn, { smooth: true, line: 0.9, hi: [[2.6, -11.6, -2.0, -2.0]] });
  for (const t of [0.25, 0.55, 0.85]) {
    const i = Math.round(t * (n - 1));
    pole(k, [inner[i * 2], inner[i * 2 + 1], body[i * 2], body[i * 2 + 1]], 1.4, fitCol(k));
  }
  disc(k, 2.6, -12.6, 3.1, 1.2, shade(p.horn, 0.35), { line: 0.8 });
  disc(k, -0.2, 12.6, 1.0, 1.0, fitCol(k), { line: 0.6 });
  motif(k, -3.4, -1.0, 2.0);
  fx(k, null, [[5.6, -15], [0, -17], [7.4, -9]], [2.6, -13], 0);
  if (p.light && k.q >= 2) glowSpot(k, 2.6, -12.6, 1.2, p.light, true);
  k.anchor = { x: -3.4, y: -1.0, r: 2 };
}

// ── trap kit: a satchel with a flap, a jaw trap strapped to its face, a coil of snare wire ──
function trapKit(k: K): void {
  const p = P();
  const bagCol = G === 2 ? 0xe2b22e : G === 3 ? 0x5a4434 : G === 5 ? 0x3e3648 : mix(p.wrap, 0x6a5040, 0.4);
  slab(k, [-5.6, -8.0, 5.6, -8.0, 6.2, 9.6, 4.2, 11.4, -4.2, 11.4, -6.2, 9.6], bagCol, { smooth: true, line: 0.9, hi: [[-4.6, -6.4, -5.0, 8.4]] });
  slab(k, [-5.8, -8.4, 5.8, -8.4, 5.2, -1.6, 0, 0.6, -5.2, -1.6], shade(bagCol, 0.12), { line: 0.8 });
  // the jaw trap: two toothed half-rings on a plate
  ring(k, 0, 5.4, 4.4, 2.8, 1.2, p.metal, { a0: Math.PI, a1: Math.PI * 2 });
  ring(k, 0, 5.4, 4.4, 2.8, 1.2, p.metal, { a0: 0, a1: Math.PI });
  if (k.pass === 'paint') for (let i = 0; i < 7; i++) { const a = Math.PI + (i + 0.5) * (Math.PI / 7); k.c.poly([Math.cos(a) * 4.2, 5.4 + Math.sin(a) * 2.6, Math.cos(a) * 3.0, 5.4 + Math.sin(a) * 1.6, Math.cos(a + 0.2) * 4.2, 5.4 + Math.sin(a + 0.2) * 2.6], true).fill(light(p.metal, 0.4)); }
  disc(k, 0, 5.4, 1.2, 0.9, fitCol(k), { line: 0.6 });
  ring(k, 5.8, -3.0, 2.2, 2.2, 0.7, light(p.metal, 0.2));
  ring(k, 5.8, -3.0, 1.4, 1.4, 0.6, light(p.metal, 0.2));
  pole(k, [-4.4, -8.6, -6.4, -15.4], 0.9, G === 2 ? 0x2c2b31 : p.wrap, { flat: true });
  motif(k, 0, -3.4, 2.0);
  fx(k, null, [[7.4, -8], [-7.4, -2], [0, -12]], [0, 2], 0);
  k.anchor = { x: 0, y: -3.4, r: 2 };
}

// ── tome: a bound book, clasped in the series' fitting; a glyph on the cover takes the light on rare pieces ──
function tome(k: K): void {
  const p = P();
  const cover = G === 0 ? 0x7a5230 : G === 1 ? 0x4e3a30 : G === 2 ? 0xe2b22e : G === 3 ? 0xb3242c : G === 4 ? 0x5a6c94 : G === 5 ? 0x544a62 : 0x3c5a58;
  slab(k, [-7.0, -7.8, 6.2, -8.6, 7.4, 7.6, -6.0, 8.6], 0xe8dcc0, { line: 0.9 });
  slab(k, [-7.6, -8.4, 5.6, -9.4, 6.8, 7.0, -6.6, 8.0], cover, { line: 0.9, hi: [[-6.4, -7.2, -5.6, 6.6]] });
  slab(k, [-7.6, -8.4, -5.2, -8.6, -4.2, 8.2, -6.6, 8.0], shade(cover, 0.25), { line: 0.6 });
  for (const y of [-5.2, 4.4]) slab(k, [5.4, y - 1.0, 8.8, y - 1.2, 9.0, y + 1.0, 5.6, y + 1.2], fitCol(k), { line: 0.6 });
  const lit = !!p.light && k.q >= 2;
  if (k.pass === 'paint') { k.c.circle(0.4, -0.6, 3.4).stroke({ width: 0.8, color: lit ? light(p.light, 0.3) : shade(cover, 0.4) }); k.c.poly([0.4, -3.4, 2.6, 1.0, -1.8, 1.0], true).stroke({ width: 0.7, color: lit ? light(p.light, 0.3) : shade(cover, 0.4) }); }
  if (lit) glowLine(k, [0.4, -3.4, 2.6, 1.0, -1.8, 1.0, 0.4, -3.4], 0.5 + 0.3 * bloom(k), p.light, true, cover);
  motif(k, 0.4, -0.6, 1.6);
  fx(k, null, [[8.6, -9], [-8.4, -6], [0, -12]], [0, 0], 9);
  k.anchor = { x: 0.4, y: -0.6, r: 2.2 };
}

/** Base art shape → its drawing (the series is set by the dispatcher). */
export const BASE_ART: Readonly<Record<string, (k: K) => void>> = {
  cleaver, maul2h, polearm, sling, longbow, rod, sceptre, censer, warhorn, trap_kit: trapKit, tome,
};
/** Dispatch: run a base drawing in series `gen`. */
export function baseDraw(shape: string, gen: number): ((k: K) => void) | null {
  const d = BASE_ART[shape];
  if (!d) return null;
  return (k) => { const prev = G; G = Math.max(0, Math.min(PAL.length - 1, gen)); try { d(k); } finally { G = prev; } };
}

void OUT; void ring;
