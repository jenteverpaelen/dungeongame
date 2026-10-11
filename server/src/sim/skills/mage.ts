// Mage skill behaviour (server authority). Data: shared/src/data/skills/mage.ts.
// The six original skills — Magic Missile, Meteor, Black Hole, Frost Nova (+ Shatter), Hydra (+ hydra AI), Magic Weapon —
// with their bible v2 runes, nodes and the item rules that reach them (docs/rework/depth/MAGE.md). The six M1 skills live
// in mageM1.ts; shared plumbing (hit wrapper, freeze / chill rules, projectile hooks, owner and death hooks) in mageKit.ts.

import type { Element } from '../../shared';
import { modVar, skillBuffBonuses } from '../../shared';
import { bestConeAngle, bestPoint, pickTarget } from '../brain';
import { expectedDamage, gainResource } from '../damage';
import { addBuff, addOwnedDot, dragMob, elIdx, inCone, knockbackMob } from '../effects';
import { addGround, newGround } from '../grounds';
import type { Instance } from '../instance';
import { maxSummonsOf, skillCost, skillDurationMs, skillElement, skillMult, skillPct, skillRadius } from '../playerctx';
import { spawnProj } from '../projectiles';
import { moveSummon, spawnSummon } from '../summons';
import type { Ground, Mob, Player, SkillRuntime, Strike, Summon } from '../types';
import {
  DEG, emitCast, face, faceTo, fanAngles, strikeOf, trimSummons,
  type DeathHook, type SkillBehaviour, type SummonBehaviour,
} from './common';
import {
  type BoltRules, type CastBudget, type CastTally, type GoneSummon, choirExtra, fireBolt, mChill, mFreeze, mHit, mstate, nearestMob,
  newBudget, newTally, noteSpend, refundCooldownLater, refundDuringCast, scaled, summonAttacked, summonHaste,
} from './mageKit';
import { extendFieldsAt } from './mageM1'; // runtime call only (module cycle)

const TAU = Math.PI * 2;
/** Horizon Cowl: "your Ground effects last 1 s longer" (ms, read where a mage ground is placed). */
export const groundPlus = (rt: SkillRuntime) => modVar(rt.mods, 'groundPlusMs');

// ─────────────────────────── Magic Missile (primary) ───────────────────────────

/**
 * One Magic Missile volley at `tgt`. `from` (Orrery spheres, Prism Burst): a borrowed cast from another point at
 * `scale` damage — the rune and the nodes apply, the primary-attack rules (echoes, Missile Choir) do not.
 */
export function magicMissile(inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob, opt: { from?: { x: number; y: number }; scale?: number; angle?: number } = {}) {
  const ox = opt.from?.x ?? p.x, oy = (opt.from?.y ?? p.y) - 6;
  const borrowed = !!opt.from;
  const base = opt.angle ?? Math.atan2(tgt.y - oy, tgt.x - ox);
  let st: Strike = { ...strikeOf(p, rt), primary: !borrowed };
  if (opt.scale !== undefined) st = scaled(st, opt.scale);
  // Overflow (node): while Arcane Power is full, missiles deal more.
  const overflow = modVar(rt.mods, 'overflow');
  if (overflow > 0 && p.res >= p.mres - 0.5) st = { ...st, mult: (st.mult ?? 1) * (1 + overflow / 100) };
  const homing = rt.flags.has('homing');
  const track = modVar(rt.mods, 'missileTurn'); // Tracking Glyph (node): homing without Seeker
  const rules = missileRules(p, rt, !borrowed);
  const n = 1 + Math.max(0, rt.mods.projectiles ?? 0), choir = borrowed ? 0 : choirExtra(p, rt);
  fanAngles(n + choir, 8 * DEG).forEach((off, i) => {
    fireBolt(inst, p, rules, i >= n ? scaled(st, 0.6) : st, {
      v: 'missile', x: ox, y: oy, angle: base + off, speed: 800, lifeMs: 760, r: 12,
      homing: homing || track > 0 ? tgt.id : 0, turn: homing ? 5 : track, seek: homing,
    });
  });
  if (borrowed) return;
  // Echo Cast (node): a free extra missile at another enemy.
  const echo = modVar(rt.mods, 'missileEcho');
  if (echo > 0 && inst.rng.next() * 100 < echo) {
    const other = nearestMob(inst, p.x, p.y, rt.def.range, tgt);
    if (other) fireBolt(inst, p, rules, st, { v: 'missile', x: ox, y: oy, angle: Math.atan2(other.y - oy, other.x - ox), speed: 800, lifeMs: 760, r: 12, homing: other.id, turn: Math.max(track, homing ? 5 : 0), seek: homing });
  }
  emitCast(inst, p, rt, tgt.x, tgt.y);
}

function missileRules(p: Player, rt: SkillRuntime, primary: boolean): BoltRules {
  const pierce = modVar(rt.mods, 'pierceWill');
  return {
    rt, primary, budget: newBudget(p),
    ...(pierce > 0 ? { pierce: 1, pierceScale: pierce / 100 } : {}),
    freezeChance: rt.flags.has('freezeChance') ? 0.15 : 0,
    missile: {
      gen: rt.mods.gen ?? 0,
      shatter: rt.flags.has('missileShatter'),
      chain: rt.flags.has('missileChain') ? 1 + modVar(rt.mods, 'chains') : 0,
      voidBolt: modVar(rt.mods, 'voidBolt'),
    },
  };
}

/** Echoing Bead: a primary attack has a chance to be cast twice (the repeat itself never echoes). */
function primaryEcho(inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob, attack: (inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob) => void) {
  const bead = modVar(rt.mods, 'echoBead');
  if (bead > 0 && inst.rng.next() * 100 < bead) inst.sched.schedule(inst.t + 120, () => { if (inst.playerById(p.id) === p && p.deadMs <= 0 && !tgt.dead) attack(inst, p, rt, tgt); });
}

function magicMissilePrimary(inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob) {
  magicMissile(inst, p, rt, tgt);
  primaryEcho(inst, p, rt, tgt, (i, pl, r, t) => magicMissile(i, pl, r, t));
}

// ─────────────────────────── Meteor ───────────────────────────

interface MeteorCast { tally: CastTally; budget: CastBudget; elite: Mob | null }

function meteor(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  // Starseeker (node): the highest-Life elite in range instead of the densest pack.
  const seeker = modVar(rt.mods, 'starseeker');
  let elite: Mob | null = null;
  if (seeker > 0) for (const m of inst.queryMobs(p.x, p.y, rt.def.range)) if (!m.dead && (m.tier === 1 || m.tier === 2 || m.tier === 4) && (!elite || m.hp > elite.hp)) elite = m;
  const bp = elite ? { x: elite.x, y: elite.y } : bestPoint(inst, p.x, p.y, rt.def.range, radius);
  if (!bp) return false;
  face(p, bp.x);
  const cast: MeteorCast = { tally: newTally(), budget: newBudget(p), elite };
  dropMeteor(inst, p, rt, bp.x, bp.y, radius, 1, cast);
  // Regalia of the Fallen Star 2 (Aerial skills strike a second time at 60 %); the old full second meteor stays for its flag.
  const echo = rt.flags.has('aerialEcho') ? 0.6 : rt.flags.has('secondMeteor') ? 1 : 0;
  if (echo > 0) {
    let best: Mob | null = null, bd = Infinity;
    for (const m of inst.queryMobs(bp.x, bp.y, 400)) {
      if (m.dead) continue;
      if (Math.hypot(m.x - p.x, m.y - p.y) > rt.def.range) continue;
      const d = Math.hypot(m.x - bp.x, m.y - bp.y);
      // Spread the second impact (never exactly on the first) but stay reliable: after the C107 reach cuts packs close
      // into one blob, and a 0.9x exclusion left the set bonus firing in 0 of 14 casts in the simulation.
      if (d < radius * 0.5) continue;
      if (d < bd) { bd = d; best = m; }
    }
    if (best) dropMeteor(inst, p, rt, best.x, best.y, radius, echo, { ...cast, elite: null });
  }
  spenderCast(inst, p, rt, bp.x, bp.y);
  noteSpend(inst, p, skillCost(p, rt));
  emitCast(inst, p, rt, bp.x, bp.y, radius);
  return true;
}

/** Orrery · Comet Ring: one Meteor (with your Meteor's rune and nodes) at (x, y), at `scale` of its impact. */
export function meteorAt(inst: Instance, p: Player, x: number, y: number, scale: number) {
  const rt = p.ctx.modsOf('meteor');
  dropMeteor(inst, p, rt, x, y, skillRadius(rt), scale, { tally: newTally(), budget: newBudget(p), elite: null });
}

/** Spender casts: Regalia of the Fallen Star 6 — every fourth calls three craters in a line that pull toward the first. */
export function spenderCast(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number) {
  if (!rt.flags.has('fallingStar')) return;
  const ms = mstate(p);
  if (++ms.spenderCasts < 4) return;
  ms.spenderCasts = 0;
  // [P] three craters 110 units apart (radius 90, 1.5 s) from the target point away from you; 25 units of pull per 0.25 s.
  const a = Math.atan2(y - p.y, x - p.x) || 0, ux = Math.cos(a), uy = Math.sin(a);
  const pts = [0, 1, 2].map((i) => ({ x: x + ux * 110 * i, y: y + uy * 110 * i }));
  for (const c of pts) inst.emit({ e: 'aoe', v: 'star_crater', x: Math.round(c.x), y: Math.round(c.y), r: 90, d: 1500, el: elIdx('arcane'), s: p.id }, c.x, c.y, p.id);
  let left = 6;
  const pull = () => {
    if (inst.playerById(p.id) !== p || left-- <= 0) return;
    const seen = new Set<Mob>();
    for (const c of pts) for (const m of inst.queryMobs(c.x, c.y, 90)) {
      if (m.dead || seen.has(m)) continue;
      seen.add(m);
      const d = Math.hypot(m.x - pts[0].x, m.y - pts[0].y);
      if (d > 14) dragMob(inst, m, pts[0].x, pts[0].y, Math.min(25, d - 12), p);
    }
    inst.sched.schedule(inst.t + 250, pull);
  };
  pull();
}

function dropMeteor(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, radius: number, scale: number, cast: MeteorCast) {
  const fall = rt.flags.has('fastMeteor') ? 500 : 1000;
  const el = skillElement(rt);
  const comet = rt.flags.has('freeze');
  if (rt.flags.has('shower')) {
    for (let i = 0; i < 7; i++) {
      const a = inst.rng.next() * Math.PI * 2, d = Math.sqrt(inst.rng.next()) * radius * 1.6;
      const mx = x + Math.cos(a) * d, my = y + Math.sin(a) * d;
      const r = radius * 0.55;
      const delay = i * 170;
      inst.sched.schedule(inst.t + delay, () => {
        if (!inst.playerById(p.id)) return;
        inst.emit({ e: 'tele', v: 'meteor', x: Math.round(mx), y: Math.round(my), r: Math.round(r), d: fall }, mx, my, p.id);
        inst.sched.schedule(inst.t + fall, () => meteorImpact(inst, p, rt, mx, my, r, 0.37 * scale, el, comet, true, cast));
      });
    }
    return;
  }
  inst.emit({ e: 'tele', v: 'meteor', x: Math.round(x), y: Math.round(y), r: Math.round(radius), d: fall, ...(rt.flags.has('meteorTrail') ? { a: +Math.atan2(y - p.y, x - p.x).toFixed(3) } : {}) }, x, y, p.id);
  // Lodestone (rune): over the last 0.4 s of the fall, enemies within 1.5× the radius are pulled to the centre.
  if (rt.flags.has('meteorPull')) {
    const pullAt = Math.max(0, fall - 400);
    inst.sched.schedule(inst.t + pullAt, () => {
      if (inst.playerById(p.id) !== p) return;
      inst.emit({ e: 'aoe', v: 'lodestone', x: Math.round(x), y: Math.round(y), r: Math.round(radius * 1.5), d: fall - pullAt, el: elIdx(el), s: p.id }, x, y, p.id);
      for (let k = 0; k < 4; k++) inst.sched.schedule(inst.t + k * 100, () => {
        for (const m of inst.queryMobs(x, y, radius * 1.5)) {
          if (m.dead) continue;
          const d = Math.hypot(m.x - x, m.y - y);
          if (d > 14) dragMob(inst, m, x, y, (d - 10) / (4 - k), p);
        }
      });
    });
  }
  // Ember Tail (rune): molten patches along the path from you to the impact.
  const tail = rt.flags.has('meteorTrail') ? { x0: p.x, y0: p.y } : null;
  inst.sched.schedule(inst.t + fall, () => {
    meteorImpact(inst, p, rt, x, y, radius, scale, el, comet, false, cast);
    if (tail && !comet) for (const f of [0.3, 0.55, 0.8]) {
      const tx = tail.x0 + (x - tail.x0) * f, ty = tail.y0 + (y - tail.y0) * f;
      molten(inst, p, rt, tx, ty, radius * 0.45, scale);
    }
  });
}

function meteorImpact(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, radius: number, scale: number, el: Element, comet: boolean, small: boolean, cast: MeteorCast) {
  if (!inst.playerById(p.id)) return;
  const st: Strike = { ...strikeOf(p, rt, rt.def.coef * scale), el };
  const seeker = modVar(rt.mods, 'starseeker'), knock = modVar(rt.mods, 'meteorKnock');
  let hits = 0;
  for (const m of inst.queryMobs(x, y, radius)) {
    if (m.dead) continue;
    const s = cast.elite === m && seeker > 0 ? { ...st, mult: (st.mult ?? 1) * (1 + seeker / 100) } : st;
    const r = mHit(inst, p, m, s, rt, cast.tally);
    hits++;
    if (r.killed || m.dead) continue;
    if (comet) mFreeze(inst, p, m, 1500, cast.budget);
    if (knock > 0) knockbackMob(m, m.x - x, m.y - y, knock, inst, p); // Shockwave (node)
  }
  inst.emit({ e: 'aoe', v: small ? 'meteorSmall' : 'meteor', x: Math.round(x), y: Math.round(y), r: Math.round(radius), d: 600, el: elIdx(el), s: p.id }, x, y, p.id);
  if (!small) for (const q of inst.playersNear(x, y, 700)) inst.emitTo(q.id, { e: 'shake', m: q === p ? 4 : 2, d: 160 });
  // Arcane Fuel (node): a refund when it hits 4 or more enemies.
  const fuel = modVar(rt.mods, 'meteorRefund');
  if (fuel > 0 && hits >= 4 && !small) gainResource(p, fuel);
  // Fragmenting Star (node): burning fragments at nearby enemies (50 % of the impact within 40).
  const frags = small ? 0 : Math.floor(modVar(rt.mods, 'fragments'));
  if (frags > 0) {
    const near = inst.queryMobs(x, y, 260).filter((m) => !m.dead);
    const fst = scaled(st, 0.5, { noArea: true });
    for (let i = 0; i < frags && near.length; i++) {
      const t = near[Math.floor(inst.rng.next() * near.length)];
      const fx = t.x, fy = t.y;
      inst.sched.schedule(inst.t + 120 + i * 60, () => {
        if (inst.playerById(p.id) !== p) return;
        for (const m of inst.queryMobs(fx, fy, 40)) if (!m.dead) mHit(inst, p, m, fst, rt);
        inst.emit({ e: 'aoe', v: 'meteorSmall', x: Math.round(fx), y: Math.round(fy), r: 40, d: 400, el: elIdx(el), s: p.id }, fx, fy, p.id);
      });
    }
  }
  if (comet) return;
  molten(inst, p, rt, x, y, radius * 0.9, scale);
}

/** Molten ground: 235 % weapon damage over 3 s [M] (Cindervane: twice as long; Horizon Cowl: +1 s). */
function molten(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, r: number, scale: number) {
  const dur = 3000 * (rt.flags.has('moltenDouble') ? 2 : 1) + groundPlus(rt);
  const ms: Strike = { ...strikeOf(p, rt, 2.35 * scale), el: 'fire' };
  const g = newGround('molten', x, y, r, inst.t, dur, 500);
  g.owner = p;
  g.strike = ms;
  g.el = 'fire';
  g.dmg = expectedDamage(inst, p, ms) / 6;
  addGround(inst, g);
  // Following grounds (rule groundsFollow): the client pool follows its owner (FOUNDATION.md §12.5).
  inst.emit({ e: 'aoe', v: 'molten', x: Math.round(x), y: Math.round(y), r: Math.round(g.r), d: dur, el: elIdx('fire'), s: p.id, ...(g.stick ? { f: 1 as const } : {}) }, x, y, p.id);
  moltenRules(inst, p, rt, g);
}

/** Afterburn (node): enemies leaving the molten ground keep burning; Craterheart Amulet: the ground pulls inward. */
function moltenRules(inst: Instance, p: Player, rt: SkillRuntime, g: Ground) {
  const after = modVar(rt.mods, 'afterburn'), crater = rt.flags.has('craterPull');
  if (after <= 0 && !crater) return;
  let inside = new Set<Mob>();
  const loop = () => {
    if (g.endT <= inst.t || inst.playerById(p.id) !== p) return;
    const now = new Set<Mob>();
    for (const m of inst.queryMobs(g.x, g.y, g.r)) {
      if (m.dead) continue;
      now.add(m);
      if (crater) { const d = Math.hypot(m.x - g.x, m.y - g.y); if (d > 14) dragMob(inst, m, g.x, g.y, Math.min(5, d - 12), p); } // 20 units / s
    }
    if (after > 0) for (const m of inside) if (!now.has(m) && !m.dead)
      addOwnedDot(p, m, { kind: 'burn', owner: p.id, skill: 'meteor', perTick: g.dmg, el: 'fire', tickMs: 500, nextMs: 500, leftMs: after * 1000, durMs: after * 1000 });
    inside = now;
    inst.sched.schedule(inst.t + 250, loop);
  };
  inst.sched.schedule(inst.t + 250, loop);
}

// ─────────────────────────── Black Hole ───────────────────────────

function blackHole(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  const bp = bestPoint(inst, p.x, p.y, rt.def.range, radius);
  if (!bp) return false;
  face(p, bp.x);
  openHole(inst, p, rt, bp.x, bp.y, radius);
  // Siphoning Void (node): Arcane Power per enemy caught (at most 15); paid back during the cast.
  const gen = modVar(rt.mods, 'holeGen');
  if (gen > 0) {
    let n = 0;
    for (const m of inst.queryMobs(bp.x, bp.y, radius)) if (!m.dead) n++;
    refundDuringCast(p, Math.min(15, n * gen), skillCost(p, rt));
  }
  // Twin Singularity (node): a chance for a second, half-size Black Hole on another pack.
  const twin = modVar(rt.mods, 'holeTwin');
  if (twin > 0 && inst.rng.next() * 100 < twin) {
    let best: Mob | null = null, bs = -1;
    for (const m of inst.queryMobs(p.x, p.y, rt.def.range)) {
      if (m.dead || Math.hypot(m.x - bp.x, m.y - bp.y) < radius) continue;
      let s = 0;
      for (const o of inst.queryMobs(m.x, m.y, radius * 0.5)) if (!o.dead) s++;
      if (s > bs) { bs = s; best = m; }
    }
    if (best) openHole(inst, p, rt, best.x, best.y, radius * 0.5);
  }
  emitCast(inst, p, rt, bp.x, bp.y, radius);
  return true;
}

function openHole(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, radius: number) {
  const dur = skillDurationMs(rt) + groundPlus(rt);
  const ticks = Math.max(1, Math.round((rt.def.duration * 1000) / 250));
  // Quick Collapse (node): 30 % shorter with the same total damage — each tick carries what the lost ticks would have.
  const durPct = 1 + (rt.mods.duration ?? 0) / 100;
  const keep = rt.flags.has('holeQuick') ? (durPct + 0.3) / Math.max(0.1, durPct) : 1;
  const g = newGround('blackhole', x, y, radius, inst.t, dur, 250);
  g.owner = p;
  g.el = skillElement(rt);
  g.strike = strikeOf(p, rt, rt.def.coef / ticks * keep);
  g.freeze = false; // Absolute Zero freezes in holeLoop (the mage's freeze rules)
  g.voidPct = rt.flags.has('voidHeart') ? modVar(rt.mods, 'voidPct') : 0; // Heart of the Void
  g.caught = new Set();
  addGround(inst, g);
  if (rt.flags.has('spellsteal')) {
    let n = 0;
    for (const m of inst.queryMobs(x, y, radius)) if (!m.dead) n++;
    if (n > 0) addBuff(p, { id: 'spellsteal', ms: 10000, dmg: 3 * Math.min(10, n), st: Math.min(10, n) });
  }
  inst.emit({ e: 'aoe', v: 'blackhole', x: Math.round(x), y: Math.round(y), r: Math.round(radius), d: Math.round(dur), el: elIdx(g.el), s: p.id }, x, y, p.id);
  holeLoop(inst, p, rt, g);
}

/**
 * Black Hole rules on top of the engine ground (pull, ticks): Wandering Void (drifts 80 units / s toward the densest
 * enemies), Crushing Core (the inner 40 % take more: an extra share of each tick), and on collapse Absolute Zero (freeze)
 * and Collapse Bloom (a ring of 8 arcane bolts, 80 % each).
 */
function holeLoop(inst: Instance, p: Player, rt: SkillRuntime, g: Ground) {
  const drift = rt.flags.has('holeDrift'), core = modVar(rt.mods, 'holeCore');
  const freeze = rt.flags.has('freeze'), bolts = rt.flags.has('holeBolts');
  const budget = newBudget(p);
  const step = () => {
    if (inst.playerById(p.id) !== p) return;
    if (inst.t >= g.endT - 1 || g.endT <= 0) {
      if (freeze) {
        for (const m of inst.queryMobs(g.x, g.y, g.r)) if (!m.dead) mFreeze(inst, p, m, 1500, budget);
        inst.emit({ e: 'aoe', v: 'nova', x: Math.round(g.x), y: Math.round(g.y), r: Math.round(g.r), d: 450, el: elIdx('cold'), s: p.id }, g.x, g.y, p.id);
      }
      if (bolts) {
        const bst: Strike = { ...strikeOf(p, rt, 0.8), el: skillElement(rt), noArea: true };
        for (let i = 0; i < 8; i++) fireBolt(inst, p, { rt }, bst, { v: 'missile', x: g.x, y: g.y - 6, angle: i * TAU / 8, speed: 700, lifeMs: 430, r: 12, keepLife: true });
      }
      return;
    }
    if (drift) {
      const bp = bestPoint(inst, g.x, g.y, 300, g.r * 0.6);
      if (bp) {
        const dx = bp.x - g.x, dy = bp.y - g.y, d = Math.hypot(dx, dy);
        if (d > 4) {
          const s = Math.min(d, 20);
          g.x += dx / d * s; g.y += dy / d * s;
          inst.emit({ e: 'aoe', v: 'blackhole_at', x: Math.round(g.x), y: Math.round(g.y), r: Math.round(g.r), d: 260, el: elIdx(g.el), s: p.id }, g.x, g.y, p.id);
        }
      }
    }
    if (core > 0 && g.strike) {
      const cst = scaled(g.strike, core / 100, { noArea: true, noProc: true });
      for (const m of inst.queryMobs(g.x, g.y, g.r * 0.4)) if (!m.dead) mHit(inst, p, m, cst, rt);
    }
    inst.sched.schedule(Math.min(g.endT - 1, inst.t + 250), step);
  };
  inst.sched.schedule(inst.t + 250, step);
}

// ─────────────────────────── Frost Nova ───────────────────────────

function frostNova(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt), freeze = skillDurationMs(rt);
  const budget = newBudget(p), refund = { left: 3 };
  // Cold Front (rune): a 120° wave reaching 300 units toward the densest pack.
  const cone = rt.flags.has('novaCone') ? (bestConeAngle(inst, p.x, p.y, 300, 60 * DEG) ?? (p.faceLeft ? Math.PI : 0)) : null;
  castNova(inst, p, rt, p.x, p.y, cone !== null ? 300 : radius, freeze, 0, 1, budget, refund, cone);
  // Frostlocked Wand: the nova also goes off around your target.
  if (rt.flags.has('novaAtTarget')) {
    const t = pickTarget(inst, p.x, p.y, 380, true, p.save.skills.targetPriority);
    if (t) castNova(inst, p, rt, t.x, t.y, radius, freeze, 0, 1, budget, refund, null);
  }
  // Mirror Frost (rune): a second nova at your position 1.5 s later with half the freeze.
  if (rt.flags.has('novaEcho')) inst.sched.schedule(inst.t + 1500, () => { if (inst.playerById(p.id) === p && p.deadMs <= 0) castNova(inst, p, rt, p.x, p.y, radius, freeze / 2, 0, 1, budget, null, null); });
  // Ice Mirror (Rimefield node): casting Frost Nova inside your field extends it.
  extendFieldsAt(inst, p);
  emitCast(inst, p, rt, p.x, p.y, radius);
  return true;
}


function castNova(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, radius: number, freezeMs: number, depth: number, scale: number,
  budget: CastBudget | null = null, refund: { left: number } | null = null, cone: number | null = null) {
  const st = strikeOf(p, rt, rt.def.coef * scale);
  const shatter = rt.flags.has('shatterNova');
  const after = modVar(rt.mods, 'novaChillAfter'), burst = modVar(rt.mods, 'novaChilledBonus'), back = modVar(rt.mods, 'novaRefund');
  let frozen = 0;
  for (const m of inst.queryMobs(x, y, radius)) {
    if (m.dead) continue;
    if (cone !== null && !inCone(m.x, m.y, m.r, x, y, cone, 60 * DEG, radius)) continue;
    const chilled = m.chillMs > 0;
    if (mFreeze(inst, p, m, freezeMs, budget, shatter ? p.id : 0, depth)) {
      frozen++;
      if (after > 0) mChill(inst, p, m, m.freezeMs + after * 1000); // Lingering Cold (node)
    }
    mHit(inst, p, m, chilled && burst > 0 ? { ...st, mult: (st.mult ?? 1) * (1 + burst / 100) } : st, rt); // Glacial Burst (node)
  }
  if (cone !== null) inst.emit({ e: 'aoe', v: 'nova_cone', x: Math.round(x), y: Math.round(y), r: Math.round(radius), d: 450, el: elIdx(st.el), s: p.id, a: +cone.toFixed(3) }, x, y, p.id);
  else inst.emit({ e: 'aoe', v: 'nova', x: Math.round(x), y: Math.round(y), r: Math.round(radius), d: 450, el: elIdx(st.el), s: p.id }, x, y, p.id);
  if (depth === 0 && rt.flags.has('deepFreeze') && frozen >= 5) addBuff(p, { id: 'deep_freeze', ms: 11000, chc: 10 });
  // Cold Return (node): each frozen enemy shortens the cooldown (at most 3 s per cast).
  if (refund && back > 0 && frozen > 0) {
    const s = Math.min(refund.left, frozen * back);
    refund.left -= s;
    refundCooldownLater(inst, p, 'frost_nova', s * 1000);
  }
}

/** Retort of Frost (node): a free Frost Nova at your feet (no cost, no cooldown). */
export function freeNovaCast(inst: Instance, p: Player, rt: SkillRuntime) {
  castNova(inst, p, rt, p.x, p.y, skillRadius(rt), skillDurationMs(rt), 0, 1, newBudget(p), null, null);
  emitCast(inst, p, rt, p.x, p.y, skillRadius(rt));
}

/** Shatter: frozen enemies explode into another (smaller) Frost Nova; no chains deeper than one. */
export const shatterHook: DeathHook = (inst, m) => {
  if (m.freezeMs > 0 && m.shatterBy && m.shatterDepth < 1) {
    const owner = inst.playerById(m.shatterBy);
    const rt = owner?.ctx.slotted('frost_nova');
    if (owner && rt) {
      const x = m.x, y = m.y;
      inst.sched.schedule(inst.t + 50, () => castNova(inst, owner, rt, x, y, skillRadius(rt) * 0.6, skillDurationMs(rt) * 0.5, 1, 0.6));
    }
  }
};

// ─────────────────────────── Hydra ───────────────────────────

function hydra(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const t = pickTarget(inst, p.x, p.y, rt.def.range, false, p.save.skills.targetPriority);
  if (!t) return false;
  const a = Math.atan2(t.y - p.y, t.x - p.x);
  const follow = rt.flags.has('hydraFollow');
  let x = p.x + Math.cos(a) * (follow ? -60 : 60), y = p.y + Math.sin(a) * 60;
  if (!inst.cw.isFree(x, y, 16)) { x = p.x; y = p.y; }
  const mammoth = rt.flags.has('mammoth');
  summonExtend(p, rt);
  spawnSummon(inst, p, 'hydra', 'hydra', x, y, skillDurationMs(rt), mammoth);
  trimSummons(p, 'hydra', mammoth ? 1 : maxSummonsOf(rt));
  emitCast(inst, p, rt, x, y);
  return true;
}

/** Lanternkeeper's Sash: summoning adds 2 s to your other summons. */
export function summonExtend(p: Player, rt: SkillRuntime) {
  if (!rt.flags.has('summonExtend')) return;
  for (const s of p.summons) if (!s.dead && s.lifeMs !== Infinity && s.type !== 'dust_devil') s.lifeMs += 2000;
}

function hydraAi(inst: Instance, s: Summon, p: Player, dtMs: number, dtS: number) {
  const rt = p.ctx.modsOf('hydra');
  const el = skillElement(rt);
  // Serpent Coil (rune): the Hydra follows you at 80 units and attacks 15 % slower.
  const follow = rt.flags.has('hydraFollow');
  if (follow) {
    const side = s.aux % 2 ? 1 : -1;
    moveSummon(inst, s, p.x - (p.faceLeft ? -1 : 1) * 60, p.y + side * 50, 320, dtS, 24);
  }
  const base: Strike = { skill: 'hydra', coef: rt.def.coef, el, pct: skillPct(p, rt), mult: skillMult(p, 'hydra'), src: s.id };
  s.fireMs -= dtMs * summonHaste(inst, p, s, rt);
  if (s.fireMs > 0) return;
  // Split Heads (node): each head prefers a different target.
  const split = rt.flags.has('hydraSplit');
  const tgt = split ? headTarget(inst, s, rt.def.radius, p) : pickTarget(inst, s.x, s.y, rt.def.radius, true, p.save.skills.targetPriority);
  if (!tgt) { s.fireMs = 150; return; }
  faceTo(s, tgt.x);
  s.attackSeq++;
  s.attackFlagMs = 220;
  const a = Math.atan2(tgt.y - s.y, tgt.x - s.x);
  summonAttacked(inst, p, s, rt);
  if (s.big) {
    // Elder Hydra: a river of fire that burns everything along its path.
    s.fireMs += 900 * (follow ? 1.15 : 1);
    spawnProj(inst, {
      kind: 'river', v: 'fireball', sz: 2, owner: p, src: s.id, x: s.x, y: s.y - 30, angle: a, speed: 720, lifeMs: 700, r: 34, el,
      pierce: 1, hits: new Set(), strike: { ...base, coef: base.coef * 0.9 },
    });
    return;
  }
  // Three heads fire in turn: one shot every 0.3 s, each 30% of the per-second coefficient.
  s.fireMs += 300 * (follow ? 1.15 : 1);
  s.aux = (s.aux + 1) % 3;
  const splash = rt.flags.has('splash');
  const frost = rt.flags.has('chill');
  const rules: BoltRules = {
    rt, summon: s, hydra: true, splash: splash ? 60 : frost ? 0 : 40, chillMs: frost ? 2000 : 0,
    ...(rt.flags.has('hydraChain') ? { chains: { n: 2 + modVar(rt.mods, 'chains'), range: 200, scale: 0.6 } } : {}),
  };
  // Glass Concord 2 and other Projectile counts: extra spit fans out 10° apart without homing (like extra missiles).
  const n = 1 + Math.max(0, rt.mods.projectiles ?? 0);
  fanAngles(n, 10 * DEG).forEach((off, i) => fireBolt(inst, p, rules, { ...base, coef: base.coef * 0.3 }, {
    v: splash ? 'orb' : frost ? 'shard' : 'fireball', x: s.x + (s.aux - 1) * 10, y: s.y - 28, angle: a + off, speed: 600, lifeMs: 950, r: 12, homing: i === 0 ? tgt.id : 0, turn: i === 0 ? 2.5 : 0,
  }));
}

/** Split Heads: the (head index)-th nearest enemy in reach, so the three heads spread over a pack. */
function headTarget(inst: Instance, s: Summon, range: number, p: Player): Mob | null {
  const near = inst.queryMobs(s.x, s.y, range).filter((m) => !m.dead).sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y));
  if (!near.length) return pickTarget(inst, s.x, s.y, range, true, p.save.skills.targetPriority);
  return near[(s.aux + 1) % 3 < near.length ? (s.aux + 1) % 3 : 0];
}

/** Last Breath (Hydra node): an expiring Hydra exhales a 90° cone of fire (300 units [P]). */
export function hydraGone(inst: Instance, p: Player, s: GoneSummon) {
  if (s.type !== 'hydra') return;
  const hy = p.ctx.slotted('hydra');
  const v = hy ? modVar(hy.mods, 'hydraFinale') : 0;
  if (!hy || v <= 0) return;
  const t = nearestMob(inst, s.x, s.y, 300);
  if (!t) return;
  const a = Math.atan2(t.y - s.y, t.x - s.x);
  const st: Strike = { ...strikeOf(p, hy, v / 100), noArea: true };
  for (const m of inst.queryMobs(s.x, s.y, 300)) if (!m.dead && inCone(m.x, m.y, m.r, s.x, s.y, a, 45 * DEG, 300)) mHit(inst, p, m, st, hy);
  inst.emit({ e: 'aoe', v: 'hydra_breath', x: Math.round(s.x), y: Math.round(s.y), r: 300, d: 600, el: elIdx(st.el), s: p.id, a: +a.toFixed(3) }, s.x, s.y, p.id);
}

// ─────────────────────────── Magic Weapon ───────────────────────────

function magicWeapon(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  // Glyphstone Orb (points), Hollowstar Choir 4 (doubled), Arcane Ward (halved): shared/src/data/skills skillBuffBonuses.
  const ias = modVar(rt.mods, 'weaponIas'); // Runeweaver Cuffs
  addBuff(p, { id: 'magic_weapon', ms: skillDurationMs(rt), ...skillBuffBonuses('magic_weapon', rt.flags, rt.mods.vars), ...(ias > 0 ? { ias } : {}) });
  // Arcane Recharge (node): Arcane Power back as it is cast.
  refundDuringCast(p, modVar(rt.mods, 'weaponRefill'), skillCost(p, rt));
  emitCast(inst, p, rt, p.x, p.y);
  return true;
}

// ─────────────────────────── Registration ───────────────────────────

export const MAGE_BEHAVIOURS: Record<string, SkillBehaviour> = {
  magic_missile: { primary: magicMissilePrimary },
  meteor: { cast: meteor },
  black_hole: { cast: blackHole },
  frost_nova: { cast: frostNova },
  hydra: { cast: hydra },
  magic_weapon: { cast: magicWeapon },
};

export const MAGE_SUMMONS: Record<string, SummonBehaviour> = {
  hydra: { radius: 24, actsWhileOwnerDead: true, update: hydraAi },
};

export { primaryEcho };
