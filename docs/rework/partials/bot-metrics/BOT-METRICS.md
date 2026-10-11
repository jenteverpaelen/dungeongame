# Bot metrics (F-TEL-02)

Measured [M] by `npx tsx scripts/bot-metrics.ts run 240`: the engaged leveling bot of `server/test/sim.ts` (class build, skill points spent, best own drop worn by sheet DPS × √toughness), 240 simulated minutes per class, seed 12648430, fields only (Whispering Glade, Ashen Hollow from level 12), no town trips, quests, rifts or vendor sales. A row closes at every fifth level (or the end of the run); rates are per hour of simulated play. Overrides: none.

**Limits.** Bots stand in melee and never dodge, so deaths and damage taken are an upper bound for humans; they also never walk back to town, so kills/min is an upper bound for real sessions. This is a typical-gear curve, not a lucky one (see `docs/rework/BALANCE.md` §3).

| Class | end level | deaths | minutes to L5 · L10 · L15 · L20 · L25 · L30 |
|---|---:|---:|---|
| warrior | 41 | 1 | 4.6 · 17.7 · 34 · 57.9 · 96.5 · 139.5 |
| ranger | 42 | 0 | 7 · 21.8 · 43.6 · 70.1 · 95.2 · 130.8 |
| mage | 38 | 2 | 6.4 · 19.6 · 42.7 · 80.3 · 116.2 · 156 |

## warrior

| levels | zone | at min | min in band | kills/min | TTK trash s | TTK champ s | deaths/h | taken % life/min | XP/h | gold/h | items/h n/m/r/L+S | gems/h | mats/h |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| 1→5 | whispering glade | 4.6 | 4.6 | 108 | 0.50 | 3.9 | 0.0 | 72 | 134 k | 37 k | 39/52/26/0 | 52 | 130 |
| 5→10 | whispering glade | 17.7 | 13.1 | 95 | 0.65 | 5.8 | 4.6 | 77 | 522 k | 85 k | 46/23/18/0 | 60 | 60 |
| 10→15 | ashen hollow | 34.0 | 16.3 | 73 | 0.35 | 5.0 | 0.0 | 1 | 1.52 M | 193 k | 85/77/48/7 | 81 | 51 |
| 15→20 | ashen hollow | 57.9 | 23.8 | 105 | 0.65 | 6.4 | 0.0 | 38 | 2.49 M | 475 k | 65/45/35/8 | 65 | 86 |
| 20→25 | ashen hollow | 96.5 | 38.6 | 75 | 0.85 | 9.5 | 0.0 | 51 | 2.96 M | 634 k | 53/34/20/3 | 54 | 53 |
| 25→30 | ashen hollow | 139.5 | 43.0 | 81 | 0.85 | 8.8 | 0.0 | 47 | 4.49 M | 1.08 M | 35/53/28/3 | 47 | 73 |
| 30→35 | ashen hollow | 180.5 | 41.0 | 102 | 0.65 | 7.0 | 0.0 | 49 | 7.28 M | 2.14 M | 38/39/31/4 | 44 | 70 |
| 35→40 | ashen hollow | 229.4 | 48.9 | 91 | 0.70 | 6.6 | 0.0 | 20 | 8.90 M | 3.58 M | 33/53/53/5 | 81 | 79 |
| 40→41 | ashen hollow | 240.0 | 10.6 | 103 | 0.60 | 5.9 | 0.0 | 23 | 12.00 M | 5.09 M | 68/79/45/6 | 85 | 79 |

## ranger

| levels | zone | at min | min in band | kills/min | TTK trash s | TTK champ s | deaths/h | taken % life/min | XP/h | gold/h | items/h n/m/r/L+S | gems/h | mats/h |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| 1→5 | whispering glade | 7.0 | 7.0 | 73 | 0.50 | 3.9 | 0.0 | 70 | 88 k | 23 k | 17/34/17/0 | 9 | 51 |
| 5→10 | whispering glade | 21.8 | 14.8 | 75 | 0.65 | 6.1 | 0.0 | 50 | 460 k | 92 k | 57/36/12/0 | 49 | 61 |
| 10→15 | ashen hollow | 43.6 | 21.7 | 56 | 0.70 | 7.5 | 0.0 | 9 | 1.14 M | 168 k | 44/33/14/3 | 50 | 55 |
| 15→20 | ashen hollow | 70.1 | 26.5 | 88 | 0.25 | 7.9 | 0.0 | 45 | 2.24 M | 392 k | 57/43/29/5 | 66 | 102 |
| 20→25 | ashen hollow | 95.2 | 25.1 | 116 | 0.15 | 4.6 | 0.0 | 21 | 4.56 M | 858 k | 67/43/41/5 | 67 | 91 |
| 25→30 | ashen hollow | 130.8 | 35.7 | 98 | 0.50 | 5.1 | 0.0 | 33 | 5.42 M | 1.59 M | 40/39/40/5 | 47 | 67 |
| 30→35 | ashen hollow | 170.3 | 39.5 | 104 | 0.45 | 5.0 | 0.0 | 57 | 7.58 M | 2.29 M | 38/71/44/3 | 71 | 88 |
| 35→40 | ashen hollow | 214.9 | 44.6 | 111 | 0.50 | 5.0 | 0.0 | 18 | 9.75 M | 3.42 M | 48/63/48/4 | 82 | 89 |
| 40→42 | ashen hollow | 240.0 | 25.1 | 126 | 0.40 | 4.9 | 0.0 | 13 | 13.19 M | 4.75 M | 50/86/45/12 | 62 | 88 |

## mage

| levels | zone | at min | min in band | kills/min | TTK trash s | TTK champ s | deaths/h | taken % life/min | XP/h | gold/h | items/h n/m/r/L+S | gems/h | mats/h |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| 1→5 | whispering glade | 6.4 | 6.4 | 77 | 0.00 | 1.8 | 9.3 | 40 | 97 k | 27 k | 56/65/28/0 | 47 | 37 |
| 5→10 | whispering glade | 19.6 | 13.1 | 93 | 0.45 | 4.2 | 0.0 | 46 | 517 k | 70 k | 41/18/27/0 | 78 | 50 |
| 10→15 | ashen hollow | 42.7 | 23.1 | 47 | 0.65 | 6.5 | 0.0 | 10 | 1.07 M | 164 k | 26/47/16/3 | 54 | 75 |
| 15→20 | ashen hollow | 80.3 | 37.6 | 64 | 0.75 | 10.0 | 0.0 | 23 | 1.58 M | 254 k | 32/35/10/3 | 48 | 59 |
| 20→25 | ashen hollow | 116.2 | 35.9 | 80 | 0.50 | 7.3 | 0.0 | 35 | 3.18 M | 551 k | 38/40/22/3 | 48 | 72 |
| 25→30 | ashen hollow | 156.0 | 39.8 | 84 | 0.50 | 5.1 | 1.5 | 23 | 4.85 M | 1.09 M | 47/53/36/3 | 60 | 71 |
| 30→35 | ashen hollow | 199.8 | 43.8 | 93 | 0.40 | 5.5 | 0.0 | 26 | 6.83 M | 1.73 M | 45/53/42/4 | 37 | 81 |
| 35→38 | ashen hollow | 240.0 | 40.2 | 80 | 0.50 | 7.0 | 0.0 | 22 | 7.30 M | 2.59 M | 30/40/27/3 | 45 | 51 |

