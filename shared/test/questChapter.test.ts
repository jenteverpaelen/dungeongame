import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS } from '../src/data/quests';
import { DIALOGUES } from '../src/data/dialogues';
import { LORE } from '../src/data/story';
import { createCharacter } from '../src/character';
import { questMarker, questStatus, loreAvailable, validQuestState, writeQuestState, questCompleted, trackedQuest } from '../src/quests';
import { validateQuests } from '../src/questValidation';
import { validateDialogues, validateStoryCatalogue } from '../src/questAuthoring';
import { MAX_QUEST_XP, questRewardError } from '../src/questRewards';
import { validateAdventureReachability } from '../src/adventureReachability';
import { loadAdventure } from '../src/adventure';
const Q=(id:string)=>QUESTS.find(q=>q.id===id)!;


test('authoring rejects self-locked worlds, missing/reciprocal flags, incompatible families and unsupported rewards',()=>{
  const defs=structuredClone(QUESTS);
  defs.find(x=>x.id==='high_water')!.start={zone:'bracken_sluice',target:'floodgate'};
  assert(validateQuests(defs).some(e=>e.includes('unreachable quest')));
  const q={...structuredClone(Q('high_water')),id:'flags_a',requires:[],unlocks:undefined,grantsFlags:['a'],requiresFlags:['b']};
  const other={...structuredClone(q),id:'flags_b',grantsFlags:['b'],requiresFlags:['a']};
  assert.equal(validateQuests([q,other]).filter(e=>e.includes('unreachable quest')).length,2);
  assert(validateQuests([q]).some(e=>e.includes('unknown story flag')));
  const kill={...structuredClone(Q('silent_wheel')),id:'family_fixture',steps:[{...Q('silent_wheel').steps[1],monsterFamily:'slime' as const,monsterType:'gloomshroom'}]};
  assert(validateQuests([kill]).some(e=>e.includes('unknown kill target')));
  for(const reward of [{xp:-1},{xp:NaN},{xp:MAX_QUEST_XP+1},{gold:Infinity},{gold:.5},{item:'unknown'},{unknown:1},null])
    assert(questRewardError({...q,reward} as any),JSON.stringify(reward));
  assert(validateQuests([{...Q('silent_wheel'),repeat:'on_return'}]).some(e=>e.includes('legacy quest cannot repeat')));
  assert.deepEqual(validateStoryCatalogue(),[]);
});

test('conditional dialogue has no unknown, orphaned or inescapable branches',()=>{
  assert.deepEqual(validateDialogues(),[]);
  const defs=structuredClone(DIALOGUES),d=defs['rillwake_crossing/tender'];
  d.nodes.workers.choices=[];assert.deepEqual(validateDialogues(defs),[],'terminal readings are allowed');
  d.nodes.workers.choices=[{label:'quest.dialogue.back',to:'workers'}];assert(validateDialogues(defs).some(e=>e.includes('no unconditional exit')));
  d.nodes.workers.choices=[{label:'quest.dialogue.back',to:'greeting',when:['mill_names_recovered']}];assert(validateDialogues(defs).some(e=>e.includes('no unconditional exit')));
  d.nodes.orphan={text:'quest.dialogue.cart',choices:[]};assert(validateDialogues(defs).some(e=>e.includes('unreachable dialogue node')));
  d.nodes.greeting.choices.push({label:'quest.dialogue.back',to:'missing',when:['missing']});
  assert(validateDialogues(defs).some(e=>e.includes('unknown dialogue destination')));assert(validateDialogues(defs).some(e=>e.includes('unknown dialogue condition')));
});

test('bounded history, derived readings and marker priority cover locked, offered, active, ready and completed states',()=>{
  const save=createCharacter('StoryFixture','mage',1),q=Q('silent_wheel');
  assert.equal(questStatus(save,q),'available');assert.equal(questStatus(save,Q('high_water')),'locked');
  assert.equal(questStatus(save,Q('first_road')),'locked','the tutorial quest needs a valid introduction record');
  assert.equal(questMarker(save,q.start.zone,q.start.target),'!');assert.equal(LORE.filter(l=>loreAvailable(save,l)).length,0);
  writeQuestState(save,q.id,{revision:1,step:1,claimed:false});
  const cart=LORE.find(l=>l.id==='cart_tracks')!,ledger=LORE.find(l=>l.id==='mill_ledger')!;
  assert.equal(questStatus(save,q),'active');assert(loreAvailable(save,cart));assert(!loreAvailable(save,ledger));
  writeQuestState(save,q.id,{revision:1,step:3,claimed:false});assert.equal(questMarker(save,q.start.zone,q.start.target),'?');
  writeQuestState(save,q.id,{revision:1,step:3,claimed:true});assert.equal(questStatus(save,q),'complete');
  assert.equal(questMarker(save,q.start.zone,q.start.target),'!','next offer replaces the completed marker');
  const repeat={...structuredClone(Q('high_water')),id:'repeat_validation',repeat:'on_return' as const,requires:[],unlocks:undefined};
  const catalogue=QUESTS as typeof repeat[];catalogue.push(repeat);
  try {
    writeQuestState(save,repeat.id,{revision:1,step:0,cycle:1,completions:1,claimed:false});save.trackedQuest=repeat.id;
    assert(questCompleted(save,repeat.id));assert.equal(trackedQuest(save)?.id,repeat.id,'repeated activity remains trackable');
    for(const change of [{cycle:-1},{completions:2},{cycle:Number.MAX_SAFE_INTEGER+1},{claimed:true},{progress:1}])
      assert(!validQuestState(repeat,{revision:1,step:0,cycle:1,completions:1,claimed:false,...change}));
  }finally{catalogue.splice(catalogue.indexOf(repeat),1);}
});

test('physical reachability detects a disconnected contact despite a clear local approach',()=>{
  const map=loadAdventure('rillwake_crossing',1);
  // Deliberately place an interaction outside authored ground. The live catalogue uses its own real routes.
  map.adventure!.interactions.push({id:'unreachable_fixture',name:'Fixture',x:0,y:0,radius:64,kind:'person'});
  assert(validateAdventureReachability(map).some(e=>e.includes('unreachable_fixture')));
});
