import type { QuestCategory, QuestDef, QuestReward, QuestStep, QuestTarget } from '../questTypes';
import type { QuestMessageKey } from './questMessages';

/** Step shorthand: [id, kind, target, extra]. The zone defaults to the quest's zone; text is `q.<quest>.<step>`. */
export type StepSpec = [id: string, kind: QuestStep['kind'], target: string, extra?: Partial<QuestStep>];
export const contact = (zone: string, target: string): QuestTarget => ({ zone, target });
const key = (s: string) => s as QuestMessageKey;

/** One authored quest with uniform message keys `q.<id>.title|offer|complete|<step id>` (docs/rework/quests/DESIGN.md). */
export function quest(o: {
  id: string; revision?: number; category?: QuestCategory; chapter?: string; tutorial?: boolean; zone: string;
  start: QuestTarget; finish: QuestTarget; requires?: string[]; steps: StepSpec[]; reward: QuestReward; rewardText?: string;
  unlocks?: string; grantsFlags?: string[]; requiresFlags?: string[];
}): QuestDef {
  const reward = o.reward;
  const rewardText = o.rewardText ?? (reward.pick ? 'q.reward.pick' : reward.item === 'magic_weapon' ? 'quest.reward.weapon' : reward.gold && !reward.xp ? 'world.reward.gold' : 'q.reward.story');
  return {
    id: o.id, revision: o.revision ?? 1, ...(o.category ? { category: o.category } : {}), ...(o.chapter ? { chapter: o.chapter } : {}), ...(o.tutorial ? { tutorial: true } : {}),
    title: key(`q.${o.id}.title`), offer: key(`q.${o.id}.offer`), complete: key(`q.${o.id}.complete`), rewardText: key(rewardText),
    start: o.start, finish: o.finish, requires: o.requires ?? [], reward,
    ...(o.unlocks ? { unlocks: o.unlocks } : {}), ...(o.grantsFlags ? { grantsFlags: o.grantsFlags } : {}), ...(o.requiresFlags ? { requiresFlags: o.requiresFlags } : {}),
    steps: o.steps.map(([id, kind, target, extra]) => ({ id, kind, zone: o.zone, target, text: key(`q.${o.id}.${id}`), ...(extra ?? {}) })),
  };
}
