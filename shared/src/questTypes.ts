import type { Item, Rarity } from './types';
import type { QuestMessageKey } from './data/questMessages';

export interface QuestTarget { zone: string; target: string }
export interface QuestStep extends QuestTarget {
  id: string;
  text: QuestMessageKey;
  kind: 'interact' | 'talk' | 'kill' | 'reach' | 'collect' | 'service' | 'wave' | 'deliver' | 'rift';
  /** Successful server events required; omitted means one. */
  count?: number;
  monsterType?: string;
  monsterFamily?: import('./data/monsters').MonsterDef['family'];
  /** Kill objectives default to living nearby witnesses; never retroactive. */
  credit?: 'nearby' | 'killer';
  itemBase?: string;
  /** Delivery requires an exact base and rarity; it never chooses a player's gear. */
  itemRarity?: Rarity;
  /** Existing difficulty index, not a timed-rift rank. */
  minDifficulty?: number;
  serviceOp?: QuestServiceOp;
}
/** Operations with a real successful mutation; panel opens and power re-selection are excluded. */
export const QUEST_SERVICE_OPS=['salvage','salvageAll','fuseGem','enchantPick','upgrade','transmute','extract','reforge','socket','insertGem','removeGem'] as const;
export type QuestServiceOp=typeof QUEST_SERVICE_OPS[number];
export interface QuestReward {
  xp?: number;
  gold?: number;
  item?: 'magic_weapon';
  unlocks?: string[];
}
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
  reward: 'magic_weapon' | 'passage' | QuestReward;
  unlocks?: string;
  chapter?: string;
  requiresFlags?: string[];
  grantsFlags?: string[];
  /** Absent means once. A repeat is explicitly accepted again at the giver. */
  repeat?: 'on_return';
}
export interface QuestState {
  revision: number;
  step: number;
  claimed: boolean;
  /** Partial progress within the current objective; omitted in older saves. */
  progress?: number;
  reward?: Item;
  /** Bounded history: one counter, not an ever-growing list of completions. */
  completions?: number;
  cycle?: number;
}
