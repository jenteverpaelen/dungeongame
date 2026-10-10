import { randomUUID } from 'node:crypto';
import { MERCHANTS, BUYBACK_CAPACITY, merchantStock, ownedItems, salePrice, validMerchant } from '../../shared/src/merchant';
import { itemProtectionReason } from '../../shared/src/itemProtection';
import { fail, ok } from './world';
import type { Session } from './net/session';

/** Validate every input and ownership transfer before modifying the character snapshot. */
export function merchantCommand(s:Session,a:Record<string,unknown>){
  const def=MERCHANTS.find(m=>m.id===a.merchant),inst=s.rec?.inst;
  if(!def||inst?.map.zone!==def.zone)return fail('Visit the merchant at their camp');
  const spot=inst.map.adventure?.interactions.find(i=>i.id===def.target);
  if(!spot||!inst.canInteract(s,spot.x,spot.y,spot.radius))return fail(`Stand beside ${def.name} while alive to trade`);
  const save=s.save;
  if(!Number.isSafeInteger(save.gold)||save.gold<0)return fail('Your gold balance could not be verified');
  if(save.merchant&&!validMerchant(save.merchant))return fail('Your retained merchant records need a supported version; nothing was changed');
  const record=save.merchant??{revision:1 as const,sequence:0,items:[]};
  if(a.sequence!==record.sequence||!Number.isSafeInteger(record.sequence+1))return fail('This offer changed; select the item again');
  if(typeof a.itemId!=='string'||!['buy','sell','buyback','release'].includes(String(a.action)))return fail('Select a trade action and item');
  if(a.action==='buy'){
    const offer=merchantStock(save).find(e=>e.item.id===a.itemId);
    if(!offer||a.price!==offer.price)return fail('This stock offer changed; review the current item and price');
    const slot=save.inventory.indexOf(null);
    if(slot<0)return fail('Make room in your inventory before buying gear');
    if(save.gold<offer.price)return fail('Not enough gold for this purchase');
    const id=randomUUID();
    if(ownedItems(save).some(i=>i?.id===id))return fail('Could not assign an item identity; nothing changed');
    save.inventory[slot]={...offer.item,id};save.gold-=offer.price;
    record.sequence++;save.merchant=record;s.changed(false);return ok();
  }
  const matches=ownedItems(save).filter(i=>i?.id===a.itemId);
  if(matches.length!==1)return fail('Item custody could not be verified; nothing changed');
  if(a.action==='sell'){
    const index=save.inventory.findIndex(i=>i?.id===a.itemId),item=save.inventory[index];
    if(!item)return fail('Only items in your inventory can be sold');
    const protectedReason=itemProtectionReason(item,'sell');if(protectedReason)return fail(protectedReason);
    if(s.pendingEnchant?.itemId===item.id)return fail('Choose the pending enchantment before selling this item');
    if(record.items.length>=BUYBACK_CAPACITY)return fail('Buyback is full. Reclaim or explicitly release a retained item first');
    const price=salePrice(item);
    if(price===null||a.price!==price)return fail('The sale price changed; review the offer again');
    if(!Number.isSafeInteger(save.gold+price))return fail('This sale would exceed your gold capacity');
    save.inventory[index]=null;record.items.push({item,price});save.gold+=price;
  }else{
    const index=record.items.findIndex(e=>e.item.id===a.itemId),entry=record.items[index];
    if(!entry||a.price!==entry.price)return fail('This retained offer is no longer available');
    if(a.action==='buyback'){
      const slot=save.inventory.indexOf(null);
      if(slot<0)return fail('Make room in your inventory before reclaiming this item');
      if(save.gold<entry.price)return fail('Not enough gold to reclaim this item');
      save.gold-=entry.price;save.inventory[slot]=entry.item;
    }else {
      if(entry.item.protected)return fail('This retained item is protected; reclaim it before changing its protection');
      if(a.confirm!==entry.item.id)return fail('Review the item and confirm its permanent release');
    }
    record.items.splice(index,1);
  }
  record.sequence++;save.merchant=record;s.changed(false);return ok();
}
