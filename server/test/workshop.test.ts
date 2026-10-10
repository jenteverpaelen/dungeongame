import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter} from '../../shared/src/character';
import {WORKSHOP_QUESTS} from '../../shared/src/data/workshopQuests';
import {QUESTS} from '../../shared/src/data/quests';
import {questState,writeQuestState} from '../../shared/src/quests';
import {planQuestReward,questRewardError} from '../../shared/src/questRewards';
import {cubeUnlocked} from '../../shared/src/cube';
import {validateQuests} from '../../shared/src/questValidation';
import {Instance} from '../src/sim/instance';
import {computeStats} from '../../shared/src/stats';
import {runCommand} from '../src/commands';
import type {Session} from '../src/net/session';
import type {World} from '../src/world';
import {ensureDataDir,saveCharacter,loadCharacter,flushSaves} from '../src/persistence';
assert(process.env.DATA_DIR,'isolated DATA_DIR required');ensureDataDir();

test('training is a bounded one-time floor, retains XP and higher levels, never pays recipe costs',()=>{
  assert.deepEqual(validateQuests(),[]);
  const save=createCharacter('WorkshopMath','mage',99);save.cube.xp=37;
  const wallet=structuredClone({gold:save.gold,materials:save.materials,inventory:save.inventory});
  for(const q of WORKSHOP_QUESTS){
    const plan=planQuestReward(save,q,{revision:1,step:1,claimed:false});assert(!('error' in plan));
    Object.assign(save,plan.save);assert.equal(save.cube.xp,37);
    assert.equal(save.cube.level,(q.reward as {cubeLevel:number}).cubeLevel);
    assert.deepEqual({gold:save.gold,materials:save.materials,inventory:save.inventory},wallet);
    assert('error' in planQuestReward(save,q,questState(save,q.id)!));
  }
  assert(cubeUnlocked(save,'extract'));assert(!cubeUnlocked(save,'reforge'));assert(!cubeUnlocked(save,'socket'));
  const q=WORKSHOP_QUESTS[0];save.cube={...save.cube,level:9,xp:41};
  const veteran=planQuestReward(save,q,{revision:1,step:1,claimed:false});assert(!('error' in veteran));assert.deepEqual(veteran.save.cube,save.cube);
  for(const cubeLevel of [0,1,7,NaN,2.5])assert(questRewardError({...q,reward:{cubeLevel}}));
  assert(questRewardError({...q,repeat:'on_return'}));
});

test('each lesson checks story, contact, living proximity, one claim and reload; normal service costs remain enforced',async()=>{
  const save=createCharacter('WorkshopFlow','warrior',99);save.level=50;
  const inst=new Instance({zoneId:'hearthmere',key:'workshop',channel:0,seed:99,theme:'town'});
  const s={save,derived:computeStats(save),sessionId:save.id,rec:{inst,kind:'town'},pendingEnchant:null,send(){},markDirty(){},changed(){s.derived=computeStats(save);}} as unknown as Session;
  s.entityId=inst.addPlayer(s);const p=inst.playerById(s.entityId)!;p.debugInfiniteHp=true;
  const at=(x:number,y:number)=>{p.x=p.mv.x=x;p.y=p.mv.y=y;};
  try{
    for(const q of WORKSHOP_QUESTS){
      const n=inst.map.town!.npcs.find(n=>n.id===q.start.target)!;
      const cmd=(action:string,target=q.start.target)=>runCommand(s,{} as World,'quest',{action,quest:q.id,target,revision:1,step:'lesson'});
      at(...n.approach);assert(!cmd('accept').ok,'story not yet complete');
      const story=QUESTS.find(d=>d.id===q.requires[0])!;writeQuestState(save,story.id,{revision:1,step:story.steps.length,claimed:true});
      at(0,0);assert(!cmd('accept').ok);at(...n.approach);p.deadMs=1;assert(!cmd('accept').ok);p.deadMs=0;
      assert(cmd('accept').ok);assert(!cmd('objectiveTalk','wrong').ok);assert(!cmd('claim').ok);
      assert(cmd('objectiveTalk').ok);const xp=save.cube.xp;assert(cmd('claim').ok);assert(!cmd('claim').ok);assert.equal(save.cube.xp,xp);
      await saveCharacter(save);await flushSaves();const loaded=(await loadCharacter(save.id))!;
      assert(questState(loaded,q.id)?.claimed);assert.deepEqual(loaded.cube,save.cube);Object.assign(save,loaded);
    }
    const cube=inst.map.town!.npcs.find(n=>n.role==='cube')!;at(...cube.approach);
    const before=structuredClone(save);assert(!runCommand(s,{} as World,'extract',{itemId:save.equipment.mainhand!.id}).ok);assert.deepEqual(save,before);
  }finally{inst.destroy();}
});
