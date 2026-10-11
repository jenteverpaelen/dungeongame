# Ranger wave — what shipped, what is still blocked, deviations (branch `claude/ranger`)

Implements `RANGER.md` (bible v2) on the depth foundation, engine wave 2 and the shared-items wave, with the method of the
warrior pilot (`WARRIOR-PILOT.md`). Labels: **[M]** measured in this repo, **[P]** proposal (a number chosen here, to be
re-fitted by playtests), **[B]** taken from the bible.

## 0. BUDGET.md §4 levers, applied before measuring

| Lever (BUDGET.md §4 "Reading", ranger) | Shipped |
|---|---|
| Gearwright's Heart fires 30 % faster instead of 50 % | `sentryFast: 30` |
| Aerial / Projectile Spender tag additives +15 points | Weathervane Ring and Bandolier Belt 60–90 → 75–105 |
| Give Rainspindle (Arrowfall) a damage roll | Rainspindle rolls 150–200 % damage (the named bow band [M]); its cooldown cut is fixed at 35 %, the middle of its old 30–40 roll |

## 1. Shipped

| What | Count | Notes |
|---|---|---|
| Skills | 12 / 12 | 6 existing + Skipstone Bolt (16), Spring Snare (20), Overcast Volley (26), Quarry Mark (32), Pitch Mortar (40), Murmuration (50) |
| Runes | 60 / 60 | runes 4–5 of the existing skills at the bible's levels; Badger and Heron are new companion animals |
| Specialization nodes | 72 / 72 | every tree holds 12–18 ranks for a cap of 10; the last four shipped in phase 2 (§2) |
| Passives | 14 (6 kept + 8 new) | Engineer's Margin, Kinship, Long Shot, Weather Eye, Trapper's Instinct, Hatred Well, Second Skin, Hunter's Accord |
| Sets | 5 / 5 | Siegebreaker's Arsenal, Farwatch, Rainkeeper redesigned on tags; Thicket Kin and Snarewright new |
| Ranger legendaries | 35 / 35 | 5 existing (levers above; texts use the new names) + 30 new (7 named, 23 tag-keyed) |
| Data grounds | 4 | `shared/src/data/groundsRanger.ts` (burning pitch, burning snare ground, wet ground, powder patch) |
| Names | `NAMES.md` | Hungering Arrow → **Tracking Arrow**, Cluster Arrow → **Burst Arrow**, Rain of Vengeance → **Arrowfall**; 13 rune renames; Vengeance Renewed → Squall Renewed; node Wind Shear → **Crosswind** (the originality gate found the D3 label); ids unchanged |
| Tags | every ranger skill and rune per `ITEMS-SHARED.md` §1.2 | Multishot is Spender · Projectile · Piercing (no longer Area); Sentry carries Cooldown |

Code: data `shared/src/data/skills/ranger.ts`, `shared/src/data/powers/ranger.ts`, `shared/src/data/passives/ranger.ts`,
`shared/src/data/groundsRanger.ts`; behaviour `server/src/sim/skills/ranger.ts` (the existing six), `rangerM1.ts` (the six
new + snare / mortar / flock AI), `rangerKit.ts` (state, the mark system, beast and device hit wrappers, Hatred spending,
the tick and death hooks). Tests `server/test/ranger.test.ts`, `server/test/rangerEngine.test.ts` (generic additions),
sim skill coverage for every new skill × rune. New legendaries and set pieces drop through normal loot (test "ranger
loot"); debug `legendaries` / `set` grant them.

## 2. Phase 2 (engine wave 3, merged from claude/town-ui-rework 7faa331): nothing left blocked

| Content | Shipped with |
|---|---|
| Tracking Arrow N6 Gut Hook: pierced enemies slowed 10 / 20 / 30 % for 2 s | status `slow` from the Tracking Arrow hooks |
| Skipstone N6 Wake: each skip leaves a 1 s puddle that slows 20 / 30 / 40 % | a `wet` puddle visual (radius [P] 50 = Ripple's) and 250 ms slow pulses (class code, no data ground: Skipstone is not a Ground skill) |
| Pitch Mortar N4 Tar Pit: pitch slows 15 / 30 / 45 % | slow pulses on the pitch ground's live radius (Tar-Stained Jerkin growth included) |
| Murmuration N4 Feather Storm: enemies inside slowed 20 / 35 / 50 % | every flock tick refreshes a 0.5 s slow [P] |
| Ripple 30 % for 1 s, Flood Plain 30 % (wet ground), Bloodhound 30 % (quarry), Weather Eye 30 % for 2 s | the slow at the bible's strength instead of the engine's one chill (40 %, movement and attacks); Weather Eye's +15 % and Trapper's Instinct's +15 % now count `slowed` (chilled or slowed) |
| Wingbeat Boots part 2: "after a Movement skill your Beasts dash to your side" | the tick your dash ends (the moment of the engine's `dashEnd` trigger, read in the ranger tick: a proc has no class-code action) the beasts run to your side at your dash's speed (230 units / 170 ms [M]) for up to 0.6 s [P], then fight on |
| Quarry Mark N2 Tracker: +5 / 10 / 15 % movement speed | buff `mv` (`live.mv`, client prediction via `MeState.ms`) next to the attack speed |

Texts say "slowed by N %" (the warrior's wave-3 wording): the slow is movement only, the engine's chill also slows
attacks. Tests: `server/test/ranger.test.ts` (phase 2).

## 3. Narrow generic additions (each its own commit, tests in `server/test/rangerEngine.test.ts`)

* `ProjHooks` on projectiles (`pre` replaces a hit's strike, `post` after a hit with "flew on", `end` once at the final
  end; kept by bounces, returns and ricochets) and `ProjSpec.reach` (flight-time cap from a given reach instead of the
  skill's range). Used by Skipstone Bolt, Featherguard Cuffs, Skimmer's Leggings, Skipping-Stone Quiver, spotting, Gale
  Shot, Ricochet Fletch, Long Flight, the Arbalest, splinters, darts, thorns, pellets, the farwatch shot.
* Condition `targetWithin: N` (counterpart of `targetFartherThan`): Point Blank, Bowyer's Gloves.
* `perSummon` counts a summon type, the skill that made it, or a tag of that skill: "per living Beast / companion",
  "per active Device".
* Not generic (class code): new summon types `snare`, `mortar`, `flock`, `flock_guard`, `badger`, `heron` (the
  `SummonType` union only), the mark system (Quarry Mark upkeep, jumps, Hunter's Accord), the Arrowfall storm controller.
* The companion's bite now carries its own multiplier (`skillMult`): Beast sets and items reach it. Before, the bite
  left it out (no shipped item depended on it).

## 4. Deviations from the bible (and why)

| Where | Bible | Shipped | Why |
|---|---|---|---|
| Tiers of the six new skills | none authored | 3 tiers each, patterned on the class's existing tiers [M] (+20–25 % damage, −20–25 % cost or cooldown, +25 % radius / +50 % duration / +1 summon, +2 Hatred) | every skill has three tiers (ITEMS-SHARED §0); names original |
| Farwatch 4 | Projectile Spenders cost 30 % less | 15 % | measured ×1.92 (Burst Arrow) and ×1.42 (Multishot) for the cut alone: a Hatred-limited Spender turns a cost cut into casts 1 : 1/(1−x) (the warrior's Cinder Oath 4 rule) |
| Rainkeeper 4 | Spender skills cost 30 % less | every skill costs 15 % less while an Aerial / Ground effect is active | measured ×1.57 on Overcast Volley; a buff's cost factor (`Buff.cost`) applies to every skill |
| Farwatch 6 | "every 5th Projectile cast is a farwatch shot … releases a free cast of your most recent Projectile Spender" | the 5th cast is replaced by the shot (the bible's "is"); the free cast deals 50 % [M fit] | as an extra shot with a full free cast the transform measured ×1.59 on Burst Arrow; BUDGET R1 allows ×1.10 — now ×1.10 (Burst Arrow), ×0.97 (Multishot) |
| Weather Eye, Flood Plain, Ripple, Bloodhound, Wake, Feather Storm | "chill N %" | a slow of N % (movement only); Weather Eye's lasts 2 s [P] (Freezing Drizzle's duration) | the engine's chill has one strength (40 %, movement and attacks); a chill of chosen strength is the wave-3 slow |
| Trapper's Instinct | Stun and Chill effects last 20 % longer | Stun and Freeze (the engine's control-duration stat) | chill has no duration stat |
| Engineer's Margin | each Device deals 15 % less | −15 points in the additive bucket | power multipliers only grow (validation: 1..127) |
| Siegebreaker 4 | "your Devices also fire your Spender Projectile skills" | Sentries and Pitch Mortars (the Devices that fire) | a snare has no aim |
| Siegebreaker 6 salvo | "a rocket salvo every 3 s" | one rocket at 120 % (Rocket Rack's rocket [M]) per firing Device every 3 s [P] | the bible names the salvo, not its size; measured ×1.05 |
| Rainkeeper 6 | "your longest-lasting Aerial effect becomes a storm that follows you" | Arrowfall follows you | the ranger's only lasting Aerial effect |
| Hair Trigger | snares arm instantly | arm on the next tick (50 ms) | a snare must be seen by clients before it snaps |
| Coiled Wire Bracers | "expiring Devices fire a final salvo" | 4 Sentry bolts (Last Barrage rank 1) / one shell per Mortar [P] | size not given |
| Thicket Kin 2 / 4 / 6 per-attack effects | "Beast attacks" | companion bites, heron spears, badger, falcon; Murmuration's ticks get the Beast damage bonuses, not the per-attack Hatred, marks and leaps | four ticks a second would turn them into ×4 effects |
| Stormbirds | "arcs to 2 enemies outside it" | 50 % weapon damage per arc [P] | = one flock tick (2.0 per s ÷ 4) |
| Overcast Volley Storm Shelf | "strikes 2 random enemies with bolts" | two bolts during the 2 s linger (at +0.5 s and +1.5 s) | timing not given |
| Bounty | "drops a health globe" | "drops a healing pickup" | the originality gate (D3 term) |
| Bolt-Thrower's Arbalest | Device projectiles "pierce" (every enemy) | pierce up to 2 enemies, then burst | bandwidth [M]: unbounded, the Sentry kit's damage events ×1.6 put the perf budget at +18.1 % (gate +15 %); capped +11.9 % (§8); the item's value moved about 5 % |
| Node Wind Shear | name | **Crosswind** | a D3 rune label (originality gate) |
| Quarry Mark text | — | adds who it marks and "not cast while your mark lives" | the auto filter is visible behaviour |
| Spotter's Repeater | "your Mark bonus" | Mark-tagged skills (Quarry Mark, Marker Bolt) | Hunter's Mark keeps its own roll |
| Badger Sett burst | stuns 0.75 s | stun only (no damage) | no number given |
| Heron | "its strikes chill" | chill 1.5 s [P] | duration not given |
| Murmuration speed, Bait pull, Quick Match scatter, Sympathetic Blast reach, Squallcatcher drift on Overcast | not given | 260 u/s, 24 u/s, −15 % per rank, 60 units, 60 u/s [P] | — |

New [P] numbers without a bible value: Skipstone flight 900 u/s (Tracking Arrow's [M]); Overcast arrows fall 0.35 s after
the cast; the Mortar's shell flight 0.45 s (Burst Arrow's lob [M]); burning snare ground 0.6 per s (= the pitch's rate);
powder patch radius 60 (the Arbalest burst).

## 5. Events (client contract)

Summon types `snare`, `mortar`, `flock` (desc `r` = flock radius, changes with Gathering Flock), `flock_guard`, `badger`,
`heron`. Projectiles `skip` / `skip_heavy` (impact = `pend`), `dart`, `thorn`, `farwatch`, `pellet`, `splinter`. `aoe`:
`skip_ripple`, `skim_ripple`, `snare_arm`, `snare_snap`, `snare_cone` (`a`), `trap_pull`, `overcast_cloud` (`d` = cloud
time), `overcast_arrow`, `overcast_heavy`, `quarry_mark` (`s` = the monster, `f:1`), `falcon_dive`, `mortar_shot`
(`s` = the mortar, `d` = flight), `mortar_impact`, `flock_stoop`, `badger_burst`, `sentry_flame` (`a`), `barrel_blast`,
`kestrel_column`, `rain_storm` (`f:1`), data-ground visuals `pitch`, `wet`, `snare_fire`, `powder_patch`. Beams
`snare_tether`, `snare_wire`, `heron_spear`, `flock_arc`, `volley_bolt`, `quarry_jump`. Buffs `second_skin`,
`rainkeeper`, `huntsman`, `alpha_howl`, `hunting_horn` (hidden), `snare_guard`, `tracker`, `starling_shield`,
`murmuration` (hidden).

## 6. Parity

Full report: `RANGER-PARITY.md` / `.json` (after every fit, the event timing and the Arbalest's pierce cap: 3 seeds, 25-evaluation
search per kit, with and without the shared legendaries; 775 s). Gate in `npm run verify` (`server/test/parity.test.ts`): D3 and D4
hard limits on ranger items for the parity-ready main skills Arrowfall, Pitch Mortar, Companion and Murmuration (greedy
kits, seed 101: D3 0.93 / 0.92 / 0.83 / 0.81). A skill is flagged only when both the searched audit and the greedy gate
hold; Tracking Arrow, Skipstone Bolt, Multishot and Overcast Volley pass the searched audit (below) but not the greedy
gate, Sentry and Burst Arrow fail both.

Fits made from measurements (the bible's model valued them lower; same rule as the warrior's Cinder Oath 4): Farwatch 4
cost 30 → 15 %, Rainkeeper 4 cost 30 → 15 %, Farwatch 6 replaces the 5th cast and its free cast deals 50 % (§4). The
§0 levers came first. Skill coefficients are the bible's.

| Main skill | Ranger items only: legendary / best 6 / best hybrid | D3 · D4 | With shared legendaries: legendary / best 6 / hybrid | D3 · D4 |
|---|---|---|---|---|
| Tracking Arrow | ×8.6 / ×7.5 SW6 / ×7.9 TK4 | 1.15 · 1.00 | ×13.3 / ×8.7 TK6 / ×9.3 TK4 | 1.53 · 1.00 |
| Skipstone Bolt | ×9.1 / ×7.8 SW6 / ×8.5 TK4 | 1.18 · 1.00 | ×14.0 / ×9.0 TK6 / ×9.3 RK4 | 1.56 · 1.00 |
| Multishot | ×9.0 / ×7.3 TK6 / ×8.9 FW4 | 1.22 · 1.00 | ×16.0 / ×8.6 TK6 / ×10.4 TK4 | 1.86 · 1.00 |
| Burst Arrow | ×9.3 / ×9.4 FW6 / ×12.0 FW4 | 0.99 · **1.27** | ×21.1 / ×13.3 FW6 / ×19.6 FW4 | 1.58 · 1.00 |
| Overcast Volley | ×7.5 / ×6.8 SW6 / ×7.4 SW4 | 1.09 · 1.00 | ×15.5 / ×8.8 RK6 / ×11.2 RK4 | 1.76 · 1.00 |
| Arrowfall | ×8.2 / ×7.7 SW6 / ×7.8 SW4 | 1.06 · 1.00 | ×15.0 / ×8.7 TK6 / ×9.9 RK4 | 1.72 · 1.00 |
| Sentry | ×17.7 / ×14.1 SB6 / ×16.9 SB4 | **1.25** · 1.00 | ×33.6 / ×20.2 SB6 / ×33.2 SB4 | 1.66 · 1.00 |
| Spring Snare | ×5.5 / ×6.0 SW6 / ×6.0 SW4 | 0.91 · 1.00 | ×15.1 / ×10.8 SW6 / ×11.1 RK4 | 1.41 · 1.00 |
| Pitch Mortar | ×8.9 / ×9.0 SB6 / ×9.1 SB4 | 0.99 · 1.01 | ×22.9 / ×12.9 SW6 / ×15.3 TK4 | 1.78 · 1.00 |
| Companion | ×8.1 / ×9.8 TK6 / ×10.0 TK4 | 0.82 · 1.02 | ×20.8 / ×12.3 TK6 / ×14.4 TK4 | 1.69 · 1.00 |
| Murmuration | ×8.5 / ×10.0 TK6 / ×10.1 TK4 | 0.84 · 1.01 | ×16.3 / ×12.7 TK6 / ×14.1 TK4 | 1.29 · 1.00 |

SB Siegebreaker's Arsenal, FW Farwatch, RK Rainkeeper, TK Thicket Kin, SW Snarewright. (D4 1.00 = the hybrid lies
between the two.) Checks, ranger items only: D1 1/11, D2 Whistle Charm 11/11, D3 0.82–1.25 (Sentry 1.252, over the hard
limit by 0.002), D4 1.00–1.27, D5 4/5 (hard pass; Rainkeeper is nobody's best), D6 1.94. With the shared legendaries:
D1 1/11, D2 Wingbeat Boots 11/11, D3 1.29–1.86, D4 1.00 (hard pass), D5 4/5 (hard pass; legendary-only is every main's
top kit, so only hybrids count), D6 2.10. Paper model before the wave: D1 5/11. The causes, measured:

* **Sentry is the class's outlier** (D1, D6; ×17.7 against a median best of ×9.1). Ablation of its legendary-only kit
  (ranger items only, before the pierce cap): Bolt-Thrower's Arbalest (Cube) ×2.20, Sapper's Pack ×1.50, Bowyer's Gloves ×1.37, Kennel-Wood
  Bow ×1.25, Fuse Cord Belt ×1.25, Wingbeat Boots ×1.19, Gearwright's Heart ×1.12 (after the §0 cut), Whistle Charm
  ×1.12. The Arbalest's value is its +100–150 % roll on the thin Device bucket (pierce 1 / 2 / all and a 50 % burst
  moved it by ±5 %, `ranger.ts` notes); it sits in every Sentry kit, so it lifts the outlier, not D3. D3 1.25 comes from
  the armour slots: Siegebreaker 6 gives up Bowyer's Gloves, Hawkfeather Cap, Wingbeat Boots and Skimmer's Leggings, and
  its 4-piece "Devices fire your Spender Projectile skills" copies a skill the Sentry fixture does not carry. Not changed
  here (bible rolls; a design call for the balance pass).
* **Burst Arrow D4 1.27**: Farwatch 4 + two legendaries (×11.9) beats Farwatch 6 (×9.4): the 6-piece's "+35 % against
  enemies farther than 200 units" rarely holds for the bot, which fights at 70–200 units (ablation of the 6-piece:
  ×0.97–0.99 for that half). Reported, not fitted (the condition is the bible's).
* **Shared legendaries favour legendary-only kits** (D3 1.29–1.86), as for the warrior. Ablation of the Multishot
  legendary-only kit with the shared pool: Surveyor's Plumb ×1.30, Patchwork Signet ×1.26, Ouroboros Loop ×1.22,
  Witching Cord ×1.13, Kilnwatch Spaulders ×1.11, Hearthguard Coat ×1.09 (all shared; ranger items in the same kit:
  Kennel-Wood Bow ×1.69, Thunderhead ×1.25, Trailhide Breeches ×1.22, Bowyer's Gloves ×1.21, Wingbeat Boots ×1.18). They
  sit in the armour and jewellery slots a 6-piece gives up. Hand-off to the shared-items lane and the Torment re-fit.
* **D2** counts frequency: Companion is in every fixture (the bible's Beast identity), so Whistle Charm ("Beasts attack
  faster") is in every top kit; with the shared pool Wingbeat Boots (+v % Beast damage to elites, the elites of the three
  encounters) is. Companion (0.82) and Murmuration (0.84) sit inside the hard band, under the 0.85 target.

## 7. Endgame power and the simulation

Measured in `server/test/sim.ts` (sim fixture = the audit's Siegebreaker 6 Sentry kit, `CLASS_LEGS` / `CUBE` for the
ranger): the set kit lifts the ranger ×29 over rares against 8 sturdy targets (×348 on 343a5d5 with the old sets [M];
warrior ×20, unchanged; mage ×182, its rares differ only because the ranger runs first in the shared RNG stream).
`BUDGET.md` §9 risk 1 expects this drop. The ranger's L70 set kit reaches 57.1 % of a Torment II rift in 12 minutes
(4 deaths; it completed on the old sets); before the last fits and the Arbalest's pierce cap shifted the seeded stream it
measured 64.6–81.5 % (×17 spike: bolts that pierced every enemy burst behind the pack). The sim
checks the same 30 % progress floor as for the warrior until the Torment re-fit. L1 Normal and L20 Hard ranger rifts
complete (7:39, 9:34).

Mage unchanged by the wave: with only the mage in the class loops, the spike, field and rift sections are byte-identical
against 343a5d5 except tick timings (`git diff 343a5d5 -- <mage files>` is empty).

## 8. Evidence and performance

Evidence (1920×1080 JPEG, real server on :2681, `shots/ranger/`): `game-skills-page1.jpg` / `game-skills-page2.jpg`
(12 skills, categories, passives row), `game-tree-skipstone.jpg`, `game-tree-spring-snare.jpg`,
`game-runes-murmuration.jpg`, `game-passives.jpg` (14 passives); item cards `game-item-snarewright-belt.jpg` (set, 6/6),
`game-item-riverstone.jpg`, `game-item-mortarmans-pack.jpg`, `game-item-whistle-charm.jpg`; combat in a Torment I rift
`game-combat-skipstone-2.jpg` (Ripple), `game-combat-snare-2.jpg`, `game-combat-overcast-2.jpg` (Storm Shelf),
`game-combat-quarry-1.jpg` (with Companion), `game-combat-mortar-2.jpg`, `game-combat-murmuration-4.jpg`; VFX gallery
`vfx-*.jpg`, icons `vfx-icons-*.jpg`. 0 scroll regions in the Skills window. Known look issue: at the game's zoom the
flock reads as a small dark swarm and Quarry Mark's sigil is small next to elite nameplates (both read clearly in the
gallery, `vfx-murmuration-2_6.jpg`, `vfx-quarry-mark-1_5.jpg`).

**Client VFX rules** (the owner's low-end mandate): no Pixi filters (none in the new code); glows and particle frames are
baked into the shared fx atlas; painted props on one canvas atlas with pooled Sprites; no Graphics objects in the ranger
VFX module (visible Graphics in a fight: 3–9 for both kits); flocks are one ParticleContainer each (transform / tint /
alpha only) and follow `effectsFactor` (Low ≈ 120 birds instead of 600); particle counts go through the existing
budget; projectiles from the existing particle pool. No texture uploads during fights (texImage2D / texSubImage2D 0 per
frame in every run).

**Draw calls and visible objects, before and after the new skills** (lead's `rift-gl.mjs` method, copied to
`.local/scn/rift-gl-ranger.mjs`: L70 hero with the debug set and legendaries in a Torment I rift, 6 s fight, then WebGL
calls counted over 4 s and a stage walk; "old" = the pre-wave kit Tracking Arrow, Multishot, Burst Arrow, Sentry,
Arrowfall; "new" = Skipstone Bolt, Spring Snare, Overcast Volley, Pitch Mortar, Murmuration; unlimited resource on;
measured before the Arbalest's pierce cap, which only lowers the damage numbers on screen):

| Measurement | Old kit | New kit |
|---|---|---|
| Rift, High, 3 runs: draw calls / frame | 84–116 (mean 104) | 116–142 (mean 131) |
| Rift, High: visible objects (living mobs) | 432–594 (3–25 mobs) | 466–785 (19–24 mobs) |
| Rift, Low, 2 runs: draw calls / visible objects | 91–139 / 510–714 | 112–140 / 590–643 |
| Rift: effect layers' visible nodes (groundFx + aboveFx) | 23–26 | 28–35 |
| Rift: effect layers' draw calls (layers toggled, 4 × 1 s each) | 3.6–8.5 | 0–9.1 |
| Gallery `rangerfight`, same scene and 24-mob pack, High: draw calls / visible nodes | 37.2 / 204 | 44.5 / 253 |
| Gallery, Low: draw calls / visible nodes | 37.7 / 205 | 44.9 / 253 |

Reading: in a rift the totals are dominated by the map and the living monsters (the runs differ by 3–25 mobs), so the
rift difference is not attributable to the skills; the effect layers themselves add about 5–9 visible nodes and no
measurable draw calls. The controlled gallery A/B puts the new kit at +7 draw calls and +49 visible nodes per frame,
mostly the three flock ParticleContainers (main flock and Starling Shield's front and back halves, each a batch break);
drawing Starling Shield in one container is the next step if that must drop. Frame times are not reported as a
result: the machine ran two other agents' builds and tests during every run (17–47 ms per frame for both kits, also in
town); the gallery measured about 8 ms per frame for both kits on a quieter machine.

**Server tick** (`sim.ts perf`, interleaved head / 343a5d5, 6 runs each under the same background load): 4 players
+ 150 unkillable monsters, simulation only: head 1.91–4.09 ms (lowest 1.91), base 1.76–4.52 ms (lowest 1.76), so
about +9 % at the lowest and inside the noise otherwise; 4-player Torment III rift: head 0.26–0.28 ms, base 0.20–0.40 ms
per tick (the rift lasts 7:13 instead of 3:59 with the weaker ranger kit). These runs predate the Arbalest's pierce cap,
which cut the sim's L70 ranger rift from 0.59 to 0.14 ms per tick (warrior 0.24, mage 0.17). After the cap, 3 more
interleaved runs under heavier load: head 3.1–6.4 ms, base 2.4–5.3 ms (simulation only), 4-player rift 0.22–0.60 vs
0.34–0.81 ms (the rift now lasts 6:13). The sim's absolute check "tick avg < 3 ms" fails for both trees under that load
(it passed for both in the quieter runs above); it needs a quiet machine to judge.

**Snapshot bandwidth** (`scripts/perf-budget.ts`, deterministic): recorded baseline 81.5 KB/s per client, 343a5d5 88.5
(+8.6 %), this wave with the Arbalest piercing every enemy 96.2 (+18.1 %, over the +15 % gate: the Sentry kit's damage
events ×1.6), with the cap at 2 91.2 KB/s (+11.9 %; gate passes). The mage wave adds to the same budget.

**After merging claude/town-ui-rework 7faa331 (engine wave 3) and phase 2:**

* Snapshot bandwidth (perf budget, deterministic): merged base 88.5 KB/s per client (+8.6 % over the recorded 81.5), this
  branch 91.2 (+11.9 %; gate +15 %). Phase 2 adds no events to the budget scenario. Baseline not re-recorded.
* Pace (`bot-metrics.ts check 120`, targets not re-recorded): the merged base misses "L25+ champion TTK median 6.65 s
  > 6.4 s" (the ranger's 6.65 s is that median); this branch passes (ranger 4.45 s). Ranger A/B over 4 seeds
  (`sim.ts leveling 120`, the default seed + 3 offsets): L1–L10 unchanged; from L10 kills/min +29 / +27 / +4 / +29 %
  (L10 / L15 / L20 / L25 bands), champion TTK 8.4 → 6.6, 5.8 → 4.3, 4.8 → 4.3, 5.9 → 4.1 s; level after 120 minutes
  30.75 vs 28.75 on average, deaths 2 vs 7 in total. Damage with fixed level rares is identical at L15 / L20 / L25 (same
  per-skill breakdown against 8 targets), so the shift is inferred to come from the drops: legendaries drop 7–12 per hour
  from L5, and the ranger's pool holds 35 class legendaries instead of 5. The pass therefore partly hides the
  engine-side cause of the L25 miss; the mage's bands also move because its drop stream follows the ranger's.

## 9. Owner-visible changes

* Names: Hungering Arrow → **Tracking Arrow**, Cluster Arrow → **Burst Arrow**, Rain of Vengeance → **Arrowfall**, 13
  runes, the tier Squall Renewed. Saves keep the ids, so slotted skills, runes and tiers survive.
* Six new skills unlock at levels 16, 20, 26, 32, 40 and 50; the Skills window shows the ranger's categories (Shots,
  Volleys, Skyfall, Devices, Beasts) on two pages; eight new passives; specialization trees for all 12 skills.
* Multishot is Spender · Projectile · Piercing and no longer Area (items keyed to Area skills stop affecting it).
* The companion's bite now carries the skill's own damage multiplier (Beast sets and items reach it).
* Ranger endgame power drops as budgeted: set kit ×29 over rares (×348 before); the L70 set kit no longer clears Torment
  II in 12 minutes (57.1 %) until the Torment re-fit.
* Bolt-Thrower's Arbalest: Device projectiles pierce up to 2 enemies (the bible says "pierce"; capped for bandwidth, §8).
* Redesigned sets: existing Siegebreaker's Arsenal, Farwatch and Rainkeeper pieces get the new tag-keyed bonuses.
* Old rolls are rescaled when a save loads (owner decision via the lead): a Rainspindle rolled at 30–40 moves to the same
  place in 150–200 (35 → 175), an old Weathervane Ring or Bandolier Belt from 60–90 to 75–105 (60 → 75, 90 → 105).
  Idempotent, no save-version bump (`shared/src/legendaryRolls.ts`, golden fixture `v16-legacy-rolls`).
* Phase 2: four new tree nodes (Gut Hook, Wake, Tar Pit, Feather Storm), Tracker also moves you faster, Wingbeat Boots
  bring your beasts back after a dash, and Ripple, Flood Plain, Bloodhound and Weather Eye slow at the bible strengths.
* Sentries and the new device / beast summons play a short action pose when they fire (the hydra is excluded).
