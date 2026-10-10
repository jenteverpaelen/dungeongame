# C096 — Complete slotted passive system and first catalogue

L116/D054 preceded code. Added18 original choices, six per class, with slots at10/20/30/70 and choice availability10/10/20/30/40/50. Each grants one mean current head-affix contribution scaled by level: two class-skill specialisations, resource regeneration, cooldown reduction, life and armor/resistance. No new points, costs, timers or proc mechanics; existing skills/runes/tiers unchanged. This is the selected passive v1, not the whole P9 chapter.

Shared passives data/validation drives server selection, derived stats, combat context and UI previews. Class/level/slot/duplicate/unknown-record checks prevent invalid contributions; locked saved choices remain dormant. Old saves have no passive effects until selection. The durable command path saves choices before acknowledgement. Changes preserve life fraction/current resource and do not reset active cooldowns. Save12/protocol15; v0–v12 fixtures retained.

Skills now has Active skills/Passives tabs with four slot controls, six choices, exact current-level effect, explicit preview/apply/clear, equipped/locked/error/saving states. Existing materials/fonts/frames/buttons retained; no content scrolling. Legacy inventory comparisons include the same passive stats. Resource/skill bonuses are separate from generic sheet DPS, so the passive panel names the actual affected skill.

## Measured

14 focused checks pass: five passive cases plus nine foundations, including all-class legal catalogue/availability, forged selection, duplicate/lock rejection without spending, real simulation skill/CDR/resource effects, life-fraction preservation during swaps, all-class roundtrip and malformed/future-record preservation, plus v0–v12 compatibility. Typecheck and production build passed; final main bundle1,241.51kB /404.14kB gzip. Existing large-chunk warning remains. All runtime checks used fresh isolated DATA_DIR with backups disabled.

[PASSIVES-PREVIEW.jpg](PASSIVES-PREVIEW.jpg): real local Chrome1920×1080, labelled synthetic gallery. Clicked Passives→Apply; slot/choice/effect switched to Equipped. All six options, stats and controls fit without clipping or scroll. This proves presentation, not player combat balance. Actual server handler/simulation/save behavior is the focused evidence above. Owned tab closed and viewport reset.

## Remaining / removal / rollback

Human build usefulness and mid-game TTK/stall distribution await the full P9 content. These are deliberately stat passives, not a claim of novel behavior-changing procs or a giant talent tree. No game content, saved items, active skills or prior access removed. Future P11 build systems can add separate choices while preserving these IDs. Rollback hides selection and ignores effects but retains optional saved selections/version support; there are no new points to refund. Continue authored ActsII–III/routes/dungeon/set/encounter work in PLAN.md.
