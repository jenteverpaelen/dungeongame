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
- [ ] Remaining P3: account identity, recovery, storage design, backups, broader settings/accessibility (including rebinding), content validation, local telemetry and independent review.

This phase is not complete. Continue research in P01 while checking the independent changes; saved checkpoints do not end the task. Before every push check the exact branch. Test data stays in fresh temporary directories. Never migrate or claim ownership of existing player saves as a side effect of tests.
