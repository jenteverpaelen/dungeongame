// Warrior behaviour plumbing shared by warrior.ts (the six original skills) and warriorM1.ts (bible v2 skills).
// Everything here is class-local (FOUNDATION.md §5: behaviour no template expresses = a flag / var + class-module code):
//   * per-player and per-monster warrior state (WeakMaps: nothing is added to the shared sim types or to saves);
//   * the warrior hit wrapper: on-hit rules that only warrior strikes trigger (node, rune, legendary and set flags);
//   * stuns, displacement, Fury spending, cooldown refunds and the Battle Rage upkeep loop;
//   * the death hook for warrior node / rune / legendary effects (registered at the end of skills/index.ts).
// Generic primitives that engine wave 2 provides (damage reduction, cheat death, control immunity, procs with strikes,
// data-driven grounds, compound conditions, statuses) are NOT re-implemented here; see docs/rework/depth/WARRIOR-PILOT.md.

import { matchesTags, modVar, skillBuffBonuses, skillTags, type SkillTag } from '../../shared';
import { dotStrike, gainResource, healPlayer, hurtMob, isEliteTier, makeDot, strikeMob, vulnerability, type HitResult } from '../damage';
import { addBuff, addOwnedDot, ccFactor, chillMob, dragMob, elIdx, getBuff, knockbackMob, refreshLive, stunMob, ticksAhead } from '../effects';
import { placeGround } from '../groundFx';
import type { Instance } from '../instance';
import { skillElement, skillMult, skillPct } from '../playerctx';
import type { ChannelState, Dot, Mob, Player, SkillRuntime, Strike } from '../types';
import type { DeathHook } from './common';

// ─────────────────────────── State ───────────────────────────

/** A planted Muster Standard (warriorM1.ts). */
export interface Standard {
  id: number;
  x: number;
  y: number;
  r: number;
  endT: number;
  carry: boolean;
  /** Everyone who stood inside at least once (Colour Guard). */
  inside: Set<Player>;
  ended: boolean;
  /** The data ground that makes the standard count as one of your Ground effects. */
  ground?: { endT: number } | null;
}

export interface WarriorState {
  /** Tolling Blow: blows toward the next toll, Carillon stacks, last blow time. */
  toll: number;
  carillon: number;
  lastBlowT: number;
  /** Cleave Reaper's Rhythm: next time a kill may start a free swing. */
  reaperT: number;
  /** Battle Rage Drumbeat: next empowered primary. */
  drumT: number;
  /** Battle Rage Hot Blood: heals in the current 1 s window. */
  healWinT: number;
  healCount: number;
  /** Whirlwind Bloodied Gyre: Fury gained in the current 1 s window. */
  bleedFuryWinT: number;
  bleedFuryGot: number;
  /** Bloodsong: Fury spent toward the next heal. */
  spent: number;
  /** Quakeline Bedrock Pace: last slam time and chained stacks. */
  slamT: number;
  slamStacks: number;
  /** Ironplough ramp (ms held) at the last tick, for Patient Draft / Furrowmark's kept ramp. */
  rampMs: number;
  rampT: number;
  /** Battle Rage upkeep loop generation (a recast restarts the loop). */
  rageGen: number;
  standards: Standard[];
  standardSeq: number;
  /** Tremor Signet budget: seconds already refunded in the current cast. */
  signetCast: number;
  signetUsed: number;
  /** Kilnheart Draft Door: Fury spent toward the next refund; Stoked: ms already added to the current Kilnheart. */
  kilnSpent: number;
  kilnExtended: number;
  /** Hearthbanner 6: Primary hits toward the next shockwave. */
  hearthHits: number;
}

const players = new WeakMap<Player, WarriorState>();
export function wstate(p: Player): WarriorState {
  let s = players.get(p);
  if (!s) {
    s = { toll: 0, carillon: 0, lastBlowT: -1e9, reaperT: -1e9, drumT: -1e9, healWinT: -1e9, healCount: 0, bleedFuryWinT: -1e9, bleedFuryGot: 0,
      spent: 0, slamT: -1e9, slamStacks: 0, rampMs: 0, rampT: -1e9, rageGen: 0, standards: [], standardSeq: 0, signetCast: 0, signetUsed: 0,
      kilnSpent: 0, kilnExtended: 0, hearthHits: 0 };
    players.set(p, s);
  }
  return s;
}

export interface WarriorMobState {
  /** Tolling Blow Ringing Ears: the next Quakeline / Cairnfall hit of `owner` deals pct % more until `until`. */
  prime?: { owner: number; pct: number; until: number };
  /** Last displacement (Furrowmark 4: +35 % for 2 s). */
  displacedT: number;
  displacedBy: number;
  /** Cleave Ground Shaker: the stun end this mob's stun was already extended to. */
  shakerEnd: number;
}
const mobs = new WeakMap<Mob, WarriorMobState>();
export function mstate(m: Mob): WarriorMobState {
  let s = mobs.get(m);
  if (!s) { s = { displacedT: -1e9, displacedBy: 0, shakerEnd: -1 }; mobs.set(m, s); }
  return s;
}

/** Per-channel scratch (timers that restart with every new channel). */
export interface ChannelExtra { wispMs: number; trailMs: number; sodMs: number; stoneMs: number; displaced: Set<number>; rampMs: number; signetUsed: number }
const channels = new WeakMap<ChannelState, ChannelExtra>();
export function chExtra(ch: ChannelState): ChannelExtra {
  let s = channels.get(ch);
  if (!s) { s = { wispMs: 0, trailMs: 0, sodMs: 0, stoneMs: 0, displaced: new Set(), rampMs: 0, signetUsed: 0 }; channels.set(ch, s); }
  return s;
}

// ─────────────────────────── Small queries ───────────────────────────

/** Skills on the bar (primary + slots) with their runtimes. */
export function barSkills(p: Player): SkillRuntime[] {
  const out: SkillRuntime[] = [p.ctx.primary];
  for (const s of p.ctx.slots) if (s) out.push(s);
  return out;
}

export function tagsOf(p: Player, rt: SkillRuntime): Set<SkillTag> {
  return skillTags(rt.def, p.save.skills.runes[rt.def.id]);
}

export const rageActive = (p: Player): boolean => !!getBuff(p, 'battle_rage');

/** Shorten the cooldowns of bar skills whose tags match (Thresher's Knot, Tremor Signet, refunds). */
export function reduceCooldowns(inst: Instance, p: Player, ms: number, tag: SkillTag | null, only?: string) {
  if (ms <= 0) return;
  for (const rt of barSkills(p)) {
    if (only && rt.def.id !== only) continue;
    if (tag && !tagsOf(p, rt).has(tag)) continue;
    const at = p.readyAt.get(rt.def.id);
    if (at !== undefined && at > inst.t) p.readyAt.set(rt.def.id, Math.max(inst.t, at - ms));
  }
}

/** Refund a cooldown after the cast that set it (the brain sets the cooldown right after `cast` returns). */
export function refundCooldownLater(inst: Instance, p: Player, skill: string, ms: number) {
  if (ms > 0) inst.sched.schedule(inst.t, () => reduceCooldowns(inst, p, ms, null, skill));
}

/**
 * Give Fury back during a cast that is about to pay its cost (cast → `p.res -= cost` in brain.ts): uncapped now, so the
 * full refund survives the payment, but never more than the maximum after it.
 */
export function refundDuringCast(p: Player, amount: number, cost: number) {
  if (amount > 0) p.res = Math.min(p.mres + cost, p.res + amount);
}

/** Is the point inside one of the player's planted standards? */
export function inOwnStandard(inst: Instance, p: Player, x = p.x, y = p.y): boolean {
  for (const s of wstate(p).standards) if (!s.ended && s.endT > inst.t && (s.x - x) ** 2 + (s.y - y) ** 2 <= s.r * s.r) return true;
  return false;
}

/** Nearest living enemy to (x, y) within `r`, excluding `not`. */
export function nearestMob(inst: Instance, x: number, y: number, r: number, not?: ReadonlySet<Mob> | Mob): Mob | null {
  let best: Mob | null = null, bd = Infinity;
  for (const m of inst.queryMobs(x, y, r)) {
    if (m.dead || m === not || (not instanceof Set && not.has(m))) continue;
    const d = (m.x - x) ** 2 + (m.y - y) ** 2;
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

// ─────────────────────────── Damage over time ───────────────────────────

/** Remaining damage of a dot (the ticks it will really still deal). */
export const dotLeft = (d: Dot): number => d.perTick * ticksAhead(d);

/**
 * Add a dot whose damage accumulates with the same-key dot instead of replacing it: the remaining damage is carried
 * into the new one (carryPct %). Used where every hit adds its own share (Endless Storm 4, Smouldering Share) and by
 * Rend's Rollover.
 */
export function addCarriedDot(m: Mob, dot: Dot, carryPct = 100) {
  const i = m.dots.findIndex((d) => d.kind === dot.kind && d.owner === dot.owner && d.skill === dot.skill);
  if (i >= 0) {
    // Conserve damage exactly: the new share plus the carried remainder, over the ticks the merged dot will deal.
    const total = dotLeft(dot) + dotLeft(m.dots[i]) * carryPct / 100;
    const next = { ...dot, nextMs: Math.min(dot.nextMs, m.dots[i].nextMs) };
    next.perTick = total / Math.max(1, ticksAhead(next));
    m.dots[i] = next;
    return;
  }
  if (m.dots.length < 8) m.dots.push(dot);
}

/**
 * A hit's amount without the target-dependent factors (vulnerability, elite bonus): dot ticks re-apply them live
 * (dotStrike), so a "% of the hit" dot built from the raw amount would count them twice.
 */
export function hitBase(p: Player, m: Mob, skill: string, amount: number): number {
  const v = vulnerability(p, m, skill) * (isEliteTier(m.tier) ? 1 + p.ctx.d.elite / 100 : 1);
  return v > 0 ? amount / v : amount;
}

/** A dot dealing `total` damage (already computed, e.g. a share of a hit) over `ms`. */
export function shareDot(p: Player, skill: string, kind: Dot['kind'], el: Dot['el'], total: number, ms: number, tickMs = 500): Dot {
  const ticks = Math.max(1, Math.round(ms / tickMs));
  return { kind, owner: p.id, skill, perTick: total / ticks, el, tickMs, nextMs: tickMs, leftMs: ms, durMs: ms };
}

/** Extend the player's bleeds (and burns) on a monster: Ashgrip Gauntlets, Cinder Oath 4. */
function extendDots(p: Player, m: Mob, ms: number, burns: boolean, capLeftMs: number | null) {
  for (const d of m.dots) {
    if (d.owner !== p.id || (d.kind !== 'bleed' && !(burns && d.kind === 'burn'))) continue;
    const cap = capLeftMs ?? d.durMs;
    if (d.leftMs < cap) d.leftMs = Math.min(cap, d.leftMs + ms);
  }
}

// ─────────────────────────── The warrior hit ───────────────────────────

/**
 * strikeMob plus the warrior's own on-hit rules. Per-target multipliers (Ringing Ears, Furrowmark 4) are applied to a
 * copy of the strike; post-hit rules read the result (crit, amount, the target's state before the hit).
 */
export function wHit(inst: Instance, p: Player, m: Mob, st: Strike, rt: SkillRuntime | null): HitResult {
  if (m.dead) return { amount: 0, crit: false, killed: false };
  const ms = mstate(m);
  let mult = 1;
  if (rt?.flags.has('furrowVuln') && ms.displacedBy === p.id && inst.t - ms.displacedT <= 2000) mult *= 1.35;
  if ((st.skill === 'seismic_slam' || st.skill === 'cairnfall') && ms.prime && ms.prime.owner === p.id) {
    if (ms.prime.until >= inst.t) mult *= 1 + ms.prime.pct / 100;
    ms.prime = undefined;
  }
  // Kilnheart: Heat Haze (enemies near you) and Cold Forge (chilled enemies) take more damage while it burns.
  const kiln = getBuff(p, 'kilnheart') ? p.ctx.slotted('kilnheart') : null;
  if (kiln) {
    const haze = modVar(kiln.mods, 'heatHaze');
    if (haze > 0 && (m.x - p.x) ** 2 + (m.y - p.y) ** 2 <= 150 * 150) mult *= 1 + haze / 100;
    if (kiln.flags.has('kilnChill') && m.chillMs > 0) mult *= 1.1;
  }
  const s = mult !== 1 ? { ...st, mult: (st.mult ?? 1) * mult } : st;
  const wasStunned = m.stunMs > 0;
  const r = strikeMob(inst, p, m, s);
  if (r.crit) hotBlood(inst, p);
  // Kilnheart: every warrior hit ignites (60 % weapon damage over 2 s, refreshed) — or chills with Cold Forge.
  if (kiln && !r.killed && !m.dead) {
    if (kiln.flags.has('kilnChill')) chillMob(m, 1000, inst, p);
    else addOwnedDot(p, m, makeDot(inst, p, { skill: 'kilnheart', coef: kiln.def.coef * (1 + modVar(kiln.mods, 'kilnIgnite') / 100), el: skillElement(kiln), pct: skillPct(p, kiln), mult: skillMult(p, 'kilnheart') }, 'burn', 2000, 500));
  }
  if (!rt) return r;
  // Fault Warden 4: Spender hits on stunned enemies echo for 50 % of the hit one second later.
  if (wasStunned && r.amount > 0 && rt.flags.has('faultAftershock')) {
    const amount = r.amount * 0.5, el = s.el, skill = s.skill;
    inst.sched.schedule(inst.t + 1000, () => {
      if (m.dead) return;
      hurtMob(inst, m, amount, el, p, false, false, p.id, skill);
      inst.emit({ e: 'aoe', v: 'aftershock', x: Math.round(m.x), y: Math.round(m.y), r: 40, d: 300, el: elIdx(el), s: p.id }, m.x, m.y, p.id);
    });
  }
  if (r.killed || m.dead) return r;
  // Endless Storm 4: Channel hits bleed for 30 % of the hit over 3 s (shares accumulate).
  if (rt.flags.has('stormBleed') && r.amount > 0) addCarriedDot(m, shareDot(p, `${rt.def.id}`, 'bleed', 'physical', hitBase(p, m, s.skill, r.amount) * 0.3, 3000));
  if (s.primary) {
    if (rt.flags.has('ashgripExtend')) extendDots(p, m, 500, false, null);
    if (rt.flags.has('cinderExtend')) extendDots(p, m, 500, true, 10_000);
  }
  // Cleave Ground Shaker: extend a stun once per stun and gain 1 Fury.
  const shaker = rt.def.id === 'cleave' ? modVar(rt.mods, 'stunExtend') : 0;
  if (shaker > 0 && wasStunned && m.stunMs > 0) {
    const end = inst.t + m.stunMs;
    if (end > ms.shakerEnd + 1) {
      m.stunMs += shaker * 1000 * ccFactor(m);
      ms.shakerEnd = inst.t + m.stunMs;
      gainResource(p, 1);
    }
  }
  return r;
}

/** Battle Rage Hot Blood: critical hits heal while the rage lasts (at most 4 heals per second, as Red Draw). */
function hotBlood(inst: Instance, p: Player) {
  if (!rageActive(p)) return;
  const br = p.ctx.slotted('battle_rage');
  const pct = br ? modVar(br.mods, 'critHeal') : 0;
  if (pct <= 0) return;
  const ws = wstate(p);
  if (inst.t - ws.healWinT >= 1000) { ws.healWinT = inst.t; ws.healCount = 0; }
  if (ws.healCount >= 4) return;
  ws.healCount++;
  healPlayer(inst, p, p.mhp * pct / 100, true);
}

// ─────────────────────────── Stuns and displacement ───────────────────────────

/**
 * Stun with the warrior's stun rules: Long Ringing (Battle Rage node), Belfry Pauldrons (+1 s on already-stunned
 * enemies), Stonecount Gauntlets (a stack per newly stunned enemy). Returns true when the enemy can be stunned.
 */
export function wStun(inst: Instance, p: Player, m: Mob, ms: number, rt: SkillRuntime | null): boolean {
  if (m.dead || ccFactor(m) <= 0 || ms <= 0) return false;
  let d = ms;
  if (rageActive(p)) { const br = p.ctx.slotted('battle_rage'); if (br) d *= 1 + modVar(br.mods, 'longRinging') / 100; }
  const already = m.stunMs > 0;
  if (already && rt?.flags.has('belfry')) d += 1000;
  stunMob(m, d, inst, p);
  // Fault Warden 6: a fault line under each enemy your skills newly stun (data ground 'fault_line').
  if (!already && rt?.flags.has('faultLines')) placeGround(inst, p, 'fault_line', m.x, m.y, Math.atan2(m.y - p.y, m.x - p.x) + Math.PI / 2);
  if (!already) {
    const max = p.ctx.power('stonecount_gauntlets');
    if (max > 0) {
      const n = Math.min(max, (getBuff(p, 'stonecount')?.st ?? 0) + 1);
      addBuff(p, { id: 'stonecount', ms: 8000, dmg: n, st: n });
    }
  }
  return true;
}

/** Tremor Signet: each displaced enemy shortens Cooldown skills (at most 1.5 s per cast; channels: per channel). */
function signet(inst: Instance, p: Player, m: Mob, ch: ChannelExtra | null) {
  const v = p.ctx.power('tremor_signet');
  if (v <= 0) return;
  const ws = wstate(p);
  if (ch) {
    if (ch.displaced.has(m.id) || ch.signetUsed >= 1.5) return;
    ch.displaced.add(m.id);
    const s = Math.min(v, 1.5 - ch.signetUsed); ch.signetUsed += s;
    reduceCooldowns(inst, p, s * 1000, 'cooldown');
    return;
  }
  if (ws.signetCast !== inst.t) { ws.signetCast = inst.t; ws.signetUsed = 0; }
  if (ws.signetUsed >= 1.5) return;
  const s = Math.min(v, 1.5 - ws.signetUsed); ws.signetUsed += s;
  reduceCooldowns(inst, p, s * 1000, 'cooldown');
}

function displaced(inst: Instance, p: Player, m: Mob, ch: ChannelExtra | null, rt: SkillRuntime | null) {
  const ms = mstate(m);
  // Furrowmark 6: a furrow behind each enemy your Displace effects move (at most one per enemy per second).
  if (rt?.flags.has('furrowGround') && inst.t - ms.displacedT >= 1000) placeGround(inst, p, 'furrow', m.x, m.y, Math.atan2(m.y - p.y, m.x - p.x) + Math.PI / 2);
  ms.displacedT = inst.t; ms.displacedBy = p.id;
  signet(inst, p, m, ch);
}

/** Furrowmark 2: Displace effects move enemies 50 % farther. */
const pushScale = (rt: SkillRuntime | null) => (rt?.flags.has('furrowPush') ? 1.5 : 1);

/**
 * Knock an enemy back along (dx, dy). Furrowmark 4: an enemy pushed into a wall or another enemy is stunned for 1 s.
 * Returns the enemy it was pushed into (Ironplough Ox Strength), if any.
 */
export function wPush(inst: Instance, p: Player, m: Mob, dx: number, dy: number, dist: number, rt: SkillRuntime | null, ch: ChannelExtra | null = null): Mob | null {
  if (m.dead || ccFactor(m) <= 0) return null;
  const d = dist * pushScale(rt);
  knockbackMob(m, dx, dy, d, inst, p);
  displaced(inst, p, m, ch, rt);
  const l = Math.hypot(dx, dy) || 1, f = ccFactor(m), ux = dx / l, uy = dy / l;
  const ex = m.x + ux * d * f, ey = m.y + uy * d * f;
  let into: Mob | null = null;
  for (const o of inst.queryMobs(ex, ey, m.r)) {
    if (o === m || o.dead) continue;
    // In front of the push and overlapping the end point.
    if ((o.x - m.x) * ux + (o.y - m.y) * uy > 0) { into = o; break; }
  }
  const wall = !inst.cw.isFree(ex, ey, Math.max(8, m.r * 0.8));
  if ((into || wall) && rt?.flags.has('furrowStun')) wStun(inst, p, m, 1000, rt);
  return into;
}

/** Drag an enemy toward (tx, ty) by up to `step` units (pulls). */
export function wPull(inst: Instance, p: Player, m: Mob, tx: number, ty: number, step: number, rt: SkillRuntime | null, ch: ChannelExtra | null = null) {
  if (m.dead || step <= 0) return;
  dragMob(inst, m, tx, ty, step * pushScale(rt), p);
  displaced(inst, p, m, ch, rt);
}

// ─────────────────────────── Fury, buffs and loops ───────────────────────────

/** Fury actually spent (slot casts: their cost; channels: the drain). Bloodsong heals 2 % per 20 while raging. */
export function noteSpend(inst: Instance, p: Player, amount: number) {
  if (amount <= 0) return;
  const ws = wstate(p);
  const br = p.ctx.slotted('battle_rage');
  if (br && br.flags.has('rageHeal') && rageActive(p)) {
    ws.spent += amount;
    while (ws.spent >= 20) { ws.spent -= 20; healPlayer(inst, p, p.mhp * 0.02, false); }
  }
  // Kilnheart Draft Door: every 50 Fury spent shortens Kilnheart's cooldown.
  const kh = p.ctx.slotted('kilnheart');
  const door = kh ? modVar(kh.mods, 'draftDoor') : 0;
  if (door > 0) {
    ws.kilnSpent += amount;
    while (ws.kilnSpent >= 50) { ws.kilnSpent -= 50; reduceCooldowns(inst, p, door * 1000, null, 'kilnheart'); }
  }
}

/** "While a Buff skill is active" (WARRIOR_BUFF_ACTIVE in the data): the buff of Battle Rage, Muster Standard or Kilnheart. */
export const buffUp = (p: Player): boolean => !!(getBuff(p, 'battle_rage') || getBuff(p, 'muster_standard') || getBuff(p, 'kilnheart'));

/** Brass Warhorn Helm: attack speed while any Buff skill is active (lasts as long as the longest of them). */
export function syncWarhorn(p: Player) {
  const v = modVar(p.ctx.primary.mods, 'warhorn');
  if (v <= 0) return;
  let ms = 0;
  for (const id of ['battle_rage', 'muster_standard', 'kilnheart']) ms = Math.max(ms, getBuff(p, id)?.ms ?? 0);
  if (ms > 0) addBuff(p, { id: 'brass_warhorn', ms, ias: v });
}

/** Hearthbanner 2: each active Buff skill grants its owner 5 % attack speed. */
export const hearthIas = (rt: SkillRuntime | null) => (rt?.flags.has('hearthIas') ? 5 : 0);

/**
 * Hearthbanner 4 / 6 on a Primary swing while a Buff skill is active: +3 Fury, and every third swing a shockwave
 * (140 units, 50 % weapon damage) at (x, y). Returns the extra Fury.
 */
export function hearthPrimary(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number): number {
  if (!buffUp(p)) return 0;
  if (rt.flags.has('hearthShock') && ++wstate(p).hearthHits >= 3) {
    wstate(p).hearthHits = 0;
    const st: Strike = { skill: rt.def.id, coef: 0.5, el: skillElement(rt), pct: skillPct(p, rt), mult: skillMult(p, rt.def.id), primary: true, noArea: true };
    for (const m of inst.queryMobs(x, y, 140)) if (!m.dead) wHit(inst, p, m, st, rt);
    inst.emit({ e: 'aoe', v: 'hearth_shock', x: Math.round(x), y: Math.round(y), r: 140, d: 420, el: elIdx(st.el), s: p.id }, x, y, p.id);
  }
  return rt.flags.has('hearthGen') ? 3 : 0;
}

/** Deep Earth (passive): a Stun skill's area leaves tremor ground (data ground 'deep_tremor') of that radius. */
export function deepEarth(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, r: number) {
  if (!rt.flags.has('deepEarth')) return;
  const g = placeGround(inst, p, 'deep_tremor', x, y, 0);
  if (g) g.r = r;
}

/**
 * Battle Rage upkeep while the buff lasts: Fury Well (+points above 80 Fury), Seething Sigil (+points above 50 Fury) and
 * Shared Fury (the bonus for allies within 400). A recast restarts the loop.
 */
export function startRageLoop(inst: Instance, p: Player, rt: SkillRuntime) {
  const ws = wstate(p), gen = ++ws.rageGen;
  const well = modVar(rt.mods, 'furyWell'), seething = p.ctx.power('seething_sigil'), share = rt.flags.has('rageShare');
  if (!well && !seething && !share) return;
  const base = skillBuffBonuses('battle_rage', rt.flags).dmg;
  const step = () => {
    if (ws.rageGen !== gen || p.deadMs > 0) return;
    const b = getBuff(p, 'battle_rage');
    if (!b) return;
    const dmg = base + (p.res > 80 ? well : 0) + (p.res > 50 ? seething : 0);
    if (b.dmg !== dmg) { b.dmg = dmg; refreshLive(p); }
    if (share) for (const o of inst.playersNear(p.x, p.y, 400)) if (o !== p) addBuff(o, { id: 'shared_rage', ms: 600, dmg });
    syncWarhorn(p);
    inst.sched.schedule(inst.t + 250, step);
  };
  step();
}

/** Whether a strike skill matches a tag for this player (rune included). */
export function skillHasTag(p: Player, skill: string, tag: SkillTag): boolean {
  const rt = barSkills(p).find((r) => r.def.id === skill);
  return !!rt && matchesTags(tagsOf(p, rt), { anyOf: [tag] });
}

// ─────────────────────────── Death hook ───────────────────────────

/**
 * Warrior effects when a monster dies, in a fixed order: Red Ledger and Haemal Debt (bleed owners gain Fury), Open
 * Artery (Rend bleed bursts), Reaper's Rhythm (Cleave kill → free swing), Sawyer's Ring (bleed kill → shard), Quick
 * Muster (death inside a standard). `freeSwing` is injected by warrior.ts (Cleave lives there).
 */
export function warriorDeathHook(freeSwing: (inst: Instance, p: Player, from: { x: number; y: number }) => void): DeathHook {
  return (inst, m, killer, skill) => {
    const ledgered = new Set<number>(), rended = new Set<number>();
    for (const d of m.dots) {
      if (d.kind !== 'bleed') continue;
      const owner = inst.playerById(d.owner);
      if (!owner || owner.save.classId !== 'warrior') continue;
      if (!ledgered.has(owner.id)) {
        ledgered.add(owner.id);
        const ledger = owner.ctx.power('red_ledger');
        if (ledger > 0) gainResource(owner, ledger);
      }
      if (d.skill !== 'rend' || rended.has(owner.id)) continue;
      rended.add(owner.id);
      const rend = owner.ctx.slotted('rend');
      if (!rend) continue;
      if (rend.flags.has('rendRefund')) gainResource(owner, 4);
      const radius = modVar(rend.mods, 'arteryRadius');
      const burst = dotLeft(d) * 0.5;
      if (radius > 0 && burst > 0) {
        for (const o of inst.queryMobs(m.x, m.y, radius)) if (!o.dead && o !== m) dotStrike(inst, owner, o, burst, d.el, 'rend');
        inst.emit({ e: 'aoe', v: 'rend', x: Math.round(m.x), y: Math.round(m.y), r: Math.round(radius), d: 360, el: elIdx(d.el), s: owner.id }, m.x, m.y, owner.id);
      }
    }
    if (killer && killer.save.classId === 'warrior') {
      const ws = wstate(killer);
      // Reaper's Rhythm: a Cleave kill starts a free swing at the nearest enemy (internal cooldown).
      if (skill === 'cleave' && killer.ctx.primary.def.id === 'cleave') {
        const icd = modVar(killer.ctx.primary.mods, 'reaperIcd');
        if (icd > 0 && inst.t >= ws.reaperT) {
          ws.reaperT = inst.t + icd * 1000;
          const from = { x: m.x, y: m.y };
          inst.sched.schedule(inst.t, () => freeSwing(inst, killer, from));
        }
      }
      // Sawyer's Ring: enemies killed by your Bleed skills while bleeding from them fling a bleeding shard.
      const saw = killer.ctx.power('sawyers_ring');
      const dot = saw > 0 && skillHasTag(killer, skill, 'bleed') ? m.dots.find((x) => x.kind === 'bleed' && x.owner === killer.id) : undefined;
      if (dot) {
        const t = nearestMob(inst, m.x, m.y, 300, m);
        if (t) {
          const rt = barSkills(killer).find((r) => r.def.id === skill) ?? null;
          strikeMob(inst, killer, t, { skill, coef: saw / 100, el: dot.el, pct: rt ? skillPct(killer, rt) : 0, mult: skillMult(killer, skill), noArea: true });
          if (!t.dead) addCarriedDot(t, { ...dot, leftMs: dot.durMs, nextMs: dot.tickMs, perTick: dot.perTick }, 0);
          inst.emit({ e: 'beam', v: 'splinter', x: Math.round(m.x), y: Math.round(m.y), tx: Math.round(t.x), ty: Math.round(t.y), el: elIdx(dot.el), d: 200 }, t.x, t.y, killer.id);
        }
      }
    }
    // Kilnheart Stoked: each kill while it burns adds 0.5 s (up to 10 s per activation).
    if (killer && killer.save.classId === 'warrior') {
      const kb = getBuff(killer, 'kilnheart'), kh = killer.ctx.slotted('kilnheart'), ws = wstate(killer);
      if (kb && kh?.flags.has('kilnExtend') && ws.kilnExtended < 10_000) { kb.ms += 500; ws.kilnExtended += 500; }
    }
    // Quick Muster: every death inside a standard shortens that standard's cooldown.
    for (const p of inst.players) {
      if (p.save.classId !== 'warrior') continue;
      const st = players.get(p)?.standards;
      if (!st?.length) continue;
      const mu = p.ctx.slotted('muster_standard');
      const v = mu ? modVar(mu.mods, 'musterRefund') : 0;
      if (v > 0 && inOwnStandard(inst, p, m.x, m.y)) reduceCooldowns(inst, p, v * 1000, null, 'muster_standard');
    }
  };
}

