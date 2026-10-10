import { introduced, validIntro } from '@shared/onboarding';
import { useState } from 'preact/hooks';
import { QUESTS } from '@shared/data/quests';
import { questText as t } from '@shared/data/questMessages';
import { DIALOGUES } from '@shared/data/dialogues';
import { CHAPTERS, LORE } from '@shared/data/story';
import { ADVENTURES } from '@shared/adventure';
import town from '@shared/data/town/hearthmere.json';
import { ZONES } from '@shared/data/zones';
import { loreAvailable, questAvailable, questCompleted, questContact, questMarker, questObjective, questState, questStatus, questStepText, questUnlocks, storyFlag, trackedQuest, validQuestState, type QuestStatus } from '@shared/quests';
import type { CharacterSave } from '@shared/types';
import type { QuestDef } from '@shared/questTypes';
import { questRequest } from '@shared/questRequests';
import { togglePanel, ui, useUI, worldReader } from '../store';
import { PanelFrame, SecHead, Tabs, Paged } from './common';
import { ItemTooltip } from './tooltip';
import { run } from './util';
import { QuestDelivery } from './questDelivery';
import { Bestiary } from './bestiary';
import { MERCHANTS } from '@shared/merchant';

export function openJournal() {
  ui.set({adventureTarget:null,adventureZone:null,journalQuest:null});
  togglePanel('adventure',true);
}

export function AdventurePanel() {
  const save=useUI(s=>s.char),selected=useUI(s=>s.journalQuest);
  const [view,setView]=useState<'quests'|'lore'|'bestiary'>('quests'),[filter,setFilter]=useState<QuestStatus|'all'>('all'),[search,setSearch]=useState('');
  if(!save)return null;
  const entries=QUESTS.filter(q=>(!q.tutorial||validIntro(save.onboarding))&&(filter==='all'||questStatus(save,q)===filter)&&t(q.title).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const q=entries.find(q=>q.id===selected)??entries.find(q=>q.id===trackedQuest(save)?.id)??entries[0];
  const readings=LORE.filter(l=>loreAvailable(save,l));
  return <PanelFrame id="adventure" title={t('quest.journal.title')} sub={t('quest.journal.subtitle')} width={1040}>
    <Tabs tabs={[{id:'quests',label:t('quest.journal.all')},{id:'lore',label:t('quest.journal.lore'),badge:readings.length},{id:'bestiary',label:'Bestiary'}]} value={view} onChange={setView}/>
    <FieldEventInteraction/>
    <MerchantInteraction/>
    {view==='bestiary'?<Bestiary save={save}/>:view==='lore'?<>
      {!readings.length&&<p>{t('quest.journal.loreEmpty')}</p>}
      <Paged size={1} label="Lore pages">{readings.map(l=><details class="quest-reading" key={l.id} open><summary>{t(l.title)}</summary><p>{t(l.text)}</p></details>)}</Paged>
    </>:<>
      <div class="quest-filters">
        <label>{t('quest.journal.search')}<input type="search" value={search} onInput={e=>setSearch(e.currentTarget.value)}/></label>
        <label>{t('quest.journal.progress')}<select value={filter} onChange={e=>setFilter(e.currentTarget.value as QuestStatus|'all')}>
          {(['all','active','available','complete','locked','unavailable'] as const).map(f=><option value={f} key={f}>{t(f==='all'?'quest.journal.all':f==='unavailable'?'quest.journal.retained':('quest.journal.'+f) as Parameters<typeof t>[0])}</option>)}
        </select></label>
      </div>
      <div class="journal-columns"><nav class="quest-list" aria-label={t('quest.journal.all')}><Paged key={filter+search} size={6} label="Quest pages">
        {entries.map(entry=><button key={entry.id} class={'btn '+(entry.id===q?.id?'primary':'')} aria-pressed={entry.id===q?.id} onClick={()=>ui.set({journalQuest:entry.id})}>
          <strong>{t(entry.title)}</strong><small>{t(('quest.journal.'+questStatus(save,entry)) as Parameters<typeof t>[0])}</small>
        </button>)}
      </Paged></nav>
      <div class="journal-detail">{q?<QuestDetails key={q.id} save={save} q={q}/>:<p role="status">{t('quest.journal.empty')}</p>}</div></div>
    </>}
  </PanelFrame>;
}

function MerchantInteraction(){
  const target=useUI(s=>s.adventureTarget),zone=useUI(s=>s.zone),interact=useUI(s=>s.interact);
  const def=MERCHANTS.find(m=>m.zone===zone?.zone&&m.target===target),npc=def&&ADVENTURES[def.zone]?.npcs.find(n=>n.id===def.target);
  return npc&&interact?.name===npc.name?<button class="btn" onClick={()=>togglePanel('merchant',true)}>Trade gear with {def!.name}</button>:null;
}

function FieldEventInteraction(){
  const zone=useUI(s=>s.zone),target=useUI(s=>s.adventureTarget),interact=useUI(s=>s.interact),states=useUI(s=>s.fieldEvents);
  const [busy,setBusy]=useState(false);
  const data=zone&&ADVENTURES[zone.zone],event=data?.events?.find(e=>e.trigger===target),npc=data?.npcs.find(n=>n.id===target);
  if(!event||interact?.name!==npc?.name)return null;
  const state=states.find(s=>s.id===event.id);
  return <div class="quest-dialogue"><SecHead>{event.name}</SecHead>
    <p>{state?.phase==='active'?`Encounter active · ${state.remaining} remaining`:state?.phase==='recovering'?'The overlook is settling. Leave the area before another alarm.':'Optional encounter: raise the alarm to draw out the creatures at the overlook.'}</p>
    <button class="btn" disabled={busy||state?.joined||state?.phase==='recovering'} onClick={async()=>{setBusy(true);try{await run('quest',{action:'activateField',target:event.trigger});}finally{setBusy(false);}}}>{state?.joined?'Joined':state?.phase==='active'?'Join the alarm':'Raise the alarm'}</button>
  </div>;
}

function Conversation({save,zone,target,name}:{save:CharacterSave;zone:string;target:string;name:string}) {
  const [nodeId,setNodeId]=useState('');
  const conversation=DIALOGUES[zone+'/'+target];
  if(!conversation)return null;
  const node=conversation.nodes[nodeId]??conversation.nodes[conversation.start];
  return <div class="quest-dialogue"><SecHead>{name}</SecHead><p>{t(node.text)}</p>
    {node.choices.filter(c=>(c.when??[]).every(f=>storyFlag(save,f))).map((c,i)=><button key={i} class="btn" onClick={()=>setNodeId(c.to)}>{t(c.label)}</button>)}
  </div>;
}

function QuestDetails({save,q}:{save:CharacterSave;q:QuestDef}) {
  const selectedTarget=useUI(s=>s.adventureTarget),selectedZone=useUI(s=>s.adventureZone);
  const zone=useUI(s=>s.zone),interact=useUI(s=>s.interact),[busy,setBusy]=useState(false);
  const contactZone=selectedZone??zone?.zone;
  const target=selectedTarget??worldReader.current?.map()?.npcs.find(n=>n.name===interact?.name)?.id;
  const npc=contactZone===town.id?town.npcs.find(n=>n.id===target):contactZone&&ADVENTURES[contactZone]?.npcs.find(n=>n.id===target);
  const present=!!npc&&zone?.zone===contactZone&&interact?.name===npc.name;
  const state=questState(save,q.id),available=questAvailable(save,q),valid=!state||validQuestState(q,state);
  const objective=questObjective(save,q),step=state&&q.steps[state.step],ready=state?.step===q.steps.length&&!state.claimed;
  const atStart=present&&contactZone===q.start.zone&&target===q.start.target;
  const atFinish=present&&contactZone===q.finish.zone&&target===q.finish.target;
  const atStep=present&&!!step&&step.zone===contactZone&&step.target===target;
  const chapter=CHAPTERS.find(c=>c.id===q.chapter),chapterQuests=QUESTS.filter(other=>other.chapter===q.chapter);
  const completed=chapterQuests.filter(other=>questCompleted(save,other.id)).length;
  const act=async(action:string)=>{setBusy(true);try{await run('quest',questRequest(q,state,target,action));}finally{setBusy(false);}};
  const [section,setSection]=useState<'story'|'objectives'|'reward'|'rules'>('story');
  const reward=typeof q.reward==='object'?q.reward:undefined;
  return <>
    {chapter&&<div class="quest-chapter"><SecHead>{t(chapter.act)} · {t(chapter.title)}</SecHead>
      <p class="pn-note">{completed===chapterQuests.length?t('quest.journal.chapterComplete'):t('quest.journal.chapter')}: {completed}/{chapterQuests.length}</p>
    </div>}
    <SecHead>{t(q.title)}</SecHead>
    {!valid?<p>{t('quest.journal.unavailable')}</p>:<>
      <Tabs tabs={[{id:'story',label:'Story'},{id:'objectives',label:t('quest.journal.progress')},{id:'reward',label:t('quest.journal.reward')},{id:'rules',label:t('quest.journal.rules')}]} value={section} onChange={setSection}/>
      {section==='story'&&<>
        <p>{t(state?.claimed?q.complete:q.offer)}</p>
        {!available&&<p class="pn-note">{t('quest.journal.requires')} {q.requires.map(id=>QUESTS.find(other=>other.id===id)).filter(Boolean).map(other=>t(other!.title)).join(' · ')}</p>}
        {present&&npc&&contactZone&&target&&<Conversation key={contactZone+'/'+target} save={save} zone={contactZone} target={target} name={npc.name}/>}
        {!!(state?.completions??(state?.claimed?1:0))&&<p class="pn-note">{t('quest.journal.history')}: {state?.completions??1}</p>}
      </>}
      {section==='objectives'&&<>
        <Paged size={4} label="Objective pages" class="quest-steps">{q.steps.map((s,i)=><div key={s.id} role="listitem" class={state&&i<state.step?'complete':state&&i===state.step?'current':''}>
          <span aria-label={t(state&&i<state.step?'quest.journal.complete':'quest.journal.active')}>{state&&i<state.step?'✓':'○'}</span> {questStepText(s,state&&i<state.step?s.count??1:state&&i===state.step?state.progress??0:0)}
        </div>)}<div role="listitem" class={state?.claimed?'complete':ready?'current':''}><span>{state?.claimed?'✓':'○'}</span> {t('quest.journal.return')}: {questContact(q.finish)}</div></Paged>
        {atStep&&step?.kind==='deliver'&&<QuestDelivery key={q.id+':'+state?.cycle+':'+step.id} save={save} step={step} onDeliver={async itemIds=>(await run('quest',{...questRequest(q,state,target,'deliver'),itemIds})).ok}/>}
      </>}
      {section==='reward'&&<>
        <SecHead>{t(state?.reward&&!state.claimed?'quest.journal.reserved':'quest.journal.reward')}</SecHead>
        {state?.reward&&!state.claimed?<ItemTooltip item={state.reward}/>:<p class="pn-note">{t(q.rewardText)}</p>}
        {!!reward?.xp&&<p>{t('quest.journal.xp')}: {reward.xp.toLocaleString()}</p>}
        {!!reward?.gold&&<p>{t('quest.journal.gold')}: {reward.gold.toLocaleString()}</p>}
        {questUnlocks(q).map(id=><p key={id}>{t('quest.journal.unlock')}: {ZONES[id]?.name??id}</p>)}
      </>}
      {section==='rules'&&<>
        <p>{t(q.repeat?'quest.journal.repeatRule':'quest.journal.once')}</p><p>{t('quest.journal.sharing')}</p>
        {q.steps.some(s=>s.credit==='killer')&&<p>{t('quest.journal.killer')}</p>}
        {q.steps.some(s=>s.kind==='collect')&&<p>{t('quest.journal.collection')}</p>}
      </>}
      {available&&<div class="quest-actions">
        {(!state||state.claimed&&q.repeat)&&atStart&&<button class="btn primary" disabled={busy} onClick={()=>void act('accept')}>{t(state?'quest.journal.repeat':'quest.journal.accept')}</button>}
        {!state?.claimed&&<>
          <p class="pn-note">{objective.text} · {ZONES[objective.zone]?.name??objective.zone}</p>
          {atStep&&step?.kind==='interact'&&<button class="btn primary" disabled={busy} onClick={()=>void act('inspect')}>{t('quest.journal.inspect')}</button>}
          {atStep&&step?.kind==='talk'&&<button class="btn primary" disabled={busy} onClick={()=>void act('objectiveTalk')}>{t('quest.journal.talk')}</button>}
          {atStep&&step?.kind==='deliver'&&section!=='objectives'&&<button class="btn" onClick={()=>setSection('objectives')}>{t('quest.delivery.title')}</button>}
          {ready&&atFinish&&<button class="btn primary" disabled={busy} onClick={()=>void act('claim')}>{t('quest.journal.claim')}</button>}
          {!atStart&&!atFinish&&!atStep&&<p class="pn-note">{t('quest.journal.contact')}</p>}
          <button class="btn" disabled={busy} onClick={()=>void act(trackedQuest(save)?.id===q.id?'untrack':'track')}>{trackedQuest(save)?.id===q.id?'Untrack':t('quest.journal.track')}</button>
        </>}
      </div>}
    </>}
  </>;
}

export function AdventureTracker() {
  const save=useUI(s=>s.char),zone=useUI(s=>s.zone),dungeon=useUI(s=>s.dungeon);
  const lastRun=useUI(s=>s.lastRun);
  if(!save)return null;
  const q=trackedQuest(save),objective=q&&questObjective(save,q);
  return <div class="quest-hud interactive">
    <button class="btn" onClick={openJournal}>{t('quest.journal.title')}</button>
    {lastRun&&<button class="btn" onClick={()=>togglePanel('runSummary',true)}>{t('run.summary.open')}</button>}
    {dungeon&&<div class="frame adventure-tracker" title={t('quest.pump.replay')}>
      <strong>{zone?.name}</strong>
      <span>{dungeon.phase==='done'?t(ADVENTURES[zone!.zone]?.dungeon?.endTarget?'mid.dungeon.done':'quest.pump.done'):ADVENTURES[zone!.zone]?.interactions.find(i=>i.id===dungeon.target)?.name}</span>
      {dungeon.phase!=='done'&&<small>{dungeon.phase==='active'?`${t('quest.pump.active')} · ${dungeon.remaining}`:t('quest.pump.ready')}</small>}
    </div>}
    {q&&objective&&<button class="frame adventure-tracker" onClick={()=>{openJournal();ui.set({journalQuest:q.id});}} title={t('quest.journal.open')}>
      <strong>{t(q.title)}</strong><span>{objective.text}</span>
      {zone?.zone!==objective.zone&&<small>{ZONES[objective.zone]?.name??objective.zone}</small>}
    </button>}
    {q&&<button class="btn sm" onClick={()=>void run('quest',questRequest(q,questState(save,q.id),undefined,'untrack'))}>Untrack quest</button>}
    {!q&&<small>No quest tracked. Choose Track in your journal.</small>}
  </div>;
}
