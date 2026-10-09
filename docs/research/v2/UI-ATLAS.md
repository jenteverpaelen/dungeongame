# Reference UI atlas — first observed publisher-media slice

2026-10-09, C055, research L66. **Partial evidence, not G1 completion or a UI redesign.** Codex inspected23 published media assets in Chrome on the owner's PC. The [18 structured entries](UI-ATLAS.csv) cover each of the five requested reference games; PoE1 and PoE2 have separate entries. [UI-MEDIA.json](UI-MEDIA.json) records every inspected URL, gallery index where applicable, decoded dimensions, classification and visible content. Two illustrations without usable controls are excluded from UI conclusions.

This closes the earlier inability to inspect public reference pixels. It does not close missing first-session footage, current version checks or actual input/error-flow observation. The town, fixed camera and approved Hearthfall UI style remain unchanged.

## Method and evidence boundary

- `V` means **personally observed published pixels**. It does not mean the reference game was run or its behavior tested. These scoped claims remain L2; publisher-selected stills are not independent usability evidence. `S` remains read source text, `M` a local measurement, `P` an implementation/design inference and `Q` unresolved.
- Publisher Steam galleries supplied TBH, Idleon, TorchlightII and the two separate PoE games. Blizzard's dated patch2.5.0 preview supplied D3 illustrations. Media URLs were read from the actual page DOM; no invented asset addresses or search thumbnails were substituted.
- The source-image tab used a1920x1080 viewport. **Actual source dimensions differ.** ASteam URL ending in`.1920x1080.jpg` can decode to960x540,1400x788,1512x852 or1680x1050. Smaller sources were viewed at their browser-displayed size; a larger portrait illustration was scaled to fit. Letterboxing is browser context, not game UI. This pass does not measure reference-client1080p hitboxes, text sizes or screen occupancy.
- The Armory GIF contributed two untimed frames, one with town/HUD and one with both panes. It is not a recorded interaction sequence. Two initially incomplete gray PNG renders were followed by complete observations; only the complete images support findings.
- Source capture dates, builds, settings, mods, account bonuses and selection bias remain unknown except where explicitly established. The D3 article is dated March16,2017 and describes a2.5.0 preview, not the current2026 client. Visible character levels identify those pictures, not time-to-level.
- The owner completed Blizzard's age form. No birth date, profile, account balance, friends, ownership or playtime from surrounding signed-in pages is recorded. No game, installer, archive, reference-media file or third-party asset was explicitly downloaded or added to the repo. Ordinary browser rendering/caching occurred. URLs confer no reuse licence; only original notes and metadata are committed.

## Visible patterns and their limits

| Reference | What was actually visible [V] | What this cannot establish [Q] |
|---|---|---|
| D3 | Categorized material icon/name/count rows; written quality/type and requirement hierarchy in one tooltip; Armory at left and inventory at right around a center world strip | Current Campaign/Adventure opening flow, every HUD element, comparison input, preset errors or transaction safety. The tooltip is one item, not an equipped-versus-candidate comparison |
| TBH | Compact combat strip beneath larger Hero/Status/Portal panes; slot/rank/status indicators; Cube input grid and neighboring tooltip | Opening shortcuts, true maximum bag capacity, actual lock enforcement, craft costs/results or client-closed progression. The white arrow in one image is promotional; the Cube image uses Ukrainian labels |
| Idleon | Labeled bottom navigation; HP/MP/XP values; attack-strip alternative; enemy/bonus information; construction shelf/grid/individual and aggregate rates | Fresh-account layout, unlock timing, AFK formula or live return rewards. The character screenshots show levels1371,676 and502; they are unsuitable first-ten-level observations |
| TorchlightII | PC-style key labels, companion group, edge resource/action HUD and different NPC symbols in town | Final PC defaults, a panel's actual opening input, service completion or item-pickup timing. The character/pet illustration has no controls and is excluded from creation-screen evidence |
| PoE1 | Five visible flask positions separated from skills, edge resource orbs, status badges with counters/time text; additional central gauge in two examples | Current build/defaults, flask rules, gauge semantics, countdown cadence, expiry or hover recovery. These are PoE1 examples only |
| PoE2 | Connected terrain nodes; symbol sequences with named outputs; named boss bar/status information separated from player corner controls; two flask-shaped icons | Route unlock/travel rules, recipe execution, effect formulas, current build or first-session controls. The map lacks a readable legend in the inspected frame |

The full entry table preserves the roadmap's purpose, entry/hotkey, data, interaction, empty/error, density, proposed pattern and source fields. A visible control is recorded even if its function is unknown. Empty slots can be observed; an insufficient-resource error cannot be inferred from them.

## Questions these sources justify testing in Hearthfall [P]

1. **Can an item decision be understood from its text and state?** D3 explicitly separates quality/type, values and restrictions; TBH presents several icon overlays. Inspect our existing tooltip and protection cues at normal, incompatible, pending and full-bag states. C053 already proves bulk protection for Legendary/Set server-side; it does not implement favorites. A padlock in another game's screenshot adds no such guarantee here.
2. **Do related panels retain the information needed for a decision?** D3 Armory/inventory and TBH multi-pane examples motivate testing overlap and stale state in our current panels. They do not justify copying their frames, moving our HUD or adding an Armory before ownership/transaction research.
3. **Are current, invested and available values distinct?** TBH skill-point/rank displays and Idleon's individual/aggregate rates justify separate labels and conservation checks when such systems are implemented. No displayed rate, slot count or rank is a target for Hearthfall.
4. **Can player and target information be distinguished under load?** PoE1 status badges and PoE2 boss information motivate checking identity, duration, stack count and target lifetime separately. Static sources cannot validate a timer, an effect formula or readability in motion. Preserve current camera and optional combat-number setting.
5. **Are physical service cues understandable?** TorchlightII's distinct markers support an inspection question about role and range. The current frozen town remains intact; any later service change needs a demonstrated local problem and approval consistent with the freeze.

These are research questions, not new feature commitments. No game content or system was added, removed or rebalanced by this checkpoint. The transfer limit matters: desktop-strip play, high-level idle management and direct-control ARPG combat have different attention demands.

## Equal-scope remaining evidence

| Reference | Version/mode needed | Next actual flow | Critical empty/error states |
|---|---|---|---|
| D3 Campaign | PC, fresh character/account status, patch, season and difficulty | Character creation through first equipment/skill decision; inspect timestamped frames | Unavailable skill/rune, incompatible item, death, full bag |
| D3 Adventure | Same provenance plus unlock/account bonuses | Mode choice, first bounty/rift or service loop | Unavailable artisan/material, insufficient cost, interrupted operation |
| Idleon | Patch, fresh versus established account, active/offline status | First character, first quest/item/talent and AFK return | Full bag, unmet quest, insufficient talent points, return with no reward |
| TBH | Installed/reported build and account/team progression | First Hero/skill/Portal/Cube sequence | Locked/incompatible input, pending server operation, insufficient cost |
| PoE1 | Patch, league, class, fresh-account status and input mode | First skill gem/support/equipment decision | Invalid socket/support, insufficient attribute, full inventory |
| PoE2 | Separate patch, league, class and input mode | First skill acquisition/modification and recovery decision | Unsupported modifier, unavailable skill, failed craft/recovery |
| TorchlightII PC | Final PC patch, difficulty, class and explicit unmodded status | First equipment/skill/pet-service decision | Full bag, insufficient requirement, respec boundary and pet return |

All seven rows remain open. D3 modes and PoE games are separated to prevent a single image standing in for distinct flows. Subsequent video records must include inspected timestamps and exact start conditions; chapter titles or descriptions are not observations. Equal priority means applying the same questions, not forcing equal counts of available screenshots.

## Verification and continuation

Check unique source/claim/media/entry IDs, every source/media reference, valid dimensions and that every media asset is either used or explicitly excluded. Keep numerical balance eligibility false. Preserve the original Claude roadmap. This docs-only checkpoint requires no game/server test or real-save access; earlier gameplay verification remains historical evidence, not a newly repeated run.

Next: obtain ordinary versioned early-flow footage with timestamped frames and inspect the missing inventory/skill/error surfaces. Keep the partial atlas as the observed baseline and extend it; do not replace missing behavior with plausible prose.
