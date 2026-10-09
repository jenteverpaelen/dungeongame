import { introLesson } from '@shared/onboarding';
import { IntroductionCard } from './Introduction';
import { useEffect, useState } from 'preact/hooks';
import { guidance, eligibleHints, HINT_IDS, type HintId } from '../../game/guidance';
import { bindings } from '../../game/bindings';
import { preferences } from '../../game/preferences';
import { text } from '../../i18n/messages';
import { togglePanel, useUI } from '../store';
import { useLocal } from '../panels/state';
import { openJournal } from '../panels/adventure';

const action:Partial<Record<HintId,'inventory'|'skills'|'journal'|'map'>>={gear:'inventory',bag:'inventory',reward:'inventory',death:'inventory',points:'skills',quest:'journal',services:'map',loot:'inventory',level:'skills',rune:'skills',legendary:'inventory',cube:'map',rift:'map'};
function HintText({id}:{id:HintId}) {
  useLocal(bindings,s=>s);
  const params:Record<string,string>={};
  // Only interpolate parameters declared by this hint; the message formatter is strict.
  const keys:Record<HintId,('dash'|'map'|'inventory'|'skills'|'interact'|'journal')[]>={steer:['dash','map'],gear:['inventory'],points:['skills'],bag:[],death:['dash'],quest:['interact','journal'],reward:['inventory'],services:['interact'],loot:['inventory'],level:['skills'],rune:['skills'],elite:['dash'],legendary:['inventory'],cube:['interact'],rift:['interact']};
  for(const key of keys[id])params[key]=bindings.label(key);
  return <p>{text(`guide.${id}.body`,params)}</p>;
}
function openAction(id:HintId) {
  const a=action[id];if(!a)return;
  togglePanel('help',false);
  if(a==='journal')openJournal();else togglePanel(a==='map'?'worldmap':a,true);
}
function HintAction({id,onOpen}:{id:HintId;onOpen?:()=>void}) {
  const a=action[id];return a?<button class="btn" onClick={()=>{onOpen?.();openAction(id);}}>{text(`guide.${a}`)}</button>:null;
}

export function ContextualGuidance() {
  const save=useUI(s=>s.char),zone=useUI(s=>s.zone),panels=useUI(s=>s.panels),dead=useUI(s=>s.me?.dead),afk=useUI(s=>s.afk),interact=useUI(s=>s.interact);
  const elite=useUI(s=>!!s.target&&s.target.elite>0);
  const state=useLocal(guidance,s=>s),enabled=useLocal(preferences,s=>s.values.contextualHints);
  useEffect(()=>{if(save)guidance.ensure(save);},[save?.id]);
  const progress=save&&state.characters[save.id];
  if(!save||!zone||dead||afk||Object.values(panels).some(Boolean))return null;
  if(!enabled||!progress?.automatic)return introLesson(save)?<IntroductionCard/>:null;
  const id=eligibleHints(save,zone.zone,interact?.role,elite).find(h=>!progress.dismissed.includes(h));
  if(introLesson(save)&&id!=='bag'&&id!=='death'&&id!=='elite')return <IntroductionCard/>;
  if(!id)return null;
  const dismiss=()=>guidance.dismiss(save.id,id);
  return <aside class="guide-toast frame interactive" aria-label={text('guide.title')}>
    <div role="status"><h3>{text(`guide.${id}.title`)}</h3><HintText id={id}/></div>
    <div class="guide-actions"><HintAction id={id} onOpen={dismiss}/><button class="btn" onClick={dismiss}>{text('guide.dismiss')}</button></div>
    <button class="guide-disable" onClick={()=>guidance.enable(save.id,false)}>{text('guide.disable')}</button>
  </aside>;
}

export function GuidanceLibrary() {
  const [selected,setSelected]=useState<HintId>('steer');
  const save=useUI(s=>s.char),state=useLocal(guidance,s=>s),enabled=useLocal(preferences,s=>s.values.contextualHints);
  if(!save)return null;
  const progress=state.characters[save.id];
  return <div class="guide-library">
    <label class="settings-check"><input type="checkbox" checked={enabled} onChange={e=>preferences.set({contextualHints:e.currentTarget.checked})}/><span>{text('guide.show')}</span></label>
    <label class="settings-check"><input type="checkbox" checked={progress?.automatic??false} onChange={e=>guidance.enable(save.id,e.currentTarget.checked)}/><span>{text('guide.character')}</span></label>
    <p class="help-note">{text(state.retained?'guide.local':'guide.session')}</p>
    <div class="help-reader"><nav class="help-index guide-index" aria-label={text('guide.title')}>
      {HINT_IDS.map(id=><button class={'btn '+(id===selected?'primary':'')} key={id} aria-pressed={id===selected} onClick={()=>setSelected(id)}>{text(`guide.${id}.title`)}</button>)}
    </nav><section class="guide-entry help-article">
      <h3>{text(`guide.${selected}.title`)}</h3><HintText id={selected}/><HintAction id={selected}/>
      <label class="settings-check"><input type="checkbox" checked={!progress?.dismissed.includes(selected)} onChange={e=>guidance.dismiss(save.id,selected,!e.currentTarget.checked)}/><span>{text('guide.automatic')}</span></label>
    </section></div>
  </div>;
}
