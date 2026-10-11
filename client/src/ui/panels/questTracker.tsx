// HUD quest tracker under the minimap (docs/rework/quests/DESIGN.md §3; REFERENCES R5, R12, R13, R20): every accepted
// quest that is not hidden, focus first, objectives in this zone next (nearest first), the next story step when no story
// quest is running, and one bounty row inside a zone with an open board. Focus drives the trail; hide removes a row
// until the quest progresses.
import { useEffect, useState } from 'preact/hooks';
import { questText as t } from '@shared/data/questMessages';
import { ADVENTURES } from '@shared/adventure';
import { ZONES } from '@shared/data/zones';
import { questCategory, questContact, questObjective, questPoint, questState, trackedQuest, trackerQuests } from '@shared/quests';
import { questRequest } from '@shared/questRequests';
import { BOUNTY_BOARDS, boardComplete, boardState, boardUnlocked, bountyDef, bountyKey, bountyNeed } from '@shared/bounties';
import type { QuestDef } from '@shared/questTypes';
import type { CharacterSave } from '@shared/types';
import { togglePanel, ui, useUI, worldReader } from '../store';
import { UiIcon } from '../hud/UiIcons';
import { run } from './util';
import { openJournal } from './adventure';
import { safeGet, safeSet } from '../hud/util';
import { QuestGlyph } from './questUi';

const MAX_ROWS = 5;
/** Presentation unit only: 50 world units per metre, so the hero runs 5 m/s (DESIGN.md §3, design guess). */
const METRE = 50;

function where(save: CharacterSave, q: QuestDef, zone: string | undefined, me: { x: number; y: number } | null): string {
  const o = questObjective(save, q), map = worldReader.current?.map();
  if (o.zone !== zone || !map || !me) return `→ ${ZONES[o.zone]?.name ?? o.zone}`;
  const p = questPoint(map, o, save, me, o.targets);
  if (!p) return t('ui.quest.here');
  const m = Math.round(Math.hypot(p.x - me.x, p.y - me.y) / METRE);
  return m < 4 ? t('ui.quest.here') : `${m} m`;
}

function Row({ save, q, zone, me, focus }: { save: CharacterSave; q: QuestDef; zone?: string; me: { x: number; y: number } | null; focus: boolean }) {
  const s = questState(save, q.id), cat = questCategory(q), step = s && !s.claimed ? q.steps[s.step] : undefined;
  const count = step?.targets ? step.targets.length : step?.count ?? 1, done = step?.targets ? bitCountOf(s?.parts ?? 0) : s?.progress ?? 0;
  const ready = !!s && s.step === q.steps.length;
  const text = !s ? `${t('quest.journal.start')}: ${questContact(q.start)}` : ready ? `${t('ui.quest.ready')}: ${questContact(q.finish)}` : questObjective(save, q).text;
  const act = (action: string) => void run('quest', questRequest(q, s, undefined, action));
  return <div class={`qt-row ${cat} ${focus ? 'focus' : ''} ${ready ? 'ready' : ''}`}>
    <button class="qt-row-main" title={t('quest.journal.open')} onClick={() => { openJournal(); ui.set({ journalQuest: q.id }); }}>
      <span class="qt-row-head"><QuestGlyph cat={cat} glyph={ready ? '?' : !s ? '!' : '◆'} /><strong>{t(q.title)}</strong><em>{where(save, q, zone, me)}</em></span>
      <span class="qt-obj">{text}</span>
      {count > 1 && !ready && <span class="qt-bar" aria-label={`${done} of ${count}`}><i style={{ width: `${Math.min(100, done / count * 100)}%` }} /></span>}
    </button>
    {s && <span class="qt-row-tools">
      <button class={`qt-tool ${focus ? 'on' : ''}`} title={t(focus ? 'ui.quest.unfocus' : 'ui.quest.focus')} aria-label={t(focus ? 'ui.quest.unfocus' : 'ui.quest.focus')} onClick={() => act(focus ? 'unfocus' : 'focus')}><UiIcon name={focus ? 'pin' : 'pinOff'} size={13} /></button>
      <button class="qt-tool" title={t('ui.quest.hide')} aria-label={t('ui.quest.hide')} onClick={() => act('hide')}><UiIcon name="eye" size={13} /></button>
    </span>}
  </div>;
}
const bitCountOf = (n: number) => { let c = 0; for (let v = n >>> 0; v; v &= v - 1) c++; return c; };

function BountyRow({ save, zone }: { save: CharacterSave; zone: string }) {
  const b = boardState(save, zone), doneCount = bitCountOf(b.done);
  const next = b.picks.map((id, i) => ({ id, i, def: bountyDef(zone, id)! })).find((p) => !(b.done & (1 << p.i)));
  return <div class="qt-row bounty">
    <button class="qt-row-main" onClick={() => togglePanel('bounty', true)} title={t('bounty.board.sub')}>
      <span class="qt-row-head"><QuestGlyph cat="bounty" glyph={boardComplete(b) ? '!' : ''} /><strong>{t('bounty.tracker')} · {ZONES[zone]?.name}</strong><em>{doneCount}/{b.picks.length}</em></span>
      <span class="qt-obj">{boardComplete(b) ? t('bounty.board.claim') : next ? `${t(bountyKey(zone, next.id))}${bountyNeed(next.def) > 1 ? ` (${b.progress[next.i]}/${bountyNeed(next.def)})` : ''}` : ''}</span>
    </button>
  </div>;
}

export function QuestTracker() {
  const save = useUI((s) => s.char), zone = useUI((s) => s.zone), dungeon = useUI((s) => s.dungeon), lastRun = useUI((s) => s.lastRun);
  const [, tick] = useState(0);
  const [collapsed, setCollapsed] = useState(() => safeGet('hearthfall.trackerCollapsed') === '1');
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  if (!save) return null;
  const zoneId = zone?.zone, me = worldReader.current?.myPos() ?? null;
  const all = trackerQuests(save, zoneId), focus = trackedQuest(save);
  // Nearest first inside "objective in this zone" (DESIGN.md §3); the focused row stays on top.
  const map = worldReader.current?.map(), dist = (q: QuestDef) => {
    const o = questObjective(save, q); if (o.zone !== zoneId || !map || !me) return Infinity;
    const p = questPoint(map, o, save, me, o.targets); return p ? Math.hypot(p.x - me.x, p.y - me.y) : Infinity;
  };
  const ready = (q: QuestDef) => questState(save, q.id)?.step === q.steps.length;
  const rest = all.filter((q) => q !== focus && questState(save, q.id));
  const local = rest.filter((q) => !ready(q) && dist(q) < Infinity).sort((a, b) => dist(a) - dist(b));
  const ordered = [...(focus && all.includes(focus) ? [focus] : []), ...all.filter((q) => q !== focus && !questState(save, q.id)), ...local, ...rest.filter((q) => !local.includes(q))];
  const shown = ordered.slice(0, MAX_ROWS), more = ordered.length - shown.length;
  const board = zoneId && BOUNTY_BOARDS[zoneId] && boardUnlocked(save, zoneId);
  return <div class="quest-hud interactive">
    {dungeon && <div class="qt-card dungeon" title={t('quest.pump.replay')}>
      <div class="qt-head"><UiIcon name="obelisk" size={15} /><span>{zone?.name}</span></div>
      <p class="qt-obj">{dungeon.phase === 'done' ? t(ADVENTURES[zone!.zone]?.dungeon?.endTarget ? 'mid.dungeon.done' : 'quest.pump.done') : ADVENTURES[zone!.zone]?.interactions.find((i) => i.id === dungeon.target)?.name}</p>
      {dungeon.phase !== 'done' && <small class="qt-area">{dungeon.phase === 'active' ? `${t('quest.pump.active')} · ${dungeon.remaining}` : t('quest.pump.ready')}</small>}
    </div>}
    <div class={`qt-card qt-list ${collapsed ? 'collapsed' : ''}`}>
      <button class="qt-head qt-collapse" aria-expanded={!collapsed} onClick={() => { setCollapsed(!collapsed); safeSet('hearthfall.trackerCollapsed', collapsed ? '0' : '1'); }}>
        <UiIcon name="quest" size={15} /><span>{t('ui.quest.tracker')} · {all.filter((q) => questState(save, q.id)).length}</span><b class="qt-chev">{collapsed ? '▸' : '▾'}</b>
      </button>
      {!collapsed && <>
        {shown.map((q) => <Row key={q.id} save={save} q={q} zone={zoneId} me={me} focus={q === focus} />)}
        {board && <BountyRow save={save} zone={zoneId!} />}
        {!shown.length && !board && <button class="qt-empty" onClick={openJournal}>{t('quest.journal.empty')}</button>}
        {more > 0 && <button class="qt-more" onClick={openJournal}>+{more} {t('ui.quest.more')}</button>}
      </>}
    </div>
    {lastRun && <button class="btn sm qt-run" onClick={() => togglePanel('runSummary', true)}>{t('run.summary.open')}</button>}
  </div>;
}
