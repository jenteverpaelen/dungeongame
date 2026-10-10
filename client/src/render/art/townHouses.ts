// Hearthmere architecture (docs/rework/DESIGN.md §4): houses painted from their TownBuildingKit — walls, roofs with
// real tile courses, windows, doors, signs, awnings, chimneys, the forge hearth, round towers, the glass dome, the
// lighthouse lantern room and the inn cutaway — baked once into depth-sliced sprites (front baseline = depth).
import { CanvasSource, Rectangle, Sprite, Texture } from 'pixi.js';
import { baselineY } from '@shared/townDepth';
import type { Point, TownBuilding, TownBuildingKit, TownData } from '@shared/townTypes';
import type { MapLayers } from './index';
import { ellipse, fbm, hash, INK, line, poly, rgba, rrect, tone, type Paint } from './townKit';

const DENSITY = 2, STRIP = 4;
type V3 = [number, number, number];
type Bounds = { x0: number; y0: number; x1: number; y1: number };
const proj = (v: V3): Point => [v[0], v[1] - v[2]];
/** Sun from the north-west, high (upper left on screen). */
const SUN: V3 = [-0.55, -0.15, 0.82];
const seedOf = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) % 100000; };

function bake(b: Bounds, baseline: Point[], draw: (c: Paint) => void, building?: string): MapLayers['sorted'] {
  const x0 = Math.floor(b.x0 - 4), y0 = Math.floor(b.y0 - 4), w = Math.ceil(b.x1 + 4 - x0), h = Math.ceil(b.y1 + 4 - y0);
  const canvas = document.createElement('canvas'); canvas.width = w * DENSITY; canvas.height = h * DENSITY;
  const c = canvas.getContext('2d')!; c.setTransform(DENSITY, 0, 0, DENSITY, -x0 * DENSITY, -y0 * DENSITY); draw(c);
  const source = new CanvasSource({ resource: canvas, resolution: DENSITY, scaleMode: 'linear', autoGenerateMipmaps: false });
  const strip = baseline.every((p) => Math.abs(p[1] - baseline[0][1]) < 0.5) ? w : STRIP;
  const out: MapLayers['sorted'] = [];
  let live = Math.ceil(w / strip);
  for (let x = 0; x < w; x += strip) {
    const width = Math.min(strip, w - x), depth = baselineY(baseline, x0 + x + width / 2);
    const texture = new Texture({ source, frame: new Rectangle(x, 0, width, h) });
    const view = new Sprite(texture); view.position.set(x0 + x, y0);
    view.on('destroyed', () => { texture.destroy(false); if (--live === 0) source.destroy(); });
    out.push({ view, y: depth, bounds: { x0: x0 + x, x1: x0 + x + width, y0, y1: y0 + h }, ...(building ? { building } : {}) });
  }
  return out;
}

// ─────────────────────────── wall materials (local: x 0..L along the wall, y = −height) ───────────────────────────

function grime(c: Paint, L: number, h = 38, a = 0.38) {
  const g = c.createLinearGradient(0, 0, 0, -h); g.addColorStop(0, `rgba(40,28,26,${a})`); g.addColorStop(1, 'rgba(40,28,26,0)');
  c.fillStyle = g; c.fillRect(-2, -h, L + 4, h);
}
function plaster(c: Paint, L: number, H: number, base: string, seed: number) {
  c.fillStyle = base; c.fillRect(-2, -H - 4, L + 4, H + 6);
  for (let i = 0; i < L * H / 240; i++) {
    const x = hash(i, 1, seed) * L, y = -hash(i, 2, seed) * H, r = 6 + hash(i, 3, seed) * 18;
    ellipse(c, x, y, r, r * 0.7, hash(i, 4, seed) > 0.5 ? 'rgba(255,248,230,0.08)' : 'rgba(70,46,46,0.07)');
  }
  for (let i = 0; i < Math.round(L / 80); i++) {
    const x = hash(i, 9, seed) * L, y = -24 - hash(i, 10, seed) * Math.max(10, H - 50);
    line(c, [[x, y], [x + 4, y + 7], [x + 2, y + 13], [x + 7, y + 19]], 'rgba(70,50,44,0.45)', 0.9);
  }
  grime(c, L);
}
function ashlar(c: Paint, L: number, H: number, base: string, seed: number) {
  c.fillStyle = tone(base, 0.52); c.fillRect(-2, -H - 4, L + 4, H + 6);
  let y = 0, row = 0;
  while (y > -H - 20) {
    const rh = 15 + hash(row, 1, seed) * 6;
    let x = -((row % 2) * 14) - hash(row, 2, seed) * 10;
    while (x < L) {
      const w = 22 + hash(Math.round(x), row, seed) * 22;
      const k = 0.84 + hash(row, Math.round(x), seed + 3) * 0.28 + (fbm(x / 90, y / 90, seed) - 0.5) * 0.24;
      rrect(c, x + 1, y - rh + 1, w - 2, rh - 2, 2.4, tone(base, k));
      c.fillStyle = 'rgba(255,244,220,0.16)'; c.fillRect(x + 2.5, y - rh + 1.6, w - 6, 1.5);
      c.fillStyle = 'rgba(16,12,18,0.24)'; c.fillRect(x + 2, y - 3, w - 4, 1.6);
      x += w;
    }
    y -= rh; row++;
  }
  grime(c, L, 30, 0.3);
}
function boards(c: Paint, L: number, H: number, base: string, seed: number) {
  for (let x = 0; x < L; x += 12) {
    c.fillStyle = tone(base, 0.8 + hash(x, 0, seed) * 0.32); c.fillRect(x, -H - 4, 11.2, H + 6);
    c.fillStyle = 'rgba(255,230,190,0.1)'; c.fillRect(x + 1, -H - 4, 1.4, H + 6);
    c.fillStyle = 'rgba(16,10,8,0.6)'; c.fillRect(x + 11.2, -H - 4, 1, H + 6);
    if (hash(x, 3, seed) > 0.72) ellipse(c, x + 5, -hash(x, 4, seed) * H, 1.8, 2.6, 'rgba(40,24,16,0.6)');
  }
  for (const y of [-12, -H + 12]) { c.fillStyle = tone(base, 0.66); c.fillRect(-2, y - 4, L + 4, 8); c.fillStyle = 'rgba(255,230,190,0.14)'; c.fillRect(-2, y - 4, L + 4, 1.4); }
  grime(c, L, 26, 0.32);
}
function plinth(c: Paint, L: number, seed: number, h = 16) {
  c.fillStyle = '#4a4440'; c.fillRect(-1, -h, L + 2, h);
  for (let row = 0; row < 2; row++) for (let x = -(row * 9); x < L; ) {
    const w = 16 + hash(Math.round(x), row + 3, seed) * 10;
    rrect(c, x + 1, -h + row * (h / 2) + 1, w - 2, h / 2 - 1.6, 2, tone('#8c8478', 0.78 + hash(Math.round(x), row + 5, seed) * 0.36));
    x += w;
  }
  line(c, [[0, -h], [L, -h]], 'rgba(20,14,14,0.5)', 1.4);
}
function quoins(c: Paint, L: number, H: number, seed: number) {
  for (const side of [0, 1]) for (let z = 0, i = 0; z < H - 4; i++) {
    const hh = 16, w = i % 2 ? 14 : 22, x = side ? L - w : 0;
    rrect(c, x + 0.5, -z - hh + 1, w - 1, hh - 1.6, 1.6, tone('#bdb2a0', 0.86 + hash(i, side, seed) * 0.22), 'rgba(30,22,22,0.5)', 1);
    z += hh;
  }
}
function timberFrame(c: Paint, L: number, H: number, trim: string) {
  const beam = (pts: Point[], w = 8) => {
    line(c, pts, tone(trim, 1), w, 'butt');
    line(c, pts.map(([x, y]) => [x - w * 0.3, y - w * 0.3] as Point), 'rgba(255,230,190,0.16)', 1.2, 'butt');
  };
  const mid = -Math.round(H * 0.5);
  beam([[0, -20], [L, -20]]); beam([[0, mid], [L, mid]]); beam([[0, -H + 4], [L, -H + 4]]);
  const n = Math.max(2, Math.round(L / 54));
  for (let i = 0; i <= n; i++) {
    const x = Math.min(L - 4, Math.max(4, (i * L) / n));
    beam([[x, 0], [x, -H]]);
    if (i < n) {
      const x2 = ((i + 1) * L) / n;
      if (i % 2 === 0) beam([[x + 4, -24], [x2 - 4, mid + 4]], 6); else beam([[x + 4, mid - 4], [x2 - 4, -H + 8]], 6);
    }
  }
}
function wallMaterial(c: Paint, kit: TownBuildingKit, L: number, H: number, seed: number) {
  switch (kit.wall) {
    case 'stone': ashlar(c, L, H, kit.wallColor, seed); break;
    case 'planks': boards(c, L, H, kit.wallColor, seed); break;
    case 'timber': plaster(c, L, H, kit.wallColor, seed); timberFrame(c, L, H, kit.trimColor); plinth(c, L, seed); break;
    default: plaster(c, L, H, kit.wallColor, seed); plinth(c, L, seed);
  }
}

// ─────────────────────────── facade features (same local frame) ───────────────────────────

const FLOWERS = ['#e0475a', '#f2c94c', '#f4efe2', '#e98ab4', '#9b7ad8'];
function windowAt(c: Paint, u: number, zb: number, w: number, h: number, kit: TownBuildingKit, lit: boolean, seed: number, box: boolean) {
  const x = u - w / 2, y = -zb - h;
  if (lit) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(u, y + h / 2, 2, u, y + h / 2, w * 1.25);
    g.addColorStop(0, 'rgba(255,186,100,0.26)'); g.addColorStop(1, 'rgba(255,186,100,0)');
    c.fillStyle = g; c.fillRect(u - w * 1.4, y - w * 0.7, w * 2.8, h + w * 1.4); c.restore();
  }
  const shutters = (kit.wall === 'plaster' || kit.wall === 'timber') && w < 34;
  if (shutters) for (const s of [-1, 1]) {
    const sx = s < 0 ? x - 4 - w * 0.44 : x + w + 4;
    rrect(c, sx, y - 2, w * 0.44, h + 4, 1.5, tone(kit.trimColor, 1.45), INK, 1.1);
    for (let k = 1; k < 3; k++) line(c, [[sx + (w * 0.44 * k) / 3, y], [sx + (w * 0.44 * k) / 3, y + h]], 'rgba(20,14,12,0.35)', 0.8);
  }
  rrect(c, x - 3.5, y - 3.5, w + 7, h + 7, 2, tone(kit.trimColor, 1), INK, 1.2);
  const g = c.createLinearGradient(0, y, 0, y + h);
  if (lit) { g.addColorStop(0, '#ffe7a8'); g.addColorStop(0.6, '#f6b25a'); g.addColorStop(1, '#d9772f'); }
  else { g.addColorStop(0, '#41505e'); g.addColorStop(1, '#1b232b'); }
  c.fillStyle = g; c.fillRect(x, y, w, h);
  if (lit) { ellipse(c, u + 3, y + h - 6, w * 0.28, 3, 'rgba(120,60,30,0.35)'); line(c, [[x + w * 0.62, y + h], [x + w * 0.62, y + h * 0.55]], 'rgba(90,40,24,0.4)', 2.4); }
  else line(c, [[x + 2, y + h - 4], [x + w - 6, y + 3]], 'rgba(170,200,220,0.28)', 2);
  if (kit.wall === 'stone' && !lit) for (let k = 1; k < 4; k++) line(c, [[x + (w * k) / 4, y], [x + (w * k) / 4, y + h]], '#26221f', 1.6);
  c.fillStyle = tone(kit.trimColor, 0.85); c.fillRect(u - 1.2, y, 2.4, h); c.fillRect(x, y + h * 0.42, w, 2.2);
  rrect(c, x - 5, y + h + 1.5, w + 10, 4, 1, '#bdb29c', INK, 1);
  if (box) {
    rrect(c, x - 6, y + h + 5, w + 12, 8, 2, '#6a4a2e', INK, 1.1);
    for (let i = 0; i < 9; i++) {
      const fx = x - 5 + (i * (w + 10)) / 8, fy = y + h + 4 + hash(i, 3, seed) * 2;
      ellipse(c, fx, fy + 2, 3.4, 2.4, '#3f6a34');
      if (i % 2 === 0) ellipse(c, fx + 1, fy + 10, 2, 4, '#4a7a3c');
      ellipse(c, fx, fy - 0.5, 2.4, 2.1, FLOWERS[(i + seed) % FLOWERS.length]);
    }
  }
}
function doorAt(c: Paint, u: number, w: number, kind: NonNullable<TownBuildingKit['doors']>[number]['kind'], kit: TownBuildingKit, seed: number) {
  const h = kind === 'double' ? 84 : kind === 'arch' ? 80 : 74, x = u - w / 2, rise = Math.min(w / 2, 14);
  const shape = (inset: number) => {
    c.beginPath(); c.moveTo(x + inset, 0); c.lineTo(x + inset, -h + rise);
    c.quadraticCurveTo(u, -h - rise + inset * 1.5, x + w - inset, -h + rise); c.lineTo(x + w - inset, 0); c.closePath();
  };
  rrect(c, x - 8, -3, w + 16, 6, 1.5, '#8c8578', INK, 1);
  // surround: dressed stone for stone/plaster, heavy timber otherwise
  shape(-6); c.fillStyle = kit.wall === 'stone' || kit.wall === 'plaster' ? '#a39a88' : tone(kit.trimColor, 0.9); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke();
  if (kit.wall === 'stone' || kit.wall === 'plaster') for (let k = 0; k <= 6; k++) {
    const a = Math.PI + (k / 6) * Math.PI, px = u + Math.cos(a) * (w / 2 + 3), py = -h + rise + Math.sin(a) * (rise * 2 + 2);
    line(c, [[px, py], [u + Math.cos(a) * (w / 2 - 3), -h + rise + Math.sin(a) * (rise * 2 - 4)]], 'rgba(30,24,22,0.6)', 1);
  }
  shape(0);
  if (kind === 'open' || kind === 'arch') {
    const g = c.createLinearGradient(0, -h, 0, 0);
    g.addColorStop(0, kind === 'open' ? '#5a2e18' : '#1a1418'); g.addColorStop(1, kind === 'open' ? '#e09048' : '#3a2a26');
    c.fillStyle = g; c.fill();
    if (kind === 'open') {
      c.save(); c.clip();
      c.globalCompositeOperation = 'lighter';
      const r = c.createRadialGradient(u, -10, 4, u, -20, w); r.addColorStop(0, 'rgba(255,200,120,0.5)'); r.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = r; c.fillRect(x, -h - rise, w, h + rise); c.restore();
      for (const s of [-1, 1]) poly(c, [[u + s * w / 2, 0], [u + s * (w / 2 - 10), 6], [u + s * (w / 2 - 10), -h + rise + 8], [u + s * w / 2, -h + rise]], '#5a3c24', INK, 1);
    }
    return;
  }
  c.save(); c.clip();
  const wood = kind === 'iron' ? '#3c3f44' : '#5e4128';
  c.fillStyle = wood; c.fillRect(x, -h - rise, w, h + rise);
  if (kind !== 'iron') for (let px = x; px < x + w; px += 8) { c.fillStyle = tone(wood, 0.82 + hash(Math.round(px), 1, seed) * 0.34); c.fillRect(px, -h - rise, 7.2, h + rise); }
  for (const y of [-h * 0.25, -h * 0.72]) { c.fillStyle = '#26221f'; c.fillRect(x, y - 2.5, w, 5); for (let px = x + 4; px < x + w; px += 10) ellipse(c, px, y, 1.2, 1.2, '#8a8478'); }
  if (kind === 'double' || w > 60) line(c, [[u, -h - rise], [u, 0]], INK, 2);
  if (kind === 'iron') for (let px = x + 6; px < x + w; px += 12) for (let py = -h + 10; py < -4; py += 12) ellipse(c, px, py, 1.4, 1.4, '#7a7e84');
  c.restore();
  ellipse(c, kind === 'double' ? u + 7 : x + w - 9, -h * 0.45, 2.6, 2.6, undefined, '#c9a65a', 1.6);
}
function emblem(c: Paint, kind: string, x: number, y: number) {
  const gold = '#e2c070', ink = '#1c140e';
  switch (kind) {
    case 'ember':
      ellipse(c, x, y + 7, 10, 3.4, '#5a2a18');
      c.beginPath(); c.moveTo(x, y + 6); c.bezierCurveTo(x - 10, y + 2, x - 4, y - 6, x - 1, y - 11); c.bezierCurveTo(x + 1, y - 5, x + 9, y - 2, x, y + 6);
      c.fillStyle = '#f08a3a'; c.fill(); c.strokeStyle = ink; c.lineWidth = 1; c.stroke();
      c.beginPath(); c.moveTo(x, y + 5); c.bezierCurveTo(x - 4, y + 2, x - 2, y - 2, x, y - 5); c.bezierCurveTo(x + 2, y - 1, x + 4, y + 2, x, y + 5); c.fillStyle = '#ffe08a'; c.fill();
      break;
    case 'hammer':
      line(c, [[x - 7, y + 9], [x + 5, y - 5]], '#8a6a44', 3); poly(c, [[x + 1, y - 10], [x + 11, y - 1], [x + 7, y + 3], [x - 3, y - 6]], '#b8c0c4', ink, 1);
      line(c, [[x + 7, y + 9], [x - 5, y - 5]], '#6a6e72', 2.2); line(c, [[x - 5, y - 5], [x - 9, y - 7]], '#6a6e72', 2.2);
      break;
    case 'gem':
      poly(c, [[x - 10, y - 3], [x - 5, y - 9], [x + 5, y - 9], [x + 10, y - 3], [x, y + 10]], '#6fe0d0', ink, 1.2);
      line(c, [[x - 10, y - 3], [x + 10, y - 3]], 'rgba(20,60,60,0.7)', 1); line(c, [[x - 5, y - 9], [x - 3, y - 3], [x, y + 10]], 'rgba(255,255,255,0.6)', 1);
      break;
    case 'key':
      ellipse(c, x - 6, y, 5, 5, undefined, gold, 2.6); line(c, [[x - 1, y], [x + 11, y]], gold, 2.6); line(c, [[x + 7, y], [x + 7, y + 5]], gold, 2.2); line(c, [[x + 10, y], [x + 10, y + 4]], gold, 2.2);
      break;
    case 'anchor':
      line(c, [[x, y - 9], [x, y + 8]], gold, 2.4); ellipse(c, x, y - 10, 2.6, 2.6, undefined, gold, 1.8); line(c, [[x - 5, y - 5], [x + 5, y - 5]], gold, 2);
      c.beginPath(); c.arc(x, y, 9, 0.2, Math.PI - 0.2); c.strokeStyle = gold; c.lineWidth = 2.4; c.stroke();
      break;
    case 'wheel':
      ellipse(c, x, y, 9, 9, undefined, gold, 2.2); ellipse(c, x, y, 2.4, 2.4, gold);
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; line(c, [[x, y], [x + Math.cos(a) * 9, y + Math.sin(a) * 9]], gold, 1.4); }
      break;
    case 'fish':
      ellipse(c, x - 1, y, 9, 4.6, '#a8c4cc', ink, 1); poly(c, [[x + 7, y], [x + 12, y - 5], [x + 12, y + 5]], '#a8c4cc', ink, 1); ellipse(c, x - 6, y - 1, 1, 1, ink);
      break;
    case 'eye':
      c.beginPath(); c.moveTo(x - 11, y); c.quadraticCurveTo(x, y - 9, x + 11, y); c.quadraticCurveTo(x, y + 9, x - 11, y); c.fillStyle = '#efe6d2'; c.fill();
      ellipse(c, x, y, 4.4, 4.4, '#9a6ae0'); ellipse(c, x, y, 1.8, 1.8, ink);
      break;
    default:
      poly(c, [[x - 7, y - 3], [x, y - 8], [x + 7, y - 3], [x + 7, y + 6], [x, y + 10], [x - 7, y + 6]], '#7fd6d0', ink, 1);
  }
}
function signAt(c: Paint, u: number, z: number, at: number, kind: string) {
  const y = -z;
  if (at > 0.35 && at < 0.65) { // flat carved plaque over the door
    rrect(c, u - 24, y - 12, 48, 24, 4, '#3a2a1e', '#1a120c', 2); rrect(c, u - 21, y - 9, 42, 18, 3, undefined, 'rgba(226,192,112,0.55)', 1.2);
    emblem(c, kind, u, y); return;
  }
  const s = at >= 0.65 ? -1 : 1, bx = u + s * 46;
  line(c, [[u, y], [bx, y]], '#1c1a1a', 3);
  c.beginPath(); c.arc(u + s * 12, y + 7, 7, -Math.PI / 2, Math.PI / 2, s < 0); c.strokeStyle = '#1c1a1a'; c.lineWidth = 2; c.stroke();
  for (const k of [10, 40]) line(c, [[u + s * k, y], [u + s * k, y + 7]], '#2a2626', 1.4);
  const lx = s > 0 ? u + 6 : u - 46;
  rrect(c, lx + 1, y + 8, 40, 30, 3, 'rgba(10,6,4,0.35)');
  rrect(c, lx, y + 6, 40, 30, 3, '#3a2a1e', '#160e08', 2);
  rrect(c, lx + 3, y + 9, 34, 24, 2, undefined, 'rgba(226,192,112,0.5)', 1.1);
  emblem(c, kind, lx + 20, y + 21);
}
function lanternAt(c: Paint, u: number, z: number, color = '#ffc070') {
  const y = -z;
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(u, y, 1, u, y, 40); g.addColorStop(0, rgba(color, 0.42)); g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g; c.fillRect(u - 40, y - 40, 80, 80); c.restore();
  line(c, [[u, y - 16], [u, y - 22], [u + 7, y - 22]], '#1c1a1a', 2);
  poly(c, [[u - 6, y - 9], [u, y - 16], [u + 6, y - 9]], '#1e1c1c');
  rrect(c, u - 5, y - 9, 10, 13, 1.5, color, '#1e1c1c', 1.6);
  line(c, [[u, y - 9], [u, y + 4]], 'rgba(30,24,20,0.6)', 1);
  rrect(c, u - 6, y + 4, 12, 3, 1, '#1e1c1c');
}
function awningAt(c: Paint, u0: number, u1: number, z: number, colors: [string, string]) {
  const y = -z, drop = 30, n = Math.max(4, Math.round((u1 - u0) / 13));
  c.fillStyle = 'rgba(16,10,20,0.32)'; c.fillRect(u0, y, u1 - u0, drop + 14);
  for (let i = 0; i < n; i++) {
    const a = u0 + ((u1 - u0) * i) / n, b = u0 + ((u1 - u0) * (i + 1)) / n;
    poly(c, [[a, y], [b, y], [b, y + drop], [a, y + drop]], i % 2 ? colors[1] : colors[0]);
    c.beginPath(); c.arc((a + b) / 2, y + drop, (b - a) / 2, 0, Math.PI); c.fillStyle = i % 2 ? colors[1] : colors[0]; c.fill();
    c.strokeStyle = 'rgba(20,14,12,0.5)'; c.lineWidth = 0.9; c.stroke();
  }
  const g = c.createLinearGradient(0, y, 0, y + drop + 6); g.addColorStop(0, 'rgba(255,240,210,0.18)'); g.addColorStop(1, 'rgba(20,10,20,0.28)');
  c.fillStyle = g; c.fillRect(u0, y, u1 - u0, drop);
  line(c, [[u0 - 2, y], [u1 + 2, y]], '#2a2420', 3);
}
function forgeHearth(c: Paint, u0: number, u1: number, H: number, seed: number) {
  const top = -Math.round(H * 0.7), w = u1 - u0, cx = (u0 + u1) / 2;
  const g = c.createLinearGradient(0, top, 0, 0); g.addColorStop(0, '#140e0c'); g.addColorStop(1, '#2e1a12');
  c.fillStyle = g; c.fillRect(u0, top, w, -top);
  for (let y = top + 6, row = 0; y < -2; y += 9, row++) for (let x = u0 + (row % 2) * 7; x < u1; x += 14) rrect(c, x + 0.5, y + 0.5, 12.5, 7.5, 1, `rgba(${70 + hash(x, row, seed) * 30},34,24,0.55)`);
  // furnace with a glowing mouth
  const fx = cx - w * 0.06, fw = w * 0.44;
  rrect(c, fx - fw / 2, top + 18, fw, -top - 18, 10, '#4a2c22', INK, 1.4);
  for (let y = top + 22, row = 0; y < -4; y += 9, row++) for (let x = fx - fw / 2 + (row % 2) * 6; x < fx + fw / 2 - 4; x += 12) rrect(c, x + 1, y, 10.5, 7.5, 1, tone('#7a3e2a', 0.8 + hash(row, Math.round(x), seed) * 0.4));
  const mx = fx, my = -26;
  c.beginPath(); c.ellipse(mx, my, fw * 0.3, 18, 0, Math.PI, 0); c.lineTo(mx + fw * 0.3, my + 14); c.lineTo(mx - fw * 0.3, my + 14); c.closePath();
  const m = c.createRadialGradient(mx, my + 6, 2, mx, my, fw * 0.34); m.addColorStop(0, '#fff6c8'); m.addColorStop(0.35, '#ffb848'); m.addColorStop(0.8, '#c8461c'); m.addColorStop(1, '#5a1a0c');
  c.fillStyle = m; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
  c.save(); c.globalCompositeOperation = 'lighter';
  const spill = c.createRadialGradient(mx, my, 6, mx, my, w * 0.75); spill.addColorStop(0, 'rgba(255,150,60,0.55)'); spill.addColorStop(1, 'rgba(255,120,40,0)');
  c.fillStyle = spill; c.fillRect(u0, top, w, -top); c.restore();
  // tools on the left wall, bellows on the right
  for (let k = 0; k < 4; k++) { const tx = u0 + 10 + k * 8; line(c, [[tx, top + 14], [tx, top + 44 + (k % 2) * 8]], '#1a1412', 2.4); poly(c, [[tx - 3, top + 44 + (k % 2) * 8], [tx + 3, top + 44 + (k % 2) * 8], [tx + 2, top + 52 + (k % 2) * 8], [tx - 2, top + 52 + (k % 2) * 8]], '#2a2420'); }
  poly(c, [[u1 - 34, -30], [u1 - 8, -40], [u1 - 8, -20], [u1 - 34, -24]], '#5a3a24', INK, 1.2);
  // heavy lintel and posts
  rrect(c, u0 - 6, top - 10, w + 12, 12, 2, '#4a3222', INK, 1.4);
  c.fillStyle = 'rgba(255,220,170,0.16)'; c.fillRect(u0 - 4, top - 9, w + 8, 2);
  for (const px of [u0 - 6, u1 - 4]) rrect(c, px, top, 10, -top, 2, '#4a3222', INK, 1.2);
}
function stallFront(c: Paint, L: number, H: number, goods: string, seed: number) {
  const g = c.createLinearGradient(0, -H, 0, 0); g.addColorStop(0, '#1a1416'); g.addColorStop(1, '#3a2a22');
  c.fillStyle = g; c.fillRect(0, -H + 6, L, H - 6);
  for (let k = 0; k < 3; k++) line(c, [[6, -H + 22 + k * 16], [L - 6, -H + 22 + k * 16]], '#5a4430', 2.2);
  if (goods === 'oil') for (let k = 0; k < 9; k++) { const x = 8 + (k % 5) * ((L - 16) / 4), y = -H + 20 + Math.floor(k / 5) * 16; rrect(c, x - 3, y - 9, 6, 9, 2, ['#c99a3a', '#7a8a3a', '#a85a2a'][k % 3], INK, 0.8); }
  rrect(c, -2, -34, L + 4, 34, 2, '#7a5a3a', INK, 1.4);
  for (let x = 0; x < L; x += 11) line(c, [[x, -32], [x, -2]], 'rgba(20,12,8,0.45)', 0.9);
  rrect(c, -4, -38, L + 8, 6, 2, '#9a7650', INK, 1.2);
  if (goods === 'fish') {
    rrect(c, 4, -46, L - 8, 9, 2, '#d8e6ea', 'rgba(20,30,40,0.6)', 1);
    for (let k = 0; k < 7; k++) { const x = 10 + k * ((L - 20) / 6); ellipse(c, x, -45, 6, 2.4, ['#a8bcc4', '#c8a07a', '#8aa0a8'][k % 3], INK, 0.7); }
  } else for (let k = 0; k < 6; k++) { const x = 8 + k * ((L - 16) / 5); rrect(c, x - 4, -50, 8, 12, 3, ['#d8a84a', '#8a9a4a', '#b86a3a'][(k + seed) % 3], INK, 0.9); ellipse(c, x, -51, 2.6, 1.4, '#3a2a1e'); }
  for (const px of [0, L - 6]) rrect(c, px, -H, 6, H, 1.5, '#4a3424', INK, 1);
}

// ─────────────────────────── roofs ───────────────────────────

function normal(p: V3[]): V3 {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(nx, ny, nz) || 1, s = nz < 0 ? -1 : 1;
  return [(nx / l) * s, (ny / l) * s, (nz / l) * s];
}
function level(face: V3[], z: number): [V3, V3] | null {
  const pts: V3[] = [];
  for (let i = 0; i < face.length; i++) {
    const a = face[i], b = face[(i + 1) % face.length];
    if (a[2] === b[2]) continue;
    const t = (z - a[2]) / (b[2] - a[2]);
    if (t >= -1e-9 && t <= 1 + 1e-9) pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z]);
  }
  if (pts.length < 2) return null;
  let best: [V3, V3] = [pts[0], pts[1]], d = -1;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const dd = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (dd > d) { d = dd; best = [pts[i], pts[j]]; }
  }
  const [p, q] = best;
  return p[0] < q[0] - 0.01 || (Math.abs(p[0] - q[0]) <= 0.01 && p[1] < q[1]) ? [p, q] : [q, p];
}
const lerp2 = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function course(c: Paint, mat: TownBuildingKit['roofMat'], A: [V3, V3], B: [V3, V3], row: number, base: string, seed: number) {
  const a0 = proj(A[0]), a1 = proj(A[1]), b0 = proj(B[0]), b1 = proj(B[1]);
  const len = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
  if (mat === 'thatch') {
    const n = Math.max(2, Math.round(len / 2.2));
    for (let j = 0; j < n; j++) {
      const t = (j + hash(j, row, seed) * 0.8) / n, p = lerp2(a0, a1, t), q = lerp2(b0, b1, Math.min(1, Math.max(0, t + (hash(j, row + 1, seed) - 0.5) * 0.04)));
      line(c, [[p[0], p[1] + 1.5], q], tone(base, 0.74 + hash(j, row + 2, seed) * 0.5), 1.3);
    }
    if (row % 3 === 0) line(c, [a0, a1], 'rgba(30,20,10,0.35)', 2);
    return;
  }
  const tw = mat === 'slate' ? 15 : mat === 'shingle' ? 11 : mat === 'copper' ? 24 : 14;
  const n = Math.max(1, Math.round(len / tw)), off = (row % 2) * 0.5;
  for (let j = -1; j <= n; j++) {
    const t0 = (j + off) / n, t1 = (j + 1 + off) / n;
    if (t1 <= 0 || t0 >= 1) continue;
    const p0 = lerp2(a0, a1, t0), p1 = lerp2(a0, a1, t1), q0 = lerp2(b0, b1, t0), q1 = lerp2(b0, b1, t1);
    const h = hash(j + 97, row, seed), k = mat === 'copper' ? 0.9 + h * 0.18 : 0.84 + h * 0.28;
    poly(c, [p0, p1, q1, q0], tone(base, k));
    if (mat === 'copper' && h > 0.6) poly(c, [lerp2(p0, p1, 0.2), lerp2(p0, p1, 0.5), lerp2(q0, q1, 0.5), lerp2(q0, q1, 0.2)], 'rgba(150,220,190,0.25)');
    if (mat === 'tile') { const m0 = lerp2(p0, p1, 0.35), m1 = lerp2(q0, q1, 0.35); line(c, [m0, m1], 'rgba(255,220,180,0.16)', 2); }
    line(c, [p0, p1], mat === 'copper' ? 'rgba(20,40,34,0.25)' : 'rgba(255,236,200,0.22)', 1.3);
    line(c, [p0, q0], mat === 'copper' ? 'rgba(14,30,26,0.55)' : 'rgba(18,12,20,0.42)', mat === 'copper' ? 1.4 : 1);
  }
  line(c, [b0, b1], 'rgba(18,12,20,0.32)', 1.1);
}
function roofFace(c: Paint, face: V3[], kit: TownBuildingKit, seed: number) {
  const scr = face.map(proj), n = normal(face);
  const lit = n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2];
  const base = tone(kit.roofColor, 0.6 + 0.52 * Math.max(0, lit));
  c.save(); poly(c, scr, base); c.clip();
  const zs = face.map((v) => v[2]), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const A = level(face, z0 + 0.01), B = level(face, z1 - 0.01);
  if (kit.roofMat === 'cloth' && A && B) {
    const m = Math.max(4, Math.round(Math.hypot(proj(A[1])[0] - proj(A[0])[0], proj(A[1])[1] - proj(A[0])[1]) / 13));
    const [a0, a1, b0, b1] = [proj(A[0]), proj(A[1]), proj(B[0]), proj(B[1])];
    for (let j = 0; j < m; j++) poly(c, [lerp2(a0, a1, j / m), lerp2(a0, a1, (j + 1) / m), lerp2(b0, b1, (j + 1) / m), lerp2(b0, b1, j / m)], j % 2 ? '#e8dcc0' : base);
    const g = c.createLinearGradient(0, b0[1], 0, a0[1]); g.addColorStop(0, 'rgba(20,10,20,0.25)'); g.addColorStop(1, 'rgba(255,240,210,0.12)');
    const xs = scr.map((p) => p[0]), ys = scr.map((p) => p[1]);
    c.fillStyle = g; c.fillRect(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  } else if (A && B) {
    const mid = (s: [V3, V3]): Point => { const p = proj(s[0]), q = proj(s[1]); return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
    const span = Math.hypot(mid(B)[0] - mid(A)[0], mid(B)[1] - mid(A)[1]);
    const step = kit.roofMat === 'thatch' ? 7 : kit.roofMat === 'slate' ? 9 : kit.roofMat === 'shingle' ? 8 : 10;
    if (span > 8) {
      const nc = Math.max(1, Math.round(span / step));
      for (let i = 0; i < nc; i++) {
        const lo = level(face, Math.max(z0 + 0.01, z0 + ((z1 - z0) * i) / nc)), hi = level(face, Math.min(z1 - 0.01, z0 + ((z1 - z0) * (i + 1)) / nc));
        if (lo && hi) course(c, kit.roofMat, lo, hi, i, base, seed);
      }
    }
    // weathering: moss and soot blotches, soft light across the slope
    for (let i = 0; i < 6; i++) { const p = scr[i % scr.length], q = scr[(i + 2) % scr.length], t = hash(i, 5, seed); const m = lerp2(p, q, t); ellipse(c, m[0], m[1], 10 + t * 14, 5 + t * 6, kit.roofMat === 'thatch' ? 'rgba(60,70,30,0.18)' : 'rgba(70,90,50,0.14)'); }
  }
  c.restore();
  poly(c, scr, undefined, 'rgba(20,14,12,0.55)', 1.1);
  return n;
}
function roofZ(b: TownBuilding, x: number, y: number): number {
  const vs = b.look!.roof.vertices; let best = b.look!.eaveHeight;
  for (const f of b.look!.roof.faces) for (let i = 1; i < f.length - 1; i++) {
    const A = vs[f[0]], B = vs[f[i]], C = vs[f[i + 1]];
    const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
    if (Math.abs(d) < 1e-6) continue;
    const l1 = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (y - C[1])) / d, l2 = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (y - C[1])) / d, l3 = 1 - l1 - l2;
    if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) best = Math.max(best, l1 * A[2] + l2 * B[2] + l3 * C[2]);
  }
  return best;
}
function chimney(c: Paint, b: TownBuilding, at: Point, top: number, seed: number) {
  const [x, y] = at, z0 = roofZ(b, x, y) - 8, w = 26, d = 16;
  const fx = x - w / 2, fy = y + d / 2;
  c.save(); c.translate(fx, fy - z0); c.beginPath(); c.rect(0, -(top - z0), w, top - z0); c.clip(); ashlar(c, w, top - z0, '#8a8072', seed); c.restore();
  const soot = c.createLinearGradient(0, fy - top, 0, fy - top + 26); soot.addColorStop(0, 'rgba(20,16,16,0.6)'); soot.addColorStop(1, 'rgba(20,16,16,0)');
  c.fillStyle = soot; c.fillRect(fx, fy - top, w, 26);
  rrect(c, fx - 3, y - d / 2 - top - 2, w + 6, d + 4, 2, '#a49a8a', INK, 1.3);
  ellipse(c, x, y - top, w * 0.3, d * 0.22, '#1a1414');
  line(c, [[fx, fy - top], [fx, fy - z0]], INK, 1.2); line(c, [[fx + w, fy - top], [fx + w, fy - z0]], INK, 1.2);
}
function roofEdges(c: Paint, faces: V3[][], normals: V3[], kit: TownBuildingKit, e: number) {
  const key = (a: V3, b: V3) => { const s = `${a[0]},${a[1]},${a[2]}`, t = `${b[0]},${b[1]},${b[2]}`; return s < t ? s + '|' + t : t + '|' + s; };
  const count = new Map<string, number>();
  for (const f of faces) for (let i = 0; i < f.length; i++) { const k = key(f[i], f[(i + 1) % f.length]); count.set(k, (count.get(k) ?? 0) + 1); }
  for (let fi = 0; fi < faces.length; fi++) {
    const f = faces[fi], n = normals[fi];
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length], pa = proj(a), pb = proj(b);
      if (a[2] <= e + 0.5 && b[2] <= e + 0.5) {
        if (n[1] < -0.05) continue;
        line(c, [[pa[0], pa[1] + 2], [pb[0], pb[1] + 2]], 'rgba(14,10,12,0.55)', 2.2);
        line(c, [pa, pb], tone(kit.trimColor, 1.1), 3.2);
      } else if ((count.get(key(a, b)) ?? 0) > 1) {
        if (kit.shape === 'round') continue;
        line(c, [pa, pb], tone(kit.roofColor, 0.62), 5);
        line(c, [[pa[0], pa[1] - 1.5], [pb[0], pb[1] - 1.5]], tone(kit.roofColor, 1.3), 1.4);
      } else if (n[1] >= -0.05 && kit.roof === 'gableFront') {
        line(c, [pa, pb], tone(kit.trimColor, 0.95), 5.5); line(c, [[pa[0], pa[1] - 2], [pb[0], pb[1] - 2]], 'rgba(255,230,190,0.2)', 1.2);
      }
    }
  }
}
function shearV(v: V3, kit: TownBuildingKit, top: number, apex: boolean): V3 {
  return kit.lean && !apex ? [v[0] + (kit.lean * v[2]) / top, v[1], v[2]] : v;
}
function roof(c: Paint, b: TownBuilding, seed: number) {
  const look = b.look!, kit = look.kit!, top = look.ridgeHeight ?? look.eaveHeight;
  const raw = look.roof.vertices, last = raw.length - 1;
  const vs = raw.map((v, i) => shearV(v, kit, top, kit.shape === 'round' && i === last));
  if (kit.roof === 'dome') { dome(c, b); return; }
  const faces = look.roof.faces.map((f) => f.map((i) => vs[i]));
  const order = faces.map((f, i) => ({ i, y: f.reduce((s, v) => s + v[1], 0) / f.length })).sort((a, q) => a.y - q.y);
  const normals: V3[] = faces.map(() => [0, 0, 1]);
  for (const { i } of order) {
    normals[i] = roofFace(c, faces[i], kit, seed + i * 7);
    for (const ch of kit.chimneys ?? []) {
      const inFace = (() => { const f = faces[i]; let inside = false; for (let a = 0, z = f.length - 1; a < f.length; z = a++) { if ((f[a][1] > ch.at[1]) !== (f[z][1] > ch.at[1]) && ch.at[0] < ((f[z][0] - f[a][0]) * (ch.at[1] - f[a][1])) / (f[z][1] - f[a][1]) + f[a][0]) inside = !inside; } return inside; })();
      if (inFace) chimney(c, b, ch.at, ch.height, seed + 3);
    }
  }
  roofEdges(c, faces, normals, kit, look.eaveHeight);
  if (kit.shape === 'round') {
    const [ax, ay] = proj(vs[last]);
    line(c, [[ax, ay + 4], [ax, ay - 16]], '#2a2622', 2.4); ellipse(c, ax, ay - 17, 3, 3, kit.roofMat === 'copper' ? '#d8b860' : '#3a3430', INK, 1);
  }
}
function dome(c: Paint, b: TownBuilding) {
  const look = b.look!, kit = look.kit!, vs = look.roof.vertices, apex = vs[vs.length - 1], rim = vs.slice(0, -1);
  const cx = apex[0], e = look.eaveHeight, H = apex[2] - e, cyw = apex[1], cy = cyw - e;
  const rx = Math.max(...rim.map((v) => Math.abs(v[0] - cx))), ry = Math.max(...rim.map((v) => Math.abs(v[1] - cyw)));
  // cornice ring the dome sits on
  ellipse(c, cx, cy + 3, rx + 4, ry + 4, '#8a857a', INK, 1.4);
  ellipse(c, cx, cy, rx + 2, ry + 2, '#b0aa9c');
  const silhouette = new Path2D(); silhouette.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); silhouette.ellipse(cx, cy, rx, Math.hypot(H, ry * 0.8), 0, Math.PI, Math.PI * 2); silhouette.closePath();
  const g = c.createLinearGradient(cx - rx, cy - H - ry, cx + rx, cy + ry);
  g.addColorStop(0, '#e6fff8'); g.addColorStop(0.28, kit.roofColor); g.addColorStop(0.72, tone(kit.roofColor, 0.55)); g.addColorStop(1, tone(kit.roofColor, 0.38));
  c.save(); c.globalAlpha = 0.94; c.fillStyle = g; c.fill(silhouette); c.globalAlpha = 1; c.clip(silhouette);
  c.globalCompositeOperation = 'lighter';
  const glow = c.createRadialGradient(cx, cy + ry * 0.2, 4, cx, cy - H * 0.2, rx * 1.15); glow.addColorStop(0, 'rgba(150,255,236,0.55)'); glow.addColorStop(1, 'rgba(150,255,236,0)');
  c.fillStyle = glow; c.fillRect(cx - rx, cy - H - ry, rx * 2, H + ry * 2);
  c.globalCompositeOperation = 'source-over';
  const point = (phi: number, s: number): Point => [cx + rx * Math.cos(phi) * Math.cos(s), cy + ry * Math.sin(phi) * Math.cos(s) - H * Math.sin(s)];
  for (let k = 0; k <= 12; k++) {
    const phi = (k / 12) * Math.PI, pts: Point[] = [];
    for (let s = 0; s <= 10; s++) pts.push(point(phi, (s / 10) * (Math.PI / 2)));
    line(c, pts, 'rgba(30,60,60,0.7)', 1.6);
  }
  for (const s of [0.35, 0.7, 1.05]) { const pts: Point[] = []; for (let k = 0; k <= 16; k++) pts.push(point((k / 16) * Math.PI, s)); line(c, pts, 'rgba(30,60,60,0.6)', 1.4); }
  line(c, [point(2.3, 0.2), point(2.0, 0.9)], 'rgba(255,255,255,0.55)', 3);
  c.restore();
  c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke(silhouette);
  const [ax, ay] = point(Math.PI / 2, Math.PI / 2);
  ellipse(c, ax, ay - 2, 7, 4, '#c9a65a', INK, 1); line(c, [[ax, ay - 4], [ax, ay - 20]], '#2a2622', 2.2); ellipse(c, ax, ay - 21, 3.4, 3.4, '#e2c070', INK, 1);
}

// ─────────────────────────── whole buildings ───────────────────────────

type Kit = TownBuildingKit;
function rows(kit: Kit, e: number, n: number) {
  const sh = (e - 20) / n, wh = Math.min(40, sh * 0.6);
  return { wh, zb: (r: number) => r * sh + (sh - wh) * 0.55 + 6 };
}
function features(c: Paint, kit: Kit, face: number, L: number, e: number, seed: number) {
  if (kit.goods && face === 0) stallFront(c, L, e, kit.goods, seed);
  if (kit.hearth && kit.hearth.face === face) forgeHearth(c, kit.hearth.from * L, kit.hearth.to * L, e, seed);
  for (const w of kit.windows ?? []) if (w.face === face) {
    const n = w.rows ?? 1, { wh, zb } = rows(kit, e, n), ww = kit.shape === 'round' ? 18 : 26;
    for (const at of w.at) for (let r = w.upper ? 1 : 0; r < n; r++) windowAt(c, at * L, zb(r), ww, wh, kit, w.lit ?? true, seed + r, !!kit.flowerBoxes && r === 0);
  }
  for (const d of kit.doors ?? []) if (d.face === face) doorAt(c, d.at * L, d.w ?? (kit.shape === 'round' ? 34 : 40), d.kind ?? 'wood', kit, seed);
  if (kit.awning && kit.awning.face === face) awningAt(c, kit.awning.from * L, kit.awning.to * L, Math.min(e - 30, 96), kit.awning.colors);
  for (const l of kit.lanterns ?? []) if (l.face === face) lanternAt(c, l.at * L, 70);
  if (kit.sign && kit.sign.face === face) {
    const doorTop = Math.max(0, ...(kit.doors ?? []).filter((d) => d.face === face).map((d) => (d.kind === 'double' ? 84 : 74)));
    const plaque = kit.sign.at > 0.35 && kit.sign.at < 0.65;
    signAt(c, kit.sign.at * L, plaque ? Math.min(e - 14, doorTop + (e - doorTop) / 2) : Math.min(e - 14, Math.max(120, e * 0.62)), kit.sign.at, kit.sign.emblem);
  }
}
function rectFacade(c: Paint, b: TownBuilding, seed: number, H?: number) {
  const look = b.look!, kit = look.kit!, [p0, p1] = b.footprint, L = p1[0] - p0[0], e = H ?? look.eaveHeight, r = look.ridgeHeight ?? e + 80, o = 14;
  const gable = kit.roof === 'gableFront' && H === undefined;
  const top = (u: number) => (gable ? e + (r - e) * Math.max(0, 1 - Math.abs(u - L / 2) / (L / 2 + o)) - 6 : e);
  const shape: Point[] = gable ? [[0, 0], [L, 0], [L, -top(L)], [L / 2, -top(L / 2)], [0, -top(0)]] : [[0, 0], [L, 0], [L, -e], [0, -e]];
  const Hmax = gable ? top(L / 2) : e;
  c.save(); c.translate(p0[0], p0[1]);
  c.save(); poly(c, shape); c.clip();
  wallMaterial(c, kit, L, Hmax, seed);
  if (kit.wall === 'plaster' || kit.wall === 'stone') quoins(c, L, Hmax, seed);
  c.filter = 'blur(5px)'; line(c, shape.slice(2).concat([shape[0]]).slice(0, -1), 'rgba(16,10,20,0.55)', 16); c.filter = 'none';
  c.restore();
  if (gable) {
    const gz = e + (top(L / 2) - e) * 0.42;
    ellipse(c, L / 2, -gz, 10, 10, tone(kit.trimColor, 1), INK, 1.2); ellipse(c, L / 2, -gz, 7, 7, '#f2b860');
    line(c, [[L / 2 - 7, -gz], [L / 2 + 7, -gz]], tone(kit.trimColor, 0.8), 1.6); line(c, [[L / 2, -gz - 7], [L / 2, -gz + 7]], tone(kit.trimColor, 0.8), 1.6);
  }
  line(c, [[0, 0], [0, -top(0)]], INK, 1.6); line(c, [[L, 0], [L, -top(L)]], INK, 1.6);
  features(c, kit, 0, L, e, seed);
  c.restore();
}
function roundWalls(c: Paint, b: TownBuilding, seed: number) {
  const look = b.look!, kit = look.kit!, f = b.footprint, e = look.eaveHeight, top = look.ridgeHeight ?? e;
  const cx = f.reduce((s, p) => s + p[0], 0) / f.length, cy = f.reduce((s, p) => s + p[1], 0) / f.length;
  const shear = (kit.lean ?? 0) / top, dxTop = shear * e;
  const facets: { a: Point; b: Point; i: number; L: number; dx: number; dy: number }[] = [];
  for (let i = 0; i < f.length; i++) {
    const a = f[i], q = f[(i + 1) % f.length];
    if ((a[1] + q[1]) / 2 > cy + 0.5) { const L = Math.hypot(q[0] - a[0], q[1] - a[1]); facets.push({ a, b: q, i, L, dx: (q[0] - a[0]) / L, dy: (q[1] - a[1]) / L }); }
  }
  const body = new Path2D();
  for (const ft of facets) {
    c.save(); c.transform(ft.dx, ft.dy, -shear, 1, ft.a[0], ft.a[1]);
    c.beginPath(); c.rect(-0.8, -e, ft.L + 1.6, e); c.clip();
    wallMaterial(c, kit, ft.L + 1.6, e, seed + ft.i * 13);
    c.restore();
    body.moveTo(ft.a[0], ft.a[1]); body.lineTo(ft.b[0], ft.b[1]); body.lineTo(ft.b[0] + dxTop, ft.b[1] - e); body.lineTo(ft.a[0] + dxTop, ft.a[1] - e); body.closePath();
  }
  // cylinder light: lit west flank, a soft core, dark east flank, eave shadow
  const r = Math.max(...f.map((p) => Math.abs(p[0] - cx)));
  c.save(); c.clip(body);
  const g = c.createLinearGradient(cx - r, 0, cx + r + dxTop, 0);
  g.addColorStop(0, 'rgba(20,14,30,0.3)'); g.addColorStop(0.22, 'rgba(255,238,205,0.12)'); g.addColorStop(0.55, 'rgba(20,14,30,0.08)'); g.addColorStop(1, 'rgba(20,14,30,0.5)');
  c.fillStyle = g; c.fillRect(cx - r - 4, cy - e - 40, r * 2 + dxTop + 8, e + r + 60);
  for (const ft of facets) { c.save(); c.transform(ft.dx, ft.dy, -shear, 1, ft.a[0], ft.a[1]); const s = c.createLinearGradient(0, -e, 0, -e + 24); s.addColorStop(0, 'rgba(14,10,18,0.55)'); s.addColorStop(1, 'rgba(14,10,18,0)'); c.fillStyle = s; c.fillRect(-1, -e, ft.L + 2, 24); c.restore(); }
  c.restore();
  if (kit.beacon) for (const ft of facets) {
    c.save(); c.transform(ft.dx, ft.dy, -shear, 1, ft.a[0], ft.a[1]);
    const gl = c.createLinearGradient(0, -e, 0, -e + 40); gl.addColorStop(0, '#fff6d0'); gl.addColorStop(1, '#ffc060');
    c.fillStyle = gl; c.fillRect(-0.8, -e, ft.L + 1.6, 40); line(c, [[ft.L / 2, -e], [ft.L / 2, -e + 40]], '#2a2a2a', 2); line(c, [[0, -e], [0, -e + 40]], '#2a2a2a', 2.4);
    c.restore();
  }
  if (kit.beacon) {
    const ry = Math.max(...f.map((p) => Math.abs(p[1] - cy)));
    c.beginPath(); c.ellipse(cx + dxTop * 0.9, cy - e + 44, r + 10, ry + 9, 0, 0, Math.PI); c.strokeStyle = '#1e1e20'; c.lineWidth = 4; c.stroke();
    for (let k = 1; k < 12; k++) { const a = (k / 12) * Math.PI, x = cx + dxTop * 0.9 + Math.cos(a) * (r + 10), y = cy - e + 44 + Math.sin(a) * (ry + 9); line(c, [[x, y], [x, y - 12]], '#1e1e20', 1.6); }
    c.beginPath(); c.ellipse(cx + dxTop * 0.9, cy - e + 32, r + 10, ry + 9, 0, 0, Math.PI); c.lineWidth = 2; c.stroke();
  }
  if (kit.columns) {
    const door = kit.doors?.[0], n = f.length, aDoor = door ? Math.PI - (2 * Math.PI * (door.face + door.at)) / n : -9;
    const ry = Math.max(...f.map((p) => Math.abs(p[1] - cy)));
    const cols: Point[] = [];
    for (let k = 0; k < kit.columns; k++) { const phi = (Math.PI * (k + 0.5)) / kit.columns; if (Math.abs(phi - aDoor) < 0.24) continue; cols.push([cx + Math.cos(phi) * (r + 8), cy + Math.sin(phi) * (ry + 7)]); }
    cols.sort((p, q) => p[1] - q[1]);
    for (const [x, y] of cols) {
      rrect(c, x - 9, y - 7, 18, 7, 1.5, '#b8b0a0', INK, 1.1);
      const sg = c.createLinearGradient(x - 6, 0, x + 6, 0); sg.addColorStop(0, '#d8d0bf'); sg.addColorStop(0.45, '#bdb4a2'); sg.addColorStop(1, '#7e7668');
      c.fillStyle = sg; c.fillRect(x - 6, y - e + 8, 12, e - 15); c.strokeStyle = INK; c.lineWidth = 1.1; c.strokeRect(x - 6, y - e + 8, 12, e - 15);
      for (const k of [-2.5, 2.5]) line(c, [[x + k, y - e + 10], [x + k, y - 9]], 'rgba(40,34,30,0.3)', 1);
      rrect(c, x - 9, y - e + 1, 18, 8, 1.5, '#c8c0ae', INK, 1.1);
    }
  }
  for (const ft of facets) { c.save(); c.transform(ft.dx, ft.dy, -shear, 1, ft.a[0], ft.a[1]); features(c, kit, ft.i, ft.L, e, seed + ft.i); c.restore(); }
  if (kit.runes) {
    const glyphs: Point[][] = [[[0, 0], [5, -8], [10, 0]], [[0, -8], [10, -8], [5, 0], [5, -10]], [[0, 0], [0, -10], [8, -5], [0, -2]], [[2, -10], [8, 0], [0, -4], [10, -4]]];
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const ft of facets) if (ft.i % 2 === 0) {
      c.save(); c.transform(ft.dx, ft.dy, -shear, 1, ft.a[0], ft.a[1]);
      const gz = e * (0.32 + hash(ft.i, 1, seed) * 0.4), g0 = glyphs[ft.i % glyphs.length];
      const halo = c.createRadialGradient(ft.L / 2, -gz - 4, 1, ft.L / 2, -gz - 4, 18); halo.addColorStop(0, 'rgba(190,140,255,0.5)'); halo.addColorStop(1, 'rgba(190,140,255,0)');
      c.fillStyle = halo; c.fillRect(ft.L / 2 - 18, -gz - 22, 36, 36);
      line(c, g0.map(([x, y]) => [ft.L / 2 - 5 + x, -gz + y] as Point), '#e4ccff', 1.8);
      c.restore();
    }
    c.restore();
    const lf = facets.find((ft) => kit.doors?.some((d) => d.face === ft.i));
    if (lf) { c.save(); c.transform(lf.dx, lf.dy, -shear, 1, lf.a[0], lf.a[1]); lanternAt(c, lf.L + 6, 74, '#c89cff'); c.restore(); }
  }
}
function charms(c: Paint, b: TownBuilding, seed: number) {
  const look = b.look!, kit = look.kit!, vs = look.roof.vertices.slice(0, -1), top = look.ridgeHeight ?? look.eaveHeight;
  const front = vs.map((v) => shearV(v, kit, top, false)).filter((v, i) => i % 2 === 1 && v[1] > look.roof.vertices[look.roof.vertices.length - 1][1] + 10);
  for (const [i, v] of front.entries()) {
    const [x, y] = proj(v), len = 22 + hash(i, 2, seed) * 20;
    line(c, [[x, y + 2], [x + 1, y + len]], 'rgba(40,30,40,0.8)', 1);
    const kind = i % 3;
    if (kind === 0) poly(c, [[x + 1, y + len], [x + 5, y + len + 6], [x + 1, y + len + 12], [x - 3, y + len + 6]], '#b89cff', INK, 0.8);
    else if (kind === 1) ellipse(c, x + 1, y + len + 4, 3.4, 3.4, '#e8dcc0', INK, 0.8);
    else { line(c, [[x + 1, y + len], [x - 3, y + len + 10]], '#e8dcc0', 2); line(c, [[x + 1, y + len], [x + 5, y + len + 9]], '#a8c8a0', 2); }
  }
}
function innBackWall(c: Paint, L: number, H: number, kit: Kit, hearthU: number, seed: number) {
  plaster(c, L, H, tone(kit.wallColor, 0.72), seed);
  timberFrame(c, L, H, tone(kit.trimColor, 0.9));
  c.fillStyle = 'rgba(20,12,10,0.25)'; c.fillRect(0, -H, L, H);
  // chimney breast above the hearth
  rrect(c, hearthU - 44, -H - 2, 88, H - 54, 2, '#6a6258', INK, 1.4);
  c.save(); c.translate(hearthU - 44, -54); c.beginPath(); c.rect(0, -(H - 56), 88, H - 56); c.clip(); ashlar(c, 88, H - 56, '#7a7268', seed + 5); c.restore();
  rrect(c, hearthU - 52, -62, 104, 8, 2, '#5a3e28', INK, 1.2);
  for (let k = 0; k < 5; k++) rrect(c, hearthU - 44 + k * 18, -74, 8, 12, 2, ['#c9a65a', '#8a5a3a', '#b8c0c4', '#c9a65a', '#6a8a6a'][k], INK, 0.8);
  // shelves of bottles and mugs, a chalk board and hanging herbs
  for (const sx of [24, L - 128]) for (let row = 0; row < 2; row++) {
    const y = -64 - row * 36; rrect(c, sx, y, 104, 5, 1, '#5a3e28', INK, 1);
    for (let k = 0; k < 8; k++) { const bx = sx + 6 + k * 12, tall = hash(k, row, seed) > 0.5; rrect(c, bx, y - (tall ? 16 : 10), 7, tall ? 16 : 10, 2, ['#3a6a4a', '#8a3a2a', '#c9a65a', '#5a4a8a'][(k + row) % 4], INK, 0.7); }
  }
  rrect(c, L * 0.62, -120, 52, 38, 2, '#1e2420', '#5a3e28', 3);
  for (let k = 0; k < 4; k++) line(c, [[L * 0.62 + 8, -110 + k * 8], [L * 0.62 + 18 + hash(k, 3, seed) * 26, -110 + k * 8]], 'rgba(230,230,220,0.7)', 1.2);
  for (let k = 0; k < 7; k++) { const hx = 40 + k * (L - 80) / 6; line(c, [[hx, -H + 6], [hx, -H + 18]], '#3a2a1e', 1); ellipse(c, hx, -H + 22, 5, 7, ['#6a8a4a', '#8a7a3a', '#5a7a4a'][k % 3]); }
  // warm hearth light on the wall
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(hearthU, -10, 6, hearthU, -30, 190); g.addColorStop(0, 'rgba(255,150,70,0.5)'); g.addColorStop(1, 'rgba(255,150,70,0)');
  c.fillStyle = g; c.fillRect(0, -H, L, H); c.restore();
  const s = c.createLinearGradient(0, -H, 0, -H + 30); s.addColorStop(0, 'rgba(10,6,8,0.6)'); s.addColorStop(1, 'rgba(10,6,8,0)'); c.fillStyle = s; c.fillRect(0, -H, L, 30);
}

function buildingBounds(b: TownBuilding): Bounds {
  const look = b.look!, kit = look.kit!, top = look.ridgeHeight ?? look.eaveHeight;
  const pts: Point[] = [...b.footprint, ...look.roof.vertices.map((v, i, a) => proj(shearV(v, kit, top, kit.shape === 'round' && i === a.length - 1)))];
  for (const ch of kit.chimneys ?? []) pts.push([ch.at[0] - 16, ch.at[1] - ch.height - 8], [ch.at[0] + 16, ch.at[1] + 10 - ch.height]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const signPad = kit.sign && !(kit.sign.at > 0.35 && kit.sign.at < 0.65) ? 54 : 16;
  return { x0: Math.min(...xs) - signPad, x1: Math.max(...xs) + signPad, y0: Math.min(...ys) - 30, y1: Math.max(...ys) + 12 };
}

function innCards(b: TownBuilding, seed: number, hearthX: number): MapLayers['sorted'] {
  const look = b.look!, kit = look.kit!, f = b.footprint, e = look.eaveHeight;
  const x0 = f[0][0], x1 = f[1][0], y1 = f[0][1], y0 = f[2][1];
  const inner = b.interior!.floors[0], ix0 = inner[0][0], ix1 = inner[1][0], iy0 = inner[0][1];
  const door = b.doors[0], dx0 = Math.min(door.a[0], door.b[0]), dx1 = Math.max(door.a[0], door.b[0]);
  const STUB = 30, W = y1 - inner[2][1];
  const out: MapLayers['sorted'] = [];
  out.push(...bake({ x0: ix0, x1: ix1, y0: iy0 - e - 4, y1: iy0 + 2 }, [[ix0, iy0], [ix1, iy0]], (c) => {
    c.save(); c.translate(ix0, iy0); c.beginPath(); c.rect(0, -e, ix1 - ix0, e); c.clip(); innBackWall(c, ix1 - ix0, e, kit, hearthX - ix0, seed); c.restore();
  }));
  out.push(...bake({ x0, x1, y0: y0 - e - 4, y1: y1 + 4 }, b.baseline, (c) => {
    for (const [a, z] of [[x0, ix0], [ix1, x1]] as const) {
      const g = c.createLinearGradient(a, 0, z, 0); g.addColorStop(0, tone(kit.wallColor, 0.7)); g.addColorStop(1, tone(kit.wallColor, 0.5));
      c.fillStyle = g; c.fillRect(a, y0 - e, z - a, y1 - y0 + e);
      c.fillStyle = tone('#9a8c78', 1); c.fillRect(a, y0 - e, z - a, y1 - y0);
      for (let y = y0 - e + 10; y < y1 - e; y += 22) line(c, [[a, y], [z, y]], 'rgba(40,30,24,0.5)', 1);
      c.strokeStyle = INK; c.lineWidth = 1.4; c.strokeRect(a, y0 - e, z - a, y1 - y0 + e);
    }
    for (const [a, z] of [[x0, dx0], [dx1, x1]] as const) {
      c.fillStyle = '#9a8c78'; c.fillRect(a, y1 - W - STUB, z - a, W);
      c.save(); c.translate(a, y1); c.beginPath(); c.rect(0, -STUB, z - a, STUB); c.clip(); plinth(c, z - a, seed, STUB); c.restore();
      c.strokeStyle = INK; c.lineWidth = 1.3; c.strokeRect(a, y1 - W - STUB, z - a, W + STUB);
    }
  }));
  out.push(...bake(buildingBounds(b), b.baseline, (c) => { rectFacade(c, b, seed); roof(c, b, seed); }, b.id));
  return out;
}

export function townHouses(t: TownData): MapLayers['sorted'] {
  const out: MapLayers['sorted'] = [];
  for (const b of t.buildings) {
    if (!b.look?.kit) continue;
    const seed = seedOf(b.id);
    if (b.look.kit.cutaway && b.interior) {
      const xs = b.footprint.map((p) => p[0]), ys = b.footprint.map((p) => p[1]);
      const hearth = t.props.find((p) => p.kind === 'hearth' && p.x > Math.min(...xs) && p.x < Math.max(...xs) && p.y > Math.min(...ys) && p.y < Math.max(...ys));
      out.push(...innCards(b, seed, hearth?.x ?? (Math.min(...xs) + Math.max(...xs)) / 2));
      continue;
    }
    out.push(...bake(buildingBounds(b), b.baseline, (c) => {
      if (b.look!.kit!.shape === 'round') { roundWalls(c, b, seed); roof(c, b, seed); if (b.look!.kit!.runes) charms(c, b, seed); }
      else { rectFacade(c, b, seed); roof(c, b, seed); }
    }, b.id));
  }
  return out;
}
