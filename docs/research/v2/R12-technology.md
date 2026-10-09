# R-12 — Browser-MMO technology and operations

Read 2026-10-09. Version-specific primary guidance plus local inspection.

## Verified constraints

Hearthfall uses PixiJS 8, Preact, Node and an authoritative 20 Hz server. The installed runtime is Node v24.19.0. Old claims about Phaser/Colyseus/60 Hz/500 players are not measurements of this code.

[NODE24-SQL](https://nodejs.org/download/release/v24.19.0/docs/api/sqlite.html) marks built-in SQLite Stability 1.2, release candidate since 24.15.0. DatabaseSync operations are synchronous. The 24.10 documentation's 1.1 status is superseded for this machine. A database choice still needs contention, backup and restore measurements.

[NODE24-CRYPT](https://nodejs.org/download/release/v24.19.0/docs/api/crypto.html) provides asynchronous scrypt and random-salt guidance. Its default cost differs from [OWASP-PASS](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)'s recommended configurations. Built-in availability alone does not make defaults appropriate. Argon2 availability/stability in this runtime also needs evaluation before choosing.

[OWASP-AUTHZ](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) supports explicit default denial; [OWASP-WS](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html) adds Origin, per-message authorization, session and rate-limit checks.

## Implemented bounded application

P03 adds explicit debug opt-in, save version refusal, synthetic migration fixtures and honest isolated verification. These do not implement accounts, recovery, backups or a production security boundary.

## Remaining work

Measure hash latency/memory under login load; map session ownership, claim/recovery and logout invalidation; investigate existing saves without reading real player files; evaluate transactional storage and restore. Profile actual snapshot bytes, AOI and 100-player rendering. Free-host limits and DDoS protection require current provider terms; no provider or 500-player promise selected.
