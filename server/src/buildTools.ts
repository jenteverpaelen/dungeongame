// Build tools (docs/rework/depth/BUILD-TOOLS.md, M1): the damage sheet (T1 / T2), the training-dummy bench (T3),
// skill loadouts (T4) and build codes (T5). Every number comes from the live combat code; every change is validated
// with the same shared rules as the single skill commands.

import type { Session } from './net/session';
import { LOADOUT_NAME_MAX, LOADOUT_SLOTS, applySetup, saveLoadout } from '../../shared/src/loadouts';
import { buildToSetup, decodeBuild } from '../../shared/src/buildCode';
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

/**
 * `loadout { action: save | apply | rename | delete, index, name? }` (persisted). Applying is free (it refunds every
 * tier and node first), only in town, and goes through the same shared rules as the single skill commands; parts the
 * character may not use are skipped and returned.
 */
export function loadoutCommand(s: Session, a: Args): CmdResult {
  const action = typeof a.action === 'string' ? a.action : '';
  const index = typeof a.index === 'number' ? a.index : -1;
  if (!Number.isInteger(index) || index < 0 || index >= LOADOUT_SLOTS) return fail('Choose a loadout slot');
  const save = s.save, entry = save.loadouts?.sets[index] ?? null;
  switch (action) {
    case 'save': {
      const err = saveLoadout(save, index, a.name);
      if (err) return fail(err);
      s.changed(false);
      return ok();
    }
    case 'rename': {
      if (!entry) return fail('That loadout is empty');
      const name = typeof a.name === 'string' ? a.name.trim().slice(0, LOADOUT_NAME_MAX) : '';
      if (!name) return fail('Give the loadout a name');
      entry.name = name;
      s.changed(false);
      return ok();
    }
    case 'delete': {
      if (!entry) return fail('That loadout is empty');
      save.loadouts!.sets[index] = null;
      s.changed(false);
      return ok();
    }
    case 'apply': {
      if (!entry) return fail('That loadout is empty');
      if (s.rec?.kind !== 'town') return fail('Switch loadouts in Hearthmere');
      const skipped = applySetup(save, entry);
      s.changed(true);
      return ok({ skipped: skipped.slice(0, 12) });
    }
    default: return fail('Unknown loadout action');
  }
}

/**
 * `applyBuild { code }` (persisted): the skill part of an HF1 build code, through the same rules as a loadout (town
 * only, free respec first, what this hero may not use is skipped and reported). Gear in the code is never granted.
 */
export function applyBuildCommand(s: Session, a: Args): CmdResult {
  if (typeof a.code !== 'string') return fail('Paste a build code');
  const d = decodeBuild(a.code);
  if (!d.ok) return fail(d.err);
  if (d.build.classId !== s.save.classId) return fail('That build is for another class');
  if (s.rec?.kind !== 'town') return fail('Apply builds in Hearthmere');
  const skipped = [...d.unknown.map((u) => `${u}: not in this version`), ...applySetup(s.save, buildToSetup(d.build))];
  s.changed(true);
  return ok({ skipped: skipped.slice(0, 12) });
}
