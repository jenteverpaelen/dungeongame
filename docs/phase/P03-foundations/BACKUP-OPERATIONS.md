# Local character backups and restore

Implemented 2026-10-09. These commands run on the server's Windows PC with installed Node dependencies. They archive raw character files; they do not establish accounts or repair invalid game data.

## Configure

Set `DATA_DIR` to the intended character directory and `BACKUP_DIR` to a separate local backup directory before starting the server. Use absolute paths. Only one server process may own a DATA_DIR. With BACKUP_DIR unset, backup scheduling is disabled and the existing startup behavior is retained.

When configured, the server captures a backup at startup, then every 24 hours while running. This is an elapsed interval, not a fixed midnight task; restarting starts a new interval. Connected sessions submit their state first. A capture waits for prior persistence operations, holds later operations until raw bytes are read, then releases the barrier before writing the bundle. Overlapping requests share the active operation. Graceful shutdown stops scheduling and waits for the active operation within the existing eight-second shutdown deadline.

Look for `[backup] verified ...` to confirm completion. A failure is logged explicitly and the next scheduled attempt may retry. A directory's existence alone is not success. Keep the logs and monitor available disk space. By default no backup is automatically deleted. Each bundle is a complete copy, so space and capture memory increase with stored characters.

C048 adds a [synthetic archive-size baseline](BACKUP-SCALE-REPORT.md) at3/100/1000 characters on this PC. It does not measure live game load, disk failure or off-device recovery; production-scale performance remains unverified.

## Verify and restore

Run these commands from the repository, substituting your actual **backup bundle** and a **new destination**. The destination's parent must already exist.

```powershell
npm run saves:backup -- verify 'C:\HearthfallBackups\backup-<timestamp>-<id>'
npm run saves:backup -- restore 'C:\HearthfallBackups\backup-<timestamp>-<id>' 'C:\HearthfallRestore\characters-new'
```

Verification checks the manifest format/version, unique safe IDs, exact file list, regular files, byte lengths and SHA256 hashes. Unexpected files, symlinks/junctions and incomplete bundles are refused. Restore validates the entire bundle before creating output, uses exclusive writes, verifies the copied bytes and refuses every existing destination, even an empty one. It never changes DATA_DIR or activates the restored copy.

To activate a completed restore, first stop the existing server gracefully, preserve its current data directory, then explicitly configure DATA_DIR to the verified new directory and start it. Test login and owned items before reopening access. This is an operator action; the restore command performs none of those steps automatically. Do not run a second server against the same directory.

A failed restore retains `.hearthfall-restore-incomplete`; server startup rejects that directory. Diagnose the failure and use another new destination for a fresh restore. Do not remove the marker to pretend the restore completed. Failed backup output likewise remains incomplete and cannot pass verification.

## Optional count retention (C054)

`BACKUP_KEEP` defaults to0, which disables all automatic deletion. A positive integer explicitly enables rotation after successful startup/daily captures and requires BACKUP_DIR. Invalid values fail startup. No value has been configured on the owner's running game. Choose a count only after considering recovery history, disk space and off-device copies; no production count is recommended by the fixture tests.

First preview with the actual newest verified bundle and chosen count (`<N>` is a placeholder):

```powershell
npm run saves:backup -- plan 'C:\HearthfallBackups' 'C:\HearthfallBackups\backup-<timestamp>-<id>' '<N>'
```

This command reads and reports `keep`, `remove` and `excluded`; it never deletes. Recheck the plan before configuring BACKUP_KEEP. Automatic execution recomputes its plan after each successful capture; a preview is not a reservation of those exact names.

New manifests carry a hash grouping the host and canonical DATA_DIR path. Legacy/unscoped, unrelated-source, unrecognized, incomplete, corrupt, future-dated and missing-character-history bundles are preserved outside the count. A changed hostname/path begins another group. The fresh capture must be nonempty; it is always kept. The newest other eligible copies fill the remaining count, with name order breaking equal timestamps. Files are reverified before removal. Old or excluded bundles may still fill the disk: this is not a hard disk quota. Review excluded histories separately, including future account-deletion/retention requirements.

`[backup] rotation kept ...` reports success. A separate rotation-failure log leaves the new verified capture available. A failed removal can leave an incomplete old candidate; future scans preserve it for diagnosis. Disabling BACKUP_KEEP prevents later deletion but cannot recover removed historical copies. The single-writer/trusted-local-filesystem limit still applies; do not run competing rotation jobs or change the backup tree while it runs. No standalone delete CLI is provided.

## Evidence and limits

The local automated drill uses generated characters only: configured real server backup, CLI verify, CLI restore, byte equality, second real server and WebSocket login with identical equipment/inventory/stash/progression. Unit tests cover concurrent save ordering, failed writes, barrier release, bundle tampering, existing destinations, directory/junction substitution and partial restore. See `REPORT.md` for exact results and evidence roots.

Raw bytes include unknown/future-schema files; a valid archive is not proof that this server can load every file or that its game data is logically correct. Existing quarantined files and temporary writes are not character snapshots and are excluded. Hashes detect accidental corruption, not an attacker who can rewrite the whole bundle. No hostile-local-operator race hardening, multiprocess exclusion, off-device copy, encryption, calendar retention policy, power-loss guarantee or independent review is claimed. The existing JSON runtime write durability is unchanged. Backups on the same disk do not protect against losing that disk.

Never use real character directories for automated tests. `npm run verify` supplies isolated DATA_DIRs, clears inherited BACKUP_DIR and sets BACKUP_KEEP=0 for every stage; the backup/rotation drills explicitly opt in with their own synthetic directories/counts.
