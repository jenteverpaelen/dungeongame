# Synthetic claim transaction drill — C038

2026-10-09. Plan and L49 precede implementation. [Harness](../../../scripts/drill-transactions.ts) is standalone experimental code. Production still uses JSON CharacterStore and name login; no account implementation or real-save migration.

## Measured on this PC

Node24.19.0, Windows, SQLite3.53.3. Every final-run connection asserts WAL, FULL synchronous=2, foreign_keys=1 and busy_timeout=0. Each run creates its own marked temporary root, clears child BACKUP_DIR and terminates only its own children. No game server/browser involved.

Actual-generator fixtures: level70, full60-slot inventory, full60-slot stash, five starter equipment items and an unknown synthetic extension. Serialized sizes:73,167 /73,218 /73,308bytes (warrior/ranger/mage),125items each. These test serialization, not representative endgame builds. Original character bodies and item data remain byte-identical.

Both complete runs pass **nine forced-termination cases plus one competing-writer case**:

| Boundary | Reopened state | Subsequent retry |
|---|---|---|
| After ownership write, before claim/receipt | No owner, unused claim, no receipt | One completed claim |
| After all writes, before commit | No owner, unused claim, no receipt | One completed claim |
| After commit, before response | Owner, consumed claim and receipt together | Returns recorded result |

Each case verifies owner, claim request/token hash, receipt account/request/fingerprint/result and original body. Identical retry returns the same result; changed intent and another account are rejected. WAL exists after every forced stop and is recovered by SQLite, never deleted by the harness. Integrity and foreign-key checks pass.

Competing writer: busy while the first transaction is held, then unavailable-claim after commit; one owner/receipt remains. Controlled ordering only, not load/fairness/rate-limit evidence.

Each final online backup has44pages; reopened snapshots equal all four tables. Pre-claim backups equal their original state. **An older restore reinstates an unused claim.** Production recovery must account for credentials/session/claim revocation and ownership changes since backup; integrity alone cannot decide this policy.

## Evidence and limitations

- [First complete run](checks/transaction-drill-first.json): `C:\Users\LAPTOP~1\AppData\Local\Temp\hf-transaction-drill-4efzjg`.
- [Final run with PRAGMA assertions](checks/transaction-drill-final.json): `C:\Users\LAPTOP~1\AppData\Local\Temp\hf-transaction-drill-VXWJV0`.
- [Pilot failure](checks/transaction-drill-pilot.json): `hf-transaction-drill-yAyuxP`; snapshot query sorted a one-column table by a second column. Failed before crash tests; fixed table-specific ordering. Checkpoint waits and receipt assertions were also strengthened before successful runs.

Standalone strict TypeScript check passes. No production modules changed; C036's18-stage verification remains the last game regression run. No UI/browser/throughput claim. Forced child termination does not simulate power loss, reboot, disk failure/fullness, fsync dishonesty or a production worker queue. Token issuance/expiry, credentials, recovery, migration and revocation are unimplemented. No database files/live data checked into Git.

**Inference:** this atomic boundary is feasible with the installed API; it does not select a production database or establish release acceptance. Earlier main-thread blocking still requires asynchronous isolation. Rollback removes only the experiment/docs; player data/UI are unaffected.
