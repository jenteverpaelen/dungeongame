import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { ADVENTURES, loadAdventure } from '../../shared/src/adventure';
import { QUESTS } from '../../shared/src/data/quests';
import { MONSTERS } from '../../shared/src/data/monsters';
import { ZONES } from '../../shared/src/data/zones';
import { questState, writeQuestState, zoneLevelAllowed, zoneUnlocked } from '../../shared/src/quests';
import { planQuestReward } from '../../shared/src/questRewards';
import { validateAdventures, validateQuests } from '../../shared/src/questValidation';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import { adventureCover } from '../../shared/src/adventureCover';
import { Instance } from '../src/sim/instance';
import { createMob, updateMonsters } from '../src/sim/monsters';
import { updateProjectiles } from '../src/sim/projectiles';
import { fractureLine } from '../src/sim/fracture';
import { bossTick } from '../src/sim/rift';
import { AFFIX_IDS, eliteTick } from '../src/sim/elites';
import { stunMob } from '../src/sim/effects';
import { World } from '../src/world';
import type { Session } from '../src/net/session';
import { runCommand } from '../src/commands';
import { loadCharacter, saveCharacter, flushSaves, ensureDataDir } from '../src/persistence';

assert(process.env.DATA_DIR,'isolated DATA_DIR required');
ensureDataDir();

test('authored destinations have reachable objectives, real bands, legal spawns and matching rendered collision themes',()=>{
  assert.deepEqual(validateAdventures(),[]);assert.deepEqual(validateQuests(),[]);
  assert(Object.keys(ADVENTURES).length>=6);
  for(const id of ['cinderwash_kilns','kilnwatch_crown'])assert.equal(loadAdventure(id,1).theme,'ashen');
});

test('each class reaches level20 on story awards alone; full bags do not partially award XP and claimed history survives reload',async()=>{
  for(const classId of ['warrior','ranger','mage'] as const){
    const save=createCharacter('Frontier'+classId,classId,11),rng=new Rng(11);
    for(const q of QUESTS.filter(q=>q.chapter==='water_road'||q.chapter==='upper_road')){
      const state={revision:q.revision,step:q.steps.length,claimed:false,
        ...(typeof q.reward==='object'&&q.reward.item?{reward:generateItem(rng,{ilvl:save.level,classId,rarity:'magic',base:classId==='mage'?'staff':classId==='ranger'?'bow':'sword'})}:{})};
      writeQuestState(save,q.id,state);
      if(state.reward){
        const full=structuredClone(save);full.inventory.fill(full.equipment.mainhand!);const before=structuredClone(full);
        assert('error' in planQuestReward(full,q,state));assert.deepEqual(full,before);
      }
      const result=planQuestReward(save,q,state);assert(!('error' in result));Object.assign(save,result.save);
      if(q.unlocks){assert(zoneUnlocked(save,q.unlocks));assert(zoneLevelAllowed(save,q.unlocks));assert(save.level>=ZONES[q.unlocks].levelBand[0]);}
      assert('error' in planQuestReward(save,q,questState(save,q.id)!),'cannot repay a claimed quest');
    }
    assert.equal(save.level,20);assert.equal(save.xp,0);assert.equal(save.stats.kills,0);assert(save.skillPoints>0);
    await saveCharacter(save);await flushSaves();const restored=(await loadCharacter(save.id))!;
    assert.equal(restored.level,20);assert(questState(restored,'last_draw')?.claimed);assert.equal(restored.inventory.filter(Boolean).length,6);
  }
});

test('physical route travel enforces story locks, retains old low-level earned access and clamps dungeon monsters',async()=>{
  const world=new World();await world.init();
  const save=createCharacter('FrontierRoute','warrior',8);
  const s={save,derived:computeStats(save),sessionId:save.id,rec:null,entityId:0,homeTown:null,hold:null,pendingEnchant:null,
    send(){},sendRaw(){},markDirty(){},saveNow(){},autosave(){},kick(){},shutdown(){},changed(){s.derived=computeStats(save);},
  } as unknown as Session;
  world.login(s,(you,zone)=>({t:'welcome',you,char:save,derived:s.derived,zone,time:Date.now(),world:world.infoFor(s)}));
  const inst=()=>s.rec!.inst as Instance,p=()=>inst().playerById(s.entityId)!;
  const at=(x:number,y:number)=>{p().x=p().mv.x=x;p().y=p().mv.y=y;};
  const cmd=(zone:string)=>runCommand(s,world,'travel',{zone});
  try{
    const wp=inst().map.town!.npcs.find(n=>n.role==='waypoint')!;at(...wp.approach);
    assert(!cmd('bracken_sluice').ok);
    for(const q of QUESTS.filter(q=>q.chapter==='water_road'))writeQuestState(save,q.id,{revision:q.revision,step:q.steps.length,claimed:true});
    assert.equal(save.level,1);assert(zoneLevelAllowed(save,'bracken_sluice'));assert(cmd('bracken_sluice').ok);
    assert(!cmd('reedvault_pumpworks').ok,'must reach physical hatch');
    const hatch=inst().map.portals.find(p=>p.to==='reedvault_pumpworks')!;at(hatch.x,hatch.y+65);assert(cmd('reedvault_pumpworks').ok);
    assert.equal(inst().level,7);
    const exit=inst().map.portals[0];at(exit.x,exit.y-65);assert(cmd('bracken_sluice').ok);
    assert(Math.hypot(p().x-hatch.x,p().y-hatch.y)<=71,'arrive by reciprocal entrance');
    assert(!cmd('cinderwash_kilns').ok,'future route is still story locked');
    const onward=inst().map.portals.find(p=>p.to==='cairnspill_terraces')!;at(onward.x,onward.y+65);assert(cmd('cairnspill_terraces').ok);
    assert(inst().mobs.every(m=>m.level>=9&&m.level<=12));
  }finally{await world.shutdown();}
});

function combat(type='vault_moth'){
  const save=createCharacter('PatternProbe','mage',41);save.level=20;
  const inst=new Instance({zoneId:'reedvault_pumpworks',key:'pattern',channel:0,seed:41,theme:'glade',level:9,difficulty:0});
  // Pre-placed dungeon packs (DECISIONS D-W06) are cleared: this probe measures one monster in isolation.
  for(const pre of [...inst.mobs])inst.removeMob(pre);inst.mobs.length=0;
  inst.addPlayer({save,derived:computeStats(save),sessionId:'pattern',send(){},markDirty(){}});
  const p=inst.players[0];p.invulnMs=0;
  const at=(x:number,y:number)=>{p.x=p.mv.x=x;p.y=p.mv.y=y;};at(900,1390);
  const m=createMob(inst,MONSTERS[type],9,640,1390);m.state='chase';m.target=p.id;m.atkCdMs=0;
  const tick=()=>{inst.t+=50;inst.tickNo++;updateMonsters(inst,50);inst.sched.run(inst.t);};
  return {inst,p,m,at,tick};
}

test('moth fan fixes its aim during windup, splits one damage budget, and solid cover stops its projectiles',()=>{
  const f=combat();try{
    f.tick();assert.equal(f.m.state,'windup');f.at(900,1560);
    for(let i=0;i<30&&!f.inst.projs.length;i++)f.tick();
    assert.equal(f.inst.projs.length,3);assert(Math.abs(f.inst.projs[1].vy)<.001);
    assert(Math.abs(f.inst.projs.reduce((n,p)=>n+p.dmg,0)-f.m.dmg)<.001);
    assert(f.inst.projs[0].vy<0&&f.inst.projs[2].vy>0);
    f.inst.map.adventure!.geometry.props.push({x:730,y:1380,radius:45});const middle=f.inst.projs[1];
    for(let i=0;i<20&&!middle.dead;i++)updateProjectiles(f.inst,50);
    assert(middle.dead,'projectile ends at solid cover');
  }finally{f.inst.destroy();}
  const g=combat();try{g.tick();stunMob(g.m,3000);for(let i=0;i<20;i++)g.tick();assert.equal(g.inst.projs.length,0);}finally{g.inst.destroy();}
});

test('authored projectile cover catches thin walls and grazing barriers while allowing flight across water',()=>{
  const a=loadAdventure('reedvault_pumpworks',1).adventure!;
  assert(adventureCover(a,380,1300,460,1300),'west solid wall');
  assert(!adventureCover(a,1100,1400,1400,1400),'water between chambers');
  a.geometry.buildings.push({footprint:[[1199,1350],[1201,1350],[1201,1450],[1199,1450]]});
  assert(adventureCover(a,1190,1400,1210,1400),'2-unit wall crossed between projectile samples');
  a.geometry.barriers.push({a:[1100,1500],b:[1300,1500],radius:7});
  assert(adventureCover(a,1090,1494,1120,1494),'grazing parallel barrier');
});

test('ground fractures lock their marks, offer the full warning, permit sidesteps and stop at cover or source death',()=>{
  const f=combat('flint_beetle');try{
    f.tick();f.at(900,1590);for(let i=0;i<30&&!f.inst.sched.size;i++)f.tick();
    const marks=f.inst.events.flatMap(e=>e.ev.e==='tele'?[e.ev]:[]);assert.equal(marks.length,3);assert(marks.every(e=>e.y===1390));
    const hp=f.p.hp;f.m.atkCdMs=1e9;for(let i=0;i<24;i++)f.tick();assert.equal(f.p.hp,hp);
    f.inst.events.length=0;f.m.x=640;f.m.y=1390;f.inst.cw.town!.addCircle(790,1390,25,false);
    fractureLine(f.inst,f.m,950,1390,380,1,'physical');assert.equal(f.inst.events.filter(e=>e.ev.e==='tele').length,1);
  }finally{f.inst.destroy();}
  for(const dead of [false,true]){const g=combat('flint_beetle');try{
    const hp=g.p.hp;fractureLine(g.inst,g.m,g.p.x,g.p.y,380,20,'physical');g.m.dead=dead;
    g.inst.t=899;g.inst.sched.run(g.inst.t);assert.equal(g.p.hp,hp);
    g.inst.t=1200;g.inst.sched.run(g.inst.t);if(dead)assert.equal(g.p.hp,hp);else assert(g.p.hp<hp);
  }finally{g.inst.destroy();}}
});

test('new authored trait and alternating furnace use bounded mechanics without modifying the random affix pool or summoning rewards',()=>{
  assert.deepEqual(AFFIX_IDS,['fast','extra_health','molten','frozen','plagued','electrified','vortex','mortar']);
  const f=combat('kiln_heart');try{
    f.m.affixes=['faulted'];f.m.aff.faulted=0;eliteTick(f.inst,f.m,f.p,50);assert.equal(f.inst.sched.size,3);assert.equal(f.m.aff.faulted,3000);
    f.inst.sched.run(1200);f.inst.events.length=0;
    f.m.boss={furnace:true,ringMs:0,addsMs:Infinity,enraged:false,slamCount:0};
    const count=f.inst.mobs.length;bossTick(f.inst,f.m,f.p,50);assert.equal(f.inst.events.filter(e=>e.ev.e==='tele').length,3);
    f.inst.events.length=0;f.m.boss.ringMs=0;bossTick(f.inst,f.m,f.p,50);
    assert(f.inst.events.some(e=>e.ev.e==='tele'&&e.ev.v==='boss_ring'));f.inst.sched.run(5000);
    assert.equal(f.inst.projs.length,16);assert.equal(f.inst.mobs.length,count);
  }finally{f.inst.destroy();}
});
