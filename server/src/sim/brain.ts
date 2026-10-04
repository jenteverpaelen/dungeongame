// Player combat brain (ARCHITECTURE 1.4): auto-attack while moving + auto-cast of the 4 slotted skills.

import { ACQUIRE_BUFFER } from '../shared';
import { getBuff, hasDot, shotBlocked } from './effects';
import type { Instance } from './instance';
import { maxSummonsOf, skillCooldownMs, skillCost, skillRadius } from './playerctx';
import { castPrimary, castSkill, channelTick, startChannel } from './skills';
import type { Mob, Player, SkillRuntime } from './types';

/** Monster weight for auto-cast counting / ground targeting: elites 3×, bosses 10×. */
export function mobWeight(m: Mob): number {
  return m.tier === 4 ? 10 : m.tier === 1 || m.tier === 2 || m.tier === 5 ? 3 : 1;
}

export function isTargetable(m: Mob): boolean {
  return !m.dead;
}

/** Nearest monster within range (body-inclusive), preferring elites / bosses within 1.2× the nearest distance. */
export function pickTarget(inst: Instance, x: number, y: number, range: number, needLos: boolean): Mob | null {
  const list = inst.queryMobs(x, y, range);
  if (!list.length) return null;
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
    if (d <= range + m.r) cands.push(m);
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

function ruleHolds(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const a = rt.def.auto;
  switch (a.when) {
    case 'always':
      return anyEnemyWithin(inst, p.x, p.y, rt.def.range || 400);
    case 'enemiesNear': {
      const within = ruleWithin(rt, a.within);
      if (rt.def.id === 'rend') return enemyWeight(inst, p.x, p.y, within, (m) => !hasDot(m, 'bleed', p.id)) >= a.count;
      return enemyWeight(inst, p.x, p.y, within) >= a.count;
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

/** Per tick: channel upkeep, at most one auto-cast, and the primary attack. */
export function playerBrain(inst: Instance, p: Player, dtMs: number) {
  if (p.deadMs > 0) return;
  p.atkCdMs -= dtMs;
  if (p.stunMs > 0 || p.frozenMs > 0) { p.channel = null; if (p.atkCdMs < 0) p.atkCdMs = 0; return; }

  if (p.channel) channelTick(inst, p, dtMs);

  // Auto-cast: first eligible slot (left → right), one cast per tick.
  const c = p.ctx;
  for (let i = 0; i < 4; i++) {
    const rt = c.slots[i];
    if (!rt) continue;
    const id = rt.def.id;
    if ((p.readyAt.get(id) ?? 0) > inst.t) continue;
    if (rt.def.auto.when === 'channel') {
      if (p.channel) continue;
      const a = rt.def.auto;
      if (p.res < a.startAt || p.res < skillCost(p, rt) * 0.25) continue;
      if (!anyEnemyWithin(inst, p.x, p.y, a.within)) continue;
      startChannel(inst, p, rt);
      break;
    }
    const cost = skillCost(p, rt);
    if (p.res < cost) continue;
    if (!ruleHolds(inst, p, rt)) continue;
    if (!castSkill(inst, p, rt)) continue;
    p.res -= cost;
    // Seal of the Patient Thief: every resource-spending cast shortens all active cooldowns.
    const thief = cost > 0 ? c.power('patient_thief') : 0;
    if (thief) for (const [k, v] of p.readyAt) p.readyAt.set(k, v - thief * 1000);
    const cd = skillCooldownMs(p, rt);
    if (cd > 0) p.readyAt.set(id, inst.t + cd);
    p.castFlagMs = 300;
    p.attackSeq++;
    break;
  }

  // Primary attack (not while spinning).
  if (p.channel) { if (p.atkCdMs < 0) p.atkCdMs = 0; return; }
  if (p.atkCdMs > 0) return;
  const melee = c.attackRange < 200;
  const tgt = pickTarget(inst, p.x, p.y, c.attackRange + ACQUIRE_BUFFER, !melee);
  if (!tgt) { p.atkCdMs = 0; return; }
  castPrimary(inst, p, tgt);
  const aps = Math.max(0.2, c.d.aps * (1 + p.live.ias / 100));
  p.atkCdMs += 1000 / aps;
  if (p.atkCdMs < 0) p.atkCdMs = 0;
}
