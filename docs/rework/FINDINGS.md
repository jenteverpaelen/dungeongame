# Review of Codex's work (C001–C108) and what changed — 2026-10-10

Scope: everything on `codex/new-tristram-town` up to `2361a65`. Method: read the handoff, working set and chapter
reports; ran `typecheck`, `content:check`, `build`, the full `npm run verify`; played a fresh character through the
first quest on a private server (isolated saves, ports 2601/5201), and looked at 1920×1080 captures of the town,
the field zones, every panel and the quest flow. Nothing touched the owner's playtest server or saves.

## Verdict in one paragraph

The **systems are broad, server-authoritative and unusually well-guarded** (durable command receipts, origin
allow-list, replay safety, backups, quest validators that prove reachability). The **presentation is not**: the town
is a dark, grey, empty cobble field in a void with clone NPCs; the UI is dense, tiny-text and tab-nested; quest
interaction is a journal panel with a small dialogue block; quest objects are barely visible. The regression net had
silently gone red. That is why the owner's complaint is justified, and why the fix is mostly *presentation and
hygiene*, not new rules.

## What is solid — keep it

| Area | Evidence |
|---|---|
| Server authority and exploit resistance | `verify` stages foundations, save-failures, command-replay, backups, backup-rotation, backup-runtime, town-services, skill-descriptions all pass; persisted command receipts (`persistedCommands.ts`), item protection, origin allow-list, 60-command queue |
| Quest engine | Objective families (kill/interact/reach/wave/talk/deliver/rift/collect), validators that reject cycles, unreachable quests, bad rewards; party credit; chapters/lore/journal |
| Content volume | 3 classes × 6 skills × 3 runes × 3 tiers, 18 passives, 22 legendaries, 9 sets, 33 affixes, 26 monsters, 16 zones, 31 quests |
| Simulation cost | 4 players + 150 monsters: tick avg 1.3 ms, p99 4.5 ms (`sim.ts`) |
| Evidence discipline | 188 sources / 184 claims / UI atlas / timelines; every chapter lists measured, inferred and unverified |
| Offline gains | works end to end ("While you were away" report; 25 % of an assumed 60 kills/min) |

## What was weak — and what I did about it

| # | Finding (evidence) | Action |
|---|---|---|
| 1 | **Town**: grey, dark, huge empty cobble plaza; polygon edge against a void; faceted-blob trees; NPCs reuse the hero rig (same spiky hair) — `docs/town/tour/town-complete-plaza.png` | Replaced by the Opus world/UI pass (see `WORLD_UI_REPORT.md`) |
| 2 | **Fields**: charming but polygon "islands" on dark water, sparse props, quest objects (ledger, wheel, cart) tiny and plain — `docs/adventure/tour/mill-doorway-1080.jpg` | Same pass (natural borders, richer ground, bigger quest objects) |
| 3 | **UI**: 11–12 px text, nested tabs (Skills → Meteor → Overview/Runes/Tiers/Casting/Rules), huge empty black areas, stacked plain text buttons under the minimap | Same pass: one-screen skills with direct point spending, HUD menu bar, new window system, illustrated world map |
| 4 | **Quest interaction**: pressing E on a person opens the Quest Journal; only Orren could be talked to | New original conversations for the ten other contacts (`castDialogues.ts`), barks, cast bible; dialogue window in the UI pass |
| 5 | **Quest structure**: of the 20 main-chain quests, 13 are "read/reach → kill one named keeper (→ use a mechanism)", 6 are chamber-clear waves, 1 is reach+interact. Across all 31 quests the steps are interact 27, kill 16, wave 10, talk 7, reach 3 — no deliver, collect or rift step is authored although the engine supports them | Recorded; needs authored variety — see Recommendations |
| 6 | **Regression net red**: `npm test` 8 failing shared tests, `verify` failing in 5 stages (stale expectations after a starter quest was inserted, the 2/3 drop model, durable receipts, the social ledger folder) | Fixed: shared 47/47, bot 756 pass + 1 known Windows shutdown probe, sim 382/382 (commit `604a62b`) |
| 7 | **Set bonus almost dead**: Fallen Star 2pc "second meteor" fired in 0 of 14 casts in the sim after the C107 reach cuts (packs close into one blob inside the first impact; the second target had to be 0.9 radius away) | **Fixed**: the second target only has to be 0.5 radius from the first impact (`server/src/sim/skills.ts`). Codex's nine-build audit before/after: mage/fallen_star 235 s → 206 s, 1.146 → 1.017 of the class median; every build stays inside the 1.25 window (max 1.149). Sim check restored to ≥ 1.25 telegraphs per cast |
| 8 | **Copy bug**: dash lesson said "safety of Hearthmere" while standing in Rillwake | Fixed (`2051d68`) |
| 9 | **Bark banner**: the single `bark` per service NPC is shown as a huge top banner that collides with the open panel | Speech bubbles in the UI pass; richer lines in `barks.ts` |
| 10 | **No accounts**: identity is still the character name; `P3` remains the release blocker | Not started (owner decision on credential model, hosting) |
| 11 | **Repository weight**: 770 documentation/evidence files, `docs/` is 296 MB, pack 289 MB; ~3 % of source lines exceed 160 characters (dense one-liner style in newer files) | Recommend moving evidence PNGs out of git history going forward; no change made |
| 12 | **Skill hint reveals the UX problem**: "Open K, choose a skill and read its next tier before buying. Unlocked runes are a separate choice…" | Skills screen redesigned so no explanation is needed |

## Recommendations (not done)

1. **Author variety into the main chain**: one defend/escort, one timed collection, one choice with a consequence,
   one optional hard elite per zone. The engine can express most of it today.
2. **Accounts (P3)** before any non-friends test; then social backup operations.
3. **Trim the repo**: keep reports, drop bulk PNG/JSON evidence from history in a future clean branch.
4. **Measure real player timing** (see `PACING.md`).
