# Hearthmere reference dossier — M0 in progress

Date: 2026-10-08. Target confirmed by the owner: **PC Adventure Mode, all artisans unlocked**. No target-town geometry has been designed or implemented. External media has not been downloaded into the repository. URLs are research references, not asset licences.

## Evidence standard

**Observed/source-verified** means the named page text or repository code was read. **Measured** means a recorded experiment or exact source-data extraction. **Inferred** means an interpretation, never a coordinate. **Unverified** means missing, inaccessible, uncalibrated, or version-mismatched. A page containing an image is not evidence that its pixels were inspected. Search snippets are leads only. All access attempts below occurred on the date above.

## External sources

| ID | Source | What was actually established / extracted | Confidence and limitations |
|---|---|---|---|
| R01 | [Blizzard: Patch 2.3.0](https://news.blizzard.com/en-us/article/19859662/patch-2-3-0-now-live) | Primary patch notes place the Cube acquisition contact in New Tristram in Adventure Mode. | High for mode/service existence; no coordinates or dimensions. |
| R02 | [Blizzard: Blacksmith](https://eu.diablo3.blizzard.com/en-us/artisan/blacksmith/) | Primary guide explicitly associates item salvage and forging with the Blacksmith. Workshop development goes from tables/carts to a fuller workshop. | High for service identity; no current town position. Crafting is outside approved Hearthfall scope. |
| R03 | [Blizzard: Jeweler, Russian locale](https://eu.diablo3.blizzard.com/ru-ru/artisan/jeweler/) | Primary localized guide describes combining gems and removing gems from equipment (English page repeatedly timed out). | High for role functions; locale translation, not placement evidence. |
| R04 | [Blizzard: Mystic](https://eu.diablo3.blizzard.com/en-us/artisan/mystic/) | Primary guide describes replacing an item property and changing item appearance. | High for role split; only enchanting is approved here. No footprint information. |
| R05 | [DiabloWiki: New Tristram, mobile](https://www.diablowiki.net/index.php?mobileaction=toggle_view_mobile&title=New_Tristram) | Read: central waypoint; Inn, house and cellar; access to Old Tristram Road, Overlook Road, Weeping Hollow and Wortham. Adventure artisans north of the house is explicitly marked as lacking a patch citation. | Secondary, medium for topology leads, low for current artisan placement. Last edit displayed: 2015-04-12. Do not convert this into measured geometry. |
| R06 | [French Diablo Wiki: Nouvelle-Tristram](https://diablo.fandom.com/fr/wiki/Nouvelle-Tristram) | Read mode-specific service lists and the caption identifying an Adventure Mode map with an opened side building. | Secondary. Linked map image retrieval failed (cache miss); its pixels, scale and patch were NOT verified. |
| R07 | [PureDiablo: The Artisans — Where Do They Fit in Tristram?](https://www.purediablo.com/the-artisans-where-do-they-fit-in-tristram) | Read a beta-era report discussing insufficient room for artisan wagons and a town-tour video. It explicitly discusses uncertain future placement. | Historical reference only. Not the selected Adventure town; embedded tour not watched. Useful warning against mixing beta and current layouts. |
| R08 | [DiabloFans: Wizzin' It Up with the Wizard](https://www.diablofans.com/news/47032-wizzin-it-up-with-the-wizard) | Historical firsthand preview describes services around the waypoint and enterable Inn/house. | Version-mismatched 2011 preview. Broad service adjacency lead only; no distance or current geometry accepted. |
| R09 | [Blizzard: Season 28 Rites of Sanctuary](https://news.blizzard.com/en-us/article/23897180/season-28-rites-of-sanctuary-has-ended) | Primary seasonal notes describe an altar associated with New Tristram citizens and its progression mechanic. | High for historical seasonal feature; not a coordinate source and not evidence for a D3 physical Paragon shrine. No altar mechanic is approved for Hearthfall. |
| R10 | [Blizzard: Darkening of Tristram](https://news.blizzard.com/en-us/article/24247149/the-darkening-of-tristram-returns-december-31-2025) | Primary page distinguishes an Adventure Mode portal into a recreation of the earlier town/cathedral. | High for distinguishing the anniversary area from the target hub. Do not mix its layout into New Tristram. |
| R11 | [GameSpot: Meet the Composer — Diablo III](https://www.gamespot.com/articles/sound-byte-meet-the-composer-diablo-iii/1100-6382671/) | Composer interview describes 12-string guitar, mandolin and hammered dulcimer in New Tristram, and a changing ambient soundscape. | Primary firsthand interview, but no local listening or positional-emitter measurement completed. Does not establish which sounds play at which town services. |
| R12 | [In-game New Tristram music recording](https://www.youtube.com/watch?v=rgRmlIOVhu0) | Search metadata identifies a 2014 recording credited to Blizzard by the uploader. | Unverified audio lead: not played, not downloaded, not a shipping asset. Music alone would not prove localized anvil/fire/wind sounds. |
| R13 | [Publisher strategy-guide sample](https://ptgmedia.pearsoncmg.com/images/9780744015133/samplepages/9780744015133.pdf) | Search identified a labeled town map; open timed out. Alternative ISBN 9780744013108 sample was rejected as 39,750,469 bytes by the fetcher. | Unverified visual lead; no diagram traced or measured from it, no local download. Older guide cannot establish the selected Adventure layout by itself. |
| R14 | [PlanetDiablo archived New Tristram page](https://gamespy-archives.quaddicted.com/sites/www.planetdiablo.com/diablo3/locations/newtristram/index.html) | Handoff cites bleak settlement / inn contrast. Current fetch was inaccessible. | Handoff-only lead, not reverified here. Do not invent palette RGB values or construction details from the paraphrase. |

## Tool references (not town-layout evidence)

| ID | Source | Extracted fact / relevance | Status |
|---|---|---|---|
| T01 | [Tiled object documentation](https://doc.mapeditor.org/en/stable/manual/objects/) | Polygon, polyline, point and custom-property objects can express footprints, baselines and service spots. | Primary documentation read; feasibility, not final schema approval. |
| T02 | [Tiled introduction](https://doc.mapeditor.org/en/stable/manual/introduction/) | Object placement is not constrained to tile cells. | Primary documentation read. |
| T03 | [Tiled 1.12.2 release](https://github.com/mapeditor/tiled/releases/tag/v1.12.2) and [release metadata](https://api.github.com/repos/mapeditor/tiled/releases/tags/v1.12.2) | Official Windows x64 installer: 23,425,024 bytes. Metadata retrieved without retrieving the installer. | Owner approved this specific future download after Gate 1; not downloaded. See LICENSES.md. |
| T04 | [Tiled licence inventory](https://github.com/mapeditor/tiled/blob/v1.12.2/COPYING) | Editor/plugins GPL; libtiled and related tools BSD; bundled works have distinct licences. | Inventory read; complete licence-text review still required before adoption/distribution. |

## Local primary evidence

Paths are relative to the repository at `ce6eda9`; game source matches baseline `794f77e`.

| ID | Source | Extracted fact |
|---|---|---|
| L01 | `shared/src/constants.ts`, `docs/ART_DIRECTION.md`, `client/src/render/scene.ts` | TILE 64 u, nominal hero 64 u, radius 16 u, walk 250 u/s, camera 620 u high, town cap 100. Thus one nominal hero-height (H) = 64 u, speed = 3.90625 H/s. |
| L02 | `shared/src/mapgen.ts`, `shared/src/data/zones.ts`, `shared/src/movement.ts` | Current 50 x 38 tiles; five buildings represented by circles; eight NPC spots; six fence props have r=0. Collision scales prop radii by s. |
| L03 | `server/src/commands.ts`, `server/src/world.ts`, `shared/src/protocol.ts`, `shared/src/types.ts` | Existing artisan operations; Cube-level validation; some travel/rift town-zone checks but no corresponding NPC-distance requirement. No true stash storage or transfer commands. |
| L04 | `client/src/game/game.ts`, `client/src/dev/galleryArt.ts` | U opens Cube globally; stash aliases inventory. Gallery adds three built-in heroes, so players=97 yields 100 total heroes and eight NPC actors. |
| L05 | `checks/*`, `tour/m0-baseline-plaza.png`, `tour/m0-gallery-100-heroes.png` | Executed baseline suite; inspected own running-game and gallery captures. Details and limits in PERF.md. |

## Coverage and missing evidence

This is a logged dossier, **not a completed visual survey**. Services have primary functional sources. Topology has secondary/historical leads. There are no calibrated Adventure Mode measurements yet for the town perimeter, roads, building footprints, artisan surroundings, gates, ground materials, height relationships, lighting, ambient motion or sound. No exact target coordinate, walk time, building count or final map size is accepted.

Needed from the owner: a current PC Adventure Mode M-map capture with all services visible; overlapping plaza-to-service and perimeter screenshots; a continuous normal-speed walking tour with visible hero and service stops; a brief stationary recording near the forge/inn/plaza with game audio. Record patch, resolution, zoom, movement-speed bonuses and whether seasonal features are present. Calibrate projected ground distances along both axes; a vertical on-screen hero height alone does not correct camera foreshortening. Log measurements and uncertainty before drawing the target layout.

Cathedral/ruins/extra districts remain a scope question: the sources distinguish the town from nearby areas. No cathedral inside the hub is assumed. Paragon shrine and training yard are required Hearthfall additions, not verified D3 town-service equivalents.