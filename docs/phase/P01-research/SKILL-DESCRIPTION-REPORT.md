# Skill descriptions checked against behavior

2026-10-09. L38 and SKILL-BEHAVIOR-PLAN.md preceded the probes; SKILL-DESCRIPTION-DECISION.md preceded production edits. This is C025, not a completed combat/build redesign.

## Measurements

`checks/skill-behavior-before.json` and `skill-behavior-repeat.json` are identical (SHA256 `5BFAAA3795692B8FE56DFB195AB0C776B88BFDE58FF26F2A46F5D1D405A471D3`). Three real Hydra shots and 32 real buff casts use controlled server instances, actual collision/projectile handlers and unequipped synthetic characters. Frost hit and chilled its direct target with an ice shard; it had no splash. Arcane reached the off-path target while normal and Frost did not. Full fixture geometry and limitations are in the plan and JSON.

The two buff summaries said 10% regardless of actual rune/tier bonuses. Battle Rage with Marauder's Rage and all tiers applies 30%; Magic Weapon with Force Weapon and all tiers applies 25%. Ferocity also applies 25% Critical Hit Damage. The server numbers are retained exactly.

`skill-behavior-after.json` compares equal to the before payload after removing only `description` and `currentRuneText`. No actual cast, bonus, duration, impact, damage, chill or projectile result changed. Two regression tests exercise all 32 buff combinations against known prior bonuses and the rendered summary. The initial probe fixture's invalid null equipment/theme types were corrected; its repeated numerical output remained identical. Standalone script typecheck passes.

## Implementation and effect

Shared `skillBuffBonuses` supplies both server casts and descriptions. Hydra's summary follows the selected element; Frost's rune card describes its measured chilling shards. Removed false cone/constant-percentage wording and duplicate buff formulas. No skill, rune, tier, save field or other game content was removed. No costs, geometry, combat numbers, UI styling, town or camera changed. Rollback the helper, casts and description templates together; no migration is needed.

## Verification on the owner's PC

Strict full verification passes, report `checks/skill-descriptions-verify.json`, original root `hearthfall-verify-SOBCdA`: 747 server checks, 382 simulation checks and all other stages, including the new two tests, typecheck/content/build. Existing large-bundle warning remains. Server check totals contain conditional runtime checks and vary between runs; no checks were removed.

`scripts/capture-skill-descriptions.mjs` uses installed Chrome 154.0.8037.99, Node24.19.0, fresh profile and synthetic save directory `hf-skill-ui-nXktcW/saves`, with debug disabled and BACKUP_DIR empty. It starts two prewritten L70 fixtures and uses actual UI input/server commands to select runes and purchase tiers. It never injects client character state. The fixtures are artificial; their automatic level-based slot filling is not evidence of a player's leveling journey.

All four 1920×1080 screenshots in `checks/skill-ui/` were opened and inspected. Frost's Cold summary/card, Force Weapon's 25%/90s summary, Marauder's 30%/90s summary and Ferocity's longer damage/crit summary are visible without clipping in the existing panels. Point spending is 69→57. Camera world height is 620, DPR1, document.hidden=false. The selector quoting was corrected before the browser run; the run passed on its first launch. Trace contains exact states and browser version.

No human comprehension, smaller viewport, reference-game screenshot, sustained Hydra DPS, Mammoth behavior or performance certification is claimed. Screenshot FPS is not a benchmark. Full equipment-aware summaries and other declared-versus-actual behavior remain open research.
