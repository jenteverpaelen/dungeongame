// Load gauge for the simulation's tick-time checks (server/test/sim.ts: "sim tick avg", "tick avg incl. snapshot
// consumers", "party rift tick avg", each "< 3 ms on a quiet machine"). Method and evidence: docs/rework/depth/FOUNDATION.md §13.11.
//
// Problem [M]: on a machine shared with other busy processes the measured tick time grows with the machine's load, not
// with the code. An interleaved A/B on 2026-10-11 (lead) showed the last green commit failing as often as the new one
// (median tick 4.61 vs 4.63 ms with 6–7 agents running).
// On this laptop (Ryzen 7 7435HS, 8 cores / 16 threads) under that load [M]:
//   * the test thread was preempted only ~8 % of a busy second (thread CPU 921 ms per 1000 ms wall);
//   * the ticks still ran several times slower than in quiet runs (2.6–8.9 ms against ~1–1.4 ms in earlier quiet
//     runs).
// So the loss is mostly slower execution (shared cores, lower clocks, shared caches), and CPU time does not remove it.
// A same-run speed reference does.
//
// Method:
//   * a fixed, deterministic, allocation-free reference workload runs right before every measured tick. It is a
//     miniature of the simulation's own work: bucket bodies into a grid, look up neighbour cells in a Map, float math,
//     a store per body;
//   * it runs twice and only the second, cache-warm run is timed. A cold run after a big tick costs ~0.06 ms more under
//     load [M, paired], which would blur the quiet reference;
//   * it is timed with the same clock, so it sees the same slowdowns at the same moments;
//   * load factor = mean timed sample ÷ QUIET_GAUGE_MS, never below 1;
//   * each tick check compares the mean tick with 3 ms × load factor.
// On a quiet reference laptop the mean sample is at most QUIET_GAUGE_MS, so the factor is 1 and the limit is 3 ms; on a
// faster machine also 1. Under load the limit scales with the slowdown the same run measured. A code slowdown grows the
// ticks but not the reference, so it still fails (`SIM_PERF_INJECT_MS` in sim.ts).
// `SIM_PERF_ABSOLUTE=1` turns the correction off (plain 3 ms). On a slower machine the limit means "3 ms on the
// reference laptop".

/**
 * The reference speed, from these measurements:
 *   * [M] 0.125 ms is the fastest warm sample measured on the owner's laptop (2026-10-11). It was measured under load,
 *     and load only adds time, so a quiet machine's fastest sample is at most this;
 *   * [P] × 1.05 for the quiet spread of a fixed, warm, allocation-free workload (timer and interrupt noise only).
 * A quiet run's mean sample is therefore at most this, and a quiet run keeps the plain 3 ms limit.
 * Every perf line prints the fastest and mean sample. A lower value only makes the checks stricter.
 */
export const QUIET_GAUGE_MS = 0.125 * 1.05;

/** Plain 3 ms limits, no load correction (`SIM_PERF_ABSOLUTE=1`). */
const ABSOLUTE = process.env.SIM_PERF_ABSOLUTE === '1';

const N = 160, CELL = 128, GRID = 16; // 160 bodies on a 2048-unit square, 16 × 16 cells

export class LoadGauge {
  private readonly xs = new Float64Array(N);
  private readonly ys = new Float64Array(N);
  private readonly hp = new Int32Array(N);
  private readonly cellOf = new Int32Array(N);
  private readonly count = new Int32Array(GRID * GRID);
  private readonly start = new Int32Array(GRID * GRID + 1);
  private readonly cursor = new Int32Array(GRID * GRID);
  private readonly order = new Int32Array(N);
  /** Cell key → cell index (a hash lookup per neighbour cell, as the simulation's spatial hash does). */
  private readonly lookup = new Map<number, number>();
  private readonly samples: number[] = [];
  /** Keeps the work observable (the optimiser cannot drop it). */
  sink = 0;

  constructor(warmup = 200) {
    let s = 12345;
    const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let i = 0; i < N; i++) { this.xs[i] = r() * CELL * GRID; this.ys[i] = r() * CELL * GRID; }
    for (let cx = 0; cx < GRID; cx++) for (let cy = 0; cy < GRID; cy++) this.lookup.set(cx * 1024 + cy, cx * GRID + cy);
    for (let i = 0; i < warmup; i++) this.sink += this.work(); // JIT warm-up, untimed
  }

  /** One reference sample: a fixed amount of simulation-like work, run twice, the warm run timed. Returns its ms. */
  sample(): number {
    this.sink += this.work(); // untimed: brings the reference's data and code back into the caches after a tick
    const t0 = performance.now();
    this.sink += this.work();
    const dt = performance.now() - t0;
    this.samples.push(dt);
    return dt;
  }

  /** `ms` of quiet-reference work (ms ÷ QUIET_GAUGE_MS reference units): a deliberate code slowdown for tests. */
  burn(ms: number): void {
    for (let i = Math.max(1, Math.round(ms / QUIET_GAUGE_MS)); i > 0; i--) this.sink += this.work();
  }

  stats() {
    let min = Infinity, sum = 0;
    for (const v of this.samples) { if (v < min) min = v; sum += v; }
    const mean = sum / Math.max(1, this.samples.length);
    return { n: this.samples.length, min, mean, factor: ABSOLUTE ? 1 : Math.max(1, mean / QUIET_GAUGE_MS) };
  }

  private work(): number {
    const { xs, ys, hp, cellOf, count, start, cursor, order, lookup } = this;
    let acc = 0;
    for (let round = 0; round < 4; round++) {
      // Counting sort of the bodies into their cells (no allocation).
      count.fill(0);
      for (let i = 0; i < N; i++) { const c = ((xs[i] / CELL) | 0) * GRID + ((ys[i] / CELL) | 0); cellOf[i] = c; count[c]++; }
      for (let c = 0; c < GRID * GRID; c++) { start[c + 1] = start[c] + count[c]; cursor[c] = start[c]; }
      for (let i = 0; i < N; i++) order[cursor[cellOf[i]]++] = i;
      for (let i = 0; i < N; i++) {
        const cx = (xs[i] / CELL) | 0, cy = (ys[i] / CELL) | 0;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const c = lookup.get((cx + dx) * 1024 + cy + dy);
          if (c === undefined) continue;
          for (let k = start[c]; k < start[c + 1]; k++) {
            const j = order[k];
            if (j === i) continue;
            const d = Math.hypot(xs[j] - xs[i], ys[j] - ys[i]);
            if (d < CELL) acc += Math.atan2(ys[j] - ys[i], xs[j] - xs[i]) * 0.001 + d * 1e-6;
          }
        }
        hp[i] = (hp[i] + 1) % 100;
      }
    }
    return acc;
  }
}
