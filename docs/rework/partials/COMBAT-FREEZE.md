# Combat rules freeze sheet (F-CMB-01 draft for the owner)

Read from the code on 2026-10-11 (after engine wave 2) **[M: values as implemented]**. This is the cross-class rule set
the roadmap wants locked before content scales; skill and rune numbers belong to the class bible
(`docs/rework/depth/`) and are not repeated. Owner: mark each row *freeze*, *change* (say how) or *open*. Nothing here
is a new design; every row names where it lives.

| # | Rule | Current value | Where | Grounding / evidence | Owner |
|---|---|---|---|---|---|
| 1 | Attacks | primary skill fires automatically at a target in reach chosen by the hero's target preference; slotted skills auto-cast by their rule | `server/src/sim/brain.ts`, `shared/src/autoCast.ts` | owner direction (auto-combat); tests `autoCastControls`, `targetPriority` | |
| 2 | Auto-cast modes | Automatic / While still / Paused per slot; manual keys always work | `shared/src/autoCast.ts` | tests `autoCastControls`, `manualSkills` | |
| 3 | Resources | Fury 100, +on hit, decays 3/s after 4 s out of combat · Hatred 125, +5/s · Arcane Power 100, +10/s | `shared/src/data/classes.ts`, `tuning.ts` (FURY_DECAY_DELAY_MS) | D3 resource models [K] | |
| 4 | Movement | 250 u/s base, player radius 16, server-authoritative with client prediction | `shared/src/constants.ts`, `shared/src/movement.ts` | movement parity tests | |
| 5 | Dash | 230 u in 170 ms, 2.8 s cooldown, 220 ms invulnerable | `shared/src/constants.ts` DASH | sim `input` checks | |
| 6 | Monster telegraphs | every windup × 1.3, never under 320 ms; ground warning for slams, charges, lobs, fractures | `server/src/sim/tuning.ts` WINDUP_MULT / MIN_WINDUP_MS, `monsters.ts` | owner "fair, readable" direction; reedclaw / siltusk tests | |
| 7 | Aggro / leash | notice at 520 u (+ line of sight), pack alert 420 u, leash 1600 u from home → walk back and fully heal | `tuning.ts` | D3 leash reset [K] | |
| 8 | Control on monsters | stun / freeze / chill (−40 % speed and attack timers) / knockback / pull; elites take half duration, guardians and hoardlings are immune | `server/src/sim/effects.ts` ccFactor, `status.ts` | D3 elite CC reduction [K] | |
| 9 | Debuffs | weaken (−x % monster damage), vulnerable (+x %, can be scoped to skills), taunt (monster fights the taunter / walks to the taunting thing), bleed / burn DoTs (500 ms tick), freeze build-up to 100, mark | `server/src/sim/status.ts` | engine wave 2 tests | |
| 10 | Monster abilities | elite traits (8 + Faulted), charge, lob, fan, fracture, explode; data-driven enrage and summon (F-MON-02) | `elites.ts`, `monsters.ts`, `behaviours.ts` | `behaviours.test.ts`, sim elite checks | |
| 11 | Elite / boss life | × 4 champion, × 6 rare, × 1.3 minion, × 70 guardian, × 9 hoardling (then level toughness) | `shared/src/progression.ts` ELITE_HP_MULT, `tuning.ts` | BALANCE.md fit | |
| 12 | Guardian | slam + 16-orb ring every 6 s (×0.75 enraged), adds after 7 s then every 12 s, enrage below 30 % (×1.3 speed, ×0.8 attack cooldown) | `rift.ts`, `behaviours.ts` BOSS_* | sim rift checks (identical before/after the toolkit move) | |
| 13 | Recovery | 5 s after the last hit taken: +4 % of max life per second (plus life-regen affixes); health globe drop chance 50 % from elites, 3.5 % from others | `players.ts`, `tuning.ts`, `shared/src/items.ts` rollDrops | D3 globes [K] | |
| 14 | Death | respawn after 5 s at the zone entry with full life (and full Hatred / Arcane Power), 2 s invulnerable; timed buffs end; no item, gold or XP loss | `tuning.ts` RESPAWN_MS, `players.ts` killPlayer / respawn | sim death checks | |
| 15 | Pace (measured, not a target) | engaged bot, per five-level band: trash TTK median 0–0.9 s, champion 2.0–11.1 s, 50–124 kills/min; 0–4 deaths in 240 simulated minutes per class | `docs/rework/partials/bot-metrics/BOT-METRICS.md` | bots stand still — an upper bound for damage taken | target? |
| 16 | Feel / accessibility | camera shake on/off + strength, reduce motion, reduce flashes, damage-number size and filters, colour-vision palettes, rarity shapes | `client/src/game/preferences.ts` | SETTINGS.md (GAG / XAG references) | |

**Not covered here (other lanes):** damage formula and skill coefficients (engine / class bible), item budgets
(itemization), PvP (none). **Measured TTK/survivability targets (F-CMB-08)** need an owner number per band; the bot
metrics baseline and the parity harness (`server/test/parity.test.ts`) are the instruments to check them against.
