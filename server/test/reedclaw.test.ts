import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter,computeStats} from '../src/shared';
import {MONSTERS} from '../../shared/src/data/monsters';
import type {PlayerLink} from '../src/contracts';
import {Instance} from '../src/sim/instance';
import {createMob,updateMonsters} from '../src/sim/monsters';
import {killMob} from '../src/sim/kills';
import {stunMob} from '../src/sim/effects';

assert(process.env.DATA_DIR,'isolated DATA_DIR required');
function fixture(){
  const save=createCharacter('CrabProbe','mage',41);save.level=5;
  const link:PlayerLink={save,derived:computeStats(save),sessionId:'crab',send(){},markDirty(){}};
  const inst=new Instance({zoneId:'reedvault_pumpworks',key:'crab',channel:0,seed:41,theme:'glade',level:5,difficulty:0});
  inst.addPlayer(link);const p=inst.players[0];p.invulnMs=0;
  const at=(x:number,y:number)=>{p.x=p.mv.x=x;p.y=p.mv.y=y;};at(880,1390);
  const m=createMob(inst,MONSTERS.reedclaw,5,680,1390);m.state='chase';m.target=p.id;m.atkCdMs=0;
  const tick=()=>{inst.t+=50;inst.tickNo++;updateMonsters(inst,50);inst.sched.run(inst.t);};
  const launch=()=>{for(let i=0;i<30&&!inst.sched.size;i++)tick();assert.equal(inst.sched.size,1);};
  const land=()=>{const end=inst.t+MONSTERS.reedclaw.attack.flightMs!;while(inst.t<end)tick();};
  return{inst,p,m,at,tick,launch,land};
}

test('launched stone locks its position and can be dodged; no early or duplicate damage',()=>{
  const f=fixture();try{
    const hp=f.p.hp;f.launch();const tele=f.inst.events.find(e=>e.ev.e==='tele')!.ev;
    assert(tele.e==='tele');assert.deepEqual([tele.v,tele.x,tele.y,tele.r,tele.d],['lob',880,1390,75,900]);
    assert.equal(f.p.hp,hp);f.at(880,1590);f.land();assert.equal(f.p.hp,hp,'leaving marked circle avoids damage');
    const impact=f.inst.events.filter(e=>e.ev.e==='aoe'&&e.ev.v==='slam');assert.equal(impact.length,1);
    assert(impact[0].ev.e==='aoe');assert.equal(impact[0].ev.x,880);assert.equal(impact[0].ev.y,1390);
    f.tick();assert.equal(f.p.hp,hp);
  }finally{f.inst.destroy();}
});

test('remaining in the marker takes one hit; lob is not a melee thorns trigger',()=>{
  const f=fixture();try{
    const hp=f.p.hp,mhp=f.m.hp;f.p.ctx.d.thorns=1000;f.launch();
    for(let i=0;i<17;i++)f.tick();assert.equal(f.p.hp,hp,'not before the 900 ms landing');
    f.tick();assert(f.p.hp<hp);assert.equal(f.m.hp,mhp);
    const after=f.p.hp;f.tick();assert.equal(f.p.hp,after);
  }finally{f.inst.destroy();}
});

test('interrupt or kill before launch prevents the stone; a released stone survives caster death',()=>{
  for(const action of ['stun','kill-before','kill-after'] as const){
    const f=fixture();try{
      const hp=f.p.hp;
      if(action==='kill-after')f.launch();else {f.tick();assert.equal(f.m.state,'windup');}
      if(action==='stun')stunMob(f.m,3000);else killMob(f.inst,f.m,f.p,'physical','crab-fixture');
      for(let i=0;i<20;i++)f.tick();
      if(action==='kill-after')assert(f.p.hp<hp);else{assert.equal(f.p.hp,hp);assert.equal(f.inst.sched.size,0);}
    }finally{f.inst.destroy();}
  }
});

test('cover blocks launch and landing damage; exact authored collision is consulted again after windup',()=>{
  const f=fixture();try{
    f.tick();assert.equal(f.m.state,'windup');f.inst.cw.town!.addCircle(780,1390,30,false);
    for(let i=0;i<13;i++)f.tick();assert.equal(f.inst.sched.size,0);assert(!f.inst.events.some(e=>e.ev.e==='tele'));
  }finally{f.inst.destroy();}
  const g=fixture();try{
    const hp=g.p.hp;g.launch();g.inst.cw.town!.addCircle(880,1430,12,false);g.at(880,1470);
    g.land();assert.equal(g.p.hp,hp,'close but behind cover');
  }finally{g.inst.destroy();}
});
