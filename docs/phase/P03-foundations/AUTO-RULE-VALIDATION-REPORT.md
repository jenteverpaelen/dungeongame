# Automatic-cast validation — measured result

C069, 2026-10-09, owner's Windows PC, Node24.19.0, solo. [Plan](AUTO-RULE-VALIDATION-PLAN.md), L80, [reproduction](../../../scripts/audit-auto-validation.ts).

The content checker previously accepted all16 synthetic invalid-rule fixtures; it now rejects all16 with exact skill/field paths. The unchanged authored registry passes both times and retains SHA256 `c7bb33613d73ba5a3ee60e3a8c31373a8f2f09011f99ec28b35be4a61585e7ab` for its JSON-serializable data. Function bodies are outside that hash; no authored file changed. [Before](checks/auto-validation/before.json), [after](checks/auto-validation/after.json).

| Actual single-tick brain probe | Ordinary rule | Synthetic NaN rule |
|---|---|---|
| Meteor with one nearby target and enough resource | Cast starts; resource100→60 | No cast; resource stays100 |
| Whirlwind with10 resource, below its authored25 start threshold | No channel | Channel starts despite that threshold |

These results are identical before and after the patch: runtime casting is unchanged. The new check prevents such authored values passing the build gate. No current skill was found to contain them. Fixture quantities are test inputs, not new balancing targets. NaN/infinity/negative values are checked for enemy count, enemy query distance, channel resource threshold and channel query distance. Finite zero,fractional and above-base thresholds remain legal, as do signed modifier reductions.

The first probe pilot mistakenly treated a cooldown entry as a cast receipt. Meteor has zero cooldown, so that observer failed on ordinary behavior. The corrected probe suppresses primary attacks and checks the actual attack sequence; channel state is checked directly. This was a harness correction, not a game fix or an excluded failed gameplay case.

Seven targeted content tests pass, including the two new regressions. Standalone strict TypeScript for the probe passes. [Full verification](checks/auto-validation/verify.json) passes all20 stages:23 shared tests,756 server checks and382 simulation checks, plus remaining focused suites,typecheck,content/routes,licences and build. Every stage used its own isolated DATA_DIR with backups disabled. The existing Vite native-loader/chunk-size warnings remain; they are not browser/performance acceptance.

No visual code changed and no new browser observation is claimed. No real save was read or written, no network game server was started by the probe, and no asset/dependency was downloaded. The full verification's own servers used synthetic data. The town,UI,camera,characters,rewards and current skill values remain unchanged.

Scope limits: the typed validator is not an untrusted JSON parser, proof that every behavior flag is implemented, or complete combat/balance coverage. Future editor output must still satisfy the same contract. Remove only the validation/tests to revise this policy; no data migration or content removal is involved. Continue the broader roadmap and researched item-lifecycle protection work.
