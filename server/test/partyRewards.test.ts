import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter} from '../../shared/src/character';
import {computeStats} from '../../shared/src/stats';
import {Instance} from '../src/sim/instance';
import {createMob,wakeMob} from '../src/sim/monsters';
import {killMob} from '../src/sim/kills';
import {updateLoot,spawnLoot} from '../src/sim/loot';
import {MONSTERS} from '../../shared/src/data/monsters';
import type {Session} from '../src/net/session';
assert(process.env.DATA_DIR,'Fresh isolated DATA_DIR required');

test('actual 1–4-player same-level field wake, full nearby XP and owner-only loot; distant/dead players excluded',()=>{
  const results:{players:number;hp:number;xp:number;loot:number}[]=[];
  for(let count=1;count<=4;count++){
    const inst=new Instance({zoneId:'rillwake_crossing',key:`party-review-${count}`,channel:0,seed:105,theme:'glade'});
    try{
      const players=Array.from({length:count+2},(_,i)=>{const save=createCharacter(`Review${count}${i}`,'warrior',105);save.level=4;
        const s={save,derived:computeStats(save),sessionId:save.id,send(){},markDirty(){},changed(){}} as unknown as Session;s.entityId=inst.addPlayer(s);const p=inst.playerById(s.entityId)!;
        p.x=p.mv.x=1000;p.y=p.mv.y=1000;p.debugInfiniteHp=true;return p;});
      const far=players[count],dead=players[count+1];far.x=far.mv.x=10000;far.y=far.mv.y=10000;dead.deadMs=1000;dead.x=dead.mv.x=10000;dead.y=dead.mv.y=10000;
      const mob=createMob(inst,MONSTERS.brine_crab,4,1020,1000,{dormant:true,difficulty:0,players:1});const base=mob.mhp;
      wakeMob(inst,mob,players[0]);assert(Math.abs(mob.mhp-base*(1+.5*(count-1)))<=2,'life ratio allows final integer rounding');const hp=mob.mhp;
      dead.x=1000;dead.y=1000;killMob(inst,mob,players[0],'physical','review');
      const xp=players[0].save.xp;assert(xp>0);for(const p of players.slice(0,count))assert.equal(p.save.xp,xp);
      assert.equal(far.save.xp,0);assert.equal(dead.save.xp,0);
      for(const p of players)for(const loot of p.loot)assert.equal(loot.owner,p);
      const only=spawnLoot(inst,players[0],{type:'gold',amount:17},1000,1000);only.armMs=0;const before=far.save.gold;far.x=1000;far.y=1000;updateLoot(inst,far,50);assert.equal(far.save.gold,before);assert(players[0].loot.has(only));
      results.push({players:count,hp,xp,loot:players.slice(0,count).reduce((n,p)=>n+p.loot.size,0)});
    }finally{inst.destroy();}
  }
  assert(results.every(r=>r.xp===results[0].xp));console.log('PARTY_REVIEW '+JSON.stringify(results));
});
