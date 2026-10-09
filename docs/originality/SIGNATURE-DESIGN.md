# Explicit signature preview references

2026-10-09. L45/C033 establish a display-name-dependent lookup in ClassSelect. Add `signatureSkill` to ClassDef and point the three classes at the exact IDs currently selected by the old search. Render the same glyph using that reference. Keep the existing signature text, all names, class values, abilities, UI styling and save IDs unchanged.

Extend the semantic validator to reject missing/inherited and wrong-class references. Confirm a synthetic rename of display text does not invalidate the reference, while mutations of its actual ID fail. Check type safety, shared/content regressions and installed Chrome1920×1080 class cards; inspect the captures. No new art, names, download, dependency or save migration. This removes only implicit name matching, not a skill or player choice. Rollback reverts the three fields, lookup and matching validation together; the fragile text dependency would return.
