import { validIntro } from '@shared/onboarding';
import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { QUESTS } from '@shared/data/quests';
import { questText as t, QUEST_MESSAGES, type QuestMessageKey } from '@shared/data/questMessages';
import { CHAPTERS, LORE } from '@shared/data/story';
import { ADVENTURES } from '@shared/adventure';
import { ZONES } from '@shared/data/zones';
import { bitCount, loreAvailable, questAvailable, questCategory, questCompleted, questContact, questObjective, questState, questStatus, questStepText, trackedQuest, validQuestState, type QuestStatus } from '@shared/quests';
import { BOUNTY_BOARDS, boardComplete, boardState, boardUnlocked, bountyDef, bountyKey, bountyNeed, bountyObjective } from '@shared/bounties';
import type { CharacterSave } from '@shared/types';
import type { QuestDef } from '@shared/questTypes';
import { questRequest } from '@shared/questRequests';
import { text as ut } from '../../i18n/messages';
import { togglePanel, ui, useUI } from '../store';
import { PanelFrame, Tabs, Paged } from './common';
import { run } from './util';
import { QuestDelivery } from './questDelivery';
import { Bestiary } from './bestiary';
import { MERCHANTS } from '@shared/merchant';
import { UiIcon } from '../hud/UiIcons';
import { QuestGlyph, RewardPreview, categoryLabel } from './questUi';

export function openJournal() {
  ui.set({adventureTarget:null,adventureZone:null,journalQuest:null});
  togglePanel('adventure',true);
}

// ─────────────────────────── Quest journal (J) ───────────────────────────
// Tabs by category (docs/rework/quests/DESIGN.md §2): Story by act and chapter, Side stories by zone (plus the workshop
// lessons and gifts), Bounties per board, Recovered records (the codex, F-QST-08) and the Bestiary. The detail puts the
// objectives first and the story second (REFERENCES R2), rewards with both choices of a pick (R24, R27), then focus /
// hide / abandon.

type Shown = QuestStatus | 'ready';
type Filter = 'all' | 'active' | 'ready' | 'available' | 'complete';
type View = 'story' | 'side' | 'bounties' | 'lore' | 'bestiary';
interface Group { id: string; act: string; title: string; quests: readonly QuestDef[] }
const ZONE_ORDER = Object.keys(ADVENTURES);
const STORY_GROUPS: Group[] = CHAPTERS.map(c => ({ id: c.id, act: t(c.act), title: t(c.title), quests: QUESTS.filter(q => questCategory(q) === 'story' && q.chapter === c.id) }));
const tutorial = QUESTS.filter(q => q.tutorial);
if (tutorial.length) STORY_GROUPS[0] = { ...STORY_GROUPS[0], quests: [...tutorial, ...STORY_GROUPS[0].quests] };
const SIDE_GROUPS: Group[] = [
  ...ZONE_ORDER.map(z => ({ id: z, act: t('ui.quest.side'), title: ZONES[z]?.name ?? z, quests: QUESTS.filter(q => questCategory(q) === 'side' && q.start.zone === z) })).filter(g => g.quests.length),
  { id: 'lessons', act: t('ui.quest.lesson'), title: t('ui.quest.workshop'), quests: QUESTS.filter(q => questCategory(q) === 'lesson') },
];
function shown(save: CharacterSave, q: QuestDef): Shown {
  const s = questState(save, q.id);
  return s && !s.claimed && s.step === q.steps.length ? 'ready' : questStatus(save, q);
}
const statusLabel = (s: Shown) => s === 'ready' ? ut('journal.ready') : t(('quest.journal.' + (s === 'unavailable' ? 'retained' : s)) as Parameters<typeof t>[0]);
const statusChip = (s: Shown) => s === 'ready' ? 'warn' : s === 'active' ? 'info' : s === 'complete' ? 'good' : '';

export function AdventurePanel() {
  const save = useUI(s => s.char), selected = useUI(s => s.journalQuest);
  const pickedCat = selected ? QUESTS.find(q => q.id === selected) : undefined;
  const [view, setView] = useState<View>(pickedCat && questCategory(pickedCat) !== 'story' ? 'side' : 'story');
  const [filter, setFilter] = useState<Filter>('all'), [search, setSearch] = useState('');
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  if (!save) return null;
  const readings = codexEntries(save);
  return <PanelFrame id="adventure" title={t('quest.journal.title')} sub={t('quest.journal.subtitle')} width={1240}>
    <Tabs tabs={[{ id: 'story', label: t('ui.quest.tabStory') }, { id: 'side', label: t('ui.quest.tabSide') }, { id: 'bounties', label: t('ui.quest.tabBounties') },
      { id: 'lore', label: t('ui.quest.records'), badge: readings.length }, { id: 'bestiary', label: 'Bestiary' }]} value={view} onChange={setView} />
    <MerchantInteraction />
    {view === 'bestiary' ? <Bestiary save={save} /> : view === 'lore' ? <Codex save={save} /> : view === 'bounties' ? <BountyBoards save={save} />
      : <QuestBrowser save={save} groups={view === 'story' ? STORY_GROUPS : SIDE_GROUPS} selected={selected} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} openGroup={openGroup} setOpenGroup={setOpenGroup} />}
  </PanelFrame>;
}

function QuestBrowser({ save, groups: all, selected, filter, setFilter, search, setSearch, openGroup, setOpenGroup }: { save: CharacterSave; groups: Group[]; selected: string | null; filter: Filter; setFilter: (f: Filter) => void; search: string; setSearch: (s: string) => void; openGroup: string | null; setOpenGroup: (g: string | null) => void }) {
  const visible = (q: QuestDef) => !q.tutorial || validIntro(save.onboarding);
  const matches = (q: QuestDef) => {
    if (!visible(q) || !t(q.title).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) return false;
    const s = shown(save, q);
    return filter === 'all' || s === filter || (filter === 'active' && s === 'ready');
  };
  const groups = all.map(g => ({ ...g, list: g.quests.filter(matches), every: g.quests.filter(visible) })).filter(g => g.list.length);
  const flat = groups.flatMap(g => g.list), pool = all.flatMap(g => g.quests);
  const tracked = trackedQuest(save);
  const q = flat.find(x => x.id === selected) ?? flat.find(x => x.id === tracked?.id) ?? flat.find(x => shown(save, x) === 'active' || shown(save, x) === 'ready') ?? flat[0];
  const open = openGroup && groups.some(g => g.id === openGroup) ? openGroup : groups.find(g => g.list.some(x => x.id === q?.id))?.id ?? groups[0]?.id;
  const count = (f: Filter) => pool.filter(x => visible(x) && (f === 'all' || shown(save, x) === f || (f === 'active' && shown(save, x) === 'ready'))).length;
  return <div class="jr">
    <nav class="jr-list" aria-label={t('quest.journal.all')}>
      <div class="jr-filters" role="group" aria-label={t('quest.journal.progress')}>
        {(['all', 'active', 'ready', 'available', 'complete'] as const).map(f => <button key={f} class={`jr-filter ${filter === f ? 'on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
          {ut(`journal.filter.${f}`)}<b>{count(f)}</b></button>)}
      </div>
      <input class="jr-search" type="search" placeholder={t('quest.journal.search')} aria-label={t('quest.journal.search')} value={search} onInput={e => setSearch(e.currentTarget.value)} />
      {!groups.length && <p class="pn-note">{ut('journal.noMatch')}</p>}
      {groups.map((g, gi) => {
        const done = g.every.filter(x => questCompleted(save, x.id)).length, isOpen = g.id === open;
        const actSep = (gi === 0 || groups[gi - 1].act !== g.act) && <div class="jr-actsep">{g.act.split(' · ')[0]}</div>;
        return <Fragment key={g.id}>{actSep}<section class={`jr-group ${isOpen ? 'open' : ''}`}>
          <button class="jr-group-h" aria-expanded={isOpen} onClick={() => setOpenGroup(isOpen ? '' : g.id)}>
            <strong>{g.title}</strong>
            <span class="jr-count">{done}/{g.every.length}</span>
            <i class="jr-bar"><b style={{ width: `${g.every.length ? (done / g.every.length) * 100 : 0}%` }} /></i>
          </button>
          {isOpen && <ul>{g.list.map(x => { const s = shown(save, x), cat = questCategory(x); return <li key={x.id}>
            <button class={`jr-q ${s} ${x.id === q?.id ? 'sel' : ''}`} aria-pressed={x.id === q?.id} onClick={() => ui.set({ journalQuest: x.id })}>
              <QuestGlyph cat={cat} glyph={s === 'ready' ? '?' : s === 'available' ? (cat === 'lesson' ? '+' : '!') : s === 'complete' ? '✓' : '◆'} />
              <span class="jr-q-title">{t(x.title)}</span>
              {tracked?.id === x.id && <span class="jr-pin" title={ut('journal.tracked')}><UiIcon name="pin" size={13} /></span>}
              <span class={`chip ${statusChip(s)}`}>{statusLabel(s)}</span>
            </button></li>; })}</ul>}
        </section></Fragment>;
      })}
    </nav>
    <article class="jr-detail">{q ? <QuestDetails key={q.id} save={save} q={q} /> : <p role="status">{t('quest.journal.empty')}</p>}</article>
  </div>;
}

function MerchantInteraction(){
  const target=useUI(s=>s.adventureTarget),zone=useUI(s=>s.zone),interact=useUI(s=>s.interact);
  const def=MERCHANTS.find(m=>m.zone===zone?.zone&&m.target===target),npc=def&&ADVENTURES[def.zone]?.npcs.find(n=>n.id===def.target);
  return npc&&interact?.name===npc.name?<button class="btn" onClick={()=>togglePanel('merchant',true)}>Trade gear with {def!.name}</button>:null;
}

/** Optional field encounter trigger (shown in the dialogue window of the object that raises it). Starting closes the window. */
export function FieldEventBlock({ zone, target, present }: { zone: string; target: string; present: boolean }) {
  const states = useUI(s => s.fieldEvents);
  const [busy, setBusy] = useState(false);
  const event = ADVENTURES[zone]?.events?.find(e => e.trigger === target);
  if (!event) return null;
  const state = states.find(s => s.id === event.id);
  return <div class="dlg-quest field">
    <div class="dlg-q-head"><span class="dlg-q-mark">!</span><b>{event.name}</b><span class="chip warn">Optional encounter</span></div>
    <p>{state?.phase === 'active' ? `Encounter active · ${state.remaining} remaining` : state?.phase === 'recovering' ? 'The area is settling. Leave it before starting this again.' : (event.blurb ?? 'Raise the alarm to draw out the creatures here.')}</p>
    <div class="dlg-q-act"><button class="btn primary" disabled={busy || !present || state?.joined || state?.phase === 'recovering'} onClick={async () => { setBusy(true); try { if ((await run('quest', { action: 'activateField', target: event.trigger })).ok) togglePanel('dialogue', false); } finally { setBusy(false); } }}>{state?.joined ? 'Joined' : state?.phase === 'active' ? 'Join the fight' : (event.action ?? 'Raise the alarm')}</button></div>
  </div>;
}

function QuestDetails({save,q}:{save:CharacterSave;q:QuestDef}) {
  const selectedTarget=useUI(s=>s.adventureTarget),selectedZone=useUI(s=>s.adventureZone),zone=useUI(s=>s.zone),interact=useUI(s=>s.interact);
  const [busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false);
  const contactZone=selectedZone??zone?.zone, target=selectedTarget??undefined;
  const npc=contactZone&&ADVENTURES[contactZone]?.npcs.find(n=>n.id===target);
  const present=!!npc&&zone?.zone===contactZone&&interact?.name===npc.name;
  const state=questState(save,q.id),available=questAvailable(save,q),valid=!state||validQuestState(q,state);
  const objective=questObjective(save,q),step=state&&q.steps[state.step],ready=state?.step===q.steps.length&&!state.claimed;
  const atStep=present&&!!step&&step.zone===contactZone&&(step.targets??[step.target]).includes(target!);
  const chapter=CHAPTERS.find(c=>c.id===q.chapter),cat=questCategory(q);
  const act=async(action:string)=>{setBusy(true);try{await run('quest',questRequest(q,state,target,action));}finally{setBusy(false);}};
  const focus=trackedQuest(save)?.id===q.id,hidden=!!save.questHidden?.includes(q.id),s=shown(save,q);
  const stepsDone=state?Math.min(state.step,q.steps.length)+(state.claimed?1:0):0;
  return <>
    <header class="jr-head">
      <div>
        <span class="jr-crumb"><QuestGlyph cat={cat} glyph={cat==='lesson'?'+':'!'}/> {categoryLabel(cat)} · {chapter?`${t(chapter.act)} · ${t(chapter.title)}`:ZONES[q.start.zone]?.name}</span>
        <h2>{t(q.title)}</h2>
        <div class="jr-chips"><span class={`chip ${statusChip(s)}`}>{statusLabel(s)}</span>
          {!state?.claimed&&available&&<span class="chip">{ZONES[objective.zone]?.name??objective.zone}</span>}
          {hidden&&<span class="chip">{t('ui.quest.hide').split(' (')[0]}</span>}</div>
      </div>
      {state&&!state.claimed&&<div class="jr-tools">
        <button class={`btn ${focus?'primary':''}`} disabled={busy} title={t(focus?'ui.quest.unfocus':'ui.quest.focus')} onClick={()=>void act(focus?'unfocus':'focus')}><UiIcon name={focus?'pin':'pinOff'} size={15}/> {focus?ut('journal.untrack'):t('quest.journal.track')}</button>
        <button class="btn" disabled={busy} title={t(hidden?'ui.quest.show':'ui.quest.hide')} onClick={()=>void act(hidden?'show':'hide')}><UiIcon name="eye" size={15}/> {t(hidden?'ui.quest.show':'ui.quest.hide').split(' (')[0]}</button>
        {!q.tutorial&&<button class={`btn ${confirm?'danger':''}`} disabled={busy} title={t('ui.quest.abandonConfirm')} onClick={()=>{if(!confirm){setConfirm(true);return;}setConfirm(false);void act('abandon');}}>{confirm?`${t('ui.quest.abandon')}?`:t('ui.quest.abandon')}</button>}
      </div>}
    </header>
    {!valid?<p>{t('quest.journal.unavailable')}</p>:<>
      {!available&&<p class="pn-note">{t('quest.journal.requires')} {q.requires.map(id=>QUESTS.find(other=>other.id===id)).filter(Boolean).map(other=>t(other!.title)).join(' · ')}</p>}
      <div class="jr-cols">
        <section class="card jr-steps">
          <header class="card-h"><span>{ut('journal.objectives')}</span><em>{stepsDone}/{q.steps.length+1}</em></header>
          <ol>{q.steps.map((st,i)=>{const done=!!state&&(i<state.step||state.claimed),cur=!!state&&!state.claimed&&i===state.step;
            const count=st.targets?st.targets.length:st.count??1,have=done?count:cur?(st.targets?bitCount(state?.parts??0):state?.progress??0):0;
            return <li key={st.id} class={done?'done':cur?'cur':''}><span class="jr-tick" aria-label={t(done?'quest.journal.complete':'quest.journal.active')}>{done?'✓':cur?'◆':'○'}</span>
              <span>{questStepText(st,done?count:cur?state?.progress??0:0,done?(1<<(st.targets?.length??0))-1:cur?state?.parts??0:0)}{st.hold?' ⧗':''}</span>
              {cur&&count>1&&<i class="jr-bar"><b style={{width:`${Math.min(100,(have/count)*100)}%`}}/></i>}</li>;})}
            <li class={state?.claimed?'done':ready?'cur':''}><span class="jr-tick">{state?.claimed?'✓':ready?'◆':'○'}</span><span>{t('quest.journal.return')}: {questContact(q.finish)}</span></li>
          </ol>
          {available&&!state?.claimed&&<p class="jr-next">{ut('journal.next',{objective:`${objective.text} · ${ZONES[objective.zone]?.name??objective.zone}`})}</p>}
          {atStep&&step?.kind==='talk'&&<button class="btn primary" disabled={busy} onClick={()=>void act('objectiveTalk')}>{t('quest.journal.talk')}</button>}
        </section>
        <section class="card jr-reward">
          <header class="card-h"><span>{t(state?.reward&&!state.claimed?'quest.journal.reserved':'quest.journal.reward')}</span></header>
          <RewardPreview save={save} q={q} compact />
        </section>
      </div>
      <p class="jr-story">{t(state?.claimed?q.complete:q.offer)}</p>
      <details class="jr-rules"><summary>{ut('journal.howItWorks')}</summary>
        <p>{t(q.repeat?'quest.journal.repeatRule':'quest.journal.once')} {t('quest.journal.sharing')}</p>
        {q.steps.some(st=>st.credit==='killer')&&<p>{t('quest.journal.killer')}</p>}
        {q.steps.some(st=>st.kind==='collect')&&<p>{t('quest.journal.collection')}</p>}
      </details>
      {atStep&&step?.kind==='deliver'&&<QuestDelivery key={q.id+':'+state?.cycle+':'+step.id} save={save} step={step} onDeliver={async itemIds=>(await run('quest',{...questRequest(q,state,target,'deliver'),itemIds})).ok}/>}
    </>}
  </>;
}

// ─────────────────────────── Bounties (DESIGN.md §5) ───────────────────────────
function BountyBoards({ save }: { save: CharacterSave }) {
  const zones = Object.keys(BOUNTY_BOARDS);
  return <Paged size={3} label="Bounty boards">{zones.map(z => {
    const open = boardUnlocked(save, z), b = boardState(save, z), unlock = QUESTS.find(q => q.id === BOUNTY_BOARDS[z].unlock);
    return <section key={z} class={`card bty-row ${open ? '' : 'locked'}`}>
      <header class="card-h"><span><QuestGlyph cat="bounty" glyph={open && boardComplete(b) ? '!' : ''} /> {ZONES[z]?.name}</span><em>{open ? `${bitCount(b.done)}/${b.picks.length}` : t('quest.journal.locked')}</em></header>
      {!open ? <p class="pn-note">{t('bounty.board.locked')} {unlock ? `(${t(unlock.title)})` : ''}</p> : <ul class="bty-list">{b.picks.map((id, i) => {
        const d = bountyDef(z, id)!, paid = !!(b.done & (1 << i));
        return <li key={id} class={paid ? 'done' : ''}><span class="jr-tick">{paid ? '✓' : '○'}</span><b>{t(bountyKey(z, id))}</b><span>{bountyObjective(z, d)}</span><em>{b.progress[i]}/{bountyNeed(d)}</em></li>;
      })}</ul>}
    </section>;
  })}</Paged>;
}

// ─────────────────────────── Recovered records: the codex (F-QST-08) ───────────────────────────
interface CodexEntry { id: string; zone: string; title: string; text: string }
/** Records the player has actually found: authored lore pages plus the reading of every quest object already used. */
export function codexEntries(save: CharacterSave): CodexEntry[] {
  const out: CodexEntry[] = [], seen = new Set<string>();
  for (const l of LORE) if (loreAvailable(save, l)) { const q = QUESTS.find(x => x.id === l.quest)!; out.push({ id: `lore:${l.id}`, zone: q.steps[Math.max(0, l.afterStep - 1)]?.zone ?? q.start.zone, title: t(l.title), text: t(l.text) }); }
  for (const q of QUESTS) {
    const s = questState(save, q.id); if (!s || !validQuestState(q, s)) continue;
    q.steps.forEach((st, i) => {
      if (st.kind !== 'interact') return;
      for (const [k, target] of (st.targets ?? [st.target]).entries()) {
        const used = i < s.step || s.claimed || (i === s.step && !!st.targets && !!((s.parts ?? 0) & (1 << k)));
        const key = `read.${st.zone}.${target}` as QuestMessageKey;
        // An authored record already covers this step (e.g. "Tracks at the crossing" for the cart): no duplicate reading.
        // For a gather the record sums up its last object (the journal, the second ledger page).
        if (LORE.some(l => l.quest === q.id && l.afterStep === i + 1) && (!st.targets || k === st.targets.length - 1)) continue;
        if (!used || seen.has(key) || !Object.hasOwn(QUEST_MESSAGES, key)) continue;
        seen.add(key); out.push({ id: key, zone: st.zone, title: ADVENTURES[st.zone]?.interactions.find(x => x.id === target)?.name ?? target, text: t(key) });
      }
    });
  }
  return out;
}
function Codex({ save }: { save: CharacterSave }) {
  const entries = codexEntries(save), zones = ZONE_ORDER.filter(z => entries.some(e => e.zone === z));
  const [zone, setZone] = useState<string | null>(null), z = zone && zones.includes(zone) ? zone : zones[0];
  if (!entries.length) return <p class="pn-note">{t('ui.quest.recordsEmpty')}</p>;
  return <div class="jr codex">
    <nav class="jr-list" aria-label={t('ui.quest.records')}>{zones.map(id => <button key={id} class={`jr-q ${id === z ? 'sel' : ''}`} aria-pressed={id === z} onClick={() => setZone(id)}>
      <UiIcon name="scroll" size={14} /><span class="jr-q-title">{ZONES[id]?.name}</span><span class="chip">{entries.filter(e => e.zone === id).length}</span></button>)}</nav>
    <article class="jr-detail"><Paged key={z} size={4} label={t('ui.quest.records')}>{entries.filter(e => e.zone === z).map(e => <section key={e.id} class="card codex-entry"><header class="card-h"><span>{e.title}</span><em>{t('ui.quest.found')}</em></header><p>{e.text}</p></section>)}</Paged></article>
  </div>;
}
