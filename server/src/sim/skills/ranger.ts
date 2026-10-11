// Ranger skill behaviour (server authority). Data: shared/src/data/skills/ranger.ts.
// Hungering Arrow, Sentry (+ turret AI and Chain of Torment), Multishot, Cluster Arrow, Rain of Vengeance,
// Companion (+ wolf / bat / raven AI and Pack Leader).

import { PLAYER_RADIUS } from '../../shared';
import { bestConeAngle, bestPoint, pickTarget, summonCount } from '../brain';
import { gainResource, strikeMob } from '../damage';
import { addBuff, distToSegment, elIdx, getBuff, removeBuff } from '../effects';
import { addGround, newGround } from '../grounds';
import type { Instance } from '../instance';
import { maxSummonsOf, skillDurationMs, skillElement, skillMult, skillPct, skillRadius } from '../playerctx';
import { spawnProj } from '../projectiles';
import { moveSummon, spawnSummon } from '../summons';
import {
  PB_CHILL, PB_DEVOUR, PB_MARK, PB_NOGRENADE, PB_ROCKETS, PB_SPLIT,
  type Mob, type Player, type Proj, type SkillRuntime, type Strike, type Summon,
} from '../types';
import {
  DEG, emitCast, face, faceTo, fanAngles, strikeOf, trimSummons,
  type OwnerSummonHook, type SkillBehaviour, type SummonBehaviour,
} from './common';

// ─────────────────────────── Hungering Arrow (primary) ───────────────────────────

function hungeringArrow(inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob) {
  const n = 1 + (rt.mods.projectiles ?? 0);
  const base = Math.atan2(tgt.y - p.y, tgt.x - p.x);
  const st: Strike = { ...strikeOf(p, rt), primary: true };
  const mark = rt.flags.has('huntersMark');
  const pierce = mark ? 1 : Math.min(1, (35 + (rt.mods.pierce ?? 0)) / 100);
  let bits = 0;
  if (rt.flags.has('splitOnPierce')) bits |= PB_SPLIT;
  if (rt.flags.has('devouring')) bits |= PB_DEVOUR;
  if (mark) bits |= PB_MARK;
  for (const off of fanAngles(n, 10 * DEG)) {
    spawnProj(inst, {
      kind: 'arrow', v: 'arrow', owner: p, src: p.id, x: p.x, y: p.y - 4, angle: base + off, speed: 900, lifeMs: 820, r: 12,
      el: st.el, strike: st, pierce, homing: tgt.id, turn: 6, seek: true, bits,
    });
  }
  gainResource(p, rt.def.gen + (rt.mods.gen ?? 0));
  emitCast(inst, p, rt, tgt.x, tgt.y);
}

// ─────────────────────────── Sentry ───────────────────────────

function sentry(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  let x = p.x, y = p.y;
  // keep turrets slightly apart so chains have length
  for (const s of p.summons) {
    if (s.type !== 'sentry' || s.dead) continue;
    if (Math.hypot(s.x - x, s.y - y) < 40) {
      const a = inst.rng.next() * Math.PI * 2;
      const tx = p.x + Math.cos(a) * 46, ty = p.y + Math.sin(a) * 46;
      if (inst.cw.isFree(tx, ty, 12)) { x = tx; y = ty; }
      break;
    }
  }
  spawnSummon(inst, p, 'sentry', 'sentry', x, y, skillDurationMs(rt));
  trimSummons(p, 'sentry', maxSummonsOf(rt));
  emitCast(inst, p, rt, x, y);
  return true;
}

function sentryAi(inst: Instance, s: Summon, p: Player, dtMs: number) {
  const rt = p.ctx.modsOf('sentry');
  const fast = rt.flags.has('fastSentry');
  s.fireMs -= dtMs;
  if (s.fireMs <= 0) {
    const tgt = pickTarget(inst, s.x, s.y, rt.def.radius, true, p.save.skills.targetPriority);
    if (!tgt) { s.fireMs = 150; }
    else {
      s.fireMs += 1000 / (fast ? 1.5 : 1);
      if (s.fireMs < 0) s.fireMs = 0;
      faceTo(s, tgt.x);
      s.attackSeq++;
      s.attackFlagMs = 200;
      const el = skillElement(rt);
      spawnProj(inst, {
        kind: 'bolt', v: 'bolt', owner: p, src: s.id, x: s.x, y: s.y - 20, angle: Math.atan2(tgt.y - (s.y - 20), tgt.x - s.x), speed: 1000,
        lifeMs: 750, r: 10, el, homing: tgt.id, turn: 4,
        strike: { skill: 'sentry', coef: rt.def.coef, el, pct: skillPct(p, rt), mult: skillMult(p, 'sentry'), src: s.id },
        bits: rt.flags.has('chill') ? PB_CHILL : 0,
      });
    }
  }
  if (rt.flags.has('rockets')) {
    s.rocketMs -= dtMs;
    if (s.rocketMs <= 0) {
      const tgt = pickTarget(inst, s.x, s.y, rt.def.range, false, p.save.skills.targetPriority);
      if (!tgt) s.rocketMs = 200;
      else {
        s.rocketMs += 1500;
        const a = Math.atan2(tgt.y - s.y, tgt.x - s.x) + (inst.rng.next() - 0.5) * 1.2;
        spawnProj(inst, {
          kind: 'rocket', v: 'rocket', owner: p, src: s.id, x: s.x, y: s.y - 24, angle: a, speed: 620, lifeMs: 1600, r: 12, el: 'fire',
          homing: tgt.id, turn: 5, seek: true,
          strike: { skill: 'sentry', coef: 1.2, el: 'fire', pct: skillPct(p, rt), mult: skillMult(p, 'sentry'), src: s.id },
        });
      }
    }
  }
}

// ─────────────────────────── Multishot ───────────────────────────

function multishotTarget(inst: Instance, p: Player, range: number): { ang: number; x: number; y: number } | null {
  const ang = bestConeAngle(inst, p.x, p.y, range, 35 * DEG);
  if (ang === null) return null;
  const t = pickTarget(inst, p.x, p.y, range, false, p.save.skills.targetPriority);
  const d = t ? Math.min(range, Math.hypot(t.x - p.x, t.y - p.y)) : range * 0.7;
  return { ang, x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d };
}

function fireMultishot(inst: Instance, p: Player, rt: SkillRuntime, ox: number, oy: number, ang: number, src: number) {
  const n = 9 + (rt.mods.projectiles ?? 0);
  const spread = 70 * DEG;
  const st: Strike = { ...strikeOf(p, rt), src };
  const hits = new Set<number>();
  for (let i = 0; i < n; i++) {
    const a = ang - spread / 2 + (spread * i) / Math.max(1, n - 1);
    spawnProj(inst, {
      kind: 'multi', v: 'arrow', owner: p, src, x: ox, y: oy - 4, angle: a, speed: 1150, lifeMs: 560, r: 14, el: st.el,
      strike: st, pierce: 1, hits,
    });
  }
  if (rt.flags.has('rockets')) {
    const near = inst.queryMobs(ox, oy, rt.def.range).filter((m) => !m.dead);
    for (let i = 0; i < 3; i++) {
      const t = near.length ? near[Math.floor(inst.rng.next() * near.length)] : null;
      spawnProj(inst, {
        kind: 'rocket', v: 'rocket', owner: p, src, x: ox, y: oy - 10, angle: ang + (i - 1) * 0.5, speed: 680, lifeMs: 1400, r: 12, el: 'fire',
        strike: { ...st, coef: 3.0, el: 'fire' }, homing: t ? t.id : 0, turn: 5, seek: true,
      });
    }
  }
}

function multishot(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const t = multishotTarget(inst, p, rt.def.range);
  if (!t) return false;
  face(p, t.x);
  fireMultishot(inst, p, rt, p.x, p.y, t.ang, p.id);
  if (p.ctx.modsOf('sentry').flags.has('sentryCasts')) {
    for (const s of p.summons) {
      if (s.type !== 'sentry' || s.dead || Math.hypot(t.x - s.x, t.y - s.y) > rt.def.range) continue;
      s.attackSeq++; s.attackFlagMs = 200;
      fireMultishot(inst, p, rt, s.x, s.y, Math.atan2(t.y - s.y, t.x - s.x), s.id);
    }
  }
  emitCast(inst, p, rt, t.x, t.y);
  return true;
}

// ─────────────────────────── Cluster Arrow ───────────────────────────

function lobCluster(inst: Instance, p: Player, rt: SkillRuntime, ox: number, oy: number, tx: number, ty: number, src: number) {
  const d = Math.max(20, Math.hypot(tx - ox, ty - oy));
  let bits = 0;
  if (rt.flags.has('noGrenades')) bits |= PB_NOGRENADE;
  if (rt.flags.has('rockets')) bits |= PB_ROCKETS;
  spawnProj(inst, {
    kind: 'cluster', v: 'cluster', owner: p, src, x: ox, y: oy, angle: Math.atan2(ty - oy, tx - ox), speed: d / 0.45, lifeMs: 450,
    r: 10, el: skillElement(rt), strike: { ...strikeOf(p, rt), src }, tx, ty, bits,
  });
}

/** Cluster Arrow detonation (called when the lobbed arrow lands). */
export function clusterExplode(inst: Instance, pr: Proj) {
  const p = pr.owner;
  if (!p || !pr.strike || !inst.playerById(p.id)) return;
  const rt = p.ctx.modsOf('cluster_arrow');
  const radius = skillRadius(rt);
  const st = pr.strike;
  for (const m of inst.queryMobs(pr.x, pr.y, radius)) if (!m.dead) strikeMob(inst, p, m, st);
  inst.emit({ e: 'aoe', v: 'cluster', x: Math.round(pr.x), y: Math.round(pr.y), r: Math.round(radius), d: 420, el: elIdx(st.el), s: st.src ?? p.id }, pr.x, pr.y, p.id);
  if (pr.bits & PB_NOGRENADE) return;
  if (pr.bits & PB_ROCKETS) {
    const near = inst.queryMobs(pr.x, pr.y, rt.def.range).filter((m) => !m.dead&&Math.hypot(m.x-p.x,m.y-p.y)<=rt.def.range);
    for (let i = 0; i < 3; i++) {
      const t = near.length ? near[Math.floor(inst.rng.next() * near.length)] : null;
      spawnProj(inst, {
        kind: 'rocket', v: 'rocket', owner: p, src: st.src ?? p.id, x: pr.x, y: pr.y - 10, angle: inst.rng.next() * Math.PI * 2, speed: 640,
        lifeMs: 1400, r: 12, el: 'fire', strike: { ...st, coef: 2.1, el: 'fire' }, homing: t ? t.id : 0, turn: 6, seek: true,
      });
    }
    return;
  }
  for (let i = 0; i < 4; i++) {
    const a = inst.rng.next() * Math.PI * 2, d = 60 + inst.rng.next() * 50;
    const gx = pr.x + Math.cos(a) * d, gy = pr.y + Math.sin(a) * d;
    inst.sched.schedule(inst.t + 350, () => {
      if (!inst.playerById(p.id)) return;
      for (const m of inst.queryMobs(gx, gy, 50)) if (!m.dead) strikeMob(inst, p, m, { ...st, coef: 2.1 });
      inst.emit({ e: 'aoe', v: 'grenade', x: Math.round(gx), y: Math.round(gy), r: 50, d: 300, el: elIdx(st.el), s: st.src ?? p.id }, gx, gy, p.id);
    });
  }
}

function clusterArrow(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  const bp = bestPoint(inst, p.x, p.y, rt.def.range, radius);
  if (!bp) return false;
  face(p, bp.x);
  lobCluster(inst, p, rt, p.x, p.y, bp.x, bp.y, p.id);
  if (p.ctx.modsOf('sentry').flags.has('sentryCasts')) {
    for (const s of p.summons) {
      if (s.type !== 'sentry' || s.dead || Math.hypot(bp.x - s.x, bp.y - s.y) > rt.def.range) continue;
      s.attackSeq++; s.attackFlagMs = 200;
      lobCluster(inst, p, rt, s.x, s.y, bp.x + (inst.rng.next() - 0.5) * 40, bp.y + (inst.rng.next() - 0.5) * 40, s.id);
    }
  }
  emitCast(inst, p, rt, bp.x, bp.y, radius);
  return true;
}

// ─────────────────────────── Rain of Vengeance ───────────────────────────

function rainOfVengeance(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  const bp = bestPoint(inst, p.x, p.y, rt.def.range, radius);
  if (!bp) return false;
  const dur = skillDurationMs(rt);
  const g = newGround('rain', bp.x, bp.y, radius, inst.t, dur + 100, dur / 10);
  g.nextT = inst.t + 100;
  g.owner = p;
  g.waves = 10;
  g.follow = rt.flags.has('follow');
  g.el = skillElement(rt);
  g.strike = strikeOf(p, rt, rt.def.coef / 10);
  addGround(inst, g);
  emitCast(inst, p, rt, bp.x, bp.y, radius);
  return true;
}

// ─────────────────────────── Companion ───────────────────────────

function companion(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const type = rt.flags.has('batCompanion') ? 'bat' : rt.flags.has('ravenCompanion') ? 'raven' : 'wolf';
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
  return { skill: 'companion', coef: rt.def.coef, el: skillElement(rt), pct: skillPct(p, rt) };
}

function companionAi(inst: Instance, s: Summon, p: Player, dtMs: number, dtS: number) {
  const speed = s.type === 'wolf' ? 360 : 390;
  // keep the current target while it is alive and near the owner
  let tgt = s.targetId ? inst.mob(s.targetId) ?? null : null;
  const reach=p.ctx.modsOf('companion').def.range;
  if (!tgt || tgt.dead || Math.hypot(tgt.x - p.x, tgt.y - p.y) > reach+PLAYER_RADIUS*2) {
    tgt = pickTarget(inst, p.x, p.y, reach, false, p.save.skills.targetPriority);
    s.targetId = tgt ? tgt.id : 0;
  }
  if (Math.hypot(s.x - p.x, s.y - p.y) > 900) { s.x = p.x - 30; s.y = p.y + 10; }
  s.fireMs -= dtMs;
  if (tgt) {
    const reach = s.r + tgt.r + (s.type === 'raven' ? 60 : 14);
    moveSummon(inst, s, tgt.x, tgt.y, speed, dtS, reach);
    if (Math.hypot(tgt.x - s.x, tgt.y - s.y) <= reach + 4 && s.fireMs <= 0) {
      s.fireMs = 1000;
      faceTo(s, tgt.x);
      s.attackSeq++;
      s.attackFlagMs = 250;
      strikeMob(inst, p, tgt, { ...companionStrike(p), src: s.id });
    }
    if (s.fireMs < 0) s.fireMs = 0;
  } else {
    const side = s.aux % 2 === 0 ? -1 : 1;
    const fx = p.x + side * 44 - (p.faceLeft ? -20 : 20), fy = p.y + 14 + (s.aux > 1 ? 24 : 0);
    moveSummon(inst, s, fx, fy, Math.max(speed * 0.8, 260), dtS, 28);
  }
}

// ─────────────────────────── Owner hooks: Pack Leader, Chain of Torment ───────────────────────────

const rangerOwnerHook: OwnerSummonHook = {
  withSummons(inst, p, dtMs) {
    // Pack Leader: +15% damage while a wolf is alive.
    const comp = p.ctx.slotted('companion');
    const wolf = comp && comp.flags.has('wolfAura') && p.summons.some((s) => s.type === 'wolf');
    if (wolf && !getBuff(p, 'pack_leader')) addBuff(p, { id: 'pack_leader', ms: Infinity, dmg: 15 });
    else if (!wolf && getBuff(p, 'pack_leader')) removeBuff(p, 'pack_leader');
    // Chain of Torment: lightning between sentries every 0.5 s.
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
  withoutSummons(_inst, p) {
    if (getBuff(p, 'pack_leader')) removeBuff(p, 'pack_leader');
  },
};

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
};

export const RANGER_OWNER_HOOKS: OwnerSummonHook[] = [rangerOwnerHook];
