// Stable content IDs (F-CON-01). Saves, quests, commands and the network refer to content by id, so an id that
// disappears or is renamed silently strands player data. Every save-referenced registry is recorded in
// scripts/content-ids.lock.json; content:check fails when a recorded id is missing unless it is retired with a reason
// (and, if saves can hold it, a migration step in shared/src/saveMigrations.ts). New ids are fine and are reported.
//
//   npx tsx scripts/content-ids.ts --update     record new ids (refuses while recorded ids are missing and unretired)
//
// Also runtime schema checks the TypeScript types cannot express: id spelling, display-name presence/length and
// unique display names inside a registry (two different legendaries called the same thing confuse players).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSES } from '../shared/src/data/classes';
import { SKILLS } from '../shared/src/data/skills';
import { AFFIXES, BASES, GEMS, LEGENDARIES, SETS } from '../shared/src/data/items';
import { ELITE_AFFIXES, MONSTERS } from '../shared/src/data/monsters';
import { ZONES } from '../shared/src/data/zones';
import { QUESTS } from '../shared/src/data/quests';
import { PASSIVES } from '../shared/src/passives';
import { MATERIAL_NAMES } from '../shared/src/materialNames';
import { CUBE_FUNCTIONS } from '../shared/src/cube';
import { DIFFICULTIES, PARAGON_STATS } from '../shared/src/progression';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCK = path.join(root, 'scripts/content-ids.lock.json');
/** Build-code positions (shared/src/buildCode.ts): append-only, a code's numbers point into these lists forever. */
const BUILD_CODE_IDS = path.join(root, 'shared/src/data/buildCodeIds.json');
const BUILD_CODE_REGISTRIES = ['classes', 'skills', 'runes', 'passives', 'legendaries', 'sets'] as const;

/** Append ids that have no build-code position yet (never reorders or drops one). Returns how many were added. */
export function appendBuildCodeIds(current = collectIds()): number {
  const reg = JSON.parse(fs.readFileSync(BUILD_CODE_IDS, 'utf8')) as Record<string, string[]>;
  let added = 0;
  for (const k of BUILD_CODE_REGISTRIES) {
    const have = new Set(reg[k] ??= []);
    for (const id of current[k]) if (!have.has(id)) { reg[k].push(id); have.add(id); added++; }
  }
  if (added) fs.writeFileSync(BUILD_CODE_IDS, JSON.stringify(reg, null, 2) + '\n');
  return added;
}

/** Registry → ids, with a note of where saves (or other durable data) hold them. */
export function collectIds(): Record<string, string[]> {
  return {
    classes: Object.keys(CLASSES),                                   // save.classId
    skills: Object.keys(SKILLS),                                     // save.skills.slots/runes/tiers keys
    runes: Object.values(SKILLS).flatMap(s => s.runes.map(r => `${s.id}.${r.id}`)), // save.skills.runes values
    bases: Object.keys(BASES),                                       // item.base
    affixes: AFFIXES.map(a => a.stat),                               // item.affixes[].stat
    legendaries: Object.keys(LEGENDARIES),                           // item.legendary, save.cube.learned
    sets: Object.keys(SETS),                                         // item.set
    gems: Object.keys(GEMS),                                         // save.gems keys, item sockets
    monsters: Object.keys(MONSTERS),                                 // save.bestiary keys, quest targets
    eliteAffixes: Object.keys(ELITE_AFFIXES),                        // bestiary trait records
    zones: Object.keys(ZONES),                                       // save.lastZone, quest unlocks
    quests: QUESTS.map(q => q.id),                                   // save.quests keys
    passives: PASSIVES.map(p => p.id),                               // save.passives.slots
    materials: Object.keys(MATERIAL_NAMES),                          // save.materials keys
    cubeOps: CUBE_FUNCTIONS.map(f => f.op),                          // command ops, cube XP
    paragonStats: PARAGON_STATS.map(p => p.id),                      // save.paragon.spent keys
    difficulties: DIFFICULTIES.map((_, i) => String(i)),             // save.difficulty index
  };
}

interface Lock { note: string; ids: Record<string, string[]>; retired: Record<string, string> }
const readLock = (): Lock | null => fs.existsSync(LOCK) ? JSON.parse(fs.readFileSync(LOCK, 'utf8')) as Lock : null;

export function stableIdProblems(current = collectIds(), lock = readLock()): { errors: string[]; added: number } {
  if (!lock) return { errors: ['content ids: scripts/content-ids.lock.json is missing; run npx tsx scripts/content-ids.ts --update'], added: 0 };
  const errors: string[] = [];
  let added = 0;
  for (const [registry, ids] of Object.entries(lock.ids)) {
    const now = new Set(current[registry] ?? []);
    for (const id of ids) if (!now.has(id) && !Object.hasOwn(lock.retired, `${registry}:${id}`))
      errors.push(`content ids: ${registry} "${id}" was removed or renamed; saves may refer to it. Restore it, or retire it in scripts/content-ids.lock.json with a reason (and a migration step if saves hold it).`);
  }
  for (const [registry, ids] of Object.entries(current)) {
    const known = new Set(lock.ids[registry] ?? []);
    added += ids.filter(id => !known.has(id)).length;
  }
  return { errors, added };
}

/** Schema rules beyond the TypeScript types. */
export function registrySchemaProblems(): string[] {
  const out: string[] = [];
  const idOk = (id: string) => /^[a-z][a-z0-9_]*$/.test(id);
  const named: [string, Record<string, { name?: string; id?: string }>][] = [
    ['classes', CLASSES], ['skills', SKILLS], ['legendaries', LEGENDARIES], ['sets', SETS], ['gems', GEMS],
    ['monsters', MONSTERS], ['eliteAffixes', ELITE_AFFIXES], ['zones', ZONES],
  ];
  for (const [registry, entries] of named) {
    const names = new Map<string, string>();
    for (const [id, e] of Object.entries(entries)) {
      if (!idOk(id)) out.push(`schema: ${registry} id "${id}" must be lower-case letters, digits and underscores`);
      const name = e.name ?? '';
      if (!name.trim() || name !== name.trim()) out.push(`schema: ${registry}.${id} needs a trimmed display name`);
      if (name.length > 48) out.push(`schema: ${registry}.${id} display name is longer than 48 characters`);
      const key = name.trim().toLowerCase();
      if (key && names.has(key)) out.push(`schema: ${registry}.${id} has the same display name as ${registry}.${names.get(key)} ("${name}")`);
      else names.set(key, id);
    }
  }
  for (const s of Object.values(SKILLS)) {
    const runes = new Set<string>();
    for (const r of s.runes) {
      if (!idOk(r.id)) out.push(`schema: rune id "${s.id}.${r.id}" must be lower-case letters, digits and underscores`);
      if (!r.name?.trim()) out.push(`schema: rune ${s.id}.${r.id} needs a display name`);
      if (runes.has(r.name.toLowerCase())) out.push(`schema: skill ${s.id} has two runes named "${r.name}"`);
      runes.add(r.name.toLowerCase());
    }
  }
  for (const p of PASSIVES) if (!idOk(p.id) || !p.name?.trim()) out.push(`schema: passive "${p.id}" needs a valid id and a display name`);
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const current = collectIds(), lock = readLock();
  if (process.argv.includes('--update')) {
    const { errors } = stableIdProblems(current, lock ?? { note: '', ids: {}, retired: {} });
    if (errors.length) { console.error(errors.join('\n')); console.error('\nRetire the ids above first (they need a reason).'); process.exit(1); }
    const next: Lock = {
      note: 'Every save-referenced content id. Removing or renaming one fails content:check until it is retired here with a reason. Update with: npx tsx scripts/content-ids.ts --update',
      ids: Object.fromEntries(Object.entries(current).map(([k, v]) => [k, [...new Set([...(lock?.ids[k] ?? []).filter(id => v.includes(id)), ...v])].sort()])),
      retired: lock?.retired ?? {},
    };
    fs.writeFileSync(LOCK, JSON.stringify(next, null, 2) + '\n');
    console.log(`Recorded ${Object.values(next.ids).reduce((n, v) => n + v.length, 0)} ids in ${Object.keys(next.ids).length} registries.`);
    const codes = appendBuildCodeIds(current);
    if (codes) console.log(`Gave ${codes} new id(s) a build-code position (shared/src/data/buildCodeIds.json).`);
  } else {
    const { errors, added } = stableIdProblems(current, lock);
    const schema = registrySchemaProblems();
    for (const e of [...errors, ...schema]) console.error(e);
    console.log(`${added} new id(s) not yet recorded; ${errors.length} missing; ${schema.length} schema problem(s).`);
    if (errors.length || schema.length) process.exitCode = 1;
  }
}
