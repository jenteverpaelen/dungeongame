# Local character backups and restore

Implemented 2026-10-09. These commands run on the server's Windows PC with installed Node dependencies. They archive raw character files; they do not establish accounts or repair invalid game data.

## Configure

Set `DATA_DIR` to the intended character directory and `BACKUP_DIR` to a separate local backup directory before starting the server. Use absolute paths. Only one server process may own a DATA_DIR. With BACKUP_DIR unset, backup scheduling is disabled and the existing startup behavior is retained.

When configured, the server captures a backup at startup, then every 24 hours while running. This is an elapsed interval, not a fixed midnight task; restarting starts a new interval. Connected sessions submit their state first. A capture waits for prior persistence operations, holds later operations until raw bytes are read, then releases the barrier before writing the bundle. Overlapping requests share the active operation. Graceful shutdown stops scheduling and waits for the active operation within the existing eight-second shutdown deadline.

Look for `[backup] verified ...` to confirm completion. A failure is logged explicitly and the next scheduled attempt may retry. A directory's existence alone is not success. Keep the logs and monitor available disk space; no backup is automatically deleted. Each bundle is a complete copy, so space and capture memory increase with stored characters. Large-data performance remains unmeasured.

## Verify and restore

Run these commands from the repository, substituting your actual **backup bundle** and a **new destination**. The destination's parent must already exist.

```powershell
npm run saves:backup -- verify 'C:\HearthfallBackups\backup-<timestamp>-<id>'
npm run saves:backup -- restore 'C:\HearthfallBackups\backup-<timestamp>-<id>' 'C:\HearthfallRestore\characters-new'
```

Verification checks the manifest format/version, unique safe IDs, exact file list, regular files, byte lengths and SHA256 hashes. Unexpected files, symlinks/junctions and incomplete bundles are refused. Restore validates the entire bundle before creating output, uses exclusive writes, verifies the copied bytes and refuses every existing destination, even an empty one. It never changes DATA_DIR or activates the restored copy.

To activate a completed restore, first stop the existing server gracefully, preserve its current data directory, then explicitly configure DATA_DIR to the verified new directory and start it. Test login and owned items before reopening access. This is an operator action; the restore command performs none of those steps automatically. Do not run a second server against the same directory.

A failed restore retains `.hearthfall-restore-incomplete`; server startup rejects that directory. Diagnose the failure and use another new destination for a fresh restore. Do not remove the marker to pretend the restore completed. Failed backup output likewise remains incomplete and cannot pass verification.

## Evidence and limits

The local automated drill uses generated characters only: configured real server backup, CLI verify, CLI restore, byte equality, second real server and WebSocket login with identical equipment/inventory/stash/progression. Unit tests cover concurrent save ordering, failed writes, barrier release, bundle tampering, existing destinations, directory/junction substitution and partial restore. See `REPORT.md` for exact results and evidence roots.

Raw bytes include unknown/future-schema files; a valid archive is not proof that this server can load every file. Existing quarantined files and temporary writes are not character snapshots and are excluded. Hashes detect accidental corruption, not an attacker who can rewrite the whole bundle. No hostile-local-operator race hardening, multiprocess exclusion, off-device copy, encryption, retention rotation, power-loss guarantee or independent review is claimed. The existing JSON runtime write durability is unchanged. Backups on the same disk do not protect against losing that disk.

Never use real character directories for automated tests. `npm run verify` supplies isolated DATA_DIRs and clears inherited BACKUP_DIR for every stage; the restore drill explicitly opts in with its own synthetic directory.
