# Mage — content bible (M1: 12 skills, 5 runes, 6 nodes, 14 passives, 5 sets, 34 legendaries)

> **v2 (2026-10-11).** Builds are no longer authored.
> * §2 is an internal test-fixture list.
> * §7 sets and §8 legendaries key off tags (`ITEMS-SHARED.md` §1); named-skill signatures are the minority.
> * Shipping text describes mechanics only (`ITEMS-SHARED.md` §0).
> * Skill and rune names here are working names and ids; shipping display names are in `NAMES.md`.
> * Tags of every skill and the runes that change them: `ITEMS-SHARED.md` §1.2.
> * Approved by the lead: Lantern Garden is now a Summon set and Frost Nova moves into the Chill set (Hoarfrost Vigil).

Design document for the class agent. Approved plan: `docs/rework/ITEMS-AND-SKILLS-PLAN.md`. Shared conventions, templates,
bases and affixes: `ITEMS-SHARED.md`. Parity and diversity arithmetic: `BUDGET.md`; build tools: `BUILD-TOOLS.md`; names: `NAMES.md`. Reference patterns: `REFERENCES.md`.

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

## 2. Internal test fixtures (never shipped)

These labels exist **only for the parity harness**. No item, set, skill text, tooltip or UI may use them or describe
"a build" (`ITEMS-SHARED.md` §0 rule 1).

v2 replaces the v1 hand-picked kits with a search over the whole item pool (`budget-model.mjs`, `BUDGET.md` §4). The
labels stay as named regression cases. All five requested playstyles (meteor, missiles, summons, frost control, arcane
beam) remain covered.

| Label (internal) | Main skill | Support found by the search | Best configuration found (paper) | Playstyle covered |
|---|---|---|---|---|
| Starfall | Meteor | Rimefield | Regalia of the Fallen Star 5 + Journeyman's Ring | meteor |
| Glass Concord | Magic Missile | Rime Needles | Glass Concord 5 + ring | missiles |
| Lantern Garden | Hydra | Rime Needles | Lantern Garden 5 + ring | summons |
| Hoarfrost | Rime Needles | Magic Missile | Hoarfrost Vigil 3 + ring (4-piece bonus) | frost control |
| Hollowstar | Thrumming Ray | Rimefield | Hollowstar Choir 5 + ring | arcane beam |
| Orrery | Orrery | Frost Nova | Lantern Garden 5 + ring | celestial summon |

Other main skills in the same search found these best kits:

| Main skill | Best kit |
|---|---|
| Stormglass Orb | Glass Concord 5 + ring |
| Black Hole | no set |
| Frost Nova | Hoarfrost Vigil 4 + 2 |
| Rimefield | no set |
| Cinderkin | Lantern Garden 5 + ring |

## 3. New skills (6)

Band today [M]: primary 2.3 (Magic Missile); spender 7.4 + 2.35 molten / 40 AP (Meteor); cooldowns 5.4 over 2 s at 12 s
for 20 AP (Black Hole) and 1.75 + 2 s freeze at 11 s (Frost Nova); summon 2.8/s at 15 AP, 9 s, max 1 (Hydra); buff 25 AP.

### M7 Rime Needles — `rime_needles` (Bolts, primary, L16)

| kind | element | coef | cost | gen | cooldown | range | radius | duration | maxSummons | auto |
|---|---|---|---|---|---|---|---|---|---|---|
| primary | cold | 0.9 per needle × 3 | 0 | 0 | 0 | 340 | 0 | 0.75 (freeze) | 0 | `always` |

* *Anchor:* Magic Missile 2.3 [M]. Three needles total 2.7 if all hit (about 70% land at range, ≈1.9 on one target,
  more on packs) and add a Primary with Chill (design note) [P]. Range 340 < 380 to pay for the control.
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
| N4 Lingering Cold | After the freeze ends, enemies stay chilled 30% for 2 / 3 / 4 s. | `novaChillAfter(r)` |
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
L20), Return Pattern (cooldown reduction, L30), Steady Vessel (Life, L40), Prism Mantle (All Resistance, L50). v2 keys the
new passives to tags.

| Passive (unlock) | Effect (shipping text) | Template / behaviour |
|---|---|---|
| **Chill Margin** (14) | Your Cold skills deal 15% more damage to Chilled enemies; your Chills last 25% longer. | conditional multiplier |
| **Astral Debt** (18) | Your Spender skills can be cast with too little Arcane Power, going up to 50 into debt; while in debt, Arcane Power regeneration is halved and you take 10% more damage. | [NEW-BEHAVIOUR] negative resource |
| **Conjurer's Hearth** (24) | Your Summon skills get +1 maximum each and your Summons last 20% longer; your damage from non-Summon skills is 10% lower. | maxSummons + penalty |
| **Resonance** (28) | Your Channel skills ramp up 40% faster; casting another skill keeps the ramp if you resume within 1 s. | channel ramp rule |
| **Ley Anchor** (36) | While you stand in one of your Ground effects, your skills cost 25% less and your cooldowns recover 15% faster. | [NEW-BEHAVIOUR] "inside own Ground" test |
| **Missile Choir** (45) | Your Primary Projectile skills fire one more projectile for every 25 Arcane Power you hold (max +3), each at 60% damage. | resource-scaled projectiles |
| **Unbroken Ward** (55) | The first hit you take every 8 s is reduced by 60%; freezing an enemy resets the timer. | [NEW-BEHAVIOUR] hit hook |
| **Starborn** (64) | Your Aerial and Cooldown skills deal 20% more damage; every 30 Arcane Power you spend calls a small falling star on a nearby enemy for 150% weapon damage as Fire. | spend-triggered proc (v1's "75% of Meteor's impact" was 5.55× weapon damage per 30 AP, about doubling Meteor; corrected) |

## 7. Sets: building blocks keyed on tags

Structure, the set-reduction ring and evidence: `ITEMS-SHARED.md` §4, `REFERENCES.md` §7.
* **Cap rule [P]:** the 6-piece is a transform (damage value ≤ ×1.10) plus ×1.25 own bucket, or ×1.35 while a condition
  holds; hard cap ×1.3 effective.
* The 2- and 4-piece carry most of the value. A whole set is at most ×2.5 per skill.
* Today [M]: Fallen Star ×8 on Meteor plus a 4-piece that multiplies all damage by up to ×3; Glass Concord ×24; Lantern
  Garden ×24.
* Standard mage footprint [M]: pointed hat, mantle, robe, wraps, cloth leggings, slippers.
* Texts are shipping text: mechanics only.

### Regalia of the Fallen Star — keys off **Aerial, Spender** — motif *star*
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Your Aerial skills strike a second time on a nearby enemy at 60% damage; your Spender skills cost 10% less. | second strike (generalises today's second meteor [M]), `{cost:-10}` |
| 4 | Each element you dealt damage with in the last 8 s grants a star-sign: +5% damage per sign (max 4), generic bucket. | `talStacks` moved from own bucket to `live.dmg` |
| 6 | **Transform:** every 4th Spender cast is a falling star: it also calls three craters in a line that pull enemies toward the first one. Your Aerial and Spender skills deal **×1.25**. | `fallingStar` [NEW-BEHAVIOUR], `multiplier:1.25` |

### Glass Concord — keys off **Projectile** — motif *shard*
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Your Projectile skills fire one more projectile (the item/set count cap of +2 applies, `BUDGET.md` R7). | `{projectiles:+1}` on Projectile |
| 4 | Projectiles that hit an enemy inside one of your Ground effects split into 2 shards (40% each); your Projectile skills deal 10% more damage; you take 20% less damage while one of your Ground effects is active. | `groundSplit` [NEW-BEHAVIOUR], multiplier, DR |
| 6 | **Transform:** Projectiles that kill shatter into 3 shards that seek new targets (50% each). Your Projectile skills and shards deal **×1.25**. | `shatterOnKill` [NEW-BEHAVIOUR], `multiplier:1.25` |

### Lantern Garden — keys off **Summon** — motif *lantern*
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Your Summon skills get +1 maximum each; your Summons last 30% longer. | Summon-tag mods |
| 4 | Your Summons that expire or die leave a lantern (4 s, radius 200) in which your Summons attack 30% faster; you take 15% less damage while you have 3 or more Summons. | `summonLantern` [NEW-BEHAVIOUR], DR |
| 6 | **Transform:** every 3rd attack by one of your Summons spawns an ember sprite (6 s, claws for 100% weapon damage per second, max 6). Your Summons deal **×1.25**. | `emberSprite` summon [NEW-BEHAVIOUR], `multiplier:1.25` |

### Hoarfrost Vigil — keys off **Chill, Ground** — motif *frost* (new set signature)
Colours primary 0x5d7f99, secondary 0xdff6ff, glow 0x3cff6e. Pieces: Hoarfrost Hat, Icicle Mantle, Vigil Robe, Rimehand
Wraps, Snowdrift Leggings, Frostprint Slippers.
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Your Chill and Ground skills' cooldowns are 20% shorter and their areas 20% larger. | tag mods |
| 4 | Frozen enemies take 20% more damage from you; you take 20% less damage from Chilled enemies; Chills linger 1 s after a freeze ends. | vulnerability (frozen), DR |
| 6 | **Transform:** enemies Chilled for 3 s straight freeze for 1 s (once per 6 s each); frozen enemies you kill burst into 3 frost needles. All your skills deal **×1.35 to Chilled or frozen enemies**. | `deepFrost`, `frozenKillNeedles` [NEW-BEHAVIOUR], conditional multiplier |

### Hollowstar Choir — keys off **Channel, Arcane** — motif *chime* (new)
Footprint **circlet, mantle, robe, wraps, sash, bracers** (legs and feet free). Colours primary 0x3d3566, secondary
0xc8b6ff, glow 0x3cff6e. Pieces: Listener's Circlet, Chorus Mantle, Array Robe, Tuning Wraps, Signal Sash, Resonance
Bracers.
| Pieces | Bonus [P] | Data |
|---|---|---|
| 2 | Your Channel skills reach full power 50% faster and cost 15% less. | Channel-tag mods |
| 4 | While channelling you take 25% less damage; your Buff skills' damage bonuses are doubled; your Spender skills cost 30% less; your Channel skills deal 15% more damage. | DR, buff double, cost, multiplier |
| 6 | **Transform:** when a Channel beam passes through one of your Projectiles or Ground effects, it refracts into 3 beams at 40% damage. Your Channel and Arcane skills deal **×1.35 at full channel power**. | `beamRefract` [NEW-BEHAVIOUR], conditional multiplier |

## 8. Legendaries (5 existing + 29 new = 34; 14 named, 20 tag-keyed)

Templates and the Cube rule: `ITEMS-SHARED.md` §1.3.
* 20 of the 29 new items are tag-keyed (69%).
* Anchors [M]: staff signatures +150–200% (Cindervane, Lanternroot); wand primary signature 100–150% with +2 missiles
  (Spindle of a Thousand Missiles); orb vulnerability 20–25% (Heart of the Void).
* New tag additives 40–90% and skillMore 25–40% [P], checked by the diversity search (`BUDGET.md` §4).
* Coverage: every mage main skill is touched by its named signature plus 5–9 tag-keyed legendaries.

| Legendary | Layer | Base (slot) | Power (shipping text; `{v}` = rolled) | Range | Template | Cube |
|---|---|---|---|---|---|---|
| Lanternroot [M] | Named | Staff (2H) | Hydras deal {v}% increased damage; +1 Hydra. | 150–200 | skillDamage + skillMods | weapon |
| Cindervane [M] | Named | Staff (2H) | Meteor deals {v}% increased damage; molten ground lasts twice as long. | 150–200 | skillDamage + skillFlag | weapon |
| Heart of the Void [M] | Named | Orb | Black Hole radius +30%; enemies inside take {v}% increased damage. | 20–25 | vulnerability | armor |
| Starfall Mantle [M] | Named | Mantle (FP) | Meteor costs {v}% less Arcane Power and falls 50% faster. | 30–40 | skillMods | armor |
| Spindle of a Thousand Missiles [M] | Named | Wand (1H) | Magic Missile fires 2 more missiles and deals {v}% increased damage. | 100–150 | skillMods + skillDamage | weapon |
| **Undertow Staff** | Named | Staff (2H) | Black Hole deals {v}% increased damage and pulls from 30% farther. | 150–200 | skillDamage + skillMods | weapon |
| **Frostlocked Wand** | Named | Wand (1H) | Frost Nova also goes off around your target and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon |
| **Hoarneedle Wand** | Named | Wand (1H) | Rime Needles fires 2 more needles and deals {v}% increased damage. | 100–150 | skillMods + skillDamage | weapon |
| **Resonant Staff** | Named | Staff (2H) | Thrumming Ray reaches full resonance 50% faster and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon |
| **Kindling Rod** | Named | Wand (1H) | +2 maximum Cinderkin; Cinderkin deal {v}% increased damage. | 150–200 | skillMods + skillDamage | weapon |
| **Cistern Staff** | Named | Staff (2H) | Rimefield freezes after 0.75 s and deals {v}% increased damage. | 150–200 | skillFlag + skillDamage | weapon |
| **Stormglass Prism** | Named | Orb | Stormglass Orb zaps 2 more enemies and deals {v}% increased damage. | 150–200 | skillMods + skillDamage | armor |
| **Armillary Staff** | Named | Staff (2H) | Orrery has 2 more spheres and deals {v}% increased damage. | 150–200 | skillMods + skillDamage | weapon |
| **Runeweaver Cuffs** | Named | Bracers | Magic Weapon costs nothing and also grants {v}% attack speed. | 10–15 | buff | armor |
| **Glasswright's Wraps** | Tag (Projectile) | Wraps (FP) | Your Projectiles pierce one enemy (50% damage after the pierce) and deal {v}% more damage to enemies after a pierce. | 25–40 | skillFlag + skillMore (cond.) | armor |
| **Echoing Bead** | Tag (Primary) | Ring | Your Primary skills have a {v}% chance to be cast twice. | 20–30 | skillFlag (chance) | jewelry |
| **Craterheart Amulet** | Tag (Aerial) | Amulet | Your Aerial skills deal {v}% increased damage, and their Ground effects pull enemies 20 units per second inward. | 60–90 | skillDamage + skillFlag | jewelry |
| **Horizon Cowl** | Tag (Ground) | Pointed Hat (FP) | Your Ground skills deal {v}% increased damage, and your Ground effects last 1 s longer. | 40–60 | skillDamage + skillMods | armor |
| **Winterbound Robe** | Tag (Cold, Chill) | Robe (FP) | Your Cold skills deal {v}% more damage to Chilled or frozen enemies. | 25–40 | skillMore (cond.) | armor |
| **Rimecourt Band** | Tag (Chill + Cooldown) | Ring | Each enemy you freeze reduces your Chill skills' cooldowns by 0.5 s (max {v} s per cast). | 2–3 | cooldown | jewelry |
| **Coiled Pauldrons** | Tag (Summon) | Mantle (FP) | Your Summons deal {v}% more damage, and summoned projectiles pierce in a short line. | 20–30 | skillMore + skillFlag | armor |
| **Lanternkeeper's Sash** | Tag (Summon) | Sash | Your Summons last {v}% longer; summoning one adds 2 s to the others. | 30–40 | skillMods | armor |
| **Glyphstone Orb** | Tag (Buff) | Orb | Your Buff skills' damage bonuses are {v} points higher, and their rune effects trigger 50% more often. | 10–15 | buff (generic) | armor |
| **Spellwright's Circlet** | Tag (Buff → Cooldown) | Circlet (FP) | While a Buff skill is active, your critical hits reduce your cooldowns by {v} s. | 0.1–0.2 | cooldown | armor |
| **Frostthread Gloves** | Tag (Primary, Chill) | Gloves (FP) | Your Primary skills deal {v}% more damage to frozen enemies and re-freeze them for 0.25 s. | 25–40 | skillMore (cond.) | armor |
| **Snowglobe Pendant** | Tag (Chill) | Amulet | Freezing an enemy releases a burst of frost around it for {v}% weapon damage that Chills (once per 6 s). | 60–80 | proc | jewelry |
| **Hornlistener Circlet** | Tag (Piercing) | Circlet (FP) | Your Piercing skills deal {v}% more damage to enemies farther than 200 units. | 25–40 | skillMore (cond.) | armor |
| **Signal Coil** | Tag (Channel) | Ring | Your Channel skills deal {v}% increased damage, and your resource regeneration is 30% higher while channelling. | 60–90 | skillDamage + resource | jewelry |
| **Firekeeper's Gloves** | Tag (Burn, Summon) | Gloves (FP) | Your Burn effects deal {v}% more damage, and your Summons apply Burn on hit. | 25–35 | skillMore + skillFlag | armor |
| **Rimewalker Slippers** | Tag (Ground, Movement) | Slippers (FP) | Your Ground effects deal {v}% more damage; when a Movement skill ends, drop a half-size copy of your most recent Ground effect (once per 8 s). | 25–35 | skillMore + proc | armor |
| **Conductor's Legwraps** | Tag (Lightning) | Cloth Leggings (FP) | Your Lightning skills chain to one more enemy and deal {v}% more damage. | 25–35 | skillMods + skillMore | armor |
| **Static Loop** | Tag (Spender) | Ring | Your Spender skills deal {v}% increased damage; each enemy they hit refunds 1 Arcane Power (max 8 per cast). | 60–90 | skillDamage + resource | jewelry |
| **Star-Chart Robe** | Tag (Arcane, Summon) | Robe (FP) | While you stand still, your Arcane skills deal {v}% more damage and your Summons attack 30% faster. | 25–40 | skillMore (cond.) | armor |
| **Clockmaker's Ring** | Tag (Cooldown) | Ring | Your Cooldown skills' cooldowns are {v}% shorter. | 15–20 | skillMods | jewelry |

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

1. **Six new skills:**
   * needle fan with a freeze build-up counter;
   * ray channel with ramp and line hit;
   * cinderkin summon (companion AI + expiry burst);
   * `rime` ground with exposure timers;
   * stormglass projectile with a periodic area tick;
   * Orrery orbit volumes + borrowed primary casts.
2. **Tags (shared):** tag resolution, the tag line, selectors, the conditional multiplier (`ITEMS-SHARED.md` §1); the
   projectile count cap of `BUDGET.md` R7.
3. **Fallen Star 4-piece** moved from the own bucket to the generic bucket (`damage.ts talStacks` → `live.dmg`).
4. **Set transforms:**
   * an Aerial second strike, the falling-star line;
   * projectile split inside own Ground, shatter on kill;
   * summon lanterns and ember sprites;
   * chill-to-freeze with needle bursts;
   * beam refraction through own Projectiles/Ground.
5. **Player side:** a target-conditional crit (Brittle); a skill-excluding vulnerability (Overtone); the "inside own
   Ground" test (Ley Anchor); negative resource (Astral Debt); a first-hit reduction hook (Unbroken Ward); a Movement-end
   hook (Rimewalker Slippers).
6. **Projectile features:** wall bounce (Pinball); Lightning chains on Hydra shots and missiles; summoned projectiles
   piercing (Coiled Pauldrons); Summons applying Burn (Firekeeper's Gloves).
