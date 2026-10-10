/** L121: actual combat, explicit synthetic loadouts; never human pacing or survival evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Instance} from '../server/src/sim/instance';
import {createMob} from '../server/src/sim/monsters';
import {MIDGAME_ADVENTURES} from '../shared/src/data/midgame';
import {MONSTERS} from '../shared/src/data/monsters';
import {ZONES} from '../shared/src/data/zones';
import {CLASSES} from '../shared/src/data/classes';
import {createCharacter,equipItem} from '../shared/src/character';
import {merchantStock} from '../shared/src/merchant';
import {campaignSetReward} from '../shared/src/campaignSets';
import {generateItem} from '../shared/src/items';
import {computeStats} from '../shared/src/stats';
import {autoSlotSkills} from '../shared/src/progression';
import {Rng} from '../shared/src/math';
import type {Item} from '../shared/src/types';
import type {Session} from '../server/src/net/session';
import {PLAYER_RADIUS,TICK_MS} from '../shared/src/constants';

const dir=path.resolve(process.env.DATA_DIR??'');
assert.equal(path.dirname(dir).toLowerCase(),path.resolve(os.tmpdir()).toLowerCase(),'Use a new temp child');
assert.equal(process.env.BACKUP_KEEP,'0');assert.equal(process.env.BACKUP_DIR??'','');
await fs.mkdir(dir,{recursive:true});assert.equal((await fs.readdir(dir)).length,0);
const rows=[];const timeLimitMs=120000;
for(const a of MIDGAME_ADVENTURES)for(const classId of ['warrior','ranger','mage'] as const){
 const level=ZONES[a.id].levelBand[0];
 for(const profile of level>=35?['ordinary','earned_set'] as const:['ordinary'] as const)for(const seed of [101,202,303])for(const pack of a.encounters){
  const random=Math.random,rng=new Rng(seed);Math.random=()=>rng.next();
  const inst=new Instance({zoneId:a.id,key:'band-audit',channel:0,seed,theme:'glade',level,difficulty:0});
  try{
   // Keep the real map, physics and combat. Only this authored encounter is in the fixture.
   inst.spawner.tick=()=>{};for(const m of [...inst.mobs])inst.removeEntity(m.id);
   const save=createCharacter('Band'+classId,classId,seed);save.level=level;save.equipment={};save.inventory.fill(null);
   const put=(item:Item)=>{const i=save.inventory.findIndex(i=>!i);assert(i>=0);save.inventory[i]=item;assert.equal(equipItem(save,item.id),null);};
   for(const offer of merchantStock(save))put(structuredClone(offer.item));
   put(generateItem(rng,{ilvl:level,classId,base:CLASSES[classId].starter.mainhand,rarity:'magic',smartChance:1}));
   autoSlotSkills(save);
   // Same signature skill in both profiles; no runes, tiers, passives or extracted powers.
   const signature=classId==='warrior'?'whirlwind':classId==='ranger'?'sentry':'meteor';
   if(!save.skills.slots.includes(signature))save.skills.slots[3]=signature;
   if(profile==='earned_set'){put(campaignSetReward(rng,classId,'class_set_shoulders',30));put(campaignSetReward(rng,classId,'class_set_feet',35));}
   const s={save,derived:computeStats(save),sessionId:save.id,send(){},sendRaw(){},markDirty(){},changed(refresh:boolean){s.derived=computeStats(save);if(refresh)inst.refreshPlayer(s);},rec:{inst}} as unknown as Session;
   const at=[[pack.x,pack.y+220],[pack.x-220,pack.y],[pack.x,pack.y-220],[pack.x+220,pack.y]].find(([x,y])=>inst.cw.isFree(x,y,PLAYER_RADIUS));assert(at,'No legal approach');
   s.entityId=inst.addPlayer(s,{x:at[0],y:at[1]});const p=inst.playerById(s.entityId)!;p.debugInfiniteHp=true;
   const targets=pack.members.map(m=>createMob(inst,MONSTERS[m.type],level,pack.x+m.dx,pack.y+m.dy,{tier:m.tier??0,affixes:m.affixes,combat:m.combat,dormant:false}));
   const totalHp=targets.reduce((n,m)=>n+m.mhp,0);let firstKillMs:number|null=null,seq=0;
   while(targets.some(m=>!m.dead)&&inst.t<timeLimitMs){
    const nearest=targets.filter(m=>!m.dead).sort((x,y)=>Math.hypot(p.x-x.x,p.y-x.y)-Math.hypot(p.x-y.x,p.y-y.y))[0];
    const dx=nearest.x-p.x,dy=nearest.y-p.y,d=Math.hypot(dx,dy),stop=classId==='warrior'?45:180;
    inst.queueInput(s,{t:'in',seq:++seq,mx:d>stop?dx/d:0,my:d>stop?dy/d:0});inst.tick();
    if(firstKillMs===null&&targets.some(m=>m.dead))firstKillMs=inst.t;
   }
   rows.push({zone:a.id,band:ZONES[a.id].levelBand,classId,profile,seed,pack:pack.id,members:targets.length,totalHp,
    elapsedMs:inst.t,firstKillMs,cleared:targets.every(m=>m.dead),remaining:targets.filter(m=>!m.dead).map(m=>({type:m.type,hp:Math.round(m.hp),state:m.state})),xp:save.xp,
    signature,slots:save.skills.slots});
  }finally{inst.destroy();Math.random=random;}
 }
}
const bands=[];
for(const zone of MIDGAME_ADVENTURES.map(a=>a.id))for(const classId of ['warrior','ranger','mage'])for(const profile of ['ordinary','earned_set']){
 const samples=rows.filter(r=>r.zone===zone&&r.classId===classId&&r.profile===profile);if(!samples.length)continue;
 const clear=samples.filter(r=>r.cleared),durations=clear.map(r=>r.elapsedMs).sort((a,b)=>a-b);
 const seconds=samples.reduce((n,r)=>n+r.elapsedMs,0)/1000,xp=samples.reduce((n,r)=>n+r.xp,0);
 bands.push({zone,band:ZONES[zone].levelBand,classId,profile,trials:samples.length,stalls:samples.length-clear.length,
  medianPackMs:durations.length?durations[Math.floor(durations.length/2)]:null,maxPackMs:durations.at(-1)??null,combatOnlyXpPerHour:Math.round(xp/seconds*3600)});
}
const result={scope:'Isolated actual20Hz encounter simulation, infinite HP, no dodge bot, no survival claim. Zone lower-bound level; complete current normal vendor kit plus same-level magic starter weapon; optional earned shoulders30/feet35. No rune/tier/passive/power spend. Fresh cooldowns/resources per pack, no unrelated spawns/respawns. XP/hour is combat only, excludes story/travel/menus. Three seeded trials per encounter/profile/class. Timeout is audit bound, not tuning target.',xpMultiplier:Number(process.env.XP_MULT??3),timeLimitMs,tickMs:TICK_MS,bands};
// Keep generated evidence compact: metadata readable, one encounter per line.
await fs.writeFile('docs/phase/P09-mid-game/COMBAT-BAND-MODEL.json',JSON.stringify(result,null,2).slice(0,-1)+',"rows":[\n'+rows.map(r=>JSON.stringify(r)).join(',\n')+'\n]}\n');
console.log(JSON.stringify({runs:rows.length,stalls:rows.filter(r=>!r.cleared).map(({zone,classId,profile,pack,remaining})=>({zone,classId,profile,pack,remaining})),bands},null,2));
