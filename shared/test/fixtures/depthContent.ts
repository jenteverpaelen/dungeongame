// TEST / GALLERY FIXTURE ONLY — never imported by game code and never shipped. Placeholder specialization nodes on two
// existing skills and placeholder extra skills so the engine, the save path and the Skills window can be exercised
// before the content agents author the real M1 data. Every number here is a placeholder, not a design value.

import type { NodeDef, SkillDef } from '../../src/data/skills/types';
import { SKILLS } from '../../src/data/skills';
import type { ClassId } from '../../src/types';
import { PASSIVES, type PassiveDef } from '../../src/passives';

/** Placeholder trees: Whirlwind (warrior) and Meteor (mage). 6 nodes each, 15 ranks per tree. */
export const FIXTURE_NODES: Record<string, NodeDef[]> = {
  whirlwind: [
    { id: 'fx_gale', name: 'Placeholder Gale', text: 'Whirlwind deals {dmg}% more damage.', maxRank: 3, ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: { col: 1, row: 0 } },
    { id: 'fx_reach', name: 'Placeholder Reach', text: 'Whirlwind radius +{radius}%.', maxRank: 2, ranks: [{ radius: 10 }, { radius: 10 }], requires: [{ node: 'fx_gale', rank: 1 }], pos: { col: 0, row: 1 } },
    { id: 'fx_thrift', name: 'Placeholder Thrift', text: 'Whirlwind costs {cost}% less Fury.', maxRank: 3, ranks: [{ cost: -5 }, { cost: -5 }, { cost: -5 }], requires: [{ node: 'fx_gale', rank: 1 }], pos: { col: 2, row: 1 } },
    { id: 'fx_devils', name: 'Placeholder Devils', text: 'Whirlwind always releases Dust Devils.', maxRank: 1, ranks: [{ flags: ['dustDevils'] }], requires: [{ node: 'fx_reach', rank: 2 }], unlock: 20, pos: { col: 0, row: 2 } },
    { id: 'fx_edge', name: 'Placeholder Edge', text: 'Placeholder parameter {var:fxEdge}.', maxRank: 3, ranks: [{ vars: { fxEdge: 1 } }, { vars: { fxEdge: 1 } }, { vars: { fxEdge: 1 } }], requires: [{ node: 'fx_thrift', rank: 1 }], pos: { col: 2, row: 2 } },
    { id: 'fx_eye', name: 'Placeholder Eye', text: 'Whirlwind deals {dmg}% more damage.', maxRank: 3, ranks: [{ dmg: 15 }, { dmg: 15 }, { dmg: 15 }], requires: [{ node: 'fx_devils', rank: 1 }, { node: 'fx_edge', rank: 2 }], unlock: 30, pos: { col: 1, row: 2 } },
  ],
  meteor: [
    { id: 'fx_mass', name: 'Placeholder Mass', text: 'Meteor deals {dmg}% more damage.', maxRank: 3, ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: { col: 0, row: 0 } },
    { id: 'fx_crater', name: 'Placeholder Crater', text: 'Meteor radius +{radius}%.', maxRank: 3, ranks: [{ radius: 8 }, { radius: 8 }, { radius: 8 }], pos: { col: 2, row: 0 } },
    { id: 'fx_focus', name: 'Placeholder Focus', text: 'Meteor costs {cost}% less.', maxRank: 2, ranks: [{ cost: -10 }, { cost: -10 }], requires: [{ node: 'fx_mass', rank: 2 }], pos: { col: 0, row: 1 } },
    { id: 'fx_comet', name: 'Placeholder Comet', text: 'Meteor freezes.', maxRank: 1, ranks: [{ flags: ['freeze'] }], requires: [{ node: 'fx_crater', rank: 1 }], pos: { col: 2, row: 1 } },
    { id: 'fx_twin', name: 'Placeholder Twin', text: 'Meteor calls a second meteor.', maxRank: 3, ranks: [{ dmg: 5 }, { dmg: 5 }, { dmg: 5, flags: ['secondMeteor'] }], requires: [{ node: 'fx_focus', rank: 1 }], pos: { col: 1, row: 2 } },
    { id: 'fx_star', name: 'Placeholder Star', text: 'Meteor deals {dmg}% more damage.', maxRank: 3, ranks: [{ dmg: 12 }, { dmg: 12 }, { dmg: 12 }], requires: [{ node: 'fx_comet', rank: 1 }], unlock: 40, pos: { col: 1, row: 1 } },
  ],
};

/** Placeholder build-defining passives (power templates), one per class. */
export const FIXTURE_PASSIVES: PassiveDef[] = [
  { id: 'fx_warrior_vortex', classId: 'warrior', name: 'Placeholder Vortex', unlock: 10, note: 'Placeholder build-defining passive.',
    effects: [{ kind: 'conditional', when: { channeling: 'whirlwind' }, bucket: 'hit', pct: 20 }, { kind: 'stat', stat: 'ias', value: 4 }],
    text: 'Placeholder: while channelling Whirlwind you deal 20% increased damage, and attack speed +4%.' },
  { id: 'fx_ranger_kennel', classId: 'ranger', name: 'Placeholder Kennel', unlock: 20, note: 'Placeholder build-defining passive.',
    effects: [{ kind: 'conditional', when: { perSummon: 'sentry', max: 3 }, bucket: 'own', pct: 10, skills: ['sentry'] }] },
  { id: 'fx_mage_glacier', classId: 'mage', name: 'Placeholder Glacier', unlock: 30, note: 'Placeholder build-defining passive.',
    effects: [{ kind: 'conditional', when: { targetState: 'chilled' }, bucket: 'hit', pct: 15 }, { kind: 'proc', on: 'kill', resource: 3 }] },
];

/** Add the placeholder passives to the live catalogue (`perClass` fills each class up to that many, e.g. 14 = M1). */
export function installFixturePassives(perClass = 0): () => void {
  const added: PassiveDef[] = [...FIXTURE_PASSIVES];
  for (const classId of ['warrior', 'ranger', 'mage'] as const) {
    const have = PASSIVES.filter((p) => p.classId === classId).length + FIXTURE_PASSIVES.filter((p) => p.classId === classId).length;
    for (let i = have; i < perClass; i++) added.push({ id: `fx_${classId}_passive_${i}`, classId, name: `Placeholder Passive ${i + 1}`, unlock: Math.min(70, 10 + i * 4),
      note: 'Placeholder passive for layout checks; not a design value.', effects: [{ kind: 'stat', stat: 'chc', value: 1 }] });
  }
  PASSIVES.push(...added);
  return () => { for (const p of added) PASSIVES.splice(PASSIVES.indexOf(p), 1); };
}

/** Install the placeholder trees into the live registry; returns an undo function. */
export function installFixtureNodes(): () => void {
  const before = Object.fromEntries(Object.keys(FIXTURE_NODES).map((id) => [id, SKILLS[id].nodes]));
  for (const [id, nodes] of Object.entries(FIXTURE_NODES)) SKILLS[id].nodes = structuredClone(nodes);
  return () => { for (const [id, nodes] of Object.entries(before)) { if (nodes) SKILLS[id].nodes = nodes; else delete SKILLS[id].nodes; } };
}

const LATE_UNLOCKS = [16, 20, 26, 32, 40, 50, 55, 58, 60, 62, 64, 66, 68, 70];

/**
 * Placeholder extra skills (copies of an existing skill of the class with new ids, names and unlock levels) so a class
 * has `total` skills, each with five runes; used by the Skills window layout checks (12 = M1, 20 = M2).
 */
export function fixtureSkills(classId: ClassId, total: number): SkillDef[] {
  const own = Object.values(SKILLS).filter((s) => s.classId === classId && s.kind !== 'primary' && !s.id.startsWith('fx_'));
  return Array.from({ length: Math.max(0, total - own.length - 1) }, (_, i) => {
    const base = own[i % own.length];
    const unlock = LATE_UNLOCKS[i] ?? 70;
    const copy: SkillDef = structuredClone(base);
    copy.id = `fx_${classId}_${i + 1}`;
    copy.name = `Placeholder ${['Arc', 'Ember', 'Ward', 'Tide', 'Spire', 'Veil', 'Gale', 'Frost', 'Thorn', 'Dusk', 'Hollow', 'Rime', 'Ash', 'Crown'][i % 14]}`;
    copy.unlock = unlock;
    copy.runes = Array.from({ length: 5 }, (_, r) => ({ id: `fx_r${r}`, name: `Placeholder Rune ${'ABCDE'[r]}`, unlock: Math.min(70, unlock + [0, 2, 4, 6, 8][r]), desc: 'Placeholder rune text for layout checks; not a design value.', mods: { dmg: 5 } }));
    delete copy.nodes;
    return copy;
  });
}

/** Placeholder display categories (the bible authors five real ones per class). */
const FIXTURE_CATEGORY: Record<SkillDef['kind'], string> = { primary: 'Primary', spender: 'Strikes', channel: 'Strikes', cooldown: 'Control', buff: 'Rally', summon: 'Allies' };

/**
 * Add placeholder skills to the live registry (gallery / UI tests): extra skills up to `totalPerClass`, a second
 * primary at level 16 and placeholder categories. Returns an undo function.
 */
export function installFixtureSkills(totalPerClass: number): () => void {
  const added: string[] = [], categorized: SkillDef[] = [];
  for (const classId of ['warrior', 'ranger', 'mage'] as const) {
    const primary = Object.values(SKILLS).find((s) => s.classId === classId && s.kind === 'primary')!;
    const second: SkillDef = { ...structuredClone(primary), id: `fx_${classId}_primary2`, name: 'Placeholder Second Primary', unlock: 16 };
    second.runes = second.runes.map((r, i) => ({ ...r, id: `fx_p${i}`, unlock: 18 + i * 3 }));
    const extra = [second, ...fixtureSkills(classId, totalPerClass - 1)];
    for (const s of extra) { SKILLS[s.id] = s; added.push(s.id); }
    for (const s of Object.values(SKILLS)) if (s.classId === classId && !s.category) { s.category = FIXTURE_CATEGORY[s.kind]; categorized.push(s); }
  }
  return () => { for (const id of added) delete SKILLS[id]; for (const s of categorized) delete s.category; };
}
