# Balance pass — pace, monster toughness and loot (2026-10-10)

**Trigger (owner, 2026-10-10):** *"the leveling is way too fast and gear upgrade and oneshotting mobs … I could already do
master torment rift at level 13 and then the leveling went insanely fast"*, then *"it's just too many drops you're
getting … you should still be able to do Master whenever you want … if you get so lucky early and get a decent item then
it should also be rewarding to do more than expected"*.

This document records what was measured, what was found, what changed, and how to re-tune. Everything numeric below was
produced by `server/test/sim.ts` (authoritative 20 Hz simulation, bots, no browser). **Measured** means a sim number;
**inferred** means arithmetic on measured numbers; **external** means a web source that was not independently verified.
Human survival and "feel" are **not** established by any of this — they need a playtest.

## 1. The report reproduced (before the pass)

Full level-13 rare kit (`makeChar`), shipped defaults (`XP_MULT=3`), one rift per row, 12-minute cap:

| Class | Normal rift | Master rift |
|---|---|---|
| Warrior | 3:15, level 13→22 | 4:59, **13→30** |
| Ranger | 3:14, 13→22 | 3:44, **13→30** |
| Mage | 3:59, 13→22 | 5:14, **13→30** |

Zero deaths in all six runs; median trash time-to-kill 0.0 s (one-shot). That is exactly the report: a five-minute Master
rift gave seventeen levels.

## 2. Root causes (all measured)

1. **Kill XP was tripled by default.** `server/src/config.ts` defaulted `XP_MULT` to 3 ("prototype default"); the owner's
   playtest server (`.local/START-OWNER-PLAYTEST.cmd`) does not set it, so it ran at ×3 while the playtest guide said
   "ordinary progression". Master adds another +250 % XP (`DIFFICULTIES[3].xpBonus`) → 10.5× the designed kill XP.
2. **The life curve was written against the *sheet* damage number, but real damage is 15–50× the sheet.**
   `monsterHp(L) = 10·1.123^(L−1)` grows 1.123× per level; weapon damage (1.1^ilvl), quadratic main-stat affixes and
   skill coefficients (Meteor 740 %, Sentries, Whirlwind ticks …) grow ≈1.18–1.21× per level. A character wearing
   level-appropriate rares killed an ordinary monster with one skill hit from about level 8 on, at every level. Doubling
   life per difficulty tier (×2/×4/×8) cannot matter when the gap is ×50–×300.
3. **Whole levels from quests.** `storyXp(a, b)` summed the level bars, so quest *n* literally paid "level a→b"; seven
   quests = level 1→20, 33 quests = level 50, with kill XP on top.
4. **Loot per kill × kills per minute.** A bot sustains 100–290 kills/min against one-shot monsters; ordinary monsters
   dropped an item 5 % of the time, champions/rares 1–3, treasure goblins 5–9 items at 25 % Legendary each, and the
   45-miss pity timer guaranteed a Legendary/Set every ~45 equipment drops. Measured on the engaged bot at 1/6-field-drops
   but unchanged goblins: **330 items/h, ~100 rares/h, ~25 Legendary+Set/h** — one every two to three minutes.
5. **Difficulty open from level 1.** Normal–Master were always selectable (`minLevel: 1`). Per the owner this stays: see §5.

## 3. Method

* `npx tsx server/test/sim.ts balance [seconds] [levels] [difficulties]` — one cell per class × level × tier, a full
  rare kit at ilvl = level, **immortal** (life refilled every tick so *damage taken* is readable instead of deaths).
* `npx tsx server/test/sim.ts leveling <minutes>` — the **engaged bot**: a fresh character that follows the class build
  (`BUILDS`), spends skill points evenly, wears the best drop by `sheetDPS × √toughness`, and farms the fields with no
  town trips or quests. `PLAYER=auto` instead leaves the auto-slotted skills with no points spent. Per five-level bucket it
  prints kills/min, median time-to-kill (trash/champion), deaths, damage taken and items/gems/materials/globes/gold per hour.
* `npx tsx server/test/sim.ts fit <minutes> <target>` — plays the engaged bot, freezes a copy at levels 3…70 and
  bisects, per copy, the monster-life factor that makes its median trash time-to-kill equal `target` seconds.
* `npx tsx server/test/sim.ts calibrate` / `curve` — the same bisection against a fixed full-rare kit, and the response
  of time-to-kill/kill rate/damage taken to the factor at one level.
* `TOUGH='[[1,1],…]'` and `DAMAGE='[[1,1],…]'` environment variables substitute the two balance tables for a run.

**Kit vs organic.** A full ilvl-matched rare kit is a *lucky* character; the engaged bot with drops only is a
*typical* one. The factors fitted from the typical bot are 1/3 – 1/2 of those fitted from the kit at levels 10–30, which
is what makes a lucky early item feel like a real jump (§5).

## 4. What changed

| Knob | Where | Before | After | Why / evidence |
|---|---|---|---|---|
| Kill XP default | `server/src/config.ts` `XP_MULT` | 3 | **1** | root cause 1 |
| Kill XP scale | `shared/src/progression.ts` `KILL_XP_SCALE` | – | **0.2** | engaged bots reached L40–50 in 180 min at 1/3; at 0.2 they reach L47–50 in 240 min (ranger L50 at 235 min), i.e. about four hours of ideal farming to level 50 (see §6) |
| Story XP share | `shared/src/storyBudget.ts` `STORY_XP_SHARE` | 1 (whole levels) | **0.5** | root cause 3; quests still pay half of their span, fighting pays the rest |
| Monster life | `server/src/sim/tuning.ts` `LEVEL_TOUGHNESS` | none | ×1 (L1) · ×2.5 (L5–8) · ×5 (L10) · ×15 (L20) · ×40 (L30) · ×80 (L40) · ×150 (L50) · ×350 (L70) | fitted so the engaged bot's median trash kill takes ≈1 s; ramps in gently early because a fresh character has only its primary attack |
| Monster damage | `server/src/sim/tuning.ts` `LEVEL_DAMAGE` | none | ×0.4 (L1–5) → ×0.5 (L10+) | longer fights multiply damage per kill; at ×0.5 the engaged bots died 1–8 times in 180 minutes and took 13–65 % of their life per minute in the worst five-level buckets; at ×0.25 they died 0–1 times, i.e. no danger |
| Field drops | `shared/src/items.ts` `FIELD_DROP_FACTOR` | – | **1/6** of the (already 2/3) equipment scale for ordinary/champion/rare/minion kills | root cause 4; bosses and goblins keep their batch |
| Gems and Death's Breath, field kills | `shared/src/items.ts` `FIELD_RESOURCE_FACTOR` | 1.2 % / 25 % gems, 60 % Death's Breath (per ordinary / elite kill) | **× 1/3** | they fed socket and upgrade power at ~110–270 gems/h and ~155–290 Death's Breath/h after the kill rate fell; now ~50–80 and ~70–125 per hour. Boss and goblin batches unchanged |
| Goblin batch | `shared/src/items.ts` | 5–9 items, 25 % Legendary each | **3–5 items, 12 %** | a goblin gave 1.17 Legendary/Set on average; now 0.32 |
| Goblin frequency | `server/src/sim/tuning.ts` `GOBLIN_FIELD_CHANCE` | 0.02 per pack | **0.012** | one per ~12 min at a human pace |
| Guardian natural Legendary | `shared/src/items.ts` | 0.35 per item | **0.2** | the guaranteed Legendary stays; natural extras 1.58 → 1.2 Legendary/Set per guardian |
| Difficulty unlocks | `shared/src/progression.ts` | Normal–Master from L1, Torment L60 | **unchanged** | owner: "you should still be able to do Master whenever you want" |

What did **not** change: tier multipliers (Hard ×2/×1.3, Expert ×4/×1.7, Master ×8/×2.2, Torment ×16·2^i), XP/gold/Legendary
bonuses per tier, gold/gem/material budgets, health globes, rarity weights, pity threshold, rift/boss mechanics.

### Why Master is now worth it only for a lucky or strong character

With typical gear a Master trash kill takes ≈8× the Normal time and the monsters deal ×2.2 per hit, so a typical L13
character feels Master as "possible but slow and dangerous"; the sim kit (full rares) finishes a Master rift in 12–15
minutes (below) and levels ~0.25/min. The reward side is the existing +250 % XP/gold, rarity weights (+3 rare weight per
tier), Legendary chance ×(1+0.3·tier) and +8 % item count per tier. A single decent early item moves the character a
whole difficulty rung, which is the "rewarding to do more than expected" the owner asked for. **Unverified:** that the
reward is *enough* to make people choose it — that needs play.

## 5. Results (after)

Same kit and cap as §1:

| Class | Normal rift | Hard rift | Master rift (12-min cap) |
|---|---|---|---|
| Warrior | 4:27, 13→14 | 7:10, 13→15 | 96 % done, 13→16 |
| Ranger | 4:14, 13→14 | 7:46, 13→15 | 73 % done, 13→15 |
| Mage | 7:16, 13→14 | 5:54, 13→15 | 69 % done, 13→15 |

What a level-13 character meets on each difficulty in the fields (`masterprobe 13`, five simulated minutes per cell, real
life; ranges are over the three classes). *Typical* is the engaged bot with the gear it found; *lucky* is a full
ilvl-13 rare kit, i.e. "got so lucky early":

| Level 13 | Normal | Hard | Expert | Master |
|---|---|---|---|---|
| typical: median trash kill | 0.9–1.7 s | 1.8–5.0 s | 4.6–7.8 s | 8–13 s |
| typical: deaths in 5 min / life taken per min | 0 / 55–115 % | 0 / 76–240 % | 0–2 / 130–310 % | 0–4 / 240–340 % |
| typical: levels per minute | 0.13–0.18 | 0.14–0.16 | 0.10–0.17 | 0.08–0.18 |
| lucky kit: median trash kill | 0.10–0.15 s | 0.6–0.75 s | 1.7–2.2 s | 2.6–3.7 s |
| lucky kit: deaths / life taken per min | 0 / 17–36 % | 0 / 23–50 % | 0 / 25–101 % | 0 / 51–94 % |
| lucky kit: levels per minute | 0.27–0.31 | 0.28–0.42 | 0.27–0.42 | 0.25–0.37 |

Reading: Master at level 13 is *possible* for everyone, punishing with typical gear (a death every minute or two in
the worst class) and comfortable with a full decent kit. For a lucky kit the best XP per minute is Hard or Expert;
Master pays in loot (Legendary chance ×1.9, +9 rare weight, +24 % item count) rather than XP.

Engaged bot, fields only, Normal, minutes of play to reach each level (ranger / mage; `leveling 240`):

| L5 | L10 | L15 | L20 | L25 | L30 | L35 | L40 | L45 | L50 |
|---|---|---|---|---|---|---|---|---|---|
| 7 / 6 | 23 / 15 | 49 / 31 | 68 / 50 | 84 / 73 | 112 / 103 | 138 / 135 | 170 / 178 | 200 / 216 | 235 / – |

The shipped build reached L10 in 1.3–1.6 min, L30 in 5–7 min and L70 in 17–23 min (`PACING.md`, ideal bot, ×3).
Typical rates during the engaged runs: 45–130 kills/min, median trash time-to-kill 0.6–1.9 s on the warrior (0.0–0.35 s
once the ranger/mage bots collect set pieces — see §7), champion 2–17 s, deaths 0–10 per 180 min.

Loot, per 1000 kills at level 40, Normal, with the pity timer running (Monte Carlo of the shipped `rollDrops` against the
original `shared/src/items.ts` from commit 2361a65, 300 000 kills per row; items / rares / Legendary+Set):

| Source | Before | After |
|---|---|---|
| Ordinary | 49.9 / 12.0 / 1.35 | **8.3 / 2.0 / 0.23** |
| Champion | 1001 / 338 / 28.3 | **165 / 56 / 4.7** |
| Rare | 1667 / 567 / 47.0 | **277 / 93 / 7.8** |
| Minion | 99 / 33 / 2.7 | **17 / 5.6 / 0.48** |
| Treasure goblin | 4668 / 1220 / 1168 | **2667 / 817 / 321** |
| Rift guardian | 4186 / 905 / 1586 | **4417 / 1114 / 1213** (always ≥1 Legendary; the fallback item now appears more often) |

Per hour at a human-ish 50–60 kills/min and one goblin per ~12 minutes this is roughly 100 equipment drops, ~25 rares
and ~4 Legendary/Set from the fields (inferred from the table, not simulated end to end), against 330 / ~100 / ~25 for
the engaged bot before the goblin and guardian trims.

## 6. How the pace targets were chosen — and what is a guess

| Point | Source | Status |
|---|---|---|
| D3 speed-levelling to 70: 1.5–4 h; skilled power-levelled player 45–60 min | mein-mmo.de level guides, Season 15–17 | external, reported by guides |
| D3 story mode: 3–5 h (rushed) to 15–20 h (first time); HowLongToBeat average ~18 h | expertbeacon.com summary of HLTB | external |
| D4: campaign ends around level 50; ~25–50 h to reach it | gamesradar / dexerto / space4games | external, 2022 interview for the 35 h figure |
| PoE: Act 10 around level 70 | PoE guides | external |
| Roadmap's own old claim: "~40–60 hours solo" | `docs/design/FULL_GAME_ROADMAP.md` (claims-vs-measurements table) | intent never measured; the same document flags it |
| D3 legendary per elite pack ≈1.3 % at Expert/Master, ≈2 % Torment I … 7 % Torment VI | SegmentNext 2014 community analysis | external, dated, unconfirmed by Blizzard |

The pace chosen here — about four hours of *ideal* farming to level 50 and roughly ten to level 70 — sits between D3
speed-levelling and D3 story pace once a human's ~50–60 % efficiency is applied. **That is a design guess, not a
measurement of players.** The two constants to change are `KILL_XP_SCALE` (grinding) and `STORY_XP_SHARE` (quests), and
`XP_MULT` still scales both kill and AFK XP at run time.

External difficulty facts (for context only): D3 does **not** open Master from level 1 — it unlocks after a character
reaches 60 or finishes the campaign, and Torment I–VI at 60 (conflicting sources). The owner explicitly asked for an open
Master, so this project deliberately differs.

## 7. Known limits / open

* **Class spread.** Fitted factors differ 2–3× between classes (warrior and mage near the bottom, ranger highest at
  levels 20–40). One life table is a compromise: the strongest bot class still reaches 0.05–0.25 s trash kills from
  level ~20 once it has a set (≈20–45 Legendary+Set per hour in the *old* goblin regime). The proper fix is a class
  damage pass; `docs/phase/P09-mid-game/COMBAT-BAND-REPORT.md` already showed the warrior needing 5× longer than the
  ranger per encounter. Not done here.
* **The warrior bot stalls on some maps** (6 kills/min for hours at L15–17 with 0 deaths): a bot pathing trap, not
  balance; the same seed passes with a different map. Not investigated further.
* **Torment ladder shifted.** With ×350 life at level 70 a set + legendaries kit clears Torment I–III in 3–11 minutes and
  Torment V in ~10 (warrior); the old curve put Torment VIII there. The ladder above III now needs paragon growth that
  this pass did not model. Tests were re-pointed (L20 Hard, L70 Torment II, party perf Torment III).
* **Gold and globes are unchanged per kill**, so per *hour* they fell with the kill rate (engaged bot: 0.3–2.4 M gold/h
  at levels 20–33) while per *level* gold rose (more kills per level). Crafting is limited by materials, not gold, so this
  was left alone; vendor prices were not retuned. Check the economy audit before a public test.
* **Human survival is unverified.** The bots stand still in melee and never dodge; humans should take less damage per
  fight, but nobody has played this.
* **Early game.** The first five levels now take 5–7 minutes of farming; the quest chain still dominates there.

## 8. Re-tuning

```
XP_MULT=1 npx tsx server/test/sim.ts fit 180 1.0      # per class: factor that gives 1 s median trash kills
npx tsx server/test/sim.ts leveling 240               # pace, deaths, damage taken, drops per hour
npx tsx server/test/sim.ts balance 40 10,20,30 0,3    # kit vs difficulty
TOUGH='[[1,1],[20,25],[70,350]]' npx tsx server/test/sim.ts leveling 120   # try a table without editing code
```
Edit `LEVEL_TOUGHNESS` / `LEVEL_DAMAGE` in `server/src/sim/tuning.ts`; re-run `npm run verify`.
