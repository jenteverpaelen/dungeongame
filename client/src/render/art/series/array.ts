// Series G4 · Array (item levels 49–60): the Hollowstar Array readers.
// Made by people who listen to a signal and measure the sky: blued star-iron, copper gone to verdigris (ART-REFERENCES
// RW6), bone-white enamel dials, Eris's pale lilac (CAST.md). Shape language: circles, rings and arcs, horn bells,
// graduated ticks, precise and symmetric — the first series whose precision is earned (R10). Light: a lilac signal in
// the graduated channels and lenses, rare pieces only (R6). Maker's mark: a graduated ring.
import type { SeriesInfo } from './index';
import { arcAt, beam, bloom, detail, disc, float, fxCount, glowLine, glowSpot, mote, pole, qpts, ribbon, ring, slab, bevel, stone, withFx, type K } from './kit';
import { light, mix, shade } from '../util';
import { OUT } from '../draw';

const STAR = 0x2e3a5c, STAR_L = 0x5a6c94, EDGE = 0xc8d2e8, VERDI = 0x5f9f8a, COPPER = 0xc47a4c, LILAC = 0xc4b0e2;
const DIAL = 0xe8e0c8, SIGNAL = 0xc2a8ff;

/** Copper fittings: tarnished to verdigris on normal pieces, polished on magic+. */
const cop = (k: K) => (k.q === 0 ? mix(COPPER, VERDI, 0.7) : COPPER);

/** A horn bell (flared cone) at (x, y) opening along angle a (0 = -y), length L, mouth radius R. */
function horn(k: K, x: number, y: number, a: number, L: number, R: number, col: number): void {
  const cs = Math.cos(a), sn = Math.sin(a);
  const P = (u: number, v: number) => [x + u * cs - v * sn, y + u * sn + v * cs]; // u across, v along (-y)
  const pts = [...P(-0.8, 0), ...P(-1.2, -L * 0.45), ...P(-R, -L), ...P(R, -L), ...P(1.2, -L * 0.45), ...P(0.8, 0)];
  slab(k, pts, col, { smooth: false, hi: [[...P(-0.7, -L * 0.2), ...P(-R * 0.8, -L * 0.92)]] });
  if (k.pass === 'paint') {
    const [mx, my] = P(0, -L);
    k.c.ellipse(mx, my, R * 0.98, R * 0.32).fill(shade(col, 0.55));
    k.c.ellipse(mx, my, R, R * 0.34).stroke({ width: 0.8, color: OUT });
  }
}

// ── sword: a graduated blade — blued star-iron, a scale down the middle, a ring guard like an astrolabe's rete ──
function sword(k: K): void {
  const q = k.q;
  k.anchor = { x: 0, y: -7.4, r: 5.4 };
  const blade = [-2.6, -7, 2.6, -7, 2.6, -26.4, 0, -32.8, -2.6, -26.4];
  bevel(k, blade, [-2.6, -7, 0, -7, 0, -32.8, -2.6, -26.4], STAR, { edge: [-2.0, -8, -2.0, -26.2, -0.2, -31.6], edgeCol: EDGE });
  if (k.pass === 'paint') { detail(k, [2.0, -8, 2.0, -26.2, 0.2, -31.6], mix(STAR_L, EDGE, 0.3), 0.7); }
  // the graduated scale: a copper strip down the ridge with ticks; lit on rare pieces
  if (k.pass === 'paint') {
    k.c.rect(-0.75, -27.4, 1.5, 16.8).fill(cop(k));
    for (let i = 0; i <= 16; i++) { const y = -11.0 - i; k.c.moveTo(-0.75, y).lineTo(i % 4 === 0 ? 0.75 : 0, y); }
    k.c.stroke({ width: 0.35, color: shade(COPPER, 0.6) });
    k.c.rect(-0.75, -27.4, 1.5, 16.8).stroke({ width: 0.5, color: OUT });
  }
  glowLine(k, [0.25, -11.6, 0.25, -26.8], 0.5, SIGNAL, q === 2, cop(k));
  // ring guard with graduations and a cross-bar
  slab(k, [-7.8, -6.4, 7.8, -6.4, 7.8, -8.4, -7.8, -8.4], STAR_L, { line: 0.8, hi: [[-7.2, -8.0, 7.2, -8.0]] });
  for (const s of [-1, 1]) disc(k, s * 8.2, -7.4, 1.3, 1.3, cop(k), { line: 0.7 });
  ring(k, 0, -7.4, 5.4, 5.4, 1.9, cop(k), { ticks: 28, tickCol: q >= 1 ? DIAL : shade(VERDI, 0.5) });
  disc(k, 0, -7.4, 1.6, 1.6, q === 2 ? LILAC : STAR_L, { line: 0.7 });
  if (q === 2) glowSpot(k, 0, -7.4, 1.2, SIGNAL, true);
  stone(k, 8.2, -7.4, 0.8, COPPER);
  // grip and horn-bell pommel
  slab(k, [-1.6, -5.8, 1.6, -5.8, 1.6, 3.4, -1.6, 3.4], STAR_L, { line: 0.8 });
  if (k.pass === 'paint') for (let y = -5; y < 3.4; y += 1.3) k.c.moveTo(-1.6, y).lineTo(1.6, y - 0.4).stroke({ width: 0.5, color: STAR });
  horn(k, 0, 3.2, Math.PI, 5.0, 2.8, cop(k));
}

// ── axe: the sextant axe — the bit is a graduated arc on two radial arms, open in the middle ──
function axe(k: K): void {
  const q = k.q;
  pole(k, [0, 8, 0, -22.4], 2.6, STAR_L);
  for (const y of [6.0, -2.0, -14.0]) ring(k, 0, y, 1.8, 0.6, 0.9, cop(k));
  const cx = 0.4, cy = -21.8, R = 13.6, a0 = -0.92, a1 = 0.7;
  // the limb (blade): a thick arc band whose outer rim is the cutting edge
  // angles from +x, y down: the limb runs from up-right round to down-right of the pivot
  const arcO: number[] = [], arcI: number[] = [];
  for (let i = 0; i <= 14; i++) { const a = a0 + (a1 - a0) * (i / 14); arcO.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R); arcI.push(cx + Math.cos(a) * (R - 3.4), cy + Math.sin(a) * (R - 3.4)); }
  const band = [...arcO]; for (let i = arcI.length - 2; i >= 0; i -= 2) band.push(arcI[i], arcI[i + 1]);
  // the quadrant's plate fills the sector, so the head has an axe's mass and silhouette (not an open frame)
  slab(k, [cx, cy, ...arcI], shade(STAR, 0.32), { line: 0.8 });
  if (k.pass === 'paint') { for (const f of [0.45, 0.72]) { const pts = arcAt(cx, cy, (R - 4.4) * f, a0 + 0.08, a1 - 0.08, 10); k.c.poly(pts, false).stroke({ width: 0.4, color: shade(STAR_L, 0.1), alpha: 0.7 }); } }
  const litBand = [...arcO.slice(0, 16)]; for (let i = 14; i >= 0; i -= 2) litBand.push(arcI[i], arcI[i + 1]);
  bevel(k, band, litBand, STAR, { edge: arcO.map((v, i) => (i % 2 === 0 ? cx + (v - cx) * 0.95 : cy + (v - cy) * 0.95)), edgeCol: EDGE });
  // graduations on the limb
  if (k.pass === 'paint') {
    for (let i = 0; i <= 20; i++) { const a = a0 + 0.06 + (a1 - a0 - 0.12) * (i / 20), r0 = R - 3.2, r1 = R - (i % 5 === 0 ? 1.7 : 2.4); k.c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0).lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); }
    k.c.stroke({ width: 0.4, color: q >= 1 ? DIAL : shade(STAR_L, 0.2) });
  }
  // two radial arms and the index arm (with a little lens) — the open frame of the sextant
  for (const a of [a0 + 0.04, a1 - 0.04]) pole(k, [cx, cy, cx + Math.cos(a) * (R - 3.0), cy + Math.sin(a) * (R - 3.0)], 1.5, cop(k));
  const ai = (a0 + a1) / 2 - 0.15;
  pole(k, [cx, cy, cx + Math.cos(ai) * (R - 2.6), cy + Math.sin(ai) * (R - 2.6)], 0.9, STAR_L);
  disc(k, cx + Math.cos(ai) * 4.6, cy + Math.sin(ai) * 4.6, 1.2, 1.2, q === 2 ? SIGNAL : LILAC, { line: 0.6 });
  if (q === 2) glowSpot(k, cx + Math.cos(ai) * 4.6, cy + Math.sin(ai) * 4.6, 0.9, SIGNAL, true);
  // pivot boss and the counterweight disc behind
  disc(k, cx, cy, 2.6, 2.6, cop(k), { line: 0.8 });
  ring(k, -5.6, -21.9, 2.6, 2.6, 1.3, STAR_L, { ticks: 12, tickCol: shade(STAR_L, 0.5) });
  pole(k, [-1.8, -21.8, -3.2, -21.9], 1.4, STAR_L);
  if (q >= 1) stone(k, -5.6, -21.9, 0.9, COPPER);
  k.anchor = { x: 0.4, y: -21.8, r: 2.6 };
}

// ── bow: two limbs that are one true circle, a sighting ring with cross-hairs at the grip ──
function bow(k: K): void {
  const q = k.q;
  const C = { x: -9.2, y: 0 }, R = Math.hypot(-2.4 - C.x, 21.2);
  const arc = (a0: number, a1: number) => { const o: number[] = []; for (let i = 0; i <= 12; i++) { const a = a0 + (a1 - a0) * (i / 12); o.push(C.x + Math.cos(a) * R, C.y + Math.sin(a) * R); } return o; };
  const aTip = Math.atan2(21.2, -2.4 - C.x);
  for (const s of [-1, 1]) {
    const cl = arc(s * aTip, s * 0.16);
    const n = cl.length / 2, ws: number[] = []; for (let i = 0; i < n; i++) ws.push(1.4 + (i / (n - 1)) * 2.2);
    slab(k, ribbon(cl, ws), STAR, { line: 0, flat: true });
    if (k.pass === 'paint') {
      slab(k, ribbon(cl, ws, 0, s > 0 ? -1 : 0.2, s > 0 ? -0.2 : 1), STAR_L, { line: 0, flat: true, inner: true });
      detail(k, ribbon(cl, ws, 0, s > 0 ? -0.75 : 0.65, s > 0 ? -0.65 : 0.75).slice(0, 26), EDGE, 0.5, 0.9);
      for (let i = 2; i < n - 1; i += 2) { const x = cl[i * 2], y = cl[i * 2 + 1]; k.c.circle(x, y, 0.35).fill(q >= 1 ? DIAL : STAR_L); }
      k.c.poly(ribbon(cl, ws), true).stroke({ width: 0.9, color: OUT, join: 'round' });
    }
    // copper tip caps
    slab(k, [-3.6, s * 21.8, -1.2, s * 21.6, -1.0, s * 19.6, -3.0, s * 19.4], cop(k), { line: 0.7 });
  }
  // grip and the sighting ring
  slab(k, [1.4, -3.6, 4.8, -3.6, 4.8, 3.6, 1.4, 3.6], cop(k), { hi: [[2.0, -3.0, 2.0, 3.0]] });
  ring(k, 7.6, 0, 3.4, 3.4, 1.3, STAR_L, { ticks: 16, tickCol: q >= 1 ? DIAL : shade(STAR_L, 0.5) });
  pole(k, [4.6, 0, 4.4, 0], 1.6, STAR_L);
  if (k.pass === 'paint') { k.c.moveTo(7.6, -2.6).lineTo(7.6, 2.6).moveTo(5.0, 0).lineTo(10.2, 0).stroke({ width: 0.45, color: q >= 1 ? DIAL : shade(STAR_L, 0.3) }); }
  if (q === 2) glowSpot(k, 7.6, 0, 0.8, SIGNAL, true);
  stone(k, 3.1, 2.2, 0.8, COPPER);
  if (!k.rig) pole(k, [-2.4, -20.8, -2.4, 20.8], 0.6, LILAC, { flat: true });
  k.anchor = { x: 3.1, y: -4.2, r: 2.2 };
}

// ── staff: an orrery — a meridian ring round a lens, two planets turning on their arms ──
function staff(k: K): void {
  const q = k.q;
  pole(k, [0, 22.6, 0, -38.0], 2.6, STAR);
  for (const y of [20.4, 4.0, -12.0, -33.6]) ring(k, 0, y, 1.8, 0.6, 0.9, cop(k));
  // a tripod fork lifting the sphere
  for (const s of [-1, 1]) pole(k, [0, -37.6, s * 3.8, -40.6, s * 3.0, -45.2], 1.1, cop(k), { curve: true });
  const cy = -48.6;
  ring(k, 0, cy, 9.6, 9.6, 1.7, cop(k), { ticks: 40, tickCol: q >= 1 ? DIAL : shade(VERDI, 0.5) });
  ring(k, 0, cy, 10.2, 3.4, 1.1, STAR_L, { a0: -Math.PI + 0.12, a1: -0.12, inner: true });
  disc(k, 0, cy, 3.8, 3.8, q === 2 ? LILAC : STAR_L, { line: 0.8 });
  if (q === 2) glowSpot(k, 0, cy, 2.4, SIGNAL, true);
  ring(k, 0, cy, 10.2, 3.4, 1.1, STAR_L, { a0: 0.12, a1: Math.PI - 0.12 });
  disc(k, 0, cy - 9.6, 1.3, 1.3, cop(k), { line: 0.6 });
  stone(k, 0, -38.6, 0.8, COPPER);
  // planets on their arms (floats with a cause: the orrery's bearings)
  const planets = q === 0 ? 1 : 2;
  for (let i = 0; i < planets; i++) float(k, 0, cy, (kk) => { disc(kk, 0, 0, i ? 1.1 : 1.5, i ? 1.1 : 1.5, i ? LILAC : cop(kk), { line: 0.6 }); }, { orbit: i ? 13.2 : 11.4, phase: i ? 3.6 : 0.6, spin: 0, bob: 0 });
  k.anchor = { x: 0, y: -33.6, r: 2.2 };
}

// ── wand: a horn receiver — an ear-trumpet bell on a copper rod, a graduated ring at the hand ──
function wand(k: K): void {
  const q = k.q;
  pole(k, [0, 5.4, 0, -11.8], 2.0, cop(k));
  if (k.pass === 'paint') for (const y of [3.0, -2.0, -7.0]) k.c.moveTo(-1, y).lineTo(1, y).stroke({ width: 0.5, color: shade(COPPER, 0.5) });
  slab(k, [-1.4, 5.2, 1.4, 5.2, 1.0, 7.4, -1.0, 7.4], STAR_L, { line: 0.7 });
  ring(k, 0, 0.4, 2.8, 1.0, 1.2, STAR_L, { ticks: 10, tickCol: q >= 1 ? DIAL : shade(STAR_L, 0.5) });
  horn(k, 0, -11.4, -0.18, 9.4, 4.4, cop(k));
  if (k.pass === 'paint' && q === 2) k.c.ellipse(-1.68, -20.65, 3.6, 1.1).fill(mix(SIGNAL, STAR, 0.35));
  if (q === 2) glowSpot(k, -1.68, -20.65, 1.5, SIGNAL, true);
  stone(k, 0, -11.0, 0.9, COPPER);
  k.anchor = { x: 0, y: 0.4, r: 2.2 };
}

// ── effect language: star motes orbiting the instruments, a scanning arc sweeping their scales ──
const motes = (k: K, cx: number, cy: number, orbit: number, per = 2, max = 4) => { const n = fxCount(k, per, max); for (let i = 0; i < n; i++) mote(k, cx, cy, 0.55 + 0.15 * (i % 2), i % 3 === 2 ? DIAL : SIGNAL, 'spark', { orbit: orbit * (1 + 0.18 * (i % 2)), spin: 1.1 + 0.25 * i, phase: (i / Math.max(1, n)) * Math.PI * 2, bob: 0 }); };
function fxSword(k: K): void {
  beam(k, arcAt(0, -7.4, 6.4, -2.6, -0.6), 0.55, SIGNAL);
  glowLine(k, [0.25, -11.6, 0.25, -26.8], 0.4 + 0.2 * bloom(k), SIGNAL, true, COPPER);
  motes(k, 0, -7.4, 8.0);
}
function fxAxe(k: K): void {
  beam(k, arcAt(0.4, -21.8, 11.6, -0.8, 0.5), 0.6, SIGNAL);
  motes(k, 0.4, -21.8, 10.0);
}
function fxBow(k: K): void {
  beam(k, arcAt(7.6, 0, 4.4, -2.4, 0.6), 0.5, SIGNAL);
  motes(k, 7.6, 0, 6.0, 1.6, 3);
}
function fxStaff(k: K): void {
  beam(k, arcAt(0, -48.6, 11.0, -2.8, -0.4), 0.6, SIGNAL);
  motes(k, 0, -48.6, 15.0, 2.4, 5);
}
function fxWand(k: K): void {
  beam(k, arcAt(-1.7, -20.6, 5.6, -2.6, -0.6), 0.45, SIGNAL);
  motes(k, -1.7, -20.6, 5.0, 1.6, 3);
}
void float;

// ═══════════════ the other held families (rollout 2026-10-11) ═══════════════

// ── greatsword: a sundial blade — the blade is a gnomon (the triangular shadow-caster of a sundial [K]) with a
//    graduated back, standing on the half-round dial plate that is the guard; a nocturnal (the ring-and-pointer
//    instrument for reading the hour from the stars [K]) for a pommel ──
function greatsword(k: K): void {
  const q = k.q;
  k.anchor = { x: 1.0, y: -9.8, r: 4.0 };
  const blade = [-4.4, -10.4, 7.4, -10.4, -4.4, -50.0];
  bevel(k, blade, [-4.4, -10.4, 0.8, -10.4, -4.4, -50.0], STAR, { edge: [5.9, -11.2, -4.0, -47.6], edgeCol: EDGE });
  if (k.pass === 'paint') {
    k.c.rect(-3.7, -44.0, 1.4, 32.0).fill(cop(k));
    for (let i = 0; i <= 30; i++) { const y = -13.0 - i; k.c.moveTo(-2.3, y).lineTo(i % 5 === 0 ? -3.7 : -3.0, y); }
    k.c.stroke({ width: 0.35, color: shade(COPPER, 0.6) });
    k.c.rect(-3.7, -44.0, 1.4, 32.0).stroke({ width: 0.5, color: OUT });
  }
  for (const [x0, x1, y1] of [[0.4, -1.2, -26.0], [2.8, 1.2, -19.0]] as const) detail(k, [x0, -11.0, x1, y1], mix(STAR_L, EDGE, 0.25), 0.5);
  glowLine(k, [-3.0, -13.0, -3.0, -43.4], 0.5, SIGNAL, q === 2, cop(k));
  // the dial plate: a half disc under the gnomon, hour lines, a copper rim, its straight edge the base of the blade
  slab(k, arcAt(1.0, -10.4, 8.4, 0, Math.PI, 16), q >= 1 ? DIAL : mix(DIAL, VERDI, 0.35), { line: 0.9 });
  if (k.pass === 'paint') {
    for (let i = 1; i < 12; i++) { const a = (i / 12) * Math.PI, r1 = i % 3 === 0 ? 7.4 : 6.4; k.c.moveTo(1.0 + Math.cos(a) * 2.4, -10.4 + Math.sin(a) * 2.4).lineTo(1.0 + Math.cos(a) * r1, -10.4 + Math.sin(a) * r1); }
    k.c.stroke({ width: 0.4, color: shade(STAR_L, 0.2) });
  }
  pole(k, arcAt(1.0, -10.4, 8.0, 0.05, Math.PI - 0.05, 12), 1.1, cop(k), { curve: true });
  slab(k, [-7.6, -11.2, 9.6, -11.2, 9.6, -9.6, -7.6, -9.6], STAR_L, { line: 0.8, hi: [[-7.0, -10.8, 9.0, -10.8]] });
  for (const x of [-7.6, 9.6]) disc(k, x, -10.4, 1.2, 1.2, cop(k), { line: 0.6 });
  // a long star-iron grip; the nocturnal for a pommel
  slab(k, [-1.8, -2.4, 1.8, -2.4, 1.8, 10.0, -1.8, 10.0], STAR_L, { line: 0.8 });
  if (k.pass === 'paint') for (let y = -1.4; y < 10.0; y += 1.3) k.c.moveTo(-1.8, y).lineTo(1.8, y - 0.4).stroke({ width: 0.5, color: STAR });
  ring(k, 0, 13.6, 3.0, 3.0, 1.2, cop(k), { ticks: 12, tickCol: q >= 1 ? DIAL : shade(VERDI, 0.5) });
  pole(k, [0, 13.6, 3.6, 17.4], 0.7, STAR_L);
  disc(k, 0, 13.6, 1.0, 1.0, q === 2 ? LILAC : STAR_L, { line: 0.6 });
  stone(k, 1.0, -5.2, 0.9, COPPER);
}

// ── great axe: a quadrant axe — the bit a graduated quarter circle on two arms, a plumb bob hanging from its centre ──
function greataxe(k: K): void {
  const q = k.q;
  pole(k, [0, 11.6, 0, -30.6], 3.0, STAR_L);
  for (const y of [9.4, 0, -12, -22]) ring(k, 0, y, 2.0, 0.6, 0.9, cop(k));
  const cx = 0.4, cy = -30.4, R = 19.0, a0 = -1.25, a1 = 0.34;
  const arcO: number[] = [], arcI: number[] = [];
  for (let i = 0; i <= 16; i++) { const a = a0 + (a1 - a0) * (i / 16); arcO.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R); arcI.push(cx + Math.cos(a) * (R - 4.4), cy + Math.sin(a) * (R - 4.4)); }
  const band = [...arcO]; for (let i = arcI.length - 2; i >= 0; i -= 2) band.push(arcI[i], arcI[i + 1]);
  // the quadrant's plate fills the sector, so the head has an axe's mass and silhouette (not an open frame)
  slab(k, [cx, cy, ...arcI], shade(STAR, 0.32), { line: 0.8 });
  if (k.pass === 'paint') { for (const f of [0.45, 0.72]) { const pts = arcAt(cx, cy, (R - 4.4) * f, a0 + 0.08, a1 - 0.08, 10); k.c.poly(pts, false).stroke({ width: 0.4, color: shade(STAR_L, 0.1), alpha: 0.7 }); } }
  const litBand = [...arcO.slice(0, 18)]; for (let i = 16; i >= 0; i -= 2) litBand.push(arcI[i], arcI[i + 1]);
  bevel(k, band, litBand, STAR, { edge: arcO.map((v, i) => (i % 2 === 0 ? cx + (v - cx) * 0.96 : cy + (v - cy) * 0.96)), edgeCol: EDGE });
  if (k.pass === 'paint') { for (let i = 0; i <= 24; i++) { const a = a0 + 0.05 + (a1 - a0 - 0.1) * (i / 24), r0 = R - 4.2, r1 = R - (i % 6 === 0 ? 2.2 : 3.1); k.c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0).lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); } k.c.stroke({ width: 0.45, color: q >= 1 ? DIAL : shade(STAR_L, 0.2) }); }
  for (const a of [a0 + 0.03, a1 - 0.03]) pole(k, [cx, cy, cx + Math.cos(a) * (R - 3.8), cy + Math.sin(a) * (R - 3.8)], 1.7, cop(k));
  // the sighting tube along the upper radius, past the arc, with a pinhole vane at each end (a quadrant is aimed
  // through two sights [K]) — the head's spike, and what tells it from the one-handed sextant
  { const ca = Math.cos(a0), sa = Math.sin(a0), L = R + 6.4, nx = -sa, ny = ca, w = 1.25;
    const tube = [cx + nx * w, cy + ny * w, cx + ca * L + nx * w, cy + sa * L + ny * w, cx + ca * L - nx * w, cy + sa * L - ny * w, cx - nx * w, cy - ny * w];
    slab(k, tube, q >= 1 ? cop(k) : STAR_L, { line: 0.8, hi: [[cx + nx * w * 0.5, cy + ny * w * 0.5, cx + ca * L + nx * w * 0.5, cy + sa * L + ny * w * 0.5]] });
    for (const t of [0.42, 1.0]) { const x = cx + ca * L * t, y = cy + sa * L * t; slab(k, [x + nx * 2.4 - ca * 0.8, y + ny * 2.4 - sa * 0.8, x + nx * 2.4 + ca * 0.8, y + ny * 2.4 + sa * 0.8, x - nx * 2.4 + ca * 0.8, y - ny * 2.4 + sa * 0.8, x - nx * 2.4 - ca * 0.8, y - ny * 2.4 - sa * 0.8], STAR_L, { line: 0.7 }); if (k.pass === 'paint') k.c.circle(x, y, 0.5).fill(q === 2 ? LILAC : 0x141018); } }
  disc(k, cx, cy, 3.0, 3.0, cop(k), { line: 0.8 });
  // the plumb bob on its thread (a float: it hangs and sways)
  pole(k, [cx + 0.2, cy + 1.6, cx + 5.6, cy + 9.6], 0.4, DIAL, { flat: true, inner: true });
  float(k, cx + 5.8, cy + 10.4, (kk) => slab(kk, [0, -1.2, 1.3, 0.4, 0, 2.8, -1.3, 0.4], cop(kk), { line: 0.6 }), { bob: 0.4, phase: 0.5 });
  if (q >= 1) stone(k, cx, cy, 1.0, COPPER);
  k.anchor = { x: cx, y: cy, r: 3 };
}

// ── mace: an armillary mace — three crossing rings round a ball, on a star-iron haft ──
function mace(k: K): void {
  const q = k.q, cy = -23.6, R = 6.8;
  pole(k, [0, 6.6, 0, cy + R - 0.6], 2.6, STAR_L);
  for (const y of [4.0, -4.0]) ring(k, 0, y, 1.8, 0.6, 0.9, cop(k));
  disc(k, 0, cy, 3.0, 3.0, q === 2 ? LILAC : STAR_L, { line: 0.8 });
  if (q === 2) glowSpot(k, 0, cy, 2.0, SIGNAL, true);
  ring(k, 0, cy, R, R, 1.6, cop(k), { ticks: 28, tickCol: q >= 1 ? DIAL : shade(VERDI, 0.5) });
  ring(k, 0, cy, R + 0.6, 2.4, 1.0, STAR_L, { a0: 0.1, a1: Math.PI - 0.1 });
  ring(k, 0, cy, 2.6, R + 0.4, 1.0, STAR_L);
  for (const s of [-1, 1]) disc(k, s * (R + 0.8), cy, 1.0, 1.0, cop(k), { line: 0.6 });
  disc(k, 0, cy - R - 0.8, 1.1, 1.1, cop(k), { line: 0.6 });
  k.anchor = { x: 0, y: cy + R, r: 2.2 };
  stone(k, 0, cy + R + 1.4, 0.8, COPPER);
}

// ── crossbow: a theodolite crossbow — a graduated copper prod, a sighting ring over the fore-end ──
function xbow(k: K, hand: boolean): void {
  const q = k.q, pw = hand ? 9.6 : 13.0, py = hand ? -9 : -16, sy1 = hand ? -12.4 : -24, sy0 = hand ? 3 : 8;
  if (hand) slab(k, [-1.9, 5.0, 2.6, 5.0, 3.6, 1.0, 2.0, -2.0, 1.9, sy1, -1.9, sy1, -1.9, -2.0], STAR_L, { hi: [[-1.2, sy1 + 1, -1.2, -2.6]] });
  else slab(k, [-2.6, sy0, 2.6, sy0, 2.8, sy0 - 4, 2.2, sy1, -2.2, sy1, -2.8, sy0 - 4], STAR_L, { hi: [[-2.0, sy1 + 1, -2.2, sy0 - 4]] });
  for (const y of [sy1 + 1.4, py + 6.4, sy0 - 3]) slab(k, [-2.7, y - 0.7, 2.7, y - 0.7, 2.7, y + 0.7, -2.7, y + 0.7], cop(k), { line: 0.6 });
  pole(k, [0, py + 7, 0, sy1 - 3.6], 1.0, STAR, { flat: true });
  slab(k, [-1.2, sy1 - 3.6, 0, sy1 - 7.0, 1.2, sy1 - 3.6], EDGE, { line: 0.7 });
  const arc = qpts(-pw, py + 4, 0, py - 8, pw, py + 4, 16);
  pole(k, arc, hand ? 2.0 : 2.6, cop(k));
  if (k.pass === 'paint') { for (let i = 2; i < arc.length / 2 - 2; i++) { const x = arc[i * 2], y = arc[i * 2 + 1]; k.c.moveTo(x, y - (i % 4 === 0 ? 1.0 : 0.5)).lineTo(x, y + 0.2); } k.c.stroke({ width: 0.4, color: q >= 1 ? DIAL : shade(VERDI, 0.4) }); }
  pole(k, [-pw + 0.6, py + 3.8, 0, py + 7.2, pw - 0.6, py + 3.8], 0.55, LILAC, { flat: true });
  const ry = hand ? sy1 + 3.6 : sy1 + 5.4, rr = hand ? 2.6 : 3.4;
  pole(k, [0, ry + rr, 0, ry + rr + 1.6], 1.2, STAR_L);
  ring(k, 0, ry, rr, rr, 1.1, STAR_L, { ticks: 12, tickCol: q >= 1 ? DIAL : shade(STAR_L, 0.5) });
  if (k.pass === 'paint') k.c.moveTo(0, ry - rr + 0.8).lineTo(0, ry + rr - 0.8).moveTo(-rr + 0.8, ry).lineTo(rr - 0.8, ry).stroke({ width: 0.4, color: q >= 1 ? DIAL : shade(STAR_L, 0.3) });
  pole(k, hand ? [1.0, -1.4, 2.6, 2.6] : [0.6, -2.4, 0.8, 4.6], 0.9, cop(k));
  k.anchor = { x: 0, y: py + 1, r: 2.4 };
  stone(k, 0, py + 1.0, 0.8, COPPER);
}
const crossbow = (k: K) => xbow(k, false), handxbow = (k: K) => xbow(k, true);

// ── shield: a dish receiver — a round dish in concentric rings, a horn feed on three struts at its focus ──
function shield(k: K): void {
  const q = k.q, R = 12.6;
  disc(k, 0, 0.6, R, R, STAR, { line: 0.9 });
  if (k.pass === 'paint') { for (const r of [3.6, 6.6, 9.6]) k.c.circle(0, 0.6, r).stroke({ width: 0.7, color: STAR_L }); k.c.ellipse(-4.0, -4.6, 4.0, 2.4).fill({ color: STAR_L, alpha: 0.5 }); }
  ring(k, 0, 0.6, R, R, 1.8, cop(k), { ticks: 48, tickCol: q >= 1 ? DIAL : shade(VERDI, 0.5) });
  for (const a of [-Math.PI / 2, Math.PI / 6, (Math.PI * 5) / 6]) pole(k, [Math.cos(a) * (R - 1.4), 0.6 + Math.sin(a) * (R - 1.4), Math.cos(a) * 1.6, 0.6 + Math.sin(a) * 1.6], 0.8, STAR_L, { inner: true });
  horn(k, 0, 3.8, 0, 6.0, 2.4, cop(k));
  k.anchor = { x: 0, y: 0.6, r: 3 };
  stone(k, 0, R - 0.6, 0.9, COPPER);
}

// ── quiver: a telescope-tube quiver — copper draw-tubes stepping down, graduated bands, a lens cap ──
function quiver(k: K): void {
  const q = k.q;
  for (let i = 0; i < 3; i++) { const x = -2.6 + i * 2.6, y = -16.6 - (i % 2) * 1.8; pole(k, [x * 0.6, -8, x, y + 2], 0.9, STAR, { flat: true }); slab(k, [x - 1.8, y + 4, x, y - 2.6, x + 1.8, y + 4, x, y + 2.4], LILAC, { line: 0.7 }); }
  for (const [y0, y1, w] of [[-10.0, -2.0, 5.0], [-2.0, 6.0, 4.4], [6.0, 12.4, 3.8]] as const) {
    slab(k, [-w, y0, w, y0, w, y1, -w, y1], cop(k), { hi: [[-w + 0.8, y0 + 0.8, -w + 0.8, y1 - 0.8]] });
    slab(k, [-w - 0.4, y0 - 0.6, w + 0.4, y0 - 0.6, w + 0.4, y0 + 0.8, -w - 0.4, y0 + 0.8], STAR_L, { line: 0.6 });
    if (k.pass === 'paint') { for (let x = -w + 1; x < w - 0.5; x += 0.9) k.c.moveTo(x, y1 - 1.6).lineTo(x, y1 - (Math.round(x) % 2 ? 0.8 : 1.2)); k.c.stroke({ width: 0.35, color: q >= 1 ? DIAL : shade(VERDI, 0.4) }); }
  }
  disc(k, 0, 13.2, 3.0, 1.0, STAR_L, { line: 0.7 });
  k.anchor = { x: 0, y: -9.4, r: 2.4 };
  stone(k, 2.6, -6.0, 0.8, COPPER);
}

// ── orb: a celestial globe — a dark sphere set with stars, a copper meridian and a horizon ring ──
function orb(k: K): void {
  const q = k.q, R = 7.6;
  disc(k, 0, 0, R, R, STAR, { line: 0.9 });
  if (k.pass === 'paint') { for (const [x, y, r] of [[-3, -3, 0.5], [2, -4.4, 0.4], [3.6, 1, 0.5], [-1.4, 2.6, 0.4], [0.6, -1, 0.3], [-4.6, 1.2, 0.3], [4.6, -2.4, 0.3]]) k.c.circle(x, y, r).fill(q >= 1 ? DIAL : STAR_L); k.c.moveTo(-3, -3).lineTo(2, -4.4).lineTo(3.6, 1).stroke({ width: 0.3, color: STAR_L }); k.c.ellipse(-2.6, -3.6, 2.4, 1.3).fill({ color: STAR_L, alpha: 0.5 }); }
  ring(k, 0, 0, R + 1.4, R + 1.4, 1.4, cop(k), { ticks: 30, tickCol: q >= 1 ? DIAL : shade(VERDI, 0.5), a0: -Math.PI * 0.95, a1: Math.PI * 0.95 });
  ring(k, 0, 0, R + 2.2, 2.6, 1.0, STAR_L, { a0: 0.1, a1: Math.PI - 0.1 });
  for (const y of [-(R + 1.4), R + 1.4]) disc(k, 0, y, 1.0, 1.0, cop(k), { line: 0.6 });
  k.anchor = { x: 0, y: -R, r: 2.2 };
  stone(k, R + 1.4, 0, 0.8, COPPER);
}

// ── effects for the rollout families (orbiting star motes, scanning arcs, the signal) ──
function fxGreatsword(k: K): void { beam(k, arcAt(1.0, -10.4, 9.6, 0.25, Math.PI - 0.25), 0.6, SIGNAL); glowLine(k, [-3.0, -13.0, -3.0, -43.4], 0.45 + 0.2 * bloom(k), SIGNAL, true, COPPER); motes(k, 1.0, -10.4, 11.0); }
function fxGreataxe(k: K): void { beam(k, arcAt(0.4, -30.4, 17.0, -1.2, 0.3), 0.7, SIGNAL); motes(k, 0.4, -30.4, 14.0, 2.4, 5); }
function fxMace(k: K): void { glowSpot(k, 0, -23.6, 1.5 + 0.7 * bloom(k), SIGNAL, true); beam(k, arcAt(0, -23.6, 7.8, -2.6, -0.4), 0.5, SIGNAL); motes(k, 0, -23.6, 9.6, 2.4, 5); }
function fxXbow(k: K): void { beam(k, arcAt(0, -18.6, 4.4, -2.6, 0.4), 0.45, SIGNAL); motes(k, 0, -16, 13.0, 1.6, 3); }
function fxHand(k: K): void { beam(k, arcAt(0, -11.4, 3.4, -2.6, 0.4), 0.4, SIGNAL); motes(k, 0, -10, 9.4, 1.2, 2); }
function fxShield(k: K): void { glowSpot(k, 0, -1.6, 1.6 + bloom(k), SIGNAL, true); beam(k, arcAt(0, 0.6, 13.6, -2.8, -0.4), 0.6, SIGNAL); motes(k, 0, 0.6, 15.0, 2, 4); }
function fxQuiver(k: K): void { beam(k, [-4.4, 4.0, 4.4, 4.0], 0.4, SIGNAL); motes(k, 0, -14, 6.0, 1.6, 3); }
function fxOrb(k: K): void { glowSpot(k, 0, 0, 1.7 + 0.8 * bloom(k), SIGNAL, true); beam(k, arcAt(0, 0, 9.0, -2.8, -0.2), 0.6, SIGNAL); motes(k, 0, 0, 11.4, 2.4, 5); }

export const ARRAY: SeriesInfo = {
  id: 'array', gen: 4, name: 'Array', maker: 'the readers of the Hollowstar Array', zones: 'Hollowstar Array, the first Faultlines', levels: '49–60',
  shape: 'circles, rings and arcs; horn bells; graduated ticks; precise and symmetric',
  palette: [{ name: 'blued star-iron', hex: STAR }, { name: 'copper', hex: COPPER }, { name: 'verdigris', hex: VERDI }, { name: 'enamel dial', hex: DIAL }, { name: 'lilac signal (light)', hex: SIGNAL }],
  motif: 'the graduated ring at the junction',
  late: 'an orrery staff with turning planets, a sextant axe, a sighting-ring bow; the signal lights the scales',
  effects: 'star motes orbiting the instruments, a scanning arc over the scales, the signal in the channels; star impacts',
  draw: {
    blade: withFx(sword, fxSword), axe: withFx(axe, fxAxe), bow: withFx(bow, fxBow), staff: withFx(staff, fxStaff), wand: withFx(wand, fxWand),
    greatblade: withFx(greatsword, fxGreatsword), greataxe: withFx(greataxe, fxGreataxe), mace: withFx(mace, fxMace), crossbow: withFx(crossbow, fxXbow),
    handxbow: withFx(handxbow, fxHand), shield: withFx(shield, fxShield), quiver: withFx(quiver, fxQuiver), orb: withFx(orb, fxOrb),
  },
};
void qpts; void light;
