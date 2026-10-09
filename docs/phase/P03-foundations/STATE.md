# Foundations — independent subset in progress

2026-10-09. Existing UI style retained; audio/shake settings added in the same panel system. No town/combat changes, real-save access or new dependencies.

- [x] F-TEL-01: one-command verification with isolated data and honest failure reporting. Latest strict full run passes; earlier Windows SIGTERM failures remain recorded in history.
- [x] F-ADM-01: debug denied unless explicitly enabled; denial tests and deliberate test-harness opt-in. Default denial also verified through real browser/WebSocket.
- [x] F-SAV-01/02: explicit save schema version, future-version refusal before legacy validation, synthetic legacy/current fixtures and round-trip checks. Six foundation tests and browser reconnect pass.
- [x] F-CON-04: placeholder registry with evidence and removal conditions; no content deleted.
- [x] Inspect all three real local Chrome 1920×1080 captures; fixed 620 camera and current style retained.
- [x] Persistent master/effects/ambience volume, mute and camera-shake option. Original sound/shake defaults and fixed camera retained; O/F1 entry and keyboard interactions verified in local Chrome.
- [x] Recoverable save failures reject callers, retain captured progress for bounded retry, prevent stale reconnects, notify connected players and report shutdown failure honestly. Five fault-injection tests and full regression run pass apart from the two recorded Windows shutdown-test failures.
- [x] Correct Windows test transport through private parent IPC; live progress/item assertions and real child-process failure drill. Latest server suite: 738/738; simulation 382/382.
- [x] Local candidate hash/storage benchmark, including synthetic SQLite backup/restore; no production database or account change selected yet.
- [x] Individual installed production licence inventory (23 packages); distribution notices and full project audit remain open.
- [x] F-CON-01 semantic registry checks plus existing town validation in `content:check`; four mutation tests and typecheck pass. Typed TS remains the structural schema. Localization, behavior-flag coverage and originality review remain open.
- [x] F-SAV-04: CharacterStore boundary retaining JSON/IDs and per-character ordering. No production database migration.
- [x] F-SAV-03/OPS-04 subset: opt-in startup/daily verified backup, new-destination-only restore, failure tests and real-process CLI/reconnect drill. Strict full verify passes; rotation, off-device policy and large-data/power-loss tests remain open.
- [x] F-SAV-05 subset: connection-local command receipts stop repeated costs/actions; cached replies, changed-payload/old-ID refusal and bounded memory. Six targeted tests and real WebSocket checks for all classes pass; strict full run 748 server / 382 simulation. Durable/cross-reconnect transaction semantics remain open.
- [ ] Remaining P3: account identity/recovery/migration, durable command transactions, backup rotation/operations, broader settings/accessibility, localization/originality, local telemetry and independent review.
- [x] F-SET-03 subset: optional Reduce flashes setting; legacy/default persistence tests, controlled effect checks, seven inspected local Chrome1080p frames and strict full verification pass. REDUCED-FLASH-REPORT.md records the affected effects and unverified thresholds; this is not an accessibility safety certification.
- [x] P3/P16 connection subset: exact origin allowlist before upgrade and socket-peer log attribution. Before/after network reproduction, eight targeted checks, strict18-stage verification and two inspected Chrome direct/Vite frames pass. CONNECTION-REPORT.md records deployment compatibility and unfinished authentication.
- [x] Written account boundary/recovery/migration design note backed by five further primary source reads and actual login/upgrade audit. Existing player population is a pending owner question; no account implementation or live migration is implied.
- [x] Prevent stale enchant offers applying across same-ID reforges; preserve paid client choice through panel/artisan changes. Actual-handler regression, full verify and four inspected Chrome frames pass; ENCHANT-TRANSITION-REPORT.md records limits. Pending offers remain connection-local.
- [x] F-SET-02 / U-12 keyboard subset: eleven actions with primary/alternate keys, conflict rejection, persistent assignments and matching prompts. Six tests, strict verify and eight inspected Chrome1080p frames pass; KEYBOARD-REPORT.md records layout and scope limits. No controller/chord/account-sync claim.
- [x] F-TEL-02 subset: separate27-case field calibration with per-minute XP/gold/kills, death/TTK samples and reconciled retained inventory. Repeated gameplay payload matches; see P01 FIELD-CALIBRATION-REPORT.md. Human pacing, service-loop calibration and full class parity remain open.

This phase is not complete. Continue research in P01 while checking the independent changes; saved checkpoints do not end the task. Before every push check the exact branch. Test data stays in fresh temporary directories. Never migrate or claim ownership of existing player saves as a side effect of tests.
