// Ranger class code shared by the skill modules (ranger.ts: the existing six, rangerM1.ts: the six new): per-player and
// per-monster state, the mark system (Quarry Mark, spotting, Hunter's Accord), beast and device hit wrappers, Hatred
// spending, the per-tick hook and the death hook. Content: docs/rework/depth/RANGER.md (bible v2).

import { modVar, type SkillTag } from '../../shared';
import { pickTarget } from '../brain';
import { gainResource, isEliteTier, strikeMob, type HitResult } from '../damage';
import { addBuff, chillMob, dragMob, elIdx, getBuff, markMob, removeBuff, stunMob } from '../effects';
import type { Instance } from '../instance';
import { spawnLoot } from '../loot';
import { skillMult } from '../playerctx';
import { resolveStatus } from '../powerRuntime';
import { applyStatus } from '../status';
import type { Mob, Player, SkillRuntime, Strike, Summon } from '../types';
import type { DeathHook } from './common';

// ─────────────────────────── State ───────────────────────────

export interface RangerState {
  /** Enemy the primary last shot at (Pack Tactics). */
  lastShot: number;
  /** Tracking Arrows fired (Split Feathers). */
  arrows: number;
  /** Projectile casts (Farwatch 6) and the most recent Projectile / Aerial Spender (Farwatch 6, Rainkeeper 6). */
  projCasts: number;
  lastProjSpender: string | null;
  lastAerialSpender: string | null;
  /** Quarry Mark: the marked enemy, its bonus, until when (inst.t), Second Quarry. */
  quarry: number; quarryPct: number; quarryUntil: number;
  quarry2: number; quarry2Pct: number;
  /** Hatred Well: Hatred spent since the last cooldown cut. */
  spent: number;
  /** Alpha Howl: next howl. */
  howlT: number;
  /** Roost Charm: cooldown cut so far in the current cooldown of a skill (skill → [readyAt seen, ms cut]). */
  roost: Map<string, [number, number]>;
  /** Rainkeeper 6: next free strike. */
  stormT: number;
  /** 250 ms cadence for the tick hook's slower work. */
  slowMs: number;
  /** Murmuration: elites the current flock killed (Return to Roost), feast extension (Crowfeast). */
  flockElites: number; flockFeastMs: number;
}

const states = new WeakMap<Player, RangerState>();
export function rstate(p: Player): RangerState {
  let s = states.get(p);
  if (!s) {
    s = { lastShot: 0, arrows: 0, projCasts: 0, lastProjSpender: null, lastAerialSpender: null, quarry: 0, quarryPct: 0, quarryUntil: 0, quarry2: 0, quarry2Pct: 0,
      spent: 0, howlT: 0, roost: new Map(), stormT: 0, slowMs: 0, flockElites: 0, flockFeastMs: 0 };
    states.set(p, s);
  }
  return s;
}

/** Per-monster ranger state: who marked it with a class mark (Hunter's Accord moves it), sentry hit times (Crossfire). */
export interface RangerMobState { markedBy: number; sentryHits: Map<number, number> }
const mobStates = new WeakMap<Mob, RangerMobState>();
export function rmob(m: Mob): RangerMobState {
  let s = mobStates.get(m);
  if (!s) { s = { markedBy: 0, sentryHits: new Map() }; mobStates.set(m, s); }
  return s;
}

// ─────────────────────────── Small queries ───────────────────────────

export const rv = (rt: SkillRuntime, name: string): number => modVar(rt.mods, name);
export const isRanger = (p: Player) => p.save.classId === 'ranger';

/** Skills on the bar (primary + slots). */
export function bar(p: Player): SkillRuntime[] {
  const out: SkillRuntime[] = [p.ctx.primary];
  for (const s of p.ctx.slots) if (s) out.push(s);
  return out;
}

/** The skill's tags as the powers see them (rune changes and tag grants included). */
export const hasTag = (p: Player, skill: string, tag: SkillTag): boolean => !!p.ctx.powers.index.get(skill)?.has(tag);

/** A flag on any bar skill (item / set flags are granted to every skill with a tag). */
export const barFlag = (p: Player, flag: string): SkillRuntime | null => bar(p).find((rt) => rt.flags.has(flag)) ?? null;

/** Highest `var:` value on the bar (tag-keyed item rolls land on every skill with the tag). */
export function barVar(p: Player, name: string): number {
  let v = 0;
  for (const rt of bar(p)) v = Math.max(v, rv(rt, name));
  return v;
}

export function nearestMob(inst: Instance, x: number, y: number, r: number, skip?: (m: Mob) => boolean): Mob | null {
  return inst.mobHash.nearest(x, y, r, (o) => !o.dead && !(skip && skip(o)));
}

/** The strongest enemy (elites first, then life) within r. */
export function strongestMob(inst: Instance, x: number, y: number, r: number, skip?: (m: Mob) => boolean): Mob | null {
  let best: Mob | null = null, score = -1;
  for (const m of inst.queryMobs(x, y, r)) {
    if (m.dead || (skip && skip(m))) continue;
    const s = (isEliteTier(m.tier) ? 1e15 : 0) + m.hp;
    if (s > score) { score = s; best = m; }
  }
  return best;
}

/** Shorten the cooldowns of bar skills whose tags match. */
export function reduceCooldowns(inst: Instance, p: Player, ms: number, tag: SkillTag | null, only?: string) {
  if (ms <= 0) return;
  for (const rt of bar(p)) {
    if (only && rt.def.id !== only) continue;
    if (tag && !hasTag(p, rt.def.id, tag)) continue;
    const at = p.readyAt.get(rt.def.id);
    if (at !== undefined && at > inst.t) p.readyAt.set(rt.def.id, Math.max(inst.t, at - ms));
  }
}

/** Give Hatred back during a cast that is about to pay its cost (brain pays after `cast` returns). */
export function refundDuringCast(p: Player, amount: number, cost: number) {
  if (amount > 0) p.res = Math.min(p.mres + cost, p.res + amount);
}

// ─────────────────────────── Spending, casts ───────────────────────────

/** Hatred Well: every 100 Hatred spent cuts your Cooldown skills' cooldowns by 1 s. Called by every paid cast. */
export function noteSpend(inst: Instance, p: Player, amount: number) {
  if (amount <= 0 || !p.ctx.primary.flags.has('hatredWell')) return;
  const st = rstate(p);
  st.spent += amount;
  while (st.spent >= 100) { st.spent -= 100; reduceCooldowns(inst, p, 1000, 'cooldown'); }
}

/** Remember the latest Projectile / Aerial Spender and count Projectile casts (Farwatch 6). True = a farwatch shot is due. */
export function noteCast(p: Player, rt: SkillRuntime): boolean {
  const st = rstate(p), id = rt.def.id;
  if (hasTag(p, id, 'spender') && hasTag(p, id, 'projectile')) st.lastProjSpender = id;
  if (hasTag(p, id, 'spender') && hasTag(p, id, 'aerial')) st.lastAerialSpender = id;
  if (!hasTag(p, id, 'projectile') || !rt.flags.has('farwatchShot')) return false;
  st.projCasts++;
  return st.projCasts % 5 === 0;
}

// ─────────────────────────── Marks ───────────────────────────

/** Mark an enemy for this ranger: the bonus never drops below a stronger mark already on it. */
export function rangerMark(inst: Instance, p: Player, m: Mob, ms: number, pct: number) {
  if (m.markMs > 0 && m.markPct > pct) { m.markMs = Math.max(m.markMs, ms); return; }
  markMob(m, ms, pct, inst, p);
  rmob(m).markedBy = p.id;
}

/** Spot (Farwatch 4): "marked" state for 3 s without lowering a bonus already there. */
export function spot(inst: Instance, p: Player, m: Mob, ms = 3000) {
  if (m.markMs > 0) { m.markMs = Math.max(m.markMs, ms); return; }
  markMob(m, ms, 0, inst, p);
  rmob(m).markedBy = p.id;
}

export const quarryOf = (inst: Instance, p: Player): Mob | null => {
  const st = rstate(p);
  if (!st.quarry || inst.t > st.quarryUntil) return null;
  const m = inst.mob(st.quarry);
  return m && !m.dead ? m : null;
};

/** Your summons hunt the quarry first, then (Snarewright 4 for Devices) stunned enemies, then the usual pick. */
export function summonTarget(inst: Instance, p: Player, x: number, y: number, range: number, needLos: boolean, device = false): Mob | null {
  const q = quarryOf(inst, p);
  if (q && Math.hypot(q.x - x, q.y - y) <= range + q.r) return q;
  if (device && p.ctx.slots.some((rt) => rt?.flags.has('deviceStunFirst'))) {
    const s = nearestMob(inst, x, y, range, (o) => o.stunMs <= 0);
    if (s) return s;
  }
  return pickTarget(inst, x, y, range, needLos, p.save.skills.targetPriority);
}

/** A mark moved to a new enemy: Hunting Horn (beasts), Huntsman's Pauldrons (summons). */
export function markMoved(inst: Instance, p: Player, from: { x: number; y: number }, to: Mob) {
  inst.emit({ e: 'beam', v: 'quarry_jump', x: Math.round(from.x), y: Math.round(from.y), tx: Math.round(to.x), ty: Math.round(to.y), el: 0, d: 400 }, to.x, to.y, p.id);
  const horn = rv(p.ctx.modsOf('quarry_mark'), 'markHorn');
  if (horn > 0) addBuff(p, { id: 'hunting_horn', ms: 4000, hidden: true });
  if (p.ctx.primary.flags.has('huntsman')) addBuff(p, { id: 'huntsman', ms: 5000 });
}

/** Apply the quarry to `m` for the rest of the mark (sigil follows the monster). */
export function setQuarry(inst: Instance, p: Player, m: Mob, pct: number, untilT: number) {
  const st = rstate(p);
  st.quarry = m.id; st.quarryPct = pct; st.quarryUntil = untilT;
  rangerMark(inst, p, m, Math.min(1000, untilT - inst.t), pct);
  const d = Number.isFinite(untilT) ? Math.round(untilT - inst.t) : 60_000;
  inst.emit({ e: 'aoe', v: 'quarry_mark', x: Math.round(m.x), y: Math.round(m.y), r: Math.round(m.r), d, el: 0, s: m.id, f: 1 }, m.x, m.y, p.id);
}

// ─────────────────────────── Beasts and devices ───────────────────────────

/** Beast strike bonuses that depend on the target (Pack Signal, Hunting Horn) or your Hatred (Kinship). */
export function beastStrike(inst: Instance, p: Player, base: Strike, m: Mob): Strike {
  let mult = base.mult ?? 1;
  const qrt = p.ctx.modsOf('quarry_mark');
  if (rstate(p).quarry === m.id) { const sig = rv(qrt, 'markBeasts'); if (sig) mult *= 1 + sig / 100; }
  if (getBuff(p, 'hunting_horn')) mult *= 1 + rv(qrt, 'markHorn') / 100;
  if (p.ctx.modsOf(base.skill).flags.has('kinship')) mult *= 1 + Math.min(25, Math.max(0, p.res) / 5) / 100;
  return mult === (base.mult ?? 1) ? base : { ...base, mult };
}

/**
 * One Beast attack (companion bite, heron spear, badger burst, falcon): the strike plus Kinship's heal, Thicket Kin
 * (Hatred, marking, leaps), Trailhide Breeches (splash), Rough and Tumble (stun).
 */
export function beastHit(inst: Instance, p: Player, m: Mob, st: Strike, src: Summon | null): HitResult {
  const rt = p.ctx.modsOf(st.skill);
  const s = beastStrike(inst, p, { ...st, src: src?.id ?? st.src }, m);
  const r = strikeMob(inst, p, m, s);
  if (rt.flags.has('kinship')) p.hp = Math.min(p.mhp, p.hp + p.mhp * 0.002);
  if (rt.flags.has('beastGen')) gainResource(p, 1);
  if (rt.flags.has('beastMark') && !quarryOf(inst, p) && !m.dead && m.markMs <= 0) rangerMark(inst, p, m, 3000, 20);
  const stun = rv(p.ctx.modsOf('companion'), 'compStun');
  if (st.skill === 'companion' && stun > 0 && !m.dead && inst.rng.next() * 100 < stun) stunMob(m, 500, inst, p);
  if (rt.flags.has('trailhide')) for (const o of inst.queryMobs(m.x, m.y, 60 + m.r)) if (o !== m && !o.dead) strikeMob(inst, p, o, { ...s, noProc: true });
  if (rt.flags.has('beastLeap')) {
    let n = 0;
    for (const o of inst.queryMobs(m.x, m.y, 160)) {
      if (o === m || o.dead || n >= 2) continue;
      n++;
      strikeMob(inst, p, o, { ...s, coef: s.coef * 0.25, noProc: true });
      inst.emit({ e: 'beam', v: 'heron_spear', x: Math.round(m.x), y: Math.round(m.y), tx: Math.round(o.x), ty: Math.round(o.y), el: elIdx(s.el), d: 160 }, o.x, o.y, p.id);
    }
  }
  return r;
}

/** Hits by Devices on stunned enemies re-arm a spent Trap nearby (Snarewright 6); set by the snare module. */
export const deviceHooks: { rearmNear: ((inst: Instance, p: Player, x: number, y: number) => void) | null } = { rearmNear: null };
export function deviceHit(inst: Instance, p: Player, m: Mob, st: Strike): HitResult {
  const stunned = m.stunMs > 0;
  const r = strikeMob(inst, p, m, st);
  if (stunned && deviceHooks.rearmNear && p.ctx.modsOf(st.skill).flags.has('trapRearm')) deviceHooks.rearmNear(inst, p, m.x, m.y);
  return r;
}

/** Attacks per second multiplier of a device (Fuse Cord Belt) or beast (Whistle Charm). */
export const deviceRate = (rt: SkillRuntime) => 1 + rv(rt, 'deviceIas') / 100;
export const beastRate = (rt: SkillRuntime) => 1 + rv(rt, 'beastIas') / 100;

// ─────────────────────────── Per-tick hook ───────────────────────────

/** Ranger upkeep every tick (owner hook): quarry, splash marks, Tracker, Alpha Howl, Hatred Well, Rainkeeper 4. */
export function rangerTick(inst: Instance, p: Player, dtMs: number) {
  if (!isRanger(p) || p.deadMs > 0) return;
  const st = rstate(p);
  // Hatred Well: regeneration doubled below 40 Hatred.
  if (p.res < 40 && p.ctx.primary.flags.has('hatredWell') && p.ctx.d.resourceRegen > 0) p.res = Math.min(p.mres, p.res + p.ctx.d.resourceRegen * dtMs / 1000);
  const q = quarryOf(inst, p);
  if (st.quarry && !q && inst.t > st.quarryUntil) st.quarry = 0;
  if (q) {
    const left = st.quarryUntil - inst.t;
    if (q.markMs < 300 || q.markPct < st.quarryPct) { q.markMs = Math.max(q.markMs, Math.min(1000, left)); q.markPct = Math.max(q.markPct, st.quarryPct); }
  }
  st.slowMs -= dtMs;
  if (st.slowMs > 0) return;
  st.slowMs += 250;
  const qrt = p.ctx.modsOf('quarry_mark');
  if (q) {
    if (qrt.flags.has('markSlow')) chillMob(q, 600, inst, p);                                     // Bloodhound
    const weaken = rv(qrt, 'markWeaken');
    if (weaken > 0) applyStatus(inst, p, q, resolveStatus({ kind: 'weaken', ms: 600, pct: weaken }, p.ctx.powers.index), p.x, p.y, 'quarry_mark'); // Exposed Joints
    const splash = qrt.flags.has('markSplash') ? 120 : 0, accord = p.ctx.primary.flags.has('huntersAccord') ? 150 : 0;
    const reach = Math.max(splash, accord);
    if (reach) for (const o of inst.queryMobs(q.x, q.y, reach)) if (o !== q && !o.dead) rangerMark(inst, p, o, 600, st.quarryPct / 2); // Open Season / Hunter's Accord
    const haste = rv(qrt, 'markHaste');
    if (haste > 0) {
      const near = Math.hypot(q.x - p.x, q.y - p.y) <= 400;
      if (near) addBuff(p, { id: 'tracker', ms: 600, ias: haste }); else if (getBuff(p, 'tracker')) removeBuff(p, 'tracker');
    }
  }
  if (st.quarry2) {
    const m2 = inst.mob(st.quarry2);
    if (m2 && !m2.dead && inst.t <= st.quarryUntil) rangerMark(inst, p, m2, 600, st.quarry2Pct); else st.quarry2 = 0;
  }
  // Alpha Howl: every 10 s while a companion lives.
  const howl = rv(p.ctx.modsOf('companion'), 'compHowl');
  if (howl > 0 && p.summons.some((s) => s.skill === 'companion' && !s.dead) && inst.t >= st.howlT) {
    st.howlT = inst.t + 10_000;
    addBuff(p, { id: 'alpha_howl', ms: 4000, dmg: howl });
  }
  // Rainkeeper 4: while one of your Aerial or Ground effects is active.
  if (p.ctx.slots.some((rt) => rt?.flags.has('rainkeeperActive')) || p.ctx.primary.flags.has('rainkeeperActive')) {
    const active = inst.grounds.some((g) => g.owner === p && g.endT > inst.t) || p.summons.some((s) => !s.dead && (s.type === 'mortar' || s.type === 'flock'));
    if (active) addBuff(p, { id: 'rainkeeper', ms: 400, cost: -30 }); else if (getBuff(p, 'rainkeeper')) removeBuff(p, 'rainkeeper');
  }
}

// ─────────────────────────── Death hook ───────────────────────────

/** Quarry jumps, Bounty, Hunter's Accord, Roost Charm, Crowfeast / Return to Roost bookkeeping. */
export const rangerDeathHook: DeathHook = (inst, m, killer, skill) => {
  // Every ranger in the instance whose quarry this was: the mark jumps (to the strongest enemy within 300).
  for (const p of inst.players) {
    if (!isRanger(p)) continue;
    const st = rstate(p);
    if (st.quarry === m.id) {
      const qrt = p.ctx.modsOf('quarry_mark');
      if (killer === p && qrt.flags.has('markBounty')) { gainResource(p, 30); spawnLoot(inst, p, { type: 'globe' }, m.x, m.y); }
      const next = inst.t <= st.quarryUntil ? strongestMob(inst, m.x, m.y, 300, (o) => o === m) : null;
      if (next) { setQuarry(inst, p, next, st.quarryPct, st.quarryUntil); markMoved(inst, p, m, next); } else st.quarry = 0;
    } else if (rmob(m).markedBy === p.id && m.markPct > 0 && p.ctx.primary.flags.has('huntersAccord')) {
      // Hunter's Accord: other class marks move at once to the nearest enemy within 150.
      const next = nearestMob(inst, m.x, m.y, 150, (o) => o === m || o.markMs > 0);
      if (next) { rangerMark(inst, p, next, Math.max(500, m.markMs), m.markPct); markMoved(inst, p, m, next); }
    }
  }
  if (!killer || !isRanger(killer)) return;
  const st = rstate(killer);
  if (skill === 'murmuration') {
    if (isEliteTier(m.tier)) st.flockElites++;
    if (killer.ctx.modsOf('murmuration').flags.has('flockFeast')) { gainResource(killer, 2); st.flockFeastMs = Math.min(5000, st.flockFeastMs + 500); }
  }
  // Roost Charm: kills by your Summons cut your Cooldown skills' cooldowns by 0.5 s, at most v s per cooldown.
  if (hasTag(killer, skill, 'summon')) {
    const cap = barVar(killer, 'roostCharm') * 1000;
    if (cap > 0) for (const rt of bar(killer)) {
      if (!hasTag(killer, rt.def.id, 'cooldown')) continue;
      const at = killer.readyAt.get(rt.def.id);
      if (at === undefined || at <= inst.t) continue;
      // Same cooldown while readyAt has not jumped above the value our last cut left (a new cast resets the cap).
      const seen = st.roost.get(rt.def.id), cut = seen && at <= seen[0] ? seen[1] : 0;
      const take = Math.min(500, cap - cut);
      if (take <= 0) continue;
      const now = Math.max(inst.t, at - take);
      killer.readyAt.set(rt.def.id, now);
      st.roost.set(rt.def.id, [now, cut + take]);
    }
  }
};

// ─────────────────────────── Generic helpers for the modules ───────────────────────────

/** Expected-damage friendly helper: own multiplier of a sub-strike that the brain does not build (summon strikes). */
export const ownOf = (p: Player, skill: string) => skillMult(p, skill);

/** Drag every enemy within `r` of (x, y) by `step` toward that point. */
export function gather(inst: Instance, p: Player, x: number, y: number, r: number, step: number) {
  for (const o of inst.queryMobs(x, y, r)) if (!o.dead) dragMob(inst, o, x, y, step, p);
}
