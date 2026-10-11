# Shared content — rules, tags, power templates, shared legendaries, bases, affixes, item grades, gear motifs (v2)

Read with `WARRIOR.md`, `RANGER.md`, `MAGE.md`, `BUDGET.md`, `BUILD-TOOLS.md` and `NAMES.md`. Labels: **[M]** measured in
this repo, **[P]** proposal, **[S]/[SN]/[K]** reference evidence as defined in `REFERENCES.md`, **[NEW-BEHAVIOUR]** needs
new server code. v2 (2026-10-11) follows the owner's direction to let players discover builds (`BUILD-TOOLS.md`).

## 0. Rules for everything that ships

1. **No shipped build names.** Nothing that ships may say or imply "this is the X build":
   * item names, item text, set names and set descriptions;
   * skill and rune text, UI, tooltips, loading tips and patch notes.

   Text describes mechanics only ("Your Channel skills cost 25% less"), never a playstyle label or a recommended
   combination. The class documents' build tables are **internal test fixtures** for the parity harness; their names
   (Gyre, Faultline, …) are working labels that never appear in game data or text.
2. **Tags are authoritative.** An item or set that says "your Projectile skills" applies to exactly the skills whose tag
   line shows Projectile — including tags a rune adds or removes. No hidden tags (the PoE ambiguity this avoids is in
   `REFERENCES.md` §6).
3. **Ids never change.** Display names may change (`NAMES.md`); skill, rune, node, legendary, set, base and affix ids
   stay stable forever, because build codes and the data export depend on them (`BUILD-TOOLS.md` T5/T7).
4. **Named-skill items are the minority.** About three-quarters of the new legendaries and every set bonus key off tags
   or mechanics. Named-skill signatures (one per skill, mostly weapons) are a small chase layer.

| Topic | Today [M] | v2 |
|---|---|---|
| Runes per skill | 3, unlock at skill unlock + 2 / 5 / 9 | 5, unlock at + 2 / 5 / 9 / **14 / 20**, clamped to 70 [P] |
| Skill unlocks | 1, 2, 4, 6, 9, 12 | + **16, 20, 26, 32, 40, 50** (plan §3.2) |
| Categories | none | a display `category` per skill [P] (display grouping only; tags do the mechanics) |
| Tags | none | 22 mechanic tags + 5 element tags on every skill and rune (§1) [P] |
| Second primary | one primary per class; `save.skills.primary` already selectable | a second primary per class at L16 |
| Upgrade tiers | 3 tiers per skill (2/4/6 points), 69 points by L70 | unchanged |
| Specialization nodes | none | 6 per skill, ranks 1–3, N4/N5/N6 need 2 ranks in N1/N2/N3, **max 10 of 18 ranks per skill** |
| Node points | — | **separate pool (lead decision a)**: 1 point per level from L21 = **50 at L70** — see below |
| Respec | tiers free [M] | free for skills, runes, tiers, nodes, passives; loadouts (`BUILD-TOOLS.md` T4) |
| Passives | 6 per class, 4 slots at 10/20/30/70 | 14 per class (8 new rules-changing, unlocks 14/18/24/28/36/45/55/64), slots unchanged |
| Top item grades | Ancient (×1.3 affixes) / Primal (max rolls) — D3's ladder [M/K] | **Kindled / Fabled** (§7); no extra multiplier (lead decision b) |

**Lead decision (a) — separate node pool: confirmed, with a size challenge.**
* Count the right totals: a character can only benefit from the **5 active trees** (primary + 4 slots), at most
  5 × 10 = 50 ranks. The 12 × 6 × 3 = 216 possible ranks are not the binding total.
* With 61 points at L70 every active tree is full and 11 points are spare. Because respec is free and loadouts exist,
  the spare points buy nothing, so there is no trade-off at level 70.
* The real trade-off is inside each tree: 10 of 18 ranks (56%) and prerequisites. That is Last Epoch's structure:
  5 specialisation slots, a skill-level cap of 20, and more nodes than points (`REFERENCES.md` §3).
* Proposal [P]: **1 point per level from L21 (50 at L70)**. Every active tree fills exactly at max level; while
  levelling (e.g. 20 points at L40) players choose which trees to deepen first.
* If the lead wants a cross-tree trade-off at L70 as well, 45 points (one tree at 5) is the next step; the parity model
  is unaffected either way (nodes are not modelled).

**Lead decision (b) — no chase multiplier for the top tier: confirmed.**
* The sweep in `BUDGET.md` §5 breaks parity at any 6-piece above ×1.3, and D3's own test of +800% per Ancient item was
  rolled back to +100% [S, `REFERENCES.md` §4].
* The top tier becomes rolls + looks + a build-bending Inscription (§7).

**Lead decision (c) — approved changes, applied:**
* The Ninefold Gale's roll covers Whirlwind and Dust Devils.
* Lantern Garden becomes a Summon set.
* Frost Nova moves into the Chill set (Hoarfrost Vigil).

## 1. Tags and power templates

### 1.1 Tag vocabulary [P]

Tags are data on `SkillDef` (`tags: Tag[]`) and `RuneDef` (`addTags`, `removeTags`); the element tag follows the current
element (`mods.element` [M]). The tooltip shows them on one line (`BUILD-TOOLS.md` T1).

| Group | Tag | Meaning |
|---|---|---|
| Role | **Primary** | the automatic attack (generates resource) |
| | **Spender** | an attack whose main job is spending resource |
| | **Channel** | held/channelled, drains resource per second |
| | **Cooldown** | has a cooldown |
| | **Buff** | grants the player (and possibly allies) a timed bonus |
| | **Movement** | moves the player (today: Dash on Space) |
| Delivery | **Strike** | a melee weapon hit |
| | **Projectile** | launches projectiles (including lobbed shells) |
| | **Piercing** | its projectiles or beams pass through, skip or chain to further enemies |
| | **Area** | hits everything in a region |
| | **Aerial** | strikes from above (falling stones, arrows, stars) |
| | **Ground** | leaves a lasting ground effect (molten ground, fields, banners, pitch) |
| | **Summon** | creates entities that act on their own |
| | **Device** | a mechanical summon (turret, mortar, trap) |
| | **Beast** | a living animal summon |
| | **Trap** | waits and triggers when enemies arrive |
| Effect | **Bleed** · **Burn** | applies that damage-over-time |
| | **Chill** | chills or freezes |
| | **Stun** | stuns or immobilises |
| | **Displace** | knocks back or pulls enemies |
| | **Mark** | marks a target that takes more damage |
| Element | **Physical · Fire · Cold · Lightning · Arcane** | follows the current element |

### 1.2 Tags of every skill [P]

| Class | Skill (id) | Tags |
|---|---|---|
| Warrior | Cleave (`cleave`) | Primary, Strike, Area, Physical |
| | Tolling Blow (`tolling_blow`) | Primary, Strike, Stun, Physical |
| | Whirlwind (`whirlwind`) | Channel, Spender, Strike, Area, Physical |
| | Ironplough (`ironplough`) | Channel, Spender, Strike, Area, Displace, Physical |
| | Rend (`rend`) | Spender, Area, Bleed, Physical |
| | Sawtooth Hatchet (`sawtooth_hatchet`) | Spender, Projectile, Piercing, Bleed, Physical |
| | Ground Stomp (`ground_stomp`) | Cooldown, Area, Stun, Physical |
| | Seismic Slam (`seismic_slam`) | Spender, Area, Displace, Physical |
| | Cairnfall (`cairnfall`) | Cooldown, Aerial, Area, Stun, Physical |
| | Battle Rage (`battle_rage`) | Buff, Physical |
| | Muster Standard (`muster_standard`) | Buff, Cooldown, Ground, Physical |
| | Kilnheart (`kilnheart`) | Buff, Cooldown, Burn, Fire |
| Ranger | Hungering Arrow (`hungering_arrow`) | Primary, Projectile, Piercing, Physical |
| | Skipstone Bolt (`skipstone_bolt`) | Primary, Projectile, Piercing, Physical |
| | Multishot (`multishot`) | Spender, Projectile, Piercing, Physical |
| | Cluster Arrow (`cluster_arrow`) | Spender, Projectile, Area, Fire |
| | Overcast Volley (`overcast_volley`) | Spender, Aerial, Area, Physical |
| | Rain of Vengeance (`rain_of_vengeance`) | Cooldown, Aerial, Area, Ground, Physical |
| | Sentry (`sentry`) | Summon, Device, Cooldown, Projectile, Physical |
| | Spring Snare (`spring_snare`) | Summon, Device, Trap, Area, Stun, Physical |
| | Pitch Mortar (`pitch_mortar`) | Summon, Device, Area, Ground, Burn, Fire |
| | Companion (`companion`) | Summon, Beast, Physical |
| | Quarry Mark (`quarry_mark`) | Cooldown, Mark, Physical |
| | Murmuration (`murmuration`) | Cooldown, Summon, Beast, Area, Physical |
| Mage | Magic Missile (`magic_missile`) | Primary, Projectile, Arcane |
| | Rime Needles (`rime_needles`) | Primary, Projectile, Chill, Cold |
| | Meteor (`meteor`) | Spender, Aerial, Area, Ground, Burn, Fire |
| | Stormglass Orb (`stormglass_orb`) | Spender, Projectile, Area, Lightning |
| | Thrumming Ray (`thrumming_ray`) | Channel, Spender, Piercing, Arcane |
| | Black Hole (`black_hole`) | Cooldown, Area, Ground, Displace, Arcane |
| | Frost Nova (`frost_nova`) | Cooldown, Area, Chill, Cold |
| | Rimefield (`rimefield`) | Cooldown, Area, Ground, Chill, Cold |
| | Hydra (`hydra`) | Summon, Projectile, Fire |
| | Cinderkin (`cinderkin`) | Summon, Area, Burn, Fire |
| | Magic Weapon (`magic_weapon`) | Buff, Arcane |
| | Orrery (`orrery`) | Cooldown, Summon, Area, Arcane |
| All | Dash | Movement |

**Runes that change tags** (everything else keeps the skill's tags; element runes switch the element tag):
* **Warrior**
  * Cleave: Hemorrhage Arc +Bleed.
  * Whirlwind: Dust Devils +Summon; Gyre of Ash +Ground +Burn; Tethered Spin +Displace.
  * Rend: Gathering Tear node +Displace.
  * Seismic Slam: Permafrost +Chill.
  * Tolling Blow: Furnace Clapper +Burn.
  * Sawtooth Hatchet: Kiln-Heated +Burn.
  * Muster Standard: Ember Pennant +Area.
  * Ironplough: Stone Spray +Projectile; Smouldering Share +Burn.
  * Cairnfall: Waymarker and Kiln Stones +Ground (Kiln Stones also +Burn).
  * Kilnheart: Cold Forge −Burn +Chill.
* **Ranger**
  * Hungering Arrow: Barbed Shaft +Bleed.
  * Sentry: Polar Station +Chill; Flame Lance −Projectile +Area.
  * Cluster Arrow: Freezing Charge +Chill.
  * Rain of Vengeance: Flood Plain +Chill.
  * Companion: Badger Sett +Stun; Heron +Chill.
  * Skipstone Bolt: Ripple +Chill; Heavy Stone −Piercing +Displace; Marker Bolt +Mark.
  * Spring Snare: Pitch-Soaked +Ground +Burn; Bramble Spring +Projectile.
  * Overcast Volley: Freezing Drizzle +Chill; Pinning Shower +Stun.
  * Quarry Mark: Falcon Strike +Beast.
  * Pitch Mortar: Grapeshot +Projectile −Ground; Frostpot −Burn +Chill.
* **Mage**
  * Magic Missile: Glacial Spike +Chill; Static Thread +Piercing.
  * Meteor: Comet −Burn +Chill; Lodestone +Displace.
  * Black Hole: Absolute Zero +Chill.
  * Hydra: Frost Hydra +Chill; Forked Tongues +Piercing.
  * Magic Weapon: Ignite +Burn; Chilling Edge +Chill.
  * Rime Needles: Arcane Thorns −Chill +Piercing.
  * Thrumming Ray: Frostline +Chill; Searing Thread +Burn.
  * Cinderkin: Frostkin −Burn +Chill; Lanternkin +Projectile.
  * Rimefield: Static Frost −Chill.
  * Stormglass Orb: Hailglass +Chill.
  * Orrery: Comet Ring +Aerial; Frozen Moons +Chill.

### 1.3 Power template kinds

Every legendary power, set bonus, Inscription and rules-changing passive is one or more templates. **Every template takes
a target selector**: a tag set (any-of / all-of), the player (`*`), or — for the signature layer only — one named skill.
"Bucket" is where the number lands in `server/src/sim/damage.ts baseMult()` [M]:
`coef × (1+main) × (1+skillPct) × (1+ele) × (1+generic) × own(mult) × vulnerability × crit`.

| Template | What it does | Bucket / mechanism [M] | Existing examples [M] | Magnitude band [P] |
|---|---|---|---|---|
| `skillDamage` | +v% increased damage to the selected skills | additive skill bucket | Faultcleaver, Bloodwake, Lanternroot, Cindervane, Thunderhead (150–200) | named weapon signature 150–200; primary/off-hand named 100–150; **tag additive 40–90** |
| `skillMods` | any `SkillMods` field with one rolled field | `mergeMods` | Rainspindle, Starfall Mantle, Sapper's Pack | cost/cooldown 15–40%; counts +1–2 |
| `skillFlag` | grants a behaviour flag | `flags` | Ninefold Gale, Bulwark | — |
| `skillMore` | ×(1+v%) on the selected skills, optionally conditional or per stack | own bucket (`Strike.mult`) | none today | 25–40% conditional, 4–8% per stack (max 5) |
| `vulnerability` | enemies in a state take +v% from you | `vulnerability()` | Anvil Vambraces 25–30, Heart of the Void 20–25, Hunter's Mark 15–20 | 12–30% |
| `buff` / `buffOnEvent` | a buff on an event or while a state holds | generic bucket / `live.*` | Hellforge Talisman, Stridewind | 10–30% with an uptime condition |
| `stat` | flat character stat | `computeStats` | Witching Cord, Fists of the Mountain | as affix maxima |
| `element` / `conversion` | element swap or +v% to one element | `ele` / `mods.element` | Thunderhead, Ouroboros Loop | 30–40% conditional |
| `proc` | on an event, cast a strike, summon or ground | generic proc hook [NEW-BEHAVIOUR] | death hooks of runes | 40–80% weapon damage, internal cooldown |
| `resource` / `cooldown` | refunds, cost cuts, cooldown refunds | `gainResource`, `readyAt` | Seal of the Patient Thief | 0.05–0.5 s per event; 3–5 resource |
| `tagGrant` **(new)** | adds a tag to a skill (e.g. "Aerial skills also count as Projectile") | tag resolution | none | Inscriptions only (§7) |
| `noSet` | bonus only while no set bonus is active | generic bucket | none | 2–3% per equipped legendary, max 10 |
| `setReduce` **(new)** | set bonuses need one fewer item (minimum 2) | set counting | none | Journeyman's Ring only |
| `defensive` | damage reduction / control immunity | damage-taken multiplier | Girdle of the Eternal Gyre | 15–30% DR while a state holds |

One generic **conditional multiplier** serves `skillMore`, `vulnerability` and the set 6-pieces. Its predicate is one of:
* a target state: stunned, frozen, chilled, bleeding, burning, displaced, marked, inside your Ground, farther than N;
* a player state: channelling, standing still, in own Ground, a Buff active, no enemy within N.

Building it once replaces most per-item [NEW-BEHAVIOUR] work.

**Cube** [M]:
* up to three extracted powers, one per `CubeSlot` (weapon / armor / jewelry);
* an extracted power rolls at the range maximum and does not stack with an equipped copy;
* Ancient status (Kindled after §7) does not change legendary values.
* [P]: Journeyman's Ring and Patchwork Signet **cannot be extracted** — their cost is the jewelry slot they occupy.

## 2. Shared legendaries (6 existing + 13 new)

Existing [M]: Ouroboros Loop (ring), Seal of the Patient Thief (ring), Hellforge Talisman (amulet), Witching Cord (sash),
Stridewind Greaves (boots), Fists of the Mountain (gauntlets).
* **Proposed change [P]:** Ouroboros Loop **150–200% → 60–80%**. In the v2 diversity search it sat in 7–8 of every
  class's 9–11 top kits even at 60–80% (`BUDGET.md` §4), because an unconditional rotating multiplier fits every build.
  This is owner-visible; a further cut to 40–60% or an element-specific rework is the next step if the harness confirms.

The v1 shared items were universal (always-on damage, "above 80% Life", elite bonus). In the v1 model they filled 4–6
footprint slots of every legendary kit. v2 keys each one to a tag or mechanic, so different main skills pick different
ones (`BUDGET.md` §4 shows no item in every top kit).

| Legendary | Base (slot) | Power (`{v}` = rolled) | Range | Template | Cube | Keys off |
|---|---|---|---|---|---|---|
| **Patchwork Signet** | Ring | While no set bonus is active, each equipped legendary item increases your damage by {v}% (max 10 items) and reduces damage taken by 1%. | 2–3 | noSet | — (not extractable) | no set |
| **Journeyman's Ring** | Ring | Set bonuses require one fewer item (minimum 2). Does not stack. | — | setReduce | — (not extractable) | sets |
| **Watchkeeper's Hood** | Hood (head) | While no enemy is within 200 units, your Projectile and Aerial skills deal {v}% more damage. | 20–30 | skillMore (cond.) | armor | Projectile, Aerial |
| **Kilnwatch Spaulders** | Plate Spaulders (shoulders) | Casting a Cooldown skill grants {v}% increased damage for 5 s. | 15–20 | buffOnEvent | armor | Cooldown |
| **Hearthguard Coat** | Hauberk (chest) | While channelling or standing in one of your Ground effects, you deal {v}% increased damage and take 15% less damage. | 20–30 | buff (state) | armor | Channel, Ground |
| **Ink-Stained Gloves** | Gloves (hands) | Your Primary skills deal {v}% increased damage; every 5th Primary attack repeats once. | 50–75 | skillDamage + proc | armor | Primary |
| **Causeway Waders** | Waders (legs) | After you stand still for 1 s, your Summons and Ground effects deal {v}% more damage until you move. | 25–35 | skillMore (cond.) | armor | Summon, Ground |
| **Ridgewalker Boots** | Boots (feet) | Every 100 units you move adds a stack (max 5): your Spender skills deal {v}% more damage per stack; stacks fall off after 2 s standing still. | 4–6 per stack | skillMore (stacking) | armor | Spender |
| **Surveyor's Plumb** | Amulet | Your Marks also apply to the nearest other enemy, and Marked enemies take {v}% more damage from you. | 20–30 | vulnerability (marked) | jewelry | Mark |
| **Brine Tally** | Ring | Killing an enemy that suffers your Bleed or Burn adds a tally (max 20); at 20 your attack speed and cooldown recovery are {v}% faster for 10 s. | 15–20 | buffOnEvent | jewelry | Bleed, Burn |
| **Signal Horn Charm** | Amulet | Your Summons deal {v}% more damage. | 15–25 | skillMore | jewelry | Summon |
| **Lockglass Cincture** | Belt (waist) | Your Channel skills cost {v}% less, and you cannot be knocked back while channelling. | 20–30 | resource + defensive | armor | Channel |
| **Wardkeeper's Cuffs** | Bracers (wrists) | Enemies you Stun, Chill or Displace take {v}% more damage from you for 3 s. | 12–18 | vulnerability (controlled) | armor | Stun, Chill, Displace |

Flavour (original):
* Patchwork Signet "Mended so often there is nothing original left."
* Journeyman's Ring "Fits any hand that has learned two trades."
* Watchkeeper's Hood "Venn never takes it off. Never."
* Kilnwatch Spaulders "Warm on the coldest watch."
* Hearthguard Coat "It smells of bread and smoke."
* Ink-Stained Gloves "Orren counts people. These count blows."
* Causeway Waders "Sera lent them out once."
* Ridgewalker Boots "Tallis wore through three pairs."
* Surveyor's Plumb "Iven trusts it more than the ground."
* Brine Tally "Neris notches it every evening."
* Signal Horn Charm "Small enough to forget, loud enough to remember."
* Lockglass Cincture "Aven says it holds still on purpose."
* Wardkeeper's Cuffs "Mera's keys, melted down."

## 3. New item bases (42 → 80)

Today [M]: head 6, shoulders 4, chest 5, hands 3, wrists 1, waist 2, legs 3, feet 3, amulet 1, ring 1, 1H 5, 2H 5,
off-hand 3 = 42. Target: every slot ≥3 shapes overall and every class ≥2 weapon shapes per hand; +38 bases = 80. Armour
names use the existing `armorNames(noun)` ladder (Worn → Sturdy → Reinforced → Masterwork → Runic → Starforged) so the art
and names agree with the gear ladder (`docs/rework/gear/DESIGN.md` §1.1) [M]. `armorMult` and weapon stats sit between the
existing neighbours of the same material [P].

### 3.1 Armour (+21)
| id | kind | noun (→ ladder) | armorMult | material | affinity | sockets | shape idea for the parametric art |
|---|---|---|---|---|---|---|---|
| `head_coif` | head | Coif | 0.7 | mail | warrior, ranger | 1 | mail hood that falls to the shoulders, open face |
| `head_mask` | head | Mask | 0.55 | leather | ranger | 1 | half-face leather mask with eye slits, strap behind |
| `head_widebrim` | head | Wide-Brim Hat | 0.5 | cloth | ranger, mage | 1 | broad flat brim, low crown, band (Iven's hat) |
| `shoulders_furmantle` | shoulders | Fur Mantle | 0.6 | leather | ranger, warrior | 0 | thick fur ruff over both shoulders, clasp at the throat |
| `shoulders_capelet` | shoulders | Capelet | 0.5 | cloth | mage | 0 | short layered cloth cape ending at the elbows |
| `chest_brigandine` | chest | Brigandine | 0.95 | leather | ranger, warrior | 3 | cloth-covered coat with visible rivet rows |
| `chest_vestment` | chest | Vestment | 0.72 | cloth | mage | 3 | layered long tabard over a robe, embroidered hem |
| `chest_apron` | chest | Smith's Apron | 0.85 | leather | warrior | 3 | heavy apron over a bare-armed tunic, tool loops (frontier smith) |
| `hands_mitts` | hands | Mitts | 0.45 | cloth | mage | 0 | padded mittens with a separate thumb |
| `hands_fingerless` | hands | Fingerless Gloves | 0.5 | leather | ranger | 0 | gloves cut at the knuckles, wrist strap |
| `wrists_cuffs` | wrists | Cuffs | 0.4 | cloth | mage | 0 | wide cloth cuffs with stitched runes |
| `wrists_vambraces` | wrists | Vambraces | 0.55 | plate | warrior | 0 | hinged forearm plates with a raised ridge |
| `wrists_wraps` | wrists | Arm Wraps | 0.42 | leather | ranger | 0 | cord-bound leather strips with a bracer pad |
| `waist_girdle` | waist | Girdle | 0.55 | plate | warrior | 0 | wide plated belt with a central boss |
| `waist_cord` | waist | Charm Cord | 0.38 | cloth | mage, ranger | 0 | knotted rope with hanging charms |
| `legs_chaps` | legs | Chaps | 0.8 | leather | ranger | 2 | open-sided leather chaps over trousers |
| `legs_tassets` | legs | Tassets | 0.95 | mail | warrior | 2 | mail skirt with plate lames at the hip |
| `legs_waders` | legs | Waders | 0.78 | leather | ranger, mage | 2 | high boots-and-trousers in one, tar-dark (causeway waders) |
| `feet_wraps` | feet | Foot Wraps | 0.4 | cloth | mage | 0 | bound cloth wrappings, bare toes |
| `feet_sandals` | feet | Sandals | 0.42 | leather | ranger, mage | 0 | thick-soled sandals with ankle cords |
| `feet_clogs` | feet | Iron-Shod Clogs | 0.6 | metal | warrior | 0 | wooden clogs with iron bands (kiln and mill workers) |

### 3.2 Jewelry (+6)
| id | kind | noun | names by tier (0–5) | shape idea |
|---|---|---|---|---|
| `neck_torc` | neck | Torc | Torc, Twisted Torc, Banded Torc, Gilded Torc, Runic Torc, Starforged Torc | open rigid neck ring with knobbed ends |
| `neck_charm` | neck | Charm | Charm, Carved Charm, Bone Charm, Warding Charm, Runic Charm, Starforged Charm | cord with one carved token |
| `neck_locket` | neck | Locket | Locket, Brass Locket, Silver Locket, Engraved Locket, Runic Locket, Starforged Locket | hinged oval case on a chain |
| `ring_band` | ring | Band | Plain Band, Wide Band, Banded Ring, Etched Band, Runic Band, Starforged Band | wide flat band, no stone |
| `ring_signet` | ring | Signet | Seal, Signet, Crest Ring, House Signet, Runic Signet, Starforged Signet | flat-faced seal ring |
| `ring_coil` | ring | Coil | Wire Coil, Copper Coil, Spiral, Double Coil, Runic Coil, Starforged Coil | spiral wire wrapped twice |

The existing `ring` ladder already uses "Band" and "Signet" as tier names [M]; the new bases take those as their *nouns*,
so rename the old ladder's tiers 1 and 2 to "Loop" and "Circle" [P] to avoid two bases sharing a name.

### 3.3 Weapons and off-hands (+11)
| id | kind | class | names by tier (0–5) | aps / dmgMult | anchor | shape idea |
|---|---|---|---|---|---|---|
| `cleaver` | 1H | warrior | Chopper, Cleaver, Butcher's Blade, Broad Cleaver, Runic Cleaver, Starforged Cleaver | 1.25 / 1.1 | between axe (1.3/1.06) and mace (1.2/1.14) | wide rectangular blade, short haft |
| `maul2h` | 2H | warrior | Mallet, Maul, Great Maul, Kiln Hammer, Runic Maul, Starforged Maul | 1.0 / 1.8 | slower and heavier than the great axe (1.1/1.7) | long haft, brick-shaped head (Kilnmaw) |
| `polearm` | 2H | warrior | Pike, Bill, Glaive, Halberd, Runic Glaive, Starforged Halberd | 1.1 / 1.65 | between greatsword (1.15/1.6) and great axe | long haft, hooked blade |
| `sling` | 1H | ranger | Sling, Leather Sling, Shot Sling, Staff-Sling, Runic Sling, Starforged Sling | 1.5 / 0.85 | between hand crossbow (1.6/0.9) and nothing slower: the skip-stone weapon | cord and pouch, stone in the cup |
| `longbow` | 2H | ranger | Self Bow, Long Bow, War Bow, Yew Longbow, Runic Longbow, Starforged Longbow | 1.2 / 1.45 | between bow (1.4/1.25) and crossbow (1.1/1.6) | tall straight stave, taller than the hero |
| `rod` | 1H | mage | Rod, Iron Rod, Etched Rod, Lodestone Rod, Runic Rod, Starforged Rod | 1.2 / 1.15 | heavier than the wand (1.4/1.0) | short straight metal rod with a knob |
| `sceptre` | 1H | mage | Baton, Sceptre, Crowned Sceptre, Orb Sceptre, Runic Sceptre, Starforged Sceptre | 1.3 / 1.08 | between rod and wand | rod with a small cage head |
| `censer` | 2H | mage | Censer, Chain Censer, Ember Censer, Lantern Censer, Runic Censer, Starforged Censer | 1.1 / 1.65 | slightly faster, lighter than the staff (1.0/1.75) | lantern on a chain from a short pole (Lantern Garden fits it) |
| `warhorn` | off-hand | warrior | Horn, Cow Horn, War Horn, Brass Horn, Runic Horn, Starforged Horn | armorMult 0.4 | between quiver (0.3) and shield (1.0): no block, a buff off-hand | curved horn on a strap |
| `trap_kit` | off-hand | ranger | Snare Bag, Trap Kit, Hook Pouch, Trapper's Kit, Runic Kit, Starforged Kit | armorMult 0.3 | = quiver; allowed with ranged two-handers like the quiver [M rule] | satchel with hooks and coiled wire |
| `tome` | off-hand | mage | Notebook, Tome, Ledger of Stars, Grimoire, Runic Tome, Starforged Tome | armorMult 0.3 | = orb | thick book on a chain, glowing page edge |

## 4. Sets as building blocks — structure decision

**Decision [P]:** keep the 2/4/6 thresholds, make every bonus tag-keyed so one set serves several skills, put most of the
value in the 2- and 4-piece, cap the 6-piece (transform + ×1.25, or ×1.35 while a condition holds), and add **one shared
set-reduction ring** (Journeyman's Ring). Evidence and alternatives: `REFERENCES.md` §7.

* **Why not 2/2/2 charms like D4** [S]? They live outside armour slots, which is a new item system and slot type.
  Existing saves, set ids and the gear visuals (sigil sockets lighting per piece, mantle at 4, wings at 6 [M,
  `docs/rework/gear/DESIGN.md` §2–3]) assume six armour pieces. The ring gets most of the benefit cheaply:
  * **5 + ring** → the 6-piece bonus with one footprint slot free for a legendary;
  * **3 + 3 + ring** → two 4-piece bonuses;
  * **2 + 2 + 2** (no ring) → three 2-piece bonuses.
* **What the model shows** (`BUDGET.md` §4): with tag-keyed bonuses, 3–5 of each class's 5 sets appear in a top kit,
  and every set is the best 4-piece hybrid for at least one main skill. The configurations used span 6-piece, 5 + ring, 4 + 2 free and 3 + ring. No set is in every top kit.
* **Footprints:** each set covers six armour slots. Three sets (Furrowmark, Snarewright, Hollowstar Choir) cover head,
  shoulders, chest, hands, **belt and bracers** instead of legs and feet. Which legendaries a set blocks is part of the
  choice.
* **Gear visuals with the ring:** count *worn pieces* for the sigil sockets and wings, and the *effective* count for
  bonuses [P]. A 5 + ring wearer shows five lit sockets and gets the 6-piece bonus; wings stay a six-piece reward for the
  look.

| Class | Set | Keys off | 2-piece / 4-piece / 6-piece (summary; full text in the class doc §7) |
|---|---|---|---|
| Warrior | Raiment of the Endless Storm | Channel | cheaper channels / channel bleed + damage reduction / wind wisps orbit while channelling, ×1.25 |
| | Fault Warden | Stun | bigger, faster Stun skills / Spender aftershock on stunned + Stun skills 15% more / fault lines re-stun, ×1.35 vs stunned |
| | Cinder Oath | Bleed, Burn, Primary | bleeds burn / Primary hits extend damage-over-time, +20% vs afflicted / cinder pools, ×1.25 |
| | Hearthbanner | Buff, Primary | shorter Buff cooldowns / Primary +25% with two Buffs up / Ground buffs follow you, shockwaves, ×1.25 while a Buff is up |
| | Furrowmark (belt+bracers) | Displace, Channel | farther Displace / collision stuns, +35% vs displaced / furrows, ×1.25 |
| Ranger | Siegebreaker's Arsenal | Device, Spender | +1 each Device / Devices fire your Spender Projectiles at 20% / ×(1 + 0.1 per Device) |
| | Farwatch | Projectile, Piercing | one more pierce/skip / cheaper Projectile Spenders, Piercing 15% more / farwatch shot, ×1.35 at range |
| | Rainkeeper | Aerial, Ground | bigger, faster Aerial cooldowns / cheaper Spenders and Aerial +15% / storm follows you, ×1.35 inside |
| | Thicket Kin | Beast | Beast speed and Hatred / +1 each Beast, Beast marks / bites leap, ×1.25 |
| | Snarewright (belt+bracers) | Trap, Stun, Device | +1 Trap, faster arming / Devices hunt stunned, Traps 15% more / re-arming traps, ×1.35 vs stunned |
| Mage | Regalia of the Fallen Star | Aerial, Spender | Aerial skills strike twice / element signs +5% each / falling star every 4th Spender, ×1.25 |
| | Glass Concord | Projectile | +1 projectile / splits inside your Ground, Projectiles +10% / shatter on kill, ×1.25 |
| | Lantern Garden | Summon | +1 each Summon / lanterns speed up Summons / ember sprites, ×1.25 |
| | Hoarfrost Vigil | Chill, Ground | faster, bigger Chill and Ground skills / +20% vs frozen / chill becomes freeze, ×1.35 vs chilled |
| | Hollowstar Choir (belt+bracers) | Channel, Arcane | faster channel ramp / Channel +15%, Buffs doubled / beams refract, ×1.35 at full power |

## 5. New affixes (33 → 55)

Ranges are level-70 values like the existing table and use the same `affixScale` kinds [M]; each is anchored to an existing
affix of the same bucket so a new stat does not out-scale its legendary counterpart [P]. v2: the skill-group affixes key off
the tags of §1 (Summon, Primary, Spender, Cooldown, Channel, Bleed/Burn = damage-over-time, Stun/Chill = control).

| stat | P/S | Label | Slots: range | scale | group | Anchor |
|---|---|---|---|---|---|---|
| `dotDmg` | P | Damage-over-time effects you apply deal {v}% more damage | neck, wrists, off-hand: 15–20 | pct | `dot` | = element affixes 15–20 |
| `summonDmg` | P | Your summons deal {v}% increased damage | head, shoulders, neck, off-hand: 10–15 | pct | — | = `skillDmg` 10–15 (same additive bucket) |
| `primaryDmg` | P | Your primary attack deals {v}% increased damage | 1H, 2H, hands, ring: 15–20 | pct | — | = `area`-sized slot spread, skill bucket |
| `spenderDmg` | P | Resource-spending skills deal {v}% increased damage | chest, legs, ring: 8–12 | pct | — | below `skillDmg` because it covers several skills |
| `cooldownDmg` | P | Skills with a cooldown deal {v}% increased damage | head, shoulders, neck: 8–12 | pct | — | as above |
| `vsControlled` | P | Damage against stunned, frozen or immobilised enemies increased by {v}% | 1H, 2H, neck: 5–8 | pct | — | = `elite` 5–8 (multiplicative) |
| `areaRadius` | P | Area skills have {v}% larger radius | head, shoulders, off-hand: 6–10 | pct | — | below the lowest radius tier (+25) |
| `channelCost` | P | Channelled skills cost {v}% less | hands, waist, off-hand: 10–15 | pct | — | between `rcr` 4–8 and Lockglass Cincture 20–30 |
| `ccDuration` | P | Your stuns, freezes and immobilises last {v}% longer | hands, wrists, off-hand: 8–12 | pct | — | below Trapper's Instinct 20% |
| `summonDuration` | P | Your summons last {v}% longer | waist, feet: 10–15 | pct | — | below Sentry's 50% tier |
| `buffDuration` | P | Your buffs last {v}% longer | head, neck: 10–15 | pct | — | below Battle Rage's 50% tier |
| `resourceOnKill` | P | +{v} resource per kill | 1H, 2H, head, ring: 2–4 | flat (unscaled) | — | = Red Ledger's per-kill refund 3–5 |
| `pierceChance` | P | Projectiles have {v}% more chance to pierce | ranged 1H/2H, quiver, hands: 8–12 | pct | — | 1/4 of Puncturing Arrow's +50 |
| `meleeDR` | P | Reduces damage from melee attacks by {v}% | shoulders, chest, off-hand: 4–6 | pct | `dr` | below `eliteDR` 5–7 |
| `rangedDR` | P | Reduces damage from ranged attacks by {v}% | shoulders, chest, off-hand: 4–6 | pct | `dr` | as above |
| `dashCdr` | P | Dash cooldown reduced by {v}% | feet: 8–12 | pct | — | 1/5 of Stridewind's 50%; feet have only one primary affix (`ms`) today |
| `ccReduction` | S | Reduces the duration of control effects on you by {v}% | head, shoulders, neck: 10–20 | pct | — | secondary like `pickup` |
| `globeHeal` | S | Health globes heal {v}% more | waist, legs, ring: 15–25 | pct | — | = `goldFind` 15–25 |
| `globeChance` | S | Elites have {v}% more chance to drop a health globe | chest, legs, feet: 10–20 | pct | — | secondary |
| `moveWhileChannel` | S | +{v}% movement speed while channeling | legs, feet: 10–15 | pct | — | = `ms` 10–12 band |
| `lifeOnControl` | S | Stunning, freezing or immobilising an enemy heals {v} Life | hands, wrists: 2,000–3,000 | flat | — | below `lifePerHit` 3,000–4,500 on the same slots |
| `chillOnHit` | S | {v}% chance on hit to chill enemies for 1 s | 1H, 2H, hands: 5–10 | pct | — | small proc chance (D3 had chance-on-hit control affixes before Loot 2.0 [K]) |

`MAGIC_PREFIX`/`MAGIC_SUFFIX` entries [P]: Festering (dotDmg), Shepherd's (summonDmg), Striking (primaryDmg), Spendthrift
(spenderDmg), Patient (cooldownDmg), Pinning (vsControlled), Broad (areaRadius), Humming (channelCost), Binding
(ccDuration), Lingering (summonDuration/buffDuration), Reaping (resourceOnKill), Piercing (pierceChance), Braced (meleeDR),
Sheltered (rangedDR), Quick-footed (dashCdr); suffixes of Composure (ccReduction), of Plenty (globeHeal), of the Larder
(globeChance), of Drifting (moveWhileChannel), of Mercy (lifeOnControl), of Rime (chillOnHit).

## 6. Gear-visual motifs for the new sets and legendaries

The gear system draws motifs from data (`client/src/render/art/gearStyle.ts`: 19 motifs, `SET_STYLE` with main/deep colour
and a signature, `LEGENDARY_MOTIF`) [M]; per `docs/rework/gear/DESIGN.md` §3 a set shows sigil + particles at 2 pieces,
sockets + mantle + orbiters at 4, wings + footprints + idle flourish at 6. New motifs need a generator each [P]:

| Set | Motif | main / deep | Crest + pauldron spikes | Wings / back (6) | Orbiters (4) | Footprints | Particles | Signature line |
|---|---|---|---|---|---|---|---|---|
| Hearthbanner (W) | **banner** (new) | 0xd8b45a / 0x5a1e18 | pennant tails, flag-pole finials | two long banners with a hearth sigil | small pennants | drum-beat dust rings | cloth scraps, sparks | "Muster: twin war-banners, pennant orbit, drumbeat steps" |
| Furrowmark (W) | **furrow** (new) | 0x9aa1a6 / 0x3d2f20 | plough-share blade, iron share points | two curved mouldboard blades with soil spray | clods of earth | furrow lines | soil specks | "Ploughline: mouldboard wings, clod orbit, furrowed steps" |
| Thicket Kin (R) | **antler** (new) | 0xb59a6a / 0x2a3320 | antler tines, leaf-and-antler | antler-branch frame with leaves | leaves | paw prints | leaves and seeds | "Thicket: antler wings, leaf orbit, paw steps" |
| Snarewright (R) | **knot** (new) | 0x8f9a9e / 0x3b3020 | knotted cord loops, hook teeth | net-and-rope fan with hooks | tiny iron jaws | rope-coil prints | hemp fibres | "Snare: rope-net wings, jaw orbit, coil steps" |
| Hoarfrost Vigil (M) | **frost** (exists as a legendary motif) | 0xdff6ff / 0x2c4458 | icicle crown, hanging icicles | frost-feather lattice | snow crystals | frost prints | snowflakes | "Vigil: icicle wings, crystal orbit, frost steps" |
| Hollowstar Choir (M) | **chime** (new) | 0xc8b6ff / 0x231d3d | twin-tine tuning fork, horn cups | concentric sound-ripple rings | chime bars | ripple rings | note-shaped motes | "Choir: ripple wings, chime orbit, ringing steps" |

Redesigned sets keep their motifs (wind, stone, ember, cog, feather, rain, star, shard, lantern) [M]; Rainkeeper's
existing "personal rain cloud" orbiter now matches its 6-piece.

**Legendary → motif** (`LEGENDARY_MOTIF`, parameterised generators, no per-item sprite) [P]:

| Motif | New legendaries |
|---|---|
| wind | Gale-Stitched Legguards, Ridgewalker Boots, Wingbeat Boots |
| stone | Quakestep Sabatons, Fissure-Lined Breastplate, Tremor Signet, Cairnwright's Hammer, Stonecount Gauntlets |
| ember / flame | Ashgrip Gauntlets, Kilnmaw, Slagforged Helm, Coalheart Locket, Powderkeg Crossbow, Fuse-Burnt Boots, Powder Horn, Tar-Stained Jerkin, Mortarman's Pack, Fuse Cord Belt, Kindling Rod, Firekeeper's Gloves, Kilnwatch Spaulders |
| blood | Tanner's Pauldrons, Red Ledger, Grinning Saw, Woodcutter's Grips, Sawyer's Ring |
| gold | Bellwright's Maul, Belfry Pauldrons, Brass Warhorn Helm, Furycord Belt, Seething Sigil, Thresher's Knot, Patchwork Signet, Journeyman's Ring, Brine Tally |
| holy | Ward Pennant Shield, Quartermaster's Cuirass, Rally Knot, Hearthguard Coat |
| banner | (set only) |
| furrow | Coulter Blade, Yoke Greaves, Ox-Harness Belt, Millwheel Edge |
| feather | Featherguard Cuffs, Hawkfeather Cap, Huntsman's Pauldrons, Starling Longbow, Roost Charm |
| cog | Bolt-Thrower's Arbalest, Bowyer's Gloves, Bandolier Belt, Tripline Crossbow |
| rain / storm | Squallcatcher Pauldrons, Raincount Ring, Highcloud Longbow, Overcast Hood, Weathervane Ring, Stormglass Prism, Conductor's Legwraps, Static Loop |
| leaf / antler | Kennel-Wood Bow, Trailhide Breeches, Whistle Charm, Spotter's Repeater |
| knot | Snarehand Gloves, Coiled Wire Bracers, Skipping-Stone Quiver, Lockglass Cincture |
| frost | Riverstone Repeater, Skimmer's Leggings, Frostlocked Wand, Winterbound Robe, Rimecourt Band, Hoarneedle Wand, Frostthread Gloves, Snowglobe Pendant, Cistern Staff, Rimewalker Slippers |
| star | Craterheart Amulet, Armillary Staff, Star-Chart Robe, Clockmaker's Ring |
| void | Undertow Staff, Horizon Cowl |
| shard | Glasswright's Wraps, Echoing Bead |
| lantern | Coiled Pauldrons, Lanternkeeper's Sash |
| arcane | Glyphstone Orb, Spellwright's Circlet, Runeweaver Cuffs |
| chime | Resonant Staff, Hornlistener Circlet, Signal Coil, Signal Horn Charm |
| shadow | Watchkeeper's Hood, Surveyor's Plumb, Wardkeeper's Cuffs, Causeway Waders, Ink-Stained Gloves |

Each legendary also needs a `colors` triple (primary, secondary, glow) like the existing 22 [M]; the class agent picks them
from the motif's palette. Names of all new items still need the release naming audit (P11 report: the scoped item naming
pass is not trademark clearance) [M].

## 7. Item grades: Kindled and Fabled (replacing Ancient / Primal)

**Owner (2026-10-11):** "primal sets should become mythic items or smth, i dont wanna copy full diablos tooltip and like
rank design etc". Today's ladder is D3's:
* `AncientTier` 0/1/2 in `shared/src/types.ts`;
* `ANCIENT_MULT = 1.3` on affixes and weapon damage at tier 1, all rolls at maximum at tier 2 (`shared/src/items.ts`);
* drop chances 10% and 1/400 (the latter at difficulty ≥ 6);
* gear-visual tiers 8 "Ancient" and 9 "Primal" [M].

References for top tiers (D4 Ancestral/Greater Affixes/Mythic Uniques, Last Epoch Primordial, Grim Dawn Mythical
relics, Lost Ark grades) are in `REFERENCES.md` §8.

**Name.** "Mythic" is D4's top tier (and "Mythical" Grim Dawn's relic tier), so it would read as a copy. Proposed:
**Kindled** (grade 1) and **Fabled** (grade 2). Neither is a tier name in any ARPG/MMO I could find [SN]. Both fit the
hearth/kiln world (`docs/rework/CAST.md`), and "Fabled" carries the owner's "mythic" meaning without the word.

**Concept: breadth, not depth** (original against D3's ×1.3 and D4's ×1.5 Greater Affix) [P]:

| Grade | Drops | What changes | What never changes |
|---|---|---|---|
| **Kindled** (1) | ilvl-70 legendary or set item, 10% (today's Ancient chance, unchanged) | one **extra primary affix** — the *kindled affix*, drawn from the slot's normal pool, normal ranges, marked with an ember; affix count 5 primary + 2 secondary instead of 4 + 2 | no affix, weapon-damage or power multiplier |
| **Fabled** (2) | 1/400 at difficulty ≥ 6 (today's Primal chance, unchanged) | all affixes (kindled affix included) at maximum, plus one **Inscription**: a rule change from a slot-keyed pool (below); a unique look | no damage multiplier; only **one Inscription is active** at a time (like Last Epoch's one Primordial item [SN]) |

Stat effect [inferred]: an Ancient item gets +30% on six affixes; a Kindled item gets a seventh affix (+1/6 ≈ +17% of
its affix value), so endgame stats drop a few percent on 10% of items — small next to the set-multiplier change in
`BUDGET.md`.

**Inscription pool [P]** — each is a `tagGrant`, `skillFlag` or `proc` template, never a multiplier:

| Slot group | Inscription |
|---|---|
| Weapons | Your Primary skill also gains the tags of the skill in slot 1. |
| Weapons | Your Piercing projectiles return to you once after their last hit. |
| Head / shoulders | Your Aerial skills also count as Projectile skills (and Projectile skills as Aerial). |
| Head / shoulders | Your Cooldown skills store one extra charge. |
| Chest / legs | Your Channel skills can be used at full movement speed. |
| Chest / legs | Your Summons inherit your Bleed and Burn effects. |
| Hands / feet | When a Movement skill ends, your most recent Ground skill is cast there at half size (once per 8 s). |
| Hands / feet | Your Stuns also Chill, and your Chills count as Stuns for item powers. |
| Belt / bracers | Your Buff skills do not expire in combat; they cost their resource again every 10 s instead. |
| Belt / bracers | Your Spender skills refund 30% of their cost when they hit 5 or more enemies. |
| Jewelry | Your Ground effects follow you at half size. |
| Jewelry | Your Displace effects also Mark the enemies they move. |

**Data and save migration [P]** — ids and old saves stay readable:
1. **Keep the stored field.** Keep `ancient: 0 | 1 | 2` in saves, the protocol (`ancient?: AncientTier`) and the gear
   descriptor (2 bits, `gearVisual.ts`) so no packed format changes. Rename the type to `ItemGrade` with an alias
   `AncientTier = ItemGrade`. Display names change: 1 = Kindled, 2 = Fabled.
2. **New fields:** `kindledAffix?: number` (index of the extra affix in `affixes`), `inscription?: string` (stable id
   from the pool), and `legacyGrade?: true`.
3. **Generation (`items.ts`):** new items no longer apply `ANCIENT_MULT` (keep the constant for legacy reads only).
   Grade 1 adds one primary affix and sets `kindledAffix`. Grade 2 also rolls every affix at maximum and picks an
   Inscription for the slot. Weapon damage gets no grade multiplier.
4. **Save revision N+1:**
   * every item with `ancient === 1` keeps its stored affix values and ranges exactly (no silent nerf of owned items) and
     gets `legacyGrade: true`; the Mystic offers a one-time free *rekindle* that rerolls it into the new form;
   * every item with `ancient === 2` keeps its maximum values and receives an Inscription picked deterministically
     (`hash(item.id) mod pool size` within its slot group).

   The game has not launched, so legacy items exist only in playtest saves.
5. **Other code paths:**
   * `cube.ts` salvage bonus (+1 soul) keys on grade ≥ 1;
   * `itemCollection.ts` exclusion and `campaignSets.ts` / `itemRecipes.ts` `ancientAllowed` options keep their meaning
     (rename the options with aliases);
   * `loot.ts` prefixes become "Kindled " / "Fabled ";
   * the gear-visual tiers stay 8 and 9, and showcase stage ids `ancient` / `primal` stay as internal ids with new labels.
   * The colours (today amber and crimson, D3's) and tooltip treatment are the lead's UI work; a suggestion: ember-orange
     for Kindled (close to today's amber) and a white-gold "starlight" for Fabled instead of crimson.
6. **Tests:**
   * golden saves with grade-1 and grade-2 items load and display identically except for names;
   * a rekindled item has normal ranges and a kindled affix;
   * a migrated Fabled item always gets the same Inscription.
