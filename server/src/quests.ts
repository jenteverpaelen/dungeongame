import { QUESTS, questById } from '../../shared/src/data/quests';
import { questText } from '../../shared/src/data/questMessages';
import { questAvailable, questHasItem, questObjective, questState, validQuestState, writeQuestState } from '../../shared/src/quests';
import { campaignSetReward } from '../../shared/src/campaignSets';
import { QUEST_SERVICE_OPS, type QuestDef, type QuestState, type QuestTarget } from '../../shared/src/questTypes';
import { SERVICE_ROLE } from '../../shared/src/townServices';
import type { CmdOp } from '../../shared/src/protocol';
import type { CharacterSave, Item } from '../../shared/src/types';
import { planQuestReward } from '../../shared/src/questRewards';
import { recordIntro } from '../../shared/src/onboarding';
import { generateItem, starterUpgrade } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import { XP_SHARE_RANGE } from './config';
import { fail, ok, type CmdResult } from './world';
import type { Session } from './net/session';
import type { Instance } from './sim/instance';
import type { Mob, Player } from './sim/types';
import { planQuestDelivery } from '../../shared/src/questDelivery';
import { addXp } from '../../shared/src/progression';

function near(s:Session, target:QuestTarget):boolean {
  const inst=s.rec?.inst;
  if(!inst || inst.map.zone!==target.zone)return false;
  const spot=inst.map.adventure?.interactions.find(i=>i.id===target.target);
  const npc=inst.map.town?.npcs.find(i=>i.id===target.target);
  return spot?inst.canInteract(s,spot.x,spot.y,spot.radius):!!npc&&inst.canInteract(s,npc.x,npc.y,npc.interactionRadius);
}
function reserve(save:CharacterSave,q:QuestDef,state:QuestState) {
  if(state.step!==q.steps.length || !questHasItem(q) || state.reward)return;
  if(typeof q.reward==='object'&&q.reward.item==='starter_upgrade'){state.reward=starterUpgrade(new Rng((Math.random()*0xffffffff)>>>0),save.classId);return;}
  const projected=structuredClone(save);
  if(typeof q.reward==='object')addXp(projected,q.reward.xp??0);
  if(typeof q.reward==='object'&&(q.reward.item==='class_set_shoulders'||q.reward.item==='class_set_feet')){
    state.reward=campaignSetReward(new Rng((Math.random()*0xffffffff)>>>0),save.classId,q.reward.item,projected.level);return;
  }
  state.reward=generateItem(new Rng((Math.random()*0xffffffff)>>>0),{
    ilvl:projected.level,classId:save.classId,rarity:'magic',smartChance:1,
    base:save.classId==='mage'?'staff':save.classId==='ranger'?'bow':'sword',
  });
}
function nextState(save:CharacterSave,q:QuestDef,state:QuestState):QuestState {
  const next={...state,step:state.step+1,progress:0};
  reserve(save,q,next);
  return next;
}
function advanceState(save:CharacterSave,q:QuestDef,state:QuestState) {
  writeQuestState(save,q.id,nextState(save,q,state));
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
  if(a.action==='activate') {
    if(typeof a.target!=='string'||!inst?.activateDungeon)return fail('Not in an objective dungeon');
    const error=inst.activateDungeon(s,a.target);return error?fail(error):ok();
  }
  if(a.action==='activateField') {
    if(typeof a.target!=='string'||!inst?.activateFieldEvent)return fail('Not beside a field event');
    const error=inst.activateFieldEvent(s,a.target);return error?fail(error):ok();
  }
  if(a.action==='talk') {
    if(!inst || typeof a.target!=='string' || !near(s,{zone:inst.map.zone,target:a.target}))return fail('Stand beside the person or object to interact');
    return ok({target:a.target});
  }
  const q=typeof a.quest==='string'?questById(a.quest):undefined;
  if(!q)return fail('Unknown quest');
  const state=questState(s.save,q.id);
  if(state && !validQuestState(q,state))return fail('This saved quest revision is unavailable; progress has been retained');
  if(!questAvailable(s.save,q))return fail('Complete the preceding adventure first');
  const expectedCycle=(state?.cycle??0)+(a.action==='accept'&&state?.claimed?1:0);
  if(q.repeat&&a.cycle!==expectedCycle)return fail('This quest cycle changed; reopen the journal');
  if(a.action==='track') {
    if(state?.claimed)return fail('This adventure is already completed');
    s.save.trackedQuest=q.id;s.changed(false);return ok();
  }
  if(!inst)return fail('Not in a zone');
  if(a.action==='accept') {
    if(state&&(!state.claimed||!q.repeat))return fail('This adventure is already recorded in your journal');
    if(a.target!==q.start.target || !near(s,q.start))return fail('Speak with the quest giver in person');
    const cycle=state?(state.cycle??0)+1:0;
    if(!Number.isSafeInteger(cycle+1))return fail('Quest history is full');
    writeQuestState(s.save,q.id,{revision:q.revision,step:0,claimed:false,...(q.repeat?{cycle,completions:cycle}:{})});
    s.save.trackedQuest=q.id;
  } else {
    if(!state)return fail('Accept this adventure first');
    if(state.claimed)return fail('This adventure is already completed');
    if(a.action==='claim') {
      if(a.target!==q.finish.target || !near(s,q.finish))return fail('Return to the quest giver in person');
      if(state.step!==q.steps.length)return fail('Finish the field objectives first');
      const plan=planQuestReward(s.save,q,state);
      if('error' in plan)return fail(plan.error);
      Object.assign(s.save,plan.save);
      if(plan.save.trackedQuest===undefined)delete s.save.trackedQuest;
      s.changed(plan.levels>0||plan.paragons>0);
      return ok();
    } else if(a.action==='objectiveTalk') {
      const step=q.steps[state.step];
      if(step?.kind!=='talk'||a.step!==step.id||a.revision!==q.revision)return fail('This conversation is no longer the current objective');
      if(a.target!==step.target||!near(s,step))return fail('Speak with the named person in person');
      advanceState(s.save,q,state);
    } else if(a.action==='deliver') {
      const step=q.steps[state.step];
      if(step?.kind!=='deliver'||a.step!==step.id||a.revision!==q.revision)return fail('This delivery is no longer the current objective');
      if(a.target!==step.target||!near(s,step))return fail('Bring the selected items to the recipient in person');
      const plan=planQuestDelivery(s.save,step,a.itemIds,s.pendingEnchant?.itemId);
      if(plan.error!==undefined)return fail(plan.error);
      // Prepare random reward/state first; a generation failure must not consume inputs.
      const next=nextState(s.save,q,state);
      for(const slot of plan.slots)s.save.inventory[slot]=null;
      s.save.gems=plan.gems;
      writeQuestState(s.save,q.id,next);
    } else if(a.action==='inspect') {
      if(typeof a.target!=='string' || !near(s,{zone:inst.map.zone,target:a.target}))return fail('Stand beside the object to investigate');
      const matches=(step:QuestDef['steps'][number])=>step.kind==='interact'&&step.zone===inst.map.zone&&step.target===a.target;
      const current=q.steps[state.step];
      if(current&&matches(current)) {
        if(q.repeat&&(a.revision!==q.revision||a.step!==current.id))return fail('This investigation changed; reopen the journal');
        advanceState(s.save,q,state);
      } else if(!q.steps.slice(0,state.step).some(matches))return fail('Follow the current journal objective first');
    } else return fail('Unknown quest action');
  }
  s.changed(false);return ok();
}

/** Only actual authored deaths produce kill events; clients cannot submit them. */
export function creditQuestKill(inst:Instance,mob:Mob,witnesses:Player[],killer:Player|null=null) {
  if(!mob.adventureSite&&!mob.adventureTarget || mob.noReward || mob.dummy)return;
  for(const p of witnesses) {
    if(p.deadMs>0 || p.hp<=0 || inst.playerById(p.id)!==p || Math.hypot(p.x-mob.x,p.y-mob.y)>XP_SHARE_RANGE)continue;
    for(const q of QUESTS) {
      const state=questState(p.save,q.id);
      if(!state || !validQuestState(q,state) || state.claimed)continue;
      const step=q.steps[state.step];
      if(step?.kind!=='kill'||step.zone!==inst.map.zone)continue;
      // Legacy targets still require the specifically tagged member. A typed count opts into the whole authored site.
      if(step.credit==='killer'&&p!==killer)continue;
      const typed=step.monsterType||step.monsterFamily;
      const matches=typed?step.target===mob.adventureSite&&(!step.monsterType||step.monsterType===mob.def.id)&&(!step.monsterFamily||step.monsterFamily===mob.def.family):step.target===mob.adventureTarget;
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
  if(recordIntro(s.save,'service'))s.changed(false);
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

/** Called only after authoritative encounter completion and living-participant checks. */
export function creditQuestWave(inst:Instance,p:Player,target:string) {
  const authored=inst.kind==='dungeon'&&!!inst.dungeon || inst.kind==='field'&&inst.map.adventure?.events?.some(e=>e.id===target);
  if(!authored||p.deadMs>0||p.hp<=0||inst.playerById(p.id)!==p)return;
  for(const q of QUESTS){
    const state=questState(p.save,q.id);if(!state||!validQuestState(q,state)||state.claimed)continue;
    const step=q.steps[state.step];
    if(step?.kind==='wave'&&step.zone===inst.map.zone&&step.target===target)advance(inst,p,q,state);
  }
}

/** Called once by RiftRuntime.complete, using its existing present-member eligibility. */
export function creditQuestRift(inst:Instance,p:Player) {
  if(inst.kind!=='rift'||inst.rift?.phase!=='done'||inst.playerById(p.id)!==p)return;
  for(const q of QUESTS) {
    const state=questState(p.save,q.id);if(!state||!validQuestState(q,state)||state.claimed)continue;
    const step=q.steps[state.step];
    if(step?.kind==='rift'&&step.zone===inst.map.zone&&step.target==='completion'&&inst.difficulty>=(step.minDifficulty??Infinity))advance(inst,p,q,state);
  }
}
