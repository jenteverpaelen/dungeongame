import { INVENTORY_SIZE, MAX_LEVEL } from './constants';
import { BASES } from './data/items';
import type { CharacterSave, Item } from './types';

export const MERCHANTS = [{ id:'orren', zone:'rillwake_crossing', target:'tender', name:'Orren' }] as const;
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
  return Math.max(1,Math.round((4+item.ilvl*2.5)*Math.pow(1.06,item.ilvl)));
}
export function retainedItems(save:CharacterSave):Item[]{return validMerchant(save.merchant)?save.merchant.items.map(e=>e.item):[];}
export function ownedItems(save:CharacterSave):(Item|null)[]{return [...save.inventory,...save.stash,...Object.values(save.equipment),...retainedItems(save)];}
