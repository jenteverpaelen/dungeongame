/** Actual local20Hz matched encounters. Infinite HP isolates clear speed, not survival. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Instance } from '../server/src/sim/instance';
import { createMob } from '../server/src/sim/monsters';
import { createCharacter, equipItem } from '../shared/src/character';
import { BASES, LEGENDARIES, SETS } from '../shared/src/data/items';
import { SKILLS } from '../shared/src/data/skills';
import { MONSTERS } from '../shared/src/data/monsters';
import { generateItem } from '../shared/src/items';
import { Rng } from '../shared/src/math';
import { computeStats } from '../shared/src/stats';
import type { ClassId, Item } from '../shared/src/types';
import type { Session } from '../server/src/net/session';

const dir=path.resolve(process.env.DATA_DIR??'');
assert.equal((await fs.realpath(path.dirname(dir))).toLowerCase(),(await fs.realpath(os.tmpdir())).toLowerCase());
assert.equal(process.env.BACKUP_KEEP,'0');assert.equal(process.env.BACKUP_DIR??'','');
await fs.mkdir(dir,{recursive:true});assert.equal((await fs.readdir(dir)).length,0);
const profiles=[
 {classId:'warrior',set:'endless_storm',weapon:'ninefold_gale',slots:['whirlwind','rend','ground_stomp','battle_rage']},
 {classId:'warrior',set:'cinder_oath',weapon:'bloodwake',slots:['rend','ground_stomp','battle_rage']},
 {classId:'warrior',set:'fault_warden',weapon:'faultcleaver',slots:['seismic_slam','ground_stomp','battle_rage']},
 {classId:'ranger',set:'siegebreaker',weapon:'thunderhead',slots:['sentry','multishot','cluster_arrow','companion']},
 {classId:'ranger',set:'farwatch',weapon:'hunters_mark',slots:['multishot','rain_of_vengeance','companion']},
 {classId:'ranger',set:'rainkeeper',weapon:'rainspindle',slots:['rain_of_vengeance','cluster_arrow','companion']},
 {classId:'mage',set:'fallen_star',weapon:'cindervane',slots:['meteor','black_hole','frost_nova','magic_weapon']},
 {classId:'mage',set:'glass_concord',weapon:'thousand_missiles',slots:['black_hole','frost_nova','magic_weapon']},
 {classId:'mage',set:'lantern_garden',weapon:'lanternroot',slots:['hydra','frost_nova','black_hole','magic_weapon']},
] as const;
const packs=[['bog_slime','gloomshroom','thornling','grave_bat','bog_slime','gloomshroom'],['flint_beetle','flint_beetle','flint_beetle'],['gorgemaw']] as const;
const rows:any[]=[];
for(const profile of profiles)for(const seed of [101,202,303])for(let encounter=0;encounter<3;encounter++){
 const random=Math.random,rng=new Rng(seed);Math.random=()=>rng.next();
 const inst=new Instance({zoneId:'whispering_glade',key:'item-audit',channel:0,seed:41,theme:'glade',level:70,difficulty:13});
 try{
  inst.dmgBySkill=new Map();inst.spawner.tick=()=>{};for(const m of [...inst.mobs])inst.removeEntity(m.id);
  const save=createCharacter(`Item${profile.classId}`,profile.classId,seed);save.level=70;save.difficulty=13;save.equipment={};save.inventory.fill(null);
  const put=(item:Item)=>{item.ancient=0;item.upgrade=0;for(const a of item.affixes)a.value=(a.min+a.max)/2;if(item.legendary)item.legendary.value=(item.legendary.min+item.legendary.max)/2;
    if(item.weapon){const b=BASES[item.base];item.weapon.min=item.weapon.max=(item.weapon.min+item.weapon.max)/2;assert(b.weapon);}
    save.inventory[save.inventory.findIndex(i=>!i)]=item;assert.equal(equipItem(save,item.id),null);};
  for(const piece of SETS[profile.set].pieces)put(generateItem(new Rng(seed+piece.base.length),{ilvl:70,classId:profile.classId,rarity:'set',set:profile.set,base:piece.base,smartChance:1,ancientAllowed:false}));
  for(const base of ['ring','ring','neck_amulet','wrists_bracers','waist_belt'])put(generateItem(rng,{ilvl:70,classId:profile.classId,rarity:'rare',base,smartChance:1}));
  put(generateItem(rng,{ilvl:70,classId:profile.classId,rarity:'legendary',legendary:profile.weapon,smartChance:1,ancientAllowed:false}));
  if(!BASES[LEGENDARIES[profile.weapon].base].weapon?.twoHanded||profile.classId==='ranger')
    put(generateItem(rng,{ilvl:70,classId:profile.classId,rarity:'rare',base:profile.classId==='warrior'?'shield':profile.classId==='ranger'?'quiver':'orb',smartChance:1}));
  save.skills.slots=Array.from({length:4},(_,i)=>profile.slots[i]??null);
  // Equal maximum48 tier-point budget: primary plus the first three selected abilities.
  for(const id of [save.skills.primary,...profile.slots.slice(0,3)])save.skills.tiers[id]=3;
  save.skills.runes={};
  const s={save,derived:computeStats(save),sessionId:save.id,send(){},sendRaw(){},markDirty(){},changed(refresh:boolean){s.derived=computeStats(save);if(refresh)inst.refreshPlayer(s);},rec:{inst}} as unknown as Session;
  let center:{x:number;y:number}|undefined;
  for(let y=600;y<inst.heightPx-600&&!center;y+=160)for(let x=600;x<inst.widthPx-600;x+=160){
    if([-150,0,150].every(dx=>[-150,0,150].every(dy=>inst.cw.isFree(x+dx,y+dy,24)))){center={x,y};break;}}
  assert(center);s.entityId=inst.addPlayer(s,{x:center.x,y:center.y+140});const p=inst.playerById(s.entityId)!;p.debugInfiniteHp=true;
  const targets=packs[encounter].map((id,i)=>{const def=MONSTERS[id];assert(def);return createMob(inst,def,70,center!.x+(i%3-1)*65,center!.y+Math.floor(i/3)*60,{tier:encounter===2?4:encounter===1?1:0,dormant:false,difficulty:13});});
  const hp=targets.reduce((n,m)=>n+m.mhp,0);let seq=0,maxHit=0; const addDmg=inst.addDmg.bind(inst); inst.addDmg=(m,owner,src,a,...args)=>{maxHit=Math.max(maxHit,a);addDmg(m,owner,src,a,...args);};
  while(targets.some(m=>!m.dead)&&inst.t<120000){
    const t=targets.filter(m=>!m.dead).sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y))[0];
    const dx=t.x-p.x,dy=t.y-p.y,d=Math.hypot(dx,dy),stop=profile.classId==='warrior'?45:150;
    inst.queueInput(s,{t:'in',seq:++seq,mx:d>stop?dx/d:0,my:d>stop?dy/d:0});inst.tick();
    for(const e of inst.events)if(e.ev.e==='dmg')maxHit=Math.max(maxHit,e.ev.a);
  }
  rows.push({classId:profile.classId,build:profile.set,seed,encounter,hp,ms:inst.t,cleared:targets.every(m=>m.dead),maxHit,slots:save.skills.slots,points:Object.keys(save.skills.tiers).length*12,damageBySkill:Object.fromEntries(inst.dmgBySkill!)});
 }finally{inst.destroy();Math.random=random;}
}
const summaries=profiles.map(p=>{const r=rows.filter(r=>r.build===p.set);return {classId:p.classId,build:p.set,totalMs:r.reduce((n,r)=>n+r.ms,0),stalls:r.filter(r=>!r.cleared).length,maxHit:Math.max(...r.map(r=>r.maxHit))};});
const result=summaries.map(r=>{const times=summaries.filter(s=>s.classId===r.classId).map(s=>s.totalMs).sort((a,b)=>a-b),median=times[1];return {...r,relativeToMedian:r.totalMs/median,passes:r.stalls===0&&r.totalMs/median<=1.25};});
await fs.writeFile('docs/phase/P11-itemization/BUILD-MODEL.json',JSON.stringify({scope:'Level70, TormentX actual20Hz, three fixed encounters × three seeds/build; ordinary non-ancient six-piece sets and signature power, no upgrades/gems/Paragon/passives/Cube powers/runes,48tier points. Infinite HP, automatic skills, deterministic chase; no survival/human/rift-clear claim. Three-build class median of total matched encounter clear time;120s timeouts count as failures.',result,rows},null,2));
console.log(JSON.stringify(result));
