# Worlds rebuild — log (terse: what changed, why, evidence)

- **W0 — measure + references.** Measured every quest zone (REFERENCES §1): 1.4–3.2 walkable screens, 6–32 s of walking on
  the main route, 3–5 fights, 1.5–21 props per Mu² (open Glade ≈ 100). Sources W1–W8 for shrine rules, zone time bands and
  point-of-interest kinds. Targets in REFERENCES §3, kit and per-zone plan in DESIGN.md.
- **W1 — kit + renderer + Rillwake.** `shared/src/zoneKit.ts` (plans → AdventureData + `paint`), indexed ground test
  (identical answers to `inGround`, measured: reachability of a 160×128 zone 60–100 ms), boundary builder with box
  rejection. Client: `zoneGround.ts` (town painter generalised by biome; north faces rise, south edges drop; water,
  foam, bridges), `zoneArt.ts` (town painters reused via one export, new kinds), `zoneBuild.ts`, `zoneLife.ts`
  (critters that react, TownLife adapter for residents/walkers/smoke/embers/lights, POI views). Server: shrines (120 s,
  combat-only buffs) and caches (one rare-elite roll) through quest action `poi`, cooldowns per character/zone/object
  across channels; events use their own names/blurbs; dungeons may hold finite pre-placed packs. Rillwake 160×128.
- **W2 — every quest zone rebuilt.** Bracken, Pumpworks (rooms on a loop), Cairnspill, Cinderwash, Kilnwatch, Sablefen,
  Saltwind, Lockglass, Shiverline (switchbacks), Beaconbreak (walled ward), Hollowstar; all ids kept, validators green.
  Side quest *The Lost Survey Party* (Orren) with a recovered record. Tests that hard-coded the old coordinates now read
  the zone data (D-W07); single-monster dungeon probes clear the new pre-placed packs (D-W06). Found and fixed while
  authoring: a portal or contact must sit on walkable ground (the approach check rays to the object itself), road ends
  must overlap their region (a 37 u seam disconnected half of Sablefen), interior walls must not cross roads.
- **W3 — evidence.** Before shots `shots/before-*.jpg` (taken first as PNG; recompressed to JPEG q80 by the lead at merge to keep the repository small), after shots `shots/after-*.jpg` (JPEG q82 on
  the lead's request; `shoot.mjs --jpeg`). `npm run verify` passed (adventure 45/45, server 757 passed / 0 failed, sim
  green). Measurements in REFERENCES §4. Frame time is the open item: chunk painting while walking puts p95 at 18–24 ms
  in most zones (Pumpworks 12 ms); bake budget lowered 4 → 3 ms per frame.

## W4 — second pass (density, landmarks, content, performance), 2026-10-11

**Density** (`scripts/density.ts`, METRIC=interior: structures + props/decor standing on walkable floor + residents +
interactions + POIs + pack members per 1470×827-unit screen; town square = 39 = 100 %). Before → after, % of town:

| zone | outposts avg | wild min / avg | route min / avg | screens < 35 % |
|---|---|---|---|---|
| Rillwake | 21 → 88 | 8/22 → 46/125 | 0/11 → 23/83 | 47/50 → 6/50 |
| Bracken | 31 → 103 | 5/14 → 54/112 | 0/4 → 15/60 | 42/42 → 7/42 |
| Pumpworks | – | 0/11 → 13/104 | 3/9 → 8/105 | 25/25 → 5/25 |
| Cairnspill | 28 → 92 | 5/16 → 28/95 | 0/8 → 10/62 | 41/41 → 10/41 |
| Cinderwash | 26 → 82 | 8/13 → 67/86 | 0/6 → 15/59 | 33/33 → 4/33 |
| Kilnwatch | 26 → 85 | 5/14 → 51/82 | 0/6 → 21/56 | 36/36 → 8/36 |
| Sablefen | 33 → 133 | 10/16 → 54/92 | 0/7 → 0/46 | 37/37 → 14/37 |
| Saltwind | 26 → 121 | 3/12 → 56/96 | 0/7 → 13/63 | 43/43 → 6/43 |
| Lockglass | – | 3/10 → 13/93 | 0/8 → 15/82 | 24/24 → 5/24 |
| Shiverline | 23 → 113 | 3/13 → 41/96 | 0/5 → 10/55 | 53/53 → 13/53 |
| Beaconbreak | 8 → 64 | 0/8 → 41/88 | 0/3 → 10/52 | 52/52 → 19/52 |
| Hollowstar | – | 0/10 → 15/90 | 0/6 → 18/66 | 36/36 → 9/36 |

Targets (outposts ≥ 80 %, wild ≥ 50 %, route ≈ 35 %) are met on average everywhere except Beaconbreak outposts (64 %).
The remaining low screens are mostly bridges, long straight road stretches and two deliberately open dungeon rooms
(Pumpworks valve gallery kept free of solids for the combat probes; boss rooms). Coverage metric (sprite area): outposts
28–68 %, wild 28–55 %, dungeons 12–16 % (painted walls not counted).

**Content.** Side quests (one-time; gold by the camp-contract formula plus one magic class weapon; no XP): Rillwake
`lost_survey` (pass 1), Bracken `silt_gears` (read tally, weir wave, Old Grindle), Cairnspill `true_measure` (two
stakes, Grindstone), Cinderwash `fire_apology` (flare-up wave, offering niche, Cinderhusk), Kilnwatch `missing_shift`
(shift board, Slagmaw, sweet tin), Sablefen `sera_count` (cargo float, tide wave, Mudgullet), Saltwind `neris_tally`
(two gauges, White Clerk), Shiverline `tallis_flags` (signal post, gale wave, Rimecrown), Beaconbreak `mera_ledger`
(two ledger pages, riot wave, Second Seal). Repeatable event contracts (paid like a hunt of eight): contract_shallows,
_weir, _rockfall, _flare, _chimney, _tide, _boil, _gale, _riot. Lore: stake notes, shift board, ledger pages.
`server/test/worldQuests.test.ts` runs all 18 through the real command path (physical contacts, pays once, no XP,
contracts can be taken again).

**Walking frame time** (`scripts/worlds-perf.mjs`, headless Chrome on the RTX 4070 laptop, 1920×1080, walking the
zone's longest road for 6 s, all 12 zones in one session). This panel runs at 165 Hz, so rAF intervals are quantised
to 6.06 ms steps (a 12.2 ms frame reads as 18.2 ms); the honest number is each frame's main-thread work (rAF timestamp
to the end of style/layout/paint/commit). Work p95 ms: Rillwake 15.0, Bracken 13.7, Pumpworks 10.3, Cairnspill 14.2,
Cinderwash 16.9, Kilnwatch 13.5, Sablefen 17.2, Saltwind 15.0, Lockglass 11.9, Shiverline 14.4, Beaconbreak 13.5,
Hollowstar 10.3 (interval p95 12.2–24.2). Run-to-run noise is about ±15 % (another agent shared the machine).
Where the time goes (Rillwake trace, per frame): Pixi update+render 3.3 ms (all zone drawing included), minimap 3.0 ms,
DOM style recalc 2.1 ms, paint/commit about 1.5 ms. Ground painting is no longer the bottleneck: about 2–3 ms per
512-unit chunk, worst slice ≤ 3.8 ms. Fixed this pass: prop textures were one canvas per random scale (719 textures /
120 MB of canvases in Rillwake, 369 MB over all zones, never released); props now paint at the scale rounded up to 0.25
and scale down (≤ 100 per zone, about 36 MB over all zones; live GPU textures after a short walk 639 → about 385).

**Crowd** (`scripts/worlds-crowd.mjs`: the observer walks, 29 WebSocket bot heroes follow = one full field channel of
30). Rillwake, 30 heroes + 14 summons in view: observer work p50 13.6–14.1 ms, p95 17.9–20.4 ms; server tick for the
instance avg 2.8–5.1 ms, worst 4.3–16.7 ms (budget 50 ms). Top client costs with a crowd: minimap 13 % of the main
thread, Pixi transform updates 11 %, hero rigs (player.ts) about 6 %.

**Not done** (recorded instead of left half-finished):
- Crowd benchmark for the other zone types (ash, marsh, salt, snow, ward): the script takes `ZONES=`, only Rillwake was
  run. Dungeons are private (party of 4), so there is no crowd case there.
- Walking work p95 is still above 16.7 ms in Cinderwash (16.9) and Sablefen (17.2), and the crowd case is above it.
  The biggest remaining levers are outside the zone files: the minimap repaints every frame in fields and sets
  `g.font` per quest marker inside save/restore, which forces a style recalc each frame
  (`client/src/ui/hud/Minimap.tsx`), and the HUD invalidates DOM style every frame (about 2 ms). A render-group camera
  (`root.isRenderGroup`) was tried and reverted: the results were noisy and not better.
- Map panel terrain (`client/src/ui/mapTerrain.ts`: roads lighter than yards, water, cliffs) not extended.
- Evidence shots with monsters in frame for every zone: only `shots/pass2-rillwake_*` were retaken (the camp is safe,
  so no monsters there); the earlier pass-2 review shots stay local.
- Remaining low-density route screens (bridges, long straight roads) and Beaconbreak outpost density (64 %).
