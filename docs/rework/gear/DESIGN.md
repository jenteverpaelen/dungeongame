# Gear visual progression — design (branch `claude/gear`)

Owner request: endgame Legendaries and Sets were "just a different colour and a glow"; a veteran must be unmistakable
from a newcomer from across the screen. Principles P1–P10 come from `REFERENCES.md`. Everything is drawn in code,
original, and derived from item data already in saves (`shared/src/gearVisual.ts`), so no save migration.

## 1. The ladder

### 1.1 Item tier (0–9) — what the item IS
| Tier | Name | Rule | Silhouette / finish added (cumulative) |
|---|---|---|---|
| 0 | Threadbare | normal, ilvl < 12 (starter) | sewn-on patches on chest and legs |
| 1 | Homespun | normal ilvl 12+ · magic ilvl < 12 | iron trim colour |
| 2 | Tempered | normal 36+ · magic 12–35 | bronze trim |
| 3 | Fine | magic 36+ · rare < 24 | pauldron rim + rivet, one belt charm |
| 4 | Masterwork | rare 24–47 | rivet rows, brow jewel, pommel/guard jewels, wizard-hat jewel band |
| 5 | Runic | rare 48+ (Runic / Starforged names) | raised top plate on pauldrons, crest (3 motif elements), weapon runes, boot cuff, 2 charms |
| 6 | Storied | Legendary / Set below ilvl 70 | 2 motif spikes per pauldron, knee cops, chest medallion, crossguard wings, shield spikes, per-piece glow |
| 7 | Heroic | Legendary / Set at ilvl 70 | 3 spikes, crown points, 5-element crest, centre gem, ankle fins, blade serrations, 3 charms |
| 8 | Ancient | Ancient Legendary / Set | amber filigree on helm / chest / shoulders / blade, side wings on the helm, 6 shield spikes |
| 9 | Primal | Primal Ancient | crimson filigree + white core, longest wings / spikes |

The ilvl bands are the existing item-name ladder (`Worn → Sturdy → … → Runic → Starforged`, `data/items.ts`), so the
art agrees with the names players already read. Weapons grow 2.4 % per tier (+22 % at 9) and pauldrons 3.5 % per tier
above 2; hitboxes, reach and collision are untouched (trails follow the drawn blade).

### 1.2 Temper (0–3) — what the player DID (Cube upgrades)
+4 / +7 / +10 (after the first risky step, past the 55 % coin flip, the maximum; `cube.ts UPGRADE_CHANCE`). Temper
adds a light sweep along the weapon (faster per step) and a star orbiting the weapon tip at +10 (P3, R9 "glittering
stars"). Socketed gems show as studs in the gem's colour (chest, helm brow, pommel). Ancient = amber marks, Primal =
crimson marks (P10).

### 1.3 Hero gear rank (0–9) — the summary other players read
Slot-weighted mean of `tier + temper/3` (weapon 2, head/chest/shoulders 1.25, legs/feet/hands/off-hand 1, belt/
bracers/amulet 0.75, rings 0.5; a two-hander with no off-hand counts double), + 0.35 rounding bias, + 0.6 for a full
6-piece Set (0.3 for 4), + 0.3 per Primal (max 0.6). Caps: no Ancient/Primal worn → max 7; no Primal → max 8 (P7).
Measured on the showcase loadouts (`gearShowcase.ts`, test `gear rank climbs…`), identical for all classes:

| starter | L10 | L20 | L30 | L40 | L50 | L60 | L70 | full Set | Ancient Set | Primal Set |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 0 | 2 | 3 | 4 | 5 | 5 | 6 | 7 | 8 | 9 |

## 2. What the rank adds to the hero (live layer, `gearFx.ts`)
1. **Ground sigil** (rank 5+ or a 2-piece Set): a runic ring the size of the shadow; Set sigils have six sockets that
   light one per worn piece (2/4/6 layering is literally visible). Primal: a spiked crimson ring. (P5)
2. **Body aura** (6+): soft breathing glow behind the body in the dominant colour (Set main / Ancient amber / Primal red).
3. **Back piece** (P5, R10): rank 6 → short cape (chest colours, tier-metal hem, clasps); rank 7 or 4-piece Set → long
   mantle with motif medallion; full Set, rank 8+ or any Primal → **wings** in the Set's language (below). Wings always
   spread to both sides (top-down ARPG convention) with yaw-driven asymmetry; they flap slowly, faster while moving.
4. **Per-piece glows** for Storied+ pieces (as before, but by tier).
5. **Particles** (rank 6+, 2-piece Set): motif particles; Ancients add an amber ember stream; pooled, ≤ 18 per hero.
6. **Orbiters**: 4-piece Set → 2 motif tokens orbit at chest height (3 at 6 pieces); rings of tier 3+ orbit as gems.
7. **Footprints** (Storied+ boots, rank 7+, full Set, Primal): motif prints left in the world for ~1 s (P5, R7).
8. **Halo** (Ancient/Primal helm or rank 8+): a ring above the head with glints; Primal: a crown of flame licks.
9. **Primal heartbeat**: every 1.3 s a crimson ring pulses from the chest with red-white sparks.
10. **Full-Set idle flourish**: after 7 s idle, every 6–9 s a burst of the Set's particles and a sigil flare.
11. **Level-up / Paragon**: everything flares for 1.2 s.

## 3. Set identity (P6) — `gearStyle.ts SET_STYLE`
| Set | Motif | Crest / pauldron spikes | Wings / back | Orbiters | Footprints | Particles |
|---|---|---|---|---|---|---|
| Endless Storm (W) | wind | swept gale fins | three gale blades | gale streaks | dust-devil swirls | swirling streaks |
| Siegebreaker (R) | cog | temple cog + antenna, cog spikes | brass frame arm with cogs + pennant | cogs | smoke puffs | sparks |
| Fallen Star (M) | star | star-tipped points | constellation membrane with star nodes | stars | stardust | rising stars |
| Cinder Oath (W) | ember | flame tongues | flame tongues | embers | burning prints | rising embers |
| Fault Warden (W) | stone | rock crystals | floating rock slabs | rock shards | ground cracks | dust |
| Farwatch (R) | feather | feather tufts | hawk-feather fan | feathers | feathers | drifting feathers |
| Rainkeeper (R) | rain | droplet chains | mist lobes with drops | drops + a personal rain cloud | ripples | falling rain |
| Glass Concord (M) | shard | crystal shards | crystal shard fan | glass shards | shard glints | shards |
| Lantern Garden (M) | lantern | leaves with a tiny lantern | two leaves + hanging lantern | lantern glows | petal blooms | floating petals |
2 pieces: sigil + particles; 4: sockets, mantle, orbiters; 6: wings, footprints, idle flourish (the transformation).
Legendaries map to 19 motifs through `LEGENDARY_MOTIF` (e.g. Cindervane → flame licks on the staff head, Thunderhead →
spark flicker, Heart of the Void → swirl at the tip, Bloodwake → drips) — parameterised generators, not 22 sprites.

## 4. Where gear appears
Hero on field and in town; other players (protocol 22: per-slot `fx` + `jw`, +29…+121 bytes per descriptor, sent on
enter / change only); icons, tooltips, ground loot (beams and sigils by tier); nameplate rank medal; character panel
showcase; inspect; level-up flare. Galleries: `gallery-art.html?view=gear-ladder | gear-vs | gear-sets`.

## 5. UI ladder (P4, P9)
Icons: tier frame corners (metal ladder iron → bronze → silver → gold → runic → orange → heroic → amber → crimson),
Set mark, Ancient / Primal corner gems, temper pips. Tooltip: tier strip under the name ("Heroic · tier VII") + temper
stars. Nameplate: medal left of the level badge from rank 2, shape escalating (disc → shield → winged shield → Ancient
filigree → Primal flame). Loot: beam height / width / colour and a ground sigil by tier; Primal adds pulse rings.

## 6. Readability and budget (P8)
Ground layers stay inside ~1.3× the shadow; nothing is drawn over enemies or telegraphs beyond the hero's own footprint;
the hero's own hit area and position are unchanged. Settings: **Gear effects (your hero)** and **Other players'
effects**: full / reduced / off (stored with the existing preferences; `prefers-reduced-motion` caps at reduced).
Reduced = steady glows, sigil, back pieces, no particles, footprints, flapping or sweeps. Off = no live effects (baked
ornaments stay: they are the item's art). Budget: particles thin out with the number of full-effect heroes on screen
(constant total ≈ 8 heroes' worth); per hero ≤ 18 particles + ≤ ~30 effect sprites; ornaments are baked into the hero
sheet (zero per-frame cost).

## 7. Spectacle pass (lead review 2026-10-11: "rank 7-9 only adds ~60 px around a ~100 px hero")
Goal: an overloaded veteran must be spottable from across the screen in a busy field, newcomer vs veteran clear from
afar, not only side by side. Everything still comes from the same profile; budget, toggles and readability rules hold.

| Element | Rank | Rule (world units at the default camera: 1 u = 1.31 px) |
|---|---|---|
| Wings | 7 / 8 / Primal | drawn at 1.62 / 1.98 / 2.58× the base wing; always spread (far wing ≥ 0.62); full Sets keep their silhouette when Primal (recoloured crimson). Target span ≥ 2.2× body width at 8, ≥ 2.6× Primal: measured 2.21–2.80 and 2.88–3.67 |
| Cape / mantle | 6 / 7 | +14 % per rank above 6, flares out behind in profile |
| Ground sigil | 5–9 | 40 / 52 / 64 / 72 / 82 u diameter (≥ 1.8× the 34 u shadow from rank 7), turning slowly; Primal brighter; Set sockets lit per piece |
| Light column | 8+ | soft additive column ~140 u (2× hero height) in the rank colour; Primal: wider, embers rising along it |
| Afterimage ribbon | 7+ | soft band (feet → shoulders) along the last 0.32 s of movement, additive, pooled mesh |
| Orbiters | 4-pc Set, rings 3+ | Set tokens 14–34 u, ring gems 8–14 u |
| Weapon swings | Storied+ weapon | additive accent trail ×1.35 (×1.6 Ancient+) brightness, sparks shed from the tip (visual only) |
| Nameplate | 6+ / 8+ | dark pill + rank/Set coloured glow behind a brighter name; rank 8+ animated crown with a travelling glint, Primal flame licks |
| Rank-up moment | any rank-up (first time this session) or first full Set | notice "Gear rank: …" / "Set complete: …", procedural chime (gear_rank / gear_rank_big), 1.5 s burst: 3 expanding rings, a column of light, a fountain of the motif, wings flare |
| Primal drop | loot | its own procedural stinger (`primal`) |

Readability: all ground effects (sigil, column, ribbon, footprints, Primal heartbeat, rank-up rings) live in a scene
underlay **beneath the telegraph layer**, so enemy warnings always draw on top, and they **dim 45 % while the hero is
fighting** (attacks, casts, hits; 2.5 s), so in combat the warnings dominate and in town the veteran shows off.
Known problems fixed in the same pass: two-handed idle rests the weapon at the side (head clear), next-step hints
read what is worn, shoulder icons show pauldron ornaments, new looks bake within 4 ms per frame (no crowd stall).
