# Hearthmere design workbook — M0, Gate 1 NOT ready

Sources were logged first in [REFERENCES.md](REFERENCES.md). This document contains a measured **existing-town survey** and the approved scope. It does not contain an approved or measured New Tristram replacement layout. No town implementation has started.

## Approved target

PC Adventure Mode with every artisan unlocked; darker/drearier mood (look still needs Gate 3 approval); original Hearthmere names/art/text/audio; unchanged hero and UI style. Existing game operations only, with the owner's explicit exception for a real persistent stash. Inn and Forge interiors are optional M5. Expansion is allowed only when measurements and performance justify it. U stays usable only near the Cube. See D002–D005.

## Current-town measured diagram

![Existing Hearthmere survey; not target layout](baseline-layout.png)

Editable diagram: [baseline-layout.svg](baseline-layout.svg). Exact extraction: [checks/baseline-geometry.json](checks/baseline-geometry.json). Source L01/L02; seed 1234 at ce6eda9. One nominal hero-height H = 64 world units (u). Map = 50H by 38H = 3200 by 2432 u. Current entry = (25H,20H). Nominal movement is 250 u/s = 3.90625 H/s. Camera at 1920x1080: 620 u tall, approximately 1102.22 u wide, nominal 64 u hero projects to 111.48 pixels tall before animation/gear. These are game-source conversions, NOT measured D3 scale.

The diagram depicts actual tile classifications and circle colliders, not visual building footprints. Orange circles use r*s, as CollisionWorld does. A center coordinate is not a doorway. Existing boundaries/decoration depend on seed; fixed landmarks do not.

| Baseline ID | Kind | Center u | Actual collider radius u | Polygon / doors | Depth data | Enterable / lights / emitters |
|---|---|---|---:|---|---|---|
| B1 | house | 768,640 | 138 | None authored | single prop y | No authored interior or light/emitter records |
| B2 | house | 2432,640 | 132 | None authored | single prop y | Same |
| B3 | forge | 704,1792 | 110 | None authored | single prop y | Same; existing renderer may attach kind-based FX |
| B4 | house | 2560,1856 | 126 | None authored | single prop y | Same |
| B5 | tavern | 1344,384 | 168 | None authored | single prop y | Same |

The six existing fence props have r=0. Exact polygons, baseline polylines and door openings are missing in current map data. These source findings explain why a renderer-only art replacement cannot satisfy the mission.

## Current service measurements (not walking-route verification)

Coordinates come directly from generateMap. Distance is straight center-to-center from the current waypoint; seconds are that distance divided by 250. Centers are occupied by colliders, so these are geometric comparisons, not reachable endpoints, measured walking times, nor a claim that a route is unobstructed. A real route must start/end at free interaction positions and follow collision-valid paths.

| Current spot | x,y u | x,y H | Geometric distance u | Distance / 250 s |
|---|---|---|---:|---:|
| Cube | 1600,960 | 25,15 | 770.66 | 3.083 |
| Obelisk | 2176,1472 | 34,23 | 1152.00 | 4.608 |
| Waypoint | 1024,1472 | 16,23 | 0 | 0 |
| Stash | 1280,1664 | 20,26 | 320.00 | 1.280 |
| Paragon | 1920,832 | 30,13 | 1101.10 | 4.404 |
| Dummy 1 | 2368,1600 | 37,25 | 1350.08 | 5.400 |
| Dummy 2 | 2528,1536 | 39.5,24 | 1505.36 | 6.021 |
| Dummy 3 | 2464,1715.2 | 38.5,26.8 | 1460.39 | 5.842 |

## Target service contract inventory — positions pending

Function mappings below follow the owner's mission / approved scope and existing code L03/L04. R02–R04 establish D3 artisan roles; they do not establish Hearthfall economy or target coordinates. Keep existing Cube unlock levels/XP. Gate 2 must prove each operation near the right service, rejection far away/in the wrong zone, and rejection after moving away while a panel remains open.

| Physical service | Operations / behavior to preserve | Target position and reference route time | Audit / acceptance note |
|---|---|---|---|
| Blacksmith | salvage, salvageAll, upgrade | Unmeasured | Reuse existing economy. No crafting, repair or durability. |
| Jeweler | fuseGem, insertGem, removeGem, socket | Unmeasured | Include direct gem operations in authority checks, not only Cube-level functions. |
| Mystic | enchantRoll, enchantPick | Unmeasured | Recheck location for both phases; no transmog. |
| Cube | transmute, extract, reforge, cubeEquip | Unmeasured | U requires proximity. Personal name/text remain original. |
| Stash | New persistent storage, deposit/withdraw | Unmeasured | Owner-approved exception. Current save has inventory but no stash. Scope/storage capacity and migration contract to be proposed before M2; do not assume account sharing. |
| Waypoint | travel to field destinations | Unmeasured | Existing town-zone validation is insufficient for NPC proximity. Preserve field/rift return semantics. |
| Rift Obelisk | riftOpen, riftEnter | Unmeasured | Existing town checks do not measure distance. Distinguish service opening from entering an actual nearby generated rift portal. |
| Paragon shrine | paragon, paragonReset | Unmeasured | Hearthfall-required addition; no verified D3 physical shrine equivalence. |
| Training yard | server-side training dummies | Unmeasured | Keep existing combat/XP behavior; placement follows approved walkable yard. |

Do not blanket-lock inventory/equip/skills/channel changes or return-to-town actions as a shortcut for service authorization. Those are existing game behaviors outside artisan operations. Exact service/portal interaction policies will be made reviewable in M1/M2.

## Target structure and route workbook — blocked on reference capture

Every target structure needs: id, kind, reference id/frame, calibrated footprint polygon in u, height class, door gaps, collision pieces, baseline polyline, interior policy, lights, emitters and purpose. None of these polygons or counts is verified yet. Inn, houses, forge/workshops, waypoint and exits have reference leads (R01–R08); the exact arrangement is pending. Do not fill the sheet with guessed rectangles.

Required target routes: waypoint to each service above; artisan-to-adjacent-artisan transitions; stash-to-artisans; waypoint-to-inn; approach to each exit; waypoint-to-training yard. Each needs measured reference distance in H, projected-world conversion with uncertainty, navigation path length, nominal time at 250 u/s, and later actual in-game traversal time. All are currently **unmeasured**. The handoff's under-30-second vendor assertion is not adopted as a fact.

The Cathedral, graveyard and Old Tristram ruins must not be moved into the hub simply to fill the vocabulary in HANDOFF §5.4. R05/R06 describe separate adjacent areas; R10 describes a separate anniversary recreation. Their exact representation (exit/approach/background or expanded playable area) remains for the measured reference review. No new quests/lore/vendor economy is approved.

## How Gate 1 becomes reviewable

1. Obtain current Adventure Mode map and overlapping walkthrough frames, including the hero, doorways, edges and artisans. Record patch, seasonal state, zoom and move-speed bonuses; keep supplied reference images outside Git.
2. Calibrate screen-ground axes using repeated known routes, not only sprite height (camera projection foreshortens the ground). Record observations, scale conversions and error bounds in REFERENCES before drawing.
3. Produce an original, dimensioned target diagram with footprint/route/service tables. Mark Hearthfall-specific additions explicitly and justify their space without moving reference landmarks casually.
4. Complete baseline gaps in PERF, then show the target image to the owner. **Stop for Gate 1. No M1 work is authorized by an incomplete survey.**