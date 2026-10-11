import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS } from '../src/data/quests';
import { validateQuests, validateAdventures } from '../src/questValidation';
import { createCharacter } from '../src/character';
import { questState, writeQuestState, trackedQuest, zoneUnlocked, validQuestState, questStepText } from '../src/quests';
import { questPoint } from '../src/quests';
import { generateMap } from '../src/mapgen';
import { DIFFICULTIES } from '../src/progression';
import { migrateQuests } from '../src/questMigration';
const Q=(id:string)=>QUESTS.find(q=>q.id===id)!;


test('live catalogue references, prerequisites, routes, interaction points and spawns validate',()=>{
  assert.deepEqual(validateQuests(),[]);assert.deepEqual(validateAdventures(),[]);
});
test('authoring rejects cycles, wrong references, duplicate objectives and invalid revisions',()=>{
  const q=structuredClone(QUESTS),at=(id:string)=>q.find(x=>x.id===id)!;
  at('silent_wheel').requires=['under_spillway'];at('under_spillway').steps[1].target='nonexistent';at('pressure_below').revision=NaN;
  at('stone_road').steps[1].id=at('stone_road').steps[0].id;
  const errors=validateQuests(q).join(' | ');
  assert.match(errors,/prerequisite cycle/);assert.match(errors,/unknown reach target/);assert.match(errors,/invalid revision/);assert.match(errors,/duplicate objective/);
});
test('the C070 Silent Wheel record reads as revision 2, moves into quests on write and migrates on load',()=>{
  const save=createCharacter('Legacy','mage',1);
  save.rillwake={revision:1,cart:true,warden:true,ledger:false,claimed:false};
  assert.deepEqual(questState(save,'silent_wheel'),{revision:2,step:2,claimed:false},'legacy flags read through the migration mapping');
  assert(validQuestState(Q('silent_wheel'),questState(save,'silent_wheel')!));
  writeQuestState(save,'silent_wheel',{revision:2,step:4,claimed:true});
  assert.equal(save.rillwake,undefined,'never duplicated');assert.equal(save.quests!.silent_wheel.step,4);
  assert.equal(trackedQuest(save)!.id,'high_water','the next story step is offered');
  assert(!zoneUnlocked(save,'bracken_sluice'));
  writeQuestState(save,'high_water',{revision:2,step:3,claimed:true});assert(zoneUnlocked(save,'bracken_sluice'));
  assert.equal(trackedQuest(save)!.id,'under_spillway');
  const old=createCharacter('Legacy2','warrior',1);old.rillwake={revision:1,cart:true,warden:true,ledger:true,claimed:false};
  migrateQuests(old);assert.equal(old.rillwake,undefined);assert.deepEqual(old.quests!.silent_wheel,{revision:2,step:3,claimed:false},'ledger found: only the new brake objective remains');
});

test('count authoring and saved partial progress reject unsafe or incompatible values',()=>{
  const q=structuredClone(Q('silent_wheel'));q.id='counter_fixture';q.steps=[{...q.steps[1],target:'road',monsterType:'bog_slime',count:2}];
  assert.deepEqual(validateQuests([q]),[]);
  assert(validQuestState(q,{revision:q.revision,step:0,progress:1,claimed:false}));
  assert.equal(questStepText(q.steps[0],1),'Defeat Siltroot, the Wheelkeeper, in the mill yard (1/2)');
  for(const progress of [-1,2,NaN,Infinity,1.5])assert(!validQuestState(q,{revision:q.revision,step:0,progress,claimed:false}));
  for(const count of [0,-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1])assert(validateQuests([{...q,steps:[{...q.steps[0],count}]}]).some(e=>e.includes('count must')));
  assert(validateQuests([{...q,steps:[{...q.steps[0],monsterType:'missing'}]}]).some(e=>e.includes('invalid monster')));
});

test('wave objectives require an actual authored dungeon stage and one completion',()=>{
  const q=structuredClone(QUESTS.find(q=>q.id==='pressure_below')!);q.requires=[];
  assert.deepEqual(validateQuests([q]),[]);
  q.steps[0].target='missing';assert(validateQuests([q]).some(e=>e.includes('unknown wave target')));
  q.steps[0].target='west';q.steps[0].count=2;assert(validateQuests([q]).some(e=>e.includes('count must be one')));
});

test('delivery requires an exact safe batch and person; rift objectives use existing difficulty and Obelisk guidance',()=>{
  const q=structuredClone(Q('high_water'));q.id='handover_fixture';q.requires=[];delete q.unlocks;
  q.steps=[{id:'deliver',kind:'deliver',zone:'rillwake_crossing',target:'tender',text:'quest.delivery.title',itemBase:'sword',itemRarity:'normal',count:2},
    {id:'rift',kind:'rift',zone:'rift',target:'completion',text:'q.silent_wheel.warden',minDifficulty:1}];
  assert.deepEqual(validateQuests([q]),[]);
  assert(!validQuestState(q,{revision:1,step:0,claimed:false,progress:1}),'no partial delivery batches');
  for(const change of [{itemBase:undefined},{itemRarity:undefined},{target:'cart'},{count:61}])
    assert(validateQuests([{...q,steps:[{...q.steps[0],...change}]}]).length>0);
  for(const minDifficulty of [-1,undefined,NaN,1.5,DIFFICULTIES.length])
    assert(validateQuests([{...q,steps:[{...q.steps[1],minDifficulty}]}]).some(e=>e.includes('minimum difficulty')));
  const town=generateMap('hearthmere',1),point=questPoint(town,q.steps[1]);
  const obelisk=town.town!.npcs.find(n=>n.role==='obelisk')!;assert.deepEqual(point,obelisk);
  const field=generateMap('rillwake_crossing',1);assert.deepEqual(questPoint(field,q.steps[1]),field.portals.find(p=>p.to==='hearthmere'));
});
