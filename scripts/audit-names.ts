// Registry-only originality inventory. It never reads saves or alters game definitions.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { CLASSES } from '../shared/src/data/classes';
import { SKILLS } from '../shared/src/data/skills';
import { BASES, LEGENDARIES, SETS, GEMS, GEM_RANKS, RARE_PREFIX, RARE_SUFFIX, MAGIC_PREFIX, MAGIC_SUFFIX } from '../shared/src/data/items';
import { MONSTERS, ELITE_AFFIXES, ELITE_PREFIX, ELITE_SUFFIX } from '../shared/src/data/monsters';
import { ZONES } from '../shared/src/data/zones';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = process.env.DATA_DIR;
assert.ok(dataDir && path.isAbsolute(dataDir), 'Explicit absolute isolated DATA_DIR is required');
assert.equal(fs.readdirSync(dataDir).length, 0, 'Audit requires empty isolated DATA_DIR');
const out = path.join(root, 'docs/originality');
const digest = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();
assert.equal(normalize('  A\t  B  '), 'a b');
type Ref = { source: string; url: string; skills: number; runes: number; labels: { exact: string; normalized: string }[] };
const refs: Ref[] = JSON.parse(fs.readFileSync(path.join(out, 'reference-name-hashes.json'), 'utf8')).records;
const sourceForClass: Record<string, string> = { warrior: 'D3-ACT-B', ranger: 'D3-ACT-DH', mage: 'D3-ACT-W' };
type Row = { definition: string; group: string; file: string; text: string; reference: string; result: string };
const rows: Row[] = [];
function add(definition: string, group: string, file: string, text: string) {
  let reference = '', result = 'not_compared';
  if (group === 'skills') {
    const skill = SKILLS[definition.split('.')[1]];
    reference = sourceForClass[skill.classId];
    const ref = refs.find(r => r.source === reference)!;
    assert.ok(ref, reference);
    result = ref.labels.some(n => n.exact === digest(text)) ? 'exact_label_match'
      : ref.labels.some(n => n.normalized === digest(normalize(text))) ? 'normalized_label_match'
      : 'no_exact_match_in_reviewed_class';
  }
  rows.push({ definition, group, file, text, reference, result });
}
function walk(value: unknown, parts: string[], group: string, file: string, allStrings = false): void {
  if (typeof value === 'string') {
    const key = parts.at(-1)!, parent = parts.at(-2);
    if (allStrings || ['name', 'title', 'noun', 'label'].includes(key) || parent === 'names') add(parts.join('.'), group, file, value);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) walk(child, [...parts, key], group, file, allStrings);
  }
}
const registry = (name: string, value: unknown, group: string, file: string, all = false) => walk(value, [name], group, file, all);
registry('classes', CLASSES, 'classes', 'shared/src/data/classes.ts');
registry('skills', SKILLS, 'skills', 'shared/src/data/skills.ts');
for (const [name, value] of Object.entries({ bases: BASES, legendaries: LEGENDARIES, sets: SETS, gems: GEMS })) registry(name, value, 'items', 'shared/src/data/items.ts');
for (const [name, value] of Object.entries({ gemRanks: GEM_RANKS, rarePrefix: RARE_PREFIX, rareSuffix: RARE_SUFFIX, magicPrefix: MAGIC_PREFIX, magicSuffix: MAGIC_SUFFIX })) registry(name, value, 'item_components', 'shared/src/data/items.ts', true);
for (const [name, value] of Object.entries({ monsters: MONSTERS, eliteAffixes: ELITE_AFFIXES })) registry(name, value, 'monsters', 'shared/src/data/monsters.ts');
for (const [name, value] of Object.entries({ elitePrefix: ELITE_PREFIX, eliteSuffix: ELITE_SUFFIX })) registry(name, value, 'monster_components', 'shared/src/data/monsters.ts', true);
registry('zones', ZONES, 'zones', 'shared/src/data/zones.ts');
registry('town', JSON.parse(fs.readFileSync(path.join(root, 'shared/src/data/town/hearthmere.json'), 'utf8')), 'town', 'shared/src/data/town/hearthmere.json');
rows.sort((a, b) => a.definition < b.definition ? -1 : a.definition > b.definition ? 1 : 0);
assert.equal(new Set(rows.map(r => r.definition)).size, rows.length);
const skillRows = rows.filter(r => r.group === 'skills');
assert.equal(skillRows.length, Object.values(SKILLS).reduce((n, s) => n + 1 + s.runes.length + s.tiers.length, 0));
const counts = (list: Row[], field: 'group' | 'result') => Object.fromEntries([...new Set(list.map(r => r[field]))].sort().map(value => [value, list.filter(r => r[field] === value).length]));
const report = {
  scope: 'Selected registry display/authoring name fields/components only; presence does not prove visible UI use. Exact three-class label comparison is not legal clearance or proof of copying/originality. No descriptions/UI strings/assets/saved-item scan.',
  rowCount: rows.length, groups: counts(rows, 'group'), comparison: counts(skillRows, 'result'),
  skillComparison: counts(skillRows.filter(r => /^skills\.[^.]+\.name$/.test(r.definition)), 'result'),
  runeComparison: counts(skillRows.filter(r => /\.runes\./.test(r.definition)), 'result'),
  tierComparison: counts(skillRows.filter(r => /\.tiers\./.test(r.definition)), 'result'),
  referenceCounts: refs.map(r => ({ source: r.source, skills: r.skills, runes: r.runes })),
  registrySha256: digest(JSON.stringify(rows)),
};
const columns: (keyof Row)[] = ['definition', 'group', 'file', 'text', 'reference', 'result'];
const csv = [columns, ...rows.map(r => columns.map(key => r[key]))].map(values => values.map(v => '"' + v.replace(/"/g, '""') + '"').join(',')).join('\n') + '\n';
fs.writeFileSync(path.join(out, 'NAMES.csv'), csv);
fs.writeFileSync(path.join(out, 'name-audit.json'), JSON.stringify(report, null, 2) + '\n');
assert.equal(fs.readdirSync(dataDir).length, 0, 'Audit must leave isolated DATA_DIR empty');
console.log(JSON.stringify({ ...report, dataDir }, null, 2));
