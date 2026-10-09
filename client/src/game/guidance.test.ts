import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '@shared/character';
import { TIER_COSTS } from '@shared/data/skills';
import { GuidanceStore, GUIDANCE_KEY, eligibleHints } from './guidance';

const character=()=>createCharacter('Guidefixture','mage',41);
test('only unused level1 characters opt in automatically; local dismissal and opt-in survive reload',()=>{
  const data=new Map<string,string>(),disk={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
  const store=new GuidanceStore(disk),save=character();store.ensure(save);
  assert.equal(store.get().characters[save.id].automatic,true);
  store.dismiss(save.id,'steer');store.enable(save.id,false);
  const reload=new GuidanceStore(disk);reload.ensure(save);
  assert.deepEqual(reload.get().characters[save.id],{automatic:false,dismissed:['steer']});
  save.id='returning';save.level=12;reload.ensure(save);assert.equal(reload.get().characters[save.id].automatic,false);
  reload.enable(save.id,true);assert.equal(reload.get().characters[save.id].automatic,true);
  reload.dismiss('guidefixture','steer',false);assert.deepEqual(reload.get().characters.guidefixture.dismissed,[]);
  assert.equal(JSON.parse(data.get(GUIDANCE_KEY)!).version,1);
});
test('hints require real actionable state and never alter inventory, quests or skill points',()=>{
  const save=character();assert.deepEqual(eligibleHints(save,'hearthmere'),['steer']);
  save.skillPoints=TIER_COSTS[0]-1;assert.equal(eligibleHints(save,'hearthmere').includes('points'),false);
  save.skillPoints=TIER_COSTS[0];assert.equal(eligibleHints(save,'hearthmere').includes('points'),true);
  const item=structuredClone(save.equipment.mainhand!);item.id='earned';save.inventory[0]=item;
  save.rillwake={revision:1,cart:true,warden:true,ledger:true,claimed:true,reward:item};
  const before=JSON.stringify(save),hints=eligibleHints(save,'hearthmere','blacksmith');
  assert.ok(hints.includes('gear'));assert.ok(hints.includes('reward'));assert.ok(hints.includes('services'));assert.equal(hints.includes('bag'),false);
  assert.equal(JSON.stringify(save),before);
  save.inventory=save.inventory.map(()=>item);assert.equal(eligibleHints(save,'hearthmere')[0],'bag');
  save.inventory[0]=null;assert.equal(eligibleHints(save,'hearthmere').includes('bag'),false);
  delete save.rillwake;assert.ok(eligibleHints(save,'rillwake_crossing').includes('quest'));
});
test('malformed or unavailable local storage cannot prevent guidance or alter characters',()=>{
  const save=character();
  for(const raw of ['{broken','null','[]','{"version":9,"characters":{}}']) {
    const store=new GuidanceStore({getItem:()=>raw,setItem(){}});store.ensure(save);assert.equal(store.get().characters[save.id].automatic,true);
  }
  const store=new GuidanceStore({getItem(){throw Error('denied');},setItem(){throw Error('quota');}});
  store.ensure(save);store.dismiss(save.id,'gear');assert.equal(store.get().retained,false);assert.ok(store.get().characters[save.id].dismissed.includes('gear'));
});
