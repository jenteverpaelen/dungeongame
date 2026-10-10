import { randomInt } from 'node:crypto';
import { addToInventory } from '../../shared/src/character';
import { addCubeXp, canAfford, CUBE_XP, fuseCost, pay, reforgeCost } from '../../shared/src/cube';
import { BASES, GEMS, SETS } from '../../shared/src/data/items';
import { economySnapshot, recordEconomy } from '../../shared/src/economy';
import { collectItem } from '../../shared/src/itemCollection';
import { forgeCost, RECIPE_UNLOCKS } from '../../shared/src/itemRecipes';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import type { Session } from './net/session';
import { requireNear } from './townServices';
import { fail, ok } from './world';

export function recipeCommand(s:Session,a:Record<string,unknown>) {
  const action=a.recipe;
  if(typeof action!=='string'||!Object.hasOwn(RECIPE_UNLOCKS,action))return fail('Choose a recipe');
  const role=action==='forge'?'blacksmith':action==='exchange'?'jeweler':'cube';
  const near=requireNear(s,role);if(near)return fail(near);
  if(s.save.cube.level<RECIPE_UNLOCKS[action as keyof typeof RECIPE_UNLOCKS])return fail(`Requires workshop level ${RECIPE_UNLOCKS[action as keyof typeof RECIPE_UNLOCKS]}`);
  const save=s.save,before=economySnapshot(save),rng=new Rng(randomInt(0x7fffffff));
  if(action==='forge'){
    if(typeof a.base!=='string'||!Object.hasOwn(BASES,a.base))return fail('Choose a base');
    const base=BASES[a.base];if(base.classes&&!base.classes.includes(save.classId))return fail('Choose a base for your class');
    if(!save.inventory.includes(null))return fail('Make room in your inventory');
    const cost=forgeCost(save.level);if(!canAfford(save,cost))return fail('Not enough gold or crafting materials');
    const item=generateItem(rng,{ilvl:save.level,classId:save.classId,base:a.base,rarity:'rare',smartChance:1});
    pay(save,cost);addToInventory(save,item);addCubeXp(save,CUBE_XP.fuse);recordEconomy(save,'forge',before);s.changed(false);return ok({item});
  }
  if(action==='exchange'){
    if(typeof a.from!=='string'||typeof a.to!=='string'||!Object.hasOwn(GEMS,a.from)||!Object.hasOwn(GEMS,a.to)||a.from===a.to)return fail('Choose two different gem families');
    if(typeof a.rank!=='number'||!Number.isInteger(a.rank)||a.rank<1||a.rank>6)return fail('Choose a valid gem rank');
    const key=`${a.from}:${a.rank}`,target=`${a.to}:${a.rank}`,cost=fuseCost(a.rank);
    if((save.gems[key]??0)<3||!canAfford(save,cost))return fail('Requires three matching gems and the displayed gold');
    if(!Number.isSafeInteger((save.gems[target]??0)+1))return fail('Gem capacity reached');
    pay(save,cost);save.gems[key]-=3;save.gems[target]=(save.gems[target]??0)+1;addCubeXp(save,CUBE_XP.fuse);
    recordEconomy(save,'gemExchange',before);s.changed(false);return ok();
  }
  const index=save.inventory.findIndex(i=>i?.id===a.itemId),item=save.inventory[index];
  if(!item?.set||!SETS[item.set]||SETS[item.set].classId!==save.classId)return fail('Choose a set piece for your class from your bag');
  if(item.protected||item.vendorStock||s.pendingEnchant?.itemId===item.id)return fail('This item is protected or has an unfinished enchant');
  if(typeof a.set!=='string'||!Object.hasOwn(SETS,a.set)||SETS[a.set].classId!==save.classId||typeof a.base!=='string'||!SETS[a.set].pieces.some(p=>p.base===a.base))return fail('Choose a class set and piece');
  const cost=reforgeCost();if(!canAfford(save,cost))return fail('Not enough gold or crafting materials');
  const fresh=generateItem(rng,{ilvl:item.ilvl,classId:save.classId,rarity:'set',set:a.set,base:a.base,smartChance:1,ancientAllowed:false,primalAllowed:false});
  pay(save,cost);
  for(const g of item.sockets)if(g){const key=`${g.gem}:${g.rank}`;save.gems[key]=(save.gems[key]??0)+1;}
  save.inventory[index]=fresh;collectItem(save,fresh);addCubeXp(save,CUBE_XP.reforge);recordEconomy(save,'setConversion',before);s.changed(false);return ok({item:fresh});
}
