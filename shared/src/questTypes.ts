import type { Item } from './types';
import type { QuestMessageKey } from './data/questMessages';

export interface QuestTarget { zone: string; target: string }
export interface QuestStep extends QuestTarget {
  id: string;
  text: QuestMessageKey;
  kind: 'interact' | 'kill' | 'reach' | 'collect' | 'service';
  /** Successful server events required; omitted means one. */
  count?: number;
  monsterType?: string;
  itemBase?: string;
  serviceOp?: QuestServiceOp;
}
/** Operations with a real successful mutation; panel opens and power re-selection are excluded. */
export const QUEST_SERVICE_OPS=['salvage','salvageAll','fuseGem','enchantPick','upgrade','transmute','extract','reforge','socket','insertGem','removeGem'] as const;
export type QuestServiceOp=typeof QUEST_SERVICE_OPS[number];
export interface QuestDef {
  id: string;
  revision: number;
  title: QuestMessageKey;
  offer: QuestMessageKey;
  complete: QuestMessageKey;
  rewardText: QuestMessageKey;
  start: QuestTarget;
  finish: QuestTarget;
  requires: string[];
  steps: QuestStep[];
  reward: 'magic_weapon' | 'passage';
  unlocks?: string;
}
export interface QuestState {
  revision: number;
  step: number;
  claimed: boolean;
  /** Partial progress within the current objective; omitted in older saves. */
  progress?: number;
  reward?: Item;
}
