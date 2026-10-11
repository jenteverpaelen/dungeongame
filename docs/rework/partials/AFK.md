# Offline gains v2 and the alt fairness model (F-MET-02)

Labels: **[M]** measured here, **[K]** prior knowledge (not re-checked), **[P]** proposal for the owner.
Code: `server/src/afk.ts`, table `shared/src/data/afkRates.ts` (generated), tests `server/test/afk.test.ts`.

## What changed

| | v1 (until now) | v2 |
|---|---|---|
| Active rate | fixed assumption 60 kills/min (never measured) | the hero's own field kill rate from its last session with ≥ 5 min in fields [P: 5 min], **never above** the engaged-bot median for its level band [M, bot-metrics baseline]; heroes without a measurement keep 60/min, also capped by the band |
| Offline share, cap | 25 %, 12 h | unchanged (owner-set values in `shared/src/constants.ts`) |
| Per kill | XP; gold = 0.22 × mean pile; **invented** materials 1/40 scrap, 1/40 dust, 1/150 crystal per kill | XP and gold from the live ordinary-kill rules (`NORMAL_GOLD_DROP_CHANCE`, `baseGoldAmount`, Normal); materials = the ordinary-kill equipment drop chance × field factors × rarity weights × salvage yield (`items.ts`, `cube.ts`) — as if every normal / magic / rare find were salvaged. Monte-Carlo check of `rollDrops` within 3 % (gold) / 8 % (materials) [M] |
| Levels while away | all kills at the starting level | minute by minute: monsters level with the hero as it levels (as in play) |
| Rounding | per login | fractions carry within an absence and drop at the end → splitting an absence never earns more [M, test] |
| Not offline | — | legendary / set finds, gems, globes, elites, goblins, rifts, dungeons, town |
| Report | time, kills, XP, levels, gold, materials | + the rate used, whether it is the hero's own, the 25 % share, and when the 12 h cap was hit |

Idleon bases offline gains on the character's own active rate [K]; that is the model here, with the measured band median
as a ceiling so a burst session cannot be banked.

Two hours away in Ashen Hollow, v1 → v2 [M, `afk.ts` on fresh rangers, no gear]:

| level | rate basis | kills | XP | gold | scrap / dust / crystal |
|---:|---|---|---|---|---|
| 10 | assumed 60 | 1,800 → 1,605 (band 53.5/min) | 219,600 → 242,940 | 20,566 → 22,245 | 45/45/12 → 6/7/1 |
| 20 | assumed 60 | 1,800 → 1,800 | 707,400 → 751,515 | 68,581 → 74,034 | 45/45/12 → 6/8/2 |
| 20 | own 30/min | 1,800 → 900 | 707,400 → 358,562 | 68,581 → 34,884 | 45/45/12 → 3/4/1 |
| 60 | assumed 60 | 1,800 → 1,800 | 4,557,600 → 4,557,600 | 2,011,721 → 2,011,721 | 45/45/12 → 7/27/15 |

The material cut is the main balance effect: v1's constants were ~7× what the same kills drop in play since the
2026-10-10 drop reduction. XP / gold for heroes without a measurement barely move.

## Fairness model — what an alt may and may not inherit [P, owner approval needed]

* **Per character, never shared.** Each hero's offline gains use only its own save: its own last zone, level, gear
  (XP / gold find) and its own measured rate. Nothing an alt does changes another hero's gains (test).
* **No banking of real time.** Gains depend on wall-clock time away, capped at 12 h per absence; several heroes away at
  once each get their own capped time (they were each "fighting"), which is the Idleon model [K]. Relogging more often
  never earns more than staying away (test).
* **No inflated rates.** An alt cannot exceed its band's measured median; a hero that never fought in a field gets the
  old assumption, also capped.
* **Nothing account-wide yet.** The stash is per character (D-24) and there are no shared currencies, so there is no
  channel through which an alt's offline gains reach another hero. When F-MET-01 (account-wide stash/currencies) lands,
  the owner decides whether offline gold may enter a shared purse; the safe default is "character purse only".
* **Export / delete.** The measured rate (`afk` in the character save) is part of the character export and is erased
  with the character.

## Not covered

Real human rates (the band ceiling comes from bots, an upper bound), a long soak, and the owner's approval of the
fairness model above.
