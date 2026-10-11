// Local playtest telemetry: an append-only JSON-lines log of what each character did and when (level-ups with play
// time, deaths by zone, quest accept/step/claim, zone changes, legendaries, logins). It exists so a real playtest
// produces measurements instead of impressions: how long levels actually take, where people die, which quests drag.
//
// Privacy: off unless TELEMETRY=1; local files under DATA_DIR/telemetry only; character ids, no IP addresses, no
// chat, no credentials. Telemetry must never break play: every failure is swallowed after one console line.
//
// Schema (2026-10-11, F-TEL-04): every event is checked against EVENT_SCHEMA before it is written. Unknown events are
// dropped, unknown fields are dropped, strings are cut to 40 characters, numbers must be finite. Stored lines carry
// `s` (schema version). Files older than TELEMETRY_RETENTION_DAYS (default 30, a proposal for playtests) are deleted
// at start-up and once a day. A character's lines are included in its owner's data export and removed when the
// character is erased (server/src/privacy.ts). Field reference: docs/rework/partials/TELEMETRY-SCHEMA.md.

import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './config';
import { QUESTS } from '../../shared/src/data/quests';
import { questState } from '../../shared/src/quests';
import type { CharacterSave } from '../../shared/src/types';

export const TELEMETRY_ENABLED = process.env.TELEMETRY === '1';
const FLUSH_MS = 5000;
export const TELEMETRY_SCHEMA_VERSION = 1;
const DAY = 86_400_000;
export function parseRetentionDays(value: string | undefined): number {
  if (value === undefined || value === '') return 30;
  if (!/^[1-9][0-9]{0,3}$/.test(value)) throw new Error('TELEMETRY_RETENTION_DAYS must be a positive integer (days)');
  return Number(value);
}
export const TELEMETRY_RETENTION_DAYS = parseRetentionDays(process.env.TELEMETRY_RETENTION_DAYS);

type FieldType = 'string' | 'number' | 'boolean';
/** Every event the server may write, with its allowed fields (beyond t, e, c, s). `?` marks optional fields. */
export const EVENT_SCHEMA: Readonly<Record<string, Readonly<Record<string, `${FieldType}` | `${FieldType}?`>>>> = {
  login: { fresh: 'boolean', cls: 'string', lvl: 'number', playMs: 'number', afkMs: 'number?', afkKills: 'number?', afkLevels: 'number?' },
  logout: { lvl: 'number', playMs: 'number', kills: 'number', deaths: 'number' },
  level: { lvl: 'number', playMs: 'number', zone: 'string', kills: 'number', deaths: 'number', gold: 'number' },
  death: { lvl: 'number', playMs: 'number', zone: 'string', n: 'number' },
  legendary: { lvl: 'number', playMs: 'number', zone: 'string', n: 'number' },
  zone: { lvl: 'number', playMs: 'number', zone: 'string', from: 'string', to: 'string' },
  quest: { lvl: 'number', playMs: 'number', zone: 'string', q: 'string', a: 'string', step: 'number' },
};

export interface TelemetryEvent { e: string; c: string; [key: string]: unknown }
export type StoredEvent = TelemetryEvent & { t: number };

/** The schema-conforming copy of an event, or null when it cannot be written. Pure. */
export function sanitizeEvent(event: TelemetryEvent): TelemetryEvent | null {
  const schema = Object.hasOwn(EVENT_SCHEMA, event.e) ? EVENT_SCHEMA[event.e] : undefined;
  if (!schema || typeof event.c !== 'string' || !/^[a-z0-9]{1,16}$/.test(event.c)) return null;
  const out: TelemetryEvent = { e: event.e, c: event.c };
  for (const [field, spec] of Object.entries(schema)) {
    // `?` documents fields that only some events of a kind carry; a missing field is never invented, only a
    // present one with the wrong type rejects the event.
    const type = spec.replace('?', '') as FieldType, v = event[field];
    if (v === undefined) continue;
    if (type === 'number' ? typeof v !== 'number' || !Number.isFinite(v) : typeof v !== type) return null;
    out[field] = type === 'string' ? (v as string).slice(0, 40) : v;
  }
  return out;
}

/** The few numbers worth comparing between two looks at the same character. */
export interface Observed {
  level: number; deaths: number; legendaries: number; kills: number; gold: number;
  zone: string; playMs: number; quests: Record<string, string>;
}

export function observe(save: CharacterSave, zone: string, playMs: number): Observed {
  const quests: Record<string, string> = {};
  for (const q of QUESTS) {
    const s = questState(save, q.id);
    if (s) quests[q.id] = [s.step, s.progress ?? 0, s.claimed ? 1 : 0, s.cycle ?? 0, s.completions ?? 0].join(':');
  }
  return { level: save.level, deaths: save.stats.deaths, legendaries: save.stats.legendaries, kills: save.stats.kills, gold: save.gold, zone, playMs, quests };
}

/** Pure: which events does the change from `prev` to `next` represent? */
export function diffEvents(prev: Observed | null, next: Observed, c: string): TelemetryEvent[] {
  if (!prev) return [];
  const out: TelemetryEvent[] = [];
  const base = { c, lvl: next.level, playMs: Math.round(next.playMs), zone: next.zone };
  for (let lv = prev.level + 1; lv <= next.level; lv++) {
    out.push({ e: 'level', ...base, lvl: lv, kills: next.kills, deaths: next.deaths, gold: next.gold });
  }
  if (next.deaths > prev.deaths) out.push({ e: 'death', ...base, n: next.deaths - prev.deaths });
  if (next.legendaries > prev.legendaries) out.push({ e: 'legendary', ...base, n: next.legendaries - prev.legendaries });
  if (next.zone !== prev.zone) out.push({ e: 'zone', ...base, from: prev.zone, to: next.zone });
  for (const [id, sig] of Object.entries(next.quests)) {
    const before = prev.quests[id];
    if (before === sig) continue;
    const [step, , claimed, cycle, done] = sig.split(':').map(Number);
    const [, , wasClaimed, wasCycle, wasDone] = (before ?? '0:0:0:0:0').split(':').map(Number);
    const reaccepted = cycle > wasCycle && claimed === 0;
    const finished = (claimed === 1 && wasClaimed !== 1) || done > wasDone;
    out.push({ e: 'quest', ...base, q: id, a: before === undefined || reaccepted ? 'accept' : finished ? 'claim' : 'step', step });
  }
  return out;
}

export class Telemetry {
  private buffer: StoredEvent[] = [];
  private timer: NodeJS.Timeout | null = null;
  private writing: Promise<void> = Promise.resolve();
  private warned = false;
  private lastPrune = 0;
  /** Events refused by the schema since start (a programming error worth seeing in /healthz-style diagnostics). */
  rejected = 0;

  constructor(readonly dir = path.join(DATA_DIR, 'telemetry'), readonly enabled = TELEMETRY_ENABLED, private readonly now: () => number = Date.now,
    readonly retentionDays = TELEMETRY_RETENTION_DAYS) {}

  log(event: TelemetryEvent): void {
    if (!this.enabled) return;
    const clean = sanitizeEvent(event);
    if (!clean) { this.rejected++; return; }
    this.buffer.push({ t: this.now(), s: TELEMETRY_SCHEMA_VERSION, ...clean });
    if (this.now() - this.lastPrune > DAY) { this.lastPrune = this.now(); void this.prune(); }
    if (!this.timer) {
      this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, FLUSH_MS);
      this.timer.unref?.();
    }
  }
  logAll(events: TelemetryEvent[]): void { for (const e of events) this.log(e); }

  /** Appends buffered events to one file per UTC day. Safe to call at any time; never rejects. */
  flush(): Promise<void> {
    if (!this.buffer.length) return this.writing;
    const batch = this.buffer;
    this.buffer = [];
    this.writing = this.writing.then(async () => {
      try {
        const byDay = new Map<string, string[]>();
        for (const ev of batch) {
          const day = new Date(ev.t).toISOString().slice(0, 10);
          const lines = byDay.get(day) ?? [];
          lines.push(JSON.stringify(ev));
          byDay.set(day, lines);
        }
        await fs.mkdir(this.dir, { recursive: true });
        for (const [day, lines] of byDay) await fs.appendFile(path.join(this.dir, `events-${day}.jsonl`), lines.join('\n') + '\n');
      } catch (error) {
        if (!this.warned) { this.warned = true; console.error('[telemetry] could not write events:', error instanceof Error ? error.message : error); }
      }
    });
    return this.writing;
  }

  async shutdown(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    await this.flush();
  }

  private async dayFiles(): Promise<string[]> {
    try { return (await fs.readdir(this.dir)).filter(f => /^events-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }

  /** Deletes day files older than the retention period (whole UTC days). Runs even when logging is off. Never rejects. */
  prune(now = this.now()): Promise<number> {
    const run = this.writing.then(async () => {
      let removed = 0;
      try {
        const cutoff = new Date(now - this.retentionDays * DAY).toISOString().slice(0, 10);
        for (const f of await this.dayFiles()) if (f.slice(7, 17) < cutoff) { await fs.rm(path.join(this.dir, f), { force: true }); removed++; }
      } catch (error) { console.error('[telemetry] retention cleanup failed:', error instanceof Error ? error.message : error); }
      return removed;
    });
    this.writing = run.then(() => undefined);
    return run;
  }

  /** Every stored event about these characters (data export). */
  async eventsFor(ids: Iterable<string>): Promise<StoredEvent[]> {
    const want = new Set(ids), out: StoredEvent[] = [];
    await this.flush();
    for (const f of await this.dayFiles()) {
      for (const line of (await fs.readFile(path.join(this.dir, f), 'utf8')).split('\n')) {
        if (!line) continue;
        try { const ev = JSON.parse(line) as StoredEvent; if (want.has(ev.c)) out.push(ev); } catch { /* a torn line is skipped */ }
      }
    }
    return out;
  }

  /** Removes every stored (and buffered) event about these characters (erasure). Returns lines removed. */
  scrub(ids: Iterable<string>): Promise<number> {
    const drop = new Set(ids);
    this.buffer = this.buffer.filter(ev => !drop.has(ev.c));
    const run = this.writing.then(async () => {
      let removed = 0;
      for (const f of await this.dayFiles()) {
        const file = path.join(this.dir, f), lines = (await fs.readFile(file, 'utf8')).split('\n').filter(Boolean);
        const keep = lines.filter(line => { try { return !drop.has((JSON.parse(line) as StoredEvent).c); } catch { return true; } });
        if (keep.length === lines.length) continue;
        removed += lines.length - keep.length;
        const tmp = `${file}.tmp`;
        await fs.writeFile(tmp, keep.length ? keep.join('\n') + '\n' : '', { flush: true });
        await fs.rename(tmp, file);
      }
      return removed;
    });
    this.writing = run.then(() => undefined, () => undefined);
    return run;
  }
}
