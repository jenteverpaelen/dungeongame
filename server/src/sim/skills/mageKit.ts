// Mage behaviour plumbing shared by mage.ts (the six original skills) and mageM1.ts (bible v2 skills).
// Everything here is class-local (FOUNDATION.md §5: behaviour no template expresses = a flag / var + class-module code):
//   * per-player and per-monster mage state (WeakMaps: nothing is added to the shared sim types or to saves);
//   * the mage hit wrapper and the chill / freeze helpers (node, rune, legendary and set rules on mage hits);
//   * mage projectiles (Proj.hook): missiles, needles, shards, hydra spit and kin bolts with their on-hit rules;
//   * Arcane Power spent (Starborn, Fallen Star 6), the per-tick owner hook and the death hook.
// Generic primitives the engine provides (procs, defensive templates, statuses, data grounds, conditions) are not
// re-implemented here; see docs/rework/depth/MAGE-PILOT.md.

import { MAGE_FX, PLAYER_RADIUS, TICK_MS, modVar, skillTags, type Element, type SkillTag } from '../../shared';
import { gainResource, healPlayer, strikeMob, type HitResult } from '../damage';
import { addBuff, ccFactor, chillMob, distToSegment, elIdx, freezeMob, getBuff, knockbackMob, shotBlockedAt } from '../effects';
import { placeGround } from '../groundFx';
import type { Instance } from '../instance';
import { skillElement, skillMult, skillPct } from '../playerctx';
import { resolveStatus } from '../powerRuntime';
import { endProjectile, spawnProj } from '../projectiles';
import { applyStatus } from '../status';
import type { Ground, Mob, Player, Proj, ProjHook, SkillRuntime, Strike, Summon } from '../types';
import { DEG, fanAngles, type DeathHook, type OwnerSummonHook } from './common';
// Runtime calls only (module cycle with the skill modules; nothing here runs at import time).
import { copyGround, freeNovaCast, hydraGone } from './mage';
import { kinGone, spawnEmberSprite } from './mageM1';

const TAU = Math.PI * 2;

// ─────────────────────────── State ───────────────────────────

/** A live Rimefield (mageM1.ts): Ice Mirror extends it, Brittle Ground and Glass Concord look inside it. */
export interface Rimefield { x: number; y: number; r: number; endT: number; ended: boolean; ground: Ground | null }

export interface MageState {
  /** Starborn: Arcane Power spent toward the next falling star. */
  spent: number;
  /** Regalia of the Fallen Star 6: Spender casts toward the fourth. */
  spenderCasts: number;
  /** Living mage summons by id at the last tick (expiry detection: kin bursts, Last Breath, lanterns). */
  summons: Map<number, GoneSummon>;
  /** Retort of Frost: damage taken at the last tick and the next time it may fire. */
  lastTaken: number;
  reflexT: number;
  /** Thrumming Ray: the resonance (ms of ramp) at the last tick, for the kept ramp (Sustained Note, Resonance). */
  rampMs: number;
  rampT: number;
  /** Lantern Garden 6: Summon attacks toward the next ember sprite. */
  summonAttacks: number;
  fields: Rimefield[];
  /** The Thrumming Ray's last beam (Conductor arcs to it), and the live Stormglass Orbs. */
  ray: { a: number; len: number; t: number } | null;
  orbs: Set<Proj>;
  /** Rimewalker Slippers: your most recent Ground effect (copied at half size when a Movement skill ends). */
  lastGround: LastGround | null;
  /** Rimewalker Slippers: the marker buff its dashEnd proc granted that was already answered, and its time left then. */
  walkerSeen: unknown;
  walkerMs: number;
}

/** A Ground effect the mage placed: molten ground (Meteor), a Black Hole or a Rimefield, with its radius. */
export interface LastGround { kind: 'molten' | 'blackhole' | 'rime'; skill: string; r: number; scale: number }

const players = new WeakMap<Player, MageState>();
export function mstate(p: Player): MageState {
  let s = players.get(p);
  if (!s) {
    s = { spent: 0, spenderCasts: 0, summons: new Map(), lastTaken: p.taken, reflexT: -1e9, rampMs: 0, rampT: -1e9, summonAttacks: 0, fields: [], ray: null, orbs: new Set(), lastGround: null, walkerSeen: null, walkerMs: 0 };
    players.set(p, s);
  }
  return s;
}

export interface MageMobState {
  /** Rime Needles: times of the needles that hit it (freeze build-up, 2 s window). */
  needles: number[];
  /** Hoarfrost Vigil 6: chilled continuously since (sampled at mage hits) and the last deep freeze. */
  chillSince: number;
  chillSeen: number;
  deepFrostT: number;
  /** Hydra Heat Shimmer: times of the Hydra shots that hit it. */
  hydraHits: number[];
  /** Permafrost Seal: the next time a Rimefield may freeze it. */
  sealT: number;
}
const mobs = new WeakMap<Mob, MageMobState>();
export function mobState(m: Mob): MageMobState {
  let s = mobs.get(m);
  if (!s) { s = { needles: [], chillSince: -1e9, chillSeen: -1e9, deepFrostT: -1e9, hydraHits: [], sealT: -1e9 }; mobs.set(m, s); }
  return s;
}

// ─────────────────────────── Small queries ───────────────────────────

/** Skills on the bar (primary + slots). */
export function barSkills(p: Player): SkillRuntime[] {
  const out: SkillRuntime[] = [p.ctx.primary];
  for (const s of p.ctx.slots) if (s) out.push(s);
  return out;
}
/** The runtime of a skill if it is on the bar (primary or a slot), else null: node and rune rules apply only then. */
export function onBar(p: Player, id: string): SkillRuntime | null {
  return p.ctx.primary.def.id === id ? p.ctx.primary : p.ctx.slotted(id);
}
export function tagsOf(p: Player, rt: SkillRuntime): Set<SkillTag> {
  return skillTags(rt.def, p.save.skills.runes[rt.def.id]);
}
export const mageOf = (p: Player | null | undefined): p is Player => !!p && p.save.classId === 'mage';

/** Nearest living enemy to (x, y) within `r`, excluding `not`. */
export function nearestMob(inst: Instance, x: number, y: number, r: number, not?: ReadonlySet<Mob> | Mob | null): Mob | null {
  let best: Mob | null = null, bd = Infinity;
  for (const m of inst.queryMobs(x, y, r)) {
    if (m.dead || m === not || (not instanceof Set && not.has(m))) continue;
    const d = (m.x - x) ** 2 + (m.y - y) ** 2;
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

/** Shorten the cooldowns of bar skills whose tags match (Rimecourt Band, Cold Return). */
export function reduceCooldowns(inst: Instance, p: Player, ms: number, tag: SkillTag | null, only?: string) {
  if (ms <= 0) return;
  for (const rt of barSkills(p)) {
    if (only && rt.def.id !== only) continue;
    if (tag && !tagsOf(p, rt).has(tag)) continue;
    const at = p.readyAt.get(rt.def.id);
    if (at !== undefined && at > inst.t) p.readyAt.set(rt.def.id, Math.max(inst.t, at - ms));
  }
}

/** Refund a cooldown after the cast that sets it (the brain sets the cooldown right after `cast` returns). */
export function refundCooldownLater(inst: Instance, p: Player, skill: string, ms: number) {
  if (ms > 0) inst.sched.schedule(inst.t, () => reduceCooldowns(inst, p, ms, null, skill));
}

/** Resource during a cast that is about to pay its cost: uncapped by the cost, so the refund survives the payment. */
export function refundDuringCast(p: Player, amount: number, cost: number) {
  if (amount > 0) p.res = Math.min(p.mres + cost, p.res + amount);
}

/** Is (x, y) inside one of the player's own ground effects (any kind; line grounds by their segment)? */
export function inOwnGroundAt(inst: Instance, p: Player, x: number, y: number, pad = 0): boolean {
  for (const g of inst.grounds) {
    if (g.owner !== p || g.endT <= inst.t) continue;
    const fx = g.fx;
    if (fx && fx.def.shape === 'line') { if (distToSegment(x, y, fx.ax, fx.ay, fx.bx, fx.by) <= g.r + pad) return true; }
    else if ((g.x - x) ** 2 + (g.y - y) ** 2 <= (g.r + pad) ** 2) return true;
  }
  return false;
}
const hasOwnGround = (inst: Instance, p: Player) => inst.grounds.some((g) => g.owner === p && g.endT > inst.t);

/** Outward reach along a line: `range`, or the last free point before a wall. */
export function lineReach(inst: Instance, x: number, y: number, ux: number, uy: number, range: number): number {
  for (let d = 20; d <= range; d += 20) if (shotBlockedAt(inst, x + ux * d, y + uy * d)) return Math.max(20, d - 20);
  return range;
}

/** A strike of `rt` scaled by `scale` (coefficient), keeping its skill bucket and own multiplier. */
export function scaled(st: Strike, scale: number, extra: Partial<Strike> = {}): Strike {
  return { ...st, coef: st.coef * scale, ...extra };
}

// ─────────────────────────── Chill and freeze ───────────────────────────

/** A freeze budget shared by one cast (Rimecourt Band: "at most {v} seconds per cast"). */
export interface CastBudget { rimecourt: number }
export const newBudget = (p: Player): CastBudget => ({ rimecourt: p.ctx.power('rimecourt_band') });

/**
 * Freeze with the mage's freeze rules: Hoarfrost Vigil 4 (the chill lingers 1 s after the freeze), Rimecourt Band
 * (each enemy frozen shortens Chill skills by 0.5 s, budget per cast). Returns true when the enemy can be frozen.
 */
export function mFreeze(inst: Instance, p: Player, m: Mob, ms: number, budget: CastBudget | null, shatterBy = 0, depth = 0): boolean {
  if (m.dead || ccFactor(m) <= 0 || ms <= 0) return false;
  freezeMob(m, ms, shatterBy, depth, inst, p);
  if (p.ctx.anyFlag('chillLinger')) chillMob(m, m.freezeMs + 1000, inst, p);
  if (budget && budget.rimecourt > 0) {
    const s = Math.min(0.5, budget.rimecourt);
    budget.rimecourt -= s;
    reduceCooldowns(inst, p, s * 1000, 'chill');
  }
  return true;
}

/** Chill with the mage's chill rules: Snowblind (Rime Needles node: chilled enemies deal less damage). */
export function mChill(inst: Instance, p: Player, m: Mob, ms: number) {
  if (m.dead) return;
  chillMob(m, ms, inst, p);
  const rn = onBar(p, 'rime_needles');
  const blind = rn ? modVar(rn.mods, 'needleWeaken') : 0;
  if (blind > 0 && m.chillMs > 0) applyStatus(inst, p, m, resolveStatus({ kind: 'weaken', pct: blind, ms: m.chillMs }, p.ctx.powers.index), p.x, p.y, 'rime_needles');
}

/** A movement slow of chosen strength (engine wave 3 status `slow`: the strongest active slow counts, max 90 %). */
export function mSlow(inst: Instance, p: Player, m: Mob, pct: number, ms: number, source: string) {
  if (m.dead || pct <= 0 || ms <= 0) return;
  applyStatus(inst, p, m, resolveStatus({ kind: 'slow', pct, ms }, p.ctx.powers.index), p.x, p.y, source);
}

/** The engine chill slows movement and attacks by 40 % [M] (monsters.ts: × 0.6). */
const CHILL_MOVE = 0.6;
/**
 * A chill of a stated strength above the engine's 40 % (Rimefield "chilled 50 %", Deep Chill "Chill 60 %"): the chill
 * (state, attack slow) plus a movement slow that brings movement to (100 − pct) % of normal, lasting as long as the
 * chill (so Chill Margin's longer chills keep it). Chill strengths at or below 40 % are the plain chill.
 */
export function mChillAt(inst: Instance, p: Player, m: Mob, ms: number, pct: number, source: string) {
  mChill(inst, p, m, ms);
  const extra = 100 * (1 - (1 - pct / 100) / CHILL_MOVE);
  if (extra > 0 && m.chillMs > 0) mSlow(inst, p, m, extra, m.chillMs, source);
}

// ─────────────────────────── The mage hit ───────────────────────────

/** Per-cast tally of a Spender (Static Loop: 1 AP per enemy hit, at most 8 per cast). */
export interface CastTally { hit: Set<Mob>; refunded: number }
export const newTally = (): CastTally => ({ hit: new Set(), refunded: 0 });

/**
 * strikeMob plus the mage's own on-hit rules: Brittle (Frost Nova node: crit chance against frozen enemies), Hoarfrost
 * Vigil 6 (chilled for 3 s straight → a 1 s freeze, once per 6 s), Frostthread Gloves (Primary hits re-freeze), Static
 * Loop (Spender refunds), Lantern Garden 6 (Summon attacks call ember sprites, counted by the summon code).
 */
export function mHit(inst: Instance, p: Player, m: Mob, st: Strike, rt: SkillRuntime | null, tally: CastTally | null = null): HitResult {
  if (m.dead) return { amount: 0, crit: false, killed: false };
  const frozen = m.freezeMs > 0;
  let s = st;
  if (frozen) {
    const fn = onBar(p, 'frost_nova');
    const brittle = fn ? modVar(fn.mods, 'novaBrittle') : 0;
    if (brittle > 0) s = { ...s, chc: (s.chc ?? 0) + brittle };
  }
  // Hoarfrost Vigil 6: the chill is sampled at every mage hit (gaps under 0.5 s count as continuous).
  if (m.chillMs > 0 && p.ctx.anyFlag('deepFrost')) {
    const ms = mobState(m);
    if (inst.t - ms.chillSeen > 500) ms.chillSince = inst.t;
    ms.chillSeen = inst.t;
    if (inst.t - ms.chillSince >= 3000 && inst.t - ms.deepFrostT >= 6000 && !frozen) {
      ms.deepFrostT = inst.t; ms.chillSince = inst.t;
      mFreeze(inst, p, m, 1000, null);
    }
  }
  const r = strikeMob(inst, p, m, s);
  if (rt && frozen && s.primary && rt.flags.has('refreeze') && !r.killed && !m.dead) m.freezeMs = Math.max(m.freezeMs, 250 * ccFactor(m));
  if (tally && rt?.flags.has('staticLoop') && !tally.hit.has(m)) {
    tally.hit.add(m);
    if (tally.refunded < 8) { tally.refunded++; gainResource(p, 1); }
  }
  return r;
}

// ─────────────────────────── Arcane Power spent ───────────────────────────

/**
 * Arcane Power actually spent (slot casts: their cost, called during the cast; channels: the drain). Starborn: every 30
 * spent calls a small falling star on a nearby enemy for 150 % weapon damage as Fire.
 */
export function noteSpend(inst: Instance, p: Player, amount: number) {
  if (amount <= 0 || !p.ctx.anyFlag('starborn')) return;
  const ms = mstate(p);
  ms.spent += amount;
  while (ms.spent >= 30) {
    ms.spent -= 30;
    const t = nearestMob(inst, p.x, p.y, 380);
    if (!t) continue;
    const x = t.x, y = t.y, fall = 450;
    inst.emit({ e: 'tele', v: 'meteor', x: Math.round(x), y: Math.round(y), r: 36, d: fall, s: p.id }, x, y, p.id);
    inst.sched.schedule(inst.t + fall, () => {
      if (inst.playerById(p.id) !== p) return;
      const target = t.dead ? nearestMob(inst, x, y, 60) : t;
      if (target) strikeMob(inst, p, target, { skill: 'starborn_star', coef: 1.5, el: 'fire', pct: 0, mult: skillMult(p, 'starborn_star'), noArea: true });
      inst.emit({ e: 'aoe', v: 'meteorSmall', x: Math.round(x), y: Math.round(y), r: 36, d: 400, el: elIdx('fire'), s: p.id }, x, y, p.id);
    });
  }
}

// ─────────────────────────── Projectiles ───────────────────────────

/** What a mage projectile does on hit. Every field is optional; the projectile's skill runtime carries the item flags. */
export interface BoltRules {
  rt: SkillRuntime;
  /** Primary projectile (Magic Missile, Rime Needles volley): primary-hit procs. */
  primary?: boolean;
  /** Ends on the first hit unless a pierce rule lets it continue: remaining pierces, and the damage factor after each. */
  pierce?: number; pierceScale?: number;
  /** Pierces everything (Glacier Spine), optional knockback distance. */
  pierceAll?: boolean; push?: number;
  /** Area splash on impact (radius, factor of the hit's coefficient). */
  splash?: number;
  /** Status effects on hit. */
  chillMs?: number; freezeChance?: number;
  /** Chill strength above the engine's 40 % (Deep Chill 60 %): `mChillAt` instead of the plain chill. */
  chillPct?: number;
  /** Rime Needles: counts toward the freeze build-up (threshold needles in 2 s → freeze `freezeMs`). */
  needle?: { threshold: number; freezeMs: number; gen: number; splinter: boolean; splitKill: number };
  /** Magic Missile rules (rune and nodes): resource per hit, Volley of Glass, Static Thread, Void Bolt. */
  missile?: { gen: number; shatter: boolean; chain: number; voidBolt: number };
  /** Lightning chains on hit: extra enemies within `range` at `scale` (Forked Tongues). */
  chains?: { n: number; range: number; scale: number };
  /** A shard / splinter: never splits again (no Glass Concord split, no shatter on kill). */
  shard?: boolean;
  /** Summon projectile: the summon's id is the damage source (Coiled Pauldrons pierce in a short line). */
  summon?: Summon;
  /** Heat Shimmer counting (Hydra shots). */
  hydra?: boolean;
  /** Per-cast tally (Static Loop). */
  tally?: CastTally | null;
  /** Cast-wide freeze budget (Rimecourt Band). */
  budget?: CastBudget | null;
}

interface BoltState { pierced: number; split: boolean; glassPierced: number; shortLine: number }

/** Fire a mage projectile with BoltRules (Proj.hook). Returns the projectile. */
export function fireBolt(inst: Instance, p: Player, rules: BoltRules, st: Strike, o: { v: string; x: number; y: number; angle: number; speed: number; lifeMs: number; r: number; homing?: number; turn?: number; seek?: boolean; hits?: Set<number> | null; sz?: number; keepLife?: boolean }): Proj {
  const state: BoltState = { pierced: 0, split: false, glassPierced: 0, shortLine: -1 };
  const hook: ProjHook = { hit: (i, pr, pl, m) => boltHit(i, pr, pl, m, rules, state) };
  return spawnProj(inst, {
    kind: 'missile', v: o.v, owner: p, src: rules.summon?.id ?? p.id, x: o.x, y: o.y, angle: o.angle, speed: o.speed, lifeMs: o.lifeMs, r: o.r,
    el: st.el, strike: st, homing: o.homing ?? 0, turn: o.turn ?? 0, seek: o.seek, hits: o.hits ?? null, hook, sz: o.sz, keepLife: o.keepLife,
  });
}

/** Spawn shards from (x, y): `n` seeking (or straight) projectiles of the parent strike at `scale`. */
export function shards(inst: Instance, p: Player, rules: BoltRules, st: Strike, x: number, y: number, angles: number[], scale: number, seek: boolean, not: Set<number>, v = 'shard') {
  for (const a of angles) {
    const t = seek ? nearestMob(inst, x + Math.cos(a) * 60, y + Math.sin(a) * 60, 260, null) : null;
    fireBolt(inst, p, { rt: rules.rt, shard: true, tally: rules.tally, budget: rules.budget, chillMs: rules.chillMs }, scaled(st, scale, { primary: false }), {
      v, x, y, angle: t ? Math.atan2(t.y - y, t.x - x) : a, speed: 760, lifeMs: 420, r: 9, homing: t && seek ? t.id : 0, turn: seek ? 8 : 0, seek, hits: new Set(not),
    });
  }
}

function boltHit(inst: Instance, pr: Proj, p: Player, m: Mob, rules: BoltRules, state: BoltState) {
  const rt = rules.rt, base = pr.strike!;
  const glass = !rules.shard && rt.flags.has('glassPierce') ? modVar(rt.mods, 'glassPierce') : 0; // Glasswright's Wraps
  // Damage factor of this hit: after a pierce (Piercing Will, Arcane Thorns 100 %, Glasswright 50 % × (1 + v)).
  let f = 1;
  if (state.pierced > 0) f *= rules.pierceScale ?? 1;
  if (state.glassPierced > 0) f *= 0.5 * (1 + glass / 100);
  const st = f !== 1 ? scaled(base, f) : base;
  const wasFrozen = m.freezeMs > 0;
  const inGround = !rules.shard && rt.flags.has('groundSplit') && inOwnGroundAt(inst, p, m.x, m.y);
  const r = mHit(inst, p, m, rules.primary ? { ...st, primary: true } : st, rt, rules.tally ?? null);
  if (!pr.hits) pr.hits = new Set();
  pr.hits.add(m.id);
  const alive = !r.killed && !m.dead;
  if (alive && rules.chillMs) { if (rules.chillPct) mChillAt(inst, p, m, rules.chillMs, rules.chillPct, rt.def.id); else mChill(inst, p, m, rules.chillMs); }
  if (alive && rules.freezeChance && inst.rng.next() < rules.freezeChance) mFreeze(inst, p, m, 1000, rules.budget ?? null);
  if (alive && rules.push) knockbackMob(m, pr.vx, pr.vy, rules.push, inst, p);
  const ux = pr.vx / (pr.speed || 1), uy = pr.vy / (pr.speed || 1), ang = Math.atan2(uy, ux);
  // Rime Needles: freeze build-up, Cold Capacitor, Shiver Splinter, Splitting Ice.
  const nd = rules.needle;
  if (nd) {
    if (alive && nd.threshold > 0) {
      const ms = mobState(m);
      ms.needles = ms.needles.filter((t) => inst.t - t <= 2000);
      ms.needles.push(inst.t);
      if (ms.needles.length >= nd.threshold && m.freezeMs <= 0) {
        ms.needles.length = 0;
        if (mFreeze(inst, p, m, nd.freezeMs, rules.budget ?? null) && nd.gen > 0) gainResource(p, nd.gen);
      }
    }
    if (nd.splinter && wasFrozen) shards(inst, p, { ...rules, needle: undefined }, base, m.x, m.y, [ang + 0.6, ang - 0.6], 0.5, true, new Set([m.id]), 'needle');
    if (nd.splitKill > 0 && r.killed) shards(inst, p, { ...rules, needle: undefined }, base, m.x, m.y, [ang + 0.5, ang - 0.5], nd.splitKill / 100, false, new Set([m.id]), 'needle');
  }
  // Magic Missile: Arcane Battery, Volley of Glass, Static Thread (+ Conductor's chains), Void Bolt.
  const mm = rules.missile;
  if (mm) {
    if (mm.gen > 0) gainResource(p, mm.gen);
    if (mm.shatter) shards(inst, p, { ...rules, missile: undefined }, base, m.x + ux * (m.r + 6), m.y + uy * (m.r + 6), [ang - 0.45, ang, ang + 0.45], 0.4, false, new Set([m.id]));
    if (mm.chain > 0) chainFrom(inst, p, rt, m, scaled(base, 0.7), mm.chain, 150, 'lightning', rules);
    if (mm.voidBolt > 0 && m.inHoleMs > 0) {
      const bst = scaled(st, mm.voidBolt / 100, { noArea: true, primary: false });
      for (const o of inst.queryMobs(m.x, m.y, 60)) if (!o.dead) mHit(inst, p, o, bst, rt);
      inst.emit({ e: 'aoe', v: 'explode', x: Math.round(m.x), y: Math.round(m.y), r: 60, d: 300, el: elIdx('arcane'), s: p.id }, m.x, m.y, p.id);
    }
  }
  if (rules.chains) chainFrom(inst, p, rt, m, scaled(base, rules.chains.scale), rules.chains.n, rules.chains.range, base.el, rules);
  if (rules.splash) {
    const sp = scaled(st, 1, { noArea: true });
    for (const o of inst.queryMobs(m.x, m.y, rules.splash)) if (o !== m && !o.dead) mHit(inst, p, o, sp, rt);
  }
  if (rules.hydra && alive) heatShimmer(inst, p, m);
  // Glass Concord 4: inside your Ground → 2 shards (once per projectile); 6: a kill shatters into 3 seeking shards.
  if (inGround && !state.split) { state.split = true; shards(inst, p, rules, base, m.x, m.y, [ang + 0.5, ang - 0.5], 0.4, false, new Set([m.id])); }
  if (r.killed && !rules.shard && rt.flags.has('shatterOnKill')) shards(inst, p, rules, base, m.x, m.y, [ang, ang + TAU / 3, ang - TAU / 3], 0.5, true, new Set([m.id]));
  // Continue or end.
  if (rules.pierceAll) return;
  if ((rules.pierce ?? 0) > state.pierced) { state.pierced++; return; }
  if (glass > 0 && state.glassPierced === 0) { state.glassPierced++; return; }
  // Coiled Pauldrons: summoned projectiles pierce in a short line (120 units [P] after the first hit).
  if (rules.summon && rt.flags.has('summonPierce')) {
    if (state.shortLine < 0) { state.shortLine = 1; pr.lifeMs = Math.min(pr.lifeMs, 120 / (pr.speed || 1) * 1000); }
    return;
  }
  endProjectile(inst, pr, true);
}

/** Lightning (or any) chain from an enemy to `n` more nearby enemies (beam 'arc' events). */
export function chainFrom(inst: Instance, p: Player, rt: SkillRuntime, from: Mob, st: Strike, n: number, range: number, el: Element, rules?: BoltRules) {
  const seen = new Set<Mob>([from]);
  let cur = from;
  for (let i = 0; i < n; i++) {
    const t = nearestMob(inst, cur.x, cur.y, range, seen);
    if (!t) break;
    seen.add(t);
    inst.emit({ e: 'beam', v: 'arc', x: Math.round(cur.x), y: Math.round(cur.y), tx: Math.round(t.x), ty: Math.round(t.y), el: elIdx(el), d: 180 }, t.x, t.y, p.id);
    mHit(inst, p, t, { ...st, noArea: true }, rt, rules?.tally ?? null);
    cur = t;
  }
}

/** Hydra Heat Shimmer: 3 Hydra shots within 1 s → a burn of v % weapon damage over 2 s. */
function heatShimmer(inst: Instance, p: Player, m: Mob) {
  const hy = p.ctx.slotted('hydra');
  const v = hy ? modVar(hy.mods, 'hydraIgnite') : 0;
  if (v <= 0) return;
  const ms = mobState(m);
  ms.hydraHits = ms.hydraHits.filter((t) => inst.t - t <= 1000);
  ms.hydraHits.push(inst.t);
  if (ms.hydraHits.length < 3) return;
  ms.hydraHits.length = 0;
  applyStatus(inst, p, m, resolveStatus({ kind: 'burn', coef: v / 100, ms: 2000 }, p.ctx.powers.index), p.x, p.y, 'hydra');
}

/** Projectiles of a cast: base count + extra, with Missile Choir (one more per 25 AP held, at most 3, at 60 %). */
export function choirExtra(p: Player, rt: SkillRuntime): number {
  return rt.flags.has('missileChoir') ? Math.min(3, Math.floor(Math.max(0, p.res) / 25)) : 0;
}

/** Fan angles around `base` with `step` between neighbours. */
export const fan = (n: number, step: number) => fanAngles(n, step);

// ─────────────────────────── Summons (shared by Hydra, Cinderkin, ember sprites) ───────────────────────────

/** Attack-rate factor of a mage summon: Star-Chart Robe (standing still +30 %), Lantern Garden lanterns (+30 % inside). */
export function summonHaste(inst: Instance, p: Player, s: Summon, rt: SkillRuntime): number {
  let f = 1;
  if (rt.flags.has('starChartHaste') && !p.moving) f *= 1.3;
  if (rt.flags.has('summonLantern') && inst.grounds.some((g) => g.owner === p && g.fx?.def.id === 'summon_lantern' && g.endT > inst.t && (g.x - s.x) ** 2 + (g.y - s.y) ** 2 <= g.r * g.r)) f *= 1.3;
  return f;
}

/** Lantern Garden 6: every third Summon attack calls an ember sprite (6 s, 100 % weapon damage per second, at most 6). */
export function summonAttacked(inst: Instance, p: Player, s: Summon, rt: SkillRuntime) {
  if (!rt.flags.has('emberSprites') || s.type === 'ember_sprite') return;
  const ms = mstate(p);
  if (++ms.summonAttacks < 3) return;
  ms.summonAttacks = 0;
  const live = p.summons.filter((x) => !x.dead && x.type === 'ember_sprite');
  for (let i = 0; i <= live.length - 6; i++) live[i].dead = true;
  const a = inst.rng.next() * TAU;
  spawnEmberSprite(inst, p, s.x + Math.cos(a) * 24, s.y + Math.sin(a) * 16);
}

// ─────────────────────────── Per-tick owner hook ───────────────────────────

/** A summon that left since the last tick (expired or retired), as last seen. */
export interface GoneSummon { x: number; y: number; type: string; skill: string; big: boolean; handled: boolean }

/** Keep a timed state buff alive while `on` (refreshing its 300 ms), set its damage reduction, remove it when off. */
function holdBuff(p: Player, id: string, on: boolean, fields: { dr?: number; cost?: number; cdrec?: number }) {
  const b = getBuff(p, id);
  if (!on) { if (b) b.ms = Math.min(b.ms, 1); return; }
  if (b && b.dr === fields.dr && b.cost === fields.cost && b.cdrec === fields.cdrec) { b.ms = 300; return; }
  addBuff(p, { id, ms: 300, ...fields });
}

function mageTick(inst: Instance, p: Player) {
  if (p.save.classId !== 'mage' || p.deadMs > 0) return;
  const ctx = p.ctx, ms = mstate(p);
  // Ley Anchor (passive): costs −25 % and cooldowns 15 % faster while you stand in one of your Ground effects.
  if (ctx.anyFlag('leyAnchor')) holdBuff(p, 'ley_anchor', inOwnGroundAt(inst, p, p.x, p.y), { cost: -25, cdrec: 15 });
  // Glass Concord 4: 20 % less damage taken while one of your Ground effects is active.
  if (ctx.anyFlag('glassWard')) holdBuff(p, 'glass_ward', hasOwnGround(inst, p), { dr: 20 });
  // Lantern Garden 4: 15 % less damage taken with 3 or more Summons.
  if (ctx.anyFlag('summonLantern')) holdBuff(p, 'lantern_ward', p.summons.filter((s) => !s.dead).length >= 3, { dr: 15 });
  // Hearth Kin (Cinderkin rune): 3 % damage reduction and 0.5 % Life per second per living kin.
  const kin = ctx.slotted('cinderkin');
  if (kin?.flags.has('kinHearth')) {
    const n = p.summons.filter((s) => !s.dead && (s.type === 'cinderkin' || s.type === 'frostkin')).length;
    holdBuff(p, 'hearth_kin', n > 0, { dr: 3 * n });
    if (n > 0) healPlayer(inst, p, p.mhp * 0.005 * n * TICK_MS / 1000, true);
  }
  // Guardian Coil (Hydra node): damage reduction while a Hydra is within 100 units.
  const hy = ctx.slotted('hydra');
  const guard = hy ? modVar(hy.mods, 'hydraGuard') : 0;
  if (guard > 0) holdBuff(p, 'guardian_coil', p.summons.some((s) => !s.dead && s.type === 'hydra' && (s.x - p.x) ** 2 + (s.y - p.y) ** 2 <= 100 * 100), { dr: guard });
  // Retort of Frost (Frost Nova node): a hit taken while an enemy is within 140 units sets off a free Frost Nova.
  const fn = ctx.slotted('frost_nova');
  const reflex = fn ? modVar(fn.mods, 'novaReflex') : 0;
  if (p.taken > ms.lastTaken && reflex > 0 && inst.t >= ms.reflexT && nearestMob(inst, p.x, p.y, 140 + PLAYER_RADIUS)) {
    ms.reflexT = inst.t + reflex * 1000;
    freeNovaCast(inst, p, fn!);
  }
  ms.lastTaken = p.taken;
  // Rimewalker Slippers: the engine's dashEnd proc (once per 8 s) grants the marker buff 'rimewalker'; each new one drops
  // a half-size copy of your most recent Ground effect where the Movement skill ended.
  const walker = getBuff(p, 'rimewalker');
  if (walker && (walker !== ms.walkerSeen || walker.ms > ms.walkerMs + TICK_MS)) { // new, or refreshed by a new proc
    ms.walkerSeen = walker;
    if (ms.lastGround) copyGround(inst, p, ms.lastGround, p.x, p.y);
  }
  ms.walkerMs = walker?.ms ?? 0;
  // Summons that are gone since the last tick (expired, retired): bursts, Last Breath, Lantern Garden lanterns.
  if (ms.summons.size || p.summons.length) {
    const now = new Set<number>();
    for (const s of p.summons) {
      if (s.dead) continue;
      now.add(s.id);
      const k = ms.summons.get(s.id);
      if (k) { k.x = s.x; k.y = s.y; } else ms.summons.set(s.id, { x: s.x, y: s.y, type: s.type, skill: s.skill, big: s.big, handled: false });
    }
    for (const [id, s] of ms.summons) {
      if (now.has(id)) continue;
      ms.summons.delete(id);
      hydraGone(inst, p, s);
      kinGone(inst, p, s);
      if (ctx.anyFlag('summonLantern')) placeGround(inst, p, 'summon_lantern', s.x, s.y, 0);
    }
  }
}

/** Mark a summon as already handled (it burst itself), so its disappearance does not burst it again. */
export function markHandled(p: Player, s: Summon) {
  const k = mstate(p).summons.get(s.id);
  if (k) k.handled = true; else mstate(p).summons.set(s.id, { x: s.x, y: s.y, type: s.type, skill: s.skill, big: s.big, handled: true });
}

export const MAGE_OWNER_HOOK: OwnerSummonHook = {
  withSummons: (inst, p) => mageTick(inst, p),
  withoutSummons: (inst, p) => mageTick(inst, p),
};

// ─────────────────────────── Death hook ───────────────────────────

/**
 * Mage effects when a monster dies, in a fixed order: Brood Hunger (Hydra kills restore Arcane Power), Hoarfrost Vigil
 * 6 (frozen enemies burst into 3 frost needles: Rime Needles strikes at the needle coefficient).
 */
export const mageDeathHook: DeathHook = (inst, m, killer, skill) => {
  if (!mageOf(killer)) return;
  if (skill === 'hydra') {
    const hy = killer.ctx.slotted('hydra');
    const gen = hy ? modVar(hy.mods, 'hydraGen') : 0;
    if (gen > 0) gainResource(killer, gen);
  }
  if (m.freezeMs > 0 && killer.ctx.anyFlag('frozenKillNeedles')) {
    const rt = killer.ctx.modsOf('rime_needles');
    const st: Strike = { skill: 'rime_needles', coef: 0.9, el: skillElement(rt), pct: skillPct(killer, rt), mult: skillMult(killer, 'rime_needles') };
    const x = m.x, y = m.y, used = new Set<Mob>();
    const angles: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t = nearestMob(inst, x, y, 300, used);
      if (t) used.add(t);
      angles.push(t ? Math.atan2(t.y - y, t.x - x) : i * TAU / 3);
    }
    inst.sched.schedule(inst.t, () => {
      if (inst.playerById(killer.id) !== killer) return;
      for (const a of angles) fireBolt(inst, killer, { rt, chillMs: 1500 }, st, { v: 'needle', x, y, angle: a, speed: MAGE_FX.needleSpeed, lifeMs: 450, r: 9, hits: new Set([m.id]) });
    });
  }
};

/** Degrees → radians (re-exported for the skill modules). */
export { DEG };
