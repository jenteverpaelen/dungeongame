# World map — C072

Implemented2026-10-09, solo, on the owner's PC. Claude P5 explicitly calls for F-WLD-03 and U-70; this addition addresses that scope without marking P5 complete.

**Evidence before design:** L86, the existing GD exploration source, atlas UI-D3-09/UI-POE1-06/UI-POE2-01/UI-TBH-04 and actual travel/map code. The map separates regional connections, current-area terrain and the existing nearby minimap. This is an inferred application of observed/source-described patterns; usability benefit is not measured.

**Addition:** M/hud/Waypoint entries; regional nodes with current/open/locked text, original diagram placement, actual portal/waypoint connections, explicit quest prerequisite and server-command travel only from an appropriate physical point. Current-area terrain reuses the unchanged minimap bake; service names select their marker, exits link to destination details, and the player/tracked objective are shown. Cross-zone guidance now resolves the next exit or town waypoint instead of failing when a target is nonadjacent. New text has message keys.

**Preservation/removal:** terrain drawing moved to a shared client module, not deleted. No town geometry, camera, combat, service authority, travel rule, save field, quest content, dependency or asset download changed. Old custom M/J bindings retain priority; new actions receive distinct unused keys. Existing Waypoint channels and journal remain accessible. No new remote teleport or service operation.

**Measured:** focused13 navigation/binding/message tests pass, typecheck and production build pass. First typecheck caught two numeric interpolation arguments; corrected to the catalogue's string contract. Browser on this PC: regular game1920×1080, locked Bracken details/disabled travel, town-waypoint travel into Rillwake, M entry, local geometry and service selection inspected. Two final town/map captures plus the pre-label-fix Rillwake capture are in tour/world-map-*.jpg. Rillwake was inspected with debug infinite HP after travel. Initial small overlapping names were replaced with selectable names and larger selected markers; no styling redesign. The production build retains existing Vite config/chunk warnings.

**Scope of checking:** route authority is still the previously tested server command; map checks concern routing/presentation/key migration. All command tests used fresh temporary DATA_DIR with backup output disabled. The just-passed C071 full suite was not rerun for this bounded UI work, following the owner's request to prioritize implementation. HUD FPS was not used as a benchmark. Full-game playtesting remains theirs.

**Open:** fog/discovery, dungeon floors, wider-world composition as zones land, full map accessibility/user comprehension and performance acceptance. Current regional layout supports the five present non-rift zones and needs explicit authoring when more are added. No guessed geography or distance. Continue P5's remaining objective kinds and onboarding integration.

**Rollback:** remove panel/entry points and route guidance helper together, restore the former minimap-only bake if desired, retain existing Waypoint/journal and stored bindings. No character migration or data deletion.
