# Mage — content bible (M1: 12 skills, 5 runes, 6 nodes, 14 passives, 5 sets, 34 legendaries)

Design document for the class agent. Approved plan: `docs/rework/ITEMS-AND-SKILLS-PLAN.md`. Shared conventions, templates,
bases and affixes: `ITEMS-SHARED.md`. Parity arithmetic: `BUDGET.md`. Reference patterns: `REFERENCES.md`.

**Labels and notation** as in `WARRIOR.md` (top): **[M]** measured in this repo, **[P]** proposal, **[NEW-BEHAVIOUR]**
needs new server code, `{field:±n}` = `SkillMods`, `flag:x` = behaviour flag, `x(r)` = flag with the node rank. Rune
unlocks: skill unlock + [2, 5, 9, 14, 20], clamped to 70 [P]. Nodes: N1–N3 open, N4/N5/N6 need 2 ranks in N1/N2/N3, max
10 ranks per skill, one *(plain)* number node at most [P].

## 1. Identity and categories

The mage is the frontier's reader of signals and keeper of fires: the Hollowstar Array's hum, Kessa's kiln embers, the
Lockglass Cistern's cold, and the stars falling over the Kilnwatch (tone of `docs/rework/CAST.md`). Arcane Power max 100,
regenerates 10/s [M]; Magic Missile generates nothing [M]. Weapons: staff (2H, clears the off-hand) and wand (1H) + orb [M].

| Category | Skills (unlock) |
|---|---|
| Bolts (primary) | Magic Missile (1), **Rime Needles (16)** |
| Celestial | Meteor (2), **Orrery (50)** |
| Void and Storm | Black Hole (4), **Thrumming Ray (20)**, **Stormglass Orb (40)** |
| Frost | Frost Nova (6), **Rimefield (32)** |
| Conjuring | Hydra (9), Magic Weapon (12), **Cinderkin (26)** |

## 2. Build archetypes

Requested playstyles: meteor, missiles, summons, frost control, arcane beam (new — no channel existed for the mage) —
one archetype each, plus a legendary-native Orrery build with no set.

| # | Archetype | Playstyle | Core skills (primary in italics) | Set | Relevant legendaries | Passives |
|---|---|---|---|---|---|---|
| M-A | **Starfall** | meteor | Meteor, Black Hole, Frost Nova, Magic Weapon, *Magic Missile* | Fallen Star | Cindervane (staff), Starfall Mantle (shoulders), Craterheart Amulet, Horizon Cowl (head), Undertow Staff (Cube) | Falling Measure, Astral Debt, Ley Anchor, Starborn |
| M-B | **Glass Concord** | missiles | Black Hole, Stormglass Orb, Magic Weapon, Frost Nova, *Magic Missile* | Glass Concord | Spindle of a Thousand Missiles (wand), Glasswright's Wraps (hands), Echoing Bead (ring), Heart of the Void (orb), Horizon Cowl (head) | Missile Choir, Ley Anchor, Deep Current, Return Pattern |
| M-C | **Lantern Garden** | summons | Hydra, Cinderkin, Magic Weapon, Frost Nova, *Magic Missile* | Lantern Garden | Lanternroot (staff), Kindling Rod (wand, Cube), Coiled Pauldrons (shoulders), Firekeeper's Gloves (hands), Lanternkeeper's Sash (belt) | Coiled Flame, Conjurer's Hearth, Unbroken Ward, Return Pattern |
| M-D | **Hoarfrost** | frost control | Frost Nova, Rimefield, Black Hole (Absolute Zero), Magic Weapon, *Rime Needles* | Hoarfrost Vigil (new) | Hoarneedle Wand, Winterbound Robe (chest), Frostthread Gloves (hands), Rimewalker Slippers (feet), Snowglobe Pendant | Chill Margin, Unbroken Ward, Ley Anchor, Return Pattern |
| M-E | **Hollowstar** | arcane beam | Thrumming Ray, Stormglass Orb, Magic Weapon, Black Hole, *Magic Missile* | Hollowstar Choir (new) | Resonant Staff, Hornlistener Circlet (head), Conductor's Legwraps (legs), Signal Coil (ring), Stormglass Prism (orb, Cube) | Resonance, Deep Current, Ley Anchor, Prism Mantle |
| M-F | **Orrery** | celestial ultimate + missiles, legendary-native | Orrery, Meteor, Magic Weapon, Black Hole, *Magic Missile* | none (Patchwork Signet) | Armillary Staff, Star-Chart Robe (chest), Clockmaker's Ring, Spindle of a Thousand Missiles (Cube), Horizon Cowl (head) | Starborn, Missile Choir, Ley Anchor |

* **Starfall.** Black Hole gathers, Meteor lands on the knot, Frost Nova holds stragglers. Set kit: Fallen Star's
  second meteor, star-signs (now +5% each, generic bucket) and every 4th meteor a falling-star line. Legendary kit: Starfall Mantle,
  Horizon Cowl (two Black Holes) and the Craterheart Amulet in the free slots.
* **Glass Concord.** Magic Missile as the engine (Split, Seeker), Black Hole to group, Stormglass Orb as the AoE
  spender. Set kit: missiles split inside Black Holes and shatter on kills. Legendary kit: Glasswright's Wraps (*more*
  after a pierce), Echoing Bead (double casts).
* **Lantern Garden.** Hydras and Cinderkin do the work; Magic Weapon buffs them (summon strikes already read the owner's
  generic damage [M]). Set kit: Hydra volleys spawn Cinderkin. Legendary kit: Coiled Pauldrons and Firekeeper's Gloves.
* **Hoarfrost.** Rime Needles chill and build to a freeze; Rimefield and Frost Nova freeze packs; everything frozen takes
  more. Set kit: three seconds of chill becomes a freeze, frozen kills burst into needles. Legendary kit: Winterbound Robe,
  Frostthread Gloves, Rimewalker Slippers.
* **Hollowstar.** Channel Thrumming Ray through packs; it ramps to 2.5×; Stormglass Orb thrown into the beam's path.
  Set kit: the beam refracts through your orb into three. Hollowstar Choir covers belt and bracers instead of legs and
  feet (slot puzzle, `ITEMS-SHARED.md` §4), so Conductor's Legwraps stays available to a set wearer.
* **Orrery.** Five spheres orbit you and fire your Magic Missile; Meteor and Black Hole between windows. No set exists
  for it on purpose; Patchwork Signet is its "set".

## 3. New skills (6)

Band today [M]: primary 2.3 (Magic Missile); spender 7.4 + 2.35 molten / 40 AP (Meteor); cooldowns 5.4 over 2 s at 12 s
for 20 AP (Black Hole) and 1.75 + 2 s freeze at 11 s (Frost Nova); summon 2.8/s at 15 AP, 9 s, max 1 (Hydra); buff 25 AP.

### M7 Rime Needles — `rime_needles` (Bolts, primary, L16)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| primary | cold | 0.9 per needle × 3 | 0 | 0 | 0 | 340 | 0 | 0.75 (freeze) | 0 | `always` |

* *Anchor:* Magic Missile 2.3 [M]. Three needles total 2.7 if all hit (about 70% land at range, ≈1.9 on one target,
  more on packs) and give the frost build its chill/freeze engine [P]. Range 340 < 380 to pay for the control.
* **Behaviour.** Three needles in a 12° fan; each chills 30% for 1.5 s; a target hit by 6 needles within 2 s is frozen for
  `duration` s (per-target build-up counter). [NEW-BEHAVIOUR] freeze build-up counter on monsters (`freezeMob` exists [M]).
* **Desc:** "Fire three needles of rime for {coef} weapon damage each as Cold, chilling enemies. Six needles in two seconds
  freeze an enemy for {duration} seconds."
* **VFX / icon / sound.** Three thin pale-blue needles with frost glitter; frost crust builds on targets. Icon `needle`,
  0x9fdcff. Sound: three quick glassy "tsk"; a crystalline ping on freeze.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Icicle Fan** (18) | Five needles in a 30° fan, each 25% less damage. | `{projectiles:+2, dmg:-25}` |
| **Shiver Splinter** (21) | Needles hitting a frozen enemy shatter into 2 splinters (50%) that seek nearby enemies. | `flag:needleSplinter` |
| **Arcane Thorns** (25) | Arcane; needles pierce one enemy; no chill. | `{element:'arcane'}`, `flag:needlePierce` |
| **Deep Chill** (30) | Chill 60%; four needles freeze. | `flag:needleDeepChill` |
| **Glacier Spine** (36) | One large needle: twice the damage of a needle trio, pierces all, pushes 20 units. | `{projectiles:-2, dmg:+100}`, `flag:needleSpine` |

### M8 Thrumming Ray — `thrumming_ray` (Void and Storm, channel, L20)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| channel | arcane | 2.0/s ramping to 5.0/s | 12 per s | 0 | 0 | 380 | 30 (beam half-width) | 0 | 0 | `channel {startAt:30, within:380}` |

* *Anchor:* Whirlwind 3.4/s for 10 Fury/s [M] is the only channel; the ray starts at 2.0/s (a line, at range) and ramps
  over 2 s to 2.5× (5.0/s) [P]; 12 AP/s against 10/s regeneration [M] drains slowly, so AP gear matters.
* **Behaviour.** Channel; every 250 ms tick strikes all enemies on a line of length `range` toward the target (pierce
  all); resonance (ramp) builds while the beam stays on; the mage moves at 40% speed. [NEW-BEHAVIOUR] second channel
  type with ramp (shares the Ironplough ramp code) and a line hit test (`distToSegment` exists [M]).
* **Desc:** "Channel a thrumming ray that pierces every enemy in a line, dealing {coef} weapon damage per second as
  Arcane, rising to two and a half times as the note steadies. Costs {cost} Arcane Power per second."
* **VFX / icon / sound.** Violet beam with standing-wave ripples that tighten as resonance builds; a flare at the end.
  Icon `ray`, 0xa07cff. Sound: a low hum climbing to a resonant chord (stacked sines) as resonance builds.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Frostline** (22) | Cold; the beam chills 40% and freezes enemies held in it for 2 s straight. | `{element:'cold'}`, `flag:rayFreeze` |
| **Forked Signal** (25) | Two beams 20° apart at 60% damage each. | `flag:rayFork` |
| **Searing Thread** (29) | Fire; enemies burn for 30% of the beam's damage over 2 s; resonance builds 30% slower. | `{element:'fire'}`, `flag:rayBurn` |
| **Steady Note** (34) | Move at 70% speed while channeling; resonance tops out at 2× instead of 2.5×. | `flag:rayMobile` |
| **Feedback Loop** (40) | At full resonance the beam restores 4 AP per second. | `flag:rayRefund` |

### M9 Cinderkin — `cinderkin` (Conjuring, summon, L26)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| summon | fire | 1.0 per second each; explosion 2.0 | 20 | 0 | 0 | 380 | 80 (explosion) | 15 | 3 | `maintainSummon` |

* *Anchor:* Hydra 2.8/s at 15 AP, 9 s, max 1 [M]. Three kin at 1.0/s = 3.0/s plus an explosion each per 15 s (≈0.4/s)
  for 20 AP, but they must walk into melee [P].
* **Behaviour.** Summons up to 3 small fire spirits that run to enemies and claw them (companion movement pattern [M]);
  when their time ends or they die they explode for 2.0 within 80. [NEW-BEHAVIOUR] summon type `cinderkin` (companion
  AI + expiry explosion).
* **Desc:** "Coax up to {max} cinderkin out of the coals. Each claws enemies for {coef} weapon damage per second as Fire for
  {duration} seconds, then bursts for 200% weapon damage."
* **VFX / icon / sound.** Small round ember sprites with coal-chunk bodies and flickering eyes, sparks behind them; a pop
  of embers on bursting. Icon `ember_kin`, 0xff8a3d. Sound: crackling hiss, tiny "pip" voices, a pop.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Bonfire Kin** (28) | One large kin that lives 30 s, deals 3× damage and bursts over 160 units. | `flag:kinBig` |
| **Frostkin** (31) | Cold; kin chill on hit and their bursts freeze for 1 s. | `{element:'cold'}`, `flag:kinFrost` |
| **Lanternkin** (35) | Kin stay at your side and each throws a firebolt (0.8 per second, range 300). | `flag:kinRanged` |
| **Eager Kin** (40) | Kin burst on their first hit for 200% more and are re-summoned at once for 8 AP each. | `flag:kinKamikaze` |
| **Hearth Kin** (46) | Each living kin gives you 3% damage reduction and 0.5% Life per second. | `flag:kinHearth` |

### M10 Rimefield — `rimefield` (Frost, cooldown ground, L32)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| cooldown | cold | 4.0 over 6 s | 25 | 0 | 15 | 380 | 200 | 6 | 0 | `enemiesNear {count:4, within:380}` |

* *Anchor:* Black Hole 5.4 over 2 s at 12 s for 20 AP and Frost Nova 1.75 + 2 s freeze at 11 s [M]. Rimefield trades
  burst for a long zone: 4.0 over 6 s at 15 s for 25 AP, plus a freeze after 1.5 s inside [P].
* **Behaviour.** A ground at the best point (`bestPoint` [M]); ticks every 0.5 s for `coef`/12; enemies inside are
  chilled 50%; an enemy inside for 1.5 s straight freezes for 1.5 s (once per enemy per field). [NEW-BEHAVIOUR] ground
  kind `rime` with per-enemy exposure timers.
* **Desc:** "Spread a field of rime for {duration} seconds that deals {coef} weapon damage as Cold over its duration,
  chills enemies inside, and freezes those that stay for 1.5 seconds."
* **VFX / icon / sound.** Frost crawling outward over the ground, crystals growing at the rim, frozen enemies crusted
  white. Icon `rime`, 0xbfe9ff. Sound: crackling ice spreading, a faint wind chime.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Brittle Ground** (34) | Enemies in the field take 15% more damage from all your sources. | `flag:rimeVuln` (the Black Hole `holePct` field is the pattern [M]) |
| **Frost Bloom** (37) | The field shrinks over its duration to radius 60, dragging frozen enemies inward, and deals 50% more at the end. | `flag:rimeContract` |
| **Static Frost** (41) | Lightning; instead of freezing, the field zaps 2 enemies every 0.5 s for 100% each. | `{element:'lightning'}`, `flag:rimeStatic` |
| **Wandering Rime** (46) | The field follows you; radius −30%. | `{radius:-30}`, `flag:rimeFollow` |
| **Permafrost Seal** (52) | Its freeze lasts 3 s, but an enemy can be frozen by it only once per 10 s. | `flag:rimeLongFreeze` |

### M11 Stormglass Orb — `stormglass_orb` (Void and Storm, spender, L40)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| spender | lightning | 0.5 per zap; detonation 3.0 | 35 | 0 | 0 | 440 | 160 (zap reach); 120 (detonation) | 2 | 0 | `enemiesNear {count:2, within:380}` |

* *Anchor:* Meteor 7.4 + 2.35 / 40 AP [M]. An enemy along the orb's path takes ~4–6 zaps (2.0–3.0) plus the 3.0
  detonation ≈ 5–6 for 35 AP [P].
* **Behaviour.** A slow projectile (220 units/s, 2 s) toward the best line; every 0.25 s it zaps up to 3 enemies within
  `radius` for `coef`; at the end it detonates for 3.0 within 120. [NEW-BEHAVIOUR] projectile with a periodic area tick
  (new `ProjKind 'stormglass'`).
* **Desc:** "Launch a slow orb of stormglass that zaps up to 3 nearby enemies every quarter second for {coef} weapon
  damage as Lightning, then shatters for 300% weapon damage."
* **VFX / icon / sound.** A crackling glass sphere with lightning trapped inside, arcs to targets, a shatter of glass
  shards at the end. Icon `stormglass`, 0x7fd3ff. Sound: buzzing hum, sharp zaps, a glass shatter.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Slow Thunder** (42) | The orb moves 50% slower and zaps 50% more often. | `flag:orbSlow` |
| **Pinball** (45) | The orb bounces off walls twice and lives 1 s longer. | `flag:orbBounce` [NEW-BEHAVIOUR] wall bounce |
| **Hailglass** (49) | Cold; zaps chill and the detonation freezes for 1 s. | `{element:'cold'}`, `flag:orbFreeze` |
| **Conductor** (54) | Lightning arcs between your orbs and your Thrumming Ray, dealing 200% weapon damage per second along each arc. | `flag:orbConduct` (beam event + `distToSegment` [M]) |
| **Prism Burst** (60) | The detonation fires 6 of your Magic Missiles (with their rune) at 60% damage. | `flag:orbMissiles` |

### M12 Orrery — `orrery` (Celestial, cooldown ultimate, L50)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| cooldown | arcane | 0.8 per sphere pass; missiles at 50% | 0 | 0 | 60 | 380 | 130 (orbit) | 15 | 0 | `enemiesNear {count:6, within:380}` |

* *Anchor:* Rain of Vengeance 15 over 5 s at 30 s [M]; the Orrery's spheres alone are ≈20–30 over 15 s on a pack plus
  Magic Missile copies, at a 60 s cooldown [P].
* **Behaviour.** Five spheres orbit the mage at radius 130 for `duration` s; each sphere strikes enemies it passes for
  `coef` (re-hit per enemy every 0.5 s); every 1.5 s each sphere fires your Magic Missile (with rune and nodes) at a
  nearby enemy at 50% damage. [NEW-BEHAVIOUR] orbiting player-bound hit volumes + borrowed primary casts.
* **Desc:** "Set five spheres turning around you for {duration} seconds. Each strikes enemies it passes for {coef}
  weapon damage and fires your Magic Missile every 1.5 seconds."
* **VFX / icon / sound.** Brass-and-light planets on thin rings orbiting the mage, star dust trails. Icon `orrery`,
  0xd8b46a. Sound: slow mechanical ticking under a choir pad; a soft chime per missile.

| Rune (unlock) | Effect | Mods |
|---|---|---|
| **Comet Ring** (52) | When it ends, the spheres fall as 5 meteors (each 50% of your Meteor's impact) on nearby enemies. | `flag:orreryMeteors` |
| **Wide Orbit** (55) | Orbit radius +60%, spheres 20% slower. | `flag:orreryWide` |
| **Frozen Moons** (59) | Cold; spheres chill and their missiles become Rime Needles. | `{element:'cold'}`, `flag:orreryFrost` |
| **Gravity Orrery** (64) | Spheres pull enemies 10 units toward you per pass. | `flag:orreryPull` |
| **Sun at Centre** (70) | A central sun burns enemies within 80 units of you for 150% weapon damage per second. | `flag:orrerySun` |

## 4. Two new runes for each existing skill

Unlocks [P]: Magic Missile 15/21, Meteor 16/22, Black Hole 18/24, Frost Nova 20/26, Hydra 23/29, Magic Weapon 26/32.

| Skill | Rune (unlock) | Effect | Mods |
|---|---|---|---|
| Magic Missile | **Volley of Glass** (15) | Missiles shatter on impact into 3 shards that fly on behind the target (40% each). | `flag:missileShatter` |
| Magic Missile | **Static Thread** (21) | Lightning; missiles chain to 1 more enemy within 150 for 70%. | `{element:'lightning'}`, `flag:missileChain` |
| Meteor | **Ember Tail** (16) | The meteor streaks in low and leaves a line of molten ground behind its path. | `flag:meteorTrail` |
| Meteor | **Lodestone** (22) | Before impact, enemies within 1.5× the radius are pulled to the centre. | `flag:meteorPull` (reuse `dragMob` [M]) |
| Black Hole | **Wandering Void** (18) | Drifts toward the densest enemies at 80 units/s and lasts 50% longer. | `{duration:+50}`, `flag:holeDrift` |
| Black Hole | **Collapse Bloom** (24) | On collapse, releases a ring of 8 arcane bolts (80% each). | `flag:holeBolts` |
| Frost Nova | **Mirror Frost** (20) | A second nova goes off at your position 1.5 s later with half the freeze. | `flag:novaEcho` |
| Frost Nova | **Cold Front** (26) | Becomes a 120° wave (range 300) toward the densest pack. | `flag:novaCone` |
| Hydra | **Serpent Coil** (23) | The Hydra follows you at 80 units and attacks 15% slower. | `flag:hydraFollow` |
| Hydra | **Forked Tongues** (29) | Lightning; each head's shot chains to 2 more enemies at 60%. | `{element:'lightning'}`, `flag:hydraChain` |
| Magic Weapon | **Chilling Edge** (26) | Primary hits have a 15% chance to freeze for 0.5 s. | `flag:weaponFrost` |
| Magic Weapon | **Arcane Ward** (32) | Also grants 15% damage reduction, but the damage bonus is halved. | `flag:weaponWard` |

## 5. Specialization nodes

**Magic Missile**
| Node | Effect | Mods |
|---|---|---|
| N1 Sharper Will *(plain)* | +10 / 20 / 30% damage. | `{dmg}` |
| N2 Echo Cast | 10 / 20 / 30% chance to fire a free second missile at another target. | `missileEcho(r)` |
| N3 Tracking Glyph | Missiles home slightly (turn 2 / 3 / 4) even without *Seeker*. | `missileTurn(r)` |
| N4 Piercing Will | Missiles pierce one enemy at 30 / 50 / 70% after the first hit. | `missilePierce(r)` |
| N5 Overflow | While your Arcane Power is full, missiles deal +15 / 30 / 45%. | `missileFull(r)` |
| N6 Void Bolt | Missiles hitting an enemy inside a Black Hole burst (radius 60) for 30 / 50 / 70%. | `missileHoleBurst(r)` |

**Meteor**
| Node | Effect | Mods |
|---|---|---|
| N1 Wide Crater *(plain)* | Radius +8 / 16 / 24%. | `{radius}` |
| N2 Afterburn | Enemies leaving molten ground keep burning for 1 / 2 / 3 s. | `meteorAfterburn(r)` |
| N3 Starseeker | Targets the highest-Life elite in range (instead of the densest point) and deals +10 / 20 / 30% to it. | `meteorElite(r)` |
| N4 Shockwave | Impact pushes enemies 20 / 40 / 60 units outward. | `meteorKnock(r)` |
| N5 Arcane Fuel | Refunds 5 / 10 / 15 AP when it hits 4+ enemies. | `meteorRefund(r)` |
| N6 Fragmenting Star | Impact throws 2 / 3 / 4 burning fragments to nearby enemies (50% each, radius 40). | `meteorFragments(r)` |

**Black Hole**
| Node | Effect | Mods |
|---|---|---|
| N1 Event Rim *(plain)* | Radius +8 / 16 / 24%. | `{radius}` |
| N2 Siphoning Void | +1 / 2 / 3 AP per enemy caught (max 15). | `holeGen(r)` |
| N3 Crushing Core | Enemies in the inner 40% take +15 / 30 / 45% Black Hole damage. | `holeCore(r)` |
| N4 Lingering Pull | After collapse, enemies stay slowed 20 / 35 / 50% for 2 s. | `holeSlow(r)` |
| N5 Quick Collapse | Lasts 30% shorter with the same total damage; cooldown −1 / 2 / 3 s. | `holeQuick(r)` |
| N6 Twin Singularity | 15 / 30 / 45% chance to open a second, half-size Black Hole on another pack. | `holeTwin(r)` |

**Frost Nova**
| Node | Effect | Mods |
|---|---|---|
| N1 Wider Ring *(plain)* | Radius +8 / 16 / 24%. | `{radius}` |
| N2 Brittle | +5 / 10 / 15% critical hit chance against frozen enemies. | `novaBrittle(r)` [NEW-BEHAVIOUR] target-conditional crit |
| N3 Retort of Frost | When an enemy hits you in melee, Frost Nova goes off for free (once per 20 / 15 / 10 s). | `novaReflex(r)` |
| N4 Chill Aura | After the freeze ends, enemies stay chilled 30% for 2 / 3 / 4 s. | `novaChillAfter(r)` |
| N5 Cold Return | Each enemy frozen reduces its cooldown by 0.2 / 0.4 / 0.6 s (max 3 s). | `novaRefund(r)` |
| N6 Glacial Burst | +40 / 80 / 120% damage to enemies that were already chilled. | `novaChilledBonus(r)` |

**Hydra**
| Node | Effect | Mods |
|---|---|---|
| N1 More Heads *(plain)* | +10 / 20 / 30% damage. | `{dmg}` |
| N2 Brood Hunger | Each Hydra kill restores 1 / 2 / 3 AP. | `hydraGen(r)` |
| N3 Split Heads | Each head picks a different target when possible; +5 / 10 / 15% damage. | `hydraSplit(r)` |
| N4 Heat Shimmer | Enemies hit by 3 Hydra shots within 1 s burn for 30 / 60 / 90% over 2 s. | `hydraIgnite(r)` |
| N5 Last Breath | An expiring Hydra exhales a fire cone for 200 / 300 / 400%. | `hydraFinale(r)` |
| N6 Guardian Coil | Hydras within 100 units of you give you 5 / 10 / 15% damage reduction. | `hydraGuard(r)` |

**Magic Weapon**
| Node | Effect | Mods |
|---|---|---|
| N1 Long Inscription *(plain)* | Duration +10 / 20 / 30 s. | `{duration}` |
| N2 Spellblade | Primary attack +10 / 20 / 30% damage while active. | `weaponPrimary(r)` |
| N3 Arcane Recharge | Casting it restores 10 / 20 / 30 AP. | `weaponRefill(r)` |
| N4 Splash Glyph | 10 / 20 / 30% chance on hit to deal 50% of the hit to enemies within 60. | `weaponSplash(r)` |
| N5 Rune Echo | Its rune effect (Ignite, Electrify, Chilling Edge) triggers 25 / 50 / 75% more often. | `weaponProc(r)` |
| N6 Bound Glyph | Its rune effect (Ignite, Electrify, Chilling Edge) also triggers from your summons' hits at 30 / 50 / 70% of the normal rate. | `weaponSummonProc(r)` |

**Rime Needles**
| Node | Effect | Mods |
|---|---|---|
| N1 Sharper Ice *(plain)* | +10 / 20 / 30% damage. | `{dmg}` |
| N2 Converging Fan | The three needles converge on the target at 200 / 160 / 120 units, so all three land on one enemy from that distance. | `needleConverge(r)` |
| N3 Cold Capacitor | Freezing an enemy restores 3 / 6 / 9 AP. | `needleGen(r)` |
| N4 Splitting Ice | Needles that kill split into 2 needles at 50 / 75 / 100%. | `needleSplitKill(r)` |
| N5 Snowblind | Chilled enemies deal 5 / 10 / 15% less damage. | `needleWeaken(r)` (debuff field shared with Concussion) |
| N6 Deep Winter | The freeze needs 1 / 2 / 3 fewer needles. | `needleThreshold(r)` |

**Thrumming Ray**
| Node | Effect | Mods |
|---|---|---|
| N1 Brighter Beam *(plain)* | +10 / 20 / 30% damage. | `{dmg}` |
| N2 Strike the Note | If the beam starts on an enemy you damaged in the last 2 s, it starts at 20 / 35 / 50% resonance. | `rayHeadStart(r)` |
| N3 Harmonic | Each second at full resonance a pulse runs along the beam (radius 50) for 60 / 90 / 120%. | `rayPulse(r)` |
| N4 Sustained Note | After you stop, resonance is kept for 1 / 1.5 / 2 s. | `rayKeep(r)` |
| N5 Low Hum | Costs 1 / 2 / 3 less AP per second per enemy pierced (minimum 4). | `rayThrift(r)` |
| N6 Overtone | Enemies held in the beam for 2 s take +10 / 20 / 30% from your other skills for 3 s. | `rayExpose(r)` [NEW-BEHAVIOUR] skill-excluding vulnerability |

**Cinderkin**
| Node | Effect | Mods |
|---|---|---|
| N1 Brighter Embers *(plain)* | +10 / 20 / 30% damage. | `{dmg}` |
| N2 Self-Kindling | When a kin bursts, 20 / 35 / 50% chance a replacement appears for free. | `kinRekindle(r)` |
| N3 Sparkstep | Kin leave burning sparks where they run (20 / 35 / 50% per second). | `kinTrail(r)` (ground `trail` [M]) |
| N4 Kin Pile | Kin bursting within 80 of each other chain-burst for +20 / 40 / 60%. | `kinChain(r)` |
| N5 Kin Tithe | A burst hitting 3+ enemies restores 3 / 6 / 9 AP. | `kinGen(r)` |
| N6 Hearth Bond | On arrival kin draw enemies within 120 to attack them for 1 / 2 / 3 s. | `kinTaunt(r)` (shares the taunt behaviour of Taunting Colours) |

**Rimefield**
| Node | Effect | Mods |
|---|---|---|
| N1 Wide Frost *(plain)* | Radius +8 / 16 / 24%. | `{radius}` |
| N2 Frozen Power | Each enemy it freezes restores 2 / 4 / 6 AP. | `rimeGen(r)` |
| N3 Cold Snap Edge | Enemies at the rim are slowed a further 20 / 35 / 50%. | `rimeEdge(r)` |
| N4 Shard Burst | When it ends, the field bursts for 100 / 150 / 200%. | `rimeFinale(r)` |
| N5 Ice Mirror | Casting Frost Nova inside your field adds 2 / 3 / 4 s to it. | `rimeRefresh(r)` |
| N6 Absolute Field | Frozen enemies inside take +10 / 20 / 30% from Rimefield and Rime Needles. | `rimeFrozenBonus(r)` |

**Stormglass Orb**
| Node | Effect | Mods |
|---|---|---|
| N1 Heavier Glass *(plain)* | +10 / 20 / 30% damage. | `{dmg}` |
| N2 Forking Zap | Every 4th / 3rd / 2nd zap forks to one more enemy up to 300 units away, outside the orb's reach. | `orbFork(r)` |
| N3 Static Charge | Each zap on an elite restores 0.5 / 1 / 1.5 AP. | `orbGen(r)` |
| N4 Magnetised | The orb curves toward the nearest elite (turn 1 / 2 / 3). | `orbSeek(r)` |
| N5 Charge Release | Detonation radius +10% per enemy zapped (max +30 / 60 / 90%). | `orbGrow(r)` |
| N6 Shattered Charge | The detonation leaves 3 / 4 / 5 glass shards that zap enemies stepping on them (100%). | `orbShards(r)` |

**Orrery**
| Node | Effect | Mods |
|---|---|---|
| N1 Brass Spheres *(plain)* | +10 / 20 / 30% damage. | `{dmg}` |
| N2 Tidal Lock | Spheres slow enemies they pass by 10 / 20 / 30% for 1 s. | `orreryChill(r)` |
| N3 Planetary Gift | Each sphere missile restores 0.5 / 1 / 1.5 AP. | `orreryGen(r)` |
| N4 Eclipse | Every 5 s the spheres align and fire a beam outward for 200 / 300 / 400%. | `orreryEclipse(r)` |
| N5 Clockwinding | Each spell cast during it adds 0.2 / 0.35 / 0.5 s (max +10 s). | `orreryExtend(r)` |
| N6 Gravity Assist | Spheres passing through a Black Hole or molten ground gain +25 / 50 / 75% for 3 s. | `orrerySynergy(r)` |

## 6. Passives (6 existing kept + 8 new)

Existing [M]: Falling Measure (Meteor damage, L10), Coiled Flame (Hydra damage, L10), Deep Current (resource regeneration,
L20), Return Pattern (cooldown reduction, L30), Steady Vessel (Life, L40), Prism Mantle (All Resistance, L50).

| Passive (unlock) | Effect | Archetypes | Template / behaviour |
|---|---|---|---|
| **Chill Margin** (14) | Cold skills deal 15% more damage to chilled enemies; your chills last 25% longer. | Hoarfrost | vs-chilled bonus |
| **Astral Debt** (18) | Meteor, Stormglass Orb and Rimefield can be cast with too little AP, going up to 50 AP into debt; while in debt, AP regeneration −50% and you take 10% more damage. | Starfall, Glass Concord | [NEW-BEHAVIOUR] negative resource |
| **Conjurer's Hearth** (24) | +1 maximum Hydra and +1 maximum Cinderkin; summons last 20% longer; your own non-summon damage −10%. | Lantern Garden | maxSummons + penalty |
| **Resonance** (28) | Channels ramp 40% faster; casting another skill keeps the ramp if you resume within 1 s. | Hollowstar | channel ramp rule |
| **Ley Anchor** (36) | While standing in your Black Hole, Rimefield, molten ground or Orrery ring, skills cost 25% less and cooldowns recover 15% faster. | Starfall, Hoarfrost, Orrery, Glass Concord | [NEW-BEHAVIOUR] "inside own ground" test |
| **Missile Choir** (45) | Your primary fires one more projectile for every 25 AP you hold (max +3), each at 60% damage. | Glass Concord, Orrery | resource-scaled projectiles |
| **Unbroken Ward** (55) | The first hit you take every 8 s is reduced by 60%; freezing an enemy resets the timer. | defensive, Hoarfrost | [NEW-BEHAVIOUR] hit hook |
| **Starborn** (64) | Meteor, Orrery and Stormglass Orb deal 20% more damage; every 30 AP spent calls a small meteor (75% of Meteor's impact, half radius) on a nearby enemy. | Starfall, Orrery | spend-triggered proc |

## 7. Sets: three redesigned, two new

Cap rule [P] (`BUDGET.md` §3): whole set ≤ ×2.5 per skill including transforms; the 6-piece is a transform (damage value
≤ ×1.10) plus ×1.25 own bucket (×1.35 while a condition holds), hard cap ×1.3 effective; the 2- and 4-piece carry ≈×1.5–1.7. Today [M]: Fallen
Star ×8 on Meteor **plus** a 4-piece that multiplies all damage by up to ×3 (1 + 0.5 per element, max 4, `damage.ts`
`talStacks`); Glass Concord ×24; Lantern Garden ×24. Standard mage footprint [M]: pointed hat, mantle, robe, wraps, cloth
leggings, slippers.

### Regalia of the Fallen Star (redesign) — motif *star* (unchanged)
| Pieces | Today [M] | Redesign [P] | Data |
|---|---|---|---|
| 2 | Meteor calls a second meteor on a nearby enemy. | unchanged. | `flag:secondMeteor` |
| 4 | +50% damage per element dealt in the last 8 s (max 4), multiplicative. | Each element dealt in the last 8 s gives a star-sign: **+5% damage per sign in the generic bucket** (max 4 = +20%). | `talStacks` moves from own bucket to `live.dmg` |
| 6 | Meteor +700% (×8). | **Transform:** every 4th Meteor is a falling star: three craters in a line, and enemies within 1.5× radius are pulled to the first impact before it lands. Meteor deals **×1.25**. | `fallingStar` [NEW-BEHAVIOUR], `multiplier:1.25` |

### Glass Concord (redesign: missiles) — motif *shard* (unchanged)
| Pieces | Today [M] | Redesign [P] | Data |
|---|---|---|---|
| 2 | Magic Missile and Black Hole +40% damage. | Magic Missile fires +1 missile; Black Hole cooldown −20%. | `{projectiles:+1}`, `{cooldown:-20}` |
| 4 | Black Hole cooldown −30%. | Missiles that hit an enemy inside your Black Hole split into 2 shards (40% each); you take 20% less damage while a Black Hole you cast is open. | `holeSplit` [NEW-BEHAVIOUR], `holeDR` |
| 6 | Magic Missile and Black Hole +2,300% (×24). | **Transform:** missiles that kill shatter into 3 shards that seek new targets (50% each). Magic Missile, its shards and Stormglass Orb deal **×1.25**. | `missileShatterKill` [NEW-BEHAVIOUR], `multiplier:1.25` |

### Lantern Garden (redesign: summons) — motif *lantern* (unchanged)
Skill change [P]: today the set is Hydra + Frost Nova [M]; Frost Nova moves to Hoarfrost Vigil and Lantern Garden becomes
the summoner set (Hydra + Cinderkin). Saves keep the same set id; only bonuses change (an owner-visible change, listed in
`BUDGET.md` §8 risks and open questions).
| Pieces | Today [M] | Redesign [P] | Data |
|---|---|---|---|
| 2 | Hydras and Frost Nova freezes last 40% longer. | +1 maximum Hydra; Hydras last 40% longer. | `{maxSummons:+1, duration:+40}` |
| 4 | Frost Nova cooldown −30%. | Cinderkin that burst leave a lantern for 4 s (radius 200): Hydras within it attack 30% faster; you take 15% less damage while you have 3+ summons. | `kinLantern` [NEW-BEHAVIOUR], `summonDR` |
| 6 | Hydra and Frost Nova +2,300% (×24). | **Transform:** every 3rd Hydra volley spawns a Cinderkin (max 6 kin in total). Hydra and Cinderkin deal **×1.25**. | `hydraSpawnsKin` [NEW-BEHAVIOUR], `multiplier:1.25` |

### Hoarfrost Vigil (new) — motif *frost* (exists as a legendary motif; promoted to a set signature)
Footprint: standard mage. Colours primary 0x5d7f99, secondary 0xdff6ff, glow 0x3cff6e. Pieces: Hoarfrost Hat, Icicle
Mantle, Vigil Robe, Rimehand Wraps, Snowdrift Leggings, Frostprint Slippers.
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Frost Nova cooldown −25%; Rimefield radius +30%. | `{cooldown:-25}`, `{radius:+30}` |
| 4 | Frozen enemies take 20% more damage from you; you take 20% less damage from chilled enemies; enemies stay chilled 1 s longer after any freeze ends. | vulnerability (frozen), `chilledDR`, `postFreezeChill` |
| 6 | **Transform:** enemies chilled for 3 s straight freeze for 1 s (once per 6 s each); frozen enemies you kill burst into 3 Rime Needles. Rime Needles, Frost Nova and Rimefield deal **×1.35 to chilled or frozen enemies**. | `deepFrost`, `frozenKillNeedles` [NEW-BEHAVIOUR], conditional multiplier |

### Hollowstar Choir (new) — motif *chime* (new)
Footprint **circlet, mantle, robe, wraps, sash, bracers** (legs and feet free). Colours primary 0x3d3566, secondary
0xc8b6ff, glow 0x3cff6e. Pieces: Listener's Circlet, Chorus Mantle, Array Robe, Tuning Wraps, Signal Sash, Resonance
Bracers.
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Thrumming Ray reaches full resonance 50% faster and costs 15% less. | `rayTune`, `{cost:-15}` |
| 4 | While channeling Thrumming Ray you take 25% less damage; Magic Weapon's damage bonus is doubled; Stormglass Orb costs 30% less. | `channelDR`, `weaponDouble`, `{cost:-30}` on the orb |
| 6 | **Transform:** when your Ray passes through your Stormglass Orb it refracts into 3 beams at 40% damage each. Thrumming Ray and Stormglass Orb deal **×1.35 at full resonance**. | `rayRefract` [NEW-BEHAVIOUR], conditional multiplier |

## 8. Legendaries (5 existing + 29 new = 34)

Anchors [M]: staff signatures +150–200% (Cindervane, Lanternroot); wand primary signature 100–150% with +2 missiles
(Spindle of a Thousand Missiles); orb vulnerability 20–25% (Heart of the Void); cost reduction 30–40% (Starfall Mantle).
skillMore 25–40% [P]. FP = standard set footprint.

| Legendary | Base (slot) | Power (`{v}` = rolled) | Range | Template | Cube | Archetype |
|---|---|---|---|---|---|---|
| Lanternroot [M] | Staff (2H) | Hydras deal {v}% increased damage; +1 Hydra. | 150–200 | skillDamage + skillMods | weapon | Lantern Garden |
| Cindervane [M] | Staff (2H) | Meteor deals {v}% increased damage; molten ground lasts twice as long. | 150–200 | skillDamage + skillFlag | weapon | Starfall, Orrery |
| Heart of the Void [M] | Orb | Black Hole radius +30%; enemies inside take {v}% increased damage. | 20–25 | vulnerability | armor | Glass Concord, Starfall |
| Starfall Mantle [M] | Mantle (FP) | Meteor costs {v}% less AP and falls 50% faster. | 30–40 | skillMods | armor | Starfall |
| Spindle of a Thousand Missiles [M] | Wand (1H) | Magic Missile fires 2 more missiles and deals {v}% increased damage. | 100–150 | skillMods + skillDamage | weapon | Glass Concord, Orrery |
| **Glasswright's Wraps** | Wraps (FP) | Magic Missile pierces one enemy (50% damage after the pierce) and deals {v}% more damage to enemies after a pierce. | 25–40 | skillMore (cond.) | armor | Glass Concord |
| **Echoing Bead** | Ring | Magic Missile has a {v}% chance to be cast twice. | 20–30 | skillFlag (chance) | jewelry | Glass Concord, Orrery |
| **Craterheart Amulet** | Amulet | Molten ground pulls enemies 20 units per second toward its centre; enemies on it take {v}% more damage from Meteor. | 20–30 | skillMore (cond.) | jewelry | Starfall |
| **Undertow Staff** | Staff (2H) | Black Hole deals {v}% increased damage and pulls from 30% further. | 150–200 | skillDamage + skillMods | weapon | Starfall, Glass Concord |
| **Horizon Cowl** | Pointed Hat (FP) | You may have two Black Holes open; Black Hole cooldown −{v}%. | 20–30 | skillMods | armor | Starfall, Glass Concord, Orrery |
| **Frostlocked Wand** | Wand (1H) | Frost Nova also goes off around your target and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon | Hoarfrost |
| **Winterbound Robe** | Robe (FP) | Frozen enemies take {v}% more damage from your Cold skills. | 25–40 | skillMore (cond.) | armor | Hoarfrost |
| **Rimecourt Band** | Ring | Frost Nova's cooldown is reduced by 1 s per enemy it freezes (max {v} s). | 2–3 | cooldown | jewelry | Hoarfrost, Starfall |
| **Coiled Pauldrons** | Mantle (FP) | Hydra shots hit every enemy in a short line; Hydras deal {v}% more damage. | 25–35 | skillMore | armor | Lantern Garden |
| **Lanternkeeper's Sash** | Sash | Hydras and Cinderkin last {v}% longer; summoning one adds 2 s to the others. | 30–40 | skillMods | armor | Lantern Garden |
| **Glyphstone Orb** | Orb | Magic Weapon's bonus is {v} points higher; its rune effect triggers 50% more often. | 10–15 | buff (generic) | armor | Glass Concord, Hollowstar, Orrery |
| **Spellwright's Circlet** | Circlet (FP) | While Magic Weapon is active, critical hits reduce all cooldowns by {v} s. | 0.1–0.2 | cooldown | armor | Starfall, Orrery |
| **Runeweaver Cuffs** | Bracers | Magic Weapon also grants {v}% attack speed and costs no AP. | 10–15 | buff | armor | Glass Concord, Lantern Garden |
| **Hoarneedle Wand** | Wand (1H) | Rime Needles fires 2 more needles and deals {v}% increased damage. | 100–150 | skillMods + skillDamage | weapon | Hoarfrost |
| **Frostthread Gloves** | Gloves (FP) | Needles deal {v}% more damage to frozen enemies and re-freeze them for 0.25 s. | 25–40 | skillMore (cond.) | armor | Hoarfrost |
| **Snowglobe Pendant** | Amulet | Freezing an enemy with Rime Needles releases a free Frost Nova at {v}% damage (once per 6 s). | 40–60 | proc | jewelry | Hoarfrost |
| **Resonant Staff** | Staff (2H) | Thrumming Ray reaches full resonance 50% faster and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon | Hollowstar |
| **Hornlistener Circlet** | Circlet (FP) | Thrumming Ray is 20 units wider and deals {v}% more damage to enemies in the far half of the beam. | 25–40 | skillMore (cond.) | armor | Hollowstar |
| **Signal Coil** | Ring | While channeling Thrumming Ray, AP regeneration is {v}% higher. | 40–60 | resource | jewelry | Hollowstar |
| **Kindling Rod** | Wand (1H) | +2 maximum Cinderkin; Cinderkin deal {v}% increased damage. | 150–200 | skillMods + skillDamage | weapon | Lantern Garden |
| **Firekeeper's Gloves** | Gloves (FP) | Cinderkin deal {v}% more damage and their bursts leave embers for 2 s. | 25–35 | skillMore | armor | Lantern Garden |
| **Cistern Staff** | Staff (2H) | Rimefield freezes after 0.75 s and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon | Hoarfrost |
| **Rimewalker Slippers** | Slippers (FP) | Leaving your Rimefield drops a half-size field at your feet (once per cast); frozen enemies take {v}% more damage from Rimefield. | 25–35 | skillMore (cond.) | armor | Hoarfrost |
| **Stormglass Prism** | Orb | Stormglass Orb zaps 2 more enemies and deals {v}% increased damage. | 150–200 | skillMods + skillDamage | armor | Hollowstar, Glass Concord |
| **Conductor's Legwraps** | Cloth Leggings (FP) | Stormglass Orb detonates a second time 1 s later at 50% damage; it deals {v}% more damage. | 25–35 | skillMore | armor | Hollowstar, Glass Concord |
| **Static Loop** | Ring | Each enemy zapped by Stormglass Orb reduces its cost by 1 AP (max {v}). | 8–12 | resource | jewelry | Hollowstar |
| **Armillary Staff** | Staff (2H) | Orrery has 2 more spheres and deals {v}% increased damage. | 150–200 | skillMods + skillDamage | weapon | Orrery |
| **Star-Chart Robe** | Robe (FP) | Orrery's spheres fire twice as often and Orrery deals {v}% more damage while you stand still. | 25–40 | skillMore (cond.) | armor | Orrery |
| **Clockmaker's Ring** | Ring | Orrery's cooldown is {v}% shorter and it lasts 2 s longer. | 15–20 | skillMods | jewelry | Orrery |

**Coverage:** Magic Missile — Spindle of a Thousand Missiles, Glasswright's Wraps, Echoing Bead · Meteor — Cindervane,
Starfall Mantle, Craterheart Amulet · Black Hole — Undertow Staff, Horizon Cowl, Heart of the Void · Frost Nova —
Frostlocked Wand, Winterbound Robe, Rimecourt Band · Hydra — Lanternroot, Coiled Pauldrons, Lanternkeeper's Sash · Magic
Weapon — Glyphstone Orb, Spellwright's Circlet, Runeweaver Cuffs · Rime Needles — Hoarneedle Wand, Frostthread Gloves,
Snowglobe Pendant · Thrumming Ray — Resonant Staff, Hornlistener Circlet, Signal Coil · Cinderkin — Kindling Rod,
Firekeeper's Gloves, Lanternkeeper's Sash · Rimefield — Cistern Staff, Rimewalker Slippers, Winterbound Robe · Stormglass
Orb — Stormglass Prism, Conductor's Legwraps, Static Loop · Orrery — Armillary Staff, Star-Chart Robe, Clockmaker's Ring.

Flavour lines: Glasswright's Wraps "Fine cuts on every fingertip." · Echoing Bead "It answers before you ask." ·
Craterheart Amulet "Still warm from where it landed." · Undertow Staff "Lean on it and the floor leans back." · Horizon
Cowl "The brim hides a second sky." · Frostlocked Wand "Aven found it in the cistern, unmelted." · Winterbound Robe "Hems
stiff with old frost." · Rimecourt Band "A ring of ice that refuses to be water." · Coiled Pauldrons "They tighten when
something hisses." · Lanternkeeper's Sash "Every knot holds a little light." · Glyphstone Orb "The letters rearrange when
nobody looks." · Spellwright's Circlet "Ink stains on the inside." · Runeweaver Cuffs "Stitched in a script older than
the stitches." · Hoarneedle Wand "Prick your finger and it frosts over." · Frostthread Gloves "The thread was spun in
February." · Snowglobe Pendant "Shake it gently." · Resonant Staff "Hum near it and it hums back." · Hornlistener Circlet
"Eris and Daro still argue about what it hears." · Signal Coil "Warm whenever the array is singing." · Kindling Rod
"Kessa says sorry to it every morning." · Firekeeper's Gloves "Too big for anyone. Worn anyway." · Cistern Staff "Drawn
from water that never moved." · Rimewalker Slippers "Every step leaves a little winter." · Stormglass Prism "There is a
storm in there. Do not let it out." · Conductor's Legwraps "Copper thread, carefully insulated." · Static Loop "Your hair
will stand up." · Armillary Staff "All the rings still turn." · Star-Chart Robe "The stars on it move with the season."
· Clockmaker's Ring "Wind it before bed."

## 9. [NEW-BEHAVIOUR] summary for the Mage

1. Cast functions / entities for the six new skills: needle fan with a freeze build-up counter, ray channel with ramp and
   line hit, cinderkin summon (companion AI + expiry burst), `rime` ground with exposure timers, stormglass projectile
   with a periodic area tick, Orrery orbit volumes + borrowed primary casts.
2. Fallen Star 4-piece moved from the own bucket to the generic bucket (`damage.ts talStacks` → `live.dmg`).
3. Set transforms: falling-star line, missile split inside Black Hole, shatter on kill, Hydra-spawned Cinderkin and kin
   lanterns, deep-frost auto freeze + needle burst, ray refraction through the orb.
4. Target-conditional crit (Brittle), skill-excluding vulnerability (Overtone), "inside own ground" test (Ley Anchor),
   negative resource (Astral Debt), first-hit reduction hook (Unbroken Ward), wall bounce (Pinball).
5. Lightning chain on Hydra shots (Forked Tongues), missile chain (Static Thread), molten trail (Ember Tail).
