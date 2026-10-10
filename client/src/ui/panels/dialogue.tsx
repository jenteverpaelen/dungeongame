// Dialogue window (E on a quest contact): portrait, name plate, the conversation from DIALOGUES[zone/target] with
// topic buttons, and the quest actions this person offers (accept, talk, turn in), merchant trade and field events.
// Replaces opening the whole Quest Journal for a conversation. Server commands are the existing `quest` actions.
import { useState } from 'preact/hooks';
import { QUESTS } from '@shared/data/quests';
import { questText as t } from '@shared/data/questMessages';
import { DIALOGUES } from '@shared/data/dialogues';
import { BARKS } from '@shared/data/barks';
import { ADVENTURES } from '@shared/adventure';
import { ZONES } from '@shared/data/zones';
import { MERCHANTS } from '@shared/merchant';
import { questAvailable, questObjective, questState, storyFlag, trackedQuest } from '@shared/quests';
import { questRequest } from '@shared/questRequests';
import type { QuestDef, QuestTarget } from '@shared/questTypes';
import type { CharacterSave } from '@shared/types';
import { togglePanel, ui } from '../store';
import { npcPortrait } from '../../render/portrait';
import { PanelFrame } from './common';
import { openJournal } from './adventure';
import { useU } from './state';
import { cls, run } from './util';
import { UiIcon } from '../hud/UiIcons';
import { npcPreset } from '../../render/art/npcLooks';

interface QuestRow { q: QuestDef; kind: 'offer' | 'ready' | 'step' | 'active'; text: string }

function rowsFor(save: CharacterSave, zone: string, target: string): QuestRow[] {
  const here = (p: QuestTarget) => p.zone === zone && p.target === target;
  const rows: QuestRow[] = [];
  for (const q of QUESTS) {
    if (!questAvailable(save, q)) continue;
    const s = questState(save, q.id);
    if ((!s || (s.claimed && q.repeat)) && here(q.start)) rows.push({ q, kind: 'offer', text: t(q.offer) });
    else if (s && !s.claimed && s.step === q.steps.length && here(q.finish)) rows.push({ q, kind: 'ready', text: t(q.rewardText) });
    else if (s && !s.claimed && q.steps[s.step] && here(q.steps[s.step])) rows.push({ q, kind: 'step', text: questObjective(save, q).text });
    else if (s && !s.claimed && (here(q.start) || here(q.finish))) rows.push({ q, kind: 'active', text: questObjective(save, q).text });
  }
  const order = { ready: 0, step: 1, offer: 2, active: 3 } as const;
  return rows.sort((a, b) => order[a.kind] - order[b.kind]);
}

function QuestAction({ save, row, target, present }: { save: CharacterSave; row: QuestRow; target: string; present: boolean }) {
  const [busy, setBusy] = useState(false);
  const { q, kind } = row, state = questState(save, q.id), step = state && q.steps[state.step];
  const act = async (action: string) => { setBusy(true); try { await run('quest', questRequest(q, state, target, action)); } finally { setBusy(false); } };
  const reward = typeof q.reward === 'object' ? q.reward : undefined;
  return (
    <div class={cls('dlg-quest', kind)}>
      <div class="dlg-q-head">
        <span class="dlg-q-mark">{kind === 'offer' ? '!' : kind === 'ready' ? '?' : '◆'}</span>
        <b>{t(q.title)}</b>
        <span class="chip">{kind === 'offer' ? 'New quest' : kind === 'ready' ? 'Ready to turn in' : kind === 'step' ? 'Objective here' : 'In progress'}</span>
      </div>
      <p>{row.text}</p>
      {(kind === 'offer' || kind === 'ready') && (reward?.xp || reward?.gold) ? <p class="dlg-reward">Reward: {reward?.xp ? `${reward.xp.toLocaleString()} XP` : ''}{reward?.xp && reward?.gold ? ' · ' : ''}{reward?.gold ? `${reward.gold.toLocaleString()} gold` : ''}</p> : null}
      <div class="dlg-q-act">
        {kind === 'offer' && <button class="btn primary" disabled={busy || !present} onClick={() => void act('accept')}>{t(state ? 'quest.journal.repeat' : 'quest.journal.accept')}</button>}
        {kind === 'ready' && <button class="btn primary" disabled={busy || !present} onClick={() => void act('claim')}>{t('quest.journal.claim')}</button>}
        {kind === 'step' && step?.kind === 'talk' && <button class="btn primary" disabled={busy || !present} onClick={() => void act('objectiveTalk')}>{t('quest.journal.talk')}</button>}
        {kind === 'step' && step?.kind === 'interact' && <button class="btn primary" disabled={busy || !present} onClick={() => void act('inspect')}>{t('quest.journal.inspect')}</button>}
        {kind === 'step' && step?.kind === 'deliver' && <button class="btn primary" onClick={() => { ui.set({ journalQuest: q.id }); togglePanel('adventure', true); }}>{t('quest.delivery.title')}</button>}
        <button class="btn quiet sm" onClick={() => { openJournal(); ui.set({ journalQuest: q.id }); }}>Details in journal</button>
        {state && !state.claimed && trackedQuest(save)?.id !== q.id && <button class="btn quiet sm" disabled={busy} onClick={() => void act('track')}>{t('quest.journal.track')}</button>}
      </div>
    </div>
  );
}

export function DialoguePanel() {
  const d = useU((s) => s.dialogue), save = useU((s) => s.char), zone = useU((s) => s.zone), interact = useU((s) => s.interact);
  const [node, setNode] = useState<{ key: string; id: string }>({ key: '', id: '' });
  if (!d || !save) return null;
  const key = `${d.zone}/${d.target}`;
  const conversation = DIALOGUES[key];
  const nodeId = node.key === key ? node.id : '';
  const current = conversation ? conversation.nodes[nodeId] ?? conversation.nodes[conversation.start] : null;
  const present = zone?.zone === d.zone && interact?.name === d.name;
  const rows = rowsFor(save, d.zone, d.target);
  const merchant = MERCHANTS.find((m) => m.zone === d.zone && m.target === d.target);
  const preset = npcPreset(d.zone, d.target, d.role, d.name);
  const portrait = ['blacksmith', 'jeweler', 'mystic', 'quest', 'healer', 'vendor', 'resident'].includes(d.role) ? npcPortrait(d.zone, d.target, d.role, d.name) : null;
  const barks = BARKS[d.role] ?? BARKS[d.target];
  const greeting = current ? t(current.text) : barks ? barks[(save.name.length + d.name.length) % barks.length] : 'They nod at you and wait.';
  const place = ZONES[d.zone]?.name ?? d.zone;
  void ADVENTURES;
  const [base, suffix] = d.name.split(' · ');
  const title = suffix ?? (preset.title && preset.title !== base ? preset.title : '');
  const close = () => togglePanel('dialogue', false);
  return (
    <PanelFrame id="dialogue" title={base} sub={<>{title ? `${title} · ` : ''}{place}</>} width={720}
      footer={<><span class="grow">{present ? 'Choices here have no cost; quest actions are confirmed by the server.' : 'Walk back to them to continue the conversation.'}</span><button class="btn" onClick={close}>Goodbye</button></>}>
      <div class="dlg-top">
        <div class="dlg-portrait">{portrait ? <img src={portrait} alt="" /> : <UiIcon name="chat" size={44} />}</div>
        <div class="dlg-speech">
          <p class="dlg-line">{greeting}</p>
          {current && current.choices.length > 0 && (
            <div class="dlg-topics" role="group" aria-label="Topics">
              {current.choices.filter((c) => (c.when ?? []).every((f) => storyFlag(save, f))).map((c, i) => (
                <button key={i} class="dlg-topic" onClick={() => setNode({ key, id: c.to })}>
                  <UiIcon name="chat" size={14} /><span>{t(c.label)}</span>
                </button>
              ))}
            </div>
          )}
          {current && current.choices.length === 0 && conversation && nodeId && nodeId !== conversation.start && (
            <button class="dlg-topic back" onClick={() => setNode({ key, id: conversation.start })}><span>Ask something else</span></button>
          )}
        </div>
      </div>
      {rows.length > 0 && <section class="dlg-quests" aria-label="Quests"><header class="card-h"><span>Quests</span><em>{rows.length === 1 ? 'One matter to discuss' : `${rows.length} matters to discuss`}</em></header>
        {rows.slice(0, 3).map((r) => <QuestAction key={r.q.id} save={save} row={r} target={d.target} present={present} />)}
      </section>}
      {merchant && <div class="dlg-extra"><button class="btn" disabled={!present} onClick={() => togglePanel('merchant', true)}><UiIcon name="merchant" size={16} /> Trade gear with {merchant.name}</button></div>}
    </PanelFrame>
  );
}
