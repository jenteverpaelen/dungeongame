// Series G6 · Reliquary (item level 70): the makers of the Glass Reliquary. The material language is the town's glass
// dome (townHouses.ts `dome`: teal-tinted glass lit from inside #96FFEC, meridian ribs and rings, a white highlight
// streak, a gold finial) set in bronze (the Reliquary's bronze in npcs.ts: #B4783A / #E0AA5E / #7A4A22). A reliquary is
// a case that shows what it keeps through glass [K], so: glass panes held in bronze cames, ribbed domes, gold finials;
// strict symmetry (precision as the final reward, R10). Light: the relic glow seen through the glass (R6).
// Motif at the junction: a small ribbed glass dome.
import type { SeriesInfo } from './index';
import { bloom, detail, disc, fxCount, haze, jit, mote, pole, qpts, rays, ribbon, slab, stone, withFx, OUTER, type K } from './kit';
import { light, mix, shade } from '../util';
import { OUT, fill, inSilhouette, outline } from '../draw';

const BRONZE = 0xb4783a, BRONZE_L = 0xe0aa5e, BRONZE_D = 0x7a4a22, GOLD = 0xe2c070;
const GLASS = 0x5fa8a2, GLASS_HI = 0xe6fff8, RELIC = 0x96ffec;

/** Glass inside a bronze frame: teal glass, lighter towards the light, a white streak; the relic glows through it on
 *  magic+ (dim) and rare (bright). The frame (and its ink) is drawn by the caller. */
function glass(k: K, pts: number[], streak: number[] | null, alpha = 0.92): void {
  const c = k.c, lit = k.q >= 1;
  if (k.pass === 'under' || inSilhouette()) return;
  if (k.pass === 'paint') {
    c.poly(pts, true).fill({ color: lit ? mix(GLASS, RELIC, k.q === 2 ? 0.42 : 0.22) : shade(GLASS, 0.25), alpha });
    let cx = 0, cy = 0; for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; } cx /= pts.length / 2; cy /= pts.length / 2;
    c.poly(pts.map((v, i) => (i % 2 === 0 ? cx - 0.6 + (v - cx) * 0.62 : cy - 0.6 + (v - cy) * 0.62)), true).fill({ color: light(GLASS, lit ? 0.45 : 0.25), alpha: 0.75 });
    if (streak) { c.moveTo(streak[0], streak[1]); for (let i = 2; i < streak.length; i += 2) c.lineTo(streak[i], streak[i + 1]); c.stroke({ width: 0.75, color: GLASS_HI, alpha: 0.9, cap: 'round' }); }
    return;
  }
  if (!lit) return;
  k.lit = true; k.litCol = k.litCol || RELIC;
  c.poly(pts, true).fill({ color: RELIC, alpha: k.q === 2 ? 0.42 : 0.2 });
  c.poly(pts, true).stroke({ width: 1.6, color: RELIC, alpha: k.q === 2 ? 0.3 : 0.14, join: 'round' });
}

/** A bronze came: the strip that holds the panes. */
function came(k: K, pts: number[], w = 0.9, inner = true): void { pole(k, pts, w, BRONZE, { inner }); }

/** A gold finial: a stem and a ball. */
function finial(k: K, x: number, y: number, h: number, r = 1.1): void {
  pole(k, [x, y, x, y - h], 0.8, GOLD);
  disc(k, x, y - h - r * 0.6 * Math.sign(h || 1), r, r, GOLD, { line: 0.6 });
}

/** A ribbed glass dome standing on a bronze ring at (cx, by): half width rx, height h. The glass is slightly
 *  transparent so what it covers shows through (a reliquary shows its relic). */
function dome(k: K, cx: number, by: number, rx: number, h: number, ribs: number, top = true): void {
  const c = k.c;
  const shape = () => { c.moveTo(cx - rx, by); c.bezierCurveTo(cx - rx, by - h * 1.05, cx + rx, by - h * 1.05, cx + rx, by); c.closePath(); };
  if (k.pass === 'under') { shape(); outline(c, OUTER * 2); }
  else if (k.pass === 'paint' && inSilhouette()) { shape(); fill(c, 0xffffff); }
  else if (k.pass === 'paint') {
    const lit = k.q >= 1;
    shape(); c.fill({ color: lit ? mix(GLASS, RELIC, k.q === 2 ? 0.4 : 0.2) : shade(GLASS, 0.2), alpha: 0.82 });
    c.ellipse(cx - rx * 0.22, by - h * 0.5, rx * 0.5, h * 0.36).fill({ color: light(GLASS, 0.5), alpha: 0.55 });
    for (let i = 1; i < ribs; i++) {
      const t = i / ribs, x = cx - rx + 2 * rx * t, bulge = (t - 0.5) * rx * 0.55;
      c.moveTo(x, by).quadraticCurveTo(x + bulge * 0.2, by - h * 0.8, cx + (x - cx) * 0.15, by - h * 0.97);
    }
    c.stroke({ width: 0.55, color: shade(BRONZE, 0.25), alpha: 0.9 });
    c.moveTo(cx - rx * 0.86, by - h * 0.42).quadraticCurveTo(cx, by - h * 0.62, cx + rx * 0.86, by - h * 0.42).stroke({ width: 0.5, color: shade(BRONZE, 0.25), alpha: 0.8 });
    c.moveTo(cx - rx * 0.62, by - h * 0.25).quadraticCurveTo(cx - rx * 0.56, by - h * 0.68, cx - rx * 0.2, by - h * 0.86).stroke({ width: 0.8, color: GLASS_HI, alpha: 0.9, cap: 'round' });
    shape(); c.stroke({ width: 0.9, color: OUT, join: 'round' });
  } else if (k.q >= 1) {
    k.lit = true; k.litCol = k.litCol || RELIC;
    c.ellipse(cx, by - h * 0.45, rx * 0.78, h * 0.5).fill({ color: RELIC, alpha: k.q === 2 ? 0.4 : 0.18 });
  }
  slab(k, [cx - rx - 0.8, by - 0.6, cx + rx + 0.8, by - 0.6, cx + rx + 0.4, by + 1.2, cx - rx - 0.4, by + 1.2], BRONZE, { hi: [[cx - rx, by - 0.1, cx + rx * 0.6, by - 0.1]] });
  if (top) finial(k, cx, by - h * 0.98, 1.4, 0.95);
}

// ── sword: a glass blade leaded in bronze, coming out of a small reliquary dome ──
function sword(k: K): void {
  const q = k.q;
  k.anchor = { x: 0, y: -6.0, r: 3.6 };
  const out = [-3.6, -8.6, 3.6, -8.6, 3.9, -24.6, 0, -34.2, -3.9, -24.6];
  slab(k, out, BRONZE, { line: 0.9, hi: [[-3.2, -9.4, -3.4, -24.4, -0.4, -32.6]] });
  const inner = [-2.3, -9.8, 2.3, -9.8, 2.5, -24.0, 0, -31.0, -2.5, -24.0];
  glass(k, inner, [-1.6, -11.0, -1.7, -22.8]);
  // the leading: a centre came and chevrons, so the blade reads as panes
  came(k, [0, -9.8, 0, -31.0], 0.8);
  for (const y of [-15.0, -20.6, -25.8]) came(k, [-2.4, y + 1.4, 0, y - 0.6, 2.4, y + 1.4], 0.75);
  detail(k, [3.2, -9.4, 3.4, -24.4, 0.4, -32.6], shade(BRONZE_L, 0.1), 0.6);
  // guard: two swept bronze arms ending in gold balls; the dome at the junction
  for (const s of [-1, 1]) { pole(k, [s * 2.0, -6.2, s * 6.4, -6.0, s * 9.4, -9.6], 1.6, BRONZE, { curve: true }); disc(k, s * 9.6, -10.2, 1.1, 1.1, GOLD, { line: 0.6 }); }
  dome(k, 0, -5.4, 4.4, 5.6, 5, false);
  stone(k, 0, -4.4, 0.75, BRONZE_L);
  // grip: bronze bands; pommel: a glass bead in a bronze ring with a gold finial below
  slab(k, [-1.5, -4.0, 1.5, -4.0, 1.5, 4.0, -1.5, 4.0], BRONZE_D, { line: 0.8 });
  if (k.pass === 'paint') for (const y of [-2.4, 0, 2.4]) k.c.rect(-1.5, y - 0.45, 3.0, 0.9).fill(BRONZE_L);
  disc(k, 0, 6.2, 2.3, 2.3, BRONZE, { line: 0.8 });
  glass(k, [-1.5, 6.2, 0, 4.7, 1.5, 6.2, 0, 7.7], null, 1);
  finial(k, 0, 8.4, -1.0, 0.9);
  if (q === 2) for (const s of [-1, 1]) detail(k, [s * 1.0, -12.4, s * 1.6, -13.4], GLASS_HI, 0.5);
}

// ── axe: a labrys whose two bits are glass panes in bronze frames, a dome over the eye ──
function axe(k: K): void {
  pole(k, [0, 8, 0, -25.0], 2.6, BRONZE_D);
  if (k.pass === 'paint') for (const y of [5.2, 1.6, -2.0]) k.c.rect(-1.3, y - 0.4, 2.6, 0.8).fill(BRONZE_L);
  const cy = -20.6;
  for (const s of [-1, 1]) {
    const tip = s * 11.4, top = cy - 7.6, bot = cy + 7.6;
    const frame = [s * 2.2, cy - 3.2, s * 7.4, top, tip, cy - 1.6, tip, cy + 1.6, s * 7.4, bot, s * 2.2, cy + 3.2];
    slab(k, frame, BRONZE, { line: 0.9, hi: [[s * 2.8, cy - 3.0, s * 7.2, top + 0.8]] });
    const pane = [s * 3.4, cy - 2.4, s * 7.2, top + 1.6, s * 9.8, cy - 1.0, s * 9.8, cy + 1.0, s * 7.2, bot - 1.6, s * 3.4, cy + 2.4];
    glass(k, pane, s < 0 ? [s * 4.6, cy - 1.8, s * 6.8, top + 2.8] : null);
    came(k, [s * 3.4, cy, s * 9.8, cy], 0.75);
    came(k, [s * 7.2, top + 1.6, s * 7.2, bot - 1.6], 0.75);
    detail(k, [s * 7.8, top + 0.6, s * 10.8, cy - 1.4, s * 10.8, cy + 1.4, s * 7.8, bot - 0.6], light(BRONZE_L, 0.5), 0.7);
    for (const y of [top, bot]) disc(k, s * 7.4, y, 0.9, 0.9, GOLD, { line: 0.6 });
  }
  slab(k, [-2.6, cy - 4.0, 2.6, cy - 4.0, 2.6, cy + 4.0, -2.6, cy + 4.0], BRONZE, { hi: [[-2.0, cy - 3.4, -2.0, cy + 3.4]] });
  dome(k, 0, cy - 4.0, 2.8, 4.4, 4, true);
  stone(k, 0, cy + 1.2, 0.8, BRONZE_L);
  k.anchor = { x: 0, y: cy + 4.4, r: 2.4 };
}

// ── bow: bronze limbs set with glass windows, a glass bulb caged at the grip ──
function bow(k: K): void {
  for (const s of [-1, 1]) {
    const cl = qpts(3.2, s * 4.6, 9.4, s * 13.4, -2.4, s * 21.4, 16);
    const n = cl.length / 2, ws: number[] = []; for (let i = 0; i < n; i++) ws.push(4.6 - (i / (n - 1)) * 3.0);
    slab(k, ribbon(cl, ws), BRONZE, { line: 0, flat: true });
    if (k.pass === 'paint') {
      k.c.poly(ribbon(cl, ws, 0, s > 0 ? -1 : 0.1, s > 0 ? -0.1 : 1), true).fill(light(BRONZE, 0.28));
      k.c.poly(ribbon(cl, ws), true).stroke({ width: 0.9, color: OUT, join: 'round' });
    }
    for (const [i0, i1] of [[2, 6], [8, 12]]) glass(k, ribbon(cl.slice(i0 * 2, i1 * 2 + 2), ws.slice(i0, i1 + 1), 0, -0.55, 0.55), null);
    for (const i of [7, 13]) disc(k, cl[i * 2], cl[i * 2 + 1], 0.95, 0.95, GOLD, { line: 0.6 });
    disc(k, -2.4, s * 21.4, 1.1, 1.1, GOLD, { line: 0.6 });
  }
  slab(k, [1.2, -4.6, 5.2, -4.6, 5.2, 4.6, 1.2, 4.6], BRONZE_D, { line: 0.8 });
  if (k.pass === 'paint') for (const y of [-3.0, 0, 3.0]) k.c.rect(1.2, y - 0.45, 4.0, 0.9).fill(BRONZE_L);
  disc(k, 7.2, 0, 3.0, 3.0, BRONZE, { line: 0.8 });
  glass(k, [5.2, 0, 7.2, -2.0, 9.2, 0, 7.2, 2.0], [6.2, -0.6, 7.0, -1.4], 1);
  for (const a of [0, Math.PI / 2]) came(k, [7.2 + Math.cos(a) * 2.6, Math.sin(a) * 2.6, 7.2 - Math.cos(a) * 2.6, -Math.sin(a) * 2.6], 0.55);
  stone(k, 3.2, 2.2, 0.8, BRONZE_L);
  if (!k.rig) pole(k, [-2.4, -20.6, -2.4, 20.6], 0.6, 0xe8dcc0, { flat: true });
  k.anchor = { x: 3.2, y: -4.8, r: 2.4 };
}

// ── staff: the Reliquary itself — a ribbed glass dome on a stepped bronze base, a relic glowing inside ──
function staff(k: K): void {
  const q = k.q;
  pole(k, [0, 22.6, 0, -37.0], 2.6, BRONZE_D);
  if (k.pass === 'paint') for (const y of [19.6, 8.0, -4.0, -16.0, -28.0]) k.c.rect(-1.3, y - 0.45, 2.6, 0.9).fill(BRONZE_L);
  for (const s of [-1, 1]) { pole(k, [s * 1.0, -36.0, s * 6.4, -38.0, s * 6.6, -42.4], 1.4, BRONZE, { curve: true }); disc(k, s * 6.6, -43.0, 0.9, 0.9, GOLD, { line: 0.6 }); }
  slab(k, [-5.6, -38.0, 5.6, -38.0, 4.6, -40.4, -4.6, -40.4], BRONZE, { hi: [[-5.0, -38.6, 4.4, -38.6]] });
  slab(k, [-1.6, -36.0, 1.6, -36.0, 1.6, -38.2, -1.6, -38.2], BRONZE_D, { line: 0.7 });
  // the relic inside: a faceted shard on a pin (drawn before the glass so it shows through)
  pole(k, [0, -40.6, 0, -43.4], 0.7, GOLD, { inner: true });
  slab(k, [0, -50.8, 1.8, -47.4, 0.9, -43.4, -0.9, -43.4, -1.8, -47.4], q >= 1 ? mix(RELIC, GLASS_HI, 0.3) : light(GLASS, 0.2), { line: 0.6, inner: true, hi: [[-0.9, -47.4, 0, -50.0]] });
  dome(k, 0, -40.6, 6.4, 13.2, 7, true);
  stone(k, 0, -39.2, 0.85, BRONZE_L);
  k.anchor = { x: 0, y: -36.4, r: 2.4 };
}

// ── wand: a glass rod held in bronze bands, a small dome for a tip ──
function wand(k: K): void {
  pole(k, [0, 6.0, 0, 0.4], 2.4, BRONZE_D);
  if (k.pass === 'paint') k.c.rect(-1.2, 3.0, 2.4, 0.9).fill(BRONZE_L);
  disc(k, 0, 6.8, 1.4, 1.1, BRONZE, { line: 0.6 });
  slab(k, [-1.6, 0.4, 1.6, 0.4, 1.4, -14.6, -1.4, -14.6], BRONZE, { line: 0.9 });
  glass(k, [-1.0, -0.4, 1.0, -0.4, 0.85, -14.0, -0.85, -14.0], [-0.5, -1.4, -0.4, -12.6], 1);
  for (const y of [0.2, -4.8, -9.6, -14.4]) slab(k, [-1.9, y - 0.7, 1.9, y - 0.7, 1.9, y + 0.7, -1.9, y + 0.7], BRONZE, { line: 0.6, hi: [[-1.5, y - 0.3, 1.2, y - 0.3]] });
  dome(k, 0, -15.0, 2.6, 4.4, 4, true);
  stone(k, 0, -2.4, 0.65, BRONZE_L);
  k.anchor = { x: 0, y: -1.8, r: 2.2 };
}

// -- effect language: prismatic glints off the glass, relic glare through the dome, the panes pulsing (the rig pulses
//    the light layer) --
const PRISM = [0xff9ad8, 0xfff2a0, 0x9ff0ff, 0xc8b0ff];
const prisms = (k: K, pts: [number, number][], per = 2, max = 4) => { const n = fxCount(k, per, max); for (let i = 0; i < n; i++) { const [x, y] = pts[i % pts.length]; mote(k, x + jit(k.seed, i, 0.8), y + jit(k.seed, i + 3, 0.8), 0.6, PRISM[(i + k.seed) % PRISM.length], 'spark', { bob: 0.6, spin: 2.0 + 0.3 * i, phase: i * 1.7 }); } };
function fxSword(k: K): void {
  haze(k, 0, -8.6, 5.6, 4.6, RELIC, 0.12);
  rays(k, 0, -8.6, fxCount(k, 2, 4), 6 + 4 * bloom(k), -2.6, -0.5, RELIC, 0.6);
  prisms(k, [[-4.6, -14], [4.8, -22], [0.8, -35.2], [-10.4, -11.0]]);
}
function fxAxe(k: K): void {
  haze(k, 0, -26.4, 4.4, 3.6, RELIC, 0.12);
  prisms(k, [[-12.6, -21], [12.6, -21], [0, -32.0], [-7.4, -29.6]]);
}
function fxBow(k: K): void {
  haze(k, 7.2, 0, 4.6, 4.6, RELIC, 0.14);
  prisms(k, [[10.4, -3], [9.6, 4], [8.6, -12], [8.6, 12]]);
}
function fxStaff(k: K): void {
  haze(k, 0, -47.0, 7.6, 8.4, RELIC, 0.14);
  rays(k, 0, -47.0, 3 + fxCount(k, 3, 6), 11 + 7 * bloom(k), -Math.PI * 0.95, -Math.PI * 0.05, RELIC, 0.8);
  prisms(k, [[-8.4, -50], [8.4, -46], [0, -58.0], [-6.0, -40]], 2.4, 5);
}
function fxWand(k: K): void {
  haze(k, 0, -17.0, 3.6, 3.4, RELIC, 0.14);
  prisms(k, [[3.6, -19.0], [-3.2, -16.0], [0.4, -23.4]], 1.6, 3);
}

export const RELIQUARY: SeriesInfo = {
  id: 'reliquary', gen: 6, name: 'Reliquary', maker: 'the dome-makers of the Glass Reliquary', zones: 'endgame at level 70 (the Faultline, the Glass Reliquary)', levels: '70',
  shape: 'glass panes leaded in bronze, ribbed domes, gold finials; strict symmetry',
  palette: [{ name: 'bronze', hex: BRONZE }, { name: 'bronze light', hex: BRONZE_L }, { name: 'reliquary glass', hex: GLASS }, { name: 'gold finials', hex: GOLD }, { name: 'relic light', hex: RELIC }],
  motif: 'a small ribbed glass dome with a gold finial; bronze leading',
  late: 'a relic glowing inside the staff\'s dome; the glass lights up with craft (dark → dim → bright)',
  effects: 'prismatic glints off the glass, relic glare and rays through the dome, the panes pulsing; shard impacts',
  draw: { blade: withFx(sword, fxSword), axe: withFx(axe, fxAxe), bow: withFx(bow, fxBow), staff: withFx(staff, fxStaff), wand: withFx(wand, fxWand) },
};
