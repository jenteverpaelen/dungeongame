# Current build-system audit, before gameplay changes

2026-10-09. Inputs: L36, R01/R03/R04/R14/R21 and actual shared/server consumers. Preserve all current content and numeric values. Use only synthetic characters and a fresh explicit DATA_DIR; no persistence is necessary. Clear BACKUP_DIR.

1. Enumerate all 18 skills, 54 purchased tiers and 54 runes, including unlocks, cumulative point costs, declared modifiers and description. Calculate earliest affordable tiers from the actual level-point and unlock rules, without claiming observed player timing.
2. For every skill, combine no rune / each rune with tier 0–3. Build the actual server context with neutral equipment. Record resulting cost/cooldown/radius/duration/summon limit/damage bucket/element and flags. These are helper outputs, not damage-per-second or effectiveness measurements.
3. Follow every declared behavior flag to code consumers. Textual presence is a navigation aid, not branch coverage. Investigate discrepancies through a focused scenario before classifying one as a game bug.
4. Trace current tier/refund/slot command conditions and passive availability. Separate description, data and simulation semantics. Preserve costs, cooldowns and save fields during observation.

Acceptance: deterministic output, complete row counts, conservation of purchased/refunded skill points and explicit unknowns. Repeatability is not proof of enjoyable builds. Full combat balance, unfamiliar-player comprehension, real skill usage and reference-game timelines remain separate research. Any correction requires a concrete before-case and its own decision entry.
