import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { QUESTS } from '../../shared/src/data/quests';
import type { QuestDef } from '../../shared/src/questTypes';
import { questCompleted, questState, storyFlag, zoneUnlocked } from '../../shared/src/quests';
import { xpToNext } from '../../shared/src/progression';
import { World } from '../src/world';
import { Instance } from '../src/sim/instance';
import type { Session } from '../src/net/session';
import { runCommand } from '../src/commands';
import { saveCharacter, loadCharacter, flushSaves } from '../src/persistence';
import { killMob } from '../src/sim/kills';
import { questRequest } from '../../shared/src/questRequests';
import { CommandReceipts } from '../src/net/commandReceipts';
import { pack, unpack } from 'msgpackr';

assert(process.env.DATA_DIR,'isolated DATA_DIR required');
const catalogue=QUESTS as QuestDef[];
let sequence=0;
async function fixture() {
  const world=new World();await world.init();
  const add=()=>{
    const save=createCharacter('Chapter'+ ++sequence,'warrior',1);
    const refreshes:boolean[]=[];
    const s={save,derived:computeStats(save),sessionId:save.id,rec:null,entityId:0,homeTown:null,hold:null,pendingEnchant:null,
      send(){},sendRaw(){},markDirty(){},saveNow(){},autosave(){},kick(){},shutdown(){},changed(refresh=true){refreshes.push(refresh);s.derived=computeStats(save);},
    } as unknown as Session;
    const login=()=>world.login(s,(you,zone)=>({t:'welcome',you,char:save,derived:s.derived,zone,time:Date.now(),world:world.infoFor(s)}));
    login();
    const inst=()=>s.rec!.inst as Instance,player=()=>inst().playerById(s.entityId)!;
    const at=(x:number,y:number)=>{const p=player();p.x=p.mv.x=x;p.y=p.mv.y=y;p.hp=p.mhp;p.deadMs=0;};
    const near=(id:string)=>{const a=inst().map.adventure?.interactions.find(n=>n.id===id),n=inst().map.town?.npcs.find(n=>n.id===id);if(n)at(...n.approach);else if(a)at(a.x,a.y+65);else throw Error('Unknown test contact');};
    const cmd=(op:Parameters<typeof runCommand>[2],args:Record<string,unknown>={})=>runCommand(s,world,op,args);
    const quest=(q:QuestDef,action:string,extra:Record<string,unknown>={})=>cmd('quest',{quest:q.id,action,target:q.start.target,cycle:questState(save,q.id)?.cycle??0,...extra});
    const toField=()=>{const wp=inst().map.town!.npcs.find(n=>n.role==='waypoint')!;near(wp.id);assert(cmd('travel',{zone:'rillwake_crossing'}).ok);near('tender');};
    return {save,s,inst,player,at,near,cmd,quest,toField,refreshes,login};
  };
  return {world,add,...add()};
}
function definition(id:string):QuestDef {
  return {...structuredClone(QUESTS[1]),id,requires:[],unlocks:undefined,chapter:undefined,steps:[
    {id:'conversation',kind:'talk',zone:'rillwake_crossing',target:'tender',text:'quest.dialogue.workers.ask'},
  ]};
}

test('real client quest payloads survive MessagePack and receipt validation before acceptance, remote tracking and final claim',()=>{
  const q=definition('wire_fixture'),receipts=new CommandReceipts();let calls=0,id=0;
  for(const [state,target,action] of [[undefined,'tender','accept'],[undefined,undefined,'track'],[{revision:1,step:1,claimed:false},'tender','claim']] as const) {
    const args=unpack(pack(questRequest(q,state,target,action))),commandId=++id;
    const exec=()=>{calls++;return {t:'res' as const,id:commandId,ok:true};};
    assert(receipts.execute(commandId,'quest',args,exec).ok);assert(receipts.execute(commandId,'quest',args,exec).ok);
  }
  assert.equal(calls,3,'same wire command cannot execute twice');
  assert.equal(questRequest({...q,repeat:'on_return'},{revision:1,step:1,claimed:true},'tender','accept').cycle,1);
});

test('explicit conversations, reward bundle, repeat tokens, permanent flags and save reload form one authoritative lifecycle',async()=>{
  const f=await fixture(),q=definition('chapter_repeat');
  q.repeat='on_return';q.grantsFlags=['fixture_repaired'];q.reward={xp:xpToNext(1),gold:7,unlocks:['ashen_hollow']};catalogue.push(q);
  try {
    f.toField();assert(f.quest(q,'accept').ok);
    assert(f.quest(q,'talk').ok);assert.equal(questState(f.save,q.id)!.step,0,'opening the dialogue is not objective completion');
    const talk={target:'tender',step:'conversation',revision:1};
    for(const extra of [{step:'old'},{revision:2},{cycle:-1},{target:'cart'}])assert(!f.quest(q,'objectiveTalk',{...talk,...extra}).ok);
    f.at(0,0);assert(!f.quest(q,'objectiveTalk',talk).ok);f.near('tender');
    assert(f.quest(q,'objectiveTalk',talk).ok);assert(!f.quest(q,'objectiveTalk',talk).ok);
    assert(!storyFlag(f.save,'fixture_repaired'));assert(!zoneUnlocked(f.save,'ashen_hollow'));
    await saveCharacter(f.save);await flushSaves();assert.equal((await loadCharacter(f.save.id))!.quests![q.id].step,1);
    assert(f.quest(q,'claim').ok);assert.equal(f.save.level,2);assert.equal(f.save.gold,7);assert(f.refreshes.includes(true));
    assert(storyFlag(f.save,'fixture_repaired'));assert(zoneUnlocked(f.save,'ashen_hollow'));
    assert(!f.quest(q,'claim').ok);assert(!f.quest(q,'accept',{cycle:0}).ok,'old acceptance cannot start a new cycle');
    assert(f.quest(q,'accept',{cycle:1}).ok);assert(questCompleted(f.save,q.id));assert(storyFlag(f.save,'fixture_repaired'));
    const before=structuredClone(f.save);
    for(const action of ['claim','objectiveTalk','accept','track'])assert(!f.quest(q,action,{...talk,cycle:0}).ok);
    assert.deepEqual(f.save,before);
    await saveCharacter(f.save);await flushSaves();Object.assign(f.save,(await loadCharacter(f.save.id))!);
    assert(f.quest(q,'objectiveTalk',talk).ok);assert(f.quest(q,'claim').ok);assert.equal(f.save.gold,14);
    assert.equal(questState(f.save,q.id)!.completions,2);assert.equal(Object.keys(f.save.quests!).length,1);
  }finally{catalogue.splice(catalogue.indexOf(q),1);await f.world.shutdown();}
});

test('full bag, overflow and duplicate item ownership cannot partially grant a mixed reward',async()=>{
  const f=await fixture(),q=definition('chapter_bundle');q.reward={xp:xpToNext(1),gold:7,item:'magic_weapon'};catalogue.push(q);
  try {
    f.toField();assert(f.quest(q,'accept').ok);assert(f.quest(q,'objectiveTalk',{step:'conversation',revision:1}).ok);
    const reward=structuredClone(questState(f.save,q.id)!.reward!);assert(reward);
    f.save.gold=Number.MAX_SAFE_INTEGER;
    const rejected=()=>{const before=structuredClone(f.save);assert(!f.quest(q,'claim').ok);assert.deepEqual(f.save,before);};
    rejected();f.save.gold=0;
    f.save.inventory=f.save.inventory.map((_,i)=>({...reward,id:'full-'+i}));rejected();
    f.save.inventory[0]=null;f.save.stash[0]=structuredClone(reward);rejected();f.save.stash[0]=null;
    assert(f.quest(q,'claim').ok);assert.equal(f.save.gold,7);assert.equal(f.save.level,2);
    assert.deepEqual(f.save.inventory[0],reward);assert.equal(questState(f.save,q.id)!.reward,undefined,'no second reward copy in completed history');
    await saveCharacter(f.save);await flushSaves();Object.assign(f.save,(await loadCharacter(f.save.id))!);rejected();
  }finally{catalogue.splice(catalogue.indexOf(q),1);await f.world.shutdown();}
});

test('four clients: family credit, personal kills, late acceptance, disconnect and rejoin never award an old death',async()=>{
  const f=await fixture(),q=definition('chapter_family'),personal=definition('chapter_personal');
  q.steps=[{id:'slimes',kind:'kill',zone:'rillwake_crossing',target:'road',monsterFamily:'slime',count:2,text:'quest.wheel.warden'}];
  personal.steps=[{...q.steps[0],credit:'killer'}];catalogue.push(q,personal);
  try {
    const heroes=[f,f.add(),f.add(),f.add()];
    for(const h of heroes){h.toField();assert(h.quest(personal,'accept').ok);}
    for(const h of [heroes[0],heroes[2],heroes[3]])assert(h.quest(q,'accept').ok);
    const mobs=f.inst().mobs.filter(m=>m.adventureSite==='road'&&m.def.family==='slime');assert(mobs.length>=3);
    for(const h of heroes)h.at(mobs[0].x,mobs[0].y+40);
    heroes[2].player().deadMs=1000;heroes[2].player().hp=0;
    f.world.logout(heroes[3].s);
    killMob(f.inst(),mobs[0],f.player(),'physical','chapter-fixture');
    assert.equal(questState(f.save,q.id)!.progress,1);assert.equal(questState(heroes[1].save,q.id),undefined);
    assert.equal(questState(heroes[2].save,q.id)!.progress??0,0);assert.equal(questState(heroes[3].save,q.id)!.progress??0,0);
    assert.deepEqual(heroes.map(h=>questState(h.save,personal.id)!.progress??0),[1,0,0,0]);
    heroes[3].login();heroes[3].toField();heroes[1].near('tender');assert(heroes[1].quest(q,'accept').ok);
    killMob(f.inst(),mobs[0],f.player(),'physical','old-death');
    assert.equal(questState(heroes[1].save,q.id)!.progress??0,0);assert.equal(questState(heroes[3].save,q.id)!.progress??0,0);
    for(const h of heroes)h.at(mobs[1].x,mobs[1].y+40);
    killMob(f.inst(),mobs[1],heroes[1].player(),'physical','next-death');
    assert.deepEqual(heroes.map(h=>questState(h.save,q.id)!.step),[1,0,0,0]);
    assert.deepEqual(heroes.map(h=>questState(h.save,q.id)!.progress??0),[0,1,1,1]);
    assert.deepEqual(heroes.map(h=>questState(h.save,personal.id)!.progress??0),[1,1,0,0]);
  }finally{catalogue.splice(catalogue.indexOf(q),1);catalogue.splice(catalogue.indexOf(personal),1);await f.world.shutdown();}
});

test('town NPC conversations use exact physical identity and line of sight without invoking a service',async()=>{
  const f=await fixture(),q=definition('chapter_town');
  const smith=f.inst().map.town!.npcs.find(n=>n.role==='blacksmith')!,mystic=f.inst().map.town!.npcs.find(n=>n.role==='mystic')!;
  q.start=q.finish={zone:'hearthmere',target:smith.id};q.steps=[{...q.steps[0],zone:'hearthmere',target:mystic.id}];catalogue.push(q);
  try {
    assert(!f.quest(q,'accept').ok);f.near(smith.id);assert(f.quest(q,'accept').ok);
    const args={target:mystic.id,step:'conversation',revision:1};assert(!f.quest(q,'objectiveTalk',args).ok);
    f.near(mystic.id);assert(f.quest(q,'objectiveTalk',args).ok);assert(!f.quest(q,'claim').ok);
    f.near(smith.id);assert(f.quest(q,'claim').ok);
  }finally{catalogue.splice(catalogue.indexOf(q),1);await f.world.shutdown();}
});
