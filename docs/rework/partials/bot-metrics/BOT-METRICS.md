# Bot metrics (F-TEL-02)

Measured [M] by `npx tsx scripts/bot-metrics.ts run 240`: the engaged leveling bot of `server/test/sim.ts` (class build, skill points spent, best own drop worn by sheet DPS × √toughness), 240 simulated minutes per class, seed 12648430, fields only (Whispering Glade, Ashen Hollow from level 12), no town trips, quests, rifts or vendor sales. A row closes at every fifth level (or the end of the run); rates are per hour of simulated play. Overrides: none.

**Limits.** Bots stand in melee and never dodge, so deaths and damage taken are an upper bound for humans; they also never walk back to town, so kills/min is an upper bound for real sessions. This is a typical-gear curve, not a lucky one (see `docs/rework/BALANCE.md` §3).

| Class | end level | deaths | minutes to L5 · L10 · L15 · L20 · L25 · L30 |
|---|---:|---:|---|
| warrior | 43 | 0 | 5.2 · 16.8 · 36.7 · 56.9 · 81.2 · 117.7 |
| ranger | 44 | 4 | 7.5 · 22.2 · 46.6 · 70.8 · 94 · 132.3 |
| mage | 38 | 0 | 5.4 · 17 · 39.7 · 72.2 · 117.1 · 163.3 |

## warrior

| levels | zone | at min | min in band | kills/min | TTK trash s | TTK champ s | deaths/h | taken % life/min | XP/h | gold/h | items/h n/m/r/L+S | gems/h | mats/h |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| 1→5 | whispering glade | 5.2 | 5.2 | 92 | 0.70 | 5.8 | 0.0 | 91 | 120 k | 39 k | 81/23/23/0 | 46 | 58 |
| 5→10 | whispering glade | 16.8 | 11.6 | 105 | 0.65 | 4.5 | 0.0 | 40 | 582 k | 117 k | 41/62/52/5 | 67 | 93 |
| 10→15 | ashen hollow | 36.7 | 19.9 | 56 | 0.65 | 7.1 | 0.0 | 10 | 1.25 M | 256 k | 66/60/21/3 | 75 | 87 |
| 15→20 | ashen hollow | 56.9 | 20.1 | 116 | 0.50 | 5.5 | 0.0 | 42 | 2.94 M | 663 k | 42/42/39/9 | 75 | 72 |
| 20→25 | ashen hollow | 81.2 | 24.3 | 119 | 0.55 | 5.8 | 0.0 | 41 | 4.71 M | 1.05 M | 64/84/30/5 | 59 | 106 |
| 25→30 | ashen hollow | 117.7 | 36.6 | 86 | 0.75 | 6.6 | 0.0 | 28 | 5.28 M | 1.61 M | 39/46/36/3 | 82 | 71 |
| 30→35 | ashen hollow | 155.4 | 37.7 | 100 | 0.55 | 4.7 | 0.0 | 31 | 7.93 M | 2.36 M | 38/51/32/6 | 73 | 97 |
| 35→40 | ashen hollow | 200.8 | 45.3 | 100 | 0.60 | 6.1 | 0.0 | 18 | 9.59 M | 4.62 M | 44/49/45/3 | 77 | 81 |
| 40→43 | ashen hollow | 240.0 | 39.2 | 85 | 0.65 | 7.4 | 0.0 | 24 | 9.51 M | 5.28 M | 18/40/28/5 | 81 | 75 |

## ranger

| levels | zone | at min | min in band | kills/min | TTK trash s | TTK champ s | deaths/h | taken % life/min | XP/h | gold/h | items/h n/m/r/L+S | gems/h | mats/h |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| 1→5 | whispering glade | 7.5 | 7.5 | 65 | 0.65 | 5.4 | 8.0 | 60 | 83 k | 22 k | 56/40/16/0 | 40 | 56 |
| 5→10 | whispering glade | 22.2 | 14.8 | 82 | 0.65 | 5.4 | 8.1 | 74 | 460 k | 83 k | 45/41/12/0 | 49 | 61 |
| 10→15 | ashen hollow | 46.6 | 24.4 | 50 | 0.90 | 11.1 | 2.5 | 39 | 1.02 M | 147 k | 34/37/15/2 | 34 | 39 |
| 15→20 | ashen hollow | 70.8 | 24.2 | 96 | 0.40 | 4.3 | 0.0 | 32 | 2.45 M | 447 k | 79/55/37/10 | 69 | 99 |
| 20→25 | ashen hollow | 94.0 | 23.2 | 124 | 0.00 | 2.8 | 0.0 | 18 | 4.92 M | 1.25 M | 65/59/62/10 | 80 | 88 |
| 25→30 | ashen hollow | 132.3 | 38.2 | 95 | 0.55 | 6.1 | 0.0 | 24 | 5.05 M | 1.32 M | 41/64/28/3 | 69 | 72 |
| 30→35 | ashen hollow | 169.8 | 37.5 | 98 | 0.75 | 5.6 | 0.0 | 32 | 7.97 M | 2.56 M | 43/74/40/3 | 70 | 72 |
| 35→40 | ashen hollow | 203.9 | 34.1 | 122 | 0.40 | 4.7 | 0.0 | 14 | 12.74 M | 5.16 M | 39/63/63/5 | 84 | 104 |
| 40→44 | ashen hollow | 240.0 | 36.1 | 118 | 0.25 | 4.8 | 0.0 | 19 | 15.12 M | 7.10 M | 55/65/57/3 | 88 | 105 |

## mage

| levels | zone | at min | min in band | kills/min | TTK trash s | TTK champ s | deaths/h | taken % life/min | XP/h | gold/h | items/h n/m/r/L+S | gems/h | mats/h |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| 1→5 | whispering glade | 5.4 | 5.4 | 90 | 0.00 | 2.1 | 0.0 | 54 | 117 k | 32 k | 101/45/34/0 | 11 | 123 |
| 5→10 | whispering glade | 17.0 | 11.6 | 102 | 0.40 | 3.2 | 0.0 | 19 | 584 k | 96 k | 88/57/41/5 | 62 | 77 |
| 10→15 | ashen hollow | 39.7 | 22.7 | 54 | 0.75 | 7.7 | 0.0 | 21 | 1.09 M | 168 k | 26/42/26/3 | 58 | 63 |
| 15→20 | ashen hollow | 72.2 | 32.4 | 75 | 0.75 | 8.3 | 0.0 | 33 | 1.83 M | 312 k | 35/30/15/6 | 48 | 74 |
| 20→25 | ashen hollow | 117.1 | 45.0 | 65 | 0.75 | 8.0 | 0.0 | 33 | 2.54 M | 490 k | 33/40/20/3 | 48 | 55 |
| 25→30 | ashen hollow | 163.3 | 46.2 | 74 | 0.50 | 7.6 | 0.0 | 33 | 4.18 M | 1.01 M | 31/48/26/1 | 43 | 62 |
| 30→35 | ashen hollow | 210.5 | 47.2 | 82 | 0.35 | 6.3 | 0.0 | 39 | 6.34 M | 2.01 M | 42/42/28/3 | 58 | 74 |
| 35→38 | ashen hollow | 240.0 | 29.5 | 91 | 0.25 | 5.5 | 0.0 | 13 | 8.85 M | 3.79 M | 35/61/59/4 | 75 | 91 |

