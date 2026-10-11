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

### 2.6 Size (V7, owner decision 1)
Bounded per size class, because small one-handers are the hardest to read on a ~95 px hero [M] and big two-handers
already grow heads and edges per generation in the drawing. Legendary ×1.06, each grade step ×1.04. Reach, hitboxes and
collision are unchanged (the trail follows the drawn tip). Pass 2.1 (lead's hero-scale review): one-handers climb
hardest at G5–G6; the ladder lives in `gearStyle.ts GEN_SCALE` and is independent of the drawings.

| Class | G0 | G1 | G2 | G3 | G4 | G5 | G6 | Legendary + Fabled at G6 |
|---|---|---|---|---|---|---|---|---|
| small (1H, wand, hand crossbow) | 0.90 | 0.98 | 1.08 | 1.20 | 1.36 | 1.56 | **1.80** | 2.06 |
| mid (bow, crossbow, off-hands) | 0.90 | 0.96 | 1.05 | 1.16 | 1.30 | 1.46 | 1.62 | 1.85 |
| large (2H, staff) | 0.88 | 0.94 | 1.00 | 1.07 | 1.15 | 1.24 | 1.34 | 1.53 |

**Size cap proposal (owner decision 1 still open).** The gallery shows three caps for the one-hander ladder at the
default camera (`?view=weapon-hero&cap=1.5|1.8|2.1`; the other classes scale along proportionally):
`shots-v2/p21-cap-1.5.jpg`, `p21-cap-1.8.jpg`, `p21-cap-2.1.jpg`. Measured sword length at G6 [M, reach 31 units ×
scale, 1.306 px / unit]: ×1.5 → 47 units (61 px), **×1.8 → 56 units (73 px)**, ×2.1 → 65 units (85 px, about the hero's
own height). Proposal: **×1.8** — the G6 blade reads at a glance next to a ~95 px hero and still sits below the hero's
height, while ×2.1 makes the Fabled legendary (×2.4, ~74 units) as tall as its bearer. Terraria's ±18 % (T1) bounds
one modifier, not a 70-level climb, so it does not decide this; it is the owner's call.

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

### 2.8 Hold and show pose (pass 2.1; A1–A3, A6)
One rest hold per animation grip (A1, A2: attack / stance sets belong to the weapon category, the item only swaps the
drawing), so a new drawing never needs a new pose. Rule (A3): **the business end breaks the body silhouette at every
facing yaw the game uses, and a weapon is drawn behind the torso only where a body would hide it.**
* `choreo.ts basePose` receives the body yaw (`BaseIn.yaw`, from the rig). Light weapons (1H, wand, hand crossbow) use
  `readableHold(yaw, down)`: forward in profile, out to the hand's side when facing the camera or away; its outward
  (+z) part fades out in profile, because there the weapon hand is on the camera's side of the torso and +z pulls the
  tip back over the body on screen (screen x ≈ 0.91·x − 0.42·z at yaw 65, A6). `lightHand` carries the hand further
  forward and nearer the body line in profile. Wands point level in profile, slightly up facing the camera.
* Bow (left hand, far side in profile): carried forward of the chest in profile; turned away (cos yaw < 0) it goes
  further out to the side. Crossbow at the hip with the stock turned out. Two-handers and staves unchanged (approved by
  the lead: rested at the side, head out behind the shoulder).
* Measure [M] (`?view=weapon-pose`, `window.__pose`, five facings: side 65°, camera 20°, away 158°, side 115°, walk;
  units at scale 1). **ext** = how far the weapon box breaks out of the torso box; **hidden** = its overlap with the
  torso box when drawn behind it (in front, overlap is readable by contrast):

| Family | G0 ext avg / min | G0 hidden avg / max | G6 rare ext avg / min | G6 hidden avg / max |
|---|---|---|---|---|
| sword | 20.6 / 16 | 0.08 / 0.38 | 55.8 / 52 | 0.06 / 0.16 |
| axe | 17.8 / 12 | 0.07 / 0.36 | 56.8 / 52 | 0.06 / 0.16 |
| mace | 17.8 / 13 | 0.08 / 0.40 | 52.8 / 48 | 0.08 / 0.21 |
| wand | 7.8 / 3 | 0.10 / 0.49 | 30.6 / 22 | 0.12 / 0.32 |
| hand crossbow | 13.8 / 7 | 0.06 / 0.29 | 33.4 / 25 | 0.07 / 0.17 |
| bow | 8.2 / 3 | 0.27 / 0.50 | 22.6 / 12 | 0.12 / 0.21 |
| crossbow | 19.4 / 12 | 0.06 / 0.31 | 49.0 / 34 | 0.04 / 0.09 |
| greatsword | 13.8 / 0 | 0.06 / 0.28 | 38.2 / 18 | 0.02 / 0.10 |
| great axe | 15.2 / 7 | 0.06 / 0.31 | 67.4 / 38 | 0.01 / 0.04 |
| staff | 3.6 / 0 | 0.00 / 0.00 | 23.2 / 12 | 0.00 / 0.00 |

  Step 2 of the pass (profile hands) at G0, side 65°: torso cover wand 1.00 → 0.88, hand crossbow 0.92 → 0.72, sword
  0.56 → 0.50, bow (behind) 0.48 → 0.42. Honest limits: a G0 wand in profile still lies mostly over the robe (readable
  only by contrast: the drawing must contrast with cloth); a bow seen from behind is half hidden (a left-hand bow at
  arm's length cannot clear a 31-unit torso); staves are vertical props that read above the head, which the x-extent
  measure does not count. Evidence: `shots-v2/p21-pose-g0.jpg`, `p21-pose-g6.jpg`, `p21-pose-zoom-g0.jpg`,
  `p21-pose-zoom-g6.jpg`, every family on the hero `p21-hero-melee.jpg`, `p21-hero-ranged.jpg`.

## 3. Data format and how content gets its look
**Wire:** `ItemLook.fx` (never stored) = mixed-radix pack of gen (8) · rarity (8) · grade (4) · upgrade (16) · filled
sockets (4) · best gem (8) · gem rank (8) · enchanted (2) · Set id (32) · legendary id (256). Plain items stay below 2³²
(5 msgpack bytes); Set / legendary ids get room for the planned 15 Sets and ~120 legendaries (old: 4 / 5 bits).
Descriptor growth vs no fx [M, test]: +103 B (L70), +129 B (Fabled). `PROTOCOL_VERSION` 23 → **25** (24 left to the
quest agent).

**Registry (`client/src/render/art/gearVisuals.ts`, data only, append-only):**
* a new base shape → one line in `SHAPE_FAMILY` (family, animation grip, reach). The shared-items wave (claude/depth)
  gives its new bases existing shapes (cleaver → `axe`, maul2h / polearm → `axe2h`, longbow → `bow`, sling →
  `handxbow`, rod / sceptre → `wand`, censer → `staff`, warhorn / trap_kit → `quiver`, tome → `orb`), so they show the
  full 7-generation progression on day one; the planned own-shape keys stay in the registry for later. A test fails if a
  weapon / off-hand base has no family.
* a new legendary → optional line in `LEGENDARY_VISUAL` (`motif`, optional `sig`, optional `bespoke`). Unlisted
  legendaries still get the generic legendary treatment in their own `colors`. The motif table of ITEMS-SHARED.md §6
  maps straight onto it; the 13 shared legendaries of that wave are listed (Journeyman's Ring is not in the §6 table:
  `gold` is a placeholder [P]).
* a new Set → a line in `SET_STYLE` (motif, main / deep colour, signature text).
* a fully bespoke silhouette → a function in `weaponArt.ts BESPOKE` keyed by the registry's `bespoke`.

## 4. Silhouette families (`weaponArt.ts`, behind the interface of §11)
blade, greatblade, axe, greataxe, mace, bow, crossbow, handxbow, staff, wand, shield, quiver, orb — one parametric
drawing each with two layers: **base** (solid art; light painted lit, or dormant) and **light** (only the emissive
parts, baked separately, drawn additively and pulsing by the hero rig, composited with a glow in icons), plus a list of
**floating pieces** (the rig animates them; icons draw them at rest). Owner feedback 2026-10-11 ("it looks very ai
made … it all looks the same"): these drawings are **placeholders** until the art-direction pass replaces them through
`registerWeaponDrawing`; pass 2.1 added no drawing and no ornament.

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

## 7c. Pass 2.1 evidence (1920×1080, visible page target, default camera unless noted, `shots-v2/p21-*.jpg`)
| What | Files |
|---|---|
| Every family on the hero, L1 → L13 → L25 → L37 → L49 → L61 → L70 → signature → Fabled +10 | `p21-hero-melee.jpg`, `p21-hero-ranged.jpg` |
| One-hander size cap ×1.5 / ×1.8 / ×2.1 (owner decision 1) | `p21-cap-1.5.jpg`, `p21-cap-1.8.jpg`, `p21-cap-2.1.jpg` |
| Hold pose, every family × five facings, G0 and G6 (+ ×3 zoom of the light weapons) | `p21-pose-g0.jpg`, `p21-pose-g6.jpg`, `p21-pose-zoom-g0.jpg`, `p21-pose-zoom-g6.jpg` |
| Combat strip per generation: Cleave with sword / great axe, bow shot, wand missile, frozen at fixed ms after the cast (hero art + the real Vfx module fed the server's events) | `p21-strike-gen.jpg` (L1 … L70 rare), `p21-strike-top.jpg` (L70 rare, legendary, signature, Kindled +7, Fabled +10) |
| Newcomer vs endgame **without Set wings** (Set pieces shown as legendaries, `?noset=1`) | `p21-vs-warrior-fabled-noset.jpg`, `p21-vs-mage-fabled-noset.jpg`, `p21-vs-ranger-L70.jpg`, ×3 zoom all classes `p21-vs-all-fabled-noset-z3.jpg`, `p21-vs-all-L70-noset-z3.jpg` |
| Real clients in a rift (isolated server, no page errors): L70 warrior, Fabled-set ranger | `p21-game-warrior-field-1.jpg`, `p21-game-ranger-field-4.jpg` |

**Crowd A/B (pass 2.1 working tree vs HEAD cba0692 exported to `.local/base21`, own Vite, interleaved, two rounds,
best / medians of 1-second samples).** The machine was again shared with other agents' processes (absolute fps are
below this morning's table for both sides), so only the interleaved comparison counts:

| Case | HEAD (V2) | Pass 2.1 | Draw calls / frame (HEAD → 2.1) |
|---|---|---|---|
| 30 heroes, Fabled stage, full effects | best 70 (medians 55 / 48) | best 75 (medians 59 / 72) | 181 → 176 |
| 100 heroes, mixed stages, full | best 37 (medians 22 / 32) | best 35 (medians 22 / 33) | 337 → 326 |
| 100 heroes, Fabled stage, full | best 31 (medians 25 / 30) | best 31 (medians 26 / 24) | 394 → 396 |

[M] No regression within the noise (the perf gallery attacks through the rig: trails, glow ribbon and strike bursts are
included; the Vfx-side skins are per-event tints plus one aura sprite per skinned projectile).

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
| V2-D11 | One yaw-aware rest hold per grip; light weapons forward in profile, out to the side otherwise | readability rule A3; ext / hidden measure | A1–A3, A6, §2.8 [M] | `choreo.ts readableHold`, `lightHand` |
| V2-D12 | One-hander ladder to ×1.8 (proposal), caps shown at 1.5 / 1.8 / 2.1 | lead's hero-scale review; owner decision 1 open | §2.6 [M], `p21-cap-*.jpg` | `GEN_SCALE` |
| V2-D13 | Attacks read `WeaponPresentation` from the drawing (colours, anchors, strength), never motifs or rarity | art agent replaces drawings without touching VFX | A4, A5, §10 | `weaponSkin.ts`, VFX `skinOf` |
| V2-D14 | Weapon drawings behind `weaponDrawing.ts` (family registry) | owner: current drawings feel generic; new art swaps in per family | §11 | `DEFAULT_WEAPON_DRAWINGS` |

## 9. Owner decisions (safe defaults chosen)
1. **How big endgame weapons may get** (§2.6; proposal ×1.8 one-handers, ×1.62 bows / off-hands, ×1.34 two-handers
   before legendary / grade; compare `p21-cap-1.5|1.8|2.1.jpg`).
2. Kindled / Fabled colours (ember-orange / white-gold starlight with a cool rim) and whether Fabled should replace the
   legendary's own core colour (default: yes, its colour moves to the rim).
3. Whether the light column should return as part of a specific item family (default: removed).
4. Whether transmog should hide generation / rarity art (default as before: shape from the wardrobe, generation, light and
   grade from the worn item).

## 10. Attack presentation (pass 2.1; A4, A5, V7, V8)
The attacks read **only** the drawing's `WeaponPresentation` (§11) through `weaponSkin.ts weaponSkinOf(look)`: light,
core, edge colours, a strength, the light anchors (tip / base of the striking part) and an optional particle hint. No
motif, rarity or legendary logic lives in the VFX code, so a new drawing changes its attacks by returning other data.
Default drawings: strength 0 for unlit items (a newcomer's attacks look exactly as before), else
0.25 + 0.1·generation + 0.35 signature + 0.2·grade + 0.05·temper (G3 rare 0.55, G6 rare 0.85, signature 1.2, Kindled +7
≈ 1.75, Fabled +10 ≈ 2.1); every size saturates at 1.6, above that only colour and the hint change.

| Consumer | What changes | Where |
|---|---|---|
| Swing trail | span × (1 + 0.22·s) along the drawing's anchors; a wide soft additive ribbon in `core` from s ≥ 0.6 | `player.ts updateTrail` |
| Strike flash | at the action's strike moment (swing / double / leap slam / overhead): flash in `light`, core, a ring in `edge`, 2–7 sparks, 2 hint particles (ember / star / shard); pooled, ≤ 28 sprites per hero | `weaponImpact.ts` |
| Muzzle (shots) | tinted `core`, × (1 + 0.35·s) | `player.ts` |
| Projectiles | physical arrow / bolt / missile / spark take `light` (elemental shots keep the element colour, A4); a soft aura in `edge` / `light`; motes by the hint; size × (1 + min(0.4, 0.22·s)); impact flash | `vfx/projectiles.ts` |
| Hit flash | on damage from a skinned hero, in `light`, radius 12 + 8·s | `vfx/combat.ts` |
| Cleave arc | the physical arc mixes from the default cream towards `light` by 0.18 + 0.16·s (max 0.5); a thin inner arc in `edge` from s ≥ 0.8; **radius never changes** (it shows the real hit area) | `vfx/aoe.ts`, `casts.ts` |

Restraint (G2 / V8, owner: no more glow): the first combat strip turned the Fabled hit into a white blob hiding the
target, so flash sizes were cut by about a third, saturated at s = 1.6, hint particles 3 → 2, hit-flash alpha
0.6 / 0.85 → 0.45 / 0.7, projectile aura 0.42 → 0.32. Evidence: `p21-strike-gen.jpg`, `p21-strike-top.jpg` (the white
training dummy is its own existing hit flash).

**Crowd budget.** The local hero always gets everything. Other players: the skin is dropped from the Vfx side while the
particle budget is below 0.45 (`VfxCore.skinOf`; the budget already falls under load); their hit flash is × 0.6; the
glow ribbon, the strike ring and sparks and decorative floats only for the 16 presence slots (`GearFx.rich`); the core
strike flash for everyone whose gear effects are not off. Measured: §7c (no regression).

## 11. The weapon-drawing interface (for the art-direction pass)
`client/src/render/art/weaponDrawing.ts`. One function per silhouette family replaces the placeholder drawing; the
rig, the poses, the size ladder, icons, ground loot, the attack presentation and the crowd budget stay untouched.

```ts
type WeaponDrawFn = (input: WeaponDrawInput) => WeaponDrawing;
registerWeaponDrawing(family: WeaponFamily, fn: WeaponDrawFn): void;   // e.g. at module load of the new art file

interface WeaponDrawInput {          // family × generation × rarity × signature × grade → drawing
  look: ItemLook;                    // shape, stored colours (primary / secondary / glow), packed fx
  style: ItemStyle;                  // gen 0..6, rar 0..4, special, top (1 Kindled, 2 Fabled), temper (+N step),
                                     // legendary / set ids, sig / bespoke, motif, palette (metal, edge, dark, trim,
                                     // wood, wrap), light colours (light, edgeLight), gem, floats budget
  family: WeaponFamily; shape: string;
  reach: { tip: number; base: number };   // canonical reach of the family (units along −y)
  rig: boolean;                      // true: on the hero; false: icon (may thicken thin parts)
}
interface WeaponDrawing {
  draw(c: Ctx, layer: 'base' | 'light'): void;  // 'base' = solid art, 'light' = emissive parts only (drawn additive, pulsed)
  readonly floats: WFloat[];         // floating pieces {x, y, draw, bob, orbit, spin, phase, glow, glowR, deco}
  readonly lit: boolean;             // has a light layer at all
  readonly present: WeaponPresentation;  // what the attacks read (§10)
}
interface WeaponPresentation {
  light: number; core: number; edge: number;   // 0xRRGGBB; light 0 = plain attacks
  strength: number;                  // 0 plain … ~1.2 legendary … ~2 Fabled +10 (sizes saturate at 1.6)
  tip: [number, number]; base: [number, number];  // the striking part's light anchors (the trail runs base → tip, the strike flash sits at the tip)
  impact?: 'spark' | 'ember' | 'star' | 'shard';
}
```
Frame: hand-local units at scale 1, **grip at the origin, business end towards −y** at the family's canonical reach
(bows: limbs along ±y, belly +x). The rig applies `GEN_SCALE`, the pose, the rotation and depth sorting; do not scale by
generation inside the drawing unless the silhouette itself grows. Floats with `deco: true` are dropped outside the
16 presence slots. Results are cached per look (`weaponDrawing(look, rig)`), so a drawing must be pure and
deterministic. Families: blade, greatblade, axe, greataxe, mace, bow, crossbow, handxbow, staff, wand, shield, quiver,
orb. The pose readability limits of §2.8 (a G0 wand in profile reads by contrast with the robe) are inputs for the art.
