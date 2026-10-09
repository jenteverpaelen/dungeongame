import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PreferenceStore, DEFAULT_PREFERENCES, PREFERENCES_KEY } from './preferences';

test('independent preferences survive a new store, including zero volume and false shake', () => {
  const data = new Map<string,string>();
  const storage = { getItem:(k:string)=>data.get(k)??null, setItem:(k:string,v:string)=>{data.set(k,v);} };
  const store = new PreferenceStore(storage);
  assert.deepEqual(store.get().values,DEFAULT_PREFERENCES);
  store.set({masterVolume:0.4,effectsVolume:0,ambienceVolume:0.7,muted:true,cameraShake:false,reduceFlashes:true,lootQualityLabels:true});
  const reloaded = new PreferenceStore(storage);
  assert.deepEqual(reloaded.get().values,store.get().values);
  assert.equal(JSON.parse(data.get(PREFERENCES_KEY)!).version,1);
  reloaded.reset();
  assert.deepEqual(new PreferenceStore(storage).get().values,DEFAULT_PREFERENCES);
});

test('malformed or unsupported storage cannot stop boot; values are type checked and clamped', () => {
  for (const raw of ['{broken','null','[]','{"version":2,"values":{"muted":true}}']) {
    assert.deepEqual(new PreferenceStore({getItem:()=>raw,setItem(){}}).get().values,DEFAULT_PREFERENCES);
  }
  const store = new PreferenceStore({getItem:()=>JSON.stringify({version:1,values:{masterVolume:-2,effectsVolume:9,ambienceVolume:'0',muted:'false',cameraShake:false}}),setItem(){}});
  assert.deepEqual(store.get().values,{...DEFAULT_PREFERENCES,masterVolume:0,effectsVolume:1,cameraShake:false});
  store.set({masterVolume:NaN,effectsVolume:Infinity});
  assert.equal(store.get().values.masterVolume,0.8); assert.equal(store.get().values.effectsVolume,1);
});

test('unavailable storage keeps session controls working and reports non-retention', () => {
  const store = new PreferenceStore({getItem(){throw Error('denied');},setItem(){throw Error('quota');}});
  let notifications=0;const unsubscribe=store.subscribe(()=>notifications++);
  store.set({muted:true,cameraShake:false});
  assert.equal(store.get().retained,false); assert.equal(store.get().values.muted,true);
  assert.equal(store.get().values.cameraShake,false); assert.equal(notifications,1);
  unsubscribe();store.reset();assert.equal(notifications,1);
  assert.deepEqual(store.get().values,DEFAULT_PREFERENCES);
});

test('existing version1 preferences preserve prior settings and default missing/invalid optional visual controls off', () => {
  for (const reduceFlashes of [undefined, 'true', 1, null]) {
    const raw = JSON.stringify({version:1,values:{cameraShake:false,muted:true,masterVolume:0.3,reduceFlashes,lootQualityLabels:reduceFlashes}});
    const store = new PreferenceStore({getItem:()=>raw,setItem(){}});
    assert.equal(store.get().values.reduceFlashes,false);
    assert.equal(store.get().values.lootQualityLabels,false);
    assert.equal(store.get().values.cameraShake,false);
    assert.equal(store.get().values.muted,true);
    assert.equal(store.get().values.masterVolume,0.3);
  }
});
