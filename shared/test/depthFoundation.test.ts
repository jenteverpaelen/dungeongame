// Depth foundation (docs/rework/depth/FOUNDATION.md): data-driven runes, specialization nodes, point economy,
// power templates and passives. Fixture content lives in ./fixtures/depthContent.ts and never ships.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT_DATA, validateContent, type ContentData } from '../src/contentValidation';
import { createCharacter, loadoutMods, resetSkillPoints, setPrimarySkill, setSkillRune } from '../src/character';
import { MAX_RUNES, SKILLS, collectSkillMods, describeNode, runeUnlockLevel, skillTags, skillsForClass } from '../src/data/skills';
import { MAX_LEVEL } from '../src/constants';
import {
  NODE_RANK_COST, SPEC_POINTS, TREE_RANKS_TARGET, buySkillNode, type SpecEconomy, nodeBuyError, normalizeSkillNodes, refundSkillNode, resetSkillNodes,
  specPointsAvailable, specPointsForLevel, specPointsSpent, treeBuyableRanks, treeTotalRanks,
} from '../src/specialization';
import { FIXTURE_NODES, FIXTURE_PASSIVES, installFixtureNodes, installFixturePassives, installFixtureSkills } from './fixtures/depthContent';
import { PASSIVE_SLOT_LEVELS, passiveEffect, passivePowerSources as passiveSources, passivesForClass, setPassive } from '../src/passives';
import { computeStats } from '../src/stats';

function fixture(): ContentData {
  const { affixes, ...clonable } = CONTENT_DATA;
  return { ...structuredClone(clonable), affixes: affixes.map(a => ({ ...a, ranges: structuredClone(a.ranges) })) };
}
const expectPath = (errors: string[], path: string) => assert.ok(errors.some(e => e.startsWith(path + ':')), errors.join('\n'));

test('existing skills keep their unlock levels 1/2/4/6/9/12 and rune levels skill+2/+5/+9 (+14/+20 for the bible runes)', () => {
  for (const classId of ['warrior', 'ranger', 'mage'] as const) {
    const list = skillsForClass(classId);
    assert.deepEqual(list.slice(0, 6).map(s => s.unlock), [1, 2, 4, 6, 9, 12]);
    // Runes 4 and 5 (bible v2) unlock at skill + 14 / + 20, clamped to the level cap.
    for (const s of list.slice(0, 6)) assert.deepEqual(s.runes.map((_, i) => runeUnlockLevel(s, i)), [2, 5, 9, 14, 20].slice(0, s.runes.length).map(o => Math.min(MAX_LEVEL, s.unlock + o)));
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

// ─────────────────────────── Specialization nodes ───────────────────────────

test('only the warrior (pilot class) ships specialization trees so far; fixture trees validate', () => {
  for (const s of Object.values(SKILLS)) assert.equal(!!s.nodes?.length, s.classId === 'warrior', `${s.id} trees`);
  const data = fixture();
  for (const [id, nodes] of Object.entries(FIXTURE_NODES)) data.skills[id].nodes = structuredClone(nodes);
  assert.deepEqual(validateContent(data), []);
});

test('node validation rejects bad ranks, prerequisites, cycles, layout and placeholders', () => {
  type Nodes = NonNullable<ContentData['skills'][string]['nodes']>;
  const cases: [string, (n: Nodes) => void][] = [
    ['skills.whirlwind.nodes.fx_gale.ranks', n => { n[0].ranks.pop(); }],
    ['skills.whirlwind.nodes.fx_gale.maxRank', n => { n[0].maxRank = 4; n[0].ranks.push({ dmg: 1 }); }],
    ['skills.whirlwind.nodes.fx_reach.requires', n => { n[1].requires = [{ node: 'missing', rank: 1 }]; }],
    ['skills.whirlwind.nodes.fx_reach.requires', n => { n[1].requires = [{ node: 'fx_gale', rank: 4 }]; }],
    ['skills.whirlwind.nodes.fx_gale.requires', n => { n[0].requires = [{ node: 'fx_eye', rank: 1 }]; }],
    ['skills.whirlwind.nodes.fx_reach.pos', n => { n[1].pos = { ...n[0].pos }; }],
    ['skills.whirlwind.nodes.fx_reach.pos', n => { n[1].pos = { col: 3, row: 0 }; }],
    ['skills.whirlwind.nodes.fx_gale.text', n => { n[0].text = 'Costs {cost}% less.'; }],
    ['skills.whirlwind.nodes.fx_gale.text', n => { n[0].text = 'Unknown {thing}.'; }],
    ['skills.whirlwind.nodes.fx_devils.unlock', n => { n[3].unlock = 1; }],
    ['skills.whirlwind.nodes.fx_gale.ranks[1].dmg', n => { n[0].ranks[1].dmg = NaN; }],
  ];
  for (const [path, mutate] of cases) {
    const data = fixture();
    data.skills.whirlwind.nodes = structuredClone(FIXTURE_NODES.whirlwind);
    mutate(data.skills.whirlwind.nodes);
    expectPath(validateContent(data), path);
  }
});

test('point economy (lead decision d): one specialization point per level from 21, 50 at level 70, 10 ranks per tree', () => {
  assert.equal(specPointsForLevel(20), 0);
  assert.equal(specPointsForLevel(21), 1);
  assert.equal(specPointsForLevel(40), 20);
  assert.equal(specPointsForLevel(MAX_LEVEL), 50);
  assert.equal(SPEC_POINTS.treeRankCap, 10);
  assert.equal(NODE_RANK_COST, 1);
  // 50 points against 10-rank trees: exactly the five active trees of one bar (primary + four slots), never a class.
  assert.equal(specPointsForLevel(MAX_LEVEL) / TREE_RANKS_TARGET.max, 5);
  // Fixture trees hold more ranks than the cap, so a full tree is a choice.
  for (const id of Object.keys(FIXTURE_NODES)) assert(FIXTURE_NODES[id].reduce((n, x) => n + x.maxRank, 0) > SPEC_POINTS.treeRankCap, `${id} fixture tree`);
});

test('shipped trees respect the economy target per class (no-op until a class ships trees)', () => {
  for (const classId of ['warrior', 'ranger', 'mage'] as const) {
    const trees = skillsForClass(classId).filter(s => s.nodes?.length);
    if (!trees.length) continue;
    const avg = trees.reduce((n, s) => n + treeBuyableRanks(s), 0) / trees.length; // after SPEC_POINTS.treeRankCap
    assert(avg >= TREE_RANKS_TARGET.min && avg <= TREE_RANKS_TARGET.max, `${classId} average tree ${avg} ranks`);
    assert(trees.length * avg > specPointsForLevel(MAX_LEVEL), `${classId}: every tree must not be affordable at level 70`);
    // A real choice inside each tree: the cap buys at most about five sixths of a tree's ranks.
    for (const s of trees) assert(SPEC_POINTS.treeRankCap / treeTotalRanks(s) <= 0.84, `${s.id}: ${treeTotalRanks(s)} ranks for a cap of ${SPEC_POINTS.treeRankCap}`);
  }
});

/** The foundation's original economy (one point per level from 2, whole trees): exercises the rules at low levels. */
const FROM_L2: SpecEconomy = { source: 'separate', perLevel: 1, fromLevel: 2, treeRankCap: Infinity };

test('buying and refunding ranks follows level, prerequisites, budget and dependants', () => {
  const undo = installFixtureNodes();
  try {
    const save = createCharacter('NodeRules', 'warrior', 7);
    save.level = 10;
    assert.match(nodeBuyError(save, 'whirlwind', 'fx_reach', FROM_L2) ?? '', /Requires Placeholder Gale rank 1/);
    assert.equal(buySkillNode(save, 'whirlwind', 'fx_gale', FROM_L2), null);
    assert.equal(buySkillNode(save, 'whirlwind', 'fx_reach', FROM_L2), null);
    assert.equal(buySkillNode(save, 'whirlwind', 'fx_reach', FROM_L2), null);
    assert.match(buySkillNode(save, 'whirlwind', 'fx_reach', FROM_L2) ?? '', /highest rank/);
    assert.match(buySkillNode(save, 'whirlwind', 'fx_devils', FROM_L2) ?? '', /unlocks at level 20/);
    assert.match(refundSkillNode(save, 'whirlwind', 'fx_gale', FROM_L2) ?? '', /needs Placeholder Gale rank 1/);
    assert.equal(specPointsSpent(save), 3); assert.equal(specPointsAvailable(save, FROM_L2), 9 - 3);
    assert.match(nodeBuyError(save, 'whirlwind', 'fx_thrift') ?? '', /No specialization points left/, 'shipped economy: no points before level 21');
    for (const bad of [['meteor', 'fx_mass'], ['whirlwind', 'missing'], ['__proto__', 'x'], [7, 'fx_gale'], ['whirlwind', null]] as const)
      assert(nodeBuyError(save, bad[0], bad[1], FROM_L2), `${String(bad[0])}/${String(bad[1])} must be rejected`);
    save.level = 3;
    const before = structuredClone(save.skills.nodes);
    assert.match(buySkillNode(save, 'whirlwind', 'fx_thrift', FROM_L2) ?? '', /No specialization points left/);
    assert.deepEqual(save.skills.nodes, before, 'a rejected purchase changes nothing');
    assert.equal(refundSkillNode(save, 'whirlwind', 'fx_reach', FROM_L2), null);
    assert.equal(save.skills.nodes!.whirlwind.fx_reach, 1);
    assert.equal(resetSkillNodes(save, 'whirlwind', FROM_L2), 2);
    assert.deepEqual(save.skills.nodes, {});
  } finally { undo(); }
});

test('node ranks reach skill modifiers through the same path as runes and tiers; text shows cumulative values', () => {
  const undo = installFixtureNodes();
  try {
    const save = createCharacter('NodeMods', 'warrior', 7);
    save.level = 70; save.skills.tiers.whirlwind = 3; save.skills.runes.whirlwind = 'volcanic_eruption';
    const plain = loadoutMods(save, 'whirlwind');
    for (const n of ['fx_gale', 'fx_gale', 'fx_thrift', 'fx_edge', 'fx_edge']) assert.equal(buySkillNode(save, 'whirlwind', n), null);
    const m = loadoutMods(save, 'whirlwind');
    assert.equal(m.dmg, (plain.dmg ?? 0) + 20);
    assert.equal(m.cost, (plain.cost ?? 0) - 5);
    assert.equal(m.vars?.fxEdge, 2);
    assert.equal(m.element, 'fire', 'rune conversion kept');
    assert.equal(collectSkillMods(SKILLS.whirlwind, null, 0, { fx_gale: 9 }).dmg, 30, 'ranks clamp to maxRank');
    assert.equal(describeNode(FIXTURE_NODES.whirlwind[0], 2), 'Whirlwind deals 20% more damage.');
    assert.equal(describeNode(FIXTURE_NODES.whirlwind[2], 3), 'Whirlwind costs 15% less Fury.');
    const freed = resetSkillPoints(save);
    assert.deepEqual(freed, { tierPoints: 12, nodePoints: 5 });
    assert.deepEqual(save.skills.nodes, {}); assert.deepEqual(save.skills.tiers, {});
  } finally { undo(); }
});

test('save normalisation keeps legal trees and clears illegal ones (free respec, nothing lost)', () => {
  const undo = installFixtureNodes();
  try {
    const save = createCharacter('NodeSave', 'warrior', 7);
    save.level = 40;
    save.skills.nodes = { whirlwind: { fx_gale: 3, fx_reach: 2 } };
    normalizeSkillNodes(save);
    assert.deepEqual(save.skills.nodes, { whirlwind: { fx_gale: 3, fx_reach: 2 } });
    for (const bad of [{ whirlwind: { fx_reach: 1 } }, { whirlwind: { fx_gale: 4 } }, { whirlwind: { gone: 1 } }, { meteor: { fx_mass: 1 } },
      { removed_skill: { a: 1 } }, { whirlwind: { fx_gale: 1.5 } }, { whirlwind: [] }, { whirlwind: { fx_gale: -1 } }]) {
      (save.skills as { nodes?: unknown }).nodes = structuredClone(bad);
      normalizeSkillNodes(save);
      assert.deepEqual(save.skills.nodes, {}, JSON.stringify(bad));
    }
    save.skills.nodes = { whirlwind: { fx_gale: 3, fx_reach: 2 } }; save.level = 4;
    normalizeSkillNodes(save);
    assert.deepEqual(save.skills.nodes, {}, 'over budget for the level clears every tree');
    for (const raw of [undefined, null, 5, 'x', []]) {
      (save.skills as { nodes?: unknown }).nodes = raw; normalizeSkillNodes(save); assert.deepEqual(save.skills.nodes, {});
    }
  } finally { undo(); }
});

// ─────────────────────────── Passives ───────────────────────────

test('passive data: still four slots at 10/20/30/70, six stat passives per class unchanged, template passives validate', () => {
  assert.deepEqual([...PASSIVE_SLOT_LEVELS], [10, 20, 30, 70]);
  for (const classId of ['warrior', 'ranger', 'mage'] as const) assert.equal(passivesForClass(classId).length, 6);
  const data = fixture();
  data.passives.push(...structuredClone(FIXTURE_PASSIVES));
  assert.deepEqual(validateContent(data), []);
  const bad = fixture();
  bad.passives.push({ ...structuredClone(FIXTURE_PASSIVES[0]), text: 'Placeholder: 99% increased damage.' });
  expectPath(validateContent(bad), 'passives.fx_warrior_vortex.text');
  const wrong = fixture();
  wrong.passives.push({ ...structuredClone(FIXTURE_PASSIVES[0]), id: 'fx_wrong', effects: [{ kind: 'skillMods', skills: ['meteor'], mods: { dmg: 5 } }], text: undefined });
  expectPath(validateContent(wrong), 'passives.fx_wrong.effects[0]');
  const empty = fixture();
  empty.passives.push({ id: 'fx_empty', classId: 'mage', name: 'Empty', unlock: 10, note: 'x' });
  expectPath(validateContent(empty), 'passives.fx_empty');
});

test('a template passive in a slot reaches the character sheet; its text is authored or generated', () => {
  const undo = installFixturePassives();
  try {
    const save = createCharacter('PassiveTemplate', 'warrior', 3); save.level = 30;
    const before = computeStats(save);
    assert.equal(setPassive(save, 0, 'fx_warrior_vortex'), null);
    const after = computeStats(save);
    assert.equal(after.ias, before.ias + 4);
    assert.equal(passiveSources(save).length, 1);
    assert.match(passiveEffect(FIXTURE_PASSIVES[0], 30), /20% increased damage/);
    assert.match(passiveEffect(FIXTURE_PASSIVES[1], 30), /250|10% increased damage for each active Sentry/);
    save.level = 9; assert.equal(passiveSources(save).length, 0, 'locked slot stays dormant');
  } finally { undo(); }
});

// ─────────────────────────── Economy switch, tags, validation of the new vocabulary ───────────────────────────

test('the point economy flips by one config: separate from L21 with a 10-rank cap (shipped), the v1 bible preset, shared tier points', () => {
  assert.deepEqual(SPEC_POINTS, { source: 'separate', perLevel: 1, fromLevel: 21, treeRankCap: 10 });
  const bible: SpecEconomy = { source: 'separate', perLevel: 1, fromLevel: 10, treeRankCap: 10 };
  assert.equal(specPointsForLevel(70, bible), 61); assert.equal(specPointsForLevel(9, bible), 0); assert.equal(specPointsForLevel(10, bible), 1);
  assert.equal(specPointsForLevel(70, FROM_L2), 69);
  const shared: SpecEconomy = { source: 'shared', perLevel: 1, fromLevel: 2, treeRankCap: Infinity };
  const undo = installFixtureNodes();
  try {
    const save = createCharacter('EcoShared', 'warrior', 2); save.level = 40; save.skillPoints = 3;
    assert.equal(specPointsAvailable(save, shared), 3);
    for (let i = 0; i < 3; i++) assert.equal(buySkillNode(save, 'whirlwind', 'fx_gale', shared), null);
    assert.equal(save.skillPoints, 0);
    assert.match(buySkillNode(save, 'whirlwind', 'fx_reach', shared) ?? '', /No skill points left/);
    assert.equal(refundSkillNode(save, 'whirlwind', 'fx_gale', shared), null); assert.equal(save.skillPoints, 1);
    save.skills.nodes = { whirlwind: { fx_gale: 2, gone: 2 } };
    normalizeSkillNodes(save, shared);
    assert.deepEqual(save.skills.nodes, {}); assert.equal(save.skillPoints, 5, 'shared mode refunds every stored rank of a cleared tree');
    save.skills.nodes = { whirlwind: { fx_gale: 2 } };
    assert.equal(resetSkillNodes(save, undefined, shared), 2); assert.equal(save.skillPoints, 7);
    const capped = createCharacter('EcoCap', 'warrior', 2); capped.level = 70;
    for (const n of ['fx_gale', 'fx_gale', 'fx_gale', 'fx_reach', 'fx_reach', 'fx_thrift', 'fx_thrift', 'fx_thrift', 'fx_devils', 'fx_edge']) assert.equal(buySkillNode(capped, 'whirlwind', n, bible), null, n);
    assert.match(buySkillNode(capped, 'whirlwind', 'fx_edge', bible) ?? '', /tree is full \(at most 10 ranks\)/);
    capped.skills.nodes!.whirlwind.fx_edge = 2;
    normalizeSkillNodes(capped, bible); assert.deepEqual(capped.skills.nodes, {}, 'over the tree cap is illegal');
  } finally { undo(); }
});

test('the economy target holds for the shipped switch with the tree cap applied: five full trees at level 70', () => {
  const trees = specPointsForLevel(MAX_LEVEL) / Math.min(SPEC_POINTS.treeRankCap, TREE_RANKS_TARGET.max);
  assert(trees >= 4.5 && trees <= 5.5, `${trees} trees`);
});

test('skills carry derived and authored tags; validation rejects unknown tags, empty queries and illegal buckets', () => {
  for (const s of Object.values(SKILLS)) { const t = skillTags(s); assert(t.has(s.kind) && t.has(s.element), s.id); }
  const bad = fixture();
  (bad.skills.meteor as { tags?: string[] }).tags = ['fire'];
  expectPath(validateContent(bad), 'skills.meteor.tags');
  const effects = (e: unknown[]) => { const d = fixture(); d.legendaries.cindervane.effects = e as typeof d.legendaries.cindervane.effects; d.legendaries.cindervane.power = 'Meteor {v}.'; return validateContent(d); };
  expectPath(effects([{ kind: 'skillMore', tags: { anyOf: ['nonsense'] }, pct: { roll: 1 } }]), 'legendaries.cindervane.effects[0]');
  expectPath(effects([{ kind: 'skillMore', tags: {}, pct: { roll: 1 } }]), 'legendaries.cindervane.effects[0]');
  expectPath(effects([{ kind: 'skillMods', mods: { dmg: 5 }, roll: { field: 'dmg' } }]), 'legendaries.cindervane.effects[0]');
  expectPath(effects([{ kind: 'conditional', bucket: 'own', when: { targetState: 'frozen' }, pct: { roll: 1 } }]), 'legendaries.cindervane.effects[0]');
  expectPath(effects([{ kind: 'skillMore', skills: ['meteor'], pct: { roll: 1 }, when: { buffStacks: 'x', max: 0 } }]), 'legendaries.cindervane.effects[0]');
  assert.deepEqual(effects([{ kind: 'skillMore', tags: { anyOf: ['fire'] }, pct: { roll: 1 }, when: { targetState: 'inBlackHole' } }]), []);
});

test('a class may own several primary attacks; the auto-attack is chosen on the authoritative save path', () => {
  const save = createCharacter('TwoPrimaries', 'warrior', 2);
  assert.match(setPrimarySkill(save, 'whirlwind') ?? '', /Only a primary/);
  assert.match(setPrimarySkill(save, 'cleave') ?? '', /Already/);
  assert.match(setPrimarySkill(save, 'magic_missile') ?? '', /Unknown skill/);
  // The warrior ships its second primary (Tolling Blow, level 16).
  assert.match(setPrimarySkill(save, 'tolling_blow') ?? '', /level 16/);
  save.level = 16; assert.equal(setPrimarySkill(save, 'tolling_blow'), null); assert.equal(save.skills.primary, 'tolling_blow');
  const mage = createCharacter('TwoPrimariesMage', 'mage', 2);
  const undo = installFixtureSkills(12);
  try {
    assert.match(setPrimarySkill(mage, 'fx_mage_primary2') ?? '', /level 16/);
    mage.level = 16; assert.equal(setPrimarySkill(mage, 'fx_mage_primary2'), null); assert.equal(mage.skills.primary, 'fx_mage_primary2');
    assert.equal(skillsForClass('mage').length, 12);
  } finally { undo(); }
  assert.equal(skillsForClass('mage').length, 6, 'fixture removed');
});
