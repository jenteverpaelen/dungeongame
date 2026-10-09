# Rillwake Crossing — C070 verification

2026-10-09, solo, on the owner's Windows PC. One additional authored field and one optional quest are playable. This is a bounded first adventure, not completion of the campaign or Claude's roadmap. Research precedes design in [L81–L83](../town/REFERENCES.md); [D027](../town/DECISIONS.md) records the sequencing decision. [Design and rollback](RILLWAKE.md).

## Implemented

The existing Hearthmere Waypoint now lists Rillwake Crossing. Its timber bridge, flooded banks, optional upper ridge, camp and ruined mill come from shared authored data. Exact swept collision, projectile line of sight and client prediction use the same geometry. Five fixed encounter sites contain 29 initial enemies, reusing existing original forest enemies and combat rules. Cleared sites use the existing 18-second glade delay and stay clear while a player is within the existing respawn exclusion distance.

Orren offers The Silent Wheel: investigate the cart, defeat Siltroot, recover the ledger, return for a class-appropriate magic weapon. The server checks the actual map, target, living-player proximity, line of sight and objective sequence. Kill credit requires a living local witness to the real tagged encounter. The first successful ledger recovery generates and persists the exact previewed weapon. Reopening cannot reroll it; a full inventory keeps the reward pending; a repeated claim cannot duplicate it. Progress is optional per-character revision-1 state.

The minimap shows authored terrain and the current objective. The journal, dialogue and tracker reuse existing UI styling. Town data, the fixed 620-world-unit camera, old fields, rifts, existing items/skills and character art are retained. No downloaded assets or dependencies were added.

At the owner's request, F2 adds **Infinite HP** behind the existing server debug permission. The test player takes no damage, fills HP when enabled, and loses the runtime flag on travel/reconnect. It is never saved. Default debug denial and DISABLE_DEBUG override still apply. Browser survival after enabling it is assisted evidence, not balance evidence.

## Measured checks

- Strict [21-stage verification](checks/verify.json): all passed, no known-failure allowance; 25 shared tests, six adventure/server tests, 757 general server checks and 382 simulation checks. Typecheck, content validation and production build passed. The existing large-bundle warning remains. Each stage used a separate temporary DATA_DIR; backup creation/rotation was disabled except explicitly isolated backup fixtures.
- New geometry checks sample both authored routes every eight world units and sweep each segment; entry, all enemy bodies and interaction approaches are clear. Water, mill walls and bridge rails block movement/rays; the doorway remains open. Layout is identical across seeds. The two route polylines total 6084.46 world units, or 24.34 seconds at 250 u/s without combat. This sum is not a complete quest round trip or a human session estimate.
- Actual command/kill/save tests cover all three classes, wrong/remote/dead interaction, sequence, wall obstruction, pre-accept/pre-cart/dead/unrelated/reward-suppressed kill credit, full-bag retry, inventory slot zero, repeated inspection/claim, normalization and saved reload. The HP test covers default denial, override denial, damage blocking, toggle-off damage and player recreation.
- The standalone normal-health input audit passed strict TypeScript checking and produced [this report](checks/normal-health.json). No HP toggle, level grant, teleport or new combat tuning was used. It follows ordinary simulated movement inputs and pauses to fight; it is synthetic behavior, not a human playtest.

| Fresh class | Simulated seconds | Kills | Deaths | Finish level | Reward item level |
|---|---:|---:|---:|---:|---:|
| Warrior | 62.80 | 32 | 0 | 4 | 3 |
| Mage | 50.95 | 35 | 0 | 4 | 3 |
| Ranger | 51.55 | 35 | 0 | 4 | 3 |

Kills exceed the initial population because out-of-view sites can respawn on the return trip. Single-character tick samples in the JSON are diagnostic output; they do not establish browser or crowded-channel performance.

## Real browser on this PC

Chrome, local Vite client :5173 and real authoritative server :2567. Only synthetic characters in `hf-rillwake-browser-d03920b6ec0d498e8f2d16098f6a4034` under Windows TEMP were used. The owner’s real saves were not opened. DOM viewport and canvas were checked at 1920×1080, foreground. Saved image dimensions are independently recorded in [the capture manifest](checks/browser.json); each retained image was personally inspected.

The assisted Mage walkthrough completed acceptance, cart inspection, Siltroot combat, doorway traversal, ledger recovery and return/claim through the real server. The reward was a level-3 Wise Quarterstaff with +5 Intelligence, 5–9 damage and 1.00 attacks/s. It stayed unchanged after reaching level 4 on the return route. Completion survived reconnect and a subsequent owned test-server restart. The synthetic save contained exactly one inventory item matching the reserved reward ID and no HP debug flag. The normal Waypoint card also successfully entered Rillwake. The optional ridge reached its authored rejoin through ordinary browser movement. Return-portal verification is recorded in the capture manifest.

Final current-page browser warning/error query returned none. The displayed FPS counter is not a controlled benchmark. The regression suite overlapped some later route checks, so no performance acceptance is inferred from those frames.

## Corrections and limitations

- Initial route tests caught one camp path crossing the NPC and two obstructing trees. Authored points were corrected before acceptance. A mixed-winding Canvas clip initially made false water holes; consistent winding fixed the visible ground union. Repetitive ground marks were replaced with coherent noise and sparse grass.
- The first reward design reserved an item at acceptance. Normal bots finished at level 4 with a reserved level-1 weapon. L83 supersedes that unreleased design: reserve at ledger recovery instead. This is measured level alignment, not a promise that every reward beats owned gear.
- The first unassisted Warrior browser pilot died after standing unattended under ranged fire. Its completed cart step survived. The later owner-requested HP-assisted walkthrough is reported separately from the normal-health bots.
- One initial screenshot was 2048×1090. A later viewport-only capture was 1920×1022 despite a 1920×1080 DOM viewport. Both are excluded from 1080p acceptance; resetting the override and capturing the full page produced verified 1920×1080 files. QA overlays obscure the heading in some development captures; the final normal-page completion capture has no overlay.
- A rapid development-page navigation produced “already online” during re-entry. Restarting only the owned temporary server and manually logging in succeeded with saved completion intact. Its origin was not established; no login behavior was changed or claimed fixed. The test-server Ctrl+C exit is not evidence of graceful production shutdown; the separate regression suite covers shutdown behavior.
- The normal-health audit's first final invocation refused Windows long/8.3 TEMP aliases before creating test data. The guard now resolves both parent paths physically and requires a fresh direct TEMP child. A guessed `characters/` subdirectory in a read-only synthetic-save check was corrected to the actual temporary save root; no real data was read.
- Art remains a simple original first pass: angular banks, repetitive forest silhouettes, plain low mill walls and a static wheel. It is not a finished environment-art or ambient-sound milestone. No new boss moveset, localization pass, world map, branchable campaign, repeat/party quest policy, fresh-human pacing study or 30-player field benchmark is certified.
- Saves retain existing atomic whole-character/asynchronous flush behavior. A crash may lose unflushed progress; restoring an older snapshot restores older claim eligibility. No durable receipt across historical restores or new account identity guarantee is claimed.

No existing content or system was deleted. Item protection remains pending. Future work is visible in the [roadmap ledger](../CODEX_ROADMAP_STATUS.md), and the reasons, effects and rollback are in [C070](../CODEX_CHANGELOG.md).
