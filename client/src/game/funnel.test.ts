import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '@shared/character';
import { recordIntro,startIntro } from '@shared/onboarding';
import { FunnelStore,FUNNEL_KEY } from './funnel';

test('observation requires consent, first events stay fixed, hidden time and old achievements are excluded',()=>{
  const data=new Map<string,string>(),disk={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
  const store=new FunnelStore(disk),save=createCharacter('PrivateName','mage',1);
  startIntro(save);recordIntro(save,'move');store.observe(save);store.event('kill');assert.equal(store.get().records.length,0);
  store.start('scripted',save,100);store.observe(save);assert.deepEqual(store.get().records[0].first,{});
  store.clock(200,true);save.stats.kills++;store.observe(save);assert.equal(store.get().records[0].first.kill,100);
  store.clock(300,false);store.clock(10000,true);store.clock(10100,true);store.event('loot');store.event('kill');
  assert.deepEqual(store.get().records[0].first,{kill:100,loot:300});store.start('human',save,10200);assert.equal(store.get().records.length,1);
  store.stop();store.event('elite');assert.equal(store.get().records[0].first.elite,undefined);
  assert(!store.export().includes(save.name));assert(!store.export().includes(save.id));
  const restored=new FunnelStore(disk);assert.equal(restored.get().active,false);assert(restored.get().records[0].ended);
  assert.equal(restored.get().records[0].kind,'scripted');restored.clear();assert.equal(JSON.parse(data.get(FUNNEL_KEY)!).records.length,0);
});
test('unsupported saves and unavailable storage do not break play; unknown identity fields never survive a load',()=>{
  const save=createCharacter('PrivateName','warrior',1);save.onboarding={revision:99,done:'not-an-array'} as any;
  const store=new FunnelStore({getItem(){throw Error('denied');},setItem(){throw Error('denied');}});
  store.start('scripted',save,0);store.observe(save);assert.equal(store.get().retained,false);
  const raw={version:1,records:[{kind:'human',classId:'mage',protocol:10,elapsedMs:100,first:{kill:50},name:'Secret'},
    {kind:'human',classId:'mage',protocol:10,elapsedMs:100,first:{name:50}}]};
  const reload=new FunnelStore({getItem:()=>JSON.stringify(raw),setItem(){}});
  assert.equal(reload.get().records.length,1);assert(!reload.export().includes('Secret'));
});
