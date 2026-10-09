# C091 campaign budget and content decision

2026-10-10. Owner explicitly chose story progression without required repeat runs. This is an implementation budget, not a measured human completion-time or difficulty target.

## Measured inputs

The existing curve is round(120 * level^2.6 + 300 * level) XP per level; default server kill XP multiplier is3. C070/C071 historical input runs ended the first/second areas at levels4/7. Existing class unlocks include levels9 and12. The original three authored areas have5/4/3 encounter sites, with ordinary groups of4–6. Pumpworks rooms are640 units across; Bracken's bridge is230 units wide. Camera height remains620 and hero height approximately64. These dimensions set the reusable unit; no reference screenshot supplies a world-unit measurement for these new areas.

| Completed story quest | Conservative level floor from story XP alone | Cumulative curve XP | Added one-time XP |
|---|---:|---:|---:|
| Silent Wheel |3|1748|1748|
| High Water |4|4736|2988|
| Under the Spillway |7|34185|29449|
| Pressure Below |9|84327|50142|
| The Stone Road |12|238633|154306|
| Fires Without Keepers |16|677753|439120|
| The Last Draw |20|1524432|846679|

These are ordinary fixed XP awards through the existing atomic quest transaction, not a replacement XP curve or a dynamic level-setting system. Kill XP is additional; actual exit levels can exceed this conservative floor. Awards are not multiplied by difficulty/dev kill-XP bonuses. Contracts remain gold-only. No reward is retroactively reopened; claimed records remain claimed. Previously earned route access wins over a newly displayed minimum band, so older characters are not locked out. Historical low-level completed saves do not receive automatic backpay; their remaining story awards still grant normal XP. This compatibility boundary is explicit, not a claim of new-player calibration for every old save.

## Authored content units

Six destinations: Rillwake1–4; Bracken4–7; Pumpworks7–9; Cairnspill Terraces9–12; Cinderwash Kilns12–16; Kilnwatch Crown16–20. This is the tutorial area plus five frontier destinations, including the existing small dungeon, within Claude's provisional3–5 frontier-unit range. Add three connected authored fields, one original story quest/record per field, physical contacts/exits,4/4/3 encounter sites, original props/ambient sites and validated routes. Existing procedural fields remain available and unchanged. A route through quarry terraces, firing yards and a final kiln platform follows the researched material/work flow, not a copied map.

Novelty: Rillwake's Reedclaw landing circles; Bracken's Siltusk charge/Keeper; Pumpworks gains a winged fan shooter; Terraces introduces a beetle that fractures a fixed line of ground; Kilns introduces the campaign's first fire/exploding group and authored affix combinations; Crown introduces a furnace guardian alternating marked fracture lines with projectile rings. No reward-bearing summoned adds. Existing creature budgets are reused: fan inherits Thornling and divides one hit among3 projectiles across the existing ranger70-degree fan; fractures reuse the3-shell mortar's75-radius/900ms warning/120ms stagger template, arranged on a fixed aim line rather than random landing points. Beetle uses the Reedclaw budget and divides its damage among3 impacts. New faulted elite trait reuses the existing mortar budget/cooldown; it is authored-only so procedural/rift random affix probabilities stay unchanged. Boss uses the existing rare Magma Brute budget and Keeper timing/enrage, with alternating fracture/ring mechanics.

Art remains original code-drawn, existing warm ink and three-tone palettes, no imported assets. Moth/beetle rigs use existing trash silhouette dimensions. Ashen authored surfaces use the existing Ashen palette; kiln volumes share exact footprints with collision. No town or hero changes. Terrain, ambience and NPC/quest data are the source of truth. Menus use columns/tabs/pages as the world list grows.

## Verification scope and remaining acceptance

Check authored reachability/spawns, XP arithmetic/all-class claims, old-save access, attack aim/collision/cancellation, legal affixes and build/type safety. Brief real Chrome1920×1080 art/map views on the owner's PC; no long repeated playtesting. Human pace, all-class feel, economy/drop bands, independent review and G6 remain open. Count content units from data and report actual checks; do not claim a human-hours budget from bots.

Removal/rollback: replace the Pumpworks' single east-chamber Thornling with the fan shooter at the same spawn/budget; no other existing creatures or areas deleted. Roll back new content by retaining its saved quest definitions/history and closing new offers, not erasing characters/items or resetting claims. Restoring prior XP definitions affects only future unclaimed rewards. Preserve old route compatibility and never replay paid rewards.
