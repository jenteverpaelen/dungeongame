import { ADVENTURES, loadAdventure } from './adventure';
import { QUESTS } from './data/quests';
import { QUEST_MESSAGES } from './data/questMessages';
import { CHAPTERS } from './data/story';
import { validateDialogues, validateQuestGraph } from './questAuthoring';
import { questRewardError } from './questRewards';
import { questUnlocks } from './quests';
import { ZONES } from './data/zones';
import { MONSTERS, ELITE_AFFIXES } from './data/monsters';
import { CollisionWorld } from './movement';
import { INVENTORY_SIZE, PLAYER_RADIUS } from './constants';
import { QUEST_SERVICE_OPS, ZONE_WIDE, type QuestDef, type QuestTarget, type QuestStep } from './questTypes';
import { BASES } from './data/items';
import { SERVICE_ROLE } from './townServices';
import town from './data/town/hearthmere.json';
import { inPolygon } from './townGeometry';
import { validateAdventureAmbience } from './adventureAmbience';
import { DIFFICULTIES } from './progression';
import { validateAdventureReachability } from './adventureReachability';
import { WORLD_STATES } from './data/worldStates';
import { BOUNTY_BOARDS, BOUNTIES_PER_BOARD, bountyKey, drawBounties } from './bounties';
import { storyXp } from './storyBudget';

/** Semantic references, prerequisite cycles and actual player-radius authored routes. */
export function validateQuests(quests:readonly QuestDef[]=QUESTS):string[] {
  const errors:string[]=[],ids=new Set(quests.map(q=>q.id));
  const check=(ok:boolean,path:string,message:string)=>{if(!ok)errors.push(`${path}: ${message}`);};
  check(ids.size===quests.length,'quests','duplicate quest ID');
  const target=(t:QuestTarget,kind:QuestStep['kind'],path:string,step?:QuestStep)=>{
    const a=ADVENTURES[t.zone];
    const person=a?.interactions.some(i=>i.id===t.target&&i.kind==='person')||t.zone===town.id&&town.npcs.some(n=>n.id===t.target&&['blacksmith','jeweler','mystic','healer','vendor','quest'].includes(n.role));
    const found=kind==='interact'?(step?.targets??[t.target]).every(id=>a?.interactions.some(i=>i.id===id)||t.zone===town.id&&town.npcs.some(n=>n.id===id))
      :kind==='deliver'||kind==='talk'?person
      :kind==='rift'?t.zone==='rift'&&t.target==='completion'
      :kind==='reach'?a?.locations.some(i=>i.id===t.target)
      :kind==='collect'?a?.encounters.some(e=>e.id===t.target)
      :kind==='wave'?a?.dungeon?.stages.some(s=>s.id===t.target)||a?.events?.some(e=>e.id===t.target)
      :kind==='service'?t.zone===town.id&&town.npcs.some(n=>n.id===t.target&&step?.serviceOp&&n.role===SERVICE_ROLE[step.serviceOp])
      :kind==='kill'&&a?.encounters.some(e=>(t.target===ZONE_WIDE||e.id===t.target)&&e.members.some(m=>step?.monsterType||step?.monsterFamily
        ?(!step.monsterType||m.type===step.monsterType)&&(!step.monsterFamily||MONSTERS[m.type]?.family===step.monsterFamily)
        :t.target===ZONE_WIDE?!m.questTarget&&!m.combat:m.questTarget));
    check(!!found,path,`unknown ${kind} target ${t.zone}/${t.target}`);
  };
  for(const q of quests) {
    check(/^[a-z][a-z0-9_]*$/.test(q.id),q.id,'invalid ID');
    check(Number.isSafeInteger(q.revision)&&q.revision>0,q.id,'invalid revision');
    check(q.steps.length>0,q.id,'no objectives');
    check(!q.chapter||CHAPTERS.some(c=>c.id===q.chapter),q.id,'unknown chapter');
    check(!q.tutorial||!q.repeat,q.id,'tutorial reward cannot repeat');
    check(q.repeat===undefined||q.repeat==='on_return',q.id,'unsupported repeat rule');
    check(q.id!=='silent_wheel'||!q.repeat,q.id,'legacy quest cannot repeat');
    const rewardError=questRewardError(q);if(rewardError)errors.push(`${q.id}: ${rewardError}`);
    for(const flag of [...q.grantsFlags??[],...q.requiresFlags??[]])check(/^[a-z][a-z0-9_]*$/.test(flag),q.id,'invalid story flag');
    for(const flag of q.requiresFlags??[])check(quests.some(p=>p.grantsFlags?.includes(flag)),q.id,`unknown story flag ${flag}`);
    check(new Set(q.steps.map(s=>s.id)).size===q.steps.length,q.id,'duplicate objective ID');
    for(const k of [q.title,q.offer,q.complete,q.rewardText,...q.steps.map(s=>s.text)])check(Object.hasOwn(QUEST_MESSAGES,k),q.id,`unknown message ${k}`);
    target(q.start,'talk',`${q.id}.start`);target(q.finish,'talk',`${q.id}.finish`);
    for(const [i,s] of q.steps.entries()) {
      const path=`${q.id}.steps[${i}]`;
      target(s,s.kind,path,s);
      check(Number.isSafeInteger(s.count??1)&&(s.count??1)>0,path,'count must be a positive safe integer');
      if(q.id==='silent_wheel')check((s.count??1)===1,path,'legacy flag adapter requires single-event steps');
      if(s.kind==='interact'||s.kind==='talk'||s.kind==='reach'||s.kind==='wave')check((s.count??1)===1,path,'interaction/reach/wave count must be one');
      if(s.monsterType!==undefined)check(s.kind==='kill'&&Object.hasOwn(MONSTERS,s.monsterType),path,'invalid monster type filter');
      if(s.monsterFamily!==undefined)check(s.kind==='kill'&&Object.values(MONSTERS).some(m=>m.family===s.monsterFamily),path,'invalid monster family filter');
      if(s.credit!==undefined)check(s.kind==='kill'&&['nearby','killer'].includes(s.credit),path,'invalid kill credit policy');
      if(s.itemBase!==undefined)check((s.kind==='collect'||s.kind==='deliver')&&Object.hasOwn(BASES,s.itemBase),path,'invalid item base filter');
      if(s.kind==='deliver') {
        check(!!s.itemBase&&Object.hasOwn(BASES,s.itemBase),path,'delivery requires an item base');
        check(['normal','magic','rare','legendary','set'].includes(s.itemRarity??''),path,'delivery requires an exact item rarity');
        check((s.count??1)<=INVENTORY_SIZE,path,'delivery exceeds bag capacity');
      } else check(s.itemRarity===undefined,path,'item rarity on a different objective kind');
      if(s.kind==='rift')check(Number.isInteger(s.minDifficulty)&&!!DIFFICULTIES[s.minDifficulty!],path,'rift requires an existing minimum difficulty');
      else check(s.minDifficulty===undefined,path,'rift difficulty on a different objective kind');
      if(s.kind==='service')check(!!s.serviceOp&&QUEST_SERVICE_OPS.includes(s.serviceOp),path,'unsupported service operation');
      else check(s.serviceOp===undefined,path,'service operation on a different objective kind');
      // Gather / ordered / hold (docs/rework/quests/DESIGN.md §6).
      if(s.targets!==undefined){
        check(s.kind==='interact'&&Array.isArray(s.targets)&&s.targets.length>=2&&s.targets.length<=8&&new Set(s.targets).size===s.targets.length,path,'gather needs 2–8 distinct interact targets');
        check(s.target===s.targets[0],path,'gather target must be its first listed object');
        check(s.count===undefined,path,'gather counts its targets, not a count');
      }
      check(!s.ordered||!!s.targets,path,'ordered needs gather targets');
      if(s.hold!==undefined)check(s.kind==='interact'&&Number.isInteger(s.hold)&&s.hold>=500&&s.hold<=6000,path,'hold is 500–6000 ms on an interact objective');
      // A per-player contact must already be present when this step needs it.
      for(const id of s.targets??[s.target]){
        const c=ADVENTURES[s.zone]?.interactions.find(i=>i.id===id),cond=c?.when?WORLD_STATES[c.when]:undefined;
        if(c?.when)check(!!cond&&cond.quest===q.id&&(cond.step??q.steps.length)<=i,path,`contact ${id} is not present yet at this step`);
      }
    }
    for(const [end,t] of [['start',q.start],['finish',q.finish]] as const)check(!ADVENTURES[t.zone]?.interactions.find(c=>c.id===t.target)?.when,q.id,`${end} contact must always be present`);
    check(QUEST_MESSAGES[q.offer].length<=511,q.id,'offer text exceeds 511 characters (docs/rework/quests/REFERENCES.md R1)');
    for(const id of q.requires)check(ids.has(id),q.id,`unknown prerequisite ${id}`);
    for(const zone of questUnlocks(q))check(Object.hasOwn(ZONES,zone),q.id,`unknown unlocked zone ${zone}`);
  }
  const visited=new Set<string>(),active=new Set<string>();
  const visit=(id:string)=>{
    if(active.has(id)){errors.push(`${id}: prerequisite cycle`);return;}
    if(visited.has(id))return;
    active.add(id);for(const dep of quests.find(q=>q.id===id)?.requires??[])visit(dep);
    active.delete(id);visited.add(id);
  };
  for(const q of quests)visit(q.id);
  errors.push(...validateQuestGraph(quests),...validateDialogues());
  if(quests===QUESTS)errors.push(...validateWorldStates(),...validateBounties(),...validateStoryBudget());
  return errors;
}

/** Every world-state key used by a zone exists and points at a real quest milestone (docs/rework/quests/DESIGN.md §7). */
export function validateWorldStates():string[] {
  const errors:string[]=[];
  for(const [key,c] of Object.entries(WORLD_STATES)){
    const q=QUESTS.find(d=>d.id===c.quest);
    if(!q)errors.push(`world state ${key}: unknown quest ${c.quest}`);
    else if(c.step!==undefined&&(!Number.isInteger(c.step)||c.step<1||c.step>q.steps.length))errors.push(`world state ${key}: step outside ${q.id}`);
    if(!Object.hasOwn(QUEST_MESSAGES,`ws.${key}`))errors.push(`world state ${key}: no reveal caption ws.${key}`);
  }
  for(const [zone,a] of Object.entries(ADVENTURES)){
    const keys=[...(a.paint?.phases??[]).map(p=>p.key),...a.interactions.flatMap(i=>[...(i.when?[i.when]:[]),...(i.moves??[]).map(m=>m.key)]),
      ...(a.paint?.structures??[]).flatMap(st=>st.spin?[st.spin]:[]),...(a.wheel?.spin?[a.wheel.spin]:[]),...(a.kilns??[]).flatMap(k=>k.cold?[k.cold]:[])];
    for(const key of keys)if(!WORLD_STATES[key])errors.push(`${zone}: unknown world state ${key}`);
  }
  return errors;
}
/** Boards: a board object in the zone, a real unlock quest, and every pooled bounty pointing at real content. */
export function validateBounties():string[] {
  const errors:string[]=[];
  for(const [zone,b] of Object.entries(BOUNTY_BOARDS)){
    const a=ADVENTURES[zone];
    if(!a){errors.push(`bounties ${zone}: unknown zone`);continue;}
    if(!a.interactions.some(i=>i.id==='bounty_board'&&i.kind==='board'))errors.push(`bounties ${zone}: no bounty board`);
    if(!QUESTS.some(q=>q.id===b.unlock&&!q.repeat))errors.push(`bounties ${zone}: unknown unlock ${b.unlock}`);
    if(b.pool.length<BOUNTIES_PER_BOARD||new Set(b.pool.map(p=>p.id)).size!==b.pool.length)errors.push(`bounties ${zone}: pool too small or duplicated`);
    if(new Set(drawBounties('validator',zone,0)).size!==BOUNTIES_PER_BOARD)errors.push(`bounties ${zone}: draw does not give three`);
    for(const d of b.pool){
      const ok=d.kind==='event'?!!a.events?.some(e=>e.id===d.target)
        :d.kind==='rare'?a.encounters.some(e=>e.id===d.target&&e.members.some(m=>m.tier===2))
        :a.encounters.some(e=>e.members.some(m=>!m.questTarget&&!m.combat&&MONSTERS[m.type]?.family===d.family))&&Number.isInteger(d.count)&&d.count!>0;
      if(!ok)errors.push(`bounties ${zone}/${d.id}: no such ${d.kind} target`);
      if(!Object.hasOwn(QUEST_MESSAGES,bountyKey(zone,d.id)))errors.push(`bounties ${zone}/${d.id}: no title`);
    }
  }
  return errors;
}
/** One-time quest XP sums to the calibrated story budget (BALANCE.md; DESIGN.md §9), within rounding. */
export function validateStoryBudget():string[] {
  const total=QUESTS.filter(q=>!q.repeat).reduce((sum,q)=>sum+(typeof q.reward==='object'?q.reward.xp??0:0),0),want=storyXp(1,50);
  return Math.abs(total-want)<=QUESTS.length?[]:[`story XP budget ${total} differs from storyXp(1,50)=${want}`];
}

export function validateAdventures():string[] {
  const errors:string[]=[];
  const check=(ok:boolean,path:string)=>{if(!ok)errors.push(path);};
  for(const id of Object.keys(ADVENTURES)) {
    const map=loadAdventure(id,1),a=map.adventure!,cw=new CollisionWorld(map);
    errors.push(...validateAdventureAmbience(a));
    errors.push(...validateAdventureReachability(map));
    check((ZONES[id]?.kind==='dungeon')===!!a.dungeon,`${id}: dungeon runtime/kind mismatch`);
    check(map.theme===ZONES[id]?.theme,`${id}: rendered/server theme mismatch`);
    check(a.size.every((n,i)=>n===ZONES[id]?.size[i]),`${id}: zone dimensions mismatch`);
    for(const k of a.kilns??[])check([k.x,k.y,k.w,k.d,k.h].every(Number.isFinite)&&k.w>0&&k.d>0&&k.h>0&&k.x>=0&&k.y>=0&&k.x+k.w<=map.w*64&&k.y+k.d<=map.h*64,`${id}: invalid kiln`);
    for(const k of a.works??[])check(['pan','relay'].includes(k.kind)&&[k.x,k.y,k.w,k.d,k.h].every(Number.isFinite)&&k.w>0&&k.d>0&&k.h>0&&k.x>=0&&k.y>=0&&k.x+k.w<=map.w*64&&k.y+k.d<=map.h*64,`${id}: invalid production or signal structure`);
    if(a.events?.length){
      check(ZONES[id]?.kind==='field',`${id}: events require a shared field`);
      for(const key of ['id','trigger','encounter'] as const)check(new Set(a.events.map(e=>e[key])).size===a.events.length,`${id}: duplicate event ${key}`);
      for(const e of a.events){
        check(!!e.name&&a.interactions.some(i=>i.id===e.trigger),`${id}/${e.id}: missing event interaction`);
        check(a.encounters.some(p=>p.id===e.encounter&&p.members.length>0),`${id}/${e.id}: missing event encounter`);
      }
    }
    if(a.dungeon){
      const stages=a.dungeon.stages;
      if(a.dungeon.endTarget)check(a.interactions.some(i=>i.id===a.dungeon!.endTarget),`${id}: missing dungeon end target`);
      check(stages.length>0&&new Set(stages.map(s=>s.id)).size===stages.length,`${id}: invalid/duplicate stages`);
      check(new Set(stages.map(s=>s.trigger)).size===stages.length,`${id}: duplicate mechanism`);
      // D-W06: stage encounters are unique and authored; other dungeon packs are pre-placed (finite, no respawn).
      check(new Set(stages.map(s=>s.encounter)).size===stages.length&&stages.every(st=>a.encounters.some(e=>e.id===st.encounter)),`${id}: duplicate/unassigned encounter`);
      for(const s of stages){
        const trigger=a.interactions.find(i=>i.id===s.trigger),encounter=a.encounters.find(e=>e.id===s.encounter);
        check(s.area.length>=3&&s.area.every(p=>p.every(Number.isFinite)),`${id}/${s.id}: invalid arena`);
        check(!!trigger&&trigger.kind==='mechanism'&&inPolygon(trigger.x,trigger.y,s.area),`${id}/${s.id}: missing/outside mechanism`);
        check(!!encounter&&encounter.members.length>0&&encounter.members.every(m=>inPolygon(encounter.x+m.dx,encounter.y+m.dy,s.area)),`${id}/${s.id}: missing/outside encounter`);
      }
    }
    check(cw.isFree(map.entry.x,map.entry.y,PLAYER_RADIUS),`${id}: blocked entry`);
    for(const e of a.encounters)for(const m of e.members) {
      const def=MONSTERS[m.type];
      check(!!def && cw.isFree(e.x+m.dx,e.y+m.dy,def.radius),`${id}: blocked/unknown spawn ${e.id}/${m.type}`);
      const aff=m.affixes??[];
      check(aff.length===new Set(aff).size&&aff.length<=2&&aff.every(id=>Object.hasOwn(ELITE_AFFIXES,id))&&(!aff.length||m.tier===2),`${id}/${e.id}: invalid authored affixes`);
      check(!m.combat||['keeper','furnace','cistern','relay'].includes(m.combat)&&m.tier===2,`${id}/${e.id}: invalid authored boss`);
    }
    for(const group of [a.interactions,a.encounters,a.locations])check(new Set(group.map(i=>i.id)).size===group.length,`${id}: duplicate target ID`);
    for(const loc of a.locations)check(Number.isFinite(loc.radius)&&loc.radius>0&&cw.isFree(loc.x,loc.y,PLAYER_RADIUS),`${id}: invalid reach ${loc.id}`);
    for(const interaction of [...a.interactions,...a.interactions.flatMap(i=>(i.moves??[]).map(m=>({...i,id:`${i.id}@${m.key}`,x:m.x,y:m.y}))),...a.portals.map(p=>({...p,id:p.to,radius:110}))]) {
      check(Number.isFinite(interaction.radius)&&interaction.radius>0,`${id}: invalid radius ${interaction.id}`);
      check(Array.from({length:16},(_,n)=>{
        const x=interaction.x+70*Math.cos(n*Math.PI/8),y=interaction.y+70*Math.sin(n*Math.PI/8);
        return cw.isFree(x,y,PLAYER_RADIUS)&&!cw.segmentBlocked(x,y,interaction.x,interaction.y);
      }).some(Boolean),`${id}: inaccessible ${interaction.id}`);
    }
    for(const [r,route] of a.routes.entries())for(let i=1;i<route.length;i++) {
      const [x,y]=route[i-1],dx=route[i][0]-x,dy=route[i][1]-y,d=Math.hypot(dx,dy);
      const n=Math.ceil(d/8);
      check(Array.from({length:n+1},(_,j)=>cw.isFree(x+dx*j/n,y+dy*j/n,PLAYER_RADIUS)).every(Boolean),`${id}: route ${r}/${i} blocked`);
      const end=cw.moveCircle(x,y,PLAYER_RADIUS,dx,dy);
      check(Math.hypot(end.x-route[i][0],end.y-route[i][1])<.01,`${id}: route ${r}/${i} sweep differs`);
    }
  }
  return errors;
}
