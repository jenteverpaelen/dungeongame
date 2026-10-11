// Warrior skill behaviour (server authority). Data: shared/src/data/skills/warrior.ts.
// Cleave, Whirlwind (channel + Dust Devils / wind wisps), Rend, Ground Stomp, Quakeline (id seismic_slam), Battle Rage,
// with their bible v2 runes and specialization nodes. The M1 skills (Tolling Blow, Sawtooth Hatchet, Muster Standard,
// Ironplough, Cairnfall) live in warriorM1.ts; shared warrior plumbing in warriorKit.ts.

import { modVar, skillBuffBonuses } from '../../shared';
import { bestConeAngle, bestPoint, pickTarget } from '../brain';
import { expectedDamage, gainResource, isEliteTier, makeDot, strikeMob } from '../damage';
import { addBuff, addDot, chillMob, elIdx, getBuff, hasDot, inCone } from '../effects';
import { addGround, newGround } from '../grounds';
import type { Instance } from '../instance';
import { skillCost, skillDurationMs, skillElement, skillMult, skillPct, skillRadius } from '../playerctx';
import { moveSummon, spawnSummon } from '../summons';
import type { ChannelState, Mob, Player, SkillRuntime, Strike, Summon } from '../types';
import { DEG, emitCast, face, strikeOf, type DeathHook, type SkillBehaviour, type SummonBehaviour } from './common';
import {
  addCarriedDot, chExtra, inOwnStandard, nearestMob, noteSpend, rageActive, reduceCooldowns, refundCooldownLater, refundDuringCast,
  startRageLoop, warriorDeathHook, wHit, wPull, wPush, wStun, wstate, type ChannelExtra,
} from './warriorKit';

// ─────────────────────────── Primary helpers (shared with Tolling Blow) ───────────────────────────

/** Battle Rage Drumbeat: the next primary attack every 5 s while raging deals more damage. */
export function drumbeat(inst: Instance, p: Player): number {
  const br = rageActive(p) ? p.ctx.slotted('battle_rage') : null;
  const v = br ? modVar(br.mods, 'drumbeat') : 0;
  const ws = wstate(p);
  if (v <= 0 || inst.t < ws.drumT) return 1;
  ws.drumT = inst.t + 5000;
  return 1 + v / 100;
}

/** Muster Standard Drill Cadence: extra Fury for primary attacks inside your standard. */
export function drillFury(inst: Instance, p: Player): number {
  const mu = p.ctx.slotted('muster_standard');
  const v = mu ? modVar(mu.mods, 'drillGen') : 0;
  return v > 0 && inOwnStandard(inst, p) ? v : 0;
}

/** Thresher's Knot: each enemy a primary hits beyond the first shortens Stun skills' cooldowns. */
export function thresher(inst: Instance, p: Player, rt: SkillRuntime, hits: number) {
  const v = modVar(rt.mods, 'thresher');
  if (v > 0 && hits > 1) reduceCooldowns(inst, p, (hits - 1) * v * 1000, 'stun');
}

// ─────────────────────────── Cleave (primary) ───────────────────────────

interface SwingOpts { coefMul?: number; gen?: boolean; momentum?: boolean; drum?: boolean }

function cleaveSwing(inst: Instance, p: Player, rt: SkillRuntime, ang: number, o: SwingOpts = {}) {
  const full = rt.flags.has('cleaveFull'); // Millwheel Edge: 360°
  const half = (rt.flags.has('wideArc') ? 90 : 60) * DEG;
  const radius = skillRadius(rt);
  const st: Strike = { ...strikeOf(p, rt, rt.def.coef * (o.coefMul ?? 1)), primary: true };
  if (o.drum) st.mult = (st.mult ?? 1) * drumbeat(inst, p);
  const bleed = rt.flags.has('cleaveBleed');
  let hit = 0;
  for (const m of inst.queryMobs(p.x, p.y, radius)) {
    if (m.dead || (!full && !inCone(m.x, m.y, m.r, p.x, p.y, ang, half, radius))) continue;
    const r = wHit(inst, p, m, st, rt);
    // Hemorrhage Arc: 40 % weapon damage over 2 s, its own dot (keyed by skill, so separate from Rend's).
    if (bleed && !r.killed && !m.dead) addDot(m, makeDot(inst, p, { ...st, coef: 0.4, primary: false }, 'bleed', 2000, 500));
    hit++;
  }
  if (hit && o.gen !== false) gainResource(p, rt.def.gen + (rt.mods.gen ?? 0) + (hit >= 3 ? modVar(rt.mods, 'crowdFury') : 0) + drillFury(inst, p));
  if (hit) thresher(inst, p, rt, hit);
  if (o.momentum !== false && rt.flags.has('momentum')) {
    const b = getBuff(p, 'momentum');
    addBuff(p, { id: 'momentum', ms: 3000, ias: 3, st: Math.min(5, (b?.st ?? 0) + 1) });
  }
  const tx = p.x + Math.cos(ang) * radius, ty = p.y + Math.sin(ang) * radius;
  emitCast(inst, p, rt, tx, ty, radius);
  inst.emit({ e: 'aoe', v: 'cleave', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), d: 220, el: elIdx(st.el), s: p.id, a: +(full ? ang + Math.PI : ang).toFixed(3) }, p.x, p.y, p.id);
  if (full) inst.emit({ e: 'aoe', v: 'cleave', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), d: 220, el: elIdx(st.el), s: p.id, a: +ang.toFixed(3) }, p.x, p.y, p.id);
}

function cleave(inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob) {
  const ang = Math.atan2(tgt.y - p.y, tgt.x - p.x);
  cleaveSwing(inst, p, rt, ang, { drum: true });
  // Backswing: 0.2 s later through the same arc for 50 %, no Fury.
  if (rt.flags.has('cleaveBackswing')) inst.sched.schedule(inst.t + 200, () => {
    if (p.deadMs > 0 || p.ctx.primary.def.id !== 'cleave') return;
    cleaveSwing(inst, p, p.ctx.primary, ang, { coefMul: 0.5, gen: false, momentum: false });
  });
}

/** Reaper's Rhythm: a free swing at the nearest enemy (called from the warrior death hook). */
function freeSwing(inst: Instance, p: Player, from: { x: number; y: number }) {
  if (p.deadMs > 0 || p.ctx.primary.def.id !== 'cleave') return;
  const t = nearestMob(inst, p.x, p.y, skillRadius(p.ctx.primary) + 40) ?? nearestMob(inst, from.x, from.y, 120);
  if (!t) return;
  face(p, t.x);
  cleaveSwing(inst, p, p.ctx.primary, Math.atan2(t.y - p.y, t.x - p.x));
}

// ─────────────────────────── Whirlwind (channel) ───────────────────────────

/** Upkeep every warrior channel shares: Fury spent (Bloodsong), Gale-Stitched stacks, Endless Storm wind wisps. */
export function channelCommon(inst: Instance, p: Player, rt: SkillRuntime, ch: ChannelState, dtMs: number, ex: ChannelExtra, spent: number) {
  noteSpend(inst, p, spent);
  if (rt.flags.has('galeStitch')) {
    const n = Math.min(5, Math.floor(ch.spunMs / 1000));
    const b = getBuff(p, 'gale_stitched');
    if (n > 0 && (!b || (b.st ?? 0) <= n)) addBuff(p, { id: 'gale_stitched', ms: 1500, st: Math.max(n, b?.st ?? 0) });
  }
  if (rt.flags.has('stormWisps')) {
    ex.wispMs -= dtMs;
    if (ex.wispMs <= 0) { ex.wispMs += 1000; spawnWisp(inst, p, rt); }
  }
}

function whirlwindTick(inst: Instance, p: Player, rt: SkillRuntime, ch: ChannelState, dtMs: number) {
  const ex = chExtra(ch);
  // Second Breath: the first seconds of each channel cost nothing (the generic upkeep already drained this tick).
  const drain = skillCost(p, rt) * dtMs / 1000;
  const free = modVar(rt.mods, 'freeStart');
  if (free > 0 && ch.spunMs <= free * 1000) p.res = Math.min(p.mres, p.res + drain);
  channelCommon(inst, p, rt, ch, dtMs, ex, free > 0 && ch.spunMs <= free * 1000 ? 0 : drain);
  ch.tickMs -= dtMs;
  if (ch.tickMs <= 0) {
    const eye = modVar(rt.mods, 'eyeWall');
    ch.tickMs += eye > 0 ? eye * 1000 : 250;
    const radius = skillRadius(rt);
    if (rt.flags.has('whirlPull')) {
      for (const m of inst.queryMobs(p.x, p.y, 160)) {
        if (m.dead) continue;
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d > m.r + 24) wPull(inst, p, m, p.x, p.y, Math.min(30, d - m.r - 20), rt, ex);
      }
    }
    const st = strikeOf(p, rt, rt.def.coef / 4);
    const bleedFury = modVar(rt.mods, 'bleedFury');
    let bleeding = 0;
    for (const m of inst.queryMobs(p.x, p.y, radius)) {
      if (m.dead) continue;
      if (bleedFury > 0 && hasDot(m, 'bleed')) bleeding++;
      wHit(inst, p, m, st, rt);
    }
    // Bloodied Gyre: Fury per bleeding enemy hit, at most 3 per second.
    if (bleeding) {
      const ws = wstate(p);
      if (inst.t - ws.bleedFuryWinT >= 1000) { ws.bleedFuryWinT = inst.t; ws.bleedFuryGot = 0; }
      const g = Math.min(3 - ws.bleedFuryGot, bleeding * bleedFury);
      if (g > 0) { ws.bleedFuryGot += g; gainResource(p, g); }
    }
    inst.emit({ e: 'aoe', v: 'whirl', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), d: 260, el: elIdx(st.el), s: p.id }, p.x, p.y, p.id);
  }
  if (rt.flags.has('whirlTrail')) emberTrail(inst, p, rt, ex, dtMs);
  if (rt.flags.has('dustDevils')) {
    ch.devilMs -= dtMs;
    if (ch.devilMs <= 0) {
      ch.devilMs += 1000;
      const a2 = inst.rng.next() * Math.PI * 2;
      spawnSummon(inst, p, 'dust_devil', 'whirlwind', p.x + Math.cos(a2) * 30, p.y + Math.sin(a2) * 30, 3000);
    }
  }
}

/** Gyre of Ash: ember patches (radius 45, 2 s, 40 % weapon damage per second as Fire), at most one under you. */
const embers = new WeakMap<ChannelExtra, { x: number; y: number; endT: number }[]>();
function emberTrail(inst: Instance, p: Player, rt: SkillRuntime, ex: ChannelExtra, dtMs: number) {
  ex.trailMs -= dtMs;
  if (ex.trailMs > 0) return;
  ex.trailMs += 250;
  const list = (embers.get(ex) ?? []).filter((e) => e.endT > inst.t);
  embers.set(ex, list);
  if (list.some((e) => (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < 40 * 40)) return;
  const st: Strike = { ...strikeOf(p, rt, 0.4), el: 'fire' };
  const g = newGround('molten', p.x, p.y, 45, inst.t, 2000, 500);
  g.owner = p; g.strike = st; g.el = 'fire';
  g.dmg = expectedDamage(inst, p, st) / 2; // 40 % per second, ticking every 0.5 s
  addGround(inst, g);
  list.push({ x: p.x, y: p.y, endT: inst.t + 2000 });
  inst.emit({ e: 'aoe', v: 'ember_trail', x: Math.round(p.x), y: Math.round(p.y), r: 45, d: 2000, el: elIdx('fire'), s: p.id }, p.x, p.y, p.id);
}

function applyRend(inst: Instance, p: Player, rt: SkillRuntime, m: Mob) {
  const dot = makeDot(inst, p, strikeOf(p, rt), 'bleed', skillDurationMs(rt), 500, { heal: rt.flags.has('bleedHeal'), spread: rt.flags.has('bleedSpread') });
  const carry = modVar(rt.mods, 'rollover'); // Rollover: carry part of the remaining bleed into the new one
  if (carry > 0) addCarriedDot(m, dot, carry); else addDot(m, dot);
}

// ─────────────────────────── Dust Devils and wind wisps ───────────────────────────

/** Endless Storm 6 wisps: Dust Devil bodies that circle the owner (the strike id stays 'dust_devil'). */
const wisps = new WeakMap<Summon, { coef: number; ang: number; skill: string }>();

function spawnWisp(inst: Instance, p: Player, rt: SkillRuntime) {
  const ang = inst.rng.next() * Math.PI * 2;
  const s = spawnSummon(inst, p, 'dust_devil', rt.def.id, p.x + Math.cos(ang) * 110, p.y + Math.sin(ang) * 110, 3000);
  // "Wisps deal 25 % of your channel's damage": a quarter of the channel's per-second coefficient, per second.
  wisps.set(s, { coef: rt.def.coef * 0.25, ang, skill: rt.def.id });
}

/** Dust Devil: wanders through nearby enemies for its life, ticking every 0.25 s (wisps circle their owner instead). */
function dustDevil(inst: Instance, s: Summon, p: Player, dtMs: number, dtS: number) {
  const w = wisps.get(s);
  if (w) { wisp(inst, s, p, w, dtMs, dtS); return; }
  const ww = p.ctx.modsOf('whirlwind');
  const herd = modVar(ww.mods, 'devilPull');
  s.wanderMs -= dtMs;
  if (s.wanderMs <= 0) {
    s.wanderMs = 600;
    const bp = herd > 0 ? bestPoint(inst, s.x, s.y, 280, 80) : null; // Devil Herding: steer to the densest pack
    const alive = bp ? [] : inst.queryMobs(s.x, s.y, 280).filter((m) => !m.dead);
    if (bp) { s.tx = bp.x; s.ty = bp.y; }
    else if (alive.length) {
      const m = alive[Math.floor(inst.rng.next() * alive.length)];
      s.tx = m.x + (inst.rng.next() - 0.5) * 60;
      s.ty = m.y + (inst.rng.next() - 0.5) * 60;
    } else {
      const a = inst.rng.next() * Math.PI * 2;
      s.tx = s.x + Math.cos(a) * 140;
      s.ty = s.y + Math.sin(a) * 140;
    }
  }
  moveSummon(inst, s, s.tx, s.ty, 250, dtS, 4);
  // Devil's Tithe: Fury when a Dust Devil ends (this is its last update).
  if (s.lifeMs <= dtMs && s.skill === 'whirlwind') gainResource(p, modVar(ww.mods, 'devilFury'));
  s.tickMs -= dtMs;
  if (s.tickMs > 0) return;
  s.tickMs += 250;
  const pct = skillPct(p, ww) + modVar(ww.mods, 'dustDevilPct');
  const st: Strike = { skill: 'dust_devil', coef: 1.2 * 0.25, el: skillElement(ww), pct, mult: skillMult(p, 'dust_devil'), src: s.id };
  for (const m of inst.queryMobs(s.x, s.y, 45)) if (!m.dead) strikeMob(inst, p, m, st);
  if (herd > 0) for (const m of inst.queryMobs(s.x, s.y, 70)) if (!m.dead && m.tier === 0) wPull(inst, p, m, s.x, s.y, herd, null);
}

function wisp(inst: Instance, s: Summon, p: Player, w: { coef: number; ang: number; skill: string }, dtMs: number, dtS: number) {
  w.ang += 2.4 * dtS;
  moveSummon(inst, s, p.x + Math.cos(w.ang) * 110, p.y + Math.sin(w.ang) * 110, 420, dtS, 2);
  s.tickMs -= dtMs;
  if (s.tickMs > 0) return;
  s.tickMs += 250;
  const src = p.ctx.modsOf(w.skill);
  const st: Strike = { skill: 'dust_devil', coef: w.coef * 0.25, el: skillElement(src), pct: skillPct(p, src), mult: skillMult(p, 'dust_devil'), src: s.id };
  for (const m of inst.queryMobs(s.x, s.y, 50)) {
    if (m.dead) continue;
    strikeMob(inst, p, m, st);
    if (!m.dead && m.tier === 0) wPull(inst, p, m, p.x, p.y, 8, null); // pulls enemies inward
  }
}

// ─────────────────────────── Slot skills ───────────────────────────

function rend(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  let cx = p.x, cy = p.y;
  if (rt.flags.has('rendRanged')) { const bp = bestPoint(inst, p.x, p.y, 260, radius); if (bp) { cx = bp.x; cy = bp.y; } } // Gash Sense
  const targets = inst.queryMobs(cx, cy, radius).filter((m) => !m.dead);
  if (!targets.length) return false;
  const cost = skillCost(p, rt);
  const pull = modVar(rt.mods, 'rendPull'); // Gathering Tear
  if (pull > 0) for (const m of targets) {
    const d = Math.hypot(m.x - cx, m.y - cy);
    if (d > m.r + 10) wPull(inst, p, m, cx, cy, Math.min(pull, d - m.r - 6), rt);
  }
  for (const m of targets) applyRend(inst, p, rt, m);
  const n = targets.length;
  if (n > 3) refundDuringCast(p, (n - 3) * modVar(rt.mods, 'crowdFury'), cost); // Thirsting Wounds
  const haste = modVar(rt.mods, 'rendHaste'); // Bloodletter's Pace
  if (haste > 0) addBuff(p, { id: 'rend_haste', ms: 4000, ias: haste });
  const free = rt.flags.has('woodcutter') && n >= 4; // Woodcutter's Grips
  if (free) refundDuringCast(p, cost, cost);
  noteSpend(inst, p, free ? 0 : cost);
  emitCast(inst, p, rt, cx, cy, radius);
  inst.emit({ e: 'aoe', v: 'rend', x: Math.round(cx), y: Math.round(cy), r: Math.round(radius), d: 420, el: elIdx('physical'), s: p.id }, cx, cy, p.id);
  return true;
}

function groundStomp(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  if (rt.flags.has('pull')) {
    for (const m of inst.queryMobs(p.x, p.y, 320)) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d > 60 + m.r) wPull(inst, p, m, p.x, p.y, d - 50 - m.r, rt);
    }
  }
  const gather = modVar(rt.mods, 'gather'); // Gather: the outer half is dragged inward before the stun
  if (gather > 0) for (const m of inst.queryMobs(p.x, p.y, radius + gather)) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d > radius * 0.5) wPull(inst, p, m, p.x, p.y, Math.min(gather, d - m.r - 20), rt);
  }
  const st = strikeOf(p, rt);
  const stunMs = skillDurationMs(rt);
  let hits = 0, elites = 0;
  const hit = new Set<Mob>();
  for (const m of inst.queryMobs(p.x, p.y, radius)) {
    if (m.dead) continue;
    wStun(inst, p, m, stunMs, rt); // stun first so Ringing Stomp / Anvil vulnerability applies to the stomp itself
    wHit(inst, p, m, st, rt);
    hits++; hit.add(m);
    if (isEliteTier(m.tier)) elites++;
  }
  gainResource(p, rt.def.gen + (rt.mods.gen ?? 0) + elites * modVar(rt.mods, 'eliteFury')); // Fury Spring
  if (hits >= 5) refundCooldownLater(inst, p, 'ground_stomp', modVar(rt.mods, 'stompRefund') * 1000); // Sure Footing
  const echo = modVar(rt.mods, 'echoDelay'); // Echo Stomp
  if (echo > 0) inst.sched.schedule(inst.t + echo * 1000, () => {
    if (p.deadMs > 0) return;
    const half = radius / 2;
    for (const m of inst.queryMobs(p.x, p.y, half)) if (!m.dead) wHit(inst, p, m, { ...st, coef: st.coef * 0.5, noArea: true }, rt);
    inst.emit({ e: 'aoe', v: 'stomp', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(half), d: 400, el: elIdx(st.el), s: p.id }, p.x, p.y, p.id);
  });
  if (rt.flags.has('stompWave')) outwardTremor(inst, p, rt, p.x, p.y, radius, hit); // Outward Tremor
  emitCast(inst, p, rt, p.x, p.y, radius);
  inst.emit({ e: 'aoe', v: 'stomp', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), d: 500, el: elIdx(st.el), s: p.id }, p.x, p.y, p.id);
  inst.emitTo(p.id, { e: 'shake', m: 3, d: 140 });
  return true;
}

/** A ring wave from the stomp's edge to 320 units in three steps (100 % weapon damage, 0.5 s stun, once per enemy). */
function outwardTremor(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, from: number, already: Set<Mob>) {
  const to = Math.max(from + 30, 320), seen = new Set(already);
  const st: Strike = { ...strikeOf(p, rt, 1.0), noArea: true };
  inst.emit({ e: 'aoe', v: 'tremor_ring', x: Math.round(x), y: Math.round(y), r: Math.round(to), d: 420, el: elIdx(st.el), s: p.id }, x, y, p.id);
  for (let i = 1; i <= 3; i++) {
    const outer = from + (to - from) * i / 3;
    inst.sched.schedule(inst.t + i * 120, () => {
      for (const m of inst.queryMobs(x, y, outer)) {
        if (m.dead || seen.has(m)) continue;
        seen.add(m);
        wStun(inst, p, m, 500, rt);
        wHit(inst, p, m, st, rt);
      }
    });
  }
}

function seismicSlam(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const mul = Math.max(1, skillRadius(rt) / rt.def.radius);
  const len = rt.def.range * Math.min(1.6, mul) * Math.max(0.5, 1 + modVar(rt.mods, 'fissureLen') / 100); // Long Fissure / Splayed Fault
  const half = 30 * DEG * mul + modVar(rt.mods, 'splay') * DEG / 2;
  let ang = bestConeAngle(inst, p.x, p.y, len, half);
  if (ang === null) {
    const t = pickTarget(inst, p.x, p.y, len, false, p.save.skills.targetPriority);
    if (!t) return false;
    ang = Math.atan2(t.y - p.y, t.x - p.x);
  }
  face(p, p.x + Math.cos(ang) * 10);
  const cost = skillCost(p, rt);
  const triple = rt.flags.has('slamTriple'); // Split Earth: three narrower fissures, 70 % each
  const fissures = triple ? [-30, 0, 30].map((o) => ang! + o * DEG) : [ang];
  const fh = triple ? half / 2 : half;
  const ox = p.x, oy = p.y;
  const inAny = (m: Mob) => fissures.findIndex((a) => inCone(m.x, m.y, m.r, ox, oy, a, fh, len));
  const targets = inst.queryMobs(ox, oy, len).filter((m) => !m.dead && inAny(m) >= 0);
  const st = strikeOf(p, rt, rt.def.coef * (triple ? 0.7 : 1));
  if (rt.flags.has('slamDensity')) st.mult = (st.mult ?? 1) * (1 + Math.min(50, 5 * Math.max(0, targets.length - 1)) / 100); // Bedrock
  const kb = rt.flags.has('knockback') ? 90 : 22;
  const chill = rt.flags.has('chill');
  const heave = modVar(rt.mods, 'heave');
  for (const m of targets) {
    const r = wHit(inst, p, m, st, rt);
    if (r.killed || m.dead) continue;
    wPush(inst, p, m, m.x - ox, m.y - oy, kb, rt);
    if (chill) chillMob(m, 2000);
    if (heave > 0 && Math.hypot(m.x - ox, m.y - oy) > len * 0.7) wStun(inst, p, m, heave * 1000, rt); // Heave: the far 30 %
  }
  if (rt.flags.has('aftershock')) {
    const after = { ...st, coef: st.coef * 0.25, noArea: true };
    for (let i = 1; i <= 4; i++) inst.sched.schedule(inst.t + i * 250, () => {
      for (const m of inst.queryMobs(ox, oy, len)) if (!m.dead && inAny(m) >= 0) wHit(inst, p, m, after, rt);
    });
  }
  // Tremor Feed (4+ hits) and Bedrock Pace (chained slams) pay back Fury as the cast resolves.
  const ws = wstate(p);
  ws.slamStacks = inst.t - ws.slamT <= 2000 ? Math.min(3, ws.slamStacks + 1) : 0;
  ws.slamT = inst.t;
  refundDuringCast(p, (targets.length >= 4 ? modVar(rt.mods, 'slamRefund') : 0) + ws.slamStacks * modVar(rt.mods, 'slamChain'), cost);
  noteSpend(inst, p, cost);
  emitCast(inst, p, rt, ox + Math.cos(ang) * len, oy + Math.sin(ang) * len, len);
  for (const a of fissures) {
    inst.emit({ e: 'aoe', v: 'fissure', x: Math.round(ox), y: Math.round(oy), r: Math.round(len), d: rt.flags.has('aftershock') ? 1100 : 650, el: elIdx(st.el), s: p.id, a: +a.toFixed(3) }, ox + Math.cos(a) * len / 2, oy + Math.sin(a) * len / 2, p.id);
  }
  return true;
}

function battleRage(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  addBuff(p, { id: 'battle_rage', ms: skillDurationMs(rt), ...skillBuffBonuses('battle_rage', rt.flags) });
  const cost = skillCost(p, rt);
  refundDuringCast(p, modVar(rt.mods, 'castFury'), cost); // Red Tide
  startRageLoop(inst, p, rt);
  noteSpend(inst, p, cost);
  emitCast(inst, p, rt, p.x, p.y);
  return true;
}

// ─────────────────────────── Death hooks ───────────────────────────

/** Contagion: bleeds spread to up to 3 nearby enemies. */
export const contagionHook: DeathHook = (inst, m) => {
  for (const d of m.dots) {
    if (d.kind !== 'bleed' || !d.spread) continue;
    const owner = inst.playerById(d.owner);
    if (!owner) continue;
    let n = 0;
    for (const o of inst.queryMobs(m.x, m.y, 150)) {
      if (o.dead || o === m || hasDot(o, 'bleed', d.owner)) continue;
      addDot(o, { ...d, leftMs: d.durMs, nextMs: d.tickMs });
      if (++n >= 3) break;
    }
  }
};

/** Rupture: enemies slain by Cleave explode for 120% weapon damage. */
export const ruptureHook: DeathHook = (inst, m, killer, skill) => {
  if (killer && skill === 'cleave' && killer.ctx.primary.flags.has('explodeOnKill')) {
    const rt = killer.ctx.primary;
    const st: Strike = { ...strikeOf(killer, rt, 1.2), skill: 'cleave_rupture', noArea: true };
    for (const o of inst.queryMobs(m.x, m.y, 80)) if (!o.dead && o !== m) strikeMob(inst, killer, o, st);
    inst.emit({ e: 'aoe', v: 'explode', x: Math.round(m.x), y: Math.round(m.y), r: 80, d: 350, el: elIdx(st.el), s: killer.id }, m.x, m.y, killer.id);
  }
};

/** Node / rune / legendary effects on monster death (warriorKit.ts); appended after the original hooks. */
export const warriorDepthHook: DeathHook = warriorDeathHook(freeSwing);

// ─────────────────────────── Registration ───────────────────────────

export const WARRIOR_BEHAVIOURS: Record<string, SkillBehaviour> = {
  cleave: { primary: cleave },
  whirlwind: { channelTick: whirlwindTick },
  rend: { cast: rend },
  ground_stomp: { cast: groundStomp },
  seismic_slam: { cast: seismicSlam },
  battle_rage: { cast: battleRage },
};

export const WARRIOR_SUMMONS: Record<string, SummonBehaviour> = {
  dust_devil: { radius: 20, flies: true, update: dustDevil },
};
