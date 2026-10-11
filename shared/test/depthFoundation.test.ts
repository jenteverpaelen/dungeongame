// Depth foundation (docs/rework/depth/FOUNDATION.md): data-driven runes, specialization nodes, point economy,
// power templates and passives. Fixture content lives in ./fixtures/depthContent.ts and never ships.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT_DATA, validateContent, type ContentData } from '../src/contentValidation';
import { createCharacter, setSkillRune } from '../src/character';
import { MAX_RUNES, SKILLS, runeUnlockLevel, skillsForClass } from '../src/data/skills';

function fixture(): ContentData {
  const { affixes, ...clonable } = CONTENT_DATA;
  return { ...structuredClone(clonable), affixes: affixes.map(a => ({ ...a, ranges: structuredClone(a.ranges) })) };
}
const expectPath = (errors: string[], path: string) => assert.ok(errors.some(e => e.startsWith(path + ':')), errors.join('\n'));

test('existing skills keep their unlock levels 1/2/4/6/9/12 and rune levels skill+2/+5/+9', () => {
  for (const classId of ['warrior', 'ranger', 'mage'] as const) {
    const list = skillsForClass(classId);
    assert.deepEqual(list.slice(0, 6).map(s => s.unlock), [1, 2, 4, 6, 9, 12]);
    for (const s of list.slice(0, 6)) assert.deepEqual(s.runes.map((_, i) => runeUnlockLevel(s, i)), [2, 5, 9].map(o => s.unlock + o));
  }
});

test('a skill may carry up to five runes with authored unlock levels; the rules reject a sixth and early unlocks', () => {
  assert.equal(MAX_RUNES, 5);
  const ok = fixture();
  const meteor = ok.skills.meteor;
  meteor.runes.push({ id: 'fx_fourth', name: 'Fixture Fourth', unlock: 30, desc: 'Fixture.', mods: {} },
    { id: 'fx_fifth', name: 'Fixture Fifth', unlock: 48, desc: 'Fixture.', mods: {} });
  assert.deepEqual(validateContent(ok), []);
  const six = fixture();
  six.skills.meteor.runes.push(...[4, 5, 6].map(n => ({ id: `fx_${n}`, name: `Fixture ${n}`, unlock: 40, desc: 'Fixture.', mods: {} })));
  expectPath(validateContent(six), 'skills.meteor.runes');
  const early = fixture();
  early.skills.meteor.runes[0].unlock = 1;
  expectPath(validateContent(early), 'skills.meteor.runes[0].unlock');
  const late = fixture();
  late.skills.meteor.runes[0].unlock = 71;
  expectPath(validateContent(late), 'skills.meteor.runes[0].unlock');
  const lateSkill = fixture();
  lateSkill.skills.hydra.unlock = 50; lateSkill.skills.hydra.runes.forEach((r, i) => { r.unlock = 52 + i * 6; });
  assert.deepEqual(validateContent(lateSkill), [], 'skills may unlock up to the level cap');
});

test('rune selection honours each rune’s own unlock level on the authoritative save path', () => {
  const save = createCharacter('RuneLevels', 'mage', 3);
  const meteor = SKILLS.meteor;
  const levels = meteor.runes.map((_, i) => runeUnlockLevel(meteor, i));
  save.level = levels[1] - 1;
  assert.equal(setSkillRune(save, 'meteor', meteor.runes[0].id), null);
  assert.match(setSkillRune(save, 'meteor', meteor.runes[1].id) ?? '', new RegExp(`level ${levels[1]}`));
  save.level = levels[1];
  assert.equal(setSkillRune(save, 'meteor', meteor.runes[1].id), null);
});
