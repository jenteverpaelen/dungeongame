// Ranger skill behaviour (server authority). Data: shared/src/data/skills/ranger.ts.
// Tracking Arrow (hungering_arrow), Sentry (+ turret AI and Arc Line), Multishot, Burst Arrow (cluster_arrow), Arrowfall
// (rain_of_vengeance), Companion (+ wolf / bat / raven / badger / heron AI and Pack Leader), with the ranger wave's runes 4–5,
// specialization nodes and item / set flags (RANGER.md bible v2). New skills: ./rangerM1.ts; shared state: ./rangerKit.ts.

import { PLAYER_RADIUS } from '../../shared';
import { bestConeAngle, bestPoint, pickTarget, summonCount } from '../brain';
import { gainResource, isEliteTier, strikeMob } from '../damage';
import { addBuff, chillMob, distToSegment, elIdx, freezeMob, getBuff, knockbackMob, removeBuff, stunMob } from '../effects';
import { addGround, newGround } from '../grounds';
import { placeGround } from '../groundFx';
import type { Instance } from '../instance';
import { maxSummonsOf, skillCost, skillDurationMs, skillElement, skillMult, skillPct, skillRadius } from '../playerctx';
import { resolveStatus } from '../powerRuntime';
import { spawnProj } from '../projectiles';
import { applyStatus } from '../status';
import { moveSummon, spawnSummon } from '../summons';
import {
  PB_CHILL, PB_DEVOUR, PB_MARK, PB_NOGRENADE, PB_ROCKETS, PB_SPLIT,
  type Ground, type Mob, type Player, type Proj, type ProjHooks, type SkillRuntime, type Strike, type Summon,
} from '../types';
import {
  DEG, emitCast, face, faceTo, fanAngles, strikeOf, trimSummons,
  type OwnerSummonHook, type SkillBehaviour, type SummonBehaviour,
} from './common';
import {
  barVar, beastHit, beastRate, deviceHit, deviceRate, isRanger, nearestMob, noteCast, noteSpend, quarryOf, rangerTick,
  rmob, rstate, rv, spot, summonTarget,
} from './rangerKit';
import { farwatchShot, freeCasts, huntingCall, skimRipple, splinters, triggerSnare } from './rangerM1';

// ─────────────────────────── Piercing projectile hooks (Featherguard, Skimmer's, Quiver, spotting, Farwatch 2) ───────────────────────────

/** Hooks for a Piercing projectile of `rt`: compounding per pass, ripples, spotting, splinters at the last enemy hit. */
function piercingHooks(inst: Instance, p: Player, rt: SkillRuntime, extra?: ProjHooks): ProjHooks | undefined {
  const fg = rv(rt, 'featherguard'), skim = rv(rt, 'skimmer'), spl = rv(rt, 'splinters'), spotting = rt.flags.has('spotting');
  if (!fg && !skim && !spl && !spotting && !extra) return undefined;
  let passes = 0, last: Mob | null = null;
  return {
    pre: (i, pr, m, st) => {
      const s = extra?.pre ? extra.pre(i, pr, m, st) : st;
      return fg && passes > 0 ? { ...s, mult: (s.mult ?? 1) * (1 + fg / 100) ** Math.min(3, passes) } : s;
    },
    post: (i, pr, m, through) => {
      last = m;
      if (through) {
        passes++;
        if (spotting && !m.dead) spot(i, p, m);
        if (skim && !m.dead) skimRipple(i, p, m, skim);
      }
      extra?.post?.(i, pr, m, through);
    },
    end: (i, pr, hit) => {
      if (spl && last && pr.strike) splinters(i, p, last, spl, pr.strike, pr.hits ?? new Set());
      extra?.end?.(i, pr, hit);
    },
  };
}

// ─────────────────────────── Tracking Arrow (primary) ───────────────────────────

function hungeringArrow(inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob) {
  const rs = rstate(p);
  rs.lastShot = tgt.id;
  let n = 1 + (rt.mods.projectiles ?? 0);
  // Split Feathers: every Nth arrow fires 2 extra arrows in a narrow fan.
  const every = rv(rt, 'haEvery');
  rs.arrows++;
  if (every > 0 && rs.arrows % Math.max(2, Math.round(every)) === 0) n += 2;
  const base = Math.atan2(tgt.y - p.y, tgt.x - p.x);
  const st: Strike = { ...strikeOf(p, rt), primary: true };
  const mark = rt.flags.has('huntersMark');
  const pierce = mark ? 1 : Math.min(1, (35 + (rt.mods.pierce ?? 0)) / 100);
  let bits = 0;
  if (rt.flags.has('splitOnPierce')) bits |= PB_SPLIT;
  if (rt.flags.has('devouring')) bits |= PB_DEVOUR;
  if (mark) bits |= PB_MARK;
  const turn = 6 * (1 + rv(rt, 'haTurn') / 100);
  const reach = rt.def.range * (1 + rv(rt, 'haRange') / 100);
  const fire = (angle: number, target: Mob) => spawnProj(inst, {
    kind: 'arrow', v: 'arrow', owner: p, src: p.id, x: p.x, y: p.y - 4, angle, speed: 900, lifeMs: 820 * reach / rt.def.range, r: 12,
    el: st.el, strike: st, pierce, homing: target.id, turn, seek: true, bits, reach, hooks: arrowHooks(inst, p, rt),
  });
  for (const off of fanAngles(n, 10 * DEG)) fire(base + off, tgt);
  // Hawkfeather Cap: also a second target.
  if (rt.flags.has('hawkfeather')) {
    const second = nearestMob(inst, tgt.x, tgt.y, rt.def.range, (o) => o === tgt);
    if (second) fire(Math.atan2(second.y - p.y, second.x - p.x), second);
  }
  if (noteCast(p, rt)) farwatchShot(inst, p, rt, base);
  gainResource(p, rt.def.gen + (rt.mods.gen ?? 0));
  emitCast(inst, p, rt, tgt.x, tgt.y);
}

/** Tracking Arrow's per-arrow hooks: Hunger Pangs, Fletchling Swarm, Barbed Shaft, Farwatch 2's guaranteed pierce. */
function arrowHooks(inst: Instance, p: Player, rt: SkillRuntime): ProjHooks | undefined {
  const pangs = rv(rt, 'haPierceGen'), darts = rt.flags.has('haDarts'), bleed = rt.flags.has('haBleed'), extraPierce = rv(rt, 'morePierce');
  let gained = 0, free = extraPierce;
  const own: ProjHooks | undefined = pangs || darts || bleed || extraPierce ? {
    pre: (_i, pr, _m, st) => { if (free > 0 && pr.pierce < 1) { free--; pr.pierce += 2; (pr as Proj & { _fp?: number })._fp = 1; } return st; },
    post: (i, pr, m, through) => {
      const fp = (pr as Proj & { _fp?: number })._fp; if (fp) { pr.pierce -= 2; (pr as Proj & { _fp?: number })._fp = 0; }
      if (through && pangs > 0 && gained < pangs) { gained++; gainResource(p, 1); }
      if (bleed && !m.dead) applyStatus(i, p, m, resolveStatus({ kind: 'bleed', ms: 3000, coef: 0.6 }, p.ctx.powers.index), p.x, p.y, 'hungering_arrow');
      if (darts && inst.rng.next() < 0.3) for (let k = 0; k < 2; k++) {
        spawnProj(i, { kind: 'shard', v: 'dart', owner: p, src: p.id, x: m.x, y: m.y, angle: inst.rng.next() * Math.PI * 2, speed: 700, lifeMs: 600, r: 8, el: pr.el,
          strike: { ...pr.strike!, coef: 0.4, primary: false, noProc: true }, seek: true, turn: 10, homing: nearestMob(i, m.x, m.y, 300, (o) => o === m)?.id ?? 0, hits: new Set([m.id]), reach: 360 });
      }
    },
  } : undefined;
  return piercingHooks(inst, p, rt, own);
}

// ─────────────────────────── Sentry ───────────────────────────

function sentry(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  let x = p.x, y = p.y;
  // Watchtower: built 120 units toward the densest pack.
  if (rt.flags.has('sentryForward')) {
    const bp = bestPoint(inst, p.x, p.y, rt.def.range, 120);
    if (bp) { const d = Math.hypot(bp.x - p.x, bp.y - p.y), k = Math.min(120, d) / Math.max(1, d), tx = p.x + (bp.x - p.x) * k, ty = p.y + (bp.y - p.y) * k; if (inst.cw.isFree(tx, ty, 12)) { x = tx; y = ty; } }
  }
  // keep turrets slightly apart so chains have length
  for (const s of p.summons) {
    if (s.type !== 'sentry' || s.dead) continue;
    if (Math.hypot(s.x - x, s.y - y) < 40) {
      const a = inst.rng.next() * Math.PI * 2;
      const tx = x + Math.cos(a) * 46, ty = y + Math.sin(a) * 46;
      if (inst.cw.isFree(tx, ty, 12)) { x = tx; y = ty; }
      break;
    }
  }
  spawnSummon(inst, p, 'sentry', 'sentry', x, y, skillDurationMs(rt));
  trimSummons(p, 'sentry', maxSummonsOf(rt));
  noteSpend(inst, p, skillCost(p, rt));
  noteCast(p, rt);
  emitCast(inst, p, rt, x, y);
  return true;
}

/** One Sentry bolt (or a finale / salvo bolt) at `tgt`. */
function sentryBolt(inst: Instance, p: Player, s: Summon, rt: SkillRuntime, tgt: Mob, coef = rt.def.coef) {
  const el = skillElement(rt);
  let mult = skillMult(p, 'sentry');
  // Crossfire: enemies hit by 2+ Sentries within 1 s take more from Sentries.
  const cross = rv(rt, 'sentryCross');
  if (cross > 0) { const hits = rmob(tgt).sentryHits; for (const [id, t] of hits) if (id !== s.id && inst.t - t <= 1000) { mult *= 1 + cross / 100; break; } }
  const q = quarryOf(inst, p);
  if (q === tgt) { const snipe = rv(rt, 'sentrySnipe'); if (snipe > 0) mult *= 1 + snipe / 100; }
  const st: Strike = { skill: 'sentry', coef, el, pct: skillPct(p, rt), mult, src: s.id };
  const gen = rv(rt, 'sentryGen');
  const arbalest = rt.flags.has('arbalest');
  const pierceOnce = rt.flags.has('sentryPierce');
  let hitsLeft = arbalest ? Infinity : pierceOnce ? 2 : 1;
  const hooks: ProjHooks = {
    post: (i, pr, m) => {
      rmob(m).sentryHits.set(s.id, i.t);
      if (gen > 0 && isEliteTier(m.tier)) gainResource(p, gen);
      if (--hitsLeft <= 0) pr.lifeMs = 0;
    },
    end: (i, pr) => {
      // Bolt-Thrower's Arbalest: bursts on its final target (radius 60).
      if (arbalest) { i.emit({ e: 'aoe', v: 'mortar_impact', x: Math.round(pr.x), y: Math.round(pr.y), r: 60, d: 300, el: elIdx(el), s: s.id }, pr.x, pr.y, p.id); for (const o of i.queryMobs(pr.x, pr.y, 60)) if (!o.dead) deviceHit(i, p, o, { ...st, noProc: true }); }
    },
  };
  spawnProj(inst, {
    kind: hitsLeft > 1 ? 'multi' : 'bolt', v: 'bolt', owner: p, src: s.id, x: s.x, y: s.y - 20, angle: Math.atan2(tgt.y - (s.y - 20), tgt.x - s.x), speed: 1000,
    lifeMs: 750, r: 10, el, homing: tgt.id, turn: 4, strike: st, bits: rt.flags.has('chill') ? PB_CHILL : 0, hits: hitsLeft > 1 ? new Set() : null,
    reach: Math.hypot(tgt.x - s.x, tgt.y - s.y) + 200, hooks,
  });
}

function sentryAi(inst: Instance, s: Summon, p: Player, dtMs: number) {
  const rt = p.ctx.modsOf('sentry');
  // Last Barrage / Coiled Wire Bracers: an expiring Sentry fires a final barrage.
  if (s.lifeMs <= dtMs && s.aux !== 9) {
    s.aux = 9;
    const n = Math.max(rv(rt, 'sentryFinale'), rt.flags.has('deviceFinale') ? 4 : 0); // [P] the bracers' "final salvo" = Last Barrage rank 1
    for (let i = 0; i < n; i++) { const t = summonTarget(inst, p, s.x, s.y, rt.def.radius, true, true); if (t) sentryBolt(inst, p, s, rt, t); }
    return;
  }
  // Fire rate: Gearwright's Heart, Fuse Cord Belt, Cog Linkage (per other Sentry within 200).
  let rate = (1 + rv(rt, 'sentryFast') / 100) * deviceRate(rt);
  const link = rv(rt, 'sentryLink');
  if (link > 0) { let k = 0; for (const o of p.summons) if (o !== s && o.type === 'sentry' && !o.dead && Math.hypot(o.x - s.x, o.y - s.y) <= 200) k++; rate *= 1 + link * k / 100; }
  s.fireMs -= dtMs;
  if (s.fireMs <= 0) {
    // Shared Optics: fire at your quarry from up to 900 units.
    const q = rv(rt, 'sentrySnipe') > 0 ? quarryOf(inst, p) : null;
    const tgt = q && Math.hypot(q.x - s.x, q.y - s.y) <= 900 ? q : summonTarget(inst, p, s.x, s.y, rt.def.radius, true, true);
    if (!tgt) { s.fireMs = 150; }
    else {
      s.fireMs += 1000 / rate;
      if (s.fireMs < 0) s.fireMs = 0;
      faceTo(s, tgt.x);
      s.attackSeq++;
      s.attackFlagMs = 200;
      if (rt.flags.has('sentryFlame')) sentryFlame(inst, p, s, rt, tgt);
      else sentryBolt(inst, p, s, rt, tgt);
    }
  }
  if (rt.flags.has('rockets')) {
    s.rocketMs -= dtMs;
    if (s.rocketMs <= 0) {
      const tgt = summonTarget(inst, p, s.x, s.y, rt.def.range, false, true);
      if (!tgt) s.rocketMs = 200;
      else {
        s.rocketMs += 1500 / deviceRate(rt);
        fireRocket(inst, p, s, tgt, 1.2, 'sentry');
      }
    }
  }
}

/** Flame Lance: a 60° flame jet, 150 units, instead of a bolt. */
function sentryFlame(inst: Instance, p: Player, s: Summon, rt: SkillRuntime, tgt: Mob) {
  const ang = Math.atan2(tgt.y - s.y, tgt.x - s.x);
  inst.emit({ e: 'aoe', v: 'sentry_flame', x: Math.round(s.x), y: Math.round(s.y - 16), r: 150, d: 350, el: elIdx(skillElement(rt)), s: s.id, a: +ang.toFixed(3) }, s.x, s.y, p.id);
  const st: Strike = { skill: 'sentry', coef: rt.def.coef, el: skillElement(rt), pct: skillPct(p, rt), mult: skillMult(p, 'sentry'), src: s.id };
  for (const m of inst.queryMobs(s.x, s.y, 150)) {
    if (m.dead) continue;
    let d = Math.atan2(m.y - s.y, m.x - s.x) - ang;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) <= 30 * DEG) deviceHit(inst, p, m, st);
  }
}

function fireRocket(inst: Instance, p: Player, s: Summon, tgt: Mob, coef: number, skill: string) {
  const rt = p.ctx.modsOf(skill);
  const a = Math.atan2(tgt.y - s.y, tgt.x - s.x) + (inst.rng.next() - 0.5) * 1.2;
  spawnProj(inst, {
    kind: 'rocket', v: 'rocket', owner: p, src: s.id, x: s.x, y: s.y - 24, angle: a, speed: 620, lifeMs: 1600, r: 12, el: 'fire',
    homing: tgt.id, turn: 5, seek: true,
    strike: { skill, coef, el: 'fire', pct: skillPct(p, rt), mult: skillMult(p, skill), src: s.id },
  });
}

// ─────────────────────────── Multishot ───────────────────────────

function multishotTarget(inst: Instance, p: Player, range: number, ox = p.x, oy = p.y): { ang: number; x: number; y: number } | null {
  const ang = bestConeAngle(inst, ox, oy, range, 35 * DEG);
  if (ang === null) return null;
  const t = pickTarget(inst, ox, oy, range, false, p.save.skills.targetPriority);
  const d = t ? Math.min(range, Math.hypot(t.x - ox, t.y - oy)) : range * 0.7;
  return { ang, x: ox + Math.cos(ang) * d, y: oy + Math.sin(ang) * d };
}

/** One volley. `scale`: damage factor (Siegebreaker 4 copies 20 %, Rolling Volley); `frac`: share of the arrows. */
function fireMultishot(inst: Instance, p: Player, rt: SkillRuntime, ox: number, oy: number, ang: number, src: number, scale = 1, frac = 1) {
  const n = Math.max(1, Math.round((9 + (rt.mods.projectiles ?? 0)) * frac));
  const spread = (rt.flags.has('multiWide') ? 180 : 70) * DEG;
  const base = strikeOf(p, rt);
  const st: Strike = { ...base, coef: base.coef * scale, src };
  const hits = new Set<number>();
  const push = rt.flags.has('multiPush'), gen = rt.flags.has('multiGen'), bandolier = rt.flags.has('bandolier');
  const ric = rv(rt, 'multiRicochet');
  let gained = 0, banked = 0;
  const own: ProjHooks = {
    post: (i, _pr, m) => {
      if (push && !m.dead) knockbackMob(m, m.x - ox, m.y - oy, 40, i, p);
      if (gen && gained < 10) { gained++; gainResource(p, 1); }
      if (bandolier && banked < 5) { banked += 0.5; gainResource(p, 0.5); }
    },
    // Ricochet Fletch: an arrow that reaches its maximum range or a wall ricochets once at the node's damage.
    end: (i, pr, hit) => {
      if (!ric || hit || (pr as Proj & { _ric?: 1 })._ric) return;
      const t = nearestMob(i, pr.x, pr.y, 360, (o) => hits.has(o.id));
      if (!t) return;
      const q = spawnProj(i, { kind: 'multi', v: 'arrow', owner: p, src, x: pr.x, y: pr.y, angle: Math.atan2(t.y - pr.y, t.x - pr.x), speed: 1150, lifeMs: 420, r: 14, el: st.el,
        strike: { ...st, coef: st.coef * ric / 100 }, pierce: 1, hits, reach: 380 });
      (q as Proj & { _ric?: 1 })._ric = 1;
    },
  };
  for (let i = 0; i < n; i++) {
    const a = ang - spread / 2 + (spread * i) / Math.max(1, n - 1);
    spawnProj(inst, {
      kind: 'multi', v: 'arrow', owner: p, src, x: ox, y: oy - 4, angle: a, speed: 1150, lifeMs: 560, r: 14, el: st.el,
      strike: st, pierce: 1, hits, hooks: piercingHooks(inst, p, rt, own),
    });
  }
  // Thrifty Nock: a volley that hits 5+ enemies refunds Hatred (checked when the arrows have flown).
  const refund = rv(rt, 'multiRefund');
  if (refund > 0 && scale === 1) inst.sched.schedule(inst.t + 600, () => { if (hits.size >= 5 && inst.playerById(p.id)) gainResource(p, refund); });
  if (rt.flags.has('rockets')) {
    const near = inst.queryMobs(ox, oy, rt.def.range).filter((m) => !m.dead);
    const tithe = rv(rt, 'multiRocketElite');
    const elites = tithe > 0 ? near.filter((m) => isEliteTier(m.tier)) : [];
    for (let i = 0; i < 3; i++) {
      const pool = elites.length ? elites : near;
      const t = pool.length ? pool[Math.floor(inst.rng.next() * pool.length)] : null;
      const elite = t && tithe > 0 && isEliteTier(t.tier);
      spawnProj(inst, {
        kind: 'rocket', v: 'rocket', owner: p, src, x: ox, y: oy - 10, angle: ang + (i - 1) * 0.5, speed: 680, lifeMs: 1400, r: 12, el: 'fire',
        strike: { ...st, coef: 3.0 * scale, el: 'fire', mult: (st.mult ?? 1) * (elite ? 1 + tithe / 100 : 1) }, homing: t ? t.id : 0, turn: 5, seek: true,
      });
    }
  }
}

function multishot(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const t = multishotTarget(inst, p, rt.def.range);
  if (!t) return false;
  face(p, t.x);
  fireMultishot(inst, p, rt, p.x, p.y, t.ang, p.id);
  // Rolling Volley: 40 % of the arrows again 0.25 s later.
  const echo = rv(rt, 'multiEcho');
  if (echo > 0) inst.sched.schedule(inst.t + 250, () => { if (inst.playerById(p.id)) fireMultishot(inst, p, rt, p.x, p.y, t.ang, p.id, echo / 100, 0.4); });
  deviceCopies(inst, p, rt, t.x, t.y);
  noteSpend(inst, p, skillCost(p, rt));
  if (noteCast(p, rt)) farwatchShot(inst, p, rt, t.ang);
  emitCast(inst, p, rt, t.x, t.y);
  return true;
}

/** Siegebreaker 4: your Sentries and Pitch Mortars also fire your Projectile Spender (20 % damage). */
function deviceCopies(inst: Instance, p: Player, rt: SkillRuntime, tx: number, ty: number) {
  const dev = p.ctx.modsOf('sentry').flags.has('deviceCasts') || p.ctx.modsOf('pitch_mortar').flags.has('deviceCasts');
  if (!dev) return;
  for (const s of p.summons) {
    if ((s.type !== 'sentry' && s.type !== 'mortar') || s.dead || Math.hypot(tx - s.x, ty - s.y) > rt.def.range) continue;
    s.attackSeq++; s.attackFlagMs = 200;
    freeCast(inst, p, rt, s.x, s.y, 0.2, s.id, tx, ty);
  }
}

/** Cast a Projectile Spender from (x, y) at a damage scale (device copies, the farwatch shot). */
function freeCast(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, scale: number, src: number, tx?: number, ty?: number) {
  if (rt.def.id === 'multishot') {
    const t = tx !== undefined ? { ang: Math.atan2(ty! - y, tx - x) } : multishotTarget(inst, p, rt.def.range, x, y);
    if (t) fireMultishot(inst, p, rt, x, y, t.ang, src, scale);
  } else if (rt.def.id === 'cluster_arrow') {
    const bp = tx !== undefined ? { x: tx + (inst.rng.next() - 0.5) * 40, y: ty! + (inst.rng.next() - 0.5) * 40 } : bestPoint(inst, x, y, rt.def.range, skillRadius(rt));
    if (bp) lobCluster(inst, p, rt, x, y, bp.x, bp.y, src, scale);
  }
}
freeCasts.at = (inst, p, rt, x, y, scale, src) => freeCast(inst, p, rt, x, y, scale, src);

// ─────────────────────────── Burst Arrow (cluster_arrow) ───────────────────────────

interface ClusterCast { daisy: number; thrift: boolean; scale: number }
const clusterCasts = new WeakMap<Strike, ClusterCast>();

function lobCluster(inst: Instance, p: Player, rt: SkillRuntime, ox: number, oy: number, tx: number, ty: number, src: number, scale = 1) {
  const d = Math.max(20, Math.hypot(tx - ox, ty - oy));
  let bits = 0;
  if (rt.flags.has('noGrenades')) bits |= PB_NOGRENADE;
  if (rt.flags.has('rockets')) bits |= PB_ROCKETS;
  const base = strikeOf(p, rt);
  const st: Strike = { ...base, coef: base.coef * scale, src };
  clusterCasts.set(st, { daisy: 0, thrift: false, scale });
  // Barrel Bomb: rolls in, leaving 3 small blasts (50 % each) along the last 120 units before it detonates.
  if (rt.flags.has('clusterRoll')) {
    const ang = Math.atan2(ty - oy, tx - ox);
    for (let i = 0; i < 3; i++) {
      const k = 120 - i * 40, bx = tx - Math.cos(ang) * k, by = ty - Math.sin(ang) * k;
      inst.sched.schedule(inst.t + 450 - (3 - i) * 60, () => {
        if (!inst.playerById(p.id)) return;
        inst.emit({ e: 'aoe', v: 'barrel_blast', x: Math.round(bx), y: Math.round(by), r: 50, d: 300, el: elIdx(st.el), s: src }, bx, by, p.id);
        for (const m of inst.queryMobs(bx, by, 50)) if (!m.dead) strikeMob(inst, p, m, { ...st, coef: st.coef * 0.5, noProc: true });
      });
    }
  }
  spawnProj(inst, {
    kind: 'cluster', v: 'cluster', owner: p, src, x: ox, y: oy, angle: Math.atan2(ty - oy, tx - ox), speed: d / 0.45, lifeMs: 450,
    r: 10, el: skillElement(rt), strike: st, tx, ty, bits,
  });
}

/** Burst Arrow detonation (called when the lobbed arrow lands). Fuse-Burnt Boots: one bounce first. */
export function clusterExplode(inst: Instance, pr: Proj) {
  const p = pr.owner;
  if (!p || !pr.strike || !inst.playerById(p.id)) return;
  const rt = p.ctx.modsOf('cluster_arrow');
  if (rt.flags.has('fuseBounce') && !(pr.bits & 1 << 30)) {
    const ang = Math.atan2(pr.vy, pr.vx), bx = pr.x + Math.cos(ang) * 80, by = pr.y + Math.sin(ang) * 80;
    const q = { ...pr, x: bx, y: by, bits: pr.bits | 1 << 30 } as Proj;
    inst.sched.schedule(inst.t + 250, () => clusterExplode(inst, q));
    return;
  }
  const radius = skillRadius(rt);
  const st = pr.strike;
  const cc = clusterCasts.get(st) ?? { daisy: 0, thrift: false, scale: 1 };
  const concuss = rv(rt, 'clusterConcuss');
  for (const m of inst.queryMobs(pr.x, pr.y, radius)) {
    if (m.dead) continue;
    strikeMob(inst, p, m, st);
    clusterEliteHit(p, rt, m, cc);
    if (concuss > 0 && !m.dead) { knockbackMob(m, m.x - pr.x, m.y - pr.y, concuss, inst, p); stunMob(m, 300, inst, p); }
  }
  inst.emit({ e: 'aoe', v: 'cluster', x: Math.round(pr.x), y: Math.round(pr.y), r: Math.round(radius), d: 420, el: elIdx(st.el), s: st.src ?? p.id }, pr.x, pr.y, p.id);
  const powder = rv(rt, 'powderHorn'); if (powder > 0 && inst.rng.next() * 100 < powder) placeGround(inst, p, 'powder_patch', pr.x, pr.y, 0, 1);
  if (pr.bits & PB_NOGRENADE) return;
  if (pr.bits & PB_ROCKETS) {
    const near = inst.queryMobs(pr.x, pr.y, rt.def.range).filter((m) => !m.dead&&Math.hypot(m.x-p.x,m.y-p.y)<=rt.def.range);
    for (let i = 0; i < 3; i++) {
      const t = near.length ? near[Math.floor(inst.rng.next() * near.length)] : null;
      spawnProj(inst, {
        kind: 'rocket', v: 'rocket', owner: p, src: st.src ?? p.id, x: pr.x, y: pr.y - 10, angle: inst.rng.next() * Math.PI * 2, speed: 640,
        lifeMs: 1400, r: 12, el: 'fire', strike: { ...st, coef: 2.1 * cc.scale, el: 'fire' }, homing: t ? t.id : 0, turn: 6, seek: true,
      });
    }
    return;
  }
  const fuse = Math.max(50, 350 - rv(rt, 'clusterFuse') * 1000);
  const spread = 1 - rv(rt, 'clusterFuse') * 1.5; // Quick Match: up to 45 % tighter at rank 3 [P]
  const n = 4 + rv(rt, 'grenades'); // Powderkeg Crossbow: +3
  for (let i = 0; i < n; i++) {
    const a = inst.rng.next() * Math.PI * 2, d = (60 + inst.rng.next() * 50) * spread;
    grenade(inst, p, rt, st, cc, pr.x + Math.cos(a) * d, pr.y + Math.sin(a) * d, inst.t + fuse);
  }
}

function clusterEliteHit(p: Player, rt: SkillRuntime, m: Mob, cc: ClusterCast) {
  // Powder Thrift: a Burst Arrow that hits an elite refunds Hatred (once per cast).
  const thrift = rv(rt, 'clusterThrift');
  if (thrift > 0 && !cc.thrift && isEliteTier(m.tier)) { cc.thrift = true; gainResource(p, thrift); }
}

function grenade(inst: Instance, p: Player, rt: SkillRuntime, st: Strike, cc: ClusterCast, gx: number, gy: number, at: number) {
  inst.sched.schedule(at, () => {
    if (!inst.playerById(p.id)) return;
    let mult = 1;
    // Sympathetic Blast: a grenade on a Spring Snare triggers it; on burning pitch it deals more.
    const chain = rv(rt, 'clusterChain');
    if (chain > 0) {
      for (const s of p.summons) if (s.type === 'snare' && !s.dead && Math.hypot(s.x - gx, s.y - gy) <= 60) triggerSnare(inst, p, s, null);
      if (inst.grounds.some((g: Ground) => g.owner === p && g.endT > inst.t && g.fx?.def.id === 'pitch_fire' && Math.hypot(g.x - gx, g.y - gy) <= g.r)) mult = 1 + chain / 100;
    }
    const gst = { ...st, coef: 2.1 * cc.scale, mult: (st.mult ?? 1) * mult };
    for (const m of inst.queryMobs(gx, gy, 50)) {
      if (m.dead) continue;
      strikeMob(inst, p, m, gst);
      clusterEliteHit(p, rt, m, cc);
      if (rt.flags.has('clusterFreeze') && !m.dead) freezeMob(m, 750, 0, 0, inst, p);
      // Daisy Chain: a grenade that hits an elite drops one more beside it.
      if (isEliteTier(m.tier) && cc.daisy < rv(rt, 'clusterDaisy')) { cc.daisy++; grenade(inst, p, rt, st, cc, m.x + 30, m.y + 10, inst.t + 200); }
    }
    inst.emit({ e: 'aoe', v: 'grenade', x: Math.round(gx), y: Math.round(gy), r: 50, d: 300, el: elIdx(st.el), s: st.src ?? p.id }, gx, gy, p.id);
  });
}

function clusterArrow(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  const bp = bestPoint(inst, p.x, p.y, rt.def.range, radius);
  if (!bp) return false;
  face(p, bp.x);
  lobCluster(inst, p, rt, p.x, p.y, bp.x, bp.y, p.id);
  deviceCopies(inst, p, rt, bp.x, bp.y);
  noteSpend(inst, p, skillCost(p, rt));
  if (noteCast(p, rt)) farwatchShot(inst, p, rt, Math.atan2(bp.y - p.y, bp.x - p.x));
  emitCast(inst, p, rt, bp.x, bp.y, radius);
  return true;
}

// ─────────────────────────── Arrowfall (rain_of_vengeance) ───────────────────────────

/** Per-storm bookkeeping (nodes and items that count hits or time under the storm). */
interface Storm { g: Ground; hits: Map<number, number>; under: Map<number, number>; stunned: Set<number>; burst: boolean; free: boolean }

function rainOfVengeance(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  const bp = bestPoint(inst, p.x, p.y, rt.def.range, radius);
  if (!bp) return false;
  callRain(inst, p, rt, bp.x, bp.y, radius, skillDurationMs(rt), false);
  if (rt.flags.has('rainFocus')) inst.emit({ e: 'aoe', v: 'kestrel_column', x: Math.round(bp.x), y: Math.round(bp.y), r: Math.round(radius), d: skillDurationMs(rt), el: elIdx(skillElement(rt)), s: p.id }, bp.x, bp.y, p.id);
  emitCast(inst, p, rt, bp.x, bp.y, radius);
  return true;
}

function callRain(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, radius: number, dur: number, free: boolean) {
  const g = newGround('rain', x, y, radius, inst.t, dur + 100, dur / 10);
  g.nextT = inst.t + 100;
  g.owner = p;
  g.waves = 10;
  // Squallcatcher Pauldrons: Aerial skills drift toward the densest group (the Dark Cloud follow).
  g.follow = rt.flags.has('follow') || (rt.flags.has('squallDrift') && !rv(rt, 'rainDrift'));
  g.el = skillElement(rt);
  const base = strikeOf(p, rt, rt.def.coef / 10);
  const burst = rv(rt, 'rainBurst');
  g.strike = burst > 0 ? { ...base, mult: (base.mult ?? 1) * (1 + burst / 100) } : base; // Opening Burst: the first wave (0.5 s)
  // Rainkeeper 6: the storm follows you.
  if (rt.flags.has('rainStorm')) { g.stick = true; g.x = p.x; g.y = p.y; inst.emit({ e: 'aoe', v: 'rain_storm', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), d: Math.round(dur), el: elIdx(g.el), s: p.id, f: 1 }, p.x, p.y, p.id); }
  addGround(inst, g);
  const storm: Storm = { g, hits: new Map(), under: new Map(), stunned: new Set(), burst: burst > 0, free };
  inst.sched.schedule(inst.t + 100, () => stormTick(inst, p, rt, storm, base));
}

/** Every 100 ms while the storm lives: drift, wave counts (Hailstones, Overcast Hood), time under it (Squallcatcher), Rainkeeper 6. */
function stormTick(inst: Instance, p: Player, rt: SkillRuntime, s: Storm, base: Strike) {
  const g = s.g;
  if (!inst.playerById(p.id)) return;
  if (g.endT <= 0 || inst.t >= g.endT) { stormEnd(inst, p, rt, s); return; }
  if (s.burst && inst.t > g.nextT - g.tickMs + 10 && g.waves < 10) { s.burst = false; g.strike = base; }
  // Crosswind (node): drift toward the densest pack at the node's speed.
  const drift = rv(rt, 'rainDrift');
  if (drift > 0 && !g.stick) { const t = bestPoint(inst, g.x, g.y, 300, g.r); if (t) { const d = Math.hypot(t.x - g.x, t.y - g.y), step = Math.min(d, drift * 0.1); if (d > 1) { g.x += (t.x - g.x) / d * step; g.y += (t.y - g.y) / d * step; } } }
  // Count waves per enemy right after each wave (the ground strikes everyone inside per wave).
  const waveJustFell = inst.t >= g.nextT - g.tickMs && inst.t < g.nextT - g.tickMs + 100;
  const stun = rv(rt, 'rainStun'), hood = rv(rt, 'overcastHood'), squall = rv(rt, 'squallcatcher');
  const inside = inst.queryMobs(g.x, g.y, g.r).filter((m) => !m.dead);
  for (const m of inside) {
    if (waveJustFell) {
      const k = (s.hits.get(m.id) ?? 0) + 1; s.hits.set(m.id, k);
      if (rt.flags.has('aerialChill')) chillMob(m, 1500, inst, p);
      if (k === 5 && stun > 0 && !s.stunned.has(m.id)) { s.stunned.add(m.id); stunMob(m, stun * 1000, inst, p); }
      if (k >= 3 && hood > 0) applyStatus(inst, p, m, resolveStatus({ kind: 'vulnerable', ms: 700, pct: hood, skills: ['rain_of_vengeance'] }, p.ctx.powers.index), g.x, g.y, 'overcast_hood');
    }
    if (squall > 0) {
      const u = (s.under.get(m.id) ?? 0) + 100; s.under.set(m.id, u);
      if (u >= 2000) applyStatus(inst, p, m, resolveStatus({ kind: 'vulnerable', ms: 300, pct: squall, tags: { anyOf: ['aerial'] } }, p.ctx.powers.index), g.x, g.y, 'squallcatcher_pauldrons');
    }
  }
  // Rainkeeper 6: Aerial skills deal more to enemies inside the storm; every 3 s a free 50 % strike of your latest Aerial Spender.
  if (g.stick) {
    for (const m of inside) applyStatus(inst, p, m, resolveStatus({ kind: 'vulnerable', ms: 300, pct: 35, tags: { anyOf: ['aerial'] } }, p.ctx.powers.index), g.x, g.y, 'rainkeeper');
    const rs = rstate(p);
    if (inst.t >= rs.stormT) {
      rs.stormT = inst.t + 3000;
      const id = rs.lastAerialSpender, sp = id ? p.ctx.slotted(id) : null;
      const bp = sp ? bestPoint(inst, g.x, g.y, g.r, 60) : null;
      if (sp && bp && Math.hypot(bp.x - g.x, bp.y - g.y) <= g.r) stormStrike(inst, p, sp, bp.x, bp.y);
    }
  }
  inst.sched.schedule(inst.t + 100, () => stormTick(inst, p, rt, s, base));
}

/** Rainkeeper 6's free strike: one Overcast-style arrow of the latest Aerial Spender at 50 % damage. */
function stormStrike(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number) {
  const st = strikeOf(p, rt, rt.def.coef * 0.5);
  inst.emit({ e: 'aoe', v: 'overcast_heavy', x: Math.round(x), y: Math.round(y), r: 70, d: 300, el: elIdx(st.el), s: p.id }, x, y, p.id);
  for (const m of inst.queryMobs(x, y, 70)) if (!m.dead) strikeMob(inst, p, m, st);
}

function stormEnd(inst: Instance, p: Player, rt: SkillRuntime, s: Storm) {
  const g = s.g;
  if (rt.flags.has('rainWet')) placeGround(inst, p, 'wet_ground', g.x, g.y, 0, g.r / 240); // Flood Plain
  // Second Squall: a free half-duration storm on the densest pack (not from a free one).
  if (!s.free && inst.rng.next() * 100 < rv(rt, 'rainRecast')) {
    const bp = bestPoint(inst, p.x, p.y, rt.def.range, g.r);
    if (bp) callRain(inst, p, rt, bp.x, bp.y, g.r, skillDurationMs(rt) / 2, true);
  }
}

// ─────────────────────────── Companion ───────────────────────────

const COMPANION_TYPES = ['wolf', 'bat', 'raven', 'badger', 'heron'] as const;
function companionType(rt: SkillRuntime): Summon['type'] {
  return rt.flags.has('batCompanion') ? 'bat' : rt.flags.has('ravenCompanion') ? 'raven' : rt.flags.has('badgerCompanion') ? 'badger' : rt.flags.has('heronCompanion') ? 'heron' : 'wolf';
}

function companion(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const type = companionType(rt);
  // a rune change swaps the animal
  for (const s of p.summons) if (s.skill === 'companion' && s.type !== type) s.dead = true;
  const n = summonCount(p, 'companion');
  const s = spawnSummon(inst, p, type, 'companion', p.x + (n % 2 ? 40 : -40), p.y + 12, Infinity);
  s.aux = n;
  trimSummons(p, 'companion', maxSummonsOf(rt));
  emitCast(inst, p, rt, s.x, s.y);
  return true;
}

function companionStrike(p: Player): Strike {
  const rt = p.ctx.modsOf('companion');
  // Own multiplier included (Beast sets and items); before the ranger wave the bite left it out.
  return { skill: 'companion', coef: rt.def.coef, el: skillElement(rt), pct: skillPct(p, rt), mult: skillMult(p, 'companion') };
}

function companionAi(inst: Instance, s: Summon, p: Player, dtMs: number, dtS: number) {
  const rt = p.ctx.modsOf('companion');
  const fast = (rt.flags.has('beastFast') ? 1.3 : 1) * (p.ctx.modsOf('quarry_mark').flags.has('markSlow') ? 1.3 : 1); // Thicket Kin 2, Bloodhound
  const speed = (s.type === 'wolf' || s.type === 'badger' ? 360 : 390) * fast;
  // keep the current target while it is alive and near the owner; the quarry first
  let tgt = s.targetId ? inst.mob(s.targetId) ?? null : null;
  const reach0 = rt.def.range;
  const q = quarryOf(inst, p);
  if (q && Math.hypot(q.x - p.x, q.y - p.y) <= reach0 + PLAYER_RADIUS * 2) tgt = q;
  if (!tgt || tgt.dead || Math.hypot(tgt.x - p.x, tgt.y - p.y) > reach0 + PLAYER_RADIUS * 2) {
    tgt = summonTarget(inst, p, p.x, p.y, reach0, false);
    s.targetId = tgt ? tgt.id : 0;
  } else s.targetId = tgt.id;
  if (Math.hypot(s.x - p.x, s.y - p.y) > 900) { s.x = p.x - 30; s.y = p.y + 10; }
  s.fireMs -= dtMs * beastRate(rt) * (tgt && tgt.id === rstate(p).lastShot ? 1 + rv(rt, 'compFocus') / 100 : 1);
  if (tgt) {
    const range = s.type === 'heron' ? 200 : s.type === 'raven' ? 60 : 14;
    const reach = s.r + tgt.r + range;
    moveSummon(inst, s, tgt.x, tgt.y, speed, dtS, reach);
    if (Math.hypot(tgt.x - s.x, tgt.y - s.y) <= reach + 4 && s.fireMs <= 0) {
      s.fireMs = 1000;
      faceTo(s, tgt.x);
      s.attackSeq++;
      s.attackFlagMs = 250;
      if (s.type === 'heron') inst.emit({ e: 'beam', v: 'heron_spear', x: Math.round(s.x), y: Math.round(s.y - 10), tx: Math.round(tgt.x), ty: Math.round(tgt.y), el: elIdx(skillElement(rt)), d: 160 }, tgt.x, tgt.y, p.id);
      beastHit(inst, p, tgt, companionStrike(p), s);
      if (s.type === 'heron' && !tgt.dead) chillMob(tgt, 1500, inst, p);
    }
    // Badger Sett: every 4 s it bursts up under enemies, stunning those within 70 for 0.75 s.
    if (s.type === 'badger') {
      s.tickMs -= dtMs;
      if (s.tickMs <= 0 && Math.hypot(tgt.x - s.x, tgt.y - s.y) <= 120) {
        s.tickMs = 4000;
        inst.emit({ e: 'aoe', v: 'badger_burst', x: Math.round(tgt.x), y: Math.round(tgt.y), r: 70, d: 400, el: 0, s: s.id }, tgt.x, tgt.y, p.id);
        for (const m of inst.queryMobs(tgt.x, tgt.y, 70)) if (!m.dead) stunMob(m, 750, inst, p);
      }
    }
    if (s.fireMs < 0) s.fireMs = 0;
  } else {
    const side = s.aux % 2 === 0 ? -1 : 1;
    const fx = p.x + side * 44 - (p.faceLeft ? -20 : 20), fy = p.y + 14 + (s.aux > 1 ? 24 : 0);
    moveSummon(inst, s, fx, fy, Math.max(speed * 0.8, 260), dtS, 28);
  }
}

// ─────────────────────────── Owner hooks: Pack Leader, Arc Line, ranger tick ───────────────────────────

const rangerOwnerHook: OwnerSummonHook = {
  withSummons(inst, p, dtMs) {
    rangerTick(inst, p, dtMs);
    // Pack Leader: +15% damage while a wolf is alive.
    const comp = p.ctx.slotted('companion');
    const wolf = comp && comp.flags.has('wolfAura') && p.summons.some((s) => s.type === 'wolf');
    if (wolf && !getBuff(p, 'pack_leader')) addBuff(p, { id: 'pack_leader', ms: Infinity, dmg: 15 });
    else if (!wolf && getBuff(p, 'pack_leader')) removeBuff(p, 'pack_leader');
    deviceSalvo(inst, p, dtMs);
    // Arc Line: lightning between sentries every 0.5 s.
    const rt = p.ctx.slotted('sentry');
    if (!rt || !rt.flags.has('chains')) return;
    const sentries = p.summons.filter((s) => s.type === 'sentry');
    if (sentries.length < 2) return;
    const lead = sentries[0];
    lead.chainMs -= dtMs;
    if (lead.chainMs > 0) return;
    lead.chainMs += 500;
    const st: Strike = { skill: 'sentry', coef: 1.5, el: 'lightning', pct: skillPct(p, rt), mult: skillMult(p, 'sentry'), noArea: true };
    const pairs: [Summon, Summon][] = [];
    for (let i = 0; i + 1 < sentries.length; i++) pairs.push([sentries[i], sentries[i + 1]]);
    if (sentries.length >= 3) pairs.push([sentries[sentries.length - 1], sentries[0]]);
    for (const [a, b] of pairs) {
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > 700) continue;
      inst.emit({ e: 'beam', v: 'chain', x: Math.round(a.x), y: Math.round(a.y), tx: Math.round(b.x), ty: Math.round(b.y), el: elIdx('lightning'), d: 520 }, (a.x + b.x) / 2, (a.y + b.y) / 2, p.id);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      let zaps = 0;
      for (const m of inst.queryMobs(mx, my, len / 2 + 30)) {
        if (m.dead) continue;
        if (distToSegment(m.x, m.y, a.x, a.y, b.x, b.y) > 30 + m.r) continue;
        if (zaps++ < 4) inst.emit({ e: 'aoe', v: 'chain', x: Math.round(m.x), y: Math.round(m.y), r: 24, d: 250, el: elIdx('lightning'), s: a.id }, m.x, m.y, p.id);
        strikeMob(inst, p, m, { ...st, src: a.id });
      }
    }
  },
  withoutSummons(inst, p) {
    rangerTick(inst, p, 50);
    if (getBuff(p, 'pack_leader')) removeBuff(p, 'pack_leader');
  },
};

/**
 * Siegebreaker 6: with 4 Devices active, every 3 s each firing Device (Sentry, Pitch Mortar) launches a rocket
 * ([P] one rocket at Rocket Rack's 120 % per Device: the bible names the salvo, not its size).
 */
function deviceSalvo(inst: Instance, p: Player, dtMs: number) {
  if (!isRanger(p) || !p.ctx.slots.some((rt) => rt?.flags.has('deviceSalvo'))) return;
  const devices = p.summons.filter((s) => !s.dead && (s.type === 'sentry' || s.type === 'mortar' || s.type === 'snare'));
  if (devices.length < 4) return;
  const lead = devices[0];
  lead.wanderMs -= dtMs;
  if (lead.wanderMs > 0) return;
  lead.wanderMs = 3000;
  for (const s of devices) {
    if (s.type === 'snare') continue;
    const t = summonTarget(inst, p, s.x, s.y, 450, false, true);
    if (t) fireRocket(inst, p, s, t, 1.2, s.skill);
  }
}

// ─────────────────────────── Registration ───────────────────────────

export const RANGER_BEHAVIOURS: Record<string, SkillBehaviour> = {
  hungering_arrow: { primary: hungeringArrow },
  sentry: { cast: sentry },
  multishot: { cast: multishot },
  cluster_arrow: { cast: clusterArrow },
  rain_of_vengeance: { cast: rainOfVengeance },
  companion: { cast: companion },
};

export const RANGER_SUMMONS: Record<string, SummonBehaviour> = {
  sentry: { radius: 18, actsWhileOwnerDead: true, update: sentryAi },
  wolf: { radius: 16, update: companionAi },
  bat: { radius: 12, flies: true, update: companionAi },
  raven: { radius: 12, flies: true, update: companionAi },
  badger: { radius: 15, update: companionAi },
  heron: { radius: 15, flies: true, update: companionAi },
};

export const RANGER_OWNER_HOOKS: OwnerSummonHook[] = [rangerOwnerHook];
void COMPANION_TYPES; void huntingCall;
