import { ADVENTURES, loadAdventure } from './adventure';
import { QUESTS } from './data/quests';
import { QUEST_MESSAGES } from './data/questMessages';
import { DIALOGUES } from './data/dialogues';
import { ZONES } from './data/zones';
import { MONSTERS } from './data/monsters';
import { CollisionWorld } from './movement';
import { PLAYER_RADIUS } from './constants';
import { QUEST_SERVICE_OPS, type QuestDef, type QuestTarget, type QuestStep } from './questTypes';
import { BASES } from './data/items';
import { SERVICE_ROLE } from './townServices';
import town from './data/town/hearthmere.json';

/** Semantic references, prerequisite cycles and actual player-radius authored routes. */
export function validateQuests(quests:readonly QuestDef[]=QUESTS):string[] {
  const errors:string[]=[],ids=new Set(quests.map(q=>q.id));
  const check=(ok:boolean,path:string,message:string)=>{if(!ok)errors.push(`${path}: ${message}`);};
  check(ids.size===quests.length,'quests','duplicate quest ID');
  const target=(t:QuestTarget,kind:QuestStep['kind'],path:string,step?:QuestStep)=>{
    const a=ADVENTURES[t.zone];
    const found=kind==='interact'?a?.interactions.some(i=>i.id===t.target)
      :kind==='reach'?a?.locations.some(i=>i.id===t.target)
      :kind==='collect'?a?.encounters.some(e=>e.id===t.target)
      :kind==='service'?t.zone===town.id&&town.npcs.some(n=>n.id===t.target&&step?.serviceOp&&n.role===SERVICE_ROLE[step.serviceOp])
      :a?.encounters.some(e=>e.id===t.target&&e.members.some(m=>step?.monsterType?m.type===step.monsterType:m.questTarget));
    check(!!found,path,`unknown ${kind} target ${t.zone}/${t.target}`);
  };
  for(const q of quests) {
    check(/^[a-z][a-z0-9_]*$/.test(q.id),q.id,'invalid ID');
    check(Number.isSafeInteger(q.revision)&&q.revision>0,q.id,'invalid revision');
    check(q.steps.length>0,q.id,'no objectives');
    check(new Set(q.steps.map(s=>s.id)).size===q.steps.length,q.id,'duplicate objective ID');
    for(const k of [q.title,q.offer,q.complete,q.rewardText,...q.steps.map(s=>s.text)])check(Object.hasOwn(QUEST_MESSAGES,k),q.id,`unknown message ${k}`);
    target(q.start,'interact',`${q.id}.start`);target(q.finish,'interact',`${q.id}.finish`);
    for(const [i,s] of q.steps.entries()) {
      const path=`${q.id}.steps[${i}]`;
      target(s,s.kind,path,s);
      check(Number.isSafeInteger(s.count??1)&&(s.count??1)>0,path,'count must be a positive safe integer');
      if(q.id==='silent_wheel')check((s.count??1)===1,path,'legacy flag adapter requires single-event steps');
      if(s.kind==='interact'||s.kind==='reach')check((s.count??1)===1,path,'interaction/reach count must be one');
      if(s.monsterType!==undefined)check(s.kind==='kill'&&Object.hasOwn(MONSTERS,s.monsterType),path,'invalid monster type filter');
      if(s.itemBase!==undefined)check(s.kind==='collect'&&Object.hasOwn(BASES,s.itemBase),path,'invalid item base filter');
      if(s.kind==='service')check(!!s.serviceOp&&QUEST_SERVICE_OPS.includes(s.serviceOp),path,'unsupported service operation');
      else check(s.serviceOp===undefined,path,'service operation on a different objective kind');
    }
    for(const id of q.requires)check(ids.has(id),q.id,`unknown prerequisite ${id}`);
    if(q.unlocks)check(Object.hasOwn(ZONES,q.unlocks),q.id,`unknown unlocked zone ${q.unlocks}`);
  }
  const visited=new Set<string>(),active=new Set<string>();
  const visit=(id:string)=>{
    if(active.has(id)){errors.push(`${id}: prerequisite cycle`);return;}
    if(visited.has(id))return;
    active.add(id);for(const dep of quests.find(q=>q.id===id)?.requires??[])visit(dep);
    active.delete(id);visited.add(id);
  };
  for(const q of quests)visit(q.id);
  for(const [id,d] of Object.entries(DIALOGUES)) {
    check(Object.hasOwn(d.nodes,d.start),id,'unknown dialogue start');
    for(const [node,n] of Object.entries(d.nodes)) {
      check(Object.hasOwn(QUEST_MESSAGES,n.text),`${id}/${node}`,'unknown dialogue text');
      for(const c of n.choices) {
        check(Object.hasOwn(d.nodes,c.to),`${id}/${node}`,'unknown dialogue destination');
        check(Object.hasOwn(QUEST_MESSAGES,c.label),`${id}/${node}`,'unknown choice text');
      }
    }
  }
  return errors;
}

export function validateAdventures():string[] {
  const errors:string[]=[];
  const check=(ok:boolean,path:string)=>{if(!ok)errors.push(path);};
  for(const id of Object.keys(ADVENTURES)) {
    const map=loadAdventure(id,1),a=map.adventure!,cw=new CollisionWorld(map);
    check(cw.isFree(map.entry.x,map.entry.y,PLAYER_RADIUS),`${id}: blocked entry`);
    for(const e of a.encounters)for(const m of e.members) {
      const def=MONSTERS[m.type];
      check(!!def && cw.isFree(e.x+m.dx,e.y+m.dy,def.radius),`${id}: blocked/unknown spawn ${e.id}/${m.type}`);
    }
    for(const group of [a.interactions,a.encounters,a.locations])check(new Set(group.map(i=>i.id)).size===group.length,`${id}: duplicate target ID`);
    for(const loc of a.locations)check(Number.isFinite(loc.radius)&&loc.radius>0&&cw.isFree(loc.x,loc.y,PLAYER_RADIUS),`${id}: invalid reach ${loc.id}`);
    for(const interaction of [...a.interactions,...a.portals.map(p=>({...p,id:p.to,radius:110}))]) {
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
