# Skill and rune names — keep, rename or decide (display text only; ids never change)

Owner rule (2026-10-11, via the lead): names are allowed to be generic; **keep** an everyday word or a name used across
several games unless there is a clearly better original fit; **rename** names that point at Diablo specifically; give
**options** where it is borderline. Scope: every skill, rune and upgrade tier in `shared/src/data/skills.ts` [M], plus the
names this bible added. The game-wide register (difficulties, Paragon, Cube, rift, obelisk, resources) belongs to the
completion agent; resource names are listed once at the end as a hand-off.

**Evidence.** Collisions were checked against the official Diablo III skill and rune lists of all seven classes, read
2026-10-11 on eu.diablo3.blizzard.com/en-us/class/{class}/active/ **[S]**, the Barbarian passive list **[S]**, and
general knowledge of Diablo II and Diablo IV skill names **[K]** (no official D4 skill page was read). Groups:
**(a)** generic — keep · **(b)** distinctive Diablo coinage — rename · **(c)** borderline — options and a recommendation.

**The bundle rule.** A generic name stops being harmless when the same skill keeps the Diablo III name *and* its runes keep
the Diablo III rune names *and* the same effects. Example: Multishot with Fire at Will, Arsenal and Full Broadside, or
Cluster Arrow with Maelstrom, Shooting Stars and Loaded for Bear, are word-for-word the Diablo III skill pages [S], so a
Diablo III player recognises the whole page. Where a skill keeps its generic name, at least two of its three old runes
are renamed so the page no longer reads as a copy. New runes 4 and 5 are already original.

## 1. Skills (18 existing)

| Skill (id) | Group | Display name | Reason |
|---|---|---|---|
| Cleave (`cleave`) | a | **Cleave** | everyday word, also used in World of Warcraft and Path of Exile [K] |
| Whirlwind (`whirlwind`) | a | **Whirlwind** | everyday word; used in Diablo II, III, IV and World of Warcraft [K] |
| Rend (`rend`) | a | **Rend** | everyday word; used in many games [K] |
| Ground Stomp (`ground_stomp`) | a | **Ground Stomp** | plain description; the lead lists it as generic |
| Seismic Slam (`seismic_slam`) | c | **Quakeline** (rec.) / Fault Slam | a two-word coinage from the Diablo III Barbarian page [S]; "seismic" alone is generic, but the pair reads as Diablo III |
| Battle Rage (`battle_rage`) | a | **Battle Rage** | plain English; used in several games [K] |
| Hungering Arrow (`hungering_arrow`) | b | **Tracking Arrow** | "Hungering Arrow" is a distinctive Diablo III coinage [S]; "Tracking Arrow" describes the seeking shot (a search found it only in one unrelated metroidvania) |
| Sentry (`sentry`) | a | **Sentry** | everyday word; turrets called sentries are common [K] |
| Multishot (`multishot`) | a | **Multishot** | used across many games [K]; the bundle rule renames its runes |
| Cluster Arrow (`cluster_arrow`) | c | **Burst Arrow** (rec.) / keep | descriptive, but the Diablo III skill page uses exactly this name with the same grenade behaviour [S]; a search found no "Burst Arrow" in other ARPGs |
| Rain of Vengeance (`rain_of_vengeance`) | b | **Arrowfall** | distinctive Diablo III phrase [S]; "Arrowfall" found in no ARPG by search |
| Companion (`companion`) | a | **Companion** | everyday word; its animal runes are renamed (below) |
| Magic Missile (`magic_missile`) | a | **Magic Missile** | tabletop-game spell name used across many games [K] |
| Meteor (`meteor`) | a | **Meteor** | everyday word |
| Black Hole (`black_hole`) | a | **Black Hole** | science term |
| Frost Nova (`frost_nova`) | a | **Frost Nova** | used in Diablo II/III/IV and World of Warcraft [K] — generic across games |
| Hydra (`hydra`) | a | **Hydra** | mythological creature; its "X Hydra" runes are renamed (bundle) |
| Magic Weapon (`magic_weapon`) | a | **Magic Weapon** | tabletop-game spell name [K] |

## 2. Runes (54 existing)

| Skill | Rune | Group | Display name | Reason |
|---|---|---|---|---|
| Cleave | Rupture | a | Rupture | everyday word |
| Cleave | Broad Sweep | c | **Wide Swath** (rec.) / keep | plain words, but the Cleave page uses the same three runes [S] → bundle |
| Cleave | Gathering Storm | c | **Static Edge** (rec.) / keep | common phrase; bundle with Rupture + Broad Sweep on the same skill [S] |
| Whirlwind | Dust Devils | a | Dust Devils | natural phenomenon; kept as the one recognisable anchor of the skill |
| Whirlwind | Blood Funnel | b | **Red Draw** | Diablo III coinage [S] |
| Whirlwind | Volcanic Eruption | c | **Ember Gale** (rec.) / keep | everyday phrase; bundle |
| Rend | Ravage | a | Ravage | everyday word |
| Rend | Bloodlust | a | Bloodlust | everyday word (also World of Warcraft) [K] |
| Rend | Lacerate | c | **Deep Rake** (rec.) / keep | everyday word, but Ravage + Lacerate + Bloodlust is the Diablo III Rend page [S] → rename one |
| Ground Stomp | Wrenching Smash | b | **Drawing Stomp** | Diablo III coinage [S] |
| Ground Stomp | Jarring Slam | b | **Ringing Stomp** | Diablo III coinage [S] |
| Ground Stomp | Foot of the Mountain | b | **Kiln Heel** | distinctive Diablo III phrase [S] |
| Seismic Slam | Shattered Ground | c | **Scorched Seam** (rec.) / keep | phrase used on two Diablo III pages [S] |
| Seismic Slam | Permafrost | a | Permafrost | everyday word |
| Seismic Slam | Rumble | a | Rumble | everyday word |
| Battle Rage | Into the Fray | a | Into the Fray | common idiom |
| Battle Rage | Marauder's Rage | b | **Full Boil** | Diablo III coinage; "Marauder" is also a Diablo III set name [S/K] |
| Battle Rage | Ferocity | a | Ferocity | everyday word |
| Hungering Arrow | Puncturing Arrow | c | **Through-Shot** (rec.) / keep | descriptive, but part of the Diablo III page [S]; the skill is renamed anyway |
| Hungering Arrow | Shatter Shot | c | **Splinter Frost** (rec.) / keep | as above |
| Hungering Arrow | Devouring Arrow | b | **Gorging Shaft** | Diablo III coinage [S] |
| Sentry | Spitfire Turret | c | **Rocket Rack** (rec.) / keep | Diablo III rune [S]; "spitfire" is generic |
| Sentry | Chain of Torment | b | **Arc Line** | Diablo III coinage [S] |
| Sentry | Polar Station | b | **Cold Bolts** | Diablo III coinage [S] |
| Multishot | Fire at Will | a | Fire at Will | common idiom (kept; the other two are renamed for the bundle rule) |
| Multishot | Arsenal | c | **Rocket Kit** (rec.) / keep | everyday word; bundle |
| Multishot | Full Broadside | c | **Heavy Volley** (rec.) / keep | nautical idiom; bundle |
| Cluster Arrow | Maelstrom | c | **Homing Rockets** (rec.) / keep | everyday word; bundle |
| Cluster Arrow | Shooting Stars | a | Shooting Stars | everyday phrase (kept as the one anchor) |
| Cluster Arrow | Loaded for Bear | c | **Single Charge** (rec.) / keep | idiom; bundle |
| Rain of Vengeance | Dark Cloud | a | Dark Cloud | everyday phrase |
| Rain of Vengeance | Beastly Bombs | b | **Firedrop** | Diablo III-era coinage [K] |
| Rain of Vengeance | Stampede | a | Stampede | everyday word |
| Companion | Pack Leader | a | Pack Leader | everyday phrase |
| Companion | Bat Companion | b | **Bat** | the "Animal Companion" pattern is Diablo III's rune naming [S] |
| Companion | Raven Companion | b | **Raven** | as above |
| Magic Missile | Seeker | a | Seeker | everyday word |
| Magic Missile | Split | a | Split | everyday word |
| Magic Missile | Glacial Spike | c | **Frost Spike** (rec.) / keep | Diablo II skill and Diablo III rune [K/S]; bundle |
| Meteor | Star Pact | b | **Heavy Sky** | Diablo III coinage [S] |
| Meteor | Comet | a | Comet | everyday word |
| Meteor | Meteor Shower | a | Meteor Shower | everyday phrase |
| Black Hole | Event Horizon | a | Event Horizon | science term |
| Black Hole | Spellsteal | c | **Starve the Light** (rec.) / Siphon Well | Diablo III rune and a World of Warcraft mage spell [S/K] |
| Black Hole | Absolute Zero | a | Absolute Zero | science term |
| Frost Nova | Shatter | a | Shatter | everyday word |
| Frost Nova | Bone Chill | b | **Marrow Cold** | Diablo III coinage [S] |
| Frost Nova | Deep Freeze | a | Deep Freeze | everyday phrase |
| Hydra | Arcane Hydra | b | **Arcane Spit** | "X Hydra" runes are Diablo III's pattern on the same skill [S] |
| Hydra | Frost Hydra | b | **Frost Spit** | as above |
| Hydra | Mammoth Hydra | b | **Elder Hydra** | Diablo III coinage [S] |
| Magic Weapon | Ignite | a | Ignite | everyday word |
| Magic Weapon | Electrify | a | Electrify | everyday word |
| Magic Weapon | Force Weapon | b | **Deep Glyph** | Diablo III coinage [S] |

## 3. Upgrade tiers (54 existing)

All tier names are original or generic (Honed Edge, Blood Tithe, Momentum, Wider Gyre, Endless Spin, Eye of the Storm,
Deep Wounds, Frugal Butcher, Contagion, Aftershock, Quick Feet, Seismic Reach, Fault Line, Tremor Economy, Wide Rift,
Seething, Red Mist, Unbridled, Fletcher, Twin Draw, Bloodscent, Reinforced Frame, Rapid Assembly, Custom Engineering,
Volley Drill, Extra Quivers, Hatred Harvest, Black Powder, Wide Payload, Frugal Fuse, Hail of Shafts, Wide Storm,
Sharpened Fangs, Alpha, Twin Bond, Focused Will, Arcane Battery, Echoing Bolt, Heavier Stars, Crater, Celestial Discount,
Singularity, Short Orbit, Gravity Well, Rime, Glacial Pulse, Permafrost Ring, Many Heads, Longevity, Brood, Lasting Glyph,
Free Glyph, Overcharge) → **keep**. Two notes: "Gravity Well" is not on any Diablo III page [S] — it is a common
science/game term, so it stays (the lead asked; there is no reason to rename); **Vengeance Renewed** → **Squall Renewed**,
only because it names the renamed skill.

## 4. Names this bible added — corrections

v1/v2 names only need to avoid being a recognisable copy (owner). Re-checked against the same lists:

| Where | v1 name | Group | Now | Reason |
|---|---|---|---|---|
| Cluster Arrow rune 5 | Cold Snap Charge | b | **Freezing Charge** | contains "Cold Snap", a Diablo III Frost Nova rune [S] |
| Companion rune 5 | Heron Companion | b | **Heron** | "Animal Companion" pattern [S] |
| Cairnfall rune 1 | Landslide | c | **Scree Line** | a Diablo IV Druid skill name [K]; replaced to be safe |
| Seismic Slam node N3 | Upheaval | b | **Heave** | a Diablo IV Barbarian slam skill [K], same class fantasy |
| Frost Nova node N4 | Chill Aura | b | **Lingering Cold** | near-copy of "Chilling Aura" (Diablo III Ice Armor rune) [S] |
| Cleave rune 4 | Hemorrhage Arc | a | keep | generic medical word in a new compound |
| Ground Stomp node N4 | Concussion | a | keep | generic word (a Diablo III Monk rune [S], different skill and context) |
| Rime Needles runes | Icicle Fan, Glacier Spine | a | keep | generic words in new compounds |
| Rimefield rune 5 | Permafrost Seal | a | keep | generic word |
| Orrery rune 1 | Comet Ring | a | keep | generic word |
| Black Hole node N6 | Twin Singularity | a | keep | science term |
| Sentry node N4 | Last Barrage | a | keep | generic word |
| Quarry Mark rune 2 | Bounty | a | keep | everyday word |

All other new skill, rune, node, passive, set and legendary names in this bible appear on none of the official lists
above. Everything still needs the release naming audit (P11 report: the scoped item naming pass is not trademark
clearance) [M].

## 5. Hand-off to the game-wide register (not decided here)

- **Resources:** Fury (generic — keep), **Hatred** (the Diablo III Demon Hunter's resource name; distinctive as a resource
  [K] → candidate for the register), Arcane Power (generic words, but exactly the Diablo III Wizard resource [K] →
  borderline).
- **Existing legendary names worth a look** (not skills/runes, outside this file's scope): Hellforge Talisman ("Hellforge"
  is a Diablo II quest location [K]), Witching Cord (close to a Diablo III belt, "Witching Hour" [K]), Hunter's Mark (a
  World of Warcraft hunter ability [K]).
