import { INVENTORY_SIZE, MAX_LEVEL } from './constants';
import { BASES } from './data/items';
import { baseArmor, baseGoldAmount, baseTierIndex, makeLook, NORMAL_GOLD_DROP_CHANCE, weaponAvgDamage } from './items';
import { CLASSES } from './data/classes';
import { hashString, Rng } from './math';
import type { CharacterSave, Item } from './types';

export const MERCHANTS = [
  { id:'orren', zone:'rillwake_crossing', target:'tender', name:'Orren' },
  { id:'iven', zone:'cairnspill_terraces', target:'surveyor', name:'Iven' },
  { id:'kessa', zone:'cinderwash_kilns', target:'firekeeper', name:'Kessa' },
  { id:'venn', zone:'kilnwatch_crown', target:'watchkeeper', name:'Venn' },
] as const;
export const STOCK_LEVEL_CAP = 20;
/** L112: candidate three ordinary four-member packs, not a promised elapsed time. */
export const STOCK_GOLD_KILLS = 12;
export const STOCK_REVISION = 1;
export const VENDOR_SALVAGE_REASON = 'Merchant stock cannot be salvaged. Equip it, store it or sell it back instead.';
export function stockPrice(level:number):number {
  return Math.max(Math.round(baseGoldAmount(level))+1,Math.ceil(baseGoldAmount(level)*NORMAL_GOLD_DROP_CHANCE*STOCK_GOLD_KILLS));
}
/** Stable mean-stat normal gear. No generated item IDs, loot RNG or saved-state mutation in previews. */
export function merchantStock(save:Pick<CharacterSave,'level'|'classId'>):{item:Item;price:number}[] {
  const level=Math.max(1,Math.min(STOCK_LEVEL_CAP,Math.floor(save.level))),classId=save.classId,starter=CLASSES[classId].starter;
  const kinds=['head','shoulders','chest','hands','wrists','waist','legs','feet'] as const;
  const bases=[starter.mainhand,starter.offhand!,...kinds.map(kind=>Object.values(BASES).find(b=>b.kind===kind&&b.affinity?.includes(classId))?.id
    ??Object.values(BASES).find(b=>b.kind===kind)!.id)];
  return bases.map(id=>{
    const b=BASES[id],token=`stock:${STOCK_REVISION}:${classId}:${level}:${id}`;
    const item:Item={id:token,base:id,kind:b.kind,name:b.names[baseTierIndex(level)],rarity:'normal',ancient:0,ilvl:level,reqLevel:level,
      affixes:[],sockets:[],upgrade:0,upgradeFortune:0,enchantCount:0,bound:false,vendorStock:true,look:makeLook(new Rng(hashString(token)),b,'normal',0)};
    if(b.armorMult)item.armor=baseArmor(level,b);
    if(b.weapon){const avg=weaponAvgDamage(level,b);item.weapon={min:Math.max(1,Math.round(avg*.65)),max:Math.max(2,Math.round(avg*1.35)),aps:b.weapon.aps,element:'physical'};}
    return {item,price:stockPrice(level)};
  });
}
export const BUYBACK_CAPACITY = INVENTORY_SIZE;
export interface MerchantState { revision: 1; sequence: number; items: { item: Item; price: number }[] }
export function validMerchant(value: unknown): value is MerchantState {
  if(!value||typeof value!=='object')return false;
  const s=value as MerchantState;
  return s.revision===1&&Number.isSafeInteger(s.sequence)&&s.sequence>=0&&Array.isArray(s.items)&&s.items.length<=BUYBACK_CAPACITY
    &&s.items.every(e=>e&&Number.isSafeInteger(e.price)&&e.price>0&&e.item&&typeof e.item.id==='string'&&!!e.item.id&&Object.hasOwn(BASES,e.item.base)
      &&Array.isArray(e.item.affixes)&&Array.isArray(e.item.sockets)&&!!e.item.look)
    &&new Set(s.items.map(e=>e.item.id)).size===s.items.length;
}
/** One existing unmodified gold pile at this item level. Crafting/sockets do not raise the offer. */
export function salePrice(item:Item):number|null {
  if(!Number.isInteger(item.ilvl)||item.ilvl<1||item.ilvl>MAX_LEVEL||!Object.hasOwn(BASES,item.base))return null;
  return Math.max(1,Math.round(baseGoldAmount(item.ilvl)));
}
export function retainedItems(save:CharacterSave):Item[]{return validMerchant(save.merchant)?save.merchant.items.map(e=>e.item):[];}
export function ownedItems(save:CharacterSave):(Item|null)[]{return [...save.inventory,...save.stash,...Object.values(save.equipment),...retainedItems(save)];}
