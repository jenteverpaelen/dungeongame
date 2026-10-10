import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { economySnapshot, recordEconomy, validEconomy, ECONOMY_ACTIONS } from '../../shared/src/economy';
import { merchantStock, salePrice } from '../../shared/src/merchant';
import { computeStats } from '../../shared/src/stats';
import { applyAfkGains } from '../src/afk';
import { Instance } from '../src/sim/instance';
import { spawnLoot, updateLoot } from '../src/sim/loot';
import { runCommand } from '../src/commands';
import { ensureDataDir, saveCharacter, flushSaves, loadCharacter, normalizeSave } from '../src/persistence';
import type { Session } from '../src/net/session';
import type { World } from '../src/world';

assert(process.env.DATA_DIR,'isolated DATA_DIR required');ensureDataDir();
let serial=0;
function fixture(zone='hearthmere'){
  const save=createCharacter('Ledger'+ ++serial,'warrior',1);save.gold=10000;save.cube.level=10;
  const inst=new Instance({zoneId:zone,key:'economy'+serial,channel:1,seed:1,theme:zone==='hearthmere'?'town':'glade'});
  const s={save,derived:computeStats(save),sessionId:save.id,pendingEnchant:null,send(){},markDirty(){},changed(){s.derived=computeStats(save);},rec:{inst,kind:inst.kind}} as unknown as Session;
  s.entityId=inst.addPlayer(s);const p=inst.playerById(s.entityId)!;p.debugInfiniteHp=true;
  const at=(x:number,y:number)=>{p.x=p.mv.x=x;p.y=p.mv.y=y;};
  const cmd=(op:Parameters<typeof runCommand>[2],args:Record<string,unknown>)=>runCommand(s,{} as World,op,args);
  return {save,s,p,inst,at,cmd};
}

test('custody moves and socket insertion conserve resources; only release consumes retained gems',()=>{
  const save=createCharacter('Custody','mage',1),item=save.equipment.mainhand!;item.sockets=[{gem:'ruby',rank:1}];
  const before=economySnapshot(save);delete save.equipment.mainhand;save.stash[0]=item;
  assert.deepEqual(economySnapshot(save),before);recordEconomy(save,'destroy',before);assert.equal(save.economy,undefined);
  save.stash[0]=null;save.merchant={revision:1,sequence:0,items:[{item,price:1}]};assert.deepEqual(economySnapshot(save),before);
  save.merchant.items=[];recordEconomy(save,'merchantRelease',before,100);
  assert.equal(save.economy!.activities.merchantRelease!.spent['ruby:1'],1);assert.equal(save.economy!.activities.merchantRelease!.spent.items,1);
  assert.equal(save.economy!.baseline['ruby:1'],1);assert(validEconomy(save.economy));
});

test('actual pickup excludes generated, expired, dead and full-bag loot; offline grants have their own source',()=>{
  const f=fixture();try{
    f.at(100,100);spawnLoot(f.inst,f.p,{type:'gold',amount:25},100,100,false);
    assert.equal(f.save.economy,undefined);f.p.deadMs=100;updateLoot(f.inst,f.p,500);updateLoot(f.inst,f.p,1);assert.equal(f.save.economy,undefined);
    f.p.deadMs=0;updateLoot(f.inst,f.p,1);assert.equal(f.save.economy!.activities.pickup!.gained.gold,25);
    const expired=spawnLoot(f.inst,f.p,{type:'gold',amount:99},100,100,false);expired.ttlMs=1;updateLoot(f.inst,f.p,1);
    f.save.inventory.fill(f.save.equipment.mainhand!);const item=structuredClone(f.save.equipment.chest!);item.id='unclaimed-item';
    spawnLoot(f.inst,f.p,{type:'item',item},100,100,false);updateLoot(f.inst,f.p,600);updateLoot(f.inst,f.p,1);
    assert.equal(f.save.economy!.activities.pickup!.events,1);assert.equal(f.save.economy!.activities.pickup!.gained.items,undefined);
    f.save.inventory.fill(null);f.save.lastZone='rillwake_crossing';f.save.lastSeen=1000;
    const report=applyAfkGains(f.save,601000)!;assert(report.gold>0);assert.equal(f.save.economy!.activities.offline!.gained.gold,report.gold);
    assert.equal(f.save.economy!.activities.offline!.gained.scrap,report.mats.scrap);assert.equal(f.save.economy!.incomplete,false);
  }finally{f.inst.destroy();}
});

test('merchant execution, stale rejection, buyback and reload reconcile without counting custody transfers as gear sinks',async()=>{
  const f=fixture('rillwake_crossing');try{
    const npc=f.inst.map.adventure!.interactions.find(i=>i.id==='tender')!;f.at(npc.x,npc.y+70);
    const offer=merchantStock(f.save)[0],trade=(action:string,itemId:string,price:number)=>f.cmd('merchant',{merchant:'orren',action,itemId,price,sequence:f.save.merchant?.sequence??0});
    assert(trade('buy',offer.item.id,offer.price).ok);const item=f.save.inventory[0]!;
    assert.equal(f.save.economy!.activities.merchantBuy!.spent.gold,offer.price);assert.equal(f.save.economy!.activities.merchantBuy!.gained.items,1);
    const before=structuredClone(f.save);assert(!f.cmd('merchant',{merchant:'orren',action:'buy',itemId:offer.item.id,price:offer.price,sequence:0}).ok);assert.deepEqual(f.save,before);
    assert(trade('sell',item.id,salePrice(item)!).ok);assert.equal(f.save.economy!.activities.merchantSell!.spent.items,undefined);
    assert(trade('buyback',item.id,salePrice(item)!).ok);assert.equal(f.save.economy!.activities.merchantBuyback!.gained.items,undefined);
    assert.equal(f.save.economy!.incomplete,false);await saveCharacter(f.save);await flushSaves();
    const loaded=(await loadCharacter(f.save.id))!;assert.deepEqual(loaded.economy,f.save.economy);assert.deepEqual(loaded.economy!.last,economySnapshot(loaded));
  }finally{f.inst.destroy();}
});

test('real socket/fusion commands record only fees and rank conversion; rejected fusion has no entry',()=>{
  const f=fixture();try{
    const npc=f.inst.map.town!.npcs.find(n=>n.role==='jeweler')!;f.at(...npc.approach);
    const item=f.save.equipment.mainhand!;item.sockets=[null];f.save.gems['ruby:1']=4;
    assert(f.cmd('insertGem',{itemId:item.id,gem:'ruby',rank:1}).ok);assert.equal(f.save.economy,undefined);
    assert(f.cmd('removeGem',{itemId:item.id,idx:0}).ok);
    assert(f.save.economy!.activities.removeGem!.spent.gold>0);assert.equal(f.save.economy!.activities.removeGem!.gained['ruby:1'],undefined);
    assert(f.cmd('fuseGem',{gem:'ruby',rank:1}).ok);const a=f.save.economy!.activities.fuseGem!;
    assert.equal(a.spent['ruby:1'],3);assert.equal(a.gained['ruby:2'],1);assert(a.spent.gold>0);
    const before=structuredClone(f.save);assert(!f.cmd('fuseGem',{gem:'ruby',rank:1}).ok);assert.deepEqual(f.save,before);
    assert.equal(f.save.economy!.incomplete,false);
  }finally{f.inst.destroy();}
});

test('debug, unobserved changes and saturated counters are explicit; no resource history repairs wealth',()=>{
  const save=createCharacter('Bounds','ranger',1),before=economySnapshot(save);save.gold=100;recordEconomy(save,'debug',before,1);
  assert.equal(save.economy!.activities.debug!.gained.gold,100);assert.equal(save.economy!.activities.pickup,undefined);
  save.gold+=5;const gap=economySnapshot(save);save.gold+=2;recordEconomy(save,'pickup',gap,2);
  assert.equal(save.economy!.activities.unclassified!.gained.gold,5);assert.equal(save.economy!.activities.pickup!.gained.gold,2);assert(save.economy!.incomplete);
  save.economy!.activities.debug!.gained.gold=Number.MAX_SAFE_INTEGER;
  const huge=economySnapshot(save);save.gold++;recordEconomy(save,'debug',huge,3);
  assert(validEconomy(save.economy));assert.equal(save.economy!.activities.debug!.gained.gold,Number.MAX_SAFE_INTEGER);assert.equal(save.gold,108);
  for(let i=0;i<100;i++){const b=economySnapshot(save);save.gold++;recordEconomy(save,'pickup',b,4);}
  assert(Object.keys(save.economy!.activities).length<=Object.keys(ECONOMY_ACTIONS).length);
});

test('future or malformed summaries survive normalization and new rewards unchanged; legacy saves remain optional',()=>{
  for(const record of [{revision:99,future:['keep']},{revision:1,activities:{garbled:true}}]){
    const save=createCharacter('Future','mage',1);save.economy=record as never;
    const normalized=normalizeSave(save),before=economySnapshot(normalized);normalized.gold+=5;recordEconomy(normalized,'pickup',before);
    assert.deepEqual(normalized.economy,record);assert.equal(normalized.gold,5);
  }
  assert.equal(normalizeSave(createCharacter('Legacy','warrior',1)).economy,undefined);
});
