import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, equipItem, playerLook } from '../src/character';
import { INTRO_LESSONS,introLesson,introduced,recordIntro,skipIntroLesson,startIntro,validIntro } from '../src/onboarding';
import { appearanceFor,isHeroAppearance } from '../src/appearance';
import { CLASS_IDS,CLASSES } from '../src/data/classes';
import { starterUpgrade } from '../src/items';
import { Rng } from '../src/math';
import { computeStats } from '../src/stats';

test('returning heroes stay unchanged; skipping is not accomplishment; out-of-order progress survives resume',()=>{
  const s=createCharacter('Introfixture','mage',17),before=structuredClone(s);
  assert.equal(introLesson(s),undefined);assert(!recordIntro(s,'kill'));assert.deepEqual(s,before);
  assert(startIntro(s));assert.equal(introLesson(s),'move');assert(!introduced(s,'skills'));
  assert(recordIntro(s,'elite'));assert(!recordIntro(s,'elite'));assert(skipIntroLesson(s,'move'));
  assert.equal(introLesson(s),'dash');assert(!s.onboarding!.done.includes('move'));
  s.onboarding!.status='skipped';assert(introduced(s,'skills'));assert(!recordIntro(s,'dash'));
  assert(startIntro(s));assert.equal(introLesson(s),'dash');assert.deepEqual(s.onboarding!.done,['elite']);
  for(const id of INTRO_LESSONS)skipIntroLesson(s,id);
  assert.equal(s.onboarding!.status,'complete');assert.equal(introLesson(s),undefined);
  assert.deepEqual(s.onboarding!.done,['elite']);assert(startIntro(s));assert.equal(s.onboarding!.status,'complete');
});
test('unavailable progress is retained instead of reset; malformed or duplicate events are rejected',()=>{
  const s=createCharacter('Futureintro','warrior',1);
  s.onboarding={revision:99,payload:'keep'} as any;const before=structuredClone(s);
  assert(!startIntro(s));assert(!recordIntro(s,'move'));assert(!skipIntroLesson(s,'move'));assert.deepEqual(s,before);
  assert(!validIntro({revision:1,status:'active',done:['move','move'],skipped:[]}));
  assert(!validIntro({revision:1,status:'active',done:['injected'],skipped:[]}));
});
test('all original palettes can be mixed without changing the default or gameplay class',()=>{
  for(const cls of CLASS_IDS){
    const s=createCharacter('Palette'+cls,cls,1);assert.deepEqual(appearanceFor(cls),CLASSES[cls].appearance);
    const choice={skin:'ranger',hair:'mage',style:'warrior'} as const;s.appearance=choice;
    assert(isHeroAppearance(choice));assert.deepEqual(playerLook(s).appearance,choice);assert.equal(s.classId,cls);
    assert.equal(appearanceFor(cls,choice).skin,CLASSES.ranger.appearance.skin);
    assert.equal(appearanceFor(cls,choice).hairStyle,CLASSES.warrior.appearance.hairStyle);
  }
  for(const value of [null,{},[],{skin:'__proto__',hair:'mage',style:'warrior'},{skin:'mage',hair:'mage',style:'mage',extra:1}])assert(!isHeroAppearance(value));
});
test('one-time road weapon improves every class starter with the same speed/base and no toughness or recovery loss',()=>{
  for(const cls of CLASS_IDS)for(let seed=1;seed<=40;seed++){
    const s=createCharacter('Reward'+cls,cls,seed),before=computeStats(s),old=s.equipment.mainhand!;
    const reward=starterUpgrade(new Rng(seed+100),cls);assert.equal(reward.base,old.base);assert.equal(reward.weapon!.aps,old.weapon!.aps);
    assert(reward.weapon!.min>=old.weapon!.min);assert(reward.weapon!.max>=old.weapon!.max);
    assert.equal(reward.rarity,'magic');assert.equal(reward.reqLevel,1);assert.equal(reward.affixes.length,1);
    s.inventory[0]=reward;assert.equal(equipItem(s,reward.id),null);const after=computeStats(s);
    assert(after.sheetDps>before.sheetDps,`${cls} ${seed}`);assert(after.toughness>=before.toughness);assert(after.recovery>=before.recovery);
  }
});
