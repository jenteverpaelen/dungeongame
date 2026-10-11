// Geometry helpers, crowd control on monsters/players, DoT bookkeeping and player buffs.

import { ELEMENT_INDEX, F_BLEED, F_BURN, F_CHILL, F_FROZEN, F_POISON, F_STUN, T_VOID, T_WALL, TILE, angleDiff, type Element } from '../shared';
import type { Instance } from './instance';
import type { Buff, Dot, DotKind, Mob, Player } from './types';
import { adventureCover } from '../../../shared/src/adventureCover';
import type { StatusKind } from '../../../shared/src/powers';
import { onStatusApplied } from './status';

export const elIdx = (el: Element): number => {
  const i = ELEMENT_INDEX.indexOf(el);
  return i < 0 ? 0 : i;
};

// ─────────────────────────── Geometry ───────────────────────────

/** Is a body at (mx, my) with radius mr inside a cone from (ox, oy) facing `ang` (half-angle `half`, length `len`)? */
export function inCone(mx: number, my: number, mr: number, ox: number, oy: number, ang: number, half: number, len: number): boolean {
  const dx = mx - ox, dy = my - oy;
  const d2 = dx * dx + dy * dy;
  const reach = len + mr;
  if (d2 > reach * reach) return false;
  if (d2 < (mr + 20) * (mr + 20)) return true; // standing on top of the origin
  const d = Math.sqrt(d2);
  const slack = Math.asin(Math.min(1, mr / d));
  return Math.abs(angleDiff(ang, Math.atan2(dy, dx))) <= half + slack;
}

/** Distance from point to segment. */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax, aby = by - ay;
  const l2 = abx * abx + aby * aby;
  let t = l2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + abx * t, cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

/** Projectiles and sight pass over water / lava pools; only walls (and the void) stop them. */
export function shotBlockedAt(inst: Instance, x: number, y: number): boolean {
  const t = inst.cw.tileAt(x, y);
  return t === T_WALL || t === T_VOID || !!inst.map.adventure&&adventureCover(inst.map.adventure,x,y,x,y);
}

/** Line of fire between two points (samples every half tile). */
export function shotBlocked(inst: Instance, x0: number, y0: number, x1: number, y1: number): boolean {
  if(inst.map.adventure&&adventureCover(inst.map.adventure,x0,y0,x1,y1))return true;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(len / (TILE / 2));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const tile=inst.cw.tileAt(x0+(x1-x0)*t,y0+(y1-y0)*t);
    if (tile===T_WALL||tile===T_VOID) return true;
  }
  return false;
}

// ─────────────────────────── Monster crowd control ───────────────────────────

/** Bosses, goblins and dummies ignore crowd control; elites suffer half durations (D3-ish CC resistance). */
export function ccFactor(m: Mob): number {
  if (m.dummy || m.tier === 4 || m.tier === 5) return 0;
  if (m.tier === 1 || m.tier === 2) return 0.5;
  return 1;
}

/**
 * A status landed on a monster. Control (stun / freeze / knockback / pull) restarts its "controlled within" clock; with
 * the applying player known (`inst`, `by`), applyStatus procs and first-hit resets run when that player's powers watch.
 */
function landed(m: Mob, kind: StatusKind, control: boolean, inst: Instance | undefined, by: Player | undefined) {
  if (control) m.ctrlAgo = 0;
  if (inst && by && by.ctx.powers.statusWatch) onStatusApplied(inst, by, m, kind);
}

export function stunMob(m: Mob, ms: number, inst?: Instance, by?: Player) {
  const f = ccFactor(m);
  if (f <= 0) return;
  m.stunMs = Math.max(m.stunMs, ms * f);
  cancelWindup(m);
  landed(m, 'stun', true, inst, by);
}

export function freezeMob(m: Mob, ms: number, shatterBy = 0, depth = 0, inst?: Instance, by?: Player) {
  const f = ccFactor(m);
  if (f <= 0) return;
  m.freezeMs = Math.max(m.freezeMs, ms * f);
  if (shatterBy) { m.shatterBy = shatterBy; m.shatterDepth = depth; }
  cancelWindup(m);
  landed(m, 'freeze', true, inst, by);
}

export function chillMob(m: Mob, ms: number, inst?: Instance, by?: Player) {
  if (m.dummy || m.tier === 4 || m.tier === 5) return;
  m.chillMs = Math.max(m.chillMs, ms);
  landed(m, 'chill', false, inst, by);
}

export function cancelWindup(m: Mob) {
  if (m.state === 'windup' || m.state === 'charge') { m.charge = undefined; m.state = 'chase'; m.stateMs = 0; m.atkCdMs = Math.max(m.atkCdMs, 400); }
}

/** Shove a monster `dist` units along (dx, dy) over 0.25 s. */
export function knockbackMob(m: Mob, dx: number, dy: number, dist: number, inst?: Instance, by?: Player) {
  const f = ccFactor(m);
  if (f <= 0) return;
  if (m.def.attack.kind === 'charge') cancelWindup(m);
  const l = Math.hypot(dx, dy) || 1;
  const d = dist * f;
  m.kbX = (dx / l) * (d / 0.25);
  m.kbY = (dy / l) * (d / 0.25);
  m.kbMs = 250;
  landed(m, 'knockback', true, inst, by);
}

/** Move a monster towards (tx, ty) by up to `step` units with wall sliding (pull effects). */
export function dragMob(inst: Instance, m: Mob, tx: number, ty: number, step: number, by?: Player) {
  if (m.dummy || m.tier === 4) return;
  const dx = tx - m.x, dy = ty - m.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  if (m.def.attack.kind === 'charge') cancelWindup(m);
  const s = Math.min(step, d);
  const p = inst.cw.moveCircle(m.x, m.y, m.r, (dx / d) * s, (dy / d) * s, !!m.def.flying);
  m.x = p.x; m.y = p.y;
  inst.mobHash.update(m);
  landed(m, 'pull', true, inst, by);
}

/** Damage an expiring / replaced dot still had to deal. */
const remainingDamage = (d: Dot) => d.perTick * Math.max(0, Math.ceil(d.leftMs / d.tickMs));

/**
 * Add a damage-over-time effect. Default: one dot per (kind, owner, skill), refreshed in place (keeps the stronger
 * tick). `stacks` > 1 keeps up to that many separate instances per (kind, owner, skill) and replaces the one closest
 * to expiring; `carryPct` moves that share of the replaced instance's remaining damage into the new one (dot rules,
 * engine wave 2). The 8-dot limit per monster stays.
 */
export function addDot(m: Mob, dot: Dot, stacks = 1, carryPct = 0) {
  if (stacks <= 1) {
    for (let i = 0; i < m.dots.length; i++) {
      const d = m.dots[i];
      if (d.kind === dot.kind && d.owner === dot.owner && d.skill === dot.skill) {
        if (carryPct > 0) dot.perTick += remainingDamage(d) * carryPct / 100 / Math.max(1, Math.round(dot.leftMs / dot.tickMs));
        else if (dot.perTick < d.perTick && d.leftMs > dot.leftMs * 0.5) { d.leftMs = Math.max(d.leftMs, dot.leftMs); return; }
        dot.nextMs = Math.min(dot.nextMs, d.nextMs);
        m.dots[i] = dot;
        return;
      }
    }
    if (m.dots.length < 8) m.dots.push(dot);
    return;
  }
  let same = 0, oldest = -1;
  for (let i = 0; i < m.dots.length; i++) {
    const d = m.dots[i];
    if (d.kind !== dot.kind || d.owner !== dot.owner || d.skill !== dot.skill) continue;
    same++;
    if (oldest < 0 || d.leftMs < m.dots[oldest].leftMs) oldest = i;
  }
  if (same < stacks && m.dots.length < 8) { m.dots.push(dot); return; }
  if (oldest < 0) return;
  if (carryPct > 0) dot.perTick += remainingDamage(m.dots[oldest]) * carryPct / 100 / Math.max(1, Math.round(dot.leftMs / dot.tickMs));
  m.dots[oldest] = dot;
}

/** A player's dot: their dot rules (stacking, strength, carry-over) apply; without rules this is addDot. */
export function addOwnedDot(p: Player, m: Mob, dot: Dot) {
  const rules = p.ctx.powers.dotRules;
  if (!rules.length) { addDot(m, dot); return; }
  let stacks = 1, strength = 1, carry = 0;
  for (const r of rules) {
    if (r.kind !== dot.kind || (r.skills && !r.skills.has(dot.skill))) continue;
    stacks = Math.max(stacks, r.stacks); strength *= r.strength; carry = Math.min(100, carry + r.carry);
  }
  if (strength !== 1) dot.perTick *= strength;
  addDot(m, dot, stacks, carry);
}

export function hasDot(m: Mob, kind: DotKind, owner = 0): boolean {
  for (const d of m.dots) if (d.kind === kind && (owner === 0 || d.owner === owner)) return true;
  return false;
}

/** Status flag bits visible to clients. */
export function mobStatusFlags(m: Mob): number {
  let f = 0;
  if (m.stunMs > 0) f |= F_STUN;
  if (m.freezeMs > 0) f |= F_FROZEN;
  if (m.chillMs > 0) f |= F_CHILL;
  for (let i = 0; i < m.dots.length; i++) {
    const k = m.dots[i].kind;
    if (k === 'bleed') f |= F_BLEED;
    else if (k === 'burn') f |= F_BURN;
    else f |= F_POISON;
  }
  return f;
}

// ─────────────────────────── Buffs ───────────────────────────

export function addBuff(p: Player, buff: Buff) {
  const cur = getBuff(p, buff.id);
  if (cur) Object.assign(cur, buff);
  else p.buffs.push(buff);
  refreshLive(p);
}

export function getBuff(p: Player, id: string): Buff | undefined {
  const b = p.buffs;
  for (let i = 0; i < b.length; i++) if (b[i].id === id) return b[i];
  return undefined;
}

export function removeBuff(p: Player, id: string) {
  const i = p.buffs.findIndex((b) => b.id === id);
  if (i >= 0) { p.buffs.splice(i, 1); refreshLive(p); }
}

export function refreshLive(p: Player) {
  const l = p.live;
  l.dmg = 0; l.chc = 0; l.chd = 0; l.ias = 0;
  let dr = 1, cci = false, cost = 1;
  for (const b of p.buffs) {
    l.dmg += b.dmg ?? 0;
    l.chc += b.chc ?? 0;
    l.chd += b.chd ?? 0;
    l.ias += (b.ias ?? 0) * (b.st ?? 1);
    if (b.sdmg) l.dmg += b.sdmg * (b.st ?? 1);
    if (b.dr) dr *= 1 - Math.min(100, b.dr) / 100;
    if (b.cci) cci = true;
    if (b.cost) cost *= Math.max(0, 1 + b.cost / 100);
  }
  l.dr = dr; l.cci = cci; l.cost = cost;
}

/** Advance buff timers; returns true if any expired. */
export function tickBuffs(p: Player, dtMs: number) {
  let changed = false;
  for (let i = p.buffs.length - 1; i >= 0; i--) {
    const b = p.buffs[i];
    if (b.ms === Infinity) continue;
    b.ms -= dtMs;
    if (b.ms <= 0) { p.buffs.splice(i, 1); changed = true; }
  }
  if (changed) refreshLive(p);
}

// ─────────────────────────── Hostile effects on players ───────────────────────────

/** Control immunity from power buffs (`ccImmune`) or an active controlImmunity template. */
const ctrlImmune = (p: Player) => !!p.live.cci || !!p.pw?.ctrlImmune;

export function freezePlayer(p: Player, ms: number) {
  if (p.invulnMs > 0 || p.deadMs > 0 || ctrlImmune(p)) return;
  p.frozenMs = Math.max(p.frozenMs, ms);
  if (p.channel) p.channel = null;
}

export function stunPlayer(p: Player, ms: number) {
  if (p.invulnMs > 0 || p.deadMs > 0 || ctrlImmune(p)) return;
  p.stunMs = Math.max(p.stunMs, ms);
  if (p.channel) p.channel = null;
}

/** Yank a player to within `stopDist` of a point (Vortex). */
export function pullPlayer(inst: Instance, p: Player, tx: number, ty: number, stopDist: number) {
  if (ctrlImmune(p)) return;
  const dx = tx - p.mv.x, dy = ty - p.mv.y;
  const d = Math.hypot(dx, dy);
  if (d <= stopDist) return;
  const s = d - stopDist;
  const q = inst.cw.moveCircle(p.mv.x, p.mv.y, p.r, (dx / d) * s, (dy / d) * s);
  p.mv.x = q.x; p.mv.y = q.y;
  p.x = q.x; p.y = q.y;
}
