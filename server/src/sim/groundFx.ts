// Data-driven ground effects (engine wave 2): interprets shared/src/data/grounds.ts definitions as Ground entries of
// kind 'fx'. One placed area: tick damage / statuses, a hit or status on entering (crossing), a status after an enemy
// stayed inside long enough, a pull toward the centre, optional following of the owner, a per-owner count limit.
// Damage is the expected (crit-weighted) damage of the ground's strike computed at placement and dealt as dot damage
// (vulnerability and elite bonus applied live, no on-hit procs) — the same rules as Meteor's molten ground [M].

import { GROUND_DEFS, type GroundDef } from '../../../shared/src/data/grounds';
import { dotStrike, expectedDamage } from './damage';
import { distToSegment, dragMob, elIdx } from './effects';
import { addGround, newGround } from './grounds';
import type { Instance } from './instance';
import { strikeFor } from './powerActions';
import { resolveStatus, type RStatus } from './powerRuntime';
import { applyStatus } from './status';
import type { Ground, Mob, Player } from './types';
import type { StatusSpec } from '../../../shared/src/powers';

export interface GroundFx {
  def: GroundDef;
  /** Multiplier on every coefficient (proc `ground.scale`). */
  scale: number;
  /** Expected damage of 1.0 weapon-damage coefficient for this ground, fixed at placement. */
  unit: number;
  /** Line shape: segment start / end; offsets from the owner for following grounds. */
  ax: number; ay: number; bx: number; by: number;
  offX: number; offY: number;
  /** Enemies inside at the previous update (crossing detection) and when each last triggered onEnter. */
  wasInside: Set<number>;
  entered: Map<number, number>;
  /** Cumulative-in-a-row time inside per enemy, and enemies that already received insideFor. */
  insideMs: Map<number, number>;
  done: Set<number>;
  /** Statuses with their vulnerability scopes resolved for the owner. */
  status: Map<StatusSpec, RStatus>;
}

/**
 * Place a ground from its definition at (x, y) facing `angle` (line grounds extend along it). Returns null for an
 * unknown id. Grounds over this owner's `maxPerOwner` remove the oldest first.
 */
export function placeGround(inst: Instance, p: Player, defId: string, x: number, y: number, angle: number, scale = 1): Ground | null {
  const def = GROUND_DEFS[defId];
  if (!def) return null;
  if (def.maxPerOwner) {
    const mine = inst.grounds.filter((g) => g.fx?.def === def && g.owner === p && g.endT > 0);
    for (let i = 0; i <= mine.length - def.maxPerOwner; i++) mine[i].endT = 0;
  }
  const el = def.element ?? 'physical';
  const g = newGround('fx', x, y, def.radius, inst.t, def.durationMs, def.tick?.everyMs ?? def.durationMs + 1);
  g.owner = p;
  g.el = el;
  g.follow = def.follow === 'owner';
  g.strike = strikeFor(p, def.id, 1, el);
  const len = def.shape === 'line' ? def.lineLength ?? 0 : 0;
  g.fx = {
    def, scale, unit: def.tick?.coef || def.onEnter?.coef ? expectedDamage(inst, p, g.strike) : 0,
    ax: x, ay: y, bx: x + Math.cos(angle) * len, by: y + Math.sin(angle) * len, offX: x - p.x, offY: y - p.y,
    wasInside: new Set(), entered: new Map(), insideMs: new Map(), done: new Set(), status: new Map(),
  };
  addGround(inst, g);
  if (def.visual) inst.emit({ e: 'aoe', v: def.visual, x: Math.round(g.x), y: Math.round(g.y), r: Math.round(g.r), d: def.durationMs, el: elIdx(el), s: p.id,
    ...(len ? { a: Math.round(angle * 1000) / 1000 } : {}), ...(g.follow || g.stick ? { f: 1 as const } : {}) }, x, y, p.id);
  return g;
}

/** Monsters inside a ground right now (circle, or within `radius` of the line segment). */
export function mobsInside(inst: Instance, g: Ground): Mob[] {
  const fx = g.fx!;
  if (fx.def.shape !== 'line') return inst.queryMobs(g.x, g.y, g.r);
  const mx = (fx.ax + fx.bx) / 2, my = (fx.ay + fx.by) / 2, half = Math.hypot(fx.bx - fx.ax, fx.by - fx.ay) / 2;
  return inst.queryMobs(mx, my, half + g.r).filter((m) => distToSegment(m.x, m.y, fx.ax, fx.ay, fx.bx, fx.by) <= g.r + m.r);
}

function statusOf(fx: GroundFx, p: Player, s: StatusSpec): RStatus {
  let r = fx.status.get(s);
  if (!r) { r = resolveStatus(s, p.ctx.powers.index); fx.status.set(s, r); }
  return r;
}

function hit(inst: Instance, g: Ground, p: Player, m: Mob, part: { coef?: number; status?: StatusSpec }) {
  const fx = g.fx!;
  if (part.coef && fx.unit) dotStrike(inst, p, m, part.coef * fx.scale * fx.unit, g.el, fx.def.id);
  if (part.status && !m.dead) applyFrom(inst, g, p, m, statusOf(fx, p, part.status));
}

/** A ground's status: from the ground (taunts follow it), or from the owner when the status says origin 'owner'. */
function applyFrom(inst: Instance, g: Ground, p: Player, m: Mob, s: RStatus) {
  const own = s.origin === 'owner';
  applyStatus(inst, p, m, s, own ? p.x : g.x, own ? p.y : g.y, g.fx!.def.id, own ? p : g);
}

export function updateFxGround(inst: Instance, g: Ground, dtMs: number) {
  const fx = g.fx!, def = fx.def, p = g.owner;
  if (!p) return;
  if (g.follow || g.stick) {
    const nx = p.x + fx.offX, ny = p.y + fx.offY, dx = nx - g.x, dy = ny - g.y;
    g.x = nx; g.y = ny; fx.ax += dx; fx.ay += dy; fx.bx += dx; fx.by += dy;
  }
  const inside = mobsInside(inst, g);
  const now = new Set<number>();
  for (const m of inside) now.add(m.id);
  if (def.onEnter) {
    const again = def.onEnter.againAfterMs ?? Infinity;
    for (const m of inside) {
      if (m.dead || fx.wasInside.has(m.id)) continue;
      const last = fx.entered.get(m.id);
      if (last !== undefined && inst.t - last < again) continue;
      fx.entered.set(m.id, inst.t);
      hit(inst, g, p, m, def.onEnter);
    }
  }
  fx.wasInside = now;
  if (def.insideFor) {
    for (const id of fx.insideMs.keys()) if (!now.has(id)) fx.insideMs.delete(id); // "straight": leaving resets
    for (const m of inside) {
      if (m.dead || fx.done.has(m.id)) continue;
      const t = (fx.insideMs.get(m.id) ?? 0) + dtMs;
      fx.insideMs.set(m.id, t);
      if (t >= def.insideFor.ms) { fx.done.add(m.id); applyFrom(inst, g, p, m, statusOf(fx, p, def.insideFor.status)); }
    }
  }
  if (def.pull) {
    const step = def.pull.speed * (dtMs / 1000);
    for (const m of inside) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - g.x, m.y - g.y);
      if (d > 12) dragMob(inst, m, g.x, g.y, Math.min(step, d - 10), p);
    }
  }
  if (def.tick && inst.t >= g.nextT) {
    g.nextT += def.tick.everyMs;
    const tick = def.tick;
    if (tick.coef) for (const m of inside) if (!m.dead) dotStrike(inst, p, m, tick.coef * fx.scale * fx.unit, g.el, def.id);
    if (tick.status) {
      const s = statusOf(fx, p, tick.status);
      const targets = s.radius ? inst.queryMobs(g.x, g.y, s.radius) : inside;
      for (const m of targets) if (!m.dead) applyFrom(inst, g, p, m, s);
    }
  }
}
