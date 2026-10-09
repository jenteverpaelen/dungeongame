# Correct measured skill descriptions

2026-10-09. L38 / SKILL-BEHAVIOR-PLAN.md preceded the probe; `checks/skill-behavior-before.json` records three actual impacts and32 buff casts.

[M] Frost's projectile uses Cold/shard, zero splash and a chill flag; its direct target took6 damage and received2000ms chill. A second target68units away took no damage/chill. Arcane's60 splash hit that same second target; normal40 splash did not. The chosen ordinary targets have18radius and are held stationary in a real clear map patch. This does not establish full combat balance or a general cone footprint.

[M] Both buff summaries stay at10% despite their actual rune/tier bonuses. Tier3/no rune gives15%; Marauder's Rage +tier3 gives30%; Force Weapon +tier3 gives25%. Full32-state evidence includes durations and crit fields. Existing buff rules are authoritative for this correction.

[D] Correct Frost's rune text to describe chilling ice shards. Make the general Hydra summary element-aware and avoid saying all variants have three heads/fireballs. Keep detailed variant behavior on its rune card. Replace fixed buff numbers with a shared helper extracted from the existing cast code; include Ferocity's actual crit-damage bonus in the summary. Both server casts and displayed descriptions consume the same helper. No damage bucket, duration, cost, target selection, radius, projectile, rune or tier behavior changes.

Why not create a frost cone: no new geometry/balance target or owner playtest supports changing the existing attack. A description error is evidence for correcting the explanation. Gear-aware complete summaries, Mammoth's detailed sustained behavior and other skill-description limitations remain separate work.

Checks: compare actual before/after payloads (excluding text); semantic tests must compare real casts to descriptions and known existing cases. Typecheck/content/regression, then local Chrome1080p inspect buff summaries and Frost card using the unchanged panel. Rollback shared helper/casts/templates together; no save migration. Removal is false wording and duplicated buff formulas only, with no game content deleted.
