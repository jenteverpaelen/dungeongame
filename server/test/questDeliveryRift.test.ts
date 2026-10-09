import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { QUESTS } from '../../shared/src/data/quests';
import type { QuestDef } from '../../shared/src/questTypes';
import { questState } from '../../shared/src/quests';
import { World } from '../src/world';
import { Instance } from '../src/sim/instance';
import type { Session } from '../src/net/session';
import { runCommand } from '../src/commands';
import { killMob } from '../src/sim/kills';
import { saveCharacter, loadCharacter, flushSaves } from '../src/persistence';

assert(process.env.DATA_DIR,'isolated DATA_DIR required');
let seq=0;
async function fixture() {
  const world=new World();await world.init();
  const add=()=>{
    const save=createCharacter(`DeliveryRift${++seq}`,'warrior',71);
    const s={save,derived:computeStats(save),sessionId:save.id,rec:null,entityId:0,homeTown:null,hold:null,pendingEnchant:null,
      send(){},sendRaw(){},markDirty(){},saveNow(){},autosave(){},kick(){},shutdown(){},changed(){s.derived=computeStats(save);},
    } as unknown as Session;
    world.login(s,(you,zone)=>({t:'welcome',you,char:save,derived:s.derived,zone,time:Date.now(),world:world.infoFor(s)}));
    const inst=()=>s.rec!.inst as Instance,player=()=>inst().playerById(s.entityId)!;
    const at=(x:number,y:number)=>{const p=player();p.x=p.mv.x=x;p.y=p.mv.y=y;p.hp=p.mhp;p.deadMs=0;};
    const cmd=(op:Parameters<typeof runCommand>[2],args:Record<string,unknown>={})=>runCommand(s,world,op,args);
    const service=(role:string)=>{const n=inst().map.town!.npcs.find(n=>n.role===role)!;at(...n.approach);};
    const tender=()=>{const n=inst().map.adventure!.interactions.find(n=>n.id==='tender')!;at(n.x,n.y+65);};
    const accept=(id:string)=>{service('waypoint');assert(cmd('travel',{zone:'rillwake_crossing'}).ok);tender();assert(cmd('quest',{quest:id,action:'accept',target:'tender'}).ok);};
    return {save,s,inst,player,at,cmd,service,tender,accept};
  };
  return {world,add,...add()};
}
const catalog=QUESTS as QuestDef[];
function definition(id:string):QuestDef {
  return {...structuredClone(QUESTS[1]),id,requires:[],unlocks:undefined};
}

test('delivery rejects invalid, stale, partial, protected and ambiguous inputs before any item or quest mutation',async()=>{
  const f=await fixture(),q=definition('delivery_reject_fixture');
  q.steps=[{id:'handover',kind:'deliver',zone:'rillwake_crossing',target:'tender',text:'quest.delivery.title',itemBase:'sword',itemRarity:'normal',count:2}];
  catalog.push(q);
  try {
    f.accept(q.id);
    const first={...structuredClone(f.save.equipment.mainhand!),id:'delivery-a'},second={...structuredClone(first),id:'delivery-b'};
    assert.equal(first.base,'sword');assert.equal(first.rarity,'normal');
    f.save.inventory[0]=first;f.save.inventory[1]=second;
    const args={action:'deliver',quest:q.id,target:'tender',revision:1,step:'handover',itemIds:[first.id,second.id]};
    const rejected=(extra:Record<string,unknown>={})=>{const before=structuredClone(f.save);const r=f.cmd('quest',{...args,...extra});assert(!r.ok,JSON.stringify(extra));assert.deepEqual(f.save,before);};
    for(const extra of [{itemIds:[]},{itemIds:[first.id]},{itemIds:[first.id,first.id]},{itemIds:[first.id,2]},
      {itemIds:[first.id,'missing']},{itemIds:[first.id,f.save.equipment.mainhand!.id]},{revision:2},{step:'stale'},{target:'cart'}])rejected(extra);
    f.at(0,0);rejected();f.tender();
    second.protected=true;rejected();delete second.protected;
    second.rarity='magic';rejected();second.rarity='normal';
    second.base='staff';rejected();second.base='sword';
    f.save.stash[0]={...first};rejected();f.save.stash[0]=null;
    f.save.inventory[1]=null;f.save.stash[0]=second;rejected();f.save.stash[0]=null;f.save.inventory[1]=second;
    f.s.pendingEnchant={itemId:first.id,affix:0,options:[]};rejected();f.s.pendingEnchant=null;
    first.sockets=[{gem:'ruby',rank:1}];f.save.gems['ruby:1']=Number.MAX_SAFE_INTEGER;rejected();
  } finally {catalog.splice(catalog.indexOf(q),1);await f.world.shutdown();}
});

test('delivery consumes exactly the reviewed batch, returns gems and preserves reward/progress across reload and retries',async()=>{
  const f=await fixture(),q=definition('delivery_success_fixture');q.reward='magic_weapon';
  q.steps=[{id:'handover',kind:'deliver',zone:'rillwake_crossing',target:'tender',text:'quest.delivery.title',itemBase:'sword',itemRarity:'normal',count:2}];
  catalog.push(q);
  try {
    f.accept(q.id);
    const base=structuredClone(f.save.equipment.mainhand!);
    f.save.inventory=f.save.inventory.map((_,i)=>({...structuredClone(base),id:`delivery-slot-${i}`}));
    f.save.inventory[0]!.sockets=[{gem:'ruby',rank:1},null];f.save.inventory[1]!.sockets=[{gem:'ruby',rank:1}];
    f.save.gems['ruby:1']=3;
    const before=structuredClone(f.save),args={action:'deliver',quest:q.id,target:'tender',revision:1,step:'handover',itemIds:['delivery-slot-0','delivery-slot-1']};
    assert(f.cmd('quest',args).ok);assert.equal(f.save.inventory[0],null);assert.equal(f.save.inventory[1],null);
    assert.deepEqual(f.save.inventory.slice(2),before.inventory.slice(2));assert.deepEqual(f.save.equipment,before.equipment);
    assert.equal(f.save.gems['ruby:1'],5);assert.equal(questState(f.save,q.id)!.step,1);
    const reward=structuredClone(questState(f.save,q.id)!.reward!);assert(reward);
    await saveCharacter(f.save);await flushSaves();const loaded=await loadCharacter(f.save.id);
    assert.deepEqual(loaded!.inventory,f.save.inventory);assert.deepEqual(loaded!.quests,f.save.quests);assert.deepEqual(loaded!.gems,f.save.gems);
    const delivered=structuredClone(f.save);assert(!f.cmd('quest',args).ok);assert.deepEqual(f.save,delivered);
    assert(f.cmd('quest',{action:'claim',quest:q.id,target:'tender'}).ok);
    assert(!f.cmd('quest',{action:'claim',quest:q.id,target:'tender'}).ok);
    assert.equal(f.save.inventory.filter(item=>item?.id===reward.id).length,1);
  } finally {catalog.splice(catalog.indexOf(q),1);await f.world.shutdown();}
});

test('rift objective follows completion membership and minimum difficulty once, with partial persistence and no retrospective credit',async()=>{
  const f=await fixture(),q=definition('rift_complete_fixture'),late=definition('rift_late_fixture');
  q.steps=[{id:'clear',kind:'rift',zone:'rift',target:'completion',text:'quest.wheel.warden',minDifficulty:1,count:2}];
  late.steps=structuredClone(q.steps);catalog.push(q,late);
  try {
    const heroes=[f,f.add(),f.add(),f.add()];
    for(const h of heroes){h.accept(q.id);assert(h.cmd('travel',{zone:'hearthmere'}).ok);}
    const enter=(difficulty:number)=>{
      for(const h of heroes)h.service('obelisk');
      assert(f.cmd('riftOpen',{difficulty}).ok);
      for(const h of heroes)assert(h.cmd('riftEnter').ok);
      assert(heroes.every(h=>h.inst()===f.inst()));
    };
    const guardian=()=>{
      const inst=f.inst();inst.rift!.setFull(f.player());inst.rift!.tick();inst.t+=600;inst.rift!.tick();
      return inst.mobs.find(m=>m.id===inst.rift!.guardian)!;
    };
    enter(0);let boss=guardian();f.at(boss.x,boss.y+60);killMob(f.inst(),boss,f.player(),'physical','rift-fixture');
    assert(heroes.every(h=>questState(h.save,q.id)!.step===0&&!questState(h.save,q.id)!.progress));
    assert(heroes.every(h=>h.save.stats.rifts===1));
    for(const h of heroes)assert(h.cmd('leave').ok);
    enter(1);boss=guardian();f.at(boss.x,boss.y+60);heroes[1].at(boss.x+2000,boss.y);
    heroes[2].at(boss.x,boss.y+80);heroes[2].player().hp=0;heroes[2].player().deadMs=10000;
    assert(heroes[3].cmd('leave').ok);
    assert(!f.cmd('quest',{quest:q.id,action:'rift',target:'completion'}).ok,'no client completion endpoint');
    killMob(f.inst(),boss,f.player(),'physical','rift-fixture');
    assert.deepEqual(heroes.map(h=>questState(h.save,q.id)!.progress??0),[1,1,1,0]);
    assert.equal(questState(f.save,late.id),undefined,'unaccepted quest gets no credit');
    f.save.quests![late.id]={revision:1,step:0,claimed:false};
    killMob(f.inst(),boss,f.player(),'physical','rift-fixture-repeat');
    assert.equal(questState(f.save,q.id)!.progress,1);assert.equal(questState(f.save,late.id)!.progress??0,0);
    await saveCharacter(f.save);await flushSaves();assert.equal((await loadCharacter(f.save.id))!.quests![q.id].progress,1);
    for(const h of heroes.slice(0,3))assert(h.cmd('leave').ok);
    enter(1);boss=guardian();f.at(boss.x,boss.y+60);killMob(f.inst(),boss,f.player(),'physical','rift-fixture-second');
    assert.equal(questState(f.save,q.id)!.step,1);assert.equal(questState(f.save,q.id)!.progress,0);
    assert.equal(questState(f.save,late.id)!.progress,1,'only the new completed run counts');
  } finally {catalog.splice(catalog.indexOf(q),1);catalog.splice(catalog.indexOf(late),1);await f.world.shutdown();}
});
