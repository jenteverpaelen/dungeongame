import { useState } from 'preact/hooks';
import { BUYBACK_CAPACITY, MERCHANTS, salePrice, validMerchant } from '@shared/merchant';
import { ADVENTURES } from '@shared/adventure';
import { useUI } from '../store';
import { PanelFrame, Paged, SecHead, Tabs } from './common';
import { ItemTooltip, ItemVisual } from './tooltip';
import { run } from './util';

export function MerchantPanel(){
  const save=useUI(s=>s.char),zone=useUI(s=>s.zone),interact=useUI(s=>s.interact);
  const [tab,setTab]=useState<'sell'|'buyback'>('sell'),[selected,setSelected]=useState(''),[release,setRelease]=useState(false),[busy,setBusy]=useState(false);
  if(!save)return null;
  const def=MERCHANTS.find(m=>m.zone===zone?.zone),npc=def&&ADVENTURES[def.zone]?.npcs.find(n=>n.id===def.target);
  const near=!!npc&&interact?.name===npc.name,state=validMerchant(save.merchant)?save.merchant:undefined;
  const offers=tab==='sell'?save.inventory.flatMap(item=>item?[{item,price:salePrice(item)}]:[]):state?.items??[];
  const offer=offers.find(e=>e.item.id===selected),unsupported=!!save.merchant&&!state;
  const trade=async(action:'sell'|'buyback'|'release')=>{
    if(!offer||!def)return;setBusy(true);
    try{const result=await run('merchant',{merchant:def.id,action,itemId:offer.item.id,sequence:state?.sequence??0,price:offer.price,...(action==='release'?{confirm:offer.item.id}:{})});if(result.ok){setSelected('');setRelease(false);}}finally{setBusy(false);}
  };
  return <PanelFrame id="merchant" title="Orren’s Gear Exchange" sub="Rillwake camp" width={1040}>
    <Tabs tabs={[{id:'sell',label:'Sell gear'},{id:'buyback',label:'Buyback',badge:state?.items.length??0}]} value={tab} onChange={v=>{setTab(v);setSelected('');setRelease(false);}}/>
    <p class="pn-note">Gold: {save.gold.toLocaleString()} · Retained items: {state?.items.length??0}/{BUYBACK_CAPACITY}. Buyback costs exactly what you received. Items stay until you reclaim or release them.</p>
    {!near&&<p role="status">Stand beside Orren at the camp to trade.</p>}
    {unsupported&&<p role="status">Your retained records use an unsupported format. They remain unchanged.</p>}
    <div class="journal-columns"><nav class="quest-list" aria-label={tab==='sell'?'Inventory offers':'Retained items'}><Paged key={tab} size={6} label="Gear pages">
      {offers.map(e=><button key={e.item.id} class={'btn '+(selected===e.item.id?'primary':'')} aria-pressed={selected===e.item.id} onClick={()=>{setSelected(e.item.id);setRelease(false);}}>
        <ItemVisual item={e.item} size={24}/><strong>{e.item.name}</strong><small>{e.item.protected?'Protected':`${e.price??'Unavailable'} gold`}</small>
      </button>)}
    </Paged></nav><div class="journal-detail">{offer?<>
      <SecHead>{tab==='sell'?'Review your sale':'Recover your gear'}</SecHead>
      <p class="pn-note">Socketed gems stay with the item. Crafting and rare properties do not increase this offer.</p>
      <button class="btn primary" disabled={busy||!near||unsupported||offer.price===null||(tab==='sell'&&!!offer.item.protected)} onClick={()=>void trade(tab)}>{tab==='sell'?'Sell':'Reclaim'} for {offer.price} gold</button>
      {tab==='buyback'&&<button class="btn" disabled={busy||!near||unsupported||!!offer.item.protected} onClick={()=>setRelease(!release)}>Release from buyback…</button>}
      {release&&<div role="alert"><p>Permanently give up this item and its socketed gems? This cannot be undone and gives no additional gold.</p><button class="btn danger" disabled={busy||!near||unsupported||!!offer.item.protected} onClick={()=>void trade('release')}>Permanently release {offer.item.name}</button></div>}
      <div class="merchant-preview"><ItemTooltip item={offer.item}/></div>
    </>:<p>{offers.length?'Choose an item to review its exact offer.':tab==='sell'?'Your inventory contains no gear to sell.':'No items are waiting in buyback.'}</p>}</div></div>
  </PanelFrame>;
}
