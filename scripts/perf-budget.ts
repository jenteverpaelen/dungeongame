// Headless performance budget (F-TEL-01, roadmap §12.2): runs `server/test/sim.ts budget` and checks
//   * the owner's server budget [O] — 4 instances × 150 monsters tick in < 10 ms total (ARCHITECTURE §1.2), and the p99
//     round inside one 20 Hz tick period (50 ms); both are absolute, so they hold on any machine that meets the budget;
//   * snapshot bandwidth against the recorded baseline (deterministic for a seed): more than +15 % fails — the same
//     tolerance the owner set for client fps ("within 15 % of baseline", HANDOFF §6) — until the baseline is re-recorded.
//
//   npx tsx scripts/perf-budget.ts            check (writes evidence to $DATA_DIR/perf-budget.json)
//   npx tsx scripts/perf-budget.ts --record   re-record docs/rework/partials/perf-baseline.json after an intended change
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface Budget { roundMs: { avg: number; p95: number; p99: number; max: number }; snapshotBytes: { perClientPerSecAvg: number; perClientPerSecMax: number; largestMessage: number }; budget: { roundAvgMs: number; roundP99Ms: number }; monstersPerInstance: number[]; node: string; platform: string }
const BYTES_TOLERANCE = 0.15;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselineFile = path.join(root, 'docs/rework/partials/perf-baseline.json');
if (!process.env.DATA_DIR) throw new Error('Set an isolated DATA_DIR first');
const out = path.join(process.env.DATA_DIR, 'perf-budget.json');
const res = spawnSync(process.execPath, ['--import', 'tsx', path.join(root, 'server/test/sim.ts'), 'budget'],
  { cwd: root, env: { ...process.env, PERF_JSON: out }, encoding: 'utf8' });
process.stdout.write(res.stdout ?? ''); process.stderr.write(res.stderr ?? '');
if (!fs.existsSync(out)) throw new Error(`budget scenario wrote no result (exit ${res.status})`);
const now = JSON.parse(fs.readFileSync(out, 'utf8')) as Budget;
const problems: string[] = [];
if (res.status !== 0) problems.push('the budget scenario reported failed checks (see above)');
if (now.roundMs.avg >= now.budget.roundAvgMs) problems.push(`round avg ${now.roundMs.avg} ms ≥ ${now.budget.roundAvgMs} ms [O]`);
if (now.roundMs.p99 >= now.budget.roundP99Ms) problems.push(`round p99 ${now.roundMs.p99} ms ≥ ${now.budget.roundP99Ms} ms`);

if (process.argv.includes('--record')) {
  const record = { recorded: new Date().toISOString().slice(0, 10), machine: `${(os.cpus()[0]?.model ?? 'unknown').replace(/\s+/g, ' ').trim()} ×${os.cpus().length}, ${os.platform()}`, ...now };
  fs.writeFileSync(baselineFile, JSON.stringify(record, null, 1) + '\n');
  console.log(`recorded ${path.relative(root, baselineFile)}`);
} else if (fs.existsSync(baselineFile)) {
  const base = JSON.parse(fs.readFileSync(baselineFile, 'utf8')) as Budget & { recorded: string; machine: string };
  const rel = (a: number, b: number) => (b ? (a - b) / b : 0);
  const bytes = rel(now.snapshotBytes.perClientPerSecAvg, base.snapshotBytes.perClientPerSecAvg);
  console.log(`baseline ${base.recorded} (${base.machine}): round avg ${base.roundMs.avg} → ${now.roundMs.avg} ms, p99 ${base.roundMs.p99} → ${now.roundMs.p99} ms (timing is informative only; the gate is the absolute budget)`);
  console.log(`snapshot bytes/s per client ${base.snapshotBytes.perClientPerSecAvg} → ${now.snapshotBytes.perClientPerSecAvg} (${bytes >= 0 ? '+' : ''}${(bytes * 100).toFixed(1)} %), largest message ${base.snapshotBytes.largestMessage} → ${now.snapshotBytes.largestMessage} B`);
  if (bytes > BYTES_TOLERANCE) problems.push(`snapshot bandwidth +${(bytes * 100).toFixed(1)} % over the recorded baseline (limit +${BYTES_TOLERANCE * 100} %); re-record with --record if intended`);
} else problems.push(`no baseline at ${path.relative(root, baselineFile)}; run with --record`);

if (problems.length) { console.log('PERF BUDGET FAILED:'); for (const p of problems) console.log(`  - ${p}`); process.exitCode = 1; }
else console.log('perf budget passed');
