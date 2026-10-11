# Gear visuals V2 — the look comes from the item you equip

Branch `claude/gear-v2`. Owner request (2026-10-11): drop the abstract gear tiers; the look should change with the item
type you equip; weapons must look far more incredible as item level and rarity rise; level 1 vs endgame must differ
hugely. Evidence first: `REFERENCES-V2.md` (V1–V11). Everything is original, procedural vector art derived from item
data every save already has (no stored visual field, no save change). Labels: [M] measured here, [P] proposal.

## 1. What was wrong (measured)
`shots-v2/before-icons.jpg`, `before-hero-melee.jpg`, `before-hero-ranged.jpg` [M]: a level-1 sword and a level-70 rare
sword share one silhouette and one size; the difference is a trim colour, a rune line and a coloured corner frame. On the
hero the only big change came from wings, which any single Primal item switched on through an abstract rank.

## 2. The model: composition, not a ladder
A held item's look = **silhouette family** (base shape) × **generation** (item level) × **rarity** (embellishment and
light) × **signature** (legendary / Set) × **grade** (Kindled / Fabled) × **enhancement** (+N). No tier number exists
anywhere a player can see it.

### 2.1 Generation = item-level band (REFERENCES-V2 V1, V2)
Seven generations: the six item-name bands that already exist (`baseTierIndex`: 1–12 … 61–70, so the art always agrees
with the base name, e.g. Short Sword → Broad Sword → Long Sword → Falchion → Runic Blade → Starforged Blade) plus the
level-70 cap, where all endgame drops live. Two-beat rhythm from the FFXIV relic stages (F2, F3): a **new model** every
second generation, a **material + light step** in between.

| Gen | Item levels | Beat | Material [P] | Silhouette (every family) | Light |
|---|---|---|---|---|---|
| G0 | 1–12 | model A | scrap iron, raw wood, cord wraps | crude, short, chipped, no ornament | none (magic+: one dim gem) |
| G1 | 13–24 | refine | iron | same model, cleaner fittings, round pommel / collar | magic+: thin inlay |
| G2 | 25–36 | model B | steel + bronze | forged: fuller, ricasso, beard, flanges, crooks | inlay |
| G3 | 37–48 | ornament | bright steel + gilt | leaf blades, swept guards, crescents, engraving | inlay + gems |
| G4 | 49–60 | model C | runesteel (blued, dark) | angular: stepped points, notches, blade fins, forks; **a light channel is part of the shape** | channel (dormant groove on normal items) |
| G5 | 61–69 | light bump | starmetal (pale lilac-silver + gold) | tiered edges, windows, crescent guards, first **floating piece** | channel + window + edges |
| G6 | 70 | model D | zenith pearl (white-gold) | split / hovering segments (side wing-blades, a floating crescent edge, orbiting flanges), luminous core, 1–3 floating pieces | core |

### 2.2 Rarity = embellishment and the colour of the light (V3, V6)
| Rarity | Light colour (from the shared `RARITY_COLORS` tokens, lifted) | Embellishment |
|---|---|---|
| normal | none: late generations keep their channels **dormant** (dark grooves) | base silhouette only |
| magic | blue | inlay line, one gem |
| rare | yellow | gilt edge lines, tip gems, an extra prong / langet / spike |
| legendary | the legendary's own glow colour | core light from G0, signature (§2.3), +1 floating piece from G4 |
| set | the Set's main colour | Set motif signature |

### 2.3 Legendaries are bundles (V4, V9)
A legendary gets (a) its family drawing in its own palette, (b) a **signature** from a library of 16 (flame, storm,
gale, fault, blood, rain, lantern, leaf, void, arcane, holy, cog, frost, star, shadow, gold): extra silhouette parts,
its own light language and motif floaters, (c) its motif's particles, swing sparks and — at G6 — its own footfalls
(GW2 Bolt, G1). Three have **fully bespoke drawings** to show the override path: *The Ninefold Gale* (nine swept wind
blades around a storm-eye hub), *Bloodwake* (a hooked crimson blade with a wake of serrations), *Cindervane* (a
weather-vane head whose vane is a sheet of fire).

### 2.4 Grades above Legendary (ITEMS-SHARED.md §7, lead input 2026-10-11)
Stored `item.ancient` 1 / 2 keeps its 2-bit slot. **Kindled** (1): an ember set into the piece in a small iron cage
(every family has an ember spot), ember-orange edge light, a drifting ember, ember beam core on the ground. **Fabled**
(2) — "a unique look": white-gold **starlight replaces the core light** (the item's own colour moves to its rim), an
**Inscription ring** of glyphs orbits held items (the Inscription made visible), starlight glints, a starlight beam.
Colours live in one place (`gearStyle.ts TOP_COLORS / FABLED_LIGHT`).

### 2.5 Enhancement +N = sparse glow steps (V5)
+4 / +7 / +10 (the existing Cube thresholds): the weapon's light layer pulses faster and brighter per step, the sheen
sweep starts at +4, a star circles the tip at +10; icons show one star per step.

### 2.6 Size (V7, owner decision)
Bounded per size class, because small one-handers are the hardest to read on a ~95 px hero [M] and big two-handers
already grow heads and edges per generation in the drawing. Legendary ×1.06, each grade step ×1.04. Reach, hitboxes and
collision are unchanged (the trail follows the drawn tip).

| Class | G0 | G1 | G2 | G3 | G4 | G5 | G6 | Legendary + Fabled at G6 |
|---|---|---|---|---|---|---|---|---|
| small (1H, wand, hand crossbow) | 0.90 | 0.97 | 1.05 | 1.15 | 1.26 | 1.38 | 1.50 | 1.72 |
| mid (bow, crossbow, off-hands) | 0.90 | 0.95 | 1.02 | 1.10 | 1.18 | 1.27 | 1.36 | 1.56 |
| large (2H, staff) | 0.88 | 0.93 | 0.98 | 1.04 | 1.10 | 1.17 | 1.24 | 1.42 |

### 2.7 Armour (weapons escalate the most; armour follows the same axes)
* **Material by generation** (`gearStyle.ts artLook`): worked-metal shapes (helms, plate, spiked, gauntlets, sabatons,
  mail) take the generation's metal — scrap iron → iron → steel → bright steel → runesteel (blued) → starmetal (lilac
  silver) → zenith pearl; every piece takes the generation's fittings as trim; early cloth / leather dyes are dulled
  (G0–G2), later ones kept as made; magic / rare trims carry their light; legendary / Set pieces keep their palette.
* **Structure by generation, embellishment by rarity** (`ItemStyle.orn`, internal 0–9, never shown): rims and rivets
  from G2, rivet rows from G3, raised plates / crests from G4, motif spikes and medallions on legendary / Set pieces,
  crowns at G6 legendary, filigree and helm wings on graded pieces.
* **Light channels from runesteel (G4)**: pauldron rims, twin chest channels, a brow band on helms / hoods / caps, a knee
  line — lit in the item's light, dormant grooves on normal pieces.
* Icons fill by generation (80 % → 91 %), off-hands scale by generation in the rig.

## 3. Data format and how content gets its look
**Wire:** `ItemLook.fx` (never stored) = mixed-radix pack of gen (8) · rarity (8) · grade (4) · upgrade (16) · filled
sockets (4) · best gem (8) · gem rank (8) · enchanted (2) · Set id (32) · legendary id (256). Plain items stay below 2³²
(5 msgpack bytes); Set / legendary ids get room for the planned 15 Sets and ~120 legendaries (old: 4 / 5 bits).
Descriptor growth vs no fx [M, test]: +103 B (L70), +129 B (Fabled). `PROTOCOL_VERSION` 23 → **25** (24 left to the
quest agent).

**Registry (`client/src/render/art/gearVisuals.ts`, data only, append-only):**
* a new base shape → one line in `SHAPE_FAMILY` (family, animation grip, reach). The 11 planned bases of
  ITEMS-SHARED.md §3.3 are already mapped to their nearest family (cleaver → axe, maul2h / polearm → great axe, longbow →
  bow, sling → hand crossbow, sceptre → wand, censer → staff, warhorn / tome → orb, trap_kit → quiver), so they show the
  full 7-generation progression on day one. A test fails if a weapon / off-hand base has no family.
* a new legendary → optional line in `LEGENDARY_VISUAL` (`motif`, optional `sig`, optional `bespoke`). Unlisted
  legendaries still get the generic legendary treatment in their own `colors`. The motif table of ITEMS-SHARED.md §6
  maps straight onto it.
* a new Set → a line in `SET_STYLE` (motif, main / deep colour, signature text).
* a fully bespoke silhouette → a function in `weaponArt.ts BESPOKE` keyed by the registry's `bespoke`.

## 4. Silhouette families (`weaponArt.ts`)
blade, greatblade, axe, greataxe, mace, bow, crossbow, handxbow, staff, wand, shield, quiver, orb — one parametric
drawing each with two layers: **base** (solid art; light painted lit, or dormant) and **light** (only the emissive
parts, baked separately, drawn additively and pulsing by the hero rig, composited with a glow in icons), plus a list of
**floating pieces** (the rig animates them; icons draw them at rest).

## 5. Effects belong to items, not to a rank (V10)
| Effect | Before (rank-driven) | Now (item-driven) | Evidence |
|---|---|---|---|
| Wings | full Set, rank 8+, or any Primal | full 6-piece Set only (the Set's transformation); grade pieces edge them in ember / starlight | W1, G1 |
| Mantle / cape | rank 7 / 6 | 4 Set pieces / a legendary or graded chest from G5 | W1 |
| Ground sigil | rank 5+ | 2+ Set pieces (sockets light per piece) | pass-1 P5 |
| Light column | rank 8+ | removed (light lives on the weapon, V3) | — |
| Body aura | rank 6+ | legendary jewellery, escalating with the count (amulet + 2 rings) | G4 |
| Halo | Ancient helm or rank 8+ | a graded helm (Kindled ember / Fabled starlight) | — |
| Footprints / afterimage | rank 7+ / Primal | legendary / graded boots; a G6 legendary weapon leaves its own footfalls | G1 |
| Heartbeat | any Primal | a Fabled chest | — |
| Weapon light, floats, sheen, sparks, trail colour | weapon tier ≥ 6–8 | the weapon's own generation, rarity, signature, grade and +N | V3–V5, V7 |
| Equip moment | rank-up notice "Gear rank: …" | a weapon whose look passes the session's best and has light of its own: chime + burst; Set complete keeps its notice | — |

## 6. Player-facing ladder: removed (V11)
* Tooltip: the "Heroic · tier VII" strip is gone; the card shows the item's own icon (it breathes in its light for
  G6 legendaries and graded pieces), rarity, `+N` and stars — what the reference games show (MapleStory stars and grade
  outline M4/M5, PoE text colour X2).
* Icons: no tier corner brackets; generation fills the cell (early pieces sit smaller, 70 % → 94 %), the light layer
  glows, a backdrop appears only for lit late / legendary / graded pieces; marks: Set diamond, grade jewels, +N stars.
* Nameplate: no rank medal, no crown; a completed Set shows its mark and a Set-coloured pill.
* Character showcase: no "Gear rank", no pips, no "Next:" hints; Set chips and one sentence on how the look works.
* Ground loot: beams by rarity, taller at G6; late rares get a short pillar; Kindled ember core, Fabled starlight beam;
  late generations lie bigger on the ground.

## 7. Checkpoint: weapon look board (2026-10-11)
`shots-v2/board-icons.jpg` (56 px cells), `board-icons40.jpg` (the bag's 40 px), `board-hero-melee.jpg`,
`board-hero-ranged.jpg` (default game camera), `board-zoom-0..3.jpg` (112 px). Columns: one per generation at the rarity
a levelling hero wears, then a rarity sweep at 70, the signature legendary, Kindled +7 and Fabled +10.
Honest judgement against the references: the step from G0 to G6 now changes silhouette, size, material and light
(V1–V3), every generation is distinguishable at 40 px, legendary signatures read as different objects (V4), Fabled reads
as its own thing. Still weaker: one-handers at hero scale in idle are small (the idle pose hides much of the blade; their
presence comes from size + light + trail), staves at G0–G2 are thin lines in icons (the same as before), and the
crossbow families are busier than the rest. Iterated three times before moving on (v1 → v3: float transform fix, light
toned from white to rarity colour, mace / orb redesigned, bow light along the limb curve, crossbow decluttered).

## 7b. Evidence (1920×1080, visible page target, JPEG in `shots-v2/`)
| What | Before | After |
|---|---|---|
| Weapon / off-hand icons, every base × generation × rarity × grade | `before-icons.jpg` | `board-icons.jpg`, `board-icons40.jpg` (bag size), `board-zoom-0..3.jpg` |
| Weapons on the hero (default camera) | `before-hero-melee.jpg`, `before-hero-ranged.jpg` | `board-hero-melee.jpg`, `board-hero-ranged.jpg` |
| Armour icons | `../shots/icons.jpg` (pass 2) | `armour-icons.jpg` |
| Hero ladder starter → Fabled set, three classes | `../shots/ladder.jpg` (pass 2) | `hero-ladder.jpg` |
| Newcomer vs endgame, town and field (gallery, game camera, all classes) | `../shots/vs-all.jpg` (pass 2) | `vs-town-fabled.jpg`, `vs-town-l70.jpg`, `vs-field-fabled.jpg`, `vs-field-walk.jpg` |
| Two real clients in Hearthmere (level-1 newcomer next to an endgame hero) | `../shots/duo-town.jpg` (pass 2) | `game-warrior-duo-town.jpg`, `game-mage-duo-town.jpg` |
| Endgame hero in a rift with a guardian, elites and telegraphs | `../shots/field-boss.jpg` | `game-mage-field.jpg`, `game-warrior-field.jpg` |
| UI: item card (no tier strip), showcase card (no rank), inspect | `../shots/game-*-tooltip.jpg`, `*-showcase.jpg` | `game-ui-card.jpg`, `game-ui-showcase.jpg`, `game-ui-inspect.jpg` |

**Crowd performance (perf gallery, no monsters, every hero a unique look, after all bakes).** The machine was shared with
other agents' processes during this session (CPU load ~30 % before any bench): the legacy-look reference that pass 2
measured at 145–163 fps (30 heroes) swung between 42 and 163 fps today. Absolute numbers are therefore not comparable with
pass 2's table. The honest comparison is **interleaved A/B in the same minutes** against the pass-2 code (base commit
39ab451 exported read-only to `.local/base`, served by its own Vite), two rounds, best of the 1-second samples / medians:

| Case | Pass 2 (rank effects) | V2 | Draw calls / frame (pass 2 → V2) |
|---|---|---|---|
| 30 heroes, Fabled stage, full effects | best 105 (medians 73 / 89) | best 103 (medians 71 / 98) | 230 → 187 |
| 100 heroes, mixed stages, full | best 47 (medians 34 / 41) | best 51 (medians 39 / 48) | 367 → 342 |
| 100 heroes, Fabled stage, full | best 37 (medians 34 / 21) | best 39 (medians 37 / 21) | 602 → 390 |

[M] No regression against pass 2 within the noise; draw calls drop (the weapon light layer joins the additive batch,
the rank light column is gone). CPU profile of the 100-hero mix: the same distribution as pass 2 plus `placeWeaponFx`
≈ 2 % of samples. Crowd budget: decorative floats and their glows only for the 16 heroes with a presence slot (the
local hero always); structural floats (zenith segments, floating heads, the Fabled Inscription) always show.

**Checks.** `npm run typecheck` clean; `npm test` (isolated `DATA_DIR`) 72 / 72 including the rewritten
`shared/test/gearVisual.test.ts` (generation bands = name bands, round-trip of every packed field, plain items < 2³²,
id capacity for the planned content, append-only orders, item-driven look rules, no rank in the hero summary, every
weapon / off-hand base has a client family, descriptor bytes). `npm run verify`: first run failed only on two
load-sensitive stages (connection drills timing out at 6 s, and the simulation's 3 ms tick-average threshold at
3.01 ms; the base commit measured 2.6–4.3 ms on the same machine in interleaved runs); the rerun passed every stage.

## 8. Decisions
| # | What | Why | Evidence | Rollback |
|---|---|---|---|---|
| V2-D1 | Generation from the existing name bands + cap (7) | art agrees with names players read; endgame drops all sit at 70 | M1, F1; `baseTierIndex` [M] | `GEN_START` |
| V2-D2 | New model every 2nd generation, light from G4 | FFXIV alternation; light spent late | F2, F3, W1 | per-family `switch (g)` |
| V2-D3 | Rarity = embellishment + light colour from the rarity tokens | one colour language across UI and art | M5, T3, X2 | `RARITY_LIGHT` |
| V2-D4 | Legendary = signature bundle + optional bespoke | legendaries are bundles; scale by composition | G1, G2, W2, X2 | registry `sig` / `bespoke` |
| V2-D5 | Kindled ember / Fabled starlight + Inscription ring | lead input; "a unique look" for Fabled | ITEMS-SHARED §7 | `gradeMarks`, `TOP_COLORS` |
| V2-D6 | Size ladders per class, max ×1.5 (×1.72 with legendary + Fabled) | owner wants drama; Terraria bounds ±18 % per modifier | T1, V7 | `GEN_SCALE` |
| V2-D7 | Rank removed; effects item-driven | owner dislikes abstract tiers; GW2 / WoW tie effects to items | G1, G4, W1 | git revert of gearFx / player backOf |
| V2-D8 | Tier strip, medal, crown, icon frames removed | owner request; reference games show rarity + enhancement only | M4, M5, X2 | tooltip / nameplates / icons |
| V2-D9 | Mixed-radix pack, protocol 25 | room for 15 Sets / 120+ legendaries; plain items stay 5 bytes | B5 [M], test | `FIELDS` |
| V2-D10 | Light as a separate baked layer + floats as parts | additive pulse and motion at sprite cost (no per-frame vector work) | perf budget of pass 1 | `weaponL` / `wf*` parts |

## 9. Owner decisions (safe defaults chosen)
1. **How big endgame weapons may get** (§2.6; default max ×1.5 one-handers, ×1.24 two-handers before legendary / grade).
2. Kindled / Fabled colours (ember-orange / white-gold starlight with a cool rim) and whether Fabled should replace the
   legendary's own core colour (default: yes, its colour moves to the rim).
3. Whether the light column should return as part of a specific item family (default: removed).
4. Whether transmog should hide generation / rarity art (default as before: shape from the wardrobe, generation, light and
   grade from the worn item).
