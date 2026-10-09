# Task Bar Hero — R-03, first evidence pass

Read 2026-10-09. PC store overview L1; September developer patch details L2. No closed-client reward experiment or full skill-tree inspection. Claims TBH-01–04.

## Findings

The [publisher store](https://store.steampowered.com/app/3678970/TBH__Task_Bar_Hero/) lists release on 2026-05-27, live auto-play in a small window, Cube item customization, ten advertised rarity tiers and Steam Marketplace trading. These establish advertised features, not their balance or server architecture. The old dossier's 197-node rune-tree claim remains unverified. [S; TBH-STORE]

The [developer's September announcements](https://steamcommunity.com/app/3678970/allnews/?l=english) matter more than an undated fan guide for changing rules. Versions 1.2.7/1.2.8 correct locked items affecting Synthesis, including after restart. Version 1.2.4 removes an unconditional wait after each chest while retaining a quantity limit over time. October/November content is announced future work, not measured shipped content. [S; TBH-PATCH]

## Application to Hearthfall [P]

Item protection must remain meaningful across crafting, movement and save/reload. Use these reports as failure cases to investigate when a locked-item system is scoped, not as proof Hearthfall has the same bug. A small always-visible game also warrants studying information priority, while preserving our current UI style.

## Historical player-flow corroboration — 2026-10-09

[Zeroxias's guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3734611647), explicitly updated June 9, 2026, distinguishes formation-slot and second-active-slot purchases in the account rune tree from character skill investment. It reports free skill refunds, a totals-list view, and item locking before automatic Cube filling. These are useful interaction questions, not current numerical specifications. Its old chest timers are superseded by the September developer notes already logged. Claims about server overload and optimal teams are the writer's interpretation, not telemetry. Images in the guide have not yet been inspected. [S2; TBH-101, TBH-05]

The shared skill-data comment calling our escalating tier costs “Task Bar Hero-style” is inherited attribution, not independent evidence that current TBH uses those exact costs. Preserve Hearthfall's values until its own behavior and pacing are measured.

## Description versus simulation defects — 2026-10-09

The same developer feed's 1.02.01 notes distinguish displayed stat caps from an actual healing defect. Version1.2.5 reports missing damage modifiers and adds feedback while server-dependent operations load. [S; TBH-PATCH, TBH-06] This supports separate assertions for text, applied effects and pending operations; it provides no Hearthfall balance target. Our C025 probe follows that distinction and preserves measured combat behavior.

## Remaining evidence

Cube functions/costs, respec and rune topology, offline/live ratios, party rules, unlock sequence, drop distribution, Marketplace outcomes and UI flows. Reviews/CCU are not causal retention evidence. Next: match an inspected current build to developer notes, trace an initial session, and test whether rewards occur with the client closed. No purchases, Marketplace trades or account creation are implied by research permission.

C045 adds the equal-question [loot comparison](LOOT.md), including historical/source limits and Hearthfall's actual generation/acquisition paths. External rate tables and timed first-upgrade distributions remain unresolved.

## C055 — observed publisher interface examples

Four published images were inspected, covering compact combat, equipment/status/travel panes and a Ukrainian-language Cube/tooltip example. Visible locks, empty cells and selectors do not establish current protection, recipe or unlock rules; no actual operation was performed. [V; TBH-UI-GALLERY / TBH-09]

See the [UI atlas](UI-ATLAS.md), structured entries and exact media provenance. Earlier statements that no external pixels had been inspected describe the preceding checkpoint. Current-client first-session traces, fine1080p layout measurements and actual input/error flows remain open. No assets or numerical targets are adopted.
