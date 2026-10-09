import { recordIntro, skipIntroLesson, startIntro, validIntro } from '../../shared/src/onboarding';
import type { Session } from './net/session';
import { fail,ok } from './world';

export function onboardingCommand(s:Session,a:Record<string,unknown>) {
  if(Object.keys(a).some(k=>k!=='action'&&k!=='lesson'))return fail('Unknown introduction option');
  if(a.action==='start') {
    if(!startIntro(s.save))return fail('This introduction revision is unavailable; progress is retained');
  } else if(a.action==='skip') {
    if(!validIntro(s.save.onboarding))return fail('No active introduction');
    if(s.save.onboarding.status==='active')s.save.onboarding.status='skipped';
  } else if(a.action==='skipLesson') {
    if(!skipIntroLesson(s.save,a.lesson))return fail('Unknown or inactive lesson');
  } else return fail('Unknown introduction action');
  s.changed(false);return ok();
}

/** Successful operations, never attempted commands or client-reported accomplishments. */
export function introCommandResult(s:Session,op:string,a:Record<string,unknown>) {
  if(op==='equip')return recordIntro(s.save,'equip');
  if(op==='skillTier')return recordIntro(s.save,'skill');
  if(op==='skillRune')return recordIntro(s.save,'rune');
  if(op==='quest'&&a.action==='accept')return recordIntro(s.save,'talk');
  if(op==='quest'&&a.action==='claim'&&a.quest==='first_road')return recordIntro(s.save,'claim');
  return false;
}
