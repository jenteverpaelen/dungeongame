# Existing loot-counter contract

2026-10-09, C046. L57 precedes code. The current comment and ordinary-roll behavior define a counter of equipment misses since a Legendary or Set. The appended boss guarantee is a suspected missing transition. This is a prospective correctness correction, not a balance proposal based on another game's rules.

Probe actual `rollDrops` across all classes, levels1/70, difficulties0/6, all six source tiers, seeds and initial counters0/44/45. Boss samples use initial17 to avoid a forced pity success before the floor branch. Those fixture values exercise existing boundaries; they are not new gameplay values. Capture counter mismatches, all payload hashes with generated IDs omitted, RNG continuation and selected examples. Before and after must generate identical current payloads and consume identical RNG draws. Future calls may differ because the corrected history feeds the existing pity rule.

If confirmed, reset only when the boss's fallback Legendary is actually appended. Preserve natural batch tails, zero-item calls, ordinary threshold behavior and all rates. Clarify counter comments to include Sets. Add regression tests for those contracts and run the full isolated verification command. No UI/rendering changes are planned; browser imagery cannot validate an invisible random-history counter.

No save migration or retroactive recomputation: existing counters have no retained drop history. Current stored values continue until future ordinary transitions. No reward is deleted, refunded or retracted. Rollback is the one branch assignment and tests; reversing it reinstates the inconsistent counter. Account transactions, general loot tuning and first-upgrade pacing remain separate work.
