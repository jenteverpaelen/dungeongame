// Save format history: one entry per SAVE_VERSION, oldest first. Every entry names what that version added, the save
// fields it owns and the golden fixture that proves an old save of that version still loads without loss
// (server/test/fixtures/saves/v<N>-<slug>.json, checked by server/test/saveMigrations.test.ts).
//
// The migration itself is the load-time normaliser (server/src/persistence.ts normalizeSave): every version since v2
// is additive, so "absent" always means the old behaviour and nothing is rewritten. When a future version needs a
// real transformation, put it in `migrate` here and call it from normalizeSave in version order.
//
// Adding a version: bump SAVE_VERSION, append an entry here, add the fixture. The test fails until all three agree.

import { SAVE_VERSION } from './saveVersion';
import { validSocial } from './social';
import { validLootRules } from './itemCollection';
import { validBestiary } from './bestiary';
import { ownedItems, validMerchant } from './merchant';
import { validEconomy } from './economy';
import { validCommandState } from './commandState';
import { validIntro } from './onboarding';
import { validPassiveState } from './passives';
import { validLoadoutState } from './loadouts';
import type { CharacterSave } from './types';

export interface SaveVersionStep {
  version: number;
  /** One line: what a save of this version can contain that the previous one could not. */
  adds: string;
  /** Top-level save fields introduced (or given new meaning) by this version. */
  fields: readonly string[];
  /** Golden fixture file name (without .json) under server/test/fixtures/saves. */
  fixture: string;
  /** Optional in-place transformation from version-1 to this version. None needed so far: all steps are additive. */
  migrate?: (save: CharacterSave) => void;
  /** After loading, the version's fields are either absent (old save) or valid. */
  check?: (save: CharacterSave) => boolean;
  /** Set when loading may legitimately repair this version's fields (then they are checked for validity, not equality). */
  mayRepair?: string;
  /** Fields a later, unversioned load-time migration rewrites on purpose: their keys must survive, values may change. */
  rewrites?: Readonly<Record<string, string>>;
  /** More fixtures of the same version for load-time migrations that did not bump the version (custody still checked). */
  extraFixtures?: readonly { fixture: string; note: string; goldMayRise?: boolean }[];
}

const absentOr = <T>(v: T | undefined, ok: (v: T) => boolean) => v === undefined || ok(v);

export const SAVE_HISTORY: readonly SaveVersionStep[] = [
  { version: 0, adds: 'Unversioned prototype saves (load-time normalisation fills defaults).', fields: [], fixture: 'v0-unversioned' },
  { version: 1, adds: 'Explicit `version` field; stash and cube normalised to fixed sizes.', fields: ['version'], fixture: 'v1-current' },
  { version: 2, adds: 'Item protection flag (absent = unprotected).', fields: ['protected'], fixture: 'v2-protected' },
  { version: 3, adds: 'Per-slot automatic cast modes.', fields: ['skills.autoCast'], fixture: 'v3-autocast' },
  { version: 4, adds: 'Character target preference.', fields: ['skills.targetPriority'], fixture: 'v4-target-priority' },
  { version: 5, adds: 'Per-slot automatic spending/trigger rules.', fields: ['skills.autoRules'], fixture: 'v5-auto-rules' },
  { version: 6, adds: 'Bounded quest cycles and history; older servers must not ignore repeat tokens.', fields: ['quests', 'trackedQuest'], fixture: 'v6-quest-history',
    rewrites: { quests: 'the quest rework (shared/src/questMigration.ts) moves old quest states to the new step model; finished work stays finished' } },
  { version: 7, adds: 'Selected appearance and introduction accomplishments.', fields: ['appearance', 'onboarding'],
    fixture: 'v7-onboarding', check: s => absentOr(s.onboarding, validIntro) },
  { version: 8, adds: 'Early-game creature records and retained merchant custody.', fields: ['bestiary', 'merchant'],
    fixture: 'v8-merchant', check: s => absentOr(s.bestiary, validBestiary) && absentOr(s.merchant, validMerchant) },
  { version: 9, adds: 'Purchased-stock provenance on items (`vendorStock`).', fields: ['vendorStock'], fixture: 'v9-merchant' },
  { version: 10, adds: 'Bounded resource summaries; existing wealth is never backfilled as income.', fields: ['economy'],
    fixture: 'v10-economy', check: s => absentOr(s.economy, validEconomy) },
  { version: 11, adds: 'Command identity/results and paid pending enchant choices.', fields: ['commands'],
    fixture: 'v11-commands', check: s => absentOr(s.commands, validCommandState) },
  { version: 12, adds: 'Slotted passive selections; absent selections grant no stats.', fields: ['passives'],
    fixture: 'v12-passives', check: s => absentOr(s.passives, p => validPassiveState(p, s.classId)) },
  { version: 13, adds: 'Character contact lists and privacy preferences.', fields: ['social'],
    fixture: 'v13-social', check: s => absentOr(s.social, validSocial) },
  { version: 14, adds: 'Acquired item appearances (wardrobe) and independent loot preferences.', fields: ['collection'],
    fixture: 'v14-collection',
    extraFixtures: [{ fixture: 'v14-pre-quest-rework', note: 'quest rework load migration: retired contracts that were finished pay their gold out', goldMayRise: true }],
    check: s => absentOr(s.collection, c => c.revision === 1 && validLootRules(c.loot)) },
  { version: 15, adds: 'Specialization node ranks per skill (build-depth foundation).', fields: ['skills.nodes'],
    // normalizeSkillNodes clears a tree that is illegal under the current data (a free respec), so the fixture's ranks
    // only survive once its skill has those nodes; the custody check still applies.
    mayRepair: 'skills.nodes are re-validated against the current skill trees on load',
    fixture: 'v15-nodes',
    extraFixtures: [{ fixture: 'v15-grades', note: 'input of the v16 grade migration (pre-grade Ancient / Primal items; sharedItems.test.ts)' }],
    check: s => absentOr(s.skills.nodes, n => !!n && typeof n === 'object' && Object.values(n).every(r => !!r && typeof r === 'object'
      && Object.values(r).every(v => Number.isInteger(v) && v >= 0))) },
  { version: 16, adds: 'Item grades (Kindled / Fabled): pre-grade Ancient / Primal items keep their stored values and get legacyGrade; old Primal items a deterministic Inscription.',
    fields: ['legacyGrade', 'inscription'], fixture: 'v16-grades',
    extraFixtures: [{ fixture: 'v16-legacy-rolls', note: 'legendary rolls of retired ranges rescale on load (shared/src/legendaryRolls.ts; saveMigrations.test.ts)' }],
    check: s => ownedItems(s).every(i => !i || !i.ancient || !!i.legacyGrade || i.kindledAffix !== undefined) },
  { version: 17, adds: 'Five named skill loadouts (build tools T4): primary, slots, runes, tiers, node ranks, passives and auto-cast settings; no gear.',
    fields: ['loadouts'], fixture: 'v17-loadouts',
    // normalizeLoadouts keeps only well-formed loadouts; a loadout's content is re-validated when it is applied.
    check: s => absentOr(s.loadouts, l => validLoadoutState(l, s.classId)) },
];

/** Problems with the history itself (gaps, order, missing current version). Empty when consistent. */
export function saveHistoryProblems(history: readonly SaveVersionStep[] = SAVE_HISTORY, current = SAVE_VERSION): string[] {
  const out: string[] = [];
  history.forEach((step, i) => { if (step.version !== i) out.push(`entry ${i} has version ${step.version}; versions must be 0..N without gaps`); });
  if (history.length !== current + 1) out.push(`SAVE_VERSION is ${current} but the history ends at ${history.length - 1}; add an entry and a golden fixture`);
  const fixtures = new Set<string>();
  for (const step of history) {
    if (!new RegExp(`^v${step.version}-[a-z0-9-]+$`).test(step.fixture)) out.push(`v${step.version}: fixture name must be v${step.version}-<slug>`);
    if (fixtures.has(step.fixture)) out.push(`v${step.version}: fixture ${step.fixture} reused`);
    fixtures.add(step.fixture);
  }
  return out;
}

/** Runs the explicit transformations for versions after `from` (none today), oldest first. */
export function migrateSteps(save: CharacterSave, from: number): void {
  for (const step of SAVE_HISTORY) if (step.version > from && step.migrate) step.migrate(save);
}
