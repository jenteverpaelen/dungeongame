# Warrior pilot — what shipped, what is still blocked, deviations (branch `claude/warrior`)

Implements `WARRIOR.md` (bible v2) on the depth foundation and engine wave 2. Labels: **[M]** measured in this repo,
**[P]** proposal (a number chosen here, to be re-fitted by playtests), **[B]** taken from the bible.

## 1. Shipped

| What | Count | Notes |
|---|---|---|
| Skills | 12 / 12 | 6 existing + Tolling Blow (16), Sawtooth Hatchet (20), Muster Standard (26), Ironplough (32), Cairnfall (40), Kilnheart (50) |
| Runes | 60 / 60 | runes 4–5 of the existing skills at skill + 14 / + 20 [B] |
| Specialization nodes | 68 / 72 | 204 ranks; every tree holds 12–18 ranks for a cap of 10 |
| Passives | 11 (6 kept + 5 of 8 new) | Bellwether, Open Veins, War Drummer, Deep Earth, Second Wind |
| Sets | 5 / 5 | Endless Storm, Cinder Oath, Fault Warden redesigned on tags; Furrowmark and Hearthbanner new |
| Warrior legendaries | 31 / 34 | 6 existing (Faultcleaver text, Ninefold Gale now boosts Whirlwind) + 25 new |
| Data grounds | 7 | `shared/src/data/groundsWarrior.ts` |
| Point economy | `SPEC_POINTS = { separate, 1/level from 21, cap 10 }` | 50 points at 70 = the five active trees |
| Names | `NAMES.md` recommendations | Seismic Slam → **Quakeline**; 10 rune renames; ids unchanged |
| Tags | every warrior skill and rune per `ITEMS-SHARED.md` §1.2 | Spender authored on the channels, Cooldown on Muster Standard |

Code: data `shared/src/data/skills/warrior.ts`, `shared/src/data/powers/warrior.ts`, `shared/src/data/passives/warrior.ts`,
`shared/src/data/groundsWarrior.ts`; behaviour `server/src/sim/skills/warrior.ts` (existing six), `warriorM1.ts` (the six
new), `warriorKit.ts` (per-player / per-monster warrior state, the warrior hit wrapper, stuns, displacement, Fury
spending, the death hook); client VFX `client/src/render/vfx/*`, poses `client/src/render/actions.ts` +
`art/choreo.ts` / `art/player.ts`, icons `client/src/ui/panels/skillicons.tsx` + `ui/hud/Glyphs.tsx`, sounds
`client/src/audio/bank.ts`. Tests `server/test/warrior.test.ts` (18), parity gate `server/test/parity.test.ts`, harness
`server/test/parity/warrior.ts`, report `scripts/audit-warrior-parity.ts` → `WARRIOR-PARITY.md`.

New legendaries and set pieces drop through normal loot (the class pools are data; test "loot drops"); debug `legendaries`
grants every class legendary, debug `set` every set (`{ id }` limits it to one set's pieces, so they fit the bag).

## 2. Still blocked (needs an engine primitive)

| Content | Missing primitive |
|---|---|
| Muster Standard N4 Hold the Line (slow 10/20/30 %), Cairnfall N3 Quarry Dust (20/35/50 %) and N6 Capstone (needs N3) | slow of a chosen strength (chill is a fixed 40 % [M]) |
| Ironplough N6 Brace, Furrowmark 4 "30 % less damage from enemies in front while channelling" | directional damage reduction |
| Spinning Top (passive) | movement speed from a buff (channel-time stacks are class code; the speed part is not) |
| Grudge Holder (passive) | an elite filter on the takeDamage trigger |
| Iron Discipline (passive) | turning Fury decay off |
| Cinder Oath 2 "Bleeds also Burn", Cinder Oath 4 "or Burning", Cinder Oath 6 cinder pools | dual Bleed/Burn dots, a `burning` target state, a ground applying "your strongest dot at 50 %" |
| Slagforged Helm | a fall-below-35 %-Life trigger that casts a skill |
| Quakestep Sabatons | a Movement-end trigger (the dash proc fires at the start) |
| Kilnmaw | the `maul2h` base (shared-items wave) |

## 3. Narrow generic additions made for the pilot (with tests)

* `RuneDef.effects`: power templates active while the rune is equipped on a bar skill (`powerSources.nodePowerSources`,
  source kind `rune`, validated; the rune's desc must name the template numbers). Used by Iron Root, Last Rampart, Breakwater,
  Slag Skin.
* `SkillDef.vars`: base named parameters merged before runes (Ironplough's `channelMovePct: -40`).
* Proc `when`: a condition gate on procs (Slag Skin's burn only while Kilnheart burns).
* `Buff.cost`: resource cost factor while the buff lasts, read by `skillCost` (Kilnheart −50 %).
* Channel movement in client prediction: `MeState.mvf` + shared `channelMsPct` (server and client use the same formula).
* Grounds placed while grounds update start next tick (a ground's status could place grounds in an endless loop).
* Dot carry-over is exact (`effects.ticksAhead`): repeated carries no longer grow (measured: a 30 % accumulating bleed dealt
  2.6× what was added before the fix).
* Harness: one RNG stream per equipment slot (kit comparisons measured affix luck before: one changed slot reshuffled
  every other slot's affixes; measured noise ×0.6–1.4); set footprints other than the six armour slots; set-backed skills
  fall back to the next bonus when the top bonus targets every skill; damage breakdown option.
* `contentValidation`: parity-ready means a set bonus of the class names the skill or one of its tags; rune / node
  templates are validated.
* `gearVisual.ts`: the packed legendary index takes 3 more bits (more than 31 legendaries). Superseded by the gear-v2
  packing rewrite (`FX_CAPACITY` ≥ 160) when that merges — take theirs.
* Not built (class code instead, per the lead): the returning hatchet (scheduler-driven in `warriorM1.ts`), Ringing Ears'
  consumable mark (per-monster state in `warriorKit.ts`).

## 4. Deviations from the bible (and why)

| Where | Bible | Shipped | Why |
|---|---|---|---|
| Tiers of the six new skills | none authored | 3 tiers each, patterned on the class's existing tiers [M] (+20–30 % damage, −20 % cost or cooldown, +25–50 % radius / duration) | every skill has three tiers (ITEMS-SHARED §0); names original |
| Cinder Oath 4 | Bleed and Burn skills cost 30 % less | 15 % | measured ×2.2 on Sawtooth Hatchet (a Fury-limited Spender turns a cost cut into casts 1 : 1/(1−x)); the model valued it ×1.25 |
| Red Ledger | Bleed skills cost 30 % less | 15 % | measured ×1.89 for the cut alone on Sawtooth Hatchet with Cinder Oath 6 (cost cuts add up: 1 / (1 − 0.45)); same rule as Cinder Oath 4 |
| Hearthbanner 6 | shockwave 100 % weapon damage | 50 % | measured ×1.2 on Cleave for the transform alone, above BUDGET R1's ×1.10 |
| Endless Storm 6 wisps | "wisps deal 25 % of your channel's damage" | the three wisps alive together | per wisp it measured ×1.75 |
| Grinning Saw | "returns twice (three passes)" | thrown again when it returns; each enemy hit at most three times | the model's value (×1.3 = one more pass on the same enemies) |
| Quakeline Bedrock Pace, Woodcutter's Grips | "costs X less" / "cost no Fury" | a refund as the cast resolves | the cost is read before the cast (generic brain); text says refund |
| Ward Pennant Shield | "you and allies inside" | you only | no party bonus inside grounds |
| Brass Warhorn Helm | "Primary and Strike skills attack faster" | Primary skills | channel ticks have a fixed rate; attack speed reaches primaries only |
| Iron Root | "cannot be knocked back" | "cannot be pulled" | the engine's control immunity covers stun / freeze / pull (players are not knocked back) |
| Slag Skin | melee attackers burn | every attacker burns | the takeDamage trigger does not know melee from ranged |
| Deep Earth | slows by 30 % | chills (40 %) | one fixed chill |
| Last Rampart | once per standard, 1 Life | once every 20 s (the standard's cooldown), 1 % Life | time cooldown only; the text-check needs the number |
| Stone Spray | range 300 | ≈ 250 | `spawnProj` caps flight at the skill range + 2 × player radius |
| Hot Blood | uncapped | at most 4 heals per second [P] | as Red Draw [M]; uncapped it heals per Whirlwind tick |
| Ringing Ears | consumed on the next hit | consumed, or after 8 s [P] | stale marks forever otherwise |
| Fault Warden 6 / Furrowmark 6 | proc on any stun / displacement | class code for stuns / displacement your skills apply; a furrow at most once per enemy per second [P] | the grounds' own stuns and pulls re-triggered the proc in a loop |
| Muster Standard | "allies" | every other player in the instance | the simulation has no party; D3 shouts are party-wide |
| Parity fixtures | main + the support the paper search found | main + Battle Rage + Muster Standard + a stun cooldown | in the sim a second Spender took the main skill's Fury (Sawtooth Hatchet dealt 88 % of a "Cleave" kit) |

New [P] numbers without a bible value: hatchet speed 760 units/s (= the split-shard speed [M]); fault line / furrow length
160, tremor radius 120 (the engine fixtures); `maxPerOwner` 4–8 on warrior grounds.

## 5. Events (client contract)

`aoe` variants: `tollblow`, `toll`, `hatchet` / `hatchet3` (`r` out distance, `d` hold ms, `a` angle; speed
`WARRIOR_FX.hatchetSpeed`), `hatchet_seek`, `standard` / `standard_carry` / `standard_end` / `standard_pulse`, `plough`
(`d` = ramp level 0–5), `sod`, `cairn` (`d` = stay ms), `cairn_pulse`, `ember_trail`, `tremor_ring`, `aftershock`,
`kiln_breath`, `hearth_shock`, data grounds `quake_crack` / `tremor` / `fault_line` / `furrow` (`a` = line angle, `r` =
half width). `tele cairn` (`d` = ms to impact); `beam splinter`; `proj stone`. Known client gaps: a hero who comes into view
mid-Ironplough spins until the next cast (the channel skill is not in the snapshot); the crack line is drawn at its data
length, not the fissure's.

## 6. Parity

Full report: `WARRIOR-PARITY.md` / `.json` (measured: 3 seeds, 25-evaluation search per kit, with and without the
six shared legendaries). Gate in `npm run verify`: D3 and D4 hard limits for the parity-ready main skills (Cleave,
Tolling Blow, Ground Stomp, Quakeline) on the greedy kits, seed 101 (`server/test/parity.test.ts`).

Fits made from measurements (the bible's model valued them lower): Cinder Oath 4 cost 30 → 15 %, Red Ledger cost
30 → 15 %, Hearthbanner 6 shockwave 100 → 50 %, Endless Storm 6 wisps 25 % in total (see §4). Skill coefficients are
the bible's.

The searched audit still fails D1, D2, D3, D4 and D6 (D5 hard passes). The causes, measured:

* **Shared legendaries in the free slots.** Without the six shared legendaries, D3 and D4 pass for every parity-ready
  skill; with them, 4-piece hybrids beat the 6-pieces by 10–16 % (Tolling Blow, Ground Stomp, Cairnfall). The shared
  items are the shared-items wave's to retune.
* **Sawtooth Hatchet was the outlier** (×38 with Cinder Oath 6 before the Red Ledger fit, ×26.8 after; still the class
  best, with Quakeline ×22.6 and Whirlwind ×21.9, so D1 is 3/9 and D6 1.97). Ablation of the ×38 kit
  (each legendary replaced by the rare): Grinning Saw ×2.17, Red Ledger ×1.87 (all of it the cost cut), Furycord Belt
  ×1.50, Ward Pennant Shield ×1.38, Ouroboros Loop ×1.38, Woodcutter's Grips (Cube) ×1.35.
* **Two groups of main skills** by item lift: ×10–14 (Cleave, Tolling Blow, Rend, Ground Stomp, Cairnfall) and ×17–23
  (Whirlwind, Ironplough, Quakeline). The named weapons explain most of it: with the same 150–200 % roll, The Ninefold
  Gale is worth ×3.89 to Whirlwind and Faultcleaver ×3.69 to Quakeline (both existing items), Bellwright's Maul ×1.48
  to Tolling Blow — a Spender main deals most of its fixture's damage, a Primary or cooldown main shares it with the
  cooldowns. Fitting this is a design choice (weapon values per skill role), not a tuning error.
* **Vambraces of the Anvil** is in every top kit (D2): it is the only warrior wrists legendary and "stunned enemies take
  more damage" applies to every fixture (each has a stun cooldown).

## 7. Endgame power and the simulation

The bible's sets lift the warrior ×10 over rares against 8 sturdy targets [M] (old sets ×255 [M]; ranger ×279 and mage
×142 are still on their old sets). `BUDGET.md` §9 risk 1 expects this drop; the Torment ladder must be re-fitted
(`sim.ts fit`) once every class is on the budget (out of scope here). Measured in `server/test/sim.ts`: the warrior's
L70 set kit reaches 44.5 % of a Torment II rift in 12 minutes (was 3:45 to complete); at Master the guardian spawns at
9:36. The sim now checks a 30 % progress floor for that one run (the rift flow stays covered by the warrior's L1 / L20
rifts) and the redesigned Endless Storm 4 flag.

Ranger and mage are unchanged: with the warrior left out of the class loops, the field, set-spike and rift
sections are byte-identical for the ranger against the merge parent f3019b1; the mage is identical until its first
cross-class legendary drop (the shared drop pool now holds 25 more warrior legendaries, so the seeded stream diverges:
rift Torment II 4:48 → 4:52).

## 8. Evidence (1920×1080 JPEG, real server)

`shots/warrior/`: `w-skills-page1.jpg` / `w-skills-page2.jpg` (12 skills), `w-tree-tolling-blow.jpg`,
`w-tree-sawtooth-hatchet.jpg`, `w-tree-kilnheart.jpg`, `w-runes-kilnheart.jpg`, `w-passives.jpg`; item cards
`w-item-hearthbanner-chest.jpg` (set, 5/6), `w-item-grinning-saw.jpg`, `w-item-ward-pennant.jpg`,
`w-item-brass-warhorn.jpg`, `w-item-red-ledger.jpg`, `w-item-ox-harness.jpg`; combat in a Torment I rift
`w-combat-tolling-muster.jpg`, `w-combat-hatchet.jpg`, `w-combat-ironplough.jpg`, `w-combat-cairnfall.jpg`,
`w-combat-kilnheart.jpg`; VFX gallery `vfx-*.jpg`. 0 scroll regions in the Skills window.
Known look issue: in a crowd, Ironplough's soil wedge is hidden under the enemies it pushes (it reads clearly in the
gallery, `vfx-plough-2_65.jpg`).
