// Build tools T3 (docs/rework/depth/BUILD-TOOLS.md): the training-dummy bench in town. A run is armed by the player
// beside a dummy, starts at the first hit on any dummy and lasts the chosen length; every point of damage the player
// deals to dummies is recorded per strike id (skills, sub-strikes, procs, grounds, damage over time) by the one place
// that applies damage (damage.hurtMob), so the split always sums to the total. Server-only, nothing persisted.

import type { BenchView } from '../../../shared/src/buildSheet';
import { skillCost } from './playerctx';
import type { Instance } from './instance';
import type { Player } from './types';

/** Test lengths players can pick (BUILD-TOOLS T3: 30 / 60 / 120 s). */
export const BENCH_LENGTHS_S = [30, 60, 120] as const;
/** [P] How close to a dummy the player must stand to arm a run (the dummies stand in a row of three, ~3 m apart). */
export const BENCH_RANGE = 260;

export interface BenchRun {
  lengthMs: number;
  /** Simulation time of the first hit (-1 = armed, waiting for it). */
  startT: number;
  elapsedMs: number;
  done: boolean;
  total: number; hits: number; crits: number; dotTotal: number;
  bySkill: Map<string, number>;
  /** Time spent below the cheapest bar skill's cost (resource starvation). */
  starvedMs: number;
  buffMs: Map<string, number>;
}

export function newBench(lengthMs: number): BenchRun {
  return { lengthMs, startT: -1, elapsedMs: 0, done: false, total: 0, hits: 0, crits: 0, dotTotal: 0, bySkill: new Map(), starvedMs: 0, buffMs: new Map() };
}

/** Called by damage.hurtMob for damage to a dummy by a player who has a bench run (armed or running). */
export function benchHit(inst: Instance, p: Player, skill: string, amount: number, crit: boolean, dot: boolean) {
  const b = p.bench;
  if (!b || b.done) return;
  if (b.startT < 0) b.startT = inst.t;
  b.total += amount;
  b.bySkill.set(skill, (b.bySkill.get(skill) ?? 0) + amount);
  if (dot) b.dotTotal += amount;
  else { b.hits++; if (crit) b.crits++; }
}

/** Per tick while a run is going: elapsed time, starvation and buff uptime; ends the run at its length. */
export function benchTick(inst: Instance, p: Player, dtMs: number) {
  const b = p.bench;
  if (!b || b.done || b.startT < 0) return;
  b.elapsedMs = Math.min(b.lengthMs, inst.t - b.startT);
  const costs = p.ctx.slots.filter((s): s is NonNullable<typeof s> => !!s).map((s) => skillCost(p, s)).filter((c) => c > 0);
  if (costs.length && p.res < Math.min(...costs)) b.starvedMs += dtMs;
  for (const buff of p.buffs) b.buffMs.set(buff.id, (b.buffMs.get(buff.id) ?? 0) + dtMs);
  if (b.elapsedMs >= b.lengthMs) b.done = true;
}

export function benchView(p: Player): BenchView | null {
  const b = p.bench;
  if (!b) return null;
  const secs = Math.max(0.05, b.elapsedMs / 1000);
  return {
    state: b.done ? 'done' : b.startT < 0 ? 'armed' : 'running',
    lengthS: b.lengthMs / 1000, elapsedS: Math.round(b.elapsedMs / 100) / 10,
    total: Math.round(b.total), dps: b.startT < 0 ? 0 : Math.round(b.total / secs),
    hits: b.hits, critRate: b.hits ? Math.round(b.crits / b.hits * 1000) / 10 : 0, dotShare: b.total ? Math.round(b.dotTotal / b.total * 1000) / 10 : 0,
    skills: [...b.bySkill].sort((x, y) => y[1] - x[1]).map(([id, dmg]) => ({ id, total: Math.round(dmg), dps: b.startT < 0 ? 0 : Math.round(dmg / secs) })),
    starvedPct: b.elapsedMs ? Math.round(b.starvedMs / b.elapsedMs * 1000) / 10 : 0,
    buffs: [...b.buffMs].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([id, ms]) => ({ id, uptimePct: b.elapsedMs ? Math.min(100, Math.round(ms / b.elapsedMs * 1000) / 10) : 0 })),
  };
}

/** `bench { action: start | stop | reset | status, seconds? }` for the player of `link` (town only, beside a dummy to start). */
export function benchCommand(inst: Instance, p: Player, action: string, seconds: number): { ok: true; view: BenchView | null } | { ok: false; err: string } {
  if (action === 'status') return { ok: true, view: benchView(p) };
  if (action === 'reset') { p.bench = null; return { ok: true, view: null }; }
  if (action === 'stop') {
    if (!p.bench) return { ok: false, err: 'No test is running' };
    p.bench.done = true;
    return { ok: true, view: benchView(p) };
  }
  if (action !== 'start') return { ok: false, err: 'Unknown bench action' };
  if (inst.kind !== 'town') return { ok: false, err: 'The training dummies are in Hearthmere' };
  if (!(BENCH_LENGTHS_S as readonly number[]).includes(seconds)) return { ok: false, err: 'Choose 30, 60 or 120 seconds' };
  const near = inst.mobs.some((m) => m.dummy && !m.dead && Math.hypot(m.x - p.x, m.y - p.y) <= BENCH_RANGE);
  if (!near) return { ok: false, err: 'Stand beside a training dummy to start a test' };
  p.bench = newBench(seconds * 1000);
  return { ok: true, view: benchView(p) };
}
