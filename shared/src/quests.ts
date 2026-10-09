import { QUESTS } from './data/quests';
import { questText } from './data/questMessages';
import type { CharacterSave } from './types';
import type { QuestDef, QuestState, QuestTarget } from './questTypes';
import type { MapData } from './mapgen';

/** C070 remains the sole owner of this quest's save shape; never duplicate its reward. */
export function questState(save: CharacterSave, id: string): QuestState | undefined {
  if (id !== 'silent_wheel') return save.quests?.[id];
  const q=save.rillwake;
  return q && {revision:q.revision, step:!q.cart?0:!q.warden?1:!q.ledger?2:3, claimed:q.claimed, reward:q.reward};
}
export function writeQuestState(save: CharacterSave, id: string, state: QuestState) {
  if(id==='silent_wheel') {
    save.rillwake={revision:1,cart:state.step>=1,warden:state.step>=2,ledger:state.step>=3,claimed:state.claimed,...(state.reward?{reward:state.reward}:{})};
  } else (save.quests??={})[id]=state;
}
export function validQuestState(q: QuestDef, s: QuestState): boolean {
  return s.revision===q.revision && Number.isInteger(s.step) && s.step>=0 && s.step<=q.steps.length && (!s.claimed || s.step===q.steps.length);
}
export function questCompleted(save:CharacterSave,id:string):boolean {
  const q=QUESTS.find(q=>q.id===id),s=questState(save,id);
  return !!q && !!s && validQuestState(q,s) && s.claimed;
}
export function questAvailable(save:CharacterSave,q:QuestDef):boolean { return q.requires.every(id=>questCompleted(save,id)); }
export function zoneUnlocked(save:CharacterSave,zone:string):boolean {
  return QUESTS.filter(q=>q.unlocks===zone).every(q=>questCompleted(save,q.id));
}
export function questObjective(save:CharacterSave,q:QuestDef):QuestTarget & {text:string} {
  const s=questState(save,q.id);
  if(!s)return {...q.start,text:questText('quest.journal.start')};
  if(!validQuestState(q,s))return {...q.start,text:questText('quest.journal.unavailable')};
  if(s.claimed)return {...q.finish,text:questText('quest.journal.complete')};
  const step=q.steps[s.step];
  return step?{...step,text:questText(step.text)}:{...q.finish,text:questText('quest.journal.return')};
}
export function trackedQuest(save:CharacterSave):QuestDef|undefined {
  const candidates=QUESTS.filter(q=>questAvailable(save,q)&&!questCompleted(save,q.id));
  return candidates.find(q=>q.id===save.trackedQuest)??candidates.find(q=>questState(save,q.id))??candidates[0];
}
export function questAtTarget(save:CharacterSave,zone:string,target:string):QuestDef|undefined {
  const candidates=QUESTS.filter(q=>questAvailable(save,q));
  const matches=(t:QuestTarget)=>t.zone===zone&&t.target===target;
  return candidates.find(q=>questState(save,q.id)&&!questCompleted(save,q.id)&&matches(questObjective(save,q)))
    ??candidates.find(q=>!questState(save,q.id)&&matches(q.start))
    ??candidates.find(q=>q.steps.some(matches))
    ??candidates.find(q=>matches(q.start));
}
export function questPoint(map:MapData,target:QuestTarget):{x:number;y:number}|undefined {
  if(map.zone!==target.zone)return map.portals.find(p=>p.to===target.zone);
  return map.adventure?.interactions.find(i=>i.id===target.target)
    ??map.adventure?.encounters.find(e=>e.id===target.target)
    ??map.adventure?.locations.find(l=>l.id===target.target);
}
