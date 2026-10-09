# Automatic-cast authoring validation

C069 plan, 2026-10-09. Evidence recorded first in L80. No existing skill is accused of having an invalid rule. The measured question is whether `content:check` permits numeric values that the actual brain cannot interpret as their authored threshold.

1. Use fresh isolated DATA_DIR, disabled backups and synthetic level70 players in generated field instances. Read no player saves and start no network service.
2. Record the current content hash and validator result. Mutate cloned definitions only: NaN/infinite/negative weighted counts, distances and channel resource thresholds. Exercise real `playerBrain` for ordinary versus NaN Meteor count and Whirlwind start threshold; separate fixture inputs from proposed balance values.
3. If the gap is reproduced, validate those numeric rule fields in the existing semantic checker. Finite values must be nonnegative. Keep zero/fractional counts and resources valid; distance zero can describe point-blank intent. Do not cap thresholds by current base stats or add a rule/kind restriction. Optional future authoring policies require a separate decision.
4. Test every field with NaN, both infinities and a negative value; test valid boundaries and unchanged current registry. Keep modifiers' existing signed semantics. Run relevant shared checks, strict typecheck, content validation and the standard verify gate.

Expected effect: reject an invalid future content edit before release with a definition/field path. No runtime branch, authored value, UI/camera, town, save, reward, timing or art change. No download/dependency. This remains a typed semantic validator, not a general untrusted JSON parser; behavior flags, effective build balance, trigger discoverability and all other content semantics are outside this patch. No new browser visual claim is needed for a validator-only change; the live UI is untouched.

Removal/rollback: no content removed. Revert only the new validation/tests if its contract is revised; the unchanged runtime/data need no migration. Keep the reproduction and explanation. Future authoring tools should call the same content gate, not assume TypeScript's `number` excludes nonfinite values.
