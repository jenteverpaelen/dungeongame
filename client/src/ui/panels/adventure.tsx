import { validIntro } from '@shared/onboarding';
import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { QUESTS } from '@shared/data/quests';
import { questText as t } from '@shared/data/questMessages';
import { CHAPTERS, LORE } from '@shared/data/story';
import { ADVENTURES } from '@shared/adventure';
import town from '@shared/data/town/hearthmere.json';
import { ZONES } from '@shared/data/zones';
import { loreAvailable, questAvailable, questCompleted, questContact, questObjective, questState, questStatus, questStepText, questUnlocks, trackedQuest, validQuestState, type QuestStatus } from '@shared/quests';
import type { CharacterSave } from '@shared/types';
import type { QuestDef } from '@shared/questTypes';
import { questRequest } from '@shared/questRequests';
import { text as ut } from '../../i18n/messages';
import { togglePanel, ui, useUI, worldReader } from '../store';
import { PanelFrame, Tabs, Paged } from './common';
import { ItemTooltip } from './tooltip';
import { run } from './util';
import { QuestDelivery } from './questDelivery';
import { Bestiary } from './bestiary';
import { MERCHANTS } from '@shared/merchant';
import { UiIcon } from '../hud/UiIcons';

export function openJournal() {
  ui.set({adventureTarget:null,adventureZone:null,journalQuest:null});
  togglePanel('adventure',true);
}

// ─────────────────────────── Quest journal (J) ───────────────────────────
// One screen: chapters on the left (accordion with progress), the chosen quest on the right with its story,
// objectives, rewards and the track toggle inline (atlas UI-POE1-06 map/detail split; UI-D3-05 tracker parity).

type Shown = QuestStatus | 'ready';
type Filter = 'all' | 'active' | 'ready' | 'available' | 'complete';
interface Group { id: string; act: string; title: string; quests: readonly QuestDef[] }
const GROUPS: Group[] = [
  ...CHAPTERS.map(c => ({ id: c.id, act: t(c.act), title: t(c.title), quests: QUESTS.filter(q => q.chapter === c.id) })),
  { id: 'workshop', act: ut('journal.group.frontier'), title: ut('journal.group.workshop'), quests: QUESTS.filter(q => !q.chapter && q.id.startsWith('workshop_')) },
  { id: 'contracts', act: ut('journal.group.frontier'), title: ut('journal.group.contracts'), quests: QUESTS.filter(q => !q.chapter && q.repeat) },
  { id: 'other', act: ut('journal.group.frontier'), title: ut('journal.group.other'), quests: QUESTS.filter(q => !q.chapter && !q.repeat && !q.id.startsWith('workshop_')) },
];
function shown(save: CharacterSave, q: QuestDef): Shown {
  const s = questState(save, q.id);
  return s && !s.claimed && s.step === q.steps.length ? 'ready' : questStatus(save, q);
}
const statusLabel = (s: Shown) => s === 'ready' ? ut('journal.ready') : t(('quest.journal.' + (s === 'unavailable' ? 'retained' : s)) as Parameters<typeof t>[0]);
const statusChip = (s: Shown) => s === 'ready' ? 'warn' : s === 'active' ? 'info' : s === 'complete' ? 'good' : '';

export function AdventurePanel() {
  const save = useUI(s => s.char), selected = useUI(s => s.journalQuest);
  const [view, setView] = useState<'quests' | 'lore' | 'bestiary'>('quests'), [filter, setFilter] = useState<Filter>('all'), [search, setSearch] = useState('');
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  if (!save) return null;
  const visible = (q: QuestDef) => !q.tutorial || validIntro(save.onboarding);
  const matches = (q: QuestDef) => {
    if (!visible(q) || !t(q.title).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) return false;
    const s = shown(save, q);
    return filter === 'all' || s === filter || (filter === 'active' && s === 'ready');
  };
  const groups = GROUPS.map(g => ({ ...g, list: g.quests.filter(matches), all: g.quests.filter(visible) })).filter(g => g.list.length);
  const flat = groups.flatMap(g => g.list);
  const tracked = trackedQuest(save);
  const q = flat.find(x => x.id === selected) ?? flat.find(x => x.id === tracked?.id) ?? flat[0];
  const open = openGroup && groups.some(g => g.id === openGroup) ? openGroup : groups.find(g => g.list.some(x => x.id === q?.id))?.id ?? groups[0]?.id;
  const count = (f: Filter) => QUESTS.filter(x => visible(x) && (f === 'all' || shown(save, x) === f || (f === 'active' && shown(save, x) === 'ready'))).length;
  const readings = LORE.filter(l => loreAvailable(save, l));
  return <PanelFrame id="adventure" title={t('quest.journal.title')} sub={t('quest.journal.subtitle')} width={1240}>
    <Tabs tabs={[{ id: 'quests', label: t('quest.journal.all') }, { id: 'lore', label: t('quest.journal.lore'), badge: readings.length }, { id: 'bestiary', label: 'Bestiary' }]} value={view} onChange={setView} />
    <MerchantInteraction />
    {view === 'bestiary' ? <Bestiary save={save} /> : view === 'lore' ? <>
      {!readings.length && <p>{t('quest.journal.loreEmpty')}</p>}
      <Paged size={1} label="Lore pages">{readings.map(l => <details class="quest-reading" key={l.id} open><summary>{t(l.title)}</summary><p>{t(l.text)}</p></details>)}</Paged>
    </> : <div class="jr">
      <nav class="jr-list" aria-label={t('quest.journal.all')}>
        <div class="jr-filters" role="group" aria-label={t('quest.journal.progress')}>
          {(['all', 'active', 'ready', 'available', 'complete'] as const).map(f => <button key={f} class={`jr-filter ${filter === f ? 'on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {ut(`journal.filter.${f}`)}<b>{count(f)}</b></button>)}
        </div>
        <input class="jr-search" type="search" placeholder={t('quest.journal.search')} aria-label={t('quest.journal.search')} value={search} onInput={e => setSearch(e.currentTarget.value)} />
        {!groups.length && <p class="pn-note">{ut('journal.noMatch')}</p>}
        {groups.map((g, gi) => {
          const done = g.all.filter(x => questCompleted(save, x.id)).length, isOpen = g.id === open;
          const actSep = (gi === 0 || groups[gi - 1].act !== g.act) && <div class="jr-actsep">{g.act.split(' · ')[0]}</div>;
          return <Fragment key={g.id}>{actSep}<section class={`jr-group ${isOpen ? 'open' : ''}`}>
            <button class="jr-group-h" aria-expanded={isOpen} onClick={() => setOpenGroup(isOpen ? '' : g.id)}>
              <strong>{g.title}</strong>
              <span class="jr-count">{done}/{g.all.length}</span>
              <i class="jr-bar"><b style={{ width: `${g.all.length ? (done / g.all.length) * 100 : 0}%` }} /></i>
            </button>
            {isOpen && <ul>{g.list.map(x => { const s = shown(save, x); return <li key={x.id}>
              <button class={`jr-q ${s} ${x.id === q?.id ? 'sel' : ''}`} aria-pressed={x.id === q?.id} onClick={() => ui.set({ journalQuest: x.id })}>
                <span class="jr-q-title">{t(x.title)}</span>
                {tracked?.id === x.id && <span class="jr-pin" title={ut('journal.tracked')}><UiIcon name="pin" size={13} /></span>}
                <span class={`chip ${statusChip(s)}`}>{statusLabel(s)}</span>
              </button></li>; })}</ul>}
          </section></Fragment>;
        })}
      </nav>
      <article class="jr-detail">{q ? <QuestDetails key={q.id} save={save} q={q} /> : <p role="status">{t('quest.journal.empty')}</p>}</article>
    </div>}
  </PanelFrame>;
}

function MerchantInteraction(){
  const target=useUI(s=>s.adventureTarget),zone=useUI(s=>s.zone),interact=useUI(s=>s.interact);
  const def=MERCHANTS.find(m=>m.zone===zone?.zone&&m.target===target),npc=def&&ADVENTURES[def.zone]?.npcs.find(n=>n.id===def.target);
  return npc&&interact?.name===npc.name?<button class="btn" onClick={()=>togglePanel('merchant',true)}>Trade gear with {def!.name}</button>:null;
}

/** Optional field encounter trigger (shown in the dialogue window of the person who raises the alarm). */
export function FieldEventBlock({ zone, target, present }: { zone: string; target: string; present: boolean }) {
  const states = useUI(s => s.fieldEvents);
  const [busy, setBusy] = useState(false);
  const event = ADVENTURES[zone]?.events?.find(e => e.trigger === target);
  if (!event) return null;
  const state = states.find(s => s.id === event.id);
  return <div class="dlg-quest field">
    <div class="dlg-q-head"><span class="dlg-q-mark">!</span><b>{event.name}</b><span class="chip warn">Optional encounter</span></div>
    <p>{state?.phase === 'active' ? `Encounter active · ${state.remaining} remaining` : state?.phase === 'recovering' ? 'The overlook is settling. Leave the area before another alarm.' : 'Raise the alarm to draw out the creatures at the overlook.'}</p>
    <div class="dlg-q-act"><button class="btn primary" disabled={busy || !present || state?.joined || state?.phase === 'recovering'} onClick={async () => { setBusy(true); try { await run('quest', { action: 'activateField', target: event.trigger }); } finally { setBusy(false); } }}>{state?.joined ? 'Joined' : state?.phase === 'active' ? 'Join the alarm' : 'Raise the alarm'}</button></div>
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
  const chapter=CHAPTERS.find(c=>c.id===q.chapter);
  const act=async(action:string)=>{setBusy(true);try{await run('quest',questRequest(q,state,target,action));}finally{setBusy(false);}};
  const reward=typeof q.reward==='object'?q.reward:undefined;
  const isTracked=trackedQuest(save)?.id===q.id, s=shown(save,q);
  const stepsDone=state?Math.min(state.step,q.steps.length)+(state.claimed?1:0):0;
  return <>
    <header class="jr-head">
      <div>
        <span class="jr-crumb">{chapter?`${t(chapter.act)} · ${t(chapter.title)}`:GROUPS.find(g=>g.quests.includes(q))?.title}</span>
        <h2>{t(q.title)}</h2>
        <div class="jr-chips"><span class={`chip ${statusChip(s)}`}>{statusLabel(s)}</span>{q.repeat&&<span class="chip">{ut('journal.repeatable')}</span>}
          {!state?.claimed&&available&&<span class="chip">{ZONES[objective.zone]?.name??objective.zone}</span>}
          {!!(state?.completions??(state?.claimed?1:0))&&<span class="chip">{t('quest.journal.history')}: {state?.completions??1}</span>}</div>
      </div>
      {available&&!state?.claimed&&<button class={`btn ${isTracked?'primary':''}`} disabled={busy} onClick={()=>void act(isTracked?'untrack':'track')}>
        <UiIcon name={isTracked?'pinOff':'pin'} size={15}/> {isTracked?ut('journal.untrack'):t('quest.journal.track')}</button>}
    </header>
    {!valid?<p>{t('quest.journal.unavailable')}</p>:<>
      <p class="jr-story">{t(state?.claimed?q.complete:q.offer)}</p>
      {!available&&<p class="pn-note">{t('quest.journal.requires')} {q.requires.map(id=>QUESTS.find(other=>other.id===id)).filter(Boolean).map(other=>t(other!.title)).join(' · ')}</p>}
      <div class="jr-cols">
        <section class="card jr-steps">
          <header class="card-h"><span>{ut('journal.objectives')}</span><em>{stepsDone}/{q.steps.length+1}</em></header>
          <ol>{q.steps.map((st,i)=>{const done=!!state&&i<state.step,cur=!!state&&!state.claimed&&i===state.step;
            return <li key={st.id} class={done?'done':cur?'cur':''}><span class="jr-tick" aria-label={t(done?'quest.journal.complete':'quest.journal.active')}>{done?'✓':cur?'◆':'○'}</span>
              <span>{questStepText(st,done?st.count??1:cur?state?.progress??0:0)}</span>
              {cur&&(st.count??1)>1&&<i class="jr-bar"><b style={{width:`${Math.min(100,((state?.progress??0)/(st.count??1))*100)}%`}}/></i>}</li>;})}
            <li class={state?.claimed?'done':ready?'cur':''}><span class="jr-tick">{state?.claimed?'✓':ready?'◆':'○'}</span><span>{t('quest.journal.return')}: {questContact(q.finish)}</span></li>
          </ol>
          {available&&!state?.claimed&&<p class="jr-next">{ut('journal.next',{objective:`${objective.text} · ${ZONES[objective.zone]?.name??objective.zone}`})}</p>}
        </section>
        <section class="card jr-reward">
          <header class="card-h"><span>{t(state?.reward&&!state.claimed?'quest.journal.reserved':'quest.journal.reward')}</span></header>
          {!!reward?.xp&&<p class="jr-rw"><UiIcon name="star" size={15}/> {reward.xp.toLocaleString()} XP</p>}
          {!!reward?.gold&&<p class="jr-rw"><span class="jr-coin"/> {reward.gold.toLocaleString()} {t('quest.journal.gold').toLowerCase()}</p>}
          {questUnlocks(q).map(id=><p key={id} class="jr-rw"><UiIcon name="map" size={15}/> {ut('journal.opens',{zone:ZONES[id]?.name??id})}</p>)}
          {state?.reward&&!state.claimed?<div class="jr-item"><ItemTooltip item={state.reward}/></div>:<p class="pn-note">{t(q.rewardText)}</p>}
        </section>
      </div>
      <details class="jr-rules"><summary>{ut('journal.howItWorks')}</summary>
        <p>{t(q.repeat?'quest.journal.repeatRule':'quest.journal.once')} {t('quest.journal.sharing')}</p>
        {q.steps.some(st=>st.credit==='killer')&&<p>{t('quest.journal.killer')}</p>}
        {q.steps.some(st=>st.kind==='collect')&&<p>{t('quest.journal.collection')}</p>}
      </details>
      {available&&<div class="quest-actions">
        {(!state||state.claimed&&q.repeat)&&atStart&&<button class="btn primary" disabled={busy} onClick={()=>void act('accept')}>{t(state?'quest.journal.repeat':'quest.journal.accept')}</button>}
        {!state?.claimed&&<>
          {atStep&&step?.kind==='interact'&&<button class="btn primary" disabled={busy} onClick={()=>void act('inspect')}>{t('quest.journal.inspect')}</button>}
          {atStep&&step?.kind==='talk'&&<button class="btn primary" disabled={busy} onClick={()=>void act('objectiveTalk')}>{t('quest.journal.talk')}</button>}
          {ready&&atFinish&&<button class="btn primary" disabled={busy} onClick={()=>void act('claim')}>{t('quest.journal.claim')}</button>}
          {!atStart&&!atFinish&&!atStep&&<p class="pn-note">{t('quest.journal.contact')}</p>}
        </>}
      </div>}
      {atStep&&step?.kind==='deliver'&&<QuestDelivery key={q.id+':'+state?.cycle+':'+step.id} save={save} step={step} onDeliver={async itemIds=>(await run('quest',{...questRequest(q,state,target,'deliver'),itemIds})).ok}/>}
    </>}
  </>;
}

/** HUD quest tracker card (top right): title, objective, step progress, area and a track toggle. */
export function AdventureTracker() {
  const save=useUI(s=>s.char),zone=useUI(s=>s.zone),dungeon=useUI(s=>s.dungeon);
  const lastRun=useUI(s=>s.lastRun);
  if(!save)return null;
  const q=trackedQuest(save),objective=q&&questObjective(save,q),state=q&&questState(save,q.id);
  const step=q&&state&&!state.claimed?q.steps[state.step]:undefined,count=step?.count??1,progress=state?.progress??0;
  const stepIndex=q&&state?Math.min(state.step,q.steps.length):0,total=q?q.steps.length+1:0;
  return <div class="quest-hud interactive">
    {dungeon&&<div class="qt-card dungeon" title={t('quest.pump.replay')}>
      <div class="qt-head"><UiIcon name="obelisk" size={15}/><span>{zone?.name}</span></div>
      <p class="qt-obj">{dungeon.phase==='done'?t(ADVENTURES[zone!.zone]?.dungeon?.endTarget?'mid.dungeon.done':'quest.pump.done'):ADVENTURES[zone!.zone]?.interactions.find(i=>i.id===dungeon.target)?.name}</p>
      {dungeon.phase!=='done'&&<small class="qt-area">{dungeon.phase==='active'?`${t('quest.pump.active')} · ${dungeon.remaining}`:t('quest.pump.ready')}</small>}
    </div>}
    {q&&objective?<div class="qt-card">
      <div class="qt-head">
        <UiIcon name="quest" size={15}/><span>Tracked quest</span>
        <button class="qt-toggle" title="Stop tracking this quest" aria-label="Stop tracking this quest" onClick={()=>void run('quest',questRequest(q,questState(save,q.id),undefined,'untrack'))}><UiIcon name="pinOff" size={15}/></button>
      </div>
      <button class="qt-body" onClick={()=>{openJournal();ui.set({journalQuest:q.id});}} title={t('quest.journal.open')}>
        <strong>{t(q.title)}</strong>
        <span class="qt-obj">{objective.text}</span>
        {count>1&&<span class="qt-bar" aria-label={`${progress} of ${count}`}><i style={{width:`${Math.min(100,progress/count*100)}%`}}/></span>}
        <span class="qt-meta">{state?<span>Step {Math.min(stepIndex+1,total)} of {total}</span>:<span>Not started</span>}{zone?.zone!==objective.zone&&<span class="qt-area">· {ZONES[objective.zone]?.name??objective.zone}</span>}</span>
      </button>
    </div>:<button class="qt-card empty" onClick={openJournal}><UiIcon name="pin" size={15}/><span>No quest tracked — open the Journal to track one.</span></button>}
    {lastRun&&<button class="btn sm qt-run" onClick={()=>togglePanel('runSummary',true)}>{t('run.summary.open')}</button>}
  </div>;
}
