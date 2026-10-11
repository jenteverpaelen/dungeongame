import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { recordCreature } from '../../shared/src/bestiary';
import { salePrice, ownedItems, BUYBACK_CAPACITY } from '../../shared/src/merchant';
import { QUESTS } from '../../shared/src/data/quests';
import { contactSpot, questState, writeQuestState } from '../../shared/src/quests';
import { CACHE_GOLD_UNITS, boardUnlocked, bountyGold, drawBounties } from '../../shared/src/bounties';
import { xpToNext } from '../../shared/src/progression';
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
    const quest=(id:string,action:string,target='tender')=>{const q=QUESTS.find(q=>q.id===id)!;return cmd('quest',questRequest(q,questState(save,id),target,action));};
    const trade=(action:string,itemId:string,extra:Record<string,unknown>={})=>cmd('merchant',{merchant:'orren',action,itemId,sequence:save.merchant?.sequence??0,price:action==='sell'?salePrice(save.inventory.find(i=>i?.id===itemId)!):save.merchant?.items.find(e=>e.item.id===itemId)?.price,...extra});
    return {save,s,p,at,cmd,quest,trade};
  };
  return {inst,add,...add()};
}
function complete(save:ReturnType<typeof createCharacter>,id:string){const q=QUESTS.find(q=>q.id===id)!;writeQuestState(save,id,{revision:q.revision,step:q.steps.length,claimed:true});}
const xpTotal=(level:number)=>{let t=0;for(let l=1;l<level;l++)t+=xpToNext(l);return t;};
/** A contact's approach where this character sees it (phasing moves Orren to the mill). */
const spot=(inst:Instance,id:string,save:ReturnType<typeof createCharacter>):[number,number]=>{const c=contactSpot(inst.map.adventure,id,save)!;
  for(let n=0;n<16;n++){const x=c.x+70*Math.cos(n*Math.PI/8),y=c.y+70*Math.sin(n*Math.PI/8);if(inst.cw.isFree(x,y,18)&&!inst.cw.segmentBlocked(x,y,c.x,c.y))return [x,y];}
  throw new Error('no approach to '+id);};

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

test('bounty board: actual authored deaths progress a hunt, each bounty pays once, the cache spills loot and posts a new set',async()=>{
  const f=fixture();
  try{
    const zone='rillwake_crossing';
    // Locked until the zone's story is done; kills before that never count.
    const slime=f.inst.mobs.find(m=>m.adventureSite==='road'&&m.def.id==='bog_slime')!;f.at(slime.x,slime.y+40);killMob(f.inst,slime,f.p,'physical','fixture');
    assert.equal(f.save.bounties,undefined,'no board progress before the board opens');
    complete(f.save,'silent_wheel');complete(f.save,'high_water');assert(boardUnlocked(f.save,zone));
    // A known set for the fixture: a slime hunt, the overlook alarm and Brackjaw.
    f.save.bounties={[zone]:{cycle:0,picks:['hunt_slime','ev_survey_alarm','rare_brackjaw'],progress:[0,0,0],done:0}};
    const gold0=f.save.gold,xp0=f.save.xp+xpTotal(f.save.level);
    for(let round=0;round<8&&!(f.save.bounties[zone].done&1);round++){
      for(const m of f.inst.mobs.filter(m=>!m.dead&&m.adventureSite&&!m.adventureTarget&&m.def.family==='slime')){f.at(m.x,m.y+40);killMob(f.inst,m,f.p,'physical','fixture');if(f.save.bounties[zone].done&1)break;}
      f.at(0,0);f.inst.t+=f.inst.def.respawnSec*1000+2000;f.inst.spawner.tick(50);
    }
    assert.equal(f.save.bounties[zone].progress[0],12);assert.equal(f.save.bounties[zone].done,1,'hunt paid');
    assert.equal(f.save.gold-gold0,bountyGold(zone),'gold paid once on completion');assert(f.save.xp+xpTotal(f.save.level)>xp0,'XP paid');
    const paidGold=f.save.gold;
    const extra=f.inst.mobs.find(m=>!m.dead&&m.def.family==='slime'&&m.adventureSite);if(extra){f.at(extra.x,extra.y+40);killMob(f.inst,extra,f.p,'physical','fixture');}
    assert.equal(f.save.gold,paidGold,'a finished bounty never pays again');
    // The board refuses the cache until all three are done, and only in person.
    f.at(...app(f.inst,'bounty_board'));assert(!f.cmd('quest',{action:'bountyClaim',target:'bounty_board'}).ok);
    f.save.bounties[zone]={...f.save.bounties[zone],progress:[12,1,1],done:7};
    f.at(...app(f.inst,'tender'));assert(!f.cmd('quest',{action:'bountyClaim',target:'bounty_board'}).ok,'not in person');
    f.at(...app(f.inst,'bounty_board'));const before=f.p.loot.size,goldBefore=f.save.gold;
    assert(f.cmd('quest',{action:'bountyClaim',target:'bounty_board'}).ok);
    assert.equal(f.p.loot.size-before,2,'one rare and one magic item spilled at the board');
    assert.deepEqual([...f.p.loot].slice(-2).map(l=>l.payload.type==='item'?l.payload.item.rarity:'').sort(),['magic','rare']);
    assert.equal(f.save.gold-goldBefore,bountyGold(zone,CACHE_GOLD_UNITS));
    assert.equal(f.save.bounties[zone].cycle,1);assert.equal(f.save.bounties[zone].done,0);assert.deepEqual(f.save.bounties[zone].picks,drawBounties(f.save.id,zone,1));
    assert(!f.cmd('quest',{action:'bountyClaim',target:'bounty_board'}).ok,'no second cache');
    await saveCharacter(f.save);await flushSaves();assert.deepEqual((await loadCharacter(f.save.id))!.bounties,f.save.bounties);
  }finally{f.inst.destroy();}
});

test('field event requires physical enrollment and actual whole-pack deaths; cooldown cannot spawn on players',()=>{
  const f=fixture(),other=f.add();
  try{
    for(const h of [f,other]){complete(h.save,'silent_wheel');h.at(...spot(f.inst,'tender',h.save));assert(h.quest('high_water','accept').ok);h.at(...app(f.inst,'survey'));assert(h.quest('high_water','inspect','survey').ok);}
    assert.equal(questState(f.save,'high_water')!.step,1,'the alarm is the current objective');
    assert(!f.inst.mobs.some(m=>m.adventureSite==='overlook'));
    const start=()=>f.cmd('quest',{action:'activateField',target:'survey'});
    f.at(...app(f.inst,'tender'));assert(!start().ok);f.at(...app(f.inst,'survey'));f.p.deadMs=1;assert(!start().ok);f.p.deadMs=0;assert(start().ok);assert(start().ok);
    const pack=f.inst.mobs.filter(m=>!m.dead&&m.adventureSite==='overlook');assert.equal(pack.length,6);other.at(f.p.x,f.p.y);
    for(const m of pack)killMob(f.inst,m,f.p,'physical','fixture');
    assert.equal(questState(f.save,'high_water')!.step,2);assert.equal(questState(other.save,'high_water')!.step,1,'nearby but never enrolled');
    assert(!start().ok);f.inst.t+=19000;f.inst.spawner.tick(50);assert(!start().ok,'must leave the view before re-arming');
    f.at(...app(f.inst,'tender'));other.at(...app(f.inst,'tender'));f.inst.t+=1000;f.inst.spawner.tick(50);assert.equal(f.inst.spawner.eventStates(f.p.id).find(e=>e.id==='survey_alarm')!.phase,'ready');
    f.at(...app(f.inst,'survey'));assert(start().ok);assert.equal(f.inst.mobs.filter(m=>!m.dead&&m.adventureSite==='overlook').length,6);
  }finally{f.inst.destroy();}
});

test('a despawned event member invalidates completion; finishing survivors lets the event re-arm',()=>{
  const f=fixture();
  try{
    complete(f.save,'silent_wheel');f.at(...spot(f.inst,'tender',f.save));assert(f.quest('high_water','accept').ok);
    f.at(...app(f.inst,'survey'));assert(f.quest('high_water','inspect','survey').ok);
    assert(f.cmd('quest',{action:'activateField',target:'survey'}).ok);
    const pack=f.inst.mobs.filter(m=>m.adventureSite==='overlook');f.inst.removeEntity(pack[0].id);
    for(const m of pack.slice(1))killMob(f.inst,m,f.p,'physical','fixture');f.inst.spawner.tick(50);
    assert.equal(questState(f.save,'high_water')!.step,1);assert.equal(f.inst.spawner.eventStates(f.p.id).find(e=>e.id==='survey_alarm')!.phase,'recovering');
  }finally{f.inst.destroy();}
});
