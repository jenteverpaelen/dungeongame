import {AFFIX_BY_STAT,affixScale} from './data/items';
import {SKILLS} from './data/skills';
import type {CharacterSave,ClassId} from './types';

/** L116/D054: limited slots, existing mean head-affix budgets, no new point currency. */
export const PASSIVE_SLOT_LEVELS=[10,20,30,70] as const;
export interface PassiveState {revision:1;slots:(string|null)[]}
export interface PassiveDef {
  id:string;classId:ClassId;name:string;unlock:number;note:string;
  stat:'skillDmg'|'resourceRegen'|'cdr'|'lifePct'|'armor'|'allRes';skill?:string;
}
const catalogue:Record<ClassId,{names:string[];skills:[string,string];notes:[string,string];defense:'armor'|'allRes'}>={
  warrior:{names:['Turning Edge','Fault Reader','Banked Fury','Measured Recovery','Rooted Heart','Iron Poise'],skills:['whirlwind','seismic_slam'],
    notes:['Specialise in sustained close-range sweeps.','Specialise in striking along a broken front.'],defense:'armor'},
  ranger:{names:['Wide Horizon','Watchmaker','Quiet Reserve','Patient Timing','Trail Heart','Weathered Guard'],skills:['multishot','sentry'],
    notes:['Specialise in covering a broad firing line.','Specialise in damage from placed sentries.'],defense:'armor'},
  mage:{names:['Falling Measure','Coiled Flame','Deep Current','Return Pattern','Steady Vessel','Prism Mantle'],skills:['meteor','hydra'],
    notes:['Specialise in the impact of falling spells.','Specialise in damage from summoned hydras.'],defense:'allRes'},
};
export const PASSIVES:readonly PassiveDef[]=Object.entries(catalogue).flatMap(([id,c])=>{
  const classId=id as ClassId;
  return [
    ...c.skills.map((skill,i)=>({id:`${id}_${skill}`,classId,name:c.names[i],unlock:10,stat:'skillDmg' as const,skill,note:c.notes[i]})),
    {id:`${id}_reserve`,classId,name:c.names[2],unlock:20,stat:'resourceRegen' as const,note:'Recover more resource between costly skills.'},
    {id:`${id}_timing`,classId,name:c.names[3],unlock:30,stat:'cdr' as const,note:'Bring cooldown skills back sooner. Existing cooldowns are not reset.'},
    {id:`${id}_heart`,classId,name:c.names[4],unlock:40,stat:'lifePct' as const,note:'Carry more life into dangerous encounters. Changing this preserves your life percentage.'},
    {id:`${id}_guard`,classId,name:c.names[5],unlock:50,stat:c.defense,note:'Strengthen your defenses when damage matters more than speed.'},
  ];
});
const byId=new Map(PASSIVES.map(p=>[p.id,p]));
export const passivesForClass=(id:ClassId)=>PASSIVES.filter(p=>p.classId===id);
export function validPassiveState(state:unknown,classId:ClassId):state is PassiveState {
  if(!state||typeof state!=='object')return false;
  const s=state as PassiveState;
  return s.revision===1&&Array.isArray(s.slots)&&s.slots.length===PASSIVE_SLOT_LEVELS.length
    &&s.slots.every(id=>id===null||(typeof id==='string'&&byId.get(id)?.classId===classId))
    &&new Set(s.slots.filter(id=>id!==null)).size===s.slots.filter(id=>id!==null).length;
}
/** Unsupported records are retained but never contribute stats. Locked selections stay dormant. */
export function activePassives(save:Pick<CharacterSave,'classId'|'level'|'passives'>):PassiveDef[]{
  if(!validPassiveState(save.passives,save.classId))return [];
  return save.passives.slots.flatMap((id,i)=>{
    const p=id?byId.get(id):undefined;
    return p&&save.level>=PASSIVE_SLOT_LEVELS[i]&&save.level>=p.unlock?[p]:[];
  });
}
export function passiveValue(p:PassiveDef,level:number):number {
  const affix=AFFIX_BY_STAT[p.stat],range=affix.ranges.head!,raw=(range[0]+range[1])/2*affixScale(affix.scale,level);
  return affix.scale==='pct'?Math.round(raw*10)/10:Math.max(1,Math.round(raw));
}
export function passiveEffect(p:PassiveDef,level:number):string {
  return AFFIX_BY_STAT[p.stat].label(passiveValue(p,level),p.skill?SKILLS[p.skill].name:undefined);
}
export function setPassive(save:CharacterSave,slot:unknown,id:unknown):string|null {
  if(!Number.isInteger(slot)||typeof slot!=='number'||slot<0||slot>=PASSIVE_SLOT_LEVELS.length)return 'Choose a valid passive slot';
  if(save.passives!==undefined&&!validPassiveState(save.passives,save.classId))return 'This passive record needs a supported game version';
  if(save.level<PASSIVE_SLOT_LEVELS[slot])return `This passive slot unlocks at level ${PASSIVE_SLOT_LEVELS[slot]}`;
  if(id!==null){
    if(typeof id!=='string'||byId.get(id)?.classId!==save.classId)return 'Choose a passive for your class';
    if(save.level<byId.get(id)!.unlock)return `This passive unlocks at level ${byId.get(id)!.unlock}`;
  }
  const slots=save.passives?.slots.slice()??PASSIVE_SLOT_LEVELS.map(()=>null);
  if(id!==null&&slots.some((x,i)=>i!==slot&&x===id))return 'That passive is already equipped in another slot';
  slots[slot]=id as string|null;save.passives={revision:1,slots};return null;
}
