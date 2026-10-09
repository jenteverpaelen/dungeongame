import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectDialogue, validateQuests, type Catalogue, type Dialogue, type ProbeState, type Quest } from './quest-authoring';

// Original synthetic authoring records, never imported by the game's content registries.
function fixture() {
  const catalogue: Catalogue = {
    messages: {
      arrival: 'Fixture: Arrival', supply: 'Fixture: Supplies', trial: 'Fixture: Trial',
      kill: 'Defeat the fixture target.', collect: 'Collect the fixture item.', reach: 'Reach the fixture marker.',
      talk: 'Speak with the fixture guide.', service: 'Use the fixture service.', rift: 'Complete the fixture rift.',
      deliver: 'Deliver the fixture item.', wave: 'Complete the fixture wave.',
      entry: 'Which fixture path should we test?', detail: 'This path checks a condition.',
      accept: 'Use this test path.', leave: 'End this test conversation.', end: 'Fixture conversation ended.',
    },
    zones: new Set(['field']), monsters: new Set(['target']), items: new Set(['supply']),
    locations: new Set(['marker']), npcs: new Map([['guide', new Set<string>()], ['smith', new Set(['repair'])]]),
    dialogues: new Set(['conversation']), encounters: new Set(['trial']), unlocks: new Set(['fixture_access']),
    objectiveKinds: new Set(['kill', 'collect', 'reach', 'talk', 'service', 'rift', 'deliver', 'wave']),
    flags: new Set(['ready', 'knows_route']),
  };
  const reward = () => ({ xp: 1, gold: 1, items: [{ item: 'supply', count: 1 }], unlocks: ['fixture_access'] });
  const quests: Quest[] = [
    { id: 'arrival', title: 'arrival', requires: [], reward: reward(), objectives: [
      { id: 'reach', text: 'reach', kind: 'reach', location: 'marker' },
      { id: 'talk', text: 'talk', kind: 'talk', npc: 'guide', dialogue: 'conversation' },
    ] },
    { id: 'supplies', title: 'supply', requires: ['arrival'], reward: reward(), objectives: [
      { id: 'kill', text: 'kill', kind: 'kill', zone: 'field', monster: 'target', count: 1 },
      { id: 'collect', text: 'collect', kind: 'collect', item: 'supply', count: 1 },
      { id: 'deliver', text: 'deliver', kind: 'deliver', npc: 'guide', item: 'supply', count: 1 },
    ] },
    { id: 'trial', title: 'trial', requires: ['arrival', 'supplies'], reward: reward(), objectives: [
      { id: 'service', text: 'service', kind: 'service', npc: 'smith', operation: 'repair' },
      { id: 'rift', text: 'rift', kind: 'rift', minDifficulty: 0 },
      { id: 'wave', text: 'wave', kind: 'wave', encounter: 'trial', count: 1 },
    ] },
  ];
  const dialogue: Dialogue = { id: 'conversation', start: 'entry', nodes: [
    { id: 'entry', text: 'entry', terminal: false, choices: [
      { id: 'detail', text: 'detail', to: 'detail', when: [{ flag: 'knows_route', equals: false }] },
      { id: 'accept', text: 'accept', to: 'end', when: [{ flag: 'ready', equals: true }] },
      { id: 'leave', text: 'leave', to: 'end', when: [] },
    ] },
    { id: 'detail', text: 'detail', terminal: false, choices: [
      { id: 'back', text: 'entry', to: 'entry', when: [] },
      { id: 'leave', text: 'leave', to: 'end', when: [] },
    ] },
    { id: 'end', text: 'end', terminal: true, choices: [] },
  ] };
  const states: ProbeState[] = [false, true].flatMap(ready => [false, true].map(knows_route => ({
    id: `ready=${ready},knows_route=${knows_route}`, facts: { ready, knows_route },
  })));
  return { catalogue, quests, dialogue, states };
}
const includes = (errors: string[], text: string) => assert.ok(errors.some(e => e.includes(text)), errors.join('\n'));

test('three original fixture quests cover all eight objective shapes without mutation', () => {
  const { catalogue, quests, dialogue, states } = fixture();
  const before = JSON.stringify({ quests, dialogue, states });
  assert.equal(new Set(quests.flatMap(q => q.objectives.map(o => o.kind))).size, 8);
  assert.deepEqual(validateQuests(quests, catalogue), []);
  const result = inspectDialogue(dialogue, catalogue, states);
  assert.deepEqual(result.errors, []);
  assert.equal(result.observations.length, 4);
  assert.ok(result.observations.every(s => s.stranded.length === 0));
  assert.equal(JSON.stringify({ quests, dialogue, states }), before);
});

test('mutual and self prerequisites block the dependent chain; reorder does not change acceptance', () => {
  const { catalogue, quests } = fixture();
  assert.deepEqual(validateQuests(quests.toReversed(), catalogue), []);
  quests[0].requires = ['supplies'];
  const cycle = validateQuests(quests, catalogue);
  for (const q of quests) includes(cycle, `quest.${q.id}.requires: blocked by a prerequisite cycle`);
  quests[0].requires = ['arrival'];
  includes(validateQuests(quests, catalogue), 'quest.arrival.requires: blocked by a prerequisite cycle');
});

test('unknown prerequisites and duplicate quest/objective identities are refused', () => {
  const { catalogue, quests } = fixture();
  quests[0].requires = ['constructor', 'constructor'];
  quests[1].objectives.push(structuredClone(quests[1].objectives[0]));
  quests.push(structuredClone(quests[0]));
  const errors = validateQuests(quests, catalogue);
  for (const text of ['quests: duplicate ID', 'requires: unknown reference constructor', 'requires: duplicate ID', 'objectives: duplicate ID']) includes(errors, text);
});

test('missing targets and NPC service mismatches identify the offending objective', () => {
  const { catalogue, quests } = fixture();
  catalogue.zones.clear(); catalogue.monsters.clear(); catalogue.items.clear();
  catalogue.locations.clear(); catalogue.encounters.clear(); catalogue.dialogues.clear();
  catalogue.npcs.get('smith')!.clear();
  const errors = validateQuests(quests, catalogue);
  for (const text of ['reach.location', 'talk.dialogue', 'kill.zone', 'kill.monster', 'collect.item', 'deliver.item', 'service.operation', 'wave.encounter', 'reward.item']) includes(errors, text);
});

test('authoring cannot claim a missing handler capability merely by naming an objective', () => {
  const { catalogue, quests } = fixture();
  for (const kind of ['talk', 'deliver', 'wave'] as const) catalogue.objectiveKinds.delete(kind);
  const errors = validateQuests(quests, catalogue);
  for (const kind of ['talk', 'deliver', 'wave']) includes(errors, `${kind}.kind: unknown reference ${kind}`);
});

test('missing inherited or empty message keys do not become authored text', () => {
  const { catalogue, quests, dialogue, states } = fixture();
  quests[0].title = 'constructor'; catalogue.messages.collect = '  ';
  dialogue.nodes[0].choices[0].text = 'missing';
  includes(validateQuests(quests, catalogue), 'title: missing/empty message constructor');
  includes(validateQuests(quests, catalogue), 'collect.text: missing/empty message collect');
  includes(inspectDialogue(dialogue, catalogue, states).errors, 'detail.text: missing/empty message missing');
});

test('quantities reject nonfinite fractional unsafe and negative values while zero difficulty is valid', () => {
  for (const bad of [NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1, -1, 0]) {
    const { catalogue, quests } = fixture();
    const kill = quests[1].objectives[0]; assert.equal(kill.kind, 'kill');
    if (kill.kind === 'kill') kill.count = bad;
    includes(validateQuests(quests, catalogue), 'kill.count: expected safe integer >= 1');
  }
  const { catalogue, quests } = fixture();
  quests[0].reward.gold = -1; quests[0].reward.xp = Infinity;
  quests[0].reward.items[0].count = 0; quests[0].reward.unlocks = ['absent'];
  const errors = validateQuests(quests, catalogue);
  for (const text of ['reward.gold', 'reward.xp', 'reward.count', 'reward.unlocks']) includes(errors, text);
});

test('empty objectives and repeated reward keys require an author correction', () => {
  const { catalogue, quests } = fixture();
  quests[0].objectives = [];
  quests[0].reward.items.push(structuredClone(quests[0].reward.items[0]));
  quests[0].reward.unlocks.push(quests[0].reward.unlocks[0]);
  const errors = validateQuests(quests, catalogue);
  for (const text of ['objectives: must declare', 'reward.items: duplicate', 'reward.unlocks: duplicate']) includes(errors, text);
});

test('dangling targets, missing entry and duplicate dialogue IDs are refused', () => {
  const { catalogue, dialogue, states } = fixture();
  dialogue.start = 'absent'; dialogue.nodes[0].choices[0].to = 'constructor';
  dialogue.nodes[0].choices.push(structuredClone(dialogue.nodes[0].choices[0]));
  dialogue.nodes.push(structuredClone(dialogue.nodes[2]));
  const errors = inspectDialogue(dialogue, catalogue, states).errors;
  for (const text of ['start: unknown reference', 'detail.to: unknown reference', 'choices: duplicate', 'nodes: duplicate']) includes(errors, text);
});

test('an authored orphan and a terminal with outgoing content cannot hide behind an otherwise valid route', () => {
  const { catalogue, dialogue, states } = fixture();
  dialogue.nodes.push({ id: 'orphan', text: 'end', terminal: true, choices: [] });
  dialogue.nodes[2].choices = [structuredClone(dialogue.nodes[0].choices[0])];
  const errors = inspectDialogue(dialogue, catalogue, states).errors;
  includes(errors, 'orphan: unreachable'); includes(errors, 'end: terminal must not have outgoing');
});

test('unconditional topology alone misses a conditional dead end', () => {
  const { catalogue, dialogue, states } = fixture();
  dialogue.nodes = [
    { id: 'entry', text: 'entry', terminal: false, choices: [
      { id: 'accept', text: 'accept', to: 'end', when: [{ flag: 'ready', equals: true }] },
    ] },
    { id: 'end', text: 'end', terminal: true, choices: [] },
  ];
  const result = inspectDialogue(dialogue, catalogue, states);
  assert.deepEqual(result.structurallyReachable, ['entry', 'end']);
  assert.equal(result.observations.filter(s => s.stranded.length).length, 2);
  assert.equal(result.observations.filter(s => !s.stranded.length).length, 2);
  assert.equal(result.errors.length, 2);
});

test('every reachable branch needs an exit, even when a different branch reaches the ending', () => {
  const { catalogue, dialogue, states } = fixture();
  dialogue.nodes[1].choices = [{ id: 'loop', text: 'detail', to: 'detail', when: [] }];
  const result = inspectDialogue(dialogue, catalogue, states);
  assert.equal(result.observations.filter(s => s.stranded.includes('detail')).length, 2);
  assert.ok(result.observations.every(s => !s.stranded.includes('entry')));
  assert.equal(result.errors.length, 2);
});

test('an optional loop remains valid with an available exit', () => {
  const { catalogue, dialogue, states } = fixture();
  dialogue.nodes[1].choices.push({ id: 'loop', text: 'detail', to: 'detail', when: [] });
  assert.deepEqual(inspectDialogue(dialogue, catalogue, states).errors, []);
});

test('unknown or conflicting condition facts and incomplete state inputs are explicit failures', () => {
  const { catalogue, dialogue, states } = fixture();
  dialogue.nodes[0].choices[0].when = [
    { flag: 'absent', equals: true }, { flag: 'ready', equals: true }, { flag: 'ready', equals: false },
  ];
  delete states[0].facts.ready;
  const errors = inspectDialogue(dialogue, catalogue, states).errors;
  for (const text of ['when: unknown reference', 'when: duplicate ID', 'missing boolean fact ready']) includes(errors, text);
  includes(inspectDialogue(dialogue, catalogue, []).errors, 'no supplied states examined');
});
