# Partials log (terse: what changed, why, evidence)

- **P0 — plan.** `PLAN.md`: per row what Codex left, the roadmap acceptance and the improvement. Baseline on this
  worktree: typecheck clean, shared tests 54/54 [M]. `npm audit --json`: 0 vulnerabilities in 99 dependencies [M].
- **F-SAV-01 — save history.** `shared/src/saveMigrations.ts`: one entry per version 0…14 (what it adds, its fields,
  its golden fixture, optional `migrate`, a validity check); `normalizeSave` runs `migrateSteps` first (no transform
  exists yet — every step so far is additive). New golden fixtures `v13-social`, `v14-collection`.
  `server/test/saveMigrations.test.ts`: history gap-free and equal to `SAVE_VERSION`; exactly one fixture per version;
  every fixture migrates with an identical custody signature (`server/src/saveIntegrity.ts`: item ids/bases/rarities/
  sockets, gems, gold, materials), keeps its version's fields, passes every version's check, is idempotent and reloads
  identically. Bumping `SAVE_VERSION` without an entry + fixture now fails the `foundations` verify stage.
