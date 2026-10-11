// Load-scaled deadlines for the real-process runtime tests (connectionRuntime, backupRuntime): a quiet-machine deadline
// is multiplied by the slowdown measured right now, so a busy shared machine does not fail a healthy server and a quiet
// machine keeps exactly the old deadlines.
//
// Two measurements [M, 2026-10-12, this laptop (Ryzen 7 7435HS, 8 cores / 16 threads) shared with other agents]:
//   * the calibrated gauge of the simulation checks (server/test/perfGauge.ts, FOUNDATION.md §13.11) tracks
//     single-thread execution speed. It hardly moves when several servers start at once (1.17–1.35 with 1, 4 or 8
//     parallel starts) while start-up became 2.8× slower (2.0 → 5.7 s), so on its own it under-scales start-up;
//   * every server prints `[server] modules loaded in N ms` (process start → all modules loaded) and that part is ~80 % of
//     start-up (1.6 of 2.0 s alone, 4.3 of 5.7 s with 8 parallel starts). N ÷ QUIET_BOOT_MS is that very process's
//     measured start-up slowdown.
// Rules:
//   * a server is ready within quiet 6 s × factor from its spawn, factor = max(gauge, boot slowdown) once the marker is
//     printed; before the marker (module loading, which either finishes or exits the process) the cap is MAX_FACTOR;
//   * later waits use max(that server's factor, a fresh gauge sample);
//   * factors are at least 1 (quiet or faster machine: the plain old deadline) and at most MAX_FACTOR, so a real hang
//     still fails within MAX_FACTOR × the quiet deadline (server/test/loadClock.test.ts, plus injected hangs in LOG.md);
//   * `RUNTIME_DEADLINE_ABSOLUTE=1` turns scaling off.
import type { EventEmitter } from 'node:events';
import { LoadGauge, QUIET_GAUGE_MS } from './perfGauge';

/** [M] Fastest module-load marker measured on this laptop (6 single starts, 2026-10-12, gauge 1.14–1.29). Load only
 *  adds time, so a quiet run is at or under it; a lower value only makes the deadlines stricter. */
export const QUIET_BOOT_MS = 1624;
/** [P] Upper bound for any scaling. The heaviest measured load made start-up ~2.8× slower with 8 parallel starts and
 *  earlier verify runs saw ~13–20 s start-ups (≈ 6–10×); beyond 10× a hang would take minutes to report. */
export const MAX_FACTOR = 10;
const ABSOLUTE = process.env.RUNTIME_DEADLINE_ABSOLUTE === '1';
const gauge = new LoadGauge(60);
const clamp = (f: number) => (ABSOLUTE ? 1 : Math.min(MAX_FACTOR, Math.max(1, f)));

/** Current single-thread slowdown versus the quiet reference laptop (1 … MAX_FACTOR). */
export function loadFactor(samples = 12): number {
  let sum = 0;
  for (let i = 0; i < samples; i++) sum += gauge.sample();
  return clamp(sum / samples / QUIET_GAUGE_MS);
}

/** Start-up slowdown of a server from its `[server] modules loaded in N ms` line, or null before it is printed. */
export function bootFactor(log: string): number | null {
  const m = /\[server\] modules loaded in (\d+) ms/.exec(log);
  return m ? clamp(Number(m[1]) / QUIET_BOOT_MS) : null;
}

/** A quiet-machine duration scaled by `factor` (default: the current gauge). */
export function scaled(quietMs: number, factor = loadFactor()): number {
  return Math.round(quietMs * factor);
}

/** Polls `predicate` every 15 ms; fails after quiet × max(`floor`, fresh gauge). */
export async function until(predicate: () => boolean, quietMs: number, label: string, floor = 1): Promise<void> {
  const factor = Math.max(clamp(floor), loadFactor()), limit = Math.round(quietMs * factor), t0 = Date.now();
  while (!predicate()) {
    if (Date.now() - t0 > limit) throw new Error(`${label} timed out after ${limit} ms (quiet ${quietMs} ms × load ${factor.toFixed(2)})`);
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

/** Waits for `event` on `emitter` (an `error` event rejects); fails after the scaled quiet deadline. */
export async function waitEvent(emitter: EventEmitter, event: string, quietMs: number, label: string, floor = 1): Promise<void> {
  let fired = false, failure: unknown = null;
  const onEvent = () => { fired = true; }, onError = (e: unknown) => { failure = e; };
  emitter.once(event, onEvent); emitter.once('error', onError);
  try { await until(() => fired || failure !== null, quietMs, label, floor); if (failure) throw failure; }
  finally { emitter.off(event, onEvent); emitter.off('error', onError); }
}

/**
 * The clock of one spawned `server/src/main.ts`. `ready()` waits for "listening on" within quiet × factor from the spawn
 * (factor fixed once the module-load marker appears); `until()` / `waitEvent()` then scale by that factor or the live
 * gauge, whichever is larger.
 */
export class ServerClock {
  factor = 1;
  private readonly spawnedAt = Date.now();
  constructor(private readonly log: () => string, private readonly check: () => void = () => {}) {}

  async ready(quietMs = 6000, label = 'Server start-up'): Promise<number> {
    const gaugeAtStart = loadFactor();
    for (;;) {
      this.check();
      const log = this.log();
      const boot = bootFactor(log);
      this.factor = Math.max(gaugeAtStart, boot ?? 1);
      if (log.includes('listening on')) return this.factor;
      const limit = Math.round(quietMs * (boot === null ? MAX_FACTOR : this.factor)), took = Date.now() - this.spawnedAt;
      if (took > limit) throw new Error(`${label} timed out after ${took} ms (quiet ${quietMs} ms × ${boot === null ? `cap ${MAX_FACTOR} before the module-load marker` : `load ${this.factor.toFixed(2)}`})`);
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }
  until(predicate: () => boolean, quietMs: number, label: string) { return until(predicate, quietMs, label, this.factor); }
  waitEvent(emitter: EventEmitter, event: string, quietMs: number, label: string) { return waitEvent(emitter, event, quietMs, label, this.factor); }
  scaled(quietMs: number) { return Math.round(quietMs * Math.max(this.factor, loadFactor())); }
}

/** node:test `timeout`: the outer safety net only (inner waits fail first), so it allows the largest factor. */
export const testTimeout = (quietMs: number) => (ABSOLUTE ? quietMs : quietMs * MAX_FACTOR);
