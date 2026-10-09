import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT_DATA, validateContent, type ContentData } from '../src/contentValidation';

function fixture(): ContentData {
  const { affixes, ...clonable } = CONTENT_DATA;
  return { ...structuredClone(clonable), affixes: affixes.map(a=>({...a,ranges:structuredClone(a.ranges)})) };
}
const expectPath = (errors: string[], path: string) => assert.ok(errors.some(e=>e.startsWith(path+':')),errors.join('\n'));

test('lob definitions require a positive finite landing radius and flight time',()=>{
  for(const key of ['aoe','flightMs'] as const)for(const value of [undefined,0,-1,NaN,Infinity]) {
    const data=fixture();data.monsters.reedclaw.attack[key]=value;
    expectPath(validateContent(data),`monsters.reedclaw.attack.${key}`);
  }
  const data=fixture();data.monsters.thornling.attack.flightMs=900;
  expectPath(validateContent(data),'monsters.thornling.attack.flightMs');
});

test('current authored registries satisfy their consumers without changing content', () => {
  const before = JSON.stringify(CONTENT_DATA);
  assert.deepEqual(validateContent(), []);
  assert.equal(JSON.stringify(CONTENT_DATA), before);
});

test('missing, inherited and wrong-class references identify the offending definitions', () => {
  const data=fixture();
  data.classes.warrior.primary='magic_missile';
  data.legendaries.cindervane.base='constructor';
  data.sets.endless_storm.pieces[0].base='missing_base';
  data.fieldIds.push('hearthmere');
  data.guardians.glade='missing_monster';
  const errors=validateContent(data);
  for(const path of ['classes.warrior.primary','legendaries.cindervane.base','sets.endless_storm.pieces.missing_base','fieldIds','guardians.glade']) expectPath(errors,path);
  assert.deepEqual(validateContent(),[],'mutation fixture must not affect live registries');
});

test('bad IDs, duplicate lookup keys, NaN quantities and reversed ranges are rejected', () => {
  const data=fixture();
  data.skills.cleave.id='wrong_id';
  data.skills.meteor.runes[1].id=data.skills.meteor.runes[0].id;
  data.affixes.push(data.affixes[0]);
  data.skills.meteor.cost=NaN;
  data.legendaries.cindervane.range=[200,150];
  data.monsters.bog_slime.radius=0;
  const errors=validateContent(data);
  for(const path of ['skills.cleave.id','skills.meteor.runes','affixes.stat','skills.meteor.cost','legendaries.cindervane.range','monsters.bog_slime.radius']) expectPath(errors,path);
});

test('missing indexed values and unresolved player text fail before release', () => {
  const data=fixture();
  data.runeOffsets.pop();
  data.tierCosts.pop();
  data.gems.ruby.weapon.values.pop();
  data.skills.meteor.desc+=' {missing_value}';
  data.sets.endless_storm.bonuses[0].count=data.sets.endless_storm.pieces.length+1;
  const errors=validateContent(data);
  for(const path of ['skills.meteor.runes','skills.meteor.tiers','gems.ruby.weapon','skills.meteor.desc','sets.endless_storm.bonuses.count']) expectPath(errors,path);
});

test('signature references survive display wording changes but reject missing/inherited/wrong-class identities', () => {
  const renamed=fixture();
  renamed.skills.whirlwind.name='Synthetic renamed skill';
  renamed.classes.warrior.signature='Independent synthetic display wording';
  assert.deepEqual(validateContent(renamed), []);
  for (const id of ['missing_skill','constructor','magic_missile']) {
    const data=fixture(); data.classes.warrior.signatureSkill=id;
    expectPath(validateContent(data),'classes.warrior.signatureSkill');
  }
});

test('automatic-cast thresholds and query distances reject nonfinite or negative authoring values', () => {
  for (const value of [NaN, Infinity, -Infinity, -1]) {
    const data=fixture();
    data.skills.meteor.auto={when:'enemiesNear',count:value,within:value};
    data.skills.whirlwind.auto={when:'channel',startAt:value,within:value};
    const errors=validateContent(data);
    assert.equal(errors.length,4,errors.join('\n'));
    for(const path of ['skills.meteor.auto.count','skills.meteor.auto.within','skills.whirlwind.auto.startAt','skills.whirlwind.auto.within']) expectPath(errors,path);
  }
});

test('automatic-cast validation preserves finite zero, fractional and above-base thresholds', () => {
  for (const value of [0,0.5,1000]) {
    const data=fixture();
    data.skills.meteor.auto={when:'enemiesNear',count:value,within:value};
    data.skills.whirlwind.auto={when:'channel',startAt:value,within:value};
    // Signed modifiers retain their different semantics (reductions are valid).
    data.skills.meteor.tiers[0].mods={cost:-25,duration:-10};
    assert.deepEqual(validateContent(data),[]);
  }
  assert.deepEqual(validateContent(),[],'fixtures must not alter authored data');
});
