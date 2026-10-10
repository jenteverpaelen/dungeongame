// Turntable drawings for the hero rig (see player.ts and docs/ART_DIRECTION.md §3 "Turntable rig").
//
// The hero keeps the paper-doll gear designs (gear.ts), but parts that must turn in depth are drawn here:
//   • the head as a little 3D sphere, baked at 24 yaw angles: hair caps, fringes, spikes, helmets, hoods,
//     hats, circlets and blush are placed on the sphere and depth-sorted against it, so turning slides every
//     feature across the head instead of mirror-flipping it;
//   • a bilaterally symmetric torso (silhouette + material) plus separate front / back detail sprites that the
//     rig slides across the body cylinder (collars, lacing, buckles, robe panels, spine ridges);
//   • legs baked at 7 yaws (toe in profile, toe-cap from the front, heel from behind);
//   • back pieces (cape drape, ponytail / hood tail, long-hair curtain), the inside of a shield, and the small
//     glyphs the choreography needs (eye, mouths, brow, nocked arrow, mallet, music note, runes).
//
// Yaw convention (degrees): 0 = facing the camera, +90 = profile facing screen-right, ±180 = back to camera,
// -90 = profile facing left. Body-local axes: x forward, y down, z = the hero's right side.

import type { ItemLook } from '@shared/types';
import {
  OUT, OW, ball, blob, blobPath, crease, detail, eye, fill, gem, gloss, inSilhouette, line, outline, poly, rbox, rivet, spark,
  star, stitch, wash, type Ctx,
} from './draw';
import { rarityOf, trim, type Body } from './gear';
import { decorBelt, decorHead, decorLeg, decorTorsoFront } from './gearDecor';
import { BLUSH, BONE, GOLD, OUTFIT } from './palette';
import { clamp, lerp, light, mix, shade } from './util';

const D2R = Math.PI / 180;

// ═══════════════════════════════ HEAD (sphere) ═══════════════════════════════

/** Skull radius, vertical squash and camera pitch used by the baked head views and the eye overlay. */
export const HEAD_R = 15.6;
export const HEAD_SY = 0.95;
export const HEAD_PITCH = 0.3;
/** Baked head yaws (degrees), symmetric about 0 so ±65° (walking) and ±20° / ±155° (down / up) exist. */
export const HEAD_VIEWS: number[] = (() => {
  const v: number[] = [];
  for (let k = 0; k < 12; k++) { v.push(5 + 15 * k); v.push(-(5 + 15 * k)); }
  return v.sort((a, b) => a - b);
})();
/** Head views that also get a white hit-flash silhouette. */
export const HEAD_FLASH_VIEWS = [-170, -125, -80, -35, 5, 50, 95, 140];

export interface SP { x: number; y: number; d: number }

const cP = Math.cos(HEAD_PITCH), sP = Math.sin(HEAD_PITCH);

/** Project a direction on the head sphere (lon: 0 = face centre, + = hero's right; lat: + = up). */
export function sph(lon: number, lat: number, yaw: number, r = HEAD_R): SP {
  const cl = Math.cos(lat);
  const fwd = cl * Math.cos(lon), side = cl * Math.sin(lon), up = Math.sin(lat);
  const X = fwd * Math.sin(yaw) - side * Math.cos(yaw);
  const Z = fwd * Math.cos(yaw) + side * Math.sin(yaw);
  return { x: X * r, y: (-up * cP + Z * sP) * r * HEAD_SY, d: Z * cP + up * sP };
}

/** Project an arbitrary head-local vector (fwd, up, side) — for horns, hat flops, visors. */
function vec(fwd: number, up: number, side: number, yaw: number): SP {
  const X = fwd * Math.sin(yaw) - side * Math.cos(yaw);
  const Z = fwd * Math.cos(yaw) + side * Math.sin(yaw);
  return { x: X, y: (-up * cP + Z * sP) * HEAD_SY, d: Z * cP + up * sP };
}

/** Inverse of sph for a point on the silhouette (depth 0): screen angle → (lon, lat). */
function limbLonLat(theta: number, yaw: number): { lon: number; lat: number } {
  const X = Math.cos(theta), ys = Math.sin(theta);
  const up = -ys * cP, Z = ys * sP;
  const fwd = X * Math.sin(yaw) + Z * Math.cos(yaw);
  const side = -X * Math.cos(yaw) + Z * Math.sin(yaw);
  return { lon: Math.atan2(side, fwd), lat: Math.asin(clamp(up, -1, 1)) };
}

type LineFn = (lon: number) => number; // latitude (radians) of a cap's lower edge at a longitude

/** Cosine-series hairline through front / side / back latitudes (degrees). */
function hairline(front: number, side: number, backLat: number): LineFn {
  // φ(lon) = A0 + A1·cos(lon) + A2·cos(2·lon) through φ(0) = front, φ(±90°) = side, φ(180°) = back
  const A1 = (front - backLat) / 2;
  const s = (front + backLat) / 2;
  const A0 = (s + side) / 2, A2 = (s - side) / 2;
  return (lon) => (A0 + A1 * Math.cos(lon) + A2 * Math.cos(2 * lon)) * D2R;
}

interface Spike { lon: number; lat: number; len: number; w: number; sweep: number }

interface CapResult { pts: number[]; run: number[]; full: boolean; none: boolean }

/**
 * The visible part of a spherical cap (everything above `line`, containing the crown), as a screen polygon:
 * the visible run of its lower edge, closed along the silhouette over the top. Spikes near the silhouette
 * push the closing arc outwards (one fill + one outline for hair with spikes).
 */
function capPolygon(line: LineFn, yaw: number, r: number, spikes: Spike[] = []): CapResult {
  const N = 72;
  const P: SP[] = [];
  for (let i = 0; i < N; i++) { const lon = -Math.PI + (i / N) * Math.PI * 2; P.push(sph(lon, line(lon), yaw, r)); }
  const vis = P.map((p) => p.d > 0);
  const nVis = vis.filter(Boolean).length;
  const ry = r * HEAD_SY;
  // silhouette spikes as a polar bump function
  const bumps: { th: number; L: number; w: number; sw: number }[] = [];
  for (const s of spikes) {
    const b = sph(s.lon, s.lat, yaw, r);
    if (Math.abs(b.d) > 0.62) continue;
    const proj = Math.sqrt(Math.max(0, 1 - b.d * b.d));
    bumps.push({ th: Math.atan2(b.y / HEAD_SY, b.x), L: s.len * proj, w: s.w, sw: s.sweep * Math.sign(Math.sin(yaw)) });
  }
  const radius = (th: number) => {
    let add = 0;
    for (const b of bumps) {
      let dth = th - (b.th + b.sw);
      while (dth > Math.PI) dth -= Math.PI * 2;
      while (dth < -Math.PI) dth += Math.PI * 2;
      // asymmetric tooth: sharp tip, base `w` radians wide
      const t = 1 - Math.abs(dth) / b.w;
      if (t > 0) add = Math.max(add, b.L * t * t * (1.2 - 0.2 * t));
    }
    return add;
  };
  const arc = (a0: number, a1: number, out: number[]) => {
    // from angle a0 to a1 (any direction), sampled finely so spikes get sharp tips
    const steps = Math.max(6, Math.ceil(Math.abs(a1 - a0) / 0.035));
    for (let i = 0; i <= steps; i++) {
      const th = a0 + (a1 - a0) * (i / steps);
      const rr = radius(th);
      out.push(Math.cos(th) * (r + rr), Math.sin(th) * (ry + rr * HEAD_SY));
    }
  };
  if (nVis === 0) {
    const pts: number[] = [];
    arc(0, Math.PI * 2, pts);
    return { pts, run: [], full: true, none: false };
  }
  if (nVis === N) {
    const pts: number[] = [];
    for (const p of P) pts.push(p.x, p.y);
    return { pts, run: pts.slice(), full: false, none: false };
  }
  // longest visible run (cyclic)
  let best = -1, bestLen = 0;
  for (let i = 0; i < N; i++) {
    if (!vis[i] || vis[(i - 1 + N) % N]) continue;
    let len = 0;
    while (len < N && vis[(i + len) % N]) len++;
    if (len > bestLen) { bestLen = len; best = i; }
  }
  const cross = (a: SP, b: SP) => {
    const t = a.d / (a.d - b.d);
    const x = lerp(a.x, b.x, t), y = lerp(a.y, b.y, t);
    const th = Math.atan2(y / HEAD_SY, x);
    return { x: Math.cos(th) * r, y: Math.sin(th) * ry, th };
  };
  const i0 = best, i1 = (best + bestLen - 1) % N;
  const e0 = cross(P[(i0 - 1 + N) % N], P[i0]);
  const e1 = cross(P[i1], P[(i1 + 1) % N]);
  const run: number[] = [e0.x, e0.y];
  for (let k = 0; k < bestLen; k++) { const p = P[(i0 + k) % N]; run.push(p.x, p.y); }
  run.push(e1.x, e1.y);
  // close along the silhouette on the crown side
  let a = e1.th, b = e0.th;
  let ccw = b - a; while (ccw < 0) ccw += Math.PI * 2;      // going +angle from a to b
  const midCcw = a + ccw / 2, midCw = a - (Math.PI * 2 - ccw) / 2;
  const onCap = (th: number) => { const q = limbLonLat(th, yaw); return q.lat > line(q.lon); };
  const pts = run.slice();
  if (onCap(midCcw)) arc(a, a + ccw, pts);
  else arc(a, a - (Math.PI * 2 - ccw), pts);
  void midCw; void b;
  return { pts, run, full: false, none: false };
}

/** Fill a cap with shade band + base + (optional) shine, outline it. */
function paintCap(c: Ctx, cap: CapResult, col: number, o: { sh?: number; hl?: number; shine?: number; ow?: number } = {}): void {
  if (cap.pts.length < 6) return;
  poly(c, cap.pts, col, { hl: o.hl ?? 0, sh: o.sh ?? 0.3, inset: 0.86, px: -0.28, py: -0.34, ow: 0 });
  if (o.shine && !inSilhouette()) {
    // two short light strokes high on the upper-left (hair sheen)
    const x = -HEAD_R * 0.32, y = -HEAD_R * 0.62;
    c.moveTo(x - 6, y + 2).quadraticCurveTo(x - 3, y - 0.6, x, y + 0.4);
    c.moveTo(x + 1.6, y + 0.2).quadraticCurveTo(x + 4, y - 0.4, x + 6, y + 1.2);
    c.stroke({ width: 1.6, color: light(col, 0.7), alpha: o.shine, cap: 'round' });
  }
  c.poly(cap.pts, true); outline(c, o.ow ?? OW);
}

/** Stroke the visible run of a cap's lower edge (helmet rims, hood trims). */
function strokeRun(c: Ctx, run: number[], w: number, col: number, ow = 1.4, alpha = 1): void {
  if (run.length < 4) return;
  if (ow > 0) { c.poly(run, false); outline(c, w + ow * 2); }
  c.poly(run, false);
  if (inSilhouette()) { fill(c, 0xffffff, 0); c.stroke({ width: w, color: 0xffffff }); return; }
  c.stroke({ width: w, color: col, alpha, join: 'round', cap: 'round' });
}

/** A tuft / spike drawn on top of the cap (front-facing), from its base on the sphere. */
function tuft(c: Ctx, s: Spike, yaw: number, r: number, col: number, down = 0): void {
  const b = sph(s.lon, s.lat, yaw, r);
  // tufts near the silhouette collapse into slivers: fade them out instead
  if (b.d < (down > 0 ? 0.32 : 0.05)) return;
  // outward normal on screen, bent towards `down` (fringes hang)
  const n = sph(s.lon, s.lat, yaw, 1);
  let nx = n.x, ny = n.y / HEAD_SY;
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl; ny /= nl;
  const dx = lerp(nx, 0, down), dy = lerp(ny, 1, down);
  const dl = Math.hypot(dx, dy) || 1;
  const L = s.len * (down > 0 ? 1 : Math.max(0.35, Math.sqrt(1 - b.d * b.d)));
  const tx = b.x + (dx / dl) * L + s.sweep * Math.sign(Math.sin(yaw)) * 3, ty = b.y + (dy / dl) * L;
  const px = -dy / dl, py = dx / dl;
  const w = s.w * HEAD_R * 0.5 * (down > 0 ? clamp(b.d * 1.3, 0.4, 1) : 1);
  const pts = [b.x - px * w - (dx / dl) * 1.5, b.y - py * w - (dy / dl) * 1.5, tx, ty, b.x + px * w - (dx / dl) * 1.5, b.y + py * w - (dy / dl) * 1.5];
  c.poly(pts, true); fill(c, col);
  c.moveTo(pts[0], pts[1]).lineTo(tx, ty).lineTo(pts[4], pts[5]); outline(c, 1.8);
}

const SPIKY: Spike[] = [
  { lon: 0, lat: 42 * D2R, len: 8, w: 0.36, sweep: -0.18 },
  { lon: 55 * D2R, lat: 38 * D2R, len: 10, w: 0.38, sweep: -0.2 },
  { lon: -55 * D2R, lat: 38 * D2R, len: 10, w: 0.38, sweep: -0.2 },
  { lon: 110 * D2R, lat: 30 * D2R, len: 11, w: 0.4, sweep: -0.24 },
  { lon: -110 * D2R, lat: 30 * D2R, len: 11, w: 0.4, sweep: -0.24 },
  { lon: 160 * D2R, lat: 14 * D2R, len: 11, w: 0.42, sweep: -0.26 },
  { lon: -160 * D2R, lat: 14 * D2R, len: 11, w: 0.42, sweep: -0.26 },
  { lon: 145 * D2R, lat: 52 * D2R, len: 10, w: 0.36, sweep: -0.22 },
  { lon: -145 * D2R, lat: 52 * D2R, len: 10, w: 0.36, sweep: -0.22 },
  { lon: 30 * D2R, lat: 72 * D2R, len: 11, w: 0.36, sweep: -0.2 },
  { lon: -30 * D2R, lat: 72 * D2R, len: 11, w: 0.36, sweep: -0.2 },
  { lon: 180 * D2R, lat: 40 * D2R, len: 11, w: 0.4, sweep: -0.22 },
  { lon: 90 * D2R, lat: 62 * D2R, len: 10, w: 0.36, sweep: -0.2 },
  { lon: -90 * D2R, lat: 62 * D2R, len: 10, w: 0.36, sweep: -0.2 },
];
// short bangs: they stop above the eyes so the face reads at game zoom
const SPIKY_FRINGE: Spike[] = [
  { lon: -26 * D2R, lat: 17 * D2R, len: 4.6, w: 0.34, sweep: 0 },
  { lon: -6 * D2R, lat: 19 * D2R, len: 5.4, w: 0.36, sweep: 0 },
  { lon: 16 * D2R, lat: 18 * D2R, len: 5, w: 0.34, sweep: 0 },
  { lon: 36 * D2R, lat: 13 * D2R, len: 4, w: 0.3, sweep: 0 },
];

function hairCapLine(style: string): LineFn {
  if (style === 'ponytail') return hairline(17, -4, -32);
  if (style === 'long') return hairline(15, -44, -90);
  return hairline(15, -3, -34); // spiky / default
}

function drawHairCap(c: Ctx, b: Body, yaw: number, underHat: boolean): void {
  if (b.hairStyle === 'none') return;
  const h = b.hair;
  const style = b.hairStyle;
  if (style === 'spiky') {
    const cap = capPolygon(hairCapLine(style), yaw, HEAD_R + 1.6, underHat ? [] : SPIKY);
    paintCap(c, cap, h, { shine: 0.55 });
    for (const s of SPIKY_FRINGE) tuft(c, s, yaw, HEAD_R + 1.2, h, 0.75);
    hairCreases(c, h, yaw, [[-40, 40], [20, 55], [140, 30]]);
  } else if (style === 'ponytail') {
    const cap = capPolygon(hairCapLine(style), yaw, HEAD_R + 1.2);
    paintCap(c, cap, h, { shine: 0.5 });
    hairCreases(c, h, yaw, [[-30, 50], [10, 58], [50, 48], [120, 40], [-120, 40]]);
    // side-swept fringe
    tuft(c, { lon: -22 * D2R, lat: 20 * D2R, len: 5.2, w: 0.42, sweep: 0 }, yaw, HEAD_R + 1, h, 0.55);
    tuft(c, { lon: 4 * D2R, lat: 21 * D2R, len: 4.4, w: 0.36, sweep: 0 }, yaw, HEAD_R + 1, h, 0.6);
    // hair tie at the back of the head
    const t = sph(Math.PI, 26 * D2R, yaw, HEAD_R + 1.4);
    if (t.d > -0.1) { rbox(c, t.x - 2.6, t.y - 3.4, 5.2, 6.8, 1.8, OUTFIT[b.cls].band, { ow: 1.6, hl: 0.3 }); }
  } else if (style === 'short' || style === 'braid') {
    // close cut with a soft side-swept fringe (braid: same cap, the plait hangs from the back as a tail part)
    const cap = capPolygon(hairline(14, -5, -28), yaw, HEAD_R + 1.1);
    paintCap(c, cap, h, { shine: 0.45 });
    tuft(c, { lon: -24 * D2R, lat: 18 * D2R, len: 4.2, w: 0.4, sweep: 0 }, yaw, HEAD_R + 0.9, h, 0.6);
    tuft(c, { lon: 2 * D2R, lat: 19 * D2R, len: 3.6, w: 0.36, sweep: 0 }, yaw, HEAD_R + 0.9, h, 0.65);
    hairCreases(c, h, yaw, [[-40, 46], [28, 56], [140, 26], [-140, 26]]);
  } else if (style === 'cropped') {
    const cap = capPolygon(hairline(21, 4, -16), yaw, HEAD_R + 0.5);
    paintCap(c, cap, shade(h, 0.04), { shine: 0.2, sh: 0.22 });
  } else if (style === 'balding') {
    // fringe ring around sides and back; a bare crown recedes from the forehead
    const ring = capPolygon(hairline(6, -4, -30), yaw, HEAD_R + 0.9);
    paintCap(c, ring, h, { shine: 0 });
    const crown = capPolygon(hairline(8, 28, 32), yaw, HEAD_R + 1.1);
    paintCap(c, crown, b.skin, { hl: 0.28, sh: 0.12 });
    if (!inSilhouette()) gloss(c, -HEAD_R * 0.3, -HEAD_R * 0.62, 4.2, 1.6, 0.4);
  } else if (style === 'bun') {
    const cap = capPolygon(hairline(17, -2, -24), yaw, HEAD_R + 1.2);
    paintCap(c, cap, h, { shine: 0.5 });
    hairCreases(c, h, yaw, [[-30, 50], [10, 58], [50, 48], [130, 40], [-130, 40]]);
    tuft(c, { lon: -18 * D2R, lat: 20 * D2R, len: 4.4, w: 0.4, sweep: 0 }, yaw, HEAD_R + 1, h, 0.55);
    drawBun(c, b, yaw, false);
  } else if (style === 'curly') {
    const cap = capPolygon(hairline(16, -10, -40), yaw, HEAD_R + 2.4, CURL_SPIKES);
    paintCap(c, cap, h, { shine: 0.25 });
    for (const [lon, lat] of CURLS) {
      const q = sph(lon * D2R, lat * D2R, yaw, HEAD_R + 2.6);
      if (q.d > 0.12 && !inSilhouette()) ball(c, q.x, q.y, 2.9, 2.6, light(h, 0.07), { hl: 0.28, ow: 1.2 });
    }
  } else {
    const cap = capPolygon(hairCapLine(style), yaw, HEAD_R + 2);
    paintCap(c, cap, h, { shine: 0.75, sh: 0.3 });
    hairCreases(c, h, yaw, [[-45, 45], [0, 60], [45, 45], [100, 30], [-100, 30], [130, 20], [-130, 20], [155, 35], [-155, 35], [180, 10]]);
    // centre parting + slim framing locks that hang just behind the cheeks
    const pa = sph(0, 30 * D2R, yaw, HEAD_R + 2), pb = sph(0, 70 * D2R, yaw, HEAD_R + 2);
    if (pa.d > 0.2) crease(c, [pa.x, pa.y, pb.x, pb.y], 1.1, shade(h, 0.35), 0.8);
    for (const sgn of [-1, 1]) {
      const lon = sgn * 74 * D2R;
      const top = sph(lon, -8 * D2R, yaw, HEAD_R + 1.8);
      if (top.d < 0.05) continue;
      const bot = sph(lon, -62 * D2R, yaw, HEAD_R + 1.2);
      const w = 2.6 * clamp(0.5 + top.d * 0.6, 0.5, 1);
      const pts = [top.x - w, top.y - 2, top.x + w, top.y - 2, bot.x + w * 0.9, bot.y + 6, bot.x + w * 0.2, bot.y + 9.5, bot.x - w * 0.6, bot.y + 8, bot.x - w, bot.y + 4];
      blob(c, pts, shade(h, 0.04), { hl: 0.1, sh: 0.25, ow: 2 });
    }
  }
}

// Curly hair: short rounded lumps on the silhouette plus puffs over the visible cap (townsfolk only).
const CURL_SPIKES: Spike[] = [
  { lon: 0, lat: 52 * D2R, len: 3.4, w: 0.5, sweep: 0 }, { lon: 60 * D2R, lat: 44 * D2R, len: 3.6, w: 0.5, sweep: 0 },
  { lon: -60 * D2R, lat: 44 * D2R, len: 3.6, w: 0.5, sweep: 0 }, { lon: 115 * D2R, lat: 30 * D2R, len: 3.8, w: 0.55, sweep: 0 },
  { lon: -115 * D2R, lat: 30 * D2R, len: 3.8, w: 0.55, sweep: 0 }, { lon: 165 * D2R, lat: 18 * D2R, len: 3.6, w: 0.55, sweep: 0 },
  { lon: -165 * D2R, lat: 18 * D2R, len: 3.6, w: 0.55, sweep: 0 }, { lon: 30 * D2R, lat: 76 * D2R, len: 3.4, w: 0.5, sweep: 0 },
  { lon: -30 * D2R, lat: 76 * D2R, len: 3.4, w: 0.5, sweep: 0 }, { lon: 180 * D2R, lat: 48 * D2R, len: 3.6, w: 0.55, sweep: 0 },
];
const CURLS: [number, number][] = [[-30, 30], [0, 33], [30, 30], [-55, 46], [-15, 52], [20, 54], [55, 46], [-35, 68], [5, 72], [40, 66], [-80, 30], [80, 30], [120, 40], [-120, 40], [150, 28], [-150, 28], [180, 40]];

/** Bun on the back of the crown; drawn behind the skull when it faces away (two passes from drawHeadView). */
function drawBun(c: Ctx, b: Body, yaw: number, back: boolean): void {
  const t = sph(Math.PI, 54 * D2R, yaw, HEAD_R + 4.2);
  if ((t.d < 0) !== back) return;
  ball(c, t.x, t.y - 2.2, 6.4, 5.8, back ? shade(b.hair, 0.12) : b.hair, { hl: 0.3 });
  if (!back && !inSilhouette()) crease(c, [t.x - 3.4, t.y - 3.4, t.x + 0.4, t.y - 0.6, t.x + 3.6, t.y - 2.8], 1, shade(b.hair, 0.35), 0.8);
  if (!back) { const r = sph(Math.PI, 48 * D2R, yaw, HEAD_R + 2.4); if (r.d > -0.4) rbox(c, r.x - 3, r.y + 0.6, 6, 2.6, 1, OUTFIT[b.cls].band, { ow: 1.2, hl: 0.3 }); }
}

/** Facial hair on the lower face (townsfolk only). Points behind the head are dropped; beards read from the front. */
function drawBeard(c: Ctx, b: Body, yaw: number): void {
  if (!b.beard) return;
  const col = b.beardColor ?? b.hair;
  const centre = sph(0, -55 * D2R, yaw);
  if (centre.d < -0.3) return;
  const edge = (lonA: number, lonB: number, latTop: (lon: number) => number, latBot: number, bulge: number, drop: number): number[] => {
    const pts: number[] = [];
    for (let i = 0; i <= 14; i++) {
      const lon = (lonA + (lonB - lonA) * i / 14) * D2R, q = sph(lon, latTop(lon / D2R) * D2R, yaw, HEAD_R + 0.6);
      if (q.d > -0.04) pts.push(q.x, q.y);
    }
    for (let i = 14; i >= 0; i--) {
      const lon = (lonA + (lonB - lonA) * i / 14) * D2R, q = sph(lon, latBot * D2R, yaw, HEAD_R + bulge);
      const k = Math.cos(lon) ** 2;
      if (q.d > -0.04) pts.push(q.x, q.y + drop * k);
    }
    return pts;
  };
  const shadeCol = shade(col, 0.32);
  if (b.beard === 'stubble') {
    const pts = edge(-78, 78, (lon) => -20 - 10 * Math.cos(lon * D2R), -84, 0.4, 0);
    if (pts.length >= 6 && !inSilhouette()) wash(c, (k) => k.poly(pts, true), shade(col, 0.15), 0.38);
    return;
  }
  if (b.beard === 'full' || b.beard === 'braided') {
    const pts = edge(-84, 84, (lon) => -16 - 16 * Math.cos(lon * D2R) ** 2, -86, 2.8, b.beard === 'braided' ? 4 : 6.5);
    if (pts.length >= 6) blob(c, pts, col, { hl: 0.12, sh: 0.3 });
    if (!inSilhouette()) for (const lon of [-30, -10, 10, 30]) {
      const a = sph(lon * D2R, -50 * D2R, yaw, HEAD_R + 1.4), z = sph(lon * D2R, -78 * D2R, yaw, HEAD_R + 2.2);
      if (a.d > 0.15) crease(c, [a.x, a.y, z.x, z.y + 3], 1, shadeCol, 0.7);
    }
    if (b.beard === 'braided') {
      const chin = sph(0, -86 * D2R, yaw, HEAD_R + 2.6);
      if (chin.d > -0.2) for (let i = 0; i < 3; i++) {
        const y = chin.y + 4 + i * 3.6;
        poly(c, [chin.x - 2.4, y, chin.x, y - 2.2, chin.x + 2.4, y, chin.x, y + 2.4], i % 2 ? shade(col, 0.08) : col, { ow: 1.2, hl: 0.2 });
      }
      if (chin.d > -0.2) rbox(c, chin.x - 2.2, chin.y + 13.2, 4.4, 2.4, 1, 0xb08a3a, { ow: 1, hl: 0.4 });
    }
  }
  if (b.beard === 'goatee') {
    const pts = edge(-26, 26, () => -60, -88, 2, 3.6);
    if (pts.length >= 6) blob(c, pts, col, { hl: 0.12, sh: 0.3 });
  }
  // moustache over the upper lip (all styles but stubble)
  for (const sgn of [-1, 1]) {
    const pts: number[] = [];
    for (const [lon, lat] of [[3, -33], [16, -32], [30, -37], [34, -44], [24, -41], [12, -40], [3, -39]] as const) {
      const q = sph(sgn * lon * D2R, lat * D2R, yaw, HEAD_R + 0.9);
      if (q.d > 0.05) pts.push(q.x, q.y);
    }
    if (pts.length >= 8) blob(c, pts, col, { hl: 0.15, ow: 1.4 });
  }
}

/** Monocle, spectacles, goggles pushed up, or an eye patch (townsfolk only). Eyes overlay at lon ±17°, lat −10°. */
function drawFace(c: Ctx, b: Body, yaw: number): void {
  if (!b.face || inSilhouette()) return;
  const ring = (lon: number, lat: number, r: number, col: number, glass: number) => {
    const q = sph(lon * D2R, lat * D2R, yaw, HEAD_R + 0.8);
    if (q.d < 0.2) return null;
    const sx = clamp(0.25 + q.d * 0.85, 0.35, 1);
    c.ellipse(q.x, q.y, r * sx, r); fill(c, glass, 0.35);
    c.ellipse(q.x, q.y, r * sx, r); c.stroke({ width: 3, color: OUT });
    c.ellipse(q.x, q.y, r * sx, r); c.stroke({ width: 1.5, color: col });
    return q;
  };
  if (b.face === 'monocle') {
    const q = ring(17, -10, 3.8, 0xd8b54a, 0xcfe8ff);
    if (q) line(c, (k) => k.moveTo(q.x + 2, q.y + 3.4).quadraticCurveTo(q.x + 5, q.y + 12, q.x + 2, q.y + 18), 0.8, 0xd8b54a, 0, false);
  } else if (b.face === 'spectacles') {
    const a = ring(17, -10, 3.4, 0x8a6a3a, 0xdfeaf2), z = ring(-17, -10, 3.4, 0x8a6a3a, 0xdfeaf2);
    if (a && z) line(c, (k) => k.moveTo(a.x - 3, a.y - 0.6).lineTo(z.x + 3, z.y - 0.6), 1.1, 0x8a6a3a, 0, false);
  } else if (b.face === 'goggles') {
    const band = capPolygon(hairline(30, 26, 20), yaw, HEAD_R + 1.6);
    if (band.run.length >= 4) strokeRun(c, band.run, 2.4, 0x5a3e28, 1.2);
    ring(16, 30, 3.6, 0xa8823a, 0x9fd0e0); ring(-16, 30, 3.6, 0xa8823a, 0x9fd0e0);
  } else if (b.face === 'eyepatch') {
    const q = sph(-17 * D2R, -10 * D2R, yaw, HEAD_R + 0.8);
    if (q.d > 0.15) { ball(c, q.x, q.y, 3.6 * clamp(0.3 + q.d, 0.4, 1), 3.4, 0x1e1a18, { ow: 1.4, hl: 0.15 }); }
    const s1 = sph(-60 * D2R, 22 * D2R, yaw, HEAD_R + 0.6), s2 = sph(40 * D2R, 26 * D2R, yaw, HEAD_R + 0.6);
    if (q.d > 0.15) line(c, (k) => k.moveTo(s1.x, s1.y).lineTo(q.x, q.y).lineTo(s2.x, s2.y), 1.2, 0x1e1a18, 0, false);
  }
}

function hairCreases(c: Ctx, h: number, yaw: number, at: [number, number][]): void {
  if (inSilhouette()) return;
  for (const [lon, lat] of at) {
    const a = sph(lon * D2R, lat * D2R, yaw, HEAD_R + 1.4);
    const b2 = sph(lon * D2R, (lat - 16) * D2R, yaw, HEAD_R + 1.4);
    if (a.d < 0.15 || b2.d < 0.1) continue;
    crease(c, [a.x, a.y, (a.x + b2.x) / 2 + 0.6, (a.y + b2.y) / 2, b2.x, b2.y], 1.1, shade(h, 0.36), 0.75);
  }
}

/** Horn: base on the sphere, curving out and up; drawn as a tapered curved polygon. */
function horn(c: Ctx, side: number, yaw: number, col: number, back: boolean): void {
  const lon = side * 78 * D2R, lat = 26 * D2R;
  const base = sph(lon, lat, yaw, HEAD_R + 1.5);
  if ((base.d < -0.05) !== back) return;
  const out = vec(0.15, 0, side, yaw), up = vec(0, 1, 0, yaw);
  const L = 20;
  const mid = { x: base.x + out.x * L * 0.5 + up.x * L * 0.25, y: base.y + out.y * L * 0.5 + up.y * L * 0.25 };
  const tip = { x: base.x + out.x * L * 0.55 + up.x * L * 1.05, y: base.y + out.y * L * 0.55 + up.y * L * 1.05 };
  // width perpendicular to the horn on screen
  const w0 = 4.4;
  const dx = mid.x - base.x, dy = mid.y - base.y, dl = Math.hypot(dx, dy) || 1;
  const px = -dy / dl, py = dx / dl;
  const pts = [base.x + px * w0, base.y + py * w0, mid.x + px * w0 * 0.55, mid.y + py * w0 * 0.55, tip.x, tip.y, mid.x - px * w0 * 0.55, mid.y - py * w0 * 0.55, base.x - px * w0, base.y - py * w0];
  blob(c, pts, back ? shade(col, 0.2) : col, { hl: 0.3, sh: 0.25 });
  if (!back) {
    crease(c, [lerp(base.x, mid.x, 0.4) - px * 3, lerp(base.y, mid.y, 0.4) - py * 3, lerp(base.x, mid.x, 0.4) + px * 3, lerp(base.y, mid.y, 0.4) + py * 3], 1, shade(col, 0.45), 0.8);
    crease(c, [lerp(mid.x, tip.x, 0.3) - px * 2, lerp(mid.y, tip.y, 0.3) - py * 2, lerp(mid.x, tip.x, 0.3) + px * 2, lerp(mid.y, tip.y, 0.3) + py * 2], 1, shade(col, 0.45), 0.8);
  }
}

/** One full head view at a yaw (degrees): skin sphere, blush, hair and headgear. Origin = head centre. */
export function drawHeadView(c: Ctx, b: Body, head: ItemLook | undefined, yawDeg: number): void {
  const yaw = yawDeg * D2R;
  const shape = head?.shape;
  const p = head?.primary ?? 0, s = head ? trim(head) : 0;
  const R = HEAD_R, RY = R * HEAD_SY;

  // ── behind the skull
  if (shape === 'helm_horned') {
    const hc = head!.variant === 3 ? light(s, 0.2) : BONE;
    horn(c, 1, yaw, hc, true); horn(c, -1, yaw, hc, true);
  }
  if (shape === 'cap') capVisor(c, head!, yaw, true);
  if (shape === 'cap' && head!.variant % 2 === 1) capFeather(c, head!, yaw, true);
  const bunVisible = b.hairStyle === 'bun' && (!shape || shape === 'circlet');
  if (bunVisible) drawBun(c, b, yaw, true);
  decorHead(c, head, yaw, true, sph, vec, HEAD_R);

  // ── skull
  ball(c, 0, 0, R, RY, b.skin, { hl: 0.2, inset: 0.9, sh: 0.22 });
  // blush on both cheeks
  for (const sgn of [-1, 1]) {
    const q = sph(sgn * 34 * D2R, -24 * D2R, yaw);
    if (q.d < 0.18 || inSilhouette()) continue;
    wash(c, (k) => k.ellipse(q.x, q.y, 2.9 * clamp(q.d * 1.2, 0.3, 1), 1.5), BLUSH, shape === 'helm' || shape === 'helm_horned' ? 0.42 : 0.5);
  }
  drawBeard(c, b, yaw);

  switch (shape) {
    case 'hood': {
      const ln = hairline(24, -30, -90);
      // soft shadow inside the opening
      const cap = capPolygon(ln, yaw, R + 3.4);
      if (cap.run.length && !inSilhouette()) { c.poly(cap.run, false); c.stroke({ width: 6, color: OUT, alpha: 0.22, join: 'round', cap: 'round' }); }
      paintCap(c, cap, p, { sh: 0.3, hl: 0 });
      strokeRun(c, cap.run, 2.2, s, 1.1);
      // cloth folds radiating from the crown
      for (const lon of [-120, -60, 60, 120, 180]) {
        const a = sph(lon * D2R, 55 * D2R, yaw, R + 3.4), b2 = sph(lon * D2R, 15 * D2R, yaw, R + 3.4);
        if (a.d > 0.2 && b2.d > 0.15) crease(c, [a.x, a.y, b2.x, b2.y], 1.1, shade(p, 0.4), 0.6);
      }
      if (head!.variant >= 2) {
        const a = sph(-100 * D2R, 40 * D2R, yaw, R + 3.4), b2 = sph(-20 * D2R, 62 * D2R, yaw, R + 3.4);
        if (a.d > 0.1 && b2.d > 0.1) crease(c, [a.x, a.y, b2.x, b2.y], 1.4, s, 0.9);
      }
      break;
    }
    case 'helm':
    case 'helm_horned': {
      // a little fringe peeks out under the brow
      if (b.hairStyle !== 'none') {
        tuft(c, { lon: -16 * D2R, lat: 4 * D2R, len: 4.5, w: 0.34, sweep: 0 }, yaw, R + 0.8, b.hair, 0.8);
        tuft(c, { lon: 10 * D2R, lat: 5 * D2R, len: 4, w: 0.3, sweep: 0 }, yaw, R + 0.8, b.hair, 0.8);
      }
      const ln = hairline(9, -17, -50);
      const cap = capPolygon(ln, yaw, R + 2.2);
      paintCap(c, cap, p, { sh: 0.3, hl: 0 });
      if (!inSilhouette()) gloss(c, -R * 0.36, -RY * 0.62, 5.6, 2.1, 0.5);
      // ridge over the crown
      const r0 = sph(0, 20 * D2R, yaw, R + 2.2), r1 = sph(0, 90 * D2R, yaw, R + 2.2), r2 = sph(Math.PI, 30 * D2R, yaw, R + 2.2);
      if (!inSilhouette()) {
        const pts: number[] = [];
        for (const q of [r0, sph(0, 55 * D2R, yaw, R + 2.2), r1, sph(Math.PI, 60 * D2R, yaw, R + 2.2), r2]) if (q.d > 0.05) pts.push(q.x, q.y);
        if (pts.length >= 4) crease(c, pts, 1.2, shade(p, 0.45), 0.55);
      }
      // brow band along the rim
      strokeRun(c, cap.run, 2.8, s, 1.4);
      // cheek-guard edge + rivets along the band
      if (head!.variant === 3 || shape === 'helm_horned') {
        for (let i = -3; i <= 3; i++) {
          const lon = i * 26 * D2R;
          const q = sph(lon, ln(lon) + 6 * D2R, yaw, R + 2.4);
          if (q.d > 0.25) rivet(c, q.x, q.y, 0.95);
        }
      }
      // nasal guard
      if (head!.variant === 1 || shape === 'helm_horned') {
        const top = sph(0, 12 * D2R, yaw, R + 2.4), bot = sph(0, -16 * D2R, yaw, R + 1.6);
        if (top.d > 0.15) {
          const w = 1.7 * clamp(top.d, 0.4, 1);
          poly(c, [top.x - w, top.y, top.x + w, top.y, bot.x + w * 0.8, bot.y, bot.x - w * 0.8, bot.y], p, { ow: 1.6, hl: 0 });
        }
      }
      // crest (variant 2): a fin along the crown
      if (shape === 'helm' && head!.variant === 2) {
        const base: SP[] = [];
        for (let k = 0; k <= 6; k++) base.push(sph(Math.PI * (k / 6), (60 + 30 * Math.sin((k / 6) * Math.PI)) * D2R, yaw, R + 2.2));
        const up = vec(0, 1, 0, yaw);
        const pts: number[] = [];
        for (let k = 0; k <= 6; k++) { const h = 9 * Math.sin((k / 6) * Math.PI * 0.9 + 0.2); pts.push(base[k].x + up.x * h, base[k].y + up.y * h); }
        for (let k = 6; k >= 0; k--) pts.push(base[k].x, base[k].y);
        blob(c, pts, s, { hl: 0.3 });
      }
      if (shape === 'helm_horned') { const hc = head!.variant === 3 ? light(s, 0.2) : BONE; horn(c, 1, yaw, hc, false); horn(c, -1, yaw, hc, false); }
      break;
    }
    case 'wizard_hat': {
      drawHairCap(c, b, yaw, true);
      wizardHat(c, head!, yaw);
      break;
    }
    case 'cap': {
      drawHairCap(c, b, yaw, true);
      const ln = hairline(17, 6, -10);
      const cap = capPolygon(ln, yaw, R + 2.6);
      paintCap(c, cap, p, { sh: 0.28, hl: 0 });
      strokeRun(c, cap.run, 2.4, s, 1.2);
      // seams
      for (const lon of [-60, 60, 180]) {
        const a = sph(lon * D2R, 80 * D2R, yaw, R + 2.6), b2 = sph(lon * D2R, 25 * D2R, yaw, R + 2.6);
        if (a.d > 0.2 && b2.d > 0.15) crease(c, [a.x, a.y, b2.x, b2.y], 1, shade(p, 0.4), 0.6);
      }
      const top = sph(0, 90 * D2R, yaw, R + 2.8);
      if (top.d > 0) ball(c, top.x, top.y, 1.8, 1.4, s, { ow: 1.2, hl: 0.3 });
      capVisor(c, head!, yaw, false);
      if (head!.variant % 2 === 1) capFeather(c, head!, yaw, false);
      break;
    }
    case 'circlet': {
      drawHairCap(c, b, yaw, false);
      const pts: number[] = [];
      let started = false;
      const lat = 15 * D2R;
      for (let i = 0; i <= 72; i++) {
        const lon = -Math.PI + (i / 72) * Math.PI * 2;
        const q = sph(lon, lat + 4 * D2R * Math.cos(lon), yaw, R + 1.9);
        if (q.d > 0.02) { pts.push(q.x, q.y); started = true; }
        else if (started) break;
      }
      // the visible arc may wrap around lon = ±180: rebuild from the front if needed
      const arc: number[] = [];
      for (let i = -36; i <= 36; i++) {
        const lon = (i / 36) * Math.PI;
        const q = sph(lon, lat + 4 * D2R * Math.cos(lon), yaw, R + 1.9);
        if (q.d > 0.02) arc.push(q.x, q.y);
      }
      const use = arc.length >= pts.length ? arc : pts;
      if (use.length >= 4) line(c, (k) => { k.poly(use, false); }, 2.2, GOLD, 1.3, false);
      const g = sph(0, 19 * D2R, yaw, R + 2.2);
      if (g.d > 0.2) gem(c, g.x, g.y - 0.5, 2.6, s, 1.2);
      if (head!.variant >= 2) { const q = sph(28 * D2R, 22 * D2R, yaw, R + 2.4); if (q.d > 0.3) spark(c, q.x, q.y - 3, 2.4, light(s, 0.5)); }
      break;
    }
    default:
      drawHairCap(c, b, yaw, false);
  }
  decorHead(c, head, yaw, false, sph, vec, HEAD_R);
  drawFace(c, b, yaw);
}

function wizardHat(c: Ctx, l: ItemLook, yaw: number): void {
  const p = l.primary, s = trim(l);
  const R = HEAD_R;
  const yb = R * 0.62;                       // brim height above the head centre
  const brimC = vec(0, yb, 0, yaw);
  const rx = 23, ry = 23 * sP * HEAD_SY + 1.2;
  // cone base and flopped tip (the tip falls backwards)
  const rb = 11.5;
  const back = vec(-1, 0, 0, yaw);
  const apex = { x: brimC.x + back.x * 11, y: brimC.y - 34 * cP * HEAD_SY + back.y * 11 };
  const knee = { x: brimC.x + back.x * 2.5, y: brimC.y - 25 * cP * HEAD_SY };
  // brim: back half first, cone, then front half
  ball(c, brimC.x, brimC.y, rx, ry, p, { hl: 0.2, sh: 0.38 });
  const L = { x: brimC.x - rb, y: brimC.y - 1 }, Rr = { x: brimC.x + rb, y: brimC.y - 1 };
  const cone = [L.x, L.y, L.x + 2.5, L.y - 9, knee.x - 4.5, knee.y, apex.x - 2, apex.y + 2.2, apex.x, apex.y, apex.x + 1.4, apex.y + 3.8, knee.x + 4.5, knee.y + 1.4, Rr.x - 2.5, Rr.y - 9, Rr.x, Rr.y, brimC.x, brimC.y + 2.4];
  blob(c, cone, p, { hl: 0.2, inset: 0.88 });
  // band
  c.poly([L.x + 0.6, L.y - 4.6, Rr.x - 0.6, Rr.y - 4.6, Rr.x, Rr.y, brimC.x, brimC.y + 2.2, L.x, L.y], true); fill(c, s);
  crease(c, [L.x + 0.6, L.y - 4.6, Rr.x - 0.6, Rr.y - 4.6], 1, OUT, 0.5);
  // star on the front of the cone (slides round with the head)
  if (l.variant >= 1) {
    const f = Math.cos(yaw);
    if (f > 0.15) {
      const sx = brimC.x + Math.sin(yaw) * 6.5, sy = brimC.y - 14;
      c.save?.(); c.translate(sx, sy); c.scale(clamp(f, 0.3, 1), 1);
      star(c, 0, 0, 5, 3, 1.3, light(s, 0.4), 1.1);
      c.restore?.();
    }
  }
  if (l.variant >= 3) { c.circle(apex.x, apex.y, 2.1); fill(c, light(s, 0.3)); c.circle(apex.x, apex.y, 2.1); outline(c, 1.2); }
  // front lip of the brim over the cone base (thin, so the brim reads as a disc)
  if (!inSilhouette()) { c.ellipse(brimC.x, brimC.y + ry * 0.35, rx * 0.92, ry * 0.55); c.stroke({ width: 1, color: light(p, 0.35), alpha: 0.35 }); }
}

function capVisor(c: Ctx, l: ItemLook, yaw: number, back: boolean): void {
  const f = Math.cos(yaw);
  // visor faces the camera when the head does; behind the skull when looking away
  if ((f < -0.25) !== back) return;
  const pts: number[] = [];
  const lat = 13 * D2R;
  for (let i = 0; i <= 8; i++) { const lon = (-58 + (116 * i) / 8) * D2R; const q = sph(lon, lat, yaw, HEAD_R + 2.6); pts.push(q.x, q.y); }
  const fwd = vec(1, -0.12, 0, yaw);
  for (let i = 8; i >= 0; i--) {
    const lon = (-58 + (116 * i) / 8) * D2R;
    const q = sph(lon, lat, yaw, HEAD_R + 2.6);
    const k = Math.cos(lon) * 9;
    pts.push(q.x + fwd.x * k, q.y + fwd.y * k);
  }
  blob(c, pts, shade(l.primary, 0.15), { hl: 0, sh: 0.3 });
}

function capFeather(c: Ctx, l: ItemLook, yaw: number, back: boolean): void {
  const base = sph(-95 * D2R, 22 * D2R, yaw, HEAD_R + 2.6);
  if ((base.d < 0) !== back) return;
  const dir = vec(-0.8, 0.9, -0.25, yaw);
  const tip = { x: base.x + dir.x * 17, y: base.y + dir.y * 17 };
  const mx = (base.x + tip.x) / 2, my = (base.y + tip.y) / 2;
  const dx = tip.x - base.x, dy = tip.y - base.y, dl = Math.hypot(dx, dy) || 1;
  const px = -dy / dl * 3.4, py = dx / dl * 3.4;
  blob(c, [base.x, base.y, mx + px, my + py, tip.x, tip.y, mx - px * 0.5, my - py * 0.5], light(trim(l), 0.2), { ow: 1.8, hl: 0 });
  crease(c, [base.x, base.y, tip.x, tip.y], 0.8, shade(trim(l), 0.4), 0.8);
}

// ─────────────────────────── face overlays ───────────────────────────

/** Eye (origin = eye centre). Larger than the old profile eyes so both read at game zoom. */
export function drawEye(c: Ctx, col: number): void {
  eye(c, 0, 0, 2.05, 3.05, col);
  if (!inSilhouette()) c.circle(-0.7, 1.1, 0.55).fill({ color: 0xffffff, alpha: 0.5 });
}
/** Open mouth: 0 = small "o" (whistle), 1 = roar. */
export function drawMouth(c: Ctx, kind: 0 | 1): void {
  if (kind === 0) { c.ellipse(0, 0, 1.5, 1.8); fill(c, 0x5a1f1f); c.ellipse(0, 0, 1.5, 1.8); outline(c, 1); return; }
  const pts = [-4.2, -1.6, 4.2, -1.6, 3.2, 3.2, 0, 4.6, -3.2, 3.2];
  blob(c, pts, 0x5a1a1a, { ow: 1.4, hl: 0 });
  if (!inSilhouette()) { c.rect(-3.2, -1.4, 6.4, 1.2).fill(0xfffaf0); c.ellipse(0, 3, 2, 1).fill(0xd84a5a); }
}
/** Angry brow (origin = brow centre, slanting down towards +x). */
export function drawBrow(c: Ctx): void {
  line(c, (k) => k.moveTo(-2.6, -0.9).lineTo(2.6, 0.9), 1.5, OUT, 0, false);
}

// ═══════════════════════════════ TORSO (cylinder) ═══════════════════════════════
// Pivot at the hips; neck at (0, -21). Symmetric silhouettes so the body can turn without mirroring.

const T_BASE = [-9, -21.6, 0, -23.2, 9, -21.6, 10.8, -10, 11.4, 0.8, 0, 2.2, -11.4, 0.8, -10.8, -10];

function torsoPts(shape: string): number[] {
  switch (shape) {
    case 'robe': return [-9.2, -21.6, 0, -23.2, 9.2, -21.6, 11, -9, 13.6, 6, 14.2, 10.4, 0, 11.6, -14.2, 10.4, -13.6, 6, -11, -9];
    case 'plate': return [-9.4, -21.6, 0, -23.6, 9.4, -21.6, 11.8, -12, 11.4, -3, 0, -1.6, -11.4, -3, -11.8, -12];
    case 'mail': return [-9.2, -21.6, 0, -23.2, 9.2, -21.6, 11.2, -10, 12, 4, 0, 5.4, -12, 4, -11.2, -10];
    case 'leather': return [-9.2, -21.6, 0, -23.2, 9.2, -21.6, 11, -10, 11.4, 2, 0, 3.4, -11.4, 2, -11, -10];
    case 'tunic': return [-9.2, -21.6, 0, -23.2, 9.2, -21.6, 11, -10, 12.4, 3, 0, 4.6, -12.4, 3, -11, -10];
    default: return T_BASE;
  }
}

export function drawTorsoBase(c: Ctx, b: Body, chest: ItemLook | undefined, waist: ItemLook | undefined): void {
  const o = OUTFIT[b.cls];
  const shape = chest?.shape ?? 'base';
  const p = chest?.primary ?? o.shirt;
  const s = chest ? trim(chest) : o.trim;
  const pts = torsoPts(shape);
  switch (shape) {
    case 'robe': {
      blob(c, pts, p, { hl: 0.16, inset: 0.88, ow: 0 });
      wash(c, (k) => k.poly([-13.4, 7.6, 13.8, 7.6, 14.2, 10.4, 0, 11.6, -14.2, 10.4], true), shade(s, 0.12), 0.95);
      crease(c, [-13.4, 7.6, 13.8, 7.6], 1, OUT, 0.45);
      crease(c, [-7, -6, -8.6, 8], 1, OUT, 0.22); crease(c, [7, -6, 8.6, 8], 1, OUT, 0.18);
      crease(c, [-2.6, -1, -3, 9], 1, OUT, 0.16); crease(c, [2.6, -1, 3, 9], 1, OUT, 0.14);
      break;
    }
    case 'plate': {
      blob(c, pts, p, { hl: 0.4, inset: 0.86, ow: 0 });
      gloss(c, -4.6, -15, 3.2, 5.2, 0.32);
      crease(c, [-8.6, -12, -7, -3], 1.1, OUT, 0.28);
      crease(c, [8.6, -12, 7, -3], 1.1, OUT, 0.28);
      for (let i = 0; i < 2; i++) {
        const y = -3.6 + i * 3.4;
        rbox(c, -11.8, y, 23.6, 4, 1.6, i === 1 ? shade(p, 0.12) : p, { ow: 1.8, hl: 0.3 });
      }
      c.roundRect(-11.8, 2.6, 23.6, 1.6, 0.6); fill(c, s);
      rivet(c, -9.4, -14); rivet(c, 9.4, -14);
      break;
    }
    case 'mail': {
      blob(c, pts, p, { hl: 0.22, ow: 0 });
      if (!inSilhouette()) {
        for (let r = 0; r < 7; r++) {
          const y = -19 + r * 3.3;
          const half = 8.6 + r * 0.42;
          for (let x = -half + (r % 2) * 1.6; x < half; x += 3.2) c.moveTo(x - 1.45, y).arc(x, y, 1.45, Math.PI, 0, true);
        }
        detail(c, 0.8, shade(p, 0.45), 0.7);
      }
      c.roundRect(-12, 2, 24, 2.4, 1); fill(c, s); c.roundRect(-12, 2, 24, 2.4, 1); outline(c, 1.3);
      break;
    }
    case 'leather': {
      blob(c, pts, p, { hl: 0.2, ow: 0 });
      stitch(c, [-10.4, 0.4, 10.4, 0.4], light(p, 0.45), 1.4, 1.2);
      crease(c, [-6.4, -15, -7.4, -3], 1, OUT, 0.2); crease(c, [6.4, -15, 7.4, -3], 1, OUT, 0.2);
      break;
    }
    case 'tunic': {
      blob(c, pts, p, { hl: 0.2, ow: 0 });
      c.poly([-12.2, 0.6, 12.2, 0.6, 12.4, 3, 0, 4.6, -12.4, 3], true); fill(c, s);
      crease(c, [-12.2, 0.6, 12.2, 0.6], 1, OUT, 0.5);
      crease(c, [-5, -14, -6, -2], 1, OUT, 0.2); crease(c, [5, -14, 6, -2], 1, OUT, 0.18);
      break;
    }
    default: {
      blob(c, pts, p, { hl: 0.2, ow: 0 });
      crease(c, [-5, -14, -6, -3], 1, OUT, 0.2); crease(c, [5, -14, 6, -3], 1, OUT, 0.18);
    }
  }
  if (waist) {
    const y = shape === 'robe' ? -5 : -4.4;
    const w = shape === 'robe' ? 11.6 : 11.8;
    if (waist.shape === 'sash') {
      rbox(c, -w, y - 1.6, w * 2, 4.4, 1.8, waist.primary, { ow: 1.8, hl: 0.3 });
      crease(c, [-w + 1, y + 0.6, w - 1, y + 0.6], 0.9, trim(waist), 0.9);
    } else {
      rbox(c, -w, y - 1.4, w * 2, 3.8, 1.2, waist.primary, { ow: 1.8, hl: 0.25 });
      stitch(c, [-w + 1, y + 0.5, w - 1, y + 0.5], light(waist.primary, 0.45), 1.2, 1);
    }
  }
  blobPath(c, pts); outline(c, OW);
}

/** Front details, centred on the chest's front line (the rig slides + foreshortens them). */
export function drawTorsoFront(c: Ctx, b: Body, chest: ItemLook | undefined, neck?: number, neckColor = 0xe8c66a): void {
  drawTorsoFrontBase(c, b, chest);
  decorTorsoFront(c, chest, neck, neckColor);
}

function drawTorsoFrontBase(c: Ctx, b: Body, chest: ItemLook | undefined): void {
  const o = OUTFIT[b.cls];
  const shape = chest?.shape ?? 'base';
  const p = chest?.primary ?? o.shirt;
  const s = chest ? trim(chest) : o.trim;
  switch (shape) {
    case 'robe':
      wash(c, (k) => k.poly([-2.4, -21, 2.4, -21, 3.8, 10.6, -3.8, 10.6], true), s, 0.95);
      crease(c, [-2.4, -21, -3.8, 10.6], 1.1, OUT, 0.55); crease(c, [2.4, -21, 3.8, 10.6], 1.1, OUT, 0.55);
      if (chest!.variant >= 2) { star(c, 0, -10, 5, 2.4, 1, light(s, 0.3)); star(c, 0, 1, 4, 1.8, 0.7, light(s, 0.3)); }
      vneck(c, b.skin, s, 3.4, 4.6);
      break;
    case 'plate':
      crease(c, [0, -20.4, 0, -4.6], 1.2, shade(p, 0.42), 0.6);
      rbox(c, -6.6, -24.4, 13.2, 4.2, 2, s, { ow: 1.8, hl: 0.4 });
      if (chest!.variant % 2 === 1) { const d = [0, -17, 2.6, -12.6, 0, -8.2, -2.6, -12.6]; c.poly(d, true); fill(c, s); c.poly(d, true); outline(c, 1.2); }
      break;
    case 'mail':
      collarFront(c, s);
      break;
    case 'leather': {
      crease(c, [0, -19.6, 0, 0.6], 1.2, shade(p, 0.45), 0.9);
      for (let i = 0; i < 5; i++) { const y = -17.6 + i * 3.4; crease(c, [-1.7, y, 1.7, y + 1.6], 1, s, 1); crease(c, [1.7, y, -1.7, y + 1.6], 1, s, 1); }
      vneck(c, b.skin, shade(p, 0.25), 3.6, 4.4);
      break;
    }
    case 'tunic':
      vneck(c, b.skin, s, 4.2, 6.6);
      break;
    default:
      vneck(c, b.skin, shade(p, 0.35), 3, 4.2);
  }
}

function vneck(c: Ctx, skin: number, edge: number, w: number, h: number): void {
  c.poly([-w, -21.8, w, -21.8, 0, -21.8 + h], true); fill(c, skin);
  crease(c, [-w, -21.8, 0, -21.8 + h, w, -21.8], 1.6, edge, 1);
}
function collarFront(c: Ctx, col: number): void {
  c.ellipse(0, -21.8, 6.4, 2.2); fill(c, col);
  c.ellipse(0, -21.8, 6.4, 2.2); outline(c, 1.4);
}

/** Back details, centred on the spine. */
export function drawTorsoBack(c: Ctx, b: Body, chest: ItemLook | undefined): void {
  const o = OUTFIT[b.cls];
  const shape = chest?.shape ?? 'base';
  const p = chest?.primary ?? o.shirt;
  const s = chest ? trim(chest) : o.trim;
  switch (shape) {
    case 'plate':
      crease(c, [0, -21, 0, -4.6], 1.6, shade(p, 0.45), 0.7);
      gloss(c, -3.4, -15, 2, 4.4, 0.25);
      c.roundRect(-6.4, -24, 12.8, 3.2, 1.4); fill(c, shade(s, 0.1)); c.roundRect(-6.4, -24, 12.8, 3.2, 1.4); outline(c, 1.4);
      break;
    case 'leather':
      crease(c, [-7.4, -20.6, 6.4, -2.4], 2.4, shade(p, 0.3), 1);
      crease(c, [7.4, -20.6, -6.4, -2.4], 2.4, shade(p, 0.3), 1);
      c.roundRect(-1.8, -13.4, 3.6, 3.6, 0.8); fill(c, GOLD);
      break;
    case 'robe':
      crease(c, [0, -20.6, 0, 10.6], 1.1, shade(p, 0.4), 0.55);
      c.poly([-5.6, -22.2, 5.6, -22.2, 0, -15.6], true); fill(c, s);
      c.poly([-5.6, -22.2, 5.6, -22.2, 0, -15.6], true); outline(c, 1.3);
      break;
    case 'mail':
      collarFront(c, s);
      crease(c, [0, -19, 0, 2], 1, shade(p, 0.45), 0.4);
      break;
    default:
      c.ellipse(0, -21.6, 6.4, 1.8); fill(c, shade(p, 0.3));
      crease(c, [0, -19, 0, -2], 1, OUT, 0.18);
  }
}

/** Belt buckle / sash knot (front of the waist, centred). */
export function drawBeltFront(c: Ctx, w: ItemLook, robe: boolean): void {
  const y = robe ? -5 : -4.4;
  const p = w.primary, s = trim(w);
  if (w.shape === 'sash') {
    blob(c, [-1.6, y + 1.6, 1.2, y + 2.6, 3.2, y + 11.6, 0.2, y + 12, -0.8, y + 6], p, { ow: 1.6 });
    blob(c, [0.6, y + 1.2, 2.8, y + 2, 5.8, y + 9, 3.6, y + 9.8], shade(p, 0.15), { ow: 1.6 });
    ball(c, 0.4, y + 0.8, 2.8, 2.5, s, { ow: 1.6 });
  } else {
    c.roundRect(-2.8, y - 2.4, 5.6, 5.8, 1.2); fill(c, s);
    c.roundRect(-2.8, y - 2.4, 5.6, 5.8, 1.2); outline(c, 1.4);
    c.roundRect(-1.2, y - 0.8, 2.4, 2.6, 0.5); fill(c, shade(s, 0.5));
    if (w.glow) gem(c, 0, y + 0.5, 1.5, light(w.glow, 0.3), 0.9);
  }
  decorBelt(c, w, y);
}

// ═══════════════════════════════ LEGS (view-baked) ═══════════════════════════════
// Pivot at the hip joint, sole at y = 12. yaw 0 = toe at the camera, 90 = profile toe to +x, 180 = heel.

export const LEG_VIEWS = [0, 30, 60, 90, 120, 150, 180];

type Pts = number[];
function mixPts(a: Pts, b: Pts, t: number): Pts { return a.map((v, i) => lerp(v, b[i], t)); }

/** Profile (toe +x) and front (toe at camera) outlines with matching point counts, per foot shape. */
const FEET: Record<string, { side: Pts; front: Pts; back: Pts }> = {
  boots: {
    side: [-4.2, 8.4, -1, 7.4, 4, 8, 7.8, 9.6, 8.2, 12.2, -4.2, 12.2],
    front: [-4.6, 8.6, -2.6, 7.6, 2.6, 7.6, 4.6, 8.6, 4.8, 12.2, -4.8, 12.2],
    back: [-4.4, 8.2, -2, 7.4, 2, 7.4, 4.4, 8.2, 4.4, 12.2, -4.4, 12.2],
  },
  greaves: {
    side: [-4.4, 8, 3.5, 7.6, 10.2, 10.6, 9.6, 12.4, -4.4, 12.4, -4.4, 10],
    front: [-4.8, 8.2, 0, 7.4, 4.8, 8.2, 5.2, 12.4, -5.2, 12.4, -5.2, 10],
    back: [-4.6, 8, 0, 7.4, 4.6, 8, 4.6, 12.4, -4.6, 12.4, -4.6, 10],
  },
  shoes: {
    side: [-3.8, 8.2, 0, 7.2, 5, 8, 9.4, 8.6, 10.6, 6.6, 11.6, 9.8, 8.6, 12.2, -3.8, 12.2],
    front: [-4.2, 8.6, -2, 7.6, 2, 7.6, 3.2, 8, 0.6, 6.2, 2.6, 7.4, 4.4, 12.2, -4.4, 12.2],
    back: [-4, 8.2, -2, 7.4, 2, 7.4, 3.2, 7.8, 3.6, 8.2, 4, 9, 4, 12.2, -4, 12.2],
  },
  base: {
    side: [-3.8, 8, 0, 7.2, 4.6, 8, 7.4, 9.8, 7.4, 12.2, -3.8, 12.2],
    front: [-4.2, 8.4, -2, 7.6, 2, 7.6, 4.2, 8.4, 4.4, 12.2, -4.4, 12.2],
    back: [-4, 8.2, -2, 7.4, 2, 7.4, 4, 8.2, 4, 12.2, -4, 12.2],
  },
};

export function drawLegView(c: Ctx, b: Body, legs: ItemLook | undefined, feet: ItemLook | undefined, yawDeg: number): void {
  const o = OUTFIT[b.cls];
  const yaw = yawDeg * D2R;
  const sn = Math.sin(yaw), cs = Math.cos(yaw);
  const shape = legs?.shape ?? 'base';
  const pc = legs?.primary ?? o.pants;
  const sc = legs ? trim(legs) : shade(o.pants, 0.3);
  const kx = 0.7 * sn; // knee / detail drift towards the toe side
  if (shape === 'plate') {
    rbox(c, -4.1, -2, 8.2, 10.5, 3.2, pc, { hl: 0.4 });
    if (cs > -0.3) { ball(c, kx, 4.4, 3.3, 2.8, light(pc, 0.12), { ow: 1.8, hl: 0.5 }); c.circle(kx, 4.4, 1.2); fill(c, sc); }
    crease(c, [-3, 0.6, 3.6, 0.6], 1, OUT, 0.35);
  } else if (shape === 'leather') {
    rbox(c, -3.7, -2, 7.4, 10.5, 3, pc, { hl: 0.25 });
    if (cs > -0.3) ball(c, kx, 4, 2.6, 2.2, sc, { ow: 1.4, hl: 0.3 });
    stitch(c, [-2.2 * Math.sign(sn || 1), -1, -2.2 * Math.sign(sn || 1), 7], light(pc, 0.5), 1.4, 1.2, 0.7, 0.6);
  } else if (shape === 'cloth') {
    rbox(c, -3.5, -2, 7, 10.5, 3, pc, { hl: 0.25 });
    c.roundRect(-3.5, 5.4, 7, 2, 0.8); fill(c, sc);
  } else {
    rbox(c, -3.5, -2, 7, 10.5, 3, pc, { hl: 0.2 });
    crease(c, [kx * 0.5, 0, kx * 0.5 + 0.6, 4], 0.9, OUT, 0.28);
  }
  // foot: blend the profile outline (scaled by how much of the length we see) with the front / back outline
  const fshape = feet?.shape ?? 'base';
  const F = FEET[fshape] ?? FEET.base;
  const fp = feet?.primary ?? o.shoes;
  const fs = feet ? trim(feet) : shade(o.shoes, 0.35);
  const side = F.side.map((v, i) => (i % 2 === 0 ? v * sn : v));
  const end = cs >= 0 ? F.front : F.back;
  const t = Math.pow(Math.abs(cs), 1.3);
  const pts = mixPts(side, end, t);
  if (fshape === 'boots') {
    rbox(c, -4.1, 2.6, 8.2, 7.5, 2.6, fp, { hl: 0.25 });
    blob(c, pts, fp, { hl: 0.2 });
    rbox(c, -4.6, 1.6, 9.2, 3.2, 1.6, fs, { ow: 1.8, hl: 0.35 });
  } else if (fshape === 'greaves') {
    rbox(c, -4.3, 2.2, 8.6, 7.6, 2.4, fp, { hl: 0.45 });
    poly(c, pts, fp, { hl: 0.35, px: -0.3 });
    if (Math.abs(sn) > 0.4) crease(c, [1.5 * sn, 7.9, 3.2 * sn, 12.2], 1, OUT, 0.5);
    c.roundRect(-4.5, 2.2, 9, 2.2, 1); fill(c, fs); c.roundRect(-4.5, 2.2, 9, 2.2, 1); outline(c, 1.4);
  } else if (fshape === 'shoes') {
    blob(c, pts, fp, { hl: 0.25 });
    const bx = lerp(10.9 * sn, 0.6, t), by = lerp(6.9, 6.4, t);
    if (cs > -0.2) { c.circle(bx, by, 1.2); fill(c, fs); }
    crease(c, [-3.2, 8.6, 3.4 * Math.max(0.5, Math.abs(sn)), 8.4], 1.3, fs, 0.95);
  } else {
    blob(c, pts, fp, { hl: 0.2 });
  }
  // toe cap highlight when the toe points at the camera
  if (cs > 0.5 && !inSilhouette()) wash(c, (k) => k.ellipse(0, 9.6, 2.6 * cs, 1.2), light(fp, 0.5), 0.35 * cs);
  decorLeg(c, legs, feet, sn, cs);
}

// ═══════════════════════════════ BACK PIECES ═══════════════════════════════

/** Mantle cape seen from behind (symmetric drape). Pivot at the nape; hangs down +y. */
export function drawCapeBack(c: Ctx, l: ItemLook): void {
  const p = shade(l.primary, 0.12), s = trim(l);
  const pts = [-8.6, 0, 0, -1.6, 8.6, 0, 11, 12, 12.6, 25, 6, 27.4, 0, 26.2, -6, 27.4, -12.6, 25, -11, 12];
  blob(c, pts, p, { hl: 0.12, sh: 0.3 });
  crease(c, [-12, 23.6, -6, 25.8, 0, 24.6, 6, 25.8, 12, 23.6], 1.8, s, 1);
  crease(c, [-4, 3, -6, 22], 1, OUT, 0.25); crease(c, [4, 3, 6, 22], 1, OUT, 0.25);
  if (l.variant >= 1 && !inSilhouette()) star(c, 0, 8, 5, 2.6, 1.1, light(s, 0.35));
}

/** Hair / hood tail hanging from the back of the head (profile, extends towards -x). */
export function drawHairTail(c: Ctx, b: Body, head: ItemLook | undefined): boolean {
  const shape = head?.shape;
  if (shape === 'hood') {
    const p = shade(head!.primary, 0.12);
    blob(c, [2, -4, -6, 2, -15, 13, -13, 21, -4, 18, 4, 8], p, { hl: 0 });
    crease(c, [-12.6, 17.6, -4.6, 15.6], 1.3, trim(head!), 1);
    return true;
  }
  if (shape === 'helm' || shape === 'helm_horned') return false;
  if (b.hairStyle === 'ponytail') {
    blob(c, [2, -1, -6, 0, -12, 9, -11, 23, -7, 28, -5.4, 18, -3, 10, 2.4, 5], b.hair, { hl: 0.2 });
    crease(c, [-4, 4, -8, 14, -7.6, 22], 1, shade(b.hair, 0.35), 0.8);
    return true;
  }
  if (b.hairStyle === 'braid') {
    // a plait of overlapping lobes, tied off with a band
    for (let i = 0; i < 6; i++) {
      const x = -2 - i * 1.6, y = 2 + i * 4.4;
      blob(c, [x + 3, y - 2.6, x - 0.4, y - 3, x - 3.4, y + 0.4, x - 1, y + 3.4, x + 3, y + 1.4], i % 2 ? shade(b.hair, 0.1) : b.hair, { hl: 0.2, ow: 1.4 });
    }
    rbox(c, -14.6, 27, 5, 2.8, 1, OUTFIT[b.cls].band, { ow: 1.2, hl: 0.3 });
    blob(c, [-13.4, 29.6, -10.4, 29.6, -10, 33, -12, 34.6, -14, 33], b.hair, { ow: 1.2 });
    return true;
  }
  return false;
}

/** Long hair falling behind the shoulders (symmetric curtain). Pivot at the head centre. */
export function drawHairCurtain(c: Ctx, b: Body, head: ItemLook | undefined): boolean {
  if (b.hairStyle !== 'long') return false;
  const shape = head?.shape;
  if (shape === 'hood' || shape === 'helm' || shape === 'helm_horned') return false;
  const h = shade(b.hair, 0.14);
  const pts = [-13.4, -4, -15.6, 6, -15, 16, -11, 23.4, -5.6, 25.6, 0, 24.4, 5.6, 25.6, 11, 23.4, 15, 16, 15.6, 6, 13.4, -4, 0, -10];
  blob(c, pts, h, { hl: 0.08, sh: 0.3 });
  crease(c, [-8.6, 4, -9.4, 22], 1.1, shade(h, 0.32), 0.7);
  crease(c, [-3, 6, -3.2, 23], 1.1, shade(h, 0.32), 0.55);
  crease(c, [3, 6, 3.2, 23], 1.1, shade(h, 0.32), 0.55);
  crease(c, [8.6, 4, 9.4, 22], 1.1, shade(h, 0.32), 0.7);
  return true;
}

/** The inside of a shield (seen when it faces away): rim, planks, straps. */
export function drawShieldBack(c: Ctx, l: ItemLook): void {
  const r = rarityOf(l), v = l.variant;
  const rim = r === 'legend' ? trim(l) : r === 'rare' ? 0xd4b13a : l.primary;
  const wood = 0x7a5232;
  if (v === 0) {
    ball(c, 0, 0, 12.4, 12.4, shade(rim, 0.15), { hl: 0.2 });
    ball(c, 0, 0, 10, 10, wood, { hl: 0.1, ow: 1.4 });
  } else {
    const pts = v === 1 ? [-10.4, -11.6, 10.4, -11.6, 10.4, 0, 0, 13.6, -10.4, 0]
      : v === 2 ? [-9.4, -13.6, 9.4, -13.6, 9.6, -2, 0, 16.4, -9.6, -2]
        : [-10, -13.4, 10, -13.4, 10.6, 11.4, 0, 14.6, -10.6, 11.4];
    poly(c, pts, shade(rim, 0.15), { hl: 0 });
    poly(c, pts.map((q, i) => (i % 2 === 0 ? q * 0.82 : q * 0.84 - 0.3)), wood, { ow: 1.4, hl: 0.1 });
  }
  if (!inSilhouette()) for (const x of [-4, 0, 4]) crease(c, [x, -9, x, 9], 1, shade(wood, 0.4), 0.6);
  rbox(c, -7, -2.6, 14, 3.2, 1.2, 0x5c3d24, { ow: 1.4, hl: 0.2 });
  rbox(c, -2.2, -5, 4.4, 8, 1.8, 0x4a3426, { ow: 1.4, hl: 0.2 });
}

// ═══════════════════════════════ SMALL PROPS & GLYPHS ═══════════════════════════════

/** Nocked arrow (nock at the origin, head towards -y). */
export function drawArrow(c: Ctx, feather = 0xd8463a): void {
  line(c, (k) => k.moveTo(0, 0).lineTo(0, -26), 1.5, 0xb08856, 1.3, false);
  poly(c, [-2.4, -24.6, 0, -31, 2.4, -24.6], 0xd8dde2, { ow: 1.2, hl: 0 });
  poly(c, [0, -1, -2.8, 2.6, -2.8, -4.2, 0, -6.4], feather, { ow: 1.1, hl: 0 });
  poly(c, [0, -1, 2.8, 2.6, 2.8, -4.2, 0, -6.4], light(feather, 0.35), { ow: 1.1, hl: 0 });
}

/** Ranger's mallet for planting sentries (grip at the origin, head towards -y). */
export function drawMallet(c: Ctx): void {
  line(c, (k) => k.moveTo(0, 3).lineTo(0, -10), 2.2, 0x8a5a34, 1.6, false);
  rbox(c, -5, -14.6, 10, 5.6, 1.6, 0xb9c2cc, { ow: 1.8, hl: 0.4 });
  c.roundRect(-5, -11, 10, 1.4, 0.4); fill(c, 0x7a8590);
}

/** Music note (whistle). */
export function drawNote(c: Ctx): void {
  ball(c, -2, 3, 3, 2.3, 0xfff2c8, { ow: 1.4, hl: 0 });
  line(c, (k) => k.moveTo(0.6, 3).lineTo(0.6, -8).quadraticCurveTo(3.6, -6, 5, -3), 1.4, 0xfff2c8, 1.2, false);
}

/** Rune glyphs (white, tinted + additive at runtime). */
export function drawRune(c: Ctx, i: number): void {
  const st = (pts: number[]) => { c.poly(pts, false); c.stroke({ width: 1.6, color: 0xffffff, cap: 'round', join: 'round' }); };
  c.circle(0, 0, 5.4); c.stroke({ width: 1.1, color: 0xffffff, alpha: 0.7 });
  switch (i % 4) {
    case 0: st([0, -3.6, 0, 3.6]); st([-2.6, -1, 0, -3.6, 2.6, -1]); break;
    case 1: st([-2.6, -3, 2.6, 3]); st([2.6, -3, -2.6, 3]); st([-2.8, 0, 2.8, 0]); break;
    case 2: st([-2.4, 3, 0, -3.4, 2.4, 3, -2.4, 3]); break;
    default: st([-2.6, -3, -2.6, 3, 2.6, -3, 2.6, 3]); break;
  }
}

void mix;
