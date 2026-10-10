import type { Cost } from './cube';
/** L129: three ordinary salvage yields plus the existing first-enchant gold curve. */
export function forgeCost(level:number):Cost {
  return {gold:100+4*level*level,mats:{scrap:3*(1+Math.floor(level/25)),dust:3*(1+Math.floor(level/25)),crystal:3*(1+Math.floor(level/30))}};
}
export const RECIPE_UNLOCKS = {forge:2,exchange:2,convertSet:7} as const;
