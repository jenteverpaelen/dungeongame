// Geometry helpers, crowd control on monsters/players, DoT bookkeeping and player buffs.

import { ELEMENT_INDEX, F_BLEED, F_BURN, F_CHILL, F_FROZEN, F_POISON, F_STUN, T_VOID, T_WALL, TILE, angleDiff, type Element } from '../shared';
import type { Instance } from './instance';
import type { Buff, Dot, DotKind, Mob, Player } from './types';

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
  return t === T_WALL || t === T_VOID;
}

/** Line of fire between two points (samples every half tile). */
export function shotBlocked(inst: Instance, x0: number, y0: number, x1: number, y1: number): boolean {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(len / (TILE / 2));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (shotBlockedAt(inst, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true;
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

export function stunMob(m: Mob, ms: number) {
  const f = ccFactor(m);
  if (f <= 0) return;
  m.stunMs = Math.max(m.stunMs, ms * f);
  cancelWindup(m);
}

export function freezeMob(m: Mob, ms: number, shatterBy = 0, depth = 0) {
  const f = ccFactor(m);
  if (f <= 0) return;
  m.freezeMs = Math.max(m.freezeMs, ms * f);
  if (shatterBy) { m.shatterBy = shatterBy; m.shatterDepth = depth; }
  cancelWindup(m);
}

export function chillMob(m: Mob, ms: number) {
  if (m.dummy || m.tier === 4 || m.tier === 5) return;
  m.chillMs = Math.max(m.chillMs, ms);
}

export function cancelWindup(m: Mob) {
  if (m.state === 'windup') { m.state = 'chase'; m.stateMs = 0; m.atkCdMs = Math.max(m.atkCdMs, 400); }
}

/** Shove a monster `dist` units along (dx, dy) over 0.25 s. */
export function knockbackMob(m: Mob, dx: number, dy: number, dist: number) {
  const f = ccFactor(m);
  if (f <= 0) return;
  const l = Math.hypot(dx, dy) || 1;
  const d = dist * f;
  m.kbX = (dx / l) * (d / 0.25);
  m.kbY = (dy / l) * (d / 0.25);
  m.kbMs = 250;
}

/** Move a monster towards (tx, ty) by up to `step` units with wall sliding (pull effects). */
export function dragMob(inst: Instance, m: Mob, tx: number, ty: number, step: number) {
  if (m.dummy || m.tier === 4) return;
  const dx = tx - m.x, dy = ty - m.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  const s = Math.min(step, d);
  const p = inst.cw.moveCircle(m.x, m.y, m.r, (dx / d) * s, (dy / d) * s, !!m.def.flying);
  m.x = p.x; m.y = p.y;
  inst.mobHash.update(m);
}

export function addDot(m: Mob, dot: Dot) {
  // one dot per (kind, owner, skill): refresh in place (keeps the stronger tick)
  for (let i = 0; i < m.dots.length; i++) {
    const d = m.dots[i];
    if (d.kind === dot.kind && d.owner === dot.owner && d.skill === dot.skill) {
      if (dot.perTick < d.perTick && d.leftMs > dot.leftMs * 0.5) { d.leftMs = Math.max(d.leftMs, dot.leftMs); return; }
      dot.nextMs = Math.min(dot.nextMs, d.nextMs);
      m.dots[i] = dot;
      return;
    }
  }
  if (m.dots.length < 8) m.dots.push(dot);
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
  for (const b of p.buffs) {
    l.dmg += b.dmg ?? 0;
    l.chc += b.chc ?? 0;
    l.chd += b.chd ?? 0;
    l.ias += (b.ias ?? 0) * (b.st ?? 1);
  }
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

export function freezePlayer(p: Player, ms: number) {
  if (p.invulnMs > 0 || p.deadMs > 0) return;
  p.frozenMs = Math.max(p.frozenMs, ms);
  if (p.channel) p.channel = null;
}

export function stunPlayer(p: Player, ms: number) {
  if (p.invulnMs > 0 || p.deadMs > 0) return;
  p.stunMs = Math.max(p.stunMs, ms);
  if (p.channel) p.channel = null;
}

/** Yank a player to within `stopDist` of a point (Vortex). */
export function pullPlayer(inst: Instance, p: Player, tx: number, ty: number, stopDist: number) {
  const dx = tx - p.mv.x, dy = ty - p.mv.y;
  const d = Math.hypot(dx, dy);
  if (d <= stopDist) return;
  const s = d - stopDist;
  const q = inst.cw.moveCircle(p.mv.x, p.mv.y, p.r, (dx / d) * s, (dy / d) * s);
  p.mv.x = q.x; p.mv.y = q.y;
  p.x = q.x; p.y = q.y;
}
