# Contextual guidance — C073

Implemented2026-10-09, solo. Research before code: L87, Claude P6/F-ONB-03/07, existing UX-01/POE-03/D3-29/TL2-17/TBH-13 records, C028 first-equipment observations and C071 ordinary combat pilots. PoE's historical help page returned503 on re-fetch; no new current-client evidence was claimed. Existing measured evidence supports explaining actual controls and item ownership; it does not establish retention or comprehension benefit.

## Scope and behavior

Eight hints cover steering/automatic combat, usable gear, affordable skill tiers, full inventory, recovery after death, Orren's first quest, the earned weapon still in the bag, and physical artisans. Conditions read existing replicated state and TIER_COSTS. New strings are keyed and display live remapped controls. One nonblocking card appears at a time, suppressed by panels, AFK or death overlays. Buttons only open existing panels; no equip, spending, salvaging or quest operation is automated.

Got it or a suggested panel action records a read/dismissal, not mastery or objective completion. Help now has Controls and Field guide tabs, with all eight texts and individual automatic-display controls. Settings has a global contextual-guidance switch. Per-character enable/dismiss state lives in browser storage. Characters first seen here at level1 with zero kills start enabled; this is an unused-character heuristic, not an account-history guarantee. Developed returning characters start disabled and may opt in. No server-save migration, tracking/analytics upload or cross-device sync.

No content or gameplay system was removed. Controls moved into their existing Help tab; style, town, camera, attacks, skills, loot and saves stay. The new local cosmetic record can be discarded without changing progression. No download/dependency.

## Measured and unverified

Ten focused tests pass: new-store/reload/disable/individual restoration, returning-character opt-out, actual affordability, full-bag/quest-reward/gear conditions, no save mutation, malformed/blocked storage, existing preferences and message contracts. Typecheck and production build pass; existing Vite warnings remain. Future verify runs include the new guidance tests; the whole suite was not repeated for this client-only feature.

Real Chrome1920×1080 on this PC: a fresh synthetic GuideC073 character displayed the first hint, Got it removed it, F1 retained the text in Field guide with that individual checkbox off. Existing keyboard layout lookup correctly rendered the Belgian physical-map-key label as a comma, so the copy now quotes that label. Test-only infinite HP was enabled. Inspected captures: tour/guidance-first-1080.jpg and tour/guidance-help-1080.jpg. No real saves or human first-session measurements were used. Temporary DATA_DIR and disabled backup output isolate the runtime checks; browser reused the owned synthetic test server.

Remaining: full tutorial/cadence, progressive disclosure, appearance, skill/rune/elite/legendary/rift guidance, human/assistive-input validation, account-scoped history and consented funnel data. Cards retain the existing UI materials; actual comprehension and distraction still need the owner's eventual playtesting. P5/P6 and the roadmap remain incomplete.

Rollback: remove new guidance component/store/messages and Help tab while retaining Controls; ignore/delete only the cosmetic browser key through its ordinary reset mechanism if desired. Keep server characters, inventory and quest state unchanged.
