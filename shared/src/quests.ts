import { validIntro } from './onboarding';
import { QUESTS } from './data/quests';
import { questText } from './data/questMessages';
import { WORLD_STATES } from './data/worldStates';
import type { CharacterSave } from './types';
import { ZONE_WIDE, type QuestCategory, type QuestDef, type QuestState, type QuestTarget, type QuestStep } from './questTypes';
import type { MapData } from './mapgen';
import type { AdventureData } from './adventureTypes';
import { nextTravelPoint } from './worldNavigation';
import town from './data/town/hearthmere.json';
import { ADVENTURES } from './adventure';
import { ZONES } from './data/zones';
import type { LoreEntry } from './data/story';

/** The Silent Wheel's revision-1 save lived in `save.rillwake` (C070). Until `migrateQuests` runs on load, read it through
 *  the same step mapping the migration uses, so an unmigrated in-memory save behaves identically. */
function legacyWheel(save: CharacterSave): QuestState | undefined {
  const q = save.rillwake;
  if (!q) return undefined;
  const steps = QUESTS.find((d) => d.id === 'silent_wheel')!.steps.length;
  const step = q.claimed ? steps : !q.cart ? 0 : !q.warden ? 1 : !q.ledger ? 2 : 3;
  return { revision: 2, step, claimed: q.claimed, ...(q.reward ? { reward: q.reward } : {}) };
}
export function questState(save: CharacterSave, id: string): QuestState | undefined {
  return save.quests?.[id] ?? (id === 'silent_wheel' ? legacyWheel(save) : undefined);
}
export function writeQuestState(save: CharacterSave, id: string, state: QuestState) {
  (save.quests ??= {})[id] = state;
  if (id === 'silent_wheel') delete save.rillwake;
}
export function deleteQuestState(save: CharacterSave, id: string) {
  if (save.quests) delete save.quests[id];
  if (id === 'silent_wheel') delete save.rillwake;
}
/** Bits a gather step can hold: one per listed target. */
export const gatherMask = (step: QuestStep | undefined) => step?.targets ? (1 << step.targets.length) - 1 : 0;
export const bitCount = (n: number) => { let c = 0; for (let v = n >>> 0; v; v &= v - 1) c++; return c; };
export function validQuestState(q: QuestDef, s: QuestState): boolean {
  const step = q.steps[s.step], progress = s.progress ?? 0, need = step?.count ?? 1, parts = s.parts ?? 0;
  const cycle = s.cycle ?? 0, completions = s.completions ?? (s.claimed ? 1 : 0);
  return s.revision === q.revision && Number.isInteger(s.step) && s.step >= 0 && s.step <= q.steps.length && (!s.claimed || s.step === q.steps.length)
    && Number.isSafeInteger(progress) && progress >= 0 && progress < need && (step?.kind !== 'deliver' || progress === 0)
    && Number.isInteger(parts) && parts >= 0 && (step?.targets ? parts < gatherMask(step) : parts === 0)
    && typeof s.claimed === 'boolean' && Number.isSafeInteger(cycle) && cycle >= 0 && Number.isSafeInteger(completions)
    && completions === cycle + (s.claimed ? 1 : 0) && (!!q.repeat || cycle === 0);
}
export function questCategory(q: QuestDef): QuestCategory {
  return q.category ?? (q.chapter || q.tutorial ? 'story' : 'side');
}
export function questStepText(step: QuestStep, progress = 0, parts = 0): string {
  if (step.targets) return `${questText(step.text)} (${bitCount(parts)}/${step.targets.length})`;
  return questText(step.text) + ((step.count ?? 1) > 1 ? ` (${progress}/${step.count})` : '');
}
export function questCompleted(save: CharacterSave, id: string): boolean {
  const q = QUESTS.find((q) => q.id === id), s = questState(save, id);
  return !!q && !!s && validQuestState(q, s) && (s.claimed || (s.completions ?? 0) > 0);
}
export function storyFlag(save: CharacterSave, flag: string): boolean {
  return QUESTS.some((q) => q.grantsFlags?.includes(flag) && questCompleted(save, q.id));
}
export function questAvailable(save: CharacterSave, q: QuestDef): boolean {
  return (!q.tutorial || validIntro(save.onboarding)) && q.requires.every((id) => questCompleted(save, id)) && (q.requiresFlags ?? []).every((f) => storyFlag(save, f));
}
export const questUnlocks = (q: QuestDef): string[] => [...(q.unlocks ? [q.unlocks] : []), ...(q.reward && typeof q.reward === 'object' && Array.isArray(q.reward.unlocks) ? q.reward.unlocks : [])];
export const questHasItem = (q: QuestDef): boolean => q.reward === 'magic_weapon' || !!q.reward && typeof q.reward === 'object' && q.reward.item !== undefined;
export const questHasPick = (q: QuestDef): boolean => !!q.reward && typeof q.reward === 'object' && q.reward.item === 'magic_weapon' && !!q.reward.pick;
export function zoneUnlocked(save: CharacterSave, zone: string): boolean {
  return QUESTS.filter((q) => questUnlocks(q).includes(zone)).every((q) => questCompleted(save, q.id));
}
/** Existing completed-route records keep access even when their old reward carried no XP. */
export function zoneLevelAllowed(save: CharacterSave, zone: string): boolean {
  const gates = QUESTS.filter((q) => questUnlocks(q).includes(zone));
  return save.level >= (ZONES[zone]?.levelBand[0] ?? Infinity) || gates.length > 0 && gates.every((q) => questCompleted(save, q.id));
}
export function questContact(target: QuestTarget): string {
  return ADVENTURES[target.zone]?.interactions.find((i) => i.id === target.target)?.name
    ?? (target.zone === town.id ? town.npcs.find((n) => n.id === target.target)?.name : undefined) ?? target.target;
}

// ─────────── World states (docs/rework/quests/DESIGN.md §7) ───────────
export function worldStateOn(save: CharacterSave | null | undefined, key: string): boolean {
  const c = WORLD_STATES[key];
  if (!c || !save) return false;
  const q = QUESTS.find((d) => d.id === c.quest), s = questState(save, c.quest);
  if (!q || !s || !validQuestState(q, s)) return false;
  const done = s.claimed || (s.completions ?? 0) > 0;
  if (c.until === 'done' && done) return false;
  if (c.done) return done;
  return done || s.step >= (c.step ?? q.steps.length);
}
/** Where a contact stands for this player, and whether it is there at all (phasing: `appear` / `moveTo`). */
export function contactSpot(a: AdventureData | undefined, id: string, save?: CharacterSave | null): { x: number; y: number; radius: number; present: boolean } | undefined {
  const i = a?.interactions.find((c) => c.id === id);
  if (!i) return undefined;
  const moved = i.moves?.find((m) => worldStateOn(save, m.key));
  return { x: moved?.x ?? i.x, y: moved?.y ?? i.y, radius: i.radius, present: !i.when || worldStateOn(save, i.when) };
}

export function loreAvailable(save: CharacterSave, entry: LoreEntry): boolean {
  const q = QUESTS.find((q) => q.id === entry.quest), s = questState(save, entry.quest);
  return !!q && !!s && validQuestState(q, s) && (questCompleted(save, q.id) || s.step >= entry.afterStep);
}
export type QuestStatus = 'active' | 'available' | 'complete' | 'locked' | 'unavailable';
export function questStatus(save: CharacterSave, q: QuestDef): QuestStatus {
  const s = questState(save, q.id);
  return s && !validQuestState(q, s) ? 'unavailable' : s?.claimed ? 'complete' : s ? 'active' : questAvailable(save, q) ? 'available' : 'locked';
}
const live = (save: CharacterSave, q: QuestDef) => { const s = questState(save, q.id); return s && validQuestState(q, s) && !s.claimed ? s : undefined; };
/** Targets of the current step that are still to do (a gather lists every unfinished object, in order). */
export function stepTargets(step: QuestStep, parts = 0): string[] {
  if (!step.targets) return [step.target];
  const left = step.targets.filter((_, i) => !(parts & (1 << i)));
  return step.ordered ? left.slice(0, 1) : left;
}
export interface QuestMark { glyph: '!' | '?' | '◆' | '+'; cat: QuestCategory }
const CAT_ORDER: Record<QuestCategory, number> = { story: 0, side: 1, lesson: 2 };
/** Overhead / map marker for a contact: turn-in `?` beats offer `!` (lessons offer `+`) beats an objective `◆`; inside
 *  each, story beats side beats lesson (DESIGN.md §2). Objectives show for every tracked (not hidden) quest. */
export function questMarker(save: CharacterSave, zone: string, target: string): QuestMark | undefined {
  const same = (p: QuestTarget) => p.zone === zone && p.target === target;
  const candidates = QUESTS.filter((q) => questAvailable(save, q)).sort((a, b) => CAT_ORDER[questCategory(a)] - CAT_ORDER[questCategory(b)]);
  const ready = candidates.find((q) => { const s = live(save, q); return s && s.step === q.steps.length && same(q.finish); });
  if (ready) return { glyph: '?', cat: questCategory(ready) };
  const offer = candidates.find((q) => { const s = questState(save, q.id); return (!s || s.claimed && q.repeat) && same(q.start); });
  if (offer) return { glyph: questCategory(offer) === 'lesson' ? '+' : '!', cat: questCategory(offer) };
  const hidden = new Set(save.questHidden ?? []);
  const step = candidates.find((q) => { const s = live(save, q); const st = s && q.steps[s.step]; return st && !hidden.has(q.id) && st.zone === zone && stepTargets(st, s.parts).includes(target); });
  if (step) return { glyph: '◆', cat: questCategory(step) };
  return undefined;
}
export function questObjective(save: CharacterSave, q: QuestDef): QuestTarget & { text: string; targets?: string[] } {
  const s = questState(save, q.id);
  if (!s) return { ...q.start, text: `${questText('quest.journal.start')}: ${questContact(q.start)}` };
  if (!validQuestState(q, s)) return { ...q.start, text: questText('quest.journal.unavailable') };
  if (s.claimed) return { ...q.finish, text: questText('quest.journal.complete') };
  const step = q.steps[s.step];
  if (!step) return { ...q.finish, text: `${questText('quest.journal.return')}: ${questContact(q.finish)}` };
  const targets = stepTargets(step, s.parts);
  return { zone: step.zone, target: targets[0] ?? step.target, text: questStepText(step, s.progress ?? 0, s.parts ?? 0), ...(step.targets ? { targets } : {}) };
}
/** Accepted, unclaimed, valid quests in tracker order before distance: ready to turn in and story first. */
export function activeQuests(save: CharacterSave): QuestDef[] {
  return QUESTS.filter((q) => questAvailable(save, q) && (!q.tutorial || save.onboarding?.status === 'active' || !!questState(save, q.id)) && !!live(save, q));
}
/** The next story quest to pick up when no story quest is in progress (FFXIV-style "next story step", R13). */
export function nextStoryQuest(save: CharacterSave): QuestDef | undefined {
  if (activeQuests(save).some((q) => questCategory(q) === 'story')) return undefined;
  return QUESTS.find((q) => questCategory(q) === 'story' && !q.repeat && !questState(save, q.id) && questAvailable(save, q) && (!q.tutorial || save.onboarding?.status === 'active'));
}
/** HUD tracker rows (DESIGN.md §3): every accepted quest that is not hidden, focus first, then quests with an objective in
 *  `zone`, then ready to turn in, then the rest; story before side before lesson. The client sorts by distance within a
 *  group. The next story step is prepended when no story quest is running. */
export function trackerQuests(save: CharacterSave, zone?: string): QuestDef[] {
  const hidden = new Set(save.questHidden ?? []), focus = save.trackedQuest;
  const group = (q: QuestDef) => {
    const s = questState(save, q.id)!, o = questObjective(save, q);
    return q.id === focus ? 0 : o.zone === zone && s.step < q.steps.length ? 1 : s.step === q.steps.length ? 2 : 3;
  };
  const rows = activeQuests(save).filter((q) => !hidden.has(q.id)).sort((a, b) => group(a) - group(b) || CAT_ORDER[questCategory(a)] - CAT_ORDER[questCategory(b)]);
  const next = nextStoryQuest(save);
  return next ? [next, ...rows] : rows;
}
/** The focused quest drives the floor trail and the big minimap diamond: the explicit pin, else the first tracker row.
 *  An explicit empty pin turns the trail off. */
export function trackedQuest(save: CharacterSave): QuestDef | undefined {
  if (save.trackedQuest === '') return undefined;
  const rows = trackerQuests(save);
  return rows.find((q) => q.id === save.trackedQuest) ?? rows.find((q) => !!questState(save, q.id)) ?? rows[0];
}
export function questAtTarget(save: CharacterSave, zone: string, target: string): QuestDef | undefined {
  const candidates = QUESTS.filter((q) => questAvailable(save, q));
  const matches = (t: QuestTarget) => t.zone === zone && t.target === target;
  return candidates.find((q) => { const s = live(save, q), st = s && q.steps[s.step]; return !!s && (st ? st.zone === zone && stepTargets(st, s.parts).includes(target) : matches(q.finish)); })
    ?? candidates.find((q) => (!questState(save, q.id) || q.repeat && questState(save, q.id)?.claimed) && matches(q.start))
    ?? candidates.find((q) => q.steps.some((s) => matches(s) || !!s.targets?.includes(target)))
    ?? candidates.find((q) => matches(q.start));
}
/** A quest step whose current objective is to use this object (direct Investigate without a window, DESIGN.md §8). */
export function objectStepAt(save: CharacterSave, zone: string, target: string): { q: QuestDef; step: QuestStep } | undefined {
  for (const q of QUESTS) {
    const s = live(save, q), step = s && q.steps[s.step];
    if (s && step?.kind === 'interact' && step.zone === zone && (step.targets ? step.targets.includes(target) : step.target === target) && questAvailable(save, q)) return { q, step };
  }
  return undefined;
}
export function questPoint(map: MapData, target: QuestTarget, save?: CharacterSave, from?: { x: number; y: number }, targets?: string[]): { x: number; y: number } | undefined {
  if (target.zone === 'rift') {
    if (map.zone === 'rift') return undefined; // Existing hunt/Guardian display owns live rift guidance.
    const obelisk = town.npcs.find((n) => n.role === 'obelisk')!;
    return questPoint(map, { zone: town.id, target: obelisk.id }, save);
  }
  if (map.zone !== target.zone) return nextTravelPoint(map, target.zone, save ? (id) => zoneUnlocked(save, id) : undefined);
  // A zone-wide hunt has no single place; point at the first ordinary hunting ground so the map and trail still help.
  if (target.target === ZONE_WIDE) return map.adventure?.encounters.find((e) => !e.members.some((m) => m.questTarget || m.combat));
  if (targets && targets.length > 1 && from) {
    const spots = targets.map((t) => questPoint(map, { zone: target.zone, target: t }, save)).filter((p): p is { x: number; y: number } => !!p);
    return spots.sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
  }
  const stage = map.adventure?.dungeon?.stages.find((s) => s.id === target.target) ?? map.adventure?.events?.find((s) => s.id === target.target);
  const id = stage?.trigger ?? target.target, spot = contactSpot(map.adventure, id, save);
  return (spot ? { x: spot.x, y: spot.y } : undefined)
    ?? map.town?.npcs.find((i) => i.id === target.target)
    ?? map.adventure?.encounters.find((e) => e.id === target.target)
    ?? map.adventure?.locations.find((l) => l.id === target.target);
}
