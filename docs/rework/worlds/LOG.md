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
