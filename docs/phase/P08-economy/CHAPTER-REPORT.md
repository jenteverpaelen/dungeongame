# P8 — Economy v1 implementation inventory (C090–C095)

**Selected v1 implementation complete; human/operational acceptance pending.** Owner explicitly allows savings, existing-style UI, research-backed decisions, and continuing the roadmap while they defer full playtesting. This is not a claim that G6 or the entire roadmap is complete.

|Claude scope|Implemented/decided now|Later dependency or acceptance|
|---|---|---|
|F-ECO-01 vendor|Four physical merchants; exact normal stock, buy/sell/retained buyback, ownership/proximity/sequence/provenance, non-scrolling previews|Stock cap grows with P9 content; human spending feel|
|F-ECO-02 sources/sinks|Full currency map, actual saved operation accounting, drop/offline/recipe distributions; C092 researched basic prices; no further unsupported retuning|Observed active gold/hour and longer soak|
|F-ECO-03/04/06 optional sinks|Explicitly exclude repair/durability, consumable upkeep and gamble shop from v1; existing globes remain|Reopen only with measured need, not a fake implemented feature|
|F-ECO-05 artisans|Physical role/proximity gates and existing shared Cube progression retained by D25|P11 further crafting breadth; no separate artificial artisan currencies|
|F-ECO-07 binding/flags|Bind on equip/improvement; protection enforced on destructive paths; provenance prevents stock salvage; custody preserves flags; bound gear can sell to NPC|Player trading/account-transfer policy belongs to P15/P14|
|F-ECO-08 stash|Approved60 slots per character; custody/persistence/physical proximity and UI already implemented|Expansion/account tabs deliberately reserved for P14; no new storage fee|
|F-ECO-09 currencies|Gold, five materials and five gem types/ranks documented; no new currency|Later systems must justify additions|
|F-ECO-10 dashboards|Paged live per-character balance/source/spending history plus deterministic developer distributions|No global remote player-data collection|
|F-SAV-05|Persisted request/outcome, whole-character commit-before-ack, saved paid choices, replay/concurrency/process-restart evidence|Power loss, backup rewind and multiple independent writers not certified|
|F-TEL-03|Actual drop/recipe/affordability tools with assumptions and explicit outputs|Player-time calibration remains human evidence|

Evidence: [stock](STOCK-REPORT.md), [currencies](CURRENCY-MAP.md), [history](HISTORY-REPORT.md), [transactions](TRANSACTION-REPORT.md), [balance](BALANCE-REPORT.md). Each records its own measured checks; no need to replay them at every checkpoint. C095 model assertions passed; it changes no runtime game code or UI, so no redundant game build/screenshot run was needed.

P8 choices D20/D22/D24/D25 and L112–L115/D050–D053 are recorded. The original roadmap remains unchanged. No content/gear/saves deleted. New command/history state must be preserved when rolling back UI/features. Continue P9 mid-game with its own research/design before code, keeping human G6/independent review open.
