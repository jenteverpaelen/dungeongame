// Projectiles: player arrows / bolts / missiles / fireballs / rockets / lobbed cluster arrows, and monster
// projectiles (seeds, firebolts, sparks, guardian rings). Clients simulate them from `proj` until `pend`.

import { PLAYER_RADIUS, SKILLS, type Element } from '../shared';
import { damagePlayer, gainResource, strikeMob } from './damage';
import { chillMob, elIdx, freezeMob, shotBlocked } from './effects';
import { nextId } from './ids';
import type { Instance } from './instance';
import { clusterExplode } from './skills';
import {
  PB_BATTERY, PB_CHILL, PB_DEVOUR, PB_FREEZE, PB_MARK, PB_SPLIT,
  type Mob, type Player, type Proj, type ProjKind, type Strike,
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
}

export function spawnProj(inst: Instance, s: ProjSpec): Proj {
  // Target acquisition and visible projectile travel share the current skill reach.
  const reach=s.owner&&s.strike?SKILLS[s.strike.skill]?.range??0:0;
  const lifeMs=reach>0&&s.speed>0&&s.kind!=='cluster'
    ?Math.min(s.lifeMs,(reach+PLAYER_RADIUS*2)/s.speed*1000):s.lifeMs;
  const vx = Math.cos(s.angle) * s.speed, vy = Math.sin(s.angle) * s.speed;
  const pr: Proj = {
    id: nextId(), kind: s.kind, v: s.v, owner: s.owner ?? null, mob: s.mob ?? null,
    x: s.x, y: s.y, vx, vy, speed: s.speed, lifeMs, r: s.r, el: s.el,
    strike: s.strike ?? null, dmg: s.dmg ?? 0, mobLevel: s.mobLevel ?? 1,
    pierce: s.pierce ?? 0, hits: s.hits ?? null, homing: s.homing ?? 0, turn: s.turn ?? 0, seek: !!s.seek,
    splash: s.splash ?? 0, pierced: 0, bits: s.bits ?? 0, tx: s.tx ?? 0, ty: s.ty ?? 0, dead: false,
  };
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

/** End a projectile. `quiet`: it simply ran out of life, which clients already know from `life`. */
function endProj(inst: Instance, pr: Proj, hit: boolean, quiet = false) {
  if (pr.dead) return;
  pr.dead = true;
  if (quiet) return;
  const ev: { e: 'pend'; id: number; x: number; y: number; hit?: 1 } = { e: 'pend', id: pr.id, x: Math.round(pr.x), y: Math.round(pr.y) };
  if (hit) ev.hit = 1;
  inst.emit(ev, pr.x, pr.y, pr.owner?.id ?? 0);
}

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
      if (shotBlocked(inst, fromX, fromY, pr.x, pr.y)) { endProj(inst, pr, false); break; }
      if (isHostile(pr.kind)) hostileCollide(inst, pr);
      else friendlyCollide(inst, pr);
    }
    if (!pr.dead && pr.lifeMs <= 0) {
      if (pr.kind === 'cluster') {
        pr.x = pr.tx; pr.y = pr.ty;
        endProj(inst, pr, true);
        clusterExplode(inst, pr);
      } else endProj(inst, pr, false, pr.homing === 0 && pr.turn === 0);
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
  const st = pr.strike!;
  switch (pr.kind) {
    case 'arrow': {
      const s = pr.bits & PB_DEVOUR && pr.pierced > 0 ? { ...st, mult: (st.mult ?? 1) * (1 + 0.7 * pr.pierced) } : st;
      strikeMob(inst, p, m, s);
      if (pr.bits & PB_MARK) { m.markMs = 3000; m.markPct = p.ctx.power('hunters_mark'); }
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
      if (pr.bits & PB_FREEZE && !m.dead && inst.rng.next() < 0.15) freezeMob(m, 1000);
      if (pr.bits & PB_BATTERY) gainResource(p, p.ctx.primary.mods.gen ?? 0);
      endProj(inst, pr, true);
      return;
    case 'bolt':
      strikeMob(inst, p, m, st);
      if (pr.bits & PB_CHILL && !m.dead) chillMob(m, 2000);
      endProj(inst, pr, true);
      return;
    case 'fireball': {
      strikeMob(inst, p, m, st);
      if (pr.bits & PB_CHILL && !m.dead) chillMob(m, 2000);
      if (pr.splash > 0) {
        for (const o of inst.queryMobs(m.x, m.y, pr.splash)) {
          if (o === m || o.dead) continue;
          strikeMob(inst, p, o, { ...st, noArea: true });
          if (pr.bits & PB_CHILL && !o.dead) chillMob(o, 2000);
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
