import type { QuestDef } from '../questTypes';
import { storyMainXp, storyXp } from '../storyBudget';
import { MIDGAME_QUESTS, MIDGAME_GIFTS } from './midgameQuests';
import { WORKSHOP_QUESTS } from './workshopQuests';
import { WORLD_QUESTS } from './worldQuests';
import { contact, quest } from './questKit';
export { storyXp } from '../storyBudget';

// Act I (docs/rework/quests/DESIGN.md §4, LOG.md "Quest list"). Each zone: the story step(s) and a side story offered
// together at the hub, hand-over talks into the next hub, a repair (hold) that visibly changes the world.
const RW = 'rillwake_crossing', BR = 'bracken_sluice', PW = 'reedvault_pumpworks', CS = 'cairnspill_terraces', CW = 'cinderwash_kilns', KW = 'kilnwatch_crown';
const orren = contact(RW, 'tender'), hollis = contact(BR, 'foreman'), iven = contact(CS, 'surveyor'), kessa = contact(CW, 'firekeeper'), venn = contact(KW, 'watchkeeper');

export const ACT_ONE: readonly QuestDef[] = [
  quest({ id: 'first_road', tutorial: true, zone: RW, start: orren, finish: orren, reward: { item: 'starter_upgrade' }, rewardText: 'quest.firstroad.reward',
    steps: [['slime', 'kill', 'road', { monsterType: 'bog_slime' }]] }),
  // Rillwake: the wheel, the survey party, the signal fire. Orren walks up to the mill once the wheel turns (rw_wheel).
  quest({ id: 'silent_wheel', revision: 2, chapter: 'water_road', zone: RW, start: orren, finish: orren, grantsFlags: ['mill_names_recovered'],
    reward: { item: 'magic_weapon', pick: true, xp: storyMainXp(1, 3) },
    steps: [['cart', 'interact', 'cart'], ['warden', 'kill', 'mill'], ['ledger', 'interact', 'ledger'], ['brake', 'interact', 'mill_brake', { hold: 2500 }]] }),
  quest({ id: 'high_water', revision: 2, chapter: 'water_road', zone: RW, start: orren, finish: orren, requires: ['silent_wheel'], unlocks: BR,
    reward: { xp: storyMainXp(3, 4) }, rewardText: 'quest.highwater.reward',
    steps: [['survey', 'interact', 'survey'], ['alarm', 'wave', 'survey_alarm'], ['fire', 'interact', 'overlook_fire', { hold: 2000 }]] }),
  // Bracken: hand-over to Hollis, the floodgate drains the basin (br_drained) and Hollis walks up to the forecourt.
  quest({ id: 'under_spillway', revision: 2, chapter: 'water_road', zone: BR, start: orren, finish: hollis, requires: ['high_water'], unlocks: PW,
    reward: { item: 'magic_weapon', pick: true, xp: storyMainXp(4, 7) },
    steps: [['hollis', 'talk', 'foreman'], ['approach', 'reach', 'forecourt'], ['keeper', 'kill', 'keeper'], ['gate', 'interact', 'floodgate', { hold: 3000 }]] }),
  quest({ id: 'pressure_below', chapter: 'water_road', zone: PW, start: hollis, finish: hollis, requires: ['under_spillway'], unlocks: CS, grantsFlags: ['waterworks_repaired'],
    reward: { item: 'magic_weapon', pick: true, xp: storyXp(7, 9) },
    steps: [['west', 'wave', 'west'], ['east', 'wave', 'east'], ['heart', 'wave', 'heart'], ['record', 'interact', 'work_record']] }),
  // The upper road: Iven, Kessa and Venn each move to where the work ended.
  quest({ id: 'stone_road', revision: 2, chapter: 'upper_road', zone: CS, start: hollis, finish: iven, requires: ['pressure_below'], unlocks: CW, grantsFlags: ['stone_road_open'],
    reward: { item: 'magic_weapon', pick: true, xp: storyMainXp(9, 12) },
    steps: [['iven', 'talk', 'surveyor'], ['cutting', 'reach', 'cutting'], ['foreman', 'kill', 'foreman'], ['dispatch', 'interact', 'dispatch'], ['signal', 'interact', 'haul_signal', { hold: 2000 }]] }),
  quest({ id: 'untended_fires', revision: 2, chapter: 'upper_road', zone: CW, start: iven, finish: kessa, requires: ['stone_road'], unlocks: KW, grantsFlags: ['kiln_draught_closed'],
    reward: { item: 'magic_weapon', pick: true, xp: storyMainXp(12, 16) },
    steps: [['kessa', 'talk', 'firekeeper'], ['tally', 'interact', 'tally'], ['stoker', 'kill', 'stoker'], ['draught', 'interact', 'draught', { hold: 3000 }]] }),
  quest({ id: 'last_draw', revision: 2, chapter: 'upper_road', zone: KW, start: kessa, finish: venn, requires: ['untended_fires'], unlocks: 'sablefen_causeway', grantsFlags: ['frontier_reopened'],
    reward: { item: 'magic_weapon', pick: true, xp: storyMainXp(16, 20) },
    steps: [['venn', 'talk', 'watchkeeper'], ['watch', 'interact', 'watchlog'], ['heart', 'kill', 'heart'], ['seal', 'interact', 'seal', { hold: 3000 }]] }),
];
export const QUESTS: readonly QuestDef[] = [
  ...ACT_ONE,
  ...MIDGAME_QUESTS,
  ...MIDGAME_GIFTS,
  ...WORKSHOP_QUESTS,
  ...WORLD_QUESTS,
];
export const questById = (id: string) => QUESTS.find(q => q.id === id);
