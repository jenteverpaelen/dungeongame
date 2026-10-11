import {AFFIX_BY_STAT,affixScale} from './data/items';
import {SKILLS} from './data/skills';
import type {CharacterSave,ClassId} from './types';
import {powerText,type PowerEffect} from './powers';
import type {PowerSource} from './powerSources';
import {WARRIOR_PASSIVES} from './data/passives/warrior';
import {RANGER_PASSIVES} from './data/passives/ranger';
import {MAGE_PASSIVES} from './data/passives/mage';

/** L116/D054: limited slots, existing mean head-affix budgets, no new point currency. Four slots stay (owner). */
export const PASSIVE_SLOT_LEVELS=[10,20,30,70] as const;
export interface PassiveState {revision:1;slots:(string|null)[]}
export type PassiveStat='skillDmg'|'resourceRegen'|'cdr'|'lifePct'|'armor'|'allRes';
/**
 * A passive is a stat passive (`stat`, value = the level-scaled head-affix mean), a build-defining passive (`effects`:
 * power templates such as conditionals, procs or skill flags, with player `text` validated against them), or both.
 * Data: shared/src/data/passives/<class>.ts (append; ids are persisted in saves).
 */
export interface PassiveDef {
  id:string;classId:ClassId;name:string;unlock:number;note:string;
  stat?:PassiveStat;skill?:string;
  effects?:PowerEffect[];
  /** Effect text for template passives (generated from `effects` when absent). */
  text?:string;
}
/** Registry order: warrior, ranger, mage, each in file order (the order of the picker). */
export const PASSIVES:PassiveDef[]=[...WARRIOR_PASSIVES,...RANGER_PASSIVES,...MAGE_PASSIVES];
const byId=(id:unknown)=>typeof id==='string'?PASSIVES.find(p=>p.id===id):undefined;
export const passivesForClass=(id:ClassId)=>PASSIVES.filter(p=>p.classId===id);
export function validPassiveState(state:unknown,classId:ClassId):state is PassiveState {
  if(!state||typeof state!=='object')return false;
  const s=state as PassiveState;
  return s.revision===1&&Array.isArray(s.slots)&&s.slots.length===PASSIVE_SLOT_LEVELS.length
    &&s.slots.every(id=>id===null||(typeof id==='string'&&byId(id)?.classId===classId))
    &&new Set(s.slots.filter(id=>id!==null)).size===s.slots.filter(id=>id!==null).length;
}
/** Unsupported records are retained but never contribute stats. Locked selections stay dormant. */
export function activePassives(save:Pick<CharacterSave,'classId'|'level'|'passives'>):PassiveDef[]{
  if(!validPassiveState(save.passives,save.classId))return [];
  return save.passives.slots.flatMap((id,i)=>{
    const p=id?byId(id):undefined;
    return p&&save.level>=PASSIVE_SLOT_LEVELS[i]&&save.level>=p.unlock?[p]:[];
  });
}
/** Stat value of a stat passive at `level` (0 for template-only passives). */
export function passiveValue(p:PassiveDef,level:number):number {
  if(!p.stat)return 0;
  const affix=AFFIX_BY_STAT[p.stat],range=affix.ranges.head!,raw=(range[0]+range[1])/2*affixScale(affix.scale,level);
  return affix.scale==='pct'?Math.round(raw*10)/10:Math.max(1,Math.round(raw));
}
export function passiveEffect(p:PassiveDef,level:number):string {
  const parts:string[]=[];
  if(p.stat)parts.push(AFFIX_BY_STAT[p.stat].label(passiveValue(p,level),p.skill?SKILLS[p.skill].name:undefined));
  if(p.effects?.length)parts.push(p.text??powerText(p.effects));
  return parts.join(' ');
}
export function setPassive(save:CharacterSave,slot:unknown,id:unknown):string|null {
  if(!Number.isInteger(slot)||typeof slot!=='number'||slot<0||slot>=PASSIVE_SLOT_LEVELS.length)return 'Choose a valid passive slot';
  if(save.passives!==undefined&&!validPassiveState(save.passives,save.classId))return 'This passive record needs a supported game version';
  if(save.level<PASSIVE_SLOT_LEVELS[slot])return `This passive slot unlocks at level ${PASSIVE_SLOT_LEVELS[slot]}`;
  if(id!==null){
    if(typeof id!=='string'||byId(id)?.classId!==save.classId)return 'Choose a passive for your class';
    if(save.level<byId(id)!.unlock)return `This passive unlocks at level ${byId(id)!.unlock}`;
  }
  const slots=save.passives?.slots.slice()??PASSIVE_SLOT_LEVELS.map(()=>null);
  if(id!==null&&slots.some((x,i)=>i!==slot&&x===id))return 'That passive is already equipped in another slot';
  slots[slot]=id as string|null;save.passives={revision:1,slots};return null;
}
/** Power-template sources of the active (slotted, unlocked) passives, in slot order. */
export function passivePowerSources(save:Pick<CharacterSave,'classId'|'level'|'passives'>):PowerSource[]{
  return activePassives(save).flatMap(p=>p.effects?.length?[{kind:'passive' as const,id:p.id,roll:1,effects:p.effects}]:[]);
}
