# Parity and diversity budget v2 — does the item pool let many builds compete?

Everything here is a **proposal [P]** for the engineering harness to confirm. The approved plan (§3.1) set the rule: a
legendary-only kit within 1.25× of a set kit, and a hybrid between them. v2 adds the owner's direction: players find the
builds, and the game must not favour a pre-made one (`BUILD-TOOLS.md`).

So the budget no longer checks hand-picked builds. It checks that **the item pool itself keeps many main skills
competitive and has no auto-include item**. It is a *paper model*: it multiplies the game's real damage buckets with
estimated uptimes and behaviour values; it does not simulate combat.

The model is `budget-model.mjs` in this folder (plain Node, imports nothing from the game). Every number below comes from
`node docs/rework/depth/budget-model.mjs` (about 3 minutes per class). Environment variables `SIX`, `CSIX`, `MS`, `GS` and
`R` reproduce the sweeps. Labels: **[M]** read in this repo, **[P]** proposal, **[inferred]** arithmetic on the above.

## 1. Answer in one paragraph

The v1 set rules hold and are confirmed again by the v2 search:
* the 6-piece is a **transform plus ×1.25** (×1.35 while a condition holds; hard cap ×1.3 effective);
* the 2- and 4-piece carry the value;
* a whole set is at most ×2.5 per skill.

What changes in v2:
* every set bonus and about three-quarters of the new legendaries key off **tags**;
* the shared items are re-keyed so none is universal;
* a **set-reduction ring** (Journeyman's Ring) turns 2/4/6 into 5 + 1 and 3 + 3 options.

With the v2 pool, a search over every main skill and every set configuration finds the results below. The lagging
skills are listed in §4 with the lever for each.

| Class | Main skills within 1.25× of the class best | Best legendary-only ÷ best 6-piece kit | Hybrid between (or within 5%) | Item or set in every top kit |
|---|---|---|---|---|
| Warrior | **6 / 9** | 0.96–1.21 | 7 / 9 | none |
| Ranger | **5 / 11** | 0.84–1.25 | 7 / 11 | none |
| Mage | **8 / 11** | 0.83–1.11 | 10 / 11 | none |

The 6-piece sweep picks ×1.25 again:

| 6-piece multiplier | What breaks |
|---|---|
| ×1.15 | warrior legendary kits beat sets by up to 1.30 |
| ×1.25 | nothing |
| ×1.40 | ranger and mage sets beat legendary kits (ratio down to 0.69) |

## 2. How the game combines bonuses [M]

* `server/src/sim/damage.ts baseMult()`:
  `coef × (1 + main/100) × (1 + skillPct/100) × (1 + ele/100) × (1 + (dmgPct + live.dmg)/100) × mult × tal × ouro`;
  then crit, elite bonus and `vulnerability()` in `rollDamage()`.
* **skillPct** is additive (runes, tiers, legendary `dmg`, gear "+x% skill damage", passives).
* **mult** is the own bucket where today's 6-pieces live (×8 to ×127).
* **Cube** powers roll at maximum, one per weapon/armor/jewelry.
* **Ancient** status does not change legendary values (`shared/src/items.ts`, `stats.ts`).
* Why a set always wins today, and why additive powers dilute: see v1, unchanged (a legendary kit ≈ ×2–×3 against a set
  ×8–×127).

## 3. Rules [P]

| # | Rule | Value | Evidence |
|---|---|---|---|
| R1 | 6-piece = transform (damage value ≤ ×1.10) + own multiplier | ×1.25; ×1.35 while a condition holds; hard cap ×1.3 effective | v2 sweep §1; D4 developers on sets changing play, not numbers [S, `REFERENCES.md` §4] |
| R2 | 2- and 4-piece carry the set | ≈×1.5–1.7 together, tag-keyed | hybrids beat a full set only when the 6-piece is worth ≤ the 2nd + 3rd best freed legendaries |
| R3 | Whole set per skill | ≤ ×2.5 including transforms | every set checked in the model (highest: Siegebreaker on a Projectile Spender ≈ ×2.2) |
| R4 | Legendary magnitudes | named weapon signature +150–200% (existing anchor); named primary/off-hand +100–150%; **tag additive 40–90%**; **skillMore 25–40%** conditional (4–8% per stack); vulnerability 12–30%; cost/cooldown 15–40% | v2 search (§4); skillMore sweep holds the v1 window from ×0.5 to ×1.25 |
| R5 | Tag rule | ≈¾ of new legendaries and all set bonuses key off tags; named signatures one per skill | owner direction; tags make one item fit many skills |
| R6 | No-set ring | Patchwork Signet 2–3% per equipped legendary, max 10, not extractable | D3 Legacy of Nightmares/Dreams [S/SN] |
| R7 | Count cap | at most **+2 maximum summons and +2 projectiles per skill from items and sets combined** (runes, tiers, passives excluded) | v2 search: the Spindle of a Thousand Missiles + Glass Concord stack made Magic Missile the outlier before the cap |
| R8 | Set-reduction ring | Journeyman's Ring: set bonuses need one fewer piece (min 2), does not stack, **not extractable into the Cube** | D3 Ring of Royal Grandeur [SN] and Season 16 [S]; extractable would make it free |
| R9 | No universal shared item | every shared legendary needs a tag or a state condition; universal stat items stay rare and below the conditional ones | v1 model: universal shared items filled 4–6 footprint slots of every legendary kit |

## 4. Diversity results (default model, 24 restarts per configuration)

**Method.**
* For every class main skill, the search first picks the support skill whose fixture gives the best legendary-only kit.
* It then tries every configuration: no set; each set at 6; each set at 4 with two slots free (all assignments); 4 + 2
  and 2 + 2 + 2 mixes; and with Journeyman's Ring, 5 pieces for the 6-piece bonus, 3 for a 4-piece bonus, and 3 + 3 for
  two 4-piece bonuses.
* Items fill the free slots by local search (coordinate ascent from 24 random starts).
* Factors are damage multipliers against the same fixture in a plain rare kit.
* **Cross-skill comparison assumes equal base DPS in rares** (the coefficient-tuning target). The column "vs class best"
  therefore measures how evenly the *items* lift the skills, not final balance.

#### Warrior

| Main skill (support) | Best kit | Best configuration | vs class best | Legendary-only | Best 6-piece kit | Leg / 6-piece | Best 4-piece hybrid | Hybrid check (±5%) |
|---|---:|---|---:|---:|---:|---:|---:|---|
| cleave (sawtooth_hatchet) | ×12.94 | hearthbanner 3 + ring (4-piece) + 3 free | 0.93 | ×12.20 | ×12.16 (hearthbanner 5 + ring) | 1.00 | ×12.94 (hearthbanner 3 + ring (4-piece) + 3 free) | above (1.06) |
| tolling_blow (sawtooth_hatchet) | ×13.66 | fault_warden 3 + ring (4-piece) + 3 free | 0.98 | ×13.43 | ×12.80 (hearthbanner 5 + ring) | 1.05 | ×13.66 (fault_warden 3 + ring (4-piece) + 3 free) | within 5% |
| whirlwind (cairnfall) | ×11.03 | endless_storm 5 + ring | 0.79 | ×10.89 | ×11.03 (endless_storm 5 + ring) | 0.99 | ×11.01 (endless_storm 3 + ring (4-piece) + 3 free) | between |
| ironplough (sawtooth_hatchet) | ×11.78 | no set | 0.85 | ×11.78 | ×10.69 (endless_storm 5 + ring) | 1.10 | ×11.12 (endless_storm 3 + ring (4-piece) + 3 free) | between |
| rend (ironplough) | ×10.76 | no set | 0.77 | ×10.76 | ×9.22 (cinder_oath 5 + ring) | 1.17 | ×9.76 (cinder_oath 3 + ring (4-piece) + 3 free) | between |
| sawtooth_hatchet (ironplough) | ×13.92 | no set | 1.00 | ×13.92 | ×11.52 (cinder_oath 5 + ring) | 1.21 | ×12.15 (cinder_oath 3 + ring (4-piece) + 3 free) | between |
| ground_stomp (ironplough) | ×11.22 | fault_warden 4 + 2 free | 0.81 | ×10.61 | ×10.82 (fault_warden 6) | 0.98 | ×11.22 (fault_warden 4 + 2 free) | within 5% |
| seismic_slam (ground_stomp) | ×9.94 | no set | 0.71 | ×9.94 | ×9.29 (furrowmark 5 + ring) | 1.07 | ×9.69 (furrowmark 3 + ring (4-piece) + 3 free) | between |
| cairnfall (ironplough) | ×13.92 | fault_warden 4 + 2 free | 1.00 | ×12.48 | ×13.01 (fault_warden 6) | 0.96 | ×13.92 (fault_warden 4 + 2 free) | above (1.07) |

* Main skills within 1.25× of the class best: **6 / 9**.
* Most frequent pieces across the 9 top kits: ouroboros_loop 8/9, ward_pennant_shield 7/9, hellforge_talisman 7/9, anvil_vambraces 6/9, millwheel_edge 6/9, mountain_fists 6/9, yoke_greaves 6/9, tanners_pauldrons 5/9, hearthguard_coat 5/9, grinning_saw 4/9.
* Dominance flag (in every top kit): none.
* Sets used in top kits: fault_warden 3, hearthbanner 1, endless_storm 1.

#### Ranger

| Main skill (support) | Best kit | Best configuration | vs class best | Legendary-only | Best 6-piece kit | Leg / 6-piece | Best 4-piece hybrid | Hybrid check (±5%) |
|---|---:|---|---:|---:|---:|---:|---:|---|
| hungering_arrow (skipstone_bolt) | ×13.54 | farwatch 5 + ring | 0.71 | ×11.59 | ×13.54 (farwatch 5 + ring) | 0.86 | ×13.14 (farwatch 3 + ring (4-piece) + 3 free) | between |
| skipstone_bolt (hungering_arrow) | ×19.02 | farwatch 5 + ring | 1.00 | ×16.41 | ×19.02 (farwatch 5 + ring) | 0.86 | ×18.65 (farwatch 3 + ring (4-piece) + 3 free) | between |
| multishot (rain_of_vengeance) | ×13.88 | farwatch 5 + ring | 0.73 | ×11.69 | ×13.88 (farwatch 5 + ring) | 0.84 | ×12.89 (farwatch 3 + ring (4-piece) + 3 free) | between |
| cluster_arrow (rain_of_vengeance) | ×12.52 | no set | 0.66 | ×12.52 | ×10.89 (farwatch 5 + ring) | 1.15 | ×10.20 (farwatch 3 + ring (4-piece) + 3 free) | below (0.94) |
| overcast_volley (rain_of_vengeance) | ×13.17 | rainkeeper 5 + ring | 0.69 | ×12.99 | ×13.17 (rainkeeper 5 + ring) | 0.99 | ×12.35 (rainkeeper 3 + ring (4-piece) + 3 free) | within 5% |
| rain_of_vengeance (overcast_volley) | ×11.22 | rainkeeper 5 + ring | 0.59 | ×10.36 | ×11.22 (rainkeeper 5 + ring) | 0.92 | ×10.66 (rainkeeper 4 + 2 free) | between |
| sentry (spring_snare) | ×18.40 | no set | 0.97 | ×18.40 | ×14.66 (siegebreaker 5 + ring) | 1.25 | ×14.06 (siegebreaker 3 + ring (4-piece) + 3 free) | within 5% |
| spring_snare (pitch_mortar) | ×18.47 | no set | 0.97 | ×18.47 | ×18.16 (siegebreaker 5 + ring) | 1.02 | ×18.15 (snarewright 3 + ring (4-piece) + 3 free) | within 5% |
| pitch_mortar (spring_snare) | ×14.52 | siegebreaker 5 + ring | 0.76 | ×14.52 | ×14.52 (siegebreaker 5 + ring) | 1.00 | ×12.99 (siegebreaker 4 + 2 free) | below (0.89) |
| companion (pitch_mortar) | ×16.59 | thicket_kin 5 + ring | 0.87 | ×16.33 | ×16.59 (thicket_kin 5 + ring) | 0.98 | ×15.05 (thicket_kin 3 + ring (4-piece) + 3 free) | below (0.92) |
| murmuration (pitch_mortar) | ×16.44 | thicket_kin 5 + ring | 0.86 | ×16.06 | ×16.44 (thicket_kin 5 + ring) | 0.98 | ×14.98 (thicket_kin 4 + 2 free) | below (0.93) |

* Main skills within 1.25× of the class best: **5 / 11**.
* Most frequent pieces across the 11 top kits: hunters_mark 8/11, journeymans_ring 8/11, ouroboros_loop 8/11, surveyors_plumb 7/11, skipping_stone_quiver 6/11, witching_cord 6/11, wardkeepers_cuffs 6/11, signal_horn_charm 5/11, mortarmans_pack 4/11, featherguard_cuffs 3/11.
* Dominance flag (in every top kit): none.
* Sets used in top kits: farwatch 3, rainkeeper 2, thicket_kin 2, siegebreaker 1.

#### Mage

| Main skill (support) | Best kit | Best configuration | vs class best | Legendary-only | Best 6-piece kit | Leg / 6-piece | Best 4-piece hybrid | Hybrid check (±5%) |
|---|---:|---|---:|---:|---:|---:|---:|---|
| magic_missile (rime_needles) | ×19.98 | glass_concord 5 + ring | 1.00 | ×17.68 | ×19.98 (glass_concord 5 + ring) | 0.88 | ×18.62 (glass_concord 3 + ring (4-piece) + 3 free) | between |
| rime_needles (magic_missile) | ×19.96 | hoarfrost_vigil 3 + ring (4-piece) + 3 free | 1.00 | ×18.20 | ×19.75 (glass_concord 5 + ring) | 0.92 | ×19.96 (hoarfrost_vigil 3 + ring (4-piece) + 3 free) | within 5% |
| meteor (rimefield) | ×14.04 | fallen_star 5 + ring | 0.70 | ×13.81 | ×14.04 (fallen_star 5 + ring) | 0.98 | ×13.98 (fallen_star 3 + ring (4-piece) + 3 free) | between |
| stormglass_orb (rimefield) | ×16.72 | glass_concord 5 + ring | 0.83 | ×15.61 | ×16.72 (glass_concord 5 + ring) | 0.93 | ×15.54 (glass_concord 3 + ring (4-piece) + 3 free) | within 5% |
| thrumming_ray (rimefield) | ×13.32 | hollowstar_choir 5 + ring | 0.66 | ×11.00 | ×13.32 (hollowstar_choir 5 + ring) | 0.83 | ×12.05 (hollowstar_choir 4 + 2 free) | between |
| black_hole (frost_nova) | ×13.96 | no set | 0.70 | ×13.96 | ×12.76 (hoarfrost_vigil 6) | 1.09 | ×12.48 (hoarfrost_vigil 4 + 2 free) | within 5% |
| frost_nova (rimefield) | ×18.94 | hoarfrost_vigil 4 + 2 free | 0.94 | ×17.81 | ×18.63 (hoarfrost_vigil 5 + ring) | 0.96 | ×18.94 (hoarfrost_vigil 4 + 2 free) | within 5% |
| rimefield (frost_nova) | ×18.10 | no set | 0.90 | ×18.31 | ×16.48 (hoarfrost_vigil 5 + ring) | 1.11 | ×16.84 (hoarfrost_vigil 4 + 2 free) | between |
| hydra (rime_needles) | ×19.21 | lantern_garden 5 + ring | 0.96 | ×18.07 | ×19.21 (lantern_garden 5 + ring) | 0.94 | ×18.23 (lantern_garden 3 + ring (4-piece) + 3 free) | between |
| cinderkin (orrery) | ×18.22 | lantern_garden 5 + ring | 0.91 | ×15.43 | ×18.22 (lantern_garden 5 + ring) | 0.85 | ×17.37 (lantern_garden 3 + ring (4-piece) + 3 free) | between |
| orrery (frost_nova) | ×20.05 | lantern_garden 5 + ring | 1.00 | ×17.99 | ×20.05 (lantern_garden 5 + ring) | 0.90 | ×20.05 (lantern_garden 3 + ring (4-piece) + 3 free) | between |

* Main skills within 1.25× of the class best: **8 / 11**.
* Most frequent pieces across the 11 top kits: glyphstone_orb 8/11, journeymans_ring 8/11, wardkeepers_cuffs 8/11, witching_cord 7/11, ouroboros_loop 7/11, hellforge_talisman 6/11, thousand_missiles 6/11, glasswrights_wraps 4/11, frostlocked_wand 4/11, patient_thief 4/11.
* Dominance flag (in every top kit): none.
* Sets used in top kits: lantern_garden 3, glass_concord 2, hoarfrost_vigil 2, fallen_star 1, hollowstar_choir 1.

**Reading.**
* **Warrior (6/9).**
  * Seismic Slam (0.71), Rend (0.77) and Whirlwind (0.79) lag. All three are Spenders: Furycord Belt and Ridgewalker Boots
    already key off Spender, so the next lever is the Displace pool (Yoke Greaves, Tremor Signet, Furrowmark) for Seismic
    Slam.
  * Ward Pennant Shield sits in 7/9 top kits because the warrior off-hand has only two shield legendaries; the new
    `warhorn` base (`ITEMS-SHARED.md` §3.3) is the place for a third off-hand legendary in M2.
* **Ranger (5/11).** The Projectile/Aerial spenders (Hungering Arrow, Multishot, Cluster Arrow, Overcast Volley at
  0.68–0.73, Rain of Vengeance 0.59) get less lift than Sentry, Spring Snare and Skipstone Bolt (0.92–1.00). Two causes:
  * the existing Sentry items (Sapper's Pack + Gearwright's Heart) stack count and attack speed — Gearwright's is
    proposed at 30% faster instead of 50%;
  * Rain of Vengeance has no additive named signature.

  Levers in order: raise the Aerial/Projectile Spender tag additives (Weathervane Ring, Bandolier Belt) by about 15 points;
  give Rainspindle a damage roll; then re-run.
* **Mage (8/11).** Thrumming Ray (0.66), Black Hole and Meteor (0.70) lag. The Channel and Ground pools are thin (Signal
  Coil, Horizon Cowl, Rimewalker Slippers), so a second Channel item in M2 is the cleanest fix.
* **Sets.** Every set is either in a top kit or the best 4-piece hybrid for at least one main skill. Journeyman's Ring is
  in 8 of 11 ranger and mage top kits, which is a watch item; it costs a ring slot, which is why R8 forbids the Cube.

## 5. Sensitivity

| 6-piece | Warrior within 1.25× / leg÷6 range | Ranger | Mage |
|---|---|---|---|
| ×1.15 | 5/9 · 1.05–1.30 | 6/11 · 0.85–1.26 | 7/11 · 0.90–1.19 |
| **×1.25** | **6/9 · 0.96–1.21** | **5/11 · 0.84–1.25** | **8/11 · 0.83–1.11** |
| ×1.40 | 7/9 · 0.89–1.07 | 5/11 · 0.69–1.26 | 8/11 · 0.72–0.96 |

(×1.15 and ×1.40 rows at 8 restarts.) The v1 sweeps of the skillMore magnitude (window held from ×0.5 to ×1.25 of the
proposal) and of the shared generic items still describe the mechanism; v2 removed the universal shared items instead of
only shrinking them.

## 6. Proposed acceptance thresholds for the engineering harness [P]

The harness (an `audit-item-builds.ts` v2) runs the same search on the real 20 Hz simulation instead of this paper
model: same encounters as P11 (six-pack, three champions, Gorgemaw), fixed seeds, 48 tier points, a fixed
specialization allocation per fixture, mid-roll equipped and max-roll Cube powers. It should report the six checks below
per class and fail `npm run verify` on a hard limit.

| # | Check | Target | Hard limit |
|---|---|---|---|
| D1 | Main skills whose best kit clears within 1.25× of the class's best | ≥ 2/3 of the class's main skills | ≥ 1/2 |
| D2 | Share of top kits containing the same item or set | ≤ 75% | < 100% (no auto-include) |
| D3 | Best legendary-only ÷ best set-bonus kit, per main skill | 0.85–1.20 | 0.80–1.25 |
| D4 | Best 4-piece hybrid relative to the nearer of set / legendary kit | within ±5% or between | within ±10% |
| D5 | Each set appears in a top kit or as the best hybrid of some main skill | all 5 sets per class | ≥ 4 of 5 |
| D6 | No single skill's best kit factor above 1.5× the class median | — | hard |

Today's paper results meet D2, D3, D5 and D6 for every class, D4's ±10% limit everywhere (worst 0.89), and D1 for warrior
(6/9) and mage (8/11) only. **Ranger 5/11 fails D1's target and its 1/2 hard limit**, so the ranger levers in §4 come
before the ranger content wave.

## 7. What the model changed in v2 (applied in the documents)

1. **Shared items re-keyed to tags or states** (`ITEMS-SHARED.md` §2):
   * Hearthguard Coat: from "above 80% Life" to channelling / inside own Ground;
   * Watchkeeper's Hood: from elites to Projectile/Aerial with no enemy near;
   * Ridgewalker Boots: Spender;
   * Surveyor's Plumb: Mark;
   * Brine Tally: Bleed/Burn kills;
   * new: Journeyman's Ring.
2. **Primary cluster weakened:** Ink-Stained Gloves 50–75% with every 5th attack repeating; Hawkfeather Cap 50–75%;
   Quartermaster's Cuirass 20–30%.
3. **Spender additives added**, so non-primary skills get lift:
   * Furycord Belt (warrior, while a Buff is active);
   * Bandolier Belt (Projectile Spender);
   * Static Loop (mage Spender);
   * Weathervane Ring (Aerial), Raincount Ring (Ground), Craterheart Amulet (Aerial), Signal Coil (Channel), Horizon Cowl
     (Ground, 40–60).
4. **Summon/Device cluster trimmed:**
   * Signal Horn Charm 15–25;
   * Siegebreaker 2-piece +1 Device at ×1.2 value, 4-piece repeats at 20%;
   * Mortarman's Pack and Fuse Cord Belt effects lowered;
   * Lantern Garden 2-piece ×1.35 value, 4-piece ×1.15;
   * Thicket Kin 4-piece ×1.35.
5. **Set 4-piece hooks strengthened** (Endless Storm, Fault Warden, Cinder Oath, Furrowmark, Farwatch, Snarewright,
   Glass Concord, Hollowstar Choir), Hoarfrost Vigil's 2-piece covers Ground skills too.
6. **Existing items, owner-visible proposals:** Ouroboros Loop 150–200% → 60–80% (still in 7–8 of every class's 9–11 top kits; next
   step 40–60% or an element-specific rework); Gearwright's Heart fires 30% faster instead of 50%.
7. **Model corrections:** a 3-missile fan is ×1.7 on average, not ×3; Riverstone's two extra skips average ×1.25 across
   the audit encounters.

## 8. Model assumptions and limits [P]

* **Fixtures:**
  * shares are main 0.6, support 0.2, class primary 0.2 (a primary as main: 0.8 / 0.2);
  * warriors and mages are assumed to have a Buff skill slotted (Battle Rage / Magic Weapon, 95% uptime);
  * rangers have Quarry Mark (Mark uptime 0.5).
* **Baselines:** skill bucket +100%, generic +25%, element +15%.
* **Condition uptimes:** depend on the fixture's tags:
  * stun 0.6 with a Stun skill, else 0.1; bleed 0.9; chill 0.8;
  * inside own Ground 0.5; displaced 0.6; channelling 0.8;
  * standing still 0.3 melee / 0.5 ranged; no enemy within 200 units 0.2 melee / 0.6 ranged;
  * 3.2 active Devices when a Device skill is present.
* **Behaviour values** (extra summons, projectiles, cost and cooldown cuts) are converted to multipliers by simple rules.
  They are the weakest part of the model and the reason a simulation must confirm.
* **Invisible to the current harness:**
  * Movement-triggered effects (Quakestep Sabatons, Wingbeat Boots, Rimewalker Slippers' copy, Stridewind Greaves),
    because the audit bot never dashes [M];
  * states that the immortal bot always satisfies.

  Both need a harness variant.
* **Not modelled:** specialization nodes, passives, Inscriptions (§7 of `ITEMS-SHARED.md`) and set transforms beyond
  their listed damage value.
* Cross-skill comparisons assume equal base DPS (D1 is about item lift); the harness measures real clear times.

## 9. Risks and open questions

1. **Endgame power drops** (unchanged from v1): set kits fall from ×8–×127 6-pieces to about ×10–×25 total *including*
   legendaries and the Cube. The Torment ladder must be re-fitted (`sim.ts fit`).
2. **Ranger item lift is uneven (5/11).** Fixable with the levers in §4. It is the main reason to run the harness before
   the ranger content wave.
3. **Journeyman's Ring** is close to a must-have for set users (it was in 8 of 11 ranger and mage top kits). D3 eventually gave its power
   to everyone for a season [S]. Watch it in the harness; if D2 fails, fold its effect into the sets' 2-piece instead.
4. **Ouroboros Loop and Witching Cord** (existing universal items) stay frequent (6–8 of every 9–11 top kits). They are the last
   universal stat items; the proposal is to cut, not remove (owner-visible).
5. **Players will find stronger kits than the paper model.** A 24-restart search already found a Magic Missile kit the
   8-restart search missed. Shipping T1–T3 of `BUILD-TOOLS.md` makes this happen fast; the harness thresholds (§6) are
   the guard.
6. **Hybrid tolerance:** the plan said a hybrid "must sit between". The search finds hybrids 6–11% below the nearer kit
   for some summon and device skills, because 5 + ring is a better set option. D4 proposes ±5% as the target and ±10% as
   the hard limit.

## Appendix — top kits per main skill (model output)

Item ids are the snake_case of the item names; `*` = in the Cube (maximum roll).

#### Warrior

* cleave: hearthbanner 3 + ring (4-piece) + 3 free — grinning_saw, ward_pennant_shield, tanners_pauldrons, quartermasters_cuirass, ink_stained_gloves, anvil_vambraces, witching_cord, hellforge_talisman, journeymans_ring, ouroboros_loop, millwheel_edge*, ashgrip_gauntlets*, brine_tally*
* tolling_blow: fault_warden 3 + ring (4-piece) + 3 free — bellwrights_maul, ward_pennant_shield, tanners_pauldrons, quartermasters_cuirass, ink_stained_gloves, anvil_vambraces, witching_cord, hellforge_talisman, journeymans_ring, brine_tally, grinning_saw*, ashgrip_gauntlets*, ouroboros_loop*
* whirlwind: endless_storm 5 + ring — cairnwrights_hammer, ward_pennant_shield, anvil_vambraces, eternal_gyre, gale_stitched_legguards, hellforge_talisman, journeymans_ring, ouroboros_loop, ninefold_gale*, fissure_lined_breastplate*, surveyors_plumb*
* ironplough: no set — grinning_saw, ward_pennant_shield, brass_warhorn_helm, tanners_pauldrons, hearthguard_coat, mountain_fists, wardkeepers_cuffs, furycord_belt, gale_stitched_legguards, ridgewalker_boots, hellforge_talisman, patchwork_signet, ouroboros_loop, coulter_blade*, yoke_greaves*, brine_tally*
* rend: no set — bloodwake, ward_pennant_shield, slagforged_helm, tanners_pauldrons, hearthguard_coat, mountain_fists, wardkeepers_cuffs, furycord_belt, yoke_greaves, ridgewalker_boots, red_ledger, patchwork_signet, ouroboros_loop, millwheel_edge*, woodcutters_grips*, sawyers_ring*
* sawtooth_hatchet: no set — millwheel_edge, ward_pennant_shield, watchkeepers_hood, tanners_pauldrons, hearthguard_coat, mountain_fists, wardkeepers_cuffs, furycord_belt, yoke_greaves, ridgewalker_boots, red_ledger, patchwork_signet, sawyers_ring, grinning_saw*, woodcutters_grips*, ouroboros_loop*
* ground_stomp: fault_warden 4 + 2 free — millwheel_edge, last_light, hearthguard_coat, mountain_fists, anvil_vambraces, witching_cord, hellforge_talisman, patient_thief, ouroboros_loop, coulter_blade*, yoke_greaves*, threshers_knot*
* seismic_slam: no set — millwheel_edge, last_light, slagforged_helm, kilnwatch_spaulders, fissure_lined_breastplate, mountain_fists, anvil_vambraces, furycord_belt, yoke_greaves, ridgewalker_boots, hellforge_talisman, patchwork_signet, ouroboros_loop, faultcleaver*, wardkeepers_cuffs*, threshers_knot*
* cairnfall: fault_warden 4 + 2 free — millwheel_edge, ward_pennant_shield, hearthguard_coat, anvil_vambraces, witching_cord, yoke_greaves, hellforge_talisman, tremor_signet, patient_thief, cairnwrights_hammer*, mountain_fists*, threshers_knot*

#### Ranger

* hungering_arrow: farwatch 5 + ring — hunters_mark, skipping_stone_quiver, ink_stained_gloves, featherguard_cuffs, witching_cord, hellforge_talisman, journeymans_ring, ouroboros_loop, riverstone_repeater*, hawkfeather_cap*, surveyors_plumb*
* skipstone_bolt: farwatch 5 + ring — hunters_mark, skipping_stone_quiver, hawkfeather_cap, featherguard_cuffs, witching_cord, surveyors_plumb, journeymans_ring, ouroboros_loop, riverstone_repeater*, ink_stained_gloves*, hellforge_talisman*
* multishot: farwatch 5 + ring — hunters_mark, skipping_stone_quiver, featherguard_cuffs, bandolier_belt, skimmers_leggings, surveyors_plumb, journeymans_ring, ouroboros_loop, thunderhead*, bowyers_gloves*, hellforge_talisman*
* cluster_arrow: no set — powderkeg_crossbow, skipping_stone_quiver, watchkeepers_hood, kilnwatch_spaulders, hearthguard_coat, mountain_fists, wardkeepers_cuffs, bandolier_belt, skimmers_leggings, fuseburnt_boots, surveyors_plumb, patchwork_signet, ouroboros_loop, hunters_mark*, bowyers_gloves*, powder_horn*
* overcast_volley: rainkeeper 5 + ring — hunters_mark, skipping_stone_quiver, overcast_hood, wardkeepers_cuffs, witching_cord, surveyors_plumb, journeymans_ring, weathervane_ring, highcloud_longbow*, squallcatcher_pauldrons*, ouroboros_loop*
* rain_of_vengeance: rainkeeper 5 + ring — highcloud_longbow, skipping_stone_quiver, overcast_hood, wardkeepers_cuffs, witching_cord, surveyors_plumb, journeymans_ring, raincount_ring, rainspindle*, squallcatcher_pauldrons*, weathervane_ring*
* sentry: no set — hunters_mark, sappers_pack, watchkeepers_hood, huntsmans_pauldrons, gearwright_heart, snarehand_gloves, wardkeepers_cuffs, fuse_cord_belt, skimmers_leggings, fuseburnt_boots, signal_horn_charm, patchwork_signet, patient_thief, boltthrowers_arbalest*, bowyers_gloves*, roost_charm*
* spring_snare: no set — tripline_crossbow, mortarmans_pack, hawkfeather_cap, huntsmans_pauldrons, tarstained_jerkin, mountain_fists, coiled_wire_bracers, fuse_cord_belt, causeway_waders, ridgewalker_boots, signal_horn_charm, patchwork_signet, ouroboros_loop, boltthrowers_arbalest*, snarehand_gloves*, surveyors_plumb*
* pitch_mortar: siegebreaker 5 + ring — tripline_crossbow, mortarmans_pack, huntsmans_pauldrons, coiled_wire_bracers, fuse_cord_belt, signal_horn_charm, journeymans_ring, ouroboros_loop, boltthrowers_arbalest*, snarehand_gloves*, raincount_ring*
* companion: thicket_kin 5 + ring — hunters_mark, mortarmans_pack, wardkeepers_cuffs, witching_cord, trailhide_breeches, whistle_charm, journeymans_ring, ouroboros_loop, kennelwood_bow*, wingbeat_boots*, signal_horn_charm*
* murmuration: thicket_kin 5 + ring — hunters_mark, mortarmans_pack, wardkeepers_cuffs, witching_cord, trailhide_breeches, whistle_charm, journeymans_ring, patient_thief, starling_longbow*, wingbeat_boots*, signal_horn_charm*

#### Mage

* magic_missile: glass_concord 5 + ring — hoarneedle_wand, glyphstone_orb, ink_stained_gloves, runeweaver_cuffs, witching_cord, hellforge_talisman, journeymans_ring, echoing_bead, thousand_missiles*, glasswrights_wraps*, ouroboros_loop*
* rime_needles: hoarfrost_vigil 3 + ring (4-piece) + 3 free — thousand_missiles, glyphstone_orb, watchkeepers_hood, winterbound_robe, ink_stained_gloves, runeweaver_cuffs, witching_cord, snowglobe_pendant, journeymans_ring, echoing_bead, hoarneedle_wand*, glasswrights_wraps*, ouroboros_loop*
* meteor: fallen_star 5 + ring — thousand_missiles, glyphstone_orb, starfall_mantle, wardkeepers_cuffs, witching_cord, craterheart_amulet, journeymans_ring, ouroboros_loop, cindervane*, firekeepers_gloves*, static_loop*
* stormglass_orb: glass_concord 5 + ring — thousand_missiles, stormglass_prism, glasswrights_wraps, wardkeepers_cuffs, witching_cord, hellforge_talisman, journeymans_ring, ouroboros_loop, cistern_staff*, conductors_legwraps*, static_loop*
* thrumming_ray: hollowstar_choir 5 + ring — thousand_missiles, void_heart, starchart_robe, causeway_waders, ridgewalker_boots, hellforge_talisman, journeymans_ring, signal_coil, resonant_staff*, hornlistener_circlet*, static_loop*
* black_hole: no set — frostlocked_wand, void_heart, horizon_cowl, kilnwatch_spaulders, starchart_robe, mountain_fists, wardkeepers_cuffs, witching_cord, causeway_waders, rimewalker_slippers, hellforge_talisman, patient_thief, clockmakers_ring, undertow_staff*, spellwrights_circlet*, ouroboros_loop*
* frost_nova: hoarfrost_vigil 4 + 2 free — frostlocked_wand, glyphstone_orb, winterbound_robe, mountain_fists, wardkeepers_cuffs, witching_cord, snowglobe_pendant, patient_thief, clockmakers_ring, cistern_staff*, spellwrights_circlet*, rimecourt_band*
* rimefield: no set — frostlocked_wand, glyphstone_orb, spellwrights_circlet, kilnwatch_spaulders, winterbound_robe, mountain_fists, wardkeepers_cuffs, witching_cord, causeway_waders, rimewalker_slippers, snowglobe_pendant, patient_thief, clockmakers_ring, cistern_staff*, horizon_cowl*, rimecourt_band*
* hydra: lantern_garden 5 + ring — thousand_missiles, glyphstone_orb, glasswrights_wraps, wardkeepers_cuffs, lanternkeepers_sash, hellforge_talisman, journeymans_ring, ouroboros_loop, lanternroot*, coiled_pauldrons*, signal_horn_charm*
* cinderkin: lantern_garden 5 + ring — kindling_rod, glyphstone_orb, firekeepers_gloves, wardkeepers_cuffs, lanternkeepers_sash, hellforge_talisman, journeymans_ring, ouroboros_loop, armillary_staff*, coiled_pauldrons*, signal_horn_charm*
* orrery: lantern_garden 5 + ring — frostlocked_wand, glyphstone_orb, starchart_robe, wardkeepers_cuffs, lanternkeepers_sash, signal_horn_charm, journeymans_ring, patient_thief, armillary_staff*, spellwrights_circlet*, clockmakers_ring*
