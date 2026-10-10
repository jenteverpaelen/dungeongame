import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter} from '../../shared/src/character';
import {computeStats} from '../../shared/src/stats';
import {PASSIVES,PASSIVE_SLOT_LEVELS,passivesForClass,passiveValue,activePassives,setPassive,type PassiveState} from '../../shared/src/passives';
import {isPersistedCommand} from '../../shared/src/commandState';
import {SKILLS} from '../../shared/src/data/skills';
import {ZONES} from '../../shared/src/data/zones';
import {runCommand} from '../src/commands';
import {Instance} from '../src/sim/instance';
import {refreshPlayerStats} from '../src/sim/players';
import {skillPct,skillCooldownMs} from '../src/sim/playerctx';
import {ensureDataDir,saveCharacter,loadCharacter,flushSaves} from '../src/persistence';
import type {PlayerLink} from '../src/contracts';
import type {Session} from '../src/net/session';
import type {World} from '../src/world';
assert(process.env.DATA_DIR,'isolated DATA_DIR required');ensureDataDir();

test('catalogue provides legal original class choices with finite effects throughout their unlocked levels',()=>{
  assert.equal(PASSIVES.length,18);assert.equal(new Set(PASSIVES.map(p=>p.id)).size,18);
  for(const classId of ['warrior','ranger','mage'] as const){
    const list=passivesForClass(classId);assert.equal(list.length,6);
    assert.deepEqual(list.map(p=>p.unlock),[10,10,20,30,40,50]);
    for(const p of list){if(p.skill)assert.equal(SKILLS[p.skill].classId,classId);for(let level=p.unlock;level<=70;level++)assert(Number.isFinite(passiveValue(p,level))&&passiveValue(p,level)>0);}
  }
  assert.equal(passiveValue(PASSIVES[0],70),12.5,'existing10–15 head-affix mean, not a new percentage');
});
test('slot/class/level/duplicate validation changes no currency, items or skill points and leaves absent legacy stats unchanged',()=>{
  const s=createCharacter('PassiveValidation','mage',12),legacy=computeStats(s);
  assert.deepEqual(computeStats({...s,passives:{revision:1,slots:[null,null,null,null]}}),legacy);
  for(const [slot,id] of [[0,'mage_meteor'],[-1,null],[4,null],[NaN,null],['0',null],[0,undefined]]){const before=structuredClone(s);assert(setPassive(s,slot,id));assert.deepEqual(s,before);}
  s.level=20;assert.equal(setPassive(s,0,'mage_meteor'),null);
  for(const [slot,id] of [[1,'mage_meteor'],[1,'warrior_whirlwind'],[1,'mage_heart'],[2,'mage_hydra'],[1,'__proto__']]){const before=structuredClone(s);assert(setPassive(s,slot,id));assert.deepEqual(s,before);}
  const custody=[s.gold,s.skillPoints,s.inventory,s.equipment,s.materials];assert.equal(setPassive(s,1,'mage_reserve'),null);assert.equal(setPassive(s,0,null),null);
  assert.deepEqual([s.gold,s.skillPoints,s.inventory,s.equipment,s.materials],custody);
  for(const [i,level] of PASSIVE_SLOT_LEVELS.entries()){s.level=level;assert.equal(setPassive(s,i,null),null);}
});
test('real simulation context receives skill/cooldown/resource effects and stat swaps preserve life fraction and resource',()=>{
  const save=createCharacter('PassiveSimulation','warrior',12);save.level=70;save.skills.slots=['whirlwind','ground_stomp',null,null];
  const link:PlayerLink={save,derived:computeStats(save),sessionId:save.id,send(){},markDirty(){}};
  const inst=new Instance({zoneId:'whispering_glade',key:'passive-check',channel:1,seed:12,theme:ZONES.whispering_glade.theme});
  try{
    inst.addPlayer(link);const p=inst.players[0];p.debugInfiniteHp=true;p.hp=p.mhp*.42;p.res=17;
    const originalLife=p.mhp,oldSkill=skillPct(p,p.ctx.slotted('whirlwind')!),oldCd=skillCooldownMs(p,p.ctx.slotted('ground_stomp')!),oldRegen=p.ctx.d.resourceRegen;
    for(const [i,id] of ['warrior_whirlwind','warrior_timing','warrior_reserve','warrior_heart'].entries())assert.equal(setPassive(save,i,id),null);
    refreshPlayerStats(inst,p,true);
    assert.equal(skillPct(p,p.ctx.slotted('whirlwind')!)-oldSkill,12.5);assert(skillCooldownMs(p,p.ctx.slotted('ground_stomp')!)<oldCd);
    assert.equal(p.ctx.d.resourceRegen-oldRegen,1.5);assert(p.mhp>originalLife);assert(Math.abs(p.hp/p.mhp-.42)<1e-10);assert.equal(p.res,17);
    assert.equal(setPassive(save,3,null),null);refreshPlayerStats(inst,p,true);assert.equal(p.mhp,originalLife);assert(Math.abs(p.hp/p.mhp-.42)<1e-10);assert.equal(p.res,17);
  }finally{inst.destroy();}
});
test('authoritative command rejects forged selections and uses the persistent command boundary',()=>{
  const save=createCharacter('PassiveAuthority','ranger',12);save.level=30;let refreshes=0;
  const s={save,changed(refresh:boolean){assert(refresh);refreshes++;}} as unknown as Session;
  assert(isPersistedCommand('passive'));
  assert(!runCommand(s,{} as World,'passive',{slot:0,passive:'mage_meteor'}).ok);assert.equal(refreshes,0);
  assert(runCommand(s,{} as World,'passive',{slot:0,passive:'ranger_sentry'}).ok);assert.equal(refreshes,1);
  assert(!runCommand(s,{} as World,'passive',{slot:1,passive:'ranger_sentry'}).ok);assert.equal(refreshes,1);
});
test('all-class save roundtrips retain selections; unsupported records remain inactive and unchanged',async()=>{
  for(const classId of ['warrior','ranger','mage'] as const){
    const save=createCharacter(`Passive${classId}`,classId,12);save.level=70;
    passivesForClass(classId).slice(0,4).forEach((p,i)=>assert.equal(setPassive(save,i,p.id),null));
    const before=computeStats(save);await saveCharacter(save);await flushSaves();const loaded=await loadCharacter(save.id);assert(loaded);
    assert.deepEqual(loaded.passives,save.passives);assert.deepEqual(computeStats(loaded),before);
    for(const bad of [null,{revision:2,slots:['future']},{revision:1,slots:['bad',null,null,null]},{revision:1,slots:[`${classId}_reserve`,`${classId}_reserve`,null,null]}]){
      save.passives=bad as unknown as PassiveState;const snapshot=structuredClone(save.passives);
      assert.deepEqual(activePassives(save),[]);assert(setPassive(save,0,null));assert.deepEqual(save.passives,snapshot);
      await saveCharacter(save);const reloaded=await loadCharacter(save.id);assert.deepEqual(reloaded!.passives,snapshot);
    }
  }
});
