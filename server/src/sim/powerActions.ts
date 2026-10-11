// Engine wave 2: what power procs do (strike, summon, ground, status, deflect), the defensive hooks of the incoming-
// damage path (damage taken, first hit, cheat death, control immunity), the per-tick power hook (standing still,
// distance / kill stacking, deflection) and resource debt. Everything here is driven by data built in powerRuntime.ts
// and is a no-op (no RNG, no float change) for a player whose powers do not use it.

import { SKILLS, type Element } from '../shared';
import { strikeMob } from './damage';
import { addBuff, elIdx, getBuff, refreshLive, removeBuff } from './effects';
import { placeGround } from './groundFx';
import type { Instance } from './instance';
import { MIN_RECAST_MS, skillCooldownMs, skillCost, skillPct } from './playerctx';
import { FURY_DECAY_DELAY_MS, OOC_REGEN_DELAY_MS } from './tuning';
import {
  conditionCount, firePowerProcs, ownMultiplier, powerState, stackBuff,
  type ProcContext, type ProcRuntime, type StackRule,
} from './powerRuntime';
import { clearHostileProjectiles } from './projectiles';
import { castPrimary, castSkill, summonBehaviour } from './skills';
import { applyStatus, type TauntRef } from './status';
import { spawnSummon } from './summons';
import type { Dot, Mob, Player, Strike, SummonType } from './types';

/** A strike for a power-made hit: a class skill uses its skill bucket; other ids (procs, grounds) their template mods. */
export function strikeFor(p: Player, id: string, coef: number, el: Element): Strike {
  const pct = Object.hasOwn(SKILLS, id) && SKILLS[id].classId === p.save?.classId ? skillPct(p, p.ctx.modsOf(id)) : p.ctx.powers.mods.get(id)?.dmg ?? 0;
  return { skill: id, coef, el, pct, mult: ownMultiplier(p, id) };
}

const facing = (p: Player) => Math.atan2(p.mv.faceY, p.mv.faceX);

/** The proc's actions, in this order: summon, ground, strike, status, deflect. */
export function runProcActions(inst: Instance, p: Player, pr: ProcRuntime, c: ProcContext | undefined) {
  const mob = c?.mob ?? null;
  const at = (where: 'target' | 'self') => (where === 'target' && mob ? mob : p);
  let ref: TauntRef | null = null;
  if (pr.summon) {
    const q = at(pr.summon.at), s = procSummon(inst, p, pr.summon, q.x, q.y);
    if (s) ref = s;
  }
  if (pr.ground) {
    const q = at(pr.ground.at), g = placeGround(inst, p, pr.ground.def, q.x, q.y, facing(p), pr.ground.scale, pr.ground.carryDot ? strongestDot(p, mob) : undefined);
    if (g && !ref) ref = g;
  }
  if (pr.strike) {
    const s = pr.strike, q = at(s.at), el = s.el ?? c?.el ?? 'physical', st = strikeFor(p, s.id, s.coef, el);
    if (s.radius > 0) { for (const m of inst.queryMobs(q.x, q.y, s.radius)) if (!m.dead) strikeMob(inst, p, m, st); }
    else if (mob && !mob.dead && s.at === 'target') strikeMob(inst, p, mob, st);
    if (s.visual) inst.emit({ e: 'aoe', v: s.visual, x: Math.round(q.x), y: Math.round(q.y), r: Math.round(s.radius), d: 0, el: elIdx(el), s: p.id }, q.x, q.y, p.id);
  }
  if (pr.applyStatus) {
    const s = pr.applyStatus, q = at(s.at ?? 'target');
    const source = pr.strike?.id ?? c?.skill ?? pr.key ?? 'proc';
    // Knockback / pull / taunt point: the area's centre, or the player for single targets and origin 'owner'.
    const from = s.radius && s.origin !== 'owner' ? q : p;
    if (s.radius) { for (const m of inst.queryMobs(q.x, q.y, s.radius)) applyStatus(inst, p, m, s, from.x, from.y, source, ref ?? (from === p ? p : null)); }
    else if (mob && !mob.dead) applyStatus(inst, p, mob, s, p.x, p.y, source, ref ?? p);
  }
  if (pr.clear) clearHostileProjectiles(inst, p.x, p.y, facing(p), pr.clear.half, pr.clear.range);
  if (pr.castSkill) castBarSkill(inst, p, pr.castSkill);
}

/** Your strongest damage-over-time on an enemy (highest damage per second), a template for carried dots. */
export function strongestDot(p: Player, m: Mob | null): Dot | undefined {
  let best: Dot | undefined;
  if (m) for (const d of m.dots) if (d.owner === p.id && (!best || d.perTick / d.tickMs > best.perTick / best.tickMs)) best = d;
  return best ? { ...best } : undefined;
}

/**
 * Proc action castSkill: cast a bar skill among the targets for free (no resource; its cooldown starts), only when off
 * cooldown. pick 'longestCooldown' takes the one with the longest base cooldown, 'first' the first slot.
 */
function castBarSkill(inst: Instance, p: Player, c: NonNullable<ProcRuntime['castSkill']>) {
  const ready = p.ctx.slots.filter((rt): rt is NonNullable<typeof rt> => !!rt && (!c.ids || c.ids.has(rt.def.id)) && (p.readyAt.get(rt.def.id) ?? 0) <= inst.t && (p.recastAt.get(rt.def.id) ?? -Infinity) <= inst.t && rt.def.auto.when !== 'channel');
  if (!ready.length) return;
  const rt = c.pick === 'longestCooldown' ? ready.reduce((a, b) => (b.def.cooldown > a.def.cooldown ? b : a)) : ready[0];
  const prev = p.acting;
  p.acting = rt.def.id;
  try { if (!castSkill(inst, p, rt)) return; } finally { p.acting = prev; }
  const cd = skillCooldownMs(p, rt);
  if (cd > 0) p.readyAt.set(rt.def.id, inst.t + cd);
  else p.recastAt.set(rt.def.id, inst.t + MIN_RECAST_MS);
}

/** Spawn a power summon (only types a class module registered); over `max` of that type, the oldest retires. */
function procSummon(inst: Instance, p: Player, s: NonNullable<ProcRuntime['summon']>, x: number, y: number) {
  if (!summonBehaviour(s.type)) return null;
  if (s.max) {
    const mine = p.summons.filter((o) => !o.dead && o.type === s.type);
    for (let i = 0; i <= mine.length - s.max; i++) mine[i].dead = true;
  }
  return spawnSummon(inst, p, s.type as SummonType, s.skill, x, y, s.lifeMs);
}

// ─────────────────────────── Incoming damage ───────────────────────────

/**
 * Damage-taken factor from powers for one hit by `src` (null = hazard): static and conditional damage-taken terms,
 * damage-reduction buffs, first-hit reduction. Called only when the player has defensive terms or a DR buff.
 */
export function powerDefense(inst: Instance, p: Player, src: Mob | null): number {
  let f = 1;
  const d = p.ctx.powers.defense;
  if (d) {
    f *= d.takenStatic;
    for (const t of d.takenTerms) { const n = conditionCount(p, t.when, undefined, src); if (n) f *= Math.max(0, 1 + t.pct / 100 * n); }
    if (d.firstHit.length) {
      const st = powerState(p);
      d.firstHit.forEach((fh, i) => {
        if ((st.firstHitAt[i] ?? -Infinity) > inst.t) return;
        st.firstHitAt[i] = inst.t + fh.windowMs;
        f *= Math.max(0, 1 + fh.pct / 100);
      });
    }
  }
  const dr = p.live.dr;
  if (dr !== undefined && dr !== 1) f *= dr;
  return f;
}

/** Fatal damage: the first ready cheat-death term (condition tested against the attacker) keeps the player alive. */
export function tryCheatDeath(inst: Instance, p: Player, src: Mob | null): boolean {
  const terms = p.ctx.powers.defense?.cheat;
  if (!terms?.length) return false;
  const st = powerState(p);
  for (let i = 0; i < terms.length; i++) {
    const c = terms[i];
    if ((st.cheatAt[i] ?? -Infinity) > inst.t) continue;
    if (c.when && !conditionCount(p, c.when, undefined, src)) continue;
    st.cheatAt[i] = inst.t + c.cooldownMs;
    p.hp = Math.max(1, p.mhp * c.lifePct / 100);
    if (c.invulnMs) p.invulnMs = Math.max(p.invulnMs, c.invulnMs);
    if (c.reset) for (const id of c.reset) p.readyAt.delete(id);
    if (c.buff) addBuff(p, { ...c.buff });
    inst.emit({ e: 'heal', t: p.id, a: Math.round(p.hp) }, p.x, p.y, p.id);
    return true;
  }
  return false;
}

// ─────────────────────────── Per tick ───────────────────────────

/** [P] A position jump larger than this between two ticks is a teleport / respawn, not movement (dash ≈ 15 per tick). */
const TELEPORT_UNITS = 200;

/** Per-tick power hook (only for players whose runtime sets `ticks`). */
export function powerTick(inst: Instance, p: Player, dtMs: number) {
  const rt = p.ctx.powers, st = powerState(p);
  if (rt.tracksStill) st.stillMs = p.moving ? 0 : st.stillMs + dtMs;
  const imm = rt.defense?.immune;
  let bits = 0;
  if (imm) for (const t of imm) if (!t.when || conditionCount(p, t.when, undefined, null) > 0) bits |= t.bits;
  st.ctrlImmune = bits;
  if (rt.nearRange) {
    const o = inst.mobHash.nearest(p.x, p.y, rt.nearRange, (m) => !m.dead);
    st.nearDist = o ? Math.hypot(o.x - p.x, o.y - p.y) : Infinity;
  }
  if (rt.stacking.length) {
    const moved = Math.hypot(p.x - st.lastX, p.y - st.lastY);
    for (const r of rt.stacking) {
      if (r.source === 'distance' && moved > 0 && moved <= TELEPORT_UNITS) addProgress(inst, p, r, moved);
      if (r.source === 'channel' && p.channel) {
        addProgress(inst, p, r, dtMs);
        const b = getBuff(p, r.buff); if (b && r.decay === 'all') b.ms = r.decayMs; // no decay while channelling
      }
      decayStacks(inst, p, r);
    }
  }
  st.lastX = p.x; st.lastY = p.y;
  for (const d of rt.deflect) if (!d.when || conditionCount(p, d.when, undefined, null)) clearHostileProjectiles(inst, p.x, p.y, facing(p), d.half, d.range);
  if (rt.rules.buffUpkeep.length) buffUpkeep(p, dtMs);
}

function stackGrant(r: StackRule) {
  const b: { id: string; ms: number; sdmg?: number; ias?: number; mv?: number } = { id: r.buff, ms: r.decay === 'all' ? r.decayMs : Infinity };
  if (r.sdmg) b.sdmg = r.sdmg;
  if (r.sias) b.ias = r.sias;
  if (r.smv) b.mv = r.smv;
  return b;
}

function addProgress(inst: Instance, p: Player, r: StackRule, v: number) {
  const st = powerState(p);
  let acc = (st.progress.get(r.buff) ?? 0) + v;
  let n = 0;
  while (acc >= r.per) { acc -= r.per; n++; }
  st.progress.set(r.buff, acc);
  if (!n) return;
  st.gainT.set(r.buff, inst.t);
  stackBuff(p, stackGrant(r), r.max, n);
  const b = getBuff(p, r.buff);
  if (b && (b.st ?? 1) >= r.max && r.onMax) {
    if (r.onMax.buff) addBuff(p, { ...r.onMax.buff });
    if (r.onMax.reset) { removeBuff(p, r.buff); st.progress.set(r.buff, 0); }
  }
}

function decayStacks(inst: Instance, p: Player, r: StackRule) {
  if (r.decay !== 'one') return; // 'all': the buff's own duration (decayMs, refreshed per stack) removes it
  const b = getBuff(p, r.buff);
  if (!b) return;
  const st = powerState(p), since = inst.t - (st.gainT.get(r.buff) ?? inst.t);
  if (since < r.decayMs) return;
  st.gainT.set(r.buff, inst.t);
  if ((b.st ?? 1) <= 1) removeBuff(p, r.buff);
  else { b.st = (b.st ?? 1) - 1; refreshLive(p); }
}

/** Kill-fed stacking (called for the killer). */
export function onKillStacking(inst: Instance, p: Player, skill: string, killed: Mob | null = null) {
  for (const r of p.ctx.powers.stacking) {
    if (r.source !== 'kills' || (r.skills && !r.skills.has(skill))) continue;
    if (r.when && !(killed && conditionCount(p, r.when, undefined, killed))) continue;
    addProgress(inst, p, r, 1);
  }
}

/** Repeat a primary attack at the same enemy (proc `repeat`). */
export function repeatAttack(inst: Instance, p: Player, m: Mob) {
  castPrimary(inst, p, m);
}

// ─────────────────────────── Rule changes ───────────────────────────

/** Extra charges of a skill (rule change `charges`; '*' entries count for every skill). */
export function extraCharges(p: Player, skill: string): number {
  const c = p.ctx.powers.rules.charges;
  return (c.get(skill) ?? 0) + (c.get('*') ?? 0);
}

/**
 * Movement factor while channelling `skill`: the skill's own slow (`vars.channelMovePct`, e.g. -60) raised to the best
 * channelMove rule. 1 when neither exists. NOTE: client prediction does not know this factor yet (see FOUNDATION §11).
 */
export function channelMoveFactor(p: Player, skill: string): number {
  const slow = p.ctx.modsOf(skill).mods.vars?.channelMovePct;
  let f = slow ? Math.max(0, 1 + slow / 100) : 1;
  for (const r of p.ctx.powers.rules.channelMove) if ((!r.skills || r.skills.has(skill)) && r.pct / 100 > f) f = r.pct / 100;
  return f;
}

/** Movement speed % while channelling: the channel's slow and rules (channelMoveFactor) and the moveWhileChannel affix. */
export function channelMsPct(p: Player): number {
  const ms = p.ctx.d.ms + p.ctx.d.moveWhileChannel + (p.live.mv ?? 0), f = channelMoveFactor(p, p.channel!.skill);
  return f === 1 ? ms : (1 + ms / 100) * f * 100 - 100;
}

/** Movement speed % in effect: the sheet, buff movement (live.mv) and, while channelling, channelMsPct. */
export function movePct(p: Player): number {
  return p.channel ? channelMsPct(p) : p.live.mv ? p.ctx.d.ms + p.live.mv : p.ctx.d.ms;
}

/** Start counting a cast's hits for a spendRefund rule (false when no rule applies to this skill). */
export function trackCast(inst: Instance, p: Player, skill: string, cost: number): boolean {
  const r = p.ctx.powers.rules.spendRefund.find((x) => !x.skills || x.skills.has(skill));
  if (!r || cost <= 0) return false;
  powerState(p).cast = { skill, cost, pct: r.pct, minHits: r.minHits, until: inst.t + r.windowMs, hits: new Set() };
  return true;
}

/** A strike of the tracked cast hit `m`: at minHits different enemies inside the window, refund once. */
export function countCastHit(inst: Instance, p: Player, m: Mob, skill: string) {
  const c = p.pw!.cast!;
  if (inst.t > c.until) { p.pw!.cast = null; return; }
  if (skill !== c.skill) return;
  c.hits.add(m.id);
  if (c.hits.size >= c.minHits) { p.res = Math.min(p.mres, p.res + c.cost * c.pct / 100); p.pw!.cast = null; }
}

/** In combat = hit something or got hit recently (the Fury-decay and out-of-combat-regeneration delays [M]). */
const inCombat = (p: Player) => p.sinceHitMs <= FURY_DECAY_DELAY_MS || p.sinceHurtMs < OOC_REGEN_DELAY_MS;

/** Buff upkeep: a target buff about to run out in combat costs its skill's resource again and lasts everyMs more. */
function buffUpkeep(p: Player, dtMs: number) {
  for (const r of p.ctx.powers.rules.buffUpkeep) for (const b of p.buffs) {
    if (b.ms === Infinity || b.ms > dtMs * 2 || (r.skills && !r.skills.has(b.id)) || !Object.hasOwn(SKILLS, b.id)) continue;
    const rt = p.ctx.slotted(b.id);
    if (!rt || !inCombat(p)) continue;
    const cost = skillCost(p, rt);
    if (p.res < cost) continue;
    p.res -= cost;
    b.ms = r.everyMs;
  }
}

// ─────────────────────────── Resource debt ───────────────────────────

/** Lowest resource a cast of `skill` may leave (0 without a resourceDebt template for it). */
export function debtFloor(p: Player, skill: string): number {
  let floor = 0;
  for (const d of p.ctx.powers.debt) if (!d.skills || d.skills.has(skill)) floor = Math.min(floor, -d.max);
  return floor;
}

/** Resource regeneration factor while below zero (product of the debt templates' regenPct). */
export function debtRegenFactor(p: Player): number {
  let f = 1;
  for (const d of p.ctx.powers.debt) if (d.regenPct) f *= Math.max(0, 1 + d.regenPct / 100);
  return f;
}

/** Fire the takeDamage procs for a hit that landed (big-hit hooks filter with minHitPct). */
export function onPlayerDamaged(inst: Instance, p: Player, amount: number, src: Mob | null) {
  firePowerProcs(inst, p, 'takeDamage', { amount, mob: src });
}

