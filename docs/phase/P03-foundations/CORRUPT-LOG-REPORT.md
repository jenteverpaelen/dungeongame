# Corrupt-save log result — C036

2026-10-09. [Design](CORRUPT-LOG-DESIGN.md), L47 and C035's synthetic disclosure preceded implementation. The loader now logs fixed parse/validation categories and safe quarantine identifiers. A failed quarantine reports a recognized I/O code or a generic failure, without arbitrary error details. No corrupt file is deleted or rewritten; future saves still fail without quarantine. Other diagnostic paths are unchanged and still need audit.

## Evidence

- Before: two new regressions failed against the old implementation; six existing foundation tests passed. [Output](checks/corrupt-log-before.txt), isolated root `C:\Users\LAPTOP~1\AppData\Local\Temp\hf-corrupt-log-before-73c9abd388054f26ba88cd94dd4c69eb`.
- After: all8 foundation tests pass, including three malformed-source fixtures and two failed-quarantine error forms. Tests verify exact original bytes, truthful move/failure messages and no synthetic content/message/path/code marker. [Output](checks/corrupt-log-after.txt), root `C:\Users\LAPTOP~1\AppData\Local\Temp\hf-corrupt-log-after-4785e2b3443d439bba6d1ef4897f9f88`.
- Full strict `npm run verify`: all18 stages pass, including746 server checks,382 simulation checks,17 shared tests, backup/restore and typecheck/build. [Report](checks/corrupt-log-verify.json), root `C:\Users\LAPTOP~1\AppData\Local\Temp\hearthfall-verify-sQLquR`. No known-failure allowance; each stage isolated DATA_DIR, BACKUP_DIR cleared. Existing bundle-size warning remains.
- No renderer/UI/gameplay change; C034's four inspected Chrome1080p frames remain the latest visual evidence. This is not a new performance or human-acceptance result.

The removed information is accidental source/error-detail duplication in these specific log lines. Original quarantine bytes remain available to the operator under existing filesystem access; the log still includes character ID, which is not anonymous. Whole-app structured logging, file permissions, retention and privacy acceptance remain open. No new dependency, download or save migration. Rollback and consequences are in the design.
