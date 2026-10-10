import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter,computeStats,SKILLS,PLAYER_RADIUS} from '../src/shared';
import {Instance} from '../src/sim/instance';
import {playerBrain} from '../src/sim/brain';
import {castSkill} from '../src/sim/skills';
import type {PlayerLink} from '../src/contracts';

assert(process.env.DATA_DIR,'Use isolated DATA_DIR');
for(const cls of ['mage','ranger'] as const)test(`${cls}: distant enemies do not trigger primary; nearby shots retain damage and shorter travel`,()=>{
  const save=createCharacter('ReachCheck',cls,73);save.level=70;save.skills.slots=[null,null,null,null];
  const link:PlayerLink={save,derived:computeStats(save),sessionId:'reach',send(){},markDirty(){}};
  const inst=new Instance({zoneId:'rillwake_crossing',key:'reach',channel:1,seed:73,theme:'glade'});
  try{
    inst.addPlayer(link);const p=inst.players[0];p.debugInfiniteHp=true;
    for(const m of inst.mobs)m.dead=true;
    const m=inst.mobs[0];m.dead=false;m.r=20;
    const place=(distance:number)=>{m.x=p.x+distance;m.y=p.y;inst.mobHash.update(m);};
    place(500);playerBrain(inst,p,50);assert.equal(inst.projs.length,0,'old distant acquisition removed');
    place(100);playerBrain(inst,p,50);assert(inst.projs.length>0,'nearby auto attack still fires');
    const shot=inst.projs[0];assert.equal(shot.strike!.coef,SKILLS[save.skills.primary].coef);
    assert(shot.lifeMs*shot.speed/1000<=p.ctx.attackRange+PLAYER_RADIUS*2+.001,'travel fits current reach');
    if(cls==='mage'){
      const rt=p.ctx.modsOf('meteor');place(500);assert.equal(castSkill(inst,p,rt),false,'remote ground target rejected');
      place(280);assert.equal(castSkill(inst,p,rt),true,'nearby ground spell still casts');
    }
  }finally{inst.destroy();}
});
