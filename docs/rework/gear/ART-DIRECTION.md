# Weapon and gear art direction — the style bible (2026-10-11)

Owner: the gear "looks very ai made … it all looks the same, it needs to be better"; weapons must look "way way way more
incredible" as level and tier rise. Evidence: `ART-REFERENCES.md` (D1–D8 what is wrong, R1–R12 rules). Code:
`client/src/render/art/series/`. Gallery: `client/gallery-series.html`. Sheets: `shots-art/`. Labels as in
ART-REFERENCES: [S] read, [S·img] looked at, [SN] snippet, [K] prior knowledge, [M] measured here, [P] proposal.

**The direction in one line [P]:** a level band is a *maker*, not a material grade. Seven series — one per generation —
each with its own maker from the world, its own palette, shape language and motif; rarity adds craftsmanship inside a
series; legendaries are bespoke one-off objects; Kindled / Fabled are small accents. Spectacle at the top comes from the
series' own idea (a relic glowing inside a glass dome, an obelisk split by the Faultline), from size (the gear rig's
ladder), and — owner decision 2026-10-11 — from strong effects in each series' **own** effect language (§1.4b), never a
shared gold glow.

## 1. Style bible (applies to weapons, off-hands and armour)

### 1.1 Shading: the game's three tones, nothing else
Same model as the heroes and town (`docs/ART_DIRECTION.md` §1, §4; ART-REFERENCES D8):
* **One ink** `#1B1410` for every line. No other black, no grey (R9, DD2).
* **Three tones per material:** base; shade = base mixed 34 % towards the cool plum `#2A1830`; highlight = base mixed
  50 % towards the warm cream `#FFF4D6`. Light from the upper left of the screen — in a 45° icon that is local −x, so
  the −x half of a blade is lit (kit `LX, LY`).
* **Metal is cel-split** along its ridge: lit half base, far half shade, one bright interior line on the lit cutting edge
  (HK2, IL1). Wood and cord are round sections: shade body, lit stripe, thin highlight. Glass (Reliquary) is a
  tinted pane, lighter towards the light, with one white streak; it is drawn slightly transparent so the relic shows.
* No gradients on the object. The only soft things are light (§1.4) and the icon's drop shadow.

### 1.2 Line hierarchy (R8, IL1) — kit.ts
| Line | Width (hand-local units) | Colour | Where |
|---|---|---|---|
| Outer contour | 1.6 beyond the shape, plus a second copy nudged 0.5 / 0.55 towards the shade side (×0.85) | ink | every part's silhouette, drawn first for the whole weapon (the 'under' pass), so only the outside of the object carries it — heavier where the form turns from the light (the inker's weighted line) |
| Part separation | 0.95 | ink | where one part meets another (guard on blade, collar on haft) |
| Interior detail | 0.45–0.8 | a darker tone of the material (never ink) | grain, wraps, graduations, engraving, fracture lines |
| Highlight line | 0.6–1.0 | the material's highlight | ground edges, glaze rims, facet edges |
Rule: if a small part would need its own ink outline to read, it is too small — merge it or grow it.

### 1.3 Palette rules (R3, R9)
* Each series has **two materials + one accent + at most one light colour** (table §3). Colour comes from what the thing
  is made of; nothing is tinted "to look epic".
* **No convergence:** no series may share its dominant hue with the series before or after it, and nothing converges to
  gold / white. The band before the top may be dark (MS3: Genesis is dark; here Faultstone).
* Rarity colour lives in the **UI** (frame, name, beam) and in exactly **one small accent** on the object (§4).

### 1.4 Light (R6) — a material with a reason, on a budget
* Only parts that would really glow may glow: an ember in a crucible, a beacon lamp, a signal in a graduated channel or
  lens, Faultstone runes, the relic seen through the Reliquary's glass. Every series lists its light part (§3); Millwright
  has none (Brinekeeper gained sea-glass with the owner decision of §1.4b).
* Light starts at magic (one part) and grows with craft (rare: all of the series' light parts), never with a halo.
* **Budget — superseded by the owner decision of §1.4b.** The first sample kept series items at 1–3 % bright icon pixels
  against 0 → 18 % for the current art [M, first `metrics.jpg`]; the owner asked for "way more vfx like glow", so the
  light now escalates with the effect strength below, while each series keeps its own colour and effect parts.
* **Halos** (the soft backdrop in icons) only for legendaries and graded items — never for a series item (A4); series
  items get a **rim light** in their own colour instead (icons.ts, `present.rim`).
* **Motes** (embers, glitter, star motes, chips, drops, glints) are decorative floats: the rig drops them outside the 16
  presence slots (crowd budget); their count follows the effect strength (A6).
* **Cost rules (performance gate, 2026-10-11; the owner: the game must stay accessible in the browser and on low-end
  PCs).** Everything a series drawing adds is baked once per look into the hero's part sheet: no Pixi filters, no
  per-frame Graphics, no new display-object kinds. Per hero the series uses the rig's existing parts — the weapon sprite,
  one additive light-layer sprite (in the hero's additive group, pulsed by alpha) and one sprite per float, plus at most
  a few shared pre-baked glow sprites (additive). The float budget follows the Graphics preset (`player.ts
  heldFloatBudget`): High ≤ 3 decorative floats and ≤ 3 glow sprites per weapon, Medium 2 / 1, Low 0 / 0 (decorative
  floats are not even baked); structural floats (the pieces an item is made of: Faultstone segments, the Fabled ring, the
  plumb bob) always stay. Decorative floats show only in the presence slots. Off-hands bake their floats at rest into the
  off-hand sprite (no extra objects; their light layer is not drawn on the hero). Measured per drawing in `floats.jpg`
  (rare: 0–4 decorative; rare + Fabled: at most 7 decorative, 9 floats in all — so the cap, not the drawing, sets the
  cost) and in a 30-hero crowd A/B (§11).

### 1.4b Effects (owner decision 2026-10-11: "The art looks good however it needs way more vfx like glow and all that stuff
really stand out clearly but the size and design looks alright")
**Effect strength** (`series/index.ts effectStrength`): 0 on normal items; otherwise 0.2 + 0.15 × generation +
0.25 × (craft − 1) + 0.35 legendary / Set + 0.25 × grade + 0.08 × (+N step). G1 magic 0.35 · G3 rare 0.9 · G6 rare 1.35 ·
G6 legendary 1.7 · Fabled +10 ≈ 2.4. It drives: light bloom width and alpha (kit `bloom`), the number of motes, rays and
arcs, the icon rim light, and the attack presentation `strength` (glow ribbon from 0.6, cleave arcs from 0.8, strike
flash and projectile size) — so early items stay plain and endgame rares / legendaries are unmistakable at the default
camera. Each series has its own language (no shared effect):

| Series | Light | Effect parts | Impact |
|---|---|---|---|
| Millwright | none | none by design (the first band stays plain); the wheel turns | — (plain attacks) |
| Kilnfolk | ember `#FF8A3A` | the clay-quench temper line and glaze crazing glow; embers drift off hot iron; heat haze over the crucible | ember |
| Brinekeeper | sea-glass `#9FF0E0` | salt glitter turning in the light; a spray mist; the Lockglass float and beads lit | shard |
| Warden | lamp `#FFD27A` | lamp rays from the beacon (the rig's light pulse is its flicker); lamp-lit edges; lamp and frost glints | spark |
| Array | signal `#C2A8FF` | star motes orbiting the instruments; a scanning arc over the scales; the signal in the channels | star |
| Faultstone | rune `#FF4A9A` | magenta energy arcing across the split gaps; glowing chips; the runes pulse | shard |
| Reliquary | relic `#96FFEC` | prismatic glints off the glass; relic glare and rays through the dome; the panes pulse | shard |
| Bloodwake | `#FF3B3B` | a glowing wake along the edge, drops hanging in the air | spark |
| Rainspindle | `#B8E7F0` | rain falling past the bow, the thread and whorl lit | shard |
| Kindled / Fabled | ember / starlight | a breathing ember haze and two embers / starlight motes turning round the Inscription | ember / star |

Where they show: on the hero (the light layer drawn additively and pulsed by the rig, motes as animated floats with
glow sprites, trails / strike flash / impacts tinted by `present.light`), in icons (the light layer glow and a rim light
in the series colour, motes at rest), on ground loot (the same icon textures plus the rarity beam).

### 1.5 Readability at real sizes (R12)
Checked on every sheet: the 40 px bag cell, the ~64 px card, a solid-black silhouette at 40 px, and the hero at the
default camera (1080/620 × 0.75 ≈ 1.31 px per unit). The business end carries the identity (A7): heads may be drawn
larger round their mount; drawn tips stay within ~+20 % of the family's canonical reach except staves, whose heads rise
above the mage (measured in `shots-art/extents.jpg`: swords 33–38, axes 30–35, bows 24–29, staves 57–61, wands 20–25,
greatswords 50–56, great axes 50–58, maces 30–35, crossbows 32–33, hand crossbows 21 units including the contour, against
canonical 31 / 27 / 21 / 50 / 20 / 48 / 50 / 27 / 30 / 17; axes, maces and hand crossbows sit +22–31 % over, the size
band the owner accepted for the axes).

## 2. Anti-sameness rules (enforced on every new drawing)
| # | Rule | How it is checked |
|---|---|---|
| A1 | **One shape language per series** (curves vs angles, mass vs lean, proportions) written in its row of §3; families inside a series differ by silhouette. | silhouette row of `sheet-*.jpg`: no two cells in a row or column may read as the same black shape |
| A2 | **Own palette per series** (§1.3). | swatch row of the sheet; metrics bright share |
| A3 | **Asymmetry and wear early, precision late** (R10): G0–G2 single edges, crooked hafts, repairs, chips, crust; G3 crisp but one-sided (pennants); G4–G6 symmetric, graduated, faceted. | normal column of the rarity sheets |
| A4 | **No halo on series items**; light only on the series' light parts (§1.4). | icon backdrop; metrics |
| A5 | **One rarity accent, in the series' own material** — a river-glass bead on a cord (Millwright), a glass-glaze bead pressed into the clay (Kilnfolk), one salt crystal grown in the rarity colour (Brinekeeper), an enamel stone (Warden), a stone in a copper bezel (Array), a shard set in the bone (Faultstone), a cabochon on the dome base (Reliquary). Magic `#5A7DFF`, rare `#D4B13A` (the UI tokens); a legendary / Set drawn on a series base carries its own colour there. | rarity sheets |
| A6 | Sparkle cap (§1.4). | — |
| A7 | **The business end carries the identity**; the grip is plain and the detail sits at the junction and the head (DD3). | zoom sheets |
| A8 | **No shared ornament across series:** no gem-at-the-guard on every family, no mirrored fins, no floating crescent; each series' motif appears only in that series. | review |
| A9 | **Construction logic:** every part is held by something visible — peg, rivet, lashing, collar, socket, bezel. A floating part needs a stated cause (a wheel on an axle, planets on bearings, the Faultline holding pieces apart). | review |
| A10 | **Nameable object:** every drawing has a short real-world name ("a millwright's riving knife cut from a mill saw", "a kiln poker with a crucible"). If it can only be called "a cool sword", redraw it. | §3 table |

## 3. The weapon series (gen = gearVisual.ts name band)
| Gen · levels | Series · maker · zones | Shape language | Palette (materials · accent · light) | Motif at the junction | Sword · Axe · Bow · Staff · Wand | Late idea |
|---|---|---|---|---|---|---|
| G0 · 1–12 | **Millwright** — Rillwake millwrights and the Bracken sluice crews (Rillwake, Bracken, Reedvault, Cairnspill) | straight planks, square ends, single edges, lashings and pegs; crooked, repaired | birch bark `#E2D6BC`, strap iron `#777D83`, heartwood, hemp · mill red `#B8432E` (Orren's cap band) · no light | stamped mill wheel; lashings and square pegs | riving knife from a broken mill saw (saw teeth on the spine, sheepsfoot point) · felling hatchet with a wedge in the eye · birch self-bow with the bark left on · millrace pole with a turning paddle wheel · treenail (a whittled framing peg) | rare = "restored": filed teeth, strap-iron guard and langets, red paint; the staff's wheel turns |
| G1 · 13–24 | **Kilnfolk** — the firekeepers of Cinderwash and the Kilnwatch | round and heavy: collars, bellies, thumb-pressed rims, blunt tips; glaze drips break the lower edges | fire-scaled iron `#403A3A`, terracotta `#B3603C` · celadon `#86B29C` / tenmoku glaze · ember `#FF8A3A` | glazed collar with drips; stamped kiln cone | clay-tempered falchion with a wavy temper line (RW2) · kiln rake-axe, crescent bit with a glaze window · smoked-ash bow with a pot-bellied clay grip and ball nocks · kiln poker carrying a crucible · stoneware rod topped with a pyrometric cone (RW1) | the crucible keeps an ember (magic) and glows (rare); the cone slumps as the piece is better fired; a celadon fuller |
| G2 · 25–36 | **Brinekeeper** — Saltwind brine keepers, Sablefen ferriers, the Lockglass cistern | long, lean, tapering; whip curves; black whippings; hard little cubes | driftwood `#CDC3AC`, tar `#2C2B31` · oilskin yellow `#E2B22E` (Sera), brine pink `#EC9FAD` (RW3), Lockglass green · no light | salt cubes grown at the ends (RW7); tarred whipping | brine knife (long flensing curve, salt-cube pommel) · ferrier's hook-axe, long beard + boat-hook barb · bow of three bound reeds · ferry pole with a brass hook and a glass float netted in rope · dipping stick with a grown crystal cluster | crystals grow larger and pinker with craft; the netted Lockglass float |
| G3 · 37–48 | **Warden** — the Shiverline signallers and the Beaconbreak ward | tall, upright, rectilinear; crisp key-ward steps; swallowtail pennants flying off one side | bright steel `#BAC4CC`, crimson ward enamel `#B3242C` (Mera) · white enamel, brass, ridge frost · beacon lamp `#FFD27A` | key-ward steps + a swallowtail pennant; stamped ward | ward-key sword (key-ward notches by the guard, key-bow pommel) · signal axe (squared blade, spear point, pennant) · flat signal bow with angled limbs, enamel bands, pennants at the tips · beacon mast (yard with pennants, shuttered lamp) · ward key | the beacon's shutters open with craft (closed → half → open); frost-etched steel |
| G4 · 49–60 | **Array** — the readers of the Hollowstar Array | circles, rings, arcs, horn bells, graduated ticks; precise and symmetric | blued star-iron `#2E3A5C`, copper `#C47A4C` / verdigris (RW6) · enamel dial, lilac (Eris) · signal `#C2A8FF` | the graduated ring | graduated blade with an astrolabe-ring guard and a horn-bell pommel · sextant axe (an open graduated arc on radial arms) · bow whose limbs are one true circle, with a sighting ring · orrery staff with planets on arms · horn receiver (ear trumpet) | normal is tarnished to verdigris, magic polished, rare lit: the signal runs in the scales and lenses; the orrery turns |
| G5 · 61–69 | **Faultstone** — no maker: what the Faultline cracks and gives back (the Faultstone obelisk's slate and runes, WR4) | monolithic tapered slabs, stepped bases, pyramidion tips; split into pieces held apart | obelisk slate `#544A62`, bone `#DCD3C2` · fracture `#B0A4BA` · Faultstone rune `#FF4A9A` | rectangular rune slots; the split with a gap | obelisk blade in three pieces · a wedge split off its haft, hovering in the socket · bow of stacked slate segments · a small obelisk with its pyramidion floating · stepped shard on a bone handle | gaps widen with craft (touching → held apart); runes light slot by slot |
| G6 · 70 | **Reliquary** — the dome-makers of the Glass Reliquary (the town's glass dome `townHouses.ts dome` and the Reliquary's bronze, WR4) | glass panes leaded in bronze, ribbed domes, gold finials; strict symmetry | bronze `#B4783A` (+ light / shade), reliquary glass `#5FA8A2` · gold finials `#E2C070` · relic light `#96FFEC` | a small ribbed glass dome | a glass blade leaded in bronze rising out of a dome · a labrys of two glass panes in bronze frames · bronze limbs set with glass windows, a caged glass bulb · the Reliquary itself: a ribbed dome with a relic inside · a glass rod in bronze bands with a dome tip | the glass lights from dark to dim to bright with craft; the relic glows inside the dome |

### 3b The other held families (rollout 2026-10-11, owner approved direction and size)
Same makers, palettes, motifs and craft ladder; each piece a nameable object (A10). Greatswords and great axes are not
scaled one-handers: each has its own idea, a long two-hand grip and a heavier head.
| Series | Greatsword · Great axe · Mace | Crossbow · Hand crossbow | Shield · Quiver · Orb |
|---|---|---|---|
| Millwright | a two-man crosscut saw made a blade · a broadaxe · a carpenter's beetle (mallet) banded in strap iron | birch crossbow, hemp-lashed prod (the hand crossbow a short-stocked one) | a sluice-gate board with its lifting ring · a birch-bark tube · a hand millstone with its iron rynd |
| Kilnfolk | an oven peel forged into a blade, wavy temper line · a slag axe · a firebrick maul | iron prod in a clay sleeve with a glaze window | a saggar lid (thumb-pressed rim, glaze dipped, crack glowing) · a tall glazed jar · a stoneware sphere, glaze-capped, crackle glowing |
| Brinekeeper | a flensing blade · a salter's axe with a salt rake · a fish priest (the club for stunning a catch) | three bound reeds for a prod, tar whippings | an oar blade on its loom · an oilskin roll · the netted Lockglass float |
| Warden | a ward greatsword (key-ward notches, key-bow pommel) · a beacon halberd · a ward padlock | signal crossbow with pennants at the prod tips | a ward door (keyhole, crimson and white enamel) · a flag case · a ward lantern |
| Array | a greatsword with a double graduated ring · a quadrant (graduated sector plate) with a plumb bob · an armillary mace | a theodolite crossbow with its sighting ring | a dish receiver · a telescope tube · a celestial globe |
| Faultstone | an obelisk blade in four pieces · a wedge hovering off its haft · a monolith maul, pieces floating | a prod of stacked slate segments | a fractured slab held apart · a segmented case · a split stone |
| Reliquary | a monstrance blade (glazed sun at the hilt, diamond-leaded glass either side of a midrib) · a lunette bardiche (one glass crescent leaded like a fan window) · a reliquary case for a head | prod windows of glass in bronze | a rose window · a glass case · a relic sphere |

Endgame lore for G5 / G6 is not written yet: the two series use objects that already exist in town (the Faultstone
obelisk, the Glass Reliquary's dome) —
**owner / story decision** whether those makers are right (§9).

## 4. How rarity, legendary and grade layer on top
| Layer | What changes | What never changes |
|---|---|---|
| **normal** | the series object in its plainest finish: wear on G0–G2 (chips, rust, crust, a snapped tooth, a lost paddle), tarnish on G4, dormant light parts | silhouette family, palette, motif |
| **magic** | cleaned and finished (wear gone), the maker's mark appears, one light part wakes where the series has light, **one** rarity accent in blue (A5) | — |
| **rare** | the finest version: an extra fitting (strap guard, langets, brass ferrules, more crystals, open shutters, more planets, wider Faultline gaps), the mark inlaid in the accent colour, all light parts lit, accent in rare gold | still the same object — DD1 |
| **legendary** | a **bespoke one-off object** with its own silhouette, made from its name and flavour, in its own colours; grows over three stages (G0–G2, G3–G4, G5–G6). Until a legendary has a drawing it is drawn as its series' rare piece with the legendary's colour as the accent, plus the icon halo | — |
| **Set** | its series' rare piece with the Set colour as the accent (Set motifs per piece are a later pass) | — |
| **Kindled** | an ember in a three-bar iron cage at the junction; its only light | the item's own art |
| **Fabled** | the Inscription made visible: a thin ring of glyph ticks turning round the junction, one starlight glint | the item's own art |
| **+N** | unchanged: stars on the icon, the rig's light pulse | — |

## 5. Bespoke legendaries (examples in `rarity-*.jpg`)
* **Bloodwake** (sword; "The blade weeps for every wound it opens."): a one-sided flamberge — the edge is a wake of waves,
  a narrow blood gutter runs the spine and a drop hangs from every trough; the guard curls like a wake. Stages: 2 → 3 → 4
  waves, the curl grows, two falling drops at the late stage. Item colours (crimson, near-black, `#FF3B3B` light).
* **Rainspindle** (bow; "The string remembers every arrow still in the sky."): the grip is a drop spindle — shaft, a
  whorl, a cop of wound thread (RW5); spindle hooks hold the string; a second thread on the back carries glass rain-drops,
  2 → 4 → 6 by stage, the late ones lit. Item colours (slate blue, pale, `#B8E7F0` light).
Rule: a legendary is drawn from its own words into a real object (A10); it never reuses its series' motif.

## 6. Armour follows the same bible
Armour keeps the slot shapes of `gear.ts` and takes per series: materials, the motif as a fitting, and the craft ladder.
| Series | Cloth / leather | Hard parts | Motif fitting | Light (rare+) |
|---|---|---|---|---|
| Millwright | canvas aprons, rolled sleeves, hemp-laced leather | strap-iron bands riveted on, birch slats as splints | stamped wheel buckles, square pegs as toggles | none |
| Kilnfolk | soot-dark leather, oversized gloves, goggles | fired-clay plates sewn on like scales, glaze-dipped edges | glazed collars, cone stamps | an ember brooch |
| Brinekeeper | yellow oilskin, tarred rope belts, bleached cloth | salt-crusted leather, glass toggles | salt-cube clusters at shoulders, black whippings | none |
| Warden | crimson tabards, white enamel badges | bright steel plates with key-ward cut edges, brass buttons | pennants on helms and pauldrons, key rings | a lamp lens on the helm brow |
| Array | lilac shawls, sleeveless tunics | star-iron rings, copper horn cups over the ears | graduated rings as pauldron rims and belt buckles | lilac signal in the rims |
| Faultstone | bone-wrapped cloth | slate plates hovering a hair off the body (the split) | rune slots in plates | rune slots |
| Reliquary | — | bronze plates set with glass panes, gold finials | small glass domes as clasps, bronze leading | the relic glow behind the glass |
The craft ladder is the same (normal worn / magic finished + mark / rare extra fittings), and the A-rules apply per piece.

### 6b Armour as built (2026-10-12, behind Settings → Display → Gear art → **Armour art**, default *Previous art*)
Code: `series/armour.ts` (palettes, fittings, slot pieces, icons), wired through `gearStyle.artLook` (colours) and the
`gearDecor` hooks (fittings) so the turntable rig (`heroParts.ts`), the paper doll (`gear.ts`) and the icons share it.
`?armourArt=series|current` overrides the setting for one page load. Nothing is stored; it is a local display choice.
* **Materials** by material class of the slot shape (cloth / leather / hard plate / jewellery) from the row above, with a
  10 % hint of the stored colour so two pieces of one series differ; early plain pieces are dulled (worn); legendaries /
  Sets keep their own palette mixed 30 % towards the series. Values in `ARMOUR_SERIES` (two changes after the first board,
  [M] `armour-board-warrior.jpg`: Millwright iron warmed towards rust so it parts from Faultstone slate and Array blue;
  Brinekeeper plates are salt-bleached hide instead of tar so the band reads bleached / oilskin yellow / tar black).
* **The badge** (the series motif as a fitting, where a buckle, brooch, brow jewel or knee boss sits): a stamped mill wheel ·
  a glaze-capped terracotta disc with the kiln cone (an ember brooch when lit) · salt cubes grown on a whipping knot (a
  sea-glass toggle when lit) · a white enamel shield with the crimson key ward (a lamp lens when lit) · a graduated ring
  round a lens (the signal when lit) · a split slate tablet with two rune slots · a ribbed glass dome on bronze (the relic
  inside when lit). **The band** (trim along a path): strap iron with square pegs · glazed collar with drips · tarred
  whipping · brass over crimson enamel · graduated copper (verdigris when plain) · bone wrap · bronze leading with gold dots.
* **Signature pieces** that change the silhouette at hero scale, on the helm and the pauldron: Millwright strap bands ·
  Kilnfolk goggles pushed up on the brow and clay scales on the shoulder · Brinekeeper salt grown at the temple and on the
  pauldron · Warden a swallowtail pennant flying off the crown and the pauldron · Array a graduated halo floating round the
  head and a graduated pauldron rim · Faultstone a slate slab hovering over the crown and the pauldron (the gap widens with
  craft) · Reliquary a glass dome crowning the helm and a glass pane with a finial on the pauldron. Wizard hats carry the
  badge on the band (the cone takes the crown).
* **Craft**: normal plain (patches on G0–G2), magic adds the maker's mark and the blue accent, rare the extra fittings, the
  gold accent and the series' **light** (Kilnfolk ember, Brinekeeper sea-glass, Warden lamp, Array signal, Faultstone rune,
  Reliquary relic; Millwright none) — painted into the bake, no additive sprite. **Grades**: Kindled an ember in a
  three-bar cage, Fabled a ring of Inscription ticks with a starlight glint (on helm, chest, pauldron), on top of the live
  grade effects. **Legendary / Set**: the item's motif on a disc in the series' bezel (`armour-board-grades.jpg`).
* **Not yet**: no per-series bespoke slot silhouettes (Kilnfolk clay scale shirts, Warden tabards with pennants, Faultstone
  plates hovering off the whole body are fittings on today's silhouettes, not new shapes); magic and rare differ by
  fittings, accent and light, not by a bigger silhouette — an owner call whether rare armour should grow more.

## 7. Interface and integration (code)
* `series/kit.ts` — the drawing primitives (passes 'under' / 'paint' / 'light', weighted ink, three tones, poles, lashings,
  cubes, rings, glow parts, floats, the rarity accent).
* `series/<series>.ts` — one bespoke function per family, `SeriesInfo` with the §3 data. `series/legendary.ts`, `grade.ts`.
* `series/index.ts` — `seriesModel(spec)` → `{ draw(c, layer), floats, lit, litColor }`.
* `series/drawing.ts` — **the adapter to the gear rig's interface** (`weaponDrawing.ts`, DESIGN-V2 §11): `WeaponDrawInput` →
  `WeaponDrawing` (style.gen → series, style.rar → craft, style.top → grade, look.variant → wear seed, rig → no bow string;
  `present.light` = the series' own light so trails, strike flash and projectiles take the ember / lamp / signal / rune /
  maze colour, 0 = plain attacks; `strength` on the default scale; `impact` per series, grades override).
* `series/register.ts` — `registerSeriesDrawings()` registers all 13 held families (blade, greatblade, axe, greataxe,
  mace, bow, crossbow, hand crossbow, staff, wand, shield, quiver, orb) with fallback to the default drawing for looks the
  series cannot draw. Called once at client start by `game/weaponArtPreview.ts` (the default since 2026-10-11, §11) and
  by the galleries.
* **Depth-wave bases — done 2026-10-12.** Their stored looks keep the shape they were first drawn with (`BASES[id].shape`,
  which the collection validates), so nothing stored changes: `shared/gearVisual.ts ART_SHAPE` gives each new base an art
  shape (cleaver, maul2h, polearm, sling, longbow, rod, sceptre, censer, warhorn, trap_kit, tome; coif, mask, widebrim,
  furmantle, capelet, brigandine, vestment, apron, mitts, fingerless, cuffs, vambraces, armwraps, girdle, cord, chaps,
  tassets, waders, footwraps, sandals, clogs, torc, charm, locket, band, signet, coil) and `gearLook(item, look, base)`
  derives it from the base id when a look goes on the wire (wardrobe looks pass their source base: `equippedAppearance`).
  The rig never branches on a shape it does not know: held art shapes map to their family's shape (`gearVisuals.heldShape`,
  used by the poses, reach, two-hander / ranged tests, off-hand placement and the icon poses), armour art shapes to the slot
  silhouette they extend (`ARMOUR_FAMILY` through `artLook`, the base's own key kept as `artKey`). Drawings:
  `series/bases.ts` (held: one own silhouette per base, dressed per series — palette, badge at the junction, the series'
  effects; a first pass, less bespoke than the family pieces) and `armourBases.ts` (armour and jewellery: the base's own
  parts on the slot silhouette, with either armour art). Placement still follows the family: a warhorn and a trap kit are
  worn where a quiver sits, a tome where an orb sits; the hero's pendant does not show the neck base (looks carry jewellery
  as `jw` numbers only — a protocol change, not done).
* **Integration notes before the game switches** [M, `rig-icons-rare.jpg`]: `icons.ts renderIcon` still (a) paints a
  backdrop halo for every lit item from G5 in `ItemStyle.light` (the rarity yellow) — against A4 — and (b) tints the light
  layer's glow with `ItemStyle.light` instead of the drawing's own light, so the Reliquary's glass glowed yellow. **Done (2026-10-11):** the halo is limited to legendary / Set / graded items, the
  glow takes `present.light`, and drawings may ask for a rim light (`present.rim`, optional in the interface). Both
  should read `weaponDrawing(look).present.light / lit` and limit the halo to legendary / Set / graded items. The hero rig
  draws the series' light layer and floats (`rig-hero-*.jpg`); the trail / strike colours from `present` were **not**
  captured in a screenshot (the gallery's attack loop shows the windup pose, `rig-hero-attack.jpg`) — unverified.

## 8. Evidence (1920×1080, visible headless Chrome, JPEG, `docs/rework/gear/shots-art/`)
| Sheet | What it shows |
|---|---|
| `sheet-levelling.jpg`, `sheet-rare.jpg` | **the checkpoint**: 5 families × 7 series; per cell CURRENT 64 px, NEW 64 px, NEW 40 px and NEW as a black silhouette; swatches and maker notes. Levelling sweep = the rarities of the existing board (normal, magic, magic, rare ×4) |
| `zoom-levelling.jpg`, `zoom-rare.jpg` | the drawings at 150 px |
| `rarity-kilnfolk.jpg`, `rarity-warden.jpg` | one series at normal / magic / rare (120 + 40 px), both legendaries at three stages (+ 40 px, silhouette), rare → Kindled → Fabled |
| `hero-levelling.jpg`, `hero-rare.jpg` | heroes at the default camera, CURRENT and NEW side by side (gallery overlay copying the rig's weapon transform) |
| `rig-icons-rare.jpg`, `rig-hero-levelling.jpg`, `rig-hero-rare.jpg`, `rig-hero-attack.jpg` | the same drawings through the real gear rig (icon pipeline; size ladder, hold poses, light layer, floats; an attack windup frame) |
| `metrics.jpg`, `extents.jpg` | [M] bright-pixel share per band (§1.4) and drawn tips vs canonical reach (§1.5), all 13 families |
| `floats.jpg` | [M] floats per drawing (structural / decorative / with a glow sprite), rare and rare + Fabled, the crowd-budget input |
| `zoom-more-levelling.jpg`, `zoom-more-rare.jpg` | the eight rollout families × 7 series at 112 px |
| `family-<series>.jpg` (7) | one series, all 13 families at normal / magic / rare (118 px): within-series silhouettes (A1), the craft ladder, effect escalation |
| `rig-icons-more.jpg`, `rig-hero-more-a.jpg`, `rig-hero-more-b.jpg` | the rollout families through the real icon pipeline and hero rig (off-hands on their class's main hand) |
| `game/series-ranger-L70-offhand-*.jpg`, `game/series-warrior-L40-offhand-*.jpg`, `game/series-mage-L40-offhand-*.jpg` | in game at 1920×1080: an item-level-70 Reliquary quiver; a Warden ward-door shield beside Bloodwake; a Warden lantern orb (town and item card) |
| `game/series-warrior-fabled-axe-*.jpg` | in game: the L70 Fabled +10 great axe (the Reliquary lunette bardiche with the legendary's accent) in town, on the card, in a rift fight at the default camera and zoomed 1.6, ground loot (a Reliquary monstrance greatsword on the floor) |

**Honest judgement against the complaint.** Sameness: fixed for these five families — every band is a different world
with its own colours and shapes, nothing converges, the silhouette row shows distinct shapes at 40 px. "AI feeling":
much reduced — each piece is a specific made object with visible construction, wear early and precision late, and the
heavy-outside / thin-inside ink of hand inking; the shading is deliberately the heroes' own flat three-tone model, so the
remaining "vector" look is the game's look, not the weapons'. Progression: through the real rig the step from a level-1
riving knife to a level-70 Reliquary blade is large (size, mass, parts, idea) — but **in icons the late series are calmer
than today's late icons**, because today's glow halos are gone by design (A4); if the owner wants the top to *glow* more,
raise the light budget of G5–G6 rares, not the halo. Weakest pieces: Brinekeeper axe (busy socket whipping), the Kilnfolk
bow (thin limbs), the G5 staff (the tallest weapon), Bloodwake's waves at 40 px — **all four reworked 2026-10-11**
(two short whippings on a plain tarred socket, limbs +40 % wider, the obelisk head at 0.82×, deeper and fewer waves).

## 9. Owner decisions (safe defaults in place)
0. **Armour art** (2026-10-12): ships as *Previous art* by default; the lead or the owner switches the default after the
   morning review (`preferences.ts armourArt`). Sheets: `shots-art/armour-*.jpg` (§8b).
1. The series idea itself, and the seven makers (G5 Faultstone and G6 Reliquary borrow the Faultstone obelisk and the Glass
   Reliquary because no endgame lore exists yet; the names follow the owner's name register of 2026-10-11).
2. Whether item names should follow the makers later (e.g. "Millwright's Riving Knife" instead of "Short Sword") — not done.
3. Light budget at the top (default ≤ 5 % bright pixels for series items; halos only legendary / graded).
4. Whether the band boundaries should follow the zones more tightly (G0 covers four zones; G2 straddles salt and glass).

### 8b Armour checkpoint (2026-10-12, 1920×1080, JPEG, `scripts/armour-shots.mjs`)
| Sheet | What it shows |
|---|---|
| `armour-board-warrior.jpg`, `-ranger.jpg`, `-mage.jpg` | the seven series (columns) × normal / magic / rare, each class's own armour, at hero scale |
| `armour-board-warrior-previous.jpg`, `armour-board-mage-previous.jpg` | the same boards with the previous armour art (the generation ladder: grey steel everywhere) |
| `armour-board-grades.jpg` | rare → Kindled → Fabled +10 per series |
| `armour-board-newbases.jpg` (+ `-previous`) | the depth-wave armour, jewellery and held bases on all three classes |
| `armour-icons-warrior.jpg`, `armour-icons-mage.jpg` (+ `-previous`), `armour-icons-ranger-40px.jpg`, `armour-icons-newbases*.jpg` | icons before / after at 64 px, at the 40 px bag size, and the new bases |
| `armour-vs.jpg` (+ `-previous`) | level-10 newcomers beside level-60 veterans, all classes, on the town ground at the game camera |
| `armour-town-<class>.jpg`, `armour-card-<class>.jpg` | in game (real client, `?armourArt=series`): a level-70 veteran beside a newcomer in town; the bag and item card |
| `armour-crowd.jpg` (+ `-previous`) | 30 heroes of mixed stages at the game camera |
| `armour-sets.jpg` | all 15 Sets at 2 / 4 / 6 pieces, incl. the six class-wave Sets with their new wings (banner, mouldboard, antler, rope net, frost, sound ripples) |
| `bases-held-rare.jpg`, `bases-held-normal.jpg` | the eleven depth-wave held bases in every series |

## 10. Rollout status (2026-10-11) and estimate [P]
**Done:** all 13 held families × 7 series (91 drawings, each with its series' effects), the bespoke Bloodwake and
Rainspindle, the grade accents, the default switch (§11). Review fixes during the rollout [M, `family-*.jpg`]: greatswords
and great axes that were scaled one-handers got their own ideas (Kilnfolk stoker's slice and stoker's spade, Brinekeeper
tooth sword, Warden beacon blade and a lantern on the halberd, Array sundial blade and a sighting tube on the quadrant,
Faultstone lengthwise-split stele and a crescent of three stones, Reliquary monstrance blade and lunette bardiche); the
Kilnfolk saggar lid and stoneware orb lost a crack that read as a face; the Brinekeeper float, the Array globe and the
Reliquary rose window no longer white out (smaller cores; large glass panes light less per area); maces and hand crossbows
trimmed to the axes' size band (+22–30 % over the canonical tip, `extents.jpg`). **Open:** depth-wave bases (own shape
keys first, §7), armour (§6, after review), more bespoke legendaries.
**2026-10-12:** armour in the maker series (§6b, behind its switch), the depth-wave bases with their own shape keys and
drawings (§7), `LEGENDARY_VISUAL` for the 87 class-wave legendaries and `SET_STYLE` for the six class-wave Sets (motifs,
colours and signatures from ITEMS-SHARED.md §6 [S]); the five new Set motifs (banner, furrow, antler, knot, chime) got
emblems, pauldron spikes, motif colours and 6-piece wings.

Original estimate: (measured on this pass: kit 417 lines, 7 series files 156–197 lines for 5 families × 3 craft
levels, 2 legendaries 96 lines, gallery 475 lines)
| Work | Size | Estimate |
|---|---|---|
| The other 8 held families (greatblade, greataxe, mace, crossbow, hand crossbow, shield, quiver, orb) × 7 series | 56 drawings, ~+60 % per series file | about 1.5× this pass (the kit, rules and gallery exist), plus one owner review loop |
| Integration | `icons.ts` halo + glow colour from `present` (§7), `registerSeriesDrawings()` at client start, tests (every family drawn for every gen, deterministic, extents within budget, rarity accent present), bake-time check of the double ink pass (not measured yet) | small: about a tenth of this pass |
| Bespoke legendaries | ~120 planned (ITEMS-SHARED §6); the fallback (series rare + the legendary's colour + halo) works today | ~25–40 lines each; batches of 10–15 per session, ordered by drop frequency |
| Armour (§6) | per series materials and motif fittings through `gearStyle.artLook` / `gearDecor`, then bespoke shapes where a series needs one (Kilnfolk clay scales, Warden pennants, Faultstone hovering plates) | materials + fittings about half this pass; bespoke shapes about one pass |
| Names (owner decision §9.2) | base names per series | content work, separate |

## 11. In-game preview switch and measurements (2026-10-11)
* **Default since 2026-10-11 (step 3 of the effects plan):** every held family is drawn, so the maker series is the
  default (`preferences.ts weaponArt: 'series'`); the setting stays as *Maker series* / *Previous art* for A/B and as a
  fallback.
* **Switch:** Settings → Display → Weapon art: *Maker series* / *Previous art* (was *Current* / *New series (preview)*), or the page address
  `?weaponArt=series` / `?weaponArt=current` for one visit (`client/src/game/weaponArtPreview.ts`). Applied once at page
  start, before anything is drawn or baked, so icons, the hero, ground loot and the item card always agree; changing the
  setting shows a reload button (it does **not** flip live). Local only: no save, protocol or server change.
* **Evidence in game** (1920×1080, `shots-art/game/`): `series-mage-primal-town.jpg` vs `current-mage-primal-town.jpg`
  (a level-1 warrior beside a level-70 Fabled +10 mage), `*-card.jpg` (bag and item card), `series-mage-primal-settings.jpg`
  (the switch), `series-ranger-rare-*.jpg` (an item-level-70 rare bow), `series-warrior-bloodwake-*.jpg` (town, card, a
  Faultline fight at the default camera and zoomed 1.6, ground loot). Attack trails and impacts per series through the
  hero rig: `rig-attack-trails.jpg`, `rig-attack-impacts.jpg` (Millwright plain → Brinekeeper sea-glass → Array lilac
  stars → Reliquary cyan with glints and the glow ribbon).
* **A/B frame rate [M]** (`scripts/series-perf.mjs`, perf gallery, 100 simulated heroes, full effects, interleaved; the
  machine was shared with other agents' processes, so absolute numbers swung about 2× between rounds): steady-state fps
  within the noise (mixed stages: current 22–53 vs series 18–31 across rounds, the series runs still had bakes pending;
  Fabled stage: current 15–28 vs series 16–30). Bake cost is measurably higher: pump 9.4 s vs 7.4 s and 2358 vs 2058 baked
  parts for the same 100 looks (+27 % time, +15 % parts — the motes are parts, and the weighted ink draws every contour
  twice). Not optimised yet; a single-pass contour for small parts is the first lever.
* **Crowd cost after the rollout [M] (2026-10-11, the performance gate's 30-endgame-hero crowd):** `scripts/series-perf.mjs`
  (perf gallery, 30 heroes, Previous art vs Maker series interleaved, 2 rounds × 4 samples after a 40 s settle, no bakes
  pending; raw logs `.local/series-perf/crowd30-run*.log`, not committed) and `scripts/series-fill.mjs`. Counted on the live
  stage, series vs previous: draw calls Fabled 177–178 vs 170–178, L70 169–180 vs 179–180, Fabled + 150 monsters 212–216
  vs 210–214, Low 174–178 vs 177–180; visible display objects 3393–3425 vs 3458–3468 (Fabled), 2785–2803 vs 2769–2777
  (L70), 6390–6425 vs 6413–6472 (+ monsters); visible Graphics 8 in every run (no new Graphics; nothing is redrawn per
  frame); on-screen sprite area 11.6–11.8 vs 11.9–12.0 screens and additive (glow / light) area 2.28–2.31 vs 2.37–2.39
  (Fabled), 1.07–1.09 vs 1.14–1.15 (L70). So the series costs no more draws, objects or fill than the art it replaces. Frame
  rate (headless Chrome, software GL, machine shared with four other agents — the same build swung 33–71 fps between
  rounds): Fabled 36–55 vs 40–58, L70 39–61 vs 33–71, + monsters 25–43 vs 28–52, Low 37–51 vs 42–78; within that noise,
  not a measured regression, but not a measured gain either. The honest frame-rate check is the perf agent's verify gate
  on a quiet machine.
* **Armour cost [M] (2026-10-12, PERF.md §7).** Armour is drawn into the hero sheet with the rest of the body (no texture
  per item, no filter, no per-frame Graphics, no additive sprite: the series light on armour is painted). `client-perf`
  gate (built client, recorded town crowd of 25 level-70 heroes): default settings pass (272 draws, 502 binds, 0 uploads,
  2,466 visible, 1,950 renderables). With `PERF_QUERY=&armourArt=series` (the gate's optional query, defaults unchanged):
  three runs 272.7–273.2 draws, 500–535 binds, 0 uploads, 429–434 KB, 2,466–2,501 visible, 1,949–1,984 renderables — all
  inside the budgets (330 / 660 / 0.5 / 540 / 3,000 / 2,400); main-thread CPU 8.0–13.3 ms vs 7.3–9.0 ms with the previous
  armour on a shared machine (noise of the same order). Bake cost is higher: 30 mixed heroes in the perf gallery pump
  2.5–2.8 s vs 2.1 s and bake 685–731 vs 600–608 sheet parts (+20–30 % time, +14–20 % parts: the helm pieces enlarge the
  24 head views); steady fps the same (101 / 149 vs 105 / 143).
