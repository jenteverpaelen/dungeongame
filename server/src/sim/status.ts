// Monster statuses applied by power primitives (engine wave 2): one entry point (applyStatus) for every StatusKind,
// the per-monster bookkeeping (weaken, taunt, freeze build-up, scoped vulnerability) and the status event that feeds
// applyStatus procs and first-hit resets. Control statuses reuse the existing helpers in effects.ts, so bosses,
// goblins and dummies keep their immunities and elites their half durations (ccFactor).

import type { StatusKind } from '../../../shared/src/powers';
import { makeDot } from './damage';
import { addOwnedDot, ccFactor, chillMob, dragMob, freezeMob, knockbackMob, stunMob } from './effects';
import type { Instance } from './instance';
import { firePowerProcs, powerState, type RStatus } from './powerRuntime';
import type { Mob, MobPowerStatus, Player } from './types';

/** Freeze build-up needed to freeze (StatusSpec.pct points per application). */
export const FREEZE_BUILD_FULL = 100;
/** [P] Default bleed / burn duration and tick when a status does not say (matches Rend's 500 ms tick [M]). */
const DOT_TICK_MS = 500;

export function mobStatus(m: Mob): MobPowerStatus {
  return (m.ps ??= { weakenMs: 0, weakenPct: 0, tauntMs: 0, tauntTo: null, build: [], vulns: [] });
}

/** What a taunt points at: a player (the monster fights them), a summon (until it dies), a ground (until it ends) or a point. */
export type TauntRef = { x: number; y: number; dead?: boolean; endT?: number; kind?: string; id?: number };

/**
 * Apply one status from player `p` to monster `m`. (`fromX`, `fromY`) is the source point (knockback direction, pull
 * target, taunt point when there is no `ref`). `source` is the strike id used for bleed / burn damage and for
 * `exceptSource` vulnerabilities.
 */
export function applyStatus(inst: Instance, p: Player, m: Mob, s: RStatus, fromX: number, fromY: number, source: string, ref: TauntRef | null = null) {
  if (m.dead) return;
  const pct = typeof s.pct === 'number' ? s.pct : 0;
  const ms = s.ms ?? 0;
  switch (s.kind) {
    case 'stun': stunMob(m, ms, inst, p); return;
    case 'freeze': freezeMob(m, ms, 0, 0, inst, p); return;
    case 'chill': chillMob(m, ms, inst, p); return;
    case 'knockback': knockbackMob(m, m.x - fromX, m.y - fromY, s.dist ?? 0, inst, p); return;
    case 'pull': dragMob(inst, m, fromX, fromY, s.dist ?? 0, p); return;
    case 'weaken': {
      if (m.dummy) return;
      const ps = mobStatus(m);
      ps.weakenMs = Math.max(ps.weakenMs, ms);
      ps.weakenPct = Math.max(ps.weakenPct, Math.min(100, pct));
      break;
    }
    case 'vulnerable': {
      const ps = mobStatus(m), except = !!s.exceptSource;
      const scope = except ? new Set([source]) : s.scope;
      const cur = ps.vulns.find((v) => v.owner === p.id && v.except === except && sameScope(v.scope, scope));
      if (cur) { cur.ms = Math.max(cur.ms, ms); cur.pct = Math.max(cur.pct, pct); if (s.consume) cur.consume = true; }
      else ps.vulns.push(s.consume ? { owner: p.id, scope, except, pct, ms, consume: true } : { owner: p.id, scope, except, pct, ms });
      break;
    }
    case 'taunt': {
      const f = ccFactor(m);
      if (f <= 0) return;
      const ps = mobStatus(m);
      ps.tauntMs = Math.max(ps.tauntMs, ms * f);
      ps.tauntTo = ref ?? { x: fromX, y: fromY };
      break;
    }
    case 'bleed': case 'burn': {
      const dur = ms || 3000;
      const el = s.kind === 'burn' ? 'fire' : 'physical';
      addOwnedDot(p, m, makeDot(inst, p, { skill: source, coef: typeof s.coef === 'number' ? s.coef : 0, el, pct: p.ctx.powers.mods.get(source)?.dmg ?? 0 }, s.kind, dur, DOT_TICK_MS));
      break;
    }
    case 'freezeBuild': {
      if (ccFactor(m) <= 0) return;
      const ps = mobStatus(m), win = s.windowMs ?? Infinity;
      ps.build.push(inst.t, pct);
      let sum = 0, keep = 0;
      for (let i = 0; i < ps.build.length; i += 2) if (inst.t - ps.build[i] <= win) { ps.build[keep++] = ps.build[i]; ps.build[keep++] = ps.build[i + 1]; sum += ps.build[i + 1]; }
      ps.build.length = keep;
      if (sum >= FREEZE_BUILD_FULL) { ps.build.length = 0; freezeMob(m, ms, 0, 0, inst, p); }
      break;
    }
    case 'mark':
      m.markMs = Math.max(m.markMs, ms);
      if (pct > m.markPct) m.markPct = pct;
      break;
  }
  if (p.ctx.powers.statusWatch) onStatusApplied(inst, p, m, s.kind);
}

const sameScope = (a: ReadonlySet<string> | null, b: ReadonlySet<string> | null) =>
  a === b || (!!a && !!b && a.size === b.size && [...a].every((x) => b.has(x)));

/** A status from player `by` landed: first-hit windows that reset on it reopen, marks spread, applyStatus procs run. */
export function onStatusApplied(inst: Instance, by: Player, m: Mob, kind: StatusKind) {
  const fh = by.ctx.powers.defense?.firstHit;
  if (fh) for (let i = 0; i < fh.length; i++) if (fh[i].reset?.includes(kind)) powerState(by).firstHitAt[i] = -Infinity;
  const spread = by.ctx.powers.rules.markSpread;
  if (kind === 'mark' && spread > 0) {
    // The copy is set directly (no second report), so a spread mark never spreads again.
    const o = inst.mobHash.nearest(m.x, m.y, spread, (x) => !x.dead && x !== m);
    if (o) { o.markMs = Math.max(o.markMs, m.markMs); if (m.markPct > o.markPct) o.markPct = m.markPct; }
  }
  firePowerProcs(inst, by, 'applyStatus', { status: kind, mob: m });
}

/** After a hit by player `p` with strike `skill`: consumable vulnerabilities that applied to it are used up. */
export function consumeVulns(m: Mob, p: Player, skill: string) {
  const ps = m.ps!;
  if (!ps.vulns.some((v) => v.consume && v.owner === p.id)) return;
  ps.vulns = ps.vulns.filter((x) => {
    if (!x.consume || x.owner !== p.id) return true;
    const listed = !!x.scope && x.scope.has(skill);
    return !!x.scope && (x.except ? listed : !listed); // keep entries that did not apply to this strike
  });
}

/** Per monster tick (only when it carries power statuses). */
export function tickMobStatus(m: Mob, dtMs: number) {
  const ps = m.ps!;
  if (ps.weakenMs > 0) { ps.weakenMs -= dtMs; if (ps.weakenMs <= 0) ps.weakenPct = 0; }
  if (ps.tauntMs > 0) {
    ps.tauntMs -= dtMs;
    const to = ps.tauntTo;
    if (ps.tauntMs <= 0 || !to || to.dead || to.endT === 0) { ps.tauntMs = 0; ps.tauntTo = null; }
  }
  if (ps.vulns.length) {
    for (const v of ps.vulns) v.ms -= dtMs;
    if (ps.vulns.some((v) => v.ms <= 0)) ps.vulns = ps.vulns.filter((v) => v.ms > 0);
  }
}

/** Scoped vulnerabilities of `m` against player `p`'s strike `skill` (×). */
export function scopedVulnerability(m: Mob, p: Player, skill: string | undefined): number {
  let v = 1;
  for (const x of m.ps!.vulns) {
    if (x.owner !== p.id) continue;
    const listed = !!skill && !!x.scope && x.scope.has(skill);
    if (x.scope && (x.except ? listed : !listed)) continue;
    v *= 1 + x.pct / 100;
  }
  return v;
}

/** Outgoing damage factor of a weakened monster (1 when not weakened). */
export const weakenFactor = (m: Mob | null): number => (m?.ps && m.ps.weakenMs > 0 ? 1 - m.ps.weakenPct / 100 : 1);
