# Scoped backup rotation — C054

Implemented 2026-10-09 after [design](BACKUP-ROTATION-DESIGN.md), research L65. Normal startup retains every bundle. An operator may set a positive BACKUP_KEEP with BACKUP_DIR after reviewing the read-only `saves:backup plan`. New backups include optional SHA256 source grouping metadata; unscoped legacy bundles remain restorable and rotation preserves them. Selection protects unverified, unrelated, future-dated and missing-character histories. Scheduled deletion verifies the new nonempty capture and selected bundles, then removes only named regular files individually. No recursive directory delete is used.

## Local evidence

- Twenty-stage strict verification passes with no allowance: typecheck, shared tests, all backup/recovery/security/town checks, multiplayer bot, simulation, content and build. The isolated root is `hearthfall-verify-gksMSB`; report and logs are in `checks/backup-rotation`. Server:756/756; simulation:382/382.
- Seven retention-specific tests pass. They cover disabled/invalid values, preview without writes, newest-count selection, actual restore of kept copies and legacy files, exclusions for ten unsafe/unrelated histories, symlink/outside/empty/invalid anchors, a changed survivor, mid-delete failure, failed capture and separate rotation-error reporting.
- Two actual local server processes in series use fresh synthetic DATA_DIRs and explicit counts0,0,2,0. Bundle counts are1,2,2,3; one older eligible copy is removed and every survivor verifies. The real CLI previews without deleting. A backup made from a different DATA_DIR is excluded and all previous bundles remain. Restored bytes equal the synthetic save.
- Separate configuration probes show positive count without BACKUP_DIR and malformed count refuse startup. All tests set BACKUP_KEEP=0 unless exercising an isolated explicit value. No production save or backup directory was read or modified.

Counts in the tests are representative inputs only, not a recommended player-data or legal-retention policy. Selection compares identifiers, integrity hashes and timestamps; it cannot determine whether a newer character save has logically lost gear. Excluded or non-Hearthfall directories are not counted, so the configured limit does not cap disk use. Local filesystem races, multiple server writers, power failure and off-device recovery remain unverified. The manifest hash is grouping metadata, not secrecy or proof of ownership. Existing short Vite native-loader and large-chunk build warnings remain.

## Scope and removal effect

Only explicitly configured future rotation removes old, eligible copies within the current host/path group. Each removal permanently loses that recovery point; disabling the option stops future deletion but cannot restore removed copies. No existing configuration or live data was changed. No game content, settings UI, town, camera or save schema changed; no downloads or new dependencies were added. Rollback sets BACKUP_KEEP to0 or removes the schedule hook. Rotation and the wider backup operations/recovery policy remain partial, not a certified release gate.
