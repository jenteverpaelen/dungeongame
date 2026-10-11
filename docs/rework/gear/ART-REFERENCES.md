# Weapon art direction — references (logged before design, 2026-10-11)

Owner (2026-10-11): the gear "looks very ai made … weapons almost look exactly the same [as another idle game] … it all
looks the same, it needs to be better". Earlier: weapons must look "way way way more incredible" as level and tier rise.

Only **structure** is borrowed below. No asset, name, shape, colour scheme or distinctive design of any game is copied
or traced; reference images were only looked at in a browser. Labels:
**[S]** page read (text fetched) · **[S·img]** item images looked at on the page (no file kept) · **[SN]** search
snippet only · **[K]** prior knowledge, not re-verified · **[M]** measured in this repo.
Earlier research still applies where cited: `REFERENCES-V2.md` (V1–V11, M1–M6, F1–F3, G1–G4, T1–T3, X1–X2).

## 0. What is wrong today (measured)

| # | Observation | Label / where |
|---|---|---|
| D1 | Sword and greatsword are the same drawing at two scales in every column; mace, axe and great axe share one head ladder. | [M] `shots-v2/board-zoom-0.jpg`, `weaponArt.ts bladeFamily(…, big)` |
| D2 | Every family climbs the same material ladder (scrap iron → iron → steel → gilt → blued runesteel → lilac starmetal → white-gold "zenith pearl"). From L60 every family is a pale cream / white shape on a yellow or white glow; the hue that says "endgame" is the same on all 13 families. | [M] `board-icons.jpg` columns L61–L70, `gearStyle.ts` |
| D3 | One ornament vocabulary on every family: a round gem at the junction, symmetric swept fins, a diamond pommel, dotted sparkles, a floating crescent at G6. | [M] `weaponArt.ts` (`lightGem`, `sym()`, `guard`, `floatOf`) |
| D4 | Perfect bilateral symmetry: blades, guards and heads are built from a right half mirrored (`sym()`). Wear exists only as one nick on the G0 blade. | [M] code |
| D5 | Light carries the progression: lit channels from G4, edge light and backdrop halos at the top, 1–3 floating glints. Glow replaces design. | [M] `DESIGN-V2.md` §2.1, board columns L49+ |
| D6 | No maker and no place: nothing on a weapon says who made it or where it comes from, although the zones already have maker cultures (CAST.md, worlds/DESIGN.md). | [M] |
| D7 | Line work: every sub-part carries its own full ink outline (1.3–2.2 u), so small parts turn into busy black specks at 40 px. | [M] `board-icons40.jpg`, code |
| D8 | The heroes and town use one ink `#1B1410`, three tones (flat base, cool plum shade band lower right, warm cream highlight upper left), light from the upper left. Any new weapon art must keep that model to belong to this game. | [M] `docs/ART_DIRECTION.md` §1, §4; `draw.ts` |

## 1. What strong games do

### MapleStory — named weapon lines per level band
| # | Observation | Label / source |
|---|---|---|
| MS1 | One-handed sword line, early to late (Sword, Long Sword, Sabre, Viking Sword, Gladius, Cutlass … Khan, Kopis, Lapis Sword): early weapons are plain steel with a coloured grip, but **each has its own silhouette** (sabre curve, gladius leaf, cutlass, katar, a sickle-like Khan). Mid weapons each own **one strong hue** (Traus red/gold, Jeweled Katar green, Kopis purple, Lapis blue). | [S·img] maplestorywiki.net/w/One-Handed_Sword |
| MS2 | Endgame lines shown side by side (Timeless, Jaihin, Utgard, Fafnir, AbsoLab, Arcane Umbra, Genesis) for saber, axe, bow, staff, wand: **every line has its own palette** (Jaihin magenta/pink, Utgard black-bronze with teal, Fafnir gold with blue-purple, AbsoLab white/grey with red-orange, Arcane Umbra indigo with a gold square frame, Genesis black-gold with a red rim). **One motif recurs on every family of a line at the same anchor point** (the junction of grip and head): Jaihin's round medallion, Arcane Umbra's square gold frame with a blue stone, AbsoLab's red stone in skeletal openwork. The families differ by silhouette, the lines by palette and motif. | [S·img] maplestorywiki.net Staff / Bow / Wand / One-Handed_Axe / Two-Handed_Sword pages |
| MS3 | Glow is rare: in the whole sword line only one special elemental blade (Crystal Blade) and the very top (Destiny) carry a light halo; the other endgame lines read through palette and shape alone. Genesis, the line before the top, is **dark**, not bright. | [S·img] same pages |
| MS4 | The Lv150 Root Abyss set is a 4-piece set whose weapon is the Fafnir weapon, earned from that area's bosses. | [S] maplestorywiki.net/w/Root_Abyss_Set |
| MS5 | Rarity (potential grade) is shown by the item's UI outline colour. | [S] REFERENCES-V2 M5 |

### Terraria — ore tiers
| # | Observation | Label / source |
|---|---|---|
| TR1 | Pre-Hardmode ore weapons (copper, iron, silver, gold, platinum broadswords, bows, axes) share near-identical silhouettes and differ by the ore colour — the palette-swap pattern. | [S·img] terraria.wiki.gg item images |
| TR2 | Hardmode ores (cobalt, palladium, mythril, orichalcum, adamantite, titanium) each give their sword, repeater and waraxe **a distinct silhouette and one hue** shared across the families (cobalt straight blue blade, palladium orange with a flared guard, orichalcum long thin magenta, adamantite red and jagged). | [S·img] terraria.wiki.gg |
| TR3 | Silhouette distinctness is an explicit rule: in 1.4.4.9 the Cobalt Sword was **not** given a curved blade "because [it] would have looked too similar to the Muramasa and would be confused with it". | [S] terraria.wiki.gg/wiki/Cobalt_Sword |
| TR4 | Rarity is a colour scale tied to progression; size modifiers stay within ±18 %. | [S] REFERENCES-V2 T1, T3 |

### Monster Hunter — themed upgrade trees
| # | Observation | Label / source |
|---|---|---|
| MH1 | Malzeno gear (Rise, Sunbreak): the concept is one phrase — "weapons that draw energy from congealed crystals"; "beautiful curves" give the Western look; the monster's **three-pronged tail is applied to all Malzeno weapons in different ways** (on blades it suggests cutting, on bows the tensile strength); crystals sit on the parts that frame the openings; cut-outs in the silhouette make the weapons look lighter. | [S] gonintendo.com/contents/14838 (Capcom interview) |
| MH2 | Light is a material with a reason: a red line runs along the grooves when sheathed, "suggesting energy flowing through them". | [S] same |
| MH3 | "Hand and foot decorations copy the monster's shape, so the set doesn't read as generic Western armor." Specific source shapes are the defence against generic. | [S] same |
| MH4 | Upgrading changes "what the weapon looks like and which monster or general theme it is based off of"; named trees with roman-numeral steps. | [S] REFERENCES-V2 H1, H2 |

### Darkest Dungeon — one weapon, five levels of craft
| # | Observation | Label / source |
|---|---|---|
| DD1 | The Crusader's weapon icons, levels 1–5, are **the same sword** with rising craftsmanship: level 1 has a chipped, notched dark blade and a plain bar guard; then the grip gets a leather wrap, a swept guard, stitched leather, pointed quillons and an engraved emblem; only level 5 is gilt and only level 5 has a warm light behind it. Wear disappears as the level rises. The tier is carried by the **frame colour** (grey, grey, green, blue, orange), not by glow on the object. | [S·img] darkestdungeon.wiki.gg/wiki/Crusader |
| DD2 | Bourassa on colour: "I made a point of not using 'dead gray' or black anywhere but in the inks"; the palette is warm overall, even cool colours "slightly yellowed", to unify it. | [SN] GameSpot "The gothic sensibilities of Darkest Dungeon" (page returned 403; quoted from the search summary) |
| DD3 | Detail is concentrated where the hand and the maker are (grip, guard); the blade stays plain. | [S·img] DD1 icons |

### Hollow Knight — progression by construction, one palette
| # | Observation | Label / source |
|---|---|---|
| HK1 | Five nails by one maker (the Nailsmith): Old (cracked; "blunt with age and wear") → Sharpened (clean facets) → Channelled ("cleft", a V split down the blade) → Coiled (bands wound round the blade) → Pure (carved flowing whorls, "reveals its true form"). **One pale palette for all five**; every step is a new construction idea, none is a glow. | [S] + [S·img] hollowknight.wiki/w/Nail |
| HK2 | Rendering: dark outline, two values per facet (lit half, shade half split along the ridge), no gradients. | [S·img] same |

### Slay the Spire — relics
| # | Observation | Label / source |
|---|---|---|
| ST1 | Every relic is **a specific, nameable object** (a teapot, an anchor, nunchaku, a pen nib, a strawberry, a boot), each in its own small palette, with a dark tinted outline, two or three tones, light from the upper left, slight hand irregularity in the lines and no glow. | [S·img] slay-the-spire.fandom.com/wiki/Relics |
| ST2 | The studio itself calls the original's simple hand-drawn style divisive and later hired an art director. Cited only for honesty: ST1 is used for *specificity and icon construction*, not as a quality bar. | [SN] pcgamesn.com slay-the-spire-2 art direction |

### Hades
| # | Observation | Label / source |
|---|---|---|
| HA1 | Each Aspect of an Infernal Arm changes the weapon's appearance and its moveset (Aspect of Arthur turns the blade into Excalibur). A weapon's look follows its *identity*, not its number. | [SN] rpgsite.net Hades Infernal Arms guide |
| HA2 | No primary source found on Supergiant's weapon shape language. **Not used** beyond HA1. | — |

### Illustration and icon craft
| # | Observation | Label / source |
|---|---|---|
| IL1 | "Most illustrators use bold external lines, with thinner interior lines, which aid in the perception of spaces"; edge lines are black, some interior lines are drawn white "like a highlight", which together "suggest a light source". | [S] users.cs.northwestern.edu/~bgooch/ITI/node4.html |
| IL2 | Icons are seen tiny; fine detail goes first and shape stays. Fill the subject solid black to test the silhouette; design big, check at the smallest real size; one idea per icon; the subject must be clearly lighter or darker than its background. | [SN] mobilegamer.biz "How to make an iconic icon", bugnet.io "readable game art" (low-authority blogs; consistent with IL1 and DD/HK practice) |
| IL3 | Common tells of generated images: objects that float or break physics, inconsistent light, repeating patterns that make no sense. "Detail equally dense everywhere, no focal point, over-symmetry" is general knowledge, **not** sourced. | [SN] technology.inquirer.net "How to identify AI art"; [K] for the second sentence |

### Real-world materials used by the series (so the motifs are real things, not invented ornament)
| # | Fact | Label / source |
|---|---|---|
| RW1 | A pyrometric cone is a small three-sided ceramic pyramid placed in the kiln; as it softens it bends over until the tip touches the shelf, showing the firing has matured. | [S] en.wikipedia.org/wiki/Pyrometric_cone |
| RW2 | Differential hardening coats the spine with insulating clay and leaves the edge bare; the boundary shows as a visible "temper line". | [S] en.wikipedia.org/wiki/Differential_heat_treatment |
| RW3 | Salt evaporation ponds range "from pale green to bright red" with salinity: green algae (*Dunaliella salina*) at low/mid salinity, pink-red-orange haloarchaea at high salinity. | [S] en.wikipedia.org/wiki/Salt_evaporation_pond |
| RW4 | Maritime signal flags use the heraldic five (white, blue, red, yellow, black); swallowtailed letter flags, triangular substitutes, pennants. | [S] en.wikipedia.org/wiki/International_maritime_signal_flags |
| RW5 | A drop spindle: straight shaft, a weighted whorl (disc or ball), a hook or notch; spun yarn is wound into a cop below the whorl. | [S] en.wikipedia.org/wiki/Spindle_(textiles) |
| RW6 | Verdigris, green to blue-green, forms on copper, bronze and brass. | [S] en.wikipedia.org/wiki/Verdigris |
| RW7 | Halite (rock salt) grows cubic crystals; birch bark is white with dark horizontal lenticels; glass fishing floats were netted in rope; astrolabes and armillary spheres are graduated rings. | [K] |

### This repo (world identity that already exists)
| # | Fact | Label / source |
|---|---|---|
| WR1 | Zone level bands and maker cultures: Rillwake mill (1–4), Bracken sluice (4–7), Reedvault Pumpworks (7–9), Cairnspill quarry (9–12), Cinderwash / Kilnwatch kilns (12–20), Sablefen ferriers (20–25), Saltwind salt pans (25–30), Lockglass cistern (30–35), Shiverline signal ridge (35–40), Beaconbreak ward (40–45), Hollowstar array (45–50); rifts and the fields scale to 70. | [M] `shared/src/data/zones.ts`, `docs/rework/worlds/DESIGN.md` §2 |
| WR2 | Generations = item-name bands 1–12, 13–24, 25–36, 37–48, 49–60, 61–69, 70 (`baseTierIndex` + cap). | [M] `shared/src/items.ts`, `gearVisual.ts` |
| WR3 | Look briefs to borrow colour from: Orren's flat cap with a red band, Sera's bright yellow oilskin and rope belt, Neris's salt-white apron and rake, Venn's brass buttons and iron poker, Kessa's soot and goggles, Tallis's signal flags and patched green cloak, Mera's crimson ward sash and fist-sized key ring, Eris's pale lilac shawl, copper earring and horn cups. | [M] `docs/rework/CAST.md` |
| WR4 | Endgame landmarks already drawn in town: the Ancients' Cube (bronze faces `#B4783A/#E0AA5E/#7A4A22`, teal rune channels `#7FF2E0`, gold corner caps), the Rift Obelisk (dark slate `#3A3440`, rectangular rune slots, magenta runes `#FF4A9A`), the Waypoint ring (stone, pale blue runes). | [M] `client/src/render/art/npcs.ts` |

## 2. Rules extracted (→ ART-DIRECTION.md)

| R | Rule | Evidence |
|---|---|---|
| R1 | **A level band is a maker, not a material grade.** Each band gets a series with its own maker, material pair, motif and silhouette language, taken from the zones where that band drops. | MS2, TR2, MH1, MH4, WR1 |
| R2 | **One motif per series, applied to every family in that family's own way, at a fixed anchor** (the junction of grip and head). | MS2, MH1 |
| R3 | **Each series owns its palette** (two materials + one accent). No convergence on gold/white; the band before the top may be dark. | MS2, MS3, TR2, D2 |
| R4 | **Silhouettes must not collide** — across families inside a series and across series inside a family. Test with solid black fills. | TR3, IL2, D1 |
| R5 | **Rarity inside a series = craftsmanship** (wear removed, wraps, fittings, inlay, a maker's mark), not light. The tier's colour lives in the UI frame. | DD1, HK1, MS5 |
| R6 | **Light is a material with a reason** (an ember in a crucible, a beacon lamp, rune slots), spent late and in small areas; halos only for the top grades. | MS3, DD1, MH2, V3 |
| R7 | **Every weapon is a specific, nameable object** made by someone for something ("a millwright's riving knife", "a kiln poker with a crucible"). | ST1, MH3, D6 |
| R8 | **Line hierarchy:** heavy ink outer contour, thin interior lines; interior detail in a darker tone of the material, highlights as light interior lines. | IL1, HK2, D7 |
| R9 | **Ink only in the lines; colour only from materials.** Shade towards the game's cool plum, highlight towards its warm cream. | DD2, D8 |
| R10 | **Asymmetry and wear for poor makers and early bands**; precision and symmetry are earned late (instrument makers, the Ancients). | DD1, HK1 (Old Nail), D4 |
| R11 | **Construction logic:** every part is attached by something visible (peg, rivet, lashing, collar, socket). Floating parts need a stated cause (the rift splits matter, an orrery turns on bearings). | IL3, D3 |
| R12 | **Check at real sizes** (40 px bag cell, ~64 px card, hero at the default camera) and as a silhouette. | IL2, REFERENCES-V2 B2 |
