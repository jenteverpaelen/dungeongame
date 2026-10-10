import { BASES, SETS } from './data/items';
import { generateItem } from './items';
import type { Rng } from './math';
import type { ClassId, Item } from './types';

/** L118: first reliable two-piece access; broader alternative sets remain P11. */
export const CAMPAIGN_SETS:Record<ClassId,string>={warrior:'endless_storm',ranger:'siegebreaker',mage:'fallen_star'};
export const SET_REWARD_SLOTS={class_set_shoulders:'shoulders',class_set_feet:'feet'} as const;
export type SetReward=keyof typeof SET_REWARD_SLOTS;
export function campaignSetReward(rng:Rng,classId:ClassId,reward:SetReward,ilvl:number):Item {
  const set=CAMPAIGN_SETS[classId],piece=SETS[set].pieces.find(p=>BASES[p.base].kind===SET_REWARD_SLOTS[reward]);
  if(!piece)throw new Error(`Missing campaign set slot: ${classId}/${reward}`);
  const item=generateItem(rng,{ilvl,classId,rarity:'set',set,base:piece.base,smartChance:1,ancientAllowed:false,primalAllowed:false});
  item.bound=true;return item;
}
