import { QUESTS, questById } from '../../shared/src/data/quests';
import { questText } from '../../shared/src/data/questMessages';
import { questAvailable, questObjective, questState, validQuestState, writeQuestState } from '../../shared/src/quests';
import { QUEST_SERVICE_OPS, type QuestDef, type QuestState, type QuestTarget } from '../../shared/src/questTypes';
import { SERVICE_ROLE } from '../../shared/src/townServices';
import type { CmdOp } from '../../shared/src/protocol';
import type { CharacterSave, Item } from '../../shared/src/types';
import { addToInventory } from '../../shared/src/character';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import { XP_SHARE_RANGE } from './config';
import { fail, ok, type CmdResult } from './world';
import type { Session } from './net/session';
import type { Instance } from './sim/instance';
import type { Mob, Player } from './sim/types';

function near(s:Session, target:QuestTarget):boolean {
  const inst=s.rec?.inst;
  if(!inst || inst.map.zone!==target.zone)return false;
  const spot=inst.map.adventure?.interactions.find(i=>i.id===target.target);
  return !!spot && inst.canInteract(s,spot.x,spot.y,spot.radius);
}
function reserve(save:CharacterSave,q:QuestDef,state:QuestState) {
  if(state.step!==q.steps.length || q.reward!=='magic_weapon' || state.reward)return;
  state.reward=generateItem(new Rng((Math.random()*0xffffffff)>>>0),{
    ilvl:save.level,classId:save.classId,rarity:'magic',smartChance:1,
    base:save.classId==='mage'?'staff':save.classId==='ranger'?'bow':'sword',
  });
}
function advanceState(save:CharacterSave,q:QuestDef,state:QuestState) {
  const next={...state,step:state.step+1,progress:0};
  reserve(save,q,next);
  writeQuestState(save,q.id,next);
}
function countEvent(save:CharacterSave,q:QuestDef,state:QuestState) {
  const need=q.steps[state.step]?.count??1,progress=(state.progress??0)+1;
  if(progress>=need)advanceState(save,q,state);
  else writeQuestState(save,q.id,{...state,progress});
}
function advance(inst:Instance,p:Player,q:QuestDef,state:QuestState) {
  countEvent(p.save,q,state);
  p.link.markDirty();
  inst.emitTo(p.id,{e:'notice',kind:'info',text:`${questText(q.title)}: ${questObjective(p.save,q).text}`});
}

export function questCommand(s:Session,a:Record<string,unknown>):CmdResult {
  const inst=s.rec?.inst;
  if(a.action==='talk') {
    if(!inst || typeof a.target!=='string' || !near(s,{zone:inst.map.zone,target:a.target}))return fail('Stand beside the person or object to interact');
    return ok({target:a.target});
  }
  const q=typeof a.quest==='string'?questById(a.quest):undefined;
  if(!q)return fail('Unknown quest');
  const state=questState(s.save,q.id);
  if(state && !validQuestState(q,state))return fail('This saved quest revision is unavailable; progress has been retained');
  if(!questAvailable(s.save,q))return fail('Complete the preceding adventure first');
  if(a.action==='track') {
    if(state?.claimed)return fail('This adventure is already completed');
    s.save.trackedQuest=q.id;s.changed(false);return ok();
  }
  if(!inst)return fail('Not in a zone');
  if(a.action==='accept') {
    if(state)return fail('This adventure is already recorded in your journal');
    if(a.target!==q.start.target || !near(s,q.start))return fail('Speak with the quest giver in person');
    writeQuestState(s.save,q.id,{revision:q.revision,step:0,claimed:false});
    s.save.trackedQuest=q.id;
  } else {
    if(!state)return fail('Accept this adventure first');
    if(state.claimed)return fail('This adventure is already completed');
    if(a.action==='claim') {
      if(a.target!==q.finish.target || !near(s,q.finish))return fail('Return to the quest giver in person');
      if(state.step!==q.steps.length)return fail('Finish the field objectives first');
      if(q.reward==='magic_weapon') {
        if(!state.reward)return fail('Your reserved reward could not be read');
        if(addToInventory(s.save,structuredClone(state.reward))<0)return fail('Make room in your inventory, then speak with the quest giver again');
      }
      writeQuestState(s.save,q.id,{...state,claimed:true});
      if(s.save.trackedQuest===q.id)delete s.save.trackedQuest;
    } else if(a.action==='inspect') {
      if(typeof a.target!=='string' || !near(s,{zone:inst.map.zone,target:a.target}))return fail('Stand beside the object to investigate');
      const index=q.steps.findIndex(step=>step.kind==='interact' && step.zone===inst.map.zone && step.target===a.target);
      if(index<0 || index>state.step)return fail('Follow the current journal objective first');
      if(index===state.step)advanceState(s.save,q,state);
    } else return fail('Unknown quest action');
  }
  s.changed(false);return ok();
}

/** Only actual authored deaths produce kill events; clients cannot submit them. */
export function creditQuestKill(inst:Instance,mob:Mob,witnesses:Player[]) {
  if(!mob.adventureSite&&!mob.adventureTarget || mob.noReward || mob.dummy)return;
  for(const p of witnesses) {
    if(p.deadMs>0 || p.hp<=0 || inst.playerById(p.id)!==p || Math.hypot(p.x-mob.x,p.y-mob.y)>XP_SHARE_RANGE)continue;
    for(const q of QUESTS) {
      const state=questState(p.save,q.id);
      if(!state || !validQuestState(q,state) || state.claimed)continue;
      const step=q.steps[state.step];
      if(step?.kind!=='kill'||step.zone!==inst.map.zone)continue;
      // Legacy targets still require the specifically tagged member. A typed count opts into the whole authored site.
      const matches=step.monsterType?step.target===mob.adventureSite&&step.monsterType===mob.def.id:step.target===mob.adventureTarget;
      if(matches)advance(inst,p,q,state);
    }
  }
}

/** Called only after owned ground loot was successfully inserted into inventory. */
export function creditQuestPickup(inst:Instance,p:Player,item:Item) {
  if(p.deadMs>0||p.hp<=0||inst.playerById(p.id)!==p)return;
  for(const q of QUESTS) {
    const state=questState(p.save,q.id);if(!state||!validQuestState(q,state)||state.claimed)continue;
    const step=q.steps[state.step];
    if(step?.kind==='collect'&&step.zone===inst.map.zone&&(!step.itemBase||step.itemBase===item.base))advance(inst,p,q,state);
  }
}

/** One successful operation counts once, including bulk salvage; result quality is a separate game rule. */
export function creditQuestService(s:Session,op:CmdOp) {
  if(!(QUEST_SERVICE_OPS as readonly string[]).includes(op))return;
  const inst=s.rec?.inst,role=SERVICE_ROLE[op];
  if(!inst||!role)return;
  const npc=inst.map.town?.npcs.find(n=>n.role===role);
  if(!npc||!inst.canInteract(s,npc.x,npc.y,npc.interactionRadius))return;
  let changed=false;
  for(const q of QUESTS) {
    const state=questState(s.save,q.id);if(!state||!validQuestState(q,state)||state.claimed)continue;
    const step=q.steps[state.step];
    if(step?.kind==='service'&&step.serviceOp===op&&step.zone===inst.map.zone&&step.target===npc.id){countEvent(s.save,q,state);changed=true;}
  }
  if(changed)s.changed(false);
}

/** Evaluated after authoritative movement, never from client-supplied positions. */
export function creditQuestReach(inst:Instance,p:Player) {
  if(!inst.map.adventure || p.deadMs>0 || p.hp<=0)return;
  for(const q of QUESTS) {
    const state=questState(p.save,q.id);
    if(!state || !validQuestState(q,state) || state.claimed)continue;
    const step=q.steps[state.step];
    if(step?.kind!=='reach' || step.zone!==inst.map.zone)continue;
    const loc=inst.map.adventure.locations.find(l=>l.id===step.target);
    if(loc && inst.canInteract(p.link,loc.x,loc.y,loc.radius))advance(inst,p,q,state);
  }
}
