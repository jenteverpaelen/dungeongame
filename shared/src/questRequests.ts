import type { QuestDef, QuestState } from './questTypes';

/** Only wire-safe values: MessagePack retains undefined, which command receipts reject. */
export function questRequest(q:QuestDef,state:QuestState|undefined,target:string|undefined,action:string):Record<string,unknown> {
  const step=state&&q.steps[state.step];
  return {action,quest:q.id,revision:q.revision,cycle:(state?.cycle??0)+(action==='accept'&&state?.claimed?1:0),
    ...(target?{target}:{}),...(step?{step:step.id}:{})};
}
