import type { CharacterSave } from './types';

export const INTRO_REVISION=1;
export const INTRO_EVENTS=['move','dash','field','talk','kill','loot','level','claim','equip','skill','rune','service','elite','death','return'] as const;
export type IntroEvent=typeof INTRO_EVENTS[number];
export const INTRO_LESSONS=['move','dash','field','talk','kill','claim','equip','skill','elite','return'] as const;
export type IntroLesson=typeof INTRO_LESSONS[number];
export interface IntroState {
  revision:1;
  status:'active'|'skipped'|'complete';
  done:IntroEvent[];
  skipped:IntroLesson[];
}
export function validIntro(value:unknown):value is IntroState {
  if(!value||typeof value!=='object')return false;
  const v=value as IntroState;
  return v.revision===INTRO_REVISION&&['active','skipped','complete'].includes(v.status)
    &&Array.isArray(v.done)&&v.done.length<=INTRO_EVENTS.length&&new Set(v.done).size===v.done.length&&v.done.every(e=>INTRO_EVENTS.includes(e))
    &&Array.isArray(v.skipped)&&v.skipped.length<=INTRO_LESSONS.length&&new Set(v.skipped).size===v.skipped.length&&v.skipped.every(e=>INTRO_LESSONS.includes(e));
}
export function introLesson(save:CharacterSave):IntroLesson|undefined {
  const s=save.onboarding;
  return validIntro(s)&&s.status==='active'?INTRO_LESSONS.find(id=>!s.done.includes(id)&&!s.skipped.includes(id)):undefined;
}
export function startIntro(save:CharacterSave) {
  if(save.onboarding&&!validIntro(save.onboarding))return false; // Retain unsupported progress.
  if(!save.onboarding)save.onboarding={revision:1,status:'active',done:[],skipped:[]};
  else if(save.onboarding.status==='skipped')save.onboarding.status='active';
  return true;
}
/** Trusted server events only. Out-of-order actions count; skipping never fabricates accomplishment. */
export function recordIntro(save:CharacterSave,event:IntroEvent):boolean {
  const s=save.onboarding;
  if(!validIntro(s)||s.status!=='active'||s.done.includes(event))return false;
  s.done.push(event);
  if(INTRO_LESSONS.every(id=>s.done.includes(id)||s.skipped.includes(id)))s.status='complete';
  return true;
}
export function skipIntroLesson(save:CharacterSave,id:unknown):boolean {
  const s=save.onboarding;
  if(!validIntro(s)||s.status!=='active'||!INTRO_LESSONS.includes(id as IntroLesson))return false;
  if(!s.skipped.includes(id as IntroLesson)&&!s.done.includes(id as IntroEvent))s.skipped.push(id as IntroLesson);
  if(INTRO_LESSONS.every(e=>s.done.includes(e)||s.skipped.includes(e)))s.status='complete';
  return true;
}
/** Introduction is presentation, never service authority or a progression lock. */
export function introduced(save:CharacterSave|undefined|null,system:string):boolean {
  if(!save||!validIntro(save.onboarding)||save.onboarding.status!=='active')return true;
  switch(system) {
    case 'inventory':case 'character':return save.inventory.some(Boolean)||save.onboarding.done.includes('claim');
    case 'skills':return save.level>1;
    case 'paragon':return save.paragon.level>0;
    case 'adventure':return save.onboarding.done.includes('field');
    case 'runSummary':return save.onboarding.done.includes('elite');
    default:return true;
  }
}
