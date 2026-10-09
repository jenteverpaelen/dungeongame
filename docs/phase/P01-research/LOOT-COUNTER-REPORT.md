# Boss fallback and loot-history counter

2026-10-09, C046. Plan: LOOT-COUNTER-PLAN.md; evidence before implementation L57. Node24.19.0 on the owner's Windows PC. No real saves opened.

## Reproduction and correction [M]

The actual generator returned inconsistent history in48 of6,528 seeded batches. Every mismatch came from the boss-floor path. Example: Mage/L1/Normal, initial pity17, seed15 generated five misses followed by the guaranteed Legendary, yet returned22. The ordinary contract requires0 after that last success. Two of four new regressions failed before the correction; the two unchanged-behavior controls passed. Raw before test output is retained.

One assignment now resets pity when the fallback item is appended. It does not reset every boss batch. Seed1 produces three misses after its last natural Set and still returns3. Empty normal-monster batches preserve the existing counter; a45-miss streak still protects the next actual equipment roll. Counter comments now explicitly include Sets. The branch's unsupported “D3 guarantee” attribution was replaced with a description of Hearthfall's actual rule; the guarantee itself remains.

## Repeated evidence [M]

| Run | Isolated temporary root | Batches | Counter mismatches |
|---|---|---:|---:|
| Before | hf-loot-counter-iBzoYe |6,528|48|
| After | hf-loot-counter-dD1xxr |6,528|0|
| Repeat | hf-loot-counter-1chKOi |6,528|0|

Every generated payload and RNG continuation is identical before/after: SHA256 `c178c9839aa089270c33142fcd306a142d594d55e44212de689f14fddaa97fc8`. Generated item IDs are replaced with a marker only in the comparison because their process-global suffix is unrelated to properties; all other fields are included. Complete after observations including counters repeat with SHA256 `803f7e3594d9e1427edb800f38379070adfb78be8d9f57a8d58d69b5a1555049`. Actual game IDs are unchanged by the fix.

Probe output: checks/loot-counter-{before,after,repeat}.json. Strict standalone harness typecheck passes. Regression pre-fix DATA_DIR: hf-loot-history-before-48341a58aedc4afb96d0db60dba3b40f. All19 strict verification stages pass (21 shared tests including4 loot-history regressions;747server/382simulation). Evidence: checks/loot-counter-verify.json, root hearthfall-verify-Nyye0f. Existing bundle-size and future Vite native-loader advisories remain. No visual UI/rendering change; no screenshot or frame-rate claim.

## Scope and future effect

No drop probability, threshold, source count, generated reward, crafting price, town, camera or UI changed. Corrected history **can change a later pity-triggered drop** after a fallback reward; claiming future loot sequences are unchanged would be false. Already acquired rewards are never removed. Existing saved counters are not retroactively reconstructed because their historical drops are unavailable. No schema migration.

These finite fixtures isolate existing branches;48/6,528 is not a live-world bug incidence or boss probability. No kill-time, pickup, full-bag, useful-upgrade, fairness or balance target follows. The live server already stores the generator's returned pity; this correction changes that return consistently. It does not add transactional persistence. Rollback removes the reset and regression assertions, reinstating the defect; retain this evidence.
