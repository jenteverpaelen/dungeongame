// Mage M1 skills (bible v2, docs/rework/depth/MAGE.md §3): Rime Needles (second primary, freeze build-up), Thrumming
// Ray (ramping line channel), Cinderkin (melee fire spirits that burst), Rimefield (a cold field with exposure timers),
// Stormglass Orb (a slow projectile with a periodic zap), Orrery (orbiting spheres that borrow Magic Missile).
// Client contract (events) — client/src/render/vfx/mage.ts: docs/rework/depth/MAGE-PILOT.md §5.

import { MAGE_FX, modVar } from '../../shared';
import { anyEnemyWithin, bestConeAngle, bestPoint, pickTarget, summonCount } from '../brain';
import { gainResource, makeDot } from '../damage';
import { addBuff, addOwnedDot, distToSegment, dragMob, elIdx, getBuff, ticksAhead } from '../effects';
import { placeGround } from '../groundFx';
import type { Instance } from '../instance';
import { maxSummonsOf, skillCost, skillDurationMs, skillElement, skillRadius } from '../playerctx';
import { strikeFor } from '../powerActions';
import { resolveStatus } from '../powerRuntime';
import { spawnProj } from '../projectiles';
import { applyStatus } from '../status';
import { moveSummon, spawnSummon } from '../summons';
import type { ChannelState, Dot, Mob, Player, Proj, ProjHook, SkillRuntime, Strike, Summon } from '../types';
import { DEG, emitCast, face, faceTo, fanAngles, strikeOf, trimSummons, type SkillBehaviour, type SummonBehaviour } from './common';
import { groundPlus, magicMissile, meteorAt, primaryEcho, spenderCast, summonExtend } from './mage';
import {
  type BoltRules, type CastBudget, type GoneSummon, type Rimefield, choirExtra, fireBolt, lineReach, mChill, mFreeze, mHit, markHandled, mstate, nearestMob, newBudget, newTally,
  noteSpend, scaled, summonAttacked, summonHaste,
} from './mageKit';

const TAU = Math.PI * 2;
const isElite = (m: Mob) => m.tier === 1 || m.tier === 2 || m.tier === 4;

// ─────────────────────────── M7 Rime Needles (primary) ───────────────────────────

/**
 * One Rime Needles volley at `tgt`. `from` (Orrery · Frozen Moons): a borrowed cast from another point at `scale`
 * damage — rune and nodes apply, the primary-attack rules (Missile Choir, Echoing Bead, Cold Battery) do not.
 */
export function rimeNeedles(inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob, opt: { from?: { x: number; y: number }; scale?: number } = {}) {
  const borrowed = !!opt.from;
  const ox = opt.from?.x ?? p.x, oy = (opt.from?.y ?? p.y) - 6;
  const spine = rt.flags.has('needleSpine'), thorns = rt.flags.has('needlePierce');
  const n = Math.max(1, 3 + (rt.mods.projectiles ?? 0)), choir = borrowed ? 0 : choirExtra(p, rt);
  let st: Strike = { ...strikeOf(p, rt), primary: !borrowed };
  if (opt.scale !== undefined) st = scaled(st, opt.scale);
  // Freeze build-up: six needles in 2 s (Deep Chill four; Deep Winter fewer; Arcane Thorns none).
  const threshold = thorns ? 0 : Math.max(1, (rt.flags.has('needleDeepChill') ? 4 : 6) - Math.floor(modVar(rt.mods, 'needleThreshold')));
  const rules: BoltRules = {
    rt, primary: !borrowed, budget: newBudget(p), chillMs: thorns ? 0 : 1500,
    needle: { threshold, freezeMs: skillDurationMs(rt), gen: modVar(rt.mods, 'needleGen'), splinter: rt.flags.has('needleSplinter'), splitKill: modVar(rt.mods, 'needleSplitKill') },
    ...(thorns ? { pierce: 1, pierceScale: 1 } : {}),
    ...(spine ? { pierceAll: true, push: 20 } : {}),
  };
  const base = Math.atan2(tgt.y - oy, tgt.x - ox), dist = Math.hypot(tgt.x - ox, tgt.y - oy);
  // 12° fan for three needles (6° apart), 30° for five or more (7.5° apart) [bible].
  const step = (n + choir >= 5 ? 7.5 : 6) * DEG;
  // Converging Fan (node): against a near target every needle aims at it, starting from points beside the hand.
  const conv = modVar(rt.mods, 'needleConverge'), converge = conv > 0 && dist <= conv;
  fanAngles(n + choir, step).forEach((off, i) => {
    let x = ox, y = oy, a = base + off;
    if (converge) {
      const lat = (off / step) * 7;
      x = ox - Math.sin(base) * lat; y = oy + Math.cos(base) * lat; a = Math.atan2(tgt.y - y, tgt.x - x);
    }
    fireBolt(inst, p, rules, i >= n ? scaled(st, 0.6) : st, { v: spine ? 'needle_spine' : 'needle', x, y, angle: a, speed: MAGE_FX.needleSpeed, lifeMs: 760, r: spine ? 18 : 9, ...(spine ? { sz: 2 } : {}) });
  });
  if (borrowed) return;
  gainResource(p, rt.mods.gen ?? 0); // Cold Battery (tier): Arcane Power per volley
  emitCast(inst, p, rt, tgt.x, tgt.y);
}

function rimeNeedlesPrimary(inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob) {
  rimeNeedles(inst, p, rt, tgt);
  primaryEcho(inst, p, rt, tgt, (i, pl, r, t) => rimeNeedles(i, pl, r, t));
}

// ─────────────────────────── M8 Thrumming Ray (channel) ───────────────────────────

/** Ramp (ms of resonance) to full power at the base rate [bible: 2 s]. */
const RAY_FULL_MS = 2000;
interface RayState { ramp: number; angle: number; held: Map<Mob, number>; lastTick: number; pulseMs: number; tally: ReturnType<typeof newTally>; budget: CastBudget; refundAcc: number }
const rays = new WeakMap<ChannelState, RayState>();

function rayTick(inst: Instance, p: Player, rt: SkillRuntime, ch: ChannelState, dtMs: number) {
  const ms = mstate(p);
  const reach0 = rt.def.range * (1 + modVar(rt.mods, 'rayReach') / 100); // Far Reach (tier)
  let s = rays.get(ch);
  if (!s) {
    s = { ramp: 0, angle: p.faceLeft ? Math.PI : 0, held: new Map(), lastTick: -1e9, pulseMs: 1000, tally: newTally(), budget: newBudget(p), refundAcc: 0 };
    rays.set(ch, s);
    // Sustained Note (node) / Resonance (passive, 1 s): the ramp of the last channel is kept for a while.
    const keep = Math.max(modVar(rt.mods, 'rayKeep') * 1000, rt.flags.has('resonance') ? 1000 : 0);
    if (keep > 0 && inst.t - ms.rampT <= keep) s.ramp = ms.rampMs;
    // Strike the Note (node): a head start on an enemy you damaged in the last 2 s.
    const head = modVar(rt.mods, 'rayHeadStart');
    const t0 = pickTarget(inst, p.x, p.y, reach0, true, p.save.skills.targetPriority);
    if (head > 0 && t0 && t0.lastHitBy === p.id && inst.t - t0.lastDamagedT <= 2000) s.ramp = Math.max(s.ramp, RAY_FULL_MS * head / 100);
  }
  // Resonance builds while the beam stays on: Resonance (passive) +40 %, Hollowstar 2 +50 %, Resonant Staff +50 % (vars
  // rampRate, additive); Searing Thread 30 % slower.
  const rate = (1 + modVar(rt.mods, 'rampRate') / 100) * (rt.flags.has('rayBurn') ? 0.7 : 1);
  s.ramp = Math.min(RAY_FULL_MS, s.ramp + dtMs * rate);
  ms.rampMs = s.ramp; ms.rampT = inst.t;
  const full = s.ramp >= RAY_FULL_MS - 1e-6;
  const top = rt.flags.has('rayMobile') ? 2 : 2.5; // Steady Note (rune): tops out at 2×
  const mult = 1 + (top - 1) * s.ramp / RAY_FULL_MS;
  const dt = dtMs / 1000;
  noteSpend(inst, p, skillCost(p, rt) * dt);
  if (rt.flags.has('coilRegen')) p.res = Math.min(p.mres, p.res + p.ctx.d.resourceRegen * 0.3 * dt); // Signal Coil
  if (full && rt.flags.has('rayRefund')) p.res = Math.min(p.mres, p.res + 4 * dt); // Feedback Loop (rune)
  if (full) { const b = getBuff(p, 'full_resonance'); if (b) b.ms = 300; else addBuff(p, { id: 'full_resonance', ms: 300 }); } // Hollowstar Choir 6
  // Aim: the target in reach (the beam follows it), else the way you face.
  const t = pickTarget(inst, p.x, p.y, reach0 + 40, true, p.save.skills.targetPriority);
  if (t) s.angle = Math.atan2(t.y - p.y, t.x - p.x);
  ch.tickMs -= dtMs;
  if (ch.tickMs > 0) return;
  ch.tickMs += MAGE_FX.rayTickMs;
  face(p, p.x + Math.cos(s.angle) * 10);
  const fork = rt.flags.has('rayFork');
  const beams = fork ? [{ a: s.angle - 10 * DEG, k: 0.6 }, { a: s.angle + 10 * DEG, k: 0.6 }] : [{ a: s.angle, k: 1 }];
  const st = strikeOf(p, rt, rt.def.coef / 4 * mult);
  const held = new Map<Mob, number>();
  let pierced = 0;
  for (const b of beams) {
    const ux = Math.cos(b.a), uy = Math.sin(b.a);
    const len = lineReach(inst, p.x, p.y, ux, uy, reach0);
    pierced = Math.max(pierced, beam(inst, p, rt, s, p.x, p.y, ux, uy, len, scaled(st, b.k), held, full));
    inst.emit({ e: 'aoe', v: 'ray', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(len), d: Math.round(s.ramp / RAY_FULL_MS * 100), el: elIdx(st.el), s: p.id, a: +b.a.toFixed(3) }, p.x, p.y, p.id);
    ms.ray = { a: b.a, len, t: inst.t };
    // Hollowstar Choir 6: the beam refracts through one of your Projectiles or Ground effects into 3 beams at 40 %.
    if (rt.flags.has('beamRefract')) refract(inst, p, rt, s, ux, uy, len, scaled(st, b.k * modVar(rt.mods, 'refractPct') / 100), held, full);
  }
  s.held = held;
  s.lastTick = inst.t;
  // Low Hum (node): less Arcane Power per second for each enemy pierced (at least 4 per second).
  const thrift = modVar(rt.mods, 'rayThrift');
  if (thrift > 0 && pierced > 0) {
    const cost = skillCost(p, rt), back = Math.max(0, Math.min(cost - 4, pierced * thrift));
    p.res = Math.min(p.mres, p.res + back * MAGE_FX.rayTickMs / 1000);
  }
  if (full) {
    const pulse = modVar(rt.mods, 'rayPulse'); // Harmonic (node)
    if (pulse > 0 && (s.pulseMs -= MAGE_FX.rayTickMs) <= 0) {
      s.pulseMs += 1000;
      const ux = Math.cos(s.angle), uy = Math.sin(s.angle), len = lineReach(inst, p.x, p.y, ux, uy, reach0);
      const pst = strikeOf(p, rt, pulse / 100);
      for (const m of inst.queryMobs(p.x + ux * len / 2, p.y + uy * len / 2, len / 2 + 60)) if (!m.dead && distToSegment(m.x, m.y, p.x, p.y, p.x + ux * len, p.y + uy * len) <= 50 + m.r) mHit(inst, p, m, pst, rt);
      inst.emit({ e: 'aoe', v: 'ray_pulse', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(len), d: 400, el: elIdx(st.el), s: p.id, a: +s.angle.toFixed(3) }, p.x, p.y, p.id);
    }
  }
}

/** One beam segment: every enemy within the beam's half-width is struck; returns how many. */
function beam(inst: Instance, p: Player, rt: SkillRuntime, s: RayState, x0: number, y0: number, ux: number, uy: number, len: number, st: Strike, held: Map<Mob, number>, full: boolean): number {
  void full;
  const half = skillRadius(rt), x1 = x0 + ux * len, y1 = y0 + uy * len;
  const frost = rt.flags.has('rayFreeze'), burn = rt.flags.has('rayBurn'), expose = modVar(rt.mods, 'rayExpose');
  let n = 0;
  for (const m of inst.queryMobs((x0 + x1) / 2, (y0 + y1) / 2, len / 2 + half + 40)) {
    if (m.dead || distToSegment(m.x, m.y, x0, y0, x1, y1) > half + m.r) continue;
    n++;
    // Held in the beam: continuous across ticks (Frostline freeze after 2 s, Overtone after 2 s).
    const h = held.get(m) ?? ((s.lastTick >= inst.t - MAGE_FX.rayTickMs - 60 ? s.held.get(m) ?? 0 : 0) + MAGE_FX.rayTickMs);
    held.set(m, h);
    const r = mHit(inst, p, m, st, rt, s.tally);
    if (r.killed || m.dead) continue;
    if (frost) {
      mChill(inst, p, m, 600);
      if (h >= 2000 && m.freezeMs <= 0) { mFreeze(inst, p, m, 1500, s.budget); held.set(m, 0); }
    }
    if (burn && r.amount > 0) addCarriedBurn(inst, p, m, scaled(st, 0.3), 2000); // Searing Thread: 30 % of the beam over 2 s
    if (expose > 0 && h >= 2000) applyStatus(inst, p, m, resolveStatus({ kind: 'vulnerable', pct: expose, ms: 3000, exceptSource: true }, p.ctx.powers.index), p.x, p.y, 'thrumming_ray');
  }
  return n;
}

/** Searing Thread: every tick adds its share to one accumulating burn (the remaining damage carries into the new one). */
function addCarriedBurn(inst: Instance, p: Player, m: Mob, st: Strike, ms: number) {
  const dot = makeDot(inst, p, st, 'burn', ms, 500);
  const i = m.dots.findIndex((d) => d.kind === 'burn' && d.owner === p.id && d.skill === st.skill);
  if (i < 0) { addOwnedDot(p, m, dot); return; }
  const old: Dot = m.dots[i];
  const total = dot.perTick * ticksAhead(dot) + old.perTick * ticksAhead(old);
  const next = { ...dot, nextMs: Math.min(dot.nextMs, old.nextMs) };
  next.perTick = total / Math.max(1, ticksAhead(next));
  m.dots[i] = next;
}

/** Hollowstar Choir 6: the first of your Projectiles or Ground effects on the beam refracts it into 3 beams (±25°). */
function refract(inst: Instance, p: Player, rt: SkillRuntime, s: RayState, ux: number, uy: number, len: number, st: Strike, held: Map<Mob, number>, full: boolean) {
  const x0 = p.x, y0 = p.y;
  let best = Infinity, bx = 0, by = 0;
  const along = (x: number, y: number) => (x - x0) * ux + (y - y0) * uy;
  for (const pr of inst.projs) {
    if (pr.dead || pr.owner !== p || pr.strike?.skill === 'thrumming_ray') continue;
    const a = along(pr.x, pr.y);
    if (a <= 30 || a >= len || distToSegment(pr.x, pr.y, x0, y0, x0 + ux * len, y0 + uy * len) > skillRadius(rt) + pr.r) continue;
    if (a < best) { best = a; bx = pr.x; by = pr.y; }
  }
  for (const g of inst.grounds) {
    if (g.owner !== p || g.endT <= inst.t) continue;
    const a = along(g.x, g.y);
    if (a <= 30 || a >= len + g.r || distToSegment(g.x, g.y, x0, y0, x0 + ux * len, y0 + uy * len) > g.r) continue;
    const at = Math.max(30, a - Math.sqrt(Math.max(0, g.r * g.r - (distToSegment(g.x, g.y, x0, y0, x0 + ux * len, y0 + uy * len)) ** 2)));
    if (at < best) { best = at; bx = x0 + ux * at; by = y0 + uy * at; }
  }
  if (best === Infinity) return;
  const rest = Math.max(80, len - best), a0 = Math.atan2(uy, ux);
  for (const off of [-25 * DEG, 0, 25 * DEG]) {
    const vx = Math.cos(a0 + off), vy = Math.sin(a0 + off), l = lineReach(inst, bx, by, vx, vy, rest);
    beam(inst, p, rt, s, bx, by, vx, vy, l, st, held, full);
    inst.emit({ e: 'aoe', v: 'ray_refract', x: Math.round(bx), y: Math.round(by), r: Math.round(l), d: 260, el: elIdx(st.el), s: p.id, a: +(a0 + off).toFixed(3) }, bx, by, p.id);
  }
}

// ─────────────────────────── M9 Cinderkin (summon) ───────────────────────────

interface KinState { lastX: number; lastY: number; hit: boolean }
const kinStates = new WeakMap<Summon, KinState>();
const kinOf = (s: Summon) => { let k = kinStates.get(s); if (!k) { k = { lastX: s.x, lastY: s.y, hit: false }; kinStates.set(s, k); } return k; };

function cinderkin(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const t = pickTarget(inst, p.x, p.y, rt.def.range, false, p.save.skills.targetPriority);
  if (!t) return false;
  const big = rt.flags.has('kinBig'), type = rt.flags.has('kinFrost') ? 'frostkin' : 'cinderkin';
  for (const s of p.summons) if (s.skill === 'cinderkin' && s.type !== type) s.dead = true; // a rune change swaps the kin
  const max = big ? 1 : maxSummonsOf(rt);
  const n = Math.max(1, max - summonCount(p, 'cinderkin'));
  summonExtend(p, rt);
  for (let i = 0; i < n; i++) spawnKin(inst, p, rt, p.x + Math.cos(i * 2.1) * 30, p.y + Math.sin(i * 2.1) * 18);
  trimSummons(p, 'cinderkin', max);
  emitCast(inst, p, rt, t.x, t.y);
  return true;
}

function spawnKin(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number): Summon {
  const big = rt.flags.has('kinBig');
  const s = spawnSummon(inst, p, rt.flags.has('kinFrost') ? 'frostkin' : 'cinderkin', 'cinderkin', x, y, skillDurationMs(rt) * (big ? 2 : 1), big); // Bonfire Kin: 30 s
  s.aux = summonCount(p, 'cinderkin');
  // Hearth Bond (node): enemies within 120 turn on the kin as it arrives.
  const taunt = modVar(rt.mods, 'kinTaunt');
  if (taunt > 0) {
    const ts = resolveStatus({ kind: 'taunt', ms: taunt * 1000 }, p.ctx.powers.index);
    for (const m of inst.queryMobs(x, y, 120)) if (!m.dead) applyStatus(inst, p, m, ts, x, y, 'cinderkin', s);
    inst.emit({ e: 'aoe', v: 'kin_taunt', x: Math.round(x), y: Math.round(y), r: 120, d: taunt * 1000, el: elIdx(skillElement(rt)), s: p.id }, x, y, p.id);
  }
  return s;
}

/** A kin bursts: 200 % weapon damage within 80 (Bonfire Kin: three times, over 160), with the burst rules. */
function kinBurst(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, big: boolean, scale: number, depth = 0) {
  const radius = big ? 160 : skillRadius(rt);
  const st: Strike = { ...strikeOf(p, rt, 2.0 * (big ? 3 : 1) * scale), noArea: true };
  const frost = rt.flags.has('kinFrost'), budget = newBudget(p);
  let hits = 0;
  for (const m of inst.queryMobs(x, y, radius)) {
    if (m.dead) continue;
    const r = mHit(inst, p, m, st, rt);
    hits++;
    if (frost && !r.killed && !m.dead) mFreeze(inst, p, m, 1000, budget); // Frostkin: bursts freeze for 1 s
  }
  inst.emit({ e: 'aoe', v: 'kin_burst', x: Math.round(x), y: Math.round(y), r: Math.round(radius), d: 420, el: elIdx(st.el), s: p.id }, x, y, p.id);
  const tithe = modVar(rt.mods, 'kinGen'); // Kin Tithe (node)
  if (tithe > 0 && hits >= 3) gainResource(p, tithe);
  const rek = modVar(rt.mods, 'kinRekindle'); // Self-Kindling (node)
  if (rek > 0 && inst.rng.next() * 100 < rek && summonCount(p, 'cinderkin') < (big ? 1 : maxSummonsOf(rt))) spawnKin(inst, p, rt, x, y);
  // Kin Pile (node): other kin within 80 burst too, for more (one level deep).
  const pile = modVar(rt.mods, 'kinChain');
  if (pile > 0 && depth === 0) for (const o of p.summons) {
    if (o.dead || o.skill !== 'cinderkin' || (o.x - x) ** 2 + (o.y - y) ** 2 > 80 * 80) continue;
    o.dead = true; markHandled(p, o);
    kinBurst(inst, p, rt, o.x, o.y, o.big, 1 + pile / 100, 1);
  }
}

/** A kin whose time ended (or was retired) bursts where it was last seen. */
export function kinGone(inst: Instance, p: Player, s: GoneSummon) {
  if ((s.type !== 'cinderkin' && s.type !== 'frostkin') || s.handled) return;
  kinBurst(inst, p, p.ctx.modsOf('cinderkin'), s.x, s.y, s.big, 1);
}

function kinAi(inst: Instance, s: Summon, p: Player, dtMs: number, dtS: number) {
  const rt = p.ctx.modsOf('cinderkin');
  const k = kinOf(s), big = s.big ? 3 : 1;
  if (Math.hypot(s.x - p.x, s.y - p.y) > 900) { s.x = p.x - 30; s.y = p.y + 10; }
  let tgt = s.targetId ? inst.mob(s.targetId) ?? null : null;
  if (!tgt || tgt.dead || Math.hypot(tgt.x - p.x, tgt.y - p.y) > rt.def.range + 60) {
    tgt = pickTarget(inst, p.x, p.y, rt.def.range, false, p.save.skills.targetPriority);
    s.targetId = tgt ? tgt.id : 0;
  }
  s.fireMs -= dtMs * summonHaste(inst, p, s, rt);
  const ranged = rt.flags.has('kinRanged');
  if (ranged || !tgt) {
    // Lanternkin (rune): stay at your side; also the idle formation.
    const side = s.aux % 2 ? 1 : -1;
    moveSummon(inst, s, p.x + side * (36 + (s.aux >> 1) * 22), p.y + 18 + (s.aux % 3) * 8, 300, dtS, 16);
  } else moveSummon(inst, s, tgt.x, tgt.y, 360, dtS, s.r + tgt.r + 8);
  // Sparkstep (node): burning sparks every 36 units run.
  const trail = modVar(rt.mods, 'kinTrail');
  if (trail > 0 && (s.x - k.lastX) ** 2 + (s.y - k.lastY) ** 2 >= 36 * 36) { k.lastX = s.x; k.lastY = s.y; placeGround(inst, p, 'kin_sparks', s.x, s.y, 0, trail / 20); }
  if (!tgt || s.fireMs > 0) { if (s.fireMs < 0) s.fireMs = 0; return; }
  if (ranged) {
    if (Math.hypot(tgt.x - s.x, tgt.y - s.y) > 300) return;
    s.fireMs = 1000;
    faceTo(s, tgt.x); s.attackSeq++; s.attackFlagMs = 250;
    summonAttacked(inst, p, s, rt);
    const n = 1 + Math.max(0, rt.mods.projectiles ?? 0);
    fanAngles(n, 10 * DEG).forEach((off) => fireBolt(inst, p, { rt, summon: s, chillMs: rt.flags.has('kinFrost') ? 1500 : 0 }, { ...strikeOf(p, rt, 0.8 * big), src: s.id }, {
      v: 'kinbolt', x: s.x, y: s.y - 16, angle: Math.atan2(tgt!.y - s.y, tgt!.x - s.x) + off, speed: 600, lifeMs: 560, r: 10, homing: tgt!.id, turn: 3,
    }));
    return;
  }
  if (Math.hypot(tgt.x - s.x, tgt.y - s.y) > s.r + tgt.r + 14) return;
  s.fireMs = 1000;
  faceTo(s, tgt.x); s.attackSeq++; s.attackFlagMs = 250;
  summonAttacked(inst, p, s, rt);
  // Eager Kin (rune): the first hit is a burst for 200 % more, and the kin comes back at once for 8 Arcane Power.
  if (rt.flags.has('kinKamikaze') && !k.hit) {
    k.hit = true; s.dead = true; markHandled(p, s);
    kinBurst(inst, p, rt, s.x, s.y, s.big, 3);
    if (p.res >= 8) { p.res -= 8; noteSpend(inst, p, 8); spawnKin(inst, p, rt, p.x + (inst.rng.next() - 0.5) * 50, p.y + 14); }
    return;
  }
  const r = mHit(inst, p, tgt, { ...strikeOf(p, rt, rt.def.coef * big), src: s.id, noArea: false }, rt);
  if (rt.flags.has('kinFrost') && !r.killed && !tgt.dead) mChill(inst, p, tgt, 1500);
}

/** Lantern Garden 6: an ember sprite (6 s, claws for 100 % weapon damage per second); strike id 'ember_sprite'. */
export function spawnEmberSprite(inst: Instance, p: Player, x: number, y: number) {
  spawnSummon(inst, p, 'ember_sprite', 'ember_sprite', x, y, 6000);
}

function spriteAi(inst: Instance, s: Summon, p: Player, dtMs: number, dtS: number) {
  let tgt = s.targetId ? inst.mob(s.targetId) ?? null : null;
  if (!tgt || tgt.dead) { tgt = nearestMob(inst, s.x, s.y, 420); s.targetId = tgt ? tgt.id : 0; }
  s.fireMs -= dtMs * summonHaste(inst, p, s, p.ctx.modsOf('cinderkin'));
  if (!tgt) { moveSummon(inst, s, p.x, p.y + 20, 300, dtS, 40); return; }
  moveSummon(inst, s, tgt.x, tgt.y, 380, dtS, s.r + tgt.r + 6);
  if (s.fireMs > 0 || Math.hypot(tgt.x - s.x, tgt.y - s.y) > s.r + tgt.r + 12) return;
  s.fireMs = 1000;
  faceTo(s, tgt.x); s.attackSeq++; s.attackFlagMs = 220;
  mHit(inst, p, tgt, { ...strikeFor(p, 'ember_sprite', 1.0, 'fire'), src: s.id }, null);
}

// ─────────────────────────── M10 Rimefield (cooldown ground) ───────────────────────────

function rimefield(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const follow = rt.flags.has('rimeFollow');
  const r0 = skillRadius(rt);
  const bp = follow ? (anyEnemyWithin(inst, p.x, p.y, r0 + 120) ? { x: p.x, y: p.y } : null) : bestPoint(inst, p.x, p.y, rt.def.range, r0);
  if (!bp) return false;
  const dur = skillDurationMs(rt) + groundPlus(rt);
  const g = placeGround(inst, p, follow ? 'rime_ground_follow' : 'rime_ground', bp.x, bp.y, 0);
  if (g) { g.r = r0; g.endT = inst.t + dur; if (g.fx) { g.fx.offX = 0; g.fx.offY = 0; } }
  const field: Rimefield = { x: bp.x, y: bp.y, r: r0, endT: inst.t + dur, ended: false, ground: g };
  const ms = mstate(p);
  ms.fields = ms.fields.filter((f) => !f.ended);
  ms.fields.push(field);
  const contract = rt.flags.has('rimeContract'), stat = rt.flags.has('rimeStatic'), seal = rt.flags.has('rimeLongFreeze');
  const el = skillElement(rt), budget = newBudget(p);
  inst.emit({ e: 'aoe', v: contract ? 'rimefield_bloom' : 'rimefield', x: Math.round(bp.x), y: Math.round(bp.y), r: Math.round(r0), d: Math.round(dur), el: elIdx(el), s: p.id, ...(follow ? { f: 1 as const } : {}) }, bp.x, bp.y, p.id);
  // The field ticks every 0.5 s for coef / 12; exposure is sampled every 0.25 s.
  const tick = strikeOf(p, rt, rt.def.coef / 12);
  const freezeAfter = rt.flags.has('rimeQuick') ? 750 : 1500; // Cistern Staff
  const exposure = new Map<Mob, number>(), done = new Set<Mob>();
  const vuln = rt.flags.has('rimeVuln') ? resolveStatus({ kind: 'vulnerable', pct: 15, ms: 600 }, p.ctx.powers.index) : null; // Brittle Ground
  const gen = modVar(rt.mods, 'rimeGen'), finale = modVar(rt.mods, 'rimeFinale');
  const zaps = 2 + modVar(rt.mods, 'chains'); // Static Frost (+ Conductor's Legwraps)
  const zap: Strike = { ...strikeOf(p, rt, 1.0), noArea: true };
  const start = inst.t;
  let half = 0;
  const step = () => {
    if (inst.playerById(p.id) !== p) { field.ended = true; return; }
    if (inst.t >= field.endT) {
      field.ended = true;
      if (g) g.endT = 0;
      if (finale > 0) { // Shard Burst (node)
        const fst: Strike = { ...strikeOf(p, rt, finale / 100), noArea: true };
        for (const m of inst.queryMobs(field.x, field.y, field.r)) if (!m.dead) mHit(inst, p, m, fst, rt);
        inst.emit({ e: 'aoe', v: 'rime_burst', x: Math.round(field.x), y: Math.round(field.y), r: Math.round(field.r), d: 500, el: elIdx(el), s: p.id }, field.x, field.y, p.id);
      }
      return;
    }
    if (follow && p.deadMs <= 0) { field.x = p.x; field.y = p.y; }
    const prog = Math.min(1, (inst.t - start) / Math.max(1, field.endT - start));
    if (contract) field.r = r0 + (60 - r0) * prog; // Frost Bloom: shrinks to 60, damage rises to +50 %
    if (g) { g.r = field.r; g.x = field.x; g.y = field.y; g.endT = field.endT; }
    const inside = inst.queryMobs(field.x, field.y, field.r).filter((m) => !m.dead);
    const now = new Set(inside);
    for (const m of exposure.keys()) if (!now.has(m)) exposure.delete(m); // "straight": leaving resets
    if ((half = 1 - half) === 1) {
      const st = contract ? scaled(tick, 1 + 0.5 * prog) : tick;
      for (const m of inside) if (!m.dead) mHit(inst, p, m, st, rt);
      if (stat && inside.length) {
        for (let i = 0; i < zaps && inside.length; i++) {
          const m = inside[Math.floor(inst.rng.next() * inside.length)];
          if (m.dead) continue;
          mHit(inst, p, m, zap, rt);
          inst.emit({ e: 'beam', v: 'arc', x: Math.round(field.x), y: Math.round(field.y), tx: Math.round(m.x), ty: Math.round(m.y), el: elIdx('lightning'), d: 200 }, m.x, m.y, p.id);
        }
      }
    }
    for (const m of inside) {
      if (m.dead) continue;
      if (vuln) applyStatus(inst, p, m, vuln, field.x, field.y, 'rimefield');
      if (stat) continue;
      mChill(inst, p, m, 600);
      const e = (exposure.get(m) ?? 0) + 250;
      exposure.set(m, e);
      const ms2 = sealState(m);
      if (e >= freezeAfter && !done.has(m) && (!seal || inst.t >= ms2.sealT)) {
        done.add(m);
        if (mFreeze(inst, p, m, seal ? 3000 : 1500, budget)) {
          if (seal) ms2.sealT = inst.t + 10000; // Permafrost Seal: once per 10 s per enemy
          if (gen > 0) gainResource(p, gen); // Frozen Power (node)
        }
      }
      if (contract && m.freezeMs > 0) { const d = Math.hypot(m.x - field.x, m.y - field.y); if (d > 14) dragMob(inst, m, field.x, field.y, Math.min(20, d - 12), p); }
    }
    inst.sched.schedule(inst.t + 250, step);
  };
  inst.sched.schedule(inst.t + 250, step);
  emitCast(inst, p, rt, bp.x, bp.y, r0);
  return true;
}

const seals = new WeakMap<Mob, { sealT: number }>();
const sealState = (m: Mob) => { let s = seals.get(m); if (!s) { s = { sealT: -1e9 }; seals.set(m, s); } return s; };

/** Ice Mirror (node): casting Frost Nova inside one of your fields adds time to it. */
export function extendFieldsAt(inst: Instance, p: Player) {
  const rt = p.ctx.slotted('rimefield');
  const add = rt ? modVar(rt.mods, 'rimeRefresh') : 0;
  if (add <= 0) return;
  for (const f of mstate(p).fields) {
    if (f.ended || f.endT <= inst.t || (f.x - p.x) ** 2 + (f.y - p.y) ** 2 > f.r * f.r) continue;
    f.endT += add * 1000;
    inst.emit({ e: 'aoe', v: 'rimefield_extend', x: Math.round(f.x), y: Math.round(f.y), r: Math.round(f.r), d: Math.round(f.endT - inst.t), el: elIdx('cold'), s: p.id }, f.x, f.y, p.id);
  }
}

// ─────────────────────────── M11 Stormglass Orb (spender) ───────────────────────────

function stormglassOrb(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  let ang = bestConeAngle(inst, p.x, p.y, rt.def.range, 15 * DEG);
  if (ang === null) {
    const t = pickTarget(inst, p.x, p.y, rt.def.range, true, p.save.skills.targetPriority);
    if (!t) return false;
    ang = Math.atan2(t.y - p.y, t.x - p.x);
  }
  face(p, p.x + Math.cos(ang) * 10);
  const n = 1 + Math.max(0, rt.mods.projectiles ?? 0); // Glass Concord 2 and other Projectile counts
  const tally = newTally();
  // Extra orbs fan out 25° [P] and deal half damage (skill text).
  fanAngles(n, 25 * DEG).forEach((off, i) => launchOrb(inst, p, rt, ang! + off, tally, i === 0 ? 1 : 0.5));
  spenderCast(inst, p, rt, p.x + Math.cos(ang) * 220, p.y + Math.sin(ang) * 220);
  noteSpend(inst, p, skillCost(p, rt));
  emitCast(inst, p, rt, p.x + Math.cos(ang) * rt.def.range, p.y + Math.sin(ang) * rt.def.range);
  return true;
}

function launchOrb(inst: Instance, p: Player, rt: SkillRuntime, ang: number, tally: ReturnType<typeof newTally>, scale = 1) {
  const slow = rt.flags.has('orbSlow'), bounce = rt.flags.has('orbBounce'), hail = rt.flags.has('orbFreeze');
  const speed = MAGE_FX.orbSpeed * (slow ? 0.5 : 1);
  const life = MAGE_FX.orbLifeMs + (bounce ? 1000 : 0); // Pinball: 1 s longer
  const every = 250 / (slow ? 1.5 : 1); // Slow Thunder: 50 % more often
  const reach = skillRadius(rt), targets = 3 + modVar(rt.mods, 'orbZaps') + modVar(rt.mods, 'chains');
  const forkEvery = modVar(rt.mods, 'orbFork'), gen = modVar(rt.mods, 'orbGen'), seek = modVar(rt.mods, 'orbSeek');
  const st: Strike = scaled(strikeOf(p, rt), scale);
  const budget = newBudget(p), zapped = new Set<Mob>(), ms = mstate(p);
  let zapMs = every, count = 0;
  const hook: ProjHook = {
    hit: () => undefined, // the orb passes through enemies; its zaps and shatter deal the damage
    tick: (i, pr, dt) => {
      // Magnetised (node): curve toward the nearest elite.
      if (seek > 0) {
        let e: Mob | null = null, ed = Infinity;
        for (const m of i.queryMobs(pr.x, pr.y, 320)) if (!m.dead && isElite(m)) { const d = Math.hypot(m.x - pr.x, m.y - pr.y); if (d < ed) { ed = d; e = m; } }
        if (e) {
          const cur = Math.atan2(pr.vy, pr.vx), want = Math.atan2(e.y - pr.y, e.x - pr.x);
          let d = want - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
          const a = cur + Math.max(-seek * dt / 1000, Math.min(seek * dt / 1000, d));
          pr.vx = Math.cos(a) * pr.speed; pr.vy = Math.sin(a) * pr.speed;
        }
      }
      zapMs -= dt;
      while (zapMs <= 0) {
        zapMs += every;
        const near = i.queryMobs(pr.x, pr.y, reach).filter((m) => !m.dead).sort((a, b) => Math.hypot(a.x - pr.x, a.y - pr.y) - Math.hypot(b.x - pr.x, b.y - pr.y));
        for (const m of near.slice(0, targets)) {
          zapOne(i, p, rt, pr, m, st, tally, budget, hail, gen);
          zapped.add(m);
          // Forking Zap (node): one zap in every N forks to an enemy up to 300 units away, beyond the orb's reach.
          if (forkEvery > 0 && ++count % Math.max(1, Math.round(forkEvery)) === 0) {
            const far = i.queryMobs(pr.x, pr.y, 300).filter((o) => !o.dead && Math.hypot(o.x - pr.x, o.y - pr.y) > reach);
            if (far.length) { const f = far[Math.floor(i.rng.next() * far.length)]; zapOne(i, p, rt, pr, f, st, tally, budget, hail, gen); zapped.add(f); }
          }
        }
        // Conductor (rune): arcs between your orbs and your Thrumming Ray (200 % weapon damage per second along each).
        if (rt.flags.has('orbConduct')) conduct(i, p, rt, pr, every);
      }
    },
    end: (i, pr) => {
      ms.orbs.delete(pr);
      if (inst.playerById(p.id) !== p) return;
      const grow = Math.min(modVar(rt.mods, 'orbGrow'), 10 * zapped.size); // Charge Release (node)
      const r = 120 * (1 + grow / 100);
      const dst: Strike = { ...strikeOf(p, rt, 3.0 * scale), noArea: true };
      for (const m of i.queryMobs(pr.x, pr.y, r)) {
        if (m.dead) continue;
        const res = mHit(i, p, m, dst, rt, tally);
        if (hail && !res.killed && !m.dead) mFreeze(i, p, m, 1000, budget); // Hailglass: the shatter freezes for 1 s
      }
      i.emit({ e: 'aoe', v: 'glass_burst', x: Math.round(pr.x), y: Math.round(pr.y), r: Math.round(r), d: 500, el: elIdx(st.el), s: p.id }, pr.x, pr.y, p.id);
      // Prism Burst (rune): six of your Magic Missiles (with their rune) at 60 % damage.
      if (rt.flags.has('orbMissiles')) {
        const mm = p.ctx.modsOf('magic_missile');
        for (let k = 0; k < 6; k++) {
          const a = k * TAU / 6, t = nearestMob(i, pr.x + Math.cos(a) * 120, pr.y + Math.sin(a) * 120, 260);
          if (t) magicMissile(i, p, mm, t, { from: { x: pr.x, y: pr.y + 6 }, scale: 0.6, angle: a });
        }
      }
      // Shattered Charge (node): glass shards that zap enemies stepping on them.
      const shards = Math.floor(modVar(rt.mods, 'orbShards'));
      for (let k = 0; k < shards; k++) {
        const a = k * TAU / shards + i.rng.next() * 0.6, d = 30 + i.rng.next() * 60;
        placeGround(i, p, 'glass_shard', pr.x + Math.cos(a) * d, pr.y + Math.sin(a) * d, 0);
      }
    },
  };
  const pr = spawnProj(inst, {
    kind: 'missile', v: 'stormglass', owner: p, src: p.id, x: p.x + Math.cos(ang) * 20, y: p.y - 10 + Math.sin(ang) * 20, angle: ang, speed, lifeMs: life, r: 18,
    el: st.el, strike: st, hook, keepLife: true, hits: null,
  });
  // Pinball (rune): bounces off walls up to twice (the engine's bounce rule).
  if (bounce) {
    pr.rule ??= { distPct: 0, distAt: 1, bounces: 0, bounceScale: 1, retarget: false, seekMarked: null, returns: false, rangeRicochet: false };
    pr.bounces = (pr.bounces ?? 0) + 2;
  }
  ms.orbs.add(pr);
}

function zapOne(inst: Instance, p: Player, rt: SkillRuntime, pr: Proj, m: Mob, st: Strike, tally: ReturnType<typeof newTally>, budget: CastBudget, hail: boolean, gen: number) {
  const r = mHit(inst, p, m, st, rt, tally);
  inst.emit({ e: 'beam', v: 'zap', x: Math.round(pr.x), y: Math.round(pr.y), tx: Math.round(m.x), ty: Math.round(m.y), el: elIdx(st.el), d: 140 }, m.x, m.y, p.id);
  if (r.killed || m.dead) return;
  if (hail) mChill(inst, p, m, 1000);
  if (gen > 0 && isElite(m)) gainResource(p, gen); // Static Charge (node)
  void budget;
}

/** Conductor: an arc from the orb to the nearest point of your Thrumming Ray and to your other orbs; enemies on it are struck. */
function conduct(inst: Instance, p: Player, rt: SkillRuntime, pr: Proj, everyMs: number) {
  const ms = mstate(p), ends: { x: number; y: number }[] = [];
  if (p.channel?.skill === 'thrumming_ray' && ms.ray && inst.t - ms.ray.t <= 400) {
    const ux = Math.cos(ms.ray.a), uy = Math.sin(ms.ray.a);
    const t = Math.max(0, Math.min(ms.ray.len, (pr.x - p.x) * ux + (pr.y - p.y) * uy));
    ends.push({ x: p.x + ux * t, y: p.y + uy * t });
  }
  // A chain, not every pair: each orb arcs to its nearest newer orb (the newest closes the chain). Every pair was
  // quadratic (13 orbs in flight under unlimited resource = 78 arcs every 0.25 s, measured in a rift), the chain is n − 1.
  let link: Proj | null = null, best = 600;
  for (const o of ms.orbs) {
    if (o === pr || o.dead || o.id <= pr.id) continue;
    const d = Math.hypot(o.x - pr.x, o.y - pr.y);
    if (d <= best) { best = d; link = o; }
  }
  if (link) ends.push({ x: link.x, y: link.y });
  if (!ends.length) return;
  const st: Strike = { ...strikeOf(p, rt, 2.0 * everyMs / 1000), noArea: true };
  for (const e of ends) {
    if (Math.hypot(e.x - pr.x, e.y - pr.y) > 600) continue;
    for (const m of inst.queryMobs((pr.x + e.x) / 2, (pr.y + e.y) / 2, Math.hypot(e.x - pr.x, e.y - pr.y) / 2 + 40)) {
      if (!m.dead && distToSegment(m.x, m.y, pr.x, pr.y, e.x, e.y) <= 30 + m.r) mHit(inst, p, m, st, rt);
    }
    // 'zap' (the orb's own light strike), not the chain 'arc': a stream of orbs on one line tethers every pair along the
    // same path each step, and the heavier arc (60-unit end flash, three wide layers re-struck every 50 ms) summed to a
    // white band in a real rift (shots/mage, MAGE-PILOT.md §5).
    inst.emit({ e: 'beam', v: 'zap', x: Math.round(pr.x), y: Math.round(pr.y), tx: Math.round(e.x), ty: Math.round(e.y), el: elIdx('lightning'), d: Math.round(everyMs + 40) }, e.x, e.y, p.id);
  }
}

// ─────────────────────────── M12 Orrery (cooldown) ───────────────────────────

function orrery(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  if (!anyEnemyWithin(inst, p.x, p.y, rt.def.range)) return false;
  const wide = rt.flags.has('orreryWide');
  const R = skillRadius(rt) * (wide ? MAGE_FX.orreryWideRadius : 1);
  const period = MAGE_FX.orreryPeriodMs / (wide ? MAGE_FX.orreryWideSlow : 1);
  const n = 5 + Math.max(0, Math.floor(modVar(rt.mods, 'spheres'))); // Armillary Staff
  const dur = skillDurationMs(rt), t0 = inst.t, end = t0 + dur, phase = inst.rng.next() * TAU;
  const el = skillElement(rt), frost = rt.flags.has('orreryFrost'), pull = rt.flags.has('orreryPull'), sun = rt.flags.has('orrerySun');
  const gen = modVar(rt.mods, 'orreryGen'), eclipse = modVar(rt.mods, 'orreryEclipse'), assist = modVar(rt.mods, 'orrerySynergy');
  const st = strikeOf(p, rt);
  const spheres = Array.from({ length: n }, (_, i) => ({ last: new Map<Mob, number>(), boostT: -1e9, shotT: t0 + 1500 * (i + 1) / n }));
  inst.emit({ e: 'aoe', v: wide ? 'orrery_wide' : 'orrery', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(R), d: Math.round(dur), el: elIdx(el), s: p.id, a: +phase.toFixed(3), n, f: 1 }, p.x, p.y, p.id);
  if (sun) inst.emit({ e: 'aoe', v: 'orrery_sun', x: Math.round(p.x), y: Math.round(p.y), r: 80, d: Math.round(dur), el: elIdx('fire'), s: p.id, f: 1 }, p.x, p.y, p.id);
  let eclipseT = t0 + 5000, sunMs = 0;
  const step = () => {
    if (inst.playerById(p.id) !== p) return;
    if (inst.t >= end || p.deadMs > 0) {
      // Comet Ring (rune): the spheres fall as 5 meteors (50 % of your Meteor's impact each) on nearby enemies.
      if (rt.flags.has('orreryMeteors') && p.deadMs <= 0) {
        const near = inst.queryMobs(p.x, p.y, 420).filter((m) => !m.dead);
        for (let i = 0; i < 5 && near.length; i++) { const m = near[i % near.length]; meteorAt(inst, p, m.x + (inst.rng.next() - 0.5) * 40, m.y + (inst.rng.next() - 0.5) * 40, 0.5); }
      }
      return;
    }
    const rot = TAU * (inst.t - t0) / period;
    for (let i = 0; i < n; i++) {
      const sp = spheres[i], a = phase + rot + i * TAU / n;
      const x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R;
      // Gravity Assist (node): passing through your Black Hole or molten ground empowers the sphere for 3 s.
      if (assist > 0 && inst.grounds.some((g) => g.owner === p && g.endT > inst.t && (g.kind === 'blackhole' || g.kind === 'molten') && (g.x - x) ** 2 + (g.y - y) ** 2 <= g.r * g.r)) sp.boostT = inst.t + 3000;
      const k = sp.boostT > inst.t ? 1 + assist / 100 : 1;
      for (const m of inst.queryMobs(x, y, 30)) {
        if (m.dead || (sp.last.get(m) ?? -1e9) > inst.t - 500) continue;
        sp.last.set(m, inst.t);
        const r = mHit(inst, p, m, k === 1 ? st : scaled(st, k), rt);
        if (r.killed || m.dead) continue;
        if (frost) mChill(inst, p, m, 1500);
        if (pull) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d > 30) dragMob(inst, m, p.x, p.y, 10, p); } // Gravity Orrery
      }
      if (inst.t >= sp.shotT) {
        sp.shotT += 1500;
        const t = nearestMob(inst, x, y, 380);
        if (t) {
          if (frost) rimeNeedles(inst, p, p.ctx.modsOf('rime_needles'), t, { from: { x, y: y + 6 }, scale: 0.5 * k });
          else magicMissile(inst, p, p.ctx.modsOf('magic_missile'), t, { from: { x, y: y + 6 }, scale: 0.5 * k });
          if (gen > 0) gainResource(p, gen); // Planetary Gift (node)
        }
      }
    }
    // Eclipse (node): every 5 s the spheres align and fire a beam outward.
    if (eclipse > 0 && inst.t >= eclipseT) {
      eclipseT += 5000;
      const a = bestConeAngle(inst, p.x, p.y, 380, 8 * DEG);
      if (a !== null) {
        const ux = Math.cos(a), uy = Math.sin(a), len = lineReach(inst, p.x, p.y, ux, uy, 380);
        const est: Strike = { ...strikeOf(p, rt, eclipse / 100), noArea: true };
        for (const m of inst.queryMobs(p.x + ux * len / 2, p.y + uy * len / 2, len / 2 + 60)) if (!m.dead && distToSegment(m.x, m.y, p.x, p.y, p.x + ux * len, p.y + uy * len) <= 30 + m.r) mHit(inst, p, m, est, rt);
        inst.emit({ e: 'aoe', v: 'eclipse', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(len), d: 500, el: elIdx(el), s: p.id, a: +a.toFixed(3) }, p.x, p.y, p.id);
      }
    }
    // Sun at Centre (rune): 150 % weapon damage per second to enemies within 80 units of you.
    if (sun && (sunMs -= 50) <= 0) {
      sunMs += 250;
      const sst: Strike = { ...strikeOf(p, rt, 1.5 / 4), el: 'fire', noArea: true };
      for (const m of inst.queryMobs(p.x, p.y, 80)) if (!m.dead) mHit(inst, p, m, sst, rt);
    }
    inst.sched.schedule(inst.t + 50, step);
  };
  inst.sched.schedule(inst.t + 50, step);
  emitCast(inst, p, rt, p.x, p.y, R);
  return true;
}

// ─────────────────────────── Registration ───────────────────────────

export const MAGE_M1_BEHAVIOURS: Record<string, SkillBehaviour> = {
  rime_needles: { primary: rimeNeedlesPrimary },
  thrumming_ray: { channelTick: rayTick },
  cinderkin: { cast: cinderkin },
  rimefield: { cast: rimefield },
  stormglass_orb: { cast: stormglassOrb },
  orrery: { cast: orrery },
};

export const MAGE_M1_SUMMONS: Record<string, SummonBehaviour> = {
  cinderkin: { radius: 14, update: kinAi },
  frostkin: { radius: 14, update: kinAi },
  ember_sprite: { radius: 10, flies: true, update: spriteAi },
};
