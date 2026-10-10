import assert from 'node:assert/strict';
import {ADVENTURES} from '../shared/src/adventure';
import {ZONES} from '../shared/src/data/zones';
import {rollDrops} from '../shared/src/items';
import {Rng} from '../shared/src/math';
import {cubeXpToNext,salvageXp,CUBE_FUNCTIONS} from '../shared/src/cube';
assert(process.env.DATA_DIR);assert.equal(process.env.BACKUP_KEEP,'0');
const rows=[],classes=['warrior','ranger','mage'] as const;
const runs=classes.flatMap((classId,c)=>Array.from({length:200},(_,i)=>({classId,rng:new Rng(99000+c*1000+i),pity:0,xp:0})));
const dist=(a:number[])=>{a.sort((x,y)=>x-y);return {mean:Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10,p10:a[Math.ceil(a.length*.1)-1],median:a[Math.ceil(a.length*.5)-1],p90:a[Math.ceil(a.length*.9)-1]}};
for(const a of Object.values(ADVENTURES)){
 const band=ZONES[a.id].levelBand,level=Math.floor((band[0]+band[1])/2),members=a.encounters.flatMap(e=>e.members);
 const gains=[];
 for(const run of runs){let xp=0;for(const m of members){const out=rollDrops(run.rng,{level,difficulty:0,classId:run.classId,elite:m.tier??0,pity:run.pity,inRift:false,magicFind:0},0);run.pity=out.pity;for(const drop of out.drops)if(drop.type==='item')xp+=salvageXp(drop.item);}run.xp+=xp;gains.push(xp);}
 rows.push({zone:a.id,level,kills:members.length,salvageAllXp:dist(gains),cumulativeXp:dist(runs.map(r=>r.xp))});
}
const unlocks=CUBE_FUNCTIONS.map(f=>{const xp=Array.from({length:f.unlock-1},(_,i)=>cubeXpToNext(i+1)).reduce((a,b)=>a+b,0);return {op:f.op,level:f.unlock,xp}});
console.log(JSON.stringify({scope:'600 deterministic one-clear runs, all authored members once, normal, midpoint zone level, zero MF, salvage EVERY dropped item, no respawns/quest items/service XP; not player timing or an optimal route',unlocks,rows},null,2));
