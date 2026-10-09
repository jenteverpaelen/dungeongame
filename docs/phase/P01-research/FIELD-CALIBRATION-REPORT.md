# Field reward calibration

2026-10-09. C027 / L39 / FIELD-CALIBRATION-PLAN.md. These are bot-assisted simulations of existing rules, not player timings or desired balance. No production code changed.

## What was run

27 five-minute cases (135 simulated minutes), repeated independently: warrior/ranger/mage × L1 starter/L20 rares/L70 rares × seeds47/73/101. Normal difficulty, XP_MULT=3, one character per instance, no set or Cube powers. The inherited navigation knows every monster location and uses pathfinding. No mid-run equipment/tier upgrades, healing, resource refill, teleport, inventory clearing or town service. Natural deaths and respawn remain. The bot stops chasing items at full inventory but keeps fighting.

Raw initial stats/gear/builds, per-minute windows, first events, all reward accounting and TTK samples: `checks/field-calibration.json` and `field-calibration-repeat.json`. Gameplay payloads are identical excluding the separate execution timings: SHA256 of JSON.stringify after deleting execution is `3d4ac0cab1c9e946932b1ae15aa783aaab3ee5788237ab60192003bf09d7399a`.

Actual cumulative XP uses every regular and Paragon threshold, including levels gained during the run. A world monster death is distinct from a credited kill. The first pilot wrongly equated them and failed228 versus247; the current harness reconciles saved kills with Player.kills and records uncredited deaths separately. Source eligibility is explicit in killMob. This did not expose or change a gameplay defect. A duplicate copied timing variable was caught by standalone typecheck before the pilot.

## Measured ranges across the three seeds

Each row describes five minutes from the stated starting fixture. Level1/20 rows level up during the run; they are not fixed-level DPS comparisons. XP, gold and item ranges are totals, not hourly forecasts.

| Start | Class | Credited kills/min | End level / Paragon | XP gained | Gold collected | Deaths | Items retained |
|---|---|---:|---|---:|---:|---:|---:|
| L1 starter | Warrior |45.6–57.4|L11–13|238,452–393,198|1,479–3,992|8–10|31–54|
| L1 starter | Ranger |60.2–71.6|L15|571,506–595,245|5,484–6,025|7–11|40–60|
| L1 starter | Mage |71.0–76.6|L15–16|593,286–827,568|5,235–5,475|3–6|41–60|
| L20 rares | Warrior |197.2–215.6|L40|17,658,286–18,972,301|284,449–303,302|0|60|
| L20 rares | Ranger |258.4–279.6|L44–45|26,206,514–28,868,705|268,064–390,603|0|60|
| L20 rares | Mage |159.0–162.4|L37–38|13,491,235–14,662,112|133,546–239,525|0|60|
| L70 rares | Warrior |261.8–283.2|P11–12|107,225,941–114,057,431|10,501,946–11,838,662|0|60|
| L70 rares | Ranger |423.4–439.2|P17–18|172,455,615–182,655,590|13,380,791–13,654,127|0|60|
| L70 rares | Mage |236.0–262.0|P11|101,338,898–103,762,997|8,349,256–9,629,035|0|60|

20 of27 cases fill the60-slot inventory: all18 rare-gear cases and two starter cases. Earliest full bag is40.4s (L70 ranger seed47); rare-gear latest is103.5s (L20 warrior seed101). The two starter fills occur181.75s and257.65s. This is a field-only policy that never returns to town, not a normal service cadence.

At L1, first credited kill occurs1.15–3.30s and first level3.95–9.25s after simulated field entry. These exclude character selection, town travel, reading and human reaction. They cannot be used as onboarding time targets. Some first legendary-or-set pickups are absent by run end; null means censored, not impossible.

## Dropped is not acquired

Every newly spawned personal reward is observed before its arming delay ends. Pickup IDs are unique; final inventory/gold/gems/Death's Breath reconcile with pickup payloads. Dropped entity totals equal acquired + remaining ground + expired. No item is deleted by the harness. Current90-second ground expiry remains untouched.

For example, L70 ranger seed47 spawns522 items but retains60; expired ground items include10 legendaries and3 set items. Expired gold is6,323,003 while13,380,791 was actually collected. These are uncollected drops, not currency taken out of the save. High killing rate alone overstates acquired rewards under this policy.

TTK is first observed damage to observed death at50ms resolution, with nearest-rank quantiles and explicit sample counts. Same-tick damage/death is0ms; it is not proof of instantaneous combat. Long maxima can include disengagement/death/return; surviving hit targets at the end are censored. AOI and absent initial descriptions also limit sample coverage. Never treat these as complete encounter durations or compare class medians without the fixture differences.

## Decisions supported and still open

[I] Next measurements should include equipment decisions and real town returns, because the frozen-gear aggressive bot repeatedly dies early and bag capacity interrupts acquisition later. The runs do not justify nerfing one class or setting new XP/loot rates. Existing class builds, geometry and gear rolls differ; three seeds are not a population sample.

The offline model uses fixed15 kills/min and averaged trash assumptions; active cases include elites, goblins, evolving levels, movement, pickup and death. Its nominal25% parameter is not a measured ratio to these runs. See ECONOMY-REPORT.md; no offline adjustment follows automatically.

Strict standalone TypeScript check and all reconciliation/repeat assertions pass on the owner's Windows PC, Node24.19.0. Fresh DATA_DIRs `hf-fields-401063eb3dcf453fae1de41eaa7c09a4` and `hf-fields-repeat-3531f72881ff4ff38dd5af89204c5142` stay empty; BACKUP_DIR cleared. First completed execution sums5,808.92ms excluding instance/fixture construction; this is computational duration, not a rendering/socket/persistence/100-player benchmark. No full suite or browser repeat was needed for a research-only harness after C025's green verification. Unused copied imports/options were removed afterward; typecheck repeated.

Rollback: remove this separate harness, retain historical evidence. Original sim.ts and all production rules are unchanged. Calibration-sprint completion, full class parity, human enjoyment and roadmap G3/G4 remain unclaimed.
