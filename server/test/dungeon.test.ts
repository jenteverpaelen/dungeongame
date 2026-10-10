import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { questState, writeQuestState } from '../../shared/src/quests';
import type { ClassId } from '../../shared/src/types';
import { World } from '../src/world';
import { Instance } from '../src/sim/instance';
import { runCommand } from '../src/commands';
import { killMob } from '../src/sim/kills';
import { saveCharacter, loadCharacter, flushSaves } from '../src/persistence';
import type { Session } from '../src/net/session';

assert(process.env.DATA_DIR,'isolated test DATA_DIR required');
let sequence=0;
function player(world:World,cls:ClassId='mage'){
  const save=createCharacter(`Pump${++sequence}`,cls,1);
  const s={save,derived:computeStats(save),sessionId:save.id,rec:null,entityId:0,homeTown:null,hold:null,
    send(){},sendRaw(){},markDirty(){},saveNow(){},autosave(){},kick(){},shutdown(){},changed(){s.derived=computeStats(save);},
  } as unknown as Session;
  world.login(s,(you,zone)=>({t:'welcome',you,char:save,derived:s.derived,zone,time:Date.now(),world:world.infoFor(s)}));
  const inst=()=>s.rec!.inst as Instance,p=()=>inst().playerById(s.entityId)!;
  const at=(x:number,y:number)=>{Object.assign(p(),{x,y,hp:p().mhp,deadMs:0});Object.assign(p().mv,{x,y});};
  const near=(id:string)=>{const n=inst().map.adventure!.interactions.find(i=>i.id===id)!;at(n.x+65,n.y);};
  const cmd=(op:Parameters<typeof runCommand>[2],a:Record<string,unknown>={})=>runCommand(s,world,op,a);
  const travel=(zone:string)=>cmd('travel',{zone});
  const waypoint=()=>{const n=inst().map.town!.npcs.find(n=>n.role==='waypoint')!;at(...n.approach);};
  const unlock=()=>{writeQuestState(save,'silent_wheel',{revision:1,step:3,claimed:true});writeQuestState(save,'high_water',{revision:1,step:2,claimed:true});writeQuestState(save,'under_spillway',{revision:1,step:3,claimed:true});};
  const accept=()=>{waypoint();assert(travel('rillwake_crossing').ok);near('tender');assert(cmd('quest',{action:'accept',quest:'pressure_below',target:'tender'}).ok);assert(travel('hearthmere').ok);};
  // Positions come from the zone data since the worlds rebuild (docs/rework/worlds/DECISIONS.md D-W07).
  const hatch=():[number,number]=>{const q=inst().map.portals.find(q=>q.to==='reedvault_pumpworks')!;return [q.x,q.y];};
  const outside=():[number,number]=>{const q=inst().map.portals.find(q=>q.to==='bracken_sluice')!;return [q.x,q.y];};
  const enter=()=>{waypoint();assert(travel('bracken_sluice').ok);at(...hatch());assert(travel('reedvault_pumpworks').ok);};
  const activate=(target:string)=>cmd('quest',{action:'activate',target});
  const clear=()=>{for(const mob of [...inst().mobs])if(!mob.dead)killMob(inst(),mob,p(),'physical','dungeon-fixture');};
  return {s,save,inst,p,at,near,cmd,travel,waypoint,unlock,accept,enter,activate,clear,hatch,outside};
}

test('story dungeon uses Normal independently of the last rift selection',async()=>{
  const world=new World();await world.init();
  try{const a=player(world);a.save.difficulty=3;a.unlock();a.enter();assert.equal(a.inst().difficulty,0);assert.equal(a.save.difficulty,3,'rift preference preserved');}
  finally{await world.shutdown();}
});

test('four-person story run preserves individual gates, shares chamber credit, and survives an initiator disconnect',async()=>{
  const world=new World();await world.init();
  try{
    const team=Array.from({length:4},()=>player(world)),[a,b,c,d]=team;let now=Date.now();
    for(const peer of [b,c,d]){assert(world.parties.command(a.s,{action:'invite',name:peer.save.name},now+=1100).ok);assert(world.parties.command(peer.s,{action:'accept',invite:world.parties.view(peer.s,now).incoming[0].id},now+=1100).ok);}
    a.unlock();a.accept();a.enter();b.waypoint();assert(!b.travel('reedvault_pumpworks').ok,'membership never bypasses personal route or physical entry');
    for(const peer of [b,c,d]){peer.unlock();peer.accept();peer.enter();assert.equal(peer.inst(),a.inst());}
    for(const peer of team){peer.near('west_wheel');peer.p().debugInfiniteHp=true;}
    assert(a.activate('west_wheel').ok);const inst=a.inst();const scaled=inst.mobs[0].mhp;
    world.logout(a.s);inst.dungeon!.tick();assert.equal(inst.dungeonState()!.phase,'active');
    b.clear();assert.equal(questState(a.save,'pressure_below')!.step,0,'absent initiator gets no wave');
    for(const peer of [b,c,d])assert.equal(questState(peer.save,'pressure_below')!.step,1);
    assert(scaled>0);assert.equal(inst.dungeonState()!.stage,1);
    b.near('east_wheel');assert(b.activate('east_wheel').ok);world.logout(b.s);inst.dungeon!.tick();
    assert.equal(inst.dungeonState()!.phase,'ready','only participants at activation count; people outside next chamber cannot keep it running');
  }finally{await world.shutdown();}
});

test('dungeon clock starts on valid activation, includes retries and freezes on final clear',async()=>{
  const world=new World();await world.init();
  try {
    const a=player(world);a.unlock();a.enter();const inst=a.inst();
    inst.t=1000;assert.equal(inst.dungeonState()!.elapsedMs,0);assert.equal(inst.dungeonState()!.totalStages,3);
    assert(!a.activate('west_wheel').ok);assert.equal(inst.dungeonState()!.elapsedMs,0);
    a.near('west_wheel');assert(a.activate('west_wheel').ok);
    inst.t=1250;a.p().hp=0;a.p().deadMs=100;inst.dungeon!.tick();
    assert.equal(inst.dungeonState()!.phase,'ready');assert.equal(inst.dungeonState()!.elapsedMs,250);
    inst.t=1500;a.near('west_wheel');assert(a.activate('west_wheel').ok);a.clear();
    inst.t=2000;a.near('east_wheel');assert(a.activate('east_wheel').ok);a.clear();
    inst.t=2500;a.near('pump_crank');assert(a.activate('pump_crank').ok);a.clear();
    assert.equal(inst.dungeonState()!.phase,'done');assert.equal(inst.dungeonState()!.elapsedMs,1500);
    inst.t=5000;assert.equal(inst.dungeonState()!.elapsedMs,1500);
    assert(!a.activate('pump_crank').ok);assert.equal(inst.dungeonState()!.elapsedMs,1500);
  } finally {await world.shutdown();}
});

test('physical entry, private ownership, ordered activation, retry/leave/expiry and saved wave progress',async()=>{
  const world=new World();await world.init();
  try{
    const a=player(world),b=player(world);
    a.waypoint();assert(!a.travel('reedvault_pumpworks').ok);a.unlock();a.accept();a.waypoint();
    assert(!a.travel('reedvault_pumpworks').ok,'waypoint cannot bypass the hatch');
    a.enter();const first=a.inst(),stageIds=new Set(first.map.adventure!.dungeon!.stages.map(st=>st.encounter));
    // D-W06: pre-placed packs are allowed; the mechanisms still own every stage encounter.
    assert(first.mobs.every(m=>!stageIds.has(m.adventureSite??'')),'mechanisms own stage spawns');
    assert(!a.cmd('channel',{channel:1}).ok);assert(!a.activate('west_wheel').ok,'remote');
    a.near('east_wheel');assert(!a.activate('east_wheel').ok,'ordered');
    a.near('west_wheel');a.p().deadMs=1;assert(!a.activate('west_wheel').ok,'dead');a.p().deadMs=0;
    assert(a.activate('west_wheel').ok);assert(!a.activate('west_wheel').ok,'duplicate activation');assert.equal(first.dungeonState()!.remaining,first.map.adventure!.encounters.find(e=>e.id==='west_chamber')!.members.length);
    b.unlock();b.enter();assert.notEqual(b.inst().key,first.key,'another character cannot join this run');
    a.p().hp=0;a.p().deadMs=100;first.dungeon!.tick();assert.equal(first.dungeonState()!.phase,'ready');assert.equal(questState(a.save,'pressure_below')!.step,0);
    a.near('west_wheel');assert(a.activate('west_wheel').ok);first.removeEntity(first.mobs.find(m=>!m.dead&&m.adventureSite==='west_chamber')!.id);first.dungeon!.tick();assert.equal(first.dungeonState()!.phase,'ready','despawn cannot clear');
    a.near('west_wheel');assert(a.activate('west_wheel').ok);a.at(...a.outside());first.dungeon!.tick();assert.equal(first.dungeonState()!.phase,'ready','leaving chamber cancels');
    a.near('west_wheel');assert(a.activate('west_wheel').ok);a.clear();assert.equal(questState(a.save,'pressure_below')!.step,1);
    await saveCharacter(a.save);await flushSaves();assert.equal((await loadCharacter(a.save.id))!.quests!.pressure_below.step,1);
    a.near('east_wheel');assert(a.activate('east_wheel').ok);assert(a.travel('hearthmere').ok);assert.equal(first.dungeonState()!.stage,1);assert.equal(first.dungeonState()!.phase,'ready');
    a.enter();assert.equal(a.inst(),first,'unfinished cleared-stage resume');assert.equal(a.inst().dungeonState()!.stage,1);
    assert(a.travel('hearthmere').ok);world.maintain(Date.now()+5*60_000+1);a.enter();assert.notEqual(a.inst(),first);assert.equal(questState(a.save,'pressure_below')!.step,1,'quest survives expired run');
    a.near('west_wheel');assert(a.activate('west_wheel').ok);a.clear();assert.equal(questState(a.save,'pressure_below')!.step,1,'replayed earlier chamber cannot advance next objective');
  }finally{await world.shutdown();}
});

for(const cls of ['warrior','mage','ranger'] as const)test(`${cls}: complete authored dungeon and claim exactly one reserved reward`,async()=>{
  const world=new World();await world.init();
  try{
    const a=player(world,cls);a.unlock();a.accept();a.enter();
    for(const [i,target] of ['west_wheel','east_wheel','pump_crank'].entries()){
      a.near(target);assert(a.activate(target).ok);a.clear();assert.equal(questState(a.save,'pressure_below')!.step,i+1);
    }
    assert.equal(a.inst().dungeonState()!.phase,'done');assert(!a.activate('pump_crank').ok);
    a.near('work_record');assert(a.cmd('quest',{quest:'pressure_below',action:'inspect',target:'work_record'}).ok);
    const reward=questState(a.save,'pressure_below')!.reward!;assert(reward);
    const completedRun=a.inst();a.at(...a.outside());assert(a.travel('bracken_sluice').ok);assert(Math.hypot(a.p().x-a.hatch()[0],a.p().y-a.hatch()[1])<110,'return beside the hatch');
    a.at(...a.hatch());assert(a.travel('reedvault_pumpworks').ok);assert.equal(a.inst().dungeonState()!.stage,0,'completed run starts fresh');assert.notEqual(a.inst(),completedRun);
    assert(a.travel('hearthmere').ok);a.waypoint();{const r=a.travel('rillwake_crossing');assert(r.ok,JSON.stringify(r));}a.near('tender');
    a.save.inventory=a.save.inventory.map((_,i)=>({...structuredClone(a.save.equipment.mainhand!),id:`full-${i}`}));
    const claim=()=>a.cmd('quest',{quest:'pressure_below',action:'claim',target:'tender'});
    assert(!claim().ok);assert(!questState(a.save,'pressure_below')!.claimed);a.save.inventory[0]=null;assert(claim().ok);assert(!claim().ok);
    assert.equal(a.save.inventory.filter(item=>item?.id===reward.id).length,1);
    await saveCharacter(a.save);await flushSaves();assert((await loadCharacter(a.save.id))!.quests!.pressure_below.claimed);
  }finally{await world.shutdown();}
});
