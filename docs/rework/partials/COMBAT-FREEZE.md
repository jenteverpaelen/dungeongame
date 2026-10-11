# Combat rules freeze sheet (F-CMB-01) — approved as recommended

Read from the code on 2026-10-11 (after engine wave 2) **[M: values as implemented]**. This is the cross-class rule set
the roadmap wants locked before content scales; skill and rune numbers belong to the class bible
(`docs/rework/depth/`) and are not repeated. Owner decision 2026-10-11: "use recomendations for now i can still decide or change later" — every row below is
**frozen as recommended (changeable later)**. Nothing here is a new design; every row names where it lives.

| # | Rule | Current value | Where | Grounding / evidence | Owner |
|---|---|---|---|---|---|
| 1 | Attacks | primary skill fires automatically at a target in reach chosen by the hero's target preference; slotted skills auto-cast by their rule | `server/src/sim/brain.ts`, `shared/src/autoCast.ts` | owner direction (auto-combat); tests `autoCastControls`, `targetPriority` | approved as recommended |
| 2 | Auto-cast modes | Automatic / While still / Paused per slot; manual keys always work | `shared/src/autoCast.ts` | tests `autoCastControls`, `manualSkills` | approved as recommended |
| 3 | Resources | Fury 100, +on hit, decays 3/s after 4 s out of combat · Hatred 125, +5/s · Arcane Power 100, +10/s | `shared/src/data/classes.ts`, `tuning.ts` (FURY_DECAY_DELAY_MS) | D3 resource models [K] | approved as recommended |
| 4 | Movement | 250 u/s base, player radius 16, server-authoritative with client prediction | `shared/src/constants.ts`, `shared/src/movement.ts` | movement parity tests | approved as recommended |
| 5 | Dash | 230 u in 170 ms, 2.8 s cooldown, 220 ms invulnerable | `shared/src/constants.ts` DASH | sim `input` checks | approved as recommended |
| 6 | Monster telegraphs | every windup × 1.3, never under 320 ms; ground warning for slams, charges, lobs, fractures | `server/src/sim/tuning.ts` WINDUP_MULT / MIN_WINDUP_MS, `monsters.ts` | owner "fair, readable" direction; reedclaw / siltusk tests | approved as recommended |
| 7 | Aggro / leash | notice at 520 u (+ line of sight), pack alert 420 u, leash 1600 u from home → walk back and fully heal | `tuning.ts` | D3 leash reset [K] | approved as recommended |
| 8 | Control on monsters | stun / freeze / chill (−40 % speed and attack timers) / knockback / pull; elites take half duration, guardians and hoardlings are immune | `server/src/sim/effects.ts` ccFactor, `status.ts` | D3 elite CC reduction [K] | approved as recommended |
| 9 | Debuffs | weaken (−x % monster damage), vulnerable (+x %, can be scoped to skills), taunt (monster fights the taunter / walks to the taunting thing), bleed / burn DoTs (500 ms tick), freeze build-up to 100, mark | `server/src/sim/status.ts` | engine wave 2 tests | approved as recommended |
| 10 | Monster abilities | elite traits (8 + Faulted), charge, lob, fan, fracture, explode; data-driven enrage and summon (F-MON-02) | `elites.ts`, `monsters.ts`, `behaviours.ts` | `behaviours.test.ts`, sim elite checks | approved as recommended |
| 11 | Elite / boss life | × 4 champion, × 6 rare, × 1.3 minion, × 70 guardian, × 9 hoardling (then level toughness) | `shared/src/progression.ts` ELITE_HP_MULT, `tuning.ts` | BALANCE.md fit | approved as recommended |
| 12 | Guardian | slam + 16-orb ring every 6 s (×0.75 enraged), adds after 7 s then every 12 s, enrage below 30 % (×1.3 speed, ×0.8 attack cooldown) | `rift.ts`, `behaviours.ts` BOSS_* | sim rift checks (identical before/after the toolkit move) | approved as recommended |
| 13 | Recovery | 5 s after the last hit taken: +4 % of max life per second (plus life-regen affixes); health globe drop chance 50 % from elites, 3.5 % from others | `players.ts`, `tuning.ts`, `shared/src/items.ts` rollDrops | D3 globes [K] | approved as recommended |
| 14 | Death | respawn after 5 s at the zone entry with full life (and full Hatred / Arcane Power), 2 s invulnerable; timed buffs end; no item, gold or XP loss | `tuning.ts` RESPAWN_MS, `players.ts` killPlayer / respawn | sim death checks | approved as recommended |
| 15 | Pace targets | per band, class median: trash TTK ≤ 1.0 s, champion TTK ≤ 1.25 × baseline (4.8–9.9 s), kills/min ≥ 0.75 × baseline (42–86); deaths reported only | `docs/rework/partials/bot-metrics/BOT-METRICS.md` | bots stand still — an upper bound for damage taken | approved; targets per band in `bot-metrics/targets.json`, checked by verify (`pace-targets`) |
| 16 | Feel / accessibility | camera shake on/off + strength, reduce motion, reduce flashes, damage-number size and filters, colour-vision palettes, rarity shapes | `client/src/game/preferences.ts` | SETTINGS.md (GAG / XAG references) | approved as recommended |

**Not covered here (other lanes):** damage formula and skill coefficients (engine / class bible), item budgets
(itemization), PvP (none). **Pace targets (F-CMB-08), approved as recommended:** per five-level band, on the median over the classes — trash
time-to-kill ≤ 1.0 s (the balance pass fit target, BALANCE.md §3), champion time-to-kill ≤ 1.25 × the recorded band,
kills per minute ≥ 0.75 × the recorded band (`docs/rework/partials/bot-metrics/targets.json`, from the baseline
re-recorded after the Warrior pilot). Deaths are reported, not gated (bots never dodge). Verify stage `pace-targets`
simulates 120 minutes per class and fails on a miss; an intended pace change re-records the baseline
(`npm run bot:metrics`) and the targets (`npx tsx scripts/bot-metrics.ts targets`). Class spread stays with the parity
harness (`server/test/parity.test.ts`).
