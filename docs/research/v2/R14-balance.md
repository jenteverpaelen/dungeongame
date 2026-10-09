# R-14 — Build systems and balance math

Read 2026-10-09. Local reproducible baseline exists; external target values are unresolved.

[IDLE-MATH](https://www.kongregate.com/en/pages/quest-for-progress-the-math-of-idle-games), Anthony Pecorella's conference companion, describes progression models and threshold bonuses that change the best investment. It explicitly limits what its models can establish about a complete game. The linked workbooks/full talk have not been inspected, so no formula is attributed to them here.

The local audit is L4 evidence of current code, not desirable pacing. Read [ROADMAP_ERRATA](../../design/ROADMAP_ERRATA.md): difficulty labels, item yield versus rewarded kills, and the assumed kill rate matter.

## Method before changing values

1. Inventory actual multiplicative/additive power sources and eligible loot pools.
2. Compare unassisted fresh characters, ordinary rares and deliberate endgame sets separately.
3. Record kill time distributions by enemy rank, travel/downtime, resource starvation, deaths and skill contribution.
4. Model proposed changes with seeded runs, then seek human observations; bot survival is not enjoyment.
5. Preserve saves and item identity; document effects on existing builds and reversibility.

These are proposed local methods, not borrowed success claims. No level cap, XP curve, set multiplier, drop chance or target TTK changes in this pass.

## Remaining

Full local formula inventory, sensitivity analysis, source-verified reference formulas, player timing and build choice quality. Existing simulations reveal large set/rare differences but do not alone establish what to nerf.

## Existing tiers/runes, 2026-10-09

[BUILD-REPORT.md](../../phase/P01-research/BUILD-REPORT.md) records all 54 tiers and 54 runes, 288 runtime-helper combinations, affordability and point/refund conservation. It distinguishes helpers and lexical flag consumers from actual combat execution. All-tier cost72 exceeds level-earned69; that is an existing constraint, not a proposed shortage. Description/runtime differences are queued for focused probes; no balance value changes.
