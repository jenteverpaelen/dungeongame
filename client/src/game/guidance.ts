import type { CharacterSave } from '@shared/types';
import { validIntro } from '@shared/onboarding';
import { canClassUse } from '@shared/items';
import { skillsForClass, runeUnlockLevel, TIER_COSTS } from '@shared/data/skills';
import type { NpcRole } from '@shared/mapgen';

export const HINT_IDS=['steer','gear','points','bag','death','quest','reward','services','loot','level','rune','elite','legendary','cube','rift'] as const;
export type HintId=typeof HINT_IDS[number];
interface Progress { automatic:boolean; dismissed:HintId[] }
interface GuidanceState { characters:Record<string,Progress>; retained:boolean }
interface Storage { getItem(key:string):string|null;setItem(key:string,value:string):void }
export const GUIDANCE_KEY='hearthfall.guidance.v1';

export class GuidanceStore {
  private state:GuidanceState={characters:Object.create(null),retained:false};
  private listeners=new Set<()=>void>();
  constructor(private storage?:Storage) {
    this.state.retained=!!storage;
    try {
      const raw=storage?.getItem(GUIDANCE_KEY),data=raw&&JSON.parse(raw);
      if(data?.version===1&&data.characters&&typeof data.characters==='object')for(const [id,p] of Object.entries(data.characters)) {
        const value=p as Partial<Progress>|null;
        if(value&&typeof value.automatic==='boolean'&&Array.isArray(value.dismissed))this.state.characters[id]={automatic:value.automatic,dismissed:HINT_IDS.filter(h=>value.dismissed!.includes(h))};
      }
    } catch { this.state.retained=false; }
  }
  get=()=>this.state;
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return ()=>{this.listeners.delete(fn);};};
  ensure(save:CharacterSave) {
    if(Object.hasOwn(this.state.characters,save.id))return;
    this.update(save.id,{automatic:save.level===1&&save.stats.kills===0,dismissed:[]});
  }
  enable(id:string,automatic:boolean){this.update(id,{...(this.state.characters[id]??{dismissed:[]}),automatic});}
  dismiss(id:string,hint:HintId,hidden=true) {
    const old=this.state.characters[id]??{automatic:false,dismissed:[]};
    this.update(id,{...old,dismissed:HINT_IDS.filter(h=>h===hint?hidden:old.dismissed.includes(h))});
  }
  private update(id:string,value:Progress) {
    const characters=Object.assign(Object.create(null),this.state.characters,{[id]:value});let retained=false;
    try{if(this.storage){this.storage.setItem(GUIDANCE_KEY,JSON.stringify({version:1,characters}));retained=true;}}catch{/* Cosmetic choices keep working for this session. */}
    this.state={characters,retained};for(const fn of this.listeners)fn();
  }
}

/** Uses current authoritative state; no timers, extra rewards or inferred item superiority. */
export function eligibleHints(save:CharacterSave,zone:string,role?:NpcRole,elite=false):HintId[] {
  const result:HintId[]=[];
  const intro=validIntro(save.onboarding)?save.onboarding:undefined;
  if(save.inventory.length>0&&save.inventory.every(Boolean))result.push('bag');
  if(save.stats.deaths>0)result.push('death');
  if((save.rillwake?.claimed&&save.rillwake.reward&&save.inventory.some(i=>i?.id===save.rillwake!.reward!.id))||(intro?.done.includes('claim')&&!intro.done.includes('equip')&&save.inventory.some(Boolean)))result.push('reward');
  if(elite)result.push('elite');
  if(save.stats.legendaries>0||save.inventory.some(i=>i?.rarity==='legendary'||i?.rarity==='set'))result.push('legendary');
  if(role==='cube')result.push('cube');
  if(role==='obelisk'||zone==='rift')result.push('rift');
  if(skillsForClass(save.classId).some(s=>s.unlock<=save.level&&s.runes.some((_,i)=>runeUnlockLevel(s,i)<=save.level)))result.push('rune');
  if(save.level>1)result.push('level');
  if(intro?.done.includes('loot')||save.inventory.some(Boolean))result.push('loot');
  if(skillsForClass(save.classId).some(s=>s.unlock<=save.level&&(save.skills.tiers[s.id]??0)<TIER_COSTS.length&&save.skillPoints>=TIER_COSTS[save.skills.tiers[s.id]??0]))result.push('points');
  if(save.inventory.some(i=>i&&i.reqLevel<=save.level&&canClassUse(save.classId,i)))result.push('gear');
  if(zone==='rillwake_crossing'&&!save.rillwake)result.push('quest');
  if(role==='blacksmith'||role==='jeweler'||role==='mystic')result.push('services');
  if(save.level===1&&save.stats.kills===0)result.push('steer');
  return result;
}
function storage():Storage|undefined {try{return typeof window==='undefined'?undefined:window.localStorage;}catch{return undefined;}}
export const guidance=new GuidanceStore(storage());
