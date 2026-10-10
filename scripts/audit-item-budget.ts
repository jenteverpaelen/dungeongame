import { combatInteger, MAX_COMBAT_AMOUNT } from '../shared/src/combatBounds';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { AFFIXES, BASES, GEMS, LEGENDARIES, SETS, affixScale } from '../shared/src/data/items';
import { baseArmor, baseTierIndex, rollDrops, weaponAvgDamage } from '../shared/src/items';
import { Rng } from '../shared/src/math';
import { monsterHp, DIFFICULTIES } from '../shared/src/progression';
import type { EliteTier } from '../shared/src/items';
assert(process.env.DATA_DIR);await fs.mkdir(process.env.DATA_DIR,{recursive:true});assert.equal((await fs.readdir(process.env.DATA_DIR)).length,0);
assert.equal(process.env.BACKUP_KEEP,'0');assert.equal(process.env.BACKUP_DIR??'','');
const cadence=[];const kills=10000;
for(const [level,difficulty] of [[1,0],[35,0],[70,0],[70,13]])for(const elite of [0,1,2,3,4,5] as EliteTier[]){
 if(level<70&&elite!==0)continue;
 const runs=[];
 for(const scale of [1,2/3]){
  const rng=new Rng(701+elite),counts={items:0,legendary:0,set:0,gold:0,gems:0,mats:0},gaps:number[]=[];let pity=0,since=0;
  for(let n=0;n<kills;n++){
   const result=rollDrops(rng,{level,difficulty,elite,classId:'warrior',magicFind:0,pity,inRift:false},0,scale);pity=result.pity;since++;
   let chase=false;
   for(const d of result.drops){if(d.type==='item'){counts.items++;if(d.item.rarity==='legendary'||d.item.rarity==='set'){counts[d.item.rarity]++;chase=true;}}
    else if(d.type==='gold')counts.gold++;else if(d.type==='gem')counts.gems++;else if(d.type==='mat')counts.mats++;}
   if(chase){gaps.push(since);since=0;}
   if(elite===4)assert(chase,'Boss guarantee');assert(pity<=45);
  }
  runs.push({scale,...counts,itemsPer100Kills:counts.items/kills*100,chasePer100Kills:(counts.legendary+counts.set)/kills*100,maxObservedChaseGapKills:Math.max(0,...gaps)});
 }
 assert(runs[1].items<runs[0].items);cadence.push({level,difficulty,elite,kills,before:runs[0],after:runs[1],equipmentRatio:runs[1].items/runs[0].items});
}
// Conservative item-only envelope:13slots, every affix at its largest legal kind value simultaneously,
// Ancient1.3 × Empower1.6, and39sockets all granting the largest relevant gem. This is deliberately
// more gear than can actually be equipped; excludes unlimited future Paragon allocation.
const maxAffix=(stat:string)=>Math.max(0,...AFFIXES.filter(a=>a.stat===stat).flatMap(a=>Object.values(a.ranges).map(r=>r[1]*affixScale(a.scale,70))))*1.3*1.6;
const per=(stat:string)=>13*maxAffix(stat);
const main=1000+Math.max(per('str'),per('dex'),per('int'))+39*280;
const vitality=1000+per('vit')+39*280;
const life=(1000+vitality*100)*(1+per('lifePct')/100+39*.15);
const weapon=2*Math.max(...Object.values(BASES).filter(b=>b.weapon).map(b=>weaponAvgDamage(70,b)))*1.3*1.6+per('flatMin')*3;
const weaponBoost=1+per('weaponDmgPct')/100+39*.15;
const elemental=1+Math.max(per('eleFire'),per('eleCold'),per('eleLightning'),per('eleArcane'),per('elePhysical'))/100;
const affixSkill=1+per('skillDmg')/100;
const crit=1+per('chd')/100+39*1.3+2;
const elite=1+per('elite')/100+39*.15;
const setMultiplier=Math.max(51,...Object.values(SETS).flatMap(s=>(s.effects??[]).map(e=>e.multiplier??1)));
//100 coefficient and100 additive skill multiplier are generous overestimates of current coefficients,
// tiers+runes+power; buff bucket128 overestimates simultaneous current conditional amplification.
const singleHitEnvelope=weapon*weaponBoost*(1+main/100)*crit*elemental*affixSkill*elite*setMultiplier*100*100*128;
const envelope={scope:'Level70 item contribution with Paragon0; impossible superset of all positive affixes and39max-rank gems. Conservative finite upper envelope, not achievable build stats or uncapped-Paragon proof.',main,vitality,life,weapon,setMultiplier,singleHitEnvelope,maxSafeInteger:Number.MAX_SAFE_INTEGER,enforcedCombatCeiling:MAX_COMBAT_AMOUNT,saturatedEnvelope:combatInteger(singleHitEnvelope),itemOnlyHpBelowSafeInteger:life<Number.MAX_SAFE_INTEGER,itemOnlyDamageBelowSafeInteger:singleHitEnvelope<Number.MAX_SAFE_INTEGER,
  maxOrdinaryMonsterHp:monsterHp(70)*DIFFICULTIES[13].hp,
  paragon:'Uncapped allocation remains a P12 numerical policy. No big-number library adopted; do not claim all future Paragon configurations are exact integers.'};
const tiers=Array.from({length:70},(_,i)=>({level:i+1,tier:baseTierIndex(i+1),weapon:weaponAvgDamage(i+1,BASES.sword),armor:baseArmor(i+1,BASES.chest_plate)}));
assert(tiers.every((r,i)=>i===0||r.weapon>=tiers[i-1].weapon&&r.armor>=tiers[i-1].armor));
const result={scope:'Seeded local generated-drop model,10000kills per row, old opportunity scale1 versus new2/3 using final item catalogue; not human kills/hour or historical byte-identical pre-P11 RNG. Non-equipment probabilities unchanged; sample counts may differ due to RNG consumption. Boss guaranteed-chase overhead included.',cadence,envelope,tiers,counts:{affixes:AFFIXES.length,bases:Object.keys(BASES).length,powers:Object.keys(LEGENDARIES).length,sets:Object.keys(SETS).length,gems:Object.keys(GEMS).length}};
await fs.writeFile('docs/phase/P11-itemization/ITEM-BUDGET-MODEL.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({rows:cadence.length,ratioRange:[Math.min(...cadence.map(r=>r.equipmentRatio)),Math.max(...cadence.map(r=>r.equipmentRatio))],envelope,counts:result.counts}));
