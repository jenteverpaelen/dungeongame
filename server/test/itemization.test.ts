import { Instance } from '../src/sim/instance';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, addToInventory, playerLook } from '../../shared/src/character';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import { computeStats } from '../../shared/src/stats';
import { collectionKey, seedCollection } from '../../shared/src/itemCollection';
import { combatInteger, boundedCombat, MAX_COMBAT_AMOUNT } from '../../shared/src/combatBounds';
import { isPersistedCommand } from '../../shared/src/commandState';
import { Social } from '../src/social';
import { Parties } from '../src/party';
import { World } from '../src/world';
import { runCommand } from '../src/commands';
import type { Session } from '../src/net/session';
import { ensureDataDir, normalizeSave, saveCharacter, loadCharacter, flushSaves } from '../src/persistence';
import { spawnLoot, updateLoot } from '../src/sim/loot';

assert(process.env.DATA_DIR,'Use isolated DATA_DIR');assert.equal(process.env.BACKUP_KEEP,'0');
let seq=0;
async function fixture(){
 const world=new World();await world.init();const save=createCharacter(`ItemCheck${++seq}`,'warrior',seq);save.level=70;save.cube.level=8;save.gold=1e9;
 for(const k of Object.keys(save.materials) as (keyof typeof save.materials)[])save.materials[k]=10000;
 const s={save,derived:computeStats(save),sessionId:save.id,rec:null,entityId:0,homeTown:null,hold:null,pendingEnchant:null,send(){},sendRaw(){},markDirty(){},saveNow(){},autosave(){},kick(){},shutdown(){},changed(){s.derived=computeStats(s.save);}} as unknown as Session;
 world.login(s,(you,zone)=>({t:'welcome',you,char:save,derived:s.derived,zone,time:Date.now(),world:world.infoFor(s)}));
 const near=(role:string)=>{const n=s.rec!.inst.map.town!.npcs.find(n=>n.role===role)!;const p=(s.rec!.inst as Instance).playerById(s.entityId)!;p.x=p.mv.x=n.approach[0];p.y=p.mv.y=n.approach[1];p.hp=p.mhp;p.deadMs=0;};
 const cmd=(a:Record<string,unknown>)=>runCommand(s,world,'collection',a);
 return {world,s,save,near,cmd,close:()=>{world.logout(s);world.shutdown();}};
}
const rare=(seed:number)=>generateItem(new Rng(seed),{ilvl:70,classId:'warrior',rarity:'rare',base:'head_horned',smartChance:1});

test('legacy acquisition history preserves item identity, failed pickup does not unlock, persisted wardrobe survives consumption',async()=>{
 ensureDataDir();const save=createCharacter('CollectionSave','warrior',1),item=rare(999);delete save.collection;save.version=13;save.stash[0]=item;
 const equipment=structuredClone(save.equipment);normalizeSave(save);assert.equal(save.version,14);assert.deepEqual(save.equipment,equipment);assert.deepEqual(save.stash[0],item);
 const unknown=generateItem(new Rng(2),{ilvl:70,classId:'warrior',rarity:'legendary',legendary:'faultcleaver'});
 save.inventory.fill(item);assert.equal(addToInventory(save,unknown),-1);assert(!save.collection!.looks[collectionKey(unknown)]);
 save.inventory.fill(null);addToInventory(save,unknown);save.inventory[0]=null;await saveCharacter(save);await flushSaves();const loaded=(await loadCharacter(save.id))!;
 assert(loaded.collection!.looks[collectionKey(unknown)]);assert(isPersistedCommand('collection'));
 const bad=structuredClone(save);bad.collection!.revision=99 as 1;assert.throws(()=>normalizeSave(bad),/collection/);
});
test('Mystic authenticates physical range and appearance compatibility without changing combat or saved item look',async()=>{
 const f=await fixture();try{
  const item=generateItem(new Rng(8),{ilvl:70,classId:'warrior',rarity:'set',set:'cinder_oath',base:'head_horned'});addToInventory(f.save,item);
  f.save.equipment.head=rare(77);
  const slot='head',key=collectionKey(item),before=structuredClone(f.save.equipment),stats=computeStats(f.save);
  f.near('blacksmith');assert(!f.cmd({action:'look',slot,key,x:0,y:0}).ok);assert.deepEqual(f.save.equipment,before);
  f.near('mystic');assert(f.cmd({action:'look',slot,key}).ok);assert.deepEqual(computeStats(f.save),stats);assert.deepEqual(playerLook(f.save).slots.head,item.look);assert.deepEqual(f.save.equipment,before);
  assert(!f.cmd({action:'look',slot:'mainhand',key}).ok);assert(f.cmd({action:'look',slot,key:null}).ok);assert.deepEqual(playerLook(f.save).slots.head,before.head!.look);
 }finally{f.close();}
});
test('forge and set conversion require the right NPC and capacity; protected inputs and Ancient laundering are rejected',async()=>{
 const f=await fixture();try{
  f.near('mystic');const before=JSON.stringify(f.save);assert(!f.cmd({action:'recipe',recipe:'forge',base:'sword'}).ok);assert.equal(JSON.stringify(f.save),before);
  f.near('blacksmith');assert(f.cmd({action:'recipe',recipe:'forge',base:'sword'}).ok);assert.equal(f.save.inventory[0]!.rarity,'rare');assert(!f.save.inventory[0]!.vendorStock);
  f.save.inventory.fill(rare(1));const full=JSON.stringify(f.save);assert(!f.cmd({action:'recipe',recipe:'forge',base:'sword'}).ok);assert.equal(JSON.stringify(f.save),full);f.save.inventory.fill(null);
  const item=generateItem(new Rng(2),{ilvl:70,classId:'warrior',rarity:'set',set:'endless_storm',base:'head_horned'});item.ancient=2;item.sockets=[{gem:'ruby',rank:6}];item.protected=true;addToInventory(f.save,item);
  f.near('cube');const args={action:'recipe',recipe:'convertSet',itemId:item.id,set:'fault_warden',base:'feet_greaves'};assert(!f.cmd(args).ok);item.protected=false;
  assert(f.cmd(args).ok);const fresh=f.save.inventory[0]!;assert.equal(fresh.ancient,0);assert.equal(fresh.set,'fault_warden');assert.equal(fresh.ilvl,70);assert.notEqual(fresh.id,item.id);assert.equal(f.save.gems['ruby:6'],1);assert(!f.cmd(args).ok);
 }finally{f.close();}
});
test('gem exchange is a bounded three-to-one sink, same-family/invalid-rank/remote operations cannot charge',async()=>{
 const f=await fixture();try{
  f.save.gems['ruby:6']=3;f.near('jeweler');const args={action:'recipe',recipe:'exchange',from:'ruby',to:'pearlglass',rank:6};
  const before=JSON.stringify(f.save);assert(!f.cmd({...args,rank:NaN}).ok);assert(!f.cmd({...args,to:'ruby'}).ok);assert.equal(JSON.stringify(f.save),before);
  assert(f.cmd(args).ok);assert.equal(f.save.gems['ruby:6'],0);assert.equal(f.save.gems['pearlglass:6'],1);assert(!f.cmd(args).ok);
 }finally{f.close();}
});
test('loot automation preserves protected, empowered, socketed, vendor and valuable items; pickup opt-out is authoritative',async()=>{
 const f=await fixture();try{
  assert(f.cmd({action:'rules',rules:{hidden:['rare'],leave:['rare'],salvage:['rare']}}).ok);
  const items=Array.from({length:6},(_,i)=>rare(i+11));items[1].protected=true;items[2].upgrade=1;items[3].sockets=[{gem:'ruby',rank:1}];items[4].vendorStock=true;items[5].enchanted=0;
  items.forEach(i=>addToInventory(f.save,i));f.near('mystic');const before=JSON.stringify(f.save);assert(!f.cmd({action:'autoSalvage'}).ok);assert.equal(JSON.stringify(f.save),before);
  f.near('blacksmith');assert.equal((f.cmd({action:'autoSalvage'}).data as {count:number}).count,1);assert(!f.save.inventory[0]);assert(items.slice(1).every(i=>f.save.inventory.includes(i)));
  const p=(f.s.rec!.inst as Instance).playerById(f.s.entityId)!,ground=rare(88);spawnLoot((f.s.rec!.inst as Instance),p,{type:'item',item:ground},p.x,p.y,false);for(const l of p.loot)l.armMs=0;updateLoot((f.s.rec!.inst as Instance),p,50);assert(!f.save.inventory.some(i=>i?.id===ground.id));
  assert(f.cmd({action:'rules',rules:{hidden:[],leave:[],salvage:[]}}).ok);updateLoot((f.s.rec!.inst as Instance),p,50);assert(f.save.inventory.some(i=>i?.id===ground.id));
  assert(!f.cmd({action:'rules',rules:{hidden:['legendary'],leave:[],salvage:[]}}).ok);
 }finally{f.close();}
});
test('chat links snapshot only sender-owned gear and retain audience block rules',()=>{
 const live=new Set<Session>(),messages:any[]=[];const parties=new Parties(()=>live);const social=new Social(()=>live,parties);
 const a={save:createCharacter('LinkA','warrior',1),send(m:unknown){messages.push(m);},changed(){},rec:{zoneId:'hearthmere',channel:0}} as unknown as Session;
 const b={save:createCharacter('LinkB','warrior',2),send(m:unknown){messages.push(m);},changed(){},rec:a.rec} as unknown as Session;
 live.add(a);live.add(b);(a.rec as any).members=live;const item=rare(44);addToInventory(a.save,item);
 assert(!social.chat(b,`[[item:${item.id}]]`,'zone').ok);assert.equal(messages.length,0);
 assert(social.chat(a,`[[item:${item.id}]]`,'zone').ok);assert.equal(messages.length,2);assert.deepEqual(messages[0].item,item);item.upgrade=9;assert.equal(messages[0].item.upgrade,0);
 social.command(b,{action:'block',name:a.save.name});messages.length=0;assert(social.chat(a,`[[item:${item.id}]]`,'zone').ok);assert.equal(messages.length,1);
});
test('combat ceiling preserves ordinary fractional arithmetic and bounds extreme HP and hit quantities',()=>{
 assert.equal(boundedCombat(12.25),12.25);assert.equal(combatInteger(12.6),13);assert.equal(combatInteger(Infinity),MAX_COMBAT_AMOUNT);assert.equal(combatInteger(NaN),1);
 for(const n of [-Infinity,-1,0,1,Number.MAX_VALUE,Infinity,NaN])assert(Number.isSafeInteger(combatInteger(n)));
 const save=createCharacter('Bounds','warrior',6);const item=rare(6);item.affixes=[{stat:'vit',value:Number.MAX_VALUE,min:0,max:Number.MAX_VALUE,primary:true}];save.equipment.head=item;
 assert.equal(computeStats(save).life,MAX_COMBAT_AMOUNT);assert(Number.isFinite(computeStats(save).toughness));
});
