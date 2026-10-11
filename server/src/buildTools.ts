// Build tools (docs/rework/depth/BUILD-TOOLS.md, M1): the damage sheet (T1 / T2), the training-dummy bench (T3),
// skill loadouts (T4) and build codes (T5). Every number comes from the live combat code; every change is validated
// with the same shared rules as the single skill commands.

import type { Session } from './net/session';
import { fail, ok, type CmdResult } from './world';

type Args = Record<string, unknown>;

/** [P] At most this many sheet requests per session per second (the client asks on open and after each change). */
const SHEET_PER_SECOND = 6;
const sheetCalls = new WeakMap<Session, number[]>();

function withinBudget(s: Session, now: number): boolean {
  const recent = (sheetCalls.get(s) ?? []).filter((t) => now - t < 1000);
  if (recent.length >= SHEET_PER_SECOND) { sheetCalls.set(s, recent); return false; }
  recent.push(now);
  sheetCalls.set(s, recent);
  return true;
}

/** `bench { action: start | stop | reset | status, seconds? }`: the training-dummy test, not persisted. */
export function benchToolCommand(s: Session, a: Args): CmdResult {
  const inst = s.rec?.inst;
  if (!inst?.bench) return fail('Enter the world first');
  const action = typeof a.action === 'string' ? a.action : 'status';
  const seconds = typeof a.seconds === 'number' ? a.seconds : 60;
  const r = inst.bench(s, action, seconds);
  return r.ok ? ok(r.view) : fail(r.err);
}

/** `buildSheet { skills? }`: exact numbers of the bar skills (or the listed ones), not persisted. */
export function buildSheetCommand(s: Session, a: Args): CmdResult {
  const inst = s.rec?.inst;
  if (!inst?.buildSheet) return fail('Enter the world to read your numbers');
  if (!withinBudget(s, Date.now())) return fail('Too many sheet requests; try again in a moment');
  const ids = Array.isArray(a.skills) ? a.skills.filter((x): x is string => typeof x === 'string').slice(0, 24) : undefined;
  const sheet = inst.buildSheet(s, ids);
  return sheet ? ok(sheet) : fail('Character is not ready');
}
