// Zone kit art (docs/rework/worlds/DESIGN.md §1): every zone prop in the town's hand — ink outlines, light from the upper
// left, the same palette rules. Town painters are reused through the shared export (DECISIONS D-W05); new kinds below.
import type { Point } from '@shared/townTypes';
import { ellipse, hash, INK, line, poly, rrect, tone, type Paint } from './townKit';
import { TOWN_DECOR_ART, TOWN_PROP_ART, townBirchArt, townOakArt, townPineArt, townWillowArt, type TownArt } from './townScenery';

type Art = TownArt;
const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });
const shadow = (c: Paint, rx: number, ry = rx * 0.32) => ellipse(c, 2, 1, rx, ry, 'rgba(10,8,12,0.32)');

function rockShape(c: Paint, w: number, h: number, base: string, seed: number, moss = true) {
  const pts: Point[] = [[-w, 0], [-w * 1.04, -h * 0.42], [-w * 0.55, -h * 0.95], [w * 0.1, -h * 1.05], [w * 0.75, -h * 0.7], [w, -h * 0.2], [w * 0.9, 0]];
  poly(c, pts, base, INK, 1.4);
  poly(c, [[-w * 0.95, -h * 0.42], [-w * 0.55, -h * 0.92], [w * 0.05, -h * 1.0], [-w * 0.15, -h * 0.45]], tone(base, 1.18));
  line(c, [[-w * 0.2, -h * 0.5], [w * 0.15, -h * 0.25], [w * 0.05, -h * 0.05]], 'rgba(20,16,18,0.45)', 1.1);
  if (moss) for (let i = 0; i < 4; i++) ellipse(c, -w * 0.5 + hash(i, 1, seed) * w * 0.9, -h * 0.9 + hash(i, 2, seed) * h * 0.2, 6 + hash(i, 3, seed) * 6, 3, i % 2 ? '#4f7a3c' : '#5f8a44');
}
function deadTree(s: number, v: number): Art {
  const h = 120 * s;
  return { box: box(-60 * s, -h - 20, 60 * s, 8), draw: (c) => {
    shadow(c, 26 * s);
    poly(c, [[-8 * s, 0], [-5 * s, -h * 0.6], [-3 * s, -h], [3 * s, -h], [5 * s, -h * 0.55], [9 * s, 0]], '#4a3a30', INK, 1.4);
    const br = (x: number, y: number, dx: number, dy: number, w: number) => line(c, [[x, y], [x + dx, y + dy]], '#4a3a30', w);
    for (const [y, dx, dy] of [[0.45, -34, -30], [0.55, 30, -36], [0.75, -26, -22], [0.82, 22, -26]] as const) { br(0, -h * y, dx * s, dy * s, 3.2 * s); br(dx * s, -h * y + dy * s, dx * 0.4 * s, -14 * s, 1.8 * s); }
    line(c, [[-2 * s, -6], [-1 * s, -h * 0.9]], 'rgba(255,224,180,0.16)', 2 * s); void v;
  } };
}
function bush(s: number, v: number, dark = '#2c4a26', mid = '#3f6a34', lit = '#6a8a44'): Art {
  return { box: box(-40 * s, -50 * s, 40 * s, 8), draw: (c) => {
    shadow(c, 30 * s);
    const blobs: [number, number, number][] = [[-16, -16, 17], [14, -18, 16], [0, -28, 18], [-24, -6, 12], [24, -7, 12]];
    for (const [x, y, r] of blobs) ellipse(c, x * s, y * s + 2, r * s + 2, r * 0.85 * s + 2, INK);
    for (const [x, y, r] of blobs) ellipse(c, x * s, y * s, r * s, r * 0.85 * s, dark);
    for (const [x, y, r] of blobs) ellipse(c, x * s - 3, y * s - 3, r * 0.7 * s, r * 0.55 * s, mid);
    for (const [x, y, r] of blobs) ellipse(c, x * s - 6, y * s - 6, r * 0.32 * s, r * 0.22 * s, lit);
    if (v === 1) for (let i = 0; i < 6; i++) ellipse(c, (-20 + hash(i, 1, v) * 40) * s, (-30 + hash(i, 2, v) * 26) * s, 2.4, 2.4, '#d8484a');
    if (v === 2) for (let i = 0; i < 6; i++) ellipse(c, (-20 + hash(i, 3, v) * 40) * s, (-30 + hash(i, 4, v) * 26) * s, 2.2, 2.2, '#f2e6c8');
  } };
}
function crag(s: number, v: number, base = '#7d786d'): Art {
  const w = 52 * s, h = (90 + v * 18) * s;
  return { box: box(-w - 6, -h - 12, w + 8, 8), draw: (c) => {
    shadow(c, w);
    poly(c, [[-w, 0], [-w * 0.9, -h * 0.5], [-w * 0.45, -h * 0.85], [-w * 0.05, -h], [w * 0.4, -h * 0.82], [w * 0.8, -h * 0.45], [w, 0]], base, INK, 1.5);
    poly(c, [[-w * 0.85, -h * 0.5], [-w * 0.45, -h * 0.82], [-w * 0.05, -h * 0.96], [-w * 0.2, -h * 0.4]], tone(base, 1.2));
    poly(c, [[w * 0.4, -h * 0.8], [w * 0.8, -h * 0.45], [w * 0.92, -h * 0.05], [w * 0.35, -h * 0.25]], tone(base, 0.72));
    for (let k = 0; k < 4; k++) line(c, [[-w * 0.8 + k * w * 0.4, -h * (0.2 + hash(k, 1, v) * 0.5)], [-w * 0.6 + k * w * 0.4, -h * (0.25 + hash(k, 2, v) * 0.5)]], 'rgba(20,16,18,0.4)', 1.2);
    ellipse(c, -w * 0.2, -h * 0.94, w * 0.3, 5, '#5a7a3c');
  } };
}
function heap(s: number, v: number, base: string, light: string, spark = false): Art {
  const w = 48 * s, h = 42 * s;
  return { box: box(-w - 4, -h - 8, w + 4, 8), draw: (c) => {
    shadow(c, w * 0.9);
    c.beginPath(); c.moveTo(-w, 0); c.quadraticCurveTo(-w * 0.6, -h * 0.9, 0, -h); c.quadraticCurveTo(w * 0.6, -h * 0.9, w, 0); c.closePath();
    c.fillStyle = base; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
    c.beginPath(); c.moveTo(-w * 0.7, -h * 0.3); c.quadraticCurveTo(-w * 0.4, -h * 0.9, 0, -h * 0.94); c.quadraticCurveTo(-w * 0.2, -h * 0.5, -w * 0.7, -h * 0.3); c.fillStyle = light; c.fill();
    for (let i = 0; i < 14; i++) { const x = -w * 0.8 + hash(i, 1, v) * w * 1.6, y = -hash(i, 2, v) * h * 0.8; ellipse(c, x, y, 3, 2, spark && i % 4 === 0 ? '#ff8a3a' : tone(base, 0.8 + hash(i, 3, v) * 0.5)); }
  } };
}
const ART: Record<string, (s: number, v: number) => Art> = {
  pine: (s, v) => townPineArt(s, v), oak: (s, v) => townOakArt(s, v), birch: (s, v) => townBirchArt(s, v), willow: (s, v) => townWillowArt(s, v),
  deadtree: deadTree,
  bush: (s, v) => bush(s, v), reedclump: (s, v) => ({ box: box(-36 * s, -60 * s, 36 * s, 8), draw: (c) => {
    shadow(c, 26 * s, 6);
    for (let i = 0; i < 24; i++) { const x = (-28 + hash(i, 1, v) * 56) * s, h = (30 + hash(i, 2, v) * 26) * s; line(c, [[x, 0], [x + (hash(i, 3, v) - 0.5) * 10, -h]], i % 3 ? '#4a6a34' : '#8a8a4a', 1.8); if (i % 5 === 0) rrect(c, x - 2, -h - 3, 4, 10, 2, '#6a4a2e'); }
  } }),
  rock: (s, v) => ({ box: box(-34 * s, -44 * s, 34 * s, 8), draw: (c) => { shadow(c, 28 * s); rockShape(c, 26 * s, 30 * s, '#7a766c', v); } }),
  boulder: (s, v) => ({ box: box(-44 * s, -58 * s, 44 * s, 8), draw: (c) => { shadow(c, 36 * s); rockShape(c, 34 * s, 44 * s, ['#7a766c', '#6e6a60', '#857f72'][v % 3], v); } }),
  crag: (s, v) => crag(s, v), stump: (s) => ({ box: box(-26 * s, -34 * s, 26 * s, 8), draw: (c) => {
    shadow(c, 20 * s); poly(c, [[-18 * s, 0], [-15 * s, -18 * s], [15 * s, -18 * s], [19 * s, 0], [8 * s, 4], [-6 * s, 4]], '#5a4030', INK, 1.3);
    ellipse(c, 0, -18 * s, 15 * s, 5.5 * s, '#b8946a', INK, 1.1); ellipse(c, 0, -18 * s, 9 * s, 3 * s, undefined, '#8a6a46', 1);
  } }),
  slagheap: (s, v) => heap(s, v, '#3e3532', '#5a4e48', true), saltpile: (s, v) => heap(s, v, '#d8d2c0', '#f4f0e4'),
  coalpile: (s, v) => heap(s * 0.6, v, '#2a2422', '#4a403a', true),
  pillar: (s, v) => ({ box: box(-26 * s, -130 * s, 26 * s, 8), draw: (c) => {
    shadow(c, 22 * s); rrect(c, -20 * s, -14 * s, 40 * s, 14 * s, 2, '#6e6a62', INK, 1.3);
    const top = v === 1 ? -80 * s : -118 * s, g = c.createLinearGradient(-13 * s, 0, 13 * s, 0); g.addColorStop(0, '#9a958a'); g.addColorStop(0.45, '#7e796e'); g.addColorStop(1, '#55514a');
    c.fillStyle = g; c.fillRect(-13 * s, top, 26 * s, -14 * s - top); c.strokeStyle = INK; c.lineWidth = 1.2; c.strokeRect(-13 * s, top, 26 * s, -14 * s - top);
    if (v === 1) poly(c, [[-13 * s, top], [-4 * s, top - 10 * s], [5 * s, top + 2], [13 * s, top - 6 * s], [13 * s, top + 4]], '#7e796e', INK, 1);
    else rrect(c, -19 * s, top - 12 * s, 38 * s, 12 * s, 2, '#8a857a', INK, 1.2);
    for (const k of [-6, 0, 6]) line(c, [[k * s, top + 8], [k * s, -16 * s]], 'rgba(30,26,24,0.3)', 1.2);
  } }),
  kilnpot: (s, v) => ({ box: box(-44 * s, -96 * s, 44 * s, 8), draw: (c) => {
    shadow(c, 38 * s);
    c.beginPath(); c.moveTo(-34 * s, 0); c.quadraticCurveTo(-46 * s, -50 * s, -18 * s, -84 * s); c.lineTo(18 * s, -84 * s); c.quadraticCurveTo(46 * s, -50 * s, 34 * s, 0); c.closePath();
    c.fillStyle = '#6a4a3a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
    for (let r = 0; r < 5; r++) line(c, [[-36 * s + r * 2, -12 * s - r * 15 * s], [36 * s - r * 2, -12 * s - r * 15 * s]], 'rgba(30,18,12,0.35)', 1.2);
    ellipse(c, 0, -84 * s, 18 * s, 6 * s, '#2a1a16', INK, 1.2); ellipse(c, 0, -84 * s, 10 * s, 3 * s, v ? '#ff7a2a' : '#c85a22');
    rrect(c, -12 * s, -34 * s, 24 * s, 22 * s, 6, '#2a1a16', INK, 1.1); ellipse(c, 0, -20 * s, 8 * s, 5 * s, '#ff9a4a');
  } }),
  relaymast: (s) => ({ box: box(-40 * s, -190 * s, 40 * s, 8), draw: (c) => {
    shadow(c, 30 * s); rrect(c, -26 * s, -30 * s, 52 * s, 30 * s, 3, '#5a5650', INK, 1.3);
    line(c, [[-20 * s, -30 * s], [0, -180 * s], [20 * s, -30 * s]], '#6a5a42', 5); line(c, [[-14 * s, -80 * s], [14 * s, -80 * s]], '#6a5a42', 3); line(c, [[-9 * s, -125 * s], [9 * s, -125 * s]], '#6a5a42', 3);
    rrect(c, -18 * s, -176 * s, 36 * s, 22 * s, 3, '#2a2420', '#9a8054', 3); for (let i = 0; i < 4; i++) rrect(c, (-14 + i * 8) * s, -172 * s, 5 * s, 14 * s, 1, '#d4af37');
  } }),
  signalflag: (s, v) => ({ box: box(-10, -120 * s, 50 * s, 6), draw: (c) => {
    rrect(c, -2.5, -114 * s, 5, 114 * s, 1.5, '#4a3424', INK, 1); const col = ['#c83a2a', '#e8c35a', '#2a6a9a'][v % 3];
    c.beginPath(); c.moveTo(3, -112 * s); c.quadraticCurveTo(24 * s, -104 * s, 44 * s, -110 * s); c.lineTo(42 * s, -84 * s); c.quadraticCurveTo(22 * s, -80 * s, 3, -86 * s); c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.1; c.stroke();
  } }),
  brokencart: () => ({ box: box(-62, -70, 62, 12), draw: (c) => {
    shadow(c, 54, 12);
    c.save(); c.translate(0, -6); c.rotate(-0.12);
    rrect(c, -44, -36, 80, 20, 2, '#6a4a30', INK, 1.4); for (let x = -40; x < 34; x += 11) line(c, [[x, -35], [x + 2, -17]], 'rgba(20,12,8,0.45)', 1);
    line(c, [[-56, -22], [-44, -24]], '#5a4030', 4); c.restore();
    ellipse(c, 22, -12, 15, 15, '#4a3424', INK, 1.4); ellipse(c, 22, -12, 10, 10, undefined, '#7a5a3a', 2);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; line(c, [[22, -12], [22 + Math.cos(a) * 11, -12 + Math.sin(a) * 11]], '#7a5a3a', 1.6); }
    c.save(); c.translate(-30, 4); c.rotate(1.2); ellipse(c, 0, 0, 14, 5, '#4a3424', INK, 1.2); c.restore();
    ellipse(c, 4, -46, 14, 9, '#c8b48a', INK, 1.1); line(c, [[-4, -50], [12, -42]], 'rgba(90,60,30,0.5)', 1);
  } }),
  crate: (s, v) => ({ box: box(-20 * s, -38 * s, 20 * s, 6), draw: (c) => {
    shadow(c, 18 * s); const col = ['#8a6a42', '#7a5c3a', '#94744a'][v % 3];
    rrect(c, -15 * s, -34 * s, 30 * s, 8 * s, 1.5, tone(col, 1.15), INK, 1.1); rrect(c, -15 * s, -26 * s, 30 * s, 26 * s, 1.5, col, INK, 1.2);
    line(c, [[-12 * s, -3 * s], [12 * s, -23 * s]], tone(col, 0.75), 2.4); line(c, [[-13 * s, -13 * s], [13 * s, -13 * s]], 'rgba(20,12,8,0.45)', 1);
  } }),
  sack: () => ({ box: box(-18, -32, 18, 6), draw: (c) => { shadow(c, 14); c.beginPath(); c.moveTo(-13, 0); c.quadraticCurveTo(-18, -18, -6, -26); c.lineTo(6, -26); c.quadraticCurveTo(18, -18, 13, 0); c.closePath(); c.fillStyle = '#b8a47a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke(); line(c, [[-6, -24], [6, -24]], '#6a5030', 2); } }),
  sawhorse: () => ({ box: box(-40, -50, 40, 6), draw: (c) => { shadow(c, 30); for (const x of [-26, 26]) { line(c, [[x - 8, 0], [x + 4, -30]], '#5a4030', 4); line(c, [[x + 8, 0], [x - 4, -30]], '#5a4030', 4); } rrect(c, -34, -36, 68, 9, 3, '#b8946a', INK, 1.2); ellipse(c, 34, -32, 4, 4.5, '#8a6a46', INK, 1); } }),
  pickaxe: () => ({ box: box(-26, -36, 26, 6), draw: (c) => { line(c, [[-18, 0], [12, -26]], '#6a4a2e', 3.4); c.beginPath(); c.moveTo(0, -32); c.quadraticCurveTo(14, -32, 24, -18); c.quadraticCurveTo(12, -26, 4, -24); c.closePath(); c.fillStyle = '#6a6e72'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke(); } }),
  rake: () => ({ box: box(-30, -70, 30, 6), draw: (c) => { line(c, [[-14, 0], [10, -60]], '#8a6a46', 3); line(c, [[0, -62], [22, -56]], '#5a5650', 3); for (let k = 0; k < 5; k++) line(c, [[2 + k * 5, -61 + k * 1.2], [2 + k * 5, -54 + k * 1.2]], '#5a5650', 1.6); } }),
  grave: (s, v) => ({ box: box(-20, -50, 20, 8), draw: (c) => {
    shadow(c, 16); const col = ['#8a857a', '#7a756a', '#9a958a'][v % 3];
    if (v === 2) { line(c, [[0, 0], [0, -40]], '#6a5a48', 4.4); line(c, [[-12, -28], [12, -28]], '#6a5a48', 4.4); return; }
    c.beginPath(); c.moveTo(-12, 0); c.lineTo(-12, -30); c.quadraticCurveTo(0, -46, 12, -30); c.lineTo(12, 0); c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke();
    line(c, [[-6, -26], [6, -26]], 'rgba(30,26,24,0.45)', 1.2); line(c, [[-5, -20], [5, -20]], 'rgba(30,26,24,0.35)', 1); ellipse(c, -6, -2, 6, 2.4, '#4f7a3c'); void s;
  } }),
  cairn: (s) => ({ box: box(-28 * s, -64 * s, 28 * s, 8), draw: (c) => { shadow(c, 24 * s); for (let k = 0; k < 5; k++) { const w = (22 - k * 3.6) * s; ellipse(c, (k % 2 ? 2 : -2) * s, (-8 - k * 11) * s, w, 7 * s, tone('#8a857a', 0.8 + k * 0.08), INK, 1.2); } } }),
  campfire: () => ({ box: box(-30, -26, 30, 10), draw: (c) => {
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; ellipse(c, Math.cos(a) * 22, Math.sin(a) * 9 - 2, 7, 5, tone('#7a756a', 0.8 + hash(i, 1, 3) * 0.4), INK, 1); }
    ellipse(c, 0, -2, 15, 6, '#2a1a16'); line(c, [[-14, -6], [12, 2]], '#5a3e28', 5); line(c, [[-10, 3], [14, -7]], '#4a3424', 5);
    ellipse(c, 0, -4, 9, 4, '#ff8a3a'); ellipse(c, 0, -5, 5, 2.4, '#ffe08a');
  } }),
  lamppost: (s) => TOWN_PROP_ART.lamp(78 * s, 0),
};
/** Kinds painted flat into the ground chunks (never sorted). */
export const ZONE_FLAT = new Set(['flowers', 'mushrooms', 'rubble', 'reeds', 'lilypads', 'nets', 'fern', 'fernbed', 'tuft', 'puddle', 'cracks', 'embers', 'bones', 'saltcrust', 'snowpatch', 'leaves', 'rubblepile', 'stumpflat']);
/** Tall enough to hide the hero: ghost while the hero stands behind. */
export const ZONE_TALL = new Set(['pine', 'oak', 'birch', 'willow', 'deadtree', 'crag', 'pillar', 'relaymast', 'tent']);
/** Height used by the town's prop painters (lamp, well…) when they are placed by a zone. */
const TOWN_H: Record<string, number> = { lamp: 78, brazier: 44, 'stone-lantern': 52, noticeboard: 74, barrel: 30, barrels: 30, crates: 26, fishcrates: 0, rack: 64, column: 110, ruin: 60, cart: 0, well: 0, anvil: 0, netrack: 58, bollard: 0, table: 0, cask: 0 };

/** Art for a zone kind at scale s, variant v (null: unknown kind, skipped). */
export function zoneArt(kind: string, s: number, v: number): Art | null {
  const own = ART[kind];
  if (own) return own(s, v);
  const town = TOWN_PROP_ART[kind];
  if (town) return town((TOWN_H[kind] ?? 40) * (kind === 'column' || kind === 'ruin' ? s : 1), v);
  const decor = TOWN_DECOR_ART[kind];
  return decor ? decor(s, v) : null;
}
/** Ground footprint for soft shadows of sorted kinds. */
export function zoneShadow(kind: string, s: number): number {
  return ({ pine: 32, oak: 44, birch: 28, willow: 48, deadtree: 24, crag: 50, boulder: 34, rock: 26, tent: 46, logpile: 32, hay: 30, pillar: 20, kilnpot: 36, slagheap: 44, saltpile: 44, relaymast: 30, brokencart: 46, well: 34 } as Record<string, number>)[kind] ?? 16 * s;
}

/** Flat decor painted into a ground chunk (world coordinates). */
export function paintFlat(c: Paint, kind: string, x: number, y: number, s: number, v: number) {
  const seed = Math.round(x * 3 + y * 7);
  switch (kind) {
    case 'flowers': for (let i = 0; i < 22; i++) { const fx = x + (hash(i, 1, seed) - 0.5) * 70 * s, fy = y + (hash(i, 2, seed) - 0.5) * 30 * s; line(c, [[fx, fy], [fx, fy - 6]], '#3f6a34', 1.2); ellipse(c, fx, fy - 7, 2.6, 2.2, ['#e0475a', '#f2c94c', '#f4efe2', '#e98ab4', '#9b7ad8'][(i + v) % 5]); } break;
    case 'mushrooms': for (let i = 0; i < 6; i++) { const mx = x + (hash(i, 1, seed) - 0.5) * 40, my = y + (hash(i, 2, seed) - 0.5) * 20; rrect(c, mx - 1.4, my - 6, 2.8, 6, 1, '#efe6d2'); ellipse(c, mx, my - 6, 5, 3, i % 2 ? '#b83a2a' : '#8a6a46', INK, 0.7); } break;
    case 'rubble': case 'rubblepile': for (let i = 0; i < (kind === 'rubblepile' ? 14 : 8); i++) { const rx = x + (hash(i, 1, seed) - 0.5) * 70 * s, ry = y + (hash(i, 2, seed) - 0.5) * 30 * s, r = 4 + hash(i, 3, seed) * 7; poly(c, [[rx - r, ry], [rx - r * 0.4, ry - r * 0.8], [rx + r, ry - r * 0.5], [rx + r * 0.8, ry + r * 0.3]], tone('#8a8478', 0.75 + hash(i, 4, seed) * 0.4), INK, 0.9); } break;
    case 'reeds': for (let i = 0; i < 18; i++) { const rx = x + (hash(i, 1, seed) - 0.5) * 80 * s, ry = y + (hash(i, 2, seed) - 0.5) * 40 * s, h = 16 + hash(i, 3, seed) * 18; line(c, [[rx, ry], [rx + (hash(i, 4, seed) - 0.5) * 6, ry - h]], i % 3 ? '#4a6a34' : '#8a8a4a', 1.5); if (i % 5 === 0) rrect(c, rx - 1.5, ry - h - 2, 3, 7, 1.5, '#6a4a2e'); } break;
    case 'lilypads': for (let i = 0; i < 7; i++) { const lx = x + (hash(i, 1, seed) - 0.5) * 100, ly = y + (hash(i, 2, seed) - 0.5) * 40, r = 7 + hash(i, 3, seed) * 6; c.beginPath(); c.ellipse(lx, ly, r, r * 0.55, 0, 0.3, Math.PI * 2 - 0.1); c.lineTo(lx, ly); c.closePath(); c.fillStyle = i % 2 ? '#4f7a3c' : '#3f6a34'; c.fill(); } break;
    case 'nets': c.save(); c.globalAlpha = 0.8; poly(c, [[x - 50, y - 8], [x - 8, y - 22], [x + 46, y - 12], [x + 34, y + 14], [x - 42, y + 12]], 'rgba(120,110,80,0.5)'); for (let k = 0; k < 8; k++) line(c, [[x - 46 + k * 11, y - 16], [x - 40 + k * 10, y + 12]], 'rgba(60,50,30,0.55)', 0.8); c.restore(); break;
    case 'fern': case 'fernbed': for (let i = 0; i < (kind === 'fernbed' ? 7 : 4); i++) { const fx = x + (hash(i, 1, seed) - 0.5) * 50 * s, fy = y + (hash(i, 2, seed) - 0.5) * 22 * s; for (let k = -2; k <= 2; k++) line(c, [[fx, fy], [fx + k * 7 * s, fy - (12 - Math.abs(k) * 2) * s]], k % 2 ? '#3f6a34' : '#5a8a44', 1.6); } break;
    case 'tuft': for (let i = 0; i < 9; i++) { const tx = x + (hash(i, 1, seed) - 0.5) * 30 * s, ty = y + (hash(i, 2, seed) - 0.5) * 12 * s; line(c, [[tx, ty], [tx - 2 + hash(i, 3, seed) * 4, ty - 6 - hash(i, 4, seed) * 7]], i % 2 ? '#6a8a44' : '#4f7a3c', 1.4); } break;
    case 'puddle': ellipse(c, x, y, 26 * s, 10 * s, 'rgba(40,62,72,0.55)'); ellipse(c, x - 4, y - 2, 14 * s, 2.6, 'rgba(160,190,200,0.28)'); break;
    case 'cracks': for (let k = 0; k < 3; k++) { const a = hash(k, 1, seed) * 6.28; line(c, [[x, y], [x + Math.cos(a) * 16 * s, y + Math.sin(a) * 6 * s], [x + Math.cos(a + 0.4) * 30 * s, y + Math.sin(a + 0.4) * 11 * s]], 'rgba(20,14,14,0.45)', 1.2); } break;
    case 'embers': for (let k = 0; k < 4; k++) { const a = hash(k, 1, seed) * 6.28, l = (12 + hash(k, 2, seed) * 16) * s; line(c, [[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l * 0.4]], '#2a1a16', 3); line(c, [[x, y], [x + Math.cos(a) * l * 0.8, y + Math.sin(a) * l * 0.32]], 'rgba(255,120,40,0.75)', 1.3); } break;
    case 'bones': line(c, [[x - 12, y], [x + 12, y - 3]], '#e8e0cc', 3); ellipse(c, x - 13, y, 3, 3, '#e8e0cc', INK, 0.6); ellipse(c, x + 13, y - 3, 3, 3, '#e8e0cc', INK, 0.6); ellipse(c, x + 6, y + 8, 6, 5, '#e8e0cc', INK, 0.8); ellipse(c, x + 4, y + 8, 1.5, 1.5, '#2a2420'); ellipse(c, x + 8, y + 8, 1.5, 1.5, '#2a2420'); break;
    case 'saltcrust': for (let i = 0; i < 8; i++) { const sx = x + (hash(i, 1, seed) - 0.5) * 70 * s, sy = y + (hash(i, 2, seed) - 0.5) * 30 * s; poly(c, [[sx - 9, sy], [sx - 2, sy - 4], [sx + 8, sy - 1], [sx + 3, sy + 4]], 'rgba(246,242,230,0.75)', 'rgba(150,140,120,0.5)', 0.8); } break;
    case 'snowpatch': c.save(); c.filter = 'blur(2px)'; for (let i = 0; i < 6; i++) ellipse(c, x + (hash(i, 1, seed) - 0.5) * 50 * s, y + (hash(i, 2, seed) - 0.5) * 16 * s, (8 + hash(i, 3, seed) * 12) * s, (3 + hash(i, 4, seed) * 4) * s, 'rgba(232,238,242,0.42)'); c.restore(); break;
    case 'leaves': for (let i = 0; i < 10; i++) { const lx = x + (hash(i, 1, seed) - 0.5) * 50, ly = y + (hash(i, 2, seed) - 0.5) * 22; poly(c, [[lx - 3, ly], [lx, ly - 2.5], [lx + 4, ly + 1], [lx + 1, ly + 3]], ['#8a6a3a', '#a8783a', '#6d6a40'][i % 3]); } break;
    case 'stumpflat': poly(c, [[x - 14, y], [x - 12, y - 10], [x + 12, y - 10], [x + 15, y]], '#5a4030', INK, 1.1); ellipse(c, x, y - 10, 12, 4.5, '#b8946a', INK, 1); break;
  }
}
