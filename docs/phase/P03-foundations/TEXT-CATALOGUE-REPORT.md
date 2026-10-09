# Settings text catalogue — C047

2026-10-09. Evidence/design: L58 and [TEXT-CATALOGUE-DESIGN.md](TEXT-CATALOGUE-DESIGN.md). This bounded part of F-CON-02 preserves the approved English UI; it does not complete localization.

## Change and reason

Move Settings and keyboard-binding prose/accessibility labels into123 semantic English keys. Eleven actions each keep eight context-specific complete messages. Their repetition is deliberate: translated action labels need not fit the same grammatical slot in every sentence. Only the assigned physical-key label is a runtime string parameter. The two layout explanations also remain complete messages. This follows W3C guidance on [string reuse](https://www.w3.org/International/articles/text-reuse/) and [composite messages](https://www.w3.org/International/articles/composite-messages/index.en.html).

Typed callers reject unknown keys and missing/extra parameters. The content checker validates catalogue coverage, nonempty values, braces and placeholder identity. Substitution is one pass into plain strings; runtime braces, dollar signs and markup remain literal. This intentionally limited helper is not [Unicode MessageFormat2](https://messageformat.unicode.org/docs/quick-start/), a plural formatter or an HTML renderer. Actual translation/plural/gender/number support will require a standard formatter assessment and language/layout review.

Inline copies moved; no message, action, game content or system was deleted. Action IDs, key codes, local-storage keys, percentages, input behavior, save/network rules, town, UI styling and fixed620 camera remain unchanged. Other panels, common panel chrome, server messages, content descriptions and physical-key legends remain outside this scope. No language selector, new language, dependency or download was added.

## Measured verification

- Typecheck, existing six binding checks plus three catalogue checks (9pass), and content check passed with isolated `DATA_DIR` root `hf-text-catalogue-c4e3dff92eae4f60b3c31278e4d302c9`. The checks include malformed/missing/inherited entries, reorderable placeholders and literal runtime input; compile-time expected failures are checked too.
- The existing real-input browser harness built the client and passed before and after. Installed Chrome154.0.8037.99 on the owner's Windows PC, headless fresh profiles,1920×1080,DPR1,`document.hidden=false`; no personal profile or real saves used. Roots: before `hf-bindings-ui-KoWBvS`, after `hf-bindings-ui-3KWajd`.
- Four retained states each have exactly equal panel text, accessibility labels and panel geometry: conflict, custom controls, sound retained, reset controls. See [comparison.json](checks/text-catalogue/comparison.json) and both trace.json files. Real input checks cover conflict/cancel, movement/release, actual dash cooldown, old keys inactive, physical Waypoint interaction, skill/settings toggles, typing suppression, native volume slider, reload and reset.
- All eight retained1080p screenshots were personally inspected. Existing typography, wrapping, controls and panel placement are retained. Fresh-character appearance and animated world positions vary, so no whole-frame pixel equality is claimed. Existing build size/future Vite-loader warnings remain.

This extraction changes no server behavior; the targeted checks/build/browser comparisons were the appropriate verification. C046's prior full19-stage run is separate evidence, not a new C047 run. The new catalogue tests join the existing client-bindings stage for subsequent strict runs; the runner still has19 stages.

## Remaining work and rollback

Inventory and migrate remaining player-facing strings, then establish language scope, formatting, font coverage, RTL, translator context and native review. F-CON-02, D-38 and P3 remain incomplete. No human comprehension, non-English rendering, assistive-technology compatibility or platform certification is inferred from these checks.

Rollback restores the inline Settings/binding messages and removes the catalogue/check integration together. Saved controls and preferences need no migration. Keep the evidence as a dated record.
