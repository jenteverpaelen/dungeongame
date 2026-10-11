import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { contactSpot, questState, zoneUnlocked, trackedQuest, questObjective, questPoint, trackerQuests } from '../../shared/src/quests';
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
    // Contacts stand where this character sees them (phasing: Orren at the mill, Hollis at the forecourt).
    const near=(id:string)=>{const c=contactSpot(inst().map.adventure,id,save)!,cw=inst().cw;
      const pt=Array.from({length:16},(_,i)=>({x:c.x+65*Math.cos(i*Math.PI/8),y:c.y+65*Math.sin(i*Math.PI/8)})).find(q=>cw.isFree(q.x,q.y,18)&&!cw.segmentBlocked(q.x,q.y,c.x,c.y))??{x:c.x,y:c.y+65};at(pt.x,pt.y);};
    const quest=(quest:string,action:string,target='tender',extra:Record<string,unknown>={})=>runCommand(s,world,'quest',{quest,action,target,...extra});
    const travel=(zone:string)=>runCommand(s,world,'travel',{zone});
    const waypoint=()=>{const wp=inst().map.town!.npcs.find(n=>n.role==='waypoint')!;at(...wp.approach);};
    const completedWheel=()=>{(save.quests??={}).silent_wheel={revision:2,step:4,claimed:true};};
    return {s,save,inst,player,at,near,quest,travel,waypoint,completedWheel};
  };
  return {world,add,...add()};
}

test('quest tracking: acceptance selects, untrack survives progress and reload, retrack restores destination',async()=>{
  const f=await fixture();
  try {
    f.waypoint();assert(f.travel('rillwake_crossing').ok);f.near('tender');
    assert(f.quest('silent_wheel','accept').ok);
    const q=trackedQuest(f.save)!;assert.equal(q.id,'silent_wheel');
    assert(questPoint(f.inst().map,questObjective(f.save,q),f.save));
    assert(f.quest(q.id,'untrack').ok);assert.equal(trackedQuest(f.save),undefined);assert(!trackerQuests(f.save).includes(q),'hidden from the tracker');
    f.near('cart');assert(f.quest(q.id,'inspect','cart').ok);
    assert.equal(trackedQuest(f.save),undefined,'advancing does not restore the focus');
    assert(trackerQuests(f.save).includes(q),'a hidden quest returns to the tracker when it progresses (docs/rework/quests/DESIGN.md §3)');
    await saveCharacter(f.save);await flushSaves();
    const loaded=(await loadCharacter(f.save.id))!;
    assert.equal(loaded.trackedQuest,'');assert.equal(trackedQuest(loaded),undefined);
    assert(f.quest(q.id,'track').ok);assert.equal(trackedQuest(f.save)?.id,q.id);
    assert(questPoint(f.inst().map,questObjective(f.save,q),f.save));
    f.completedWheel();f.near('tender');assert(f.quest('high_water','accept').ok);
    assert.equal(trackedQuest(f.save)?.id,'high_water');
  } finally {await f.world.shutdown();}
});

test('counted server events retain partial progress, ignore failed actions and count each successful action once',async()=>{
  const f=await fixture('mage'),catalog=QUESTS as QuestDef[];
  const q:QuestDef={...structuredClone(QUESTS[1]),id:'adapter_fixture',requires:[],unlocks:undefined,steps:[
    {id:'kills',kind:'kill',zone:'rillwake_crossing',target:'road',monsterType:'bog_slime',count:2,text:'q.silent_wheel.warden'},
    {id:'loot',kind:'collect',zone:'rillwake_crossing',target:'road',itemBase:f.save.equipment.mainhand!.base,count:2,text:'q.silent_wheel.ledger'},
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

// Zone positions are read from the authored data (layouts moved in the worlds rebuild, docs/rework/worlds/DECISIONS.md D-W07).
const place=(inst:{map:{adventure?:{locations:{id:string;x:number;y:number}[]}}},id:string):[number,number]=>{const l=inst.map.adventure!.locations.find(l=>l.id===id)!;return [l.x,l.y];};
const gate=(inst:{map:{portals:{to:string;x:number;y:number}[]}},to:string):[number,number]=>{const p=inst.map.portals.find(p=>p.to===to)!;return [p.x,p.y];};
const near=(inst:{map:{adventure?:{encounters:{id:string;x:number;y:number}[]}}},id:string):[number,number]=>{const e=inst.map.adventure!.encounters.find(e=>e.id===id)!;return [e.x,e.y+80];};
for(const cls of ['warrior','mage','ranger'] as const)test(`${cls}: connected quests, ordered authoritative events, repairs, unlock travel, hand-over, full-bag retry and persistence`,async()=>{
  const f=await fixture(cls);
  const success=(r:{ok:boolean;err?:string})=>assert(r.ok,r.err??'command must succeed');
  const hold=(quest:string,target:string,ms:number)=>{success(f.quest(quest,'holdStart',target));f.inst().t+=ms;success(f.quest(quest,'inspect',target));};
  try {
    f.waypoint();assert(!f.travel('bracken_sluice').ok,'waypoint cannot skip prerequisites');
    success(f.travel('rillwake_crossing'));f.near('tender');
    assert(!f.quest('high_water','accept').ok,'previous story step required');
    f.completedWheel();f.near('tender');success(f.quest('high_water','accept'));
    f.near('overlook_fire');assert(!f.quest('high_water','holdStart','overlook_fire').ok,'ordered objectives');
    f.near('survey');success(f.quest('high_water','inspect','survey'));success(f.quest('high_water','inspect','survey'));
    assert(!f.quest('high_water','wave','survey_alarm').ok,'no client credit endpoint');
    success(runCommand(f.s,f.world,'quest',{action:'activateField',target:'survey'}));
    for(const m of f.inst().mobs.filter(m=>!m.dead&&m.adventureSite==='overlook')){f.at(m.x,m.y+40);killMob(f.inst(),m,f.player(),'physical','quest-test');}
    assert.equal(questState(f.save,'high_water')!.step,2,'the alarm wave clears in person');
    f.near('overlook_fire');hold('high_water','overlook_fire',2000);assert.equal(questState(f.save,'high_water')!.step,3);
    f.at(...gate(f.inst(),'bracken_sluice'));assert(!f.travel('bracken_sluice').ok,'world objective alone does not claim the passage');
    assert(!f.quest('high_water','claim').ok,'remote claim');
    f.near('tender');success(f.quest('high_water','claim'));assert(zoneUnlocked(f.save,'bracken_sluice'));
    assert(!f.quest('high_water','claim').ok,'cannot claim twice');
    success(f.quest('under_spillway','accept'));assert(!f.travel('bracken_sluice').ok,'must walk to connecting portal');
    const home=f.s.homeTown;f.at(...gate(f.inst(),'bracken_sluice'));success(f.travel('bracken_sluice'));assert.equal(f.s.homeTown,home,'field travel preserves home town');
    f.at(...place(f.inst(),'forecourt'));f.inst().tick();assert.equal(questState(f.save,'under_spillway')!.step,0,'the hand-over comes first');
    f.near('foreman');success(f.quest('under_spillway','objectiveTalk','foreman',{step:'hollis',revision:2}));assert.equal(questState(f.save,'under_spillway')!.step,1);
    f.near('floodgate');assert(!f.quest('under_spillway','holdStart','floodgate').ok);
    f.at(...place(f.inst(),'forecourt'));f.inst().tick();assert.equal(questState(f.save,'under_spillway')!.step,2);
    const boss=f.inst().mobs.find(m=>m.adventureTarget==='keeper')!;
    assert(boss.boss);assert.equal(boss.tier,2,'existing rare reward tier');assert.equal(boss.boss.addsMs,Infinity,'no reward-bearing summons');
    f.at(boss.x,boss.y+80);killMob(f.inst(),boss,f.player(),'physical','quest-test');assert.equal(questState(f.save,'under_spillway')!.step,3);
    f.near('floodgate');hold('under_spillway','floodgate',3000);
    const reserved=structuredClone(questState(f.save,'under_spillway')!.reward!);assert(reserved);assert(questState(f.save,'under_spillway')!.rewardAlt);
    success(f.quest('under_spillway','inspect','floodgate'));assert.deepEqual(questState(f.save,'under_spillway')!.reward,reserved);
    // Hollis walks up to the forecourt once the gate is open (phasing): the turn-in is right there, no walk back to camp.
    const camp=f.inst().map.adventure!.interactions.find(i=>i.id==='foreman')!,up=contactSpot(f.inst().map.adventure,'foreman',f.save)!;
    assert(Math.hypot(up.x-camp.x,up.y-camp.y)>3000);
    f.near('foreman');f.save.inventory.fill({...reserved,id:'full-bag-fixture'});const before=JSON.stringify(f.save);
    assert(!f.quest('under_spillway','claim','foreman').ok);assert.equal(JSON.stringify(f.save),before);
    f.save.inventory[0]=null;success(f.quest('under_spillway','claim','foreman'));assert(!f.quest('under_spillway','claim','foreman').ok);
    assert.equal(f.save.inventory.filter(i=>i?.id===reserved.id).length,1);assert.deepEqual(f.save.inventory[0],reserved);
    await saveCharacter(f.save);await flushSaves();const loaded=await loadCharacter(f.save.id);
    assert.deepEqual(loaded!.quests,f.save.quests);assert.equal(loaded!.rillwake,undefined);assert(zoneUnlocked(loaded!,'bracken_sluice'));
  }finally{await f.world.shutdown();}
});

test('four clients: only accepted, local and living witnesses receive the authored keeper credit',async()=>{
  const f=await fixture();
  try {
    const heroes=[f,f.add(),f.add(),f.add()];
    for(const h of heroes) {
      h.save.quests={silent_wheel:{revision:2,step:4,claimed:true},high_water:{revision:2,step:3,claimed:true},under_spillway:{revision:2,step:2,claimed:false}};
      h.waypoint();assert(h.travel('bracken_sluice').ok);h.at(...near(h.inst(),'keeper'));
    }
    assert(heroes.every(h=>h.inst()===f.inst()));
    heroes[2].player().deadMs=1000;heroes[2].player().hp=0;heroes[3].at(heroes[3].inst().map.entry.x,heroes[3].inst().map.entry.y);
    const boss=f.inst().mobs.find(m=>m.adventureTarget==='keeper')!;
    killMob(f.inst(),boss,f.player(),'physical','multiplayer');
    assert.deepEqual(heroes.map(h=>questState(h.save,'under_spillway')!.step),[3,3,2,2]);
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
