# Quest authoring experiment — C051

2026-10-09. L62 precedes implementation. This is an isolated authoring probe; no production schema, dependency, quest, NPC, reward, UI, save field or quest policy is adopted.

## Evidence and comparison

| Approach | Read evidence | Fit and missing work |
|---|---|---|
| Current typed TypeScript data | Existing contentValidation/check-content; C041 action probes | Matches repo tooling. Extend only after testing a narrow contract. No live objective journal or dialogue command exists |
| ink | [Runtime guide](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/Documentation/RunningYourInk.md): story save API, wrappers, runtime errors and external effects. [Writing guide](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/Documentation/WritingWithInk.md): conditional/consumed choices and variable targets | Expressive authoring; general logic needs runtime coverage. Game reward authority and atomic saves remain integration work. No package or language selected |
| Yarn Spinner | [Godot3.2 variable-storage guide](https://yarnspinner.dev/docs/godot/gdscript/05-connecting-to-your-game/04-variables-and-storage/), variables through saving/loading | Supports shared game/dialogue values; described variable save omits dialogue position. Godot API is not a demonstrated TypeScript integration. No download or dependency selected |

## Experiment contract [inference]

Use three explicitly synthetic quest records and one original branching dialogue, as requested by Claude P5's fixture scope. All quantities are fixture inputs; no kill count, reward rate or unlock level is proposed. IDs and message keys are separate. Check all eight objective shapes against a synthetic capability catalogue, NPC/service pairs, targets, messages, integer quantities, rewards and all-required quest prerequisites. Detect cyclic prerequisites without assuming a future repeat/party policy.

Dialogue choices have stable IDs, targets and optional conjunctions of declared boolean facts. Facts remain fixed throughout this probe; choices are reusable and have no side effects. Each caller supplies states to examine. For each state, check reachable nodes and whether each has a path to a terminal. Reject missing targets, conflicting conditions, unreachable authored nodes and loops with no exit. Allow a loop with an exit. Return an explicit result for only the supplied states, never a blanket finishability claim.

The key adversarial case has a visible graph path to a terminal that a false condition removes. Compare unconstrained graph acceptance with state-aware refusal. Enumerate every boolean combination for the small fixture, and test independent malformed definitions. Preserve failed pilots if any. Typecheck this standalone module and execute tests under a fresh DATA_DIR with BACKUP_DIR cleared. No screenshots are needed because no browser or game presentation changes.

## Adoption limits and rollback

This experiment deliberately cannot evaluate mutable flags, consumed choices, item consumption, external scripts, unreachable world positions, spawn availability or reward commitment. A catalogue entry does not prove an action can occur. Current rifts have difficulty, not a separate rank; the fixture uses the existing term. Production P5 still needs versioned durable state/event contracts, migrations, party/abandon/repeat rules, trusted talk/delivery/wave handlers, localized screens, replay/crash tests and content review. The existing town and UI style remain fixed. Rollback removes the independent experiment; historical evidence remains. No content is removed.
