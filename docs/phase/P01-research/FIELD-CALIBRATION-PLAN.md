# Field calibration before setting pacing targets

2026-10-09, before harness. L39, roadmap F-TEL-02, R14 and ECONOMY-REPORT.md. This measures the existing game; no balance, content or player data changes.

## Protocol

- Real Instance at20Hz with one synthetic PlayerLink and the existing regression bot's movement/navigation policy. It knows the whole map's monsters, uses breadth-first routing, approaches warrior targets more closely, and dashes when low on life. This is a bot-assisted scenario, never a human/new-player timing claim.
- Three classes × starts at1/20/70 × seeds47/73/101, five simulated minutes each:27 runs. Seeds are arbitrary reproducible scenario identifiers, not gameplay constants or a statistically sufficient sample. L1 uses starter gear; L20/L70 use the existing test's explicitly listed level-appropriate rare gear/build/tier policy. No set items or Cube powers. Fixed Normal difficulty; glade at1, ashen at20/70. Fixtures are not equal-power class builds.
- Retain all inventory and loot. No test-side deletion, salvage, auto-equip, skill spending during play, teleport, heal, resource refill or respawn shortcut. Natural leveling, skill auto-slotting, drops, pickup, deaths and respawn remain active. Once the bag is full, skip chasing item loot but continue combat. This is an inventory-limited field visit, not a full town-service loop.
- Record actual cumulative regular+Paragon XP using current threshold helpers; expose start/end levels. Report per-minute windows and whole-run totals, kills/deaths, XP/gold, acquired inventory by rarity, first kill/level/item/legendary-or-set, bag-full time and initial gear stats/build.
- Inspect newly spawned personal loot each tick, before its450/500ms arming delay permits pickup. Account for spawned, picked, remaining and expired units separately. Cross-check pickup events against saved inventory/gold/gems/materials and Instance counters. Never call uncollected ground items acquired wealth.
- TTK is snapshot-observed first damage to death, grouped by rank with sample counts/quantiles and50ms resolution. Zero means same sampled tick, not instantaneous combat. Final live targets with a first hit are censored. Travel, off-screen events and acquisition delays limit interpretation; full encounter TTK is not claimed.
- Capture computational timing separately from gameplay time; no browser, socket encoding, persistence load or100-player performance claim. Run twice and compare the gameplay payload excluding measured execution duration; inspect failures before using numbers.

Pilot correction: the first reconciliation wrongly equated all world monster deaths with the player's credited kills (247 versus228). `killMob` credits only eligible witnesses/killer; ongoing effects after death can outlast proximity eligibility. Record world deaths and credited kills separately, and reconcile the save count with Player.kills. This is a metric correction, not a gameplay fix. The fixture generator also duplicated a timing variable; strict typecheck caught it before execution. Pin XP_MULT=3 explicitly and record it; it is the existing prototype default, not a proposed pacing target.

## Acceptance and future effect

Strict standalone typecheck, exact reconciliation and reproducibility. Report range across seeds and individual results, not confidence intervals or extrapolated casual hours-to-cap. Compare only to the explicitly fixed offline assumptions with their different enemy mix, loot and downtime. No numerical tuning follows automatically. Next evidence: realistic equipment decisions/town visits, additional conditions and human sessions. Rollback is removing this research harness; preserve historical output and leave the original regression test intact.
