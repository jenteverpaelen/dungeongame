import { Paged } from '../panels/common';
import { useState } from 'preact/hooks';
import { INTRO_EVENTS, INTRO_LESSONS, introLesson, validIntro, type IntroLesson } from '@shared/onboarding';
import { bindings } from '../../game/bindings';
import { funnel } from '../../game/funnel';
import { text } from '../../i18n/messages';
import { ONBOARDING_MESSAGES } from '../../i18n/onboardingMessages';
import { formatMessage } from '../../i18n/messages';
import { togglePanel,ui,useUI } from '../store';
import { run } from '../panels/util';
import { useLocal } from '../panels/state';
import { openJournal } from '../panels/adventure';

function LessonText({id}:{id:IntroLesson}) {
  useLocal(bindings,s=>s);
  const template=ONBOARDING_MESSAGES[`intro.${id}.body`];
  const values:Record<string,string>={};
  for(const [,key] of template.matchAll(/\{(\w+)\}/g))values[key]=key==='move'?[bindings.label('up'),bindings.label('left'),bindings.label('down'),bindings.label('right')].join(' / '):bindings.label(key as 'dash');
  return <p>{formatMessage(template,values)}</p>;
}
export function openIntroduction(){ui.set({helpTab:'intro'});togglePanel('help',true);}
export function IntroductionCard() {
  const save=useUI(s=>s.char);const id=save&&introLesson(save);
  if(!id)return null;
  return <aside class="guide-toast frame interactive" aria-label={text('intro.title')}>
    <div role="status"><h3>{text(`intro.${id}.title`)}</h3><LessonText id={id}/></div>
    <div class="guide-actions">
      {(id==='equip'||id==='skill')&&<button class="btn" onClick={()=>togglePanel(id==='equip'?'inventory':'skills',true)}>{text(id==='equip'?'guide.inventory':'guide.skills')}</button>}
      {(id==='talk'||id==='kill'||id==='claim'||id==='elite')&&<button class="btn" onClick={openJournal}>{text('guide.journal')}</button>}
      <button class="btn" onClick={openIntroduction}>{text('intro.help')}</button>
    </div>
    <button class="guide-disable" onClick={()=>void run('onboarding',{action:'skip'})}>{text('intro.skip')}</button>
  </aside>;
}
export function IntroductionLibrary() {
  const save=useUI(s=>s.char);const [busy,setBusy]=useState(false);const [selected,setSelected]=useState<IntroLesson|null>(null);
  if(!save)return null;
  const state=save.onboarding,valid=validIntro(state),current=introLesson(save),lesson=selected??current??INTRO_LESSONS[0];
  const act=async(action:string,lesson?:IntroLesson)=>{setBusy(true);try{await run('onboarding',{action,...(lesson?{lesson}:{})});}finally{setBusy(false);}};
  return <div class="guide-library">
    <p>{text('intro.optional')}</p>
    {state&&!valid?<p>{text('intro.retained')}</p>:<>
      {(!state||state.status==='skipped')&&<button class="btn" disabled={busy} onClick={()=>void act('start')}>{text(state?'intro.resume':'intro.start')}</button>}
      {state?.status==='active'&&<button class="btn" disabled={busy} onClick={()=>void act('skip')}>{text('intro.skip')}</button>}
      {state?.status==='skipped'&&<p>{text('intro.skipped')}</p>}
      {state?.status==='complete'&&<p role="status">{text('intro.complete')}</p>}
      <div class="help-reader">
        <nav class="help-index" aria-label={text('intro.title')}>
          {INTRO_LESSONS.map(id=><button key={id} class={'btn '+(id===lesson?'primary':'')} aria-pressed={id===lesson} onClick={()=>setSelected(id)}>
            {text(`intro.${id}.title`)}<small>{state?.done.includes(id)?text('intro.accomplished'):state?.skipped.includes(id)?text('intro.omitted'):id===current?text('intro.next'):''}</small>
          </button>)}
        </nav>
        <section class="guide-entry help-article"><h3>{text(`intro.${lesson}.title`)}</h3><LessonText id={lesson}/>
          {lesson===current&&<button class="btn" disabled={busy} onClick={()=>void act('skipLesson',lesson)}>{text('intro.skipLesson')}</button>}
        </section>
      </div>
    </>}
  </div>;
}
const FAQ=['combat','loot','points','services','death','map','save','skip'] as const;
export function HelpQuestions(){
  const [search,setSearch]=useState(''),[selected,setSelected]=useState<string>('combat');
  const entries=FAQ.filter(id=>(text(`intro.faq.${id}.title`)+text(`intro.faq.${id}.body`)).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const active=entries.find(id=>id===selected)??entries[0];
  return <div class="guide-library"><label>{text('intro.faq.search')}<input type="search" value={search} onInput={e=>setSearch(e.currentTarget.value)}/></label>
    {!entries.length&&<p role="status">{text('intro.faq.empty')}</p>}
    <div class="help-reader"><nav class="help-index" aria-label={text('intro.faq')}>{entries.map(id=><button class={'btn '+(id===active?'primary':'')} key={id} aria-pressed={id===active} onClick={()=>setSelected(id)}>{text(`intro.faq.${id}.title`)}</button>)}</nav>
    {active&&<section class="guide-entry help-article"><h3>{text(`intro.faq.${active}.title`)}</h3><p>{text(`intro.faq.${active}.body`)}</p></section>}</div>
  </div>;
}
export function PlaytestTimings(){
  const save=useUI(s=>s.char),state=useLocal(funnel,s=>s),[kind,setKind]=useState<'human'|'scripted'>('human');
  const exportRecords=()=>{const url=URL.createObjectURL(new Blob([funnel.export()],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='hearthfall-playtest.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <div class="guide-library"><p>{text('intro.timings.consent')}</p><p class="help-note">{text('intro.timings.note')}</p>
    {!state.retained&&<p role="status">{text('intro.timings.storage')}</p>}
    <label>{text('intro.timings.kind')}<select disabled={state.active} value={kind} onChange={e=>setKind(e.currentTarget.value as typeof kind)}><option value="human">{text('intro.timings.human')}</option><option value="scripted">{text('intro.timings.scripted')}</option></select></label>
    <div class="guide-actions">{state.active?<button class="btn" onClick={()=>funnel.stop()}>{text('intro.timings.stop')}</button>:<button class="btn" disabled={!save} onClick={()=>save&&funnel.start(kind,save,performance.now())}>{text('intro.timings.start')}</button>}
      <button class="btn" disabled={!state.records.length} onClick={exportRecords}>{text('intro.timings.export')}</button>
      <button class="btn" disabled={!state.records.length} onClick={()=>funnel.clear()}>{text('intro.timings.clear')}</button></div>
    {state.active&&<p role="status">{text('intro.timings.active')}</p>}
    {!state.records.length&&<p>{text('intro.timings.empty')}</p>}
    <Paged size={1} label="Observations">{[...state.records].reverse().map((r,i)=><details class="guide-entry" key={state.records.length-i} open={i===0}><summary>{state.records.length-i} · {r.classId} · {text(r.kind==='human'?'intro.timings.human':'intro.timings.scripted')}</summary><table class="intro-timings"><thead><tr><th>{text('intro.timings.event')}</th><th>{text('intro.timings.time')}</th></tr></thead><tbody>{INTRO_EVENTS.map(event=><tr key={event}><td>{text(`intro.event.${event}`)}</td><td>{r.first[event]===undefined?text('intro.timings.missing'):`${(r.first[event]!/1000).toFixed(1)} s`}</td></tr>)}</tbody></table></details>)}</Paged>
  </div>;
}
