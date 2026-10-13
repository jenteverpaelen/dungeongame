// Summons: generic spawn / movement / lifetime. Per-type AI (Sentry, Hydra, Companions, Dust Devils, ...) lives in
// the per-class skill modules (server/src/sim/skills/<class>.ts) and is looked up by summon type.

import { F_ATTACK, F_LEFT, F_MOVING } from '../shared';
import { shotBlockedAt } from './effects';
import { nextId } from './ids';
import type { Instance } from './instance';
import { ownerSummonHooks, summonBehaviour } from './skills';
import type { Player, Summon, SummonType } from './types';

export function spawnSummon(inst: Instance, p: Player, type: SummonType, skill: string, x: number, y: number, lifeMs: number, big = false): Summon {
  const s: Summon = {
    kind: 'summon', id: nextId(), type, owner: p, skill, flags: 0, attackSeq: 0,
    x, y, r: big ? 36 : summonBehaviour(type)?.radius ?? 16, hCell: -1, hIdx: -1,
    lifeMs, fireMs: type === 'sentry' ? 250 : 400, rocketMs: 900, chainMs: 500, tickMs: 0, wanderMs: 0,
    targetId: 0, tx: x, ty: y, aux: 0, attackFlagMs: 0, faceLeft: p.faceLeft, moving: false, dead: false, descVer: 1, big,
  };
  inst.addSummon(s);
  p.summons.push(s);
  return s;
}

function faceTo(s: Summon, x: number) {
  if (Math.abs(x - s.x) > 2) s.faceLeft = x < s.x;
}

/** Walk (collision-aware) or fly (blocked only by shot-blocking walls) towards (tx, ty), stopping at `stopAt`. A flier
 *  slides along a wall or cover. A companion that has not closed in for 1.2 s (behind a fence or a building, in a corner)
 *  appears at a free spot beside where it was heading, as ARPG pets warp back into play [K]. Before 2026-10-13 fliers
 *  stopped for good and walkers pressed against the obstacle, so companions looked motionless (OWNER-LIST batch 8). */
export function moveSummon(inst: Instance, s: Summon, tx: number, ty: number, speed: number, dtS: number, stopAt: number) {
  const dx = tx - s.x, dy = ty - s.y;
  const d = Math.hypot(dx, dy);
  if (d <= stopAt) { s.moving = false; s.stuckMs = 0; return; }
  const st = Math.min(d - stopAt, speed * dtS);
  const fly = !!summonBehaviour(s.type)?.flies;
  let q: { x: number; y: number } | undefined = fly ? { x: s.x + (dx / d) * st, y: s.y + (dy / d) * st } : inst.cw.moveCircle(s.x, s.y, 10, (dx / d) * st, (dy / d) * st, true);
  if (fly && shotBlockedAt(inst, q.x, q.y)) {
    const ax = { x: s.x + Math.sign(dx) * st, y: s.y }, ay = { x: s.x, y: s.y + Math.sign(dy) * st };
    const order = Math.abs(dx) >= Math.abs(dy) ? [ax, ay] : [ay, ax];
    q = order.find((o) => (o === ax ? Math.abs(dx) : Math.abs(dy)) > 1 && !shotBlockedAt(inst, o.x, o.y));
  }
  const closed = q ? d - Math.hypot(tx - q.x, ty - q.y) : 0;
  if (s.skill === 'companion' && closed < st * 0.25) {
    s.stuckMs = (s.stuckMs ?? 0) + dtS * 1000;
    if (s.stuckMs >= 1200) {
      s.stuckMs = 0;
      const spot = freeSpotNear(inst, tx, ty, Math.max(16, stopAt * 0.8), fly, s);
      if (spot) { s.x = spot.x; s.y = spot.y; s.moving = false; faceTo(s, tx); return; }
    }
  } else s.stuckMs = 0;
  if (!q) { s.moving = false; return; }
  s.x = q.x; s.y = q.y;
  s.moving = true;
  faceTo(s, tx);
}

/** The free point on a ring round (x, y) nearest to the summon (fliers: not inside a wall or cover; walkers: standable). */
function freeSpotNear(inst: Instance, x: number, y: number, r: number, fly: boolean, s: Summon): { x: number; y: number } | undefined {
  let best: { x: number; y: number } | undefined, bd = Infinity;
  for (let i = 0; i < 12; i++) {
    const px = x + Math.cos(i * Math.PI / 6) * r, py = y + Math.sin(i * Math.PI / 6) * r;
    if (fly ? shotBlockedAt(inst, px, py) : !inst.cw.isFree(px, py, 10)) continue;
    const dd = Math.hypot(px - s.x, py - s.y);
    if (dd < bd) { bd = dd; best = { x: px, y: py }; }
  }
  return best;
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
    const kind = summonBehaviour(s.type);
    if (p.deadMs > 0 && !kind?.actsWhileOwnerDead) { s.moving = false; continue; }
    kind?.update(inst, s, p, dtMs, dtS);
    let f = 0;
    if (s.faceLeft) f |= F_LEFT;
    if (s.moving) f |= F_MOVING;
    if (s.attackFlagMs > 0) f |= F_ATTACK;
    s.flags = f;
  }
  // Per owner: auras and links between summons (Pack Leader, Chain of Torment, ...).
  for (const p of inst.players) {
    if (p.summons.length) {
      let w = 0;
      for (let r = 0; r < p.summons.length; r++) if (!p.summons[r].dead) p.summons[w++] = p.summons[r];
      p.summons.length = w;
      for (const h of ownerSummonHooks()) h.withSummons?.(inst, p, dtMs);
    } else for (const h of ownerSummonHooks()) h.withoutSummons?.(inst, p);
  }
  let w = 0;
  for (let r = 0; r < list.length; r++) if (!list[r].dead) list[w++] = list[r];
  list.length = w;
}
