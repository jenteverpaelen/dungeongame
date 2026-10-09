# Path of Exile 1 and 2 — R-04, first evidence pass

Read 2026-10-09. Separate games and version histories. Overview L1 and patch details L2; newer indexed versions and rule changes are recorded in [VERSIONS.md](VERSIONS.md), claims POE-05/06 and POE2-03/04/05. Installed builds remain Q; C060/C061 add separate historical PoE1/PoE2 onboarding pixels;current behavior and comparable timing remain incomplete.

## Findings

PoE1's [official overview](https://www.pathofexile.com/game) describes skill/support gems in equipment sockets and a shared passive tree. Its no-gold economy description is stale: [3.26.0 core Settlers notes](https://www.pathofexile.com/forum/view-thread/3787013) explicitly include monster-dropped gold and its uses. An official URL is not sufficient proof of current rules. [S; POE-OVERVIEW/326]

[PoE1 3.0.0](https://www.pathofexile.com/forum/view-thread/1930316/filter-account-type/staff) introduced help pages unlocked through play with integrated tutorials. This is evidence of a teaching pattern, not its success rate. [S; POE-300]

[PoE2 0.3.0](https://www.pathofexile.com/forum/view-thread/3826682/filter-account-type/staff) removed the one-copy-per-character support restriction and introduced support tiers. Failing a support's attributes disables that support instead of the whole skill. Neither older launch constraints nor PoE1's equipment model should be silently attributed to the other game. [S; POE2-030]

## Application to Hearthfall [P]

Separate the player's active skill from optional modifiers, and make unavailable modifiers understandable. Our runes already provide a smaller build-choice surface [M; HF-AUDIT]; adding a huge tree is not automatically an improvement. Reuse existing panels for any future explanations. Currency/trade changes need their own economy and persistence research.

## Respec distinctions — 2026-10-09

The [October 2025 Keepers FAQ](https://www.pathofexile.com/forum/view-thread/3870059) describes free Genesis-tree refunds, a boss-conditioned free Bloodline replacement, and separate paid point refunds. This demonstrates why “PoE respec cost” is too coarse a field: the subsystem and version belong beside the rule. It does not settle the current normal passive-tree economy, and it says nothing about PoE2. [S; POE-04]

## Still unfinished

Both games need versioned first-ten-level traces, recovery/respec rules, loot-filter and inventory error flows, and separate ownership/reset tables. Economy policing, maps/Atlas and public anti-abuse evidence remain out of this pass. Next: source the current versions, then inspect gem acquisition/equipping/invalid-support recovery without conflating their implementations.

## PoE2 build feedback, 2026-10-09

The historical 0.4.0 UI section says equipped-skill compatibility is shown while hovering a support in gemcutting. Its bug-fix section reports mismatched effect/visual behavior and partial-cost benefits. These are useful questions for an actual rules/UI audit, not proof that similar Hearthfall bugs exist (POE2-02). Read scope excludes most numerical balance tables; no claim that December2025 notes are the current October2026 build.

C045 adds the equal-question [loot comparison](LOOT.md), including historical/source limits and Hearthfall's actual generation/acquisition paths. External rate tables and timed first-upgrade distributions remain unresolved.

## C055 — observed publisher interface examples

Three PoE1 and four PoE2 published images were inspected separately. PoE1 action/status groups and PoE2 map/combination/boss presentation now have pixel evidence. Capture builds, inputs, timing and errors remain unverified; no cross-game flask, gem or recipe rule is inferred. [V; POE1-UI-GALLERY / POE-09; POE2-UI-GALLERY / POE2-09]

See the [UI atlas](UI-ATLAS.md), structured entries and exact media provenance. Earlier statements that no external pixels had been inspected describe the preceding checkpoint. Current-client first-session traces, fine1080p layout measurements and actual input/error flows remain open. No assets or numerical targets are adopted.

## C060 — PoE1 recorded early decisions

[DutchSideQuest's Act1 recording](https://www.youtube.com/watch?v=RlQ_Gi6xg9s), published March3,2026, adds21 sampled frames,seven atlas entries and claims POE-10–14. It exposes equipment/gem versus action details,contextual passive/stash help,an explicitly unconfirmed point,quest/map continuity,reward choice and vendor preview. Final class,build,account history and claimed unedited/first-ever conditions remain unknown; tab entitlement and source timing cannot be inferred. Current-rule and support-error coverage remain unfinished.

The passive selection says it is unconfirmed and offers Apply Points/Cancel. Reward choice beside inventory and later bag/action icons are different states. Neither closing a pane nor a later icon proves a saved transaction. March matching-colour instructions predate3.29 and must not replace POE-05. No numerical or gem-system design follows. See TIMELINES.md and TIMELINE-FRAMES.json; PoE2 remains a separate research row.

## C061 — separate PoE2 modifier evidence

[WolfheartFPS's Mercenary recording](https://www.youtube.com/watch?v=qN7wlatdCYg),live-stream publication December7,2024,adds22 sparse frames,nine atlas entries and claims POE2-10–14. Skill gemcutting,skill rows and support selection/association are separate screens. Selecting a different existing skill changes suggestions;tooltips show applicability,attribute requirements and both benefit and penalty. A later Skills row identifies the support and changed capacity usage. No actual insertion,computed effect,invalid-support recovery or persistence is verified.

The written duplicate-support prohibition predates0.3 removal,0.4 compatibility-hover and0.5.5 gem previews. Creation/chapter mismatch,store browsing,presenter obstruction and changing decoded resolution limit timing/geometry claims. Quest offer/vendor affordability are additional observations,not tested operations. No gem system,giant tree,monetization or numerical target is imported. See TIMELINES.md;current-client support recovery and first-ten-level traces remain unfinished.
