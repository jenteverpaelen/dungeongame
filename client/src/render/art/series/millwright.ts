// Series G0 · Millwright (item levels 1–12): Rillwake mill, Bracken sluice, Reedvault pumpworks, Cairnspill road.
// Made by people who build wheels and sluice gates: birch with the bark on, strap iron, square pegs, hemp lashings and
// the mill's red paint (Orren's red cap band, CAST.md). Tools turned into weapons, so: single edges, square ends,
// repairs, asymmetry and wear (rule A3). No light at all (R6). Maker's mark: a stamped six-spoke wheel.
import type { SeriesInfo } from './index';
import { bead, detail, disc, jit, lash, peg, pole, qpts, ribbon, ring, rivet, slab, bevel, float, type K } from './kit';
import { mix, shade } from '../util';

const BIRCH = 0xe2d6bc, LENT = 0x4a3e36, HEART = 0xc08f58, STRAP = 0x777d83, EDGE = 0xd6dad6, RUST = 0x9c5a3a;
const CORD = 0xc4a46c, RED = 0xb8432e, LEATHER = 0x7a5230;

/** Stamped mill-wheel mark (rare: filled with the mill's red). */
function millMark(k: K, x: number, y: number, r: number, on: number): void {
  if (k.pass !== 'paint') return;
  const c = k.c, col = k.q >= 2 ? RED : shade(on, 0.55);
  c.circle(x, y, r).stroke({ width: 0.6, color: col });
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI; c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r).lineTo(x - Math.cos(a) * r, y - Math.sin(a) * r); }
  c.stroke({ width: 0.5, color: col });
}

/** Birch bark marks: short dark horizontal lenticels across a vertical-ish part. */
function lenticels(k: K, x: number, y0: number, y1: number, w: number, seed: number): void {
  // birch: scattered thin horizontal streaks of uneven length, the odd dark knot where a twig was
  for (let i = 0, y = y0; y > y1; i++, y -= 1.7 + Math.abs(jit(seed, i, 1.6))) {
    const long = Math.abs(jit(seed, i + 5, 1)) > 0.55;
    const l = w * (long ? 0.55 + Math.abs(jit(seed, i + 3, 0.15)) : 0.2 + Math.abs(jit(seed, i + 3, 0.1)));
    const dx = jit(seed, i + 9, (w - l) * 0.45);
    detail(k, [x + dx - l / 2, y, x + dx + l / 2, y + 0.15], LENT, long ? 0.45 : 0.55, 0.85);
    if (i % 7 === 3) detail(k, [x + dx - 0.5, y - 0.9, x + dx, y - 1.5, x + dx + 0.5, y - 0.9, x + dx, y - 0.4, x + dx - 0.5, y - 0.9], LENT, 0.7, 0.9);
  }
}

// ── sword: a riving knife cut from a broken mill saw (single edge, saw teeth left on the spine) ──
function sword(k: K): void {
  const q = k.q;
  k.anchor = { x: 0.5, y: -5.4, r: 2.6 };
  // blade (spine at -x, edge at +x)
  const nick = q === 0 ? [3.5, -19.0, 2.5, -17.9, 3.4, -16.9] : [3.55, -18];
  // a sheepsfoot point: the edge runs straight out, the back curves down to meet it (a tool's point, not a dagger's)
  const out = [-2.5, -5.6, -2.6, -25.6, -2.0, -28.6, -0.4, -30.6, 1.8, -31.6, 3.5, -31.4, 3.5, -25.2, ...nick, 3.6, -6.2, 3.1, -5.6];
  const litHalf = [-2.5, -5.6, -2.6, -25.6, -2.0, -28.6, -0.4, -30.6, 1.5, -31.3, 1.5, -27.6, 1.6, -5.6];
  // saw teeth on the spine (uneven on normal pieces, filed even on rare)
  const teeth = q === 0 ? [-11.4, -14.2, -17.2, -20.1, -23.0] : q === 1 ? [-11.2, -13.9, -16.6, -19.3, -22, -24.7] : [-11, -13.3, -15.6, -17.9, -20.2, -22.5, -24.8];
  teeth.forEach((y, i) => {
    // saw teeth lean towards the tip; on a worn piece one is snapped off
    const h = q === 0 ? (i === 2 ? 0.7 : 2.3 + jit(k.seed, i, 0.35)) : q === 1 ? 2.0 : 1.7;
    slab(k, [-2.4, y + 1.35, -2.55 - h, y - 0.9, -2.4, y - 1.2], i % 2 ? shade(STRAP, 0.12) : STRAP, { line: 0.7, flat: true });
  });
  bevel(k, out, litHalf, STRAP, { ridge: [1.55, -6.2, 1.45, -27.4], edge: q === 0 ? [2.95, -30.6, 2.95, -19.6] : [2.95, -30.6, 3.15, -6.6], edgeCol: EDGE });
  if (q === 0) {
    detail(k, [2.95, -16.2, 3.1, -6.6], EDGE, 0.9);
    for (const [x, y] of [[0.5, -21.5], [-1.2, -27.0]]) detail(k, [x, y, x + 0.7, y - 0.35, x + 0.35, y + 0.4], RUST, 0.9, 0.8);
  }
  // the saw's old bolt holes (worn pieces keep them open; restored ones carry the stamped wheel instead)
  if (q < 2) for (const y of [-8.6, -12.4]) { if (k.pass === 'paint') { k.c.circle(-0.6, y, 0.75).fill(0x1b1410); k.c.circle(-0.45, y + 0.15, 0.45).fill(shade(STRAP, 0.5)); } }
  if (q >= 1) millMark(k, -0.3, -17.2, 1.3, STRAP);
  // bolster / strap guard
  if (q === 2) slab(k, [-4.6, -4.6, 5.0, -4.6, 6.6, -7.8, 5.4, -8.2, 4.4, -6.4, -4.6, -6.4], STRAP, { hi: [[-4, -5.9, 3.8, -5.9]] });
  else slab(k, [-3.4, -4.3, 4.0, -4.3, 3.8, -6.3, -3.2, -6.3], shade(STRAP, 0.1), { hi: [[-2.8, -5.8, 3.2, -5.8]] });
  // birch scales
  const grip = [-2.0, -4.4, 2.4, -4.4, 2.2, 4.6, 1.6, 5.9, -1.6, 5.9, -2.0, 4.6];
  slab(k, grip, BIRCH, { hi: [[-1.4, -3.6, -1.4, 4.6]] });
  lenticels(k, 0.2, 4.6, -3.6, 3.6, k.seed + 3);
  rivet(k, 0.2, -1.4, 0.75, STRAP); rivet(k, 0.2, 2.8, 0.75, STRAP);
  if (q === 0) lash(k, 0.2, -4.2, -2.2, 4.3, CORD);
  // butt
  if (q === 0) peg(k, 0.1, 5.2, 1.3, HEART);
  else slab(k, [-2.1, 5.4, 2.5, 5.4, 2.3, 7.2, -1.9, 7.2], STRAP, { line: 0.8 });
  if (q === 2) { slab(k, [-2.05, 3.0, 2.3, 3.0, 2.25, 4.4, -2.0, 4.4], RED, { line: 0.6, flat: true }); pole(k, [0.2, 7.2, 0.2, 7.6], 0.6, STRAP); disc(k, 0.2, 9, 1.6, 1.4, STRAP, { line: 0.7 }); disc(k, 0.2, 9, 0.7, 0.6, 0x2a2420, { hi: false, line: 0, inner: true }); }
  bead(k, 3.6, -4.8, 3.4, -0.5, CORD);
}

// ── axe: a felling hatchet, wedge in the eye, square poll ──
function axe(k: K): void {
  const q = k.q;
  // haft (a little crooked on normal pieces), worn to heartwood where the hand goes
  const haft = q === 0 ? [0.6, 7.6, 1.9, -8, -0.3, -27.2] : [0.3, 7.6, 1.0, -8, -0.1, -27.2];
  pole(k, haft, 3.1, BIRCH, { curve: true });
  if (k.pass === 'paint') { const hw = ribbon(qpts(haft[0], haft[1], haft[2], haft[3], haft[4], haft[5], 8).slice(0, 8), 2.6); slab(k, hw, HEART, { line: 0, inner: true, flat: true }); }
  lenticels(k, 0.7, -2, -15, 2.6, k.seed + 1);
  if (q === 0) { lash(k, 0.5, -16.2, -13.6, 3.1, CORD); detail(k, [0.9, -11.5, 0.2, -6], LENT, 0.6, 0.8); }
  if (q === 2) slab(k, [-1.2, 2.2, 2.0, 2.2, 2.0, 4.4, -1.0, 4.4], RED, { line: 0.6, flat: true, inner: true });
  // langets (rare): strap iron running down the haft
  if (q === 2) for (const s of [-1, 1]) { slab(k, [s * 1.0 - 0.6, -18, s * 1.0 + 0.6, -18, s * 1.0 + 0.5, -10.4, s * 1.0 - 0.5, -10.4], STRAP, { line: 0.6 }); rivet(k, s * 1.0, -11.4, 0.5, STRAP); }
  // head: poll on -x, bit on +x with a beard
  const bit = q === 0 ? [10.6, -27.4, 11.4, -23.6, 10.5, -22.4, 11.6, -21.2, 9.9, -14.4] : [10.8, -27.6, 11.8, -21.6, 10.0, -14.2];
  const head = [-4.2, -24.6, -2.0, -25.6, 2.2, -25.4, ...bit, 2.2, -17.6, -2.0, -17.6, -4.2, -18.4];
  slab(k, head, STRAP, { inset: 0.8, hi: [[-3.6, -24.0, 1.8, -24.8, 9.6, -26.4]] });
  // the ground bevel along the bit: a pale band, brighter at the very edge
  if (k.pass === 'paint') {
    const bev = q === 0 ? [8.4, -26.9, 10.6, -27.4, 11.4, -23.6, 10.5, -22.4, 11.6, -21.2, 9.9, -14.4, 8.2, -15.8, 9.3, -21.4] : [8.6, -27.1, 10.8, -27.6, 11.8, -21.6, 10.0, -14.2, 8.3, -15.6, 9.7, -21.6];
    k.c.poly(bev, true).fill(mix(STRAP, EDGE, 0.55));
  }
  detail(k, q === 0 ? [10.1, -26.4, 10.7, -23.8] : [10.2, -26.6, 11.0, -21.6, 9.6, -15.6], EDGE, 1.1);
  if (q === 0) detail(k, [10.9, -20.4, 9.7, -15.6], EDGE, 1.1);
  detail(k, [-2.0, -25.2, -2.0, -18.0], shade(STRAP, 0.5), 0.6, 0.8); // poll seam
  if (q >= 1) millMark(k, 4.6, -21.4, 1.3, STRAP);
  if (q === 0) { detail(k, [3.6, -20, 4.8, -19.6], shade(STRAP, 0.5), 0.6); detail(k, [5.8, -23.2, 6.4, -22.9], RUST, 0.8, 0.8); }
  // the wedge in the eye: haft end split by a wooden (normal) or iron (magic+) wedge
  slab(k, [-1.5, -25.4, 1.5, -25.4, 1.1, -27.8, -1.1, -27.8], HEART, { line: 0.7 });
  pole(k, [0, -25.6, q >= 1 ? 0.2 : -0.3, -28.4], q >= 1 ? 0.9 : 0.7, q >= 1 ? STRAP : shade(HEART, 0.35), { flat: true, inner: true });
  k.anchor = { x: 0.6, y: -16.4, r: 2.4 };
  bead(k, 1.6, -16.4, 3.4, 0.6, CORD);
}

// ── bow: a birch self-bow with the bark left on its back; uneven limbs ──
function bow(k: K): void {
  const q = k.q;
  const up = qpts(-2.4, -21.4, q === 0 ? 6.6 : 6.2, -13.4, 2.9, -3.2, 12);
  const lo = qpts(-2.4, 21.2, 5.8, 12.8, 2.9, 3.2, 12);
  for (const [cl, w0, w1] of [[up, 1.4, 3.7], [lo, 1.55, 3.9]] as const) {
    slab(k, ribbon(cl, w0, w1), HEART, { line: 0, flat: true });
    if (k.pass === 'paint') {
      slab(k, ribbon(cl, w0, w1, -1, -0.15), mix(HEART, 0xfff4d6, 0.2), { line: 0, flat: true, inner: true });
      slab(k, ribbon(cl, w0, w1, 0.2, 1), BIRCH, { line: 0, flat: true, inner: true });
      slab(k, ribbon(cl, w0, w1, 0.72, 1), shade(BIRCH, 0.3), { line: 0, flat: true, inner: true });
      for (let i = 2; i < cl.length / 2 - 2; i += 2) { const x = cl[i * 2], y = cl[i * 2 + 1]; detail(k, [x + 0.7, y - 0.25, x + 1.5, y + 0.2], LENT, 0.6); }
      k.c.poly(ribbon(cl, w0, w1), true).stroke({ width: 0.9, color: 0x1b1410, join: 'round' });
    }
  }
  // grip
  if (q === 0) lash(k, 3.0, -3.6, 3.6, 3.9, CORD, { gap: 1.2 });
  else { lash(k, 3.0, -3.8, 3.8, 4.0, LEATHER, { gap: 1.9, slant: 0.2 }); if (q === 2) { slab(k, [0.9, 3.8, 5.1, 3.8, 5.0, 5.0, 1.0, 5.0], RED, { line: 0.6, flat: true }); millMark(k, 3.0, -1.2, 1.1, LEATHER); } }
  // nocks
  for (const s of [-1, 1]) {
    if (q === 2) slab(k, [-3.6, s * 21.6, -1.2, s * 21.0, -1.6, s * 19.0, -3.4, s * 19.4], STRAP, { line: 0.6 });
    else detail(k, [-3.2, s * 20.2, -1.6, s * 20.6], LENT, 0.8);
  }
  if (!k.rig) pole(k, [-2.4, -20.6, -2.4, 20.6], 0.7, mix(CORD, 0xffffff, 0.25), { flat: true });
  k.anchor = { x: 3.0, y: -4.2, r: 2.2 };
  bead(k, 4.6, -3.6, 3.4, -0.4, CORD);
}

// ── staff: a millrace pole with a paddle wheel turning on an iron fork ──
/** An undershot mill wheel seen face-on: a wooden rim on spokes, paddle boards standing out of the rim, iron hub. */
function wheel(k: K, q: 0 | 1 | 2): void {
  const n = q === 0 ? 7 : 8, R = 7.2, P = q === 2 ? 4.4 : 3.8;
  const spokes = q === 0 ? 3 : 4;
  for (let i = 0; i < spokes; i++) { const a = (i / spokes) * Math.PI + 0.2; pole(k, [Math.cos(a) * R, Math.sin(a) * R, -Math.cos(a) * R, -Math.sin(a) * R], 1.2, HEART, { flat: true }); }
  for (let i = 0; i < n; i++) {
    if (q === 0 && i === 4) continue; // a lost paddle
    const a = (i / n) * Math.PI * 2 + 0.05, ca = Math.cos(a), sa = Math.sin(a);
    const r0 = R - 0.6, r1 = R + P + (q === 0 ? jit(k.seed, i, 0.7) : 0), hw = 1.45 + (q === 0 ? jit(k.seed, i + 4, 0.25) : 0);
    const px = -sa * hw, py = ca * hw;
    slab(k, [ca * r0 + px, sa * r0 + py, ca * r1 + px, sa * r1 + py, ca * r1 - px, sa * r1 - py, ca * r0 - px, sa * r0 - py], q === 2 && i % 2 ? RED : BIRCH, { line: 0.75, hi: [[ca * r0 + px * 0.5, sa * r0 + py * 0.5, ca * r1 + px * 0.5, sa * r1 + py * 0.5]] });
  }
  ring(k, 0, 0, R, R, 2.2, q === 2 ? STRAP : HEART);
  disc(k, 0, 0, 2.3, 2.3, STRAP, { line: 0.8 });
  peg(k, 0, 0, 1.3, shade(STRAP, 0.25));
}
function staff(k: K): void {
  const q = k.q;
  // the pole runs up to the axle; the wheel turns on the side of its head (a pinwheel's mount, at mill scale)
  pole(k, q === 0 ? [0.6, 22, 2.2, -8, -0.3, -46.5] : [0.4, 22, 1.4, -8, -0.1, -46.5], 3.4, BIRCH, { curve: true });
  lenticels(k, 0.8, 17, -33, 3, k.seed + 5);
  if (q >= 1) slab(k, [-1.5, 19.6, 2.4, 19.6, 2.2, 23.0, -1.3, 23.0], STRAP, { line: 0.8 });
  if (q === 0) lash(k, -0.1, -38.4, -35.2, 3.4, CORD);
  else { slab(k, [-2.1, -38.2, 2.0, -38.2, 2.0, -35.2, -2.1, -35.2], STRAP, { hi: [[-1.6, -37.6, 1.4, -37.6]] }); rivet(k, -0.05, -36.7, 0.6, STRAP); }
  if (q === 2) { slab(k, [-1.5, 6.0, 2.3, 6.0, 2.25, 8.4, -1.45, 8.4], RED, { line: 0.6, flat: true, inner: true }); millMark(k, 0.5, -30, 1.1, BIRCH); }
  k.anchor = { x: -0.1, y: -36.7, r: 2.6 };
  bead(k, -2.1, -36, 3.6, 0.5, CORD);
  // the wheel turns on its axle (a float with a cause, R11)
  float(k, -0.2, -47, (kk) => wheel(kk, q), { bob: 0, spin: 0.9, phase: 0 });
}

// ── wand: a treenail — the oak-hard wooden peg of timber framing, whittled ──
function wand(k: K): void {
  const q = k.q;
  const body = [-1.7, 5.4, 1.7, 5.4, 1.35, -14.5, 0.9, -17.6, 0, -18.8, -0.9, -17.6, -1.35, -14.5];
  slab(k, body, HEART, { inset: 0.78, hi: [[-1.0, 4.2, -0.8, -14.8]] });
  // whittled facets: two long knife planes on the lit side, a chamfer at the tip
  if (k.pass === 'paint') {
    k.c.poly([-1.55, 3.6, -0.3, 2.8, -0.2, -7.4, -1.45, -8.2], true).fill(mix(HEART, 0xfff4d6, 0.3));
    k.c.poly([-1.42, -8.9, -0.2, -8.1, -0.15, -15.2, -1.2, -15.6], true).fill(mix(HEART, 0xfff4d6, 0.26));
    detail(k, [-0.3, 2.8, -0.2, -7.4], shade(HEART, 0.35), 0.5);
    detail(k, [-0.2, -8.1, -0.15, -15.2], shade(HEART, 0.35), 0.5);
    detail(k, [-1.45, -8.2, -0.2, -7.4, -0.2, -8.1, -1.42, -8.9], shade(HEART, 0.45), 0.45);
  }
  if (q === 0) { detail(k, [0.7, 1.5, 0.3, -2.8], shade(HEART, 0.5), 0.55); ring(k, 0.3, 7.4, 1.6, 1.8, 0.8, CORD); }
  else {
    slab(k, [-1.9, 1.2, 1.9, 1.2, 1.9, 3.6, -1.9, 3.6], STRAP, { hi: [[-1.4, 1.8, 1.4, 1.8]] });
    disc(k, 0, -18.4, 1.15, 0.85, STRAP, { line: 0.6 }); // the driven nail head
  }
  if (q === 2) { slab(k, [-1.45, -11.4, 1.45, -11.4, 1.4, -13.0, -1.38, -13.0], RED, { line: 0.6, flat: true }); millMark(k, 0.1, 2.4, 0.95, STRAP); }
  k.anchor = { x: 0, y: 1.2, r: 2 };
  bead(k, 1.9, 1.8, 3.0, -0.3, CORD, 1.3);
}


// ═══════════════ the other held families (rollout 2026-10-11) ═══════════════

// ── greatsword: the cut-down blade of a two-man crosscut saw on a long birch handle; the far handle's holes remain ──
function greatsword(k: K): void {
  const q = k.q;
  k.anchor = { x: 0.4, y: -7.4, r: 3 };
  const tipY = -48;
  // crosscut teeth along the +x edge (M-teeth), one snapped on worn pieces; listed tip-wards, then walked back
  const teeth: number[] = [];
  for (let i = 0, y = -12; y > tipY + 4; i++, y -= 3.2) {
    const h = q === 0 && i === 4 ? 0.5 : 1.7;
    teeth.push(3.6, y, 3.6 + h, y - 1.0, 3.6, y - 1.6, 3.6 + h * 0.8, y - 2.4);
  }
  const back: number[] = [];
  for (let i = teeth.length - 2; i >= 0; i -= 2) back.push(teeth[i], teeth[i + 1]);
  const out = [-3.6, -8.4, -3.6, tipY + 1.6, -2.4, tipY, 3.6, tipY, ...back, 3.6, -8.4];
  bevel(k, out, [-3.6, -8.4, -3.6, tipY + 1.6, -2.4, tipY, 0.6, tipY, 0.6, -8.4], STRAP, { ridge: [0.6, -9, 0.6, tipY + 1], edge: [3.0, -10, 3.0, tipY + 1], edgeCol: EDGE });
  if (k.pass === 'paint') for (const y of [tipY + 4.4, tipY + 8.6]) { k.c.circle(-1.0, y, 0.9).fill(0x1b1410); k.c.circle(-0.85, y + 0.15, 0.5).fill(shade(STRAP, 0.5)); }
  if (q === 0) for (const [x, y] of [[-1.8, -20], [1.2, -33], [-2.2, -40]]) detail(k, [x, y, x + 0.8, y - 0.4, x + 0.4, y + 0.5], RUST, 0.9, 0.8);
  if (q >= 1) millMark(k, -1.2, -14, 1.4, STRAP);
  if (q === 2) slab(k, [-6.2, -6.4, 6.4, -6.4, 8.2, -10.4, 6.8, -10.8, 5.6, -8.4, -6.2, -8.4], STRAP, { hi: [[-5.6, -7.8, 5.2, -7.8]] });
  else slab(k, [-4.8, -6.0, 5.0, -6.0, 4.8, -8.6, -4.6, -8.6], shade(STRAP, 0.1), { hi: [[-4.2, -8.0, 4.4, -8.0]] });
  pole(k, [0.2, 11.6, 0.2, -6.2], 3.4, BIRCH);
  lenticels(k, 0.2, 10, -5, 3.4, k.seed + 11);
  lash(k, 0.2, -5.8, -3.4, 4.0, CORD);
  if (q === 0) lash(k, 0.2, 3.6, 5.6, 4.0, CORD);
  if (q >= 1) slab(k, [-1.9, 11.0, 2.3, 11.0, 2.1, 13.0, -1.7, 13.0], STRAP, { line: 0.8 });
  if (q === 2) slab(k, [-1.7, 1.0, 2.1, 1.0, 2.1, 2.8, -1.7, 2.8], RED, { line: 0.6, flat: true, inner: true });
  bead(k, 5.2, -6.6, 3.6, -0.5, CORD);
}

// ── great axe: a broadaxe for hewing beams — a wide flat bit with a long beard, square poll, wedged eye ──
function greataxe(k: K): void {
  const q = k.q;
  pole(k, q === 0 ? [0.6, 11.4, 2.2, -14, -0.2, -45.4] : [0.3, 11.4, 1.2, -14, 0, -45.4], 3.6, BIRCH, { curve: true });
  if (k.pass === 'paint') { const hw = ribbon(qpts(0.4, 11.4, 1.6, -14, 0, -45.4, 10).slice(0, 8), 3.0); slab(k, hw, HEART, { line: 0, inner: true, flat: true }); }
  lenticels(k, 0.9, -6, -28, 3.0, k.seed + 2);
  const bit = q === 0 ? [14.6, -48.6, 16.6, -40, 15.0, -38.8, 16.8, -36.6, 15.4, -22.4] : [14.8, -48.8, 17.2, -36, 15.6, -22.0];
  const head = [-5.6, -44.0, -2.4, -45.4, 2.6, -45.0, ...bit, 11.0, -21.4, 2.6, -31.0, -2.4, -31.0, -5.6, -32.4];
  slab(k, head, STRAP, { inset: 0.82, hi: [[-5.0, -43.4, 2.2, -44.4, 13.6, -47.4]] });
  if (k.pass === 'paint') k.c.poly(q === 0 ? [12.2, -47.8, 14.6, -48.6, 16.6, -40, 15.0, -38.8, 16.8, -36.6, 15.4, -22.4, 13.0, -23.4, 14.2, -36.4] : [12.4, -48.0, 14.8, -48.8, 17.2, -36, 15.6, -22.0, 13.2, -23.0, 14.6, -36.2], true).fill(mix(STRAP, EDGE, 0.55));
  detail(k, q === 0 ? [14.2, -47.6, 15.8, -40.2] : [14.4, -47.8, 16.4, -36, 15.0, -23.4], EDGE, 1.2);
  detail(k, [-2.4, -45.0, -2.4, -31.4], shade(STRAP, 0.5), 0.6, 0.8);
  if (q >= 1) millMark(k, 7.0, -37, 1.6, STRAP);
  if (q === 0) detail(k, [8.4, -42, 9.2, -41.4], RUST, 0.9, 0.9);
  slab(k, [-1.6, -45.2, 1.6, -45.2, 1.2, -48.0, -1.2, -48.0], HEART, { line: 0.7 });
  pole(k, [0, -45.4, q >= 1 ? 0.2 : -0.3, -48.6], q >= 1 ? 1.0 : 0.8, q >= 1 ? STRAP : shade(HEART, 0.35), { flat: true, inner: true });
  if (q === 0) lash(k, 0.6, -30.4, -27.0, 3.6, CORD);
  if (q === 2) {
    for (const s of [-1, 1]) { slab(k, [s * 1.2 - 0.6, -31, s * 1.2 + 0.6, -31, s * 1.2 + 0.5, -21.4, s * 1.2 - 0.5, -21.4], STRAP, { line: 0.6 }); rivet(k, s * 1.2, -22.6, 0.55, STRAP); }
    slab(k, [-1.4, 4.2, 2.2, 4.2, 2.2, 6.6, -1.2, 6.6], RED, { line: 0.6, flat: true, inner: true });
  }
  k.anchor = { x: 0.6, y: -30.4, r: 2.6 };
  bead(k, 2.0, -30.2, 3.6, 0.6, CORD);
}

// ── mace: a beetle — the iron-hooped wooden mallet that drives the pegs of a mill frame ──
function mace(k: K): void {
  const q = k.q;
  pole(k, [0.3, 6.6, 0.2, -17.6], 2.8, BIRCH);
  lenticels(k, 0.3, 4, -14, 2.6, k.seed + 4);
  const top = -27.6, bot = -16.4, x0 = -8.0, x1 = 8.4;
  slab(k, [x0, top + 0.6, x0 + 0.8, top, x1 - 0.8, top, x1, top + 0.6, x1, bot - 0.6, x1 - 0.8, bot, x0 + 0.8, bot, x0, bot - 0.6], BIRCH, { hi: [[x0 + 1.4, top + 1.2, x1 - 1.6, top + 1.2]] });
  lenticels(k, 0.2, bot - 1.6, top + 1.6, 8, k.seed + 6);
  for (const [x, s] of [[x0, -1], [x1, 1]] as const) {
    slab(k, [x, top + 0.4, x + s * 1.6, top + 1.4, x + s * 1.6, bot - 1.4, x, bot - 0.4], HEART, { line: 0.7 });
    if (k.pass === 'paint') { const cx = x + s * 0.8, cy = (top + bot) / 2; k.c.ellipse(cx, cy, 0.5, 3.6).stroke({ width: 0.4, color: shade(HEART, 0.4) }); k.c.ellipse(cx, cy, 0.25, 1.8).stroke({ width: 0.4, color: shade(HEART, 0.4) }); }
  }
  for (const x of [x0 + 2.8, x1 - 2.8]) slab(k, [x - 0.9, top - 0.3, x + 0.9, top - 0.3, x + 0.9, bot + 0.3, x - 0.9, bot + 0.3], STRAP, { line: 0.7, hi: [[x - 0.4, top + 0.4, x - 0.4, bot - 0.4]] });
  if (q === 0) detail(k, [-3.4, top + 1, -2.4, -22, -3.2, bot - 1], LENT, 0.7, 0.9);
  if (q >= 1) millMark(k, 0.2, -22, 1.4, BIRCH);
  if (q === 2) slab(k, [-1.6, top - 0.2, 1.8, top - 0.2, 1.8, bot + 0.2, -1.6, bot + 0.2], RED, { line: 0.6, flat: true, inner: true });
  slab(k, [-1.8, bot + 0.2, 2.2, bot + 0.2, 2.0, bot + 2.0, -1.6, bot + 2.0], STRAP, { line: 0.7 });
  k.anchor = { x: 0.2, y: bot + 1.2, r: 2.4 };
  bead(k, 2.2, bot + 1.4, 3.4, -0.3, CORD);
}

// ── crossbow: a birch stock, a laminated birch prod lashed on, a strap-iron trigger ──
function xbow(k: K, hand: boolean): void {
  const q = k.q, pw = hand ? 9.6 : 12.6, py = hand ? -9 : -16, sy1 = hand ? -12.4 : -24, sy0 = hand ? 3 : 8;
  if (hand) slab(k, [-1.8, 4.6, 2.6, 4.6, 3.4, 0.6, 2.2, -2.0, 2.0, sy1, -2.0, sy1, -1.8, -2.0], BIRCH, { hi: [[-1.2, sy1 + 1, -1.2, -2.6]] });
  else slab(k, [-2.6, sy0, 2.6, sy0, 2.8, sy0 - 4, 2.2, sy1, -2.2, sy1, -2.8, sy0 - 4], BIRCH, { hi: [[-2.0, sy1 + 1, -2.2, sy0 - 4]] });
  lenticels(k, 0.2, sy0 - 2, sy1 + 2, 3.6, k.seed + 8);
  pole(k, [0, py + 7, 0, sy1 - 4], 1.1, HEART, { flat: true });
  slab(k, [-1.2, sy1 - 4, 0, sy1 - 7.2, 1.2, sy1 - 4], q >= 1 ? STRAP : HEART, { line: 0.7 });
  slab(k, [-1.4, py + 8.6, 0, py + 6.4, 1.4, py + 8.6, 0, py + 9.6], 0xe8e2d4, { line: 0.6 });
  const arc = (dy: number) => qpts(-pw, py + 4 + dy, 0, py - 8 + dy, pw, py + 4 + dy, 14);
  pole(k, arc(0), hand ? 2.2 : 2.8, HEART);
  pole(k, arc(-1.4), hand ? 1.2 : 1.6, BIRCH, { inner: true });
  lash(k, 0, py - 4.6, py - 0.6, hand ? 3.6 : 4.4, CORD, { gap: 1.1, slant: 1.2 });
  pole(k, [-pw + 0.4, py + 3.6, 0, py + 7.2, pw - 0.4, py + 3.6], 0.6, mix(CORD, 0xffffff, 0.3), { flat: true });
  pole(k, hand ? [1.0, -1.6, 2.6, 2.6] : [0.6, -2.6, 0.8, 4.6], 0.9, STRAP);
  disc(k, 0, py + 7.4, 1.0, 1.0, STRAP, { line: 0.6 });
  if (q === 2) slab(k, [-2.2, sy1 + 2, 2.2, sy1 + 2, 2.2, sy1 + 3.6, -2.2, sy1 + 3.6], RED, { line: 0.6, flat: true, inner: true });
  if (q >= 1) millMark(k, 0.4, hand ? -6 : -8, 1.2, BIRCH);
  if (!hand && q === 2) ring(k, 0, sy1 - 1.4, 2.2, 1.0, 1.0, STRAP);
  k.anchor = { x: 0, y: py + 1, r: 2.4 };
  bead(k, 2.4, py + 2, 3.0, -0.4, CORD);
}
const crossbow = (k: K) => xbow(k, false), handxbow = (k: K) => xbow(k, true);

// ── shield: a sluice-gate board — vertical planks, iron bands, the lifting ring at the top ──
function shield(k: K): void {
  const q = k.q;
  const planks = [[-10.4, -3.6], [-3.4, 3.4], [3.6, 10.4]];
  planks.forEach(([x0, x1], i) => {
    const t = -12.6 + (q === 0 ? jit(k.seed, i, 0.9) : 0), b = 14.0 + (q === 0 ? jit(k.seed, i + 3, 0.8) : 0);
    slab(k, [x0, t + (i === 0 ? 1.2 : 0), x1, t + (i === 2 ? 1.2 : 0), x1, b, x0, b], i === 1 ? HEART : mix(HEART, BIRCH, 0.25), { hi: [[x0 + 0.8, t + 1.6, x0 + 0.8, b - 1]] });
    detail(k, [x0 + 2.4, t + 3, x0 + 2.8, b - 3], shade(HEART, 0.4), 0.5, 0.8);
  });
  for (const y of [-6.4, 7.4]) {
    slab(k, [-11.2, y - 1.3, 11.2, y - 1.3, 11.2, y + 1.3, -11.2, y + 1.3], STRAP, { line: 0.8, hi: [[-10.6, y - 0.6, 10.6, y - 0.6]] });
    for (const x of [-7, 0, 7]) { if (q >= 1) rivet(k, x, y, 0.6, STRAP); else peg(k, x, y, 1.0, HEART); }
  }
  ring(k, 0, -14.8, 2.2, 1.8, 1.1, STRAP);
  slab(k, [-1.2, -13.4, 1.2, -13.4, 1.2, -11.6, -1.2, -11.6], STRAP, { line: 0.6 });
  if (q === 0) { detail(k, [5.2, -2, 6.4, 3, 5.6, 5], LENT, 0.7, 0.9); detail(k, [-8.4, 10, -6.6, 12], RUST, 1.0, 0.8); }
  if (q >= 1) millMark(k, 0, 0.6, 2.2, HEART);
  if (q === 2) slab(k, [-10.4, 11.0, 10.4, 11.0, 10.4, 12.6, -10.4, 12.6], RED, { line: 0.6, flat: true, inner: true });
  k.anchor = { x: 0, y: 0.6, r: 3 };
  bead(k, 0.2, -12.6, 2.6, 0.2, CORD);
}

// ── quiver: a tube of birch bark stitched with cord, plain grey-feathered arrows ──
function quiver(k: K): void {
  const q = k.q;
  for (let i = 0; i < 3; i++) {
    const x = -2.8 + i * 2.8, y = -16.4 - (i % 2) * 1.8;
    pole(k, [x * 0.6, -8, x, y + 2], 0.9, HEART, { flat: true });
    slab(k, [x - 1.8, y + 4, x, y - 2.6, x + 1.8, y + 4, x, y + 2.4], i === 1 && q >= 1 ? 0xe8e4dc : 0xb4b0a8, { line: 0.7 });
  }
  slab(k, [-4.8, -10, 4.8, -10, 5.0, 11.4, 3.6, 12.8, -3.6, 12.8, -5.0, 11.4], BIRCH, { hi: [[-4.0, -9, -4.2, 11]] });
  lenticels(k, 0, 10, -8, 8.4, k.seed + 9);
  if (k.pass === 'paint') for (let y = -8.6; y < 11; y += 1.8) detail(k, [3.6, y, 4.6, y + 0.8], CORD, 0.6, 1);
  slab(k, [-5.2, -10.8, 5.2, -10.8, 5.2, -8.0, -5.2, -8.0], q >= 1 ? STRAP : HEART, { line: 0.8 });
  lash(k, 0, 2.6, 4.6, 10.0, q === 0 ? CORD : LEATHER, { gap: 1.0 });
  if (q === 2) millMark(k, -1.6, -3, 1.3, BIRCH);
  k.anchor = { x: 0, y: -9.4, r: 2.6 };
  bead(k, 4.6, -8.2, 3.2, -0.4, CORD);
}

// ── orb: a hand millstone — a dressed grinding stone with an iron rynd across its eye ──
function orb(k: K): void {
  const q = k.q, R = 8.4, STONE = 0x9c968a;
  disc(k, 0, 0, R, R, STONE, { line: 0.9 });
  if (k.pass === 'paint') for (let qd = 0; qd < 4; qd++) for (let j = 0; j < 3; j++) {
    const a = (qd / 4) * Math.PI * 2 + 0.3, r0 = 2.6, r1 = R - 0.9 - j * 0.4, off = (j - 1) * 1.6;
    const ca = Math.cos(a), sa = Math.sin(a), px = -sa * off, py = ca * off;
    detail(k, [ca * r0 + px, sa * r0 + py, ca * r1 + px * 1.2, sa * r1 + py * 1.2], shade(STONE, 0.45), 0.6, 0.85);
  }
  disc(k, 0, 0, 2.4, 2.4, shade(STONE, 0.5), { hi: false, line: 0.7, inner: true });
  slab(k, [-2.8, -0.7, 2.8, -0.7, 2.8, 0.7, -2.8, 0.7], STRAP, { line: 0.6 });
  if (q === 0) detail(k, [3.2, -6.4, 4.6, -4.2, 4.0, -2.8], 0x5a564e, 0.8, 0.9);
  if (q >= 1) millMark(k, 4.6, 4.2, 1.2, STONE);
  if (q === 2) ring(k, 0, 0, R - 0.6, R - 0.6, 0.9, RED, { inner: true });
  k.anchor = { x: 0, y: -R + 1.4, r: 2.2 };
  bead(k, -R * 0.7, -R * 0.7, 3.0, 0.6, CORD);
}

void rivet;
export const MILLWRIGHT: SeriesInfo = {
  id: 'millwright', gen: 0, name: 'Millwright', maker: 'Rillwake millwrights and the Bracken sluice crews', zones: 'Rillwake, Bracken, Reedvault, Cairnspill', levels: '1–12',
  shape: 'straight planks and square ends, single edges, lashings and pegs; crooked, repaired, asymmetric',
  palette: [{ name: 'birch bark', hex: BIRCH }, { name: 'heartwood', hex: HEART }, { name: 'strap iron', hex: STRAP }, { name: 'hemp', hex: CORD }, { name: 'mill red', hex: RED }],
  motif: 'the stamped mill wheel; lashings and square pegs at every joint',
  late: 'a paddle wheel that turns on the staff; rare pieces are "restored": filed teeth, strap guards, red paint',
  effects: 'none by design: the first band stays plain (owner direction 2026-10-11); the wheel turns',
  draw: { blade: sword, axe, bow, staff, wand, greatblade: greatsword, greataxe, mace, crossbow, handxbow, shield, quiver, orb },
};
