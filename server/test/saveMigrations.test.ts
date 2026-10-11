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
  assert.deepEqual(files, SAVE_HISTORY.flatMap(s => [s.fixture, ...(s.extraFixtures ?? []).map(e => e.fixture)]).sort());
  for (const step of SAVE_HISTORY) for (const name of [step.fixture, ...(step.extraFixtures ?? []).map(e => e.fixture)]) {
    const save = await read(name);
    assert.equal(save.version ?? 0, step.version, `${name} declares version ${step.version}`);
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
      if (was === undefined) continue;
      // A later load-time migration may rewrite the values on purpose (see the step's note); nothing may disappear.
      if (step.rewrites?.[field] && was && typeof was === 'object') {
        for (const key of Object.keys(was)) assert.ok(get(migrated, `${field}.${key}`) !== undefined, `${step.fixture}: ${field}.${key} survives`);
      } else assert.deepEqual(get(migrated, field), was, `${step.fixture}: ${field} preserved`);
    }
    // Fields of every version up to this one stay valid after loading.
    for (const s of SAVE_HISTORY) if (s.check) assert.ok(s.check(migrated), `${step.fixture}: v${s.version} fields valid after load`);
    assert.deepEqual(normalizeSave(structuredClone(migrated)), migrated, `${step.fixture}: migration is idempotent`);
    await saveCharacter(migrated); await flushSaves();
    assert.deepEqual(await loadCharacter(migrated.id), migrated, `${step.fixture}: save/reload preserves the migrated state`);
  }
});

test('extra fixtures of unversioned load-time migrations lose nothing and reload identically', async () => {
  for (const step of SAVE_HISTORY) for (const extra of step.extraFixtures ?? []) {
    const original = await read(extra.fixture);
    const migrated = normalizeSave(structuredClone(original));
    assert.equal(migrated.version, SAVE_VERSION, extra.fixture);
    const noGold = (s: CharacterSave) => custodySummary({ ...s, gold: 0 });
    assert.deepEqual(noGold(migrated), noGold(original), `${extra.fixture}: items, gems and materials survive`);
    if (extra.goldMayRise) assert.ok(migrated.gold >= original.gold, `${extra.fixture}: gold never falls (${extra.note})`);
    else assert.equal(migrated.gold, original.gold, extra.fixture);
    for (const s of SAVE_HISTORY) if (s.check) assert.ok(s.check(migrated), `${extra.fixture}: v${s.version} fields valid after load`);
    assert.deepEqual(normalizeSave(structuredClone(migrated)), migrated, `${extra.fixture}: migration is idempotent`);
    await saveCharacter(migrated); await flushSaves();
    assert.deepEqual(await loadCharacter(migrated.id), migrated, `${extra.fixture}: save/reload preserves the migrated state`);
  }
});

test('fixtures of newer versions carry the data their version introduced', async () => {
  const v13 = await read('v13-social'), v14 = await read('v14-collection');
  assert.ok(v13.social && v13.social.friends.length > 0 && v13.social.presence === 'hidden');
  assert.ok(v14.collection && Object.keys(v14.collection.looks).length > 0);
  const v15 = await read('v15-nodes');
  assert.ok(v15.skills.nodes && Object.keys(v15.skills.nodes).length > 0);
});

test('legendary rolls of a retired range move to the same place in the current range on load (idempotent, no version bump)', async () => {
  const original = await read('v16-legacy-rolls');
  const migrated = normalizeSave(structuredClone(original));
  const roll = (id: string) => [...migrated.inventory, ...migrated.stash, ...Object.values(migrated.equipment)].find((i) => i?.id === id)!.legendary!;
  assert.deepEqual(roll('oldrain35'), { power: 'rainspindle', value: 175, min: 150, max: 200 }, 'Rainspindle 30–40: 35 → 175');
  assert.deepEqual(roll('oldvane60'), { power: 'weathervane_ring', value: 75, min: 75, max: 105 }, 'Weathervane 60–90: the minimum stays the minimum');
  assert.deepEqual(roll('oldband90'), { power: 'bandolier_belt', value: 105, min: 75, max: 105 }, 'Bandolier 60–90: the maximum stays the maximum');
  assert.deepEqual(roll('oldvane80'), { power: 'weathervane_ring', value: 95, min: 75, max: 105 }, 'rolled in the old range: moves even though 80 lies in the new one');
  assert.deepEqual(roll('oldvane62nr'), { power: 'weathervane_ring', value: 77, min: 75, max: 105 }, 'no stored range, below the current one: rescaled');
  assert.deepEqual(roll('newrain170'), { power: 'rainspindle', value: 170, min: 150, max: 200 }, 'a current roll is left alone');
  assert.deepEqual(roll('sappers35'), { power: 'sappers_pack', value: 35, min: 30, max: 40 }, 'an unchanged range is left alone');
  assert.deepEqual(normalizeSave(structuredClone(migrated)), migrated, 'idempotent');
  assert.equal(migrated.version, SAVE_VERSION, 'loads at the current version (the rescale needs no version of its own)');
});
