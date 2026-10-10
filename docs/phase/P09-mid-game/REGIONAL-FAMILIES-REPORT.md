# C100 — Regional enemy families and field difficulty correction

2026-10-10. L120 / D058, plus correction to L119/D057.

Two original code-drawn families now inhabit the authored salt/cliff regions: Saltglass Skimmer (segmented body, antennae, paddling legs and tail) and Rimehorn (shaggy forequarters, split hooves, horns and lowered-head charge pose). Cached body-part rigs support the existing walk/attack/windup, hit flash, elite rim and death rendering. No external art assets or copied game silhouettes were used. NPS/California Water Board habitat references motivate original fantasy ecology, not realistic size or aggression.

Six skimmers replace selected repeated crab bodies in Sablefen, Saltwind, Lockglass and Beaconbreak. Three rimehorns replace a boar and two repeated moth members in Shiverline/Beaconbreak. The22 sites/84 mid-game members and all quest-target IDs remain. Both types have zero random spawn weight. Skimmers inherit Brineclaw's cold lob and footprint; rimehorns inherit Siltusk's physical charge and footprint. This grows the26-type roster to19 supported body families, including bosses. All old types and saved discovery IDs remain; changing a pack member does not delete its former definition.

## Difficulty audit correction

C099 only traced instance creation; fields can re-level individual mobs from a nearby player's saved preference. This contradicted its baseline assertion that authored fields were already Normal. The shared encounterDifficulty helper now covers field spawn/respawn, dormant wake-up and debug population. Authored fields use Normal; existing procedural training fields retain the player's valid choice; private instances retain their creation setting. C099's new private story instances are already created on Normal. The earlier report is explicitly corrected.

## Checks and limits

- Four existing mid-game cases pass after roster changes: shared collision/reachability, all-class reward budgets, actual13-quest/dungeon command completion and boss phases.
- Two focused cases pass: actual wake-up/relevel for every authored field and the procedural control; inherited attack/footprint budgets and placement of both new families. The wake-up fixture runs the real monster update routine without auto-attacks, preventing premature fixture target death; it is not a complete combat playtest.
- Typecheck and production build pass. Main bundle1,282.34kB /416.57kB gzip, existing warnings. All runtime checks used fresh isolated DATA_DIR with backups disabled.
- Local Chrome1920×1080: inspected24 preview actors (idle/moving/attacking across four tier displays). The development gallery spacing was widened to separate taller silhouettes. REGIONAL-FAMILIES.jpg is an art preview; its throttled gallery FPS is not a game/multiplayer benchmark.

Rollback restores the nine old member IDs while retaining new definitions for save compatibility. The difficulty correction is independently reversible; no wallet, item, quest, town, camera or UI-style change. P9 remaining implementation evidence: per-five-level combat/stall reports, then P10 party identity before2–4 player acceptance. Human feel and independent gates are not certified.
