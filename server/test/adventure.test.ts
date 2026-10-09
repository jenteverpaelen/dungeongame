import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter} from '../../shared/src/character';
import {computeStats} from '../../shared/src/stats';
import {Instance} from '../src/sim/instance';
import {killMob} from '../src/sim/kills';
import {damagePlayer} from '../src/sim/damage';
import {runCommand} from '../src/commands';
import {normalizeSave,saveCharacter,loadCharacter,flushSaves} from '../src/persistence';
import type {Session} from '../src/net/session';
import type {World} from '../src/world';
import type {ClassId} from '../../shared/src/types';

function fixture(cls:ClassId='warrior') {
  const save=createCharacter(`Rillwake${cls}`,cls,1);
  const inst=new Instance({zoneId:'rillwake_crossing',seed:1,channel:1,key:'rillwake#1',theme:'glade'});
  const s={save,derived:computeStats(save),sessionId:'adventure-test',send(){},markDirty(){},changed(){},rec:{inst}} as unknown as Session;
  const id=inst.addPlayer(s),p=inst.playerById(id)!;
  const at=(x:number,y:number)=>{p.x=p.mv.x=x;p.y=p.mv.y=y;p.deadMs=0;p.hp=p.mhp;};
  const near=(id:string)=>{const i=inst.map.adventure!.interactions.find(i=>i.id===id)!;at(i.x,i.y+65);};
  const cmd=(action:string,target='tender')=>runCommand(s,{} as World,'adventure',{action,target});
  const kill=()=>{const m=inst.mobs.find(m=>m.adventureTarget==='mill'&&!m.dead)!;at(m.x,m.y+80);killMob(inst,m,p,'physical','test');};
  return {s,save,inst,p,at,near,cmd,kill};
}

for(const cls of ['warrior','mage','ranger'] as const)test(`${cls}: actual quest handlers, kill credit, full-bag retry, duplicate claim and optional-save round trip`,async()=>{
  const f=fixture(cls);
  try{
    assert.equal(f.save.rillwake,undefined);
    assert.equal(f.cmd('accept').ok,false,'remote accept');
    f.near('tender');f.p.deadMs=1;assert.equal(f.cmd('accept').ok,false,'dead accept');f.p.deadMs=0;
    assert.equal(f.cmd('accept','cart').ok,false,'wrong target');
    assert.equal(f.cmd('accept').ok,true);assert.equal(f.save.rillwake!.reward,undefined);
    assert.equal(f.cmd('accept').ok,false,'cannot reset quest');
    assert.equal(f.cmd('claim').ok,false,'unfinished');
    f.near('ledger');assert.equal(f.cmd('inspect','ledger').ok,false,'sequence');
    f.near('cart');assert.equal(f.cmd('inspect','cart').ok,true);assert.equal(f.cmd('inspect','cart').ok,true,'repeat harmless');
    f.kill();assert.equal(f.save.rillwake!.warden,true);
    f.at(3340,665);assert.equal(f.cmd('inspect','ledger').ok,false,'mill wall');
    f.near('ledger');assert.equal(f.cmd('inspect','ledger').ok,true);
    const reward=structuredClone(f.save.rillwake!.reward!);
    assert.equal(reward.ilvl,f.save.level);assert.equal(reward.rarity,'magic');assert.equal(reward.base,cls==='mage'?'staff':cls==='ranger'?'bow':'sword');
    assert.equal(f.cmd('inspect','ledger').ok,true);assert.deepEqual(f.save.rillwake!.reward,reward,'repeat inspection cannot reroll');
    f.near('tender');f.save.inventory.fill({...reward,id:'bag-fixture'});const before=JSON.stringify(f.save);
    assert.equal(f.cmd('claim').ok,false);assert.equal(JSON.stringify(f.save),before,'full bag loses nothing');
    f.save.inventory[0]=null;assert.equal(f.cmd('claim').ok,true,'slot zero succeeds');
    assert.deepEqual(f.save.inventory[0],reward);assert.equal(f.save.rillwake!.claimed,true);
    assert.equal(f.cmd('claim').ok,false);assert.equal(f.save.inventory.filter(i=>i?.id===reward.id).length,1);
    const normalized=normalizeSave(JSON.parse(JSON.stringify(f.save)));assert.deepEqual(normalized.rillwake,f.save.rillwake);
    await saveCharacter(f.save);await flushSaves();const reloaded=await loadCharacter(f.save.id);assert.deepEqual(reloaded!.rillwake,f.save.rillwake);assert.deepEqual(reloaded!.inventory[0],reward);
  } finally{f.inst.destroy();}
});

test('remote and reward-suppressed kills cannot finish the quest; cleared sites stay clear nearby',()=>{
  const f=fixture();
  try{
    f.near('tender');f.cmd('accept');f.near('cart');f.cmd('inspect','cart');
    const target=f.inst.mobs.find(m=>m.adventureTarget==='mill')!;
    f.near('tender');killMob(f.inst,target,f.p,'physical','remote');assert.equal(f.save.rillwake!.warden,false);
    const oldMobs=[...f.inst.mobs];for(const m of oldMobs)if(!m.dead)killMob(f.inst,m,null,'physical','cleanup');
    assert.equal(f.inst.spawner.livePacks(),0);
    f.at(3210,1200);f.inst.t=30000;f.inst.spawner.tick(50);
    assert(!f.inst.mobs.some(m=>!m.dead&&m.adventureTarget==='mill'),'no visible respawn');
    f.near('tender');f.inst.t=60000;f.inst.spawner.tick(50);
    const respawn=f.inst.mobs.find(m=>!m.dead&&m.adventureTarget==='mill')!;assert(respawn);
    f.at(respawn.x,respawn.y+80);respawn.noReward=true;killMob(f.inst,respawn,f.p,'physical','suppressed');assert.equal(f.save.rillwake!.warden,false);
  } finally{f.inst.destroy();}
});

test('no quest credit for pre-accept, pre-cart, dead or unrelated kills',()=>{
  for(const mode of ['pre-accept','pre-cart','dead','unrelated']) {
    const f=fixture();
    try {
      if(mode!=='pre-accept'){f.near('tender');f.cmd('accept');}
      if(mode==='dead'||mode==='unrelated'){f.near('cart');f.cmd('inspect','cart');}
      const m=f.inst.mobs.find(m=>mode==='unrelated'?!m.adventureTarget:m.adventureTarget==='mill')!;
      f.at(m.x,m.y+80);if(mode==='dead'){f.p.deadMs=1000;f.p.hp=0;}
      killMob(f.inst,m,f.p,'physical','test');assert(!f.save.rillwake?.warden,mode);
    } finally {f.inst.destroy();}
  }
});

test('infinite HP requires debug permission, blocks damage, toggles off and never survives a recreated player',()=>{
  const f=fixture(),beforeEnable=process.env.ENABLE_DEBUG,beforeDisable=process.env.DISABLE_DEBUG;
  const debug=()=>runCommand(f.s,{} as World,'debug',{op:'infhp'});
  try {
    process.env.ENABLE_DEBUG='0';assert.equal(debug().ok,false);assert(!f.p.debugInfiniteHp);
    process.env.ENABLE_DEBUG='1';process.env.DISABLE_DEBUG='1';assert.equal(debug().ok,false);
    process.env.DISABLE_DEBUG='0';f.p.hp=1;assert(debug().ok);assert.equal(f.p.hp,f.p.mhp);
    f.p.invulnMs=0;assert.equal(damagePlayer(f.inst,f.p,999999,'physical',null,1),0);assert.equal(f.p.hp,f.p.mhp);
    assert(!JSON.stringify(f.save).includes('debugInfiniteHp'));
    assert(debug().ok);assert(damagePlayer(f.inst,f.p,10,'physical',null,1)>0);
    assert(debug().ok);f.inst.removePlayer(f.s);const replacement=f.inst.playerById(f.inst.addPlayer(f.s))!;assert(!replacement.debugInfiniteHp);
  } finally {
    if(beforeEnable===undefined)delete process.env.ENABLE_DEBUG;else process.env.ENABLE_DEBUG=beforeEnable;
    if(beforeDisable===undefined)delete process.env.DISABLE_DEBUG;else process.env.DISABLE_DEBUG=beforeDisable;
    f.inst.destroy();
  }
});
