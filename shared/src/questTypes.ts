import type { Item } from './types';
import type { QuestMessageKey } from './data/questMessages';

export interface QuestTarget { zone: string; target: string }
export interface QuestStep extends QuestTarget {
  id: string;
  text: QuestMessageKey;
  kind: 'interact' | 'kill' | 'reach';
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
  reward: 'magic_weapon' | 'passage';
  unlocks?: string;
}
export interface QuestState {
  revision: number;
  step: number;
  claimed: boolean;
  reward?: Item;
}
