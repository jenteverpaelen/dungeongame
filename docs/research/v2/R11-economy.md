# R-11 — Economy and trading

Read 2026-10-09. Partial L2. Economy precedents are not recommended tax rates.

[OSRS-TAX1](https://secure.runescape.com/m=news/grand-exchange-tax--item-sink?oldschool=1) distinguishes a currency tax from a system that spends part of tax receipts to buy and remove selected items. It describes rounding, caps, exemptions and monitoring. It also documents reconfirmation delay after a direct trade changes.

[OSRS-TAX2](https://secure.runescape.com/m=news/yama-cas--more?oldschool=1) raises new-offer tax from 1% to 2%, preserves the old rate for existing offers, and attributes the change to currency creation outpacing removal. That explanation is developer-reported; actual inflation improvement has not been measured here.

PoE's older no-gold overview conflicts with its 3.26 core Settlers notes (POE-OVERVIEW/POE-326). TBH's item-lock fixes (TBH-PATCH) show why protection flags must survive restart and apply to every destructive operation.

## Hearthfall inference / decision boundary

First measure currency creation and destruction by operation; inventory transfer is not destruction. Any future trade needs authoritative ownership, atomic exchange, replay protection and consent invalidation when terms change. Do not add a marketplace before those foundations, or impose a tax copied from another economy.

## Charter gaps

WoW and D2R binding/trading, public anti-dupe/RMT reports, TBH fee rules and measured binding effects remain unresolved. The initial source/sink map of Hearthfall must be based on code paths, including AFK and crafting, not a generic MMO diagram.

## Local rules inventory and probes [M], 2026-10-09

[ECONOMY-REPORT.md](../../phase/P01-research/ECONOMY-REPORT.md) now maps actual grants, consumption and transfers. Sixty deterministic offline cases, fifteen cost fixtures and a Fortune-aware upgrade expectation are recorded separately from player rates. Offline uses a fixed assumed 15 kills/minute; normal versus higher difficulty and pure weapon-DPS changes do not alter those rewards. Comments were corrected, not rewards. Enchant payment/selection semantics, action frequencies, pickup losses and active/idle fairness still need observation before tuning. The generic salvage XP field differs from the actual rarity-specific handler; future tooling must preserve that distinction.

C045 adds the equal-question [loot comparison](LOOT.md), including historical/source limits and Hearthfall's actual generation/acquisition paths. External rate tables and timed first-upgrade distributions remain unresolved.
