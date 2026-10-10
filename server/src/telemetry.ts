// Local playtest telemetry: an append-only JSON-lines log of what each character did and when (level-ups with play
// time, deaths by zone, quest accept/step/claim, zone changes, legendaries, logins). It exists so a real playtest
// produces measurements instead of impressions: how long levels actually take, where people die, which quests drag.
//
// Privacy: off unless TELEMETRY=1; local files under DATA_DIR/telemetry only; character ids, no IP addresses, no
// chat, no credentials. Telemetry must never break play: every failure is swallowed after one console line.

import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './config';
import { QUESTS } from '../../shared/src/data/quests';
import { questState } from '../../shared/src/quests';
import type { CharacterSave } from '../../shared/src/types';

export const TELEMETRY_ENABLED = process.env.TELEMETRY === '1';
const FLUSH_MS = 5000;

export interface TelemetryEvent { e: string; c: string; [key: string]: unknown }
export type StoredEvent = TelemetryEvent & { t: number };

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

  constructor(readonly dir = path.join(DATA_DIR, 'telemetry'), readonly enabled = TELEMETRY_ENABLED, private readonly now: () => number = Date.now) {}

  log(event: TelemetryEvent): void {
    if (!this.enabled) return;
    this.buffer.push({ t: this.now(), ...event });
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
}
