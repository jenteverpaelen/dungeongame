# Warrior — content bible (M1: 12 skills, 5 runes, 6 nodes, 14 passives, 5 sets, 34 legendaries)

> **v2 (2026-10-11).** Builds are no longer authored.
> * §2 is an internal test-fixture list.
> * §7 sets and §8 legendaries key off tags (`ITEMS-SHARED.md` §1); named-skill signatures are the minority.
> * Shipping text describes mechanics only (`ITEMS-SHARED.md` §0).
> * Skill and rune names here are working names and ids; shipping display names are in `NAMES.md`.
> * Tags of every skill and the runes that change them: `ITEMS-SHARED.md` §1.2.

Design document for the class agent. Approved plan: `docs/rework/ITEMS-AND-SKILLS-PLAN.md`. Shared conventions, legendary
template kinds, item bases and affixes: `ITEMS-SHARED.md`. Parity and diversity arithmetic: `BUDGET.md`; build tools: `BUILD-TOOLS.md`; names: `NAMES.md`.
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

## 2. Internal test fixtures (never shipped)

These labels exist **only for the parity harness**. No item, set, skill text, tooltip or UI may use them or describe
"a build" (`ITEMS-SHARED.md` §0 rule 1).

v2 replaces the v1 hand-picked kits with a search: for every main skill, `budget-model.mjs` picks the best support skill
and the best kit from the whole item pool, over every set configuration (`BUDGET.md` §4). The six labels stay as named
regression cases so results can be compared across versions. The playstyles the brief asked for are all still covered.

| Label (internal) | Main skill | Support found by the search | Best configuration found (paper) | Playstyle covered |
|---|---|---|---|---|
| Gyre | Whirlwind | Cairnfall | Endless Storm 5 + Journeyman's Ring | melee channel |
| Faultline | Cairnfall | Ironplough | Fault Warden 4 + 2 legendaries | slam / stun |
| Cinderblood | Rend | Ironplough | no set (best hybrid: Cinder Oath 3 + ring) | bleed |
| Warcaller | Tolling Blow | Sawtooth Hatchet | Fault Warden 3 + ring (4-piece bonus) | primary under buffs |
| Ploughline | Ironplough | Sawtooth Hatchet | no set (best hybrid: Endless Storm 3 + ring) | front-cone channel |
| Hatchetwind | Sawtooth Hatchet | Ironplough | no set | ranged bleed, legendary-only |

The other main skills (Cleave, Ground Stomp, Seismic Slam) are in the same search. Their best kits used Hearthbanner
3 + ring, Fault Warden 4 + 2, and no set (best hybrid Furrowmark 3 + ring).

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
| **Scree Line** (42) | Cairns fall in a line toward the densest pack (to range 300) instead of a ring. | `flag:cairnLine` |
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
| N3 Heave | Enemies in the far 30% of the cone are stunned 0.4 / 0.6 / 0.8 s. | `slamTipStun(r)` |
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
L40), Iron Poise (Armor, L50). Passive slots stay at 4 (levels 10/20/30/70 [M]).

New passives are rules, not stats, and v2 keys them to tags instead of skill names. The D3 Barbarian page lists 19
passives from L10 to L68, mostly conditional triggers (`REFERENCES.md` §1).

| Passive (unlock) | Effect (shipping text) | Template / behaviour |
|---|---|---|
| **Bellwether** (14) | Stunning an enemy grants 2 Fury (max 10 per second) and 4% attack speed for 4 s (max 5 stacks). | onEvent(stun) → resource + stacking buff [NEW-BEHAVIOUR] stun event hook |
| **Open Veins** (18) | Your Bleeds no longer refresh: each new application adds a separate instance (max 3 per enemy per skill), each at 70% strength. | [NEW-BEHAVIOUR] dot stacking in `addDot` |
| **Spinning Top** (24) | While channelling, each second adds 4% damage (max 5 stacks) and 3% movement speed; stacks last 1 s after the channel. | channel-time buff |
| **War Drummer** (28) | Your Buff skills last 30% longer; while two Buff skills are active, your Primary skills deal 25% increased damage. | duration mod + conditional skill bonus |
| **Grudge Holder** (36) | The first elite that damages you every 10 s is Marked for 6 s and takes 15% more damage from you. | existing mark fields (`markMs/markPct` [M]) |
| **Deep Earth** (45) | Your Stun skills leave tremor ground for 2 s that slows enemies by 30%; you deal 10% more damage to slowed enemies. | [NEW-BEHAVIOUR] ground kind `tremor` |
| **Second Wind** (55) | Once every 90 s, fatal damage instead leaves you at 40% Life and resets the cooldowns of your Stun skills. | [NEW-BEHAVIOUR] cheat-death hook |
| **Iron Discipline** (64) | Fury no longer decays and maximum Fury +20; Fury generated by Primary skills −15%. | resource rule change |

## 7. Sets: building blocks keyed on tags

Structure decision, the set-reduction ring and the evidence: `ITEMS-SHARED.md` §4 and `REFERENCES.md` §7.
* **Rule [P]:** the 6-piece is a **transform** (damage value ≤ ×1.10) plus an own-bucket multiplier of **×1.25**, or
  **×1.35 while a condition holds**; hard cap ×1.3 effective.
* The 2- and 4-piece carry most of the value. A whole set is at most ×2.5 per skill.
* Values are the ones the diversity model uses (`budget-model.mjs`).
* Today's 6-pieces are ×51 (Endless Storm), ×127 (Cinder Oath) and ×22 (Fault Warden) [M].
* Standard warrior footprint [M]: horned helm, spiked mantle, breastplate, gauntlets, legplates, sabatons.
* Texts below are shipping text: mechanics only.

### Raiment of the Endless Storm — keys off **Channel** — motif *wind*
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Your Channel skills cost 25% less and you move 15% faster while channelling. | `{cost:-25}` on Channel, move factor |
| 4 | While channelling you take 40% less damage, and your Channel hits make enemies Bleed for 30% of the hit over 3 s. | `channelDR`, channel bleed [NEW-BEHAVIOUR] |
| 6 | **Transform:** while you channel, a wind wisp spawns every second and orbits you, pulling enemies inward (wisps deal 25% of your channel's damage). Your Channel skills and wisps deal **×1.25**. | wisps (the Dust Devil summon, now channel-driven) [NEW-BEHAVIOUR], `multiplier:1.25` on Channel |

### Fault Warden — keys off **Stun** — motif *stone*
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Your Stun skills' areas are 25% larger and their cooldowns 15% shorter. | Stun-tag mods |
| 4 | Your Spender hits on Stunned enemies trigger an aftershock for 50% of the hit 1 s later; your Stun skills deal 15% more damage; you take 20% less damage from Stunned enemies. | aftershock [NEW-BEHAVIOUR], `stunnedDR` |
| 6 | **Transform:** stunning an enemy raises a fault line under it for 3 s that re-stuns enemies crossing it (once per 3 s each). All your skills deal **×1.35 to Stunned enemies**. | ground `faultline` [NEW-BEHAVIOUR], conditional multiplier |

### Cinder Oath — keys off **Bleed, Burn, Primary** — motif *ember*
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Your Bleeds also Burn (they deal Fire damage and count as both); your Bleed and Burn skills' areas are 20% larger. | tag grant Bleed→Burn, `{radius:+20}` |
| 4 | Your Primary hits extend Bleeds and Burns on the target by 0.5 s (max 10 s); your Primary skills deal 20% more damage to Bleeding or Burning enemies; your Bleed and Burn skills cost 30% less. | dot extension, conditional multiplier, `{cost:-30}` |
| 6 | **Transform:** enemies that die while Bleeding or Burning burst into a cinder pool (radius 80, 2 s) that applies your strongest damage-over-time at 50%. Your Bleed, Burn and Primary skills deal **×1.25**. | ground `cinder` [NEW-BEHAVIOUR], `multiplier:1.25` |

### Hearthbanner — keys off **Buff, Primary** — motif *banner* (new)
Colours primary 0x8c2f24, secondary 0xd8b45a, glow 0x3cff6e (every set glows 0x3cff6e [M]). Pieces: Hearthbanner Crest,
Pennant Spaulders, Banner-Bearer's Plate, Haft Grips, Muster Legplates, March Sabatons (standard footprint).
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Your Buff skills' cooldowns are 25% shorter, and each active Buff grants 5% attack speed. | Buff-tag mods, buff ias |
| 4 | While a Buff skill is active you take 20% less damage, and your Primary skills generate 3 more Fury and deal 25% more damage. | conditional multiplier |
| 6 | **Transform:** your Ground buffs follow you; every 3rd Primary hit while a Buff is active releases a shockwave (radius 140, 100% weapon damage). Primary skills, shockwaves and Burns deal **×1.25 while a Buff skill is active**. | `groundFollow`, `warcryShock` [NEW-BEHAVIOUR], conditional multiplier |

### Furrowmark — keys off **Displace, Channel** — motif *furrow* (new)
Footprint **head, shoulders, chest, hands, belt, bracers** (legs and feet stay free). Colours primary 0x5e4a33, secondary
0x9aa1a6, glow 0x3cff6e. Pieces: Furrowmark Helm, Share-Plate Spaulders, Ploughman's Hauberk, Haft Gauntlets, Harness
Belt, Yoke-Ring Bracers.
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Your Displace effects move enemies 50% farther; your Channel and Displace skills cost 15% less. | displace distance, `{cost:-15}` |
| 4 | Enemies you Displace into a wall or another enemy are Stunned for 1 s; your Displace skills deal 35% more damage to enemies Displaced in the last 2 s; you take 30% less damage from enemies in front of you while channelling. | collision stun [NEW-BEHAVIOUR], conditional multiplier, directional DR |
| 6 | **Transform:** Displaced enemies leave a 3 s furrow that strikes enemies crossing it for 50% weapon damage and pushes them toward you; ramp-up effects are kept for 2 s after a channel ends. Your Displace skills deal **×1.25**. | ground `furrow` [NEW-BEHAVIOUR], `multiplier:1.25` |

## 8. Legendaries (6 existing + 28 new = 34; 12 named, 22 tag-keyed)

Template kinds, selectors and the Cube rule: `ITEMS-SHARED.md` §1.3.
* **Named** = the chase layer (one signature per skill, mostly weapons).
* **Tag** = keyed on tags or a mechanic. 21 of the 28 new items are tag-keyed (75%).
* Magnitude anchors [M]: named weapon signatures +150–200% (Faultcleaver, Bloodwake, The Ninefold Gale); vulnerability
  25–30% (Vambraces of the Anvil); cost 40–50% (Girdle of the Eternal Gyre); off-hand named 200–250% (Bulwark of the Last
  Light).
* New tag additives are 60–90% and new skillMore 25–40% [P], both checked by the diversity search (`BUDGET.md` §4).
* FP = in the standard set footprint.
* Coverage: every warrior main skill is touched by its named signature plus 4–9 tag-keyed legendaries.

| Legendary | Layer | Base (slot) | Power (shipping text; `{v}` = rolled) | Range | Template | Cube |
|---|---|---|---|---|---|---|
| Faultcleaver [M] | Named | Great Axe (2H) | Seismic Slam deals {v}% increased damage and costs 40% less Fury. | 150–200 | skillDamage + skillMods | weapon |
| The Ninefold Gale [M; changed, approved] | Named | Great Axe (2H) | Whirlwind always spawns Dust Devils, and Whirlwind and Dust Devils deal {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon |
| Bloodwake [M] | Named | Sword (1H) | Rend's bleed deals {v}% increased damage. | 150–200 | skillDamage | weapon |
| Girdle of the Eternal Gyre [M] | Named | Belt | Whirlwind costs {v}% less Fury; 20% less damage taken while whirling. | 40–50 | skillMods | armor |
| Vambraces of the Anvil [M] | Tag (Stun) | Bracers | Stunned enemies take {v}% increased damage from you. | 25–30 | vulnerability | armor |
| Bulwark of the Last Light [M] | Named | Shield | Ground Stomp pulls in distant enemies and deals {v}% increased damage. | 200–250 | skillFlag + skillDamage | armor |
| **Millwheel Edge** | Named | Sword (1H) | Cleave hits all around you (360°) and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon |
| **Bellwright's Maul** | Named | Mace (1H) | Tolling Blow tolls every 2nd blow and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon |
| **Grinning Saw** | Named | Axe (1H) | Sawtooth Hatchet returns twice (three passes) and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon |
| **Quartermaster's Cuirass** | Named | Breastplate (FP) | You may plant two Muster Standards; while you stand in one, your Primary skills deal {v}% more damage. | 20–30 | skillMods + skillMore (cond.) | armor |
| **Coulter Blade** | Named | Greatsword (2H) | Ironplough reaches full ramp twice as fast and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon |
| **Cairnwright's Hammer** | Named | Mace (1H) | Cairnfall drops 3 more cairns and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon |
| **Kilnmaw** | Named | Maul (2H, new base) | Kilnheart lasts 5 s longer, and your Burn effects deal {v}% increased damage. | 150–200 | skillMods + skillDamage (Burn) | weapon |
| **Ashgrip Gauntlets** | Tag (Primary, Bleed) | Gauntlets (FP) | Your Primary skills deal {v}% more damage to Bleeding enemies and extend their Bleeds by 0.5 s. | 25–40 | skillMore (cond.) | armor |
| **Thresher's Knot** | Tag (Primary → Stun) | Ring | Each enemy a Primary skill hits beyond the first reduces your Stun skills' cooldowns by {v} s. | 0.05–0.1 | cooldown | jewelry |
| **Gale-Stitched Legguards** | Tag (Channel) | Legplates (FP) | Each second you channel adds a stack (max 5); each stack makes your Channel skills deal {v}% more damage. | 6–8 | skillMore (stacking) | armor |
| **Tanner's Pauldrons** | Tag (Bleed) | Spiked Mantle (FP) | Bleeding enemies take {v}% more damage from you. | 15–25 | vulnerability (bleeding) | armor |
| **Red Ledger** | Tag (Bleed) | Amulet | Your Bleed skills cost 30% less, and each Bleeding enemy that dies restores {v} Fury. | 3–5 | resource | jewelry |
| **Quakestep Sabatons** | Tag (Movement) | Sabatons (FP) | When a Movement skill ends, a tremor stuns enemies within 120 units for 1 s and deals {v}% weapon damage (once per 3 s). | 60–80 | proc | armor |
| **Fissure-Lined Breastplate** | Tag (Spender, Stun) | Breastplate (FP) | Your Spender skills deal {v}% more damage to Stunned enemies. | 30–45 | skillMore (cond.) | armor |
| **Tremor Signet** | Tag (Displace → Cooldown) | Ring | Each enemy you Displace reduces your Cooldown skills' cooldowns by {v} s (max 1.5 s per cast). | 0.2–0.3 | cooldown | jewelry |
| **Brass Warhorn Helm** | Tag (Buff → Primary, Strike) | Horned Helm (FP) | While a Buff skill is active, your Primary and Strike skills attack {v}% faster. | 8–12 | buff | armor |
| **Furycord Belt** | Tag (Buff → Spender) | Belt | While a Buff skill is active, your Spender skills deal {v}% increased damage. | 60–90 | skillDamage (cond.) | armor |
| **Seething Sigil** | Tag (Buff) | Amulet | While you are above 50 Fury, your Buff skills' damage bonuses are {v} points higher. | 10–15 | buff | jewelry |
| **Belfry Pauldrons** | Tag (Stun) | Plate Spaulders (FP) | Your Stun skills' areas are {v}% larger, and they stun already-stunned enemies 1 s longer. | 30–40 | skillMods | armor |
| **Woodcutter's Grips** | Tag (Bleed) | Gauntlets (FP) | Your Bleed skills deal {v}% more damage to enemies already Bleeding, and cost no Fury when they hit 4+ enemies. | 25–35 | skillMore (cond.) | armor |
| **Sawyer's Ring** | Tag (Bleed) | Ring | Enemies killed by your Bleeds fling a shard at the nearest enemy for {v}% weapon damage that applies a Bleed. | 60–80 | proc | jewelry |
| **Ward Pennant Shield** | Tag (Ground) | Shield | Your Ground effects are 30% larger, and you and allies inside them deal {v}% increased damage. | 15–20 | buff (generic) | armor |
| **Rally Knot** | Tag (Buff) | Ring | Casting a Buff skill grants {v} Fury and reduces your other cooldowns by 2 s. | 20–30 | resource | jewelry |
| **Yoke Greaves** | Tag (Displace) | Legplates (FP) | Enemies you Displace take {v}% more damage from you for 2 s. | 25–35 | vulnerability (displaced) | armor |
| **Ox-Harness Belt** | Tag (Channel) | Belt | While channelling you take {v}% less damage. | 15–20 | defensive | armor |
| **Stonecount Gauntlets** | Tag (Stun) | Gauntlets (FP) | Each enemy you Stun increases your damage by 1% for 8 s (max {v}%). | 15–25 | buff (generic) | armor |
| **Slagforged Helm** | Tag (Buff) | Helm (FP) | Your Buff skills' cooldowns are {v}% shorter; when you fall below 35% Life, your Buff skill with the longest cooldown activates. | 20–30 | skillMods + proc | armor |
| **Coalheart Locket** | Tag (Buff → Burn) | Amulet | While a Buff skill is active, your Burn effects deal {v}% more damage. | 30–40 | skillMore (cond.) | jewelry |

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

1. **Six new skills:** `tollingBlow`; `sawtoothHatchet` + a returning projectile kind; `musterStandard` + ground kind
   `standard` with a party buff tick; `ironplough` channel with ramp + movement factor; `cairnfall` scheduled impacts;
   `kilnheart` buff with a cost multiplier and on-hit ignite.
2. **Tags (shared with all classes):** a `tags` field on skills and runes, tag resolution per character (current rune
   included), the tag line in tooltips, and selectors in every power template (`ITEMS-SHARED.md` §1). One generic
   conditional multiplier (target state / player state).
3. **Player side:**
   * a damage-reduction buff field (Watch Bell, Braced Swing, Iron Root, Slag Skin, standard/stunned/front/channel DR);
   * a control-immunity window (Iron Root);
   * cheat death (Last Rampart, Second Wind);
   * a movement factor while channelling;
   * a Movement-end hook (Quakestep Sabatons).
4. **Monster side:**
   * taunt to an entity (Taunting Colours);
   * an outgoing-damage debuff (Concussion);
   * a stun event hook (Bellwether, Stonecount);
   * dot stacking (Open Veins) and dot carry-over (Rollover);
   * Bleed-and-Burn dual tagging (Cinder Oath 2);
   * dot extension on Primary hits (Cinder Oath 4).
5. **Grounds:** `crack`, `tremor`, `faultline` (stun on cross), `cinder` (applies the strongest dot), `furrow` (strike +
   push), and Ground buffs that follow the player (Hearthbanner 6).
6. **Set transforms:**
   * channel-driven orbiting wind wisps (Endless Storm 6);
   * collision stun when Displaced into walls or enemies (Furrowmark 4);
   * war-cry shockwave counter (Hearthbanner 6);
   * aftershock on Spender hits vs stunned (Fault Warden 4).
7. **Procs:** a Bleed kill shard (Sawyer's Ring); the low-Life Buff trigger (Slagforged Helm).
