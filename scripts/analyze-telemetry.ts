/**
 * Turns the playtest telemetry log into a readable report.
 *
 *   npx tsx scripts/analyze-telemetry.ts <folder-with-events-*.jsonl> [--write docs/rework/PLAYTEST_REPORT.md] [--html out.html]
 *
 * The folder is `<DATA_DIR>/telemetry` of a server that ran with TELEMETRY=1. Read-only on the log files. `--html`
 * writes a self-contained analytics page (funnel, sessions, level pace, active days, deaths) for the owner; it loads
 * nothing from the network.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { summarize } from '../server/src/telemetryReport';
import { analytics, renderAnalyticsHtml } from '../server/src/telemetryAnalytics';
import type { StoredEvent } from '../server/src/telemetry';

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const output = option('--write'), html = option('--html');
const dir = args.find((a, i) => !a.startsWith('--') && !['--write', '--html'].includes(args[i - 1]));
if (!dir) { console.error('Give the telemetry folder (…/telemetry).'); process.exit(1); }

const events: StoredEvent[] = [];
for (const name of (await fs.readdir(dir)).filter(n => /^events-\d{4}-\d{2}-\d{2}\.jsonl$/.test(n)).sort()) {
  for (const line of (await fs.readFile(path.join(dir, name), 'utf8')).split('\n')) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line) as StoredEvent); } catch { /* a half-written last line is ignored */ }
  }
}
if (html) { await fs.writeFile(html, renderAnalyticsHtml(analytics(events))); console.log(`Wrote ${html} (${events.length} events).`); }
const report = summarize(events);
if (output) { await fs.writeFile(output, report); console.log(`Wrote ${output} (${events.length} events).`); }
else if (!html) console.log(report);
