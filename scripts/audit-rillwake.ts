// Actual simulation and ordinary input path, synthetic isolated characters. Not human pacing.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Instance } from '../server/src/sim/instance';
import { adventureCommand } from '../server/src/adventure';
import { questCommand } from '../server/src/quests';
import { questState } from '../shared/src/quests';
import type { S2C } from '../shared/src/protocol';
import { runCommand } from '../server/src/commands';
import type { World } from '../server/src/world';
import type { Session } from '../server/src/net/session';
import { createCharacter } from '../shared/src/character';
import { computeStats } from '../shared/src/stats';
import { Rng } from '../shared/src/math';
import type { Point } from '../shared/src/townTypes';

const dir=path.resolve(process.env.DATA_DIR??'');
// Windows can expose the same temporary directory through long and 8.3 aliases.
assert.equal((await fs.realpath(path.dirname(dir))).toLowerCase(),(await fs.realpath(os.tmpdir())).toLowerCase(),'Fresh child of the temporary directory required');
assert.equal(process.env.BACKUP_DIR??'','');assert.equal(process.env.BACKUP_KEEP??'0','0');
await fs.mkdir(dir,{recursive:true});assert.equal((await fs.readdir(dir)).length,0,'Fresh directory required');
const results=[];
const chain=process.argv.includes('--chain');
for(const cls of ['warrior','mage','ranger'] as const) {
  const random=Math.random,rng=new Rng(1701);Math.random=()=>rng.next();
  let inst=new Instance({zoneId:'rillwake_crossing',seed:1,channel:1,key:'audit',theme:'glade'});
  const save=createCharacter(`Audit${cls}`,cls,1701);
  let rings=0,slams=0,elapsedBeforeSluice=0;
  let warnings:{x:number;y:number;r:number;until:number}[]=[];
  const s={sessionId:cls,save,derived:computeStats(save),send(m:S2C){if(m.t==='s')for(const e of m.ev??[])if(e.e==='tele'){if(e.v==='boss_ring')rings++;if(e.v==='slam'){slams++;warnings.push({x:e.x,y:e.y,r:e.r,until:inst.t+e.d});}}},markDirty(){},changed(refresh:boolean){s.derived=computeStats(save);if(refresh)inst.refreshPlayer(s);},rec:{inst}} as unknown as Session;
  let p=inst.playerById(inst.addPlayer(s))!;let seq=0;
  const inputTick=(mx:number,my:number)=>{
    warnings=warnings.filter(w=>w.until>=inst.t);
    const danger=chain&&warnings.find(w=>Math.hypot(p.x-w.x,p.y-w.y)<w.r+24);
    if(danger) {const dx=p.x-danger.x,dy=p.y-danger.y,d=Math.hypot(dx,dy);mx=d>1?dx/d:-1;my=d>1?dy/d:0;}
    inst.queueInput(s,{t:'in',seq:++seq,mx,my});inst.tick();
  };
  const walk=(points:Point[])=>{
    for(const [x,y] of points) {
      let ticks=0;
      while(Math.hypot(p.x-x,p.y-y)>15 && ticks++<1800) {
        if(p.deadMs>0)throw new Error(`${cls} died near ${p.x},${p.y}`);
        const mob=inst.mobs.filter(m=>!m.dead&&!m.dormant&&m.state!=='return').sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
        const fighting=mob && Math.hypot(mob.x-p.x,mob.y-p.y)<(cls==='warrior'?95:250);
        const dx=x-p.x,dy=y-p.y,l=Math.hypot(dx,dy);
        inputTick(fighting?0:dx/l,fighting?0:dy/l);
      }
      assert(Math.hypot(p.x-x,p.y-y)<=15,`${cls} stuck at ${p.x},${p.y} toward ${x},${y}`);
    }
  };
  const command=(action:string,target:string)=>{const r=adventureCommand(s,{action,target});assert(r.ok,`${cls}/${action}: ${r.err}`);};
  try {
    const route=inst.map.adventure!.routes[0];
    walk([[800,2445]]);command('accept','tender');
    walk([[900,2430],...route.slice(2,6),[2270,2035]]);command('inspect','cart');
    walk([[2350,2040],...route.slice(6,9)]);
    for(let i=0;i<2400&&!save.rillwake!.warden;i++){inputTick(0,0);if(p.deadMs>0)throw new Error(`${cls} died at the mill`);}
    assert(save.rillwake!.warden,`${cls} failed to defeat Siltroot`);
    walk([[3340,1130],[3340,940],[3350,865]]);command('inspect','ledger');
    walk([[3340,940],[3360,1130],...route.slice(0,8).reverse(),[800,2445]]);command('claim','tender');
    if(chain) {
      assert(runCommand(s,{} as World,'equip',{itemId:save.rillwake!.reward!.id}).ok,'equip the earned weapon');
      const quest=(quest:string,action:string,target='tender')=>{const r=questCommand(s,{quest,action,target});assert(r.ok,`${cls}/${quest}/${action}: ${r.err}`);};
      quest('high_water','accept');
      walk([[900,2430],[1450,2010],[1450,1900],[1160,1400],[1600,1350],[2340,1120],[2440,1055]]);
      quest('high_water','inspect','survey');
      walk([[2340,1120],[1600,1350],[1160,1400],[1450,1900],[1450,2010],[900,2430],[800,2445]]);quest('high_water','claim');quest('under_spillway','accept');
      walk([[900,2430],...route.slice(2,8),[3070,1230],[3070,910],[3120,780]]);
      elapsedBeforeSluice=inst.t;inst.removePlayer(s);inst.destroy();
      inst=new Instance({zoneId:'bracken_sluice',seed:1,channel:1,key:'audit-sluice',theme:'glade'});s.rec!.inst=inst;
      p=inst.playerById(inst.addPlayer(s))!;seq=0;warnings=[];const main=inst.map.adventure!.routes[0];
      walk(main.slice(1,8));
      for(let i=0;i<2400&&questState(save,'under_spillway')!.step<2;i++) {
        inputTick(0,0);if(p.deadMs>0)throw new Error(`${cls} died at the spillway`);
      }
      assert.equal(questState(save,'under_spillway')!.step,2,'keeper defeated through combat');
      walk([[2540,910]]);quest('under_spillway','inspect','floodgate');
      walk([...main.slice(0,8).reverse(),[670,2760]]);
      elapsedBeforeSluice+=inst.t;inst.removePlayer(s);inst.destroy();
      inst=new Instance({zoneId:'rillwake_crossing',seed:1,channel:1,key:'audit-return',theme:'glade'});s.rec!.inst=inst;p=inst.playerById(inst.addPlayer(s))!;seq=0;warnings=[];
      walk([[800,2445]]);quest('under_spillway','claim');
    }
    assert(!p.debugInfiniteHp,'Combat audit must use normal health');
    results.push({cls,success:true,chain,simulationSeconds:(inst.t+elapsedBeforeSluice)/1000,kills:save.stats.kills,deaths:save.stats.deaths,level:save.level,items:save.inventory.filter(Boolean).length,claimed:save.rillwake!.claimed,rewardLevel:save.rillwake!.reward!.ilvl,quests:save.quests,rings,slams,infiniteHp:false,tick:inst.tickStats()});
  } catch(e){results.push({cls,success:false,error:String(e),simulationSeconds:inst.t/1000,kills:save.stats.kills,level:save.level,x:p.x,y:p.y});}
  finally{inst.destroy();Math.random=random;}
}
const report={dataDir:dir,kind:'deterministic synthetic normal-level-1 input walkthrough; not player pacing or browser performance',results};
await fs.writeFile(path.join(dir,chain?'quest-chain-report.json':'rillwake-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(results.some(r=>!r.success))process.exitCode=1;
