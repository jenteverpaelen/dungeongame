// Geometry helpers, crowd-control on monsters/players, DoT application, buffs.

import { F_BLEED, F_BURN, F_CHILL, F_FROZEN, F_POISON, F_STUN, ELEMENT_INDEX, angleDiff, type Element } from '../shared';
import type { Instance } from '../instance';
import type { Buff, Dot, LiveMods, Mob, Player } from './types';

export const elIdx = (el: Element): number => ELEMENT_INDEX.indexOf(el);

// ─────────────────────────── Geometry ───────────────────────────

/** Is (mx, my) (with body radius mr) inside a cone from (ox, oy) facing `ang` with half-angle `half` and length `len`? */
export function inCone(mx: number, my: number, mr: number, ox: number, oy: number, ang: number, half: number, len: number): boolean {
  const dx = mx - ox, dy = my - oy;
  const d2 = dx * dx + dy * dy;
  const reach = len + mr;
  if (d2 > reach * reach) return false;
  if (d2 < (mr + 24) * (mr + 24)) return true; // standing on top of us
  const d = Math.sqrt(d2);
  // widen the half angle for body size so large monsters at the edge still count
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

// ─────────────────────────── Monster crowd control ───────────────────────────

/** Bosses and goblins ignore crowd control; elites suffer half durations. */
function ccFactor(m: Mob): number {
  if (m.dummy) return 0;
  if (m.tier === 4 || m.tier === 5) return 0;
  if (m.tier === 1 || m.tier === 2) return 0.5;
  return 1;
}

export function stunMob(m: Mob, ms: number) {
  const f = ccFactor(m);
  if (f <= 0) return;
  m.stunMs = Math.max(m.stunMs, ms * f);
  cancelWindup(m);
}

export function freezeMob(m: Mob, ms: number, by = 0) {
  const f = ccFactor(m);
  if (f <= 0) return;
  m.freezeMs = Math.max(m.freezeMs, ms * f);
  m.frozenBy = by;
  cancelWindup(m);
}

export function chillMob(m: Mob, ms: number) {
  if (m.dummy || m.tier === 4 || m.tier === 5) return;
  m.chillMs = Math.max(m.chillMs, ms);
}

export function cancelWindup(m: Mob) {
  if (m.state === 'windup') { m.state = 'chase'; m.windupMs = 0; m.atkCdMs = Math.max(m.atkCdMs, 300); }
}

/** Shove a monster `dist` units along (dx, dy) over ~0.25 s. */
export function knockbackMob(m: Mob, dx: number, dy: number, dist: number) {
  if (ccFactor(m) <= 0) return;
  const l = Math.hypot(dx, dy) || 1;
  m.kbX = (dx / l) * (dist / 0.25);
  m.kbY = (dy / l) * (dist / 0.25);
  m.kbMs = 250;
}

/** Move a monster towards (tx, ty) by `step` units with wall sliding (pull effects). */
export function dragMob(inst: Instance, m: Mob, tx: number, ty: number, step: number) {
  if (ccFactor(m) <= 0) return;
  const dx = tx - m.x, dy = ty - m.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  const s = Math.min(step, d);
  const p = inst.cw.moveCircle(m.x, m.y, m.r, (dx / d) * s, (dy / d) * s, !!m.def.flying);
  m.x = p.x; m.y = p.y;
  inst.mobHash.update(m);
}

export function addDot(m: Mob, dot: Dot) {
  // one dot per (kind, owner, skill): refresh in place
  for (let i = 0; i < m.dots.length; i++) {
    const d = m.dots[i];
    if (d.kind === dot.kind && d.owner === dot.owner && d.skill === dot.skill) { m.dots[i] = dot; return; }
  }
  if (m.dots.length < 6) m.dots.push(dot);
}

export function hasDot(m: Mob, kind: Dot['kind'], owner = 0): boolean {
  for (const d of m.dots) if (d.kind === kind && (owner === 0 || d.owner === owner)) return true;
  return false;
}

/** Recompute the status flag bits that are visible to clients. */
export function mobStatusFlags(m: Mob): number {
  let f = 0;
  if (m.stunMs > 0) f |= F_STUN;
  if (m.freezeMs > 0) f |= F_FROZEN;
  if (m.chillMs > 0) f |= F_CHILL;
  for (const d of m.dots) {
    if (d.kind === 'bleed') f |= F_BLEED;
    else if (d.kind === 'burn' || d.kind === 'molten') f |= F_BURN;
    else if (d.kind === 'poison') f |= F_POISON;
  }
  return f;
}

// ─────────────────────────── Buffs ───────────────────────────

export function addBuff(p: Player, buff: Buff) {
  const cur = p.buffs.find((b) => b.id === buff.id);
  if (cur) Object.assign(cur, buff);
  else p.buffs.push(buff);
  refreshLive(p);
}

export function getBuff(p: Player, id: string): Buff | undefined {
  for (const b of p.buffs) if (b.id === id) return b;
  return undefined;
}

export function removeBuff(p: Player, id: string) {
  const i = p.buffs.findIndex((b) => b.id === id);
  if (i >= 0) { p.buffs.splice(i, 1); refreshLive(p); }
}

export function refreshLive(p: Player) {
  const l: LiveMods = p.live;
  l.dmg = 0; l.chc = 0; l.chd = 0; l.ias = 0; l.move = 0; l.dr = 0;
  let drMul = 1;
  for (const b of p.buffs) {
    l.dmg += b.dmg ?? 0;
    l.chc += b.chc ?? 0;
    l.chd += b.chd ?? 0;
    l.ias += b.ias ?? 0;
    l.move += b.move ?? 0;
    if (b.dr) drMul *= 1 - b.dr;
  }
  l.dr = 1 - drMul;
}

// ─────────────────────────── Hostile effects on players ───────────────────────────

export function freezePlayer(p: Player, ms: number) {
  if (p.invulnMs > 0 || p.deadMs > 0) return;
  p.frozenMs = Math.max(p.frozenMs, ms);
}

export function stunPlayer(p: Player, ms: number) {
  if (p.invulnMs > 0 || p.deadMs > 0) return;
  p.stunMs = Math.max(p.stunMs, ms);
}

/** Yank a player towards a point (Vortex). */
export function pullPlayer(inst: Instance, p: Player, tx: number, ty: number, stopDist: number) {
  const dx = tx - p.mv.x, dy = ty - p.mv.y;
  const d = Math.hypot(dx, dy);
  if (d <= stopDist) return;
  const s = d - stopDist;
  const q = inst.cw.moveCircle(p.mv.x, p.mv.y, p.r, (dx / d) * s, (dy / d) * s);
  p.mv.x = q.x; p.mv.y = q.y;
  p.x = q.x; p.y = q.y;
}
