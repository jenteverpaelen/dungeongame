# P01 research workspace

[Current state](STATE.md) is the continuation entry point. [Research v2](../../research/v2/README.md) contains the evidence. [Codex change log](../../CODEX_CHANGELOG.md) explains what changed and why. [Claude's original roadmap](../../design/FULL_GAME_ROADMAP.md) remains unchanged; read its [errata](../../design/ROADMAP_ERRATA.md) alongside it.

This checkpoint includes the owner's requested camera rollback and the first bounded research pass. It does not implement the roadmap's proposed systems or declare research complete.

## Checks and reproduction

Use a new temporary DATA_DIR for each invocation; never use `server/data`, `.local` or `.env`.

```powershell
$env:DATA_DIR = Join-Path ([System.IO.Path]::GetTempPath()) ('hf-research-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $env:DATA_DIR | Out-Null
node --import tsx docs/design/baseline-audit.ts
```

The audited script imports the existing shared rules, uses fixed RNG seeds and runs 200,000 kills per loot row. [Output](checks/baseline-audit-2026-10-09.txt). It does not load real player files. Timing estimates printed by the script remain assumptions, and event-gap metrics have the caveats in the errata.

[Camera validation report](../../town/checks/camera-restored-2026-10-09.md) records the local browser, commands, results and limits. [Raw server regression log](checks/camera-revert-server.txt) retains the two known Windows failures. No external benchmark machine or cloud game run was used.

## Downloads and licences

No new external asset/tool/game installation or reference-media download was needed for this pass. Public source pages/PDF text were read through browsing; sources are registered in `SOURCES.csv`. The three Claude files were already present locally and matched their GitHub versions. `git fetch origin` updated repository refs as authorized. The standing permission is recorded in the change log; an asset licence must still be checked individually before any asset ships.
