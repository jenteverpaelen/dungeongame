# Character store boundary and backup/restore — evidence before code

2026-10-09. Implements a bounded part of F-SAV-03/04 using existing JSON; account ownership, cross-character transactions and a database migration remain separate decisions.

## Evidence

Current persistence owns filesystem access directly, with per-character queues and explicit recoverable failures. A copy from another process cannot participate in those queues. The local benchmark shows asynchronous storage and worker isolation matter; it does not require replacing current JSON. Node24-FS's exclusive `wx` creation and copy-file paragraphs were read: copyFile has no atomic-copy guarantee. Completed backup status therefore needs its own manifest and verification, not merely a directory's existence. TL2-BACKUP supports checking item/stash scope, not an MMO transaction design. The roadmap requests backups and restore drills, with nightly backups before R1.

## Design

1. Put raw character read, atomic write, quarantine and snapshot enumeration behind a small CharacterStore interface, with the existing JSON implementation. Keep IDs, byte format and per-character ordering unchanged. Move reads into the same queues so a snapshot can wait for all previously submitted filesystem operations without a read/quarantine race. Record quarantine failure honestly.
2. Capture a single-process snapshot behind a write barrier. Wait for previously submitted work; later reads/writes queue after the barrier. Refuse snapshots while an unsaved failure is known. Read only regular, valid-ID `.json` files and retain exact bytes, including future-format files. Release the barrier after bytes are captured, before writing the backup. This assumes one server process owns DATA_DIR; multiple independent writers are not supported or certified.
3. Create a new uniquely named backup directory under configured BACKUP_DIR. Write character bytes with exclusive creation and flush; write a versioned SHA256/length manifest last. Verification re-reads the bundle. Incomplete or tampered bundles cannot restore. Hashes detect corruption, not authenticity against a malicious local operator.
4. Restore only into a newly created destination. Validate every entry/hash before creating it; reject duplicate/traversal IDs, unknown manifest versions, missing/extra files and symlinks. Use an incomplete-restore marker until all writes finish. Server startup refuses a marked directory. Never overwrite/delete the current DATA_DIR or automatically activate a restore. Retain failed output for diagnosis.
5. When BACKUP_DIR is explicitly configured, make a startup snapshot and run once per 24 hours while this server is running, following the roadmap's nightly requirement. Save connected sessions before capture; serialize backup requests; graceful shutdown waits for an active backup. No HTTP/WebSocket admin route. Default setup remains unchanged until configured. Keep all bundles initially: automatic retention deletion and off-device storage require their own policy/design. This is not a completed backup-rotation/release gate.

## Tests and boundaries

Use fresh isolated DATA_DIRs and synthetic fixture bytes exclusively. Verify equipment, inventory, stash, progression and unknown fields byte-for-byte after restore; queue ordering across a barrier; failures release the barrier; stale failed progress blocks backup; tamper/missing/duplicate/traversal/unknown-version refusal; existing destination remains untouched; incomplete restore cannot start; real child server can create a configured backup and restore it. Full regression after persistence extraction.

No new gameplay numbers or UI changes. The 24-hour interval is an operator backup cadence from the roadmap, not a balance target. A local same-disk backup cannot protect against loss of that disk; no disaster-recovery claim. Encryption, off-device copies, restore activation, retention, process exclusivity, database transactions and independent review remain open. No real saves are inspected as test fixtures.

Removal/rollback: direct filesystem calls move behind the store, and the old false quarantine-success log is corrected. No game content is deleted. Revert the integrated store/barrier/backup runtime wiring together if needed; current JSON saves require no migration. Completed backup bundles remain readable by the retained restore tool.
