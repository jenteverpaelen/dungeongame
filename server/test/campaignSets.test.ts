import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, equipItem } from '../../shared/src/character';
import { CAMPAIGN_SETS, campaignSetReward } from '../../shared/src/campaignSets';
import { Rng } from '../../shared/src/math';
import { SETS } from '../../shared/src/data/items';
import { MIDGAME_GIFTS } from '../../shared/src/data/midgameQuests';
import { QUESTS } from '../../shared/src/data/quests';
import { questState, writeQuestState } from '../../shared/src/quests';
import { computeStats } from '../../shared/src/stats';
import { buildCtx } from '../src/sim/playerctx';
import { Instance } from '../src/sim/instance';
import { runCommand } from '../src/commands';
import type { Session } from '../src/net/session';
import type { World } from '../src/world';
import { ensureDataDir, saveCharacter, loadCharacter, flushSaves } from '../src/persistence';
import { validateQuests } from '../../shared/src/questValidation';

assert(process.env.DATA_DIR,'fresh isolated DATA_DIR required');ensureDataDir();

test('first-set pieces are class-correct, distinct, bound, non-Ancient and activate only the intended two-piece skill effect',()=>{
  assert.deepEqual(validateQuests(),[]);
  for(const classId of ['warrior','ranger','mage'] as const){
    const save=createCharacter('FirstSet'+classId,classId,98);save.level=35;
    const rng=new Rng(98),items=[campaignSetReward(rng,classId,'class_set_shoulders',35),campaignSetReward(rng,classId,'class_set_feet',35)];
    const skill=classId==='warrior'?'whirlwind':classId==='ranger'?'sentry':'meteor';
    const before=buildCtx(save).modsOf(skill);const baselineEquipment=structuredClone(save.equipment);
    for(const item of items){assert(item.bound);assert.equal(item.ancient,0);assert.equal(item.set,CAMPAIGN_SETS[classId]);assert.equal(item.ilvl,35);save.inventory[0]=item;assert.equal(equipItem(save,item.id),null);}
    assert.notEqual(items[0].base,items[1].base);const ctx=buildCtx(save),rt=ctx.modsOf(skill);
    assert.equal(ctx.setCount(CAMPAIGN_SETS[classId]),2);
    assert.equal(SETS[CAMPAIGN_SETS[classId]].bonuses.filter(b=>b.count<=2).length,1);
    if(classId==='warrior'){assert(rt.flags.has('dustDevils'));assert(!before.flags.has('dustDevils'));assert(!rt.flags.has('stormDR'));}
    if(classId==='mage'){assert(rt.flags.has('secondMeteor'));assert(!before.flags.has('secondMeteor'));}
    if(classId==='ranger'){assert.equal(rt.mods.maxSummons,(before.mods.maxSummons??0)+1);assert.equal(rt.mods.cooldown,(before.mods.cooldown??0)-30);assert(!rt.flags.has('sentryCasts'));}
    save.equipment=baselineEquipment;assert.equal(buildCtx(save).setCount(CAMPAIGN_SETS[classId]),0);
    for(const reward of ['class_set_shoulders','class_set_feet'] as const)assert.equal(campaignSetReward(rng,classId,reward,70).ancient,0);
  }
});

test('each gift requires its milestone and physical living contact, reserves once, survives reload/full bags, and claims once for every class',async()=>{
  for(const classId of ['warrior','ranger','mage'] as const)for(const q of MIDGAME_GIFTS){
    const save=createCharacter('Gift'+q.id.slice(0,4)+classId,classId,98);save.level=35;
    const inst=new Instance({zoneId:q.start.zone,key:save.id,channel:0,seed:98,theme:'glade',level:35,difficulty:0});
    const s={save,derived:computeStats(save),sessionId:save.id,rec:{inst,kind:inst.kind},pendingEnchant:null,send(){},markDirty(){},changed(){s.derived=computeStats(save);}} as unknown as Session;
    s.entityId=inst.addPlayer(s);const p=inst.playerById(s.entityId)!;p.debugInfiniteHp=true;
    const n=inst.map.adventure!.interactions.find(i=>i.id===q.start.target)!;
    const at=(x:number,y:number)=>{p.x=p.mv.x=x;p.y=p.mv.y=y;};
    const command=(action:string)=>runCommand(s,{} as World,'quest',{action,quest:q.id,target:q.start.target,revision:q.revision,step:q.steps[questState(save,q.id)?.step??0]?.id});
    try{
      at(n.x,n.y+70);assert(!command('accept').ok,'missing milestone');
      const prerequisite=QUESTS.find(d=>d.id===q.requires[0])!;writeQuestState(save,prerequisite.id,{revision:1,step:prerequisite.steps.length,claimed:true});
      at(0,0);assert(!command('accept').ok,'remote');at(n.x,n.y+70);p.deadMs=1;assert(!command('accept').ok,'dead');p.deadMs=0;
      assert(command('accept').ok);assert(command('objectiveTalk').ok);const reserved=structuredClone(questState(save,q.id)!.reward!);assert(reserved?.set);
      assert(!command('objectiveTalk').ok);assert.deepEqual(questState(save,q.id)!.reward,reserved);
      await saveCharacter(save);await flushSaves();const restored=(await loadCharacter(save.id))!;assert.deepEqual(questState(restored,q.id)!.reward,reserved);Object.assign(save,restored);
      save.inventory.fill(save.equipment.mainhand!);const full=structuredClone(save);assert(!command('claim').ok);assert.deepEqual(save,full);
      save.inventory[0]=null;assert(command('claim').ok);assert.deepEqual(save.inventory[0],reserved);assert(!questState(save,q.id)!.reward);assert(!command('claim').ok);
      await saveCharacter(save);await flushSaves();const claimed=(await loadCharacter(save.id))!;assert(questState(claimed,q.id)?.claimed);assert.equal(claimed.inventory.filter(i=>i?.id===reserved.id).length,1);
    }finally{inst.destroy();}
  }
});
