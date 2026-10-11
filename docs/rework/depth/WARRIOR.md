# Warrior — content bible (M1: 12 skills, 5 runes, 6 nodes, 14 passives, 5 sets, 34 legendaries)

Design document for the class agent. Approved plan: `docs/rework/ITEMS-AND-SKILLS-PLAN.md`. Shared conventions, legendary
template kinds, item bases and affixes: `ITEMS-SHARED.md`. Parity arithmetic for every archetype below: `BUDGET.md`.
Reference patterns: `REFERENCES.md`.

**Labels.** **[M]** measured/read in this repo · **[P]** proposal (number or rule to be confirmed by the parity/TTK
harness) · **[NEW-BEHAVIOUR]** needs server code that today's `SkillMods` fields and flags cannot express (described
precisely so an engineer can build it) · *anchor:* the existing data a number was derived from.

**Mods notation.** `{dmg:+30}` etc. are `SkillMods` fields (additive %, as in `shared/src/data/skills.ts`); `flag:name`
is a behaviour flag; `name(r)` means the flag carries the node rank (1–3) as a parameter. Rune unlock rule [P]:
`RUNE_UNLOCK_OFFSETS = [2, 5, 9, 14, 20]`, clamped to level 70 (the first three offsets are today's [M]). Node layout
[P]: N1–N3 are open; N4 needs 2 ranks in N1, N5 needs 2 in N2, N6 needs 2 in N3; one rank costs one point; at most
**10 of the 18 ranks** per skill (so a tree is a choice, not a checklist, as in Last Epoch's capped skill level — see
`REFERENCES.md` §3). At most one node per skill is a plain number; it is marked *(plain)*.

## 1. Identity and categories

The warrior is the frontier's heavy labour turned to war: millwheels, bell towers, ploughs, cairns and kilns (tone of
`docs/rework/CAST.md`). Fury builds on hits (Cleave 5 per swing [M]), decays 3/s [M], max 100 [M]. New display
categories (a `category` field on `SkillDef` [P], the D3 class pages group skills the same way, `REFERENCES.md` §1):

| Category | Skills (unlock) |
|---|---|
| Strikes (primary) | Cleave (1), **Tolling Blow (16)** |
| Steel Storm (channels) | Whirlwind (2), **Ironplough (32)** |
| Bloodletting | Rend (4), **Sawtooth Hatchet (20)** |
| Earthshaker | Ground Stomp (6), Seismic Slam (9), **Cairnfall (40)** |
| Warcries | Battle Rage (12), **Muster Standard (26)**, **Kilnheart (50)** |

Tolling Blow is a second primary: the existing `save.skills.primary` already lets a character pick its primary [M].

## 2. Build archetypes

Six archetypes cover the four requested playstyles (melee channel, slam/stun, bleed, buff/shout) plus two that did not
exist: a front-cone channel (Ploughline) and a ranged-bleed thrower that is legendary-native (no set). Every archetype
lists 3–5 *relevant* legendaries; the parity numbers are in `BUDGET.md` §4.

| # | Archetype | Playstyle | Core skills (primary in italics) | Set | Relevant legendaries | Passives |
|---|---|---|---|---|---|---|
| W-A | **Gyre** | melee channel | Whirlwind, Rend, Battle Rage, Muster Standard, *Cleave* | Endless Storm | Ninefold Gale (2H), Gale-Stitched Legguards (legs), Girdle of the Eternal Gyre (belt), Tanner's Pauldrons (shoulders), Brass Warhorn Helm (head) | Turning Edge, Spinning Top, Iron Discipline, Open Veins |
| W-B | **Faultline** | slam/stun | Seismic Slam, Ground Stomp, Cairnfall, Battle Rage, *Tolling Blow* | Fault Warden | Faultcleaver (2H), Fissure-Lined Breastplate (chest), Quakestep Sabatons (feet), Vambraces of the Anvil (bracers), Stonecount Gauntlets (hands) | Fault Reader, Bellwether, Deep Earth, Measured Recovery |
| W-C | **Cinderblood** | bleed (fire-bleed) | Rend, Sawtooth Hatchet, Battle Rage, Ground Stomp, *Cleave (Hemorrhage Arc)* | Cinder Oath | Bloodwake (1H), Ashgrip Gauntlets (hands), Tanner's Pauldrons (shoulders), Red Ledger (amulet), Grinning Saw (1H, Cube) | Open Veins, Grudge Holder, Banked Fury, Rooted Heart |
| W-D | **Warcaller** | buff/shout | Battle Rage, Muster Standard, Kilnheart, Ground Stomp, *Tolling Blow* | Hearthbanner (new) | Bellwright's Maul (mace), Ward Pennant Shield, Quartermaster's Cuirass (chest), Brass Warhorn Helm (head), Seething Sigil (amulet) | War Drummer, Bellwether, Second Wind, Measured Recovery |
| W-E | **Ploughline** | front-cone channel, crowd push | Ironplough, Ground Stomp, Battle Rage, Muster Standard, *Tolling Blow* | Furrowmark (new) | Coulter Blade (2H), Yoke Greaves (legs), Ox-Harness Belt, Quakestep Sabatons (feet), Vambraces of the Anvil (bracers) | Spinning Top, Iron Discipline, Bellwether, Iron Poise |
| W-F | **Hatchetwind** | ranged bleed, legendary-native | Sawtooth Hatchet, Rend (Gash Sense), Cairnfall, Battle Rage, *Cleave* | none (Patchwork Signet) | Grinning Saw (1H), Woodcutter's Grips (hands), Sawyer's Ring, Tanner's Pauldrons (shoulders), Bloodwake (Cube) | Open Veins, Grudge Holder, Iron Discipline |

How each plays (one paragraph each):

* **Gyre.** Rend opens a pack, Whirlwind spins through it; Muster Standard (rune *Marching Orders*) keeps attack speed and
  Fury flowing, Battle Rage keeps crit up. Set kit: the Storm makes Whirlwind apply Rend's bleed and ties the Dust Devils
  to you. Legendary kit: Gale-Stitched Legguards (stacking *more* while spinning), Tanner's Pauldrons (bleeding enemies
  take more from everything) and the Warhorn fill the six armour slots the set would occupy.
* **Faultline.** Tolling Blow's tolls and Ground Stomp stun, Seismic Slam and Cairnfall cash the stun in (Anvil
  Vambraces, Jarring Slam, the new vs-stunned nodes). Set kit: Fault Warden's fault lines re-stun and its 6-piece is a
  vs-stunned multiplier. Legendary kit: Fissure-Lined Breastplate (vs-stunned *more*), Quakestep Sabatons (a stomp on
  every dash) and Stonecount Gauntlets.
* **Cinderblood.** Cleave with *Hemorrhage Arc* and Sawtooth Hatchet seed bleeds; Rend is the big bleed; *Open Veins*
  lets bleeds stack. Set kit: Cinder Oath turns bleeds into burning bleeds that leave cinder pools on death. Legendary kit:
  Ashgrip Gauntlets (Cleave *more* vs bleeding, extends bleeds) and Tanner's Pauldrons.
* **Warcaller.** The damage is in the primary (Tolling Blow) under stacked buffs: Battle Rage, the Standard and the
  Kilnheart window; War Drummer rewards having two up. Set kit: Hearthbanner's Standard walks with you and every third
  blow shouts. Legendary kit: Bellwright's Maul (tolls every 2nd blow), the Pennant Shield and the Cuirass (two Standards).
* **Ploughline.** Ironplough pushes a pack ahead of you in a 90° cone, ramping up to double damage; Ground Stomp and
  Tolling Blow lock the pile. Set kit: Furrowmark stuns enemies shoved into each other and leaves an erupting furrow.
  Furrowmark covers belt and bracers instead of legs and feet, so a hybrid keeps the leg and boot legendaries — a
  deliberate slot puzzle (`ITEMS-SHARED.md` §4).
* **Hatchetwind.** A thrower who never closes in: Sawtooth Hatchet out and back through a line, Rend cast at range
  (*Gash Sense*), Cairnfall for packs that do reach you. No set exists for it on purpose; the shared **Patchwork Signet**
  (bonus per legendary while no set bonus is active, `ITEMS-SHARED.md` §2) is its "set". It is the template for "a full
  set of relevant legendaries" that the owner asked to be competitive.

## 3. New skills (6)

Coefficient band of the class today [M]: primary 1.6 (Cleave), spenders 6.0 / 20 Fury (Rend, a DoT on everything within
150) and 7.55 / 30 Fury (Seismic Slam, cone), channel 3.4/s for 10 Fury/s (Whirlwind), cooldown 2.4 at 12 s with +15
Fury (Ground Stomp), buff 20 Fury (Battle Rage). Every new number below is placed inside or beside that band and says how.

### W7 Tolling Blow — `tolling_blow` (Strikes, primary, L16)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| primary | physical | 2.0 | 0 | 6 | 0 | 86 | 70 | 0.75 | 0 | `always` |

* *Anchor:* Cleave 1.6 hits an arc; a single-target primary gets 1.25× Cleave's coefficient [P] plus a periodic splash, so
  it out-damages Cleave on one target and loses on packs. Gen 6 vs Cleave 5 because it hits one enemy. Range 86 = Cleave.
* **Behaviour.** Strikes the primary target for `coef`. A counter on the player advances per blow; every **3rd** blow
  *tolls*: a shockwave centred on the target deals 100% weapon damage to enemies within `radius` and stuns them for
  `duration` s. [NEW-BEHAVIOUR] `tollingBlow()` cast function: per-player `tollCount`, reuses `strikeMob`, `stunMob`
  and the `aoe` event (variant `toll`).
* **Desc:** "Strike an enemy for {coef} weapon damage. Every third blow tolls, dealing 100% weapon damage and stunning
  enemies within {radius} units for {duration} seconds. Generates {gen} Fury."
* **Auto-cast:** as every primary (`always`, attack speed paced, `brain.ts` [M]).
* **VFX / icon / sound.** Overhead two-handed arc that ends in a bronze ripple ring on the toll; stunned enemies show a
  small ringing-bell glyph. Icon glyph `bell`, colour 0xc9a227 (bronze). Sound: dull wooden thud per blow; the toll is a
  low procedural bell (fundamental + 2.76× partial, 0.8 s decay).

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Double Peal** (18) | Tolls every 2nd blow; toll stun 0.5 s. | `flag:tollEvery2`, `{duration:-33}` |
| **Bronze Echo** (21) | The toll shockwave repeats 0.5 s later at the same spot for 100% weapon damage (no stun). | `flag:tollEcho` (reuse the `aftershock` scheduler pattern of Seismic Slam [M]) |
| **Furnace Clapper** (25) | Fire damage; tolls ignite enemies for 150% weapon damage over 3 s. | `{element:'fire'}`, `flag:tollIgnite` (burn DoT exists [M]) |
| **Watch Bell** (30) | Tolls generate 10 Fury and grant 4% damage reduction for 3 s (max 3 stacks). | `flag:tollWatch` [NEW-BEHAVIOUR] player DR buff field |
| **Iron Tongue** (36) | No tolls; every blow deals 50% more damage and passes through to the enemy behind the target. | `{dmg:+50}`, `flag:noToll`, `flag:tollPierce` |

### W8 Sawtooth Hatchet — `sawtooth_hatchet` (Bloodletting, spender, L20)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| spender | physical | 1.8 per pass + bleed 2.4 | 20 | 0 | 0 | 320 | 40 | 4 | 0 | `enemiesNear {count:2, within:320}` |

* *Anchor:* Rend deals 6.0 over 5 s for 20 Fury [M]. The hatchet's per-target total (1.8 out + 1.8 back + 2.4 bleed =
  6.0) matches Rend for the same 20 Fury [P]; it trades Rend's 150-radius circle for a 320×80 line, so it is the
  warrior's only ranged spender.
* **Behaviour.** A projectile flies along the best line (reuse `bestConeAngle` with a 12° half-angle [M]) to `range`,
  then returns to the player's *current* position; it pierces everything and hits each enemy once per pass. The first
  hit applies a bleed (`DotKind 'bleed'`, skill `sawtooth_hatchet`, `coef` 2.4 over `duration` s; a separate dot from
  Rend's because dots are keyed by skill [M]). [NEW-BEHAVIOUR] returning projectile (new `ProjKind 'hatchet'` with an
  outbound/return phase and a per-phase hit set).
* **Desc:** "Hurl a serrated hatchet that cuts through enemies on the way out and back for {coef} weapon damage each pass
  and makes them bleed for 240% weapon damage over {duration} seconds." (`{coef}` renders 180%.)
* **Auto-cast:** 2+ enemy weight on a line within 320.
* **VFX / icon / sound.** Spinning hatchet with a red smear trail and a soft arc; blood flecks on hit. Icon `hatchet`,
  0xa33a2a. Sound: "whup-whup" whirr rising out and falling back, wet chop on hits.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Twin Hatchets** (22) | Two hatchets in a 20° V, each 70% damage. | `{projectiles:+1, dmg:-30}` |
| **Lodged Teeth** (25) | The hatchet stops at the first elite or boss and grinds for 1.5 s (4 hits at 60%) before returning. | `flag:hatchetLodge` |
| **Kiln-Heated** (29) | Fire damage; the bleed becomes a burn that lasts 50% longer. | `{element:'fire', duration:+50}`, `flag:hatchetBurn` |
| **Bloodtrail** (34) | When the hatchet returns, heal 1% of maximum Life per enemy currently bleeding (max 10%). | `flag:hatchetHeal` |
| **Rusted Edge** (40) | Enemies bleeding from the hatchet take 10% more damage from all your bleeds. | `flag:rustVuln` [NEW-BEHAVIOUR] skill-scoped vulnerability (bleed-tagged strikes only) |

### W9 Muster Standard — `muster_standard` (Warcries, cooldown aura, L26)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| cooldown | physical | 0 | 0 | 10 | 20 | 0 | 240 | 12 | 0 | `enemiesNear {count:3, within:240}` |

* *Anchor:* Ground Stomp's +15 Fury and 12 s cooldown [M]; Battle Rage's 10% damage buff [M]. The Standard is a
  60%-uptime (12/20 s) +15% attack-speed aura [P]; D3 shouts are party-wide (`REFERENCES.md` §1), so it is too.
* **Behaviour.** Plants a standard at the player's feet for `duration` s. You and party members inside `radius` gain
  +15% attack speed and 2 resource per second (each class's own resource). [NEW-BEHAVIOUR] a stationary non-attacking
  "standard" entity (a `Ground` kind `standard` that applies a party buff each tick is enough; it must replicate for the
  banner art).
* **Desc:** "Plant a war standard for {duration} seconds. You and allies within {radius} units gain 15% attack speed and
  2 resource per second. Generates {gen} Fury."
* **VFX / icon / sound.** Tall pole with a madder-red banner bearing a hearth sigil, faint 240-unit ground ring, cloth
  ripple. Icon `banner`, 0xb03a2e. Sound: cloth snap and a short low horn note.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Ember Pennant** (28) | The standard pulses every second for 60% weapon damage as Fire to enemies within its radius. | `{element:'fire'}`, `flag:standardPulse` |
| **Rallying Ground** (31) | Allies inside also regenerate 1% of maximum Life per second. | `flag:standardRegen` |
| **Taunting Colours** (35) | On planting, enemies within 300 units turn on the standard for 3 s. | `flag:standardTaunt` [NEW-BEHAVIOUR] monster taunt (target override to an entity) |
| **Marching Orders** (40) | The standard is carried: it follows you; radius −30%. | `{radius:-30}`, `flag:standardCarry` |
| **Last Rampart** (46) | Once per standard, fatal damage taken inside it leaves you at 1 Life and 2 s of invulnerability. | `flag:standardRampart` [NEW-BEHAVIOUR] cheat death hook |

### W10 Ironplough — `ironplough` (Steel Storm, channel, L32)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| channel | physical | 2.6/s ramping to 5.2/s | 12 per s | 0 | 0 | 200 | 150 (cone length) | 0 | 0 | `channel {startAt:30, within:200}` |

* *Anchor:* Whirlwind 3.4/s on a 100-radius circle for 10 Fury/s [M]. Ironplough hits a 90° front cone of length 150,
  i.e. fewer targets, so it starts lower (2.6/s, 0.76× Whirlwind) and ramps +20% every 0.5 s held, to 2× at 2.5 s
  (5.2/s, 1.53× Whirlwind) [P]; it costs 20% more Fury per second.
* **Behaviour.** Channel: every 250 ms tick (as Whirlwind [M]) strikes enemies in a 90° cone in the facing direction and
  knocks them 20 units forward (`knockbackMob` [M]); the player moves at 60% speed while channeling. Ramp stacks reset
  when the channel ends. [NEW-BEHAVIOUR] channel with ramp stacks and a movement-speed multiplier while channeling
  (channel state already exists for Whirlwind [M]; add `ramp` and a speed factor read by movement on server and client
  identically — hard rule 5 of `AGENTS.md`).
* **Desc:** "Drive forward behind your weapon, dealing {coef} weapon damage per second to enemies in front of you and
  pushing them back. Damage rises the longer you push, up to double. Costs {cost} Fury per second."
* **VFX / icon / sound.** Weapon held low and forward, soil spraying sideways like a plough share, two furrow lines left
  in the ground; ramp shown by brighter sparks. Icon `plough`, 0x8a6f4d. Sound: scraping earth loop whose grind pitch
  rises with the ramp.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Deep Furrow** (34) | No pushback: enemies at the tip are held and dragged with you, and take 25% more damage. | `{dmg:+25}`, `flag:ploughHold` (reuse `dragMob` [M]) |
| **Stone Spray** (37) | Every 0.5 s the plough flings 3 stones forward (range 300, 60% weapon damage each). | `flag:ploughStones` |
| **Smouldering Share** (41) | Fire damage; enemies hit burn for 50% of the damage over 2 s. | `{element:'fire'}`, `flag:ploughBurn` |
| **Steady Oxen** (46) | Ramp builds twice as fast but you move at 30% speed while channeling. | `flag:ploughFastRamp` |
| **Breakwater** (52) | Enemy projectiles that enter your front cone are destroyed. | `flag:ploughBlock` [NEW-BEHAVIOUR] delete hostile `mob` projectiles inside the cone |

### W11 Cairnfall — `cairnfall` (Earthshaker, cooldown, L40)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| cooldown | physical | 3.0 per cairn × 5 | 0 | 20 | 30 | 0 | 70 (each), ring 120 | 1 | 0 | `enemiesNear {count:5, within:200}` |

* *Anchor:* Ground Stomp 2.4 at 12 s with +15 Fury [M]; Rain of Vengeance 15 total at 30 s [M]. Cairnfall's 5 × 3.0 =
  15 at a 30 s cooldown matches the rain's budget, delivered as stuns [P]; +20 Fury beside the stomp's +15.
* **Behaviour.** Five telegraphed cairns land in a ring of radius 120 around the player over 1.25 s (0.25 s apart); each
  impact deals `coef` to enemies within 70 and stuns them for `duration` s. Visual-only stones stay 4 s (no collision:
  collision changes are out of scope, `AGENTS.md` rule 5). [NEW-BEHAVIOUR] cast function using the scheduler and the
  existing `tele`/`aoe` events (pattern of Meteor Shower [M]).
* **Desc:** "Call down five stone cairns around you. Each deals {coef} weapon damage and stuns enemies within {radius}
  units for {duration} second. Generates {gen} Fury."
* **VFX / icon / sound.** Grey telegraph circles, stacked flat stones slam down with dust rings and grit. Icon `cairn`,
  0x8f8578. Sound: a descending rumble, then a heavy stone crack per impact.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Landslide** (42) | Cairns fall in a line toward the densest pack (to range 300) instead of a ring. | `flag:cairnLine` |
| **Waymarker** (45) | Cairns stay 6 s; every 2 s each one stuns enemies touching it (radius 50) for 1 s and deals 50% damage. | `flag:cairnStay` |
| **Kiln Stones** (49) | Fire damage; each impact leaves molten ground for 2 s. | `{element:'fire'}`, `flag:cairnMolten` (reuse Meteor's molten ground [M]) |
| **Debt of Stone** (54) | Eight cairns instead of five; cooldown +50%. | `{cooldown:+50}`, `flag:cairnMore` |
| **Shepherd's Count** (60) | Each enemy stunned by Cairnfall reduces its cooldown by 1 s (max 10 s per cast). | `flag:cairnRefund` |

### W12 Kilnheart — `kilnheart` (Warcries, cooldown transformation, L50)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| cooldown | fire | ignite 0.6 per hit | 0 | 0 | 90 | 0 | 0 | 20 | 0 | `enemiesNear {count:8, within:300}` (elites weigh more: `mobWeight` [M]) |

* *Anchor:* Battle Rage +10% damage (+25% with Marauder's Rage) and +3% crit for 20 Fury, maintained [M]. Kilnheart is a
  burst window: +20% damage (generic bucket), +15% attack speed, Fury costs −50% and ignites (60% weapon damage over 2 s,
  refreshed per hit) for 20 of 90 s [P]. With 30% cooldown reduction that is ~32% uptime.
* **Behaviour.** A timed buff (`addBuff` with dmg/ias fields [M]) plus a cost multiplier and an on-hit burn. [NEW-
  BEHAVIOUR] buff-driven resource-cost multiplier (read in `skillCost`) and an on-hit ignite while the buff is up
  (Magic Weapon's *Ignite* is the existing pattern [M]).
* **Desc:** "Stoke your heart like a kiln for {duration} seconds: deal 20% more damage, attack 15% faster, spend half as
  much Fury, and your hits ignite enemies for 60% weapon damage over 2 seconds."
* **VFX / icon / sound.** Chest seam glows furnace-orange, heat shimmer around the hero, scorched footprints. Icon
  `furnace`, 0xff6a1a. Sound: bellows whoosh igniting, then a low roaring loop while active.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Banked Coals** (52) | Lasts 50% longer but grants no attack speed. | `{duration:+50}`, `flag:kilnNoIas` |
| **Bellows Breath** (55) | On activation, exhale a 90° fire cone (range 250) for 600% weapon damage. | `flag:kilnBreath` |
| **Slag Skin** (59) | While active, take 30% less damage and melee attackers burn for 100% weapon damage over 2 s. | `flag:kilnSkin` |
| **Stoked** (64) | Each kill while active extends Kilnheart by 0.5 s (max +10 s). | `flag:kilnExtend` |
| **Cold Forge** (70) | Cold instead of Fire: hits chill instead of igniting, and chilled enemies take 10% more damage from you. | `{element:'cold'}`, `flag:kilnChill` |

## 4. Two new runes for each existing skill

Runes 4 and 5 unlock at skill unlock +14 and +20 [P] (Cleave 15/21, Whirlwind 16/22, Rend 18/24, Ground Stomp 20/26,
Seismic Slam 23/29, Battle Rage 26/32). Magnitudes follow the existing runes of the same skill [M].

| Skill | Rune (unlock) | Effect | Mods |
|---|---|---|---|
| Cleave | **Hemorrhage Arc** (15) | Cleave applies a bleed of 40% weapon damage over 2 s (a separate dot from Rend). | `flag:cleaveBleed` |
| Cleave | **Backswing** (21) | Each swing is followed 0.2 s later by a backswing in the same arc for 50% damage that generates no Fury. | `flag:cleaveBackswing` |
| Whirlwind | **Gyre of Ash** (16) | Whirlwind leaves a 2 s ember trail that burns enemies for 40% weapon damage per second. | `flag:whirlTrail` (ground kind `trail` exists [M]) |
| Whirlwind | **Tethered Spin** (22) | Each tick pulls enemies within 160 units 30 units toward you; radius −15%. | `{radius:-15}`, `flag:whirlPull` |
| Rend | **Gash Sense** (18) | Rend is centred on the densest pack within 260 units instead of on you. | `flag:rendRanged` |
| Rend | **Haemal Debt** (24) | Rend costs 50% more Fury; each Rend-bleeding enemy that dies refunds 4 Fury. | `{cost:+50}`, `flag:rendRefund` |
| Ground Stomp | **Outward Tremor** (20) | After the stomp a ring wave travels to 320 units, dealing 100% weapon damage and stunning for 0.5 s. | `flag:stompWave` |
| Ground Stomp | **Iron Root** (26) | For 3 s after stomping you cannot be stunned, frozen or knocked back and take 20% less damage. | `flag:stompRoot` [NEW-BEHAVIOUR] player control immunity window |
| Seismic Slam | **Split Earth** (23) | Three fissures fanned 30° apart, each 70% damage. | `flag:slamTriple` |
| Seismic Slam | **Bedrock** (29) | Costs 10 more Fury; each enemy hit beyond the first adds 5% damage to the slam (max +50%). | `{cost:+33}`, `flag:slamDensity` |
| Battle Rage | **Bloodsong** (26) | While active, every 20 Fury spent heals 2% of maximum Life. | `flag:rageHeal` |
| Battle Rage | **Shared Fury** (32) | Battle Rage's damage bonus also applies to party members within 400 units. | `flag:rageShare` |

## 5. Specialization nodes (6 per skill, ranks 1–3)

Values are r1 / r2 / r3. "(plain)" is the single plain-number node allowed per skill.

**Cleave**
| Node | Effect | Mods |
|---|---|---|
| N1 Wide Stance *(plain)* | Radius +8 / 16 / 24%. | `{radius}` |
| N2 Notched Edge | A swing that hits 3+ enemies generates +1 / 2 / 3 Fury. | `cleaveCrowdFury(r)` |
| N3 Reaper's Rhythm | A Cleave kill starts a free swing at the nearest enemy; internal cooldown 1.2 / 0.9 / 0.6 s. | `cleaveKillSwing(r)` [NEW-BEHAVIOUR] |
| N4 Braced Swing | Each enemy hit grants 1 / 2 / 3% damage reduction for 2 s (max 12%). | `cleaveBrace(r)` [NEW-BEHAVIOUR] DR buff |
| N5 Opening Cut | +40 / 80 / 120% Cleave damage against enemies above 90% Life. | `cleaveOpener(r)` [NEW-BEHAVIOUR] target-conditional skill bonus |
| N6 Ground Shaker | Cleave hits on stunned enemies extend the stun by 0.1 / 0.2 / 0.3 s (once per stun) and give +1 Fury. | `cleaveStunExtend(r)` |

**Whirlwind**
| Node | Effect | Mods |
|---|---|---|
| N1 Tight Spin *(plain)* | Radius +6 / 12 / 18%. | `{radius}` |
| N2 Second Breath | The first 0.5 / 1.0 / 1.5 s of each channel costs no Fury. | `whirlFreeStart(r)` |
| N3 Devil's Tithe | Each Dust Devil that ends restores 1 / 2 / 3 Fury. | `devilFury(r)` |
| N4 Eye Wall | Ticks every 0.22 / 0.20 / 0.18 s instead of 0.25 s, but radius −10%. | `whirlTickRate(r)`, `{radius:-10}` |
| N5 Bloodied Gyre | Ticks generate 0.1 / 0.2 / 0.3 Fury per bleeding enemy hit (max 3 Fury/s). | `whirlBleedFury(r)` |
| N6 Devil Herding | Dust Devils steer to the densest pack and pull small enemies 10 / 20 / 30 units toward their centre per tick. | `devilPull(r)` |

**Rend**
| Node | Effect | Mods |
|---|---|---|
| N1 Wide Tear *(plain)* | Radius +10 / 20 / 30%. | `{radius}` |
| N2 Thirsting Wounds | +2 / 4 / 6 Fury per enemy beyond the third caught. | `rendCrowdFury(r)` |
| N3 Rollover | Re-applying Rend to a bleeding enemy carries 50 / 75 / 100% of the remaining bleed into the new one. | `rendRollover(r)` [NEW-BEHAVIOUR] dot carry-over in `addDot` |
| N4 Gathering Tear | Rend pulls enemies 15 / 30 / 45 units toward its centre. | `rendPull(r)` (reuse `dragMob` [M]) |
| N5 Bloodletter's Pace | Each Rend cast grants +3 / 6 / 9% attack speed for 4 s. | `rendHaste(r)` |
| N6 Open Artery | When a Rend-bleeding enemy dies, 50% of its remaining bleed bursts on enemies within 80 / 110 / 140 units. | `rendBurst(r)` [NEW-BEHAVIOUR] death hook |

**Ground Stomp**
| Node | Effect | Mods |
|---|---|---|
| N1 Heavy Heel *(plain)* | Stun +0.25 / 0.5 / 0.75 s. | `{duration}` |
| N2 Fury Spring | +5 / 10 / 15 Fury per elite hit. | `stompEliteFury(r)` |
| N3 Echo Stomp | 1.0 / 0.8 / 0.6 s later a second stomp (half radius, no stun) hits for 50%. | `stompEcho(r)` |
| N4 Concussion | Enemies it stunned deal 10 / 20 / 30% less damage for 4 s after the stun. | `stompWeaken(r)` [NEW-BEHAVIOUR] monster damage debuff |
| N5 Sure Footing | Hitting 5+ enemies reduces its cooldown by 1 / 2 / 3 s. | `stompRefund(r)` |
| N6 Gather | Enemies at the edge are dragged 20 / 40 / 60 units inward before the stun. | `stompGather(r)` |

**Seismic Slam**
| Node | Effect | Mods |
|---|---|---|
| N1 Long Fissure *(plain)* | Cone length +8 / 16 / 24%. | `{radius}` |
| N2 Tremor Feed | Refunds 3 / 6 / 9 Fury when it hits 4+ enemies. | `slamRefund(r)` |
| N3 Upheaval | Enemies in the far 30% of the cone are stunned 0.4 / 0.6 / 0.8 s. | `slamTipStun(r)` |
| N4 Splayed Fault | Cone angle +10 / 20 / 30° but length −10%. | `slamWide(r)` |
| N5 Bedrock Pace | Each slam within 2 s of the last costs 3 / 6 / 9 less Fury (stacks 3). | `slamChain(r)` |
| N6 Open Crack | The cone leaves a crack for 1 / 1.5 / 2 s; enemies entering it take 40% of the slam once. | `slamCrack(r)` [NEW-BEHAVIOUR] ground kind `crack` |

**Battle Rage**
| Node | Effect | Mods |
|---|---|---|
| N1 Simmer *(plain)* | Duration +10 / 20 / 30 s. | `{duration}` |
| N2 Hot Blood | While active, critical hits heal 0.3 / 0.6 / 1% of maximum Life. | `rageCritHeal(r)` |
| N3 Red Tide | Casting it grants 10 / 20 / 30 Fury. | `rageCastFury(r)` |
| N4 Drumbeat | Every 5 s while active, your next primary attack deals +50 / 100 / 150% damage. | `ragePulse(r)` |
| N5 Fury Well | While above 80 Fury, the damage bonus is 5 / 10 / 15 points higher. | `rageHighFury(r)` |
| N6 Long Ringing | While active, your stuns last 10 / 20 / 30% longer. | `rageStunLonger(r)` |

**Tolling Blow**
| Node | Effect | Mods |
|---|---|---|
| N1 Heavier Clapper *(plain)* | +10 / 20 / 30% damage. | `{dmg}` |
| N2 Ringing Ears | Tolled enemies take +5 / 10 / 15% from your next Seismic Slam or Cairnfall hit (consumed). | `tollPrime(r)` [NEW-BEHAVIOUR] consumable mark |
| N3 Quick Peal | Critical hits advance the toll counter twice (33 / 66 / 100% chance). | `tollCritCount(r)` |
| N4 Twin Ring | Each toll also rings at your feet for 40 / 70 / 100% of the shockwave. | `tollSelfRing(r)` |
| N5 Muffled Strike | +20 / 40 / 60% damage against stunned enemies. | `tollStunned(r)` |
| N6 Carillon | Each toll adds 10 / 20 / 30% to the next toll (max 3; resets after 2 s without a blow). | `tollCarillon(r)` |

**Sawtooth Hatchet**
| Node | Effect | Mods |
|---|---|---|
| N1 Keen Teeth *(plain)* | Bleed damage +15 / 30 / 45%. | `hatchetBleedPct(r)` |
| N2 Seeking Return | On the way back it curves up to 30 / 45 / 60° toward the nearest bleeding enemy. | `hatchetSeek(r)` |
| N3 Grinding Stop | Pauses at the apex for 0.2 / 0.4 / 0.6 s, hitting enemies there every 0.2 s. | `hatchetHover(r)` |
| N4 Splinters | Each pass that hits an elite throws 1 / 2 / 3 splinters to nearby enemies (40% damage, apply bleed). | `hatchetSplinter(r)` |
| N5 Catch | Catching it refunds 3 / 6 / 9 Fury if it hit 3+ enemies. | `hatchetCatch(r)` |
| N6 Serrated Wake | Enemies hit on both passes take +15 / 30 / 45% on the second pass. | `hatchetDouble(r)` |

**Muster Standard**
| Node | Effect | Mods |
|---|---|---|
| N1 Wide Muster *(plain)* | Radius +10 / 20 / 30%. | `{radius}` |
| N2 Drill Cadence | Inside it, your primary attack generates +1 / 2 / 3 Fury. | `standardGen(r)` |
| N3 Rallying Pulse | Planting heals you and allies inside for 5 / 10 / 15% of maximum Life. | `standardHeal(r)` |
| N4 Hold the Line | Enemies inside are slowed 10 / 20 / 30%. | `standardSlow(r)` (chill [M]) |
| N5 Quick Muster | Each kill inside reduces its cooldown by 0.25 / 0.5 / 0.75 s. | `standardRefund(r)` |
| N6 Colour Guard | When it expires it shouts: +10 / 20 / 30% damage (generic) for 5 s to everyone who was inside. | `standardFinale(r)` |

**Ironplough**
| Node | Effect | Mods |
|---|---|---|
| N1 Broad Share *(plain)* | Cone angle +5 / 10 / 15°. | `{radius}` (angle uses the radius modifier as Seismic Slam does [M]) |
| N2 Ox Strength | Pushback +50 / 100 / 150%; enemies pushed into another enemy take 30% of the tick again. | `ploughPush(r)` [NEW-BEHAVIOUR] knockback collision check |
| N3 Patient Draft | Ramp stacks persist 0.5 / 1 / 1.5 s after the channel stops. | `ploughKeepRamp(r)` |
| N4 Sod Burst | Every 1.0 / 0.75 / 0.5 s the cone tip erupts (radius 60, 60% damage). | `ploughBurst(r)` |
| N5 Thrift Furrow | Costs 1 / 2 / 3 less Fury per second for each enemy in the cone beyond the first (minimum 0). | `ploughThrift(r)` |
| N6 Brace | At full ramp you take 10 / 20 / 30% less damage from enemies in front of you. | `ploughGuard(r)` [NEW-BEHAVIOUR] directional DR |

**Cairnfall**
| Node | Effect | Mods |
|---|---|---|
| N1 Heavier Stones *(plain)* | +10 / 20 / 30% damage. | `{dmg}` |
| N2 Tight Ring | The ring shrinks to radius 90 / 70 / 50, so cairns overlap on enemies next to you. | `cairnTight(r)` |
| N3 Quarry Dust | Enemies hit are slowed 20 / 35 / 50% for 3 s. | `cairnSlow(r)` |
| N4 Second Fall | 30 / 60 / 90% chance each cairn bounces once to an enemy within 150 for 50% damage. | `cairnBounce(r)` |
| N5 Fury Cairn | Each cairn that hits generates 2 / 4 / 6 Fury. | `cairnFury(r)` |
| N6 Capstone | The last cairn is a giant: radius ×1.5 / 1.75 / 2.0 and 50% more damage. | `cairnCapstone(r)` |

**Kilnheart**
| Node | Effect | Mods |
|---|---|---|
| N1 Hotter Coals *(plain)* | Ignite damage +20 / 40 / 60%. | `kilnIgnitePct(r)` |
| N2 Draft Door | Every 50 Fury spent reduces its cooldown by 1 / 2 / 3 s. | `kilnRefund(r)` |
| N3 Cinder Prints | While active you leave burning footprints (2 s, 30 / 50 / 70% weapon damage per second). | `kilnTrail(r)` (ground `trail` [M]) |
| N4 Afterglow | When it ends, keep 30 / 50 / 70% of its damage bonus for 8 s. | `kilnAfterglow(r)` |
| N5 Stoke the Fire | Activating it restores 25 / 50 / 75 Fury. | `kilnFill(r)` |
| N6 Heat Haze | While active, enemies within 150 units take 5 / 10 / 15% more damage from you. | `kilnAura(r)` [NEW-BEHAVIOUR] proximity vulnerability |

## 6. Passives (6 existing kept + 8 new)

Existing [M] (kept unchanged, `shared/src/passives.ts`): Turning Edge (Whirlwind damage, L10), Fault Reader (Seismic Slam
damage, L10), Banked Fury (resource regeneration, L20), Measured Recovery (cooldown reduction, L30), Rooted Heart (Life,
L40), Iron Poise (Armor, L50). Passive slots stay at 4 (levels 10/20/30/70 [M]). New passives are rules, not stats
(the D3 Barbarian page lists 19 passives from L10 to L68, mostly conditional triggers — `REFERENCES.md` §1):

| Passive (unlock) | Effect | Archetypes | Template / behaviour |
|---|---|---|---|
| **Bellwether** (14) | Stunning an enemy grants 2 Fury (max 10 per second) and +4% attack speed for 4 s (max 5 stacks). | Faultline, Warcaller, Ploughline | onEvent(stun) → resource + stacking buff [NEW-BEHAVIOUR] stun event hook |
| **Open Veins** (18) | Bleeds no longer refresh: each new application adds a separate instance (max 3 per enemy per skill), each at 70% strength. | Cinderblood, Hatchetwind, Gyre | [NEW-BEHAVIOUR] dot stacking in `addDot` |
| **Spinning Top** (24) | While channeling, each second adds +4% damage (max 5) and +3% movement speed; stacks last 1 s after the channel. | Gyre, Ploughline | channel-time buff |
| **War Drummer** (28) | Battle Rage, Muster Standard and Kilnheart last 30% longer; while two of them are active, your primary attack deals 25% increased damage. | Warcaller | duration mod + conditional skill bonus |
| **Grudge Holder** (36) | The first elite that damages you every 10 s is marked for 6 s and takes 15% more damage from you. | all (bosses) | uses the existing mark fields (`markMs/markPct` [M]) |
| **Deep Earth** (45) | Ground Stomp, Seismic Slam, Cairnfall and Tolling Blow's tolls leave tremor ground for 2 s that slows enemies 30%; you deal 10% more damage to slowed enemies. | Faultline | [NEW-BEHAVIOUR] ground kind `tremor` + vs-chilled bonus |
| **Second Wind** (55) | Once every 90 s, fatal damage instead leaves you at 40% Life and resets Ground Stomp and Cairnfall. | defensive, all | [NEW-BEHAVIOUR] cheat-death hook (shared with Last Rampart) |
| **Iron Discipline** (64) | Fury no longer decays and maximum Fury +20; Fury generated by primary attacks −15%. | Gyre, Ploughline, Hatchetwind | resource rule change |

## 7. Sets: three redesigned, two new

Rule [P] (`BUDGET.md` §3): the whole set (2+4+6, including the damage value of its transforms) may multiply a skill by at
most **×2.5** against the same character in six rares; the 6-piece is a **transform** (damage value ≤ ×1.10) plus an
own-bucket multiplier of **×1.25** (unconditional) or **×1.35 while a condition holds**, hard cap ×1.3 effective. The 2- and
4-piece carry most of the value (≈×1.5–1.7 together) so a 4-piece hybrid stays competitive.
Today's 6-pieces are ×51 (Endless Storm), ×127 (Cinder Oath) and ×22 (Fault Warden) [M, `playerctx.ts` / P11 report].
Standard warrior footprint [M]: horned helm, spiked mantle, breastplate, gauntlets, legplates, sabatons.

### Raiment of the Endless Storm (redesign) — motif *wind* (unchanged)
| Pieces | Today [M] | Redesign [P] | Data |
|---|---|---|---|
| 2 | Whirlwind gains Dust Devils. | Whirlwind gains Dust Devils (frees the rune slot) and costs 25% less Fury. | `flag:dustDevils`, `{cost:-25}` |
| 4 | 50% less damage while whirling; Whirlwind applies Rend's bleed at +200%. | 40% less damage while whirling; Whirlwind applies Rend's bleed (your Rend rune and nodes apply, no +200%). | `stormDR` → 0.6, `whirlRend` without the ×3 |
| 6 | Whirlwind, Dust Devils and the bleeds deal +5,000% (×51). | **Transform:** Dust Devils no longer wander; they orbit at the edge of your Whirlwind and pull enemies 15 units inward per tick. Whirlwind, Dust Devils and all your bleeds deal **×1.25** (own bucket). | `devilOrbit` [NEW-BEHAVIOUR], `multiplier:1.25` on whirlwind, dust_devil, rend |

### Fault Warden (redesign) — motif *stone* (unchanged)
| Pieces | Today [M] | Redesign [P] | Data |
|---|---|---|---|
| 2 | Seismic Slam and Ground Stomp +40% radius. | Seismic Slam, Ground Stomp and Cairnfall +30% radius; Ground Stomp cooldown −20%. | `{radius:+30}`, `{cooldown:-20}` |
| 4 | Ground Stomp cooldown −30%. | Seismic Slam hits on stunned enemies trigger an aftershock for 50% of the hit 1 s later; you take 20% less damage from stunned enemies. | `slamStunAftershock` [NEW-BEHAVIOUR], `stunnedDR` |
| 6 | Both deal +2,100% (×22). | **Transform:** Seismic Slam raises a fault line along its cone for 3 s; enemies crossing it are stunned 1 s (once per 3 s each). Seismic Slam, Ground Stomp and Cairnfall deal **×1.35 to stunned enemies** (own bucket, conditional). | ground `faultline` [NEW-BEHAVIOUR], conditional multiplier |

### Cinder Oath (redesign) — motif *ember* (unchanged)
| Pieces | Today [M] | Redesign [P] | Data |
|---|---|---|---|
| 2 | Cleave and Rend reach 40% further. | Cleave and Rend +30% radius; Rend's bleed deals Fire damage (it still counts as a bleed). | `{radius:+30}`, `{element:'fire'}` on Rend |
| 4 | Rend costs 40% less Fury. | Rend costs 40% less Fury; Cleave hits extend your bleeds on the target by 0.5 s (max 10 s total) and Cleave deals 20% more damage to bleeding enemies. | `{cost:-40}`, `cleaveExtendBleed`, conditional multiplier on Cleave |
| 6 | Cleave and Rend deal +12,600% (×127). | **Transform:** enemies that die while bleeding burst into a cinder pool (radius 80, 2 s) that applies your Rend bleed at 50% strength to enemies inside. Cleave, Rend and Sawtooth Hatchet deal **×1.25**. | ground `cinder` [NEW-BEHAVIOUR], `multiplier:1.25` |

### Hearthbanner (new) — motif *banner* (new)
Footprint: standard warrior. Colours primary 0x8c2f24 (madder red), secondary 0xd8b45a (brass), glow 0x3cff6e (every set
glows 0x3cff6e today [M]). Pieces: Hearthbanner Crest (horned helm), Pennant Spaulders (spiked mantle), Banner-Bearer's
Plate (breastplate), Haft Grips (gauntlets), Muster Legplates, March Sabatons.
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Muster Standard cooldown −30%; Battle Rage also grants +10% attack speed. | `{cooldown:-30}` on Standard, `rageIas` |
| 4 | Inside your Standard you take 25% less damage, and your primary attack generates +3 Fury and deals 25% more damage. | `standardDR`, `standardGen`, conditional multiplier 1.25 on the primary |
| 6 | **Transform:** your Standard follows you (as *Marching Orders* without the radius penalty); every 3rd primary attack inside it releases a war-cry shockwave (radius 140, 100% weapon damage). Primary attacks, shockwaves and Kilnheart's ignites deal **×1.25** while Battle Rage is active (≈95% uptime). | `standardCarry`, `warcryShock` [NEW-BEHAVIOUR], conditional multiplier |

### Furrowmark (new) — motif *furrow* (new)
Footprint **head, shoulders, chest, hands, belt, bracers** (legs and feet stay free for legendaries — the slot puzzle in
`ITEMS-SHARED.md` §4). Colours primary 0x5e4a33 (loam), secondary 0x9aa1a6 (iron), glow 0x3cff6e. Pieces: Furrowmark Helm
(helm), Share-Plate Spaulders (plate spaulders), Ploughman's Hauberk (hauberk), Haft Gauntlets, Harness Belt, Yoke-Ring
Bracers.
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Ironplough's cone +25% wider; it costs 20% less Fury. | `{radius:+25, cost:-20}` |
| 4 | Enemies pushed by Ironplough into a wall or another enemy are stunned 1 s and take 20% more damage from Ironplough while stunned; while channeling you take 30% less damage from the front. | `ploughWallStun` [NEW-BEHAVIOUR], conditional multiplier, `ploughGuard` |
| 6 | **Transform:** Ironplough leaves a 3 s furrow behind you; enemies crossing it are struck for 50% weapon damage and knocked into your path (once per second each); ramp is kept 2 s after the channel stops. Ironplough and furrows deal **×1.25**. | ground `furrow` [NEW-BEHAVIOUR], `multiplier:1.25` |

## 8. Legendaries (6 existing + 28 new = 34)

Template kinds and the Cube rule (extracted powers roll at maximum, one weapon / armor / jewelry power [M]) are defined in
`ITEMS-SHARED.md` §1. Magnitude anchors [M]: skill-signature weapons +150–200% increased damage (Faultcleaver, Bloodwake,
Ninefold Gale); vulnerability powers 25–30% (Anvil Vambraces); cost/cooldown 30–50% (Eternal Gyre 40–50); off-hand
signature 200–250% (Bulwark of the Last Light). New **skillMore** powers (an own-bucket ×, the template that lets a
legendary kit stack multiplicatively like a set) are 25–40% [P], set in `BUDGET.md` §3. FP = in the standard set
footprint (blocked for a set kit except through the Cube).

| Legendary | Base (slot) | Power (`{v}` = rolled) | Range | Template | Cube | Archetype |
|---|---|---|---|---|---|---|
| Faultcleaver [M] | Great Axe (2H) | Seismic Slam deals {v}% increased damage and costs 40% less Fury. | 150–200 | skillDamage + skillMods | weapon | Faultline |
| The Ninefold Gale [M → P] | Great Axe (2H) | Whirlwind always spawns Dust Devils, and **Whirlwind and** Dust Devils deal {v}% increased damage. *Changed* [P]: today the roll applies to Dust Devils only; without a Whirlwind-damage signature the Gyre archetype's kit factor is half the class's (`BUDGET.md` §6). | 150–200 | skillFlag + skillDamage | weapon | Gyre |
| Bloodwake [M] | Sword (1H) | Rend's bleed deals {v}% increased damage. | 150–200 | skillDamage | weapon | Cinderblood, Hatchetwind |
| Girdle of the Eternal Gyre [M] | Belt | Whirlwind costs {v}% less Fury; 20% less damage taken while whirling. | 40–50 | skillMods | armor | Gyre |
| Vambraces of the Anvil [M] | Bracers | Stunned enemies take {v}% increased damage from you. | 25–30 | vulnerability | armor | Faultline, Ploughline, Warcaller |
| Bulwark of the Last Light [M] | Shield | Ground Stomp pulls in distant enemies and deals {v}% increased damage. | 200–250 | skillFlag + skillDamage | armor | Faultline, Warcaller |
| **Millwheel Edge** | Sword (1H) | Cleave hits all around you (360°) and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon | Cinderblood, Gyre |
| **Ashgrip Gauntlets** | Gauntlets (FP) | Cleave deals {v}% more damage to bleeding enemies and extends their bleeds by 0.5 s. | 25–40 | skillMore (cond.) | armor | Cinderblood |
| **Thresher's Knot** | Ring | Each enemy Cleave hits beyond the first reduces Ground Stomp and Cairnfall cooldowns by {v} s. | 0.05–0.1 | cooldown | jewelry | Faultline, Cinderblood |
| **Gale-Stitched Legguards** | Legplates (FP) | Each second spent whirling adds a stack (max 5); each stack makes Whirlwind deal {v}% more damage. | 6–8 | skillMore (stacking) | armor | Gyre |
| **Tanner's Pauldrons** | Spiked Mantle (FP) | Rend +30% radius; enemies bleeding from any of your skills take {v}% increased damage from you. | 15–25 | vulnerability (bleeding) | armor | Gyre, Cinderblood, Hatchetwind |
| **Red Ledger** | Amulet | Rend costs 40% less Fury and each bleeding enemy that dies restores {v} Fury. | 3–5 | resource | jewelry | Cinderblood, Hatchetwind |
| **Quakestep Sabatons** | Sabatons (FP) | Each Dash ends with a free Ground Stomp (no cooldown cost) at {v}% damage. | 60–80 | proc | armor | Faultline, Ploughline |
| **Fissure-Lined Breastplate** | Breastplate (FP) | Seismic Slam continues 30% further through enemies it kills and deals {v}% more damage to stunned enemies. | 30–45 | skillMore (cond.) | armor | Faultline |
| **Tremor Signet** | Ring | Seismic Slam reduces Ground Stomp's cooldown by {v} s per enemy hit (max 2 s per cast). | 0.2–0.3 | cooldown | jewelry | Faultline |
| **Brass Warhorn Helm** | Horned Helm (FP) | Battle Rage also grants {v}% attack speed; its critical hits generate 2 Fury. | 8–12 | buff | armor | Gyre, Warcaller |
| **Furycord Belt** | Belt | While Battle Rage is active, Fury costs are {v}% lower. | 15–20 | resource | armor | Gyre, Cinderblood |
| **Seething Sigil** | Amulet | Battle Rage's damage bonus is {v} points higher while you are above 50 Fury. | 10–15 | buff | jewelry | Warcaller |
| **Bellwright's Maul** | Mace (1H) | Tolling Blow tolls every 2nd blow and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon | Warcaller, Faultline |
| **Belfry Pauldrons** | Plate Spaulders (FP) | Toll shockwaves are {v}% larger and stun already-stunned enemies 1 s longer. | 30–40 | skillMods | armor | Faultline, Warcaller |
| **Grinning Saw** | Axe (1H) | Sawtooth Hatchet returns twice (three passes) and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon | Hatchetwind, Cinderblood |
| **Woodcutter's Grips** | Gauntlets (FP) | Sawtooth Hatchet costs no Fury when it hits 4+ enemies and deals {v}% more damage to bleeding enemies. | 25–35 | skillMore (cond.) | armor | Hatchetwind |
| **Sawyer's Ring** | Ring | Enemies killed by Sawtooth Hatchet's bleed throw a free hatchet at the nearest enemy for {v}% damage. | 60–80 | proc | jewelry | Hatchetwind |
| **Ward Pennant Shield** | Shield | Your Standard is 30% larger, and you and allies inside deal {v}% increased damage. | 10–15 | buff (generic) | armor | Warcaller, Ploughline |
| **Quartermaster's Cuirass** | Breastplate (FP) | You may plant two Standards; while you stand in one, your primary attack deals {v}% more damage. | 25–35 | skillMore (cond.) | armor | Warcaller |
| **Rally Knot** | Ring | Planting your Standard grants {v} Fury and reduces all cooldowns by 2 s. | 20–30 | resource | jewelry | Warcaller |
| **Coulter Blade** | Greatsword (2H) | Ironplough reaches full ramp twice as fast and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon | Ploughline |
| **Yoke Greaves** | Legplates (FP) | Ironplough's cone is 40% wider and pushed enemies take {v}% more damage from Ironplough for 2 s. | 25–35 | skillMore (cond.) | armor | Ploughline |
| **Ox-Harness Belt** | Belt | While channeling Ironplough you take {v}% less damage and cannot be knocked back. | 15–20 | defensive | armor | Ploughline |
| **Cairnwright's Hammer** | Mace (1H) | Cairnfall drops 3 more cairns and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon | Faultline, Hatchetwind |
| **Stonecount Gauntlets** | Gauntlets (FP) | Each enemy stunned by Cairnfall increases your damage by 2% for 8 s (max {v}%). | 20–30 | buff (generic) | armor | Faultline |
| **Kilnmaw** | Maul (2H, new base) | Kilnheart lasts 5 s longer and its ignites deal {v}% increased damage. | 150–200 | skillDamage + skillMods | weapon | Warcaller |
| **Slagforged Helm** | Helm (FP) | Kilnheart's cooldown is {v}% shorter, and it activates by itself when you fall below 35% Life. | 25–35 | skillMods | armor | Warcaller |
| **Coalheart Locket** | Amulet | While Kilnheart is active your Fire damage is increased by {v}%. | 30–40 | element | jewelry | Warcaller, Cinderblood |

**Coverage (≥3 relevant per skill):** Cleave — Millwheel Edge, Ashgrip Gauntlets, Thresher's Knot · Whirlwind — The Ninefold
Gale, Girdle of the Eternal Gyre, Gale-Stitched Legguards · Rend — Bloodwake, Tanner's Pauldrons, Red Ledger · Ground Stomp — Bulwark of the Last
Light, Vambraces of the Anvil, Quakestep Sabatons · Seismic Slam — Faultcleaver, Fissure-Lined Breastplate, Tremor Signet ·
Battle Rage — Brass Warhorn Helm, Furycord Belt, Seething Sigil · Tolling Blow — Bellwright's Maul, Belfry Pauldrons,
Vambraces of the Anvil · Sawtooth Hatchet — Grinning Saw, Woodcutter's Grips, Sawyer's Ring · Muster Standard — Ward Pennant
Shield, Quartermaster's Cuirass, Rally Knot · Ironplough — Coulter Blade, Yoke Greaves, Ox-Harness Belt · Cairnfall —
Cairnwright's Hammer, Stonecount Gauntlets, Vambraces of the Anvil · Kilnheart — Kilnmaw, Slagforged Helm, Coalheart Locket.

Flavour lines (original, tone of the existing ones [M]): Millwheel Edge "It turns whether or not there is grain." ·
Ashgrip Gauntlets "Warm to the touch, always." · Thresher's Knot "Tied by a farmhand who never missed a harvest." ·
Gale-Stitched Legguards "The stitches hum when the wind changes." · Tanner's Pauldrons "Cured in a vat nobody will
describe." · Red Ledger "Every debt is written in the same ink." · Quakestep Sabatons "The ground remembers where they
landed." · Fissure-Lined Breastplate "Cracked on purpose." · Tremor Signet "Hold it to your ear and the hills answer." ·
Brass Warhorn Helm "Blown once at every gate it has seen fall." · Furycord Belt "Knotted tighter with every argument." ·
Seething Sigil "It hisses when you are calm." · Bellwright's Maul "Cast from a bell that rang too often." · Belfry
Pauldrons "Pigeons still nest in the rivets." · Grinning Saw "The teeth were filed into a smile." · Woodcutter's Grips
"Callused into the leather." · Sawyer's Ring "It always comes back." · Ward Pennant Shield "The colours never fade while
someone stands under them." · Quartermaster's Cuirass "Two of everything. Mera insists." · Rally Knot "Pull it and
people come." · Coulter Blade "It cuts the first line; the rest follows." · Yoke Greaves "Made for an ox. Worn by
someone stubborner." · Ox-Harness Belt "Nothing pulls this one back." · Cairnwright's Hammer "Every stone it set still
stands." · Stonecount Gauntlets "One for each that fell." · Kilnmaw "Kessa apologises to it, too." · Slagforged Helm
"Poured, not hammered." · Coalheart Locket "A coal from the first fire on the frontier. Still lit."

## 9. [NEW-BEHAVIOUR] summary for the Warrior

1. Cast functions for the six new skills (`tollingBlow`, `sawtoothHatchet` + returning projectile kind, `musterStandard`
   + ground kind `standard` with a party buff tick, `ironplough` channel with ramp + movement factor, `cairnfall`
   scheduled impacts, `kilnheart` buff with a cost multiplier and on-hit ignite).
2. Player-side: damage-reduction buff field (Watch Bell, Braced Swing, Iron Root, Slag Skin, standard/stunned/front DR),
   control-immunity window (Iron Root), cheat-death hook (Last Rampart, Second Wind), movement factor while channeling.
3. Monster-side: taunt to an entity (Taunting Colours), outgoing-damage debuff (Concussion), stun event hook for passives
   (Bellwether), dot stacking (Open Veins), dot carry-over (Rollover), bleed-tagged vulnerability (Rusted Edge, Tanner's).
4. Grounds: `crack`, `tremor`, `faultline` (stun on cross), `cinder` (applies bleed), `furrow` (strike + knockback).
5. Target-conditional skill bonuses (vs >90% Life, vs stunned, vs bleeding, vs pushed) and conditional own-bucket
   multipliers for set 6-pieces (vs stunned, while Battle Rage) — one generic "conditional multiplier" in the power
   template library covers all of them (`ITEMS-SHARED.md` §1).
6. Devil orbit + pull (Endless Storm 6), knockback-into-enemy/wall detection (Ox Strength, Furrowmark 4), hostile
   projectile deletion in a cone (Breakwater), war-cry shockwave counter (Hearthbanner 6), Dash-end stomp proc (Quakestep).
