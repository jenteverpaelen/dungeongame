/**
 * Turns the playtest telemetry log into a readable report.
 *
 *   npx tsx scripts/analyze-telemetry.ts <folder-with-events-*.jsonl> [--write docs/rework/PLAYTEST_REPORT.md]
 *
 * The folder is `<DATA_DIR>/telemetry` of a server that ran with TELEMETRY=1. Read-only on the log files.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { summarize } from '../server/src/telemetryReport';
import type { StoredEvent } from '../server/src/telemetry';

const args = process.argv.slice(2);
const writeAt = args.indexOf('--write');
const output = writeAt >= 0 ? args[writeAt + 1] : undefined;
const dir = args.find((a, i) => !a.startsWith('--') && i !== writeAt + 1);
if (!dir) { console.error('Give the telemetry folder (…/telemetry).'); process.exit(1); }

const events: StoredEvent[] = [];
for (const name of (await fs.readdir(dir)).filter(n => /^events-\d{4}-\d{2}-\d{2}\.jsonl$/.test(n)).sort()) {
  for (const line of (await fs.readFile(path.join(dir, name), 'utf8')).split('\n')) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line) as StoredEvent); } catch { /* a half-written last line is ignored */ }
  }
}
const report = summarize(events);
if (output) { await fs.writeFile(output, report); console.log(`Wrote ${output} (${events.length} events).`); }
else console.log(report);
