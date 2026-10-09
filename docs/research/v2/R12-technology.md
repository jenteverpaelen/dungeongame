# R-12 — Browser-MMO technology and operations

Read 2026-10-09. Version-specific primary guidance plus local inspection.

## Verified constraints

Hearthfall uses PixiJS 8, Preact, Node and an authoritative 20 Hz server. The installed runtime is Node v24.19.0. Old claims about Phaser/Colyseus/60 Hz/500 players are not measurements of this code.

[NODE24-SQL](https://nodejs.org/download/release/v24.19.0/docs/api/sqlite.html) marks built-in SQLite Stability 1.2, release candidate since 24.15.0. DatabaseSync operations are synchronous. The 24.10 documentation's 1.1 status is superseded for this machine. A database choice still needs contention, backup and restore measurements.

[NODE24-CRYPT](https://nodejs.org/download/release/v24.19.0/docs/api/crypto.html) provides asynchronous scrypt and Argon2 (added 24.7.0), with random-salt guidance. Scrypt's default cost differs from [OWASP-PASS](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)'s configurations. Built-in availability alone does not make defaults appropriate. The matching Argon2 API section has been read completely; runtime invocation succeeds on this PC.

[OWASP-AUTHZ](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) supports explicit default denial; [OWASP-WS](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html) adds Origin, per-message authorization, session and rate-limit checks.

## Implemented bounded application

P03 adds explicit debug opt-in, save version refusal, synthetic migration fixtures and honest isolated verification. A later bounded slice adds a JSON store interface, verified local bundles and a real-process CLI restore/reconnect drill; see `../../phase/P03-foundations/BACKUP-DESIGN.md`. These do not implement accounts, recovery credentials, retention/off-device policy or a production security boundary.

## Remaining work

[Local candidate measurements](../../phase/P03-foundations/MEASUREMENTS.md) now cover published Argon2id/scrypt configurations, JSON flush cost, SQLite main-thread versus worker execution, rollback and a synthetic online-backup restore. Actual SQLite is 3.53.3; the documented WAL-reset fix is included by version. A synthetic 100-write burst delayed the main loop by 51.085 ms with synchronous SQLite versus 15.696 ms with the worker. This supports asynchronous isolation if a database is adopted; it does not complete production storage, capacity or security acceptance.

Measure hash latency/memory under login load; map session ownership, claim/recovery and logout invalidation; investigate existing saves without reading real player files; evaluate transactional storage and restore. Profile actual snapshot bytes, AOI and 100-player rendering. Free-host limits and DDoS protection require current provider terms; no provider or 500-player promise selected.

## Replay scope — 2026-10-09

[AWS-IDEMPOTENCY](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) separates intentional repeated actions from retries through request identifiers, discusses matching responses and changed parameters, and requires atomic mutation/receipt recording for durable guarantees. [RFC6455 §5.4](https://www.rfc-editor.org/rfc/rfc6455#section-5.4) describes ordered WebSocket fragmentation, not application replay protection. Hearthfall's measured repeated paid fusion motivated a connection-local receipt guard. Its memory-only boundary explicitly leaves reconnect/crash-safe transactions unfinished; see the scoped design and tests in P03.

## Identity design note — 2026-10-09

Five additional primary source reads (AUTH-01–05) and the actual login/upgrade/storage audit inform [ACCOUNT-DESIGN.md](../../phase/P03-foundations/ACCOUNT-DESIGN.md). It separates credentials, sessions, character ownership, recovery and migration. Legacy names are not ownership evidence; the owner has a pending question about existing players. No production accounts, save assignment or security acceptance is claimed. Authentication libraries, deployment, no-email recovery limitations, transaction storage and attack/restore drills remain open.
