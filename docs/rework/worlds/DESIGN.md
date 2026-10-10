# Worlds rebuild — zone kit and per-zone plan

Targets and their evidence: `REFERENCES.md` §3. Story, people and voices: `docs/rework/CAST.md` (unchanged). Everything
drawn is original Canvas2D/Pixi art in the town's hand (`townKit.ts` painters, ink outlines, light from the upper left).

## 1. How a zone is authored (the kit, `shared/src/zoneKit.ts`)

A zone is a short **plan** in `shared/src/data/worlds/<zone>.ts`. The kit turns it into the existing `AdventureData`
(so collision, the quest engine, the validators and the server keep working) plus a visual-only `paint` block.

| Plan part | Becomes | Rule |
|---|---|---|
| **Regions** `{id, at, r, ground, role}` | organic floor polygon (deterministic wobble) + painted ground | roles: `outpost` (camp, residents, no packs), `wild` (packs, solid dressing), `yard` (worked ground: crates, carts), `arena` (story fight, open floor), `ruin` (walls/columns), `secret` (off-route pocket with a cache) |
| **Roads** `{points, w, ground, bridge?}` | floor quads + joint discs, painted path | ≥ 150 u wide so packs, pathing tiles (64 u) and the flow field always fit; bridges cross painted water |
| **Landscape** `water / deep / cliff / reeds / lava / chasm` | painted only (never walkable) | everything that is not floor is painted by the biome's *beyond* rule — forest canopy, rock shelves, ash dunes, salt crust, dark water — so the camera never sees a void |
| **Edges** | rule, not data | **north-facing edges rise** (forest wall / cliff face / masonry wall), **south-facing edges drop** (bank, ledge, curb). Tall trees only on north edges; south edges get low bushes, rocks and reeds so nothing hides the hero |
| **Dressing** | `scenery` (solid, r > 0) + `paint.decor` (visual) | edge band trees every 70–110 u; sparse solid props inside `wild` regions; flat decor (flowers, ferns, mushrooms, rubble, reeds, bones, salt) by ground kind; nothing solid within 70 u of a route, interaction, portal or spawn |
| **Vignettes** | groups of props + lights + residents | `camp`, `wreck`, `lumber`, `quarryCut`, `fishery`, `graves`, `ruinWalls`, `kilnYard`, `saltWorks`, `signalPost`, `wardPost`, `dock`; each is a small story told by objects (D4 "POIs + wilderness", W7) |
| **Packs** | `encounters` | story packs keep their ids; ambient packs `amb_*` placed per region from the region's roster, ≥ 450 u apart and ≥ 700 u from the entry/outpost; respawn rules unchanged (18 s, out of view) |
| **Points of interest** `pois` | server-validated objects | `shrine` (D3-style 120 s buff, W1), `cache` (one rare elite's roll, 10 min per character), all proximity- and line-of-sight-checked on the server |
| **Events** | existing field events | an object starts a pack (wave); the dialogue window shows the event's own name and blurb |
| **Life** `critters / emitters / residents / walkers` | client-only, deterministic | birds that lift off when the hero comes near, butterflies, fish jumps, frogs, crows, gulls, bats, rats, deer and hares that bolt; smoke, embers, mist, fireflies, motes, falling leaves; residents at their work with barks; walkers on fixed loops |

Biomes (palette + beyond rule + critters): `meadow` (Rillwake), `sluice` (Bracken), `quarry` (Cairnspill),
`kiln` (Cinderwash, Kilnwatch), `fen` (Sablefen), `salt` (Saltwind), `ridge` (Shiverline), `ward` (Beaconbreak),
`pump` / `cistern` / `array` (the three dungeons: masonry floor, rising wall faces on every north edge, dark rock beyond).

Dungeons: rooms and halls instead of boxes — an entry stair, 5–7 rooms on a loop with corridors, pre-placed packs in the
non-arena rooms (finite, no respawn), the authored mechanism arenas kept in their order, and a boss arena; the loop is the
shortcut back to the stair.

## 2. Per-zone plan (ids of quests, contacts, encounters, locations, events and portals are kept)

| Zone (level) | Size (tiles) | Regions in route order (→ main road; ↗ optional) | Story kept | New optional content |
|---|---|---|---|---|
| **Rillwake Crossing** (1–4), meadow | 136×112 | Tender's Camp (outpost: Orren, porter, fisher, cook fire) → Timber Road → Reed Shallows ↗ Fisher's Bend → Timber Crossing (bridge over the Rill) → Abandoned Yard (wreck) → Millrace Wood → Mill Yard (Siltroot arena) → Rillwake Mill; ↗ Old Ridge (ridge route, survey marker, overlook alarm) ↗ Hollow Oak (secret cache) ↗ Charcoal Clearing | first_road, silent_wheel, high_water, contracts road/alarm | side quest **The Lost Survey Party** (Orren): two records + named rare *Brackjaw*; event **Swarm at the Shallows**; 3 shrines, 3 caches |
| **Bracken Sluice** (4–7), sluice | 128×112 | Maintenance Camp (outpost) → Causeway Road → Sluice Causeway (bridge) → Flooded Basin → Gatehouse Steps → Spillway Forecourt (keeper arena) → Floodgate; ↗ Bank Path loop ↗ Sunken Orchard ↗ Pumpworks Hatch | under_spillway, contract_bank, the Pumpworks hatch | side quest **Silt in the Gears** (Orren via the camp foreman board): two tally boards + named rare *Old Grindle*; event **The Bursting Weir**; shrines, caches |
| **Reedvault Pumpworks** (7–9), pump | 88×80 | Intake Stairs → Filter Hall (pre-placed packs) → West Filter (wheel arena) → Valve Gallery → East Filter (wheel arena) → Settling Tanks → Pump Heart (keeper arena) → Record room; loop corridor back | pressure_below stages west/east/heart, work_record | 3 pre-placed packs, a cache in the Settling Tanks, a shrine at the stair |
| **Cairnspill Terraces** (9–12), quarry | 128×112 | Survey Camp (Iven) → Lower Cutting → Haul Road → Stone Bench → Upper Cutting → Quarry Head (Splintercrown) → Dispatch; ↗ Old Track ↗ Slide Scar ↗ Hermit's Ledge (secret) | stone_road, Iven contracts | side quest **True Measure** (Iven); event **Rockfall Warning**; named rare *Grindstone* |
| **Cinderwash Kilns** (12–16), kiln | 128×112 | Firekeepers' Camp (Kessa) → Charcoal Road → Ash Pits → Firing Yard → Stores (Coalmark) → Upper Kilns (stoker) | untended_fires, Kessa contracts | side quest **Apologies to the Fire** (Kessa); event **Flare-up at the Pits**; named rare *Cinderhusk* |
| **Kilnwatch Crown** (16–20), kiln | 120×112 | Watchkeepers' Refuge (Venn) → Gantry Road → Haulage Gantry → Abandoned Watch (Sootveil) → Crown Furnace (The Last Ember) | last_draw, Venn contracts | side quest **The Missing Shift** (Venn); event **Chimney Collapse**; named rare *Slagmaw* |
| **Sablefen Causeway** (20–25), fen | 128×112 | Sunken Cargo Road → Drowned Wagons → Toll Island → Ferriers' Refuge (Sera) → Upper Bank → North Chain | salt_bound, broken_toll, Sera contracts | side quest **Sera's Count** ; event **Tide of Skimmers**; named rare *Mudgullet* |
| **Saltwind Pans** (25–30), salt | 128×112 | Salt Road → Pan Lanes → Firing Lane → Brine Keepers' Station (Neris) → Overflow → Dispatch House → Cistern stair / Ridge road | bitter_measure, sealed_brine, gifts, Neris contracts | side quest **Neris's Tally**; event **Boil-over**; named rare *the White Clerk* |
| **Lockglass Cistern** (30–35), cistern | 88×88 | Inspection Stairs → Intake Vault → Overflow Hall (packs) → Filter Vault → Keeper's Gallery (Aven) → Governor Chamber → Archive | borrowed_pressure, lockglass_heart | pre-placed packs, cache, shrine |
| **Shiverline Escarpment** (35–40), ridge | 128×120 | Lower Switchback → Windward Relay → Intercept Ledge → Lookout Shelter (Tallis) → Code Watch → Upper Beacon | ridge_trace, open_beacon, Tallis contracts | side quest **Tallis's Flags**; event **Gale Harriers**; named rare *Rimecrown* |
| **Beaconbreak Ward** (40–45), ward | 128×112 | South Gate → Ward Crossroads (Mera) → Raised Granary → Ward Cistern → Relay Gate | ward_gate, false_command, Mera contracts | side quest **Mera's Ledger**; event **Riot at the Granary**; named rare *the Second Seal* |
| **Hollowstar Array** (45–50), array | 96×88 | Signal Approach → Western Receiver (Eris) → Relay Gallery → Eastern Receiver (Daro) → Isolated Array (Conductor) | first_answer, two_voices, last_transmission | pre-placed packs, cache, shrine |
| *Whispering Glade / Ashen Hollow* (open farming fields) | unchanged | generated; the balance pace was calibrated on them | — | kept as is this pass (see DECISIONS D-W02) |

Rewards: side quests pay gold by the camp-contract formula; caches roll one rare elite's drop; shrines are combat-only
buffs; no new XP source (BALANCE.md stays valid). Every number above that is not in REFERENCES.md is a labelled guess.
