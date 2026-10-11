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
export const ARRAY: SeriesInfo = {
  id: 'array', gen: 4, name: 'Array', maker: 'the readers of the Hollowstar Array', zones: 'Hollowstar Array, the first Faultlines', levels: '49–60',
  shape: 'circles, rings and arcs; horn bells; graduated ticks; precise and symmetric',
  palette: [{ name: 'blued star-iron', hex: STAR }, { name: 'copper', hex: COPPER }, { name: 'verdigris', hex: VERDI }, { name: 'enamel dial', hex: DIAL }, { name: 'lilac signal (light)', hex: SIGNAL }],
  motif: 'the graduated ring at the junction',
  late: 'an orrery staff with turning planets, a sextant axe, a sighting-ring bow; the signal lights the scales',
  effects: 'star motes orbiting the instruments, a scanning arc over the scales, the signal in the channels; star impacts',
  draw: { blade: withFx(sword, fxSword), axe: withFx(axe, fxAxe), bow: withFx(bow, fxBow), staff: withFx(staff, fxStaff), wand: withFx(wand, fxWand) },
};
void qpts; void light;
