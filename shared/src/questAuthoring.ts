import { QUESTS } from './data/quests';
import { DIALOGUES, type DialogueDef } from './data/dialogues';
import { CHAPTERS, LORE } from './data/story';
import { QUEST_MESSAGES } from './data/questMessages';
import { questUnlocks } from './quests';
import type { QuestDef } from './questTypes';
import { worldConnections, zoneRoute } from './worldNavigation';

/** Monotone closure includes zone locks and flags, so a quest cannot unlock its own giver. */
export function validateQuestGraph(quests:readonly QuestDef[]):string[] {
  const done=new Set<string>(),flags=new Set<string>(),pending=new Set(quests.map(q=>q.id));
  let changed=true;
  while(changed) {
    changed=false;
    const allowed=(zone:string)=>quests.filter(q=>questUnlocks(q).includes(zone)).every(q=>done.has(q.id));
    const reachable=new Set(['hearthmere']);
    for(let grew=true;grew;) {grew=false;for(const e of worldConnections())if(reachable.has(e.from)&&allowed(e.to)&&!reachable.has(e.to)){reachable.add(e.to);grew=true;}}
    // Rifts are entered at the town Obelisk and always have a leave route.
    const routeZone=(id:string)=>id==='rift'?'hearthmere':id;
    for(const q of quests) {
      if(!pending.has(q.id)||!q.requires.every(id=>done.has(id))||!(q.requiresFlags??[]).every(f=>flags.has(f)))continue;
      const sequence=[q.start,...q.steps,q.finish].map(t=>routeZone(t.zone));
      if(!sequence.every(z=>reachable.has(z))||!sequence.every((z,i)=>i===0||zoneRoute(sequence[i-1],z,allowed).length>0))continue;
      pending.delete(q.id);done.add(q.id);for(const flag of q.grantsFlags??[])flags.add(flag);changed=true;
    }
  }
  return [...pending].map(id=>`${id}: unreachable quest (prerequisite, story flag or world-unlock dependency)`);
}

/** Conservative proof for read-only positive conditions: every node has an unconditional exit path. */
export function validateDialogues(dialogues:Readonly<Record<string,DialogueDef>>=DIALOGUES,quests:readonly QuestDef[]=QUESTS):string[] {
  const errors:string[]=[],flags=new Set(quests.flatMap(q=>q.grantsFlags??[]));
  for(const [id,d] of Object.entries(dialogues)) {
    const check=(yes:boolean,why:string)=>{if(!yes)errors.push(`${id}: ${why}`);};
    check(Object.hasOwn(d.nodes,d.start),'unknown dialogue start');
    const reachable=new Set<string>(),queue=[d.start],exits=new Set(Object.keys(d.nodes).filter(key=>d.nodes[key].choices.length===0));
    for(let i=0;i<queue.length;i++) {const key=queue[i];if(reachable.has(key)||!Object.hasOwn(d.nodes,key))continue;reachable.add(key);queue.push(...d.nodes[key].choices.map(c=>c.to));}
    for(let changed=true;changed;) {changed=false;for(const [key,n] of Object.entries(d.nodes))if(!exits.has(key)&&n.choices.some(c=>!c.when?.length&&exits.has(c.to))){exits.add(key);changed=true;}}
    for(const [key,n] of Object.entries(d.nodes)) {
      check(reachable.has(key),`unreachable dialogue node ${key}`);
      check(exits.has(key),`dialogue node ${key} has no unconditional exit`);
      check(Object.hasOwn(QUEST_MESSAGES,n.text),`unknown dialogue text ${key}`);
      for(const c of n.choices) {
        check(Object.hasOwn(d.nodes,c.to),`unknown dialogue destination ${c.to}`);
        check(Object.hasOwn(QUEST_MESSAGES,c.label),'unknown choice text');
        check((c.when??[]).every(f=>flags.has(f)),`unknown dialogue condition ${key}`);
      }
    }
  }
  return errors;
}

export function validateStoryCatalogue():string[] {
  const errors:string[]=[];
  for(const [name,records] of [['chapters',CHAPTERS],['lore',LORE]] as const)if(new Set(records.map(r=>r.id)).size!==records.length)errors.push(`duplicate ${name} ID`);
  for(const c of CHAPTERS)for(const key of [c.title,c.act])if(!Object.hasOwn(QUEST_MESSAGES,key))errors.push(`${c.id}: unknown chapter text`);
  for(const l of LORE) {
    const q=QUESTS.find(q=>q.id===l.quest);
    if(!q||!Number.isInteger(l.afterStep)||l.afterStep<1||l.afterStep>q.steps.length)errors.push(`${l.id}: invalid lore unlock`);
    if(!Object.hasOwn(QUEST_MESSAGES,l.title)||!Object.hasOwn(QUEST_MESSAGES,l.text))errors.push(`${l.id}: unknown lore text`);
  }
  return errors;
}
