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
- **F-TEL-05 — owner analytics.** `server/src/telemetryAnalytics.ts` (pure): new-hero funnel (created → L2 → L5 → quest →
  L10 → 2nd session → L20), session-length histogram, return rate (2+ sessions, 2+ days), median play minutes per level,
  active heroes per day, deaths by zone; `analyze-telemetry.ts --html out.html` writes one self-contained page (single
  series bars ≤24 px, value at tip, hover/focus tooltip, table view per chart, light/dark tokens, no network, names
  escaped). Test added (5/5). Shots: `shots/tel05-analytics-1366.jpg`, `-hover.jpg` (synthetic sample, labelled).
- **Merge** `claude/town-ui-rework` @39ab451 (build-depth foundation). Fixture conflict: kept foundation's v14, added
  v15-nodes to the save history (`mayRepair`: nodes are re-validated); both sides were protocol 23 → 24.
- **F-SET-01 / F-SET-02 / F-SET-03, F-PLT-01 (low-spec), F-CMB-07 (shake strength).** Settings window rebuilt into Sound,
  Display, Graphics, Accessibility, Controls, Gamepad (all text via `settingsMessages.ts`; `settings.tsx` added to the
  localization ratchet). Graphics presets Low/Medium/High/Custom with render resolution (live `renderer.resize`),
  effect density (particle budget ×1/×0.5/×0.2), ambient density, antialias (reload), foreground/background frame caps;
  low-spec hint after 20 s < 40 fps. Audio: alerts bus (fanfares) + mute in background. Reduce motion (system/reduce/
  full) for shake, background life, bursts, CSS animation, floating numbers. Colour-vision presets as overrides of
  `--r-*` + runtime `RARITY_COLORS` + beams/glows (Machado 2009 + OKLab: worst CVD pair 6.7–12.2 → 20.9–22.3 [M]);
  rarity shape marks on every slot. Damage numbers: size, others/taken/healing, crits only. Gamepad: standard mapping,
  13 remappable actions, spatial focus in windows, device-aware prompts. Preset cost measured (Low 105–110 fps vs High
  42–72, p95 18 ms). Account tab label shortened to "Data" (fits 1366). Tests: preferences/quality/gamepad 32/32 with
  bindings/messages/lifetime. Doc: SETTINGS.md. Shots: `set-*`, `set-inv-*`, `shapes-*`, `pad-*`, `acct-*`.
- **F-TEL-02 — bot metrics.** `SIM_JSON=<file>` hook in `sim.ts leveling` (one row per five-level band: kills/min, TTK
  trash/champion, deaths/h, taken % life/min, XP/h, gold/h picked and net, items/h by rarity, gems/mats/globes/h);
  `scripts/bot-metrics.ts run|render|compare` → `bot-metrics/baseline.json` + `BOT-METRICS.md` (240 simulated min per
  class, seed 0xc0ffee: warrior L43, ranger L44, mage L38; L5 at 5–8 min, L20 at 57–72 min, L30 at 118–163 min) [M].
  `bot-metrics.test.ts`: schema, report render, same-seed reproducibility (zero drift), drift maths. `npm run bot:metrics`.
- **F-TEL-01 — perf budget in verify.** `sim.ts budget`: 4 instances × exactly 150 awake monsters (one L70 player each,
  spawner refill off), every snapshot encoded with the real codec; gate = owner's < 10 ms round average [O] + p99 inside
  one 20 Hz period (50 ms); snapshot bytes/s vs recorded baseline (+15 % fails, the owner's client tolerance).
  Measured: round avg 2.7–3.6 ms, p99 6.4–10.4 ms, 81.5 kB/s per client, largest message 14.2 kB [M].
  `scripts/perf-budget.ts [--record]`, baseline `perf-baseline.json`; verify stages `perf-budget`, `bot-metrics`.
- **F-TEL-07 — combat replay.** `combatReplay.test.ts` + `replay/combatReplayRunner.ts` (fresh process per run, seeded
  `Math.random`, recorded movement/dash/skill inputs, sha256 per tick of every message except the wall-clock `time`):
  replay = identical on every tick for warrior/ranger/mage; a one-second input change diverges exactly at the change
  with all earlier ticks equal; another seed diverges. Verify stage `combat-replay` (≈30 s).
- **Merge** `claude/town-ui-rework` @f3019b1 (engine wave 2 + quest rework, includes cbbb4b7). Save history learned
  `extraFixtures` (v14-pre-quest-rework: custody kept, gold may rise from contract payouts) and `rewrites` (v6 quests
  rewritten by questMigration, keys must survive); 26 removed `contract_*` quest ids retired in the id lock with that
  reason. Bot metrics re-run after the merge: 0 % drift in every band [M]. Protocol stays 24 (lead 23), save 15.
- **F-ECO-08 — stash tabs.** Per character (D-24 unchanged); five 60-slot tabs, tab I free, II–V bought in order with
  gold: 170 K / 1.1 M / 2.4 M / 4.6 M = one hour of the measured median engaged-bot gold income in L10–15 / 20–25 /
  30–35 / 35–40 (bot-metrics baseline) rounded to 2 s.f. [M→P]; escalating gold-bought tabs as in D3 / D4 / Last Epoch
  [K]. Optional save field `stashTabs` (no SAVE_VERSION bump; an older server keeps the extra slots and still withdraws
  by id; loading never truncates). Ops `stashBuyTab {tab, price}` (must match the shown tab and price → a retry never
  pays twice), `stashMove {itemId, tab}`, `stashDeposit {tab}` (open tab first, then the next); all persisted, stash
  proximity, economy action "Stash tabs". UI: tab strip (count per tab, the next tab with lock + price, locked ones),
  buy confirmation replaces the filter row (cost red when short), drop onto a tab stores/moves there. Tests
  `stashTabs.test.ts` 5/5 + town-services/persisted/economy suites. Shots `stash-{tabs,buy-short,buy,bought,drag,moved}-
  {1920,1366}` (no scroll; 607 / 432 px tall). Owner picks: hours per tab (0.5 / 1 / 2), tab count (5 / 6 / 10),
  account-wide stash (D-24, P14).
- **F-MON-02 — behaviour toolkit.** `server/src/sim/behaviours.ts` + `MonsterDef.behaviours` (data): `enrage` (life
  threshold and/or combat timer → speed × / attack cooldown ×, once; cue or notice) and `summon` (every N ms, fixed
  spots with ground warnings, nothing appears if the summoner dies during the warning, alive cap per summoner, minions
  give no XP/loot unless `reward: true` — never a loot fountain). The Rift Guardian's enrage and adds now run through
  the same runners with their old numbers (BOSS_ENRAGE / BOSS_ADDS): `sim.ts rift` output identical before/after [M].
  Taunt branch kept (a taunted monster still goes for its taunt target). `behaviours.test.ts` 5/5 (adventure stage).
  **Dependency (engine lane):** a damage-absorbing shield needs an absorb hook in `hurtMob` (damage.ts) + `F_SHIELD` in
  `mobStatusFlags` (effects.ts); once it exists, a `shield` runner fits here. Which zones' monsters get which behaviour
  is content design for the owner/lead (roadmap P7: ≥ 1 new behaviour per zone); none assigned here.
- **F-MET-02 — offline gains v2.** Own measured field kill rate (last session with ≥ 5 field minutes, `FieldRateMeter`
  in the session, optional save field `afk`) capped by the measured engaged-bot band median
  (`shared/src/data/afkRates.ts`, generated by `bot-metrics.ts afk-table`, test keeps it equal to the baseline);
  legacy heroes keep 60/min, also capped. Per kill: live ordinary-kill rules (gold chance × mean pile; equipment drop
  chance × field factors × rarity weights × salvage yield — Monte Carlo of `rollDrops` within 3 % / 8 % [M]) instead of
  v1's invented 1/40 material constants (~7× live drops). Minute-by-minute progression (levels while away count),
  fractions carried → splitting an absence never earns more [M]; deterministic (Math.random forbidden in the test);
  12 h / 25 % unchanged; report adds rate, basis, share, cap (AFK modal line). Fairness model for alts written for the
  owner (AFK.md). `afk.test.ts` 7/7 (new verify stage `offline-gains`); bot AFK section 26/26.
