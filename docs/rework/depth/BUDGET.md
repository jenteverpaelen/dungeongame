# Parity budget — set kit vs legendary-only kit vs hybrid (M1 proposal)

Everything here is a **proposal [P]** for the parity harness to confirm (plan §3.1: the best legendary-only kit within
1.25× of the set kit, a hybrid between them). It is a *paper model*: it multiplies the game's real damage buckets with
estimated uptimes and behaviour values; it does not simulate combat. The model is `budget-model.mjs` in this folder
(plain Node, imports nothing from the game): `node docs/rework/depth/budget-model.mjs` prints every number below;
`SIX`, `CSIX`, `MS`, `GS` environment variables reproduce the sensitivity sweeps. Labels: **[M]** read in this repo,
**[P]** proposal, **[inferred]** arithmetic on the above.

## 1. Answer in one paragraph

Cap the 6-piece at a **transform plus ×1.25 own-bucket multiplier (×1.35 while a condition holds; hard cap ×1.3
effective)**, move the rest of a set's value into its 2- and 4-piece (≈×1.5–1.7 together), keep a whole set at most
**×2.5** per skill, give every skill three legendaries spread over weapon / set-footprint / jewelry-belt-bracer slots,
add the **skillMore** template (25–40% own-bucket, conditional) so legendaries can stack multiplicatively like set
bonuses, keep skill-signature weapons at today's +150–200% additive, and add one shared **no-set** ring (2–3% per
equipped legendary). With those numbers every one of the 15 set archetypes lands at **legendary/set = 0.85–1.20** and
every hybrid sits between the two (or within 5%). At ×1.4 sets already break the window (0.76); at ×1.15 legendaries
break it (1.31).

## 2. How the game combines bonuses today [M]

`server/src/sim/damage.ts baseMult()`:
`coef × (1 + main/100) × (1 + skillPct/100) × (1 + ele/100) × (1 + (dmgPct + live.dmg)/100) × mult × tal × ouro`,
then crit, elite bonus and `vulnerability()` (stun / freeze / mark / black hole) in `rollDamage()`.

* **skillPct** (`playerctx.ts skillPct`) = rune + tier + legendary `dmg` + gear "+x% skill damage" (+ passive skill
  damage). Every legendary "+150–200% increased damage" today lands here, **added** to everything else in the bucket.
* **mult** (`Strike.mult`, `skillMult()`) is the "own bucket": the set 6-pieces (×8 Fallen Star, ×11 Siegebreaker at 4
  Sentries, ×22 Fault Warden, ×24 Glass Concord / Lantern Garden, ×30 Farwatch / Rainkeeper, ×51 Endless Storm, ×127
  Cinder Oath). Fallen Star's 4-piece adds `tal` = 1 + 0.5 per element (max ×3) on top.
* **Cube** (`stats.ts`): up to three extracted powers (weapon / armor / jewelry), each at the **maximum** roll; an
  equipped copy of the same power wins instead. **Ancient** multiplies affixes and weapon damage by 1.3 but not
  legendary values, so Ancient status does not move parity.

Why a set always wins today: with 1–2 legendaries per skill and all of them additive, a legendary kit lifts a skill by
about ×2–×3 [inferred: (100 + 100 + 175 + 200)/(100 + 100)], while a set multiplies by ×8–×127 *on top*. Additive powers
also dilute: the n-th +175% in a bucket that already holds +X% is worth only (X + 275)/(X + 100).

## 3. Proposed rules [P]

| # | Rule | Value | Evidence |
|---|---|---|---|
| R1 | 6-piece = **transform** (new behaviour; its own damage value ≤ ×1.10) + **own multiplier** | ×1.25 unconditional; ×1.35 while a condition holds (stunned, frozen, inside the storm, far away, Battle Rage up …); **hard cap ×1.3 effective** | sensitivity §5: window holds only for ×1.25–×1.30; D4 developers: sets should change how a build plays, not add huge multipliers [S, `REFERENCES.md` §4] |
| R2 | 2- and 4-piece carry most of the set | ≈×1.5–1.7 together (utility + one damage hook in the 4-piece) | hybrid arithmetic (below): a 4-piece hybrid beats the full set only if the 6-piece is worth no more than the 2nd and 3rd best freed legendaries (≈×1.3–1.4) |
| R3 | Whole set per skill | ≤ ×2.5 including transforms | all 15 sets checked in §4 (highest: Siegebreaker on Multishot ×2.48) |
| R4 | Legendary magnitudes | weapon signature +150–200% additive (unchanged anchor); primary/off-hand signature +100–150%; **skillMore 25–40%** (conditional; 6–8% per stack ×5; 15–30% per compounding pierce/skip); vulnerability 15–30%; cost/cooldown 15–40%; shared generic-bucket powers 15–25% with a condition | magnitudes anchored to existing items (`ITEMS-SHARED.md` §1); skillMore sweep §5 holds the window from ×0.5 to ×1.25 of the proposal |
| R5 | Slot spread per skill | one legendary in a weapon/off-hand slot, one in the standard set footprint, one in jewelry/belt/bracers | gives a legendary kit 3–6 relevant footprint powers to set against a set; three sets use the alternative footprint (belt + bracers) as a deliberate puzzle (`ITEMS-SHARED.md` §4) |
| R6 | No-set ring (Patchwork Signet) | 2–3% generic damage per equipped legendary, max 10, only with no set bonus | D3's own answer (Legacy of Nightmares ring set, later the Legacy of Dreams gem) [S/SN, `REFERENCES.md` §4]; worth ×1.00–×1.09 here (median ×1.07), so a legendary kit does not *need* it (column "without Signet") |
| R7 | Count stacking cap | at most **+2 maximum summons and +2 projectiles per skill from items and sets combined** (runes, tiers and passives excluded) | the model's three highest kits (Glass Concord, Lantern Garden, Packmaster) are all count stacks (§6) |

## 4. Results (default model)

Factors are *damage multipliers against the same archetype in a plain rare kit* (same level, no legendaries, no set,
no Cube). Hybrid = 4 set pieces + the best 2 freed slots. Window: 0.80 ≤ legendary/set ≤ 1.25.

| Archetype | Set kit | Hybrid (4 + 2 freed) | Legendary kit | Legendary kit without Signet | Leg / Set | Hybrid between? |
|---|---:|---:|---:|---:|---:|---|
| W-A Gyre | ×9.25 | ×9.49 (hands+legs) | ×10.03 | ×9.19 | 1.08 | yes |
| W-B Faultline | ×9.22 | ×9.11 (head+hands) | ×10.52 | ×9.84 | 1.14 | within 5% (0.99) |
| W-C Cinderblood | ×7.83 | ×8.16 (shoulders+hands) | ×9.41 | ×8.93 | 1.20 | yes |
| W-D Warcaller | ×10.96 | ×11.21 (chest+hands) | ×12.50 | ×11.45 | 1.14 | yes |
| W-E Ploughline | ×11.49 | ×11.42 (hands+wrists) | ×12.15 | ×11.18 | 1.06 | within 5% (0.99) |
| W-F Hatchetwind | – | – | ×11.67 | ×11.16 | – | – |
| R-A Siege | ×15.32 | ×14.47 (shoulders+chest) | ×15.04 | ×13.95 | 0.98 | within 5% (0.96) |
| R-B Farwatch | ×8.64 | ×8.84 (head+hands) | ×10.19 | ×9.46 | 1.18 | yes |
| R-C Stormwatch | ×8.50 | ×8.57 (head+hands) | ×8.43 | ×8.38 | 0.99 | within 5% (1.01) |
| R-D Packmaster | ×18.03 | ×16.07 (shoulders+hands) | ×15.37 | ×14.44 | 0.85 | yes |
| R-E Trapper | ×12.72 | ×12.83 (chest+hands) | ×15.06 | ×13.99 | 1.18 | yes |
| R-F Skipshot | – | – | ×12.90 | ×11.92 | – | – |
| M-A Starfall | ×12.46 | ×11.79 (head+hands) | ×11.17 | ×10.46 | 0.90 | yes |
| M-B Glass Concord | ×23.33 | ×23.96 (head+hands) | ×20.97 | ×19.82 | 0.90 | within 5% (1.03) |
| M-C Lantern Garden | ×21.97 | ×20.30 (head+hands) | ×19.33 | ×18.27 | 0.88 | yes |
| M-D Hoarfrost | ×13.93 | ×14.43 (chest+hands) | ×14.79 | ×14.78 | 1.06 | yes |
| M-E Hollowstar | ×11.93 | ×10.72 (hands+waist) | ×11.09 | ×10.39 | 0.93 | within 5% (0.97) |
| M-F Orrery | – | – | ×17.37 | ×16.42 | – | – |

Reading: every set archetype is inside the window; nine hybrids sit strictly between and six are within 5% of the nearer
kit. The three legendary-native archetypes land inside (Skipshot ×12.9, Orrery ×17.4) or just above (Hatchetwind ×11.7)
their class's set-kit range (warrior 7.8–11.5, ranger 8.5–18.0, mage 11.9–23.3), so "a full set of relevant
legendaries" is a real build.

**Worked example (W-A Gyre, Whirlwind only; the model does this for every skill and sums by damage share).**
Set kit: skill bucket (100 + 300)/(100 + 100) = 2.00 (Ninefold Gale in the Cube at its maximum +200%); generic
(100 + 39)/(100 + 25) = 1.112 (Hellforge 35 × 0.4 uptime); own ×1.65 = Gale-Stitched Legguards in the Cube
(1 + 5 × 8% × 0.8 = 1.32) × Endless Storm 6-piece 1.25; vulnerability ×1.162 (Surveyor's Plumb 35% × 0.35, Wardkeeper's
Cuffs 17.5% × 0.2); behaviour ×3.27 (Eternal Gyre cost 1.18 × Ouroboros 1.35 × Brine Tally 1.088 × Ninefold freeing the
rune 1.10 × set 2-piece 1.21 × 4-piece bleed 1.35 × 6-piece orbit 1.05) → 2.00 × 1.112 × 1.65 × 1.162 × 3.27 = **13.9**.
Legendary kit: 2.00 × (171/125 = 1.368, Hearthguard + Ridgewalker + Signet 25 + …) × 1.28 (Legguards equipped) × 1.47
(Tanner's, Watchkeeper's, Plumb, Cuffs) × 2.46 = **12.6**. Archetype totals: set 0.50 × 13.9 + 0.15 × 6.6 (Dust Devils)
+ 0.25 × 4.5 (Rend) + 0.10 × 1.9 (Cleave) = **9.25**; legendary kit = **10.03**; ratio 1.08.

## 5. Sensitivity

**6-piece own multiplier** (conditional value scaled with it):

| 6-piece | legendary/set min | max | hybrids between (±5%) |
|---|---:|---:|---|
| ×1.10 | 0.97 | 1.36 | 13 / 15 |
| ×1.15 | 0.93 | 1.31 | 14 / 15 |
| **×1.25** | **0.85** | **1.20** | **15 / 15** |
| ×1.30 | 0.82 | 1.15 | 15 / 15 |
| ×1.40 | 0.76 | 1.07 | 8 / 15 |
| ×1.60 | 0.67 | 0.98 | 8 / 15 |
| ×2.00 | 0.54 | 0.98 | 8 / 15 |

**Legendary skillMore magnitude** (×1.25 6-piece): scale 0.5 → 0.82–1.17 · 0.75 → 0.84–1.17 · **1.0 → 0.85–1.20** · 1.25 →
0.87–1.24 · 1.5 → 0.88–1.29. The window survives halving the new template, so the harness can start low.

**Shared generic-bucket legendaries** (`GS`): at half strength Packmaster drops to 0.77 (outside); zeroing them still
leaves 44 of 90 legendary-kit footprint picks on shared items, because the Patchwork Signet makes any legendary worth
wearing. See risk 2 in §8.

## 6. What the model changed in the content

These edits are already in the class documents:

1. **The Ninefold Gale** (existing item): its roll now applies to Whirlwind as well as Dust Devils. Without any
   Whirlwind-damage signature the Gyre archetype's kit factor was half the class's (×7 vs ×13–19 before the fix; ×9.3–10.0
   after, inside the class range). Owner-visible change to an existing item.
2. **Set bonuses** moved value from 6- to 2/4-pieces: Endless Storm 2-piece −25% Whirlwind cost and the 6-piece now covers
   all bleeds; Hearthbanner 4-piece +25% primary damage in the Standard; Furrowmark 4-piece +20% vs collision-stunned;
   Cinder Oath 4-piece +20% Cleave vs bleeding and a weaker cinder pool; Rainkeeper 4-piece cheaper Overcast and +15% inside
   the rain; Thicket Kin's +1 Companion moved from the 2- to the 4-piece; Snarewright 4-piece mortar targeting; Hoarfrost
   4-piece +20% vs frozen; Hollowstar 4-piece cheaper orb; Fallen Star star-signs +5% each (was +10% in the draft,
   ×1.5 multiplicative today); Siegebreaker 4-piece 25% (draft 35%, today 100%).
3. **Legendary ranges** cut where one item was worth more than a set piece: Thresher's Knot 0.05–0.1 s, Powder Horn
   0.3–0.5 s, Weathervane Ring 0.3–0.6 s, Bowyer's Gloves second volley 30%, Glasswright's Wraps pierce at 50%, Snowglobe
   Pendant 40–60% once per 6 s, Firekeeper's Gloves on all kin damage 25–35%, Conductor's Legwraps second blast at 50%,
   Clockmaker's Ring 15–20% / +2 s; Quartermaster's Cuirass became a conditional skillMore (25–35%).
4. **Shared generic legendaries** cut to 15–25% (they stack undiluted in the generic bucket); Patchwork Signet 2–3% per
   item (draft 3–4%).

## 7. Model assumptions (all [P]; the harness replaces them with measurements)

* Baselines: skill bucket +100% before legendaries (tiers ~25 + gear "+skill damage" ~45 + passive 12.5 + one node ~15
  [inferred from `items.ts` / `passives.ts` ranges]); generic bucket +25% (Battle Rage / Magic Weapon / Pack Leader);
  element bucket +15%. Equipped legendaries roll the middle of their range, Cube powers the maximum [M].
* Damage shares in a rare kit (e.g. Gyre: Whirlwind 50%, Dust Devils 15%, Rend 25%, Cleave 10%) are listed per archetype
  in `budget-model.mjs`; set effects and skill legendaries only touch their skills, shared powers touch all.
* Uptimes: stun 15–60% by archetype, bleed 80–95%, condition-based powers 0.2–0.9 as written next to each item in the
  model; area damage 20% × area% × 1.45 other enemies averaged over the audit's three encounters (6-pack, 3 champions,
  boss) [M: area is a 20% chance to splash area% to all others within 100].
* Behaviour values (extra summons, extra projectiles, cost and cooldown cuts) are converted to multipliers by simple
  rules (e.g. a 3rd summon on 2 = ×1.5; cost −r% on a resource-limited skill = ×(1 + 0.4r)); they are the weakest part of
  the model and the reason a sim must confirm.
* The optimiser is a local search with 120 restarts over 13 slots + 3 Cube slots, respecting two-hander/off-hand rules
  (warrior and mage two-handers block the off-hand; a ranger keeps the quiver [M]).
* **Invisible to the current harness:** Dash-driven powers (Quakestep Sabatons, Stridewind Greaves, Ridgewalker's
  movement) — the audit bot does not dash and only chases [M: `audit-item-builds.ts`]; "above 80% Life" powers
  (Hearthguard Coat) are always on with `debugInfiniteHp` [M]. Both need a harness variant.

## 8. Risks and open questions

1. **Endgame power drops.** Today's set kits carry ×8–×127; the new set kits are ×7.8–×23 *including* legendaries and
   Cube. Against today's P11 kits (set + one signature weapon, no Cube) that is roughly ×0.1–×1.0 on the main skill
   [inferred], about an order of magnitude lower for Endless Storm, Cinder Oath, Fault Warden, Farwatch, Rainkeeper,
   Glass Concord and Lantern Garden and about level for Fallen Star. The Torment ladder (BALANCE §7, fitted with the old
   sets) must be re-fitted (`sim.ts fit`, calibrate) after the change. Owner decision (plan §4 d): keep a deliberate
   "chase" multiplier for Primal-only sets, or not — the model says any 6-piece above ×1.3 breaks parity again.
2. **A universal "generic legendary kit".** In all 18 legendary kits the optimiser fills 4–6 of the six footprint slots
   with shared items (Watchkeeper's Hood, Kilnwatch Spaulders, Hearthguard Coat, Fists of the Mountain or Ink-Stained
   Gloves, Causeway Waders, Ridgewalker Boots); class footprint legendaries take the other 0–2 slots or the Cube. Parity holds, but diversity would be better served by a **second class footprint legendary per skill** (M2,
   ~36 more items) than by cutting the shared ones (which breaks Packmaster's parity at half strength).
3. **Count stacking** (R7): Glass Concord (+2 missiles item, +1 set, Echoing Bead), Lantern Garden (+1 Hydra item, +1 set,
   +1 tier, +1 passive) and Packmaster (+1 Companion bow, +1 set, +1 tier) are the three highest kit factors. Without the
   cap they will top their classes.
4. **Proc / cooldown stacking on Frost Nova** (Frostlocked Wand, Snowglobe Pendant, Rimecourt Band, Spellwright's Circlet)
   multiplies its casts ×8.5–×13.6 in the model; recommend a 2 s minimum cooldown for Frost Nova and an internal cooldown
   on Snowglobe Pendant that does not stack with the wand's second nova [P].
5. **Spread between archetypes** (kit factors 7.8–23 over rare) is not parity's job but the P11 class window's: after this
   change the nine-build audit must be re-run with legendaries and Cube, and skill coefficients (not set multipliers)
   tuned to the 1.25 class window.
6. **Hybrid tolerance.** The plan says a hybrid "must sit between"; the paper model can only resolve ±5%. Proposal: the
   harness criterion is `0.95 × min(set, legendary) ≤ hybrid ≤ 1.05 × max(set, legendary)`.

## 9. What the harness should measure (proposal for `audit-item-builds.ts` v2)

For each of the 15 set archetypes: (a) the set kit (6 pieces + best legendaries in the other slots + 3 Cube powers),
(b) the best legendary-only kit (with and without Patchwork Signet), (c) the best 4-piece hybrid; for the 3 legendary-
native archetypes (b) only. Same seeds, Torment level, Ancient status and encounter set as P11 (6-pack, 3 champions,
Gorgemaw), 48 tier points plus a fixed node allocation per archetype, mid-roll equipped legendaries, max-roll Cube.
Pass: legendary/set in [0.80, 1.25] and the hybrid rule above. Add a dashing bot variant and a mortal-HP variant for
the invisible powers in §7.

## Appendix — per-archetype arithmetic (model output)

Item ids are the snake_case of the item names; `*` = in the Cube (max roll). S = additive skill bucket (100 = the
rare-kit baseline), more = own-bucket product, beh = behaviour product, per-skill factor = (100+S)/200 ×
(100+generic)/125 × (100+element)/115 × more × vulnerability × beh.

#### W-A Gyre
* **Set kit (6)** ×9.25 — items: bloodwake, wardkeepers_cuffs_lo, eternal_gyre, hellforge_talisman, ouroboros_loop, brine_tally, ninefold_gale*, gale_stitched_legguards*, surveyors_plumb*. Generic 39% (base 25), vulnerability ×1.16. Per skill: whirlwind ×13.93 (S 300%, more ×1.65, beh ×3.27); dust_devil ×6.57 (S 300%, more ×1.65, beh ×1.54); rend ×4.45 (S 275%, more ×1.25, beh ×1.47); cleave ×1.90 (S 100%, more ×1.00, beh ×1.47).
* **Hybrid (4, hands+legs free)** ×9.49 — items: bloodwake, mountain_fists, wardkeepers_cuffs_lo, eternal_gyre, gale_stitched_legguards, hellforge_talisman, ouroboros_loop, brine_tally, ninefold_gale*, tanners_pauldrons*, surveyors_plumb*. Generic 39% (base 25), vulnerability ×1.39. Per skill: whirlwind ×13.97 (S 300%, more ×1.28, beh ×3.52); dust_devil ×6.59 (S 300%, more ×1.28, beh ×1.66); rend ×5.07 (S 275%, more ×1.00, beh ×1.74); cleave ×2.57 (S 100%, more ×1.00, beh ×1.66).
* **Legendary kit** ×10.03 — items: bloodwake, watchkeepers_hood, tanners_pauldrons, hearthguard_coat, mountain_fists, wardkeepers_cuffs_lo, eternal_gyre, gale_stitched_legguards, ridgewalker_boots, surveyors_plumb, patchwork_signet, brine_tally, ninefold_gale*, witching_cord*, ouroboros_loop*. Generic 71% (base 25), vulnerability ×1.47. Per skill: whirlwind ×12.64 (S 300%, more ×1.28, beh ×2.46); dust_devil ×9.73 (S 300%, more ×1.28, beh ×1.89); rend ×7.49 (S 275%, more ×1.00, beh ×1.99); cleave ×3.80 (S 100%, more ×1.00, beh ×1.89).

#### W-B Faultline
* **Set kit (6)** ×9.22 — items: cairnwrights_hammer, last_light, anvil_vambraces, witching_cord, hellforge_talisman, threshers_knot, brine_tally, faultcleaver*, fissure_lined_breastplate*, ouroboros_loop*. Generic 39% (base 25), vulnerability ×1.04. Per skill: seismic_slam ×10.25 (S 300%, more ×1.58, beh ×2.80); ground_stomp ×10.27 (S 325%, more ×1.24, beh ×3.35); cairnfall ×10.55 (S 275%, more ×1.24, beh ×3.90); tolling_blow ×1.99 (S 100%, more ×1.00, beh ×1.72).
* **Hybrid (4, head+hands free)** ×9.11 — items: cairnwrights_hammer, last_light, watchkeepers_hood, mountain_fists, anvil_vambraces, witching_cord, hellforge_talisman, threshers_knot, brine_tally, faultcleaver*, fissure_lined_breastplate*, ouroboros_loop*. Generic 39% (base 25), vulnerability ×1.15. Per skill: seismic_slam ×9.98 (S 300%, more ×1.27, beh ×3.07); ground_stomp ×10.01 (S 325%, more ×1.00, beh ×3.68); cairnfall ×10.27 (S 275%, more ×1.00, beh ×4.28); tolling_blow ×2.41 (S 100%, more ×1.00, beh ×1.88).
* **Legendary kit** ×10.52 — items: cairnwrights_hammer, last_light, watchkeepers_hood, kilnwatch_spaulders, fissure_lined_breastplate, mountain_fists, anvil_vambraces, witching_cord, causeway_waders, ridgewalker_boots, surveyors_plumb, patchwork_signet, threshers_knot, faultcleaver*, wardkeepers_cuffs_cc*, ouroboros_loop*. Generic 79% (base 25), vulnerability ×1.42. Per skill: seismic_slam ×10.45 (S 300%, more ×1.23, beh ×2.09); ground_stomp ×10.86 (S 325%, more ×1.00, beh ×2.51); cairnfall ×13.94 (S 275%, more ×1.00, beh ×3.65); tolling_blow ×3.53 (S 100%, more ×1.00, beh ×1.73).

#### W-C Cinderblood
* **Set kit (6)** ×7.83 — items: millwheel_edge, wardkeepers_cuffs_lo, witching_cord, hellforge_talisman, ouroboros_loop, brine_tally, bloodwake*, tanners_pauldrons*, surveyors_plumb*. Generic 39% (base 25), vulnerability ×1.39. Per skill: rend ×9.38 (S 300%, more ×1.25, beh ×2.42); cleave ×9.76 (S 275%, more ×1.49, beh ×2.26); sawtooth_hatchet ×3.12 (S 100%, more ×1.25, beh ×1.61).
* **Hybrid (4, shoulders+hands free)** ×8.16 — items: bloodwake, tanners_pauldrons, ink_stained_gloves, wardkeepers_cuffs_lo, witching_cord, hellforge_talisman, ouroboros_loop, brine_tally, millwheel_edge*, ashgrip_gauntlets*, surveyors_plumb*. Generic 39% (base 25), vulnerability ×1.35. Per skill: rend ×6.80 (S 275%, more ×1.00, beh ×2.42); cleave ×16.68 (S 388%, more ×1.62, beh ×2.82); sawtooth_hatchet ×2.41 (S 100%, more ×1.00, beh ×1.61).
* **Legendary kit** ×9.41 — items: millwheel_edge, watchkeepers_hood, tanners_pauldrons, hearthguard_coat, ink_stained_gloves, wardkeepers_cuffs_lo, witching_cord, causeway_waders, ridgewalker_boots, surveyors_plumb, patchwork_signet, brine_tally, bloodwake*, ashgrip_gauntlets*, ouroboros_loop*. Generic 83% (base 25), vulnerability ×1.47. Per skill: rend ×7.87 (S 300%, more ×1.00, beh ×1.84); cleave ×18.24 (S 363%, more ×1.36, beh ×2.71); sawtooth_hatchet ×3.57 (S 100%, more ×1.00, beh ×1.67).

#### W-D Warcaller
* **Set kit (6)** ×10.96 — items: bellwrights_maul, ward_pennant_shield, anvil_vambraces, witching_cord, hellforge_talisman, ouroboros_loop, brine_tally, kilnmaw*, ink_stained_gloves*, surveyors_plumb*. Generic 49% (base 25), vulnerability ×1.17. Per skill: tolling_blow ×15.56 (S 375%, more ×1.52, beh ×3.10); kilnheart ×7.00 (S 300%, more ×1.25, beh ×2.01); ground_stomp ×2.24 (S 100%, more ×1.00, beh ×1.61); muster_standard ×2.24 (S 100%, more ×1.00, beh ×1.61).
* **Hybrid (4, chest+hands free)** ×11.21 — items: bellwrights_maul, ward_pennant_shield, quartermasters_cuirass, mountain_fists, anvil_vambraces, witching_cord, surveyors_plumb, ouroboros_loop, brine_tally, kilnmaw*, ink_stained_gloves*, hellforge_talisman*. Generic 51% (base 25), vulnerability ×1.15. Per skill: tolling_blow ×16.02 (S 375%, more ×1.52, beh ×3.19); kilnheart ×6.31 (S 300%, more ×1.00, beh ×2.27); ground_stomp ×2.53 (S 100%, more ×1.00, beh ×1.82); muster_standard ×2.53 (S 100%, more ×1.00, beh ×1.82).
* **Legendary kit** ×12.50 — items: bellwrights_maul, last_light, watchkeepers_hood, belfry_pauldrons, quartermasters_cuirass, mountain_fists, anvil_vambraces, witching_cord, causeway_waders, ridgewalker_boots, surveyors_plumb, patchwork_signet, brine_tally, kilnmaw*, ink_stained_gloves*, ouroboros_loop*. Generic 70% (base 25), vulnerability ×1.27. Per skill: tolling_blow ×16.12 (S 375%, more ×1.25, beh ×3.12); kilnheart ×8.16 (S 300%, more ×1.00, beh ×2.36); ground_stomp ×7.63 (S 325%, more ×1.00, beh ×2.07); muster_standard ×3.26 (S 100%, more ×1.00, beh ×1.88).

#### W-E Ploughline
* **Set kit (6)** ×11.49 — items: bellwrights_maul, ward_pennant_shield, yoke_greaves, ridgewalker_boots, hellforge_talisman, ouroboros_loop, brine_tally, coulter_blade*, anvil_vambraces*, surveyors_plumb*. Generic 58% (base 25), vulnerability ×1.17. Per skill: ironplough ×13.93 (S 300%, more ×1.78, beh ×2.64); ground_stomp ×2.18 (S 100%, more ×1.00, beh ×1.47); tolling_blow ×4.90 (S 275%, more ×1.00, beh ×1.76).
* **Hybrid (4, hands+wrists free)** ×11.42 — items: bellwrights_maul, ward_pennant_shield, mountain_fists, anvil_vambraces, yoke_greaves, ridgewalker_boots, hellforge_talisman, ouroboros_loop, brine_tally, coulter_blade*, wardkeepers_cuffs_cc*, surveyors_plumb*. Generic 58% (base 25), vulnerability ×1.31. Per skill: ironplough ×13.39 (S 300%, more ×1.42, beh ×2.85); ground_stomp ×2.75 (S 100%, more ×1.00, beh ×1.66); tolling_blow ×6.18 (S 275%, more ×1.00, beh ×1.99).
* **Legendary kit** ×12.15 — items: bellwrights_maul, ward_pennant_shield, watchkeepers_hood, kilnwatch_spaulders, hearthguard_coat, mountain_fists, anvil_vambraces, witching_cord, yoke_greaves, ridgewalker_boots, surveyors_plumb, patchwork_signet, brine_tally, coulter_blade*, wardkeepers_cuffs_cc*, ouroboros_loop*. Generic 90% (base 25), vulnerability ×1.42. Per skill: ironplough ×13.11 (S 300%, more ×1.27, beh ×2.38); ground_stomp ×4.08 (S 100%, more ×1.00, beh ×1.88); tolling_blow ×9.18 (S 275%, more ×1.00, beh ×2.26).

#### W-F Hatchetwind
* **Legendary kit** ×11.67 — items: cairnwrights_hammer, watchkeepers_hood, tanners_pauldrons, hearthguard_coat, woodcutters_grips, wardkeepers_cuffs_lo, witching_cord, causeway_waders, ridgewalker_boots, surveyors_plumb, ouroboros_loop, patchwork_signet, grinning_saw*, mountain_fists*, sawyers_ring*. Generic 83% (base 25), vulnerability ×1.47. Per skill: sawtooth_hatchet ×16.32 (S 300%, more ×1.27, beh ×3.00); rend ×3.80 (S 100%, more ×1.00, beh ×1.78); cairnfall ×10.87 (S 275%, more ×1.00, beh ×2.71).

#### R-A Siege
* **Set kit (6)** ×15.32 — items: powderkeg_crossbow, sappers_pack, witching_cord, hellforge_talisman, ouroboros_loop, brine_tally, boltthrowers_arbalest*, gearwright_heart*, signal_horn_charm*. Generic 39% (base 25), vulnerability ×1.00. Per skill: sentry ×27.06 (S 335%, more ×1.78, beh ×6.28); multishot ×4.42 (S 100%, more ×1.32, beh ×3.01); cluster_arrow ×11.20 (S 275%, more ×1.32, beh ×4.07); pitch_mortar ×2.41 (S 100%, more ×1.35, beh ×1.61).
* **Hybrid (4, shoulders+chest free)** ×14.47 — items: powderkeg_crossbow, sappers_pack, huntsmans_pauldrons, gearwright_heart, witching_cord, hellforge_talisman, ouroboros_loop, brine_tally, boltthrowers_arbalest*, tarstained_jerkin*, signal_horn_charm*. Generic 39% (base 25), vulnerability ×1.00. Per skill: sentry ×26.49 (S 335%, more ×1.92, beh ×5.71); multishot ×3.35 (S 100%, more ×1.00, beh ×3.01); cluster_arrow ×8.48 (S 275%, more ×1.00, beh ×4.07); pitch_mortar ×2.92 (S 100%, more ×1.63, beh ×1.61).
* **Legendary kit** ×15.04 — items: powderkeg_crossbow, sappers_pack, watchkeepers_hood, huntsmans_pauldrons, gearwright_heart, mountain_fists, witching_cord, causeway_waders, ridgewalker_boots, surveyors_plumb, ouroboros_loop, patchwork_signet, boltthrowers_arbalest*, tarstained_jerkin*, signal_horn_charm*. Generic 70% (base 25), vulnerability ×1.22. Per skill: sentry ×28.02 (S 335%, more ×1.92, beh ×4.04); multishot ×2.78 (S 100%, more ×1.00, beh ×1.67); cluster_arrow ×7.03 (S 275%, more ×1.00, beh ×2.26); pitch_mortar ×4.54 (S 100%, more ×1.63, beh ×1.67).

#### R-B Farwatch
* **Set kit (6)** ×8.64 — items: hunters_mark, featherguard_cuffs, witching_cord, hellforge_talisman, ouroboros_loop, brine_tally, thunderhead*, hawkfeather_cap*, surveyors_plumb*. Generic 39% (base 25), vulnerability ×1.24. Per skill: hungering_arrow ×10.14 (S 250%, more ×1.53, beh ×2.75); multishot ×9.37 (S 300%, more ×1.28, beh ×2.65); companion ×2.22 (S 100%, more ×1.00, beh ×1.61).
* **Hybrid (4, head+hands free)** ×8.84 — items: hunters_mark, hawkfeather_cap, bowyers_gloves, featherguard_cuffs, witching_cord, hellforge_talisman, ouroboros_loop, brine_tally, thunderhead*, ink_stained_gloves*, surveyors_plumb*. Generic 39% (base 25), vulnerability ×1.24. Per skill: hungering_arrow ×10.93 (S 325%, more ×1.20, beh ×3.12); multishot ×8.98 (S 300%, more ×1.18, beh ×2.76); companion ×2.22 (S 100%, more ×1.00, beh ×1.61).
* **Legendary kit** ×10.19 — items: thunderhead, hawkfeather_cap, kilnwatch_spaulders, hearthguard_coat, bowyers_gloves, featherguard_cuffs, witching_cord, causeway_waders, ridgewalker_boots, surveyors_plumb, patchwork_signet, brine_tally, hunters_mark*, ink_stained_gloves*, ouroboros_loop*. Generic 91% (base 25), vulnerability ×1.24. Per skill: hungering_arrow ×13.53 (S 325%, more ×1.20, beh ×2.81); multishot ×9.08 (S 275%, more ×1.18, beh ×2.17); companion ×3.16 (S 100%, more ×1.00, beh ×1.67).

#### R-C Stormwatch
* **Set kit (6)** ×8.50 — items: highcloud_longbow, witching_cord, powder_horn, ouroboros_loop, raincount_ring, rainspindle*, squallcatcher_pauldrons*, weathervane_ring*. Generic 25% (base 25), vulnerability ×1.00. Per skill: rain_of_vengeance ×13.40 (S 100%, more ×1.57, beh ×8.52); overcast_volley ×7.49 (S 275%, more ×1.32, beh ×3.03); cluster_arrow ×2.06 (S 100%, more ×1.21, beh ×1.70).
* **Hybrid (4, head+hands free)** ×8.57 — items: highcloud_longbow, watchkeepers_hood, mountain_fists, witching_cord, powder_horn, ouroboros_loop, raincount_ring, rainspindle*, squallcatcher_pauldrons*, weathervane_ring*. Generic 25% (base 25), vulnerability ×1.10. Per skill: rain_of_vengeance ×13.83 (S 100%, more ×1.30, beh ×9.63); overcast_volley ×7.16 (S 275%, more ×1.09, beh ×3.17); cluster_arrow ×2.12 (S 100%, more ×1.00, beh ×1.92).
* **Legendary kit** ×8.43 — items: powderkeg_crossbow, watchkeepers_hood, squallcatcher_pauldrons, hearthguard_coat, mountain_fists, witching_cord, causeway_waders, fuseburnt_boots, surveyors_plumb, patchwork_signet, brine_tally, highcloud_longbow*, overcast_hood*, ouroboros_loop*. Generic 74% (base 25), vulnerability ×1.22. Per skill: rain_of_vengeance ×4.37 (S 100%, more ×1.24, beh ×2.07); overcast_volley ×11.59 (S 300%, more ×1.21, beh ×2.83); cluster_arrow ×10.51 (S 275%, more ×1.30, beh ×2.54).

#### R-D Packmaster
* **Set kit (6)** ×18.03 — items: starling_longbow, witching_cord, signal_horn_charm, ouroboros_loop, brine_tally, kennelwood_bow*, trailhide_breeches*, whistle_charm*. Generic 25% (base 25), vulnerability ×1.00. Per skill: companion ×32.13 (S 300%, more ×1.95, beh ×8.24); murmuration ×5.43 (S 275%, more ×1.25, beh ×2.32); hungering_arrow ×1.66 (S 100%, more ×1.00, beh ×1.66).
* **Hybrid (4, shoulders+hands free)** ×16.07 — items: starling_longbow, sappers_pack, huntsmans_pauldrons, mountain_fists, witching_cord, signal_horn_charm, ouroboros_loop, brine_tally, kennelwood_bow*, trailhide_breeches*, whistle_charm*. Generic 25% (base 25), vulnerability ×1.00. Per skill: companion ×28.45 (S 300%, more ×1.83, beh ×7.76); murmuration ×4.91 (S 275%, more ×1.00, beh ×2.62); hungering_arrow ×1.87 (S 100%, more ×1.00, beh ×1.87).
* **Legendary kit** ×15.37 — items: starling_longbow, sappers_pack, watchkeepers_hood, huntsmans_pauldrons, hearthguard_coat, mountain_fists, witching_cord, trailhide_breeches, ridgewalker_boots, signal_horn_charm, ouroboros_loop, patchwork_signet, kennelwood_bow*, causeway_waders*, whistle_charm*. Generic 84% (base 25), vulnerability ×1.10. Per skill: companion ×25.38 (S 300%, more ×1.78, beh ×4.40); murmuration ×7.13 (S 275%, more ×1.00, beh ×2.34); hungering_arrow ×2.71 (S 100%, more ×1.00, beh ×1.67).

#### R-E Trapper
* **Set kit (6)** ×12.72 — items: riverstone_repeater, mortarmans_pack, causeway_waders, ridgewalker_boots, surveyors_plumb, ouroboros_loop, brine_tally, tripline_crossbow*, coiled_wire_bracers*, signal_horn_charm*. Generic 45% (base 25), vulnerability ×1.10. Per skill: spring_snare ×19.95 (S 300%, more ×1.68, beh ×4.62); pitch_mortar ×8.09 (S 135%, more ×1.68, beh ×3.19); skipstone_bolt ×5.26 (S 225%, more ×1.24, beh ×2.03).
* **Hybrid (4, chest+hands free)** ×12.83 — items: riverstone_repeater, mortarmans_pack, tarstained_jerkin, snarehand_gloves, causeway_waders, ridgewalker_boots, surveyors_plumb, ouroboros_loop, brine_tally, tripline_crossbow*, coiled_wire_bracers*, signal_horn_charm*. Generic 45% (base 25), vulnerability ×1.10. Per skill: spring_snare ×20.18 (S 300%, more ×1.96, beh ×4.02); pitch_mortar ×8.97 (S 135%, more ×1.96, beh ×3.04); skipstone_bolt ×4.23 (S 225%, more ×1.00, beh ×2.03).
* **Legendary kit** ×15.06 — items: riverstone_repeater, mortarmans_pack, watchkeepers_hood, kilnwatch_spaulders, tarstained_jerkin, mountain_fists, coiled_wire_bracers, witching_cord, causeway_waders, ridgewalker_boots, signal_horn_charm, patchwork_signet, ouroboros_loop, tripline_crossbow*, snarehand_gloves*, surveyors_plumb*. Generic 79% (base 25), vulnerability ×1.24. Per skill: spring_snare ×21.54 (S 300%, more ×1.96, beh ×3.09); pitch_mortar ×12.33 (S 135%, more ×1.96, beh ×3.01); skipstone_bolt ×6.66 (S 225%, more ×1.00, beh ×2.31).

#### R-F Skipshot
* **Legendary kit** ×12.90 — items: powderkeg_crossbow, skipping_stone_quiver, watchkeepers_hood, kilnwatch_spaulders, hearthguard_coat, ink_stained_gloves, wardkeepers_cuffs_lo, witching_cord, skimmers_leggings, ridgewalker_boots, surveyors_plumb, patchwork_signet, brine_tally, riverstone_repeater*, mountain_fists*, ouroboros_loop*. Generic 80% (base 25), vulnerability ×1.26. Per skill: skipstone_bolt ×19.66 (S 338%, more ×1.20, beh ×4.12); multishot ×3.47 (S 100%, more ×1.00, beh ×1.91); cluster_arrow ×8.79 (S 275%, more ×1.00, beh ×2.58).

#### M-A Starfall
* **Set kit (6)** ×12.46 — items: thousand_missiles, glyphstone_orb, witching_cord, surveyors_plumb, ouroboros_loop, brine_tally, cindervane*, starfall_mantle*, craterheart_amulet*. Generic 53% (base 25), vulnerability ×1.10. Per skill: meteor ×15.83 (S 300%, more ×1.47, beh ×3.98); black_hole ×2.17 (S 100%, more ×1.00, beh ×1.61); magic_missile ×7.04 (S 225%, more ×1.00, beh ×3.22).
* **Hybrid (4, head+hands free)** ×11.79 — items: thousand_missiles, glyphstone_orb, watchkeepers_hood, mountain_fists, witching_cord, surveyors_plumb, ouroboros_loop, brine_tally, cindervane*, starfall_mantle*, craterheart_amulet*. Generic 53% (base 25), vulnerability ×1.22. Per skill: meteor ×14.38 (S 300%, more ×1.18, beh ×4.09); black_hole ×2.71 (S 100%, more ×1.00, beh ×1.82); magic_missile ×8.80 (S 225%, more ×1.00, beh ×3.63).
* **Legendary kit** ×11.17 — items: thousand_missiles, void_heart, watchkeepers_hood, starfall_mantle, hearthguard_coat, ink_stained_gloves, witching_cord, causeway_waders, ridgewalker_boots, craterheart_amulet, patchwork_signet, brine_tally, cindervane*, mountain_fists*, ouroboros_loop*. Generic 83% (base 25), vulnerability ×1.19. Per skill: meteor ×11.50 (S 300%, more ×1.15, beh ×2.87); black_hole ×3.65 (S 100%, more ×1.00, beh ×2.10); magic_missile ×17.13 (S 313%, more ×1.00, beh ×4.77).

#### M-B Glass Concord
* **Set kit (6)** ×23.33 — items: glyphstone_orb, runeweaver_cuffs, witching_cord, surveyors_plumb, ouroboros_loop, brine_tally, thousand_missiles*, ink_stained_gloves*, echoing_bead*. Generic 38% (base 25), vulnerability ×1.10. Per skill: magic_missile ×37.25 (S 350%, more ×1.25, beh ×10.90); stormglass_orb ×2.44 (S 100%, more ×1.25, beh ×1.61); black_hole ×2.44 (S 100%, more ×1.00, beh ×2.01).
* **Hybrid (4, head+hands free)** ×23.96 — items: glyphstone_orb, watchkeepers_hood, ink_stained_gloves, runeweaver_cuffs, witching_cord, surveyors_plumb, echoing_bead, brine_tally, thousand_missiles*, glasswrights_wraps*, ouroboros_loop*. Generic 38% (base 25), vulnerability ×1.22. Per skill: magic_missile ×38.31 (S 338%, more ×1.20, beh ×10.87); stormglass_orb ×2.24 (S 100%, more ×1.00, beh ×1.67); black_hole ×2.80 (S 100%, more ×1.00, beh ×2.08).
* **Legendary kit** ×20.97 — items: void_heart, watchkeepers_hood, kilnwatch_spaulders, hearthguard_coat, ink_stained_gloves, runeweaver_cuffs, witching_cord, causeway_waders, ridgewalker_boots, surveyors_plumb, ouroboros_loop, patchwork_signet, thousand_missiles*, glasswrights_wraps*, echoing_bead*. Generic 91% (base 25), vulnerability ×1.32. Per skill: magic_missile ×32.88 (S 338%, more ×1.20, beh ×6.22); stormglass_orb ×2.98 (S 100%, more ×1.00, beh ×1.48); black_hole ×3.28 (S 100%, more ×1.00, beh ×1.63).

#### M-C Lantern Garden
* **Set kit (6)** ×21.97 — items: kindling_rod, glyphstone_orb, runeweaver_cuffs, lanternkeepers_sash, surveyors_plumb, ouroboros_loop, brine_tally, lanternroot*, coiled_pauldrons*, signal_horn_charm*. Generic 38% (base 25), vulnerability ×1.10. Per skill: hydra ×31.64 (S 300%, more ×2.28, beh ×5.71); cinderkin ×14.86 (S 275%, more ×1.69, beh ×3.86); magic_missile ×2.01 (S 100%, more ×1.00, beh ×1.65).
* **Hybrid (4, head+hands free)** ×20.30 — items: kindling_rod, glyphstone_orb, watchkeepers_hood, mountain_fists, runeweaver_cuffs, lanternkeepers_sash, surveyors_plumb, ouroboros_loop, brine_tally, lanternroot*, coiled_pauldrons*, signal_horn_charm*. Generic 38% (base 25), vulnerability ×1.22. Per skill: hydra ×31.62 (S 300%, more ×1.82, beh ×6.46); cinderkin ×10.61 (S 275%, more ×1.35, beh ×3.12); magic_missile ×2.51 (S 100%, more ×1.00, beh ×1.87).
* **Legendary kit** ×19.33 — items: kindling_rod, glyphstone_orb, watchkeepers_hood, coiled_pauldrons, hearthguard_coat, mountain_fists, runeweaver_cuffs, lanternkeepers_sash, causeway_waders, ridgewalker_boots, surveyors_plumb, patchwork_signet, ouroboros_loop, lanternroot*, firekeepers_gloves*, signal_horn_charm*. Generic 95% (base 25), vulnerability ×1.22. Per skill: hydra ×21.58 (S 300%, more ×1.76, beh ×3.23); cinderkin ×20.54 (S 275%, more ×1.82, beh ×3.16); magic_missile ×3.27 (S 100%, more ×1.00, beh ×1.72).

#### M-D Hoarfrost
* **Set kit (6)** ×13.93 — items: hoarneedle_wand, glyphstone_orb, wardkeepers_cuffs_cc, witching_cord, surveyors_plumb, ouroboros_loop, rimecourt_band, frostlocked_wand*, spellwrights_circlet*, snowglobe_pendant*. Generic 38% (base 25), vulnerability ×1.37. Per skill: rime_needles ×7.63 (S 225%, more ×1.28, beh ×2.44); frost_nova ×46.26 (S 300%, more ×1.28, beh ×12.01); rimefield ×4.38 (S 100%, more ×1.28, beh ×2.28); black_hole ×3.11 (S 100%, more ×1.00, beh ×2.07).
* **Hybrid (4, chest+hands free)** ×14.43 — items: hoarneedle_wand, glyphstone_orb, winterbound_robe, mountain_fists, wardkeepers_cuffs_cc, witching_cord, surveyors_plumb, ouroboros_loop, rimecourt_band, frostlocked_wand*, spellwrights_circlet*, snowglobe_pendant*. Generic 38% (base 25), vulnerability ×1.37. Per skill: rime_needles ×7.32 (S 225%, more ×1.20, beh ×2.51); frost_nova ×48.82 (S 300%, more ×1.20, beh ×13.58); rimefield ×4.63 (S 100%, more ×1.20, beh ×2.57); black_hole ×3.52 (S 100%, more ×1.00, beh ×2.34).
* **Legendary kit** ×14.79 — items: frostlocked_wand, void_heart, watchkeepers_hood, kilnwatch_spaulders, winterbound_robe, ink_stained_gloves, wardkeepers_cuffs_cc, witching_cord, causeway_waders, ridgewalker_boots, snowglobe_pendant, patchwork_signet, rimecourt_band, hoarneedle_wand*, spellwrights_circlet*, ouroboros_loop*. Generic 79% (base 25), vulnerability ×1.32. Per skill: rime_needles ×14.17 (S 338%, more ×1.20, beh ×2.87); frost_nova ×36.13 (S 275%, more ×1.20, beh ×8.55); rimefield ×4.84 (S 100%, more ×1.20, beh ×2.15); black_hole ×4.45 (S 100%, more ×1.00, beh ×2.36).

#### M-E Hollowstar
* **Set kit (6)** ×11.93 — items: thousand_missiles, stormglass_prism, conductors_legwraps, ridgewalker_boots, surveyors_plumb, brine_tally, signal_coil, resonant_staff*, hornlistener_circlet*, ouroboros_loop*. Generic 49% (base 25), vulnerability ×1.10. Per skill: thrumming_ray ×12.72 (S 300%, more ×1.61, beh ×3.00); stormglass_orb ×12.04 (S 275%, more ×1.69, beh ×2.89); magic_missile ×6.52 (S 225%, more ×1.00, beh ×3.04).
* **Hybrid (4, hands+waist free)** ×10.72 — items: thousand_missiles, stormglass_prism, mountain_fists, witching_cord, conductors_legwraps, ridgewalker_boots, surveyors_plumb, brine_tally, signal_coil, resonant_staff*, hornlistener_circlet*, ouroboros_loop*. Generic 49% (base 25), vulnerability ×1.10. Per skill: thrumming_ray ×10.84 (S 300%, more ×1.24, beh ×3.32); stormglass_orb ×11.49 (S 275%, more ×1.30, beh ×3.58); magic_missile ×8.07 (S 225%, more ×1.00, beh ×3.77).
* **Legendary kit** ×11.09 — items: thousand_missiles, stormglass_prism, hornlistener_circlet, kilnwatch_spaulders, hearthguard_coat, mountain_fists, witching_cord, conductors_legwraps, ridgewalker_boots, surveyors_plumb, patchwork_signet, signal_coil, resonant_staff*, watchkeepers_hood*, ouroboros_loop*. Generic 80% (base 25), vulnerability ×1.24. Per skill: thrumming_ray ×10.74 (S 300%, more ×1.20, beh ×2.52); stormglass_orb ×12.43 (S 275%, more ×1.30, beh ×2.86); magic_missile ×10.04 (S 225%, more ×1.00, beh ×3.47).

#### M-F Orrery
* **Legendary kit** ×17.37 — items: thousand_missiles, glyphstone_orb, watchkeepers_hood, kilnwatch_spaulders, starchart_robe, mountain_fists, witching_cord, causeway_waders, ridgewalker_boots, surveyors_plumb, clockmakers_ring, patchwork_signet, armillary_staff*, spellwrights_circlet*, ouroboros_loop*. Generic 92% (base 25), vulnerability ×1.22. Per skill: orrery ×27.12 (S 300%, more ×1.16, beh ×6.24); magic_missile ×10.54 (S 225%, more ×1.00, beh ×3.47); meteor ×3.24 (S 100%, more ×1.00, beh ×1.73).
