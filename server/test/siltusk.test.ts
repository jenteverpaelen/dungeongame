import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter,computeStats} from '../src/shared';
import {MONSTERS} from '../../shared/src/data/monsters';
import {DASH,PLAYER_RADIUS} from '../../shared/src/constants';
import {F_WINDUP} from '../../shared/src/protocol';
import {CONTENT_DATA,validateContent} from '../../shared/src/contentValidation';
import type {PlayerLink} from '../src/contracts';
import {Instance} from '../src/sim/instance';
import {createMob,updateMonsters} from '../src/sim/monsters';
import {killMob} from '../src/sim/kills';
import {stunMob,freezeMob,knockbackMob,dragMob,chillMob} from '../src/sim/effects';

assert(process.env.DATA_DIR,'isolated DATA_DIR required');
function fixture() {
  const save=createCharacter('ChargeProbe','mage',41);save.level=5;
  const link:PlayerLink={save,derived:computeStats(save),sessionId:'charge',send(){},markDirty(){}};
  const inst=new Instance({zoneId:'reedvault_pumpworks',key:'charge',channel:0,seed:41,theme:'glade',level:5,difficulty:0});
  // Pre-placed dungeon packs (DECISIONS D-W06) are cleared: these probes measure one monster in isolation.
  for(const pre of [...inst.mobs])inst.removeMob(pre);inst.mobs.length=0;
  inst.addPlayer(link);const p=inst.players[0];p.invulnMs=0;
  const at=(x:number,y:number)=>{p.x=p.mv.x=x;p.y=p.mv.y=y;};at(900,1390);
  const m=createMob(inst,MONSTERS.siltusk,5,680,1390);m.state='chase';m.target=p.id;m.atkCdMs=0;
  const tick=(ms=50)=>{inst.t+=ms;inst.tickNo++;updateMonsters(inst,ms);inst.sched.run(inst.t);};
  const launch=()=>{for(let i=0;i<40&&!m.charge;i++)tick();assert.equal(m.state,'charge');};
  const finish=()=>{for(let i=0;i<10&&m.charge;i++)tick();assert.equal(m.charge,undefined);};
  return {inst,p,m,at,tick,launch,finish};
}

test('warning locks actual body path; sidestep after windup avoids a non-homing charge',()=>{
  const f=fixture();try {
    const hp=f.p.hp;f.tick();assert(f.m.flags&F_WINDUP);
    const tele=f.inst.events.find(e=>e.ev.e==='tele')!.ev;assert(tele.e==='tele');
    assert.deepEqual([tele.v,tele.s,tele.x,tele.y,tele.r,tele.w,tele.a,tele.d],['charge',f.m.id,680,1390,220,64,0,f.m.windupMs]);
    f.at(650,1550);f.launch();assert.equal(f.p.hp,hp);assert.equal(f.m.faceLeft,false);
    f.finish();assert.equal(f.p.hp,hp);assert(Math.abs(f.m.x-900)<.001);assert.equal(f.m.y,1390);
  } finally {f.inst.destroy();}
});

test('contact is swept and hits each player once; body-edge misses stay safe',()=>{
  for(const offset of [0,MONSTERS.siltusk.radius+PLAYER_RADIUS-1,MONSTERS.siltusk.radius+PLAYER_RADIUS+1]) {
    const f=fixture();try {
      f.launch();f.at(800,1390+offset);const hp=f.p.hp;
      f.tick();f.tick();const after=f.p.hp;
      if(offset<=f.m.r+PLAYER_RADIUS)assert(after<hp);else assert.equal(after,hp);
      f.finish();assert.equal(f.p.hp,after,'overlapping later substeps cannot repeat damage');
    } finally {f.inst.destroy();}
  }
});

test('reach is capped and a delayed tick cannot tunnel through thin cover',()=>{
  const f=fixture();try {
    f.at(950,1390);f.tick();assert.equal(f.m.atkX,680+DASH.distance);
    f.launch();f.inst.cw.town!.addCircle(780,1390,1,false);
    const hp=f.p.hp;f.tick(500);
    assert(f.m.x<780-f.m.r);assert.equal(f.m.y,1390);assert.equal(f.m.charge,undefined);assert.equal(f.p.hp,hp);
    assert(f.inst.cw.isFree(f.m.x,f.m.y,f.m.r));
  } finally {f.inst.destroy();}
});

test('continuous sweep catches a grazing prop even when both sample endpoints are free',()=>{
  const f=fixture();try {
    f.inst.cw.town!.addCircle(688,1422.5,1,false);
    const cw=f.inst.cw.town!;
    assert(cw.isFree(680,1390,32));assert(cw.isFree(696,1390,32));
    assert(cw.circlePathBlocked(680,1390,32,16,0));
    f.launch();f.tick();assert.equal(f.m.x,680);assert.equal(f.m.charge,undefined);
  } finally {f.inst.destroy();}
});

test('stun, freeze, push and pull cancel both warning and charge; no deferred contact',()=>{
  for(const active of [false,true]) for(const cc of ['stun','freeze','push','pull'] as const) {
    const f=fixture();try {
      if(active)f.launch();else f.tick();
      const hp=f.p.hp;
      if(cc==='stun')stunMob(f.m,2000);
      else if(cc==='freeze')freezeMob(f.m,2000);
      else if(cc==='push')knockbackMob(f.m,-1,0,40);
      else dragMob(f.inst,f.m,680,1470,20);
      assert.equal(f.m.charge,undefined);assert.equal(f.m.state,'chase');
      for(let i=0;i<4;i++)f.tick();assert.equal(f.p.hp,hp);assert(!(f.m.flags&F_WINDUP));
    } finally {f.inst.destroy();}
  }
});

test('chill keeps the authoritative warning active past the nominal duration',()=>{
  const f=fixture();try {
    f.tick();chillMob(f.m,3000);
    for(let i=0;i<Math.ceil(f.m.windupMs/50);i++)f.tick();
    assert.equal(f.m.state,'windup');assert(f.m.flags&F_WINDUP);
    f.launch();assert(!(f.m.flags&F_WINDUP));
  } finally {f.inst.destroy();}
});

test('death before contact cancels damage; thorns death prevents hits on later players',()=>{
  for(const active of [false,true]) {
    const f=fixture();try {
      if(active)f.launch();else f.tick();const hp=f.p.hp;
      killMob(f.inst,f.m,f.p,'physical','charge-fixture');
      for(let i=0;i<20;i++)f.tick();assert.equal(f.p.hp,hp);
    } finally {f.inst.destroy();}
  }
  const f=fixture();try {
    const save=createCharacter('BehindProbe','mage',42);save.level=5;
    f.inst.addPlayer({save,derived:computeStats(save),sessionId:'behind',send(){},markDirty(){}});
    const rear=f.inst.players[1];rear.x=rear.mv.x=900;rear.y=rear.mv.y=1390;rear.invulnMs=0;
    f.launch();f.at(760,1390);f.p.ctx.d.thorns=10000;
    const hp=f.p.hp,rearHp=rear.hp;f.tick();
    assert(f.p.hp<hp);assert(f.m.dead);assert.equal(f.m.charge,undefined);
    f.tick();assert.equal(rear.hp,rearHp);assert(!f.inst.queryMobs(f.m.x,f.m.y,64).includes(f.m));
  } finally {f.inst.destroy();}
});

test('charge definitions require positive finite reach and duration; other attacks reject charge duration',()=>{
  assert.deepEqual(validateContent(),[]);
  for(const [key,value] of [['chargeMs',undefined],['chargeMs',0],['chargeMs',NaN],['chargeMs',Infinity],['range',0],['kind','unknown']] as const) {
    const data={...CONTENT_DATA,monsters:structuredClone(MONSTERS)};Object.assign(data.monsters.siltusk.attack,{[key]:value});
    assert(validateContent(data).some(e=>e.includes(`monsters.siltusk.attack.${key}`)));
  }
  const data={...CONTENT_DATA,monsters:structuredClone(MONSTERS)};data.monsters.mossback.attack.chargeMs=170;
  assert(validateContent(data).some(e=>e.includes('monsters.mossback.attack.chargeMs')));
});
