// Player combat brain (ARCHITECTURE 1.4): auto-attack while moving + auto-cast of the 4 slotted skills.

import { ACQUIRE_BUFFER, TICK_MS } from '../shared';
import { autoCastMode } from '../../../shared/src/autoCast';
import { autoRuleForSlot, DEFAULT_AUTO_RULE, type AutoCastRule } from '../../../shared/src/autoCastRules';
import type { TargetPriority } from '../../../shared/src/targetPriority';
import { getBuff, hasDot, shotBlocked } from './effects';
import type { Instance } from './instance';
import { maxSummonsOf, skillCooldownMs, skillCost, skillRadius } from './playerctx';
import { castPrimary, castSkill, channelTick, endChannel, startChannel } from './skills';
import type { Mob, Player, SkillRuntime } from './types';

/** Monster weight for auto-cast counting / ground targeting: elites 3×, bosses 10×. */
export function mobWeight(m: Mob): number {
  return m.tier === 4 ? 10 : m.tier === 1 || m.tier === 2 || m.tier === 5 ? 3 : 1;
}

export function isTargetable(m: Mob): boolean {
  return !m.dead;
}

/** Body-inclusive acquisition. Default preserves the original nearby-elite preference. */
export function pickTarget(inst: Instance, x: number, y: number, range: number, needLos: boolean, preference: TargetPriority = 'default'): Mob | null {
  const list = inst.queryMobs(x, y, range);
  if (!list.length) return null;
  if (preference === 'nearest' || preference === 'elites' || preference === 'lowestLife') {
    let best: Mob | null = null, bestRank = Infinity, bestDistance = Infinity;
    for (const m of list) {
      if (!isTargetable(m)) continue;
      const rank = preference === 'lowestLife' ? m.hp / m.mhp
        : preference === 'elites' && (m.tier === 0 || m.tier === 3) ? 1 : 0;
      const distance = Math.hypot(m.x - x, m.y - y) - m.r;
      if (rank > bestRank || (rank === bestRank && distance >= bestDistance)) continue;
      if (needLos && shotBlocked(inst, x, y, m.x, m.y)) continue;
      best = m; bestRank = rank; bestDistance = distance;
    }
    return best;
  }
  let best: Mob | null = null, bd = Infinity;
  for (const m of list) {
    if (!isTargetable(m)) continue;
    const d = Math.hypot(m.x - x, m.y - y) - m.r;
    if (d < bd) {
      if (needLos && shotBlocked(inst, x, y, m.x, m.y)) continue;
      bd = d; best = m;
    }
  }
  if (!best) return null;
  if (best.tier === 0 || best.tier === 3) {
    let elite: Mob | null = null, ed = Infinity;
    for (const m of list) {
      if (!isTargetable(m) || (m.tier !== 1 && m.tier !== 2 && m.tier !== 4 && m.tier !== 5)) continue;
      const d = Math.hypot(m.x - x, m.y - y) - m.r;
      if (d <= Math.max(bd * 1.2, bd + 30) && d < ed) {
        if (needLos && shotBlocked(inst, x, y, m.x, m.y)) continue;
        ed = d; elite = m;
      }
    }
    if (elite) return elite;
  }
  return best;
}

/** Weighted count of enemies within `within` of (x, y). */
export function enemyWeight(inst: Instance, x: number, y: number, within: number, filter?: (m: Mob) => boolean): number {
  const list = inst.queryMobs(x, y, within);
  let n = 0;
  for (const m of list) if (!m.dead && (!filter || filter(m))) n += mobWeight(m);
  return n;
}

export function anyEnemyWithin(inst: Instance, x: number, y: number, r: number): boolean {
  return inst.mobHash.nearest(x, y, r, (m) => !m.dead) !== null;
}

/**
 * Ground targeting: among enemy positions within `range` (up to 24 samples), the point that maximises the
 * weighted number of enemies within `radius`.
 */
export function bestPoint(inst: Instance, x: number, y: number, range: number, radius: number): { x: number; y: number; score: number; mob: Mob } | null {
  const all = inst.queryMobs(x, y, range + radius);
  const cands: Mob[] = [];
  for (const m of all) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - x, m.y - y);
    if (d <= range) cands.push(m);
  }
  if (!cands.length) return null;
  const step = Math.max(1, Math.ceil(cands.length / 24));
  let best: { x: number; y: number; score: number; mob: Mob } | null = null;
  const r2 = radius * radius;
  for (let i = 0; i < cands.length; i += step) {
    const c = cands[i];
    let score = 0;
    for (const m of all) {
      if (m.dead) continue;
      const dx = m.x - c.x, dy = m.y - c.y;
      if (dx * dx + dy * dy <= r2 + m.r * m.r) score += mobWeight(m);
    }
    if (!best || score > best.score) best = { x: c.x, y: c.y, score, mob: c };
  }
  return best;
}

/** Direction (radians) from (x, y) that hits the most weighted enemies in a cone. */
export function bestConeAngle(inst: Instance, x: number, y: number, len: number, half: number): number | null {
  const all = inst.queryMobs(x, y, len);
  if (!all.length) return null;
  let bestA: number | null = null, bestS = -1;
  const step = Math.max(1, Math.ceil(all.length / 16));
  for (let i = 0; i < all.length; i += step) {
    const c = all[i];
    if (c.dead) continue;
    const a = Math.atan2(c.y - y, c.x - x);
    let s = 0;
    for (const m of all) {
      if (m.dead) continue;
      const da = Math.abs(Math.atan2(Math.sin(Math.atan2(m.y - y, m.x - x) - a), Math.cos(Math.atan2(m.y - y, m.x - x) - a)));
      if (da <= half) s += mobWeight(m);
    }
    if (s > bestS) { bestS = s; bestA = a; }
  }
  return bestA;
}

export function summonCount(p: Player, skillId: string, within = Infinity): number {
  let n = 0;
  const w2 = within * within;
  for (const s of p.summons) {
    if (s.dead || s.skill !== skillId || s.type === 'dust_devil') continue;
    if (within !== Infinity && (s.x - p.x) ** 2 + (s.y - p.y) ** 2 > w2) continue;
    n++;
  }
  return n;
}

/** Scale an auto-rule distance for self-centred skills whose radius was increased by runes/tiers/legendaries. */
function ruleWithin(rt: SkillRuntime, within: number): number {
  const selfCentred = rt.def.id === 'rend' || rt.def.id === 'ground_stomp' || rt.def.id === 'frost_nova';
  if (!selfCentred) return within;
  return within * Math.max(1, skillRadius(rt) / rt.def.radius);
}

function ruleHolds(inst: Instance, p: Player, rt: SkillRuntime, rule: Readonly<AutoCastRule>): boolean {
  const a = rt.def.auto;
  switch (a.when) {
    case 'always':
      return anyEnemyWithin(inst, p.x, p.y, rt.def.range || 400);
    case 'enemiesNear': {
      const within = ruleWithin(rt, Math.min(rule.within ?? a.within, a.within));
      const count = rule.enemyWeight ?? a.count;
      if (rt.def.id === 'rend') return enemyWeight(inst, p.x, p.y, within, (m) => !hasDot(m, 'bleed', p.id)) >= count;
      return enemyWeight(inst, p.x, p.y, within) >= count;
    }
    case 'maintainBuff': {
      const b = getBuff(p, rt.def.id);
      if (b && b.ms > 2000) return false;
      return anyEnemyWithin(inst, p.x, p.y, 700);
    }
    case 'maintainSummon': {
      // Stationary summons left far behind don't count: new ones are placed and the farthest retire.
      const near = rt.def.id === 'companion' ? Infinity : rt.def.range;
      if (summonCount(p, rt.def.id, near) >= maxSummonsOf(rt)) return false;
      if (rt.def.id === 'companion') return true;
      return anyEnemyWithin(inst, p.x, p.y, rt.def.range);
    }
    case 'channel':
      return false;
  }
}

function automaticFilters(inst: Instance, p: Player, rt: SkillRuntime, rule: Readonly<AutoCastRule>, spending: number): boolean {
  if (rule.reservePct > 0 && p.res - spending < p.mres * rule.reservePct / 100) return false;
  if (rule.requireBuff && !getBuff(p,rule.requireBuff)) return false;
  if (rule.elitesOnly) {
    const a = rt.def.auto;
    const within = a.when === 'enemiesNear' ? ruleWithin(rt,Math.min(rule.within ?? a.within,a.within))
      : a.when === 'channel' ? a.within : a.when === 'maintainBuff' ? 700 : rt.def.range || 400;
    if (!inst.queryMobs(p.x,p.y,within).some(m => !m.dead && (m.tier === 1 || m.tier === 2 || m.tier === 4))) return false;
  }
  return true;
}

/** Check both at receipt and at execution: a loadout or control state can change between them. */
export function validateManualCast(p: Player, slot: number, skill: string): string | null {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 4) return 'Invalid skill slot';
  if (p.deadMs > 0 || p.hp <= 0) return 'Cannot cast while dead';
  if (p.stunMs > 0 || p.frozenMs > 0) return 'Cannot cast while stunned or frozen';
  const rt = p.ctx.slots[slot];
  if (!rt || p.save.skills.slots[slot] !== skill || rt.def.id !== skill) return 'The skill in this slot changed. Choose it again.';
  if (rt.def.classId !== p.save.classId || rt.def.kind === 'primary' || p.save.level < rt.def.unlock) return 'Skill is not unlocked';
  return null;
}

/** Both entry paths spend through the same budget. Only automatic trigger rules differ. */
function trySlotCast(inst: Instance, p: Player, rt: SkillRuntime, manual: boolean, rule: Readonly<AutoCastRule> = DEFAULT_AUTO_RULE): string | null {
  const id = rt.def.id;
  if ((p.readyAt.get(id) ?? 0) > inst.t) return `${rt.def.name} is on cooldown`;
  if (rt.def.auto.when === 'channel') {
    if (p.channel) return 'Already channeling';
    const a = rt.def.auto;
    if (p.res < a.startAt || p.res < skillCost(p, rt) * 0.25) return `Not enough resource for ${rt.def.name}`;
    if (!manual && !automaticFilters(inst,p,rt,rule,skillCost(p,rt)*TICK_MS/1000)) return 'Automatic condition not met';
    if (!manual && !anyEnemyWithin(inst, p.x, p.y, a.within)) return 'No enemy in range';
    startChannel(inst, p, rt, manual);
    return null;
  }
  const cost = skillCost(p, rt);
  if (p.res < cost) return `Not enough resource for ${rt.def.name}`;
  if (!manual && (!automaticFilters(inst,p,rt,rule,cost) || !ruleHolds(inst,p,rt,rule))) return 'Automatic condition not met';
  if (!castSkill(inst, p, rt)) return `No valid target for ${rt.def.name}`;
  p.res -= cost;
  // Seal of the Patient Thief: every resource-spending cast shortens all active cooldowns.
  const thief = cost > 0 ? p.ctx.power('patient_thief') : 0;
  if (thief) for (const [k, v] of p.readyAt) p.readyAt.set(k, v - thief * 1000);
  const cd = skillCooldownMs(p, rt);
  if (cd > 0) p.readyAt.set(id, inst.t + cd);
  p.castFlagMs = 300;
  p.attackSeq++;
  return null;
}

/** Per tick: channel upkeep, at most one slotted cast (manual or automatic), and the primary attack. */
export function playerBrain(inst: Instance, p: Player, dtMs: number) {
  const request = p.manualCast;
  p.manualCast = undefined;
  let requestError = request ? validateManualCast(p, request.slot, request.skill) : null;
  if (requestError) inst.emitTo(p.id, { e: 'notice', text: requestError, kind: 'warn' });
  if (p.deadMs > 0) return;
  p.atkCdMs -= dtMs;
  if (p.stunMs > 0 || p.frozenMs > 0) { p.channel = null; if (p.atkCdMs < 0) p.atkCdMs = 0; return; }

  let usedSlot = false;
  if (request && !requestError && p.channel?.skill === request.skill) {
    endChannel(inst, p);
    usedSlot = true; // An explicit stop cannot restart automatically in this tick.
  }
  if (p.channel) {
    const slot = p.save.skills.slots.indexOf(p.channel.skill);
    const rt = p.ctx.slots[slot];
    if (!rt || slot < 0 || (!p.channel.manual && (!slotAllowsCast(p, slot) || !automaticFilters(inst,p,rt,autoRuleForSlot(p.save.skills,slot),skillCost(p,rt)*dtMs/1000)))) endChannel(inst, p);
    else channelTick(inst, p, dtMs);
  }

  const c = p.ctx;
  if (request && !requestError && !usedSlot) {
    requestError = trySlotCast(inst, p, c.slots[request.slot]!, true);
    usedSlot = requestError === null;
    if (requestError) inst.emitTo(p.id, { e: 'notice', text: requestError, kind: 'warn' });
  }
  // Failed manual attempts do not stall the normal automatic priority order.
  for (let i = 0; !usedSlot && i < 4; i++) {
    const rt = c.slots[i];
    if (!rt || !slotAllowsCast(p, i)) continue;
    usedSlot = trySlotCast(inst, p, rt, false, autoRuleForSlot(p.save.skills,i)) === null;
  }

  // Primary attack (not while spinning).
  if (p.channel) { if (p.atkCdMs < 0) p.atkCdMs = 0; return; }
  if (p.atkCdMs > 0) return;
  const melee = c.attackRange < 200;
  const tgt = pickTarget(inst, p.x, p.y, c.attackRange + (melee?ACQUIRE_BUFFER:0), !melee, p.save.skills.targetPriority);
  if (!tgt) { p.atkCdMs = 0; return; }
  castPrimary(inst, p, tgt);
  const aps = Math.max(0.2, c.d.aps * (1 + p.live.ias / 100));
  p.atkCdMs += 1000 / aps;
  if (p.atkCdMs < 0) p.atkCdMs = 0;
}

function slotAllowsCast(p: Player, slot: number): boolean {
  const mode = autoCastMode(p.save.skills, slot);
  return mode === 'auto' || (mode === 'still' && !p.moving && p.mv.dashMs <= 0);
}
