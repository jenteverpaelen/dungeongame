# Partials completion plan (branch `claude/partials`, 2026-10-11)

Owner request: every roadmap row Codex left **partial** gets finished to the roadmap acceptance, and where a better
design is visible it replaces Codex's. Sources: `docs/CODEX_ROADMAP_STATUS.md` (what is left per row),
`docs/design/FULL_GAME_ROADMAP.md` on `docs/mmo-roadmap` (§7 acceptance, §8 catalogue, §9 screens, §12 checklists),
`docs/rework/ACCOUNTS.md`, `docs/rework/DESIGN.md`. Evidence labels: **[M]** measured here, **[S]** read from a
source (cited), **[K]** known from memory and not re-checked this session, **[P]** proposal / design choice.

Lanes I stay out of (parallel agents): skills/runes/tiers/nodes/passives/legendaries/sets/item data, the Skills
window, Cube power code, `server/src/sim/{skills,summons,projectiles,playerctx}.ts`, the parity/build harness
(foundation); every quest/contract/dialogue/journal/tracker/world-map file and the zone plan data (quests);
`docs/rework/depth/` (content designer). Shared hot files (`protocol.ts`, `commands.ts`, `commandState.ts`,
`types.ts`, `constants.ts`, `persistence.ts`, `check-content.ts`) get **small additive edits only**, listed in the
final report so the lead can reconcile.

## Rows and acceptance

| Row | What Codex left | Acceptance I will meet (roadmap) | Improvement over Codex |
|---|---|---|---|
| F-ACC-01/02 | Accounts exist (lead, 2026-10-10) but sessions die on restart; lock design lets anyone lock a username for 15 min; no proxy setting; no device list | P3 acc. 1: a character cannot be opened without credentials (guess, replay, enumeration, concurrent login, token theft after logout) — all as tests; sessions survive restarts **safely** | Sessions persisted as SHA-256 hashes only (a stolen file cannot be replayed), not in backups; device list with sign-out-others; lockout keyed per username+IP plus a high per-username ceiling (NIST SP 800-63B §5.2.2 caps failures per account at 100 [S]) so a stranger can no longer lock a player out; opt-in `TRUSTED_PROXIES` for `X-Forwarded-For` |
| F-ACC-05 | Recovery codes exist; no notice when a code is used, no owner-assisted procedure | Recovery without a paid mail service, documented end to end | Security activity log on the account (login from a new device, password change, code used, codes regenerated, deletion requested) shown in the dialog — the email-free equivalent of a "your password was changed" mail; low-codes warning; written owner-assisted recovery procedure + tool |
| F-ACC-06 | Data inventory only | GDPR export + account/character deletion with grace period + owner tooling; P14 acc. "account-wide data included in export/delete" | Machine-readable JSON export (GDPR Art. 20 [S]) of account + characters + own telemetry + own community records, re-asks the password; deletion with a 14-day grace period (cancel by logging in) and a purge job; **erasure ledger** of hashed ids that re-applies deletions after any backup restore; character soft-delete with the same grace; owner CLI (`export`, `delete`, `cancel-delete`, `pending`, `purge`) |
| F-SAV-01 | v0–v12 fixtures; v13/v14 missing; no rule that forces a fixture per version | P3 acc. 4: every save-shape change has a migration test and a golden fixture | Ordered migration registry with one documented step per version, v13/v14 fixtures, and a test that fails when `SAVE_VERSION` grows without a fixture |
| F-SAV-03 / F-OPS-04 | Verified backup + count rotation; restore drill was manual; off-device, logical corruption open | P3 acc. 5: restore drill documented and timed; P16: drills tested | Automatic **restore drill after every scheduled backup**: restore to a scratch dir, parse + migrate every character in memory, item-ID/count checksums, timing → `drills.jsonl` and `/healthz`; optional `BACKUP_MIRROR_DIR` (free off-device copy: second disk / synced folder) verified by checksum; runbook with timed drill log |
| F-CON-01 | Typed registries + semantic validator | P3 acc. 8: `content:check` fails on duplicate IDs, dangling references, missing localization keys | Stable-ID lock (`scripts/content-ids.lock.json`) of every save-referenced id: removing/renaming an id fails unless retired with a reason; runtime schema checks (id pattern, names, unique display names); localization ratchet for extracted files |
| F-CON-02 (part) | 136 keys (settings/controls) | — (not my row in full) | Keys for every string in files I own/touch; the rest listed "after merge" |
| F-CON-03 / F-PLT-08 | 694-field inventory, 23 production licences | P17: IP audit shows no third-party names/text/art/audio; licence ledger for every component | Name/IP register with risk + proposed original replacements (no renames — other lanes); full installed-tree licence audit incl. build tools, asset provenance scan; checked by a script |
| F-SET-01 | Audio sliders; UI scale exists | Settings: audio buses, graphics quality, UI scale | Graphics preset Low/Medium/High (render resolution, effects density, ambient density, antialias), max FPS + background FPS (D3 has "Max Foreground/Background FPS", "Low FX" [K]), automatic low-spec suggestion from measured frame time; audio: separate Alerts bus (loot/level fanfares) and mute-in-background (GAG: separate volume controls [S]) |
| F-SET-02 | Keyboard: 17 actions × 2 bindings | Every action rebindable via an input-abstraction layer; controller input (F-PLT-06 later) | Gamepad via the W3C Gamepad API "standard" mapping [S]: analog movement, remappable buttons, edge-detected actions, in-panel focus navigation, device-aware prompts; one action layer feeding keyboard and gamepad |
| F-SET-03 | Shake, flash, combat numbers on/off | Colour-safe rarity cues, reduced motion/shake/flash, text size (= interface size), damage-number options | Rarity shape glyphs on every item cell (GAG "no essential info by colour alone" [S]); colour-vision palettes picked by **measured** ΔE under Machado-2009 CVD simulation, not by eye; one "Reduce motion" switch (follows the OS by default) that removes shake, decorative motion and UI animation; damage numbers: size, crits-only/mine-only, damage taken, compact numbers |
| F-TEL-01 | 24-stage verify; perf separate | P3 acc. 6: verify includes a perf budget with recorded baseline | Headless `perf-budget` stage: server tick (4 instances × 150 monsters, ARCHITECTURE §1.2 budget < 10 ms [S]) and snapshot bytes/player against a recorded baseline |
| F-TEL-02 | Field calibration; `sim.ts leveling` prints a table | Bot metrics (kills/min, TTK, deaths, XP/h) per class × level | JSON + Markdown report per class × level band (kills/min, TTK trash/elite, deaths/h, XP/h, gold/h, items/h), committed baseline |
| F-TEL-04 | Opt-in local log, no schema/retention | Local event-log schema, privacy-respecting | Typed schema with allowlisted fields (unknown fields dropped), retention (`TELEMETRY_RETENTION_DAYS`, default 30 [P]), included in export, scrubbed on erasure |
| F-TEL-05 | Consented client funnel view | Funnel and session analytics views (owner, local) | `npm run telemetry:report -- --html` → self-contained local HTML: funnel (login → first level → L5/L10/L20 → first quest claim), session lengths, return rate, levels/hour, deaths by zone; no server endpoint |
| F-TEL-07 | Repeated payload equality | Determinism tests for combat (P4) | Recorded-input combat replay test: same seed + same inputs → identical event stream hash; divergence test proves sensitivity (tests only) |
| F-WLD-06 | Deferred | Town upgrades as systems land | D3 artisan shops visibly grow with artisan level [K]: Hearthmere's forge/jeweler/mystic houses gain props as the hero's workshop (Cube) level grows; the stash vault shows bought tabs; per-player, client-only |
| F-ECO-08 | 60 slots, tabs reserved | Stash expansion/tabs | Tabs of 60, first free, more bought with gold (prices derived from **measured** engaged-bot gold income, owner-adjustable data); tab strip in the existing Stash window, drag onto a tab, two-click purchase; idempotent persisted command; optional save field (no version bump) |
| F-MET-02 | AFK formula measured | P14: offline gains deterministic and capped; no alt-funnelling path | AFK rewards derived from the **live** drop/XP rules (the old constants predate the balance pass); credit for quest zones; return report breakdown; determinism/cap/relog tests |
| F-OPS-05 | Debug/origin controls | §12.3 security checklist; dependency audit | `npm audit` (0 findings [M]) recorded; security headers on HTTP; per-IP connection cap; log hygiene check; checklist with evidence per item; upgrade proposals listed, nothing installed |
| F-CMB-01/07/08, F-MON-02 (in-lane parts) | Behaviour inventoried | Spec frozen with owner, feel toggles, parity | Combat spec draft from code (for owner freeze); client feel toggles (shake strength, hit flash); monster shield/summon/enrage behaviours in monster AI only if no forbidden file is touched; rest "after merge" |

## Order

A: saves → accounts → backups/drills → telemetry → security → content/IP. B: settings (graphics, audio, accessibility,
gamepad). C: stash tabs → AFK → town. D: perf gate → bot metrics → replay tests → combat spec → monster behaviours.
Each row ends with tests, a LOG line and an honest status in the ledger; UI rows get 1920×1080 and 1366×768 shots.

## Owner decisions this plan does **not** take

Real retention numbers for a public server (defaults are labelled proposals), legal texts, final names for flagged
skills/items (list only), whether to require accounts on the playtest server, and the combat-spec freeze.
