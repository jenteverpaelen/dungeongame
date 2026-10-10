/** C095: current-rule distributions. Generated resources are not measured human farming rates. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createCharacter} from '../shared/src/character';
import {Rng} from '../shared/src/math';
import {generateItem,rollDrops,type EliteTier} from '../shared/src/items';
import {DIFFICULTIES} from '../shared/src/progression';
import {ZONES} from '../shared/src/data/zones';
import {QUESTS} from '../shared/src/data/quests';
import {merchantStock,salePrice} from '../shared/src/merchant';
import {UPGRADE_CHANCE,FORTUNE_PER_FAIL,salvageYield,salvageXp,enchantCost,upgradeCost,transmuteCost,
  extractCost,reforgeCost,socketCost,fuseCost,gemRemoveCost} from '../shared/src/cube';
import type {ClassId,Item,Materials,Rarity} from '../shared/src/types';

assert(process.env.DATA_DIR,'Fresh isolated DATA_DIR required');
assert.equal((await fs.readdir(process.env.DATA_DIR)).length,0,'Use an empty fixture directory');
process.env.BACKUP_DIR='';process.env.BACKUP_KEEP='0';process.env.XP_MULT='3';
const {applyAfkGains}=await import('../server/src/afk');
const classes:ClassId[]=['warrior','ranger','mage'];
const levels=[1,4,7,9,12,16,20,25,30,35,40,45,50,60,70];
const resourceKeys=['gold','saleGold','items','legendaryOrSet','gems','scrap','dust','crystal','soul','deathsBreath','cubeXp'] as const;
type Totals=Record<typeof resourceKeys[number],number>;
const totals=():Totals=>Object.fromEntries(resourceKeys.map(k=>[k,0])) as Totals;
function distribution(values:number[]){
  const sorted=values.slice().sort((a,b)=>a-b),n=sorted.length;
  return {mean:values.reduce((a,b)=>a+b,0)/n,p10:sorted[Math.ceil(n*.1)-1],median:sorted[Math.ceil(n*.5)-1],p90:sorted[Math.ceil(n*.9)-1]};
}
let generatedKills=0;
function sample(level:number,difficulty:number,classId:ClassId,elite:EliteTier,kills:number,trials:number){
  // Independent trial seeds, pity reset per trial; full collection and fixed level.
  const batches:Totals[]=[];
  for(let trial=0;trial<trials;trial++){
    const rng=new Rng(73+level*100000+classes.indexOf(classId)*10000+difficulty*1000+elite*100+trial),sum=totals();let pity=0;
    for(let k=0;k<kills;k++){
      const result=rollDrops(rng,{level,difficulty,classId,elite,pity,inRift:false,magicFind:0},0);pity=result.pity;generatedKills++;
      for(const drop of result.drops){
        if(drop.type==='gold')sum.gold+=Math.round(drop.amount*(1+DIFFICULTIES[difficulty].goldBonus/100)); // server payloadOf
        if(drop.type==='item'){
          sum.items++;sum.saleGold+=salePrice(drop.item)!;
          if(drop.item.rarity==='legendary'||drop.item.rarity==='set')sum.legendaryOrSet++;
          for(const [key,n] of Object.entries(salvageYield(drop.item)))sum[key as keyof Materials]+=n;
          sum.cubeXp+=salvageXp(drop.item);
        }
        if(drop.type==='gem')sum.gems++;
        if(drop.type==='mat')sum.deathsBreath+=drop.amount;
      }
    }
    batches.push(sum);
  }
  return {level,difficulty,difficultyName:DIFFICULTIES[difficulty].name,classId,elite,kills,trials,
    resources:Object.fromEntries(resourceKeys.map(key=>[key,distribution(batches.map(row=>row[key]))])) as Record<keyof Totals,ReturnType<typeof distribution>>};
}
const ordinary=[];
for(const level of levels)for(const difficulty of [0,level<60?3:DIFFICULTIES.length-1])for(const cls of classes)ordinary.push(sample(level,difficulty,cls,0,100,200));
const elites=[];
for(const level of [4,20,50,70])for(const tier of [1,2,4,5] as EliteTier[])for(const cls of classes)elites.push(sample(level,0,cls,tier,1,200));

const offline=[];const now=2_000_000_000_000;
for(const zone of Object.values(ZONES).filter(z=>z.kind==='field'))for(const level of [...new Set(zone.levelBand)])for(const hours of [1,12]){
  const save=createCharacter('EconomyModel','mage',73);save.level=level;save.equipment={};save.lastZone=zone.id;save.lastSeen=now-hours*3_600_000;
  const report=applyAfkGains(save,now)!;assert(report);assert.equal(report.kills,hours*900);
  offline.push({zone:zone.id,initialLevel:level,hours,gold:report.gold,kills:report.kills,mats:report.mats,xp:report.xp,levelsGained:report.levels});
}
const attempts=UPGRADE_CHANCE.map((chance,tier)=>{
  let reach=1,expectedAttempts=0,failures=0;
  for(;;){expectedAttempts+=reach;const success=Math.min(100,chance+failures*FORTUNE_PER_FAIL)/100;if(success===1)break;reach*=1-success;failures++;}
  return {tier,expectedAttempts,maxAttempts:failures+1};
});
const recipes=[];
for(const level of [1,20,50,70])for(const rarity of ['magic','rare','legendary'] as Rarity[]){
  const item=generateItem(new Rng(73),{ilvl:level,classId:'mage',base:'wand',rarity:'rare'});item.rarity=rarity;
  const perKill=ordinary.find(r=>r.level===level&&r.difficulty===0&&r.classId==='mage')!.resources.gold.mean/100;
  for(const count of [0,5]){const cost=enchantCost({...item,enchantCount:count});recipes.push({level,rarity,recipe:'enchant',state:count,cost,goldEquivalentOrdinaryKills:cost.gold/perKill});}
  for(const tier of [0,6,9]){const cost=upgradeCost({...item,upgrade:tier}),expect=attempts[tier];recipes.push({level,rarity,recipe:'empower',state:tier,cost,expectedAttempts:expect.expectedAttempts,
    goldEquivalentOrdinaryKills:cost.gold*expect.expectedAttempts/perKill});}
}
let checkedOffers=0;
for(let level=1;level<=70;level++)for(const classId of classes)for(const offer of merchantStock({level,classId})){
  assert(offer.price>salePrice(offer.item)!,'Purchase/resale must lose gold');assert.deepEqual(salvageYield(offer.item),{});assert.equal(salvageXp(offer.item),0);
  for(const tier of [0,10])assert.equal(salePrice({...offer.item,upgrade:tier,enchantCount:100}),salePrice(offer.item),'Improvement cannot increase NPC resale price');
  checkedOffers++;
}
const out=process.argv[2];assert(out,'Explicit output required; never overwrite historical C021 evidence');
const result={checkpoint:'C095',node:process.version,policy:'Allow savings; prevent exploit loops. No hard wallet cap.',
  methodology:'Fixed-level actual rollDrops;200 seeded trials per row.100 ordinary kills per trial,1 elite per trial. Zero magic/gold-find. Server difficulty gold multiplier included. All drops assumed collected. No combat/travel/pickup time, equipment retention, bags, deaths, rift bonus or goblin hit spills. Sale gold and salvage materials/CubeXP are mutually exclusive alternatives, not simultaneous income.',
  offlineMethodology:'Existing fixed formula at1/12h,900 assumed kills/h, mage unequipped, no reward affixes, XP_MULT3. Starting zone-clamped level stays fixed within each grant. Not measured active gameplay or a new reward rate.',
  generatedKills,ordinary,elites,offline,recipes,upgradeExpectedAttempts:attempts,
  fixedCosts:{transmute:transmuteCost(),extract:extractCost(),reforge:reforgeCost(),sockets:[1,20,50,70].map(ilvl=>({ilvl,cost:socketCost({ilvl} as Item)})),
    gems:[1,2,3,4,5].map(rank=>({rank,removal:gemRemoveCost(rank),fusion:rank<5?fuseCost(rank):null,inputGems:rank<5?3:null}))},
  contracts:QUESTS.filter(q=>q.repeat).map(q=>({id:q.id,reward:q.reward,steps:q.steps})),
  loopChecks:{checkedOffers,purchaseResale:'strictly negative gold; improvements do not raise offer',stockSalvage:'zero materials and zero CubeXP',
    custody:'Actual handler tests cover exact sell/buyback, stash/gems, repeat and paid choice identity; this model does not simulate every handler.'},
  limits:'Simulated generated quantities, not human gold/hour or inflation acceptance. Independent review/full owner playtest/real soak remain pending. No prices or rates changed.'};
await fs.writeFile(path.resolve(out),JSON.stringify(result,null,2)+'\n');
assert.equal((await fs.readdir(process.env.DATA_DIR)).length,0);
console.log(JSON.stringify({out,generatedKills,ordinaryRows:ordinary.length,eliteRows:elites.length,offlineRows:offline.length,checkedOffers,
  normalMage:ordinary.filter(r=>r.difficulty===0&&r.classId==='mage').map(r=>({level:r.level,gold:r.resources.gold,items:r.resources.items.mean,soul:r.resources.soul.mean,cubeXp:r.resources.cubeXp.mean}))}));
