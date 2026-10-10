import test from 'node:test';
import assert from 'node:assert/strict';
import {ADVENTURES} from '../../shared/src/adventure';
import {ZONES} from '../../shared/src/data/zones';
import {createCharacter} from '../../shared/src/character';
import {computeStats} from '../../shared/src/stats';
import {Instance} from '../src/sim/instance';
import {encounterDifficulty,updateMonsters} from '../src/sim/monsters';
import {MONSTERS} from '../../shared/src/data/monsters';
import type {Session} from '../src/net/session';
assert(process.env.DATA_DIR,'isolated DATA_DIR required');

test('all authored field mobs remain Normal when waking for a Master-preferring player; procedural fields retain their choice',()=>{
  for(const zoneId of [...Object.keys(ADVENTURES).filter(id=>ZONES[id].kind==='field'),'whispering_glade']){
    const inst=new Instance({zoneId,key:zoneId,channel:0,seed:100,theme:'glade'});
    const save=createCharacter('FieldDifficulty','mage',100);save.level=50;save.difficulty=3;
    const s={save,derived:computeStats(save),sessionId:save.id,send(){},markDirty(){},changed(){}} as unknown as Session;
    s.entityId=inst.addPlayer(s);const p=inst.playerById(s.entityId)!;p.debugInfiniteHp=true;
    try{
      const authored=!!inst.map.adventure,expected=authored?0:3;
      assert.equal(encounterDifficulty(inst,p),expected);
      const mob=inst.mobs.find(m=>m.dormant&&!m.dead)!;assert(mob);
      // Exercise actual wake-up/relevel without the player's auto-attack killing low-level dormant mobs first.
      p.x=p.mv.x=mob.x;p.y=p.mv.y=mob.y+45;
      for(let i=0;i<10;i++){inst.tickNo++;inst.t+=50;updateMonsters(inst,50);} // Staggered sensing.
      assert(!mob.dormant);assert.equal(mob.diff,expected,zoneId);assert.equal(save.difficulty,3);
    }finally{inst.destroy();}
  }
});

test('new regional families preserve their inherited attack and collision budgets',()=>{
  for(const [id,base] of [['saltglass_skimmer','brine_crab'],['rimehorn','siltusk']]){
    const a=MONSTERS[id],b=MONSTERS[base];assert.notEqual(a.family,b.family);assert.equal(a.weight,0);
    for(const k of ['hp','dmg','speed','radius','scale'] as const)assert.equal(a[k],b[k]);assert.deepEqual(a.attack,b.attack);
    assert(Object.values(ADVENTURES).some(zone=>zone.encounters.some(e=>e.members.some(m=>m.type===id))));
  }
});
