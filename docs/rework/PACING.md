# Measured pacing — how fast the shipped rules level (2026-10-10)

Answers roadmap decision D-02 with *data* instead of the old "~40–60 hours" guess. Reproduce with:

```
XP_MULT=3 npx tsx server/test/sim.ts leveling 240     # the shipped default
XP_MULT=1 npx tsx server/test/sim.ts leveling 240     # un-boosted kill XP
```

## Method (and what it is not)

- Real authoritative simulation at 20 Hz (`server/test/sim.ts`, `levelingScenario`): a fresh level-1 character per class
  fights in the open fields (Whispering Glade, Ashen Hollow from L12) with the regression `Bot`, equips every upgrade
  by sheet DPS × √toughness, trashes junk, and never travels or does quests.
- **It is an idealised farmer, not a player.** No walking to NPCs, no reading, no town trips, no dying, Normal
  difficulty, kill XP only (story XP is a fixed extra and is not multiplied).
- Minutes are simulated game time, one run per class and multiplier (seeds fixed by the harness).

## Results (minutes of play to reach each level)

**`XP_MULT=3` — the server default today** (`server/src/config.ts`: "Dev multiplier on monster XP (prototype default 3)")

| Class | L10 | L20 | L30 | L40 | L50 | L60 | L70 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Warrior | 1.6 | 4.6 | 7.1 | 10.5 | 13.8 | 18.0 | 23.1 |
| Ranger | 1.6 | 3.3 | 5.6 | 8.4 | 11.0 | 13.8 | 17.4 |
| Mage | 1.3 | 3.3 | 5.1 | 8.1 | 12.0 | 16.1 | 20.9 |

**`XP_MULT=1` — the curve as designed**

| Class | L10 | L20 | L30 | L40 | L50 | L60 | L70 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Warrior | 3.4 | 8.9 | 15.9 | 25.0 | 36.9 | 51.3 | 81.2 |
| Ranger | 3.3 | 8.2 | 14.5 | 21.2 | 29.2 | 38.9 | 50.8 |
| Mage | 3.4 | 8.2 | 15.1 | 23.7 | 34.7 | 46.3 | 73.1 |

Other measurements from the same runs: the bot sustains roughly 17–494 kills/min (typically 100–290), **0 deaths in
all six runs**, damage taken 1–10 % of current life per minute, time-to-kill 0.01–0.06 s for trash and 0.15–0.7 s for
champions/rares at every level.

## What this means

1. **The playtest build levels about three times faster than the designed curve.** `XP_MULT` defaults to 3 and the
   playtest guide says "ordinary health and progression"; kill XP is tripled. Story XP is fixed, so the *story*
   still paces the same, but any grinding is ×3. Decide on purpose: keep ×3 for quick testing, or set `XP_MULT=1`
   for a playtest that shows the real curve.
2. **The un-boosted ceiling for an ideal farmer is about 50–80 minutes to level 70.** The old synthesis claim
   ("40–60 hours solo") is off by more than an order of magnitude; the earlier arithmetic in the roadmap (4.7 h from
   an assumed 60 kills/min) was also pessimistic because real packs die in a fraction of a second.
3. **Normal difficulty is not a challenge for an optimising bot.** Sheet DPS outgrows monster life by orders of
   magnitude (L70: ≈450,000 DPS against ≈30,000 trash HP). Danger has to come from elites, bosses, telegraphs and the
   difficulty tiers, not from trash — which is what the encounter work in P7/P9 does. Human survival is **not**
   established by this data.
4. **Offline gains are small next to active play**: 15 kills/min (25 % of the assumed 60) is roughly 5–15 % of what
   the bot kills actively. Fine for an "idle bonus"; revisit when P14 defines account-level progression.

## Open

- A quest-following bot (so time includes walking, reading and story fights) — needs the quest engine in the loop.
- Real-player timing from fresh-player tests (roadmap P6 acceptance), then set the target band (D-02).
- Torment tiers: HP ×16 … ×8192 against these DPS values needs its own table (see roadmap §1.3).
