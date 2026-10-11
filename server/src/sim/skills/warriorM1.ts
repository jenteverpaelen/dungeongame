// Warrior M1 skills (bible v2, docs/rework/depth/WARRIOR.md §3): Tolling Blow (second primary), Sawtooth Hatchet
// (returning hatchet, simulated here with the scheduler — no generic projectile kind), Muster Standard (a planted
// banner managed here: party buff ticks, pulses, carried variant), Ironplough (ramping front-cone channel) and
// Cairnfall (scheduled impacts). Kilnheart (W12) waits for engine wave 2 (buff-scoped cost and on-hit ignite).
// Client contract (events) — client/src/render/vfx: see docs/rework/depth/WARRIOR-PILOT.md §Events.

import { WARRIOR_FX, modVar } from '../../shared';
import { anyEnemyWithin, bestConeAngle, bestPoint, pickTarget } from '../brain';
import { expectedDamage, gainResource, healPlayer, hurtMob, isEliteTier, makeDot, skillGain } from '../damage';
import { addBuff, addOwnedDot, elIdx, getBuff, shotBlockedAt } from '../effects';
import { placeGround } from '../groundFx';
import { resolveStatus } from '../powerRuntime';
import { applyStatus } from '../status';
import { addGround, newGround } from '../grounds';
import type { Instance } from '../instance';
import { spawnProj } from '../projectiles';
import { skillCost, skillDurationMs, skillElement, skillRadius } from '../playerctx';
import type { ChannelState, Mob, Player, SkillRuntime, Strike } from '../types';
import { DEG, emitCast, face, strikeOf, type SkillBehaviour } from './common';
import { channelCommon, drillFury, drumbeat, thresher } from './warrior';
import {
  addCarriedDot, chExtra, deepEarth, hitBase, hearthIas, hearthPrimary, mstate, nearestMob, noteSpend, reduceCooldowns, shareDot, syncWarhorn, wHit, wPull,
  wPush, wStun, wstate, type Standard,
} from './warriorKit';

const TAU = Math.PI * 2;
const norm = (a: number) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

// ─────────────────────────── W7 Tolling Blow (primary) ───────────────────────────

function tollingBlow(inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob) {
  const ang = Math.atan2(tgt.y - p.y, tgt.x - p.x);
  const st: Strike = { ...strikeOf(p, rt), primary: true };
  st.mult = (st.mult ?? 1) * drumbeat(inst, p);
  const r = wHit(inst, p, tgt, st, rt);
  let hits = 1;
  // Iron Tongue: the blow passes through to the enemy behind the target.
  if (rt.flags.has('tollPierce')) {
    const depth = Math.hypot(tgt.x - p.x, tgt.y - p.y);
    let behind: Mob | null = null, bd = Infinity;
    for (const m of inst.queryMobs(tgt.x, tgt.y, 110)) {
      if (m.dead || m === tgt) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d <= depth || Math.abs(norm(Math.atan2(m.y - p.y, m.x - p.x) - ang)) > 30 * DEG) continue;
      const g = Math.hypot(m.x - tgt.x, m.y - tgt.y);
      if (g < bd) { bd = g; behind = m; }
    }
    if (behind) { wHit(inst, p, behind, st, rt); hits++; }
  }
  skillGain(p, rt, rt.def.gen + (rt.mods.gen ?? 0) + drillFury(inst, p) + hearthPrimary(inst, p, rt, tgt.x, tgt.y));
  thresher(inst, p, rt, hits);
  emitCast(inst, p, rt, tgt.x, tgt.y, 40);
  inst.emit({ e: 'aoe', v: 'tollblow', x: Math.round(tgt.x), y: Math.round(tgt.y), r: 40, d: 260, el: elIdx(st.el), s: p.id, a: +ang.toFixed(3) }, tgt.x, tgt.y, p.id);
  if (rt.flags.has('noToll')) return;
  const ws = wstate(p);
  if (inst.t - ws.lastBlowT > 2000) ws.carillon = 0; // Carillon resets after 2 s without a blow
  ws.lastBlowT = inst.t;
  ws.toll++;
  const peal = modVar(rt.mods, 'quickPeal'); // Quick Peal: a crit may count twice
  if (r.crit && peal > 0 && inst.rng.next() * 100 < peal) ws.toll++;
  if (ws.toll < (rt.flags.has('tollEvery2') ? 2 : 3)) return;
  ws.toll = 0;
  const caril = modVar(rt.mods, 'carillon');
  toll(inst, p, rt, tgt.x, tgt.y, 1 + ws.carillon * caril / 100, true);
  if (caril > 0) ws.carillon = Math.min(3, ws.carillon + 1);
}

/** The toll: 100 % weapon damage and a stun around a point (Bronze Echo repeats it, Twin Ring rings at your feet). */
function toll(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, scale: number, main: boolean, stun = true) {
  const radius = skillRadius(rt), stunMs = skillDurationMs(rt);
  const st: Strike = { ...strikeOf(p, rt, 1.0 * scale), primary: true, noArea: true };
  const prime = modVar(rt.mods, 'tollPrime'), ignite = rt.flags.has('tollIgnite');
  for (const m of inst.queryMobs(x, y, radius)) {
    if (m.dead) continue;
    if (stun) wStun(inst, p, m, stunMs, rt);
    const r = wHit(inst, p, m, st, rt);
    if (r.killed || m.dead) continue;
    if (prime > 0) mstate(m).prime = { owner: p.id, pct: prime, until: inst.t + 8000 }; // Ringing Ears
    if (ignite) addOwnedDot(p, m, makeDot(inst, p, { ...st, coef: 1.5, primary: false }, 'burn', 3000, 500)); // Furnace Clapper
  }
  inst.emit({ e: 'aoe', v: 'toll', x: Math.round(x), y: Math.round(y), r: Math.round(radius), d: 520, el: elIdx(st.el), s: p.id }, x, y, p.id);
  if (stun) deepEarth(inst, p, rt, x, y, radius);
  if (!main) return;
  // Watch Bell: 10 Fury and 4 % damage reduction for 3 s per toll (up to 3 stacks).
  if (rt.flags.has('tollWatch')) {
    gainResource(p, 10);
    const n = Math.min(3, (getBuff(p, 'watch_bell')?.st ?? 0) + 1);
    addBuff(p, { id: 'watch_bell', ms: 3000, dr: 4 * n, st: n });
  }
  if (rt.flags.has('tollEcho')) inst.sched.schedule(inst.t + 500, () => { if (p.deadMs <= 0) toll(inst, p, rt, x, y, scale, false, false); });
  const twin = modVar(rt.mods, 'twinRing');
  if (twin > 0) toll(inst, p, rt, p.x, p.y, scale * twin / 100, false);
}

// ─────────────────────────── W8 Sawtooth Hatchet (spender) ───────────────────────────

interface HatchetCast { bled: Set<Mob>; hit: Set<Mob>; refunded: boolean; healed: boolean; cost: number }
/** Flight legs: out along the throw (from the hand when `again`), a hold at the apex, home to the thrower. */
type Leg = { kind: 'out'; again: boolean } | { kind: 'hold'; ms: number; grindMs: number; coef: number } | { kind: 'home' };

function sawtoothHatchet(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const range = rt.def.range;
  let ang = bestConeAngle(inst, p.x, p.y, range, 12 * DEG);
  if (ang === null) {
    const t = pickTarget(inst, p.x, p.y, range, true, p.save.skills.targetPriority);
    if (!t) return false;
    ang = Math.atan2(t.y - p.y, t.x - p.x);
  }
  face(p, p.x + Math.cos(ang) * 10);
  const n = Math.max(1, 1 + (rt.mods.projectiles ?? 0));
  const cost = skillCost(p, rt);
  const cast: HatchetCast = { bled: new Set(), hit: new Set(), refunded: false, healed: false, cost };
  for (let i = 0; i < n; i++) launchHatchet(inst, p, rt, ang + (i - (n - 1) / 2) * 20 * DEG, cast);
  noteSpend(inst, p, cost);
  emitCast(inst, p, rt, p.x + Math.cos(ang) * range, p.y + Math.sin(ang) * range);
  return true;
}

/** Outward reach along a line: the skill range, or the last free point before a wall. */
function reach(inst: Instance, x: number, y: number, ux: number, uy: number, range: number): number {
  for (let d = 20; d <= range; d += 20) if (shotBlockedAt(inst, x + ux * d, y + uy * d)) return Math.max(20, d - 20);
  return range;
}

function launchHatchet(inst: Instance, p: Player, rt: SkillRuntime, ang: number, cast: HatchetCast) {
  const range = rt.def.range, speed = WARRIOR_FX.hatchetSpeed, hr = skillRadius(rt);
  const ux = Math.cos(ang), uy = Math.sin(ang);
  // Plan the outward flight: to range, a wall, or (Lodged Teeth) the first elite / boss on the line.
  let out = reach(inst, p.x, p.y, ux, uy, range), lodge = false;
  if (rt.flags.has('hatchetLodge')) {
    let best = Infinity;
    for (const m of inst.queryMobs(p.x + ux * out / 2, p.y + uy * out / 2, out / 2 + 40)) {
      if (m.dead || !isEliteTier(m.tier)) continue;
      const along = (m.x - p.x) * ux + (m.y - p.y) * uy, off = Math.abs((m.x - p.x) * uy - (m.y - p.y) * ux);
      if (along > 0 && along <= out && off <= m.r + hr && along < best) best = along;
    }
    if (best < Infinity) { out = Math.max(30, best); lodge = true; }
  }
  const hover = modVar(rt.mods, 'hover');
  const legs: Leg[] = [{ kind: 'out', again: false }];
  // Lodged Teeth: 1.5 s grinding (4 hits at 60 %); Grinding Stop: a pause hitting every 0.2 s for 60 %.
  if (lodge) legs.push({ kind: 'hold', ms: 1500, grindMs: 375, coef: 0.6 });
  else if (hover > 0) legs.push({ kind: 'hold', ms: hover * 1000, grindMs: 200, coef: 0.6 });
  legs.push({ kind: 'home' });
  // Grinning Saw: thrown out again from the hand along the same line, then home; each enemy is hit at most three times.
  const thrice = rt.flags.has('hatchetThrice');
  if (thrice) legs.push({ kind: 'out', again: true }, { kind: 'home' });
  const holdMs = legs.reduce((n, l) => (l.kind === 'hold' ? l.ms : n), 0);
  inst.emit({ e: 'aoe', v: thrice ? 'hatchet3' : 'hatchet', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(out), d: Math.round(holdMs), el: elIdx(skillElement(rt)), s: p.id, a: +ang.toFixed(3) }, p.x, p.y, p.id);

  const st = strikeOf(p, rt);
  const keen = modVar(rt.mods, 'keenTeeth'), wake = modVar(rt.mods, 'wake'), splinters = modVar(rt.mods, 'splinters'), seek = modVar(rt.mods, 'seek');
  const kind = rt.flags.has('hatchetBurn') ? 'burn' as const : 'bleed' as const;
  const bleedOf = () => makeDot(inst, p, { ...st, coef: 2.4 * (1 + keen / 100) }, kind, skillDurationMs(rt), 500);
  const rust = rt.flags.has('rustVuln') ? resolveStatus({ kind: 'vulnerable', pct: 10, ms: skillDurationMs(rt), tags: { anyOf: ['bleed'] } }, p.ctx.powers.index) : null;
  const passes = new Map<Mob, { last: number; n: number }>(); // per enemy: last pass that hit it, pass hits so far
  let x = p.x, y = p.y, leg = 0, pass = 0, legT = 0, grindT = 0, tx = p.x + ux * out, ty = p.y + uy * out;
  let seekTo: Mob | null = null, alive = 3000 + out / speed * 6000;
  let passHit = new Set<Mob>(), passElite = false;

  const strike = (m: Mob, coefMul: number, grind: boolean) => {
    const seen = passes.get(m);
    if (!grind && seen && seen.n >= 3) return; // at most three passes per enemy
    const mult = seen && seen.last < pass && wake > 0 ? 1 + wake / 100 : 1; // Serrated Wake: later passes
    const r = wHit(inst, p, m, coefMul === 1 && mult === 1 ? st : { ...st, coef: st.coef * coefMul, mult: (st.mult ?? 1) * mult }, rt);
    passes.set(m, { last: pass, n: (seen?.n ?? 0) + (grind ? 0 : 1) });
    cast.hit.add(m);
    if (!r.killed && !m.dead && !cast.bled.has(m)) {
      cast.bled.add(m); addOwnedDot(p, m, bleedOf());
      if (rust) applyStatus(inst, p, m, rust, p.x, p.y, 'sawtooth_hatchet'); // Rusted Edge: +10 % from your Bleed skills
    }
    // Splinters: the first elite of a pass throws splinters that apply the bleed.
    if (splinters > 0 && !passElite && isEliteTier(m.tier)) {
      passElite = true;
      const used = new Set<Mob>([m]);
      for (let i = 0; i < splinters; i++) {
        const t = nearestMob(inst, m.x, m.y, 200, used);
        if (!t) break;
        used.add(t);
        const s2 = wHit(inst, p, t, { ...st, coef: 0.4, noArea: true }, rt);
        if (!s2.killed && !t.dead) addOwnedDot(p, t, bleedOf());
        inst.emit({ e: 'beam', v: 'splinter', x: Math.round(m.x), y: Math.round(m.y), tx: Math.round(t.x), ty: Math.round(t.y), el: elIdx(st.el), d: 200 }, t.x, t.y, p.id);
      }
    }
    // Woodcutter's Grips: the cast is free once it has hit 4 enemies.
    if (rt.flags.has('woodcutter') && !cast.refunded && cast.hit.size >= 4) { cast.refunded = true; gainResource(p, cast.cost); }
  };
  const sweep = (x0: number, y0: number, x1: number, y1: number) => {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, half = Math.hypot(x1 - x0, y1 - y0) / 2;
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
    for (const m of inst.queryMobs(mx, my, half + hr)) {
      if (m.dead || passHit.has(m)) continue;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((m.x - x0) * dx + (m.y - y0) * dy) / l2)) : 0;
      if (Math.hypot(m.x - (x0 + dx * t), m.y - (y0 + dy * t)) > hr + m.r) continue;
      passHit.add(m);
      strike(m, 1, false);
    }
  };
  const caught = () => {
    // Catch: Fury back if this hatchet hit 3+ enemies; Bloodtrail: heal per enemy bleeding from it (once per cast).
    const catchFury = modVar(rt.mods, 'catchFury');
    if (catchFury > 0 && passes.size >= 3) gainResource(p, catchFury);
    if (rt.flags.has('hatchetHeal') && !cast.healed) {
      cast.healed = true;
      let n = 0;
      for (const m of cast.bled) if (!m.dead && m.dots.some((d) => d.owner === p.id && d.skill === 'sawtooth_hatchet')) n++;
      if (n) healPlayer(inst, p, p.mhp * Math.min(10, n) / 100, false);
    }
  };
  const nextLeg = () => {
    leg++; legT = 0; grindT = 0; seekTo = null;
    const L = legs[leg];
    if (!L || L.kind === 'hold') return;
    pass++; passHit = new Set(); passElite = false;
    if (L.kind === 'out') { const o = reach(inst, p.x, p.y, ux, uy, out); x = p.x; y = p.y; tx = p.x + ux * o; ty = p.y + uy * o; }
    else if (seek > 0) {
      // Seeking Return: curve toward the nearest bleeding enemy within the allowed angle of the way home.
      const home = Math.atan2(p.y - y, p.x - x);
      let best: Mob | null = null, bd = Infinity;
      for (const m of inst.queryMobs(x, y, Math.hypot(p.x - x, p.y - y))) {
        if (m.dead || !m.dots.some((d) => d.kind === 'bleed')) continue;
        if (Math.abs(norm(Math.atan2(m.y - y, m.x - x) - home)) > seek * DEG) continue;
        const d = Math.hypot(m.x - x, m.y - y);
        if (d > 30 && d < bd) { bd = d; best = m; }
      }
      seekTo = best;
      if (best) inst.emit({ e: 'aoe', v: 'hatchet_seek', x: Math.round(best.x), y: Math.round(best.y), r: 1, d: 0, el: elIdx(st.el), s: p.id }, best.x, best.y, p.id);
    }
  };
  const step = () => {
    if (p.deadMs > 0 || inst.playerById(p.id) !== p || (alive -= 50) <= 0) return;
    const L = legs[leg];
    if (!L) return;
    const mv = speed * 0.05;
    if (L.kind === 'hold') {
      legT += 50; grindT -= 50;
      if (grindT <= 0) { grindT += L.grindMs; for (const m of inst.queryMobs(x, y, hr + 10)) if (!m.dead) strike(m, L.coef, true); }
      if (legT >= L.ms) nextLeg();
    } else {
      let gx = tx, gy = ty;
      if (L.kind === 'home') {
        gx = p.x; gy = p.y;
        if (seekTo && !seekTo.dead && Math.hypot(seekTo.x - x, seekTo.y - y) > 24) { gx = seekTo.x; gy = seekTo.y; } else seekTo = null;
      }
      legT += 50;
      const dx = gx - x, dy = gy - y, d = Math.hypot(dx, dy);
      const nx = d <= mv ? gx : x + dx / d * mv, ny = d <= mv ? gy : y + dy / d * mv;
      sweep(x, y, nx, ny);
      x = nx; y = ny;
      if (L.kind === 'home' && !seekTo && Math.hypot(p.x - x, p.y - y) <= 30) {
        if (leg === legs.length - 1) { caught(); return; }
        nextLeg();
      } else if (L.kind === 'out' && d <= mv) nextLeg();
    }
    inst.sched.schedule(inst.t + 50, step);
  };
  inst.sched.schedule(inst.t + 50, step);
}

// ─────────────────────────── W9 Muster Standard (buff, ground) ───────────────────────────

function musterStandard(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const ws = wstate(p);
  const max = 1 + Math.max(0, Math.floor(modVar(rt.mods, 'extraStandards'))); // Quartermaster's Cuirass: two standards
  const live = ws.standards.filter((s) => !s.ended && s.endT > inst.t);
  while (live.length >= max) {
    const old = live.shift()!;
    old.ended = true;
    if (old.ground) old.ground.endT = 0;
    inst.emit({ e: 'aoe', v: 'standard_end', x: Math.round(old.x), y: Math.round(old.y), r: Math.round(old.r), d: 0, el: 0, s: p.id }, old.x, old.y, p.id);
  }
  // Marching Orders carries it (radius −30 %); Hearthbanner 6 makes it follow you at full size.
  const r = skillRadius(rt), dur = skillDurationMs(rt), carry = rt.flags.has('standardCarry') || rt.flags.has('hearthFollow');
  const s: Standard = { id: ++ws.standardSeq, x: p.x, y: p.y, r, endT: inst.t + dur, carry, inside: new Set(), ended: false };
  ws.standards = [...live, s];
  // The standard is one of your Ground effects ("inside your Ground" conditions, Ground-tag items).
  const g = placeGround(inst, p, carry ? 'muster_ground_carried' : 'muster_ground', s.x, s.y, 0);
  if (g) { g.r = r; g.endT = s.endT; s.ground = g; }
  // Taunting Colours: enemies within 300 units turn on the standard for 3 s.
  if (rt.flags.has('standardTaunt')) {
    const taunt = resolveStatus({ kind: 'taunt', ms: 3000 }, p.ctx.powers.index);
    for (const m of inst.queryMobs(s.x, s.y, 300)) if (!m.dead) applyStatus(inst, p, m, taunt, s.x, s.y, 'muster_standard', { x: s.x, y: s.y, endT: s.endT });
  }
  const pulse = rt.flags.has('standardPulse'), regen = rt.flags.has('standardRegen');
  const colour = modVar(rt.mods, 'colourGuard'), heal = modVar(rt.mods, 'plantHeal');
  const pulseSt: Strike = { ...strikeOf(p, rt, 0.6), noArea: true }; // Ember Pennant: 60 % weapon damage per second
  if (heal > 0) for (const q of inst.playersNear(s.x, s.y, r)) healPlayer(inst, q, q.mhp * heal / 100, false); // Rallying Pulse
  skillGain(p, rt, rt.def.gen + (rt.mods.gen ?? 0));
  const el = elIdx(skillElement(rt));
  // Hold the Line: enemies inside are slowed (re-applied every tick, so it ends 0.4 s after an enemy leaves).
  const holdPct = modVar(rt.mods, 'standardSlow');
  const hold = holdPct > 0 ? resolveStatus({ kind: 'slow', pct: holdPct, ms: 400 }, p.ctx.powers.index) : null;
  inst.emit({ e: 'aoe', v: carry ? 'standard_carry' : 'standard', x: Math.round(s.x), y: Math.round(s.y), r: Math.round(r), d: Math.round(dur), el, s: p.id }, s.x, s.y, p.id);
  let pulseMs = 1000;
  const tick = () => {
    if (s.ended) return;
    if (inst.playerById(p.id) !== p) { s.ended = true; return; }
    if (inst.t >= s.endT) {
      s.ended = true;
      // Colour Guard: everyone who stood inside gains damage for 5 s when it expires.
      if (colour > 0) for (const q of s.inside) if (q.deadMs <= 0 && inst.playerById(q.id) === q) addBuff(q, { id: 'colour_guard', ms: 5000, dmg: colour });
      return;
    }
    if (s.carry && p.deadMs <= 0) { s.x = p.x; s.y = p.y; }
    // You and allies inside: +15 % attack speed and 2 resource per second (each class's own resource).
    for (const q of inst.playersNear(s.x, s.y, s.r)) {
      addBuff(q, { id: 'muster_standard', ms: 400, ias: 15 + (q === p ? hearthIas(rt) : 0) });
      syncWarhorn(q);
      gainResource(q, 0.5);
      if (regen) healPlayer(inst, q, q.mhp * 0.0025, true); // Rallying Ground: 1 % per second
      s.inside.add(q);
    }
    if (hold) for (const m of inst.queryMobs(s.x, s.y, s.r)) if (!m.dead && Math.hypot(m.x - s.x, m.y - s.y) <= s.r + m.r) applyStatus(inst, p, m, hold, s.x, s.y, 'muster_standard');
    if (pulse && (pulseMs -= 250) <= 0) {
      pulseMs += 1000;
      for (const m of inst.queryMobs(s.x, s.y, s.r)) if (!m.dead) wHit(inst, p, m, pulseSt, rt);
      inst.emit({ e: 'aoe', v: 'standard_pulse', x: Math.round(s.x), y: Math.round(s.y), r: Math.round(s.r), d: 400, el, s: p.id }, s.x, s.y, p.id);
    }
    inst.sched.schedule(inst.t + 250, tick);
  };
  tick();
  emitCast(inst, p, rt, s.x, s.y, r);
  return true;
}

// ─────────────────────────── W10 Ironplough (channel) ───────────────────────────

/** Ironplough ramp per channel: +20 % every 0.5 s held, up to double at 2.5 s (bible W10). */
const plough = new WeakMap<ChannelState, { ang: number; init: boolean }>();

function ironploughTick(inst: Instance, p: Player, rt: SkillRuntime, ch: ChannelState, dtMs: number) {
  const ex = chExtra(ch), ws = wstate(p);
  let pl = plough.get(ch);
  if (!pl) {
    pl = { ang: p.faceLeft ? Math.PI : 0, init: true };
    plough.set(ch, pl);
    // Patient Draft / Furrowmark 6: the ramp of the last channel is kept for a while.
    const keep = Math.max(modVar(rt.mods, 'keepRamp') * 1000, rt.flags.has('furrowKeepRamp') ? 2000 : 0);
    if (keep > 0 && inst.t - ws.rampT <= keep) ex.rampMs = ws.rampMs;
  }
  ex.rampMs += dtMs * (rt.flags.has('ploughFastRamp') ? 2 : 1); // Coulter Blade: full ramp twice as fast
  ws.rampMs = ex.rampMs; ws.rampT = inst.t;
  const level = Math.min(5, Math.floor(ex.rampMs / 500));
  const drain = skillCost(p, rt) * dtMs / 1000;
  channelCommon(inst, p, rt, ch, dtMs, ex, drain);
  const len = skillRadius(rt), half = (45 + modVar(rt.mods, 'broadShare') / 2) * DEG;
  // Facing: the way you move; standing still, the densest enemies in front (or the nearest one).
  if (p.moving && (Math.abs(p.lastIn.mx) > 0.05 || Math.abs(p.lastIn.my) > 0.05)) pl.ang = Math.atan2(p.lastIn.my, p.lastIn.mx);
  else {
    const a = bestConeAngle(inst, p.x, p.y, len, half);
    if (a !== null) pl.ang = a;
    else { const t = pickTarget(inst, p.x, p.y, len + 60, false, p.save.skills.targetPriority); if (t) pl.ang = Math.atan2(t.y - p.y, t.x - p.x); }
  }
  const ang = pl.ang, ux = Math.cos(ang), uy = Math.sin(ang);
  ch.aim = ang; // facing conditions (Brace, Furrowmark 4) use the plough's direction
  // Brace: at full ramp a hidden marker buff turns the node's damage-taken term on (enemies in front of you).
  if (level >= 5 && modVar(rt.mods, 'ploughBrace') > 0) addBuff(p, { id: 'plough_brace', ms: 150 });
  ch.tickMs -= dtMs;
  if (ch.tickMs <= 0) {
    ch.tickMs += 250;
    face(p, p.x + ux * 10);
    const st = strikeOf(p, rt, rt.def.coef / 4 * (1 + 0.2 * level));
    const hold = rt.flags.has('ploughHold'), push = 20 * (1 + modVar(rt.mods, 'oxPush') / 100), ox = modVar(rt.mods, 'oxPush') > 0;
    const burn = rt.flags.has('ploughBurn');
    const targets = inst.queryMobs(p.x, p.y, len).filter((m) => !m.dead && inConeAt(m, p.x, p.y, ang, half, len));
    for (const m of targets) {
      const r = wHit(inst, p, m, st, rt);
      if (r.killed || m.dead) continue;
      if (burn && r.amount > 0) addCarriedDot(m, shareDot(p, 'ironplough', 'burn', 'fire', hitBase(p, m, 'ironplough', r.amount) * 0.5, 2000)); // Smouldering Share
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (hold) { if (d > len * 0.6) wPull(inst, p, m, p.x + ux * len * 0.7, p.y + uy * len * 0.7, 24, rt, ex); } // Deep Furrow
      else {
        const into = wPush(inst, p, m, ux, uy, push, rt, ex);
        if (into && ox && r.amount > 0) hurtMob(inst, m, r.amount * 0.3, st.el, p, false, false, p.id, 'ironplough'); // Ox Strength
      }
    }
    // Thrift Furrow: Fury back per second for every enemy in the cone beyond the first.
    const thrift = modVar(rt.mods, 'thrift');
    if (thrift > 0 && targets.length > 1) p.res = Math.min(p.mres, p.res + Math.min(skillCost(p, rt), (targets.length - 1) * thrift) * 0.25);
    inst.emit({ e: 'aoe', v: 'plough', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(len), d: level, el: elIdx(st.el), s: p.id, a: +ang.toFixed(3) }, p.x, p.y, p.id);
  }
  // Stone Spray: three stones every 0.5 s.
  if (rt.flags.has('ploughStones') && (ex.stoneMs -= dtMs) <= 0) {
    ex.stoneMs += 500;
    const sst: Strike = { ...strikeOf(p, rt, 0.6), noArea: true };
    for (const o of [-14, 0, 14]) spawnProj(inst, { kind: 'shard', v: 'stone', owner: p, src: p.id, x: p.x + ux * 20, y: p.y + uy * 20 - 6, angle: ang + o * DEG, speed: 700, lifeMs: 430, r: 10, el: sst.el, strike: sst });
  }
  // Sod Burst: the cone tip erupts.
  const sod = modVar(rt.mods, 'sodBurst');
  if (sod > 0 && (ex.sodMs -= dtMs) <= 0) {
    ex.sodMs += sod * 1000;
    const tx = p.x + ux * len * 0.85, ty = p.y + uy * len * 0.85;
    const sst: Strike = { ...strikeOf(p, rt, 0.6), noArea: true };
    for (const m of inst.queryMobs(tx, ty, 60)) if (!m.dead) wHit(inst, p, m, sst, rt);
    inst.emit({ e: 'aoe', v: 'sod', x: Math.round(tx), y: Math.round(ty), r: 60, d: 380, el: elIdx(sst.el), s: p.id }, tx, ty, p.id);
  }
}

function inConeAt(m: Mob, x: number, y: number, ang: number, half: number, len: number): boolean {
  const d = Math.hypot(m.x - x, m.y - y);
  if (d > len + m.r) return false;
  if (d <= m.r + 12) return true;
  return Math.abs(norm(Math.atan2(m.y - y, m.x - x) - ang)) <= half + Math.atan2(m.r, d);
}

// ─────────────────────────── W11 Cairnfall (cooldown) ───────────────────────────

function cairnfall(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  if (!anyEnemyWithin(inst, p.x, p.y, 320)) return false;
  const n = (rt.flags.has('cairnMore') ? 8 : 5) + Math.max(0, Math.floor(modVar(rt.mods, 'extraCairns'))); // Debt of Stone, Cairnwright's Hammer
  const baseRadius = skillRadius(rt), stunMs = skillDurationMs(rt);
  const ox = p.x, oy = p.y;
  const pts: { x: number; y: number }[] = [];
  if (rt.flags.has('cairnLine')) {
    // Scree Line: toward the densest pack, up to 300 units.
    const bp = bestPoint(inst, ox, oy, 300, baseRadius);
    const t = bp ?? nearestMob(inst, ox, oy, 300);
    const a = t ? Math.atan2(t.y - oy, t.x - ox) : (p.faceLeft ? Math.PI : 0);
    for (let i = 0; i < n; i++) { const d = 300 * (i + 1) / n; pts.push({ x: ox + Math.cos(a) * d, y: oy + Math.sin(a) * d }); }
  } else {
    const ring = modVar(rt.mods, 'ringRadius') > 0 ? modVar(rt.mods, 'ringRadius') : 120; // Tight Ring
    const near = nearestMob(inst, ox, oy, 320);
    const a0 = near ? Math.atan2(near.y - oy, near.x - ox) : 0;
    for (let i = 0; i < n; i++) { const a = a0 + i * TAU / n; pts.push({ x: ox + Math.cos(a) * ring, y: oy + Math.sin(a) * ring }); }
  }
  const st = strikeOf(p, rt), el = elIdx(skillElement(rt));
  const stay = rt.flags.has('cairnStay') ? 6000 : 4000;
  const bounce = modVar(rt.mods, 'bounce'), fury = modVar(rt.mods, 'cairnFury');
  // Quarry Dust: enemies hit are slowed for 3 s. Capstone: the last cairn is a giant (radius × the node value, 50 % more).
  const dustPct = modVar(rt.mods, 'cairnSlow'), cap = modVar(rt.mods, 'capstone');
  const dust = dustPct > 0 ? resolveStatus({ kind: 'slow', pct: dustPct, ms: 3000 }, p.ctx.powers.index) : null;
  const giant: Strike = { ...st, mult: (st.mult ?? 1) * 1.5 };
  let refunded = 0;
  pts.forEach((pt, i) => {
    const delay = 250 * (i + 1); // five impacts over 1.25 s, 0.25 s apart
    const big = cap > 0 && i === pts.length - 1, radius = big ? baseRadius * cap : baseRadius, hitSt = big ? giant : st;
    inst.emit({ e: 'tele', v: 'cairn', x: Math.round(pt.x), y: Math.round(pt.y), r: Math.round(radius), d: delay, s: p.id }, pt.x, pt.y, p.id);
    inst.sched.schedule(inst.t + delay, () => {
      if (inst.playerById(p.id) !== p) return;
      let hits = 0;
      for (const m of inst.queryMobs(pt.x, pt.y, radius)) {
        if (m.dead) continue;
        const stunned = wStun(inst, p, m, stunMs, rt);
        wHit(inst, p, m, hitSt, rt);
        if (dust && !m.dead) applyStatus(inst, p, m, dust, pt.x, pt.y, 'cairnfall');
        hits++;
        // Shepherd's Count: each stunned enemy shortens the cooldown by 1 s (at most 10 s per cast).
        if (stunned && rt.flags.has('cairnRefund') && refunded < 10) { refunded++; reduceCooldowns(inst, p, 1000, null, 'cairnfall'); }
      }
      if (hits && fury > 0) gainResource(p, fury); // Fury Cairn
      deepEarth(inst, p, rt, pt.x, pt.y, radius);
      if (bounce > 0 && inst.rng.next() * 100 < bounce) { // Second Fall
        const t = nearestMob(inst, pt.x, pt.y, 150);
        if (t) {
          wHit(inst, p, t, { ...st, coef: st.coef * 0.5, noArea: true }, rt);
          inst.emit({ e: 'aoe', v: 'cairn', x: Math.round(t.x), y: Math.round(t.y), r: Math.round(radius * 0.6), d: 900, el, s: p.id }, t.x, t.y, p.id);
        }
      }
      if (rt.flags.has('cairnMolten')) { // Kiln Stones: molten ground for 2 s at Meteor's molten rate (235 % over 3 s [M])
        const ms: Strike = { ...strikeOf(p, rt, 2.35 / 3), el: 'fire' };
        const g = newGround('molten', pt.x, pt.y, radius, inst.t, 2000, 500);
        g.owner = p; g.strike = ms; g.el = 'fire'; g.dmg = expectedDamage(inst, p, ms) / 2;
        addGround(inst, g);
        inst.emit({ e: 'aoe', v: 'molten', x: Math.round(pt.x), y: Math.round(pt.y), r: Math.round(radius), d: 2000, el: elIdx('fire'), s: p.id }, pt.x, pt.y, p.id);
      }
      if (rt.flags.has('cairnStay')) for (let k = 1; k <= 3; k++) inst.sched.schedule(inst.t + k * 2000, () => { // Waymarker
        if (inst.playerById(p.id) !== p) return;
        for (const m of inst.queryMobs(pt.x, pt.y, 50)) {
          if (m.dead) continue;
          wStun(inst, p, m, 1000, rt);
          wHit(inst, p, m, { ...st, coef: st.coef * 0.5, noArea: true }, rt);
        }
        inst.emit({ e: 'aoe', v: 'cairn_pulse', x: Math.round(pt.x), y: Math.round(pt.y), r: 50, d: 400, el, s: p.id }, pt.x, pt.y, p.id);
      });
      inst.emit({ e: 'aoe', v: 'cairn', x: Math.round(pt.x), y: Math.round(pt.y), r: Math.round(radius), d: stay, el, s: p.id }, pt.x, pt.y, p.id);
      if (i === 0) for (const q of inst.playersNear(pt.x, pt.y, 700)) inst.emitTo(q.id, { e: 'shake', m: q === p ? 3 : 1, d: 120 });
    });
  });
  skillGain(p, rt, rt.def.gen + (rt.mods.gen ?? 0));
  emitCast(inst, p, rt, ox, oy, baseRadius);
  return true;
}

// ─────────────────────────── W12 Kilnheart (buff) ───────────────────────────

function kilnheart(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const dur = skillDurationMs(rt), ws = wstate(p);
  // +20 % damage (generic bucket), +15 % attack speed (Banked Coals: none), Fury costs −50 %.
  addBuff(p, { id: 'kilnheart', ms: dur, dmg: 20, cost: -50, ...(rt.flags.has('kilnNoIas') ? (hearthIas(rt) ? { ias: hearthIas(rt) } : {}) : { ias: 15 + hearthIas(rt) }) });
  ws.kilnExtended = 0;
  gainResource(p, modVar(rt.mods, 'kilnFill')); // Stoke the Fire
  syncWarhorn(p);
  const el = elIdx(skillElement(rt));
  // Bellows Breath: a 90° cone of fire (250 units) for 600 % weapon damage on activation.
  if (rt.flags.has('kilnBreath')) {
    const a = bestConeAngle(inst, p.x, p.y, 250, 45 * DEG) ?? (p.faceLeft ? Math.PI : 0);
    const st: Strike = { ...strikeOf(p, rt, 6.0), noArea: true };
    for (const m of inst.queryMobs(p.x, p.y, 250)) if (!m.dead && inConeAt(m, p.x, p.y, a, 45 * DEG, 250)) wHit(inst, p, m, st, rt);
    inst.emit({ e: 'aoe', v: 'kiln_breath', x: Math.round(p.x), y: Math.round(p.y), r: 250, d: 520, el, s: p.id, a: +a.toFixed(3) }, p.x, p.y, p.id);
  }
  // Cinder Prints (footprints) while it burns; Afterglow keeps part of the damage bonus for 8 s when it ends.
  const prints = modVar(rt.mods, 'cinderPrints'), glow = modVar(rt.mods, 'afterglow');
  let lastX = p.x, lastY = p.y;
  const loop = () => {
    if (inst.playerById(p.id) !== p) return;
    const b = getBuff(p, 'kilnheart');
    if (!b) { if (glow > 0 && p.deadMs <= 0) addBuff(p, { id: 'afterglow', ms: 8000, dmg: 20 * glow / 100 }); return; }
    if (prints > 0 && (p.x - lastX) ** 2 + (p.y - lastY) ** 2 >= 36 * 36) {
      lastX = p.x; lastY = p.y;
      placeGround(inst, p, 'cinder_prints', p.x, p.y, 0, prints / 30); // 30 % per second at scale 1
    }
    inst.sched.schedule(inst.t + 250, loop);
  };
  if (prints > 0 || glow > 0) loop();
  emitCast(inst, p, rt, p.x, p.y);
  return true;
}

// ─────────────────────────── Registration ───────────────────────────

export const WARRIOR_M1_BEHAVIOURS: Record<string, SkillBehaviour> = {
  tolling_blow: { primary: tollingBlow },
  sawtooth_hatchet: { cast: sawtoothHatchet },
  muster_standard: { cast: musterStandard },
  ironplough: { channelTick: ironploughTick },
  cairnfall: { cast: cairnfall },
  kilnheart: { cast: kilnheart },
};
