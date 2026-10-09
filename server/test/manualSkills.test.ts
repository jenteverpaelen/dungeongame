import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
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
import { getBuff } from '../src/sim/effects';
import { skillCost, skillCooldownMs } from '../src/sim/playerctx';
import { CommandReceipts } from '../src/net/commandReceipts';
import type { ChannelState } from '../src/sim/types';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');
function fixture(skill = 'magic_weapon', slots: (string | null)[] = [skill, null, null, null]) {
  const save = createCharacter('ManualFixture', SKILLS[skill].classId, 53);
  save.level = 70; save.skills.slots = slots; save.skills.autoCast = ['paused','paused','paused','paused'];
  const link: PlayerLink = { save, derived: computeStats(save), sessionId: save.id, send() {}, markDirty() {} };
  const inst = new Instance({ zoneId:'whispering_glade', key:'manual', channel:1, seed:73, theme:ZONES.whispering_glade.theme });
  for (const mob of inst.mobs) inst.removeMob(mob);
  inst.addPlayer(link); const p = inst.players[0];
  p.debugInfiniteHp = true; p.res = p.mres; p.atkCdMs = 100000;
  createMob(inst, DUMMY_DEF, 1, p.x + 50, p.y, { dummy:true });
  const notices: string[] = [];
  const emit = inst.emitTo.bind(inst);
  inst.emitTo = (id, ev) => { if (ev.e === 'notice') notices.push(ev.text); emit(id, ev); };
  const s = Object.assign(link, { rec:{ inst }, changed() { throw Error('Manual intent must not dirty the character'); } }) as unknown as Session;
  const cmd = (a:Record<string,unknown> = { slot:0, skill }) => runCommand(s, {} as World, 'skillCast', a);
  const step = () => { inst.t += 50; playerBrain(inst, p, 50); };
  return { save, inst, p, link, cmd, step, notices };
}

test('manual intent validates slot, skill, unlock, control state and one pending request without save mutation', () => {
  const f = fixture();
  try {
    const before = structuredClone(f.save), res = f.p.res;
    for (const a of [{slot:-1,skill:'magic_weapon'}, {slot:0.5,skill:'magic_weapon'}, {slot:4,skill:'magic_weapon'},
      {slot:1,skill:'magic_weapon'}, {slot:0,skill:'meteor'}, {slot:0,skill:true}, {slot:0,skill:'constructor'}]) assert.equal(f.cmd(a).ok,false);
    for (const state of ['deadMs','stunMs','frozenMs'] as const) { f.p[state]=100; assert.equal(f.cmd().ok,false); f.p[state]=0; }
    f.p.hp=0; assert.equal(f.cmd().ok,false); f.p.hp=f.p.mhp;
    f.save.level=1; assert.equal(f.cmd().ok,false); f.save.level=70;
    assert(f.cmd().ok); assert.equal(f.cmd().ok,false);
    assert.equal(f.p.res,res); assert.equal(f.p.attackSeq,0); assert.deepEqual(f.save,before);
  } finally { f.inst.destroy(); }
});

test('all fifteen slotted skills use their real cast paths, costs and cooldowns with automatic casts paused', () => {
  const results: string[] = [];
  for (const skill of Object.values(SKILLS).filter(s => s.kind !== 'primary')) {
    const f = fixture(skill.id);
    try {
      const rt=f.p.ctx.slots[0]!, res=f.p.res, cost=skillCost(f.p,rt), cd=skillCooldownMs(f.p,rt);
      assert(f.cmd().ok,skill.id); f.step(); assert.equal(f.p.attackSeq,1,skill.id);
      assert.equal(f.p.manualCast,undefined); assert.deepEqual(f.notices,[],skill.id);
      if (skill.kind==='channel') { assert(f.p.channel?.manual); f.step(); assert.equal(f.p.res,res-cost*0.05); }
      else { assert.equal(f.p.res,res-cost,skill.id); if(cd>0)assert.equal(f.p.readyAt.get(skill.id),50+cd,skill.id); }
      results.push(skill.id);
    } finally { f.inst.destroy(); }
  }
  assert.equal(results.length,15); console.log('Manual cast paths:',results.join(', '));
});

test('execution rejects loadout/CC races and forgotten intent never casts after recovery or travel', () => {
  for (const mutation of ['loadout','stun','dead','travel']) {
    const f=fixture();
    try {
      const res=f.p.res; assert(f.cmd().ok);
      if(mutation==='loadout')f.save.skills.slots[0]='meteor';
      if(mutation==='stun')f.p.stunMs=100;
      if(mutation==='dead')f.p.deadMs=100;
      if(mutation==='travel'){ f.inst.removePlayer(f.link); f.inst.addPlayer(f.link); assert.equal(f.inst.players[0].manualCast,undefined); continue; }
      f.step(); assert.equal(f.p.attackSeq,0); assert.equal(f.p.res,res); assert.equal(f.p.manualCast,undefined); assert.equal(f.notices.length,1);
      f.p.stunMs=f.p.deadMs=0; f.save.skills.slots[0]='magic_weapon'; f.step(); assert.equal(f.p.attackSeq,0);
    } finally { f.inst.destroy(); }
  }
});

test('cooldown, resource and missing targets fail once without charging or delaying a cast', () => {
  for(const reason of ['cooldown','resource','target']){
    const f=fixture(reason==='target'?'meteor':'magic_weapon');
    try{
      if(reason==='cooldown')f.p.readyAt.set('magic_weapon',1000);
      if(reason==='resource')f.p.res=0;
      if(reason==='target')for(const m of f.inst.mobs)f.inst.removeMob(m);
      const res=f.p.res;assert(f.cmd().ok);f.step();
      assert.equal(f.p.attackSeq,0);assert.equal(f.p.res,res);assert.equal(f.notices.length,1);
      assert.match(f.notices[0],reason==='cooldown'?/cooldown/:reason==='resource'?/resource/:/target/);
      f.p.readyAt.clear();f.p.res=f.p.mres;f.step();assert.equal(f.p.attackSeq,0);assert.equal(f.notices.length,1);
    }finally{f.inst.destroy();}
  }
});

test('manual channel starts while paused/moving, stops explicitly, and keeps normal recovery/upkeep/CC rules',()=>{
  const f=fixture('whirlwind');
  try{
    f.p.res=24;assert(f.cmd().ok);f.step();assert.equal(f.p.channel,null);
    f.p.res=25;f.p.moving=true;assert(f.cmd().ok);f.step();assert((f.p.channel as ChannelState | null)?.manual);
    f.step();assert(f.p.channel);const res=f.p.res;
    assert(f.cmd().ok);f.step();assert.equal(f.p.channel,null);assert.equal(f.p.res,res);assert.equal(f.p.readyAt.get('whirlwind'),f.inst.t+400);
    assert(f.cmd().ok);f.step();assert.equal(f.p.channel,null);
    f.inst.t+=400;f.p.res=25;assert(f.cmd().ok);f.step();assert(f.p.channel);
    f.p.stunMs=100;f.step();assert.equal(f.p.channel,null);
    f.p.stunMs=0;f.p.readyAt.clear();f.p.res=25;assert(f.cmd().ok);f.step();f.p.res=0.1;f.step();assert.equal(f.p.channel,null);assert.equal(f.p.res,0);
  }finally{f.inst.destroy();}
});

test('paired tick budget and command receipts prevent an additional automatic cast or duplicate replay',()=>{
  for(const manual of [false,true]){
    const f=fixture('magic_weapon',['magic_weapon','frost_nova',null,null]);
    try{
      f.save.skills.autoCast=['auto','auto','auto','auto'];
      const receipts=new CommandReceipts(), args={slot:1,skill:'frost_nova'};
      const send=()=>receipts.execute(1,'skillCast',args,()=>({t:'res',id:1,...f.cmd(args)}));
      if(manual)assert(send().ok);
      f.step();assert.equal(f.p.attackSeq,1);
      assert.equal(!!getBuff(f.p,'magic_weapon'),!manual);
      if(manual){assert(send().ok);assert.equal(f.p.manualCast,undefined);}
      f.step();assert(f.p.attackSeq<=2);
      console.log(JSON.stringify({manual, ticks:2, slotCasts:f.p.attackSeq, resource:f.p.res}));
    }finally{f.inst.destroy();}
  }
});

test('failed manual request does not suppress eligible automatic casts',()=>{
  const f=fixture('magic_weapon',['magic_weapon','frost_nova',null,null]);
  try{
    f.save.skills.autoCast=['auto','auto','auto','auto'];f.p.readyAt.set('frost_nova',1000);
    assert(f.cmd({slot:1,skill:'frost_nova'}).ok);f.step();
    assert(getBuff(f.p,'magic_weapon'));assert.equal(f.p.attackSeq,1);assert.match(f.notices[0],/cooldown/);
  }finally{f.inst.destroy();}
});
