import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import type { CharacterSave } from '../../shared/src/types';
import { QUESTS } from '../../shared/src/data/quests';
import { questState, questStatus, validQuestState } from '../../shared/src/quests';
import { migrateQuests, RETIRED_CONTRACTS } from '../../shared/src/questMigration';
import { normalizeSave, saveCharacter, loadCharacter, flushSaves } from '../src/persistence';

assert(process.env.DATA_DIR, 'isolated test DATA_DIR required');
const fixture = async (name: string): Promise<CharacterSave> => JSON.parse(await fs.readFile(new URL(`./fixtures/saves/${name}.json`, import.meta.url), 'utf8'));

test('golden pre-rework save: finished objectives stay finished, ready stays ready, contracts retire (paid if finished), nothing is stuck', async () => {
  const original = await fixture('v14-pre-quest-rework');
  const save = normalizeSave(structuredClone(original));
  const q = (id: string) => save.quests![id];
  // The C070 record moves into quests; the ledger was found, so only the new brake repair remains; the reserved weapon survives.
  assert.equal(save.rillwake, undefined);
  assert.deepEqual(q('silent_wheel'), { revision: 2, step: 3, claimed: false, reward: original.rillwake!.reward });
  assert.deepEqual(q('high_water'), { revision: 2, step: 0, claimed: false }, 'the ridge reach was folded into the overlook objectives');
  assert.deepEqual(q('lost_survey'), { revision: 2, step: 0, claimed: false, parts: 1 }, 'the camp counts as one of the two records');
  assert.equal(q('under_spillway').step, 4, 'ready to turn in stays ready'); assert.deepEqual(q('under_spillway').reward, original.quests!.under_spillway.reward);
  assert.equal(q('stone_road').step, 3); assert.equal(q('silt_gears').step, 3, 'the added cogs never block a later step');
  assert.deepEqual(q('true_measure'), { revision: 2, step: 0, claimed: false, parts: 1 });
  assert.equal(q('mera_ledger').step, 2); assert.equal(q('tallis_flags').step, 2, 'the added flag puzzle is skipped for an old post reading');
  assert.equal(q('salt_bound').step, 3, 'finished objectives stay finished');
  assert.deepEqual(q('last_draw'), { revision: 2, step: 4, claimed: true, completions: 1 });
  assert.deepEqual(q('future_fixture'), original.quests!.future_fixture, 'unknown future records are retained');
  for (const id of Object.keys(RETIRED_CONTRACTS)) assert.equal(q(id), undefined, id + ' retired');
  assert.equal(save.gold, original.gold + RETIRED_CONTRACTS.contract_road.gold, 'only the finished, unclaimed contract is paid');
  assert.equal(save.trackedQuest, undefined, 'a retired tracked quest is dropped');
  for (const def of QUESTS) { const s = questState(save, def.id); if (s) { assert(validQuestState(def, s), def.id + ' valid after migration'); assert.notEqual(questStatus(save, def), 'unavailable', def.id); } }
  assert.deepEqual(normalizeSave(structuredClone(save)), save, 'migration is idempotent');
  assert.deepEqual(migrateQuests(structuredClone(save)), [], 'a migrated save has nothing left to migrate');
  await saveCharacter(save); await flushSaves(); assert.deepEqual(await loadCharacter(save.id), save, 'save and reload keep the migrated state');
});

test('older fixtures with quest history migrate to the current revisions and keep unknown records', async () => {
  for (const name of ['v6-quest-history', 'v7-onboarding', 'v8-merchant', 'v9-merchant', 'v10-economy', 'v11-commands', 'v12-passives']) {
    const original = await fixture(name), save = normalizeSave(structuredClone(original));
    assert.deepEqual(save.quests!.high_water, { revision: 2, step: 3, claimed: true, completions: 1 }, name);
    assert.deepEqual(save.quests!.future_fixture, original.quests!.future_fixture, name);
  }
});
