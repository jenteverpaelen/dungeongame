# Build balance: skills, sets and named weapons (balance pass, 2026-10-12)

Labels: [S] sourced · [K] genre knowledge · [M] measured here · [P] proposal.

## What was open (from the depth program)

Shared legendaries a bit too strong, a few named weapons dominating their skill, the mage frost set winning too often,
two weak warrior sets, the warrior slowest while levelling (champion time-to-kill ~9 s from level 25 vs ~5.7 s).
Measured with the parity audits (`scripts/audit-<class>-parity.ts`, the real 20 Hz simulation, an unkillable hero on the
fixed six-pack / three-champion / boss encounters, 3 seeds; checks D1–D6 of `docs/rework/depth/BUDGET.md` §6):

| Before (shipped pool) | D1 skills within 1.25× of the best | D6 best skill's item lift ÷ class median (hard ≤ 1.5) | Best-kit time spread |
|---|---|---|---|
| Warrior | 2/9 | 1.69 | 366–1730 s |
| Ranger | 2/11 | 1.97 | 319–1294 s |
| Mage | 1/11 | 2.16 | 127–1385 s |

## How

1. **Skill damage toward the class median.** For each main skill, its best kit's clear time was compared with the class
   median and its coefficient scaled; three rounds, each using the skill's measured response (a skill whose damage is
   mostly carried by its set or its supports barely responds — Burst Arrow, Meteor — so those were capped, not crushed).
   Tooltips stay exact (they are generated from the coefficients).
2. **A class dial.** The weak skills that went up are the ones the levelling bots use (Whirlwind, Ground Stomp,
   Multishot), so levelling sped up (warrior 26 → 33 levels in two hours, ranger 28 → 35). Every skill of the warrior was
   then scaled ×0.8 and of the ranger ×0.9 — the same factor for all skills of a class, so the parity between skills holds.
3. **Item fixes where one item carried a skill:** The Ninefold Gale +150–200 % → **+100–150 %** (Whirlwind's
   legendary-only lift was 1.54× the warrior median); Regalia of the Fallen Star 2: Aerial echo **60 → 45 %**;
   Siegebreaker's Arsenal 6: **+10 → +12 %** per active Device (Pitch Mortar's legendary-only kit beat the set 1.26×).

Net coefficient changes (`shared/src/data/skills/*.ts`, before → after):

| Warrior | | Ranger | | Mage | |
|---|---|---|---|---|---|
| Cleave | 1.6 → 2.45 | Tracking Arrow | 1.55 → 3.19 | Magic Missile | 2.3 → 2.53 |
| Whirlwind | 3.4 → 4.47 | Skipstone Bolt | 1.35 → 2.95 | Meteor | 7.4 → 5.55 |
| Rend | 6.0 → 21.0 | Multishot | 3.6 → 6.78 | Black Hole | 5.4 → 5.83 |
| Ground Stomp | 2.4 → 8.48 | Burst Arrow | 6.5 → 4.09 | Frost Nova | 1.75 → 2.5 |
| Quakeline | 7.55 → 3.17 | Arrowfall | 15 → 26.9 | Hydra | 2.8 → 2.17 |
| Tolling Blow | 2.0 → 3.49 | Sentry | 2.8 → 1.85 | Rime Needles | 0.9 → 3.13 |
| Sawtooth Hatchet | 1.8 → 0.726 | Spring Snare | 4.0 → 3.38 | Thrumming Ray | 2.0 → 8.0 |
| Ironplough | 2.6 → 3.32 | Overcast Volley | 1.1 → 0.89 | Cinderkin | 1.0 → 3.16 |
| Cairnfall | 3.0 → 8.56 | Pitch Mortar | 3.6 → 8.39 | Rimefield | 4.0 → 6.0 |
| | | Companion | 1.5 → 1.14 | Stormglass Orb | 0.5 → 1.29 |
| | | Murmuration | 2.0 → 3.26 | Orrery | 0.8 → 0.524 |

(Exact current values: the skill files. Ranger values include the ×0.9 dial and the warrior's the ×0.8 dial.)

## Results [M]

| After (shipped pool, `--search=0`) | D1 | D6 | Best-kit time spread |
|---|---|---|---|
| Warrior | 2/9 | **1.39 (passes)** | 528–~840 s |
| Ranger | 3/11 | **1.27 (passes)** | 379–~840 s |
| Mage | 1/11 | 2.12 (fails: Meteor) | 181 s (Meteor) then 239–360 s |

- **Levelling** (9 seeds × 120 min, `scripts/bot-metrics.ts run`): level after two hours warrior 26 → 31, ranger 28 → 34,
  mage 26 → 28 (all of today's changes together, more drops included). The warrior is no longer the slowest class. The
  pace gate (owner targets, baseline not re-recorded) passes on every seed.
- **Endgame** (ladder grid): a 6-piece set with 700 Lantern Ranks clears Ordeal II–III and reaches half of IV–V for
  every class; the owner's saved hero clears Ordeal II in 9:51 and gets 93 % of Ordeal III (100 % with no deaths once
  its Defense points are spent).

## Still open

- **Mage: Meteor.** Its best kit (Fallen Star 4 with Black Hole pulling and Frost Nova freezing for it) is a real synergy,
  and Meteor's own number barely matters there; with rares it is very slow, so its item lift is the largest (D6 2.12).
  The next step is its set and support interplay, not its damage.
- **D1** (two thirds of skills within 25 % of the class's best) and **D3** per skill (legendary-only vs best set; Skipstone
  Bolt 2.8×: no ranger set supports it) need item-level work per skill.
- **D2** (one item in every top kit) is mostly the audit's fixtures: every ranger fixture has Companion, every mage
  fixture Magic Missile, so their items show up everywhere.
- Levelling is 10–20 % faster for the bot than this morning; lowering kill XP is the clean lever if wanted.
