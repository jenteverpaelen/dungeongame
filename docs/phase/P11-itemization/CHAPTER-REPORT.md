# P11 Itemization — implementation and measured evidence

2026-10-10, C106. The selected P11 implementation inventory is complete. This is the additional whole chapter requested after P10, followed by the Claude handoff and stop. It does not close the combined P11/P12 G9 gate or certify human balance, survival, endgame, or public release.

The owner selected three distinct builds per class, each no more than 25% slower than its class median on identical encounters. They requested fewer **all equipment drops**. The chosen tuning reduces equipment opportunities to two thirds; that exact fraction is a documented implementation choice, not a reference-game fact or separately owner-specified number. Town, fixed camera, existing UI materials and saves are preserved.

## Research and decisions

[REFERENCES](../../town/REFERENCES.md) L128–L132 and [DECISIONS](../../town/DECISIONS.md) D066–D069 contain provenance, local measurements, scope and rollback. Research preceded each design change. D3's official Mystic description supports acquired cosmetic appearances and physical artisan flow; PoE's official item-filter page distinguishes visibility from acquisition. The existing equal-priority D3/Idleon/Task Bar Hero/PoE/Torchlight II digests informed the comparison without pretending each game has every feature. Local affix, skill, cost and simulation measurements determine this game's numbers. MDN's exact-integer limit informs the numeric guard. No new asset, dependency, download or paid service was used.

## Complete selected inventory

| Roadmap item | Shipped behavior | Evidence and boundary |
|---|---|---|
| F-ITM-01 Affixes / slots | 33 affixes: resource capacity on head/belt/offhand; existing flat damage joins legal weapon pools. Existing primary/secondary and per-slot rules remain. | Content validation and generated build gear; no claim every possible affix combination is balanced. |
| F-ITM-02 Powers / builds | 22 powers, including Faultcleaver, Rainspindle and Lanternroot. Data-driven skill modifiers support the alternative identities. | Nine actual-simulation profiles below; existing powers retained. |
| F-ITM-03 Sets | Nine six-piece sets, three per class; six new original sets with 2/4/6 effects. Existing three sets and earned gifts remain. | Content references validated, all nine complete-set profiles clear matched encounters. |
| F-ITM-04 Recipes / materials | Blacksmith Rare-base forge; Jeweler same-rank 3-to-1 family exchange; Cube chosen class-set conversion. Physical role, cost, level, custody/protection and persisted-command checks. | Focused service/transaction checks. Five existing material currencies retained with original display names. |
| F-ITM-05 Appearance | Persistent acquired looks, nine compatible equipped slots, free Mystic apply/restore. Appearance never changes item stats or ownership. | Legacy migration/identity/consumption tests; local appearance page and remote-service rejection. |
| F-ITM-06 Socketables | Six gem families × six ranks; Pearlglass supplies attack speed, resource capacity or resource regeneration by slot. Existing socket/fuse/remove paths remain. | Shared gem catalogue/consumers; exchange validation and content check. |
| F-ITM-07 Loot rules | Separate ordinary-rarity hide, walk-over leave and opt-in salvage settings. Salvage runs only when opening the nearby Blacksmith; eligible bag items only. | Default show/pickup/no salvage; protected, merchant, Ancient, upgraded, enchanted, filled-socket, pending-enchant, equipped and stash items excluded. Reconnect verified. |
| F-ITM-08 Comparison / links | Both ring replacement deltas, sheet-estimate limitation text, character-bound label, authoritative owned-item chat links and immutable hover snapshots. | Ownership/block/snapshot checks; real browser send/compare on disposable local world. |
| F-ITM-09 Codex | Paged Powers/Sets catalogue with acquired/extracted state, compatible appearance pages and bag sharing. | Successful acquisition only; visible ground loot and failed pickup do not unlock. Collection remains after consumption. |
| F-ITM-10 Curves / cadence | Level1–70 base-tier monotonic review, old/new equipment model, explicit numeric envelope and technical ceiling. | Models below; actual human gearing hours and future uncapped growth remain unverified. |
| F-ECO-05 / skill hooks | Existing physical artisan identities/shared workshop levels retained; generic new set/power effects use existing runes/tiers/skills. | No separate artisan currencies or new rune/mastery catalogue claimed. F-SKL-02's broader expansion remains open. |

Recipe budgets reuse measured existing costs: forge costs `100 + 4 × level²` gold plus three salvage yields from each ordinary rarity; workshop level2. Gem exchange costs existing same-rank fusion gold and three source gems; level2. Set conversion costs existing reforge budget (50,000 gold, 5 Relic Embers, 15 Dawn Quartz); level7. Conversion replaces the bag input at its item level, rerolls properties, removes upgrades/Ancient status, and returns socketed gems. The UI explicitly confirms consumption. This cannot create Ancient/Primal items. Existing recipe operations remain available.

Collection is character scoped: save14, collection revision1, protocol20. Old inventory/stash/equipment/retained-buyback items seed their first acquired appearance without replacing item identity. Historical consumed items cannot be reconstructed; legacy extracted powers still count in the Powers codex. One appearance per catalogue identity is intentional, not an infinite archive of every procedural color roll. Unsupported malformed/future collection data is rejected, not silently truncated. Saved command receipts cover new mutations using the existing serialized save-before-success boundary.

## Build-diversity result

[BUILD-MODEL.json](BUILD-MODEL.json) comes from [audit-item-builds.ts](../../../scripts/audit-item-builds.ts): **81 actual 20 Hz encounters**, nine builds × three equipment seeds × three identical enemy arrangements. Level70, Torment X, non-Ancient six-piece set plus signature power, 48 tier points. No upgrades, socketed gems, Paragon, passives, Cube powers or runes. Infinite HP and deterministic chase isolate clear speed; the bot does not dodge. Encounters are a six-enemy ordinary pack, three Flint Beetle champions and Gorgemaw. Each run has a 120-second limit. Totals sum all nine encounters for that build, not a single dungeon clear.

| Class | Set / main identity | Total seconds | Time / class median | Timeouts |
|---|---|---:|---:|---:|
| Warrior | Endless Storm / Whirlwind | 155.20 | 0.9124 | 0 |
| Warrior | Cinder Oath / Cleave and Rend | 172.15 | 1.0121 | 0 |
| Warrior | Fault Warden / Seismic Slam | 170.10 | 1.0000 | 0 |
| Ranger | Siegebreaker / Sentries | 272.40 | 1.0000 | 0 |
| Ranger | Farwatch / arrows and Multishot | 312.20 | 1.1461 | 0 |
| Ranger | Rainkeeper / Rain of Vengeance | 252.15 | 0.9257 | 0 |
| Mage | Fallen Star / Meteor | 235.35 | 1.1461 | 0 |
| Mage | Glass Concord / Magic Missile | 205.35 | 1.0000 | 0 |
| Mage | Lantern Garden / Hydras | 175.30 | 0.8537 | 0 |

All three builds in each class satisfy the owner-selected maximum1.25 ratio in this harness. The slowest ratio is1.146109. This demonstrates distinct skill-driven clear-speed candidates, not universal endgame or survival balance. The JSON includes per-skill damage attribution. The maximum observed hit was706,983,896.

Development findings: Torment V packs initially died too quickly for useful 50ms resolution, so the matched experiment moved to Torment X. The Hydra summoned attack was missing its set-multiplier consumer; that is fixed. Only the six new sets' six-piece budgets were tuned, ending at multipliers127/22/30/30/24/24 for Cinder Oath/Fault Warden/Farwatch/Rainkeeper/Glass Concord/Lantern Garden. These are measured tuning choices, not copied reference-game values. Existing three set multipliers remain unchanged.

## Equipment cadence and numeric bounds

[ITEM-BUDGET-MODEL.json](ITEM-BUDGET-MODEL.json) comes from [audit-item-budget.ts](../../../scripts/audit-item-budget.ts): 14 rows ×10,000 kills ×two opportunity scales = **280,000 generated kills**. It compares scale1 and scale2/3 using the final catalogue; it is not a byte-identical replay of pre-P11 code. It covers ordinary Normal levels1/35, all six encounter tiers at level70 Normal and Torment X. Sample equipment output is **0.648951–0.708514 of the former opportunity budget**, approximately29.1–35.1% fewer items. Ordinary Normal theoretical equipment chance changes7.5%→5%; elite/boss/goblin opportunity counts also decrease.

Bosses still guarantee at least one Legendary/Set. The45-unsuccessful-item-roll pity rule remains; fewer equipment rolls means it can take more kills. Gold/gem/material probability formulas remain, although RNG consumption changes individual sample totals, and gem family selection now includes Pearlglass. This is not a kills/hour or time-to-first-Legendary claim. Fewer items also means fewer incidental salvage inputs, so human crafting pace needs owner feedback. Fixed story rewards are unchanged; vendors and new recipes provide directed alternatives.

The existing representative weapon/armor curves remain monotonic through70. The conservative, intentionally impossible simultaneous-affix/39-gem upper envelope exceeds the safe integer limit; it is not proof that a legal current build can reach that value. We therefore do **not** claim a natural bound for every raw intermediate or uncapped Paragon allocation. A shared technical guard saturates authoritative integer combat damage, HP, aggregate hit displays and derived estimates at `Number.MAX_SAFE_INTEGER` (9,007,199,254,740,991); ordinary finite fractions are preserved where appropriate. Extreme-input focused checks verify the guard. No big-number library is needed for the measured profiles. Future P12 growth beyond that ceiling needs an explicit representation policy. This is a documented combat saturation policy, not a wallet cap or proof of arbitrary-precision arithmetic.

## Checks and local visual review

- **18 distinct focused checks pass:** itemization7, persistedCommands3, contentValidation8. Final changed itemization subset7/7. Initial appearance test failed because its synthetic fixture lacked an equipped helmet; correcting the fixture resolved it. No full-suite or soak-test claim.
- Final `npm run typecheck`, `npm run content:check`, `npm run build` pass. Content inventory:3 classes,18 skills,42 bases,22 powers,9 sets,6 gems,26 monsters,16 zones; shared town graph validation passes. Bundle1320.44kB /427.37kB gzip; inherited large-chunk/native-config warnings remain.
- Real local Chrome on the owner's PC,1920×1080, isolated disposable `ItemPreview` save. Collection, loot rules, recipes, appearances and linked-item comparison captured and personally inspected. Appearance body727px/scroll727px; inventory784px/scroll784px. Panels and controls fit without scrolling. HUD FPS shown in captures is not a performance benchmark.
- Saved all three Rare loot toggles, reloaded and verified they remained selected; linked a legitimately owned item in the disposable local zone, opened its comparison; remote Mystic application rejected with the correct proximity message. Successful physical service mutations are covered by the server tests, not falsely claimed as a browser walkthrough.
- Initial preview seed used an invalid synthetic onboarding shape and failed login; removed that fixture field and started a new isolated data directory. This was a test-fixture failure, not observed normal-save corruption. Preview tab is closed, viewport restored, owned preview server stopped. No actual player data was used.

Screenshots: [Collection](COLLECTION-1080.jpg), [Loot rules](LOOT-RULES-1080.jpg), [Recipes](RECIPES-1080.jpg), [Appearances](APPEARANCES-1080.jpg), [Item comparison](ITEM-LINK-1080.jpg).

To reproduce only if a relevant change requires it, choose a fresh empty temporary `DATA_DIR`, clear `BACKUP_DIR`, set `BACKUP_KEEP=0`, then use `node --import tsx --test server/test/itemization.test.ts` or either audit script. Build audit requires DATA_DIR directly under the OS temp directory. Models write only their documented JSON output. Do not rerun all completed checks after context compaction.

## Removals, compatibility and future work

Removed roughly one third of stochastic equipment opportunities, not any saved item or monster definition. Replaced five borrowed material display labels with Iron Shards, Wisp Powder, Dawn Quartz, Relic Ember and Cinder Essence; persistent keys, quantities, costs and original glyphs stay. Existing item bases use descriptive terms; new powers/sets/pieces/gem names and text are original. This scoped item naming pass is **not** trademark clearance or the broader D-07 skill/zone/prose audit, which remains a release dependency.

Opt-in salvage intentionally consumes eligible bag items at the Smith and converts them using existing yields; it is disabled by default. Combat extremes now saturate rather than grow beyond the documented technical ceiling. No town, camera, skills, rewards, old set, save, account or UI-style content was deleted.

Rollback: set the equipment opportunity scale back to1; disable new entry points/generation if necessary while retaining acquired new IDs, effects, collection fields and compatible save14/protocol20 handling. Do not load new saves in an old binary that cannot preserve their fields. D066–D069 describe narrower reversible changes.

**Next implementation chapter is P12**, following its research and unresolved decisions, when the owner continues with Claude. G9 also requires P12 endgame/leaderboard evidence and independent/human acceptance. P3 authenticated ownership, social backup operations, P9 full per-band co-op, broader naming/legal review and100-player performance remain explicit outside this implementation chapter. See [Claude handoff](../../CLAUDE_OPUS_5_5_HANDOFF.md).
