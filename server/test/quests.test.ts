import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { questState, zoneUnlocked } from '../../shared/src/quests';
import type { ClassId } from '../../shared/src/types';
import { World } from '../src/world';
import { Instance } from '../src/sim/instance';
import { runCommand } from '../src/commands';
import { creditQuestReach } from '../src/quests';
import { killMob } from '../src/sim/kills';
import { loadCharacter, saveCharacter, flushSaves } from '../src/persistence';
import type { Session } from '../src/net/session';
import { QUESTS } from '../../shared/src/data/quests';
import type { QuestDef } from '../../shared/src/questTypes';
import { spawnLoot, updateLoot } from '../src/sim/loot';
import type { Mob } from '../src/sim/types';

assert(process.env.DATA_DIR,'isolated test DATA_DIR required');
let sequence=0;
async function fixture(cls:ClassId='warrior') {
  const world=new World();await world.init();
  const add=()=>{
    const save=createCharacter(`Quest${++sequence}`,cls,1);
    const s={save,derived:computeStats(save),sessionId:save.id,rec:null,entityId:0,homeTown:null,hold:null,
      send(){},sendRaw(){},markDirty(){},saveNow(){},autosave(){},kick(){},shutdown(){},changed(){s.derived=computeStats(save);},
    } as unknown as Session;
    world.login(s,(you,zone)=>({t:'welcome',you,char:save,derived:s.derived,zone,time:Date.now(),world:world.infoFor(s)}));
    const inst=()=>s.rec!.inst as Instance;
    const player=()=>inst().playerById(s.entityId)!;
    const at=(x:number,y:number)=>{const p=player();p.x=p.mv.x=x;p.y=p.mv.y=y;p.hp=p.mhp;p.deadMs=0;};
    const near=(id:string)=>{const spot=inst().map.adventure!.interactions.find(i=>i.id===id)!;at(spot.x,spot.y+65);};
    const quest=(quest:string,action:string,target='tender')=>runCommand(s,world,'quest',{quest,action,target});
    const travel=(zone:string)=>runCommand(s,world,'travel',{zone});
    const waypoint=()=>{const wp=inst().map.town!.npcs.find(n=>n.role==='waypoint')!;at(...wp.approach);};
    const completedWheel=()=>{save.rillwake={revision:1,cart:true,warden:true,ledger:true,claimed:true};};
    return {s,save,inst,player,at,near,quest,travel,waypoint,completedWheel};
  };
  return {world,add,...add()};
}

test('counted server events retain partial progress, ignore failed actions and count each successful action once',async()=>{
  const f=await fixture('mage'),catalog=QUESTS as QuestDef[];
  const q:QuestDef={...structuredClone(QUESTS[1]),id:'adapter_fixture',requires:[],unlocks:undefined,steps:[
    {id:'kills',kind:'kill',zone:'rillwake_crossing',target:'road',monsterType:'bog_slime',count:2,text:'quest.wheel.warden'},
    {id:'loot',kind:'collect',zone:'rillwake_crossing',target:'road',itemBase:f.save.equipment.mainhand!.base,count:2,text:'quest.wheel.ledger'},
    {id:'service',kind:'service',zone:'hearthmere',target:'blacksmith',serviceOp:'salvage',count:2,text:'quest.journal.return'},
  ]};
  catalog.push(q);
  try {
    f.waypoint();assert(f.travel('rillwake_crossing').ok);f.near('tender');assert(f.quest(q.id,'accept').ok);
    const state=()=>questState(f.save,q.id)!;
    const kill=(m:Mob)=>{f.at(m.x,m.y+40);killMob(f.inst(),m,f.player(),'physical','adapter-fixture');};
    const road=f.inst().mobs.filter(m=>m.adventureSite==='road');
    kill(road.find(m=>m.def.id==='gloomshroom')!);assert.equal(state().progress??0,0);
    const slimes=road.filter(m=>m.def.id==='bog_slime');slimes[0].noReward=true;kill(slimes[0]);assert.equal(state().progress??0,0);
    kill(slimes[1]);assert.equal(state().progress,1);kill(slimes[1]);assert.equal(state().progress,1);
    await saveCharacter(f.save);await flushSaves();assert.equal((await loadCharacter(f.save.id))!.quests![q.id].progress,1);
    kill(slimes[2]);assert.equal(state().step,1);assert.equal(state().progress,0);
    f.player().loot.clear(); // Start the acquisition case with only its deliberately owned fixture drops.
    const item={...structuredClone(f.save.equipment.mainhand!),id:'pickup-one'};
    f.save.inventory=f.save.inventory.map((_,i)=>({...item,id:`full-${i}`}));
    const loot=spawnLoot(f.inst(),f.player(),{type:'item',item},f.player().x,f.player().y,false);loot.armMs=0;
    updateLoot(f.inst(),f.player(),50);assert.equal(state().progress,0);assert(f.player().loot.has(loot));
    f.save.inventory[0]=null;updateLoot(f.inst(),f.player(),50);assert.equal(state().progress,1);
    updateLoot(f.inst(),f.player(),50);assert.equal(state().progress,1);
    f.save.inventory[1]=null;const second=spawnLoot(f.inst(),f.player(),{type:'item',item:{...item,id:'pickup-two'}},f.player().x,f.player().y,false);second.armMs=0;
    updateLoot(f.inst(),f.player(),50);assert.equal(state().step,2);assert.equal(state().progress,0);
    assert(f.travel('hearthmere').ok);f.at(0,0);
    assert(!runCommand(f.s,f.world,'salvage',{itemId:'pickup-one'}).ok);assert.equal(state().progress,0);
    const smith=f.inst().map.town!.npcs.find(n=>n.role==='blacksmith')!;
    // Bind the fixture to the actual authored NPC ID, not a copied name assumption.
    q.steps[2].target=smith.id;f.at(...smith.approach);
    assert(!runCommand(f.s,f.world,'salvage',{itemId:'missing'}).ok);assert.equal(state().progress,0);
    assert(runCommand(f.s,f.world,'salvage',{itemId:'pickup-one'}).ok);assert.equal(state().progress,1);
    assert(!runCommand(f.s,f.world,'salvage',{itemId:'pickup-one'}).ok);assert.equal(state().progress,1);
    assert(runCommand(f.s,f.world,'salvage',{itemId:'pickup-two'}).ok);assert.equal(state().step,3);assert.equal(state().progress,0);
  } finally {catalog.splice(catalog.indexOf(q),1);await f.world.shutdown();}
});

for(const cls of ['warrior','mage','ranger'] as const)test(`${cls}: connected quests, ordered authoritative events, unlock travel, full-bag retry and persistence`,async()=>{
  const f=await fixture(cls);
  const success=(r:{ok:boolean;err?:string})=>assert(r.ok,r.err??'command must succeed');
  try {
    f.waypoint();assert(!f.travel('bracken_sluice').ok,'waypoint cannot skip prerequisites');
    success(f.travel('rillwake_crossing'));f.near('tender');
    assert(!f.quest('high_water','accept').ok,'previous return required');
    f.completedWheel();success(f.quest('high_water','accept'));
    f.near('survey');assert(!f.quest('high_water','inspect','survey').ok,'ordered objectives');
    f.at(1160,1400);f.player().deadMs=1;creditQuestReach(f.inst(),f.player());assert.equal(questState(f.save,'high_water')!.step,0);
    f.player().deadMs=0;f.inst().tick();assert.equal(questState(f.save,'high_water')!.step,1,'server movement/position drives reach');
    assert(!f.quest('high_water','reach','old_ridge').ok,'no client credit endpoint');
    f.near('survey');success(f.quest('high_water','inspect','survey'));success(f.quest('high_water','inspect','survey'));
    f.at(3120,780);assert(!f.travel('bracken_sluice').ok,'world objective alone does not claim the passage');
    assert(!f.quest('high_water','claim').ok,'remote claim');
    f.near('tender');success(f.quest('high_water','claim'));assert(zoneUnlocked(f.save,'bracken_sluice'));
    assert(!f.quest('high_water','claim').ok,'cannot claim twice');
    success(f.quest('under_spillway','accept'));assert(!f.travel('bracken_sluice').ok,'must walk to connecting portal');
    const home=f.s.homeTown;f.at(3120,780);success(f.travel('bracken_sluice'));assert.equal(f.s.homeTown,home,'field travel preserves home town');
    f.near('floodgate');assert(!f.quest('under_spillway','inspect','floodgate').ok);
    f.at(2540,1650);f.inst().tick();assert.equal(questState(f.save,'under_spillway')!.step,1);
    const boss=f.inst().mobs.find(m=>m.adventureTarget==='keeper')!;
    assert(boss.boss);assert.equal(boss.tier,2,'existing rare reward tier');assert.equal(boss.boss.addsMs,Infinity,'no reward-bearing summons');
    f.at(boss.x,boss.y+80);killMob(f.inst(),boss,f.player(),'physical','quest-test');assert.equal(questState(f.save,'under_spillway')!.step,2);
    f.near('floodgate');success(f.quest('under_spillway','inspect','floodgate'));
    const reserved=structuredClone(questState(f.save,'under_spillway')!.reward!);assert(reserved);
    success(f.quest('under_spillway','inspect','floodgate'));assert.deepEqual(questState(f.save,'under_spillway')!.reward,reserved);
    assert(!f.travel('rillwake_crossing').ok,'remote return portal');f.at(670,2760);success(f.travel('rillwake_crossing'));
    f.near('tender');f.save.inventory.fill({...reserved,id:'full-bag-fixture'});const before=JSON.stringify(f.save);
    assert(!f.quest('under_spillway','claim').ok);assert.equal(JSON.stringify(f.save),before);
    f.save.inventory[0]=null;success(f.quest('under_spillway','claim'));assert(!f.quest('under_spillway','claim').ok);
    assert.equal(f.save.inventory.filter(i=>i?.id===reserved.id).length,1);assert.deepEqual(f.save.inventory[0],reserved);
    await saveCharacter(f.save);await flushSaves();const loaded=await loadCharacter(f.save.id);
    assert.deepEqual(loaded!.quests,f.save.quests);assert.deepEqual(loaded!.rillwake,f.save.rillwake);assert(zoneUnlocked(loaded!,'bracken_sluice'));
  }finally{await f.world.shutdown();}
});

test('four clients: only accepted, local and living witnesses receive the authored keeper credit',async()=>{
  const f=await fixture();
  try {
    const heroes=[f,f.add(),f.add(),f.add()];
    for(const h of heroes) {
      h.completedWheel();h.save.quests={high_water:{revision:1,step:2,claimed:true},under_spillway:{revision:1,step:1,claimed:false}};
      h.waypoint();assert(h.travel('bracken_sluice').ok);h.at(2600,1280);
    }
    assert(heroes.every(h=>h.inst()===f.inst()));
    heroes[2].player().deadMs=1000;heroes[2].player().hp=0;heroes[3].at(790,2720);
    const boss=f.inst().mobs.find(m=>m.adventureTarget==='keeper')!;
    killMob(f.inst(),boss,f.player(),'physical','multiplayer');
    assert.deepEqual(heroes.map(h=>questState(h.save,'under_spillway')!.step),[2,2,1,1]);
  }finally{await f.world.shutdown();}
});

test('unknown revisions, forged actions and unknown targets retain saved state without granting anything',async()=>{
  const f=await fixture();
  try {
    f.completedWheel();f.save.quests={high_water:{revision:77,step:2,claimed:false}};
    f.waypoint();assert(f.travel('rillwake_crossing').ok);f.near('tender');
    const before=JSON.stringify(f.save);
    for(const action of ['accept','inspect','claim','complete','kill','reach','track'])assert(!f.quest('high_water',action).ok,action);
    assert(!f.quest('__proto__','claim').ok);assert(!f.quest('silent_wheel','talk','unknown').ok);
    assert.equal(JSON.stringify(f.save),before);
    assert(!zoneUnlocked(f.save,'bracken_sluice'));
  }finally{await f.world.shutdown();}
});
