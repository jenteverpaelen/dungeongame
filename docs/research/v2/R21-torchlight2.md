# Torchlight II PC — R-21, added by the owner

Equal first-batch coverage with the other four requested games. This charter is distinct from roadmap R-09's Torchlight Infinite. Read 2026-10-09. Publisher overview L1; historical skill design L2; final PC numerical rules Q. Claims TL2-01–03.

## Findings

Runic's [2012-07-17 developer update](https://www.runicgames.com/blog/2012/07/17/travis-with-some-torchlight-ii-updates/) describes ability access by character level, with additional behavior at invested skill ranks 5/10/15. Those ranks are not character levels, and the post explicitly predates release. It also describes encounter polishing around complementary monster behavior. [S; TL2-DEV]

The [PC publisher store](https://store.steampowered.com/app/200710/Torchlight_II/) describes four classes, pets that sell loot in town, and New Game Plus retaining progression. [S; TL2-STORE]

The [2019 respec-potion announcement](https://www.arcgames.com/de/corp-news/detail/11319233-post-launch-patch-2-quality-of-life-update-notes) explicitly targets consoles. It does not establish unrestricted respec in base PC Torchlight II. [S; TL2-CONSOLE]

## Application to Hearthfall [P]

Behavior changes at a few understandable investments could make skill tiers more meaningful than flat increases. First examine which of our current tiers already do that. A pet selling trip could reduce interruptions but would alter the physical-town service loop, which is frozen; do not implement it now. NG+ is not evidence of MMO persistence or a seasonal economy.

## PC corroboration and persistence — 2026-10-09

The [community skill reference](https://torchlight.fandom.com/wiki/Skills_(T2)) reports three trees per class, active availability at 1/7/14/21/28/35/42, passive availability at 1/7/14, and skill-rank bonuses every five ranks up to 15. These are secondary PC claims without a pinned revision, corroborating the old developer description but not upgrading its numbers to balance targets. [S2; TL2-SKILLS]

That wiki and [PC Gamer's Embermage guide](https://www.pcgamer.com/torchlight-2-embermage-build-guide/) both describe refunding only the last three invested points in ordinary PC play. They distinguish full respec through external tools/console; no such tool is downloaded or treated as a shipped feature. Source independence and current-client behavior remain open. [S2; TL2-04]

[Arc's 2019 backup guide](https://support.arcgames.com/hc/en-us/articles/360017719953-How-to-backup-and-restore-your-character-saves) distinguishes character files, restore files and the shared stash, including separate modded-save locations. This supports testing the entire ownership scope when restoring, rather than checking only a character's level. It does not establish MMO-safe storage. [S; TL2-05]

## Still unfinished

[Runic's Players data reference](https://docs.runicgames.com/wiki/Players.html), revision1914 from April17 2013, independently exposes separate graph fields for character-level and fame-level skill-point awards (TL2-09). This adds a second point-source dimension to the comparison. The page contains no graph values; do not derive total available points or compare its budget directly with Hearthfall's69 ordinary level points.

[Runic's GUTS introduction](https://docs.runicgames.com/wiki/Introduction_to_the_Editor), revision dated 2012-11-19, was read fully for authoring context. It separates content domains such as units, skills, affixes, sets and spawn pools. This supports keeping authoring concerns explicit; it supplies no runtime balance values. Hearthfall's new content checker follows its own registry consumers while retaining the current TS/JSON source of truth. [S; TL2-GUTS]

Final unmodded PC skill/rank tables, exact respec limits, first-session quest flow, loot and difficulty rates, and a visual UI atlas. Do not substitute a Torchlight I manual or console notes. Next: inspect a versioned PC class planner or footage and cross-check against shipped documentation. No game purchase is required for public-source research.

## Base game, mod provenance and authoring — 2026-10-09

[Runic's GUTS release](https://www.runicgames.com/blog/2013/04/01/guts/) separates its content editor from external art/audio creation. It describes mod history and disabling-mod effects, and explicitly limits the tool to Torchlight II content. Developer longevity expectations are not a causal outcome study. [S; TL2-GUTS-RELEASE]

The [developer modding overview](https://docs.runicgames.com/wiki/Modding_Overview.html), revision1866, separates original content, edited copies and packaged metadata. Conflicting assets resolve by mod priority. This is a useful provenance model, not an authoritative MMO design. [S; TL2-MOD-OVERVIEW]

A [2013 Workshop listing attributed to Runic Games](https://steamcommunity.com/sharedfiles/filedetails/?id=135164919) advertises vendor respec potions as a mod. It does not establish unrestricted respec in the base PC game. No subscription/download occurred; contradictory generic page banners and user comments do not establish current compatibility. [S; TL2-RESPEC-MOD, TL2-06–08]

C045 adds the equal-question [loot comparison](LOOT.md), including historical/source limits and Hearthfall's actual generation/acquisition paths. External rate tables and timed first-upgrade distributions remain unresolved.

## C055 — observed publisher interface examples

Four publisher images were inspected: three PC-style HUD/world scenes and one decorative character/pet image excluded from control evidence. Companion controls, shortcut labels and NPC markers are visible. These unversioned gallery frames do not prove final unmodded PC defaults or any service outcome. [V; TL2-UI-GALLERY / TL2-13]

See the [UI atlas](UI-ATLAS.md), structured entries and exact media provenance. Earlier statements that no external pixels had been inspected describe the preceding checkpoint. Current-client first-session traces, fine1080p layout measurements and actual input/error flows remain open. No assets or numerical targets are adopted.
