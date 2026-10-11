// Every save version has a golden fixture and loads without loss (roadmap P3 acceptance 3 + 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { SAVE_VERSION } from '../../shared/src/saveVersion';
import { SAVE_HISTORY, saveHistoryProblems } from '../../shared/src/saveMigrations';
import type { CharacterSave } from '../../shared/src/types';
import { ensureDataDir, flushSaves, loadCharacter, normalizeSave, saveCharacter } from '../src/persistence';
import { custodySummary } from '../src/saveIntegrity';

assert.ok(process.env.DATA_DIR, 'Save migration tests require an explicit isolated DATA_DIR');
ensureDataDir();
const dir = new URL('./fixtures/saves/', import.meta.url);
const read = async (name: string): Promise<CharacterSave> => JSON.parse(await fs.readFile(new URL(`${name}.json`, dir), 'utf8'));
const get = (save: unknown, dotted: string) => dotted.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), save);

test('the save history is gap-free and ends at SAVE_VERSION', () => {
  assert.deepEqual(saveHistoryProblems(), []);
  assert.equal(SAVE_HISTORY.at(-1)!.version, SAVE_VERSION);
  // The checker itself catches the mistakes it exists for.
  assert.match(saveHistoryProblems(SAVE_HISTORY, SAVE_VERSION + 1).join(), /add an entry and a golden fixture/);
  assert.match(saveHistoryProblems([...SAVE_HISTORY.slice(0, 3), ...SAVE_HISTORY.slice(4)], SAVE_HISTORY.length - 2).join(), /without gaps/);
});

test('one golden fixture per version, and no orphan fixtures', async () => {
  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
  assert.deepEqual(files, SAVE_HISTORY.map(s => s.fixture).sort());
  for (const step of SAVE_HISTORY) {
    const save = await read(step.fixture);
    assert.equal(save.version ?? 0, step.version, `${step.fixture} declares version ${step.version}`);
  }
});

test('every version migrates to the current version with zero custody loss, keeps its fields and reloads identically', async () => {
  for (const step of SAVE_HISTORY) {
    const original = await read(step.fixture);
    const before = custodySummary(original);
    const migrated = normalizeSave(structuredClone(original));
    assert.equal(migrated.version, SAVE_VERSION, step.fixture);
    assert.deepEqual(custodySummary(migrated), before, `${step.fixture}: item ids, gems, gold and materials survive`);
    for (const field of step.fields) {
      if (field === 'version' || field === 'protected' || field === 'vendorStock') continue; // item flags / the version itself are covered elsewhere
      if (step.mayRepair) continue; // validity is checked below instead (see the step's note)
      const was = get(original, field);
      if (was !== undefined) assert.deepEqual(get(migrated, field), was, `${step.fixture}: ${field} preserved`);
    }
    // Fields of every version up to this one stay valid after loading.
    for (const s of SAVE_HISTORY) if (s.check) assert.ok(s.check(migrated), `${step.fixture}: v${s.version} fields valid after load`);
    assert.deepEqual(normalizeSave(structuredClone(migrated)), migrated, `${step.fixture}: migration is idempotent`);
    await saveCharacter(migrated); await flushSaves();
    assert.deepEqual(await loadCharacter(migrated.id), migrated, `${step.fixture}: save/reload preserves the migrated state`);
  }
});

test('fixtures of newer versions carry the data their version introduced', async () => {
  const v13 = await read('v13-social'), v14 = await read('v14-collection');
  assert.ok(v13.social && v13.social.friends.length > 0 && v13.social.presence === 'hidden');
  assert.ok(v14.collection && Object.keys(v14.collection.looks).length > 0);
  const v15 = await read('v15-nodes');
  assert.ok(v15.skills.nodes && Object.keys(v15.skills.nodes).length > 0);
});
