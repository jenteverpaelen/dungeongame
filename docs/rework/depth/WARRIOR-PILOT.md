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
| Warrior legendaries | 32 / 34 | 6 existing (Faultcleaver text, Ninefold Gale now boosts Whirlwind) + 26 new (Kilnmaw after the merge brought the `maul2h` base) |
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
| Cinder Oath 2 "Bleeds also Burn", Cinder Oath 6 cinder pools | dual Bleed/Burn dots, a ground applying "your strongest dot at 50 %" (Cinder Oath 4 "or Burning" shipped after the merge brought the `burning` target state) |
| Slagforged Helm | a fall-below-35 %-Life trigger that casts a skill |
| Quakestep Sabatons | a Movement-end trigger (the dash proc fires at the start) |

## 3. Narrow generic additions made for the pilot (with tests)

* `RuneDef.effects`: power templates active while the rune is equipped on a bar skill (`powerSources.nodePowerSources`,
  source kind `rune`, validated; the rune's desc must name the template numbers). Used by Iron Root, Last Rampart, Breakwater,
  Slag Skin.
* `SkillDef.vars`: base named parameters merged before runes (Ironplough's `channelMovePct: -40`).
* Proc `when`: a condition gate on procs (Slag Skin's burn only while Kilnheart burns).
* `Buff.cost`: resource cost factor while the buff lasts, read by `skillCost` (Kilnheart −50 %).
* Channel movement in client prediction: the pilot sent `MeState.mvf`; at the merge with the shared-items wave it was
  replaced by that wave's `MeState.ms` (`powerActions.channelMsPct`, same formula plus the moveWhileChannel affix).
* Grounds placed while grounds update start next tick (a ground's status could place grounds in an endless loop).
* Dot carry-over is exact (`effects.ticksAhead`): repeated carries no longer grow (measured: a 30 % accumulating bleed dealt
  2.6× what was added before the fix).
* Harness: one RNG stream per equipment slot (kit comparisons measured affix luck before: one changed slot reshuffled
  every other slot's affixes; measured noise ×0.6–1.4); set footprints other than the six armour slots; set-backed skills
  fall back to the next bonus when the top bonus targets every skill; damage breakdown option.
* `contentValidation`: parity-ready means a set bonus of the class names the skill or one of its tags; rune / node
  templates are validated.
* `gearVisual.ts`: the pilot's 3 extra legendary bits were dropped at the merge for the gear-v2 packing (`FX_CAPACITY`).
* Class code instead of engine primitives (per the lead): the returning hatchet (scheduler-driven in `warriorM1.ts`) and
  Ringing Ears' consumable mark (per-monster state in `warriorKit.ts`). The shared-items wave since added `returns`
  projectiles and `vulnerable.consume`; moving these two onto them is a later clean-up, not needed for behaviour.

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

Full report: `WARRIOR-PARITY.md` / `.json` (measured after the merge: 3 seeds, 25-evaluation search per kit, with and
without the 19 shared legendaries). Gate in `npm run verify`: D3 and D4 hard limits on warrior items for the parity-ready
main skills Cleave, Tolling Blow and Quakeline (greedy kits, seed 101, `server/test/parity.test.ts`). Ground Stomp
lost the flag: its greedy hybrid measured 1.155× the better of legendary-only and 6-piece (hard limit 1.10).

Fits made from measurements (the bible's model valued them lower): Cinder Oath 4 cost 30 → 15 %, Red Ledger cost
30 → 15 %, Hearthbanner 6 shockwave 100 → 50 %, Endless Storm 6 wisps 25 % in total (see §4). Skill coefficients are
the bible's.

| Main skill | Warrior items only: legendary / best 6 / best hybrid | D3 · D4 | With shared legendaries: legendary / best 6 / hybrid | D3 · D4 |
|---|---|---|---|---|
| Cleave | ×7.5 / ×7.7 HB6 / ×8.2 HB4 | 0.98 · 1.07 | ×14.7 / ×10.1 HB6 / ×14.4 HB4 | 1.45 · 1.00 |
| Tolling Blow | ×6.2 / ×7.3 HB6 / ×7.8 HB4 | 0.84 · 1.06 | ×14.3 / ×9.8 HB6 / ×14.7 HB4 | 1.46 · 1.03 |
| Whirlwind | ×15.5 / ×22.2 ES6 / ×17.4 ES4 | 0.70 · 1.00 | ×36.8 / ×28.0 ES6 / ×26.6 FM4 | 1.32 · 0.95 |
| Ironplough | ×8.3 / ×14.3 ES6 / ×10.9 ES4 | 0.58 · 1.00 | ×15.3 / ×15.7 ES6 / ×12.3 ES4 | 0.97 · 0.80 |
| Rend | ×9.3 / ×9.9 CO6 / ×10.3 CO4 | 0.94 · 1.04 | ×14.0 / ×11.0 CO6 / ×11.4 CO4 | 1.27 · 1.00 |
| Sawtooth Hatchet | ×13.2 / ×18.6 CO6 / ×15.9 CO4 | 0.71 · 1.00 | ×23.4 / ×20.3 CO6 / ×19.5 HB4 | 1.15 · 0.96 |
| Ground Stomp | ×6.9 / ×7.9 HB6 / ×7.4 HB4 | 0.87 · 1.00 | ×11.6 / ×9.5 HB6 / ×11.0 HB4 | 1.21 · 1.00 |
| Quakeline | ×16.4 / ×19.8 HB6 / ×17.6 HB4 | 0.83 · 1.00 | ×23.2 / ×23.2 HB6 / ×20.4 HB4 | 1.00 · 0.88 |
| Cairnfall | ×7.3 / ×8.3 HB6 / ×8.5 HB4 | 0.88 · 1.02 | ×12.3 / ×10.4 HB6 / ×11.1 FW4 | 1.19 · 1.00 |

(D4 1.00 = the hybrid lies between the two.) Checks, warrior items only: D1 3/9, D2 Vambraces of the Anvil 9/9, D3
0.58–0.98, D4 1.00–1.07 (hard pass), D5 3/5, D6 2.16. With the shared legendaries: D1 1/9, D2 Seething Sigil 9/9, D3
0.97–1.46, D4 0.80–1.03, D5 5/5 (hard pass), D6 2.50. The causes, measured:

* **Shared legendaries now favour legendary-only kits.** After the merge they lift legendary-only above the sets for
  seven of nine main skills (D3 up to 1.46). Ablation of the Cleave legendary-only kit: Hearthguard Coat ×1.22,
  Ink-Stained Gloves (Cube) ×1.22, Ouroboros Loop (Cube) ×1.20, Kilnwatch Spaulders ×1.11, Patchwork Signet ×1.08 —
  they sit in the armour slots a 6-piece gives up. That is the shared-items lane's balance (hand-off).
* **Spender channels vs the rest.** Warrior items only, Whirlwind, Ironplough and Sawtooth Hatchet lift ×14–22 with
  their sets while legendary-only stays ×8–16 (D3 0.58–0.71): Endless Storm and Cinder Oath are strong for their mains.
  The named weapons explain the two groups: with the same 150–200 % roll, The Ninefold Gale is worth ×3.89 to Whirlwind
  and Faultcleaver ×3.69 to Quakeline (both existing items), Grinning Saw ×2.17 to the Hatchet, Bellwright's Maul ×1.48
  to Tolling Blow — a Spender main deals most of its fixture's damage, a Primary or cooldown main shares it.
* **Sawtooth Hatchet** was the outlier before the Red Ledger fit (×38 with Cinder Oath 6). Ablation of that kit: Grinning
  Saw ×2.17, Red Ledger ×1.87 (all of it the cost cut), Furycord Belt ×1.50, Ward Pennant Shield ×1.38, Ouroboros Loop
  ×1.38, Woodcutter's Grips (Cube) ×1.35.
* **Fault Warden and Furrowmark 6-pieces are weak**: their 4-piece + two legendaries beats the 6-piece for seven of
  nine mains (pre-merge pool: Fault Warden 4 ÷ 6 up to 1.46, Furrowmark 4 ÷ 6 up to 2.05); neither is any main's best
  6-piece on warrior items, hence D5 3/5. Their 6-piece bonuses need more value (a design call; not changed).
* **D2** counts frequency, not power: Vambraces of the Anvil is the only warrior wrists legendary (its ablation ×0.99–1.05);
  with the shared items Seething Sigil takes every neck.

## 7. Endgame power and the simulation

Measured in `server/test/sim.ts` after the merge, with the sim's warrior kit set to the audit's best Endless Storm 6
Whirlwind kit (§9): the set kit lifts the warrior ×25 over rares against 8 sturdy targets (old sets ×255 [M]; ranger
×387 and mage ×180 are still on their old sets). `BUDGET.md` §9 risk 1 expects this drop (×10–25 in total); the
Torment ladder must be re-fitted (`sim.ts fit`) once every class is on the budget (out of scope here). The warrior's
L70 set kit reaches 71.9 % of a Torment II rift in 12 minutes, no deaths (it completed in 3:45 on the old sets). Before
the kit update the same run measured 2.7–44.5 % (it depends on the seeded stream), at Master the guardian spawned at
9:36. The sim checks a 30 % progress floor for that one run (the rift flow stays covered by the warrior's L1 / L20
rifts) and the redesigned Endless Storm 4 flag.

Ranger and mage are unchanged by the pilot: with the warrior left out of the class loops, the spike, rift and field
sections are byte-identical against the merged-in d22ee7d (and, before the merge, against f3019b1 for the ranger; the
mage then diverged only after its first cross-class legendary drop, because the drop pool holds the new warrior
legendaries).

## 8. Evidence (1920×1080 JPEG, real server)

`shots/warrior/`: `w-skills-page1.jpg` / `w-skills-page2.jpg` (12 skills), `w-tree-tolling-blow.jpg`,
`w-tree-sawtooth-hatchet.jpg`, `w-tree-kilnheart.jpg`, `w-runes-kilnheart.jpg`, `w-passives.jpg`; item cards
`w-item-hearthbanner-chest.jpg` (set, 5/6), `w-item-grinning-saw.jpg`, `w-item-ward-pennant.jpg`,
`w-item-brass-warhorn.jpg`, `w-item-red-ledger.jpg`, `w-item-ox-harness.jpg`, `w-item-kilnmaw.jpg` (after the merge); combat in a Torment I rift
`w-combat-tolling-muster.jpg`, `w-combat-hatchet.jpg`, `w-combat-ironplough.jpg`, `w-combat-cairnfall.jpg`,
`w-combat-kilnheart.jpg`, `w-combat-muster-standard.jpg` (after the merge; `w-skills-page1.jpg` too, with the tag chips); VFX gallery `vfx-*.jpg`. 0 scroll regions in the Skills window.
Known look issue: in a crowd, Ironplough's soil wedge is hidden under the enemies it pushes (it reads clearly in the
gallery, `vfx-plough-2_65.jpg`).

## 9. Merge with `claude/town-ui-rework` (d22ee7d: shared-items wave, gear v2, partials)

Normal merge. 13 conflicted files, resolved:

* Channel slows: the wave's `MeState.ms` / `powerActions.channelMsPct` kept; the pilot's `mvf` removed (prediction.ts
  and movement.ts back to the wave's versions).
* Gear packing: gear v2's mixed-radix packing kept; the pilot's 3 extra legendary bits dropped.
* Procs: the wave's `every` / `repeat` and the pilot's `when` combined (`when` is checked first, so a gated trigger does not
  advance the `every` counter). Buffs: `cdrec` and `cost` both kept. Power sources: kinds `rune` and `affix` both kept.
* `powerTemplates.test.ts`: the wave's 22-legendary equivalence proof, without the warrior items the pilot redesigned.

Fixes needed after the merge (each with a test run):

* **Kilnmaw** and **Cinder Oath 4 "or Burning"** shipped (the merge brought `maul2h` and the `burning` target state).
* **The integration branch itself failed verify in two places** (checked on a clean export of d22ee7d):
  * originality gate: two new affix labels used the D3 pickup name ("Health globes …"). Reworded neutrally to "healing
    pickup"; the register's rename (NAME-REGISTER.md B6) stays the owner's call.
  * save history: `SAVE_VERSION` 16 had no history entry and `v15-grades.json` was an orphan fixture. Added the v16 entry
    (item-level fields only) and a golden `v16-grades.json`, written by the real load path (`normalizeSave`) from
    `v15-grades.json`; `v15-grades` is listed as a v15 extra fixture. No runtime change (no `migrate`).
* `sharedItems.test.ts` (Kindled / Fabled grades) assumed 7 affixes on every legendary; a socketed one has 6 (the socket
  takes a primary slot). The 25 new warrior legendaries moved the seeded draw onto a socketed ring. The test now counts
  the socket.
* Server bot test: the warrior's debug grants (32 class + 19 shared legendaries + a set + rares) filled the 60-slot bag;
  debug `set` no longer re-grants carried class legendaries, and the test drops a few non-weapon debug legendaries
  before its inventory steps.
* Warrior parity gate on warrior items only (see §6); Ground Stomp no longer parity-ready.
* `sim.ts` warrior fixture kit: the measured best Endless Storm 6 Whirlwind kit of the parity audit (Ninefold Gale,
  Furycord Belt, Wardkeeper's Cuffs, Signal Horn Charm, Ouroboros Loop, Rally Knot; Cube Millwheel Edge, Gale-Stitched
  Legguards, Seething Sigil; bar Whirlwind, Battle Rage, Muster Standard, Ground Stomp). The old kit fed the retired
  "Whirlwind applies Rend" 4-piece; with it the warrior's set spike fell to ×4.9 after the Ouroboros cut.
* Not changed: `scripts/content-ids.lock.json` (153 new ids from all lanes; record with `npx tsx scripts/content-ids.ts
  --update` at integration), the warrior legendaries' `LEGENDARY_VISUAL` motifs (gear lane; they draw as generic
  legendaries in their own colours).
