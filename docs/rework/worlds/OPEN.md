# Open fields — the 2026-10-12 rebuild of the field zones

Owner, 2026-10-12: remove the old 1–70 fields and the quest maps made so far ("those circle areas and narrow roads"),
and build "huge square open maps" like Diablo and Path of Exile, with bigger and more varied packs ("real density").
Quest moments that pan the camera must show something ("it took my camera somewhere … and nothing was happening
there"; the mill reveal zoomed on "a round spinning thing in the trees"). Objects must not float or stand in walls.

Status (2026-10-12): the owner approved the Rillwake prototype; all eight field zones are rebuilt with the kit (Act I:
Rillwake, Bracken, Cairnspill, Cinderwash, Kilnwatch; Act II: Sablefen, Saltwind; Act III: Shiverline, Beaconbreak), and
the two old fields are retired from the game world (DECISIONS D-W19). The three dungeons keep rooms and corridors.

## 1. Evidence (REFERENCES W9–W11, plus W2/W4/W5/W8)

| What | Source | Use here |
|---|---|---|
| D3 surface levels keep fixed outer borders, but their art and shape vary more than D2's squared-off edges; chests sit along the edges to reward exploring | W9 (Diablo Wiki *Levels*) | the field is the whole map inset by a margin, its border pulled in by smooth noise; caches on the edges |
| A D3 zone that is too large for its monster density feels empty (Desolate Sands complaint); dense zones with obstacles feel better | W10 (Blizzard forum) | size and density are set together; density is measured per screen |
| PoE: after one pack, the next is "usually" 1–2 s of sprinting away; packs feel separate enough to avoid pulling neighbours | W11 (PoE forum, anecdote) | procedural packs about every 720 u (≈ 2.9 s at 250 u/s) with a clear radius around the entry |
| Rift ≈ zone in 3–5 min; 3–4 min per bounty; "20 s of running" between packs is the bad case | W2, W4, W5 | unchanged route-time band |
| Idle/MMO training maps 10–20 monsters per screen | W8 [UNVERIFIED] | upper bound only |

Not found: published D3/PoE zone dimensions or monsters-per-screen. Sizes below are this game's own measurements.

## 2. The kit (`shared/src/zoneKit.ts`)

* `open({ margin, amp, ground, dress })` — one walkable field polygon (`fieldPoly`) over the whole map.
* Obstacles are **holes** in it (`hole(kind, poly)`, building footprints with `hole: true`): `lake`, `river` (split
  around each crossing: a plank bridge along the river normal, or a gravel ford), `ridge` (cliff band with passes).
  Crossings and passes are authored by map point (`arcAt`), not by fraction of the line.
* `area(id, at, r, { ground, role, roster, dress })` paints, dresses and names a part of the field; `grove` places
  solid anchors; `fill({ roster, spacing, size, champion, rare, clear })` fills the rest with packs: 2–3 kinds of
  trash per pack, champion packs (tier 1) and rares with minions (tier 2 + 3). The server rolls names and affixes
  per spawn (`server/src/sim/spawner.ts`).
* **Placement rules** (the "floating / in walls" fixes):
  * A structure's whole footprint must stand on the floor and out of holes. Only waterwheels and boat wrecks may
    touch water. A structure that cannot be placed is listed in `dropped`; it is never moved onto a void.
  * Each structure keeps the space above its footprint **and** a strip in front of it clear of trees (a tree 250 u
    south of the wheel hid its lower half).
  * The outer tree band skips structure footprints and the space they keep clear: a footprint is "not ground" too,
    and before this fix its edges grew trees inside the mill house and in front of the wheel.
  * `settleProps` (open fields only): solid props and people stand on walkable ground; decor stands on ground, in a
    260 u strip outside the field (edge trees), or on water when it is a water thing; decor standing in a wall is
    removed, not nudged out (nudged, it stood right in front of the house). Anything else moves ≤ 200 u or is dropped.

## 3. Rillwake Crossing, measured (`.local/bal/zone-check.ts`, 2026-10-12)

| | Before (region-and-road layout) | Open field |
|---|---|---|
| Walkable area | 12.3 screens | **52.5 screens** (76 % of a 10 240 × 8 192 u map, 63.9 Mu²) |
| Encounters / monsters | — | 72 / 466 (412 trash, 18 champions, 9 rares, 27 minions) |
| Monsters per screen | — | **8.9** (below W8's 10–20 upper band) |
| Props per walkable Mu² | 1.5–21 (REFERENCES §1) | **181** (855 solid, 10 734 decor) |
| Authored things dropped | — | 0 (3 generated edge trees) |

The mill is a house on the race's south bank with its wheel on the east wall, standing in the race mouth; the brake
is beside the wheel. All quest ids, contacts and world states are unchanged.

### All rebuilt fields (2026-10-12, `.local/bal/zone-check.ts`)

| Zone (act) | Walkable screens | Monsters | Champions | Rares | Per screen |
|---|---|---|---|---|---|
| Rillwake Crossing (I) | 52.5 | 466 | 18 | 9 | 8.9 |
| Bracken Sluice (I) | 50.8 | 617 | 19 | 9 | 12.1 |
| Cairnspill Terraces (I) | 54.1 | 713 | 32 | 3 | 13.2 |
| Cinderwash Kilns (I) | 54.7 | 763 | 19 | 8 | 13.9 |
| Kilnwatch Crown (I) | 54.1 | 716 | 35 | 14 | 13.2 |
| Sablefen Causeway (II) | 50.5 | 667 | 22 | 5 | 13.2 |
| Saltwind Pans (II) | 54.8 | 656 | 51 | 10 | 12.0 |
| Shiverline Escarpment (III) | 60.8 | 761 | 30 | 6 | 12.5 |
| Beaconbreak Ward (III) | 59.0 | 745 | 13 | 8 | 12.6 |

Rillwake keeps its approved 5–9 filler packs; the others use 6–12 (owner 2026-10-12). Every authored route is walkable,
every quest object approachable, every phased prop stands against an edge (tests).

## 4. Quest reveals (render/worldPhases.ts, render/scene.ts)

Before, a world change switched its visuals at once while the camera was still on its way, so the camera arrived at
a finished scene ("nothing was happening there"). Now:

1. The camera pans only when the spot is off-screen (outside 70 % of the half-view); on-screen the change starts
   after 150 ms.
2. For a pan, the ground along the way is painted first (`ZoneGround.prefetch`, ≤ 1.5 s, normal 3 ms/frame budget,
   chunks pinned against eviction until the pan ends). Measured on the reveal path: a plain pan painted ~50 chunks
   synchronously with frames up to 176 ms; with the prefetch, 0 synchronous paints and the worst frame 36–42 ms
   (RTX 4070 laptop, headless Chrome, `.local/scn/reveal-perf.mjs`, `.local/scn/pan-perf.mjs`).
3. The change starts as the camera leaves (+650 ms) and plays there: water drains (fades and pulls in from the banks,
   2.4 s), new props settle in and people fade in (1.5 s), fires catch from small with a flare, wheels spin up and kilns
   die down (`stateRamp`), and a gold ring and motes mark the spot (1.7 s). The one-line caption (`ws.*` quest messages)
   shows as before.
4. Reveal points frame one real spot: the biggest drained pool, or the cluster nearest the hero, never the middle of
   several sites.

All timings are **[P] placeholders** judged by eye at 1920×1080. Reduced motion skips the pan and the animation.

## 5. Open owner decisions

* Approve the Rillwake look and density before the other eleven zones are rebuilt.
* Pack size: Rillwake uses 5–9 per filler pack; the plan for the rest is 6–12 with more varied rosters.

## 6. Still to do

* Measure XP, gold and items per hour in the new fields with the levelling bot (density is 9–14 monsters per screen,
  above the old fields'); the pace gate itself stays on the retired Glade arena (D-W19).
* Dungeons (Pumpworks, Lockglass, Hollowstar) keep their rooms-and-corridors layout; widen or vary them if the owner asks.

## 7. Acts with their own vibe (owner 2026-10-12: "act 1 this rillwake vibe, act 2 maybe different and then act 3 too")

Evidence: D3 swaps the whole setting per act — gloomy forests and graveyards, then bright sandy vistas and oases, then
tundra and military structures (W12). D4 gives each region its own palette, weather, fog, props and materials, and
sets its towns in warm tones against a cooler region (W13). Outdoors stay sharp and colourful so enemies read; dungeons
keep the dark ambience (W14).

| | Act I — Water Road & Upper Road (L1–20) | Act II — Salt Road (L20–35) | Act III — Ridge Signals (L35–50) |
|---|---|---|---|
| Setting | temperate river country rising into green highlands (the approved Rillwake look) | sun-bleached salt marsh and salt pans by the sea | snowbound heights, signal beacons and a fortified ward under siege |
| Palette | greens, warm earth, grey stone | pale blonde and rust grasses, dark rocks, white crust, blue brine (W13 Dry Steppes) | snow, slate, dark pines; warm firelight only at beacons and camps (W13 Fractured Peaks) |
| Light | neutral daylight (unchanged) | warm, high-key tint | cool blue tint |
| Weather | none; mist over water | wind-blown dust and salt specks | falling snow |
| Zones / biomes | Rillwake (meadow), Bracken (sluice), Pumpworks (dungeon); Cairnspill (quarry), Cinderwash and Kilnwatch become **highland**: green moor with the kilns scorching only their own yards | Sablefen (fen retuned to a golden brackish marsh), Saltwind (salt), Lockglass (dungeon) | Shiverline (ridge, snow ground), Beaconbreak (ward, snow on cobble), Hollowstar (dungeon) |
| Monster leads | river and wood creatures; kiln imps, cultists and brutes in the kiln yards | brine crabs, saltglass skimmers, salt guards | ridge harriers, rimehorns, signal adepts |
| Critters | birds, butterflies, frogs, deer, hares | gulls, crows | crows |

Tints, weather densities and palette values are **[P] placeholders** judged by eye at 1920×1080; weather is one
screen-space layer with a fixed sprite count, thinned by Graphics → ambient life and off for reduced motion (low-end
rule). Dungeons keep their own dark look in every act.
