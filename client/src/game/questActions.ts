// Using quest objects without a window (docs/rework/quests/DESIGN.md §6, §8): E on an object that is the current objective
// investigates (or starts a hold-to-repair) right away and shows the reading as a card; the server stays authoritative
// (holdStart → inspect after the hold, proximity and line of sight checked there).
import { questText, type QuestMessageKey, QUEST_MESSAGES } from '@shared/data/questMessages';
import { activeQuests, contactSpot, objectStepAt, questObjective, questState } from '@shared/quests';
import { boardState, boardUnlocked } from '@shared/bounties';
import { questRequest } from '@shared/questRequests';
import type { QuestDef, QuestStep } from '@shared/questTypes';
import { ADVENTURES } from '@shared/adventure';
import { togglePanel, ui } from '../ui/store';
import { run } from '../ui/panels/util';

export function showReading(zone: string, target: string) {
  const key = `read.${zone}.${target}` as QuestMessageKey;
  if (!Object.hasOwn(QUEST_MESSAGES, key)) return false;
  const name = ADVENTURES[zone]?.interactions.find((i) => i.id === target)?.name ?? '';
  ui.set({ reading: { title: name, text: questText(key), at: Date.now() } });
  return true;
}

async function inspect(q: QuestDef, target: string, zone: string) {
  const save = ui.get().char;
  const r = await run('quest', questRequest(q, save ? questState(save, q.id) : undefined, target, 'inspect'));
  if (r.ok) showReading(zone, target);
  return r.ok;
}

/** Begin using an object for the current step: a hold shows the bar (the game loop finishes or cancels it). */
export async function useQuestObject(q: QuestDef, step: QuestStep, zone: string, target: string): Promise<void> {
  const save = ui.get().char;
  togglePanel('dialogue', false);
  const r = await run<{ hold?: number }>('quest', questRequest(q, save ? questState(save, q.id) : undefined, target, 'holdStart'));
  if (!r.ok) return;
  const hold = r.data?.hold ?? 0;
  if (hold > 0) {
    const spot = contactSpot(ADVENTURES[zone], target, save);
    const name = `${ADVENTURES[zone]?.interactions.find((i) => i.id === target)?.name ?? ''}`;
    ui.set({ hold: { quest: q.id, step: step.id, target, name, ms: hold, start: performance.now(), x: spot?.x ?? 0, y: spot?.y ?? 0, radius: spot?.radius ?? 110 } });
  } else await inspect(q, target, zone);
}

/** Called every frame by the game: cancel a hold when the hero walks off, finish it when the time is up. */
export function tickHold(hero: { x: number; y: number }, moving: boolean, zone: string | undefined) {
  const h = ui.get().hold;
  if (!h) return;
  if (moving || Math.hypot(hero.x - h.x, hero.y - h.y) > h.radius) { ui.set({ hold: null }); return; }
  if (performance.now() - h.start < h.ms) return;
  ui.set({ hold: null });
  const save = ui.get().char, hit = save && zone ? objectStepAt(save, zone, h.target) : undefined;
  if (hit && hit.q.id === h.quest && zone) void inspect(hit.q, h.target, zone);
}

/** E on an object: act on the current objective, else just read it. Returns false when the dialogue window should open. */
export function interactObject(zone: string, target: string): boolean {
  const save = ui.get().char;
  if (!save) return false;
  const hit = objectStepAt(save, zone, target);
  if (hit) { void useQuestObject(hit.q, hit.step, zone, target); return true; }
  const a = ADVENTURES[zone], ev = a?.events?.find((e) => e.trigger === target);
  if (ev) {
    // A quest step or an open bounty wants this event: start it straight away and say what it is; otherwise the window
    // explains the optional encounter first.
    const wanted = activeQuests(save).some((q) => { const st = questState(save, q.id), step = st && q.steps[st.step]; return step?.kind === 'wave' && step.zone === zone && step.target === ev.id; })
      || (boardUnlocked(save, zone) && (() => { const b = boardState(save, zone); return b.picks.some((id, i) => !(b.done & (1 << i)) && id === `ev_${ev.id}`); })());
    if (!wanted) return false;
    togglePanel('dialogue', false);
    void run('quest', { action: 'activateField', target }).then((r) => { if (r.ok) ui.set({ reading: { title: ev.name, text: ev.blurb ?? '', at: Date.now() } }); });
    return true;
  }
  // An object a quest needs later: say what comes first instead of reading out an action that did not happen.
  const later = activeQuests(save).find((q) => { const st = questState(save, q.id); return !!st && q.steps.some((s, i) => i > st.step && s.zone === zone && (s.targets ?? [s.target]).includes(target)); });
  if (later) {
    const name = a?.interactions.find((i) => i.id === target)?.name ?? '';
    ui.set({ reading: { title: name, text: `${questText('ui.quest.notYet')} ${questObjective(save, later).text}.`, at: Date.now() } });
    return true;
  }
  return showReading(zone, target);
}
