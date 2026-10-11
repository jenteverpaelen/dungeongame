# Ranger — content bible (M1: 12 skills, 5 runes, 6 nodes, 14 passives, 5 sets, 35 legendaries)

Design document for the class agent. Approved plan: `docs/rework/ITEMS-AND-SKILLS-PLAN.md`. Shared conventions, templates,
bases and affixes: `ITEMS-SHARED.md`. Parity arithmetic: `BUDGET.md`. Reference patterns: `REFERENCES.md`.

**Labels and notation** are the same as `WARRIOR.md` (top): **[M]** measured in this repo, **[P]** proposal,
**[NEW-BEHAVIOUR]** needs new server code, `{field:±n}` = `SkillMods`, `flag:x` = behaviour flag, `x(r)` = flag with the
node rank. Rune unlocks: skill unlock + [2, 5, 9, 14, 20], clamped to 70 [P]. Nodes: N1–N3 open, N4/N5/N6 need 2 ranks in
N1/N2/N3, max 10 ranks per skill, one *(plain)* number node at most [P].

## 1. Identity and categories

The ranger is the frontier's watcher and trapper: ferrymen's stones skipping over the fen, hunting birds, pitch pots,
spring traps and the weather (tone of `docs/rework/CAST.md`). Hatred max 125, regenerates 5/s [M]; Hungering Arrow
generates 3 per shot [M]. Weapons: bow and crossbow (2H, quiver allowed), hand crossbow (1H) [M].

| Category | Skills (unlock) |
|---|---|
| Shots (primary) | Hungering Arrow (1), **Skipstone Bolt (16)** |
| Volleys | Multishot (4), Cluster Arrow (6) |
| Skyfall | Rain of Vengeance (9), **Overcast Volley (26)** |
| Devices | Sentry (2), **Spring Snare (20)**, **Pitch Mortar (40)** |
| Beasts | Companion (12), **Quarry Mark (32)**, **Murmuration (50)** |

## 2. Build archetypes

Requested playstyles: sentries, arrows, rain, companion, trap/control — one archetype each, plus a legendary-native
skip-shot build with no set.

| # | Archetype | Playstyle | Core skills (primary in italics) | Set | Relevant legendaries | Passives |
|---|---|---|---|---|---|---|
| R-A | **Siege** | sentries | Sentry, Multishot, Cluster Arrow, Pitch Mortar, *Hungering Arrow* | Siegebreaker | Bolt-Thrower's Arbalest (crossbow), Sapper's Pack (quiver), Gearwright's Heart (chest), Bowyer's Gloves (hands), Thunderhead (bow, Cube) | Watchmaker, Engineer's Margin, Hatred Well, Quiet Reserve |
| R-B | **Farwatch** | arrows | Multishot, Quarry Mark, Companion, Rain of Vengeance, *Hungering Arrow / Skipstone Bolt* | Farwatch | Thunderhead (bow), Hunter's Mark (hand crossbow, Cube), Hawkfeather Cap (head), Featherguard Cuffs (bracers), Bowyer's Gloves (hands) | Wide Horizon, Long Shot, Hunter's Accord, Hatred Well |
| R-C | **Stormwatch** | rain | Rain of Vengeance, Overcast Volley, Cluster Arrow, Quarry Mark, *Hungering Arrow* | Rainkeeper | Rainspindle (bow), Highcloud Longbow (bow, Cube), Squallcatcher Pauldrons (shoulders), Overcast Hood (head), Powder Horn (amulet) | Weather Eye, Patient Timing, Hatred Well, Weathered Guard |
| R-D | **Packmaster** | companion | Companion, Murmuration, Quarry Mark, Sentry, *Hungering Arrow* | Thicket Kin (new) | Kennel-Wood Bow, Trailhide Breeches (legs), Huntsman's Pauldrons (shoulders), Wingbeat Boots (feet), Whistle Charm (amulet) | Kinship, Hunter's Accord, Trail Heart, Patient Timing |
| R-E | **Trapper** | trap/control | Spring Snare, Pitch Mortar, Quarry Mark, Overcast Volley (Pinning Shower), *Skipstone Bolt (Ripple)* | Snarewright (new) | Tripline Crossbow, Snarehand Gloves (hands), Tar-Stained Jerkin (chest), Mortarman's Pack (quiver), Coiled Wire Bracers | Trapper's Instinct, Engineer's Margin, Second Skin, Quiet Reserve |
| R-F | **Skipshot** | ricochet gunner, legendary-native | Skipstone Bolt, Multishot, Cluster Arrow, Quarry Mark | none (Patchwork Signet) | Riverstone Repeater (hand crossbow), Skimmer's Leggings (legs), Skipping-Stone Quiver, Powderkeg Crossbow (Cube), Fuse-Burnt Boots (feet) | Long Shot, Hatred Well, Trapper's Instinct |

* **Siege.** Up to four Sentries and a Pitch Mortar hold a position while Multishot and Cluster Arrow spend Hatred. Set
  kit: Siegebreaker's Sentries repeat your volleys (now at 25%) and grow stronger per Sentry. Legendary kit: Gearwright's
  Heart and Bowyer's Gloves sit in the footprint, the Bolt-Thrower's Arbalest makes bolts explode.
* **Farwatch.** Long-range archer: piercing or skipping primary shots, Multishot volleys, Quarry Mark on the biggest
  target. Set kit: every fifth shot is a farwatch shot that triggers a free Multishot. Legendary kit: Hawkfeather Cap
  (second target), Featherguard Cuffs (*more* per pierce), Bowyer's Gloves.
* **Stormwatch.** Rain of Vengeance on cooldown, Overcast Volley as the spender, Cluster Arrow to feed the rain's
  cooldown. Set kit: the rain follows you and drops free volleys. Legendary kit: Squallcatcher Pauldrons and the Overcast
  Hood (both *more*), Powder Horn and Weathervane Ring shorten the rain.
* **Packmaster.** Two companions, a mark they focus, and Murmuration as the cooldown. Set kit: bites leap to two more
  enemies. Legendary kit: Trailhide Breeches (bites splash, *more* vs the mark), Huntsman's Pauldrons, Wingbeat Boots.
* **Trapper.** Snares where packs walk, the Mortar shells immobilised enemies, Skipstone's *Ripple* chills, Quarry Mark
  on the elite. Set kit: Snarewright re-arms snares and multiplies damage on immobilised enemies. Snarewright covers belt
  and bracers instead of legs and feet (slot puzzle, `ITEMS-SHARED.md` §4).
* **Skipshot.** A 1H hand crossbow + quiver gunner whose bolts skip through packs; no set exists for it on purpose, the
  shared Patchwork Signet is its "set".

## 3. New skills (6)

Band today [M]: primary 1.55 + 35% pierce, 3 Hatred (Hungering Arrow); spenders 3.6 / 25 Hatred on every enemy in a 70°
arc (Multishot) and 6.5 + 4 × 2.1 grenades / 40 Hatred (Cluster Arrow); cooldown 15 over 5 s at 30 s (Rain); summons
2.8/s single-target bolts at 20 Hatred, 30 s, max 2 (Sentry) and 1.5 per bite (Companion).

### R7 Skipstone Bolt — `skipstone_bolt` (Shots, primary, L16)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| primary | physical | 1.35 (skips −20% each) | 0 | 3 | 0 | 380 | 220 (skip search) | 0 | 0 | `always` |

* *Anchor:* Hungering Arrow 1.55 [M]. Skipstone is weaker on one target (1.35) and stronger on packs (1.35 + 1.08 + 0.86
  = 3.29 over three enemies) [P]; same 3 Hatred.
* **Behaviour.** A bolt flies to the target, then "skips" to the nearest not-yet-hit enemy within `radius`, twice, each
  skip dealing 80% of the previous hit. [NEW-BEHAVIOUR] chaining projectile (new `ProjKind 'skip'` that re-targets on hit
  with a per-projectile hit set; `pickTarget` reuse [M]).
* **Desc:** "Fire a flat bolt that hits for {coef} weapon damage and skips to 2 more enemies within {radius} units, losing
  20% damage each skip. Generates {gen} Hatred."
* **VFX / icon / sound.** Flat spinning slate bolt; each skip point makes a small water-ripple ring even on dry ground.
  Icon `skip`, 0x7fb8c9. Sound: "tk-tk-tk" ricochet clicks rising in pitch, soft plip at each ripple.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Long Skip** (18) | Skips 4 times; each skip loses 30%. | `flag:skipMore` |
| **Ripple** (21) | Cold; every skip point ripples (radius 50) for 40% damage and chills 30% for 1 s. | `{element:'cold'}`, `flag:skipRipple` |
| **Fen Lightning** (25) | Lightning; each skip generates 1 Hatred. | `{element:'lightning'}`, `flag:skipGen` |
| **Heavy Stone** (30) | No skips; knocks the target back 60 units and deals 80% more damage. | `{dmg:+80}`, `flag:noSkip`, `flag:skipKnock` |
| **Marker Bolt** (36) | The last enemy skipped to is Quarry-marked for 3 s (+10% damage taken from you). | `flag:skipMark` (mark fields exist [M]) |

### R8 Spring Snare — `spring_snare` (Devices, summon/trap, L20)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| summon | physical | 4.0 per trigger | 15 | 0 | 0 | 380 | 90 | 20 (lifetime) | 3 | `maintainSummon` |

* *Anchor:* Cluster Arrow 6.5 + grenades for 40 Hatred [M]; a snare is 4.0 for 15 Hatred but only fires when stepped on
  and at most 3 stand at once [P]. Immobilise 1.5 s = Ground Stomp's 2 s stun minus a quarter (a trap, not a slam).
* **Behaviour.** Placed at `bestPoint` near enemies within `range` [M]; arms after 0.6 s; when an enemy comes within 40
  units it snaps: `coef` to enemies within `radius` and immobilises (stun) them 1.5 s; the snare is consumed. [NEW-
  BEHAVIOUR] stationary trigger entity (summon type `snare` that never attacks; trigger check each tick).
* **Desc:** "Set a spring snare near enemies. When one steps on it, it snaps for {coef} weapon damage and holds enemies
  within {radius} units for 1.5 seconds. Up to {max} snares; each lasts {duration} seconds."
* **VFX / icon / sound.** Iron jaws on a coil of rope, half buried; snap with a dust burst and rope whip. Icon `snare`,
  0x9a7b4f. Sound: metallic click when arming; a hard snap and a spring "boing" on trigger.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Chain Snare** (22) | A triggered snare tethers up to 2 nearby enemies and drags them 60 units toward the victim. | `flag:snareTether` (reuse `dragMob` [M]) |
| **Pitch-Soaked** (25) | Fire; the snap leaves burning ground for 2 s. | `{element:'fire'}`, `flag:snareBurn` |
| **Hair Trigger** (29) | Snares arm instantly and you may have 5, but each deals 40% less. | `{maxSummons:+2, dmg:-40}`, `flag:snareInstant` |
| **Bramble Spring** (34) | The snap also flings 4 thorns outward (60% damage each). | `flag:snareThorns` |
| **Hunter's Patience** (40) | Snares that waited 5+ s before triggering deal 100% more damage. | `flag:snarePatience` |

### R9 Overcast Volley — `overcast_volley` (Skyfall, spender, L26)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| spender | physical | 1.1 per arrow × 8 | 30 | 0 | 0 | 380 | 140 (scatter), 35 per arrow | 1.2 | 0 | `enemiesNear {count:3, within:380}` |

* *Anchor:* between Multishot (3.6 / 25) and Cluster Arrow (6.5 + grenades / 40) [M]: an enemy in the cloud takes ~2–3
  arrows (2.2–3.3), a lone target can take up to 8.8, for 30 Hatred [P]. It is the spammable rain for the rain archetype.
* **Behaviour.** Arrows go up, then 8 impacts land at random points inside `radius` around the best point over
  `duration` s (scheduler + `aoe` events, the Meteor Shower pattern [M]).
* **Desc:** "Loose arrows into the sky; they fall over {duration} seconds across {radius} units, each dealing {coef}
  weapon damage where it lands."
* **VFX / icon / sound.** A fast upward streak, a brief grey cloud puff, then thin falling streaks with small dust
  puffs. Icon `overcast`, 0x6a8caf. Sound: an upward "fwip", a beat of silence, then a patter of thunks like hail.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Freezing Drizzle** (28) | Cold; arrows chill 40% for 2 s. | `{element:'cold'}`, `flag:chill` |
| **Downpour** (31) | 14 arrows over 2 s in a 40% larger area, each 35% less damage. | `{radius:+40}`, `flag:volleyDownpour` |
| **Storm Shelf** (35) | Lightning; the cloud lingers 2 s and strikes 2 random enemies with bolts (150% each). | `{element:'lightning'}`, `flag:volleyBolts` |
| **Pinning Shower** (40) | Enemies hit by 3 arrows of one volley are pinned (immobilised) for 1 s. | `flag:volleyPin` |
| **Sunbreak** (46) | Costs 10 less Hatred and falls in a 40% tighter area for 30% more damage. | `{cost:-33, radius:-40, dmg:+30}` |

### R10 Quarry Mark — `quarry_mark` (Beasts, cooldown mark, L32)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| cooldown | physical | 0 | 10 | 0 | 6 | 450 | 0 | 12 | 0 | `enemiesNear {count:1, within:450}` + "no living mark" [NEW-BEHAVIOUR] |

* *Anchor:* Hunter's Mark's pierce mark is +15–20% [M]; Quarry Mark is +20% for 12 s on one target [P].
* **Behaviour.** Marks the highest-Life elite in range (else the highest-Life enemy): it takes +20% damage from you, your
  summons and your party (existing `markMs`/`markPct` [M]); your summons prefer it as a target; when it dies the mark jumps
  to the highest-Life enemy within 300 for the remaining duration. [NEW-BEHAVIOUR] summon target preference + jump on death
  + an auto filter "no living mark" (Rend's "unbleeding" filter in `brain.ts` is the pattern [M]).
* **Desc:** "Mark your quarry for {duration} seconds. It takes 20% more damage from you, your allies and your summons,
  which hunt it first. If it dies, the mark jumps to the strongest enemy nearby."
* **VFX / icon / sound.** A pale feather-and-eye sigil hovers over the target; your summons' attacks on it leave a pale
  trail. Icon `eye`, 0xe6c35c. Sound: a sharp hawk cry; a soft chime when the mark jumps.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Bloodhound** (34) | The quarry is slowed 30% and your companions move 30% faster. | `flag:markSlow` |
| **Bounty** (37) | Killing the quarry restores 30 Hatred and drops a health globe. | `flag:markBounty` (globe loot exists [M]) |
| **Open Season** (41) | Enemies within 120 units of the quarry are marked at half strength. | `flag:markSplash` |
| **Falcon Strike** (46) | On cast, a falcon stoops on the quarry for 500% weapon damage. | `flag:markDive` |
| **Long Hunt** (52) | The mark lasts until the quarry dies and costs no Hatred, but the bonus is 15%. | `{cost:-100}`, `flag:markLong` |

### R11 Pitch Mortar — `pitch_mortar` (Devices, summon, L40)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| summon | fire | 3.6 per shell + 1.8 burn over 3 s | 30 | 0 | 0 | 500 (min 120) | 100 | 20 | 1 | `maintainSummon` |

* *Anchor:* Sentry 2.8/s single-target for 20 Hatred, max 2 [M]; the Mortar is 1.8/s (+0.6/s burn) on everything within
  100 of the impact, max 1, for 30 Hatred [P]. The burn is a fixed second number like Meteor's molten 2.35 [M].
* **Behaviour.** A stationary device placed at the player's feet; every 2 s it lobs a shell at the densest pack between
  120 and 500 units (reuse `bestPoint` [M] and the lobbed `cluster` projectile [M]); impact deals `coef` and leaves pitch
  fire (ground `molten` reuse [M]) for 3 s. [NEW-BEHAVIOUR] summon type `mortar` (fire loop + lob).
* **Desc:** "Set down a mortar for {duration} seconds. Every 2 seconds it lobs a pitch pot at the densest group, dealing
  {coef} weapon damage as Fire and leaving burning pitch."
* **VFX / icon / sound.** A squat iron mortar on a wooden sled; black smoke puff, an arcing pot with a burning wick,
  splash of tar fire. Icon `mortar`, 0x5b4a3a. Sound: deep "thoomp", short whistle, splat and sizzle.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Twin Barrels** (42) | +1 maximum Mortar. | `{maxSummons:+1}` |
| **Grapeshot** (45) | Shells burst into 5 pellets (60% each) instead of leaving pitch. | `flag:mortarGrape` |
| **Frostpot** (49) | Cold; impacts freeze for 1 s; no burn. | `{element:'cold'}`, `flag:mortarFreeze` |
| **Spotter** (54) | The Mortar always fires at your Quarry Mark or snared enemies when in range, 30% faster. | `flag:mortarSpotter` |
| **Skipping Shell** (60) | Shells bounce once before exploding (two impacts at 70%). | `flag:mortarBounce` |

### R12 Murmuration — `murmuration` (Beasts, cooldown ultimate, L50)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| cooldown | physical | 2.0 per second | 0 | 0 | 50 | 500 | 120 | 10 | 0 | `enemiesNear {count:6, within:450}` |

* *Anchor:* Rain of Vengeance 15 over 5 s at 30 s [M]. Murmuration is 20 over 10 s at 50 s but moves to the enemies [P].
* **Behaviour.** A flock (moving ground area, radius 120) sweeps between the densest packs within `range` of the player
  for `duration` s (Rain's `follow` ground is the closest existing pattern [M]), striking enemies inside every 0.25 s for
  `coef`/4. [NEW-BEHAVIOUR] a ground that travels between packs (waypoints by `bestPoint`).
* **Desc:** "Release a murmuration of birds that sweeps across the battlefield for {duration} seconds, dealing {coef}
  weapon damage per second to enemies inside it."
* **VFX / icon / sound.** Thousands of tiny dark birds in a shimmering ribbon that folds and stretches over enemies. Icon
  `flock`, 0x3a3a4a. Sound: rushing wing-flutter with chatter, swelling when it dives.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Starling Shield** (52) | Half the flock circles you: you take 25% less damage while it lasts, but it deals 40% less. | `flag:flockGuard` |
| **Crowfeast** (55) | Enemies the flock kills restore 2 Hatred and extend it by 0.5 s (max +5 s). | `flag:flockFeast` |
| **Stormbirds** (59) | Lightning; every 0.5 s the flock arcs to 2 enemies outside it. | `{element:'lightning'}`, `flag:flockArc` |
| **Split Flock** (64) | Two flocks with 30% smaller radius, each at 60% damage. | `flag:flockSplit` |
| **Pecking Order** (70) | The flock hunts your Quarry Mark or the nearest elite and deals 50% more damage to it. | `flag:flockElite` |

## 4. Two new runes for each existing skill

Unlocks: Hungering Arrow 15/21, Sentry 16/22, Multishot 18/24, Cluster Arrow 20/26, Rain of Vengeance 23/29, Companion
26/32 [P]. D3 already uses Spider/Bat/Boar/Ferret/Wolf for its companion runes (`REFERENCES.md` §1), so the new animals
avoid those.

| Skill | Rune (unlock) | Effect | Mods |
|---|---|---|---|
| Hungering Arrow | **Fletchling Swarm** (15) | 30% chance on hit to release 2 tiny seeking darts (40% each). | `flag:haDarts` |
| Hungering Arrow | **Barbed Shaft** (21) | Arrows cause a bleed of 60% weapon damage over 3 s. | `flag:haBleed` |
| Sentry | **Watchtower** (16) | Sentries are built 120 units toward the densest pack and their bolts pierce once. | `flag:sentryForward`, `flag:sentryPierce` |
| Sentry | **Flame Lance** (22) | Sentries spray a short flame jet (60° cone, range 150) instead of bolts: Fire, 20% more damage. | `{element:'fire', dmg:+20}`, `flag:sentryFlame` |
| Multishot | **Fanning Hail** (18) | A full 180° fan of 15 arrows, 25% less damage. | `{projectiles:+6, dmg:-25}`, `flag:multiWide` |
| Multishot | **Gale Shot** (24) | Arrows push enemies 40 units and restore 1 Hatred per enemy hit (max 10). | `flag:multiPush`, `flag:multiGen` |
| Cluster Arrow | **Barrel Bomb** (20) | The arrow rolls along the ground leaving 3 small blasts (50% each) before it detonates. | `flag:clusterRoll` |
| Cluster Arrow | **Cold Snap Charge** (26) | Cold; grenades freeze for 0.75 s. | `{element:'cold'}`, `flag:clusterFreeze` |
| Rain of Vengeance | **Flood Plain** (23) | Rain leaves wet ground that chills 30% for 3 s after it ends. | `flag:rainWet` |
| Rain of Vengeance | **Kestrel Column** (29) | A column of diving kestrels: radius −50%, duration −50%, same total damage. | `{radius:-50, duration:-50}`, `flag:rainFocus` |
| Companion | **Badger Sett** (26) | A badger replaces the wolf; every 4 s it bursts up under enemies, stunning those within 70 for 0.75 s. | `flag:badgerCompanion` [NEW-BEHAVIOUR] summon type |
| Companion | **Heron Companion** (32) | A heron replaces the wolf; it spears from 200 units for 40% more damage and its strikes chill. | `{dmg:+40}`, `flag:heronCompanion` [NEW-BEHAVIOUR] summon type |

## 5. Specialization nodes

**Hungering Arrow**
| Node | Effect | Mods |
|---|---|---|
| N1 Steady Draw *(plain)* | +10 / 20 / 30% damage. | `{dmg}` |
| N2 Hunger Pangs | Each pierce restores 1 Hatred (max 1 / 2 / 3 per arrow). | `haPierceGen(r)` |
| N3 Seeking Turn | Arrows turn 30 / 60 / 90% faster and pick a new target when theirs dies. | `haRetarget(r)` [NEW-BEHAVIOUR] |
| N4 Long Flight | Arrows fly 15 / 30 / 45% farther and gain +5 / 10 / 15% damage per 100 units flown. | `haDistance(r)` |
| N5 Split Feathers | Every 5th / 4th / 3rd arrow fires 2 extra arrows in a narrow fan. | `haVolleyEvery(r)` |
| N6 Gut Hook | Pierced enemies are slowed 10 / 20 / 30% for 2 s. | `haSlow(r)` |

**Sentry**
| Node | Effect | Mods |
|---|---|---|
| N1 Sturdier Frames *(plain)* | Duration +15 / 30 / 45%. | `{duration}` |
| N2 Hatred Feed | Each bolt that hits an elite restores 0.5 / 1 / 1.5 Hatred. | `sentryGen(r)` |
| N3 Crossfire | Enemies hit by 2+ Sentries within 1 s take +10 / 20 / 30% from Sentries. | `sentryCrossfire(r)` |
| N4 Last Barrage | An expiring Sentry fires a final barrage of 4 / 6 / 8 bolts. | `sentryFinale(r)` |
| N5 Shared Optics | Sentries fire at your Quarry Mark from any distance on screen for +10 / 20 / 30%. | `sentryMarkSnipe(r)` |
| N6 Cog Linkage | Sentries fire 5 / 10 / 15% faster per other Sentry within 200 units. | `sentryLink(r)` |

**Multishot**
| Node | Effect | Mods |
|---|---|---|
| N1 More Shafts *(plain)* | +2 / 4 / 6 arrows. | `{projectiles}` |
| N2 Thrifty Nock | Refunds 2 / 4 / 6 Hatred when it hits 5+ enemies. | `multiRefund(r)` |
| N3 Point Blank | +15 / 30 / 45% damage to enemies within 150 units. | `multiClose(r)` |
| N4 Rolling Volley | A second volley with 40% of the arrows follows 0.25 s later at 30 / 45 / 60% damage. | `multiEcho(r)` |
| N5 Rocket Tithe | With *Arsenal*, rockets seek elites first and deal +20 / 40 / 60% to them. | `multiRocketElite(r)` |
| N6 Ricochet Fletch | Arrows that reach maximum range or a wall ricochet once at 30 / 50 / 70%. | `multiRicochet(r)` [NEW-BEHAVIOUR] wall test |

**Cluster Arrow**
| Node | Effect | Mods |
|---|---|---|
| N1 Heavier Charge *(plain)* | +10 / 20 / 30% damage. | `{dmg}` |
| N2 Quick Match | Grenades detonate 0.1 / 0.2 / 0.3 s sooner and scatter tighter. | `clusterFuse(r)` |
| N3 Sympathetic Blast | Grenades that land on a Spring Snare trigger it; on Mortar pitch they burst for +50 / 75 / 100%. | `clusterChain(r)` |
| N4 Daisy Chain | A grenade that hits an elite drops one more grenade beside it (max 1 / 2 / 3 extra per cast). | `clusterChainElite(r)` |
| N5 Powder Thrift | Costs 4 / 8 / 12 less Hatred when it hits an elite. | `clusterThrift(r)` |
| N6 Concussive Core | The main blast knocks enemies 20 / 40 / 60 units outward and stuns 0.3 s. | `clusterConcuss(r)` |

**Rain of Vengeance**
| Node | Effect | Mods |
|---|---|---|
| N1 Thicker Rain *(plain)* | Radius +8 / 16 / 24%. | `{radius}` |
| N2 Second Squall | When it ends, 30 / 60 / 90% chance to recast a free half-duration Rain on the densest pack. | `rainRecast(r)` |
| N3 Wind Shear | Drifts toward the densest pack at 40 / 80 / 120 units per second. | `rainDrift(r)` |
| N4 Opening Burst | The first 0.5 s deals +50 / 100 / 150% damage. | `rainBurst(r)` |
| N5 Patient Cloud | Each Overcast Volley cast reduces Rain's cooldown by 0.5 / 1 / 1.5 s. | `rainRefund(r)` |
| N6 Hailstones | Enemies hit 5+ times by one Rain are stunned 0.5 / 0.75 / 1 s (once per Rain). | `rainStun(r)` |

**Companion**
| Node | Effect | Mods |
|---|---|---|
| N1 Strong Jaws *(plain)* | +10 / 20 / 30% damage. | `{dmg}` |
| N2 Pack Tactics | Companions attack 10 / 20 / 30% faster when attacking the same target as you. | `compFocus(r)` |
| N3 Hunting Call | When you cast Quarry Mark or Murmuration, companions leap to the target for 200 / 300 / 400%. | `compLeap(r)` |
| N4 Alpha Howl | Every 10 s companions howl: +4 / 8 / 12% damage (generic) for 4 s. | `compHowl(r)` |
| N5 Rough and Tumble | 10 / 20 / 30% chance per bite to stun for 0.5 s. | `compStun(r)` |
| N6 Loyal Guard | You take 4 / 8 / 12% less damage per living companion (max 2 counted). | `compGuard(r)` [NEW-BEHAVIOUR] DR field |

**Skipstone Bolt**
| Node | Effect | Mods |
|---|---|---|
| N1 Smooth Stone *(plain)* | Skip falloff reduced by 5 / 10 / 15 points. | `skipFalloff(r)` |
| N2 Water Dance | 15 / 30 / 45% chance a skip may return to an enemy already hit (single-target help). | `skipRevisit(r)` |
| N3 Splash Hatred | Each skip restores 0.5 / 1 / 1.5 Hatred. | `skipGenRank(r)` |
| N4 Last Skip | The final skip deals +30 / 60 / 90%. | `skipFinal(r)` |
| N5 Tripping Stone | Skipped enemies are knocked down for 0.2 / 0.35 / 0.5 s. | `skipTrip(r)` |
| N6 Wake | Each skip leaves a 1 s puddle that chills 20 / 30 / 40%. | `skipPuddle(r)` |

**Spring Snare**
| Node | Effect | Mods |
|---|---|---|
| N1 Stronger Spring *(plain)* | +10 / 20 / 30% damage. | `{dmg}` |
| N2 Bait | Armed snares draw enemies within 100 / 150 / 200 units slowly toward them. | `snareLure(r)` [NEW-BEHAVIOUR] monster steering |
| N3 Reset Spring | 15 / 30 / 45% chance a triggered snare re-arms after 1 s. | `snareRearm(r)` |
| N4 Shrapnel Jaw | The snap also hits a 120° cone behind the victim (to 150 units) for 50 / 75 / 100%. | `snareCone(r)` |
| N5 Tripwire | Snares within 200 units of each other are joined by a wire; an enemy crossing it triggers both at 40 / 60 / 80%. | `snareWire(r)` |
| N6 Trapper's Due | Each trigger restores 3 / 6 / 9 Hatred. | `snareGen(r)` |

**Overcast Volley**
| Node | Effect | Mods |
|---|---|---|
| N1 Denser Cloud *(plain)* | +1 / 2 / 3 arrows. | `volleyArrows(r)` |
| N2 Downdraft | Each arrow pulls enemies 10 / 20 / 30 units toward the centre. | `volleyGather(r)` |
| N3 Hatred Rain | Each arrow hitting an elite refunds 1 / 2 / 3 Hatred (max 6). | `volleyGen(r)` |
| N4 Chasing Cloud | The cloud drifts with the densest enemies at 60 / 100 / 140 units per second. | `volleyFollow(r)` |
| N5 Thunder Peal | The last arrow is a heavy shaft (radius 70) for 200 / 300 / 400%. | `volleyFinale(r)` |
| N6 Soaked | Enemies hit by 3+ arrows take +8 / 16 / 24% from Rain of Vengeance for 3 s. | `volleySoak(r)` [NEW-BEHAVIOUR] skill-scoped vulnerability |

**Quarry Mark**
| Node | Effect | Mods |
|---|---|---|
| N1 Keen Sight *(plain)* | Mark bonus +3 / 6 / 9 points. | `markPctAdd(r)` |
| N2 Tracker | +5 / 10 / 15% movement speed and +3 / 6 / 9% attack speed while the quarry is within 400 units. | `markHaste(r)` |
| N3 Pack Signal | The quarry takes +15 / 30 / 45% more from your companions and Murmuration. | `markBeasts(r)` |
| N4 Second Quarry | Also marks the next-highest-Life enemy at 50 / 75 / 100% strength. | `markTwo(r)` |
| N5 Hunting Horn | When the mark jumps, companions and the flock gain +10 / 20 / 30% damage for 4 s. | `markHorn(r)` |
| N6 Exposed Joints | The quarry deals 5 / 10 / 15% less damage. | `markWeaken(r)` (shares Concussion's debuff field) |

**Pitch Mortar**
| Node | Effect | Mods |
|---|---|---|
| N1 Larger Shells *(plain)* | Radius +10 / 20 / 30%. | `{radius}` |
| N2 Ammunition Belt | Each shell hitting 3+ enemies restores 1 / 2 / 3 Hatred. | `mortarGen(r)` |
| N3 Walking Fire | 20 / 40 / 60% chance to fire a second shell at another pack immediately. | `mortarDouble(r)` |
| N4 Tar Pit | Pitch ground slows 15 / 30 / 45%. | `mortarSlow(r)` |
| N5 Overpressure | Every 4th shell has double radius and +50 / 100 / 150% damage. | `mortarHeavy(r)` |
| N6 Sled Mount | The Mortar follows you (repositions within 200 units) but fires 30 / 20 / 10% slower while moving. | `mortarFollow(r)` |

**Murmuration**
| Node | Effect | Mods |
|---|---|---|
| N1 Thick Flock *(plain)* | +10 / 20 / 30% damage. | `{dmg}` |
| N2 Shadow Cover | While the flock is out you take 5 / 10 / 15% less damage. | `flockCover(r)` |
| N3 Gathering Flock | Radius grows 10% every 2 s, to +20 / 40 / 60%. | `flockGrow(r)` |
| N4 Feather Storm | Enemies inside are chilled 20 / 35 / 50%. | `flockChill(r)` |
| N5 Return to Roost | When it ends, 10 / 20 / 30% of its cooldown is refunded per elite it killed (max 50%). | `flockRefund(r)` |
| N6 Stoop | Every 2 s the flock stoops on one enemy for 150 / 250 / 350%. | `flockStoop(r)` |

## 6. Passives (6 existing kept + 8 new)

Existing [M]: Wide Horizon (Multishot damage, L10), Watchmaker (Sentry damage, L10), Quiet Reserve (resource regeneration,
L20), Patient Timing (cooldown reduction, L30), Trail Heart (Life, L40), Weathered Guard (Armor, L50).

| Passive (unlock) | Effect | Archetypes | Template / behaviour |
|---|---|---|---|
| **Engineer's Margin** (14) | Sentry, Spring Snare and Pitch Mortar get +1 maximum each, but each deals 15% less damage. | Siege, Trapper | maxSummons + skill penalty |
| **Kinship** (18) | Companions deal +1% damage per 5 Hatred you hold (max +25%); their bites heal you 0.2% of maximum Life. | Packmaster | [NEW-BEHAVIOUR] resource-scaled summon bonus |
| **Long Shot** (24) | Your projectiles deal up to +20% damage by distance flown (0% at 0, +20% at 400 units). | Farwatch, Skipshot | [NEW-BEHAVIOUR] distance tracked on projectiles |
| **Weather Eye** (28) | Rain of Vengeance and Overcast Volley chill 30%; you deal 15% more damage to chilled enemies. | Stormwatch | vs-chilled bonus |
| **Trapper's Instinct** (36) | Immobilised, stunned and frozen enemies take 15% more damage from you; your control effects last 20% longer. | Trapper, Skipshot | vulnerability (controlled) + duration |
| **Hatred Well** (45) | Hatred regeneration is doubled below 40 Hatred; every 100 Hatred spent reduces all cooldowns by 1 s. | Siege, Farwatch, Stormwatch, Skipshot | resource rule |
| **Second Skin** (55) | A hit above 25% of your maximum Life grants 50% damage reduction for 2 s and drops a Spring Snare at your feet (once per 20 s). | defensive, all | [NEW-BEHAVIOUR] big-hit hook |
| **Hunter's Accord** (64) | Quarry Mark also applies at half strength to enemies within 150 of the quarry, and jumps instantly on death. | Packmaster, Farwatch | mark splash |

## 7. Sets: three redesigned, two new

Cap rule [P] (`BUDGET.md` §3): whole set ≤ ×2.5 per skill including transforms; the 6-piece is a transform (damage value
≤ ×1.10) plus ×1.25 own bucket (×1.35 while a condition holds), hard cap ×1.3 effective; the 2- and 4-piece carry ≈×1.5–1.7. Today's 6-pieces
[M]: Siegebreaker up to ×11 (+250% per Sentry, max 4), Farwatch ×30, Rainkeeper ×30. Standard ranger footprint [M]: hood,
pads, jerkin, gloves, breeches, boots.

### Siegebreaker's Arsenal (redesign) — motif *cog* (unchanged)
| Pieces | Today [M] | Redesign [P] | Data |
|---|---|---|---|
| 2 | +1 maximum Sentry; Sentry cooldown −30%. | unchanged. | `{maxSummons:+1, cooldown:-30}` |
| 4 | Sentries also cast your Multishot and Cluster Arrow. | Sentries also fire your Multishot and Cluster Arrow **at 25% damage**. | `sentryCasts` + strike scale 0.25 [NEW-BEHAVIOUR: a scale on the repeated cast] |
| 6 | +250% per active Sentry (max 4) to Sentries, Multishot, Cluster Arrow. | **Transform:** with 4 Sentries active they also fire a rocket salvo every 3 s (the *Spitfire* rockets). Sentries, Multishot and Cluster Arrow deal **×(1 + 0.1 per active Sentry)**, max ×1.4 at 4 (≈×1.32 at the modeled 3.2 average). | `sentrySalvo`, per-Sentry multiplier |

### Farwatch (redesign) — motif *feather* (unchanged)
| Pieces | Today [M] | Redesign [P] | Data |
|---|---|---|---|
| 2 | Hungering Arrow +50% pierce chance. | Hungering Arrow +50% pierce chance; Skipstone Bolt +1 skip. | `{pierce:+50}`, `skipPlus` |
| 4 | Multishot costs 40% less Hatred. | Multishot costs 40% less Hatred; enemies your primary pierces or skips are *spotted* for 3 s and Multishot arrows bend toward them. | `{cost:-40}`, `spotted` [NEW-BEHAVIOUR] |
| 6 | Hungering Arrow and Multishot +2,900% (×30). | **Transform:** every 5th primary attack is a farwatch shot: it flies 900 units, pierces everything and releases a free Multishot where it ends. Primary attacks and Multishot deal **×1.35 to enemies farther than 200 units**. | `farwatchShot` [NEW-BEHAVIOUR], conditional multiplier |

### Rainkeeper (redesign) — motif *rain* (unchanged; its "personal rain cloud" orbiter now matches the 6-piece)
| Pieces | Today [M] | Redesign [P] | Data |
|---|---|---|---|
| 2 | Rain and Cluster Arrow +40% radius. | Rain of Vengeance and Overcast Volley +30% radius; Rain cooldown −20%. | `{radius:+30}`, `{cooldown:-20}` |
| 4 | Rain cooldown −30%. | You take 20% less damage while standing in your Rain; Cluster Arrow detonations inside it release 2 more grenades; while it is active Overcast Volley costs 30% less and enemies inside it take 15% more damage from Overcast Volley. | `rainDR`, `rainGrenades`, `{cost:-30}` while active, conditional multiplier |
| 6 | Rain and Cluster Arrow +2,900% (×30). | **Transform:** your Rain becomes a personal storm that moves with you and drops a free Overcast Volley on the densest pack inside it every 3 s. Rain, Overcast Volley and Cluster Arrow deal **×1.35 to enemies inside the storm**. | `rainFollowSelf`, `stormVolley` [NEW-BEHAVIOUR], conditional multiplier |

### Thicket Kin (new) — motif *antler* (new)
Footprint: standard ranger. Colours primary 0x4b5a32 (moss), secondary 0xb59a6a (antler), glow 0x3cff6e. Pieces: Antler
Hood, Bramble Pauldrons, Thicket Jerkin, Kinhand Gloves, Deer-Trail Breeches, Soft-Pad Boots.
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Companion attacks generate 1 Hatred and companions move 30% faster. | `compGen`, `compSpeed` |
| 4 | +1 maximum Companion; companions apply Quarry Mark with their bite when no quarry is marked; you take 10% less damage per living companion (max 20%). | `{maxSummons:+1}`, `compMark`, `compGuard` |
| 6 | **Transform:** each bite leaps to 2 nearby enemies for 25% damage. Companions and Murmuration deal **×1.25**. | `compLeapBite` [NEW-BEHAVIOUR], `multiplier:1.25` |

### Snarewright (new) — motif *knot* (new)
Footprint **cap, pads, jerkin, gloves, belt, bracers** (legs and feet free). Colours primary 0x6b5a3a (hemp), secondary
0x8f9a9e (steel), glow 0x3cff6e. Pieces: Snarewright Cap, Hookline Pauldrons, Rope-Wound Jerkin, Knotter's Gloves, Coil
Belt, Springlock Bracers.
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | +1 maximum Spring Snare; snares arm 50% faster. | `{maxSummons:+1}`, `snareArm` |
| 4 | A triggered snare gives you 20% damage reduction for 3 s and pulls held enemies 30 units toward its centre; Pitch Mortar targets held enemies first. | `snareDR`, `snarePull`, `mortarPrefersHeld` |
| 6 | **Transform:** snares re-arm once after triggering, and Pitch Mortar shells that land on an immobilised enemy re-arm a spent snare nearby. Spring Snare, Pitch Mortar and Skipstone Bolt deal **×1.35 to immobilised enemies**. | `snareRearmOnce`, `mortarRearm` [NEW-BEHAVIOUR], conditional multiplier |

## 8. Legendaries (5 existing + 30 new = 35)

Anchors [M]: bow/crossbow signatures +150–200% (Thunderhead, Rainspindle's 30–40% cooldown); Sapper's Pack (quiver) +2
Sentries and +30–40%; Gearwright's Heart −30–40% cooldown and 50% faster fire; Hunter's Mark vulnerability 15–20%.
New primary signatures use Spindle of a Thousand Missiles' 100–150% band [M]. skillMore 25–40% [P]. FP = standard set
footprint.

| Legendary | Base (slot) | Power (`{v}` = rolled) | Range | Template | Cube | Archetype |
|---|---|---|---|---|---|---|
| Rainspindle [M] | Bow (2H) | Rain of Vengeance cooldown is reduced by {v}% and its radius grows by 40%. | 30–40 | skillMods | weapon | Stormwatch |
| Sapper's Pack [M] | Quiver | +2 maximum Sentries; Sentries deal {v}% increased damage. | 30–40 | skillMods + skillDamage | armor | Siege |
| Gearwright's Heart [M] | Jerkin (FP) | Sentry cooldown −{v}%; Sentries fire 50% faster. | 30–40 | skillMods | armor | Siege |
| Thunderhead [M] | Bow (2H) | Multishot deals Lightning damage and {v}% increased damage. | 150–200 | conversion + skillDamage | weapon | Farwatch, Siege |
| Hunter's Mark [M] | Hand Crossbow (1H) | Hungering Arrow always pierces; pierced enemies take {v}% increased damage for 3 s. | 15–20 | vulnerability | weapon | Farwatch |
| **Featherguard Cuffs** | Bracers | Each pierce makes the arrow deal {v}% more damage (compounding, max 3 pierces). | 20–30 | skillMore (stacking) | armor | Farwatch |
| **Hawkfeather Cap** | Cap (FP) | Hungering Arrow also fires at a second target and deals {v}% increased damage. | 100–150 | skillFlag + skillDamage | armor | Farwatch |
| **Bolt-Thrower's Arbalest** | Crossbow (2H) | Sentry bolts pierce and explode on their final target (radius 60); Sentries deal {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon | Siege, Packmaster |
| **Bowyer's Gloves** | Gloves (FP) | Multishot fires a second volley at 30% damage 0.3 s later and deals {v}% more damage to enemies within 200 units. | 25–35 | skillMore (cond.) | armor | Siege, Farwatch, Skipshot |
| **Bandolier Belt** | Belt | Multishot costs {v}% less Hatred and restores 0.5 Hatred per enemy hit (max 5). | 30–40 | resource | armor | Farwatch |
| **Powderkeg Crossbow** | Crossbow (2H) | Cluster Arrow releases 3 more grenades and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon | Stormwatch, Skipshot, Siege |
| **Fuse-Burnt Boots** | Boots (FP) | Cluster Arrow grenades bounce once before exploding and deal {v}% more damage. | 25–35 | skillMore | armor | Skipshot, Stormwatch |
| **Powder Horn** | Amulet | Cluster Arrow detonations reduce Rain of Vengeance's cooldown by {v} s. | 0.3–0.5 | cooldown | jewelry | Stormwatch |
| **Squallcatcher Pauldrons** | Pads (FP) | Rain of Vengeance drifts after the densest pack and deals {v}% more damage to enemies that have been in it for 2+ s. | 25–40 | skillMore (cond.) | armor | Stormwatch |
| **Raincount Ring** | Ring | Rain of Vengeance fires {v}% more waves. | 30–50 | skillMods | jewelry | Stormwatch, Farwatch |
| **Kennel-Wood Bow** | Bow (2H) | +1 Companion; Companions deal {v}% increased damage. | 150–200 | skillMods + skillDamage | weapon | Packmaster |
| **Trailhide Breeches** | Breeches (FP) | Companion attacks hit all enemies within 60 of their target and deal {v}% more damage to your Quarry Mark. | 25–40 | skillMore (cond.) | armor | Packmaster |
| **Whistle Charm** | Amulet | Companions attack {v}% faster. | 20–30 | skillMods | jewelry | Packmaster |
| **Riverstone Repeater** | Hand Crossbow (1H) | Skipstone Bolt skips 2 more times and deals {v}% increased damage. | 100–150 | skillFlag + skillDamage | weapon | Skipshot, Trapper |
| **Skimmer's Leggings** | Breeches (FP) | Each skip makes the bolt deal {v}% more damage (compounding). | 15–25 | skillMore (stacking) | armor | Skipshot, Trapper |
| **Skipping-Stone Quiver** | Quiver | Skipstone's last skip splits into 3 bolts that skip once more; Skipstone generates {v} more Hatred. | 2–3 | skillFlag + resource | armor | Skipshot |
| **Tripline Crossbow** | Crossbow (2H) | +2 maximum Spring Snares; snares deal {v}% increased damage. | 150–200 | skillMods + skillDamage | weapon | Trapper |
| **Snarehand Gloves** | Gloves (FP) | Snares hold 1 s longer; held enemies take {v}% more damage from Spring Snare and Pitch Mortar. | 25–40 | skillMore (cond.) | armor | Trapper |
| **Coiled Wire Bracers** | Bracers | A triggered snare re-arms after 2 s with {v}% chance. | 30–50 | skillFlag (chance) | armor | Trapper |
| **Highcloud Longbow** | Bow (2H) | Overcast Volley drops 4 more arrows and deals {v}% increased damage. | 150–200 | skillMods + skillDamage | weapon | Stormwatch |
| **Overcast Hood** | Hood (FP) | Overcast Volley's arrows chill; enemies hit by 3+ arrows take {v}% more damage from it. | 25–35 | skillMore (cond.) | armor | Stormwatch, Trapper |
| **Weathervane Ring** | Ring | Each Overcast Volley reduces Rain of Vengeance's cooldown by {v} s. | 0.3–0.6 | cooldown | jewelry | Stormwatch |
| **Spotter's Repeater** | Hand Crossbow (1H) | Quarry Mark's bonus is {v} points higher and it also marks one enemy within 150 of the quarry. | 10–15 | vulnerability | weapon | Packmaster, Farwatch |
| **Huntsman's Pauldrons** | Pads (FP) | When your mark jumps, companions and Sentries deal {v}% more damage for 5 s. | 30–40 | skillMore (cond.) | armor | Packmaster |
| **Mortarman's Pack** | Quiver | +1 maximum Pitch Mortar; Mortars deal {v}% increased damage. | 30–40 | skillMods + skillDamage | armor | Trapper, Siege |
| **Tar-Stained Jerkin** | Jerkin (FP) | Mortar pitch spreads 30% per second (max double radius) and enemies in it take {v}% more damage from your devices. | 25–35 | skillMore (cond.) | armor | Trapper, Siege |
| **Fuse Cord Belt** | Belt | Pitch Mortar fires {v}% faster. | 25–35 | skillMods | armor | Trapper |
| **Starling Longbow** | Bow (2H) | Murmuration lasts 4 s longer and deals {v}% increased damage. | 150–200 | skillMods + skillDamage | weapon | Packmaster |
| **Wingbeat Boots** | Boots (FP) | Murmuration circles you when no enemy is near, and deals {v}% more damage to elites. | 25–40 | skillMore (cond.) | armor | Packmaster |
| **Roost Charm** | Amulet | Murmuration's cooldown is reduced by 2 s per enemy it kills (max {v} s). | 10–15 | cooldown | jewelry | Packmaster |

**Coverage:** Hungering Arrow — Hunter's Mark, Featherguard Cuffs, Hawkfeather Cap · Sentry — Sapper's Pack, Gearwright's
Heart, Bolt-Thrower's Arbalest · Multishot — Thunderhead, Bowyer's Gloves, Bandolier Belt · Cluster Arrow — Powderkeg
Crossbow, Fuse-Burnt Boots, Powder Horn · Rain — Rainspindle, Squallcatcher Pauldrons, Raincount Ring · Companion —
Kennel-Wood Bow, Trailhide Breeches, Whistle Charm · Skipstone Bolt — Riverstone Repeater, Skimmer's Leggings,
Skipping-Stone Quiver · Spring Snare — Tripline Crossbow, Snarehand Gloves, Coiled Wire Bracers · Overcast Volley —
Highcloud Longbow, Overcast Hood, Weathervane Ring · Quarry Mark — Spotter's Repeater, Huntsman's Pauldrons, Hunter's
Mark · Pitch Mortar — Mortarman's Pack, Tar-Stained Jerkin, Fuse Cord Belt · Murmuration — Starling Longbow, Wingbeat
Boots, Roost Charm.

Flavour lines: Featherguard Cuffs "Each feather from a bird that came home." · Hawkfeather Cap "It sees the second one
first." · Bolt-Thrower's Arbalest "Built for walls. Used on everything else." · Bowyer's Gloves "Waxed thread in every
seam." · Bandolier Belt "Every loop full, every time." · Powderkeg Crossbow "Do not lean on it." · Fuse-Burnt Boots
"The smell never leaves." · Powder Horn "Shake it and the sky rumbles." · Squallcatcher Pauldrons "Wet on the inside,
somehow." · Raincount Ring "Neris counted every drop. Twice." · Kennel-Wood Bow "Cut from the post the dogs slept
against." · Trailhide Breeches "They learn the way home." · Whistle Charm "Only animals hear it. All of them." ·
Riverstone Repeater "Sera says it skips better than she does." · Skimmer's Leggings "Light on the water, light on the
road." · Skipping-Stone Quiver "Flat stones, carefully chosen." · Tripline Crossbow "It is always cocked." · Snarehand
Gloves "Rope burns in the shape of a promise." · Coiled Wire Bracers "Wound tight, waiting." · Highcloud Longbow "Its
arrows come down eventually." · Overcast Hood "It never quite dries." · Weathervane Ring "It points where the trouble
is blowing." · Spotter's Repeater "The first shot is a question." · Huntsman's Pauldrons "Trophies of nobody you would
know." · Mortarman's Pack "Pitch, wicks, and an apology." · Tar-Stained Jerkin "Black to the elbow." · Fuse Cord Belt
"Light the end you are not wearing." · Starling Longbow "When it sings, the hedges answer." · Wingbeat Boots "Every step
a small flutter." · Roost Charm "A feather for each that came back fed."

## 9. [NEW-BEHAVIOUR] summary for the Ranger

1. Cast functions and entities for the six new skills: skipping projectile, snare trigger entity, Overcast scheduler
   impacts, Quarry Mark (summon focus + jump on death + "no living mark" auto filter), mortar summon (lob loop), moving
   flock ground with waypoints.
2. New companion summon types (badger, heron) for the two new Companion runes.
3. Projectile features: retarget on death (Seeking Turn), distance flown (Long Flight, Long Shot), wall/max-range
   ricochet (Ricochet Fletch), spotted-target bending (Farwatch 4).
4. Monster steering toward snares (Bait), skill-scoped vulnerability (Soaked), controlled-enemy vulnerability (Trapper's
   Instinct; shared with the Mage's frozen/chilled bonuses), damage debuff field (Exposed Joints, shared with Concussion).
5. Set transforms: repeated-cast damage scale (Siegebreaker 4), rocket salvo at 4 Sentries, farwatch shot, personal storm
   with free volleys, bite leaps, snare re-arm by mortar.
6. Player DR fields (Loyal Guard, Starling Shield, Shadow Cover, Second Skin, snare DR) and a big-hit hook (Second Skin).
