# R-18 — 2D art and animation pipeline

Read 2026-10-09. Town artwork/layout is frozen by the owner; this is pipeline research, not a restyle.

[PIXI-PERF](https://pixijs.com/8.x/guides/concepts/performance-tips) explains sprite batching, costs of changing Graphics/text, texture lifetime and culling tradeoffs. Culling can help GPU-bound scenes while adding CPU work. A guidance example is not a local budget.

## Application to Hearthfall — inference

Keep authored identity separate from renderer caches. Derive reusable body/gear families from the existing rigs and palette; benchmark variants rather than producing unlimited unique textures. Track ownership and teardown for generated textures. Preserve entity silhouettes and depth behavior before adding detail.

Use the current game's captures as the style baseline. A style sheet should record palette, outline, light direction, scale and silhouette rules with actual examples from shipped code. No reference-game pixels or generated asset downloads are introduced here.

## Charter gaps

The renderer already has procedural art and town atlases; a complete rig/texture ownership audit, monster-family style sheet, animation workload measurement and dense-combat VFX profile remain open. Prior town performance limitations remain recorded rather than declared solved by this document. No claimed 100-player smoothness from static art inspection.
