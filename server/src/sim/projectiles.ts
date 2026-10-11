// Projectiles: player arrows / bolts / missiles / fireballs / rockets / lobbed cluster arrows, and monster
// projectiles (seeds, firebolts, sparks, guardian rings). Clients simulate them from `proj` until `pend`.

import { PLAYER_RADIUS, SKILLS, modVar, type Element } from '../shared';
import { damagePlayer, gainResource, strikeMob } from './damage';
import { chillMob, elIdx, freezeMob, inCone, markMob, shotBlocked, shotBlockedAt } from './effects';
import { nextId } from './ids';
import type { Instance } from './instance';
import type { ProjRule } from './powerRuntime';
import { clusterExplode } from './skills';
import {
  PB_BATTERY, PB_CHILL, PB_DEVOUR, PB_FREEZE, PB_MARK, PB_SPLIT,
  type Mob, type Player, type Proj, type ProjHook, type ProjKind, type Strike,
} from './types';

export interface ProjSpec {
  kind: ProjKind;
  v: string;
  owner?: Player | null;
  mob?: Mob | null;
  /** Entity id reported as the shooter. */
  src: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  lifeMs: number;
  r: number;
  el: Element;
  strike?: Strike | null;
  dmg?: number;
  mobLevel?: number;
  pierce?: number;
  hits?: Set<number> | null;
  homing?: number;
  turn?: number;
  seek?: boolean;
  splash?: number;
  bits?: number;
  tx?: number;
  ty?: number;
  sz?: number;
  /** A bounced projectile keeps its power rule, distance flown and remaining bounces. */
  inherit?: { rule: ProjRule; flown: number; bounces: number; returned?: boolean };
  /** Class-module behaviour (`Proj.hook`). */
  hook?: ProjHook;
  /** Keep `lifeMs` as given: no clamp to the skill's reach (slow orbs that fly longer than the targeting range). */
  keepLife?: boolean;
}

/** Merged power projectile rules for a strike id (canonical order: sums, first defined, any). */
function projRuleFor(p: Player, skill: string): ProjRule | null {
  let out: ProjRule | null = null;
  for (const { skills, rule } of p.ctx.powers.projRules) {
    if (skills && !skills.has(skill)) continue;
    if (!out) { out = { ...rule }; continue; }
    if (rule.distPct) { if (!out.distPct) out.distAt = rule.distAt; out.distPct += rule.distPct; }
    out.bounces += rule.bounces;
    if (out.bounceScale === 1) out.bounceScale = rule.bounceScale;
    out.retarget ||= rule.retarget;
    out.seekMarked ??= rule.seekMarked;
    out.returns ||= rule.returns;
    out.rangeRicochet ||= rule.rangeRicochet;
  }
  return out;
}

/** Destroy hostile projectiles inside a cone (deflection). Returns how many. */
export function clearHostileProjectiles(inst: Instance, x: number, y: number, ang: number, half: number, range: number): number {
  let n = 0;
  for (const pr of inst.projs) {
    if (pr.dead || !isHostile(pr.kind) || !inCone(pr.x, pr.y, pr.r, x, y, ang, half, range)) continue;
    endProj(inst, pr, false);
    n++;
  }
  return n;
}

/** Reflect off the wall between (fx, fy) and (fx + sx, fy + sy): end this projectile and fire its continuation. */
function bounceProj(inst: Instance, pr: Proj, fx: number, fy: number, sx: number, sy: number) {
  const bx = shotBlockedAt(inst, fx + sx, fy), by = shotBlockedAt(inst, fx, fy + sy);
  let vx = pr.vx, vy = pr.vy;
  if (bx === by) { vx = -vx; vy = -vy; } else if (bx) vx = -vx; else vy = -vy;
  pr.x = fx; pr.y = fy;
  endProj(inst, pr, false, false, true);
  const rule = pr.rule!, st = pr.strike;
  spawnProj(inst, {
    kind: pr.kind, v: pr.v, owner: pr.owner, mob: pr.mob, src: pr.owner?.id ?? pr.mob?.id ?? 0, x: fx, y: fy, angle: Math.atan2(vy, vx),
    speed: pr.speed, lifeMs: Math.max(1, pr.lifeMs), r: pr.r, el: pr.el, strike: st && rule.bounceScale !== 1 ? { ...st, coef: st.coef * rule.bounceScale } : st,
    dmg: pr.dmg, mobLevel: pr.mobLevel, pierce: pr.pierce, hits: pr.hits, bits: pr.bits, splash: pr.splash, seek: pr.seek, turn: pr.turn,
    inherit: { rule, flown: pr.flown ?? 0, bounces: (pr.bounces ?? 0) - 1, returned: pr.returned }, hook: pr.hook, keepLife: true,
  });
}

/** Returning projectile: from where it stopped back to its owner once, piercing, able to hit enemies again. */
function returnProj(inst: Instance, pr: Proj) {
  const p = pr.owner!, dx = p.x - pr.x, dy = p.y - pr.y, d = Math.hypot(dx, dy);
  if (d < 20 || pr.speed <= 0) return;
  const here = new Set(inst.queryMobs(pr.x, pr.y, pr.r + 30).map((m) => m.id)); // not the enemy it just hit again at once
  spawnProj(inst, {
    kind: pr.kind, v: pr.v, owner: p, src: p.id, x: pr.x, y: pr.y, angle: Math.atan2(dy, dx), speed: pr.speed,
    lifeMs: Math.min(3000, d / pr.speed * 1000 + 50), r: pr.r, el: pr.el, strike: pr.strike, pierce: 1, hits: here, bits: pr.bits, splash: pr.splash,
    inherit: { rule: pr.rule!, flown: pr.flown ?? 0, bounces: 0, returned: true }, hook: pr.hook,
  });
}

/** Ricochet at maximum range toward the nearest enemy it has not hit (range rule; spends a bounce). False if none. */
function rangeRicochet(inst: Instance, pr: Proj): boolean {
  const t = inst.mobHash.nearest(pr.x, pr.y, 360, (o) => !o.dead && !(pr.hits && pr.hits.has(o.id))); // [M] the retarget radius
  if (!t) return false;
  endProj(inst, pr, false, false, true);
  const rule = pr.rule!, st = pr.strike;
  spawnProj(inst, {
    kind: pr.kind, v: pr.v, owner: pr.owner, src: pr.owner?.id ?? 0, x: pr.x, y: pr.y, angle: Math.atan2(t.y - pr.y, t.x - pr.x),
    speed: pr.speed, lifeMs: pr.life0 ?? 600, r: pr.r, el: pr.el, strike: st && rule.bounceScale !== 1 ? { ...st, coef: st.coef * rule.bounceScale } : st,
    pierce: pr.pierce, hits: pr.hits, bits: pr.bits, splash: pr.splash, seek: pr.seek, turn: pr.turn,
    inherit: { rule, flown: pr.flown ?? 0, bounces: (pr.bounces ?? 0) - 1, returned: pr.returned }, hook: pr.hook,
  });
  return true;
}

/** Strike scaled by distance flown (power projectile rule). */
export function flownStrike(pr: Proj): Strike {
  const st = pr.strike!, r = pr.rule!;
  return { ...st, mult: (st.mult ?? 1) * (1 + r.distPct / 100 * Math.min(1, (pr.flown ?? 0) / r.distAt)) };
}

export function spawnProj(inst: Instance, s: ProjSpec): Proj {
  const rule = s.inherit ? s.inherit.rule : s.owner && s.strike && s.owner.ctx.powers.projRules.length ? projRuleFor(s.owner, s.strike.skill) : null;
  if (rule && !s.inherit) {
    if (rule.retarget && !s.seek) s = { ...s, seek: true };
    if (rule.seekMarked && !s.homing) {
      const t = inst.mobHash.nearest(s.x, s.y, rule.seekMarked.range, (o) => !o.dead && o.markMs > 0);
      if (t) s = { ...s, homing: t.id, turn: rule.seekMarked.turn }; // callers may reuse a spec for a volley
    }
  }
  // Target acquisition and visible projectile travel share the current skill reach.
  const reach=s.owner&&s.strike&&!s.keepLife?SKILLS[s.strike.skill]?.range??0:0;
  const lifeMs=reach>0&&s.speed>0&&s.kind!=='cluster'
    ?Math.min(s.lifeMs,(reach+PLAYER_RADIUS*2)/s.speed*1000):s.lifeMs;
  const vx = Math.cos(s.angle) * s.speed, vy = Math.sin(s.angle) * s.speed;
  const pr: Proj = {
    id: nextId(), kind: s.kind, v: s.v, owner: s.owner ?? null, mob: s.mob ?? null,
    x: s.x, y: s.y, vx, vy, speed: s.speed, lifeMs, r: s.r, el: s.el,
    strike: s.strike ?? null, dmg: s.dmg ?? 0, mobLevel: s.mobLevel ?? 1,
    pierce: s.pierce ?? 0, hits: s.hits ?? null, homing: s.homing ?? 0, turn: s.turn ?? 0, seek: !!s.seek,
    splash: s.splash ?? 0, pierced: 0, bits: s.bits ?? 0, tx: s.tx ?? 0, ty: s.ty ?? 0, dead: false, rule: undefined, flown: 0, bounces: 0,
    returned: false, life0: lifeMs, hook: s.hook,
  };
  if (rule) { pr.rule = rule; pr.flown = s.inherit?.flown ?? 0; pr.bounces = s.inherit?.bounces ?? rule.bounces; pr.returned = !!s.inherit?.returned; }
  inst.projs.push(pr);
  const ev: { e: 'proj'; id: number; s: number; v: string; x: number; y: number; vx: number; vy: number; life: number; el: number; h?: number; sz?: number } = {
    e: 'proj', id: pr.id, s: s.src, v: s.v, x: Math.round(s.x), y: Math.round(s.y), vx: Math.round(vx), vy: Math.round(vy),
    life: Math.round(lifeMs), el: elIdx(s.el),
  };
  if (pr.homing) ev.h = pr.homing;
  if (s.sz) ev.sz = s.sz;
  inst.emit(ev, s.x, s.y, pr.owner?.id ?? 0);
  return pr;
}

/**
 * End a projectile. `quiet`: it simply ran out of life, which clients already know from `life`. `continued`: a bounce /
 * ricochet replaces it (its hook carries over and does not end).
 */
function endProj(inst: Instance, pr: Proj, hit: boolean, quiet = false, continued = false, why: 'hit' | 'life' | 'wall' = hit ? 'hit' : 'life') {
  if (pr.dead) return;
  pr.dead = true;
  if (pr.hook?.end && !continued) pr.hook.end(inst, pr, why);
  if (quiet) return;
  const ev: { e: 'pend'; id: number; x: number; y: number; hit?: 1 } = { e: 'pend', id: pr.id, x: Math.round(pr.x), y: Math.round(pr.y) };
  if (hit) ev.hit = 1;
  inst.emit(ev, pr.x, pr.y, pr.owner?.id ?? 0);
  if (hit && pr.rule?.returns && !pr.returned && pr.owner && !isLob(pr.kind)) returnProj(inst, pr);
}

/** End a projectile from a class hook (`Proj.hook.hit`): `hit` = it struck something. */
export function endProjectile(inst: Instance, pr: Proj, hit: boolean) { endProj(inst, pr, hit); }

const isLob = (k: ProjKind) => k === 'cluster';
const isHostile = (k: ProjKind) => k === 'mob' || k === 'spark' || k === 'ring';

function steer(pr: Proj, tx: number, ty: number, dtS: number) {
  const cur = Math.atan2(pr.vy, pr.vx);
  const want = Math.atan2(ty - pr.y, tx - pr.x);
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const maxTurn = pr.turn * dtS;
  const a = cur + Math.max(-maxTurn, Math.min(maxTurn, d));
  pr.vx = Math.cos(a) * pr.speed;
  pr.vy = Math.sin(a) * pr.speed;
}

/** Nearest monster to the projectile not yet hit by it. */
function retarget(inst: Instance, pr: Proj, range: number): number {
  const m = inst.mobHash.nearest(pr.x, pr.y, range, (o) => !o.dead && !(pr.hits && pr.hits.has(o.id)));
  return m ? m.id : 0;
}

export function updateProjectiles(inst: Instance, dtMs: number) {
  const list = inst.projs;
  const dtS = dtMs / 1000;
  for (let i = 0; i < list.length; i++) {
    const pr = list[i];
    if (pr.dead) continue;
    // Homing / seeking
    if (pr.homing && pr.turn > 0) {
      const t = inst.mob(pr.homing);
      if (t && !t.dead) steer(pr, t.x, t.y, dtS);
      else if (pr.seek) pr.homing = retarget(inst, pr, 360);
      else pr.homing = 0;
    }
    const step = Math.min(dtMs, pr.lifeMs);
    pr.lifeMs -= dtMs;
    const dist = pr.speed * (step / 1000);
    const n = Math.max(1, Math.ceil(dist / 22));
    const sx = (pr.vx * (step / 1000)) / n, sy = (pr.vy * (step / 1000)) / n;
    for (let k = 0; k < n && !pr.dead; k++) {
      const fromX=pr.x,fromY=pr.y;
      pr.x += sx; pr.y += sy;
      if (isLob(pr.kind)) continue;
      if (pr.rule?.distPct) pr.flown! += Math.hypot(sx, sy);
      if (shotBlocked(inst, fromX, fromY, pr.x, pr.y)) {
        if (pr.bounces && pr.bounces > 0) bounceProj(inst, pr, fromX, fromY, sx, sy); else endProj(inst, pr, false, false, false, 'wall');
        break;
      }
      if (isHostile(pr.kind)) hostileCollide(inst, pr);
      else friendlyCollide(inst, pr);
    }
    if (pr.hook?.tick && !pr.dead) pr.hook.tick(inst, pr, dtMs);
    if (!pr.dead && pr.lifeMs <= 0) {
      if (pr.kind === 'cluster') {
        pr.x = pr.tx; pr.y = pr.ty;
        endProj(inst, pr, true);
        clusterExplode(inst, pr);
      } else if (!(pr.rule?.rangeRicochet && pr.bounces && pr.bounces > 0 && rangeRicochet(inst, pr))) endProj(inst, pr, false, pr.homing === 0 && pr.turn === 0);
    }
  }
  let w = 0;
  for (let r = 0; r < list.length; r++) if (!list[r].dead) list[w++] = list[r];
  list.length = w;
}

function hostileCollide(inst: Instance, pr: Proj) {
  for (const p of inst.players) {
    if (p.deadMs > 0) continue;
    const dx = p.x - pr.x, dy = p.y - pr.y, rr = pr.r + PLAYER_RADIUS;
    if (dx * dx + dy * dy > rr * rr) continue;
    if (p.invulnMs > 0) continue; // dashing through projectiles
    damagePlayer(inst, p, pr.dmg, pr.el, pr.mob && !pr.mob.dead ? pr.mob : null, pr.mobLevel);
    endProj(inst, pr, true);
    return;
  }
}

const near: Mob[] = [];
function friendlyCollide(inst: Instance, pr: Proj) {
  const owner = pr.owner;
  if (!owner || !pr.strike) { endProj(inst, pr, false); return; }
  near.length = 0;
  inst.mobHash.query(pr.x, pr.y, pr.r, near);
  if (!near.length) return;
  // closest first so piercing order is stable
  if (near.length > 1) near.sort((a, b) => (a.x - pr.x) ** 2 + (a.y - pr.y) ** 2 - ((b.x - pr.x) ** 2 + (b.y - pr.y) ** 2));
  // onHit can re-enter collision code only through new projectiles, never this loop: copy to be safe anyway.
  const list = near.length === 1 ? [near[0]] : near.slice();
  for (const m of list) {
    if (pr.dead) return;
    if (m.dead || (pr.hits && pr.hits.has(m.id))) continue;
    onHit(inst, pr, owner, m);
  }
}

function onHit(inst: Instance, pr: Proj, p: Player, m: Mob) {
  if (pr.hook?.hit) { pr.hook.hit(inst, pr, p, m); return; }
  const st = pr.rule?.distPct ? flownStrike(pr) : pr.strike!;
  switch (pr.kind) {
    case 'arrow': {
      const s = pr.bits & PB_DEVOUR && pr.pierced > 0 ? { ...st, mult: (st.mult ?? 1) * (1 + 0.7 * pr.pierced) } : st;
      strikeMob(inst, p, m, s);
      if (pr.bits & PB_MARK) markMob(m, 3000, modVar(p.ctx.modsOf('hungering_arrow').mods, 'markPct'), inst, p); // Hunter's Mark
      const pierce = pr.pierce >= 1 || inst.rng.next() < pr.pierce;
      if (!pierce) { endProj(inst, pr, true); return; }
      pr.pierced++;
      if (!pr.hits) pr.hits = new Set();
      pr.hits.add(m.id);
      if (pr.bits & PB_SPLIT) {
        const a = Math.atan2(pr.vy, pr.vx);
        for (const off of [-0.45, 0, 0.45]) {
          spawnProj(inst, {
            kind: 'shard', v: 'shard', owner: p, src: p.id, x: m.x, y: m.y, angle: a + off, speed: 760, lifeMs: 420, r: 9, el: st.el,
            strike: { ...st, coef: st.coef * 0.5, primary: false }, hits: new Set([m.id]),
          });
        }
      }
      pr.homing = retarget(inst, pr, 360);
      return;
    }
    case 'multi':
    case 'river':
      if (!pr.hits) pr.hits = new Set();
      pr.hits.add(m.id);
      strikeMob(inst, p, m, st);
      return;
    case 'missile':
      strikeMob(inst, p, m, st);
      if (pr.bits & PB_FREEZE && !m.dead && inst.rng.next() < 0.15) freezeMob(m, 1000, 0, 0, inst, p);
      if (pr.bits & PB_BATTERY) gainResource(p, p.ctx.primary.mods.gen ?? 0);
      endProj(inst, pr, true);
      return;
    case 'bolt':
      strikeMob(inst, p, m, st);
      if (pr.bits & PB_CHILL && !m.dead) chillMob(m, 2000, inst, p);
      endProj(inst, pr, true);
      return;
    case 'fireball': {
      strikeMob(inst, p, m, st);
      if (pr.bits & PB_CHILL && !m.dead) chillMob(m, 2000, inst, p);
      if (pr.splash > 0) {
        for (const o of inst.queryMobs(m.x, m.y, pr.splash)) {
          if (o === m || o.dead) continue;
          strikeMob(inst, p, o, { ...st, noArea: true });
          if (pr.bits & PB_CHILL && !o.dead) chillMob(o, 2000, inst, p);
        }
      }
      endProj(inst, pr, true);
      return;
    }
    case 'rocket':
    case 'shard':
    default:
      strikeMob(inst, p, m, st);
      endProj(inst, pr, true);
  }
}
