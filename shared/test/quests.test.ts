import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS } from '../src/data/quests';
import { validateQuests, validateAdventures } from '../src/questValidation';
import { createCharacter } from '../src/character';
import { questState, writeQuestState, trackedQuest, zoneUnlocked } from '../src/quests';

test('live catalogue references, prerequisites, routes, interaction points and spawns validate',()=>{
  assert.deepEqual(validateQuests(),[]);assert.deepEqual(validateAdventures(),[]);
});
test('authoring rejects cycles, wrong references, duplicate objectives and invalid revisions',()=>{
  const q=structuredClone(QUESTS);
  q[0].requires=['under_spillway'];q[1].steps[0].target='nonexistent';q[2].revision=NaN;
  q[2].steps[1].id=q[2].steps[0].id;
  const errors=validateQuests(q).join('\n');
  assert.match(errors,/prerequisite cycle/);assert.match(errors,/unknown reach target/);assert.match(errors,/invalid revision/);assert.match(errors,/duplicate objective/);
});
test('legacy flags are authoritative and are never duplicated into the new quest record',()=>{
  const save=createCharacter('Legacy','mage',1);
  writeQuestState(save,'silent_wheel',{revision:1,step:2,claimed:false});
  assert.deepEqual(save.rillwake,{revision:1,cart:true,warden:true,ledger:false,claimed:false});
  assert.equal(save.quests,undefined);assert.equal(questState(save,'silent_wheel')!.step,2);
  writeQuestState(save,'silent_wheel',{revision:1,step:3,claimed:true});assert.equal(trackedQuest(save)!.id,'high_water');
  assert(!zoneUnlocked(save,'bracken_sluice'));
  writeQuestState(save,'high_water',{revision:1,step:2,claimed:true});assert(zoneUnlocked(save,'bracken_sluice'));
  assert.equal(trackedQuest(save)!.id,'under_spillway');
});
