// Save migration for the quest rework (docs/rework/quests/DESIGN.md, LOG.md "Save"). Runs inside normalizeSave on every
// load; idempotent (acts only on the old revision). Rule: objectives a character already finished stay finished; steps the
// rework added *before* finished work count as done, and a quest that was ready to turn in stays ready to turn in.
import type { CharacterSave } from './types';
import { QUESTS } from './data/quests';
import { ZONES } from './data/zones';
import { questState, writeQuestState } from './quests';

/** old revision → new revision; `map[i]` is the new step for old step i (index old.steps.length = "objectives done"). */
interface StepMigration { id: string; from: number; to: number; map: number[]; parts?: Record<number, number> }
export const QUEST_MIGRATIONS: readonly StepMigration[] = [
  { id: 'lost_survey', from: 1, to: 2, map: [0, 0, 1, 3], parts: { 1: 0b01 } },
  { id: 'high_water', from: 1, to: 2, map: [0, 0, 3] },
  { id: 'under_spillway', from: 1, to: 2, map: [1, 2, 3, 4] },
  { id: 'silt_gears', from: 1, to: 2, map: [0, 2, 3, 4] },
  { id: 'stone_road', from: 1, to: 2, map: [1, 2, 3, 5] },
  { id: 'true_measure', from: 1, to: 2, map: [0, 0, 1, 2], parts: { 1: 0b01 } },
  { id: 'untended_fires', from: 1, to: 2, map: [1, 2, 3, 4] },
  { id: 'last_draw', from: 1, to: 2, map: [1, 2, 3, 4] },
  { id: 'salt_bound', from: 1, to: 2, map: [0, 1, 3] },
  { id: 'bitter_measure', from: 1, to: 2, map: [0, 1, 3] },
  { id: 'neris_tally', from: 1, to: 2, map: [0, 0, 1, 2], parts: { 1: 0b01 } },
  { id: 'tallis_flags', from: 1, to: 2, map: [0, 2, 3, 4] },
  { id: 'ward_gate', from: 1, to: 2, map: [0, 1, 3] },
  { id: 'mera_ledger', from: 1, to: 2, map: [0, 0, 1, 2, 3], parts: { 1: 0b01 } },
];

/** Gold the deleted contracts paid (same formulas as the removed `campContracts.ts` / `worldQuests.ts`), so a contract that
 *  was finished but not turned in is paid out instead of lost. Unfinished contracts carried no lasting progress. */
const pile = (level: number) => (4 + 2.5 * level) * Math.pow(1.06, level);
const zoneGold = (zone: string, units: number, premium: number) => { const [lo, hi] = ZONES[zone].levelBand; return Math.round(units * pile((lo + hi) / 2) * premium); };
const CAMP: [string, string, number, number][] = [
  ['iven', 'cairnspill_terraces', 12, 4], ['kessa', 'cinderwash_kilns', 12, 5], ['venn', 'kilnwatch_crown', 10, 4], ['sera', 'sablefen_causeway', 10, 4],
  ['neris', 'saltwind_pans', 10, 4], ['tallis', 'shiverline_escarpment', 10, 4], ['mera', 'beaconbreak_ward', 10, 4],
];
const EVENT: [string, string][] = [
  ['shallows', 'rillwake_crossing'], ['weir', 'bracken_sluice'], ['rockfall', 'cairnspill_terraces'], ['flare', 'cinderwash_kilns'], ['chimney', 'kilnwatch_crown'],
  ['tide', 'sablefen_causeway'], ['boil', 'saltwind_pans'], ['gale', 'shiverline_escarpment'], ['riot', 'beaconbreak_ward'],
];
export const RETIRED_CONTRACTS: Readonly<Record<string, { steps: number; gold: number }>> = {
  contract_road: { steps: 1, gold: 54 }, contract_bank: { steps: 1, gold: 64 }, contract_alarm: { steps: 1, gold: 108 },
  ...Object.fromEntries(CAMP.flatMap(([id, zone, sweep, hunt]) => [
    [`contract_${id}_sweep`, { steps: 1, gold: zoneGold(zone, sweep, 1) }], [`contract_${id}_hunt`, { steps: 1, gold: zoneGold(zone, hunt, 1.5) }]])),
  ...Object.fromEntries(EVENT.map(([id, zone]) => [`contract_${id}`, { steps: 1, gold: zoneGold(zone, 8, 1.5) }])),
};

/** Returns a short list of what changed (for logs/tests); mutates the save. */
export function migrateQuests(save: CharacterSave): string[] {
  const changes: string[] = [];
  // The Silent Wheel moves from the C070 `rillwake` record into `quests` (revision 2 adds "free the wheel brake").
  if (save.rillwake && !save.quests?.silent_wheel) {
    const state = questState(save, 'silent_wheel');
    if (state) { writeQuestState(save, 'silent_wheel', state); changes.push('silent_wheel: legacy record → quests'); }
  } else if (save.rillwake) { delete save.rillwake; changes.push('silent_wheel: dropped duplicate legacy record'); }
  const quests = save.quests;
  if (quests && typeof quests === 'object') {
    for (const m of QUEST_MIGRATIONS) {
      const s = quests[m.id], def = QUESTS.find((q) => q.id === m.id);
      if (!s || !def || s.revision !== m.from || !Number.isInteger(s.step)) continue;
      const old = Math.max(0, Math.min(m.map.length - 1, s.step)), step = s.claimed ? def.steps.length : Math.min(def.steps.length, m.map[old]);
      const parts = !s.claimed && m.parts?.[old] && def.steps[step]?.targets ? m.parts[old] : undefined;
      const { progress: _p, parts: _q, ...rest } = s;
      quests[m.id] = { ...rest, revision: m.to, step, ...(parts ? { parts } : {}), ...(step === s.step && _p ? { progress: _p } : {}) };
      changes.push(`${m.id}: r${m.from} step ${s.step} → r${m.to} step ${step}`);
    }
    for (const [id, c] of Object.entries(RETIRED_CONTRACTS)) {
      const s = quests[id];
      if (!s) continue;
      if (!s.claimed && s.step === c.steps && Number.isSafeInteger(save.gold + c.gold)) { save.gold += c.gold; changes.push(`${id}: finished contract paid ${c.gold} gold`); }
      delete quests[id]; changes.push(`${id}: retired (bounty boards replace contracts)`);
    }
  }
  const known = new Set(QUESTS.map((q) => q.id));
  if (save.trackedQuest && !known.has(save.trackedQuest)) { delete save.trackedQuest; changes.push('tracked quest retired'); }
  if (save.questHidden !== undefined) {
    const hidden = Array.isArray(save.questHidden) ? [...new Set(save.questHidden.filter((id) => typeof id === 'string' && known.has(id)))].slice(0, 128) : [];
    if (hidden.length) save.questHidden = hidden; else delete save.questHidden;
  }
  return changes;
}
