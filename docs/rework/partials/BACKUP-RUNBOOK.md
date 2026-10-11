# Backup runbook — rotation, drills, off-device copy, restore (F-SAV-03 / F-OPS-04)

## Configure (all opt-in; defaults unchanged)

| Variable | Meaning | Recommendation |
|---|---|---|
| `BACKUP_DIR` | verified backup at start-up and every 24 h (characters + `aux-*` accounts/guilds/privacy ledger) | a folder outside `DATA_DIR` |
| `BACKUP_KEEP` | keep the newest N verified backups (0 = never delete) | **14** — two weeks of restore points, and an erased person leaves the last backup within 14 days of the purge (see PRIVACY-RUNBOOK §3) |
| `BACKUP_MIRROR_DIR` | second copy of every verified backup, verified again there and rotated with the same N | another physical disk, a NAS share, or a folder a free sync client already uploads |
| `BACKUP_DRILL` | `0` turns the automatic restore drill off | leave on |

## What happens after every backup

1. Character backup written with exclusive creates, re-read and checksummed (existing).
2. Rotation (existing, source-scoped, never recursive deletion).
3. `aux-*` snapshot of `accounts/`, `social/ledger.json` and `privacy/ledger.json`.
4. **Restore drill** (`server/src/backupDrill.ts`): restore into a fresh temp directory exactly like an operator, parse +
   version-check + migrate every character with the server's own `normalizeSave`, compare custody signatures (item ids,
   gems, gold, materials) before/after, parse every aux file, time it, delete the temp directory. One JSON line per drill
   in `DATA_DIR/ops/backup-drills.jsonl`; the last result is in `GET /healthz` (`backups.lastDrill`). A failed drill keeps
   the backup and logs `RESTORE DRILL FAILED`. It catches what checksums cannot: a file that was already bad when it was
   backed up (logical corruption written by a bug).
5. **Mirror** copy (if set), verified in place, rotated there.

## Measured drill times [M] (this laptop, Windows 11, Node 24, SSD; characters with 100 generated items each)

| Characters | Backup | Restore drill |
|---:|---:|---:|
| 100 | 0.29 s | 0.62 s |
| 1,000 | 3.6 s | 6.5 s |

(`.local/drill-bench.ts`, 2026-10-11; one run each — an order of magnitude, not a benchmark.)

## Manual restore (timed procedure)

```
npm run saves:backup -- verify  <BACKUP_DIR>\backup-…                      # seconds
npm run saves:backup -- drill   <BACKUP_DIR>\backup-… [<BACKUP_DIR>\aux-…] # proves it loads; prints ms
npm run saves:backup -- restore <BACKUP_DIR>\backup-… <NEW-dir>            # never touches DATA_DIR
npm run saves:backup -- aux-restore <BACKUP_DIR>\aux-… <NEW-aux-dir>
npm run saves:backup -- apply-erasures <NEW-dir> <DATA_DIR>\privacy\ledger.json <NEW-aux-dir>\accounts
```
Then, with the server stopped: point `DATA_DIR` at `<NEW-dir>` (or copy its files in), copy `accounts\` and `social\`
from `<NEW-aux-dir>`, **keep the live `privacy\ledger.json`** (it is newer than any backup), start the server. Start-up
re-applies erasures again. Check `/healthz` and log in with one character. From a mirror, use the same commands on the
mirror directory.

Drill history: `npm run saves:backup -- drills <DATA_DIR>\ops\backup-drills.jsonl`.

## Still outside this scope

A real off-site provider (no paid services), power-loss injection on the live disk, and backups of several server
processes (one process owns DATA_DIR).
