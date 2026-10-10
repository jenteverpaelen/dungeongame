import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { recordCreature } from '../../shared/src/bestiary';
import { salePrice, ownedItems, BUYBACK_CAPACITY } from '../../shared/src/merchant';
import { QUESTS } from '../../shared/src/data/quests';
import { questState, writeQuestState } from '../../shared/src/quests';
import { questRequest } from '../../shared/src/questRequests';
import { Instance } from '../src/sim/instance';
import { killMob } from '../src/sim/kills';
import type { Session } from '../src/net/session';
import type { World } from '../src/world';
import { runCommand } from '../src/commands';
import { loadCharacter, saveCharacter, flushSaves } from '../src/persistence';

assert(process.env.DATA_DIR,'isolated DATA_DIR required');
let seq=0;
// Positions come from the zone data since the worlds rebuild (docs/rework/worlds/DECISIONS.md D-W07).
const app=(inst:{map:{adventure?:{interactions:{id:string;x:number;y:number}[]}};cw:{isFree(x:number,y:number,r:number):boolean;segmentBlocked(a:number,b:number,c:number,d:number):boolean}},id:string):[number,number]=>{
  const t=inst.map.adventure!.interactions.find(i=>i.id===id)!;
  for(let n=0;n<16;n++){const x=t.x+70*Math.cos(n*Math.PI/8),y=t.y+70*Math.sin(n*Math.PI/8);if(inst.cw.isFree(x,y,18)&&!inst.cw.segmentBlocked(x,y,t.x,t.y))return [x,y];}
  throw new Error('no approach to '+id);
};
function fixture(){
  const inst=new Instance({zoneId:'rillwake_crossing',seed:1,channel:1,key:'early-test',theme:'glade'});
  const add=()=>{
    const save=createCharacter('Early'+ ++seq,'warrior',1);
    const s={save,derived:computeStats(save),sessionId:save.id,pendingEnchant:null,send(){},markDirty(){},changed(){s.derived=computeStats(save);},rec:{inst}} as unknown as Session;
    s.entityId=inst.addPlayer(s);const p=inst.playerById(s.entityId)!;p.debugInfiniteHp=true;
    const at=(x:number,y:number)=>{p.x=p.mv.x=x;p.y=p.mv.y=y;};
    const cmd=(op:Parameters<typeof runCommand>[2],a:Record<string,unknown>)=>runCommand(s,{} as World,op,a);
    const quest=(id:string,action:string)=>{const q=QUESTS.find(q=>q.id===id)!;return cmd('quest',questRequest(q,questState(save,id),'tender',action));};
    const trade=(action:string,itemId:string,extra:Record<string,unknown>={})=>cmd('merchant',{merchant:'orren',action,itemId,sequence:save.merchant?.sequence??0,price:action==='sell'?salePrice(save.inventory.find(i=>i?.id===itemId)!):save.merchant?.items.find(e=>e.item.id===itemId)?.price,...extra});
    return {save,s,p,at,cmd,quest,trade};
  };
  return {inst,add,...add()};
}
function complete(save:ReturnType<typeof createCharacter>,id:string){const q=QUESTS.find(q=>q.id===id)!;writeQuestState(save,id,{revision:q.revision,step:q.steps.length,claimed:true});}

test('bestiary records actual eligible nearby deaths once and preserves future records',async()=>{
  const f=fixture(),other=f.add();
  try{
    const mobs=f.inst.mobs.filter(m=>m.adventureSite==='road');
    f.at(mobs[0].x,mobs[0].y+45);other.at(0,0);
    mobs[0].affixes=['fast'];killMob(f.inst,mobs[0],f.p,'physical','fixture');killMob(f.inst,mobs[0],f.p,'physical','fixture');
    assert.equal(f.save.bestiary?.kills.bog_slime,1);assert.deepEqual(f.save.bestiary?.affixes,['fast']);assert.equal(other.save.bestiary,undefined);
    f.p.deadMs=1;killMob(f.inst,mobs[1],null,'physical','fixture');f.p.deadMs=0;
    mobs[2].noReward=true;killMob(f.inst,mobs[2],f.p,'physical','fixture');assert.equal(f.save.bestiary?.kills.bog_slime,1);
    f.save.bestiary!.kills.legacy_creature=7;
    await saveCharacter(f.save);await flushSaves();assert.deepEqual((await loadCharacter(f.save.id))!.bestiary,f.save.bestiary);
    const future={revision:99,kills:{future:7}};f.save.bestiary=future as never;
    assert(!recordCreature(f.save,'bog_slime',[]));assert.deepEqual(f.save.bestiary,future);
  }finally{f.inst.destroy();}
});

test('merchant sale, retained custody and same-price reclaim survive reload without duplication',async()=>{
  const f=fixture();
  try{
    const item=structuredClone(f.save.equipment.mainhand!);item.id='sale-fixture';item.sockets=[{gem:'ruby',rank:1}];f.save.inventory[0]=item;
    const reject=(extra:Record<string,unknown>={})=>{const before=structuredClone(f.save);assert(!f.trade('sell',item.id,extra).ok);assert.deepEqual(f.save,before);};
    reject();f.at(...app(f.inst,'tender'));f.p.deadMs=1;reject();f.p.deadMs=0;reject({merchant:'forged'});reject({price:99999});
    item.protected=true;reject();delete item.protected;
    f.s.pendingEnchant={itemId:item.id,affix:0,options:[]};reject();f.s.pendingEnchant=null;
    f.save.stash[0]=structuredClone(item);reject();f.save.stash[0]=null;
    const price=salePrice(item)!,gold=f.save.gold;assert(f.trade('sell',item.id).ok);assert.equal(f.save.gold,gold+price);assert.equal(f.save.inventory[0],null);
    assert.equal(ownedItems(f.save).filter(i=>i?.id===item.id).length,1);
    await saveCharacter(f.save);await flushSaves();Object.assign(f.save,(await loadCharacter(f.save.id))!);
    const before=structuredClone(f.save);assert(!f.trade('buyback',item.id,{sequence:0}).ok);assert.deepEqual(f.save,before);
    f.save.inventory=f.save.inventory.map((_,i)=>({...item,id:'full-'+i}));assert(!f.trade('buyback',item.id).ok);f.save.inventory[0]=null;
    f.save.gold=price-1;assert(!f.trade('buyback',item.id).ok);f.save.gold=gold+price;
    assert(f.trade('buyback',item.id).ok);assert.deepEqual(f.save.inventory[0],item);assert.equal(f.save.gold,gold);assert.equal(f.save.merchant!.items.length,0);
    assert(!f.cmd('merchant',{merchant:'orren',action:'sell',itemId:item.id,price,sequence:0}).ok);
    assert(f.trade('sell',item.id).ok);assert(!f.trade('release',item.id).ok);const paid=f.save.gold;
    assert(f.trade('release',item.id,{confirm:item.id}).ok);assert.equal(f.save.gold,paid);assert(!ownedItems(f.save).some(i=>i?.id===item.id));
  }finally{f.inst.destroy();}
});

test('full buyback and unsupported records never evict retained items or consume a new sale',()=>{
  const f=fixture();
  try{
    f.at(...app(f.inst,'tender'));const item=structuredClone(f.save.equipment.mainhand!);item.id='extra';f.save.inventory[0]=item;
    f.save.merchant={revision:1,sequence:0,items:Array.from({length:BUYBACK_CAPACITY},(_,i)=>({item:{...item,id:'retained-'+i},price:7}))};
    for(const state of [f.save.merchant,{revision:99,items:[]}]){
      f.save.merchant=state as never;const before=structuredClone(f.save);assert(!f.trade('sell',item.id).ok);assert.deepEqual(f.save,before);
    }
  }finally{f.inst.destroy();}
});

test('live contract uses actual authored deaths, physical claim and a fresh saved cycle',async()=>{
  const f=fixture();
  try{
    f.at(...app(f.inst,'tender'));assert(!f.quest('contract_road','accept').ok);complete(f.save,'silent_wheel');assert(f.quest('contract_road','accept').ok);
    for(const m of f.inst.mobs.filter(m=>m.adventureSite==='road'&&m.def.id==='bog_slime')){f.at(m.x,m.y+40);killMob(f.inst,m,f.p,'physical','fixture');}
    assert.equal(questState(f.save,'contract_road')!.step,1);assert(!f.quest('contract_road','claim').ok);f.at(...app(f.inst,'tender'));
    const gold=f.save.gold;assert(f.quest('contract_road','claim').ok);assert.equal(f.save.gold,gold+54);assert(!f.quest('contract_road','claim').ok);
    assert(f.quest('contract_road','accept').ok);assert.equal(questState(f.save,'contract_road')!.step,0);assert.equal(questState(f.save,'contract_road')!.cycle,1);
    await saveCharacter(f.save);await flushSaves();assert.deepEqual((await loadCharacter(f.save.id))!.quests,f.save.quests);
  }finally{f.inst.destroy();}
});

test('field event requires physical enrollment and actual whole-pack deaths; cooldown cannot spawn on players',()=>{
  const f=fixture(),other=f.add();
  try{
    for(const h of [f,other]){complete(h.save,'silent_wheel');complete(h.save,'high_water');h.at(...app(f.inst,'tender'));assert(h.quest('contract_alarm','accept').ok);}
    assert(!f.inst.mobs.some(m=>m.adventureSite==='overlook'));
    const start=()=>f.cmd('quest',{action:'activateField',target:'survey'});
    assert(!start().ok);f.at(...app(f.inst,'survey'));f.p.deadMs=1;assert(!start().ok);f.p.deadMs=0;assert(start().ok);assert(start().ok);
    const pack=f.inst.mobs.filter(m=>!m.dead&&m.adventureSite==='overlook');assert.equal(pack.length,6);other.at(f.p.x,f.p.y);
    for(const m of pack)killMob(f.inst,m,f.p,'physical','fixture');
    assert.equal(questState(f.save,'contract_alarm')!.step,1);assert.equal(questState(other.save,'contract_alarm')!.step,0,'nearby but never enrolled');
    assert(!start().ok);f.inst.t+=19000;f.inst.spawner.tick(50);assert(!start().ok,'must leave the view before re-arming');
    f.at(...app(f.inst,'tender'));other.at(...app(f.inst,'tender'));f.inst.t+=1000;f.inst.spawner.tick(50);assert.equal(f.inst.spawner.eventStates(f.p.id).find(e=>e.id==='survey_alarm')!.phase,'ready');
    f.at(...app(f.inst,'survey'));assert(start().ok);assert.equal(f.inst.mobs.filter(m=>!m.dead&&m.adventureSite==='overlook').length,6);
  }finally{f.inst.destroy();}
});

test('a despawned event member invalidates completion; finishing survivors lets the event re-arm',()=>{
  const f=fixture();
  try{
    complete(f.save,'silent_wheel');complete(f.save,'high_water');f.at(...app(f.inst,'tender'));assert(f.quest('contract_alarm','accept').ok);f.at(...app(f.inst,'survey'));
    assert(f.cmd('quest',{action:'activateField',target:'survey'}).ok);
    const pack=f.inst.mobs.filter(m=>m.adventureSite==='overlook');f.inst.removeEntity(pack[0].id);
    for(const m of pack.slice(1))killMob(f.inst,m,f.p,'physical','fixture');f.inst.spawner.tick(50);
    assert.equal(questState(f.save,'contract_alarm')!.step,0);assert.equal(f.inst.spawner.eventStates(f.p.id).find(e=>e.id==='survey_alarm')!.phase,'recovering');
  }finally{f.inst.destroy();}
});
