# Written ground-loot quality — C049

2026-10-09. L60 and [design](LOOT-LABEL-DESIGN.md) precede code. This is a bounded F-SET-03 improvement, not completed accessibility or item-UI coverage.

## Behavior and evidence

Settings → Sound & comfort now has **Show loot quality**, default off. Enabling it adds written Normal/Magic/Rare/Legendary/Set and Ancient/Primal Ancient Legendary/Set labels to ground items, using nine complete catalogue templates. Existing visible drops update on the next label-layout pass; replaced text/background objects are destroyed. No per-item setting subscription or rebuild on unchanged frames. Eleven added messages bring this English catalogue to134keys.

The setting persists in the existing browser preference record; missing/invalid older values default off. Item names/metadata, colours, font, borders, beams, sounds, overlap algorithm, drop/pickup behavior, save/protocol rules, town and fixed620 camera stay unchanged. Unknown rarity is not guessed. Gems/materials and non-item loot retain their existing behavior. Nothing is deleted; optional text supplements the existing presentation.

Research: [GAG colour guidance](https://gameaccessibilityguidelines.com/ensure-no-essential-information-is-conveyed-by-a-fixed-colour-alone/) allows supplementary text through a setting. [XAG103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103) distinguishes colour redundancy from nonvisual access and player testing. The [DiabloIV gear-audio article](https://news.blizzard.com/en-gb/article/23954932/combatting-demons-with-accessibility-in-diablo-iv) is a launch-era example of additional information channels, not evidence for our exact text implementation or its current patch behavior.

## Verification on the owner's PC

- Typecheck, seven preference/catalogue tests, content check and build pass. Targeted isolated root: `hf-loot-labels-check-b0d5bd1d98a2426e820bfa68e10675c1`. Legacy/invalid values, enabled round-trip and reset preserve other preferences.
- Actual installed Chrome154.0.8037.99,1920×1080,DPR1,visible document, fresh synthetic profile/save. Baseline root `hf-loot-labels-5qEuXf`; final root `hf-loot-labels-K1N3JF`. [Before trace](checks/loot-labels/before/trace.json), [after trace](checks/loot-labels/after/trace.json).
- Twelve controlled renderer views cover nine quality states, a gem, a material and a deliberately long test name. Default text/tints/dimensions/child counts equal the baseline exactly. Actual mouse/keyboard setting controls update existing views. Five off/on cycles keep two label children per view. Reconnect/new views retain the setting; Restore defaults clears it and restores original text. No runtime exceptions observed.
- The twelve-label cluster stays within the viewport and has no intersecting label rectangles in this fixture. All seven final/baseline1080p screenshots were personally inspected. Existing colours, item art and panel style remain; the new checkbox/note fits inside the existing panel. Existing player/NPC nameplates can still intersect ground labels; this change does not redesign that layout.

The first after run failed at reset because the harness had stopped the ticker and asserted before a manual layout pass. [Pilot trace](checks/loot-labels/pilot-trace.json), root `hf-loot-labels-rQYKB6`, is preserved. Adding the same explicit layout step used after toggles fixes the harness; no extra runtime change was needed. The corrected complete run passes.

No earned drops, multiplayer throughput, GPU-memory leak proof, full colour-vision/contrast simulation, screen-reader access or human usability is established by this presentation fixture. Font size/colours are inherited, not newly certified. More extreme piles, screen edges/smaller viewports, bag/stash at-a-glance cues and nonvisual alternatives remain open. The scoped client checks/build/browser flow are new evidence; C046's full server run is separate historical evidence.

Rollback removes the preference/control/templates/renderer branch together; old clients ignore the extra boolean and character saves need no migration. Keep the test evidence and unfinished-work record.
