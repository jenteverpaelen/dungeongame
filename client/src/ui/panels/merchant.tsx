import { useMemo, useState } from 'preact/hooks';
import { BUYBACK_CAPACITY, MERCHANTS, merchantStock, salePrice, STOCK_LEVEL_CAP, validMerchant } from '@shared/merchant';
import { ADVENTURES } from '@shared/adventure';
import { useUI } from '../store';
import { PanelFrame, Paged, SecHead, Tabs } from './common';
import { ItemTooltip, ItemVisual } from './tooltip';
import { run } from './util';

type TradeTab='buy'|'sell'|'buyback';
export function MerchantPanel(){
  const save=useUI(s=>s.char),zone=useUI(s=>s.zone),interact=useUI(s=>s.interact);
  const [tab,setTab]=useState<TradeTab>('buy'),[selected,setSelected]=useState<{id:string;sequence:number;price:number|null}|null>(null);
  const [release,setRelease]=useState(false),[busy,setBusy]=useState(false);
  const stock=useMemo(()=>save?merchantStock(save):[],[save?.level,save?.classId]);
  if(!save)return null;
  const def=MERCHANTS.find(m=>m.zone===zone?.zone),npc=def&&ADVENTURES[def.zone]?.npcs.find(n=>n.id===def.target);
  const near=!!npc&&interact?.name===npc.name,state=validMerchant(save.merchant)?save.merchant:undefined;
  const offers=tab==='buy'?stock:tab==='sell'?save.inventory.flatMap(item=>item?[{item,price:salePrice(item)}]:[]):state?.items??[];
  const offer=offers.find(e=>e.item.id===selected?.id),unsupported=!!save.merchant&&!state;
  const stale=selected&&(selected.sequence!==(state?.sequence??0)||selected.price!==offer?.price);
  const blocked=busy||!near||unsupported||!offer||offer.price===null||!!stale||(tab==='sell'&&!!offer.item.protected)
    ||(tab!=='sell'&&save.gold<(offer?.price??Infinity))||(tab!=='sell'&&!save.inventory.includes(null));
  const trade=async(action:TradeTab|'release')=>{
    if(!offer||!def||!selected)return;setBusy(true);
    try{const result=await run('merchant',{merchant:def.id,action,itemId:offer.item.id,sequence:selected.sequence,price:selected.price,...(action==='release'?{confirm:offer.item.id}:{})});if(result.ok){setSelected(null);setRelease(false);}}finally{setBusy(false);}
  };
  return <PanelFrame id="merchant" title={def?`${def.name}’s Gear Exchange`:'Camp Gear Exchange'} sub="Frontier provisions" width={1040}>
    <Tabs tabs={[{id:'buy',label:'Buy gear'},{id:'sell',label:'Sell gear'},{id:'buyback',label:'Buyback',badge:state?.items.length??0}]} value={tab} onChange={v=>{setTab(v);setSelected(null);setRelease(false);}}/>
    <p class="pn-note">Gold: {save.gold.toLocaleString()} · Retained items: {state?.items.length??0}/{BUYBACK_CAPACITY}. Buyback costs exactly what you received. Items stay until you reclaim or release them.</p>
    {tab==='buy'&&<p class="pn-note">Basic gear for your class · Item level {stock[0]?.item.ilvl} (up to {STOCK_LEVEL_CAP}). Every purchase matches its preview. Merchant stock cannot be salvaged.</p>}
    {!near&&<p role="status">Stand beside a camp merchant to trade.</p>}
    {unsupported&&<p role="status">Your retained records use an unsupported format. They remain unchanged.</p>}
    {stale&&<p role="status">The offer changed. Select the item again to review it.</p>}
    <div class="journal-columns"><nav class={'quest-list '+(tab==='buy'?'stock-offers':'')} aria-label={tab==='buy'?'Stock offers':tab==='sell'?'Inventory offers':'Retained items'}><Paged key={tab} size={tab==='buy'?10:6} label="Gear pages">
      {offers.map(e=><button key={e.item.id} class={'btn '+(selected?.id===e.item.id?'primary':'')} aria-pressed={selected?.id===e.item.id} onClick={()=>{setSelected({id:e.item.id,sequence:state?.sequence??0,price:e.price});setRelease(false);}}>
        <ItemVisual item={e.item} size={24}/><strong>{e.item.name}</strong><small>{e.item.protected?'Protected':`${e.price??'Unavailable'} gold`}</small>
      </button>)}
    </Paged></nav><div class="journal-detail">{offer?<>
      <SecHead>{tab==='buy'?'Review your purchase':tab==='sell'?'Review your sale':'Recover your gear'}</SecHead>
      <p class="pn-note">{tab==='buy'?`Resale value: ${salePrice(offer.item)} gold. Buying does not equip the item.`:'Socketed gems stay with the item. Crafting and rare properties do not increase this offer.'}</p>
      <button class="btn primary" disabled={blocked} onClick={()=>void trade(tab)}>{tab==='buy'?'Buy':tab==='sell'?'Sell':'Reclaim'} for {offer.price} gold</button>
      {tab!=='sell'&&save.gold<(offer.price??Infinity)&&<p role="status">Not enough gold.</p>}
      {tab!=='sell'&&!save.inventory.includes(null)&&<p role="status">Make room in your inventory.</p>}
      {tab==='buyback'&&<button class="btn" disabled={busy||!near||unsupported||!!stale||!!offer.item.protected} onClick={()=>setRelease(!release)}>Release from buyback…</button>}
      {release&&<div role="alert"><p>Permanently give up this item and its socketed gems? This cannot be undone and gives no additional gold.</p><button class="btn danger" disabled={busy||!near||unsupported||!!stale||!!offer.item.protected} onClick={()=>void trade('release')}>Permanently release {offer.item.name}</button></div>}
      <div class="merchant-preview"><ItemTooltip item={offer.item} compare={tab==='buy'}/></div>
    </>:<p>{offers.length?'Choose an item to review its exact offer.':tab==='sell'?'Your inventory contains no gear to sell.':'No items are waiting in buyback.'}</p>}</div></div>
  </PanelFrame>;
}
