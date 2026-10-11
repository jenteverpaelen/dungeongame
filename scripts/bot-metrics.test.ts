import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReport, checkTargets, compareReports, medianOfSeeds, renderMarkdown, validateRows, type MetricRow, type SimJson } from './bot-metrics';

assert.ok(process.env.DATA_DIR, 'Explicit isolated DATA_DIR required');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the leveling simulation writes valid per-band metrics through SIM_JSON', () => {
  const file = path.join(process.env.DATA_DIR!, 'bot-metrics-sim.json');
  spawnSync(process.execPath, ['--import', 'tsx', path.join(repo, 'server/test/sim.ts'), 'leveling', '3'],
    { cwd: repo, env: { ...process.env, SIM_JSON: file }, stdio: 'ignore' });
  const sim = JSON.parse(fs.readFileSync(file, 'utf8')) as SimJson;
  assert.equal(sim.schema, 1);
  assert.deepEqual(validateRows(sim.rows), []);
  assert.deepEqual([...new Set(sim.rows.map(r => r.class))].sort(), ['mage', 'ranger', 'warrior']);
  for (const r of sim.rows) assert.ok(r.killsPerMin > 0 && r.xpPerHour > 0, `${r.class} kills and earns XP`);
  const rep = buildReport(sim);
  const md = renderMarkdown(rep);
  for (const cls of ['warrior', 'ranger', 'mage']) assert.match(md, new RegExp(`## ${cls}`));
  assert.match(md, /XP\/h/);
  // Same seed, same code → identical numbers (the report is reproducible).
  const again = path.join(process.env.DATA_DIR!, 'bot-metrics-sim-2.json');
  spawnSync(process.execPath, ['--import', 'tsx', path.join(repo, 'server/test/sim.ts'), 'leveling', '3'],
    { cwd: repo, env: { ...process.env, SIM_JSON: again }, stdio: 'ignore' });
  const cmp = compareReports(rep, buildReport(JSON.parse(fs.readFileSync(again, 'utf8'))), 0);
  assert.equal(cmp.unmatched, 0); assert.equal(cmp.worst, 0, cmp.lines.join('\n'));
});

test('invalid rows are refused and drift is measured per class and band', () => {
  assert.deepEqual(validateRows([]), ['no leveling rows']);
  assert.ok(validateRows([{ class: 'x', mode: 'engaged', zone: 'z', fromLevel: 5, toLevel: 3 }]).length > 0);
  const row = { class: 'mage', mode: 'engaged', zone: 'z', fromLevel: 1, toLevel: 5, atMinute: 10, minutes: 10, killsPerMin: 50,
    ttkTrashS: 1, ttkChampionS: 4, deaths: 0, deathsPerHour: 0, takenLifePctPerMin: 10, xpPerHour: 1000,
    itemsPerHour: { normal: 1, magic: 1, rare: 1, legendarySet: 0 }, gemsPerHour: 1, materialsPerHour: 1, globesPerHour: 1,
    goldPickedPerHour: 100, goldNetPerHour: 100 };
  const base = buildReport({ schema: 1, scenario: 'leveling', seed: 1, args: ['10'], overrides: {}, rows: [row], summary: [] });
  const next = buildReport({ schema: 1, scenario: 'leveling', seed: 1, args: ['10'], overrides: {}, rows: [{ ...row, killsPerMin: 75 }], summary: [] });
  const cmp = compareReports(base, next, 0.25);
  assert.equal(cmp.ok, false); assert.equal(Math.round(cmp.worst * 100), 50);
  assert.match(cmp.lines[0], /killsPerMin \+50%/);
  assert.equal(base.perClass.mage.minutesTo.L5, 10);
});

test('pace check: median of the seed runs per class and band; a band needs two runs; the class median is then gated', () => {
  const row = (cls: string, fromLevel: number, champ: number | null, kpm = 90): MetricRow => ({ class: cls, mode: 'engaged', zone: 'z',
    fromLevel, toLevel: fromLevel + 5, atMinute: 10, minutes: 10, killsPerMin: kpm, ttkTrashS: 0.5, ttkChampionS: champ, deaths: 0,
    deathsPerHour: 0, takenLifePctPerMin: 10, xpPerHour: 1000, itemsPerHour: { normal: 1, magic: 1, rare: 1, legendarySet: 0 },
    gemsPerHour: 1, materialsPerHour: 1, globesPerHour: 1, goldPickedPerHour: 100, goldNetPerHour: 100 });
  const rep = (seed: number, rows: MetricRow[]) => buildReport({ schema: 1, scenario: 'leveling', seed, args: ['120'], overrides: {}, rows, summary: [] });
  // Seed A: the mage's L25 champion fight is unlucky (8 s); seeds B and C are not. The ranger reaches L25 in one run only.
  const a = rep(1, [row('warrior', 25, 6), row('ranger', 25, 5), row('mage', 25, 8)]);
  const b = rep(2, [row('warrior', 25, 6.2), row('mage', 25, 5)]);
  const c = rep(3, [row('warrior', 25, 7), row('mage', 25, 5.5)]);
  const targets = [{ fromLevel: 25, trashTtkMaxS: 1, championTtkMaxS: 6.4, killsPerMinMin: 66 }];
  assert.deepEqual(checkTargets(a, targets), [], 'seed A alone: the class median of 6 / 5 / 8 = 6 s passes');
  const m = medianOfSeeds([a, b, c]);
  assert.deepEqual(m.rows.map((r) => [r.class, r.ttkChampionS]), [['mage', 5.5], ['warrior', 6.2]], 'medians per class; the ranger band (one run) is left out');
  assert.deepEqual(checkTargets(m, targets), [], 'a band needs all three classes, as before');
  const a2 = rep(1, [row('warrior', 25, 9), row('ranger', 25, 9), row('mage', 25, 9)]);
  const b2 = rep(2, [row('warrior', 25, 8), row('ranger', 25, 8), row('mage', 25, 8)]);
  const c2 = rep(3, [row('warrior', 25, 4), row('ranger', 25, 4), row('mage', 25, 4)]);
  assert.deepEqual(checkTargets(medianOfSeeds([a2, b2, c2]), targets), ['L25+ champion TTK median 8 s > 6.4 s'], 'a real slowdown in two of three runs still fails');
  assert.match(renderMarkdown(a), /\*\*Pace check\.\*\*/);
});
