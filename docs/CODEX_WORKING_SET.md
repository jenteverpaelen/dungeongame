# Current working set

Updated 2026-10-10. Owner requested smaller context/usage. This is a navigation note, not a replacement for hard rules or the roadmap.

- Branch: `codex/new-tristram-town` only. Current checkpoint: C093; preceding pushed checkpoint C092 is `9e7a0d3`. Use `git log -1` for the exact latest commit.
- Active chapter: P8 economy, C093 resource accounting. Continue the whole roadmap; this checkpoint does not complete P8.
- Owner economic target: basic vendor gear fills a weak slot after a few packs. Story requires no repeat grind.
- Solo. Town and fixed camera stay. Preserve UI style; no scrolling content menus. Owner handles full playtesting.

## Read these only when needed

- Design/evidence already logged: `docs/phase/P08-economy/CURRENCY-MAP.md`, REFERENCES L113, DECISIONS D051.
- Accounting implementation: `shared/src/economy.ts`, optional `CharacterSave.economy`, save version10/protocol13.
- Mutation hooks: end of `server/src/commands.ts`; acquisition branches of `server/src/sim/loot.ts`; grant in `server/src/afk.ts`.
- Planned UI: small read-only Economy section of existing character panel, preserving paging/style.
- Planned checks: focused economy conservation/acquisition/save compatibility tests, typecheck/build, one brief real-browser visual check at1920x1080. Every runtime test uses a fresh isolated DATA_DIR and disabled backups.

## Current status

- C092 stock/provenance implementation is committed and pushed; its checks already passed. Do not rerun its work without a new reason.
- C093 history/UI/save compatibility are implemented and checked (19 distinct focused checks, typecheck/build, brief1080p preview); recorded in the C093 checkpoint.
- C093 report and full-roadmap ledger updated. Next work is the durable-command boundary; read only its relevant handlers/storage paths.
- After C093: production durable-command safeguards and measured source/sink distributions remain; existing JSON writes are not commit-before-ack.
- No durable transaction migration has been selected or implemented. Do not infer a production guarantee from the old SQLite experiment.

## Parked context

Leave completed town/P1–P7 research and implementation alone unless an actual dependency requires inspection. Use `docs/CODEX_ROADMAP_STATUS.md` to select subsequent chapters, and `docs/CODEX_CHANGELOG.md` for checkpoint history. Do not reread the entire archive on continuation.

Search filenames/symbols before reading. Prefer a narrow range and small output; expand on failures. Do not print generated manifests, full test logs, or entire long reference pages when a summary and relevant excerpt suffice. No source content is removed by this policy.

Owned local test server: session36066 (:2567), fresh disposable data/protocol13. Vite47406 (:5173). No owned browser tabs remain; viewport reset. Never stop unrelated processes.
