import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { DEFAULT_AUTO_RULE, normalizeSavedAutoRules, type AutoCastRule } from '../../shared/src/autoCastRules';
import { SKILLS } from '../../shared/src/data/skills';
import { ZONES } from '../../shared/src/data/zones';
import { computeStats } from '../../shared/src/stats';
import type { PlayerLink } from '../src/contracts';
import type { Session } from '../src/net/session';
import type { World } from '../src/world';
import { runCommand } from '../src/commands';
import { Instance } from '../src/sim/instance';
import { createMob, DUMMY_DEF } from '../src/sim/monsters';
import { playerBrain } from '../src/sim/brain';
import { skillCost } from '../src/sim/playerctx';
import { getBuff } from '../src/sim/effects';

assert(process.env.DATA_DIR,'isolated DATA_DIR required');
function fixture(skill='frost_nova',slots:(string|null)[]=[skill,null,null,null]) {
  const save=createCharacter('RuleFixture',SKILLS[skill].classId,53);
  save.level=70;save.skills.slots=slots;
  const link:PlayerLink={save,derived:computeStats(save),sessionId:save.id,send(){},markDirty(){}};
  const inst=new Instance({zoneId:'whispering_glade',key:'rules',channel:1,seed:73,theme:ZONES.whispering_glade.theme});
  for(const m of inst.mobs)inst.removeMob(m);
  inst.addPlayer(link);const p=inst.players[0];p.debugInfiniteHp=true;p.res=p.mres;p.atkCdMs=100000;
  const mob=createMob(inst,DUMMY_DEF,1,p.x+100,p.y,{dummy:true});
  const s={save,changed(refresh:boolean){assert.equal(refresh,false);}} as unknown as Session;
  const cmd=(rule:unknown,slot=0,expected=skill)=>runCommand(s,{} as World,'skillAutoRule',{slot,skill:expected,rule});
  const set=(patch:Partial<AutoCastRule>)=>{const r=cmd({...DEFAULT_AUTO_RULE,...patch});assert(r.ok,r.err ?? 'Rule command failed');};
  const step=()=>{inst.t+=50;playerBrain(inst,p,50);};
  return {save,inst,p,mob,link,cmd,set,step};
}

test('rule commands reject spoofed intent, malformed thresholds, foreign/self buffs and do not reset combat',()=>{
  const f=fixture();try{
    const before=structuredClone(f.save),res=f.p.res;f.p.readyAt.set('frost_nova',900);
    for(const rule of [undefined,[],{}, {...DEFAULT_AUTO_RULE,extra:1},...[-1,0,11,NaN,1.1,'3'].map(enemyWeight=>({...DEFAULT_AUTO_RULE,enemyWeight})),
      ...[0,701,Infinity,'20'].map(within=>({...DEFAULT_AUTO_RULE,within})),
      ...[-1,101,0.1,null].map(reservePct=>({...DEFAULT_AUTO_RULE,reservePct})),
      {...DEFAULT_AUTO_RULE,elitesOnly:1},{...DEFAULT_AUTO_RULE,requireBuff:'battle_rage'},{...DEFAULT_AUTO_RULE,requireBuff:'constructor'}])assert.equal(f.cmd(rule).ok,false);
    for(const [slot,skill] of [[-1,'frost_nova'],[0.5,'frost_nova'],[4,'frost_nova'],[1,'frost_nova'],[0,'meteor']] as const)assert.equal(f.cmd(DEFAULT_AUTO_RULE,slot,skill).ok,false);
    assert.deepEqual(f.save,before);f.set({reservePct:50});assert.equal(f.p.res,res);assert.equal(f.p.readyAt.get('frost_nova'),900);
    const once=structuredClone(f.save);f.set({reservePct:50});assert.deepEqual(f.save,once);
    assert(f.cmd(null).ok);assert.equal(f.save.skills.autoRules?.[0],null);
  }finally{f.inst.destroy();}
  const buff=fixture('magic_weapon');try{assert.equal(buff.cmd({...DEFAULT_AUTO_RULE,requireBuff:'magic_weapon'}).ok,false);}finally{buff.inst.destroy();}
});

test('density overrides use actual weights, bounded body-inclusive scans and normal cooldowns',()=>{
  const f=fixture();try{
    f.step();assert.equal(f.p.attackSeq,0,'one ordinary target does not meet default weight3');
    f.set({enemyWeight:1,within:1});f.step();assert.equal(f.p.attackSeq,0,'distant target outside narrow scan');
    f.set({enemyWeight:1});f.step();assert.equal(f.p.attackSeq,1);const cd=f.p.readyAt.get('frost_nova');
    f.set({enemyWeight:1,within:700});f.step();assert.equal(f.p.attackSeq,1);assert.equal(f.p.readyAt.get('frost_nova'),cd);
  }finally{f.inst.destroy();}
  for(const tier of [0,1,2,4,5] as const){const f=fixture();try{
    f.mob.tier=tier;f.set({enemyWeight:10});f.step();assert.equal(f.p.attackSeq,tier===4?1:0,`weight for tier${tier}`);
  }finally{f.inst.destroy();}}
});

test('elite presence accepts champions/rares/bosses, excludes ordinary/goblins, and preserves target rules',()=>{
  for(const tier of [0,1,2,4,5] as const){const f=fixture('magic_weapon');try{
    f.mob.tier=tier;f.set({elitesOnly:true});f.step();assert.equal(!!getBuff(f.p,'magic_weapon'),[1,2,4].includes(tier));
  }finally{f.inst.destroy();}}
});

test('resource reserves are checked after spending, including exact-boundary casts',()=>{
  for(const enough of [false,true]){const f=fixture('magic_weapon');try{
    const cost=skillCost(f.p,f.p.ctx.slots[0]!);const reserve=f.p.mres*0.5;f.p.res=reserve+cost-(enough?0:1);
    const before=f.p.res;f.set({reservePct:50});f.step();assert.equal(!!getBuff(f.p,'magic_weapon'),enough);assert.equal(f.p.res,enough?reserve:before);
  }finally{f.inst.destroy();}}
});

test('buff dependencies retain priority and can become eligible after a later buff slot casts',()=>{
  const f=fixture('frost_nova',['frost_nova','magic_weapon',null,null]);try{
    f.set({enemyWeight:1,requireBuff:'magic_weapon'});f.step();assert(getBuff(f.p,'magic_weapon'));assert.equal(f.p.readyAt.has('frost_nova'),false);
    f.step();assert(f.p.readyAt.has('frost_nova'));assert.equal(f.p.attackSeq,2);
  }finally{f.inst.destroy();}
});

test('automatic channels keep the reserve while manual channels explicitly bypass it',()=>{
  const f=fixture('whirlwind');try{
    f.set({reservePct:50});f.p.res=51;f.step();assert(f.p.channel);
    f.step();f.step();assert.equal(f.p.res,50);f.step();assert.equal(f.p.channel,null);assert.equal(f.p.res,50);
    const cd=f.p.readyAt.get('whirlwind')!;f.inst.t=cd;f.p.res=25;
    assert.equal(f.inst.requestSkillCast(f.link,0,'whirlwind'),null);f.step();assert(f.p.channel);f.step();assert.equal(f.p.res,24.5);
  }finally{f.inst.destroy();}
});

test('manual casts bypass trigger filters while clear restores the authored automatic rule',()=>{
  const f=fixture();try{
    f.set({enemyWeight:10,elitesOnly:true,reservePct:100,requireBuff:'magic_weapon'});f.step();assert.equal(f.p.attackSeq,0);
    assert.equal(f.inst.requestSkillCast(f.link,0,'frost_nova'),null);f.step();assert.equal(f.p.attackSeq,1);
    f.p.readyAt.clear();assert(f.cmd(null).ok);f.step();assert.equal(f.p.attackSeq,1,'default still requires weight3');
  }finally{f.inst.destroy();}
});

test('legacy rules default, malformed saved rules pause only affected slots, valid rules survive normalization',()=>{
  const f=fixture();try{
    normalizeSavedAutoRules(f.save.skills,'mage');assert.deepEqual(f.save.skills.autoRules,[null,null,null,null]);
    f.save.skills.autoRules=[{...DEFAULT_AUTO_RULE,reservePct:75}, {bad:true} as any, null,{...DEFAULT_AUTO_RULE,requireBuff:'magic_weapon'}];
    normalizeSavedAutoRules(f.save.skills,'mage');assert.deepEqual(f.save.skills.autoCast,['auto','paused','auto','auto']);
    assert.equal(f.save.skills.autoRules[0]?.reservePct,75);assert.equal(f.save.skills.autoRules[1],null);assert.equal(f.save.skills.autoRules[3]?.requireBuff,'magic_weapon');
    const once=structuredClone(f.save.skills);normalizeSavedAutoRules(f.save.skills,'mage');assert.deepEqual(f.save.skills,once);
  }finally{f.inst.destroy();}
});
