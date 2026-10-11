# Weapon and gear art direction — the style bible (2026-10-11)

Owner: the gear "looks very ai made … it all looks the same, it needs to be better"; weapons must look "way way way more
incredible" as level and tier rise. Evidence: `ART-REFERENCES.md` (D1–D8 what is wrong, R1–R12 rules). Code:
`client/src/render/art/series/`. Gallery: `client/gallery-series.html`. Sheets: `shots-art/`. Labels as in
ART-REFERENCES: [S] read, [S·img] looked at, [SN] snippet, [K] prior knowledge, [M] measured here, [P] proposal.

**The direction in one line [P]:** a level band is a *maker*, not a material grade. Seven series — one per generation —
each with its own maker from the world, its own palette, shape language and motif; rarity adds craftsmanship inside a
series; legendaries are bespoke one-off objects; Kindled / Fabled are small accents. Spectacle at the top comes from the
series' own idea (a Cube hovering in a cradle, an obelisk split by a rift), from size (the gear rig's ladder) and from
the attacks taking the series' own light — not from more glow on the object.

## 1. Style bible (applies to weapons, off-hands and armour)

### 1.1 Shading: the game's three tones, nothing else
Same model as the heroes and town (`docs/ART_DIRECTION.md` §1, §4; ART-REFERENCES D8):
* **One ink** `#1B1410` for every line. No other black, no grey (R9, DD2).
* **Three tones per material:** base; shade = base mixed 34 % towards the cool plum `#2A1830`; highlight = base mixed
  50 % towards the warm cream `#FFF4D6`. Light from the upper left of the screen — in a 45° icon that is local −x, so
  the −x half of a blade is lit (kit `LX, LY`).
* **Metal is cel-split** along its ridge: lit half base, far half shade, one bright interior line on the lit cutting edge
  (HK2, IL1). Wood and cord are round sections: shade body, lit stripe, thin highlight. Faceted work (Ancients) uses
  three faces: top/left lit, right shade.
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
  gold / white. The band before the top may be dark (MS3: Genesis is dark; here Riftstone).
* Rarity colour lives in the **UI** (frame, name, beam) and in exactly **one small accent** on the object (§4).

### 1.4 Light (R6) — a material with a reason, on a budget
* Only parts that would really glow may glow: an ember in a crucible, a beacon lamp, a signal in a graduated channel or
  lens, rift runes, the Cube's maze channels. Every series lists its light part (§3); Millwright and Brinekeeper have none.
* Light starts at magic (one part) and grows with craft (rare: all of the series' light parts), never with a halo.
* **Budget [M]:** share of icon pixels with luminance > 0.78, five families per band, levelling sweep — current art 0 → 4 → 4
  → 10 → 11 → 15 → 18 %; series art 1 → 1 → 2 → 3 → 2 → 3 → 3 % (`shots-art/metrics.jpg`). Keep series items ≤ 5 %;
  legendaries and grades may go higher.
* **Halos** (the soft backdrop in icons) only for legendaries and graded items — never for a series item (A4).
* **Sparkles:** none on series items; Fabled adds one glint; decorative floats (embers, chips, drops) ≤ 2 per item and only
  at rare or above (A6).

### 1.5 Readability at real sizes (R12)
Checked on every sheet: the 40 px bag cell, the ~64 px card, a solid-black silhouette at 40 px, and the hero at the
default camera (1080/620 × 0.75 ≈ 1.31 px per unit). The business end carries the identity (A7): heads may be drawn
larger round their mount; drawn tips stay within ~+20 % of the family's canonical reach except staves, whose heads rise
above the mage (measured in `shots-art/extents.jpg`: swords 33–38, axes 30–35, bows 24–29, staves 59–63, wands 20–25 units
including the contour, against canonical 31 / 27 / 21 / 50 / 20).

## 2. Anti-sameness rules (enforced on every new drawing)
| # | Rule | How it is checked |
|---|---|---|
| A1 | **One shape language per series** (curves vs angles, mass vs lean, proportions) written in its row of §3; families inside a series differ by silhouette. | silhouette row of `sheet-*.jpg`: no two cells in a row or column may read as the same black shape |
| A2 | **Own palette per series** (§1.3). | swatch row of the sheet; metrics bright share |
| A3 | **Asymmetry and wear early, precision late** (R10): G0–G2 single edges, crooked hafts, repairs, chips, crust; G3 crisp but one-sided (pennants); G4–G6 symmetric, graduated, faceted. | normal column of the rarity sheets |
| A4 | **No halo on series items**; light only on the series' light parts (§1.4). | icon backdrop; metrics |
| A5 | **One rarity accent, in the series' own material** — a river-glass bead on a cord (Millwright), a glass-glaze bead pressed into the clay (Kilnfolk), one salt crystal grown in the rarity colour (Brinekeeper), an enamel stone (Warden), a stone in a copper bezel (Array), a shard set in the bone (Riftstone), a cabochon on the Cube (Ancients). Magic `#5A7DFF`, rare `#D4B13A` (the UI tokens); a legendary / Set drawn on a series base carries its own colour there. | rarity sheets |
| A6 | Sparkle cap (§1.4). | — |
| A7 | **The business end carries the identity**; the grip is plain and the detail sits at the junction and the head (DD3). | zoom sheets |
| A8 | **No shared ornament across series:** no gem-at-the-guard on every family, no mirrored fins, no floating crescent; each series' motif appears only in that series. | review |
| A9 | **Construction logic:** every part is held by something visible — peg, rivet, lashing, collar, socket, bezel. A floating part needs a stated cause (a wheel on an axle, planets on bearings, a rift holding pieces apart, the Cube). | review |
| A10 | **Nameable object:** every drawing has a short real-world name ("a millwright's riving knife cut from a mill saw", "a kiln poker with a crucible"). If it can only be called "a cool sword", redraw it. | §3 table |

## 3. The weapon series (gen = gearVisual.ts name band)
| Gen · levels | Series · maker · zones | Shape language | Palette (materials · accent · light) | Motif at the junction | Sword · Axe · Bow · Staff · Wand | Late idea |
|---|---|---|---|---|---|---|
| G0 · 1–12 | **Millwright** — Rillwake millwrights and the Bracken sluice crews (Rillwake, Bracken, Reedvault, Cairnspill) | straight planks, square ends, single edges, lashings and pegs; crooked, repaired | birch bark `#E2D6BC`, strap iron `#777D83`, heartwood, hemp · mill red `#B8432E` (Orren's cap band) · no light | stamped mill wheel; lashings and square pegs | riving knife from a broken mill saw (saw teeth on the spine, sheepsfoot point) · felling hatchet with a wedge in the eye · birch self-bow with the bark left on · millrace pole with a turning paddle wheel · treenail (a whittled framing peg) | rare = "restored": filed teeth, strap-iron guard and langets, red paint; the staff's wheel turns |
| G1 · 13–24 | **Kilnfolk** — the firekeepers of Cinderwash and the Kilnwatch | round and heavy: collars, bellies, thumb-pressed rims, blunt tips; glaze drips break the lower edges | fire-scaled iron `#403A3A`, terracotta `#B3603C` · celadon `#86B29C` / tenmoku glaze · ember `#FF8A3A` | glazed collar with drips; stamped kiln cone | clay-tempered falchion with a wavy temper line (RW2) · kiln rake-axe, crescent bit with a glaze window · smoked-ash bow with a pot-bellied clay grip and ball nocks · kiln poker carrying a crucible · stoneware rod topped with a pyrometric cone (RW1) | the crucible keeps an ember (magic) and glows (rare); the cone slumps as the piece is better fired; a celadon fuller |
| G2 · 25–36 | **Brinekeeper** — Saltwind brine keepers, Sablefen ferriers, the Lockglass cistern | long, lean, tapering; whip curves; black whippings; hard little cubes | driftwood `#CDC3AC`, tar `#2C2B31` · oilskin yellow `#E2B22E` (Sera), brine pink `#EC9FAD` (RW3), Lockglass green · no light | salt cubes grown at the ends (RW7); tarred whipping | brine knife (long flensing curve, salt-cube pommel) · ferrier's hook-axe, long beard + boat-hook barb · bow of three bound reeds · ferry pole with a brass hook and a glass float netted in rope · dipping stick with a grown crystal cluster | crystals grow larger and pinker with craft; the netted Lockglass float |
| G3 · 37–48 | **Warden** — the Shiverline signallers and the Beaconbreak ward | tall, upright, rectilinear; crisp key-ward steps; swallowtail pennants flying off one side | bright steel `#BAC4CC`, crimson ward enamel `#B3242C` (Mera) · white enamel, brass, ridge frost · beacon lamp `#FFD27A` | key-ward steps + a swallowtail pennant; stamped ward | ward-key sword (key-ward notches by the guard, key-bow pommel) · signal axe (squared blade, spear point, pennant) · flat signal bow with angled limbs, enamel bands, pennants at the tips · beacon mast (yard with pennants, shuttered lamp) · ward key | the beacon's shutters open with craft (closed → half → open); frost-etched steel |
| G4 · 49–60 | **Array** — the readers of the Hollowstar Array | circles, rings, arcs, horn bells, graduated ticks; precise and symmetric | blued star-iron `#2E3A5C`, copper `#C47A4C` / verdigris (RW6) · enamel dial, lilac (Eris) · signal `#C2A8FF` | the graduated ring | graduated blade with an astrolabe-ring guard and a horn-bell pommel · sextant axe (an open graduated arc on radial arms) · bow whose limbs are one true circle, with a sighting ring · orrery staff with planets on arms · horn receiver (ear trumpet) | normal is tarnished to verdigris, magic polished, rare lit: the signal runs in the scales and lenses; the orrery turns |
| G5 · 61–69 | **Riftstone** — no maker: what the rifts crack and give back (the Rift Obelisk's slate and runes, WR4) | monolithic tapered slabs, stepped bases, pyramidion tips; split into pieces held apart | obelisk slate `#544A62`, bone `#DCD3C2` · fracture `#B0A4BA` · rift rune `#FF4A9A` | rectangular rune slots; the split with a gap | obelisk blade in three pieces · a wedge split off its haft, hovering in the socket · bow of stacked slate segments · a small obelisk with its pyramidion floating · stepped shard on a bone handle | gaps widen with craft (touching → held apart); runes light slot by slot |
| G6 · 70 | **Ancients** — the makers of the Cube (the town's Cube, WR4) | faceted geometry: three-tone faces, rhombi, hexagons, gold caps on every vertex; strict symmetry | Cube bronze `#B4783A` (+ light / shade bronzes), gold caps `#E8B64A` · granite · maze rune `#7FF2E0` | a small Cube | faceted bronze blade with a maze channel and a Cube guard · labrys of two faceted rhombi · faceted limbs with gold joint caps and a Cube grip · the Cube hovering in a cradle · three stacked cubes | the channels light up with craft; the Cube floats |

Endgame lore for G5 / G6 is not written yet: the two series use objects that already exist in town (Obelisk, Cube) —
**owner / story decision** whether those makers are right (§9).

## 4. How rarity, legendary and grade layer on top
| Layer | What changes | What never changes |
|---|---|---|
| **normal** | the series object in its plainest finish: wear on G0–G2 (chips, rust, crust, a snapped tooth, a lost paddle), tarnish on G4, dormant light parts | silhouette family, palette, motif |
| **magic** | cleaned and finished (wear gone), the maker's mark appears, one light part wakes where the series has light, **one** rarity accent in blue (A5) | — |
| **rare** | the finest version: an extra fitting (strap guard, langets, brass ferrules, more crystals, open shutters, more planets, wider rift gaps), the mark inlaid in the accent colour, all light parts lit, accent in rare gold | still the same object — DD1 |
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
| Riftstone | bone-wrapped cloth | slate plates hovering a hair off the body (the split) | rune slots in plates | rune slots |
| Ancients | — (geometry) | faceted bronze plates, gold vertex caps | small Cubes as clasps, maze channels | teal channels |
The craft ladder is the same (normal worn / magic finished + mark / rare extra fittings), and the A-rules apply per piece.

## 7. Interface and integration (code)
* `series/kit.ts` — the drawing primitives (passes 'under' / 'paint' / 'light', weighted ink, three tones, poles, lashings,
  cubes, rings, glow parts, floats, the rarity accent).
* `series/<series>.ts` — one bespoke function per family, `SeriesInfo` with the §3 data. `series/legendary.ts`, `grade.ts`.
* `series/index.ts` — `seriesModel(spec)` → `{ draw(c, layer), floats, lit, litColor }`.
* `series/drawing.ts` — **the adapter to the gear rig's interface** (`weaponDrawing.ts`, DESIGN-V2 §11): `WeaponDrawInput` →
  `WeaponDrawing` (style.gen → series, style.rar → craft, style.top → grade, look.variant → wear seed, rig → no bow string;
  `present.light` = the series' own light so trails, strike flash and projectiles take the ember / lamp / signal / rune /
  maze colour, 0 = plain attacks; `strength` on the default scale; `impact` per series, grades override).
* `series/register.ts` — `registerSeriesDrawings()` registers blade, axe, bow, staff, wand with fallback to the default
  drawing for families or legendaries the series does not draw. **Not called by the game**; only the gallery's `rig` views
  call it (`shots-art/rig-*.jpg` are rendered by the game's own icon pipeline and hero rig).
* **Integration notes before the game switches** [M, `rig-icons-rare.jpg`]: `icons.ts renderIcon` still (a) paints a
  backdrop halo for every lit item from G5 in `ItemStyle.light` (the rarity yellow) — against A4 — and (b) tints the light
  layer's glow with `ItemStyle.light` instead of the drawing's own light, so Ancients' teal channels glow yellow. Both
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
| `metrics.jpg`, `extents.jpg` | [M] bright-pixel share per band (§1.4) and drawn tips vs canonical reach (§1.5) |

**Honest judgement against the complaint.** Sameness: fixed for these five families — every band is a different world
with its own colours and shapes, nothing converges, the silhouette row shows distinct shapes at 40 px. "AI feeling":
much reduced — each piece is a specific made object with visible construction, wear early and precision late, and the
heavy-outside / thin-inside ink of hand inking; the shading is deliberately the heroes' own flat three-tone model, so the
remaining "vector" look is the game's look, not the weapons'. Progression: through the real rig the step from a level-1
riving knife to a level-70 Ancients blade is large (size, mass, parts, idea) — but **in icons the late series are calmer
than today's late icons**, because today's glow halos are gone by design (A4); if the owner wants the top to *glow* more,
raise the light budget of G5–G6 rares, not the halo. Weakest pieces: Brinekeeper axe (busy socket whipping), the Kilnfolk
bow (thin limbs), Riftstone staff (the tallest weapon — shorten if it feels too much on the hero), Bloodwake's waves are
subtle at 40 px.

## 9. Owner decisions (safe defaults in place)
1. The series idea itself, and the seven makers (G5 Riftstone and G6 Ancients borrow the Obelisk and the Cube because no
   endgame lore exists yet).
2. Whether item names should follow the makers later (e.g. "Millwright's Riving Knife" instead of "Short Sword") — not done.
3. Light budget at the top (default ≤ 5 % bright pixels for series items; halos only legendary / graded).
4. Whether the band boundaries should follow the zones more tightly (G0 covers four zones; G2 straddles salt and glass).

## 10. Rollout estimate [P] (measured on this pass: kit 417 lines, 7 series files 156–197 lines for 5 families × 3 craft
levels, 2 legendaries 96 lines, gallery 475 lines)
| Work | Size | Estimate |
|---|---|---|
| The other 8 held families (greatblade, greataxe, mace, crossbow, hand crossbow, shield, quiver, orb) × 7 series | 56 drawings, ~+60 % per series file | about 1.5× this pass (the kit, rules and gallery exist), plus one owner review loop |
| Integration | `icons.ts` halo + glow colour from `present` (§7), `registerSeriesDrawings()` at client start, tests (every family drawn for every gen, deterministic, extents within budget, rarity accent present), bake-time check of the double ink pass (not measured yet) | small: about a tenth of this pass |
| Bespoke legendaries | ~120 planned (ITEMS-SHARED §6); the fallback (series rare + the legendary's colour + halo) works today | ~25–40 lines each; batches of 10–15 per session, ordered by drop frequency |
| Armour (§6) | per series materials and motif fittings through `gearStyle.artLook` / `gearDecor`, then bespoke shapes where a series needs one (Kilnfolk clay scales, Warden pennants, Riftstone hovering plates) | materials + fittings about half this pass; bespoke shapes about one pass |
| Names (owner decision §9.2) | base names per series | content work, separate |
