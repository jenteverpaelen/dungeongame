// Ranger M1 skills (RANGER.md §3, bible v2): Skipstone Bolt, Spring Snare, Overcast Volley, Quarry Mark, Pitch Mortar,
// Murmuration — behaviour, their runes and specialization nodes, and the summon AIs (snare, mortar, flock). Data:
// shared/src/data/skills/ranger.ts. Shared ranger plumbing: ./rangerKit.ts. Numbers the bible does not give are [P] and
// say where they come from.

import { RANGER_FX } from '../../shared';
import { bestPoint } from '../brain';
import { gainResource, isEliteTier, strikeMob } from '../damage';
import { addBuff, chillMob, distToSegment, dragMob, elIdx, freezeMob, knockbackMob, removeBuff, stunMob } from '../effects';
import { placeGround } from '../groundFx';
import type { Instance } from '../instance';
import { maxSummonsOf, skillCooldownMs, skillCost, skillDurationMs, skillRadius } from '../playerctx';
import { resolveStatus } from '../powerRuntime';
import { spawnProj } from '../projectiles';
import { applyStatus } from '../status';
import { moveSummon, spawnSummon } from '../summons';
import type { Mob, Player, Proj, SkillRuntime, Strike, Summon } from '../types';
import { emitCast, face, faceTo, strikeOf, trimSummons, type SkillBehaviour, type SummonBehaviour } from './common';
import {
  barVar, beastHit, beastStrike, deviceHit, deviceHooks, deviceRate, gather, hasTag, nearestMob, noteCast, noteSpend,
  quarryOf, rangerMark, reduceCooldowns, rmob, rstate, rv, setQuarry, slowMob, slowPulse, spot, strongestMob, summonTarget,
} from './rangerKit';

// ─────────────────────────── Shared projectile effects (Piercing items) ───────────────────────────

/** Skimmer's Leggings: a chilling ripple at an enemy a Piercing projectile passes; Projectile hits on it take more. */
export function skimRipple(inst: Instance, p: Player, m: Mob, pct: number) {
  inst.emit({ e: 'aoe', v: 'skim_ripple', x: Math.round(m.x), y: Math.round(m.y), r: 40, d: 1000, el: elIdx('cold'), s: p.id }, m.x, m.y, p.id);
  const vul = resolveStatus({ kind: 'vulnerable', ms: 1000, pct, tags: { anyOf: ['projectile'] } }, p.ctx.powers.index);
  for (const o of inst.queryMobs(m.x, m.y, 40 + m.r)) {
    if (o.dead) continue;
    chillMob(o, 1000, inst, p);
    applyStatus(inst, p, o, vul, m.x, m.y, 'skimmers_leggings');
  }
}

/** Skipping-Stone Quiver: the last enemy a Piercing projectile hit throws 3 splinters that pierce once. */
export function splinters(inst: Instance, p: Player, m: Mob, pct: number, st: Strike, hit: ReadonlySet<number>) {
  const base = inst.rng.next() * Math.PI * 2;
  for (let i = 0; i < 3; i++) {
    let n = 0;
    spawnProj(inst, {
      kind: 'multi', v: 'splinter', owner: p, src: p.id, x: m.x, y: m.y, angle: base + (i * Math.PI * 2) / 3, speed: 760, lifeMs: 420, r: 9, el: st.el,
      strike: { ...st, coef: pct / 100, primary: false, noProc: true }, pierce: 1, hits: new Set(hit), reach: 320,
      hooks: { post: (_i, pr) => { if (++n >= 2) pr.lifeMs = 0; } },
    });
  }
}

// ─────────────────────────── R7 Skipstone Bolt (primary) ───────────────────────────

interface SkipChain { hits: Set<number>; left: number; falloff: number; idx: number; st: Strike; heavy: boolean }

function skipstone(inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob) {
  const rs = rstate(p);
  rs.lastShot = tgt.id;
  const st: Strike = { ...strikeOf(p, rt), primary: true };
  const heavy = rt.flags.has('noSkip');
  const more = rt.flags.has('skipMore');
  const skips = heavy ? 0 : (more ? 4 : 2) + rv(rt, 'skips') + rv(rt, 'morePierce');
  const falloff = Math.max(0, (more ? 30 : 20) - rv(rt, 'skipFalloff'));
  const farwatch = noteCast(p, rt);
  if (!farwatch) launchSkip(inst, p, rt, p.x, p.y - 4, tgt, { hits: new Set(), left: skips, falloff, idx: 0, st, heavy }, null);
  // Hawkfeather Cap: Primary skills also strike a second target.
  if (!farwatch && rt.flags.has('hawkfeather')) {
    const second = nearestMob(inst, tgt.x, tgt.y, rt.def.range, (o) => o === tgt);
    if (second && Math.hypot(second.x - p.x, second.y - p.y) <= rt.def.range + 60) launchSkip(inst, p, rt, p.x, p.y - 4, second, { hits: new Set(), left: skips, falloff, idx: 0, st, heavy }, null);
  }
  if (farwatch) farwatchShot(inst, p, rt, Math.atan2(tgt.y - p.y, tgt.x - p.x));
  gainResource(p, rt.def.gen + (rt.mods.gen ?? 0));
  emitCast(inst, p, rt, tgt.x, tgt.y);
}

function launchSkip(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, tgt: Mob, ch: SkipChain, from: Proj | null) {
  // Damage of this pass: −falloff points per skip (multiplicative), the final skip bonus, Featherguard compounding.
  let coef = ch.st.coef * (1 - ch.falloff / 100) ** ch.idx;
  if (ch.idx > 0 && ch.left === 0) coef *= 1 + rv(rt, 'skipFinal') / 100;
  const fg = rv(rt, 'featherguard');
  if (fg > 0 && ch.idx > 0) coef *= (1 + fg / 100) ** Math.min(3, ch.idx);
  const st = { ...ch.st, coef, primary: ch.idx === 0 };
  const rule = from?.rule;
  spawnProj(inst, {
    kind: 'shard', v: ch.heavy ? 'skip_heavy' : 'skip', owner: p, src: p.id, x, y, angle: Math.atan2(tgt.y - y, tgt.x - x), speed: RANGER_FX.skipSpeed,
    lifeMs: 1200, r: ch.heavy ? 14 : 11, el: st.el, strike: st, homing: tgt.id, turn: 14, hits: ch.hits, reach: Math.max(rt.def.range, skillRadius(rt)) + 60,
    ...(rule ? { inherit: { rule, flown: from!.flown ?? 0, bounces: from!.bounces ?? 0 } } : {}),
    hooks: { post: (_i, pr, m) => onSkipHit(inst, p, rt, m, ch, pr) },
  });
}

function onSkipHit(inst: Instance, p: Player, rt: SkillRuntime, m: Mob, ch: SkipChain, pr: Proj) {
  ch.hits.add(m.id);
  const pass = ch.idx > 0;
  if (ch.heavy) knockbackMob(m, m.x - p.x, m.y - p.y, 60, inst, p);
  if (rt.flags.has('skipRipple')) {
    inst.emit({ e: 'aoe', v: 'skip_ripple', x: Math.round(m.x), y: Math.round(m.y), r: 50, d: 500, el: elIdx(ch.st.el), s: p.id }, m.x, m.y, p.id);
    // Bible: "chills 30% for 1 s": a 30 % slow (engine wave 3).
    for (const o of inst.queryMobs(m.x, m.y, 50)) { if (o.dead) continue; if (o !== m) strikeMob(inst, p, o, { ...ch.st, coef: 0.4, primary: false, noProc: true }); slowMob(inst, p, o, 30, 1000, 'skipstone_bolt'); }
  }
  // Wake: each skip point leaves a 1 s puddle (radius 50 [P], Ripple's) that slows by the node's strength.
  const wake = rv(rt, 'skipPuddle');
  if (wake > 0) {
    const wx = m.x, wy = m.y;
    inst.emit({ e: 'aoe', v: 'wet', x: Math.round(wx), y: Math.round(wy), r: 50, d: 1000, el: elIdx('cold'), s: p.id }, wx, wy, p.id);
    slowPulse(inst, p, () => ({ x: wx, y: wy, r: 50 }), wake, inst.t + 1000, 'skipstone_bolt');
  }
  if (pass) {
    if (rt.flags.has('skipGen')) gainResource(p, 1);
    const g = rv(rt, 'skipGenRank'); if (g > 0) gainResource(p, g);
    const trip = rv(rt, 'skipTrip'); if (trip > 0 && !m.dead) stunMob(m, trip * 1000, inst, p);
    const sk = rv(rt, 'skimmer'); if (sk > 0 && !m.dead) skimRipple(inst, p, m, sk);
  }
  if (rt.flags.has('spotting') && !m.dead) spot(inst, p, m);
  // Next skip: the nearest enemy not hit yet within the skip radius (Water Dance: maybe one already hit).
  if (ch.left > 0) {
    const revisit = inst.rng.next() * 100 < rv(rt, 'skipRevisit');
    const next = nearestMob(inst, m.x, m.y, skillRadius(rt), (o) => o === m || (!revisit && ch.hits.has(o.id)));
    if (next) {
      if (revisit) ch.hits.delete(next.id);
      launchSkip(inst, p, rt, m.x, m.y, next, { ...ch, left: ch.left - 1, idx: ch.idx + 1 }, pr);
      return;
    }
  }
  // The chain ends here.
  if (rt.flags.has('skipMark') && !m.dead) rangerMark(inst, p, m, 3000, 10 + rv(rt, 'markPctAdd'));
  const spl = rv(rt, 'splinters'); if (spl > 0) splinters(inst, p, m, spl, ch.st, ch.hits);
}

/**
 * Farwatch 6: the 5th Projectile cast is a shot that flies 900 units, pierces everything (the cast's own damage) and
 * releases your most recent Projectile Spender where it ends. Fitted [M]: the free cast deals FARWATCH_FREE of its damage
 * (BUDGET.md R1: a 6-piece transform is worth at most ×1.10; RANGER-WAVE.md §4).
 */
export const FARWATCH_FREE = 0.5;
export function farwatchShot(inst: Instance, p: Player, rt: SkillRuntime, ang: number) {
  const st: Strike = { ...strikeOf(p, rt), primary: false };
  spawnProj(inst, {
    kind: 'multi', v: 'farwatch', owner: p, src: p.id, x: p.x, y: p.y - 4, angle: ang, speed: 1400, lifeMs: 900 / 1400 * 1000, r: 14, el: st.el, strike: st,
    pierce: 1, hits: new Set(), reach: 900,
    hooks: { end: (i, pr) => {
      const id = rstate(p).lastProjSpender;
      const spender = id ? p.ctx.slotted(id) : null;
      if (spender) freeSpender(i, p, spender, pr.x, pr.y);
    } },
  });
}

/** Registered by ranger.ts: cast a Projectile Spender for free from a point (Farwatch 6), at a damage scale (Siegebreaker 4). */
export const freeCasts: { at: ((inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, scale: number, src: number) => void) | null } = { at: null };
function freeSpender(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number) { freeCasts.at?.(inst, p, rt, x, y, FARWATCH_FREE, p.id); }

// ─────────────────────────── R8 Spring Snare (device / trap) ───────────────────────────

interface SnareState { armT: number; placedT: number; rearmed: boolean; spent: boolean }
const snares = new WeakMap<Summon, SnareState>();
const snareOf = (s: Summon): SnareState => { let st = snares.get(s); if (!st) { st = { armT: 0, placedT: 0, rearmed: false, spent: false }; snares.set(s, st); } return st; };

function armDelay(rt: SkillRuntime): number {
  if (rt.flags.has('snareInstant')) return 50; // "instantly": the next tick (the snare is seen by clients before it snaps)
  return 600 / (1 + rv(rt, 'armFast') / 100); // Snarewright 2: arm 50 % faster
}

function springSnare(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  const bp = bestPoint(inst, p.x, p.y, rt.def.range, radius);
  if (!bp) return false;
  // Not on top of another snare of yours.
  for (const s of p.summons) if (s.type === 'snare' && !s.dead && Math.hypot(s.x - bp.x, s.y - bp.y) < 40) return false;
  face(p, bp.x);
  const s = spawnSummon(inst, p, 'snare', 'spring_snare', bp.x, bp.y, skillDurationMs(rt));
  const st = snareOf(s);
  st.placedT = inst.t; st.armT = inst.t + armDelay(rt);
  trimSummons(p, 'spring_snare', maxSummonsOf(rt));
  noteSpend(inst, p, skillCost(p, rt));
  noteCast(p, rt);
  emitCast(inst, p, rt, bp.x, bp.y, radius);
  return true;
}

/** Snap a snare (victim may be null for a chained trigger). `scale`: Tripwire / Sympathetic Blast fraction. */
export function triggerSnare(inst: Instance, p: Player, s: Summon, victim: Mob | null, scale = 1) {
  const st = snareOf(s);
  if (st.spent || inst.t < st.armT || s.dead) return;
  const rt = p.ctx.modsOf('spring_snare');
  const radius = skillRadius(rt);
  let coef = rt.def.coef * scale;
  if (rt.flags.has('snarePatience') && inst.t - st.placedT >= 5000) coef *= 2; // Hunter's Patience
  const strike: Strike = { ...strikeOf(p, rt, coef), src: s.id };
  const holdMs = (1.5 + rv(rt, 'snareHold')) * 1000;
  s.attackSeq++; s.attackFlagMs = 250;
  inst.emit({ e: 'aoe', v: 'snare_snap', x: Math.round(s.x), y: Math.round(s.y), r: Math.round(radius), d: 400, el: elIdx(strike.el), s: s.id }, s.x, s.y, p.id);
  const held: Mob[] = [];
  for (const m of inst.queryMobs(s.x, s.y, radius)) {
    if (m.dead) continue;
    deviceHit(inst, p, m, strike);
    if (!m.dead) { stunMob(m, holdMs, inst, p); held.push(m); }
  }
  const v = victim && !victim.dead ? victim : held[0] ?? null;
  // Chain Snare: tether up to 2 nearby enemies and drag them 60 units toward the victim.
  if (rt.flags.has('snareTether') && v) {
    let n = 0;
    for (const o of inst.queryMobs(v.x, v.y, 220)) {
      if (o === v || o.dead || held.includes(o) || n >= 2) continue;
      n++;
      inst.emit({ e: 'beam', v: 'snare_tether', x: Math.round(v.x), y: Math.round(v.y), tx: Math.round(o.x), ty: Math.round(o.y), el: 0, d: 350 }, o.x, o.y, p.id);
      dragMob(inst, o, v.x, v.y, 60, p);
    }
  }
  // Shrapnel Jaw: a 120° cone behind the victim, 150 units.
  const cone = rv(rt, 'snareCone');
  if (cone > 0 && v) {
    const ang = Math.atan2(v.y - s.y, v.x - s.x);
    inst.emit({ e: 'aoe', v: 'snare_cone', x: Math.round(v.x), y: Math.round(v.y), r: 150, d: 300, el: elIdx(strike.el), s: s.id, a: +ang.toFixed(3) }, v.x, v.y, p.id);
    for (const o of inst.queryMobs(v.x, v.y, 150)) {
      if (o === v || o.dead) continue;
      let d = Math.atan2(o.y - v.y, o.x - v.x) - ang;
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) <= Math.PI / 3) deviceHit(inst, p, o, { ...strike, coef: coef * cone / 100, noProc: true });
    }
  }
  if (rt.flags.has('snareBurn')) placeGround(inst, p, 'snare_fire', s.x, s.y, 0, radius / 90);
  if (rt.flags.has('snareThorns')) {
    for (let i = 0; i < 4; i++) {
      spawnProj(inst, { kind: 'shard', v: 'thorn', owner: p, src: s.id, x: s.x, y: s.y, angle: (i * Math.PI) / 2 + Math.PI / 4, speed: 760, lifeMs: 500, r: 9, el: strike.el, strike: { ...strike, coef: 0.6 }, reach: 300 });
    }
  }
  const gen = rv(rt, 'snareGen'); if (gen > 0) gainResource(p, gen);
  // Snarewright 4: 20 % damage reduction for 3 s, held enemies pulled 30 units together.
  if (rt.flags.has('trapDr')) {
    addBuff(p, { id: 'snare_guard', ms: 3000, dr: 20 });
    if (held.length > 1) { inst.emit({ e: 'aoe', v: 'trap_pull', x: Math.round(s.x), y: Math.round(s.y), r: Math.round(radius), d: 300, el: 0, s: s.id }, s.x, s.y, p.id); for (const m of held) dragMob(inst, m, s.x, s.y, 30, p); }
  }
  // Re-arming: Reset Spring (1 s), Coiled Wire Bracers (2 s), Snarewright 6 (once).
  const reset = inst.rng.next() * 100 < rv(rt, 'snareRearm');
  const wire = !reset && inst.rng.next() * 100 < barVar(p, 'wireRearm');
  if (reset || wire) { st.armT = inst.t + (reset ? 1000 : 2000); st.placedT = st.armT; return; }
  if (rt.flags.has('trapRearm') && !st.rearmed) { st.rearmed = true; st.armT = inst.t + armDelay(rt) + 400; st.placedT = st.armT; return; }
  st.spent = true;
  s.dead = true;
}

/** Snarewright 6: a Device hit on a stunned enemy re-arms a spent (or triggered) Trap near it. */
deviceHooks.rearmNear = (inst, p, x, y) => {
  for (const s of p.summons) {
    if (s.type !== 'snare' || s.dead) continue;
    const st = snareOf(s);
    if (inst.t < st.armT && Math.hypot(s.x - x, s.y - y) <= 300) { st.armT = inst.t; return; }
  }
};

function snareAi(inst: Instance, s: Summon, p: Player, dtMs: number) {
  const st = snareOf(s);
  if (st.spent) return;
  const rt = p.ctx.modsOf('spring_snare');
  if (inst.t < st.armT) return;
  if (s.aux === 0) { s.aux = 1; inst.emit({ e: 'aoe', v: 'snare_arm', x: Math.round(s.x), y: Math.round(s.y), r: 20, d: 200, el: 0, s: s.id }, s.x, s.y, p.id); }
  const victim = nearestMob(inst, s.x, s.y, 40 + 16);
  if (victim && Math.hypot(victim.x - s.x, victim.y - s.y) <= 40 + victim.r) { s.aux = 0; triggerSnare(inst, p, s, victim); return; }
  // Bait: armed snares slowly draw enemies toward them (24 units per second [P], a quarter of Downdraft's per-arrow tug).
  const lure = rv(rt, 'snareLure');
  if (lure > 0) for (const m of inst.queryMobs(s.x, s.y, lure)) if (!m.dead) dragMob(inst, m, s.x, s.y, 24 * dtMs / 1000, p);
  // Tripwire: an enemy crossing the wire between two snares within 200 units triggers both.
  const wire = rv(rt, 'snareWire');
  if (wire > 0) {
    s.tickMs -= dtMs;
    if (s.tickMs <= 0) {
      s.tickMs += 250;
      for (const o of p.summons) {
        if (o === s || o.type !== 'snare' || o.dead || o.id < s.id) continue;
        const so = snareOf(o);
        if (so.spent || inst.t < so.armT || Math.hypot(o.x - s.x, o.y - s.y) > 200) continue;
        inst.emit({ e: 'beam', v: 'snare_wire', x: Math.round(s.x), y: Math.round(s.y), tx: Math.round(o.x), ty: Math.round(o.y), el: 0, d: 300 }, s.x, s.y, p.id);
        const cross = inst.queryMobs((s.x + o.x) / 2, (s.y + o.y) / 2, 110).find((m) => !m.dead && distToSegment(m.x, m.y, s.x, s.y, o.x, o.y) <= 14 + m.r);
        if (cross) { triggerSnare(inst, p, s, cross, wire / 100); triggerSnare(inst, p, o, cross, wire / 100); return; }
      }
    }
  }
}

// ─────────────────────────── R9 Overcast Volley (spender, aerial) ───────────────────────────

interface Volley { x: number; y: number; hits: Map<number, number>; gen: number }

function overcastVolley(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  let radius = skillRadius(rt);
  const bp = bestPoint(inst, p.x, p.y, rt.def.range, radius);
  if (!bp) return false;
  face(p, bp.x);
  noteSpend(inst, p, skillCost(p, rt));
  noteCast(p, rt);
  const downpour = rt.flags.has('volleyDownpour');
  const n = (downpour ? 14 : 8) + rv(rt, 'volleyArrows');
  const dur = downpour ? 2000 : skillDurationMs(rt);
  const coef = rt.def.coef * (downpour ? 0.65 : 1);
  const shelf = rt.flags.has('volleyBolts');
  inst.emit({ e: 'aoe', v: 'overcast_cloud', x: Math.round(bp.x), y: Math.round(bp.y), r: Math.round(radius), d: Math.round(RANGER_FX.overcastFallMs + dur + (shelf ? 2000 : 0)), el: elIdx(strikeOf(p, rt).el), s: p.id }, bp.x, bp.y, p.id);
  const v: Volley = { x: bp.x, y: bp.y, hits: new Map(), gen: 0 };
  const follow = rv(rt, 'volleyFollow') || (rt.flags.has('squallDrift') ? 60 : 0); // Squallcatcher drift [P] = Chasing Cloud rank 1
  const t0 = inst.t + RANGER_FX.overcastFallMs;
  for (let i = 0; i < n; i++) {
    const at = t0 + (dur * i) / Math.max(1, n - 1);
    const last = i === n - 1;
    // The client draws each arrow falling for FALL_LEAD ms before it lands (aoe `delay`): announce it that early.
    inst.sched.schedule(at - FALL_LEAD, () => {
      if (!inst.playerById(p.id)) return;
      if (follow > 0) { const t = bestPoint(inst, v.x, v.y, 240, radius); if (t) { const d = Math.hypot(t.x - v.x, t.y - v.y), step = Math.min(d, follow * dur / n / 1000); if (d > 1) { v.x += (t.x - v.x) / d * step; v.y += (t.y - v.y) / d * step; } } }
      const a = inst.rng.next() * Math.PI * 2, rr = Math.sqrt(inst.rng.next()) * radius;
      const heavy = last && rv(rt, 'volleyFinale') > 0;
      overcastArrow(inst, p, rt, v, v.x + Math.cos(a) * rr * (heavy ? 0 : 1), v.y + Math.sin(a) * rr * (heavy ? 0 : 1), heavy ? coef * rv(rt, 'volleyFinale') / 100 : coef, heavy ? 70 : 35, heavy);
    });
  }
  if (shelf) for (const k of [500, 1500]) inst.sched.schedule(t0 + dur + k, () => {
    if (!inst.playerById(p.id)) return;
    const near = inst.queryMobs(v.x, v.y, radius + 40).filter((m) => !m.dead);
    const m = near.length ? near[Math.floor(inst.rng.next() * near.length)] : null;
    if (!m) return;
    inst.emit({ e: 'beam', v: 'volley_bolt', x: Math.round(v.x), y: Math.round(v.y - 120), tx: Math.round(m.x), ty: Math.round(m.y), el: elIdx('lightning'), d: 220 }, m.x, m.y, p.id);
    strikeMob(inst, p, m, strikeOf(p, rt, 1.5));
  });
  // Patient Cloud (Arrowfall node): each Overcast Volley cast cuts Arrowfall's cooldown.
  const refund = rv(p.ctx.modsOf('rain_of_vengeance'), 'rainRefund');
  if (refund > 0) reduceCooldowns(inst, p, refund * 1000, null, 'rain_of_vengeance');
  emitCast(inst, p, rt, bp.x, bp.y, radius);
  return true;
}

/** Falling-arrow lead time for the client's streak (Overcast arrows, Rainkeeper strikes; the falcon uses 240 ms). */
export const FALL_LEAD = 150;

function overcastArrow(inst: Instance, p: Player, rt: SkillRuntime, v: Volley, x: number, y: number, coef: number, r: number, heavy: boolean) {
  const st = strikeOf(p, rt, coef);
  inst.emit({ e: 'aoe', v: heavy ? 'overcast_heavy' : 'overcast_arrow', x: Math.round(x), y: Math.round(y), r, d: 300, el: elIdx(st.el), s: p.id, delay: FALL_LEAD }, x, y, p.id);
  inst.sched.schedule(inst.t + FALL_LEAD, () => { if (inst.playerById(p.id)) overcastLand(inst, p, rt, v, x, y, st, r); });
}

function overcastLand(inst: Instance, p: Player, rt: SkillRuntime, v: Volley, x: number, y: number, st: Strike, r: number) {
  const gather0 = rv(rt, 'volleyGather');
  const hood = rv(rt, 'overcastHood');
  for (const m of inst.queryMobs(x, y, r)) {
    if (m.dead) continue;
    const k = (v.hits.get(m.id) ?? 0) + 1;
    v.hits.set(m.id, k);
    strikeMob(inst, p, m, st);
    if (m.dead) continue;
    if (rt.flags.has('chill') || rt.flags.has('aerialChill')) chillMob(m, 2000, inst, p);
    if (gather0 > 0) dragMob(inst, m, v.x, v.y, gather0, p);
    const gen = rv(rt, 'volleyGen');
    if (gen > 0 && isEliteTier(m.tier) && v.gen < 6) { const g = Math.min(gen, 6 - v.gen); v.gen += g; gainResource(p, g); }
    if (k === 3) {
      if (rt.flags.has('volleyPin')) stunMob(m, 1000, inst, p);
      const soak = rv(rt, 'volleySoak');
      if (soak > 0) applyStatus(inst, p, m, resolveStatus({ kind: 'vulnerable', ms: 3000, pct: soak, skills: ['rain_of_vengeance'] }, p.ctx.powers.index), x, y, 'overcast_volley');
      if (hood > 0) applyStatus(inst, p, m, resolveStatus({ kind: 'vulnerable', ms: 2500, pct: hood, skills: ['overcast_volley'] }, p.ctx.powers.index), x, y, 'overcast_hood');
    }
  }
}

// ─────────────────────────── R10 Quarry Mark (cooldown, mark) ───────────────────────────

function quarryMark(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  if (quarryOf(inst, p)) return false; // "no living mark": the auto filter, also for manual casts (nothing to do)
  const q = strongestMob(inst, p.x, p.y, rt.def.range);
  if (!q) return false;
  face(p, q.x);
  const long = rt.flags.has('markLong');
  const pct = (long ? 15 : 20) + rv(rt, 'markPctAdd');
  setQuarry(inst, p, q, pct, long ? Infinity : inst.t + skillDurationMs(rt));
  const two = rv(rt, 'markTwo');
  const st = rstate(p);
  st.quarry2 = 0;
  if (two > 0) {
    const q2 = strongestMob(inst, p.x, p.y, rt.def.range, (o) => o === q);
    if (q2) { st.quarry2 = q2.id; st.quarry2Pct = pct * two / 100; rangerMark(inst, p, q2, 1000, st.quarry2Pct); }
  }
  // Falcon Strike: a falcon stoops on the quarry for 500 % weapon damage (a Beast attack).
  if (rt.flags.has('markDive')) {
    inst.emit({ e: 'aoe', v: 'falcon_dive', x: Math.round(q.x), y: Math.round(q.y), r: 60, d: 450, el: 0, s: p.id, delay: 240 }, q.x, q.y, p.id);
    inst.sched.schedule(inst.t + 240, () => { if (inst.playerById(p.id) && !q.dead) beastHit(inst, p, q, strikeOf(p, rt, 5), null); });
  }
  huntingCall(inst, p, q);
  noteSpend(inst, p, skillCost(p, rt));
  emitCast(inst, p, rt, q.x, q.y);
  return true;
}

/** Hunting Call (Companion node): companions leap to the target of Quarry Mark / Murmuration. */
export function huntingCall(inst: Instance, p: Player, m: Mob) {
  const leap = rv(p.ctx.modsOf('companion'), 'compLeap');
  if (leap <= 0) return;
  for (const s of p.summons) {
    if (s.skill !== 'companion' || s.dead) continue;
    const a = Math.atan2(s.y - m.y, s.x - m.x);
    s.x = m.x + Math.cos(a) * (m.r + 18); s.y = m.y + Math.sin(a) * (m.r + 18);
    s.targetId = m.id; s.attackSeq++; s.attackFlagMs = 250;
    inst.emit({ e: 'aoe', v: 'falcon_dive', x: Math.round(m.x), y: Math.round(m.y), r: 40, d: 300, el: 0, s: s.id }, m.x, m.y, p.id);
    beastHit(inst, p, m, { skill: 'companion', coef: leap / 100, el: 'physical', pct: 0, mult: 1, ...companionBase(p) }, s);
  }
}
/** The companion skill's strike (bucket and own multiplier) for Hunting Call; ranger.ts registers the real builder. */
export const companionBase = (p: Player): Partial<Strike> => { const rt = p.ctx.modsOf('companion'); const st = strikeOf(p, rt); return { el: st.el, pct: st.pct, mult: st.mult }; };

// ─────────────────────────── R11 Pitch Mortar (device) ───────────────────────────

interface MortarState { shots: number }
const mortars = new WeakMap<Summon, MortarState>();
const mortarOf = (s: Summon) => { let m = mortars.get(s); if (!m) { m = { shots: 0 }; mortars.set(s, m); } return m; };

function pitchMortar(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const s = spawnSummon(inst, p, 'mortar', 'pitch_mortar', p.x, p.y + 6, skillDurationMs(rt));
  s.fireMs = 600;
  trimSummons(p, 'pitch_mortar', maxSummonsOf(rt));
  noteSpend(inst, p, skillCost(p, rt));
  noteCast(p, rt);
  emitCast(inst, p, rt, s.x, s.y);
  return true;
}

/** A target point 120–500 units from the mortar: the quarry or held enemies with Spotter, else the densest group. */
function mortarAim(inst: Instance, p: Player, s: Summon, rt: SkillRuntime, radius: number, not?: { x: number; y: number }): { x: number; y: number } | null {
  const ok = (x: number, y: number) => { const d = Math.hypot(x - s.x, y - s.y); return d >= 120 && d <= rt.def.range && (!not || Math.hypot(x - not.x, y - not.y) > radius * 1.5); };
  if (rt.flags.has('mortarSpotter')) {
    const q = quarryOf(inst, p);
    if (q && ok(q.x, q.y)) return q;
    const held = nearestMob(inst, s.x, s.y, rt.def.range, (o) => o.stunMs <= 0 || !ok(o.x, o.y));
    if (held) return held;
  }
  const bp = bestPoint(inst, s.x, s.y, rt.def.range, radius);
  if (bp && ok(bp.x, bp.y)) return bp;
  const far = inst.queryMobs(s.x, s.y, rt.def.range).find((m) => !m.dead && ok(m.x, m.y));
  return far ?? null;
}

function mortarAi(inst: Instance, s: Summon, p: Player, dtMs: number, dtS: number) {
  const rt = p.ctx.modsOf('pitch_mortar');
  // Sled Mount: the Mortar follows you (within 200 units) but fires slower while it moves.
  const sled = rv(rt, 'mortarFollow');
  if (sled > 0) {
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d > 200) moveSummon(inst, s, p.x, p.y, 320, dtS, 120); else s.moving = false;
  }
  if (s.lifeMs <= dtMs && s.aux !== 9) { s.aux = 9; if (rt.flags.has('deviceFinale')) mortarFire(inst, p, s, rt); return; } // Coiled Wire Bracers
  s.fireMs -= dtMs * deviceRate(rt) * (rt.flags.has('mortarSpotter') ? 1.3 : 1) * (s.moving && sled > 0 ? 1 - sled / 100 : 1);
  if (s.fireMs > 0) return;
  if (!mortarFire(inst, p, s, rt)) { s.fireMs = 200; return; }
  s.fireMs += 2000;
  if (s.fireMs < 0) s.fireMs = 0;
}

function mortarFire(inst: Instance, p: Player, s: Summon, rt: SkillRuntime): boolean {
  const ms = mortarOf(s);
  let radius = skillRadius(rt);
  const heavy = rv(rt, 'mortarHeavy') > 0 && (ms.shots + 1) % 4 === 0; // Overpressure: every 4th shell
  if (heavy) radius *= 2;
  const tgt = mortarAim(inst, p, s, rt, radius);
  if (!tgt) return false;
  ms.shots++;
  lobShell(inst, p, s, rt, tgt.x, tgt.y, radius, heavy ? 1 + rv(rt, 'mortarHeavy') / 100 : 1);
  // Walking Fire: a second shell at another group at once.
  if (inst.rng.next() * 100 < rv(rt, 'mortarDouble')) {
    const t2 = mortarAim(inst, p, s, rt, skillRadius(rt), tgt);
    if (t2) lobShell(inst, p, s, rt, t2.x, t2.y, skillRadius(rt), 1);
  }
  return true;
}

function lobShell(inst: Instance, p: Player, s: Summon, rt: SkillRuntime, x: number, y: number, radius: number, scale: number) {
  faceTo(s, x);
  s.attackSeq++; s.attackFlagMs = 300;
  const fly = RANGER_FX.mortarFlightMs;
  inst.emit({ e: 'aoe', v: 'mortar_shot', x: Math.round(x), y: Math.round(y), r: Math.round(radius), d: fly, el: elIdx(strikeOf(p, rt).el), s: s.id }, x, y, p.id);
  const bounce = rt.flags.has('mortarBounce'), fuse = rt.flags.has('fuseBounce'); // Skipping Shell / Fuse-Burnt Boots
  const ang = Math.atan2(y - s.y, x - s.x), bx = x + Math.cos(ang) * 80, by = y + Math.sin(ang) * 80;
  inst.sched.schedule(inst.t + fly, () => {
    if (!inst.playerById(p.id)) return;
    if (bounce) { shellImpact(inst, p, s, rt, x, y, radius, scale * 0.7); inst.sched.schedule(inst.t + 250, () => { if (inst.playerById(p.id)) shellImpact(inst, p, s, rt, bx, by, radius, scale * 0.7); }); }
    else if (fuse) inst.sched.schedule(inst.t + 250, () => { if (inst.playerById(p.id)) shellImpact(inst, p, s, rt, bx, by, radius, scale); });
    else shellImpact(inst, p, s, rt, x, y, radius, scale);
  });
}

function shellImpact(inst: Instance, p: Player, s: Summon, rt: SkillRuntime, x: number, y: number, radius: number, scale: number) {
  const st: Strike = { ...strikeOf(p, rt, rt.def.coef * scale), src: s.id };
  const freeze = rt.flags.has('mortarFreeze'), grape = rt.flags.has('mortarGrape');
  inst.emit({ e: 'aoe', v: 'mortar_impact', x: Math.round(x), y: Math.round(y), r: Math.round(radius), d: 420, el: elIdx(st.el), s: s.id }, x, y, p.id);
  let hit = 0;
  for (const m of inst.queryMobs(x, y, radius)) {
    if (m.dead) continue;
    hit++;
    deviceHit(inst, p, m, st);
    if (freeze && !m.dead) freezeMob(m, 1000, 0, 0, inst, p);
  }
  const gen = rv(rt, 'mortarGen'); if (gen > 0 && hit >= 3) gainResource(p, gen);
  if (grape) {
    for (let i = 0; i < 5; i++) spawnProj(inst, { kind: 'shard', v: 'pellet', owner: p, src: s.id, x, y, angle: (i * Math.PI * 2) / 5 + inst.rng.next() * 0.4, speed: 700, lifeMs: 400, r: 8, el: st.el, strike: { ...st, coef: st.coef * 0.6 }, reach: 260 });
  } else if (!freeze) {
    const g = placeGround(inst, p, 'pitch_fire', x, y, 0, radius / 100);
    // Tar Pit: the pitch slows the enemies in it (its live radius: Tar-Stained Jerkin may grow it).
    const tar = rv(rt, 'mortarSlow');
    if (g && tar > 0) slowPulse(inst, p, () => (g.endT > inst.t ? { x: g.x, y: g.y, r: g.r } : null), tar, g.endT, 'pitch_mortar');
  }
  const powder = rv(rt, 'powderHorn'); if (powder > 0 && inst.rng.next() * 100 < powder) placeGround(inst, p, 'powder_patch', x, y, 0, 1);
}

// ─────────────────────────── R12 Murmuration (cooldown, beast) ───────────────────────────

interface FlockState { pct: number; stoopMs: number; arcMs: number; growMs: number; r0: number; wpMs: number; tx: number; ty: number; feast: number }
const flocks = new WeakMap<Summon, FlockState>();

function murmuration(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  const bp = bestPoint(inst, p.x, p.y, rt.def.range, radius);
  if (!bp) return false;
  const dur = skillDurationMs(rt);
  const split = rt.flags.has('flockSplit'), guard = rt.flags.has('flockGuard');
  const pct = (split ? 0.6 : 1) * (guard ? 0.6 : 1);
  const n = split ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const s = spawnSummon(inst, p, 'flock', 'murmuration', p.x + (i ? 30 : 0), p.y - 20, dur);
    s.r = Math.round(radius * (split ? 0.7 : 1));
    flocks.set(s, { pct, stoopMs: 2000, arcMs: 500, growMs: 2000, r0: s.r, wpMs: i * 500, tx: bp.x, ty: bp.y, feast: 0 });
  }
  if (guard) {
    const g = spawnSummon(inst, p, 'flock_guard', 'murmuration', p.x, p.y, dur);
    g.r = 60;
    addBuff(p, { id: 'starling_shield', ms: dur, dr: 25 });
  }
  addBuff(p, { id: 'murmuration', ms: dur, hidden: true });
  rstate(p).flockElites = 0; rstate(p).flockFeastMs = 0;
  const q = quarryOf(inst, p);
  huntingCall(inst, p, q ?? bp.mob);
  emitCast(inst, p, rt, bp.x, bp.y, radius);
  return true;
}

function flockAi(inst: Instance, s: Summon, p: Player, dtMs: number, dtS: number) {
  const fs = flocks.get(s);
  if (!fs) { s.dead = true; return; }
  const rt = p.ctx.modsOf('murmuration');
  const rs = rstate(p);
  // Crowfeast: kills extend the flock (at most 5 s in total, shared by split flocks).
  if (rs.flockFeastMs > fs.feast) { s.lifeMs += rs.flockFeastMs - fs.feast; fs.feast = rs.flockFeastMs; }
  // Return to Roost: refund part of the cooldown per elite killed when it ends.
  if (s.lifeMs <= dtMs && s.aux !== 9) {
    s.aux = 9;
    const per = rv(rt, 'flockRefund');
    if (per > 0 && rs.flockElites > 0) reduceCooldowns(inst, p, skillCooldownMs(p, rt) * Math.min(50, per * rs.flockElites) / 100, null, 'murmuration');
    rs.flockElites = 0;
    if (!p.summons.some((o) => o !== s && o.type === 'flock' && !o.dead && o.lifeMs > dtMs)) { removeBuff(p, 'murmuration'); removeBuff(p, 'starling_shield'); }
  }
  // Waypoints: Pecking Order hunts the quarry / nearest elite; else the densest group near you, re-chosen every second.
  fs.wpMs -= dtMs;
  if (fs.wpMs <= 0) {
    fs.wpMs += 1000;
    let t: { x: number; y: number } | null = null;
    if (rt.flags.has('flockElite')) t = quarryOf(inst, p) ?? nearestMob(inst, p.x, p.y, rt.def.range, (o) => !isEliteTier(o.tier));
    t ??= bestPoint(inst, p.x, p.y, rt.def.range, s.r);
    if (t) { fs.tx = t.x; fs.ty = t.y; }
  }
  moveSummon(inst, s, fs.tx, fs.ty, 260, dtS, 10); // [P] flock speed 260 u/s, between the wolf (360) and a drifting storm
  // Gathering Flock: +10 % radius every 2 s up to the node's cap.
  const grow = rv(rt, 'flockGrow');
  if (grow > 0) {
    fs.growMs -= dtMs;
    if (fs.growMs <= 0) { fs.growMs += 2000; const r = Math.min(fs.r0 * (1 + grow / 100), s.r + fs.r0 * 0.1); if (r !== s.r) { s.r = Math.round(r); s.descVer++; } }
  }
  // Strikes: coef per second in four ticks.
  s.tickMs -= dtMs;
  if (s.tickMs <= 0) {
    s.tickMs += 250;
    const st: Strike = { ...strikeOf(p, rt, rt.def.coef / 4 * fs.pct), src: s.id };
    const q = rs.quarry;
    const feather = rv(rt, 'flockSlow'); // Feather Storm: enemies inside are slowed (refreshed by every tick)
    for (const m of inst.queryMobs(s.x, s.y, s.r)) {
      if (m.dead) continue;
      if (feather > 0) slowMob(inst, p, m, feather, 500, 'murmuration');
      let hit = beastStrike(inst, p, st, m);
      if (rt.flags.has('flockElite') && (m.id === q || isEliteTier(m.tier))) hit = { ...hit, mult: (hit.mult ?? 1) * 1.5 }; // Pecking Order
      strikeMob(inst, p, m, hit);
    }
  }
  // Stormbirds: every 0.5 s arcs to 2 enemies outside the flock (a flock tick's 50 % each, [P] from coef / 4).
  if (rt.flags.has('flockArc')) {
    fs.arcMs -= dtMs;
    if (fs.arcMs <= 0) {
      fs.arcMs += 500;
      let n = 0;
      for (const m of inst.queryMobs(s.x, s.y, s.r + 220)) {
        if (m.dead || n >= 2 || Math.hypot(m.x - s.x, m.y - s.y) <= s.r) continue;
        n++;
        inst.emit({ e: 'beam', v: 'flock_arc', x: Math.round(s.x), y: Math.round(s.y), tx: Math.round(m.x), ty: Math.round(m.y), el: elIdx('lightning'), d: 200 }, m.x, m.y, p.id);
        strikeMob(inst, p, m, beastStrike(inst, p, { ...strikeOf(p, rt, 0.5 * fs.pct), src: s.id }, m));
      }
    }
  }
  // Stoop: every 2 s on one enemy inside.
  const stoop = rv(rt, 'flockStoop');
  if (stoop > 0) {
    fs.stoopMs -= dtMs;
    if (fs.stoopMs <= 0) {
      fs.stoopMs += 2000;
      const m = strongestMob(inst, s.x, s.y, s.r);
      if (m) {
        inst.emit({ e: 'aoe', v: 'flock_stoop', x: Math.round(m.x), y: Math.round(m.y), r: 40, d: 350, el: 0, s: s.id }, m.x, m.y, p.id);
        strikeMob(inst, p, m, beastStrike(inst, p, { ...strikeOf(p, rt, stoop / 100 * fs.pct), src: s.id }, m));
      }
    }
  }
}

function flockGuardAi(inst: Instance, s: Summon, p: Player, _dtMs: number, dtS: number) {
  s.aux = (s.aux + 1) % 1000;
  const a = inst.t / 600;
  moveSummon(inst, s, p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 30, 400, dtS, 0);
}

// ─────────────────────────── Registration ───────────────────────────

export const RANGER_M1_BEHAVIOURS: Record<string, SkillBehaviour> = {
  skipstone_bolt: { primary: skipstone },
  spring_snare: { cast: springSnare },
  overcast_volley: { cast: overcastVolley },
  quarry_mark: { cast: quarryMark },
  pitch_mortar: { cast: pitchMortar },
  murmuration: { cast: murmuration },
};

export const RANGER_M1_SUMMONS: Record<string, SummonBehaviour> = {
  snare: { radius: 14, actsWhileOwnerDead: true, update: snareAi },
  mortar: { radius: 18, actsWhileOwnerDead: true, update: mortarAi },
  flock: { radius: 120, flies: true, actsWhileOwnerDead: true, update: flockAi },
  flock_guard: { radius: 60, flies: true, update: flockGuardAi },
};

/** Shared for tests and the parity harness. */
export { hasTag, rmob, gather };
