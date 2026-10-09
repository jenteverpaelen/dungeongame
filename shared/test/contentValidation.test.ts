import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT_DATA, validateContent, type ContentData } from '../src/contentValidation';

function fixture(): ContentData {
  const { affixes, ...clonable } = CONTENT_DATA;
  return { ...structuredClone(clonable), affixes: affixes.map(a=>({...a,ranges:structuredClone(a.ranges)})) };
}
const expectPath = (errors: string[], path: string) => assert.ok(errors.some(e=>e.startsWith(path+':')),errors.join('\n'));

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
