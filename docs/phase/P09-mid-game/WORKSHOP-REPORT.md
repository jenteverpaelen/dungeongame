# C099 — Story-earned workshop lessons and explicit campaign difficulty

2026-10-10. L119 / D057. Cube pacing and D-16 implementation decision complete for the authored1–50 route; this is not full P9 acceptance.

## Measured problem

The reproducible scripts/audit-cube-route.ts model covers600 deterministic runs (200 per class), all179 authored members once, Normal, zone midpoint levels, zero magic find and salvage of every random item. It excludes respawns, quest rewards and paid crafting XP. CUBE-ROUTE-MODEL.json records335.1 average cumulative CubeXP by50, p90=377. Empower requires565, Transmute1079 and Extraction1806. This all-salvage scenario is not human time, an optimal route or a promise to any player.

Five optional lessons now follow already-authored milestones:

| Milestone | Contact | Minimum Cube level | Newly available function |
|---|---|---:|---|
| Pressure Below (story9) | Jeweler | 2 | Gem Fusion |
| Last Draw (story20) | Mystic | 3 | Enchant |
| Sealed Brine (story30) | Blacksmith | 4 | Empower |
| Open Beacon (story40) | Blacksmith | 5 | Transmute Rare, used at Cube |
| Last Transmission (story50) | Mystic | 6 | Extract Power, used at Cube |

These are original field-record lessons, each requiring the previous lesson and its story milestone. Training raises a floor: it preserves existing XP, never lowers a higher level, gives no items/materials and pays no future recipe costs. Thus a character who keeps their loot can access the first six functions through the story. All original operation XP/costs remain; players can still unlock earlier through crafting. Reforge/socket remain later progression. Old characters can take these new lessons without redoing claimed story quests.

The artisan panel links directly to the relevant journal lesson and shows availability. Remote inspection is possible; learning and claiming require the correct living proximity, enforced by the server. New prose explains input destruction, paid attempts and the distinction between learning and equipping a power.

## Difficulty decision

Private story dungeons now use Normal, instead of silently inheriting the last Obelisk choice. The initial C099 audit inferred that public story fields were already Normal from their instance setting; C100 found dynamic monster-level adoption of the player's saved difficulty at spawn and wake-up. C100 corrects those paths too; the instance-only baseline conclusion was incomplete. Existing active private instances retain their original setting. Procedural training fields, rift preference, Normal–Master access and level60 Torment gates remain unchanged. The Obelisk describes the story scope beside its selected multipliers. No save migration or new mandatory progression restriction.

## Validation and limits

Eight focused cases pass: two lesson cases covering all five actual command paths, milestone/proximity/living checks, one-time claim and save/reload, progress preservation and invalid/repeatable reward rejection; six dungeon cases including the new difficulty-independence assertion and original ownership/retry/completion flows. Existing costs reject an invalid extraction after unlocking. Typecheck/build pass; main bundle1,279.03kB /415.61kB gzip, existing warnings retained. Every runtime check uses fresh isolated DATA_DIR, backups disabled.

Local Chrome at1920×1080: inspected the artisan link, opened its specific lesson, checked the available interaction and reward text. WORKSHOP-PREVIEW.jpg and WORKSHOP-LESSON.jpg are labelled presentation fixtures with synthetic equipment, not balance or live transaction evidence. Both fit without scrolling. Server transaction evidence comes from the focused command/save cases.

No old content was deleted. The removed hidden dungeon inheritance prevents unexpected story spikes; a normal difficulty preference is not forced onto saved rift settings. Rollback hides lessons without deleting earned Cube levels/history and can restore dungeon creation behavior. Human pace/affordability, advanced P11 crafting, party2–4 and remaining P9 band/family work remain explicit.
