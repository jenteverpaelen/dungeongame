import { QUESTS, questById } from '../../shared/src/data/quests';
import { questText } from '../../shared/src/data/questMessages';
import { bitCount, contactSpot, deleteQuestState, gatherMask, questAvailable, questCategory, questHasItem, questHasPick, questObjective, questState, validQuestState, writeQuestState } from '../../shared/src/quests';
import { campaignSetReward } from '../../shared/src/campaignSets';
import { QUEST_SERVICE_OPS, ZONE_WIDE, type QuestDef, type QuestState, type QuestTarget } from '../../shared/src/questTypes';
import { SERVICE_ROLE } from '../../shared/src/townServices';
import type { CmdOp } from '../../shared/src/protocol';
import type { CharacterSave, Item } from '../../shared/src/types';
import { planQuestReward } from '../../shared/src/questRewards';
import { recordIntro } from '../../shared/src/onboarding';
import { generateItem, pickBase, starterUpgrade } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import { XP_SHARE_RANGE } from './config';
import { fail, ok, type CmdResult } from './world';
import type { Session } from './net/session';
import type { Instance } from './sim/instance';
import type { Mob, Player } from './sim/types';
import { planQuestDelivery } from '../../shared/src/questDelivery';
import { addXp } from '../../shared/src/progression';
import { bountyClaim, creditBountyKill, creditBountyWave } from './bounties';

/** Proximity + line of sight to a contact where this player sees it (phasing, docs/rework/quests/DESIGN.md §4). */
function near(s:Session, target:QuestTarget):boolean {
  const inst=s.rec?.inst;
  if(!inst || inst.map.zone!==target.zone)return false;
  const spot=contactSpot(inst.map.adventure,target.target,s.save);
  if(spot)return spot.present&&inst.canInteract(s,spot.x,spot.y,spot.radius);
  const npc=inst.map.town?.npcs.find(i=>i.id===target.target);
  return !!npc&&inst.canInteract(s,npc.x,npc.y,npc.interactionRadius);
}
const ARMOUR_KINDS=new Set(['head','shoulders','chest','hands','wrists','waist','legs','feet']);
function armourPiece(rng:Rng,save:CharacterSave,ilvl:number):Item {
  let base=pickBase(rng,save.classId,true);
  for(let i=0;i<40&&!ARMOUR_KINDS.has(base.kind);i++)base=pickBase(rng,save.classId,true);
  return generateItem(rng,{ilvl,classId:save.classId,rarity:'magic',smartChance:1,base:base.id});
}
/** Reserve the item reward(s) when the last objective completes, at the level this quest's XP brings the character to. */
function reserve(save:CharacterSave,q:QuestDef,state:QuestState) {
  if(state.step!==q.steps.length || !questHasItem(q))return;
  const rng=()=>new Rng((Math.random()*0xffffffff)>>>0);
  if(typeof q.reward==='object'&&q.reward.item==='starter_upgrade'){state.reward??=starterUpgrade(rng(),save.classId);return;}
  const projected=structuredClone(save);
  if(typeof q.reward==='object')addXp(projected,q.reward.xp??0);
  if(typeof q.reward==='object'&&(q.reward.item==='class_set_shoulders'||q.reward.item==='class_set_feet')){
    state.reward??=campaignSetReward(rng(),save.classId,q.reward.item,projected.level);return;
  }
  state.reward??=generateItem(rng(),{ilvl:projected.level,classId:save.classId,rarity:'magic',smartChance:1,base:save.classId==='mage'?'staff':save.classId==='ranger'?'bow':'sword'});
  if(questHasPick(q))state.rewardAlt??=armourPiece(rng(),save,projected.level);
}
function nextState(save:CharacterSave,q:QuestDef,state:QuestState):QuestState {
  const {parts:_parts,...rest}=state;
  const next={...rest,step:state.step+1,progress:0};
  reserve(save,q,next);
  return next;
}
/** A hidden quest returns to the tracker when it progresses (docs/rework/quests/DESIGN.md §3, REFERENCES R5). */
function reveal(save:CharacterSave,id:string){if(save.questHidden?.includes(id)){save.questHidden=save.questHidden.filter(x=>x!==id);if(!save.questHidden.length)delete save.questHidden;}}
function advanceState(save:CharacterSave,q:QuestDef,state:QuestState) {
  writeQuestState(save,q.id,nextState(save,q,state));reveal(save,q.id);
}
function countEvent(save:CharacterSave,q:QuestDef,state:QuestState) {
  const need=q.steps[state.step]?.count??1,progress=(state.progress??0)+1;
  if(progress>=need)advanceState(save,q,state);
  else {writeQuestState(save,q.id,{...state,progress});reveal(save,q.id);}
}
function progressNotice(save:CharacterSave,q:QuestDef):string {
  const s=questState(save,q.id)!;
  return s.step===q.steps.length?`${questText(q.title)}: ${questText('ui.quest.ready')}`:`${questText(q.title)}: ${questObjective(save,q).text}`;
}
function advance(inst:Instance,p:Player,q:QuestDef,state:QuestState) {
  countEvent(p.save,q,state);
  p.link.markDirty();
  inst.emitTo(p.id,{e:'notice',kind:'info',text:progressNotice(p.save,q)});
}
/** Hold-to-use (repair) starts, per session; the finish must come `hold` ms of simulation time later (DESIGN.md §6). */
const holds=new WeakMap<Session,{quest:string;step:string;target:string;at:number;key:string}>();
export const HOLD_TOLERANCE_MS=150;

export function questCommand(s:Session,a:Record<string,unknown>):CmdResult {
  const inst=s.rec?.inst;
  if(a.action==='activate') {
    if(typeof a.target!=='string'||!inst?.activateDungeon)return fail('Not in an objective dungeon');
    const error=inst.activateDungeon(s,a.target);return error?fail(error):ok();
  }
  if(a.action==='poi') {
    if(typeof a.target!=='string'||!inst?.usePoi)return fail('Nothing to use here');
    const r=inst.usePoi(s,a.target);return r.ok?ok(r.data):fail(r.err);
  }
  if(a.action==='activateField') {
    if(typeof a.target!=='string'||!inst?.activateFieldEvent)return fail('Not beside a field event');
    const error=inst.activateFieldEvent(s,a.target);return error?fail(error):ok();
  }
  if(a.action==='talk') {
    if(!inst || typeof a.target!=='string' || !near(s,{zone:inst.map.zone,target:a.target}))return fail('Stand beside the person or object to interact');
    return ok({target:a.target});
  }
  if(a.action==='bountyClaim') {
    if(!inst)return fail('Not in a zone');
    if(!near(s,{zone:inst.map.zone,target:'bounty_board'}))return fail('Stand beside the bounty board');
    const r=bountyClaim(s,inst as unknown as Instance);return r.ok?ok(r.data):fail(r.err);
  }
  const q=typeof a.quest==='string'?questById(a.quest):undefined;
  if(!q)return fail('Unknown quest');
  const state=questState(s.save,q.id);
  if(state && !validQuestState(q,state))return fail('This saved quest revision is unavailable; progress has been retained');
  if(!questAvailable(s.save,q))return fail('Complete the preceding adventure first');
  const expectedCycle=(state?.cycle??0)+(a.action==='accept'&&state?.claimed?1:0);
  if(q.repeat&&a.cycle!==expectedCycle)return fail('This quest cycle changed; reopen the journal');
  // Tracker: focus (pin) drives the trail; hide removes a row until the quest progresses. `track`/`untrack` are the old names.
  if(['track','untrack','focus','unfocus','hide','show'].includes(a.action as string)) {
    if(state?.claimed)return fail('This adventure is already completed');
    const hidden=new Set(s.save.questHidden??[]);
    if(a.action==='track'||a.action==='focus'){s.save.trackedQuest=q.id;hidden.delete(q.id);}
    else if(a.action==='unfocus'){if(s.save.trackedQuest===q.id||s.save.trackedQuest===undefined)s.save.trackedQuest='';}
    else if(a.action==='show')hidden.delete(q.id);
    else {hidden.add(q.id);if(s.save.trackedQuest===q.id)s.save.trackedQuest='';}
    if(hidden.size)s.save.questHidden=[...hidden].slice(0,128);else delete s.save.questHidden;
    s.changed(false);return ok();
  }
  if(a.action==='abandon') {
    if(!state||state.claimed)return fail('Nothing to abandon');
    if(q.tutorial)return fail('The first lesson cannot be abandoned');
    deleteQuestState(s.save,q.id);reveal(s.save,q.id);
    if(s.save.trackedQuest===q.id)delete s.save.trackedQuest;
    s.changed(false);return ok();
  }
  if(!inst)return fail('Not in a zone');
  const simT=(inst as unknown as Instance).t;
  if(a.action==='accept') {
    if(state&&(!state.claimed||!q.repeat))return fail('This adventure is already recorded in your journal');
    if(a.target!==q.start.target || !near(s,q.start))return fail('Speak with the quest giver in person');
    const cycle=state?(state.cycle??0)+1:0;
    if(!Number.isSafeInteger(cycle+1))return fail('Quest history is full');
    writeQuestState(s.save,q.id,{revision:q.revision,step:0,claimed:false,...(q.repeat?{cycle,completions:cycle}:{})});
    reveal(s.save,q.id);
    // Auto-track (R5, R20): every accepted quest shows; a story quest, or the first quest, takes the focus.
    if(questCategory(q)==='story'||!s.save.trackedQuest)s.save.trackedQuest=q.id;
  } else {
    if(!state)return fail('Accept this adventure first');
    if(state.claimed)return fail('This adventure is already completed');
    if(a.action==='claim') {
      if(a.target!==q.finish.target || !near(s,q.finish))return fail('Return to the quest giver in person');
      if(state.step!==q.steps.length)return fail('Finish the field objectives first');
      // A save migrated from before the reward pick may hold only the weapon; reserve the armour now.
      let claimState=state;
      if(questHasPick(q)&&(!state.reward||!state.rewardAlt)){claimState={...state};reserve(s.save,q,claimState);writeQuestState(s.save,q.id,claimState);}
      const pick=a.pick==='alt'&&questHasPick(q)?'alt':'main';
      const plan=planQuestReward(s.save,q,claimState,pick);
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
    } else if(a.action==='holdStart'||a.action==='inspect') {
      if(typeof a.target!=='string' || !near(s,{zone:inst.map.zone,target:a.target}))return fail('Stand beside the object to investigate');
      const step=q.steps[state.step];
      const matches=(st:QuestDef['steps'][number])=>st.kind==='interact'&&st.zone===inst.map.zone&&(st.targets?st.targets.includes(a.target as string):st.target===a.target);
      if(!step||!matches(step)) {
        if(a.action==='inspect'&&q.steps.slice(0,state.step).some(matches))return ok(); // re-reading a finished clue is harmless
        return fail('Follow the current journal objective first');
      }
      if(q.repeat&&(a.revision!==q.revision||a.step!==step.id))return fail('This investigation changed; reopen the journal');
      const index=step.targets?step.targets.indexOf(a.target):-1,parts=state.parts??0;
      if(index>=0&&parts&(1<<index))return fail('Already done; find the others');
      if(step.ordered&&index>=0&&index!==bitCount(parts)) {
        if(a.action==='holdStart')return fail('Not that one yet');
        writeQuestState(s.save,q.id,{...state,parts:0});s.changed(false);
        return fail(`Wrong order. Start again with the first: ${inst.map.adventure?.interactions.find(i=>i.id===step.targets![0])?.name??step.targets![0]}`);
      }
      const key=`${q.id}/${step.id}/${a.target}`;
      if(step.hold) {
        if(a.action==='holdStart'){holds.set(s,{quest:q.id,step:step.id,target:a.target,at:simT,key});return ok({hold:step.hold});}
        const h=holds.get(s);
        if(!h||h.key!==key||simT-h.at<step.hold-HOLD_TOLERANCE_MS)return fail('Keep working on it a little longer');
        holds.delete(s);
      } else if(a.action==='holdStart')return ok({hold:0});
      if(step.targets){
        const done=parts|(1<<index);
        if(done===gatherMask(step))advanceState(s.save,q,state);
        else {writeQuestState(s.save,q.id,{...state,parts:done});reveal(s.save,q.id);}
      } else advanceState(s.save,q,state);
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
      // A zone-wide step counts any authored (never random) monster of the zone; story targets stay reserved for story steps.
      const zoneWide=step.target===ZONE_WIDE&&!!mob.adventureSite&&!mob.adventureTarget;
      const site=zoneWide||step.target===mob.adventureSite;
      const matches=typed?site&&(!step.monsterType||step.monsterType===mob.def.id)&&(!step.monsterFamily||step.monsterFamily===mob.def.family):step.target===ZONE_WIDE?zoneWide:step.target===mob.adventureTarget;
      if(matches)advance(inst,p,q,state);
    }
  }
  creditBountyKill(inst,mob,witnesses);
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
  if(inst.kind==='field')creditBountyWave(inst,p,target);
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
