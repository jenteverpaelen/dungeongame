# Local foundation candidate results — 2026-10-09

All measurements ran on the owner's Windows x64 PC: Ryzen 7 7435HS, 16 logical CPUs, 16.85 GB physical RAM, Node 24.19.0, bundled SQLite 3.53.3. Fresh process and temporary DATA_DIR per case; no real saves. See [plan](MEASUREMENT-PLAN.md), [harness](../../../scripts/benchmark-foundations.mjs) and [raw final report](checks/foundation-benchmark.json).

## Hashing [measured]

24 operations per cell after one warmup; synthetic input, random 16-byte salt, 32-byte output. UV_THREADPOOL_SIZE=4. Table gives individual completion times, not a complete login transaction.

| Published configuration | Concurrency | Mean / p95 ms | Sampled peak process RSS |
|---|---:|---:|---:|
| Argon2id, 19 MiB, t=2, p=1 | 1 | 28.644 / 31.309 | 63.20 MB |
| Argon2id, 19 MiB, t=2, p=1 | 4 | 45.270 / 49.565 | 123.14 MB |
| Argon2id, 46 MiB, t=1, p=1 | 1 | 36.349 / 37.920 | 91.55 MB |
| Argon2id, 46 MiB, t=1, p=1 | 4 | 62.239 / 67.352 | 236.21 MB |
| scrypt, N=131072, r=8, p=1 | 1 | 244.533 / 248.377 | 177.72 MB |
| scrypt, N=131072, r=8, p=1 | 4 | 306.078 / 332.402 | 580.35 MB |

These are OWASP-listed configurations, not a security comparison inferred from speed. Sampled RSS includes Node and may miss peaks. CPU scheduling, desktop contention and warmup affect results. No passwords or derived outputs are stored. Argon2id is available and operational locally; the draft's assumption that built-in scrypt is the only dependency-free choice is superseded.

## Storage [measured]

Five bursts of 100 distinct snapshots, each 4,788–4,790 bytes. This fixture is not a full endgame inventory or a measured population payload distribution. Every SQLite statement commits individually, WAL/FULL (synchronous=2). Average burst includes completion of all 100 saves; compare that metric across modes rather than the differently scoped per-operation metrics in the raw report.

| Candidate | Mean / max burst ms | Maximum main event-loop delay ms |
|---|---:|---:|
| Async JSON temp/rename | 59.402 / 63.617 | 13.328 |
| Async JSON temp/rename, flush=true | 71.314 / 74.530 | 14.672 |
| SQLite, main thread | 45.503 / 50.757 | 51.085 |
| SQLite, dedicated worker | 44.830 / 50.277 | 15.696 |

Every mode reads back all 100 latest snapshots. Both SQLite cases pass rollback, online backup, reopened integrity_check and equality for all 100 rows. Each backup contains 123 pages; measured backup times are 5.442 and 5.133 ms. This is a synthetic API/restore drill, not a production backup procedure or forced-crash/power-loss test.

## Interpretation and limits

**Inference:** synchronous SQLite bursts can occupy a whole existing 50 ms tick interval. If selected, use a worker and a bounded asynchronous interface; do not put synchronous commits in the simulation loop. The extra JSON flush cost was observable but not prohibitive in this workload. It does not by itself establish durable rename/directory metadata across power loss.

**Not measured:** real server tick overlap, 100 browser clients, contention among processes, full inventory payloads, disk-full behavior, long-running growth, cold storage, reboot recovery, hostile login load or another host. No production database or authentication policy is selected by this report alone.

**Later follow-up:** C038 TRANSACTION-REPORT.md covers full inventory/stash serialization, controlled competing writers and process termination in a synthetic ownership transaction. It does not extend these timings or resolve the other limitations above.

Pilot `hf-foundation-bench-MUYLeN` is retained in [pilot report](checks/foundation-benchmark-pilot.json). It had incorrectly named byte statistics with the shared timing helper's `Ms` suffix. The harness corrected those labels and reran all cases in `hf-foundation-bench-10fALp`; the table uses only this final run. Both runs show the main-thread stall; do not select the fastest run as a capacity promise.
