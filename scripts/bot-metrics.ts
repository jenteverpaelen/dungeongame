// Bot metrics report (F-TEL-02): kills/min, time-to-kill, deaths, XP/h, gold/h and drops/h per class × level band,
// measured by the engaged leveling bot in server/test/sim.ts (fields only, no town trips or quests).
//
//   npx tsx scripts/bot-metrics.ts run [minutes=240] [--out docs/rework/partials/bot-metrics]   simulate + write report
//   npx tsx scripts/bot-metrics.ts render <sim.json> [--out dir]                                report from a SIM_JSON file
//   npx tsx scripts/bot-metrics.ts compare <baseline.json> <new.json> [--max-drift 0.25]        drift per class × band
//
// A run needs an isolated DATA_DIR (the simulation never writes saves, but the rule holds for every test command).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface MetricRow {
  class: string; mode: string; zone: string; fromLevel: number; toLevel: number; atMinute: number; minutes: number;
  killsPerMin: number; ttkTrashS: number | null; ttkChampionS: number | null; deaths: number; deathsPerHour: number;
  takenLifePctPerMin: number; xpPerHour: number;
  itemsPerHour: { normal: number; magic: number; rare: number; legendarySet: number };
  gemsPerHour: number; materialsPerHour: number; globesPerHour: number; goldPickedPerHour: number; goldNetPerHour: number;
}
export interface SimJson { schema: number; scenario: string; seed: number; args: string[]; overrides: Record<string, string | null>; rows: MetricRow[]; summary: string[] }
export interface MetricsReport {
  schema: 1; source: 'server/test/sim.ts leveling'; seed: number; minutes: number; mode: string;
  overrides: Record<string, string | null>; rows: MetricRow[];
  perClass: Record<string, { endLevel: number; minutesTo: Record<string, number>; deaths: number }>;
}

const NUMERIC: (keyof MetricRow)[] = ['killsPerMin', 'xpPerHour', 'goldPickedPerHour', 'deathsPerHour', 'ttkTrashS', 'ttkChampionS'];

export function validateRows(rows: unknown): string[] {
  const problems: string[] = [];
  if (!Array.isArray(rows) || rows.length === 0) return ['no leveling rows'];
  rows.forEach((r: any, i) => {
    for (const k of ['class', 'mode', 'zone']) if (typeof r?.[k] !== 'string') problems.push(`row ${i}: ${k} missing`);
    for (const k of ['fromLevel', 'toLevel', 'atMinute', 'minutes', 'killsPerMin', 'deaths', 'deathsPerHour', 'xpPerHour', 'goldPickedPerHour', 'goldNetPerHour'])
      if (!Number.isFinite(r?.[k]) || r[k] < 0) problems.push(`row ${i}: ${k} not a non-negative number`);
    if (r?.toLevel < r?.fromLevel) problems.push(`row ${i}: level went down`);
    for (const k of ['normal', 'magic', 'rare', 'legendarySet']) if (!Number.isFinite(r?.itemsPerHour?.[k])) problems.push(`row ${i}: itemsPerHour.${k}`);
  });
  return problems;
}

export function buildReport(sim: SimJson): MetricsReport {
  const problems = validateRows(sim.rows);
  if (problems.length) throw new Error(`invalid leveling rows: ${problems.slice(0, 5).join('; ')}`);
  const perClass: MetricsReport['perClass'] = {};
  for (const r of sim.rows) {
    const c = perClass[r.class] ??= { endLevel: 1, minutesTo: {}, deaths: 0 };
    c.endLevel = Math.max(c.endLevel, r.toLevel); c.deaths += r.deaths;
    // First simulated minute at which a row closed at or above each fifth level (rows close at every fifth level).
    for (let l = 5; l <= r.toLevel; l += 5) c.minutesTo[`L${l}`] ??= r.atMinute;
  }
  const minutes = Number(sim.args[0] ?? 0) || Math.max(0, ...sim.rows.map(r => r.atMinute));
  return { schema: 1, source: 'server/test/sim.ts leveling', seed: sim.seed, minutes, mode: sim.rows[0].mode, overrides: sim.overrides, rows: sim.rows, perClass };
}

const n = (v: number | null, d = 0) => (v === null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d }));
const k = (v: number) => (v >= 1e6 ? `${n(v / 1e6, 2)} M` : v >= 1e4 ? `${n(v / 1e3, 0)} k` : n(v));

export function renderMarkdown(rep: MetricsReport): string {
  const out: string[] = [];
  out.push('# Bot metrics (F-TEL-02)', '');
  out.push(`Measured [M] by \`npx tsx scripts/bot-metrics.ts run ${rep.minutes}\`: the engaged leveling bot of \`server/test/sim.ts\` ` +
    `(class build, skill points spent, best own drop worn by sheet DPS × √toughness), ${rep.minutes} simulated minutes per class, ` +
    `seed ${rep.seed}, fields only (Whispering Glade, Ashen Hollow from level 12), no town trips, quests, rifts or vendor ` +
    `sales. A row closes at every fifth level (or the end of the run); rates are per hour of simulated play. ` +
    `Overrides: ${Object.entries(rep.overrides).filter(([, v]) => v).map(([a, v]) => `${a}=${v}`).join(', ') || 'none'}.`, '');
  out.push('**Limits.** Bots stand in melee and never dodge, so deaths and damage taken are an upper bound for humans; they also ' +
    'never walk back to town, so kills/min is an upper bound for real sessions. This is a typical-gear curve, not a lucky one ' +
    '(see `docs/rework/BALANCE.md` §3).', '');
  out.push('| Class | end level | deaths | minutes to ' + ['L5', 'L10', 'L15', 'L20', 'L25', 'L30'].join(' · ') + ' |', '|---|---:|---:|---|');
  for (const [cls, c] of Object.entries(rep.perClass))
    out.push(`| ${cls} | ${c.endLevel} | ${c.deaths} | ${['L5', 'L10', 'L15', 'L20', 'L25', 'L30'].map(l => c.minutesTo[l] ?? '—').join(' · ')} |`);
  out.push('');
  for (const cls of Object.keys(rep.perClass)) {
    out.push(`## ${cls}`, '');
    out.push('| levels | zone | at min | min in band | kills/min | TTK trash s | TTK champ s | deaths/h | taken % life/min | XP/h | gold/h | items/h n/m/r/L+S | gems/h | mats/h |');
    out.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|');
    for (const r of rep.rows.filter(x => x.class === cls)) {
      const i = r.itemsPerHour;
      out.push(`| ${r.fromLevel}→${r.toLevel} | ${r.zone.replace(/_/g, ' ')} | ${n(r.atMinute, 1)} | ${n(r.minutes, 1)} | ${n(r.killsPerMin, 0)} | ${n(r.ttkTrashS, 2)} | ${n(r.ttkChampionS, 1)} | ${n(r.deathsPerHour, 1)} | ${n(r.takenLifePctPerMin)} | ${k(r.xpPerHour)} | ${k(r.goldPickedPerHour)} | ${i.normal}/${i.magic}/${i.rare}/${i.legendarySet} | ${r.gemsPerHour} | ${r.materialsPerHour} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

/** Relative change of the headline metrics between two reports, matched by class and level band. */
export function compareReports(base: MetricsReport, next: MetricsReport, maxDrift = Infinity) {
  const lines: string[] = []; let worst = 0; let unmatched = 0;
  for (const r of next.rows) {
    const b = base.rows.find(x => x.class === r.class && x.fromLevel === r.fromLevel);
    if (!b) { unmatched++; continue; }
    const parts: string[] = [];
    for (const key of NUMERIC) {
      const was = b[key] as number | null, now = r[key] as number | null;
      if (was === null || now === null) continue;
      const rel = was === 0 ? (now === 0 ? 0 : 1) : (now - was) / Math.abs(was);
      if (key !== 'deathsPerHour') worst = Math.max(worst, Math.abs(rel));
      if (Math.abs(rel) >= 0.05) parts.push(`${key} ${rel > 0 ? '+' : ''}${Math.round(rel * 100)}%`);
    }
    lines.push(`${r.class} L${r.fromLevel}→${r.toLevel}: ${parts.join(', ') || 'within 5 %'}`);
  }
  return { lines, worst, unmatched, ok: worst <= maxDrift };
}

function arg(name: string, fallback: string) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; }
function writeReport(rep: MetricsReport, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'baseline.json'), JSON.stringify(rep, null, 1) + '\n');
  fs.writeFileSync(path.join(outDir, 'BOT-METRICS.md'), renderMarkdown(rep) + '\n');
  console.log(`wrote ${path.join(outDir, 'baseline.json')} and BOT-METRICS.md (${rep.rows.length} rows)`);
}

async function main() {
  const [cmd, a1, a2] = process.argv.slice(2);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = path.resolve(arg('--out', path.join(root, 'docs/rework/partials/bot-metrics')));
  if (cmd === 'run') {
    if (!process.env.DATA_DIR) throw new Error('Set an isolated DATA_DIR first');
    const minutes = String(Number(a1 ?? 240) || 240);
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hf-bot-metrics-')), 'sim.json');
    const res = spawnSync(process.execPath, ['--import', 'tsx', path.join(root, 'server/test/sim.ts'), 'leveling', minutes],
      { cwd: root, env: { ...process.env, SIM_JSON: tmp }, stdio: ['ignore', 'inherit', 'inherit'] });
    // The leveling checks may fail on very short runs (they expect L5); the report is still valid.
    if (!fs.existsSync(tmp)) throw new Error(`simulation wrote no metrics (exit ${res.status})`);
    writeReport(buildReport(JSON.parse(fs.readFileSync(tmp, 'utf8'))), outDir);
  } else if (cmd === 'render' && a1) {
    writeReport(buildReport(JSON.parse(fs.readFileSync(a1, 'utf8'))), outDir);
  } else if (cmd === 'compare' && a1 && a2) {
    const load = (f: string) => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return 'perClass' in j ? j as MetricsReport : buildReport(j); };
    const r = compareReports(load(a1), load(a2), Number(arg('--max-drift', 'Infinity')));
    for (const l of r.lines) console.log(l);
    console.log(`worst headline drift ${Math.round(r.worst * 100)}%, ${r.unmatched} unmatched band(s)`);
    if (!r.ok) process.exitCode = 1;
  } else {
    console.log('usage: bot-metrics.ts run [minutes] | render <sim.json> | compare <baseline.json> <new.json> [--max-drift x]');
    process.exitCode = 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
