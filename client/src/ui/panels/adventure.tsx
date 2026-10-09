import { useState } from 'preact/hooks';
import { QUESTS } from '@shared/data/quests';
import { questText as t } from '@shared/data/questMessages';
import { DIALOGUES } from '@shared/data/dialogues';
import { ADVENTURES } from '@shared/adventure';
import { ZONES } from '@shared/data/zones';
import { questAvailable, questCompleted, questObjective, questState, questStepText, trackedQuest, validQuestState } from '@shared/quests';
import { togglePanel, ui, useUI } from '../store';
import { PanelFrame, SecHead } from './common';
import { ItemTooltip } from './tooltip';
import { run } from './util';

export function openJournal() {
  ui.set({adventureTarget:null,adventureZone:null,journalQuest:null});
  togglePanel('adventure',true);
}

export function AdventurePanel() {
  const save=useUI(s=>s.char),target=useUI(s=>s.adventureTarget),contactZone=useUI(s=>s.adventureZone);
  const selected=useUI(s=>s.journalQuest),zone=useUI(s=>s.zone),interact=useUI(s=>s.interact);
  const [busy,setBusy]=useState(false),[dialogue,setDialogue]=useState('');
  if(!save)return null;
  const q=QUESTS.find(q=>q.id===selected)??trackedQuest(save)??QUESTS[0];
  const state=questState(save,q.id),available=questAvailable(save,q),valid=!state||validQuestState(q,state);
  const objective=questObjective(save,q),step=state&&q.steps[state.step];
  const npc=contactZone&&ADVENTURES[contactZone]?.npcs.find(n=>n.id===target);
  const present=!!npc && zone?.zone===contactZone && interact?.name===npc.name;
  const conversation=DIALOGUES[`${contactZone}/${target}`];
  const node=conversation?.nodes[dialogue]??conversation?.nodes[conversation.start];
  const atStart=present&&contactZone===q.start.zone&&target===q.start.target;
  const atFinish=present&&contactZone===q.finish.zone&&target===q.finish.target;
  const atStep=present&&step?.kind==='interact'&&step.zone===contactZone&&step.target===target;
  const ready=state?.step===q.steps.length&&!state.claimed;
  const act=async(action:string)=>{setBusy(true);try{await run('quest',{action,target,quest:q.id});}finally{setBusy(false);}};
  return <PanelFrame id="adventure" title={t('quest.journal.title')} sub={t('quest.journal.subtitle')} width={530}>
    <nav class="quest-list" aria-label="Adventures">
      {QUESTS.map(entry=>{
        const s=questState(save,entry.id),completed=questCompleted(save,entry.id),offered=questAvailable(save,entry);
        return <button key={entry.id} class={`btn ${entry.id===q.id?'primary':''}`} aria-pressed={entry.id===q.id} onClick={()=>ui.set({journalQuest:entry.id})}>
          <strong>{t(entry.title)}</strong><small>{t(completed?'quest.journal.complete':s?'quest.journal.active':offered?'quest.journal.available':'quest.journal.locked')}</small>
        </button>;
      })}
    </nav>
    <SecHead>{t(q.title)}</SecHead>
    {!valid?<p>{t('quest.journal.unavailable')}</p>:<>
      <p>{t(state?.claimed?q.complete:q.offer)}</p>
      {!available&&<p class="pn-note">{t('quest.journal.requires')}</p>}
      {present && <div class="quest-dialogue">
        <SecHead>{npc.name}</SecHead>
        <p>{t(node?.text??q.offer)}</p>
        {node?.choices.map(choice=><button key={choice.to} class="btn" onClick={()=>setDialogue(choice.to)}>{t(choice.label)}</button>)}
      </div>}
      <SecHead>{t('quest.journal.progress')}</SecHead>
      <ol class="quest-steps">{q.steps.map((s,i)=><li key={s.id} class={state&&i<state.step?'complete':state&&i===state.step?'current':''}>
        <span aria-label={state&&i<state.step?'Completed':'Pending'}>{state&&i<state.step?'✓':'○'}</span> {questStepText(s,state&&i<state.step?s.count??1:state&&i===state.step?state.progress??0:0)}
      </li>)}<li class={state?.claimed?'complete':ready?'current':''}><span>{state?.claimed?'✓':'○'}</span> {t('quest.journal.return')}</li></ol>
      {!state?.claimed&&available&&<>
        <p class="pn-note">{objective.text} · {ZONES[objective.zone]?.name??objective.zone}</p>
        {!state&&atStart&&<button class="btn primary" disabled={busy} onClick={()=>void act('accept')}>{t('quest.journal.accept')}</button>}
        {atStep&&<button class="btn primary" disabled={busy} onClick={()=>void act('inspect')}>{t('quest.journal.inspect')}</button>}
        {ready&&atFinish&&<button class="btn primary" disabled={busy} onClick={()=>void act('claim')}>{t('quest.journal.claim')}</button>}
        {!atStart&&!atFinish&&!atStep&&<p class="pn-note">{t('quest.journal.contact')}</p>}
        <button class="btn" disabled={busy||trackedQuest(save)?.id===q.id} onClick={()=>void act('track')}>{t(trackedQuest(save)?.id===q.id?'quest.journal.tracked':'quest.journal.track')}</button>
      </>}
      <SecHead>{t(state?.reward&&!state.claimed?'quest.journal.reserved':'quest.journal.reward')}</SecHead>
      {state?.reward&&!state.claimed?<ItemTooltip item={state.reward}/>:<p class="pn-note">{t(q.rewardText)}</p>}
    </>}
  </PanelFrame>;
}

export function AdventureTracker() {
  const save=useUI(s=>s.char),zone=useUI(s=>s.zone),dungeon=useUI(s=>s.dungeon);
  if(!save)return null;
  const q=trackedQuest(save),objective=q&&questObjective(save,q);
  return <div class="quest-hud interactive">
    <button class="btn" onClick={openJournal}>{t('quest.journal.title')}</button>
    {dungeon&&<div class="frame adventure-tracker" title={t('quest.pump.replay')}>
      <strong>{zone?.name}</strong>
      <span>{dungeon.phase==='done'?t('quest.pump.done'):ADVENTURES[zone!.zone]?.interactions.find(i=>i.id===dungeon.target)?.name}</span>
      {dungeon.phase!=='done'&&<small>{dungeon.phase==='active'?`${t('quest.pump.active')} · ${dungeon.remaining}`:t('quest.pump.ready')}</small>}
    </div>}
    {q&&objective&&<button class="frame adventure-tracker" onClick={()=>{openJournal();ui.set({journalQuest:q.id});}} title={t('quest.journal.open')}>
      <strong>{t(q.title)}</strong><span>{objective.text}</span>
      {zone?.zone!==objective.zone&&<small>{ZONES[objective.zone]?.name??objective.zone}</small>}
    </button>}
  </div>;
}
