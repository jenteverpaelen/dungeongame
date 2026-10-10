import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter} from '../../shared/src/character';
import {merchantStock,MERCHANTS,salePrice,stockPrice} from '../../shared/src/merchant';
import {baseArmor,baseGoldAmount,canClassUse,goldAmount} from '../../shared/src/items';
import {BASES} from '../../shared/src/data/items';
import {Rng} from '../../shared/src/math';
import {computeStats} from '../../shared/src/stats';
import {salvageYield,salvageXp} from '../../shared/src/cube';
import {Instance} from '../src/sim/instance';
import {runCommand} from '../src/commands';
import type {Session} from '../src/net/session';
import type {World} from '../src/world';
import {ensureDataDir,saveCharacter,flushSaves,loadCharacter,normalizeSave} from '../src/persistence';
assert(process.env.DATA_DIR,'isolated DATA_DIR required');ensureDataDir();
let serial=0;
function fixture(zone='rillwake_crossing'){
  const save=createCharacter('Stock'+ ++serial,'warrior',4);save.level=12;save.gold=10000;
  const inst=new Instance({zoneId:zone,key:'stock'+serial,channel:1,seed:4,theme:zone==='hearthmere'?'town':'glade'});
  const s={save,derived:computeStats(save),sessionId:save.id,pendingEnchant:null,send(){},markDirty(){},changed(){s.derived=computeStats(save);},rec:{inst,kind:inst.kind}} as unknown as Session;
  s.entityId=inst.addPlayer(s);const p=inst.playerById(s.entityId)!;p.debugInfiniteHp=true;
  const at=(x:number,y:number)=>{p.x=p.mv.x=x;p.y=p.mv.y=y;};
  const def=MERCHANTS.find(m=>m.zone===zone);
  const near=()=>{const n=inst.map.adventure!.interactions.find(i=>i.id===def!.target)!;at(n.x,n.y+70);};
  const cmd=(op:Parameters<typeof runCommand>[2],a:Record<string,unknown>)=>runCommand(s,{} as World,op,a);
  const offer=merchantStock(save)[0];
  const buy=(extra:Record<string,unknown>={})=>cmd('merchant',{merchant:def?.id,action:'buy',itemId:offer.item.id,price:offer.price,sequence:save.merchant?.sequence??0,...extra});
  return {save,inst,s,p,at,near,cmd,offer,buy};
}

test('stock is stable, class-usable and within existing normal stat budgets; the gold refactor is byte-for-byte arithmetic compatible',()=>{
  for(const classId of ['warrior','ranger','mage'] as const)for(let level=1;level<=70;level++){
    const a=merchantStock({classId,level}),b=merchantStock({classId,level});assert.deepEqual(a,b);assert.equal(a.length,10);
    assert.equal(new Set(a.map(e=>e.item.kind)).size,10);
    for(const e of a){assert(canClassUse(classId,e.item));assert(e.item.reqLevel<=level);assert.equal(e.item.ilvl,Math.min(level,50));assert(e.item.vendorStock);assert.equal(e.item.affixes.length,0);
      assert(e.price>salePrice(e.item)!);assert.deepEqual(salvageYield(e.item),{});assert.equal(salvageXp(e.item),0);
      if(e.item.armor!==undefined)assert.equal(e.item.armor,baseArmor(e.item.ilvl,BASES[e.item.base]));
    }
    const r1=new Rng(level),r2=new Rng(level);for(let i=0;i<10;i++)assert.equal(goldAmount(r1,level,17),Math.max(1,Math.round((4+level*2.5)*Math.pow(1.06,level)*r2.range(.6,1.4)*1.17)));
    assert(stockPrice(level)>Math.round(baseGoldAmount(level)));
  }
});

test('every camp merchant rejects remote/dead/forged/stale/full/poor purchases before mutation',()=>{
  for(const m of MERCHANTS){const f=fixture(m.zone);try{
    const reject=(extra:Record<string,unknown>={})=>{const before=structuredClone(f.save);assert(!f.buy(extra).ok);assert.deepEqual(f.save,before);};
    f.at(0,0);reject();f.near();f.p.deadMs=1;reject();f.p.deadMs=0;
    reject({merchant:'forged'});reject({price:-1});reject({price:f.offer.price-1});reject({sequence:1});reject({itemId:f.offer.item.id.replace(':12:',':20:')});
    f.save.gold=f.offer.price-1;reject();f.save.gold=10000;
    f.save.inventory.fill(f.save.equipment.mainhand!);reject();f.save.inventory.fill(null);
    f.save.merchant={revision:99,sequence:0,items:[]} as never;reject();delete f.save.merchant;
    assert(f.buy().ok);assert.equal(f.save.gold,10000-f.offer.price);
    assert.notEqual(f.save.inventory[0]!.id,f.offer.item.id);assert.deepEqual({...f.save.inventory[0],id:f.offer.item.id},f.offer.item);
  }finally{f.inst.destroy();}}
});

test('purchase sequence survives reload; buy/sell/buyback never creates gold or duplicate gear',async()=>{
  const f=fixture();try{
    f.near();const start=f.save.gold;assert(f.buy().ok);const item=f.save.inventory[0]!;assert(!f.buy({sequence:0}).ok);
    await saveCharacter(f.save);await flushSaves();Object.assign(f.save,(await loadCharacter(f.save.id))!);assert(!f.buy({sequence:0}).ok);
    const price=salePrice(item)!;assert(f.cmd('merchant',{merchant:'orren',action:'sell',itemId:item.id,price,sequence:1}).ok);
    assert.equal(f.save.gold,start-f.offer.price+price);assert(f.save.gold<start);
    assert(f.cmd('merchant',{merchant:'orren',action:'buyback',itemId:item.id,price,sequence:2}).ok);
    assert.deepEqual(f.save.inventory[0],item);assert.equal(f.save.gold,start-f.offer.price);
    for(let i=0;i<15;i++)assert(f.buy().ok);assert.equal(new Set(f.save.inventory.filter(Boolean).map(i=>i!.id)).size,16);
    const old={...structuredClone(f.save),version:8};old.inventory[0]!.vendorStock='future' as never;
    const normalized=normalizeSave(old);assert(normalized.inventory[0]!.vendorStock);assert(normalized.merchant);
  }finally{f.inst.destroy();}
});

test('stock provenance survives equip/stash/reload and both salvage paths preserve it without rewards',async()=>{
  const f=fixture('hearthmere');try{
    const stock=merchantStock(f.save)[0].item;stock.id='owned-stock';f.save.inventory[0]=stock;
    const near=(role:string)=>{const n=f.inst.map.town!.npcs.find(n=>n.role===role)!;f.at(...n.approach);};
    assert(f.cmd('equip',{itemId:stock.id,slot:'mainhand'}).ok);assert(f.save.equipment.mainhand!.bound);assert(f.save.equipment.mainhand!.vendorStock);
    assert(f.cmd('unequip',{slot:'mainhand'}).ok);near('stash');assert(f.cmd('stashDeposit',{itemId:stock.id}).ok);assert(f.cmd('stashWithdraw',{itemId:stock.id}).ok);
    await saveCharacter(f.save);await flushSaves();Object.assign(f.save,(await loadCharacter(f.save.id))!);
    near('blacksmith');const before=structuredClone(f.save);assert(!f.cmd('salvage',{itemId:stock.id}).ok);assert.deepEqual(f.save,before);
    const loot=structuredClone(f.save.equipment.chest!);loot.id='ordinary-loot';delete loot.vendorStock;f.save.inventory[f.save.inventory.indexOf(null)]=loot;
    const mats=f.save.materials.scrap,xp=f.save.cube.xp;
    assert(f.cmd('salvageAll',{rarities:['normal']}).ok);assert(f.save.inventory.some(i=>i?.id===stock.id));
    assert.equal(f.save.materials.scrap,mats+salvageYield(loot).scrap!+1); // unequipped original normal sword is also ordinary loot
    assert.equal(f.save.cube.xp,xp+salvageXp(loot)+2);
  }finally{f.inst.destroy();}
});
