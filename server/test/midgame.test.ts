import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { MIDGAME_ADVENTURES } from '../../shared/src/data/midgame';
import { MIDGAME_QUESTS } from '../../shared/src/data/midgameQuests';
import { QUESTS } from '../../shared/src/data/quests';
import { MONSTERS } from '../../shared/src/data/monsters';
import { ZONES } from '../../shared/src/data/zones';
import { contactSpot, questState, writeQuestState, zoneUnlocked, zoneLevelAllowed } from '../../shared/src/quests';
import { xpToNext } from '../../shared/src/progression';
import { storyMainXp, storyXp } from '../../shared/src/storyBudget';
import { planQuestReward, questRewardError } from '../../shared/src/questRewards';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import { validateAdventures, validateQuests } from '../../shared/src/questValidation';
import { World } from '../src/world';
import { Instance } from '../src/sim/instance';
import type { Session } from '../src/net/session';
import { runCommand } from '../src/commands';
import { killMob } from '../src/sim/kills';
import { createMob } from '../src/sim/monsters';
import { bossTick } from '../src/sim/rift';
import { ensureDataDir, saveCharacter, loadCharacter, flushSaves } from '../src/persistence';

assert(process.env.DATA_DIR,'fresh isolated DATA_DIR required');ensureDataDir();

test('six mid-game plans and thirteen quests resolve through shared collision, graph and reward validation',()=>{
  assert.equal(MIDGAME_ADVENTURES.length,6);assert.equal(MIDGAME_QUESTS.length,13);
  assert.deepEqual(validateAdventures(),[]);assert.deepEqual(validateQuests(),[]);
  for(const q of MIDGAME_QUESTS)assert.equal(questRewardError(q),undefined);
});

test('each class earns exactly the Acts II–III story budget from one-time story awards and legacy Act I unlocks the route',async()=>{
  for(const classId of ['warrior','ranger','mage'] as const){
    const save=createCharacter('MidBudget'+classId,classId,97);save.level=20;save.xp=0;
    const last=QUESTS.find(q=>q.id==='last_draw')!;writeQuestState(save,last.id,{revision:last.revision,step:last.steps.length,claimed:true});
    assert(zoneUnlocked(save,'sablefen_causeway'));assert(!zoneUnlocked(save,'saltwind_pans'));
    for(const q of MIDGAME_QUESTS){
      const state={revision:q.revision,step:q.steps.length,claimed:false,...(typeof q.reward==='object'&&q.reward.item?{reward:generateItem(new Rng(97),{ilvl:save.level,classId,rarity:'magic',base:classId==='mage'?'staff':classId==='ranger'?'bow':'sword'})}:{})};
      // A stable test seed needs distinct custody identities across separately reserved rewards.
      if(state.reward)state.reward.id=q.id+'-'+classId;
      writeQuestState(save,q.id,state);const result=planQuestReward(save,q,state);assert(!('error' in result));Object.assign(save,result.save);
      assert('error' in planQuestReward(save,q,questState(save,q.id)!));
      // Quests pay half their span since the balance pass (BALANCE.md); the story gate opens the route at any level.
      if(q.unlocks){assert(zoneUnlocked(save,q.unlocks));assert(zoneLevelAllowed(save,q.unlocks));}
    }
    const budget=MIDGAME_QUESTS.reduce((n,q)=>n+(typeof q.reward==='object'?q.reward.xp??0:0),0);
    let level=20,left=budget;while(left>=xpToNext(level)){left-=xpToNext(level);level++;}
    assert.equal(save.level,level);assert.equal(save.xp,left);assert.equal(save.stats.kills,0);
    const spans=storyMainXp(20,23)+storyMainXp(23,25)+storyMainXp(25,28)+storyMainXp(28,30)+storyXp(30,33)+storyXp(33,35)+storyMainXp(35,38)+storyMainXp(38,40)+storyMainXp(40,43)+storyMainXp(43,45)+storyXp(45,47)+storyXp(47,49)+storyXp(49,50);
    assert.equal(budget,spans,'story quests pay their spans minus the side-story share where a zone has one');
    await saveCharacter(save);await flushSaves();assert(questState((await loadCharacter(save.id))!,'last_transmission')?.claimed);
  }
});

test('real command path completes all13 quests and both private dungeons with physical contacts and no replay reward',async()=>{
  const world=new World();await world.init();
  const save=createCharacter('MidRoute','warrior',97);save.level=20;
  for(const q of QUESTS.filter(q=>q.chapter==='water_road'||q.chapter==='upper_road'))writeQuestState(save,q.id,{revision:q.revision,step:q.steps.length,claimed:true});
  const s={save,derived:computeStats(save),sessionId:save.id,rec:null,entityId:0,homeTown:null,hold:null,
    send(){},sendRaw(){},markDirty(){},saveNow(){},autosave(){},kick(){},shutdown(){},changed(){s.derived=computeStats(save);},
  } as unknown as Session;
  world.login(s,(you,zone)=>({t:'welcome',you,char:save,derived:s.derived,zone,time:Date.now(),world:world.infoFor(s)}));
  const inst=()=>s.rec!.inst as Instance,p=()=>inst().playerById(s.entityId)!;
  const at=(x:number,y:number)=>{Object.assign(p(),{x,y,hp:p().mhp,deadMs:0,invulnMs:1e9});Object.assign(p().mv,{x,y});};
  const near=(spot:{x:number;y:number})=>{
    const point=Array.from({length:16},(_,i)=>({x:spot.x+70*Math.cos(i*Math.PI/8),y:spot.y+70*Math.sin(i*Math.PI/8)})).find(pt=>inst().cw.isFree(pt.x,pt.y,18)&&!inst().cw.segmentBlocked(pt.x,pt.y,spot.x,spot.y));
    assert(point,'free physical approach');at(point.x,point.y);
  };
  const cmd=(op:Parameters<typeof runCommand>[2],args:Record<string,unknown>)=>runCommand(s,world,op,args);
  const travel=(zone:string)=>{const r=cmd('travel',{zone});assert(r.ok,JSON.stringify(r));};
  const go=(zone:string)=>{
    if(inst().map.zone===zone)return;
    if(inst().map.zone!=='hearthmere')travel('hearthmere');
    const wp=inst().map.town!.npcs.find(n=>n.role==='waypoint')!;at(...wp.approach);
    if(ZONES[zone].kind!=='dungeon'){travel(zone);return;}
    const parent=zone==='lockglass_cistern'?'saltwind_pans':'beaconbreak_ward';travel(parent);
    const exit=inst().map.portals.find(e=>e.to===zone)!;near(exit);travel(zone);
  };
  const contact=(zone:string,target:string)=>{go(zone);near(contactSpot(inst().map.adventure,target,save)!);};
  try{
    for(const q of MIDGAME_QUESTS){
      contact(q.start.zone,q.start.target);
      assert(cmd('quest',{action:'accept',quest:q.id,target:q.start.target}).ok,q.id+' accept');
      for(const step of q.steps){
        go(step.zone);
        if(step.kind==='interact'){
          contact(step.zone,step.target);
          // Repairs need the hold (docs/rework/quests/DESIGN.md §6): start, let simulation time pass, finish.
          if(step.hold){assert(cmd('quest',{action:'holdStart',quest:q.id,target:step.target}).ok,q.id+' hold');inst().t+=step.hold;}
          const r=cmd('quest',{action:'inspect',quest:q.id,target:step.target});assert(r.ok,q.id+' '+JSON.stringify(r));
        }else if(step.kind==='kill'){
          const mob=inst().mobs.find(m=>!m.dead&&m.adventureTarget===step.target)!;assert(mob,q.id+' target');near(mob);killMob(inst(),mob,p(),'physical','midgame-fixture');
        }else{
          const stage=inst().map.adventure!.dungeon!.stages.find(st=>st.id===step.target)!;
          contact(step.zone,stage.trigger);const r=cmd('quest',{action:'activate',target:stage.trigger});assert(r.ok,q.id+' '+JSON.stringify(r));
          for(const mob of [...inst().mobs])if(!mob.dead)killMob(inst(),mob,p(),'physical','midgame-fixture');
        }
      }
      assert.equal(questState(save,q.id)?.step,q.steps.length,q.id+' objectives');
      if(q.id==='borrowed_pressure'||q.id==='first_answer'||q.id==='two_voices'){
        const next=inst().map.adventure!.dungeon!.stages[inst().dungeonState()!.stage];contact(inst().map.zone,next.trigger);
        assert(!cmd('quest',{action:'activate',target:next.trigger}).ok,'cannot consume next quest encounter before accepting');
      }
      if(q.id==='lockglass_heart'||q.id==='last_transmission')assert.equal(inst().dungeonState()!.target,q.id==='lockglass_heart'?'archive':'final_record');
      contact(q.finish.zone,q.finish.target);const claim=cmd('quest',{action:'claim',quest:q.id,target:q.finish.target});assert(claim.ok,q.id+' '+JSON.stringify(claim));
      assert(!cmd('quest',{action:'claim',quest:q.id,target:q.finish.target}).ok);
    }
    assert(save.level>20);await saveCharacter(save);await flushSaves();assert(questState((await loadCharacter(save.id))!,'last_transmission')?.claimed);
  }finally{await world.shutdown();}
});

test('cistern and relay bosses switch opposite patterns at the existing30% threshold without changing ordinary bosses',()=>{
  for(const pattern of ['cistern','relay'] as const){
    const inst=new Instance({zoneId:'lockglass_cistern',key:pattern,channel:0,seed:97,theme:'glade',level:30,difficulty:0});
    const save=createCharacter('Phase'+pattern,'mage',97);save.level=35;
    inst.addPlayer({save,derived:computeStats(save),sessionId:pattern,send(){},markDirty(){}});const p=inst.players[0];p.x=1800;p.y=780;
    const m=createMob(inst,MONSTERS[pattern==='cistern'?'cistern_heart':'signal_heart'],30,1730,610,{tier:2,combat:pattern});
    try{
      for(const low of [false,true]){
        m.hp=m.mhp*(low?.29:1);m.boss!.ringMs=0;inst.events.length=0;bossTick(inst,m,p,50);
        const ring=inst.events.some(e=>e.ev.e==='tele'&&e.ev.v==='boss_ring');
        assert.equal(ring,pattern==='cistern'?!low:low);assert.equal(m.boss!.enraged,low);assert.equal(m.boss!.addsMs,Infinity);
      }
    }finally{inst.destroy();}
  }
});
