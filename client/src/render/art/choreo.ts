// Hero choreography: pure pose functions for the turntable rig (player.ts). Every pose is described in the
// hero's body-local 3D space — x forward, y down, z = the hero's right side, origin between the feet — so
// the same swing reads correctly from any yaw: a horizontal Cleave becomes an ellipse around the hero, the
// Whirlwind blade sweeps a real circle, a bow aims at the target in depth.
//
// Timing follows render/actions.ts: t = 0 is the server event; strikes and shots RELEASE at once
// (0..strikeMs), then follow through and recover; primaries anticipate the NEXT attack at the end of their
// cycle (0.55..0.92 of it) and relax if no attack follows. Poses are deterministic in t, so the rig can
// re-evaluate past instants to sample smooth weapon trails.

import type { ActionDef } from '../actions';
import { clamp, easeIn, easeInOut, easeOut, easeOut3, lerp, smooth } from './util';

export type WeaponKind = 'none' | '1h' | '2h' | 'bow' | 'xbow' | 'hxbow' | 'staff' | 'wand';

export interface V3 { x: number; y: number; z: number }
const V = (x: number, y: number, z: number): V3 => ({ x, y, z });
export function norm(x: number, y: number, z: number): V3 { const l = Math.hypot(x, y, z) || 1; return { x: x / l, y: y / l, z: z / l }; }
function setV(o: V3, a: V3): void { o.x = a.x; o.y = a.y; o.z = a.z; }
function lerpV(o: V3, a: V3, b: V3, k: number): void { o.x = lerp(a.x, b.x, k); o.y = lerp(a.y, b.y, k); o.z = lerp(a.z, b.z, k); }
function nlerp(o: V3, a: V3, b: V3, k: number): void { lerpV(o, a, b, k); const l = Math.hypot(o.x, o.y, o.z) || 1; o.x /= l; o.y /= l; o.z /= l; }

/** Shoulder joint (right side; the left one mirrors z), arm length, head centre height. */
export const SH = { x: 0.4, y: -28.6, z: 8.2 };
export const ARM = 10.5;
export const HEAD_Y = -45.8;

/** Hand position: swing angle a in the arm's plane (0 = hanging, -π/2 = forward, -π = straight up), plane yawed
 *  by phi towards that arm's outer side. */
export function arm(side: number, a: number, phi = 0, len = ARM): V3 {
  const f = -Math.sin(a);
  return V(SH.x + len * f * Math.cos(phi), SH.y + len * Math.cos(a), side * (SH.z + len * f * Math.sin(phi)));
}
/** Blade direction: b = 0 up, π/2 horizontal forward, π down; yawed by phi towards the hero's right (+z). */
export function blade(b: number, phi = 0): V3 {
  return V(Math.sin(b) * Math.cos(phi), -Math.cos(b), Math.sin(b) * Math.sin(phi));
}

export interface Pose {
  hR: V3; hL: V3;      // hands (body-local, before the upper-body yaw)
  w: V3;               // business-end direction of the main weapon (unit); for bows: the aim (bow belly)
  up: V3;              // bow axis (bows) — unit
  upper: number;       // upper-body yaw towards the hero's right (rad): aim + twist
  twist: number;       // extra visible chest twist (slides chest details)
  lean: number; crouch: number; kneel: number; hop: number; lunge: number;
  sx: number; sy: number;
  legR: number; legL: number; spread: number;
  headYaw: number; headTilt: number;
  pull: number;        // bow string drawn to the right hand (0..1)
  nock: number;        // nocked arrow visible (0..1)
  trail: number;       // weapon trail intensity
  glowR: number; glowL: number; glowTip: number; aura: number; swirl: number; runes: number;
  expr: number;        // 0 none, 1 roar, 2 whistle, 3 focus
  tool: number;        // 1 = mallet in the right hand (sentry)
  spin: number;        // extra body yaw (rad), whirlwind
  hairFly: number; shake: number;
  vib: number;         // bow string vibration amplitude
}

export function newPose(): Pose {
  return {
    hR: V(0, 0, 0), hL: V(0, 0, 0), w: V(0, -1, 0), up: V(0, -1, 0), upper: 0, twist: 0, lean: 0, crouch: 0, kneel: 0, hop: 0, lunge: 0,
    sx: 1, sy: 1, legR: 0, legL: 0, spread: 0, headYaw: 0, headTilt: 0, pull: 0, nock: 0, trail: 0, glowR: 0, glowL: 0, glowTip: 0,
    aura: 0, swirl: 0, runes: 0, expr: 0, tool: 0, spin: 0, hairFly: 0, shake: 0, vib: 0,
  };
}

const SCALARS = ['upper', 'twist', 'lean', 'crouch', 'kneel', 'hop', 'lunge', 'sx', 'sy', 'legR', 'legL', 'spread', 'headYaw', 'headTilt',
  'pull', 'nock', 'trail', 'glowR', 'glowL', 'glowTip', 'aura', 'swirl', 'runes', 'tool', 'spin', 'hairFly', 'shake', 'vib'] as const;

export function copyPose(o: Pose, a: Pose): void {
  setV(o.hR, a.hR); setV(o.hL, a.hL); setV(o.w, a.w); setV(o.up, a.up);
  for (const k of SCALARS) o[k] = a[k];
  o.expr = a.expr;
}
/** o = mix(a, b, k) (o may alias a). */
export function mixPose(o: Pose, a: Pose, b: Pose, k: number): void {
  if (k <= 0) { if (o !== a) copyPose(o, a); return; }
  if (k >= 1) { copyPose(o, b); return; }
  lerpV(o.hR, a.hR, b.hR, k); lerpV(o.hL, a.hL, b.hL, k); nlerp(o.w, a.w, b.w, k); nlerp(o.up, a.up, b.up, k);
  for (const key of SCALARS) o[key] = lerp(a[key], b[key], k);
  o.expr = k > 0.5 ? b.expr : a.expr;
}

export interface Kit { wk: WeaponKind; shield: boolean; orb: boolean; shape: string }

/** Weapon reach (grip → business end) and where its trail starts along the blade. */
export function reachOf(shape: string | undefined): { tip: number; base: number } {
  switch (shape) {
    case 'sword': return { tip: 31, base: 8 };
    case 'axe': return { tip: 27, base: 13 };
    case 'mace': return { tip: 27, base: 13 };
    case 'sword2h': return { tip: 48, base: 10 };
    case 'axe2h': return { tip: 50, base: 26 };
    case 'staff': return { tip: 50, base: 38 };
    case 'wand': return { tip: 20, base: 12 };
    case 'crossbow': return { tip: 30, base: 20 };
    case 'handxbow': return { tip: 17, base: 10 };
    case 'bow': return { tip: 22, base: 14 };
    default: return { tip: 12, base: 2 };
  }
}

// ─────────────────────────── helpers ───────────────────────────

const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const tmpA = newPose(), tmpB = newPose(), tmpC = newPose();

// ─────────────────────────── rest / locomotion ───────────────────────────

export interface BaseIn { t: number; walk: number; move: number; dash: number; stun: number; cast: number; turn: number }

/** Idle + walk (+ dash / stun / generic cast) for a weapon kit. Writes every field of P. */
export function basePose(P: Pose, kit: Kit, s: BaseIn): void {
  const m = s.move;
  const sw = Math.sin(s.walk);
  const breath = Math.sin(s.t * (Math.PI * 2) / 1.6);
  const swing = sw * 0.42 * m;
  for (const k of SCALARS) P[k] = 0;
  P.sx = 1; P.sy = 1 + breath * 0.012 * (1 - m);
  P.expr = 0;
  P.up = V(0, -1, 0);
  P.legR = sw * 0.5 * m; P.legL = -sw * 0.5 * m;
  P.lean = 0.07 * m;
  P.hop = Math.abs(Math.sin(s.walk)) * 1.6 * m;
  const bob = V(0, breath * 0.35 * (1 - m), 0);
  switch (kit.wk) {
    case '1h':
      P.hR = arm(1, -0.42 - swing * 0.6, 0.55); P.w = norm(0.55, -0.82, 0.18);
      P.hL = kit.shield ? V(8.6 + sw * 0.8 * m, -20.6, -3.4) : arm(-1, -0.1 + swing, 0.8);
      break;
    case '2h':
      // rested at the side with the head out behind the shoulder (like the staff), so it never covers the face or
      // the helm ornaments at idle; the free hand hangs. Attacks start from here and blend as before.
      P.hR = V(1.4 + sw * 0.6 * m, -19.6, 7.8); P.hL = arm(-1, -0.12 + swing, 0.8);
      P.w = norm(-0.42, -0.9, 0.52);
      break;
    case 'bow':
      // bow carried forward in the bow hand so it reads from either side
      P.hL = V(11 + sw * 1.2 * m, -21.5, -3); P.w = norm(1, 0, 0.35); P.up = norm(0.22, -1, 0.05);
      P.hR = arm(1, -0.15 - swing, 0.7);
      break;
    case 'xbow':
      P.hR = V(3.6 + sw * 0.6 * m, -21.4, 6.6); P.hL = V(9.6 + sw * 0.6 * m, -23.4, 1.2); P.w = norm(1, -0.32, -0.05);
      break;
    case 'hxbow':
      P.hR = arm(1, -0.6 - swing * 0.5, 0.4); P.w = norm(0.8, -0.6, 0.08);
      P.hL = arm(-1, -0.1 + swing, 0.8);
      break;
    case 'staff':
      // the staff leans back and out, so it never crosses the face in 3/4 views
      P.hR = arm(1, -0.42 - swing * 0.3, 0.95); P.w = norm(-0.2, -1, 0.26);
      P.hL = arm(-1, -0.15 + swing, 0.8);
      break;
    case 'wand':
      P.hR = arm(1, -0.62 - swing * 0.6, 0.45); P.w = norm(0.62, -0.78, 0.12);
      P.hL = arm(-1, -0.42 + swing * 0.6, 0.6);
      break;
    default:
      P.hR = arm(1, -0.15 - swing, 0.9); P.hL = arm(-1, -0.15 + swing, 0.9); P.w = V(0, -1, 0);
  }
  P.hR.y += bob.y; P.hL.y += bob.y;
  // generic cast flourish (skills without a choreography): hands up a little
  if (s.cast > 0.01) {
    const c = s.cast;
    lerpV(P.hR, P.hR, arm(1, -2.5, 0.4), c * 0.8); lerpV(P.hL, P.hL, arm(-1, -2.3, 0.5), c * 0.8);
    P.sy += 0.04 * c; P.glowR = Math.max(P.glowR, c * 0.5);
  }
  // dash: lean into it, stretch, arms trail back
  if (s.dash > 0.01) {
    const d = s.dash;
    P.lean = lerp(P.lean, 0.38, d); P.sx *= 1 + 0.1 * d; P.sy *= 1 - 0.08 * d;
    P.legR = lerp(P.legR, -0.85, d); P.legL = lerp(P.legL, 0.95, d);
    if (kit.wk !== '2h' && kit.wk !== 'xbow') lerpV(P.hR, P.hR, arm(1, 0.75, 0.4), d * 0.8);
    if (!kit.shield) lerpV(P.hL, P.hL, arm(-1, 0.8, 0.4), d * 0.8);
    P.hairFly = Math.max(P.hairFly, d * 0.9);
    P.hop = lerp(P.hop, 1.5, d);
  }
  // stunned: dazed sway, arms dangling
  if (s.stun > 0.01) {
    const k = s.stun;
    P.headTilt += Math.sin(s.t * 7) * 0.14 * k;
    P.lean += Math.sin(s.t * 3.5) * 0.06 * k;
    if (kit.wk !== '2h') lerpV(P.hR, P.hR, arm(1, 0.05, 0.6), k * 0.6);
    if (!kit.shield) lerpV(P.hL, P.hL, arm(-1, 0.05, 0.6), k * 0.6);
    P.crouch = Math.max(P.crouch, 0.15 * k);
  }
  // turning: feet re-plant (a quick step) and a tiny bob
  if (s.turn > 0.01) {
    const k = s.turn;
    P.legR += Math.sin(s.t * 26) * 0.35 * k; P.legL -= Math.sin(s.t * 26) * 0.35 * k;
    P.hop += Math.abs(Math.sin(s.t * 26)) * 1.2 * k;
  }
}

// ─────────────────────────── whirlwind ───────────────────────────

export const SPIN_RATE = 2.2; // rotations per second

/** Whirlwind loop at phase (rad of body rotation), blended in by k. */
export function spinPose(P: Pose, kit: Kit, phase: number, k: number): void {
  if (k <= 0.001) return;
  const S = tmpC;
  copyPose(S, P);
  S.spin = phase;
  S.upper = 0; S.twist = 0;
  S.hR = arm(1, -1.52, 1.18, 11.4);
  S.w = norm(0.34, -0.1, 1);
  if (kit.wk === '2h' || kit.wk === 'staff' || kit.wk === 'xbow') S.hL = V(S.hR.x - S.w.x * 5, S.hR.y + 1.4, S.hR.z - S.w.z * 5);
  else S.hL = arm(-1, -1.42, 1.32, 11);
  S.lean = 0.16; S.crouch = 0.2;
  S.hop = 2.6 * Math.abs(Math.sin(phase));
  S.legR = 0.42 * Math.sin(phase * 2); S.legL = -0.42 * Math.sin(phase * 2); S.spread = 0.25;
  S.headYaw = -0.45; S.headTilt = 0.05;
  S.trail = 1; S.hairFly = 1;
  S.sx = 1.04; S.sy = 0.97;
  mixPose(P, P, S, k);
  P.spin = phase; // never interpolate the rotation itself
}

// ─────────────────────────── actions ───────────────────────────

export interface ActCtx {
  kit: Kit;
  def: ActionDef;
  skill: string;
  t: number;          // ms since the event
  cycle: number;      // attack cycle (ms)
  alt: boolean;       // alternate (backhand) primary
  primary: boolean;
  aimYaw: number;     // body-local yaw to the target (+ = hero's right side)
  aimEl: number;      // elevation to the target (rad)
}

/** Total time an action owns the body. */
export function actionLife(c: { def: ActionDef; primary: boolean; cycle: number }): number {
  return c.primary ? Math.max(c.cycle * 1.6, Math.min(c.def.durMs, c.cycle) + 60) : c.def.durMs;
}

/** Overlay an action onto P (which holds the base pose). */
export function actionPose(P: Pose, c: ActCtx): void {
  switch (c.def.pose) {
    case 'swing': return primary(P, c, swingAt);
    case 'shoot': return primary(P, c, shootAt);
    case 'flick': return primary(P, c, flickAt);
    case 'double': return timed(P, c, rendAt, 50, 90);
    case 'leapSlam': return timed(P, c, stompAt, 40, 160);
    case 'overhead': return timed(P, c, seismicAt, 50, 170);
    case 'roar': return timed(P, c, roarAt, 40, 180);
    case 'volley': return timed(P, c, volleyAt, 30, 130);
    case 'lob': return timed(P, c, lobAt, 30, 140);
    case 'skyShot': return timed(P, c, skyAt, 40, 160);
    case 'deploy': return timed(P, c, deployAt, 60, 140);
    case 'whistle': return timed(P, c, whistleAt, 60, 140);
    case 'callDown': return timed(P, c, meteorAt, 60, 170);
    case 'thrust': return timed(P, c, blackHoleAt, 50, 150);
    case 'groundBurst': return timed(P, c, novaAt, 40, 150);
    case 'summon': return timed(P, c, hydraAt, 50, 150);
    case 'empower': return timed(P, c, empowerAt, 60, 160);
    case 'spin': return;
  }
}

type At = (S: Pose, c: ActCtx, t: number, alt: boolean) => void;

/** Skills: blend in over `inMs`, out over the last `outMs` of durMs. */
function timed(P: Pose, c: ActCtx, at: At, inMs: number, outMs: number): void {
  const dur = c.def.durMs;
  const k = Math.min(smooth(seg(c.t, 0, inMs)), 1 - smooth(seg(c.t, dur - outMs, dur)));
  if (k <= 0) return;
  copyPose(tmpA, P);
  tmpA.upper = c.aimYaw;
  at(tmpA, c, c.t, c.alt);
  mixPose(P, P, tmpA, k);
}

/** Primaries: strike at once, recover, wind up for the next one at the end of the cycle, relax if none comes. */
function primary(P: Pose, c: ActCtx, at: At): void {
  const cyc = c.cycle;
  const t = c.t;
  copyPose(tmpA, P);
  tmpA.upper = c.aimYaw;
  at(tmpA, c, t, c.alt);
  // recovery towards a neutral "guard" (base pose aimed at the target)
  const recStart = c.def.strikeMs + Math.min(150, cyc * 0.32);
  const recEnd = Math.max(recStart + 40, Math.min(c.def.durMs, cyc * 0.55));
  const rec = smooth(seg(t, recStart, recEnd));
  copyPose(tmpB, P);
  tmpB.upper = c.aimYaw;
  mixPose(tmpA, tmpA, tmpB, rec * 0.85);
  // anticipation of the next attack (same skill, alternate side)
  const pre = smooth(seg(t, Math.max(recEnd, cyc * 0.55), cyc * 0.92));
  if (pre > 0) {
    copyPose(tmpB, P);
    tmpB.upper = c.aimYaw;
    at(tmpB, c, -1, !c.alt); // t < 0 → the wind-up state
    mixPose(tmpA, tmpA, tmpB, pre);
  }
  const relax = 1 - smooth(seg(t, cyc * 1.25, cyc * 1.6));
  mixPose(P, P, tmpA, relax);
}

// ── Warrior ────────────────────────────────

/**
 * Cleave. Forehand (alt = false): a wide diagonal sweep (~220°) from high behind the right shoulder, across the
 * front, to low on the left — the torso unwinds into it and the hero lunges. alt = true: an overhead chop that
 * comes down in front (so rapid chains alternate sweep / chop and never need a slow re-cock). t < 0 = wind-up.
 */
function swingAt(S: Pose, c: ActCtx, t: number, alt: boolean): void {
  const kit = c.kit;
  const big = kit.wk === '2h';
  const strike = c.def.strikeMs;
  const follow = strike + Math.min(130, c.cycle * 0.32);
  const e = t < 0 ? 0 : easeOut3(clamp(t / strike));
  const f = t < strike ? 0 : easeOut(seg(t, strike, follow));
  const sq = t < 0 ? 0 : Math.sin(clamp(t / (strike * 1.3)) * Math.PI);
  if (!alt) {
    // yaw of the sweep (deg, + = hero's right / near side) and blade elevation (0 up … π down)
    // the sweep dips towards the camera as it passes the near side and rises at the far end: a wide
    // crescent in front of the hero instead of a flat (edge-on) horizontal ring
    const A0 = 155, A1 = -68, A2 = -95;
    const a = t < strike ? lerp(A0, A1, e) : lerp(A1, A2, f);
    const r = a * Math.PI / 180;
    const arcB = Math.PI / 2 + 0.68 * Math.sin(r);
    const b = t < 0 ? 0.7 : t < strike ? lerp(0.7, arcB, smooth(e / 0.4)) : arcB - 0.15 * f;
    S.hR = arm(1, (t < 0 ? -2.3 : lerp(-2.3, -1.25, smooth(e / 0.5))) + 0.3 * f, r * 0.7, ARM * (1.05 + 0.22 * sq));
    S.w = blade(b, r);
    S.twist = t < 0 ? 0.85 : t < strike ? lerp(0.85, -0.6, e) : lerp(-0.6, -0.75, f);
    S.lean = t < 0 ? -0.1 : lerp(-0.1, 0.24, e) - 0.06 * f;
    S.crouch = t < 0 ? 0.3 : 0.12 + 0.18 * (1 - e);
    S.legR = -0.35; S.legL = 0.45; S.spread = 0.5;
    S.headYaw = t < 0 ? 0.25 : -0.1;
  } else {
    // overhead chop: blade from straight up/behind, down through the front to the ground
    const b = t < 0 ? -0.55 : t < strike ? lerp(-0.55, 2.35, e) : lerp(2.35, 2.6, f);
    S.hR = arm(1, t < 0 ? -2.95 : lerp(-2.95, -0.95, e) + 0.2 * f, 0.2, ARM * (1.05 + 0.2 * sq));
    S.w = blade(b, 0.18);
    S.twist = t < 0 ? 0.3 : lerp(0.3, -0.25, e);
    S.lean = t < 0 ? -0.24 : lerp(-0.24, 0.32, e);
    S.sy = t < 0 ? 1.06 : 1;
    S.crouch = t < 0 ? 0 : 0.28 * e;
    S.hop = t < 0 ? 2 : 2 * (1 - e);
    S.legR = -0.3; S.legL = 0.35; S.spread = 0.4;
    S.headTilt = t < 0 ? -0.12 : 0.08 * e;
  }
  if (big || kit.wk === 'staff') S.hL = V(S.hR.x - S.w.x * 5, S.hR.y - S.w.y * 5, S.hR.z - S.w.z * 5);
  else if (kit.shield) S.hL = V(lerp(9, 5, e), -24 + 2 * e, lerp(-2, -7, e));
  else S.hL = arm(-1, lerp(-1.6, -0.2, e), 1.1);
  S.lunge = c.def.lunge * 1.35 * (t < 0 ? -0.25 : e * (1 - 0.3 * f));
  S.sx = 1 + 0.12 * sq; S.sy *= 1 - 0.08 * sq;
  S.trail = t < 0 ? 0 : t < strike ? 1 : 1 - smooth(seg(t, strike + 20, follow + 50));
}

/** Two fast crossing slashes. */
function rendAt(S: Pose, c: ActCtx, t: number): void {
  const big = c.kit.wk === '2h';
  // slash 1: high-right → low-left; slash 2 (from 130 ms): low-left → high-right, crossing it
  const s1 = easeOut3(seg(t, 0, 60)), s2 = easeOut3(seg(t, 130, 195));
  const ready = smooth(seg(t, 70, 130));
  let b: number, phi: number, a: number, ph: number;
  if (t < 130) {
    const k = s1;
    b = lerp(-0.35, 2.45, k); phi = lerp(1.0, -0.55, k);
    a = lerp(-2.65, -0.75, k); ph = lerp(0.7, -0.45, k);
    // between slashes the blade drops and turns over for the rising cut
    b = lerp(b, 2.6, ready); phi = lerp(phi, -0.8, ready); a = lerp(a, -0.7, ready); ph = lerp(ph, -0.55, ready);
  } else {
    b = lerp(2.6, -0.15, s2); phi = lerp(-0.8, 1.05, s2);
    a = lerp(-0.7, -2.5, s2); ph = lerp(-0.55, 0.75, s2);
  }
  S.hR = arm(1, a, ph, ARM * 1.06);
  S.w = blade(b, phi);
  if (big) S.hL = V(S.hR.x - S.w.x * 5, S.hR.y - S.w.y * 5, S.hR.z - S.w.z * 5);
  else if (!c.kit.shield) S.hL = arm(-1, -0.6, 1);
  S.twist = t < 130 ? lerp(0.45, -0.4, s1) : lerp(-0.4, 0.45, s2);
  S.lean = 0.14 + 0.1 * Math.max(s1 * (1 - ready), s2);
  S.crouch = 0.18;
  S.spread = 0.3; S.legR = -0.25; S.legL = 0.3;
  S.lunge = c.def.lunge * (0.7 * s1 + 0.3 * s2);
  S.trail = Math.max(t < 100 ? 1 - smooth(seg(t, 60, 110)) : 0, t >= 125 ? 1 - smooth(seg(t, 195, 260)) : 0);
  const sq = Math.max(Math.sin(s1 * Math.PI) * (t < 70 ? 1 : 0), Math.sin(s2 * Math.PI) * (t > 125 ? 1 : 0));
  S.sx = 1 + 0.07 * sq; S.sy = 1 - 0.05 * sq;
}

/** Crouch → hop → slam. */
function stompAt(S: Pose, c: ActCtx, t: number): void {
  const big = c.kit.wk === '2h';
  const crouch = smooth(seg(t, 0, 90)), air = seg(t, 90, 260), slam = easeIn(seg(t, 215, 260)), land = seg(t, 260, 520);
  // raised beside / behind the head so the blade never hides the face
  const up = V(-8, -47, 13.5), back = V(-9, -40, 12);
  if (t < 90) {
    S.crouch = 0.7 * crouch; S.sy = 1 - 0.18 * crouch; S.sx = 1 + 0.12 * crouch;
    lerpV(S.hR, S.hR, back, crouch); S.w = norm(-0.6, -0.8, 0.1);
    S.hL = arm(-1, lerp(-0.3, 0.6, crouch), 0.6);
    S.lean = 0.12 * crouch;
  } else if (t < 260) {
    const h = Math.sin(air * Math.PI);
    S.hop = 16 * h; S.crouch = 0.7 * (1 - easeOut(seg(t, 90, 130)));
    S.sy = lerp(1.16, 1, seg(t, 90, 170)); S.sx = lerp(0.9, 1, seg(t, 90, 170));
    S.legR = -0.7 * h; S.legL = 0.55 * h;
    // weapon held high, then hammered down in front
    const w0 = norm(-0.25, -1, 0.1), w1 = norm(0.75, 0.65, 0.05);
    lerpV(S.hR, up, arm(1, -0.85, 0.15), slam); nlerp(S.w, w0, w1, slam);
    S.hL = big ? V(S.hR.x - S.w.x * 5, S.hR.y - S.w.y * 5, S.hR.z - S.w.z * 5) : arm(-1, lerp(-2.7, -0.6, slam), 0.7);
    S.lean = lerp(-0.12, 0.3, slam);
    S.trail = slam > 0 ? 1 : 0;
  } else {
    const e = easeOut(land);
    const imp = Math.exp(-land * 7);
    S.crouch = 0.6 * imp + 0.08; S.sx = 1 + 0.3 * imp; S.sy = 1 - 0.28 * imp;
    S.hR = arm(1, -0.85, 0.15); S.w = norm(0.75, 0.65, 0.05);
    S.hL = big ? V(S.hR.x - S.w.x * 5, S.hR.y - S.w.y * 5, S.hR.z - S.w.z * 5) : arm(-1, -0.6, 0.7);
    S.lean = 0.3 * (1 - e * 0.5);
    S.trail = 1 - smooth(seg(t, 260, 330));
    S.shake = imp;
  }
  S.spread = 0.3;
}

/** Overhead raise then smash into the ground in front. */
function seismicAt(S: Pose, c: ActCtx, t: number): void {
  const big = c.kit.wk === '2h';
  const raise = easeOut(seg(t, 0, 140)), smash = easeIn(seg(t, 135, 180)), after = seg(t, 180, 480);
  const hi = V(-4, -50, 12.5), lo = arm(1, -0.85, 0.1, ARM * 1.25);
  const wHi = norm(-0.75, -0.6, 0.05), wLo = norm(0.62, 0.78, 0);
  if (t < 135) {
    lerpV(S.hR, S.hR, hi, raise); nlerp(S.w, S.w, wHi, raise);
    S.lean = -0.3 * raise; S.sy = 1 + 0.12 * raise; S.sx = 1 - 0.07 * raise; S.hop = 4 * raise;
    S.headTilt = -0.12 * raise;
  } else {
    lerpV(S.hR, hi, lo, smash); nlerp(S.w, wHi, wLo, smash);
    const imp = t > 180 ? Math.exp(-after * 8) : 0;
    S.lean = lerp(-0.3, 0.48, smash) - 0.2 * smooth(after); S.crouch = 0.6 * smash * (1 - after * 0.6);
    S.sy = lerp(1.12, 0.8, smash) + 0.16 * smooth(after); S.sx = lerp(0.93, 1.2, smash) - 0.16 * smooth(after);
    S.hop = 4 * (1 - smash);
    S.trail = t < 175 ? smash : 1 - smooth(seg(t, 180, 260));
    S.shake = imp;
    S.lunge = c.def.lunge * smash;
  }
  S.hL = big ? V(S.hR.x - S.w.x * 5, S.hR.y - S.w.y * 5, S.hR.z - S.w.z * 5) : c.kit.shield ? V(lerp(4, 9, smash), lerp(-36, -24, smash), -6) : V(S.hR.x - 1, S.hR.y + 1, -2);
  S.spread = 0.45; S.legR = -0.35; S.legL = 0.4;
}

/** Roar: gather, then chest out, arms wide, head back, aura flare. */
function roarAt(S: Pose, c: ActCtx, t: number): void {
  const gather = smooth(seg(t, 0, 100)), burst = easeOut3(seg(t, 95, 150)), out = smooth(seg(t, 430, 600));
  const k = burst * (1 - out);
  const inR = V(5.5, -24, 5), inL = V(5.5, -24, -5);
  const wideR = arm(1, -2.35, 1.25, ARM * 1.1), wideL = arm(-1, -2.35, 1.25, ARM * 1.1);
  lerpV(S.hR, S.hR, inR, gather * (1 - burst)); lerpV(S.hL, S.hL, inL, gather * (1 - burst));
  if (burst > 0) { lerpV(S.hR, S.hR, wideR, k); lerpV(S.hL, S.hL, wideL, k); }
  if (c.kit.wk === '1h' || c.kit.wk === '2h') nlerp(S.w, S.w, norm(0.3, -0.95, 0.4), k);
  S.crouch = 0.4 * gather * (1 - burst);
  S.lean = 0.22 * gather * (1 - burst) - 0.3 * k;
  S.headTilt = -0.38 * k; S.headYaw = 0;
  S.sy = 1 - 0.08 * gather * (1 - burst) + 0.12 * k; S.sx = 1 + 0.06 * gather * (1 - burst) - 0.04 * k;
  S.expr = t > 95 && t < 470 ? 1 : t > 20 && t < 95 ? 3 : 0;
  S.aura = burst * (1 - smooth(seg(t, 200, 600)));
  S.shake = k * (t < 420 ? 0.5 : 0);
  S.spread = 0.35; S.legR = -0.2; S.legL = 0.2;
}

// ── Ranger ────────────────────────────────

/** Aim pose for bows / crossbows at elevation el, fan offset phi; draw = 0..1. */
function aimPose(S: Pose, kit: Kit, el: number, phi: number, draw: number): void {
  const aim = norm(Math.cos(el) * Math.cos(phi), -Math.sin(el), Math.cos(el) * Math.sin(phi));
  if (kit.wk === 'bow') {
    S.twist = 0.32;
    S.hL = V(0.4 + aim.x * 17, -31 + aim.y * 17, -1.6 + aim.z * 17);
    const drawn = V(-1.2 - aim.x * 2, -31.5 - aim.y * 2, 5.6 - aim.z * 2);
    const rest = V(S.hL.x - aim.x * 4, S.hL.y - aim.y * 4 + 0.5, S.hL.z - aim.z * 4 + 1.6);
    lerpV(S.hR, rest, drawn, draw);
    S.w = aim;
    // bow axis: perpendicular to the aim, canted a touch
    const upRaw = V(-aim.y * aim.x + 0.12 * aim.x, -(1 - aim.y * aim.y), -aim.y * aim.z);
    S.up = norm(upRaw.x, upRaw.y, upRaw.z);
    S.pull = draw;
  } else if (kit.wk === 'xbow') {
    S.hR = V(2.6 + aim.x * 2, -30 + aim.y * 2, 5.4 + aim.z * 2);
    S.hL = V(S.hR.x + aim.x * 9, S.hR.y + aim.y * 9 + 1, S.hR.z + aim.z * 9 - 3);
    S.w = aim;
  } else if (kit.wk === 'hxbow') {
    S.hR = V(SH.x + aim.x * 12.5, SH.y + aim.y * 12.5 + 1, SH.z * 0.4 + aim.z * 12.5);
    S.w = aim;
  } else {
    // casters / melee using a ranged skill: point the weapon
    S.hR = arm(1, -1.45 - el, 0.1 - phi, ARM * 1.1);
    S.w = aim;
  }
}

/** Hungering Arrow / any shot: release snap + recoil, string vibrates, redraw anticipates the next shot. */
function shootAt(S: Pose, c: ActCtx, t: number, alt: boolean): void {
  const kit = c.kit;
  const el = clamp(c.aimEl, -0.5, 0.6);
  const cyc = c.cycle;
  if (t < 0) { aimPose(S, kit, el, 0, 1); S.nock = 1; S.lean = 0.04; S.spread = 0.25; return; }
  const snap = seg(t, 0, Math.max(12, c.def.strikeMs * 0.5));
  const recoil = Math.exp(-t / 70) * Math.sin(Math.min(1, t / 40) * Math.PI * 0.5 + 0.3);
  if (kit.wk === 'bow') {
    aimPose(S, kit, el, 0, 1 - easeOut(snap));
    // draw hand flies back open after the release, then returns to the string
    const ret = smooth(seg(t, 60, Math.max(110, cyc * 0.5)));
    S.hR.x -= 4.5 * (1 - ret) * snap; S.hR.y -= 1.2 * (1 - ret) * snap; S.hR.z += 1.6 * (1 - ret) * snap;
    // bow kicks forward-up then settles
    S.hL.y -= 2.2 * recoil; S.hL.x -= 1.4 * recoil;
    S.vib = Math.exp(-t / 55);
    S.nock = 0;
  } else {
    aimPose(S, kit, el, 0, 1);
    // crossbows kick up and back, then settle (redraw = dip)
    const kick = Math.exp(-t / 80) * Math.min(1, t / 25);
    S.w = norm(S.w.x - 0.1 * kick, S.w.y - 0.55 * kick, S.w.z);
    S.hR.x -= 2.6 * kick; S.hL.x -= 2.6 * kick; S.hR.y -= 1 * kick; S.hL.y -= 1.6 * kick;
    const dip = Math.sin(seg(t, cyc * 0.35, cyc * 0.8) * Math.PI);
    S.w = norm(S.w.x, S.w.y + 0.2 * dip, S.w.z);
    if (kit.wk === 'hxbow') S.hR.z += (alt ? -1.2 : 1.2) * kick;
  }
  S.lean = 0.04 - 0.1 * recoil;
  S.sx = 1 - 0.03 * recoil; S.sy = 1 + 0.02 * recoil;
  S.lunge = -1.5 * recoil;
  S.spread = 0.25; S.legR = -0.15; S.legL = 0.2;
  S.glowTip = Math.exp(-t / 45);
}

/** Multishot: sweep the drawn bow across a fan while releasing. */
function volleyAt(S: Pose, c: ActCtx, t: number): void {
  const sweep = easeInOut(seg(t, 0, 150));
  const phi = lerp(0.55, -0.55, sweep);
  const draw = t < 0 ? 1 : 1 - easeOut(seg(t, 0, 20)) * (1 - 0.35 * Math.sin(sweep * Math.PI));
  aimPose(S, c.kit, 0.05, phi, draw);
  S.twist += phi * 0.7;
  const rel = Math.max(0, ...[0, 45, 90, 135].map((r) => (t >= r ? Math.exp(-(t - r) / 30) : 0)));
  S.glowTip = rel; S.vib = rel;
  S.lean = 0.05; S.crouch = 0.12; S.spread = 0.35; S.legR = -0.25; S.legL = 0.3;
  S.lunge = -1.2 * Math.exp(-t / 120) * Math.min(1, t / 30);
}

/** Cluster Arrow: aim 45° up, big recoil. */
function lobAt(S: Pose, c: ActCtx, t: number): void {
  const strike = c.def.strikeMs;
  const raise = easeOut(seg(t, 0, strike));
  const el = lerp(0.1, 0.8, raise);
  const after = seg(t, strike, strike + 120);
  aimPose(S, c.kit, el, 0, t < strike ? 1 : 1 - easeOut(seg(t, strike, strike + 15)));
  const kick = t > strike ? Math.exp(-(t - strike) / 90) : 0;
  S.lean = -0.1 * raise - 0.18 * kick; S.lunge = -3 * kick * Math.min(1, after * 6); S.hop = 1.5 * kick;
  S.sy = 1 + 0.05 * kick; S.vib = kick; S.glowTip = kick; S.nock = t < strike ? 1 : 0;
  S.spread = 0.3; S.legR = 0.2; S.legL = -0.3; S.headTilt = -0.15 * raise;
}

/** Rain of Vengeance: aim straight up, release a burst. */
function skyAt(S: Pose, c: ActCtx, t: number): void {
  const strike = c.def.strikeMs;
  const raise = easeOut(seg(t, 0, strike));
  aimPose(S, c.kit, lerp(0.3, 1.38, raise), 0, t < strike ? 1 : 1 - easeOut(seg(t, strike, strike + 15)));
  const kick = t > strike ? Math.exp(-(t - strike) / 110) : 0;
  S.lean = -0.25 * raise; S.crouch = 0.25 * raise * (1 - kick) + 0.15 * kick;
  S.sy = 1 - 0.08 * raise * (1 - kick) + 0.1 * kick; S.hop = 3 * kick;
  S.headTilt = -0.4 * raise; S.vib = kick; S.glowTip = kick * 1.2; S.nock = t < strike ? 1 : 0;
  S.spread = 0.3;
}

/** Sentry: kneel and hammer-tap twice. */
function deployAt(S: Pose, c: ActCtx, t: number): void {
  const kneel = smooth(seg(t, 0, 90));
  S.kneel = kneel; S.crouch = 0.25 * kneel; S.lean = 0.3 * kneel;
  S.tool = t > 30 ? 1 : 0;
  const tap = (t0: number) => { const u = seg(t, t0 - 70, t0); const v = seg(t, t0, t0 + 50); return t < t0 ? easeIn(u) : 1 - easeOut(v) * 0.85; };
  const k1 = tap(120), k2 = t > 140 ? tap(220) : 0;
  const hit = t < 170 ? k1 : k2;
  const hi = arm(1, -2.5, 0.3), lo = V(10, -8.5, 4.5);
  lerpV(S.hR, hi, lo, hit);
  S.w = norm(lerp(-0.2, 0.3, hit), lerp(-1, -0.2, hit), 0.1);
  if (c.kit.wk === 'bow') { S.hL = V(2, -16, -7); S.up = norm(0.6, -0.8, 0); S.w = norm(0.8, 0.6, 0); }
  else S.hL = V(7, -14, -5);
  const imp = Math.max(t > 120 ? Math.exp(-(t - 120) / 40) : 0, t > 220 ? Math.exp(-(t - 220) / 40) : 0);
  S.sy = 1 - 0.06 * imp; S.sx = 1 + 0.05 * imp;
  S.headTilt = 0.15 * kneel;
}

/** Companion: hand to mouth, whistle. */
function whistleAt(S: Pose, c: ActCtx, t: number): void {
  const up = smooth(seg(t, 0, 110));
  lerpV(S.hR, S.hR, V(8.4, -40.5, 4.5), up);
  if (c.kit.wk !== 'bow') nlerp(S.w, S.w, norm(0.2, -1, 0.3), up);
  S.headTilt = -0.2 * up; S.lean = -0.1 * up; S.sy = 1 + 0.04 * up;
  S.expr = t > 60 && t < 330 ? 2 : 0;
  S.hL = c.kit.wk === 'bow' ? S.hL : V(4, -18, -9);
}

// ── Mage ────────────────────────────────

/** Magic Missile: wand flick (alternating over / side arm) or staff thrust, sparkle at the tip. */
function flickAt(S: Pose, c: ActCtx, t: number, alt: boolean): void {
  const kit = c.kit;
  const el = clamp(c.aimEl, -0.4, 0.5);
  const strike = c.def.strikeMs;
  const e = t < 0 ? 0 : easeOut3(clamp(t / strike));
  const settle = smooth(seg(t, strike, strike + 90));
  if (kit.wk === 'staff') {
    const back = V(-1.5, -27, 7.5), fwd = V(10.5, -29 - el * 4, 4.5);
    lerpV(S.hR, back, fwd, e);
    const wBack = norm(0.35, -1, 0.1), wFwd = norm(0.9, -0.45 - el, 0.02);
    nlerp(S.w, wBack, wFwd, e);
    S.hL = V(S.hR.x - S.w.x * 9, S.hR.y - S.w.y * 9, S.hR.z - 6);
    S.lean = lerp(-0.08, 0.14, e) * (1 - settle * 0.4);
  } else {
    const backA = alt ? -1.05 : -2.4, backPh = alt ? 1.35 : 1.15;
    const a = lerp(backA, -1.45 - el * 0.6, e) + 0.12 * settle;
    const ph = lerp(backPh, 0.05, e);
    S.hR = arm(1, a, ph, ARM * 1.08);
    const wBack = alt ? norm(-0.2, -0.35, 1) : norm(-0.55, -0.8, 0.2);
    const wFwd = norm(1, -0.12 - el, 0);
    nlerp(S.w, wBack, wFwd, Math.min(1, e * 1.15));
    S.lean = lerp(-0.06, 0.12, e) * (1 - settle * 0.4);
    if (kit.orb) S.hL = arm(-1, -1.2, 0.4);
  }
  S.twist = lerp(0.35, -0.2, e);
  S.trail = t < 0 ? 0 : 1 - smooth(seg(t, strike, strike + 70));
  S.glowTip = t < 0 ? 0.35 : t < strike ? 0.5 + e * 0.5 : Math.exp(-(t - strike) / 60);
  S.glowR = S.glowTip * 0.5;
  S.lunge = 1.2 * e * (1 - settle);
  S.spread = 0.2;
}

/** Meteor: raise the weapon overhead, gather glow, float up a little, then point at the target. */
function meteorAt(S: Pose, c: ActCtx, t: number): void {
  const raise = easeOut(seg(t, 0, 170)), point = easeOut3(seg(t, 185, 255));
  const hiR = V(2, -42, 15.5), hiL = V(2, -40, -15.5);
  const ptR = arm(1, -1.4 - clamp(c.aimEl, -0.3, 0.4), 0.05, ARM * 1.15);
  lerpV(S.hR, S.hR, hiR, raise); lerpV(S.hL, S.hL, hiL, raise);
  nlerp(S.w, S.w, norm(0.02, -1, 0), raise);
  if (point > 0) {
    lerpV(S.hR, S.hR, ptR, point); nlerp(S.w, S.w, norm(1, 0.25 - clamp(c.aimEl, -0.3, 0.4), 0), point);
    lerpV(S.hL, S.hL, arm(-1, -0.4, 1), point);
  }
  const float = Math.sin(seg(t, 0, 560) * Math.PI);
  S.hop = 5 * float;
  S.lean = -0.12 * raise * (1 - point) + 0.16 * point;
  S.headTilt = -0.28 * raise * (1 - point) + 0.05 * point;
  S.sy = 1 + 0.06 * raise * (1 - point) - 0.03 * point;
  S.glowTip = t < 255 ? 0.25 + raise * 0.8 : 1.3 * Math.exp(-(t - 255) / 140);
  S.glowR = S.glowTip * 0.6; S.glowL = raise * (1 - point) * 0.6;
  S.trail = point > 0 ? 1 - smooth(seg(t, 255, 330)) : 0;
  S.expr = t < 250 ? 3 : 0;
  S.legR = 0.15 * float; S.legL = -0.25 * float;
}

/** Black Hole: gather a swirl at the hands, two-handed thrust. */
function blackHoleAt(S: Pose, c: ActCtx, t: number): void {
  const gather = smooth(seg(t, 0, 115)), thrust = easeOut3(seg(t, 115, 160)), out = smooth(seg(t, 300, 460));
  const inR = V(6.4, -27, 2.6), inL = V(6.4, -27, -2.6);
  const fR = V(17.5, -28, 2.2), fL = V(17.5, -28, -2.2);
  lerpV(S.hR, S.hR, inR, gather); lerpV(S.hL, S.hL, inL, gather);
  if (thrust > 0) { lerpV(S.hR, S.hR, fR, thrust); lerpV(S.hL, S.hL, fL, thrust); }
  nlerp(S.w, S.w, c.kit.wk === 'staff' ? norm(0.25, -1, 0) : norm(0.6, -0.8, 0), gather * (1 - thrust));
  if (thrust > 0) nlerp(S.w, S.w, norm(1, -0.2, 0), thrust);
  S.crouch = 0.28 * gather * (1 - thrust) + 0.1 * thrust;
  S.twist = 0.3 * gather * (1 - thrust) - 0.1 * thrust;
  S.lean = -0.08 * gather * (1 - thrust) + 0.26 * thrust;
  S.lunge = 2.5 * thrust;
  S.sx = 1 + 0.08 * thrust * (1 - out); S.sy = 1 - 0.05 * thrust * (1 - out);
  S.swirl = gather * (1 - out) + thrust * 0.6 * (1 - out);
  S.glowR = S.swirl * 0.8; S.glowL = S.swirl * 0.8;
  S.expr = t < 160 ? 3 : 0;
  S.spread = 0.35; S.legR = -0.3; S.legL = 0.3;
}

/** Frost Nova: raise the staff, slam its butt into the ground (wands: stab the ground). */
function novaAt(S: Pose, c: ActCtx, t: number): void {
  const strike = c.def.strikeMs;
  const raise = easeOut(seg(t, 0, strike - 35)), slam = easeIn(seg(t, strike - 35, strike));
  const imp = t > strike ? Math.exp(-(t - strike) / 70) : 0;
  if (c.kit.wk === 'staff') {
    const hi = V(3, -41, 15), lo = V(4, -25.5, 14);
    lerpV(S.hR, S.hR, hi, raise); if (slam > 0) lerpV(S.hR, hi, lo, slam);
    nlerp(S.w, S.w, norm(0.04, -1, 0), raise);
    S.hL = V(S.hR.x + 0.2, S.hR.y + 6, S.hR.z - 2.5);
  } else {
    const hi = V(2, -41, 15), lo = V(6, -9, 12);
    lerpV(S.hR, S.hR, hi, raise); if (slam > 0) lerpV(S.hR, hi, lo, slam);
    nlerp(S.w, S.w, norm(-0.3, -1, 0.1), raise); if (slam > 0) nlerp(S.w, S.w, norm(0.3, 1, 0), slam);
    S.hL = arm(-1, -2.4 + 2 * slam, 0.8);
  }
  S.hop = 2.2 * raise * (1 - slam);
  S.sy = 1 + 0.06 * raise * (1 - slam) - 0.18 * imp; S.sx = 1 + 0.16 * imp;
  S.crouch = 0.6 * Math.max(slam, imp * 0.9) * (1 - smooth(seg(t, 200, 380)));
  S.lean = 0.12 * slam;
  S.glowR = 0.4 * raise + imp; S.glowL = S.glowR;
  S.glowTip = imp * 1.2;
  S.shake = imp * 0.6;
  S.spread = 0.35; S.legR = -0.2; S.legL = 0.25;
}

/** Hydra: crouch, sweep the arm up from the ground. */
function hydraAt(S: Pose, c: ActCtx, t: number): void {
  const low = smooth(seg(t, 0, 110)), sweep = easeOut3(seg(t, 115, 205));
  const lo = arm(1, 0.75, 0.45), hi = V(-1.5, -44, 17);
  lerpV(S.hR, S.hR, lo, low); if (sweep > 0) lerpV(S.hR, lo, hi, sweep);
  nlerp(S.w, S.w, norm(-0.5, 0.8, 0.2), low); if (sweep > 0) nlerp(S.w, S.w, norm(0.45, -0.9, 0), sweep);
  S.hL = arm(-1, lerp(0.3, -1.6, sweep), 0.6);
  S.crouch = 0.5 * low * (1 - sweep); S.lean = 0.25 * low * (1 - sweep) - 0.12 * sweep;
  S.sy = 1 - 0.06 * low * (1 - sweep) + 0.1 * sweep * (1 - smooth(seg(t, 260, 460))); S.hop = 2.5 * sweep * (1 - smooth(seg(t, 230, 400)));
  S.trail = sweep > 0 ? 1 - smooth(seg(t, 205, 280)) : 0;
  S.glowR = 0.4 * low + sweep; S.glowTip = sweep * (1 - smooth(seg(t, 250, 460)));
  S.twist = 0.3 * low - 0.15 * sweep;
  S.headTilt = -0.15 * sweep;
  S.upper = c.aimYaw * lerp(1, 0.25, sweep);
}

/** Magic Weapon: hold the weapon up, runes circle it. */
function empowerAt(S: Pose, c: ActCtx, t: number): void {
  const up = easeOut(seg(t, 0, 190));
  lerpV(S.hR, S.hR, V(4, -42, 15), up);
  nlerp(S.w, S.w, norm(0.04, -1, 0.12), up);
  lerpV(S.hL, S.hL, V(6, -35, -13), up * 0.85);
  S.headTilt = -0.16 * up; S.sy = 1 + 0.05 * up; S.hop = 1.5 * up;
  S.runes = smooth(seg(t, 90, 200)) * (1 - smooth(seg(t, 420, 560)));
  S.glowTip = 0.3 + 0.9 * S.runes; S.glowR = 0.6 * S.runes; S.glowL = 0.5 * S.runes;
  S.expr = 3;
  void c;
}

// ─────────────────────────── misc reactions ───────────────────────────

/** Level-up flourish (playAction({ skill: 'level_up' })). */
export const LEVEL_UP: ActionDef = { pose: 'empower', strikeMs: 150, durMs: 700, lunge: 0, trail: 0xffd36a, kick: 0 };

export function levelUpPose(P: Pose, t: number): void {
  const k = Math.min(smooth(seg(t, 0, 120)), 1 - smooth(seg(t, 520, 700)));
  if (k <= 0) return;
  copyPose(tmpA, P);
  const jump = Math.sin(seg(t, 80, 380) * Math.PI);
  tmpA.hR = arm(1, -2.4, 1.3, ARM * 1.12); tmpA.hL = arm(-1, -2.4, 1.3, ARM * 1.12);
  tmpA.w = norm(0.2, -1, 0.3);
  tmpA.hop = 9 * jump; tmpA.sy = 1 + 0.12 * jump; tmpA.sx = 1 - 0.06 * jump;
  tmpA.legR = -0.4 * jump; tmpA.legL = 0.4 * jump; tmpA.headTilt = -0.3 * jump;
  tmpA.aura = jump; tmpA.glowR = jump; tmpA.glowL = jump; tmpA.expr = 2;
  mixPose(P, P, tmpA, k);
}
