# Local hashing and storage measurement plan

2026-10-09; evidence before implementation. This harness evaluates candidates without changing the server's current storage or credentials.

## Sources and question

NODE24-CRYPT documents asynchronous built-in Argon2 and scrypt. OWASP-PASS recommends Argon2id and published minimum parameter sets, with target-machine benchmarking. Compare two listed Argon2id configurations (19 MiB / 2 passes / 1 lane and 46 MiB / 1 pass / 1 lane) and its scrypt fallback (N=131072, r=8, p=1). No external crypto package is needed for this experiment. Use fresh random 16-byte salts and synthetic input only; never record password or hash outputs.

NODE24-SQL documents synchronous DatabaseSync calls and asynchronous online backup. SQLite's [WAL documentation](https://www.sqlite.org/wal.html), read overview, concurrency, performance, WAL-file and WAL-reset-bug sections, warns that WAL is persistent database state and permits one writer. Its [synchronous pragma](https://www.sqlite.org/pragma.html#pragma_synchronous), FULL/NORMAL paragraphs read, distinguishes commit synchronization. Test WAL with FULL synchronization. Record the actual bundled SQLite version because the documented WAL-reset fix requires 3.51.3 or a specified backport; Node's version alone is not evidence.

## Procedure

All runs on the owner's PC. A fresh temporary root and separate DATA_DIR/process for every case. No existing DATA_DIR or player file is read. Already committed synthetic save fixture is the only payload source. Report runtime/OS/CPU, payload bytes, counts, parameters, operation latency, event-loop delay and sampled process RSS. Memory sampling can miss peaks and is not an exact algorithm allocation measurement.

Hash: 24 operations at concurrency 1 and 4 in separate processes, UV_THREADPOOL_SIZE=4 fixed for reproducibility. Configurations are published security minima under comparison, not a final account policy. Synthetic bursts do not estimate real login demand or establish abuse limits.

Storage: 100 distinct fixture-derived snapshots for five overwrite rounds. Compare existing asynchronous temp-write/rename, the same with writeFile flush=true, SQLite transactions on the main thread, and SQLite in a dedicated worker. Each SQLite row write commits independently; batching 100 writes into one transaction would answer a different question. Include read-back validation. SQLite backup must reopen successfully, pass integrity_check and match every row. Deliberate transaction rollback must retain the previous row. A successful drill does not prove power-loss behavior or replace file/host backups.

These counts are bounded experimental workloads, explicitly chosen to exercise a 100-player save burst; they are not invented gameplay numbers or production budgets. Report timing distribution and run conditions without promising host capacity. Do not run hash and disk candidates concurrently, which would confound comparison. No accounts, save migration, production database, retention schedule or extra login restrictions are introduced by the harness.

## Decision after evidence

Use results to decide whether synchronous storage could interfere with the 50 ms server tick and whether a worker/interface is warranted. Keep storage and credential decisions separate. Save compatibility, restore, rate limits, recovery and independent review remain prerequisites for accounts. Record uncertainty and rollback before implementing a chosen design.
