# P6 introduction implementation — C088

2026-10-10,solo. Research L102/D043 and PLAN.md preceded code. The connected implementation is ready for owner playtesting; human G5/R1 acceptance is not claimed.

## Delivered

Original class explanations, existing animated previews and27 combinations of existing skin/hair/style palettes; choices save and replicate only for new heroes. Returning saves are untouched unless they opt in. Save7/protocol10 retain optional appearance and versioned introduction progress.

Ten skippable event-driven lessons lead through existing town movement/dash, physical Waypoint, Rillwake/Orren, the first road task, equipment, earned skill investment, elite and return. Server events record accomplishments separately from skipped steps. The physical one-time A Foot on the Road quest grants a legal level1 magic starter-base weapon whose upper normal damage endpoints plus positive class main stat exceed the original normal starter. There is no promise over later gear. Full-bag/reconnect retains one reserved item; repeating introduction enrollment does not reset reward history. The four existing adventures keep IDs/revisions/rewards.

Fifteen contextual hints cover actionable loot/bag/level/points/rune/elite/death/legendary/Cube/rift situations and the existing guidance. Introduction and generic hints share one card; urgent bag/death/elite conditions can interrupt it. Optional disclosure hides irrelevant controls/empty slots/diagnostic numbers, while explicit panel requests explain and open the system. This deliberately avoids hard locks. Eight searchable FAQ topics and the complete lesson/hint libraries remain available.

Optional consented local observation records15 fixed first events, class, protocol and a human/scripted label, bounded to20 observations. No identity/chat/network fields or automatic upload; export, inspect and delete controls are present. Visible in-game elapsed time excludes hidden tabs; reload/disconnect stops the session. It is client receipt timing, not a server performance or learning measurement. Exact Git build is recorded by the facilitator separately. FRESH-PLAYER-KIT.md supplies consent, event/minute observation fields, comprehension/accessibility rubric and pending N/M report.

## Measured checks

34 distinct focused checks passed (12 shared/client +22 server/quest/foundation). They cover all-class starter improvement across40 seeds each, full bag, duplicate claim, actual movement/dash, physical/dead contact, invalid event injection, skip/resume, unknown revisions, consent, hidden time, and synthetic save v0–v7 retention. The movement bot walks camp to the road approach with infinite HP; it does not complete the whole tutorial or establish difficulty. Typecheck/content/build passed; a test-only empty-array narrowing error was corrected. Existing Vite configuration/chunk warnings remain. No repeated full-suite run or full campaign playthrough.

Actual local Chrome creation, saved hero login, Help, Skills and journal were inspected at1920x1080. The original tall First Steps capture prompted the owner’s no-scroll requirement; C089 replaces it. Current images are in images/. No browser error was captured in the final brief inspection. Fresh temporary DATA_DIR roots and disabled backups were used throughout; no real save access. No downloads/dependencies/assets from third parties.

## Acceptance and remaining work

The implementation checklist F-ONB-01..07 is present. Timing targets are observation fields rather than invented minute promises. Encounter placement/stats are reused, not retuned without human evidence. Whole-route bot/random-walker coverage, human combat tuning/comprehension, full accessibility/populated-state playtesting, and owner-set N/M remain explicit G5 acceptance work. Earlier accounts/party/R1 prerequisites remain open. The owner explicitly prefers implementation now and will do full playtesting later.

Nothing was removed from game content. At most one extra level1 magic weapon per enrolled character is an economy addition that P8 must count. Existing world/town, camera, owned items and combat formulas remain. Rollback must retain reward and saved-introduction history; remove presentation/enrollment without resetting claims. Continue P7 after the C089 layout correction.
