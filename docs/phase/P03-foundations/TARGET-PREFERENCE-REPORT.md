# Target preference — C084

Implemented the optional target preference recommended by Claude §10.1 A6: Default, Nearest, Elites first and Lowest life. L98/D039 and the [plan](TARGET-PREFERENCE-PLAN.md) preceded code. The control lives in the existing Skills panel and is saved per character. This is a bounded P4 addition, not completion of combat design or the roadmap.

## Evidence and behavior

The existing selector and its eight callers provide the implementation boundary. Default retains the original two-pass selection: nearest body-inclusive candidate, then elite/boss/goblin preference inside max(nearest × 1.2, nearest + 30). Nearest skips that second preference. Elites first chooses the nearest tier1/2/4/5 candidate, otherwise the nearest ordinary/minion. Lowest life compares remaining HP fractions and breaks ties by body distance. No range, cost, damage, resource or cooldown number changed.

The [official historical FFXII update](https://www.square-enix-games.com/en_GB/home/final-fantasy-xii-the-zodiac-age-pc-ps4-update), indexed FFXII-GAMBITS-2020/FFXII-01, supplies configurable-automation precedent only. It does not establish these targeting rules or prove their balance. The actual options are Claude's recommendation applied to Hearthfall's measured selector. No external assets, wording or algorithm were imported.

Primary attacks and existing target-based skill decisions read the preference, as do new Sentry/Hydra shots and Companion acquisition. A Companion keeps a live target within its existing owner-distance boundary. Existing weighted ground-point/cone crowd aim remains; Multishot's target-derived projection distance can change while its crowd direction remains. Launched projectiles keep their existing homing/reacquisition rules. Target preference does not bypass existing line-of-sight flags: some callers already do not require LOS, and the current shotBlocked check uses tile samples rather than every prop polygon. This checkpoint does not claim to redesign projectile collision or manual aim.

The command accepts exact supported modes and persists without refreshing combat stats, resetting resources/cooldowns or consuming anything. Missing/malformed saved values retain Default. Save version4/protocol6 prevent older code silently ignoring the preference. Synthetic v0 through v4 fixtures preserve inventory, equipment, stash overflow, protection, rune/tier choices, cast restrictions and unknown extension fields.

## Measured validation

All work ran on the owner's PC with isolated data. The first typecheck exposed a missing required theme in the new test fixture; it was corrected before runtime tests. Final typecheck and content validation passed. Twenty-three focused cases passed: eight target tests, nine foundation/save tests and six existing auto-cast tests. They cover default distance windows, elite tiers, HP fractions/ties, dead/range/LOS exclusions, actual primary casts, actual Sentry/Hydra shots, held Companion targets, invalid commands, resource/cooldown preservation and save/reload. One existing combat simulation passed 382/382 in 6.3 seconds. These are regression checks, not a human balance or browser-performance result.

Production build passed. A small UI-only rebuild followed visual inspection; no combat tests were needlessly repeated for the layout/text adjustment. Existing Vite future-config-loader and large-chunk warnings remain. Isolated roots: hf-c084-checks-84354765c0324afd97234cd9a31a8141 (fixture typecheck failure), hf-c084-focused-f2d6a840c82e4eeab90c67520e4a0b0f, hf-c084-build-cce42235116d4d1d9dc7a4261f78b8c9 and hf-c084-ui-c86ec51178b3477eaafd338e262adc21. No real saves were read or used.

Actual built Chrome, synthetic PumpC075 mage, 1920×1080: Default → Elites first, reload and observe retained selection, then Nearest → Lowest life → Default. Inspected both final captures, [elites](../../adventure/tour/c084-target-elites.jpg) and [lowest life](../../adventure/tour/c084-target-lowest-life.jpg). Pilot controls wrapped across three uneven rows; a scoped two-column grid now keeps four choices together. Longer labels use two lines and the left column scrolls. Explanatory copy remains small in the existing style; no broad accessibility acceptance is claimed. No captured browser warnings/errors. Matching protocol6 preview is running; Default and ordinary auto-cast modes restored, infinite HP re-enabled after reconnect.

## Remaining work, removals and rollback

No content, skill, item, quest, reward or system removed. Optional target ordering changes combat effectiveness by design, but tactical value and all-build human review remain open. No live field targeting video, all-class UI tour, sustained crowd benchmark or complete P4 acceptance. The previously frozen Chrome tab's root cause remains unknown; this session responded normally.

Town, original camera and UI style remain. No dependency/download or economy change. Rollback can hide the editor while retaining save/protocol support; selecting Default restores the previous algorithm. Do not downgrade saves by stripping their version/preferences. Continue the full roadmap.
