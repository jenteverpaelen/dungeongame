import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { questState } from '../../shared/src/quests';
import { INTRO_LESSONS } from '../../shared/src/onboarding';
import { Instance } from '../src/sim/instance';
import type { Session } from '../src/net/session';
import type { World } from '../src/world';
import { runCommand } from '../src/commands';
import { loadCharacter,saveCharacter,flushSaves } from '../src/persistence';
import { killMob } from '../src/sim/kills';

assert(process.env.DATA_DIR,'isolated DATA_DIR required');
let seq=0;
function fixture(){
  const save=createCharacter('IntroServer'+ ++seq,'warrior',1);
  const inst=new Instance({zoneId:'rillwake_crossing',seed:1,channel:1,key:'intro-test',theme:'glade'});
  const s={save,derived:computeStats(save),sessionId:save.id,send(){},markDirty(){},changed(){s.derived=computeStats(save);inst.refreshPlayer(s);},rec:{inst}} as unknown as Session;
  s.entityId=inst.addPlayer(s);const p=inst.playerById(s.entityId)!;p.debugInfiniteHp=true;
  const at=(x:number,y:number)=>{p.x=p.mv.x=x;p.y=p.mv.y=y;};
  const cmd=(op:Parameters<typeof runCommand>[2],a:Record<string,unknown>)=>runCommand(s,{} as World,op,a);
  const quest=(action:string,target='tender')=>cmd('quest',{quest:'first_road',action,target});
  return {s,save,inst,p,at,cmd,quest};
}
// Positions come from the zone data since the worlds rebuild (docs/rework/worlds/DECISIONS.md D-W07).
const approach=(f:{inst:{map:{adventure?:{interactions:{id:string;x:number;y:number}[]}};cw:{isFree(x:number,y:number,r:number):boolean;segmentBlocked(a:number,b:number,c:number,d:number):boolean}}},id:string):[number,number]=>{
  const i=f.inst.map.adventure!.interactions.find(i=>i.id===id)!;
  for(let n=0;n<16;n++){const x=i.x+70*Math.cos(n*Math.PI/8),y=i.y+70*Math.sin(n*Math.PI/8);if(f.inst.cw.isFree(x,y,18)&&!f.inst.cw.segmentBlocked(x,y,i.x,i.y))return [x,y];}
  throw new Error('no approach to '+id);
};
test('physical tutorial reward: no remote/dead/fake progress, full bag and reload retain one reward, resume cannot farm it',async()=>{
  const f=fixture();
  try{
    f.at(...approach(f,'tender'));assert(!f.quest('accept').ok,'returning heroes are not enrolled');
    assert(f.cmd('onboarding',{action:'start'}).ok);
    for(const a of [{action:'complete',lesson:'kill'},{action:'start',done:['kill']},{action:'skipLesson',lesson:'anything'}])assert(!f.cmd('onboarding',a).ok);
    assert.equal(f.save.onboarding!.done.length,0);
    f.at(f.inst.map.entry.x,f.inst.map.entry.y);assert(!f.quest('accept').ok);f.at(...approach(f,'tender'));
    f.p.deadMs=1;assert(!f.quest('accept').ok);f.p.deadMs=0;
    assert(!f.quest('accept','cart').ok);assert(f.quest('accept').ok);assert(f.save.onboarding!.done.includes('talk'));
    assert(!f.quest('claim').ok);const mob=f.inst.mobs.find(m=>m.adventureSite==='road'&&m.def.id==='bog_slime')!;
    f.at(mob.x,mob.y+50);killMob(f.inst,mob,f.p,'physical','authority-fixture');
    const reward=structuredClone(questState(f.save,'first_road')!.reward!);assert(reward);
    f.at(...approach(f,'tender'));f.save.inventory=f.save.inventory.map((_,i)=>({...reward,id:'bag-'+i}));
    const before=structuredClone(f.save);assert(!f.quest('claim').ok);assert.deepEqual(f.save,before);
    f.save.appearance={skin:'ranger',hair:'mage',style:'warrior'};
    await saveCharacter(f.save);await flushSaves();Object.assign(f.save,(await loadCharacter(f.save.id))!);
    assert.deepEqual(questState(f.save,'first_road')!.reward,reward);assert.equal(f.save.appearance.skin,'ranger');
    f.save.inventory[0]=null;assert(f.quest('claim').ok);assert(f.save.onboarding!.done.includes('claim'));
    assert(!f.cmd('equip',{itemId:'missing'}).ok);assert(!f.save.onboarding!.done.includes('equip'));
    assert(f.cmd('equip',{itemId:reward.id}).ok);assert(f.save.onboarding!.done.includes('equip'));
    assert(f.cmd('onboarding',{action:'skip'}).ok);assert(f.cmd('onboarding',{action:'start'}).ok);
    assert(!f.quest('accept').ok);assert(!f.quest('claim').ok);assert.equal(f.save.equipment.mainhand!.id,reward.id);
    for(const lesson of INTRO_LESSONS)assert(f.save.onboarding!.status==='complete'||f.cmd('onboarding',{action:'skipLesson',lesson}).ok);
    assert.equal(f.save.onboarding!.status,'complete');assert(!f.save.onboarding!.done.includes('return'));
  }finally{f.inst.destroy();}
});
test('real movement inputs credit only displacement and actual dash, and can walk the authored camp route without a progression lock',()=>{
  const f=fixture();let input=0;
  try{
    assert(f.cmd('onboarding',{action:'start'}).ok);
    f.inst.queueInput(f.s,{t:'in',seq:++input,mx:0,my:0});f.inst.tick();assert(!f.save.onboarding!.done.includes('move'));
    const walk=(x:number,y:number)=>{
      for(let i=0;i<300&&Math.hypot(f.p.x-x,f.p.y-y)>12;i++){
        const dx=x-f.p.x,dy=y-f.p.y,len=Math.hypot(dx,dy);
        f.inst.queueInput(f.s,{t:'in',seq:++input,mx:dx/len,my:dy/len});f.inst.tick();
      }
      assert(Math.hypot(f.p.x-x,f.p.y-y)<=12,`route stopped at ${f.p.x},${f.p.y}`);
    };
    walk(...approach(f,'tender'));assert(f.save.onboarding!.done.includes('move'));assert(f.quest('accept').ok);
    {const r=f.inst.map.adventure!.routes[0];walk(r[1][0],r[1][1]);walk(r[2][0],r[2][1]);}
    f.inst.queueInput(f.s,{t:'in',seq:++input,mx:1,my:0,dash:1});f.inst.tick();assert(f.save.onboarding!.done.includes('dash'));
    assert(f.cmd('onboarding',{action:'skip'}).ok);assert(f.cmd('onboarding',{action:'start'}).ok);
    assert(questState(f.save,'first_road'));assert(!f.save.onboarding!.done.includes('claim'));
  }finally{f.inst.destroy();}
});
