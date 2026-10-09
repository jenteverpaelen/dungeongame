import { useState } from 'preact/hooks';
import type { CharacterSave } from '@shared/types';
import type { QuestStep } from '@shared/questTypes';
import { deliveryItemReason, planQuestDelivery } from '@shared/questDelivery';
import { questText as t } from '@shared/data/questMessages';
import { BASES } from '@shared/data/items';
import { RARITY_LABEL } from '@shared/items';
import { SecHead } from './common';
import { ItemTooltip } from './tooltip';

/** Explicit selection and review; no automatic choice of a player's gear. */
export function QuestDelivery({save,step,onDeliver}: {
  save:CharacterSave; step:QuestStep; onDeliver:(ids:string[])=>Promise<boolean>;
}) {
  const [ids,setIds]=useState<string[]>([]),[review,setReview]=useState<string|null>(null),[busy,setBusy]=useState(false);
  const need=step.count??1,items=save.inventory.filter(item=>item&&ids.includes(item.id));
  const candidates=save.inventory.filter(item=>item&&item.base===step.itemBase&&item.rarity===step.itemRarity);
  const plan=planQuestDelivery(save,step,ids),signature=JSON.stringify(items);
  const changed=review!==null&&review!==signature;
  const deliver=async()=>{setBusy(true);try{if(await onDeliver(ids)){setIds([]);setReview(null);}}finally{setBusy(false);}};
  return <div class="quest-dialogue">
    <SecHead>{t('quest.delivery.title')}</SecHead>
    <p>{need} × {step.itemRarity&&RARITY_LABEL[step.itemRarity]} {BASES[step.itemBase??'']?.noun} · {ids.length}/{need} {t('quest.delivery.selected')}</p>
    <p class="pn-note">{t('quest.delivery.scope')}</p>
    {review===null?<>
      <div class="quest-list" aria-label={t('quest.delivery.items')}>
        {candidates.map(item=>item&&<button key={item.id} class={`btn ${ids.includes(item.id)?'primary':''}`} aria-pressed={ids.includes(item.id)}
          disabled={busy||!!deliveryItemReason(item,step)||(!ids.includes(item.id)&&ids.length>=need)} title={deliveryItemReason(item,step)??item.name}
          onClick={()=>setIds(ids.includes(item.id)?ids.filter(id=>id!==item.id):[...ids,item.id])}>
          <strong>{item.name}</strong><small>{item.protected?t('quest.delivery.protected'):`${t('quest.delivery.level')} ${item.ilvl}`}</small>
        </button>)}
      </div>
      {!candidates.length&&<p class="pn-note">{t('quest.delivery.empty')}</p>}
      <button class="btn primary" disabled={busy||!!plan.error} onClick={()=>setReview(signature)}>{t('quest.delivery.review')}</button>
    </>:<>
      <p>{t('quest.delivery.warning')}</p>
      {items.map(item=>item&&<ItemTooltip key={item.id} item={item}/>)}
      {(plan.error||changed)&&<p role="alert">{plan.error??t('quest.delivery.changed')}</p>}
      <button class="btn" disabled={busy} onClick={()=>setReview(null)}>{t('quest.delivery.back')}</button>
      <button class="btn primary" disabled={busy||!!plan.error||changed} onClick={()=>void deliver()}>{t('quest.delivery.confirm')}</button>
    </>}
  </div>;
}
