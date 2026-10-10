import type { QuestDef } from '../questTypes';
import { ZONES } from './zones';

/**
 * Optional quests of the rebuilt zones (docs/rework/worlds/DESIGN.md §2). Rewards follow the camp-contract gold formula
 * (`campContracts.ts`): required work units × the mean gold pile at the zone's middle level × 1.5 (the hunt premium).
 * No XP: story XP stays exactly as calibrated in docs/rework/BALANCE.md (DECISIONS D-W03).
 */
const pile = (level: number) => (4 + 2.5 * level) * Math.pow(1.06, level);
const gold = (zone: string, units: number) => { const [lo, hi] = ZONES[zone].levelBand; return Math.round(units * pile((lo + hi) / 2) * 1.5); };
const rw = 'rillwake_crossing', orren = { zone: rw, target: 'tender' };

export const WORLD_QUESTS: readonly QuestDef[] = [
  {
    id: 'lost_survey', revision: 1, title: 'world.lost_survey.title', offer: 'world.lost_survey.offer', complete: 'world.lost_survey.complete',
    rewardText: 'world.reward.gold', start: orren, finish: orren, requires: ['silent_wheel'], reward: { gold: gold(rw, 14) },
    steps: [
      { id: 'camp', kind: 'interact', zone: rw, target: 'party_camp', text: 'world.lost_survey.camp' },
      { id: 'journal', kind: 'interact', zone: rw, target: 'party_journal', text: 'world.lost_survey.journal' },
      { id: 'brackjaw', kind: 'kill', zone: rw, target: 'brackjaw', text: 'world.lost_survey.brackjaw' },
    ],
  },
];
