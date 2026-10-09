import type { CharacterSave } from './types';
import type { QuestDef, QuestState } from './questTypes';
import { questHasWeapon, writeQuestState } from './quests';
import { addToInventory } from './character';
import { addXp, xpToNext } from './progression';
import { MAX_LEVEL } from './constants';

/** Existing level-cap XP bar is the largest supported single authored award (L101). */
export const MAX_QUEST_XP=xpToNext(MAX_LEVEL);
export function questRewardError(q:QuestDef):string|undefined {
  const r=q.reward;
  if(typeof r==='string')return r==='magic_weapon'||r==='passage'?undefined:'Unknown reward';
  if(!r||typeof r!=='object'||Array.isArray(r))return 'Invalid reward';
  if(Object.keys(r).some(k=>!['xp','gold','item','unlocks'].includes(k)))return 'Unknown reward field';
  for(const [key,max] of [['xp',MAX_QUEST_XP],['gold',Number.MAX_SAFE_INTEGER]] as const) {
    if(r[key]!==undefined&&(!Number.isSafeInteger(r[key])||r[key]!<0||r[key]!>max))return `Invalid ${key} award`;
  }
  if(r.item!==undefined&&r.item!=='magic_weapon'&&r.item!=='starter_upgrade')return 'Unsupported item reward';
  if(r.unlocks!==undefined&&(!Array.isArray(r.unlocks)||r.unlocks.some(id=>typeof id!=='string')))return 'Invalid unlock reward';
}

/** Prepare all owned state before committing any field. Full bags/overflow leave the live save intact. */
export function planQuestReward(save:CharacterSave,q:QuestDef,state:QuestState):{save:CharacterSave;levels:number;paragons:number}|{error:string} {
  const invalid=questRewardError(q);if(invalid)return {error:invalid};
  if(state.claimed||state.step!==q.steps.length)return {error:'Finish the objectives before claiming'};
  const cycle=state.cycle??0;
  if(!Number.isSafeInteger(cycle+1))return {error:'Quest history is full'};
  const reward=typeof q.reward==='object'?q.reward:{};
  const gold=save.gold+(reward.gold??0);
  if(!Number.isSafeInteger(gold)||gold<0)return {error:'This reward would exceed your gold capacity'};
  const next=structuredClone(save);
  if(questHasWeapon(q)) {
    if(!state.reward)return {error:'Your reserved reward could not be read'};
    if([...next.inventory,...next.stash,...Object.values(next.equipment)].some(i=>i?.id===state.reward!.id))return {error:'This reward is already owned'};
    if(addToInventory(next,structuredClone(state.reward))<0)return {error:'Make room in your inventory, then speak with the quest giver again'};
  }
  next.gold=gold;
  const xp=addXp(next,reward.xp??0);
  if(!Number.isSafeInteger(next.paragon.level)||!Number.isSafeInteger(next.skillPoints)||!Number.isFinite(next.paragon.xp))return {error:'This reward would exceed your progression capacity'};
  // Once claimed the item belongs only to inventory/equipment/stash, not a second stored copy.
  const {reward:_reserved,...history}=state;
  writeQuestState(next,q.id,{...history,claimed:true,completions:cycle+1});
  if(next.trackedQuest===q.id)delete next.trackedQuest;
  return {save:next,...xp};
}
