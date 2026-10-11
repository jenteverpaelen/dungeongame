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
- **F-ACC-01/02/05/06 — accounts part 2.** Sessions persisted as SHA-256 only in `accounts/.sessions.json` (dotfile:
  skipped by the loader and the aux backup), survive restarts, `ACCOUNT_SESSIONS=memory` opt-out; coarse device labels;
  Devices list with sign-out one/others. Lockout re-keyed: 5/15 min per username+connection, 50/15 min per account
  (NIST SP 800-63B §5.2.2 ceiling 100), 25 per connection, separate re-ask counter — a stranger can no longer lock a
  player out. `TRUSTED_PROXIES` (right-most untrusted XFF hop), per-address socket cap 20 (loopback exempt). Activity log
  (20 events, no IPs) as the email-free security notice. GDPR: export (password re-asked; account, saves, guild data,
  telemetry; no secret values), account and hero deletion with a 14-day grace (`DELETION_GRACE_DAYS` 0–30), hourly
  purge, erasure ledger of digests re-applied at start-up to restored files older than the erasure, `apply-erasures`
  restore tool, owner CLI (`activity`, `revoke-sessions`, `export`, `export-character`, `delete [--now]`,
  `delete-character`, `cancel-delete`, `pending`, `purge`). Client: Heroes delete/restore, Security codes-left, Devices,
  Your data, pending-deletion banner. Protocol 22 → 23. Tests: `accountPrivacy.test.ts` 11/11 (incl. real-server
  restart/deletion/export), `accounts.test.ts` 11/11 unchanged. Docs: ACCOUNTS.md, PRIVACY-RUNBOOK.md.
- **F-SAV-03 / F-OPS-04 — drills.** After every scheduled backup: restore drill (scratch restore, server `normalizeSave`,
  custody signatures, aux parse, timing) → `DATA_DIR/ops/backup-drills.jsonl` + `/healthz`; optional verified
  `BACKUP_MIRROR_DIR` copy rotated with the same keep; aux snapshot now also holds `privacy/ledger.json`. CLI: `drill`,
  `drills`, `mirror`, `apply-erasures`. Measured [M]: 100 chars backup 0.29 s / drill 0.62 s; 1,000 chars 3.6 s / 6.5 s.
  `backupDrill.test.ts` 5/5 (incl. checksum-valid logical corruption caught). Docs: BACKUP-RUNBOOK.md.
- **F-TEL-04 — event schema.** `EVENT_SCHEMA` allowlist (unknown kinds refused, unknown fields dropped, typed, 40-char
  strings, `s` version), retention `TELEMETRY_RETENTION_DAYS` (default 30) at start-up + daily, per-character export and
  scrub. `telemetrySchema.test.ts` 4/4; existing telemetry test updated for `s`. Doc: TELEMETRY-SCHEMA.md.
- **F-OPS-05 (part) — HTTP headers.** nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, COOP on every
  response; CSP on documents. `securityHardening.test.ts` 3/3.
- **Merge** `claude/town-ui-rework` @8d1e29b (lead's tooltip + rarity palette, depth bible) — clean.
- **F-CON-03 / F-PLT-08 — names and licences.** `NAME-REGISTER.md` (lead's expanded scope): applied in my lane — elite
  traits (D3's exact list) → Swift/Hulking/Kilnborn/Rimebound/Festering/Crackling/Undertow/Bombarding, Treasure Goblin →
  Hoardling (+ notices, target-priority text), server material messages used D3's material names → shared original names;
  owner picks B1–B6 (difficulty ladder, Paragon, Cube, rift family, third artisan, health globe; 3 options each); old→new
  table + file list for the lead (shrines, Hellforge/Hunter's Mark/Witching Cord, two sets, gem ranks, sheet trio, 17
  affix phrasings, binding text); kept-generic decisions; design copies (Paragon 2.0 structure). Every proposal screened
  against the hashes [M]. Gate: `scripts/originality-check.ts` (61 hashed terms + Codex's D3 label hashes, n-grams of all
  literals/JSX text) in content:check with `docs/originality/allowlist.json` ratchet (133 reasoned entries; new uses
  fail). Licences: `scripts/license-audit.ts` → `docs/licenses/FULL-TREE.md` (44 packages; MPL only for build-only
  lightningcss; finding: tsx/esbuild run with `npm start` but are missing from the notices) + `AUDIT-2026-10-11.md`;
  new verify stage `license-audit`. No assets outside docs [M].
- **F-CON-01 — registries.** `scripts/content-ids.ts` + `content-ids.lock.json` (362 save-referenced ids in 17
  registries; removal/rename fails unless retired with a reason), runtime schema rules (id spelling, trimmed names ≤48,
  unique display names per registry, rune names per skill), localization ratchet `scripts/i18n-check.ts` +
  `i18n-localized.json` (listed files may not contain inline JSX text or literal aria-label/title/placeholder/alt). All
  three run in `npm run content:check`.
