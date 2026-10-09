# Foundations — independent subset in progress

2026-10-09. No UI style/town/combat changes. No real-save access. No new dependencies.

- [x] F-TEL-01: one-command verification with isolated data and honest failure reporting. Default strict; known-failure allowance is explicit and tested. Full run retains two Windows shutdown failures.
- [x] F-ADM-01: debug denied unless explicitly enabled; denial tests and deliberate test-harness opt-in. Default denial also verified through real browser/WebSocket.
- [x] F-SAV-01/02: explicit save schema version, future-version refusal before legacy validation, synthetic legacy/current fixtures and round-trip checks. Six foundation tests and browser reconnect pass.
- [x] F-CON-04: placeholder registry with evidence and removal conditions; no content deleted.
- [x] Inspect all three real local Chrome 1920×1080 captures; fixed 620 camera and current style retained.
- [ ] Remaining P3: account identity, recovery, storage design, backups, settings/accessibility, content validation, local telemetry and independent review.

This phase is not complete. Continue research in P01 while checking the independent changes; saved checkpoints do not end the task. Before every push check the exact branch. Test data stays in fresh temporary directories. Never migrate or claim ownership of existing player saves as a side effect of tests.
