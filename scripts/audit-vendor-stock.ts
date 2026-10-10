/** C092: deterministic acquisition model, never a player-time/inflation benchmark. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {Rng} from '../shared/src/math';
import {rollDrops} from '../shared/src/items';
import {stockPrice,STOCK_GOLD_KILLS} from '../shared/src/merchant';
assert(process.env.DATA_DIR,'isolated DATA_DIR required');
const trials=2000,levels=[1,4,7,9,12,16,20],rows=[];
for(const level of levels)for(const classId of ['warrior','ranger','mage'] as const){
  const rng=new Rng(level*103+classId.length),totals:number[]=[],firstPurchase:number[]=[];let itemCount=0,gemCount=0,afford24=0;
  for(let t=0;t<trials;t++){
    let gold=0,pity=0,first=0;
    for(let k=0;k<STOCK_GOLD_KILLS*2;k++){
      const result=rollDrops(rng,{level,difficulty:0,elite:0,classId,magicFind:0,pity,inRift:false},0);pity=result.pity;
      for(const d of result.drops)if(d.type==='gold')gold+=d.amount;else if(d.type==='item')itemCount++;else if(d.type==='gem')gemCount++;
      if(!first&&gold>=stockPrice(level))first=k+1;
      if(k+1===STOCK_GOLD_KILLS)totals.push(gold);
    }
    if(first){firstPurchase.push(first);afford24++;}
  }
  totals.sort((a,b)=>a-b);const price=stockPrice(level);
  firstPurchase.sort((a,b)=>a-b);
  rows.push({level,classId,trials,monstersPerTrial:STOCK_GOLD_KILLS*2,price,meanGoldAfter12:totals.reduce((a,b)=>a+b,0)/trials,p10After12:totals[199],medianAfter12:totals[999],p90After12:totals[1799],canAffordAfter12:totals.filter(g=>g>=price).length/trials,canAffordAfter24:afford24/trials,zeroGoldAfter12:totals.filter(g=>g===0).length/trials,firstAffordableMedianAmongCompleted:firstPurchase[Math.floor(firstPurchase.length/2)],censoredAt24:trials-afford24,generatedItemsAcross24:itemCount,generatedGemsAcross24:gemCount});
}
const report={checkpoint:'C092',scope:'Generated ordinary Normal-difficulty gold at12/24 kills; assumes all gold collected at fixed level. No elite/contract/item-sale/offline income, no elapsed time or player behavior. First-affordability median excludes explicitly counted24-kill censored trials.',seedPolicy:'level*103+class-name length;2000 independent24-kill trials per level/class; pity resets per trial',rows};
const out=process.argv[2];if(out)fs.writeFileSync(path.resolve(out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
