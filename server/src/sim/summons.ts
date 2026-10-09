// Summons: Sentry turrets, Hydras, Companions (wolf / bat / raven) and Whirlwind's Dust Devils.

import { F_ATTACK, F_LEFT, F_MOVING } from '../shared';
import { pickTarget } from './brain';
import { strikeMob } from './damage';
import { addBuff, distToSegment, elIdx, getBuff, removeBuff, shotBlockedAt } from './effects';
import { nextId } from './ids';
import type { Instance } from './instance';
import { skillElement, skillMult, skillPct } from './playerctx';
import { spawnProj } from './projectiles';
import { PB_CHILL, type Player, type Strike, type Summon, type SummonType } from './types';

const RADIUS: Record<SummonType, number> = { sentry: 18, hydra: 24, wolf: 16, bat: 12, raven: 12, dust_devil: 20 };

export function spawnSummon(inst: Instance, p: Player, type: SummonType, skill: string, x: number, y: number, lifeMs: number, big = false): Summon {
  const s: Summon = {
    kind: 'summon', id: nextId(), type, owner: p, skill, flags: 0, attackSeq: 0,
    x, y, r: big ? 36 : RADIUS[type], hCell: -1, hIdx: -1,
    lifeMs, fireMs: type === 'sentry' ? 250 : 400, rocketMs: 900, chainMs: 500, tickMs: 0, wanderMs: 0,
    targetId: 0, tx: x, ty: y, aux: 0, attackFlagMs: 0, faceLeft: p.faceLeft, moving: false, dead: false, descVer: 1, big,
  };
  inst.addSummon(s);
  p.summons.push(s);
  return s;
}

function companionStrike(p: Player): Strike {
  const rt = p.ctx.modsOf('companion');
  return { skill: 'companion', coef: rt.def.coef, el: skillElement(rt), pct: skillPct(p, rt) };
}

function faceTo(s: Summon, x: number) {
  if (Math.abs(x - s.x) > 2) s.faceLeft = x < s.x;
}

function moveSummon(inst: Instance, s: Summon, tx: number, ty: number, speed: number, dtS: number, stopAt: number) {
  const dx = tx - s.x, dy = ty - s.y;
  const d = Math.hypot(dx, dy);
  if (d <= stopAt) { s.moving = false; return; }
  const st = Math.min(d - stopAt, speed * dtS);
  const fly = s.type === 'bat' || s.type === 'raven' || s.type === 'dust_devil';
  const q = fly ? { x: s.x + (dx / d) * st, y: s.y + (dy / d) * st } : inst.cw.moveCircle(s.x, s.y, 10, (dx / d) * st, (dy / d) * st, true);
  if (fly && shotBlockedAt(inst, q.x, q.y)) { s.moving = false; return; }
  s.x = q.x; s.y = q.y;
  s.moving = true;
  faceTo(s, tx);
}

export function updateSummons(inst: Instance, dtMs: number) {
  const dtS = dtMs / 1000;
  const list = inst.summons;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.dead) continue;
    const p = s.owner;
    if (s.lifeMs !== Infinity) {
      s.lifeMs -= dtMs;
      if (s.lifeMs <= 0) { s.dead = true; continue; }
    }
    if (s.attackFlagMs > 0) s.attackFlagMs -= dtMs;
    if (p.deadMs > 0 && s.type !== 'sentry' && s.type !== 'hydra') { s.moving = false; continue; }
    switch (s.type) {
      case 'sentry': sentry(inst, s, p, dtMs); break;
      case 'hydra': hydra(inst, s, p, dtMs); break;
      case 'wolf': case 'bat': case 'raven': companion(inst, s, p, dtMs, dtS); break;
      case 'dust_devil': dustDevil(inst, s, p, dtMs, dtS); break;
    }
    let f = 0;
    if (s.faceLeft) f |= F_LEFT;
    if (s.moving) f |= F_MOVING;
    if (s.attackFlagMs > 0) f |= F_ATTACK;
    s.flags = f;
  }
  // Per owner: sentry chains and the wolf aura.
  for (const p of inst.players) {
    if (p.summons.length) ownerUpdate(inst, p, dtMs);
    else if (getBuff(p, 'pack_leader')) removeBuff(p, 'pack_leader');
  }
  let w = 0;
  for (let r = 0; r < list.length; r++) if (!list[r].dead) list[w++] = list[r];
  list.length = w;
}

function ownerUpdate(inst: Instance, p: Player, dtMs: number) {
  let w = 0;
  for (let r = 0; r < p.summons.length; r++) if (!p.summons[r].dead) p.summons[w++] = p.summons[r];
  p.summons.length = w;
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
}

function sentry(inst: Instance, s: Summon, p: Player, dtMs: number) {
  const rt = p.ctx.modsOf('sentry');
  const fast = rt.flags.has('fastSentry');
  s.fireMs -= dtMs;
  if (s.fireMs <= 0) {
    const tgt = pickTarget(inst, s.x, s.y, 560, true, p.save.skills.targetPriority);
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
      const tgt = pickTarget(inst, s.x, s.y, 600, false, p.save.skills.targetPriority);
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

function hydra(inst: Instance, s: Summon, p: Player, dtMs: number) {
  const rt = p.ctx.modsOf('hydra');
  const el = skillElement(rt);
  const base: Strike = { skill: 'hydra', coef: rt.def.coef, el, pct: skillPct(p, rt), src: s.id };
  s.fireMs -= dtMs;
  if (s.fireMs > 0) return;
  const tgt = pickTarget(inst, s.x, s.y, 500, true, p.save.skills.targetPriority);
  if (!tgt) { s.fireMs = 150; return; }
  faceTo(s, tgt.x);
  s.attackSeq++;
  s.attackFlagMs = 220;
  const a = Math.atan2(tgt.y - s.y, tgt.x - s.x);
  if (s.big) {
    // Mammoth Hydra: a river of fire that burns everything along its path.
    s.fireMs += 900;
    spawnProj(inst, {
      kind: 'river', v: 'fireball', sz: 2, owner: p, src: s.id, x: s.x, y: s.y - 30, angle: a, speed: 720, lifeMs: 700, r: 34, el,
      pierce: 1, hits: new Set(), strike: { ...base, coef: base.coef * 0.9 },
    });
    return;
  }
  // Three heads fire in turn: one shot every 0.3 s, each 30% of the per-second coefficient.
  s.fireMs += 300;
  s.aux = (s.aux + 1) % 3;
  const splash = rt.flags.has('splash');
  const frost = rt.flags.has('chill');
  spawnProj(inst, {
    kind: 'fireball', v: splash ? 'orb' : frost ? 'shard' : 'fireball', owner: p, src: s.id, x: s.x + (s.aux - 1) * 10, y: s.y - 28,
    angle: a, speed: 600, lifeMs: 950, r: 12, el, splash: splash ? 60 : frost ? 0 : 40, homing: tgt.id, turn: 2.5,
    strike: { ...base, coef: base.coef * 0.3 }, bits: frost ? PB_CHILL : 0,
  });
}

function companion(inst: Instance, s: Summon, p: Player, dtMs: number, dtS: number) {
  const speed = s.type === 'wolf' ? 360 : 390;
  // keep the current target while it is alive and near the owner
  let tgt = s.targetId ? inst.mob(s.targetId) ?? null : null;
  if (!tgt || tgt.dead || Math.hypot(tgt.x - p.x, tgt.y - p.y) > 480) {
    tgt = pickTarget(inst, p.x, p.y, 400, false, p.save.skills.targetPriority);
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

function dustDevil(inst: Instance, s: Summon, p: Player, dtMs: number, dtS: number) {
  s.wanderMs -= dtMs;
  if (s.wanderMs <= 0) {
    s.wanderMs = 600;
    const near = inst.queryMobs(s.x, s.y, 280);
    const alive = near.filter((m) => !m.dead);
    if (alive.length) {
      const m = alive[Math.floor(inst.rng.next() * alive.length)];
      s.tx = m.x + (inst.rng.next() - 0.5) * 60;
      s.ty = m.y + (inst.rng.next() - 0.5) * 60;
    } else {
      const a = inst.rng.next() * Math.PI * 2;
      s.tx = s.x + Math.cos(a) * 140;
      s.ty = s.y + Math.sin(a) * 140;
    }
  }
  moveSummon(inst, s, s.tx, s.ty, 250, dtS, 4);
  s.tickMs -= dtMs;
  if (s.tickMs > 0) return;
  s.tickMs += 250;
  const ww = p.ctx.modsOf('whirlwind');
  const pct = skillPct(p, ww) + p.ctx.power('ninefold_gale');
  const st: Strike = { skill: 'dust_devil', coef: 1.2 * 0.25, el: skillElement(ww), pct, mult: skillMult(p, 'dust_devil'), src: s.id };
  for (const m of inst.queryMobs(s.x, s.y, 45)) if (!m.dead) strikeMob(inst, p, m, st);
}
